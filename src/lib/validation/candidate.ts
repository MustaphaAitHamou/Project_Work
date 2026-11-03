import { z } from "zod";
import { CONTRACT_TYPES, LANGUAGE_LEVELS, MARKETS, REMOTE_PREFERENCES, WORK_TIMES } from "@/lib/domain";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : null));

export const skillsSchema = z
  .array(z.string().trim().min(1).max(60))
  .max(50)
  .transform((arr) => [...new Map(arr.map((s) => [s.toLocaleLowerCase(), s])).values()]);

export const languageEntrySchema = z.object({
  code: z.string().regex(/^[a-z]{2,3}$/),
  level: z.enum(LANGUAGE_LEVELS),
});

export const profileSchema = z.object({
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  headline: z.string().trim().min(2).max(150),
  summary: optionalText(3000),
  countryCode: z.string().regex(/^[A-Z]{2}$/),
  regionCode: optionalText(10),
  city: z.string().trim().min(1).max(120),
  phone: z
    .string()
    .trim()
    .max(25)
    .optional()
    .transform((v) => (v ? v : null))
    .refine((v) => v === null || /^\+?[0-9 ().-]{6,25}$/.test(v)),
  skills: skillsSchema,
  languages: z.array(languageEntrySchema).max(15),
  desiredContractTypes: z.array(z.enum(CONTRACT_TYPES)).max(CONTRACT_TYPES.length),
  desiredWorkTime: z.array(z.enum(WORK_TIMES)).max(2),
  remotePreference: z.enum(REMOTE_PREFERENCES),
  willingToRelocate: z.boolean(),
  mobilityCountries: z.array(z.string().regex(/^[A-Z]{2}$/)).max(20),
  yearsOfExperience: z.coerce.number().int().min(0).max(60).nullable(),
});
export type ProfileInput = z.infer<typeof profileSchema>;

const monthDate = z
  .string()
  .regex(/^\d{4}-\d{2}(-\d{2})?$/)
  .transform((v) => (v.length === 7 ? `${v}-01` : v));

export const experienceSchema = z
  .object({
    id: z.uuid().optional(),
    title: z.string().trim().min(1).max(150),
    companyName: optionalText(150),
    location: optionalText(150),
    startDate: monthDate,
    endDate: monthDate.optional().or(z.literal("").transform(() => undefined)),
    isCurrent: z.boolean(),
    description: optionalText(2000),
  })
  .refine((e) => e.isCurrent || !e.endDate || e.endDate >= e.startDate, { path: ["endDate"] });

export const educationSchema = z
  .object({
    id: z.uuid().optional(),
    degree: z.string().trim().min(1).max(150),
    school: optionalText(150),
    fieldOfStudy: optionalText(150),
    startDate: monthDate.optional().or(z.literal("").transform(() => undefined)),
    endDate: monthDate.optional().or(z.literal("").transform(() => undefined)),
    description: optionalText(1500),
  })
  .refine((e) => !e.startDate || !e.endDate || e.endDate >= e.startDate, { path: ["endDate"] });

export const notificationSettingsSchema = z.object({
  locale: z.enum(["fr", "en", "es", "ar"]),
  notifyApplicationUpdates: z.boolean(),
  notifyJobAlerts: z.boolean(),
  notifyBilling: z.boolean(),
});

export const MARKET_CODES = MARKETS;
