import { afterAll, beforeAll } from "vitest";
import { SUPABASE_URL, closeDb, sql } from "../helpers/supabase";

process.env.TZ = "UTC";

beforeAll(async () => {
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/health`);
    if (!res.ok) throw new Error(`status ${res.status}`);
    await sql("select 1");
  } catch (error) {
    throw new Error(
      `Local Supabase is not reachable (${String(error)}). Start it with "npm run supabase:start" before running integration tests.`,
    );
  }
  // Integration tests exercise paid publishing in FR/BE like the local seed does.
  await sql(`update public.countries set is_paid_publishing_enabled = true where code in ('FR', 'BE')`);
});

afterAll(async () => {
  await closeDb();
});
