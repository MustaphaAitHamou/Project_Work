#!/usr/bin/env node
// PRE-PRODUCTION ONLY — creates the acceptance-test accounts and a clearly labelled demo
// data set, so that the site can be used as a candidate, a paying recruiter and the
// back-office team would use it.
//
//   node --env-file=.env.preprod.local scripts/preprod-seed.mjs --preprod <project-ref> [--out <file>]
//
// Safeguards (any failure stops the script before writing anything):
//   - --preprod <project-ref> must match NEXT_PUBLIC_SUPABASE_URL (https://<ref>.supabase.co) or a local URL;
//   - refuses APP_ENV=production;
//   - refuses a database that already holds a live-mode Stripe subscription (a production database);
//   - every company and advert is named "(démo)" and says it is a demonstration.
//
// Test passwords are random, generated at each run, and written only to the --out file
// (default: preprod-accounts.local.txt, git-ignored). Never commit or paste them.
//
// Behind an HTTPS proxy that injects the secret key into the "apikey" header (cloud session),
// pass SUPABASE_SECRET_KEY=sb_secret_proxy_injected: the client then sends the key only in
// "apikey" (no duplicate "Authorization: Bearer" carrying the placeholder).
import { randomBytes } from "node:crypto";
import { writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const ref = flag("--preprod");
const outFile = flag("--out") ?? "preprod-accounts.local.txt";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const key = process.env.SUPABASE_SECRET_KEY ?? "";

function stop(message) {
  console.error(`preprod-seed: ${message}`);
  process.exit(1);
}

const isLocal = /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(url);
if (!url || !key) stop("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY are required (pass --env-file).");
if (!ref) stop("--preprod <project-ref> is required.");
if (!isLocal && url !== `https://${ref}.supabase.co`) stop(`the target ${url} is not the pre-production project ${ref}.`);
if (process.env.APP_ENV === "production") stop("refusing to run with APP_ENV=production.");

const PROXY_PLACEHOLDER = "sb_secret_proxy_injected";
const viaProxy = key === PROXY_PLACEHOLDER;
const db = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
  ...(viaProxy
    ? {
        global: {
          fetch: (input, init = {}) => {
            const headers = new Headers(init.headers);
            if (headers.get("authorization") === `Bearer ${PROXY_PLACEHOLDER}`) headers.delete("authorization");
            return fetch(input, { ...init, headers });
          },
        },
      }
    : {}),
});

const live = await db.from("subscriptions").select("id", { count: "exact", head: true }).eq("livemode", true);
if (live.error) stop(`cannot inspect the database: ${live.error.message}`);
if ((live.count ?? 0) > 0) stop("this database holds live Stripe subscriptions: it is a production database.");

const password = () => `Recette-${randomBytes(9).toString("base64url")}9a`;
const accounts = [];

async function account(email, type, first, last) {
  const existing = await db.from("users").select("id").eq("email", email).maybeSingle();
  const pwd = password();
  if (existing.data) {
    const { error } = await db.auth.admin.updateUserById(existing.data.id, { password: pwd });
    if (error) throw error;
    accounts.push({ email, password: pwd, type });
    return existing.data.id;
  }
  const { data, error } = await db.auth.admin.createUser({
    email,
    password: pwd,
    email_confirm: true,
    user_metadata: { account_type: type, first_name: first, last_name: last, locale: "fr", terms_accepted: true, terms_version: "2026-11-01" },
  });
  if (error) throw error;
  accounts.push({ email, password: pwd, type });
  return data.user.id;
}

async function grant(userId, role) {
  const { error } = await db.from("admin_roles").upsert({ user_id: userId, role }, { onConflict: "user_id,role", ignoreDuplicates: true });
  if (error) throw error;
}

async function company(ownerId, c) {
  const member = await db.from("company_members").select("company_id").eq("user_id", ownerId).maybeSingle();
  let companyId = member.data?.company_id;
  if (!companyId) {
    const { data, error } = await db.rpc("create_company", { p_actor: ownerId, p: c });
    if (error) throw error;
    companyId = data;
  }
  const { error } = await db
    .from("companies")
    .update({ verification_status: "verified", verified_at: new Date().toISOString(), description: c.description })
    .eq("id", companyId);
  if (error) throw error;
  return companyId;
}

const DEMO_NOTE = "Offre de démonstration (préproduction) : aucun poste réel, ne pas postuler avec de vraies données.";

async function demoJob(companyId, ownerId, j) {
  const title = `${j.title} (démo)`;
  const exists = await db.from("jobs").select("id").eq("company_id", companyId).eq("title", title).maybeSingle();
  if (exists.data) return;
  const { country, city, ...fields } = j;
  const { data: job, error } = await db
    .from("jobs")
    .insert({
      ...fields,
      title,
      company_id: companyId,
      created_by: ownerId,
      description: `${DEMO_NOTE}\n\nAu sein d'une équipe accueillante, vous contribuez aux projets de l'entreprise et partagez vos bonnes pratiques. Ce texte sert uniquement à tester la recherche, la page d'offre et la candidature.`,
      missions: "- Contribuer aux projets de l'équipe\n- Partager vos bonnes pratiques\n- Participer à l'amélioration continue",
      profile_sought: "Expérience pertinente, sens du service et goût du travail en équipe.",
      status: "draft",
    })
    .select("id")
    .single();
  if (error) throw error;
  const { data: cityRow } = await db.from("geo_cities").select("id").eq("country_code", country).eq("name", city).limit(1).maybeSingle();
  const loc = await db.from("job_locations").insert({ job_id: job.id, company_id: companyId, country_code: country, city, city_id: cityRow?.id ?? null });
  if (loc.error) throw loc.error;
  // Demo adverts are published without payment: they exist only in pre-production.
  const upd = await db
    .from("jobs")
    .update({ status: "active", published_at: new Date().toISOString(), paid_through: new Date(Date.now() + 30 * 86400000).toISOString() })
    .eq("id", job.id);
  if (upd.error) throw upd.error;
}

// 1. Acceptance-test accounts.
const candidateId = await account("recette.candidat@example.test", "candidate", "Camille", "Recette");
const recruiterId = await account("recette.recruteur@example.test", "employer", "Rania", "Recette");
const adminId = await account("recette.admin@example.test", "candidate", "Adam", "Recette");
const moderatorId = await account("recette.moderation@example.test", "candidate", "Mona", "Recette");
const financeId = await account("recette.finance@example.test", "candidate", "Farid", "Recette");
await grant(adminId, "super_admin");
await grant(moderatorId, "moderator");
await grant(financeId, "finance");

await db.from("candidate_profiles").update({ headline: "Développeuse web (compte de recette)", country_code: "FR", city: "Lyon", skills: ["React", "TypeScript", "SQL"] }).eq("user_id", candidateId);

// The recruiter's company: verified, no advert (the recruiter creates and pays for one during acceptance).
await company(recruiterId, {
  legal_name: "Société de recette (démo)",
  registration_country: "FR",
  registration_id_type: "fr_siren",
  registration_number: "000000018",
  hq_address_line1: "1 rue de la Recette",
  hq_postal_code: "69002",
  hq_city: "Lyon",
  hq_country: "FR",
  industry: "it_software",
  size_range: "11-50",
  representative_title: "Gérante",
  is_legal_representative: true,
  description: "Entreprise fictive de préproduction, utilisée pour la recette.",
});

// 2. Demo companies and adverts, to make search and job pages realistic.
const demoOwner = await account("demo.entreprises@example.test", "employer", "Démo", "Entreprises");
const demoCompanyId = await company(demoOwner, {
  legal_name: "Atelier Numérique (démo)",
  registration_country: "FR",
  registration_id_type: "fr_siren",
  registration_number: "000000000",
  hq_address_line1: "10 rue de la Démo",
  hq_postal_code: "75002",
  hq_city: "Paris",
  hq_country: "FR",
  industry: "it_software",
  size_range: "51-200",
  representative_title: "Président",
  is_legal_representative: true,
  description: "Entreprise fictive de préproduction : ses offres servent uniquement à la démonstration.",
});
const jobs = [
  { title: "Développeur·se React / TypeScript", country: "FR", city: "Lyon", contract_type: "permanent", work_mode: "hybrid", remote_scope: "employer_country", experience_level: "mid", salary_min: 42000, salary_max: 52000, salary_currency: "EUR", salary_period: "year", required_skills: ["React", "TypeScript"], working_languages: ["fr"] },
  { title: "Product designer UX/UI", country: "FR", city: "Paris", contract_type: "permanent", work_mode: "remote", remote_scope: "listed_countries", remote_countries: ["FR", "BE"], experience_level: "senior", salary_min: 50000, salary_max: 60000, salary_currency: "EUR", salary_period: "year", required_skills: ["Figma"], working_languages: ["fr", "en"] },
  { title: "Comptable confirmé·e", country: "FR", city: "Marseille", contract_type: "permanent", work_mode: "onsite", experience_level: "mid", salary_min: 36000, salary_max: 42000, salary_currency: "EUR", salary_period: "year", required_skills: ["Comptabilité générale"], working_languages: ["fr"] },
  { title: "Stagiaire data analyst", country: "FR", city: "Toulouse", contract_type: "internship", work_mode: "onsite", experience_level: "entry", salary_min: 1000, salary_max: 1200, salary_currency: "EUR", salary_period: "month", required_skills: ["SQL", "Python"], working_languages: ["fr"] },
  { title: "Chef·fe de chantier gros œuvre", country: "FR", city: "Nantes", contract_type: "fixed_term", work_mode: "onsite", experience_level: "senior", salary_min: 3500, salary_max: 4200, salary_currency: "EUR", salary_period: "month", required_skills: ["Gros œuvre"], working_languages: ["fr"] },
  { title: "Infirmier·ère de nuit", country: "FR", city: "Lille", contract_type: "permanent", work_mode: "onsite", experience_level: "mid", salary_min: 2300, salary_max: 2800, salary_currency: "EUR", salary_period: "month", required_skills: ["Soins infirmiers"], working_languages: ["fr"] },
];
for (const j of jobs) await demoJob(demoCompanyId, demoOwner, j);

// 3. Credentials: only in the local, git-ignored file.
const lines = [
  "Tamurt Jobs — comptes de recette (PRÉPRODUCTION UNIQUEMENT, ne jamais réutiliser ces mots de passe)",
  `Généré le ${new Date().toISOString()} pour ${url}`,
  "",
  ...accounts.map((a) => `${a.email}\t${a.password}\t${a.type}`),
  "",
  "recette.admin : super administrateur ; recette.moderation : modération ; recette.finance : paiements et remboursements.",
  "Le back-office demande une application d'authentification (double authentification) à la première connexion.",
];
writeFileSync(outFile, lines.join("\n") + "\n", { mode: 0o600 });
console.log(`preprod-seed: ${accounts.length} accounts and ${jobs.length} demo adverts ready; credentials written to ${outFile}`);
