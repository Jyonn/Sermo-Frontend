import React from 'react';
export function safeUrl(url: string) { return /^https?:\/\//i.test(url) ? url : undefined; }
function inline(text: string): React.ReactNode[] {
  return text.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\(https?:\/\/[^\s)]+\))/g).map((part,i)=>{
    if(part.startsWith('`'))return <code key={i}>{part.slice(1,-1)}</code>;
    if(part.startsWith('**'))return <strong key={i}>{part.slice(2,-2)}</strong>;
    if(part.startsWith('*'))return <em key={i}>{part.slice(1,-1)}</em>;
    const link=part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    return link?<a key={i} href={safeUrl(link[2])} target="_blank" rel="noreferrer">{link[1]}</a>:part;
  });
}
// Deliberately render a safe Markdown subset as React nodes, never raw HTML.
export function Markdown({body}:{body:string}) {
  const chunks=body.split(/(```[\s\S]*?```)/g);
  return <div className="v3-markdown">{chunks.map((chunk,index)=>chunk.startsWith('```')?<pre key={index}><code>{chunk.replace(/^```[^\n]*\n?/,'').replace(/```$/,'')}</code></pre>:<React.Fragment key={index}>{blocks(chunk)}</React.Fragment>)}</div>;
}
function blocks(chunk: string) {
  const lines = chunk.split('\n'), output: React.ReactNode[] = [];
  const cells = (line: string) => line.trim().replace(/^\|/,'').replace(/\|$/,'').split('|').map(cell => cell.trim());
  for(let i=0;i<lines.length;i++) {
    const line=lines[i];
    if(line.includes('|') && /^\s*\|?\s*:?-{3,}/.test(lines[i+1] || '') && cells(lines[i+1]).every(cell => /^:?-{3,}:?$/.test(cell))) {
      const headers=cells(line), rows:string[][]=[]; i+=2;
      while(i<lines.length && lines[i].includes('|')) { rows.push(cells(lines[i])); i++; }
      i--;
      output.push(<div className="v3-md-table" key={i}><table><thead><tr>{headers.map((cell,j)=><th key={j}>{inline(cell)}</th>)}</tr></thead><tbody>{rows.map((row,r)=><tr key={r}>{headers.map((_,c)=><td key={c}>{inline(row[c] || '')}</td>)}</tr>)}</tbody></table></div>);
      continue;
    }
    output.push((()=>{
    const heading=line.match(/^(#{1,6}) (.*)$/);
    if(heading)return React.createElement(`h${Math.min(6,heading[1].length+1)}`,{key:i},inline(heading[2]));
    if(/^> /.test(line))return <blockquote key={i}>{inline(line.slice(2))}</blockquote>;
    if(/^[-*] /.test(line))return <div className="v3-list-line" key={i}><span>•</span><span>{inline(line.slice(2))}</span></div>;
    if(/^\d+\. /.test(line))return <div className="v3-list-line" key={i}>{inline(line)}</div>;
    return line.trim()?<p key={i}>{inline(line)}</p>:<div className="v3-md-gap" key={i}/>;
    })());
  }
  return output;
}
