const { FREE_LIMIT, publicState, readState, writeState } = require("./_gate");

function storeConfigured() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function storeRequired() {
  return process.env.REQUIRE_AUTH === "true";
}

function tableUrl(path = "") {
  return `${process.env.SUPABASE_URL.replace(/\/$/, "")}/rest/v1/profiles${path}`;
}

async function supabaseRequest(path, options = {}) {
  const response = await fetch(tableUrl(path), {
    ...options,
    headers: {
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      "content-type": "application/json",
      ...(options.headers || {})
    }
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Supabase request failed with ${response.status}`);
  }

  if (response.status === 204) return null;
  return response.json();
}

function normalizeProfile(profile) {
  return {
    plan: profile?.plan === "pro" ? "pro" : "free",
    briefsUsed: Number.isFinite(profile?.briefs_used) ? profile.briefs_used : 0,
    freeLimit: FREE_LIMIT,
    remaining: profile?.plan === "pro" ? "unlimited" : Math.max(0, FREE_LIMIT - (profile?.briefs_used || 0))
  };
}

async function ensureProfile(user) {
  if (!storeConfigured()) {
    if (storeRequired()) throw new Error("Supabase profile storage is not configured.");
    return null;
  }

  const id = encodeURIComponent(user.id);
  const existing = await supabaseRequest(`?user_id=eq.${id}&select=*`);
  if (existing[0]) return existing[0];

  const created = await supabaseRequest("?select=*", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      user_id: user.id,
      email: user.email || "",
      plan: "free",
      briefs_used: 0
    })
  });

  return created[0];
}

async function readUsage(req, user) {
  if (!user) return publicState(readState(req));
  const profile = await ensureProfile(user);
  return profile ? normalizeProfile(profile) : publicState(readState(req));
}

async function incrementUsage(req, res, user) {
  if (!user) {
    const current = readState(req);
    const next = writeState(res, {
      ...current,
      briefsUsed: current.plan === "pro" ? current.briefsUsed : current.briefsUsed + 1
    });
    return publicState(next);
  }

  const profile = await ensureProfile(user);
  if (!profile) {
    const current = readState(req);
    const next = writeState(res, {
      ...current,
      briefsUsed: current.plan === "pro" ? current.briefsUsed : current.briefsUsed + 1
    });
    return publicState(next);
  }

  if (profile.plan === "pro") return normalizeProfile(profile);

  const nextCount = (profile.briefs_used || 0) + 1;
  const updated = await supabaseRequest(`?user_id=eq.${encodeURIComponent(user.id)}&select=*`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ briefs_used: nextCount, updated_at: new Date().toISOString() })
  });

  return normalizeProfile(updated[0]);
}

async function setPro(req, res, user, stripeData = {}) {
  if (!user) {
    const current = readState(req);
    const next = writeState(res, { ...current, plan: "pro" });
    return publicState(next);
  }

  const profile = await ensureProfile(user);
  if (!profile) {
    const current = readState(req);
    const next = writeState(res, { ...current, plan: "pro" });
    return publicState(next);
  }

  const updated = await supabaseRequest(`?user_id=eq.${encodeURIComponent(user.id)}&select=*`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      plan: "pro",
      stripe_test_customer_id: stripeData.customer || null,
      stripe_test_subscription_id: stripeData.subscription || null,
      updated_at: new Date().toISOString()
    })
  });

  writeState(res, { plan: "pro", briefsUsed: 0 });
  return normalizeProfile(updated[0]);
}

module.exports = {
  ensureProfile,
  incrementUsage,
  readUsage,
  setPro,
  storeConfigured,
  storeRequired
};
