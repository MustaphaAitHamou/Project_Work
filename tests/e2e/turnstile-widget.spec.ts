import { expect, test, type Page, type Request } from "@playwright/test";
import { createTestUser, resetRateLimits } from "../helpers/supabase";

/**
 * Behaviour of the anti-robot widget in the forms, with Cloudflare's script replaced by a fake
 * that the test drives (token issued, expired, error). Nothing is solved: the fake hands out
 * made-up tokens, exactly what a real widget does after its own check.
 * Needs a server built with a Turnstile site key (any value): run with TURNSTILE_E2E=1, like
 * turnstile.spec.ts. The local Auth server does not check tokens; Supabase's own check is
 * covered on the pre-production site (tests/preprod/captcha-enforced.spec.ts).
 */
test.skip(process.env.TURNSTILE_E2E !== "1", "Build and start the server with a Turnstile site key, then set TURNSTILE_E2E=1.");
test.use({ locale: "fr-FR" });
test.beforeEach(async ({ page }) => {
  await resetRateLimits();
  await page.route("https://challenges.cloudflare.com/turnstile/v0/api.js*", (route) => route.fulfill({ contentType: "text/javascript", body: FAKE_TURNSTILE }));
});

const FAKE_TURNSTILE = `(() => {
  const state = { widgets: [], resets: 0, seq: 0 };
  const last = () => state.widgets[state.widgets.length - 1];
  window.__turnstile = {
    state,
    solve() { const token = "fake-token-" + (++state.seq); last().opts.callback(token); return token; },
    expire() { last().opts["expired-callback"](); },
    fail() { last().opts["error-callback"](); },
    option(name) { return last().opts[name]; },
  };
  window.turnstile = {
    render(el, opts) { state.widgets.push({ el, opts }); el.textContent = "Widget de test"; return String(state.widgets.length - 1); },
    reset() { state.resets += 1; },
    remove() {},
  };
})();`;

/** The fake script is loaded by the page after hydration: wait until it has rendered a widget. */
const rendered = (page: Page) =>
  page.waitForFunction(() => ((window as unknown as { __turnstile?: { state: { widgets: unknown[] } } }).__turnstile?.state.widgets.length ?? 0) > 0);
async function solve(page: Page) {
  await rendered(page);
  return page.evaluate(() => (window as unknown as { __turnstile: { solve: () => string } }).__turnstile.solve());
}
async function fake(page: Page, fn: "expire" | "fail") {
  await rendered(page);
  await page.evaluate((f) => (window as unknown as Record<string, Record<string, () => void>>).__turnstile[f](), fn);
}
const resets = (page: Page) => page.evaluate(() => (window as unknown as { __turnstile: { state: { resets: number } } }).__turnstile.state.resets);
const hiddenToken = (page: Page) => page.locator('input[name="captchaToken"]').inputValue();
const status = (page: Page) => page.getByTestId("turnstile-status");

function submissions(page: Page): string[] {
  const bodies: string[] = [];
  page.on("request", (r: Request) => {
    if (r.method() === "POST" && r.headers()["next-action"]) bodies.push(r.postData() ?? "");
  });
  return bodies;
}

test("sign-in: no sending before the token; the token goes once; after a refusal a new one is required", async ({ page }) => {
  const user = await createTestUser("candidate", { firstName: "Wanda", lastName: "Widget" });
  const sent = submissions(page);
  await page.goto("/fr/login");
  const button = page.getByRole("button", { name: "Se connecter" });
  await page.getByRole("textbox", { name: "Adresse e-mail" }).fill(user.email);
  await page.locator("input[name=password]").fill("Mauvais-Mot-De-Passe-1");

  // Before the widget has a token: the button is disabled, and Enter sends nothing.
  await expect(status(page)).toHaveText("Vérification anti-robot en cours…");
  await expect(button).toBeDisabled();
  await page.locator("input[name=password]").press("Enter");
  expect(await page.evaluate(() => (window as unknown as { __turnstile: { option: (n: string) => unknown } }).__turnstile.option("refresh-expired"))).toBe("auto");

  const first = await solve(page);
  await expect(button).toBeEnabled();
  await expect(status(page)).toHaveText("");
  await button.click();
  await expect(page.getByText("E-mail ou mot de passe incorrect.")).toBeVisible();
  expect(sent).toHaveLength(1);
  expect(sent[0]).toContain(first);

  // The used token is gone and the widget was reset: the next attempt waits for a new token.
  expect(await resets(page)).toBe(1);
  expect(await hiddenToken(page)).toBe("");
  await expect(button).toBeDisabled();
  const second = await solve(page);
  expect(second).not.toBe(first);
  await page.locator("input[name=password]").fill(user.password);
  await button.click();
  await page.waitForURL(/\/fr\/candidate/);
  expect(sent).toHaveLength(2);
  expect(sent[1]).toContain(second);
  expect(sent[1]).not.toContain(first);
});

test("an expired token blocks sending until Turnstile issues a new one", async ({ page }) => {
  await page.goto("/fr/login");
  const button = page.getByRole("button", { name: "Se connecter" });
  await solve(page);
  await expect(button).toBeEnabled();
  await fake(page, "expire");
  expect(await hiddenToken(page)).toBe("");
  await expect(button).toBeDisabled();
  await expect(status(page)).toHaveText("Vérification anti-robot en cours…");
  await solve(page);
  await expect(button).toBeEnabled();
});

test("a widget error is explained and blocks sending until the widget recovers", async ({ page }) => {
  await page.goto("/fr/login");
  const button = page.getByRole("button", { name: "Se connecter" });
  await fake(page, "fail");
  await expect(status(page)).toContainText("La vérification anti-robot n'a pas pu aboutir.");
  await expect(button).toBeDisabled();
  await solve(page);
  await expect(status(page)).toHaveText("");
  await expect(button).toBeEnabled();
});

test("same rule on the other forms: sign-up, forgotten password, confirmation resend, anonymous report", async ({ page }) => {
  for (const [path, name] of [
    ["/fr/signup", "Créer mon compte"],
    ["/fr/forgot-password", "Envoyer le lien"],
    ["/fr/check-email", "Renvoyer"],
  ] as const) {
    await page.goto(path);
    const button = page.getByRole("button", { name });
    await expect(button, path).toBeDisabled();
    await solve(page);
    await expect(button, path).toBeEnabled();
  }
  await page.goto("/fr/jobs");
  const advert = page.locator('a[href*="/fr/jobs/"]').first();
  test.skip((await advert.count()) === 0, "no published advert in the local database");
  await advert.click();
  await page.getByRole("button", { name: "Signaler" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("button", { name: "Envoyer le signalement" })).toBeDisabled();
  await solve(page);
  await expect(dialog.getByRole("button", { name: "Envoyer le signalement" })).toBeEnabled();
});
