/**
 * BATTLEFIELD "DOMINATION MIT FUENF PUNKTEN" (17.11., Block 3 der Vier-Teams-Runde,
 * docs/design/vier-teams-staffel-battlefield-17-11.md Abschnitt 3).
 *
 * Chris: "battlefield hat auch 0 dynamik ... 5 Punkte zum Dominieren ... pro sekunde ein punkt ... Teams
 * koennen sich aufteilen". Gebaut als FORMAT-UMSCHALTER: "orte3" (Standard) bleibt bit-identisch,
 * "domination5" ist das neue Gefecht. Geprueft gegen echten Chromium:
 *  1. Standard unveraendert: `optionen.format:"orte3"` == ohne Angabe (Zeichen fuer Zeichen); der
 *     Lib-Schalter `BATTLEFIELD_POD_FORMAT` steht auf "orte3", die Runner-Option ist dann leer.
 *  2. Fuenf Punkte, 1 Punkt je Sekunde und gehaltenem Punkt, Respawn statt Ausscheiden, Teams teilen
 *     sich auf (mehr als ein Ort je Team gleichzeitig), Besitz wechselt im Spiel.
 *  3. Gezeigt = gebucht: das Replay in der Arena endet exakt im gebuchten Endstand.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { chromium, type Browser, type Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { BATTLEFIELD_POD_FORMAT, battlefieldPodFormatOption } from "@/lib/battle/arena-resolved-disciplines";

const CHROMIUM_PFAD = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const WURZEL = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const SEITEN_PFAD = pathToFileURL(join(WURZEL, "public", "mockups", "battle-mode.html")).href;
const LAUF_TIMEOUT_MS = 240_000;

function chromiumVerfuegbar(): boolean {
  if (existsSync(CHROMIUM_PFAD)) return true;
  try {
    return readdirSync(join(homedir(), ".cache", "ms-playwright")).some((e) => e.startsWith("chromium"));
  } catch {
    return false;
  }
}

type KaderSpieler = { n: string; d: Record<string, number>; a: Record<string, number> };
type PodTeam = { side: number; punkte: number; lebend: number; eventPlatz: number; ligaPunkte: number };
type Gefecht = {
  orte: { besitz: number | null }[];
  takte: { t: number; ereignisse: { typ: string }[]; k: { ort: number | null; raus: boolean }[]; punkte: number[] }[];
  kaempfer: { side: number }[];
  format?: string;
};
type PodErgebnis = { format: string; podFormat?: string; teams: PodTeam[]; boxscore: unknown[]; gefecht?: Gefecht };
type Arena = {
  spieleBattlefieldPod: (t: unknown[], s: number | string, p: null, o: Record<string, unknown>) => PodErgebnis;
  battlefieldPodAnzeigen: (pod: unknown) => boolean;
  battlefieldPodStand: () => { platz: number[]; punkte: number[]; lebend: number[]; ligaPunkte: number[]; done: boolean } | null;
  battlefieldFormat: (f?: string) => string;
  setDisc: (d: string) => void;
  sondenLauf: (ticks: number) => unknown;
};

function vierTeams() {
  const v = JSON.parse(readFileSync(join(WURZEL, "data/generated/kaderfamilie-live-save.json"), "utf8")).varianten as Array<{
    heimName: string; gastName: string; heim: KaderSpieler[]; gast: KaderSpieler[];
  }>;
  return [
    { name: v[0]!.heimName, kader: v[0]!.heim },
    { name: v[0]!.gastName, kader: v[0]!.gast },
    { name: v[1]!.heimName, kader: v[1]!.heim },
    { name: v[1]!.gastName, kader: v[1]!.gast },
  ];
}

describe("Battlefield-Format-Umschalter (Lib)", () => {
  it("Standard ist orte3, die Runner-Option bleibt dann leer (Eingabe/Ergebnis wie vor dem 17.11.)", () => {
    expect(BATTLEFIELD_POD_FORMAT).toBe("orte3");
    expect(battlefieldPodFormatOption()).toEqual({});
    expect(battlefieldPodFormatOption("domination5")).toEqual({ format: "domination5" });
  });
});

describe.skipIf(!chromiumVerfuegbar())("Battlefield Domination mit fuenf Punkten (Chromium)", () => {
  let browser: Browser;
  let seite: Page;
  const fehler: string[] = [];

  beforeAll(async () => {
    browser = await chromium.launch(existsSync(CHROMIUM_PFAD) ? { executablePath: CHROMIUM_PFAD } : {});
    seite = await browser.newPage();
    await seite.addInitScript(() => {
      (window as unknown as { AudioContext?: unknown }).AudioContext = undefined;
    });
    seite.on("pageerror", (e) => fehler.push(String(e)));
    await seite.goto(SEITEN_PFAD);
    await seite.waitForFunction(() => typeof (window as unknown as { __arena?: unknown }).__arena !== "undefined", null, {
      timeout: LAUF_TIMEOUT_MS,
    });
  }, LAUF_TIMEOUT_MS);

  afterAll(async () => {
    await browser?.close();
  });

  it("Standardformat unveraendert: format \"orte3\" == ohne Angabe, kein podFormat im Ergebnis", async () => {
    const teams = vierTeams();
    const r = await seite.evaluate((teams) => {
      const A = (window as unknown as { __arena: Arena }).__arena;
      return {
        ohne: A.spieleBattlefieldPod(teams, 4711, null, { formSaat: 4711, jeSeite: 4 }),
        mit: A.spieleBattlefieldPod(teams, 4711, null, { formSaat: 4711, jeSeite: 4, format: "orte3" }),
        global: A.battlefieldFormat(),
      };
    }, teams);
    expect(JSON.stringify(r.mit)).toBe(JSON.stringify(r.ohne));
    expect(r.ohne.podFormat).toBeUndefined();
    expect(r.global).toBe("orte3");
  }, LAUF_TIMEOUT_MS);

  it("fuenf Punkte, 1 Punkt je Sekunde, Respawn, Aufteilen, Besitzwechsel -- deterministisch", async () => {
    const teams = vierTeams();
    const r = await seite.evaluate((teams) => {
      const A = (window as unknown as { __arena: Arena }).__arena;
      const o = { formSaat: 4242, jeSeite: 4, format: "domination5", protokoll: true };
      return { a: A.spieleBattlefieldPod(teams, 4242, null, o), b: A.spieleBattlefieldPod(teams, 4242, null, o), danach: A.battlefieldFormat() };
    }, teams);
    expect(JSON.stringify(r.a)).toBe(JSON.stringify(r.b));
    expect(r.danach).toBe("orte3");                    // die Option gilt nur fuer den Lauf
    expect(r.a.podFormat).toBe("domination5");
    const g = r.a.gefecht!;
    expect(g.orte).toHaveLength(5);
    // Punkte je Takt (2 s): je gehaltenem Ort genau 2 -- also 1 je Sekunde.
    for (let i = 1; i < g.takte.length; i++) {
      const zuwachs = g.takte[i]!.punkte.reduce((s, p, side) => s + p - g.takte[i - 1]!.punkte[side]!, 0);
      expect(zuwachs % 2).toBe(0);
      expect(zuwachs).toBeLessThanOrEqual(10);
    }
    const ereignisse = g.takte.flatMap((t) => t.ereignisse.map((e) => e.typ));
    expect(ereignisse.filter((e) => e === "respawn").length).toBeGreaterThan(0);
    expect(ereignisse.filter((e) => e === "erobert").length).toBeGreaterThanOrEqual(3);
    // Aufteilen: im Mittel steht jedes Team an mehr als einem Ort zugleich.
    let summe = 0;
    for (const t of g.takte) {
      for (let s = 0; s < 4; s++) {
        summe += new Set(t.k.filter((k, i) => g.kaempfer[i]!.side === s && k.ort != null && !k.raus).map((k) => k.ort)).size;
      }
    }
    expect(summe / (g.takte.length * 4)).toBeGreaterThan(1.5);
    // Mit Respawn bleibt kein Team dauerhaft draussen; Platzierung 2-1-0-0.
    expect([...r.a.teams.map((t) => t.ligaPunkte)].sort()).toEqual([0, 0, 1, 2]);
    expect(fehler).toEqual([]);
  }, LAUF_TIMEOUT_MS);

  // Review D1 (17.11.): mit Respawn ist "einziges stehendes Team" eine Momentaufnahme, kein Sieg-Weg.
  // Im Fuenf-Punkte-Format entscheiden die Punkte -- mehr Punkte heisst nie schlechterer Platz.
  // Review N5: Echtzeit-Pod (alter Drei-Orte-Kampf) und "domination5" schliessen sich aus.
  it("Platzierung nach Punkten (kein 'letztes Team steht'-Vorrang), Echtzeit + domination5 abgelehnt", async () => {
    const teams = vierTeams();
    const r = await seite.evaluate((teams) => {
      const A = (window as unknown as { __arena: Arena }).__arena;
      const laeufe = [1, 7, 42, 1337, 4711, 9001].map((s) =>
        A.spieleBattlefieldPod(teams, s, null, { formSaat: s, jeSeite: 3, format: "domination5" }).teams);
      let fehlerText = "";
      try { A.spieleBattlefieldPod(teams, 1, null, { formSaat: 1, jeSeite: 3, format: "domination5", echtzeit: true }); }
      catch (e) { fehlerText = String(e); }
      return { laeufe, fehlerText, danach: A.battlefieldFormat() };
    }, teams);
    for (const t of r.laeufe) {
      for (const a of t) for (const b of t) if (a.punkte > b.punkte) expect(a.eventPlatz).toBeLessThan(b.eventPlatz);
    }
    expect(r.fehlerText).toContain("echtzeit");
    expect(r.danach).toBe("orte3");
  }, LAUF_TIMEOUT_MS);

  it("gezeigt = gebucht: das Replay im Fuenf-Punkte-Format endet exakt im gebuchten Endstand", async () => {
    const teams = vierTeams();
    const r = await seite.evaluate((teams) => {
      const A = (window as unknown as { __arena: Arena }).__arena;
      const gebucht = A.spieleBattlefieldPod(teams, "save:s1:md7:bf", null, { formSaat: "save:s1:md7:bf", jeSeite: 4, format: "domination5" });
      A.setDisc("battlefield");
      A.battlefieldPodAnzeigen({ teams, k: 4, saat: "save:s1:md7:bf", format: "domination5" });
      for (let i = 0; i < 80 && !A.battlefieldPodStand()!.done; i++) A.sondenLauf(6000);
      const ende = A.battlefieldPodStand()!;
      A.battlefieldPodAnzeigen(null);
      return { gebucht, ende };
    }, teams);
    expect(r.ende.done).toBe(true);
    expect(r.ende.platz).toEqual(r.gebucht.teams.map((t) => t.eventPlatz));
    expect(r.ende.ligaPunkte).toEqual(r.gebucht.teams.map((t) => t.ligaPunkte));
    expect(r.ende.lebend).toEqual(r.gebucht.teams.map((t) => t.lebend));
    expect(r.ende.punkte.map((p) => Math.round(p * 10) / 10)).toEqual(r.gebucht.teams.map((t) => t.punkte));
    expect(fehler).toEqual([]);
  }, LAUF_TIMEOUT_MS);
});
