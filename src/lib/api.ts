const API_URL = import.meta.env.VITE_API_URL ?? 'https://app-chny.onrender.com/';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

function getToken(): string | null {
  return localStorage.getItem('token');
}

export function setSession(token: string, user: AuthUser): void {
  localStorage.setItem('token', token);
  localStorage.setItem('user', JSON.stringify(user));
}

export function clearSession(): void {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
}

export function getStoredUser(): AuthUser | null {
  const raw = localStorage.getItem('user');
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });

  if (res.status === 204) return undefined as T;

  let body: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }

  if (!res.ok) {
    if (res.status === 401) {
      clearSession();
      window.dispatchEvent(new Event('auth:unauthorized'));
    }
    const b = (body ?? {}) as { code?: string; message?: string };
    throw new ApiError(
      res.status,
      b.code ?? 'UNKNOWN_ERROR',
      b.message ?? `Error ${res.status} al conectar con la API`,
    );
  }

  return body as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: 'POST', body: data ? JSON.stringify(data) : undefined }),
  patch: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: 'PATCH', body: data ? JSON.stringify(data) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};

// ---------------------------------------------------------------------------
// Tipos compartidos con el backend (ver src/api/mappers/reservation.mapper.ts
// y src/security/auth.service.ts del repo de la API)
// ---------------------------------------------------------------------------

export type UserRole = 'ADMIN' | 'RECEPTIONIST' | 'WAITER' | 'CUSTOMER';
export type ReservationStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED';

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
}

export interface LoginResponse {
  token: string;
  tokenType: 'Bearer';
  expiresIn: number;
  user: AuthUser;
}

export interface ResourceDto {
  id: string;
  name: string;
  categoryId: string;
  basePrice: number;
  visualData?: Record<string, unknown> | null;
}

export interface ReservationDto {
  id: string;
  status: ReservationStatus;
  categoryId: string;
  resource: ResourceDto;
  customer: { id: string; fullName: string; email: string };
  startTime: string;
  endTime: string;
  details: unknown;
}

export interface OccupancyReportRow {
  date: string;
  resourceId: string;
  resourceName: string;
  totalMinutes: number;
  bookedMinutes: number;
  occupancyRate: number;
}

export interface OccupancyStats {
  resourceId: string;
  resourceName: string;
  occupancyRate: number;
}

export interface OccupancySummary {
  startDate: string;
  endDate: string;
  totalResources: number;
  averageOccupancy: number;
  topOccupied: OccupancyStats[];
  bottomOccupied: OccupancyStats[];
}
