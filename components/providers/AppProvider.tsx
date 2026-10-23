'use client';

import { createContext, useContext, useState, useEffect, useCallback, useRef, useSyncExternalStore } from 'react';
import type { User } from '@supabase/supabase-js';
import * as dataCache from '@/lib/supabase/dataCache';
import { removeLegacyLocalStorage } from '@/lib/storage';

interface AppContextValue {
  user: User | null;
  ready: boolean;
  offline: boolean;
  dbMissing: boolean;
  loadFailed: boolean;
  dataVersion: number;
  displayName: string;
  email: string;
  signOut: () => Promise<void>;
  retryLoad: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [offline, setOffline] = useState(false);
  const [dbMissing, setDbMissing] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const initRef = useRef(false);

  const dataVersion = useSyncExternalStore(dataCache.subscribe, dataCache.getVersion, () => 0);

  const initAuth = useCallback(async () => {
    if (initRef.current) return;
    initRef.current = true;

    try {
      const { getSupabaseBrowserClient } = await import('@/lib/supabase/client');
      const supabase = getSupabaseBrowserClient();
      const { data: { user: u } } = await supabase.auth.getUser();

      if (u) {
        setUser(u);
        setEmail(u.email ?? '');
        setDisplayName(u.user_metadata?.display_name ?? '');
        try {
          const result = await dataCache.hydrate(u.id);
          if (!result.ok && result.dbMissing) setDbMissing(true);
          else if (result.ok) setDbMissing(false);
        } catch {
          if (!dataCache.isHydrated()) {
            setLoadFailed(true);
          }
          setOffline(!navigator.onLine);
        }
      }

      setReady(true);

      supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_OUT') {
          const prev = dataCache.getUserId();
          dataCache.clear();
          if (prev) dataCache.clearOfflineCache(prev);
          removeLegacyLocalStorage();
          setUser(null);
          setEmail('');
          setDisplayName('');
          setLoadFailed(false);
          setDbMissing(false);
          window.location.href = '/login';
        }
        if (event === 'SIGNED_IN' && session?.user) {
          setUser(session.user);
          setEmail(session.user.email ?? '');
          setDisplayName(session.user.user_metadata?.display_name ?? '');
          if (dataCache.isHydrated() && dataCache.getUserId() === session.user.id) {
            return;
          }
          setReady(false);
          setLoadFailed(false);
          try {
            const result = await dataCache.hydrate(session.user.id);
            if (!result.ok && result.dbMissing) setDbMissing(true);
            else if (result.ok) setDbMissing(false);
          } catch {
            if (!dataCache.isHydrated()) {
              setLoadFailed(true);
            }
            setOffline(!navigator.onLine);
          }
          setReady(true);
        }
        if (event === 'USER_UPDATED' && session?.user) {
          setUser(session.user);
          setDisplayName(session.user.user_metadata?.display_name ?? '');
        }
      });
    } catch {
      setOffline(!navigator.onLine);
      setReady(true);
    }
  }, []);

  useEffect(() => { initAuth(); }, [initAuth]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'hidden') {
        dataCache.flushAll();
      } else if (user) {
        dataCache.sync();
        setOffline(!navigator.onLine);
      }
    };
    const onOnline = () => { setOffline(false); if (user) dataCache.sync(); };
    const onOffline = () => setOffline(true);
    const onUnload = () => { dataCache.flushAll(); };

    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    window.addEventListener('beforeunload', onUnload);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('beforeunload', onUnload);
    };
  }, [user]);

  const retryLoad = useCallback(async () => {
    if (!user) return;
    setLoadFailed(false);
    setReady(false);
    try {
      const result = await dataCache.hydrate(user.id);
      if (!result.ok && result.dbMissing) setDbMissing(true);
      else if (result.ok) setDbMissing(false);
    } catch {
      if (!dataCache.isHydrated()) setLoadFailed(true);
      setOffline(!navigator.onLine);
    }
    setReady(true);
  }, [user]);

  const signOut = useCallback(async () => {
    try {
      const { getSupabaseBrowserClient } = await import('@/lib/supabase/client');
      await getSupabaseBrowserClient().auth.signOut();
    } catch {
      window.location.href = '/login';
    }
  }, []);

  if (dbMissing && user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6" style={{ backgroundColor: '#111111' }}>
        <p className="text-[17px] font-semibold mb-2" style={{ color: '#FF9500' }}>
          DayOS isn&apos;t fully set up yet
        </p>
        <p className="text-[15px] mb-6 text-center" style={{ color: '#8E8E93' }}>
          The database tables haven&apos;t been created. Ask the app owner to run the setup SQL.
        </p>
        <button
          onClick={retryLoad}
          className="px-6 py-3 rounded-btn text-[15px] font-semibold mb-3"
          style={{ backgroundColor: '#30D158', color: '#000' }}
        >
          Try again
        </button>
        <button
          onClick={signOut}
          className="text-[14px]"
          style={{ color: '#FF453A' }}
        >
          Sign out
        </button>
      </div>
    );
  }

  if (loadFailed && user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6" style={{ backgroundColor: '#111111' }}>
        <p className="text-[17px] font-semibold mb-2" style={{ color: '#FF453A' }}>
          Couldn&apos;t load your data
        </p>
        <p className="text-[15px] mb-6 text-center" style={{ color: '#8E8E93' }}>
          Check your connection and try again.
        </p>
        <button
          onClick={retryLoad}
          className="px-6 py-3 rounded-btn text-[15px] font-semibold mb-3"
          style={{ backgroundColor: '#30D158', color: '#000' }}
        >
          Try again
        </button>
        <button
          onClick={signOut}
          className="text-[14px]"
          style={{ color: '#FF453A' }}
        >
          Sign out
        </button>
      </div>
    );
  }

  return (
    <AppContext.Provider value={{ user, ready, offline, dbMissing, loadFailed, dataVersion, displayName, email, signOut, retryLoad }}>
      {children}
      {offline && user && ready && (
        <div
          className="fixed top-0 left-0 right-0 z-[100] text-center py-1.5 text-[12px] font-medium"
          style={{ backgroundColor: '#FF9500', color: '#000' }}
        >
          Offline — changes will sync when you&apos;re back
        </div>
      )}
    </AppContext.Provider>
  );
}
