import type { DisciplineResolvePreview } from "@/lib/resolve/legacy-matchday-resolve-types";
import { INJURY_PERFORMANCE_MULTIPLIER } from "@/lib/fatigue/fatigue-calibration";

// Mapping der ECHTEN Resolve-Engine-Preview auf das additive Szenen-Payload der
// Disziplin-Bühne. Ziel (Parität zur Arena): die Bühne rechnet NICHTS selbst —
// pro Spieler kommt die fertige Engine-Zerlegung (baseValue + Fatigue/Captain/
// Mutator-Deltas), und die Team-Summe wird exakt auf `teamResult.score`
// abgeglichen (Team-Level-Mods wie Form/Intensität/Team-Power werden dabei
// gleichmäßig auf die Slots verteilt, damit Σ(Netto) == score gilt und die
// Rangfolge der Szene deckungsgleich mit der Engine ist).

// Anteil, den INJURY_PERFORMANCE_MULTIPLIER vom Basis-/Fatigue-Anteil abzieht,
// als ganzzahliger Prozentwert für die UI (z.B. 0.5 → 50). Läuft zur Laufzeit
// aus der Konstante — NIE hartkodieren, sonst driftet die Anzeige vom echten
// Faktor weg, sobald jemand INJURY_PERFORMANCE_MULTIPLIER anpasst.
const INJURY_PERFORMANCE_PENALTY_UI_PERCENT = Math.round((1 - INJURY_PERFORMANCE_MULTIPLIER) * 100);

export type StagePreviewMod = { k: string; sign: 1 | -1; amt: number; injury?: boolean };

export type StagePreviewPlayer = {
  playerId: string | null;
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
  // A2: Team hat für diese Disziplin gar keine Aufstellung eingereicht — die Engine
  // liefert dann trotzdem einen (0-)teamResult-Eintrag. Muss in der Bühne sichtbar
  // markiert werden, statt als normales 0-Punkte-Ergebnis durchzugehen.
  missingLineup: boolean;
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
      // Same-day-Verletzung: eigene, EXPLIZITE Zeile (statt im "Moral"-Rest zu
      // verschwinden) — genau der Wunsch des Owners: sichtbar machen, dass ein
      // verletzter Spieler nur INJURY_PERFORMANCE_MULTIPLIER seines Basis-/
      // Fatigue-Anteils einbringt. `injury: true` markiert den Mod für die
      // Arena (Bühnen-Feedback + Detektion), statt sich auf das Label-Regex
      // verlassen zu müssen.
      if (entry.injuryApplied && entry.injuryAdjustedValue != null) {
        const injuryDelta = round1(entry.injuryAdjustedValue - fatigued);
        if (Math.abs(injuryDelta) >= 0.05) {
          mods.push({
            k: `Verletzung −${INJURY_PERFORMANCE_PENALTY_UI_PERCENT} % (Basis)`,
            sign: -1,
            amt: Math.abs(injuryDelta),
            injury: true,
          });
        }
      }
      if (entry.captainBonus) {
        mods.push({ k: "Captain", sign: entry.captainBonus < 0 ? -1 : 1, amt: round1(Math.abs(entry.captainBonus)) });
      }
      if (entry.mutatorBonus) {
        mods.push({ k: "Mutator", sign: entry.mutatorBonus < 0 ? -1 : 1, amt: round1(Math.abs(entry.mutatorBonus)) });
      }
      // Form ist jetzt PRO SPIELER (flacher Kartenwert + Jitter) und steckt schon
      // in finalPlayerScore — hier als eigene, beschriftete Zeile ausweisen, damit
      // der Moral-Rest sie nicht verschluckt.
      if (entry.formShare && Math.abs(entry.formShare) >= 0.05) {
        mods.push({ k: entry.formShare < 0 ? "Formtief" : "Form", sign: entry.formShare < 0 ? -1 : 1, amt: round1(Math.abs(entry.formShare)) });
      }
      // Rest je Spieler, damit das Netto EXAKT die echte Engine-Contribution
      // trifft (Moral u.a. per-Spieler-Effekte, die nicht als eigenes Feld
      // vorliegen) — so trägt jeder Spieler seine volle individuelle Leistung.
      if (entry.finalPlayerScore != null) {
        const rest = round1(entry.finalPlayerScore - (base + modSum(mods)));
        if (Math.abs(rest) >= 0.05) {
          mods.push({ k: "Moral", sign: rest < 0 ? -1 : 1, amt: Math.abs(rest) });
        }
      }

      return {
        playerId: entry.playerId ?? null,
        val: base,
        name: entry.playerName,
        portraitUrl: portraitById.get(entry.playerId) ?? null,
        mods,
        pointsAwarded: entry.pointsAwarded ?? null,
      };
    });

    // Team-Level-Effekte (Form-Card / Intensität / Team-Power / Team-PPs) sind
    // nicht pro Spieler in den Entries, sondern auf Team-Ebene. Für den additiven
    // Slot-Reveal verteilen wir sie GLEICHMÄSSIG auf die Slots — aber BESCHRIFTET,
    // damit im Hover/Reveal transparent bleibt, woher die Punkte kommen.
    if (players.length > 0) {
      // Form NICHT mehr team-weit gleichverteilen — sie ist bereits pro Spieler
      // (formShare, s. oben) berücksichtigt. Nur die echten Team-Effekte bleiben.
      const teamLevelMods: { k: string; value: number }[] = [
        { k: "Intensität", value: teamResult.intensityModifier ?? 0 },
        { k: "Team-Power", value: teamResult.teamPowerModifier ?? 0 },
        { k: "Team-PPs", value: teamResult.teamPpsModifier ?? 0 },
      ];
      for (const teamMod of teamLevelMods) {
        if (Math.abs(teamMod.value) < 0.05) {
          continue;
        }
        let remaining = round1(teamMod.value);
        players.forEach((player, index) => {
          const amount = index === players.length - 1 ? round1(remaining) : round1(teamMod.value / players.length);
          remaining = round1(remaining - amount);
          if (Math.abs(amount) >= 0.05) {
            player.mods.push({ k: teamMod.k, sign: amount < 0 ? -1 : 1, amt: Math.abs(amount) });
          }
        });
      }
    }

    // Rest-Reconcile: verbleibende Differenz (Rundung / nicht separat gelistete
    // Effekte) auf den letzten Slot, damit Σ(Netto) exakt == teamResult.score.
    const playerNetSum = players.reduce((sum, p) => sum + p.val + modSum(p.mods), 0);
    const residual = round1(teamResult.score - playerNetSum);
    if (Math.abs(residual) >= 0.05 && players.length > 0) {
      const last = players[players.length - 1]!;
      last.mods.push({ k: "Team", sign: residual < 0 ? -1 : 1, amt: Math.abs(residual) });
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
      missingLineup: teamResult.missingLineup,
    };
  });
}

// Netto-Summe eines gemappten Teams (für Tests/Anzeige) — muss teamResult.score treffen.
export function stageTeamNetTotal(team: StagePreviewTeam): number {
  return round1(team.players.reduce((sum, p) => sum + p.val + modSum(p.mods), 0));
}
