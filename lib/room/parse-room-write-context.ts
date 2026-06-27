export function parseRoomWriteContextFromSearchParams(searchParams: URLSearchParams) {
  return {
    roomCode: searchParams.get("roomCode"),
    participantId: searchParams.get("participantId"),
    seatToken: searchParams.get("seatToken"),
    userId: searchParams.get("userId"),
    activeManagerTeamId: searchParams.get("activeManagerTeamId"),
    activeOwnerId: searchParams.get("activeOwnerId"),
    controlMode: searchParams.get("controlMode") as "human" | "ai" | "passive" | "manual" | null,
  };
}

export function parseRoomWriteContextFromRequest(request: Request) {
  return parseRoomWriteContextFromSearchParams(new URL(request.url).searchParams);
}

export type ParsedRoomWriteContext = ReturnType<typeof parseRoomWriteContextFromSearchParams>;
