import { render, screen, waitFor } from "@testing-library/react";
import Home from "../app/page";

const mockRouter = { replace: jest.fn(), push: jest.fn(), refresh: jest.fn() };
jest.mock("next/navigation", () => ({ useRouter: () => mockRouter }));
const fetchMock = jest.fn();
beforeEach(() => {
  jest.clearAllMocks();
  Object.defineProperty(global, "fetch", { value: fetchMock, writable: true, configurable: true });
});

test("/auth/me trả 401: chuyển về đăng nhập và không gọi products", async () => {
  fetchMock.mockResolvedValue({ ok: false, status: 401 });
  render(<Home />);
  await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith("/login?next=%2F"));
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(fetchMock).toHaveBeenCalledWith("/api/auth/me", expect.objectContaining({ credentials: "same-origin" }));
  expect(screen.queryByText("Thực đơn BrewLite")).not.toBeInTheDocument();
});

test("/products trả 401 dù /me thành công: quay lại /login", async () => {
  fetchMock.mockResolvedValueOnce({ ok: true, status: 200 }).mockResolvedValueOnce({ ok: false, status: 401 });
  render(<Home />);
  await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith("/login?next=%2F"));
  expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/products", expect.objectContaining({ credentials: "same-origin" }));
});

test("API thành công nhưng danh sách rỗng: hiển thị trạng thái rỗng", async () => {
  fetchMock.mockResolvedValueOnce({ ok: true, status: 200 })
    .mockResolvedValueOnce({ ok: true, status: 200, json: async () => [] });
  render(<Home />);
  expect(await screen.findByRole("heading", { name: "Thực đơn đang được chuẩn bị" })).toBeInTheDocument();
});
