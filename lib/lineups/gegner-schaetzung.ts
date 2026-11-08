/**
 * GEGNER-AUFSTELLUNG ALS SCHÄTZUNG — Einsatzliste-Revamp, ITERATION 1.
 *
 * Chris 08.11. (Antwort auf die offenen Gegner-Fragen in
 * `docs/design/einsatzliste-revamp-architektur-08-11.md` Abschnitt 4a):
 *   - Die gegnerische Aufstellung wird NIE exakt gezeigt, immer nur geschätzt. Wie genau, hängt
 *     an der Scouting-Qualität — dasselbe Prinzip wie der Nebel über fremdem Potenzial
 *     (`getScoutingUncertainty` in `lib/progression/player-potential-service.ts`, ±16 ungescoutet
 *     bis ±3 voll gescoutet).
 *   - Gegen KI-Teams darf die Schätzung bei guter Scouting-Stufe sehr treffsicher sein (die KI
 *     setzt nach festen Mustern ein), bleibt aber eine Schätzung.
 *   - Gegen menschliche Gegner gibt es auch bei bester Stufe nur eine Prognose der „wahrscheinlich
 *     besten Aufstellung" — berechnet mit derselben optimalen Zuteilung wie das Gold
 *     (`optimaleZuteilung`). Der Mensch darf davon abweichen; das ist gewollt.
 *
 * ZWISCHENSCHRITT (es gibt keine Scouting-Stufe pro GEGNERTEAM im Code, nur pro Spieler):
 *   Die Team-Stufe ist der gerundete Mittelwert von `getEffectiveScoutingLevel` (Scouting-Büro +
 *   Gewissheit je Spieler, 0–5) über den gegnerischen Kader. Jede Slot-Spanne nutzt die Stufe
 *   ihres eigenen Spielers. Keine neue Wirtschaft, keine neuen Spielstand-Felder.
 *
 * Was je Stufe sichtbar ist:
 *   - Stufe 0: Gegner und Disziplin-Schnitt als grobe Spanne, keine Namen, keine Slots.
 *   - Stufe 1–2: Namen und Spannen je Slot, aufgestellt nach der PROGNOSE (optimale Zuteilung des
 *     bekannten Kaders). Den echten KI-Entwurf sieht man hier noch nicht.
 *   - Stufe ≥ 3, KI-Gegner: die Slots kommen aus dem bereits geschriebenen KI-Entwurf
 *     (`ai-batch-prewarm` schreibt ihn vor der eigenen Aufstellung), Werte weiter als Spanne.
 *   - Menschlicher Gegner: nie der Entwurf, immer die Prognose; Treffsicherheit gedeckelt.
 *
 * Die Spannen sind nicht um den wahren Wert zentriert (sonst wäre die Mitte die Wahrheit),
 * sondern um einen festen, je Betrachter/Spieler/Disziplin gestreuten Versatz von höchstens der
 * halben Unschärfe. Der wahre Wert liegt immer in der Spanne.
 *
 * Werte sind `player.disciplineRatings` (die rohe Disziplin-Eignung), NICHT die Slot-Projektion
 * mit Rolle/Intensität, die die eigene Seite zeigt. Die Anzeige sagt das dazu.
 *
 * NUR ANZEIGE. Nichts hier fließt in Resolve, KI-Vorschlag oder Arena.
 */
import type { GameState, LineupDraftEntry } from "@/lib/data/olyDataTypes";
import { getManualControlTeamIds } from "@/lib/foundation/team-control-settings";
import { optimaleZuteilung } from "@/lib/lineups/einsatzliste-anzeige";
import { getScoutingConfidencePct, getScoutingUncertainty } from "@/lib/progression/player-potential-service";
import { getEffectiveScoutingLevel } from "@/lib/scouting/facility-scout-pipeline-service";
import { getOpponentOf } from "@/lib/season/season-fixture-schedule";

export type GegnerSeite = "d1" | "d2";

export type GegnerSlotSchaetzung = {
  slotIndex: number;
  /** null = auf dieser Stufe nicht erkennbar. */
  spielerName: string | null;
  spanne: { min: number; max: number } | null;
};

export type GegnerSeitenSchaetzung = {
  disciplineId: string;
  slots: GegnerSlotSchaetzung[];
  /** Schnitt der Seite als Spanne (bei Stufe 0 das Einzige, was man sieht). */
  schnitt: { min: number; max: number } | null;
};

export type GegnerSchaetzung =
  | { status: "unbekannt"; grund: string }
  | {
      status: "geschaetzt";
      gegnerTeamId: string;
      gegnerName: string;
      gegnerKuerzel: string;
      steuerung: "ki" | "mensch";
      /** Team-Stufe 0–5 (gerundeter Kader-Mittelwert von `getEffectiveScoutingLevel`). */
      stufe: number;
      /** ± in Punkten auf Team-Stufe (Skala von `getScoutingUncertainty`). */
      unschaerfe: number;
      /** Grobe Treffsicherheit der Slot-Zuordnung, nie 100. */
      treffsicherheitPct: number;
      /** Woher die Slot-Zuordnung kommt. */
      quelle: "ki-muster" | "prognose" | "verdeckt";
      seiten: Partial<Record<GegnerSeite, GegnerSeitenSchaetzung>>;
    };

/** Ab dieser Stufe erkennt das Scouting das feste Einsatzmuster der KI (= ihren Entwurf). */
export const GEGNER_STUFE_KI_MUSTER = 3;
/** Ein Mensch kann immer abweichen: Deckel für die Treffsicherheit der Prognose. */
export const GEGNER_MENSCH_TREFFSICHERHEIT_MAX = 60;
/** Selbst voll gescoutete KI bleibt eine Schätzung. */
export const GEGNER_KI_TREFFSICHERHEIT_MAX = 95;

function streuung(schluessel: string): number {
  // FNV-1a, auf [-0.5, 0.5]. Fest je Schlüssel, damit die Spanne zwischen Renders nicht springt.
  let h = 2166136261;
  for (let i = 0; i < schluessel.length; i += 1) {
    h ^= schluessel.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) / 4294967295) - 0.5;
}

export function gegnerSpanne(input: {
  wahr: number;
  stufe: number;
  schluessel: string;
}): { min: number; max: number } {
  const u = getScoutingUncertainty(input.stufe);
  const mitte = input.wahr + streuung(input.schluessel) * u;
  return {
    min: Math.max(0, Math.floor(mitte - u)),
    max: Math.min(100, Math.ceil(mitte + u)),
  };
}

export function schaetzeGegnerAufstellung(input: {
  gameState: GameState | null | undefined;
  eigenesTeamId: string;
  seasonId: string;
  matchdayId: string;
  /** Disziplin und Slotzahl je Seite — dieselben wie auf der eigenen Seite. */
  seiten: Array<{ seite: GegnerSeite; disciplineId: string; slotCount: number }>;
}): GegnerSchaetzung {
  const gameState = input.gameState;
  if (!gameState) return { status: "unbekannt", grund: "Spielstand nicht geladen" };
  const gegnerTeamId = getOpponentOf(gameState, input.eigenesTeamId, input.matchdayId);
  if (!gegnerTeamId) return { status: "unbekannt", grund: "Gegner noch nicht bekannt (kein Spielplan-Eintrag für diesen Spieltag)" };
  const team = gameState.teams.find((entry) => entry.teamId === gegnerTeamId);
  if (!team) return { status: "unbekannt", grund: "Gegner noch nicht bekannt" };

  const steuerung: "ki" | "mensch" = getManualControlTeamIds(gameState).has(gegnerTeamId) ? "mensch" : "ki";
  const playerById = new Map(gameState.players.map((player) => [player.id, player] as const));
  const kader = gameState.rosters
    .filter((entry) => entry.teamId === gegnerTeamId)
    .flatMap((entry) => {
      const player = playerById.get(entry.playerId);
      return player ? [{ activePlayerId: entry.id, player }] : [];
    });
  if (kader.length === 0) return { status: "unbekannt", grund: "Gegnerischer Kader leer" };

  const stufeVon = new Map(
    kader.map(({ player }) => [player.id, getEffectiveScoutingLevel(gameState, input.eigenesTeamId, player.id)] as const),
  );
  const stufe = Math.round([...stufeVon.values()].reduce((sum, value) => sum + value, 0) / kader.length);
  const unschaerfe = getScoutingUncertainty(stufe);
  const roheTreffsicherheit = getScoutingConfidencePct(stufe);
  const treffsicherheitPct =
    steuerung === "mensch"
      ? Math.min(GEGNER_MENSCH_TREFFSICHERHEIT_MAX, Math.round(roheTreffsicherheit * 0.7))
      : Math.min(GEGNER_KI_TREFFSICHERHEIT_MAX, roheTreffsicherheit);

  const kiEntwurf =
    steuerung === "ki" && stufe >= GEGNER_STUFE_KI_MUSTER
      ? (gameState.seasonState.lineupDrafts ?? []).find(
          (draft) => draft.teamId === gegnerTeamId && draft.seasonId === input.seasonId && draft.matchdayId === input.matchdayId,
        ) ?? null
      : null;
  const quelle: "ki-muster" | "prognose" | "verdeckt" = stufe <= 0 ? "verdeckt" : kiEntwurf ? "ki-muster" : "prognose";

  // Prognose: dieselbe optimale Zuteilung wie das Gold, über beide Seiten gemeinsam (ein Spieler
  // spielt höchstens eine Disziplin), Wert = rohe Disziplin-Eignung.
  const prognoseSlots = input.seiten.flatMap(({ seite, slotCount }) =>
    Array.from({ length: slotCount }, (_, index) => `${seite}-${index}`),
  );
  const disciplineBySeite = new Map(input.seiten.map((entry) => [entry.seite, entry.disciplineId] as const));
  const prognose = optimaleZuteilung({
    slotKeys: prognoseSlots,
    slotWerteJeSpieler: kader.map(({ player }) => [
      player.id,
      prognoseSlots.map((slotKey) => {
        const disciplineId = disciplineBySeite.get(slotKey.slice(0, 2) as GegnerSeite) ?? "";
        const wert = player.disciplineRatings?.[disciplineId];
        return { slotKey, projectedScore: typeof wert === "number" && Number.isFinite(wert) ? wert : null };
      }),
    ] as const),
    nameVon: (playerId) => playerById.get(playerId)?.name ?? playerId,
  });

  const entwurfJeSlot = new Map<string, LineupDraftEntry>();
  for (const entry of kiEntwurf?.entries ?? []) entwurfJeSlot.set(`${entry.disciplineSide}-${entry.slotIndex}`, entry);

  const seiten: Partial<Record<GegnerSeite, GegnerSeitenSchaetzung>> = {};
  for (const { seite, disciplineId, slotCount } of input.seiten) {
    const werte: number[] = [];
    const slots: GegnerSlotSchaetzung[] = [];
    for (let slotIndex = 0; slotIndex < slotCount; slotIndex += 1) {
      const slotKey = `${seite}-${slotIndex}`;
      const playerId = kiEntwurf ? entwurfJeSlot.get(slotKey)?.playerId ?? null : prognose.jeSlot.get(slotKey)?.id ?? null;
      const player = playerId ? playerById.get(playerId) ?? null : null;
      const wahr = player?.disciplineRatings?.[disciplineId];
      if (!player || typeof wahr !== "number" || !Number.isFinite(wahr)) {
        slots.push({ slotIndex, spielerName: null, spanne: null });
        continue;
      }
      werte.push(wahr);
      slots.push({
        slotIndex,
        spielerName: quelle === "verdeckt" ? null : player.name,
        spanne:
          quelle === "verdeckt"
            ? null
            : gegnerSpanne({
                wahr,
                stufe: stufeVon.get(player.id) ?? stufe,
                schluessel: `${input.eigenesTeamId}|${player.id}|${disciplineId}`,
              }),
      });
    }
    const schnitt =
      werte.length > 0
        ? gegnerSpanne({
            wahr: werte.reduce((sum, value) => sum + value, 0) / werte.length,
            stufe,
            schluessel: `${input.eigenesTeamId}|${gegnerTeamId}|${disciplineId}|schnitt`,
          })
        : null;
    seiten[seite] = { disciplineId, slots, schnitt };
  }

  return {
    status: "geschaetzt",
    gegnerTeamId,
    gegnerName: team.name,
    gegnerKuerzel: team.shortCode,
    steuerung,
    stufe,
    unschaerfe,
    treffsicherheitPct,
    quelle,
    seiten,
  };
}
