"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  formatStaffDate,
  formatStaffMoney,
  isActiveStaffStatus,
  isStaffOrder,
  nextStaffStatus,
  staffActionLabel,
  staffErrorText,
  staffRoleFromSession,
  staffStatusLabel,
  type StaffOrder,
} from "../../lib/staff-orders";

type PagePhase = "checking" | "loading" | "ready" | "forbidden" | "not-found" | "error";

export default function StaffOrderDetailClient() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [phase, setPhase] = useState<PagePhase>("checking");
  const [order, setOrder] = useState<StaffOrder | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reload, setReload] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    async function loadOrder() {
      setPhase("checking");
      setError("");
      setOrder(null);
      try {
        const me = await fetch("/api/auth/me", {
          credentials: "same-origin", cache: "no-store", signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        if (me.status === 401) {
          router.replace(`/login?next=${encodeURIComponent(`/staff/orders/${id}`)}`);
          return;
        }
        if (!me.ok) throw new Error("Không kiểm tra được phiên đăng nhập.");
        const session: unknown = await me.json().catch(() => null);
        if (controller.signal.aborted) return;
        if (staffRoleFromSession(session) !== "STAFF") {
          setPhase("forbidden");
          return;
        }

        setPhase("loading");
        const response = await fetch(`/api/staff/orders/${encodeURIComponent(id)}`, {
          credentials: "same-origin", cache: "no-store", signal: controller.signal,
        });
        const payload: unknown = await response.json().catch(() => null);
        if (controller.signal.aborted) return;
        if (response.status === 401) {
          router.replace(`/login?next=${encodeURIComponent(`/staff/orders/${id}`)}`);
          return;
        }
        if (response.status === 403) {
          setPhase("forbidden");
          return;
        }
        if (response.status === 400 || response.status === 404) {
          setPhase("not-found");
          return;
        }
        if (!response.ok) {
          throw new Error(staffErrorText(payload, "Không thể tải chi tiết đơn hàng."));
        }
        if (!isStaffOrder(payload)) {
          throw new Error("Dữ liệu chi tiết đơn không đúng định dạng.");
        }
        setOrder(payload);
        setPhase("ready");
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : "Không tải được chi tiết đơn.");
        setPhase("error");
      }
    }
    void loadOrder();
    return () => controller.abort();
  }, [id, reload, router]);

  async function advance() {
    if (!order || submitting) return;
    const to = nextStaffStatus(order.status);
    if (!to) return;
    setSubmitting(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(
        `/api/staff/orders/${encodeURIComponent(order.id)}/status`,
        {
          method: "PATCH", credentials: "same-origin", cache: "no-store",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ from: order.status, to }),
        },
      );
      const payload: unknown = await response.json().catch(() => null);
      if (response.status === 401) {
        router.replace(`/login?next=${encodeURIComponent(`/staff/orders/${id}`)}`);
        return;
      }
      if (response.status === 403) {
        setOrder(null);
        setPhase("forbidden");
        return;
      }
      if (response.status === 409) {
        // API trả về trạng thái mới nhất trong body 409, kể cả khi đơn đã hoàn tất
        // và không còn xuất hiện trong endpoint hàng chờ.
        const conflictOrder =
          payload && typeof payload === "object" && "order" in payload
            ? (payload as { order: unknown }).order
            : null;
        if (isStaffOrder(conflictOrder)) {
          setOrder(conflictOrder);
          setPhase("ready");
          setNotice("Trạng thái đơn đã thay đổi. Đã hiển thị thông tin mới nhất.");
        } else {
          setNotice("Trạng thái đơn đã thay đổi. Đang tải lại đơn.");
          setReload((value) => value + 1);
        }
        return;
      }
      if (!response.ok) {
        setError(staffErrorText(payload, `Không thể cập nhật đơn (HTTP ${response.status}).`));
        return;
      }
      if (!isStaffOrder(payload)) {
        setNotice("Đang tải lại đơn.");
        setReload((value) => value + 1);
        return;
      }
      if (to === "COMPLETED") {
        router.push("/staff/orders");
        return;
      }
      setOrder(payload);
      setNotice("Đã cập nhật trạng thái đơn thành công.");
    } catch {
      setError("Mất kết nối khi cập nhật. Hãy tải lại đơn trước khi thử tiếp.");
    } finally {
      setSubmitting(false);
    }
  }

  if (phase === "checking" || phase === "loading") {
    return (
      <main role="status" className="grid min-h-screen place-items-center bg-[#FFF1C7] text-[#244A16]">
        {phase === "checking" ? "Đang kiểm tra quyền nhân viên..." : "Đang tải chi tiết đơn..."}
      </main>
    );
  }

  if (phase !== "ready" || !order) {
    const title = phase === "forbidden"
      ? "Không có quyền xem đơn"
      : phase === "not-found" ? "Không tìm thấy đơn trong hàng chờ" : "Không tải được đơn";
    return (
      <main className="grid min-h-screen place-items-center bg-[#FFF1C7] p-6 text-[#173B20]">
        <section className="max-w-lg rounded-3xl bg-[#FFFCF5] p-8 text-center shadow-sm">
          <h1 className="text-2xl font-bold">{title}</h1>
          <p className="mt-3 text-[#52634C]">
            {phase === "forbidden" ? "Chỉ nhân viên quầy mới có quyền truy cập." :
              phase === "not-found" ? "Đơn có thể đã hoàn tất hoặc không thuộc hàng chờ." : error}
          </p>
          {phase === "error" && (
            <button onClick={() => setReload((value) => value + 1)} className="mt-4 rounded-xl bg-[#244A16] px-5 py-3 font-semibold text-white">
              Thử lại
            </button>
          )}
          <p className="mt-5"><Link href="/staff/orders" className="font-semibold text-[#244A16] underline">Quay về hàng chờ</Link></p>
        </section>
      </main>
    );
  }

  const action = staffActionLabel(order.status);
  const next = nextStaffStatus(order.status);

  return (
    <main className="min-h-screen bg-[#FFF1C7] px-4 py-8 text-[#173B20] sm:px-8">
      <div className="mx-auto max-w-4xl">
        <Link href="/staff/orders" className="font-semibold text-[#244A16] hover:underline">← Quay về hàng chờ</Link>
        <div className="mt-7 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#526f43]">BREWLITE · CHI TIẾT ĐƠN</p>
            <h1 className="mt-2 text-3xl font-bold">{order.orderCode}</h1>
            <p className="mt-2 text-sm text-[#61705b]">Đặt lúc {formatStaffDate(order.createdAt)}</p>
          </div>
          <span className="rounded-full bg-[#eaf0dd] px-4 py-2 text-sm font-bold text-[#244A16]">{staffStatusLabel(order.status)}</span>
        </div>

        <section className="mt-6 rounded-3xl border border-[#e8e2cf] bg-[#FFFCF5] p-6 shadow-sm sm:p-8" aria-label="Chi tiết các món">
          <h2 className="text-xl font-bold">Các món cần chuẩn bị</h2>
          <div className="mt-5 divide-y divide-[#e8e2cf]">
            {order.items.map((item, index) => (
              <div key={`${item.productId ?? item.productName}-${index}`} className="flex flex-wrap items-start justify-between gap-4 py-4">
                <div>
                  <h3 className="font-bold">{item.productName} × {item.quantity}</h3>
                  <p className="mt-1 text-sm text-[#61705b]">Size: {item.sizeName ?? "Không áp dụng"}</p>
                  <p className="mt-1 text-sm text-[#61705b]">Topping: {item.toppings?.map((topping) => topping.name).join(", ") || "Không chọn"}</p>
                </div>
                {typeof item.lineTotal === "number" && (
                  <strong>{formatStaffMoney(item.lineTotal)}</strong>
                )}
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap justify-between gap-3 border-t border-[#e8e2cf] pt-5 text-xl font-bold">
            <span>Tổng tiền đơn hàng</span>
            <span>{formatStaffMoney(order.totalAmount)}</span>
          </div>
        </section>

        <section className="mt-6 rounded-3xl border border-[#e8e2cf] bg-[#FFFCF5] p-6 shadow-sm sm:p-8" aria-label="Cập nhật tiến độ">
          <h2 className="text-xl font-bold">Cập nhật tiến độ</h2>
          <p className="mt-2 text-sm text-[#61705b]">Chỉ được chuyển sang trạng thái kế tiếp. Hệ thống sẽ kiểm tra lại trạng thái trước khi cập nhật.</p>
          <div className="mt-5 flex flex-wrap gap-2 text-sm">
            {(["CONFIRMED", "PREPARING", "READY", "COMPLETED"] as const).map((status) => (
              <span key={status} className={`rounded-xl border px-3 py-2 ${order.status === status ? "border-[#244A16] bg-[#eaf0dd] font-bold" : "border-[#e8e2cf] text-[#61705b]"}`}>
                {staffStatusLabel(status)}
              </span>
            ))}
          </div>
          {notice && <p role="status" className="mt-5 rounded-xl bg-[#eaf0dd] p-4 text-[#244A16]">{notice}</p>}
          {error && <p role="alert" className="mt-5 rounded-xl bg-[#fff0ed] p-4 text-red-700">{error}</p>}
          <div className="mt-6 flex flex-wrap gap-3">
            {isActiveStaffStatus(order.status) && next && action && (
              <button type="button" disabled={submitting} onClick={() => void advance()}
                className="rounded-xl bg-[#244A16] px-6 py-3 font-bold text-white disabled:opacity-50">
                {submitting ? "Đang cập nhật..." : action}
              </button>
            )}
            <button type="button" disabled={submitting} onClick={() => setReload((value) => value + 1)}
              className="rounded-xl border border-[#b7c5a4] px-6 py-3 font-semibold disabled:opacity-50">
              Tải lại trạng thái
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
