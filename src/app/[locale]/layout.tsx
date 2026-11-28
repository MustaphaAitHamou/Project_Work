import type { Metadata, Viewport } from "next";
import { Inter, Noto_Sans_Arabic, Plus_Jakarta_Sans } from "next/font/google";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { routing, isRtl } from "@/i18n/routing";
import { getSessionUser } from "@/lib/auth/session";
import { appEnv, siteUrl } from "@/lib/env";
import { adsenseClient } from "@/lib/ads/config";
import { Providers } from "@/components/layout/providers";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";

// Inter for text and interface, Plus Jakarta Sans for headings (variable fonts, self-hosted by
// next/font: no request to Google from the browser). Metric-adjusted local fallbacks
// (adjustFontFallback) keep the layout still while the fonts arrive (no layout shift).
// Kabyle letters: Inter covers ɛ ɣ ḍ ṛ ẓ ǧ č; Plus Jakarta Sans lacks ɛ and ɣ, which then come from Inter.
const inter = Inter({ subsets: ["latin", "latin-ext"], variable: "--font-inter", display: "swap" });
const jakarta = Plus_Jakarta_Sans({ subsets: ["latin", "latin-ext"], variable: "--font-jakarta", display: "swap" });
// Arabic locale only: downloaded when Arabic characters are displayed.
const arabic = Noto_Sans_Arabic({ subsets: ["arabic"], variable: "--font-arabic", display: "swap", preload: false });

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f8fc" },
    { media: "(prefers-color-scheme: dark)", color: "#070b1a" },
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
    // Lets Google verify site ownership for AdSense without loading any ad script.
    ...(adsenseClient() ? { other: { "google-adsense-account": adsenseClient()! } } : {}),
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
    <html lang={locale} dir={dir} data-scroll-behavior="smooth" suppressHydrationWarning className={`${inter.variable} ${jakarta.variable} ${arabic.variable}`}>
      <body className="flex min-h-dvh flex-col">
        <NextIntlClientProvider>
          <Providers dir={dir}>
            <a
              href="#main"
              className="sr-only z-50 rounded-md bg-primary px-4 py-2 text-primary-foreground focus:not-sr-only focus:absolute focus:start-4 focus:top-4"
            >
              {t("skipToContent")}
            </a>
            {appEnv() === "preprod" ? (
              <p role="note" className="bg-amber-200 px-4 py-1.5 text-center text-sm font-medium text-amber-950">
                {t("preprodBanner")}
              </p>
            ) : null}
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
