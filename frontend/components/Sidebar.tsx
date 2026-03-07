"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";

const navItems = [
  { href: "/chat", label: "Chat", icon: "💬" },
  { href: "/models", label: "Models", icon: "🤖" },
  { href: "/agents", label: "Agents", icon: "🧠" },
  { href: "/tools", label: "Tools", icon: "🔧" },
  { href: "/workflows", label: "Workflows", icon: "⚡" },
  { href: "/mcp", label: "MCP", icon: "🔌" },
];

export function Sidebar() {
  const pathname = usePathname();
  const { userEmail, clearAuth } = useAuth();

  return (
    <aside className="w-56 shrink-0 flex flex-col h-screen bg-gray-950 border-r border-gray-800 text-gray-300">
      {/* Logo */}
      <div className="px-5 py-4 border-b border-gray-800">
        <span className="text-xl font-bold text-indigo-400">Cortex</span>
        <p className="text-xs text-gray-500 mt-0.5">AI Platform</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 space-y-0.5">
        {navItems.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                active
                  ? "bg-indigo-600 text-white"
                  : "text-gray-400 hover:bg-gray-800 hover:text-gray-100"
              }`}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* User */}
      {userEmail && (
        <div className="px-4 py-3 border-t border-gray-800">
          <p className="text-xs text-gray-500 truncate">{userEmail}</p>
          <button
            onClick={clearAuth}
            className="mt-1 text-xs text-red-500 hover:text-red-400 transition-colors"
          >
            Sign out
          </button>
        </div>
      )}
    </aside>
  );
}
