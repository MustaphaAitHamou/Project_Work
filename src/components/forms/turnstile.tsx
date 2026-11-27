"use client";
import { useEffect, useRef } from "react";
import { useLocale } from "next-intl";

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      reset: (id: string) => void;
      remove: (id: string) => void;
    };
  }
}

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

/**
 * Cloudflare Turnstile widget. Renders nothing when no site key is configured. Its token is put
 * in a hidden field of the surrounding form and checked by the server (Supabase Auth, or
 * verifyTurnstile for the application's own forms).
 *
 * A token can be used once and expires after 5 minutes. The widget is therefore reset after
 * every submission of its form, once the form data has been read: a second attempt (after a
 * wrong password, for example) gets a fresh token instead of a used one. The field is emptied
 * when the token expires or the check fails, so the server reports a clear error.
 */
export function Turnstile({ name = "captchaToken" }: { name?: string }) {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const ref = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const locale = useLocale();
  useEffect(() => {
    if (!siteKey || !ref.current) return;
    let widgetId: string | undefined;
    const setToken = (value: string) => {
      if (input.current) input.current.value = value;
    };
    const render = () => {
      if (!window.turnstile || !ref.current || widgetId !== undefined) return;
      widgetId = window.turnstile.render(ref.current, {
        sitekey: siteKey,
        language: locale,
        callback: (token: string) => setToken(token),
        "expired-callback": () => setToken(""),
        "error-callback": () => setToken(""),
        "timeout-callback": () => setToken(""),
      });
    };
    // Deferred: the form's submit handler reads the token first (it runs after this listener).
    const form = input.current?.form ?? null;
    const onSubmit = () => {
      window.setTimeout(() => {
        setToken("");
        if (widgetId !== undefined) window.turnstile?.reset(widgetId);
      }, 0);
    };
    form?.addEventListener("submit", onSubmit);

    let script: HTMLScriptElement | null = null;
    if (window.turnstile) render();
    else {
      script = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`);
      if (!script) {
        script = document.createElement("script");
        script.src = SCRIPT_SRC;
        script.async = true;
        document.head.appendChild(script);
      }
      script.addEventListener("load", render);
    }
    return () => {
      form?.removeEventListener("submit", onSubmit);
      script?.removeEventListener("load", render);
      if (widgetId !== undefined) window.turnstile?.remove(widgetId);
    };
  }, [siteKey, locale]);
  if (!siteKey) return null;
  return (
    <>
      <div ref={ref} data-testid="turnstile" />
      <input ref={input} type="hidden" name={name} />
    </>
  );
}
