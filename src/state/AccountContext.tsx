import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { User } from '@supabase/supabase-js';
import { ConfirmDialog } from '../components/Common';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { normalizeState } from '../lib/storage';
import type { AppState } from '../types';
import { useAppState } from './AppState';

export type SyncStatus = 'local' | 'syncing' | 'synced' | 'error';

interface ConflictInfo {
  remoteState: AppState;
  remoteUpdatedAt: string;
}

export interface AccountContextValue {
  configured: boolean;
  user: User | null;
  email: string | null;
  status: SyncStatus;
  lastSyncedAt: string | null;
  message: string | null;
  conflict: ConflictInfo | null;
  signIn(email: string, password: string): Promise<{ error?: string }>;
  signUp(
    email: string,
    password: string,
  ): Promise<{ error?: string; needsConfirmation?: boolean }>;
  signOut(): Promise<void>;
  syncNow(): Promise<void>;
  resolveConflict(choice: 'cloud' | 'local'): Promise<void>;
}

const AccountContext = createContext<AccountContextValue | null>(null);

const stateHasData = (value: AppState): boolean =>
  Object.keys(value.progress).length > 0 ||
  Object.keys(value.favorites).length > 0 ||
  Object.values(value.daily).some((day) => day.newCount + day.reviewCount > 0);

const stateSummary = (value: AppState): string =>
  `已学 ${Object.keys(value.progress).length} 词 · 收藏 ${Object.keys(value.favorites).length} 个`;

function friendlyAuthError(message: string): string {
  if (/invalid login credentials/i.test(message)) return '邮箱或密码不正确';
  if (/email not confirmed/i.test(message)) return '邮箱尚未验证，请先查收确认邮件';
  if (/user already registered/i.test(message)) return '该邮箱已注册，请直接登录';
  if (/password should be at least/i.test(message)) return '密码至少需要 6 位';
  if (/failed to fetch|network/i.test(message)) return '无法连接账号服务，请检查网络';
  return message;
}

function friendlySyncError(message: string): string {
  if (/failed to fetch|network/i.test(message)) return '无法连接云同步服务，请检查网络';
  if (/row-level security|permission|policy/i.test(message)) {
    return '云同步权限不足，请检查 Supabase 表权限（RLS）设置';
  }
  return message;
}

function metaKeys(userId: string) {
  return {
    state: `shici-sync-state-${userId}`,
    at: `shici-sync-at-${userId}`,
  };
}

export function AccountProvider({ children }: { children: ReactNode }) {
  const { state, dispatch } = useAppState();
  const stateRef = useRef(state);
  stateRef.current = state;

  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<SyncStatus>('local');
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [conflict, setConflict] = useState<ConflictInfo | null>(null);
  const [syncReady, setSyncReady] = useState(false);

  const lastUploadedRef = useRef<string | null>(null);
  const suppressSyncRef = useRef(false);
  const explicitSignInRef = useRef(false);
  const signedInUserRef = useRef<string | null>(null);

  const uploadState = useCallback(async (currentUser: User, nextState: AppState) => {
    if (!supabase) return false;
    setStatus('syncing');
    setMessage(null);
    const now = new Date().toISOString();
    const { error } = await supabase.from('user_state').upsert(
      { user_id: currentUser.id, state: nextState, updated_at: now },
      { onConflict: 'user_id' },
    );
    if (error) {
      setStatus('error');
      setMessage(friendlySyncError(error.message));
      return false;
    }
    const json = JSON.stringify(nextState);
    lastUploadedRef.current = json;
    const keys = metaKeys(currentUser.id);
    try {
      localStorage.setItem(keys.state, json);
      localStorage.setItem(keys.at, now);
    } catch {
      // Sync metadata is an optimization; ignore storage quota errors.
    }
    setLastSyncedAt(now);
    setStatus('synced');
    setMessage('已同步到云端');
    setSyncReady(true);
    return true;
  }, []);

  const applyRemote = useCallback(
    (currentUser: User, remote: AppState, remoteAt: string) => {
      const json = JSON.stringify(remote);
      suppressSyncRef.current = true;
      lastUploadedRef.current = json;
      const keys = metaKeys(currentUser.id);
      try {
        localStorage.setItem(keys.state, json);
        localStorage.setItem(keys.at, remoteAt);
      } catch {
        // ignore
      }
      dispatch({ type: 'replaceState', state: remote });
      setConflict(null);
      setLastSyncedAt(remoteAt || null);
      setStatus('synced');
      setMessage('已载入云端进度');
      setSyncReady(true);
    },
    [dispatch],
  );

  const showConflict = useCallback((remote: AppState, remoteAt: string) => {
    setConflict({ remoteState: remote, remoteUpdatedAt: remoteAt });
    setStatus('error');
    setMessage('发现云端与本机数据不一致，请选择保留哪一份');
    setSyncReady(false);
  }, []);

  const pullRemote = useCallback(
    async (currentUser: User, explicit: boolean) => {
      if (!supabase) return;
      setStatus('syncing');
      setMessage(null);
      setSyncReady(false);

      const { data, error } = await supabase
        .from('user_state')
        .select('state, updated_at')
        .eq('user_id', currentUser.id)
        .maybeSingle();

      if (error) {
        setStatus('error');
        setMessage(friendlySyncError(error.message));
        return;
      }

      const row = data as { state: unknown; updated_at: string | null } | null;
      const remote = row?.state ? normalizeState(row.state) : null;
      const remoteAt = row?.updated_at ?? '';
      const localState = stateRef.current;
      const keys = metaKeys(currentUser.id);
      let lastUploaded: string | null = null;
      let lastAt = '';
      try {
        lastUploaded = localStorage.getItem(keys.state);
        lastAt = localStorage.getItem(keys.at) ?? '';
      } catch {
        // ignore
      }
      lastUploadedRef.current = lastUploaded;
      setLastSyncedAt(lastAt || null);

      if (!remote) {
        if (stateHasData(localState)) await uploadState(currentUser, localState);
        else {
          setStatus('synced');
          setMessage('云端还没有学习数据');
          setSyncReady(true);
        }
        return;
      }

      if (!stateHasData(localState)) {
        applyRemote(currentUser, remote, remoteAt);
        return;
      }

      if (!stateHasData(remote)) {
        await uploadState(currentUser, localState);
        return;
      }

      const localJson = JSON.stringify(localState);
      const localChanged = lastUploaded === null || localJson !== lastUploaded;
      const remoteMs = remoteAt ? Date.parse(remoteAt) : 0;
      const lastMs = lastAt ? Date.parse(lastAt) : 0;
      const remoteChanged = remoteMs > lastMs + 1000;

      if (explicit && lastUploaded === null) {
        showConflict(remote, remoteAt);
        return;
      }
      if (localChanged && remoteChanged) {
        showConflict(remote, remoteAt);
        return;
      }
      if (remoteChanged) {
        applyRemote(currentUser, remote, remoteAt);
        return;
      }
      if (localChanged) {
        await uploadState(currentUser, localState);
        return;
      }
      setStatus('synced');
      setSyncReady(true);
    },
    [applyRemote, showConflict, uploadState],
  );

  const handleUser = useCallback(
    (nextUser: User, explicit: boolean) => {
      signedInUserRef.current = nextUser.id;
      setUser(nextUser);
      const keys = metaKeys(nextUser.id);
      try {
        lastUploadedRef.current = localStorage.getItem(keys.state);
        setLastSyncedAt(localStorage.getItem(keys.at));
      } catch {
        lastUploadedRef.current = null;
        setLastSyncedAt(null);
      }
      void pullRemote(nextUser, explicit);
    },
    [pullRemote],
  );

  useEffect(() => {
    if (!supabase) return;
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      const sessionUser = data.session?.user;
      if (!sessionUser || signedInUserRef.current === sessionUser.id) return;
      const explicit = explicitSignInRef.current;
      explicitSignInRef.current = false;
      handleUser(sessionUser, explicit);
    });

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === 'SIGNED_OUT') {
        signedInUserRef.current = null;
        setUser(null);
        setStatus('local');
        setMessage(null);
        setConflict(null);
        setSyncReady(false);
        return;
      }
      const sessionUser = session?.user;
      if (!sessionUser) return;
      if (event === 'TOKEN_REFRESHED') {
        setUser(sessionUser);
        return;
      }
      if (signedInUserRef.current === sessionUser.id) return;
      const explicit = explicitSignInRef.current;
      explicitSignInRef.current = false;
      handleUser(sessionUser, explicit);
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [handleUser]);

  // Debounced autosave after the initial cloud pull has finished.
  useEffect(() => {
    if (!user || !supabase || !syncReady || conflict) return;
    const json = JSON.stringify(state);
    if (suppressSyncRef.current) {
      suppressSyncRef.current = false;
      return;
    }
    if (json === lastUploadedRef.current) return;
    const timer = window.setTimeout(() => {
      void uploadState(user, state);
    }, 900);
    return () => window.clearTimeout(timer);
  }, [state, user, syncReady, conflict, uploadState]);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!supabase) return { error: '云同步尚未配置' };
    if (!email.trim() || !password) return { error: '请输入邮箱和密码' };
    explicitSignInRef.current = true;
    setStatus('syncing');
    setMessage(null);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) {
      explicitSignInRef.current = false;
      setStatus('error');
      return { error: friendlyAuthError(error.message) };
    }
    return {};
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    if (!supabase) return { error: '云同步尚未配置' };
    if (!email.trim() || !password) return { error: '请输入邮箱和密码' };
    if (password.length < 6) return { error: '密码至少需要 6 位' };
    explicitSignInRef.current = true;
    setStatus('syncing');
    setMessage(null);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    });
    if (error) {
      explicitSignInRef.current = false;
      setStatus('error');
      return { error: friendlyAuthError(error.message) };
    }
    if (!data.session) {
      explicitSignInRef.current = false;
      setStatus('local');
      return { needsConfirmation: true };
    }
    return {};
  }, []);

  const signOut = useCallback(async () => {
    if (supabase) await supabase.auth.signOut();
    signedInUserRef.current = null;
    setUser(null);
    setStatus('local');
    setMessage(null);
    setConflict(null);
    setSyncReady(false);
  }, []);

  const syncNow = useCallback(async () => {
    if (!user || !supabase || conflict) return;
    await pullRemote(user, true);
  }, [user, conflict, pullRemote]);

  const resolveConflict = useCallback(
    async (choice: 'cloud' | 'local') => {
      if (!user || !conflict) return;
      if (choice === 'cloud') {
        applyRemote(
          user,
          conflict.remoteState,
          conflict.remoteUpdatedAt || new Date().toISOString(),
        );
      } else {
        await uploadState(user, stateRef.current);
        setConflict(null);
      }
    },
    [user, conflict, applyRemote, uploadState],
  );

  const value: AccountContextValue = {
    configured: isSupabaseConfigured,
    user,
    email: user?.email ?? null,
    status,
    lastSyncedAt,
    message,
    conflict,
    signIn,
    signUp,
    signOut,
    syncNow,
    resolveConflict,
  };

  return (
    <AccountContext.Provider value={value}>
      {children}
      <ConfirmDialog
        open={Boolean(conflict)}
        title="发现云端学习数据"
        description={
          conflict
            ? `云端：${stateSummary(conflict.remoteState)}；本机：${stateSummary(
                stateRef.current,
              )}。请选择使用哪一份数据继续。`
            : undefined
        }
        confirmLabel="使用云端数据"
        cancelLabel="保留本机数据"
        onConfirm={() => void resolveConflict('cloud')}
        onCancel={() => void resolveConflict('local')}
        onDismiss={() => {
          // Require an explicit choice so a stray Escape/backdrop click cannot
          // silently overwrite either side's learning data.
        }}
      />
    </AccountContext.Provider>
  );
}

export function useAccount(): AccountContextValue {
  const context = useContext(AccountContext);
  if (!context) throw new Error('useAccount must be used inside <AccountProvider>');
  return context;
}
