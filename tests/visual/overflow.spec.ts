import { expect, test, type Page } from "@playwright/test";
import { createCompany, createDraftJob, createReadyCandidate, createTestUser, grantAdminRole, resetRateLimits, sql } from "../helpers/supabase";

/**
 * No page may scroll sideways, from 320 px to desktop width: the body never overflows and no
 * element sticks out of the viewport (tables and code scroll inside their own frame).
 *   E2E_BASE_URL=http://localhost:3000 npx playwright test -c playwright.visual.config.ts overflow
 */
const WIDTHS = [320, 360, 390, 414, 768, 1024, 1440];

async function login(page: Page, email: string, password: string) {
  await page.goto("/fr/login");
  await page.getByRole("textbox", { name: "Adresse e-mail" }).fill(email);
  await page.locator("input[name=password]").fill(password);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await page.waitForURL((url) => !url.pathname.endsWith("/login"));
}

/** Elements wider than the viewport, outside scrollable frames. */
async function overflowing(page: Page) {
  return page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const out: string[] = [];
    if (document.documentElement.scrollWidth > vw + 1) out.push(`document ${document.documentElement.scrollWidth}px > ${vw}px`);
    for (const el of Array.from(document.body.querySelectorAll<HTMLElement>("*"))) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.right <= vw + 1) continue;
      let p: HTMLElement | null = el.parentElement;
      let clipped = false;
      while (p && p !== document.body) {
        const s = getComputedStyle(p);
        if (/(auto|scroll|hidden|clip)/.test(s.overflowX)) {
          clipped = true;
          break;
        }
        p = p.parentElement;
      }
      if (!clipped && getComputedStyle(el).position !== "fixed") out.push(`${el.tagName.toLowerCase()}.${(el.className?.toString() ?? "").split(" ").slice(0, 3).join(".")} right=${Math.round(r.right)}`);
      if (out.length > 5) break;
    }
    return out;
  });
}

test.setTimeout(600_000);

test("no horizontal overflow on public pages, in four languages", async ({ browser }) => {
  const [job] = await sql<{ slug: string; public_id: string }>(`select slug, public_id from public.public_jobs where is_open order by published_at desc limit 1`);
  const paths = ["/fr", "/en", "/es", "/ar", "/fr/jobs", ...(job ? [`/fr/jobs/${job.slug}-${job.public_id}`] : []), "/fr/recruiters", "/fr/companies", "/fr/login", "/fr/signup/employer", "/fr/legal/terms", "/fr/cv"];
  const problems: string[] = [];
  for (const width of WIDTHS) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, locale: "fr-FR" });
    const page = await context.newPage();
    for (const path of paths) {
      await page.goto(path);
      for (const p of await overflowing(page)) problems.push(`${width}px ${path}: ${p}`);
    }
    await context.close();
  }
  expect(problems).toEqual([]);
});

test("no horizontal overflow in the candidate, recruiter and back-office spaces", async ({ browser }) => {
  const company = await createCompany({ verified: true });
  const draft = await createDraftJob(company, { title: "Responsable des opérations logistiques et de la chaîne d'approvisionnement" });
  await company.owner.client.rpc("submit_job", { p_job_id: draft.id });
  const candidate = await createReadyCandidate();
  const admin = await createTestUser("candidate", { firstName: "Ada", lastName: "Admin" });
  await grantAdminRole(admin.id, "super_admin");
  const spaces = [
    { user: company.owner, paths: ["/fr/employer", "/fr/employer/jobs", `/fr/employer/jobs/${draft.id}`, `/fr/employer/checkout/${draft.id}`, "/fr/employer/billing", "/fr/employer/company"] },
    { user: candidate, paths: ["/fr/candidate", "/fr/candidate/profile", "/fr/candidate/applications", "/fr/candidate/settings"] },
    { user: admin, paths: ["/fr/admin", "/fr/admin/jobs?status=active", "/fr/admin/companies", "/fr/admin/users", "/fr/admin/settings", "/fr/admin/emails"] },
  ];
  const problems: string[] = [];
  for (const width of [320, 390, 768, 1440]) {
    for (const space of spaces) {
      await resetRateLimits(); // many sign-ins from the same address in a few minutes
      const context = await browser.newContext({ viewport: { width, height: 900 }, locale: "fr-FR" });
      const page = await context.newPage();
      await login(page, space.user.email, space.user.password);
      for (const path of space.paths) {
        await page.goto(path);
        for (const p of await overflowing(page)) problems.push(`${width}px ${path}: ${p}`);
      }
      await context.close();
    }
  }
  expect(problems).toEqual([]);
});
