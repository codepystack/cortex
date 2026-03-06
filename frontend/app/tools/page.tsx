"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { Sidebar } from "@/components/Sidebar";
import { listTools, runTool } from "@/lib/api";
import { Tool } from "@/lib/types";

export default function ToolsPage() {
  const { token, hydrated } = useAuth();
  const router = useRouter();
  const [tools, setTools] = useState<Tool[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTool, setSelectedTool] = useState<Tool | null>(null);
  const [argsJson, setArgsJson] = useState("{}");
  const [result, setResult] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);

  useEffect(() => {
    if (hydrated && !token) router.replace("/login");
  }, [hydrated, token, router]);

  useEffect(() => {
    if (token) {
      listTools(token)
        .then((ts) => {
          setTools(ts);
          if (ts.length > 0) setSelectedTool(ts[0]);
        })
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [token]);

  const handleSelectTool = (tool: Tool) => {
    setSelectedTool(tool);
    // Build default args from schema
    const props = tool.parameters?.properties as
      | Record<string, unknown>
      | undefined;
    if (props) {
      const defaults: Record<string, string> = {};
      Object.keys(props).forEach((k) => (defaults[k] = ""));
      setArgsJson(JSON.stringify(defaults, null, 2));
    } else {
      setArgsJson("{}");
    }
    setResult(null);
    setRunError(null);
  };

  const handleRun = async () => {
    if (!selectedTool) return;
    setRunError(null);
    setResult(null);
    setRunning(true);
    try {
      const args = JSON.parse(argsJson);
      const resp = await runTool({ tool: selectedTool.name, args }, token);
      setResult(JSON.stringify(resp.output, null, 2));
    } catch (e) {
      setRunError(e instanceof Error ? e.message : "Error running tool");
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      <Sidebar />
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Tools
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Browse and run registered tools. Tools allow agents to interact
              with the world.
            </p>
          </div>

          {loading ? (
            <p className="text-sm text-gray-400">Loading tools…</p>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Tool list */}
              <div className="lg:col-span-1 space-y-2">
                {tools.map((t) => (
                  <button
                    key={t.name}
                    onClick={() => handleSelectTool(t)}
                    className={`w-full text-left rounded-xl border px-4 py-3 transition-colors ${
                      selectedTool?.name === t.name
                        ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30"
                        : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-indigo-300"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-sm font-medium text-gray-900 dark:text-gray-100">
                        {t.name}
                      </span>
                      <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 px-2 py-0.5 rounded-full">
                        {t.source}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">
                      {t.description}
                    </p>
                  </button>
                ))}
              </div>

              {/* Tool runner */}
              {selectedTool && (
                <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 space-y-4">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white font-mono">
                      {selectedTool.name}
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                      {selectedTool.description}
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Arguments (JSON)
                    </label>
                    <textarea
                      rows={6}
                      value={argsJson}
                      onChange={(e) => setArgsJson(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 px-3 py-2 text-sm font-mono text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <button
                    onClick={handleRun}
                    disabled={running}
                    className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                  >
                    {running ? "Running…" : "Run Tool"}
                  </button>

                  {runError && (
                    <div className="rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 px-3 py-2 text-sm text-red-700 dark:text-red-300">
                      {runError}
                    </div>
                  )}

                  {result !== null && (
                    <div>
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                        Output
                      </p>
                      <pre className="rounded-lg bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 px-4 py-3 text-sm font-mono text-gray-900 dark:text-gray-100 overflow-auto max-h-64">
                        {result}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
