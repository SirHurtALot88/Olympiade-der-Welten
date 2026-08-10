/**
 * FRÜHWARNUNG FÜR TEAMS MIT KREDITSCHULDEN UND HOHER GEHALTSLAST.
 *
 * GEMELDET VON CHRIS: „die teams mit krediten wie M-M müssen ja aufpassen wenn sie so hohes gehalt
 * haben dass es nicht immer so weiter geht. da muss dann quasi ne warnung irgendwie kommen die der
 * AI sagt ok es kann sein dass wir eher spieler verkaufen müssen am ende der season weil wir
 * schulden haben und sehr hohes gehalt."
 *
 * WARUM DER BESTEHENDE CASH-DRUCK DAS NICHT LEISTET: `resolveCashPressureScore` misst die Kasse von
 * HEUTE gegen das eigene Cash-Ziel — Schulden gehen dort gar nicht ein. Am Spielstand gemessen
 * (Saison 2, Verkaufsphase): acht Teams standen mit leerer Kasse gleichauf bei Druck 1,00, darunter
 * Mayhem Mavericks (Restschuld 90,2, Kreditrate 32,7, Gehalt 107,7 — der kommenden Abbuchung fehlen
 * 51,8) genauso wie Vigorous Vikings (Restschuld 4,7, es fehlen 1,4). Ein Signal, das beide gleich
 * laut anschreit, sagt der KI nicht, WER wirklich mehr verkaufen muss.
 *
 * WAS HIER GEMESSEN WIRD — die Abbuchung der NÄCHSTEN Saisonend-Abrechnung gegen ihre Deckung:
 *   Abbuchung = Gehaltssumme + Kreditrate  (genau das zieht `applyLoanSettlement` + Gehaltslauf ab)
 *   Deckung   = Cash + Jahresumsatz        (der Umsatz-Proxy, mit dem auch der Kreditrahmen rechnet)
 * Der Score ist der UNGEDECKTE ANTEIL der Abbuchung (0–1). Das braucht von selbst BEIDE Seiten von
 * Chris' Bedingung: ein Team mit Schulden, aber schlankem Gehalt deckt seine kleine Abbuchung aus
 * dem Umsatz (Riptide Rivers: Rate 9,1, trotzdem +25,1 übrig → 0); ein Team mit hohem Gehalt, aber
 * ohne Schulden fällt durch das Schulden-Gate unten — es kann sich notfalls über einen Kredit
 * befreien, während der Kreditrahmen eines verschuldeten Teams um genau diese Restschuld schrumpft
 * (`computeBorrowingCapacity` zieht sie ab) und ein geplatzter Kredit Neuaufnahme ganz sperrt.
 *
 * SEIT DEM SAISONENDE OHNE ZWANGS-NOTKREDIT ist diese Vorausschau die einzige Stelle, die der KI
 * VOR dem Minus sagt, dass sie verkaufen sollte — hinterher hilft nur noch der Notverkauf.
 */
import type { GameState } from "@/lib/data/olyDataTypes";
import {
  computeBorrowingCapacity,
  estimateTeamAnnualRevenue,
  getTeamAnnualLoanInstallment,
  getTeamOwedOutstandingDebt,
} from "@/lib/finance/loan-service";
import { resolveTeamRosterMarketValue } from "@/lib/ai/planner-cash-buffer-policy";

export type SchuldenlastFruehwarnung = {
  teamId: string;
  /** Restschuld (aktive UND geplatzte Kredite — dieselbe Sicht wie die Kreditkapazität). */
  schuld: number;
  /** Jahres-Kreditrate, die das Saisonende zusätzlich zum Gehalt abbucht. */
  kreditrate: number;
  /** Jahresumsatz-Proxy (`estimateTeamAnnualRevenue`) — dieselbe Zahl wie im Kreditrahmen. */
  umsatz: number;
  /** Was der kommenden Saisonend-Abbuchung an Deckung fehlt. 0 = alles gedeckt oder Bagatelle. */
  fehlbetrag: number;
  /** Was das Team im Notfall noch leihen könnte (`computeBorrowingCapacity`). 0 = am Maximum. */
  kreditrahmen: number;
  /** 0–1: ungedeckter Anteil der Abbuchung. Erhöht Verkaufsbereitschaft, erzwingt nie Verkäufe. */
  score: number;
};

function round1(value: number) {
  return Math.round(value * 10) / 10;
}

function round3(value: number) {
  return Number(value.toFixed(3));
}

/**
 * Der reine Rechenkern — ohne `GameState`, damit er sich mit nackten Zahlen aus der Messung prüfen
 * lässt (dasselbe Muster wie `resolveCashPressureScore`).
 */
export function resolveSchuldenlastDruck(input: {
  cash: number;
  salaryTotal: number;
  schuld: number;
  kreditrate: number;
  umsatz: number;
}): { score: number; fehlbetrag: number } {
  const salaryTotal = Math.max(0, input.salaryTotal);
  const kreditrate = Math.max(0, input.kreditrate);
  const abbuchung = salaryTotal + kreditrate;

  // DAS SCHULDEN-GATE — die eine Ja/Nein-Bedingung, die hier bewusst bleibt. Ohne Restschuld ist
  // ein Fehlbetrag kein Frühwarnfall: das Team kann ihn über einen Kredit überbrücken (voller
  // Kreditrahmen, kein Distress-Gate). Genau diese Tür ist bei einem verschuldeten Team halb oder
  // ganz zu. Geprüft wird die Restschuld inkl. geplatzter Kredite, nicht die Rate: ein Team, dessen
  // Kredite schon geplatzt sind, zahlt zwar keine Rate mehr, sitzt aber am tiefsten in der Falle.
  if (input.schuld <= 0 || abbuchung <= 0) {
    return { score: 0, fehlbetrag: 0 };
  }

  // Cash geht UNGEKLAMMERT ein: ein Team, das schon im Minus steht, muss dieses Minus zusätzlich
  // zur Abbuchung erwirtschaften — der Fehlbetrag wächst um genau diesen Betrag.
  const deckung = input.cash + Math.max(0, input.umsatz);
  const roherFehlbetrag = Math.max(0, abbuchung - deckung);

  // BAGATELLGRENZE — dieselbe Reserve-Definition wie im Notverkauf (`ergaenzeNotverkaeufe`:
  // max(1, 5 % der Gehaltslast)), kein neuer Grenzwert. Der Umsatz ist ein Proxy (letzte
  // Sponsor-Saison, ohne Preisgelder); ein Fehlbetrag unterhalb der Reserve, auf die der Notverkauf
  // ohnehin zusteuert, liegt im Schätzfehler. Am Spielstand trennt das genau richtig: Zero Heroes
  // (fehlen 3,6 bei Grenze 4,2) und Vigorous Vikings (1,4 bei 2,8) bleiben still, die acht echten
  // Fälle von Terrible Teachers (6,3) bis Mayhem Mavericks (51,8) schlagen an.
  // DER KREDITRAHMEN GEHT HIER BEWUSST NICHT EIN — nachgemessen, nicht vermutet.
  //
  // Naheliegend wäre, ihn von der Lücke abzuziehen: wer noch leihen kann, muss ja nicht sofort
  // verkaufen. Am Spielstand durchgerechnet löscht das die Warnung aus — statt acht Teams warnen
  // noch zwei, und Mayhem Mavericks (Rahmen 16,4 gegen Lücke 51,8) fällt auf einen Verkauf und
  // Lücke −0,4 zurück, also exakt auf den wirkungslosen Zustand von vorher.
  //
  // Fachlich ist das auch richtig so: sich Geld zu leihen, um eine KREDITRATE zu zahlen, ist die
  // Schuldenspirale, gegen die diese Warnung überhaupt existiert. Der Rahmen zählt für KÄUFE
  // (Chris: „ob ein team überhaupt noch kredit zur Not nehmen kann für Käufe"), und genau dort
  // wird er verwendet: `selectCompositeSellCandidates` liest ihn, um zu entscheiden, ob ein Team
  // nahe der Kader-Mindestgröße einen Spieler abgeben darf, den es ersetzen müsste.
  const bagatellgrenze = Math.max(1, salaryTotal * 0.05);
  const fehlbetrag = roherFehlbetrag >= bagatellgrenze ? round1(roherFehlbetrag) : 0;

  // Normiert auf die Abbuchung selbst: „welcher Anteil dessen, was das Saisonende abbucht, ist
  // nicht gedeckt". Kein freier Skalierungsfaktor — 1 hieße „nichts davon ist gedeckt". Am
  // Spielstand spannt das 0,08 (Terrible Teachers) bis 0,37 (Mayhem Mavericks) auf; die Konsumenten
  // (Schwellen-Senkung, Auswahl-Schleife, Begründungsbonus) arbeiten mit genau dieser Spanne.
  const score = fehlbetrag > 0 ? round3(Math.min(1, fehlbetrag / abbuchung)) : 0;
  return { score, fehlbetrag };
}

/**
 * Baut die Frühwarnung für ein Team aus dem Spielstand. Cash/Gehalt kommen vom Aufrufer, weil jede
 * aufrufende Stelle (Verkaufsvorschau, Marktplan) ihre Gehaltssumme schon in der Hand hat — eine
 * eigene Neuberechnung hier würde nur riskieren, gegen eine ANDERE Summe zu warnen als die, mit der
 * die Verkaufslogik rechnet.
 */
export function buildSchuldenlastFruehwarnung(
  gameState: GameState,
  teamId: string,
  input: { cash: number; salaryTotal: number },
): SchuldenlastFruehwarnung {
  // Kurzschluss VOR den Loan-Service-Zugriffen: `assessTeamSellRunwayPressure` läuft auch gegen
  // Zustände ohne `seasonState` (Tests, reparierte Spielstände) — dieselbe Vorsicht wie der
  // `?? []`-Schutz in `getTeamCashSalarySoftTarget`. Und fachlich gilt sowieso: keine Kredite in
  // der Liga → für niemanden eine Schulden-Frühwarnung, der teurere Umsatz-Proxy entfällt gleich mit.
  const hatKredite = (gameState.seasonState?.loans ?? []).some((loan) => loan.borrowerTeamId === teamId);
  if (!hatKredite) {
    return { teamId, schuld: 0, kreditrate: 0, umsatz: 0, fehlbetrag: 0, kreditrahmen: 0, score: 0 };
  }
  const schuld = getTeamOwedOutstandingDebt(gameState, teamId);
  const kreditrate = getTeamAnnualLoanInstallment(gameState, teamId);
  const umsatz = estimateTeamAnnualRevenue(gameState, teamId);
  // Dieselbe Rechnung wie das echte Kreditangebot (`buildLoanOffers`), damit die Frühwarnung nicht
  // mit einem Rahmen argumentiert, den die Bank am Schalter gar nicht gewährt.
  //
  // Der Kader-Marktwert braucht `players` UND `rosters`; die Druckmessung läuft aber auch gegen
  // Zustände, die beides nicht führen (Tests, reparierte Spielstände) — dieselbe Vorsicht wie der
  // `?? []`-Schutz in `getTeamCashSalarySoftTarget`. Ohne Kader kein Teamwert und damit kein
  // Rahmen: das ist die vorsichtigere Annahme (warnt eher) und nicht ein Absturz.
  const hatKaderdaten = Array.isArray(gameState.players) && Array.isArray(gameState.rosters);
  const kreditrahmen = hatKaderdaten
    ? computeBorrowingCapacity({
        cash: input.cash,
        marketValueTotal: resolveTeamRosterMarketValue(gameState, teamId),
        annualRevenue: umsatz,
        currentOutstandingDebt: schuld,
      })
    : 0;
  const { score, fehlbetrag } = resolveSchuldenlastDruck({
    cash: input.cash,
    salaryTotal: input.salaryTotal,
    schuld,
    kreditrate,
    umsatz,
  });
  return { teamId, schuld, kreditrate, umsatz, fehlbetrag, kreditrahmen, score };
}
