import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "ranking" });
  return { title: t("title") };
}

export default async function RankingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("ranking");
  return (
    <div className="container-page max-w-3xl py-14">
      <h1 className="text-3xl font-bold">{t("title")}</h1>
      <div className="prose-tj mt-6">
        <p>{t("intro")}</p>
        <h2>{t("searchTitle")}</h2>
        <ul>
          <li>{t("search1")}</li>
          <li>{t("search2")}</li>
          <li>{t("search3")}</li>
          <li>{t("search4")}</li>
        </ul>
        <h2>{t("neverTitle")}</h2>
        <ul>
          <li>{t("never1")}</li>
          <li>{t("never2")}</li>
          <li>{t("never3")}</li>
        </ul>
        <h2>{t("recruiterTitle")}</h2>
        <p>{t("recruiterText")}</p>
        <h2>{t("moderationTitle")}</h2>
        <p>{t("moderationText")}</p>
      </div>
    </div>
  );
}
