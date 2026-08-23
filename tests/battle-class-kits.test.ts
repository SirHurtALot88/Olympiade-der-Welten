import { describe, expect, it } from "vitest";

import {
  CLASS_KITS,
  SKILL_POOL,
  garantierteSkills,
  kitById,
  skillById,
  skillsVonKit,
} from "@/lib/battle/class-kits";

// Wie beim Archetypen-Verzeichnis: ein Test kann nicht pruefen, ob ich die Karte richtig
// abgeschrieben habe — dafuer muesste er die Karte kennen. Er kann pruefen, dass die
// Datei in sich stimmt und dass die Regeln halten, die beide bisherigen Karten zeigen.

describe("Klassenkits", () => {
  it("vergibt jede Skill-Kennung genau einmal", () => {
    const ids = SKILL_POOL.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("fuehrt jede Kennung in Kleinbuchstaben mit Bindestrich", () => {
    for (const s of SKILL_POOL) {
      expect(s.id, `${s.name} hat eine ungewoehnliche Kennung`).toMatch(/^[a-z][a-z0-9-]*$/);
    }
    for (const k of CLASS_KITS) {
      expect(k.id, `${k.name} hat eine ungewoehnliche Kennung`).toMatch(/^[a-z][a-z0-9-]*$/);
    }
  });

  it("findet jeden Skill und jedes Kit ueber die Kennung", () => {
    for (const s of SKILL_POOL) expect(skillById(s.id)).toBe(s);
    for (const k of CLASS_KITS) expect(kitById(k.id)).toBe(k);
    expect(skillById("gibtesnicht")).toBeUndefined();
    expect(kitById("gibtesnicht")).toBeUndefined();
  });

  // Der Kern der Bauart: ein Kit VERWEIST auf den Pool. Zeigt ein Eintrag ins Leere,
  // faellt der Skill beim Aufloesen still unter den Tisch — genau das soll auffallen.
  it("laesst keinen Kit-Eintrag ins Leere zeigen", () => {
    for (const k of CLASS_KITS) {
      for (const e of k.eintraege) {
        expect(skillById(e.skillId), `${k.name} verweist auf ${e.skillId}`).toBeDefined();
      }
      expect(skillsVonKit(k.id)).toHaveLength(k.eintraege.length);
    }
  });

  it("nennt keinen Skill zweimal im selben Kit", () => {
    for (const k of CLASS_KITS) {
      const ids = k.eintraege.map((e) => e.skillId);
      expect(new Set(ids).size, `${k.name}`).toBe(ids.length);
    }
  });

  // Beide Karten haben GENAU ZWEI garantierte Skills, und Medium Dash ist bei beiden
  // einer davon. Bricht eine neue Karte das, will ich es sehen: dann ist entweder mein
  // Uebertrag falsch oder die Regel gilt nicht allgemein.
  it("gibt jeder Klasse genau zwei garantierte Skills", () => {
    for (const k of CLASS_KITS) {
      expect(garantierteSkills(k.id).map((s) => s.name), `${k.name}`).toHaveLength(2);
    }
  });

  it("laesst jede Klasse ausser dem Dash genau einen eigenen Startskill haben", () => {
    for (const k of CLASS_KITS) {
      const garantiert = garantierteSkills(k.id).map((s) => s.id);
      expect(garantiert, `${k.name} startet ohne Dash`).toContain("medium-dash");
      const eigen = garantiert.filter((id) => id !== "medium-dash");
      expect(eigen, `${k.name} hat ${eigen.length} eigene Startskills`).toHaveLength(1);
    }
  });

  // Der Pool existiert nur, WEIL Klassen sich Skills teilen. Waere das nicht so, waere
  // die ganze Bauart falsch und jedes Kit brauchte eigene Werte.
  it("teilt Skills zwischen den Klassen", () => {
    const zaehler = new Map<string, number>();
    for (const k of CLASS_KITS) {
      for (const e of k.eintraege) zaehler.set(e.skillId, (zaehler.get(e.skillId) ?? 0) + 1);
    }
    const geteilt = [...zaehler.values()].filter((n) => n > 1).length;
    expect(geteilt, "keine zwei Klassen teilen sich einen Skill").toBeGreaterThan(0);
  });

  it("laesst keinen Skill im Pool liegen, den kein Kit fuehrt", () => {
    const benutzt = new Set(CLASS_KITS.flatMap((k) => k.eintraege.map((e) => e.skillId)));
    const verwaist = SKILL_POOL.filter((s) => !benutzt.has(s.id)).map((s) => s.name);
    expect(verwaist).toEqual([]);
  });

  it("haelt jede genannte Zahl positiv", () => {
    for (const s of SKILL_POOL) {
      for (const feld of ["dmg", "heal", "healMaxHpProzent", "selbstHeal", "schild", "range", "knockback", "dauer", "cd", "castzeit", "mp", "sp"] as const) {
        const wert = s[feld];
        if (wert === undefined) continue;
        expect(wert, `${s.name} ${feld}`).toBeGreaterThan(0);
      }
    }
  });

  it("haelt jeden Anteil an den maximalen Lebenspunkten unter 100 Prozent", () => {
    for (const s of SKILL_POOL) {
      if (s.healMaxHpProzent === undefined) continue;
      expect(s.healMaxHpProzent, `${s.name}`).toBeLessThanOrEqual(100);
    }
  });

  it("kennt nur die Raritaeten der Karten", () => {
    const erlaubt = new Set(["Common", "Uncommon", "Rare"]);
    for (const s of SKILL_POOL) {
      expect(erlaubt.has(s.raritaet), `${s.name} hat ${s.raritaet}`).toBe(true);
    }
  });

  // Die garantierten Skills sind auf beiden Karten Common. Ein garantierter Rare waere
  // eine Aussage ueber das System, die bisher keine Karte macht.
  it("laesst keinen garantierten Skill seltener als Common sein", () => {
    for (const k of CLASS_KITS) {
      for (const s of garantierteSkills(k.id)) {
        expect(s.raritaet, `${k.name}: ${s.name}`).toBe("Common");
      }
    }
  });

  it("gibt fuer ein unbekanntes Kit leere Listen statt zu werfen", () => {
    expect(skillsVonKit("gibtesnicht")).toEqual([]);
    expect(garantierteSkills("gibtesnicht")).toEqual([]);
  });
});
