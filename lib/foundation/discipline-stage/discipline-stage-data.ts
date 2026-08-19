import { getPlayerPortraitBrowserUrl, getTeamLogoBrowserUrl } from "@/lib/data/mediaAssets";
import type { GameState, Player } from "@/lib/data/olyDataTypes";
import { clamp } from "@/lib/foundation/foundation-number-utils";
import { distributePerPlayerFormShares, seededFormJitter } from "@/lib/lineups/legacy-lineup-modifiers";
import { buildLeagueDisciplineRatingsWithAttributeOverrides } from "@/lib/player-formulas/discipline-rating-engine";
import { buildSeasonDisciplinePlayerCountMap } from "@/lib/season/season-discipline-schedule";

/**
 * EIN UNBESCHRIEBENES FORM-FELD IST KEINE SCHLECHTE FORM.
 *
 * GEMELDET VON CHRIS (`qwbnic`, Arena): „S-C soll +18,4 gehabt haben — hat in realitaet aber bei
 * jedem Spieler eine negative Form gehabt! bitte pruefen dass nicht wieder die slots vertauscht
 * wurden."
 *
 * `player.form` wird NIRGENDS geschrieben. Der Generator setzt 0
 * (`lib/player-generator/commit-draft-to-free-agent.ts:209`,
 * `lib/player-import/character-import-service.ts:196`), die Saat traegt 0 in allen 2984 Spielern
 * (`data/generated/oly-player-stats.json`), und in allen sieben Live-Spielstaenden steht das Feld
 * bei 2304 von 2304 Kaderspielern auf exakt 0 — kein einziger Wert daneben, keiner fehlend.
 *
 * Die Buehne las diese 0 als ECHTE Form und rechnete `((0 − 50) / 50) × 8 = −8`. Der neutrale
 * Rueckfall `?? 50` griff nie, weil das Feld ja da ist. Ergebnis am Live-Abbild `hwz8fk`: 192 von
 * 192 Spielern in Basketball und 160 von 160 in Battlefield mit negativem Form-Anteil — kein
 * einziger positiver, in keinem Team. Genau Chris' „bei jedem Spieler".
 *
 * Die „+18,4" daneben ist eine ANDERE Groesse: die Formkarten-Summe aus der Resolve-Vorschau
 * (`lib/foundation/matchday-team-modifiers.ts`). Die ist in Ordnung — am Abbild gemessen folgen
 * ihre Pro-Spieler-Anteile dem Vorzeichen der Karte. Vertauschte Slots waren es also nicht; es
 * standen zwei verschiedene Dinge unter demselben Wort auf einem Bildschirm, und das zweite war
 * aus einem leeren Feld erfunden.
 *
 * `lib/training/player-progression-forecast.ts:377,515` haelt diese Regel laengst
 * (`isFiniteNumber(player.form) && player.form > 0`) — hier fehlte sie.
 */
function formKartenwert(form: number | null | undefined): number {
  if (!Number.isFinite(form) || (form as number) <= 0) {
    return 0;
  }
  return Math.round(((clamp(form as number, 0, 100) - 50) / 50) * 8);
}

// One aufgestellter Spieler in einem Slot einer Disziplin, mit echter
// Netto-Leistung aus dem Save (Disziplin-Wert + echtem Fatigue/Form).
export type DisciplineStageSlot = {
  slotIndex: number;
  playerId: string;
  playerName: string;
  base: number; // player.disciplineRatings[disciplineId]
  fatiguePenalty: number; // aus player.fatigue
  formSwing: number; // aus player.form + kleiner Tagesform-Swing; 0, solange keiner einen Formwert traegt
  net: number; // max(0, base - fatiguePenalty + formSwing)
  portraitUrl: string | null;
  traits: string[]; // player.traitsPositive + traitsNegative (für Trait-Mutatoren)
};

export type DisciplineStageTeam = {
  teamId: string;
  shortCode: string;
  name: string;
  isOwn: boolean;
  logoUrl: string | null;
  slots: DisciplineStageSlot[];
  total: number;
};

export type DisciplineStageModel = {
  disciplineId: string;
  disciplineName: string;
  slotCount: number;
  teams: DisciplineStageTeam[]; // absteigend nach total sortiert = Rang
};

function computeSlot(player: Player, disciplineId: string, slotIndex: number, formSwing: number, rawBase: number): DisciplineStageSlot {
  // Grundwert kann im Save bis zu 2 Nachkommastellen haben — zuerst auf 1
  // Dezimale runden und ALLES daraus ableiten, damit die Anzeige-Identität
  // „Grundwert − Fatigue + Form = Netto" exakt stimmt (keine 0,1-Abweichung).
  const base = Number(rawBase.toFixed(1));
  const fatigue = clamp(player.fatigue ?? 0, 0, 100);
  // Fatigue bremst nach vorne: bis zu 25 % des Werts bei voller Erschöpfung.
  const fatiguePenalty = Math.round(((base * fatigue) / 100) * 0.25);
  // formSwing kommt jetzt vom TEAM (flacher Kartenwert + echter Jitter, s.
  // buildDisciplineStageModel) statt aus der individuellen player.form-Stärke —
  // so ist die Verteilung konsistent zur echten Engine (kein „stärkere Spieler
  // mehr −Form").
  const net = Number(Math.max(0, base - fatiguePenalty + formSwing).toFixed(1));
  const portraitUrl = getPlayerPortraitBrowserUrl(player.id, player.portraitUrl ?? null, player.portraitPath ?? null);
  const traits = [...(player.traitsPositive ?? []), ...(player.traitsNegative ?? [])].map((t) => String(t).trim()).filter(Boolean);
  return {
    slotIndex,
    playerId: player.id,
    playerName: player.name,
    base,
    fatiguePenalty,
    formSwing,
    net,
    portraitUrl,
    traits,
  };
}

export function buildDisciplineStageModel(
  gameState: GameState,
  disciplineId: string,
  ownTeamId: string | null,
): DisciplineStageModel {
  // Defensiv gegen Bootstrap-/Teil-States: im Ladefenster können diese Arrays
  // (noch) fehlen. Dann bauen wir ein leeres Modell statt zu crashen.
  const discipline = (gameState.disciplines ?? []).find((d) => d.id === disciplineId);
  // Anzahl der "gewaehlten" Spieler pro Team im Modell-Fallback (Vorschau ohne Engine-Daten,
  // z.B. bevor der Spieltag laeuft): das muss die fuer DIESE SAISON ausgeloste Kadergroesse
  // sein, nicht `discipline.playerCount`. Der Katalogwert ist nur der Startzustand — der
  // Spielplan wuerfelt die Kadergroesse pro Saison neu (siehe
  // lib/season/season-discipline-schedule.ts) und weicht am Live-Spielstand bei 15 von 20
  // Disziplinen vom Katalog ab. Ohne diesen Vorrang zeigte die Buehne im Modell-Modus die
  // falsche Spielerzahl (z.B. 3 statt der ausgelosten 6 bei Tennis).
  // Genauso defensiv wie oben: `gameState.season`/`gameState.seasonState` koennen im
  // Bootstrap-/Teil-State fehlen, `buildSeasonDisciplinePlayerCountMap` setzt beide voraus.
  const seasonSlotCount =
    gameState.season?.id != null && gameState.seasonState
      ? buildSeasonDisciplinePlayerCountMap(gameState).get(disciplineId)
      : null;
  const slotCount = seasonSlotCount ?? discipline?.playerCount ?? 5;

  // Backfill für Alt-Saves: manche Spieler haben keine disciplineRatings-Einträge für
  // Disziplinen, die erst später in die offizielle Liste kamen (z. B. Showcase) → base
  // fiel auf 0 → die ganze Disziplin zeigte 0 Punkte. Fehlt der Wert, rechnen wir die
  // liga-weiten Ratings EINMAL (lazy) aus den Spieler-Attributen nach (korrekte Skala,
  // gleiche Engine wie die Generierung). Gesunde Saves lösen den Backfill nie aus.
  let backfillTried = false;
  let backfillMap: Map<string, Record<string, number>> | null = null;
  const getBackfill = (): Map<string, Record<string, number>> | null => {
    if (!backfillTried) {
      backfillTried = true;
      try {
        backfillMap = buildLeagueDisciplineRatingsWithAttributeOverrides(gameState.players ?? []);
      } catch {
        backfillMap = null;
      }
    }
    return backfillMap;
  };
  const ratingOf = (player: Player): number => {
    const own = player.disciplineRatings?.[disciplineId];
    if (own != null) return own;
    return getBackfill()?.get(player.id)?.[disciplineId] ?? 0;
  };

  const playersById = new Map<string, Player>();
  for (const player of gameState.players ?? []) {
    playersById.set(player.id, player);
  }

  const rosterByTeam = new Map<string, Player[]>();
  for (const entry of gameState.rosters ?? []) {
    const player = playersById.get(entry.playerId);
    if (!player) {
      continue;
    }
    const arr = rosterByTeam.get(entry.teamId) ?? [];
    arr.push(player);
    rosterByTeam.set(entry.teamId, arr);
  }

  const teams: DisciplineStageTeam[] = (gameState.teams ?? []).map((team) => {
    const roster = rosterByTeam.get(team.teamId) ?? [];
    // Auswahl nach ERWARTETEM Beitrag (Rating − Fatigue + Form) statt Roh-Rating:
    // ein müder Star fällt hinter einen frischen, knapp schwächeren Spieler zurück
    // (sonst verschenkt das Team Punkte). Plus gebundener taktischer Jitter (±5,
    // deterministisch pro Spieler|Disziplin) — die Teams nehmen nicht immer stur die
    // perfekt Besten, aber die Team-Summe bleibt nahe optimal (nur knappe Kandidaten
    // tauschen). Reihenfolge ist ohnehin summenneutral, entscheidend ist die Auswahl.
    const chosen = [...roster]
      .map((p) => {
        const base = Number(ratingOf(p).toFixed(1));
        const fatiguePenalty = Math.round(((base * clamp(p.fatigue ?? 0, 0, 100)) / 100) * 0.25);
        const formEst = formKartenwert(p.form);
        return { p, key: base - fatiguePenalty + formEst + seededFormJitter(`sel|${p.id}|${disciplineId}`, 5) };
      })
      .sort((a, b) => b.key - a.key)
      .slice(0, slotCount)
      .map((s) => s.p);
    // Team-Form FLACH (nicht pro Spieler-Stärke): aus der Durchschnitts-Form des
    // aufgestellten Teams ein Pro-Spieler-Kartenwert (±8), dann per gemeinsamer
    // Funktion additiv mit Jitter (±4) auf die Spieler verteilt — identische Logik
    // wie die echte Engine, damit Modell- und Engine-Pfad gleich aussehen.
    // Nur Spieler MIT Formwert bilden den Durchschnitt. Traegt keiner einen (der Regelfall, s.
    // `formKartenwert`), bleibt der Kartenwert 0 — `distributePerPlayerFormShares` gibt dann fuer
    // alle exakt 0 zurueck (Riegel `flat === 0`), es wird also auch kein Jitter erfunden.
    const mitForm = chosen.filter((p) => Number.isFinite(p.form) && (p.form as number) > 0);
    const flatFormPerPlayer =
      mitForm.length > 0
        ? formKartenwert(mitForm.reduce((sum, p) => sum + clamp(p.form, 0, 100), 0) / mitForm.length)
        : 0;
    const formShares = distributePerPlayerFormShares({
      formModifier: flatFormPerPlayer * chosen.length,
      seeds: chosen.map((p) => `${p.id}|${disciplineId}`),
    });
    const slots = chosen.map((player, idx) => computeSlot(player, disciplineId, idx, formShares[idx] ?? 0, ratingOf(player)));
    const total = slots.reduce((sum, slot) => sum + slot.net, 0);
    return {
      teamId: team.teamId,
      shortCode: team.shortCode,
      name: team.name,
      isOwn: ownTeamId != null && team.teamId === ownTeamId,
      logoUrl: getTeamLogoBrowserUrl(team.teamId, team.logoPath ?? null),
      slots,
      total,
    };
  });

  teams.sort((a, b) => b.total - a.total || a.shortCode.localeCompare(b.shortCode));

  return { disciplineId, disciplineName: discipline?.name ?? disciplineId, slotCount, teams };
}
