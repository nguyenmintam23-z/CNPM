import { Suspense } from "react";
import StaffOrderDetailClient from "../../../../components/staff/StaffOrderDetailClient";

// Bọc useParams trong Suspense để tương thích Next.js 16 khi build.
export default function StaffOrderDetailPage() {
  return (
    <Suspense
      fallback={
        <main className="grid min-h-screen place-items-center bg-[#FFF1C7] text-[#244A16]" role="status">
          Đang mở chi tiết đơn hàng...
        </main>
      }
    >
      <StaffOrderDetailClient />
    </Suspense>
  );
}
