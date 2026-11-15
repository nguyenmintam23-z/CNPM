"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  isManagerOrderDetail,
  managerApiError,
  managerDate,
  managerMoney,
  managerPaymentLabel,
  managerPaymentMethodLabel,
  managerRole,
  managerStatusLabel,
  type ManagerOrderDetail as Detail,
} from "../../lib/manager-orders";
import styles from "./ManagerOrders.module.css";
import ManagerHeaderActions from "./ManagerHeaderActions";

type ViewState = "loading" | "ready" | "denied" | "error";

export default function ManagerOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const [state, setState] = useState<ViewState>("loading");
  const [order, setOrder] = useState<Detail | null>(null);
  const [message, setMessage] = useState("");
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    async function loadDetail() {
      setState("loading");
      setOrder(null);
      setMessage("");
      try {
        const auth = await fetch("/api/auth/me", {
          cache: "no-store", signal: controller.signal,
        });
        const session: unknown = await auth.json().catch(() => null);
        if (controller.signal.aborted) return;
        if (auth.status === 401 || auth.status === 403 ||
            (auth.ok && managerRole(session) !== "MANAGER")) {
          setState("denied");
          return;
        }
        if (!auth.ok) throw new Error("Không thể kiểm tra phiên đăng nhập.");

        const response = await fetch(`/api/manager/orders/${encodeURIComponent(id)}`, {
          cache: "no-store", signal: controller.signal,
        });
        const payload: unknown = await response.json().catch(() => null);
        if (controller.signal.aborted) return;
        if (response.status === 401 || response.status === 403) {
          setState("denied");
          return;
        }
        if (!response.ok) {
          throw new Error(managerApiError(response.status, payload, "Không thể tải chi tiết đơn hàng."));
        }
        if (!isManagerOrderDetail(payload)) {
          throw new Error("Dữ liệu chi tiết đơn hàng không đúng định dạng.");
        }
        setOrder(payload);
        setState("ready");
      } catch (error) {
        if (!controller.signal.aborted) {
          setMessage(error instanceof Error ? error.message : "Không thể tải đơn hàng.");
          setState("error");
        }
      }
    }
    void loadDetail();
    return () => controller.abort();
  }, [id, refresh]);

  return (
    <main className={styles.shell}>
      <Link className={styles.link} href="/manager/orders">← Quay lại danh sách</Link>
      <div className={styles.heading}>
        <div>
          <p className={styles.eyebrow}>BREWLITE · MANAGER</p>
          <h1 className={styles.title}>Chi tiết đơn hàng</h1>
        </div>
        {(state === "ready" || state === "error") && (
          <ManagerHeaderActions
            onRefresh={() => setRefresh(n => n + 1)}
          />
        )}
      </div>
      {state === "loading" && <p className={styles.message} role="status">Đang tải chi tiết đơn…</p>}
      {state === "denied" && (
        <div className={styles.panel}>
          <p className={styles.message} role="alert">Chỉ tài khoản MANAGER mới được xem chi tiết đơn hàng.</p>
          <p className={styles.message}><Link className={styles.link} href="/login">Đến trang đăng nhập</Link></p>
        </div>
      )}
      {state === "error" && (
        <div className={styles.panel}>
          <p className={styles.message} role="alert">{message}</p>
          <div className={styles.actionArea}>
            <button className={styles.button} onClick={() => setRefresh(n => n + 1)}>Thử lại</button>
          </div>
        </div>
      )}
      {state === "ready" && order && (
        <>
          <section className={styles.panel} aria-labelledby="manager-order-info">
            <div className={styles.sectionHeader}>
              <h2 id="manager-order-info" className={styles.sectionTitle}>{order.orderCode}</h2>
              <span className={styles.chip}>{managerStatusLabel(order.status)}</span>
            </div>
            <dl className={styles.infoGrid}>
              <div><dt>Ngày tạo</dt><dd>{managerDate(order.createdAt)}</dd></div>
              <div><dt>Tổng tiền</dt><dd className={styles.total}>{managerMoney(order.totalAmount)}</dd></div>
            </dl>
          </section>

          <section className={styles.panel} aria-labelledby="manager-order-items">
            <h2 id="manager-order-items" className={styles.sectionTitle}>Sản phẩm đã đặt</h2>
            {order.items.length === 0 ? <p className={styles.muted}>Không có sản phẩm.</p> : (
              <ul className={styles.itemList}>
                {order.items.map((item, index) => (
                  <li className={styles.itemRow} key={`${item.productId ?? item.productName}-${index}`}>
                    <div>
                      <strong>{item.productName}</strong>
                      <span className={styles.muted}>
                        {item.sizeName ? ` · Size ${item.sizeName}` : ""} · SL: {item.quantity}
                      </span>
                      {!!item.toppings?.length && (
                        <span className={styles.muted}>Topping: {item.toppings.map(t => t.name).join(", ")}</span>
                      )}
                    </div>
                    <strong>{typeof item.lineTotal === "number" ? managerMoney(item.lineTotal) : "—"}</strong>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className={styles.panel} aria-labelledby="manager-order-payments">
            <h2 id="manager-order-payments" className={styles.sectionTitle}>Lịch sử thanh toán</h2>
            <p className={styles.muted}>Các lần thanh toán được hiển thị theo thứ tự cũ đến mới.</p>
            {order.payments.length === 0 ? (
              <p className={styles.message}>Đơn hàng chưa có lần thanh toán nào.</p>
            ) : (
              <div className={styles.tableScroll}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th scope="col">Phương thức</th>
                      <th scope="col">Trạng thái</th>
                      <th scope="col" className={styles.alignRight}>Số tiền</th>
                      <th scope="col">Ngày tạo</th>
                      <th scope="col">Hoàn tất</th>
                      <th scope="col">Lý do thất bại</th>
                    </tr>
                  </thead>
                  <tbody>
                    {order.payments.map(payment => (
                      <tr key={payment.id}>
                        <td>{managerPaymentMethodLabel(payment.method)}</td>
                        <td><span className={payment.status === "FAILED" ? styles.failed : ""}>
                          {managerPaymentLabel(payment.status)}
                        </span></td>
                        <td className={styles.alignRight}>{managerMoney(payment.amount)}</td>
                        <td>{managerDate(payment.createdAt)}</td>
                        <td>{managerDate(payment.completedAt)}</td>
                        <td>{payment.status === "FAILED" ? (payment.failureReason || "Không có thông tin") : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}
