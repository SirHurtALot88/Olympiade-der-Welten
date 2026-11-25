/**
 * VERTRAGSWERT (Chris 25.11., docs/design/vertragswert-bau-25-11.md, Konzept docs/design/kauf-vertrag-gesamtkonzept-25-11.md Abschnitt 12).
 *
 *  1. Rollen-Etikett raus: kein Code (lib, app, components, scripts, prisma/schema) kennt den alten Feldnamen ausser der Lade-Migration.
 *  2. W nach echtem Jahresplan, nicht linear (front-loaded im 4. von 5 Jahren billiger als linear).
 *  3. Chris' Beispiele: 15 C Angebot / 1 Jahr / 10 C Gehalt; 8 C x 4 Jahre bei 25 C Marktwert.
 *  4. Keine Doppelzaehlung: Restgehalt beim Verkauf und Gehalt beim Halten heben sich auf.
 *  5. Formkarte: ein guenstiger Spieler mit fehlender Farbe bekommt eher 5 Jahre.
 *  6. Vertragsaufloesung durch den Spieler ist guenstiger als der Verkauf mit vollem Restgehalt.
 *  7. Regel-Stempel und Rueckweg.
 *  8. Gelaender „Vertragsenden staffeln“, Erwartung, Charakter.
 */
import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  ausstiegKostetJeJahr,
  erwartungsVerlauf,
  formkartenBeitrag,
  jahresplan,
  MITTLERE_LAENGEN_FAKTOREN,
  staffleVertragsende,
  vertragsCharakter,
  vertragswert,
  waehleLaufzeit,
  type VertragswertSpieler,
} from "@/lib/contracts/vertragswert";
import { verkaufsAbwaegung } from "@/lib/ai/organic-squad/utility";
import { decideAiContractDissolution } from "@/lib/morale/ai-contract-dissolution-service";
import { wirtschaftsRegel, wirtschaftsRegelnFuerNeueSaison } from "@/lib/resolve/wirtschafts-regeln";
import { halteWert } from "@/lib/contracts/vertragswert";
import { recommendContractOfferForPlayer } from "@/lib/market/contract-negotiation-preview";
import { erwartungsVerlauf as erwartung } from "@/lib/contracts/vertragswert";
import { makePlayer } from "./_fixtures/game-entity-fixtures";

const GLEICH = { besser: 0, gleich: 1, schlechter: 0 } as const;

function spieler(o: Partial<VertragswertSpieler> = {}): VertragswertSpieler {
  return {
    marktwert: 25,
    marktgehalt: null,
    leistung: 1,
    bedeutung: 1,
    formkarte: 0,
    geduld: 0.95,
    gewichte: { ...GLEICH },
    rate: 0.12,
    ...o,
  };
}

describe("1. Rollen-Etikett entfernt", () => {
  it("kein Code ausser der Lade-Migration kennt den alten Feldnamen", () => {
    const wurzel = path.resolve(__dirname, "..");
    const alt = "role" + "Tag";
    const funde: string[] = [];
    const erlaubt = new Set([path.join("lib", "contracts", "rollen-etikett-entfernen.ts")]);
    const lauf = (dir: string) => {
      for (const name of fs.readdirSync(path.join(wurzel, dir))) {
        const rel = path.join(dir, name);
        const voll = path.join(wurzel, rel);
        const stat = fs.statSync(voll);
        if (stat.isDirectory()) {
          if (name === "node_modules" || name.startsWith(".")) continue;
          lauf(rel);
        } else if (/\.(ts|tsx|mjs|js|prisma)$/.test(name) && !erlaubt.has(rel)) {
          if (fs.readFileSync(voll, "utf8").includes(alt)) funde.push(rel);
        }
      }
    };
    for (const dir of ["lib", "app", "components", "scripts"]) lauf(dir);
    if (fs.readFileSync(path.join(wurzel, "prisma", "schema.prisma"), "utf8").includes(alt)) funde.push("prisma/schema.prisma");
    expect(funde).toEqual([]);
  });

  it("die Lade-Migration entfernt das Feld aus bestehenden Spielstaenden", async () => {
    const { entferneRollenEtikettNachLaden } = await import("@/lib/contracts/rollen-etikett-entfernen");
    const alt = "role" + "Tag";
    const gs = { rosters: [{ id: "r1", teamId: "A", playerId: "p1", [alt]: "prospect" }, { id: "r2", teamId: "A", playerId: "p2" }] } as never;
    const neu = entferneRollenEtikettNachLaden(gs) as unknown as { rosters: Array<Record<string, unknown>> };
    expect(neu.rosters.every((r) => !(alt in r))).toBe(true);
    // Ohne das Feld bleibt der Spielstand unveraendert (dasselbe Objekt).
    expect(entferneRollenEtikettNachLaden(neu as never)).toBe(neu);
  });
});

describe("2. Jahresplan statt linear", () => {
  it("front-loaded im 4. von 5 Jahren: Ausstieg billiger als linear, back-loaded teurer (Konzept 3.3 b)", () => {
    const front = ausstiegKostetJeJahr(jahresplan(7.21, 5, "front_loaded"));
    const linear = ausstiegKostetJeJahr(jahresplan(7.21, 5, "balanced"));
    const back = ausstiegKostetJeJahr(jahresplan(7.21, 5, "back_loaded"));
    expect(front[3]).toBeCloseTo(10.09, 1);
    expect(linear[3]).toBeCloseTo(14.42, 1);
    expect(back[3]).toBeCloseTo(18.75, 1);
    expect(front[3]!).toBeLessThan(linear[3]!);
    expect(back[3]!).toBeGreaterThan(linear[3]!);
  });

  it("W rechnet die offenen Jahre nach Plan: zwei Restjahre front-loaded sind mehr wert als dieselben Jahre linear", () => {
    const s = spieler({ marktwert: 30, marktgehalt: 8 });
    const front = jahresplan(7.21, 5, "front_loaded").slice(3);
    const linear = jahresplan(7.21, 5, "balanced").slice(3);
    expect(vertragswert(s, front).wert).toBeGreaterThan(vertragswert(s, linear).wert);
  });
});

describe("3. Chris' Beispiele", () => {
  it("15 C Angebot, 1 Jahr Rest, 10 C Gehalt: Kasse +5; bei 12 C Marktwert lohnt der Verkauf, bei 15 C bleibt er (Konzept 3.3 a)", () => {
    const netto = 15 - 10;
    const w12 = vertragswert(spieler({ marktwert: 12 }), [10]).wert;
    const w15 = vertragswert(spieler({ marktwert: 15 }), [10]).wert;
    expect(netto).toBeGreaterThan(w12);
    expect(netto).toBeLessThan(w15);
    // Faellt der Marktwert (15 → schlechter Verlauf), lohnt der Verkauf ebenfalls.
    const wFaellt = vertragswert(spieler({ marktwert: 15, gewichte: { besser: 0, gleich: 0, schlechter: 1 }, rate: 0.27 }), [10]).wert;
    expect(netto).toBeGreaterThan(wFaellt);
  });

  it("8 C x 4 Jahre bei 25 C Marktwert, Angebot 40 C: der Stammspieler bleibt, der Bankspieler geht (Konzept 3.3 c)", () => {
    const netto = 40 - 32;
    const stamm = vertragswert(spieler({ marktwert: 25, bedeutung: 1 }), [8, 8, 8, 8]).wert;
    const bank = vertragswert(spieler({ marktwert: 25, bedeutung: 0.5 }), [8, 8, 8, 8]).wert;
    expect(netto).toBeLessThan(stamm);
    expect(netto).toBeGreaterThan(bank);
  });
});

describe("4. Keine Doppelzaehlung", () => {
  const abw = (gehalt: number) => {
    const plan = [gehalt, gehalt, gehalt];
    const w = vertragswert(spieler({ marktwert: 20 }), plan).wert;
    return verkaufsAbwaegung({
      marktwert: 20,
      preis: 30,
      restgehalt: plan.reduce((a, b) => a + b, 0),
      gehalt,
      leistungsFaktor: 1,
      staerkeVerhaeltnis: 1,
      kaderVorher: 12,
      spieltagsBedarf: 8,
      finanznot: false,
      wWin: 0.5,
      wProfit: 0.1,
      zufall: 0.5,
      vertragswert: w,
    });
  };
  it("ein hoeheres Restgehalt verschiebt den Vorteil nur um den Zeitwert, nicht um das volle Gehalt", () => {
    const a = abw(5);
    const b = abw(8);
    // 3 Jahre je 3 C mehr = 9 C mehr Restgehalt; beim Halten zahlt das Team dieselben 9 C (abgezinst ~8,6 C).
    expect(Math.abs(a.vorteil - b.vorteil)).toBeLessThan(1.5);
    expect(a.vertragswert).not.toBeNull();
    expect(a.gehaltsBilanz).toBe(0);
  });
});

describe("5. Formkarte zaehlt", () => {
  it("ein guenstiger Bankspieler bekommt mit fehlender Kartenfarbe 5 Jahre, ohne Farbbeitrag kurz", () => {
    const gehaltFuer = (laufzeit: number) => 1.6 * MITTLERE_LAENGEN_FAKTOREN[laufzeit]!;
    const ohne = waehleLaufzeit({ spieler: spieler({ marktwert: 6, marktgehalt: 1.6, bedeutung: 0.6, gewichte: { besser: 0.3, gleich: 0.4, schlechter: 0.3 } }), gehaltFuer, formen: ["balanced"] });
    const f = formkartenBeitrag({ spielerFarbe: "green", bedarf: { red: 0.25, green: 0.25, blue: 0.25, yellow: 0.25 }, traegerImKader: { red: 3, green: 0, blue: 4, yellow: 2 } });
    expect(f).toBeCloseTo(1, 5);
    const mit = waehleLaufzeit({
      spieler: spieler({ marktwert: 6, marktgehalt: 1.6, bedeutung: 0.6, formkarte: f, gewichte: { besser: 0.3, gleich: 0.4, schlechter: 0.3 } }),
      gehaltFuer,
      formen: ["balanced"],
    });
    expect(ohne.beste.laufzeit).toBeLessThanOrEqual(2);
    expect(mit.beste.laufzeit).toBe(5);
  });

  it("jeder weitere Traeger derselben Farbe teilt den Beitrag (Grenznutzen)", () => {
    const bedarf = { red: 0.25, green: 0.25, blue: 0.25, yellow: 0.25 };
    const b0 = formkartenBeitrag({ spielerFarbe: "red", bedarf, traegerImKader: { red: 0 } });
    const b1 = formkartenBeitrag({ spielerFarbe: "red", bedarf, traegerImKader: { red: 1 } });
    const b3 = formkartenBeitrag({ spielerFarbe: "red", bedarf, traegerImKader: { red: 3 } });
    expect(b1).toBeCloseTo(b0 / 2, 5);
    expect(b3).toBeCloseTo(b0 / 4, 5);
  });

  it("keine Sperre nach Rolle oder Rang: jede Laufzeit 1 bis 5 ist waehlbar", () => {
    const wahl = waehleLaufzeit({ spieler: spieler(), gehaltFuer: (l) => 6.75 * MITTLERE_LAENGEN_FAKTOREN[l]! });
    expect(new Set(wahl.angebote.map((a) => a.laufzeit))).toEqual(new Set([1, 2, 3, 4, 5]));
  });
});

describe("6. Vertragsaufloesung durch den Spieler", () => {
  it("ist guenstiger als der Verkauf: mit Teilverzicht nimmt die KI an, wo der Verkauf mit vollem Restgehalt nicht lohnt", () => {
    const w = 3;
    const verkaufNetto = 10 - 12;
    expect(verkaufNetto).toBeLessThan(w);
    const entscheidung = decideAiContractDissolution({
      offer: {
        playerId: "p",
        playerName: "P",
        teamId: "A",
        morale: 20,
        salePrice: 10,
        openBuyout: 12,
        waivedBuyout: 7,
        payableBuyout: 5,
        waiverShare: 0.58,
        remainingContractLength: 2,
        previouslyDeclined: false,
      },
      marketValue: 12,
      salary: 6,
      remainingYears: 2,
      purchasePrice: 12,
      qualityShareInTeam: 0.5,
      ratingValue: 12,
      rosterBefore: 12,
      playerMin: 8,
      playerOpt: 12,
      cashBefore: 50,
      renewal: null,
      vertragswert: w,
    });
    expect(entscheidung.decision).toBe("accepted");
    expect(entscheidung.reason).toBe("vertragswert_niedriger");
    const behalten = decideAiContractDissolution({
      ...{ offer: { playerId: "p", playerName: "P", teamId: "A", morale: 20, salePrice: 10, openBuyout: 12, waivedBuyout: 7, payableBuyout: 5, waiverShare: 0.58, remainingContractLength: 2, previouslyDeclined: false } },
      marketValue: 12, salary: 6, remainingYears: 2, purchasePrice: 12, qualityShareInTeam: 0.5, ratingValue: 12, rosterBefore: 12, playerMin: 8, playerOpt: 12, cashBefore: 50, renewal: null,
      vertragswert: 8,
    });
    expect(behalten.decision).toBe("declined");
  });
});

describe("7. Regel-Stempel und Rueckweg", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });
  it("neue Saison: vertragsPlan neu; OLY_KI_VERTRAGSPLAN=aus → alt; ohne verkaufSchwellen → alt", () => {
    expect(wirtschaftsRegelnFuerNeueSaison("season-1").vertragsPlan).toBe("neu");
    vi.stubEnv("OLY_KI_VERTRAGSPLAN", "aus");
    expect(wirtschaftsRegelnFuerNeueSaison("season-1").vertragsPlan).toBe("alt");
    vi.unstubAllEnvs();
    vi.stubEnv("OLY_KI_VERKAUF_SCHWELLEN", "aus");
    expect(wirtschaftsRegelnFuerNeueSaison("season-1").vertragsPlan).toBe("alt");
  });
  it("laufender Spielstand ohne Feld im Stempel rechnet alt; aus-sofort schaltet auch gestempelte Saisons ab", () => {
    const alt = { season: { id: "season-2" }, seasonState: { seasonId: "season-2", wirtschaftsRegeln: { seasonId: "season-2", quote: "neu", anker: "neu", kernschutz: "neu" } } } as never;
    expect(wirtschaftsRegel(alt, "vertragsPlan")).toBe("alt");
    const neu = { season: { id: "season-2" }, seasonState: { seasonId: "season-2", wirtschaftsRegeln: { ...wirtschaftsRegelnFuerNeueSaison("season-2"), vertragsPlan: "neu" } } } as never;
    expect(wirtschaftsRegel(neu, "vertragsPlan")).toBe("neu");
    vi.stubEnv("OLY_KI_VERTRAGSPLAN", "aus-sofort");
    expect(wirtschaftsRegel(neu, "vertragsPlan")).toBe("alt");
    expect(wirtschaftsRegelnFuerNeueSaison("season-3").vertragsPlan).toBe("alt");
  });
});

describe("8. Gelaender, Erwartung, Charakter", () => {
  it("hoechstens 40 % der Vertraege enden in derselben Saison", () => {
    const endeFuer = (l: number) => 2 + l - 1;
    const enden = new Map([[3, 4], [4, 1]]);
    // 10 Vertraege + 1 neuer: Saison 3 hat schon 4 → 5 > 4,4 → rueckt auf 3 Jahre (Saison 4).
    expect(staffleVertragsende({ laufzeit: 2, endeFuer, endenJeSaison: enden, vertraege: 10 })).toBe(3);
    expect(staffleVertragsende({ laufzeit: 3, endeFuer, endenJeSaison: enden, vertraege: 10 })).toBe(3);
  });
  it("Erwartung: Potenzial und Leistung schieben nach „besser“, schwache Leistung nach „schlechter“", () => {
    expect(erwartungsVerlauf({ potenzialAbstand: 20, leistungsFaktor: 1.4 }).stufe).toBe("besser");
    expect(erwartungsVerlauf({ potenzialAbstand: -20, leistungsFaktor: 0.7 }).stufe).toBe("schlechter");
    const e = erwartungsVerlauf({});
    expect(e.stufe).toBe("gleich");
    expect(e.gewichte.besser + e.gewichte.gleich + e.gewichte.schlechter).toBeCloseTo(1, 9);
  });
  it("Charakter aus GM-Kennzahlen: Bewahrer geduldiger als Sparer, Haendler handelt", () => {
    const bewahrer = vertragsCharakter({ longContractPreference: 9, loyaltyBias: 10, cashPriority: 3 }, { harmony: 9, boardConfidence: 8, finances: 7 });
    const sparer = vertragsCharakter({ cashPriority: 10, wageSensitivity: 9, longContractPreference: 3, loyaltyBias: 3 }, { finances: 2, harmony: 4, boardConfidence: 4 });
    const haendler = vertragsCharakter({ sellForProfitAggression: 10, shortContractPreference: 9 });
    expect(bewahrer.haltung).toBe("bewahrer");
    expect(sparer.haltung).toBe("sparer");
    expect(haendler.haltung).toBe("haendler");
    expect(bewahrer.geduld).toBeGreaterThan(sparer.geduld);
    expect(haendler.handel).toBeGreaterThan(bewahrer.handel);
  });
});

describe("9. Kaufangebot mit Vertragswert", () => {
  const kontext = (o: Partial<VertragswertSpieler> = {}) => ({ spieler: spieler({ marktwert: 30, marktgehalt: 8, ...o }), handel: 0.3, erwartung: erwartung({}), staffel: null });
  it("ab Saison 2 sind alle Laufzeiten 1 bis 5 im Angebot; Kasse eng deckelt auf 2 Jahre und back-loaded", () => {
    const player = makePlayer({ id: "p-lang", name: "Lang", salaryDemand: 8, marketValue: 30, traitsPositive: ["Loyal", "Disciplined"], traitsNegative: [] });
    const frei = recommendContractOfferForPlayer({ player, teamCash: 500, marketValue: 30, isFirstSeason: false, vertragswert: kontext() });
    expect(frei.vertragswertWahl?.angebote.map((a) => a.laufzeit)).toEqual(expect.arrayContaining([1, 2, 3, 4, 5]));
    const eng = recommendContractOfferForPlayer({ player, teamCash: 10, marketValue: 30, isFirstSeason: false, vertragswert: kontext() });
    expect(eng.contractLength).toBeLessThanOrEqual(2);
    if (eng.contractLength >= 2) expect(eng.contractShape).toBe("back_loaded");
    // Saison 1 bleibt beim bisherigen Weg (kein Vertragswert).
    const s1 = recommendContractOfferForPlayer({ player, teamCash: 500, marketValue: 30, isFirstSeason: true, vertragswert: kontext() });
    expect(s1.vertragswertWahl).toBeUndefined();
  });
  it("Halten fuer das Verkaufsurteil ist das Sicherheitsaequivalent (Erwartung minus Risikoabschlag)", () => {
    const p = vertragswert(spieler({ risikoScheu: 0.8, gewichte: { besser: 0.3, gleich: 0.4, schlechter: 0.3 } }), [8, 8, 8]);
    expect(p.risiko).toBeGreaterThan(0);
    expect(halteWert(p)).toBeCloseTo(p.erwartet - p.risiko, 9);
  });
});
