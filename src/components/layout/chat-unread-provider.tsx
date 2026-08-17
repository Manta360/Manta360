"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Role } from "@/lib/roles";

type ChatUnreadContextValue = { unreadCount: number; refreshUnreadCount: () => Promise<void> };
const ChatUnreadContext = createContext<ChatUnreadContextValue>({ unreadCount: 0, refreshUnreadCount: async () => undefined });

export function ChatUnreadProvider({ role, children }: { role: Role; children: ReactNode }) {
  const [unreadCount, setUnreadCount] = useState(0);
  const enabled = role === "ARRENDADOR" || role === "ARRENDATARIO";

  const refreshUnreadCount = useCallback(async () => {
    if (!enabled) return;
    try {
      const response = await fetch("/api/chat?summary=unread");
      const data = await response.json();
      if (response.ok) setUnreadCount(Number(data.unreadCount ?? 0));
    } catch {
      // Navigation remains usable if the optional counter cannot be refreshed.
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    void refreshUnreadCount();
    const timer = window.setInterval(() => void refreshUnreadCount(), 15_000);
    const onRead = () => void refreshUnreadCount();
    window.addEventListener("manta360:chat-read", onRead);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("manta360:chat-read", onRead);
    };
  }, [enabled, refreshUnreadCount]);

  const value = useMemo(() => ({ unreadCount, refreshUnreadCount }), [refreshUnreadCount, unreadCount]);
  return <ChatUnreadContext.Provider value={value}>{children}</ChatUnreadContext.Provider>;
}

export function useChatUnread() {
  return useContext(ChatUnreadContext);
}
