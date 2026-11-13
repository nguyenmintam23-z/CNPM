import { UserRole } from '@prisma/client';
import { Request } from 'express';

/** Tên cookie chứa JWT (ADR-001). Trình duyệt chỉ thấy cookie này qua proxy /api/* của BrewLite Web. */
export const AUTH_COOKIE = 'brewlite_session';

/** JWT sống 30 phút, không refresh token (backend-data-design §3). */
export const JWT_TTL_SECONDS = 30 * 60;

export interface JwtPayload {
  sub: string;
  role: UserRole;
  jti: string;
  exp: number;
}

/** Người dùng đã xác thực, guard gắn vào request. */
export interface AuthUser {
  id: string;
  role: UserRole;
  jti: string;
  exp: number;
}

export type AuthRequest = Request & { user?: AuthUser };
