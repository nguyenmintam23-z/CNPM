import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CatalogProduct, priceCart } from './pricing.service';

const D = (v: number) => new Prisma.Decimal(v);
const SIZE_M = { id: 's-m', name: 'M', extraPrice: D(5000) };
const SIZE_L = { id: 's-l', name: 'L', extraPrice: D(10000) };
const TRAN_CHAU = { id: 't-tc', name: 'Trân châu', price: D(7000), isActive: true };
const PUDDING = { id: 't-pd', name: 'Pudding', price: D(8000), isActive: false };

const traSua: CatalogProduct = {
  id: 'p-ts', name: 'Trà sữa', basePrice: D(35000), isActive: true,
  sizes: [{ size: SIZE_M }, { size: SIZE_L }],
  toppings: [{ topping: TRAN_CHAU }, { topping: PUDDING }],
};
const nuocSuoi: CatalogProduct = { id: 'p-ns', name: 'Nước suối', basePrice: D(10000), isActive: true, sizes: [], toppings: [] };
const ngungBan: CatalogProduct = { ...nuocSuoi, id: 'p-nb', name: 'Sinh tố bơ', isActive: false };
const catalog = [traSua, nuocSuoi, ngungBan];

function loiDong(fn: () => unknown) {
  try {
    fn();
  } catch (e) {
    expect(e).toBeInstanceOf(BadRequestException);
    return (e as BadRequestException).getResponse() as { message: string; lines: { index: number; code: string }[] };
  }
  throw new Error('không ném lỗi');
}

describe('priceCart – tính giá phía máy chủ (FR-03, FR-06)', () => {
  it('unitPrice = giá gốc + size + topping; lineTotal = unitPrice × số lượng; tổng đúng', () => {
    const r = priceCart([
      { productId: 'p-ts', sizeId: 's-l', toppingIds: ['t-tc'], quantity: 2 },
      { productId: 'p-ns', quantity: 3 },
    ], catalog);
    const [a, b] = r.lines;
    expect(a.sizePrice.toNumber()).toBe(10000);
    expect(a.unitPrice.toNumber()).toBe(35000 + 10000 + 7000);
    expect(a.lineTotal.toNumber()).toBe(104000);
    expect(b.sizePrice.toNumber()).toBe(0);
    expect(b.lineTotal.toNumber()).toBe(30000);
    expect(r.totalAmount.toNumber()).toBe(134000);
    expect(a.toppings).toEqual([{ id: 't-tc', name: 'Trân châu', price: D(7000) }]);
  });

  it('không dùng số thực: 3 × 33.333 không lệch đồng nào', () => {
    const p = { ...nuocSuoi, basePrice: D(33333) };
    expect(priceCart([{ productId: 'p-ns', quantity: 3 }], [p]).totalAmount.toNumber()).toBe(99999);
  });
});

describe('priceCart – chỉ ra dòng cần sửa (FR-13, UC-01 E1)', () => {
  it.each([
    ['món không tồn tại', { productId: 'khong-co', quantity: 1 }, 'PRODUCT_NOT_FOUND'],
    ['món ngừng kinh doanh', { productId: 'p-nb', quantity: 1 }, 'PRODUCT_INACTIVE'],
    ['món có size mà không chọn size', { productId: 'p-ts', quantity: 1 }, 'SIZE_REQUIRED'],
    ['size không thuộc món', { productId: 'p-ts', sizeId: 's-xl', quantity: 1 }, 'SIZE_NOT_ALLOWED'],
    ['món không có size mà gửi size', { productId: 'p-ns', sizeId: 's-m', quantity: 1 }, 'SIZE_NOT_ALLOWED'],
    ['topping không thuộc món', { productId: 'p-ts', sizeId: 's-m', toppingIds: ['t-la'], quantity: 1 }, 'TOPPING_NOT_ALLOWED'],
    ['topping ngừng bán', { productId: 'p-ts', sizeId: 's-m', toppingIds: ['t-pd'], quantity: 1 }, 'TOPPING_NOT_ALLOWED'],
    ['topping lặp', { productId: 'p-ts', sizeId: 's-m', toppingIds: ['t-tc', 't-tc'], quantity: 1 }, 'TOPPING_DUPLICATED'],
  ])('%s → 400 với mã %s', (_, item, code) => {
    const body = loiDong(() => priceCart([item], catalog));
    expect(body.message).toBe('Giỏ hàng có món cần sửa');
    expect(body.lines).toEqual([expect.objectContaining({ index: 0, code })]);
  });

  it('báo tất cả dòng sai cùng lúc, đúng vị trí, bỏ qua dòng đúng', () => {
    const body = loiDong(() => priceCart([
      { productId: 'p-ns', quantity: 1 },
      { productId: 'p-ts', quantity: 1 },
      { productId: 'p-nb', quantity: 1 },
    ], catalog));
    expect(body.lines.map((l) => [l.index, l.code])).toEqual([[1, 'SIZE_REQUIRED'], [2, 'PRODUCT_INACTIVE']]);
  });
});
