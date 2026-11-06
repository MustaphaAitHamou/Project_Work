"use client";
import { useActionState, useCallback, useEffect, useRef, useState } from "react";
import { useLocale } from "next-intl";
import { toast } from "sonner";
import { initialActionState, type ActionState } from "@/lib/action-state";
import { ActionForm } from "@/components/forms/action-form";
import { SubmitButton } from "@/components/forms/submit-button";
import { FormMessage } from "@/components/forms/form-message";
import type { ButtonProps } from "@/components/ui/button";

/**
 * Generic back-office form: hidden fields + children, toast on success, inline error.
 * The success toast is raised as soon as the server action resolves (not in an effect),
 * so it is shown even when the revalidated page no longer renders this form (e.g. after
 * an erasure or a revocation). The server actions revalidate the page themselves.
 */
export function AdminForm({
  action,
  hidden = {},
  submitLabel,
  confirmText,
  variant = "default",
  size = "default",
  className,
  children,
  onSuccess,
}: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  hidden?: Record<string, string>;
  submitLabel: string;
  confirmText?: string;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  className?: string;
  children?: React.ReactNode;
  onSuccess?: (state: ActionState) => void;
}) {
  const locale = useLocale();
  const onSuccessRef = useRef(onSuccess);
  useEffect(() => {
    onSuccessRef.current = onSuccess;
  }, [onSuccess]);
  const run = useCallback(
    async (prev: ActionState, fd: FormData) => {
      const result = await action(prev, fd);
      if (result.ok) {
        toast.success(result.message);
        onSuccessRef.current?.(result);
      }
      return result;
    },
    [action],
  );
  const [state, formAction] = useActionState(run, initialActionState);
  const [confirmed, setConfirmed] = useState(!confirmText);
  return (
    <ActionForm action={formAction} className={className ?? "space-y-3"}>
      <input type="hidden" name="locale" value={locale} />
      {Object.entries(hidden).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      {!state.ok && <FormMessage state={state} />}
      {children}
      {confirmText && (
        <label className="flex items-start gap-2 text-xs text-muted-foreground">
          <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-0.5" />
          {confirmText}
        </label>
      )}
      <SubmitButton variant={variant} size={size} disabled={!confirmed}>
        {submitLabel}
      </SubmitButton>
    </ActionForm>
  );
}
