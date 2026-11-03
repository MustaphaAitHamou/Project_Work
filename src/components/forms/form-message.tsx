"use client";
import { useEffect } from "react";
import { toast } from "sonner";
import type { ActionState } from "@/lib/action-state";
import { Alert, AlertDescription } from "@/components/ui/alert";

/** Shows the result of a server action inline (and as a toast when requested). */
export function FormMessage({ state, toastOnSuccess = false }: { state: ActionState | null | undefined; toastOnSuccess?: boolean }) {
  useEffect(() => {
    if (toastOnSuccess && state?.ok && state.message) toast.success(state.message);
  }, [state, toastOnSuccess]);
  if (!state?.message || (state.ok && toastOnSuccess)) return null;
  return (
    <Alert variant={state.ok ? "success" : "destructive"} aria-live="polite">
      <AlertDescription>{state.message}</AlertDescription>
    </Alert>
  );
}
