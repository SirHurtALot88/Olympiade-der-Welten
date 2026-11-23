/**
 * AUSRUESTUNG PHASE 1a: KATALOG UND WUERFEL (22.11., lib/ausruestung/ausruestung-katalog.ts, ausruestung-wuerfel.ts).
 *
 * Der Katalog muss zum Konzept passen (acht Familien, zwoelf Attribute, acht Materialien, Truhen-Tabelle), und der Wuerfel muss aus der
 * SAAT kommen: gleiche Eingabe, gleiche Funde. Ein Neuladen darf nie bessere Werte liefern.
 */
import { describe, expect, it } from "vitest";

import { playerGeneratorAttributeKeys } from "@/lib/player-generator/official-discipline-weights";
import {
  AUSRUESTUNG_ATTRIBUTE,
  DISZIPLIN_FARBE,
  DISZIPLIN_IDS,
  FAMILIEN,
  LAGER_PLAETZE,
  MATERIALIEN,
  MATERIAL_STAPEL_MAX,
  STUFEN,
  TRUHEN,
} from "@/lib/ausruestung/ausruestung-katalog";
import { benenneTeil, erzeugeRng, wirksameChancen, wuerfleAffixe, wuerfleKistenFunde, wuerfleTeil } from "@/lib/ausruestung/ausruestung-wuerfel";
import type { Affix, Seltenheit } from "@/lib/ausruestung/ausruestung-typen";

describe("Katalog", () => {
  it("acht Familien, zwoelf Attribute, acht Materialien, Lager 16, Stapel 10", () => {
    expect(FAMILIEN).toHaveLength(8);
    expect(AUSRUESTUNG_ATTRIBUTE).toHaveLength(12);
    expect([...AUSRUESTUNG_ATTRIBUTE]).toEqual([...playerGeneratorAttributeKeys]);
    expect(MATERIALIEN).toHaveLength(8);
    expect(LAGER_PLAETZE).toBe(16);
    expect(MATERIAL_STAPEL_MAX).toBe(10);
  });

  it("jede Familie bevorzugt zwei Attribute, zusammen sind es alle zwoelf (Konzept 59)", () => {
    const alle = new Set(FAMILIEN.flatMap((f) => f.bevorzugt));
    for (const a of AUSRUESTUNG_ATTRIBUTE) expect(alle.has(a), a).toBe(true);
    for (const f of FAMILIEN) expect(new Set(f.bevorzugt).size).toBe(2);
  });

  it("jedes Material gehoert zu mindestens einer Familie", () => {
    const m = new Set(FAMILIEN.map((f) => f.material));
    // Seil und Kristall/Banner/Linse/Rauchkraut/Eisen/Feder/Leder: Seil ist Bauteil-Material der Schmiede (Phase 3), keine Familie.
    for (const mat of MATERIALIEN.filter((x) => x !== "seil")) expect(m.has(mat), mat).toBe(true);
  });

  it("Stufen: Affixe 1/2/3/4, Wertbereiche und Zerlegen 1/2/4/8 (Konzept 60, 27)", () => {
    expect(STUFEN.standard).toMatchObject({ affixe: 1, wertMin: 2, wertMax: 3, zerlegenTeile: 1 });
    expect(STUFEN.selten).toMatchObject({ affixe: 2, wertMin: 3, wertMax: 5, zerlegenTeile: 2 });
    expect(STUFEN.episch).toMatchObject({ affixe: 3, wertMin: 4, wertMax: 6, zerlegenTeile: 4 });
    expect(STUFEN.legendaer).toMatchObject({ affixe: 4, wertMin: 5, wertMax: 8, zerlegenTeile: 8 });
  });

  it("Truhen-Tabelle: Ruhm 10/20/45, Chancen summieren sich auf 100 (Konzept 52)", () => {
    expect(TRUHEN.holz.ruhm).toBe(10);
    expect(TRUHEN.eisen.ruhm).toBe(20);
    expect(TRUHEN.gold.ruhm).toBe(45);
    for (const t of Object.values(TRUHEN)) expect(Object.values(t.chancen).reduce((a, b) => a + b, 0), t.name).toBe(100);
  });

  it("Phase 1a: nur Material, Standard und Selten; Episch, Legendaer und Signatur fallen nach unten, die Summe bleibt 100", () => {
    for (const art of ["holz", "eisen", "gold"] as const) {
      const c = wirksameChancen(art, { episch: false, legendaer: false, signatur: false });
      expect(c.episch + c.legendaer + c.signatur).toBe(0);
      expect(c.material + c.standard + c.selten).toBe(100);
    }
    const mitAllem = wirksameChancen("gold", { episch: true, legendaer: true, signatur: true });
    expect(mitAllem).toEqual(TRUHEN.gold.chancen);
  });

  it("jede der zwanzig Disziplinen hat eine Farbe", () => {
    expect(DISZIPLIN_IDS).toHaveLength(20);
    for (const d of DISZIPLIN_IDS) expect(["pow", "spe", "men", "soc"]).toContain(DISZIPLIN_FARBE[d]);
  });
});

function anAffix(affixe: Affix[]) {
  return affixe.filter((a): a is Extract<Affix, { art: "attribut" }> => a.art === "attribut");
}

describe("Affix-Wuerfel", () => {
  it("gleiche Saat, gleiche Funde; andere Kistennummer oder anderes Team, andere Funde", () => {
    const c = wirksameChancen("eisen", { episch: false, legendaer: false, signatur: false });
    const a = wuerfleKistenFunde("saat-1", "T-H1", 0, "eisen", c);
    const b = wuerfleKistenFunde("saat-1", "T-H1", 0, "eisen", c);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(JSON.stringify(wuerfleKistenFunde("saat-1", "T-H1", 1, "eisen", c))).not.toBe(JSON.stringify(a));
    expect(JSON.stringify(wuerfleKistenFunde("saat-1", "T-H2", 0, "eisen", c))).not.toBe(JSON.stringify(a));
    expect(JSON.stringify(wuerfleKistenFunde("saat-2", "T-H1", 0, "eisen", c))).not.toBe(JSON.stringify(a));
  });

  it("der Generator ist deterministisch und gleichverteilt genug", () => {
    const r1 = erzeugeRng("x");
    const r2 = erzeugeRng("x");
    for (let i = 0; i < 50; i += 1) expect(r1()).toBe(r2());
    const r = erzeugeRng("y");
    let summe = 0;
    for (let i = 0; i < 5000; i += 1) summe += r();
    expect(summe / 5000).toBeGreaterThan(0.47);
    expect(summe / 5000).toBeLessThan(0.53);
  });

  const STUFEN_LISTE: Seltenheit[] = ["standard", "selten", "episch", "legendaer"];
  for (const s of STUFEN_LISTE) {
    it(`${s}: Anzahl, Wertbereich, kein Attribut doppelt, erstes Affix ist ein Attribut`, () => {
      const rng = erzeugeRng(`pruefung-${s}`);
      for (let i = 0; i < 600; i += 1) {
        const fam = FAMILIEN[i % 8]!.id;
        const affixe = wuerfleAffixe(rng, fam, s);
        expect(affixe.length).toBeGreaterThanOrEqual(Math.max(1, STUFEN[s].affixe - 1));
        expect(affixe.length).toBeLessThanOrEqual(STUFEN[s].affixe);
        expect(affixe[0]!.art).toBe("attribut");
        const attr = anAffix(affixe);
        expect(new Set(attr.map((a) => a.attribut)).size).toBe(attr.length);
        for (const a of attr) {
          // Zweischneidig und eingeschraenkt sind 1,5-mal so gross (gerundet); sonst im Bereich.
          const faktor = a.malus || a.nur ? 1.5 : 1;
          expect(a.wert).toBeGreaterThanOrEqual(Math.round(STUFEN[s].wertMin * faktor));
          expect(a.wert).toBeLessThanOrEqual(Math.round(STUFEN[s].wertMax * faktor));
          if (a.malus) expect(a.malus.wert).toBeLessThan(0);
          if (a.malus) expect(a.malus.attribut).not.toBe(a.attribut);
        }
      }
    });
  }

  it("Standard kennt weder eingeschraenkte noch Pflege-Affixe (ab Selten)", () => {
    const rng = erzeugeRng("standard-art");
    for (let i = 0; i < 1500; i += 1) {
      const affixe = wuerfleAffixe(rng, "helm", "standard");
      for (const a of affixe) {
        expect(a.art).toBe("attribut");
        if (a.art === "attribut") expect(a.nur ?? null).toBeNull();
      }
    }
  });

  it("Quoten ueber viele Wuerfe: zweischneidig ~20 %, ab Selten eingeschraenkt ~15 % und Pflege ~5 %", () => {
    const rng = erzeugeRng("quoten");
    let n = 0, zwei = 0, eing = 0, pflege = 0;
    for (let i = 0; i < 8000; i += 1) {
      for (const a of wuerfleAffixe(rng, "plattenpanzer", "episch")) {
        n += 1;
        if (a.art === "pflege") pflege += 1;
        else if (a.malus) zwei += 1;
        else if (a.nur) eing += 1;
      }
    }
    expect(zwei / n).toBeGreaterThan(0.16);
    expect(zwei / n).toBeLessThan(0.24);
    expect(eing / n).toBeGreaterThan(0.11);
    expect(eing / n).toBeLessThan(0.19);
    // Pflege ist erst ab dem zweiten Affix moeglich, daher unter 5 % aller Affixe.
    expect(pflege / n).toBeGreaterThan(0.02);
    expect(pflege / n).toBeLessThan(0.065);
  });

  it("Attributwahl: ~60 % der Attribut-Affixe liegen auf den zwei bevorzugten der Familie", () => {
    const rng = erzeugeRng("bevorzugt");
    const fam = FAMILIEN.find((f) => f.id === "plattenpanzer")!;
    let n = 0, bev = 0;
    for (let i = 0; i < 6000; i += 1) {
      for (const a of anAffix(wuerfleAffixe(rng, "plattenpanzer", "standard"))) {
        n += 1;
        if (fam.bevorzugt.includes(a.attribut)) bev += 1;
      }
    }
    expect(bev / n).toBeGreaterThan(0.55);
    expect(bev / n).toBeLessThan(0.66);
  });

  it("30 % der hoeheren Funde kommen mit einem Affix weniger als dem Hoechstwert", () => {
    const rng = erzeugeRng("weniger");
    let weniger = 0;
    const n = 4000;
    for (let i = 0; i < n; i += 1) if (wuerfleAffixe(rng, "robe", "episch").length < 3) weniger += 1;
    expect(weniger / n).toBeGreaterThan(0.26);
    expect(weniger / n).toBeLessThan(0.34);
  });

  it("Name: Stufenwort + Familie + Beiname nach dem groessten Affix; Legendaere tragen ihren eigenen Namen", () => {
    expect(
      benenneTeil("plattenpanzer", "episch", [
        { art: "attribut", attribut: "power", wert: 4 },
        { art: "attribut", attribut: "health", wert: 6 },
      ]),
    ).toBe("Verzierter Plattenpanzer des Ochsen");
    expect(benenneTeil("amulett", "legendaer", [{ art: "attribut", attribut: "will", wert: 7 }])).toBe("Herz der Qual");
    const teil = wuerfleTeil(erzeugeRng("n"), "t1", "selten", { quelle: "start" }, "helm");
    expect(teil.name.startsWith("Verstärkter Helm")).toBe(true);
  });

  it("jede Kiste hat drei Funde und mindestens einen Ausruestungs-Fund", () => {
    const c = wirksameChancen("holz", { episch: false, legendaer: false, signatur: false });
    for (let k = 0; k < 400; k += 1) {
      const funde = wuerfleKistenFunde("kistentest", "T-H1", k, "holz", c);
      expect(funde).toHaveLength(3);
      expect(funde.some((f) => f.art === "teil")).toBe(true);
    }
  });

  it("Phase 1a: keine epischen und legendaeren Teile aus Truhen; Gold wirft Material nach den Chancen", () => {
    const c = wirksameChancen("gold", { episch: false, legendaer: false, signatur: false });
    let material = 0, gesamt = 0;
    for (let k = 0; k < 800; k += 1) {
      for (const f of wuerfleKistenFunde("gold", "T-H1", k, "gold", c)) {
        gesamt += 1;
        if (f.art === "teil") expect(["standard", "selten"]).toContain(f.teil.seltenheit);
        else material += 1;
      }
    }
    // Material-Chance Gold 15 + Signatur 5 = 20 %; durch die Mindestens-eine-Ausruestung-Regel etwas darunter.
    expect(material / gesamt).toBeGreaterThan(0.14);
    expect(material / gesamt).toBeLessThan(0.24);
  });
});
