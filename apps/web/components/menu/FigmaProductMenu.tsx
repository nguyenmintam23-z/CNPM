import type { ReactNode } from "react";

// Mirrors apps/api/api-products.md response; never use Figma mock data.
export type Product = {
  id: string;
  name: string;
  basePrice: number;
  imageUrl: string | null;
  availableQuantity: number;
};

export type ProductMenuProps = {
  products: Product[];
  isAuthenticated: boolean;
  isLoading?: boolean;
  error?: string;
  onRetry?: () => void;
  onLogout?: () => void;
};

const heroPhoto =
  "https://images.unsplash.com/photo-1671014594641-262cc4b9a16d?auto=format&fit=crop&w=1800&q=90";

function LeafMark({ className = "size-8" }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 40 40" className={className} fill="none">
      <path
        d="M32.8 6.5C20.4 6.1 10.2 9.5 7.1 18.6c-2.4 7.1 2 13.2 8.7 13.2 9.9 0 15.1-11.9 17-25.3Z"
        fill="currentColor"
      />
      <path
        d="M7.2 33.4c5.1-9 10.5-14.6 19.2-20.3"
        stroke="#FFF9E9"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function Brand() {
  return (
    <a href="#top" className="inline-flex items-center gap-2.5" aria-label="BrewLite - đầu trang">
      <span className="grid size-11 place-items-center rounded-2xl bg-[#244A16] text-[#FFF9E9]">
        <LeafMark className="size-7" />
      </span>
      <span className="font-display text-[25px] font-semibold tracking-[-0.04em] text-[#173B20]">
        BrewLite
      </span>
    </a>
  );
}

function StatePanel({
  title,
  message,
  icon,
  action,
}: {
  title: string;
  message: string;
  icon: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mx-auto flex min-h-72 max-w-xl flex-col items-center justify-center rounded-[28px] border border-[#e5dfc8] bg-[#fffdf5] px-6 py-12 text-center shadow-[0_12px_38px_rgba(36,74,22,0.07)] sm:px-10">
      <span className="mb-5 grid size-14 place-items-center rounded-2xl bg-[#eaf0dd] text-[#244A16]">
        {icon}
      </span>
      <h2 className="font-display text-2xl font-semibold text-[#173B20]">{title}</h2>
      <p className="mt-2 max-w-sm text-sm leading-6 text-[#65725a]">{message}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

function ProductCard({ product }: { product: Product }) {
  const available = product.availableQuantity > 0;
  const image = product.imageUrl && !product.imageUrl.includes("placeholder.com")
    ? product.imageUrl : null;

  return (
    <article className="group overflow-hidden rounded-[26px] border border-[#e8e2cf] bg-[#fffdf7] shadow-[0_8px_24px_rgba(36,74,22,0.055)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_18px_38px_rgba(36,74,22,0.12)]">
      <div className="relative aspect-[1.28/1] overflow-hidden bg-[#eaeedc]">
        {image ? (
          // Images are supplied by the BrewLite API and may use external hosts.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt={product.name} loading="lazy"
            className={`size-full object-cover transition duration-500 group-hover:scale-[1.035] ${available ? "" : "grayscale-[35%]"}`} />
        ) : (
          <div className="flex size-full items-center justify-center text-sm font-medium text-[#6b795d]" aria-label="Sản phẩm chưa có ảnh">
            Chưa có ảnh
          </div>
        )}
        <span className={`absolute left-4 top-4 rounded-full px-3 py-1.5 text-xs font-bold ${available ? "bg-[#f5f8e9] text-[#315b24]" : "bg-[#fffdf5]/95 text-[#737568]"}`}>
          {available ? "Đang phục vụ" : "Hết hàng"}
        </span>
      </div>
      <div className="p-5 sm:p-6">
        <h3 className="font-display text-xl font-semibold leading-snug text-[#173B20]">{product.name}</h3>
        <div className="mt-5 flex items-center justify-between gap-3 border-t border-[#eeeadb] pt-4">
          <p className="font-semibold tabular-nums text-[#244A16]">
            {new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(product.basePrice)}
          </p>
          <LeafMark className="size-7 text-[#8ba86a]" />
        </div>
      </div>
    </article>
  );
}

function ProductSkeleton() {
  return (
    <div
      className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3"
      aria-label="Đang tải danh sách thức uống"
      aria-busy="true"
    >
      {Array.from({ length: 6 }, (_, index) => (
        <div
          key={index}
          className="overflow-hidden rounded-[26px] border border-[#e8e2cf] bg-[#fffdf7] p-3"
        >
          <div className="aspect-[1.28/1] animate-pulse rounded-[19px] bg-[#eee9d8]" />
          <div className="space-y-3 px-2 pb-3 pt-5">
            <div className="h-5 w-2/3 animate-pulse rounded-full bg-[#eee9d8]" />
            <div className="h-4 w-full animate-pulse rounded-full bg-[#f1eddf]" />
            <div className="h-4 w-4/5 animate-pulse rounded-full bg-[#f1eddf]" />
            <div className="mt-5 h-px bg-[#eeeadb]" />
            <div className="h-5 w-1/3 animate-pulse rounded-full bg-[#eee9d8]" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function ProductMenu({
  products,
  isAuthenticated,
  isLoading = false,
  error,
  onRetry,
  onLogout,
}: ProductMenuProps) {
  if (!isAuthenticated) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#FFF1C7] px-4 py-12">
        <StatePanel
          title="Đăng nhập để tiếp tục"
          message="Danh sách thức uống chỉ hiển thị khi bạn đã đăng nhập."
          icon={
            <svg
              viewBox="0 0 24 24"
              className="size-6"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
            >
              <path
                d="M12 15v2m-5 4h10a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2ZM8 10V7a4 4 0 1 1 8 0v3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          }
          action={
            <a
              href="/login"
              className="inline-flex min-h-12 items-center justify-center rounded-xl bg-[#244A16] px-6 font-semibold text-white transition hover:bg-[#173B20] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#a8bf8370]"
            >
              Đi đến đăng nhập
            </a>
          }
        />
      </main>
    );
  }

  return (
    <main id="top" className="min-h-screen bg-[#FFF1C7] text-[#173B20]">
      <header className="relative z-10 border-b border-[#e5dfc7] bg-[#FFF9E9]/90">
        <nav
          className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-7 lg:px-10"
          aria-label="Điều hướng chính"
        >
          <Brand />
          <div className="flex items-center gap-4 sm:gap-7">
            <a
              href="#menu"
              className="text-sm font-semibold text-[#34542a] transition hover:text-[#173B20]"
            >
              Thực đơn
            </a>
            {onLogout && (
              <button
                type="button"
                onClick={onLogout}
                className="rounded-xl border border-[#cbd5b8] px-4 py-2.5 text-sm font-semibold text-[#244A16] transition hover:bg-[#eef2e5] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#a8bf8370]"
              >
                Đăng xuất
              </button>
            )}
          </div>
        </nav>
      </header>

      <section className="mx-auto max-w-7xl px-4 pb-10 pt-7 sm:px-7 sm:pb-14 sm:pt-10 lg:px-10 lg:pt-14">
        <div className="grid overflow-hidden rounded-[30px] bg-[#f6e9b7] shadow-[0_18px_50px_rgba(36,74,22,0.10)] md:min-h-[420px] md:grid-cols-[0.9fr_1.1fr] lg:rounded-[38px]">
          <div className="relative flex flex-col justify-center px-6 py-10 sm:px-10 md:py-12 lg:px-14">
            <LeafMark className="absolute right-6 top-5 size-16 rotate-12 text-[#a8bf83]/65 sm:right-10 sm:top-8 sm:size-20" />
            <p className="mb-4 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-[#52713d]">
              <span className="size-1.5 rounded-full bg-[#6e8e4b]" />
              Hương vị từ cao nguyên
            </p>
            <h1 className="max-w-xl font-display text-[clamp(2.6rem,5vw,4.4rem)] font-semibold leading-[1.05] tracking-[-0.04em] text-[#173B20]">
              Chậm một nhịp,
              <br />
              đậm một ngày.
            </h1>
            <p className="mt-5 max-w-md text-sm leading-7 text-[#526346] sm:text-base">
              Cà phê Việt rang mới mỗi ngày, pha trọn vị và gửi đến bạn bằng tất cả sự chăm chút.
            </p>
            <a
              href="#menu"
              className="mt-7 inline-flex min-h-12 w-fit items-center justify-center rounded-xl bg-[#244A16] px-6 text-sm font-bold text-white shadow-[0_8px_18px_rgba(36,74,22,0.16)] transition hover:-translate-y-0.5 hover:bg-[#173B20] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#a8bf8370]"
            >
              Khám phá thực đơn
            </a>
          </div>
          <div className="relative min-h-[260px] md:min-h-full">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={heroPhoto}
              alt="Cà phê Việt và ly nước trên bàn gỗ trong ánh sáng tự nhiên"
              className="absolute inset-0 size-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#173b2038] to-transparent" />
            <div className="absolute bottom-5 left-5 rounded-full border border-white/50 bg-[#fff9e9]/85 px-4 py-2 text-xs font-semibold text-[#244A16] backdrop-blur-sm sm:bottom-7 sm:left-7">
              Từ hạt cà phê Việt
            </div>
          </div>
        </div>
      </section>

      <section
        id="menu"
        className="mx-auto max-w-7xl scroll-mt-6 px-4 pb-16 sm:px-7 sm:pb-20 lg:px-10"
      >
        <div className="mb-7 flex flex-wrap items-end justify-between gap-4 sm:mb-9">
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-[#668449]">
              Pha theo cách bạn yêu
            </p>
            <h2 className="font-display text-3xl font-semibold tracking-[-0.025em] text-[#173B20] sm:text-4xl">
              Thực đơn BrewLite
            </h2>
          </div>
          {!isLoading && !error && products.length > 0 && (
            <p className="text-sm text-[#69755e]">
              {products.length} {products.length === 1 ? "món" : "món uống"}
            </p>
          )}
        </div>

        {isLoading ? (
          <ProductSkeleton />
        ) : error ? (
          <StatePanel
            title="Chưa thể tải thực đơn"
            message={error}
            icon={
              <svg
                viewBox="0 0 24 24"
                className="size-6"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
              >
                <path
                  d="M12 8v4m0 4h.01M10.3 3.8 2.7 17a2 2 0 0 0 1.8 3h15a2 2 0 0 0 1.8-3L13.7 3.8a2 2 0 0 0-3.4 0Z"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            }
            action={
              onRetry && (
                <button
                  type="button"
                  onClick={onRetry}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#244A16] px-5 text-sm font-semibold text-white transition hover:bg-[#173B20] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#a8bf8370]"
                >
                  <svg
                    viewBox="0 0 20 20"
                    className="size-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                  >
                    <path
                      d="M16.5 8A6.7 6.7 0 0 0 4.7 5.2L3.5 6.5m0 0V3.8m0 2.7h2.7M3.5 12a6.7 6.7 0 0 0 11.8 2.8l1.2-1.3m0 0v2.7m0-2.7h-2.7"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  Thử tải lại
                </button>
              )
            }
          />
        ) : products.length === 0 ? (
          <StatePanel
            title="Thực đơn đang được chuẩn bị"
            message="Hiện chưa có thức uống nào để hiển thị. Mời bạn quay lại sau nhé."
            icon={
              <svg
                viewBox="0 0 24 24"
                className="size-6"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
              >
                <path
                  d="M6 9h10a3 3 0 0 1 0 6H6V9Zm10 2h1.5a2.5 2.5 0 0 1 0 5H16M8 5.5v1M12 5.5v1M16 5.5v1M7 19h9"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            }
          />
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3 xl:gap-6">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </section>

      <footer className="border-t border-[#e3ddc5] bg-[#FFF9E9]">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 py-6 text-center text-xs text-[#718064] sm:flex-row sm:px-7 sm:text-left lg:px-10">
          <Brand />
          <p>© BrewLite · Hương cà phê Việt, cho ngày thêm vui.</p>
        </div>
      </footer>
    </main>
  );
}
