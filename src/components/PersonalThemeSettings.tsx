import {useEffect} from 'react';
import {usePersonalTheme} from '../lib/personalTheme';
import {useI18n,type TranslationKey} from '../lib/language';
import type {PersonalTheme,ThemeUnlock} from '../lib/personalThemePolicy';
import './PersonalThemeSettings.css';

export const personalThemeLabels:Record<PersonalTheme,TranslationKey>={default:'menu.themeDefault','christmas-2026':'menu.themeChristmas','birthday-botanical':'menu.themeBirthday'};
const icons:Record<PersonalTheme,string>={default:'palette','christmas-2026':'forest','birthday-botanical':'cake'};
export function PersonalThemeSettings(){
  const {scope,theme,unlocks,select,acknowledge}=usePersonalTheme();
  const period=unlocks.map(item=>item.token).join('|');
  useEffect(()=>{acknowledge()},[scope,period]);
  return <PersonalThemeChoices theme={theme} unlocks={unlocks} select={select}/>;
}
export function PersonalThemeChoices({theme,unlocks,select}:{theme:PersonalTheme;unlocks:ThemeUnlock[];select:(theme:PersonalTheme)=>void}){
  const {t}=useI18n();
  return <div className="personal-theme-options" role="radiogroup" aria-label={t('menu.siteTheme')}>
    {unlocks.map(item=><button type="button" role="radio" aria-checked={theme===item.theme} className={`personal-theme-option theme-${item.theme}`} key={item.theme} onClick={()=>select(item.theme)}><span className="personal-theme-swatch" aria-hidden="true"><span className="material-symbols-outlined">{icons[item.theme]}</span></span><strong>{t(personalThemeLabels[item.theme])}</strong><span className="material-symbols-outlined personal-theme-check" aria-hidden="true">{theme===item.theme?'check_circle':'radio_button_unchecked'}</span></button>)}
  </div>;
}
