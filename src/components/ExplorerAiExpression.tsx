import type { ReactNode } from "react";
import { explorerExpressionForMessage, explorerExpressionIndex, explorerExpressionSrc, managedExpressionSrc } from "../lib/explorerExpressions";
import { useResourceCollection } from '../lib/managedResources';

export function ExplorerAiExpression({ messageKey, bubbleStyle, children }: { messageKey: string; bubbleStyle?: string; children?: ReactNode }) {
  const expression = explorerExpressionForMessage(messageKey);
  const collection=useResourceCollection('haibara-v2',bubbleStyle==='explorer-ai');
  const asset=collection?.assets.find(item=>item.slug===expression)??collection?.assets[explorerExpressionIndex(messageKey,collection.assets.length)];
  const show=collection?Boolean(asset):true;
  return <>{bubbleStyle === "explorer-ai" && show ? <span aria-hidden="true" className="explorer-ai-expression" data-expression={expression}><img alt="" src={asset?managedExpressionSrc(asset):explorerExpressionSrc(expression)} width="24" height="24" decoding="async" draggable={false} onError={event=>{if(asset&&event.currentTarget.src!==asset.thumbnail_uri)event.currentTarget.src=asset.thumbnail_uri;}} /></span> : null}{children}</>;
}
