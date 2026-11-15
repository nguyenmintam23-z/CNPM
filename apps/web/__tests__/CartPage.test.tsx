import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import CartPage from "../app/cart/page";
import { addCartItem, cartStorageKey, type NewCartItem } from "../lib/cart";

jest.mock("next/link", () => {
  const React = jest.requireActual("react") as typeof import("react");
  return function MockLink({ href, children }: { href: string; children: ReactNode }) {
    return React.createElement("a", { href }, children);
  };
});
const mockRouter = { replace: jest.fn() };
jest.mock("next/navigation", () => ({ useRouter: () => mockRouter }));
const mockFetch = jest.fn();
const selection: NewCartItem = {
  productId: "coffee", productName: "Bạc xỉu", imageUrl: null,
  basePrice: 32000, sizeId: "s", sizeName: "S", sizeExtraPrice: 0,
  toppings: [], quantity: 1, availableQuantity: 5,
};
const detail = {
  id: "coffee", name: "Bạc xỉu", description: "Cà phê", basePrice: 32000,
  imageUrl: null, availableQuantity: 5,
  sizes: [{ id: "s", name: "S", extraPrice: 0 }, { id: "m", name: "M", extraPrice: 5000 }],
  toppings: [{ id: "p", name: "Trân châu", price: 7000 }],
};
const sessionResponse = { ok: true, status: 200, json: async () => ({ id: "user-a", role: "CUSTOMER" }) };
beforeEach(() => {
  jest.clearAllMocks(); window.localStorage.clear(); window.sessionStorage.clear();
  Object.defineProperty(global, "fetch", { value: mockFetch, writable: true, configurable: true });
});
function seed() {
  window.localStorage.setItem(cartStorageKey("user-a"), JSON.stringify(addCartItem([], selection).items));
}
test("giỏ rỗng hiển thị empty state", async () => {
  mockFetch.mockResolvedValue(sessionResponse);
  render(<CartPage />);
  expect(await screen.findByRole("heading", { name: "Giỏ hàng đang trống" })).toBeInTheDocument();
});

test("tăng, giảm, xóa dòng món và tính lại tổng", async () => {
  seed(); mockFetch.mockResolvedValue(sessionResponse);
  render(<CartPage />);
  expect(await screen.findByRole("heading", { name: "Bạc xỉu" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Tăng Bạc xỉu" }));
  expect(screen.getAllByText(/64[.,]000/).length).toBeGreaterThan(0);
  fireEvent.click(screen.getByRole("button", { name: "Giảm Bạc xỉu" }));
  expect(screen.getAllByText(/32[.,]000/).length).toBeGreaterThan(0);
  fireEvent.click(screen.getByRole("button", { name: "Xóa món" }));
  expect(screen.getByRole("heading", { name: "Giỏ hàng đang trống" })).toBeInTheDocument();
});

test("sửa size/topping trực tiếp từ giỏ hàng", async () => {
  seed();
  mockFetch.mockImplementation((url: string) => Promise.resolve(url.includes("/api/products/")
    ? { ok: true, status: 200, json: async () => detail } : sessionResponse));
  render(<CartPage />);
  await screen.findByRole("heading", { name: "Bạc xỉu" });
  fireEvent.click(screen.getByRole("button", { name: "Chỉnh sửa" }));
  const editor = await screen.findByRole("region", { name: "Chỉnh sửa Bạc xỉu" });
  fireEvent.click(await within(editor).findByRole("radio", { name: /M \(/ }));
  fireEvent.click(within(editor).getByRole("checkbox", { name: /Trân châu/ }));
  fireEvent.click(within(editor).getByRole("button", { name: "Lưu thay đổi" }));
  expect(screen.getByText("Size: M")).toBeInTheDocument();
  expect(screen.getByText("Topping: Trân châu")).toBeInTheDocument();
  expect(screen.getAllByText(/44[.,]000/).length).toBeGreaterThan(0);
});

test("401 chuyển về login, không hiển thị giỏ trước khi xác thực", async () => {
  seed(); mockFetch.mockResolvedValue({ ok: false, status: 401 });
  render(<CartPage />);
  await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith("/login?next=%2Fcart"));
  expect(window.localStorage.getItem(cartStorageKey("user-a"))).not.toBeNull();
  expect(screen.queryByRole("heading", { name: "Bạc xỉu" })).not.toBeInTheDocument();
});

test("không lộ giỏ tài khoản khác", async () => {
  seed();
  mockFetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ id: "user-b" }) });
  render(<CartPage />);
  expect(await screen.findByRole("heading", { name: "Giỏ hàng đang trống" })).toBeInTheDocument();
});

test("có đường dẫn sang trang checkout khi giỏ có món", async () => {
  seed(); mockFetch.mockResolvedValue(sessionResponse);
  render(<CartPage />);
  expect(await screen.findByRole("heading", { name: "Tổng kết giỏ hàng" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Tiếp tục đặt đơn" })).toHaveAttribute("href", "/checkout");
});

test("hiển thị thông báo khi thêm thành công", async () => {
  seed(); window.sessionStorage.setItem("brewlite_cart_added_notice", "Đã thêm món vào giỏ hàng.");
  mockFetch.mockResolvedValue(sessionResponse);
  render(<CartPage />);
  expect(
    await screen.findByText("Đã thêm món vào giỏ hàng.")
  ).toBeInTheDocument();
});
