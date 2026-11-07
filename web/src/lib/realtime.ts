import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { io } from "socket.io-client";
import { API_URL, getToken } from "./api";

/** Keeps every open screen fresh: when the server says something changed, refetch the matching data. */
export function useRealtime(enabled: boolean) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!enabled) return;
    const socket = io(API_URL || undefined, { auth: { token: getToken() }, transports: ["websocket", "polling"] });
    const refresh = (...keys: string[]) => () => keys.forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
    socket.on("call:updated", refresh("calls", "call", "stats", "live"));
    socket.on("lead:updated", refresh("leads", "lead", "call", "stats"));
    socket.on("appointment:updated", refresh("appointments", "lead", "call"));
    socket.on("callback:updated", refresh("callbacks", "stats"));
    socket.on("settings:updated", refresh("settings"));
    return () => {
      socket.disconnect();
    };
  }, [enabled, qc]);
}
