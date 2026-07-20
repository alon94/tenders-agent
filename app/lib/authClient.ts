// Client-side helper for talking to Supabase Auth (GoTrue) using plain
// fetch — no extra npm dependency required. Uses the public anon /
// publishable key, which is safe to expose in the browser; actual data
// access is still governed by Row Level Security policies on the database.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const SESSION_KEY = 'tenders_agent_session';
export const AUTH_EVENT = 'tenders-agent-auth-changed';

export interface AuthUser {
  id: string;
  email: string;
}

export interface AuthSession {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  user: AuthUser;
}

function authUrl(path: string) {
  return `${SUPABASE_URL}/auth/v1${path}`;
}

export function restUrl(path: string) {
  return `${SUPABASE_URL}/rest/v1${path}`;
}

export { ANON_KEY };

export function getSession(): AuthSession | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthSession;
  } catch {
    return null;
  }
}

export function clearSession() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(SESSION_KEY);
  window.dispatchEvent(new Event(AUTH_EVENT));
}

function saveSession(data: any): AuthSession {
  const session: AuthSession = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Math.floor(Date.now() / 1000) + (data.expires_in || 3600),
    user: { id: data.user?.id, email: data.user?.email },
  };
  window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  window.dispatchEvent(new Event(AUTH_EVENT));
  return session;
}

function messageFrom(data: any, fallback: string): string {
  const msg = data?.error_description || data?.msg || data?.error || fallback;
  if (typeof msg === 'string' && /already registered|already exists/i.test(msg)) {
    return 'כבר קיים חשבון עם כתובת האימייל הזו';
  }
  if (typeof msg === 'string' && /invalid login credentials/i.test(msg)) {
    return 'אימייל או סיסמה שגויים';
  }
  return msg;
}

export async function signUp(email: string, password: string, meta?: Record<string, string>) {
  const res = await fetch(authUrl('/signup'), {
    method: 'POST',
    headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, data: meta || {} }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(messageFrom(data, 'שגיאה בהרשמה'));
  }
  if (data.access_token) {
    return { session: saveSession(data), needsConfirmation: false };
  }
  return { session: null, needsConfirmation: true };
}

// רישום כניסה לאנליטיקה — fire-and-forget, לעולם לא חוסם את ההתחברות
function trackLogin(token: string) {
  try {
    fetch('/api/track-login', { method: 'POST', headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
  } catch { /* ignore */ }
}

export async function signIn(email: string, password: string) {
  const res = await fetch(authUrl('/token?grant_type=password'), {
    method: 'POST',
    headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(messageFrom(data, 'שגיאה בהתחברות'));
  }
  const sess = saveSession(data);
  if (sess?.access_token) trackLogin(sess.access_token);
  return sess;
}

// Redirects the browser to Google via Supabase's OAuth authorize endpoint.
// After the user approves access on Google, Supabase redirects back to
// redirectTo with the session tokens in the URL hash fragment, which is
// picked up by completeOAuthSession() on the /auth/callback page.
export function signInWithGoogle() {
  if (typeof window === 'undefined') return;
  const redirectTo = `${window.location.origin}/auth/callback`;
  const url = `${authUrl('/authorize')}?provider=google&redirect_to=${encodeURIComponent(redirectTo)}`;
  window.location.href = url;
}

// Reads the access/refresh tokens from the URL hash fragment (left there by
// Supabase after a Google OAuth redirect), fetches the user profile and
// saves the session. Returns null if there's nothing to process.
export async function completeOAuthSession(): Promise<AuthSession | null> {
  if (typeof window === 'undefined') return null;
  const hash = window.location.hash;
  if (!hash || hash.length < 2) return null;
  const params = new URLSearchParams(hash.substring(1));
  const access_token = params.get('access_token');
  const refresh_token = params.get('refresh_token');
  const expires_in = params.get('expires_in');
  const error_description = params.get('error_description');
  if (error_description) {
    window.history.replaceState(null, '', window.location.pathname);
    throw new Error(decodeURIComponent(error_description));
  }
  if (!access_token || !refresh_token) return null;
  const res = await fetch(authUrl('/user'), {
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${access_token}` },
  });
  const user = await res.json().catch(() => ({}));
  const session = saveSession({
    access_token,
    refresh_token,
    expires_in: expires_in ? parseInt(expires_in, 10) : 3600,
    user,
  });
  if (session?.access_token) trackLogin(session.access_token);
  window.history.replaceState(null, '', window.location.pathname);
  return session;
}

export async function signOut() {
  const session = getSession();
  clearSession();
  if (session) {
    try {
      await fetch(authUrl('/logout'), {
        method: 'POST',
        headers: { apikey: ANON_KEY, Authorization: `Bearer ${session.access_token}` },
      });
    } catch {
      // ignore network errors on logout — session is already cleared locally
    }
  }
}

export async function recoverPassword(email: string) {
  const res = await fetch(authUrl('/recover'), {
    method: 'POST',
    headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(messageFrom(data, 'שליחת מייל האיפוס נכשלה'));
  }
}

async function refreshSession(): Promise<AuthSession | null> {
  const session = getSession();
  if (!session) return null;
  const res = await fetch(authUrl('/token?grant_type=refresh_token'), {
    method: 'POST',
    headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: session.refresh_token }),
  });
  if (!res.ok) {
    clearSession();
    return null;
  }
  const data = await res.json();
  return saveSession(data);
}

// Returns a valid (non-expired) session, refreshing it first if it's close
// to expiring. Returns null if the user isn't logged in or refresh failed.
export async function getValidSession(): Promise<AuthSession | null> {
  let session = getSession();
  if (!session) return null;
  const now = Math.floor(Date.now() / 1000);
  if (session.expires_at - now < 60) {
    session = await refreshSession();
  }
  return session;
}
