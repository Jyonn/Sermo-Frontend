import {createContext,lazy,Suspense,useContext,useState,type ReactNode} from 'react';
import {useLocation,useNavigate} from 'react-router-dom';
import {useAuth} from './auth';
import {useI18n} from './language';
import {activityKeyFromSearch,activityOverlaySearch} from './activityOverlayRoute';
import {SideDrawer} from '../components/SideDrawer';
import {FloatingDrawerScope} from '../components/DesktopPanelWorkspace';
import {ActivityLoadingState} from '../components/ActivityLoadingState';
import {activityDrawerClassName} from './activityTheme';
import {LANDLORD_ROOM_PARAM} from './landlord';
import '../components/GameTableLayout.css';
const Experience=lazy(()=>import('../components/ActivityExperience').then(module=>({default:module.ActivityExperience})));
const ActivityOverlayContext=createContext<(key:string,room?:string)=>void>(()=>undefined);
const ActivityPageReadyContext=createContext<(path:string)=>void>(()=>undefined);
export const useActivityOverlay=()=>useContext(ActivityOverlayContext);
export const useActivityPageReady=()=>useContext(ActivityPageReadyContext);

export function ActivityOverlayProvider({children}:{children:ReactNode}) {
  const location=useLocation();
  const navigate=useNavigate();
  const {session}=useAuth();
  const {t}=useI18n();
  const [readyPath,setReadyPath]=useState<string|null>(null);
  const key=activityKeyFromSearch(location.search);
  const open=(activityKey:string,room?:string)=>{
    if(activityKey===key && (room ?? null) === new URLSearchParams(location.search).get(LANDLORD_ROOM_PARAM))return;
    // Shared drawers also write their path with history.pushState. Read that
    // current path so opening an activity preserves the complete parent stack.
    navigate({pathname:location.pathname,search:activityOverlaySearch(window.location.search,activityKey,room),hash:window.location.hash},{state:{...location.state,activityOverlay:true}});
  };
  const close=()=>{
    if(location.state?.activityOverlay)navigate(-1);
    else navigate({pathname:location.pathname,search:activityOverlaySearch(location.search,null),hash:location.hash},{replace:true});
  };
  return <ActivityOverlayContext.Provider value={open}><ActivityPageReadyContext.Provider value={setReadyPath}>
    {children}
    {session && key && readyPath === location.pathname ? <FloatingDrawerScope standalone>
      <Suspense fallback={<SideDrawer open trapFocus className={activityDrawerClassName(key)} contentUnderToolbar historyMode="route" onClose={close} title={t('activity.title')}><ActivityLoadingState /></SideDrawer>}>
        <Experience key={`${session.user.user_id}:${key}`} activityKey={key} onClose={close} />
      </Suspense>
    </FloatingDrawerScope> : null}
  </ActivityPageReadyContext.Provider></ActivityOverlayContext.Provider>;
}
