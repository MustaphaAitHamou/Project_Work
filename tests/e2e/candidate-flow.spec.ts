import path from "node:path";
import { expect, test } from "@playwright/test";
import { activateJob, createCompany, createDraftJob, sql, uniqueEmail, type TestCompany } from "../helpers/supabase";
import { resetRateLimits } from "../helpers/supabase";
import { emailSubjects, signUpAndConfirm } from "./helpers";

const fixture = (name: string) => path.join(__dirname, "../fixtures", name);

test.beforeEach(async () => {
  await resetRateLimits();
});

test.describe("Candidate journey", () => {
  let jobPath = "";
  let jobId = "";
  let company: TestCompany;

  test.beforeAll(async () => {
    await sql(`update public.countries set is_paid_publishing_enabled = true where code in ('FR','BE')`);
    company = await createCompany();
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
    await expect(page.getByText("CV importé", { exact: true })).toBeVisible();

    // Next step: check the anonymous version that recruiters will read, then approve it
    await expect(page).toHaveURL(/\/fr\/candidate\/resumes\/[0-9a-f-]+\/anonymized/);
    await expect(page.getByRole("heading", { name: "Version anonyme de votre CV" })).toBeVisible();
    await expect(page.getByLabel("Texte montré aux recruteurs")).toHaveValue("Curriculum vitae - Test Candidate");
    await page.getByLabel("Texte montré aux recruteurs").fill("Curriculum vitae\nYasmine Haddad — assistante administrative, yasmine@example.com");
    await page.getByRole("button", { name: "Valider cette version" }).click();
    await expect(page.getByText("Des données personnelles ont encore été détectées et masquées.")).toBeVisible();
    await expect(page.getByLabel("Texte montré aux recruteurs")).toHaveValue("Curriculum vitae\n[nom masqué] — assistante administrative, [e-mail masqué]");
    await page.getByRole("button", { name: "Valider cette version" }).click();
    await expect(page.getByText("Version anonyme validée : elle sera montrée aux recruteurs pendant la présélection.")).toBeVisible();
    await page.goto("/fr/candidate/resumes");
    await expect(page.getByText("CV principal", { exact: true })).toBeVisible();
    await expect(page.getByText("Version anonyme validée")).toBeVisible();

    // One click (first time: data transmission notice)
    await page.goto(jobPath);
    await page.getByRole("button", { name: "Postuler en 1 clic" }).click();
    const consent = page.getByRole("dialog", { name: "Informations transmises au recruteur" });
    await expect(consent).toBeVisible();
    await expect(consent.getByText("Communiqué uniquement si vous acceptez une demande du recruteur")).toBeVisible();
    await expect(consent.getByText("Votre CV original (version du jour)")).toBeVisible();
    await expect(consent.getByText("La version anonyme de votre CV, si vous l'avez validée")).toBeVisible();
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
    const [{ public_alias: alias }] = await sql(`select public_alias from public.applications where id = $1`, [app.id]);
    await expect(page.getByText(`Le recruteur voit cette candidature sous l'alias #${alias}`)).toBeVisible();

    // The recruiter asks for the identity: the candidate decides, and can change their mind
    expect((await company.owner.client.rpc("recruiter_request_identity", { p_application_id: app.id })).data).toBe("requested");
    // The request was made outside the app: let the scheduled e-mail job send it.
    expect((await page.request.get("/api/cron/emails", { headers: { authorization: `Bearer ${process.env.CRON_SECRET ?? ""}` } })).status()).toBe(200);
    await expect.poll(async () => (await emailSubjects(email)).some((s) => s.includes("souhaite connaître votre identité")), { timeout: 20_000 }).toBe(true);
    await page.reload();
    const request = page.getByRole("group", { name: /souhaite connaître votre identité/ });
    await expect(request).toBeVisible();
    await request.getByRole("button", { name: "Accepter" }).click();
    await expect(page.getByText("Votre identité est maintenant visible par ce recruteur.")).toBeVisible();
    await expect(page.getByText("Identité partagée", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Retirer l'accès" }).click();
    await page.getByRole("dialog", { name: "Retirer l'accès à votre identité ?" }).getByRole("button", { name: "Retirer l'accès" }).click();
    await expect(page.getByText("Le recruteur n'a plus accès à votre identité.")).toBeVisible();
    await expect(page.getByText("Anonyme", { exact: true })).toBeVisible();
  });

  test("a visitor is asked to log in before applying", async ({ page }) => {
    await page.goto(jobPath);
    await page.getByRole("link", { name: "Postuler en 1 clic" }).click();
    await expect(page).toHaveURL(/\/fr\/login\?next=/);
  });
});
