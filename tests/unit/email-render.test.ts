import { describe, expect, it } from "vitest";
import { buildEmail, describeNotification, EMAIL_TEMPLATES } from "@/lib/email/templates";
import { escapeHtml, interpolate } from "@/lib/email/render";

describe("transactional e-mails", () => {
  it("escapes HTML in variables", () => {
    expect(escapeHtml(`<b>"x"&'y'</b>`)).toBe("&lt;b&gt;&quot;x&quot;&amp;&#39;y&#39;&lt;/b&gt;");
    expect(interpolate("Bonjour {{name}} {{unknown}}", { name: "<script>" }, true)).toBe("Bonjour &lt;script&gt; ");
  });

  it("renders every template in every locale without missing translations", () => {
    const payload = { job_title: "Dev <React>", company_name: "ACME", status: "shortlisted", outcome: "verified", decision: "approve", jobs: [{ title: "A", company: "B", city: "C", path: "/jobs/a-23456789ab" }], alert_name: "React", type: "export", grace_days: 3 };
    for (const locale of ["fr", "en", "es", "ar"]) {
      for (const tpl of EMAIL_TEMPLATES) {
        const email = buildEmail(tpl, locale, payload, { siteUrl: "https://jobs.example", firstName: "Lina" });
        expect(email.subject.length).toBeGreaterThan(3);
        expect(email.html).not.toContain("<React>");
        expect(email.subject).not.toMatch(/emails\./);
        expect(email.text).toContain("Lina");
      }
    }
  });

  it("every e-mail also reads as an in-app notification: title, and a link inside the site in the same language", () => {
    const payload = { job_title: "Conseiller clientèle", job_id: "0b6f3c1e-2d4a-4f5b-9c8d-7e6f5a4b3c2d", company_name: "ACME", status: "shortlisted", outcome: "verified", decision: "approve", jobs: [], alert_name: "React", type: "export", grace_days: 3, free_until: "2027-01-01T00:00:00+01:00" };
    for (const locale of ["fr", "en", "es", "ar"]) {
      for (const tpl of EMAIL_TEMPLATES) {
        const view = describeNotification(tpl, locale, payload);
        expect(view, `${tpl} (${locale})`).not.toBeNull();
        expect(view!.title.length).toBeGreaterThan(3);
        expect(view!.title).not.toMatch(/emails\.|\{/);
        if (view!.href) {
          expect(view!.href.startsWith(`/${locale}/`), `${tpl} (${locale}) : ${view!.href}`).toBe(true);
          expect(view!.action?.length).toBeGreaterThan(1);
        }
      }
    }
    // Unknown types are ignored rather than shown half-translated.
    expect(describeNotification("unknown_type", "fr", {})).toBeNull();
    expect(describeNotification("free_period_ended", "fr", payload)).toEqual({
      title: "Annonce en pause : Conseiller clientèle",
      href: "/fr/employer/jobs/0b6f3c1e-2d4a-4f5b-9c8d-7e6f5a4b3c2d",
      action: "Réactiver l'annonce",
    });
  });

  it("uses administrator overrides with escaped placeholders", () => {
    const email = buildEmail("job_published", "fr", { job_title: "<i>Dev</i>" }, {
      siteUrl: "https://jobs.example",
      firstName: "Lina",
      override: { subject: "Annonce {{job_title}} en ligne", body: "Paragraphe 1 {{job_title}}\n\nParagraphe 2" },
    });
    expect(email.subject).toBe("Annonce <i>Dev</i> en ligne");
    expect(email.html).toContain("Paragraphe 1 &lt;i&gt;Dev&lt;/i&gt;");
    expect(email.html).not.toContain("<i>Dev</i>");
  });

  it("sets the text direction for Arabic", () => {
    expect(buildEmail("job_expired", "ar", { job_title: "x" }, { siteUrl: "https://jobs.example" }).html).toContain('dir="rtl"');
  });
});
