/**
 * LIGA-DRAFT — die Lesesicht fuer die Seite (Draft-Neubau, Stufe Kern, 18.11.). Eine Funktion, ein JSON:
 * `baueLigaDraftAnsicht`. Die Seite (Mockup public/mockups/draft-modern-18-11.html) liest ausschliesslich diese Sicht
 * plus das Brett aus `/api/transfermarkt/free-agents` (dort sitzt der Scouting-Nebel, `baueSpielerSicht`).
 *
 * NEBEL: Diese Sicht traegt nur, was ohne Scouting sichtbar ist — Name, Klasse, Rasse, Marktwert/Abloese und Gehalt
 * (beide immer exakt, Chris 18.11.). Keine Eignung, keine Achsen, keinen KI-Nutzwert. Die Top 3 verraten nur die
 * Reihenfolge der KI (Konzept Frage 3/4: als Marktsignal gewollt). Werte zu einem Spieler holt die Seite aus dem Brett
 * (genebelt je Betrachter-Team). Die Wunschliste eines Menschen ist privat: fuer Menschen gibt es keine Top 3.
 *
 * KOSTEN: eine KI-Bewertung kostet ~0,1 s (Planrahmen ueber den ganzen Pool). Die Sicht bewertet nur den Zug jetzt plus
 * `vorschau` Folgezuege (Standard 6 = „Danach am Zug“ im Mockup) und merkt sich das Ergebnis je Draft-Stand.
 * „gefragt“ zaehlt deshalb ueber diese Teams, nicht ueber alle 32.
 */
import type { GameState, LigaDraftEintrag, LigaDraftZustand } from "@/lib/data/olyDataTypes";
import { bewerteKiPick, freieSpieler, type LigaDraftPickGrund } from "@/lib/draft/liga-draft-ki";
import { darfAuslassen, kaderStaerkeFuerReihenfolge, naechsteZuege, wartetAufStartWahl, werIstDran } from "@/lib/draft/liga-draft-modell";
import { nichtsLeistbar, pflichtReserve } from "@/lib/draft/liga-draft-dienst";

export type LigaDraftSpielerKarte = {
  playerId: string;
  name: string;
  className: string | null;
  race: string | null;
  /** Abloese = Marktwert, exakt. */
  marktwert: number;
  /** Gehaltsforderung, exakt. */
  gehalt: number;
};

export type LigaDraftZugAnsicht = {
  teamId: string;
  runde: number;
  platz: number;
  art: "ki" | "mensch";
  automatisch: boolean;
  ownerId: string | null;
  /** Top 3 der KI fuer diesen Zug, Rang 1 zuerst (nur KI und Auto-Pick; Menschen: `null`). Die KI nimmt Rang 1. */
  top3: string[] | null;
  /** Anzeige-Grund je Top-3-Karte (gleiche Reihenfolge wie `top3`). */
  top3Gruende: LigaDraftPickGrund[] | null;
  /** Was die KI tun wuerde: kaufen oder aufhoeren (`null` bei Menschen). */
  absicht: "pick" | "aufhoeren" | null;
};

export type LigaDraftTeamAnsicht = {
  teamId: string;
  name: string;
  kuerzel: string;
  art: "ki" | "mensch";
  ownerId: string | null;
  autoPick: boolean;
  status: "aktiv" | "fertig" | "nachzug";
  fertigGrund: string | null;
  picks: number;
  auslassungen: number;
  kader: number;
  kasse: number;
  /** Ø der besten sechs je Disziplin ueber alle Disziplinen (Reihenfolge-Kriterium). */
  kaderStaerke: number;
  /** Summe der Abloesen (Marktwerte) aller Picks dieses Teams im Draft. Marktwerte sind immer exakt sichtbar (kein Nebel). */
  abloeseSumme: number;
  /** Summe der Gehaelter (Jahresgehalt) der Draft-Picks. */
  gehaltSumme: number;
  /** Marktwert des aktuellen Kaders (Summe ueber `rosters`). */
  kaderMarktwert: number;
  /** Startwahl des Menschen (`offen` | `spielen` | `selbst`); `null` bei KI und aelteren Drafts. */
  startWahl: "offen" | "spielen" | "selbst" | null;
};

export type LigaDraftAnsicht = {
  saveId: string;
  status: LigaDraftZustand["status"];
  regeln: LigaDraftZustand["regeln"];
  runde: number;
  /** Zahl der gebuchten Picks (ohne Auslassen/Ausstieg). */
  picks: number;
  /** Laenge des Verlaufs — als `erwarteteNr` an jede POST-Aktion zurueckgeben (Schutz vor Doppelklick/Wettlauf). */
  stand: number;
  amZug: LigaDraftZugAnsicht | null;
  /** Der Draft steht bei Pick 1, bis jeder Mensch „Draft spielen“ oder „Selbst kaufen“ gewaehlt hat (19.11.). */
  wartetAufStart: boolean;
  /** Wartet der Draft auf einen Menschen (kein Auto-Pick)? */
  wartetAufMensch: boolean;
  /** Kette der laufenden Runde in Pick-Reihenfolge. */
  kette: Array<{ teamId: string; platz: number; erledigt: boolean; amZug: boolean }>;
  /** Der Zug jetzt plus die Folgezuege (`vorschau`). */
  naechste: LigaDraftZugAnsicht[];
  /** Spieler-ID -> wie viele der angezeigten KI-Zuege ihn in den Top 3 haben. */
  gefragt: Record<string, number>;
  teams: LigaDraftTeamAnsicht[];
  /** Die letzten `verlaufLimit` Eintraege (neueste zuletzt); die Pick-Tafel nimmt `verlaufLimit: 0` = alle. */
  verlauf: Array<Omit<LigaDraftEintrag, "top3"> & { top3: string[] | null }>;
  /** Karten fuer alle Spieler, die in `naechste`/`verlauf`/`mein` vorkommen. */
  spieler: Record<string, LigaDraftSpielerKarte>;
  /**
   * Sicht des Betrachter-Teams (falls angegeben und im Draft). PRIVAT: die Route setzt `betrachterTeamId` nur fuer ein
   * Team, fuer das der Aufrufer das Schreibrecht `draft_pick` hat — sonst `null`.
   */
  mein: null | {
    teamId: string;
    art: "ki" | "mensch";
    status: "aktiv" | "fertig" | "nachzug";
    autoPick: boolean;
    amZug: boolean;
    /** Darf jetzt picken (am Zug ohne Auto-Pick, oder im Nachzug nach dem geordneten Teil). */
    darfPicken: boolean;
    /** Am Zug ohne Auto-Pick UND die restlichen Runden reichen nach dem Auslassen noch bis zum Mindestkader. */
    darfAuslassen: boolean;
    /** Ab dem Mindestkader, darunter nur wenn nichts mehr leistbar ist. */
    darfFertig: boolean;
    darfUeberspringen: boolean;
    kader: number;
    kasse: number;
    /** Reserve fuer die noch fehlenden Pflichtplaetze (billigste freie Spieler) nach einem Pick. */
    pflichtReserve: number;
    /** Hoechstens so viel Abloese fuer diesen Pick (Kasse − Pflichtreserve; unter dem Minimum bleibt der billigste immer). */
    maxAbloese: number;
    /** Vorschlag des eigenen GM (Top 3 der KI-Bewertung fuer dieses Team) — nur fuer den Betrachter selbst. */
    vorschlag: string[];
    /**
     * Wunsch-Kadergroesse (Opt, 19.11.): `playerOpt` der GM-Identitaet des Teams (dieselbe Quelle wie die KI-Kaderplanung),
     * sonst `rosterOptTarget` des Teams; zwischen Mindestkader und Hoechstzahl begrenzt. Eine Vorstandsvorgabe gibt es nicht
     * mehr (das Board-Ziel „Kader-Optimum“ wurde entfernt, `team-season-objectives-service.ts`). `null`: keine Angabe.
     */
    kaderOpt: number | null;
    /** Eigene Startwahl (`null`: keine Wahl noetig oder KI). */
    startWahl: "offen" | "spielen" | "selbst" | null;
    /** Picks bis zum eigenen Zug (0 = jetzt; `null` = nicht in Sicht oder nicht in der Reihenfolge). */
    picksBisZug: number | null;
  };
};

type KiCacheWert = { top: string[]; gruende: LigaDraftPickGrund[]; absicht: "pick" | "aufhoeren" };
const kiCache = new Map<string, KiCacheWert>();
const KI_CACHE_MAX = 256;

function kiBewertungGemerkt(gameState: GameState, saveId: string, draft: LigaDraftZustand, teamId: string, pool: ReturnType<typeof freieSpieler>): KiCacheWert {
  const schluessel = `${saveId}|${draft.verlauf.length}|${draft.aktualisiertAm}|${teamId}`;
  const gemerkt = kiCache.get(schluessel);
  if (gemerkt) return gemerkt;
  const bewertung = bewerteKiPick({ gameState, saveId, draft, teamId, topN: 3, freiePool: pool });
  const wert: KiCacheWert = {
    top: bewertung.top.map((eintrag) => eintrag.playerId),
    gruende: bewertung.top.map((eintrag) => eintrag.grund),
    absicht: bewertung.kind === "buy" ? "pick" : "aufhoeren",
  };
  if (kiCache.size >= KI_CACHE_MAX) kiCache.delete(kiCache.keys().next().value as string);
  kiCache.set(schluessel, wert);
  return wert;
}

/** Wunsch-Kadergroesse des Teams (siehe `LigaDraftAnsicht.mein.kaderOpt`). */
export function kaderOptFuer(
  gameState: Pick<GameState, "teams" | "teamIdentities">,
  teamId: string,
  regeln: { minKader: number; maxPicksJeTeam: number },
): number | null {
  const identitaet = gameState.teamIdentities?.find((eintrag) => eintrag.teamId === teamId);
  const team = gameState.teams.find((eintrag) => eintrag.teamId === teamId);
  const roh = identitaet?.playerOpt ?? team?.rosterOptTarget ?? null;
  if (roh == null || !Number.isFinite(roh) || roh <= 0) return null;
  return Math.max(regeln.minKader, Math.min(regeln.maxPicksJeTeam, Math.round(roh)));
}

export function baueLigaDraftAnsicht(input: {
  gameState: GameState;
  saveId: string;
  betrachterTeamId?: string | null;
  vorschau?: number;
  verlaufLimit?: number;
}): LigaDraftAnsicht | null {
  const { gameState, saveId } = input;
  const draft = gameState.seasonState.ligaDraft;
  if (!draft || draft.saisonId !== gameState.season.id) return null;
  const vorschau = Math.max(0, Math.min(12, Math.floor(input.vorschau ?? 6)));
  const pool = freieSpieler(gameState);
  const spielerById = new Map(gameState.players.map((spieler) => [spieler.id, spieler]));
  const karten: Record<string, LigaDraftSpielerKarte> = {};
  const karte = (playerId: string | null | undefined) => {
    if (!playerId || karten[playerId]) return;
    const spieler = spielerById.get(playerId);
    if (!spieler) return;
    karten[playerId] = {
      playerId,
      name: spieler.name,
      className: spieler.className ?? null,
      race: spieler.race ?? null,
      marktwert: Math.max(0, spieler.marketValue ?? spieler.displayMarketValue ?? 0),
      gehalt: Math.max(0, spieler.salaryDemand ?? spieler.displaySalary ?? 0),
    };
  };

  const zugAnsicht = (zug: { teamId: string; runde: number; platz: number; automatisch: boolean }): LigaDraftZugAnsicht => {
    const team = draft.teams[zug.teamId]!;
    let top3: string[] | null = null;
    let top3Gruende: LigaDraftPickGrund[] | null = null;
    let absicht: LigaDraftZugAnsicht["absicht"] = null;
    if (zug.automatisch) {
      const bewertung = kiBewertungGemerkt(gameState, saveId, draft, zug.teamId, pool);
      top3 = bewertung.top;
      top3Gruende = bewertung.gruende;
      absicht = bewertung.absicht;
      top3.forEach(karte);
    }
    return { teamId: zug.teamId, runde: zug.runde, platz: zug.platz, art: team.art, automatisch: zug.automatisch, ownerId: team.ownerId, top3, top3Gruende, absicht };
  };

  const jetzt = werIstDran(draft);
  const folge = naechsteZuege(draft, gameState, vorschau + 1);
  const naechste = folge.map(zugAnsicht);
  const gefragt: Record<string, number> = {};
  for (const zug of naechste) for (const playerId of zug.top3 ?? []) gefragt[playerId] = (gefragt[playerId] ?? 0) + 1;

  const kette = draft.reihenfolge.map((teamId, index) => ({
    teamId,
    platz: index + 1,
    erledigt: index < draft.platz || draft.status !== "laeuft",
    amZug: jetzt?.teamId === teamId && jetzt.platz === index + 1,
  }));

  const kaderJeTeam = new Map<string, number>();
  for (const eintrag of gameState.rosters) kaderJeTeam.set(eintrag.teamId, (kaderJeTeam.get(eintrag.teamId) ?? 0) + 1);
  const mwJeTeam = new Map<string, number>();
  for (const eintrag of gameState.rosters) {
    const sp = spielerById.get(eintrag.playerId);
    mwJeTeam.set(eintrag.teamId, (mwJeTeam.get(eintrag.teamId) ?? 0) + Math.max(0, sp?.marketValue ?? sp?.displayMarketValue ?? 0));
  }
  const abloeseJeTeam = new Map<string, { abloese: number; gehalt: number }>();
  for (const e of draft.verlauf) {
    if (e.art !== "pick") continue;
    const alt = abloeseJeTeam.get(e.teamId) ?? { abloese: 0, gehalt: 0 };
    abloeseJeTeam.set(e.teamId, { abloese: alt.abloese + (e.abloese ?? 0), gehalt: alt.gehalt + (e.gehalt ?? 0) });
  }
  const teams: LigaDraftTeamAnsicht[] = gameState.teams
    .filter((team) => draft.teams[team.teamId])
    .map((team) => {
      const zustand = draft.teams[team.teamId]!;
      return {
        teamId: team.teamId,
        name: team.name,
        kuerzel: team.shortCode ?? team.teamId,
        art: zustand.art,
        ownerId: zustand.ownerId,
        autoPick: zustand.autoPick,
        status: zustand.status,
        fertigGrund: zustand.fertigGrund,
        picks: zustand.picks,
        auslassungen: zustand.auslassungen,
        kader: kaderJeTeam.get(team.teamId) ?? 0,
        kasse: Math.round((team.cash ?? 0) * 100) / 100,
        kaderStaerke: Math.round(kaderStaerkeFuerReihenfolge(gameState, team.teamId) * 10) / 10,
        abloeseSumme: Math.round((abloeseJeTeam.get(team.teamId)?.abloese ?? 0) * 100) / 100,
        gehaltSumme: Math.round((abloeseJeTeam.get(team.teamId)?.gehalt ?? 0) * 100) / 100,
        kaderMarktwert: Math.round((mwJeTeam.get(team.teamId) ?? 0) * 100) / 100,
        startWahl: zustand.startWahl ?? null,
      };
    });

  const verlaufLimit = input.verlaufLimit ?? 40;
  const verlaufRoh = verlaufLimit > 0 ? draft.verlauf.slice(-verlaufLimit) : draft.verlauf;
  const verlauf = verlaufRoh.map((eintrag) => {
    karte(eintrag.playerId);
    return { ...eintrag, top3: eintrag.top3 ? eintrag.top3.map((t) => t.playerId) : null };
  });

  let mein: LigaDraftAnsicht["mein"] = null;
  const betrachter = input.betrachterTeamId ? draft.teams[input.betrachterTeamId] : undefined;
  if (betrachter) {
    const teamId = betrachter.teamId;
    const kader = kaderJeTeam.get(teamId) ?? 0;
    const kasse = gameState.teams.find((team) => team.teamId === teamId)?.cash ?? 0;
    const amZug = jetzt?.teamId === teamId;
    const imNachzugOffen = betrachter.status === "nachzug" && draft.status === "nachzug";
    const reserve = pflichtReserve(gameState, teamId, draft.regeln.minKader);
    const billigster = pool.reduce(
      (min, spieler) => Math.min(min, Math.max(0, spieler.marketValue ?? spieler.displayMarketValue ?? 0)),
      Number.POSITIVE_INFINITY,
    );
    const vorschlag =
      draft.status === "laeuft" || imNachzugOffen
        ? kiBewertungGemerkt(gameState, saveId, draft, teamId, pool).top
        : [];
    vorschlag.forEach(karte);
    const index = folge.findIndex((zug) => zug.teamId === teamId);
    const mensch = betrachter.art === "mensch";
    const leer = mensch && betrachter.status !== "fertig" && nichtsLeistbar(gameState, teamId);
    mein = {
      teamId,
      art: betrachter.art,
      status: betrachter.status,
      autoPick: betrachter.autoPick,
      amZug,
      darfPicken: betrachter.art === "mensch" && ((amZug && !betrachter.autoPick) || imNachzugOffen),
      // Auslassen nur, solange die restlichen Runden noch bis zum Mindestkader reichen (oder nichts leistbar ist).
      darfAuslassen: mensch && amZug && !betrachter.autoPick && darfAuslassen(draft, kader, leer),
      // „Ich bin fertig“ ab dem Mindestkader — darunter nur, wenn nichts mehr leistbar ist.
      darfFertig: mensch && betrachter.status !== "fertig" && (kader >= draft.regeln.minKader || leer),
      darfUeberspringen: betrachter.art === "mensch" && betrachter.status === "aktiv" && draft.status === "laeuft",
      kader,
      kasse: Math.round(kasse * 100) / 100,
      pflichtReserve: Math.round(reserve * 100) / 100,
      maxAbloese: Math.round(Math.max(kasse - reserve, kader < draft.regeln.minKader && Number.isFinite(billigster) && billigster <= kasse ? billigster : 0) * 100) / 100,
      vorschlag,
      startWahl: betrachter.startWahl ?? null,
      kaderOpt: kaderOptFuer(gameState, teamId, draft.regeln),
      picksBisZug: index >= 0 ? index : null,
    };
  }

  return {
    saveId,
    status: draft.status,
    regeln: draft.regeln,
    runde: draft.runde,
    picks: draft.verlauf.filter((eintrag) => eintrag.art === "pick").length,
    stand: draft.verlauf.length,
    amZug: naechste[0] && jetzt && naechste[0].teamId === jetzt.teamId ? naechste[0] : null,
    wartetAufStart: wartetAufStartWahl(draft),
    wartetAufMensch: Boolean(jetzt && !jetzt.automatisch),
    kette,
    naechste,
    gefragt,
    teams,
    verlauf,
    spieler: karten,
    mein,
  };
}
