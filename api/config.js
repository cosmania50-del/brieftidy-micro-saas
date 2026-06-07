module.exports = async function handler(req, res) {
  res.status(200).json({
    auth: {
      configured: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY),
      required: process.env.REQUIRE_AUTH === "true",
      supabaseUrl: process.env.SUPABASE_URL || "",
      supabaseAnonKey: process.env.SUPABASE_ANON_KEY || ""
    },
    payments: {
      testModeOnly: true,
      configured: Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PRICE_ID)
    }
  });
};
