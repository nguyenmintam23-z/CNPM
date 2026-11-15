import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { demandByProduct, findShortages, InventoryService, StockRow } from './inventory.service';

const row = (id: string, name: string, stock: number, reserved: number): StockRow => ({
  id, name, stock_quantity: stock, reserved_quantity: reserved,
});

describe('Tồn kho khi tạo đơn (FR-13, backend-data-design §5)', () => {
  it('gộp số lượng theo món khi một món nằm ở nhiều dòng', () => {
    expect([...demandByProduct([
      { productId: 'a', quantity: 2 }, { productId: 'b', quantity: 1 }, { productId: 'a', quantity: 3 },
    ])]).toEqual([['a', 5], ['b', 1]]);
  });

  it('hết hàng (stock = reserved) → OUT_OF_STOCK; thiếu một phần → INSUFFICIENT_STOCK kèm số còn (FR-13 (2), (3))', () => {
    const thieu = findShortages(new Map([['a', 1], ['b', 3], ['c', 2]]), [
      row('a', 'Trà đào', 10, 10), row('b', 'Bạc xỉu', 5, 3), row('c', 'Cà phê', 5, 3),
    ]);
    expect(thieu).toEqual([
      expect.objectContaining({ productId: 'a', code: 'OUT_OF_STOCK', available: 0, message: 'Trà đào đã hết hàng' }),
      expect.objectContaining({ productId: 'b', code: 'INSUFFICIENT_STOCK', requested: 3, available: 2, message: 'Bạc xỉu chỉ còn 2 ly' }),
    ]);
  });

  it('khóa dòng products theo id tăng dần, bỏ id trùng (chống deadlock)', async () => {
    const queryRaw = jest.fn().mockResolvedValue([]);
    await new InventoryService().lockProducts({ $queryRaw: queryRaw } as unknown as Prisma.TransactionClient, ['c', 'a', 'c', 'b']);
    const [sql, ids] = queryRaw.mock.calls[0];
    expect(ids).toEqual(['a', 'b', 'c']);
    expect(sql.join('')).toMatch(/ORDER BY id\s+FOR UPDATE/);
  });

  it('đủ hàng: tăng reserved đúng một lần mỗi món', async () => {
    const update = jest.fn();
    const tx = { product: { update } } as unknown as Prisma.TransactionClient;
    await new InventoryService().hold(tx, [{ productId: 'b', quantity: 1 }, { productId: 'a', quantity: 2 }, { productId: 'b', quantity: 1 }],
      [row('a', 'A', 5, 0), row('b', 'B', 5, 0)]);
    expect(update.mock.calls.map((c) => [c[0].where.id, c[0].data.reservedQuantity.increment])).toEqual([['a', 2], ['b', 2]]);
  });

  it('thiếu hàng: 409 kèm shortages và không giữ món nào (FR-13 (1): không giữ tồn dở dang)', async () => {
    const update = jest.fn();
    const tx = { product: { update } } as unknown as Prisma.TransactionClient;
    const err = await new InventoryService()
      .hold(tx, [{ productId: 'a', quantity: 1 }, { productId: 'b', quantity: 9 }], [row('a', 'A', 5, 0), row('b', 'B', 5, 0)])
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ConflictException);
    expect((err as ConflictException).getResponse()).toMatchObject({ statusCode: 409, shortages: [{ productId: 'b', available: 5 }] });
    expect(update).not.toHaveBeenCalled();
  });

  it('thanh toán thành công: khóa products rồi trừ cả stock và reserved theo số lượng gộp', async () => {
    const queryRaw = jest.fn().mockResolvedValue([]);
    const update = jest.fn();
    const tx = { $queryRaw: queryRaw, product: { update } } as unknown as Prisma.TransactionClient;
    await new InventoryService().commit(tx, [{ productId: 'b', quantity: 1 }, { productId: 'a', quantity: 2 }, { productId: 'b', quantity: 3 }]);
    expect(queryRaw).toHaveBeenCalledTimes(1);
    expect(update.mock.calls.map((c) => [c[0].where.id, c[0].data])).toEqual([
      ['a', { stockQuantity: { decrement: 2 }, reservedQuantity: { decrement: 2 } }],
      ['b', { stockQuantity: { decrement: 4 }, reservedQuantity: { decrement: 4 } }],
    ]);
  });

  it('thanh toán thất bại: chỉ giảm reserved, không đụng stock (FR-14)', async () => {
    const update = jest.fn();
    const tx = { $queryRaw: jest.fn().mockResolvedValue([]), product: { update } } as unknown as Prisma.TransactionClient;
    await new InventoryService().release(tx, [{ productId: 'a', quantity: 2 }]);
    expect(update).toHaveBeenCalledWith({ where: { id: 'a' }, data: { reservedQuantity: { decrement: 2 } } });
  });

  it('thử lại sau thất bại: khóa, kiểm tra, giữ lại; thiếu hàng thì 409 (E5)', async () => {
    const update = jest.fn();
    const tx = { $queryRaw: jest.fn().mockResolvedValue([row('a', 'Trà đào', 3, 3)]), product: { update } } as unknown as Prisma.TransactionClient;
    await expect(new InventoryService().rehold(tx, [{ productId: 'a', quantity: 1 }])).rejects.toBeInstanceOf(ConflictException);
    expect(update).not.toHaveBeenCalled();
  });
});
