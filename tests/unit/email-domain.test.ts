import { describe, expect, it } from "vitest";
import { checkEmailDomain } from "@/lib/security/email-domain";

const err = (code: string) => Object.assign(new Error(code), { code });
function resolver(map: { mx?: unknown; a?: unknown; aaaa?: unknown }) {
  const run = (v: unknown) => (v instanceof Error ? Promise.reject(v) : Promise.resolve(v ?? []));
  return {
    resolveMx: () => run(map.mx ?? err("ENODATA")),
    resolve4: () => run(map.a ?? err("ENODATA")),
    resolve6: () => run(map.aaaa ?? err("ENODATA")),
  } as never;
}
const check = (email: string, r: never, allowTestDomains = false) => checkEmailDomain(email, { allowTestDomains, resolver: r, timeoutMs: 200 });

describe("checkEmailDomain", () => {
  it("accepts a domain with MX records", async () => {
    expect(await check("a@gmail.com", resolver({ mx: [{ exchange: "gmail-smtp-in.l.google.com", priority: 5 }] }))).toBe("ok");
  });
  it("rejects a domain that does not exist", async () => {
    expect(await check("erzfgujeifgu@gergfe.fr", resolver({ mx: err("ENOTFOUND"), a: err("ENOTFOUND"), aaaa: err("ENOTFOUND") }))).toBe("no_mail_domain");
  });
  it("accepts a domain without MX but with an address record (implicit MX)", async () => {
    expect(await check("a@small.example.org", resolver({ mx: err("ENODATA"), a: ["203.0.113.5"] }))).toBe("ok");
  });
  it("rejects a domain that declares it accepts no mail (null MX)", async () => {
    expect(await check("a@nomail.example.org", resolver({ mx: [{ exchange: ".", priority: 0 }] }))).toBe("no_mail_domain");
  });
  it("lets the address through when DNS itself fails (never blocks real users)", async () => {
    expect(await check("a@company.fr", resolver({ mx: err("ESERVFAIL") }))).toBe("ok");
    expect(await check("a@company.fr", resolver({ mx: err("ETIMEOUT") }))).toBe("ok");
  });
  it("rejects malformed and reserved-invalid domains without a lookup", async () => {
    expect(await check("a@localhost", resolver({}))).toBe("no_mail_domain");
    expect(await check("a@nothing.invalid", resolver({}))).toBe("no_mail_domain");
  });
  it("accepts reserved test domains only outside production", async () => {
    const absent = resolver({ mx: err("ENOTFOUND"), a: err("ENOTFOUND"), aaaa: err("ENOTFOUND") });
    expect(await check("a@example.test", absent, true)).toBe("ok");
    expect(await check("a@example.test", absent, false)).toBe("no_mail_domain");
  });
});
