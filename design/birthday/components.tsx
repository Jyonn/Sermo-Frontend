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
import {SettingGroup,SettingRow,SettingSwitch} from '../../src/components/SettingRow';
import {birthdayAssets} from '../../src/lib/birthdayAssets';
import './components.css';

document.documentElement.dataset.siteTheme='birthday-botanical';
for(const [key,url] of Object.entries(birthdayAssets))document.documentElement.style.setProperty(`--birthday-${key}`,`url("${url}")`);
await activateLanguage('zh-CN');
void document.fonts.load('24px "Material Symbols Outlined"').then(()=>document.documentElement.classList.add('material-symbols-ready'));
function Gallery(){
  const {t}=useI18n();const [panel,setPanel]=useState('');const [dark,setDark]=useState(false);const [notifications,setNotifications]=useState(true);
  const rows=<SettingGroup><SettingRow title={t('menu.basicInfo')} onClick={()=>setPanel('drawer')}/><SettingRow title={t('menu.notifications')} trailing={<SettingSwitch label={t('menu.notifications')} checked={notifications} onChange={setNotifications}/>}/><SettingRow title={t('menu.personalization')} value={t(dark?'menu.themeDark':'menu.themeLight')} onClick={()=>setPanel('sheet')}/></SettingGroup>;
  const contacts=<SettingGroup><SettingRow title={t('contacts.requests')} value="2" onClick={()=>setPanel('modal')}/><SettingRow title={t('contacts.groups')} value="4" onClick={()=>setPanel('drawer')}/></SettingGroup>;
  return <main className="shell-authenticated shell-no-topbar birthday-component-gallery">
    <TabPageHeader title={t('birthday.componentPreview')} actions={<button className="ghost-button" onClick={()=>{document.documentElement.dataset.theme=dark?'light':'dark';setDark(!dark);}}>{t('birthday.toggleTheme')}</button>}/>
    <div className="birthday-study-grid">
      <section className="birthday-study-invitation"><img src={birthdayAssets.hero} alt=""/><div><small>FRIENDEN · BIRTHDAY</small><h1>{t('birthday.welcomeTitle')}</h1><a className="button" href="/api/__birthday__/celebrate">{t('birthday.reopen')}<span>↗</span></a></div></section>
      <section className="birthday-study-controls"><h2>{t('menu.title')}</h2>{rows}<div className="birthday-study-actions"><button className="ghost-button" onClick={()=>setPanel('modal')}>{t('common.cancel')}</button><button className="button" onClick={()=>setPanel('modal')}>{t('common.confirm')}</button></div><nav className="birthday-study-surfaces">{(['sheet','drawer','modal'] as const).map(kind=><button key={kind} onClick={()=>setPanel(kind)}><span>{t(`birthday.preview.${kind}`)}</span><span>↗</span></button>)}</nav><nav className="birthday-study-links"><a href="/api/__birthday__/direct">{t('birthday.preview.direct')} ↗</a><a href="/api/__birthday__/group">{t('birthday.preview.group')} ↗</a></nav></section>
    </div>
    <BottomSheet open={panel==='sheet'} title={t('menu.notifications')} onClose={()=>setPanel('')}><div className="birthday-study-panel-content">{rows}</div></BottomSheet>
    <SideDrawer open={panel==='drawer'} title={t('contacts.title')} onClose={()=>setPanel('')}><div className="birthday-study-panel-content">{contacts}{rows}</div></SideDrawer>
    <ConfirmDialog open={panel==='modal'} title={t('menu.switchAccount')} onClose={()=>setPanel('')} onConfirm={()=>setPanel('')}/>
  </main>;
}
createRoot(document.getElementById('root')!).render(<BrowserRouter><AuthProvider><LanguageProvider><Gallery/></LanguageProvider></AuthProvider></BrowserRouter>);
