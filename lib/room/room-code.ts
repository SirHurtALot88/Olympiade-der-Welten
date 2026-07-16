export function createRoomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const chars = Array.from({ length: 8 }, () => alphabet[Math.floor(Math.random() * alphabet.length)] ?? "X").join("");
  return `${chars.slice(0, 4)}-${chars.slice(4)}`;
}
