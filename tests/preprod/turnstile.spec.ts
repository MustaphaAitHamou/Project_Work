import { expect, preprodAccount, test } from "./access";
import type { Page, Request } from "@playwright/test";

/**
 * Cloudflare Turnstile on the deployed pre-production site, with Cloudflare's real widget
 * (pre-production uses Cloudflare's TEST keys: the widget always issues a token).
 * Checks that every protected form sends the widget's token with its submission, that the
 * widget is renewed after each submission, and that the application's own server-side check
 * (anonymous report) accepts it.
 */
const candidate = () => preprodAccount("recette.candidat@example.test");

// With the owner's REAL widget keys, Cloudflare shows an interactive challenge to automated
// browsers (observed on 28/11: « Vérifiez que vous êtes humain »): no token can be obtained
// automatically, by design. These checks then run with Cloudflare's test keys only, and the
// real keys are checked by a person (docs/RECETTE.md, T-10).
test.skip(process.env.PREPROD_TURNSTILE_KEYS === "real", "Real Turnstile keys deployed: manual check T-10 in docs/RECETTE.md.");

/** Cloudflare draws the widget in an isolated frame: we check that its area is displayed. */
async function widgetShown(page: Page, scope = page.locator("body")) {
  const box = scope.getByTestId("turnstile");
  await expect(box).toBeVisible({ timeout: 30_000 });
  await expect.poll(async () => (await box.boundingBox())?.height ?? 0, { timeout: 30_000 }).toBeGreaterThan(30);
}

async function widgetToken(page: Page): Promise<string> {
  const field = page.locator('input[type=hidden][name="captchaToken"]').first();
  await expect(field).toHaveValue(/.+/, { timeout: 30_000 });
  return field.inputValue();
}

/** The body of the next form submission (Server Action POST) sent to the page. */
function nextSubmission(page: Page): Promise<string> {
  return page
    .waitForRequest((r: Request) => r.method() === "POST" && Boolean(r.headers()["next-action"]), { timeout: 30_000 })
    .then((r) => r.postData() ?? "");
}

async function countResets(page: Page) {
  await page.waitForFunction(() => Boolean(window.turnstile));
  await page.evaluate(() => {
    const w = window as unknown as { turnstile: { reset: (id: string) => void }; __resets: number };
    w.__resets = 0;
    const original = w.turnstile.reset.bind(w.turnstile);
    w.turnstile.reset = (id: string) => {
      w.__resets += 1;
      original(id);
    };
  });
}
const resets = (page: Page) => page.evaluate(() => (window as unknown as { __resets: number }).__resets);

test("login: the token goes with each attempt; after a wrong password the widget issues a new one", async ({ preprod: page }) => {
  await page.goto("/fr/login");
  await widgetShown(page);
  const first = await widgetToken(page);
  await countResets(page);

  await page.getByRole("textbox", { name: "Adresse e-mail" }).fill(candidate().email);
  await page.locator("input[name=password]").fill("Mauvais-Mot-De-Passe-1");
  const sent = nextSubmission(page);
  await page.getByRole("button", { name: "Se connecter" }).click();
  expect(await sent).toContain(first);
  await expect(page.getByText("E-mail ou mot de passe incorrect.")).toBeVisible();
  await expect.poll(() => resets(page)).toBe(1);

  // Second attempt with the right password: a token is present again and goes with it.
  const second = await widgetToken(page);
  await page.locator("input[name=password]").fill(candidate().password);
  const sentAgain = nextSubmission(page);
  await page.getByRole("button", { name: "Se connecter" }).click();
  expect(await sentAgain).toContain(second);
  await page.waitForURL(/\/fr\/candidate/, { timeout: 30_000 });
});

test("forgotten password and confirmation resend: the token goes with the request", async ({ preprod: page }) => {
  await page.goto("/fr/forgot-password");
  const token = await widgetToken(page);
  await page.getByRole("textbox", { name: /e-mail/i }).first().fill(candidate().email);
  const sent = nextSubmission(page);
  await page.getByRole("button", { name: /envoyer|réinitialis/i }).click();
  expect(await sent).toContain(token);
  await expect(page.getByText("Si un compte correspond à cette adresse")).toBeVisible();

  await page.goto("/fr/check-email");
  const resendToken = await widgetToken(page);
  await page.locator("#resend-email").fill(candidate().email);
  const resent = nextSubmission(page);
  await page.getByRole("button", { name: "Renvoyer" }).click();
  expect(await resent).toContain(resendToken);
  await expect(page.getByText("Si un compte non confirmé correspond à cette adresse")).toBeVisible();
});

test("sign-up: the widget is there and its token goes with the form (submission intercepted, no account created)", async ({ preprod: page }) => {
  await page.goto("/fr/signup");
  const token = await widgetToken(page);
  const body = new Promise<string>((resolve) => {
    void page.route("**/fr/signup", async (route) => {
      if (route.request().method() === "POST") {
        resolve(route.request().postData() ?? "");
        await route.abort();
      } else await route.continue();
    });
  });
  await page.evaluate(() => {
    const form = document.querySelector('input[name="captchaToken"]')?.closest("form");
    form?.requestSubmit();
  });
  expect(await body).toContain(token);
});

test("anonymous report: the application's server-side check accepts the widget's token", async ({ preprod: page }) => {
  await page.goto("/fr/jobs");
  await page.locator('a[href*="/fr/jobs/"]').filter({ hasText: "(démo)" }).first().click();
  await page.getByRole("button", { name: "Signaler" }).click();
  const dialog = page.getByRole("dialog");
  await widgetShown(page, dialog);
  await widgetToken(page);
  await dialog.getByRole("combobox").first().selectOption({ index: 0 });
  await dialog.getByLabel("Précisions (facultatif)").fill("Test automatique de recette (anti-robot) — à classer sans suite.");
  await dialog.getByRole("button", { name: "Envoyer le signalement" }).click();
  await expect(page.getByText("Merci, votre signalement a été transmis à la modération.")).toBeVisible();
});
