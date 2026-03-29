const MODEL_PRICING = {
  "gpt-5.4": {
    inputPerMillion: 2.5,
    cachedInputPerMillion: 0.25,
    outputPerMillion: 15,
  },
  "gpt-5.4-mini": {
    inputPerMillion: 0.75,
    cachedInputPerMillion: 0.08,
    outputPerMillion: 4.5,
  },
  "gpt-5.4-nano": {
    inputPerMillion: 0.2,
    cachedInputPerMillion: 0.02,
    outputPerMillion: 1.25,
  },
};

export function createUsageTotals() {
  return {
    inputTokens: 0,
    cachedInputTokens: 0,
    outputTokens: 0,
    reasoningTokens: 0,
    totalTokens: 0,
  };
}

export function addUsageTotals(totals, usage) {
  if (!usage || typeof usage !== "object") return totals;

  const next = totals || createUsageTotals();
  next.inputTokens += Number(usage.input_tokens) || 0;
  next.outputTokens += Number(usage.output_tokens) || 0;
  next.totalTokens += Number(usage.total_tokens) || 0;
  next.cachedInputTokens += Number(usage.input_tokens_details?.cached_tokens) || 0;
  next.reasoningTokens += Number(usage.output_tokens_details?.reasoning_tokens) || 0;
  return next;
}

function resolvePricingModel(modelName) {
  const requested = String(modelName || "").trim().toLowerCase();
  if (!requested) return null;
  if (MODEL_PRICING[requested]) return requested;

  const snapshotMatch = Object.keys(MODEL_PRICING).find(
    (key) => requested === key || requested.startsWith(`${key}-`)
  );
  return snapshotMatch || null;
}

export function getUsageBreakdown(modelName, totals) {
  const pricingModel = resolvePricingModel(modelName);
  const pricing = pricingModel ? MODEL_PRICING[pricingModel] : null;
  const inputTokens = Math.max(0, Number(totals?.inputTokens) || 0);
  const cachedInputTokens = Math.min(inputTokens, Math.max(0, Number(totals?.cachedInputTokens) || 0));
  const uncachedInputTokens = Math.max(0, inputTokens - cachedInputTokens);
  const outputTokens = Math.max(0, Number(totals?.outputTokens) || 0);
  const reasoningTokens = Math.max(0, Number(totals?.reasoningTokens) || 0);
  const totalTokens =
    Math.max(0, Number(totals?.totalTokens) || 0) || (inputTokens + outputTokens);

  const inputCost = pricing
    ? ((uncachedInputTokens * pricing.inputPerMillion) + (cachedInputTokens * pricing.cachedInputPerMillion)) / 1_000_000
    : null;
  const outputCost = pricing ? (outputTokens * pricing.outputPerMillion) / 1_000_000 : null;
  const totalCost = inputCost != null && outputCost != null ? inputCost + outputCost : null;

  return {
    model: modelName,
    pricingModel,
    inputTokens,
    cachedInputTokens,
    uncachedInputTokens,
    outputTokens,
    reasoningTokens,
    totalTokens,
    inputCost,
    outputCost,
    totalCost,
  };
}

export function formatTokenCount(value) {
  const count = Math.max(0, Number(value) || 0);
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(count >= 10_000_000 ? 0 : 1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(count >= 10_000 ? 0 : 1)}k`;
  return `${count}`;
}

export function formatUsd(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  if (value === 0) return "$0.00";
  if (value < 0.0001) return "<$0.0001";
  if (value < 0.01) return `$${value.toFixed(4)}`;
  return `$${value.toFixed(2)}`;
}

