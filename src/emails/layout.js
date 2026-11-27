import { brand } from "../config/brand.js";
import { escapeHtml } from "../utils/html.js";

/* One branded layout for every outgoing email: table-based, inline styles and
   600px wide, which is what Gmail, Outlook and Apple Mail all render alike.

   Content model
     preheader  inbox preview line (hidden in the body)
     eyebrow    small red label above the title
     title      main heading
     intro      paragraphs (strings; blank lines in a string split paragraphs)
     sections   [{ heading, rows: [{ label, value | chips, href }] }]
     actions    [{ label, href, variant: "primary" | "secondary" }]
     note       small grey box under the content
     meta       [[label, value]] small print (e.g. submitted at, page)          */

const c = brand.colors;
const FONT = "'Inter','Segoe UI',Roboto,Helvetica,Arial,sans-serif";

const paragraphs = (text) =>
  String(text)
    .split(/\n{2,}/)
    .map(
      (p) =>
        `<p style="margin:0 0 14px;font-family:${FONT};font-size:15px;line-height:24px;color:${c.inkSoft};">${escapeHtml(p).replace(/\n/g, "<br>")}</p>`
    )
    .join("");

function header() {
  const mark = brand.logoUrl
    ? `<img src="${escapeHtml(brand.logoUrl)}" width="160" alt="${brand.name}" style="display:block;border:0;max-width:160px;height:auto;">`
    : `<span style="font-family:${FONT};font-size:24px;font-weight:800;letter-spacing:-0.5px;color:${c.white};">VD <span style="color:${c.ink};background:${c.white};padding:2px 8px;border-radius:6px;">Infotech</span></span>`;
  return `
  <tr>
    <td style="background:${c.red};background-image:linear-gradient(135deg,${c.red} 0%,${c.redDark} 100%);padding:26px 32px;border-radius:14px 14px 0 0;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td align="left"><a href="${brand.site}" style="text-decoration:none;">${mark}</a></td>
          <td align="right" style="font-family:${FONT};font-size:12px;color:${c.white};opacity:0.9;">Marketing · Technology · AI</td>
        </tr>
      </table>
    </td>
  </tr>`;
}

function valueCell(row) {
  if (row.chips?.length) {
    return row.chips
      .map(
        (chip) =>
          `<span style="display:inline-block;margin:0 6px 6px 0;padding:4px 12px;border-radius:999px;background:${c.redTint};color:${c.redDark};font-size:13px;font-weight:600;line-height:20px;">${escapeHtml(chip)}</span>`
      )
      .join("");
  }
  const text = escapeHtml(row.value).replace(/\n/g, "<br>");
  return row.href
    ? `<a href="${escapeHtml(row.href)}" style="color:${c.red};text-decoration:none;font-weight:600;">${text}</a>`
    : text;
}

function section({ heading, rows }) {
  if (!rows?.length) return "";
  const body = rows
    .map(
      (row, i) => `
        <tr>
          <td valign="top" width="34%" style="padding:12px 16px;background:${i % 2 ? c.white : c.offWhite};border-top:1px solid ${c.rule};font-family:${FONT};font-size:13px;font-weight:700;color:${c.grey};text-transform:uppercase;letter-spacing:0.4px;">${escapeHtml(row.label)}</td>
          <td valign="top" style="padding:12px 16px;background:${i % 2 ? c.white : c.offWhite};border-top:1px solid ${c.rule};font-family:${FONT};font-size:15px;line-height:22px;color:${c.ink};word-break:break-word;">${valueCell(row)}</td>
        </tr>`
    )
    .join("");
  return `
    <tr><td style="padding:22px 0 8px;font-family:${FONT};font-size:14px;font-weight:800;color:${c.ink};">
      <span style="display:inline-block;width:4px;height:14px;background:${c.red};border-radius:2px;margin-right:8px;vertical-align:-1px;"></span>${escapeHtml(heading)}
    </td></tr>
    <tr><td>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid ${c.rule};border-top:0;border-radius:10px;overflow:hidden;border-collapse:separate;">${body}</table>
    </td></tr>`;
}

function actionsRow(actions) {
  if (!actions?.length) return "";
  const buttons = actions
    .map(({ label, href, variant = "primary" }) => {
      const primary = variant === "primary";
      return `<a href="${escapeHtml(href)}" style="display:inline-block;margin:0 8px 10px 0;padding:12px 24px;border-radius:999px;font-family:${FONT};font-size:14px;font-weight:700;text-decoration:none;${
        primary ? `background:${c.red};color:${c.white};border:2px solid ${c.red};` : `background:${c.white};color:${c.ink};border:2px solid ${c.ink};`
      }">${escapeHtml(label)}</a>`;
    })
    .join("");
  return `<tr><td style="padding:26px 0 4px;">${buttons}</td></tr>`;
}

function footer() {
  return `
  <tr>
    <td style="background:${c.ink};padding:26px 32px;border-radius:0 0 14px 14px;font-family:${FONT};font-size:13px;line-height:21px;color:#BDBDBD;">
      <p style="margin:0 0 6px;font-size:15px;font-weight:700;color:${c.white};">${brand.name}</p>
      <p style="margin:0 0 10px;">${escapeHtml(brand.address)}</p>
      <p style="margin:0;">
        <a href="tel:${brand.phoneHref}" style="color:${c.white};text-decoration:none;">${escapeHtml(brand.phone)}</a>
        &nbsp;·&nbsp;
        <a href="mailto:${brand.email}" style="color:${c.white};text-decoration:none;">${brand.email}</a>
        &nbsp;·&nbsp;
        <a href="${brand.site}" style="color:${c.white};text-decoration:none;">${brand.site.replace(/^https?:\/\//, "")}</a>
      </p>
      <p style="margin:10px 0 0;color:#8A8A8A;">${escapeHtml(brand.hours)}</p>
    </td>
  </tr>`;
}

export function renderHtml({ preheader = "", eyebrow, title, intro, sections = [], actions = [], note, meta = [] }) {
  const metaHtml = meta.length
    ? `<tr><td style="padding:22px 0 0;font-family:${FONT};font-size:12px;line-height:19px;color:${c.grey};">${meta
        .map(([label, value]) => `<strong style="color:${c.inkSoft};">${escapeHtml(label)}:</strong> ${escapeHtml(value)}`)
        .join("<br>")}</td></tr>`
    : "";
  const noteHtml = note
    ? `<tr><td style="padding:22px 0 0;"><div style="padding:14px 18px;border-left:4px solid ${c.red};background:${c.offWhite};border-radius:0 8px 8px 0;font-family:${FONT};font-size:14px;line-height:22px;color:${c.inkSoft};">${escapeHtml(note).replace(/\n/g, "<br>")}</div></td></tr>`
    : "";

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only">
<title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background:${c.canvas};-webkit-text-size-adjust:100%;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${c.canvas};">
    <tr>
      <td align="center" style="padding:28px 12px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;">
          ${header()}
          <tr>
            <td style="background:${c.white};padding:32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                ${eyebrow ? `<tr><td style="padding-bottom:10px;"><span style="display:inline-block;padding:4px 12px;border-radius:999px;background:${c.redTint};color:${c.red};font-family:${FONT};font-size:12px;font-weight:700;letter-spacing:0.6px;text-transform:uppercase;">${escapeHtml(eyebrow)}</span></td></tr>` : ""}
                <tr><td style="padding-bottom:14px;font-family:${FONT};font-size:24px;line-height:32px;font-weight:800;color:${c.ink};">${escapeHtml(title)}</td></tr>
                ${intro ? `<tr><td>${[intro].flat().map(paragraphs).join("")}</td></tr>` : ""}
                ${sections.map(section).join("")}
                ${noteHtml}
                ${actionsRow(actions)}
                ${metaHtml}
              </table>
            </td>
          </tr>
          ${footer()}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/** The plain-text alternative of the same content. */
export function renderText({ title, intro, sections = [], actions = [], note, meta = [] }) {
  const lines = [title.toUpperCase(), ""];
  for (const p of [intro].flat().filter(Boolean)) lines.push(p, "");
  for (const { heading, rows } of sections) {
    if (!rows?.length) continue;
    lines.push(`— ${heading} —`);
    for (const row of rows) lines.push(`${row.label}: ${row.chips?.length ? row.chips.join(", ") : row.value}`);
    lines.push("");
  }
  if (note) lines.push(note, "");
  for (const { label, href } of actions) lines.push(`${label}: ${href}`);
  if (actions.length) lines.push("");
  for (const [label, value] of meta) lines.push(`${label}: ${value}`);
  lines.push("", "--", brand.name, brand.address, `${brand.phone} · ${brand.email} · ${brand.site}`);
  return lines.join("\n");
}

export const renderEmail = (content) => ({ html: renderHtml(content), text: renderText(content) });
