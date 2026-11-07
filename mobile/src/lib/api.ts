import * as SecureStore from "expo-secure-store";

/**
 * The API address. Set EXPO_PUBLIC_API_URL in mobile/.env, e.g. https://api.nexgenhair.in
 * (on a phone, "localhost" is the phone itself: use your computer's LAN IP while developing).
 */
export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:4000").replace(/\/$/, "");

const TOKEN_KEY = "nexgen_token";
let memoryToken: string | null = null;

export async function loadToken(): Promise<string | null> {
  memoryToken = await SecureStore.getItemAsync(TOKEN_KEY);
  return memoryToken;
}

export async function saveToken(token: string | null) {
  memoryToken = token;
  if (token) await SecureStore.setItemAsync(TOKEN_KEY, token);
  else await SecureStore.deleteItemAsync(TOKEN_KEY);
}

export const currentToken = () => memoryToken;

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(fn: () => void) {
  onUnauthorized = fn;
}

export async function api<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, ...rest } = init;
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api${path}`, {
      ...rest,
      headers: {
        ...(json !== undefined ? { "content-type": "application/json" } : {}),
        ...(memoryToken ? { authorization: `Bearer ${memoryToken}` } : {}),
        ...(rest.headers as Record<string, string> | undefined),
      },
      body: json !== undefined ? JSON.stringify(json) : rest.body,
    });
  } catch {
    throw new ApiError(0, "Can't reach the server. Check your internet connection.");
  }
  if (res.status === 401 && memoryToken) onUnauthorized?.();
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, (data as { error?: string }).error ?? `Request failed (${res.status})`);
  return data as T;
}

export const audioUrl = (callId: string) => `${API_URL}/api/calls/${callId}/audio?token=${encodeURIComponent(memoryToken ?? "")}`;
