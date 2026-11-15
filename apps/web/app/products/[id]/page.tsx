import { Suspense } from "react";
import ProductDetailClient from "./ProductDetailClient";

type PageProps = {
  params: Promise<{ id: string }>;
};

async function ProductDetailContent({ params }: PageProps) {
  const { id } = await params;
  return <ProductDetailClient id={id} />;
}

export default function Page({ params }: PageProps) {
  return (
    <Suspense fallback={
      <main role="status" className="grid min-h-screen place-items-center bg-[#FFF9E9] text-[#244A16]">
        Đang tải chi tiết sản phẩm...
      </main>
    }>
      <ProductDetailContent params={params} />
    </Suspense>
  );
}
