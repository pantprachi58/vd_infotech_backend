import { getForm } from "../forms/definitions.js";
import { ackEmail, teamEmail } from "../forms/emails.js";
import { validate } from "../forms/validate.js";
import { badRequest, HttpError, notFound } from "../utils/httpError.js";
import { removeFormFiles, storeFormFile } from "../utils/formUploads.js";
import { sendMail } from "../utils/mailer.js";
import { createRateLimiter } from "../utils/rateLimiter.js";

// Per IP and form, so one visitor can't flood an inbox (or use the visitor
// confirmation to mail-bomb someone else's address).
const limiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 5 });

// Requests arrive through the website's /app-api/forms proxy, which passes the visitor's IP.
const clientIp = (req) => String(req.get("x-client-ip") || req.ip || "").slice(0, 64);

const cleanPage = (page) => (typeof page === "string" && /^\/[\w\-/.]{0,200}$/.test(page) ? page : "");

const safeName = (name) => name.replace(/["<>\r\n]/g, "").trim();

/**
 * POST /api/forms/:form — validates a website form, emails it to the form's
 * mailbox and sends the visitor a confirmation from the same address.
 * Body: the form's fields (forms/definitions.js) plus optional `page`;
 * `hp` is a honeypot that real visitors never fill.
 */
export async function submitForm(req, res) {
  const form = getForm(req.params.form);
  if (!form) throw notFound("Unknown form");

  const body = req.body && typeof req.body === "object" ? req.body : {};
  if (body.hp) return res.status(201).json({ ok: true });

  const { data, errors } = validate(form.fields, body);
  if (errors) throw badRequest("Please check the form", errors);

  const ip = clientIp(req);
  if (limiter.hit(`${form.id}:${ip}`)) throw new HttpError(429, "Too many requests. Please try again later.");

  // Forms without a name field (newsletter) are addressed by email.
  const realName = safeName(data.name ?? "");
  data.firstName = realName.split(/\s+/)[0] || "there";
  data.name = realName || data.email;
  const meta = { submittedAt: new Date(), page: cleanPage(body.page), ip };

  // Attachments are saved to uploads/forms; the email carries their links.
  const stored = [];
  try {
    for (const field of form.fields.filter((f) => f.type === "file" && data[f.key])) {
      data[field.key] = await storeFormFile(data[field.key]);
      stored.push(data[field.key]);
    }
  } catch (err) {
    await removeFormFiles(stored);
    console.error(`[forms] ${form.id}: saving attachment failed:`, err.message);
    throw new HttpError(500, "We couldn't save your file. Please try again.");
  }

  try {
    const sent = await sendMail(form.mailbox, { ...teamEmail(form, data, meta), replyTo: `"${data.name}" <${data.email}>` });
    const files = stored.map((f) => `${f.filename} → ${f.url}`).join(", ") || "none";
    console.log(`[forms] ${form.id}: emailed to ${[sent.to].flat().join(", ")} via ${form.mailbox} — files: ${files}`);
  } catch (err) {
    await removeFormFiles(stored);
    console.error(`[forms] ${form.id}: team email failed:`, err.message);
    throw new HttpError(502, "We couldn't send your request right now. Please try again or reach us on WhatsApp.");
  }

  // The enquiry is safely with the team; a failed confirmation is only logged.
  sendMail(form.mailbox, { to: data.email, ...ackEmail(form, data) }).catch((err) =>
    console.error(`[forms] ${form.id}: confirmation to visitor failed:`, err.message)
  );

  res.status(201).json({ ok: true });
}
