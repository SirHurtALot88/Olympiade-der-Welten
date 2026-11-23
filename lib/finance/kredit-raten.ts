/**
 * KREDITRATEN JE SPIELTAG (22.11., docs/design/kredite-modern-22-11.md Abschnitt 4 und "Bau"; Finanzkonzept V2: "Alles Laufende
 * fliesst je Spieltag, Kreditraten in 20 Raten").
 *
 * Bisher buchte `applyLoanSettlement` die Jahresrate EINMAL am Saisonende. In einer Saison mit Stempel `seasonState.kreditRegel = raten`
 * zahlt jeder Kredit je Spieltag eine gleichbleibende Rate (Annuitaet, Zins je Saison / N). Zins und Tilgung stehen als Posten in der
 * Spieltagsbuchung (`spieltagFinanzen`, Felder `kreditZins`, `kreditTilgung`, `kreditEingang`, `kredit`); in der GuV zaehlt nur der Zins.
 *
 * MUSTER: `lib/marketing/marketing-regel.ts` -- der Stempel steht IM SPIELSTAND und wird genau zweimal gesetzt, beim Anlegen eines Spiels
 * und beim Saisonwechsel. Ein bestehender Spielstand rechnet seine laufende Saison wie bisher (Rate am Saisonende) zu Ende; ab dem
 * naechsten Saisonwechsel gilt der Schalter. Jeder Rechenweg fragt `kreditRatenAktiv(gameState)`, nie die Variable.
 *
 * SCHALTER `OLY_KREDIT_RATEN` (nur Server, deploy/hetzner/docker-compose.yml + .env; kein NEXT_PUBLIC):
 *   nicht gesetzt | "an"   neue Saisons bekommen "raten" (Standard)
 *   "aus"                  Rueckweg: neue Saisons bekommen "saisonende"; gestempelte Saisons rechnen weiter wie gestempelt
 *
 * KEINE DOPPELBUCHUNG, KEINE LUECKE BEIM WECHSEL: je Saison bucht genau EIN Weg. In einer "raten"-Saison ueberspringt die Saisonende-
 * Abrechnung (`applyLoanSettlement`) jeden Kredit, den die Spieltage buchen; in einer "saisonende"-Saison bucht nur sie, und ein
 * Kredit, der schon je Spieltag lief, wird dabei in die Jahresrate zurueckgerechnet. Die Umrechnung eines alten Kredits in Raten
 * (`alsRatenKredit`) ist rein und deterministisch, damit Anzeige und Buchung dieselbe Rate sehen (gezeigt = gebucht).
 *
 * ZAHLUNGSAUSFALL je Spieltag: wie am Saisonende wird bezahlt, was da ist (Zins zuerst); der Rest wird samt 5 % Strafzins auf die
 * Restschuld geschlagen, der Vorstand verliert EINMAL je Kredit und Saison einen Vertrauenspunkt, und nach einem Viertel der Saison
 * verpasster Raten (bei 20 Spieltagen: 5) gilt der Kredit als geplatzt.
 *
 * DIESE DATEI IST CLIENT-SICHER (kein node:fs, keine Dienste) und importiert `loan-service` nicht (der importiert sie).
 */
import type { GameState, LoanRecord, SeasonState, SpieltagKreditPosten } from "@/lib/data/olyDataTypes";
import { istJeSpieltagSaison, spieltageDerSaison } from "@/lib/finance/finanzen-je-spieltag";

export type KreditRegel = NonNullable<SeasonState["kreditRegel"]>;
export type KreditRegelWert = KreditRegel["regel"];

/** Strafzins auf den nicht gezahlten Teil einer Rate (wie am Saisonende). */
export const KREDIT_STRAFZINS = 0.05;
/** Anteil der Saison an verpassten Raten, ab dem ein Kredit als geplatzt gilt. */
export const KREDIT_AUSFALL_ANTEIL = 0.25;

function leseSchalter(wert: string | undefined): KreditRegelWert | null {
  const w = (wert ?? "").trim().toLowerCase();
  if (w === "") return null;
  if (w === "aus" || w === "0" || w === "false" || w === "nein" || w === "off" || w === "alt" || w === "saisonende") return "saisonende";
  return "raten";
}

/** Nur Server-Variable: der Stempel wird auf dem Server gesetzt, der Browser liest ihn aus dem Spielstand. */
export function kreditRatenSchalter(): KreditRegelWert {
  return leseSchalter(process.env.OLY_KREDIT_RATEN) ?? "raten";
}

/** Der Stempel einer NEU beginnenden Saison. */
export function kreditRegelFuerNeueSaison(seasonId: string): KreditRegel {
  return { seasonId, regel: kreditRatenSchalter() };
}

/** Setzt den Stempel beim ANLEGEN eines Spiels. Idempotent: ein Stempel derselben Saison bleibt. */
export function stempleKreditRegelBeimAnlegen(gameState: GameState): GameState {
  const seasonId = gameState.seasonState?.seasonId ?? gameState.season?.id;
  if (!seasonId || !gameState.seasonState) return gameState;
  if (gameState.seasonState.kreditRegel?.seasonId === seasonId) return gameState;
  return { ...gameState, seasonState: { ...gameState.seasonState, kreditRegel: kreditRegelFuerNeueSaison(seasonId) } };
}

/**
 * LADE-MIGRATION: ein Spielstand ohne gueltigen Stempel der laufenden Saison bekommt "saisonende" -- die Saison laeuft wie bisher
 * zu Ende, ab dem naechsten Saisonwechsel gilt der Schalter. Rein und idempotent.
 */
export function stempleKreditRegelNachLaden<T extends { seasonState?: SeasonState | null }>(gameState: T): T {
  if (!gameState?.seasonState) return gameState;
  const seasonId = gameState.seasonState.seasonId;
  if (!seasonId || gameState.seasonState.kreditRegel?.seasonId === seasonId) return gameState;
  return {
    ...gameState,
    seasonState: { ...gameState.seasonState, kreditRegel: { seasonId, regel: "saisonende" as const } },
  };
}

type StempelQuelle =
  | {
      season?: { id?: string; matchdayIds?: readonly string[] } | null;
      seasonState?: (Pick<SeasonState, "seasonId"> & Partial<Pick<SeasonState, "kreditRegel" | "finanzenJeSpieltag">>) | null;
    }
  | null
  | undefined;

/** Der gueltige Stempel der laufenden Saison, sonst `null`. */
export function gueltigerKreditStempel(gameState: StempelQuelle): KreditRegel | null {
  const stempel = gameState?.seasonState?.kreditRegel;
  const seasonId = gameState?.seasonState?.seasonId ?? gameState?.season?.id;
  if (!stempel || !seasonId || stempel.seasonId !== seasonId) return null;
  return stempel;
}

/** Zahlen die Kredite in dieser Saison je Spieltag? Gueltiger Stempel "raten" UND Finanzen je Spieltag (dort wird gebucht). */
export function kreditRatenAktiv(gameState: StempelQuelle): boolean {
  const stempel = gueltigerKreditStempel(gameState);
  if (!stempel || stempel.regel !== "raten") return false;
  return istJeSpieltagSaison(gameState as Parameters<typeof istJeSpieltagSaison>[0]);
}

/** Die Zahl der Raten je Saison (Spieltage des Spielplans), wenn die Saison je Spieltag tilgt; sonst `null`. */
export function ratenJeSaisonFuer(gameState: StempelQuelle): number | null {
  if (!kreditRatenAktiv(gameState)) return null;
  const n = spieltageDerSaison(gameState as Pick<GameState, "season">);
  return n > 0 ? n : null;
}

// --- Rechnung ---------------------------------------------------------------------------------------------------------------------

function r1(x: number): number {
  return Math.round(x * 10) / 10;
}
function r4(x: number): number {
  return Math.round(x * 10000) / 10000;
}

/** Die gleichbleibende Rate je Spieltag: Annuitaet ueber `saisons x n` Raten mit Zins `zinsJeSaison / n` je Rate (4 Nachkommastellen). */
export function rateJeSpieltagFuer(principal: number, zinsJeSaison: number, n: number, saisons: number): number {
  const kapital = Math.max(0, principal);
  const raten = Math.max(1, Math.round(saisons) * n);
  if (kapital === 0 || !(n > 0)) return 0;
  const i = zinsJeSaison / n;
  return r4(i === 0 ? kapital / raten : (kapital * i) / (1 - Math.pow(1 + i, -raten)));
}

/** Jahres-Annuitaet im alten Weg (eine Rate je Saison), fuer die Rueckrechnung eines Kredits in die Jahresrate. */
function jahresRate(principal: number, zinsJeSaison: number, saisons: number): number {
  const s = Math.max(1, Math.round(saisons));
  const kapital = Math.max(0, principal);
  if (kapital === 0) return 0;
  return r1(zinsJeSaison === 0 ? kapital / s : (kapital * zinsJeSaison) / (1 - Math.pow(1 + zinsJeSaison, -s)));
}

/** Konditionen eines Kredits in der Raten-Saison: Rate je Spieltag, Jahressumme, Zahl der Raten. */
export function ratenKonditionen(principal: number, zinsJeSaison: number, saisons: number, n: number) {
  const laufzeit = Math.max(1, Math.round(saisons));
  const rate = rateJeSpieltagFuer(principal, zinsJeSaison, n, laufzeit);
  return { rateJeSpieltag: rate, installmentPerSeason: r1(rate * n), ratenGesamt: laufzeit * n, ratenJeSaison: n };
}

export type RatenSchritt = { zins: number; tilgung: number; zahlung: number; rest: number };

/** EIN Ratenschritt ohne Kassenbeschraenkung: die letzte Rate loest den Rest samt Zins ab. */
export function ratenSchritt(restschuld: number, zinsJeSaison: number, n: number, rate: number, ratenOffen: number): RatenSchritt {
  const zins = (restschuld * zinsJeSaison) / n;
  const zahlung = ratenOffen <= 1 ? restschuld + zins : Math.min(rate, restschuld + zins);
  const tilgung = Math.max(0, zahlung - zins);
  return { zins, tilgung, zahlung, rest: Math.max(0, restschuld - tilgung) };
}

export function istRatenKredit(loan: Pick<LoanRecord, "ratenJeSaison" | "ratenOffen" | "rateJeSpieltag">): boolean {
  return (loan.ratenJeSaison ?? 0) > 0 && loan.ratenOffen != null && loan.rateJeSpieltag != null;
}

/** Ein alter Kredit (Jahresrate) als Raten-Kredit: Restschuld und Restlaufzeit bleiben, die Rate wird neu auf `n` Spieltage verteilt. */
export function alsRatenKredit(loan: LoanRecord, n: number): LoanRecord {
  if (istRatenKredit(loan) || !(n > 0)) return loan;
  const saisons = Math.max(1, loan.seasonsRemaining);
  const k = ratenKonditionen(loan.principalOutstanding, loan.interestRatePerSeason, saisons, n);
  return {
    ...loan,
    ratenJeSaison: n,
    ratenOffen: k.ratenGesamt,
    rateJeSpieltag: k.rateJeSpieltag,
    installmentPerSeason: k.installmentPerSeason,
    seasonsRemaining: saisons,
  };
}

/** Ein Raten-Kredit zurueck in die Jahresrate (Saison ohne Raten-Stempel). */
export function alsJahresrateKredit(loan: LoanRecord): LoanRecord {
  if (!istRatenKredit(loan)) return loan;
  const n = loan.ratenJeSaison ?? 1;
  const saisons = Math.max(1, Math.ceil((loan.ratenOffen ?? 0) / n));
  const rest: LoanRecord = { ...loan };
  delete rest.ratenJeSaison;
  delete rest.ratenOffen;
  delete rest.rateJeSpieltag;
  delete rest.ratenRest;
  return {
    ...rest,
    seasonsRemaining: saisons,
    installmentPerSeason: jahresRate(loan.principalOutstanding, loan.interestRatePerSeason, saisons),
  };
}

/**
 * Die Sicht, in der die Spieltage diesen Kredit buchen: nur in einer Raten-Saison und nur fuer aktive Kredite (ein alter Kredit wird
 * dabei umgerechnet, ein Raten-Kredit bleibt). In einer Saison ohne Raten `null` -- dann bucht die Saisonende-Abrechnung.
 */
export function ratenSicht(gameState: GameState, loan: LoanRecord): LoanRecord | null {
  if (loan.status !== "active") return null;
  const n = ratenJeSaisonFuer(gameState);
  if (n == null) return null;
  return alsRatenKredit(loan, n);
}

// --- Ledger lesen -----------------------------------------------------------------------------------------------------------------

function zeilenDerSaison(gameState: Pick<GameState, "season" | "seasonState">, teamId?: string) {
  const id = gameState.seasonState?.seasonId ?? gameState.season?.id;
  return (gameState.seasonState?.spieltagFinanzen ?? []).filter((z) => z.seasonId === id && (teamId == null || z.teamId === teamId));
}

/** Was ein Kredit in der laufenden Saison schon je Spieltag gezahlt hat (aus dem Ledger). */
export function kreditSaisonGebucht(
  gameState: Pick<GameState, "season" | "seasonState">,
  loanId: string,
  teamId?: string,
): { raten: number; zins: number; tilgung: number; ausfall: number } {
  let raten = 0;
  let zins = 0;
  let tilgung = 0;
  let ausfall = 0;
  for (const zeile of zeilenDerSaison(gameState, teamId)) {
    for (const p of zeile.kredit ?? []) {
      if (p.loanId !== loanId) continue;
      raten += 1;
      zins += p.zins;
      tilgung += p.tilgung;
      ausfall += p.ausfall ?? 0;
    }
  }
  return { raten, zins: r1(zins), tilgung: r1(tilgung), ausfall: r1(ausfall) };
}

/** Spieltage der Saison, die fuer dieses Team noch NICHT gebucht sind. */
export function offeneSpieltageDesTeams(gameState: Pick<GameState, "season" | "seasonState">, teamId: string): number {
  const n = spieltageDerSaison(gameState);
  return Math.max(0, n - zeilenDerSaison(gameState, teamId).length);
}

export type KreditSaisonZerlegung = {
  /** Die Saison-Rate (Zins + Tilgung), gebucht plus noch offen. */
  rate: number;
  zins: number;
  tilgung: number;
  /** Ob die Zahlen je Spieltag gebucht werden (Raten-Saison). */
  jeSpieltag: boolean;
  /** Raten, die in dieser Saison schon gebucht sind. */
  gebuchteRaten: number;
};

/**
 * DIE EINE ZERLEGUNG: was ein aktiver Kredit in der laufenden Saison kostet -- Rate, Zins, Tilgung. In einer Raten-Saison ist es das,
 * was die Spieltage schon gebucht haben, plus die Raten der noch offenen Spieltage (laufende Restschuld); sonst die Jahresrate. GuV,
 * Verpflichtungen, KI-Planung und Seite lesen alle diese Funktion.
 */
export function kreditSaisonZerlegung(gameState: GameState, loan: LoanRecord): KreditSaisonZerlegung {
  const sicht = ratenSicht(gameState, loan);
  if (!sicht) {
    // Wie bisher gerundet (`Number(x.toFixed(1))`), damit der alte Weg bit-gleich bleibt.
    const zins = Number((loan.principalOutstanding * loan.interestRatePerSeason).toFixed(1));
    const rate = Number((loan.installmentPerSeason ?? 0).toFixed(1));
    return { rate, zins, tilgung: Number((rate - zins).toFixed(1)), jeSpieltag: false, gebuchteRaten: 0 };
  }
  const n = sicht.ratenJeSaison ?? 1;
  const gebucht = kreditSaisonGebucht(gameState, loan.loanId, loan.borrowerTeamId);
  const offen = Math.min(sicht.ratenOffen ?? 0, offeneSpieltageDesTeams(gameState, loan.borrowerTeamId));
  let rest = sicht.principalOutstanding;
  let zins = gebucht.zins;
  let tilgung = gebucht.tilgung;
  let ratenOffen = sicht.ratenOffen ?? 0;
  for (let k = 0; k < offen && rest > 0.00005; k += 1) {
    const s = ratenSchritt(rest, sicht.interestRatePerSeason, n, sicht.rateJeSpieltag ?? 0, ratenOffen);
    zins += s.zins;
    tilgung += s.tilgung;
    rest = s.rest;
    ratenOffen -= 1;
  }
  return { rate: r1(zins + tilgung), zins: r1(zins), tilgung: r1(tilgung), jeSpieltag: true, gebuchteRaten: gebucht.raten };
}

/** Zins und Tilgung, die ein Team in dieser Saison je Spieltag auf Kredite gezahlt hat, die nicht mehr laufen (getilgt oder geplatzt). */
export function kreditBeendeteKredite(gameState: GameState, teamId: string): { zins: number; tilgung: number } {
  if (!kreditRatenAktiv(gameState)) return { zins: 0, tilgung: 0 };
  const aktiv = new Set(
    (gameState.seasonState.loans ?? []).filter((l) => l.borrowerTeamId === teamId && l.status === "active").map((l) => l.loanId),
  );
  const ids = new Set<string>();
  for (const zeile of zeilenDerSaison(gameState, teamId)) for (const p of zeile.kredit ?? []) if (!aktiv.has(p.loanId)) ids.add(p.loanId);
  let zins = 0;
  let tilgung = 0;
  for (const id of ids) {
    const g = kreditSaisonGebucht(gameState, id, teamId);
    zins += g.zins;
    tilgung += g.tilgung;
  }
  return { zins: r1(zins), tilgung: r1(tilgung) };
}

/** Nur der Zins der beendeten Kredite (GuV). */
export function kreditZinsBeendeterKredite(gameState: GameState, teamId: string): number {
  return kreditBeendeteKredite(gameState, teamId).zins;
}

/**
 * Die ganze Tilgung dieser Saison in einer Raten-Saison (gebucht plus offen, laufende und beendete Kredite): Bilanzbewegung, die in der
 * Kasse steckt, aber nicht in der GuV. 0 ohne Raten-Saison. Die Prognose der Finanzseite rechnet damit.
 */
export function kreditSaisonTilgungRaten(gameState: GameState, teamId: string): number {
  if (!kreditRatenAktiv(gameState)) return 0;
  const laufend = (gameState.seasonState.loans ?? [])
    .filter((l) => l.borrowerTeamId === teamId && l.status === "active")
    .reduce((summe, l) => summe + kreditSaisonZerlegung(gameState, l).tilgung, 0);
  return r1(laufend + kreditBeendeteKredite(gameState, teamId).tilgung);
}

/** Die naechste Spieltagsrate eines Teams: Summe der Raten seiner laufenden Kredite (negativ) und der Rueckfluss aus verliehenen Krediten (positiv). */
export function erwarteteKreditRate(gameState: GameState, teamId: string): { rate: number; eingang: number } {
  let rate = 0;
  let eingang = 0;
  for (const loan of gameState.seasonState.loans ?? []) {
    const sicht = ratenSicht(gameState, loan);
    if (!sicht || (sicht.ratenOffen ?? 0) <= 0) continue;
    const n = sicht.ratenJeSaison ?? 1;
    const s = ratenSchritt(sicht.principalOutstanding, sicht.interestRatePerSeason, n, sicht.rateJeSpieltag ?? 0, sicht.ratenOffen ?? 0);
    if (sicht.borrowerTeamId === teamId) rate -= s.zahlung;
    if (sicht.lenderType === "team" && sicht.lenderTeamId === teamId) eingang += s.zahlung;
  }
  return { rate: r1(rate), eingang: r1(eingang) };
}

// --- Tilgungsplan (Anzeige) -------------------------------------------------------------------------------------------------------

export type PlanSaison = { saison: number; von: number; bis: number; raten: number; zins: number; tilgung: number; rest: number };

export type KreditPlan = {
  rate: number;
  raten: number;
  zinsenGesamt: number;
  saisons: PlanSaison[];
  /** Je Rate Zins, Tilgung und Restschuld danach (fuer das Diagramm). */
  jeRate: Array<{ zins: number; tilgung: number; rest: number }>;
};

/**
 * Tilgungsplan ab einer Restschuld: `raten` Raten, die erste am Spieltag `start` (1-basiert) der laufenden Saison, danach Saison fuer
 * Saison. Dieselbe Schrittrechnung wie die Buchung (`ratenSchritt`), damit der Plan zeigt, was gebucht wird.
 */
export function kreditPlan(input: {
  restschuld: number;
  zinsJeSaison: number;
  n: number;
  raten: number;
  rate: number;
  start: number;
  /** Nummer der Saison, in der `start` liegt (Beschriftung der Plan-Zeilen); Standard 1. */
  startSaison?: number;
}): KreditPlan {
  const { zinsJeSaison, n } = input;
  let rest = Math.max(0, input.restschuld);
  let offen = Math.max(0, Math.round(input.raten));
  let spieltag = Math.max(1, Math.round(input.start));
  const saisons: PlanSaison[] = [];
  const jeRate: KreditPlan["jeRate"] = [];
  let zinsenGesamt = 0;
  let saison = input.startSaison ?? 1;
  let aktuell: PlanSaison | null = null;
  while (offen > 0 && rest > 0.00005) {
    if (!aktuell || spieltag > n) {
      if (spieltag > n) {
        saison += 1;
        spieltag = 1;
      }
      aktuell = { saison, von: spieltag, bis: spieltag, raten: 0, zins: 0, tilgung: 0, rest };
      saisons.push(aktuell);
    }
    const s = ratenSchritt(rest, zinsJeSaison, n, input.rate, offen);
    rest = s.rest;
    aktuell.raten += 1;
    aktuell.zins += s.zins;
    aktuell.tilgung += s.tilgung;
    aktuell.rest = rest;
    aktuell.bis = spieltag;
    zinsenGesamt += s.zins;
    jeRate.push({ zins: s.zins, tilgung: s.tilgung, rest });
    spieltag += 1;
    offen -= 1;
  }
  return { rate: input.rate, raten: jeRate.length, zinsenGesamt, saisons, jeRate };
}

// --- Buchung ----------------------------------------------------------------------------------------------------------------------

export type KreditTeamPatch = {
  /** <= 0, in Cash-Betraegen (0,1 gerundet). */
  kreditZins: number;
  kreditTilgung: number;
  /** >= 0: Rueckfluss aus Team-Krediten an diesen Geber. */
  kreditEingang: number;
  posten: SpieltagKreditPosten[];
  /** Summe der drei Felder: kommt auf `cashDelta` der Zeile. */
  cashDelta: number;
};

export type KreditRatenBuchung = {
  /** `null`, wenn sich nichts geaendert hat. */
  loans: LoanRecord[] | null;
  boardConfidence: NonNullable<SeasonState["boardConfidence"]> | null;
  jeTeam: Map<string, KreditTeamPatch>;
  /** Rueckfluss an einen Geber, dessen Spieltagszeile schon steht (kommt nicht in eine neue Zeile, aber auf die Kasse). */
  direkterEingang: Map<string, number>;
};

function leererPatch(): KreditTeamPatch {
  return { kreditZins: 0, kreditTilgung: 0, kreditEingang: 0, posten: [], cashDelta: 0 };
}

/**
 * Bucht die Raten dieses Spieltags fuer alle Kredite, deren Kreditnehmer eine NEUE Spieltagszeile bekommt (`verfuegbar` = Kasse des Teams
 * samt der anderen Fluesse dieses Spieltags). Rein: gibt die fortgeschriebenen Kredite und die Zeilen-Zuschlaege zurueck, schreibt nichts.
 * Ohne Raten-Saison oder ohne Kredit ein leeres Ergebnis. Idempotent ueber das Ledger: wer schon eine Zeile fuer den Spieltag hat, ist
 * nicht in `verfuegbar` und wird nicht noch einmal belastet.
 */
export function bucheKreditRaten(
  gameState: GameState,
  verfuegbar: Map<string, number>,
  neueZeilenTeams: ReadonlySet<string>,
): KreditRatenBuchung {
  const leer: KreditRatenBuchung = { loans: null, boardConfidence: null, jeTeam: new Map(), direkterEingang: new Map() };
  const n = ratenJeSaisonFuer(gameState);
  const alle = gameState.seasonState.loans ?? [];
  if (n == null || alle.length === 0) return leer;

  const kasse = new Map(verfuegbar);
  const jeTeam = new Map<string, KreditTeamPatch>();
  const direkterEingang = new Map<string, number>();
  const patch = (teamId: string) => jeTeam.get(teamId) ?? jeTeam.set(teamId, leererPatch()).get(teamId)!;
  const schwelle = Math.max(1, Math.ceil(n * KREDIT_AUSFALL_ANTEIL));
  const boardConfidence = { ...(gameState.seasonState.boardConfidence ?? {}) };
  let geaendert = false;
  let vertrauenGeaendert = false;

  const neueLoans = alle.map((loan) => {
    const sicht = ratenSicht(gameState, loan);
    if (!sicht || !neueZeilenTeams.has(loan.borrowerTeamId)) return loan;
    const rate = sicht.rateJeSpieltag ?? 0;
    const offen = sicht.ratenOffen ?? 0;
    if (offen <= 0) return loan;
    geaendert = true;

    const rest0 = sicht.ratenRest ?? { zins: 0, tilgung: 0 };
    const s = ratenSchritt(sicht.principalOutstanding, sicht.interestRatePerSeason, n, rate, offen);
    const rohZins = s.zins + rest0.zins;
    const rohTilgung = s.tilgung + rest0.tilgung;
    const zinsCash = r1(rohZins);
    const tilgCash = r1(rohTilgung);
    const rate0 = r1(zinsCash + tilgCash);
    const frei = Math.max(0, kasse.get(sicht.borrowerTeamId) ?? 0);

    let gezahltZins = zinsCash;
    let gezahltTilgung = tilgCash;
    let ausfall = 0;
    let neueRestschuld = r4(s.rest);
    let neueRestZins = rohZins - zinsCash;
    let neueRestTilg = rohTilgung - tilgCash;
    let missed = sicht.missedPayments;
    let status: LoanRecord["status"] = sicht.status;
    let ratenOffenNeu = offen - 1;

    if (frei + 0.0001 < rate0) {
      // Zahlungsausfall: bezahlt wird, was da ist (Zins zuerst), der Rest kommt samt Strafzins auf die Restschuld.
      const bezahlt = Math.floor(frei * 10) / 10;
      gezahltZins = Math.min(zinsCash, bezahlt);
      gezahltTilgung = Math.max(0, bezahlt - gezahltZins);
      const fehl = r1(rate0 - bezahlt);
      ausfall = r1(fehl * (1 + KREDIT_STRAFZINS));
      neueRestschuld = r4(Math.max(0, sicht.principalOutstanding - gezahltTilgung + ausfall));
      // Nach dem letzten Ratentermin bleibt eine Rate, die den kapitalisierten Rest loest.
      if (ratenOffenNeu <= 0) ratenOffenNeu = 1;
      neueRestZins = 0;
      neueRestTilg = 0;
      missed += 1;
      if (missed >= schwelle) status = "defaulted";
      // Der Vorstand merkt es EINMAL je Kredit und Saison.
      if (kreditSaisonGebucht(gameState, loan.loanId, loan.borrowerTeamId).ausfall === 0) {
        const aktuell = boardConfidence[sicht.borrowerTeamId];
        const wert = Math.min(10, Math.max(1, r1((aktuell?.value ?? 5) - 1)));
        boardConfidence[sicht.borrowerTeamId] = {
          teamId: sicht.borrowerTeamId,
          value: wert,
          pressure: Math.min(10, Math.max(1, r1(11 - wert))),
          warnings: aktuell?.warnings ?? [],
        };
        vertrauenGeaendert = true;
      }
    } else if (ratenOffenNeu <= 0 || neueRestschuld <= 0.00005) {
      neueRestschuld = 0;
      status = "paid";
      ratenOffenNeu = 0;
    }

    const zahlung = r1(gezahltZins + gezahltTilgung);
    kasse.set(sicht.borrowerTeamId, (kasse.get(sicht.borrowerTeamId) ?? 0) - zahlung);
    const p = patch(sicht.borrowerTeamId);
    p.kreditZins = r1(p.kreditZins - gezahltZins);
    p.kreditTilgung = r1(p.kreditTilgung - gezahltTilgung);
    p.cashDelta = r1(p.cashDelta - zahlung);
    p.posten.push({ loanId: sicht.loanId, zins: r1(gezahltZins), tilgung: r1(gezahltTilgung), ...(ausfall > 0 ? { ausfall } : {}) });

    // Team-Kredit: der Geber kassiert genau das, was eingezogen wurde (er traegt das Ausfallrisiko, keine Phantom-Gutschrift).
    if (sicht.lenderType === "team" && sicht.lenderTeamId && zahlung > 0) {
      if (neueZeilenTeams.has(sicht.lenderTeamId)) {
        const q = patch(sicht.lenderTeamId);
        q.kreditEingang = r1(q.kreditEingang + zahlung);
        q.cashDelta = r1(q.cashDelta + zahlung);
      } else {
        direkterEingang.set(sicht.lenderTeamId, r1((direkterEingang.get(sicht.lenderTeamId) ?? 0) + zahlung));
      }
    }

    const fortgeschrieben: LoanRecord = {
      ...sicht,
      principalOutstanding: neueRestschuld,
      ratenOffen: ratenOffenNeu,
      seasonsRemaining: Math.max(0, Math.ceil(ratenOffenNeu / n)),
      missedPayments: missed,
      status,
      ratenRest: { zins: r4(neueRestZins), tilgung: r4(neueRestTilg) },
    };
    return fortgeschrieben;
  });

  if (!geaendert) return leer;
  return { loans: neueLoans, boardConfidence: vertrauenGeaendert ? boardConfidence : null, jeTeam, direkterEingang };
}
