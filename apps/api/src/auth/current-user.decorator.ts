import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthRequest } from './auth.types';

/** Lấy người dùng đã xác thực do JwtAuthGuard gắn vào request. */
export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext) =>
  ctx.switchToHttp().getRequest<AuthRequest>().user,
);
