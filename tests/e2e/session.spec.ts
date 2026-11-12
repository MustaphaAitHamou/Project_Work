import { expect, test } from "@playwright/test";
import { createTestUser, resetRateLimits, uniqueEmail } from "../helpers/supabase";
import { linkFromEmail } from "./helpers";

test.beforeEach(async () => {
  await resetRateLimits();
});

test("a signed-in user can sign out from the account menu", async ({ page }) => {
  const user = await createTestUser("candidate", { firstName: "Leo", lastName: "Sortie" });
  await page.goto("/fr/login");
  await page.getByRole("textbox", { name: "Adresse e-mail" }).fill(user.email);
  await page.locator("input[name=password]").fill(user.password);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await page.waitForURL((url) => !url.pathname.endsWith("/login"));

  await page.getByRole("button", { name: /Menu du compte/ }).click();
  await page.getByRole("menuitem", { name: "Se déconnecter" }).click();
  await expect(page).toHaveURL(/\/fr$/);
  await expect(page.getByRole("link", { name: "Connexion" }).first()).toBeVisible();

  // The session is really gone: private pages redirect to the login page.
  await page.goto("/fr/candidate");
  await expect(page).toHaveURL(/\/fr\/login/);
});

test("the check-email page moves on by itself once the link is opened in another tab", async ({ page, context }) => {
  const email = uniqueEmail("e2e.onglet");
  await page.goto("/fr/signup");
  await page.waitForLoadState("networkidle");
  await page.getByRole("textbox", { name: "Prénom", exact: true }).fill("Nora");
  await page.getByRole("textbox", { name: "Nom", exact: true }).fill("Onglet");
  await page.getByRole("textbox", { name: "Adresse e-mail", exact: true }).fill(email);
  await page.locator("input[name=password]").fill("Str0ngPassw0rd");
  await page.locator("input[name=terms]").check();
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await expect(page).toHaveURL(/check-email/);

  const link = await linkFromEmail(email, /auth\/confirm/);
  const mailTab = await context.newPage();
  await mailTab.goto(link);
  await expect(mailTab).toHaveURL(/\/fr\/candidate/);

  // The first tab notices the session without any action from the user.
  await expect(page).toHaveURL(/\/fr\/candidate/, { timeout: 15_000 });
});
