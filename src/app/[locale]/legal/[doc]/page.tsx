import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { AlertTriangle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { getLanguageNamer } from "@/lib/i18n/names-server";

const DOCS = ["terms", "employer-terms", "privacy", "cookies", "notice"] as const;
type Doc = (typeof DOCS)[number];

/** Draft texts exist in French and English; Spanish falls back to English, Arabic to French. */
const FALLBACKS: Record<string, readonly string[]> = { fr: ["fr"], en: ["en", "fr"], es: ["es", "en", "fr"], ar: ["ar", "fr"] };

async function loadDoc(doc: Doc, locale: string): Promise<{ content: string; shownLocale: string }> {
  const base = path.join(process.cwd(), "content", "legal");
  for (const l of FALLBACKS[locale] ?? ["fr"]) {
    try {
      return { content: await readFile(path.join(base, l, `${doc}.md`), "utf8"), shownLocale: l };
    } catch {
      /* try next */
    }
  }
  notFound();
}

export function generateStaticParams() {
  return DOCS.map((doc) => ({ doc }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string; doc: string }> }): Promise<Metadata> {
  const { locale, doc } = await params;
  if (!(DOCS as readonly string[]).includes(doc)) return {};
  const t = await getTranslations({ locale, namespace: "legal" });
  return { title: t(`titles.${doc as Doc}`) };
}

export default async function LegalPage({ params }: { params: Promise<{ locale: string; doc: string }> }) {
  const { locale, doc } = await params;
  setRequestLocale(locale);
  if (!(DOCS as readonly string[]).includes(doc)) notFound();
  const [{ content, shownLocale }, t, languageName] = await Promise.all([loadDoc(doc as Doc, locale), getTranslations("legal"), getLanguageNamer(locale)]);
  const fallback = shownLocale !== locale;
  return (
    <div className="container-page max-w-3xl py-12">
      <Alert variant="warning" className="mb-6">
        <AlertTriangle aria-hidden />
        <AlertDescription>
          {t("draftBanner")}
          {fallback && <> {t("fallbackNotice", { language: languageName(shownLocale) })}</>}
        </AlertDescription>
      </Alert>
      <article className="prose-tj" lang={shownLocale} dir={shownLocale === "ar" ? "rtl" : "ltr"}>
        <ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml>
          {content}
        </ReactMarkdown>
      </article>
    </div>
  );
}
