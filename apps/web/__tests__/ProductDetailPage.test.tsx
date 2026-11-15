import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import ProductDetailClient from "../app/products/[id]/ProductDetailClient";
import { cartStorageKey, readCart } from "../lib/cart";

jest.mock("next/link", () => {
  const React = jest.requireActual("react") as typeof import("react");
  return function MockLink({ href, children }: { href: string; children: ReactNode }) {
    return React.createElement("a", { href }, children);
  };
});

const mockRouter = { push: jest.fn(), replace: jest.fn() };
jest.mock("next/navigation", () => ({
  useRouter: () => mockRouter,
}));

const product = {
  id: "test-product", name: "Cà phê sữa", description: "Cà phê Việt",
  basePrice: 29000, imageUrl: null, availableQuantity: 10,
  sizes: [{ id: "s", name: "S", extraPrice: 0 }, { id: "m", name: "M", extraPrice: 5000 }],
  toppings: [{ id: "p", name: "Trân châu", price: 7000 }],
};
const mockFetch = jest.fn();
const sessionResponse = { ok: true, status: 200, json: async () => ({ id: "user-a" }) };
beforeEach(() => {
  jest.clearAllMocks();
  window.localStorage.clear(); window.sessionStorage.clear();
  Object.defineProperty(global, "fetch", { value: mockFetch, configurable: true, writable: true });
});

test("hiển thị loading trước khi API hoàn thành", () => {
  mockFetch.mockReturnValue(new Promise(() => {}));
  render(<ProductDetailClient id="test-product" />);
  expect(screen.getByRole("status")).toHaveTextContent("Đang tải chi tiết sản phẩm");
});

test("chọn size/topping, tăng số lượng và lưu vào giỏ", async () => {
  mockFetch.mockResolvedValueOnce(sessionResponse).mockResolvedValueOnce({ ok: true, status: 200, json: async () => product });
  render(<ProductDetailClient id="test-product" />);
  expect(await screen.findByRole("heading", { name: "Cà phê sữa" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("radio", { name: /M \(/ }));
  fireEvent.click(screen.getByRole("checkbox", { name: /Trân châu/ }));
  fireEvent.click(screen.getByRole("button", { name: "Tăng số lượng" }));
  expect(screen.getByText(/82[.,]000/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Thêm vào giỏ hàng" }));
  expect(mockRouter.push).toHaveBeenCalledWith("/cart");
  const saved = readCart("user-a");
  expect(saved).toHaveLength(1);
  expect(saved[0]).toEqual(expect.objectContaining({ productId: "test-product", sizeId: "m", quantity: 2 }));
  expect(saved[0].toppings).toEqual([{ id: "p", name: "Trân châu", price: 7000 }]);
});

test("không cho thêm sản phẩm hết hàng", async () => {
  mockFetch.mockResolvedValueOnce(sessionResponse).mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ ...product, availableQuantity: 0 }) });
  render(<ProductDetailClient id="test-product" />);
  expect(await screen.findByText(/Hết hàng/)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Thêm vào giỏ hàng" })).toBeDisabled();
  expect(readCart("user-a")).toEqual([]);
});

test("400 hoặc 404 hiển thị không tồn tại", async () => {
  mockFetch.mockResolvedValueOnce(sessionResponse).mockResolvedValueOnce({ ok: false, status: 404 });
  render(<ProductDetailClient id="test-product" />);
  expect(await screen.findByRole("heading", { name: "Sản phẩm không tồn tại" })).toBeInTheDocument();
});

test("401 chuyển tới đăng nhập và giữ giỏ hàng", async () => {
  const snapshot = JSON.stringify([{ ...product, key: "a", productId: "keep" }]);
  window.localStorage.setItem(cartStorageKey("user-a"), snapshot);
  mockFetch.mockResolvedValue({ ok: false, status: 401 });
  render(<ProductDetailClient id="test-product" />);
  await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith("/login?next=%2Fproducts%2Ftest-product"));
  expect(window.localStorage.getItem(cartStorageKey("user-a"))).toBe(snapshot);
});

test("lỗi 500 hiển thị nút thử lại", async () => {
  mockFetch.mockResolvedValueOnce(sessionResponse).mockResolvedValueOnce({ ok: false, status: 500 });
  render(<ProductDetailClient id="test-product" />);
  expect(await screen.findByRole("heading", { name: "Không thể tải chi tiết sản phẩm" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Thử lại" })).toBeInTheDocument();
});
