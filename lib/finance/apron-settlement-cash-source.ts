/**
 * DIE EINE QUELLE FÜR „WAS HAT DER APRON GEBRACHT ODER GEKOSTET".
 *
 * Das Gegenstück zu `lib/board/objective-settlement-cash-source.ts`, und es schliesst genau die
 * Lücke, die dort im Kopf schon benannt ist: „Dasselbe Muster wie `apronGebucht` in
 * `season-guv-resolver.ts`." Beim Apron war das Muster bis hierher nur HALB umgesetzt — das
 * Buchungslog entschied, ob die Zeile ZÄHLT, der BETRAG kam trotzdem weiter aus der Hochrechnung.
 *
 * Warum das auseinanderläuft: `buildApronProjection` rechnet den Umverteilungstopf jedes Mal neu,
 * gegen die Kader und Ränge von JETZT. Gebucht wurde er einmal, am Saisonende, gegen den Stand von
 * damals. Am Abbild `1hf25q` (Saison 2, abgerechnet) trennt das die Zahlen zwar nur um Zehntel
 * (W-W: 2,4 gebucht gegen 2,1 hochgerechnet), aber es ist dieselbe Sorte Fehler wie bei den
 * Vorstandszielen — die angezeigte Zeile passt nicht zu der Kontobewegung, die stattgefunden hat.
 * Und sie wächst, sobald nach dem Saisonende noch ein Transfer läuft.
 *
 * Reihenfolge wie beim Vorbild: BELEG vor Nachrechnung.
 *
 * KEIN LOG HEISST NULL, NICHT UNBEKANNT — sobald die Abrechnung der Saison überhaupt gelaufen ist.
 * Der Apron ist ein Topf: wer weder einzahlt noch bekommt, hat keinen Eintrag. Das ist eine
 * gebuchte Null.
 */
import type { GameState } from "@/lib/data/olyDataTypes";

export type ApronSettlementCashSource = {
  /** Netto-Cash je Team (Ausgleich − Abgabe). Nur belegt, wenn `gebucht` — sonst leer. */
  byTeamId: Map<string, number>;
  /** `true` = die Apron-Abrechnung dieser Saison ist gebucht. */
  gebucht: boolean;
  /** Woher die Zahlen stammen: der Buchungsbeleg oder (dann leer) die Live-Hochrechnung. */
  quelle: "beleg" | "projektion";
};

function roundCash(value: number) {
  return Math.round(value * 100) / 100;
}

/** Die gebuchte Apron-Wirkung der AKTUELLEN Saison, sofern sie gebucht ist. */
export function getApronCashByTeam(gameState: GameState): ApronSettlementCashSource {
  const seasonId = gameState.season.id;
  const logs = (gameState.seasonState.apronSettlementLogs ?? []).filter(
    (log) => log.seasonId === seasonId && log.phase === "season_end",
  );
  if (logs.length === 0) {
    return { byTeamId: new Map(), gebucht: false, quelle: "projektion" };
  }

  const byTeamId = new Map<string, number>(gameState.teams.map((team) => [team.teamId, 0] as const));
  for (const log of logs) {
    if (!Number.isFinite(log.cashDelta)) continue;
    byTeamId.set(log.teamId, roundCash((byTeamId.get(log.teamId) ?? 0) + log.cashDelta));
  }
  return { byTeamId, gebucht: true, quelle: "beleg" };
}
