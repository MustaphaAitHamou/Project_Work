import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { createReadyCandidate, serviceClient, sql, uniqueEmail } from "../helpers/supabase";
import { resetRateLimits } from "../helpers/supabase";
import { checkoutSession, event, sign } from "../helpers/stripe-events";
import { signUpAndConfirm } from "./helpers";

test.beforeEach(async () => {
  await resetRateLimits();
});

test.describe("Employer journey", () => {
  test.beforeAll(async () => {
    await sql(`update public.countries set is_paid_publishing_enabled = true, is_registration_open = true where code = 'FR'`);
  });

  test("register a company, get verified, publish a paid advert, review applications, close the advert", async ({ page, request }) => {
    const email = uniqueEmail("e2e.recruteur");
    await signUpAndConfirm(page, { email, firstName: "Sofia", lastName: "Benali", employer: true });
    await expect(page).toHaveURL(/\/fr\/employer\/onboarding/);

    // Invalid SIREN is refused by the country-specific validator (Luhn).
    const siren = "552100554";
    await page.getByLabel("Numéro officiel").fill("552100555");
    await page.getByLabel("Raison sociale").fill(`Atelier E2E ${randomUUID().slice(0, 6)}`);
    await page.getByLabel("Adresse", { exact: true }).fill("10 rue de la République");
    await page.getByLabel("Code postal").fill("69002");
    await page.getByLabel("Ville").fill("Lyon");
    await page.getByLabel("Votre fonction").fill("Gérante");
    await page.getByRole("button", { name: "Enregistrer et vérifier" }).click();
    await expect(page.getByText("Numéro invalide (format ou clé de contrôle).")).toBeVisible();

    // Free unique number for this run: reuse a valid SIREN only once per database.
    await sql(`update public.companies set verification_status = 'rejected' where registration_number = $1 and registration_country = 'FR'`, [siren]);
    await page.getByLabel("Numéro officiel").fill(siren);
    await page.getByRole("button", { name: "Enregistrer et vérifier" }).click();
    await expect(page).toHaveURL(/\/fr\/employer\/verification/);
    // Registries are unreachable from this environment -> manual review, never auto-verified.
    await expect(page.getByText("Vérification manuelle", { exact: true })).toBeVisible();

    // An administrator approves the company (the back-office flow is covered in admin tests).
    const [company] = await sql(`select c.id from public.companies c join public.company_members m on m.company_id = c.id join public.users u on u.id = m.user_id where u.email = $1`, [email]);
    await sql(`update public.companies set verification_status = 'verified', verified_at = now() where id = $1`, [company.id]);

    // Create and submit an advert
    await page.goto("/fr/employer/jobs/new");
    await page.getByLabel("Intitulé du poste").fill("Comptable confirmé·e");
    await page.getByLabel("Description", { exact: true }).fill(
      "Au sein du service financier, vous assurez la tenue de la comptabilité générale et participez aux clôtures mensuelles et annuelles.",
    );
    await page.getByRole("combobox", { name: "Ville" }).fill("Lyon");
    await page.getByRole("button", { name: "Soumettre pour publication" }).click();
    await expect(page).toHaveURL(/\/fr\/employer\/checkout\//);
    await expect(page.getByText("5,95 €")).toBeVisible();
    await expect(page.getByText("Paiement indisponible")).toBeVisible(); // no Stripe key in this environment
    const jobId = page.url().split("/").pop()!;

    // Payment confirmed by Stripe (signed webhook), then the advert is public.
    const prep = await serviceClient.rpc("billing_prepare_checkout", { p_actor: (await sql(`select id from public.users where email = $1`, [email]))[0].id, p_job_id: jobId });
    const sessionId = `cs_test_${randomUUID().replace(/-/g, "")}`;
    await serviceClient.rpc("billing_register_checkout", { p_job_id: jobId, p_plan_id: (prep.data as { plan: { id: string } }).plan.id, p_session_id: sessionId, p_customer_id: "" });
    const payload = JSON.stringify(event("checkout.session.completed", checkoutSession({ sessionId, subscriptionId: `sub_${randomUUID().slice(0, 12)}`, customerId: `cus_${randomUUID().slice(0, 12)}`, jobId })));
    const hook = await request.post("/api/stripe/webhook", { data: payload, headers: { "stripe-signature": sign(payload), "content-type": "application/json" } });
    expect(hook.status()).toBe(200);
    await page.goto(`/fr/employer/checkout/return?session_id=${sessionId}`);
    await expect(page.getByText("Paiement confirmé : annonce publiée")).toBeVisible();

    // A candidate applies
    const [job] = await sql(`select slug, public_id from public.jobs where id = $1`, [jobId]);
    const candidate = await createReadyCandidate();
    const applied = await candidate.client.rpc("apply_to_job", { p_job_id: jobId });
    expect(applied.data).toMatchObject({ result: "created" });

    // Recruiter reviews the application
    await page.goto(`/fr/employer/jobs/${jobId}/applications`);
    await expect(page.getByRole("link", { name: "Amel Durand" })).toBeVisible();
    await expect(page.getByRole("cell", { name: "Envoyée" })).toBeVisible();
    await page.getByRole("link", { name: "Amel Durand" }).click();
    await expect(page.getByRole("heading", { name: "Amel Durand" })).toBeVisible();
    await expect(page.getByText(candidate.email)).toBeVisible();
    const [viewed] = await sql(`select status, first_viewed_at from public.applications where job_id = $1`, [jobId]);
    expect(viewed.status).toBe("viewed");

    // CV download goes through authorisation + short-lived signed URL
    const download = await page.request.get(`/api/resumes/versions/${candidate.versionId}/download`, { maxRedirects: 0 });
    expect(download.status()).toBe(303);
    expect(download.headers()["location"]).toContain("/storage/v1/object/sign/resumes/");

    await page.getByRole("button", { name: "Présélectionner" }).click();
    await expect(page.getByText("Statut mis à jour")).toBeVisible();
    const cand = await candidate.client.from("applications").select("status").eq("job_id", jobId).single();
    expect(cand.data?.status).toBe("shortlisted");

    // Close the advert: no new applications, open applications updated
    await page.goto(`/fr/employer/jobs/${jobId}`);
    await page.getByRole("button", { name: "Clôturer", exact: true }).click();
    await page.getByRole("button", { name: "Clôturer l'annonce" }).click();
    await expect(page.getByText("Annonce clôturée : le renouvellement est arrêté.")).toBeVisible();
    expect((await sql(`select status from public.jobs where id = $1`, [jobId]))[0].status).toBe("closed");
    const late = await (await createReadyCandidate()).client.rpc("apply_to_job", { p_job_id: jobId });
    expect(late.error?.message).toBe("job_not_open");
    await page.goto(`/fr/jobs/${job.slug}-${job.public_id}`);
    await expect(page.getByText("Cette offre n'est plus ouverte")).toBeVisible();
  });

  test("an unverified company cannot publish", async ({ page }) => {
    const email = uniqueEmail("e2e.unverified");
    await signUpAndConfirm(page, { email, firstName: "Paul", lastName: "Leroy", employer: true });
    await page.getByLabel("Pays d'immatriculation").selectOption("BE");
    await page.getByLabel("Numéro officiel").fill("0403.170.701");
    await sql(`update public.companies set verification_status = 'rejected' where registration_number = '0403170701'`);
    await page.getByLabel("Raison sociale").fill("Construction Démo SPRL");
    await page.getByLabel("Adresse", { exact: true }).fill("Rue Neuve 1");
    await page.getByLabel("Ville").fill("Liège");
    await page.getByLabel("Votre fonction").fill("Gérant");
    await page.getByRole("button", { name: "Enregistrer et vérifier" }).click();
    await expect(page).toHaveURL(/\/fr\/employer\/verification/);
    await page.goto("/fr/employer/jobs/new");
    await page.getByLabel("Intitulé du poste").fill("Chef de chantier");
    await page.getByLabel("Description", { exact: true }).fill("Encadrement des équipes sur les chantiers de la région liégeoise, suivi du planning, sécurité et qualité.");
    await page.getByLabel("Pays", { exact: true }).selectOption("BE");
    await page.getByRole("combobox", { name: "Ville" }).fill("Liège");
    await page.getByRole("button", { name: "Soumettre pour publication" }).click();
    await expect(page.getByText("Votre entreprise doit être vérifiée avant de publier.")).toBeVisible();
  });
});
