import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../services/api';
import { browserSupabase, supabaseConfigured } from '../services/supabase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(supabaseConfigured);

  useEffect(() => {
    if (!browserSupabase) return undefined;
    let active = true;
    let requestId = 0;
    const loadProfile = async (nextSession) => {
      const request = ++requestId;
      if (!nextSession?.access_token) { if (active) { setProfile(null); setLoading(false); } return; }
      if (active) { setProfile(null); setLoading(true); }
      try {
        let account;
        try { account = await api.getAccountProfile(nextSession.access_token); }
        catch (error) {
          if (error.status !== 404) throw error;
          account = await api.saveAccountProfile(nextSession.access_token, {
            fullName: nextSession.user.user_metadata?.full_name || nextSession.user.email?.split('@')[0] || 'KaamConnect member',
            phone: nextSession.user.user_metadata?.phone || '',
            role: nextSession.user.user_metadata?.role === 'worker' ? 'worker' : 'customer',
          });
        }
        if (active && request === requestId) setProfile(account);
      } catch (error) {
        console.error('Unable to load KaamConnect account profile:', error);
        if (active && request === requestId) setProfile(null);
      } finally {
        if (active && request === requestId) setLoading(false);
      }
    };

    browserSupabase.auth.getSession().then(({ data, error }) => {
      if (error) console.error('Unable to restore Supabase session:', error);
      if (!active) return;
      setSession(data?.session || null);
      loadProfile(data?.session || null);
    });
    const { data: listener } = browserSupabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      loadProfile(nextSession);
    });
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, []);

  const value = useMemo(() => ({
    session, user: session?.user || null, profile, loading, configured: supabaseConfigured,
    async refreshProfile() {
      if (!session?.access_token) { setProfile(null); return null; }
      const next = await api.getAccountProfile(session.access_token);
      setProfile(next);
      return next;
    },
    async signOut() {
      if (!browserSupabase) return;
      const { error } = await browserSupabase.auth.signOut();
      if (error) throw error;
    },
  }), [session, profile, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
