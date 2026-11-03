/**
 * Domain constants shared by UI, validation and server code. Values mirror the
 * PostgreSQL enums (see supabase/migrations/*_foundation.sql).
 */
import type { Database } from "@/lib/supabase/database.types";

type Enums = Database["public"]["Enums"];

export const MARKETS = ["FR", "DZ", "CA", "US", "CH", "LU", "ES", "GB", "BE"] as const;
export type Market = (typeof MARKETS)[number];

export const CURRENCIES = ["EUR", "USD", "CAD", "DZD", "CHF", "GBP"] as const;
export type Currency = (typeof CURRENCIES)[number];

export const CONTRACT_TYPES = [
  "permanent",
  "fixed_term",
  "temporary",
  "internship",
  "apprenticeship",
  "freelance",
  "seasonal",
] as const satisfies readonly Enums["contract_type"][];
export const WORK_TIMES = ["full_time", "part_time"] as const satisfies readonly Enums["work_time"][];
export const WORK_MODES = ["onsite", "hybrid", "remote"] as const satisfies readonly Enums["work_mode"][];
export const REMOTE_SCOPES = ["employer_country", "listed_countries", "worldwide"] as const satisfies readonly Enums["remote_scope"][];
export const EXPERIENCE_LEVELS = ["entry", "junior", "mid", "senior", "lead", "executive"] as const satisfies readonly Enums["experience_level"][];
export const SALARY_PERIODS = ["hour", "day", "month", "year"] as const satisfies readonly Enums["salary_period"][];
export const WORK_AUTHORIZATIONS = ["not_specified", "required", "sponsorship_available"] as const satisfies readonly Enums["work_authorization"][];
export const REMOTE_PREFERENCES = ["any", "onsite", "hybrid", "remote"] as const satisfies readonly Enums["remote_preference"][];
export const LANGUAGE_LEVELS = ["a1", "a2", "b1", "b2", "c1", "c2", "native"] as const;
export const COMPANY_SIZES = ["1-10", "11-50", "51-200", "201-500", "501-1000", "1000+"] as const;
export const REPORT_REASONS = [
  "discrimination",
  "fraud",
  "scam",
  "misleading",
  "illegal_content",
  "external_redirect",
  "other",
] as const satisfies readonly Enums["report_reason"][];

/** Working languages offered in forms (ISO 639-1). Display names come from Intl.DisplayNames. */
export const WORKING_LANGUAGES = ["fr", "en", "es", "ar", "de", "it", "nl", "pt", "kab", "ber", "zh", "ru", "tr", "pl", "ro"] as const;

export type JobStatus = Enums["job_status"];
export type ApplicationStatus = Enums["application_status"];
export type VerificationStatus = Enums["company_verification_status"];

export const JOB_STATUS_VARIANT: Record<JobStatus, "default" | "secondary" | "success" | "warning" | "destructive" | "muted" | "outline"> = {
  draft: "muted",
  pending_payment: "warning",
  in_review: "warning",
  active: "success",
  suspended: "destructive",
  expired: "muted",
  closed: "secondary",
  rejected: "destructive",
};

export const APPLICATION_STATUS_VARIANT: Record<ApplicationStatus, "default" | "secondary" | "success" | "warning" | "destructive" | "muted" | "outline"> = {
  submitted: "default",
  viewed: "secondary",
  shortlisted: "success",
  rejected: "destructive",
  hired: "success",
  job_closed: "muted",
  withdrawn: "muted",
};

export const VERIFICATION_STATUS_VARIANT: Record<VerificationStatus, "default" | "secondary" | "success" | "warning" | "destructive" | "muted" | "outline"> = {
  pending: "muted",
  auto_check: "secondary",
  manual_review: "warning",
  verified: "success",
  rejected: "destructive",
  suspended: "destructive",
};

/** Statuses a recruiter can set manually (viewed is set automatically on opening). */
export const RECRUITER_SETTABLE_STATUSES = ["shortlisted", "rejected", "hired"] as const;

export const RESUME_MIME_TYPES = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
} as const;

export const VERIFICATION_DOC_MIME_TYPES = {
  "application/pdf": "pdf",
  "image/png": "png",
  "image/jpeg": "jpg",
} as const;

/** Hard upper bound for uploads (Vercel serverless request body limit is 4.5 MB). */
export const UPLOAD_HARD_LIMIT_BYTES = 4 * 1024 * 1024;
