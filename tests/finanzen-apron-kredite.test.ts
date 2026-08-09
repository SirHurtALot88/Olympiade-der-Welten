/**
 * M3 · Finanzen-Umbau — CHRIS: „fable kannst du bitte auch APRON 1 und 2 bei finanzen oder da wo
 * es am meistne sinn macht separat noch mal ausweist? kredite / tilgungne etc sollen natürlich
 * auch mit rein"
 *
 * Der Umbau: eine Verpflichtungs-Karte „Apron & Kredite" auf der Finanzen-Seite — beide
 * Apron-Linien einzeln mit Abstand in Mio, die Hochrechnung (Abgabe/Ausgleich, Deckel, Netto),
 * ehrlicher Einfrier-Status, und daneben die Kreditlast als Rate = Zins + Tilgung. Dazu die
 * Markt-Audit-Befunde: semantische Farben (Einnahmen grün, Ausgaben rot), Herkunft jeder
 * Kopfzahl, konsistente Transfersaldo-Vorzeichen, keine Zähler-Animation auf Geldzahlen,
 * eine GuV-Spalte in der Liga-Tabelle, Saisonarchiv-Load für Cash-Abgleich/Verlauf.
 *
 * Der Test hält beides fest: (1) die EINE-QUELLE-Invarianten am View-Model (Apron-Karte ==
 * GuV-Posten, Kreditzerlegung == Zinszeile), (2) dass jede benutzte CSS-Klasse existiert —
 * CSS-Klassen fallen still durch (Muster `tests/transferhistorie-velo-look.test.ts`).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import type { GameState } from "@/lib/data/olyDataTypes";
import { buildApronProjection } from "@/lib/finance/apron-projection";
import { computeApronSettlement } from "@/lib/season/apron-service";
import { buildFinancesViewModel } from "@/lib/foundation/finances/use-finances-view-model";
import { computeTeamLoanShareRows, computeTeamLoanShares } from "@/lib/finance/season-end-guv";
import { getTeamAnnualLoanInterest } from "@/lib/finance/loan-service";
import { getTeamDisplaySalaryTotal } from "@/lib/sponsor/sponsor-team-salary-display";
import { shouldLoadSeasonArchiveForView } from "@/lib/foundation/tabs/use-season-archive-load";
import { makePlayer, makeRosterEntry, makeTeam, makeTeamIdentity } from "./_fixtures/game-entity-fixtures";

const quelle = (pfad: string) => readFileSync(join(process.cwd(), pfad), "utf8");

const MARKUP = quelle("app/foundation/finances/FoundationFinancesNewLook.tsx");
const CSS = quelle("app/globals.css");
const SCOPE = quelle("lib/foundation/tabs/use-foundation-shell-router-body-scope.tsx");

function round1(value: number): number {
  return Number(value.toFixed(1));
}

/** Season-2-GameState mit eigenem Team, Gehalt, aktivem Kredit und optionalem Saisonarchiv. */
function buildGameState(input: { withLoan?: boolean; seasonSnapshots?: unknown[] | undefined } = {}): GameState {
  const team = makeTeam({ teamId: "team-1", shortCode: "T1", name: "Test United", cash: 50, budget: 100 });
  const rival = makeTeam({ teamId: "team-2", shortCode: "T2", name: "Rival City", cash: 80, budget: 100 });
  const player = makePlayer({ id: "player-1", name: "Star One", salaryDemand: 30 });
  const roster = makeRosterEntry({ id: "r1", teamId: "team-1", playerId: "player-1", salary: 24 });

  return {
    season: { id: "season-2", name: "Season 2", year: 2, currentMatchday: 1, matchdayIds: ["md-1"] },
    matchdayState: { matchdayId: "md-1" },
    teams: [team, rival],
    teamIdentities: [makeTeamIdentity({ teamId: "team-1" }), makeTeamIdentity({ teamId: "team-2" })],
    teamStrategyProfiles: [],
    players: [player],
    rosters: [roster],
    disciplines: [],
    transferHistory: [],
    playerProgressionEvents: [],
    seasonState: {
      seasonId: "season-2",
      loans: input.withLoan
        ? [
            {
              loanId: "loan-1",
              borrowerTeamId: "team-1",
              lenderType: "bank",
              principalOriginal: 30,
              principalOutstanding: 22.4,
              interestRatePerSeason: 0.14,
              termSeasons: 4,
              seasonsRemaining: 3,
              installmentPerSeason: 10.3,
              originatedSeasonId: "season-1",
              status: "active",
              missedPayments: 0,
            },
          ]
        : [],
      standings: {
        "team-1": { teamId: "team-1", points: 20, rank: 1 },
        "team-2": { teamId: "team-2", points: 10, rank: 2 },
      },
      matchdayResults: [],
      disciplineResults: [],
      playerDisciplinePerformances: [],
      formCards: [],
      facilityEvents: [],
      teamFacilities: {},
      seasonSnapshots: input.seasonSnapshots,
    },
  } as unknown as GameState;
}

function readyTeam(gameState: GameState) {
  const model = buildFinancesViewModel(gameState, "team-1");
  if (model.status !== "ready") throw new Error("View-Model nicht ready");
  return model.team;
}

/* ------------------------------------------------------------------ */
/* Apron: beide Linien, eine Quelle                                    */
/* ------------------------------------------------------------------ */

describe("Apron-Ausweisung: beide Linien einzeln, aus derselben Projektion wie die GuV-Zeile", () => {
  const team = readyTeam(buildGameState());

  it("der Apron-Block existiert und trägt beide Linien + Median", () => {
    expect(team.apron).not.toBeNull();
    const apron = team.apron!;
    expect(apron.line1).toBeGreaterThan(0);
    expect(apron.line2).toBeGreaterThan(apron.line1);
    // Linienfaktoren: Linie 1 = Median × 1,1, Linie 2 = Median × 1,25 (auf Anzeigerundung genau).
    expect(apron.line1).toBeCloseTo(round1(apron.medianSalary * 1.1), 0);
    expect(apron.line2).toBeCloseTo(round1(apron.medianSalary * 1.25), 0);
  });

  it("die Abstände sind exakt Bemessungsgrundlage minus Linie (keine zweite Rechnung)", () => {
    const apron = team.apron!;
    expect(apron.distanceLine1).toBeCloseTo(round1(apron.salaryBasis - apron.line1), 5);
    expect(apron.distanceLine2).toBeCloseTo(round1(apron.salaryBasis - apron.line2), 5);
  });

  it("die Bemessungsgrundlage IST die geglättete Gehaltssumme (getTeamDisplaySalaryTotal)", () => {
    const gameState = buildGameState();
    const apron = readyTeam(gameState).apron!;
    expect(apron.salaryBasis).toBe(round1(getTeamDisplaySalaryTotal(gameState, "team-1")));
  });

  it("Netto == Ausgleich − Abgabe, und die GuV-Posten-Zeile trägt dieselbe Zahl", () => {
    const apron = team.apron!;
    expect(apron.nettoDelta).toBeCloseTo(apron.ausgleich - apron.abgabe, 1);
    const posten = team.guvPosten?.find((entry) => entry.key === "apron");
    expect(posten).toBeDefined();
    // GuV-Posten runden auf 2, die Karte auf 1 Nachkommastelle — gleiche Größe, gleiche Quelle.
    expect(apron.nettoDelta).toBeCloseTo(posten!.amount, 1);
  });

  it("die Zone passt zu den Abständen", () => {
    const apron = team.apron!;
    if (apron.distanceLine1 <= 0) expect(apron.zone).toBe("unter_linie_1");
    else if (apron.distanceLine2 <= 0) expect(apron.zone).toBe("zwischen_den_linien");
    else expect(apron.zone).toBe("ueber_linie_2");
  });
});

/* ------------------------------------------------------------------ */
/* Apron liga-weit: wer zahlt, wer bekommt (Chris: „…ein ausweis vom   */
/* APRON was die teams dadurch zahlen müssen oder einnehmen")          */
/* ------------------------------------------------------------------ */

describe("Apron liga-weit: jede Zeile ist die benannte Projektionszeile — nichts neu gerechnet", () => {
  const gameState = buildGameState();
  const team = readyTeam(gameState);
  const league = team.apron!.league;
  const projection = buildApronProjection({
    gameState,
    rankByTeamId: new Map(
      gameState.teams.map(
        (entry) => [entry.teamId, gameState.seasonState.standings?.[entry.teamId]?.rank ?? null] as const,
      ),
    ),
  });

  it("alle Teams stehen drin, mit Name und Kürzel aus gameState.teams", () => {
    expect(league.length).toBe(gameState.teams.length);
    for (const teamEntry of gameState.teams) {
      const row = league.find((entry) => entry.teamId === teamEntry.teamId);
      expect(row, `${teamEntry.teamId} fehlt im Liga-Ausweis`).toBeDefined();
      expect(row!.teamName).toBe(teamEntry.name);
      expect(row!.teamCode).toBe(teamEntry.shortCode);
    }
  });

  it("jede Zahl ist das round1 der Projektionszeile (eine Quelle, keine zweite Rechnung)", () => {
    for (const row of league) {
      const source = projection.byTeamId.get(row.teamId)!;
      expect(row.salaryBasis).toBe(round1(source.salary));
      expect(row.abgabe).toBe(round1(source.abgabe));
      expect(row.ausgleich).toBe(round1(source.ausgleich));
      expect(row.nettoDelta).toBe(round1(source.nettoDelta));
      expect(row.gedeckelt).toBe(source.gedeckelt);
      expect(row.rank).toBe(source.rank);
      // Abstand = dieselbe Anzeige-Subtraktion wie beim eigenen Team.
      expect(row.distanceLine1).toBeCloseTo(round1(source.salary - projection.lines.line1), 5);
    }
  });

  it("Rollen decken sich mit den Aggregaten der Karte (Zahler/Empfänger-Zählung der Engine)", () => {
    expect(league.filter((row) => row.rolle === "zahler").length).toBe(team.apron!.zahlerCount);
    expect(league.filter((row) => row.rolle === "empfaenger").length).toBe(team.apron!.empfaengerCount);
    expect(team.apron!.gedeckeltCount).toBe(league.filter((row) => row.gedeckelt).length);
  });

  it("die eigene Zeile trägt dieselben Zahlen wie die eigene Karte darüber", () => {
    const eigene = league.find((row) => row.teamId === "team-1")!;
    expect(eigene.salaryBasis).toBe(team.apron!.salaryBasis);
    expect(eigene.abgabe).toBe(team.apron!.abgabe);
    expect(eigene.ausgleich).toBe(team.apron!.ausgleich);
    expect(eigene.nettoDelta).toBe(team.apron!.nettoDelta);
    expect(eigene.distanceLine1).toBe(team.apron!.distanceLine1);
  });

  it("Sortierung erzählt die Richtung: Zahler (größte zuerst) → Neutrale → Empfänger", () => {
    const ordnung = { zahler: 0, neutral: 1, empfaenger: 2 } as const;
    for (let index = 1; index < league.length; index += 1) {
      const vorher = league[index - 1]!;
      const jetzt = league[index]!;
      expect(ordnung[vorher.rolle]).toBeLessThanOrEqual(ordnung[jetzt.rolle]);
      if (vorher.rolle === "zahler" && jetzt.rolle === "zahler") {
        expect(vorher.abgabe).toBeGreaterThanOrEqual(jetzt.abgabe);
      }
    }
  });

  it("Summenprobe (ungerundet, an der Projektion): Σ Abgaben == Topf == Σ Ausgleiche, Σ Netto == 0", () => {
    const rows = [...projection.byTeamId.values()];
    const sumAbgabe = rows.reduce((sum, row) => sum + row.abgabe, 0);
    const sumAusgleich = rows.reduce((sum, row) => sum + row.ausgleich, 0);
    expect(sumAbgabe).toBeCloseTo(projection.topf, 6);
    // Vollständige Ausschüttung (kein Empfänger-Deckel, Nutzer-Entscheidung PR #468):
    // der ganze Topf geht zu gleichen Kopfteilen an die Empfänger, nichts verfällt.
    expect(sumAusgleich).toBeCloseTo(projection.topf, 6);
    expect(rows.reduce((sum, row) => sum + row.nettoDelta, 0)).toBeCloseTo(0, 6);
  });

  it("Summenprobe (gerundet, an den Anzeige-Zeilen): höchstens die dokumentierte Anzeigerundung Abstand", () => {
    const toleranz = league.length * 0.05 + 0.05;
    const sumAbgabe = league.reduce((sum, row) => sum + row.abgabe, 0);
    const sumAusgleich = league.reduce((sum, row) => sum + row.ausgleich, 0);
    expect(Math.abs(sumAbgabe - team.apron!.topf)).toBeLessThanOrEqual(toleranz);
    expect(Math.abs(sumAusgleich - team.apron!.topf)).toBeLessThanOrEqual(toleranz);
  });

  it("Markup: Farben sagen die Wahrheit — Empfänger good (grün), Zahler risk (rot), nie der Akzent", () => {
    expect(MARKUP).toMatch(/rolle === "empfaenger" \? "good" : rolle === "zahler" \? "risk" : "neutral"/);
  });

  it("Markup: das eigene Team ist markiert (is-active-row + Dein-Team-Chip), ohne die Liste zu durchsuchen", () => {
    expect(MARKUP).toContain('rowClassName={(row) => (row.teamId === ownTeamId ? "is-active-row" : undefined)}');
    expect(MARKUP).toContain('{row.teamId === ownTeamId ? <span className="nl-fin-league-you">Dein Team</span> : null}');
  });

  it("Markup: kollabiert kommen die Extreme zuerst, der Aufklapp-Knopf trägt die Zwischensumme", () => {
    expect(MARKUP).toContain("APRON_LEAGUE_TOP_ZAHLER");
    expect(MARKUP).toContain("Alle ${apron.league.length} Teams anzeigen");
    expect(MARKUP).toContain("weitere Zahler zahlen zusammen");
  });

  it("Markup: Deckel- und Rundungshinweis stehen an der Anzeige, die Ausschüttung ist der ganze Topf", () => {
    expect(MARKUP).toContain("Der Topf enthält nur die begrenzten Beträge");
    expect(MARKUP).toContain("verteilt wird ungerundet");
    // Vollständige Verteilung steht im Klartext — und KEIN Verfall-Text mehr (der Empfänger-
    // Deckel ist zurückgebaut; die Anzeige darf keinen behaupten).
    expect(MARKUP).toContain("teilen ihn vollständig");
    expect(MARKUP).not.toContain("verfallen");
    expect(MARKUP).not.toContain("Empfänger-Deckel");
    // Der Kopfanteil je Empfänger kommt aus einer Empfänger-Zeile des View-Models (eine Quelle,
    // keine zweite Rechnung in der UI).
    expect(MARKUP).toContain('apron.league.find((row) => row.rolle === "empfaenger")?.ausgleich');
  });
});

describe("Deckel: die naive Satz-Summe geht nicht auf — der Topf ist die Summe der GEDECKELTEN Abgaben", () => {
  it("Erhaltung mit Abgaben-Deckel: Σ Abgaben = Topf = Σ Ausgleiche (voll verteilt, gleiche Kopfteile)", () => {
    const settlement = computeApronSettlement({
      lines: { line1: 10, line2: 20 },
      salaryFactor: 1.24, // Konjunkturhebel k = 1
      teams: [
        { teamId: "big", salary: 40, rankShare: 4 },
        { teamId: "low-a", salary: 5, rankShare: 10 },
        { teamId: "low-b", salary: 4, rankShare: 1 },
      ],
    });
    const big = settlement.rows.find((row) => row.teamId === "big")!;
    // Naive Satz-Summe: 10 × 0,8 + 20 × 1,6 = 40 — der Abgaben-Deckel (0,5 × 4 = 2) begrenzt
    // sie. Der Topf (2) geht vollständig zu gleichen Kopfteilen an beide Empfänger — je 1,
    // unabhängig von ihren Wertungsanteilen (kein Empfänger-Deckel, Nutzer-Entscheidung PR #468).
    expect(big.rohAbgabe).toBeCloseTo(40, 9);
    expect(big.abgabe).toBeCloseTo(2, 9);
    expect(settlement.topf).toBeCloseTo(2, 9);
    const sumAbgabe = settlement.rows.reduce((sum, row) => sum + row.abgabe, 0);
    const sumAusgleich = settlement.rows.reduce((sum, row) => sum + row.ausgleich, 0);
    expect(sumAbgabe).toBeCloseTo(settlement.topf, 9);
    const lowA = settlement.rows.find((row) => row.teamId === "low-a")!;
    const lowB = settlement.rows.find((row) => row.teamId === "low-b")!;
    expect(lowA.ausgleich).toBeCloseTo(1, 9);
    expect(lowB.ausgleich).toBeCloseTo(1, 9);
    expect(sumAusgleich).toBeCloseTo(settlement.topf, 9);
    expect(settlement.rows.reduce((sum, row) => sum + row.nettoDelta, 0)).toBeCloseTo(0, 9);
    // Rollen-Flag der Engine: streng unter der 1. Linie = Empfänger, der Zahler nicht.
    expect(lowA.istEmpfaenger).toBe(true);
    expect(big.istEmpfaenger).toBe(false);
  });

  it("das Empfänger-Flag bleibt auch bei leerem Topf gesetzt (k = 0), damit die UI die Rolle benennen kann", () => {
    const settlement = computeApronSettlement({
      lines: { line1: 10, line2: 20 },
      salaryFactor: 0.9, // unter APRON_KONJUNKTUR_FACTOR_MIN → niemand zahlt
      teams: [
        { teamId: "big", salary: 40, rankShare: 4 },
        { teamId: "low-a", salary: 5, rankShare: 10 },
      ],
    });
    expect(settlement.topf).toBe(0);
    expect(settlement.zahlerCount).toBe(0);
    const empfaenger = settlement.rows.find((row) => row.teamId === "low-a")!;
    expect(empfaenger.istEmpfaenger).toBe(true);
    expect(empfaenger.ausgleich).toBe(0);
  });
});

/* ------------------------------------------------------------------ */
/* Kredite: Rate = Zins + Tilgung, eine Zerlegung                      */
/* ------------------------------------------------------------------ */

describe("Kredit-Verpflichtungen: eine Zerlegung für Karte, Ausgabenzeile und GuV", () => {
  const gameState = buildGameState({ withLoan: true });
  const team = readyTeam(gameState);

  it("jede Zeile erfüllt Rate = Zins + Tilgung", () => {
    expect(team.loanCommitments.rows.length).toBe(1);
    for (const row of team.loanCommitments.rows) {
      expect(row.installment).toBeCloseTo(row.interest + row.principal, 5);
    }
  });

  it("die Summen stimmen mit den kanonischen Helfern überein", () => {
    expect(team.loanCommitments.interestTotal).toBe(getTeamAnnualLoanInterest(gameState, "team-1"));
    expect(team.loanCommitments.principalTotal).toBe(computeTeamLoanShares(gameState, "team-1").principal);
    const rows = computeTeamLoanShareRows(gameState, "team-1");
    expect(team.loanCommitments.rows).toEqual(rows);
  });

  it("die Kreditzins-Ausgabenzeile trägt den ZINS derselben Zerlegung (nicht die volle Rate)", () => {
    expect(team.expenses.loanInstallments.total).toBe(team.loanCommitments.interestTotal);
    expect(team.expenses.loanInstallments.loans.map((row) => row.installment)).toEqual(
      team.loanCommitments.rows.map((row) => row.interest),
    );
  });

  it("ohne Kredite bleiben die Chips da — alles 0 statt fehlender Zeile (Chris: „selbst wenn es 0 ist“)", () => {
    const empty = readyTeam(buildGameState());
    expect(empty.loanCommitments.rows).toEqual([]);
    expect(empty.loanCommitments.installmentTotal).toBe(0);
    expect(empty.loanCommitments.interestTotal).toBe(0);
    expect(empty.loanCommitments.principalTotal).toBe(0);
    // Und das Markup rendert die Chip-Reihe bedingungslos (kein `rows.length > 0`-Gate um die Chips).
    expect(MARKUP).toContain('aria-label="Kredit-Verpflichtungen"');
    expect(MARKUP).toContain('label="davon Tilgung"');
    expect(MARKUP).toContain('label="davon Zins"');
  });
});

/* ------------------------------------------------------------------ */
/* Saisonarchiv-Load + ehrliche Leerzustände (Markt-Audit F4)          */
/* ------------------------------------------------------------------ */

describe("Saisonarchiv: Finanzen lädt es nach, und solange sagt die UI „lädt“, nicht „nicht archiviert“", () => {
  it("die Finanzen-View ist im Archiv-Load-Gate (beide Listen)", () => {
    expect(shouldLoadSeasonArchiveForView("finances")).toBe(true);
    expect(SCOPE).toMatch(/shouldLoadSeasonArchive =[\s\S]{0,900}activeView === "finances"/);
  });

  it("archivePending unterscheidet „noch nicht geladen“ (undefined) von „geladen und leer“ ([])", () => {
    expect(readyTeam(buildGameState({ seasonSnapshots: undefined })).archivePending).toBe(true);
    expect(readyTeam(buildGameState({ seasonSnapshots: [] })).archivePending).toBe(false);
  });

  it("das Markup rendert für den Pending-Fall einen Lade-Hinweis", () => {
    expect(MARKUP).toContain("Saisonarchiv wird geladen");
    expect(MARKUP).toContain("team.archivePending");
  });
});

/* ------------------------------------------------------------------ */
/* Markt-Audit-Befunde F1/F2/F3/F6 als Strukturaussagen                 */
/* ------------------------------------------------------------------ */

describe("Finanzen-Umbau: die Audit-Befunde bleiben behoben", () => {
  it("F1: keine Zähler-Animation auf den Kopf-Geldzahlen (useCountUp raus)", () => {
    // Weder importiert noch aufgerufen — die Erwähnung im Warum-Kommentar ist erlaubt.
    expect(MARKUP).not.toMatch(/useCountUp[(,}]/);
    expect(MARKUP).not.toMatch(/import[\s\S]{0,400}useCountUp/);
  });

  it("F2: Einnahmen grün, Ausgaben rot/orange — kein Akzent, keine Achsen-Töne im Geld", () => {
    expect(MARKUP).not.toMatch(/tone: "accent"/);
    expect(MARKUP).not.toMatch(/tone: "men"/);
    expect(MARKUP).not.toMatch(/tone: "soc"/);
    // Sponsor (größte Einnahme) ist good, Gehälter (größte Ausgabe) risk.
    expect(MARKUP).toMatch(/key: "sponsor",[\s\S]{0,220}tone: "good"/);
    expect(MARKUP).toMatch(/key: "salaries",[\s\S]{0,220}tone: "risk"/);
  });

  it("Kopfzahlen zeigen ihre Herkunft als Subzeile", () => {
    expect(MARKUP).toContain("const incomeSub");
    expect(MARKUP).toContain("sub={incomeSub}");
    expect(MARKUP).toContain("sub={expenseSub}");
    // GuV erklärt sich als Einnahmen − Ausgaben.
    expect(MARKUP).toMatch(/formatNlNumber\(team\.totalIncome\)\} − \$\{formatNlNumber\(team\.totalExpenses\)/);
  });

  it("F3: die Liga-Tabelle hat EINE GuV-Spalte, Kreditraten stehen als Zusatzzeile in der Zelle", () => {
    expect(MARKUP).not.toContain('label: "Cashflow p.a."');
    expect(MARKUP).toContain("nach Kreditraten");
    expect(MARKUP).toContain("nl-fin-league-guv-sub");
    // Die Zusatzzeile nutzt exakt den vorhandenen cashFlowAnnual-Wert (keine zweite Rechnung).
    expect(MARKUP).toMatch(/nach Kreditraten \{formatNlMoney\(row\.cashFlowAnnual\)\}/);
  });

  it("F6: Transfersaldo rechnet mit konsistenten Vorzeichen (Käufe negativ)", () => {
    expect(MARKUP).toContain("formatNlSignedMoney(-transfer.buyTotal)");
    expect(MARKUP).toContain("formatNlSignedMoney(transfer.net)");
  });

  it("F5: der Gehaltsfaktor ist eingedeutscht, der Tooltip nennt den englischen Begriff", () => {
    expect(MARKUP).toContain('label="Gehaltsfaktor"');
    expect(MARKUP).toContain("Salary Factor");
  });

  it("die Apron-Karte erklärt geglättete vs. echte Gehaltssumme (der heikelste Punkt)", () => {
    expect(MARKUP).toContain("nl-fin-apron-basis-note");
    expect(MARKUP).toMatch(/geglättete/);
    expect(MARKUP).toContain("Beide Zahlen sind absichtlich verschieden");
    expect(MARKUP).toContain("actualSalaryTotal={team.expenses.salaries.total}");
  });

  it("Ehrlichkeit: Einfrier-Status und Frisch-Save-Schranke stehen dran", () => {
    expect(MARKUP).toContain("Linien noch nicht eingefroren");
    expect(MARKUP).toContain("apron.usedReferenceSalary");
    expect(MARKUP).toContain("Frisch-Save");
  });
});

/* ------------------------------------------------------------------ */
/* Jede benutzte Klasse existiert in globals.css (beidseitig)          */
/* ------------------------------------------------------------------ */

describe("Jede im Finanzen-Markup benutzte Klasse existiert in globals.css", () => {
  // Reine Anker ohne eigenes Styling: Karten-Wrapper (NlCard trägt den Look) und
  // data-testid-Marker. Sie sind bewusst unstyled — hier dokumentiert, damit ein Tippfehler in
  // einer GESTYLTEN Klasse trotzdem auffällt.
  const UNSTYLED_ANKER = new Set([
    "nl-fin-header-card",
    "nl-fin-flow-card",
    "nl-fin-commitments-card",
    "nl-fin-transfer-card",
    "nl-fin-reconciliation-card",
    "nl-fin-reconciliation-hint",
    "nl-fin-history-card",
    "nl-fin-history-trend",
    "nl-fin-income-card",
    "nl-fin-expense-card",
    "nl-fin-league-table",
    "nl-fin-empty",
    "nl-fin-salary-factor-chip",
    "nl-fin-commit-chips",
    "nl-fin-flow-chart", // gestylt — bleibt im Check
  ]);
  UNSTYLED_ANKER.delete("nl-fin-flow-chart");

  const tokens = new Set<string>();
  for (const match of MARKUP.matchAll(/(?:nl-fin|velo-range-bar)[a-z0-9-]*(?<!-)/g)) {
    if (!UNSTYLED_ANKER.has(match[0])) tokens.add(match[0]);
  }

  it.each([...tokens].sort())("%s ist in globals.css definiert", (klasse) => {
    expect(CSS).toMatch(new RegExp(`\\.${klasse}[\\s.,:{[>)]`));
  });
});

describe("Rückrichtung: die neuen Klassen-Namespaces sind nicht tot", () => {
  const cssKlassen = new Set<string>();
  for (const match of CSS.matchAll(/\.((?:nl-fin-apron|nl-fin-commit|nl-fin-league-guv)[a-z0-9-]*)(?<!-)/g)) {
    cssKlassen.add(match[1]);
  }

  it("mindestens die Kernklassen sind definiert", () => {
    for (const erwartet of [
      "nl-fin-apron",
      "nl-fin-apron-rows",
      "nl-fin-apron-row",
      "nl-fin-apron-meter",
      "nl-fin-apron-projection",
      "nl-fin-commit",
      "nl-fin-commit-columns",
      "nl-fin-commit-loans",
      "nl-fin-league-guv",
      "nl-fin-league-guv-sub",
    ]) {
      expect(cssKlassen, `Klasse ${erwartet} fehlt in globals.css`).toContain(erwartet);
    }
  });

  it.each([...cssKlassen].sort())("%s wird im Markup benutzt", (klasse) => {
    // `is-basis` u. ä. Modifikatoren hängen im Markup als eigenes Token — Basisnamen reichen.
    expect(MARKUP).toContain(klasse);
  });
});
