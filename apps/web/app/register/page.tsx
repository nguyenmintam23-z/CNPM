
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import {
  Brand,
  RegisterForm,
  type RegisterValues,
} from "../../components/auth/AuthUI";

const coffeeImage =
  "https://images.unsplash.com/photo-1642409647061-8932650548e4?auto=format&fit=crop&w=1200&q=85";

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState("");

  function handleRegister(values: RegisterValues) {
    void values;

    setError(
      "Chức năng đăng ký đang chờ kết nối Backend."
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#f5eee6] px-4 py-5 sm:px-7 sm:py-8 lg:grid lg:grid-cols-[minmax(400px,0.92fr)_minmax(520px,1.08fr)] lg:gap-8 lg:p-8">
      <section className="relative z-10 mx-auto flex w-full max-w-[620px] flex-col lg:max-w-none lg:pl-[clamp(1rem,5vw,5.5rem)] lg:pr-[clamp(1rem,3vw,3.5rem)]">
        <header className="mb-8 flex items-center justify-between lg:mb-0 lg:h-[12vh]">
          <Brand />

          <span className="hidden rounded-full border border-[#d8c8bb] bg-white/50 px-3 py-1.5 text-xs font-semibold text-[#775f51] sm:block">
            Cà phê Việt, nhịp sống mới
          </span>
        </header>

        <div className="flex flex-1 items-center py-3 lg:py-5">
          <div className="w-full rounded-[28px] border border-white/70 bg-[#fffaf5]/90 p-5 shadow-lg sm:p-8 lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none">
            <RegisterForm
              onSubmit={handleRegister}
              error={error}
              onSwitchMode={() => router.push("/login")}
            />
          </div>
        </div>

        <footer className="mt-7 hidden text-xs text-[#907f73] lg:block">
          © 2026 BrewLite. Pha vị riêng, sống chất riêng.
        </footer>
      </section>

      <aside className="relative hidden min-h-[calc(100vh-4rem)] overflow-hidden rounded-[32px] bg-[#382419] lg:block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={coffeeImage}
          alt="Tách cà phê BrewLite"
          className="absolute inset-0 size-full object-cover"
        />

        <div className="absolute inset-0 bg-gradient-to-t from-[#27160fe6] via-[#39211742] to-[#2d1d1428]" />

        <div className="absolute bottom-0 p-10 xl:p-14">
          <h2 className="font-serif text-4xl leading-tight text-white">
            Mỗi ngày trọn vị,
            <br />
            mỗi khoảnh khắc trọn vui.
          </h2>

          <p className="mt-5 max-w-md text-sm leading-6 text-white/80">
            Khám phá hương vị cà phê Việt được pha theo cách
            bạn yêu thích, giao đến tận tay trong vài chạm.
          </p>
        </div>
      </aside>
    </main>
  );
}
