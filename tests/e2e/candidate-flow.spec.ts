import path from "node:path";
import { expect, test } from "@playwright/test";
import { activateJob, createCompany, createDraftJob, sql, uniqueEmail } from "../helpers/supabase";
import { resetRateLimits } from "../helpers/supabase";
import { emailSubjects, signUpAndConfirm } from "./helpers";

const fixture = (name: string) => path.join(__dirname, "../fixtures", name);

test.beforeEach(async () => {
  await resetRateLimits();
});

test.describe("Candidate journey", () => {
  let jobPath = "";
  let jobId = "";

  test.beforeAll(async () => {
    await sql(`update public.countries set is_paid_publishing_enabled = true where code in ('FR','BE')`);
    const company = await createCompany();
    const job = await createDraftJob(company, { title: "Assistant·e administratif·ve E2E" });
    await activateJob(job.id);
    jobId = job.id;
    jobPath = `/fr/jobs/${job.slug}-${job.public_id}`;
  });

  test("sign up, complete the profile, upload a CV and apply in one click", async ({ page }) => {
    const email = uniqueEmail("e2e.candidate");
    await signUpAndConfirm(page, { email, firstName: "Yasmine", lastName: "Haddad" });
    await expect(page).toHaveURL(/\/fr\/candidate/);
    await expect(page.getByRole("heading", { name: /Bonjour Yasmine/ })).toBeVisible();

    // Applying with an incomplete profile explains what is missing (no silent failure)
    await page.goto(jobPath);
    await page.getByRole("button", { name: "Postuler en 1 clic" }).click();
    await expect(page.getByRole("dialog", { name: "Encore une étape avant le 1 clic" })).toBeVisible();
    await expect(page.getByText("un CV principal (PDF ou DOCX)")).toBeVisible();
    await page.keyboard.press("Escape");

    // Profile
    await page.goto("/fr/candidate/profile");
    await page.getByLabel("Métier recherché").fill("Assistante administrative");
    await page.getByLabel("Pays de résidence").selectOption("FR");
    await page.getByLabel("Ville").fill("Lyon");
    const skills = page.getByLabel("Compétences");
    await skills.fill("Bureautique, Accueil");
    await skills.press("Enter");
    await page.getByRole("button", { name: "Enregistrer le profil" }).click();
    await expect(page.getByText("Profil enregistré").first()).toBeVisible();

    // CV: malicious files are refused, a valid PDF is accepted
    await page.goto("/fr/candidate/resumes");
    await page.getByLabel("Importer un CV").setInputFiles(fixture("cv-javascript.pdf"));
    await expect(page.getByText(/contenu actif/)).toBeVisible();
    await page.getByLabel("Importer un CV").setInputFiles(fixture("fake-pdf.pdf"));
    await expect(page.getByText(/Format non accepté/)).toBeVisible();
    await page.getByLabel("Importer un CV").setInputFiles(fixture("cv-valid.pdf"));
    await expect(page.getByText("CV importé")).toBeVisible();
    await expect(page.getByText("CV principal", { exact: true })).toBeVisible();

    // One click (first time: data transmission notice)
    await page.goto(jobPath);
    await page.getByRole("button", { name: "Postuler en 1 clic" }).click();
    const consent = page.getByRole("dialog", { name: "Informations transmises au recruteur" });
    await expect(consent).toBeVisible();
    await expect(consent.getByText("Votre CV principal (version du jour)")).toBeVisible();
    await consent.getByRole("button", { name: "J'ai compris, postuler" }).click();
    await expect(page.getByText("Candidature envoyée", { exact: true })).toBeVisible();

    // Reloading shows the applied state (no duplicate possible)
    await page.reload();
    await expect(page.getByText("Candidature envoyée", { exact: true })).toBeVisible();
    const rows = await sql(`select count(*)::int as n from public.applications a join public.users u on u.id = a.candidate_id where u.email = $1`, [email]);
    expect(rows[0].n).toBe(1);

    // Dashboard and confirmation e-mail
    await page.goto("/fr/candidate/applications");
    await expect(page.getByText("Assistant·e administratif·ve E2E")).toBeVisible();
    await expect(page.getByText("Envoyée", { exact: true })).toBeVisible();
    await expect.poll(async () => (await emailSubjects(email)).some((s) => s.includes("Candidature envoyée")), { timeout: 20_000 }).toBe(true);

    // The recruiter opens the application -> candidate sees "Consultée"
    const [app] = await sql(`select a.id from public.applications a where a.job_id = $1 order by created_at desc limit 1`, [jobId]);
    await sql(`update public.applications set status = 'viewed', first_viewed_at = now() where id = $1`, [app.id]);
    await page.reload();
    await expect(page.getByText("Consultée", { exact: true })).toBeVisible();
  });

  test("a visitor is asked to log in before applying", async ({ page }) => {
    await page.goto(jobPath);
    await page.getByRole("link", { name: "Postuler en 1 clic" }).click();
    await expect(page).toHaveURL(/\/fr\/login\?next=/);
  });
});
