/** FR-08/23/24 — dữ liệu đơn hàng của khách. Không tin các trường giá do client gửi. */
export const CUSTOMER_STATUSES = [
  "PENDING_PAYMENT", "CONFIRMED", "PREPARING", "READY", "COMPLETED", "CANCELLED",
] as const;
export type CustomerOrderStatus = (typeof CUSTOMER_STATUSES)[number];

export type CustomerOrderItem = {
  productId?: string;
  productName: string;
  sizeName?: string | null;
  toppings?: { id?: string; name: string; price?: number }[];
  quantity: number;
  unitPrice?: number;
  lineTotal?: number;
};
export type CustomerOrder = {
  id: string;
  orderCode: string;
  status: CustomerOrderStatus;
  totalAmount: number;
  createdAt: string;
  items: CustomerOrderItem[];
  stockHoldStatus?: string;
};
export type CustomerOrdersPage = {
  items: CustomerOrder[];
  page: number;
  pageSize: number;
  total: number;
};

const statusLabels: Record<CustomerOrderStatus, string> = {
  PENDING_PAYMENT: "Chờ thanh toán",
  CONFIRMED: "Đã xác nhận",
  PREPARING: "Đang chuẩn bị",
  READY: "Sẵn sàng nhận",
  COMPLETED: "Hoàn tất",
  CANCELLED: "Đã hủy",
};
function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
const moneyNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;
const optionalText = (value: unknown): boolean =>
  value === undefined || value === null || typeof value === "string";
const optionalMoney = (value: unknown): boolean => value === undefined || moneyNumber(value);

export function isCustomerStatus(value: unknown): value is CustomerOrderStatus {
  return typeof value === "string" && CUSTOMER_STATUSES.some(s => s === value);
}
export function customerStatusLabel(value: string): string {
  return isCustomerStatus(value) ? statusLabels[value] : value;
}
export function customerMoney(value: number): string {
  return `${new Intl.NumberFormat("vi-VN").format(value)} ₫`;
}
export function customerDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Không xác định" :
    new Intl.DateTimeFormat("vi-VN", {
      dateStyle: "short", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh",
    }).format(date);
}
export function customerRole(payload: unknown): string | null {
  if (!record(payload)) return null;
  if (typeof payload.role === "string") return payload.role;
  if (record(payload.user) && typeof payload.user.role === "string") return payload.user.role;
  return null;
}
export function customerApiError(code: number, payload: unknown, fallback: string): string {
  if (code === 401) return "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.";
  if (code === 403) return "Tài khoản này không có quyền xem đơn hàng của khách.";
  if (code === 404) return "Không tìm thấy đơn hàng.";
  if (record(payload)) {
    if (typeof payload.message === "string" && payload.message.trim()) return payload.message;
    if (Array.isArray(payload.message)) {
      const errors = payload.message.filter((s): s is string => typeof s === "string" && !!s.trim());
      if (errors.length) return errors.join(". ");
    }
    if (code === 409 && payload.code === "PAYMENT_IN_PROGRESS")
      return "Đang xử lý thanh toán. Vui lòng chờ kết quả rồi thử lại.";
    if (code === 409 && payload.code === "ORDER_NOT_CANCELLABLE")
      return "Đơn đã chuyển trạng thái nên không thể hủy.";
  }
  return fallback;
}
function isItem(value: unknown): value is CustomerOrderItem {
  if (!record(value) || typeof value.productName !== "string" ||
      !Number.isSafeInteger(value.quantity) || (value.quantity as number) < 1 ||
      !optionalText(value.sizeName) || !optionalMoney(value.unitPrice) ||
      !optionalMoney(value.lineTotal)) return false;
  if (value.toppings === undefined) return true;
  return Array.isArray(value.toppings) && value.toppings.every(t =>
    record(t) && typeof t.name === "string" && optionalMoney(t.price));
}
export function isCustomerOrder(value: unknown): value is CustomerOrder {
  return record(value) && typeof value.id === "string" && value.id.length > 0 &&
    typeof value.orderCode === "string" && isCustomerStatus(value.status) &&
    moneyNumber(value.totalAmount) && typeof value.createdAt === "string" &&
    Array.isArray(value.items) && value.items.every(isItem) &&
    (value.stockHoldStatus === undefined || typeof value.stockHoldStatus === "string");
}
export function isCustomerOrdersPage(value: unknown): value is CustomerOrdersPage {
  return record(value) && Array.isArray(value.items) && value.items.every(isCustomerOrder) &&
    Number.isSafeInteger(value.page) && (value.page as number) > 0 &&
    Number.isSafeInteger(value.pageSize) && (value.pageSize as number) > 0 &&
    (value.pageSize as number) <= 50 && Number.isSafeInteger(value.total) &&
    (value.total as number) >= 0;
}
export function canCancelCustomerOrder(status: string): boolean {
  return status === "PENDING_PAYMENT";
}
