import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import ManagerHeaderActions from "../components/manager/ManagerHeaderActions";

const mockRouter = { replace: jest.fn(), refresh: jest.fn() };
jest.mock("next/navigation", () => ({ useRouter: () => mockRouter }));
const fetchMock = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  Object.defineProperty(global, "fetch", {
    value: fetchMock,
    configurable: true,
    writable: true,
  });
});

test("nút Làm mới vẫn hoạt động", () => {
  const onRefresh = jest.fn();
  render(<ManagerHeaderActions onRefresh={onRefresh} />);
  fireEvent.click(screen.getByRole("button", { name: "Làm mới" }));
  expect(onRefresh).toHaveBeenCalledTimes(1);
});

test("đăng xuất gọi POST rồi về trang đăng nhập khi API trả 204", async () => {
  fetchMock.mockResolvedValue({ ok: true, status: 204 });
  render(<ManagerHeaderActions onRefresh={jest.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "Đăng xuất" }));
  await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith("/login"));
  expect(mockRouter.refresh).toHaveBeenCalledTimes(1);
  expect(fetchMock).toHaveBeenCalledWith("/api/auth/logout", expect.objectContaining({
    method: "POST", credentials: "same-origin", cache: "no-store",
  }));
});

test("phiên đã hết hạn (401): vẫn chuyển về đăng nhập", async () => {
  fetchMock.mockResolvedValue({ ok: false, status: 401 });
  render(<ManagerHeaderActions onRefresh={jest.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "Đăng xuất" }));
  await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith("/login"));
});

test("đăng xuất thất bại: giữ nguyên trang và hiện lỗi", async () => {
  fetchMock.mockResolvedValue({ ok: false, status: 502 });
  render(<ManagerHeaderActions onRefresh={jest.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "Đăng xuất" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Không thể đăng xuất");
  expect(mockRouter.replace).not.toHaveBeenCalled();
});

test("mất kết nối: hiện lỗi để thử lại", async () => {
  fetchMock.mockRejectedValue(new Error("network"));
  render(<ManagerHeaderActions onRefresh={jest.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "Đăng xuất" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Vui lòng thử lại");
  expect(mockRouter.replace).not.toHaveBeenCalled();
});
