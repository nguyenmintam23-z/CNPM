import { resolveProductImage } from "../lib/product-images";

test("ưu tiên ảnh từ API khi có đường dẫn hợp lệ", () => {
  expect(resolveProductImage("Cà phê đen", "/images/custom.jpg")).toBe("/images/custom.jpg");
});

test("món có tên tiếng Việt được gán ảnh phù hợp", () => {
  expect(resolveProductImage("Cà phê đen", null)).toBe("/images/products/ca-phe-den.webp");
  expect(resolveProductImage("Trà sữa khoai môn", null)).toBe("/images/products/tra-sua-khoai-mon.webp");
  expect(resolveProductImage("Cà phê muối", "https://placeholder.com/empty.png")).toBe("/images/products/ca-phe-muoi.webp");
});

test("vẫn hỗ trợ sản phẩm chưa có ảnh trong tương lai", () => {
  expect(resolveProductImage("Món chưa xác định", null)).toBeNull();
});
