import { describe, expect, it } from "vitest";

import {
  ARCHETYPES,
  WACHSTUM,
  archetypeById,
  ausSpanne,
  type Archetype,
  type Spanne,
} from "@/lib/battle/archetype-registry";

// Diese Datei ist eine Abschrift von Klassenkarten. Ein Test kann nicht pruefen, ob ich
// richtig abgeschrieben habe — dafuer muesste er die Karte kennen. Was er pruefen kann,
// ist die Regel, die ALLE Karten gemeinsam erfuellen. Bricht eine neue Karte sie, ist
// entweder mein Uebertrag falsch oder die Regel gilt nicht mehr; beides will ich sehen.

const WERTE: readonly (keyof Pick<Archetype, "hp" | "atk" | "def" | "spd">)[] = ["hp", "atk", "def", "spd"];

describe("Archetypen-Verzeichnis", () => {
  it("vergibt jede Kennung genau einmal", () => {
    const ids = ARCHETYPES.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("fuehrt jede Kennung in Kleinbuchstaben mit Bindestrich", () => {
    for (const a of ARCHETYPES) {
      expect(a.id, `${a.name} hat eine ungewoehnliche Kennung`).toMatch(/^[a-z][a-z0-9-]*$/);
    }
  });

  it("findet jeden Archetyp ueber seine Kennung", () => {
    for (const a of ARCHETYPES) {
      expect(archetypeById(a.id)).toBe(a);
    }
    expect(archetypeById("gibtesnicht")).toBeUndefined();
  });

  // Der eigentliche Befund: ueber alle Karten und alle vier Werte gilt
  // max = round(min * 13/7). Die Spanne ist damit keine Balance-Entscheidung je
  // Klasse, sondern eine gemeinsame Wachstumskurve.
  it("haelt bei jeder Spanne max = round(min * 13/7) ein", () => {
    const abweichungen: string[] = [];
    for (const a of ARCHETYPES) {
      for (const w of WERTE) {
        const [min, max] = a[w] as Spanne;
        const erwartet = Math.round(min * WACHSTUM);
        // Eine Einheit Spielraum: die Karte schneidet den Startwert auf eine ganze
        // Zahl ab, rechnet aber mit dem Kommawert. Genau daher kommt die einzige
        // Abweichung im Bestand (Blackguard Verteidigung 59 -> 111 statt 110).
        if (Math.abs(max - erwartet) > 1) {
          abweichungen.push(`${a.name} ${w}: ${min} -> erwartet ${erwartet}, eingetragen ${max}`);
        }
      }
    }
    expect(abweichungen).toEqual([]);
  });

  // Erst stand hier die Namensliste der Grenzfaelle. Das hielt genau eine Lieferung:
  // mit Karte 11 bis 35 kamen fuenf weitere dazu, und der Test meldete Erfolg oder
  // Misserfolg allein danach, ob ich die Liste nachgepflegt hatte. Die Zusage, auf die
  // es ankommt, ist eine andere — ein Grenzfall darf NIE mehr als eins danebenliegen,
  // und er muss die Ausnahme bleiben. Beides ueberlebt jede weitere Karte.
  it("laesst Grenzfaelle nie um mehr als eins abweichen und haelt sie in der Minderheit", () => {
    const knapp = ARCHETYPES.flatMap((a) =>
      WERTE.filter((w) => {
        const [min, max] = a[w] as Spanne;
        return max !== Math.round(min * WACHSTUM);
      }).map((w) => `${a.name} ${w}`),
    );
    const spannen = ARCHETYPES.length * WERTE.length;
    expect(knapp.length / spannen, `${knapp.length} von ${spannen} Spannen: ${knapp.join(", ")}`).toBeLessThan(0.2);
  });

  it("haelt jede Spanne aufsteigend und positiv", () => {
    for (const a of ARCHETYPES) {
      for (const w of WERTE) {
        const [min, max] = a[w] as Spanne;
        expect(min, `${a.name} ${w} Startwert`).toBeGreaterThan(0);
        expect(max, `${a.name} ${w} Endwert`).toBeGreaterThan(min);
      }
    }
  });

  it("haelt die Widerstaende zwischen 0 und 100 Prozent", () => {
    for (const a of ARCHETYPES) {
      for (const [feld, wert] of [
        ["stunResist", a.stunResist],
        ["knockbackResist", a.knockbackResist],
      ] as const) {
        expect(wert, `${a.name} ${feld}`).toBeGreaterThanOrEqual(0);
        expect(wert, `${a.name} ${feld}`).toBeLessThanOrEqual(100);
      }
    }
  });

  it("haelt Mana und Ausdauer samt Regeneration positiv", () => {
    for (const a of ARCHETYPES) {
      expect(a.mana, `${a.name} Mana`).toBeGreaterThan(0);
      expect(a.stamina, `${a.name} Ausdauer`).toBeGreaterThan(0);
      expect(a.manaRegen, `${a.name} Mana-Regeneration`).toBeGreaterThan(0);
      expect(a.staminaRegen, `${a.name} Ausdauer-Regeneration`).toBeGreaterThan(0);
    }
  });

  it("kennt nur die Rollen der Karten", () => {
    const erlaubt = new Set(["DPS", "TANK", "HYBRID", "CONTROLLER", "SUPPORT", "ASSASSIN"]);
    for (const a of ARCHETYPES) {
      expect(erlaubt.has(a.role), `${a.name} hat die Rolle ${a.role}`).toBe(true);
    }
  });

  // Die Kits reicht Chris spaeter nach. Bis dahin sollen sie sichtbar leer sein und
  // nicht heimlich mit Platzhaltern gefuellt — sonst misst die Arena wieder Erfundenes.
  it("laesst die Klassenkits leer, solange sie nicht vorliegen", () => {
    for (const a of ARCHETYPES) {
      expect(a.kit, `${a.name} hat ein Kit, obwohl noch keines vorliegt`).toEqual([]);
    }
  });

  describe("ausSpanne", () => {
    it("gibt an den Enden genau die Kartenwerte", () => {
      const s: Spanne = [100, 186];
      expect(ausSpanne(s, 0)).toBe(100);
      expect(ausSpanne(s, 1)).toBe(186);
    });

    it("begrenzt Anteile ausserhalb von 0 bis 1", () => {
      const s: Spanne = [100, 186];
      expect(ausSpanne(s, -5)).toBe(100);
      expect(ausSpanne(s, 42)).toBe(186);
    });

    it("liegt in der Mitte auf der Mitte", () => {
      expect(ausSpanne([100, 200], 0.5)).toBe(150);
    });
  });
});
