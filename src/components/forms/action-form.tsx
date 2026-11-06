"use client";
import { createContext, useContext, useTransition, type FormHTMLAttributes } from "react";

const PendingContext = createContext(false);

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
  return (
    <PendingContext.Provider value={pending}>
      <form
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
    </PendingContext.Provider>
  );
}

export function useActionFormPending() {
  return useContext(PendingContext);
}
