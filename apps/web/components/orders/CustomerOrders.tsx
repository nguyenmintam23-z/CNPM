"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  customerApiError, customerDate, customerMoney, customerRole, customerStatusLabel,
  isCustomerOrdersPage, type CustomerOrdersPage,
} from "../../lib/customer-orders";
import styles from "./CustomerOrders.module.css";

type Access = "checking" | "allowed" | "guest" | "forbidden" | "error";
const PAGE_SIZE = 20;
export default function CustomerOrders() {
  const [access, setAccess] = useState<Access>("checking");
  const [authRetry, setAuthRetry] = useState(0);
  const [page, setPage] = useState(1);
  const [refresh, setRefresh] = useState(0);
  const [orders, setOrders] = useState<CustomerOrdersPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    async function check() {
      try {
        const response = await fetch("/api/auth/me", { cache: "no-store", credentials: "same-origin", signal: controller.signal });
        const payload: unknown = await response.json().catch(() => null);
        if (controller.signal.aborted) return;
        if (response.status === 401) setAccess("guest");
        else if (response.status === 403) setAccess("forbidden");
        else if (!response.ok) setAccess("error");
        else setAccess(customerRole(payload) === "CUSTOMER" ? "allowed" : "forbidden");
      } catch { if (!controller.signal.aborted) setAccess("error"); }
    }
    void check();
    return () => controller.abort();
  }, [authRetry]);

  useEffect(() => {
    if (access !== "allowed") return;
    const controller = new AbortController();
    async function load() {
      setLoading(true); setError(""); setOrders(null);
      try {
        const url = `/api/orders?page=${page}&pageSize=${PAGE_SIZE}`;
        const response = await fetch(url, { cache: "no-store", credentials: "same-origin", signal: controller.signal });
        const payload: unknown = await response.json().catch(() => null);
        if (controller.signal.aborted) return;
        if (response.status === 401) { setAccess("guest"); return; }
        if (response.status === 403) { setAccess("forbidden"); return; }
        if (!response.ok) setError(customerApiError(response.status, payload, "Không thể tải lịch sử đơn hàng."));
        else if (isCustomerOrdersPage(payload)) setOrders(payload);
        else setError("Dữ liệu lịch sử đơn hàng không đúng định dạng.");
      } catch { if (!controller.signal.aborted) setError("Không thể kết nối để tải lịch sử đơn hàng."); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    }
    void load();
    return () => controller.abort();
  }, [access, page, refresh]);

  const heading = (
    <header className={styles.hero}>
      <div>
        <p className={styles.eyebrow}>BREWLITE · KHÁCH HÀNG</p>
        <h1 className={styles.title}>Đơn hàng của tôi</h1>
        <p className={styles.muted}>Xem lại các đơn đã đặt và theo dõi trạng thái mới nhất.</p>
      </div>
      <div className={styles.actions}>
        <Link className={styles.secondaryButton} href="/">Về thực đơn</Link>
        {access === "allowed" &&
          <button className={styles.button} disabled={loading} onClick={() => setRefresh(v => v + 1)}>Làm mới</button>}
      </div>
    </header>
  );
  if (access !== "allowed") return (
    <main className={styles.page}><div className={styles.container}>{heading}
      <section className={styles.panel}>
        {access === "checking" ? <p role="status">Đang kiểm tra phiên đăng nhập…</p> :
         access === "guest" ? <><p>Vui lòng đăng nhập để xem đơn hàng của bạn.</p><Link className={styles.button} href="/login?next=%2Forders">Đăng nhập</Link></> :
         access === "forbidden" ? <p role="alert">Chỉ tài khoản CUSTOMER mới có thể xem lịch sử đơn hàng.</p> :
         <><p role="alert">Không thể kiểm tra phiên đăng nhập.</p><button className={styles.button} onClick={() => { setAccess("checking"); setAuthRetry(v => v + 1); }}>Thử lại</button></>}
      </section>
    </div></main>
  );
  const totalPages = orders ? Math.max(1, Math.ceil(orders.total / orders.pageSize)) : 1;
  return <main className={styles.page}><div className={styles.container}>
    {heading}
    <section className={styles.panel} aria-label="Lịch sử đơn hàng">
      <div className={styles.panelHeader}>
        <h2 className={styles.sectionTitle}>Lịch sử đơn hàng</h2>
        {orders && <p className={styles.muted}>Tổng cộng <strong>{orders.total}</strong> đơn</p>}
      </div>
      {loading ? <p className={styles.message} role="status">Đang tải đơn hàng…</p> :
       error ? <div className={styles.message} role="alert"><p>{error}</p><button className={styles.secondaryButton} onClick={() => setRefresh(v => v + 1)}>Thử lại</button></div> :
       orders?.items.length === 0 ? <div className={styles.empty}><p>Bạn chưa có đơn hàng nào.</p><Link href="/" className={styles.button}>Khám phá thực đơn</Link></div> :
       orders ? <>
        <div className={styles.tableScroll}><table className={styles.table}>
          <thead><tr><th scope="col">Mã đơn</th><th scope="col">Ngày đặt</th><th scope="col">Trạng thái</th><th scope="col" className={styles.right}>Tổng tiền</th><th scope="col">Chi tiết</th></tr></thead>
          <tbody>{orders.items.map(order => <tr key={order.id}>
            <td className={styles.code}>{order.orderCode}</td>
            <td>{customerDate(order.createdAt)}</td>
            <td><span className={styles.chip}>{customerStatusLabel(order.status)}</span></td>
            <td className={styles.right}>{customerMoney(order.totalAmount)}</td>
            <td><Link className={styles.link} href={`/orders/${encodeURIComponent(order.id)}`}>Xem đơn</Link></td>
          </tr>)}</tbody>
        </table></div>
        <nav className={styles.pagination} aria-label="Phân trang lịch sử đơn hàng">
          <button className={styles.secondaryButton} disabled={page <= 1} onClick={() => setPage(v => Math.max(1, v - 1))}>Trang trước</button>
          <span>Trang {orders.page} / {totalPages}</span>
          <button className={styles.secondaryButton} disabled={page >= totalPages} onClick={() => setPage(v => v + 1)}>Trang sau</button>
        </nav>
       </> : null}
    </section>
  </div></main>;
}
