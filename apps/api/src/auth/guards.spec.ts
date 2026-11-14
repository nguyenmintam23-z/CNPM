import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '@prisma/client';
import { AUTH_COOKIE, AuthRequest } from './auth.types';
import { JwtAuthGuard } from './jwt-auth.guard';
import { IS_PUBLIC } from './public.decorator';
import { ROLES } from './roles.decorator';
import { RolesGuard } from './roles.guard';
import { TokenRevocationService } from './token-revocation.service';

const jwt = new JwtService({ secret: 'khoa-kiem-thu-du-dai-16' });

function ctx(req: Partial<AuthRequest>, meta: Record<string, unknown> = {}): { c: ExecutionContext; r: Reflector } {
  const handler = () => undefined;
  const r = new Reflector();
  jest.spyOn(r, 'getAllAndOverride').mockImplementation((key) => meta[key as string]);
  const c = {
    getHandler: () => handler,
    getClass: () => Object,
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
  return { c, r };
}

describe('JwtAuthGuard (FR-12, NFR-02)', () => {
  const revocation = new TokenRevocationService();
  const token = (over: object = {}, opt: object = {}) =>
    jwt.signAsync({ sub: 'u1', role: 'CUSTOMER', ...over }, { jwtid: 'jti-1', expiresIn: 1800, ...opt });

  it('endpoint @Public() không cần cookie', async () => {
    const { c, r } = ctx({ cookies: {} }, { [IS_PUBLIC]: true });
    await expect(new JwtAuthGuard(r, jwt, revocation).canActivate(c)).resolves.toBe(true);
  });

  it('thiếu cookie → 401', async () => {
    const { c, r } = ctx({ cookies: {} });
    await expect(new JwtAuthGuard(r, jwt, revocation).canActivate(c)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('token hết hạn hoặc sai chữ ký → 401', async () => {
    const het = await token({}, { expiresIn: -10 });
    const sai = await new JwtService({ secret: 'khoa-khac-hoan-toan-16' }).signAsync({ sub: 'u1' }, { jwtid: 'x' });
    for (const t of [het, sai]) {
      const { c, r } = ctx({ cookies: { [AUTH_COOKIE]: t } });
      await expect(new JwtAuthGuard(r, jwt, revocation).canActivate(c)).rejects.toBeInstanceOf(UnauthorizedException);
    }
  });

  it('token hợp lệ gắn user vào request; token đã thu hồi → 401', async () => {
    const t = await token();
    const req: Partial<AuthRequest> = { cookies: { [AUTH_COOKIE]: t } };
    const { c, r } = ctx(req);
    const guard = new JwtAuthGuard(r, jwt, revocation);
    await expect(guard.canActivate(c)).resolves.toBe(true);
    expect(req.user).toMatchObject({ id: 'u1', role: 'CUSTOMER', jti: 'jti-1' });

    revocation.revoke('jti-1', Math.floor(Date.now() / 1000) + 60);
    await expect(guard.canActivate(c)).rejects.toBeInstanceOf(UnauthorizedException);
  });
});

describe('RolesGuard (NFR-02, FR-17)', () => {
  const user = (role: UserRole) => ({ id: 'u1', role, jti: 'j', exp: 0 });

  it('không khai báo vai trò thì mọi người đã đăng nhập đều qua', () => {
    const { c, r } = ctx({ user: user(UserRole.CUSTOMER) });
    expect(new RolesGuard(r).canActivate(c)).toBe(true);
  });

  it('khách gọi thao tác của nhân viên → 403', () => {
    const { c, r } = ctx({ user: user(UserRole.CUSTOMER) }, { [ROLES]: [UserRole.STAFF] });
    expect(() => new RolesGuard(r).canActivate(c)).toThrow(ForbiddenException);
  });

  it('nhân viên, quản lý đúng vai trò thì qua', () => {
    for (const role of [UserRole.STAFF, UserRole.MANAGER]) {
      const { c, r } = ctx({ user: user(role) }, { [ROLES]: [UserRole.STAFF, UserRole.MANAGER] });
      expect(new RolesGuard(r).canActivate(c)).toBe(true);
    }
  });
});

describe('TokenRevocationService', () => {
  it('jti hết hạn thì tự bỏ khỏi danh sách', () => {
    const s = new TokenRevocationService();
    s.revoke('cu', Math.floor(Date.now() / 1000) - 1);
    s.revoke('moi', Math.floor(Date.now() / 1000) + 60);
    expect(s.isRevoked('cu')).toBe(false);
    expect(s.isRevoked('moi')).toBe(true);
  });
});
