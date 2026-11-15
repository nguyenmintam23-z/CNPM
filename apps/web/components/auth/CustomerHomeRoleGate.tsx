"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

type Role = "CUSTOMER" | "STAFF" | "MANAGER";
type GateState = "checking" | "allowed" | "error";

function getRole(payload: unknown): Role | null {
  if (!payload || typeof payload !== "object") return null;
  const data = payload as Record<string, unknown>;
  const user = data.user;
  const candidate =
    typeof data.role === "string"
      ? data.role
      : user && typeof user === "object"
        ? (user as Record<string, unknown>).role
        : null;

  return candidate === "CUSTOMER" || candidate === "STAFF" || candidate === "MANAGER"
    ? candidate
    : null;
}

export default function CustomerHomeRoleGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<GateState>("checking");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    async function checkSession() {
      try {
        const response = await fetch("/api/auth/me", {
          method: "GET",
          cache: "no-store",
          credentials: "same-origin",
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;

        // Đừng đọc JSON khi API trả 401/403: một số phản hồi không có body.
        if (response.status === 401 || response.status === 403) {
          router.replace("/login?next=%2F");
          return;
        }
        if (!response.ok) {
          setState("error");
          return;
        }

        const payload: unknown = await response.json().catch(() => null);
        if (controller.signal.aborted) return;
        const role = getRole(payload);
        if (role === "MANAGER") {
          router.replace("/manager/orders");
        } else if (role === "STAFF") {
          router.replace("/staff/orders");
        } else if (role === "CUSTOMER") {
          setState("allowed");
        } else {
          // Không đoán quyền khi phiên thiếu hoặc sai trường role.
          setState("error");
        }
      } catch {
        if (!controller.signal.aborted) setState("error");
      }
    }

    void checkSession();
    return () => controller.abort();
  }, [router, attempt]);

  if (state === "allowed") return <>{children}</>;

  return (
    <main className="grid min-h-screen place-items-center bg-[#FFF1C7] px-4 text-[#173B20]">
      <section className="w-full max-w-md rounded-2xl border border-[#d9ddc7] bg-[#FFF9E9] p-7 text-center shadow-sm">
        {state === "checking" ? (
          <p role="status">Đang xác minh tài khoản và chuyển đến giao diện phù hợp…</p>
        ) : (
          <>
            <h1 className="text-xl font-semibold">Không thể kiểm tra phiên đăng nhập</h1>
            <p className="mt-2 text-sm">Vui lòng kiểm tra kết nối và thử lại.</p>
            <button
              type="button"
              className="mt-5 rounded-xl bg-[#244A16] px-5 py-3 font-semibold text-white"
              onClick={() => {
                setState("checking");
                setAttempt((value) => value + 1);
              }}
            >
              Thử lại
            </button>
          </>
        )}
      </section>
    </main>
  );
}
