import type { ReactNode } from "react";

type AuthMode = "login" | "register";

const visuals = {
  login: {
    image: "https://images.unsplash.com/photo-1664515725366-e8328e9dc834?auto=format&fit=crop&w=1400&q=88",
    alt: "Ly cà phê sữa đá Việt Nam",
    eyebrow: "Cà phê Việt, tinh tế mỗi ngày",
    title: "Đậm vị nguyên bản,\nnhẹ nhàng từng phút giây.",
    note: "Từ hạt cà phê được tuyển chọn đến ly cà phê dành riêng cho bạn.",
  },
  register: {
    image: "https://images.unsplash.com/photo-1782351076283-73aa35f76058?auto=format&fit=crop&w=1400&q=88",
    alt: "Tách gốm xanh trên bàn gỗ",
    eyebrow: "Một khoảng xanh dành cho bạn",
    title: "Gieo một thói quen,\nthưởng một vị an lành.",
    note: "Trở thành thành viên và khám phá những hương vị BrewLite yêu thích.",
  },
} as const;

function BotanicalSprig({ className = "" }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 180 210" className={className} fill="none">
      <path d="M19 204C52 147 83 92 157 20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M48 157C23 155 11 139 10 115c26-1 42 13 38 42ZM75 111C47 105 38 85 43 61c27 5 39 24 32 50ZM107 74c-5-27 9-45 32-53 7 26-4 46-32 53ZM58 145c25 4 43-8 51-31-23-9-44 1-51 31ZM96 96c26 2 43-12 49-36-25-7-44 5-49 36Z" fill="currentColor" />
    </svg>
  );
}

export default function AuthShell({ mode, children }: { mode: AuthMode; children: ReactNode }) {
  const visual = visuals[mode];

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#FFF1C7] p-3 sm:p-5 lg:p-7">
      <BotanicalSprig className="pointer-events-none absolute -bottom-14 -left-10 w-44 rotate-[8deg] text-[#A8BF83]/35" />
      <div className="relative z-10 mx-auto grid min-h-[calc(100vh-1.5rem)] max-w-[1480px] overflow-hidden rounded-[30px] bg-[#FFF9E9] shadow-[0_24px_70px_rgba(36,74,22,0.10)] sm:min-h-[calc(100vh-2.5rem)] lg:min-h-[calc(100vh-3.5rem)] lg:grid-cols-[minmax(440px,0.9fr)_minmax(560px,1.1fr)] lg:rounded-[38px]">
        <section className="relative flex flex-col px-5 py-6 sm:px-10 sm:py-8 lg:px-[clamp(3rem,6vw,6.5rem)] lg:py-10">
          <BotanicalSprig className="pointer-events-none absolute -right-12 -top-14 w-36 -rotate-[28deg] text-[#A8BF83]/20 lg:hidden" />
          <header className="relative z-10 flex items-center justify-between">
            <div className="flex items-center gap-3" aria-label="BrewLite">
              <span className="grid size-11 place-items-center rounded-2xl bg-[#244A16] text-[#FFF9E9] shadow-[0_6px_16px_rgba(36,74,22,0.18)]">
                <svg aria-hidden="true" viewBox="0 0 40 40" className="size-7" fill="none">
                  <path d="M20 34C9 28 8 17 15 8c8 1 16 8 14 17-1 4-4 7-9 9Z" fill="currentColor" />
                  <path d="M15 16c4 4 6 9 6 16" stroke="#244A16" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </span>
              <span>
                <span className="block text-[27px] font-bold leading-none tracking-[-0.035em] text-[#173B20]">BrewLite</span>
                <span className="mt-1 block text-[9px] font-bold uppercase tracking-[0.24em] text-[#6d825a]">Vietnamese Coffee</span>
              </span>
            </div>
            <span className="hidden rounded-full border border-[#dce5ce] bg-white/50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-[#58704a] sm:block">Rang mới mỗi ngày</span>
          </header>
          <div className="relative z-10 flex flex-1 items-center py-9 lg:py-7">
            <div className="mx-auto w-full max-w-[560px] rounded-[28px] border border-white/80 bg-white/45 p-5 shadow-[0_18px_50px_rgba(50,75,38,0.06)] backdrop-blur-sm sm:p-8 lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none">
              {children}
            </div>
          </div>
          <footer className="hidden text-[11px] font-medium tracking-wide text-[#7c896f] lg:block">© 2026 BrewLite · Cà phê Việt cho nhịp sống xanh</footer>
        </section>
        <aside className="relative m-2 min-h-[360px] overflow-hidden rounded-[26px] bg-[#A8BF83] sm:m-3 sm:min-h-[440px] lg:m-0 lg:min-h-full lg:rounded-none lg:rounded-l-[38px]">
          {/* URL ảnh lấy nguyên từ phiên bản Figma Make đã gửi. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={visual.image} alt={visual.alt} className="absolute inset-0 size-full object-cover" />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(23,59,32,0.08)_15%,rgba(23,59,32,0.68)_100%)]" />
          <BotanicalSprig className="pointer-events-none absolute -right-5 -top-5 w-52 rotate-[12deg] text-[#e5efcf]/45" />
          <div className="absolute left-6 top-6 flex items-center gap-2 rounded-full border border-white/35 bg-[#173B20]/20 px-3.5 py-2 text-[10px] font-bold uppercase tracking-[0.18em] text-white backdrop-blur-md sm:left-8 sm:top-8">
            <span className="size-1.5 rounded-full bg-[#dbe9be]" />{visual.eyebrow}
          </div>
          <div className="absolute inset-x-0 bottom-0 p-7 sm:p-10 lg:p-[clamp(2.5rem,5vw,5.5rem)]">
            <span className="mb-5 block h-0.5 w-12 rounded-full bg-[#dbe9be]" />
            <blockquote className="max-w-[650px] whitespace-pre-line font-serif text-[clamp(2rem,4vw,4.25rem)] font-bold leading-[1.08] tracking-[-0.035em] text-white">{visual.title}</blockquote>
            <p className="mt-4 max-w-lg text-sm leading-6 text-white/80 sm:text-base">{visual.note}</p>
          </div>
        </aside>
      </div>
    </main>
  );
}
