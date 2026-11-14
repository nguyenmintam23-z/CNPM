"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import AuthShell from "../../components/auth/AuthShell";
import { LoginForm, type LoginValues } from "../../components/auth/AuthUI";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState("");

  function handleLogin(values: LoginValues) {
    void values;
    setError("Chức năng đăng nhập đang chờ kết nối Backend.");
  }

  return (
    <AuthShell mode="login">
      <LoginForm
        onSubmit={handleLogin}
        error={error}
        onSwitchMode={() => router.push("/register")}
      />
    </AuthShell>
  );
}
