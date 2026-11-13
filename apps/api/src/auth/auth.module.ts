import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';
import { TokenRevocationService } from './token-revocation.service';

/** JWT_SECRET cấp riêng cho API qua biến môi trường (backend-operations §5); thiếu thì không khởi động. */
export function jwtSecret(): string {
  const s = process.env.JWT_SECRET;
  if (!s || s.length < 16) {
    throw new Error('Thiếu JWT_SECRET (tối thiểu 16 ký tự). Xem .env.example ở gốc repo.');
  }
  return s;
}

/**
 * AuthModule (backend-data-design §3): đăng ký, đăng nhập, đăng xuất, JWT trong cookie HttpOnly,
 * guard toàn cục kiểm tra JWT (401) rồi vai trò (403) trên mọi API không đánh dấu @Public().
 */
@Module({
  imports: [
    UsersModule,
    JwtModule.registerAsync({
      useFactory: () => ({ secret: jwtSecret(), signOptions: { algorithm: 'HS256' } }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    TokenRevocationService,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AuthModule {}
