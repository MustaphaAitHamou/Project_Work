import { promises as dns } from "node:dns";

type Resolver = Pick<typeof dns, "resolveMx" | "resolve4" | "resolve6">;

const NOT_FOUND = new Set(["ENOTFOUND", "ENODATA", "NXDOMAIN"]);
/** Reserved for documentation and testing (RFC 2606 / RFC 6761). */
const TEST_TLDS = new Set(["test", "example", "localhost"]);

export type DomainCheck = "ok" | "no_mail_domain";

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([p, new Promise<T>((_, reject) => setTimeout(() => reject(Object.assign(new Error("timeout"), { code: "ETIMEOUT" })), ms))]);
}

/**
 * Checks that the domain of an e-mail address exists and can receive mail: MX records,
 * or an A/AAAA record (implicit MX, RFC 5321). A "null MX" (RFC 7505) means no mail.
 * Only a definitive "does not exist" answer rejects the address: DNS timeouts or server
 * failures let it through, so an infrastructure problem never blocks real users. The
 * confirmation e-mail remains the actual proof that the mailbox exists.
 */
export async function checkEmailDomain(email: string, opts: { allowTestDomains: boolean; resolver?: Resolver; timeoutMs?: number }): Promise<DomainCheck> {
  const domain = email.split("@").pop()?.trim().toLowerCase().replace(/\.$/, "") ?? "";
  const tld = domain.split(".").pop() ?? "";
  if (!domain.includes(".") || tld === "invalid") return "no_mail_domain";
  if (opts.allowTestDomains && TEST_TLDS.has(tld)) return "ok";
  const resolver = opts.resolver ?? dns;
  const timeout = opts.timeoutMs ?? 3000;

  const attempt = async <T>(fn: () => Promise<T>): Promise<{ found: T } | "absent" | "unknown"> => {
    try {
      return { found: await withTimeout(fn(), timeout) };
    } catch (e) {
      return NOT_FOUND.has((e as { code?: string }).code ?? "") ? "absent" : "unknown";
    }
  };

  const mx = await attempt(() => resolver.resolveMx(domain));
  if (mx === "unknown") return "ok";
  if (mx !== "absent" && mx.found.length > 0) {
    const nullMx = mx.found.every((r) => r.exchange === "" || r.exchange === ".");
    return nullMx ? "no_mail_domain" : "ok";
  }
  for (const lookup of [() => resolver.resolve4(domain), () => resolver.resolve6(domain)]) {
    const r = await attempt(lookup);
    if (r === "unknown") return "ok";
    if (r !== "absent" && r.found.length > 0) return "ok";
  }
  return "no_mail_domain";
}
