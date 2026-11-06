"use client";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { useActionFormPending } from "./action-form";

export function SubmitButton({ children, pendingLabel, disabled, ...props }: ButtonProps & { pendingLabel?: string }) {
  const status = useFormStatus();
  const actionPending = useActionFormPending();
  const pending = status.pending || actionPending;
  // `disabled` from the caller must not re-enable the button while the form is pending.
  return (
    <Button type="submit" {...props} disabled={pending || disabled} aria-disabled={pending || undefined}>
      {pending && <Loader2 className="animate-spin" aria-hidden />}
      {pending && pendingLabel ? pendingLabel : children}
    </Button>
  );
}
