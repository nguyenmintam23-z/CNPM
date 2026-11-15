/** FR-11: dữ liệu API của quản lý. Không chỉnh sửa dữ liệu đơn trên client. */
export const MANAGER_STATUSES = [
  "PENDING_PAYMENT",
  "CONFIRMED",
  "PREPARING",
  "READY",
  "COMPLETED",
  "CANCELLED",
] as const;

export type ManagerStatus = (typeof MANAGER_STATUSES)[number];
export type ManagerPaymentStatus = "PROCESSING" | "SUCCEEDED" | "FAILED";

export type ManagerOrderItem = {
  productId?: string;
  productName: string;
  sizeName?: string | null;
  toppings?: { id?: string; name: string; price?: number }[];
  quantity: number;
  unitPrice?: number;
  lineTotal?: number;
};

export type ManagerOrder = {
  id: string;
  orderCode: string;
  status: ManagerStatus;
  totalAmount: number;
  createdAt: string;
  items: ManagerOrderItem[];
  latestPaymentStatus?: ManagerPaymentStatus | null;
};

export type ManagerPayment = {
  id: string;
  method: string;
  status: ManagerPaymentStatus;
  amount: number;
  createdAt: string;
  completedAt?: string | null;
  failureReason?: string | null;
};

export type ManagerOrderDetail = ManagerOrder & { payments: ManagerPayment[] };
export type ManagerOrdersPage = {
  items: ManagerOrder[];
  page: number;
  pageSize: number;
  total: number;
};

const statusNames: Record<ManagerStatus, string> = {
  PENDING_PAYMENT: "Chờ thanh toán",
  CONFIRMED: "Đã xác nhận",
  PREPARING: "Đang chuẩn bị",
  READY: "Sẵn sàng nhận",
  COMPLETED: "Hoàn tất",
  CANCELLED: "Đã hủy",
};
const paymentNames: Record<ManagerPaymentStatus, string> = {
  PROCESSING: "Đang xử lý",
  SUCCEEDED: "Thành công",
  FAILED: "Thất bại",
};

export function isManagerStatus(value: unknown): value is ManagerStatus {
  return typeof value === "string" &&
    MANAGER_STATUSES.some((status) => status === value);
}

export function managerStatusLabel(value: string): string {
  return isManagerStatus(value) ? statusNames[value] : value;
}

export function isPaymentStatus(value: unknown): value is ManagerPaymentStatus {
  return value === "PROCESSING" || value === "SUCCEEDED" || value === "FAILED";
}

export function managerPaymentLabel(value: string): string {
  return isPaymentStatus(value) ? paymentNames[value] : value;
}

export function managerPaymentMethodLabel(value: string): string {
  if (value === "CARD") return "Thẻ";
  if (value === "WALLET") return "Ví điện tử";
  return value;
}

/** Chỉ mô tả lần thanh toán cuối, không suy diễn về các lần trước. */
export function latestManagerPaymentLabel(
  status: ManagerPaymentStatus | null | undefined,
): string {
  if (status === "FAILED") return "Lần thanh toán gần nhất thất bại";
  if (status === "SUCCEEDED") return "Thành công";
  if (status === "PROCESSING") return "Đang xử lý";
  return "Chưa thanh toán";
}

export function managerMoney(amount: number): string {
  return `${new Intl.NumberFormat("vi-VN").format(amount)} ₫`;
}

export function managerDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Không xác định";
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(date);
}

export function managerError(payload: unknown, fallback: string): string {
  if (!isRecord(payload)) return fallback;
  if (typeof payload.message === "string" && payload.message.trim()) {
    return payload.message;
  }
  if (Array.isArray(payload.message)) {
    const messages = payload.message.filter(
      (entry): entry is string => typeof entry === "string" && !!entry.trim(),
    );
    if (messages.length) return messages.join(". ");
  }
  return fallback;
}

export function managerRole(session: unknown): string | null {
  if (!isRecord(session)) return null;
  if (typeof session.role === "string") return session.role;
  if (isRecord(session.user) && typeof session.user.role === "string") {
    return session.user.role;
  }
  return null;
}

export function managerApiError(status: number, payload: unknown, fallback: string): string {
  if (status === 401) return "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.";
  if (status === 403) return "Tài khoản của bạn không có quyền MANAGER.";
  if (status === 404) return "Không tìm thấy đơn hàng.";
  return managerError(payload, fallback);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function optionalNumber(value: unknown): boolean {
  return value === undefined || validNumber(value);
}

function optionalString(value: unknown): boolean {
  return value === undefined || value === null || typeof value === "string";
}

function isManagerItem(value: unknown): value is ManagerOrderItem {
  if (!isRecord(value)) return false;
  if (
    typeof value.productName !== "string" ||
    !Number.isInteger(value.quantity) ||
    (value.quantity as number) <= 0 ||
    !optionalString(value.sizeName) ||
    !optionalNumber(value.unitPrice) ||
    !optionalNumber(value.lineTotal)
  ) return false;
  if (value.toppings === undefined) return true;
  return Array.isArray(value.toppings) && value.toppings.every(
    (topping: unknown) => isRecord(topping) &&
      typeof topping.name === "string" && optionalNumber(topping.price),
  );
}

export function isManagerOrder(value: unknown): value is ManagerOrder {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.orderCode === "string" &&
    isManagerStatus(value.status) &&
    validNumber(value.totalAmount) &&
    typeof value.createdAt === "string" &&
    Array.isArray(value.items) && value.items.every(isManagerItem) &&
    (value.latestPaymentStatus === undefined ||
      value.latestPaymentStatus === null ||
      isPaymentStatus(value.latestPaymentStatus))
  );
}

export function isManagerOrdersPage(value: unknown): value is ManagerOrdersPage {
  if (!isRecord(value)) return false;
  return (
    Array.isArray(value.items) && value.items.every(isManagerOrder) &&
    Number.isSafeInteger(value.page) && (value.page as number) > 0 &&
    Number.isSafeInteger(value.pageSize) &&
      (value.pageSize as number) >= 1 && (value.pageSize as number) <= 50 &&
    Number.isSafeInteger(value.total) && (value.total as number) >= 0
  );
}

function isManagerPayment(value: unknown): value is ManagerPayment {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.method === "string" &&
    isPaymentStatus(value.status) &&
    validNumber(value.amount) &&
    typeof value.createdAt === "string" &&
    optionalString(value.completedAt) &&
    optionalString(value.failureReason)
  );
}

export function isManagerOrderDetail(value: unknown): value is ManagerOrderDetail {
  if (!isManagerOrder(value)) return false;
  const detail = value as ManagerOrder & { payments?: unknown };
  return Array.isArray(detail.payments) && detail.payments.every(isManagerPayment);
}
