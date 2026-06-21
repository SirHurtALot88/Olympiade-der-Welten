import type { OlyRoomState, RoomRealtimeEvent } from "@/types/game";

export type LocalRoomRealtimeMessage =
  | { type: "roomState"; roomCode: string; state: OlyRoomState }
  | { type: "roomGameplayEvent"; roomCode: string; event: RoomRealtimeEvent };

const CHANNEL_NAME = "oly-room-realtime-v1";
const STORAGE_KEY = "oly-room-realtime-event";

function canUseBrowserRealtime() {
  return typeof window !== "undefined";
}

export function publishLocalRoomRealtimeMessage(message: LocalRoomRealtimeMessage) {
  if (!canUseBrowserRealtime()) return;

  if ("BroadcastChannel" in window) {
    const channel = new BroadcastChannel(CHANNEL_NAME);
    channel.postMessage(message);
    channel.close();
  }

  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        ...message,
        emittedAt: Date.now(),
      }),
    );
  } catch {
    // Local realtime is a best-effort bridge for browser-only multiplayer prep.
  }
}

export function subscribeLocalRoomRealtimeMessages(
  roomCode: string,
  listener: (message: LocalRoomRealtimeMessage) => void,
) {
  if (!canUseBrowserRealtime()) {
    return () => {};
  }

  const normalizedRoomCode = roomCode.trim().toUpperCase();
  const channel = "BroadcastChannel" in window ? new BroadcastChannel(CHANNEL_NAME) : null;

  function handleMessage(message: LocalRoomRealtimeMessage) {
    if (message.roomCode.trim().toUpperCase() === normalizedRoomCode) {
      listener(message);
    }
  }

  function handleBroadcast(event: MessageEvent) {
    const message = event.data as LocalRoomRealtimeMessage | null;
    if (!message || typeof message !== "object" || !("type" in message)) return;
    handleMessage(message);
  }

  function handleStorage(event: StorageEvent) {
    if (event.key !== STORAGE_KEY || !event.newValue) return;
    try {
      const message = JSON.parse(event.newValue) as LocalRoomRealtimeMessage;
      handleMessage(message);
    } catch {
      // Ignore malformed local bridge messages from older tabs.
    }
  }

  channel?.addEventListener("message", handleBroadcast);
  window.addEventListener("storage", handleStorage);

  return () => {
    channel?.removeEventListener("message", handleBroadcast);
    channel?.close();
    window.removeEventListener("storage", handleStorage);
  };
}
