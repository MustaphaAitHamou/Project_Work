import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CheckCircle2, EyeOff, FileLock2, MousePointerClick } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { Button } from "@/components/ui/button";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "cvPage" });
  return { title: t("title"), description: t("subtitle") };
}

export default async function CvPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, user] = await Promise.all([getTranslations("cvPage"), getSessionUser()]);
  const points = [
    { icon: FileLock2, title: t("p1Title"), text: t("p1Text") },
    { icon: MousePointerClick, title: t("p2Title"), text: t("p2Text") },
    { icon: EyeOff, title: t("p3Title"), text: t("p3Text") },
    { icon: CheckCircle2, title: t("p4Title"), text: t("p4Text") },
  ];
  return (
    <div className="container-page max-w-4xl py-14">
      <h1 className="text-3xl font-bold sm:text-4xl">{t("title")}</h1>
      <p className="mt-3 text-lg text-muted-foreground">{t("subtitle")}</p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {points.map((p) => (
          <div key={p.title} className="rounded-xl border bg-card p-5">
            <p.icon className="size-6 text-primary" aria-hidden />
            <h2 className="mt-3 font-semibold">{p.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{p.text}</p>
          </div>
        ))}
      </div>
      <div className="mt-8 flex flex-wrap gap-3">
        {user?.accountType === "candidate" ? (
          <Button asChild size="lg">
            <Link href="/candidate/resumes">{t("manage")}</Link>
          </Button>
        ) : user ? (
          <p className="text-sm text-muted-foreground">{t("employerNotice")}</p>
        ) : (
          <>
            <Button asChild size="lg">
              <Link href="/signup">{t("create")}</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href={`/login?next=${encodeURIComponent(`/${locale}/candidate/resumes`)}`}>{t("login")}</Link>
            </Button>
          </>
        )}
      </div>
      <p className="mt-6 text-sm text-muted-foreground">{t("formats")}</p>
    </div>
  );
}
