import type { ReactNode } from "react";
import { explorerExpressionForMessage, explorerExpressionSrc } from "../lib/explorerExpressions";

export function ExplorerAiExpression({ messageKey, bubbleStyle, children }: { messageKey: string; bubbleStyle?: string; children?: ReactNode }) {
  const expression = explorerExpressionForMessage(messageKey);
  return <>{bubbleStyle === "explorer-ai" ? <span aria-hidden="true" className="explorer-ai-expression" data-expression={expression}><img alt="" src={explorerExpressionSrc(expression)} width="40" height="40" decoding="async" draggable={false} /></span> : null}{children}</>;
}
