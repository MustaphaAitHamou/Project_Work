import "server-only";
import { cache } from "react";
import { createPublicClient } from "@/lib/supabase/public";

export interface LaunchOffer {
  /** Fin (exclue) de la publication gratuite, instant ISO. */
  freeUntil: string;
  /** La publication gratuite est ouverte maintenant (horloge de la base). */
  open: boolean;
}

/**
 * Offre de lancement telle que la base l'applique (même source que submit_job et la
 * maintenance). `null` si elle est illisible : les pages s'affichent alors sans bandeau.
 */
export const getLaunchOffer = cache(async (): Promise<LaunchOffer | null> => {
  const { data, error } = await createPublicClient().rpc("launch_offer");
  const value = (data ?? null) as { free_until?: string; open?: boolean } | null;
  if (error || !value?.free_until) return null;
  return { freeUntil: value.free_until, open: value.open === true };
});
