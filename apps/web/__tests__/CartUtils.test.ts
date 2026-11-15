import {
  addCartItem, cartKey, cartStorageKey, cartTotal, changeCartQuantity,
  MAX_CART_LINES, MAX_QUANTITY, MAX_TOPPINGS, parseCart, quantityOfProduct,
  readCart, removeCartItem, replaceCartItem, saveCart, unitPrice,
  userIdFromSession, type NewCartItem,
} from "../lib/cart";

const selection: NewCartItem = {
  productId: "coffee", productName: "Cà phê sữa", imageUrl: null,
  basePrice: 29000, sizeId: "size-m", sizeName: "M", sizeExtraPrice: 5000,
  toppings: [{ id: "pearl", name: "Trân châu", price: 7000 }], quantity: 2,
  availableQuantity: 40,
};

test("tính đúng giá tạm tính", () => {
  const result = addCartItem([], selection);
  expect(unitPrice(result.items[0])).toBe(41000);
  expect(cartTotal(result.items)).toBe(82000);
});

test("gộp cùng lựa chọn, tách lựa chọn khác", () => {
  const first = addCartItem([], selection).items;
  const same = addCartItem(first, { ...selection, quantity: 1 }).items;
  expect(same).toHaveLength(1);
  expect(same[0].quantity).toBe(3);
  const different = addCartItem(same, { ...selection, sizeId: "size-s", sizeName: "S", sizeExtraPrice: 0, quantity: 1 }).items;
  expect(different).toHaveLength(2);
  expect(quantityOfProduct(different, "coffee")).toBe(4);
  expect(cartKey("coffee", "size-m", ["a", "b"])).toBe(cartKey("coffee", "size-m", ["b", "a"]));
});

test("chặn quá 20 ly, quá 20 dòng, quá 5 topping", () => {
  expect(MAX_QUANTITY).toBe(20);
  expect(MAX_CART_LINES).toBe(20);
  expect(MAX_TOPPINGS).toBe(5);
  expect(addCartItem([], { ...selection, quantity: 21 }).error).toMatch(/20/);
  const first = addCartItem([], { ...selection, quantity: 20 }).items;
  expect(addCartItem(first, { ...selection, quantity: 1 }).error).toMatch(/20/);
  const six = Array.from({ length: 6 }, (_, i) => ({ id: `t${i}`, name: `T${i}`, price: 1000 }));
  expect(addCartItem([], { ...selection, toppings: six }).error).toMatch(/5/);
  const rows = Array.from({ length: 20 }, (_, i) => ({ ...selection, productId: `p${i}`, quantity: 1, availableQuantity: 2 }));
  let cart = addCartItem([], rows[0]).items;
  for (const row of rows.slice(1)) cart = addCartItem(cart, row).items;
  expect(cart).toHaveLength(20);
  expect(addCartItem(cart, { ...selection, productId: "p21", quantity: 1 }).error).toMatch(/20/);
});

test("không cho vượt tồn kho cộng dồn theo sản phẩm", () => {
  const first = addCartItem([], { ...selection, quantity: 3, availableQuantity: 3 }).items;
  expect(addCartItem(first, { ...selection, sizeId: "another", quantity: 1, availableQuantity: 3 }).error).toMatch(/vượt/);
  expect(changeCartQuantity(first, first[0].key, 4)).toBe(first);
});

test("sửa size/topping ngay trong giỏ và gộp nếu trùng lựa chọn", () => {
  const first = addCartItem([], selection).items;
  const changed = replaceCartItem(first, first[0].key, {
    ...selection, sizeId: "size-l", sizeName: "L", sizeExtraPrice: 10000,
    toppings: [], quantity: 2,
  });
  expect(changed.error).toBeUndefined();
  expect(changed.items).toHaveLength(1);
  expect(changed.items[0].sizeName).toBe("L");
  expect(changed.items[0].toppings).toEqual([]);
  expect(cartTotal(changed.items)).toBe(78000);

  const variants = addCartItem(changed.items, { ...selection, quantity: 1 }).items;
  const merged = replaceCartItem(variants, variants[1].key, { ...selection, sizeId: "size-l", sizeName: "L", sizeExtraPrice: 10000, toppings: [], quantity: 1 });
  expect(merged.items).toHaveLength(1);
  expect(merged.items[0].quantity).toBe(3);
});

test("khi sửa bị vượt giới hạn thì giữ nguyên giỏ cũ", () => {
  const items = addCartItem([], { ...selection, quantity: 20 }).items;
  const alt = addCartItem(items, { ...selection, productId: "other", quantity: 1 }).items;
  const unchanged = replaceCartItem(alt, alt[1].key, { ...selection, quantity: 1 });
  expect(unchanged.error).toBeDefined();
  expect(unchanged.items).toBe(alt);
});

test("giảm, xóa, loại dữ liệu hỏng và dữ liệu quá giới hạn", () => {
  const first = addCartItem([], selection).items;
  expect(changeCartQuantity(first, first[0].key, 1)[0].quantity).toBe(1);
  expect(removeCartItem(first, first[0].key)).toEqual([]);
  expect(parseCart("not JSON")).toEqual([]);
  expect(parseCart(JSON.stringify([{ invalid: true }]))).toEqual([]);
  expect(parseCart(JSON.stringify([{ ...first[0], quantity: 99 }]))).toEqual([]);
});

test("mỗi tài khoản có giỏ riêng; không đọc giỏ cũ dùng chung", () => {
  window.localStorage.clear();
  const items = addCartItem([], selection).items;
  expect(saveCart(items, "customer-a")).toBe(true);
  expect(readCart("customer-a")).toHaveLength(1);
  expect(readCart("customer-b")).toEqual([]);
  expect(cartStorageKey("customer-a")).not.toBe(cartStorageKey("customer-b"));
  window.localStorage.setItem("brewlite_cart_v1", JSON.stringify(items));
  expect(readCart("customer-c")).toEqual([]);
  expect(userIdFromSession({ user: { id: "abc" } })).toBe("abc");
  expect(userIdFromSession({ id: "xyz" })).toBe("xyz");
  expect(userIdFromSession({ email: "a@b.com" })).toBeNull();
});
