export type StaffActiveStatus = "CONFIRMED" | "PREPARING" | "READY";
export type StaffNextStatus = "PREPARING" | "READY" | "COMPLETED";

export type StaffTopping = {
  id?: string;
  name: string;
  price?: number;
};

export type StaffOrderItem = {
  productId?: string;
  productName: string;
  sizeName?: string | null;
  toppings?: StaffTopping[];
  quantity: number;
  unitPrice?: number;
  lineTotal?: number;
};

export type StaffOrder = {
  id: string;
  orderCode: string;
  status: string;
  totalAmount: number;
  createdAt: string;
  items: StaffOrderItem[];
};

export function isStaffOrder(value: unknown): value is StaffOrder {
  if (!value || typeof value !== "object") return false;
  const data = value as Record<string, unknown>;
  return (
    typeof data.id === "string" &&
    typeof data.orderCode === "string" &&
    typeof data.status === "string" &&
    typeof data.createdAt === "string" &&
    typeof data.totalAmount === "number" &&
    Number.isFinite(data.totalAmount) &&
    Array.isArray(data.items) &&
    data.items.every((item: unknown) => {
      if (!item || typeof item !== "object") return false;
      const row = item as Record<string, unknown>;
      return (
        typeof row.productName === "string" &&
        typeof row.quantity === "number" &&
        Number.isInteger(row.quantity) &&
        row.quantity > 0
      );
    })
  );
}

export function isStaffOrderList(value: unknown): value is StaffOrder[] {
  return Array.isArray(value) && value.every(isStaffOrder);
}

export function nextStaffStatus(status: string): StaffNextStatus | null {
  if (status === "CONFIRMED") return "PREPARING";
  if (status === "PREPARING") return "READY";
  if (status === "READY") return "COMPLETED";
  return null;
}

export function staffStatusLabel(status: string): string {
  switch (status) {
    case "CONFIRMED": return "Chờ pha chế";
    case "PREPARING": return "Đang pha chế";
    case "READY": return "Sẵn sàng nhận";
    case "COMPLETED": return "Đã hoàn tất";
    default: return status;
  }
}

export function staffActionLabel(status: string): string | null {
  switch (status) {
    case "CONFIRMED": return "Bắt đầu chuẩn bị";
    case "PREPARING": return "Sẵn sàng nhận";
    case "READY": return "Hoàn tất đơn";
    default: return null;
  }
}

export function isActiveStaffStatus(status: string): status is StaffActiveStatus {
  return status === "CONFIRMED" || status === "PREPARING" || status === "READY";
}

export function formatStaffMoney(amount: number): string {
  return `${new Intl.NumberFormat("vi-VN").format(amount)} ₫`;
}

export function formatStaffDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Không xác định"
    : new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(date);
}

export function staffErrorText(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object") return fallback;
  const data = payload as Record<string, unknown>;
  if (typeof data.message === "string" && data.message.trim()) return data.message;
  if (Array.isArray(data.message)) {
    const messages = data.message.filter((item): item is string => typeof item === "string");
    if (messages.length > 0) return messages.join(". ");
  }
  return fallback;
}

// GET /auth/me trả { user, role } theo AuthController.
export function staffRoleFromSession(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const data = payload as Record<string, unknown>;
  if (typeof data.role === "string") return data.role;
  if (data.user && typeof data.user === "object") {
    const user = data.user as Record<string, unknown>;
    if (typeof user.role === "string") return user.role;
  }
  return null;
}

export function isStatusConflict(payload: unknown): boolean {
  if (!payload || typeof payload !== "object") return false;
  return (payload as Record<string, unknown>).code === "ORDER_STATUS_CHANGED";
}
