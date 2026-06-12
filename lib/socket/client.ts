"use client";

import { io, type Socket } from "socket.io-client";

import type { ClientToServerEvents, ServerToClientEvents } from "@/types/events";

let clientSocket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;

export function getClientSocket() {
  if (!clientSocket) {
    clientSocket = io({
      path: "/socket.io",
    });
  }

  return clientSocket;
}
