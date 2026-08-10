import { describe, expect, it } from 'vitest';
import {
  ACTION_PRICE_EUR,
  actionPriceMicrocents,
  clampWalletMaxOutputTokens,
  eurToMicrocents,
  formatEur,
  formatMicrocentsAsEur,
  isWalletModelAllowed,
  microcentsToEur,
  payloadLooksLikeAgent,
  resolveBillableAction,
  shouldSkipWalletDebitForContinuation,
  TRYOUT_GRANT_MICROCENT,
  usdCostToMicrocents,
} from './walletCredits.js';

describe('walletCredits', () => {
  it('converts euros and microcents', () => {
    expect(eurToMicrocents(2)).toBe(TRYOUT_GRANT_MICROCENT);
    expect(microcentsToEur(TRYOUT_GRANT_MICROCENT)).toBe(2);
    expect(formatMicrocentsAsEur(TRYOUT_GRANT_MICROCENT)).toBe('€2.00');
    expect(formatEur(0.02)).toBe('€0.02');
  });

  it('prices fixed actions', () => {
    expect(actionPriceMicrocents('chat')).toBe(eurToMicrocents(ACTION_PRICE_EUR.chat));
    expect(actionPriceMicrocents('agent')).toBe(eurToMicrocents(ACTION_PRICE_EUR.agent));
    expect(actionPriceMicrocents('unknown')).toBe(eurToMicrocents(ACTION_PRICE_EUR.chat));
  });

  it('maps usd cost 1:1 for subsidy tracking', () => {
    expect(usdCostToMicrocents(0.004)).toBe(eurToMicrocents(0.004));
    expect(usdCostToMicrocents(0)).toBe(0);
  });

  it('keeps honest chat (search_document) at chat price', () => {
    const chatPayload = {
      tools: [{ type: 'function', name: 'search_document' }],
      previous_response_id: 'resp_123',
      input: [{ type: 'function_call_output', call_id: 'c1', output: '...' }],
    };
    expect(payloadLooksLikeAgent(chatPayload)).toBe(false);
    expect(resolveBillableAction('chat', chatPayload)).toBe('chat');
  });

  it('upgrades agent-shaped payloads even when client claims chat', () => {
    expect(resolveBillableAction('chat', { tools: [{ type: 'web_search' }] })).toBe('agent');
    expect(
      resolveBillableAction('chat', {
        tools: [{ type: 'function', name: 'fetch_remote_paper' }],
      }),
    ).toBe('agent');
    expect(
      resolveBillableAction('explain', {
        previous_response_id: 'resp_agent',
        // tool-less continuation = agent finalize pattern
      }),
    ).toBe('agent');
    expect(resolveBillableAction('agent', {})).toBe('agent');
    expect(resolveBillableAction('nope', null)).toBe('chat');
  });

  it('keeps agent price when parent response was billed as agent', () => {
    expect(
      resolveBillableAction(
        'chat',
        {
          previous_response_id: 'resp_agent',
          tools: [{ type: 'function', name: 'search_document' }],
        },
        { parentAction: 'agent' },
      ),
    ).toBe('agent');
  });

  it('skips wallet debit for owned tool-loop continuations only', () => {
    expect(shouldSkipWalletDebitForContinuation({})).toBe(false);
    expect(
      shouldSkipWalletDebitForContinuation({
        parentResponseId: 'resp_1',
        parentTier: { found: false },
      }),
    ).toBe(false);
    expect(
      shouldSkipWalletDebitForContinuation({
        parentResponseId: 'resp_1',
        parentTier: { found: true, owned: false },
      }),
    ).toBe(false);
    expect(
      shouldSkipWalletDebitForContinuation({
        parentResponseId: 'resp_1',
        parentTier: { found: true, owned: true, action: 'chat' },
      }),
    ).toBe(true);
  });

  it('upgrades when input names a non-chat tool even with search_document tools', () => {
    expect(
      payloadLooksLikeAgent({
        tools: [{ type: 'function', name: 'search_document' }],
        input: [{ type: 'function_call_output', name: 'fetch_remote_paper', call_id: 'c1', output: 'x' }],
      }),
    ).toBe(true);
  });

  it('allowlists wallet models and clamps output tokens', () => {
    expect(isWalletModelAllowed('gpt-5.4-mini')).toBe(true);
    expect(isWalletModelAllowed('gpt-5.4-mini-2025-01-01')).toBe(true);
    expect(isWalletModelAllowed('gpt-5.4')).toBe(false);
    expect(clampWalletMaxOutputTokens(100000)).toBe(8192);
    expect(clampWalletMaxOutputTokens(1000)).toBe(1000);
  });
});
