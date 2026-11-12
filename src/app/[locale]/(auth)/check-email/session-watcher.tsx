"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * The confirmation link is usually opened in another tab. Cookies are shared between
 * tabs, so re-rendering this page on the server is enough to notice the new session:
 * refresh when the tab regains focus, and every few seconds while it is visible.
 */
export function SessionWatcher({ intervalMs = 5000 }: { intervalMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const timer = window.setInterval(refresh, intervalMs);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [router, intervalMs]);
  return null;
}
