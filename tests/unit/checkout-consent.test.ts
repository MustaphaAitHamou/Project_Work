import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Conversion d'une annonce gratuite (offre de lancement) : le premier prélèvement, à la fin de
 * la gratuité, exige une autorisation explicite vérifiée côté serveur, en plus des conditions.
 */
vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw Object.assign(new Error("NEXT_REDIRECT"), { to });
  },
}));
vi.mock("next-intl/server", () => ({ getTranslations: async () => (key: string) => key }));
vi.mock("@/lib/auth/session", () => ({
  getSessionUser: async () => ({ id: "u1", email: "rh@example.test", firstName: "Rita", lastName: "Hamid", accountType: "employer", status: "active" }),
}));
vi.mock("@/lib/employer/queries", () => ({ getMyCompany: async () => ({ company: { id: "c1" } }) }));
type JobState = { status: string; free_until: string | null; suspension_reason: string | null };
const job: { current: JobState } = { current: { status: "active", free_until: new Date(Date.now() + 10 * 86400_000).toISOString(), suspension_reason: null } };
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: job.current }) }) }) }) }),
}));
const createJobCheckout = vi.fn(async (..._args: unknown[]) => ({ ok: true as const, url: "https://checkout.stripe.com/c/pay/cs_test_1" }));
vi.mock("@/lib/billing/checkout", () => ({ createJobCheckout: (...args: unknown[]) => createJobCheckout(...args), createPortalSession: vi.fn() }));

const { startCheckoutAction } = await import("@/app/[locale]/employer/billing-actions");
const initial = { ok: false, message: null } as never;
const JOB_ID = "6f9a3c1e-2b7d-4e8f-9a1b-3c5d7e9f1a2b";

function form(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries({ locale: "fr", jobId: JOB_ID, acceptTerms: "on", ...fields })) fd.set(k, v);
  return fd;
}
async function run(fd: FormData) {
  try {
    return await startCheckoutAction(initial, fd);
  } catch (e) {
    return { redirectedTo: (e as { to?: string }).to };
  }
}

beforeEach(() => vi.clearAllMocks());

describe("checkout of an advert online for free (launch offer)", () => {
  it("refuses without the explicit authorisation of the first charge, and never reaches Stripe", async () => {
    expect(await run(form({}))).toMatchObject({ ok: false, message: "convertConsentRequired" });
    expect(createJobCheckout).not.toHaveBeenCalled();
  });

  it("with the authorisation: Stripe Checkout, consent passed along", async () => {
    expect(await run(form({ acceptCharge: "on" }))).toEqual({ redirectedTo: "https://checkout.stripe.com/c/pay/cs_test_1" });
    expect(createJobCheckout.mock.calls[0][3]).toEqual({ chargeConsented: true });
  });

  it("a normal payment (awaiting payment, or reactivation after the offer) only needs the terms", async () => {
    job.current = { status: "pending_payment", free_until: null, suspension_reason: null };
    expect(await run(form({}))).toEqual({ redirectedTo: "https://checkout.stripe.com/c/pay/cs_test_1" });
    job.current = { status: "suspended", free_until: null, suspension_reason: "free_period_ended" };
    expect(await run(form({}))).toEqual({ redirectedTo: "https://checkout.stripe.com/c/pay/cs_test_1" });
    expect(await run(form({ acceptTerms: "" }))).toMatchObject({ ok: false, message: "acceptTermsRequired" });
  });
});
