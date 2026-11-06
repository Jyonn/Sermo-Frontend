import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {BrowserRouter} from 'react-router-dom';
import '../../styles.css';
import '../../src/styles/birthday-theme.css';
import {AuthProvider} from '../../src/lib/auth';
import {LanguageProvider,useI18n} from '../../src/lib/language';
import {activateLanguage} from '../../src/lib/i18n';
import {TabPageHeader} from '../../src/components/TabPageHeader';
import {BottomSheet} from '../../src/components/BottomSheet';
import {SideDrawer} from '../../src/components/SideDrawer';
import {ConfirmDialog} from '../../src/components/ConfirmDialog';
import './components.css';
import {birthdayAssets} from '../../src/lib/birthdayAssets';
import {SettingGroup,SettingRow} from '../../src/components/SettingRow';

document.documentElement.dataset.siteTheme='birthday-botanical';
for(const [key,url] of Object.entries(birthdayAssets))document.documentElement.style.setProperty(`--birthday-${key}`,`url("${url}")`);
await activateLanguage('zh-CN');
function Gallery(){
  const {t}=useI18n();const [panel,setPanel]=useState('');const [dark,setDark]=useState(false);
  const content=<><SettingGroup><SettingRow title={t('birthday.title')} value="11 / 06" onClick={()=>setPanel('modal')}/><SettingRow title={t('birthday.savedLetters')} value="2" onClick={()=>setPanel('modal')}/></SettingGroup><div className="birthday-gift-frame"><i className="gift-corner top-left"/><i className="gift-corner top-right"/><i className="gift-corner bottom-left"/><i className="gift-corner bottom-right"/><div className="birthday-specimen-letter"><p>{t('birthday.welcomeCopy')}</p><p>{t('birthday.fromFrienden')}</p><button className="button" onClick={()=>setPanel('modal')}>{t('birthday.keepLetter')}</button></div></div></>;
  return <main className="shell-authenticated shell-no-topbar birthday-component-gallery"><TabPageHeader title={t('birthday.componentPreview')} actions={<button className="ghost-button" onClick={()=>{document.documentElement.dataset.theme=dark?'light':'dark';setDark(!dark);}}>{t('birthday.toggleTheme')}</button>}/><div className="birthday-component-body"><p className="birthday-specimen-eyebrow">花间来日 · FRIENDEN</p><h1>{t('birthday.componentPreview')}</h1><div className="birthday-specimen-buttons"><button className="ghost-button">{t('common.cancel')}</button><button className="button" onClick={()=>setPanel('modal')}>{t('common.confirm')}</button></div><nav className="birthday-specimen-nav">{['sheet','drawer','modal'].map(kind=><button key={kind} className="ghost-button" onClick={()=>setPanel(kind)}>{t(`birthday.preview.${kind}`)}</button>)}</nav>{content}<a href="/api/__birthday__/direct">{t('birthday.preview.direct')}</a><a href="/api/__birthday__/group">{t('birthday.preview.group')}</a></div><BottomSheet open={panel==='sheet'} title={t('birthday.savedLetters')} onClose={()=>setPanel('')}>{content}</BottomSheet><SideDrawer open={panel==='drawer'} title={t('birthday.savedLetters')} onClose={()=>setPanel('')}>{content}</SideDrawer><ConfirmDialog open={panel==='modal'} title={t('birthday.wishKeptShort')} onClose={()=>setPanel('')} onConfirm={()=>setPanel('')}/></main>;
}
createRoot(document.getElementById('root')!).render(<BrowserRouter><AuthProvider><LanguageProvider><Gallery/></LanguageProvider></AuthProvider></BrowserRouter>);
