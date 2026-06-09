// Email validation helpers.
//
// Layer 1 (syntax) is handled by Zod `format: email`. This module adds
// Layer 2: MX record check. We resolve the domain's MX records and reject
// only when DNS authoritatively says NXDOMAIN / no MX. On any other DNS
// error (timeout, server failure, transient blip) we ALLOW the email
// through — better to admit a typo than to lock out a legitimate user when
// the DNS recursor is having a bad day.
//
// This catches "gmial.com" / "yhaoo.com" style fat-finger typos because
// those domains have no MX records.
import { promises as dns } from "dns";

export type EmailValidationResult =
  | { ok: true }
  | { ok: false; reason: string };

/** Extracts the domain portion of an email, lowercased. */
function domainOf(email: string): string | null {
  const at = email.lastIndexOf("@");
  if (at < 0 || at === email.length - 1) return null;
  return email.slice(at + 1).toLowerCase();
}

/**
 * Verifies the email's domain has at least one MX record. Allow-through on
 * unexpected DNS errors — see file header.
 */
export async function validateEmailMx(email: string): Promise<EmailValidationResult> {
  const domain = domainOf(email);
  if (!domain) return { ok: false, reason: "Email is missing a domain." };

  try {
    const records = await dns.resolveMx(domain);
    if (!records || records.length === 0) {
      return { ok: false, reason: `No mail servers found for "${domain}". Check for typos.` };
    }
    return { ok: true };
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    // NXDOMAIN / NODATA = authoritative "this domain has no MX". Reject.
    if (code === "ENOTFOUND" || code === "ENODATA") {
      return { ok: false, reason: `No mail servers found for "${domain}". Check for typos.` };
    }
    // Anything else (SERVFAIL, timeout, etc.) → allow through.
    return { ok: true };
  }
}
