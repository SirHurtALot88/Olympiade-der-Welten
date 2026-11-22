/**
 * KURS EINES VORSTANDSZIELS: auf Kurs / gefährdet / verfehlt — nur Anzeige (Review 22.11., Befund 3.9).
 *
 * Problem: der gespeicherte Status (`TeamSeasonObjectiveStatus`) vergleicht den Ist-Stand mit dem
 * Zielwert, als wäre die Saison schon vorbei. Ein Rangziel nach Spieltag 7 steht dann auf "failed",
 * obwohl es noch zwölf Spieltage lang erreichbar ist; Startseite, Postfach und Office meldeten früh
 * "verfehlt". Ein Ziel, das nach einem Drittel der Saison endgültig verloren wirkt, motiviert nicht.
 *
 * Regel (Chris, 22.11., Top-5 der Review): mitten in der Saison rechnet diese Funktion zum Saisonende
 * hoch (Ist-Stand + noch offene Spieltage) und sagt "verfehlt" erst, wenn das Ziel rechnerisch nicht
 * mehr erreichbar ist. Bis dahin ist ein Ziel "auf Kurs" (jetzt erfüllt oder offen) oder "gefährdet".
 *
 * DIE AUSWERTUNG AM SAISONENDE BLEIBT UNVERÄNDERT. Diese Datei schreibt nichts, ändert keinen Status
 * im Spielstand und nichts an Vertrauen, Druck oder Abrechnung — sie übersetzt nur für die Anzeige.
 * Am Saisonende (keine Spieltage mehr offen) gilt der gespeicherte Status 1:1.
 *
 * Wann ist ein Ziel mitten in der Saison wirklich verloren?
 *  - Rangziele nach Tabellenpunkten (`expectation-rank`, `sport-rank-N`): wenn selbst bei allen noch
 *    möglichen Punkten (Duell: 4 je Spieltag) zu viele Teams strikt davor bleiben
 *    (`bestReachableRank`). Gleichstand zählt als offen.
 *  - Zähler, die nur wachsen (Signatursiege, Medaillen) und Obergrenzen für Zähler (Außenseiter-
 *    Niederlagen): deren Status prüft die Erreichbarkeit schon selbst (`current + remaining < target`),
 *    ein "failed" ist dort ein Beweis.
 *  - Zusagen und Vorstandsgespräche (`vorstand-*`, `board-*`): entscheiden ihren Status selbst.
 *  Alles andere (Kasse, Gehaltsquote, Moral, Ränge nach Marktwert o. ä.) kann sich bis zum Saisonende
 *  noch drehen: höchstens "gefährdet".
 */
import type { GameState, TeamSeasonObjectiveRecord } from "@/lib/data/olyDataTypes";
import { getRemainingMatchdays } from "@/lib/board/team-season-objectives-service";
import { isBattleModeSave } from "@/lib/season/game-mode";
import { ligaVonAusSpielstand } from "@/lib/season/liga-raenge";
import { bestReachableRank, maxPointsPerMatchdayFor } from "@/lib/season/title-race";

export type ZielKurs = "erreicht" | "auf-kurs" | "gefaehrdet" | "verfehlt";

export type ZielKursInfo = {
  kurs: ZielKurs;
  /** Kurzer Text für Chip/Zeile. */
  label: string;
  /** Ein Satz, warum (für Tooltip und Kleinzeile). */
  begruendung: string;
  /** Noch offene Spieltage, mit denen gerechnet wurde. */
  verbleibendeSpieltage: number;
};

export const ZIEL_KURS_LABEL: Record<ZielKurs, string> = {
  erreicht: "Erfüllt",
  "auf-kurs": "Auf Kurs",
  gefaehrdet: "Gefährdet",
  verfehlt: "Verfehlt",
};

/** Zähler, die nur wachsen: "jetzt erfüllt" bleibt erfüllt. */
function istMonotonErreichbar(objectiveId: string): boolean {
  return (
    objectiveId === "sport-signature-wins" ||
    objectiveId === "sport-matchday-medals" ||
    objectiveId === "development-xp-spend" ||
    objectiveId.startsWith("facility-") ||
    objectiveId.startsWith("vorstand-") ||
    objectiveId.startsWith("board-")
  );
}

/** Status ist hier schon ein Beweis (Zähler/Obergrenze mit eigener Erreichbarkeitsprüfung, Zusagen). */
function statusIstBeweis(objectiveId: string): boolean {
  return (
    objectiveId === "sport-signature-wins" ||
    objectiveId === "sport-matchday-medals" ||
    objectiveId === "sport-upset-avoidance" ||
    objectiveId.startsWith("vorstand-") ||
    objectiveId.startsWith("board-")
  );
}

/** Zielrang eines Rangziels nach Tabellenpunkten, sonst `null`. */
function punkteRangZiel(objective: TeamSeasonObjectiveRecord): number | null {
  if (objective.objectiveId === "expectation-rank") {
    const m = /(\d+)/.exec(String(objective.targetValue ?? ""));
    return m ? Number(m[1]) : null;
  }
  const m = /^sport-rank-(\d+)$/.exec(objective.objectiveId);
  return m ? Number(m[1]) : null;
}

function punkteListe(gameState: GameState) {
  const ligaVon = ligaVonAusSpielstand(gameState);
  const standings = gameState.seasonState?.standings ?? {};
  return gameState.teams.map((team) => ({
    teamId: team.teamId,
    points: typeof standings[team.teamId]?.points === "number" ? standings[team.teamId].points : null,
    liga: ligaVon ? ligaVon(team.teamId) : null,
  }));
}

export function berechneZielKurs(gameState: GameState, objective: TeamSeasonObjectiveRecord): ZielKursInfo {
  const rest = getRemainingMatchdays(gameState);
  const roh = objective.status;
  const info = (kurs: ZielKurs, begruendung: string): ZielKursInfo => ({
    kurs,
    label: ZIEL_KURS_LABEL[kurs],
    begruendung,
    verbleibendeSpieltage: rest,
  });

  // Saisonende: der gespeicherte Status gilt.
  if (rest <= 0) {
    if (roh === "completed") return info("erreicht", "Am Saisonende erfüllt.");
    if (roh === "failed") return info("verfehlt", "Am Saisonende nicht erreicht.");
    if (roh === "at_risk") return info("gefaehrdet", "Am Saisonende knapp unter dem Ziel.");
    return info("auf-kurs", "Noch keine Auswertung.");
  }

  const offen = rest === 1 ? "noch 1 Spieltag" : `noch ${rest} Spieltage`;
  const letzte = rest === 1 ? "des letzten Spieltags" : `der letzten ${rest} Spieltage`;

  if (roh === "completed") {
    return istMonotonErreichbar(objective.objectiveId)
      ? info("erreicht", "Ziel schon erfüllt.")
      : info("auf-kurs", `Jetzt erfüllt, bis zum Saisonende ${offen}.`);
  }
  if (roh === "open") return info("auf-kurs", `Noch offen, bis zum Saisonende ${offen}.`);
  if (roh === "at_risk") return info("gefaehrdet", `Knapp unter dem Ziel, ${offen} zum Aufholen.`);

  // roh === "failed": nur mit Beweis "verfehlt".
  if (statusIstBeweis(objective.objectiveId)) {
    return info("verfehlt", "Rechnerisch nicht mehr erreichbar.");
  }
  const zielRang = punkteRangZiel(objective);
  if (zielRang != null) {
    const beste = bestReachableRank(
      objective.teamId,
      punkteListe(gameState),
      { maxPointsPerMatchday: maxPointsPerMatchdayFor(isBattleModeSave(gameState)), remainingMatchdays: rest },
    );
    if (beste != null && beste > zielRang) {
      return info("verfehlt", `Selbst mit allen Punkten ${letzte} höchstens Platz ${beste}, Ziel war Platz ${zielRang}.`);
    }
    return info("gefaehrdet", `Noch ${rest} Spieltag${rest === 1 ? "" : "e"} für Platz ${zielRang}: rechnerisch erreichbar, aber aktuell darunter.`);
  }
  return info("gefaehrdet", `Aktuell unter dem Ziel, bis zum Saisonende ${offen} — entschieden wird erst dann.`);
}

/** Roh-Status zurück, damit Abrechnungs-Anzeigen ("Erfüllt/Verfehlt" nach Saisonende) gleich bleiben. */
export function kursZuStatus(kurs: ZielKurs): "completed" | "at_risk" | "failed" | "open" {
  if (kurs === "erreicht") return "completed";
  if (kurs === "verfehlt") return "failed";
  if (kurs === "gefaehrdet") return "at_risk";
  return "open";
}
