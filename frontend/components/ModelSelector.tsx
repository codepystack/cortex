"use client";

import { Model } from "@/lib/types";

interface ModelSelectorProps {
  models: Model[];
  selected: string;
  onChange: (id: string) => void;
  disabled?: boolean;
}

export function ModelSelector({
  models,
  selected,
  onChange,
  disabled,
}: ModelSelectorProps) {
  return (
    <select
      value={selected}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled || models.length === 0}
      className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
    >
      {models.length === 0 && (
        <option value="">Loading models…</option>
      )}
      {models.map((m) => (
        <option key={m.id} value={m.id}>
          {m.display_name ?? m.id}
        </option>
      ))}
    </select>
  );
}
