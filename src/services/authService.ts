import { supabaseEdgeConfig } from "./supabaseEdgeConfig";

const SESSION_STORAGE_KEY = "artfile.auth.session";

interface StoredSession {
  access_token: string;
  refresh_token: string;
  expires_at: number;
}

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  error?: string;
  error_description?: string;
  msg?: string;
}

type AuthListener = (isAuthenticated: boolean) => void;

const listeners = new Set<AuthListener>();

function notifyAuthChange(isAuthenticated: boolean) {
  for (const listener of listeners) {
    listener(isAuthenticated);
  }
}

function readStoredSession(): StoredSession | null {
  const raw = localStorage.getItem(SESSION_STORAGE_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as StoredSession;
  } catch {
    localStorage.removeItem(SESSION_STORAGE_KEY);
    return null;
  }
}

function saveSession(token: TokenResponse, previous?: StoredSession | null) {
  const refreshToken = token.refresh_token || previous?.refresh_token;
  if (!refreshToken) {
    throw new Error("Missing refresh token.");
  }

  const session: StoredSession = {
    access_token: token.access_token,
    refresh_token: refreshToken,
    expires_at:
      token.expires_in > 0
        ? Math.floor(Date.now() / 1000) + token.expires_in
        : (previous?.expires_at ?? 0),
  };
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  notifyAuthChange(true);
  return session;
}

function clearSession() {
  localStorage.removeItem(SESSION_STORAGE_KEY);
  notifyAuthChange(false);
}

async function authRequest(path: string, init: RequestInit = {}) {
  return fetch(`${supabaseEdgeConfig.url}/auth/v1${path}`, {
    ...init,
    headers: {
      apikey: supabaseEdgeConfig.publishableKey,
      ...init.headers,
    },
  });
}

function parseAuthError(payload: TokenResponse) {
  return payload.error_description ?? payload.msg ?? payload.error ?? "登入失敗。";
}

async function refreshAccessToken(refreshToken: string) {
  const response = await authRequest("/token?grant_type=refresh_token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  const payload = (await response.json().catch(() => ({}))) as TokenResponse;

  if (!response.ok) {
    clearSession();
    throw new Error(parseAuthError(payload));
  }

  return saveSession(payload, readStoredSession());
}

export function subscribeAuthState(listener: AuthListener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export async function restoreSession() {
  const session = readStoredSession();
  if (!session?.refresh_token) {
    notifyAuthChange(false);
    return false;
  }

  if (Date.now() / 1000 < session.expires_at - 60) {
    notifyAuthChange(true);
    return true;
  }

  try {
    await refreshAccessToken(session.refresh_token);
    return true;
  } catch {
    notifyAuthChange(false);
    return false;
  }
}

export async function signIn(email: string, password: string) {
  const response = await authRequest("/token?grant_type=password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const payload = (await response.json().catch(() => ({}))) as TokenResponse;

  if (!response.ok) {
    throw new Error(parseAuthError(payload));
  }

  saveSession(payload);
}

export async function signOut() {
  const session = readStoredSession();

  if (session) {
    await authRequest("/logout", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    }).catch(() => undefined);
  }

  clearSession();
}

export async function getAccessToken() {
  const session = readStoredSession();
  if (!session) return null;

  if (Date.now() / 1000 < session.expires_at - 60) {
    return session.access_token;
  }

  const refreshed = await refreshAccessToken(session.refresh_token);
  return refreshed.access_token;
}

export async function getAuthHeaders(contentType = true) {
  const accessToken = await getAccessToken();

  if (!accessToken) {
    throw new Error("請先登入。");
  }

  return {
    apikey: supabaseEdgeConfig.publishableKey,
    Authorization: `Bearer ${accessToken}`,
    ...(contentType ? { "Content-Type": "application/json" } : {}),
  };
}

export async function handleUnauthorizedResponse(response: Response) {
  if (response.status !== 401) return false;

  await signOut();
  return true;
}
