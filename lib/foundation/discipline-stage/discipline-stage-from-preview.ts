import type { DisciplineResolvePreview } from "@/lib/resolve/legacy-matchday-resolve-types";

// Mapping der ECHTEN Resolve-Engine-Preview auf das additive Szenen-Payload der
// Disziplin-Bühne. Ziel (Parität zur Arena): die Bühne rechnet NICHTS selbst —
// pro Spieler kommt die fertige Engine-Zerlegung (baseValue + Fatigue/Captain/
// Mutator-Deltas), und die Team-Summe wird exakt auf `teamResult.score`
// abgeglichen (Team-Level-Mods wie Form/Intensität/Team-Power werden dabei
// gleichmäßig auf die Slots verteilt, damit Σ(Netto) == score gilt und die
// Rangfolge der Szene deckungsgleich mit der Engine ist).

export type StagePreviewMod = { k: string; sign: 1 | -1; amt: number };

export type StagePreviewPlayer = {
  val: number;
  name: string;
  portraitUrl: string | null;
  mods: StagePreviewMod[];
  pointsAwarded: number | null;
};

export type StagePreviewTeam = {
  teamId: string;
  code: string;
  name: string;
  logoUrl: string | null;
  rank: number;
  score: number;
  teamPoints: number | null;
  players: StagePreviewPlayer[];
};

export type StageTeamMeta = { code: string; name: string; logoUrl: string | null };

function round1(x: number): number {
  return Math.round(x * 10) / 10;
}

function modSum(mods: StagePreviewMod[]): number {
  return mods.reduce((sum, m) => sum + m.sign * m.amt, 0);
}

export function buildDisciplineStageTeamsFromPreview(
  discipline: DisciplineResolvePreview,
  teamMetaById: Map<string, StageTeamMeta>,
  portraitById: Map<string, string | null>,
): StagePreviewTeam[] {
  return discipline.teamResults.map((teamResult) => {
    const meta = teamMetaById.get(teamResult.teamId);

    const players: StagePreviewPlayer[] = teamResult.entries.map((entry) => {
      const base = round1(entry.baseValue ?? 0);
      const mods: StagePreviewMod[] = [];

      // Fatigue = fatigueAdjustedValue − baseValue (kann negativ sein).
      const fatigued = entry.fatigueAdjustedValue ?? entry.baseValue ?? 0;
      const fatigueDelta = round1(fatigued - (entry.baseValue ?? 0));
      if (Math.abs(fatigueDelta) >= 0.05) {
        mods.push({ k: "Fatigue", sign: fatigueDelta < 0 ? -1 : 1, amt: Math.abs(fatigueDelta) });
      }
      if (entry.captainBonus) {
        mods.push({ k: "Captain", sign: entry.captainBonus < 0 ? -1 : 1, amt: round1(Math.abs(entry.captainBonus)) });
      }
      if (entry.mutatorBonus) {
        mods.push({ k: "Mutator", sign: entry.mutatorBonus < 0 ? -1 : 1, amt: round1(Math.abs(entry.mutatorBonus)) });
      }

      return {
        val: base,
        name: entry.playerName,
        portraitUrl: portraitById.get(entry.playerId) ?? null,
        mods,
        pointsAwarded: entry.pointsAwarded ?? null,
      };
    });

    // Team-Level-Delta (Form/Intensität/Team-Power/Team-PPs + Rundung) so
    // verteilen, dass Σ(Netto) exakt == teamResult.score. Der letzte Slot nimmt
    // den Rundungsrest auf, damit keine Drift bleibt.
    const playerNetSum = players.reduce((sum, p) => sum + p.val + modSum(p.mods), 0);
    let teamDelta = round1(teamResult.score - playerNetSum);
    if (Math.abs(teamDelta) >= 0.05 && players.length > 0) {
      const perSlot = round1(teamDelta / players.length);
      players.forEach((player, index) => {
        const amount = index === players.length - 1 ? round1(teamDelta) : perSlot;
        teamDelta = round1(teamDelta - amount);
        if (Math.abs(amount) >= 0.05) {
          player.mods.push({ k: "Team", sign: amount < 0 ? -1 : 1, amt: Math.abs(amount) });
        }
      });
    }

    return {
      teamId: teamResult.teamId,
      code: meta?.code ?? teamResult.teamId,
      name: meta?.name ?? teamResult.teamName,
      logoUrl: meta?.logoUrl ?? null,
      rank: teamResult.rank,
      score: teamResult.score,
      teamPoints: teamResult.teamPoints,
      players,
    };
  });
}

// Netto-Summe eines gemappten Teams (für Tests/Anzeige) — muss teamResult.score treffen.
export function stageTeamNetTotal(team: StagePreviewTeam): number {
  return round1(team.players.reduce((sum, p) => sum + p.val + modSum(p.mods), 0));
}
