import { explorerExpressionForMessage, explorerExpressionSrc } from "../lib/explorerExpressions";

export function ExplorerAiExpression({ messageKey, bubbleStyle }: { messageKey: string; bubbleStyle?: string }) {
  if (bubbleStyle !== "explorer-ai") return null;
  const expression = explorerExpressionForMessage(messageKey);
  return <span aria-hidden="true" className="explorer-ai-expression" data-expression={expression}><img alt="" src={explorerExpressionSrc(expression)} width="38" height="38" decoding="async" loading="lazy" draggable={false} /></span>;
}
