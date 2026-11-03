import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { BadgeCheck, CreditCard, FileText, Inbox, Search, XCircle } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { getJobPrice } from "@/lib/jobs/queries";
import { getSessionUser } from "@/lib/auth/session";
import { formatMoneyMinor } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "recruiters" });
  return { title: t("metaTitle"), description: t("subtitle") };
}

export default async function RecruitersPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, price, user] = await Promise.all([getTranslations("recruiters"), getJobPrice(null), getSessionUser()]);
  const steps = [
    { icon: FileText, title: t("s1Title"), text: t("s1Text") },
    { icon: BadgeCheck, title: t("s2Title"), text: t("s2Text") },
    { icon: Search, title: t("s3Title"), text: t("s3Text") },
    { icon: CreditCard, title: t("s4Title"), text: t("s4Text") },
    { icon: Inbox, title: t("s5Title"), text: t("s5Text") },
  ];
  const examples = [1, 2, 5, 10];
  const cta = user?.accountType === "employer" ? { href: "/employer", label: t("ctaDashboard") } : { href: "/signup/employer", label: t("ctaSignup") };
  return (
    <div className="container-page py-14">
      <div className="mx-auto max-w-3xl text-center">
        <h1 className="text-3xl font-bold sm:text-4xl">{t("title")}</h1>
        <p className="mt-3 text-lg text-muted-foreground">{t("subtitle")}</p>
        <Button asChild size="lg" className="mt-6">
          <Link href={cta.href}>{cta.label}</Link>
        </Button>
      </div>

      <section aria-labelledby="pricing" className="mx-auto mt-14 max-w-4xl">
        <h2 id="pricing" className="text-center text-2xl font-bold">
          {t("pricingTitle")}
        </h2>
        {price && (
          <div className="mt-6 grid gap-6 md:grid-cols-[1fr_1.2fr]">
            <Card className="border-primary/40">
              <CardHeader>
                <CardTitle>{t("planName")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-4xl font-bold text-primary">{formatMoneyMinor(price.unit_amount, price.currency, locale)}</p>
                <p className="text-sm text-muted-foreground">{t("perJobPerMonth")}</p>
                <p className="text-xs text-muted-foreground">{price.tax_behavior === "exclusive" ? t("taxExclusive") : t("taxInclusive")}</p>
                <ul className="mt-3 space-y-1 text-sm">
                  <li>✓ {t("f1")}</li>
                  <li>✓ {t("f2")}</li>
                  <li>✓ {t("f3")}</li>
                  <li>✓ {t("f4")}</li>
                  <li>✓ {t("f5")}</li>
                </ul>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>{t("examplesTitle")}</CardTitle>
              </CardHeader>
              <CardContent>
                <table className="w-full text-sm">
                  <caption className="sr-only">{t("examplesTitle")}</caption>
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th scope="col" className="py-2 text-start font-medium">
                        {t("activeJobs")}
                      </th>
                      <th scope="col" className="py-2 text-end font-medium">
                        {t("monthlyTotal")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {examples.map((n) => (
                      <tr key={n} className="border-b last:border-0">
                        <td className="py-2">{t("jobsCount", { count: n })}</td>
                        <td className="py-2 text-end font-semibold">{formatMoneyMinor(price.unit_amount * n, price.currency, locale)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-3 text-xs text-muted-foreground">{t("examplesNote")}</p>
              </CardContent>
            </Card>
          </div>
        )}
      </section>

      <section aria-labelledby="steps" className="mt-14">
        <h2 id="steps" className="text-center text-2xl font-bold">
          {t("stepsTitle")}
        </h2>
        <ol className="mt-8 grid gap-4 md:grid-cols-5">
          {steps.map((s, i) => (
            <li key={s.title} className="rounded-xl border bg-card p-5">
              <span className="text-xs font-semibold text-primary">{i + 1}</span>
              <s.icon className="mt-2 size-6 text-primary" aria-hidden />
              <h3 className="mt-2 font-semibold">{s.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="faq" className="mx-auto mt-14 max-w-3xl space-y-4">
        <h2 id="faq" className="text-2xl font-bold">
          {t("faqTitle")}
        </h2>
        {["q1", "q2", "q3", "q4", "q5", "q6"].map((q) => (
          <details key={q} className="rounded-lg border bg-card p-4">
            <summary className="cursor-pointer font-medium">{t(`faq.${q}`)}</summary>
            <p className="mt-2 text-sm text-muted-foreground">{t(`faq.${q}a`)}</p>
          </details>
        ))}
      </section>

      <section className="mx-auto mt-14 max-w-3xl rounded-xl border bg-muted/30 p-6">
        <h2 className="flex items-center gap-2 font-semibold">
          <XCircle className="size-5 text-muted-foreground" aria-hidden />
          {t("notTitle")}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">{t("notText")}</p>
      </section>
    </div>
  );
}
