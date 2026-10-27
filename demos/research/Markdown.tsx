import React from 'react';
export function safeUrl(url: string) { return /^https?:\/\//i.test(url) ? url : undefined; }
function inline(text: string): React.ReactNode[] {
  return text.split(/(`[^`]+`|\*\*[^*]+\*\*|\[[^\]]+\]\(https?:\/\/[^\s)]+\))/g).map((part,i)=>{
    if(part.startsWith('`'))return <code key={i}>{part.slice(1,-1)}</code>;
    if(part.startsWith('**'))return <strong key={i}>{part.slice(2,-2)}</strong>;
    const link=part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    return link?<a key={i} href={safeUrl(link[2])} target="_blank" rel="noreferrer">{link[1]}</a>:part;
  });
}
// Deliberately render a safe Markdown subset as React nodes, never raw HTML.
export function Markdown({body}:{body:string}) {
  const chunks=body.split(/(```[\s\S]*?```)/g);
  return <div className="v3-markdown">{chunks.map((chunk,index)=>chunk.startsWith('```')?<pre key={index}><code>{chunk.replace(/^```[^\n]*\n?/,'').replace(/```$/,'')}</code></pre>:<React.Fragment key={index}>{chunk.split('\n').map((line,i)=>{
    if(/^###? /.test(line)){const value=inline(line.replace(/^#+ /,''));return line.startsWith('###')?<h4 key={i}>{value}</h4>:<h3 key={i}>{value}</h3>;}
    if(/^# /.test(line))return <h2 key={i}>{inline(line.slice(2))}</h2>;
    if(/^> /.test(line))return <blockquote key={i}>{inline(line.slice(2))}</blockquote>;
    if(/^[-*] /.test(line))return <div className="v3-list-line" key={i}><span>•</span><span>{inline(line.slice(2))}</span></div>;
    if(/^\d+\. /.test(line))return <div className="v3-list-line" key={i}>{inline(line)}</div>;
    return line.trim()?<p key={i}>{inline(line)}</p>:<div className="v3-md-gap" key={i}/>;
  })}</React.Fragment>)}</div>;
}
