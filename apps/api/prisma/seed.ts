/**
 * Seed dữ liệu mẫu cho BrewLite (Sprint 1: món, size, topping, tồn kho ban đầu).
 *
 * - Chạy riêng bằng `npm run db:seed`, KHÔNG chạy trong lệnh start hay mỗi lần deploy
 *   (backend-data-design §6).
 * - Dùng id cố định và `upsert`: chạy lại không tạo trùng và không ghi đè tồn kho đã có trong database.
 *   Riêng món: chạy lại thì cập nhật `imageUrl` để database đã seed trước đó nhận ảnh mới.
 * - Task 5: thêm tài khoản nhân viên và quản lý (bảng `users`). Mật khẩu chỉ lưu dạng băm (NFR-03),
 *   lấy từ biến môi trường SEED_STAFF_PASSWORD / SEED_MANAGER_PASSWORD. Ngoài production có mật khẩu
 *   mặc định để chạy local; ở production bắt buộc đặt biến, không có thì seed dừng.
 * - Khách hàng tự đăng ký (FR-20), không seed.
 *
 * Dữ liệu được chọn để thử các trạng thái trong `api-products.md` §6:
 * món còn hàng, món hết hàng (FR-01), món ngừng bán, món không ảnh, topping ngừng bán.
 */
import { Prisma, PrismaClient, UserRole } from '@prisma/client';
import { hash } from 'bcryptjs'; // PHẢI dùng cùng thư viện băm với AuthModule của Duy, nếu không đăng nhập sẽ lỗi.

const prisma = new PrismaClient();
const BCRYPT_ROUNDS = 10;

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

const USER = {
  STAFF: 'd1b2c3d4-0000-4000-8000-000000000001',
  MANAGER: 'd1b2c3d4-0000-4000-8000-000000000002',
};

function seedPassword(envName: string, devDefault: string): string {
  const value = process.env[envName];
  if (value) return value;
  if (process.env.NODE_ENV === 'production') {
    throw new Error(`Thiếu biến môi trường ${envName} khi seed ở production.`);
  }
  return devDefault;
}

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
    imageUrl: '/images/products/ca-phe-sua.jpg',
    stockQuantity: 50,
    sizeIds: [SIZE.S, SIZE.M, SIZE.L],
    toppingIds: [TOPPING.KEM_CHEESE],
  },
  {
    id: 'c1b2c3d4-0000-4000-8000-000000000002',
    name: 'Trà sữa trân châu',
    description: 'Trà đen pha sữa, kèm trân châu đường đen',
    basePrice: 35000,
    imageUrl: '/images/products/tra-sua-tran-chau.jpg',
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
    imageUrl: '/images/products/tra-dao-cam-sa.jpg',
    stockQuantity: 0,
    sizeIds: [SIZE.M, SIZE.L],
    toppingIds: [TOPPING.THACH_DUA],
  },
  {
    id: 'c1b2c3d4-0000-4000-8000-000000000004',
    name: 'Bạc xỉu',
    description: 'Sữa nóng thêm một chút cà phê',
    basePrice: 32000,
    imageUrl: '/images/products/bac-xiu.jpg',
    stockQuantity: 30,
    sizeIds: [SIZE.S, SIZE.M],
    toppingIds: [],
  },
  {
    // Món không có size, topping và không có ảnh: sizes = [], toppings = [], imageUrl = null (FR-01 "ảnh nếu có").
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

async function seedUsers(): Promise<number> {
  const users = [
    {
      id: USER.STAFF,
      email: 'staff@brewlite.local',
      fullName: 'Nhân viên quầy',
      role: UserRole.STAFF,
      password: seedPassword('SEED_STAFF_PASSWORD', 'Staff@12345'),
    },
    {
      id: USER.MANAGER,
      email: 'manager@brewlite.local',
      fullName: 'Quản lý cửa hàng',
      role: UserRole.MANAGER,
      password: seedPassword('SEED_MANAGER_PASSWORD', 'Manager@12345'),
    },
  ];
  for (const { password, ...user } of users) {
    // update: {} để chạy lại không ghi đè mật khẩu đã đổi.
    await prisma.user.upsert({
      where: { id: user.id },
      update: {},
      create: { ...user, passwordHash: await hash(password, BCRYPT_ROUNDS) },
    });
  }
  return users.length;
}

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
      // Chỉ cập nhật ảnh khi chạy lại; không đụng tồn kho, giá đã có trong database.
      update: { imageUrl: product.imageUrl },
      create: {
        ...product,
        sizes: { create: sizeIds.map((sizeId) => ({ size: { connect: { id: sizeId } } })) },
        toppings: { create: toppingIds.map((toppingId) => ({ topping: { connect: { id: toppingId } } })) },
      },
    });
  }
  const userCount = await seedUsers();
  console.log(
    `Seed xong: ${products.length} món, ${sizes.length} size, ${toppings.length} topping, ${userCount} tài khoản nội bộ.`,
  );
}

main()
  .catch((error: unknown) => {
    console.error('Seed lỗi:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

