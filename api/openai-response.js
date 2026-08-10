import {
  actionPriceMicrocents,
  clampWalletMaxOutputTokens,
  isWalletModelAllowed,
  parseWalletModelAllowlist,
  resolveBillableAction,
  shouldSkipWalletDebitForContinuation,
  usdCostToMicrocents,
  WALLET_MAX_BODY_BYTES,
  WALLET_RATE_LIMIT_MAX,
  WALLET_RATE_LIMIT_WINDOW_MS,
} from "../src/walletCredits.js";
import { addUsageTotals, createUsageTotals, getUsageBreakdown } from "../src/openaiPricing.js";
import {
  annotateWalletDebitForProxy,
  debitWalletForProxy,
  getUserFromAccessToken,
  getWalletProxyResponseTier,
  isSupabaseAdminConfigured,
  recordWalletProxyResponseTier,
  refundWalletForProxy,
} from "./supabaseAdmin.js";

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";

/** Best-effort in-memory rate limit (per isolate). */
const walletRateBuckets = new Map();

function walletModelAllowlist() {
  return parseWalletModelAllowlist(process.env.OPENAI_WALLET_MODELS || "");
}

function allowWalletRequest(userId) {
  const key = String(userId || "");
  if (!key) return false;
  const now = Date.now();
  let bucket = walletRateBuckets.get(key);
  if (!bucket || now - bucket.windowStart >= WALLET_RATE_LIMIT_WINDOW_MS) {
    bucket = { windowStart: now, count: 0 };
    walletRateBuckets.set(key, bucket);
  }
  if (bucket.count >= WALLET_RATE_LIMIT_MAX) return false;
  bucket.count += 1;
  return true;
}

function jsonPayloadByteLength(payload) {
  try {
    return new TextEncoder().encode(JSON.stringify(payload)).length;
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

function json(body, init = {}) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      "cache-control": "no-store",
      "content-type": "application/json; charset=utf-8",
      ...(init.headers || {}),
    },
  });
}

function bearerToken(request) {
  const raw = String(request.headers.get("authorization") || "").trim();
  const match = /^Bearer\s+(.+)$/i.exec(raw);
  return match ? match[1].trim() : "";
}

function resolveClientApiKey(request) {
  return String(request.headers.get("x-openai-api-key") || "").trim();
}

function resolveServerApiKey() {
  return String(process.env.OPENAI_API_KEY || "").trim();
}

function claimedActionFromHeader(request) {
  const raw = String(request.headers.get("x-paperview-action") || "chat").trim().toLowerCase();
  if (raw === "agent" || raw === "explain" || raw === "chat") return raw;
  return "chat";
}

function usageFromOpenAIBody(bodyText, model) {
  try {
    const data = JSON.parse(bodyText);
    const totals = createUsageTotals();
    addUsageTotals(totals, data?.usage);
    return getUsageBreakdown(model || data?.model, totals);
  } catch {
    return null;
  }
}

function openaiResponseIdFromBody(bodyText) {
  try {
    const data = JSON.parse(bodyText);
    const id = String(data?.id || "").trim();
    return id || null;
  } catch {
    return null;
  }
}

function newRequestId(action) {
  // Always use CSPRNG — request ids are security-sensitive (debit/refund idempotency).
  const id = crypto.randomUUID();
  return `proxy:${action}:${id}`;
}

function isInsufficientBalanceError(err) {
  const msg = String(err?.message || "").toLowerCase();
  return msg.includes("insufficient_balance") || err?.code === "P0001";
}

export default {
  async fetch(request) {
    if (request.method !== "POST") {
      return new Response("Method Not Allowed", {
        status: 405,
        headers: {
          Allow: "POST",
          "cache-control": "no-store",
        },
      });
    }

    const clientKey = resolveClientApiKey(request);
    const serverKey = resolveServerApiKey();
    const accessToken = bearerToken(request);
    const claimedAction = claimedActionFromHeader(request);

    let billingMode = "byok";
    let user = null;

    if (clientKey) {
      billingMode = "byok";
    } else if (accessToken && isSupabaseAdminConfigured() && serverKey) {
      user = await getUserFromAccessToken(accessToken);
      if (!user?.id) {
        return json(
          { error: "Sign in expired. Please sign in again, or add your own OpenAI API key." },
          { status: 401 },
        );
      }
      billingMode = "wallet";
    } else if (!clientKey && accessToken && !isSupabaseAdminConfigured()) {
      return json(
        {
          error:
            "Hosted credits are not configured on this server. Add your own OpenAI API key in Settings.",
        },
        { status: 401 },
      );
    } else if (!clientKey) {
      return json(
        {
          error:
            "Sign in with tryout credit, or add your own OpenAI API key in Settings.",
        },
        { status: 401 },
      );
    }

    const apiKey = clientKey || (billingMode === "wallet" ? serverKey : "");
    if (!apiKey) {
      return json(
        {
          error:
            billingMode === "wallet"
              ? "Hosted OpenAI key is not configured on the server (OPENAI_API_KEY)."
              : "No OpenAI API key is configured. Add one in Settings.",
        },
        { status: 401 },
      );
    }

    let payload;
    try {
      payload = await request.json();
    } catch {
      return json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const parentResponseId = String(payload?.previous_response_id || "").trim();
    let parentAction = null;
    let parentTier = null;
    if (billingMode === "wallet" && user?.id && parentResponseId) {
      parentTier = await getWalletProxyResponseTier(user.id, parentResponseId);
      if (parentTier?.found && parentTier.owned === false) {
        return json(
          {
            error: "That conversation continuation is not available on tryout credit.",
            code: "previous_response_not_owned",
          },
          { status: 403 },
        );
      }
      if (parentTier?.found && parentTier.owned) {
        parentAction = parentTier.action || null;
      }
    }

    const action = resolveBillableAction(claimedAction, payload, { parentAction });
    const continuationSkip =
      billingMode === "wallet" &&
      shouldSkipWalletDebitForContinuation({ parentResponseId, parentTier });
    const priceMicrocents = continuationSkip ? 0 : actionPriceMicrocents(action);
    const model = payload?.model || null;
    const requestId = billingMode === "wallet" && !continuationSkip ? newRequestId(action) : null;

    let walletPayload = payload;
    let debitBalance = null;
    if (billingMode === "wallet") {
      if (!allowWalletRequest(user.id)) {
        return json(
          {
            error: "Too many tryout requests. Wait a moment and try again.",
            code: "rate_limited",
          },
          { status: 429 },
        );
      }

      if (payload?.stream === true) {
        return json(
          { error: "Streaming is not supported with tryout credit." },
          { status: 400 },
        );
      }

      const bodyBytes = jsonPayloadByteLength(payload);
      if (bodyBytes > WALLET_MAX_BODY_BYTES) {
        return json(
          {
            error: "Request is too large for tryout credit. Shorten the prompt, or use your own API key.",
            code: "payload_too_large",
            max_body_bytes: WALLET_MAX_BODY_BYTES,
          },
          { status: 413 },
        );
      }

      const allowedModels = walletModelAllowlist();
      if (!isWalletModelAllowed(model, allowedModels)) {
        return json(
          {
            error:
              "That model is not available on tryout credit. Choose a lighter model, or add your own OpenAI API key.",
            code: "wallet_model_not_allowed",
            allowed_models: allowedModels,
          },
          { status: 400 },
        );
      }

      walletPayload = {
        ...payload,
        max_output_tokens: clampWalletMaxOutputTokens(payload?.max_output_tokens),
      };

      if (!continuationSkip) {
        try {
          const debit = await debitWalletForProxy({
            userId: user.id,
            amountMicrocents: priceMicrocents,
            openaiCostMicrocents: 0,
            model,
            requestId,
          });
          debitBalance = debit?.balance_microcents ?? null;
        } catch (debitErr) {
          if (isInsufficientBalanceError(debitErr)) {
            return json(
              {
                error:
                  "Tryout credit is empty. Add your own OpenAI API key in Settings, or ask for more credit.",
                code: "insufficient_balance",
                action_price_microcents: priceMicrocents,
              },
              { status: 402 },
            );
          }
          console.error("wallet debit failed before OpenAI", debitErr);
          return json(
            { error: "Could not reserve tryout credit for this request." },
            { status: 500 },
          );
        }
      }
    }

    try {
      const upstream = await fetch(OPENAI_RESPONSES_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(billingMode === "wallet" ? walletPayload : payload),
      });

      const bodyText = await upstream.text();
      const headers = {
        "cache-control": "no-store",
        "content-type": upstream.headers.get("content-type") || "application/json; charset=utf-8",
      };

      if (billingMode === "wallet" && user?.id) {
        headers["x-paperview-action"] = action;
        headers["x-paperview-action-price-microcents"] = String(priceMicrocents);

        if (continuationSkip) {
          // Covered by the root turn debit — still chain ownership for further rounds.
          if (upstream.ok) {
            const responseId = openaiResponseIdFromBody(bodyText);
            if (responseId) {
              try {
                await recordWalletProxyResponseTier(user.id, responseId, action);
              } catch (tierErr) {
                console.error("wallet response tier record failed", tierErr);
              }
            }
          }
          headers["x-paperview-billed"] = "wallet_continuation";
        } else if (requestId) {
          if (!upstream.ok) {
            try {
              const refund = await refundWalletForProxy({
                userId: user.id,
                amountMicrocents: actionPriceMicrocents(action),
                requestId,
              });
              headers["x-paperview-billed"] = "wallet_refunded";
              if (refund?.balance_microcents != null) {
                headers["x-paperview-balance-microcents"] = String(refund.balance_microcents);
              }
            } catch (refundErr) {
              console.error("wallet refund failed after OpenAI error", refundErr);
              headers["x-paperview-billed"] = "wallet_refund_failed";
              if (debitBalance != null) {
                headers["x-paperview-balance-microcents"] = String(debitBalance);
              }
            }
          } else {
            const breakdown = usageFromOpenAIBody(bodyText, model);
            const openaiCostMicrocents = usdCostToMicrocents(breakdown?.totalCost);
            try {
              await annotateWalletDebitForProxy({
                userId: user.id,
                requestId,
                openaiCostMicrocents,
                model: breakdown?.model || model,
                inputTokens: breakdown?.inputTokens ?? null,
                outputTokens: breakdown?.outputTokens ?? null,
              });
            } catch (annotateErr) {
              // Debit already committed; annotation is ops/subsidy metadata only.
              console.error("wallet debit annotate failed", annotateErr);
            }
            const responseId = openaiResponseIdFromBody(bodyText);
            if (responseId) {
              try {
                await recordWalletProxyResponseTier(user.id, responseId, action);
              } catch (tierErr) {
                console.error("wallet response tier record failed", tierErr);
              }
            }
            headers["x-paperview-billed"] = "wallet";
            if (debitBalance != null) {
              headers["x-paperview-balance-microcents"] = String(debitBalance);
            }
          }
        }
      } else if (billingMode === "byok") {
        headers["x-paperview-billed"] = "byok";
      }

      return new Response(bodyText, {
        status: upstream.status,
        headers,
      });
    } catch (error) {
      console.error("openai-response proxy failed", error);
      if (billingMode === "wallet" && user?.id && requestId) {
        try {
          await refundWalletForProxy({
            userId: user.id,
            amountMicrocents: priceMicrocents,
            requestId,
          });
        } catch (refundErr) {
          console.error("wallet refund failed after proxy exception", refundErr);
        }
      }
      return json(
        {
          error: error?.message || "OpenAI proxy request failed.",
        },
        { status: 500 },
      );
    }
  },
};
