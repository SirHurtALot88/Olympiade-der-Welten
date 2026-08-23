/**
 * DIE DREI HOVERS IM SAISONSTAND — die Regeln, nicht das Markup.
 *
 * Chris am 23.08.2026: „Können wir bitte diese Hovers auch im Saisonstand einbauen, dass, wenn ich
 * […] mit der Maus über den Marktwert von dem jeweiligen Team gehe, dass ich dann die Spieler
 * dahinter sehe, beim Gehalt dasselbe […] immer absteigend sortiert, dass ich, wenn ich mit der Maus
 * über den Teamnamen gehe, so eine kleine Miniansicht bekomme."
 *
 * Festgehalten wird hier, was ABSICHT ist — vor allem die drei Stellen, an denen die Hovers bewusst
 * weniger oder anders zeigen, als naheliegend wäre:
 *
 *  - höchstens fünf Zeilen, der Rest als Zahl statt als Namensliste;
 *  - ein fehlender Wert ist keine Null: solche Spieler zählen nicht mit, verschwinden aber auch
 *    nicht stillschweigend;
 *  - der Anteil misst sich an der Summe der Zeilen daneben, nicht an der Spaltensumme der Tabelle.
 */
import { describe, expect, it } from "vitest";

import {
  buildGebaeudeHover,
  buildGehaltHover,
  buildMarktwertHover,
  buildSponsorHover,
  buildTeamHover,
  buildTransferHover,
  SAISONSTAND_HOVER_MAX_ZEILEN,
  type SaisonstandHoverSpieler,
} from "@/lib/foundation/saisonstand-team-hover";

function spieler(
  name: string,
  marketValue: number | null,
  salary: number | null,
  extra: Partial<SaisonstandHoverSpieler> = {},
): SaisonstandHoverSpieler {
  return {
    playerId: `p-${name.toLowerCase()}`,
    name,
    className: extra.className ?? "Warlord",
    marketValue,
    salary,
    contractShape: extra.contractShape ?? "standard",
    contractLength: extra.contractLength ?? 3,
    // `??` haette ein ausdrueckliches `null` in die 70 umgebogen — dann prueft der Fall
    // „kein Spieler traegt einen OVR" seine eigene Voraussetzung weg.
    ovr: "ovr" in extra ? (extra.ovr ?? null) : 70,
  };
}

/** Sieben Spieler — genug, damit die Fünf-Zeilen-Grenze wirklich greift. */
function kader(): SaisonstandHoverSpieler[] {
  return [
    spieler("Jorund", 22.18, 4.1),
    spieler("Malagor", 71.04, 12.4, { contractShape: "back_loaded", contractLength: 1, ovr: 100 }),
    spieler("Xelara", 25.5, 5.2),
    spieler("Gronn", 42.3, 9.8, { contractShape: "front_loaded", contractLength: 2, ovr: 92 }),
    spieler("Lulu", 9.91, 2.0, { contractLength: 1 }),
    spieler("Draco", 32.06, 6.6),
    spieler("Krolach", 30.25, 6.0),
  ];
}

describe("Marktwert-Hover", () => {
  it("sortiert absteigend, so wie Chris es verlangt hat", () => {
    const liste = buildMarktwertHover(kader());
    expect(liste.zeilen.map((zeile) => zeile.name)).toEqual([
      "Malagor",
      "Gronn",
      "Draco",
      "Krolach",
      "Xelara",
    ]);
  });

  it("kappt bei fuenf Zeilen und zaehlt den Rest, statt ihn zu verschweigen", () => {
    const liste = buildMarktwertHover(kader());
    expect(liste.zeilen).toHaveLength(SAISONSTAND_HOVER_MAX_ZEILEN);
    expect(liste.weitere).toBe(2);
    // Jorund 22,18 + Lulu 9,91
    expect(liste.weitereSumme).toBe(32.09);
  });

  it("summiert ueber ALLE Spieler, nicht nur die gezeigten", () => {
    const liste = buildMarktwertHover(kader());
    const gezeigt = liste.zeilen.reduce((summe, zeile) => summe + zeile.wert, 0);
    expect(liste.summe).toBeGreaterThan(gezeigt);
    expect(liste.summe).toBe(233.24);
  });

  it("misst den Anteil an dieser Summe — nicht an einer fremden Grundlage", () => {
    const liste = buildMarktwertHover(kader());
    const malagor = liste.zeilen[0]!;
    expect(malagor.anteil).toBeCloseTo(71.04 / 233.24, 4);
  });

  it("behandelt einen fehlenden Marktwert nicht als Null", () => {
    const liste = buildMarktwertHover([spieler("Ohne", null, 3), spieler("Mit", 10, 3)]);
    expect(liste.zeilen.map((zeile) => zeile.name)).toEqual(["Mit"]);
    expect(liste.ohneWert).toBe(1);
    expect(liste.summe).toBe(10);
  });

  it("traegt beim Marktwert KEINE Vertragsform — die gehoert zum Gehalt", () => {
    expect(buildMarktwertHover(kader()).zeilen.every((zeile) => zeile.contractShape === null)).toBe(true);
  });
});

describe("Gehalts-Hover", () => {
  it("sortiert absteigend und nennt Vertragsform und Restlaufzeit", () => {
    const liste = buildGehaltHover(kader());
    expect(liste.zeilen[0]).toMatchObject({ name: "Malagor", wert: 12.4, contractShape: "back_loaded", contractLength: 1 });
    expect(liste.zeilen[1]).toMatchObject({ name: "Gronn", contractShape: "front_loaded" });
    expect(liste.zeilen.map((zeile) => zeile.wert)).toEqual([12.4, 9.8, 6.6, 6, 5.2]);
  });

  it("zaehlt Spieler ohne Gehaltsangabe getrennt", () => {
    const liste = buildGehaltHover([spieler("A", 5, null), spieler("B", 5, 2)]);
    expect(liste.ohneWert).toBe(1);
    expect(liste.summe).toBe(2);
  });
});

describe("Team-Hover", () => {
  it("zeigt Kadergroesse, Ø OVR und die drei wertvollsten Spieler", () => {
    const hover = buildTeamHover(kader());
    expect(hover.kaderGroesse).toBe(7);
    expect(hover.top.map((eintrag) => eintrag.name)).toEqual(["Malagor", "Gronn", "Draco"]);
    expect(hover.ovrSchnitt).toBeCloseTo((100 + 92 + 70 * 5) / 7, 1);
  });

  it("zaehlt auslaufende Vertraege — Restlaufzeit 1 oder weniger", () => {
    // Malagor und Lulu stehen auf 1.
    expect(buildTeamHover(kader()).auslaufend).toBe(2);
  });

  it("laesst den Ø OVR leer, wenn kein Spieler einen traegt", () => {
    const ohne = [spieler("A", 1, 1, { ovr: null })];
    expect(buildTeamHover(ohne).ovrSchnitt).toBeNull();
  });

  it("kommt mit einem leeren Kader zurecht", () => {
    const hover = buildTeamHover([]);
    expect(hover).toMatchObject({ kaderGroesse: 0, ovrSchnitt: null, top: [], auslaufend: 0 });
    expect(buildMarktwertHover([])).toMatchObject({ zeilen: [], weitere: 0, summe: 0, ohneWert: 0 });
  });
});

/* ------------------------------------------------------------------ */
/* Die vier Zahlen-Hovers (Chris: „1-4 auf jeden fall direkt umsetzen") */
/* ------------------------------------------------------------------ */

describe("Sponsor-Hover", () => {
  it("zerlegt die Summe in Basis, Rangbonus und Saisonanteil", () => {
    const zeilen = buildSponsorHover({ sponsorBasis: 54.56, sponsorRank: 3.85, sponsorSeason: 40.44, sponsorTotal: 95 })!;
    expect(zeilen.map((z) => [z.label, z.wert])).toEqual([
      ["Basis", 54.56],
      ["Rangbonus", 3.85],
      ["Saisonanteil", 40.44],
      ["Gesamt", 95],
    ]);
    expect(zeilen[3]?.istSumme).toBe(true);
  });

  it("erfindet keine Summe aus den vorhandenen Teilen", () => {
    // Fehlt `sponsorTotal`, bleibt die Ergebniszeile leer — eine selbst gebildete Summe waere eine
    // ANDERE Zahl als die gespeicherte, und genau solche Zweitrechnungen sind das Problem.
    const zeilen = buildSponsorHover({ sponsorBasis: 10, sponsorRank: 2, sponsorSeason: 3, sponsorTotal: null })!;
    expect(zeilen.find((z) => z.istSumme)?.wert).toBeNull();
  });

  it("erscheint gar nicht, wenn keine einzige Zahl vorliegt", () => {
    expect(buildSponsorHover({ sponsorBasis: null, sponsorRank: null, sponsorSeason: null, sponsorTotal: null })).toBeNull();
  });
});

describe("Transfer-Hover", () => {
  it("trennt Verkaeufe und Kaeufe und nennt die Anzahl", () => {
    const zeilen = buildTransferHover({
      transferSellCount: 5,
      transferSellTotal: 101.5,
      transferBuyCount: 7,
      transferBuyTotal: 145.3,
      transferNet: -43.8,
    })!;
    expect(zeilen[0]).toMatchObject({ label: "Verkäufe", wert: 101.5, notiz: "5 Transfers" });
    // Kaeufe stehen negativ — die Richtung soll ohne Nachdenken stimmen.
    expect(zeilen[1]).toMatchObject({ label: "Käufe", wert: -145.3 });
    expect(zeilen[2]).toMatchObject({ label: "Netto", wert: -43.8, istSumme: true });
  });

  it("schreibt die Einzahl richtig", () => {
    const zeilen = buildTransferHover({
      transferSellCount: 1,
      transferSellTotal: 9,
      transferBuyCount: 0,
      transferBuyTotal: 0,
      transferNet: 9,
    })!;
    expect(zeilen[0]?.notiz).toBe("1 Transfer");
    expect(zeilen[1]?.notiz).toBe("0 Transfers");
  });

  it("erscheint gar nicht ohne jede Zahl", () => {
    expect(
      buildTransferHover({
        transferSellCount: null,
        transferSellTotal: null,
        transferBuyCount: null,
        transferBuyTotal: null,
        transferNet: null,
      }),
    ).toBeNull();
  });
});

describe("Gebaeude-Hover", () => {
  it("zeigt nur gebaute Anlagen mit Unterhalt, teuerste zuerst", () => {
    const zeilen = buildGebaeudeHover([
      { facilityId: "a", label: "Power Gym", level: 2, upkeep: 1.2 },
      { facilityId: "b", label: "Mind Lab", level: 0, upkeep: 0 },
      { facilityId: "c", label: "Arena", level: 3, upkeep: 4.5 },
      { facilityId: "d", label: "Analytics Room", level: 1, upkeep: 0 },
    ]);
    expect(zeilen.map((z) => z.label)).toEqual(["Arena", "Power Gym"]);
  });

  it("liefert eine leere Liste, wenn nichts gebaut ist", () => {
    expect(buildGebaeudeHover([{ facilityId: "a", label: "Power Gym", level: 0, upkeep: 0 }])).toEqual([]);
  });
});
