import {
  canStartNewPayment,
  isPaymentResult,
  isSavedPaymentAttempt,
  paymentErrorCode,
  paymentErrorText,
  paymentKeyValid,
  paymentStorageKey,
} from "../lib/payment";

test("lưu giao dịch riêng cho từng tài khoản và từng đơn", () => {
  expect(paymentStorageKey("khach-A", "don-1")).not.toBe(paymentStorageKey("khach-B", "don-1"));
  expect(paymentStorageKey("khach-A", "don-1")).not.toBe(paymentStorageKey("khach-A", "don-2"));
});

test("chỉ chấp nhận idempotencyKey đúng định dạng", () => {
  expect(paymentKeyValid("a1b2c3d4-1234-4567-8888-abcdef012345")).toBe(true);
  expect(paymentKeyValid("sai key")).toBe(false);
  expect(paymentKeyValid("abc")).toBe(false);
});

test("đọc bản ghi giao dịch đang xử lý", () => {
  expect(isSavedPaymentAttempt({ method: "WALLET", idempotencyKey: "abcd1234", state: "PROCESSING" })).toBe(true);
  expect(isSavedPaymentAttempt({ method: "REAL_CARD", idempotencyKey: "abcd1234", state: "PROCESSING" })).toBe(false);
});

test("không tạo giao dịch mới khi lần trước chưa có kết quả", () => {
  expect(canStartNewPayment(null)).toBe(true);
  expect(canStartNewPayment({ method: "CARD", idempotencyKey: "abcd1234", state: "FAILED" })).toBe(true);
  expect(canStartNewPayment({ method: "CARD", idempotencyKey: "abcd1234", state: "PROCESSING" })).toBe(false);
  expect(canStartNewPayment({ method: "WALLET", idempotencyKey: "abcd1234", state: "UNKNOWN" })).toBe(false);
  expect(canStartNewPayment({ method: "CARD", idempotencyKey: "abcd1234", state: "SUCCEEDED" })).toBe(false);
});

test("kiểm tra phản hồi thanh toán từ Backend", () => {
  expect(isPaymentResult({
    payment: { method: "WALLET", status: "SUCCEEDED", amount: 32000 },
    order: { id: "don-1", status: "CONFIRMED", stockHoldStatus: "COMMITTED" },
  })).toBe(true);
  expect(isPaymentResult({ payment: { method: "WALLET", status: "SUCCEEDED" }, order: { id: "don-1", status: "CONFIRMED" } })).toBe(false);
  expect(isPaymentResult({ payment: { method: "CARD", status: "UNKNOWN", amount: 30000 }, order: { id: "don-1", status: "PENDING_PAYMENT" } })).toBe(false);
});

test("đọc thông báo và mã lỗi API thanh toán", () => {
  expect(paymentErrorText({ message: ["Không đủ hàng", "Thử lại"] }, "Lỗi")).toBe("Không đủ hàng. Thử lại");
  expect(paymentErrorText(null, "Lỗi")).toBe("Lỗi");
  expect(paymentErrorCode({ code: "PAYMENT_IN_PROGRESS" })).toBe("PAYMENT_IN_PROGRESS");
});

test("kiểm tra dữ liệu đơn và payment để không báo thành công giả", () => {
  expect(isPaymentResult({ payment: { method: "CARD", status: "SUCCEEDED", amount: 32000 }, order: { id: "", status: "CONFIRMED" } })).toBe(false);
  expect(isPaymentResult({ payment: { method: "CARD", status: "CHARGED", amount: 32000 }, order: { id: "abc", status: "CONFIRMED" } })).toBe(false);
});
