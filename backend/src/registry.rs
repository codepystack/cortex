use std::collections::HashMap;
use std::sync::{Arc, RwLock};

use serde::{Deserialize, Serialize};

// ─── Resource types ──────────────────────────────────────────────────────────

/// Resource type enum used for classification and routing.
#[allow(dead_code)]
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ResourceType {
    Model,
    Tool,
    Agent,
    Workflow,
    Datasource,
    McpServer,
}

// ─── Registered resources ────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RegisteredModel {
    pub name: String,
    pub provider: String,
    /// Optional override endpoint (for Ollama or custom deployments).
    pub endpoint: Option<String>,
    /// Optional API key override (per-model, takes precedence over global config).
    pub api_key: Option<String>,
    pub description: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RegisteredTool {
    pub name: String,
    pub description: String,
    /// JSON Schema for the tool's input parameters.
    pub parameters: serde_json::Value,
    /// Optional source: "builtin" | "mcp" | "custom"
    pub source: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RegisteredAgent {
    pub name: String,
    pub description: String,
    pub model: String,
    pub tools: Vec<String>,
    pub system_prompt: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkflowNodeDef {
    pub id: String,
    /// Node kind: "llm" | "tool" | "input" | "output" | "transform"
    pub kind: String,
    pub config: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RegisteredWorkflow {
    pub name: String,
    pub description: String,
    pub nodes: Vec<WorkflowNodeDef>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RegisteredMcpServer {
    pub name: String,
    pub url: String,
    pub description: Option<String>,
    /// List of tool names exposed by this MCP server.
    pub tools: Vec<String>,
}

// ─── Conversation memory ─────────────────────────────────────────────────────

/// A single turn in a conversation.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemoryEntry {
    pub role: String,
    pub content: String,
}

// ─── Registry ────────────────────────────────────────────────────────────────

/// Central runtime registry for all platform resources.
///
/// All inner maps are wrapped in `Arc<RwLock<…>>` so the registry can be
/// cheaply cloned and shared across Axum handlers.
#[derive(Debug, Clone, Default)]
pub struct Registry {
    pub models: Arc<RwLock<HashMap<String, RegisteredModel>>>,
    pub tools: Arc<RwLock<HashMap<String, RegisteredTool>>>,
    pub agents: Arc<RwLock<HashMap<String, RegisteredAgent>>>,
    pub workflows: Arc<RwLock<HashMap<String, RegisteredWorkflow>>>,
    pub mcp_servers: Arc<RwLock<HashMap<String, RegisteredMcpServer>>>,
    /// Conversation memory keyed by session_id.
    pub memory: Arc<RwLock<HashMap<String, Vec<MemoryEntry>>>>,
}

impl Registry {
    /// Create a new registry and seed it with built-in tools.
    pub fn new() -> Self {
        let registry = Registry::default();
        registry.seed_builtin_tools();
        registry
    }

    // ── Tools ─────────────────────────────────────────────────────────────────

    fn seed_builtin_tools(&self) {
        let mut tools = self.tools.write().unwrap();

        tools.insert(
            "echo".to_string(),
            RegisteredTool {
                name: "echo".to_string(),
                description: "Echo a message back verbatim. Useful for testing.".to_string(),
                parameters: serde_json::json!({
                    "type": "object",
                    "properties": {
                        "message": { "type": "string", "description": "The message to echo" }
                    },
                    "required": ["message"]
                }),
                source: "builtin".to_string(),
            },
        );

        tools.insert(
            "calculator".to_string(),
            RegisteredTool {
                name: "calculator".to_string(),
                description:
                    "Evaluate simple arithmetic expressions (e.g. \"2 + 3 * 4\").".to_string(),
                parameters: serde_json::json!({
                    "type": "object",
                    "properties": {
                        "expression": { "type": "string", "description": "Arithmetic expression" }
                    },
                    "required": ["expression"]
                }),
                source: "builtin".to_string(),
            },
        );

        tools.insert(
            "http_request".to_string(),
            RegisteredTool {
                name: "http_request".to_string(),
                description: "Make an HTTP GET or POST request to any URL.".to_string(),
                parameters: serde_json::json!({
                    "type": "object",
                    "properties": {
                        "url": { "type": "string", "description": "Target URL" },
                        "method": { "type": "string", "enum": ["GET", "POST"], "default": "GET" },
                        "body": { "type": "string", "description": "Optional request body (POST)" }
                    },
                    "required": ["url"]
                }),
                source: "builtin".to_string(),
            },
        );
    }

    pub fn register_tool(&self, tool: RegisteredTool) {
        self.tools.write().unwrap().insert(tool.name.clone(), tool);
    }

    pub fn get_tool(&self, name: &str) -> Option<RegisteredTool> {
        self.tools.read().unwrap().get(name).cloned()
    }

    pub fn list_tools(&self) -> Vec<RegisteredTool> {
        let mut tools: Vec<RegisteredTool> =
            self.tools.read().unwrap().values().cloned().collect();
        tools.sort_by(|a, b| a.name.cmp(&b.name));
        tools
    }

    // ── Models ────────────────────────────────────────────────────────────────

    pub fn register_model(&self, model: RegisteredModel) {
        self.models
            .write()
            .unwrap()
            .insert(model.name.clone(), model);
    }

    pub fn get_model(&self, name: &str) -> Option<RegisteredModel> {
        self.models.read().unwrap().get(name).cloned()
    }

    pub fn list_registered_models(&self) -> Vec<RegisteredModel> {
        let mut models: Vec<RegisteredModel> =
            self.models.read().unwrap().values().cloned().collect();
        models.sort_by(|a, b| a.name.cmp(&b.name));
        models
    }

    // ── Agents ────────────────────────────────────────────────────────────────

    pub fn register_agent(&self, agent: RegisteredAgent) {
        self.agents
            .write()
            .unwrap()
            .insert(agent.name.clone(), agent);
    }

    pub fn get_agent(&self, name: &str) -> Option<RegisteredAgent> {
        self.agents.read().unwrap().get(name).cloned()
    }

    pub fn list_agents(&self) -> Vec<RegisteredAgent> {
        let mut agents: Vec<RegisteredAgent> =
            self.agents.read().unwrap().values().cloned().collect();
        agents.sort_by(|a, b| a.name.cmp(&b.name));
        agents
    }

    // ── Workflows ─────────────────────────────────────────────────────────────

    pub fn register_workflow(&self, workflow: RegisteredWorkflow) {
        self.workflows
            .write()
            .unwrap()
            .insert(workflow.name.clone(), workflow);
    }

    pub fn get_workflow(&self, name: &str) -> Option<RegisteredWorkflow> {
        self.workflows.read().unwrap().get(name).cloned()
    }

    pub fn list_workflows(&self) -> Vec<RegisteredWorkflow> {
        let mut workflows: Vec<RegisteredWorkflow> =
            self.workflows.read().unwrap().values().cloned().collect();
        workflows.sort_by(|a, b| a.name.cmp(&b.name));
        workflows
    }

    // ── MCP Servers ───────────────────────────────────────────────────────────

    /// Register an MCP server and auto-register all its exposed tools.
    pub fn register_mcp_server(&self, server: RegisteredMcpServer) {
        // Auto-register each tool the MCP server advertises.
        {
            let mut tools = self.tools.write().unwrap();
            for tool_name in &server.tools {
                tools.entry(tool_name.clone()).or_insert_with(|| RegisteredTool {
                    name: tool_name.clone(),
                    description: format!("Tool provided by MCP server '{}'", server.name),
                    parameters: serde_json::json!({ "type": "object", "properties": {} }),
                    source: format!("mcp:{}", server.name),
                });
            }
        }
        self.mcp_servers
            .write()
            .unwrap()
            .insert(server.name.clone(), server);
    }

    pub fn list_mcp_servers(&self) -> Vec<RegisteredMcpServer> {
        let mut servers: Vec<RegisteredMcpServer> =
            self.mcp_servers.read().unwrap().values().cloned().collect();
        servers.sort_by(|a, b| a.name.cmp(&b.name));
        servers
    }

    // ── Memory ────────────────────────────────────────────────────────────────

    pub fn append_memory(&self, session_id: &str, entry: MemoryEntry) {
        let mut memory = self.memory.write().unwrap();
        memory.entry(session_id.to_string()).or_default().push(entry);
    }

    pub fn get_memory(&self, session_id: &str) -> Vec<MemoryEntry> {
        self.memory
            .read()
            .unwrap()
            .get(session_id)
            .cloned()
            .unwrap_or_default()
    }

    pub fn clear_memory(&self, session_id: &str) {
        self.memory.write().unwrap().remove(session_id);
    }
}
