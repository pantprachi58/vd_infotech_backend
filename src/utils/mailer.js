import nodemailer from "nodemailer";
import { getMailbox, mailboxStatus, smtpServer } from "../config/mailboxes.js";
import { HttpError } from "./httpError.js";

/* SMTP mail (Hostinger), one transporter per mailbox, created on first use. */
const transporters = new Map();

function transporterFor(box) {
  let transporter = transporters.get(box.id);
  if (!transporter) {
    transporter = nodemailer.createTransport({
      ...smtpServer(),
      auth: { user: box.user, pass: box.pass },
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
    });
    transporters.set(box.id, transporter);
  }
  return transporter;
}

/**
 * Sends one message from `mailboxId` ("lead", "consult", "form", "career").
 * `to` defaults to the mailbox's own inbox (<PREFIX>_MAIL_TO, else its login).
 * Outside production an unconfigured mailbox only logs, so forms can be
 * exercised locally without SMTP credentials.
 */
export async function sendMail(mailboxId, { to, subject, text, html, replyTo, attachments }) {
  const box = getMailbox(mailboxId);
  const recipients = to ?? box.to;

  if (!box.configured) {
    if (process.env.NODE_ENV === "production") {
      throw new HttpError(500, `The ${box.label} mailbox is not configured (${box.prefix}_SMTP_USER / ${box.prefix}_SMTP_PASS)`);
    }
    console.warn(`[mail:dev] ${box.prefix} mailbox not configured — would send "${subject}" to ${[recipients].flat().join(", ")}`);
    return { provider: "dev", to: recipients };
  }

  const info = await transporterFor(box).sendMail({
    from: box.from,
    to: recipients,
    replyTo,
    subject,
    text,
    html,
    attachments,
  });
  return { provider: "smtp", to: recipients, messageId: info.messageId };
}

/** Logs which mailboxes are ready at startup. */
export function logMailboxStatus() {
  for (const { id, configured, user, to } of mailboxStatus()) {
    if (configured) console.log(`Mail: ${id.padEnd(7)} → sends as ${user}, delivers to ${to.join(", ")}`);
    else console.warn(`Mail: ${id.padEnd(7)} → not configured`);
  }
}

/** Checks the SMTP login of every configured mailbox. */
export async function verifyMailboxes() {
  const results = {};
  for (const { id, configured } of mailboxStatus()) {
    if (!configured) {
      results[id] = "not configured";
      continue;
    }
    try {
      await transporterFor(getMailbox(id)).verify();
      results[id] = "ok";
    } catch (err) {
      results[id] = err.message;
    }
  }
  return results;
}
