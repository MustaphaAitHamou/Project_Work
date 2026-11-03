#!/usr/bin/env node
// LOCAL DEVELOPMENT ONLY — creates clearly-labelled demo companies and adverts in the
// local Supabase stack so that search, job pages and applications can be exercised.
// Refuses to run against anything other than localhost. Never run in production.
//
//   node --env-file=.env.local scripts/dev-seed.mjs
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const key = process.env.SUPABASE_SECRET_KEY ?? "";
if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(url)) {
  console.error(`Refusing to seed a non-local database (${url}).`);
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });

async function city(country, name) {
  const { data } = await db.from("geo_cities").select("id, region_code").eq("country_code", country).eq("name", name).limit(1).maybeSingle();
  return data;
}

async function employer(email, first, last, company) {
  const existing = await db.from("users").select("id").eq("email", email).maybeSingle();
  let userId = existing.data?.id;
  if (!userId) {
    const { data, error } = await db.auth.admin.createUser({
      email,
      password: "DemoPassw0rd!",
      email_confirm: true,
      user_metadata: { account_type: "employer", first_name: first, last_name: last, locale: "fr", terms_accepted: true },
    });
    if (error) throw error;
    userId = data.user.id;
  }
  const member = await db.from("company_members").select("company_id").eq("user_id", userId).maybeSingle();
  let companyId = member.data?.company_id;
  if (!companyId) {
    const { data, error } = await db.rpc("create_company", { p_actor: userId, p: company });
    if (error) throw error;
    companyId = data;
  }
  await db.from("companies").update({ verification_status: "verified", verified_at: new Date().toISOString(), description: company.description }).eq("id", companyId);
  return { userId, companyId };
}

const companies = [
  {
    email: "demo.recruteur.lyon@example.test",
    first: "Nadia",
    last: "Benali",
    company: {
      legal_name: "Atelier Numérique Démo (données locales)",
      registration_country: "FR",
      registration_id_type: "fr_siren",
      registration_number: "732829320",
      hq_address_line1: "10 rue de la République",
      hq_postal_code: "69002",
      hq_city: "Lyon",
      hq_country: "FR",
      industry: "it_software",
      website: "https://example.org",
      size_range: "11-50",
      representative_title: "Présidente",
      is_legal_representative: true,
      description: "Entreprise fictive créée par le script de développement local (scripts/dev-seed.mjs).",
    },
    jobs: [
      { title: "Développeur·se React / TypeScript", country: "FR", city: "Lyon", contract_type: "permanent", work_mode: "hybrid", remote_scope: "employer_country", experience_level: "mid", salary_min: 42000, salary_max: 52000, salary_currency: "EUR", salary_period: "year", required_skills: ["React", "TypeScript", "Accessibilité"], working_languages: ["fr"] },
      { title: "Product designer UX/UI", country: "FR", city: "Paris", contract_type: "permanent", work_mode: "remote", remote_scope: "listed_countries", remote_countries: ["FR", "BE", "CH", "LU", "ES"], experience_level: "senior", salary_min: 50000, salary_max: 60000, salary_currency: "EUR", salary_period: "year", required_skills: ["Figma", "Design system"], working_languages: ["fr", "en"] },
      { title: "Stagiaire data analyst", country: "FR", city: "Marseille", contract_type: "internship", work_mode: "onsite", experience_level: "entry", salary_min: 1000, salary_max: 1200, salary_currency: "EUR", salary_period: "month", required_skills: ["SQL", "Python"], working_languages: ["fr"] },
    ],
  },
  {
    email: "demo.recruteur.montreal@example.test",
    first: "Marc",
    last: "Tremblay",
    company: {
      legal_name: "Clinique Démo Montréal (données locales)",
      registration_country: "FR",
      registration_id_type: "fr_siren",
      registration_number: "552100554",
      hq_address_line1: "1 avenue Démo",
      hq_postal_code: "75001",
      hq_city: "Paris",
      hq_country: "FR",
      industry: "healthcare",
      size_range: "201-500",
      representative_title: "Directeur RH",
      is_legal_representative: false,
      description: "Entreprise fictive créée par le script de développement local.",
    },
    jobs: [
      { title: "Infirmier·ère de bloc opératoire", country: "CA", city: "Montréal", contract_type: "permanent", work_mode: "onsite", experience_level: "mid", salary_min: 38, salary_max: 45, salary_currency: "CAD", salary_period: "hour", required_skills: ["Bloc opératoire", "Asepsie"], working_languages: ["fr", "en"], work_authorization: "sponsorship_available" },
      { title: "Développeur back-end Node.js (télétravail international)", country: "CA", city: "Toronto", contract_type: "freelance", work_mode: "remote", remote_scope: "worldwide", experience_level: "senior", salary_min: 500, salary_max: 650, salary_currency: "CAD", salary_period: "day", required_skills: ["Node.js", "PostgreSQL"], working_languages: ["en"] },
      { title: "Chef de chantier gros œuvre", country: "BE", city: "Liège", contract_type: "fixed_term", work_mode: "onsite", experience_level: "senior", salary_min: 3500, salary_max: 4200, salary_currency: "EUR", salary_period: "month", required_skills: ["Gros œuvre", "Sécurité chantier"], working_languages: ["fr"] },
    ],
  },
];

const description = (title) =>
  `Nous recrutons pour le poste de ${title}. Annonce de démonstration générée localement pour tester la recherche, la page d'offre et la candidature en un clic.\n\nVous rejoindrez une équipe bienveillante et engagée.`;

for (const c of companies) {
  const { userId, companyId } = await employer(c.email, c.first, c.last, c.company);
  for (const j of c.jobs) {
    const exists = await db.from("jobs").select("id").eq("company_id", companyId).eq("title", j.title).maybeSingle();
    if (exists.data) continue;
    const { country, city: cityName, ...fields } = j;
    const { data: job, error } = await db
      .from("jobs")
      .insert({
        ...fields,
        company_id: companyId,
        created_by: userId,
        description: description(j.title),
        missions: "- Contribuer aux projets de l'équipe\n- Partager vos bonnes pratiques\n- Participer à l'amélioration continue",
        profile_sought: "Expérience pertinente, sens du service et goût du travail en équipe.",
        status: "draft",
      })
      .select("id")
      .single();
    if (error) throw error;
    const ct = await city(country, cityName);
    const loc = await db.from("job_locations").insert({ job_id: job.id, company_id: companyId, country_code: country, city: cityName, city_id: ct?.id ?? null });
    if (loc.error) throw loc.error;
    await db.from("jobs").update({ status: "active", published_at: new Date().toISOString(), paid_through: new Date(Date.now() + 30 * 86400000).toISOString() }).eq("id", job.id);
  }
  console.log(`seeded ${c.company.legal_name}`);
}
console.log("Demo employer password: DemoPassw0rd! (local only)");
