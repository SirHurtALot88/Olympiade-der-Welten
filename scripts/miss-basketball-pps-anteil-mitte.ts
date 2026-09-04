// ===================================================================================
// DEN REGLER `BASKETBALL_PPS_ANTEIL_MITTE` (a_mitte) AN ECHTEN DUELLEN MESSEN
//
// Auftrag: `BASKETBALL_PPS_ANTEIL_MITTE` (lib/resolve/battle-mode-arena-team-points.ts) war der
// einzige offene Regler der Impact-Kurve -- 0,25 (schaerfere Trennung an der Spitze) gegen 0,45
// (Chris' aelteres, unpraeziseres Beispiel „2,5 von 10"). Das Opus-Dokument
// (docs/design/pps-skalierung-opus.md Abschnitt 6) hat beide Kandidaten NUR an der geschlossenen
// Kurve durchgerechnet, mit EINEM „typischen Duellbesten" als Eingang. Chris' Beschwerde ist aber
// eine Aussage ueber DUELLE („es soll nicht in jedem team duell immer ein spieler volle punktzahl
// bekommen") -- die ist nur an einer Verteilung ECHTER Duelle beantwortbar, nicht an einer Kurve.
//
// Dieses Skript zieht deshalb echte Duelle (derselbe Mechanismus wie
// scripts/ziehe-basketball-pps-referenz.ts: `buildArenaTeam()` + `runArenaFixtures()`, echte
// Liga-Kader aus dem live-save-Abbild) und wertet den ROHEN Boxscore JE DUELL gegen mehrere
// a_mitte-Kandidaten aus. Gefragt wird genau das, was Chris gefragt hat:
//
//   - in wie vielen Duellen bekommt mindestens ein Spieler die volle Punktzahl (bzw. >95 %/>90 %)?
//   - was bekommt ein wirklich mittelmaessiger Auftritt?
//   - wie weit liegen ein schwacher und ein starker Duellbester auseinander (Trennschaerfe)?
//   - wie hoch ist die mittlere Team-Ausschuettung, verglichen mit der PPS-Rangtabelle?
//
// AUFRUF (Weg an den Spielstand s. CLAUDE.md „An die Spielstaende kommen"):
//
//   OLY_APP_SQLITE_PATH=/tmp/abbild.sqlite npx tsx scripts/miss-basketball-pps-anteil-mitte.ts \
//     --feldgroessen=6,4,2 --fixtures=64 --roh=/tmp/duelle.json
//
// `--roh=<pfad>` schreibt die rohen Duell-Boxscores dorthin; ein spaeterer Lauf mit demselben
// `--roh`-Pfad und `--nur-auswertung` rechnet NUR neu aus, ohne zu simulieren (Sekunden statt
// Minuten). Die Simulation ist der teure Teil, die Auswertung ist billig -- und beide a_mitte-
// Kandidaten sehen so garantiert EXAKT dieselben Duelle, nicht zwei getrennte Ziehungen.
// ===================================================================================
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createSaveRepository } from "@/lib/persistence/save-repository";
import { listeArenaTeams, buildArenaTeam } from "@/lib/foundation/battle-arena/arena-kader-adapter";
import { runArenaFixtures } from "@/lib/battle/arena-headless-runner";
import { BASKETBALL_INDIVIDUAL_PPS_MAX } from "@/lib/resolve/battle-mode-arena-team-points";

import type { GameState, LineupDraft, LineupDraftEntry } from "@/lib/data/olyDataTypes";

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REFERENZ_DATEI = path.join(WURZEL, "data/generated/basketball-pps-referenz.json");

/** Die zwei Kandidaten aus dem Opus-Dokument Abschnitt 6, plus die Zwischenstufe. */
const KANDIDATEN = [0.2, 0.25, 0.35, 0.45];

type Referenz = { iMittel: number; iKrass: number };
type RohesDuell = { n: number; heim: string; gast: string; werte: { wert: number; side: string | null }[] };

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function geseedetGemischt<T>(liste: readonly T[], seed: number): T[] {
  const kopie = [...liste];
  const zufall = mulberry32(seed);
  for (let i = kopie.length - 1; i > 0; i -= 1) {
    const j = Math.floor(zufall() * (i + 1));
    [kopie[i], kopie[j]] = [kopie[j]!, kopie[i]!];
  }
  return kopie;
}

function quantil(sortiert: readonly number[], p: number): number {
  if (sortiert.length === 0) return 0;
  const index = (sortiert.length - 1) * p;
  const unten = Math.floor(index);
  const oben = Math.ceil(index);
  if (unten === oben) return sortiert[unten]!;
  return sortiert[unten]! * (1 - (index - unten)) + sortiert[oben]! * (index - unten);
}

/** Exakt `ppsAusBasketballImpact()`, nur mit a_mitte als Parameter statt als Konstante. */
function ppsMitAnteilMitte(impact: number, referenz: Referenz, aMitte: number): number {
  const { iMittel, iKrass } = referenz;
  if (!(iKrass > 0) || !(iMittel > 0) || iMittel >= iKrass) return 0;
  const gamma = Math.log(aMitte) / Math.log(iMittel / iKrass);
  const basis = Math.max(0, impact) / iKrass;
  const anteil = basis <= 0 ? 0 : Math.min(1, Math.pow(basis, gamma));
  return Math.round(BASKETBALL_INDIVIDUAL_PPS_MAX * anteil * 100) / 100;
}

async function zieheDuelle(gameState: GameState, saveId: string, n: number, fixturesZiel: number): Promise<RohesDuell[]> {
  const matchdayId = `pps-anteil-mitte-probe-${n}`;
  const teams = listeArenaTeams(gameState);
  const kaderNachTeam = new Map(teams.map((team) => [team.teamId, buildArenaTeam(gameState, team.teamId)] as const));
  const spielbareTeams = teams.filter((team) => (kaderNachTeam.get(team.teamId)?.length ?? 0) >= n);
  if (spielbareTeams.length < 2) {
    throw new Error(`miss-basketball-pps-anteil-mitte: keine zwei Teams mit >= ${n} einsatzfaehigen Spielern.`);
  }

  const lineupDrafts: LineupDraft[] = spielbareTeams.map((team) => {
    const kader = kaderNachTeam.get(team.teamId)!;
    const top = [...kader].sort((a, b) => (b.d.basketball ?? 0) - (a.d.basketball ?? 0)).slice(0, n);
    const entries: LineupDraftEntry[] = top.map((spieler, index) => ({
      disciplineId: "basketball",
      disciplineSide: "d1",
      slotIndex: index,
      playerId: spieler.id,
      activePlayerId: null,
    }));
    return {
      lineupId: `pps-anteil-mitte-${n}-${team.teamId}`,
      saveId,
      seasonId: gameState.season.id,
      matchdayId,
      teamId: team.teamId,
      status: "locked",
      entries,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  });

  const paarungenJeRunde = Math.floor(spielbareTeams.length / 2);
  const runden = Math.max(1, Math.ceil(fixturesZiel / paarungenJeRunde));
  const fixtureInputs: { homeTeamId: string; awayTeamId: string; seed: string }[] = [];
  for (let runde = 0; runde < runden; runde += 1) {
    const gemischt = geseedetGemischt(spielbareTeams, n * 7_000_003 + runde);
    for (let i = 0; i + 1 < gemischt.length; i += 2) {
      const heim = gemischt[i]!;
      const gast = gemischt[i + 1]!;
      fixtureInputs.push({
        homeTeamId: heim.teamId,
        awayTeamId: gast.teamId,
        seed: `pps-anteil-mitte:${n}:${runde}:${heim.teamId}:${gast.teamId}`,
      });
    }
  }

  const gameStateFuerLauf: GameState = {
    ...gameState,
    matchdayState: { ...(gameState.matchdayState ?? {}), matchdayId },
    seasonState: { ...gameState.seasonState, lineupDrafts },
  };

  // Batching wie im Ziehskript -- EIN Browser fuer 300+ Fixtures waechst unbegrenzt im Speicher.
  const BATCH_GROESSE = 20;
  const duelle: RohesDuell[] = [];
  const t0 = Date.now();
  for (let start = 0; start < fixtureInputs.length; start += BATCH_GROESSE) {
    const batch = fixtureInputs.slice(start, start + BATCH_GROESSE);
    const ergebnisse = await runArenaFixtures(gameStateFuerLauf, batch, "basketball");
    for (const ergebnis of ergebnisse) {
      duelle.push({
        n,
        heim: ergebnis.homeTeamId,
        gast: ergebnis.awayTeamId,
        werte: ergebnis.boxscore.map((eintrag) => ({ wert: eintrag.wert, side: eintrag.side })),
      });
    }
    console.log(`  n=${n}: ${duelle.length}/${fixtureInputs.length} Duelle (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
  }
  return duelle;
}

function werteAus(duelle: readonly RohesDuell[], referenzen: ReadonlyMap<number, Referenz>) {
  const feldgroessen = [...new Set(duelle.map((d) => d.n))].sort((a, b) => a - b);
  for (const n of feldgroessen) {
    const referenz = referenzen.get(n);
    if (!referenz) continue;
    const dieser = duelle.filter((d) => d.n === n);
    const alleImpacts = dieser.flatMap((d) => d.werte.map((w) => w.wert)).sort((a, b) => a - b);

    console.log(`\n=== Feldgroesse ${n}v${n} — ${dieser.length} Duelle, ${alleImpacts.length} Spielerwerte ===`);
    console.log(
      `Referenz: iMittel ${referenz.iMittel}  iKrass ${referenz.iKrass}   |   ` +
        `gemessen: Median ${quantil(alleImpacts, 0.5).toFixed(1)}  p99,5 ${quantil(alleImpacts, 0.995).toFixed(1)}`,
    );
    const anteilUeberKrass = alleImpacts.filter((w) => w >= referenz.iKrass).length / alleImpacts.length;
    console.log(`Spielerwerte >= iKrass (voller Deckel, a_mitte-unabhaengig): ${(anteilUeberKrass * 100).toFixed(2)} %`);

    const kopf =
      "a_mitte |  gamma | volle Pkt | >95% MAX | >90% MAX | p10-Sp. | Median-Sp. | Duellbester p10/p50/p90 | Spreizung | Team-Summe | Mitte/Bester | Schwach/Bester";
    console.log(kopf);
    console.log("-".repeat(kopf.length));

    for (const aMitte of KANDIDATEN) {
      const gamma = Math.log(aMitte) / Math.log(referenz.iMittel / referenz.iKrass);
      const besteJeDuell: number[] = [];
      const teamSummen: number[] = [];
      let duelleVoll = 0;
      let duelle95 = 0;
      let duelle90 = 0;
      for (const duell of dieser) {
        const pps = duell.werte.map((w) => ppsMitAnteilMitte(w.wert, referenz, aMitte));
        const bester = Math.max(...pps);
        besteJeDuell.push(bester);
        if (bester >= BASKETBALL_INDIVIDUAL_PPS_MAX - 1e-9) duelleVoll += 1;
        if (bester >= 0.95 * BASKETBALL_INDIVIDUAL_PPS_MAX) duelle95 += 1;
        if (bester >= 0.9 * BASKETBALL_INDIVIDUAL_PPS_MAX) duelle90 += 1;
        for (const seite of ["home", "away"] as const) {
          const summe = duell.werte.reduce(
            (akku, w, i) => (w.side === seite ? akku + pps[i]! : akku),
            0,
          );
          if (duell.werte.some((w) => w.side === seite)) teamSummen.push(summe);
        }
      }
      besteJeDuell.sort((a, b) => a - b);
      teamSummen.sort((a, b) => a - b);
      // Chris' AELTERES Beispiel („ein Topspieler z.B. fuenf, ein mittlerer Spieler ca. 2,5, ein
      // schlechter Spieler 0,5", docs/design/battle-mode-pps-modell-plan.md Abschnitt 0) ist eine
      // Aussage ueber VERHAELTNISSE zu dem, was ein TOPSPIELER bekommt -- nicht ueber den
      // absoluten Deckel. Deshalb hier ausdruecklich gegen den TYPISCHEN Duellbesten (Median der
      // Duellbesten) gemessen, nicht gegen MAX: Chris' Beispiel entspricht Mitte/Bester = 0,50 und
      // Schwach/Bester = 0,10.
      const medianSpieler = ppsMitAnteilMitte(quantil(alleImpacts, 0.5), referenz, aMitte);
      const schwacherSpieler = ppsMitAnteilMitte(quantil(alleImpacts, 0.1), referenz, aMitte);
      const b10 = quantil(besteJeDuell, 0.1);
      const b50 = quantil(besteJeDuell, 0.5);
      const b90 = quantil(besteJeDuell, 0.9);
      const anteil = (x: number) => `${((x / dieser.length) * 100).toFixed(1).padStart(5)} %`;
      console.log(
        `${aMitte.toFixed(2).padStart(7)} | ${gamma.toFixed(3).padStart(6)} | ` +
          `${anteil(duelleVoll)} | ${anteil(duelle95)} | ${anteil(duelle90)} | ` +
          `${schwacherSpieler.toFixed(2).padStart(7)} | ${medianSpieler.toFixed(2).padStart(10)} | ` +
          `${b10.toFixed(2)} / ${b50.toFixed(2)} / ${b90.toFixed(2)}      | ` +
          `${(b90 - b10).toFixed(2).padStart(9)} | ${quantil(teamSummen, 0.5).toFixed(1).padStart(10)} | ` +
          `${(medianSpieler / b50).toFixed(2).padStart(12)} | ${(schwacherSpieler / b50).toFixed(2).padStart(14)}`,
      );
    }
  }
}

async function main() {
  const args = process.argv.slice(2);
  const rohPfad = args.find((a) => a.startsWith("--roh="))?.split("=")[1];
  const nurAuswertung = args.includes("--nur-auswertung");
  const fixturesZiel = Number(args.find((a) => a.startsWith("--fixtures="))?.split("=")[1] ?? 64);
  const feldgroessen = (args.find((a) => a.startsWith("--feldgroessen="))?.split("=")[1] ?? "6")
    .split(",")
    .map(Number);

  const referenzJson = JSON.parse(readFileSync(REFERENZ_DATEI, "utf8")) as {
    feldgroessen: Record<string, { n: number; iMittel: number; iKrass: number }>;
  };
  const referenzen = new Map<number, Referenz>(
    Object.values(referenzJson.feldgroessen).map((w) => [w.n, { iMittel: w.iMittel, iKrass: w.iKrass }]),
  );

  let duelle: RohesDuell[] = [];
  if (nurAuswertung) {
    if (!rohPfad || !existsSync(rohPfad)) {
      console.error("--nur-auswertung braucht ein bereits geschriebenes --roh=<pfad>.");
      process.exit(1);
    }
    duelle = JSON.parse(readFileSync(rohPfad, "utf8")) as RohesDuell[];
    console.log(`Rohdaten gelesen: ${duelle.length} Duelle aus ${rohPfad}`);
  } else {
    const repo = createSaveRepository();
    const koepfe = repo.listSaves();
    if (!koepfe.length) {
      console.error("Kein Spielstand im Store unter OLY_APP_SQLITE_PATH gefunden.");
      process.exit(1);
    }
    const kopf = koepfe[0]!;
    const gameState = repo.getSaveById(kopf.saveId)?.gameState as GameState | undefined;
    if (!gameState) {
      console.error(`Save ${kopf.saveId} hat keinen gameState.`);
      process.exit(1);
    }
    console.log(`Quelle: ${kopf.name} (${kopf.saveId})`);
    for (const n of feldgroessen) {
      duelle.push(...(await zieheDuelle(gameState, kopf.saveId, n, fixturesZiel)));
    }
    if (rohPfad) {
      writeFileSync(rohPfad, JSON.stringify(duelle));
      console.log(`Rohdaten geschrieben: ${rohPfad}`);
    }
  }

  werteAus(duelle, referenzen);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
