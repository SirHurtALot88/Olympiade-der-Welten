/**
 * Office 21.11 (Vorstand und Ziele): die neuen Zielarten und die Widerspruchspruefung.
 *
 * Entscheidungen Chris 21.11. (docs/design/office-vorstand-21-11.md, Abschnitt "Entscheidungen Chris 21.11."):
 *  - Ziele haben eine eigene LAUFZEIT (mehrere Saisons) UND es gibt ein Ziel zu den Vertragslaufzeiten des Kaders.
 *  - Lieblingsspieler des Vorstands = bester Spieler nach PP der Vorsaison (Saison 1: nach aktueller PP),
 *    fest fuer eine Saison. Verkauf -1,0 Vertrauen, Verlaengerung +0,3. Die Vertrauensaenderung laeuft wie bei jedem
 *    Vorstandsziel ueber `boardConfidenceDelta` und damit ueber die bestehende Vertrauens-Buchung.
 *  - Widersprueche zwischen Zielen werden bei der Vergabe geprueft (`widerspruchZwischen`).
 *  - KEINE Geldstrafen: die Ziele hier tragen nie `penaltyCash`.
 *
 * Reine Funktionen auf dem GameState; kein Import aus `team-season-objectives-service.ts` (der Service importiert diese Datei).
 */

import { endSaisonNummer } from "@/lib/contracts/vertragslaufzeit";
import type { GameState, TeamSeasonObjectiveRecord, TeamSeasonObjectiveStatus } from "@/lib/data/olyDataTypes";
import { lesVorstandGespraech } from "@/lib/finance/vorstand-gespraech-zustand";

/** Strukturgleich zu `ObjectiveDraft` im Service. */
export type ZielEntwurf = {
  objectiveId: string;
  category: TeamSeasonObjectiveRecord["category"];
  label: string;
  detail?: string | null;
  actionHint?: string | null;
  targetValue: number | string | boolean | null;
  currentValue: number | string | boolean | null;
  status: TeamSeasonObjectiveStatus;
  rewardCash?: number;
  penaltyCash?: number;
  boardConfidenceDelta?: number;
  source?: string;
  rankTarget?: boolean;
  optional?: boolean;
  provisional?: boolean;
  laufzeit?: { vonSaisonNr: number; bisSaisonNr: number };
  ersetzt?: { label: string; weil: string };
};

export const LIEBLING_ZIEL_ID = "board-lieblingsspieler";
export const VERTRAGSLAUFZEIT_ZIEL_ID = "board-vertragslaufzeiten";
export const GESPRAECH_ZIEL_HOCH_ID = "vorstand-gespraech-zielhoch";
export const GESPRAECH_BINDEN_ID = "vorstand-gespraech-binden";
export const GESPRAECH_VERTRAUEN_ID = "vorstand-gespraech-vertrauen";

/** Verkauf des Lieblingsspielers kostet, eine Verlaengerung bringt Vertrauen (Chris 21.11.). */
export const LIEBLING_VERKAUF_VERTRAUEN = -1.0;
export const LIEBLING_VERLAENGERUNG_VERTRAUEN = 0.3;
/** Kosten der Zusage „Vertrauen einsetzen" (negativ), gebucht bei der naechsten Festlegung. */
export const VERTRAUEN_ZUSAGE_KOSTEN = -0.25;
/** Hoechstens so viel Anteil der Vertraege darf in derselben Saison enden. */
export const VERTRAGSLAUFZEIT_MAX_ANTEIL = 0.3;
/** Das Vertragslaufzeit-Ziel gilt zwei Saisons. */
export const VERTRAGSLAUFZEIT_SAISONEN = 2;

export function saisonNr(gameState: GameState): number | null {
  const fromId = /season-(\d+)/i.exec(gameState.season.id)?.[1];
  const fromName = /season\s+(\d+)/i.exec(gameState.season.name)?.[1];
  const parsed = Number(fromId ?? fromName);
  return Number.isFinite(parsed) ? parsed : null;
}

function verbleibendeSpieltage(gameState: GameState): number {
  const gespielt = new Set(
    (gameState.seasonState.matchdayResults ?? [])
      .filter((e) => e.seasonId === gameState.season.id)
      .map((e) => e.matchdayId)
      .filter(Boolean),
  );
  return Math.max(0, (gameState.season.matchdayIds?.length ?? 0) - gespielt.size);
}

/* ============================================================== Lieblingsspieler */

export type LieblingErgebnis = {
  playerId: string;
  playerName: string;
  /** PP (Vorsaison) bzw. Summe der Beitraege (Saison 1), nach denen gewaehlt wurde. */
  pp: number;
  quelle: "vorsaison" | "aktuell";
};

/** PP der Vorsaison je Spieler aus dem letzten Saison-Schnappschuss (nicht der laufenden Saison). */
function vorsaisonPp(gameState: GameState): Map<string, number> | null {
  const snaps = (gameState.seasonState.seasonSnapshots ?? []).filter((s) => s.seasonId !== gameState.season.id);
  if (snaps.length === 0) return null;
  const letzte = snaps[snaps.length - 1]!;
  const zeilen = letzte.playerPerformances ?? letzte.playerPerformanceSnapshots ?? [];
  if (zeilen.length === 0) return null;
  const map = new Map<string, number>();
  for (const z of zeilen) {
    const wert = z.pps ?? z.totalPoints ?? z.totalContribution ?? null;
    if (wert != null && Number.isFinite(wert)) map.set(z.playerId, wert);
  }
  return map.size > 0 ? map : null;
}

function aktuellePp(gameState: GameState): Map<string, number> {
  const ids = new Set(
    (gameState.seasonState.matchdayResults ?? []).filter((e) => e.seasonId === gameState.season.id).map((e) => e.id),
  );
  const map = new Map<string, number>();
  for (const e of gameState.seasonState.playerDisciplinePerformances ?? []) {
    // Ohne Ergebnisse dieser Saison ist die Menge leer: nicht auf alle Saisons ausweichen (sonst zaehlte die PP der Vorjahre).
    if (!ids.has(e.matchdayResultId)) continue;
    map.set(e.playerId, (map.get(e.playerId) ?? 0) + (e.scoreContribution ?? 0));
  }
  return map;
}

/**
 * Der Lieblingsspieler des Vorstands: bester Spieler im eigenen Kader nach PP der Vorsaison, in Saison 1 nach der
 * aktuellen PP. Gleichstand: hoeherer Marktwert, dann Name. Ohne jede PP (Saisonstart) gibt es keinen.
 */
export function ermittleLieblingsspieler(gameState: GameState, teamId: string): LieblingErgebnis | null {
  const kader = gameState.rosters.filter((r) => r.teamId === teamId).map((r) => r.playerId);
  if (kader.length === 0) return null;
  const byId = new Map((gameState.players ?? []).map((p) => [p.id, p] as const));
  const vor = vorsaisonPp(gameState);
  const pp = vor ?? aktuellePp(gameState);
  const quelle: LieblingErgebnis["quelle"] = vor ? "vorsaison" : "aktuell";
  let best: LieblingErgebnis | null = null;
  let bestMarkt = 0;
  for (const id of kader) {
    const wert = pp.get(id);
    if (wert == null || !(wert > 0)) continue;
    const spieler = byId.get(id);
    const markt = spieler?.marketValue ?? spieler?.displayMarketValue ?? 0;
    const name = spieler?.name ?? id;
    if (!best || wert > best.pp + 1e-9 || (Math.abs(wert - best.pp) <= 1e-9 && (markt > bestMarkt || (markt === bestMarkt && name < best.playerName)))) {
      best = { playerId: id, playerName: name, pp: Math.round(wert * 100) / 100, quelle };
      bestMarkt = markt;
    }
  }
  return best;
}

/** Die gespeicherte Wahl dieser Saison (das Ziel traegt die Spieler-Id in `targetValue`) oder die frische Ermittlung. */
export function lieblingFuerSaison(gameState: GameState, teamId: string): LieblingErgebnis | null {
  const gespeichert = (gameState.seasonState.teamSeasonObjectives ?? []).find(
    (o) => o.seasonId === gameState.season.id && o.teamId === teamId && o.objectiveId === LIEBLING_ZIEL_ID,
  );
  if (gespeichert && typeof gespeichert.targetValue === "string") {
    const spieler = (gameState.players ?? []).find((p) => p.id === gespeichert.targetValue);
    const m = /PP\s+([\d.,]+)/.exec(gespeichert.detail ?? "");
    const pp = m ? Number(m[1]!.replace(",", ".")) : 0;
    return {
      playerId: gespeichert.targetValue,
      playerName: spieler?.name ?? gespeichert.targetValue,
      pp: Number.isFinite(pp) ? pp : 0,
      quelle: /Vorsaison/.test(gespeichert.detail ?? "") ? "vorsaison" : "aktuell",
    };
  }
  return ermittleLieblingsspieler(gameState, teamId);
}

export function verlaengertDieseSaison(gameState: GameState, teamId: string, playerId: string): boolean {
  return (gameState.seasonState.contractEvents ?? []).some(
    (e) => e.seasonId === gameState.season.id && e.teamId === teamId && e.playerId === playerId && e.eventType === "contract_renewed",
  );
}

/** Hat dieses Team einen Menschen am Steuer? Die neuen Zielarten wirken bis zur Messung mit 32 KI-Teams nur dort. */
function istMensch(gameState: GameState, teamId: string): boolean {
  return Boolean(gameState.teams.find((t) => t.teamId === teamId)?.humanControlled);
}

export function baueLieblingsspielerZiel(gameState: GameState, teamId: string): ZielEntwurf | null {
  // KI-Teams: bis zu einer Messung mit 32 KI-Teams (Chris 21.11.) gibt es das Ziel dort gar nicht. Ein Ziel mit Delta 0 wuerde
  // trotzdem als verfehlt/gefaehrdet zaehlen (Druck, GM-Entlassung, KI-Panik); deshalb ist es fuer die KI schlicht nicht vorhanden.
  if (!istMensch(gameState, teamId)) return null;
  const liebling = lieblingFuerSaison(gameState, teamId);
  if (!liebling) return null;
  const imKader = gameState.rosters.some((r) => r.teamId === teamId && r.playerId === liebling.playerId);
  const freigegeben = lesVorstandGespraech(gameState, teamId).lieblingFreigegeben;
  const verlaengert = imKader && verlaengertDieseSaison(gameState, teamId, liebling.playerId);
  const nr = saisonNr(gameState) ?? 1;
  let status: TeamSeasonObjectiveStatus;
  let delta: number;
  if (!imKader) {
    status = freigegeben ? "completed" : "failed";
    delta = freigegeben ? 0 : LIEBLING_VERKAUF_VERTRAUEN;
  } else if (verlaengert) {
    status = "completed";
    // Hat der Mensch die Verlaengerung im Gespraech zugesagt, zahlt die Zusage die +0,3: dieselbe Verlaengerung zaehlt nur einmal.
    const zugesagt = lesVorstandGespraech(gameState, teamId).zusagen.some((x) => x.art === "binden" && x.playerId === liebling.playerId);
    delta = zugesagt ? 0 : LIEBLING_VERLAENGERUNG_VERTRAUEN;
  } else {
    status = "open";
    delta = 0;
  }
  return {
    objectiveId: LIEBLING_ZIEL_ID,
    category: "player",
    label: `Lieblingsspieler ${liebling.playerName} halten`,
    detail: `Der Vorstand hängt an ${liebling.playerName} (${liebling.quelle === "vorsaison" ? "bester Spieler der Vorsaison" : "bester Spieler dieser Saison"}, PP ${liebling.pp.toFixed(1).replace(".", ",")}). Verkauf: ${String(LIEBLING_VERKAUF_VERTRAUEN).replace(".", ",")} Vertrauen, Verlängerung: +${String(LIEBLING_VERLAENGERUNG_VERTRAUEN).replace(".", ",")}. Kein Geldabzug.`,
    actionHint: freigegeben ? "Der Vorstand hat den Verkauf freigegeben." : "Verkaufen kostet Vertrauen, verlängern bringt welches.",
    // Die Spieler-Id steht im Ziel: so bleibt die Wahl fuer die Saison fest, ohne eigenen Speicher.
    targetValue: liebling.playerId,
    currentValue: !imKader ? (freigegeben ? "freigegeben" : "verkauft") : verlaengert ? "verlängert" : "im Kader",
    status,
    boardConfidenceDelta: delta,
    source: "vorstand_lieblingsspieler",
    laufzeit: { vonSaisonNr: nr, bisSaisonNr: nr },
  };
}

/* ============================================================== Vertragslaufzeiten */

export function zaehleVertraegeProEndsaison(gameState: GameState, teamId: string): Map<number, number> {
  const zaehler = new Map<number, number>();
  for (const r of gameState.rosters) {
    if (r.teamId !== teamId) continue;
    const ende = endSaisonNummer(r, gameState);
    if (ende == null) continue;
    zaehler.set(ende, (zaehler.get(ende) ?? 0) + 1);
  }
  return zaehler;
}

/** Erlaubte Zahl gleichzeitig endender Vertraege: 30 % des Kaders, mindestens 3. */
export function vertragslaufzeitGrenze(kaderGroesse: number): number {
  return Math.max(3, Math.ceil(kaderGroesse * VERTRAGSLAUFZEIT_MAX_ANTEIL));
}

export function baueVertragslaufzeitZiel(gameState: GameState, teamId: string): ZielEntwurf | null {
  // KI-Teams: siehe `baueLieblingsspielerZiel` (neutral bis zur Messung, also gar nicht vorhanden).
  if (!istMensch(gameState, teamId)) return null;
  const nr = saisonNr(gameState);
  if (nr == null || nr < 2) return null;
  const kader = gameState.rosters.filter((r) => r.teamId === teamId).length;
  if (kader < 4) return null;
  const grenze = vertragslaufzeitGrenze(kader);
  const proEnde = zaehleVertraegeProEndsaison(gameState, teamId);
  // Betrachtet werden die Enden der kommenden zwei Saisons: die Vertraege, die jetzt auslaufen, sind die Verlaengerungs-
  // Entscheidung selbst. Das Ziel misst, ob die Enden danach gestreut sind.
  const horizont = [nr + 1, nr + 2];
  let hoechst = 0;
  let hoechstSaison = nr + 1;
  for (const s of horizont) {
    const n = proEnde.get(s) ?? 0;
    if (n > hoechst) {
      hoechst = n;
      hoechstSaison = s;
    }
  }
  const ueber = hoechst > grenze;
  const aus = verbleibendeSpieltage(gameState) === 0;
  const status: TeamSeasonObjectiveStatus = !ueber ? "completed" : aus ? "failed" : "at_risk";
  // Laufzeit: in der Saison, in der das Ziel erstmals vergeben wurde, plus die naechste.
  const gespeichert = (gameState.seasonState.teamSeasonObjectives ?? []).find(
    (o) => o.teamId === teamId && o.objectiveId === VERTRAGSLAUFZEIT_ZIEL_ID && o.laufzeit && o.laufzeit.bisSaisonNr >= nr,
  );
  const laufzeit = gespeichert?.laufzeit ?? { vonSaisonNr: nr, bisSaisonNr: nr + VERTRAGSLAUFZEIT_SAISONEN - 1 };
  return {
    objectiveId: VERTRAGSLAUFZEIT_ZIEL_ID,
    category: "roster",
    label: `Vertragslaufzeiten: höchstens ${grenze} von ${kader} enden zugleich`,
    detail: `Am dichtesten liegt Saison ${hoechstSaison} mit ${hoechst} auslaufenden Verträgen. Wer die Enden streut, vermeidet ein Saisonende mit halbem Kader. Kein Geldabzug.`,
    actionHint: ueber ? "Verträge unterschiedlich lang verlängern, nicht alle auf dieselbe Endsaison." : null,
    targetValue: grenze,
    currentValue: hoechst,
    status,
    rewardCash: status === "completed" ? 2 : undefined,
    boardConfidenceDelta: status === "completed" ? 0.3 : status === "failed" ? -0.4 : 0,
    source: "vorstand_vertragslaufzeiten",
    laufzeit,
  };
}

/* ============================================================== Gespraech-Zusagen als Ziele */

export function baueGespraechZusageZiele(gameState: GameState, teamId: string, rangAktuell: number | null): ZielEntwurf[] {
  const z = lesVorstandGespraech(gameState, teamId);
  const nr = saisonNr(gameState) ?? 1;
  const ziele: ZielEntwurf[] = [];
  for (const zusage of z.zusagen) {
    if (zusage.art === "zielhoch" && zusage.zielRang != null) {
      const geschafft = rangAktuell != null && rangAktuell <= zusage.zielRang;
      const aus = verbleibendeSpieltage(gameState) === 0;
      const status: TeamSeasonObjectiveStatus = rangAktuell == null ? "open" : geschafft ? "completed" : aus ? "failed" : "open";
      ziele.push({
        objectiveId: GESPRAECH_ZIEL_HOCH_ID,
        category: "sport",
        label: `Zusage an den Vorstand: Top ${zusage.zielRang}`,
        detail: "Im Gespräch zugesagt: ein höheres Saisonziel. Verfehlt kostet es 0,5 Vertrauen, erreicht bringt es wie jedes erfüllte Ziel Vertrauen. Kein Geldabzug.",
        targetValue: `Top ${zusage.zielRang}`,
        currentValue: rangAktuell ?? "offen",
        status,
        boardConfidenceDelta: status === "completed" ? 0.5 : status === "failed" ? -0.5 : 0,
        source: "vorstand_gespraech_zusage",
        laufzeit: { vonSaisonNr: nr, bisSaisonNr: nr },
      });
    }
    if (zusage.art === "vertrauen") {
      ziele.push({
        objectiveId: GESPRAECH_VERTRAUEN_ID,
        category: "finance",
        label: "Zusage an den Vorstand: Vertrauen eingesetzt",
        detail: "Im Gespräch zugesagt: 0,25 Vertrauen wurden eingesetzt. Die Buchung folgt wie jede Vertrauensänderung bei der nächsten Festlegung.",
        targetValue: "eingesetzt",
        currentValue: "eingesetzt",
        // Eine Zusage ist nie ein verfehltes oder gefaehrdetes Ziel: Status „offen" (kein Druck, keine Inbox-Meldung). Das Vertrauen
        // wird erst bei der naechsten Festlegung gebucht (Abrechnung, `buildTeamSeasonObjectiveSettlement`); bis dahin zaehlt der
        // Wert ohne die Kosten (`calculateBoardConfidence` laesst dieses Ziel in der laufenden Summe aus).
        status: "open",
        boardConfidenceDelta: VERTRAUEN_ZUSAGE_KOSTEN,
        source: "vorstand_gespraech_zusage",
        laufzeit: { vonSaisonNr: nr, bisSaisonNr: nr },
      });
    }
    if (zusage.art === "binden" && zusage.playerId) {
      const imKader = gameState.rosters.some((r) => r.teamId === teamId && r.playerId === zusage.playerId);
      const verlaengert = verlaengertDieseSaison(gameState, teamId, zusage.playerId);
      const name = (gameState.players ?? []).find((p) => p.id === zusage.playerId)?.name ?? "Lieblingsspieler";
      const aus = verbleibendeSpieltage(gameState) === 0;
      const status: TeamSeasonObjectiveStatus = verlaengert ? "completed" : !imKader || aus ? "failed" : "open";
      ziele.push({
        objectiveId: GESPRAECH_BINDEN_ID,
        category: "player",
        label: `Zusage an den Vorstand: ${name} verlängern`,
        detail: "Im Gespräch zugesagt: den Lieblingsspieler an den Verein zu binden. Nicht verlängert bis Saisonende kostet 0,5 Vertrauen.",
        targetValue: "verlängert",
        currentValue: verlaengert ? "verlängert" : imKader ? "im Kader" : "weg",
        status,
        boardConfidenceDelta: status === "completed" ? 0.3 : status === "failed" ? -0.5 : 0,
        source: "vorstand_gespraech_zusage",
        laufzeit: { vonSaisonNr: nr, bisSaisonNr: nr },
      });
    }
  }
  return ziele;
}

/* ============================================================== Widerspruchspruefung */

export type ZielBereich = "sport" | "finanzen" | "kader" | "kabine";

export function bereichDesZiels(z: Pick<ZielEntwurf, "objectiveId" | "category">): ZielBereich {
  switch (z.category) {
    case "sport":
    case "player":
      return "sport";
    case "finance":
    case "transfer":
    case "sponsor":
      return "finanzen";
    case "morale":
      return "kabine";
    default:
      return "kader";
  }
}

export type ZielKontext = {
  /** Kader ist kleiner als Soll-Groesse: Sparziele und Aufbau-Ziele schliessen sich dann aus. */
  kaderUnterSoll?: boolean;
};

/** Ziele, die Transferausgaben deckeln. */
const SPAR_ZIELE = new Set(["finance-transfer-ceiling", "finance-net-transfer-balance"]);
const SPORT_RANG_ZIELE = (id: string) => id === "expectation-rank" || id.startsWith("sport-rank-");
const AUSGABEN_ZIELE = (id: string) => id.startsWith("facility-") || id === "development-xp-spend";

/**
 * Verlangt Ziel A, was Ziel B verbietet? Gibt den Grund zurueck oder null. Symmetrisch.
 * Die Regeln sind bewusst wenige und lesbar; jede steht auch in der Erklaerung im Office.
 */
export function widerspruchZwischen(a: ZielEntwurf, b: ZielEntwurf, kontext: ZielKontext = {}): string | null {
  const pruefe = (x: ZielEntwurf, y: ZielEntwurf): string | null => {
    if (SPAR_ZIELE.has(x.objectiveId) && SPORT_RANG_ZIELE(y.objectiveId) && kontext.kaderUnterSoll) {
      return `„${x.label}“ verbietet Ausgaben, „${y.label}“ verlangt einen stärkeren Kader, und der ist noch unter Soll-Größe.`;
    }
    if (x.objectiveId === "finance-rebuild-cash-buffer" && AUSGABEN_ZIELE(y.objectiveId)) {
      return `„${x.label}“ will die Kasse füllen, „${y.label}“ kostet Geld.`;
    }
    if (x.objectiveId === "finance-transfer-ceiling" && AUSGABEN_ZIELE(y.objectiveId)) {
      return `„${x.label}“ deckelt die Ausgaben, „${y.label}“ kostet Geld.`;
    }
    if (x.objectiveId === "finance-salary-ratio" && y.objectiveId === GESPRAECH_BINDEN_ID) {
      return `„${x.label}“ drückt das Gehalt, „${y.label}“ treibt es hoch.`;
    }
    return null;
  };
  return pruefe(a, b) ?? pruefe(b, a);
}

export type WiderspruchsErgebnis = {
  ok: boolean;
  /** Geprueft wurden `paare` Paare. */
  paare: number;
  konflikte: Array<{ a: string; b: string; weil: string }>;
};

/** Prueft einen fertigen Satz Ziele auf Widersprueche (Anzeige und Tests). */
export function pruefeZielSatz(ziele: ZielEntwurf[], kontext: ZielKontext = {}): WiderspruchsErgebnis {
  const konflikte: WiderspruchsErgebnis["konflikte"] = [];
  let paare = 0;
  for (let i = 0; i < ziele.length; i += 1) {
    for (let j = i + 1; j < ziele.length; j += 1) {
      paare += 1;
      const weil = widerspruchZwischen(ziele[i]!, ziele[j]!, kontext);
      if (weil) konflikte.push({ a: ziele[i]!.objectiveId, b: ziele[j]!.objectiveId, weil });
    }
  }
  return { ok: konflikte.length === 0, paare, konflikte };
}

/** Kann `kandidat` zu den bereits vergebenen Zielen? Gibt den ersten Konfliktgrund zurueck. */
export function ersterWiderspruch(vergeben: ZielEntwurf[], kandidat: ZielEntwurf, kontext: ZielKontext = {}): string | null {
  for (const v of vergeben) {
    const weil = widerspruchZwischen(v, kandidat, kontext);
    if (weil) return weil;
  }
  return null;
}

/** Ist der Kader unter Soll-Groesse? (Spieler im Kader < `playerOpt` bzw. Pflichtkader 8.) */
export function kaderUnterSoll(gameState: GameState, teamId: string): boolean {
  const identity = gameState.teamIdentities?.find((i) => i.teamId === teamId);
  const soll = Math.max(8, identity?.playerOpt ?? identity?.playerMin ?? 8);
  return gameState.rosters.filter((r) => r.teamId === teamId).length < soll;
}
