import {useEffect,useState} from 'react';
import {usePersonalTheme} from '../lib/personalTheme';
import {useI18n,type TranslationKey} from '../lib/language';
import type {PersonalTheme,ThemeUnlock} from '../lib/personalThemePolicy';
import './PersonalThemeSettings.css';
import {SettingsDialog} from './SettingsDialog';
import {SettingGroup,SettingRow,SettingSwitch} from './SettingRow';

export const personalThemeLabels:Record<PersonalTheme,TranslationKey>={default:'menu.themeDefault','christmas-2026':'menu.themeChristmas','birthday-botanical':'menu.themeBirthday'};
const icons:Record<PersonalTheme,string>={default:'palette','christmas-2026':'forest','birthday-botanical':'cake'};
export function PersonalThemeSettings(){
  const {scope,theme,unlocks,select,acknowledge,christmasBackgroundOverride,setChristmasBackgroundOverride}=usePersonalTheme();
  const {t}=useI18n();
  const [moreScope,setMoreScope]=useState<string|null>(null);
  const christmasUnlocked=unlocks.some(item=>item.theme==='christmas-2026');
  const period=unlocks.map(item=>item.token).join('|');
  useEffect(()=>{acknowledge()},[scope,period]);
  return <><PersonalThemeChoices theme={theme} unlocks={unlocks} select={select} onChristmasMore={()=>setMoreScope(scope)}/>
    <SettingsDialog open={christmasUnlocked&&moreScope===scope} title={t('menu.christmasMoreSettings')} onClose={()=>setMoreScope(null)}>
      <SettingGroup><SettingRow title={t('menu.christmasBackgroundOverride')} description={t('menu.christmasBackgroundOverrideHint')} trailing={<SettingSwitch label={t('menu.christmasBackgroundOverride')} checked={christmasBackgroundOverride} onChange={setChristmasBackgroundOverride}/>}/></SettingGroup>
    </SettingsDialog>
  </>;
}
export function PersonalThemeChoices({theme,unlocks,select,onChristmasMore}:{theme:PersonalTheme;unlocks:ThemeUnlock[];select:(theme:PersonalTheme)=>void;onChristmasMore?:()=>void}){
  const {t}=useI18n();
  return <div className="personal-theme-options" role="radiogroup" aria-label={t('menu.siteTheme')}>
    {unlocks.map(item=><div className={`personal-theme-option-row${item.theme==='christmas-2026'&&onChristmasMore?' has-more':''}`} key={item.theme} role="presentation"><button type="button" role="radio" aria-checked={theme===item.theme} className={`personal-theme-option theme-${item.theme}`} onClick={()=>select(item.theme)}><span className="personal-theme-swatch" aria-hidden="true"><span className="material-symbols-outlined">{icons[item.theme]}</span></span><strong>{t(personalThemeLabels[item.theme])}</strong><span className="material-symbols-outlined personal-theme-check" aria-hidden="true">{theme===item.theme?'check_circle':'radio_button_unchecked'}</span></button>{item.theme==='christmas-2026'&&onChristmasMore?<button type="button" className="personal-theme-more" aria-label={t('menu.christmasMoreSettings')} title={t('menu.christmasMoreSettings')} onClick={onChristmasMore}><span className="material-symbols-outlined" aria-hidden="true">more_horiz</span></button>:null}</div>)}
  </div>;
}
