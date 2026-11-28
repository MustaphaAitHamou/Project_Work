import { expect, preprodAccount, test } from "./access";
import type { Page } from "@playwright/test";

/**
 * Pre-production with the owner's REAL Turnstile keys and Supabase captcha protection ON:
 * a request WITHOUT a valid token must be refused, and the visitor told so. This is what a bot
 * that cannot pass the challenge gets. The challenge itself is never solved or bypassed here;
 * the positive path (a person who passes it) is checked by hand (docs/RECETTE.md, T-10).
 * Refused requests create nothing and send no e-mail.
 */
const candidate = () => preprodAccount("recette.candidat@example.test");

/** A visitor without a token: the hidden field is emptied right before sending. */
async function submitWithoutToken(page: Page, button: string, scope = page.locator("body")) {
  await scope.evaluate((el) => {
    for (const input of Array.from(el.querySelectorAll<HTMLInputElement>('input[name="captchaToken"]'))) input.value = "";
  });
  await scope.getByRole("button", { name: button }).click();
}

test("sign-in without a token is refused by Supabase, with a clear message", async ({ preprod: page }) => {
  await page.goto("/fr/login");
  await page.getByRole("textbox", { name: "Adresse e-mail" }).fill(candidate().email);
  await page.locator("input[name=password]").fill(candidate().password);
  await submitWithoutToken(page, "Se connecter");
  await expect(page.getByText("La vérification anti-robot a échoué. Réessayez.")).toBeVisible();
  await expect(page).toHaveURL(/\/fr\/login/);
});

test("forgotten password without a token: refused, and never « e-mail sent »", async ({ preprod: page }) => {
  await page.goto("/fr/forgot-password");
  await page.getByRole("textbox", { name: /e-mail/i }).first().fill(candidate().email);
  await submitWithoutToken(page, "Envoyer le lien");
  await expect(page.getByText("La vérification anti-robot a échoué. Réessayez.")).toBeVisible();
  await expect(page.getByText("Si un compte correspond à cette adresse")).toHaveCount(0);
});

test("sign-up and confirmation resend without a token: refused, no account created", async ({ preprod: page }) => {
  await page.goto("/fr/signup");
  await page.getByRole("textbox", { name: "Prénom", exact: true }).fill("Robot");
  await page.getByRole("textbox", { name: "Nom", exact: true }).fill("Sans Jeton");
  await page.getByRole("textbox", { name: "Adresse e-mail", exact: true }).fill(`robot.${Date.now()}@example.test`);
  await page.locator("input[name=password]").fill("Str0ngPassw0rd");
  await page.locator("input[name=passwordConfirm]").fill("Str0ngPassw0rd");
  await page.locator("input[name=terms]").check();
  await submitWithoutToken(page, "Créer mon compte");
  await expect(page.getByText("La vérification anti-robot a échoué. Réessayez.").first()).toBeVisible();
  await expect(page).toHaveURL(/\/fr\/signup/);

  await page.goto("/fr/check-email");
  await page.locator("#resend-email").fill(candidate().email);
  await submitWithoutToken(page, "Renvoyer");
  await expect(page.getByText("La vérification anti-robot a échoué. Réessayez.")).toBeVisible();
});

test("anonymous report without a token: refused by the application's own check", async ({ preprod: page }) => {
  await page.goto("/fr/jobs");
  await page.locator('a[href*="/fr/jobs/"]').first().click();
  await page.getByRole("button", { name: "Signaler" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("combobox").first().selectOption({ index: 0 });
  await submitWithoutToken(page, "Envoyer le signalement", dialog);
  await expect(dialog.getByText("Vérification anti-robot échouée.")).toBeVisible();
});
