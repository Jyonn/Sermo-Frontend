import {useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {BrowserRouter} from 'react-router-dom';
import {AuthProvider} from '../../src/lib/auth';
import {LanguageProvider} from '../../src/lib/language';
import {activateLanguage} from '../../src/lib/i18n';
import {MarkdownInput} from '../../src/components/ResearchMarkdownInput';
import '../../styles.css';
import './immersive-editor.css';

function Demo(){
  const [body,setBody]=useState('## 研究目标\n\n从一个值得探索的问题开始。\n\n- 整理相关工作\n- 记录实验与发现');
  const [dark,setDark]=useState(new URLSearchParams(location.search).has('dark'));
  const [saved,setSaved]=useState(false);
  useEffect(()=>{document.documentElement.dataset.theme=dark?'dark':'light';},[dark]);
  return <div className="immersive-demo">
    <header className="demo-header"><span>Frienden / 交互实验</span><button type="button" onClick={()=>setDark(!dark)} aria-label="切换明暗模式"><span className="material-symbols-outlined">{dark?'light_mode':'dark_mode'}</span></button></header>
    <main className="demo-page">
      <div className="demo-intro"><p>课题说明</p><h1>专注眼前的想法。</h1><p>轻触正文开始编辑，工具栏随输入出现。</p></div>
      <section className="immersive-surface" aria-label="课题说明编辑器">
        <div className="immersive-content">
          <MarkdownInput value={body} onChange={value=>{setBody(value);setSaved(false);}} rows={10}/>
        </div>
      </section>
      <footer className="demo-footer"><span role="status">{saved?'已保存本次演示内容':'仅交互演示，不修改真实课题'}</span><button type="button" className="button" onClick={()=>setSaved(true)}>保存说明</button></footer>
    </main>
  </div>;
}
await activateLanguage('zh-CN');
await document.fonts.load('24px "Material Symbols Outlined"');
document.documentElement.classList.add('material-symbols-ready');
createRoot(document.getElementById('root')!).render(<BrowserRouter><AuthProvider><LanguageProvider><Demo/></LanguageProvider></AuthProvider></BrowserRouter>);
