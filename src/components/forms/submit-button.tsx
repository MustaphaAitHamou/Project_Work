"use client";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { useActionFormPending, useActionFormReady, useCaptchaGate } from "./action-form";

export function SubmitButton({ children, pendingLabel, disabled, ...props }: ButtonProps & { pendingLabel?: string }) {
  const status = useFormStatus();
  const actionPending = useActionFormPending();
  const ready = useActionFormReady();
  // Waiting for the anti-robot widget's token (see Turnstile): sending now would be refused.
  const captchaPending = useCaptchaGate()?.status === "pending";
  const pending = status.pending || actionPending;
  // `disabled` from the caller must not re-enable the button while the form is pending, nor
  // before the form's JavaScript runs (see ActionForm).
  return (
    <Button type="submit" {...props} disabled={pending || disabled || !ready || captchaPending} aria-disabled={pending || undefined}>
      {pending && <Loader2 className="animate-spin" aria-hidden />}
      {pending && pendingLabel ? pendingLabel : children}
    </Button>
  );
}
