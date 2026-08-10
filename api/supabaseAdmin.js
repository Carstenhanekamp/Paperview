/**
 * Server-side Supabase helpers for the OpenAI proxy (service role + user JWT).
 * Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY),
 * and VITE_SUPABASE_ANON_KEY / SUPABASE_ANON_KEY for Auth user lookup.
 */

function env(name) {
  return String(process.env[name] || "").trim();
}

export function getSupabaseConfig() {
  const url = env("SUPABASE_URL") || env("VITE_SUPABASE_URL");
  const serviceKey =
    env("SUPABASE_SERVICE_ROLE_KEY") ||
    env("SUPABASE_SECRET_KEY") ||
    env("SUPABASE_SERVICE_KEY");
  const anonKey =
    env("SUPABASE_ANON_KEY") ||
    env("VITE_SUPABASE_ANON_KEY") ||
    env("VITE_SUPABASE_PUBLISHABLE_KEY");
  return { url, serviceKey, anonKey };
}

export function isSupabaseAdminConfigured() {
  const { url, serviceKey } = getSupabaseConfig();
  return Boolean(url && serviceKey);
}

async function rpc(fnName, body) {
  const { url, serviceKey } = getSupabaseConfig();
  if (!url || !serviceKey) {
    throw new Error("Supabase service role is not configured on the server.");
  }

  const res = await fetch(`${url.replace(/\/$/, "")}/rest/v1/rpc/${fnName}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      apikey: serviceKey,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(body),
  });

  const bodyText = await res.text();
  let parsed = null;
  try {
    parsed = bodyText ? JSON.parse(bodyText) : null;
  } catch {
    parsed = null;
  }

  if (!res.ok) {
    const message =
      parsed?.message ||
      parsed?.error?.message ||
      parsed?.error ||
      bodyText ||
      `${fnName} failed`;
    const err = new Error(typeof message === "string" ? message : `${fnName} failed`);
    err.status = res.status;
    err.code = parsed?.code || parsed?.error?.code;
    err.rpc = fnName;
    throw err;
  }

  return parsed;
}

/**
 * Validate a user access token. Returns { id, email } or null.
 */
export async function getUserFromAccessToken(accessToken) {
  const token = String(accessToken || "").trim();
  if (!token) return null;
  const { url, anonKey, serviceKey } = getSupabaseConfig();
  if (!url) return null;
  const apikey = anonKey || serviceKey;
  if (!apikey) return null;

  const res = await fetch(`${url.replace(/\/$/, "")}/auth/v1/user`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      apikey,
    },
  });
  if (!res.ok) return null;
  const data = await res.json();
  const id = data?.id;
  if (!id) return null;
  return { id, email: data?.email || "" };
}

export async function getWalletBalanceMicrocents(userId) {
  const { url, serviceKey } = getSupabaseConfig();
  if (!url || !serviceKey || !userId) return null;

  const res = await fetch(
    `${url.replace(/\/$/, "")}/rest/v1/wallets?user_id=eq.${encodeURIComponent(userId)}&select=balance_microcents`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        apikey: serviceKey,
        Accept: "application/json",
      },
    },
  );
  if (!res.ok) return null;
  const rows = await res.json();
  if (!Array.isArray(rows) || !rows.length) return 0;
  return Number(rows[0].balance_microcents) || 0;
}

export async function debitWalletForProxy({
  userId,
  amountMicrocents,
  openaiCostMicrocents = 0,
  model = null,
  inputTokens = null,
  outputTokens = null,
  requestId = null,
}) {
  return rpc("debit_wallet_for_proxy", {
    p_user_id: userId,
    p_amount_microcents: amountMicrocents,
    p_openai_cost_microcents: openaiCostMicrocents,
    p_model: model,
    p_input_tokens: inputTokens,
    p_output_tokens: outputTokens,
    p_request_id: requestId,
  });
}

export async function refundWalletForProxy({ userId, amountMicrocents, requestId }) {
  return rpc("refund_wallet_for_proxy", {
    p_user_id: userId,
    p_amount_microcents: amountMicrocents,
    p_request_id: requestId,
  });
}

export async function annotateWalletDebitForProxy({
  userId,
  requestId,
  openaiCostMicrocents = 0,
  model = null,
  inputTokens = null,
  outputTokens = null,
}) {
  return rpc("annotate_wallet_debit_for_proxy", {
    p_user_id: userId,
    p_request_id: requestId,
    p_openai_cost_microcents: openaiCostMicrocents,
    p_model: model,
    p_input_tokens: inputTokens,
    p_output_tokens: outputTokens,
  });
}

export async function getWalletProxyResponseAction(userId, responseId) {
  const id = String(responseId || "").trim();
  if (!userId || !id) return null;
  try {
    const action = await rpc("get_wallet_proxy_response_action", {
      p_user_id: userId,
      p_response_id: id,
    });
    return typeof action === "string" && action ? action : null;
  } catch {
    return null;
  }
}

/**
 * @returns {Promise<{ found: boolean, owned?: boolean, action?: string }|null>}
 */
export async function getWalletProxyResponseTier(userId, responseId) {
  const id = String(responseId || "").trim();
  if (!userId || !id) return null;
  try {
    const row = await rpc("get_wallet_proxy_response_tier", {
      p_user_id: userId,
      p_response_id: id,
    });
    if (!row || typeof row !== "object") return { found: false };
    return {
      found: Boolean(row.found),
      owned: row.owned === true,
      action: typeof row.action === "string" ? row.action : undefined,
    };
  } catch {
    return null;
  }
}

export async function recordWalletProxyResponseTier(userId, responseId, action) {
  const id = String(responseId || "").trim();
  if (!userId || !id || !action) return;
  await rpc("record_wallet_proxy_response_tier", {
    p_user_id: userId,
    p_response_id: id,
    p_action: action,
  });
}
