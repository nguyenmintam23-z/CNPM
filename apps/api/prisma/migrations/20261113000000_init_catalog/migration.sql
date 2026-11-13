-- CreateTable
CREATE TABLE "products" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "base_price" DECIMAL(12,2) NOT NULL,
    "image_url" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "stock_quantity" INTEGER NOT NULL DEFAULT 0,
    "reserved_quantity" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sizes" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "extra_price" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "sizes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "toppings" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "toppings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_sizes" (
    "product_id" UUID NOT NULL,
    "size_id" UUID NOT NULL,

    CONSTRAINT "product_sizes_pkey" PRIMARY KEY ("product_id","size_id")
);

-- CreateTable
CREATE TABLE "product_toppings" (
    "product_id" UUID NOT NULL,
    "topping_id" UUID NOT NULL,

    CONSTRAINT "product_toppings_pkey" PRIMARY KEY ("product_id","topping_id")
);

-- AddForeignKey
ALTER TABLE "product_sizes" ADD CONSTRAINT "product_sizes_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_sizes" ADD CONSTRAINT "product_sizes_size_id_fkey" FOREIGN KEY ("size_id") REFERENCES "sizes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_toppings" ADD CONSTRAINT "product_toppings_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_toppings" ADD CONSTRAINT "product_toppings_topping_id_fkey" FOREIGN KEY ("topping_id") REFERENCES "toppings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Tồn kho không âm, không giữ quá số tồn (backend-data-design §4.3; FR-13 (6)).
-- Prisma schema chưa khai báo được CHECK nên thêm tay vào migration.
ALTER TABLE "products" ADD CONSTRAINT "products_stock_check"
  CHECK ("stock_quantity" >= 0 AND "reserved_quantity" >= 0 AND "reserved_quantity" <= "stock_quantity");
