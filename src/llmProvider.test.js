import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  PROVIDERS,
  getProviderConfig,
  requestModelResponse,
  extractResponseOutputText,
  extractFunctionCalls,
  extractWebSearchSources,
  extractReasoningSummary,
  isResponseIncompleteForMaxOutput,
} from './llmProvider';

// ── test helpers ─────────────────────────────────────────────────────────────

function memLocalStorage() {
  const store = new Map();
  return {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
  };
}

const sse = (obj) => `data: ${JSON.stringify(obj)}\n`;

// Build a fake streaming Response whose body yields the given raw fragments.
// Fragments can split SSE lines (or content values) at arbitrary points to
// simulate real network/token boundaries.
function streamResponse(fragments) {
  const encoder = new TextEncoder();
  let i = 0;
  return {
    ok: true,
    body: {
      getReader: () => ({
        read: async () =>
          i < fragments.length
            ? { done: false, value: encoder.encode(fragments[i++]) }
            : { done: true, value: undefined },
      }),
    },
  };
}

// A standard Ollama-style streamed completion: optional think block, answer text,
// optional tool call, and a terminating chunk carrying finish_reason + usage.
function completionFragments({ content = "", toolCall = null, finishReason = "stop", usage } = {}) {
  const lines = [];
  if (content) lines.push(sse({ choices: [{ delta: { content }, finish_reason: null }] }));
  if (toolCall) {
    lines.push(
      sse({
        choices: [
          { delta: { tool_calls: [{ index: 0, id: toolCall.id, function: { name: toolCall.name, arguments: toolCall.arguments } } ] }, finish_reason: null },
        ],
      })
    );
  }
  lines.push(
    sse({
      choices: [{ delta: {}, finish_reason: finishReason }],
      usage: usage || { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
    })
  );
  lines.push("data: [DONE]\n");
  return lines;
}

let fetchMock;

beforeEach(() => {
  global.localStorage = memLocalStorage();
  fetchMock = vi.fn();
  global.fetch = fetchMock;
});

afterEach(() => {
  vi.restoreAllMocks();
});

const lastRequestBody = () => JSON.parse(fetchMock.mock.calls.at(-1)[1].body);

// ── getProviderConfig ─────────────────────────────────────────────────────────

describe('getProviderConfig', () => {
  it('defaults to the OpenAI provider', () => {
    expect(getProviderConfig().provider).toBe(PROVIDERS.OPENAI);
  });

  it('reads provider and Ollama URL overrides from localStorage', () => {
    localStorage.setItem('pv-provider', 'local');
    localStorage.setItem('pv-ollama-url', 'http://example.local:1234');
    const cfg = getProviderConfig();
    expect(cfg.provider).toBe(PROVIDERS.LOCAL);
    expect(cfg.ollamaBaseUrl).toBe('http://example.local:1234');
  });
});

// ── exported Responses-shape parsers ─────────────────────────────────────────

describe('response parsing helpers', () => {
  it('extracts output text from top-level and output[] parts without duplicates', () => {
    const data = {
      output_text: 'hello',
      output: [{ content: [{ type: 'output_text', text: 'hello' }, { type: 'output_text', text: 'world' }] }],
    };
    expect(extractResponseOutputText(data)).toBe('hello\nworld');
  });

  it('extracts function calls and ignores other output items', () => {
    const data = { output: [{ type: 'reasoning' }, { type: 'function_call', name: 'search_document', call_id: 'c1' }] };
    expect(extractFunctionCalls(data)).toHaveLength(1);
    expect(extractFunctionCalls(data)[0].name).toBe('search_document');
  });

  it('extracts reasoning summary text', () => {
    const data = { output: [{ type: 'reasoning', summary: [{ type: 'summary_text', text: 'thought' }] }] };
    expect(extractReasoningSummary(data)).toBe('thought');
  });

  it('collects web search sources', () => {
    const data = { output: [{ type: 'web_search_call', action: { sources: [{ url: 'a' }, { url: 'b' }] } }] };
    expect(extractWebSearchSources(data)).toHaveLength(2);
  });

  it('detects max-output-token incompletion', () => {
    expect(isResponseIncompleteForMaxOutput({ status: 'incomplete', incomplete_details: { reason: 'max_output_tokens' } })).toBe(true);
    expect(isResponseIncompleteForMaxOutput({ status: 'completed' })).toBe(false);
  });
});

// ── Ollama adapter (via requestModelResponse) ────────────────────────────────

describe('Ollama adapter', () => {
  beforeEach(() => {
    localStorage.setItem('pv-provider', 'local');
    localStorage.setItem('pv-ollama-url', 'http://localhost:11434');
  });

  it('normalises a streamed completion into Responses-API shape', async () => {
    fetchMock.mockResolvedValue(streamResponse(completionFragments({ content: '<think>plan</think>Final answer' })));

    const data = await requestModelResponse({ model: 'gemma4:12b', instructions: 'sys', input: [{ role: 'user', content: 'hi' }] });

    expect(extractReasoningSummary(data)).toBe('plan');
    expect(extractResponseOutputText(data)).toBe('Final answer');
    expect(data.output_text).toBe('Final answer');
    expect(data.usage).toEqual({ input_tokens: 10, output_tokens: 5, total_tokens: 15 });
    expect(typeof data.id).toBe('string');
  });

  it('reassembles <think> tags split across content deltas and streams tokens via onChunk', async () => {
    // The think tags are deliberately split across delta boundaries.
    const fragments = [
      sse({ choices: [{ delta: { content: '<th' }, finish_reason: null }] }),
      sse({ choices: [{ delta: { content: 'ink>reaso' }, finish_reason: null }] }),
      sse({ choices: [{ delta: { content: 'ning</thi' }, finish_reason: null }] }),
      sse({ choices: [{ delta: { content: 'nk>Ans' }, finish_reason: null }] }),
      sse({ choices: [{ delta: { content: 'wer' }, finish_reason: null }] }),
      sse({ choices: [{ delta: {}, finish_reason: 'stop' }], usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 } }),
      'data: [DONE]\n',
    ];
    fetchMock.mockResolvedValue(streamResponse(fragments));

    const events = [];
    const data = await requestModelResponse(
      { model: 'gemma4:12b', instructions: 'sys', input: [{ role: 'user', content: 'hi' }] },
      { onChunk: (e) => events.push(e) }
    );

    const thinkingText = events.filter((e) => e.type === 'thinking').map((e) => e.token).join('');
    const answerText = events.filter((e) => e.type === 'text').map((e) => e.token).join('');
    expect(thinkingText).toBe('reasoning');
    expect(answerText).toBe('Answer');
    expect(events.some((e) => e.type === 'thinking_done')).toBe(true);

    // The leaked-tag bug would surface here: answer must not contain tag fragments.
    expect(extractResponseOutputText(data)).toBe('Answer');
    expect(extractReasoningSummary(data)).toBe('reasoning');
  });

  it('assembles streamed tool-call fragments into a function_call', async () => {
    fetchMock.mockResolvedValue(
      streamResponse(
        completionFragments({
          content: '<think>need to search</think>',
          toolCall: { id: 'call_1', name: 'search_document', arguments: '{"query":"x"}' },
          finishReason: 'tool_calls',
        })
      )
    );

    const data = await requestModelResponse({ model: 'gemma4:12b', instructions: 'sys', tools: [{ type: 'function', name: 'search_document', description: 'd', parameters: {} }], input: [{ role: 'user', content: 'hi' }] });

    const calls = extractFunctionCalls(data);
    expect(calls).toHaveLength(1);
    expect(calls[0].name).toBe('search_document');
    expect(calls[0].call_id).toBe('call_1');
    expect(calls[0].arguments).toBe('{"query":"x"}');
  });

  it('maps finish_reason "length" to an incomplete response', async () => {
    fetchMock.mockResolvedValue(streamResponse(completionFragments({ content: 'partial', finishReason: 'length' })));

    const data = await requestModelResponse({ model: 'gemma4:12b', instructions: 'sys', input: [{ role: 'user', content: 'hi' }] });

    expect(isResponseIncompleteForMaxOutput(data)).toBe(true);
  });

  it('translates the payload: omits web_search, keeps function tools, maps max_output_tokens', async () => {
    fetchMock.mockResolvedValue(streamResponse(completionFragments({ content: 'ok' })));

    await requestModelResponse({
      model: 'gemma4:12b',
      instructions: 'system instructions',
      max_output_tokens: 2048,
      reasoning: { effort: 'high' },
      tools: [
        { type: 'function', name: 'search_document', description: 'd', parameters: { type: 'object' } },
        { type: 'web_search' },
      ],
      input: [{ role: 'user', content: 'question' }],
    });

    const [url, init] = fetchMock.mock.calls.at(-1);
    expect(url).toBe('http://localhost:11434/v1/chat/completions');
    const body = JSON.parse(init.body);
    expect(body.stream).toBe(true);
    expect(body.max_tokens).toBe(2048);
    expect(body.tools).toHaveLength(1);
    expect(body.tools[0].function.name).toBe('search_document');
    expect(body.tool_choice).toBe('auto');
    // reasoning.effort becomes a system-prompt hint, not a top-level field.
    expect(body.reasoning).toBeUndefined();
    expect(body.messages[0].role).toBe('system');
    expect(body.messages[0].content).toContain('system instructions');
    expect(body.messages[0].content.toLowerCase()).toContain('reasoning effort');
  });

  it('continues a conversation via the synthetic previous_response_id and maps tool output to a tool message', async () => {
    fetchMock.mockResolvedValue(
      streamResponse(
        completionFragments({ toolCall: { id: 'call_1', name: 'search_document', arguments: '{}' }, finishReason: 'tool_calls' })
      )
    );
    const first = await requestModelResponse({ model: 'gemma4:12b', instructions: 'sys', input: [{ role: 'user', content: 'hi' }] });

    fetchMock.mockResolvedValue(streamResponse(completionFragments({ content: 'done' })));
    await requestModelResponse({
      model: 'gemma4:12b',
      previous_response_id: first.id,
      input: [{ type: 'function_call_output', call_id: 'call_1', output: 'tool result' }],
    });

    const body = lastRequestBody();
    const roles = body.messages.map((m) => m.role);
    expect(roles).toEqual(['system', 'user', 'assistant', 'tool']);
    const toolMsg = body.messages.at(-1);
    expect(toolMsg).toEqual({ role: 'tool', tool_call_id: 'call_1', content: 'tool result' });
  });

  it('replaces the system message on a continuation that supplies new instructions (finalize pass)', async () => {
    fetchMock.mockResolvedValue(streamResponse(completionFragments({ content: 'partial', finishReason: 'length' })));
    const first = await requestModelResponse({ model: 'gemma4:12b', instructions: 'original system', input: [{ role: 'user', content: 'hi' }] });

    fetchMock.mockResolvedValue(streamResponse(completionFragments({ content: 'final json' })));
    await requestModelResponse({
      model: 'gemma4:12b',
      previous_response_id: first.id,
      instructions: 'rewrite as JSON only',
      input: [{ role: 'user', content: 'finalize' }],
    });

    const body = lastRequestBody();
    const systemMessages = body.messages.filter((m) => m.role === 'system');
    expect(systemMessages).toHaveLength(1);
    expect(systemMessages[0].content).toContain('rewrite as JSON only');
    expect(systemMessages[0].content).not.toContain('original system');
  });

  it('throws a helpful error when Ollama is unreachable', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 403, text: async () => '' });
    await expect(
      requestModelResponse({ model: 'gemma4:12b', instructions: 'sys', input: [{ role: 'user', content: 'hi' }] })
    ).rejects.toThrow(/Ollama/);
  });
});

// ── OpenAI routing (unchanged path) ──────────────────────────────────────────

describe('OpenAI routing', () => {
  it('routes to the OpenAI proxy endpoint and returns the parsed Responses object', async () => {
    localStorage.setItem('pv-provider', 'openai');
    fetchMock.mockResolvedValue({
      ok: true,
      headers: { get: () => 'application/json' },
      text: async () => JSON.stringify({ output_text: 'from openai', output: [] }),
    });

    const data = await requestModelResponse(
      { model: 'gpt-5.4-mini', instructions: 'sys', input: [{ role: 'user', content: 'hi' }] },
      { apiKey: 'sk-test' }
    );

    expect(data.output_text).toBe('from openai');
    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/openai-response');
  });
});
