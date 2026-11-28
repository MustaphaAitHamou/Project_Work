import { expect, test } from "./access";

/**
 * Pre-production after a deployment: what a visitor can check without an account (the sign-in
 * of the acceptance accounts goes through the real Turnstile challenge, checked by hand).
 * Nothing is created, sent or consumed: the e-mail link below carries a made-up token and the
 * confirmation button is never clicked.
 */
test("home, languages and right-to-left Arabic", async ({ preprod: page }) => {
  for (const [path, lang, dir] of [
    ["/fr", "fr", "ltr"],
    ["/en", "en", "ltr"],
    ["/es", "es", "ltr"],
    ["/ar", "ar", "rtl"],
  ] as const) {
    const res = await page.goto(path);
    expect(res?.status(), path).toBe(200);
    await expect(page.locator("html")).toHaveAttribute("lang", lang);
    await expect(page.locator("html")).toHaveAttribute("dir", dir);
  }
});

test("unknown addresses get the translated 404 page of the site", async ({ preprod: page }) => {
  for (const [path, heading] of [
    ["/es/pagina-que-no-existe", "Página no encontrada"],
    ["/fr/jobs/annonce-inexistante-ZZZZZZZZ", "Page introuvable"],
  ] as const) {
    const res = await page.goto(path);
    expect(res?.status(), path).toBe(404);
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();
  }
});

test("e-mail links: opening one never uses it (one click on the page does), a broken one is explained", async ({ preprod: page }) => {
  await page.goto("/auth/confirm?token_hash=abcdefghijklmnop&type=email&locale=fr");
  await expect(page).toHaveURL(/\/fr\/confirm\?token_hash=abcdefghijklmnop&type=email/);
  await expect(page.getByRole("button", { name: "Activer mon compte" })).toBeVisible();
  await page.goto("/auth/confirm?token_hash=abc&type=recovery&locale=fr");
  await expect(page).toHaveURL(/\/fr\/login\?error=link_invalid/);
  await expect(page.getByText("Ce lien est invalide ou a expiré.")).toBeVisible();
});

test("never indexed: noindex header and robots.txt closed", async ({ preprod: page }) => {
  const res = await page.goto("/fr");
  expect(res?.headers()["x-robots-tag"] ?? "").toContain("noindex");
  // Through the page (the protection bypass is added to the page's requests only).
  const robots = await page.goto("/robots.txt");
  expect(await robots!.text()).toMatch(/User-Agent: \*\s+Disallow: \//);
});
