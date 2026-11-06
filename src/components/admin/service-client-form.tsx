"use client";
import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";
import { Copy } from "lucide-react";
import { toast } from "sonner";
import type { ActionState } from "@/lib/action-state";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AdminForm } from "./admin-form";

/** Creates a Tamurt HQ API client and shows its token exactly once (only a hash is stored). */
export function ServiceClientForm({ action }: { action: (prev: ActionState, fd: FormData) => Promise<ActionState<{ token: string }>> }) {
  const t = useTranslations("admin.settings");
  const [token, setToken] = useState<string | null>(null);
  const onSuccess = useCallback((s: ActionState) => setToken((s.data as { token?: string } | undefined)?.token ?? null), []);
  return (
    <div className="space-y-4">
      <AdminForm action={action as (prev: ActionState, fd: FormData) => Promise<ActionState>} submitLabel={t("createClient")} onSuccess={onSuccess} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <label className="space-y-1 text-sm">
          <span className="font-medium">{t("clientName")}</span>
          <Input name="name" required minLength={2} maxLength={80} placeholder="Tamurt HQ" />
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">{t("allowedIps")}</span>
          <Input name="allowedIps" placeholder="203.0.113.10, 2001:db8::1" />
        </label>
      </AdminForm>
      {token && (
        <Alert variant="warning" role="status">
          <AlertTitle>{t("tokenOnce")}</AlertTitle>
          <AlertDescription className="space-y-2">
            <code className="block break-all rounded bg-muted px-2 py-1 font-mono text-xs" dir="ltr">
              {token}
            </code>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={async () => {
                await navigator.clipboard.writeText(token);
                toast.success(t("copied"));
              }}
            >
              <Copy aria-hidden className="size-4" />
              {t("copy")}
            </Button>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
