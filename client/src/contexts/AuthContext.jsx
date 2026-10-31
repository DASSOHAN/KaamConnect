import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../services/api';

const AuthContext = createContext(null);
export function AuthProvider({ children }) {
  const [session,setSession]=useState(null),[profile,setProfile]=useState(null),[loading,setLoading]=useState(true),[profileError,setProfileError]=useState('');
  const refreshProfile=async()=>{setLoading(true);try{const me=await api.getCurrentUser();setSession(me?{user:me.user}:null);setProfile(me?.profile||null);setProfileError('');return me?.profile||null;}catch(error){setProfileError(error.message||'Unable to load your account.');throw error;}finally{setLoading(false);}};
  useEffect(()=>{let active=true;api.initializeSecurity().then(()=>api.getCurrentUser()).then(me=>{if(active){setSession(me?{user:me.user}:null);setProfile(me?.profile||null);}}).catch(error=>{if(active)setProfileError(error.message);}).finally(()=>{if(active)setLoading(false);});
    const onFocus=()=>api.getCurrentUser().then(me=>{if(active){setSession(me?{user:me.user}:null);setProfile(me?.profile||null);}}).catch(()=>{});window.addEventListener('focus',onFocus);return()=>{active=false;window.removeEventListener('focus',onFocus);};},[]);
  const value=useMemo(()=>({session,user:session?.user||null,profile,loading,configured:true,profileError,needsProfileCompletion:false,refreshProfile,async signOut(){await api.logout();setSession(null);setProfile(null);setProfileError('');},async authenticate(data){setSession(data?.user?{user:data.user}:null);setProfile(data?.profile||data?.user||null);setProfileError('');}}),[session,profile,loading,profileError]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuth(){const context=useContext(AuthContext);if(!context)throw new Error('useAuth must be used inside AuthProvider');return context;}
