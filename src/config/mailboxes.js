/* The Hostinger mailboxes the API sends from. They share one SMTP server
   (SMTP_HOST / SMTP_PORT / SMTP_SECURE); each has its own login, From header
   and inbox, read from <PREFIX>_SMTP_USER / _SMTP_PASS / _SMTP_FROM / _MAIL_TO.

   Each form picks its mailbox by id (see forms/definitions.js), so the
   enquiry lands in the right inbox and the visitor's confirmation comes from
   the matching address. */

const MAILBOXES = {
  lead: { prefix: "LEAD", label: "Leads" },
  consult: { prefix: "CONSULT", label: "Consultancy" },
  form: { prefix: "FORM", label: "Website forms" },
  career: { prefix: "CAREER", label: "Careers" },
};

export const MAILBOX_IDS = Object.keys(MAILBOXES);

const read = (key) => (process.env[key] ?? "").trim();

export const smtpServer = () => ({
  host: read("SMTP_HOST"),
  port: Number(read("SMTP_PORT")) || 465,
  // Port 465 is implicit TLS; 587 upgrades with STARTTLS (secure=false).
  secure: read("SMTP_SECURE") ? read("SMTP_SECURE") === "true" : Number(read("SMTP_PORT")) !== 587,
});

/** One mailbox's settings. `configured` is false until host, user and password are all set. */
export function getMailbox(id) {
  const def = MAILBOXES[id];
  if (!def) throw new Error(`Unknown mailbox "${id}"`);

  const { prefix, label } = def;
  const user = read(`${prefix}_SMTP_USER`);
  const pass = read(`${prefix}_SMTP_PASS`);
  const to = (read(`${prefix}_MAIL_TO`) || user)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  return {
    id,
    label,
    prefix,
    user,
    pass,
    from: read(`${prefix}_SMTP_FROM`) || (user && `"VD Infotech" <${user}>`),
    to,
    configured: Boolean(smtpServer().host && user && pass),
  };
}

/** Which mailboxes are ready — safe to log (no secrets). */
export const mailboxStatus = () =>
  MAILBOX_IDS.map((id) => {
    const box = getMailbox(id);
    return { id, configured: box.configured, user: box.user || null, to: box.to };
  });
