import { describe, expect, it } from "vitest";
import { totp } from "../helpers/totp";

// RFC 6238 appendix B, SHA-1 secret "12345678901234567890" (base32 below), truncated to 6 digits.
const RFC_SECRET = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";

describe("test TOTP generator", () => {
  it("matches the RFC 6238 reference values", () => {
    expect(totp(RFC_SECRET, 59_000)).toBe("287082");
    expect(totp(RFC_SECRET, 1_111_111_109_000)).toBe("081804");
    expect(totp(RFC_SECRET, 1_234_567_890_000)).toBe("005924");
  });
});
