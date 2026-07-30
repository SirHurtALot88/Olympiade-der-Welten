import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";

import { describe, expect, it } from "vitest";

import { NlFieldRaceFormStrip } from "@/components/foundation/new-look/NlFieldRaceFormStrip";
import {
  getFieldRaceRecentForm,
  getFieldRaceSeasonForm,
  type FieldRaceLedger,
  type FieldRaceLedgerEntry,
} from "@/lib/foundation/build-field-race-ledger";

function entry(partial: Partial<FieldRaceLedgerEntry> & { matchdayNumber: number }): FieldRaceLedgerEntry {
  return {
    matchdayId: `md-${partial.matchdayNumber}`,
    matchdayNumber: partial.matchdayNumber,
    played: partial.played ?? true,
    tagespunkte: partial.tagespunkte ?? 0,
    tagesrang: partial.tagesrang ?? null,
    cumulativePoints: partial.cumulativePoints ?? 0,
    cumulativeRank: partial.cumulativeRank ?? null,
    rankDeltaVsPrev: partial.rankDeltaVsPrev ?? null,
  } as FieldRaceLedgerEntry;
}

const TEN_MATCHDAYS = Array.from({ length: 10 }, (_, index) =>
  entry({
    matchdayNumber: index + 1,
    tagespunkte: index + 1,
    tagesrang: 32 - index,
    cumulativeRank: 20 - index,
    rankDeltaVsPrev: index === 0 ? null : 1,
  }),
);

const ledger = {
  seasonId: "season-1",
  matchdays: [],
  rowsByTeamId: new Map([["C-C", [...TEN_MATCHDAYS, entry({ matchdayNumber: 11, played: false })]]]),
} as unknown as FieldRaceLedger;

/**
 * Der Form-Strip zeigte ein Fenster der letzten fuenf Spieltage ("Form · letzte
 * 5"). Am zehnten Spieltag war damit die halbe Saison unsichtbar, obwohl der
 * Verlauf genau das ist, was der Strip beantworten soll.
 */
describe("Feld-Form-Strip: ganze Saison statt der letzten fuenf", () => {
  it("liefert alle GEWERTETEN Spieltage — und nur die", () => {
    const form = getFieldRaceSeasonForm(ledger, "C-C");
    expect(form.map((row) => row.matchdayNumber)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    // Spieltag 11 ist geplant, aber nicht gewertet — er gehoert nicht in die Form.
    expect(form.some((row) => !row.played)).toBe(false);
  });

  it("liefert fuer ein unbekanntes Team eine leere Liste statt zu werfen", () => {
    expect(getFieldRaceSeasonForm(ledger, "gibt-es-nicht")).toEqual([]);
  });

  it("laesst das alte Fenster fuer andere Verbraucher unangetastet", () => {
    expect(getFieldRaceRecentForm(ledger, "C-C", 5).map((row) => row.matchdayNumber)).toEqual([6, 7, 8, 9, 10]);
  });

  it("rendert alle zehn Kacheln", () => {
    const html = renderToStaticMarkup(
      createElement(NlFieldRaceFormStrip, { entries: getFieldRaceSeasonForm(ledger, "C-C") }),
    );
    for (const matchday of [1, 5, 10]) {
      expect(html).toContain(`S${matchday}`);
    }
    // Exakt die Kachel-Klasse zaehlen — `nl-form-strip-days` (die Liste) traegt
    // sie als Teilzeichenkette und wuerde sonst mitgezaehlt.
    expect(html.match(/class="nl-form-strip-day"/g)?.length).toBe(10);
    // Die Beschriftung darf keine Fensterbreite mehr behaupten.
    expect(html).toContain("Form · Saison");
    expect(html).not.toContain("letzte 5");
  });
});

/**
 * „hinter den akt punkten noch den spieltags rang also 8,7 #6"
 */
describe("Feld-Form-Strip: Tagesrang hinter den Tagespunkten", () => {
  it("stellt Punkte und Rang in dieselbe Zeile", () => {
    const html = renderToStaticMarkup(
      createElement(NlFieldRaceFormStrip, {
        entries: [
          entry({ matchdayNumber: 1, tagespunkte: 8.7, tagesrang: 6, rankDeltaVsPrev: 3 }),
          entry({ matchdayNumber: 2, tagespunkte: 3.9, tagesrang: 24, rankDeltaVsPrev: -1 }),
        ],
      }),
    );
    expect(html).toContain("8,7");
    expect(html).toContain("#6");
    expect(html).toContain("#24");
    // In EINER Zeile, nicht als weitere Kachelzeile darunter.
    expect(html.match(/nl-form-strip-value/g)?.length).toBe(2);
  });

  it("erfindet keinen Rang, wenn keiner vorliegt", () => {
    const html = renderToStaticMarkup(
      createElement(NlFieldRaceFormStrip, {
        entries: [
          entry({ matchdayNumber: 1, tagespunkte: 8.7, tagesrang: null, rankDeltaVsPrev: 1 }),
          entry({ matchdayNumber: 2, tagespunkte: 3.9, tagesrang: null, rankDeltaVsPrev: 1 }),
        ],
      }),
    );
    expect(html).toContain("8,7");
    expect(html).not.toContain("nl-form-strip-rank");
    expect(html).not.toContain("#");
  });

  it("laesst die Rang-BEWEGUNG daneben bestehen — sie beantwortet etwas anderes", () => {
    const html = renderToStaticMarkup(
      createElement(NlFieldRaceFormStrip, {
        entries: [
          entry({ matchdayNumber: 1, tagespunkte: 8.7, tagesrang: 6, rankDeltaVsPrev: 3 }),
          entry({ matchdayNumber: 2, tagespunkte: 3.9, tagesrang: 24, rankDeltaVsPrev: -1 }),
        ],
      }),
    );
    // #6 ist der Rang AN diesem Spieltag, +3 die Veraenderung des Gesamtrangs.
    expect(html).toContain("nl-form-strip-delta");
    expect(html).toContain("+3");
  });
});
