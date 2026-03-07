"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { listModels, streamChatCompletion } from "@/lib/api";
import { Message, Model } from "@/lib/types";
import { ChatMessage } from "./ChatMessage";
import { ModelSelector } from "./ModelSelector";
import { useAuth } from "@/hooks/useAuth";
import { Sidebar } from "./Sidebar";

export function ChatInterface() {
  const { token } = useAuth();
  const [models, setModels] = useState<Model[]>([]);
  const [selectedModel, setSelectedModel] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load models
  useEffect(() => {
    listModels(token)
      .then((ms) => {
        setModels(ms);
        if (ms.length > 0) setSelectedModel(ms[0].id);
      })
      .catch(console.error);
  }, [token]);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || streaming) return;

    setError(null);
    setInput("");

    const newMessages: Message[] = [
      ...messages,
      { role: "user", content: text },
    ];
    setMessages(newMessages);

    // Append placeholder for assistant
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);
    setStreaming(true);

    try {
      let accum = "";
      for await (const chunk of streamChatCompletion(
        { model: selectedModel, messages: newMessages, stream: true },
        token
      )) {
        accum += chunk;
        setMessages((prev) => {
          const copy = [...prev];
          copy[copy.length - 1] = { role: "assistant", content: accum };
          return copy;
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      // Remove the empty assistant placeholder on error
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setStreaming(false);
    }
  }, [input, messages, selectedModel, streaming, token]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearConversation = () => setMessages([]);

  return (
    <div className="flex h-screen bg-white dark:bg-gray-900">
      <Sidebar />

      <div className="flex flex-col flex-1 min-w-0">
        {/* ── Header ── */}
        <header className="flex items-center justify-between px-6 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="text-lg font-semibold text-gray-800 dark:text-gray-100">
              Chat
            </span>
          </div>

          <div className="flex items-center gap-3">
            <ModelSelector
              models={models}
              selected={selectedModel}
              onChange={setSelectedModel}
              disabled={streaming}
            />
            {messages.length > 0 && (
              <button
                onClick={clearConversation}
                className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              >
                Clear
              </button>
            )}
          </div>
        </header>

        {/* ── Messages ── */}
        <main className="flex-1 overflow-y-auto px-4 py-6 space-y-2">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center gap-4 text-gray-400">
              <span className="text-5xl">🧠</span>
              <p className="text-lg font-medium text-gray-500 dark:text-gray-400">
                What can I help you with?
              </p>
              <p className="text-sm">
                Model:{" "}
                <span className="font-mono text-indigo-500">
                  {selectedModel || "loading…"}
                </span>
              </p>
            </div>
          )}
          {messages.map((msg, i) => (
            <ChatMessage key={i} message={msg} />
          ))}
          {streaming && messages[messages.length - 1]?.content === "" && (
            <div className="flex justify-start mb-4">
              <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl rounded-bl-sm px-4 py-3">
                <span className="inline-flex gap-1">
                  {[0, 1, 2].map((d) => (
                    <span
                      key={d}
                      className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce"
                      style={{ animationDelay: `${d * 150}ms` }}
                    />
                  ))}
                </span>
              </div>
            </div>
          )}
          {error && (
            <div className="rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 px-4 py-3 text-sm text-red-700 dark:text-red-300">
              {error}
            </div>
          )}
          <div ref={bottomRef} />
        </main>

        {/* ── Input ── */}
        <footer className="px-4 pb-6 pt-2 bg-white dark:bg-gray-900">
          <div className="mx-auto max-w-3xl flex gap-3 items-end rounded-2xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 px-4 py-3 shadow-sm focus-within:ring-2 focus-within:ring-indigo-500">
            <textarea
              ref={textareaRef}
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Send a message… (Shift+Enter for newline)"
              disabled={streaming}
              className="flex-1 resize-none bg-transparent text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none disabled:opacity-50 max-h-40 overflow-auto"
              style={{ fieldSizing: "content" } as React.CSSProperties}
            />
            <button
              onClick={sendMessage}
              disabled={streaming || !input.trim()}
              className="shrink-0 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-40 transition-colors"
            >
              {streaming ? "…" : "Send"}
            </button>
          </div>
          <p className="text-center text-xs text-gray-400 mt-2">
            Cortex may produce incorrect information. Verify important facts.
          </p>
        </footer>
      </div>
    </div>
  );
}
