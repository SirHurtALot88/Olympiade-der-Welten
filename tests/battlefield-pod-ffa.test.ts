/**
 * BATTLEFIELD IM POD-FORMAT: VIER TEAMS GLEICHZEITIG IM ECHTEN ARENAKAMPF (02.11.).
 *
 * Chris: „nein auch bei battlefield reicht kein hinweistext! da sollen 4 teams gleichzeitig FFA
 * machen". Der Kampf-Motor kennt dafuer N Seiten (`bfPodKader`/`KP.pod`, battle-mode.engine.js,
 * docs/design/battlefield-pod-ffa-02-11.md). Drei Teile, alle gegen echten Chromium (die Engine ist
 * ein IIFE mit DOM-Zugriff, s. tests/spiele-bahn-invarianten.test.ts):
 *
 * 1. DAS DUELL BLEIBT BIT-IDENTISCH. kpPraesenzAm/kpTick/dominationZielWahl/aktualisiereFuehrung &c.
 *    sind fuer N Seiten verallgemeinert und muessen fuer N=2 dieselben Zahlen liefern. Die
 *    Fingerabdruecke unten sind am Engine-Stand VOR dem Umbau gezogen (origin/main 2b474c58,
 *    `spieleArenaDomination("battlefield", saat, {jeSeite: k})` fuer k=2/4/6 und je zwei Saaten,
 *    sha256 ueber das JSON) und nach dem Umbau unveraendert nachgemessen. TDM und Mini-DM laufen ueber
 *    dasselbe Chassis (disziplinProbe). BEWUSSTE Aenderungen am Kampf verschieben diese Werte; dann
 *    neu ziehen (fingerabdruck() unten) und in der PR begruenden.
 *
 * 2. DER POD-EINSTIEG (`window.__arena.spieleBattlefieldPod`) ist ein echter Vier-Team-Kampf: vier
 *    Seiten, je Seite genau die Rollen fuer k (BATTLEFIELD_SLOTS_JE_K), Platz 1..4, Ligapunkte
 *    2-1-0-0 (Gleichstand teilt), Platzierung folgt der Regel (letztes Team > Punkte > Lebende),
 *    deterministisch je Saat — und er hinterlaesst nichts im Duell-Zustand.
 *
 * 3. DIE ANZEIGE (`battlefieldPodAnzeigen`, derselbe Weg wie `echterKader.battlefieldPod` vom Host)
 *    baut Battlefield als Vier-Team-Kampf auf, laeuft ohne Seitenfehler und schaltet mit `null`
 *    wieder aufs Duell zurueck.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { chromium, type Browser, type Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

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

// Am Engine-Stand vor dem Pod-Umbau gezogen (s. Kopfkommentar, Teil 1).
const FINGERABDRUECKE_VOR_DEM_UMBAU: Record<string, string> = {
  "battlefield-domination": "c617dfa4ff542705",
  "disziplinProbe-tdm-mini-dm-battlefield": "8e65ccde7e58eda3",
};

type KaderSpieler = { n: string; d: Record<string, number>; a: Record<string, number> };
type PodTeam = { side: number; name: string; punkte: number; lebend: number; rausT: number | null; eventPlatz: number; ligaPunkte: number };
type PodErgebnis = { disziplin: string; saat: number; dauer: number; teams: PodTeam[]; boxscore: { name: string; side: number; wert: number }[] };
type SondeEvent = { teams: PodTeam[]; teilnehmer: { n: string; side: number; slot: string; eig: number; wert: number }[] };
type Arena = {
  spieleArenaDomination: (d: string, s: number, o: { jeSeite: number }) => unknown;
  disziplinProbe: (d: string, o: { n: number }) => unknown;
  spieleBattlefieldPod: (
    teams: Array<KaderSpieler[] | { name: string; kader: KaderSpieler[] }>,
    saat: number | string,
    platzJeTeam?: Array<Record<string, { d: string; slot: string }>> | null,
    optionen?: { formSaat?: number | string; jeSeite?: number },
  ) => PodErgebnis;
  battlefieldPodSonde: (kader: KaderSpieler[][], o: { gruppen: number[][]; n: number; jeSeite: number }) => { events: SondeEvent[] };
  battlefieldPodAnzeigen: (pod: unknown) => boolean;
  battlefieldPodStand: () => { namen: string[]; platz: number[]; punkte: number[]; lebend: number[] } | null;
  setDisc: (d: string) => void;
  sondenLauf: (ticks: number) => unknown;
};

function fingerabdruck(werte: unknown): string {
  return createHash("sha256").update(JSON.stringify(werte)).digest("hex").slice(0, 16);
}

function familie() {
  return JSON.parse(readFileSync(join(WURZEL, "data/generated/kaderfamilie-live-save.json"), "utf8")) as {
    varianten: Array<{ heimName: string; gastName: string; heim: KaderSpieler[]; gast: KaderSpieler[] }>;
  };
}
function vierTeams() {
  const v = familie().varianten;
  return [
    { name: v[0]!.heimName, kader: v[0]!.heim },
    { name: v[0]!.gastName, kader: v[0]!.gast },
    { name: v[1]!.heimName, kader: v[1]!.heim },
    { name: v[1]!.gastName, kader: v[1]!.gast },
  ];
}

const ROLLEN_JE_K: Record<number, string[]> = {
  2: ["moraleanchor", "siegecore"],
  4: ["commander", "fieldcontrol", "moraleanchor", "siegecore"],
  6: ["commander", "disruptor", "fieldcontrol", "moraleanchor", "siegecore", "spotter"],
};

describe.skipIf(!chromiumVerfuegbar())("Battlefield-Pod: vier Teams gleichzeitig im echten Arenakampf", () => {
  let browser: Browser;
  let seite: Page;
  const seitenFehler: string[] = [];

  beforeAll(async () => {
    browser = await chromium.launch(existsSync(CHROMIUM_PFAD) ? { executablePath: CHROMIUM_PFAD } : {});
    seite = await browser.newPage();
    await seite.addInitScript(() => {
      (window as unknown as { AudioContext?: unknown }).AudioContext = undefined;
      (window as unknown as { webkitAudioContext?: unknown }).webkitAudioContext = undefined;
    });
    seite.on("pageerror", (e) => seitenFehler.push(String(e)));
    await seite.goto(SEITEN_PFAD);
    await seite.waitForFunction(() => typeof (window as unknown as { __arena?: unknown }).__arena !== "undefined", null, {
      timeout: LAUF_TIMEOUT_MS,
    });
  }, LAUF_TIMEOUT_MS);

  afterAll(async () => {
    await browser?.close();
  });

  // --- Teil 1: Duell bit-identisch -------------------------------------------------------
  const duellDomination = () =>
    seite.evaluate(() => {
      const A = (window as unknown as { __arena: Arena }).__arena;
      const aus: unknown[] = [];
      for (const k of [2, 4, 6]) for (const s of [1, 1337]) aus.push(A.spieleArenaDomination("battlefield", s, { jeSeite: k }));
      return aus;
    });

  it("Duell: spieleArenaDomination(battlefield) ist bit-identisch zum Stand vor dem Pod-Umbau", async () => {
    expect(fingerabdruck(await duellDomination())).toBe(FINGERABDRUECKE_VOR_DEM_UMBAU["battlefield-domination"]);
  }, LAUF_TIMEOUT_MS);

  it("Duell: disziplinProbe fuer tdm, mini-dm, battlefield (dasselbe Chassis) ist bit-identisch", async () => {
    const proben = await seite.evaluate(() => {
      const A = (window as unknown as { __arena: Arena }).__arena;
      return ["tdm", "mini-dm", "battlefield"].map((d) => A.disziplinProbe(d, { n: 2 }));
    });
    expect(fingerabdruck(proben)).toBe(FINGERABDRUECKE_VOR_DEM_UMBAU["disziplinProbe-tdm-mini-dm-battlefield"]);
  }, LAUF_TIMEOUT_MS);

  // --- Teil 2: der Pod-Einstieg --------------------------------------------------------
  it.each([2, 4, 6])(
    "k=%i: vier Seiten mit genau den Rollen fuer k, Platz 1..4, 2-1-0-0, Regel der Platzierung, deterministisch",
    async (k) => {
      const teams = vierTeams();
      const { a, b, c } = await seite.evaluate(
        ({ teams, k }) => {
          const A = (window as unknown as { __arena: Arena }).__arena;
          return {
            a: A.spieleBattlefieldPod(teams, "save:s1:md7:bf", null, { formSaat: "save:s1:md7:bf", jeSeite: k }),
            b: A.spieleBattlefieldPod(teams, "save:s1:md7:bf", null, { formSaat: "save:s1:md7:bf", jeSeite: k }),
            c: A.spieleBattlefieldPod(teams, "save:s1:md8:bf", null, { formSaat: "save:s1:md8:bf", jeSeite: k }),
          };
        },
        { teams, k },
      );
      expect(b).toEqual(a);
      for (const erg of [a, c]) {
        expect(erg.teams.map((t) => t.side)).toEqual([0, 1, 2, 3]);
        expect(erg.teams.map((t) => t.name)).toEqual(teams.map((t) => t.name));
        expect(erg.boxscore).toHaveLength(4 * k);
        for (let s = 0; s < 4; s += 1) expect(erg.boxscore.filter((e) => e.side === s)).toHaveLength(k);
        // Anteil am Gesamtbeitrag ueber ALLE 4k Kaempfer: summiert auf 100.
        expect(erg.boxscore.reduce((x, e) => x + e.wert, 0)).toBeCloseTo(100, 6);
        expect(erg.teams.reduce((x, t) => x + t.ligaPunkte, 0)).toBeCloseTo(3, 9);
        if (new Set(erg.teams.map((t) => t.eventPlatz)).size === 4) {
          for (const t of erg.teams) expect(t.ligaPunkte).toBe([2, 1, 0, 0][t.eventPlatz - 1]);
        }
        // Regel: steht nur noch EIN Team, ist es Erster; sonst ordnen die Kontrollpunkt-Punkte.
        const lebende = erg.teams.filter((t) => t.lebend > 0);
        const nachPlatz = [...erg.teams].sort((x, y) => x.eventPlatz - y.eventPlatz);
        if (lebende.length === 1) expect(nachPlatz[0]!.side).toBe(lebende[0]!.side);
        const ohneAllein = lebende.length === 1 ? nachPlatz.slice(1) : nachPlatz;
        for (let i = 1; i < ohneAllein.length; i += 1) expect(ohneAllein[i - 1]!.punkte).toBeGreaterThanOrEqual(ohneAllein[i]!.punkte - 0.05);
      }
      // Rollen je Seite (ueber die Sonde, die je Kaempfer den Slot liefert).
      const sonde = await seite.evaluate(
        ({ kader, k }) => (window as unknown as { __arena: Arena }).__arena.battlefieldPodSonde(kader, { gruppen: [[0, 1, 2, 3]], n: 1, jeSeite: k }),
        { kader: teams.map((t) => t.kader), k },
      );
      for (let s = 0; s < 4; s += 1) {
        const rollen = sonde.events[0]!.teilnehmer.filter((x) => x.side === s).map((x) => x.slot).sort();
        expect(rollen).toEqual(ROLLEN_JE_K[k]);
      }
    },
    LAUF_TIMEOUT_MS,
  );

  it("ein Pod-Lauf hinterlaesst nichts im Duell-Zustand", async () => {
    const vorher = await duellDomination();
    await seite.evaluate((teams) => {
      const A = (window as unknown as { __arena: Arena }).__arena;
      A.spieleBattlefieldPod(teams, 99, null, { formSaat: 99, jeSeite: 4 });
      A.spieleBattlefieldPod(teams, 98, null, { formSaat: 98, jeSeite: 6 });
    }, vierTeams());
    expect(await duellDomination()).toEqual(vorher);
  }, LAUF_TIMEOUT_MS);

  it("weniger als drei oder mehr als vier Teams werden abgelehnt", async () => {
    const fehler = await seite.evaluate((teams) => {
      const A = (window as unknown as { __arena: Arena }).__arena;
      const versuch = (t: unknown[]) => {
        try {
          A.spieleBattlefieldPod(t as never, 1);
          return null;
        } catch (e) {
          return String(e);
        }
      };
      return [versuch(teams.slice(0, 2)), versuch([...teams, teams[0]])];
    }, vierTeams());
    for (const f of fehler) expect(f).toContain("3 oder 4 Teams");
  });

  // --- Teil 3: die sichtbare Arena ------------------------------------------------------
  it("Anzeige: Battlefield zeigt den Pod als Vier-Team-Kampf und schaltet mit null zurueck aufs Duell", async () => {
    const teams = vierTeams();
    const stand = await seite.evaluate((teams) => {
      const A = (window as unknown as { __arena: Arena }).__arena;
      A.setDisc("battlefield");
      const ok = A.battlefieldPodAnzeigen({ teams, k: 4, saat: 42 });
      const start = A.battlefieldPodStand();
      A.sondenLauf(1500);
      const spaeter = A.battlefieldPodStand();
      A.battlefieldPodAnzeigen(null);
      const duell = A.battlefieldPodStand();
      return { ok, start, spaeter, duell };
    }, teams);
    expect(stand.ok).toBe(true);
    expect(stand.start!.namen).toEqual(teams.map((t) => t.name));
    expect(stand.start!.lebend).toEqual([4, 4, 4, 4]);
    expect(stand.spaeter!.punkte).toHaveLength(4);
    expect(stand.duell).toBeNull();
    expect(seitenFehler).toEqual([]);
  }, LAUF_TIMEOUT_MS);
});
