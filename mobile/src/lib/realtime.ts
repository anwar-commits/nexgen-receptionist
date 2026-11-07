import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { io } from "socket.io-client";
import { API_URL, currentToken } from "./api";

/** Refetch whatever changed on the server (new call, lead, booking) while the app is open. */
export function useRealtime(enabled: boolean) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!enabled) return;
    const socket = io(API_URL, { auth: { token: currentToken() }, transports: ["websocket"] });
    const refresh = (...keys: string[]) => () => keys.forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
    socket.on("call:updated", refresh("calls", "call", "stats", "live"));
    socket.on("lead:updated", refresh("leads", "lead", "call", "stats"));
    socket.on("appointment:updated", refresh("appointments", "lead", "call"));
    socket.on("callback:updated", refresh("callbacks", "stats"));
    return () => {
      socket.disconnect();
    };
  }, [enabled, qc]);
}
