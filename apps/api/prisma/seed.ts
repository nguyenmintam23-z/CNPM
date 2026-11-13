/**
 * Seed dữ liệu mẫu cho BrewLite (Sprint 1: món, size, topping, tồn kho ban đầu).
 *
 * - Chạy riêng bằng `npm run db:seed`, KHÔNG chạy trong lệnh start hay mỗi lần deploy
 *   (backend-data-design §6).
 * - Dùng id cố định và `upsert` với `update: {}`: chạy lại không tạo trùng
 *   và không ghi đè tồn kho đã có trong database.
 * - Tài khoản nhân viên và quản lý được thêm ở Task 5, khi có bảng `users`.
 *
 * Dữ liệu được chọn để thử các trạng thái trong `api-products.md` §6:
 * món còn hàng, món hết hàng (FR-01), món ngừng bán, món không ảnh, topping ngừng bán.
 */
import { Prisma, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const SIZE = {
  S: 'a1b2c3d4-0000-4000-8000-000000000001',
  M: 'a1b2c3d4-0000-4000-8000-000000000002',
  L: 'a1b2c3d4-0000-4000-8000-000000000003',
};

const TOPPING = {
  TRAN_CHAU: 'b1b2c3d4-0000-4000-8000-000000000001',
  THACH_DUA: 'b1b2c3d4-0000-4000-8000-000000000002',
  KEM_CHEESE: 'b1b2c3d4-0000-4000-8000-000000000003',
  PUDDING_NGUNG_BAN: 'b1b2c3d4-0000-4000-8000-000000000004',
};

const sizes: Prisma.SizeCreateInput[] = [
  { id: SIZE.S, name: 'S', extraPrice: 0 },
  { id: SIZE.M, name: 'M', extraPrice: 5000 },
  { id: SIZE.L, name: 'L', extraPrice: 10000 },
];

const toppings: Prisma.ToppingCreateInput[] = [
  { id: TOPPING.TRAN_CHAU, name: 'Trân châu', price: 7000 },
  { id: TOPPING.THACH_DUA, name: 'Thạch dừa', price: 6000 },
  { id: TOPPING.KEM_CHEESE, name: 'Kem cheese', price: 10000 },
  // Topping ngừng bán: không được hiện trong chi tiết món.
  { id: TOPPING.PUDDING_NGUNG_BAN, name: 'Pudding', price: 8000, isActive: false },
];

type ProductSeed = Omit<Prisma.ProductCreateInput, 'sizes' | 'toppings'> & {
  id: string;
  sizeIds: string[];
  toppingIds: string[];
};

const products: ProductSeed[] = [
  {
    id: 'c1b2c3d4-0000-4000-8000-000000000001',
    name: 'Cà phê sữa',
    description: 'Cà phê phin pha sữa đặc',
    basePrice: 29000,
    imageUrl: 'https://placehold.co/400x400?text=Ca+phe+sua',
    stockQuantity: 50,
    sizeIds: [SIZE.S, SIZE.M, SIZE.L],
    toppingIds: [TOPPING.KEM_CHEESE],
  },
  {
    id: 'c1b2c3d4-0000-4000-8000-000000000002',
    name: 'Trà sữa trân châu',
    description: 'Trà đen pha sữa, kèm trân châu đường đen',
    basePrice: 35000,
    imageUrl: 'https://placehold.co/400x400?text=Tra+sua',
    stockQuantity: 40,
    sizeIds: [SIZE.M, SIZE.L],
    toppingIds: [TOPPING.TRAN_CHAU, TOPPING.THACH_DUA, TOPPING.KEM_CHEESE, TOPPING.PUDDING_NGUNG_BAN],
  },
  {
    // Món hết hàng: vẫn hiện trên menu với availableQuantity = 0 (FR-01).
    id: 'c1b2c3d4-0000-4000-8000-000000000003',
    name: 'Trà đào cam sả',
    description: 'Trà đào, cam tươi và sả',
    basePrice: 39000,
    imageUrl: 'https://placehold.co/400x400?text=Tra+dao',
    stockQuantity: 0,
    sizeIds: [SIZE.M, SIZE.L],
    toppingIds: [TOPPING.THACH_DUA],
  },
  {
    // Món không có ảnh: imageUrl = null.
    id: 'c1b2c3d4-0000-4000-8000-000000000004',
    name: 'Bạc xỉu',
    description: 'Sữa nóng thêm một chút cà phê',
    basePrice: 32000,
    imageUrl: null,
    stockQuantity: 30,
    sizeIds: [SIZE.S, SIZE.M],
    toppingIds: [],
  },
  {
    // Món không có size, topping: sizes = [], toppings = [].
    id: 'c1b2c3d4-0000-4000-8000-000000000005',
    name: 'Nước suối',
    description: 'Chai 500 ml',
    basePrice: 10000,
    imageUrl: null,
    stockQuantity: 100,
    sizeIds: [],
    toppingIds: [],
  },
  {
    // Món ngừng kinh doanh: không có trong danh sách, chi tiết trả 404.
    id: 'c1b2c3d4-0000-4000-8000-000000000006',
    name: 'Sinh tố bơ',
    description: 'Món theo mùa, đã ngừng bán',
    basePrice: 45000,
    imageUrl: null,
    isActive: false,
    stockQuantity: 10,
    sizeIds: [SIZE.M],
    toppingIds: [],
  },
];

async function main(): Promise<void> {
  for (const size of sizes) {
    await prisma.size.upsert({ where: { id: size.id }, update: {}, create: size });
  }
  for (const topping of toppings) {
    await prisma.topping.upsert({ where: { id: topping.id }, update: {}, create: topping });
  }
  for (const { sizeIds, toppingIds, ...product } of products) {
    await prisma.product.upsert({
      where: { id: product.id },
      update: {},
      create: {
        ...product,
        sizes: { create: sizeIds.map((sizeId) => ({ size: { connect: { id: sizeId } } })) },
        toppings: { create: toppingIds.map((toppingId) => ({ topping: { connect: { id: toppingId } } })) },
      },
    });
  }
  console.log(`Seed xong: ${products.length} món, ${sizes.length} size, ${toppings.length} topping.`);
}

main()
  .catch((error: unknown) => {
    console.error('Seed lỗi:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
