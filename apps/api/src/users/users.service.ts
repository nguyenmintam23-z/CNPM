import { Injectable } from '@nestjs/common';
import { User, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/** Thông tin người dùng trả ra ngoài: không bao giờ có passwordHash (NFR-03). */
export interface PublicUser {
  id: string;
  email: string;
  fullName: string;
}

export function toPublicUser(u: Pick<User, 'id' | 'email' | 'fullName'>): PublicUser {
  return { id: u.id, email: u.email, fullName: u.fullName };
}

/** Email so sánh không phân biệt hoa thường, bỏ khoảng trắng hai đầu (FR-20: từ chối email đã tồn tại). */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** UsersModule: tài khoản và vai trò CUSTOMER / STAFF / MANAGER (backend-data-design §3). */
@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email: normalizeEmail(email) } });
  }

  findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  /** Đăng ký luôn tạo khách hàng; tài khoản nhân viên, quản lý do seed hoặc quản trị tạo. */
  create(data: { email: string; passwordHash: string; fullName: string }): Promise<User> {
    return this.prisma.user.create({
      data: {
        email: normalizeEmail(data.email),
        passwordHash: data.passwordHash,
        fullName: data.fullName.trim(),
        role: UserRole.CUSTOMER,
      },
    });
  }
}
