"use client";
import { createContext, useContext, useMemo, useState, useSyncExternalStore, useTransition, type FormHTMLAttributes } from "react";

const PendingContext = createContext(false);

/**
 * Anti-robot widget of the form (components/forms/turnstile.tsx): "none" without widget,
 * "pending" until it has issued a token (the form cannot be sent), "ready" with a token.
 * `consumed` grows each time a submission takes the token away: the widget then clears it and
 * prepares a new one, so that a token is never sent twice (Cloudflare accepts it only once).
 */
export type CaptchaStatus = "none" | "pending" | "ready";
type CaptchaGate = { status: CaptchaStatus; report: (status: CaptchaStatus) => void; consumed: number };
const CaptchaContext = createContext<CaptchaGate | null>(null);
/** False until the form's JavaScript is running (outside an ActionForm: always true). */
const ReadyContext = createContext(true);
const subscribeNothing = () => () => {};

/**
 * Form bound to a Server Action that keeps the user's input when the action returns
 * (React 19 resets uncontrolled fields after `<form action>` submissions, which would
 * wipe a long form after a validation error). The submitter's name/value is preserved.
 */
export function ActionForm({
  action,
  children,
  ...props
}: Omit<FormHTMLAttributes<HTMLFormElement>, "action" | "onSubmit"> & { action: (formData: FormData) => void }) {
  const [pending, startTransition] = useTransition();
  const [captcha, setCaptcha] = useState<CaptchaStatus>("none");
  const [consumed, setConsumed] = useState(0);
  const gate = useMemo<CaptchaGate>(() => ({ status: captcha, report: setCaptcha, consumed }), [captcha, consumed]);
  // Before the page's JavaScript runs, a submission would be a plain browser submission to the
  // current address: a GET would put every field (password included) in the URL, the history and
  // the server logs. The submit buttons stay disabled until then, and the method is POST anyway.
  // Server render and hydration: false; once hydrated: true.
  const ready = useSyncExternalStore(subscribeNothing, () => true, () => false);
  return (
    <PendingContext.Provider value={pending}>
      <ReadyContext.Provider value={ready}>
       <CaptchaContext.Provider value={gate}>
        <form
          method="post"
          {...props}
          aria-busy={pending || undefined}
          onSubmit={(e) => {
            e.preventDefault();
            if (pending) return;
            // No anti-robot token yet: nothing is sent (the submit button is disabled as well).
            if (captcha === "pending") return;
            const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
            const formData = new FormData(e.currentTarget, submitter ?? undefined);
            // The token leaves with this submission: the widget prepares a fresh one for a next attempt.
            if (captcha === "ready") setConsumed((n) => n + 1);
            startTransition(() => action(formData));
          }}
        >
          {children}
        </form>
       </CaptchaContext.Provider>
      </ReadyContext.Provider>
    </PendingContext.Provider>
  );
}

export function useActionFormPending() {
  return useContext(PendingContext);
}

export function useActionFormReady() {
  return useContext(ReadyContext);
}

/** The anti-robot gate of the surrounding ActionForm (null outside one). */
export function useCaptchaGate() {
  return useContext(CaptchaContext);
}
