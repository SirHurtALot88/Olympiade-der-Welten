/**
 * VERTRAGSWERT AM SPIELSTAND (Chris 25.11., docs/design/vertragswert-bau-25-11.md). Liest aus dem Spielstand, was die reine Rechnung
 * `lib/contracts/vertragswert.ts` braucht: Bedeutung B (Staerke nach Team-Bedarf gegen den Kader-Median, wie die Verkaufsabwaegung),
 * Formkarten-Beitrag F (Klassenfarbe gegen Farbbedarf des Spielplans und Farbtraeger im Kader), Erwartung (Potenzial, Trainingsguete,
 * Trainingsvorlieben, Leistung im Bracket, Form) und den Vertrags-Charakter des Teams (GM-Kennzahlen + Team-Matrix).
 *
 * EINE RECHENSTELLE: KI-Kauf, KI-Verlaengerung, Verkaufsplaner, Vertragsaufloesung und die Verhandlungsansicht des Menschen lesen
 * diese Funktionen (gezeigt = gebucht). Regel-Stempel `seasonState.wirtschaftsRegeln.vertragsPlan` (`vertragsPlanAktiv`).
 */
import type { ContractShape, GameState, Player, RosterEntry } from "@/lib/data/olyDataTypes";
import { computeDisciplineNeeds, deriveNeedAxisWeights } from "@/lib/ai/organic-squad/discipline-need";
import { computePlayerQuality } from "@/lib/ai/organic-squad/quality";
import type { CoreAxis, OrganicPlayerView } from "@/lib/ai/organic-squad/types";
import { teamBedeutung, VERKAUFS_ABWAEGUNG } from "@/lib/ai/organic-squad/utility";
import { endSaisonFuerNeuenVertrag, endSaisonNummer } from "@/lib/contracts/vertragslaufzeit";
import {
  erwartungsVerlauf,
  halteWert,
  waehleLaufzeit,
  type LaufzeitWahl,
  formkartenBeitrag,
  vertragsCharakter,
  VERTRAGSWERT,
  type ErwartungsVerlauf,
  type VertragsCharakter,
  type VertragswertSpieler,
  vertragswert,
} from "@/lib/contracts/vertragswert";
import type { TeamStrategyProfile } from "@/lib/data/olyDataTypes";
import { getTeamGeneralManager } from "@/lib/foundation/team-general-managers";
import { getTeamStrategyProfile } from "@/lib/foundation/team-strategy-profiles";
import {
  buildPlayerContractPreference,
  resolveContractLengthSalaryFactor,
  type VertragswertKaufKontext,
} from "@/lib/market/contract-negotiation-preview";
import { buildTransfermarktSaleFactorBreakdown } from "@/lib/market/transfermarkt-sale-factor";
import { getFormCardColorForDisciplineCategory, getPlayerClassColor } from "@/lib/lineups/legacy-lineup-modifiers";
import { formToStufeStetig } from "@/lib/morale/form-moral-modifikator";
import { resolveOpenSalaryYearsForRoster } from "@/lib/market/transfermarkt-sell-proceeds";
import { trainingsVorliebenAktivFuer } from "@/lib/resolve/trainings-vorlieben";
import { wirtschaftsRegel } from "@/lib/resolve/wirtschafts-regeln";
import { resolvePlayerPotentialScoreFromGameState } from "@/lib/scouting/player-attribute-ceiling-service";
import { leiteTrainingsVorliebenAb } from "@/lib/training/trainings-vorlieben";
import { trainingsGueteFuerSpieler } from "@/lib/training/trainings-guete-spieler";
import { nebelStufeFuer, type NebelStufe } from "@/lib/training/trainings-vorlieben-sicht";

/** Gilt der Vertragsplan (Vertragswert statt 0,9-Sperre, Laufzeit nach W) in der laufenden Saison? Nur ueber den Stempel. */
export function vertragsPlanAktiv(gameState: Parameters<typeof wirtschaftsRegel>[0]): boolean {
  return wirtschaftsRegel(gameState, "vertragsPlan") === "neu";
}

type Farbe = "red" | "green" | "blue" | "yellow";

export type VertragswertTeamKontext = {
  teamId: string;
  charakter: VertragsCharakter;
  achsen: Record<CoreAxis, number>;
  medianQualitaet: number;
  farbBedarf: Record<Farbe, number>;
  farbTraeger: Record<Farbe, number>;
  endenJeSaison: Map<number, number>;
  vertraege: number;
  /** Ist der Spieler (playerId) im Kader dieses Teams? */
  imKader: Set<string>;
  listenLaenge: number;
};

function ansicht(player: Player): OrganicPlayerView {
  return {
    playerId: player.id,
    pow: player.coreStats?.pow ?? 0,
    spe: player.coreStats?.spe ?? 0,
    men: player.coreStats?.men ?? 0,
    soc: player.coreStats?.soc ?? 0,
    disciplineRatings: player.disciplineRatings ?? {},
    marketValue: Math.max(0, player.marketValue ?? player.displayMarketValue ?? 0),
    salary: Math.max(0, player.salaryDemand ?? player.displaySalary ?? 0),
  } as OrganicPlayerView;
}

function identitaetsAchsen(gameState: GameState, teamId: string): Record<CoreAxis, number> {
  const identity = gameState.teamIdentities?.find((entry) => entry.teamId === teamId);
  const roh = { pow: Math.max(0, identity?.pow ?? 0), spe: Math.max(0, identity?.spe ?? 0), men: Math.max(0, identity?.men ?? 0), soc: Math.max(0, identity?.soc ?? 0) };
  const summe = roh.pow + roh.spe + roh.men + roh.soc;
  return summe > 0
    ? { pow: roh.pow / summe, spe: roh.spe / summe, men: roh.men / summe, soc: roh.soc / summe }
    : { pow: 0.25, spe: 0.25, men: 0.25, soc: 0.25 };
}

/** Farbbedarf: Anteil der Disziplin-Slots je Formkartenfarbe im Spielplan der laufenden Saison (ohne Spielplan je 1/4). */
function farbBedarf(gameState: GameState): Record<Farbe, number> {
  const zaehler: Record<Farbe, number> = { red: 0, green: 0, blue: 0, yellow: 0 };
  let n = 0;
  for (const zeile of gameState.seasonState?.disciplineSchedule ?? []) {
    if (zeile.seasonId && zeile.seasonId !== gameState.season?.id) continue;
    for (const slot of [zeile.discipline1, zeile.discipline2]) {
      const farbe = slot ? (getFormCardColorForDisciplineCategory(slot.category) as Farbe | null) : null;
      if (farbe) {
        zaehler[farbe] += 1;
        n += 1;
      }
    }
  }
  if (n === 0) return { red: 0.25, green: 0.25, blue: 0.25, yellow: 0.25 };
  return { red: zaehler.red / n, green: zaehler.green / n, blue: zaehler.blue / n, yellow: zaehler.yellow / n };
}

const kontextCache = new WeakMap<object, Map<string, VertragswertTeamKontext>>();

/** Team-Kontext, je Spielstand-Objekt (genauer: je `rosters`-Liste) und Team zwischengespeichert. */
export function vertragswertTeamKontext(gameState: GameState, teamId: string): VertragswertTeamKontext {
  const schluessel = (gameState.rosters ?? []) as object;
  let jeTeam = kontextCache.get(schluessel);
  if (!jeTeam) {
    jeTeam = new Map();
    kontextCache.set(schluessel, jeTeam);
  }
  const vorhanden = jeTeam.get(teamId);
  // Die Liste kann in einem Lauf wachsen (Schnellkauf schreibt in dieselbe Liste): dann neu rechnen.
  if (vorhanden && vorhanden.listenLaenge === (gameState.rosters ?? []).length) return vorhanden;
  const playersById = new Map((gameState.players ?? []).map((p) => [p.id, p] as const));
  const kader = (gameState.rosters ?? []).filter((entry) => entry.teamId === teamId);
  const spieler = kader.map((entry) => playersById.get(entry.playerId)).filter((p): p is Player => Boolean(p));
  const ansichten = spieler.map(ansicht);
  const disziplinen = (gameState.disciplines ?? []).map((d) => ({ id: d.id, category: d.category }));
  const achsen = deriveNeedAxisWeights(computeDisciplineNeeds(ansichten, identitaetsAchsen(gameState, teamId), disziplinen));
  const qualitaeten = ansichten.map((v) => computePlayerQuality(v, achsen)).sort((a, b) => a - b);
  const medianQualitaet = qualitaeten.length > 0 ? Math.max(1e-6, qualitaeten[Math.floor((qualitaeten.length - 1) / 2)]!) : 1;
  const farbTraeger: Record<Farbe, number> = { red: 0, green: 0, blue: 0, yellow: 0 };
  for (const p of spieler) {
    const farbe = getPlayerClassColor(p) as Farbe | null;
    if (farbe && farbe in farbTraeger) farbTraeger[farbe] += 1;
  }
  const endenJeSaison = new Map<number, number>();
  for (const entry of kader) {
    const ende = endSaisonNummer(entry, gameState);
    if (ende != null) endenJeSaison.set(ende, (endenJeSaison.get(ende) ?? 0) + 1);
  }
  const gm = getTeamGeneralManager(gameState, teamId)?.profile?.bias ?? {};
  const identity = gameState.teamIdentities?.find((entry) => entry.teamId === teamId) ?? null;
  const kontext: VertragswertTeamKontext = {
    teamId,
    charakter: vertragsCharakter(gm, identity),
    achsen,
    medianQualitaet,
    farbBedarf: farbBedarf(gameState),
    farbTraeger,
    endenJeSaison,
    vertraege: kader.length,
    imKader: new Set(kader.map((entry) => entry.playerId)),
    listenLaenge: (gameState.rosters ?? []).length,
  };
  jeTeam.set(teamId, kontext);
  return kontext;
}

const potenzialMittelCache = new WeakMap<object, number>();

function aktuelleStaerke(player: Player): number {
  const werte = [player.coreStats?.pow ?? 0, player.coreStats?.spe ?? 0, player.coreStats?.men ?? 0, player.coreStats?.soc ?? 0].sort((a, b) => b - a);
  return (werte[0]! + werte[1]! + werte[2]!) / 3;
}

function potenzialAbstand(gameState: GameState, player: Player): number | null {
  const pot = resolvePlayerPotentialScoreFromGameState({ gameState, playerId: player.id });
  if (pot == null) return null;
  const quelle = (gameState.playerPotential ?? []) as object;
  let mittel = potenzialMittelCache.get(quelle);
  if (mittel == null) {
    const byId = new Map((gameState.players ?? []).map((p) => [p.id, p] as const));
    let summe = 0;
    let n = 0;
    for (const rec of gameState.playerPotential ?? []) {
      const p = byId.get(rec.playerId);
      if (!p || typeof rec.hiddenPotentialScore !== "number" || !Number.isFinite(rec.hiddenPotentialScore)) continue;
      summe += rec.hiddenPotentialScore - aktuelleStaerke(p);
      n += 1;
    }
    mittel = n > 0 ? summe / n : 0;
    potenzialMittelCache.set(quelle, mittel);
  }
  return pot - aktuelleStaerke(player) - mittel;
}

function vorliebeSignal(gameState: GameState, player: Player): number | null {
  if (!trainingsVorliebenAktivFuer(gameState)) return null;
  const v = leiteTrainingsVorliebenAb(player, gameState.season?.id ?? "");
  const top3 = Object.entries(player.disciplineRatings ?? {})
    .sort((a, b) => Number(b[1] ?? 0) - Number(a[1] ?? 0))
    .slice(0, 3)
    .map(([id]) => id);
  let signal = 0;
  for (const id of top3) {
    if (v.lieblinge.includes(id)) signal += 1;
    if (v.ungeliebt === id) signal -= 1;
  }
  return signal;
}

function formSignal(gameState: GameState, player: Player, teamId: string): number | null {
  const zustand = (gameState.playerFormState ?? []).find((f) => f.playerId === player.id && f.teamId === teamId);
  const form = zustand?.form ?? (typeof player.form === "number" ? player.form : null);
  if (form == null || !Number.isFinite(form)) return null;
  return formToStufeStetig(form) / 2;
}

export type VertragswertSpielerKontext = {
  spieler: VertragswertSpieler;
  erwartung: ErwartungsVerlauf;
  charakter: VertragsCharakter;
  team: VertragswertTeamKontext;
};

/**
 * Was der Vertragswert ueber diesen Spieler in diesem Team braucht. `leistungsFaktor` = Bracket-Faktor (1 ohne Rangliste),
 * `staerkeVerhaeltnis` uebersteuert B (der Verkaufsplaner kennt seinen eigenen Median), `bekannt` = schon eine Saison im Team.
 */
export function vertragswertSpieler(
  gameState: GameState,
  teamId: string,
  player: Player,
  optionen?: {
    leistungsFaktor?: number | null;
    staerkeVerhaeltnis?: number | null;
    bekannt?: boolean;
    /**
     * Scouting-Nebel des schauenden Teams (Mensch wie KI, KI-Nebel 21.11.): unter „gescoutet“ zaehlen Potenzial und Trainingsvorlieben
     * nicht (sie sind verdeckt); Leistung im Bracket, Form und Trainingsguete sind oeffentlich. Ohne Angabe: gescoutet (eigener Kader).
     */
    nebelStufe?: NebelStufe;
  },
): VertragswertSpielerKontext {
  const team = vertragswertTeamKontext(gameState, teamId);
  const imKader = team.imKader.has(player.id);
  const verhaeltnis =
    optionen?.staerkeVerhaeltnis ?? computePlayerQuality(ansicht(player), team.achsen) / team.medianQualitaet;
  const lf = optionen?.leistungsFaktor ?? 1;
  const leistung = Math.max(0.2, 1 + (lf >= 1 ? VERKAUFS_ABWAEGUNG.LEISTUNG_OBEN : VERKAUFS_ABWAEGUNG.LEISTUNG_UNTEN) * (lf - 1));
  const farbe = getPlayerClassColor(player) as Farbe | null;
  const traeger = { ...team.farbTraeger };
  if (imKader && farbe && farbe in traeger) traeger[farbe] = Math.max(0, traeger[farbe] - 1);
  const formkarte = formkartenBeitrag({ spielerFarbe: farbe, bedarf: team.farbBedarf, traegerImKader: traeger });
  const guete = trainingsGueteFuerSpieler(gameState, player);
  const erwartung = erwartungsVerlauf(
    {
      potenzialAbstand: (optionen?.nebelStufe ?? 2) >= 2 ? potenzialAbstand(gameState, player) : null,
      trainingsGuete: guete?.faktor ?? null,
      vorliebe: (optionen?.nebelStufe ?? 2) >= 2 ? vorliebeSignal(gameState, player) : null,
      leistungsFaktor: lf,
      form: formSignal(gameState, player, teamId),
    },
    team.charakter.optimismus,
  );
  const bekannt = optionen?.bekannt ?? imKader;
  return {
    spieler: {
      marktwert: Math.max(0, player.marketValue ?? player.displayMarketValue ?? 0),
      marktgehalt: Math.max(0, player.salaryDemand ?? player.displaySalary ?? 0) || null,
      leistung,
      bedeutung: teamBedeutung(verhaeltnis),
      formkarte,
      geduld: team.charakter.geduld,
      gewichte: erwartung.gewichte,
      rate: bekannt ? VERTRAGSWERT.VERLAUF_RATE_BEKANNT : VERTRAGSWERT.VERLAUF_RATE,
      risikoScheu: team.charakter.risikoScheu,
    },
    erwartung,
    charakter: team.charakter,
    team,
  };
}

/** Die offenen Vertragsjahre eines Kadereintrags (dieselben wie im Restgehalt). */
export function offenerJahresplan(gameState: GameState, rosterEntry: RosterEntry): number[] {
  return resolveOpenSalaryYearsForRoster({ rosterEntry, gameState });
}

/** Geländer-Eingaben fuer `staffleVertragsende`. */
export function staffelKontext(gameState: GameState, teamId: string, ohnePlayerId?: string) {
  const team = vertragswertTeamKontext(gameState, teamId);
  let enden = team.endenJeSaison;
  let vertraege = team.vertraege;
  if (ohnePlayerId && team.imKader.has(ohnePlayerId)) {
    const entry = (gameState.rosters ?? []).find((r) => r.teamId === teamId && r.playerId === ohnePlayerId);
    const ende = entry ? endSaisonNummer(entry, gameState) : null;
    if (ende != null) {
      enden = new Map(enden);
      enden.set(ende, Math.max(0, (enden.get(ende) ?? 0) - 1));
    }
    vertraege -= 1;
  }
  return {
    endenJeSaison: enden,
    vertraege,
    endeFuer: (laufzeit: number) => endSaisonFuerNeuenVertrag(gameState, laufzeit),
  };
}

/**
 * Jahresgehalt eines Angebots je (Laufzeit, Form) aus der BESTEHENDEN Rabatt- und Wunschlogik (Chris 25.11.: „haben wir ja schon drin“):
 * Gehaltsforderung x Laengenfaktor (`resolveContractLengthSalaryFactor`, Spannen je Spieler) mit dem Formaufschlag gegen den Wunsch
 * (`resolveContractShapeSalarySurcharge`). Genau so rechnet der KI-Schnellkauf das gebuchte Gehalt.
 */
export function angebotsGehaltFuer(input: {
  player: Player;
  basisGehalt: number;
  teamFit?: number | null;
  profil?: TeamStrategyProfile | null;
  /** Zusaetzlicher Faktor (z. B. Moral oder Nachverhandlung bei der Verlaengerung). */
  faktor?: (laufzeit: number) => number;
}): (laufzeit: number, form: ContractShape) => number {
  return (laufzeit, form) => {
    // Wunschpreis fuer Laufzeit UND Form, wie die Verhandlung ihn bucht (`buildPlayerContractPreference`).
    const aufschlag =
      buildPlayerContractPreference(input.player, input.profil ?? null, { contractLength: laufzeit, contractShape: form })?.salaryAdjustmentPct ?? 0;
    const f = resolveContractLengthSalaryFactor({
      player: input.player,
      contractLength: laufzeit,
      teamFit: input.teamFit ?? null,
      salaryPreferenceAdjustmentPct: aufschlag,
    });
    return Math.max(0, input.basisGehalt) * f * (input.faktor ? input.faktor(laufzeit) : 1);
  };
}

/**
 * W eines laufenden Vertrags (Halten) am Spielstand. Hat der Vertrag keine offenen Jahre mehr (am Vertragsende nach dem Gehaltsabzug),
 * ist Halten = Verlaengern: dann zaehlt das beste Verlaengerungsangebot (Laufzeit 1-5 nach W) — der Abgangswert steht beim Verkauf.
 */
export function laufenderVertragswert(input: {
  gameState: GameState;
  teamId: string;
  player: Player;
  rosterEntry: RosterEntry;
  leistungsFaktor?: number | null;
  staerkeVerhaeltnis?: number | null;
}): { wert: number; kontext: VertragswertSpielerKontext; plan: number[]; verlaengerung: LaufzeitWahl | null } {
  const maxLaufzeit = kasseEngFuerVerlaengerung(input.gameState, input.teamId) ? 2 : 5;
  const kontext = vertragswertSpieler(input.gameState, input.teamId, input.player, {
    leistungsFaktor: input.leistungsFaktor,
    staerkeVerhaeltnis: input.staerkeVerhaeltnis,
    bekannt: true,
  });
  const plan = offenerJahresplan(input.gameState, input.rosterEntry);
  if (plan.length > 0) {
    return { wert: halteWert(vertragswert(kontext.spieler, plan)), kontext, plan, verlaengerung: null };
  }
  const basis = Math.max(0, input.player.salaryDemand ?? input.player.displaySalary ?? 0) || VERTRAGSWERT.MARKTGEHALT_ANTEIL * kontext.spieler.marktwert;
  const profil = getTeamStrategyProfile(input.gameState, input.teamId);
  const verlaengerung = waehleLaufzeit({
    spieler: kontext.spieler,
    wunschFenster: wunschFensterVon(buildPlayerContractPreference(input.player, profil)),
    gehaltFuer: angebotsGehaltFuer({
      player: input.player,
      basisGehalt: basis,
      profil,
    }),
    handel: kontext.charakter.handel,
    laufzeiten: [1, 2, 3, 4, 5].filter((l) => l <= maxLaufzeit),
  });
  // Halten am Vertragsende = verlaengern: W der besten Verlaengerung (Erwartungswert). Die Kosten eines Ersatzes stehen in der
  // Verkaufsabwaegung (Wechselkosten, Ersatzrisiko), nicht hier — sonst zaehlten sie doppelt.
  return { wert: verlaengerung.beste.erwartet, kontext, plan, verlaengerung };
}

/** Wunschfenster aus der Spielerpraeferenz (kurz 1-2, mittel 2-4, lang 3-5). */
export function wunschFensterVon(
  pref: { preferredMinLength: number; preferredMaxLength: number; idealLength?: number; shapePreference?: ContractShape } | null | undefined,
): { min: number; max: number; ideal: number | null; form: ContractShape | null } | null {
  return pref
    ? { min: pref.preferredMinLength, max: pref.preferredMaxLength, ideal: pref.idealLength ?? null, form: pref.shapePreference ?? null }
    : null;
}

/**
 * GELAENDER „Kasse eng“ fuer Verlaengerungen (Konzept Abschnitt 7): Kasse unter der Haelfte der Jahresgehaelter des Kaders (dieselbe
 * Grenze wie „knapp bei Kasse“ im Team-Blick) → hoechstens 2 Jahre.
 */
export function kasseEngFuerVerlaengerung(gameState: GameState, teamId: string, kasse?: number | null): boolean {
  const team = (gameState.teams ?? []).find((t) => t.teamId === teamId);
  const gehalt = (gameState.rosters ?? []).filter((r) => r.teamId === teamId).reduce((sum, r) => sum + Math.max(0, r.salary ?? 0), 0);
  return (kasse ?? team?.cash ?? 0) < 0.5 * gehalt;
}

/** Leistungsfaktor im Marktwert-Bracket eines Spielers (1 ohne Rangliste). */
export function bracketLeistungsFaktor(gameState: GameState, player: Player, rosterEntry?: RosterEntry | null): number {
  try {
    const f = buildTransfermarktSaleFactorBreakdown(gameState, player, rosterEntry ?? null).saleFactor;
    return typeof f === "number" && Number.isFinite(f) && f > 0 ? f : 1;
  } catch {
    return 1;
  }
}

/**
 * Eingaben fuer ein Kaufangebot (`recommendContractOfferForPlayer`): null, solange der Stempel `vertragsPlan` nicht gilt. Der Spieler ist
 * neu im Team (Verlaeufe streuen weiter), B gegen den Median des aktuellen Kaders, F gegen die Farbtraeger des aktuellen Kaders.
 */
export function vertragswertKaufKontext(gameState: GameState, teamId: string, player: Player | null): VertragswertKaufKontext | null {
  if (!player || !vertragsPlanAktiv(gameState)) return null;
  const k = vertragswertSpieler(gameState, teamId, player, {
    leistungsFaktor: bracketLeistungsFaktor(gameState, player, null),
    bekannt: false,
    nebelStufe: nebelStufeFuer(gameState, teamId, player.id),
  });
  return { spieler: k.spieler, handel: k.charakter.handel, erwartung: k.erwartung, staffel: staffelKontext(gameState, teamId) };
}

/**
 * ANZEIGE IN DER VERHANDLUNG (Chris 25.11.: „Erwartung zeigen, im Scouting-Nebel gestuft“). Dieselbe Rechenstelle wie die KI
 * (`vertragswertSpieler`), vergroebert auf dem SERVER:
 *   unbekannt   keine Erwartung
 *   beobachtet  nur die Stufe (besser / gleich / schlechter), ohne Potenzial und Vorlieben gerechnet
 *   gescoutet   Stufe und Anteile der drei Verlaeufe (eigener Kader immer gescoutet)
 * Der Formkarten-Beitrag haengt nur an der (oeffentlichen) Klasse und am eigenen Kader und ist immer sichtbar.
 */
export type VertragswertAnzeige = {
  nebelStufe: NebelStufe;
  erwartung: "besser" | "gleich" | "schlechter" | null;
  anteile: { besser: number; gleich: number; schlechter: number } | null;
  formkarte: number;
  formkarteFarbe: string | null;
};

export function vertragswertAnzeige(gameState: GameState, viewerTeamId: string, player: Player, rosterEntry?: RosterEntry | null): VertragswertAnzeige {
  const nebelStufe = nebelStufeFuer(gameState, viewerTeamId, player.id);
  const k = vertragswertSpieler(gameState, viewerTeamId, player, {
    leistungsFaktor: bracketLeistungsFaktor(gameState, player, rosterEntry ?? null),
    bekannt: Boolean(rosterEntry),
    nebelStufe,
  });
  const r2 = (x: number) => Math.round(x * 100) / 100;
  return {
    nebelStufe,
    erwartung: nebelStufe >= 1 ? k.erwartung.stufe : null,
    anteile:
      nebelStufe >= 2
        ? { besser: r2(k.erwartung.gewichte.besser), gleich: r2(k.erwartung.gewichte.gleich), schlechter: r2(k.erwartung.gewichte.schlechter) }
        : null,
    formkarte: r2(k.spieler.formkarte),
    formkarteFarbe: getPlayerClassColor(player) ?? null,
  };
}

export type { ContractShape };
