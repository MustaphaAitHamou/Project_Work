import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { activateJob, createCompany, createDraftJob, createReadyCandidate, createTestUser, grantAdminRole, resetRateLimits, type TestUser } from "../helpers/supabase";

/**
 * Automated accessibility checks (axe-core, WCAG 2.0/2.1/2.2 levels A and AA).
 * Automated tools catch a subset of issues only; they complement manual audits.
 */
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

async function expectAccessible(page: Page, label: string) {
  await page.waitForLoadState("networkidle");
  // @axe-core/playwright types `page` against its own playwright-core copy; the runtime object is the same.
  const options = { page } as unknown as ConstructorParameters<typeof AxeBuilder>[0];
  const { violations } = await new AxeBuilder(options).withTags(TAGS).analyze();
  const summary = violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(" ")).slice(0, 5).join(" | ")}`);
  expect(summary, `${label}\n${summary.join("\n")}`).toEqual([]);
}

async function login(page: Page, user: TestUser) {
  await page.goto("/fr/login");
  await page.getByRole("textbox", { name: "Adresse e-mail" }).fill(user.email);
  await page.locator("input[name=password]").fill(user.password);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await page.waitForURL((url) => !url.pathname.endsWith("/login"));
}

let jobPath = "";

test.beforeAll(async () => {
  await resetRateLimits();
  const company = await createCompany();
  const job = await createDraftJob(company, { title: "Technicienne de maintenance" });
  await activateJob(job.id);
  jobPath = `/jobs/${job.slug}-${job.public_id}`;
});

test.beforeEach(async () => {
  await resetRateLimits();
});

const PUBLIC_PAGES = ["", "/jobs", "/jobs?q=maintenance", "/companies", "/recruiters", "/cv", "/about", "/how-ranking-works", "/login", "/signup", "/signup/employer", "/legal/privacy"];

for (const locale of ["fr", "ar"] as const) {
  test(`public pages have no detectable WCAG A/AA violation (${locale})`, async ({ page }) => {
    for (const path of [...PUBLIC_PAGES, "JOB"]) {
      await page.goto(`/${locale}${path === "JOB" ? jobPath : path}`);
      await expectAccessible(page, `${locale}${path}`);
    }
  });
}

test("Arabic pages are rendered right-to-left", async ({ page }) => {
  await page.goto("/ar");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.locator("html")).toHaveAttribute("lang", "ar");
  await page.goto("/fr");
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
});

test("dark theme keeps sufficient contrast", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  for (const path of ["/fr", "/fr/jobs", `/fr${jobPath}`, "/fr/recruiters", "/fr/login"]) {
    await page.goto(path);
    await expect(page.locator("html")).toHaveClass(/dark/);
    await expectAccessible(page, `dark ${path}`);
  }
});

test("skip link moves keyboard focus to the main content", async ({ page }) => {
  await page.goto("/fr");
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Aller au contenu principal" });
  await expect(skip).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#main$/);
});

test("candidate, employer and back-office pages have no detectable violation", async ({ page }) => {
  const candidate = await createReadyCandidate();
  await login(page, candidate);
  for (const path of ["/fr/candidate", "/fr/candidate/profile", "/fr/candidate/resumes", "/fr/candidate/applications", "/fr/candidate/alerts", "/fr/candidate/privacy", `/fr${jobPath}`]) {
    await page.goto(path);
    await expectAccessible(page, path);
  }

  await page.context().clearCookies();
  const company = await createCompany();
  await login(page, company.owner);
  for (const path of ["/fr/employer", "/fr/employer/jobs", "/fr/employer/jobs/new", "/fr/employer/company", "/fr/employer/verification", "/fr/employer/billing"]) {
    await page.goto(path);
    await expectAccessible(page, path);
  }

  await page.context().clearCookies();
  const admin: TestUser = await createTestUser("candidate", { firstName: "Ada", lastName: "Admin" });
  await grantAdminRole(admin.id, "super_admin");
  await login(page, admin);
  for (const path of ["/fr/admin", "/fr/admin/companies", "/fr/admin/jobs", "/fr/admin/countries/FR", "/fr/admin/pricing", "/fr/admin/settings"]) {
    await page.goto(path);
    await expectAccessible(page, path);
  }
});
