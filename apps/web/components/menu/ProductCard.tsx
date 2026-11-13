
import Image from "next/image";

// Kiểu dữ liệu theo hợp đồng API Product Sprint 1
export type Product = {
  id: string;
  name: string;
  basePrice: number;
  imageUrl: string | null;
  availableQuantity: number;
};

type ProductCardProps = {
  product: Product;
};

export default function ProductCard({
  product,
}: ProductCardProps) {
  const isOutOfStock = product.availableQuantity === 0;

  const formattedPrice = new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(product.basePrice);

  return (
    <article className="overflow-hidden rounded-xl bg-white p-5 shadow-sm">
      {/* Ảnh sản phẩm */}
      <div className="relative mb-4 flex h-36 items-center justify-center overflow-hidden rounded-lg bg-amber-100">
        {product.imageUrl ? (
          <Image
            src={product.imageUrl}
            alt={product.name}
            fill
            unoptimized
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover"
          />
        ) : (
          <span className="text-sm text-amber-800">
            Chưa có ảnh
          </span>
        )}
      </div>

      {/* Tên sản phẩm */}
      <h2 className="text-lg font-semibold text-gray-900">
        {product.name}
      </h2>

      {/* Giá gốc - VND */}
      <p className="mt-2 font-medium text-amber-800">
        {formattedPrice}
      </p>

      {/* Trạng thái hết hàng */}
      {isOutOfStock && (
        <p className="mt-2 font-semibold text-red-700">
          Hết hàng
        </p>
      )}
    </article>
  );
}
