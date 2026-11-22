import {
  checkoutErrorText, checkoutFingerprint, checkoutItems, checkoutStorageKey,
  completePaidCheckout, isCreatedOrder, loadCheckoutRecord, requestIdValid,
  saveCheckoutRecord, validateCheckoutCart,
} from "../lib/checkout";
import { readCart, saveCart, type CartItem } from "../lib/cart";

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

describe("dọn giỏ sau khi thanh toán thành công", () => {
  beforeEach(() => window.localStorage.clear());

  function prepare(userId: string, orderId: string, cart: CartItem[] = [item]) {
    expect(saveCart(cart, userId)).toBe(true);
    const fingerprint = checkoutFingerprint(cart);
    expect(saveCheckoutRecord(checkoutStorageKey(userId, "draft"), {
      fingerprint, requestId: "request-1234",
    })).toBe(true);
    expect(saveCheckoutRecord(checkoutStorageKey(userId, "order"), {
      fingerprint,
      order: { id: orderId, orderCode: "BL-123", requestId: "request-1234",
        status: "PENDING_PAYMENT", totalAmount: 96000, items: [] },
    })).toBe(true);
  }

  test("thanh toán thành công: xóa giỏ và bản nháp, giữ xác nhận đơn", () => {
    prepare("customer-a", "order-1");
    expect(completePaidCheckout("customer-a", "order-1", "CONFIRMED")).toBe(true);
    expect(readCart("customer-a")).toEqual([]);
    expect(loadCheckoutRecord(checkoutStorageKey("customer-a", "draft"))).toBeNull();
    expect(loadCheckoutRecord(checkoutStorageKey("customer-a", "order"))).not.toBeNull();
  });

  test("chưa thanh toán hoặc thanh toán thất bại không được xóa giỏ", () => {
    prepare("customer-a", "order-1");
    for (const status of ["PENDING_PAYMENT", "FAILED", "CANCELED"]) {
      expect(completePaidCheckout("customer-a", "order-1", status)).toBe(false);
      expect(readCart("customer-a")).toHaveLength(1);
    }
  });

  test("không xóa nhầm giỏ của tài khoản khác hoặc đơn khác", () => {
    prepare("customer-a", "order-1");
    expect(saveCart([item], "customer-b")).toBe(true);
    expect(completePaidCheckout("customer-a", "order-2", "CONFIRMED")).toBe(false);
    expect(readCart("customer-a")).toHaveLength(1);
    expect(readCart("customer-b")).toHaveLength(1);
    expect(completePaidCheckout("customer-a", "order-1", "CONFIRMED")).toBe(true);
    expect(readCart("customer-b")).toHaveLength(1);
  });

  test("không xóa món khách vừa thêm sau khi tạo đơn cũ", () => {
    prepare("customer-a", "order-1");
    expect(saveCart([{ ...item, quantity: 3 }], "customer-a")).toBe(true);
    expect(completePaidCheckout("customer-a", "order-1", "CONFIRMED")).toBe(false);
    expect(readCart("customer-a")[0].quantity).toBe(3);
    expect(loadCheckoutRecord(checkoutStorageKey("customer-a", "draft"))).not.toBeNull();
  });
});
