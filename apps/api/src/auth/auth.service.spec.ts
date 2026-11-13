import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma, User, UserRole } from '@prisma/client';
import { hashSync } from 'bcryptjs';
import { UsersService } from '../users/users.service';
import { AuthService, MSG_EMAIL_TRUNG, MSG_SAI_DANG_NHAP } from './auth.service';
import { TokenRevocationService } from './token-revocation.service';

const SECRET = 'khoa-kiem-thu-du-dai-16';
const user = (over: Partial<User> = {}): User => ({
  id: 'u1', email: 'khach@brewlite.test', passwordHash: hashSync('matkhau123', 4),
  fullName: 'Khách Thử', role: UserRole.CUSTOMER, createdAt: new Date(0), ...over,
});

describe('AuthService', () => {
  const findByEmail = jest.fn();
  const findById = jest.fn();
  const create = jest.fn();
  const users = { findByEmail, findById, create } as unknown as UsersService;
  const jwt = new JwtService({ secret: SECRET });
  let revocation: TokenRevocationService;
  let service: AuthService;

  beforeEach(() => {
    jest.resetAllMocks();
    revocation = new TokenRevocationService();
    service = new AuthService(users, jwt, revocation);
  });

  describe('register (FR-20, NFR-03)', () => {
    it('chỉ lưu mật khẩu đã băm, trả user không có passwordHash, vai trò CUSTOMER', async () => {
      findByEmail.mockResolvedValue(null);
      create.mockImplementation(async (d: { passwordHash: string }) => user({ passwordHash: d.passwordHash }));
      const res = await service.register({ email: 'khach@brewlite.test', password: 'matkhau123', fullName: 'Khách Thử' });

      const luu = create.mock.calls[0][0];
      expect(luu.passwordHash).not.toBe('matkhau123');
      expect(luu.passwordHash).toMatch(/^\$2[aby]\$10\$/);
      expect(res).toEqual({ user: { id: 'u1', email: 'khach@brewlite.test', fullName: 'Khách Thử' }, role: 'CUSTOMER' });
      expect(JSON.stringify(res)).not.toContain('passwordHash');
    });

    it('từ chối email đã tồn tại (409)', async () => {
      findByEmail.mockResolvedValue(user());
      await expect(service.register({ email: 'KHACH@brewlite.test', password: 'matkhau123', fullName: 'A' }))
        .rejects.toThrow(new ConflictException(MSG_EMAIL_TRUNG));
      expect(create).not.toHaveBeenCalled();
    });

    it('hai yêu cầu song song cùng email: ràng buộc UNIQUE trả 409', async () => {
      findByEmail.mockResolvedValue(null);
      create.mockRejectedValue(new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: 'x' }));
      await expect(service.register({ email: 'a@b.vn', password: 'matkhau123', fullName: 'A' }))
        .rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('login (FR-21)', () => {
    it('đúng thông tin: JWT có sub, role, jti, hạn 30 phút', async () => {
      findByEmail.mockResolvedValue(user());
      const res = await service.login({ email: 'khach@brewlite.test', password: 'matkhau123' });
      const p = await jwt.verifyAsync(res.token);
      expect(p).toMatchObject({ sub: 'u1', role: 'CUSTOMER' });
      expect(typeof p.jti).toBe('string');
      expect(p.exp - p.iat).toBe(30 * 60);
      expect(res.user).toEqual({ id: 'u1', email: 'khach@brewlite.test', fullName: 'Khách Thử' });
    });

    it('sai mật khẩu và email không tồn tại trả cùng thông báo 401', async () => {
      findByEmail.mockResolvedValue(user());
      await expect(service.login({ email: 'khach@brewlite.test', password: 'saimatkhau' }))
        .rejects.toThrow(new UnauthorizedException(MSG_SAI_DANG_NHAP));
      findByEmail.mockResolvedValue(null);
      await expect(service.login({ email: 'khong@co.vn', password: 'matkhau123' }))
        .rejects.toThrow(new UnauthorizedException(MSG_SAI_DANG_NHAP));
    });

    it('mỗi lần đăng nhập có jti khác nhau', async () => {
      findByEmail.mockResolvedValue(user());
      const a = await service.login({ email: 'khach@brewlite.test', password: 'matkhau123' });
      const b = await service.login({ email: 'khach@brewlite.test', password: 'matkhau123' });
      expect((await jwt.verifyAsync(a.token)).jti).not.toBe((await jwt.verifyAsync(b.token)).jti);
    });
  });

  describe('logout (FR-21)', () => {
    it('thu hồi jti của token còn hạn', async () => {
      findByEmail.mockResolvedValue(user());
      const { token } = await service.login({ email: 'khach@brewlite.test', password: 'matkhau123' });
      const { jti } = await jwt.verifyAsync(token);
      await service.logout(token);
      expect(revocation.isRevoked(jti)).toBe(true);
    });

    it('không có token hoặc token hỏng thì không lỗi', async () => {
      await expect(service.logout(undefined)).resolves.toBeUndefined();
      await expect(service.logout('khong-phai-jwt')).resolves.toBeUndefined();
    });
  });

  describe('me', () => {
    it('đọc vai trò mới nhất từ database', async () => {
      findById.mockResolvedValue(user({ role: UserRole.STAFF }));
      await expect(service.me('u1')).resolves.toMatchObject({ role: 'STAFF' });
    });

    it('tài khoản không còn thì 401', async () => {
      findById.mockResolvedValue(null);
      await expect(service.me('u1')).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });
});
