const { verifySupabaseUser } = require("./_auth");
const { readUsage } = require("./_store");

module.exports = async function handler(req, res) {
  const auth = await verifySupabaseUser(req);
  if (auth.error) return res.status(auth.status).json({ error: auth.message });

  try {
    return res.status(200).json(await readUsage(req, auth.user));
  } catch {
    return res.status(503).json({ error: "Account state is not configured yet." });
  }
};
