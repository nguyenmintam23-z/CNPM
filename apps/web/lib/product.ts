// Kieu du lieu theo apps/api/api-products.md (GET /products/:id).
export type ProductSize = {
  id: string;
  name: string;
  extraPrice: number;
};

export type ProductTopping = {
  id: string;
  name: string;
  price: number;
};

export type ProductDetail = {
  id: string;
  name: string;
  description: string | null;
  basePrice: number;
  imageUrl: string | null;
  availableQuantity: number;
  sizes: ProductSize[];
  toppings: ProductTopping[];
};

export const formatVnd = (amount: number) =>
  new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(amount);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isNonnegativeInteger = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0;

export function isProductDetail(value: unknown): value is ProductDetail {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    (typeof value.description === "string" || value.description === null) &&
    isNonnegativeInteger(value.basePrice) &&
    (typeof value.imageUrl === "string" || value.imageUrl === null) &&
    isNonnegativeInteger(value.availableQuantity) &&
    Array.isArray(value.sizes) &&
    value.sizes.every(
      (size: unknown) =>
        isRecord(size) &&
        typeof size.id === "string" &&
        typeof size.name === "string" &&
        isNonnegativeInteger(size.extraPrice)
    ) &&
    Array.isArray(value.toppings) &&
    value.toppings.every(
      (topping: unknown) =>
        isRecord(topping) &&
        typeof topping.id === "string" &&
        typeof topping.name === "string" &&
        isNonnegativeInteger(topping.price)
    )
  );
}
