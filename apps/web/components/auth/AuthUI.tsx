"use client";

import { FormEvent, ReactNode, useId, useState } from "react";

export type LoginValues = {
  email: string;
  password: string;
};

export type RegisterValues = LoginValues & {
  fullName: string;
  confirmPassword: string;
};

type AuthFormProps<T> = {
  onSubmit: (values: T) => void | Promise<void>;
  isLoading?: boolean;
  error?: string;
  onSwitchMode: () => void;
};

type TextFieldProps = {
  label: string;
  name: string;
  type?: "text" | "email" | "password";
  placeholder: string;
  autoComplete: string;
  error?: string;
};

function EyeIcon({ hidden }: { hidden: boolean }) {
  return hidden ? (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="size-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="m3 3 18 18M10.6 10.7a2 2 0 0 0 2.7 2.7M9.9 4.4A10.8 10.8 0 0 1 12 4c5.2 0 9 5.3 9 5.3a15.2 15.2 0 0 1-2.4 2.8M6.6 6.6A17.7 17.7 0 0 0 3 9.3S6.8 14.7 12 14.7c.7 0 1.4-.1 2-.3" />
    </svg>
  ) : (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="size-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="M3 12s3.8-5.3 9-5.3 9 5.3 9 5.3-3.8 5.3-9 5.3S3 12 3 12Z" />
      <circle cx="12" cy="12" r="2.3" />
    </svg>
  );
}

function TextField({
  label,
  name,
  type = "text",
  placeholder,
  autoComplete,
  error,
}: TextFieldProps) {
  const id = useId();
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === "password";

  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-sm font-semibold text-[#39271e]">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          name={name}
          type={isPassword && showPassword ? "text" : type}
          placeholder={placeholder}
          autoComplete={autoComplete}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          className={`h-12 w-full rounded-xl border bg-white/80 px-4 text-[15px] text-[#2d211b] outline-none transition placeholder:text-[#a19288] focus:border-[#9b6240] focus:ring-4 focus:ring-[#a96d4720] ${
            isPassword ? "pr-12" : ""
          } ${error ? "border-[#b74732]" : "border-[#dfd2c6]"}`}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword((current) => !current)}
            className="absolute right-1.5 top-1.5 flex size-9 items-center justify-center rounded-lg text-[#75645a] transition hover:bg-[#f5eee7] hover:text-[#4f3425] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#9b6240]"
            aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
          >
            <EyeIcon hidden={showPassword} />
          </button>
        )}
      </div>
      {error && (
        <p id={`${id}-error`} className="mt-1.5 text-xs font-medium text-[#a33f2c]">
          {error}
        </p>
      )}
    </div>
  );
}

export function Brand() {
  return (
    <div className="flex items-center gap-3" aria-label="BrewLite">
      <span className="grid size-10 place-items-center rounded-[14px] bg-[#4a2d1e] text-[#f8ead9] shadow-sm shadow-[#3d251940]">
        <svg aria-hidden="true" viewBox="0 0 32 32" className="size-6" fill="none">
          <path
            d="M9.3 24.3C4.7 20.7 5.4 13 10.8 8.5c5.4-4.5 12.8-4 15.4.2 2.5 4.1.3 11.4-5.1 15.6-4.2 3.3-8.5 2.6-11.8 0Z"
            fill="currentColor"
          />
          <path
            d="M9.1 23.5c4-2.6 5.1-5.7 5-8.2-.2-3.7 2.3-6.1 7-7.8"
            stroke="#4a2d1e"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        </svg>
      </span>
      <span className="font-display text-[26px] font-semibold tracking-[-0.025em] text-[#3b261b]">
        Brew<span className="text-[#a7663e]">Lite</span>
      </span>
    </div>
  );
}

function FormMessage({ children }: { children: ReactNode }) {
  return (
    <div
      role="alert"
      className="flex gap-2.5 rounded-xl border border-[#e0b8aa] bg-[#fff7f3] px-3.5 py-3 text-sm leading-5 text-[#873c2d]"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="mt-0.5 size-4 shrink-0"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v5M12 16.5h.01" />
      </svg>
      <span>{children}</span>
    </div>
  );
}

function SubmitButton({ isLoading, children }: { isLoading?: boolean; children: ReactNode }) {
  return (
    <button
      type="submit"
      disabled={isLoading}
      className="mt-1 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#4a2d1e] px-5 text-sm font-bold text-[#fffaf4] shadow-[0_8px_20px_rgba(74,45,30,0.18)] transition hover:-translate-y-0.5 hover:bg-[#5b3825] hover:shadow-[0_10px_24px_rgba(74,45,30,0.24)] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#a96d4740] disabled:pointer-events-none disabled:opacity-70"
    >
      {isLoading && (
        <span
          className="size-4 animate-spin rounded-full border-2 border-white/35 border-t-white"
          aria-hidden="true"
        />
      )}
      {isLoading ? "Đang xử lý..." : children}
    </button>
  );
}

export function LoginForm({
  onSubmit,
  isLoading,
  error,
  onSwitchMode,
}: AuthFormProps<LoginValues>) {
  const [validationError, setValidationError] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const values = {
      email: String(data.get("email") ?? "").trim(),
      password: String(data.get("password") ?? ""),
    };

    if (!values.email || !values.password) {
      setValidationError("Vui lòng nhập đầy đủ email và mật khẩu.");
      return;
    }

    setValidationError("");
    void onSubmit(values);
  }

  return (
    <div>
      <div className="mb-7">
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-[#a7663e]">
          Chào mừng trở lại
        </p>
        <h1 className="font-display text-[2rem] font-semibold leading-tight tracking-[-0.025em] text-[#302018]">
          Đăng nhập BrewLite
        </h1>
        <p className="mt-2 text-sm leading-6 text-[#79695f]">
          Đăng nhập để gọi món nhanh hơn và theo dõi đơn hàng của bạn.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {(error || validationError) && <FormMessage>{error || validationError}</FormMessage>}
        <TextField
          label="Email"
          name="email"
          type="email"
          placeholder="ban@example.com"
          autoComplete="email"
        />
        <TextField
          label="Mật khẩu"
          name="password"
          type="password"
          placeholder="Nhập mật khẩu"
          autoComplete="current-password"
        />
        <SubmitButton isLoading={isLoading}>Đăng nhập</SubmitButton>
      </form>

      <p className="mt-6 text-center text-sm text-[#79695f]">
        Chưa có tài khoản?{" "}
        <button
          type="button"
          onClick={onSwitchMode}
          className="font-bold text-[#8c5738] hover:text-[#593520] hover:underline"
        >
          Đăng ký ngay
        </button>
      </p>
    </div>
  );
}

export function RegisterForm({
  onSubmit,
  isLoading,
  error,
  onSwitchMode,
}: AuthFormProps<RegisterValues>) {
  const [validationError, setValidationError] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const values = {
      fullName: String(data.get("fullName") ?? "").trim(),
      email: String(data.get("email") ?? "").trim(),
      password: String(data.get("password") ?? ""),
      confirmPassword: String(data.get("confirmPassword") ?? ""),
    };

    if (Object.values(values).some((value) => !value)) {
      setValidationError("Vui lòng điền đầy đủ thông tin đăng ký.");
      return;
    }
    if (values.password.length < 8) {
      setValidationError("Mật khẩu cần có ít nhất 8 ký tự.");
      return;
    }
    if (values.password !== values.confirmPassword) {
      setValidationError("Mật khẩu xác nhận chưa trùng khớp.");
      return;
    }

    setValidationError("");
    void onSubmit(values);
  }

  return (
    <div>
      <div className="mb-6">
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-[#a7663e]">
          Bắt đầu thật dễ dàng
        </p>
        <h1 className="font-display text-[2rem] font-semibold leading-tight tracking-[-0.025em] text-[#302018]">
          Tạo tài khoản mới
        </h1>
        <p className="mt-2 text-sm leading-6 text-[#79695f]">
          Lưu món yêu thích và nhận ưu đãi riêng từ BrewLite.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3.5" noValidate>
        {(error || validationError) && <FormMessage>{error || validationError}</FormMessage>}
        <TextField
          label="Họ và tên"
          name="fullName"
          placeholder="Nguyễn Minh Anh"
          autoComplete="name"
        />
        <TextField
          label="Email"
          name="email"
          type="email"
          placeholder="ban@example.com"
          autoComplete="email"
        />
        <div className="grid gap-3.5 sm:grid-cols-2">
          <TextField
            label="Mật khẩu"
            name="password"
            type="password"
            placeholder="Tối thiểu 8 ký tự"
            autoComplete="new-password"
          />
          <TextField
            label="Xác nhận mật khẩu"
            name="confirmPassword"
            type="password"
            placeholder="Nhập lại mật khẩu"
            autoComplete="new-password"
          />
        </div>
        <p className="text-xs leading-5 text-[#89796f]">
          Bằng việc đăng ký, bạn đồng ý với Điều khoản sử dụng của BrewLite.
        </p>
        <SubmitButton isLoading={isLoading}>Tạo tài khoản</SubmitButton>
      </form>

      <p className="mt-5 text-center text-sm text-[#79695f]">
        Đã có tài khoản?{" "}
        <button
          type="button"
          onClick={onSwitchMode}
          className="font-bold text-[#8c5738] hover:text-[#593520] hover:underline"
        >
          Đăng nhập
        </button>
      </p>
    </div>
  );
}

export default LoginForm;
