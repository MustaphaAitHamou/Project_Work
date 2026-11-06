import { z } from "zod";
import {
  COMPANY_SIZES,
  CONTRACT_TYPES,
  CURRENCIES,
  EXPERIENCE_LEVELS,
  REMOTE_SCOPES,
  SALARY_PERIODS,
  WORK_AUTHORIZATIONS,
  WORK_MODES,
  WORK_TIMES,
} from "@/lib/domain";
import { ID_TYPES, SECONDARY_IDS, validateIdentifier, validateSecondary } from "@/lib/companies/identifiers";

const opt = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : null));

const websiteSchema = z
  .string()
  .trim()
  .max(200)
  .optional()
  .transform((v) => (v ? (/^https?:\/\//i.test(v) ? v : `https://${v}`) : null))
  .refine((v) => {
    if (v === null) return true;
    try {
      const u = new URL(v);
      return (u.protocol === "https:" || u.protocol === "http:") && u.hostname.includes(".");
    } catch {
      return false;
    }
  });

/** Company onboarding. Identifier validation is country-specific (checksums where available). */
export const companySchema = z
  .object({
    legalName: z.string().trim().min(2).max(200),
    displayName: opt(200),
    registrationCountry: z.string().regex(/^[A-Z]{2}$/),
    registrationIdType: z.string().refine((v) => v in ID_TYPES),
    registrationNumber: z.string().trim().min(2).max(40),
    registrationRegion: opt(10),
    secondary: z.record(z.string(), z.string().trim().max(40)).default({}),
    hqAddressLine1: z.string().trim().min(2).max(200),
    hqAddressLine2: opt(200),
    hqPostalCode: opt(20),
    hqCity: z.string().trim().min(1).max(120),
    hqRegion: opt(120),
    industry: z.string().regex(/^[a-z_]{2,40}$/),
    website: websiteSchema,
    sizeRange: z.enum(COMPANY_SIZES).optional().nullable(),
    representativeTitle: z.string().trim().min(2).max(120),
    representativePhone: z
      .string()
      .trim()
      .max(25)
      .optional()
      .transform((v) => (v ? v : null))
      .refine((v) => v === null || /^\+?[0-9 ().-]{6,25}$/.test(v)),
    isLegalRepresentative: z.boolean(),
  })
  .transform((d, ctx) => {
    const def = ID_TYPES[d.registrationIdType as keyof typeof ID_TYPES];
    if (def.country !== d.registrationCountry) {
      ctx.addIssue({ code: "custom", path: ["registrationIdType"], message: "id_type_country" });
      return z.NEVER;
    }
    if (def.requiresRegion && !d.registrationRegion) {
      ctx.addIssue({ code: "custom", path: ["registrationRegion"], message: "region_required" });
      return z.NEVER;
    }
    const main = validateIdentifier(d.registrationIdType, d.registrationNumber);
    if (!main.ok) {
      ctx.addIssue({ code: "custom", path: ["registrationNumber"], message: "invalid_identifier" });
      return z.NEVER;
    }
    const secondary: Record<string, string> = {};
    for (const [code, raw] of Object.entries(d.secondary)) {
      if (!raw) continue;
      if (!(def.secondary as string[]).includes(code)) continue;
      const r = validateSecondary(code, raw);
      if (!r.ok) {
        ctx.addIssue({ code: "custom", path: [`secondary.${code}`], message: "invalid_identifier" });
        return z.NEVER;
      }
      secondary[code] = r.normalized;
    }
    return { ...d, registrationNumber: main.normalized, secondary };
  });
export type CompanyInput = z.infer<typeof companySchema>;

export const companyProfileSchema = z.object({
  displayName: opt(200),
  description: opt(5000),
  website: websiteSchema,
  industry: z.string().regex(/^[a-z_]{2,40}$/),
  sizeRange: z.enum(COMPANY_SIZES).optional().nullable(),
});

const money = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? Number(v.replace(",", ".")) : null))
  .refine((v) => v === null || (Number.isFinite(v) && v >= 0 && v < 10_000_000));
const isoDate = z
  .string()
  .optional()
  .transform((v) => (v ? v : null))
  .refine((v) => v === null || /^\d{4}-\d{2}-\d{2}$/.test(v));

export const jobSchema = z
  .object({
    title: z.string().trim().min(3).max(150),
    description: z.string().trim().min(1).max(15000),
    missions: opt(8000),
    profileSought: opt(8000),
    requiredSkills: z.array(z.string().trim().min(1).max(60)).max(30),
    optionalSkills: z.array(z.string().trim().min(1).max(60)).max(30),
    contractType: z.enum(CONTRACT_TYPES),
    workTime: z.enum(WORK_TIMES),
    workMode: z.enum(WORK_MODES),
    remoteScope: z.enum(REMOTE_SCOPES).optional().nullable(),
    remoteCountries: z.array(z.string().regex(/^[A-Z]{2}$/)).max(60),
    salaryMin: money,
    salaryMax: money,
    salaryCurrency: z.enum(CURRENCIES).optional().nullable(),
    salaryPeriod: z.enum(SALARY_PERIODS).optional().nullable(),
    benefits: opt(3000),
    experienceLevel: z.enum(EXPERIENCE_LEVELS),
    industry: z.string().regex(/^[a-z_]{2,40}$/).optional().nullable(),
    workingLanguages: z.array(z.string().regex(/^[a-z]{2,3}$/)).min(1).max(10),
    workAuthorization: z.enum(WORK_AUTHORIZATIONS),
    eligibilityNotes: opt(1000),
    startDate: isoDate,
    applicationDeadline: isoDate,
    positionsCount: z
      .string()
      .optional()
      .transform((v) => (v ? Number(v) : null))
      .refine((v) => v === null || (Number.isInteger(v) && v >= 1 && v <= 999)),
    countryCode: z.string().regex(/^[A-Z]{2}$/),
    regionCode: opt(10),
    city: z.string().trim().min(1).max(120),
    cityId: z
      .string()
      .optional()
      .transform((v) => (v ? Number(v) : null))
      .refine((v) => v === null || (Number.isInteger(v) && v > 0)),
    postalCode: opt(20),
    addressLine: opt(200),
  })
  .superRefine((d, ctx) => {
    if (d.salaryMin !== null && d.salaryMax !== null && d.salaryMax < d.salaryMin) ctx.addIssue({ code: "custom", path: ["salaryMax"], message: "salary_range" });
    if ((d.salaryMin !== null || d.salaryMax !== null) && (!d.salaryCurrency || !d.salaryPeriod)) ctx.addIssue({ code: "custom", path: ["salaryCurrency"], message: "salary_currency" });
    if (d.workMode !== "onsite" && !d.remoteScope) ctx.addIssue({ code: "custom", path: ["remoteScope"], message: "remote_scope" });
    if (d.workMode !== "onsite" && d.remoteScope === "listed_countries" && d.remoteCountries.length === 0) ctx.addIssue({ code: "custom", path: ["remoteCountries"], message: "remote_countries" });
  });
export type JobInput = z.infer<typeof jobSchema>;

export const SECONDARY_CODES = Object.keys(SECONDARY_IDS);
