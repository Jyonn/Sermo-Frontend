import {createContext,useContext,useEffect,useState,type ReactNode} from 'react';
import {useAuth} from './auth';
import {useBirthday} from './birthday';
import {useI18n} from './language';
import {availablePersonalThemes,selectedPersonalTheme,christmasBackgroundOverride,type PersonalTheme} from './personalThemePolicy';
import {useSpaceFeatures} from './spaceFeatures';
import {useInterfacePreferences, type InterfacePreferences} from './interfacePreferences';
import {showToast} from './toast';

const Context=createContext<ReturnType<typeof useThemeState>|null>(null);
function useThemeState(){
  const {session}=useAuth(),{status}=useBirthday();
  const {t}=useI18n();
  const features=useSpaceFeatures();
  const {scope, preferences, save, loaded}=useInterfacePreferences();
  const [tick,setTick]=useState(Date.now);
  // Keep the server's clock advancing between responses, even if the device clock differs.
  const [clock,setClock]=useState<{server:number;local:number}|null>(null);
  useEffect(()=>{setClock(status?{server:status.server_now*1000,local:Date.now()}:null)},[status?.server_now,session?.user.user_id]);
  useEffect(()=>{
    const refresh=()=>setTick(Date.now());
    const timer=window.setInterval(refresh,30_000);
    window.addEventListener('focus',refresh);
    document.addEventListener('visibilitychange',refresh);
    return()=>{clearInterval(timer);window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',refresh)};
  },[]);
  const now=clock?clock.server+Math.max(0,tick-clock.local):tick;
  const birthdayActive=Boolean(status?.active&&(!status.ends_at||now<status.ends_at*1000));
  const unlocks=availablePersonalThemes(now,birthdayActive,status?.celebration_id,session?{id:session.user.space_id,theme:features.siteTheme}:undefined);
  const theme=session?selectedPersonalTheme(unlocks,preferences.personal_theme??null):'default';
  const overrideBackground=christmasBackgroundOverride({christmasBackgroundOverride:preferences.christmas_background_override});
  useEffect(()=>{
    if(scope) document.documentElement.dataset.christmasBackground=overrideBackground?'override':'personal';
    else delete document.documentElement.dataset.christmasBackground;
    return()=>{delete document.documentElement.dataset.christmasBackground;};
  },[scope,overrideBackground]);
  const unseen=unlocks.filter(item=>item.theme!=='default'&&!preferences.seen_theme_tokens?.includes(item.token));
  const pending=loaded&&unseen.length>0;
  function persist(next:InterfacePreferences) {
    void save(next).catch(error=>{
      if (!(error instanceof DOMException && error.name==='AbortError')) showToast(t('common.saveFailed'),'error');
    });
  }
  return {
    scope,theme,unlocks,pending,loaded,
    christmasBackgroundOverride:overrideBackground,
    setChristmasBackgroundOverride:(value:boolean)=>persist({christmas_background_override:value}),
    select:(next:PersonalTheme)=>{
      if(unlocks.some(item=>item.theme===next)) persist({personal_theme:{period:unlocks.map(item=>item.token).join('|'),theme:next}});
    },
    acknowledge:()=>{
      if(pending) void save({seen_theme_tokens:unseen.map(item=>item.token)}).catch(()=>undefined);
    },
  };
}
export function PersonalThemeProvider({children}:{children:ReactNode}){const value=useThemeState();return <Context.Provider value={value}>{children}</Context.Provider>}
export function usePersonalTheme(){const value=useContext(Context);if(!value)throw Error('PersonalThemeProvider is required');return value}
export function useChristmasBackgroundOverride(){const value=useContext(Context);return value?.theme==='christmas-2026'&&value.christmasBackgroundOverride;}
export function ThemeDiscoveryDot(){const {pending}=usePersonalTheme(),{t}=useI18n();return pending?<span className="update-available-dot" role="img" aria-label={t('menu.themeNew')}/>:null}
