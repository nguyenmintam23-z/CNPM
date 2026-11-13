
import { render, screen } from "@testing-library/react";
import ProductCard from "../components/menu/ProductCard";
import type { Product } from "../components/menu/ProductCard";

// Dữ liệu kiểm thử theo hợp đồng API của Duy
const product: Product = {
  id: "6f1c2a3e-8b4d-4c1a-9e2f-1a2b3c4d5e6f",
  name: "Cà phê sữa",
  basePrice: 29000,
  imageUrl: null,
  availableQuantity: 20,
};

describe("ProductCard", () => {
  test("Hiển thị tên sản phẩm", () => {
    render(<ProductCard product={product} />);

    expect(
      screen.getByText("Cà phê sữa")
    ).toBeInTheDocument();
  });

  test("Hiển thị giá tiền VND", () => {
    render(<ProductCard product={product} />);

    expect(
      screen.getByText(/29\.000/)
    ).toBeInTheDocument();
  });

  test("Hiển thị hết hàng khi số lượng bằng 0", () => {
    render(
      <ProductCard
        product={{ ...product, availableQuantity: 0 }}
      />
    );

    expect(
      screen.getByText("Hết hàng")
    ).toBeInTheDocument();
  });

  test("Không hiện hết hàng khi còn sản phẩm", () => {
    render(<ProductCard product={product} />);

    expect(
      screen.queryByText("Hết hàng")
    ).not.toBeInTheDocument();
  });

  test("Hiển thị thông báo khi không có ảnh", () => {
    render(<ProductCard product={product} />);

    expect(
      screen.getByText("Chưa có ảnh")
    ).toBeInTheDocument();
  });
});
