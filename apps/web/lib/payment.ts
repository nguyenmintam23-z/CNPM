// Thanh toán mô phỏng: không thu thập dữ liệu thẻ hoặc thông tin ví thật.
export type PaymentMethod = "WALLET" | "CARD";
export type PaymentState = "PROCESSING" | "FAILED" | "SUCCEEDED" | "UNKNOWN";

export type SavedPaymentAttempt = {
  method: PaymentMethod;
  idempotencyKey: string;
  state: PaymentState;
  failureReason?: string;
};

export type PaymentResult = {
  payment: {
    id?: string;
    method: PaymentMethod;
    status: "PROCESSING" | "FAILED" | "SUCCEEDED";
    amount: number;
    failureReason?: string;
  };
  order: {
    id: string;
    orderCode?: string;
    status: string;
    stockHoldStatus?: string;
  };
};

export function paymentStorageKey(userId: string, orderId: string): string {
  if (!userId.trim() || !orderId.trim()) {
    throw new Error("Thiếu mã tài khoản hoặc đơn hàng.");
  }
  return `brewlite_payment_v1:${encodeURIComponent(userId)}:${encodeURIComponent(orderId)}`;
}

export function paymentKeyValid(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{8,64}$/.test(value);
}

export function isSavedPaymentAttempt(value: unknown): value is SavedPaymentAttempt {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Partial<SavedPaymentAttempt>;
  return (record.method === "WALLET" || record.method === "CARD") &&
    paymentKeyValid(record.idempotencyKey) &&
    (record.state === "PROCESSING" || record.state === "FAILED" ||
      record.state === "SUCCEEDED" || record.state === "UNKNOWN");
}

export function isPaymentResult(value: unknown): value is PaymentResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const data = value as Partial<PaymentResult>;
  if (!data.payment || !data.order || typeof data.payment !== "object" || typeof data.order !== "object") return false;
  const payment = data.payment;
  const order = data.order;
  return (payment.method === "WALLET" || payment.method === "CARD") &&
    (payment.status === "PROCESSING" || payment.status === "FAILED" || payment.status === "SUCCEEDED") &&
    typeof payment.amount === "number" && Number.isFinite(payment.amount) &&
    typeof order.id === "string" && typeof order.status === "string";
}

export function paymentErrorText(value: unknown, fallback: string): string {
  if (!value || typeof value !== "object" || Array.isArray(value)) return fallback;
  const data = value as { message?: unknown };
  if (typeof data.message === "string" && data.message.trim()) return data.message;
  if (Array.isArray(data.message)) {
    const values = data.message.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0);
    if (values.length) return values.join(". ");
  }
  return fallback;
}

export function paymentErrorCode(value: unknown): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const code = (value as { code?: unknown }).code;
  return typeof code === "string" ? code : null;
}

// Chỉ bắt đầu một giao dịch mới nếu chưa có giao dịch hoặc lần trước chắc chắn thất bại.
export function canStartNewPayment(attempt: SavedPaymentAttempt | null): boolean {
  return !attempt || attempt.state === "FAILED";
}
