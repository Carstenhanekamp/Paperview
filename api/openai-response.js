import {
  actionPriceMicrocents,
  clampWalletMaxOutputTokens,
  continuationRoundsForAction,
  findDisallowedWalletTool,
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

      // Fail closed. All wallet users share one server OpenAI key, so every
      // response lives in the same org and `previous_response_id` from another
      // user would otherwise be a valid handle onto their conversation. This
      // table is the only thing enforcing that boundary — if we cannot read it,
      // we must not forward the id.
      if (!parentTier) {
        return json(
          {
            error: "Could not verify that conversation. Try again in a moment.",
            code: "previous_response_unverified",
          },
          { status: 503 },
        );
      }
      if (parentTier.found !== true || parentTier.owned !== true) {
        return json(
          {
            error: "That conversation continuation is not available on tryout credit.",
            code: "previous_response_not_owned",
          },
          { status: 403 },
        );
      }
      parentAction = parentTier.action || null;
    }

    const action = resolveBillableAction(claimedAction, payload, { parentAction });
    const continuationSkip =
      billingMode === "wallet" &&
      shouldSkipWalletDebitForContinuation({ parentResponseId, parentTier, action });
    const priceMicrocents = continuationSkip ? 0 : actionPriceMicrocents(action);
    const model = payload?.model || null;
    const requestId = billingMode === "wallet" && !continuationSkip ? newRequestId(action) : null;

    // A free round spends one unit of the root turn's budget and inherits its
    // root id; a billed turn opens a fresh budget. Either way the chain is
    // bounded, so one debit can never fund unlimited requests.
    const rootRequestId = continuationSkip ? parentTier?.rootRequestId || null : requestId;
    const roundsRemaining = continuationSkip
      ? Math.max(0, Number(parentTier?.roundsRemaining || 0) - 1)
      : continuationRoundsForAction(action);

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

      const badTool = findDisallowedWalletTool(payload);
      if (badTool) {
        return json(
          {
            error:
              "That tool is not available on tryout credit. Add your own OpenAI API key to use it.",
            code: "wallet_tool_not_allowed",
            tool: badTool.type,
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

      // Claim ownership of the new response and carry the remaining budget onto
      // it. Best-effort: the debit is already committed, so a failure here must
      // not cost the user their answer. The lookup above fails closed, so an
      // unrecorded response simply cannot be continued.
      const recordTier = async () => {
        if (!upstream.ok) return;
        const responseId = openaiResponseIdFromBody(bodyText);
        if (!responseId) return;
        try {
          await recordWalletProxyResponseTier(user.id, responseId, action, {
            rootRequestId,
            roundsRemaining,
          });
        } catch (tierErr) {
          console.error("wallet response tier record failed", tierErr);
        }
      };

      if (billingMode === "wallet" && user?.id) {
        headers["x-paperview-action"] = action;
        headers["x-paperview-action-price-microcents"] = String(priceMicrocents);
        headers["x-paperview-continuation-rounds-remaining"] = String(roundsRemaining);

        if (continuationSkip) {
          // Covered by the root turn debit — still chain ownership for further rounds.
          await recordTier();
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
            await recordTier();
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
      // Detail stays in the log — the message can carry internal proxy and
      // Supabase failure text that the client has no business seeing.
      return json({ error: "OpenAI proxy request failed." }, { status: 500 });
    }
  },
};
