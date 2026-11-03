import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "about" });
  return { title: t("title"), description: t("intro") };
}

export default async function AboutPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("about");
  return (
    <div className="container-page max-w-3xl py-14">
      <h1 className="text-3xl font-bold">{t("title")}</h1>
      <p className="mt-3 text-lg text-muted-foreground">{t("intro")}</p>
      <div className="prose-tj mt-8">
        {["s1", "s2", "s3", "s4", "s5"].map((s) => (
          <section key={s}>
            <h2>{t(`${s}Title`)}</h2>
            <p>{t(`${s}Text`)}</p>
          </section>
        ))}
        <p>
          <Link href="/how-ranking-works">{t("rankingLink")}</Link>
        </p>
      </div>
    </div>
  );
}
