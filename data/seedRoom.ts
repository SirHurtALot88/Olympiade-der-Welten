import type { AthleteToken, CoachRole } from "@/types/game";

const labelsByRole: Record<CoachRole, string[]> = {
  A: ["A1", "A2", "A3", "A4"],
  B: ["B1", "B2", "B3", "B4"],
};

export function createSeedTokens(): AthleteToken[] {
  return (["A", "B"] as const).flatMap((role) =>
    labelsByRole[role].map((label, index) => ({
      id: `${role.toLowerCase()}-${index + 1}`,
      ownerRole: role,
      position: 0,
      label,
    })),
  );
}
