/**
 * VERTRAGSWERT W (Chris 25.11., docs/design/kauf-vertrag-gesamtkonzept-25-11.md Abschnitte 3-4 und 12, Bau
 * docs/design/vertragswert-bau-25-11.md). Eine Rechnung fuer Kaufen, Laufzeit waehlen, Verlaengern, Halten und Verkaufen.
 *
 *   W = Σ ueber die Vertragsjahre d^(t-1) x ( B x M(t) + F − G(t) )  +  Fortsetzung am Vertragsende
 *
 *   G(t)  Gehalt im Vertragsjahr t laut JAHRESPLAN (front / ausgewogen / back), nicht linear.
 *   M(t)  Marktgehalt der Leistung im Jahr t: Gehaltsforderung des Spielers x Marktwert-Verlauf x Leistungsanteil.
 *   B     Bedeutung fuer dieses Team (Staerke nach Team-Bedarf gegen den Kader-Median, 0,35 bis 1,6, wie die Verkaufsabwaegung).
 *   F     Formkarten-Beitrag in C je Saison: der Spieler bringt Formkarten seiner Klassenfarbe mit. Wert = FORMKARTE_WERT x Bedarf
 *         der Farbe (Anteil der Disziplinen dieser Farbe x 4) / (1 + Spieler dieser Farbe im uebrigen Kader). Fehlt die Farbe im
 *         Kader, ist der Beitrag voll; jeder weitere Traeger derselben Farbe halbiert, drittelt ... ihn (Grenznutzen).
 *   d     Geduld des Teams je Jahr (0,90 bis 0,97, aus GM und Team-Matrix).
 *   Fortsetzung am Vertragsende (Horizont 5 Saisons): das Bessere aus „gehen lassen“ (Abgangswert A = 0,89 x Marktwert, der
 *         abloesefreie Verkauf am Vertragsende) und „zu Marktpreisen verlaengern“ bis zum Horizont, danach A.
 *
 * W wird fuer drei Verlaeufe gerechnet (Marktwert je Saison besser / gleich / schlechter) und nach der ERWARTUNG gewichtet
 * (`erwartungsVerlauf`: Potenzial, Trainingsguete, Trainingsvorlieben, Leistung im Bracket, Form, Charakter). Der Wert der Flexibilitaet
 * eines kurzen Vertrags faellt daraus von selbst heraus: im schlechten Verlauf geht der Spieler nach dem kurzen Vertrag zum
 * Abgangswert, im guten verlaengert man (teurer).
 *
 * KEINE DOPPELZAEHLUNG: das Restgehalt ist Kosten des Verkaufs (Netto = Angebot − Restgehalt) — und genau dieselben Gehaelter stehen
 * beim Halten mit Minus in W. Im Vergleich Netto gegen W hebt sich das Gehalt bis auf den Zeitwert auf; es entscheidet, ob das Angebot
 * mehr bringt als Nutzen der Restjahre plus Fortsetzung. Der Jahresplan bestimmt, wie viel sofort in der Kasse ankommt.
 *
 * Rein: keine Spielstand-Lesung (die steht in `vertragswert-spielstand.ts`). Der Rabatt nach Laufzeit und Spielerwunsch wird NICHT hier
 * gerechnet (Chris 25.11.: „haben wir ja schon drin“) — die Aufrufer reichen das Jahresgehalt je (Laufzeit, Form) aus der bestehenden
 * Logik herein (`gehaltFuer`).
 */
import type { ContractShape } from "@/lib/data/olyDataTypes";
import { buildShapeWeights } from "@/lib/market/contract-shape-weights";

export const VERTRAGSWERT = {
  /** Planungshorizont in Saisons (laengster Vertrag). */
  HORIZONT: 5,
  /** Abgangswert am Vertragsende: Anteil des Marktwerts (gemessen 0,89 x MW, `buildContractExitValue`). */
  ABGANGS_FAKTOR: 0.89,
  /** Marktgehalt, wenn der Spieler keine Gehaltsforderung traegt: Liga-Median Gehalt / Marktwert. */
  MARKTGEHALT_ANTEIL: 0.27,
  /** Marktwert-Aenderung je Saison im besseren / schlechteren Verlauf (Spieler ohne Teamerfahrung, gekauft). Kalibriert 25.11. */
  VERLAUF_RATE: 0.18,
  /** Ein Spieler, der schon eine Saison im Team war, ist bekannt: die Verlaeufe streuen weniger („erst testen, dann binden“). */
  VERLAUF_RATE_BEKANNT: 0.135,
  /** Grundgewichte der Verlaeufe: Chris' Entwicklungsverteilung (30 % besser, 40 % gleich, 30 % schlechter). */
  P_BESSER: 0.3,
  P_SCHLECHTER: 0.3,
  /** Hoechste Verschiebung der Gewichte durch die Signale (± Prozentpunkte / 100). */
  SIGNAL_MAX: 0.2,
  /** Ab dieser Verschiebung zeigt die Erwartung „besser“ bzw. „schlechter“. */
  STUFE_SCHWELLE: 0.06,
  /** Verlaengerung am Vertragsende: Aufschlag auf das Marktgehalt (der Spieler weiss, was er wert ist). */
  NACHVERHANDLUNG: 1.05,
  /** Formkarten-Beitrag einer fehlenden Farbe bei mittlerem Bedarf, in C je Saison (Setzwert, Messung Abschnitt 5 der Bau-Doku). */
  FORMKARTE_WERT: 1.0,
  /** Gewicht des guenstigeren Ausstiegs (front-loaded) fuer handelsfreudige Teams: Anteil des mittleren Restgehalt-Unterschieds. */
  HANDEL_AUSSTIEG: 0.15,
  /**
   * Wunschfenster des Spielers (kurz 1-2, mittel 2-4, lang 3-5): ausserhalb waehlt die KI nur, wenn W dort mindestens diesen Anteil
   * eines Jahres-Marktgehalts mehr bringt („klar verfehlt“ kostet sein Vertrauen und ist eine bewusste Entscheidung).
   */
  WUNSCH_SCHWELLE: 1,
  /** Innerhalb des Fensters: von der Ideallaufzeit und Wunschform weicht die KI ab, wenn W dort diesen Anteil mehr bringt. */
  WUNSCH_SCHWELLE_INNEN: 1,
  /** Geländer: hoechstens dieser Anteil der Vertraege eines Teams endet in derselben Saison (ab 5 Vertraegen). */
  GELAENDER_ANTEIL: 0.4,
} as const;

/**
 * Mittlere Gehaltsfaktoren nach Laufzeit (gemessenes Mittel der bestehenden Rabattspannen, Konzept Abschnitt 1.1). Nur fuer die
 * gedachte Verlaengerung am Vertragsende (Fortsetzung); echte Angebote rechnen mit der bestehenden Rabattlogik.
 */
export const MITTLERE_LAENGEN_FAKTOREN = [1, 1, 0.945, 0.873, 0.798, 0.721] as const;

/**
 * Stellschrauben, die die Messung variieren darf (Muster `setzeGueteParameterFuerMessung`). Im Spiel gelten die Standardwerte.
 *  fortsetzungRabatt: Anteil des Laufzeit-Rabatts, den eine spaetere Verlaengerung noch bekommt (0 = volles Marktgehalt).
 */
export type VertragswertParameter = {
  fortsetzungRabatt: number;
  nachverhandlung: number;
  wunschSchwelle: number;
  wunschSchwelleInnen: number;
  risikoFaktor: number;
  /** Anteil des Risikoabschlags, der beim HALTEN (Verkaufsurteil) zaehlt: 0 = Erwartungswert, 1 = Sicherheitsaequivalent. */
  halteRisiko: number;
};
const STANDARD_PARAMETER: VertragswertParameter = {
  fortsetzungRabatt: 0.5,
  nachverhandlung: VERTRAGSWERT.NACHVERHANDLUNG,
  wunschSchwelle: VERTRAGSWERT.WUNSCH_SCHWELLE,
  wunschSchwelleInnen: VERTRAGSWERT.WUNSCH_SCHWELLE_INNEN,
  risikoFaktor: 1,
  halteRisiko: 1,
};
let parameter: VertragswertParameter = { ...STANDARD_PARAMETER };
export function setzeVertragswertParameterFuerMessung(werte: Partial<VertragswertParameter> | null): void {
  parameter = werte ? { ...STANDARD_PARAMETER, ...werte } : { ...STANDARD_PARAMETER };
}

export type Verlauf = "besser" | "gleich" | "schlechter";
export const VERLAEUFE: readonly Verlauf[] = ["besser", "gleich", "schlechter"];
export type VerlaufsGewichte = Record<Verlauf, number>;

export type ErwartungsSignale = {
  /** Potenzial-Abstand gegen den Liga-Schnitt der Abstaende (Punkte, 0 = typisch). */
  potenzialAbstand?: number | null;
  /** Trainingsguete-Faktor (1 = Mittel). */
  trainingsGuete?: number | null;
  /** Trainingsvorlieben: +1 je Lieblings-Disziplin unter den drei besten, −1 wenn die ungeliebte darunter ist. */
  vorliebe?: number | null;
  /** Leistungsfaktor im Marktwert-Bracket (1 = wie erwartet, 0,65 bis 1,65). */
  leistungsFaktor?: number | null;
  /** Form −1 (Tief) bis +1 (Hoch). */
  form?: number | null;
};

export type ErwartungsTeile = {
  potenzial: number;
  training: number;
  vorliebe: number;
  leistung: number;
  form: number;
  charakter: number;
};

export type ErwartungsVerlauf = {
  gewichte: VerlaufsGewichte;
  /** Verschiebung zugunsten „besser“ (negativ = „schlechter“), −SIGNAL_MAX..+SIGNAL_MAX. */
  verschiebung: number;
  stufe: Verlauf;
  teile: ErwartungsTeile;
};

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}
function zahl(x: number | null | undefined, ersatz: number): number {
  return typeof x === "number" && Number.isFinite(x) ? x : ersatz;
}

/**
 * Die Erwartung fuer einen Spieler: wie wahrscheinlich wird er besser / bleibt gleich / wird schlechter. Grundverteilung 30/40/30,
 * verschoben um die Signale (jeweils gedeckelt) und die Haltung des Teams (`optimismus`, Zocker/Haendler glauben eher an „besser“).
 */
export function erwartungsVerlauf(signale: ErwartungsSignale, optimismus = 0): ErwartungsVerlauf {
  const teile: ErwartungsTeile = {
    potenzial: clamp(zahl(signale.potenzialAbstand, 0) / 25, -1, 1) * 0.08,
    training: clamp((zahl(signale.trainingsGuete, 1) - 1) / 0.3, -1, 1) * 0.04,
    vorliebe: (clamp(zahl(signale.vorliebe, 0), -1, 2) / 2) * 0.03,
    leistung: clamp((zahl(signale.leistungsFaktor, 1) - 1) / 0.5, -1, 1) * 0.05,
    form: clamp(zahl(signale.form, 0), -1, 1) * 0.03,
    charakter: clamp(optimismus, -0.08, 0.08),
  };
  const roh = teile.potenzial + teile.training + teile.vorliebe + teile.leistung + teile.form + teile.charakter;
  const verschiebung = clamp(roh, -VERTRAGSWERT.SIGNAL_MAX, VERTRAGSWERT.SIGNAL_MAX);
  const besser = VERTRAGSWERT.P_BESSER + verschiebung;
  const schlechter = VERTRAGSWERT.P_SCHLECHTER - verschiebung;
  const stufe: Verlauf =
    verschiebung >= VERTRAGSWERT.STUFE_SCHWELLE ? "besser" : verschiebung <= -VERTRAGSWERT.STUFE_SCHWELLE ? "schlechter" : "gleich";
  return { gewichte: { besser, gleich: 1 - besser - schlechter, schlechter }, verschiebung, stufe, teile };
}

/** Marktwert-Faktor nach `jahre` Saisons im Verlauf. */
export function marktwertFaktor(verlauf: Verlauf, jahre: number, rate: number): number {
  if (verlauf === "gleich" || jahre <= 0) return 1;
  return (verlauf === "besser" ? 1 + rate : 1 - rate) ** jahre;
}

/** Was der Spieler dem Team je Saison bringt und kostet, ohne Gehalt des laufenden Vertrags. */
export type VertragswertSpieler = {
  /** Marktwert heute. */
  marktwert: number;
  /** Gehaltsforderung heute (Marktgehalt fuer eine Saison); ohne: MARKTGEHALT_ANTEIL x Marktwert. */
  marktgehalt?: number | null;
  /** Leistungsanteil (1 = Nutzen wie Marktgehalt; aus dem Bracket-Faktor, wie die Verkaufsabwaegung). */
  leistung: number;
  /** Bedeutung B fuer dieses Team. */
  bedeutung: number;
  /** Formkarten-Beitrag F in C je Saison. */
  formkarte: number;
  /** Geduld d des Teams. */
  geduld: number;
  /** Gewichte der Verlaeufe (`erwartungsVerlauf`). */
  gewichte: VerlaufsGewichte;
  /** Marktwert-Aenderung je Saison im besseren/schlechteren Verlauf. */
  rate: number;
  /**
   * Risikoscheu gegen Bindung (0..1, aus dem Charakter): W wird um diesen Anteil des Abstands zwischen Erwartung und schlechtem Verlauf
   * gesenkt. Lange Vertraege haben den groesseren Abstand (man bleibt im schlechten Verlauf gebunden) — vorsichtige Teams binden kuerzer.
   */
  risikoScheu?: number;
};

export type VertragswertPosten = {
  /** Erwartungswert W in C. */
  wert: number;
  /** Nutzen (B x M + F) der Vertragsjahre, abgezinst, erwartet. */
  nutzen: number;
  /** Gehalt der Vertragsjahre laut Jahresplan, abgezinst. */
  gehalt: number;
  /** Fortsetzung am Vertragsende (gehen lassen oder verlaengern), abgezinst, erwartet. */
  fortsetzung: number;
  /** W je Verlauf. */
  jeVerlauf: Record<Verlauf, number>;
  /** Abschlag fuer Risikoscheu (schon in `wert`). Die Risikoscheu waehlt die LAUFZEIT; ob gehalten, verlaengert oder verkauft wird,
   *  entscheidet der Erwartungswert (`erwartet`) — auch ein Ersatz waere ein Vertrag mit Risiko. */
  risiko: number;
  /** W ohne Risikoabschlag. */
  erwartet: number;
};

function marktgehaltVon(s: VertragswertSpieler): number {
  const g = zahl(s.marktgehalt, 0);
  return g > 0 ? g : VERTRAGSWERT.MARKTGEHALT_ANTEIL * Math.max(0, s.marktwert);
}

/** Fortsetzung nach `n` Vertragsjahren im Verlauf: max(gehen lassen, zu Marktpreisen bis zum Horizont verlaengern). */
function fortsetzung(s: VertragswertSpieler, verlauf: Verlauf, n: number): number {
  const H = VERTRAGSWERT.HORIZONT;
  const d = s.geduld;
  const mw = Math.max(0, s.marktwert);
  const abgang = (jahre: number) => VERTRAGSWERT.ABGANGS_FAKTOR * mw * marktwertFaktor(verlauf, jahre, s.rate);
  const gehenLassen = d ** n * abgang(n);
  if (n >= H) return gehenLassen;
  const rest = H - n;
  const rabattFaktor = 1 - parameter.fortsetzungRabatt * (1 - MITTLERE_LAENGEN_FAKTOREN[rest]!);
  const neuGehalt = marktgehaltVon(s) * marktwertFaktor(verlauf, n, s.rate) * rabattFaktor * parameter.nachverhandlung;
  let verlaengern = d ** H * abgang(H);
  for (let t = n + 1; t <= H; t += 1) {
    const m = marktgehaltVon(s) * marktwertFaktor(verlauf, t - 1, s.rate) * s.leistung;
    verlaengern += d ** (t - 1) * (s.bedeutung * m + s.formkarte - neuGehalt);
  }
  return Math.max(gehenLassen, verlaengern);
}

/**
 * W eines Vertrags mit dem Jahresplan `plan` (Gehalt je offenes Vertragsjahr, erstes = dieses/naechstes zu zahlende Jahr). Fuer einen
 * laufenden Vertrag die offenen Jahre (dieselben wie im Restgehalt), fuer ein Angebot der ganze Plan.
 */
export function vertragswert(s: VertragswertSpieler, plan: readonly number[]): VertragswertPosten {
  const n = plan.length;
  const d = s.geduld;
  const jeVerlauf = { besser: 0, gleich: 0, schlechter: 0 } as Record<Verlauf, number>;
  let nutzenE = 0;
  let fortsetzungE = 0;
  let gehalt = 0;
  for (let t = 1; t <= n; t += 1) gehalt += d ** (t - 1) * Math.max(0, plan[t - 1] ?? 0);
  for (const verlauf of VERLAEUFE) {
    let nutzen = 0;
    for (let t = 1; t <= n; t += 1) {
      const m = marktgehaltVon(s) * marktwertFaktor(verlauf, t - 1, s.rate) * s.leistung;
      nutzen += d ** (t - 1) * (s.bedeutung * m + s.formkarte);
    }
    const f = fortsetzung(s, verlauf, n);
    jeVerlauf[verlauf] = nutzen - gehalt + f;
    nutzenE += s.gewichte[verlauf] * nutzen;
    fortsetzungE += s.gewichte[verlauf] * f;
  }
  const erwartet = nutzenE - gehalt + fortsetzungE;
  const risiko = clamp(zahl(s.risikoScheu, 0) * parameter.risikoFaktor, 0, 1) * Math.max(0, erwartet - jeVerlauf.schlechter);
  return { wert: erwartet - risiko, nutzen: nutzenE, gehalt, fortsetzung: fortsetzungE, jeVerlauf, risiko, erwartet };
}

/**
 * W beim HALTEN eines laufenden Vertrags fuer das Verkaufsurteil: das Sicherheitsaequivalent (Erwartungswert minus Risikoabschlag) —
 * ein Verkauf tauscht einen gebundenen, unsicheren Vertrag gegen sicheres Geld, die Risikoscheu des Teams zaehlt also. Die
 * Verlaengerung am Vertragsende rechnet dagegen mit dem Erwartungswert plus Ersatzkosten (wer gehen laesst, kauft einen Ersatz mit
 * demselben Risiko nach). Kalibrierung 25.11.: mit Sicherheitsaequivalent auch bei der Verlaengerung liefen 45 % der Vertraege aus
 * (main 8 %), mit Erwartungswert beim Verkauf gab es keinen einzigen Verkauf mit Vertrag (docs/design/vertragswert-bau-25-11.md).
 */
export function halteWert(posten: VertragswertPosten): number {
  return posten.erwartet - parameter.halteRisiko * posten.risiko;
}

/** Jahresplan eines Angebots: Jahresmittel x Formgewicht je Jahr (dieselben Gewichte wie die Unterschrift). */
export function jahresplan(jahresgehalt: number, laufzeit: number, form: ContractShape): number[] {
  const gewichte = buildShapeWeights(laufzeit, form);
  const summe = gewichte.reduce((a, b) => a + b, 0);
  return gewichte.map((w) => (jahresgehalt * laufzeit * w) / summe);
}

/** „Ausstieg kostet“: Restgehalt vor jedem Vertragsjahr (Summe der noch offenen Jahre laut Plan). */
export function ausstiegKostetJeJahr(plan: readonly number[]): number[] {
  return plan.map((_, i) => plan.slice(i).reduce((a, b) => a + b, 0));
}

export type LaufzeitAngebot = {
  laufzeit: number;
  form: ContractShape;
  jahresgehalt: number;
  plan: number[];
  /** W des Angebots (ohne Kaufpreis), mit Risikoabschlag — danach wird die Laufzeit gewaehlt. */
  wert: number;
  /** W ohne Risikoabschlag (fuer Halten/Verlaengern/Verkaufen). */
  erwartet: number;
  /** Bonus fuer den guenstigeren Ausstieg (Handelsabsicht), schon in `wert`. */
  ausstieg: number;
};

export type LaufzeitWahl = {
  beste: LaufzeitAngebot;
  /** Alle bewerteten Paare, bestes zuerst. */
  angebote: LaufzeitAngebot[];
};

/**
 * Beste Laufzeit 1..5 und Form fuer ein Angebot (Kauf oder Verlaengerung): jedes Paar mit seinem Jahresgehalt aus der bestehenden
 * Rabatt-/Wunschlogik (`gehaltFuer`), bewertet mit W. Keine Sperre nach Rolle oder Rang. `handel` (0..1) gewichtet den guenstigeren
 * Ausstieg eines front-loaded Plans. `erlaubt` filtert Laufzeiten (Moral-Grenze, Kasse eng, Saison 1).
 */
export function waehleLaufzeit(input: {
  spieler: VertragswertSpieler;
  gehaltFuer: (laufzeit: number, form: ContractShape) => number;
  formen?: readonly ContractShape[];
  laufzeiten?: readonly number[];
  handel?: number;
  /**
   * Wunsch des Spielers (`buildPlayerContractPreference`): die KI startet beim Wunschpaar (Ideallaufzeit, Wunschform) — „das Wunschpaar
   * gewinnt, sobald die Teamlage nichts anderes verlangt“ (Konzept 5.3). Innerhalb des Fensters weicht sie ab, wenn W dort mindestens
   * WUNSCH_SCHWELLE_INNEN eines Jahres-Marktgehalts mehr bringt, ausserhalb ab WUNSCH_SCHWELLE.
   */
  wunschFenster?: { min: number; max: number; ideal?: number | null; form?: ContractShape | null } | null;
}): LaufzeitWahl {
  const formen = input.formen ?? (["balanced", "front_loaded", "back_loaded"] as const);
  const laufzeiten = input.laufzeiten ?? [1, 2, 3, 4, 5];
  const handel = clamp(zahl(input.handel, 0), 0, 1);
  const angebote: LaufzeitAngebot[] = [];
  for (const laufzeit of laufzeiten) {
    const ausgewogenPlan = laufzeit > 1 ? jahresplan(1, laufzeit, "balanced") : null;
    for (const form of laufzeit === 1 ? (["balanced"] as const) : formen) {
      const jahresgehalt = Math.max(0, input.gehaltFuer(laufzeit, form));
      const plan = jahresplan(jahresgehalt, laufzeit, form);
      let ausstieg = 0;
      if (ausgewogenPlan && handel > 0) {
        const rest = ausstiegKostetJeJahr(plan).slice(1);
        const restAusgewogen = ausstiegKostetJeJahr(ausgewogenPlan.map((x) => x * jahresgehalt)).slice(1);
        const mittel = (xs: number[]) => (xs.length > 0 ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
        ausstieg = VERTRAGSWERT.HANDEL_AUSSTIEG * handel * (mittel(restAusgewogen) - mittel(rest));
      }
      const posten = vertragswert(input.spieler, plan);
      angebote.push({ laufzeit, form, jahresgehalt, plan, wert: posten.wert + ausstieg, erwartet: posten.erwartet + ausstieg, ausstieg });
    }
  }
  angebote.sort((a, b) => b.wert - a.wert || a.laufzeit - b.laufzeit);
  let beste = angebote[0]!;
  const fenster = input.wunschFenster;
  if (fenster) {
    const m = marktgehaltVon(input.spieler);
    const imFenster = angebote.find((a) => a.laufzeit >= fenster.min && a.laufzeit <= fenster.max) ?? null;
    const wunschPaar =
      (fenster.ideal != null
        ? angebote.find((a) => a.laufzeit === fenster.ideal && (fenster.form == null || a.form === fenster.form || a.laufzeit === 1)) ??
          angebote.find((a) => a.laufzeit === fenster.ideal)
        : null) ?? imFenster;
    let wahl = wunschPaar ?? beste;
    if (imFenster && wahl !== imFenster && imFenster.wert - wahl.wert >= parameter.wunschSchwelleInnen * m) wahl = imFenster;
    const draussen = beste.laufzeit < fenster.min || beste.laufzeit > fenster.max;
    if (draussen && beste.wert - wahl.wert >= parameter.wunschSchwelle * m) wahl = beste;
    beste = wahl;
  }
  return { beste, angebote };
}

/**
 * ERSATZKOSTEN beim Auslaufenlassen: wer einen wichtigen Spieler gehen laesst (Abgangswert A), kauft einen gleichwertigen zum Marktwert
 * nach — der Unterschied (1 − ABGANGS_FAKTOR) x MW plus Wechselkosten (15 % eines Jahresgehalts, wie die Verkaufsabwaegung), gewichtet mit
 * der Bedeutung (hoechstens 1; ein Bankspieler muss nicht gleichwertig ersetzt werden).
 */
export function ersatzKosten(s: VertragswertSpieler): number {
  return clamp(s.bedeutung, 0, 1) * ((1 - VERTRAGSWERT.ABGANGS_FAKTOR) * Math.max(0, s.marktwert) + 0.15 * marktgehaltVon(s));
}

/**
 * Formkarten-Beitrag F eines Spielers in C je Saison. `bedarf` = Anteil der Disziplinen je Farbe im Spielplan (Summe 1),
 * `traegerImKader` = Spieler je Farbe im uebrigen Kader (ohne ihn). Volle Farbe fehlt → voller Beitrag; jeder weitere Traeger teilt.
 */
export function formkartenBeitrag(input: {
  spielerFarbe: string | null | undefined;
  bedarf: Readonly<Record<string, number>>;
  traegerImKader: Readonly<Record<string, number>>;
}): number {
  const farbe = input.spielerFarbe;
  if (!farbe) return 0;
  const anteil = zahl(input.bedarf[farbe], 0.25);
  const andere = Math.max(0, zahl(input.traegerImKader[farbe], 0));
  return (VERTRAGSWERT.FORMKARTE_WERT * 4 * anteil) / (1 + andere);
}

/** Spanne der Risikoscheu gegen Bindung (Charakter). */
export const RISIKOSCHEU_MIN = 0.25;
export const RISIKOSCHEU_MAX = 1;

/** Haltung des Teams aus vorhandenen GM- und Matrix-Kennzahlen (0..10). */
export type VertragsHaltung = "haendler" | "bewahrer" | "sparer" | "zocker";

export type VertragsCharakter = {
  geduld: number;
  optimismus: number;
  handel: number;
  /** Risikoscheu gegen Bindung 0,25..1: Sparer und Haendler hoch, Bewahrer und Zocker niedrig. */
  risikoScheu: number;
  haltung: VertragsHaltung;
};

export function vertragsCharakter(bias: {
  sellForProfitAggression?: number | null;
  shortContractPreference?: number | null;
  longContractPreference?: number | null;
  loyaltyBias?: number | null;
  riskTolerance?: number | null;
  cashPriority?: number | null;
  wageSensitivity?: number | null;
  starPriority?: number | null;
}, matrix?: { finances?: number | null; harmony?: number | null; boardConfidence?: number | null } | null): VertragsCharakter {
  const b = (x: number | null | undefined) => clamp(zahl(x, 5), 0, 10);
  const m = (x: number | null | undefined) => clamp(zahl(x, 5), 0, 10);
  const haendler = (b(bias.sellForProfitAggression) + b(bias.shortContractPreference)) / 2;
  const bewahrer = (b(bias.longContractPreference) + b(bias.loyaltyBias) + m(matrix?.harmony) + m(matrix?.boardConfidence)) / 4;
  const sparer = (b(bias.cashPriority) + b(bias.wageSensitivity) + (10 - m(matrix?.finances))) / 3;
  const zocker = (b(bias.riskTolerance) + (10 - b(bias.cashPriority)) + b(bias.starPriority)) / 3;
  const werte: Record<VertragsHaltung, number> = { haendler, bewahrer, sparer, zocker };
  const haltung = (Object.keys(werte) as VertragsHaltung[]).sort((x, y) => werte[y] - werte[x] || x.localeCompare(y))[0]!;
  // Geduld 0,90..0,97: Bewahrer rechnen spaetes Geld fast voll, Sparer zinsen stark ab.
  const geduld = 0.9 + 0.07 * clamp((bewahrer - sparer + 5) / 10, 0, 1);
  // Optimismus ±0,08: Zocker und Haendler glauben eher an den guten Verlauf.
  const optimismus = clamp(((zocker - 5) / 5) * 0.05 + ((haendler - 5) / 5) * 0.03, -0.08, 0.08);
  const handel = clamp((haendler - 2) / 8, 0, 1);
  const risikoScheu = RISIKOSCHEU_MIN + (RISIKOSCHEU_MAX - RISIKOSCHEU_MIN) * clamp((sparer + haendler - zocker - bewahrer + 10) / 20, 0, 1);
  return { geduld, optimismus, handel, risikoScheu, haltung };
}

/**
 * GELAENDER „Vertragsenden staffeln“: hoechstens GELAENDER_ANTEIL der Vertraege eines Teams endet in derselben Saison. `endenJeSaison`
 * zaehlt die laufenden Vertraege je Endsaison (ohne den neuen), `endeFuer(laufzeit)` ist die Endsaison eines neuen Vertrags. Ist die
 * Wunsch-Endsaison voll, rueckt die Laufzeit um ein Jahr (erst laenger, dann kuerzer). Erst ab 5 Vertraegen.
 */
export function staffleVertragsende(input: {
  laufzeit: number;
  endeFuer: (laufzeit: number) => number | null;
  endenJeSaison: ReadonlyMap<number, number>;
  vertraege: number;
  erlaubt?: (laufzeit: number) => boolean;
}): number {
  const gesamt = input.vertraege + 1;
  if (gesamt < 5) return input.laufzeit;
  const voll = (l: number) => {
    const ende = input.endeFuer(l);
    return ende != null && (input.endenJeSaison.get(ende) ?? 0) + 1 > VERTRAGSWERT.GELAENDER_ANTEIL * gesamt;
  };
  if (!voll(input.laufzeit)) return input.laufzeit;
  for (const versuch of [input.laufzeit + 1, input.laufzeit - 1, input.laufzeit + 2, input.laufzeit - 2]) {
    if (versuch >= 1 && versuch <= 5 && (input.erlaubt?.(versuch) ?? true) && !voll(versuch)) return versuch;
  }
  return input.laufzeit;
}

/**
 * VERTRAGSAUFLOESUNG DURCH DEN SPIELER (Chris 25.11.: „Restgehalt zahlt der Verkaeufer — ausser der Spieler bietet die Vertragsaufloesung
 * an: dann gelten guenstigere Konditionen, es wird aber trotzdem etwas bezahlt“). Lohnt sie sich fuer das Team? Statt W zu halten, zahlt
 * das Team die Abfindung und gibt den Spieler ab (er kommt auf den Markt, kein Erloes). Annehmen, wenn −Abfindung > W.
 */
export function aufloesungLohnt(input: { vertragswert: number; abfindung: number }): boolean {
  return -Math.max(0, input.abfindung) > input.vertragswert;
}
