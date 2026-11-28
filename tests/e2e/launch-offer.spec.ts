import { expect, test, type Page } from "@playwright/test";
import { createCompany, createReadyCandidate, resetRateLimits, restoreFreePeriod, setFreePublicationUntil, sql } from "../helpers/supabase";
import { emailSubjects } from "./helpers";

/**
 * Offre de lancement (publication gratuite jusqu'au 31/12/2026 23:59:59, heure de Paris).
 * Horloge simulée : la fin de l'offre (réglage en base) est déplacée, jamais l'heure du serveur.
 */
const CRON = { authorization: `Bearer ${process.env.CRON_SECRET ?? ""}` };

test.describe.configure({ mode: "serial" });
test.beforeEach(async () => {
  await resetRateLimits();
});
test.afterAll(async () => {
  await restoreFreePeriod();
});

async function login(page: Page, email: string, password: string) {
  await page.goto("/fr/login");
  await page.getByRole("textbox", { name: "Adresse e-mail" }).fill(email);
  await page.locator("input[name=password]").fill(password);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await page.waitForURL((url) => !url.pathname.endsWith("/login"));
}

async function createAdvert(page: Page, title: string) {
  await page.goto("/fr/employer/jobs/new");
  await page.getByLabel("Intitulé du poste").fill(title);
  await page
    .getByLabel("Description", { exact: true })
    .fill("Vous accueillez et conseillez nos clients en agence, suivez leurs demandes et participez à l'amélioration de nos services au quotidien.");
  await page.getByRole("combobox", { name: "Ville" }).fill("Lyon");
  await page.getByRole("button", { name: "Soumettre pour publication" }).click();
}

let company: Awaited<ReturnType<typeof createCompany>>;
let jobId = "";
let publicPath = "";

test("during the offer: banner, free publication without card, public advert, conversion with explicit consent", async ({ page, browser }) => {
  await restoreFreePeriod(); // end: 1 January 2027 00:00, Paris time
  await sql(`update public.countries set is_paid_publishing_enabled = true, is_registration_open = true where code = 'FR'`);

  // Banner on the home page, with the normal price from 1 January 2027; not on the job search.
  await page.goto("/fr");
  const banner = page.getByTestId("launch-offer");
  await expect(banner).toContainText("Offre de lancement : publiez gratuitement vos annonces jusqu'au 31 décembre 2026.");
  await expect(banner).toContainText("Tarif normal à compter du 1er janvier 2027 : 5,95 € HT par mois et par annonce active.");
  await page.goto("/fr/jobs");
  await expect(page.getByTestId("launch-offer")).toHaveCount(0);
  await page.goto("/fr/recruiters");
  await expect(page.getByTestId("launch-offer-pricing")).toContainText("Gratuit");
  await expect(page.getByTestId("launch-offer-pricing")).toContainText("jusqu'au 31 décembre 2026");
  await expect(page.getByText("À compter du 1er janvier 2027", { exact: true })).toBeVisible();

  // A verified company publishes at once, for free: no payment page, no subscription.
  company = await createCompany({ verified: true });
  await login(page, company.owner.email, company.owner.password);
  await expect(page.getByTestId("launch-offer")).toContainText("jusqu'au 31 décembre 2026");
  await createAdvert(page, "Conseiller·ère clientèle (offre de lancement)");
  await expect(page).toHaveURL(/\/fr\/employer\/jobs\/[0-9a-f-]{36}\?published=free/);
  jobId = new URL(page.url()).pathname.split("/").pop()!;
  await expect(page.getByTestId("published-free")).toContainText("Elle est gratuite jusqu'au 31 décembre 2026 (offre de lancement).");
  expect(await sql(`select count(*)::int as n from public.subscriptions where job_id = $1`, [jobId])).toEqual([{ n: 0 }]);
  const [row] = await sql(`select slug, public_id, status from public.jobs where id = $1`, [jobId]);
  expect(row.status).toBe("active");
  publicPath = `/fr/jobs/${row.slug}-${row.public_id}`;

  const visitor = await (await browser.newContext({ locale: "fr-FR" })).newPage();
  expect((await visitor.goto(publicPath))!.status()).toBe(200);
  await expect(visitor.getByRole("heading", { level: 1 })).toContainText("Conseiller·ère clientèle");
  const candidate = await createReadyCandidate();
  expect((await candidate.client.rpc("apply_to_job", { p_job_id: jobId })).error).toBeNull();
  await visitor.context().close();

  // Conversion before the end: first charge on 1 January 2027 only, with its own consent.
  await page.goto(`/fr/employer/jobs/${jobId}`);
  await page.getByRole("link", { name: "Garder en ligne après l'offre" }).click();
  await expect(page).toHaveURL(new RegExp(`/fr/employer/checkout/${jobId}`));
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Garder l'annonce en ligne après l'offre de lancement");
  await expect(page.getByTestId("first-charge")).toContainText("Aucun prélèvement avant le 1er janvier 2027.");
  await expect(page.getByText("J'autorise le prélèvement de l'abonnement (5,95 € HT par mois) à partir du 1er janvier 2027.")).toBeVisible();
  await expect(page.locator("input[name=acceptCharge], button[role=checkbox][name=acceptCharge]").first()).toBeAttached();
});

test("at the end of the offer: hidden at once, paused by the maintenance (not deleted), reactivation offered; new adverts are paid", async ({ page, request, browser }) => {
  test.skip(!jobId, "depends on the previous test");
  // Simulated end of the offer: 1 January 2027 00:00 (Paris) is now in the past.
  await setFreePublicationUntil(new Date(Date.now() - 60_000));
  await sql(`update public.jobs set free_until = now() - interval '1 second' where id = $1`, [jobId]);

  // Before any scheduled task: no banner, the advert is no longer public.
  await page.goto("/fr");
  await expect(page.getByTestId("launch-offer")).toHaveCount(0);
  const visitor = await (await browser.newContext({ locale: "fr-FR" })).newPage();
  expect((await visitor.goto(publicPath))!.status()).toBe(404);
  await visitor.context().close();

  // The daily maintenance records the pause once and tells the company.
  expect((await request.get("/api/cron/maintenance", { headers: CRON })).status()).toBe(200);
  expect((await request.get("/api/cron/maintenance", { headers: CRON })).status()).toBe(200);
  expect((await sql(`select status, suspension_reason from public.jobs where id = $1`, [jobId]))[0]).toEqual({ status: "suspended", suspension_reason: "free_period_ended" });
  expect(await sql(`select count(*)::int as n from public.applications where job_id = $1`, [jobId])).toEqual([{ n: 1 }]);
  expect(await sql(`select count(*)::int as n from public.email_outbox where user_id = $1 and template = 'free_period_ended'`, [company.owner.id])).toEqual([{ n: 1 }]);
  expect((await request.get("/api/cron/emails", { headers: CRON })).status()).toBe(200);
  await expect.poll(() => emailSubjects(company.owner.email)).toContain("Annonce en pause : Conseiller·ère clientèle (offre de lancement)");

  // The recruiter still sees it, with its applications, and can reactivate it by subscribing.
  await login(page, company.owner.email, company.owner.password);
  await page.goto(`/fr/employer/jobs/${jobId}`);
  await expect(page.getByTestId("free-ended")).toContainText("Annonce en pause : l'offre de lancement est terminée");
  await expect(page.getByRole("link", { name: "1 candidature" })).toBeVisible();
  await page.getByRole("link", { name: "Réactiver l'annonce" }).click();
  await expect(page).toHaveURL(new RegExp(`/fr/employer/checkout/${jobId}`));
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Réactiver l'annonce");
  await expect(page.getByTestId("first-charge")).toHaveCount(0);

  // A new advert now goes to the payment page.
  await createAdvert(page, "Assistant·e commercial·e (après l'offre)");
  await expect(page).toHaveURL(/\/fr\/employer\/checkout\//);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Publier l'annonce");
});
