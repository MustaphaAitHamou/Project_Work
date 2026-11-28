import { beforeEach, describe, expect, it, vi } from "vitest";

/** Resend delivery: what is sent, errors surfaced, and reserved test addresses never tried. */
vi.mock("server-only", () => ({}));
const send = vi.fn();
vi.mock("resend", () => ({ Resend: class { emails = { send }; } }));
vi.mock("@/lib/env", () => ({ env: () => ({ EMAIL_PROVIDER: "resend", RESEND_API_KEY: "re_test_placeholder", EMAIL_FROM: "Tamurt Jobs <no-reply@tamurtjobs.example>" }) }));

const { getEmailProvider } = await import("@/lib/email/provider");
const { isReservedAddress } = await import("@/lib/email/reserved");

beforeEach(() => send.mockReset());

describe("Resend provider", () => {
  it("sends from the configured address, with text and HTML", async () => {
    send.mockResolvedValueOnce({ data: { id: "msg_1" }, error: null });
    const provider = getEmailProvider()!;
    expect(provider.name).toBe("resend");
    const result = await provider.send({ to: "lina@tamurtjobs.example", subject: "Sujet", html: "<p>Bonjour</p>", text: "Bonjour", replyTo: "support@tamurtjobs.example" });
    expect(result).toEqual({ id: "msg_1" });
    expect(send).toHaveBeenCalledWith({ from: "Tamurt Jobs <no-reply@tamurtjobs.example>", to: ["lina@tamurtjobs.example"], subject: "Sujet", html: "<p>Bonjour</p>", text: "Bonjour", replyTo: "support@tamurtjobs.example" });
  });

  it("a refusal by Resend is an error (the e-mail stays in the outbox and is retried)", async () => {
    send.mockResolvedValueOnce({ data: null, error: { name: "validation_error", message: "domain not verified" } });
    await expect(getEmailProvider()!.send({ to: "lina@tamurtjobs.example", subject: "s", html: "h", text: "t" })).rejects.toThrow("resend: validation_error: domain not verified");
  });

  it("reserved test addresses are recognised (never sent for real)", () => {
    for (const a of ["recette.candidat@example.test", "x@example.com", "y@foo.invalid", "z@localhost", "w@mail.example"]) expect(isReservedAddress(a), a).toBe(true);
    for (const a of ["lina@gmail.com", "rh@tamurtjobs.com", "contact@exemple.fr", "a@test.fr"]) expect(isReservedAddress(a), a).toBe(false);
  });
});
