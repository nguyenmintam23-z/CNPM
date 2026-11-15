import { Suspense } from "react";
import CustomerOrderDetail from "../../../components/orders/CustomerOrderDetail";
import styles from "../../../components/orders/CustomerOrders.module.css";

type CustomerOrderDetailPageProps = {
  params: Promise<{ id: string }>;
};

async function CustomerOrderDetailContent({
  params,
}: CustomerOrderDetailPageProps) {
  const { id } = await params;
  return <CustomerOrderDetail id={id} />;
}

export default function CustomerOrderDetailPage({
  params,
}: CustomerOrderDetailPageProps) {
  return (
    <Suspense
      fallback={
        <main className={styles.page}>
          <div className={styles.container}>
            <section className={styles.panel}>
              <p role="status">Đang mở chi tiết đơn hàng…</p>
            </section>
          </div>
        </main>
      }
    >
      <CustomerOrderDetailContent params={params} />
    </Suspense>
  );
}
