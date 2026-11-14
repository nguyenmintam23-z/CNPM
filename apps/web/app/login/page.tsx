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
  if (Array.isArray(message)) return message.filter((x) => typeof x === "string").join(". ") || fallback;
  return fallback;
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

      // The HttpOnly session cookie is managed by the server. Verify it via /me.
      const meResponse = await fetch("/api/auth/me", {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
      });

      if (!meResponse.ok) {
        setError("Đăng nhập đã được xử lý nhưng chưa xác minh được phiên. Hãy kiểm tra cấu hình cookie và thử lại.");
        return;
      }

      // Return only to an internal path; never redirect to an external URL.
      const nextParam = new URLSearchParams(window.location.search).get("next");
      const destination = nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//") && !nextParam.startsWith("/\\") && !nextParam.includes("\\") && !nextParam.startsWith("/login") && !nextParam.startsWith("/register") ? nextParam : "/";
      router.replace(destination);
      router.refresh();
    } catch {
      setError("Không thể kết nối hệ thống đăng nhập. Kiểm tra Backend và thử lại.");
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
