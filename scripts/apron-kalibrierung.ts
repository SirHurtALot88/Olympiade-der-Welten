/**
 * APRON-KALIBRIERUNG — Ratenpaare × Salary Factor gegen den gespielten Save, auf Knopfdruck.
 *
 * Beantwortet fuer jedes Ratenpaar (Zone 1 / Zone 2) und jeden Salary Factor: wie gross ist der
 * Topf, wie viel bekommt ein Empfaenger, wie viele Teams zahlen, wie tief faellt die schlechteste
 * GuV der Liga NACH Apron, und wie gut sind die acht schwaechsten Teams (nach Endrang) NACH Apron
 * gedeckt (Sponsor + Ausgleich ./. Fixkosten, in Prozent). Sockelfaecher und Wertungstopf sind
 * Parameter, NICHT die Modul-Konstanten aus sponsor-liga-leiter.ts — damit sich mehrere Varianten
 * (z. B. ein anderer Sockelfaecher) durchrechnen lassen, OHNE Produktivcode zu aendern. Die
 * eigentlichen Apron-Linien/-Raten laufen dagegen durch die ECHTEN Funktionen aus
 * `lib/season/apron-service.ts` (`computeApronLines`, `computeApronSettlement` mit Raten-Override) —
 * dieses Skript erfindet keine zweite Abgaben-Formel, es fuettert nur andere Parameter hinein.
 *
 * BEMESSUNGSGRUNDLAGE (Gehalt fuer Linien + Abgabe): geglaettet (`getTeamDisplaySalaryTotal`),
 * DIESELBE Zahl wie im ausgelieferten Code (siehe apron-service.ts Kopfkommentar).
 *
 * GUV-BASIS (--guv-basis): "recorded" (Default) liest die AUFGEZEICHNETE Ist-GuV dieser Saison aus
 * `seasonState.standings[teamId].guv` — das echte, bereits abgerechnete Ergebnis des Saves, nicht
 * irgendeine Neuberechnung. "projected" rechnet stattdessen eine neutrale V3-Projektion (Sockel +
 * Wertungsanteil, ohne Kurven-Tilt) minus der ECHTEN Gehaltssumme — nur als Fallback fuer Saves ohne
 * aufgezeichnete GuV. Die beiden Basen koennen abweichen (aufgezeichnete GuV traegt reale
 * Sponsor-Auszahlungen des damaligen Modells; die Projektion ist eine Naeherung mit dem AKTUELLEN
 * Modell) — bei Meinungsverschiedenheiten ist "recorded" die verbindliche Zahl.
 *
 * REPRODUZIERBARKEITS-DIAGNOSE (--diagnose): rechnet dieselbe Frage zusaetzlich mit der ECHTEN statt
 * der geglaetteten Gehaltssumme fuer Linien+Abgabe durch — das war die Quelle der ersten
 * Diskrepanz in der PR-Review (Topf 51,7 vs. 18,3 bei angeblich denselben Eingangsgroessen).
 *
 * --detail druckt zusaetzlich die volle Zahler-Liste (absteigend nach Abgabe, mit GuV vorher/nachher)
 * und die untere-N-Liste mit GuV vorher/nachher (statt nur Deckung %) — die Rohdaten fuer den PR-Text.
 *
 * Aufruf:
 *   OLY_APP_SQLITE_PATH=<pfad> npx tsx scripts/apron-kalibrierung.ts --save <id> \
 *     [--sockel-min 18] [--sockel-max 48] [--wertungstopf 1030] [--wertung-kurve 1.35] \
 *     [--linie1 1.10] [--linie2 1.25] [--capshare 0.5] [--untere 8] [--guv-basis recorded] \
 *     [--raten "0.8:1.6"] [--f "0.82,0.95,1.00,1.10,1.24"] [--diagnose] [--detail]
 */
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { buildTeamSeasonOverviewRows } from "@/lib/foundation/team-management-overview";
import { getTeamDisplaySalaryTotal, getTeamFacilityUpkeepTotal } from "@/lib/sponsor/sponsor-team-salary-display";
import { computeApronLines, computeApronSettlement, type ApronTeamInput } from "@/lib/season/apron-service";
import type { GameState } from "@/lib/data/olyDataTypes";

function argWert(name: string, fallback: string): string {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1]! : fallback;
}
function argFlag(name: string): boolean {
  return process.argv.includes(name);
}
function argNum(name: string, fallback: number): number {
  return Number(argWert(name, String(fallback)));
}

const SAVE_ID = argWert("--save", "");
const SOCKEL_MIN = argNum("--sockel-min", 18);
const SOCKEL_MAX = argNum("--sockel-max", 48);
const WERTUNGSTOPF = argNum("--wertungstopf", 1030);
const WERTUNG_KURVE = argNum("--wertung-kurve", 1.35);
const LINIE1_FAKTOR = argNum("--linie1", 1.1);
const LINIE2_FAKTOR = argNum("--linie2", 1.25);
const CAP_SHARE = argNum("--capshare", 0.5);
const UNTERE_N = Math.round(argNum("--untere", 8));
const GUV_BASIS = argWert("--guv-basis", "recorded") === "projected" ? "projected" : "recorded";
const RATEN = argWert("--raten", "0.8:1.6")
  .split(",")
  .map((paar) => {
    const [r1, r2] = paar.split(":").map(Number);
    return { r1: r1 ?? 0, r2: r2 ?? 0 };
  });
const SALARY_FACTORS = argWert("--f", "0.82,0.95,1.00,1.10,1.24")
  .split(",")
  .map(Number);
const DIAGNOSE = argFlag("--diagnose");
const DETAIL = argFlag("--detail");

if (!SAVE_ID) {
  console.error("Aufruf: npx tsx scripts/apron-kalibrierung.ts --save <id> [Optionen]");
  process.exit(1);
}

function r1(v: number) {
  return Math.round(v * 10) / 10;
}
function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2 : (sorted[mid] ?? 0);
}

// ── Parametrisierte Sockel-/Wertungsanteil-Formeln (Kalibrierung, siehe Kopfkommentar) ──────────
// Spiegeln sponsorSockelFuerStartrang / apronWertungsanteil (sponsor-liga-leiter.ts / apron-
// service.ts), aber mit SOCKEL_MIN/MAX/WERTUNGSTOPF/WERTUNG_KURVE als Parameter statt Konstante.

const LEAGUE_SIZE = 32;
function sockelFuerStartrang(startRank: number): number {
  const rank = Math.max(1, Math.min(LEAGUE_SIZE, Math.round(startRank)));
  return SOCKEL_MIN + ((SOCKEL_MAX - SOCKEL_MIN) * (rank - 1)) / (LEAGUE_SIZE - 1);
}
const WERTUNGS_GEWICHTE = Array.from({ length: LEAGUE_SIZE }, (_, index) => {
  const rank = index + 1;
  return ((LEAGUE_SIZE - rank) / (LEAGUE_SIZE - 1)) ** WERTUNG_KURVE;
});
const WERTUNGS_GEWICHTE_SUMME = WERTUNGS_GEWICHTE.reduce((sum, value) => sum + value, 0);
function wertungsanteilFuerEndrang(finalRank: number, salaryFactor: number): number {
  const rank = Math.max(1, Math.min(LEAGUE_SIZE, Math.round(finalRank)));
  const gewicht = WERTUNGS_GEWICHTE[rank - 1] ?? 0;
  return (WERTUNGSTOPF * salaryFactor * gewicht) / WERTUNGS_GEWICHTE_SUMME;
}

type TeamRow = {
  teamId: string;
  shortCode: string;
  finalRank: number;
  startRank: number;
  displaySalary: number;
  realSalary: number;
  fixedCost: number;
  recordedGuv: number | null;
};

function loadTeams(gameState: GameState): TeamRow[] {
  const overviewRows = buildTeamSeasonOverviewRows({ gameState });
  const standings = gameState.seasonState.standings ?? {};
  return gameState.teams.map((team) => {
    const overview = overviewRows.find((row) => row.teamId === team.teamId);
    const standing = standings[team.teamId] as { startplatz?: number; guv?: number } | undefined;
    const finalRank = overview?.rank ?? LEAGUE_SIZE;
    const startRank = standing?.startplatz ?? finalRank;
    const displaySalary = getTeamDisplaySalaryTotal(gameState, team.teamId);
    const realSalary = overview?.salaryTotal ?? 0;
    const upkeep = getTeamFacilityUpkeepTotal(gameState, team.teamId);
    return {
      teamId: team.teamId,
      shortCode: team.shortCode,
      finalRank,
      startRank,
      displaySalary,
      realSalary,
      fixedCost: displaySalary + upkeep,
      recordedGuv: typeof standing?.guv === "number" && Number.isFinite(standing.guv) ? standing.guv : null,
    };
  });
}

function guvVorApron(team: TeamRow, f: number): number {
  if (GUV_BASIS === "recorded" && team.recordedGuv != null) {
    return team.recordedGuv;
  }
  const sponsorProjection = sockelFuerStartrang(team.startRank) + wertungsanteilFuerEndrang(team.finalRank, f);
  return sponsorProjection - team.realSalary;
}

type ZeileErgebnis = {
  topf: number;
  ausgleichProEmpfaenger: number;
  zahlerCount: number;
  minGuvNach: number;
  untereN: { shortCode: string; finalRank: number; guvVor: number; guvNach: number; deckungPct: number | null }[];
  zahler: { shortCode: string; finalRank: number; abgabe: number; guvVor: number; guvNach: number }[];
};

/**
 * Rechnet EIN Ratenpaar × EIN f durch. `salaryBasis` waehlt, ob Linien+Abgabe geglaettet ("display",
 * Produktivstand) oder echt ("real", nur fuer --diagnose) rechnen.
 */
function rechneZeile(
  teams: TeamRow[],
  medianSalaryDisplay: number,
  medianSalaryReal: number,
  r1rate: number,
  r2rate: number,
  f: number,
  salaryBasis: "display" | "real",
): ZeileErgebnis {
  const medianSalary = salaryBasis === "display" ? medianSalaryDisplay : medianSalaryReal;
  const lines = { line1: medianSalary * LINIE1_FAKTOR, line2: medianSalary * LINIE2_FAKTOR };

  const apronTeams: ApronTeamInput[] = teams.map((team) => ({
    teamId: team.teamId,
    salary: salaryBasis === "display" ? team.displaySalary : team.realSalary,
    rankShare: wertungsanteilFuerEndrang(team.finalRank, f),
  }));

  const settlement = computeApronSettlement({
    lines,
    salaryFactor: f,
    teams: apronTeams,
    rateZone1: r1rate,
    rateZone2: r2rate,
    capShareOfRankPayout: CAP_SHARE,
  });

  const rowById = new Map(settlement.rows.map((row) => [row.teamId, row] as const));
  const guvNachByTeamId = new Map<string, number>();
  for (const team of teams) {
    const guvVor = guvVorApron(team, f);
    const nettoDelta = rowById.get(team.teamId)?.nettoDelta ?? 0;
    guvNachByTeamId.set(team.teamId, r1(guvVor + nettoDelta));
  }

  const empfaenger = settlement.empfaengerCount;
  const ausgleichProEmpfaenger = empfaenger > 0 ? settlement.topf / empfaenger : 0;
  const minGuvNach = Math.min(...Array.from(guvNachByTeamId.values()));

  const untereN = [...teams]
    .sort((a, b) => b.finalRank - a.finalRank)
    .slice(0, UNTERE_N)
    .sort((a, b) => a.finalRank - b.finalRank)
    .map((team) => {
      const guvVor = guvVorApron(team, f);
      const sponsorProjection = sockelFuerStartrang(team.startRank) + wertungsanteilFuerEndrang(team.finalRank, f);
      const nettoDelta = rowById.get(team.teamId)?.nettoDelta ?? 0;
      const cashMitApron = sponsorProjection + nettoDelta;
      const deckungPct = team.fixedCost > 0 ? Math.round((cashMitApron / team.fixedCost) * 100) : null;
      return { shortCode: team.shortCode, finalRank: team.finalRank, guvVor: r1(guvVor), guvNach: r1(guvVor + nettoDelta), deckungPct };
    });

  const zahler = teams
    .map((team) => ({ team, row: rowById.get(team.teamId) }))
    .filter((entry) => (entry.row?.abgabe ?? 0) > 0.001)
    .map((entry) => {
      const guvVor = guvVorApron(entry.team, f);
      const nettoDelta = entry.row!.nettoDelta;
      return {
        shortCode: entry.team.shortCode,
        finalRank: entry.team.finalRank,
        abgabe: r1(entry.row!.abgabe),
        guvVor: r1(guvVor),
        guvNach: r1(guvVor + nettoDelta),
      };
    })
    .sort((a, b) => b.abgabe - a.abgabe);

  return {
    topf: r1(settlement.topf),
    ausgleichProEmpfaenger: r1(ausgleichProEmpfaenger),
    zahlerCount: settlement.zahlerCount,
    minGuvNach,
    untereN,
    zahler,
  };
}

function main() {
  const persistence = createPersistenceService();
  const save = persistence.getSaveById(SAVE_ID);
  if (!save) {
    console.error(`Save ${SAVE_ID} nicht gefunden.`);
    process.exit(1);
  }
  const gameState = save.gameState as GameState;
  const teams = loadTeams(gameState);
  const medianSalaryDisplay = median(teams.map((t) => t.displaySalary));
  const medianSalaryReal = median(teams.map((t) => t.realSalary));
  const echteLinien = computeApronLines(gameState);

  console.log(`Save: ${SAVE_ID}  (${teams.length} Teams)`);
  console.log(
    `Parameter: Sockel ${SOCKEL_MIN}-${SOCKEL_MAX} · Wertungstopf ${WERTUNGSTOPF} · Kurve ${WERTUNG_KURVE} · Linienfaktoren ${LINIE1_FAKTOR}/${LINIE2_FAKTOR} · Deckel ${CAP_SHARE} · untere ${UNTERE_N} · GuV-Basis ${GUV_BASIS}`,
  );
  console.log(
    `Median-Gehalt geglaettet (Produktivstand) ${medianSalaryDisplay.toFixed(1)} -> Linien ${(medianSalaryDisplay * LINIE1_FAKTOR).toFixed(1)} / ${(medianSalaryDisplay * LINIE2_FAKTOR).toFixed(1)}`,
  );
  console.log(
    `  (Gegenprobe computeApronLines(): medianSalary=${echteLinien.medianSalary} line1=${echteLinien.line1} line2=${echteLinien.line2} usedReferenceSalary=${echteLinien.usedReferenceSalary})`,
  );
  if (DIAGNOSE) {
    console.log(`Median-Gehalt ECHT (nur --diagnose) ${medianSalaryReal.toFixed(1)} -> Linien ${(medianSalaryReal * LINIE1_FAKTOR).toFixed(1)} / ${(medianSalaryReal * LINIE2_FAKTOR).toFixed(1)}`);
  }
  console.log("");

  const bases: Array<"display" | "real"> = DIAGNOSE ? ["display", "real"] : ["display"];
  for (const basis of bases) {
    console.log(`=== Bemessungsgrundlage: ${basis === "display" ? "GEGLAETTET (Produktivstand)" : "ECHT (nur Diagnose)"} ===`);
    for (const { r1: r1rate, r2: r2rate } of RATEN) {
      console.log(`\n--- Saetze ${r1rate}/${r2rate} ---`);
      console.log("f      Hebel  Topf   Ausgleich  Zahler  minGuvNach");
      for (const f of SALARY_FACTORS) {
        const ergebnis = rechneZeile(teams, medianSalaryDisplay, medianSalaryReal, r1rate, r2rate, f, basis);
        const hebel = Math.max(0, Math.min(1, (f - 0.95) / (1.24 - 0.95)));
        console.log(
          `${f.toFixed(2).padStart(5)}  ${hebel.toFixed(2)}  ${ergebnis.topf.toFixed(1).padStart(6)}  ${ergebnis.ausgleichProEmpfaenger.toFixed(2).padStart(9)}  ${String(ergebnis.zahlerCount).padStart(6)}  ${ergebnis.minGuvNach.toFixed(1).padStart(10)}`,
        );
        if (DETAIL) {
          console.log(
            "    Zahler (abgabe, guvVor->guvNach): " +
              ergebnis.zahler
                .map((z) => `${z.shortCode}(FR${z.finalRank}) ${z.abgabe.toFixed(1)} [${z.guvVor.toFixed(1)}->${z.guvNach.toFixed(1)}]`)
                .join(" · "),
          );
          console.log(
            `    Untere ${UNTERE_N} (Rang, guvVor->guvNach, Deckung%): ` +
              ergebnis.untereN
                .map((u) => `${u.shortCode}(#${u.finalRank}) ${u.guvVor.toFixed(1)}->${u.guvNach.toFixed(1)} (${u.deckungPct ?? "-"}%)`)
                .join(" · "),
          );
        }
      }
    }
    console.log("");
  }
}

main();
