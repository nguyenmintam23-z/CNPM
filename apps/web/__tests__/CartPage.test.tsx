import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import CartPage from "../app/cart/page";
import { addCartItem, CART_STORAGE_KEY, type NewCartItem } from "../lib/cart";

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
  basePrice: 32000, sizeId: null, sizeName: null,
  sizeExtraPrice: 0, toppings: [], quantity: 1, availableQuantity: 5,
};
beforeEach(() => {
  jest.clearAllMocks();
  window.localStorage.clear();
  Object.defineProperty(global, "fetch", { value: mockFetch, writable: true, configurable: true });
});

test("giỏ rỗng hiển thị empty state", async () => {
  mockFetch.mockResolvedValue({ ok: true, status: 200 });
  render(<CartPage />);
  expect(await screen.findByRole("heading", { name: "Giỏ hàng đang trống" })).toBeInTheDocument();
});

test("tăng, giảm, xóa dòng món và tính lại tổng", async () => {
  const saved = addCartItem([], selection).items;
  window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(saved));
  mockFetch.mockResolvedValue({ ok: true, status: 200 });
  render(<CartPage />);
  expect(await screen.findByRole("heading", { name: "Bạc xỉu" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Tăng Bạc xỉu" }));
  expect(screen.getAllByText(/64[.,]000/).length).toBeGreaterThan(0);
  fireEvent.click(screen.getByRole("button", { name: "Giảm Bạc xỉu" }));
  expect(screen.getAllByText(/32[.,]000/).length).toBeGreaterThan(0);
  fireEvent.click(screen.getByRole("button", { name: "Xóa món" }));
  expect(screen.getByRole("heading", { name: "Giỏ hàng đang trống" })).toBeInTheDocument();
});

test("401 chuyển về login, không xóa localStorage giỏ hàng", async () => {
  const raw = JSON.stringify(addCartItem([], selection).items);
  window.localStorage.setItem(CART_STORAGE_KEY, raw);
  mockFetch.mockResolvedValue({ ok: false, status: 401 });
  render(<CartPage />);
  await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith("/login?next=%2Fcart"));
  expect(window.localStorage.getItem(CART_STORAGE_KEY)).toBe(raw);
  expect(screen.queryByRole("heading", { name: "Bạc xỉu" })).not.toBeInTheDocument();
});

test("checkout chưa có API nên không cho đặt đơn giả", async () => {
  window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(addCartItem([], selection).items));
  mockFetch.mockResolvedValue({ ok: true, status: 200 });
  render(<CartPage />);
  expect(await screen.findByRole("heading", { name: "Tổng kết giỏ hàng" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Thanh toán/ })).toBeDisabled();
});
