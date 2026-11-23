/**
 * A thin Razorpay client over its REST API (no SDK): Basic auth with the key
 * id / secret, JSON in and out, and the two signature checks Razorpay uses.
 *
 *   checkout   HMAC-SHA256(order_id + "|" + payment_id, key_secret)          one-time
 *              HMAC-SHA256(payment_id + "|" + subscription_id, key_secret)   subscription
 *   webhook    HMAC-SHA256(raw request body, webhook_secret)
 *
 * Amounts are always integers in paise.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "../config/env.js";
import { HttpError } from "./httpError.js";

const API = env.razorpay.apiBase;

export const razorpayConfigured = () => Boolean(env.razorpay.keyId && env.razorpay.keySecret);

function assertConfigured() {
  if (!razorpayConfigured()) {
    throw new HttpError(503, "Online payments are not set up yet (RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET are missing on the server).");
  }
}

async function call(method, path, body) {
  assertConfigured();
  const auth = Buffer.from(`${env.razorpay.keyId}:${env.razorpay.keySecret}`).toString("base64");
  let res;
  try {
    res = await fetch(`${API}${path}`, {
      method,
      headers: { authorization: `Basic ${auth}`, "content-type": "application/json", accept: "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new HttpError(502, "Could not reach Razorpay. Please try again in a moment.");
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const description = json?.error?.description || `Razorpay returned ${res.status}`;
    // 4xx from Razorpay is a problem with what we sent; report it as ours (502), with its reason.
    throw new HttpError(502, `Razorpay: ${description}`);
  }
  return json;
}

export const razorpay = {
  createOrder: (body) => call("POST", "/orders", body),
  createPlan: (body) => call("POST", "/plans", body),
  createSubscription: (body) => call("POST", "/subscriptions", body),
  fetchPayment: (id) => call("GET", `/payments/${encodeURIComponent(id)}`),
  capturePayment: (id, amount, currency) => call("POST", `/payments/${encodeURIComponent(id)}/capture`, { amount, currency }),
  fetchSubscription: (id) => call("GET", `/subscriptions/${encodeURIComponent(id)}`),
};

const hmac = (secret, payload) => createHmac("sha256", secret).update(payload).digest("hex");

function safeEqual(given, expected) {
  const a = Buffer.from(String(given ?? ""));
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Checks the signature Razorpay Checkout hands the browser after a payment. */
export function verifyCheckoutSignature({ orderId, subscriptionId, paymentId, signature }) {
  if (!env.razorpay.keySecret || !paymentId || !signature) return false;
  const payload = subscriptionId ? `${paymentId}|${subscriptionId}` : `${orderId}|${paymentId}`;
  return safeEqual(signature, hmac(env.razorpay.keySecret, payload));
}

/** Checks the X-Razorpay-Signature header against the raw webhook body. */
export function verifyWebhookSignature(rawBody, signature) {
  if (!env.razorpay.webhookSecret || !signature) return false;
  return safeEqual(signature, hmac(env.razorpay.webhookSecret, rawBody));
}

/** Razorpay plan period / interval for a billing cycle of `months`. */
export function planPeriod(months) {
  return months % 12 === 0 ? { period: "yearly", interval: months / 12 } : { period: "monthly", interval: months };
}
