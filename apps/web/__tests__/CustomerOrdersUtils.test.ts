import {
  CUSTOMER_STATUSES, canCancelCustomerOrder, customerApiError, customerDate,
  customerMoney, customerRole, customerStatusLabel, isCustomerOrder,
  isCustomerOrdersPage,
} from "../lib/customer-orders";

const order = {
  id: "72f43cfb-cb07-4db2-b93e-815b5273ca76",
  orderCode: "BL-261115-ABCDE",
  status: "PENDING_PAYMENT",
  totalAmount: 64000,
  createdAt: "2026-11-15T10:00:00.000Z",
  items: [{ productName: "Bạc xỉu", sizeName: "S", quantity: 2, lineTotal: 64000 }],
};
describe("FR-08/23/24: lịch sử đơn của CUSTOMER", () => {
  test("nhãn theo SRS", () => {
    expect(CUSTOMER_STATUSES.map(customerStatusLabel)).toEqual([
      "Chờ thanh toán", "Đã xác nhận", "Đang chuẩn bị",
      "Sẵn sàng nhận", "Hoàn tất", "Đã hủy",
    ]);
  });
  test("chỉ cho phép hủy khi chờ thanh toán", () => {
    expect(canCancelCustomerOrder("PENDING_PAYMENT")).toBe(true);
    expect(canCancelCustomerOrder("CONFIRMED")).toBe(false);
    expect(canCancelCustomerOrder("CANCELLED")).toBe(false);
  });
  test("đọc vai trò từ auth/me", () => {
    expect(customerRole({ user: { role: "CUSTOMER" } })).toBe("CUSTOMER");
    expect(customerRole({ role: "STAFF" })).toBe("STAFF");
    expect(customerRole(null)).toBeNull();
  });
  test("đơn hợp lệ, đơn có giá sai bị từ chối", () => {
    expect(isCustomerOrder(order)).toBe(true);
    expect(isCustomerOrder({ ...order, totalAmount: -1 })).toBe(false);
    expect(isCustomerOrder({ ...order, items: [{ productName: "Bạc xỉu", quantity: 0 }] })).toBe(false);
  });
  test("lịch sử phân trang", () => {
    expect(isCustomerOrdersPage({ items: [order], page: 1, pageSize: 20, total: 1 })).toBe(true);
    expect(isCustomerOrdersPage({ items: [], page: 1, pageSize: 20, total: 0 })).toBe(true);
    expect(isCustomerOrdersPage({ items: [], page: 0, pageSize: 20, total: 0 })).toBe(false);
  });
  test("định dạng ngày giờ và tiền", () => {
    expect(customerMoney(64000)).toContain("64.000");
    expect(customerDate("2026-11-15T10:00:00.000Z")).toContain("17:00");
    expect(customerDate("invalid")).toBe("Không xác định");
  });
  test("xử lý lỗi phân quyền và hủy đơn", () => {
    expect(customerApiError(401, null, "Lỗi")).toContain("đăng nhập");
    expect(customerApiError(403, null, "Lỗi")).toContain("không có quyền");
    expect(customerApiError(409, { code: "PAYMENT_IN_PROGRESS" }, "Lỗi")).toContain("thanh toán");
    expect(customerApiError(409, { code: "ORDER_NOT_CANCELLABLE" }, "Lỗi")).toContain("không thể hủy");
    expect(customerApiError(400, { message: ["Sai page", "Sai pageSize"] }, "Lỗi")).toBe("Sai page. Sai pageSize");
  });
});
