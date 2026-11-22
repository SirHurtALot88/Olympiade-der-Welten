/**
 * AUSRUESTUNG PHASE 1a: LAGER UND TRUHEN (22.11., lib/ausruestung/ausruestung-lager.ts, ausruestung-truhen.ts, ausruestung-aktionen.ts).
 *
 * Lager 16 Plaetze (Teile und Material-Stapel), Stapel bis 10 mit Ueberlauf zu Teilen, Zerlegen 1/2/4/8, Truhen mit Gold-Abstand,
 * Funde VOR der Wahl gespeichert (kein Neuladen fuer bessere Werte), volles Lager.
 */
import { describe, expect, it } from "vitest";

import { wendeAusruestungAktionAn, istAusruestungAktion } from "@/lib/ausruestung/ausruestung-aktionen";
import { GOLD_ABSTAND_SPIELTAGE, LAGER_PLAETZE, MATERIAL_STAPEL_MAX, TRUHEN } from "@/lib/ausruestung/ausruestung-katalog";
import { freiePlaetze, legeMaterialAb, legeTeilAb, leeresTeam, leseTeam, materialAnzahl, schreibeTeam, sichereAusruestung, zerlegeTeil } from "@/lib/ausruestung/ausruestung-lager";
import { oeffneKiste, truhenStatus, verwerfeKiste, waehleFund } from "@/lib/ausruestung/ausruestung-truhen";
import { erzeugeRng, wuerfleTeil } from "@/lib/ausruestung/ausruestung-wuerfel";
import type { Seltenheit, Teil } from "@/lib/ausruestung/ausruestung-typen";
import { REGEL_BESITZ, spielstand } from "./ausruestung-hilfe";

const ENV_AN = {} as Record<string, string | undefined>;

function teil(id: string, s: Seltenheit = "standard"): Teil {
  return wuerfleTeil(erzeugeRng(id), id, s, { quelle: "start" }, "helm");
}

function mitRuhm(ruhm: number, extra: Partial<ReturnType<typeof leeresTeam>> = {}) {
  let g = sichereAusruestung(spielstand(), "test-saat");
  g = schreibeTeam(g, "T-H1", { ...leeresTeam(), ruhm, ...extra });
  return g;
}

describe("Lager", () => {
  it("16 Plaetze: das 17. Teil passt nicht (lager_voll)", () => {
    let t = leeresTeam();
    for (let i = 0; i < LAGER_PLAETZE; i += 1) {
      const r = legeTeilAb(t, teil(`t${i}`));
      expect(r.ok).toBe(true);
      if (r.ok) t = r.team;
    }
    expect(freiePlaetze(t)).toBe(0);
    const voll = legeTeilAb(t, teil("t99"));
    expect(voll).toEqual({ ok: false, grund: "lager_voll" });
  });

  it("Material belegt je Sorte genau einen Platz; Stapel bis 10, der elfte Fund wird zu einem Teil", () => {
    let t = leeresTeam();
    const a = legeMaterialAb(t, "eisen", 8);
    expect(a.ok && a.zuTeilen).toBe(0);
    if (a.ok) t = a.team;
    expect(materialAnzahl(t, "eisen")).toBe(8);
    expect(t.lager).toHaveLength(1);
    const b = legeMaterialAb(t, "eisen", 5);
    expect(b.ok && b.zuTeilen).toBe(3);
    if (b.ok) t = b.team;
    expect(materialAnzahl(t, "eisen")).toBe(MATERIAL_STAPEL_MAX);
    expect(t.teile).toBe(3);
    expect(t.lager).toHaveLength(1);
  });

  it("Material ohne freien Platz und ohne Stapel: lager_voll; mit bestehendem Stapel geht es auch bei vollem Lager", () => {
    let t = leeresTeam();
    const m = legeMaterialAb(t, "leder", 2);
    if (m.ok) t = m.team;
    for (let i = 0; i < LAGER_PLAETZE - 1; i += 1) {
      const r = legeTeilAb(t, teil(`x${i}`));
      if (r.ok) t = r.team;
    }
    expect(freiePlaetze(t)).toBe(0);
    expect(legeMaterialAb(t, "feder", 1)).toEqual({ ok: false, grund: "lager_voll" });
    const r = legeMaterialAb(t, "leder", 2);
    expect(r.ok).toBe(true);
  });

  it("Zerlegen gibt Teile nach Stufe: Standard 1, Selten 2, Episch 4, Legendaer 8", () => {
    for (const [s, erwartet] of [["standard", 1], ["selten", 2], ["episch", 4], ["legendaer", 8]] as const) {
      const x = teil(`z-${s}`, s);
      const r = legeTeilAb(leeresTeam(), x);
      if (!r.ok) throw new Error("kein Platz");
      const z = zerlegeTeil(r.team, x.id);
      expect(z.ok && z.teile).toBe(erwartet);
      if (z.ok) {
        expect(z.team.teile).toBe(erwartet);
        expect(z.team.lager).toHaveLength(0);
      }
    }
    expect(zerlegeTeil(leeresTeam(), "gibt-es-nicht")).toEqual({ ok: false, grund: "teil_unbekannt" });
  });

  it("Teile sind ein Zaehler und kein Lagerplatz", () => {
    const t = { ...leeresTeam(), teile: 500 };
    expect(freiePlaetze(t)).toBe(LAGER_PLAETZE);
  });
});

describe("Truhen: bezahlen und oeffnen", () => {
  it("ohne genug Ruhm geht es nicht, mit genug Ruhm wird bezahlt", () => {
    const arm = mitRuhm(9);
    const s = truhenStatus(arm, "T-H1", "holz");
    expect(s).toMatchObject({ moeglich: false, grund: "kein_ruhm", ruhmFehlt: 1 });
    const r = oeffneKiste(arm, "T-H1", "holz", REGEL_BESITZ);
    expect(r).toMatchObject({ ok: false, grund: "kein_ruhm" });

    const g = mitRuhm(25);
    const ok = oeffneKiste(g, "T-H1", "eisen", REGEL_BESITZ);
    expect(ok.ok).toBe(true);
    if (ok.ok) {
      const t = leseTeam(ok.gameState, "T-H1");
      expect(t.ruhm).toBe(25 - TRUHEN.eisen.ruhm);
      expect(t.offeneKiste?.funde).toHaveLength(3);
      expect(t.kisten).toBe(1);
    }
  });

  it("die Funde sind VOR der Wahl gespeichert: eine zweite Kiste ist gesperrt, der Stand zeigt dieselben Funde (kein Neuladen)", () => {
    const g = mitRuhm(100);
    const a = oeffneKiste(g, "T-H1", "eisen", REGEL_BESITZ);
    if (!a.ok) throw new Error("oeffnen");
    const funde1 = JSON.stringify(leseTeam(a.gameState, "T-H1").offeneKiste!.funde);
    const nochmal = oeffneKiste(a.gameState, "T-H1", "eisen", REGEL_BESITZ);
    expect(nochmal).toMatchObject({ ok: false, grund: "kiste_offen" });
    // Der Spielstand wird als JSON gespeichert und wieder geladen: dieselben Funde.
    const geladen = JSON.parse(JSON.stringify(a.gameState));
    expect(JSON.stringify(leseTeam(geladen, "T-H1").offeneKiste!.funde)).toBe(funde1);
  });

  it("dieselbe Saat und derselbe Zaehler ergeben dieselben Funde, auch aus einem frischen Spielstand (kein Neu-Wuerfeln)", () => {
    const a = oeffneKiste(mitRuhm(100), "T-H1", "eisen", REGEL_BESITZ);
    const b = oeffneKiste(mitRuhm(100), "T-H1", "eisen", REGEL_BESITZ);
    if (!a.ok || !b.ok) throw new Error("oeffnen");
    expect(JSON.stringify(leseTeam(a.gameState, "T-H1").offeneKiste)).toBe(JSON.stringify(leseTeam(b.gameState, "T-H1").offeneKiste));
  });

  it("nicht aktive Regel: keine Kiste", () => {
    const r = oeffneKiste(mitRuhm(100), "T-H1", "holz", { ...REGEL_BESITZ, besitz: false });
    expect(r).toMatchObject({ ok: false, grund: "nicht_aktiv" });
  });
});

describe("Truhen: Gold hoechstens alle fuenf Spieltage", () => {
  it("nach einer Ruhm-Goldtruhe ist die naechste erst nach fuenf gebuchten Spieltagen moeglich", () => {
    let g = mitRuhm(500);
    const erste = oeffneKiste(g, "T-H1", "gold", REGEL_BESITZ);
    if (!erste.ok) throw new Error("erste Gold");
    g = erste.gameState;
    const w = waehleFund(g, "T-H1", 0);
    if (!w.ok) throw new Error("waehlen");
    g = w.gameState;
    for (let tage = 0; tage < GOLD_ABSTAND_SPIELTAGE; tage += 1) {
      const s = truhenStatus(g, "T-H1", "gold");
      expect(s.moeglich, `nach ${tage} Spieltagen`).toBe(false);
      expect(s.grund).toBe("gold_abstand");
      expect(s.nochSpieltage).toBe(GOLD_ABSTAND_SPIELTAGE - tage);
      g = { ...g, ausruestung: { ...g.ausruestung!, spieltage: g.ausruestung!.spieltage + 1 } };
    }
    expect(truhenStatus(g, "T-H1", "gold").moeglich).toBe(true);
    // Eisen und Holz sind davon nicht betroffen.
    expect(truhenStatus(mitRuhm(500, { letztesRuhmGold: 0 }), "T-H1", "eisen").moeglich).toBe(true);
  });

  it("ein Gold-Gutschein (Platzierung) zaehlt nicht gegen den Abstand und setzt ihn nicht", () => {
    const g = mitRuhm(0, { gutscheine: { holz: 0, eisen: 0, gold: 1 }, letztesRuhmGold: 0 });
    const s = truhenStatus(g, "T-H1", "gold");
    expect(s).toMatchObject({ moeglich: true, bezahlung: "gutschein" });
    const r = oeffneKiste(g, "T-H1", "gold", REGEL_BESITZ);
    if (!r.ok) throw new Error("oeffnen");
    const t = leseTeam(r.gameState, "T-H1");
    expect(t.gutscheine.gold).toBe(0);
    expect(t.letztesRuhmGold).toBe(0);
  });

  it("Gutscheine werden vor Ruhm genommen", () => {
    const g = mitRuhm(50, { gutscheine: { holz: 1, eisen: 0, gold: 0 } });
    const r = oeffneKiste(g, "T-H1", "holz", REGEL_BESITZ);
    if (!r.ok) throw new Error("oeffnen");
    const t = leseTeam(r.gameState, "T-H1");
    expect(t.ruhm).toBe(50);
    expect(t.gutscheine.holz).toBe(0);
  });
});

describe("Truhen: Wahl", () => {
  it("einer kommt ins Lager, die zwei anderen zerfallen zu Teilen", () => {
    const a = oeffneKiste(mitRuhm(50), "T-H1", "eisen", REGEL_BESITZ);
    if (!a.ok) throw new Error("oeffnen");
    const funde = leseTeam(a.gameState, "T-H1").offeneKiste!.funde;
    const w = waehleFund(a.gameState, "T-H1", 1);
    expect(w.ok).toBe(true);
    if (!w.ok) return;
    const t = leseTeam(w.gameState, "T-H1");
    expect(t.offeneKiste).toBeNull();
    expect(t.lager).toHaveLength(1);
    const erwartet = funde.reduce((summe, f, i) => (i === 1 ? summe : summe + (f.art === "teil" ? { standard: 1, selten: 2, episch: 4, legendaer: 8 }[f.teil.seltenheit] : 1)), 0);
    expect(t.teile).toBe(erwartet);
  });

  it("volles Lager: die Wahl scheitert, die Kiste bleibt offen; Verwerfen macht alle drei zu Teilen", () => {
    let t = leeresTeam();
    for (let i = 0; i < LAGER_PLAETZE; i += 1) {
      const r = legeTeilAb(t, teil(`v${i}`));
      if (r.ok) t = r.team;
    }
    let g = schreibeTeam(sichereAusruestung(spielstand(), "s"), "T-H1", { ...t, ruhm: 40 });
    const a = oeffneKiste(g, "T-H1", "eisen", REGEL_BESITZ);
    if (!a.ok) throw new Error("oeffnen");
    g = a.gameState;
    // Ein Material-Fund passt in ein volles Lager nur, wenn es den Stapel schon gibt: hier nicht. Ein Teil-Fund passt nie.
    const funde = leseTeam(g, "T-H1").offeneKiste!.funde;
    const w = waehleFund(g, "T-H1", funde.findIndex((f) => f.art === "teil"));
    expect(w).toMatchObject({ ok: false, grund: "lager_voll" });
    expect(leseTeam(g, "T-H1").offeneKiste).not.toBeNull();
    const v = verwerfeKiste(g, "T-H1");
    expect(v.ok).toBe(true);
    if (v.ok) {
      const nach = leseTeam(v.gameState, "T-H1");
      expect(nach.offeneKiste).toBeNull();
      expect(nach.teile).toBeGreaterThanOrEqual(3);
      expect(nach.lager).toHaveLength(LAGER_PLAETZE);
    }
  });

  it("ungueltige Wahl und keine Kiste", () => {
    expect(waehleFund(mitRuhm(0), "T-H1", 0)).toMatchObject({ ok: false, grund: "keine_kiste" });
    const a = oeffneKiste(mitRuhm(50), "T-H1", "eisen", REGEL_BESITZ);
    if (!a.ok) throw new Error("oeffnen");
    expect(waehleFund(a.gameState, "T-H1", 3)).toMatchObject({ ok: false, grund: "unbekannte_wahl" });
    expect(waehleFund(a.gameState, "T-H1", -1)).toMatchObject({ ok: false, grund: "unbekannte_wahl" });
  });
});

describe("Aktionen des Menschen (Schreibweg)", () => {
  it("istAusruestungAktion prueft die Form", () => {
    expect(istAusruestungAktion({ aktion: "kiste_oeffnen", truhe: "holz" })).toBe(true);
    expect(istAusruestungAktion({ aktion: "kiste_oeffnen", truhe: "platin" })).toBe(false);
    expect(istAusruestungAktion({ aktion: "fund_waehlen", index: 2 })).toBe(true);
    expect(istAusruestungAktion({ aktion: "fund_waehlen", index: 1.5 })).toBe(false);
    expect(istAusruestungAktion({ aktion: "zerlegen", teilId: "" })).toBe(false);
    expect(istAusruestungAktion({ aktion: "kiste_verwerfen" })).toBe(true);
    expect(istAusruestungAktion(null)).toBe(false);
  });

  it("oeffnen, waehlen, zerlegen im Zusammenspiel; Verlauf nur fuer Menschen; Notbremse sperrt", () => {
    const g0 = mitRuhm(30);
    const a = wendeAusruestungAktionAn(g0, "T-H1", { aktion: "kiste_oeffnen", truhe: "eisen" }, ENV_AN);
    expect(a.ok).toBe(true);
    const w = wendeAusruestungAktionAn(a.gameState, "T-H1", { aktion: "fund_waehlen", index: 0 }, ENV_AN);
    expect(w.ok).toBe(true);
    const t = leseTeam(w.gameState, "T-H1");
    expect(t.verlauf.length).toBeGreaterThanOrEqual(2);
    const erstesTeil = t.lager.find((p) => p.art === "teil");
    if (erstesTeil && erstesTeil.art === "teil") {
      const z = wendeAusruestungAktionAn(w.gameState, "T-H1", { aktion: "zerlegen", teilId: erstesTeil.teil.id }, ENV_AN);
      expect(z.ok).toBe(true);
      expect(leseTeam(z.gameState, "T-H1").lager.some((p) => p.art === "teil" && p.teil.id === erstesTeil.teil.id)).toBe(false);
    }
    const gesperrt = wendeAusruestungAktionAn(g0, "T-H1", { aktion: "kiste_oeffnen", truhe: "eisen" }, { OLY_AUSRUESTUNG: "aus-sofort" });
    expect(gesperrt).toMatchObject({ ok: false, reason: "nicht_aktiv" });
    const manager = { ...g0, scenarioMeta: { ...g0.scenarioMeta!, gameMode: "manager" } } as typeof g0;
    expect(wendeAusruestungAktionAn(manager, "T-H1", { aktion: "kiste_oeffnen", truhe: "eisen" }, ENV_AN)).toMatchObject({ ok: false, reason: "nicht_aktiv" });
    expect(wendeAusruestungAktionAn(g0, "T-GIBTS-NICHT", { aktion: "kiste_oeffnen", truhe: "eisen" }, ENV_AN)).toMatchObject({ ok: false, reason: "team_unbekannt" });
  });
});
