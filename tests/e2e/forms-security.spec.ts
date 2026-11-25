import { expect, test } from "@playwright/test";

/**
 * Before the page's JavaScript runs (slow network, script blocked), a form must never be sent
 * by the browser as a GET: the e-mail address and the password would end up in the address,
 * the browser history and the server logs. Seen on a slow server: /fr/login?email=…&password=…
 */
test("without JavaScript, the login and sign-up forms cannot send the password in the address", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, locale: "fr-FR" });
  const page = await context.newPage();

  await page.goto("/fr/login");
  const form = page.locator("form", { has: page.locator("input[name=password]") });
  await expect(form).toHaveAttribute("method", "post");
  await expect(page.getByRole("button", { name: "Se connecter" })).toBeDisabled();
  await page.getByRole("textbox", { name: "Adresse e-mail" }).fill("personne@example.test");
  await page.locator("input[name=password]").fill("MotDePasse-Secret-1");
  await page.locator("input[name=password]").press("Enter");
  await expect(page).toHaveURL(/\/fr\/login$/);
  expect(page.url()).not.toContain("MotDePasse");

  await page.goto("/fr/signup");
  const signup = page.locator("form", { has: page.locator("input[name=password]") });
  await expect(signup).toHaveAttribute("method", "post");
  await expect(signup.locator("button[type=submit]")).toBeDisabled();
  await context.close();
});

test("with JavaScript, the same forms become usable once the page is ready", async ({ page }) => {
  await page.goto("/fr/login");
  await expect(page.getByRole("button", { name: "Se connecter" })).toBeEnabled();
});
