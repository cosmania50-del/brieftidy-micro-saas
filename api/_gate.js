const crypto = require("crypto");

const COOKIE_NAME = "BriefTidy_state";
const FREE_LIMIT = 3;

function appSecret() {
  return process.env.APP_SECRET || "local-dev-BriefTidy-secret-change-me";
}

function base64url(input) {
  return Buffer.from(input).toString("base64url");
}

function sign(payload) {
  return crypto.createHmac("sha256", appSecret()).update(payload).digest("base64url");
}

function defaultState() {
  return {
    plan: "free",
    briefsUsed: 0,
    updatedAt: new Date().toISOString()
  };
}

function parseCookies(header = "") {
  return Object.fromEntries(
    header
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const index = part.indexOf("=");
        return [part.slice(0, index), decodeURIComponent(part.slice(index + 1))];
      })
  );
}

function readState(req) {
  const raw = parseCookies(req.headers.cookie || "")[COOKIE_NAME];
  if (!raw || !raw.includes(".")) return defaultState();

  const [payload, signature] = raw.split(".");
  if (sign(payload) !== signature) return defaultState();

  try {
    return { ...defaultState(), ...JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) };
  } catch {
    return defaultState();
  }
}

function writeState(res, state) {
  const next = {
    plan: state.plan === "pro" ? "pro" : "free",
    briefsUsed: Number.isFinite(state.briefsUsed) ? state.briefsUsed : 0,
    updatedAt: new Date().toISOString()
  };
  const payload = base64url(JSON.stringify(next));
  const value = `${payload}.${sign(payload)}`;
  res.setHeader(
    "Set-Cookie",
    `${COOKIE_NAME}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000`
  );
  return next;
}

function publicState(state) {
  return {
    plan: state.plan,
    briefsUsed: state.briefsUsed,
    freeLimit: FREE_LIMIT,
    remaining: state.plan === "pro" ? "unlimited" : Math.max(0, FREE_LIMIT - state.briefsUsed)
  };
}

async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function readRawBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

module.exports = {
  COOKIE_NAME,
  FREE_LIMIT,
  publicState,
  readBody,
  readRawBody,
  readState,
  writeState
};
