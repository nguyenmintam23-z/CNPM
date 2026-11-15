"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CART_ADDED_NOTICE_KEY, cartTotal, changeCartQuantity, maxQuantityForItem,
  removeCartItem, replaceCartItem, saveCart, unitPrice, useCartItems,
  userIdFromSession, MAX_TOPPINGS, type CartItem,
} from "../../lib/cart";
import { formatVnd, isProductDetail, type ProductDetail } from "../../lib/product";

type SessionState = "checking" | "authenticated" | "error";

export default function CartPage() {
  const router = useRouter();
  const [session, setSession] = useState<SessionState>("checking");
  const [userId, setUserId] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [detail, setDetail] = useState<ProductDetail | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [editSizeId, setEditSizeId] = useState<string | null>(null);
  const [editToppingIds, setEditToppingIds] = useState<string[]>([]);
  const items = useCartItems(userId);

  useEffect(() => {
    const controller = new AbortController();
    async function checkSession() {
      try {
        const response = await fetch("/api/auth/me", {
          method: "GET", credentials: "same-origin", cache: "no-store", signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        if (response.status === 401) { router.replace("/login?next=%2Fcart"); return; }
        if (!response.ok) { setSession("error"); return; }
        const payload: unknown = await response.json().catch(() => null);
        if (controller.signal.aborted) return;
        const id = userIdFromSession(payload);
        if (!id) { setSession("error"); setError("Không xác định được tài khoản từ phiên đăng nhập."); return; }
        setUserId(id);
        setSession("authenticated");
        try {
          const msg = window.sessionStorage.getItem(CART_ADDED_NOTICE_KEY);
          if (msg) { setNotice(msg); window.sessionStorage.removeItem(CART_ADDED_NOTICE_KEY); }
        } catch { /* Không ảnh hưởng khả năng sử dụng giỏ. */ }
      } catch { if (!controller.signal.aborted) setSession("error"); }
    }
    void checkSession();
    return () => controller.abort();
  }, [router, retry]);

  function update(nextItems: CartItem[]) {
    if (!saveCart(nextItems, userId)) setError("Không thể lưu giỏ hàng. Hãy kiểm tra bộ nhớ trình duyệt.");
    else { setError(""); setNotice("Đã cập nhật giỏ hàng."); }
  }

  async function beginEdit(item: CartItem) {
    setError(""); setNotice(""); setEditing(item.key); setDetail(null); setEditLoading(true);
    try {
      const response = await fetch(`/api/products/${encodeURIComponent(item.productId)}`, {
        credentials: "same-origin", cache: "no-store",
      });
      if (response.status === 401) { router.replace("/login?next=%2Fcart"); return; }
      if (!response.ok) throw new Error("Không thể tải lựa chọn của sản phẩm. Vui lòng thử lại.");
      const payload: unknown = await response.json();
      if (!isProductDetail(payload)) throw new Error("Dữ liệu sản phẩm không đúng định dạng.");
      setDetail(payload);
      setEditSizeId(payload.sizes.some((size) => size.id === item.sizeId) ? item.sizeId : payload.sizes[0]?.id ?? null);
      setEditToppingIds(item.toppings.map((t) => t.id).filter((id) => payload.toppings.some((t) => t.id === id)).slice(0, MAX_TOPPINGS));
    } catch (err) { setError(err instanceof Error ? err.message : "Không thể mở chỉnh sửa."); }
    finally { setEditLoading(false); }
  }

  function toggleTopping(id: string) {
    if (editToppingIds.includes(id)) {
      setEditToppingIds(editToppingIds.filter((value) => value !== id));
      setError("");
    } else if (editToppingIds.length >= MAX_TOPPINGS) {
      setError(`Chỉ được chọn tối đa ${MAX_TOPPINGS} topping.`);
    } else {
      setEditToppingIds([...editToppingIds, id]);
      setError("");
    }
  }

  function saveEdit(item: CartItem) {
    if (!detail || !userId) return;
    const chosenSize = detail.sizes.find((size) => size.id === editSizeId);
    if (detail.sizes.length > 0 && !chosenSize) { setError("Vui lòng chọn size."); return; }
    const selection = {
      productId: detail.id, productName: detail.name, imageUrl: detail.imageUrl,
      basePrice: detail.basePrice, sizeId: chosenSize?.id ?? null,
      sizeName: chosenSize?.name ?? null, sizeExtraPrice: chosenSize?.extraPrice ?? 0,
      toppings: detail.toppings.filter((t) => editToppingIds.includes(t.id)),
      quantity: item.quantity, availableQuantity: detail.availableQuantity,
    };
    const result = replaceCartItem(items, item.key, selection);
    if (result.error) { setError(result.error); return; }
    if (!saveCart(result.items, userId)) { setError("Không thể lưu thay đổi giỏ hàng."); return; }
    setEditing(null); setDetail(null); setError(""); setNotice("Đã lưu thay đổi size và topping.");
  }

  if (session === "checking") return <main role="status" className="grid min-h-screen place-items-center bg-[#FFF9E9] text-[#244A16]">Đang kiểm tra phiên đăng nhập...</main>;
  if (session === "error") return (
    <main className="grid min-h-screen place-items-center bg-[#FFF9E9] px-4 text-center">
      <section><h1 className="text-2xl font-bold text-[#173B20]">Không thể kiểm tra tài khoản</h1>
        {error && <p role="alert" className="mt-3">{error}</p>}
        <button onClick={() => { setSession("checking"); setRetry((n) => n + 1); }} className="mt-5 font-bold text-[#244A16] underline">Thử lại</button>
      </section>
    </main>
  );

  return (
    <main className="min-h-screen bg-[#FFF1C7] px-4 py-8 text-[#173B20] sm:px-7 lg:py-12">
      <div className="mx-auto max-w-5xl">
        <div className="flex items-center justify-between gap-4">
          <Link href="/#menu" className="text-sm font-semibold text-[#244A16] hover:underline">← Tiếp tục chọn món</Link>
          <span className="text-sm font-semibold text-[#668449]">BrewLite</span>
        </div>
        <h1 className="mt-7 font-display text-3xl font-bold sm:text-4xl">Giỏ hàng của bạn</h1>
        <p className="mt-2 text-sm text-[#61705b]">Giỏ hàng được lưu riêng cho tài khoản đang đăng nhập trên trình duyệt này.</p>
        {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {notice && <p role="status" className="mt-4 rounded-xl bg-[#eaf0dd] p-3 text-sm font-semibold text-[#244A16]">{notice}</p>}
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
                const isEditing = editing === item.key;
                return (
                  <article key={item.key} className="rounded-[24px] border border-[#e8e2cf] bg-[#fffdf7] p-5 shadow-sm sm:p-6">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <h2 className="text-xl font-bold">{item.productName}</h2>
                        <p className="mt-2 text-sm text-[#61705b]">Size: {item.sizeName ?? "Không áp dụng"}</p>
                        <p className="mt-1 text-sm text-[#61705b]">Topping: {item.toppings.length ? item.toppings.map((t) => t.name).join(", ") : "Không chọn"}</p>
                        <p className="mt-2 font-semibold text-[#244A16]">Đơn giá: {formatVnd(unitPrice(item))}</p>
                      </div>
                      <div className="flex gap-4">
                        <button type="button" onClick={() => void beginEdit(item)} className="text-sm font-semibold text-[#244A16] underline">Chỉnh sửa</button>
                        <button type="button" onClick={() => { update(removeCartItem(items, item.key)); if (isEditing) setEditing(null); }} className="text-sm font-semibold text-[#a33f2c] underline">Xóa món</button>
                      </div>
                    </div>
                    {isEditing && (
                      <section aria-label={`Chỉnh sửa ${item.productName}`} className="mt-5 rounded-xl border border-[#cbd5b8] bg-[#f7f9f1] p-4">
                        {editLoading && <p role="status">Đang tải lựa chọn...</p>}
                        {!editLoading && detail && (
                          <>
                            {detail.sizes.length > 0 && (
                              <fieldset><legend className="font-semibold">Đổi size</legend><div className="mt-2 flex flex-wrap gap-4">
                                {detail.sizes.map((size) => <label key={size.id} className="flex items-center gap-2 text-sm">
                                  <input type="radio" name={`edit-size-${item.key}`} checked={editSizeId === size.id} onChange={() => setEditSizeId(size.id)} />
                                  {size.name} (+{formatVnd(size.extraPrice)})
                                </label>)}
                              </div></fieldset>
                            )}
                            <fieldset className="mt-4"><legend className="font-semibold">Đổi topping (tối đa {MAX_TOPPINGS})</legend>
                              {detail.toppings.length === 0 ? <p className="mt-2 text-sm">Món này không có topping.</p> :
                                <div className="mt-2 grid gap-2">{detail.toppings.map((topping) => <label key={topping.id} className="flex items-center gap-2 text-sm">
                                  <input type="checkbox" checked={editToppingIds.includes(topping.id)} onChange={() => toggleTopping(topping.id)} />
                                  {topping.name} (+{formatVnd(topping.price)})
                                </label>)}</div>}
                            </fieldset>
                            <div className="mt-5 flex flex-wrap gap-3">
                              <button type="button" onClick={() => saveEdit(item)} className="rounded-xl bg-[#244A16] px-4 py-2 font-semibold text-white">Lưu thay đổi</button>
                              <button type="button" onClick={() => { setEditing(null); setDetail(null); setError(""); }} className="rounded-xl border px-4 py-2">Hủy</button>
                            </div>
                          </>
                        )}
                      </section>
                    )}
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
              <p className="mt-4 text-xs leading-5 text-[#61705b]">Giá và tồn kho sẽ được Backend xác nhận lại khi tạo đơn.</p>
              <button type="button" disabled className="mt-5 w-full cursor-not-allowed rounded-xl bg-[#244A16] px-4 py-3 font-semibold text-white opacity-50">Tiếp tục đặt đơn (sắp có)</button>
            </aside>
          </div>
        )}
      </div>
    </main>
  );
}
