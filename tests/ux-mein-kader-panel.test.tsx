import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { KasseBlock, MeinKaderListe, WirkungAufKader } from "@/app/foundation/shared/MeinKaderPanel";
import {
  baueKaderListe,
  baueKasseDraft,
  baueKasseMarkt,
  baueZaehler,
  groessteSpruenge,
  type EigenerSpieler,
} from "@/app/foundation/shared/mein-kader-daten";
import type { RangWirkung } from "@/lib/market/transfermarkt-kaderstaerke";

/** UX-Umbau 19.11. (PR B): gemeinsames Panel „Mein Kader in ⟨Disziplin⟩“, Wirkung, Kasse als Zahl. */

const sp = (id: string, wert: number | null, extra: Partial<EigenerSpieler> = {}): EigenerSpieler => ({ playerId: id, name: `Spieler ${id}`, className: "Templar", portraitUrl: null, wert, ...extra });
const acht = ["a", "b", "c", "d", "e", "f", "g", "h"].map((id, i) => sp(id, 90 - i * 5));

describe("Mein Kader: Liste nach Eignung, Ausgewählter golden einsortiert", () => {
  it("sortiert die eigenen Spieler nach Eignung, beste zuerst, und nummeriert", () => {
    const { zeilen } = baueKaderListe({ eigene: [sp("x", 50), sp("y", 80), sp("z", 65)], kandidat: null });
    expect(zeilen.map((z) => z.playerId)).toEqual(["y", "z", "x"]);
    expect(zeilen.map((z) => z.platz)).toEqual([1, 2, 3]);
    expect(zeilen.every((z) => !z.neu && !z.raus)).toBe(true);
  });

  it("der Kandidat wird als NEU an seinem Platz einsortiert (Ties: hinter den Eigenen)", () => {
    const { zeilen } = baueKaderListe({
      eigene: [sp("y", 80), sp("z", 65)],
      kandidat: { playerId: "k", name: "Kandidat", className: "Rogue", portraitUrl: null, wert: 65, text: "65" },
    });
    expect(zeilen.map((z) => z.playerId)).toEqual(["y", "z", "k"]);
    expect(zeilen[2]!.neu).toBe(true);
    const oben = baueKaderListe({ eigene: [sp("y", 80)], kandidat: { playerId: "k", name: "K", className: "Rogue", portraitUrl: null, wert: 99, text: "99" } });
    expect(oben.zeilen[0]!.playerId).toBe("k");
  });

  it("Trennlinie nach Platz 6; wer durch den Kandidaten aus den Top 6 rutscht, ist „raus“", () => {
    const ohne = baueKaderListe({ eigene: acht, kandidat: null });
    expect(ohne.trennNach).toBe(6);
    expect(ohne.zeilen.filter((z) => z.zaehltNicht).map((z) => z.playerId)).toEqual(["g", "h"]);
    expect(ohne.zeilen.some((z) => z.raus)).toBe(false);
    const mit = baueKaderListe({ eigene: acht, kandidat: { playerId: "k", name: "K", className: "Rogue", portraitUrl: null, wert: 92, text: "92" } });
    expect(mit.zeilen[0]!.playerId).toBe("k");
    expect(mit.zeilen.find((z) => z.raus)?.playerId).toBe("f");
    expect(mit.zeilen[6]!.playerId).toBe("f");
  });

  it("kommt der Kandidat nicht in die Top 6, verdrängt er niemanden", () => {
    const mit = baueKaderListe({ eigene: acht, kandidat: { playerId: "k", name: "K", className: "Rogue", portraitUrl: null, wert: 10, text: "10" } });
    expect(mit.zeilen.some((z) => z.raus)).toBe(false);
    expect(mit.zeilen.at(-1)!.playerId).toBe("k");
  });

  it("Verletzte stehen unten, zählen nicht und tragen keinen Platz; Spieler ohne Bewertung fehlen", () => {
    const { zeilen } = baueKaderListe({ eigene: [sp("v", 99, { verletzt: true }), sp("g", 70), sp("n", null)], kandidat: null });
    expect(zeilen.map((z) => z.playerId)).toEqual(["g", "v"]);
    expect(zeilen[1]).toMatchObject({ platz: null, zaehltNicht: true, verletzt: true });
  });

  it("Scouting-Nebel: der Kandidat zeigt seine Stufe, sortiert wird nach der Schätzung", () => {
    const { zeilen } = baueKaderListe({ eigene: [sp("y", 85)], kandidat: { playerId: "k", name: "K", className: "Rogue", portraitUrl: null, wert: 84, text: "80-89" } });
    expect(zeilen[1]).toMatchObject({ playerId: "k", text: "80-89", neu: true });
    expect(zeilen[0]!.text).toBe("85");
  });
});

describe("Mein Kader: Zähler als Streifen", () => {
  it("Pflicht 8, Wunsch 11, max 14: belegt, neu, Pflichtplätze, Wunschplätze, frei", () => {
    const z = baueZaehler({ kader: 3, kandidatDazu: true, pflicht: 8, wunsch: 11, max: 14 });
    expect(z.segmente).toEqual(["v", "v", "v", "n", "pf", "pf", "pf", "pf", "op", "op", "op", "l", "l", "l"]);
    expect(z.nachher).toBe(4);
    expect(z.hinweis).toEqual({ art: "pflicht", n: 4 });
  });

  it("ab Pflichtkader kommt der Hinweis auf die Wunschgröße, danach keiner mehr", () => {
    expect(baueZaehler({ kader: 9, kandidatDazu: true, pflicht: 8, wunsch: 11, max: 14 }).hinweis).toEqual({ art: "wunsch", n: 1 });
    expect(baueZaehler({ kader: 11, kandidatDazu: false, pflicht: 8, wunsch: 11, max: 14 }).hinweis).toBeNull();
    expect(baueZaehler({ kader: 9, kandidatDazu: false, pflicht: 8, wunsch: null, max: 14 }).hinweis).toBeNull();
  });
});

describe("Kasse als Zahl mit Balken", () => {
  it("Draft: frei nach Pick und gebundene Reserve", () => {
    const k = baueKasseDraft({ kasse: 214.5, ausgegeben: 110.5, reserve: 38, preis: 65.7, maxAbloese: 176.5 });
    expect(k.freiJetzt).toBe(214.5);
    expect(k.nach).toMatchObject({ art: "ok", gebunden: 38 });
    expect(k.nach!.frei).toBeCloseTo(148.8, 5);
    expect(k.segmente.map((s) => s.art)).toEqual(["aus", "vor", "frei", "res"]);
    expect(k.segmente.reduce((s, x) => s + x.wert, 0)).toBeCloseTo(1, 5);
  });

  it("Draft: sprengt der Preis die Kasse samt Reserve, steht „reicht nicht“ mit dem Fehlbetrag", () => {
    const k = baueKasseDraft({ kasse: 50, ausgegeben: 0, reserve: 20, preis: 40, maxAbloese: 30 });
    expect(k.nach).toMatchObject({ art: "reicht-nicht", fehlt: 10 });
  });

  it("Draft: ohne Auswahl keine „nach“-Zeile", () => {
    expect(baueKasseDraft({ kasse: 50, ausgegeben: 0, reserve: 20, preis: null, maxAbloese: 30 }).nach).toBeNull();
  });

  it("Markt: frei nach Kauf bzw. reicht nicht · es fehlen N", () => {
    const ok = baueKasseMarkt({ frei: 94.6, preis: 60 }).nach!;
    expect(ok.art).toBe("ok");
    expect(ok.frei).toBeCloseTo(34.6, 5);
    const knapp = baueKasseMarkt({ frei: 94.6, preis: 113.5 });
    expect(knapp.nach?.art).toBe("reicht-nicht");
    expect(knapp.nach!.fehlt).toBeCloseTo(18.9, 5);
    expect(knapp.segmente.map((s) => s.art)).toEqual(["vor", "frei", "fehlt"]);
  });
});

describe("Wirkung auf deinen Kader", () => {
  const w = (disziplinId: string, vorher: number, nachherBest: number): RangWirkung => ({ disziplinId, vorher, nachherBest, nachherSchlecht: nachherBest, staerkeVorher: 50, staerkeNachherMitte: 55 });

  it("die drei größten Rangsprünge, absteigend; wer nichts hebt, fehlt", () => {
    const sp3 = groessteSpruenge([w("a", 10, 9), w("b", 16, 10), w("c", 14, 6), w("d", 9, 4), w("e", 5, 5)]);
    expect(sp3.map((x) => x.disziplinId)).toEqual(["c", "b", "d"]);
  });

  it("zeigt „hebt N von 20 Disziplinen“ und Rang vorher → nachher", () => {
    const h = renderToStaticMarkup(createElement(WirkungAufKader, { wirkungen: [w("hockey", 14, 6), w("tdm", 9, 9)], namen: { hockey: "Hockey", tdm: "TDM" } }));
    expect(h).toContain("hebt 1 von 20 Disziplinen");
    expect(h).toContain("Hockey");
    expect(h).toContain("Rang 14. → <i class=\"auf\">6.</i>");
    const leer = renderToStaticMarkup(createElement(WirkungAufKader, { wirkungen: [w("tdm", 9, 9)], namen: { tdm: "TDM" } }));
    expect(leer).toContain("Kein Rang ändert sich");
  });
});

describe("Panel-Markup", () => {
  const liste = (kandidat: boolean) =>
    renderToStaticMarkup(
      createElement(MeinKaderListe, {
        disziplinName: "Hockey",
        eigene: acht,
        kandidat: kandidat ? { playerId: "k", name: "Kelektros", className: "Charger", portraitUrl: null, wert: 92, text: "80-89" } : null,
        kader: 8,
        pflicht: 8,
        wunsch: 11,
        max: 14,
        onProfil: () => undefined,
      }),
    );

  it("Überschrift mit Disziplin, Trennlinie, NEU-Zeile mit Stufe statt exakter Zahl, Zähler 8 → 9", () => {
    const h = liste(true);
    expect(h).toContain("Mein Kader in Hockey");
    expect(h).toContain("ab hier zählt die Eignung nicht mehr zur Kaderstärke");
    expect(h).toContain("NEU · Charger");
    expect(h).toContain("80-89");
    expect(h).toContain("raus aus Top 6");
    expect(h).toContain("8 → 9");
    expect(h).toContain("noch 2 bis zur Wunschgröße deines GM");
  });

  it("ohne Kandidat kein NEU und kein Pfeil; jede Zeile ist ein Profil-Klick", () => {
    const h = liste(false);
    expect(h).not.toContain("NEU");
    expect(h).not.toContain("→");
    expect((h.match(/data-testid="mein-kader-spieler"/g) ?? []).length).toBe(8);
  });

  it("Kasse zeigt frei jetzt und frei nach Pick/Kauf", () => {
    const h = renderToStaticMarkup(createElement(KasseBlock, { kasse: baueKasseDraft({ kasse: 214.5, ausgegeben: 0, reserve: 38, preis: 65.7, maxAbloese: 176.5 }), hinweis: "Reserve", nachLabel: "Pick" }));
    expect(h).toContain("frei jetzt");
    expect(h).toContain("214,5 C");
    expect(h).toContain("frei nach Pick");
    expect(h).toContain("148,8 C · davon 38,0 C gebunden");
    const nein = renderToStaticMarkup(createElement(KasseBlock, { kasse: baueKasseMarkt({ frei: 94.6, preis: 113.5 }), hinweis: "x", nachLabel: "Kauf" }));
    expect(nein).toContain("reicht nicht · es fehlen 18,9 C");
  });
});

describe("Verdrahtung: Draft und Markt nutzen dasselbe Panel", () => {
  const lies = (p: string) => readFileSync(p, "utf8");

  it("beide Seiten binden WirkungAufKader, MeinKaderListe und KasseBlock aus app/foundation/shared", () => {
    for (const p of ["app/foundation/draft-modern/DraftLive.tsx", "app/foundation/transfermarkt-modern/TransfermarktModern.tsx"]) {
      const q = lies(p);
      expect(q, p).toContain("@/app/foundation/shared/MeinKaderPanel");
      expect(q, p).toContain("<WirkungAufKader");
      expect(q, p).toContain("<MeinKaderListe");
      expect(q, p).toContain("<KasseBlock");
    }
  });

  it("Draft: keine Kader-Kacheln und keine Wunschlisten-Zeilen mehr rechts; die Rechnung kommt aus transfermarkt-kaderstaerke", () => {
    const q = lies("app/foundation/draft-modern/DraftLive.tsx");
    expect(q).not.toContain('className="plaetze"');
    expect(q).not.toContain("draft-wunsch-zeile");
    expect(q).toContain("wirkungMitKandidat(");
    expect(lies("app/foundation/draft-modern/LigaDraftSeite.tsx")).toContain("bereiteTeamVor(");
  });

  it("Markt: 20 Balken, „Wege zum Erfolg“ und die alte Wirkungszeile sind aus dem rechten Panel verschwunden", () => {
    const q = lies("app/foundation/transfermarkt-modern/TransfermarktModern.tsx");
    const fokus = q.slice(q.indexOf("function FokusSpieler"));
    expect(fokus).not.toContain("Eignung in 20 Disziplinen");
    expect(fokus).not.toContain('data-testid="tm-wege"');
    expect(fokus).not.toContain("Wege zum Erfolg");
    expect(fokus).not.toContain("<h4>Charakter</h4>");
  });
});
