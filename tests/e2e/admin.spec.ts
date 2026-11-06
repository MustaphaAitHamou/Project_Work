import { createHash, randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { createCompany, createDraftJob, createReadyCandidate, createTestUser, grantAdminRole, resetRateLimits, serviceClient, sql, type TestUser } from "../helpers/supabase";

test.beforeEach(async () => {
  await resetRateLimits();
});

async function login(page: Page, user: TestUser) {
  await page.goto("/fr/login");
  await page.getByRole("textbox", { name: "Adresse e-mail" }).fill(user.email);
  await page.locator("input[name=password]").fill(user.password);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await page.waitForURL((url) => !url.pathname.endsWith("/login"));
}

async function staff(page: Page, role: string, firstName = "Nadia") {
  const user = await createTestUser("candidate", { firstName, lastName: "Staff" });
  await grantAdminRole(user.id, role);
  await login(page, user);
  return user;
}

const saved = (page: Page) => expect(page.getByText("Modification enregistrée").last()).toBeVisible();

test.describe("Back-office access control", () => {
  test("a candidate is turned away; a moderator only sees the sections of the role", async ({ page }) => {
    const candidate = await createTestUser("candidate");
    await login(page, candidate);
    await page.goto("/fr/admin");
    await expect(page).toHaveURL(/\/fr$/);

    await page.context().clearCookies();
    const moderator = await staff(page, "moderator", "Mona");
    await page.goto("/fr/admin");
    await expect(page.getByRole("heading", { name: "Tableau de bord", level: 1 })).toBeVisible();
    await expect(page.getByRole("link", { name: "Annonces" }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Paiements" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Pays et conformité" })).toHaveCount(0);
    // Revenue figures are reserved to finance roles.
    await expect(page.getByText("Revenu mensuel récurrent")).toHaveCount(0);

    // Page guard and database guard both refuse.
    await page.goto("/fr/admin/payments");
    await expect(page).toHaveURL(/\/fr$/);
    const direct = await moderator.client.rpc("admin_update_country", { p_code: "FR", p: { is_paid_publishing_enabled: true } } as never);
    expect(direct.error?.message).toBe("forbidden");
  });
});

test.describe("Super administrator", () => {
  test("verifies a company, moderates an advert, and both decisions are audited", async ({ page }) => {
    await staff(page, "super_admin");
    const company = await createCompany({ verified: false });
    await sql(`update public.companies set verification_status = 'manual_review' where id = $1`, [company.companyId]);
    const [{ legal_name: legalName }] = await sql(`select legal_name from public.companies where id = $1`, [company.companyId]);

    await page.goto("/fr/admin/companies");
    await page.getByRole("link", { name: legalName }).click();
    await expect(page.getByRole("heading", { name: legalName })).toBeVisible();
    await page.locator("select[name=decision]").selectOption("verified");
    await page.locator("textarea[name=message]").fill("Votre entreprise est vérifiée. Bienvenue !");
    await page.locator("textarea[name=internalNote]").first().fill("Extrait Kbis contrôlé.");
    await page.getByRole("button", { name: "Enregistrer la décision" }).click();
    await saved(page);
    await expect.poll(async () => (await sql(`select verification_status from public.companies where id = $1`, [company.companyId]))[0].verification_status).toBe("verified");
    await expect(page.getByText("Extrait Kbis contrôlé.")).toBeVisible();

    // An advert flagged for review is approved by a human; without a live subscription it waits for payment.
    const title = `Agent d'accueil ${randomUUID().slice(0, 5)}`;
    const job = await createDraftJob(company, { title });
    await sql(`update public.jobs set status = 'in_review' where id = $1`, [job.id]);
    await page.goto("/fr/admin/jobs");
    await page.getByRole("link", { name: title }).click();
    await page.locator("select[name=decision]").selectOption("approve");
    await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
    await saved(page);
    await expect.poll(async () => (await sql(`select status from public.jobs where id = $1`, [job.id]))[0].status).toBe("pending_payment");

    await page.goto("/fr/admin/audit");
    await expect(page.getByRole("cell", { name: "company.review" }).first()).toBeVisible();
    await expect(page.getByRole("cell", { name: "job.approve" }).first()).toBeVisible();
    const audit = await sql(`select action from public.admin_audit_logs where target_id in ($1, $2) order by id`, [company.companyId, job.id]);
    expect(audit.map((a) => a.action)).toEqual(expect.arrayContaining(["company.review", "job.approve"]));
  });

  test("paid publishing in a market requires the blocking checklist or a justified override", async ({ page }) => {
    await staff(page, "super_admin");
    await sql(`update public.countries set is_paid_publishing_enabled = false where code = 'LU'`);
    await sql(`update public.country_compliance_items set status = 'todo' where country_code = 'LU'`);
    try {
      await page.goto("/fr/admin/countries/LU");
      await page.getByLabel("Publication payante activée").check();
      await page.getByRole("button", { name: "Enregistrer les paramètres" }).click();
      await expect(page.getByText("La checklist de conformité de ce pays n'est pas terminée.")).toBeVisible();
      await expect.poll(async () => (await sql(`select is_paid_publishing_enabled from public.countries where code = 'LU'`))[0].is_paid_publishing_enabled).toBe(false);

      // One checklist item documented with evidence.
      const item = page.getByRole("listitem").filter({ hasText: "Protection des données personnelles" });
      await item.locator("select[name=status]").selectOption("done");
      await item.getByPlaceholder("Lien vers la preuve").fill("https://example.test/avis-juridique-lu.pdf");
      await item.getByRole("button", { name: "Enregistrer" }).click();
      await saved(page);
      await expect.poll(async () => (await sql(`select status from public.country_compliance_items where country_code = 'LU' and item_key = 'data_protection'`))[0].status).toBe("done");

      // Explicit, justified and audited override.
      const justification = "Ouverture pilote validée par le conseil local le 05/11/2026, réf. TJ-LU-001.";
      await page.getByLabel("Publication payante activée").check();
      await page.locator("textarea[name=override]").fill(justification);
      await page.getByRole("button", { name: "Enregistrer les paramètres" }).click();
      await saved(page);
      await expect.poll(async () => (await sql(`select is_paid_publishing_enabled from public.countries where code = 'LU'`))[0].is_paid_publishing_enabled).toBe(true);
      await expect.poll(async () => (await sql(`select count(*)::int as n from public.admin_audit_logs where action = 'country.update' and target_id = 'LU' and details ? 'override_justification' and details->>'override_justification' is not null`))[0].n).toBeGreaterThan(0);
      const [log] = await sql(`select details from public.admin_audit_logs where action = 'country.update' and target_id = 'LU' order by id desc limit 1`);
      expect(log.details.override_justification).toBe(justification);
    } finally {
      await sql(`update public.countries set is_paid_publishing_enabled = false where code = 'LU'`);
      await sql(`update public.country_compliance_items set status = 'todo', evidence_url = null where country_code = 'LU'`);
    }
  });

  test("a new price version replaces the previous one for its country and currency", async ({ page }) => {
    await staff(page, "super_admin");
    await sql(`update public.pricing_plans set is_active = false where country_code = 'CH'`);
    try {
      await page.goto("/fr/admin/pricing");
      await page.locator("select[name=country]").selectOption("CH");
      await page.locator("select[name=currency]").selectOption("CHF");
      await page.locator("input[name=amount]").fill("6,50");
      await page.getByRole("button", { name: "Créer le tarif" }).click();
      await saved(page);
      await page.locator("select[name=country]").selectOption("CH");
      await page.locator("select[name=currency]").selectOption("CHF");
      await page.locator("input[name=amount]").fill("6,90");
      await page.getByRole("button", { name: "Créer le tarif" }).click();
      await saved(page);
      await expect.poll(async () => sql(`select unit_amount, currency, is_active from public.pricing_plans where country_code = 'CH' order by created_at desc limit 2`)).toEqual([
        { unit_amount: 690, currency: "CHF", is_active: true },
        { unit_amount: 650, currency: "CHF", is_active: false },
      ]);
      const price = await serviceClient.rpc("get_job_price", { p_country: "CH" });
      expect(price.data).toMatchObject({ currency: "CHF", unit_amount: 690 });
      // Other markets keep the default catalogue price.
      expect((await serviceClient.rpc("get_job_price", { p_country: "FR" })).data).toMatchObject({ currency: "EUR", unit_amount: 595 });
    } finally {
      await sql(`update public.pricing_plans set is_active = false where country_code = 'CH'`);
    }
  });

  test("Tamurt HQ API: one-time token, aggregated data only, IP allowlist and revocation", async ({ page, request }) => {
    await staff(page, "super_admin");
    const name = `HQ ${randomUUID().slice(0, 6)}`;
    await page.goto("/fr/admin/settings");
    await page.locator("input[name=name]").fill(name);
    await page.getByRole("button", { name: "Créer un client" }).click();
    const token = (await page.locator("code").filter({ hasText: /^tjhq_/ }).textContent())!.trim();
    expect(token).toMatch(/^tjhq_[A-Za-z0-9_-]{43}$/);
    const [stored] = await sql(`select token_hash, token_prefix from public.service_api_clients where name = $1`, [name]);
    expect(stored.token_hash).toBe(createHash("sha256").update(token).digest("hex"));
    expect(stored.token_prefix).toBe(token.slice(0, 10));
    await page.reload();
    await expect(page.locator("code").filter({ hasText: /^tjhq_/ })).toHaveCount(0); // never shown again

    const url = "/api/internal/hq/v1/metrics?from=2026-01-01&to=2026-12-31";
    const auth = { authorization: `Bearer ${token}` };
    expect((await request.get(url)).status()).toBe(401);
    expect((await request.get(url, { headers: { authorization: `Bearer tjhq_${"x".repeat(43)}` } })).status()).toBe(401);
    const ok = await request.get(url, { headers: auth });
    expect(ok.status()).toBe(200);
    expect(ok.headers()["cache-control"]).toBe("no-store");
    const body = await ok.json();
    expect(body.api_version).toBe("v1");
    expect(body.candidates.total).toBeGreaterThan(0);
    expect(Array.isArray(body.geography)).toBe(true);
    const raw = JSON.stringify(body);
    expect(raw).not.toContain("@");
    expect(raw).not.toMatch(/first_name|last_name|"email"|resume|storage_path|legal_name|phone/);
    expect((await request.get("/api/internal/hq/v1/metrics?from=2026-12-31&to=2026-01-01", { headers: auth })).status()).toBe(400);

    await sql(`update public.service_api_clients set allowed_ips = '{203.0.113.0/24}' where name = $1`, [name]);
    expect((await request.get(url, { headers: { ...auth, "x-forwarded-for": "198.51.100.7" } })).status()).toBe(403);
    expect((await request.get(url, { headers: { ...auth, "x-forwarded-for": "203.0.113.9" } })).status()).toBe(200);

    const row = page.getByRole("row").filter({ hasText: name });
    await row.getByRole("checkbox").check();
    await row.getByRole("button", { name: "Révoquer" }).click();
    await saved(page);
    await expect.poll(async () => (await request.get(url, { headers: { ...auth, "x-forwarded-for": "203.0.113.9" } })).status()).toBe(401);
  });

  test("suspends and reactivates an account with a reason", async ({ page }) => {
    await staff(page, "super_admin");
    const target = await createTestUser("candidate", { firstName: "Yanis", lastName: "Cible" });
    await page.goto(`/fr/admin/users?q=${encodeURIComponent(target.email)}`);
    const card = page.getByRole("listitem").filter({ hasText: target.email });
    await card.getByPlaceholder("Motif (obligatoire)").fill("Usurpation d'identité signalée");
    await card.getByRole("button", { name: "Suspendre" }).click();
    await saved(page);
    await expect.poll(async () => (await sql(`select status from public.users where id = $1`, [target.id]))[0].status).toBe("suspended");
    await card.getByPlaceholder("Motif (obligatoire)").fill("Identité confirmée par le support");
    await card.getByRole("button", { name: "Réactiver" }).click();
    await saved(page);
    await expect.poll(async () => (await sql(`select status from public.users where id = $1`, [target.id]))[0].status).toBe("active");
  });

  test("customises an e-mail template per language and restores the default", async ({ page }) => {
    await staff(page, "super_admin");
    await sql(`delete from public.email_templates where template = 'application_submitted' and locale = 'fr'`);
    await page.goto("/fr/admin/emails?template=application_submitted&lang=fr");
    await page.locator("input[name=subject]").fill("Candidature reçue : {{job_title}}");
    await page.locator("textarea[name=body]").fill("Bonjour {{first_name}}, votre candidature a bien été transmise.\n\n<b>Merci</b>");
    await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
    await saved(page);
    // Preview (sample data) uses the override; HTML typed by the administrator is not interpreted.
    await expect(page.getByText("Candidature reçue : Comptable")).toBeVisible();
    await expect(page.locator("pre").getByText("Bonjour Lina, votre candidature a bien été transmise.")).toBeVisible();
    await expect(page.locator("pre").getByText("<b>Merci</b>")).toBeVisible();
    await page.getByRole("button", { name: "Revenir au texte par défaut" }).click();
    await saved(page);
    await expect.poll(async () => sql(`select 1 from public.email_templates where template = 'application_submitted' and locale = 'fr'`)).toHaveLength(0);
  });
});

test.describe("Privacy officer", () => {
  test("erases an account on request: CV files deleted, applications anonymised, request completed", async ({ page }) => {
    await staff(page, "privacy_officer", "Paula");
    const candidate = await createReadyCandidate();
    const company = await createCompany();
    const job = await createDraftJob(company);
    await sql(`update public.jobs set status = 'active', published_at = now(), paid_through = now() + interval '30 days' where id = $1`, [job.id]);
    expect((await candidate.client.rpc("apply_to_job", { p_job_id: job.id })).error).toBeNull();
    const request = await candidate.client.from("privacy_requests").insert({ user_id: candidate.id, email: candidate.email, type: "deletion", details: "Merci de supprimer mon compte." }).select("id").single();
    expect(request.error).toBeNull();

    await page.goto("/fr/admin/privacy");
    const item = page.getByRole("listitem").filter({ hasText: candidate.email });
    await item.getByPlaceholder("ERASE").fill("ERASE");
    await item.getByRole("button", { name: "Effacer le compte" }).click();
    await expect(page.getByText("Compte effacé.")).toBeVisible();

    expect(await sql(`select 1 from auth.users where id = $1`, [candidate.id])).toHaveLength(0);
    expect(await sql(`select 1 from storage.objects where bucket_id = 'resumes' and name like $1`, [`${candidate.id}/%`])).toHaveLength(0);
    const [app] = await sql(`select candidate_snapshot, anonymized_at, resume_version_id from public.applications where job_id = $1`, [job.id]);
    expect(app.candidate_snapshot).toEqual({ anonymized: true });
    expect(app.anonymized_at).not.toBeNull();
    expect(app.resume_version_id).toBeNull();
    await expect.poll(async () => (await sql(`select status from public.privacy_requests where id = $1`, [request.data!.id]))[0].status).toBe("completed");
  });
});
