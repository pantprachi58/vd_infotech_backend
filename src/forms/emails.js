import { brand } from "../config/brand.js";
import { renderEmail } from "../emails/layout.js";

/* Turns a validated submission into the team notification and the visitor's
   confirmation, both in the shared branded layout. */

const IST = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  dateStyle: "full",
  timeStyle: "short",
});

const formatSize = (bytes) =>
  bytes < 1048576 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1048576).toFixed(1)} MB`;

/** One table row for a field, or null when the visitor left it empty. */
function row(field, value) {
  switch (field.type) {
    case "list":
      return value?.length ? { label: field.label, chips: value } : null;
    case "boolean":
      return value ? { label: field.label, value: field.key === "newsletter" ? "Yes, please subscribe" : "Yes" } : null;
    case "file":
      return value ? { label: field.label, value: `${value.filename} (${formatSize(value.size)}) — click to open`, href: value.url } : null;
    case "email":
      return value ? { label: field.label, value, href: `mailto:${value}` } : null;
    case "phone":
      return value ? { label: field.label, value, href: `tel:${value.replace(/[^\d+]/g, "")}` } : null;
    case "url":
      return value ? { label: field.label, value, href: value } : null;
    default:
      return value ? { label: field.label, value } : null;
  }
}

/** Rows grouped under their section headings, in field order. */
function sections(fields, data, { forVisitor = false } = {}) {
  const groups = new Map();
  for (const field of fields) {
    if (forVisitor && field.internal) continue;
    let r = row(field, data[field.key]);
    if (!r) continue;
    if (forVisitor && field.type === "file") r = { label: field.label, value: `${data[field.key].filename} — received by our team` };
    if (forVisitor) delete r.href;
    if (!groups.has(field.group)) groups.set(field.group, []);
    groups.get(field.group).push(r);
  }
  return [...groups].map(([heading, rows]) => ({ heading, rows }));
}

const whatsappLink = (phone) => {
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 10 ? `https://wa.me/${digits}` : null;
};

export function teamEmail(form, data, meta) {
  const files = form.fields.filter((f) => f.type === "file" && data[f.key]?.url).map((f) => data[f.key]);
  const actions = [
    { label: data.firstName === "there" ? "Reply" : `Reply to ${data.firstName}`, href: `mailto:${data.email}?subject=${encodeURIComponent(`Re: ${form.source} – VD Infotech`)}` },
    ...files.map((f) => ({ label: files.length > 1 ? `Open ${f.filename}` : "Open attachment", href: f.url, variant: "secondary" })),
    data.phone && { label: "Call", href: `tel:${data.phone.replace(/[^\d+]/g, "")}`, variant: "secondary" },
    data.phone && whatsappLink(data.phone) && { label: "WhatsApp", href: whatsappLink(data.phone), variant: "secondary" },
  ].filter(Boolean);

  const content = {
    preheader: [data.name !== data.email && data.name, data.email, data.phone].filter(Boolean).join(" · "),
    eyebrow: form.team.eyebrow,
    title: form.team.title,
    intro: `${data.name} submitted the "${form.source}" form on the website. Their details are below — reply directly to this email to reach them.`,
    sections: sections(form.fields, data),
    actions,
    meta: [
      ["Submitted", `${IST.format(meta.submittedAt)} IST`],
      meta.page && ["Page", `${brand.site}${meta.page}`],
      ["Form", `${form.source} (${form.id})`],
      meta.ip && ["IP address", meta.ip],
    ].filter(Boolean),
  };

  return { subject: form.team.subject(data), ...renderEmail(content) };
}

export function ackEmail(form, data) {
  const content = {
    preheader: `We've received your request — here's a copy for your records.`,
    eyebrow: "Request received",
    title: form.ack.title,
    intro: form.ack.intro(data),
    sections: [{ heading: "Your request", rows: sections(form.fields, data, { forVisitor: true }).flatMap((s) => s.rows) }],
    note: `Need to add something? Just reply to this email, call us on ${brand.phone} or message us on WhatsApp.`,
    actions: [
      { label: "Chat on WhatsApp", href: `https://wa.me/${brand.whatsapp}` },
      { label: "Visit our website", href: brand.site, variant: "secondary" },
    ],
  };
  return { subject: form.ack.subject, ...renderEmail(content) };
}
