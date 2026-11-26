import nodemailer from "nodemailer";
import { HttpError } from "./httpError.js";

/* SMTP mail (Hostinger). Settings come from SMTP_* in .env. */
let smtpTransporter = null;

export const isSmtpConfigured = () =>
  Boolean(process.env.SMTP_HOST && process.env.SMTP_PORT && process.env.SMTP_USER && process.env.SMTP_PASS);

const getEmailFrom = () => process.env.SMTP_FROM || process.env.SMTP_USER;

export const getSmtpTransporter = (transportOptions = {}) => {
  if (!isSmtpConfigured()) {
    throw new HttpError(500, "SMTP email is not configured");
  }

  if (!smtpTransporter) {
    smtpTransporter = nodemailer.createTransport({
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 15_000,
      ...transportOptions,
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  return smtpTransporter;
};

export const verifySmtpConnection = () => getSmtpTransporter().verify();

export const sendMail = async ({ to, subject, text, html, replyTo }) => {
  if (!isSmtpConfigured()) {
    if (process.env.NODE_ENV === "production") {
      throw new HttpError(500, "SMTP email is not configured");
    }
    console.warn(`[mail:dev] SMTP not configured — would send "${subject}" to ${to}`);
    return { provider: "dev", to };
  }

  const info = await getSmtpTransporter().sendMail({
    from: getEmailFrom(),
    to,
    replyTo,
    subject,
    text,
    html,
  });

  return { provider: "smtp", to, messageId: info.messageId };
};
