import { getTranslations } from "next-intl/server";
import { getAdsConfig, type AdPlacement } from "@/lib/ads/config";
import { AdUnit } from "./ad-unit";

/** Advertising slot of a public page. Renders nothing unless ads are configured, enabled and the slot has an id. */
export async function AdSlot({ placement }: { placement: AdPlacement }) {
  const config = await getAdsConfig();
  const slot = config.slots[placement];
  if (!config.enabled || !config.client || !slot) return null;
  const t = await getTranslations("common");
  return <AdUnit client={config.client} slot={slot} label={t("adLabel")} placement={placement} />;
}
