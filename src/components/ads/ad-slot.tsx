import { getTranslations } from "next-intl/server";
import { getAdsConfig, type AdPlacement } from "@/lib/ads/config";
import { AdUnit } from "./ad-unit";

/**
 * Advertising slot of a public page. Renders nothing unless ads are enabled in the back-office.
 * Outside production (placeholder mode) it shows a labelled empty slot and contacts no ad server.
 */
export async function AdSlot({ placement }: { placement: AdPlacement }) {
  const config = await getAdsConfig();
  if (!config.enabled) return null;
  const t = await getTranslations("common");
  if (config.mode === "placeholder") {
    return (
      <aside aria-label={t("adLabel")} className="ad-slot my-10" data-ad-placement={placement} data-ad-mode="placeholder">
        <p className="mb-1 text-center text-[11px] tracking-wide text-muted-foreground uppercase">{t("adLabel")}</p>
        <div className="ad-slot-box flex items-center justify-center rounded-md border border-dashed border-border bg-muted/40 p-6 text-center text-sm text-muted-foreground">
          {t("adPlaceholder")}
        </div>
      </aside>
    );
  }
  const slot = config.slots[placement];
  if (!config.client || !slot) return null;
  return <AdUnit client={config.client} slot={slot} label={t("adLabel")} placement={placement} test={config.mode === "test"} />;
}
