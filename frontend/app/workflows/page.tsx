"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { Sidebar } from "@/components/Sidebar";
import {
  listWorkflows,
  registerWorkflow,
  runWorkflow,
} from "@/lib/api";
import { RunWorkflowResponse, Workflow } from "@/lib/types";

const DEFAULT_WORKFLOW: Workflow = {
  name: "",
  description: "",
  nodes: [
    { id: "n1", kind: "input", config: {} },
    { id: "n2", kind: "llm", config: { model: "cortex-echo" } },
    { id: "n3", kind: "output", config: {} },
  ],
};

export default function WorkflowsPage() {
  const { token, hydrated } = useAuth();
  const router = useRouter();
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"list" | "register" | "run">(
    "list"
  );

  // Register form
  const [formJson, setFormJson] = useState(
    JSON.stringify(DEFAULT_WORKFLOW, null, 2)
  );
  const [registering, setRegistering] = useState(false);
  const [regError, setRegError] = useState<string | null>(null);
  const [regSuccess, setRegSuccess] = useState<string | null>(null);

  // Run form
  const [runName, setRunName] = useState("");
  const [runInput, setRunInput] = useState("");
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<RunWorkflowResponse | null>(null);
  const [runError, setRunError] = useState<string | null>(null);

  useEffect(() => {
    if (hydrated && !token) router.replace("/login");
  }, [hydrated, token, router]);

  const fetchWorkflows = useCallback(() => {
    if (!token) return;
    listWorkflows(token)
      .then((ws) => {
        setWorkflows(ws);
        if (ws.length > 0) setRunName(ws[0].name);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    fetchWorkflows();
  }, [fetchWorkflows]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError(null);
    setRegSuccess(null);
    setRegistering(true);
    try {
      const payload = JSON.parse(formJson) as Workflow;
      await registerWorkflow(payload, token);
      setRegSuccess(`Workflow "${payload.name}" registered.`);
      fetchWorkflows();
    } catch (e) {
      setRegError(
        e instanceof Error ? e.message : "Failed to register workflow"
      );
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
      const result = await runWorkflow(runName, runInput, token);
      setRunResult(result);
    } catch (e) {
      setRunError(e instanceof Error ? e.message : "Failed to run workflow");
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      <Sidebar />
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Workflows
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Define and run execution pipelines composed of LLM, tool, and
              transform nodes.
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
                  {workflows.length === 0 ? (
                    <p className="text-sm text-gray-400">
                      No workflows registered yet.
                    </p>
                  ) : (
                    workflows.map((w) => (
                      <div
                        key={w.name}
                        className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 px-5 py-4"
                      >
                        <h3 className="font-medium text-gray-900 dark:text-gray-100">
                          {w.name}
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                          {w.description}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {w.nodes.map((n) => (
                            <span
                              key={n.id}
                              className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded font-mono"
                            >
                              {n.kind}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Register Tab */}
              {activeTab === "register" && (
                <form
                  onSubmit={handleRegister}
                  className="space-y-4 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6"
                >
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Workflow Definition (JSON)
                    </label>
                    <p className="text-xs text-gray-400 mb-2">
                      Node kinds: <code>input</code>, <code>llm</code>,{" "}
                      <code>tool</code>, <code>transform</code>,{" "}
                      <code>output</code>
                    </p>
                    <textarea
                      rows={16}
                      value={formJson}
                      onChange={(e) => setFormJson(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 px-3 py-2 text-sm font-mono text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
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
                    {registering ? "Registering…" : "Register Workflow"}
                  </button>
                </form>
              )}

              {/* Run Tab */}
              {activeTab === "run" && (
                <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 space-y-4">
                  <form onSubmit={handleRun} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Workflow
                      </label>
                      <select
                        value={runName}
                        onChange={(e) => setRunName(e.target.value)}
                        className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        {workflows.length === 0 && (
                          <option value="">No workflows registered</option>
                        )}
                        {workflows.map((w) => (
                          <option key={w.name} value={w.name}>
                            {w.name}
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
                        placeholder="Initial input for the workflow…"
                        className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={running || workflows.length === 0}
                      className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                    >
                      {running ? "Running…" : "Run Workflow"}
                    </button>
                  </form>

                  {runError && (
                    <div className="rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-200 px-3 py-2 text-sm text-red-700 dark:text-red-300">
                      {runError}
                    </div>
                  )}

                  {runResult && (
                    <div className="rounded-lg bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 px-4 py-3 space-y-1">
                      <p className="text-xs font-medium text-gray-500">
                        Output
                      </p>
                      <p className="text-sm text-gray-900 dark:text-gray-100 whitespace-pre-wrap">
                        {runResult.output}
                      </p>
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
