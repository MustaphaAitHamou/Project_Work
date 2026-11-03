import { describe, expect, it } from "vitest";
import { buildJobPostingJsonLd, jsonLdScript, plainTextToHtml } from "@/lib/seo/job-posting";

const base = {
  public_id: "abcdefghjk",
  title: "Infirmier·ère",
  description: "Rejoignez-nous.\n\n- Soins\n- Suivi",
  missions: null,
  profile_sought: null,
  required_skills: ["Asepsie"],
  contract_type: "permanent",
  work_time: "full_time",
  work_mode: "onsite",
  remote_scope: null,
  remote_countries: [],
  salary_min: 38,
  salary_max: 45,
  salary_currency: "CAD",
  salary_period: "hour",
  published_at: "2026-11-01T10:00:00Z",
  application_deadline: "2026-12-15",
  paid_through: null,
  city: "Montréal",
  postal_code: null,
  address_line: null,
  country_code: "CA",
  company_name: "Clinique",
  company_website: "https://example.org",
  industry: "healthcare",
};
const opts = { url: "https://jobs.example/fr/jobs/x", regionName: "Québec", sectionTitles: { missions: "Missions", profile: "Profil" } };

describe("JobPosting structured data", () => {
  it("maps the advert to schema.org JobPosting with directApply", () => {
    const ld = buildJobPostingJsonLd(base, opts);
    expect(ld).toMatchObject({
      "@type": "JobPosting",
      title: "Infirmier·ère",
      datePosted: "2026-11-01",
      validThrough: "2026-12-15T23:59:59Z",
      employmentType: ["FULL_TIME"],
      directApply: true,
      baseSalary: { currency: "CAD", value: { minValue: 38, maxValue: 45, unitText: "HOUR" } },
      jobLocation: { address: { addressLocality: "Montréal", addressRegion: "Québec", addressCountry: "CA" } },
    });
  });

  it("declares remote work and applicant location requirements", () => {
    const ld = buildJobPostingJsonLd({ ...base, work_mode: "remote", remote_scope: "listed_countries", remote_countries: ["FR", "BE"] }, opts);
    expect(ld.jobLocationType).toBe("TELECOMMUTE");
    expect(ld.applicantLocationRequirements).toEqual([
      { "@type": "Country", name: "FR" },
      { "@type": "Country", name: "BE" },
    ]);
  });

  it("escapes recruiter text and cannot break out of the script tag", () => {
    expect(plainTextToHtml("<img src=x onerror=alert(1)>")).toBe("<p>&lt;img src=x onerror=alert(1)&gt;</p>");
    const script = jsonLdScript({ title: "</script><script>alert(1)</script>" });
    expect(script).not.toContain("</script>");
  });
});
