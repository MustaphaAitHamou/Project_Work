import { getLocale, getTranslations } from "next-intl/server";
import { ArrowRight, Gift } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { getLaunchOffer } from "@/lib/billing/launch-offer";
import { offerFirstPaidDay, offerLastDay } from "@/lib/billing/offer";
import { getJobPrice } from "@/lib/jobs/queries";
import { formatMoneyMinor } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Bandeau « Offre de lancement ». Rendu côté serveur à chaque requête et seulement tant que
 * la base accepte la publication gratuite : il disparaît de lui-même à la fin de l'offre.
 * `strip` : fine bande pleine largeur sous l'en-tête ; `card` : encart dans un espace.
 */
export async function LaunchOfferBanner({ variant = "strip", cta = true, className }: { variant?: "strip" | "card"; cta?: boolean; className?: string }) {
  const [offer, price, locale, t] = await Promise.all([getLaunchOffer(), getJobPrice(null), getLocale(), getTranslations("launchOffer")]);
  if (!offer?.open) return null;
  const lastDay = offerLastDay(offer.freeUntil, locale);
  const startDay = offerFirstPaidDay(offer.freeUntil, locale);
  const priceText = price
    ? t(price.tax_behavior === "inclusive" ? "bannerPriceInclusive" : "bannerPrice", { startDay, price: formatMoneyMinor(price.unit_amount, price.currency, locale) })
    : null;
  const link = cta ? (
    <Link
      href="/recruiters#pricing"
      className="ms-11 inline-flex shrink-0 items-center gap-1 rounded-full font-semibold text-highlight underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-highlight sm:ms-0"
    >
      {t("bannerCta")}
      <ArrowRight className="size-4 rtl:rotate-180" aria-hidden />
    </Link>
  ) : null;

  if (variant === "card") {
    return (
      <aside aria-label={t("badge")} className={cn("relative overflow-hidden rounded-2xl border border-highlight/30 bg-brand-deep p-5 text-brand-on shadow-md [--ring:var(--highlight)] sm:p-6", className)} data-testid="launch-offer">
        <div aria-hidden className="pointer-events-none absolute -end-24 -top-24 size-72 rounded-full bg-[radial-gradient(circle,rgba(246,196,69,0.20),transparent_65%)]" />
        <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p className="inline-flex items-center gap-1.5 rounded-full bg-highlight px-2.5 py-0.5 text-xs font-bold text-highlight-foreground">
              <Gift className="size-3.5" aria-hidden />
              {t("badge")}
            </p>
            <p className="text-base font-semibold">{t("banner", { lastDay })}</p>
            {priceText && <p className="text-sm text-brand-on/80">{priceText}</p>}
          </div>
          {link}
        </div>
      </aside>
    );
  }

  return (
    <aside aria-label={t("badge")} className={cn("relative border-b border-white/10 bg-brand-deep text-brand-on [--ring:var(--highlight)]", className)} data-testid="launch-offer">
      <div aria-hidden className="pointer-events-none absolute inset-y-0 end-0 w-1/3 bg-[radial-gradient(60%_120%_at_100%_50%,rgba(246,196,69,0.16),transparent)]" />
      <div className="container-page relative flex flex-wrap items-start gap-x-3 gap-y-1 py-2.5 text-[13px] leading-snug sm:flex-nowrap sm:items-center sm:text-sm">
        {/* Decorative: the message itself starts with « Offre de lancement ». */}
        <span aria-hidden className="mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-full bg-highlight px-2 py-0.5 text-xs font-bold text-highlight-foreground sm:mt-0">
          <Gift className="size-3.5" />
          <span className="max-sm:hidden">{t("badge")}</span>
        </span>
        <p className="min-w-0 flex-1 basis-[calc(100%-3rem)] sm:basis-auto">
          <span className="font-semibold">{t("banner", { lastDay })}</span> {priceText && <span className="text-brand-on/75">{priceText}</span>}
        </p>
        {link}
      </div>
    </aside>
  );
}
