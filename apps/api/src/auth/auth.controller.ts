import { Body, Controller, Get, HttpCode, Post, Req, Res } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CookieOptions, Request, Response } from 'express';
import { PublicUser } from '../users/users.service';
import { AuthService } from './auth.service';
import { AUTH_COOKIE, AuthRequest, JWT_TTL_SECONDS } from './auth.types';
import { CurrentUser } from './current-user.decorator';
import { LoginDto, RegisterDto } from './dto/auth.dto';
import { Public } from './public.decorator';

/**
 * Cookie JWT theo ADR-001 và backend-data-design §3: HttpOnly; Secure; SameSite=Lax; Path=/; 30 phút.
 * COOKIE_SECURE=false chỉ dùng khi chạy local qua HTTP mà trình duyệt không coi là an toàn.
 */
export function cookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: process.env.COOKIE_SECURE !== 'false',
    sameSite: 'lax',
    path: '/',
  };
}

type SessionBody = { user: PublicUser; role: UserRole };

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /** FR-20. 201 khi tạo được tài khoản; 400 dữ liệu sai; 409 email đã tồn tại. Không tự đăng nhập. */
  @Public()
  @Post('register')
  register(@Body() dto: RegisterDto): Promise<SessionBody> {
    return this.auth.register(dto);
  }

  /** FR-21. 200 + Set-Cookie; body chỉ có user và role, không có JWT. 401 khi sai thông tin. */
  @Public()
  @Post('login')
  @HttpCode(200)
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response): Promise<SessionBody> {
    const { token, user, role } = await this.auth.login(dto);
    res.cookie(AUTH_COOKIE, token, { ...cookieOptions(), maxAge: JWT_TTL_SECONDS * 1000 });
    return { user, role };
  }

  /** FR-21. Luôn xóa cookie và trả 204; nếu token còn hạn thì thu hồi jti. */
  @Public()
  @Post('logout')
  @HttpCode(204)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    const token: unknown = req.cookies?.[AUTH_COOKIE];
    await this.auth.logout(typeof token === 'string' ? token : undefined);
    res.clearCookie(AUTH_COOKIE, cookieOptions());
  }

  /** Người dùng và vai trò hiện tại (frontend-architecture §7). Chưa đăng nhập → 401. */
  @Get('me')
  me(@CurrentUser() user: NonNullable<AuthRequest['user']>): Promise<SessionBody> {
    return this.auth.me(user.id);
  }
}
