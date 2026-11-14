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
      <label htmlFor={id} className="mb-2 block text-[13px] font-bold text-[#173B20]">
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
          className={`h-[50px] w-full rounded-2xl border bg-[#fffef9] px-4 text-[15px] text-[#173B20] outline-none transition placeholder:text-[#82907e] focus:border-[#4d6e3d] focus:ring-4 focus:ring-[#A8BF8338] ${
            isPassword ? "pr-12" : ""
          } ${error ? "border-[#b74732]" : "border-[#d8dfca]"}`}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword((current) => !current)}
            className="absolute right-1.5 top-1.5 grid size-[38px] place-items-center rounded-xl text-[#60705a] transition hover:bg-[#edf2e5] hover:text-[#244A16] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#244A16]"
            aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
          >
            <EyeIcon hidden={showPassword} />
          </button>
        )}
      </div>
      {error && (
        <p id={`${id}-error`} className="mt-1.5 text-xs font-semibold text-[#a33f2c]">
          {error}
        </p>
      )}
    </div>
  );
}

export function Brand() {
  return (
    <div className="flex items-center gap-3" aria-label="BrewLite">
      <span className="grid size-11 place-items-center rounded-2xl bg-[#244A16] text-[#FFF9E9] shadow-[0_6px_16px_rgba(36,74,22,0.18)]">
        <svg aria-hidden="true" viewBox="0 0 40 40" className="size-7" fill="none">
          <path
            d="M20 31.5C10.6 29.2 6.5 20.6 10.2 8.8c8.7.2 16.2 3.1 18.2 10.2 1.5 5.4-1.5 10.5-8.4 12.5Z"
            fill="currentColor"
          />
          <path
            d="M13.5 13.5c4.8 3.1 7.7 7.7 6.5 18M20.2 23.3c1.5-2.2 3.6-3.9 6.1-4.9M18.1 19.1c-1.7.2-3.4-.2-5-1.1"
            stroke="#244A16"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </span>
      <div>
        <span className="font-display block text-[27px] font-bold leading-none tracking-[-0.035em] text-[#173B20]">
          BrewLite
        </span>
        <span className="mt-1 block text-[9px] font-bold uppercase tracking-[0.24em] text-[#6d825a]">
          Vietnamese coffee
        </span>
      </div>
    </div>
  );
}

function FormMessage({ children }: { children: ReactNode }) {
  return (
    <div
      role="alert"
      className="flex gap-2.5 rounded-2xl border border-[#e0b8aa] bg-[#fff7f1] px-3.5 py-3 text-sm leading-5 text-[#873c2d]"
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
      className="mt-2 flex h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-[#244A16] px-5 text-sm font-bold text-white shadow-[0_10px_24px_rgba(36,74,22,0.2)] transition hover:-translate-y-0.5 hover:bg-[#173B20] hover:shadow-[0_12px_28px_rgba(36,74,22,0.25)] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#A8BF8370] disabled:pointer-events-none disabled:opacity-65"
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
        <p className="mb-2.5 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-[#6f865d]">
          <span className="h-px w-7 bg-[#A8BF83]" />
          Chào mừng trở lại
        </p>
        <h1 className="font-display text-[2.5rem] font-bold leading-[1.1] tracking-[-0.035em] text-[#173B20]">
          Đăng nhập
        </h1>
        <p className="mt-3 text-sm leading-6 text-[#61705b]">
          Tiếp tục hành trình thưởng thức cà phê Việt theo cách của riêng bạn.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {(error || validationError) && <FormMessage>{error || validationError}</FormMessage>}
        <TextField
          label="Địa chỉ email"
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
        <div className="flex items-center justify-between gap-3 text-xs">
          <label className="flex items-center gap-2 font-semibold text-[#50634a]">
            <input
              name="remember"
              type="checkbox"
              className="size-4 rounded border-[#b9c6ad] accent-[#244A16]"
            />
            Ghi nhớ đăng nhập
          </label>
          <span className="font-semibold text-[#6a7d60]" title="Tính năng đang được phát triển">
            Quên mật khẩu <span className="font-medium text-[#87947d]">(sắp có)</span>
          </span>
        </div>
        <SubmitButton isLoading={isLoading}>Đăng nhập</SubmitButton>
      </form>

      <p className="mt-6 text-center text-sm text-[#65715f]">
        Chưa có tài khoản?{" "}
        <button
          type="button"
          onClick={onSwitchMode}
          className="font-bold text-[#244A16] hover:text-[#173B20] hover:underline"
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
      <div className="mb-5">
        <p className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-[#6f865d]">
          <span className="h-px w-7 bg-[#A8BF83]" />
          Thành viên BrewLite
        </p>
        <h1 className="font-display text-[2.25rem] font-bold leading-[1.1] tracking-[-0.035em] text-[#173B20]">
          Đăng ký tài khoản
        </h1>
        <p className="mt-2 text-sm leading-6 text-[#61705b]">
          Lưu hương vị yêu thích và tận hưởng trải nghiệm riêng của bạn.
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
          label="Địa chỉ email"
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
        <p className="text-[11px] leading-5 text-[#75806f]">
          Bằng việc đăng ký, bạn đồng ý với Điều khoản sử dụng của BrewLite.
        </p>
        <SubmitButton isLoading={isLoading}>Tạo tài khoản</SubmitButton>
      </form>

      <p className="mt-5 text-center text-sm text-[#65715f]">
        Đã có tài khoản?{" "}
        <button
          type="button"
          onClick={onSwitchMode}
          className="font-bold text-[#244A16] hover:text-[#173B20] hover:underline"
        >
          Đăng nhập
        </button>
      </p>
    </div>
  );
}

export default LoginForm;
