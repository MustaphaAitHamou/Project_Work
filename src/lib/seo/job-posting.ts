/**
 * schema.org JobPosting structured data (Google for Jobs guidelines). Only built
 * for open adverts; closed/expired pages carry no JobPosting markup.
 */
import { escapeHtml } from "@/lib/email/render";

export interface JobPostingInput {
  public_id: string;
  title: string;
  description: string;
  missions: string | null;
  profile_sought: string | null;
  required_skills: string[] | null;
  contract_type: string;
  work_time: string;
  work_mode: string;
  remote_scope: string | null;
  remote_countries: string[] | null;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string | null;
  salary_period: string | null;
  published_at: string | null;
  application_deadline: string | null;
  paid_through: string | null;
  city: string | null;
  postal_code: string | null;
  address_line: string | null;
  country_code: string | null;
  company_name: string | null;
  company_website: string | null;
  industry: string | null;
}

const EMPLOYMENT_TYPE: Record<string, string> = {
  permanent: "FULL_TIME",
  fixed_term: "TEMPORARY",
  temporary: "TEMPORARY",
  internship: "INTERN",
  apprenticeship: "INTERN",
  freelance: "CONTRACTOR",
  seasonal: "TEMPORARY",
};
const UNIT: Record<string, string> = { hour: "HOUR", day: "DAY", month: "MONTH", year: "YEAR" };

/** Plain text (blank-line paragraphs, "- " bullets) to the limited HTML allowed in JobPosting.description. */
export function plainTextToHtml(text: string): string {
  const blocks = text.replace(/\r\n/g, "\n").split(/\n{2,}/);
  return blocks
    .map((block) => {
      const lines = block.split("\n").filter((l) => l.trim() !== "");
      if (lines.length > 0 && lines.every((l) => /^\s*[-•*]\s+/.test(l))) {
        return `<ul>${lines.map((l) => `<li>${escapeHtml(l.replace(/^\s*[-•*]\s+/, ""))}</li>`).join("")}</ul>`;
      }
      return `<p>${lines.map((l) => escapeHtml(l)).join("<br>")}</p>`;
    })
    .join("");
}

export function buildJobPostingJsonLd(job: JobPostingInput, opts: { url: string; regionName?: string | null; logoUrl?: string | null; sectionTitles: { missions: string; profile: string } }) {
  const types = new Set<string>([EMPLOYMENT_TYPE[job.contract_type] ?? "OTHER"]);
  if (job.work_time === "part_time") {
    types.delete("FULL_TIME");
    types.add("PART_TIME");
  }
  const descriptionParts = [plainTextToHtml(job.description)];
  if (job.missions) descriptionParts.push(`<h3>${escapeHtml(opts.sectionTitles.missions)}</h3>${plainTextToHtml(job.missions)}`);
  if (job.profile_sought) descriptionParts.push(`<h3>${escapeHtml(opts.sectionTitles.profile)}</h3>${plainTextToHtml(job.profile_sought)}`);

  const validThrough = job.application_deadline ? `${job.application_deadline}T23:59:59Z` : (job.paid_through ?? undefined);
  const data: Record<string, unknown> = {
    "@context": "https://schema.org/",
    "@type": "JobPosting",
    title: job.title,
    description: descriptionParts.join(""),
    identifier: { "@type": "PropertyValue", name: job.company_name ?? "Tamurt Jobs", value: job.public_id },
    datePosted: job.published_at ? job.published_at.slice(0, 10) : undefined,
    validThrough,
    employmentType: [...types],
    hiringOrganization: {
      "@type": "Organization",
      name: job.company_name,
      ...(job.company_website ? { sameAs: job.company_website } : {}),
      ...(opts.logoUrl ? { logo: opts.logoUrl } : {}),
    },
    directApply: true,
    url: opts.url,
  };
  if (job.city && job.country_code) {
    data.jobLocation = {
      "@type": "Place",
      address: {
        "@type": "PostalAddress",
        ...(job.address_line ? { streetAddress: job.address_line } : {}),
        addressLocality: job.city,
        ...(opts.regionName ? { addressRegion: opts.regionName } : {}),
        ...(job.postal_code ? { postalCode: job.postal_code } : {}),
        addressCountry: job.country_code,
      },
    };
  }
  if (job.work_mode === "remote") {
    data.jobLocationType = "TELECOMMUTE";
    const countries =
      job.remote_scope === "listed_countries" ? (job.remote_countries ?? []) : job.remote_scope === "employer_country" && job.country_code ? [job.country_code] : [];
    if (countries.length) data.applicantLocationRequirements = countries.map((c) => ({ "@type": "Country", name: c }));
  }
  if (job.salary_currency && job.salary_period && (job.salary_min !== null || job.salary_max !== null)) {
    data.baseSalary = {
      "@type": "MonetaryAmount",
      currency: job.salary_currency,
      value: {
        "@type": "QuantitativeValue",
        ...(job.salary_min !== null ? { minValue: Number(job.salary_min) } : {}),
        ...(job.salary_max !== null ? { maxValue: Number(job.salary_max) } : {}),
        ...(job.salary_min !== null && job.salary_max === null ? { value: Number(job.salary_min) } : {}),
        unitText: UNIT[job.salary_period],
      },
    };
  }
  if (job.required_skills?.length) data.skills = job.required_skills.join(", ");
  return JSON.parse(JSON.stringify(data)) as Record<string, unknown>;
}

/** Serialises JSON-LD safely for an inline <script> (prevents "</script>" injection). */
export function jsonLdScript(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");
}
