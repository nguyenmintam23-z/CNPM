import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';

/** Phương thức thanh toán mô phỏng (Class Domain: PaymentMethod). Không thu thập thông tin thẻ thật. */
export type PaymentMethod = 'WALLET' | 'CARD';
export const PAYMENT_METHODS: readonly PaymentMethod[] = ['WALLET', 'CARD'];

/** Kết quả bộ mô phỏng: PROCESSING khi chưa có kết quả cuối (Class Domain: PaymentStatus). */
export type SimulatedStatus = 'SUCCEEDED' | 'FAILED' | 'PROCESSING';

/** Kịch bản kiểm thử (backend-operations §2): thành công, thất bại, phản hồi chậm rồi mới có kết quả. */
export type Scenario = 'SUCCESS' | 'FAILURE' | 'SLOW_SUCCESS' | 'SLOW_FAILURE';
const SCENARIOS: readonly Scenario[] = ['SUCCESS', 'FAILURE', 'SLOW_SUCCESS', 'SLOW_FAILURE'];

export interface SimulationRequest {
  orderId: string;
  idempotencyKey: string;
  method: PaymentMethod;
  /** Thời điểm tạo Payment PROCESSING (payments.created_at); dùng cho kịch bản phản hồi chậm. */
  startedAt: Date;
}

export interface SimulationResult {
  status: SimulatedStatus;
  /** Lý do thất bại hiển thị cho khách (FR-14). */
  failureReason?: string;
}

/** Thời gian "phản hồi chậm" mặc định trước khi có kết quả cuối (E6). */
export const DEFAULT_SLOW_MS = 5000;
export const MSG_THAT_BAI: Record<PaymentMethod, string> = {
  WALLET: 'Ví mô phỏng từ chối giao dịch. Vui lòng thử lại.',
  CARD: 'Thẻ mô phỏng bị từ chối. Vui lòng thử lại.',
};

/**
 * Chọn kịch bản bằng quy tắc băm cố định từ orderId và idempotencyKey (backend-operations §2).
 * Cùng đầu vào luôn ra cùng kịch bản, kể cả sau khi API khởi động lại, nên không cần lưu thêm bảng.
 * Tỉ lệ trên 100: 70 thành công, 20 thất bại, 5 chậm rồi thành công, 5 chậm rồi thất bại.
 */
export function scenarioFor(orderId: string, idempotencyKey: string): Scenario {
  const n = createHash('sha256').update(`${orderId}:${idempotencyKey}`).digest().readUInt32BE(0) % 100;
  if (n < 70) return 'SUCCESS';
  if (n < 90) return 'FAILURE';
  if (n < 95) return 'SLOW_SUCCESS';
  return 'SLOW_FAILURE';
}

/**
 * PaymentService: bộ mô phỏng Ví/Thẻ trong PaymentModule, gọi nội bộ cùng tiến trình API (ADR-003).
 *
 * - Không lưu trạng thái: kết quả tính lại từ đầu vào, nên "gửi lại hoặc tra cứu cùng khóa" (FR-15, E6)
 *   luôn ra cùng kết quả. Việc ghi Payment, Order, tồn kho thuộc luồng checkout (OrdersModule/PaymentModule),
 *   trong transaction, chỉ khi Payment còn PROCESSING (backend-data-design §5).
 * - Kịch bản không nhận từ client. Biến môi trường PAYMENT_SIM_SCENARIO chỉ dùng ở local/kiểm thử E2E
 *   để ép một kịch bản; production để trống. [Đề xuất]
 */
@Injectable()
export class PaymentService {
  private readonly logger = new Logger('PaymentService');

  /** Kịch bản sẽ dùng cho cặp (orderId, idempotencyKey), có tính biến môi trường ép kịch bản. */
  scenario(orderId: string, idempotencyKey: string): Scenario {
    const forced = process.env.PAYMENT_SIM_SCENARIO as Scenario | undefined;
    if (forced && SCENARIOS.includes(forced) && process.env.NODE_ENV !== 'production') return forced;
    return scenarioFor(orderId, idempotencyKey);
  }

  /** Thời gian phản hồi chậm (ms), chỉnh bằng PAYMENT_SIM_DELAY_MS. */
  slowMs(): number {
    const v = Number(process.env.PAYMENT_SIM_DELAY_MS);
    return Number.isFinite(v) && v >= 0 ? v : DEFAULT_SLOW_MS;
  }

  /**
   * Gửi hoặc tra cứu lần thanh toán. Gọi nhiều lần với cùng đầu vào cho cùng kết quả cuối;
   * kịch bản chậm trả PROCESSING cho tới khi qua thời gian chờ tính từ startedAt.
   */
  process(req: SimulationRequest, now: Date = new Date()): SimulationResult {
    if (!PAYMENT_METHODS.includes(req.method)) {
      throw new Error(`Phương thức thanh toán không hợp lệ: ${String(req.method)}`);
    }
    const sc = this.scenario(req.orderId, req.idempotencyKey);
    const cham = sc === 'SLOW_SUCCESS' || sc === 'SLOW_FAILURE';
    if (cham && now.getTime() - req.startedAt.getTime() < this.slowMs()) {
      // Không ghi khóa thanh toán nguyên văn vào log (backend-operations §3).
      this.logger.warn({ event: 'payment_result_pending', orderId: req.orderId, paymentStatus: 'PROCESSING' });
      return { status: 'PROCESSING' };
    }
    if (sc === 'SUCCESS' || sc === 'SLOW_SUCCESS') return { status: 'SUCCEEDED' };
    return { status: 'FAILED', failureReason: MSG_THAT_BAI[req.method] };
  }
}
