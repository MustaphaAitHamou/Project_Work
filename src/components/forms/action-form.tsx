"use client";
import { createContext, useContext, useSyncExternalStore, useTransition, type FormHTMLAttributes } from "react";

const PendingContext = createContext(false);
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
  // Before the page's JavaScript runs, a submission would be a plain browser submission to the
  // current address: a GET would put every field (password included) in the URL, the history and
  // the server logs. The submit buttons stay disabled until then, and the method is POST anyway.
  // Server render and hydration: false; once hydrated: true.
  const ready = useSyncExternalStore(subscribeNothing, () => true, () => false);
  return (
    <PendingContext.Provider value={pending}>
      <ReadyContext.Provider value={ready}>
        <form
          method="post"
          {...props}
          aria-busy={pending || undefined}
          onSubmit={(e) => {
            e.preventDefault();
            if (pending) return;
            const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
            const formData = new FormData(e.currentTarget, submitter ?? undefined);
            startTransition(() => action(formData));
          }}
        >
          {children}
        </form>
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
