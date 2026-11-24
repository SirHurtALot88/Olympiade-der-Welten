/**
 * MEDAILLEN-MODELL (22.11., docs/design/finanzen-posten-22-11.md g.1 und f.1; Bau: docs/design/arena-tickets-medaillen-22-11.md).
 *
 * Am Saisonende bekommt in jeder Liga je Disziplin Gold, Silber und Bronze (20 x 3 x 2 = 120 Medaillen), und das beste Team je
 * Disziplinfarbe (POW, SPE, MEN, SOC) wird Farb-Meister. DIE WERTUNG IST DIE DER LEADERS-SEITE: `medaillenTabelle` /
 * `medaillenPlaetze` in `lib/foundation/leaders-modern.ts` (Duell: Summe der Ergebnispunkte E1; Pod-Disziplinen: Summe des
 * Verhaeltnisses, eigener Wert minus Mittel der Gegner; Gleichstand: Verhaeltnis, dann PP-Summe, sonst geteilt). Anzeige und Buchung
 * rechnen damit dieselbe Reihenfolge.
 *
 * Geld (PM 22.11.): kommt aus dem Rangpraemien-Topf, nicht obendrauf (`rangPraemieFaktor`). Moral: nur Spieler mit Ehrgeiz- oder
 * Ruhm-Trait (Konzept g.1). Gebucht wird einmal je Saison (`bucheMedaillen`), idempotent.
 */
import type { GameState, Player } from "@/lib/data/olyDataTypes";
import {
  LEADERS_ACHSEN,
  LEADERS_PRAEMIE,
  baueLeadersModell,
  medaillenPlaetze,
  medaillenSummen,
  medaillenTabelle,
  type LeadersAchse,
  type LeadersModell,
} from "@/lib/foundation/leaders-modern";
import { buildSpieltagsUebersicht } from "@/lib/foundation/season-matchday-fixtures-overview";
import { lesPraemienPlan } from "@/lib/finance/vorstand-praemien";
import { gueltigerMedaillenStempel, medaillenAktiv } from "@/lib/medaillen/medaillen-regel";
import { sponsorTopfAktiv } from "@/lib/resolve/sponsor-regel";
import type { FarbMeisterZeile, MedaillenVergabe, MedaillenZeile } from "@/lib/medaillen/medaillen-typen";

/** Farb-Meister-Bonus je Liga in C (Variante B des Konzepts: 3,0 / 2,0). */
export const FARB_MEISTER_PRAEMIE: Record<1 | 2, number> = { 1: 3.0, 2: 2.0 };
/** Hoechstens so viele Farben je Team und Saison (Deckel, Konzept g.1 Risiko). */
export const FARB_MEISTER_MAX_JE_TEAM = 2;
export const MORAL_MEDAILLE: Record<1 | 2 | 3, number> = { 1: 6, 2: 4, 3: 2 };
export const MORAL_MAX_JE_SPIELER = 10;
export const MORAL_GELD_TRAIT = 2;

export const FARBE_LABEL: Record<LeadersAchse, string> = { pow: "Power", spe: "Speed", men: "Mental", soc: "Social" };

const norm = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, "");
const EHRGEIZ_TRAITS = new Set(["ambitious", "fanfavorite", "firedup", "motivated", "diva", "egomaniac"]);
const EGO_TRAITS = new Set(["diva", "egomaniac"]);
const GELD_TRAITS = new Set(["mercenary", "gambler"]);

function traitsVon(p: Player): Set<string> {
  return new Set([...(p.traitsPositive ?? []), ...(p.traitsNegative ?? [])].map(norm).filter(Boolean));
}

const rund1 = (v: number) => Math.round(v * 10) / 10;
const rund2 = (v: number) => Math.round(v * 100) / 100;

/** Das Leaders-Modell der ganzen Saison aus dem Spielstand (Server und Messskripte; die Seite baut es aus ihren Uebersichten). */
export function baueSaisonModell(gameState: GameState, saveId?: string | null): LeadersModell {
  const ids = gameState.season.matchdayIds ?? [];
  const uebersichten = ids.map((id, i) => ({ spieltag: i + 1, matchdayId: id, uebersicht: buildSpieltagsUebersicht(gameState, id, { saveId: saveId ?? null }) }));
  return baueLeadersModell({ gameState, ownTeamId: null, uebersichten, tagesankerFuer: () => false });
}

export type VergabeRohling = Omit<MedaillenVergabe, "seasonId" | "gebuchtAm">;

/** Rechnet Medaillen, Farb-Meister und Moral einer Saison. Rein, ohne zu buchen. */
export function berechneVergabe(gameState: GameState, m: LeadersModell): VergabeRohling {
  const medaillen: MedaillenZeile[] = [];
  const farbMeister: FarbMeisterZeile[] = [];
  const geldJeTeam: VergabeRohling["geldJeTeam"] = {};
  const gutschrift = (teamId: string, art: "medaillen" | "farbe", geld: number) => {
    const z = (geldJeTeam[teamId] ??= { medaillen: 0, farbe: 0 });
    z[art] = rund2(z[art] + geld);
  };

  for (const d of m.disziplinen) {
    if (medaillenSummen(m, d.id).einsaetze === 0) continue;
    for (const liga of [1, 2] as const) {
      for (const p of medaillenPlaetze(medaillenTabelle(m, d.id, liga), LEADERS_PRAEMIE[liga])) {
        const geld = rund2(p.praemie);
        medaillen.push({ disziplinId: d.id, liga, teamId: p.teamId, platz: p.platz, geteilt: p.geteilt, geld, wert: Math.round(p.wert * 10) / 10 });
        gutschrift(p.teamId, "medaillen", geld);
      }
    }
  }

  // Farb-Meister: je Liga die Summe der Wertung aus den Disziplinen der Farbe; hoechstens zwei Farben je Team (der Rest geht an den Naechsten).
  // SPONSOR-TOPF (24.11.): der Farb-Partner IST der Farb-Meister (Konzept 4.5). Unter dem neuen Sponsor-System wird er dort bezahlt und hier nicht
  // noch einmal; die Medaillen bleiben.
  for (const liga of sponsorTopfAktiv(gameState) ? [] : ([1, 2] as const)) {
    const teamIds = m.teams.filter((t) => t.liga === liga).map((t) => t.teamId);
    const jeFarbe = LEADERS_ACHSEN.map((farbe) => {
      const summe = new Map<string, number>();
      for (const d of m.disziplinen.filter((x) => x.achse === farbe)) {
        const { summe: s } = medaillenSummen(m, d.id);
        for (const id of teamIds) summe.set(id, (summe.get(id) ?? 0) + (s.get(id)?.wert ?? 0));
      }
      const reihe = [...summe.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
      return { farbe, reihe };
    }).filter((f) => f.reihe.some(([, w]) => w !== 0));
    // Die Farbe mit dem hoechsten Spitzenwert zuerst: wer mehrere Farben holen koennte, behaelt die staerksten.
    jeFarbe.sort((a, b) => (b.reihe[0]?.[1] ?? 0) - (a.reihe[0]?.[1] ?? 0));
    const besitz = new Map<string, number>();
    for (const { farbe, reihe } of jeFarbe) {
      const gleich = (a: number, b: number) => Math.round(a * 10000) === Math.round(b * 10000);
      const frei = reihe.filter(([id]) => (besitz.get(id) ?? 0) < FARB_MEISTER_MAX_JE_TEAM);
      if (frei.length === 0) continue;
      const spitze = frei[0]![1];
      const sieger = frei.filter(([, w]) => gleich(w, spitze));
      const geld = rund2(FARB_MEISTER_PRAEMIE[liga] / sieger.length);
      for (const [teamId, punkte] of sieger) {
        besitz.set(teamId, (besitz.get(teamId) ?? 0) + 1);
        farbMeister.push({ farbe, liga, teamId, geld, punkte: Math.round(punkte * 10) / 10, geteilt: sieger.length > 1 });
        gutschrift(teamId, "farbe", geld);
      }
    }
  }

  return { medaillen, farbMeister, geldJeTeam, moral: berechneMoral(gameState, m, medaillen) };
}

/** Moral-Punkte je Spieler (hoechstens +10): nur Ehrgeiz-/Ruhm-Traits, Geld-Traits nur mit eingeschalteter Siegpraemie. */
function berechneMoral(gameState: GameState, m: LeadersModell, medaillen: readonly MedaillenZeile[]): VergabeRohling["moral"] {
  const spielerVon = new Map(gameState.players.map((p) => [p.id, p] as const));
  const teamVon = new Map(m.spieler.map((s) => [s.id, s.teamId] as const));
  const ppJe = new Map<string, number>(); // teamId|disz|playerId
  const eingesetzt = new Map<string, Set<string>>(); // teamId|disz -> players
  for (const b of m.buchungen) {
    const t = teamVon.get(b.playerId);
    if (!t) continue;
    ppJe.set(`${t}|${b.disziplinId}|${b.playerId}`, (ppJe.get(`${t}|${b.disziplinId}|${b.playerId}`) ?? 0) + b.pp);
    const k = `${t}|${b.disziplinId}`;
    (eingesetzt.get(k) ?? eingesetzt.set(k, new Set()).get(k)!).add(b.playerId);
  }
  const punkte = new Map<string, number>();
  const anzahl = new Map<string, { gold: number; silber: number; bronze: number }>();
  const siegpraemie = new Map<string, boolean>();
  for (const z of medaillen) {
    const spieler = eingesetzt.get(`${z.teamId}|${z.disziplinId}`);
    if (!spieler) continue;
    // Bester Spieler des Teams in dieser Disziplin (fuer Diva und Egomaniac).
    let bester: string | null = null;
    let bestPp = -Infinity;
    for (const id of spieler) {
      const pp = ppJe.get(`${z.teamId}|${z.disziplinId}|${id}`) ?? 0;
      if (pp > bestPp) {
        bestPp = pp;
        bester = id;
      }
    }
    for (const id of spieler) {
      const p = spielerVon.get(id);
      if (!p) continue;
      const tr = traitsVon(p);
      let add = 0;
      const ehrgeiz = [...tr].filter((t) => EHRGEIZ_TRAITS.has(t));
      if (ehrgeiz.length > 0) {
        // Diva und Egomaniac zaehlen nur die Medaillen, bei denen sie selbst der beste Spieler ihres Teams waren.
        const nurEgo = ehrgeiz.every((t) => EGO_TRAITS.has(t));
        if (!nurEgo || id === bester) add += MORAL_MEDAILLE[z.platz];
      }
      if ([...tr].some((t) => GELD_TRAITS.has(t))) {
        if (!siegpraemie.has(z.teamId)) siegpraemie.set(z.teamId, lesPraemienPlan(gameState, z.teamId).siegStufe > 0);
        if (siegpraemie.get(z.teamId)) add += MORAL_GELD_TRAIT;
      }
      if (add <= 0) continue;
      punkte.set(id, (punkte.get(id) ?? 0) + add);
      const a = anzahl.get(id) ?? { gold: 0, silber: 0, bronze: 0 };
      if (z.platz === 1) a.gold += 1;
      else if (z.platz === 2) a.silber += 1;
      else a.bronze += 1;
      anzahl.set(id, a);
    }
  }
  const aus: VergabeRohling["moral"] = {};
  for (const [id, p] of punkte) {
    const a = anzahl.get(id)!;
    const teile = [a.gold ? `${a.gold}× Gold` : "", a.silber ? `${a.silber}× Silber` : "", a.bronze ? `${a.bronze}× Bronze` : ""].filter(Boolean).join(", ");
    aus[id] = { punkte: Math.min(MORAL_MAX_JE_SPIELER, p), text: `Medaillen: ${teile}` };
  }
  return aus;
}

/**
 * Bucht die Medaillen der laufenden Saison: Geld in die Kasse, Vergabe in den Spielstand. Idempotent (eine gebuchte Vergabe dieser
 * Saison bleibt). Ohne gueltige Regel unveraendert. `modell` darf der Aufrufer reichen (Tests), sonst wird es aus dem Spielstand gebaut.
 */
export function bucheMedaillen(gameState: GameState, opts?: { saveId?: string | null; modell?: LeadersModell; jetzt?: string }): GameState {
  if (!medaillenAktiv(gameState)) return gameState;
  const seasonId = gameState.seasonState.seasonId ?? gameState.season.id;
  if (gameState.seasonState.medaillenVergabe?.seasonId === seasonId) return gameState;
  const m = opts?.modell ?? baueSaisonModell(gameState, opts?.saveId);
  const roh = berechneVergabe(gameState, m);
  const vergabe: MedaillenVergabe = { seasonId, ...roh, gebuchtAm: opts?.jetzt ?? new Date().toISOString() };
  return {
    ...gameState,
    teams: gameState.teams.map((t) => {
      const g = vergabe.geldJeTeam[t.teamId];
      return g ? { ...t, cash: rund1(t.cash + g.medaillen + g.farbe) } : t;
    }),
    seasonState: { ...gameState.seasonState, medaillenVergabe: vergabe },
  };
}

/** Gebuchtes Medaillen- und Farb-Meister-Geld eines Teams in der laufenden Saison (0 vor der Vergabe). */
export function medaillenGeldDerSaison(gameState: GameState, teamId: string): { medaillen: number; farbe: number; gesamt: number } {
  const v = gameState.seasonState?.medaillenVergabe;
  const seasonId = gameState.seasonState?.seasonId ?? gameState.season?.id;
  const g = v && v.seasonId === seasonId ? v.geldJeTeam[teamId] : null;
  return { medaillen: g?.medaillen ?? 0, farbe: g?.farbe ?? 0, gesamt: rund2((g?.medaillen ?? 0) + (g?.farbe ?? 0)) };
}

/**
 * Moral-Zuschlag eines Spielers durch Medaillen (0 bis +10): die Vergabe der laufenden Saison (nach der Buchung) oder die der
 * Vorsaison aus dem Stempel. Nur Spieler mit Ehrgeiz-/Ruhm-Trait tragen einen Eintrag.
 */
export function medaillenMoralZuschlag(gameState: GameState, playerId: string): { punkte: number; text: string } | null {
  const seasonId = gameState.seasonState?.seasonId ?? gameState.season?.id;
  const v = gameState.seasonState?.medaillenVergabe;
  if (v && v.seasonId === seasonId && v.moral[playerId]) return v.moral[playerId]!;
  const stempel = gueltigerMedaillenStempel(gameState);
  if (stempel?.regel === "an" && !stempel.notbremse && stempel.moralVorsaison?.[playerId]) return stempel.moralVorsaison[playerId]!;
  return null;
}

/** Beim Saisonwechsel: der Moral-Zuschlag der abgelaufenen Saison wandert in den Stempel der neuen. */
export function moralFuerSaisonwechsel(gameState: GameState): Record<string, { punkte: number; text: string }> {
  const v = gameState.seasonState?.medaillenVergabe;
  const seasonId = gameState.seasonState?.seasonId ?? gameState.season?.id;
  return v && v.seasonId === seasonId ? { ...v.moral } : {};
}
