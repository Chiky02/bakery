"use client";

import { useCallback, useEffect, useState } from "react";

export function useOnlineStatus() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    function sync() {
      setOnline(typeof navigator === "undefined" ? true : navigator.onLine);
    }
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  return online;
}

export function usePendingOutboxCount(pollMs = 4000) {
  const [count, setCount] = useState(0);
  const refresh = useCallback(async () => {
    try {
      const { countPendingOutbox } = await import("@/lib/offline/store");
      setCount(await countPendingOutbox());
    } catch {
      setCount(0);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => void refresh(), pollMs);
    window.addEventListener("sissa-outbox-changed", refresh);
    window.addEventListener("online", refresh);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("sissa-outbox-changed", refresh);
      window.removeEventListener("online", refresh);
    };
  }, [pollMs, refresh]);

  return { count, refresh };
}

export function notifyOutboxChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("sissa-outbox-changed"));
  }
}
