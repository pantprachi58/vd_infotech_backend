import { badRequest, HttpError } from "../utils/httpError.js";
import { sendMail } from "../utils/mailer.js";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE = /^[0-9 +\-]{8,16}$/;

// field -> [label, max length, required]
const FIELDS = {
  name: ["Name", 120, true],
  email: ["Email", 200, true],
  phone: ["Phone", 20, true],
  company: ["Company", 160, false],
  date: ["Date", 80, true],
  time: ["Time", 120, true],
  ist: ["In IST", 120, false],
  duration: ["Duration", 40, true],
  message: ["Notes", 3000, false],
};

const escapeHtml = (s) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

// A small per-IP limit so the form can't be used to flood the inbox.
const WINDOW_MS = 15 * 60 * 1000;
const MAX_PER_WINDOW = 5;
const hits = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) for (const [key, times] of hits) if (now - times.at(-1) > WINDOW_MS) hits.delete(key);
  return recent.length > MAX_PER_WINDOW;
}

/* POST /api/consultation — a "Book Your Strategy Session" request, emailed to the team. */
export async function createConsultation(req, res) {
  const body = req.body ?? {};
  // honeypot: real visitors never see or fill this field
  if (body.website) return res.status(201).json({ ok: true });

  const data = {};
  const details = {};
  for (const [key, [label, max, required]] of Object.entries(FIELDS)) {
    const value = typeof body[key] === "string" ? body[key].trim() : "";
    if (required && !value) details[key] = `${label} is required`;
    else if (value.length > max) details[key] = `${label} is too long`;
    data[key] = value;
  }
  if (data.email && !EMAIL.test(data.email)) details.email = "Enter a valid email address";
  if (data.phone && !PHONE.test(data.phone)) details.phone = "Enter a valid phone number";
  if (Object.keys(details).length) throw badRequest("Please check the form", details);

  // requests arrive through the website's /app-api/consultation proxy, which passes the visitor's IP
  const ip = String(req.get("x-client-ip") || req.ip).slice(0, 64);
  if (rateLimited(ip)) throw new HttpError(429, "Too many requests. Please try again later.");

  const rows = Object.entries(FIELDS)
    .filter(([key]) => data[key])
    .map(([key, [label]]) => [label, data[key]]);

  const text = ["New Strategy Session Request", "", ...rows.map(([l, v]) => `${l}: ${v}`)].join("\n");
  const html = `
    <h2 style="font-family:Arial,sans-serif;color:#DA0A03">New Strategy Session Request</h2>
    <table cellpadding="8" style="font-family:Arial,sans-serif;font-size:14px;border-collapse:collapse">
      ${rows
        .map(
          ([l, v]) =>
            `<tr><td style="border:1px solid #ddd;font-weight:bold;vertical-align:top">${l}</td>` +
            `<td style="border:1px solid #ddd;white-space:pre-wrap">${escapeHtml(v)}</td></tr>`
        )
        .join("")}
    </table>`;

  try {
    await sendMail({
      to: process.env.CONSULTATION_TO || process.env.SMTP_USER,
      replyTo: `"${data.name.replace(/["\r\n]/g, "")}" <${data.email}>`,
      subject: `Strategy Session Request - ${data.name} (${data.date})`,
      text,
      html,
    });
  } catch (err) {
    console.error("Consultation email failed:", err);
    throw new HttpError(502, "We couldn't send your request right now. Please try again or reach us on WhatsApp.");
  }

  res.status(201).json({ ok: true });
}
