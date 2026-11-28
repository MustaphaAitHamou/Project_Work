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
      className="inline-flex shrink-0 items-center gap-1 rounded-full font-semibold text-highlight underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-highlight"
    >
      {t("bannerCta")}
      <ArrowRight className="size-4 rtl:rotate-180" aria-hidden />
    </Link>
  ) : null;

  if (variant === "card") {
    return (
      <aside aria-label={t("badge")} className={cn("relative overflow-hidden rounded-xl border border-highlight/40 bg-brand-deep p-5 text-brand-on shadow-sm", className)} data-testid="launch-offer">
        <div aria-hidden className="pointer-events-none absolute -end-10 -top-12 size-36 rounded-full bg-highlight/15" />
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
    <aside aria-label={t("badge")} className={cn("border-b border-white/10 bg-brand-deep text-brand-on", className)} data-testid="launch-offer">
      <div className="container-page flex flex-col gap-1.5 py-2.5 text-sm sm:flex-row sm:flex-wrap sm:items-center sm:justify-center sm:gap-x-4">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="inline-flex items-center gap-1 rounded-full bg-highlight px-2 py-0.5 text-xs font-bold text-highlight-foreground">
            <Gift className="size-3.5" aria-hidden />
            {t("badge")}
          </span>
          <span className="font-semibold">{t("banner", { lastDay })}</span>
          {priceText && <span className="text-brand-on/80">{priceText}</span>}
        </p>
        {link}
      </div>
    </aside>
  );
}
