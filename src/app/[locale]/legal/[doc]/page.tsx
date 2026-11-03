import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { AlertTriangle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

const DOCS = ["terms", "employer-terms", "privacy", "cookies", "notice"] as const;
type Doc = (typeof DOCS)[number];

async function loadDoc(doc: Doc, locale: string): Promise<{ content: string; fallback: boolean }> {
  const base = path.join(process.cwd(), "content", "legal");
  for (const [l, fallback] of [[locale, false], ["fr", locale !== "fr"]] as const) {
    try {
      return { content: await readFile(path.join(base, l, `${doc}.md`), "utf8"), fallback };
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
  const [{ content, fallback }, t] = await Promise.all([loadDoc(doc as Doc, locale), getTranslations("legal")]);
  return (
    <div className="container-page max-w-3xl py-12">
      <Alert variant="warning" className="mb-6">
        <AlertTriangle aria-hidden />
        <AlertDescription>
          {t("draftBanner")}
          {fallback && <> {t("fallbackNotice")}</>}
        </AlertDescription>
      </Alert>
      <article className="prose-tj" lang={fallback ? "fr" : locale}>
        <ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml>
          {content}
        </ReactMarkdown>
      </article>
    </div>
  );
}
