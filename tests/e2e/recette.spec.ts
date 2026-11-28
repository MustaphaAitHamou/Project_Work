import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import {
  createCompany,
  createDraftJob,
  createReadyCandidate,
  createTestUser,
  FREE_PUBLICATION_DEFAULT,
  grantAdminRole,
  resetRateLimits,
  restoreFreePeriod,
  sql,
  type TestCompany,
  type TestUser,
} from "../helpers/supabase";
import { linkFromEmail, openConfirmationLink } from "./helpers";

/**
 * Recette fonctionnelle (pre-launch acceptance): the journeys not covered by the other files,
 * run against the real application and the local stack, during the launch offer (free
 * publication until 31/12/2026). Nothing here talks to a third-party service.
 */
test.describe.configure({ mode: "serial" });
test.beforeEach(async () => {
  await resetRateLimits();
});
test.afterAll(async () => {
  await restoreFreePeriod();
});

/** A word that only this run's adverts contain (letters only, so the search treats it as one term). */
const RUN = `recette${randomUUID()
  .slice(0, 8)
  .replace(/\d/g, (d) => "ghijklmnop"[Number(d)])}`;

async function login(page: Page, email: string, password: string) {
  await page.goto("/fr/login");
  await page.getByRole("textbox", { name: "Adresse e-mail" }).fill(email);
  await page.locator("input[name=password]").fill(password);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await page.waitForURL((url) => !url.pathname.endsWith("/login"));
}

/** Published through the real submission (launch offer: online at once, for free). */
async function publishedAdvert(company: TestCompany, title: string, overrides: Record<string, unknown> = {}, country = "FR") {
  const job = await createDraftJob(company, { title, ...overrides }, country);
  const { data, error } = await company.owner.client.rpc("submit_job", { p_job_id: job.id });
  if (error) throw error;
  expect((data as { status: string }).status).toBe("active");
  return job.id as string;
}

async function publicPath(jobId: string) {
  const [row] = await sql<{ slug: string; public_id: string }>(`select slug, public_id from public.jobs where id = $1`, [jobId]);
  return `/fr/jobs/${row.slug}-${row.public_id}`;
}

const status = async (jobId: string) => (await sql<{ status: string }>(`select status from public.jobs where id = $1`, [jobId]))[0].status;

test("search: one advert per market, each of the nine markets lists its own; keyword, contract and work-mode filters", async ({ page }) => {
  const company = await createCompany({ verified: true });
  const markets = ["FR", "DZ", "CA", "US", "CH", "LU", "ES", "GB", "BE"] as const;
  const titles = Object.fromEntries(markets.map((c) => [c, `Conseiller clientèle ${RUN} ${c}`])) as Record<(typeof markets)[number], string>;
  for (const c of markets) {
    const job = await createDraftJob(
      company,
      {
        title: titles[c],
        contract_type: c === "DZ" ? "internship" : "permanent",
        ...(c === "CA" ? { work_mode: "hybrid", remote_scope: "employer_country" } : {}),
      },
      c,
    );
    // Adverts outside the markets opened for publication are made visible directly (the
    // opening of a market is a back-office decision, tested in admin.spec.ts).
    await sql(`update public.jobs set status = 'active', published_at = now(), free_until = $2::timestamptz where id = $1`, [job.id, FREE_PUBLICATION_DEFAULT]);
  }

  for (const c of markets) {
    await page.goto(`/fr/jobs?q=${RUN}&country=${c}`);
    const results = page.getByRole("region", { name: /offre/ });
    await expect(results.getByText(titles[c])).toBeVisible();
    for (const other of markets.filter((o) => o !== c)) await expect(results.getByText(titles[other])).toHaveCount(0);
  }

  // Keyword only: the nine adverts. Then the filters of the side panel (GET form).
  await page.goto(`/fr/jobs?q=${RUN}`);
  await expect(page.getByRole("heading", { name: "9 offres" })).toBeVisible();
  const filters = page.getByRole("complementary", { name: "Filtres" });
  await filters.getByRole("checkbox", { name: "Stage" }).check();
  await page.waitForURL(/contract=internship/);
  await expect(page.getByRole("heading", { name: "1 offre" })).toBeVisible();
  await expect(page.getByText(titles.DZ)).toBeVisible();

  await page.goto(`/fr/jobs?q=${RUN}`);
  await page.getByRole("complementary", { name: "Filtres" }).getByRole("checkbox", { name: "Hybride" }).check();
  await page.waitForURL(/mode=hybrid/);
  await expect(page.getByRole("heading", { name: "1 offre" })).toBeVisible();
  await expect(page.getByText(titles.CA)).toBeVisible();

  await page.goto(`/fr/jobs?q=${RUN}`);
  await page.getByRole("complementary", { name: "Filtres" }).locator('select[name="country"]').selectOption("LU");
  await page.waitForURL(/country=LU/);
  await expect(page.getByText(titles.LU)).toBeVisible();
  await expect(page.getByRole("heading", { name: "1 offre" })).toBeVisible();
});

test("sign-in errors: wrong password and unknown address get the same message; a broken e-mail link is explained", async ({ page }) => {
  const user = await createTestUser("candidate", { firstName: "Lina", lastName: "Erreur" });
  await page.goto("/fr/login");
  await page.getByRole("textbox", { name: "Adresse e-mail" }).fill(user.email);
  await page.locator("input[name=password]").fill("Mauvais-Mot-De-Passe-1");
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page.getByText("E-mail ou mot de passe incorrect.")).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Adresse e-mail" })).toHaveValue(user.email);

  await page.getByRole("textbox", { name: "Adresse e-mail" }).fill(`inconnu.${RUN}@example.test`);
  await page.locator("input[name=password]").fill("Str0ngPassw0rd!");
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page.getByText("E-mail ou mot de passe incorrect.")).toBeVisible();
  await expect(page).toHaveURL(/\/fr\/login/);

  // A truncated or altered link from an e-mail.
  await page.goto("/auth/confirm?token_hash=abc&type=recovery&locale=fr");
  await expect(page).toHaveURL(/\/fr\/login\?error=link_invalid/);
  await expect(page.getByText("Ce lien est invalide ou a expiré.")).toBeVisible();
  await page.goto("/fr/confirm?token_hash=abcdefghijkl&type=unknown");
  await expect(page).toHaveURL(/\/fr\/login\?error=link_invalid/);
});

test("forgotten password: e-mail, one-click page, new password; the old one no longer works", async ({ page, browser }) => {
  const user = await createTestUser("candidate", { firstName: "Rania", lastName: "Oubli" });
  await page.goto("/fr/forgot-password");
  await page.getByRole("textbox", { name: /e-mail/i }).first().fill(user.email);
  await page.getByRole("button", { name: "Envoyer le lien" }).click();
  await expect(page.getByText("Si un compte correspond à cette adresse")).toBeVisible();

  const link = await linkFromEmail(user.email, /auth\/confirm/);
  await openConfirmationLink(page, link, /Choisir un nouveau mot de passe/);
  await expect(page).toHaveURL(/\/fr\/reset-password/);
  await page.locator("input[name=password]").fill("Nouveau-Mot-De-Passe-8");
  await page.locator("input[name=confirm]").fill("Nouveau-Mot-De-Passe-8");
  await page.getByRole("button", { name: "Mettre à jour le mot de passe" }).click();
  await expect(page.getByText("Votre mot de passe a été mis à jour.")).toBeVisible();

  const context = await browser.newContext({ locale: "fr-FR" });
  const other = await context.newPage();
  await other.goto("/fr/login");
  await other.getByRole("textbox", { name: "Adresse e-mail" }).fill(user.email);
  await other.locator("input[name=password]").fill(user.password);
  await other.getByRole("button", { name: "Se connecter" }).click();
  await expect(other.getByText("E-mail ou mot de passe incorrect.")).toBeVisible();
  await other.locator("input[name=password]").fill("Nouveau-Mot-De-Passe-8");
  await other.getByRole("button", { name: "Se connecter" }).click();
  await other.waitForURL(/\/fr\/candidate/);
  await context.close();
});

test("recruiter edits a live advert: saved in place; a change with contact details goes back to moderation; approval puts it back online", async ({ page }) => {
  const company = await createCompany({ verified: true });
  const jobId = await publishedAdvert(company, `Chargé d'accueil ${RUN}`);
  await login(page, company.owner.email, company.owner.password);
  await page.goto(`/fr/employer/jobs/${jobId}`);

  // An advert already online offers « Enregistrer les modifications », not the draft buttons.
  await expect(page.getByRole("button", { name: "Enregistrer les modifications" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Soumettre pour publication" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Enregistrer le brouillon" })).toHaveCount(0);

  await page.getByLabel("Intitulé du poste").fill(`Chargée d'accueil bilingue ${RUN}`);
  await page.getByRole("button", { name: "Enregistrer les modifications" }).click();
  await expect(page.getByText("Modifications enregistrées.", { exact: true })).toBeVisible();
  expect(await status(jobId)).toBe("active");
  await page.goto(await publicPath(jobId));
  await expect(page.getByRole("heading", { name: `Chargée d'accueil bilingue ${RUN}` })).toBeVisible();

  // Contact details in the text: the automatic check sends it back to a moderator.
  await page.goto(`/fr/employer/jobs/${jobId}`);
  await page
    .getByLabel("Description", { exact: true })
    .fill("Vous accueillez nos visiteurs et orientez leurs demandes. Pour postuler, écrivez directement à recrutement@exemple-societe.fr.");
  await page.getByRole("button", { name: "Enregistrer les modifications" }).click();
  await expect(page.getByText(/^Modifications enregistrées\. Le contrôle automatique a relevé des formulations à vérifier/)).toBeVisible();
  expect(await status(jobId)).toBe("in_review");
  await page.reload();
  await expect(page.getByText("En modération").first()).toBeVisible();
  expect((await page.request.get(await publicPath(jobId))).status()).toBe(404);
  await page.goto(`/fr/jobs?q=${RUN}`);
  await expect(page.getByText(`Chargée d'accueil bilingue ${RUN}`)).toHaveCount(0);

  // A moderator approves: online again, still free during the offer.
  const moderator = await createTestUser("candidate", { firstName: "Mona", lastName: "Moderation" });
  await grantAdminRole(moderator.id, "moderator");
  const approved = await moderator.client.rpc("admin_moderate_job", { p_job_id: jobId, p_decision: "approve" } as never);
  expect(approved.error).toBeNull();
  expect(await status(jobId)).toBe("active");
  expect((await page.request.get(await publicPath(jobId))).status()).toBe(200);
});

test("recruiter closes a free advert, then reopens it for free during the launch offer", async ({ page }) => {
  const company = await createCompany({ verified: true });
  const title = `Préparateur de commandes ${RUN}`;
  const jobId = await publishedAdvert(company, title);
  await login(page, company.owner.email, company.owner.password);
  await page.goto(`/fr/employer/jobs/${jobId}`);

  await page.getByRole("button", { name: "Clôturer" }).click();
  const dialog = page.getByRole("dialog", { name: "Clôturer cette annonce ?" });
  await expect(dialog).toContainText("Vous pourrez la rouvrir gratuitement jusqu'au 31 décembre 2026.");
  await dialog.getByRole("button", { name: "Clôturer l'annonce" }).click();
  await expect(page.getByText("Annonce clôturée. Vous pouvez la rouvrir gratuitement jusqu'au 31 décembre 2026.")).toBeVisible();
  await expect.poll(() => status(jobId)).toBe("closed");
  await page.goto(`/fr/jobs?q=${RUN}`);
  await expect(page.getByText(title)).toHaveCount(0);

  await page.goto(`/fr/employer/jobs/${jobId}`);
  await page.getByRole("button", { name: "Rouvrir" }).click();
  await expect(page.getByText("Annonce rouverte : gratuite jusqu'au 31 décembre 2026.")).toBeVisible();
  await expect.poll(() => status(jobId)).toBe("active");
  await page.goto(`/fr/jobs?q=${RUN}`);
  await expect(page.getByText(title)).toBeVisible();
});

test("a visitor's anonymous report is handled in the back-office and audited", async ({ page, browser }) => {
  const company = await createCompany({ verified: true });
  const title = `Agent de sécurité ${RUN}`;
  const jobId = await publishedAdvert(company, title);
  await page.goto(await publicPath(jobId));
  await page.getByRole("button", { name: "Signaler" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("combobox").first().selectOption({ index: 0 });
  await dialog.getByLabel("Précisions (facultatif)").fill(`Recette ${RUN} : signalement à traiter.`);
  await dialog.getByRole("button", { name: "Envoyer le signalement" }).click();
  await expect(page.getByText("Merci, votre signalement a été transmis à la modération.")).toBeVisible();
  const [report] = await sql<{ id: string; reporter_id: string | null }>(`select id, reporter_id from public.reports where job_id = $1`, [jobId]);
  expect(report.reporter_id).toBeNull();

  const context = await browser.newContext({ locale: "fr-FR" });
  const admin = await context.newPage();
  const moderator = await createTestUser("candidate", { firstName: "Malik", lastName: "Moderation" });
  await grantAdminRole(moderator.id, "moderator");
  await login(admin, moderator.email, moderator.password);
  await admin.goto("/fr/admin/reports");
  const card = admin.getByRole("listitem").filter({ hasText: `Recette ${RUN}` });
  await expect(card.getByText("Signalement anonyme")).toBeVisible();
  await expect(card.getByRole("link", { name: title })).toBeVisible();
  await card.getByRole("combobox", { name: "Statut" }).selectOption("resolved");
  await card.getByRole("textbox", { name: "Note de résolution" }).fill("Annonce vérifiée, conforme.");
  await card.getByRole("button", { name: "Enregistrer" }).click();
  await expect(admin.getByText("Modification enregistrée").last()).toBeVisible();
  await expect.poll(async () => (await sql<{ status: string }>(`select status from public.reports where id = $1`, [report.id]))[0].status).toBe("resolved");
  const audit = await sql(`select 1 from public.admin_audit_logs where action = 'report.handle' and target_id = $1 and actor_id = $2`, [report.id, moderator.id]);
  expect(audit).toHaveLength(1);
  // Handled reports leave the default list, and stay in « Afficher tout ».
  await admin.goto("/fr/admin/reports");
  await expect(admin.getByText(`Recette ${RUN}`)).toHaveCount(0);
  await admin.goto("/fr/admin/reports?all=1");
  await expect(admin.getByRole("listitem").filter({ hasText: `Recette ${RUN}` }).locator("span").filter({ hasText: /^Traité$/ })).toBeVisible();
  await context.close();
});

test("back-office settings: an invalid end date of the free period is refused; a valid one is saved and audited", async ({ page }) => {
  const admin = await createTestUser("candidate", { firstName: "Sami", lastName: "Reglages" });
  await grantAdminRole(admin.id, "super_admin");
  await login(page, admin.email, admin.password);
  await page.goto("/fr/admin/settings");
  const row = page.getByRole("listitem").filter({ hasText: "billing.free_publication_until" });
  const field = row.getByRole("textbox", { name: "billing.free_publication_until" });
  await expect(field).toHaveValue(JSON.stringify(FREE_PUBLICATION_DEFAULT));

  await field.fill('"31/12/2026"');
  await row.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("Données invalides.").last()).toBeVisible();
  const [kept] = await sql<{ v: string }>(`select value #>> '{}' as v from public.platform_settings where key = 'billing.free_publication_until'`);
  expect(kept.v).toBe(FREE_PUBLICATION_DEFAULT);

  await field.fill(JSON.stringify(FREE_PUBLICATION_DEFAULT));
  await row.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("Modification enregistrée").last()).toBeVisible();
  const audit = await sql(`select 1 from public.admin_audit_logs where action = 'setting.update' and target_id = 'billing.free_publication_until' and actor_id = $1`, [admin.id]);
  expect(audit).toHaveLength(1);
});

test("languages: the switcher keeps the page and the search, Arabic is right to left, 404 pages are translated", async ({ page }) => {
  await page.goto(`/fr/jobs?q=${RUN}`);
  await expect(page.locator("html")).toHaveAttribute("lang", "fr");
  await page.getByRole("button", { name: /Changer de langue/ }).click();
  await page.getByRole("menuitem", { name: "English" }).click();
  await page.waitForURL(new RegExp(`/en/jobs\\?q=${RUN}`));
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");

  await page.getByRole("button", { name: /Change language/ }).click();
  await page.getByRole("menuitem", { name: "العربية" }).click();
  await page.waitForURL(new RegExp(`/ar/jobs\\?q=${RUN}`));
  await expect(page.locator("html")).toHaveAttribute("lang", "ar");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");

  for (const [path, text] of [
    ["/es/pagina-que-no-existe", "Página no encontrada"],
    ["/fr/jobs/annonce-inexistante-ZZZZZZZZ", "Page introuvable"],
    ["/ar/companies/inexistante", "الصفحة غير موجودة"],
  ] as const) {
    const res = await page.goto(path);
    expect(res?.status(), path).toBe(404);
    await expect(page.getByRole("heading", { name: text })).toBeVisible();
  }
});

test("notifications: the candidate and the recruiter see the application in their space, then mark it as read", async ({ page, browser }) => {
  const company = await createCompany({ verified: true });
  const title = `Assistant logistique ${RUN}`;
  const jobId = await publishedAdvert(company, title);
  const candidate = await createReadyCandidate();
  const applied = await candidate.client.rpc("apply_to_job", { p_job_id: jobId });
  expect(applied.error).toBeNull();

  await login(page, candidate.email, candidate.password);
  await page.goto("/fr/candidate");
  const panel = page.getByTestId("notifications");
  await expect(panel.getByText(`Candidature envoyée : ${title}`)).toBeVisible();
  await expect(panel.getByText("1 nouvelle")).toBeVisible();
  await expect(panel.getByRole("link", { name: "Suivre mes candidatures" })).toHaveAttribute("href", "/fr/candidate/applications");
  await panel.getByRole("button", { name: "Tout marquer comme lu" }).click();
  await expect(panel.getByText("1 nouvelle")).toHaveCount(0);
  await expect(panel.getByText(`Candidature envoyée : ${title}`)).toBeVisible();
  const unread = await sql(`select 1 from public.notifications where user_id = $1 and read_at is null`, [candidate.id]);
  expect(unread).toHaveLength(0);

  const context = await browser.newContext({ locale: "fr-FR" });
  const recruiter = await context.newPage();
  await login(recruiter, company.owner.email, company.owner.password);
  await recruiter.goto("/fr/employer");
  const box = recruiter.getByTestId("notifications");
  await expect(box.getByText(`Nouvelle candidature : ${title}`)).toBeVisible();
  // Each person sees only their own notifications.
  await expect(box.getByText(`Candidature envoyée : ${title}`)).toHaveCount(0);
  await context.close();
});

test("permissions: each space is closed to visitors and to the other account types", async ({ browser }) => {
  const visitor = await (await browser.newContext({ locale: "fr-FR" })).newPage();
  for (const path of ["/fr/candidate", "/fr/employer", "/fr/admin"]) {
    await visitor.goto(path);
    await expect(visitor, path).toHaveURL(/\/fr\/login/);
  }

  const candidate: TestUser = await createTestUser("candidate", { firstName: "Cyril", lastName: "Droits" });
  const asCandidate = await (await browser.newContext({ locale: "fr-FR" })).newPage();
  await login(asCandidate, candidate.email, candidate.password);
  await asCandidate.goto("/fr/employer/jobs");
  await expect(asCandidate).toHaveURL(/\/fr\/candidate/);
  await asCandidate.goto("/fr/admin/users");
  await expect(asCandidate).toHaveURL(/\/fr$/);

  const company = await createCompany({ verified: true });
  const asRecruiter = await (await browser.newContext({ locale: "fr-FR" })).newPage();
  await login(asRecruiter, company.owner.email, company.owner.password);
  await asRecruiter.goto("/fr/candidate/applications");
  await expect(asRecruiter).toHaveURL(/\/fr\/employer/);
  await asRecruiter.goto("/fr/admin");
  await expect(asRecruiter).toHaveURL(/\/fr$/);
  // Another company's advert cannot be opened in the recruiter area. (The recruiter area streams
  // behind loading.tsx: Next.js then keeps the HTTP status 200, renders the 404 page and adds
  // noindex, so what the person sees is checked here.)
  const other = await createCompany({ verified: true });
  const foreignTitle = `Annonce d'une autre société ${RUN}`;
  const foreignJob = await publishedAdvert(other, foreignTitle);
  for (const path of [`/fr/employer/jobs/${foreignJob}`, `/fr/employer/jobs/${foreignJob}/applications`]) {
    await asRecruiter.goto(path);
    await expect(asRecruiter.getByRole("heading", { name: "Page introuvable" }), path).toBeVisible();
    await expect(asRecruiter.getByText(foreignTitle)).toHaveCount(0);
  }
});
