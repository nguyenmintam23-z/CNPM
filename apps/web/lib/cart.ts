import { useMemo, useSyncExternalStore } from "react";
import type { ProductTopping } from "./product";

// Only cart selections are persisted. Never store JWT/cookies/credentials here.
export const CART_STORAGE_KEY = "brewlite_cart_v1";
export const MAX_QUANTITY = 99;
const MAX_CART_LINES = 100;
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
  // A snapshot from GET /products/:id, NOT authoritative at checkout.
  availableQuantity: number;
};

export type NewCartItem = Omit<CartItem, "key">;
export type AddResult = { items: CartItem[]; error?: string };

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
  const current = items.find((item) => item.key === key);
  if (!current) return 0;
  const otherVariants = quantityOfProduct(items, current.productId) - current.quantity;
  return Math.max(0, Math.min(MAX_QUANTITY, current.availableQuantity - otherVariants));
}

export function addCartItem(items: CartItem[], selection: NewCartItem): AddResult {
  if (!Number.isSafeInteger(selection.quantity) || selection.quantity < 1) {
    return { items, error: "Số lượng không hợp lệ." };
  }
  const stockCap = Math.min(MAX_QUANTITY, selection.availableQuantity);
  if (quantityOfProduct(items, selection.productId) + selection.quantity > stockCap) {
    return { items, error: "Số lượng vượt quá số món hiện có. Vui lòng giảm số lượng." };
  }
  const key = cartKey(selection.productId, selection.sizeId, selection.toppings.map((t) => t.id));
  const existing = items.find((item) => item.key === key);
  if (existing) {
    return {
      items: items.map((item) =>
        item.key === key ? { ...selection, key, quantity: item.quantity + selection.quantity } : item
      ),
    };
  }
  if (items.length >= MAX_CART_LINES) return { items, error: "Giỏ hàng đã đạt giới hạn số dòng món." };
  return { items: [...items, { ...selection, key }] };
}

export function changeCartQuantity(items: CartItem[], key: string, quantity: number): CartItem[] {
  const max = maxQuantityForItem(items, key);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > max) return items;
  return items.map((item) => item.key === key ? { ...item, quantity } : item);
}

export function removeCartItem(items: CartItem[], key: string) {
  return items.filter((item) => item.key !== key);
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const validPrice = (v: unknown): v is number =>
  typeof v === "number" && Number.isSafeInteger(v) && v >= 0;

function validCartItem(value: unknown): value is CartItem {
  if (!isRecord(value)) return false;
  return (
    typeof value.productId === "string" && value.productId.length > 0 &&
    typeof value.productName === "string" &&
    (value.imageUrl === null || typeof value.imageUrl === "string") &&
    validPrice(value.basePrice) &&
    (value.sizeId === null || typeof value.sizeId === "string") &&
    (value.sizeName === null || typeof value.sizeName === "string") &&
    validPrice(value.sizeExtraPrice) &&
    validPrice(value.availableQuantity) &&
    Number.isInteger(value.quantity) && (value.quantity as number) >= 1 && (value.quantity as number) <= MAX_QUANTITY &&
    Array.isArray(value.toppings) &&
    value.toppings.every((t: unknown) =>
      isRecord(t) && typeof t.id === "string" && typeof t.name === "string" && validPrice(t.price)
    )
  );
}

export function parseCart(raw: string | null): CartItem[] {
  if (!raw) return [];
  try {
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    const parsed = data.filter(validCartItem).slice(0, MAX_CART_LINES).map((item) => ({
      ...item,
      key: cartKey(item.productId, item.sizeId, item.toppings.map((t) => t.id)),
    }));
    // Skip duplicate/corrupt selections rather than rendering the same row twice.
    return parsed.filter((item, index) => parsed.findIndex((row) => row.key === item.key) === index);
  } catch {
    return [];
  }
}

export function readCart(): CartItem[] {
  if (typeof window === "undefined") return [];
  try { return parseCart(window.localStorage.getItem(CART_STORAGE_KEY)); }
  catch { return []; }
}

export function saveCart(items: CartItem[]): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
    window.dispatchEvent(new Event(CART_CHANGE_EVENT));
    return true;
  } catch { return false; }
}

function getSnapshot() {
  if (typeof window === "undefined") return "[]";
  try { return window.localStorage.getItem(CART_STORAGE_KEY) ?? "[]"; }
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

// SSR-safe: the server renders an empty cart, then React reads browser storage.
export function useCartItems() {
  const raw = useSyncExternalStore(subscribe, getSnapshot, () => "[]");
  return useMemo(() => parseCart(raw), [raw]);
}
