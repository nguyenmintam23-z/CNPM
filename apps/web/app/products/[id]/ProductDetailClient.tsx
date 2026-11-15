"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { addCartItem, readCart, saveCart, MAX_QUANTITY, MAX_TOPPINGS, CART_ADDED_NOTICE_KEY, userIdFromSession } from "../../../lib/cart";
import { formatVnd, isProductDetail, type ProductDetail } from "../../../lib/product";

type PageState = "loading" | "ready" | "not-found" | "error";

export default function ProductDetailClient({ id }: { id: string }) {
  const router = useRouter();
  const [state, setState] = useState<PageState>("loading");
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [sizeId, setSizeId] = useState<string | null>(null);
  const [toppingIds, setToppingIds] = useState<string[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [retry, setRetry] = useState(0);
  const [notice, setNotice] = useState("");
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setState("loading");
      setNotice("");
      setProduct(null);
      try {
        const me = await fetch("/api/auth/me", { method: "GET", credentials: "same-origin", cache: "no-store", signal: controller.signal });
        if (controller.signal.aborted) return;
        if (me.status === 401) { router.replace(`/login?next=${encodeURIComponent(`/products/${id}`)}`); return; }
        if (!me.ok) { setState("error"); return; }
        const identity = userIdFromSession(await me.json().catch(() => null));
        if (!identity) { setState("error"); return; }
        setUserId(identity);
        const response = await fetch(`/api/products/${encodeURIComponent(id)}`, {
          method: "GET", credentials: "same-origin", cache: "no-store", signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        if (response.status === 401) {
          router.replace(`/login?next=${encodeURIComponent(`/products/${id}`)}`);
          return;
        }
        if (response.status === 400 || response.status === 404) { setState("not-found"); return; }
        if (!response.ok) { setState("error"); return; }
        const payload: unknown = await response.json().catch(() => null);
        if (!isProductDetail(payload)) { setState("error"); return; }
        setProduct(payload);
        setSizeId(payload.sizes[0]?.id ?? null);
        setToppingIds([]);
        setQuantity(1);
        setState("ready");
      } catch {
        if (!controller.signal.aborted) setState("error");
      }
    }
    void load();
    return () => controller.abort();
  }, [id, retry, router]);

  const chosenSize = product?.sizes.find((size) => size.id === sizeId);
  const chosenToppings = useMemo(
    () => product?.toppings.filter((topping) => toppingIds.includes(topping.id)) ?? [],
    [product, toppingIds]
  );
  const unit = (product?.basePrice ?? 0) + (chosenSize?.extraPrice ?? 0) +
    chosenToppings.reduce((sum, topping) => sum + topping.price, 0);

  function toggleTopping(idToToggle: string) {
    if (toppingIds.includes(idToToggle)) {
      setToppingIds(toppingIds.filter((value) => value !== idToToggle));
      setNotice("");
    } else if (toppingIds.length >= MAX_TOPPINGS) {
      setNotice(`Bạn chỉ được chọn tối đa ${MAX_TOPPINGS} topping.`);
    } else {
      setToppingIds([...toppingIds, idToToggle]);
      setNotice("");
    }
  }

  function addToCart() {
    if (!product || product.availableQuantity <= 0 || !userId) return;
    const result = addCartItem(readCart(userId), {
      productId: product.id,
      productName: product.name,
      imageUrl: product.imageUrl,
      basePrice: product.basePrice,
      sizeId,
      sizeName: chosenSize?.name ?? null,
      sizeExtraPrice: chosenSize?.extraPrice ?? 0,
      toppings: chosenToppings,
      quantity,
      availableQuantity: product.availableQuantity,
    });
    if (result.error) { setNotice(result.error); return; }
    if (!saveCart(result.items, userId)) { setNotice("Không thể lưu giỏ hàng trên trình duyệt này."); return; }
    setNotice("Đã thêm món vào giỏ hàng.");
    try { window.sessionStorage.setItem(CART_ADDED_NOTICE_KEY, "Đã thêm món vào giỏ hàng."); } catch { /* Không lưu được thông báo không ảnh hưởng món đã thêm. */ }
    router.push("/cart");
  }

  if (state === "loading") {
    return <main role="status" className="grid min-h-screen place-items-center bg-[#FFF9E9] text-[#244A16]">Đang tải chi tiết sản phẩm...</main>;
  }
  if (state !== "ready" || !product) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#FFF9E9] px-5 text-center text-[#173B20]">
        <section>
          <h1 className="text-2xl font-bold">{state === "not-found" ? "Sản phẩm không tồn tại" : "Không thể tải chi tiết sản phẩm"}</h1>
          <div className="mt-5 flex justify-center gap-5">
            <Link href="/#menu" className="font-semibold underline">Về thực đơn</Link>
            {state !== "not-found" && <button onClick={() => setRetry((v) => v + 1)} className="font-semibold underline">Thử lại</button>}
          </div>
        </section>
      </main>
    );
  }

  const available = product.availableQuantity > 0;
  const image = product.imageUrl && !product.imageUrl.includes("placeholder.com") ? product.imageUrl : null;
  const max = Math.min(MAX_QUANTITY, product.availableQuantity);

  return (
    <main className="min-h-screen bg-[#FFF1C7] px-4 py-8 text-[#173B20] sm:px-7 lg:py-12">
      <div className="mx-auto max-w-6xl">
        <nav className="mb-7 flex flex-wrap items-center justify-between gap-3 text-sm font-semibold text-[#244A16]">
          <Link href="/#menu" className="hover:underline">← Về thực đơn</Link>
          <Link href="/cart" className="rounded-xl border border-[#9eae8b] px-4 py-2 hover:bg-white">Giỏ hàng</Link>
        </nav>
        <div className="grid overflow-hidden rounded-[30px] bg-[#fffdf7] shadow-[0_12px_45px_rgba(36,74,22,0.10)] md:grid-cols-2">
          <div className="aspect-square bg-[#eaeedc] md:aspect-auto md:min-h-[540px]">
            {image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={image} alt={product.name} className="h-full w-full object-cover" />
            ) : <div className="grid h-full min-h-72 place-items-center text-[#65725a]">Chưa có ảnh</div>}
          </div>
          <div className="p-6 sm:p-9 lg:p-12">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#6f865d]">BrewLite · Thức uống Việt</p>
            <h1 className="mt-3 font-display text-3xl font-bold sm:text-4xl">{product.name}</h1>
            <p className="mt-4 leading-7 text-[#61705b]">{product.description || "Thức uống BrewLite."}</p>
            <p className="mt-4 text-xl font-bold text-[#244A16]">Giá gốc: {formatVnd(product.basePrice)}</p>
            {!available && <p role="status" className="mt-4 font-bold text-[#a33f2c]">Hết hàng – hiện không thể thêm vào giỏ.</p>}

            {product.sizes.length > 0 && (
              <fieldset className="mt-7" disabled={!available}>
                <legend className="text-base font-bold">Chọn size</legend>
                <div className="mt-3 flex flex-wrap gap-3">
                  {product.sizes.map((size) => (
                    <label key={size.id} className={`cursor-pointer rounded-xl border px-4 py-3 text-sm font-semibold disabled:opacity-50 ${size.id === sizeId ? "border-[#244A16] bg-[#244A16] text-white" : "border-[#cbd5b8] bg-white text-[#244A16]"}`}>
                      <input type="radio" name="size" value={size.id} checked={sizeId === size.id} onChange={() => setSizeId(size.id)} className="sr-only" />
                      {size.name} {size.extraPrice > 0 ? `(+${formatVnd(size.extraPrice)})` : ""}
                    </label>
                  ))}
                </div>
              </fieldset>
            )}
            {product.toppings.length > 0 && (
              <fieldset className="mt-7" disabled={!available}>
                <legend className="text-base font-bold">Chọn topping</legend>
                <div className="mt-3 space-y-2">
                  {product.toppings.map((topping) => (
                    <label key={topping.id} className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-[#d8dfca] bg-white px-4 py-3 text-sm">
                      <span className="flex items-center gap-3"><input type="checkbox" className="size-4 accent-[#244A16]" checked={toppingIds.includes(topping.id)} onChange={() => toggleTopping(topping.id)} />{topping.name}</span>
                      <span>+{formatVnd(topping.price)}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            )}
            {available && (
              <section className="mt-7" aria-label="Số lượng">
                <h2 className="font-bold">Số lượng</h2>
                <div className="mt-3 flex items-center gap-5">
                  <button type="button" aria-label="Giảm số lượng" disabled={quantity <= 1} onClick={() => setQuantity((q) => Math.max(1, q - 1))} className="rounded-xl border border-[#cbd5b8] px-4 py-2 disabled:opacity-40">−</button>
                  <output className="font-bold" aria-live="polite">{quantity}</output>
                  <button type="button" aria-label="Tăng số lượng" disabled={quantity >= max} onClick={() => setQuantity((q) => Math.min(max, q + 1))} className="rounded-xl border border-[#cbd5b8] px-4 py-2 disabled:opacity-40">+</button>
                </div>
              </section>
            )}
            <div className="mt-7 border-t border-[#e8e2cf] pt-6">
              <div className="flex items-center justify-between gap-3 text-lg font-bold"><span>Tạm tính</span><span className="text-[#244A16]">{formatVnd(unit * quantity)}</span></div>
              <p className="mt-2 text-xs leading-5 text-[#65725a]">Giá và tồn kho cuối cùng sẽ do Backend kiểm tra khi đặt đơn.</p>
              {notice && <p role="alert" className="mt-3 text-sm font-semibold text-[#a33f2c]">{notice}</p>}
              <button type="button" disabled={!available || !userId} onClick={addToCart} className="mt-5 w-full rounded-2xl bg-[#244A16] px-5 py-3.5 font-bold text-white hover:bg-[#173B20] disabled:cursor-not-allowed disabled:opacity-45">Thêm vào giỏ hàng</button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
