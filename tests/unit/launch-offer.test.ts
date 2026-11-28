import { describe, expect, it } from "vitest";
import { conversionTrialEnd, offerFirstPaidDay, offerLastDay, STRIPE_MIN_TRIAL_MS } from "@/lib/billing/offer";
import { checkoutMode } from "@/lib/billing/checkout-mode";
import { buildEmail } from "@/lib/email/templates";

/**
 * Offre de lancement : fin exclue au 1er janvier 2027 00:00, heure de Paris
 * (= 31 décembre 2026 23:00 UTC). Horloge simulée : chaque test passe son propre `now`.
 */
const END = "2027-01-01T00:00:00+01:00";
const HOUR = 3600_000;

describe("launch offer dates (Europe/Paris)", () => {
  it("last free day and first paid day, in every locale, whatever the server time zone", () => {
    expect(offerLastDay(END, "fr")).toBe("31 décembre 2026");
    expect(offerFirstPaidDay(END, "fr")).toBe("1er janvier 2027");
    expect(offerLastDay(END, "en")).toBe("31 December 2026");
    expect(offerFirstPaidDay(END, "en")).toBe("1 January 2027");
    expect(offerLastDay(END, "es")).toBe("31 de diciembre de 2026");
    expect(offerFirstPaidDay(END, "es")).toBe("1 de enero de 2027");
    expect(offerFirstPaidDay(END, "ar")).toContain("2027");
    // The same instant written in UTC gives the same Paris days.
    expect(offerLastDay("2026-12-31T23:00:00Z", "fr")).toBe("31 décembre 2026");
  });

  it("« 1er » only for the first day of a month", () => {
    expect(offerFirstPaidDay("2027-03-10T00:00:00+01:00", "fr")).toBe("10 mars 2027");
    expect(offerFirstPaidDay("2027-03-11T00:00:00+01:00", "fr")).toBe("11 mars 2027");
    expect(offerFirstPaidDay("2027-04-01T00:00:00+02:00", "fr")).toBe("1er avril 2027");
  });
});

describe("conversion during the offer: trial ending with the free period", () => {
  it("31/12 before midnight, 23:59:59 and 01/01 00:00 (Paris)", () => {
    const end = new Date(END);
    // A month before: the trial ends exactly at the end of the offer.
    expect(conversionTrialEnd(END, new Date("2026-12-01T10:00:00+01:00"))).toEqual(end);
    // 31/12 22:00 Paris: less than 48 h left, Stripe's minimum (+1 h) is used — later, never earlier.
    const late = new Date("2026-12-31T22:00:00+01:00");
    const t = conversionTrialEnd(END, late)!;
    expect(t.getTime()).toBe(late.getTime() + STRIPE_MIN_TRIAL_MS + HOUR);
    expect(t.getTime()).toBeGreaterThan(end.getTime());
    // 31/12 23:59:59 Paris: still free, so still a trial.
    expect(conversionTrialEnd(END, new Date("2026-12-31T23:59:59+01:00"))).not.toBeNull();
    // 01/01/2027 00:00 Paris: the offer is over, a normal subscription (charged at once).
    expect(conversionTrialEnd(END, new Date("2027-01-01T00:00:00+01:00"))).toBeNull();
    expect(conversionTrialEnd(END, new Date("2027-01-15T12:00:00+01:00"))).toBeNull();
  });

  it("what the checkout does depends on the advert state", () => {
    const now = new Date("2026-12-15T12:00:00+01:00");
    expect(checkoutMode({ status: "pending_payment", free_until: null, suspension_reason: null }, now)).toBe("publish");
    expect(checkoutMode({ status: "active", free_until: END, suspension_reason: null }, now)).toBe("convert");
    // Free period over, the maintenance has not recorded it yet.
    expect(checkoutMode({ status: "active", free_until: END, suspension_reason: null }, new Date("2027-01-01T00:00:00+01:00"))).toBe("reactivate");
    expect(checkoutMode({ status: "suspended", free_until: null, suspension_reason: "free_period_ended" }, now)).toBe("reactivate");
    // Nothing to pay: paid advert, other suspension reasons, closed.
    expect(checkoutMode({ status: "active", free_until: null, suspension_reason: null }, now)).toBeNull();
    expect(checkoutMode({ status: "suspended", free_until: null, suspension_reason: "payment_failed" }, now)).toBeNull();
    expect(checkoutMode({ status: "closed", free_until: null, suspension_reason: null }, now)).toBeNull();
  });
});

describe("launch offer e-mails", () => {
  it("reminder and pause e-mails: dates in Paris time, no charge implied", () => {
    const reminder = buildEmail("free_period_ending", "fr", { free_until: "2026-12-31T23:00:00+00:00", days_left: 7 }, { siteUrl: "https://jobs.example", firstName: "Lina" });
    expect(reminder.subject).toBe("Offre de lancement : gratuité jusqu'au 31 décembre 2026");
    expect(reminder.text).toContain("dans 7 jours");
    expect(reminder.text).toContain("aucun prélèvement avant le 1er janvier 2027");
    expect(reminder.text).toContain("https://jobs.example/fr/employer/jobs");

    const paused = buildEmail("free_period_ended", "en", { job_title: "Accountant", job_id: "00000000-0000-4000-8000-000000000001" }, { siteUrl: "https://jobs.example" });
    expect(paused.subject).toBe("Job ad paused: Accountant");
    expect(paused.text).toContain("Nothing is charged without your subscription.");
    expect(paused.text).toContain("https://jobs.example/en/employer/jobs/00000000-0000-4000-8000-000000000001");
  });
});
