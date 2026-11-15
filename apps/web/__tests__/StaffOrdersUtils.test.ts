import {
  formatStaffMoney,
  isActiveStaffStatus,
  isStaffOrder,
  isStaffOrderList,
  isStatusConflict,
  nextStaffStatus,
  staffActionLabel,
  staffErrorText,
  staffRoleFromSession,
  staffStatusLabel,
} from "../lib/staff-orders";

const order = {
  id: "c1b2c3d4-0000-4000-8000-000000000002",
  orderCode: "BL-261115-ABCDE",
  status: "CONFIRMED",
  totalAmount: 32000,
  createdAt: "2026-11-15T03:00:00.000Z",
  items: [{ productName: "Bạc xỉu", quantity: 1, sizeName: "S", toppings: [] }],
};

describe("Tiện ích giao diện nhân viên BrewLite", () => {
  test("đọc đơn và danh sách đơn đúng cấu trúc", () => {
    expect(isStaffOrder(order)).toBe(true);
    expect(isStaffOrderList([order])).toBe(true);
    expect(isStaffOrderList([])).toBe(true);
    expect(isStaffOrderList([{ id: "x" }])).toBe(false);
  });

  test("chỉ cho chuyển trạng thái theo bước kế tiếp", () => {
    expect(nextStaffStatus("CONFIRMED")).toBe("PREPARING");
    expect(nextStaffStatus("PREPARING")).toBe("READY");
    expect(nextStaffStatus("READY")).toBe("COMPLETED");
    expect(nextStaffStatus("PENDING_PAYMENT")).toBeNull();
    expect(nextStaffStatus("COMPLETED")).toBeNull();
  });

  test("hiển thị nhãn và xác định đơn còn trong hàng chờ", () => {
    expect(staffStatusLabel("CONFIRMED")).toBe("Chờ pha chế");
    expect(staffActionLabel("READY")).toBe("Hoàn tất đơn");
    expect(isActiveStaffStatus("PREPARING")).toBe(true);
    expect(isActiveStaffStatus("COMPLETED")).toBe(false);
  });

  test("xác định quyền nhân viên từ phiên đăng nhập", () => {
    expect(staffRoleFromSession({ user: { id: "123" }, role: "STAFF" })).toBe("STAFF");
    expect(staffRoleFromSession({ role: "CUSTOMER" })).toBe("CUSTOMER");
    expect(staffRoleFromSession(null)).toBeNull();
  });

  test("đọc thông báo lỗi và xung đột trạng thái", () => {
    expect(staffErrorText({ message: ["Sai dữ liệu", "Thử lại"] }, "Lỗi"))
      .toBe("Sai dữ liệu. Thử lại");
    expect(staffErrorText(null, "Lỗi" )).toBe("Lỗi");
    expect(isStatusConflict({ code: "ORDER_STATUS_CHANGED" })).toBe(true);
    expect(isStatusConflict({ code: "OTHER" })).toBe(false);
  });

  test("định dạng tiền Việt Nam", () => {
    expect(formatStaffMoney(32000)).toContain("32.000");
  });
});
