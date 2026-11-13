
"use client";

import { useCallback, useEffect, useState } from "react";

import MenuStatus from "../components/menu/MenuStatus";
import ProductCard from "../components/menu/ProductCard";
import type { Product } from "../components/menu/ProductCard";

export default function Home() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  // Tải danh sách sản phẩm qua Next.js proxy
  useEffect(() => {
    const controller = new AbortController();

    async function fetchProducts() {
      try {
        const response = await fetch("/api/products", {
          method: "GET",
          credentials: "same-origin",
          cache: "no-store",
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error("Không thể tải danh sách sản phẩm");
        }

        const data: unknown = await response.json();

        if (!Array.isArray(data)) {
          throw new Error("Dữ liệu API không hợp lệ");
        }

        if (!controller.signal.aborted) {
          setProducts(data as Product[]);
          setError(false);
        }
      } catch {
        if (!controller.signal.aborted) {
          setError(true);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void fetchProducts();

    return () => {
      controller.abort();
    };
  }, [retryCount]);

  // Xử lý nút thử lại
  const loadProducts = useCallback(() => {
    setLoading(true);
    setError(false);
    setRetryCount((count) => count + 1);
  }, []);

  return (
    <main className="min-h-screen bg-amber-50 px-4 py-8">
      <div className="mx-auto max-w-5xl">
        {/* Tiêu đề */}
        <header className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-amber-900">
            BrewLite
          </h1>

          <p className="mt-2 text-amber-800">
            Menu đồ uống
          </p>
        </header>

        {/* Trạng thái loading */}
        {loading && (
          <div className="text-center">
            <MenuStatus status="loading" />
          </div>
        )}

        {/* Trạng thái error */}
        {!loading && error && (
          <div className="text-center">
            <MenuStatus
              status="error"
              onRetry={loadProducts}
            />
          </div>
        )}

        {/* Trạng thái empty */}
        {!loading && !error && products.length === 0 && (
          <div className="text-center">
            <MenuStatus status="empty" />
          </div>
        )}

        {/* Danh sách sản phẩm */}
        {!loading && !error && products.length > 0 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
