import type { Metadata, Viewport } from "next";
import { Bitter, Noto_Naskh_Arabic, Noto_Serif } from "next/font/google";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { routing, isRtl } from "@/i18n/routing";
import { getSessionUser } from "@/lib/auth/session";
import { siteUrl } from "@/lib/env";
import { Providers } from "@/components/layout/providers";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";

// Bitter, the Tamurt Jobs typeface: square serifs, like a typed contract or a newspaper job ad.
// No adjusted fallback, so that missing glyphs go to Noto Serif (ɛ, ɣ…) and Noto Naskh Arabic (ar), not to a system font.
const bitter = Bitter({ subsets: ["latin", "latin-ext"], variable: "--font-bitter", display: "swap", adjustFontFallback: false });
// Downloaded only when a character needs them.
const notoSerif = Noto_Serif({ subsets: ["latin-ext"], variable: "--font-noto-serif", display: "swap", preload: false, adjustFontFallback: false });
const naskh = Noto_Naskh_Arabic({ subsets: ["arabic"], variable: "--font-naskh", display: "swap", preload: false, adjustFontFallback: false });

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f5f2" },
    { media: "(prefers-color-scheme: dark)", color: "#141312" },
  ],
};

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });
  return {
    metadataBase: new URL(siteUrl()),
    title: { default: t("title"), template: `%s · Tamurt Jobs` },
    description: t("description"),
    applicationName: "Tamurt Jobs",
    alternates: {
      canonical: `/${locale}`,
      languages: Object.fromEntries(routing.locales.map((l) => [l, `/${l}`])),
    },
    openGraph: { type: "website", siteName: "Tamurt Jobs", title: t("title"), description: t("description"), locale },
    icons: {
      icon: [
        { url: "/icon.svg", type: "image/svg+xml" },
        { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
        { url: "/icons/favicon-16.png", sizes: "16x16", type: "image/png" },
      ],
      apple: "/icons/apple-touch-icon.png",
    },
  };
}

export default async function LocaleLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const [user, t] = await Promise.all([getSessionUser(), getTranslations("common")]);
  const dir = isRtl(locale) ? "rtl" : "ltr";
  return (
    <html lang={locale} dir={dir} data-scroll-behavior="smooth" suppressHydrationWarning className={`${bitter.variable} ${notoSerif.variable} ${naskh.variable}`}>
      <body className="flex min-h-dvh flex-col">
        <NextIntlClientProvider>
          <Providers dir={dir}>
            <a
              href="#main"
              className="sr-only z-50 rounded-md bg-primary px-4 py-2 text-primary-foreground focus:not-sr-only focus:absolute focus:start-4 focus:top-4"
            >
              {t("skipToContent")}
            </a>
            <SiteHeader user={user} />
            <main id="main" className="flex-1">
              {children}
            </main>
            <SiteFooter />
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
