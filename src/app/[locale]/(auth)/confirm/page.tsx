import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AuthCard } from "../auth-card";

const TYPES = ["email", "signup", "recovery", "email_change", "invite", "magiclink"] as const;
const TOKEN_HASH = /^[A-Za-z0-9_-]{8,200}$/;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "auth" });
  return { title: t("confirmEmailTitle"), robots: { index: false, follow: false } };
}

/**
 * Landing page of the links sent by e-mail: one click confirms (POST /auth/confirm). Opening
 * the page does not use the one-time token, so a mail filter that opens the link first does
 * not make it expire. Works without JavaScript (plain form).
 */
export default async function ConfirmPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ token_hash?: string; type?: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const type = (TYPES as readonly string[]).includes(sp.type ?? "") ? (sp.type as (typeof TYPES)[number]) : null;
  if (!type || !TOKEN_HASH.test(sp.token_hash ?? "")) redirect(`/${locale}/login?error=link_invalid`);
  const t = await getTranslations("auth");
  const copy =
    type === "recovery"
      ? { title: t("confirmRecoveryTitle"), text: t("confirmRecoveryText"), button: t("confirmRecoveryButton") }
      : type === "email_change"
        ? { title: t("confirmChangeTitle"), text: t("confirmChangeText"), button: t("confirmChangeButton") }
        : { title: t("confirmEmailTitle"), text: t("confirmEmailText"), button: t("confirmEmailButton") };
  return (
    <AuthCard title={copy.title} description={copy.text}>
      <form method="post" action="/auth/confirm" className="space-y-4">
        <input type="hidden" name="token_hash" value={sp.token_hash} />
        <input type="hidden" name="type" value={type} />
        <input type="hidden" name="locale" value={locale} />
        <Button type="submit" size="lg" className="w-full">
          {copy.button}
        </Button>
      </form>
      <p className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-teal" aria-hidden />
        {t("confirmWhy")}
      </p>
    </AuthCard>
  );
}
