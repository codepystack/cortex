"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { Sidebar } from "@/components/Sidebar";
import { listMcpServers, listTools, registerMcpServer } from "@/lib/api";
import { McpServer, Tool } from "@/lib/types";

export default function McpPage() {
  const { token, hydrated } = useAuth();
  const router = useRouter();
  const [servers, setServers] = useState<McpServer[]>([]);
  const [tools, setTools] = useState<Tool[]>([]);
  const [loading, setLoading] = useState(true);

  // Register form
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [toolsInput, setToolsInput] = useState("");
  const [registering, setRegistering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (hydrated && !token) router.replace("/login");
  }, [hydrated, token, router]);

  const fetchAll = useCallback(() => {
    if (!token) return;
    Promise.all([listMcpServers(token), listTools(token)])
      .then(([s, t]) => {
        setServers(s);
        setTools(t);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setRegistering(true);
    try {
      const toolList = toolsInput
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      await registerMcpServer(
        { name, url, description: description || undefined, tools: toolList },
        token
      );
      setSuccess(`MCP server "${name}" registered with ${toolList.length} tools.`);
      setName("");
      setUrl("");
      setDescription("");
      setToolsInput("");
      fetchAll();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Failed to register MCP server"
      );
    } finally {
      setRegistering(false);
    }
  };

  // Filter tools from MCP sources
  const mcpTools = tools.filter((t) => t.source.startsWith("mcp:"));

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      <Sidebar />
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-6 py-8 space-y-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              MCP Integration
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Register Model Context Protocol servers. Tools from MCP servers are
              automatically added to the tool registry.
            </p>
          </div>

          {/* Register Form */}
          <section className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">
              Register MCP Server
            </h2>
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Server Name *
                  </label>
                  <input
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. github-mcp"
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Server URL *
                  </label>
                  <input
                    required
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="http://localhost:3100"
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Description
                  </label>
                  <input
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="What does this server do?"
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Tools (comma-separated)
                  </label>
                  <input
                    value={toolsInput}
                    onChange={(e) => setToolsInput(e.target.value)}
                    placeholder="search, read_file, write_file"
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {error && (
                <div className="rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-200 px-3 py-2 text-sm text-red-700 dark:text-red-300">
                  {error}
                </div>
              )}
              {success && (
                <div className="rounded-lg bg-green-50 dark:bg-green-900/30 border border-green-200 px-3 py-2 text-sm text-green-700 dark:text-green-300">
                  {success}
                </div>
              )}

              <button
                type="submit"
                disabled={registering}
                className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {registering ? "Registering…" : "Register MCP Server"}
              </button>
            </form>
          </section>

          {/* Server List */}
          <section>
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-3">
              Registered Servers
            </h2>
            {loading ? (
              <p className="text-sm text-gray-400">Loading…</p>
            ) : servers.length === 0 ? (
              <p className="text-sm text-gray-400">No MCP servers registered yet.</p>
            ) : (
              <div className="space-y-3">
                {servers.map((s) => (
                  <div
                    key={s.name}
                    className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 px-5 py-4"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-medium text-gray-900 dark:text-gray-100">
                          {s.name}
                        </h3>
                        <p className="text-sm font-mono text-gray-500 dark:text-gray-400">
                          {s.url}
                        </p>
                        {s.description && (
                          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                            {s.description}
                          </p>
                        )}
                      </div>
                      <span className="text-xs bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-0.5 rounded-full">
                        {s.tools.length} tools
                      </span>
                    </div>
                    {s.tools.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {s.tools.map((t) => (
                          <span
                            key={t}
                            className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded font-mono"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* MCP Tools */}
          {mcpTools.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-3">
                MCP Tools in Registry
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {mcpTools.map((t) => (
                  <div
                    key={t.name}
                    className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-sm text-gray-900 dark:text-gray-100">
                        {t.name}
                      </span>
                      <span className="text-xs text-gray-400">{t.source}</span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {t.description}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
