import { describe, expect, it } from "vitest";

import { ARCHETYPES } from "@/lib/battle/archetype-registry";
import {
  ZUORDNUNGEN,
  archetypenFuer,
  poolBreite,
  zuordnungVon,
} from "@/lib/battle/subclass-archetypes";

// Diese Datei ist eine ZUORDNUNG, keine Messung — ob "Behemoth" wirklich ein
// Bullbreaker ist, kann kein Test entscheiden. Was er entscheiden kann: dass jede
// genannte Kennung existiert, dass nichts doppelt oder verwaist ist, und dass die
// Regel eingehalten wird, die Chris vorgegeben hat — im Zweifel MEHRERE zuweisen.

const ARCHETYP_NAMEN = new Set(ARCHETYPES.map((a) => a.name));

describe("Unterklasse zu Archetyp", () => {
  it("nennt jede Unterklasse genau einmal", () => {
    const u = ZUORDNUNGEN.map((z) => z.unterklasse);
    expect(new Set(u).size).toBe(u.length);
  });

  // Der wichtigste Test der Datei: ein Tippfehler im Archetypnamen faellt sonst nicht
  // auf, er laesst den Archetyp beim Aufloesen bloss lautlos verschwinden.
  it("verweist nur auf Archetypen, die es gibt", () => {
    const unbekannt: string[] = [];
    for (const z of ZUORDNUNGEN) {
      for (const a of z.archetypen) if (!ARCHETYP_NAMEN.has(a)) unbekannt.push(`${z.unterklasse} -> ${a}`);
    }
    expect(unbekannt).toEqual([]);
  });

  it("nennt keinen Archetyp zweimal in derselben Unterklasse", () => {
    for (const z of ZUORDNUNGEN) {
      expect(new Set(z.archetypen).size, `${z.unterklasse}`).toBe(z.archetypen.length);
    }
  });

  // Ein Archetyp, den keine Unterklasse erreicht, kaeme im Spiel nie vor. Dann waere
  // entweder die Zuordnung unvollstaendig oder die Karte ueberfluessig — beides will
  // ich sehen, statt es zu uebersehen.
  it("laesst keinen Archetyp unerreichbar", () => {
    const erreicht = new Set(ZUORDNUNGEN.flatMap((z) => z.archetypen));
    const verwaist = [...ARCHETYP_NAMEN].filter((a) => !erreicht.has(a));
    expect(verwaist, `unerreichbar: ${verwaist.join(", ")}`).toEqual([]);
  });

  // Chris' Regel: "wenn du unsicher bist ... müsstest du denen erstmal alle 3
  // zuweisen, dann hätten die potentiell einen größeren skill pool". Eine als `offen`
  // markierte Unterklasse mit nur EINEM Archetyp waere ein Widerspruch in sich.
  it("gibt jeder offenen Unterklasse mehr als einen Weg", () => {
    for (const z of ZUORDNUNGEN) {
      if (z.sicherheit !== "offen") continue;
      if (z.archetypen.length === 0) continue; // bewusst leer, siehe "Klasse"
      expect(z.archetypen.length, `${z.unterklasse} ist offen, hat aber nur einen Archetyp`).toBeGreaterThan(1);
    }
  });

  // Auch ein Namenstreffer bleibt eine Vermutung: der Name sagt nicht, ob ein Hunter
  // mit Bogen oder Armbrust laeuft. Er muss aber vorn stehen.
  it("stellt bei Namensgleichheit den gleichnamigen Archetyp an die erste Stelle", () => {
    for (const z of ZUORDNUNGEN) {
      if (z.sicherheit !== "namensgleich") continue;
      const treffer = z.archetypen.filter((a) => a === z.unterklasse || a.endsWith(" " + z.unterklasse));
      expect(treffer.length, `${z.unterklasse} ist als namensgleich markiert, trifft aber keinen Archetypnamen`).toBeGreaterThan(0);
      expect(z.archetypen[0], `${z.unterklasse}`).toBe(treffer[0]);
    }
  });

  it("begruendet jede Zuordnung", () => {
    for (const z of ZUORDNUNGEN) {
      expect(z.warum.length, `${z.unterklasse} ohne Begruendung`).toBeGreaterThan(20);
    }
  });

  it("findet jede Unterklasse ueber ihren Namen", () => {
    for (const z of ZUORDNUNGEN) expect(zuordnungVon(z.unterklasse)).toBe(z);
    expect(zuordnungVon("Gibtesnicht")).toBeUndefined();
  });

  describe("archetypenFuer", () => {
    it("vereinigt die Wege mehrerer Unterklassen ohne Doppelte", () => {
      // Seraph-11 aus dem Spielstand: Healer, Servant, Guardian.
      const a = archetypenFuer(["Healer", "Servant", "Guardian"]);
      const namen = a.map((x) => x.name);
      expect(new Set(namen).size).toBe(namen.length);
      expect(namen).toContain("Priest");
      expect(namen).toContain("Cleric");
      expect(namen).toContain("Bullbreaker");
    });

    it("haelt die Reihenfolge stabil und stellt den naheliegendsten voran", () => {
      const a = archetypenFuer(["Hunter", "Scout"]);
      expect(a[0]?.name).toBe("Hunter");
      expect(archetypenFuer(["Hunter", "Scout"]).map((x) => x.name))
        .toEqual(archetypenFuer(["Hunter", "Scout"]).map((x) => x.name));
    });

    it("uebergeht unbekannte Unterklassen, statt zu werfen", () => {
      expect(archetypenFuer(["Gibtesnicht"])).toEqual([]);
      expect(archetypenFuer(["Gibtesnicht", "Cleric"]).map((x) => x.name)).toEqual(["Cleric", "Priest"]);
    });

    it("gibt fuer den Datenrest 'Klasse' bewusst nichts zurueck", () => {
      expect(archetypenFuer(["Klasse"])).toEqual([]);
    });

    it("macht den Pool mit jeder weiteren Unterklasse hoechstens groesser", () => {
      const eins = poolBreite(["Warrior"]);
      const zwei = poolBreite(["Warrior", "Guardian"]);
      const drei = poolBreite(["Warrior", "Guardian", "Healer"]);
      expect(zwei).toBeGreaterThanOrEqual(eins);
      expect(drei).toBeGreaterThanOrEqual(zwei);
    });
  });
});
