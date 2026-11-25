import { expect, test } from "@playwright/test";
import { createTestUser, sql } from "../helpers/supabase";

/**
 * Advertising (Google AdSense). Runs against a build where NEXT_PUBLIC_ADSENSE_CLIENT is set
 * (a dummy publisher id is enough: Google's servers are not contacted by the assertions).
 */
const CLIENT = process.env.NEXT_PUBLIC_ADSENSE_CLIENT ?? "";
test.skip(!/^ca-pub-\d{10,20}$/.test(CLIENT), "Build the app with NEXT_PUBLIC_ADSENSE_CLIENT to test advertising.");
test.describe.configure({ mode: "serial" });

const SLOTS = { home: "1111111111", jobs: "2222222222", job: "3333333333", companies: "4444444444", company: "5555555555" };

async function setAds(enabled: boolean) {
  await sql(`update public.platform_settings set value = $1::jsonb where key = 'ads.enabled'`, [JSON.stringify(enabled)]);
  await sql(`update public.platform_settings set value = $1::jsonb where key = 'ads.slots'`, [JSON.stringify(enabled ? SLOTS : {})]);
}

test.afterAll(async () => {
  await setAds(false);
});

test("switched off from the back-office settings: no ad markup, no AdSense script", async ({ page }) => {
  await setAds(false);
  await page.goto("/fr/jobs");
  await expect(page.locator("ins.adsbygoogle")).toHaveCount(0);
  await expect(page.locator('script[src*="googlesyndication"]')).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Paramètres des cookies" })).toHaveCount(0);
});

test("switched on: labelled slots on public pages only, ads.txt, CSP and the consent link", async ({ page, request }) => {
  await setAds(true);

  for (const [path, placement] of [["/fr", "home"], ["/fr/jobs", "jobs"], ["/fr/companies", "companies"]] as const) {
    await page.goto(path);
    const slot = page.locator(`aside[data-ad-placement="${placement}"]`);
    await expect(slot).toBeVisible();
    await expect(slot.getByText("Publicité")).toBeVisible();
    await expect(slot.locator("ins.adsbygoogle")).toHaveAttribute("data-ad-client", CLIENT);
    await expect(slot.locator("ins.adsbygoogle")).toHaveAttribute("data-ad-slot", SLOTS[placement]);
    // Space is reserved before the ad loads: no layout shift.
    const box = await slot.locator(".ad-slot-box").boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(280);
  }
  await expect(page.getByRole("link", { name: "Paramètres des cookies" })).toBeVisible();

  // Never on authentication, legal or private pages.
  for (const path of ["/fr/login", "/fr/signup", "/fr/legal/privacy"]) {
    await page.goto(path);
    await expect(page.locator("ins.adsbygoogle")).toHaveCount(0);
  }
  const candidate = await createTestUser("candidate", { firstName: "Pub", lastName: "Privee" });
  await page.goto("/fr/login");
  await page.getByRole("textbox", { name: "Adresse e-mail" }).fill(candidate.email);
  await page.locator("input[name=password]").fill(candidate.password);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await page.waitForURL((url) => !url.pathname.endsWith("/login"));
  for (const path of ["/fr/candidate", "/fr/candidate/applications", "/fr/candidate/settings"]) {
    await page.goto(path);
    await expect(page.locator("ins.adsbygoogle")).toHaveCount(0);
  }

  // ads.txt authorises Google for this publisher only.
  const adsTxt = await request.get("/ads.txt");
  expect(adsTxt.status()).toBe(200);
  expect(await adsTxt.text()).toBe(`google.com, ${CLIENT.replace(/^ca-/, "")}, DIRECT, f08c47fec0942fa0\n`);

  // The content security policy lets AdSense and its consent platform load.
  const res = await request.get("/fr");
  const csp = res.headers()["content-security-policy"] ?? "";
  expect(csp).toContain("https://*.googlesyndication.com");
  expect(csp).toMatch(/frame-src [^;]*https:\/\/\*\.doubleclick\.net/);
});
