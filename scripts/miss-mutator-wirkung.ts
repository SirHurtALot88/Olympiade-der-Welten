// ===================================================================================
// WAS IST EIN MUTATOR-TREFFER IM SPIEL WERT? — die Wirkungsmessung zu Chris' Vorgabe
// (29.09., docs/design/mutator-trait-organische-performance-konzept-29-09.md, Abschnitt 7.3
// und "Finale Umsetzung").
//
// Chris: "deswegen soll der spieler quasi von seinen stats 5-8% besser werden wo ich mir
// erhoffe, dass das auf 0,3 PPs raus laufen könnte. da müsste man ggf. aber mal schauen wie
// sich das auf schwache und wie auf starke spieler auswirkt. vllt müsste es auch ein flat
// stat boost sein, das sollst du prüfen".
//
// Genau das misst dieses Skript, gepaart statt geschaetzt: dieselbe Saat, derselbe Kader,
// einmal ohne jeden Mutator und einmal mit einem Treffer fuer GENAU EINEN Spieler, reihum fuer
// jeden Teilnehmer (window.__arena.mutatorGegenfaktus). Gespielt wird ueber dieselben Einstiege
// wie im produktiven Headless-Lauf, umgerechnet in PP ueber dieselbe Funktion, die die Saison
// bucht (computeIndividualBoxscorePpsFromFixtureResults). Ausgegeben wird je Disziplin und je
// Regel:
//   - dPP Spieler: was der getroffene Spieler selbst mehr bekommt (Ersatz fuer die 0,3 PP),
//   - dPP Team: was seine Seite insgesamt mehr bekommt (die Tabelle ist die Summe der
//     Spieler-PP, s. season-points-ledger.ts) — kleiner, wo Mitspieler sich eine Ressource
//     teilen (Wuerfe, Staffelpunkte),
//   - dasselbe getrennt nach Staerke-Drittel (Eignung in der Disziplin), die Frage "schwach
//     gegen stark".
//
//   npx tsx scripts/miss-mutator-wirkung.ts [--n=8] [--regeln=flach:5,prozent:0.065] [disziplin ...]
//
// Ohne Disziplinliste laufen alle arena-aufgeloesten (ARENA_RESOLVED_DISCIPLINE_IDS). Kader: die
// live-save-Kaderfamilie (data/generated/kaderfamilie-live-save.json), wie miss-alle-disziplinen.
// ===================================================================================
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { chromium } from "playwright";

import type { ArenaFixtureResult } from "../lib/battle/arena-headless-runner";
import {
  ARENA_RESOLVED_DISCIPLINE_IDS,
  computeIndividualBoxscorePpsFromFixtureResults,
} from "../lib/resolve/battle-mode-arena-team-points";

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SEITE = pathToFileURL(path.join(WURZEL, "public/mockups/battle-mode.html")).href;
const KADERFAMILIE_PFAD = process.env.OLY_KADER_FAMILIE || path.join(WURZEL, "data/generated/kaderfamilie-live-save.json");
const FEST = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

const args = process.argv.slice(2);
const opt = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];
const N = Number(opt("n") ?? 8);
const REGELN = (opt("regeln") ?? "flach:5")
  .split(",")
  .map((r) => {
    const [art, wert] = r.split(":");
    return { art: art as "flach" | "prozent", jeTreffer: Number(wert) };
  });
const NUR = args.filter((a) => !a.startsWith("--"));
const DISZIPLINEN = NUR.length ? NUR : [...ARENA_RESOLVED_DISCIPLINE_IDS];

/** Der Teil von `window.__arena`, den dieses Skript anfasst (battle-mode.engine.js). */
type ArenaFenster = {
  __arena?: {
    mutatorGegenfaktus: (d: string, opt: unknown) => { fehler?: string; varianten: Array<{ spiele: Spiel[] }> };
    mutatorKonstante: () => { art: string; jeTreffer: number };
  };
};

type Lauf = { wer: string; seite: 0 | 1; eig: number | null; seiten: [number, number]; boxscore: Record<string, number> };
type Spiel = { saat: number; seiten: [number, number]; torwart: string[]; boxscore: Record<string, number>; laeufe: Lauf[] };

const familie = existsSync(KADERFAMILIE_PFAD)
  ? (JSON.parse(readFileSync(KADERFAMILIE_PFAD, "utf8")).varianten as Array<{ label: string; heim: unknown[]; gast: unknown[] }>)
  : null;

/** Boxscore-Werte eines Laufs -> PP je Name, ueber die produktive Umrechnung. */
function ppJeName(disziplin: string, boxscore: Record<string, number>, torwart: string[], jeSeite: number) {
  const fixture: ArenaFixtureResult = {
    homeTeamId: "h",
    awayTeamId: "g",
    seiten: [0, 0],
    boxscore: Object.entries(boxscore).map(([name, wert]) => ({
      name,
      wert,
      playerId: name,
      side: null,
      torwart: torwart.includes(name),
    })),
  };
  return computeIndividualBoxscorePpsFromFixtureResults([fixture], jeSeite, disziplin);
}

const mittel = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
const f = (x: number, s = 3) => (Number.isFinite(x) ? x.toFixed(s) : "—");

async function main() {
  const browser = await chromium.launch(existsSync(FEST) ? { executablePath: FEST } : {});
  const zusammenfassung: Array<{ d: string; regel: string; spieler: number; team: number; drittel: number[] }> = [];
  try {
    const seite = await browser.newPage();
    const fehler: string[] = [];
    seite.on("pageerror", (e) => fehler.push(String(e)));
    await seite.goto(SEITE, { waitUntil: "networkidle" });
    await seite.waitForFunction(() => (window as unknown as ArenaFenster).__arena?.mutatorGegenfaktus, null, { timeout: 30000 });
    const konstante = await seite.evaluate(() => (window as unknown as ArenaFenster).__arena!.mutatorKonstante());
    console.log(`Spielkonstante der Engine: ${konstante.art} ${konstante.jeTreffer} je Treffer`);
    console.log(`Kader: ${familie ? `live-save-Kaderfamilie (${familie.length} Paarungen)` : "Standardkader der Engine"}, n=${N} Spiele je Paarung\n`);

    for (const d of DISZIPLINEN) {
      for (const regel of REGELN) {
        const t0 = Date.now();
        const r = await seite.evaluate(
          ([d, n, fam, regel]) => (window as unknown as ArenaFenster).__arena!.mutatorGegenfaktus(d, { n, kaderFamilie: fam, treffer: 1, regel }),
          [d, N, familie, regel] as const,
        );
        if (r.fehler) {
          console.log(`${d}: ${r.fehler}`);
          continue;
        }
        const zeilen: Array<{ eig: number; dSpieler: number; dTeam: number; dGegner: number; dTeamPunkte: number }> = [];
        for (const v of r.varianten as Array<{ spiele: Spiel[] }>) {
          for (const s of v.spiele) {
            const namen = Object.keys(s.boxscore);
            const jeSeite = Math.max(1, Math.round(namen.length / 2));
            const basisPp = ppJeName(d, s.boxscore, s.torwart, jeSeite);
            const heim = new Set(s.laeufe.filter((l) => l.seite === 0).map((l) => l.wer));
            const tp = (seiten: [number, number], seiteIdx: 0 | 1) => {
              const [a, b] = seiteIdx === 0 ? seiten : [seiten[1], seiten[0]];
              return a > b ? 2 : a === b ? 1 : 0;
            };
            for (const l of s.laeufe) {
              const mitPp = ppJeName(d, l.boxscore, s.torwart, jeSeite);
              const eigene = namen.filter((nm) => heim.has(nm) === (l.seite === 0));
              const gegner = namen.filter((nm) => heim.has(nm) !== (l.seite === 0));
              const summe = (pp: Map<string, number>, liste: string[]) => liste.reduce((x, nm) => x + (pp.get(nm) ?? 0), 0);
              zeilen.push({
                eig: l.eig ?? NaN,
                dSpieler: (mitPp.get(l.wer) ?? 0) - (basisPp.get(l.wer) ?? 0),
                dTeam: summe(mitPp, eigene) - summe(basisPp, eigene),
                dGegner: summe(mitPp, gegner) - summe(basisPp, gegner),
                dTeamPunkte: tp(l.seiten, l.seite) - tp(s.seiten, l.seite),
              });
            }
          }
        }
        const sortiert = [...zeilen].filter((z) => Number.isFinite(z.eig)).sort((a, b) => a.eig - b.eig);
        const drittel = [0, 1, 2].map((k) =>
          mittel(sortiert.slice(Math.floor((k * sortiert.length) / 3), Math.floor(((k + 1) * sortiert.length) / 3)).map((z) => z.dSpieler)),
        );
        const eigDrittel = [0, 1, 2].map((k) =>
          mittel(sortiert.slice(Math.floor((k * sortiert.length) / 3), Math.floor(((k + 1) * sortiert.length) / 3)).map((z) => z.eig)),
        );
        const regelText = `${regel.art}:${regel.jeTreffer}`;
        const spieler = mittel(zeilen.map((z) => z.dSpieler));
        const team = mittel(zeilen.map((z) => z.dTeam));
        zusammenfassung.push({ d, regel: regelText, spieler, team, drittel });
        console.log(
          `${d.padEnd(16)} ${regelText.padEnd(14)} n=${String(zeilen.length).padStart(4)}  ` +
            `dPP Spieler ${f(spieler)}  dPP Team ${f(team)}  dPP Gegner ${f(mittel(zeilen.map((z) => z.dGegner)))}  ` +
            `dTeampunkte ${f(mittel(zeilen.map((z) => z.dTeamPunkte)))}  | Drittel (Eig ${eigDrittel.map((x) => f(x, 0)).join("/")}): ` +
            `${drittel.map((x) => f(x)).join(" / ")}  (${((Date.now() - t0) / 1000).toFixed(0)}s)`,
        );
      }
    }
    if (fehler.length) console.log("Seitenfehler:", fehler.slice(0, 3));
  } finally {
    await browser.close();
  }

  console.log("\nMittel ueber die Disziplinen je Regel (jede Disziplin gleich gewichtet):");
  for (const regel of REGELN) {
    const regelText = `${regel.art}:${regel.jeTreffer}`;
    const z = zusammenfassung.filter((x) => x.regel === regelText);
    if (!z.length) continue;
    console.log(
      `  ${regelText.padEnd(14)} dPP Spieler ${f(mittel(z.map((x) => x.spieler)))}  dPP Team ${f(mittel(z.map((x) => x.team)))}  ` +
        `Drittel schwach/mittel/stark ${[0, 1, 2].map((k) => f(mittel(z.map((x) => x.drittel[k])))).join(" / ")}`,
    );
  }
  console.log("\nZum Vergleich: der abgeloeste flache Bonus war 0,30 PP je Treffer, fuer jeden Spieler gleich.");
}

main().catch((fehler) => {
  console.error(fehler);
  process.exit(1);
});
