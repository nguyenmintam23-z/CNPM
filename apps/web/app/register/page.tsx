"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import AuthShell from "../../components/auth/AuthShell";
import { RegisterForm, type RegisterValues } from "../../components/auth/AuthUI";

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState("");

  function handleRegister(values: RegisterValues) {
    void values;
    setError("Chức năng đăng ký đang chờ kết nối Backend.");
  }

  return (
    <AuthShell mode="register">
      <RegisterForm
        onSubmit={handleRegister}
        error={error}
        onSwitchMode={() => router.push("/login")}
      />
    </AuthShell>
  );
}
