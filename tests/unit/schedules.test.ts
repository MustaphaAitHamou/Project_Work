import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Scheduled jobs: the Vercel pre-production (Hobby plan) refuses any cron that runs more than
 * once a day, while the production server (Iglao) keeps the real schedule. Both must call the
 * same three routes.
 */
const JOBS = ["/api/cron/maintenance", "/api/cron/emails", "/api/cron/alerts"];

describe("scheduled jobs", () => {
  it("vercel.json (pre-production): each job at most once a day", () => {
    const crons = (JSON.parse(readFileSync("vercel.json", "utf8")) as { crons: { path: string; schedule: string }[] }).crons;
    expect(crons.map((c) => c.path).sort()).toEqual([...JOBS].sort());
    for (const { schedule } of crons) {
      const [minute, hour] = schedule.split(/\s+/);
      // A fixed minute and a fixed hour: one run per day (Vercel Hobby limit).
      expect(minute, schedule).toMatch(/^\d{1,2}$/);
      expect(hour, schedule).toMatch(/^\d{1,2}$/);
    }
  });

  it("Iglao production keeps the hourly maintenance and the 10-minute e-mail retries", () => {
    const cron = readFileSync("deploy/iglao/cron/tamurt-jobs", "utf8");
    expect(cron).toMatch(/^7 \* \* \* \* tamurt \/srv\/tamurt-jobs\/bin\/run-cron\.sh maintenance$/m);
    expect(cron).toMatch(/^\*\/10 \* \* \* \* tamurt \/srv\/tamurt-jobs\/bin\/run-cron\.sh emails$/m);
    expect(cron).toMatch(/^35 5 \* \* \* tamurt \/srv\/tamurt-jobs\/bin\/run-cron\.sh alerts$/m);
  });
});
