/**
 * GEMELDET AUS DEM SPIEL: "man geht ohne Formkarten in die Arena, schaut sich das Ergebnis an,
 * geht wieder raus, macht sich Formkarten rein, bis man genug Plaetze aufgestiegen ist, und
 * beendet dann den Spieltag. Sonst kann man das abusen als menschlicher Spieler."
 *
 * Das funktioniert, weil der Spieltag reproduzierbar gerechnet wird — dieselben Aufstellungen
 * ergeben immer dasselbe Ergebnis. Wer es einmal gesehen hat, kann gezielt nachbessern.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { describeLineupCommitment } from "@/lib/lineups/matchday-lineup-lock";

const read = (relativePath: string) => readFileSync(join(process.cwd(), relativePath), "utf8");

const noCards = {
  d1: { primaryFormCardId: null, secondaryFormCardId: null },
  d2: { primaryFormCardId: null, secondaryFormCardId: null },
} as never;

describe("Was der Manager mit dieser Abgabe einsetzt", () => {
  it("erkennt die leere Abgabe — weder Formkarte noch Kapitaen", () => {
    const summary = describeLineupCommitment([{ playerId: "p1" }] as never, noCards);
    expect(summary).toEqual({ hasFormCards: false, hasCaptain: false, isEmptyCommitment: true });
  });

  it("erkennt den Kapitaen — der steckt im EINTRAG, nicht in den Modifikatoren", () => {
    // Genau deshalb reicht eine Sperre allein auf `modifiers` nicht: den Kapitaen (x1,5)
    // koennte man danach immer noch umsetzen.
    const summary = describeLineupCommitment(
      [{ playerId: "p1" }, { playerId: "p2", isCaptain: true }] as never,
      noCards,
    );
    expect(summary.hasCaptain).toBe(true);
    expect(summary.isEmptyCommitment).toBe(false);
  });

  it("erkennt Formkarten auf BEIDEN Disziplin-Seiten", () => {
    const d1Only = describeLineupCommitment([] as never, {
      d1: { primaryFormCardId: "card-1", secondaryFormCardId: null },
      d2: { primaryFormCardId: null, secondaryFormCardId: null },
    } as never);
    expect(d1Only.hasFormCards).toBe(true);

    const d2Secondary = describeLineupCommitment([] as never, {
      d1: { primaryFormCardId: null, secondaryFormCardId: null },
      d2: { primaryFormCardId: null, secondaryFormCardId: "card-9" },
    } as never);
    expect(d2Secondary.hasFormCards).toBe(true);
  });

  it("kommt ohne Modifikator-Block und ohne Eintraege zurecht", () => {
    // Eine Aufstellung ohne Karten hat schlicht keinen befuellten Block — kein Fehlerfall.
    expect(describeLineupCommitment(null, null).isEmptyCommitment).toBe(true);
    expect(describeLineupCommitment(undefined, undefined).hasFormCards).toBe(false);
  });
});

describe("Der Riegel ist scharf gestellt", () => {
  const service = read("lib/lineups/legacy-lineup-local-service.ts");
  const route = read("app/api/lineups/legacy/route.ts");
  const client = read("app/foundation/legacy-lineup-lab/LegacyLineupLabClient.tsx");

  /**
   * Die Sperre gegen Ueberschreiben gab es laengst — sie wurde nur nie ausgeloest, weil JEDES
   * Speichern `submitted` schrieb und das nicht auf der Sperrliste steht.
   */
  it("die Pruefung auf locked/resolved existiert weiterhin", () => {
    expect(service).toContain('["locked", "resolved"].includes(existing.status)');
  });

  it("das Speichern kann den Draft jetzt auf locked setzen", () => {
    expect(service).toContain('status: options?.lockMatchday ? "locked" : "submitted"');
  });

  /**
   * Skripte und Simulationen duerfen NICHT sperren — ein Lauf koennte sonst seinen eigenen
   * zweiten Spieltag nicht mehr schreiben. Die Sperre setzt allein die Spieler-Route.
   */
  it("nur die Spieler-Route sperrt", () => {
    expect(route).toContain("{ lockMatchday: true }");
    const otherCallers = read("scripts/multi-season-smoke.ts");
    expect(otherCallers).not.toContain("lockMatchday");
  });

  it("die Route speichert erst nach ausdruecklicher Bestaetigung", () => {
    expect(route).toContain("lineup_lock_confirmation_required");
    expect(route).toContain("if (!body.confirmLock)");
    // Und sie meldet zurueck, WAS eingesetzt wird — sonst kann die Oberflaeche nicht
    // unterscheiden, wie deutlich sie fragen muss.
    expect(route).toContain("describeLineupCommitment(body.entries, body.modifiers)");
    expect(route).toContain("commitment,");
  });

  it("die Oberflaeche fragt nach und speichert erst danach", () => {
    expect(client).toContain('payload.error === "lineup_lock_confirmation_required"');
    expect(client).toContain("putLineup(true)");
    // Abbruch darf NICHT speichern.
    expect(client).toContain("if (!confirmed) {");
    // Der leere Fall bekommt den deutlicheren Text.
    expect(client).toContain("WEDER eine Formkarte NOCH einen Kapitän");
  });
});
