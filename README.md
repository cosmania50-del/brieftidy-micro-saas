# BriefTidy

BriefTidy is a zero-cost-to-run micro-SaaS MVP for turning messy text into a concise brief. It uses a free deterministic processing engine instead of paid AI APIs, plus Stripe Test Mode for a sandboxed `$5/month` subscription flow.

## Cost Guardrails

- No OpenAI API calls.
- No live Stripe charges.
- No database account required.
- Runs on Vercel Free/Hobby using static files and serverless functions.

## Required Free Accounts

- Vercel Free/Hobby for hosting.
- Stripe Test Mode for checkout testing.
- Supabase Free for email magic-link login and account usage tracking.
- GitHub Free is optional, only for repository-based deployment.

## Local Run

If the Vercel CLI is available:

```bash
vercel dev
```

If not, this repo includes a tiny local server:

```bash
node local-server.js
```

Then open `http://localhost:3000`.

## Stripe Test Setup

1. In Stripe Dashboard, switch to **Test Mode**.
2. Create a product named `BriefTidy Pro`.
3. Create a recurring monthly price for exactly `$5.00 USD`.
4. Or create both automatically with:

```bash
$env:STRIPE_SECRET_KEY="sk_test_your_key"
node scripts/create-stripe-test-price.js
```

5. Copy the test secret key and price ID into Vercel environment variables:
   - `STRIPE_SECRET_KEY`
   - `STRIPE_PRICE_ID`
   - `APP_SECRET`
   - `PUBLIC_APP_URL`
   - `REQUIRE_AUTH=true`
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
6. Optional webhook endpoint:
   - URL: `https://your-vercel-url.vercel.app/api/stripe-webhook`
   - Events: `checkout.session.completed`, `customer.subscription.deleted`, `customer.subscription.updated`

Use Stripe test card `4242 4242 4242 4242` with any future expiry and any CVC.

## Supabase Free Auth Setup

1. Create a Supabase Free project.
2. Open SQL Editor and run `supabase-schema.sql`.
3. In Authentication settings, enable email OTP/magic links.
4. Add your Vercel URL as an allowed redirect URL.
5. In Vercel, set:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `REQUIRE_AUTH=true`

BriefTidy stores only account metadata: plan, usage count, email, timestamps, and Stripe Test Mode IDs. It does not store pasted document content.

## Free Plan

The free plan allows 3 briefs per signed-in account when Supabase is configured. Pro is activated only after a valid Stripe Test Mode checkout is verified server-side for the same signed-in user.
