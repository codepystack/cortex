import {
  Agent,
  AuthResponse,
  ChatRequest,
  ChatResponse,
  McpServer,
  Model,
  RunAgentRequest,
  RunAgentResponse,
  RunToolRequest,
  RunToolResponse,
  RunWorkflowResponse,
  Tool,
  Workflow,
} from "./types";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

function authHeaders(token?: string | null): HeadersInit {
  const headers: HeadersInit = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

async function handleError(res: Response, fallback: string): Promise<never> {
  const err = await res.json().catch(() => ({}));
  throw new Error(err?.error?.message ?? fallback);
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
  if (!res.ok) return handleError(res, "Registration failed");
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
  if (!res.ok) return handleError(res, "Login failed");
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

export async function registerModel(
  payload: {
    name: string;
    provider: string;
    endpoint?: string;
    api_key?: string;
    description?: string;
  },
  token?: string | null
): Promise<{ status: string; name: string; provider: string }> {
  const res = await fetch(`${API_BASE}/v1/models/register`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
  if (!res.ok) return handleError(res, "Failed to register model");
  return res.json();
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
  if (!res.ok) return handleError(res, "Chat request failed");
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
  if (!res.ok) return handleError(res, "Chat request failed");

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

// ─── Tools ───────────────────────────────────────────────────────────────────

export async function listTools(token?: string | null): Promise<Tool[]> {
  const res = await fetch(`${API_BASE}/v1/tools`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error("Failed to fetch tools");
  const data = await res.json();
  return data.tools as Tool[];
}

export async function runTool(
  req: RunToolRequest,
  token?: string | null
): Promise<RunToolResponse> {
  const res = await fetch(`${API_BASE}/v1/tools/run`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(req),
  });
  if (!res.ok) return handleError(res, "Failed to run tool");
  return res.json();
}

// ─── Agents ───────────────────────────────────────────────────────────────────

export async function listAgents(token?: string | null): Promise<Agent[]> {
  const res = await fetch(`${API_BASE}/v1/agents`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error("Failed to fetch agents");
  const data = await res.json();
  return data.agents as Agent[];
}

export async function registerAgent(
  payload: Omit<Agent, "system_prompt"> & { system_prompt?: string | null },
  token?: string | null
): Promise<{ status: string; name: string; model: string }> {
  const res = await fetch(`${API_BASE}/v1/agents/register`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
  if (!res.ok) return handleError(res, "Failed to register agent");
  return res.json();
}

export async function runAgent(
  req: RunAgentRequest,
  token?: string | null
): Promise<RunAgentResponse> {
  const res = await fetch(`${API_BASE}/v1/agents/run`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(req),
  });
  if (!res.ok) return handleError(res, "Failed to run agent");
  return res.json();
}

// ─── Workflows ────────────────────────────────────────────────────────────────

export async function listWorkflows(token?: string | null): Promise<Workflow[]> {
  const res = await fetch(`${API_BASE}/v1/workflows`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error("Failed to fetch workflows");
  const data = await res.json();
  return data.workflows as Workflow[];
}

export async function registerWorkflow(
  payload: Workflow,
  token?: string | null
): Promise<{ status: string; name: string }> {
  const res = await fetch(`${API_BASE}/v1/workflows/register`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
  if (!res.ok) return handleError(res, "Failed to register workflow");
  return res.json();
}

export async function runWorkflow(
  workflow: string,
  input: string,
  token?: string | null
): Promise<RunWorkflowResponse> {
  const res = await fetch(`${API_BASE}/v1/workflow/run`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ workflow, input }),
  });
  if (!res.ok) return handleError(res, "Failed to run workflow");
  return res.json();
}

// ─── MCP Servers ──────────────────────────────────────────────────────────────

export async function listMcpServers(
  token?: string | null
): Promise<McpServer[]> {
  const res = await fetch(`${API_BASE}/v1/mcp`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error("Failed to fetch MCP servers");
  const data = await res.json();
  return data.servers as McpServer[];
}

export async function registerMcpServer(
  payload: { name: string; url: string; description?: string; tools: string[] },
  token?: string | null
): Promise<{ status: string; name: string; tools_registered: number }> {
  const res = await fetch(`${API_BASE}/v1/mcp/register`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
  if (!res.ok) return handleError(res, "Failed to register MCP server");
  return res.json();
}

