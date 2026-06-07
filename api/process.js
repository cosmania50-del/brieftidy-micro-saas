const { verifySupabaseUser } = require("./_auth");
const { FREE_LIMIT, readBody } = require("./_gate");
const { incrementUsage, readUsage } = require("./_store");

const STOPWORDS = new Set(
  "a an and are as at be by can for from has have if in into is it its of on or that the this to was were with you your we our they their i me my".split(
    " "
  )
);

function cleanText(text) {
  return String(text || "")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function sentences(text) {
  return cleanText(text)
    .split(/(?<=[.!?])\s+|\n+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 30);
}

function keywordScores(text) {
  const scores = new Map();
  const words = cleanText(text)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 3 && !STOPWORDS.has(word));

  for (const word of words) scores.set(word, (scores.get(word) || 0) + 1);
  return scores;
}

function topKeywords(text) {
  return [...keywordScores(text).entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([word]) => word);
}

function rankSentences(text) {
  const scores = keywordScores(text);
  return sentences(text)
    .map((sentence, index) => {
      const words = sentence.toLowerCase().replace(/[^a-z0-9\s-]/g, " ").split(/\s+/);
      const score = words.reduce((sum, word) => sum + (scores.get(word) || 0), 0) / Math.max(8, words.length);
      return { sentence, index, score };
    })
    .sort((a, b) => b.score - a.score || a.index - b.index);
}

function extractActions(text) {
  const markers = /\b(todo|to do|next|action|follow up|follow-up|send|review|approve|decide|schedule|call|email|prepare|confirm|fix|launch)\b/i;
  return sentences(text)
    .filter((sentence) => markers.test(sentence))
    .slice(0, 6)
    .map((sentence) => sentence.replace(/^[-*\d.)\s]+/, ""));
}

function extractRisks(text) {
  const markers = /\b(risk|issue|blocked|problem|concern|delay|missing|unclear|deadline|legal|security|privacy|budget|cost)\b/i;
  return sentences(text)
    .filter((sentence) => markers.test(sentence))
    .slice(0, 5)
    .map((sentence) => sentence.replace(/^[-*\d.)\s]+/, ""));
}

function buildBrief(text, mode) {
  const cleaned = cleanText(text);
  const ranked = rankSentences(cleaned);
  const summaryCount = mode === "deep" ? 7 : mode === "email" ? 4 : 5;
  const summary = ranked
    .slice(0, summaryCount)
    .sort((a, b) => a.index - b.index)
    .map((item) => item.sentence);

  const keywords = topKeywords(cleaned);
  const actions = extractActions(cleaned);
  const risks = extractRisks(cleaned);

  return {
    title: keywords.length ? `Brief: ${keywords.slice(0, 3).join(", ")}` : "Brief",
    summary,
    actions: actions.length ? actions : ["No explicit action items detected."],
    risks: risks.length ? risks : ["No obvious risks detected in the provided text."],
    keywords,
    cleanCopy:
      mode === "email"
        ? `Hi,\n\nHere is the concise version:\n\n${summary.map((line) => `- ${line}`).join("\n")}\n\nNext steps:\n${(actions.length ? actions : ["No explicit action items detected."]).map((line) => `- ${line}`).join("\n")}\n\nBest,`
        : `${summary.join("\n\n")}\n\nAction items:\n${(actions.length ? actions : ["No explicit action items detected."]).map((line) => `- ${line}`).join("\n")}`,
    stats: {
      characters: cleaned.length,
      estimatedWords: cleaned ? cleaned.split(/\s+/).length : 0,
      compressionRatio: cleaned ? Math.max(8, Math.round((summary.join(" ").length / cleaned.length) * 100)) : 0
    }
  };
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const auth = await verifySupabaseUser(req);
  if (auth.error) return res.status(auth.status).json({ error: auth.message });

  let state;
  try {
    state = await readUsage(req, auth.user);
  } catch {
    return res.status(503).json({ error: "Account state is not configured yet." });
  }

  if (state.plan !== "pro" && state.briefsUsed >= FREE_LIMIT) {
    return res.status(402).json({
      error: "Free limit reached",
      state
    });
  }

  const body = await readBody(req);
  const text = cleanText(body.text);
  const mode = ["quick", "deep", "email"].includes(body.mode) ? body.mode : "quick";

  if (text.length < 120) return res.status(400).json({ error: "Add at least 120 characters so BriefTidy has enough context." });
  if (text.length > 25000 && state.plan !== "pro") return res.status(413).json({ error: "Free briefs are limited to 25,000 characters." });
  if (text.length > 100000) return res.status(413).json({ error: "This version supports up to 100,000 characters per brief." });

  const result = buildBrief(text, mode);
  const nextState = await incrementUsage(req, res, auth.user);

  return res.status(200).json({
    result,
    state: nextState
  });
};
