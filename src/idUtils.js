/** Cryptographically strong IDs for chats, messages, and local records. */
export function createRandomId(prefix) {
  return `${prefix}-${crypto.randomUUID()}`;
}
