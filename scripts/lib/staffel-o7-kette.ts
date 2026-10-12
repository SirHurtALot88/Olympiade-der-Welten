/**
 * STAFFEL O7 "EINGESPIELTE PAARE" — die TS-Haelfte der Ende-zu-Ende-Pruefung fuer
 * scripts/verify-staffel-o7-eingespielte-paare-paket-11-10.mjs.
 *
 * Faehrt eine Folge von Staffel-Spieltagen durch die ECHTEN Produktivfunktionen
 * (`updateStaffelWechselPaareAfterMatchday` = was der Result-Apply nach jedem Spieltag tut,
 * `buildArenaAufstellung` = das Rohr, das der Headless-Lauf dem Motor reicht) und gibt fuer jeden
 * Spieltag die Aufstellung VOR dem Rennen und den Zaehlerstand DANACH aus. Das Verify-Skript
 * speist die Aufstellung dann in den Motor und prueft, dass der Bonus genau an den Paaren wirkt,
 * die hier gezaehlt wurden.
 *
 * Eingabe (stdin, JSON): { heim: string[] (Spielernamen), folge: string[][] (je Spieltag die
 * Staffel-Laeufer in Slot-Reihenfolge, Namen) }. Ausgabe (stdout, JSON): je Spieltag
 * { matchdayId, aufstellung, paare }.
 *
 *   echo '{"heim":[...],"folge":[[...],[...]]}' | npx tsx scripts/lib/staffel-o7-kette.ts
 */
import { readFileSync } from "node:fs";

import type { GameState, LineupDraft } from "@/lib/data/olyDataTypes";
import { buildArenaAufstellung } from "@/lib/foundation/battle-arena/arena-aufstellung-adapter";
import { readStaffelWechselPaare, updateStaffelWechselPaareAfterMatchday } from "@/lib/season/staffel-wechsel-paar-bonus-service";

type Eingabe = { heim: string[]; folge: string[][] };

const eingabe = JSON.parse(readFileSync(0, "utf8")) as Eingabe;
const TEAM = "O7-HEIM";
const SAISON = "season-o7";
const idVon = (name: string) => `spieler-${name.replace(/[^A-Za-z0-9]+/g, "-")}`;

let gs = {
  players: eingabe.heim.map((name) => ({ id: idVon(name), name })),
  // Kaderzeile != Spieler-Id, wie im echten Spielstand (activePlayerId zeigt auf die Zeile).
  rosters: eingabe.heim.map((name) => ({ id: `zeile-${idVon(name)}`, playerId: idVon(name), teamId: TEAM })),
  seasonState: { seasonId: SAISON, schedule: [], standings: {}, lineupDrafts: [] as LineupDraft[] },
} as unknown as GameState;

const ausgabe: { matchdayId: string; aufstellung: ReturnType<typeof buildArenaAufstellung>; paare: Record<string, number> }[] = [];
eingabe.folge.forEach((laeufer, index) => {
  const matchdayId = `${SAISON}-matchday-${index + 1}`;
  const draft: LineupDraft = {
    lineupId: `lineup-${TEAM}-${matchdayId}`,
    saveId: "save-o7",
    seasonId: SAISON,
    matchdayId,
    teamId: TEAM,
    status: "locked",
    entries: laeufer.map((name, slotIndex) => ({
      disciplineId: "staffel",
      disciplineSide: "d2",
      slotIndex,
      playerId: idVon(name),
      activePlayerId: `zeile-${idVon(name)}`,
    })),
    createdAt: "2026-10-11T00:00:00.000Z",
    updatedAt: "2026-10-11T00:00:00.000Z",
  };
  gs = { ...gs, seasonState: { ...gs.seasonState, lineupDrafts: [...(gs.seasonState.lineupDrafts ?? []), draft] } } as GameState;
  // VOR dem Rennen: das Rohr zur Arena, genau wie arena-headless-runner.ts es baut.
  const aufstellung = buildArenaAufstellung(gs, TEAM, matchdayId);
  // NACH dem Rennen: der Result-Apply schreibt den Zaehler fort.
  gs = updateStaffelWechselPaareAfterMatchday(gs, { saveId: "save-o7", seasonId: SAISON, matchdayId, teamIds: [TEAM] });
  const nameVon = new Map(eingabe.heim.map((name) => [idVon(name), name] as const));
  const paare = Object.fromEntries(
    readStaffelWechselPaare(gs).map((record) => [
      `${nameVon.get(record.geberPlayerId)}>${nameVon.get(record.nehmerPlayerId)}`,
      record.gamesTogether,
    ]),
  );
  ausgabe.push({ matchdayId, aufstellung, paare });
});

process.stdout.write(JSON.stringify(ausgabe));
