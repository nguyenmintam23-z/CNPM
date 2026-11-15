"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  cartTotal, changeCartQuantity, maxQuantityForItem, removeCartItem,
  saveCart, unitPrice, useCartItems,
} from "../../lib/cart";
import { formatVnd } from "../../lib/product";

type SessionState = "checking" | "authenticated" | "error";

export default function CartPage() {
  const router = useRouter();
  const items = useCartItems();
  const [session, setSession] = useState<SessionState>("checking");
  const [retry, setRetry] = useState(0);
  const [storageError, setStorageError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    async function checkSession() {
      try {
        const result = await fetch("/api/auth/me", {
          method: "GET", credentials: "same-origin", cache: "no-store", signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        if (result.status === 401) { router.replace("/login?next=%2Fcart"); return; }
        setSession(result.ok ? "authenticated" : "error");
      } catch {
        if (!controller.signal.aborted) setSession("error");
      }
    }
    void checkSession();
    return () => controller.abort();
  }, [router, retry]);

  function update(nextItems: typeof items) {
    if (!saveCart(nextItems)) setStorageError("Không thể lưu thay đổi giỏ hàng. Hãy kiểm tra bộ nhớ trình duyệt.");
    else setStorageError("");
  }

  if (session === "checking") {
    return <main role="status" className="grid min-h-screen place-items-center bg-[#FFF9E9] text-[#244A16]">Đang kiểm tra phiên đăng nhập...</main>;
  }
  if (session === "error") {
    return <main className="grid min-h-screen place-items-center bg-[#FFF9E9] px-4 text-center"><section><h1 className="text-2xl font-bold text-[#173B20]">Không thể kiểm tra phiên đăng nhập</h1><button onClick={() => { setSession("checking"); setRetry((n) => n + 1); }} className="mt-5 font-bold text-[#244A16] underline">Thử lại</button></section></main>;
  }

  return (
    <main className="min-h-screen bg-[#FFF1C7] px-4 py-8 text-[#173B20] sm:px-7 lg:py-12">
      <div className="mx-auto max-w-5xl">
        <div className="flex items-center justify-between gap-4">
          <Link href="/#menu" className="text-sm font-semibold text-[#244A16] hover:underline">← Tiếp tục chọn món</Link>
          <span className="text-sm font-semibold text-[#668449]">BrewLite</span>
        </div>
        <h1 className="mt-7 font-display text-3xl font-bold sm:text-4xl">Giỏ hàng của bạn</h1>
        <p className="mt-2 text-sm text-[#61705b]">Các lựa chọn được lưu trên trình duyệt này và giữ lại khi phiên đăng nhập hết hạn.</p>
        {storageError && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{storageError}</p>}
        {items.length === 0 ? (
          <section className="mt-8 rounded-[28px] bg-[#fffdf7] px-6 py-16 text-center shadow-sm">
            <h2 className="text-2xl font-bold">Giỏ hàng đang trống</h2>
            <p className="mt-2 text-[#61705b]">Hãy chọn thức uống bạn yêu thích từ thực đơn.</p>
            <Link href="/#menu" className="mt-6 inline-block rounded-xl bg-[#244A16] px-6 py-3 font-semibold text-white">Xem thực đơn</Link>
          </section>
        ) : (
          <div className="mt-7 grid gap-6 lg:grid-cols-[1fr_290px] lg:items-start">
            <section aria-label="Các món trong giỏ" className="space-y-4">
              {items.map((item) => {
                const max = maxQuantityForItem(items, item.key);
                return (
                  <article key={item.key} className="rounded-[24px] border border-[#e8e2cf] bg-[#fffdf7] p-5 shadow-sm sm:p-6">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <h2 className="text-xl font-bold">{item.productName}</h2>
                        <p className="mt-2 text-sm text-[#61705b]">Size: {item.sizeName ?? "Không áp dụng"}</p>
                        <p className="mt-1 text-sm text-[#61705b]">Topping: {item.toppings.length ? item.toppings.map((t) => t.name).join(", ") : "Không chọn"}</p>
                        <p className="mt-2 font-semibold text-[#244A16]">Đơn giá: {formatVnd(unitPrice(item))}</p>
                      </div>
                      <button type="button" onClick={() => update(removeCartItem(items, item.key))} className="text-sm font-semibold text-[#a33f2c] underline">Xóa món</button>
                    </div>
                    <div className="mt-5 flex flex-wrap items-center justify-between gap-4 border-t border-[#eeeadb] pt-4">
                      <div className="flex items-center gap-4" aria-label={`Số lượng ${item.productName}`}>
                        <button type="button" aria-label={`Giảm ${item.productName}`} disabled={item.quantity <= 1} onClick={() => update(changeCartQuantity(items, item.key, item.quantity - 1))} className="rounded-lg border px-3 py-1.5 disabled:opacity-40">−</button>
                        <output aria-live="polite" className="font-semibold">{item.quantity}</output>
                        <button type="button" aria-label={`Tăng ${item.productName}`} disabled={item.quantity >= max} onClick={() => update(changeCartQuantity(items, item.key, item.quantity + 1))} className="rounded-lg border px-3 py-1.5 disabled:opacity-40">+</button>
                      </div>
                      <p className="font-bold text-[#244A16]">{formatVnd(unitPrice(item) * item.quantity)}</p>
                    </div>
                  </article>
                );
              })}
            </section>
            <aside className="rounded-[24px] border border-[#e8e2cf] bg-[#fffdf7] p-6 shadow-sm">
              <h2 className="text-xl font-bold">Tổng kết giỏ hàng</h2>
              <div className="mt-4 flex justify-between gap-4 border-b border-[#eeeadb] pb-4 font-bold"><span>Tạm tính</span><span className="text-[#244A16]">{formatVnd(cartTotal(items))}</span></div>
              <p className="mt-4 text-xs leading-5 text-[#61705b]">Giá, size/topping và tồn kho sẽ được Backend xác nhận lại khi tạo đơn.</p>
              <p className="mt-5 rounded-xl bg-[#eef2e5] p-3 text-sm text-[#244A16]">Checkout sẽ được tích hợp sau khi Duy cung cấp hợp đồng API tạo đơn.</p>
              <button type="button" disabled className="mt-4 w-full cursor-not-allowed rounded-xl bg-[#244A16] px-4 py-3 font-semibold text-white opacity-50">Thanh toán (chưa khả dụng)</button>
            </aside>
          </div>
        )}
      </div>
    </main>
  );
}
