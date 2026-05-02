const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '';
const STORAGE_KEY = 'cozza-admin-token';

export interface AdminLoginResponse {
  token: string;
  expiresIn: number;
}

export interface AdminVoice {
  id: string;
  name: string;
  gender: string | null;
  age: string | null;
  accent: string | null;
  useCase: string | null;
  descriptive: string | null;
  description: string | null;
  isItalianNative: boolean;
  previewUrl: string | null;
  category: string | null;
}

export interface AdminInfo {
  ok: boolean;
  commit: string;
  env: string;
  rateLimitPerMin: number;
  tokenTtlSeconds: number;
}

export class AdminApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
  ) {
    super(message);
    this.name = 'AdminApiError';
  }
}

export const adminToken = {
  get(): string | null {
    return localStorage.getItem(STORAGE_KEY);
  },
  set(t: string): void {
    localStorage.setItem(STORAGE_KEY, t);
  },
  clear(): void {
    localStorage.removeItem(STORAGE_KEY);
  },
};

async function adminFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const tok = adminToken.get();
  const headers: Record<string, string> = {
    ...(init.headers as Record<string, string> | undefined),
  };
  if (tok) headers['Authorization'] = `Bearer ${tok}`;
  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  if (res.status === 401) {
    adminToken.clear();
    window.dispatchEvent(new CustomEvent('cozza:admin-logout'));
  }
  return res;
}

export async function adminLogin(pin: string): Promise<AdminLoginResponse> {
  const res = await fetch(`${API_BASE}/api/admin/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pin }),
  });
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as {
      error?: { code?: string; message?: string };
    };
    throw new AdminApiError(j.error?.message ?? `HTTP ${res.status}`, res.status, j.error?.code);
  }
  const data = (await res.json()) as AdminLoginResponse;
  adminToken.set(data.token);
  return data;
}

export async function adminLogout(): Promise<void> {
  adminToken.clear();
}

export async function fetchAdminInfo(): Promise<AdminInfo> {
  const res = await adminFetch('/api/admin/info');
  if (!res.ok) {
    throw new AdminApiError(`info ${res.status}`, res.status);
  }
  return (await res.json()) as AdminInfo;
}

export async function fetchAdminVoices(): Promise<AdminVoice[]> {
  const res = await adminFetch('/api/admin/voices');
  if (!res.ok) {
    throw new AdminApiError(`voices ${res.status}`, res.status);
  }
  const data = (await res.json()) as { voices: AdminVoice[] };
  return data.voices;
}

export async function fetchVoicePreview(voiceId: string, text?: string): Promise<Blob> {
  const res = await adminFetch('/api/admin/voices/preview', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(text ? { voiceId, text } : { voiceId }),
  });
  if (!res.ok) {
    throw new AdminApiError(`preview ${res.status}`, res.status);
  }
  return await res.blob();
}
