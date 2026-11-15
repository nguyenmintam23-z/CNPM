import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

export interface StockRow {
  id: string;
  name: string;
  stock_quantity: number;
  reserved_quantity: number;
}

export interface StockShortage {
  productId: string;
  name: string;
  requested: number;
  available: number;
  code: 'OUT_OF_STOCK' | 'INSUFFICIENT_STOCK';
  message: string;
}

export const MSG_KHONG_DU_HANG = 'Một số món không đủ hàng';

/** Gộp số lượng theo món (một món có thể nằm ở nhiều dòng khác topping). */
export function demandByProduct(lines: { productId: string; quantity: number }[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const l of lines) m.set(l.productId, (m.get(l.productId) ?? 0) + l.quantity);
  return m;
}

/** So nhu cầu với số còn bán được (stock − reserved); trả các món thiếu (FR-13 (2), (3), (5)). */
export function findShortages(demand: Map<string, number>, rows: StockRow[]): StockShortage[] {
  const thieu: StockShortage[] = [];
  for (const r of rows) {
    const can = demand.get(r.id) ?? 0;
    const con = Math.max(r.stock_quantity - r.reserved_quantity, 0);
    if (can > con) {
      thieu.push({
        productId: r.id,
        name: r.name,
        requested: can,
        available: con,
        code: con === 0 ? 'OUT_OF_STOCK' : 'INSUFFICIENT_STOCK',
        message: con === 0 ? `${r.name} đã hết hàng` : `${r.name} chỉ còn ${con} ly`,
      });
    }
  }
  return thieu;
}

/**
 * InventoryModule (backend-data-design §3, §5): giữ tồn kho trên Product khi tạo đơn.
 * Phải gọi trong transaction tạo đơn. Khóa các dòng products theo id tăng dần để hai đơn đồng thời
 * không chờ nhau vòng tròn; kiểm tra còn đủ rồi mới tăng reserved_quantity (FR-13 (6), FR-16).
 * CHECK (reserved <= stock) ở database là lớp bảo vệ cuối.
 */
@Injectable()
export class InventoryService {
  /** Khóa dòng products (SELECT … FOR UPDATE) theo id tăng dần. */
  async lockProducts(tx: Prisma.TransactionClient, productIds: string[]): Promise<StockRow[]> {
    const ids = [...new Set(productIds)].sort();
    if (!ids.length) return [];
    return tx.$queryRaw<StockRow[]>`
      SELECT id::text AS id, name, stock_quantity, reserved_quantity
      FROM products
      WHERE id = ANY(${ids}::uuid[])
      ORDER BY id
      FOR UPDATE`;
  }

  /** Giữ tồn cho đơn mới: thiếu hàng thì 409 kèm danh sách món thiếu, không giữ gì. */
  async hold(tx: Prisma.TransactionClient, lines: { productId: string; quantity: number }[], locked: StockRow[]): Promise<void> {
    const demand = demandByProduct(lines);
    const thieu = findShortages(demand, locked);
    if (thieu.length) {
      throw new ConflictException({ statusCode: 409, error: 'Conflict', message: MSG_KHONG_DU_HANG, shortages: thieu });
    }
    for (const [productId, qty] of [...demand].sort(([a], [b]) => a.localeCompare(b))) {
      await tx.product.update({ where: { id: productId }, data: { reservedQuantity: { increment: qty } } });
    }
  }

  /**
   * Thử thanh toán lại sau FAILED (tồn đã RELEASED): khóa products, kiểm tra còn đủ, giữ lại (FR-14, A2.4).
   * Thiếu hàng → 409 kèm món thiếu, không giữ gì (UC-01 E5).
   */
  async rehold(tx: Prisma.TransactionClient, lines: { productId: string; quantity: number }[]): Promise<void> {
    const locked = await this.lockProducts(tx, lines.map((l) => l.productId));
    await this.hold(tx, lines, locked);
  }

  /** Thanh toán thành công: chốt tồn đã giữ, trừ cả stock và reserved (backend-data-design §5 "Áp dụng kết quả"). */
  async commit(tx: Prisma.TransactionClient, lines: { productId: string; quantity: number }[]): Promise<void> {
    await this.lockProducts(tx, lines.map((l) => l.productId));
    for (const [productId, qty] of [...demandByProduct(lines)].sort(([a], [b]) => a.localeCompare(b))) {
      await tx.product.update({
        where: { id: productId },
        data: { stockQuantity: { decrement: qty }, reservedQuantity: { decrement: qty } },
      });
    }
  }

  /** Thanh toán thất bại hoặc hủy đơn: giải phóng tồn đã giữ, chỉ giảm reserved (FR-14, FR-23). */
  async release(tx: Prisma.TransactionClient, lines: { productId: string; quantity: number }[]): Promise<void> {
    await this.lockProducts(tx, lines.map((l) => l.productId));
    for (const [productId, qty] of [...demandByProduct(lines)].sort(([a], [b]) => a.localeCompare(b))) {
      await tx.product.update({ where: { id: productId }, data: { reservedQuantity: { decrement: qty } } });
    }
  }
}
