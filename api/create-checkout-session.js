const { readBody } = require("./_gate");
const { verifySupabaseUser } = require("./_auth");

function appUrl(req) {
  if (process.env.PUBLIC_APP_URL) return process.env.PUBLIC_APP_URL.replace(/\/$/, "");
  const proto = req.headers["x-forwarded-proto"] || "http";
  const host = req.headers["x-forwarded-host"] || req.headers.host || "localhost:3000";
  return `${proto}://${host}`;
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const secret = process.env.STRIPE_SECRET_KEY;
  const price = process.env.STRIPE_PRICE_ID;
  const auth = await verifySupabaseUser(req);
  if (auth.error) return res.status(auth.status).json({ error: auth.message });

  if (!secret || !price) {
    return res.status(503).json({
      error: "Checkout is not configured yet.",
      required: ["STRIPE_SECRET_KEY", "STRIPE_PRICE_ID", "APP_SECRET", "PUBLIC_APP_URL"]
    });
  }

  const liveAllowed = process.env.ALLOW_STRIPE_LIVE === "true";
  if (!secret.startsWith("sk_test_") && !liveAllowed) {
    return res.status(400).json({ error: "Live Stripe keys require ALLOW_STRIPE_LIVE=true." });
  }

  if (!price.startsWith("price_")) {
    return res.status(400).json({ error: "Stripe price ID is invalid." });
  }

  const priceResponse = await fetch(`https://api.stripe.com/v1/prices/${encodeURIComponent(price)}`, {
    headers: { authorization: `Bearer ${secret}` }
  });
  const priceData = await priceResponse.json();
  if (!priceResponse.ok) return res.status(priceResponse.status).json({ error: priceData.error?.message || "Stripe price lookup failed." });
  if ((!liveAllowed && priceData.livemode) || priceData.unit_amount !== 500 || priceData.currency !== "usd" || priceData.recurring?.interval !== "month") {
    return res.status(400).json({ error: "Stripe price must be $5.00 USD, recurring monthly, and test-mode unless live payments are explicitly enabled." });
  }

  const body = await readBody(req);
  const origin = appUrl(req);
  const params = new URLSearchParams({
    mode: "subscription",
    success_url: `${origin}/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/cancel`,
    "line_items[0][price]": price,
    "line_items[0][quantity]": "1",
    customer_creation: "always",
    customer_email: auth.user?.email || body.email || "",
    allow_promotion_codes: "false",
    "metadata[source]": "BriefTidy",
    "metadata[user_id]": auth.user?.id || "",
    "metadata[email]": auth.user?.email || body.email || ""
  });

  if (auth.user?.id) params.set("client_reference_id", auth.user.id);

  const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${secret}`,
      "content-type": "application/x-www-form-urlencoded"
    },
    body: params
  });

  const data = await response.json();
  if (!response.ok) return res.status(response.status).json({ error: data.error?.message || "Stripe checkout failed." });

  return res.status(200).json({ url: data.url, id: data.id });
};
