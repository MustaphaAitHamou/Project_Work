"use client";
import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useCaptchaGate } from "./action-form";

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

type WidgetStatus = "pending" | "ready" | "error";

/**
 * Cloudflare Turnstile widget. Renders nothing when no site key is configured. Its token goes in
 * a hidden field of the surrounding form and is checked ONCE by the server: by Supabase Auth for
 * the authentication forms, by verifyTurnstile for the application's own forms.
 *
 * A token is single-use and expires after 300 seconds:
 * - the form's submit button stays disabled until the widget has issued a token, so a form is
 *   never sent without one (or with an expired one: Turnstile renews it by itself);
 * - as soon as a submission takes the token away, the field is emptied and the widget reset: a
 *   second attempt (after a wrong password, for example) always gets a new token;
 * - an error of the widget (blocked script, network) is explained under it.
 */
export function Turnstile({ name = "captchaToken" }: { name?: string }) {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const ref = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const widget = useRef<string | undefined>(undefined);
  const locale = useLocale();
  const t = useTranslations("common");
  const gate = useCaptchaGate();
  const report = gate?.report;
  const inForm = gate !== null;
  const consumed = gate?.consumed ?? 0;
  const [status, setStatus] = useState<WidgetStatus>("pending");

  // Tells the surrounding form whether a usable token is there.
  useEffect(() => {
    if (siteKey && report) report(status === "ready" ? "ready" : "pending");
  }, [siteKey, report, status]);
  useEffect(() => () => report?.("none"), [report]);

  // A submission took the token: never send it twice, prepare a new one.
  const lastConsumed = useRef(consumed);
  useEffect(() => {
    if (consumed === lastConsumed.current) return;
    lastConsumed.current = consumed;
    if (input.current) input.current.value = "";
    setStatus("pending");
    if (widget.current !== undefined) window.turnstile?.reset(widget.current);
  }, [consumed]);

  useEffect(() => {
    if (!siteKey || !ref.current) return;
    const set = (token: string, next: WidgetStatus) => {
      if (input.current) input.current.value = token;
      setStatus(next);
    };
    const render = () => {
      if (!window.turnstile || !ref.current || widget.current !== undefined) return;
      widget.current = window.turnstile.render(ref.current, {
        sitekey: siteKey,
        language: locale,
        // An expired token is renewed automatically; until then the form waits.
        "refresh-expired": "auto",
        callback: (token: string) => set(token, "ready"),
        "expired-callback": () => set("", "pending"),
        "timeout-callback": () => set("", "pending"),
        // Turnstile retries by itself; a later success clears the message.
        "error-callback": () => set("", "error"),
      });
    };
    // Outside an ActionForm (no gate): reset after each native submission, once the form data
    // has been read (this listener runs before the form's own submit handler).
    const form = input.current?.form ?? null;
    const onNativeSubmit = () => {
      window.setTimeout(() => {
        set("", "pending");
        if (widget.current !== undefined) window.turnstile?.reset(widget.current);
      }, 0);
    };
    if (!inForm) form?.addEventListener("submit", onNativeSubmit);

    let script: HTMLScriptElement | null = null;
    if (window.turnstile) render();
    else {
      script = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`);
      if (!script) {
        script = document.createElement("script");
        script.src = SCRIPT_SRC;
        script.async = true;
        script.addEventListener("error", () => set("", "error"));
        document.head.appendChild(script);
      }
      script.addEventListener("load", render);
    }
    return () => {
      if (!inForm) form?.removeEventListener("submit", onNativeSubmit);
      script?.removeEventListener("load", render);
      if (widget.current !== undefined) window.turnstile?.remove(widget.current);
      widget.current = undefined;
    };
  }, [siteKey, locale, inForm]);

  if (!siteKey) return null;
  return (
    <div className="space-y-1.5">
      <div ref={ref} data-testid="turnstile" />
      <input ref={input} type="hidden" name={name} />
      <p role="status" data-testid="turnstile-status" className={status === "error" ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>
        {status === "pending" ? t("captchaPending") : status === "error" ? t("captchaError") : null}
      </p>
    </div>
  );
}
