import type { Fetcher } from "./types";

export class RegistryHttpError extends Error {
  constructor(
    public readonly kind: "timeout" | "network" | "service_down" | "rate_limited" | "not_found" | "bad_response",
    message: string,
  ) {
    super(message);
  }
}

/** JSON GET with timeout; maps transport failures to typed errors. */
export async function getJson<T>(fetcher: Fetcher, url: string, init: RequestInit & { timeoutMs: number }): Promise<T> {
  let res: Response;
  try {
    res = await fetcher(url, { ...init, signal: AbortSignal.timeout(init.timeoutMs), headers: { Accept: "application/json", "User-Agent": "TamurtJobs-CompanyVerification/1.0", ...(init.headers ?? {}) } });
  } catch (e) {
    const name = (e as Error)?.name;
    throw new RegistryHttpError(name === "TimeoutError" || name === "AbortError" ? "timeout" : "network", String(e));
  }
  if (res.status === 404) throw new RegistryHttpError("not_found", "404");
  if (res.status === 429) throw new RegistryHttpError("rate_limited", "429");
  if (res.status >= 500) throw new RegistryHttpError("service_down", String(res.status));
  if (!res.ok) throw new RegistryHttpError("bad_response", String(res.status));
  try {
    return (await res.json()) as T;
  } catch {
    throw new RegistryHttpError("bad_response", "invalid json");
  }
}
