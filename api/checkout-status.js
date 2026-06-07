const { verifySupabaseUser } = require("./_auth");
const { setPro } = require("./_store");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const secret = process.env.STRIPE_SECRET_KEY;
  const sessionId = req.query?.session_id || new URL(req.url, "http://local").searchParams.get("session_id");
  const auth = await verifySupabaseUser(req);
  if (auth.error) return res.status(auth.status).json({ error: auth.message });

  const liveAllowed = process.env.ALLOW_STRIPE_LIVE === "true";
  if (!secret || (!secret.startsWith("sk_test_") && !liveAllowed)) {
    return res.status(503).json({ error: "Stripe checkout is not configured." });
  }

  if (!sessionId || (!sessionId.startsWith("cs_test_") && !liveAllowed)) {
    return res.status(400).json({ error: "A valid Stripe session ID is required." });
  }

  const response = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`, {
    headers: { authorization: `Bearer ${secret}` }
  });

  const data = await response.json();
  if (!response.ok) return res.status(response.status).json({ error: data.error?.message || "Could not verify checkout." });

  const tiedToUser = data.client_reference_id === auth.user?.id || data.metadata?.user_id === auth.user?.id;
  const paid = (liveAllowed || !data.livemode) && data.mode === "subscription" && data.status === "complete" && data.payment_status === "paid";
  if (!paid) return res.status(402).json({ error: "Checkout has not completed yet.", status: data.status });
  if (!tiedToUser) return res.status(403).json({ error: "Checkout session does not match the signed-in account." });

  const state = await setPro(req, res, auth.user, {
    customer: data.customer,
    subscription: data.subscription
  });
  return res.status(200).json({ state });
};
