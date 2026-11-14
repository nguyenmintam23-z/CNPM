/**
 * Kiểm thử HTTP cho đăng ký, đăng nhập, đăng xuất, /auth/me và /health (đề 7.1, 7.2; FR-20, FR-21, NFR-02, NFR-07).
 * Database thay bằng bộ nhớ để chạy trong CI không cần PostgreSQL; integration test với PostgreSQL thật do Đại phụ trách.
 */
process.env.JWT_SECRET ??= 'khoa-kiem-thu-e2e-du-dai';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Prisma, User, UserRole } from '@prisma/client';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { AUTH_COOKIE } from '../src/auth/auth.types';
import { PrismaService } from '../src/prisma/prisma.service';
import { setupApp } from '../src/setup-app';

const users: User[] = [];
let dbSong = true;

/** Giả lập phần Prisma mà UsersService và HealthController dùng; email UNIQUE như migration. */
const fakePrisma = {
  user: {
    findUnique: async ({ where }: { where: { id?: string; email?: string } }) =>
      users.find((u) => (where.id ? u.id === where.id : u.email === where.email)) ?? null,
    create: async ({ data }: { data: Omit<User, 'id' | 'createdAt'> }) => {
      if (users.some((u) => u.email === data.email)) {
        throw new Prisma.PrismaClientKnownRequestError('Unique constraint', { code: 'P2002', clientVersion: 'test' });
      }
      const u: User = { id: `00000000-0000-4000-8000-${String(users.length + 1).padStart(12, '0')}`, createdAt: new Date(), ...data };
      users.push(u);
      return u;
    },
  },
  product: { findMany: async () => [], findFirst: async () => null },
  $queryRaw: async () => {
    if (!dbSong) throw new Error('connect ECONNREFUSED');
    return [{ ok: 1 }];
  },
  $connect: async () => undefined,
  $disconnect: async () => undefined,
};

/** Lấy giá trị cookie phiên từ Set-Cookie. */
function sessionCookie(res: request.Response): string | undefined {
  const raw = res.headers['set-cookie'] as unknown as string[] | undefined;
  return raw?.find((c) => c.startsWith(`${AUTH_COOKIE}=`));
}

describe('Auth + Health API (e2e)', () => {
  let app: INestApplication<App>;
  const http = () => request(app.getHttpServer());
  const khach = { email: 'Khach@BrewLite.test', password: 'matkhau123', fullName: 'Khách Thử' };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(fakePrisma)
      .compile();
    app = moduleRef.createNestApplication();
    setupApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /auth/register (FR-20)', () => {
    it('201, vai trò CUSTOMER, email chuẩn hóa, không trả mật khẩu', async () => {
      const res = await http().post('/auth/register').send(khach).expect(201);
      expect(res.body).toEqual({
        user: { id: expect.any(String), email: 'khach@brewlite.test', fullName: 'Khách Thử' },
        role: 'CUSTOMER',
      });
      expect(users[0].passwordHash).not.toContain('matkhau123');
      expect(sessionCookie(res)).toBeUndefined();
    });

    it('email đã tồn tại (khác hoa thường) → 409', async () => {
      const res = await http().post('/auth/register').send({ ...khach, email: 'KHACH@brewlite.test' }).expect(409);
      expect(res.body.message).toBe('Email đã được đăng ký');
    });

    it('thiếu trường, email sai, mật khẩu ngắn → 400 kèm thông báo', async () => {
      const res = await http().post('/auth/register').send({ email: 'abc', password: '123' }).expect(400);
      expect(res.body.message).toEqual(expect.arrayContaining(['Email không hợp lệ', 'Mật khẩu tối thiểu 8 ký tự']));
    });

    it('không cho tự đặt vai trò khi đăng ký (trường lạ → 400)', async () => {
      await http().post('/auth/register').send({ ...khach, email: 'x@y.vn', role: UserRole.MANAGER }).expect(400);
    });
  });

  describe('POST /auth/login, GET /auth/me, POST /auth/logout (FR-21, NFR-02)', () => {
    it('sai mật khẩu → 401, không đặt cookie', async () => {
      const res = await http().post('/auth/login').send({ email: khach.email, password: 'saimatkhau' }).expect(401);
      expect(res.body.message).toBe('Email hoặc mật khẩu không đúng');
      expect(sessionCookie(res)).toBeUndefined();
    });

    it('đăng nhập → cookie HttpOnly; Secure; SameSite=Lax; 30 phút; body không có JWT; /me dùng được; đăng xuất thì token cũ bị 401', async () => {
      const login = await http().post('/auth/login').send({ email: khach.email, password: khach.password }).expect(200);
      const c = sessionCookie(login)!;
      expect(c).toMatch(/HttpOnly/);
      expect(c).toMatch(/Secure/);
      expect(c).toMatch(/SameSite=Lax/);
      expect(c).toMatch(/Path=\//);
      expect(c).toMatch(/Max-Age=1800/);
      expect(login.body).toEqual({ user: expect.objectContaining({ email: 'khach@brewlite.test' }), role: 'CUSTOMER' });
      expect(JSON.stringify(login.body)).not.toMatch(/eyJ/); // không có JWT trong body

      const cookie = c.split(';')[0];
      const me = await http().get('/auth/me').set('Cookie', cookie).expect(200);
      expect(me.body.role).toBe('CUSTOMER');
      await http().get('/products').set('Cookie', cookie).expect(200);

      const out = await http().post('/auth/logout').set('Cookie', cookie).expect(204);
      expect(sessionCookie(out)).toMatch(/Expires=Thu, 01 Jan 1970/);
      await http().get('/auth/me').set('Cookie', cookie).expect(401);
      await http().get('/products').set('Cookie', cookie).expect(401);
    });

    it('chưa đăng nhập: /auth/me → 401; đăng xuất không có cookie vẫn 204', async () => {
      await http().get('/auth/me').expect(401);
      await http().post('/auth/logout').expect(204);
    });

    it('cookie giả mạo → 401', async () => {
      await http().get('/auth/me').set('Cookie', `${AUTH_COOKIE}=eyJhbGciOiJIUzI1NiJ9.e30.sai`).expect(401);
    });
  });

  describe('GET /health (đề 7.2, NFR-07)', () => {
    it('không cần đăng nhập; database sống → 200', async () => {
      dbSong = true;
      await http().get('/health').expect(200, { status: 'ok' });
    });

    it('database lỗi → 503 { status: "error" }', async () => {
      dbSong = false;
      await http().get('/health').expect(503, { status: 'error' });
      dbSong = true;
    });
  });
});
