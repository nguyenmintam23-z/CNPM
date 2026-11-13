import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { AUTH_COOKIE, AuthRequest, JwtPayload } from './auth.types';
import { IS_PUBLIC } from './public.decorator';
import { TokenRevocationService } from './token-revocation.service';

export const MSG_CHUA_DANG_NHAP = 'Chưa đăng nhập hoặc phiên đã hết hạn';

/**
 * Guard toàn cục: đọc JWT từ cookie HttpOnly, kiểm tra chữ ký, hạn và danh sách thu hồi.
 * Thiếu hoặc sai JWT → 401 (FR-12, NFR-02). Endpoint có @Public() thì bỏ qua.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly revocation: TokenRevocationService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [ctx.getHandler(), ctx.getClass()]);
    if (isPublic) return true;

    const req = ctx.switchToHttp().getRequest<AuthRequest>();
    const token: unknown = req.cookies?.[AUTH_COOKIE];
    if (typeof token !== 'string' || !token) throw new UnauthorizedException(MSG_CHUA_DANG_NHAP);

    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(token);
    } catch {
      throw new UnauthorizedException(MSG_CHUA_DANG_NHAP);
    }
    if (!payload.jti || this.revocation.isRevoked(payload.jti)) {
      throw new UnauthorizedException(MSG_CHUA_DANG_NHAP);
    }
    req.user = { id: payload.sub, role: payload.role, jti: payload.jti, exp: payload.exp };
    return true;
  }
}
