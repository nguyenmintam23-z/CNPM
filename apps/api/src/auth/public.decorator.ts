import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC = 'isPublic';

/**
 * Đánh dấu endpoint không cần đăng nhập. Mặc định mọi endpoint đều cần JWT (guard toàn cục),
 * nên chỉ đăng ký, đăng nhập, đăng xuất và /health được mở (FR-01: chưa đăng nhập không xem menu).
 */
export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(IS_PUBLIC, true);
