import "server-only";
import { cache } from "react";
import { createPublicClient } from "@/lib/supabase/public";

/** Public pages that may carry one advertising slot. Never private spaces, auth, checkout or legal pages. */
export const AD_PLACEMENTS = ["home", "jobs", "job", "companies", "company"] as const;
export type AdPlacement = (typeof AD_PLACEMENTS)[number];

export interface AdsConfig {
  enabled: boolean;
  client: string | null;
  slots: Partial<Record<AdPlacement, string>>;
}

const CLIENT_RE = /^ca-pub-\d{10,20}$/;
const SLOT_RE = /^\d{6,20}$/;

/** AdSense publisher id (ca-pub-…) from the deployment configuration; null when absent or malformed. */
export function adsenseClient(raw = process.env.NEXT_PUBLIC_ADSENSE_CLIENT): string | null {
  const value = raw?.trim();
  return value && CLIENT_RE.test(value) ? value : null;
}

/** Keeps only known placements with a well-formed ad unit id. */
export function parseSlots(value: unknown): Partial<Record<AdPlacement, string>> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Partial<Record<AdPlacement, string>> = {};
  for (const placement of AD_PLACEMENTS) {
    const slot = (value as Record<string, unknown>)[placement];
    if (typeof slot === "string" && SLOT_RE.test(slot.trim())) out[placement] = slot.trim();
  }
  return out;
}

/** Ads configuration for the current request (publisher id + back-office switch + slots). */
export const getAdsConfig = cache(async (): Promise<AdsConfig> => {
  const client = adsenseClient();
  if (!client) return { enabled: false, client: null, slots: {} };
  const { data } = await createPublicClient().from("platform_settings").select("key, value").in("key", ["ads.enabled", "ads.slots"]);
  const settings = new Map((data ?? []).map((row) => [row.key, row.value as unknown]));
  return { enabled: settings.get("ads.enabled") === true, client, slots: parseSlots(settings.get("ads.slots")) };
});
