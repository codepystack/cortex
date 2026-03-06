"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { ChatInterface } from "@/components/ChatInterface";

export default function ChatPage() {
  const { token, hydrated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Only redirect after localStorage has been read (hydration complete)
    // to avoid a flash-redirect on first render.
    if (hydrated && !token) {
      router.replace("/login");
    }
  }, [hydrated, token, router]);

  return <ChatInterface />;
}
