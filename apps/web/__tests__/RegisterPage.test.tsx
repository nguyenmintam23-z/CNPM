import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import RegisterPage from "../app/register/page";

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
});

function fillRegister(confirmPassword = "secret123") {
  fireEvent.change(screen.getByLabelText("Họ và tên"), { target: { value: "Nguyễn Văn A" } });
  fireEvent.change(screen.getByRole("textbox", { name: "Địa chỉ email" }), { target: { value: "new@example.com" } });
  fireEvent.change(screen.getByLabelText("Mật khẩu"), { target: { value: "secret123" } });
  fireEvent.change(screen.getByLabelText("Xác nhận mật khẩu"), { target: { value: confirmPassword } });
  fireEvent.click(screen.getByRole("button", { name: "Tạo tài khoản" }));
}

test("hiển thị form đăng ký", () => {
  render(<RegisterPage />);
  expect(screen.getByRole("heading", { name: /Đăng ký tài khoản/ })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Đăng nhập" }));
  expect(mockRouter.push).toHaveBeenCalledWith("/login");
});

test("không gửi API khi xác nhận mật khẩu khác", () => {
  render(<RegisterPage />);
  fillRegister("different123");
  expect(screen.getByRole("alert")).toHaveTextContent(/chưa trùng khớp/);
  expect(fetchMock).not.toHaveBeenCalled();
});

test("đăng ký thành công: gửi đúng DTO và về /login, không tự đăng nhập", async () => {
  fetchMock.mockResolvedValue({ status: 201, ok: true });
  render(<RegisterPage />);
  fillRegister();
  await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith("/login"));
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(fetchMock).toHaveBeenCalledWith("/api/auth/register", expect.objectContaining({
    method: "POST", credentials: "same-origin",
    body: JSON.stringify({ fullName: "Nguyễn Văn A", email: "new@example.com", password: "secret123" }),
  }));
});

test("email trùng: hiển thị lỗi 409", async () => {
  fetchMock.mockResolvedValue({ status: 409, ok: false, json: async () => ({ message: "Email đã được đăng ký" }) });
  render(<RegisterPage />);
  fillRegister();
  expect(await screen.findByRole("alert")).toHaveTextContent("Email đã được đăng ký");
  expect(mockRouter.replace).not.toHaveBeenCalled();
});
