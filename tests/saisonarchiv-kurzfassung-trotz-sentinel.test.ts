/**
 * DIE KURZFASSUNG DES SAISONARCHIVS MUSS AUCH HINTER DEM SENTINEL ANKOMMEN.
 *
 * DER BEFUND: Fuer den Browser werden die vollen `seasonSnapshots` gestrichen; damit die
 * Archiv-Ansichten nicht dauernd nachladen, setzt `withCompactSeasonArchiveSentinel` an ihre
 * Stelle eine LEERE LISTE. Als Ersatz faehrt die Projektion `foundationSeasonHistory` mit.
 *
 * Zwei Leser haben diesen Ersatz nie erreicht, weil sie ihn mit `??` angebunden hatten:
 *
 *     gameState.seasonState.seasonSnapshots ?? (…Kurzfassung…)
 *
 * `??` greift nur bei `null`/`undefined`. `[]` ist beides nicht — der Ersatzzweig war toter Code.
 * Sichtbar wurde das als „keine archivierten Saisons" in der Ewigen Tabelle und als ein
 * Vorsaison-Podium, das im Ranks-Reiter ganz verschwand, obwohl die Daten mitgefahren sind.
 *
 * WARUM DER TEST DEN SENTINEL WIRKLICH ANWENDET statt `[]` von Hand hinzuschreiben: genau die
 * Kette ist der Fehler. Ein Test, der die leere Liste selbst setzt, wuerde beim naechsten Umbau
 * des Sentinels stillschweigend am Ziel vorbeilaufen.
 *
 * GEGENPROBE (ausgefuehrt): beide Leser auf `??` zurueckgesetzt — die beiden ersten Faelle werden
 * rot („keine archivierte Saison" bzw. Podium `null`), der Kontrollfall bleibt gruen.
 */
import { describe, expect, it } from "vitest";

import type { GameState } from "@/lib/data/olyDataTypes";
import { buildAllTimeTableModel } from "@/lib/foundation/all-time-table";
import { withCompactSeasonArchiveSentinel } from "@/lib/foundation/apply-compact-season-archive-sentinel";
import { buildPreviousSeasonPodium } from "@/lib/foundation/ranks-previous-season-podium";
import { createSingleplayerGameState } from "@/lib/game-state/singleplayer-state";
import { projiziereSaisonHistorie } from "@/lib/persistence/foundation-season-history-projection";

/** Ein Spielstand mit genau einer abgeschlossenen Saison im Archiv. */
function mitArchivierterSaison(): GameState {
  const basis = createSingleplayerGameState();
  const archivierteSaisonId = "season-0";
  const schnappschuss = {
    seasonId: archivierteSaisonId,
    seasonName: "Saison 1",
    // Beide Formen setzen: `resolveSeasonSnapshotTeamRecords` bevorzugt `teamSnapshots`, die
    // Ewige Tabelle liest `finalStandings` direkt. Ein echter Schnappschuss traegt beides.
    finalStandings: basis.teams.map((team, index) => ({
      teamId: team.teamId,
      teamCode: team.shortCode,
      teamName: team.name,
      rank: index + 1,
      points: 200 - index,
      marketValue: 500 - index,
      cash: 100 - index,
      disciplinePoints: 300 - index,
      disciplinePointsByArea: { pow: 0, spe: 0, men: 0, cha: 0 },
    })),
  };

  return {
    ...basis,
    seasonState: {
      ...basis.seasonState,
      seasonSnapshots: [schnappschuss as never],
    },
  };
}

/** Was der Browser wirklich bekommt: Schnappschuesse gestrichen, Kurzfassung mitgegeben. */
function wieImBrowser(voll: GameState): GameState {
  const historie = projiziereSaisonHistorie(voll.seasonState.seasonSnapshots);
  const ohneSchnappschuesse: GameState = {
    ...voll,
    seasonState: {
      ...voll.seasonState,
      seasonSnapshots: undefined,
      foundationSeasonHistory: historie,
    },
  };
  return withCompactSeasonArchiveSentinel(ohneSchnappschuesse);
}

describe("Saisonarchiv hinter dem Compact-Sentinel", () => {
  it("setzt den Sentinel wirklich auf eine leere Liste — sonst prueft der Test nichts", () => {
    const browser = wieImBrowser(mitArchivierterSaison());
    expect(browser.seasonState.seasonSnapshots).toEqual([]);
    expect(browser.seasonState.foundationSeasonHistory, "Kurzfassung faehrt nicht mit").toBeTruthy();
  });

  it("Ewige Tabelle: zaehlt die archivierte Saison auch dann, wenn nur die Kurzfassung da ist", () => {
    const voll = mitArchivierterSaison();
    const browser = wieImBrowser(voll);

    const ausVoll = buildAllTimeTableModel({ gameState: voll });
    const ausBrowser = buildAllTimeTableModel({ gameState: browser });

    expect(ausVoll.hasHistory, "Vorbedingung: der volle Stand hat ein Archiv").toBe(true);
    expect(ausBrowser.hasHistory, "im Browser meldet die Ewige Tabelle „keine archivierten Saisons“").toBe(true);
    expect(ausBrowser.archivedSeasonCount).toBe(ausVoll.archivedSeasonCount);
  });

  it("Vorsaison-Podium: erscheint im Browser statt zu verschwinden — mit denselben drei Teams", () => {
    const voll = mitArchivierterSaison();
    const browser = wieImBrowser(voll);

    const ausVoll = buildPreviousSeasonPodium(voll);
    const ausBrowser = buildPreviousSeasonPodium(browser);

    expect(ausVoll, "Vorbedingung: der volle Stand hat ein Podium").not.toBeNull();
    expect(ausBrowser, "im Browser verschwand das Podium ganz").not.toBeNull();
    expect(ausBrowser!.entries.map((eintrag) => eintrag.teamId)).toEqual(
      ausVoll!.entries.map((eintrag) => eintrag.teamId),
    );
  });

  it("ohne Archiv und ohne Kurzfassung bleibt es ehrlich leer — kein erfundenes Podium", () => {
    // Der Kontrollfall. Ohne ihn koennte die Reparatur auch dadurch „gruen" sein, dass sie
    // ueberall irgendetwas zurueckgibt.
    const leer = withCompactSeasonArchiveSentinel(createSingleplayerGameState());
    expect(buildPreviousSeasonPodium(leer)).toBeNull();
    expect(buildAllTimeTableModel({ gameState: leer }).hasHistory).toBe(false);
  });
});
