"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { listModels, streamChatCompletion } from "@/lib/api";
import { extractPdfText } from "@/lib/pdf";
import { Message, Model } from "@/lib/types";
import { ChatMessage } from "./ChatMessage";
import { ModelSelector } from "./ModelSelector";
import { useAuth } from "@/hooks/useAuth";

export function ChatInterface() {
  const { token, userEmail, clearAuth } = useAuth();
  const [models, setModels] = useState<Model[]>([]);
  const [selectedModel, setSelectedModel] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attachedPdf, setAttachedPdf] = useState<{
    name: string;
    text: string;
  } | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    if ((!text && !attachedPdf) || streaming) return;

    setError(null);
    setInput("");

    // Build the full message content: prepend PDF context if attached
    let fullContent = text;
    if (attachedPdf) {
      // Sanitize the filename: keep only safe characters
      const safeName = attachedPdf.name
        .replace(/[^\w\s.\-()[\]]/g, "")
        .trim()
        .slice(0, 200);
      fullContent = `[Attached PDF: ${safeName}]\n${attachedPdf.text}${text ? `\n\n${text}` : ""}`;
      setAttachedPdf(null);
    }

    const newMessages: Message[] = [
      ...messages,
      { role: "user", content: fullContent },
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
  }, [input, attachedPdf, messages, selectedModel, streaming, token]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearConversation = () => setMessages([]);

  const handlePdfChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset so the same file can be re-selected
    e.target.value = "";
    setPdfLoading(true);
    setError(null);
    try {
      const text = await extractPdfText(file);
      setAttachedPdf({ name: file.name, text });
    } catch (err) {
      console.error("PDF extraction failed:", err);
      setError("Failed to read PDF. Please try another file.");
    } finally {
      setPdfLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-white dark:bg-gray-900">
      {/* ── Header ── */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="text-2xl font-bold tracking-tight text-indigo-600 dark:text-indigo-400">
            Cortex
          </span>
          <span className="text-xs text-gray-400 hidden sm:block">
            AI Platform
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
          {userEmail && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 hidden md:block">
                {userEmail}
              </span>
              <button
                onClick={clearAuth}
                className="text-xs text-red-500 hover:text-red-700"
              >
                Sign out
              </button>
            </div>
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
        <div className="mx-auto max-w-3xl">
          {/* Attached PDF badge */}
          {attachedPdf && (
            <div className="flex items-center gap-2 mb-2 px-1">
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-900/40 border border-indigo-200 dark:border-indigo-700 px-3 py-1 text-xs text-indigo-700 dark:text-indigo-300">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-3.5 w-3.5 shrink-0"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm-1 1.5L18.5 9H13V3.5zM6 20V4h5v7h7v9H6z" />
                </svg>
                {attachedPdf.name}
                <button
                  aria-label="Remove attachment"
                  onClick={() => setAttachedPdf(null)}
                  className="ml-1 text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-200"
                >
                  ✕
                </button>
              </span>
            </div>
          )}

          <div className="flex gap-3 items-end rounded-2xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 px-4 py-3 shadow-sm focus-within:ring-2 focus-within:ring-indigo-500">
            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,application/pdf"
              className="hidden"
              onChange={handlePdfChange}
            />

            {/* Paperclip / attach button */}
            <button
              type="button"
              aria-label="Attach PDF"
              title="Attach PDF"
              disabled={streaming || pdfLoading}
              onClick={() => fileInputRef.current?.click()}
              className="shrink-0 text-gray-400 hover:text-indigo-500 disabled:opacity-40 transition-colors"
            >
              {pdfLoading ? (
                <span className="inline-flex gap-0.5">
                  {[0, 1, 2].map((d) => (
                    <span
                      key={d}
                      className="w-1 h-1 rounded-full bg-gray-400 animate-bounce"
                      style={{ animationDelay: `${d * 150}ms` }}
                    />
                  ))}
                </span>
              ) : (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
                  />
                </svg>
              )}
            </button>

            <textarea
              ref={textareaRef}
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                attachedPdf
                  ? "Ask something about the PDF…"
                  : "Send a message… (Shift+Enter for newline)"
              }
              disabled={streaming}
              className="flex-1 resize-none bg-transparent text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none disabled:opacity-50 max-h-40 overflow-auto"
              style={{ fieldSizing: "content" } as React.CSSProperties}
            />
            <button
              onClick={sendMessage}
              disabled={streaming || (!input.trim() && !attachedPdf)}
              className="shrink-0 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-40 transition-colors"
            >
              {streaming ? "…" : "Send"}
            </button>
          </div>
        </div>
        <p className="text-center text-xs text-gray-400 mt-2">
          Cortex may produce incorrect information. Verify important facts.
        </p>
      </footer>
    </div>
  );
}
