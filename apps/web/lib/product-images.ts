const images: Record<string, string> = {
  "bac xiu": "/images/products/bac-xiu.jpg",
  "ca phe den": "/images/products/ca-phe-den.webp",
  "ca phe muoi": "/images/products/ca-phe-muoi.webp",
  "ca phe sua": "/images/products/ca-phe-sua.jpg",
  "cacao sua": "/images/products/cacao-sua.webp",
  "cappuccino": "/images/products/cappuccino.webp",
  "latte caramel": "/images/products/latte-caramel.webp",
  "nuoc suoi": "/images/products/nuoc-suoi.jpg",
  "sua tuoi tran chau duong den": "/images/products/sua-tuoi-tran-chau-duong-den.webp",
  "tra chanh": "/images/products/tra-chanh.webp",
  "tra dao cam sa": "/images/products/tra-dao-cam-sa.jpg",
  "tra sua khoai mon": "/images/products/tra-sua-khoai-mon.webp",
  "tra sua matcha": "/images/products/tra-sua-matcha.webp",
  "tra sua tran chau": "/images/products/tra-sua-tran-chau.jpg",
  "tra vai": "/images/products/tra-vai.webp",
  "tra trai cay": "/images/products/tra-trai-cay.webp",
  "tra xoai": "/images/products/tra-trai-cay.webp",
  "tra dau": "/images/products/tra-trai-cay.webp",
  "tra nhiet doi": "/images/products/tra-trai-cay.webp",
  "tra tac": "/images/products/tra-chanh.webp",
};

function normalizeProductName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function resolveProductImage(name: string, imageUrl: string | null | undefined): string | null {
  const url = imageUrl?.trim();
  if (url && !url.includes("placeholder.com")) return url;
  return images[normalizeProductName(name)] ?? null;
}
