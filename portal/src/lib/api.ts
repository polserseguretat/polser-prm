/**
 * Client Directus per al Portal de Partners de POLSER SEGURETAT.
 * Llegeix la base URL des de VITE_DIRECTUS_URL amb el valor per defecte localhost:8055.
 * Les crides no requereixen un servidor en marxa per construir el projecte.
 */

const BASE_URL = import.meta.env.VITE_DIRECTUS_URL || 'http://localhost:8055';

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH';
  body?: unknown;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body } = options;

  const init: RequestInit = {
    method,
    headers: {
      Accept: 'application/json',
    },
  };

  if (body !== undefined) {
    init.headers = {
      ...init.headers,
      'Content-Type': 'application/json',
    };
    init.body = JSON.stringify(body);
  }

  const response = await fetch(`${BASE_URL}${path}`, init);

  // Resposta sense cos (ex. 204)
  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      throw new ApiError(`Resposta invàlida del servidor (${response.status})`, response.status);
    }
  }

  if (!response.ok) {
    const message =
      (data as { message?: string })?.message ||
      `Error del servidor (${response.status})`;
    throw new ApiError(message, response.status);
  }

  return data as T;
}

export class ApiError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }
}

/* ---- Tipus ---- */

export interface AuthResult {
  access_token?: string;
  refresh_token?: string;
  expires?: number;
  data?: AuthResult;
}

export interface ReferralPayload {
  client_name: string;
  client_email: string;
  client_phone: string;
  product: string;
  comments?: string;
}

export interface Referral {
  id: number;
  product: string;
  status: string;
  date_created: string;
  clientName?: string;
}

export interface DashboardData {
  sent: number;
  completed: number;
  accumulatedCommission: number;
  walletBalance: number;
  products: Product[];
}

export interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  monthlyFee: number;
  description?: string;
}

export interface WalletMovement {
  id: string;
  date: string;
  description: string;
  amount: number; // positiu = ingrés, negatiu = retirada
}

export interface WalletData {
  accumulatedBalance: number;
  pendingCommissions: number;
  movements: WalletMovement[];
}

/* ---- Endpoints ---- */

export function loginRequestOtp(email: string): Promise<AuthResult> {
  return request<AuthResult>('/auth/request-otp', {
    method: 'POST',
    body: { email },
  });
}

export function loginVerifyOtp(email: string, code: string): Promise<AuthResult> {
  return request<AuthResult>('/auth/verify-otp', {
    method: 'POST',
    body: { email, code },
  });
}

export function getDashboard(): Promise<DashboardData> {
  return request<DashboardData>('/items/dashboard');
}

export function getReferrals(): Promise<{ data: Referral[] }> {
  return request<{ data: Referral[] }>('/items/referrals');
}

export function createReferral(payload: ReferralPayload): Promise<{ data: Referral }> {
  return request<{ data: Referral }>('/items/referrals', {
    method: 'POST',
    body: payload,
  });
}

export function getReferral(id: string | number): Promise<{ data: Referral }> {
  return request<{ data: Referral }>(`/items/referrals/${id}`);
}

export function getWallet(): Promise<WalletData> {
  return request<WalletData>('/items/wallet');
}