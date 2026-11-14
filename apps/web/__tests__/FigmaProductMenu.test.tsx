import { fireEvent, render, screen } from "@testing-library/react";
import FigmaProductMenu, { type Product } from "../components/menu/FigmaProductMenu";

const products: Product[] = [
  { id: "1", name: "Bạc xỉu", basePrice: 32000, availableQuantity: 3, imageUrl: null },
  { id: "2", name: "Trà đào cam sả", basePrice: 39000, availableQuantity: 0, imageUrl: null },
];

test("menu đang tải: hiển thị skeleton, chưa hiển thị sản phẩm", () => {
  render(<FigmaProductMenu products={[]} isAuthenticated isLoading />);
  expect(screen.getByLabelText("Đang tải danh sách thức uống")).toHaveAttribute("aria-busy", "true");
  expect(screen.queryByText("Bạc xỉu")).not.toBeInTheDocument();
});

test("menu rỗng: hiển thị thông báo thân thiện", () => {
  render(<FigmaProductMenu products={[]} isAuthenticated />);
  expect(screen.getByRole("heading", { name: "Thực đơn đang được chuẩn bị" })).toBeInTheDocument();
});

test("lỗi API: có thông báo và nút thử lại hoạt động", () => {
  const onRetry = jest.fn();
  render(<FigmaProductMenu products={[]} isAuthenticated error="Lỗi tải menu" onRetry={onRetry} />);
  expect(screen.getByText("Lỗi tải menu")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Thử tải lại" }));
  expect(onRetry).toHaveBeenCalledTimes(1);
});

test("dữ liệu thật: hiển thị tên, giá và nhãn hết hàng", () => {
  render(<FigmaProductMenu products={products} isAuthenticated />);
  expect(screen.getByRole("heading", { name: "Bạc xỉu" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Trà đào cam sả" })).toBeInTheDocument();
  expect(screen.getByText("Hết hàng")).toBeInTheDocument();
  expect(screen.getByText(/32[.,]000/)).toBeInTheDocument();
});

test("chưa đăng nhập: không lộ danh sách sản phẩm", () => {
  render(<FigmaProductMenu products={products} isAuthenticated={false} />);
  expect(screen.getByRole("heading", { name: "Đăng nhập để tiếp tục" })).toBeInTheDocument();
  expect(screen.queryByText("Bạc xỉu")).not.toBeInTheDocument();
});
