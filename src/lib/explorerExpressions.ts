export const EXPLORER_EXPRESSIONS = ["yawn", "cool", "smile", "smirk", "side-eye", "blush", "annoyed", "sleepy", "surprised", "thinking"] as const;
export type ExplorerExpression = typeof EXPLORER_EXPRESSIONS[number];
export const explorerExpressionSrc = (expression: ExplorerExpression) => `/activity/explorer-2026/ai-expressions-v7/${expression}.webp`;

// Random client UUIDs give each message a stable choice, including after its
// server acknowledgement. Rendering and scrolling must never reroll a face.
export function explorerExpressionForMessage(clientId: string): ExplorerExpression {
  let hash = 2166136261;
  for (const character of clientId) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  hash ^= hash >>> 16;
  return EXPLORER_EXPRESSIONS[(hash >>> 0) % EXPLORER_EXPRESSIONS.length];
}
