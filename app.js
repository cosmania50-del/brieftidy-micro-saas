const elements = {
  actionsList: document.querySelector("#actionsList"),
  authButton: document.querySelector("#authButton"),
  authEmail: document.querySelector("#authEmail"),
  authModal: document.querySelector("#authModal"),
  authNote: document.querySelector("#authNote"),
  authSideButton: document.querySelector("#authSideButton"),
  authStatus: document.querySelector("#authStatus"),
  checkoutButton: document.querySelector("#checkoutButton"),
  checkoutEmail: document.querySelector("#checkoutEmail"),
  checkoutNote: document.querySelector("#checkoutNote"),
  copyActionsButton: document.querySelector("#copyActionsButton"),
  cleanCopy: document.querySelector("#cleanCopy"),
  copyBriefButton: document.querySelector("#copyBriefButton"),
  copyButton: document.querySelector("#copyButton"),
  copyMarkdownButton: document.querySelector("#copyMarkdownButton"),
  documentInput: document.querySelector("#documentInput"),
  finishOnboarding: document.querySelector("#finishOnboarding"),
  clearButton: document.querySelector("#clearButton"),
  keywordsList: document.querySelector("#keywordsList"),
  onboardingModal: document.querySelector("#onboardingModal"),
  pasteButton: document.querySelector("#pasteButton"),
  planLabel: document.querySelector("#planLabel"),
  pricingModal: document.querySelector("#pricingModal"),
  processButton: document.querySelector("#processButton"),
  resultPanel: document.querySelector("#resultPanel"),
  resultTitle: document.querySelector("#resultTitle"),
  risksList: document.querySelector("#risksList"),
  sampleButton: document.querySelector("#sampleButton"),
  sendMagicLinkButton: document.querySelector("#sendMagicLinkButton"),
  statChars: document.querySelector("#statChars"),
  statCompression: document.querySelector("#statCompression"),
  statWords: document.querySelector("#statWords"),
  summaryList: document.querySelector("#summaryList"),
  toast: document.querySelector("#toast"),
  usageBadge: document.querySelector("#usageBadge"),
  usageBar: document.querySelector("#usageBar"),
  usageText: document.querySelector("#usageText"),
  valueLine: document.querySelector("#valueLine"),
  inputStats: document.querySelector("#inputStats"),
  inputStatus: document.querySelector("#inputStatus")
};

let selectedMode = "quick";
let latestCleanCopy = "";
let latestResult = null;
let appState = { plan: "free", briefsUsed: 0, freeLimit: 3, remaining: 3 };
let appConfig = { auth: { configured: false, required: false }, payments: { configured: false } };
let supabaseClient = null;
let currentSession = null;

const sampleText = `Project Alpha needs a launch decision by Friday. The marketing team has finished the customer messaging draft, but legal review is still missing and could delay the announcement. Sales wants a short one-page summary they can send to pilot customers, and support needs a list of likely objections before the beta opens.

The current proposal is to launch with three core features: faster onboarding, a cleaner reporting dashboard, and automated weekly summaries. The product team believes the dashboard is ready, but onboarding still has a few unclear steps that could confuse new customers.

Next steps are to confirm the final launch date, send the pricing note to finance, prepare a customer email, review the legal language, and schedule a short internal training session for support. The main risks are legal approval, budget uncertainty for paid acquisition, and a possible delay if the onboarding issue is not fixed by Wednesday.`;

const templateText = {
  email: `Subject: Final review before launch

Hi team, I read through the latest customer update and there are a few important points to resolve before we send it. The introduction is clear, but the pricing paragraph could confuse smaller customers. Support also needs a short list of likely questions so they can reply consistently.

Next steps: confirm the final wording with finance, review the cancellation language, prepare a shorter version for sales, and send the approved email by Thursday afternoon. Main risks are unclear pricing, delayed legal review, and customers asking support questions before the team has the answer.`,
  meeting: `Weekly operations meeting notes: The team agreed that onboarding delays are the biggest blocker for new customers. The product team will simplify the first setup screen, support will rewrite the help article, and sales will send three examples of confused customer replies.

Action items: Maya will review the onboarding copy, Jordan will prepare the support article, Alex will confirm whether the reporting dashboard is ready for beta, and the team will meet again on Friday. Risks include unclear ownership, missing screenshots, and a possible delay if QA finds another setup bug.`,
  proposal: `Client proposal draft: The client wants a lightweight reporting workflow for their remote team. The recommended approach is to start with a two-week setup sprint, build a simple dashboard, and train managers on weekly review habits. The proposal should emphasize faster reporting, fewer status meetings, and clearer accountability.

Next steps are to confirm budget, choose the pilot team, prepare the kickoff agenda, and define success metrics. Risks include scope creep, missing data from the client, and adoption problems if managers do not use the dashboard consistently.`,
  research: `Research notes: Several studies and field reports suggest that teams lose time when information is scattered across meeting notes, email threads, and project documents. The pattern is not just information overload; it is action ambiguity. People read the same material but leave with different assumptions about decisions, risks, and next steps.

Useful takeaway: summaries are more valuable when they include explicit actions and unresolved risks. The limitation is that source quality matters. Messy notes can still hide missing context, unclear owners, or decisions that were never actually made.`
};

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.remove("hidden");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => elements.toast.classList.add("hidden"), 3400);
}

function setLoading(isLoading) {
  elements.processButton.disabled = isLoading;
  elements.processButton.textContent = isLoading ? "Cleaning..." : "Clean this text";
}

function updateInputStats() {
  const text = elements.documentInput.value.trim();
  const words = text ? text.split(/\s+/).filter(Boolean).length : 0;
  elements.inputStats.textContent = `${words.toLocaleString()} words · ${text.length.toLocaleString()} characters`;
  if (text.length >= 120) {
    elements.inputStatus.textContent = "Ready to clean.";
    elements.inputStatus.className = "font-semibold text-emerald-700";
  } else {
    elements.inputStatus.textContent = "Add at least 120 characters.";
    elements.inputStatus.className = "";
  }
}

function setMode(mode) {
  selectedMode = mode;
  document.querySelectorAll("[data-mode]").forEach((button) => {
    button.classList.toggle("active", button.dataset.mode === mode);
  });
}

function updateState(next) {
  appState = { ...appState, ...next };
  const isPro = appState.plan === "pro";
  elements.planLabel.textContent = isPro ? "Pro" : "Free";
  elements.usageBadge.textContent = isPro ? "Pro: unlimited briefs" : `${appState.remaining} of ${appState.freeLimit} free briefs left`;
  elements.usageText.textContent = isPro
    ? "Unlimited briefs unlocked."
    : `${appState.briefsUsed} of ${appState.freeLimit} free briefs used.`;
  elements.usageBar.style.width = isPro ? "100%" : `${Math.min(100, (appState.briefsUsed / appState.freeLimit) * 100)}%`;
}

function updateAuthUi() {
  const email = currentSession?.user?.email || "";
  if (!appConfig.auth.configured) {
    elements.authStatus.textContent = "Login is not configured yet.";
    elements.authButton.textContent = "Sign in";
    elements.authSideButton.textContent = "Sign in with email";
    return;
  }

  if (email) {
    elements.authStatus.textContent = `Signed in as ${email}`;
    elements.authButton.textContent = "Sign out";
    elements.authSideButton.textContent = "Sign out";
  } else {
    elements.authStatus.textContent = appConfig.auth.required ? "Sign in required." : "Not signed in.";
    elements.authButton.textContent = "Sign in";
    elements.authSideButton.textContent = "Sign in with email";
  }
}

function authHeaders() {
  return currentSession?.access_token ? { authorization: `Bearer ${currentSession.access_token}` } : {};
}

function requireSessionForAction() {
  if (!appConfig.auth.required || currentSession?.access_token) return true;
  openAuth();
  showToast("Sign in before using BriefTidy.");
  return false;
}

function renderList(target, items) {
  target.innerHTML = "";
  for (const item of items) {
    const li = document.createElement("li");
    li.textContent = item;
    target.appendChild(li);
  }
}

function renderResult(result) {
  latestResult = result;
  latestCleanCopy = result.cleanCopy;
  elements.resultTitle.textContent = result.title;
  renderList(elements.summaryList, result.summary);
  renderList(elements.actionsList, result.actions);
  renderList(elements.risksList, result.risks);
  elements.keywordsList.innerHTML = "";
  for (const keyword of result.keywords) {
    const chip = document.createElement("span");
    chip.className = "rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-neutral-700";
    chip.textContent = keyword;
    elements.keywordsList.appendChild(chip);
  }
  elements.cleanCopy.textContent = result.cleanCopy;
  elements.statWords.textContent = result.stats.estimatedWords.toLocaleString();
  elements.statChars.textContent = result.stats.characters.toLocaleString();
  elements.statCompression.textContent = `${result.stats.compressionRatio}%`;
  const outputWords = result.cleanCopy ? result.cleanCopy.split(/\s+/).filter(Boolean).length : 0;
  elements.valueLine.textContent = `Condensed ${result.stats.estimatedWords.toLocaleString()} words into a ${outputWords.toLocaleString()}-word working brief.`;
  elements.resultPanel.classList.remove("hidden");
}

function markdownBrief() {
  if (!latestResult) return "";
  return `# ${latestResult.title}

## Summary
${latestResult.summary.map((item) => `- ${item}`).join("\n")}

## Action Items
${latestResult.actions.map((item) => `- ${item}`).join("\n")}

## Risks
${latestResult.risks.map((item) => `- ${item}`).join("\n")}

## Key Terms
${latestResult.keywords.map((item) => `- ${item}`).join("\n")}

## Clean Copy
${latestResult.cleanCopy}`;
}

async function copyText(text, label) {
  if (!text) return;
  await navigator.clipboard.writeText(text);
  showToast(`${label} copied.`);
}

async function loadConfig() {
  try {
    const response = await fetch("/api/config");
    if (response.ok) appConfig = await response.json();
  } catch {
    appConfig = { auth: { configured: false, required: false }, payments: { configured: false } };
  }
}

async function initAuth() {
  if (!appConfig.auth.configured || !window.supabase?.createClient) {
    updateAuthUi();
    return;
  }

  supabaseClient = window.supabase.createClient(appConfig.auth.supabaseUrl, appConfig.auth.supabaseAnonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });

  const { data } = await supabaseClient.auth.getSession();
  currentSession = data.session;
  updateAuthUi();

  supabaseClient.auth.onAuthStateChange((_event, session) => {
    currentSession = session;
    updateAuthUi();
    loadState();
  });
}

async function loadState() {
  try {
    const response = await fetch("/api/state", { headers: authHeaders() });
    if (!response.ok) return;
    updateState(await response.json());
  } catch {
    updateState(appState);
  }
}

async function processBrief() {
  if (!requireSessionForAction()) return;

  const text = elements.documentInput.value.trim();
  if (text.length < 120) {
    showToast("Paste at least 120 characters before generating a brief.");
    return;
  }

  setLoading(true);
  try {
    const response = await fetch("/api/process", {
      method: "POST",
      headers: { "content-type": "application/json", ...authHeaders() },
      body: JSON.stringify({ text, mode: selectedMode })
    });
    const data = await response.json();
    if (!response.ok) {
      if (response.status === 401) openAuth();
      if (response.status === 402) openPricing();
      showToast(data.error || "Could not generate the brief.");
      if (data.state) updateState(data.state);
      return;
    }
    updateState(data.state);
    renderResult(data.result);
    showToast("Brief generated.");
  } catch {
    showToast("The server could not be reached.");
  } finally {
    setLoading(false);
  }
}

async function startCheckout() {
  if (!requireSessionForAction()) return;

  elements.checkoutButton.disabled = true;
  elements.checkoutButton.textContent = "Opening Stripe...";
  try {
    const response = await fetch("/api/create-checkout-session", {
      method: "POST",
      headers: { "content-type": "application/json", ...authHeaders() },
      body: JSON.stringify({ email: elements.checkoutEmail.value.trim() })
    });
    const data = await response.json();
    if (!response.ok) {
      elements.checkoutNote.textContent = data.error || "Stripe Test Mode is not configured yet.";
      return;
    }
    window.location.href = data.url;
  } catch {
    elements.checkoutNote.textContent = "Could not create the Stripe checkout session.";
  } finally {
    elements.checkoutButton.disabled = false;
    elements.checkoutButton.textContent = "Start Test Checkout";
  }
}

async function verifyCheckoutReturn() {
  const url = new URL(window.location.href);
  const sessionId = url.searchParams.get("session_id");
  if (!sessionId) return;

  if (!requireSessionForAction()) return;
  showToast("Verifying Stripe Test Mode checkout...");
  try {
    const response = await fetch(`/api/checkout-status?session_id=${encodeURIComponent(sessionId)}`, {
      headers: authHeaders()
    });
    const data = await response.json();
    if (!response.ok) {
      showToast(data.error || "Checkout verification failed.");
      return;
    }
    updateState(data.state);
    showToast("Pro unlocked for your account.");
    window.history.replaceState({}, "", "/");
  } catch {
    showToast("Could not verify checkout.");
  }
}

function openPricing() {
  elements.pricingModal.classList.remove("hidden");
}

function closePricing() {
  elements.pricingModal.classList.add("hidden");
}

function openAuth() {
  elements.authModal.classList.remove("hidden");
}

function closeAuth() {
  elements.authModal.classList.add("hidden");
}

async function sendMagicLink() {
  if (!supabaseClient) {
    elements.authNote.textContent = "Supabase Free Auth is not configured yet.";
    return;
  }

  const email = elements.authEmail.value.trim();
  if (!email || !email.includes("@")) {
    elements.authNote.textContent = "Enter a valid email address.";
    return;
  }

  elements.sendMagicLinkButton.disabled = true;
  elements.sendMagicLinkButton.textContent = "Sending...";
  const { error } = await supabaseClient.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.origin }
  });

  elements.sendMagicLinkButton.disabled = false;
  elements.sendMagicLinkButton.textContent = "Send Magic Link";
  elements.authNote.textContent = error ? error.message : "Magic link sent. Check your inbox.";
}

async function authButtonAction() {
  if (currentSession && supabaseClient) {
    await supabaseClient.auth.signOut();
    currentSession = null;
    updateAuthUi();
    showToast("Signed out.");
    return;
  }
  openAuth();
}

function finishOnboarding() {
  localStorage.setItem("brieftidy_onboarded", "true");
  elements.onboardingModal.classList.add("hidden");
}

function bindEvents() {
  document.querySelectorAll("[data-mode]").forEach((button) => {
    button.addEventListener("click", () => setMode(button.dataset.mode));
  });
  document.querySelectorAll("#pricingTopButton, #pricingSideButton").forEach((button) => {
    button.addEventListener("click", openPricing);
  });
  document.querySelectorAll("[data-close-pricing]").forEach((button) => button.addEventListener("click", closePricing));
  document.querySelectorAll("[data-close-onboarding]").forEach((button) => button.addEventListener("click", finishOnboarding));
  document.querySelectorAll("[data-close-auth]").forEach((button) => button.addEventListener("click", closeAuth));
  elements.authButton.addEventListener("click", authButtonAction);
  elements.authSideButton.addEventListener("click", authButtonAction);
  elements.sendMagicLinkButton.addEventListener("click", sendMagicLink);
  elements.finishOnboarding.addEventListener("click", finishOnboarding);
  elements.documentInput.addEventListener("input", updateInputStats);
  elements.processButton.addEventListener("click", processBrief);
  elements.sampleButton.addEventListener("click", () => {
    elements.documentInput.value = sampleText;
    updateInputStats();
    showToast("Sample inserted.");
  });
  document.querySelectorAll("[data-template]").forEach((button) => {
    button.addEventListener("click", () => {
      elements.documentInput.value = templateText[button.dataset.template] || sampleText;
      updateInputStats();
      showToast(`${button.textContent.trim()} sample inserted.`);
    });
  });
  elements.clearButton.addEventListener("click", () => {
    elements.documentInput.value = "";
    updateInputStats();
    showToast("Input cleared.");
  });
  elements.pasteButton.addEventListener("click", async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text) return showToast("Clipboard is empty.");
      elements.documentInput.value = text;
      updateInputStats();
      showToast("Clipboard pasted.");
    } catch {
      showToast("Paste permission was blocked by the browser.");
    }
  });
  elements.checkoutButton.addEventListener("click", startCheckout);
  elements.copyButton.addEventListener("click", async () => {
    await copyText(latestCleanCopy, "Clean version");
  });
  elements.copyBriefButton.addEventListener("click", async () => copyText(markdownBrief(), "Brief"));
  elements.copyActionsButton.addEventListener("click", async () => copyText(latestResult?.actions?.join("\n") || "", "Actions"));
  elements.copyMarkdownButton.addEventListener("click", async () => copyText(markdownBrief(), "Markdown"));
}

async function boot() {
  bindEvents();
  setMode("quick");
  updateInputStats();
  await loadConfig();
  await initAuth();
  await loadState();
  await verifyCheckoutReturn();
}

boot();
