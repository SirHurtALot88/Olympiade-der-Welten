import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  describeLineupRosterShortfall,
  isLineupArenaReady,
} from "@/lib/lineups/lineup-roster-shortfall";

const CLIENT = readFileSync(
  join(process.cwd(), "app/foundation/legacy-lineup-lab/LegacyLineupLabClient.tsx"),
  "utf8",
);
const NEW_LOOK = readFileSync(
  join(process.cwd(), "app/foundation/legacy-lineup-lab/LineupNewLook.tsx"),
  "utf8",
);

/**
 * GEMELDET (Franky, Save "Oly New Game Custom 30.7.2026, 14:00:46", Saison 1, Spieltag 4):
 * "spieler können nichtmehr in disziplinen eingesetzt werden."
 *
 * Am Save nachgestellt: Team T-G hat acht Kaderspieler, einer ist verletzt und zu Recht
 * gesperrt — bleiben sieben. Spieltag 4 verlangt Wettessen (6) + I Spy (4) = zehn Spieler.
 * Ab dem achten Slot gibt es keinen Kandidaten mehr. Die Zahlen dieses Saves sind unten die
 * Testdaten.
 */
describe("Einsatzliste: Kader kleiner als der Spieltag", () => {
  const FRANKY_MD4 = {
    requiredSlots: 10,
    availablePlayerCount: 7,
    rosterPlayerCount: 8,
  };

  it("schweigt, solange der Kader die Plätze decken kann", () => {
    expect(
      describeLineupRosterShortfall({
        requiredSlots: 7,
        availablePlayerCount: 7,
        rosterPlayerCount: 8,
        assignedPlayerCount: 0,
      }),
    ).toBeNull();
  });

  it("nennt Plätze, einsetzbare Spieler und die Verletzung beim Namen", () => {
    const shortfall = describeLineupRosterShortfall({ ...FRANKY_MD4, assignedPlayerCount: 0 });
    expect(shortfall).not.toBeNull();
    expect(shortfall?.unfillableSlots).toBe(3);
    expect(shortfall?.unavailableCount).toBe(1);
    expect(shortfall?.detail).toBe(
      "10 Plätze, aber nur 7 einsetzbare Spieler (1 verletzt) — 3 Plätze bleiben leer.",
    );
    // Der Hinweis sagt, was zu tun ist — nicht nur, dass etwas nicht geht.
    expect(shortfall?.hint).toContain("Setz alle verfügbaren Spieler");
    expect(shortfall?.hint).toContain("Transfermarkt");
  });

  it("wechselt den Ton, sobald jeder verfügbare Spieler steht", () => {
    const shortfall = describeLineupRosterShortfall({ ...FRANKY_MD4, assignedPlayerCount: 7 });
    expect(shortfall?.allAvailableDeployed).toBe(true);
    expect(shortfall?.headline).toBe("Alle verfügbaren Spieler stehen");
    expect(shortfall?.hint).toContain("Mehr geht an diesem Spieltag nicht");
  });

  it("lässt die Verletzten-Klammer weg, wenn niemand gesperrt ist", () => {
    const shortfall = describeLineupRosterShortfall({
      requiredSlots: 10,
      availablePlayerCount: 8,
      rosterPlayerCount: 8,
      assignedPlayerCount: 0,
    });
    expect(shortfall?.detail).toBe("10 Plätze, aber nur 8 einsetzbare Spieler — 2 Plätze bleiben leer.");
  });
});

/**
 * Derselbe Save, zweiter Befund: der Weg in die Arena verlangte NULL offene Slots. Ein Kader mit
 * sieben einsetzbaren Spielern erreicht bei zehn Plätzen nie null — der Knopf wäre dauerhaft grau
 * geblieben, obwohl `buildLegacyMatchdayReadiness` dieselbe Aufstellung als `ready`
 * (`partial_lineup_allowed`) führt.
 */
describe("Einsatzliste: Weg in die Arena bei kurzem Kader", () => {
  it("lässt eine gespeicherte Kurz-Aufstellung in die Arena", () => {
    expect(
      isLineupArenaReady({
        hasSavedDraft: true,
        hasBlockingIssues: false,
        openSlots: 3,
        allAvailablePlayersDeployed: true,
      }),
    ).toBe(true);
  });

  it("bleibt zu, solange noch besetzbare Slots offen sind", () => {
    expect(
      isLineupArenaReady({
        hasSavedDraft: true,
        hasBlockingIssues: false,
        openSlots: 3,
        allAvailablePlayersDeployed: false,
      }),
    ).toBe(false);
  });

  it("bleibt zu ohne gespeicherten Draft und bei echten Blockern", () => {
    expect(
      isLineupArenaReady({
        hasSavedDraft: false,
        hasBlockingIssues: false,
        openSlots: 0,
        allAvailablePlayersDeployed: true,
      }),
    ).toBe(false);
    expect(
      isLineupArenaReady({
        hasSavedDraft: true,
        hasBlockingIssues: true,
        openSlots: 0,
        allAvailablePlayersDeployed: true,
      }),
    ).toBe(false);
  });
});

describe("Einsatzliste: Verdrahtung in der Oberfläche", () => {
  it("berechnet die Unterdeckung aus Kader, Sperren und Slotzahl des Spieltags", () => {
    expect(CLIENT).toContain("const lineupRosterShortfall = useMemo(() => {");
    expect(CLIENT).toContain("describeLineupRosterShortfall({");
    expect(CLIENT).toContain("rosterPlayerCount: context?.rosterPlayers?.length ?? 0,");
    expect(CLIENT).toContain("availablePlayerCount: context?.activePlayers?.length ?? 0,");
    expect(CLIENT).toContain("rosterShortfall={lineupRosterShortfall}");
  });

  it("prüft den Arena-Weg über die gemeinsame Regel statt über 'null offene Slots'", () => {
    // Genau diese Zeile war der Riegel.
    expect(CLIENT).not.toContain(
      "Boolean(draft) && lineupMiniAudit.blockingItems.length === 0 && matchdayPreviewCards.openSlots === 0",
    );
    expect(CLIENT).toContain("isLineupArenaReady({");
    expect(CLIENT).toContain("allAvailablePlayersDeployed,");
  });

  it("stellt den Hinweis an die Einsatzliste — und in den leeren Kandidatenkasten", () => {
    expect(NEW_LOOK).toContain('data-testid="nl-lineup-roster-shortfall"');
    expect(NEW_LOOK).toContain("{rosterShortfall.headline}");
    // Der leere Kandidatenkasten sagt jetzt den Grund, statt nur "Keine Kandidaten".
    expect(NEW_LOOK).toContain('title={rosterShortfall ? rosterShortfall.headline : "Keine Kandidaten"}');
  });
});
