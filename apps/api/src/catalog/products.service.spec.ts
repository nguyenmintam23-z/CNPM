import { NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { availableQuantity, ProductsService } from './products.service';

const D = (v: number) => new Prisma.Decimal(v);

describe('availableQuantity', () => {
  it('bằng tồn trừ đang giữ (Class Domain)', () => {
    expect(availableQuantity(10, 3)).toBe(7);
  });

  it('bằng 0 khi hết hàng, không âm', () => {
    expect(availableQuantity(0, 0)).toBe(0);
    expect(availableQuantity(2, 5)).toBe(0);
  });
});

describe('ProductsService', () => {
  const findMany = jest.fn();
  const findFirst = jest.fn();
  const prisma = { product: { findMany, findFirst } } as unknown as PrismaService;
  const service = new ProductsService(prisma);

  beforeEach(() => jest.resetAllMocks());

  describe('findAll', () => {
    it('chỉ lấy món đang kinh doanh, sắp theo tên tăng dần (FR-01)', async () => {
      findMany.mockResolvedValue([]);
      await service.findAll();
      expect(findMany).toHaveBeenCalledWith({ where: { isActive: true }, orderBy: { name: 'asc' } });
    });

    it('trả giá kiểu number và availableQuantity; không trả cột nội bộ', async () => {
      findMany.mockResolvedValue([
        {
          id: 'p1', name: 'Trà đào', description: 'mô tả', basePrice: D(35000), imageUrl: null,
          isActive: true, stockQuantity: 5, reservedQuantity: 5,
        },
      ]);
      const result = await service.findAll();
      expect(result).toEqual([
        { id: 'p1', name: 'Trà đào', basePrice: 35000, imageUrl: null, availableQuantity: 0 },
      ]);
      expect(typeof result[0].basePrice).toBe('number');
    });

    it('sắp tên theo thứ tự tiếng Việt: "Trà đào" trước "Trà sữa"', async () => {
      const row = (id: string, name: string) => ({
        id, name, description: '', basePrice: D(1000), imageUrl: null,
        isActive: true, stockQuantity: 1, reservedQuantity: 0,
      });
      findMany.mockResolvedValue([row('1', 'Trà sữa'), row('2', 'Trà đào'), row('3', 'Bạc xỉu')]);
      const result = await service.findAll();
      expect(result.map((p) => p.name)).toEqual(['Bạc xỉu', 'Trà đào', 'Trà sữa']);
    });

    it('menu trống trả mảng rỗng', async () => {
      findMany.mockResolvedValue([]);
      await expect(service.findAll()).resolves.toEqual([]);
    });
  });

  describe('findOne', () => {
    it('trả chi tiết kèm size và topping (FR-02)', async () => {
      findFirst.mockResolvedValue({
        id: 'p1', name: 'Cà phê sữa', description: 'Phin', basePrice: D(29000), imageUrl: 'a.jpg',
        isActive: true, stockQuantity: 10, reservedQuantity: 2,
        sizes: [{ size: { id: 's1', name: 'M', extraPrice: D(5000) } }],
        toppings: [{ topping: { id: 't1', name: 'Trân châu', price: D(7000), isActive: true } }],
      });
      await expect(service.findOne('p1')).resolves.toEqual({
        id: 'p1', name: 'Cà phê sữa', description: 'Phin', basePrice: 29000, imageUrl: 'a.jpg',
        availableQuantity: 8,
        sizes: [{ id: 's1', name: 'M', extraPrice: 5000 }],
        toppings: [{ id: 't1', name: 'Trân châu', price: 7000 }],
      });
    });

    it('chỉ tìm món đang kinh doanh và topping đang bán', async () => {
      findFirst.mockResolvedValue(null);
      await expect(service.findOne('p1')).rejects.toThrow(NotFoundException);
      const args = findFirst.mock.calls[0][0];
      expect(args.where).toEqual({ id: 'p1', isActive: true });
      expect(args.include.toppings.where).toEqual({ topping: { isActive: true } });
    });

    it('không có món thì báo 404 "Không tìm thấy sản phẩm"', async () => {
      findFirst.mockResolvedValue(null);
      await expect(service.findOne('khong-co')).rejects.toThrow('Không tìm thấy sản phẩm');
    });
  });
});
