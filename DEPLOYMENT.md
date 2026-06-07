# BriefTidy Free Deployment Checklist

This project can deploy on Vercel Free/Hobby without paid services.

## Free Services

- Vercel Free/Hobby: hosting and serverless API.
- Supabase Free: email magic-link login and account usage tracking.
- Stripe Test Mode: sandbox checkout only, no real charges.

## Supabase

1. Create a free Supabase project.
2. Open SQL Editor and run `supabase-schema.sql`.
3. Enable email magic-link login.
4. Add your Vercel URL as an allowed redirect URL after deployment.
5. Copy:
   - Project URL
   - anon public key
   - service role key

## Stripe

1. Switch Stripe Dashboard to Test Mode.
2. Create a product named `BriefTidy Pro`.
3. Create a recurring monthly price for `$5.00 USD`.
4. Copy:
   - test secret key, starting with `sk_test_`
   - price ID, starting with `price_`
5. Use test card `4242 4242 4242 4242`.

## Vercel Environment Variables

Set these in Vercel:

```text
REQUIRE_AUTH=true
PUBLIC_APP_URL=https://your-project.vercel.app
APP_SECRET=<long random value>
SUPABASE_URL=<your Supabase project URL>
SUPABASE_ANON_KEY=<your Supabase anon key>
SUPABASE_SERVICE_ROLE_KEY=<your Supabase service role key>
STRIPE_SECRET_KEY=<your Stripe Test Mode secret key>
STRIPE_PRICE_ID=<your Stripe Test Mode $5/month price ID>
STRIPE_WEBHOOK_SECRET=<optional until webhook is added>
```

## Vercel Project Settings

- Framework preset: Other
- Build command: empty
- Output directory: empty
- Install command: empty or default

## After First Deploy

1. Copy the Vercel URL.
2. Set `PUBLIC_APP_URL` to that URL.
3. Add the same URL in Supabase Auth redirect URLs.
4. Redeploy.
5. Test login, generate 3 free briefs, then test Stripe checkout in Test Mode.
