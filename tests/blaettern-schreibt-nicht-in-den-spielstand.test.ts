/**
 * ANSEHEN DARF NICHT SCHREIBEN.
 *
 * DER BEFUND kam aus der Schreib-Sicherheitspruefung des Gameplay-Smoke-Laufs: der Lauf klickt
 * sich im Lesemodus durch die Anwendung und vergleicht danach die „destructive signature" des
 * Spielstands mit der davor. Sie hatte sich geaendert — obwohl nichts gespielt und nichts
 * gespeichert wurde. Alle Spieltests waren gruen, nur diese Wache schlug an.
 *
 * DIE URSACHE war eine Reparatur von wenigen Stunden zuvor: die Saison-Archiv-Nachladung war
 * jahrelang toter Code (sie prüfte `seasonSnapshots !== undefined`, und der Compact-Sentinel setzt
 * dort eine LEERE LISTE). Seit sie wirklich feuert, holt sie die Schnappschuesse ueber
 * `/api/season/snapshots` und legt sie in den React-Zustand. Damit aenderte sich die
 * Inhaltsunterschrift des Autosaves — und der schrieb den Spielstand, WEIL DER SPIELER EINE
 * ANSICHT GEOEFFNET HAT.
 *
 * Das ist die schlimmere Sorte Fehler: nicht eine falsche Zahl auf dem Schirm, sondern ein
 * Schreibvorgang auf einem laufenden Spielstand, den niemand angefordert hat.
 *
 * Die Reparatur nimmt `seasonSnapshots` aus der Aenderungserkennung. Sie kann keine echte
 * Aenderung verschlucken: der Client VERFASST keine Schnappschuesse — die entstehen beim
 * Saisonwechsel auf dem Server, und dann aendern sich Tabelle, Kasse und Saison-Id gleich mit.
 * Genau das prueft der letzte Fall hier.
 */
import { describe, expect, it } from "vitest";

import type { GameState, SeasonSnapshotRecord } from "@/lib/data/olyDataTypes";
import { buildAutoPersistContentSignature } from "@/lib/foundation/tabs/use-foundation-persist";
import { createSingleplayerGameState } from "@/lib/game-state/singleplayer-state";

/** Ein Schnappschuss, wie ihn `/api/season/snapshots` nachliefert. */
function archivSchnappschuss(gameState: GameState): SeasonSnapshotRecord {
  return {
    seasonId: "season-0",
    seasonName: "Saison 1",
    finalStandings: gameState.teams.map((team, index) => ({
      teamId: team.teamId,
      teamCode: team.shortCode,
      teamName: team.name,
      rank: index + 1,
      points: 200 - index,
      disciplinePoints: 300 - index,
      disciplinePointsByArea: { pow: 0, spe: 0, men: 0, cha: 0 },
    })),
  } as unknown as SeasonSnapshotRecord;
}

/** Genau das, was der Effekt im Shell-Router mit dem Ergebnis der Nachladung macht. */
function nachAlsArchivNachladung(gameState: GameState): GameState {
  return {
    ...gameState,
    seasonState: {
      ...gameState.seasonState,
      seasonSnapshots: [archivSchnappschuss(gameState)],
    },
  };
}

describe("Blaettern schreibt nicht in den Spielstand", () => {
  it("das nachgeladene Saisonarchiv aendert die Inhaltsunterschrift NICHT", () => {
    const vorher = createSingleplayerGameState();
    const nachher = nachAlsArchivNachladung(vorher);

    // Vorbedingung: der Zustand hat sich wirklich veraendert — sonst prueft der Test nichts.
    expect(nachher.seasonState.seasonSnapshots).toHaveLength(1);
    expect(nachher).not.toEqual(vorher);

    expect(
      buildAutoPersistContentSignature(nachher),
      "das blosse Nachladen des Archivs loest einen Schreibvorgang aus",
    ).toBe(buildAutoPersistContentSignature(vorher));
  });

  it("eine ECHTE Aenderung loest weiterhin aus — sonst waere der Autosave taub", () => {
    // Der Kontrollfall. Ohne ihn koennte die Reparatur auch dadurch „gruen" sein, dass die
    // Unterschrift ueberhaupt nichts mehr unterscheidet.
    const vorher = createSingleplayerGameState();
    const mitAndererKasse: GameState = {
      ...vorher,
      teams: vorher.teams.map((team, index) => (index === 0 ? { ...team, cash: team.cash + 5 } : team)),
    };

    expect(buildAutoPersistContentSignature(mitAndererKasse)).not.toBe(
      buildAutoPersistContentSignature(vorher),
    );
  });

  it("beim Saisonwechsel schreibt der Autosave trotzdem — die Begleitaenderungen tragen ihn", () => {
    // Die Sorge bei dieser Reparatur ist: verschluckt sie den Saisonwechsel, weil dort die
    // Schnappschuesse entstehen? Nein — dort aendert sich die Saison-Id gleich mit, und die steht
    // weiterhin in der Unterschrift.
    const vorher = createSingleplayerGameState();
    const nachSaisonwechsel: GameState = {
      ...nachAlsArchivNachladung(vorher),
      season: { ...vorher.season, id: "season-2" },
    };

    expect(buildAutoPersistContentSignature(nachSaisonwechsel)).not.toBe(
      buildAutoPersistContentSignature(vorher),
    );
  });
});
