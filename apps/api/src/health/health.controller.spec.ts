import { Logger, ServiceUnavailableException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { dbErrorCode, HealthController } from './health.controller';

describe('HealthController (NFR-07, ADR-003)', () => {
  let logError: jest.SpyInstance;

  beforeEach(() => {
    logError = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  it('PostgreSQL trả lời → { status: "ok" }', async () => {
    const prisma = { $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]) } as unknown as PrismaService;
    await expect(new HealthController(prisma).check()).resolves.toEqual({ status: 'ok' });
    expect(logError).not.toHaveBeenCalled();
  });

  it('PostgreSQL lỗi → 503, phản hồi và log đều không lộ chi tiết kết nối (backend-operations §3)', async () => {
    const loi = new Prisma.PrismaClientInitializationError(
      "Can't reach database server at `db.internal:5432` for user `brewlite_prod`", '6.19.3', 'P1001',
    );
    const prisma = { $queryRaw: jest.fn().mockRejectedValue(loi) } as unknown as PrismaService;
    const err = await new HealthController(prisma).check().catch((e: unknown) => e);

    expect(err).toBeInstanceOf(ServiceUnavailableException);
    expect((err as ServiceUnavailableException).getResponse()).toEqual({ status: 'error' });
    expect(logError).toHaveBeenCalledWith({ event: 'health_db_unavailable', errorCode: 'P1001' });
    expect(JSON.stringify(logError.mock.calls)).not.toMatch(/db\.internal|brewlite_prod|5432/);
  });

  it('PostgreSQL treo quá thời gian chờ → 503, log DB_TIMEOUT', async () => {
    jest.useFakeTimers();
    const prisma = { $queryRaw: jest.fn(() => new Promise(() => undefined)) } as unknown as PrismaService;
    const p = new HealthController(prisma).check().catch((e: unknown) => e);
    await jest.advanceTimersByTimeAsync(2100);
    expect(await p).toBeInstanceOf(ServiceUnavailableException);
    expect(logError).toHaveBeenCalledWith({ event: 'health_db_unavailable', errorCode: 'DB_TIMEOUT' });
    jest.useRealTimers();
  });

  it('dbErrorCode chỉ giữ mã Prisma Pxxxx, còn lại là DB_ERROR', () => {
    expect(dbErrorCode(new Prisma.PrismaClientKnownRequestError('x', { code: 'P2024', clientVersion: 'x' }))).toBe('P2024');
    expect(dbErrorCode(new Error('password authentication failed for user "admin"'))).toBe('DB_ERROR');
    expect(dbErrorCode({ code: 'postgres://user:pass@host/db' })).toBe('DB_ERROR');
    expect(dbErrorCode(null)).toBe('DB_ERROR');
  });
});
