import { Suspense } from "react";
import ManagerOrderDetail from "../../../../components/manager/ManagerOrderDetail";
import styles from "../../../../components/manager/ManagerOrders.module.css";

export default function ManagerOrderDetailPage() {
  return (
    <Suspense
      fallback={
        <main className={styles.shell}>
          <p role="status">Đang mở chi tiết đơn hàng…</p>
        </main>
      }
    >
      <ManagerOrderDetail />
    </Suspense>
  );
}
