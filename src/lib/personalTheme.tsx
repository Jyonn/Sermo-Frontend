import {createContext,useContext,useEffect,useState,type ReactNode} from 'react';
import {useAuth} from './auth';
import {useBirthday} from './birthday';
import {useI18n} from './language';
import {availablePersonalThemes,selectedPersonalTheme,type PersonalTheme} from './personalThemePolicy';

interface SavedTheme {period?:string;theme?:string;seen?:string[]}
function read(key:string):SavedTheme {try{const value=JSON.parse(localStorage.getItem(key)||'{}');return value&&typeof value==='object'?value:{}}catch{return {}}}
const Context=createContext<ReturnType<typeof useThemeState>|null>(null);
function useThemeState(){
  const {session}=useAuth(),{status}=useBirthday();
  const key=`frienden:personal-theme:${session?.user.space_id??''}:${session?.user.user_id??''}`;
  const [tick,setTick]=useState(Date.now),[revision,setRevision]=useState(0);
  // Keep the server's clock advancing between responses, even if the device clock differs.
  const [clock,setClock]=useState<{server:number;local:number}|null>(null);
  useEffect(()=>{setClock(status?{server:status.server_now*1000,local:Date.now()}:null)},[status?.server_now,session?.user.user_id]);
  useEffect(()=>{const refresh=()=>setTick(Date.now());const storage=(event:StorageEvent)=>{if(event.key===key)setRevision(x=>x+1)};const timer=window.setInterval(refresh,30_000);window.addEventListener('focus',refresh);window.addEventListener('storage',storage);document.addEventListener('visibilitychange',refresh);return()=>{clearInterval(timer);window.removeEventListener('focus',refresh);window.removeEventListener('storage',storage);document.removeEventListener('visibilitychange',refresh)}},[key]);
  const now=clock?clock.server+Math.max(0,tick-clock.local):tick;
  const birthdayActive=Boolean(status?.active&&(!status.ends_at||now<status.ends_at*1000));
  const unlocks=availablePersonalThemes(now,birthdayActive,status?.celebration_id);
  const saved=read(key);void revision;
  const theme=session?selectedPersonalTheme(unlocks,saved):'default';
  const seen=Array.isArray(saved.seen)?saved.seen:[];
  const pending=Boolean(session)&&unlocks.some(item=>item.theme!=='default'&&!seen.includes(item.token));
  function persist(next:SavedTheme){try{localStorage.setItem(key,JSON.stringify(next))}catch{/* Storage restrictions must not block the menu. */}setRevision(x=>x+1)}
  return {scope:key,theme,unlocks,pending,select:(next:PersonalTheme)=>{if(unlocks.some(item=>item.theme===next))persist({...saved,period:unlocks.map(item=>item.token).join('|'),theme:next})},acknowledge:()=>persist({...saved,seen:[...new Set([...seen,...unlocks.filter(item=>item.theme!=='default').map(item=>item.token)])].slice(-20)})};
}
export function PersonalThemeProvider({children}:{children:ReactNode}){const value=useThemeState();return <Context.Provider value={value}>{children}</Context.Provider>}
export function usePersonalTheme(){const value=useContext(Context);if(!value)throw Error('PersonalThemeProvider is required');return value}
export function ThemeDiscoveryDot(){const {pending}=usePersonalTheme(),{t}=useI18n();return pending?<span className="update-available-dot" role="img" aria-label={t('menu.themeNew')}/>:null}
