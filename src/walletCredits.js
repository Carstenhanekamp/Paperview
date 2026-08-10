/** Wallet money helpers. 1 EUR = 100_000_000 microcents. */

export const MICROCENT_PER_EUR = 100_000_000;
export const TRYOUT_GRANT_EUR = 2;
export const TRYOUT_GRANT_MICROCENT = TRYOUT_GRANT_EUR * MICROCENT_PER_EUR;

/** Fixed action prices (wallet debit), not OpenAI×markup. */
export const ACTION_PRICE_EUR = {
  chat: 0.02,
  explain: 0.02,
  agent: 0.1,
};

/** Local PDF search used by chat — allowed at chat price. */
export const CHAT_ALLOWED_TOOL_NAMES = new Set(["search_document"]);

/** Hosted-credit model allowlist (override with OPENAI_WALLET_MODELS). */
export const DEFAULT_WALLET_MODELS = ["gpt-5.4-nano", "gpt-5.4-mini"];

/** Cap hosted Responses max_output_tokens (chat uses 4096; agent up to 8192). */
export const WALLET_MAX_OUTPUT_TOKENS = 8192;

/** Max serialized JSON body size for hosted-credit proxy calls. */
export const WALLET_MAX_BODY_BYTES = 256_000;

/** Soft per-user wallet request budget (in-memory; best-effort on serverless). */
export const WALLET_RATE_LIMIT_WINDOW_MS = 60_000;
export const WALLET_RATE_LIMIT_MAX = 30;

export function eurToMicrocents(eur) {
  const n = Number(eur);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * MICROCENT_PER_EUR);
}

export function microcentsToEur(microcents) {
  const n = Number(microcents);
  if (!Number.isFinite(n)) return 0;
  return n / MICROCENT_PER_EUR;
}

export function formatEur(value, { digits = 2 } = {}) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  if (value === 0) return "€0.00";
  if (digits === 2 && value > 0 && value < 0.01) return "<€0.01";
  return `€${value.toFixed(digits)}`;
}

export function formatMicrocentsAsEur(microcents) {
  return formatEur(microcentsToEur(microcents));
}

export function actionPriceMicrocents(action = "chat") {
  const key = String(action || "chat").toLowerCase();
  const eur = ACTION_PRICE_EUR[key] ?? ACTION_PRICE_EUR.chat;
  return eurToMicrocents(eur);
}

function normalizeClaimedAction(claimedAction = "chat") {
  const claimed = String(claimedAction || "chat").trim().toLowerCase();
  if (claimed === "agent" || claimed === "explain" || claimed === "chat") return claimed;
  return "chat";
}

function toolEntries(payload) {
  return Array.isArray(payload?.tools) ? payload.tools : [];
}

function inputItems(payload) {
  const input = payload?.input;
  if (Array.isArray(input)) return input;
  if (input == null) return [];
  return [input];
}

function isAgentTool(tool) {
  if (!tool || typeof tool !== "object") return false;
  const type = String(tool.type || "").toLowerCase();
  if (type === "web_search" || type === "file_search" || type === "code_interpreter" || type === "computer") {
    return true;
  }
  if (type === "function") {
    const name = String(tool.name || "").trim();
    if (!name) return true; // unnamed function tools are not chat's search_document
    return !CHAT_ALLOWED_TOOL_NAMES.has(name);
  }
  // Any other built-in / unknown tool type → agent tier
  if (type && type !== "function") return true;
  return false;
}

function inputLooksLikeAgent(items) {
  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    const type = String(item.type || "").toLowerCase();
    if (
      type === "web_search_call" ||
      type === "file_search_call" ||
      type === "code_interpreter_call" ||
      type === "computer_call" ||
      type === "computer_call_output"
    ) {
      return true;
    }
    if (type === "function_call" || type === "function_call_output") {
      const name = String(item.name || "").trim();
      // Continuations often omit name on function_call_output; treat as agent unless
      // tools on the same request are chat-only (handled by caller).
      if (name && !CHAT_ALLOWED_TOOL_NAMES.has(name)) return true;
      if (type === "function_call" && name && !CHAT_ALLOWED_TOOL_NAMES.has(name)) return true;
    }
  }
  return false;
}

/**
 * True when the Responses payload is agent-tier work (web search, remote fetch,
 * tool-less previous_response continuations, etc.). Chat may use search_document
 * + previous_response_id at chat price.
 */
export function payloadLooksLikeAgent(payload) {
  if (!payload || typeof payload !== "object") return false;

  const tools = toolEntries(payload);
  if (tools.some(isAgentTool)) return true;

  const include = Array.isArray(payload.include) ? payload.include : [];
  if (include.some((entry) => /web_search|file_search|code_interpreter/i.test(String(entry || "")))) {
    return true;
  }

  const hasPrevious = Boolean(payload.previous_response_id);
  const hasTools = tools.length > 0;
  // Agent finalize passes omit tools but keep previous_response_id. Honest chat
  // continuations always resend search_document in tools.
  if (hasPrevious && !hasTools) return true;

  if (inputLooksLikeAgent(inputItems(payload))) {
    const items = inputItems(payload);
    const hasNamedNonChatTool = items.some((item) => {
      const name = String(item?.name || "").trim();
      return Boolean(name) && !CHAT_ALLOWED_TOOL_NAMES.has(name);
    });
    if (hasNamedNonChatTool) return true;

    // Unnamed function_call_output is OK only when tools are exclusively chat-allowed.
    const onlyChatTools =
      hasTools &&
      tools.every((tool) => {
        if (!tool || typeof tool !== "object") return false;
        return (
          String(tool.type || "").toLowerCase() === "function" &&
          CHAT_ALLOWED_TOOL_NAMES.has(String(tool.name || "").trim())
        );
      });
    if (!onlyChatTools) return true;
  }

  return false;
}

/**
 * Billable action for hosted wallet. Never trust the client alone.
 * Claiming agent always pays agent; agent-shaped payloads upgrade chat/explain.
 * @param {string} claimedAction
 * @param {object|null} payload
 * @param {{ parentAction?: string|null }} [context] - prior response tier from server store
 */
export function resolveBillableAction(claimedAction = "chat", payload = null, context = null) {
  const normalized = normalizeClaimedAction(claimedAction);
  const parent = normalizeClaimedAction(context?.parentAction || "chat");
  if (normalized === "agent" || parent === "agent") return "agent";
  if (payloadLooksLikeAgent(payload)) return "agent";
  if (parent === "explain" && normalized === "chat") return "explain";
  return normalized;
}

/** Prefer the higher-priced of two actions. */
export function maxBillableAction(a, b) {
  const rank = { chat: 1, explain: 1, agent: 2 };
  const left = normalizeClaimedAction(a);
  const right = normalizeClaimedAction(b);
  return (rank[right] || 0) > (rank[left] || 0) ? right : left;
}

/** Match allowlisted model ids and dated snapshots (e.g. gpt-5.4-mini-2025-xx). */
export function isWalletModelAllowed(modelName, allowedList = DEFAULT_WALLET_MODELS) {
  const requested = String(modelName || "").trim().toLowerCase();
  if (!requested) return false;
  const allowed = (allowedList || []).map((m) => String(m || "").trim().toLowerCase()).filter(Boolean);
  if (!allowed.length) return false;
  return allowed.some((key) => requested === key || requested.startsWith(`${key}-`));
}

export function parseWalletModelAllowlist(raw) {
  const list = String(raw || "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  return list.length ? list : [...DEFAULT_WALLET_MODELS];
}

export function clampWalletMaxOutputTokens(value, cap = WALLET_MAX_OUTPUT_TOKENS) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return Math.min(4096, cap);
  return Math.min(Math.floor(n), cap);
}

/** Treat OpenAI USD cost as EUR 1:1 for subsidy tracking (hobby). */
export function usdCostToMicrocents(usd) {
  const n = Number(usd);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return eurToMicrocents(n);
}
