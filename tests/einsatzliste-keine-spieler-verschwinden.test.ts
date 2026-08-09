/**
 * GEMELDET VON CHRIS: „ich habe hier 3 spieler eingesetzt - 3 sind auf der bank sichtbar - wo sind
 * die übrigen 3??? sowas darf auch gar nicht passieren"
 *
 * Im Fokus-Board der Einsatzliste standen oben die Reiter „Alle / Sofort / Alternative /
 * Blockiert" mit den Zahlen 3 / 0 / 3 / 0 — bei einem Kader, in dem nach den drei Aufgestellten
 * noch sechs Spieler übrig waren. Drei fehlten spurlos, und „Blockiert" stand auf 0, obwohl genau
 * dort die Vermissten hingehört hätten.
 *
 * URSACHE: `buildTeamdeckCandidateEntries` filtert im Modus "free" so:
 *
 *     entry.player.selectedSides.length === 0 && !entry.player.availabilityBlocker
 *
 * Der zweite Teil wirft jeden Spieler mit Verfügbarkeits-Blocker (verletzt, gesperrt, …) KOMPLETT
 * aus der Liste — er landet nicht einmal in der Gruppe "blocked". Und "free" ist der Startwert von
 * `teamdeckFilterMode`. Das Fokus-Board filtert aber ohnehin schon über seine eigenen Reiter; die
 * Vorfilterung davor war eine zweite, unsichtbare Instanz, die dem Reiter "Blockiert" seine
 * Grundlage entzog.
 *
 * Diese Datei hält beide Seiten fest: Der Modus "all" behält blockierte Spieler (damit das Board
 * sie zeigen kann), und der Modus "free" wirft sie weiterhin raus (dort ist genau das die
 * Bedeutung des Reiters — er heißt "frei verfügbar").
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { buildTeamdeckCandidateEntries, buildTeamdeckCandidateGroups } from "@/lib/lineups/lineup-candidate-model";

/** Kaderkarte, wie sie das Modell erwartet — nur die Felder, die der Filter liest. */
function createCard(overrides: {
  activePlayerId: string;
  name: string;
  selectedSides?: string[];
  availabilityBlocker?: string | null;
}) {
  return {
    activePlayerId: overrides.activePlayerId,
    playerId: overrides.activePlayerId,
    name: overrides.name,
    className: "Warlord",
    selectedSides: overrides.selectedSides ?? [],
    availabilityBlocker: overrides.availabilityBlocker ?? null,
    attributeStats: null,
    demands: [],
    disciplineScores: {},
    fatigueCount: 0,
  } as never;
}

function buildEntries(mode: "all" | "free") {
  return buildTeamdeckCandidateEntries({
    activeSlot: null,
    selections: {},
    activeSlotCandidateSummary: null,
    activeSlotCandidateByActivePlayerId: new Map(),
    matchdayRosterCards: [
      createCard({ activePlayerId: "P-frei-1", name: "Frei Eins" }),
      createCard({ activePlayerId: "P-frei-2", name: "Frei Zwei" }),
      createCard({ activePlayerId: "P-verletzt", name: "Verletzt", availabilityBlocker: "injury" }),
      createCard({ activePlayerId: "P-gesperrt", name: "Gesperrt", availabilityBlocker: "suspension" }),
    ],
    playerBestSlotSummaryByActivePlayerId: new Map(),
    context: null,
    focusedDisciplineSide: "d1",
    teamdeckFilterMode: mode,
    teamdeckSortMode: "score",
  } as never);
}

describe("Einsatzliste · kein Spieler verschwindet", () => {
  it("behält blockierte Spieler im Modus 'all'", () => {
    const namen = buildEntries("all").map((entry) => entry.player.name);

    // Alle vier müssen auftauchen — sonst fehlen sie im Board, ohne dass es jemand merkt.
    expect(namen).toContain("Verletzt");
    expect(namen).toContain("Gesperrt");
    expect(namen).toHaveLength(4);
  });

  it("wirft blockierte Spieler im Modus 'free' weiterhin raus", () => {
    // Gegenprobe: "frei verfügbar" heißt genau das. Ohne diesen Fall wäre der Fix
    // ein Rundumschlag, der die klassische Ansicht mitverändert.
    const namen = buildEntries("free").map((entry) => entry.player.name);

    expect(namen).not.toContain("Verletzt");
    expect(namen).not.toContain("Gesperrt");
  });

  it("sortiert blockierte Spieler in eine eigene Gruppe, statt sie zu schlucken", () => {
    const gruppen = buildTeamdeckCandidateGroups({
      teamdeckCandidateEntries: buildEntries("all"),
      showOnlyTopSlotCandidates: false,
      teamdeckFilterMode: "all",
    });
    const summe = gruppen.reduce((total, group) => total + group.entries.length, 0);

    // Keiner darf zwischen Entries und Gruppen verlorengehen.
    expect(summe).toBe(4);
  });
});

describe("Einsatzliste · Fokus-Board filtert nur über seine Reiter", () => {
  const source = readFileSync(
    join(process.cwd(), "app/foundation/legacy-lineup-lab/LegacyLineupLabClient.tsx"),
    "utf8",
  );

  it("baut die Board-Liste mit Modus 'all'", () => {
    expect(source).toMatch(/focusV2CandidateEntries[\s\S]{0,800}teamdeckFilterMode: "all"/);
  });

  it("gibt dem Board die ungefilterten Gruppen", () => {
    expect(source).toContain("candidateGroups={focusV2CandidateGroups}");
  });

  it("kappt die Board-Gruppen nicht auf die Top-Kandidaten", () => {
    // showOnlyTopSlotCandidates würde je Gruppe auf 3–5 Einträge kürzen — im Board mit
    // eigenen Reitern wäre auch das ein stilles Verschwinden.
    expect(source).toMatch(/focusV2CandidateGroups[\s\S]{0,400}showOnlyTopSlotCandidates: false/);
  });

  it("lässt die klassische Ansicht unverändert auf teamdeckFilterMode laufen", () => {
    expect(source).toMatch(/const teamdeckCandidateEntries[\s\S]{0,600}\n\s+teamdeckFilterMode,\n/);
  });
});
