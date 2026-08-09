/**
 * APRON-LINIEN-REPARATUR — die Rechenlogik hinter `scripts/repariere-apron-linien.ts`.
 *
 * DER FALL: Ein Snapshot von einem ALTEN Build (Einfrieren vor dem Kaderbau, siehe #467) sitzt in
 * einer Saison fest, die inzwischen gespielt wurde. Die Selbstheilung aus #467 greift dann nicht
 * mehr — `resolveSeasonApronLines` hält den Snapshot ab dem ersten abgerechneten Spieltag bewusst
 * für endgültig. Auf Chris' Spielstand hieß das: Median 45,0 eingefroren (06:05:23, vor allen 106
 * Zugängen der Saison), realer Median nach dem Kaderbau 69,8 — die Abrechnung hätte 29 Zahler mit
 * 550,7 Mio getroffen, bei 2 Empfängern zu je 275,4 Mio und Liga-Cash-Ständen von 0 bis 36 Mio.
 *
 * WARUM DIE NEUBERECHNUNG HIER KEINE SCHÄTZUNG IST: Das Kauffenster schließt mit der ersten Wertung
 * des ersten Spieltags. Gab es seit diesem Zeitpunkt KEINE Transfers, sind die heutigen Kader exakt
 * die, mit denen die Saison gestartet ist — `computeApronLines` auf dem heutigen Stand liefert
 * dann genau die Zahl, die das Einfrieren beim Fensterschluss geliefert hätte. Gab es danach
 * Transfers, gilt das nicht mehr, und dieser Plan BLOCKIERT das Schreiben, statt eine mittendrin
 * verschobene Grenze als "Reparatur" auszugeben.
 *
 * BEWUSST KEINE AUTOMATIK: Ein Alt-Build-Snapshot (ohne `frozenAtEvent`) in einer gespielten Saison
 * wird NICHT automatisch im Spielbetrieb ersetzt. Automatisch ersetzen hieße, eine Grenze mitten in
 * der Saison zu verschieben — genau das, wovor das Einfrieren schützt — und der Spielbetrieb kann
 * die Vorbedingung (null Transfers seit dem ersten Spieltag) zwar prüfen, aber dem Spieler nicht
 * vorrechnen. Die Heilung läuft deshalb ausschließlich über das Skript, das die Vorher/Nachher-
 * Zahlen zeigt und die Entscheidung beim Menschen lässt.
 *
 * EINE QUELLE PRO GRÖSSE: Die Linien kommen aus `computeApronLines`, die Wirkung aus
 * `previewApronSettlement` — dieselben Funktionen, die Live-Anzeige und Saisonende-Abrechnung
 * benutzen. Hier wird nichts zweites gerechnet.
 */
import type { ApronLinesSnapshot, GameState } from "@/lib/data/olyDataTypes";
import { computeApronLines, hasSeasonBeenPlayed, type ApronLines } from "@/lib/season/apron-service";
import {
  previewApronSettlement,
  type ApronSettlementPreview,
} from "@/lib/season/apron-settlement-service";

export type ApronRepairBlockGrund =
  | "saison_noch_nicht_gespielt"
  | "kein_gewertetes_spieltagsergebnis"
  | "transfers_nach_erstem_spieltag"
  | "snapshot_bereits_vom_fensterschluss"
  | "saison_bereits_abgerechnet"
  | "linien_bereits_identisch";

export type ApronLinesRepairPlan = {
  seasonId: string;
  /** Erste Wertung des ersten Spieltags der laufenden Saison — der Fensterschluss-Zeitpunkt. */
  ersterGewerteterSpieltag: { matchdayId: string; createdAt: string } | null;
  /** Transfers mit `happenedAt` NACH dem Fensterschluss — muss 0 sein, sonst ist der Plan blockiert. */
  transfersNachErstemSpieltag: number;
  alteLinien: ApronLinesSnapshot | null;
  /** Neuberechnung mit `computeApronLines` auf dem heutigen Stand. */
  neueLinien: ApronLines;
  /** Wirkung der ALTEN Linien auf die Saisonende-Abrechnung (previewApronSettlement, Rang heute). */
  vorher: ApronSettlementPreview | null;
  /** Wirkung der NEUEN Linien — derselbe Live-Pfad, nur mit ersetztem Snapshot. */
  nachher: ApronSettlementPreview | null;
  blockGruende: ApronRepairBlockGrund[];
  blockiert: boolean;
  /** Der Snapshot, der geschrieben würde — `null`, wenn blockiert. */
  neuerSnapshot: ApronLinesSnapshot | null;
  /** GameState mit ersetztem Snapshot — `null`, wenn blockiert. Sonst unverändert bis auf den Snapshot. */
  gameStateRepariert: GameState | null;
};

/** Zwei Linien gelten als identisch, wenn alle drei Größen auf die gerundete Zehntel übereinstimmen. */
function linienIdentisch(a: Pick<ApronLines, "medianSalary" | "line1" | "line2">, b: Pick<ApronLines, "medianSalary" | "line1" | "line2">): boolean {
  const gleich = (x: number, y: number) => Math.abs(x - y) < 0.05;
  return gleich(a.medianSalary, b.medianSalary) && gleich(a.line1, b.line1) && gleich(a.line2, b.line2);
}

export function planeApronLinienReparatur(gameState: GameState, optionen?: { jetzt?: string }): ApronLinesRepairPlan {
  const seasonId = gameState.season.id;
  const jetzt = optionen?.jetzt ?? new Date().toISOString();
  const blockGruende: ApronRepairBlockGrund[] = [];

  // Fensterschluss-Zeitpunkt: das ÄLTESTE gewertete Ergebnis der laufenden Saison. Dieselben
  // Kriterien wie im Ranks-Reparaturskript (status "preview_applied", createdAt als Stichzeit).
  const gewertet = (gameState.seasonState.matchdayResults ?? [])
    .filter((result) => result.seasonId === seasonId && result.status === "preview_applied")
    .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
  const erstes = gewertet[0] ?? null;
  const ersterGewerteterSpieltag = erstes
    ? { matchdayId: String(erstes.matchdayId), createdAt: String(erstes.createdAt) }
    : null;

  if (!hasSeasonBeenPlayed(gameState)) {
    // Nichts festgeschrieben: `resolveSeasonApronLines` rechnet ohnehin bei jedem Aufruf neu,
    // und der letzte Aufruf vor dem ersten Spieltag setzt den richtigen Stand. Nichts zu reparieren.
    blockGruende.push("saison_noch_nicht_gespielt");
  } else if (!ersterGewerteterSpieltag) {
    // Gespielt laut Zeugen (z. B. Tabellen-Buchung), aber kein gewertetes Ergebnis mit Zeitstempel —
    // ohne Stichzeit lässt sich "keine Transfers seit Fensterschluss" nicht nachweisen.
    blockGruende.push("kein_gewertetes_spieltagsergebnis");
  }

  // DIE SCHRANKE: Transfers nach dem Fensterschluss machen die Neuberechnung zur Schätzung —
  // der heutige Kaderstand wäre nicht mehr der Stand, den das Einfrieren gesehen hätte.
  const transfersNachErstemSpieltag = ersterGewerteterSpieltag
    ? gameState.transferHistory.filter((entry) => entry.happenedAt > ersterGewerteterSpieltag.createdAt).length
    : 0;
  if (transfersNachErstemSpieltag > 0) {
    blockGruende.push("transfers_nach_erstem_spieltag");
  }

  const alteLinien =
    gameState.seasonState.apronLinesSnapshot?.seasonId === seasonId
      ? gameState.seasonState.apronLinesSnapshot
      : null;
  if (alteLinien?.frozenAtEvent === "buy_window_close") {
    // Der Snapshot stammt nachweislich vom korrigierten Einfrier-Zeitpunkt — es gibt nichts zu heilen.
    blockGruende.push("snapshot_bereits_vom_fensterschluss");
  }

  // Nach der Saisonende-Abrechnung wäre eine Linien-Reparatur Etikettenschwindel: die Cash-Buchungen
  // sind mit den alten Linien gelaufen, ein neuer Snapshot würde eine Abrechnung behaupten, die so
  // nie stattfand.
  const bereitsAbgerechnet = (gameState.seasonState.apronSettlementLogs ?? []).some(
    (log) => log.seasonId === seasonId && log.phase === "season_end",
  );
  if (bereitsAbgerechnet) {
    blockGruende.push("saison_bereits_abgerechnet");
  }

  const neueLinien = computeApronLines(gameState);
  if (alteLinien && linienIdentisch(alteLinien, neueLinien)) {
    blockGruende.push("linien_bereits_identisch");
  }

  // Wirkung VORHER: der Spielstand, wie er ist (mit dem alten Snapshot). Wirkung NACHHER: derselbe
  // Live-Pfad mit ersetztem Snapshot — bewusst `previewApronSettlement` in beiden Fällen, damit die
  // gezeigten Zahlen exakt die sind, die die Saisonende-Abrechnung buchen würde.
  const vorher = alteLinien ? previewApronSettlement(gameState) : null;

  const blockiert = blockGruende.length > 0;

  const neuerSnapshot: ApronLinesSnapshot | null =
    !blockiert && ersterGewerteterSpieltag
      ? {
          seasonId,
          frozenAtMatchdayId: ersterGewerteterSpieltag.matchdayId,
          createdAt: jetzt,
          frozenAtEvent: "recompute_repair",
          medianSalary: neueLinien.medianSalary,
          line1: neueLinien.line1,
          line2: neueLinien.line2,
          usedReferenceSalary: neueLinien.usedReferenceSalary,
          note:
            `Neu berechnet am ${jetzt} (scripts/repariere-apron-linien.ts): ` +
            (alteLinien
              ? `Alt-Snapshot vom ${alteLinien.createdAt} fror vor dem Kaderbau ein (Median ${alteLinien.medianSalary}). `
              : `Es lag kein Snapshot dieser Saison vor. `) +
            `Seit dem ersten gewerteten Spieltag (${ersterGewerteterSpieltag.createdAt}) gab es 0 Transfers — ` +
            `die Neuberechnung entspricht dem Stand beim Fensterschluss.`,
        }
      : null;

  const gameStateRepariert: GameState | null = neuerSnapshot
    ? {
        ...gameState,
        seasonState: {
          ...gameState.seasonState,
          apronLinesSnapshot: neuerSnapshot,
        },
      }
    : null;

  const nachher = gameStateRepariert ? previewApronSettlement(gameStateRepariert) : null;

  return {
    seasonId,
    ersterGewerteterSpieltag,
    transfersNachErstemSpieltag,
    alteLinien,
    neueLinien,
    vorher,
    nachher,
    blockGruende,
    blockiert,
    neuerSnapshot,
    gameStateRepariert,
  };
}
