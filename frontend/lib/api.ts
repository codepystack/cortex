import { AuthResponse, ChatRequest, ChatResponse, Model } from "./types";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

function authHeaders(token?: string | null): HeadersInit {
  const headers: HeadersInit = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

// ─── Auth ────────────────────────────────────────────────────────────────────

export async function register(
  email: string,
  password: string
): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE}/v1/auth/register`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? "Registration failed");
  }
  return res.json();
}

export async function login(
  email: string,
  password: string
): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE}/v1/auth/login`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? "Login failed");
  }
  return res.json();
}

// ─── Models ──────────────────────────────────────────────────────────────────

export async function listModels(token?: string | null): Promise<Model[]> {
  const res = await fetch(`${API_BASE}/v1/models`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error("Failed to fetch models");
  const data = await res.json();
  return data.data as Model[];
}

// ─── Chat ────────────────────────────────────────────────────────────────────

export async function chatCompletion(
  req: ChatRequest,
  token?: string | null
): Promise<ChatResponse> {
  const res = await fetch(`${API_BASE}/v1/chat/completions`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ ...req, stream: false }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? "Chat request failed");
  }
  return res.json();
}

export async function* streamChatCompletion(
  req: ChatRequest,
  token?: string | null
): AsyncGenerator<string> {
  const res = await fetch(`${API_BASE}/v1/chat/completions`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ ...req, stream: true }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? "Chat request failed");
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error("No response body");

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const data = trimmed.slice(5).trim();
      if (data === "[DONE]") return;
      try {
        const chunk = JSON.parse(data);
        const content: string | undefined =
          chunk?.choices?.[0]?.delta?.content;
        if (content) yield content;
      } catch {
        // ignore parse errors on malformed lines
      }
    }
  }
}
