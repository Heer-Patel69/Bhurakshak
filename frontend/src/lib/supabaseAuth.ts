import { SUPABASE_AUTH_CONFIGURED, SUPABASE_PUBLIC_KEY, SUPABASE_URL } from './config';

const SESSION_KEY = 'bhurakshak_supabase_access_token';

export function signInWithSharedAuthorityCode(accessCode: string): string {
  if (!accessCode.trim()) throw new Error('Enter the shared authority access code.');
  const session = `shared:${accessCode.trim()}`;
  sessionStorage.setItem(SESSION_KEY, session);
  return session;
}

export async function signInAuthority(email: string, password: string): Promise<string> {
  if (!SUPABASE_AUTH_CONFIGURED) {
    throw new Error('Supabase Auth is not configured for this frontend.');
  }
  const response = await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_PUBLIC_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.access_token) {
    throw new Error(payload?.msg || payload?.error_description || 'Supabase sign-in failed.');
  }
  sessionStorage.setItem(SESSION_KEY, payload.access_token);
  return payload.access_token as string;
}

export function getAuthoritySession(): string | null {
  return typeof window === 'undefined' ? null : sessionStorage.getItem(SESSION_KEY);
}

export function clearAuthoritySession(): void {
  if (typeof window !== 'undefined') sessionStorage.removeItem(SESSION_KEY);
}
