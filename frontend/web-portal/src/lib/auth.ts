const TOKEN_KEY = 'bhumichain_token';
const API = process.env.NEXT_PUBLIC_API_URL || 'mock';
import { handleMockApi } from './mockBackend';

async function unifiedFetch(path: string, options: RequestInit = {}): Promise<Response> {
  if (API === 'mock') {
    return handleMockApi(path, options);
  }
  return fetch(`${API}${path}`, options);
}

export interface JWTUser {
  role: string;
  name: string;
  aadhaarHash: string;
  jurisdictionCode?: string;
  tehsilCode?: string;
  circleCode?: string;
  patwariCode?: string;
  villageCodes?: string[];
  patwariCodes?: string[];
  demo?: boolean;
  exp: number;
}

// ─── Token storage ────────────────────────────────────────────────────────────

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

// ─── User decoding ────────────────────────────────────────────────────────────

export function getUser(): JWTUser | null {
  const token = getToken();
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split('.')[1])) as JWTUser;
    if (payload.exp && Date.now() / 1000 > payload.exp) {
      clearToken();
      return null;
    }
    return payload;
  } catch {
    clearToken();
    return null;
  }
}

export function isLoggedIn(): boolean {
  return getUser() !== null;
}

export function getRole(): string | null {
  return getUser()?.role ?? null;
}

export function isOfficer(): boolean {
  return ['patwari', 'circle_inspector', 'tehsildar', 'kotwal'].includes(getRole() ?? '');
}

export function isTehsildar(): boolean {
  return getRole() === 'tehsildar';
}

export function getRedirectPath(role: string): string {
  if (role === 'citizen') return '/my-parcels';
  return '/officer-dashboard';
}

// ─── Auth API calls ───────────────────────────────────────────────────────────

export async function requestOTP(aadhaarNumber: string): Promise<{ maskedPhone: string; _devHint?: string }> {
  const res = await unifiedFetch(`/api/auth/request-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ aadhaarNumber }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || data.error || 'Failed to send OTP');
  return data;
}

export async function verifyOTP(aadhaarNumber: string, otp: string): Promise<JWTUser> {
  const res = await unifiedFetch(`/api/auth/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ aadhaarNumber, otp }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || data.error || 'Login failed');
  setToken(data.token);
  return data.user;
}

export async function officerLogin(
  aadhaarNumber: string,
  deptEmail: string,
  otp: string,
): Promise<JWTUser> {
  const res = await unifiedFetch(`/api/auth/officer-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ aadhaarNumber, deptEmail, otp }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || data.error || 'Officer login failed');
  setToken(data.token);
  return data.user;
}

export async function demoLogin(persona: string): Promise<JWTUser> {
  const res = await unifiedFetch(`/api/auth/demo-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ persona }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Demo login failed');
  setToken(data.token);
  return data.user;
}

export async function requestESignOTP(aadhaarNumber: string): Promise<void> {
  await requestOTP(aadhaarNumber);
}

export async function submitESign(
  aadhaarNumber: string,
  otp: string,
  actionDescription: string,
): Promise<{ eSignTxHash: string; signedAt: string }> {
  const res = await unifiedFetch(`/api/auth/esign`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify({ aadhaarNumber, otp, actionDescription }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || data.error || 'eSign failed');
  return data;
}

export function logout(): void {
  clearToken();
  window.location.href = '/login';
}

// ─── Authed fetch helper ──────────────────────────────────────────────────────
// Use this for all API calls that need the JWT

export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = getToken();
  return unifiedFetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers || {}),
    },
  });
}
