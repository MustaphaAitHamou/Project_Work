"use client";

import { Link } from "@/i18n/navigation";

declare global {
  interface Window {
    googlefc?: { callbackQueue?: unknown[]; showRevocationMessage?: () => void };
  }
}

/**
 * Reopens the consent choices of Google's CMP. Falls back to the cookie policy when
 * the CMP is not loaded on the page.
 */
export function CookieSettingsLink({ label, className }: { label: string; className?: string }) {
  return (
    <Link
      href="/legal/cookies"
      className={className}
      onClick={(e) => {
        const fc = window.googlefc;
        if (fc?.showRevocationMessage) {
          e.preventDefault();
          fc.showRevocationMessage();
        } else if (fc?.callbackQueue) {
          e.preventDefault();
          fc.callbackQueue.push(() => window.googlefc?.showRevocationMessage?.());
        }
      }}
    >
      {label}
    </Link>
  );
}
