import {
  MANAGER_STATUSES,
  isManagerOrder,
  isManagerOrderDetail,
  isManagerOrdersPage,
  isManagerStatus,
  isPaymentStatus,
  latestManagerPaymentLabel,
  managerApiError,
  managerDate,
  managerError,
  managerMoney,
  managerPaymentLabel,
  managerPaymentMethodLabel,
  managerRole,
  managerStatusLabel,
} from "../lib/manager-orders";

const sampleOrder = {
  id: "72f43cfb-cb07-4db2-b93e-815b5273ca76",
  orderCode: "BL-261115-ABCDE",
  status: "CONFIRMED",
  totalAmount: 64000,
  createdAt: "2026-11-15T10:00:00.000Z",
  items: [{
    productName: "Bạc xỉu", quantity: 2,
    sizeName: "S", unitPrice: 32000, lineTotal: 64000,
    toppings: [{ name: "Trân châu", price: 5000 }],
  }],
  latestPaymentStatus: "SUCCEEDED",
};

const failedPayment = {
  id: "payment-1", method: "CARD", status: "FAILED", amount: 64000,
  createdAt: "2026-11-15T10:00:00.000Z", completedAt: "2026-11-15T10:01:00.000Z",
  failureReason: "Thẻ mô phỏng bị từ chối.",
};

describe("FR-11: dữ liệu và nhãn của MANAGER", () => {
  test("sáu trạng thái theo SRS, không tự đặt tên khác", () => {
    expect(MANAGER_STATUSES).toHaveLength(6);
    expect(MANAGER_STATUSES.map(managerStatusLabel)).toEqual([
      "Chờ thanh toán", "Đã xác nhận", "Đang chuẩn bị",
      "Sẵn sàng nhận", "Hoàn tất", "Đã hủy",
    ]);
    expect(isManagerStatus("INVALID")).toBe(false);
    expect(isManagerStatus(null)).toBe(false);
  });

  test("trạng thái và phương thức thanh toán", () => {
    expect(isPaymentStatus("FAILED")).toBe(true);
    expect(isPaymentStatus("REFUNDED")).toBe(false);
    expect(managerPaymentLabel("SUCCEEDED")).toBe("Thành công");
    expect(managerPaymentMethodLabel("CARD")).toBe("Thẻ");
    expect(managerPaymentMethodLabel("WALLET")).toBe("Ví điện tử");
  });

  test("thất bại là lần thanh toán gần nhất, không phải mọi lần", () => {
    expect(latestManagerPaymentLabel("FAILED")).toBe("Lần thanh toán gần nhất thất bại");
    expect(latestManagerPaymentLabel("SUCCEEDED")).toBe("Thành công");
    expect(latestManagerPaymentLabel(null)).toBe("Chưa thanh toán");
  });

  test("định dạng VND và ngày theo giờ Việt Nam", () => {
    expect(managerMoney(64000)).toContain("64.000");
    expect(managerDate(null)).toBe("—");
    expect(managerDate("invalid")).toBe("Không xác định");
    expect(managerDate("2026-11-15T10:00:00.000Z")).toContain("17:00");
  });

  test("nhận role từ cấu trúc auth/me của dự án", () => {
    expect(managerRole({ user: { role: "MANAGER" } })).toBe("MANAGER");
    expect(managerRole({ role: "STAFF" })).toBe("STAFF");
    expect(managerRole(null)).toBeNull();
  });

  test("xử lý lỗi 401, 403 và chuỗi lỗi mảng", () => {
    expect(managerApiError(401, null, "Lỗi")).toContain("đăng nhập");
    expect(managerApiError(403, null, "Lỗi")).toContain("MANAGER");
    expect(managerApiError(404, null, "Lỗi")).toContain("Không tìm thấy");
    expect(managerError({ message: ["Sai page", "Sai pageSize"] }, "Lỗi")).toBe("Sai page. Sai pageSize");
    expect(managerError({ message: [] }, "Lỗi")).toBe("Lỗi");
  });

  test("nhận đơn hợp lệ từ backend", () => {
    expect(isManagerOrder(sampleOrder)).toBe(true);
    expect(isManagerOrder({ ...sampleOrder, latestPaymentStatus: null })).toBe(true);
  });

  test("từ chối trạng thái lạ, giá sai, số lượng không hợp lệ", () => {
    expect(isManagerOrder({ ...sampleOrder, status: "UNKNOWN" })).toBe(false);
    expect(isManagerOrder({ ...sampleOrder, totalAmount: -3 })).toBe(false);
    expect(isManagerOrder({ ...sampleOrder, items: [{ productName: "Cà phê", quantity: 0 }] })).toBe(false);
    expect(isManagerOrder({ ...sampleOrder, latestPaymentStatus: "REFUNDED" })).toBe(false);
  });

  test("từ chối topping không đúng định dạng", () => {
    expect(isManagerOrder({
      ...sampleOrder,
      items: [{ productName: "Bạc xỉu", quantity: 1, toppings: [{ price: 1000 }] }],
    })).toBe(false);
  });

  test("danh sách phân trang đúng định dạng", () => {
    expect(isManagerOrdersPage({ items: [sampleOrder], page: 1, pageSize: 20, total: 1 })).toBe(true);
    expect(isManagerOrdersPage({ items: [], page: 1, pageSize: 20, total: 0 })).toBe(true);
    expect(isManagerOrdersPage({ items: [], page: 0, pageSize: 20, total: 0 })).toBe(false);
    expect(isManagerOrdersPage({ items: [], page: 1, pageSize: 51, total: 0 })).toBe(false);
    expect(isManagerOrdersPage({ items: [], page: 1, pageSize: 20, total: -1 })).toBe(false);
  });

  test("chi tiết chứa mọi lần thanh toán", () => {
    expect(isManagerOrderDetail({
      ...sampleOrder,
      payments: [failedPayment, { ...failedPayment, id: "payment-2", status: "SUCCEEDED", failureReason: undefined }],
    })).toBe(true);
  });

  test("chi tiết không chấp nhận payment sai trạng thái hoặc amount", () => {
    expect(isManagerOrderDetail({ ...sampleOrder, payments: [{ ...failedPayment, status: "SOMETHING" }] })).toBe(false);
    expect(isManagerOrderDetail({ ...sampleOrder, payments: [{ ...failedPayment, amount: Infinity }] })).toBe(false);
    expect(isManagerOrderDetail({ ...sampleOrder, payments: [{ ...failedPayment, failureReason: 12 }] })).toBe(false);
    expect(isManagerOrderDetail({ ...sampleOrder, payments: null })).toBe(false);
  });
});
