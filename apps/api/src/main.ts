import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  // Đường dẫn backend không có tiền tố /api; tiền tố /api thuộc Next.js proxy (frontend-architecture §7.1).
  // Không bật CORS: trình duyệt chỉ gọi BrewLite Web cùng origin (ADR-001).
  app.enableShutdownHooks();
  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port);
  Logger.log(`BrewLite API đang chạy ở cổng ${port}`, 'Bootstrap');
}

void bootstrap();
