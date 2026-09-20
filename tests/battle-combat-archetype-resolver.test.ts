import { describe, expect, it } from "vitest";

import { ARCHETYPES } from "@/lib/battle/archetype-registry";
import {
  bestimmeBreitenBucket,
  bestimmeKampfArchetyp,
  STANDARD_ARCHETYP_ID,
  type SpielerFuerArchetypAufloesung,
} from "@/lib/battle/combat-archetype-resolver";

// Backlog #156, Schritt 1 — die Bruecke Klasse+Unterklasse+Traits -> genau EIN Kampf-
// Archetyp. Diese Tests pruefen die Vertragseigenschaften (deterministisch, dokumentierter
// Default, kein RNG), nicht ob eine einzelne Zuordnung "richtig" ist — das entscheidet
// subclass-archetypes.ts/player-generator-archetypes.ts, nicht dieser Test.

const ARCHETYP_NAMEN = new Set(ARCHETYPES.map((a) => a.name));

function spieler(teil: Partial<SpielerFuerArchetypAufloesung>): SpielerFuerArchetypAufloesung {
  return { className: "", subclasses: [], traitsPositive: [], traitsNegative: [], ...teil };
}

describe("bestimmeKampfArchetyp", () => {
  it("ist deterministisch — derselbe Spieler liefert immer dasselbe Ergebnis", () => {
    const p = spieler({ className: "Rogue", subclasses: ["Assassin"], traitsPositive: ["Cool"], traitsNegative: ["Devious"], name: "Testperson" });
    const a = bestimmeKampfArchetyp(p);
    for (let i = 0; i < 20; i++) {
      const b = bestimmeKampfArchetyp(p);
      expect(b.archetype.id).toBe(a.archetype.id);
      expect(b.breiterBucket).toBe(a.breiterBucket);
    }
  });

  it("liefert immer einen echten, bekannten Archetyp", () => {
    const faelle: SpielerFuerArchetypAufloesung[] = [
      spieler({ className: "Rogue", subclasses: ["Assassin"] }),
      spieler({ className: "Tank", subclasses: ["Guardian"] }),
      spieler({ className: "Mage", subclasses: ["Mage"] }),
      spieler({ className: "Unbekannt", subclasses: ["Klasse"] }), // Datenrest, keine Zuordnung
      spieler({}), // ganz ohne Angaben
    ];
    for (const f of faelle) {
      const r = bestimmeKampfArchetyp(f);
      expect(ARCHETYP_NAMEN.has(r.archetype.name)).toBe(true);
    }
  });

  it("faellt auf STANDARD_ARCHETYP_ID zurueck, wenn die Kandidatenmenge leer ist — dokumentiert, nicht still", () => {
    // "Klasse" ist der Datenrest aus subclass-archetypes.ts ohne jede Zuordnung.
    const r = bestimmeKampfArchetyp(spieler({ className: "Irgendwas", subclasses: ["Klasse"] }));
    expect(r.fallback).toBe(true);
    expect(r.archetype.id).toBe(STANDARD_ARCHETYP_ID);
  });

  it("braucht bei genau einem Kandidaten keinen Bucket-Vergleich (trivialer Fall)", () => {
    // "Assassin" hat laut subclass-archetypes.ts genau zwei Kandidaten (Rogue, Voidfist) —
    // "Aquatic" dagegen nur einen (Stormhorn, Ice Mage sind zwei -> nimm eine wirklich
    // einwertige Unterklasse: keine im Datensatz hat nur einen Eintrag ausser durch
    // Bildbefund. Bildbefund "Jorund" hat genau einen: Matriarch.
    const r = bestimmeKampfArchetyp(
      spieler({ className: "Irgendwas", subclasses: ["Vigilante", "Royalty", "Guardian"], name: "Jorund" }),
    );
    expect(r.archetype.name).toBe("Matriarch");
    expect(r.fallback).toBe(false);
  });

  it("waehlt innerhalb einer Kandidatenmenge nach Bucket-Aehnlichkeit, nicht nach Listenposition", () => {
    // Unterklasse "Trickster" -> [Rogue, Conjurer, Astralwing]. Ein Spieler mit klar
    // rogue-typischer Klasse/Traits sollte NICHT den ersten Listeneintrag automatisch
    // bekommen, sondern denjenigen mit dem hoechsten spd/niedrigsten hp-Profil (Rogue
    // selbst ist zufaellig auch der erste Eintrag hier — das Beispiel unten prueft den
    // GEGENFALL: eine Mage-typische Reihe muss vom ersten Eintrag WEGgehen).
    const magier = spieler({ className: "Mage", subclasses: ["Trickster"], traitsPositive: ["Disciplined"] });
    const r = bestimmeKampfArchetyp(magier);
    // Bucket "mage" hat KEIN spd/atk-Uebergewicht fuer Rogue — Conjurer/Astralwing sind
    // die thematisch naeherliegenden Zauberer unter den drei Trickster-Kandidaten.
    expect(["Conjurer", "Astralwing"]).toContain(r.archetype.name);
  });

  it("gibt Kandidaten in stabiler Reihenfolge zurueck (fuer Nachvollziehbarkeit im PR)", () => {
    const r = bestimmeKampfArchetyp(spieler({ className: "X", subclasses: ["Warrior"] }));
    expect(r.kandidaten).toEqual(["fighter", "orc-warrior", "barbarian", "steelwind"]);
  });
});

describe("bestimmeBreitenBucket", () => {
  it("bevorzugt eine ausdrueckliche preferredClasses-Uebereinstimmung", () => {
    const r = bestimmeBreitenBucket(spieler({ className: "Tank", subclasses: [] }));
    expect(r.bucket).toBe("tank");
    expect(r.score).toBeGreaterThan(0);
  });

  it("faellt bei komplett leeren/unbekannten Angaben auf den dokumentierten Default 'warrior' zurueck", () => {
    const r = bestimmeBreitenBucket(spieler({ className: "Ganz Unbekannt", subclasses: ["Auch Unbekannt"] }));
    expect(r.bucket).toBe("warrior");
    expect(r.score).toBe(0);
  });

  it("bestraft eine disallowedClasses-Uebereinstimmung staerker als ein einzelnes Trait sie ausgleichen kann", () => {
    // "Tank" ist bei rogue/ninja disallowedClasses (-6) — ein einzelnes preferredPositiveTraits-
    // Trait (+1) darf das nicht aufwiegen.
    const r = bestimmeBreitenBucket(spieler({ className: "Tank", subclasses: ["Assassin"], traitsPositive: ["Cool"] }));
    expect(r.bucket).not.toBe("rogue");
    expect(r.bucket).not.toBe("ninja");
  });
});
