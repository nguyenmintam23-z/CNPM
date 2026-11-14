import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

const D = (v: Prisma.Decimal.Value) => new Prisma.Decimal(v);

/** Một dòng giỏ hàng do client gửi: chỉ có lựa chọn, không có giá (FR-06). */
export interface CartLineInput {
  productId: string;
  sizeId?: string | null;
  toppingIds?: string[];
  quantity: number;
}

/** Mã lỗi theo dòng, để giao diện chỉ ra đúng món cần sửa (FR-13, UC-01 E1). */
export type LineErrorCode =
  | 'PRODUCT_NOT_FOUND'
  | 'PRODUCT_INACTIVE'
  | 'SIZE_REQUIRED'
  | 'SIZE_NOT_ALLOWED'
  | 'TOPPING_NOT_ALLOWED'
  | 'TOPPING_DUPLICATED';

export interface LineError {
  /** Vị trí dòng trong giỏ client gửi (bắt đầu từ 0). */
  index: number;
  productId: string;
  code: string;
  message: string;
}

/** Dữ liệu catalog cần để tính giá, đọc trong cùng transaction tạo đơn. */
export interface CatalogProduct {
  id: string;
  name: string;
  basePrice: Prisma.Decimal;
  isActive: boolean;
  sizes: { size: { id: string; name: string; extraPrice: Prisma.Decimal } }[];
  toppings: { topping: { id: string; name: string; price: Prisma.Decimal; isActive: boolean } }[];
}

export interface PricedLine {
  productId: string;
  productName: string;
  sizeId: string | null;
  sizeName: string | null;
  quantity: number;
  /** Phụ thu size lúc đặt (Class Domain: OrderItem.sizePrice). */
  sizePrice: Prisma.Decimal;
  /** Giá một ly = giá gốc + phụ thu size + tổng topping (thống nhất với Đại, data-model-adjustments). */
  unitPrice: Prisma.Decimal;
  /** Thành tiền = unitPrice × quantity. */
  lineTotal: Prisma.Decimal;
  toppings: { id: string; name: string; price: Prisma.Decimal }[];
}

export interface PricedCart {
  lines: PricedLine[];
  totalAmount: Prisma.Decimal;
}

export const MSG_GIO_CAN_SUA = 'Giỏ hàng có món cần sửa';

/**
 * Kiểm tra lựa chọn và tính giá phía máy chủ (CatalogModule, backend-data-design §3; FR-03, FR-06, FR-13, NFR-04).
 * - Món phải tồn tại và đang kinh doanh.
 * - Món có size thì bắt buộc chọn một size của món đó; món không có size thì không được gửi size.
 * - Topping phải thuộc món, đang bán, không lặp.
 * Mọi dòng sai được trả cùng lúc để khách sửa một lần; không tạo đơn.
 */
export function priceCart(items: CartLineInput[], products: CatalogProduct[]): PricedCart {
  const theoId = new Map(products.map((p) => [p.id, p]));
  const loi: LineError[] = [];
  const lines: PricedLine[] = [];

  items.forEach((item, index) => {
    const them = (code: LineErrorCode, message: string) => loi.push({ index, productId: item.productId, code, message });
    const p = theoId.get(item.productId);
    if (!p) return them('PRODUCT_NOT_FOUND', 'Món không tồn tại');
    if (!p.isActive) return them('PRODUCT_INACTIVE', `${p.name} đã ngừng kinh doanh`);

    let size: CatalogProduct['sizes'][number]['size'] | null = null;
    if (p.sizes.length > 0) {
      if (!item.sizeId) return them('SIZE_REQUIRED', `Chọn size cho ${p.name}`);
      size = p.sizes.find((s) => s.size.id === item.sizeId)?.size ?? null;
      if (!size) return them('SIZE_NOT_ALLOWED', `Size đã chọn không áp dụng cho ${p.name}`);
    } else if (item.sizeId) {
      return them('SIZE_NOT_ALLOWED', `${p.name} không có tùy chọn size`);
    }

    const toppingIds = item.toppingIds ?? [];
    if (new Set(toppingIds).size !== toppingIds.length) {
      return them('TOPPING_DUPLICATED', `Topping bị chọn lặp ở ${p.name}`);
    }
    const toppings: PricedLine['toppings'] = [];
    for (const id of toppingIds) {
      const t = p.toppings.find((x) => x.topping.id === id && x.topping.isActive)?.topping;
      if (!t) return them('TOPPING_NOT_ALLOWED', `Topping đã chọn không áp dụng hoặc đã ngừng bán cho ${p.name}`);
      toppings.push({ id: t.id, name: t.name, price: t.price });
    }

    const sizePrice = size ? size.extraPrice : D(0);
    const unitPrice = toppings.reduce((s, t) => s.plus(t.price), D(p.basePrice).plus(sizePrice));
    lines.push({
      productId: p.id,
      productName: p.name,
      sizeId: size?.id ?? null,
      sizeName: size?.name ?? null,
      quantity: item.quantity,
      sizePrice,
      unitPrice,
      lineTotal: unitPrice.times(item.quantity),
      toppings,
    });
  });

  if (loi.length) {
    throw new BadRequestException({ statusCode: 400, error: 'Bad Request', message: MSG_GIO_CAN_SUA, lines: loi });
  }
  return { lines, totalAmount: lines.reduce((s, l) => s.plus(l.lineTotal), D(0)) };
}

/** Bao lại để inject được; đọc catalog bằng client của transaction đang chạy. */
@Injectable()
export class PricingService {
  async load(db: Prisma.TransactionClient, productIds: string[]): Promise<CatalogProduct[]> {
    return db.product.findMany({
      where: { id: { in: [...new Set(productIds)] } },
      select: {
        id: true,
        name: true,
        basePrice: true,
        isActive: true,
        sizes: { select: { size: { select: { id: true, name: true, extraPrice: true } } } },
        toppings: { select: { topping: { select: { id: true, name: true, price: true, isActive: true } } } },
      },
    });
  }

  async price(db: Prisma.TransactionClient, items: CartLineInput[]): Promise<PricedCart> {
    return priceCart(items, await this.load(db, items.map((i) => i.productId)));
  }
}
