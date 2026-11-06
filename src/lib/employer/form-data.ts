import "server-only";
import { createPublicClient } from "@/lib/supabase/public";

/** Reference data needed by the company form (open registration countries, regions, industries). */
export async function companyFormReference() {
  const db = createPublicClient();
  const [{ data: countries }, { data: regions }, { data: industries }] = await Promise.all([
    db.from("countries").select("code, is_registration_open, sort_order").order("sort_order"),
    db.from("geo_regions").select("country_code, code, name").in("country_code", ["US", "CA"]).order("name"),
    db.from("industries").select("code").eq("is_active", true).order("sort_order"),
  ]);
  const regionsByCountry: Record<string, { code: string; name: string }[]> = {};
  for (const r of regions ?? []) (regionsByCountry[r.country_code] ??= []).push({ code: r.code, name: r.name });
  return {
    countries: (countries ?? []).filter((c) => c.is_registration_open).map((c) => c.code),
    regionsByCountry,
    industries: (industries ?? []).map((i) => i.code),
  };
}
