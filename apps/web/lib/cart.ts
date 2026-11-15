import { useMemo, useSyncExternalStore } from "react";
import type { ProductTopping } from "./product";

// Dữ liệu giỏ chỉ chứa lựa chọn món, không chứa JWT hay cookie.
// Khóa cũ không có chủ sở hữu nên KHÔNG tự chuyển sang tài khoản mới.
export const CART_STORAGE_KEY = "brewlite_cart_v1";
export const MAX_QUANTITY = 20;
export const MAX_CART_LINES = 20;
export const MAX_TOPPINGS = 5;
export const CART_ADDED_NOTICE_KEY = "brewlite_cart_added_notice";
const CART_CHANGE_EVENT = "brewlite-cart-updated";

export type CartItem = {
  key: string;
  productId: string;
  productName: string;
  imageUrl: string | null;
  basePrice: number;
  sizeId: string | null;
  sizeName: string | null;
  sizeExtraPrice: number;
  toppings: ProductTopping[];
  quantity: number;
  // Số lượng tại lần lấy chi tiết; Backend sẽ kiểm tra lại khi đặt hàng.
  availableQuantity: number;
};
export type NewCartItem = Omit<CartItem, "key">;
export type AddResult = { items: CartItem[]; error?: string };

export function cartStorageKey(userId: string): string {
  if (!userId.trim()) throw new Error("Thiếu mã tài khoản.");
  return `brewlite_cart_v2:${encodeURIComponent(userId)}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// Tương thích các dạng phản hồi /auth/me thường gặp. Nếu không có ID ổn định,
// không đọc/ghi giỏ để tránh hiển thị dữ liệu thuộc tài khoản khác.
export function userIdFromSession(payload: unknown): string | null {
  if (!isRecord(payload)) return null;
  const user = isRecord(payload.user) ? payload.user : payload;
  const id = user.id ?? user.userId ?? user.sub;
  return typeof id === "string" && id.trim() ? id : null;
}

export function cartKey(productId: string, sizeId: string | null, toppingIds: string[]) {
  return JSON.stringify([productId, sizeId, [...new Set(toppingIds)].sort()]);
}
export function unitPrice(item: CartItem) {
  return item.basePrice + item.sizeExtraPrice + item.toppings.reduce((sum, t) => sum + t.price, 0);
}
export function cartTotal(items: CartItem[]) {
  return items.reduce((sum, item) => sum + unitPrice(item) * item.quantity, 0);
}
export function quantityOfProduct(items: CartItem[], productId: string) {
  return items.filter((item) => item.productId === productId).reduce((sum, item) => sum + item.quantity, 0);
}
export function maxQuantityForItem(items: CartItem[], key: string) {
  const item = items.find((row) => row.key === key);
  if (!item) return 0;
  return Math.max(0, Math.min(MAX_QUANTITY, item.availableQuantity - quantityOfProduct(items, item.productId) + item.quantity));
}

export function addCartItem(items: CartItem[], selection: NewCartItem): AddResult {
  if (!Number.isSafeInteger(selection.quantity) || selection.quantity < 1 || selection.quantity > MAX_QUANTITY)
    return { items, error: `Mỗi dòng chỉ được chọn từ 1 đến ${MAX_QUANTITY} ly.` };
  if (selection.toppings.length > MAX_TOPPINGS || new Set(selection.toppings.map((t) => t.id)).size !== selection.toppings.length)
    return { items, error: `Mỗi món chỉ được chọn tối đa ${MAX_TOPPINGS} topping khác nhau.` };
  const key = cartKey(selection.productId, selection.sizeId, selection.toppings.map((t) => t.id));
  const existing = items.find((item) => item.key === key);
  if (existing && existing.quantity + selection.quantity > MAX_QUANTITY)
    return { items, error: `Mỗi dòng chỉ được tối đa ${MAX_QUANTITY} ly.` };
  const cap = Math.max(0, Math.min(selection.availableQuantity, existing?.availableQuantity ?? selection.availableQuantity));
  if (quantityOfProduct(items, selection.productId) + selection.quantity > cap)
    return { items, error: "Số lượng vượt quá số món hiện có. Vui lòng giảm số lượng." };
  if (existing) return { items: items.map((item) => item.key === key ? { ...selection, key, quantity: item.quantity + selection.quantity, availableQuantity: cap } : item) };
  if (items.length >= MAX_CART_LINES) return { items, error: `Giỏ hàng chỉ được tối đa ${MAX_CART_LINES} dòng món.` };
  return { items: [...items, { ...selection, key }] };
}

export function replaceCartItem(items: CartItem[], oldKey: string, selection: NewCartItem): AddResult {
  if (!items.some((item) => item.key === oldKey)) return { items, error: "Không tìm thấy món cần sửa." };
  const withoutOld = items.filter((item) => item.key !== oldKey);
  const result = addCartItem(withoutOld, selection);
  return result.error ? { items, error: result.error } : result;
}

export function changeCartQuantity(items: CartItem[], key: string, quantity: number): CartItem[] {
  const max = maxQuantityForItem(items, key);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > max) return items;
  return items.map((item) => item.key === key ? { ...item, quantity } : item);
}
export function removeCartItem(items: CartItem[], key: string) {
  return items.filter((item) => item.key !== key);
}
const validPrice = (v: unknown): v is number => typeof v === "number" && Number.isSafeInteger(v) && v >= 0;
function validCartItem(value: unknown): value is CartItem {
  if (!isRecord(value)) return false;
  return typeof value.productId === "string" && !!value.productId &&
    typeof value.productName === "string" &&
    (value.imageUrl === null || typeof value.imageUrl === "string") &&
    validPrice(value.basePrice) &&
    (value.sizeId === null || typeof value.sizeId === "string") &&
    (value.sizeName === null || typeof value.sizeName === "string") &&
    validPrice(value.sizeExtraPrice) && validPrice(value.availableQuantity) &&
    Number.isInteger(value.quantity) && (value.quantity as number) >= 1 && (value.quantity as number) <= MAX_QUANTITY &&
    Array.isArray(value.toppings) && value.toppings.length <= MAX_TOPPINGS &&
    new Set(value.toppings.map((t: unknown) => isRecord(t) ? t.id : undefined)).size === value.toppings.length &&
    value.toppings.every((t: unknown) => isRecord(t) && typeof t.id === "string" && typeof t.name === "string" && validPrice(t.price));
}
export function parseCart(raw: string | null): CartItem[] {
  if (!raw) return [];
  try {
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    const result: CartItem[] = [];
    for (const value of data) {
      if (!validCartItem(value)) continue;
      const item = { ...value, key: cartKey(value.productId, value.sizeId, value.toppings.map((t) => t.id)) };
      const added = addCartItem(result, item);
      if (!added.error) result.splice(0, result.length, ...added.items);
    }
    return result;
  } catch { return []; }
}
export function readCart(userId?: string | null): CartItem[] {
  if (typeof window === "undefined" || !userId) return [];
  try { return parseCart(window.localStorage.getItem(cartStorageKey(userId))); }
  catch { return []; }
}
export function saveCart(items: CartItem[], userId?: string | null): boolean {
  if (typeof window === "undefined" || !userId) return false;
  try {
    window.localStorage.setItem(cartStorageKey(userId), JSON.stringify(items));
    window.dispatchEvent(new Event(CART_CHANGE_EVENT));
    return true;
  } catch { return false; }
}
function getSnapshot(userId?: string | null) {
  if (typeof window === "undefined" || !userId) return "[]";
  try { return window.localStorage.getItem(cartStorageKey(userId)) ?? "[]"; }
  catch { return "[]"; }
}
function subscribe(listener: () => void) {
  window.addEventListener("storage", listener);
  window.addEventListener(CART_CHANGE_EVENT, listener);
  return () => {
    window.removeEventListener("storage", listener);
    window.removeEventListener(CART_CHANGE_EVENT, listener);
  };
}
export function useCartItems(userId?: string | null) {
  const raw = useSyncExternalStore(subscribe, () => getSnapshot(userId), () => "[]");
  return useMemo(() => parseCart(raw), [raw]);
}
