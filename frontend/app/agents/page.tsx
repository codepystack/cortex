"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { Sidebar } from "@/components/Sidebar";
import { listAgents, listModels, listTools, registerAgent, runAgent } from "@/lib/api";
import { Agent, Model, RunAgentResponse, Tool } from "@/lib/types";

export default function AgentsPage() {
  const { token, hydrated } = useAuth();
  const router = useRouter();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [tools, setTools] = useState<Tool[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"list" | "register" | "run">(
    "list"
  );

  // Register form
  const [regName, setRegName] = useState("");
  const [regDescription, setRegDescription] = useState("");
  const [regModel, setRegModel] = useState("");
  const [regTools, setRegTools] = useState<string[]>([]);
  const [regPrompt, setRegPrompt] = useState("");
  const [registering, setRegistering] = useState(false);
  const [regError, setRegError] = useState<string | null>(null);
  const [regSuccess, setRegSuccess] = useState<string | null>(null);

  // Run form
  const [runAgentName, setRunAgentName] = useState("");
  const [runInput, setRunInput] = useState("");
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<RunAgentResponse | null>(null);
  const [runError, setRunError] = useState<string | null>(null);

  useEffect(() => {
    if (hydrated && !token) router.replace("/login");
  }, [hydrated, token, router]);

  const fetchAll = useCallback(() => {
    if (!token) return;
    Promise.all([listAgents(token), listModels(token), listTools(token)])
      .then(([a, m, t]) => {
        setAgents(a);
        setModels(m);
        setTools(t);
        if (m.length > 0) setRegModel(m[0].id);
        if (a.length > 0) setRunAgentName(a[0].name);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError(null);
    setRegSuccess(null);
    setRegistering(true);
    try {
      await registerAgent(
        {
          name: regName,
          description: regDescription,
          model: regModel,
          tools: regTools,
          system_prompt: regPrompt || null,
        },
        token
      );
      setRegSuccess(`Agent "${regName}" registered.`);
      setRegName("");
      setRegDescription("");
      setRegPrompt("");
      setRegTools([]);
      fetchAll();
    } catch (e) {
      setRegError(e instanceof Error ? e.message : "Failed to register agent");
    } finally {
      setRegistering(false);
    }
  };

  const handleRun = async (e: React.FormEvent) => {
    e.preventDefault();
    setRunError(null);
    setRunResult(null);
    setRunning(true);
    try {
      const result = await runAgent({ agent: runAgentName, input: runInput }, token);
      setRunResult(result);
    } catch (e) {
      setRunError(e instanceof Error ? e.message : "Failed to run agent");
    } finally {
      setRunning(false);
    }
  };

  const toggleTool = (toolName: string) => {
    setRegTools((prev) =>
      prev.includes(toolName)
        ? prev.filter((t) => t !== toolName)
        : [...prev, toolName]
    );
  };

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      <Sidebar />
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Agents
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Register and run AI agents. Agents implement reasoning loops
              powered by LLMs and tools.
            </p>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700">
            {(["list", "register", "run"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
                  activeTab === tab
                    ? "border-indigo-500 text-indigo-600 dark:text-indigo-400"
                    : "border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {loading ? (
            <p className="text-sm text-gray-400">Loading…</p>
          ) : (
            <>
              {/* List Tab */}
              {activeTab === "list" && (
                <div className="space-y-3">
                  {agents.length === 0 ? (
                    <p className="text-sm text-gray-400">
                      No agents registered yet. Use the Register tab to create
                      one.
                    </p>
                  ) : (
                    agents.map((a) => (
                      <div
                        key={a.name}
                        className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 px-5 py-4"
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="font-medium text-gray-900 dark:text-gray-100">
                              {a.name}
                            </h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                              {a.description}
                            </p>
                          </div>
                          <span className="text-xs bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-full font-mono">
                            {a.model}
                          </span>
                        </div>
                        {a.tools.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {a.tools.map((t) => (
                              <span
                                key={t}
                                className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded"
                              >
                                {t}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Register Tab */}
              {activeTab === "register" && (
                <form onSubmit={handleRegister} className="space-y-4 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Agent Name *
                      </label>
                      <input
                        required
                        value={regName}
                        onChange={(e) => setRegName(e.target.value)}
                        placeholder="e.g. research-agent"
                        className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Model *
                      </label>
                      <select
                        value={regModel}
                        onChange={(e) => setRegModel(e.target.value)}
                        className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        {models.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.display_name ?? m.id}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Description *
                      </label>
                      <input
                        required
                        value={regDescription}
                        onChange={(e) => setRegDescription(e.target.value)}
                        placeholder="What does this agent do?"
                        className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        System Prompt
                      </label>
                      <textarea
                        rows={3}
                        value={regPrompt}
                        onChange={(e) => setRegPrompt(e.target.value)}
                        placeholder="You are a helpful assistant…"
                        className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Tools
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {tools.map((t) => (
                          <button
                            type="button"
                            key={t.name}
                            onClick={() => toggleTool(t.name)}
                            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                              regTools.includes(t.name)
                                ? "bg-indigo-600 text-white"
                                : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200"
                            }`}
                          >
                            {t.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {regError && (
                    <div className="rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-200 px-3 py-2 text-sm text-red-700 dark:text-red-300">
                      {regError}
                    </div>
                  )}
                  {regSuccess && (
                    <div className="rounded-lg bg-green-50 dark:bg-green-900/30 border border-green-200 px-3 py-2 text-sm text-green-700 dark:text-green-300">
                      {regSuccess}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={registering}
                    className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                  >
                    {registering ? "Registering…" : "Register Agent"}
                  </button>
                </form>
              )}

              {/* Run Tab */}
              {activeTab === "run" && (
                <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 space-y-4">
                  <form onSubmit={handleRun} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Agent
                      </label>
                      <select
                        value={runAgentName}
                        onChange={(e) => setRunAgentName(e.target.value)}
                        className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        {agents.length === 0 && (
                          <option value="">No agents registered</option>
                        )}
                        {agents.map((a) => (
                          <option key={a.name} value={a.name}>
                            {a.name} ({a.model})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Input
                      </label>
                      <textarea
                        rows={4}
                        required
                        value={runInput}
                        onChange={(e) => setRunInput(e.target.value)}
                        placeholder="What should the agent do?"
                        className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={running || agents.length === 0}
                      className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                    >
                      {running ? "Running…" : "Run Agent"}
                    </button>
                  </form>

                  {runError && (
                    <div className="rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-200 px-3 py-2 text-sm text-red-700 dark:text-red-300">
                      {runError}
                    </div>
                  )}

                  {runResult && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <span>Session: <code className="font-mono">{runResult.session_id}</code></span>
                      </div>
                      <div className="rounded-lg bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 px-4 py-3">
                        <p className="text-xs font-medium text-gray-500 mb-1">Response</p>
                        <p className="text-sm text-gray-900 dark:text-gray-100 whitespace-pre-wrap">
                          {runResult.output}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
