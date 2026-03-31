export const CHAT_TITLE_FALLBACK = "New chat";

export function createChatThreadRecord(paperId) {
  return {
    id: `chat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    paperId,
    title: CHAT_TITLE_FALLBACK,
    messages: [],
    updatedAt: Date.now(),
  };
}

export function createAgentChatThreadRecord(rootFolderId) {
  return {
    id: `agent-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    rootFolderId,
    title: CHAT_TITLE_FALLBACK,
    messages: [],
    updatedAt: Date.now(),
  };
}

export function deriveChatTitle(text) {
  const cleaned = String(text || "").replace(/\s+/g, " ").trim();
  if (!cleaned) return CHAT_TITLE_FALLBACK;
  return cleaned.length > 48 ? `${cleaned.slice(0, 48).trim()}...` : cleaned;
}

export function formatChatTimestamp(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  return sameDay
    ? date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    : date.toLocaleDateString([], { month: "short", day: "numeric" });
}

export function formatChatMessageCount(count) {
  return `${count} message${count === 1 ? "" : "s"}`;
}

export function derivePageTexts(paper) {
  if (!paper) return [];
  if (Array.isArray(paper.pageTexts) && paper.pageTexts.length) return paper.pageTexts;

  const fullText = String(paper.fullText || "");
  const out = [];
  const re = /--- Page\s+(\d+)\s+---\s*([\s\S]*?)(?=(?:--- Page\s+\d+\s+---)|$)/g;
  let m;
  while ((m = re.exec(fullText))) {
    out.push({ page: Number(m[1]), text: String(m[2] || "").trim() });
  }
  return out;
}
