import { ConsoleLogger, Logger, LogLevel } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { setupApp } from './setup-app';

const MUC_LOG: LogLevel[] = ['fatal', 'error', 'warn', 'log', 'debug', 'verbose'];

/** LOG_LEVEL=info|warn|error|debug (backend-operations §5); info tương ứng mức 'log' của NestJS. */
function logLevels(): LogLevel[] {
  const muc = (process.env.LOG_LEVEL ?? 'info').toLowerCase().replace('info', 'log') as LogLevel;
  const i = MUC_LOG.indexOf(muc);
  return MUC_LOG.slice(0, i < 0 ? 4 : i + 1);
}

async function bootstrap(): Promise<void> {
  // Log JSON ra stdout/stderr để xem trên Render (NFR-07, backend-operations §3).
  const app = await NestFactory.create(AppModule, {
    logger: new ConsoleLogger({ json: true, logLevels: logLevels() }),
  });
  setupApp(app);
  // Đường dẫn backend không có tiền tố /api; tiền tố /api thuộc Next.js proxy (frontend-architecture §7.1).
  // Không bật CORS: trình duyệt chỉ gọi BrewLite Web cùng origin (ADR-001).
  app.enableShutdownHooks();
  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port);
  Logger.log(`BrewLite API đang chạy ở cổng ${port}`, 'Bootstrap');
}

void bootstrap();
