import { describe, expect, it } from "vitest";

import { resolveTeamMutatorPpsBonus } from "@/lib/foundation/player-points-total";

/**
 * DIE MUTATORPUNKTE FEHLTEN IM SAISONSTAND — Chris' Meldungen vom 19.08., zwei Minuten auseinander.
 *
 *   „Nach MD1 hat Z-H Platz 1 im Spieltag geholt, soll in der Saison aber nur 2. sein. das kann ja
 *    gar nicht sein! ich tippe mal darauf es liegt an den Mutatorpunkten!"
 *   „mein Verdacht ist bestaetigt, im Saisonstand sind die Mutatorpunkte mit 0,3 gar nicht drin!"
 *
 * NACHGEMESSEN an seinem Spielstand (Saison 1, Spieltag 8): bei ALLEN 32 Teams war die Differenz
 * zwischen Tabellenpunkten und Ledger-Summe exakt der Mutator-Betrag des Teams.
 *
 *   H-R  100,2 gegen 105,6   Mutator 5,4
 *   L-R   98,5 gegen 103,3   Mutator 4,8
 *   C-S   92,3 gegen  98,0   Mutator 5,7
 *
 * Ligaweit fehlten 101,40 Punkte, und die Tabelle stand an vier Plaetzen falsch (#2/#3 und #4/#5
 * vertauscht).
 *
 * URSACHE: die Spieltagsansicht rechnet je Spieler `pointsAwarded + mutatorPpsBonus`, die
 * Saisontabelle dagegen auf TEAM-Ebene `d1Points + d2Points`. Der Aufschlag steht aber nur am
 * einzelnen Spieler — auf Team-Ebene gibt es ihn nicht, also konnte die Tabelle ihn nie sehen.
 */

type Auftritt = { matchdayResultId: string; teamId: string; mutatorPpsBonus?: number | null };

const AUFTRITTE: Auftritt[] = [
  { matchdayResultId: "md-1", teamId: "Z-H", mutatorPpsBonus: 0.3 },
  { matchdayResultId: "md-1", teamId: "Z-H", mutatorPpsBonus: 0.3 },
  { matchdayResultId: "md-1", teamId: "Z-H", mutatorPpsBonus: null },
  { matchdayResultId: "md-1", teamId: "M-S", mutatorPpsBonus: 0.3 },
  // Anderer Spieltag desselben Teams — darf NICHT mitgezaehlt werden.
  { matchdayResultId: "md-2", teamId: "Z-H", mutatorPpsBonus: 9 },
];

describe("Mutatorpunkte: der Team-Aufschlag eines Spieltags", () => {
  it("summiert nur die Auftritte DIESES Teams an DIESEM Spieltag", () => {
    expect(resolveTeamMutatorPpsBonus({ performances: AUFTRITTE, matchdayResultId: "md-1", teamId: "Z-H" })).toBe(0.6);
    expect(resolveTeamMutatorPpsBonus({ performances: AUFTRITTE, matchdayResultId: "md-1", teamId: "M-S" })).toBe(0.3);
    // Der Neuner aus md-2 darf nirgends auftauchen.
    expect(resolveTeamMutatorPpsBonus({ performances: AUFTRITTE, matchdayResultId: "md-2", teamId: "Z-H" })).toBe(9);
  });

  it("behandelt fehlende Aufschlaege als 0, nicht als Luecke", () => {
    // `null` ist der Normalfall: die meisten Auftritte haben gar keinen Mutator.
    expect(resolveTeamMutatorPpsBonus({ performances: AUFTRITTE, matchdayResultId: "md-1", teamId: "T-T" })).toBe(0);
    expect(resolveTeamMutatorPpsBonus({ performances: [], matchdayResultId: "md-1", teamId: "Z-H" })).toBe(0);
  });

  it("gibt 0 zurueck, wenn es gar keinen gebuchten Spieltag gibt", () => {
    // Ohne Ergebnis-Kennung darf nichts summiert werden — sonst floessen fremde Spieltage ein.
    expect(resolveTeamMutatorPpsBonus({ performances: AUFTRITTE, matchdayResultId: null, teamId: "Z-H" })).toBe(0);
  });

  it("rundet wie das Ledger — sonst laufen die beiden Summen auseinander", () => {
    const viele = Array.from({ length: 3 }, () => ({
      matchdayResultId: "md-1",
      teamId: "A-A",
      mutatorPpsBonus: 0.1,
    }));
    // 0.1 + 0.1 + 0.1 ist in Gleitkomma nicht 0.3.
    expect(resolveTeamMutatorPpsBonus({ performances: viele, matchdayResultId: "md-1", teamId: "A-A" })).toBe(0.3);
  });
});

describe("Die Saisontabelle rechnet den Aufschlag mit", () => {
  it("die Tabellen-Rechenstelle ruft die Bruecke", () => {
    /*
     * Quelltext-Pruefung mit den bekannten Grenzen — aber sie faengt den Fall, um den es geht:
     * jemand baut `pointsDelta` um und laesst den Aufschlag wieder weg.
     */
    const quelle = require("node:fs").readFileSync(
      require("node:path").join(process.cwd(), "lib/standings/standings-preview-engine.ts"),
      "utf8",
    ) as string;
    const ohneKommentare = quelle.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
    expect(ohneKommentare).toContain("resolveTeamMutatorPpsBonus({");
    expect(ohneKommentare).toContain("+ mutatorBonus, 1)");
  });
});
