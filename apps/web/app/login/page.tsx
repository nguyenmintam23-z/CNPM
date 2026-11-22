"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import AuthShell from "../../components/auth/AuthShell";
import { LoginForm, type LoginValues } from "../../components/auth/AuthUI";

type ApiError = { message?: string | string[] };

function getErrorMessage(body: unknown, fallback: string): string {
  if (!body || typeof body !== "object" || !("message" in body)) return fallback;
  const message = (body as ApiError).message;
  if (typeof message === "string" && message.trim()) return message;
  if (Array.isArray(message)) {
    return message.filter((value) => typeof value === "string").join(". ") || fallback;
  }
  return fallback;
}

/** Chỉ chấp nhận đường dẫn nội bộ an toàn, giữ hành vi điều hướng cũ. */
function safeNextPath(nextParam: string | null): string | null {
  if (
    !nextParam ||
    !nextParam.startsWith("/") ||
    nextParam.startsWith("//") ||
    nextParam.startsWith("/\\") ||
    nextParam.includes("\\") ||
    nextParam.startsWith("/login") ||
    nextParam.startsWith("/register")
  ) {
    return null;
  }
  return nextParam;
}

/** Backend trả { user, role } từ GET /auth/me. */
function getSessionRole(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const role = (payload as { role?: unknown }).role;
  return typeof role === "string" ? role : null;
}

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleLogin(values: LoginValues) {
    if (isLoading) return;
    setIsLoading(true);
    setError("");
    try {
      const loginResponse = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        cache: "no-store",
        body: JSON.stringify({ email: values.email, password: values.password }),
      });
      if (!loginResponse.ok) {
        const body: unknown = await loginResponse.json().catch(() => null);
        setError(getErrorMessage(body, "Đăng nhập thất bại. Vui lòng thử lại."));
        return;
      }

      // Cookie HttpOnly do server quản lý. Xác minh phiên trước khi điều hướng.
      const meResponse = await fetch("/api/auth/me", {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
      });
      if (!meResponse.ok) {
        setError("Đăng nhập đã được xử lý nhưng chưa xác minh được phiên. Hãy kiểm tra cấu hình cookie và thử lại.");
        return;
      }

      const mePayload: unknown = await meResponse.json().catch(() => null);
      const role = getSessionRole(mePayload);

      // Giữ next hợp lệ. Nếu đăng nhập thông thường, MANAGER vào đúng FR-11.
      // CUSTOMER và các vai trò khác vẫn giữ điều hướng mặc định trước đây.
      const nextParam = new URLSearchParams(window.location.search).get("next");
      const destination = safeNextPath(nextParam) ?? (role === "MANAGER" ? "/manager/orders" : "/");
      router.replace(destination);
      router.refresh();
    } catch {
      setError("Không kết nối được hệ thống, vui lòng thử lại.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <AuthShell mode="login">
      <LoginForm
        onSubmit={handleLogin}
        isLoading={isLoading}
        error={error}
        onSwitchMode={() => router.push("/register")}
      />
    </AuthShell>
  );
}
