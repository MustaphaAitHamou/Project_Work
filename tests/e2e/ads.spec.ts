import { expect, test, type Page } from "@playwright/test";
import { activateJob, createCompany, createDraftJob, createTestUser, sql } from "../helpers/supabase";

/**
 * Advertising (Google AdSense), driven by ADS_MODE on the server under test:
 * - placeholder (default outside production): labelled empty slots, no request to Google;
 * - test (ADS_MODE=test, with NEXT_PUBLIC_ADSENSE_CLIENT): AdSense code with data-adtest="on".
 * Run the test runner with the same ADS_MODE and NEXT_PUBLIC_ADSENSE_CLIENT as the server.
 * Google's servers are never needed for the assertions.
 */
const CLIENT = process.env.NEXT_PUBLIC_ADSENSE_CLIENT ?? "";
const HAS_CLIENT = /^ca-pub-\d{10,20}$/.test(CLIENT);
const MODE = process.env.ADS_MODE === "test" ? "test" : "placeholder";
test.describe.configure({ mode: "serial" });

const SLOTS = { home: "1111111111", jobs: "2222222222", job: "3333333333", companies: "4444444444", company: "5555555555" };

async function setAds(enabled: boolean) {
  await sql(`update public.platform_settings set value = $1::jsonb where key = 'ads.enabled'`, [JSON.stringify(enabled)]);
  await sql(`update public.platform_settings set value = $1::jsonb where key = 'ads.slots'`, [JSON.stringify(enabled ? SLOTS : {})]);
}

async function login(page: Page, email: string, password: string) {
  await page.goto("/fr/login");
  await page.getByRole("textbox", { name: "Adresse e-mail" }).fill(email);
  await page.locator("input[name=password]").fill(password);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await page.waitForURL((url) => !url.pathname.endsWith("/login"));
}

/** Requests sent to Google's ad servers by the page. */
function googleAdRequests(page: Page): string[] {
  const seen: string[] = [];
  page.on("request", (r) => {
    if (/googlesyndication|doubleclick|adtrafficquality|fundingchoicesmessages/.test(r.url())) seen.push(r.url());
  });
  return seen;
}

test.afterAll(async () => {
  await setAds(false);
});

test("switched off from the back-office settings: no slot, no AdSense script", async ({ page }) => {
  await setAds(false);
  const requests = googleAdRequests(page);
  await page.goto("/fr/jobs");
  await expect(page.locator("aside[data-ad-placement]")).toHaveCount(0);
  await expect(page.locator('script[src*="googlesyndication"]')).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Paramètres des cookies" })).toHaveCount(0);
  expect(requests).toEqual([]);
});

test("switched on: labelled slots on public pages only, never on applications or payments", async ({ page, browser }) => {
  test.skip(MODE === "test" && !HAS_CLIENT, "ADS_MODE=test needs NEXT_PUBLIC_ADSENSE_CLIENT.");
  await setAds(true);
  const requests = googleAdRequests(page);

  // A real advert, to check the job page and the application button with an ad on the page.
  const company = await createCompany({ verified: true });
  const job = await createDraftJob(company, { title: "Poste avec publicité" });
  await activateJob(job.id);

  const pages = [
    ["/fr", "home"],
    ["/fr/jobs", "jobs"],
    ["/fr/companies", "companies"],
    [`/fr/jobs/${job.slug}-${job.public_id}`, "job"],
  ] as const;
  for (const [path, placement] of pages) {
    await page.goto(path);
    const slot = page.locator(`aside[data-ad-placement="${placement}"]`);
    await expect(slot).toBeVisible();
    await expect(slot).toHaveAttribute("data-ad-mode", MODE);
    await expect(slot.getByText("Publicité", { exact: true })).toBeVisible();
    // Space is reserved before the ad loads: no layout shift.
    const box = await slot.locator(".ad-slot-box").boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(280);
    if (MODE === "placeholder") {
      await expect(slot.getByText("Emplacement publicitaire de test")).toBeVisible();
      await expect(slot.locator("ins.adsbygoogle")).toHaveCount(0);
    } else {
      const ins = slot.locator("ins.adsbygoogle");
      await expect(ins).toHaveAttribute("data-ad-client", CLIENT);
      await expect(ins).toHaveAttribute("data-ad-slot", SLOTS[placement]);
      await expect(ins).toHaveAttribute("data-adtest", "on");
    }
  }
  // The application button stays visible and usable on a job page that carries an ad.
  await expect(page.getByRole("link", { name: "Postuler en 1 clic" })).toBeVisible();

  if (MODE === "placeholder") {
    // No ad server is contacted and no consent banner is loaded in placeholder mode.
    expect(requests).toEqual([]);
    await expect(page.locator('script[src*="googlesyndication"]')).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Paramètres des cookies" })).toHaveCount(0);
  } else {
    await expect(page.getByRole("link", { name: "Paramètres des cookies" })).toBeVisible();
  }

  // Never on authentication, legal or private pages.
  for (const path of ["/fr/login", "/fr/signup", "/fr/legal/privacy"]) {
    await page.goto(path);
    await expect(page.locator("aside[data-ad-placement]")).toHaveCount(0);
  }
  const candidate = await createTestUser("candidate", { firstName: "Pub", lastName: "Privee" });
  await login(page, candidate.email, candidate.password);
  for (const path of ["/fr/candidate", "/fr/candidate/applications", "/fr/candidate/settings"]) {
    await page.goto(path);
    await expect(page.locator("aside[data-ad-placement]")).toHaveCount(0);
  }

  // Nor in the recruiter area or on the payment page.
  const recruiter = await createCompany({ verified: true });
  const draft = await createDraftJob(recruiter);
  const submitted = await recruiter.owner.client.rpc("submit_job", { p_job_id: draft.id });
  if (submitted.error) throw submitted.error;
  const context = await browser.newContext({ locale: "fr-FR" });
  const employer = await context.newPage();
  await login(employer, recruiter.owner.email, recruiter.owner.password);
  for (const path of ["/fr/employer", "/fr/employer/jobs", `/fr/employer/checkout/${draft.id}`, "/fr/employer/billing"]) {
    await employer.goto(path);
    await expect(employer.locator("aside[data-ad-placement]")).toHaveCount(0);
  }
  await context.close();
});

test("ads.txt and the content security policy for AdSense", async ({ request }) => {
  test.skip(!HAS_CLIENT, "Build the app with NEXT_PUBLIC_ADSENSE_CLIENT to test ads.txt and the CSP.");
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
