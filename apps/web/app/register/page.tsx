"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import AuthShell from "../../components/auth/AuthShell";
import { RegisterForm, type RegisterValues } from "../../components/auth/AuthUI";

type ApiError = { message?: string | string[] };

function getErrorMessage(body: unknown, fallback: string): string {
  if (!body || typeof body !== "object" || !("message" in body)) return fallback;
  const message = (body as ApiError).message;
  if (typeof message === "string" && message.trim()) return message;
  if (Array.isArray(message)) {
    const parts = message.filter((part): part is string => typeof part === "string");
    return parts.length ? parts.join(". ") : fallback;
  }
  return fallback;
}

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleRegister(values: RegisterValues) {
    if (isLoading) return;
    setIsLoading(true);
    setError("");

    try {
      // confirmPassword is validated by RegisterForm, but is not part
      // of the NestJS register DTO; do not send extra fields.
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        cache: "no-store",
        body: JSON.stringify({
          fullName: values.fullName.trim(),
          email: values.email.trim(),
          password: values.password,
        }),
      });

      if (response.status === 201) {
        // Registration doesn't set a session cookie; login is separate.
        router.replace("/login");
        return;
      }

      const body: unknown = await response.json().catch(() => null);
      setError(getErrorMessage(body, "Không thể tạo tài khoản. Vui lòng thử lại."));
    } catch {
      setError("Không thể kết nối hệ thống đăng ký. Kiểm tra Backend và thử lại.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <AuthShell mode="register">
      <RegisterForm
        onSubmit={handleRegister}
        isLoading={isLoading}
        error={error}
        onSwitchMode={() => router.push("/login")}
      />
    </AuthShell>
  );
}
