import { z } from "zod";
import { CONTRACT_TYPES, CURRENCIES, EXPERIENCE_LEVELS, MARKETS, WORK_MODES, WORK_TIMES } from "@/lib/domain";

/**
 * Job search parameters, parsed field by field from the URL: an invalid value is
 * ignored instead of breaking the page (URLs are shared, bookmarked, crawled).
 */
export const POSTED_WITHIN = [1, 3, 7, 14, 30] as const;
export const SORTS = ["relevance", "date", "distance"] as const;
export const RADII = [10, 25, 50, 100, 200] as const;

function csvEnum<T extends string>(values: readonly T[]) {
  return z
    .string()
    .max(500)
    .transform((s): T[] =>
      [...new Set(s.split(",").map((x) => x.trim()).filter((x): x is T => (values as readonly string[]).includes(x)))].slice(0, values.length),
    );
}

const fields = {
  q: z.string().trim().min(1).max(120),
  country: z.enum(MARKETS),
  region: z.string().regex(/^[A-Z0-9]{1,6}$/),
  city: z.string().trim().min(1).max(120),
  near: z.coerce.number().int().positive(),
  radius: z.coerce.number().int().refine((v) => (RADII as readonly number[]).includes(v)),
  contract: csvEnum(CONTRACT_TYPES),
  mode: csvEnum(WORK_MODES),
  time: z.enum(WORK_TIMES),
  remoteFrom: z.string().regex(/^[A-Z]{2}$/),
  level: csvEnum(EXPERIENCE_LEVELS),
  salaryMin: z.coerce.number().int().min(0).max(10_000_000),
  currency: z.enum(CURRENCIES),
  posted: z.coerce.number().int().refine((v) => (POSTED_WITHIN as readonly number[]).includes(v)),
  industry: z.string().regex(/^[a-z_]{2,40}$/),
  company: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/).max(80),
  lang: z.string().regex(/^[a-z]{2,3}$/),
  sort: z.enum(SORTS),
  page: z.coerce.number().int().min(1).max(250),
} as const;

export type SearchParams = {
  q?: string;
  country?: (typeof MARKETS)[number];
  region?: string;
  city?: string;
  near?: number;
  radius?: number;
  contract?: string[];
  mode?: string[];
  time?: (typeof WORK_TIMES)[number];
  remoteFrom?: string;
  level?: string[];
  salaryMin?: number;
  currency?: (typeof CURRENCIES)[number];
  posted?: number;
  industry?: string;
  company?: string;
  lang?: string;
  sort?: (typeof SORTS)[number];
  page?: number;
};

export const SEARCH_KEYS = Object.keys(fields) as Array<keyof typeof fields>;

export function parseSearchParams(input: Record<string, string | string[] | undefined> | URLSearchParams): SearchParams {
  const CSV_KEYS = new Set(["contract", "mode", "level"]);
  const get = (k: string) => {
    const values = input instanceof URLSearchParams ? input.getAll(k) : ([] as string[]).concat(input[k] ?? []);
    if (values.length === 0) return undefined;
    return CSV_KEYS.has(k) ? values.join(",") : values[0];
  };
  const out: Record<string, unknown> = {};
  for (const key of SEARCH_KEYS) {
    const raw = get(key);
    if (raw === undefined || raw === "") continue;
    const parsed = (fields[key] as z.ZodType).safeParse(key === "remoteFrom" || key === "country" || key === "region" ? raw.toUpperCase() : raw);
    if (!parsed.success) continue;
    if (Array.isArray(parsed.data) && parsed.data.length === 0) continue;
    out[key] = parsed.data;
  }
  return out as SearchParams;
}

export function toQueryString(p: SearchParams, overrides: Partial<SearchParams> = {}): string {
  const merged = { ...p, ...overrides } as Record<string, unknown>;
  const qs = new URLSearchParams();
  for (const key of SEARCH_KEYS) {
    const v = merged[key];
    if (v === undefined || v === null || v === "") continue;
    if (key === "page" && v === 1) continue;
    if (key === "sort" && v === "relevance") continue;
    qs.set(key, Array.isArray(v) ? v.join(",") : String(v));
  }
  return qs.toString();
}

/** Criteria stored in a job alert (no pagination/sorting). */
export function alertCriteria(p: SearchParams): SearchParams {
  const { page: _page, sort: _sort, ...rest } = p;
  return rest;
}

export function hasActiveFilters(p: SearchParams): boolean {
  return Object.keys(alertCriteria(p)).length > 0;
}

export const PAGE_SIZE = 20;

export interface SearchRpcArgs {
  p_q?: string;
  p_lang: string;
  p_country?: string;
  p_region?: string;
  p_city?: string;
  p_lat?: number;
  p_lng?: number;
  p_radius_km?: number;
  p_contract_types?: string[];
  p_work_modes?: string[];
  p_work_time?: string;
  p_remote_from?: string;
  p_experience_levels?: string[];
  p_salary_min_annual?: number;
  p_salary_currency?: string;
  p_posted_within_days?: number;
  p_industry?: string;
  p_company_slug?: string;
  p_working_language?: string;
  p_published_after?: string;
  p_sort: string;
  p_limit: number;
  p_offset: number;
}

export function toRpcArgs(
  p: SearchParams,
  locale: string,
  coords?: { lat: number; lng: number } | null,
  pageSize = PAGE_SIZE,
): SearchRpcArgs {
  const page = p.page ?? 1;
  return {
    p_q: p.q,
    p_lang: locale,
    p_country: p.country,
    p_region: p.region,
    p_city: coords ? undefined : p.city,
    p_lat: coords?.lat,
    p_lng: coords?.lng,
    p_radius_km: coords ? (p.radius ?? 25) : undefined,
    p_contract_types: p.contract,
    p_work_modes: p.mode,
    p_work_time: p.time,
    p_remote_from: p.remoteFrom,
    p_experience_levels: p.level,
    p_salary_min_annual: p.salaryMin,
    p_salary_currency: p.salaryMin ? (p.currency ?? "EUR") : p.currency,
    p_posted_within_days: p.posted,
    p_industry: p.industry,
    p_company_slug: p.company,
    p_working_language: p.lang,
    p_sort: p.sort === "distance" && !coords ? "relevance" : (p.sort ?? "relevance"),
    p_limit: pageSize,
    p_offset: (page - 1) * pageSize,
  };
}
