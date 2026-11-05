import {createContext,useContext,useEffect,useCallback,useRef,useState,type ReactNode} from 'react';
import {useAuth} from './auth';
import {api} from './api';
import type {BirthdayStatus} from './birthdayTypes';

interface BirthdayContextValue {
  status:BirthdayStatus|null;
  loading:boolean;
  refresh:()=>Promise<void>;
  update:(status:BirthdayStatus)=>void;
  openWelcome:()=>void;
  welcomeOpen:boolean;
  closeWelcome:()=>void;
  reminderDismissed:boolean;
  dismissReminder:()=>void;
}
const Context=createContext<BirthdayContextValue|null>(null);
export function BirthdayProvider({children}:{children:ReactNode}){
  const {session}=useAuth();
  const userId=session?.user.user_id;
  const [record,setRecord]=useState<{userId:number;status:BirthdayStatus}|null>(null);
  const [loading,setLoading]=useState(false);
  const [welcomeUser,setWelcomeUser]=useState<number|null>(null);
  const [dismissedUser,setDismissedUser]=useState<number|null>(null);
  const sequence=useRef(0);
  const controller=useRef<AbortController>();
  const currentUser=useRef(userId);currentUser.current=userId;
  const status=record&&record.userId===userId?record.status:null;
  const update=useCallback((next:BirthdayStatus)=>{
    if(userId&&currentUser.current===userId){sequence.current++;controller.current?.abort();setLoading(false);setRecord({userId,status:next});}
  },[userId]);
  useEffect(()=>setWelcomeUser(null),[userId]);
  const refresh=useCallback(async()=>{
    if(!userId)return;
    const id=++sequence.current;controller.current?.abort();controller.current=new AbortController();
    setLoading(true);
    try{const next=await api.getBirthday(controller.current.signal);if(id===sequence.current&&currentUser.current===userId)setRecord({userId,status:next});}
    catch{/* An unavailable birthday service must never block chats or repeatedly open a celebration. */}
    finally{if(id===sequence.current)setLoading(false);}
  },[userId]);
  useEffect(()=>{
    void refresh();
    const foreground=()=>{if(document.visibilityState==='visible')void refresh();};
    document.addEventListener('visibilitychange',foreground);
    const timer=window.setInterval(foreground,180_000);
    return()=>{sequence.current++;controller.current?.abort();window.clearInterval(timer);document.removeEventListener('visibilitychange',foreground);};
  },[refresh]);
  useEffect(()=>{
    if(!status?.active||!status.ends_at||!userId)return;
    const expire=()=>{setRecord(current=>current?.userId===userId?{...current,status:{...current.status,active:false,auto_open:false,letters:[]}}:current);setWelcomeUser(null);void refresh();};
    const timer=window.setTimeout(expire,Math.max(1000,(status.ends_at-status.server_now)*1000));
    return()=>window.clearTimeout(timer);
  },[status?.active,status?.ends_at,status?.server_now,userId,refresh]);
  return <Context.Provider value={{status,loading,refresh,update,reminderDismissed:!!userId&&dismissedUser===userId,dismissReminder:()=>{if(userId)setDismissedUser(userId);},welcomeOpen:Boolean(userId&&welcomeUser===userId&&status?.active),openWelcome:()=>{if(userId&&status?.active)setWelcomeUser(userId);},closeWelcome:()=>setWelcomeUser(null)}}>{children}</Context.Provider>;
}
export function useBirthday(){const value=useContext(Context);if(!value)throw Error('BirthdayProvider is required');return value;}
