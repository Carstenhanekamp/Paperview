// LLM provider abstraction: OpenAI Responses API (unchanged) + Ollama Chat Completions.
// All callers receive a Responses-API-shaped object regardless of provider.

export const PROVIDERS = { OPENAI: "openai", LOCAL: "local" };

const ENV_PROVIDER = import.meta.env.VITE_PROVIDER || "openai";
const ENV_OLLAMA_BASE_URL = import.meta.env.VITE_OLLAMA_BASE_URL || "http://localhost:11434";
const ENV_OLLAMA_MODEL = import.meta.env.VITE_OLLAMA_MODEL || "gemma4:12b";
const OPENAI_PROXY_ENDPOINT = "/api/openai-response";

export function getProviderConfig() {
  return {
    provider: localStorage.getItem("pv-provider") || ENV_PROVIDER,
    ollamaBaseUrl: localStorage.getItem("pv-ollama-url") || ENV_OLLAMA_BASE_URL,
    ollamaModel: ENV_OLLAMA_MODEL,
  };
}

// ─── Response-shape parsing (moved from PaperviewApp.jsx) ────────────────────
// These helpers parse the OpenAI Responses API output[] shape. The Ollama
// adapter normalises its responses into this same shape, so all call sites
// and UI components remain untouched.

function extractOutputTextPart(part) {
  if (!part || typeof part !== "object") return "";
  if (typeof part.text === "string") return part.text.trim();
  if (typeof part.value === "string") return part.value.trim();
  if (typeof part?.text?.value === "string") return part.text.value.trim();
  if (typeof part?.value?.text === "string") return part.value.text.trim();
  return "";
}

export function extractResponseOutputText(data) {
  const chunks = [];
  const seen = new Set();

  if (typeof data?.output_text === "string" && data.output_text.trim()) {
    const text = data.output_text.trim();
    chunks.push(text);
    seen.add(text);
  }

  for (const item of data?.output || []) {
    if (!Array.isArray(item?.content)) continue;
    for (const part of item.content) {
      if ((part?.type === "output_text" || part?.type === "text") && extractOutputTextPart(part)) {
        const text = extractOutputTextPart(part);
        if (!seen.has(text)) {
          chunks.push(text);
          seen.add(text);
        }
      }
    }
  }

  return chunks.join("\n").trim();
}

export function extractFunctionCalls(data) {
  return (data?.output || []).filter((item) => item?.type === "function_call" && item?.name);
}

export function extractWebSearchSources(data) {
  const sources = [];
  for (const item of data?.output || []) {
    if (item?.type !== "web_search_call") continue;
    const nextSources = item?.action?.sources;
    if (Array.isArray(nextSources)) sources.push(...nextSources);
  }
  return sources;
}

export function extractReasoningSummary(data) {
  const texts = [];
  for (const item of data?.output || []) {
    if (item?.type === "reasoning" && Array.isArray(item.summary)) {
      for (const s of item.summary) {
        if (s?.type === "summary_text" && typeof s.text === "string" && s.text.trim()) {
          texts.push(s.text.trim());
        }
      }
    }
  }
  return texts.join("\n\n").trim();
}

export function isResponseIncompleteForMaxOutput(data) {
  return data?.status === "incomplete" && data?.incomplete_details?.reason === "max_output_tokens";
}

// ─── OpenAI adapter (unchanged behaviour) ────────────────────────────────────

async function requestOpenAIResponse(apiKey, payload, options = {}) {
  const { signal } = options;
  try {
    const proxyHeaders = { "Content-Type": "application/json" };
    if (apiKey) proxyHeaders["x-openai-api-key"] = apiKey;

    const proxyResponse = await fetch(OPENAI_PROXY_ENDPOINT, {
      method: "POST",
      headers: proxyHeaders,
      body: JSON.stringify(payload),
      signal,
    });
    const proxyContentType = String(proxyResponse.headers.get("content-type") || "").toLowerCase();
    const proxyBody = await proxyResponse.text();
    const looksLikeAppShell = proxyContentType.includes("text/html") && /<!doctype html|<html/i.test(proxyBody);

    if (proxyResponse.ok && !looksLikeAppShell) return JSON.parse(proxyBody);
    if (!looksLikeAppShell && !apiKey) throw new Error(proxyBody || "OpenAI request failed");
  } catch (err) {
    if (!apiKey) {
      if (err instanceof TypeError) throw new Error("No OpenAI API key configured. Add one in Settings or set OPENAI_API_KEY on the backend.");
      throw err;
    }
  }

  if (!apiKey) throw new Error("No OpenAI API key configured. Add one in Settings or set OPENAI_API_KEY on the backend.");

  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(payload),
    signal,
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(errText || "OpenAI request failed");
  }

  return res.json();
}

// ─── Ollama adapter ───────────────────────────────────────────────────────────

// In-memory conversation store: synthetic response id → message array.
// Allows stateless Chat Completions to emulate Responses API's previous_response_id.
const conversationStore = new Map();
const MAX_STORE_ENTRIES = 20;

function makeSyntheticId() {
  return `ollama-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function loadConversation(previousResponseId) {
  return previousResponseId ? (conversationStore.get(previousResponseId) ?? null) : null;
}

function saveConversation(id, messages) {
  if (conversationStore.size >= MAX_STORE_ENTRIES) {
    conversationStore.delete(conversationStore.keys().next().value);
  }
  conversationStore.set(id, messages);
}

// Convert a Responses-API input item to a Chat Completions message.
function inputItemToMessage(item) {
  if (item.type === "function_call_output") {
    return { role: "tool", tool_call_id: item.call_id, content: String(item.output || "") };
  }
  return { role: item.role === "ai" ? "assistant" : item.role, content: item.content };
}

// Build the Chat Completions messages array from a Responses-API payload.
// When a stored conversation exists (continuation), its system message is
// replaced if the new payload provides instructions (e.g. finalisation pass).
function buildMessages(payload, stored) {
  let systemContent = String(payload.instructions || "").trim();
  if (payload.reasoning?.effort) {
    systemContent += `\n\nReasoning effort: ${payload.reasoning.effort}. Think step by step inside <think>...</think> tags before providing your final answer.`;
  }

  const newInputMessages = (payload.input || []).map(inputItemToMessage);

  if (stored) {
    if (systemContent) {
      // Replace system message with updated instructions (handles finalisation pass)
      const withoutSystem = stored.filter(m => m.role !== "system");
      return [{ role: "system", content: systemContent }, ...withoutSystem, ...newInputMessages];
    }
    return [...stored, ...newInputMessages];
  }

  const fresh = [];
  if (systemContent) fresh.push({ role: "system", content: systemContent });
  fresh.push(...newInputMessages);
  return fresh;
}

// Translate Responses-API tool definitions → Chat Completions format.
// web_search tools are omitted (not supported locally in this phase).
function convertTools(tools) {
  if (!tools?.length) return [];
  return tools
    .filter(t => t.type === "function")
    .map(t => ({ type: "function", function: { name: t.name, description: t.description, parameters: t.parameters } }));
}

// Longest suffix of `text` that is a proper prefix of `tag`. Used to detect a
// tag (e.g. "<think>") that may be split across SSE chunk boundaries.
function partialTagSuffixLen(text, tag) {
  const max = Math.min(text.length, tag.length - 1);
  for (let len = max; len > 0; len -= 1) {
    if (text.endsWith(tag.slice(0, len))) return len;
  }
  return 0;
}

// Parse an SSE stream from Ollama, calling onChunk for each token.
// Returns the assembled content, think text, tool calls, finish reason, and usage.
async function consumeStream(response, onChunk) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  let sseBuffer = "";
  let rawContent = "";   // full content including <think> tags
  let thinkBuffer = "";
  let answerBuffer = "";
  let inThink = false;
  // pending: characters received but not yet classified (straddle across chunks)
  let pending = "";
  const toolCallsMap = {};
  let finishReason = null;
  let usageData = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    sseBuffer += decoder.decode(value, { stream: true });

    const lines = sseBuffer.split("\n");
    sseBuffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const json = line.slice(6).trim();
      if (json === "[DONE]") continue;

      let chunk;
      try { chunk = JSON.parse(json); } catch { continue; }

      const choice = chunk.choices?.[0];
      if (!choice) { if (chunk.usage) usageData = chunk.usage; continue; }
      if (choice.finish_reason) finishReason = choice.finish_reason;
      if (chunk.usage) usageData = chunk.usage;

      const delta = choice.delta;
      if (!delta) continue;

      // ── content tokens ──
      if (typeof delta.content === "string" && delta.content) {
        rawContent += delta.content;
        pending += delta.content;

        // Classify as much of pending as is unambiguous, retaining a trailing
        // fragment that could be the start of a tag split across SSE chunks.
        let progress = true;
        while (progress) {
          progress = false;
          if (!inThink) {
            const open = pending.indexOf("<think>");
            if (open !== -1) {
              const before = pending.slice(0, open);
              if (before) { answerBuffer += before; onChunk?.({ type: "text", token: before }); }
              pending = pending.slice(open + 7); // skip "<think>"
              inThink = true;
              progress = true;
            } else {
              const keep = partialTagSuffixLen(pending, "<think>");
              const emit = pending.slice(0, pending.length - keep);
              if (emit) { answerBuffer += emit; onChunk?.({ type: "text", token: emit }); }
              pending = pending.slice(pending.length - keep);
            }
          } else {
            const close = pending.indexOf("</think>");
            if (close !== -1) {
              const inside = pending.slice(0, close);
              if (inside) { thinkBuffer += inside; onChunk?.({ type: "thinking", token: inside }); }
              onChunk?.({ type: "thinking_done" });
              pending = pending.slice(close + 8); // skip "</think>"
              inThink = false;
              progress = true;
            } else {
              const keep = partialTagSuffixLen(pending, "</think>");
              const emit = pending.slice(0, pending.length - keep);
              if (emit) { thinkBuffer += emit; onChunk?.({ type: "thinking", token: emit }); }
              pending = pending.slice(pending.length - keep);
            }
          }
        }
      }

      // ── tool call deltas ──
      for (const tc of delta.tool_calls ?? []) {
        const idx = tc.index ?? 0;
        if (!toolCallsMap[idx]) toolCallsMap[idx] = { id: "", name: "", arguments: "" };
        if (tc.id) toolCallsMap[idx].id = tc.id;
        if (tc.function?.name) toolCallsMap[idx].name += tc.function.name;
        if (tc.function?.arguments) toolCallsMap[idx].arguments += tc.function.arguments;
      }
    }
  }

  // Flush any trailing fragment that never resolved into a complete tag.
  if (pending) {
    if (inThink) { thinkBuffer += pending; onChunk?.({ type: "thinking", token: pending }); }
    else { answerBuffer += pending; onChunk?.({ type: "text", token: pending }); }
    pending = "";
  }

  const toolCalls = Object.values(toolCallsMap)
    .filter(tc => tc.name)
    .map(tc => ({ id: tc.id || makeSyntheticId(), type: "function", function: { name: tc.name, arguments: tc.arguments } }));

  return { rawContent, thinkBuffer, answerBuffer, toolCalls, finishReason, usageData };
}

// Build a Responses-API-shaped response object from assembled stream data.
function buildNormalizedResponse(syntheticId, thinkBuffer, answerBuffer, toolCalls, finishReason, usageData) {
  const output = [];

  if (thinkBuffer.trim()) {
    output.push({ type: "reasoning", summary: [{ type: "summary_text", text: thinkBuffer.trim() }] });
  }

  const answerText = answerBuffer.trim();
  if (answerText) {
    output.push({ type: "output_text", content: [{ type: "output_text", text: answerText }] });
  }

  for (const tc of toolCalls) {
    output.push({ type: "function_call", name: tc.function.name, call_id: tc.id, arguments: tc.function.arguments });
  }

  const normalized = {
    id: syntheticId,
    output,
    output_text: answerText,
    usage: {
      input_tokens: usageData?.prompt_tokens ?? 0,
      output_tokens: usageData?.completion_tokens ?? 0,
      total_tokens: usageData?.total_tokens ?? 0,
    },
  };

  if (finishReason === "length") {
    normalized.status = "incomplete";
    normalized.incomplete_details = { reason: "max_output_tokens" };
  }

  return normalized;
}

async function requestOllamaResponse(payload, options = {}) {
  const { signal, onChunk } = options;
  const config = getProviderConfig();
  const baseUrl = config.ollamaBaseUrl.replace(/\/$/, "");

  const stored = loadConversation(payload.previous_response_id);
  const messages = buildMessages(payload, stored);
  const tools = convertTools(payload.tools);

  const body = {
    model: payload.model,
    messages,
    stream: true,
    ...(payload.max_output_tokens ? { max_tokens: payload.max_output_tokens } : {}),
    ...(tools.length ? { tools, tool_choice: "auto" } : {}),
    // Omit format:"json" — JSON mode conflicts with <think> prefixes.
    // System prompt already instructs JSON output; the existing extraction
    // code handles it robustly.
  };

  const response = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(errText || `Ollama request failed (${response.status}). Is Ollama running and OLLAMA_ORIGINS configured?`);
  }

  const syntheticId = makeSyntheticId();
  const { rawContent, thinkBuffer, answerBuffer, toolCalls, finishReason, usageData } =
    await consumeStream(response, onChunk);

  // Store conversation for the next continuation
  const assistantMsg = {
    role: "assistant",
    content: rawContent,
    ...(toolCalls.length ? { tool_calls: toolCalls } : {}),
  };
  saveConversation(syntheticId, [...messages, assistantMsg]);

  return buildNormalizedResponse(syntheticId, thinkBuffer, answerBuffer, toolCalls, finishReason, usageData);
}

// ─── Public router ────────────────────────────────────────────────────────────

export async function requestModelResponse(payload, options = {}) {
  const { provider } = getProviderConfig();
  if (provider === PROVIDERS.LOCAL) {
    return requestOllamaResponse(payload, options);
  }
  return requestOpenAIResponse(options.apiKey, payload, options);
}
