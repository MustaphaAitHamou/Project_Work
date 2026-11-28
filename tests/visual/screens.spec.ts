import { mkdirSync } from "node:fs";
import path from "node:path";
import { test, type Page } from "@playwright/test";
import { createCompany, createDraftJob, createReadyCandidate, createTestUser, grantAdminRole, sql } from "../helpers/supabase";

/**
 * Captures d'écran de référence (comparaison visuelle avant / après une refonte).
 * Pas un test de non-régression automatique : les images sont relues à l'œil.
 *   VISUAL_LABEL=avant E2E_BASE_URL=http://localhost:3000 npx playwright test -c playwright.visual.config.ts
 * Images : visual-captures/<label>/<page>-<desktop|mobile>[-dark].png (non versionnées ; hors de test-results/, que Playwright vide à chaque lancement).
 */
const LABEL = process.env.VISUAL_LABEL ?? "capture";
const OUT = path.join("visual-captures", LABEL);
mkdirSync(OUT, { recursive: true });

const VIEWPORTS = [
  { name: "desktop", viewport: { width: 1440, height: 900 }, isMobile: false },
  { name: "mobile", viewport: { width: 390, height: 844 }, isMobile: true },
] as const;

async function login(page: Page, email: string, password: string) {
  await page.goto("/fr/login");
  await page.getByRole("textbox", { name: "Adresse e-mail" }).fill(email);
  await page.locator("input[name=password]").fill(password);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await page.waitForURL((url) => !url.pathname.endsWith("/login"));
}

async function shoot(page: Page, name: string) {
  await page.waitForLoadState("networkidle").catch(() => undefined);
  // Animations figées pour des images comparables.
  await page.addStyleTag({ content: "*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}" });
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: true });
}

test.describe.configure({ mode: "serial" });
test.setTimeout(600_000);

test("public pages", async ({ browser }) => {
  const [job] = await sql<{ slug: string; public_id: string }>(`select slug, public_id from public.public_jobs where is_open order by published_at desc limit 1`);
  const [company] = await sql<{ slug: string }>(`select slug from public.public_companies where active_jobs_count > 0 order by active_jobs_count desc limit 1`);
  const pages: [string, string][] = [
    ["home", "/fr"],
    ["home-ar", "/ar"],
    ["jobs", "/fr/jobs"],
    ...(job ? ([["job", `/fr/jobs/${job.slug}-${job.public_id}`]] as [string, string][]) : []),
    ["recruiters", "/fr/recruiters"],
    ["companies", "/fr/companies"],
    ...(company ? ([["company", `/fr/companies/${company.slug}`]] as [string, string][]) : []),
    ["login", "/fr/login"],
    ["signup-employer", "/fr/signup/employer"],
    ["forgot-password", "/fr/forgot-password"],
    ["check-email", "/fr/check-email?reason=signup"],
    ["not-found", "/fr/page-inexistante"],
  ];
  for (const vp of VIEWPORTS) {
    for (const scheme of ["light", "dark"] as const) {
      const context = await browser.newContext({ locale: "fr-FR", viewport: vp.viewport, isMobile: vp.isMobile, hasTouch: vp.isMobile, deviceScaleFactor: 2, colorScheme: scheme });
      const page = await context.newPage();
      for (const [name, url] of pages) {
        if (scheme === "dark" && !["home", "jobs", "job", "login"].includes(name)) continue;
        await page.goto(url);
        await shoot(page, `${name}-${vp.name}${scheme === "dark" ? "-dark" : ""}`);
      }
      await context.close();
    }
  }
});

test("private spaces", async ({ browser }) => {
  const company = await createCompany({ verified: true });
  const draft = await createDraftJob(company, { title: "Chargé·e de clientèle (aperçu visuel)" });
  await company.owner.client.rpc("submit_job", { p_job_id: draft.id });
  const candidate = await createReadyCandidate();
  await candidate.client.rpc("apply_to_job", { p_job_id: draft.id });
  const admin = await createTestUser("candidate", { firstName: "Ada", lastName: "Admin" });
  await grantAdminRole(admin.id, "super_admin");

  const spaces: { user: { email: string; password: string }; pages: [string, string][] }[] = [
    {
      user: company.owner,
      pages: [
        ["employer", "/fr/employer"],
        ["employer-jobs", "/fr/employer/jobs"],
        ["employer-job", `/fr/employer/jobs/${draft.id}`],
        ["employer-applications", `/fr/employer/jobs/${draft.id}/applications`],
        ["employer-checkout", `/fr/employer/checkout/${draft.id}`],
        ["employer-billing", "/fr/employer/billing"],
      ],
    },
    { user: candidate, pages: [["candidate", "/fr/candidate"], ["candidate-profile", "/fr/candidate/profile"], ["candidate-applications", "/fr/candidate/applications"]] },
    { user: admin, pages: [["admin", "/fr/admin"], ["admin-jobs", "/fr/admin/jobs?status=active"], ["admin-settings", "/fr/admin/settings"]] },
  ];
  for (const vp of VIEWPORTS) {
    for (const space of spaces) {
      const context = await browser.newContext({ locale: "fr-FR", viewport: vp.viewport, isMobile: vp.isMobile, hasTouch: vp.isMobile, deviceScaleFactor: 2 });
      const page = await context.newPage();
      await login(page, space.user.email, space.user.password);
      for (const [name, url] of space.pages) {
        await page.goto(url);
        await shoot(page, `${name}-${vp.name}`);
      }
      await context.close();
    }
  }
});
