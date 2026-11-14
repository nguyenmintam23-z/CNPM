import { Logger } from '@nestjs/common';
import { DEFAULT_SLOW_MS, MSG_THAT_BAI, PaymentService, Scenario, scenarioFor } from './payment.service';

/** Tìm một idempotencyKey cho ra kịch bản mong muốn trên đơn cho trước. */
function keyFor(orderId: string, want: Scenario): string {
  for (let i = 0; i < 10000; i++) {
    if (scenarioFor(orderId, `k-${i}`) === want) return `k-${i}`;
  }
  throw new Error(`không tìm được khóa cho ${want}`);
}

describe('PaymentService (FR-07, FR-14, FR-15; backend-operations §2)', () => {
  const orderId = '11111111-1111-4111-8111-111111111111';
  const t0 = new Date('2026-11-14T08:00:00Z');
  const sau = (ms: number) => new Date(t0.getTime() + ms);
  let service: PaymentService;

  beforeAll(() => Logger.overrideLogger(false));
  beforeEach(() => {
    delete process.env.PAYMENT_SIM_SCENARIO;
    delete process.env.PAYMENT_SIM_DELAY_MS;
    service = new PaymentService();
  });

  it('kịch bản cố định theo orderId + idempotencyKey: gọi lại bao nhiêu lần cũng ra cùng kết quả (FR-15, E6)', () => {
    for (let i = 0; i < 50; i++) {
      const req = { orderId, idempotencyKey: `k-${i}`, method: 'WALLET' as const, startedAt: t0 };
      const a = service.process(req, sau(DEFAULT_SLOW_MS + 1));
      const b = new PaymentService().process(req, sau(DEFAULT_SLOW_MS + 1)); // như sau khi API khởi động lại
      expect(b).toEqual(a);
      expect(a.status).not.toBe('PROCESSING');
    }
  });

  it('đủ 4 kịch bản thành công, thất bại, chậm rồi thành công, chậm rồi thất bại', () => {
    const seen = new Set<Scenario>();
    for (let i = 0; i < 2000; i++) seen.add(scenarioFor(orderId, `k-${i}`));
    expect([...seen].sort()).toEqual(['FAILURE', 'SLOW_FAILURE', 'SLOW_SUCCESS', 'SUCCESS']);
  });

  it('khóa mới trên cùng đơn có thể ra kết quả khác (thử lại sau thất bại, FR-14)', () => {
    expect(scenarioFor(orderId, keyFor(orderId, 'FAILURE'))).toBe('FAILURE');
    expect(scenarioFor(orderId, keyFor(orderId, 'SUCCESS'))).toBe('SUCCESS');
  });

  it('thành công ngay → SUCCEEDED', () => {
    const r = service.process({ orderId, idempotencyKey: keyFor(orderId, 'SUCCESS'), method: 'CARD', startedAt: t0 }, t0);
    expect(r).toEqual({ status: 'SUCCEEDED' });
  });

  it('thất bại → FAILED kèm lý do theo phương thức', () => {
    const key = keyFor(orderId, 'FAILURE');
    expect(service.process({ orderId, idempotencyKey: key, method: 'WALLET', startedAt: t0 }, t0))
      .toEqual({ status: 'FAILED', failureReason: MSG_THAT_BAI.WALLET });
    expect(service.process({ orderId, idempotencyKey: key, method: 'CARD', startedAt: t0 }, t0))
      .toEqual({ status: 'FAILED', failureReason: MSG_THAT_BAI.CARD });
  });

  it('phản hồi chậm: PROCESSING trước thời gian chờ, sau đó ra kết quả cuối (E6)', () => {
    const ok = { orderId, idempotencyKey: keyFor(orderId, 'SLOW_SUCCESS'), method: 'WALLET' as const, startedAt: t0 };
    expect(service.process(ok, sau(1000)).status).toBe('PROCESSING');
    expect(service.process(ok, sau(DEFAULT_SLOW_MS)).status).toBe('SUCCEEDED');

    const fail = { ...ok, idempotencyKey: keyFor(orderId, 'SLOW_FAILURE') };
    expect(service.process(fail, sau(DEFAULT_SLOW_MS - 1)).status).toBe('PROCESSING');
    expect(service.process(fail, sau(DEFAULT_SLOW_MS)).status).toBe('FAILED');
  });

  it('PAYMENT_SIM_DELAY_MS chỉnh thời gian chờ', () => {
    process.env.PAYMENT_SIM_DELAY_MS = '0';
    const req = { orderId, idempotencyKey: keyFor(orderId, 'SLOW_SUCCESS'), method: 'WALLET' as const, startedAt: t0 };
    expect(service.process(req, t0).status).toBe('SUCCEEDED');
  });

  it('PAYMENT_SIM_SCENARIO ép kịch bản ở local/E2E, bị bỏ qua ở production', () => {
    const key = keyFor(orderId, 'SUCCESS');
    process.env.PAYMENT_SIM_SCENARIO = 'FAILURE';
    expect(service.process({ orderId, idempotencyKey: key, method: 'CARD', startedAt: t0 }, t0).status).toBe('FAILED');

    const env = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    expect(service.process({ orderId, idempotencyKey: key, method: 'CARD', startedAt: t0 }, t0).status).toBe('SUCCEEDED');
    process.env.NODE_ENV = env;

    process.env.PAYMENT_SIM_SCENARIO = 'GIA_TRI_LA';
    expect(service.scenario(orderId, key)).toBe('SUCCESS');
  });

  it('từ chối phương thức ngoài Ví/Thẻ', () => {
    expect(() => service.process({ orderId, idempotencyKey: 'k', method: 'CASH' as never, startedAt: t0 })).toThrow();
  });
});
