import "server-only";
import { cache } from "react";
import { createPublicClient } from "@/lib/supabase/public";
import type { Database } from "@/lib/supabase/database.types";
import { toRpcArgs, type SearchParams } from "@/lib/search/params";

export type JobSearchRow = Database["public"]["Functions"]["search_jobs"]["Returns"][number];
export type PublicJob = Database["public"]["Views"]["public_jobs"]["Row"];
export type PublicCompany = Database["public"]["Views"]["public_companies"]["Row"];

export async function getCityCoords(cityId: number) {
  const { data } = await createPublicClient()
    .from("geo_cities")
    .select("id, name, country_code, region_code, latitude, longitude")
    .eq("id", cityId)
    .maybeSingle();
  return data;
}

export async function searchJobs(params: SearchParams, locale: string, pageSize?: number) {
  const city = params.near ? await getCityCoords(params.near) : null;
  const args = toRpcArgs(params, locale, city ? { lat: city.latitude, lng: city.longitude } : null, pageSize);
  const { data, error } = await createPublicClient().rpc("search_jobs", args as never);
  if (error) throw new Error(`search_jobs: ${error.message}`);
  const rows = (data ?? []) as JobSearchRow[];
  return { items: rows, total: rows[0]?.total_count ?? 0, city };
}

export const getPublicJob = cache(async (publicId: string): Promise<PublicJob | null> => {
  const { data } = await createPublicClient().from("public_jobs").select("*").eq("public_id", publicId).maybeSingle();
  return data;
});

export async function getSimilarJobs(jobId: string, limit = 4) {
  const { data } = await createPublicClient().rpc("similar_jobs", { p_job_id: jobId, p_limit: limit });
  return data ?? [];
}

export async function getLatestJobs(limit = 6) {
  const { data } = await createPublicClient().rpc("search_jobs", { p_sort: "date", p_limit: limit, p_offset: 0, p_lang: "fr" } as never);
  return (data ?? []) as JobSearchRow[];
}

export const getRegionNames = cache(async (): Promise<Map<string, string>> => {
  const { data } = await createPublicClient().from("geo_regions").select("country_code, code, name");
  return new Map((data ?? []).map((r) => [`${r.country_code}.${r.code}`, r.name]));
});

export async function getRegions(country: string) {
  const { data } = await createPublicClient().from("geo_regions").select("code, name").eq("country_code", country).order("name");
  return data ?? [];
}

export const getIndustries = cache(async () => {
  const { data } = await createPublicClient().from("industries").select("code").eq("is_active", true).order("sort_order");
  return (data ?? []).map((r) => r.code);
});

export const getCountries = cache(async () => {
  const { data } = await createPublicClient()
    .from("countries")
    .select("code, default_currency, default_locale, is_browsable, is_registration_open, is_paid_publishing_enabled, registry_identifier_types, sort_order")
    .order("sort_order");
  return data ?? [];
});

export async function getJobPrice(country?: string | null) {
  const { data } = await createPublicClient().rpc("get_job_price", { p_country: country ?? undefined } as never);
  return data as { plan_id: string; currency: string; unit_amount: number; interval: string; tax_behavior: string } | null;
}

export async function getPublicSetting<T>(key: string, fallback: T): Promise<T> {
  const { data } = await createPublicClient().from("platform_settings").select("value").eq("key", key).maybeSingle();
  return (data?.value as T) ?? fallback;
}
