import "server-only";
import { createPublicClient } from "@/lib/supabase/public";
import { MARKETS } from "@/lib/domain";
import type { JobFormValues } from "@/components/employer/job-form";

export async function jobFormReference() {
  const db = createPublicClient();
  const [{ data: regions }, { data: industries }, { data: countries }] = await Promise.all([
    db.from("geo_regions").select("country_code, code, name").in("country_code", [...MARKETS]).order("name"),
    db.from("industries").select("code").eq("is_active", true).order("sort_order"),
    db.from("countries").select("code, is_paid_publishing_enabled, is_browsable"),
  ]);
  const regionsByCountry: Record<string, { code: string; name: string }[]> = {};
  for (const r of regions ?? []) (regionsByCountry[r.country_code] ??= []).push({ code: r.code, name: r.name });
  return {
    regionsByCountry,
    industries: (industries ?? []).map((i) => i.code),
    publishableCountries: (countries ?? []).filter((c) => c.is_paid_publishing_enabled && c.is_browsable).map((c) => c.code),
  };
}

export const EMPTY_JOB: JobFormValues = {
  title: "",
  description: "",
  missions: "",
  profileSought: "",
  requiredSkills: [],
  optionalSkills: [],
  contractType: "permanent",
  workTime: "full_time",
  workMode: "onsite",
  remoteScope: "employer_country",
  remoteCountries: [],
  salaryMin: "",
  salaryMax: "",
  salaryCurrency: "EUR",
  salaryPeriod: "year",
  benefits: "",
  experienceLevel: "mid",
  industry: "",
  workingLanguages: ["fr"],
  workAuthorization: "not_specified",
  eligibilityNotes: "",
  startDate: "",
  applicationDeadline: "",
  positionsCount: "",
  countryCode: "FR",
  regionCode: "",
  city: "",
  cityId: null,
  postalCode: "",
  addressLine: "",
};
