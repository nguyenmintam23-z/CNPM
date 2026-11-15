"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  formatStaffDate,
  formatStaffMoney,
  isStaffOrderList,
  nextStaffStatus,
  staffActionLabel,
  staffErrorText,
  staffRoleFromSession,
  staffStatusLabel,
  type StaffActiveStatus,
  type StaffOrder,
} from "../../lib/staff-orders";

type PagePhase = "checking" | "loading" | "ready" | "forbidden" | "error";
type QueueFilter = StaffActiveStatus | "ALL";

const FILTERS: { value: QueueFilter; label: string }[] = [
  { value: "ALL", label: "Tất cả" },
  { value: "CONFIRMED", label: "Đã xác nhận" },
  { value: "PREPARING", label: "Đang chuẩn bị" },
  { value: "READY", label: "Sẵn sàng nhận" },
];

export default function StaffOrders() {
  const router = useRouter();
  const [phase, setPhase] = useState<PagePhase>("checking");
  const [orders, setOrders] = useState<StaffOrder[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [filter, setFilter] = useState<QueueFilter>("ALL");
  const [reload, setReload] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    async function loadQueue() {
      setPhase("checking");
      setError("");
      setOrders([]);
      try {
        const sessionResponse = await fetch("/api/auth/me", {
          cache: "no-store", credentials: "same-origin", signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        if (sessionResponse.status === 401) {
          router.replace("/login?next=%2Fstaff%2Forders");
          return;
        }
        if (!sessionResponse.ok) {
          throw new Error("Không thể kiểm tra phiên đăng nhập.");
        }
        const sessionPayload: unknown = await sessionResponse.json().catch(() => null);
        if (controller.signal.aborted) return;
        if (staffRoleFromSession(sessionPayload) !== "STAFF") {
          setPhase("forbidden");
          return;
        }

        setPhase("loading");
        const response = await fetch("/api/staff/orders", {
          cache: "no-store", credentials: "same-origin", signal: controller.signal,
        });
        const payload: unknown = await response.json().catch(() => null);
        if (controller.signal.aborted) return;
        if (response.status === 401) {
          router.replace("/login?next=%2Fstaff%2Forders");
          return;
        }
        if (response.status === 403) {
          setPhase("forbidden");
          return;
        }
        if (!response.ok) {
          throw new Error(staffErrorText(payload, "Không tải được danh sách đơn."));
        }
        if (!isStaffOrderList(payload)) {
          throw new Error("Dữ liệu danh sách đơn không đúng định dạng.");
        }
        setOrders(payload);
        setPhase("ready");
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : "Không tải được danh sách đơn.");
        setPhase("error");
      }
    }
    void loadQueue();
    return () => controller.abort();
  }, [reload, router]);

  const visibleOrders = useMemo(
    () => filter === "ALL" ? orders : orders.filter((order) => order.status === filter),
    [filter, orders],
  );

  const counts = useMemo(() => ({
    CONFIRMED: orders.filter((order) => order.status === "CONFIRMED").length,
    PREPARING: orders.filter((order) => order.status === "PREPARING").length,
    READY: orders.filter((order) => order.status === "READY").length,
  }), [orders]);

  async function advanceOrder(order: StaffOrder) {
    const to = nextStaffStatus(order.status);
    if (!to || busyId) return;
    setBusyId(order.id);
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
        router.replace("/login?next=%2Fstaff%2Forders");
        return;
      }
      if (response.status === 403) {
        setOrders([]);
        setPhase("forbidden");
        return;
      }
      if (response.status === 409) {
        setNotice("Trạng thái đơn đã thay đổi. Đang tải lại danh sách.");
        setReload((value) => value + 1);
        return;
      }
      if (!response.ok) {
        setError(staffErrorText(payload, `Không thể cập nhật đơn (HTTP ${response.status}).`));
        return;
      }
      setNotice(to === "COMPLETED" ? "Đã hoàn tất đơn, đơn sẽ rời hàng chờ." : "Cập nhật trạng thái thành công.");
      setReload((value) => value + 1);
    } catch {
      setError("Không kết nối được Backend. Hãy tải lại để kiểm tra trạng thái trước khi thao tác tiếp.");
    } finally {
      setBusyId(null);
    }
  }

  async function logout() {
    if (loggingOut) return;
    setLoggingOut(true);
    setError("");
    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST", credentials: "same-origin", cache: "no-store",
      });
      if (!response.ok) throw new Error("Đăng xuất thất bại.");
      setOrders([]);
      router.replace("/login");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể đăng xuất.");
    } finally {
      setLoggingOut(false);
    }
  }

  if (phase === "checking" || phase === "loading") {
    return (
      <main className="grid min-h-screen place-items-center bg-[#FFF1C7] text-[#244A16]" role="status">
        {phase === "checking" ? "Đang kiểm tra quyền nhân viên..." : "Đang tải hàng chờ..."}
      </main>
    );
  }

  if (phase === "forbidden") {
    return (
      <main className="grid min-h-screen place-items-center bg-[#FFF1C7] p-6 text-center text-[#173B20]">
        <section className="max-w-lg rounded-3xl bg-[#FFFCF5] p-8 shadow-sm">
          <h1 className="text-2xl font-bold">Bạn không có quyền xem hàng chờ</h1>
          <p className="mt-3">Chỉ tài khoản nhân viên quầy (STAFF) mới được truy cập màn hình này.</p>
          <button onClick={() => void logout()} className="mt-5 rounded-xl bg-[#244A16] px-5 py-3 font-semibold text-white">
            Đăng xuất để đổi tài khoản
          </button>
          {error && <p role="alert" className="mt-3 text-red-700">{error}</p>}
        </section>
      </main>
    );
  }

  if (phase === "error") {
    return (
      <main className="grid min-h-screen place-items-center bg-[#FFF1C7] p-6 text-center text-[#173B20]">
        <section className="max-w-lg rounded-3xl bg-[#FFFCF5] p-8 shadow-sm">
          <h1 className="text-2xl font-bold">Không tải được hàng chờ</h1>
          <p role="alert" className="mt-3 text-red-700">{error}</p>
          <button onClick={() => setReload((value) => value + 1)} className="mt-5 rounded-xl bg-[#244A16] px-5 py-3 font-semibold text-white">
            Thử lại
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#FFF1C7] px-4 py-8 text-[#173B20] sm:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#526f43]">BREWLITE · NHÂN VIÊN QUẦY</p>
            <h1 className="mt-2 text-3xl font-bold sm:text-4xl">Hàng chờ xử lý đơn</h1>
            <p className="mt-2 text-sm text-[#52634C]">Chỉ hiển thị đơn đã thanh toán và chưa hoàn tất.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setReload((value) => value + 1)} className="rounded-xl border border-[#aab995] bg-[#FFFCF5] px-4 py-3 font-semibold hover:bg-[#eff4e6]">
              Tải lại
            </button>
            <button type="button" disabled={loggingOut} onClick={() => void logout()} className="rounded-xl bg-[#244A16] px-4 py-3 font-semibold text-white disabled:opacity-60">
              Đăng xuất
            </button>
          </div>
        </header>

        <div className="mt-7 grid gap-3 sm:grid-cols-3">
          {([
            ["CONFIRMED", "Đã xác nhận"],
            ["PREPARING", "Đang chuẩn bị"],
            ["READY", "Sẵn sàng nhận"],
          ] as const).map(([status, title]) => (
            <div key={status} className="rounded-2xl border border-[#e8e2cf] bg-[#FFFCF5] p-5 shadow-sm">
              <p className="text-sm text-[#52634C]">{title}</p>
              <p className="mt-1 text-3xl font-bold">{counts[status]}</p>
            </div>
          ))}
        </div>

        <div className="mt-7 flex flex-wrap gap-2" role="group" aria-label="Lọc trạng thái đơn">
          {FILTERS.map(({ value, label }) => (
            <button key={value} type="button" onClick={() => setFilter(value)}
              aria-pressed={filter === value}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${filter === value ? "bg-[#244A16] text-white" : "border border-[#cbd6b5] bg-[#FFFCF5] text-[#244A16] hover:bg-[#eef1e4]"}`}>
              {label}
            </button>
          ))}
        </div>

        {notice && <p role="status" className="mt-5 rounded-xl bg-[#eaf0dd] p-4 font-medium text-[#244A16]">{notice}</p>}
        {error && <p role="alert" className="mt-5 rounded-xl bg-[#fff0ed] p-4 font-medium text-red-700">{error}</p>}

        {visibleOrders.length === 0 ? (
          <section className="mt-6 rounded-3xl border border-[#e8e2cf] bg-[#FFFCF5] p-10 text-center">
            <h2 className="text-xl font-bold">Chưa có đơn trong nhóm này</h2>
            <p className="mt-2 text-[#52634C]">Đơn chờ thanh toán không xuất hiện tại quầy. Nhấn Tải lại khi có đơn mới.</p>
          </section>
        ) : (
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {visibleOrders.map((order) => {
              const to = nextStaffStatus(order.status);
              const action = staffActionLabel(order.status);
              return (
                <article key={order.id} className="rounded-3xl border border-[#e8e2cf] bg-[#FFFCF5] p-6 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="text-xl font-bold">{order.orderCode}</h2>
                      <p className="mt-1 text-sm text-[#61705b]">{formatStaffDate(order.createdAt)}</p>
                    </div>
                    <span className="rounded-full bg-[#eaf0dd] px-3 py-1 text-xs font-bold text-[#244A16]">{staffStatusLabel(order.status)}</span>
                  </div>
                  <ul className="mt-5 space-y-3 border-y border-[#e8e2cf] py-4">
                    {order.items.map((item, index) => (
                      <li key={`${item.productId ?? item.productName}-${index}`} className="text-sm">
                        <p className="font-semibold">{item.productName} × {item.quantity}</p>
                        <p className="text-[#61705b]">{item.sizeName ? `Size ${item.sizeName}` : "Không có size"} · {item.toppings?.map((topping) => topping.name).join(", ") || "Không topping"}</p>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-4 flex justify-between gap-2 font-bold"><span>Tổng đơn</span><span>{formatStaffMoney(order.totalAmount)}</span></p>
                  <div className="mt-5 flex flex-wrap gap-3">
                    <Link href={`/staff/orders/${encodeURIComponent(order.id)}`}
                      className="flex-1 rounded-xl border border-[#b7c5a4] px-4 py-3 text-center font-semibold hover:bg-[#edf2e5]">
                      Xem chi tiết
                    </Link>
                    {to && action && (
                      <button type="button" disabled={busyId !== null} onClick={() => void advanceOrder(order)}
                        className="flex-1 rounded-xl bg-[#244A16] px-4 py-3 font-semibold text-white disabled:opacity-50">
                        {busyId === order.id ? "Đang cập nhật..." : action}
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
