const TOKEN_KEY = 'thisone.token';

// Storage can be unavailable (private mode); the app then simply forgets the login on reload.
function readToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

let token = readToken();
let onLoggedOut = () => {};

export const hasToken = () => Boolean(token);

export function setToken(value) {
  token = value;
  try {
    if (value) localStorage.setItem(TOKEN_KEY, value);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Ignored: see readToken.
  }
}

// Called when the server no longer accepts our token (expired, blocked, password reset).
export function setLoggedOutHandler(handler) {
  onLoggedOut = handler;
}

export async function api(path, { method = 'GET', body, signal } = {}) {
  let res;
  try {
    res = await fetch(`/api${path}`, {
      method,
      signal,
      headers: {
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    throw new Error('Cannot reach the server. Please check the connection.');
  }

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const error = new Error(data?.error ?? `The request failed (${res.status}).`);
    error.status = res.status;
    error.code = data?.code;
    if (res.status === 401 && token) {
      setToken(null);
      onLoggedOut();
    }
    throw error;
  }
  return data;
}

export const get = (path, signal) => api(path, { signal });
export const post = (path, body = {}) => api(path, { method: 'POST', body });
export const put = (path, body = {}) => api(path, { method: 'PUT', body });
export const del = (path) => api(path, { method: 'DELETE' });

// query({ q: 'a b', type: null }) -> '?q=a%20b'. Empty values are left out.
export function query(params) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== null && value !== undefined && value !== '') search.set(key, value);
  }
  const text = search.toString();
  return text ? `?${text}` : '';
}
