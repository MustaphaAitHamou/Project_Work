import { expect, test, type Page } from "@playwright/test";
import { createTestUser, grantAdminRole, resetRateLimits, sql, type TestUser } from "../helpers/supabase";
import { msUntilNextWindow, totp } from "../helpers/totp";

const setRequired = (on: boolean) => sql(`update public.platform_settings set value = $1::jsonb where key = 'security.admin_mfa_required'`, [JSON.stringify(on)]);

async function login(page: Page, user: TestUser) {
  await page.goto("/fr/login");
  await page.getByRole("textbox", { name: "Adresse e-mail" }).fill(user.email);
  await page.locator("input[name=password]").fill(user.password);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await page.waitForURL((url) => !url.pathname.endsWith("/login"));
}

test.beforeEach(async () => {
  await resetRateLimits();
});

test("a back-office member sets up an authenticator app, then enters a code at each sign-in", async ({ page }) => {
  test.setTimeout(120_000);
  await setRequired(true);
  try {
    const admin = await createTestUser("candidate", { firstName: "Mfa", lastName: "Interface" });
    await grantAdminRole(admin.id, "super_admin");
    await login(page, admin);

    await page.goto("/fr/admin");
    await expect(page).toHaveURL(/\/fr\/admin-security/);
    await page.getByRole("button", { name: "Configurer l'application" }).click();
    await expect(page.getByRole("img", { name: /QR code/ })).toBeVisible();
    const secret = (await page.getByTestId("totp-secret").textContent())!.trim();

    const code = page.getByRole("textbox", { name: "Code à 6 chiffres" });
    await code.fill(totp(secret) === "000000" ? "111111" : "000000");
    await page.getByRole("button", { name: "Vérifier" }).click();
    await expect(page.getByText("Code incorrect ou expiré").first()).toBeVisible();

    await code.fill(totp(secret));
    await page.getByRole("button", { name: "Vérifier" }).click();
    await expect(page).toHaveURL(/\/fr\/admin$/);
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();

    // Next sign-in: the code is asked again, without a new enrolment.
    await page.context().clearCookies();
    await login(page, admin);
    await page.goto("/fr/admin/settings");
    await expect(page).toHaveURL(/\/fr\/admin-security/);
    await expect(page.getByRole("button", { name: "Configurer l'application" })).toHaveCount(0);
    await page.waitForTimeout(msUntilNextWindow());
    await page.getByRole("textbox", { name: "Code à 6 chiffres" }).fill(totp(secret));
    await page.getByRole("button", { name: "Vérifier" }).click();
    await expect(page).toHaveURL(/\/fr\/admin$/);
  } finally {
    await setRequired(false);
  }
});
