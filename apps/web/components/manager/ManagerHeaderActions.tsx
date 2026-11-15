"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import styles from "./ManagerHeaderActions.module.css";

type Props = {
  onRefresh: () => void;
  refreshDisabled?: boolean;
};

export default function ManagerHeaderActions({ onRefresh, refreshDisabled = false }: Props) {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");

  async function handleLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    setLogoutError("");

    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
      });

      // A 401 means the session has already expired, so it is safe to show login.
      if (!response.ok && response.status !== 401) {
        throw new Error("Logout API failed");
      }

      router.replace("/login");
      router.refresh();
    } catch {
      setLogoutError("Không thể đăng xuất. Vui lòng thử lại.");
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <div className={styles.actions}>
      <button
        type="button"
        className={styles.refreshButton}
        disabled={refreshDisabled || loggingOut}
        onClick={onRefresh}
      >
        Làm mới
      </button>
      <button
        type="button"
        className={styles.logoutButton}
        disabled={loggingOut}
        onClick={() => void handleLogout()}
      >
        {loggingOut ? "Đang đăng xuất…" : "Đăng xuất"}
      </button>
      {logoutError && <p className={styles.error} role="alert">{logoutError}</p>}
    </div>
  );
}
