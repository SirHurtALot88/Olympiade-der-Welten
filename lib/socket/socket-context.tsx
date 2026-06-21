"use client";

import { createContext, useContext, useMemo } from "react";
import type { Socket } from "socket.io-client";

import { getClientSocket } from "@/lib/socket/client";
import type { ClientToServerEvents, ServerToClientEvents } from "@/types/events";

type ClientSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

const SocketContext = createContext<ClientSocket | null>(null);

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const socket = useMemo(() => getClientSocket(), []);
  return <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>;
}

export function useSocket() {
  const socket = useContext(SocketContext);
  if (!socket) {
    throw new Error("useSocket must be used within SocketProvider.");
  }
  return socket;
}
