import { render, screen, waitFor } from "@testing-library/react";
import CustomerHomeRoleGate from "../components/auth/CustomerHomeRoleGate";

const mockReplace = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

describe("Điều hướng trang chủ theo vai trò", () => {
  let fetchMock: jest.Mock;

  beforeEach(() => {
    mockReplace.mockReset();
    fetchMock = jest.fn();
    global.fetch = fetchMock;
  });

  test("Chưa đăng nhập: 401 không có body vẫn về login, không hiển thị menu", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 401 });
    render(<CustomerHomeRoleGate><p>Thực đơn khách hàng</p></CustomerHomeRoleGate>);
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/login?next=%2F"));
    expect(screen.queryByText("Thực đơn khách hàng")).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/auth/me", expect.objectContaining({ credentials: "same-origin" }));
  });

  test("STAFF: chuyển đến trang nhân viên, không hiển thị menu", async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ user: { role: "STAFF" } }) });
    render(<CustomerHomeRoleGate><p>Thực đơn khách hàng</p></CustomerHomeRoleGate>);
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/staff/orders"));
    expect(screen.queryByText("Thực đơn khách hàng")).not.toBeInTheDocument();
  });

  test("MANAGER: chuyển đến trang quản lý", async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ role: "MANAGER" }) });
    render(<CustomerHomeRoleGate><p>Thực đơn khách hàng</p></CustomerHomeRoleGate>);
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/manager/orders"));
    expect(screen.queryByText("Thực đơn khách hàng")).not.toBeInTheDocument();
  });

  test("CUSTOMER: hiển thị menu", async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ user: { role: "CUSTOMER" } }) });
    render(<CustomerHomeRoleGate><p>Thực đơn khách hàng</p></CustomerHomeRoleGate>);
    expect(await screen.findByText("Thực đơn khách hàng")).toBeInTheDocument();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  test("Dữ liệu vai trò không hợp lệ: không cho hiển thị menu", async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });
    render(<CustomerHomeRoleGate><p>Thực đơn khách hàng</p></CustomerHomeRoleGate>);
    expect(await screen.findByText("Không thể kiểm tra phiên đăng nhập")).toBeInTheDocument();
    expect(screen.queryByText("Thực đơn khách hàng")).not.toBeInTheDocument();
  });
});
