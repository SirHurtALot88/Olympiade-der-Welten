/* eslint-disable no-console */
/**
 * ZAHLT DIE KI VERNUENFTIGE GEHAELTER — oder ist das Spiel zu einfach?
 *
 * GEFRAGT VON CHRIS (`4fqhhw`): „Kannst du bitte mal prüfen, ob die AI Teams sinnvoll Gehälter
 * verhandeln mit den Spielenr im Vergleich zu meinen Verhandlungen und gehältern. Wir wollen ja
 * auch nicht dass das Spiel zu einfach wird!"
 *
 * DIE ERSTE MESSUNG SAH ALARMIEREND AUS — und war irrefuehrend. Ueber alle Vertraege gemittelt
 * zahlte Chris 14,9 % des Marktwerts als Gehalt, die KI 25,3 %: Faktor 0,59. Daraus haette man
 * eine KI-Anpassung gebaut.
 *
 * NACH VERTRAGSLAENGE GETRENNT bleibt davon fast nichts uebrig:
 *
 *   Jahre   Mensch          KI              Faktor
 *     1     25,2 % (52)     26,9 % (1455)   0,94
 *     2     22,7 % (9)      25,4 % (483)    0,89
 *     3     17,2 % (12)     21,7 % (223)    0,79
 *     4     15,0 % (4)      17,6 % (27)     0,85
 *     5     18,4 % (12)     14,3 % (14)     1,29   <- Chris zahlt MEHR
 *
 * Der Gesamtabstand war also ueberwiegend ein MISCHUNGSEFFEKT: Chris unterschreibt lang (Ø 3,0
 * Jahre in `swnjlk`), die KI kurz (Ø 1,9). Lange Vertraege sind pro Jahr billiger — das ist die
 * gewollte Regel „laenger fuer weniger Gehalt" (`resolveContractLengthSalaryFactor`), kein
 * Verhandlungsvorteil. Chris zahlt seinen Rabatt mit Bindung.
 *
 * Und es ist kein Muster ueber alle Spielstaende: in `1hf25q` liegt der Gesamtfaktor bei 1,04,
 * in `hwz8fk` bei 0,86, in `swnjlk` bei 0,59 — je nachdem, wie lange der Mensch dort unterschreibt.
 *
 * DESHALB WURDE NICHTS AN DER KI GEAENDERT. Was bleibt, ist dieses Werkzeug: einmal je Saison
 * gefahren zeigt es, ob sich der Abstand INNERHALB einer Vertragslaenge verschiebt. Erst das waere
 * ein Befund, auf den sich ein Eingriff stuetzen liesse.
 *
 * Nutzung:
 *   OLY_APP_SQLITE_PATH=/pfad/zur/kopie.sqlite npx tsx scripts/messe-gehaelter-mensch-gegen-ki.ts
 */
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());
import type { GameState } from "@/lib/data/olyDataTypes";
import { createPersistenceService } from "@/lib/persistence/persistence-service";

type Zeile = { mensch: boolean; quote: number; jahre: number };

function median(werte: number[]): number | null {
  if (werte.length === 0) return null;
  const sortiert = [...werte].sort((links, rechts) => links - rechts);
  return sortiert[Math.floor(sortiert.length / 2)] ?? null;
}

function prozent(wert: number | null): string {
  return wert == null ? "—" : `${(wert * 100).toFixed(1)} %`;
}

const p = createPersistenceService();
const alle: Zeile[] = [];

for (const eintrag of p.listSaves()) {
  const gs = p.getSaveById(eintrag.saveId)?.gameState as GameState | undefined;
  if (!gs?.rosters?.length) continue;
  const marktwertNachId = new Map(
    (gs.players ?? []).map((spieler) => [
      spieler.id,
      (spieler as { displayMarketValue?: number | null }).displayMarketValue ?? spieler.marketValue ?? 0,
    ]),
  );
  const meineTeams = new Set(
    (gs.teams ?? []).filter((team) => (team as { humanControlled?: boolean }).humanControlled).map((team) => team.teamId),
  );

  const jeSave: Zeile[] = [];
  for (const roster of gs.rosters) {
    const marktwert = Number(marktwertNachId.get(roster.playerId) ?? 0);
    // Ohne Marktwert ist die Quote nicht definiert — kein erfundener Nenner.
    if (!(marktwert > 0)) continue;
    const zeile: Zeile = {
      mensch: meineTeams.has(roster.teamId),
      quote: (roster.salary ?? 0) / marktwert,
      jahre: Math.min(5, Math.max(1, roster.contractLength ?? 1)),
    };
    jeSave.push(zeile);
    alle.push(zeile);
  }

  const mensch = median(jeSave.filter((z) => z.mensch).map((z) => z.quote));
  const ki = median(jeSave.filter((z) => !z.mensch).map((z) => z.quote));
  const laenge = (auswahl: Zeile[]) =>
    auswahl.length ? (auswahl.reduce((summe, z) => summe + z.jahre, 0) / auswahl.length).toFixed(1) : "—";
  console.log(
    `${String(eintrag.saveId).slice(-6)}  Mensch ${prozent(mensch)} (Ø ${laenge(jeSave.filter((z) => z.mensch))} Jahre)` +
      `   KI ${prozent(ki)} (Ø ${laenge(jeSave.filter((z) => !z.mensch))} Jahre)` +
      `   Faktor ${mensch != null && ki ? (mensch / ki).toFixed(2) : "—"}`,
  );
}

console.log("\nDER EIGENTLICHE VERGLEICH — nach Vertragslaenge getrennt, ueber alle Spielstaende:");
console.log("  Jahre   Mensch              KI                  Faktor");
for (const jahre of [1, 2, 3, 4, 5]) {
  const mensch = alle.filter((z) => z.mensch && z.jahre === jahre).map((z) => z.quote);
  const ki = alle.filter((z) => !z.mensch && z.jahre === jahre).map((z) => z.quote);
  if (ki.length === 0) continue;
  const m = median(mensch);
  const k = median(ki);
  console.log(
    `    ${jahre}     ${`${prozent(m)} (${mensch.length})`.padEnd(20)}${`${prozent(k)} (${ki.length})`.padEnd(20)}` +
      `${m != null && k ? (m / k).toFixed(2) : "—"}`,
  );
}
console.log(
  "\nEin Faktor nahe 1 je Zeile heisst: gleiche Vertragslaenge, gleicher Preis — der Gesamtabstand" +
    "\nkommt dann aus der Laengen-Mischung, nicht aus der Verhandlung.",
);
