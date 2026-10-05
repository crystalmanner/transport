import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { get, hasToken, post, setLoggedOutHandler, setToken } from '../lib/api.js';

const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

const SIGNED_OUT = { user: null, features: {}, settings: {}, application: null };

// The server sends the lucky draw wait in seconds. It is turned into a time on this
// device's clock once, so the countdown stays right while the user moves between pages.
const stamp = (session) => ({
  ...session,
  user: { ...session.user, draw_ready_at: Date.now() + session.user.draw_wait_seconds * 1000 },
});

export function AuthProvider({ children }) {
  const [session, setSession] = useState(SIGNED_OUT);
  // Settings for visitors (currency unit, prices); a logged-in session carries its own copy.
  const [publicSettings, setPublicSettings] = useState({});
  // True until the saved token has been checked, so pages do not flash the login screen.
  const [loading, setLoading] = useState(hasToken());

  const refresh = useCallback(async () => {
    if (!hasToken()) return;
    try {
      setSession(stamp(await get('/auth/me')));
    } catch {
      // A 401 already cleared the token through the logged-out handler; other errors keep the last known session.
    }
  }, []);

  useEffect(() => {
    setLoggedOutHandler(() => setSession(SIGNED_OUT));
    refresh().finally(() => setLoading(false));
    get('/config')
      .then((config) => setPublicSettings(config.settings))
      .catch(() => {});
  }, [refresh]);

  const value = useMemo(() => {
    const signIn = async (path, body) => {
      const { token, ...rest } = await post(path, body);
      setToken(token);
      setSession(stamp(rest));
    };
    return {
      ...session,
      settings: session.user ? session.settings : publicSettings,
      loading,
      refresh,
      login: (body) => signIn('/auth/login', body),
      register: (body) => signIn('/auth/register', body),
      logout: async () => {
        await post('/auth/logout').catch(() => {});
        setToken(null);
        setSession(SIGNED_OUT);
      },
      // Lets a screen show a new balance at once instead of waiting for refresh().
      patchUser: (changes) => setSession((prev) => (prev.user ? { ...prev, user: { ...prev.user, ...changes } } : prev)),
    };
  }, [session, publicSettings, loading, refresh]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
