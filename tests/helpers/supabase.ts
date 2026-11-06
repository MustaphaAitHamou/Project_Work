/**
 * Integration-test helpers. They talk to the LOCAL Supabase stack started with
 * `npm run supabase:start`. The default keys below are the public, well-known
 * development keys printed by the Supabase CLI for local stacks (not secrets).
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import pg from "pg";
import type { Database } from "@/lib/supabase/database.types";

export const SUPABASE_URL = process.env.TEST_SUPABASE_URL ?? "http://127.0.0.1:54321";
export const PUBLISHABLE_KEY =
  process.env.TEST_SUPABASE_PUBLISHABLE_KEY ?? "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH";
export const SECRET_KEY = process.env.TEST_SUPABASE_SECRET_KEY ?? "REDACTED_LOCAL_DEV_KEY";
export const DB_URL = process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
export const MAILPIT_URL = process.env.TEST_MAILPIT_URL ?? "http://127.0.0.1:54324";

export type TestClient = SupabaseClient<Database>;

export const serviceClient: TestClient = createClient<Database>(SUPABASE_URL, SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export function anonClient(): TestClient {
  return createClient<Database>(SUPABASE_URL, PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

let pool: pg.Pool | null = null;
export function db(): pg.Pool {
  pool ??= new pg.Pool({ connectionString: DB_URL, max: 5 });
  return pool;
}
export async function closeDb() {
  await pool?.end();
  pool = null;
}

export async function sql<T extends pg.QueryResultRow = pg.QueryResultRow>(text: string, params: unknown[] = []) {
  const res = await db().query<T>(text, params);
  return res.rows;
}

export interface TestUser {
  id: string;
  email: string;
  password: string;
  client: TestClient;
}

export const uniqueEmail = (prefix: string) => `${prefix}.${randomUUID().slice(0, 8)}@example.test`;

export async function createTestUser(
  type: "candidate" | "employer",
  opts: { firstName?: string; lastName?: string; confirmed?: boolean } = {},
): Promise<TestUser> {
  const email = uniqueEmail(type);
  const password = "Str0ngPassw0rd!";
  const { data, error } = await serviceClient.auth.admin.createUser({
    email,
    password,
    email_confirm: opts.confirmed ?? true,
    user_metadata: {
      account_type: type,
      first_name: opts.firstName ?? "Test",
      last_name: opts.lastName ?? (type === "candidate" ? "Candidate" : "Employer"),
      locale: "fr",
      terms_accepted: true,
      terms_version: "2026-11-01",
    },
  });
  if (error || !data.user) throw error ?? new Error("user not created");
  const client = anonClient();
  const signIn = await client.auth.signInWithPassword({ email, password });
  if (signIn.error) throw signIn.error;
  return { id: data.user.id, email, password, client };
}

/** Candidate with a complete profile, a clean primary CV version and the transmission consent. */
export async function createReadyCandidate(): Promise<TestUser & { versionId: string; resumeId: string }> {
  const user = await createTestUser("candidate", { firstName: "Amel", lastName: "Durand" });
  const upd = await user.client
    .from("candidate_profiles")
    .update({ headline: "Développeuse React", country_code: "FR", city: "Lyon", skills: ["React", "TypeScript"] })
    .eq("user_id", user.id);
  if (upd.error) throw upd.error;
  const versionId = randomUUID();
  const storagePath = `${user.id}/${versionId}.pdf`;
  const file = readFileSync(path.join(__dirname, "../fixtures/cv-valid.pdf"));
  const up = await serviceClient.storage.from("resumes").upload(storagePath, file, { contentType: "application/pdf" });
  if (up.error) throw up.error;
  const reg = await serviceClient.rpc("resume_register_version", {
    p_user_id: user.id,
    p_resume_id: null as unknown as string,
    p_label: "CV principal",
    p_version_id: versionId,
    p_storage_path: storagePath,
    p_filename: "cv.pdf",
    p_mime_type: "application/pdf",
    p_size_bytes: 1234,
    p_sha256: "a".repeat(64),
  });
  if (reg.error) throw reg.error;
  const resumeId = (reg.data as { resume_id: string }).resume_id;
  const consent = await user.client.rpc("give_transmission_consent", { p_version: "2026-11-01" });
  if (consent.error) throw consent.error;
  return { ...user, versionId, resumeId };
}

export interface TestCompany {
  owner: TestUser;
  companyId: string;
}

let companyCounter = 0;
export async function createCompany(opts: { verified?: boolean; country?: string } = {}): Promise<TestCompany> {
  const owner = await createTestUser("employer", { firstName: "Karim", lastName: "Martin" });
  companyCounter += 1;
  const regNumber = `${Date.now()}${companyCounter}`.slice(-9);
  const { data, error } = await serviceClient.rpc("create_company", {
    p_actor: owner.id,
    p: {
      legal_name: `Société Test ${regNumber}`,
      registration_country: opts.country ?? "FR",
      registration_id_type: "fr_siren",
      registration_number: regNumber,
      hq_address_line1: "1 rue de la Paix",
      hq_postal_code: "75002",
      hq_city: "Paris",
      hq_country: opts.country ?? "FR",
      industry: "it_software",
      representative_title: "Gérant",
      is_legal_representative: true,
    },
  });
  if (error) throw error;
  const companyId = data as string;
  if (opts.verified ?? true) {
    await sql(`update public.companies set verification_status = 'verified', verified_at = now() where id = $1`, [companyId]);
  }
  return { owner, companyId };
}

export async function createDraftJob(company: TestCompany, overrides: Record<string, unknown> = {}, country = "FR") {
  const { data: job, error } = await company.owner.client
    .from("jobs")
    .insert({
      company_id: company.companyId,
      created_by: company.owner.id,
      title: "Développeur React / TypeScript",
      description:
        "Rejoignez notre équipe produit pour concevoir des interfaces accessibles et performantes. Vous travaillerez avec une équipe pluridisciplinaire.",
      contract_type: "permanent",
      experience_level: "mid",
      working_languages: ["fr"],
      required_skills: ["React", "TypeScript"],
      ...overrides,
    })
    .select("id, public_id, slug, status")
    .single();
  if (error) throw error;
  const loc = await company.owner.client
    .from("job_locations")
    .insert({ job_id: job.id, company_id: company.companyId, country_code: country, city: "Lyon" });
  if (loc.error) throw loc.error;
  return job;
}

/** Makes a job publicly active as if a payment had been confirmed by Stripe. */
export async function activateJob(jobId: string) {
  await sql(
    `update public.jobs set status = 'active', published_at = now(), paid_through = now() + interval '30 days' where id = $1`,
    [jobId],
  );
}

export async function setCountryPaidPublishing(code: string, enabled: boolean) {
  await sql(`update public.countries set is_paid_publishing_enabled = $2 where code = $1`, [code, enabled]);
}

/** Rate-limit counters are shared by every test running from the same IP. */
export async function resetRateLimits() {
  await sql(`delete from public.rate_limits`);
}

export async function grantAdminRole(userId: string, role: string) {
  await sql(`insert into public.admin_roles (user_id, role) values ($1, $2) on conflict do nothing`, [userId, role]);
}
