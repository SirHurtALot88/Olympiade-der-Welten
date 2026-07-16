import RoomPageClient from "@/app/room/[roomCode]/RoomPageClient";

export const dynamic = "force-dynamic";

export default function RoomPage() {
  return <RoomPageClient />;
}
