import React, { useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../services/api';
import { AuthContext } from './authContextDef';

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profileError, setProfileError] = useState('');

  const refreshProfile = async () => {
    setLoading(true);
    try {
      const me = await api.getCurrentUser();
      setSession(me ? { user: me.user } : null);
      setProfile(me?.profile || null);
      setProfileError('');
      return me?.profile || null;
    } catch (error) {
      setProfileError(error.message || 'Unable to load your account.');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    api.initializeSecurity()
      .then(() => api.getCurrentUser())
      .then((me) => {
        if (active) {
          setSession(me ? { user: me.user } : null);
          setProfile(me?.profile || null);
        }
      })
      .catch((error) => {
        if (active) setProfileError(error.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    const onFocus = () =>
      api.getCurrentUser()
        .then((me) => {
          if (active) {
            setSession(me ? { user: me.user } : null);
            setProfile(me?.profile || null);
          }
        })
        .catch(() => {});

    window.addEventListener('focus', onFocus);
    return () => {
      active = false;
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  const value = useMemo(
    () => ({
      session,
      user: session?.user || null,
      profile,
      loading,
      configured: true,
      profileError,
      needsProfileCompletion: false,
      refreshProfile,
      async signOut() {
        await api.logout();
        setSession(null);
        setProfile(null);
        setProfileError('');
      },
      async authenticate(data) {
        setSession(data?.user ? { user: data.user } : null);
        setProfile(data?.profile || data?.user || null);
        setProfileError('');
      },
    }),
    [session, profile, loading, profileError]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
