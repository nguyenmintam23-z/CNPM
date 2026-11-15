"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  MANAGER_STATUSES,
  isManagerOrdersPage,
  latestManagerPaymentLabel,
  managerApiError,
  managerDate,
  managerMoney,
  managerRole,
  managerStatusLabel,
  type ManagerOrdersPage,
  type ManagerStatus,
} from "../../lib/manager-orders";
import styles from "./ManagerOrders.module.css";
const PAGE_SIZE = 20;
type Access = "checking" | "allowed" | "denied" | "error";

export default function ManagerOrders() {
  const [access, setAccess] = useState<Access>("checking");
  const [authRetry, setAuthRetry] = useState(0);
  const [status, setStatus] = useState<ManagerStatus | "">("");
  const [page, setPage] = useState(1);
  const [refresh, setRefresh] = useState(0);
  const [result, setResult] = useState<ManagerOrdersPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    async function checkRole() {
      try {
        const response = await fetch("/api/auth/me", {
          cache: "no-store",
          signal: controller.signal,
        });
        const payload: unknown = await response.json().catch(() => null);
        if (controller.signal.aborted) return;
        if (response.status === 401 || response.status === 403) {
          setAccess("denied");
        } else if (!response.ok) {
          setAccess("error");
        } else {
          setAccess(managerRole(payload) === "MANAGER" ? "allowed" : "denied");
        }
      } catch {
        if (!controller.signal.aborted) setAccess("error");
      }
    }
    void checkRole();
    return () => controller.abort();
  }, [authRetry]);

  useEffect(() => {
    if (access !== "allowed") return;
    const controller = new AbortController();
    async function fetchOrders() {
      setLoading(true);
      setError("");
      setResult(null);
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
      });
      if (status) params.set("status", status);
      try {
        const response = await fetch(`/api/manager/orders?${params}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const payload: unknown = await response.json().catch(() => null);
        if (controller.signal.aborted) return;
        if (!response.ok) {
          if (response.status === 401 || response.status === 403) {
            setAccess("denied");
            return;
          }
          setError(managerApiError(response.status, payload, "Không thể tải danh sách đơn hàng."));
        } else if (isManagerOrdersPage(payload)) {
          setResult(payload);
        } else {
          setError("Dữ liệu danh sách đơn hàng không đúng định dạng.");
        }
      } catch {
        if (!controller.signal.aborted) setError("Không thể kết nối để tải đơn hàng.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void fetchOrders();
    return () => controller.abort();
  }, [access, status, page, refresh]);

  if (access === "checking") {
    return <main className={styles.shell}><p role="status">Đang kiểm tra quyền quản lý…</p></main>;
  }
  if (access === "denied") {
    return (
      <main className={styles.shell}>
        <h1>Quản lý đơn hàng</h1>
        <div className={styles.notice} role="alert">
          Chỉ tài khoản MANAGER mới có quyền tra cứu đơn hàng.
        </div>
        <Link className={styles.link} href="/login">Đến trang đăng nhập</Link>
      </main>
    );
  }
  if (access === "error") {
    return (
      <main className={styles.shell}>
        <h1>Quản lý đơn hàng</h1>
        <p role="alert">Không thể kiểm tra phiên đăng nhập.</p>
        <button className={styles.button} onClick={() => {setAccess("checking"); setAuthRetry(n => n + 1);}}>
          Thử lại
        </button>
      </main>
    );
  }

  const totalPages = result ? Math.max(1, Math.ceil(result.total / result.pageSize)) : 1;

  return (
    <main className={styles.shell}>
      <div className={styles.heading}>
        <div>
          <p className={styles.eyebrow}>BREWLITE · MANAGER</p>
          <h1 className={styles.title}>Quản lý đơn hàng</h1>
          <p className={styles.muted}>Tra cứu đơn hàng, trạng thái và lịch sử thanh toán. Chỉ xem.</p>
        </div>
        <button className={styles.button} disabled={loading} onClick={() => setRefresh(n => n + 1)}>
          Làm mới
        </button>
      </div>

      <section className={styles.panel} aria-label="Danh sách đơn hàng">
        <div className={styles.toolbar}>
          <div className={styles.filter}>
            <label htmlFor="manager-status">Lọc theo trạng thái</label>
            <select
              id="manager-status"
              className={styles.select}
              value={status}
              onChange={event => {
                setStatus(event.target.value as ManagerStatus | "");
                setPage(1);
              }}
            >
              <option value="">Tất cả</option>
              {MANAGER_STATUSES.map(item => (
                <option key={item} value={item}>{managerStatusLabel(item)}</option>
              ))}
            </select>
          </div>
          {result && <p className={styles.muted}>Có <strong>{result.total}</strong> đơn hàng</p>}
        </div>

        {loading ? (
          <p className={styles.message} role="status">Đang tải đơn hàng…</p>
        ) : error ? (
          <div className={styles.message} role="alert">
            <p>{error}</p>
            <button className={styles.button} onClick={() => setRefresh(n => n + 1)}>Thử lại</button>
          </div>
        ) : result?.items.length === 0 ? (
          <p className={styles.message}>Không có đơn hàng ở trạng thái này.</p>
        ) : result ? (
          <>
            <div className={styles.tableScroll}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col">Mã đơn</th>
                    <th scope="col">Thời gian</th>
                    <th scope="col">Trạng thái</th>
                    <th scope="col">Thanh toán gần nhất</th>
                    <th scope="col" className={styles.alignRight}>Tổng tiền</th>
                    <th scope="col">Tra cứu</th>
                  </tr>
                </thead>
                <tbody>
                  {result.items.map(order => (
                    <tr key={order.id}>
                      <td className={styles.orderCode}>{order.orderCode}</td>
                      <td>{managerDate(order.createdAt)}</td>
                      <td><span className={styles.chip}>{managerStatusLabel(order.status)}</span></td>
                      <td>
                        <span className={order.latestPaymentStatus === "FAILED" ? styles.failed : ""}>
                          {latestManagerPaymentLabel(order.latestPaymentStatus)}
                        </span>
                      </td>
                      <td className={styles.alignRight}>{managerMoney(order.totalAmount)}</td>
                      <td>
                        <Link className={styles.link} href={`/manager/orders/${encodeURIComponent(order.id)}`}>
                          Xem chi tiết
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <nav className={styles.pagination} aria-label="Phân trang đơn hàng">
              <button className={styles.button} disabled={page <= 1} onClick={() => setPage(n => Math.max(1, n - 1))}>
                Trang trước
              </button>
              <span>Trang {result.page} / {totalPages}</span>
              <button className={styles.button} disabled={page >= totalPages} onClick={() => setPage(n => n + 1)}>
                Trang sau
              </button>
            </nav>
          </>
        ) : null}
      </section>
    </main>
  );
}
