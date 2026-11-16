"use client";
import { useEffect, type ReactNode } from "react";
import { toast } from "sonner";
import type { ActionState } from "@/lib/action-state";
import { Alert, AlertDescription } from "@/components/ui/alert";

/**
 * Shows the result of a server action inline (and as a toast when requested).
 * Errors use role="alert" (announced immediately by screen readers); the alert is
 * re-mounted for each new result so that a repeated error is announced again.
 */
export function FormMessage({
  state,
  toastOnSuccess = false,
  children,
}: {
  state: ActionState | null | undefined;
  toastOnSuccess?: boolean;
  /** Extra content under the message (links, details). */
  children?: ReactNode;
}) {
  useEffect(() => {
    if (toastOnSuccess && state?.ok && state.message) toast.success(state.message);
  }, [state, toastOnSuccess]);
  if (!state?.message || (state.ok && toastOnSuccess)) return null;
  return (
    <Alert key={state.at} variant={state.ok ? "success" : "destructive"} aria-live={state.ok ? "polite" : undefined}>
      <AlertDescription>
        <p>{state.message}</p>
        {children}
      </AlertDescription>
    </Alert>
  );
}
