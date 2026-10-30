import type { ReactNode } from "react";
import { explorerExpressionForMessage, explorerExpressionSrc } from "../lib/explorerExpressions";

export function ExplorerAiExpression({ messageKey, bubbleStyle, children }: { messageKey: string; bubbleStyle?: string; children?: ReactNode }) {
  const expression = explorerExpressionForMessage(messageKey);
  return <>{bubbleStyle === "explorer-ai" ? <img aria-hidden="true" className="explorer-ai-expression" data-expression={expression} alt="" src={explorerExpressionSrc(expression)} width="20" height="20" decoding="async" draggable={false} /> : null}{children}</>;
}
