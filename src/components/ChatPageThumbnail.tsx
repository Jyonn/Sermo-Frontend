import {explorerExpressionSrc} from '../lib/explorerExpressions';

export function ChatPageThumbnail({theme,bubbleStyle}:{theme:string;bubbleStyle:string}){
  return <span aria-hidden="true" className={`personalization-background-swatch personalization-chat-page-preview theme-${theme}`}>
    {bubbleStyle==='explorer-ai'?<span className="ai-mini-conversation"><span className="ai-mini-other"><img src={explorerExpressionSrc('smirk')} alt=""/><i/></span><span className="ai-mini-self"><img src={explorerExpressionSrc('joy')} alt=""/><i/></span></span>:<span className={`personalization-option preview-${bubbleStyle}`}><i><span/></i></span>}
  </span>;
}
