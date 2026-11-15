import {
  addCartItem, cartKey, cartTotal, changeCartQuantity, MAX_QUANTITY,
  parseCart, quantityOfProduct, removeCartItem, unitPrice, type NewCartItem,
} from "../lib/cart";

const selection: NewCartItem = {
  productId: "coffee", productName: "Cà phê sữa", imageUrl: null,
  basePrice: 29000, sizeId: "size-m", sizeName: "M", sizeExtraPrice: 5000,
  toppings: [{ id: "pearl", name: "Trân châu", price: 7000 }],
  quantity: 2, availableQuantity: 10,
};

test("tính đúng tiền VND theo giá gốc + size + topping x số lượng", () => {
  const result = addCartItem([], selection);
  expect(result.error).toBeUndefined();
  expect(unitPrice(result.items[0])).toBe(41000);
  expect(cartTotal(result.items)).toBe(82000);
});

test("gộp hai lần thêm cùng size/topping và không gộp lựa chọn khác", () => {
  const first = addCartItem([], selection).items;
  const second = addCartItem(first, { ...selection, quantity: 1 }).items;
  expect(second).toHaveLength(1);
  expect(second[0].quantity).toBe(3);
  const different = addCartItem(second, { ...selection, sizeId: "size-s", sizeName: "S", sizeExtraPrice: 0, quantity: 1 }).items;
  expect(different).toHaveLength(2);
  expect(quantityOfProduct(different, "coffee")).toBe(4);
  expect(cartKey("coffee", "size-m", ["a", "b"])).toBe(cartKey("coffee", "size-m", ["b", "a"]));
});

test("không cho chọn tổng số vượt tồn kho, kể cả khác size", () => {
  const first = addCartItem([], { ...selection, quantity: 3, availableQuantity: 3 }).items;
  const result = addCartItem(first, { ...selection, sizeId: "other", quantity: 1, availableQuantity: 3 });
  expect(result.error).toMatch(/vượt/);
  expect(result.items).toBe(first);
  expect(changeCartQuantity(first, first[0].key, 10)).toBe(first);
  expect(MAX_QUANTITY).toBeGreaterThan(0);
});

test("giảm số lượng và xóa món; dữ liệu hỏng không gây crash", () => {
  const first = addCartItem([], selection).items;
  const updated = changeCartQuantity(first, first[0].key, 1);
  expect(updated[0].quantity).toBe(1);
  expect(removeCartItem(updated, updated[0].key)).toEqual([]);
  expect(parseCart("not JSON")).toEqual([]);
  expect(parseCart(JSON.stringify([{ invalid: true }]))).toEqual([]);
});
