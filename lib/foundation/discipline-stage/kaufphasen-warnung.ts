import type { GameState } from "@/lib/data/olyDataTypes";
import { getManualControlTeamIds } from "@/lib/foundation/team-control-settings";
import { isTransferBuyPhaseOpen } from "@/lib/market/transfer-window-policy";

/**
 * DIE LETZTE ANSAGE VOR EINER TÜR, DIE FÜR EINE GANZE SAISON ZUFÄLLT.
 *
 * GEMELDET VON CHRIS (`cubix1`, „Spieltag · Home", Spielstand `hwz8fk`, Saison 2, MD1):
 * „Season Übergang von S1 -> S2 blockiert die neuen käufe und die kann man manuell nicht
 * nachholen. das ist natürlich ein problem bitte dann probleme fixen und käufe erneut anstoßen"
 *
 * NACHGEMESSEN WAR DAS KEIN DEFEKT. `isEarlySeasonTransferSetup`
 * (lib/market/transfer-window-policy.ts) öffnet das Kauffenster ausschliesslich in der neuen
 * Saison VOR ihrem ersten Spieltag; `TRANSFER_BUY_PHASES` ist bewusst leer. Das ist Chris' eigene
 * Regel, im Quelltext wörtlich zitiert: „zu beginn der neuen saison wird eingekauft dafür wird
 * dort NICHT MEHR verkauft!" Kein Team lag in den sieben Spielständen unter dem Kader-Minimum, es
 * wurde also gekauft — Chris' Meldung um 08:05 lag mitten im laufenden KI-Kauffenster
 * (07:53–08:10), und ein Lauf ohne sichtbaren Fortschritt sieht aus wie eine Blockade.
 *
 * WAS TATSÄCHLICH FEHLTE, ist die Ansage davor. Sobald der erste Spieltag ein Ergebnis trägt
 * (`hasCurrentMatchdayResult`), ist das Fenster für die ganze Saison zu — und man erfährt es erst
 * danach. Wer den Spieltag anstösst, bevor er fertig eingekauft hat, verliert die Möglichkeit für
 * eine ganze Saison.
 *
 * Chris hat aus drei Wegen den ersten gewählt: die Regel bleibt, wie sie ist, und es kommt nur
 * die fehlende letzte Ansage vor einer unumkehrbaren Handlung dazu.
 *
 * WARUM DER KONTOSTAND MITENTSCHEIDET: wer kein Geld hat, kann ohnehin nicht kaufen, und eine
 * Warnung ohne Handlungsmöglichkeit ist nur Rauschen. Gezählt wird das ROHE `cash` der manuell
 * gesteuerten Teams — die Reserve-Regeln aus `lib/ai/**` sind die Zurückhaltung der KI-Planer,
 * nicht die Ausgabegrenze eines Menschen. Ein Mensch darf bis auf 0 herunterkaufen.
 */
export type KaufphasenWarnung = {
  /** Summe der Kontostände aller manuell gesteuerten Teams. */
  kontostand: number;
  /** Wie viele Teams dahinterstehen — im Koop sind es mehrere. */
  teamCount: number;
};

export function ermittleKaufphasenWarnung(gameState: GameState): KaufphasenWarnung | null {
  /**
   * DEFENSIV GEGEN TEIL-SPIELSTAENDE — nachgetragen, nachdem genau das die Arena zerlegt hat.
   *
   * `isEarlySeasonTransferSetup` liest `gameState.season.currentMatchday` und
   * `gameState.matchdayState.status` ohne Absicherung. Im Bootstrap- und im Render-Test-Fall fehlen
   * beide Zweige, und der Aufruf warf `Cannot read properties of undefined (reading
   * 'currentMatchday')` — mitten im `useMemo` der Arena, also beim Rendern selbst.
   *
   * Die Arena ist an jeder anderen Stelle darauf vorbereitet („Defensiv gegen Bootstrap-/Teil-
   * States: im Ladefenster koennen diese Arrays (noch) fehlen"); dieser Zugang war es nicht.
   *
   * Inhaltlich ist der Riegel ohnehin richtig: ohne Saison und ohne Spieltag gibt es kein
   * Kauffenster, ueber dessen Schliessen man warnen koennte.
   */
  if (gameState?.season == null || gameState.matchdayState == null) {
    return null;
  }
  if (!isTransferBuyPhaseOpen(gameState)) {
    return null;
  }
  const meineTeamIds = getManualControlTeamIds(gameState);
  const meineTeams = (gameState.teams ?? []).filter((team) => meineTeamIds.has(team.teamId));
  const kontostand = meineTeams.reduce((summe, team) => summe + Math.max(0, team.cash ?? 0), 0);
  if (kontostand <= 0) {
    return null;
  }
  return { kontostand, teamCount: meineTeams.length };
}
