import { explorerExpressionForMessage, explorerExpressionSrc } from "../lib/explorerExpressions";

export function ExplorerAiExpression({ messageKey, bubbleStyle }: { messageKey: string; bubbleStyle?: string }) {
  if (bubbleStyle !== "explorer-ai") return null;
  const expression = explorerExpressionForMessage(messageKey);
  return <img aria-hidden="true" alt="" className="explorer-ai-expression" data-expression={expression} src={explorerExpressionSrc(expression)} width="40" height="40" decoding="async" loading="lazy" draggable={false} />;
}
