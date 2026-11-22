"use client";

import Link from "next/link";
import PaymentPanel from "../payment/PaymentPanel";
import { userIdFromSession } from "../../lib/cart";
import { useEffect, useState } from "react";
import {
  canCancelCustomerOrder, customerApiError, customerDate, customerMoney,
  customerRole, customerStatusLabel, isCustomerOrder, type CustomerOrder,
} from "../../lib/customer-orders";
import styles from "./CustomerOrders.module.css";

type Access = "checking" | "allowed" | "guest" | "forbidden" | "error";
export default function CustomerOrderDetail({ id }: { id: string }) {
  const [access, setAccess] = useState<Access>("checking");
  const [userId, setUserId] = useState<string | null>(null);
  const [authRetry, setAuthRetry] = useState(0);
  const [refresh, setRefresh] = useState(0);
  const [order, setOrder] = useState<CustomerOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [canceling, setCanceling] = useState(false);
  const [cancelMessage, setCancelMessage] = useState("");

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
        else {
          const id = userIdFromSession(payload);
          if (customerRole(payload) !== "CUSTOMER" || !id) setAccess("forbidden");
          else { setUserId(id); setAccess("allowed"); }
        }
      } catch { if (!controller.signal.aborted) setAccess("error"); }
    }
    void check();
    return () => controller.abort();
  }, [authRetry]);

  useEffect(() => {
    if (access !== "allowed") return;
    const controller = new AbortController();
    async function load() {
      setLoading(true); setError(""); setOrder(null);
      try {
        const response = await fetch(`/api/orders/${encodeURIComponent(id)}`, {
          cache: "no-store", credentials: "same-origin", signal: controller.signal,
        });
        const payload: unknown = await response.json().catch(() => null);
        if (controller.signal.aborted) return;
        if (response.status === 401) { setAccess("guest"); return; }
        if (response.status === 403) { setAccess("forbidden"); return; }
        if (!response.ok) setError(customerApiError(response.status, payload, "Không thể tải đơn hàng."));
        else if (isCustomerOrder(payload)) setOrder(payload);
        else setError("Dữ liệu chi tiết đơn hàng không hợp lệ.");
      } catch { if (!controller.signal.aborted) setError("Không thể kết nối để tải đơn hàng."); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    }
    void load();
    return () => controller.abort();
  }, [access, id, refresh]);

  async function cancelOrder() {
    if (!order || canceling || !canCancelCustomerOrder(order.status)) return;
    if (!window.confirm("Bạn muốn hủy đơn hàng này?")) return;
    setCanceling(true); setCancelMessage("");
    try {
      const response = await fetch(`/api/orders/${encodeURIComponent(id)}/cancel`, {
        method: "POST", cache: "no-store", credentials: "same-origin",
      });
      const payload: unknown = await response.json().catch(() => null);
      if (response.status === 401) { setAccess("guest"); return; }
      if (response.status === 403) { setAccess("forbidden"); return; }
      if (!response.ok) {
        setCancelMessage(customerApiError(response.status, payload, "Không thể hủy đơn hàng."));
      } else {
        setCancelMessage("Đã hủy đơn hàng thành công.");
      }
      // Luôn tải lại từ server, nhất là khi gặp 409 vì trạng thái có thể đã đổi.
      setRefresh(v => v + 1);
    } catch { setCancelMessage("Không thể kết nối để hủy đơn. Vui lòng thử lại."); }
    finally { setCanceling(false); }
  }

  return <main className={styles.page}><div className={styles.container}>
    <div className={styles.back}><Link href="/orders">← Quay lại lịch sử đơn hàng</Link></div>
    <header className={styles.hero}>
      <div><p className={styles.eyebrow}>BREWLITE · KHÁCH HÀNG</p><h1 className={styles.title}>Chi tiết đơn hàng</h1></div>
      <button className={styles.button} disabled={loading || canceling || access !== "allowed"} onClick={() => setRefresh(v => v + 1)}>Làm mới</button>
    </header>
    {access !== "allowed" ? <section className={styles.panel}>
      {access === "checking" ? <p role="status">Đang kiểm tra phiên đăng nhập…</p> :
       access === "guest" ? <><p>Vui lòng đăng nhập để xem đơn hàng.</p><Link className={styles.button} href={`/login?next=${encodeURIComponent(`/orders/${id}`)}`}>Đăng nhập</Link></> :
       access === "forbidden" ? <p role="alert">Bạn không có quyền xem đơn hàng này.</p> :
       <><p role="alert">Không thể kiểm tra phiên đăng nhập.</p><button className={styles.secondaryButton} onClick={() => { setAccess("checking"); setAuthRetry(v => v + 1); }}>Thử lại</button></>}
    </section> : loading ? <section className={styles.panel}><p role="status">Đang tải chi tiết đơn hàng…</p></section> :
     error ? <section className={styles.panel}><p role="alert">{error}</p><button className={styles.secondaryButton} onClick={() => setRefresh(v => v + 1)}>Thử lại</button></section> :
     order ? <>
       <section className={styles.panel}>
         <div className={styles.panelHeader}>
           <h2 className={styles.sectionTitle}>{order.orderCode}</h2>
           <span className={styles.chip}>{customerStatusLabel(order.status)}</span>
         </div>
         <div className={styles.infoGrid}>
           <div><p className={styles.label}>Ngày đặt</p><p className={styles.value}>{customerDate(order.createdAt)}</p></div>
           <div><p className={styles.label}>Tổng tiền</p><p className={styles.bigValue}>{customerMoney(order.totalAmount)}</p></div>
         </div>
         {canCancelCustomerOrder(order.status) && <div className={styles.cancelArea}>
           <p className={styles.muted}>Bạn chỉ hủy được khi đơn còn chờ thanh toán.</p>
           <button className={styles.dangerButton} disabled={canceling} onClick={() => void cancelOrder()}>{canceling ? "Đang xử lý…" : "Hủy đơn"}</button>
         </div>}
         {cancelMessage && <p role="status" className={styles.message}>{cancelMessage}</p>}
       </section>
       <section className={styles.panel}>
         <h2 className={styles.sectionTitle}>Sản phẩm đã đặt</h2>
         <ul className={styles.items}>{order.items.map((item, index) => <li className={styles.item} key={`${index}-${item.productId ?? item.productName}`}>
           <div><strong>{item.productName}</strong>
             <p className={styles.muted}>{[item.sizeName ? `Size ${item.sizeName}` : "", `SL: ${item.quantity}`].filter(Boolean).join(" · ")}</p>
             {!!item.toppings?.length && <p className={styles.muted}>Topping: {item.toppings.map(t => t.name).join(", ")}</p>}
           </div>
           <strong>{item.lineTotal === undefined ? "—" : customerMoney(item.lineTotal)}</strong>
         </li>)}</ul>
       </section>
       {order.status === "PENDING_PAYMENT" && userId && <section className={styles.panel}>
         <PaymentPanel
           order={order}
           userId={userId}
           returnTo={`/orders/${id}`}
           onOrderUpdated={() => setRefresh(v => v + 1)}
         />
       </section>}
       {order.status === "CONFIRMED" && <section className={styles.panel}>
         <p role="status" className={styles.value}>Thanh toán thành công – đơn đã được xác nhận.</p>
       </section>}
       <section className={styles.panel}>
         <h2 className={styles.sectionTitle}>Theo dõi trạng thái</h2>
         <p>Trạng thái hiện tại: <strong>{customerStatusLabel(order.status)}</strong></p>
         <p className={styles.muted}>Nhấn Làm mới để xem thông tin mới nhất từ cửa hàng.</p>
       </section>
     </> : null}
  </div></main>;
}
