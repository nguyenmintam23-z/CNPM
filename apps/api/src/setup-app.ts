import { INestApplication, ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';

/**
 * Cấu hình dùng chung cho main.ts và kiểm thử e2e, để test chạy đúng như production.
 * - cookie-parser: guard đọc JWT từ cookie HttpOnly (ADR-001).
 * - ValidationPipe: kiểm tra dữ liệu phía backend (đề 7.1, NFR-04); bỏ và từ chối trường lạ.
 */
export function setupApp(app: INestApplication): void {
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
}
