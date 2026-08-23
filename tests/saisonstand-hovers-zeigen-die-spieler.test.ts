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
  buildGehaltHover,
  buildMarktwertHover,
  buildTeamHover,
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
