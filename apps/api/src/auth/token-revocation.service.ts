import { Injectable } from '@nestjs/common';

/**
 * Danh sách jti đã thu hồi khi đăng xuất, giữ đến lúc token hết hạn (FR-21; backend-data-design §3).
 * Lưu trong bộ nhớ, không thêm bảng ngoài Class Domain. Đánh đổi đã chốt ở Task 3: API khởi động lại
 * thì danh sách mất, token cũ dùng lại được tối đa 30 phút; MVP chạy một instance.
 */
@Injectable()
export class TokenRevocationService {
  private readonly revoked = new Map<string, number>();

  /** exp: thời điểm hết hạn của token (giây, theo claim exp). */
  revoke(jti: string, exp: number): void {
    this.prune();
    this.revoked.set(jti, exp);
  }

  isRevoked(jti: string): boolean {
    const exp = this.revoked.get(jti);
    if (exp === undefined) return false;
    if (exp * 1000 <= Date.now()) {
      this.revoked.delete(jti);
      return false; // token đã hết hạn thì guard tự từ chối, không cần giữ nữa
    }
    return true;
  }

  /** Bỏ các jti đã hết hạn để danh sách không phình mãi. */
  private prune(): void {
    const now = Date.now();
    for (const [jti, exp] of this.revoked) {
      if (exp * 1000 <= now) this.revoked.delete(jti);
    }
  }
}
