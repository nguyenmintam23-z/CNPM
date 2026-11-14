import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import LoginPage from "../app/login/page";

const mockRouter = { replace: jest.fn(), push: jest.fn(), refresh: jest.fn() };
jest.mock("next/navigation", () => ({ useRouter: () => mockRouter }));
jest.mock("../components/auth/AuthShell", () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const fetchMock = jest.fn();
beforeEach(() => {
  jest.clearAllMocks();
  Object.defineProperty(global, "fetch", { value: fetchMock, writable: true, configurable: true });
  window.history.replaceState({}, "", "/login");
});

function fillLogin() {
  fireEvent.change(screen.getByRole("textbox", { name: "Địa chỉ email" }), { target: { value: "user@example.com" } });
  fireEvent.change(screen.getByLabelText("Mật khẩu"), { target: { value: "secret123" } });
  fireEvent.click(screen.getByRole("button", { name: /^Đăng nhập$/ }));
}

test("hiển thị form đăng nhập và liên kết đăng ký", () => {
  render(<LoginPage />);
  expect(screen.getByRole("heading", { name: /Đăng nhập/ })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /Đăng ký ngay/ }));
  expect(mockRouter.push).toHaveBeenCalledWith("/register");
});

test("đăng nhập đúng: gọi login, xác minh /me rồi chuyển về menu", async () => {
  fetchMock
    .mockResolvedValueOnce({ ok: true, status: 200 })
    .mockResolvedValueOnce({ ok: true, status: 200 });
  render(<LoginPage />);
  fillLogin();
  await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith("/"));
  expect(mockRouter.refresh).toHaveBeenCalled();
  expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/auth/login", expect.objectContaining({
    method: "POST", credentials: "same-origin",
    body: JSON.stringify({ email: "user@example.com", password: "secret123" }),
  }));
  expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/auth/me", expect.objectContaining({ method: "GET" }));
});

test("sai thông tin đăng nhập: báo lỗi và không chuyển trang", async () => {
  fetchMock.mockResolvedValue({ ok: false, status: 401, json: async () => ({ message: "Email hoặc mật khẩu không đúng" }) });
  render(<LoginPage />);
  fillLogin();
  expect(await screen.findByRole("alert")).toHaveTextContent("Email hoặc mật khẩu không đúng");
  expect(mockRouter.replace).not.toHaveBeenCalled();
});

test("login thành công nhưng /me trả 401: không cho truy cập menu", async () => {
  fetchMock.mockResolvedValueOnce({ ok: true, status: 200 }).mockResolvedValueOnce({ ok: false, status: 401 });
  render(<LoginPage />);
  fillLogin();
  expect(await screen.findByRole("alert")).toHaveTextContent(/chưa xác minh được phiên/);
  expect(mockRouter.replace).not.toHaveBeenCalled();
});
