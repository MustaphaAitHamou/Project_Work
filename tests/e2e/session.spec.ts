import { expect, test } from "@playwright/test";
import { createTestUser, resetRateLimits } from "../helpers/supabase";

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
