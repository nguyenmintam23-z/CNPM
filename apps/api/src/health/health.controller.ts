import { Controller, Get, Logger, ServiceUnavailableException } from '@nestjs/common';
import { Public } from '../auth/public.decorator';
import { PrismaService } from '../prisma/prisma.service';

/** Thời gian chờ truy vấn kiểm tra PostgreSQL; quá hạn thì trả 503 (backend-operations §6). */
export const HEALTH_DB_TIMEOUT_MS = 2000;

/**
 * GET /health (đề 7.2, NFR-07, ADR-003, backend-operations §4).
 * 200 khi API sẵn sàng và PostgreSQL trả lời; 503 khi không truy cập được database.
 * Phản hồi chỉ có trạng thái tổng quát, không lộ chi tiết lỗi.
 */
@Controller('health')
export class HealthController {
  private readonly logger = new Logger('Health');

  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  async check(): Promise<{ status: 'ok' }> {
    let timer: NodeJS.Timeout | undefined;
    try {
      await Promise.race([
        this.prisma.$queryRaw`SELECT 1`,
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error('timeout')), HEALTH_DB_TIMEOUT_MS);
        }),
      ]);
      return { status: 'ok' };
    } catch (err) {
      this.logger.error({ event: 'health_db_unavailable', reason: (err as Error).message });
      throw new ServiceUnavailableException({ status: 'error' });
    } finally {
      clearTimeout(timer);
    }
  }
}
