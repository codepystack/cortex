export type Role = "system" | "user" | "assistant";

export interface Message {
  role: Role;
  content: string;
}

export interface Model {
  id: string;
  object: string;
  owned_by: string;
  display_name: string;
}

export interface ChatRequest {
  model: string;
  messages: Message[];
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
}

export interface ChatResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: Message;
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface AuthResponse {
  token: string;
  user: { id: string; email: string };
}

// ─── Tools ───────────────────────────────────────────────────────────────────

export interface Tool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  source: string;
}

export interface RunToolRequest {
  tool: string;
  args: Record<string, unknown>;
}

export interface RunToolResponse {
  tool: string;
  output: unknown;
}

// ─── Agents ───────────────────────────────────────────────────────────────────

export interface Agent {
  name: string;
  description: string;
  model: string;
  tools: string[];
  system_prompt: string | null;
}

export interface RunAgentRequest {
  agent: string;
  input: string;
  session_id?: string;
}

export interface RunAgentResponse {
  agent: string;
  session_id: string;
  output: string;
  tools_available: string[];
}

// ─── Workflows ────────────────────────────────────────────────────────────────

export interface WorkflowNode {
  id: string;
  kind: string;
  config: Record<string, unknown>;
}

export interface Workflow {
  name: string;
  description: string;
  nodes: WorkflowNode[];
}

export interface RunWorkflowResponse {
  workflow: string;
  input: string;
  output: string;
}

// ─── MCP Servers ──────────────────────────────────────────────────────────────

export interface McpServer {
  name: string;
  url: string;
  description: string | null;
  tools: string[];
}

