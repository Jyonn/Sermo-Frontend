import manifest from '../assets/haibara-manifest.json' with {type:'json'};
export const EXPLORER_EXPRESSIONS = ['joy','laugh','laugh-tears','smirk','eye-roll','side-eye','grimace','sweat-smile','surprised','blank','pleading','cry','angry','sleepy','dizzy','love','shush','giggle','cool','sigh'] as const;
export type ExplorerExpression = typeof EXPLORER_EXPRESSIONS[number];
export const explorerExpressionSrc = (expression: ExplorerExpression) => manifest[expression].thumbnail;
export const explorerExpressionDisplaySrc = (expression: ExplorerExpression) => manifest[expression].display;
export const explorerExpressionTitle = (expression: ExplorerExpression, language:string) => language==='en'?manifest[expression].title_en:manifest[expression].title;
export function managedExpressionSrc(asset:{slug:string;content_hash:string;thumbnail_uri:string}) {
  const local=manifest[asset.slug as ExplorerExpression];
  return local?.content_hash===asset.content_hash?local.thumbnail:asset.thumbnail_uri;
}

// Random client UUIDs give each message a stable choice, including after its
// server acknowledgement. Rendering and scrolling must never reroll a face.
export function explorerExpressionForMessage(clientId: string): ExplorerExpression {
  return EXPLORER_EXPRESSIONS[explorerExpressionIndex(clientId,EXPLORER_EXPRESSIONS.length)];
}
export function explorerExpressionIndex(clientId:string,count:number) {
  let hash = 2166136261;
  for (const character of clientId) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  hash ^= hash >>> 16;
  return count>0?(hash >>> 0)%count:0;
}
