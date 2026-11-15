import {
  checkoutErrorText, checkoutFingerprint, checkoutItems, checkoutStorageKey,
  isCreatedOrder, requestIdValid, validateCheckoutCart,
} from "../lib/checkout";
import type { CartItem } from "../lib/cart";

const item: CartItem = {
  key: "abc", productId: "drink-1", productName: "Trà sữa", imageUrl: null,
  basePrice: 35000, sizeId: "size-m", sizeName: "M", sizeExtraPrice: 5000,
  toppings: [
    { id: "topping-b", name: "Thạch", price: 6000 },
    { id: "topping-a", name: "Trân châu", price: 7000 },
  ],
  quantity: 2, availableQuantity: 20,
};

test("chỉ gửi lựa chọn size/topping/số lượng, không gửi giá", () => {
  expect(checkoutItems([item])).toEqual([{
    productId: "drink-1", sizeId: "size-m", toppingIds: ["topping-a", "topping-b"], quantity: 2,
  }]);
  expect(JSON.stringify(checkoutItems([item]))).not.toMatch(/basePrice|unitPrice|totalAmount|availableQuantity/);
});

test("món không có size hoặc topping thì bỏ trường không áp dụng", () => {
  expect(checkoutItems([{ ...item, sizeId: null, sizeName: null, toppings: [] }])).toEqual([
    { productId: "drink-1", quantity: 2 },
  ]);
});

test("đổi lựa chọn hoặc số lượng sẽ đổi dấu vân tay giỏ", () => {
  expect(checkoutFingerprint([item])).not.toBe(checkoutFingerprint([{ ...item, quantity: 3 }]));
  expect(checkoutFingerprint([item])).not.toBe(checkoutFingerprint([{ ...item, sizeId: "size-l" }]));
});

test("mã nháp và đơn checkout tách theo tài khoản", () => {
  expect(checkoutStorageKey("user-a", "draft")).not.toBe(checkoutStorageKey("user-b", "draft"));
  expect(checkoutStorageKey("user-a", "draft")).not.toBe(checkoutStorageKey("user-a", "order"));
});

test("chặn giỏ trống, quá 20 dòng, 20 ly và quá 5 topping", () => {
  expect(validateCheckoutCart([])).toMatch(/trống/);
  expect(validateCheckoutCart([{ ...item, quantity: 21 }])).toMatch(/1–20/);
  expect(validateCheckoutCart(Array.from({ length: 21 }, (_, index) => ({ ...item, key: String(index) })))).toMatch(/20 dòng/);
  expect(validateCheckoutCart([{ ...item, toppings: Array.from({ length: 6 }, (_, index) => ({ id: String(index), name: "T", price: 0 })) }])).toMatch(/5 topping/);
  expect(validateCheckoutCart([item])).toBeNull();
});

test("đọc message lỗi và kiểm tra dữ liệu đơn", () => {
  expect(checkoutErrorText({ message: ["Sai size", "Hết hàng"] }, "Lỗi")).toBe("Sai size. Hết hàng");
  expect(isCreatedOrder({ id: "1", orderCode: "BL-1", requestId: "req-123456", totalAmount: 10000, status: "PENDING_PAYMENT", items: [] })).toBe(true);
  expect(isCreatedOrder({ id: "1" })).toBe(false);
  expect(requestIdValid("request-1234")).toBe(true);
  expect(requestIdValid("bad id")).toBe(false);
});
