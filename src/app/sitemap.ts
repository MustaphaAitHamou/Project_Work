import type { MetadataRoute } from "next";
import { locales } from "@/i18n/routing";
import { env } from "@/lib/env";
import { jobPath } from "@/lib/format";
import { createPublicClient } from "@/lib/supabase/public";

/** Regenerated at most hourly; only public pages and open adverts are listed. */
export const revalidate = 3600;

const STATIC_PATHS = ["", "/jobs", "/companies", "/cv", "/recruiters", "/about", "/how-ranking-works", "/legal/terms", "/legal/employer-terms", "/legal/privacy", "/legal/cookies", "/legal/notice"];
const PAGE = 1000;
const MAX_JOBS = 10_000; // 4 languages × 10 000 adverts stays under the 50 000 URLs limit of one sitemap

type Entry = MetadataRoute.Sitemap[number];

function localized(base: string, path: string, extra: Omit<Entry, "url" | "alternates"> = {}): Entry[] {
  const languages = Object.fromEntries(locales.map((l) => [l, `${base}/${l}${path}`]));
  return locales.map((l) => ({ url: `${base}/${l}${path}`, alternates: { languages }, ...extra }));
}

async function openJobs(): Promise<{ slug: string; public_id: string; published_at: string | null }[]> {
  const supabase = createPublicClient();
  const rows: { slug: string; public_id: string; published_at: string | null }[] = [];
  for (let from = 0; from < MAX_JOBS; from += PAGE) {
    const { data, error } = await supabase
      .from("public_jobs")
      .select("slug, public_id, published_at")
      .eq("is_open", true)
      .order("published_at", { ascending: false })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    rows.push(...data);
    if (data.length < PAGE) break;
  }
  return rows;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = env().NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const entries: Entry[] = STATIC_PATHS.flatMap((p) => localized(base, p, { changeFrequency: p === "/jobs" ? "hourly" : "weekly" }));
  try {
    const [jobs, companies] = await Promise.all([
      openJobs(),
      createPublicClient().from("public_companies").select("slug, verified_at").limit(PAGE),
    ]);
    for (const j of jobs) entries.push(...localized(base, jobPath(j.slug, j.public_id), { lastModified: j.published_at ?? undefined, changeFrequency: "daily" }));
    for (const c of companies.data ?? []) entries.push(...localized(base, `/companies/${c.slug}`, { lastModified: c.verified_at ?? undefined, changeFrequency: "weekly" }));
  } catch (e) {
    // Database unreachable (e.g. at build time): publish the static pages, retry at the next revalidation.
    console.error("sitemap: dynamic entries unavailable", e instanceof Error ? e.message : e);
  }
  return entries;
}
