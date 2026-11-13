import { ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { HealthController } from './health.controller';

describe('HealthController (NFR-07, ADR-003)', () => {
  it('PostgreSQL trả lời → { status: "ok" }', async () => {
    const prisma = { $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]) } as unknown as PrismaService;
    await expect(new HealthController(prisma).check()).resolves.toEqual({ status: 'ok' });
  });

  it('PostgreSQL lỗi → 503, không lộ chi tiết lỗi', async () => {
    const prisma = { $queryRaw: jest.fn().mockRejectedValue(new Error('password authentication failed')) } as unknown as PrismaService;
    const err = await new HealthController(prisma).check().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ServiceUnavailableException);
    expect((err as ServiceUnavailableException).getResponse()).toEqual({ status: 'error' });
  });

  it('PostgreSQL treo quá thời gian chờ → 503', async () => {
    jest.useFakeTimers();
    const prisma = { $queryRaw: jest.fn(() => new Promise(() => undefined)) } as unknown as PrismaService;
    const p = new HealthController(prisma).check().catch((e: unknown) => e);
    await jest.advanceTimersByTimeAsync(2100);
    expect(await p).toBeInstanceOf(ServiceUnavailableException);
    jest.useRealTimers();
  });
});
