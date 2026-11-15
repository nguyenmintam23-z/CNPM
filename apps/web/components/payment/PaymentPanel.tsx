"use client";

import { useCallback, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import type { CreatedOrder } from "../../lib/checkout";
import { saveCheckoutRecord } from "../../lib/checkout";
import { formatVnd } from "../../lib/product";
import {
  canStartNewPayment,
  isPaymentResult,
  isSavedPaymentAttempt,
  paymentErrorCode,
  paymentErrorText,
  paymentStorageKey,
  type PaymentMethod,
  type SavedPaymentAttempt,
} from "../../lib/payment";

type Props = {
  order: CreatedOrder;
  userId: string;
  onOrderUpdated: (status: string, stockHoldStatus?: string) => void;
};

// localStorage không tự phát sự kiện "storage" trong cùng tab.
// Phát thêm sự kiện riêng để React cập nhật sau khi lưu giao dịch.
const PAYMENT_CHANGE_EVENT = "brewlite-payment-changed";

function subscribeToPayment(listener: () => void) {
  window.addEventListener("storage", listener);
  window.addEventListener(PAYMENT_CHANGE_EVENT, listener);
  return () => {
    window.removeEventListener("storage", listener);
    window.removeEventListener(PAYMENT_CHANGE_EVENT, listener);
  };
}

function persistPayment(key: string, attempt: SavedPaymentAttempt): boolean {
  if (!saveCheckoutRecord(key, attempt)) return false;
  window.dispatchEvent(new Event(PAYMENT_CHANGE_EVENT));
  return true;
}

function serverPaymentSnapshot() {
  return "hydrating";
}

export default function PaymentPanel({ order, userId, onOrderUpdated }: Props) {
  const router = useRouter();
  const [method, setMethod] = useState<PaymentMethod>("WALLET");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const storageKey = userId && order.id ? paymentStorageKey(userId, order.id) : "";

  // Đọc trạng thái từ localStorage theo API dành cho external store của React.
  // Khi SSR/hydration, chưa cho tạo thanh toán để tránh gửi trùng giao dịch.
  const getPaymentSnapshot = useCallback(() => {
    if (!storageKey) return "missing";
    try {
      return `ready:${window.localStorage.getItem(storageKey) ?? ""}`;
    } catch {
      return "storage-error";
    }
  }, [storageKey]);
  const snapshot = useSyncExternalStore(
    subscribeToPayment,
    getPaymentSnapshot,
    serverPaymentSnapshot,
  );
  const ready = snapshot.startsWith("ready:");
  let attempt: SavedPaymentAttempt | null = null;
  if (ready) {
    try {
      const stored: unknown = JSON.parse(snapshot.slice("ready:".length));
      if (isSavedPaymentAttempt(stored)) attempt = stored;
    } catch {
      // Chưa có bản ghi thanh toán hoặc dữ liệu lưu cũ không hợp lệ.
    }
  }

  const paid = order.status === "CONFIRMED" || attempt?.state === "SUCCEEDED";
  const ongoing = attempt?.state === "PROCESSING" || attempt?.state === "UNKNOWN";
  const failed = attempt?.state === "FAILED";
  const activeMethod = ongoing && attempt ? attempt.method : method;

  async function submitPayment(checkExisting: boolean) {
    if (busy || !ready || !userId || paid || order.status !== "PENDING_PAYMENT") return;
    if (!checkExisting && !canStartNewPayment(attempt)) {
      setError("Hãy kiểm tra kết quả giao dịch hiện tại trước khi tạo lần thanh toán mới.");
      return;
    }
    if (checkExisting && !attempt) return;

    const key = checkExisting ? attempt!.idempotencyKey : crypto.randomUUID();
    const selected = checkExisting ? attempt!.method : method;
    const pending: SavedPaymentAttempt = { method: selected, idempotencyKey: key, state: "PROCESSING" };

    // Lưu khóa TRƯỚC khi gọi API để gửi lại cùng khóa khi mất phản hồi.
    if (!persistPayment(storageKey, pending)) {
      setError("Không lưu được mã giao dịch. Hãy kiểm tra bộ nhớ trình duyệt.");
      return;
    }
    setError("");
    setBusy(true);
    try {
      const response = await fetch(`/api/orders/${encodeURIComponent(order.id)}/payments`, {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method: selected, idempotencyKey: key }),
      });
      const payload: unknown = await response.json().catch(() => null);

      if (response.status === 401) {
        persistPayment(storageKey, { ...pending, state: "UNKNOWN" });
        router.replace("/login?next=%2Fcheckout");
        return;
      }

      if ((response.status === 200 || response.status === 202) && isPaymentResult(payload)) {
        if (payload.order.id !== order.id || payload.payment.method !== selected) {
          persistPayment(storageKey, { ...pending, state: "UNKNOWN" });
          setError("Phản hồi giao dịch không khớp đơn hàng. Chưa thể xác nhận kết quả.");
          return;
        }
        const state = payload.payment.status;
        const next: SavedPaymentAttempt = {
          method: selected,
          idempotencyKey: key,
          state,
          ...(typeof payload.payment.failureReason === "string"
            ? { failureReason: payload.payment.failureReason }
            : {}),
        };
        persistPayment(storageKey, next);
        onOrderUpdated(payload.order.status, payload.order.stockHoldStatus);
        if (state === "PROCESSING") {
          setError("Giao dịch đang được xử lý. Hãy kiểm tra lại sau vài giây; hệ thống sẽ dùng cùng mã giao dịch.");
        } else if (state === "FAILED") {
          setError(next.failureReason || "Thanh toán mô phỏng thất bại. Bạn có thể thử lại bằng giao dịch mới.");
        } else if (state === "SUCCEEDED") {
          setError("");
        }
        return;
      }

      const code = paymentErrorCode(payload);
      const message = paymentErrorText(payload, `Thanh toán chưa hoàn tất (HTTP ${response.status}).`);
      if (response.status === 403) {
        setError("Chỉ khách hàng là chủ đơn mới có thể thanh toán đơn này.");
      } else if (response.status === 409 && code === "PAYMENT_IN_PROGRESS") {
        setError("Đơn đang có giao dịch khác xử lý. Hãy xác minh khóa giao dịch trước đó, không tạo thêm lần thanh toán mới.");
      } else if (response.status === 409 && code === "ORDER_NOT_PAYABLE") {
        setError("Đơn không còn ở trạng thái chờ thanh toán. Hãy kiểm tra trạng thái đơn trước khi tiếp tục.");
      } else if (response.status === 409) {
        setError(message);
      } else {
        setError(message);
      }
      // Không biết chắc có tạo Payment hay không: giữ nguyên khóa để kiểm tra lại.
      const unknown: SavedPaymentAttempt = { ...pending, state: "UNKNOWN" };
      persistPayment(storageKey, unknown);
    } catch {
      const unknown: SavedPaymentAttempt = { ...pending, state: "UNKNOWN" };
      persistPayment(storageKey, unknown);
      setError("Mất kết nối khi thanh toán. Chưa biết kết quả; hãy dùng nút kiểm tra lại, không tạo giao dịch mới.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-label="Thanh toán mô phỏng" className="mt-8 border-t border-[#e8e2cf] pt-6">
      <h3 className="text-xl font-bold">Thanh toán mô phỏng</h3>
      <p className="mt-2 text-sm text-[#61705b]">
        Thanh toán thử nghiệm bằng Ví hoặc Thẻ. Không nhập số thẻ hay thông tin ví thật.
      </p>
      {snapshot === "storage-error" ? (
        <p role="alert" className="mt-4 text-red-700">Không thể đọc bộ nhớ trình duyệt. Hãy bật lưu trữ trang trước khi thanh toán.</p>
      ) : !ready ? <p role="status" className="mt-4">Đang kiểm tra giao dịch trước đó...</p> : (
        <>
          {paid ? (
            <div role="status" className="mt-4 rounded-xl bg-[#eaf0dd] p-4 text-[#244A16]">
              <p className="font-bold">Thanh toán mô phỏng thành công!</p>
              <p className="mt-1 text-sm">Đơn {order.orderCode} đã được xác nhận. Nhân viên có thể thấy đơn trong hàng chờ.</p>
            </div>
          ) : order.status !== "PENDING_PAYMENT" ? (
            <p role="status" className="mt-4 text-[#244A16]">Đơn hiện có trạng thái {order.status}; không thể tạo thanh toán mới từ trang này.</p>
          ) : (
            <>
              <div className="mt-4 grid gap-3 sm:grid-cols-2" role="group" aria-label="Phương thức thanh toán">
                {([
                  { id: "WALLET" as const, label: "Ví điện tử mô phỏng" },
                  { id: "CARD" as const, label: "Thẻ mô phỏng" },
                ]).map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    aria-pressed={activeMethod === option.id}
                    disabled={busy || ongoing}
                    onClick={() => setMethod(option.id)}
                    className={`rounded-xl border p-4 text-left font-semibold disabled:opacity-60 ${activeMethod === option.id
                      ? "border-[#244A16] bg-[#eaf0dd] text-[#244A16]"
                      : "border-[#cbd6b5] bg-[#f9faf5] text-[#173B20]"}`}
                  >{option.label}</button>
                ))}
              </div>
              <p className="mt-4 text-sm">Số tiền Backend xác nhận: <strong>{formatVnd(order.totalAmount)}</strong></p>
              {failed && <p role="status" className="mt-3 rounded-xl bg-[#fff1e9] p-3 text-[#8b3a29]">Giao dịch trước thất bại. Thử lại sẽ dùng một khóa mới.</p>}
              {ongoing && <p role="status" className="mt-3 rounded-xl bg-[#f1f4e8] p-3 text-[#244A16]">Giao dịch trước chưa có kết quả cuối. Kiểm tra lại bằng khóa cũ.</p>}
              {error && <p role="alert" className="mt-4 text-sm font-semibold text-red-700">{error}</p>}
              <button
                type="button"
                disabled={busy}
                onClick={() => void submitPayment(ongoing)}
                className="mt-5 w-full rounded-xl bg-[#244A16] px-4 py-3 font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy ? "Đang liên hệ Backend..."
                  : ongoing ? "Kiểm tra lại kết quả"
                    : failed ? "Thử thanh toán lần mới" : "Xác nhận thanh toán mô phỏng"}
              </button>
            </>
          )}
        </>
      )}
    </section>
  );
}
