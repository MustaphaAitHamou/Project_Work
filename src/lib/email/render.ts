/**
 * Transactional e-mail rendering. Pure functions (unit-tested): every dynamic
 * value is HTML-escaped; administrator overrides use {{placeholders}}.
 */
export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Replaces {{key}} placeholders. Unknown placeholders are removed. Values are escaped when `html` is true. */
export function interpolate(template: string, vars: Record<string, unknown>, html: boolean): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) => {
    const v = vars[key];
    if (v === undefined || v === null) return "";
    return html ? escapeHtml(v) : String(v);
  });
}

/** Plain text (paragraphs separated by blank lines) to minimal safe HTML. */
export function textToHtml(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 14px 0;">${escapeHtml(p.trim()).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

export interface EmailContent {
  locale: string;
  subject: string;
  /** Paragraphs of plain text (already interpolated, not escaped). */
  paragraphs: string[];
  /** Optional list (e.g. jobs in an alert digest). */
  items?: Array<{ title: string; subtitle?: string; url?: string }>;
  cta?: { label: string; url: string };
  footer: string;
}

export function renderEmail(c: EmailContent): RenderedEmail {
  const dir = c.locale === "ar" ? "rtl" : "ltr";
  const align = dir === "rtl" ? "right" : "left";
  const paragraphs = c.paragraphs.map((p) => `<p style="margin:0 0 14px 0;">${escapeHtml(p).replace(/\n/g, "<br>")}</p>`).join("");
  const items = c.items?.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 18px 0;">${c.items
        .map(
          (i) =>
            `<tr><td style="padding:10px 0;border-bottom:1px solid #e2e8f0;text-align:${align};">${
              i.url ? `<a href="${escapeHtml(i.url)}" style="color:#0f766e;font-weight:bold;text-decoration:none;">${escapeHtml(i.title)}</a>` : `<strong>${escapeHtml(i.title)}</strong>`
            }${i.subtitle ? `<br><span style="color:#64748b;font-size:13px;">${escapeHtml(i.subtitle)}</span>` : ""}</td></tr>`,
        )
        .join("")}</table>`
    : "";
  const cta = c.cta
    ? `<p style="margin:22px 0;"><a href="${escapeHtml(c.cta.url)}" style="background:#0f766e;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;display:inline-block;font-weight:bold;">${escapeHtml(c.cta.label)}</a></p>`
    : "";
  const html = `<!doctype html><html lang="${escapeHtml(c.locale)}" dir="${dir}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(c.subject)}</title></head>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;padding:24px 0;"><tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:12px;padding:32px;text-align:${align};" dir="${dir}">
<tr><td style="font-size:20px;font-weight:bold;color:#0f766e;padding-bottom:16px;">Tamurt Jobs</td></tr>
<tr><td style="font-size:15px;line-height:1.6;">${paragraphs}${items}${cta}</td></tr>
<tr><td style="font-size:12px;color:#64748b;padding-top:20px;border-top:1px solid #e2e8f0;">${escapeHtml(c.footer)}</td></tr>
</table></td></tr></table></body></html>`;
  const text = [
    ...c.paragraphs,
    ...(c.items ?? []).map((i) => `- ${i.title}${i.subtitle ? ` (${i.subtitle})` : ""}${i.url ? `\n  ${i.url}` : ""}`),
    c.cta ? `${c.cta.label}: ${c.cta.url}` : "",
    "--",
    c.footer,
  ]
    .filter(Boolean)
    .join("\n\n");
  return { subject: c.subject, html, text };
}
