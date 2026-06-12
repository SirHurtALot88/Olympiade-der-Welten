"use client";

import { createContext, useContext, useMemo } from "react";

import { getClientSocket } from "@/lib/socket/client";

const SocketContext = createContext(getClientSocket());

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const socket = useMemo(() => getClientSocket(), []);
  return <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>;
}

export function useSocket() {
  return useContext(SocketContext);
}
