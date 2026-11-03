import { describe, expect, it } from "vitest";
import { buildEmail, EMAIL_TEMPLATES } from "@/lib/email/templates";
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
