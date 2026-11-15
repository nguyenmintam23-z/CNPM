"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import PaymentPanel from "../../components/payment/PaymentPanel";
import { useRouter } from "next/navigation";
import { cartTotal, unitPrice, useCartItems, userIdFromSession } from "../../lib/cart";
import { formatVnd } from "../../lib/product";
import {
  checkoutErrorText, checkoutFingerprint, checkoutItems, checkoutStorageKey,
  isCheckoutError, isCreatedOrder, loadCheckoutRecord, requestIdValid,
  saveCheckoutRecord, validateCheckoutCart,
  type CheckoutError, type SavedDraft, type SavedOrder,
} from "../../lib/checkout";

type SessionState = "checking" | "authenticated" | "error";
type OrderSnapshot = SavedOrder & { userId: string };

export default function CheckoutPage() {
  const router = useRouter();
  const [session, setSession] = useState<SessionState>("checking");
  const [userId, setUserId] = useState<string | null>(null);
  const [sessionRetry, setSessionRetry] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [issues, setIssues] = useState<CheckoutError | null>(null);
  const [storedOrder, setStoredOrder] = useState<OrderSnapshot | null>(null);

  // Bắt buộc truyền userId để không đọc giỏ của tài khoản khác (PR #61).
  const items = useCartItems(userId);
  const fingerprint = useMemo(() => checkoutFingerprint(items), [items]);
  const validationError = validateCheckoutCart(items);
  const order = storedOrder?.userId === userId && storedOrder.fingerprint === fingerprint
    ? storedOrder.order : null;

  useEffect(() => {
    const controller = new AbortController();
    async function verifySession() {
      setSession("checking");
      try {
        const response = await fetch("/api/auth/me", {
          credentials: "same-origin", cache: "no-store", signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        if (response.status === 401) {
          router.replace("/login?next=%2Fcheckout");
          return;
        }
        if (!response.ok) throw new Error("Không kiểm tra được phiên đăng nhập.");
        const payload: unknown = await response.json().catch(() => null);
        if (controller.signal.aborted) return;
        const id = userIdFromSession(payload);
        if (!id) throw new Error("Không xác định được tài khoản đang đăng nhập.");
        setUserId(id);
        setSession("authenticated");
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(err instanceof Error ? err.message : "Lỗi phiên đăng nhập.");
          setSession("error");
        }
      }
    }
    void verifySession();
    return () => controller.abort();
  }, [router, sessionRetry]);

  useEffect(() => {
    let active = true;
    async function restoreOrder() {
      if (!userId) return;
      const saved = loadCheckoutRecord<SavedOrder>(checkoutStorageKey(userId, "order"));
      if (!active) return;
      setStoredOrder(saved && saved.fingerprint === fingerprint && isCreatedOrder(saved.order)
        ? { ...saved, userId } : null);
      setError("");
      setIssues(null);
    }
    void restoreOrder();
    return () => { active = false; };
  }, [userId, fingerprint]);

  async function confirmOrder() {
    if (!userId || session !== "authenticated" || submitting || order || validationError) return;
    setError("");
    setIssues(null);
    const key = checkoutStorageKey(userId, "draft");
    const oldDraft = loadCheckoutRecord<SavedDraft>(key);
    let requestId: string;
    if (oldDraft?.fingerprint === fingerprint && requestIdValid(oldDraft.requestId)) {
      requestId = oldDraft.requestId;
    } else {
      if (typeof crypto === "undefined" || typeof crypto.randomUUID !== "function") {
        setError("Trình duyệt chưa hỗ trợ tạo mã yêu cầu an toàn.");
        return;
      }
      requestId = crypto.randomUUID();
    }
    // Phải lưu mã trước khi gửi; retry cùng giỏ phải dùng lại mã này.
    if (!saveCheckoutRecord(key, { fingerprint, requestId } satisfies SavedDraft)) {
      setError("Không thể lưu mã yêu cầu. Hãy kiểm tra bộ nhớ trình duyệt trước khi đặt đơn.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/orders/checkout", {
        method: "POST", credentials: "same-origin", cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, items: checkoutItems(items) }),
      });
      const payload: unknown = await response.json().catch(() => null);
      if (response.status === 401) {
        router.replace("/login?next=%2Fcheckout");
        return;
      }
      if ((response.status === 200 || response.status === 201) && isCreatedOrder(payload)) {
        const saved = { fingerprint, order: payload } satisfies SavedOrder;
        if (!saveCheckoutRecord(checkoutStorageKey(userId, "order"), saved)) {
          setError("Đơn đã tạo nhưng không lưu được xác nhận. Hãy chụp hoặc ghi lại mã đơn.");
        }
        setStoredOrder({ ...saved, userId });
        return;
      }
      if (response.status === 400 && isCheckoutError(payload)) {
        setIssues(payload);
        setError(checkoutErrorText(payload, "Có món cần điều chỉnh trong giỏ hàng."));
      } else if (response.status === 409 && isCheckoutError(payload)) {
        setIssues(payload);
        setError(payload.code === "REQUEST_ID_REUSED"
          ? "Mã yêu cầu đã được dùng cho nội dung khác. Hãy kiểm tra đơn trước khi thử tiếp."
          : checkoutErrorText(payload, "Một số món không đủ hàng. Hãy điều chỉnh giỏ."));
      } else if (response.status === 403) {
        setError("Chỉ tài khoản khách hàng mới có quyền đặt đơn.");
      } else {
        setError(checkoutErrorText(payload, `Chưa xác nhận được đơn (HTTP ${response.status}). Nếu chưa biết đơn đã tạo hay chưa, hãy thử lại với cùng mã yêu cầu.`));
      }
    } catch {
      setError("Mất kết nối khi gửi đơn. Đơn có thể đã được tạo; hãy thử lại để gửi cùng mã yêu cầu, tránh tạo trùng.");
    } finally {
      setSubmitting(false);
    }
  }

  function onOrderUpdated(status: string, stockHoldStatus?: string) {
    if (!userId || !order) return;
    const nextOrder = {
      ...order,
      status,
      stockHoldStatus: stockHoldStatus ?? order.stockHoldStatus,
    };
    const saved = { fingerprint, order: nextOrder } satisfies SavedOrder;
    saveCheckoutRecord(checkoutStorageKey(userId, "order"), saved);
    setStoredOrder({ ...saved, userId });
  }

  if (session === "checking") return (
    <main role="status" className="grid min-h-screen place-items-center bg-[#FFF9E9] text-[#244A16]">Đang kiểm tra phiên đăng nhập...</main>
  );
  if (session === "error") return (
    <main className="grid min-h-screen place-items-center bg-[#FFF9E9] p-6 text-[#173B20]">
      <div className="text-center"><h1 className="text-2xl font-bold">Không thể kiểm tra tài khoản</h1>
        <p className="mt-3">{error}</p>
        <button onClick={() => setSessionRetry((n) => n + 1)} className="mt-5 font-semibold underline">Thử lại</button>
      </div>
    </main>
  );

  return (
    <main className="min-h-screen bg-[#FFF1C7] px-4 py-10 text-[#173B20] sm:px-8">
      <div className="mx-auto max-w-5xl">
        <Link href="/cart" className="font-semibold text-[#244A16] hover:underline">← Quay lại giỏ hàng</Link>
        <h1 className="mt-6 font-display text-3xl font-bold sm:text-4xl">{order ? "Đã tạo đơn hàng" : "Xác nhận đặt đơn"}</h1>
        {order ? (
          <section className="mt-7 rounded-3xl border border-[#e8e2cf] bg-[#fffdf7] p-6 shadow-sm sm:p-8" aria-label="Đơn hàng đã tạo">
            <p className="font-semibold text-[#4f6d38]">{order.status === "CONFIRMED" ? "Thanh toán thành công – đã xác nhận đơn" : "Đã tạo đơn – đang chờ thanh toán"}</p>
            <h2 className="mt-2 text-2xl font-bold">Mã đơn: {order.orderCode}</h2>
            <p className="mt-2 text-sm text-[#61705b]">Trạng thái: {order.status} · Giữ hàng: {order.stockHoldStatus}</p>
            <div className="mt-6 space-y-3 border-y border-[#e8e2cf] py-5">
              {order.items.map((item, index) => (
                <div key={`${item.productId}-${index}`} className="flex items-start justify-between gap-3">
                  <div><p className="font-semibold">{item.productName} × {item.quantity}</p>
                    <p className="text-sm text-[#61705b]">{item.sizeName ?? "Không có size"}{item.toppings?.length ? ` · ${item.toppings.map((t) => t.name).join(", ")}` : ""}</p>
                  </div>
                  <strong>{formatVnd(item.lineTotal)}</strong>
                </div>
              ))}
            </div>
            <div className="mt-5 flex justify-between gap-3 text-xl font-bold"><span>Tổng tiền Backend xác nhận</span><span>{formatVnd(order.totalAmount)}</span></div>
            <PaymentPanel
              order={order}
              userId={userId ?? ""}
              onOrderUpdated={onOrderUpdated}
            />
            {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
          </section>
        ) : items.length === 0 ? (
          <section className="mt-7 rounded-3xl bg-[#fffdf7] p-8">
            <p>Giỏ hàng đang trống.</p><Link href="/#menu" className="mt-3 inline-block font-semibold underline">Chọn món</Link>
          </section>
        ) : (
          <div className="mt-7 grid gap-6 lg:grid-cols-[1fr_320px] lg:items-start">
            <section aria-label="Các món đặt" className="space-y-4">
              {items.map((item, index) => {
                const lineErrors = issues?.lines?.filter((issue) => issue.index === index).map((issue) => issue.message) ?? [];
                const shortageErrors = issues?.shortages?.filter((s) => s.productId === item.productId).map((s) => s.message) ?? [];
                const messages = [...lineErrors, ...shortageErrors];
                return (
                  <article key={item.key} className={`rounded-2xl border bg-[#fffdf7] p-5 ${messages.length ? "border-red-500" : "border-[#e8e2cf]"}`}>
                    <h2 className="text-xl font-bold">{item.productName}</h2>
                    <p className="mt-2 text-sm text-[#61705b]">Size: {item.sizeName ?? "Không áp dụng"}</p>
                    <p className="mt-1 text-sm text-[#61705b]">Topping: {item.toppings.map((t) => t.name).join(", ") || "Không chọn"}</p>
                    <p className="mt-2">{item.quantity} × {formatVnd(unitPrice(item))} = <strong>{formatVnd(unitPrice(item) * item.quantity)}</strong></p>
                    {messages.length > 0 && <p role="alert" className="mt-3 text-sm font-semibold text-red-700">{messages.join(". ")}</p>}
                  </article>
                );
              })}
              {issues?.shortages?.length ? <p className="text-sm text-[#7a2d21]">Hãy quay lại giỏ để giảm số lượng hoặc xóa món thiếu hàng.</p> : null}
            </section>
            <aside className="rounded-2xl border border-[#e8e2cf] bg-[#fffdf7] p-6 shadow-sm">
              <h2 className="text-xl font-bold">Tổng kết đơn hàng</h2>
              <div className="mt-4 flex justify-between gap-3 border-b pb-4 font-bold"><span>Tạm tính</span><span>{formatVnd(cartTotal(items))}</span></div>
              <p className="mt-4 text-sm leading-6 text-[#61705b]">Backend sẽ kiểm tra lại giá và tồn kho. Chưa thu tiền tại bước này.</p>
              {validationError && <p role="alert" className="mt-4 text-sm text-red-700">{validationError}</p>}
              {error && <p role="alert" className="mt-4 text-sm font-semibold text-red-700">{error}</p>}
              <button type="button" disabled={Boolean(validationError) || submitting} onClick={() => void confirmOrder()}
                className="mt-5 w-full rounded-xl bg-[#244A16] px-4 py-3 font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">
                {submitting ? "Đang gửi đơn..." : error ? "Thử gửi lại đơn" : "Xác nhận đặt đơn"}
              </button>
            </aside>
          </div>
        )}
      </div>
    </main>
  );
}
