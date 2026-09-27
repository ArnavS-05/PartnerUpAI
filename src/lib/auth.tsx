import { createContext,useCallback,useContext,useEffect,useMemo,useState,type ReactNode } from 'react';
import type { AppConfig } from '../../shared/types';
import { api,configureApi } from './api';
type Status='loading'|'signed_out'|'signed_in';
interface AuthContextValue {status:Status;config:AppConfig|null;configError:boolean;signIn:(email:string,password:string)=>Promise<void>;signUp:(email:string,password:string)=>Promise<{needsConfirmation:boolean}>;signInDemo:()=>Promise<void>;signOut:()=>Promise<void>}
const AuthContext=createContext<AuthContextValue|null>(null);
export function AuthProvider({children}:{children:ReactNode}){
 const [status,setStatus]=useState<Status>('loading'),[config,setConfig]=useState<AppConfig|null>(null),[configError,setConfigError]=useState(false);
 useEffect(()=>{let cancelled=false;configureApi({getToken:async()=>null,onUnauthorized:()=>setStatus('signed_out')});
  api.config().then(async cfg=>{if(cancelled)return;setConfig(cfg);try{await api.me();if(!cancelled)setStatus('signed_in');}catch{if(!cancelled)setStatus('signed_out');}}).catch(()=>{if(!cancelled){setConfigError(true);setStatus('signed_out');}});
  return()=>{cancelled=true;};
 },[]);
 const signIn=useCallback(async(email:string,password:string)=>{await api.signIn(email,password);setStatus('signed_in');},[]);
 const signUp=useCallback(async(email:string,password:string)=>{await api.signUp(email,password);setStatus('signed_in');return{needsConfirmation:false};},[]);
 const signInDemo=useCallback(async()=>{await api.demo();setStatus('signed_in');},[]);
 const signOut=useCallback(async()=>{await api.signOut();setStatus('signed_out');},[]);
 const value=useMemo(()=>({status,config,configError,signIn,signUp,signInDemo,signOut}),[status,config,configError,signIn,signUp,signInDemo,signOut]);
 return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(){const value=useContext(AuthContext);if(!value)throw new Error('AuthProvider missing');return value;}
