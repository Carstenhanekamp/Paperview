import { useCallback, useEffect, useRef } from "react";
import { createStoppedError } from "../miscUtils";
import { createRandomId } from "../idUtils";

/**
 * Manages the lifecycle of in-flight chat/agent requests: abort controllers,
 * staleness tokens, and cleanup on unmount.
 *
 * Returns two request refs (chat and agent) plus a shared set of functions
 * that take a requestRef as their first argument, matching the call
 * signatures previously embedded in PaperviewApp.
 */
export function useRequestRuns() {
  const chatRequestRef = useRef({ controller: null, token: 0, chatId: null });
  const agentRequestRef = useRef({ controller: null, token: 0, chatId: null });

  const beginRequestRun = useCallback((requestRef, chatId) => {
    requestRef.current.controller?.abort();
    const controller = new AbortController();
    const token = createRandomId("run");
    requestRef.current = { controller, token, chatId };
    return { controller, token };
  }, []);

  const ensureRequestRunActive = useCallback((requestRef, token) => {
    if (requestRef.current.token !== token) {
      throw createStoppedError();
    }
  }, []);

  const finishRequestRun = useCallback((requestRef, token) => {
    if (requestRef.current.token === token) {
      requestRef.current = { controller: null, token: 0, chatId: null };
    }
  }, []);

  useEffect(() => () => {
    chatRequestRef.current.controller?.abort();
    agentRequestRef.current.controller?.abort();
  }, []);

  return {
    chatRequestRef,
    agentRequestRef,
    beginRequestRun,
    ensureRequestRunActive,
    finishRequestRun,
  };
}
