import type { ReactNode } from "react";
import { explorerExpressionForMessage, explorerExpressionSrc } from "../lib/explorerExpressions";

export function ExplorerAiExpression({ messageKey, bubbleStyle, children }: { messageKey: string; bubbleStyle?: string; children: ReactNode }) {
  return bubbleStyle === "explorer-ai" ? <AiBubble messageKey={messageKey}>{children}</AiBubble> : <>{children}</>;
}

function AiBubble({ messageKey, children }: { messageKey: string; children: ReactNode }) {
  const expression = explorerExpressionForMessage(messageKey);
  return <div className="explorer-ai-layout">
    <span aria-hidden="true" className="explorer-ai-expression" data-expression={expression}><img alt="" src={explorerExpressionSrc(expression)} width="40" height="40" decoding="async" loading="lazy" draggable={false} /></span>
    <div className="explorer-ai-content">{children}</div>
  </div>;
}
