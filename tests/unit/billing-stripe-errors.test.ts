import { beforeEach, describe, expect, it, vi } from "vitest";

// A Stripe failure (service unreachable, request refused, portal not configured) must
// give the recruiter a message, never an error page, and must not log personal data.
vi.mock("server-only", () => ({}));

const captureMessage = vi.fn();
vi.mock("@sentry/nextjs", () => ({ captureMessage }));

const stripeError = Object.assign(new Error("Invalid email address: jeanne@example.com"), {
  type: "StripeInvalidRequestError",
  code: "parameter_invalid_empty",
  statusCode: 400,
  requestId: "req_test_123",
});
const stripe = {
  checkout: { sessions: { create: vi.fn(), expire: vi.fn() } },
  customers: { create: vi.fn() },
  billingPortal: { sessions: { create: vi.fn() } },
};
vi.mock("@/lib/billing/stripe", () => ({ getStripe: () => stripe, stripeMode: () => "test" }));

const rpc = vi.fn();
const maybeSingle = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ rpc, from: () => ({ select: () => ({ eq: () => ({ maybeSingle }) }) }) }),
}));
vi.mock("@/lib/env", () => ({
  env: () => ({ STRIPE_PRODUCT_NAME: "Annonce Tamurt Jobs", STRIPE_AUTOMATIC_TAX: false }),
  isProductionDeployment: () => false,
  siteUrl: (path: string) => `https://jobs.example.test${path}`,
}));

const { createJobCheckout, createPortalSession } = await import("@/lib/billing/checkout");

const prepared = {
  job: { id: "job-1", title: "Comptable", public_id: "ABC123", country_code: "FR" },
  company: { id: "company-1", name: "Société", registration_country: "FR" },
  plan: { id: "plan-1", currency: "EUR", unit_amount: 595, tax_behavior: "exclusive", stripe_price_id: "price_1" },
  stripe_customer_id: null,
  sessions_to_expire: [],
};

describe("Stripe failures in the recruiter billing flows", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("checkout: Stripe refuses the customer → generic message, error reported without its text", async () => {
    rpc.mockResolvedValueOnce({ data: prepared, error: null });
    stripe.customers.create.mockRejectedValueOnce(stripeError);
    const result = await createJobCheckout({ id: "user-1", email: "jeanne@example.com", name: "Jeanne" }, "job-1", "fr");
    expect(result).toEqual({ ok: false, error: "generic" });
    expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
    expect(captureMessage).toHaveBeenCalledTimes(1);
    const reported = JSON.stringify([captureMessage.mock.calls, vi.mocked(console.error).mock.calls]);
    expect(reported).toContain("parameter_invalid_empty");
    expect(reported).toContain("req_test_123");
    expect(reported).not.toContain("jeanne@example.com");
  });

  it("checkout: Stripe unreachable when creating the session → generic message", async () => {
    rpc.mockResolvedValueOnce({ data: { ...prepared, stripe_customer_id: "cus_1" }, error: null });
    stripe.checkout.sessions.create.mockRejectedValueOnce(Object.assign(new Error("connect ETIMEDOUT"), { type: "StripeConnectionError" }));
    const result = await createJobCheckout({ id: "user-1", email: "jeanne@example.com", name: "Jeanne" }, "job-1", "fr");
    expect(result).toEqual({ ok: false, error: "generic" });
    expect(rpc).toHaveBeenCalledTimes(1); // the checkout is not registered
  });

  it("checkout: success still returns the Stripe URL", async () => {
    rpc.mockResolvedValueOnce({ data: { ...prepared, stripe_customer_id: "cus_1" }, error: null }).mockResolvedValueOnce({ data: null, error: null });
    stripe.checkout.sessions.create.mockResolvedValueOnce({ id: "cs_test_1", url: "https://checkout.stripe.com/c/pay/cs_test_1" });
    const result = await createJobCheckout({ id: "user-1", email: "jeanne@example.com", name: "Jeanne" }, "job-1", "fr");
    expect(result).toEqual({ ok: true, url: "https://checkout.stripe.com/c/pay/cs_test_1" });
    expect(stripe.checkout.sessions.create.mock.calls[0][0]).toMatchObject({ adaptive_pricing: { enabled: false }, subscription_data: { description: "Comptable (ABC123)" } });
  });

  it("portal: no portal configuration in this Stripe mode → generic message instead of an error page", async () => {
    maybeSingle.mockResolvedValueOnce({ data: { stripe_customer_id: "cus_1" } });
    stripe.billingPortal.sessions.create.mockRejectedValueOnce(stripeError);
    expect(await createPortalSession("company-1", "fr")).toEqual({ ok: false, error: "generic" });
    expect(captureMessage).toHaveBeenCalledWith(expect.stringContaining("portal"), expect.objectContaining({ level: "error" }));
  });

  it("portal: success returns the portal URL, back to the billing page in the user's language", async () => {
    maybeSingle.mockResolvedValueOnce({ data: { stripe_customer_id: "cus_1" } });
    stripe.billingPortal.sessions.create.mockResolvedValueOnce({ url: "https://billing.stripe.com/p/session/test_1" });
    expect(await createPortalSession("company-1", "es")).toEqual({ ok: true, url: "https://billing.stripe.com/p/session/test_1" });
    expect(stripe.billingPortal.sessions.create).toHaveBeenCalledWith({ customer: "cus_1", return_url: "https://jobs.example.test/es/employer/billing", locale: "es" });
  });
});
