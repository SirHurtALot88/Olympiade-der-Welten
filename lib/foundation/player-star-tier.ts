/**
 * Star-Tier eines Spielers — die ligaweite "Top-Riege" als EIN gemeinsamer
 * Begriff für die ganze App.
 *
 * Ein Spieler, der ligaweit weit vorne steht, soll überall sofort als solcher
 * erkennbar sein: an seinem Portrait (Kader, Arena, Hover-Preview, Drawer) und
 * an den Rang-Anzeigen von OVR/PPs/MVS. Vorher gab es dafür nur eine
 * positionsbasierte Sonderlocke auf der Home-Kachel
 * (`getPlayerRankFrameClass`, Top 3 der eigenen Top-6) — also gerade KEINE
 * ligaweite Aussage.
 *
 * Es wird hier NICHTS neu gerechnet. Die Ränge stammen unverändert aus
 * `lib/foundation/player-rating-contract.ts` (`buildSharedRankMap` →
 * `ovrRank` / `ppsSeasonRank` / `mvsRank`); dieses Modul bildet sie nur auf
 * vier Stufen ab. Die Schwellen decken sich mit den bereits im Spiel
 * verwendeten Elite-Grenzen (`ovrRank <= 10` in der KI-Verkaufslogik,
 * `rank <= 3` in der Vorstands-Vertrauenslogik).
 */

export type PlayerStarTier = "diamond" | "gold" | "silver" | "bronze";

/**
 * Stufen von der höchsten zur niedrigsten — die Reihenfolge IST die Auswertung
 * (erster Treffer gewinnt), damit Schwellen und Rangfolge nicht an zwei
 * Stellen gepflegt werden müssen.
 */
export const PLAYER_STAR_TIERS: ReadonlyArray<{
  tier: PlayerStarTier;
  /** Bester Rang (inklusive), der diese Stufe noch erreicht. */
  maxRank: number;
  label: string;
  /** Kurzform für enge Stellen (Chips, `aria-label`). */
  shortLabel: string;
}> = [
  { tier: "diamond", maxRank: 3, label: "Diamant · Liga-Top-3", shortLabel: "Top 3" },
  { tier: "gold", maxRank: 10, label: "Gold · Liga-Top-10", shortLabel: "Top 10" },
  { tier: "silver", maxRank: 25, label: "Silber · Liga-Top-25", shortLabel: "Top 25" },
  { tier: "bronze", maxRank: 50, label: "Bronze · Liga-Top-50", shortLabel: "Top 50" },
];

/** Ab dieser Stufe (Top 10) bekommt die Karte zusätzlich den Holo-Schimmer. */
const HOLO_MAX_RANK = 10;

/**
 * Ligaweiter Rang eines Werts innerhalb seines Heat-Pools (1 = bester).
 *
 * Dieselbe Zaehlweise wie in der Spielertabelle (`getLeagueRank`): wie viele
 * Eintraege des Pools liegen ueber dem Wert. `null`, wenn Wert oder Pool
 * fehlen — dann gibt es schlicht keine Einordnung.
 *
 * Wird gebraucht, weil laengst nicht jede Ansicht fertige Raenge durchreicht,
 * die Liga-Pools aber fast ueberall vorliegen. So bekommen auch Portraits ohne
 * explizite Rang-Props ihre Stufe, statt still ohne Rahmen zu bleiben.
 */
export function resolveLeagueRankFromPool(
  value: number | null | undefined,
  pool: ReadonlyArray<number> | null | undefined,
): number | null {
  if (value == null || !Number.isFinite(value) || !pool || pool.length === 0) {
    return null;
  }
  let higher = 0;
  for (const entry of pool) {
    if (entry > value) {
      higher += 1;
    }
  }
  return higher + 1;
}

/**
 * Stufe eines einzelnen Rangs. `null` für alles außerhalb der Top 50, für
 * fehlende Ränge (z. B. Spieler ohne Roster-Eintrag, siehe
 * `outputOnlyPlayerIds` im Rating-Contract) und für unplausible Werte —
 * bewusst kein Fallback auf "Bronze", sonst trüge jeder rangloser Spieler
 * einen Rahmen.
 */
export function getPlayerStarTier(rank: number | null | undefined): PlayerStarTier | null {
  if (rank == null || !Number.isFinite(rank) || rank < 1) {
    return null;
  }
  return PLAYER_STAR_TIERS.find((entry) => rank <= entry.maxRank)?.tier ?? null;
}

/**
 * Beste Stufe über mehrere Ränge (OVR/PPs/MVS). Für das PORTRAIT gedacht:
 * ein Star ist ein Star, egal worüber er stark ist — wer in einer der drei
 * Kennzahlen Top 3 ist, trägt den Diamant-Rahmen, auch wenn er in den anderen
 * beiden mittelmäßig steht. Die einzelnen Kennzahl-Chips bekommen dagegen
 * jeweils ihre EIGENE Stufe (siehe `getPlayerStarTier`), damit auf der Karte
 * ablesbar bleibt, WORIN er top ist.
 */
export function getBestPlayerStarTier(
  ...ranks: Array<number | null | undefined>
): PlayerStarTier | null {
  const best = ranks.reduce<number | null>((lowest, rank) => {
    if (rank == null || !Number.isFinite(rank) || rank < 1) {
      return lowest;
    }
    return lowest == null || rank < lowest ? rank : lowest;
  }, null);
  return getPlayerStarTier(best);
}

/**
 * CSS-Klasse einer Stufe (leerer String ohne Stufe, damit Aufrufer die Klasse
 * bedingungslos in ein Template hängen können). Die Regeln liegen in
 * `app/globals.css` unter `.is-star-tier-*`.
 */
export function getPlayerStarTierClassName(tier: PlayerStarTier | null | undefined): string {
  return tier ? `is-star-tier-${tier}` : "";
}

/** Trägt diese Stufe den Holo-Schimmer (Top 10 = Gold und Diamant)? */
export function isHoloPlayerStarTier(tier: PlayerStarTier | null | undefined): boolean {
  if (!tier) {
    return false;
  }
  return (PLAYER_STAR_TIERS.find((entry) => entry.tier === tier)?.maxRank ?? Infinity) <= HOLO_MAX_RANK;
}

/** Volles Label einer Stufe ("Gold · Liga-Top-10"), `null` ohne Stufe. */
export function getPlayerStarTierLabel(tier: PlayerStarTier | null | undefined): string | null {
  if (!tier) {
    return null;
  }
  return PLAYER_STAR_TIERS.find((entry) => entry.tier === tier)?.label ?? null;
}

/** Kurzlabel einer Stufe ("Top 10"), `null` ohne Stufe. */
export function getPlayerStarTierShortLabel(tier: PlayerStarTier | null | undefined): string | null {
  if (!tier) {
    return null;
  }
  return PLAYER_STAR_TIERS.find((entry) => entry.tier === tier)?.shortLabel ?? null;
}

/**
 * Tooltip-Zeile für ein Portrait: nennt die Stufe und den Rang, der sie
 * ausgelöst hat — sonst rät man, warum die Karte leuchtet. `null`, wenn keine
 * Stufe erreicht ist.
 */
export function describePlayerStarTier(input: {
  ovrRank?: number | null;
  ppsRank?: number | null;
  mvsRank?: number | null;
}): string | null {
  const entries: Array<{ metric: string; rank: number }> = [];
  for (const [metric, rank] of [
    ["OVR", input.ovrRank],
    ["PPs", input.ppsRank],
    ["MVS", input.mvsRank],
  ] as const) {
    if (rank != null && Number.isFinite(rank) && rank >= 1) {
      entries.push({ metric, rank });
    }
  }
  const best = entries.reduce<{ metric: string; rank: number } | null>(
    (lowest, entry) => (lowest == null || entry.rank < lowest.rank ? entry : lowest),
    null,
  );
  const tier = getPlayerStarTier(best?.rank ?? null);
  if (!tier || !best) {
    return null;
  }
  return `${getPlayerStarTierLabel(tier)} — ${best.metric} #${best.rank}`;
}
