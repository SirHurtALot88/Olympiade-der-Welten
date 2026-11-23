/**
 * AUSRUESTUNG PHASE 1a: RUHM, KI, SICHTBARKEIT, DELEGATION (22.11.).
 *
 * Ruhm aus Duellpunkten (je Seite genau einmal), Holztruhe fuer den ersten Sieg, Platzierungs-Gold; die KI nutzt dieselben Regeln
 * (und die delegierte KI eines Menschen ebenso); fremde Lager stehen nicht in der Nutzlast an den Browser; der Bereich
 * `ausruestung` ist ein Delegationsbereich; Phase 1a laesst jede andere Stelle des Spielstands unberuehrt (keine Wertung).
 */
import { describe, expect, it } from "vitest";

import { DELEGATION_BEREICHE, DELEGATION_STUFEN, isBereichDelegiert } from "@/lib/foundation/team-delegation";
import { bucheAusruestungNachSpieltag } from "@/lib/ausruestung/ausruestung-spieltag";
import { ausruestungSpieltDieKi, kiAusruestungsRunde, kiWaehleIndex, teilGesamtwert, wunschMaterialien, KI_LAGER_SCHWELLE } from "@/lib/ausruestung/ausruestung-ki";
import { LAGER_PLAETZE } from "@/lib/ausruestung/ausruestung-katalog";
import { leeresTeam, leseTeam, schreibeTeam, sichereAusruestung, legeTeilAb } from "@/lib/ausruestung/ausruestung-lager";
import { buchePlatzierungsGold, bucheRuhmFuerSpieltag, punkteJeTeam, raengeNachPunkten } from "@/lib/ausruestung/ausruestung-ruhm";
import { ausruestungFuerBesitzer, spielstandFuerBrowser, uebernehmeServerAusruestung } from "@/lib/ausruestung/ausruestung-sicht";
import { erzeugeRng, wuerfleTeil } from "@/lib/ausruestung/ausruestung-wuerfel";
import type { Fund, Seltenheit } from "@/lib/ausruestung/ausruestung-typen";
import { IDS, REGEL_BESITZ, mitSpieltag, spielstand } from "./ausruestung-hilfe";

const ENV = {} as Record<string, string | undefined>;

function ohneAusruestung<T extends { ausruestung?: unknown }>(g: T) {
  const { ausruestung: _a, ...rest } = g;
  void _a;
  return rest;
}

describe("Ruhm aus Punkten", () => {
  it("1 Ruhm je Duellpunkt, je Team; die Holztruhe gibt es fuer den ersten Sieg des Spieltags", () => {
    const g = mitSpieltag(spielstand({ gebucht: [] }), IDS[0]!, { "T-H1": [2, 1], "T-K1": [0, 1] }, { d1: ["T-H1"] });
    const n = bucheRuhmFuerSpieltag(g, `mr-${IDS[0]}`);
    expect(leseTeam(n, "T-H1").ruhm).toBe(3);
    expect(leseTeam(n, "T-H1").gutscheine.holz).toBe(1);
    expect(leseTeam(n, "T-K1").ruhm).toBe(1);
    expect(leseTeam(n, "T-K1").gutscheine.holz).toBe(0);
    expect(n.ausruestung!.spieltage).toBe(1);
  });

  it("je Seite genau einmal: ein zweites Buchen (forceReplace) zaehlt nicht doppelt", () => {
    const g = mitSpieltag(spielstand(), IDS[0]!, { "T-H1": [2, 1] }, { d1: ["T-H1"] });
    const einmal = bucheRuhmFuerSpieltag(g, `mr-${IDS[0]}`);
    const zweimal = bucheRuhmFuerSpieltag(einmal, `mr-${IDS[0]}`);
    expect(zweimal).toBe(einmal);
    expect(leseTeam(zweimal, "T-H1").ruhm).toBe(3);
  });

  it("gestaffelte Buchung: erst d1, dann d2 mit derselben Ergebnis-ID; hoechstens eine Holztruhe je Team und Spieltag; der Spieltag zaehlt einmal", () => {
    let g = mitSpieltag(spielstand(), IDS[0]!, { "T-H1": [2, 0] }, { d1: ["T-H1"] });
    // Nur d1 gebucht: d2-Zeilen entfernen.
    const nurD1 = { ...g, seasonState: { ...g.seasonState, disciplineResults: g.seasonState.disciplineResults!.filter((z) => z.disciplineSide === "d1") } };
    const a = bucheRuhmFuerSpieltag(nurD1, `mr-${IDS[0]}`);
    expect(leseTeam(a, "T-H1").ruhm).toBe(2);
    expect(leseTeam(a, "T-H1").gutscheine.holz).toBe(1);
    g = mitSpieltag(a, IDS[0]!, { "T-H1": [2, 3] }, { d1: ["T-H1"], d2: ["T-H1"] });
    const b = bucheRuhmFuerSpieltag(g, `mr-${IDS[0]}`);
    // d1 war schon gebucht; d2 bringt 3 Ruhm, aber keine zweite Holztruhe.
    expect(leseTeam(b, "T-H1").ruhm).toBe(2 + 3);
    expect(leseTeam(b, "T-H1").gutscheine.holz).toBe(1);
    expect(b.ausruestung!.spieltage).toBe(1);
  });

  it("kein Sieg, keine Punkte: nichts wird gebucht, kein Eintrag fuer das Team", () => {
    const g = mitSpieltag(spielstand(), IDS[0]!, { "T-K2": [0, 0] });
    const n = bucheRuhmFuerSpieltag(g, `mr-${IDS[0]}`);
    expect(n.ausruestung!.teams["T-K2"]).toBeUndefined();
  });

  it("Platzierungs-Gold: Platz 1 bis 3 zur Halbzeit und am Ende, je einmal", () => {
    let g = spielstand();
    const punkte: Array<Record<string, [number, number]>> = [
      { "T-H1": [3, 3], "T-H2": [2, 2], "T-K1": [1, 1], "T-K2": [0, 0] },
      { "T-H1": [3, 3], "T-H2": [2, 2], "T-K1": [1, 1], "T-K2": [0, 0] },
      { "T-H1": [0, 0], "T-H2": [0, 0], "T-K1": [0, 0], "T-K2": [0, 0] },
      { "T-H1": [0, 0], "T-H2": [0, 0], "T-K1": [0, 0], "T-K2": [0, 0] },
    ];
    for (let i = 0; i < 4; i += 1) g = mitSpieltag(g, IDS[i]!, punkte[i]!);
    // Halbzeit: zwei von vier Spieltagen gebucht.
    const halb = buchePlatzierungsGold({ ...g, seasonState: { ...g.seasonState, matchdayResults: g.seasonState.matchdayResults!.slice(0, 2) } });
    expect(leseTeam(halb, "T-H1").gutscheine.gold).toBe(1);
    expect(leseTeam(halb, "T-H2").gutscheine.gold).toBe(1);
    expect(leseTeam(halb, "T-K1").gutscheine.gold).toBe(1);
    expect(leseTeam(halb, "T-K2").gutscheine.gold).toBe(0);
    // Noch einmal: nichts doppelt.
    expect(buchePlatzierungsGold(halb)).toBe(halb);
    // Saisonende (alle vier gebucht): ein zweiter Gutschein, der Halbzeit-Anlass bleibt gesperrt.
    const ende = buchePlatzierungsGold({ ...g, ausruestung: halb.ausruestung });
    expect(leseTeam(ende, "T-H1").gutscheine.gold).toBe(2);
    expect(buchePlatzierungsGold(ende)).toBe(ende);
  });

  it("Rang nach Punkten, Gleichstand stabil nach Team-ID", () => {
    const m = new Map([["B", 5], ["A", 5], ["C", 9]]);
    expect([...raengeNachPunkten(m).entries()]).toEqual([["C", 1], ["A", 2], ["B", 3]]);
    const g = mitSpieltag(spielstand(), IDS[0]!, { "T-H1": [1, 1], "T-K1": [2, 2] });
    expect(punkteJeTeam(g).get("T-K1")).toBe(4);
  });
});

describe("Nach dem Spieltag: Hook und Wertungs-Neutralitaet", () => {
  it("ohne Regel (Manager-Modus), mit Notbremse und ohne Ausruestung: derselbe Spielstand, dieselbe Referenz", () => {
    const g = mitSpieltag(spielstand({ gameMode: "manager" }), IDS[0]!, { "T-H1": [2, 1] });
    expect(bucheAusruestungNachSpieltag(g, `mr-${IDS[0]}`, ENV)).toBe(g);
    const b = mitSpieltag(spielstand(), IDS[0]!, { "T-H1": [2, 1] });
    expect(bucheAusruestungNachSpieltag(b, `mr-${IDS[0]}`, { OLY_AUSRUESTUNG: "aus-sofort" })).toBe(b);
    // Ohne Stempel entscheidet der Schalter; mit Stempel gilt die gestempelte Stufe (gebuchte Spieltage behalten sie, der Schalter wirkt ab dem naechsten).
    const ohne = mitSpieltag(spielstand({ ohneStempel: true }), IDS[0]!, { "T-H1": [2, 1] });
    expect(bucheAusruestungNachSpieltag(ohne, `mr-${IDS[0]}`, { OLY_AUSRUESTUNG: "aus" })).toBe(ohne);
    expect(bucheAusruestungNachSpieltag(b, "mr-gibt-es-nicht", ENV)).toBe(b);
  });

  it("Phase 1a beruehrt nichts ausser `ausruestung`: der restliche Spielstand ist Wert fuer Wert gleich (Wertung unberuehrt)", () => {
    const g = mitSpieltag(spielstand(), IDS[0]!, { "T-H1": [2, 1], "T-K1": [3, 3], "T-K2": [1, 0] }, { d1: ["T-K1"] });
    const n = bucheAusruestungNachSpieltag(g, `mr-${IDS[0]}`, ENV);
    expect(n.ausruestung).toBeDefined();
    expect(ohneAusruestung(n)).toEqual(ohneAusruestung(g));
  });

  it("KI-Teams oeffnen Truhen und waehlen; Menschen ohne Delegation fasst die KI nie an", () => {
    // Genug Punkte fuer mehrere Kisten: KI-Team hat 20 Ruhm aus dem Spieltag, der Mensch ebenso.
    const g = mitSpieltag(spielstand(), IDS[0]!, { "T-H1": [10, 10], "T-K1": [10, 10] });
    const n = bucheAusruestungNachSpieltag(g, `mr-${IDS[0]}`, ENV);
    const ki = leseTeam(n, "T-K1");
    expect(ki.kisten).toBeGreaterThanOrEqual(1);
    expect(ki.offeneKiste).toBeNull();
    expect(ki.lager.length + ki.teile).toBeGreaterThan(0);
    // Der Mensch behaelt seinen Ruhm und seinen Gutschein, es wurde nichts geoeffnet.
    const mensch = leseTeam(n, "T-H1");
    expect(mensch.kisten).toBe(0);
    expect(mensch.ruhm).toBe(20);
    expect(mensch.lager).toHaveLength(0);
  });

  it("die Halbautomatik (Ramona) und Voll KI uebernehmen den Bereich `ausruestung`, Voll selbst nicht", () => {
    expect(DELEGATION_BEREICHE).toContain("ausruestung");
    expect(DELEGATION_STUFEN.voll_selbst.ausruestung).toBe("selbst");
    expect(DELEGATION_STUFEN.halbautomatik.ausruestung).toBe("ki");
    expect(DELEGATION_STUFEN.voll_ki.ausruestung).toBe("ki");
    const g = spielstand();
    expect(ausruestungSpieltDieKi(g, "T-K1")).toBe(true);
    expect(ausruestungSpieltDieKi(g, "T-H1")).toBe(false);
    // Ramona (ramona_local) steht ohne Delegationsfeld in der Halbautomatik.
    expect(ausruestungSpieltDieKi(g, "T-H2")).toBe(true);
    const eingestellt = spielstand({ delegationRamona: { stufe: "halbautomatik", bereiche: { ausruestung: "selbst" } } });
    expect(ausruestungSpieltDieKi(eingestellt, "T-H2")).toBe(false);
    expect(isBereichDelegiert(eingestellt.seasonState.teamControlSettings!["T-H2"], "ausruestung")).toBe(false);
  });

  it("die delegierte KI spielt Ramonas Team (Halbautomatik), Chris' Team nicht", () => {
    const g = mitSpieltag(spielstand(), IDS[0]!, { "T-H1": [10, 10], "T-H2": [10, 10] });
    const n = bucheAusruestungNachSpieltag(g, `mr-${IDS[0]}`, ENV);
    expect(leseTeam(n, "T-H2").kisten).toBeGreaterThanOrEqual(1);
    expect(leseTeam(n, "T-H1").kisten).toBe(0);
  });
});

describe("KI-Regeln", () => {
  function teil(id: string, s: Seltenheit, familie = "plattenpanzer" as const) {
    return wuerfleTeil(erzeugeRng(id), id, s, { quelle: "start" }, familie);
  }

  it("Wahl aus drei: Wunschlisten-Material vor hoechster Stufe vor hoechstem Wert", () => {
    const selten: Fund = { art: "teil", teil: teil("a", "selten") };
    const standard: Fund = { art: "teil", teil: teil("b", "standard") };
    const eisen: Fund = { art: "material", material: "eisen", anzahl: 2 };
    const feder: Fund = { art: "material", material: "feder", anzahl: 2 };
    expect(kiWaehleIndex([standard, selten, feder], new Set())).toBe(1);
    expect(kiWaehleIndex([standard, selten, eisen], new Set(["eisen"]))).toBe(2);
    expect(kiWaehleIndex([feder, standard, eisen], new Set())).toBe(1);
    // Gleiche Stufe: der hoehere Gesamtwert gewinnt.
    const a = teil("c", "selten");
    const b = teil("d", "selten");
    const besser = teilGesamtwert(a) >= teilGesamtwert(b) ? 0 : 1;
    expect(kiWaehleIndex([{ art: "teil", teil: a }, { art: "teil", teil: b }, eisen], new Set())).toBe(besser);
  });

  it("Teilwert: Summe aus Affix-Wert mal Matrixgewicht; Abzuege zaehlen negativ; Einschraenkung zaehlt anteilig", () => {
    const plus = { ...teil("p", "standard"), affixe: [{ art: "attribut" as const, attribut: "power" as const, wert: 10 }] };
    const zwei = { ...plus, affixe: [{ art: "attribut" as const, attribut: "power" as const, wert: 10, malus: { attribut: "power" as const, wert: -10 } }] };
    const eng = { ...plus, affixe: [{ art: "attribut" as const, attribut: "power" as const, wert: 10, nur: { disziplin: "tdm" } }] };
    expect(teilGesamtwert(plus)).toBeGreaterThan(teilGesamtwert(eng));
    expect(teilGesamtwert(zwei)).toBeCloseTo(0, 5);
  });

  it("Lager halten: ueber der Schwelle wird das wertloseste Teil zerlegt", () => {
    let g = sichereAusruestung(spielstand(), "s");
    let t = leeresTeam();
    for (let i = 0; i < LAGER_PLAETZE; i += 1) {
      const r = legeTeilAb(t, teil(`l${i}`, i % 2 === 0 ? "standard" : "selten"));
      if (r.ok) t = r.team;
    }
    g = schreibeTeam(g, "T-K1", t);
    const n = kiAusruestungsRunde(g, "T-K1", REGEL_BESITZ);
    expect(leseTeam(n, "T-K1").lager.length).toBeLessThanOrEqual(KI_LAGER_SCHWELLE);
    expect(leseTeam(n, "T-K1").teile).toBeGreaterThan(0);
  });

  it("Wunschliste: zwei Materialien, deterministisch, zu den staerksten Farben der Identitaet", () => {
    const g = spielstand();
    const w = wunschMaterialien(g, "T-K1");
    expect(w).toHaveLength(2);
    expect(wunschMaterialien(g, "T-K1")).toEqual(w);
  });

  it("die KI-Runde ist deterministisch (gleiche Eingabe, gleiche Funde)", () => {
    const g0 = schreibeTeam(sichereAusruestung(spielstand(), "fix"), "T-K1", { ...leeresTeam(), ruhm: 70 });
    const a = kiAusruestungsRunde(g0, "T-K1", REGEL_BESITZ);
    const b = kiAusruestungsRunde(g0, "T-K1", REGEL_BESITZ);
    expect(JSON.stringify(a.ausruestung)).toBe(JSON.stringify(b.ausruestung));
    expect(leseTeam(a, "T-K1").kisten).toBeGreaterThanOrEqual(2);
  });
});

describe("Sichtbarkeit: fremdes Lager nicht in der Nutzlast an den Browser", () => {
  function mitLagern() {
    let g = sichereAusruestung(spielstand(), "geheime-saat");
    for (const id of ["T-H1", "T-H2", "T-K1", "T-K2"]) {
      const r = legeTeilAb({ ...leeresTeam(), ruhm: 7 }, wuerfleTeil(erzeugeRng(id), `teil-${id}`, "selten", { quelle: "start" }, "helm"));
      if (r.ok) g = schreibeTeam(g, id, r.team);
    }
    return g;
  }

  it("Chris sieht nur sein Team, Ramona nur ihres; KI-Teams sieht niemand", () => {
    const g = mitLagern();
    const chris = ausruestungFuerBesitzer(g, "user_local")!;
    expect(Object.keys(chris.teams)).toEqual(["T-H1"]);
    const ramona = ausruestungFuerBesitzer(g, "ramona_local")!;
    expect(Object.keys(ramona.teams)).toEqual(["T-H2"]);
    const fremder = ausruestungFuerBesitzer(g, "irgendwer")!;
    expect(Object.keys(fremder.teams)).toEqual([]);
  });

  it("ohne Sitzung gilt der lokale Besitzer (user_local); die Saat verlaesst den Server nie", () => {
    const g = mitLagern();
    expect(Object.keys(ausruestungFuerBesitzer(g, null)!.teams)).toEqual(["T-H1"]);
    expect(JSON.stringify(spielstandFuerBrowser(g, "user_local"))).not.toContain("geheime-saat");
    // Die fremden Teile (z. B. der Name aus der Saat von T-K1) stehen nicht im JSON des Browsers.
    const text = JSON.stringify(spielstandFuerBrowser(g, "user_local"));
    expect(text).toContain("teil-T-H1");
    for (const fremd of ["teil-T-H2", "teil-T-K1", "teil-T-K2"]) expect(text, fremd).not.toContain(fremd);
  });

  it("kein Spielstand ohne Ausruestung wird angefasst", () => {
    const g = spielstand();
    expect(spielstandFuerBrowser(g, "user_local")).toBe(g);
  });

  it("Speichern aus dem Browser: der Besitz des Servers gilt, nie der des Clients", () => {
    const server = mitLagern();
    const browser = spielstandFuerBrowser(server, "user_local");
    const manipuliert = { ...browser, ausruestung: { ...browser.ausruestung!, teams: { "T-H1": { ...browser.ausruestung!.teams["T-H1"]!, ruhm: 9999 } } } };
    const gespeichert = uebernehmeServerAusruestung(manipuliert, server);
    expect(gespeichert.ausruestung).toBe(server.ausruestung);
    expect(leseTeam(gespeichert, "T-H1").ruhm).toBe(7);
    expect(Object.keys(gespeichert.ausruestung!.teams)).toHaveLength(4);
    // Ein Spielstand ohne Ausruestung auf beiden Seiten bleibt unveraendert.
    const leer = spielstand();
    expect(uebernehmeServerAusruestung(leer, leer)).toBe(leer);
  });
});
