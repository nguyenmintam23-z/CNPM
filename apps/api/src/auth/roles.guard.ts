import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { AuthRequest } from './auth.types';
import { ROLES } from './roles.decorator';

/** Sai vai trò → 403 (NFR-02; FR-17: khách gọi thao tác của nhân viên bị từ chối). Chạy sau JwtAuthGuard. */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<UserRole[] | undefined>(ROLES, [ctx.getHandler(), ctx.getClass()]);
    if (!roles?.length) return true;
    const user = ctx.switchToHttp().getRequest<AuthRequest>().user;
    if (user && roles.includes(user.role)) return true;
    throw new ForbiddenException('Không có quyền thực hiện thao tác này');
  }
}
