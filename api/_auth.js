async function verifySupabaseUser(req) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
  const required = process.env.REQUIRE_AUTH === "true";

  if (!supabaseUrl || !supabaseAnonKey) {
    return required
      ? { error: true, status: 503, message: "Login is not configured yet." }
      : { error: false, user: null };
  }

  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";

  if (!token) {
    return required
      ? { error: true, status: 401, message: "Sign in before generating a brief." }
      : { error: false, user: null };
  }

  try {
    const response = await fetch(`${supabaseUrl.replace(/\/$/, "")}/auth/v1/user`, {
      headers: {
        authorization: `Bearer ${token}`,
        apikey: supabaseAnonKey
      }
    });

    if (!response.ok) {
      return { error: true, status: 401, message: "Your session could not be verified. Please sign in again." };
    }

    const user = await response.json();
    return { error: false, user: { id: user.id, email: user.email || "" } };
  } catch {
    return { error: true, status: 503, message: "Login verification is temporarily unavailable." };
  }
}

module.exports = { verifySupabaseUser };
