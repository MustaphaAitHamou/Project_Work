import "server-only";
import { timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";

/** Scheduled jobs are protected by CRON_SECRET (Vercel Cron sends "Authorization: Bearer <CRON_SECRET>"). */
export function isAuthorizedCron(request: Request): boolean {
  const secret = env().CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
