/**
 * WIE VIELE SPIELER EINES TEAMS HABEN SICH IN DIESER SAISON ENTWICKELT — eine Zählstelle.
 *
 * CHRIS' ENTSCHEIDUNG (Meldung `u3wlh4`, nach seinem Einwand „die spieler verbessern sich ja nur um
 * ein paar statpoints! Das kann nicht 23 mio MW unterschied ausmachen"): Entwicklung wird am
 * ATTRIBUT-ZUWACHS gemessen, nicht am Marktwert.
 *
 * WAS VORHER WAR — derselbe Fehler an zwei Stellen. Sowohl die Sponsor-Achse `entwicklung`
 * (`sponsor-v4-axes.ts`) als auch das Sonderziel `golden_talent_forge`
 * (`sponsor-objective-evaluator.ts`) rechneten
 * `after.marketValuePreview − before.marketValue >= Schwelle`. An 1017 Entwicklungs-Ereignissen aus
 * drei Live-Spielständen nachgemessen ist `before.marketValue` in **allen** Fällen 0. Die Differenz
 * war damit der ABSOLUTE Marktwert, kein Zuwachs — beide Regeln zählten „Spieler mit Marktwert über
 * X", also praktisch den ganzen Kader (326 von 339 rissen die Schwelle 6).
 *
 * WARUM DER MARKTWERT AUCH NACH EINER REPARATUR DIE FALSCHE GRÖSSE WÄRE: am Saisonende ersetzt
 * `applyRankTableMarketValuesToGameState` den Marktwert jedes Spielers durch den rangbasierten Wert.
 * Vorher und nachher stehen damit auf verschiedenen Bewertungsmethoden — derselbe Methodenwechsel,
 * den der Kommentar zur `wachstum`-Achse längst beschreibt. Ein „Zuwachs" über diesen Wechsel hinweg
 * wäre wieder keiner.
 *
 * DIE ATTRIBUTE SIND SAUBER. Sie stehen in beiden Snapshots und unterscheiden sich in allen 339
 * geprüften Ereignissen. Gemessen über 1017 Spieler:
 *
 *   Summe aller Attribut-Änderungen je Spieler und Saison
 *   min −4,0 · p25 −0,3 · median 1,3 · p75 2,8 · p90 4,3 · max 10,8
 *   285 Spieler entwickeln sich ZURÜCK, 19 stehen still, 713 legen zu.
 *
 * Die Spannweite ist echt und die Regression ausdrücklich mitgezählt: wer über die Saison Attribute
 * verliert, hat sich nicht entwickelt, und ein Ziel, das das ignoriert, wäre wieder geschönt.
 *
 * EINE STELLE FÜR BEIDE REGELN, weil es sie vorher zweimal gab — mit demselben Fehler und zwei
 * eigenen Konstanten. Zwei Definitionen von „hat sich entwickelt" driften auseinander, sobald jemand
 * eine davon anfasst.
 */
import type { GameState } from "@/lib/data/olyDataTypes";

/**
 * Attribut-Punkte, die ein Spieler über die Saison zulegen muss, um als entwickelt zu zählen —
 * summiert über ALLE Attribute, Rückschritte eingerechnet.
 *
 * 2 liegt zwischen Median (1,3) und p75 (2,8) der gemessenen Verteilung: unter dem Median wäre die
 * Schwelle wieder wirkungslos, über p75 träfe sie nur noch Ausreißer. Siehe die Kalibrierung bei
 * `entwicklung` in `sponsor-v4-axes.ts`.
 */
export const ENTWICKLUNG_ATTRIBUT_PUNKTE = 2;

/**
 * Der Attribut-Zuwachs EINES Ereignisses — Summe über alle Attribute, Vorzeichen erhalten.
 *
 * `null`, wenn einer der beiden Snapshots fehlt: ein fehlender Ausgangswert darf nicht als „kein
 * Zuwachs" durchgehen. Genau diese Verwechslung (fehlend als 0 gelesen) war der ursprüngliche
 * Fehler.
 */
export function attributZuwachsEinesEreignisses(event: {
  progressionSnapshotBefore?: { attributes?: Record<string, number> } | null;
  progressionSnapshotAfter?: { attributes?: Record<string, number> } | null;
}): number | null {
  const vorher = event.progressionSnapshotBefore?.attributes;
  const nachher = event.progressionSnapshotAfter?.attributes;
  if (!vorher || !nachher) return null;
  let summe = 0;
  for (const schluessel of new Set([...Object.keys(vorher), ...Object.keys(nachher)])) {
    const a = vorher[schluessel];
    const b = nachher[schluessel];
    // `Number.isFinite`, nicht `typeof === "number"`: NaN besteht die typeof-Prüfung und hätte die
    // ganze Summe auf NaN gezogen — ein einziges kaputtes Attribut hätte den Spieler damit
    // stillschweigend aus der Zählung genommen.
    if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
    summe += b - a;
  }
  return Math.round(summe * 100) / 100;
}

/**
 * Zahl der Spieler eines Teams, die in der LAUFENDEN Saison mindestens `schwelle` Attribut-Punkte
 * zugelegt haben. Ein Spieler zählt einmal, auch wenn mehrere Ereignisse auf ihn laufen.
 *
 * `teamId` ODER Kaderzugehörigkeit: dieselbe Regel wie zuvor — ein Spieler, der im Kader steht,
 * zählt auch dann, wenn das Ereignis noch das alte Team trägt.
 */
export function zaehleEntwickelteSpieler(
  gameState: GameState,
  teamId: string,
  schwelle: number = ENTWICKLUNG_ATTRIBUT_PUNKTE,
): number {
  const kaderIds = new Set(
    gameState.rosters.filter((entry) => entry.teamId === teamId).map((entry) => entry.playerId),
  );
  const entwickelt = new Set<string>();
  for (const event of gameState.playerProgressionEvents ?? []) {
    if (event.seasonId !== gameState.season.id) continue;
    if (event.teamId !== teamId && !kaderIds.has(event.playerId)) continue;
    const zuwachs = attributZuwachsEinesEreignisses(event);
    if (zuwachs != null && zuwachs >= schwelle) {
      entwickelt.add(event.playerId);
    }
  }
  return entwickelt.size;
}
