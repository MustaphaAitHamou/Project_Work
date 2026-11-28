import { expect, preprodAccount, test } from "./access";
import type { Page } from "@playwright/test";

/**
 * Pre-production with the owner's REAL Turnstile keys and Supabase captcha protection ON.
 * What a bot gets:
 * - without a token, the form cannot be sent at all (button disabled until the widget answers);
 * - with a forged token (Cloudflare's widget replaced by a fake that hands one out), the request
 *   reaches Supabase Auth, which asks Cloudflare and refuses it; the application refuses it too
 *   for the anonymous report. In pre-production the message carries Cloudflare's code: with a
 *   forged token it must be « invalid-input-response »; « invalid-input-secret » would mean that
 *   the secret key saved in Supabase is not a valid Turnstile secret.
 * The challenge is never solved or bypassed here; the positive path (a person who passes it) is
 * checked by hand (docs/RECETTE.md, T-10). Refused requests create nothing and send no e-mail.
 */
const candidate = () => preprodAccount("recette.candidat@example.test");
const FORGED = "XXXX.DUMMY.TOKEN.XXXX";

/** Cloudflare's script replaced by a widget that hands out the forged token when asked. */
async function fakeWidget(page: Page) {
  await page.route("https://challenges.cloudflare.com/turnstile/v0/api.js*", (route) =>
    route.fulfill({
      contentType: "text/javascript",
      body: `window.__widgets=[];window.turnstile={render(el,o){window.__widgets.push(o);el.textContent="faux widget";return String(window.__widgets.length-1)},reset(){},remove(){}};`,
    }),
  );
}
const handOutForgedToken = (page: Page) => page.evaluate((t) => (window as unknown as { __widgets: { callback: (x: string) => void }[] }).__widgets.at(-1)!.callback(t), FORGED);

/** The refusal message, and Cloudflare's code when shown (pre-production only). */
async function refusal(page: Page, scope = page.locator("body")) {
  const alert = scope.getByText(/La vérification anti-robot a échoué|Vérification anti-robot échouée/).first();
  await expect(alert).toBeVisible();
  const text = (await alert.textContent()) ?? "";
  const code = text.match(/: ([a-z-]+(?:, [a-z-]+)*)\s*$/)?.[1] ?? "";
  test.info().annotations.push({ type: "cloudflare", description: code || "(pas de détail)" });
  return code;
}

test("without a token the sign-in form cannot be sent", async ({ preprod: page }) => {
  await fakeWidget(page);
  await page.goto("/fr/login");
  await page.getByRole("textbox", { name: "Adresse e-mail" }).fill(candidate().email);
  await page.locator("input[name=password]").fill(candidate().password);
  await expect(page.getByTestId("turnstile-status")).toHaveText("Vérification anti-robot en cours…");
  await expect(page.getByRole("button", { name: "Se connecter" })).toBeDisabled();
});

test("sign-in with a forged token is refused by Supabase after asking Cloudflare", async ({ preprod: page }) => {
  await fakeWidget(page);
  await page.goto("/fr/login");
  await page.getByRole("textbox", { name: "Adresse e-mail" }).fill(candidate().email);
  await page.locator("input[name=password]").fill(candidate().password);
  await handOutForgedToken(page);
  await page.getByRole("button", { name: "Se connecter" }).click();
  expect(await refusal(page)).toBe("invalid-input-response");
  await expect(page).toHaveURL(/\/fr\/login/);
});

test("forgotten password with a forged token: refused, and never « e-mail sent »", async ({ preprod: page }) => {
  await fakeWidget(page);
  await page.goto("/fr/forgot-password");
  await page.getByRole("textbox", { name: /e-mail/i }).first().fill(candidate().email);
  await handOutForgedToken(page);
  await page.getByRole("button", { name: "Envoyer le lien" }).click();
  expect(await refusal(page)).toBe("invalid-input-response");
  await expect(page.getByText("Si un compte correspond à cette adresse")).toHaveCount(0);
});

test("sign-up and confirmation resend with a forged token: refused, no account created", async ({ preprod: page }) => {
  await fakeWidget(page);
  await page.goto("/fr/signup");
  await page.getByRole("textbox", { name: "Prénom", exact: true }).fill("Robot");
  await page.getByRole("textbox", { name: "Nom", exact: true }).fill("Jeton Forgé");
  await page.getByRole("textbox", { name: "Adresse e-mail", exact: true }).fill(`robot.${Date.now()}@example.test`);
  await page.locator("input[name=password]").fill("Str0ngPassw0rd");
  await page.locator("input[name=passwordConfirm]").fill("Str0ngPassw0rd");
  await page.locator("input[name=terms]").check();
  await handOutForgedToken(page);
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await expect(page.getByText("La vérification anti-robot a échoué. Réessayez.").first()).toBeVisible();
  await expect(page.getByText(/invalid-input-response/)).toBeVisible();
  await expect(page).toHaveURL(/\/fr\/signup/);

  await page.goto("/fr/check-email");
  await page.locator("#resend-email").fill(candidate().email);
  await handOutForgedToken(page);
  await page.getByRole("button", { name: "Renvoyer" }).click();
  expect(await refusal(page)).toBe("invalid-input-response");
});

test("anonymous report with a forged token: refused by the application's own check", async ({ preprod: page }) => {
  await fakeWidget(page);
  await page.goto("/fr/jobs");
  await page.locator('a[href*="/fr/jobs/"]').first().click();
  await page.getByRole("button", { name: "Signaler" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("combobox").first().selectOption({ index: 0 });
  await handOutForgedToken(page);
  await dialog.getByRole("button", { name: "Envoyer le signalement" }).click();
  await expect(dialog.getByText("Vérification anti-robot échouée.")).toBeVisible();
});
