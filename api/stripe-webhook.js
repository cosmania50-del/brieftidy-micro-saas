const crypto = require("crypto");
const { readRawBody } = require("./_gate");

function verifyStripeSignature(raw, signatureHeader, secret) {
  if (!signatureHeader || !secret) return false;
  const parts = Object.fromEntries(signatureHeader.split(",").map((part) => part.split("=").map((value) => value.trim())));
  if (!parts.t || !parts.v1) return false;
  const ageSeconds = Math.abs(Date.now() / 1000 - Number(parts.t));
  if (!Number.isFinite(ageSeconds) || ageSeconds > 300) return false;
  const signed = `${parts.t}.${raw}`;
  const expected = crypto.createHmac("sha256", secret).update(signed).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(parts.v1));
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const raw = await readRawBody(req);
  const signature = req.headers["stripe-signature"];
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (process.env.REQUIRE_AUTH === "true" && !secret) {
    return res.status(503).json({ error: "Stripe webhook verification is not configured." });
  }

  if (secret && !verifyStripeSignature(raw, signature, secret)) {
    return res.status(400).json({ error: "Invalid Stripe webhook signature." });
  }

  let event;
  try {
    event = JSON.parse(raw);
  } catch {
    return res.status(400).json({ error: "Invalid JSON payload." });
  }

  const accepted = new Set(["checkout.session.completed", "customer.subscription.deleted", "customer.subscription.updated"]);
  if (event.livemode && process.env.ALLOW_STRIPE_LIVE !== "true") return res.status(400).json({ error: "Live Stripe events require ALLOW_STRIPE_LIVE=true." });

  return res.status(200).json({
    received: true,
    tracked: accepted.has(event.type),
    note: "Webhook received."
  });
};
