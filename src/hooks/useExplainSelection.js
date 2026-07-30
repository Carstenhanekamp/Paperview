import { useCallback, useRef, useState } from 'react';
import { OPENAI_MODEL, EXPLAIN_SYSTEM_PROMPT, EXPLAIN_MAX_CHARS } from '../constants';
import { extractResponseOutputText, requestOpenAIResponse } from '../openaiResponseParsing';

export function useExplainSelection({
  apiKey,
  openSettingsModal,
  selectedModel,
}) {
  const [explainState, setExplainState] = useState(null);
  const abortRef = useRef(null);

  const dismissExplain = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setExplainState(null);
  }, []);

  const explainSelection = useCallback(
    async (popup) => {
      if (!popup?.text) return;

      if (!apiKey && !import.meta.env.VITE_OPENAI_API_KEY) {
        openSettingsModal?.();
        return;
      }

      const passage = String(popup.text).trim().slice(0, EXPLAIN_MAX_CHARS);
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setExplainState({
        x: popup.x,
        y: popup.y,
        passage,
        answer: '',
        loading: true,
        error: null,
      });

      try {
        const data = await requestOpenAIResponse(
          apiKey,
          {
            model: selectedModel || OPENAI_MODEL,
            max_output_tokens: 800,
            instructions: EXPLAIN_SYSTEM_PROMPT,
            input: [
              {
                role: 'user',
                content: `Explain this passage from a research paper:\n\n"""${passage}"""`,
              },
            ],
          },
          { signal: controller.signal }
        );

        const answer = extractResponseOutputText(data) || 'No explanation returned.';
        setExplainState((prev) =>
          prev
            ? {
                ...prev,
                answer,
                loading: false,
                error: null,
              }
            : null
        );
      } catch (err) {
        if (err?.name === 'AbortError') return;
        setExplainState((prev) =>
          prev
            ? {
                ...prev,
                loading: false,
                error: err?.message || 'Explain failed.',
              }
            : null
        );
      } finally {
        if (abortRef.current === controller) abortRef.current = null;
      }
    },
    [apiKey, openSettingsModal, selectedModel]
  );

  return {
    explainState,
    explainSelection,
    dismissExplain,
  };
}
