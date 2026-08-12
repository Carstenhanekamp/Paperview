import { describe, expect, it } from 'vitest';
import {
  ACTION_PRICE_EUR,
  actionPriceMicrocents,
  clampWalletMaxOutputTokens,
  continuationRoundsForAction,
  eurToMicrocents,
  findDisallowedWalletTool,
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
        parentTier: { found: true, owned: true, action: 'chat', roundsRemaining: 20 },
        action: 'chat',
      }),
    ).toBe(true);
  });

  it('bills again once the root turn continuation budget is spent', () => {
    const owned = { found: true, owned: true, action: 'chat' };
    expect(
      shouldSkipWalletDebitForContinuation({
        parentResponseId: 'resp_1',
        parentTier: { ...owned, roundsRemaining: 1 },
        action: 'chat',
      }),
    ).toBe(true);
    expect(
      shouldSkipWalletDebitForContinuation({
        parentResponseId: 'resp_1',
        parentTier: { ...owned, roundsRemaining: 0 },
        action: 'chat',
      }),
    ).toBe(false);
    // Missing budget (pre-migration row) is treated as spent, not unlimited.
    expect(
      shouldSkipWalletDebitForContinuation({
        parentResponseId: 'resp_1',
        parentTier: owned,
        action: 'chat',
      }),
    ).toBe(false);
  });

  it('refuses to let an agent payload ride a cheaper chat root for free', () => {
    expect(
      shouldSkipWalletDebitForContinuation({
        parentResponseId: 'resp_1',
        parentTier: { found: true, owned: true, action: 'chat', roundsRemaining: 20 },
        action: 'agent',
      }),
    ).toBe(false);
    // Cheaper-or-equal tiers still ride the agent root they were paid for.
    expect(
      shouldSkipWalletDebitForContinuation({
        parentResponseId: 'resp_1',
        parentTier: { found: true, owned: true, action: 'agent', roundsRemaining: 20 },
        action: 'chat',
      }),
    ).toBe(true);
  });

  it('grants a continuation budget that covers the client tool loops', () => {
    // chat loops up to MAX_SEARCH_TOOL_ROUNDS (20)
    expect(continuationRoundsForAction('chat')).toBeGreaterThanOrEqual(20);
    // agent: 3 passes x 20 cycles + 2 pass chains + 2 finalize passes = 64
    expect(continuationRoundsForAction('agent')).toBeGreaterThanOrEqual(64);
    expect(continuationRoundsForAction('nonsense')).toBe(continuationRoundsForAction('chat'));
  });

  it('admits only the tools the app actually ships', () => {
    expect(findDisallowedWalletTool({ tools: [{ type: 'function', name: 'search_document' }] })).toBeNull();
    expect(
      findDisallowedWalletTool({
        tools: [{ type: 'web_search' }, { type: 'function', name: 'fetch_remote_paper' }],
      }),
    ).toBeNull();
    expect(findDisallowedWalletTool({})).toBeNull();

    // Expensive / SSRF-shaped built-ins are refused outright.
    expect(findDisallowedWalletTool({ tools: [{ type: 'code_interpreter' }] })?.type).toBe('code_interpreter');
    expect(
      findDisallowedWalletTool({ tools: [{ type: 'mcp', server_url: 'https://attacker.example' }] })?.type,
    ).toBe('mcp');
    expect(findDisallowedWalletTool({ tools: [{ type: 'file_search' }] })?.type).toBe('file_search');
    expect(
      findDisallowedWalletTool({ tools: [{ type: 'function', name: 'exfiltrate' }] })?.type,
    ).toBe('function:exfiltrate');
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
