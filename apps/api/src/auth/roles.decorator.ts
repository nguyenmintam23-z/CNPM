import { SetMetadata } from '@nestjs/common';
import { UserRole } from '@prisma/client';

export const ROLES = 'roles';

/** Giới hạn endpoint cho các vai trò (NFR-02, FR-17). Không ghi thì mọi vai trò đã đăng nhập đều được. */
export const Roles = (...roles: UserRole[]): MethodDecorator & ClassDecorator => SetMetadata(ROLES, roles);
