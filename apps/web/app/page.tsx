"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import FigmaProductMenu, { type Product } from "../components/menu/FigmaProductMenu";

type ErrorPayload = { message?: string | string[] };

function errorText(payload: unknown, fallback: string) {
  if (!payload || typeof payload !== "object" || !("message" in payload)) return fallback;
  const message = (payload as ErrorPayload).message;
  if (typeof message === "string" && message.trim()) return message;
  if (Array.isArray(message)) return message.filter((x) => typeof x === "string").join(". ") || fallback;
  return fallback;
}

export default function Home() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [sessionVerified, setSessionVerified] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const goToLogin = useCallback(() => {
    // Do NOT clear cart, sessionStorage, or localStorage here.
    router.replace("/login?next=%2F");
  }, [router]);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setError("");
      setSessionVerified(false);
      try {
        // Check the HttpOnly-cookie session before requesting protected products.
        const me = await fetch("/api/auth/me", {
          cache: "no-store", credentials: "same-origin", signal: controller.signal,
        });
        if (me.status === 401) { if (!controller.signal.aborted) goToLogin(); return; }
        if (!me.ok) throw new Error("Không thể kiểm tra phiên đăng nhập.");
        if (!controller.signal.aborted) setSessionVerified(true);

        const response = await fetch("/api/products", {
          cache: "no-store", credentials: "same-origin", signal: controller.signal,
        });
        if (response.status === 401) { if (!controller.signal.aborted) goToLogin(); return; }
        const payload: unknown = await response.json().catch(() => null);
        if (!response.ok) throw new Error(errorText(payload, "Không thể tải danh sách thức uống."));
        if (!Array.isArray(payload)) throw new Error("Dữ liệu sản phẩm không đúng định dạng.");
        if (!controller.signal.aborted) setProducts(payload as Product[]);
      } catch (err) {
        if (!controller.signal.aborted) setError(err instanceof Error ? err.message : "Không thể tải thực đơn.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [retry, goToLogin]);

  async function handleLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    setError("");
    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST", credentials: "same-origin", cache: "no-store",
      });
      if (!response.ok) throw new Error("Không thể đăng xuất. Vui lòng thử lại.");
      setSessionVerified(false);
      setProducts([]);
      // Do not touch cart state or browser storage.
      router.replace("/login");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể đăng xuất.");
    } finally {
      setLoggingOut(false);
    }
  }

  // Before /me is verified, render only the neutral loading UI, never menu content.
  if (!sessionVerified && !error) {
    return <main className="grid min-h-screen place-items-center bg-[#FFF9E9] text-[#244A16]" role="status">Đang kiểm tra phiên đăng nhập...</main>;
  }

  return (
    <FigmaProductMenu
      products={products}
      isAuthenticated={sessionVerified}
      isLoading={loading || loggingOut}
      error={error || undefined}
      onRetry={() => setRetry((value) => value + 1)}
      onLogout={handleLogout}
    />
  );
}
