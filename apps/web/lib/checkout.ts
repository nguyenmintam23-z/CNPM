import {
  MAX_CART_LINES,
  MAX_QUANTITY,
  MAX_TOPPINGS,
  readCart,
  saveCart,
  type CartItem,
} from "./cart";

export type CheckoutItem = {
  productId: string;
  sizeId?: string;
  toppingIds?: string[];
  quantity: number;
};
export type CheckoutRequest = { requestId: string; items: CheckoutItem[] };
export type CheckoutLineIssue = {
  index: number;
  productId?: string;
  code?: string;
  message: string;
};
export type CheckoutShortage = {
  productId: string;
  name: string;
  requested: number;
  available: number;
  code?: string;
  message: string;
};
export type CheckoutError = {
  statusCode?: number;
  message?: string | string[];
  code?: string;
  lines?: CheckoutLineIssue[];
  shortages?: CheckoutShortage[];
};
export type CreatedOrder = {
  id: string;
  orderCode: string;
  requestId: string;
  status: string;
  stockHoldStatus: string;
  totalAmount: number;
  createdAt?: string;
  items: Array<{
    productId: string;
    productName: string;
    sizeName?: string | null;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
    toppings?: Array<{ id: string; name: string; price: number }>;
  }>;
};

export type SavedDraft = { fingerprint: string; requestId: string };
export type SavedOrder = { fingerprint: string; order: CreatedOrder };

// Cùng một tài khoản chỉ truy cập bản nháp và đơn của chính tài khoản đó.
export function checkoutStorageKey(userId: string, kind: "draft" | "order"): string {
  if (!userId.trim()) throw new Error("Thiếu mã tài khoản.");
  return `brewlite_checkout_${kind}_v2:${encodeURIComponent(userId)}`;
}

// Chỉ gửi lựa chọn, tuyệt đối không gửi giá và số lượng tồn từ trình duyệt.
export function checkoutItems(items: CartItem[]): CheckoutItem[] {
  return items.map((item) => ({
    productId: item.productId,
    ...(item.sizeId ? { sizeId: item.sizeId } : {}),
    ...(item.toppings.length
      ? { toppingIds: item.toppings.map((t) => t.id).sort() }
      : {}),
    quantity: item.quantity,
  }));
}

// Thứ tự dòng cũng được giữ để đối chiếu lỗi Backend theo chỉ số index.
export function checkoutFingerprint(items: CartItem[]): string {
  return JSON.stringify(checkoutItems(items));
}

export function validateCheckoutCart(items: CartItem[]): string | null {
  if (!items.length) return "Giỏ hàng đang trống.";
  if (items.length > MAX_CART_LINES) return `Đơn hàng chỉ có tối đa ${MAX_CART_LINES} dòng.`;
  for (const item of items) {
    if (!item.productId) return "Có món thiếu mã sản phẩm.";
    if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > MAX_QUANTITY)
      return `${item.productName} chỉ được chọn 1–${MAX_QUANTITY} ly mỗi dòng.`;
    if (item.toppings.length > MAX_TOPPINGS)
      return `${item.productName} chỉ được chọn tối đa ${MAX_TOPPINGS} topping.`;
    if (new Set(item.toppings.map((t) => t.id)).size !== item.toppings.length)
      return `${item.productName} có topping bị lặp.`;
    if (item.sizeName && !item.sizeId)
      return `${item.productName} chưa có size hợp lệ.`;
  }
  return null;
}

export function checkoutErrorText(value: unknown, fallback: string): string {
  if (!value || typeof value !== "object" || !("message" in value)) return fallback;
  const message = (value as CheckoutError).message;
  if (typeof message === "string" && message.trim()) return message;
  if (Array.isArray(message)) return message.filter((s) => typeof s === "string").join(". ") || fallback;
  return fallback;
}

export function isCheckoutError(value: unknown): value is CheckoutError {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isCreatedOrder(value: unknown): value is CreatedOrder {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const data = value as Partial<CreatedOrder>;
  return typeof data.id === "string" && typeof data.orderCode === "string" &&
    typeof data.requestId === "string" && typeof data.status === "string" &&
    typeof data.totalAmount === "number" && Number.isFinite(data.totalAmount) &&
    Array.isArray(data.items);
}

export function loadCheckoutRecord<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : null;
  } catch { return null; }
}

export function saveCheckoutRecord(key: string, value: unknown): boolean {
  if (typeof window === "undefined") return false;
  try { window.localStorage.setItem(key, JSON.stringify(value)); return true; }
  catch { return false; }
}

export function requestIdValid(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{8,64}$/.test(value);
}

// Chỉ dọn giỏ của đúng đơn vừa được hệ thống xác nhận thanh toán.
// Không xóa món mới thêm hoặc bản nháp của một đơn khác.
export function isPaidOrderStatus(status: string): boolean {
  return ["CONFIRMED", "PREPARING", "READY", "COMPLETED"].includes(status);
}

export function completePaidCheckout(userId: string, orderId: string, status: string): boolean {
  if (typeof window === "undefined" || !userId || !orderId || !isPaidOrderStatus(status)) return false;
  const saved = loadCheckoutRecord<SavedOrder>(checkoutStorageKey(userId, "order"));
  if (!saved || !isCreatedOrder(saved.order) || saved.order.id !== orderId ||
      typeof saved.fingerprint !== "string") return false;
  const items = readCart(userId);
  if (items.length === 0 || checkoutFingerprint(items) !== saved.fingerprint) return false;
  if (!saveCart([], userId)) return false;

  // Giữ bản ghi "order" để có thể tải lại trang xác nhận thanh toán.
  const draftKey = checkoutStorageKey(userId, "draft");
  const draft = loadCheckoutRecord<SavedDraft>(draftKey);
  if (draft?.fingerprint === saved.fingerprint) {
    try { window.localStorage.removeItem(draftKey); } catch { /* Không ảnh hưởng đơn đã thanh toán. */ }
  }
  return true;
}
