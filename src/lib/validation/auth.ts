import { z } from "zod";

export const TERMS_VERSION = "2026-11-01";

/** Mirrors Supabase Auth settings: minimum 10 characters, lower case, upper case and digit. */
export const passwordSchema = z
  .string()
  .min(10)
  .max(128)
  .refine((v) => /[a-z]/.test(v) && /[A-Z]/.test(v) && /[0-9]/.test(v));
