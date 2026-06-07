const secret = process.env.STRIPE_SECRET_KEY;

if (!secret || !secret.startsWith("sk_test_")) {
  console.error("Set STRIPE_SECRET_KEY to a Stripe Test Mode secret key before running this script.");
  process.exit(1);
}

async function stripe(path, params) {
  const response = await fetch(`https://api.stripe.com/v1${path}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${secret}`,
      "content-type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams(params)
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error?.message || `Stripe request failed for ${path}`);
  }
  return data;
}

async function main() {
  const product = await stripe("/products", {
    name: "BriefTidy Pro",
    description: "Unlimited BriefTidy document briefs in Stripe Test Mode."
  });

  const price = await stripe("/prices", {
    product: product.id,
    currency: "usd",
    unit_amount: "500",
    recurring: "month",
    nickname: "BriefTidy Pro - $5 monthly"
  });

  console.log(JSON.stringify({ product_id: product.id, price_id: price.id }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
