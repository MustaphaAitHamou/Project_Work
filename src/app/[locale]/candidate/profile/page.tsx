import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireCandidate } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getRegions } from "@/lib/jobs/queries";
import { MARKETS } from "@/lib/domain";
import { PageHeader } from "@/components/layout/dashboard-shell";
import { ProfileForm } from "@/components/candidate/profile-form";
import { EducationSection, ExperienceSection } from "@/components/candidate/entries-section";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "candidate.profile" });
  return { title: t("title"), robots: { index: false } };
}

export default async function ProfilePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireCandidate(locale);
  const t = await getTranslations("candidate.profile");
  const supabase = await createClient();
  const [{ data: profile }, { data: experiences }, { data: educations }, regionLists] = await Promise.all([
    supabase.from("candidate_profiles").select("*").eq("user_id", user.id).single(),
    supabase.from("candidate_experiences").select("*").eq("user_id", user.id).order("is_current", { ascending: false }).order("start_date", { ascending: false }),
    supabase.from("candidate_educations").select("*").eq("user_id", user.id).order("end_date", { ascending: false, nullsFirst: true }),
    Promise.all(MARKETS.map(async (c) => [c, await getRegions(c)] as const)),
  ]);
  const p = profile!;
  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("description")} />
      <ProfileForm
        regionsByCountry={Object.fromEntries(regionLists)}
        values={{
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          headline: p.headline ?? "",
          summary: p.summary ?? "",
          countryCode: p.country_code ?? "",
          regionCode: p.region_code ?? "",
          city: p.city ?? "",
          phone: p.phone ?? "",
          skills: p.skills ?? [],
          languages: (p.languages as { code: string; level: string }[]) ?? [],
          desiredContractTypes: p.desired_contract_types ?? [],
          desiredWorkTime: p.desired_work_time ?? [],
          remotePreference: p.remote_preference,
          willingToRelocate: p.willing_to_relocate,
          mobilityCountries: p.mobility_countries ?? [],
          yearsOfExperience: p.years_of_experience,
        }}
      />
      <ExperienceSection items={experiences ?? []} />
      <EducationSection items={educations ?? []} />
    </div>
  );
}
