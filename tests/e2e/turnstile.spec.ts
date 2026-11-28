import { expect, test, type Page, type Request } from "@playwright/test";
import { activateJob, createCompany, createDraftJob, createTestUser, resetRateLimits, sql, uniqueEmail } from "../helpers/supabase";
import { linkFromEmail, openConfirmationLink } from "./helpers";

/**
 * Cloudflare Turnstile on every authentication form, with Cloudflare's documented TEST keys
 * (the widget always issues a token, the server-side check always accepts it):
 *   NEXT_PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA
 *   TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA   (build and server)
 * Run with TURNSTILE_E2E=1 against a server built that way; skipped otherwise.
 * The local Auth server cannot reach Cloudflare, so its own captcha check stays off here: what
 * Supabase does with the token is checked on the pre-production site (tests/preprod).
 */
test.skip(process.env.TURNSTILE_E2E !== "1", "Build and start the server with Cloudflare's test keys, then set TURNSTILE_E2E=1.");
const proxyServer = process.env.HTTPS_PROXY ?? process.env.https_proxy;
test.use({ locale: "fr-FR", ...(proxyServer ? { proxy: { server: proxyServer, bypass: "localhost,127.0.0.1" } } : {}) });
test.beforeEach(async () => {
  await resetRateLimits();
});

async function widgetToken(page: Page, index = 0): Promise<string> {
  const field = page.locator('input[type=hidden][name="captchaToken"]').nth(index);
  await expect(field).toHaveValue(/.+/, { timeout: 30_000 });
  return field.inputValue();
}

/** The body of the next form submission (Server Action POST). */
function nextSubmission(page: Page): Promise<string> {
  return page.waitForRequest((r: Request) => r.method() === "POST" && Boolean(r.headers()["next-action"]), { timeout: 30_000 }).then((r) => r.postData() ?? "");
}

test("sign-in: the token goes with each attempt; after a wrong password a new token is issued; candidate and recruiter reach their space", async ({ page, browser }) => {
  const candidate = await createTestUser("candidate", { firstName: "Tina", lastName: "Turnstile" });
  await page.goto("/fr/login");
  const first = await widgetToken(page);
  await page.getByRole("textbox", { name: "Adresse e-mail" }).fill(candidate.email);
  await page.locator("input[name=password]").fill("Mauvais-Mot-De-Passe-1");
  const sent = nextSubmission(page);
  await page.getByRole("button", { name: "Se connecter" }).click();
  expect(await sent).toContain(first);
  await expect(page.getByText("E-mail ou mot de passe incorrect.")).toBeVisible();

  // The used token is never sent twice: the widget gives a new one for the next attempt.
  await expect.poll(() => page.locator('input[name="captchaToken"]').inputValue(), { timeout: 30_000 }).not.toBe("");
  const second = await widgetToken(page);
  await page.locator("input[name=password]").fill(candidate.password);
  const sentAgain = nextSubmission(page);
  await page.getByRole("button", { name: "Se connecter" }).click();
  expect(await sentAgain).toContain(second);
  await page.waitForURL(/\/fr\/candidate/);

  const recruiter = await createCompany({ verified: true });
  const context = await browser.newContext({ locale: "fr-FR", ...(proxyServer ? { proxy: { server: proxyServer, bypass: "localhost,127.0.0.1" } } : {}) });
  const other = await context.newPage();
  await other.goto("/fr/login");
  const token = await widgetToken(other);
  await other.getByRole("textbox", { name: "Adresse e-mail" }).fill(recruiter.owner.email);
  await other.locator("input[name=password]").fill(recruiter.owner.password);
  const recruiterSent = nextSubmission(other);
  await other.getByRole("button", { name: "Se connecter" }).click();
  expect(await recruiterSent).toContain(token);
  await other.waitForURL(/\/fr\/employer/);
  await context.close();
});

test("sign-up with the widget, then the confirmation e-mail resent with a fresh token", async ({ page }) => {
  const email = uniqueEmail("e2e.turnstile");
  await page.goto("/fr/signup");
  const token = await widgetToken(page);
  await page.getByRole("textbox", { name: "Prénom", exact: true }).fill("Sana");
  await page.getByRole("textbox", { name: "Nom", exact: true }).fill("Widget");
  await page.getByRole("textbox", { name: "Adresse e-mail", exact: true }).fill(email);
  await page.locator("input[name=password]").fill("Str0ngPassw0rd");
  await page.locator("input[name=passwordConfirm]").fill("Str0ngPassw0rd");
  await page.locator("input[name=terms]").check();
  const sent = nextSubmission(page);
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  expect(await sent).toContain(token);
  await expect(page).toHaveURL(/check-email/);
  await linkFromEmail(email, /auth\/confirm/);

  const resendToken = await widgetToken(page);
  await page.locator("#resend-email").fill(email);
  const resent = nextSubmission(page);
  await page.getByRole("button", { name: "Renvoyer" }).click();
  expect(await resent).toContain(resendToken);
  await expect(page.getByText("Si un compte non confirmé correspond à cette adresse")).toBeVisible();
});

test("forgotten password: token sent, e-mail, one-click page, new password, then sign-in with it", async ({ page }) => {
  const user = await createTestUser("candidate", { firstName: "Rita", lastName: "Reset" });
  await page.goto("/fr/forgot-password");
  const token = await widgetToken(page);
  await page.getByRole("textbox", { name: /e-mail/i }).first().fill(user.email);
  const sent = nextSubmission(page);
  await page.getByRole("button", { name: "Envoyer le lien" }).click();
  expect(await sent).toContain(token);
  await expect(page.getByText("Si un compte correspond à cette adresse")).toBeVisible();

  const link = await linkFromEmail(user.email, /auth\/confirm/);
  await openConfirmationLink(page, link, /Choisir un nouveau mot de passe/);
  await expect(page).toHaveURL(/\/fr\/reset-password/);
  await page.locator("input[name=password]").fill("Nouveau-Mot-De-Passe-7");
  await page.locator("input[name=confirm]").fill("Nouveau-Mot-De-Passe-7");
  await page.getByRole("button", { name: "Mettre à jour le mot de passe" }).click();
  await expect(page.getByText("Votre mot de passe a été mis à jour.")).toBeVisible();

  const fresh = await page.context().browser()!.newContext({ locale: "fr-FR", ...(proxyServer ? { proxy: { server: proxyServer, bypass: "localhost,127.0.0.1" } } : {}) });
  const again = await fresh.newPage();
  await again.goto("/fr/login");
  await widgetToken(again);
  await again.getByRole("textbox", { name: "Adresse e-mail" }).fill(user.email);
  await again.locator("input[name=password]").fill("Nouveau-Mot-De-Passe-7");
  await again.getByRole("button", { name: "Se connecter" }).click();
  await again.waitForURL(/\/fr\/candidate/);
  await fresh.close();
});

test("anonymous report: the application's own server-side check accepts the widget's token (Cloudflare siteverify)", async ({ page }) => {
  const company = await createCompany({ verified: true });
  const job = await createDraftJob(company, { title: "Préparateur de commandes (signalement)" });
  await activateJob(job.id);
  const [row] = await sql<{ slug: string; public_id: string }>(`select slug, public_id from public.jobs where id = $1`, [job.id]);
  await page.goto(`/fr/jobs/${row.slug}-${row.public_id}`);
  await page.getByRole("button", { name: "Signaler" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByTestId("turnstile")).toBeVisible();
  await expect(dialog.locator('input[name="captchaToken"]')).toHaveValue(/.+/, { timeout: 30_000 });
  await dialog.getByRole("combobox").first().selectOption({ index: 0 });
  await dialog.getByLabel("Précisions (facultatif)").fill("Test automatique (anti-robot), à classer sans suite.");
  await dialog.getByRole("button", { name: "Envoyer le signalement" }).click();
  await expect(page.getByText("Merci, votre signalement a été transmis à la modération.")).toBeVisible();
  expect(await sql(`select count(*)::int as n from public.reports where job_id = $1`, [job.id])).toEqual([{ n: 1 }]);
});
