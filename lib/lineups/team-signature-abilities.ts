import type { GameState, PlayerAvailabilityStateRecord } from "@/lib/data/olyDataTypes";

/**
 * PROTOTYP — Signature-Abilities (siehe docs/team-abilities-redesign.md).
 *
 * Dieses Modul ist bewusst NICHT in Score-/Resolve-Engine oder UI verdrahtet. Es ist der
 * Machbarkeitsnachweis für den Entwurf "eine starke, einzigartige Ability pro Team":
 *
 * 1. Ein schmaler Ability-Rahmen (Timing-Fenster, Effekt-Baustein, Ziel, Ladungen,
 *    optionale Bedingung) als Datenmodell — KEINE 32 Spezialsysteme, sondern wenige
 *    Bausteine mit team-spezifischen Parametern.
 * 2. Zwei Nicht-Arena-Effekte als pure GameState-Transformationen: Cash-Gewinn
 *    (Cash Creators) und Fatigue-Angriff/-Erholung. Beide fassen ausschliesslich
 *    bestehende Persistenzfelder an (`team.cash`, `playerAvailabilityState[].fatigue`,
 *    `player.fatigue`) — genau die Felder, die Sponsor-Events bzw.
 *    applyFatigueAndInjuryAfterMatchday heute schon schreiben.
 *
 * Die Arena-Bausteine (score_boost/score_debuff) brauchen im Endausbau KEINEN neuen
 * Pfad: sie laufen als TeamPowerRecord-Override durch calculateTeamPowerModifierForSide
 * und applyTeamPowerDebuffs, nur mit groesserem Modifier und eigener Bedingung.
 */

export type SignatureAbilityTiming = "lineup" | "resolve" | "post_matchday";

export type SignatureAbilityEffectKind =
  | "score_boost" // Arena: grosser Self-Boost (bestehender Pfad, groesserer Modifier)
  | "score_debuff" // Arena: grosser Debuff (bestehender Debuff-Pfad)
  | "cash_gain" // Nicht-Arena: Cash aufs Teamkonto
  | "fatigue_attack" // Nicht-Arena: Fatigue auf Spieler eines Zielteams
  | "fatigue_relief" // Nicht-Arena: Fatigue-Abbau im eigenen Team
  | "injury_hex" // Nicht-Arena: erhoeht das Injury-RISIKO des Ziels (keine Garantie-Verletzung)
  | "shield" // Konter: negiert gegnerische Debuffs/Angriffe an einem Spieltag
  | "charge_refresh" // Meta: gibt eine verbrauchte Identity-Power-Ladung zurueck
  | "intel_reveal"; // Info: deckt gegnerische Power-Auswahl auf (kein Score-Effekt)

export type SignatureAbilityCondition =
  | { kind: "none" }
  | { kind: "rank_at_or_below"; rank: number } // Underdog-Bedingung: eigener Rang >= rank
  | { kind: "rival_in_top"; top: number } // Rivale steht Top-N der Disziplin/Tabelle
  | { kind: "after_matchday"; matchdayNumber: number }; // erst ab Spieltag N zuendbar

export type SignatureAbilityDefinition = {
  abilityId: string;
  teamId: string;
  label: string;
  /** Lore-Beschreibung fuer die UI, deutsch. */
  description: string;
  timing: SignatureAbilityTiming;
  effect: SignatureAbilityEffectKind;
  /**
   * Effekt-Parameter, Bedeutung haengt am effect-Kind:
   * - score_boost/score_debuff: Prozent auf den Seitenscore
   * - cash_gain: Cash-Betrag
   * - fatigue_attack/fatigue_relief: Fatigue-Punkte pro betroffenem Spieler
   * - injury_hex: zusaetzliche Risiko-Prozentpunkte beim naechsten Roll
   */
  magnitude: number;
  /** Wieviele Spieler betroffen sind (fatigue_*, injury_hex); 0 = ganzer Kader. */
  targetPlayerLimit: number;
  chargesPerSeason: number;
  condition: SignatureAbilityCondition;
  /**
   * Angriffs-Abilities werden am Spieltag VOR der Wirkung im Ticker angekuendigt
   * ("telegraphiert"), damit das Ziel reagieren kann (z. B. Schildwall, Rotation).
   * Fairness-Regel fuer den Online-Modus, siehe Entwurf Abschnitt Risiken.
   */
  telegraphed: boolean;
};

function roundCash(value: number) {
  return Math.round(value);
}

function clampFatigue(value: number) {
  return Math.max(0, Math.min(100, Number(value.toFixed(2))));
}

/**
 * Nicht-Arena-Effekt "cash_gain": schreibt den Betrag aufs Teamkonto — identische
 * Mechanik wie applySponsorEvents in lib/sponsor/sponsor-event-service.ts
 * (`{ ...team, cash: roundCash(team.cash + delta) }`). Im Endausbau kommt zusaetzlich
 * ein Ledger-Record dazu (analog SponsorEventRecord), damit der Geldfluss im
 * Finanz-Log nachvollziehbar bleibt.
 */
export function applySignatureCashGain(input: {
  gameState: GameState;
  teamId: string;
  amount: number;
}): { gameState: GameState; appliedAmount: number } {
  const amount = roundCash(Math.max(0, input.amount));
  if (amount === 0) {
    return { gameState: input.gameState, appliedAmount: 0 };
  }
  return {
    gameState: {
      ...input.gameState,
      teams: input.gameState.teams.map((team) =>
        team.teamId === input.teamId ? { ...team, cash: roundCash(team.cash + amount) } : team,
      ),
    },
    appliedAmount: amount,
  };
}

/**
 * Nicht-Arena-Effekt "fatigue_attack" / "fatigue_relief": verschiebt Fatigue auf den
 * OVR staerksten Spielern des Zielteams (delta > 0 = Angriff, delta < 0 =
 * Erholung). Schreibt dieselben zwei Stellen wie applyFatigueAndInjuryAfterMatchday:
 * `seasonState.playerAvailabilityState[].fatigue` und `players[].fatigue`, geclampt
 * auf 0..100.
 *
 * Wichtig fuer die Einordnung im Entwurf: Fatigue speist die Injury-Risk-Kurve
 * (fatigueBeforeRoll in rollInjuryRisk) — ein Fatigue-Angriff ist damit automatisch
 * eine INDIREKTE Verletzungsdrohung, ohne dass wir das deterministische
 * Injury-Roll-System anfassen muessen. Anwendungszeitpunkt im Endausbau: nach der
 * Einsatzlisten-Deadline, VOR buildMatchdayInjuryRollMap, damit Preview und Resolve
 * dieselben Rolls sehen.
 */
export function applySignatureFatigueDelta(input: {
  gameState: GameState;
  targetTeamId: string;
  /** Positive Werte ermueden, negative erholen. */
  fatigueDelta: number;
  /** 0 = ganzer aktiver Kader, sonst die N staerksten Spieler (nach OVR/Rating). */
  targetPlayerLimit: number;
}): { gameState: GameState; affectedPlayerIds: string[] } {
  if (input.fatigueDelta === 0) {
    return { gameState: input.gameState, affectedPlayerIds: [] };
  }

  const rosterPlayerIds = new Set(
    input.gameState.rosters
      .filter((roster) => roster.teamId === input.targetTeamId)
      .map((roster) => roster.playerId),
  );
  const targetPlayers = input.gameState.players
    .filter((player) => rosterPlayerIds.has(player.id))
    .sort((left, right) => (right.ovr ?? right.rating ?? 0) - (left.ovr ?? left.rating ?? 0));
  const limited = input.targetPlayerLimit > 0 ? targetPlayers.slice(0, input.targetPlayerLimit) : targetPlayers;
  const affectedIds = new Set(limited.map((player) => player.id));
  if (affectedIds.size === 0) {
    return { gameState: input.gameState, affectedPlayerIds: [] };
  }

  const existingAvailability = input.gameState.seasonState.playerAvailabilityState ?? [];
  const availabilityByPlayerId = new Map(
    existingAvailability
      .filter((entry) => entry.teamId === input.targetTeamId)
      .map((entry) => [entry.playerId, entry] as const),
  );

  const nextPlayers = input.gameState.players.map((player) => {
    if (!affectedIds.has(player.id)) return player;
    const currentFatigue = availabilityByPlayerId.get(player.id)?.fatigue ?? player.fatigue ?? 0;
    return { ...player, fatigue: clampFatigue(currentFatigue + input.fatigueDelta) };
  });

  const touchedExisting = new Set<string>();
  const nextAvailability: PlayerAvailabilityStateRecord[] = existingAvailability.map((entry) => {
    if (entry.teamId !== input.targetTeamId || !affectedIds.has(entry.playerId)) return entry;
    touchedExisting.add(entry.playerId);
    return { ...entry, fatigue: clampFatigue(entry.fatigue + input.fatigueDelta) };
  });
  // Spieler ohne Availability-Record bekommen einen frischen Eintrag, damit
  // getPlayerCurrentFatigue den Wert auch vor dem naechsten Spieltag sieht.
  for (const player of limited) {
    if (touchedExisting.has(player.id)) continue;
    nextAvailability.push({
      playerId: player.id,
      teamId: input.targetTeamId,
      fatigue: clampFatigue((player.fatigue ?? 0) + input.fatigueDelta),
      injuryStatus: "healthy",
    });
  }

  return {
    gameState: {
      ...input.gameState,
      players: nextPlayers,
      seasonState: {
        ...input.gameState.seasonState,
        playerAvailabilityState: nextAvailability,
      },
    },
    affectedPlayerIds: limited.map((player) => player.id),
  };
}
