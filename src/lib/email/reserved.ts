/**
 * Addresses that can never receive e-mail (RFC 2606 / RFC 6761 reserved names: example.com,
 * *.test, *.invalid, *.localhost, *.example). Test and acceptance accounts use them; a real
 * e-mail service must not try them (bounces would hurt the reputation of the sending domain).
 */
const RESERVED = /(^|\.)(example\.(com|net|org)|test|invalid|localhost|example)$/i;

export function isReservedAddress(email: string): boolean {
  const domain = email.split("@").pop()?.trim() ?? "";
  return domain === "" || RESERVED.test(domain);
}
