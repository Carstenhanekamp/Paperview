import { OPENAI_PROXY_ENDPOINT, REMOTE_PDF_PROXY_ENDPOINT } from './constants';
import { fetchExternal, fetchHostedApi } from './platform/http';
import { isTauri } from './platform/runtime';

// Escape literal newlines/carriage-returns that appear inside JSON string values.
// Models sometimes output unescaped newlines inside strings, making the JSON invalid.
export function sanitizeJsonNewlines(str) {
  let inString = false;
  let escaped = false;
  let result = '';
  for (let i = 0; i < str.length; i++) {
    const c = str[i];
    if (escaped) { result += c; escaped = false; continue; }
    if (c === '\\' && inString) { result += c; escaped = true; continue; }
    if (c === '"') { inString = !inString; result += c; continue; }
    if (inString && c === '\n') { result += '\\n'; continue; }
    if (inString && c === '\r') { result += '\\r'; continue; }
    result += c;
  }
  return result;
}

// Fetch a URL, preferring the app backend and falling back to browser fetches when needed.
export async function fetchWithCorsProxy(url) {
  if (isTauri()) {
    try {
      const directResponse = await fetchExternal(url, {
        headers: { Accept: "application/pdf" },
      });
      if (directResponse.ok) return directResponse;
    } catch {
      // Fall through to the hosted SSRF-protected proxy.
    }
  }

  try {
    const proxyResponse = await fetchHostedApi(`${REMOTE_PDF_PROXY_ENDPOINT}?url=${encodeURIComponent(url)}`, {
      headers: {
        Accept: "application/pdf",
      },
    });
    const proxyContentType = String(proxyResponse.headers.get("content-type") || "").toLowerCase();
    if (proxyResponse.ok && !proxyContentType.includes("text/html")) return proxyResponse;

    const proxyText = await proxyResponse.text();
    const looksLikeAppShell = proxyContentType.includes("text/html") && /<!doctype html|<html/i.test(proxyText);
    if (proxyResponse.ok || !looksLikeAppShell) {
      // Fall through to browser-based fetches if the backend proxy is unavailable or the remote fetch failed.
    }
  } catch {
    // Fall back to browser-based fetches below.
  }

  let directError = null;
  try {
    const res = await fetchExternal(url);
    if (res.ok) return res;
    // Non-2xx but not a CORS block — throw so the proxy isn't used needlessly
    directError = new Error(`Remote PDF download failed (${res.status}).`);
  } catch (err) {
    // TypeError ("Failed to fetch") is how browsers surface CORS blocks
    directError = err;
  }
  const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(url)}`;
  const res = await fetchExternal(proxyUrl);
  if (!res.ok) throw directError || new Error(`Remote PDF download failed (${res.status}).`);
  return res;
}

export function extractOutputTextPart(part) {
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

export function formatSearchToolResult(paper, query, passages) {
  if (!passages.length) {
    return [
      `Document: "${paper.name}"`,
      `Search query: "${query}"`,
      "No relevant passages were found for this query.",
    ].join("\n");
  }

  return [
    `Document: "${paper.name}"`,
    `Search query: "${query}"`,
    "Retrieved passages:",
    ...passages.map(({ page, text }) => `--- Page ${page} ---\n${text}`),
  ].join("\n\n");
}

export function extractWebSearchSources(data) {
  const sources = [];
  for (const item of data?.output || []) {
    if (item?.type !== "web_search_call") continue;
    const nextSources = item?.action?.sources;
    if (Array.isArray(nextSources)) {
      sources.push(...nextSources);
    }
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

function parseProxyError(bodyText, fallback) {
  try {
    const parsed = JSON.parse(bodyText);
    if (parsed?.error?.message) return parsed.error.message;
    if (typeof parsed?.error === "string") return parsed.error;
    if (typeof parsed?.message === "string") return parsed.message;
  } catch {
    /* ignore */
  }
  return bodyText || fallback || "OpenAI request failed";
}

/**
 * @param {string} apiKey - optional BYOK key
 * @param {object} payload - OpenAI Responses body
 * @param {object} [options]
 * @param {AbortSignal} [options.signal]
 * @param {boolean} [options.preferWallet] - use hosted tryout credit first when signed in
 * @param {string} [options.accessToken] - Supabase access token (fetched if missing and preferWallet)
 * @param {'chat'|'explain'|'agent'} [options.action]
 * @param {(info: { balanceMicrocents?: number, billed?: string, actionPriceMicrocents?: number }) => void} [options.onBilling]
 */
export async function requestOpenAIResponse(apiKey, payload, options = {}) {
  const {
    signal,
    preferWallet = false,
    action = "chat",
    onBilling,
  } = options;
  let accessToken = options.accessToken || null;

  if (preferWallet && !accessToken) {
    try {
      const { getSupabaseAsync } = await import("./supabaseClient.js");
      const supabase = await getSupabaseAsync();
      if (supabase) {
        const { data } = await supabase.auth.getSession();
        accessToken = data?.session?.access_token || null;
      }
    } catch {
      accessToken = null;
    }
  }

  const tryWalletFirst = Boolean(preferWallet && accessToken);

  const callProxy = async ({ withWallet, withKey }) => {
    const proxyHeaders = {
      "Content-Type": "application/json",
    };
    if (withWallet && accessToken) {
      proxyHeaders.Authorization = `Bearer ${accessToken}`;
      proxyHeaders["x-paperview-action"] = action;
    }
    if (withKey && apiKey) {
      proxyHeaders["x-openai-api-key"] = apiKey;
    }

    const proxyResponse = await fetchHostedApi(OPENAI_PROXY_ENDPOINT, {
      method: "POST",
      headers: proxyHeaders,
      body: JSON.stringify(payload),
      signal,
    });
    const proxyContentType = String(proxyResponse.headers.get("content-type") || "").toLowerCase();
    const proxyBody = await proxyResponse.text();
    const looksLikeAppShell = proxyContentType.includes("text/html") && /<!doctype html|<html/i.test(proxyBody);

    const balanceHeader = proxyResponse.headers.get("x-paperview-balance-microcents");
    const billed = proxyResponse.headers.get("x-paperview-billed");
    const priceHeader = proxyResponse.headers.get("x-paperview-action-price-microcents");
    if (typeof onBilling === "function") {
      onBilling({
        billed: billed || undefined,
        balanceMicrocents: balanceHeader != null ? Number(balanceHeader) : undefined,
        actionPriceMicrocents: priceHeader != null ? Number(priceHeader) : undefined,
        status: proxyResponse.status,
      });
    }

    return { proxyResponse, proxyBody, looksLikeAppShell };
  };

  if (tryWalletFirst) {
    try {
      const { proxyResponse, proxyBody, looksLikeAppShell } = await callProxy({
        withWallet: true,
        withKey: false,
      });

      if (proxyResponse.ok && !looksLikeAppShell) {
        return JSON.parse(proxyBody);
      }

      if (!looksLikeAppShell && proxyResponse.status === 402 && apiKey) {
        // Credit empty — fall through to BYOK
      } else if (!looksLikeAppShell) {
        if (!apiKey || (proxyResponse.status !== 401 && proxyResponse.status !== 402)) {
          throw new Error(parseProxyError(proxyBody, "OpenAI request failed"));
        }
      }
    } catch (err) {
      if (!apiKey) {
        if (err instanceof TypeError) {
          throw new Error(
            "No OpenAI API key is configured. Add one in Settings or use tryout credit while signed in.",
          );
        }
        throw err;
      }
    }
  }

  try {
    const { proxyResponse, proxyBody, looksLikeAppShell } = await callProxy({
      withWallet: false,
      withKey: Boolean(apiKey),
    });

    if (proxyResponse.ok && !looksLikeAppShell) {
      return JSON.parse(proxyBody);
    }

    if (!looksLikeAppShell) {
      if (!apiKey) {
        throw new Error(parseProxyError(proxyBody, "OpenAI request failed"));
      }
    }
  } catch (err) {
    if (!apiKey) {
      if (err instanceof TypeError) {
        throw new Error(
          "No OpenAI API key is configured. Add one in Settings or use tryout credit while signed in.",
        );
      }
      throw err;
    }
  }

  if (!apiKey) {
    throw new Error(
      "No OpenAI API key is configured. Add one in Settings or use tryout credit while signed in.",
    );
  }

  const res = await fetchExternal("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
    signal,
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(parseProxyError(errText, "OpenAI request failed"));
  }

  return res.json();
}
