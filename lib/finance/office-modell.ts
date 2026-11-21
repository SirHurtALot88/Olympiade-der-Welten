/**
 * Office 21.11: das Modell der Seite „Office" (Vorstand und Ziele, Gespraech, Praemien).
 *
 * Nichts wird hier neu gerechnet: Freigabe und Toepfe kommen aus `berechneVorstandBudgetStand`, Ziele und Vertrauen aus
 * `buildTeamObjectiveOverview`, Gespraech aus `vorstand-gespraech`, Praemien aus `vorstand-praemien`. Dieses Modell sortiert
 * sie nur fuer die Oberflaeche und rechnet Raenge (Rang 1 ist immer der beste; bei Kosten das guenstigste Team).
 */

import { buildTeamObjectiveOverview, istZielTauschbar, zielTauschZeitfenster } from "@/lib/board/team-season-objectives-service";
import {
  bereichDesZiels,
  kaderUnterSoll,
  lieblingFuerSaison,
  pruefeZielSatz,
  saisonNr,
  vertragslaufzeitGrenze,
  zaehleVertraegeProEndsaison,
  type WiderspruchsErgebnis,
  type ZielBereich,
  type ZielEntwurf,
} from "@/lib/board/vorstand-ziele-erweitert";
import { getPlayerPortraitBrowserUrl } from "@/lib/data/mediaAssets";
import { restlaufzeit } from "@/lib/contracts/vertragslaufzeit";
import type { GameState, TeamSeasonObjectiveRecord, VorstandGespraechZustand, VorstandPraemienPlan } from "@/lib/data/olyDataTypes";
import { berechneVorstandBudgetStand, VORSTAND_STUFEN, type VorstandBudgetStand } from "@/lib/finance/vorstand-budgetfreigabe";
import { gespraechCharakter, GESPRAECHE_JE_SAISON, lesVorstandGespraech, type GespraechCharakter } from "@/lib/finance/vorstand-gespraech";
import { lesPraemienPlan, SIEG_STUFEN, TREUE_STUFEN, vorschauPraemien, type PraemienVorschau } from "@/lib/finance/vorstand-praemien";
import { evaluateGamePhaseAction } from "@/lib/foundation/game-phase-action-policy";
import { getLeagueOf, isLeagueSplitActive } from "@/lib/season/league-split";

export type OfficeZiel = {
  id: string;
  bereich: ZielBereich;
  label: string;
  detail: string | null;
  hinweis: string | null;
  status: TeamSeasonObjectiveRecord["status"];
  ist: string;
  soll: string;
  plus: number;
  minus: number;
  rewardCash: number;
  laufzeitText: string;
  mehrjaehrig: boolean;
  neu: boolean;
  ersetzt: { label: string; weil: string } | null;
  tauschbar: boolean;
  quelle: string;
};

export type OfficeRang = { rang: number; von: number };

export type OfficeSpielerZeile = {
  playerId: string;
  name: string;
  portrait: string | null;
  className: string;
  farbe: "red" | "green" | "blue" | "yellow" | null;
  gesamt: number | null;
  moral: number | null;
  gehaltSaison: number;
  gehaltSpieltag: number;
  vertragBisSaison: number | null;
  auslaufend: boolean;
  liebling: boolean;
  treueKosten: number;
  treueMoral: number;
};

export type OfficeModell = {
  teamId: string;
  teamName: string;
  saisonNummer: number;
  spieltag: number;
  spieltageGesamt: number;
  kasse: number;
  vertrauen: number | null;
  stand: VorstandBudgetStand;
  imFenster: boolean;
  charakter: GespraechCharakter;
  sparneigung: number;
  stufen: Array<{ ab: string; anteil: number; aktiv: boolean }>;
  ziele: OfficeZiel[];
  widerspruch: WiderspruchsErgebnis;
  verworfen: Array<{ ersetztDurch: string; label: string; weil: string }>;
  liebling: null | {
    playerId: string;
    name: string;
    pp: number;
    quelle: "vorsaison" | "aktuell";
    imKader: boolean;
    freigegeben: boolean;
    portrait: string | null;
    className: string | null;
    vertragBisSaison: number | null;
  };
  vertraege: { grenze: number; kader: number; balken: Array<{ saison: number; n: number; ueber: boolean }> } | null;
  hochrechnung: { vertrauen: number; zielGeld: number; erfuellt: number; gesamt: number };
  raenge: { vertrauen: OfficeRang | null; gehaltskosten: OfficeRang | null; kasse: OfficeRang | null };
  gespraech: VorstandGespraechZustand & { frei: number };
  praemien: { plan: VorstandPraemienPlan; vorschau: PraemienVorschau; spieler: OfficeSpielerZeile[] };
};

const FARBE_NACH_KLASSE: Record<string, OfficeSpielerZeile["farbe"]> = {
  berserker: "red",
  warlord: "red",
  tank: "red",
  sprinter: "green",
  rogue: "green",
  charger: "green",
  mage: "blue",
  overseer: "blue",
  templar: "blue",
  bard: "yellow",
  hero: "yellow",
  badass: "yellow",
  tactician: "yellow",
};

const r1 = (v: number) => Math.round(v * 10) / 10;
const r2 = (v: number) => Math.round(v * 100) / 100;

function wert(v: unknown): string {
  if (v == null) return "—";
  if (typeof v === "number") return Number.isInteger(v) ? String(v) : String(r1(v)).replace(".", ",");
  if (typeof v === "boolean") return v ? "ja" : "nein";
  return String(v);
}

function alsEntwurf(z: TeamSeasonObjectiveRecord): ZielEntwurf {
  return {
    objectiveId: z.objectiveId,
    category: z.category,
    label: z.label,
    targetValue: z.targetValue,
    currentValue: z.currentValue,
    status: z.status,
    source: z.source,
  };
}

function rangVon(werte: Array<{ teamId: string; v: number }>, teamId: string, kleinerIstBesser: boolean): OfficeRang | null {
  const eigene = werte.find((w) => w.teamId === teamId);
  if (!eigene) return null;
  const besser = werte.filter((w) => w.teamId !== teamId && (kleinerIstBesser ? w.v < eigene.v : w.v > eigene.v)).length;
  return { rang: besser + 1, von: werte.length };
}

export function buildOfficeModell(gameState: GameState, teamId: string): OfficeModell | null {
  const team = gameState.teams.find((t) => t.teamId === teamId);
  if (!team) return null;
  const stand = berechneVorstandBudgetStand(gameState, teamId);
  const { charakter, sparneigung } = gespraechCharakter(gameState, teamId);
  const nr = saisonNr(gameState) ?? 1;
  const overview = buildTeamObjectiveOverview(gameState);
  const alle = overview.objectives.filter((o) => o.teamId === teamId && o.seasonId === gameState.season.id);
  const sichtbar = alle.filter((o) => !/sponsor_v2/.test(o.source ?? "") && !o.objectiveId.startsWith("sponsor-"));
  const neuIds = new Set(["board-lieblingsspieler", "board-vertragslaufzeiten", "vorstand-gespraech-zielhoch", "vorstand-gespraech-binden", "vorstand-gespraech-vertrauen"]);
  const tauschFenster = zielTauschZeitfenster(gameState);
  const ziele: OfficeZiel[] = sichtbar.map((o) => {
    const laufzeit = o.laufzeit;
    const mehrjaehrig = Boolean(laufzeit && laufzeit.bisSaisonNr > laufzeit.vonSaisonNr);
    const delta = o.boardConfidenceDelta ?? 0;
    // Plus/Minus: was bei Erfuellung bzw. Verfehlen gebucht wuerde. Ist der Status entschieden, steht dort der Beleg.
    const plusRoh = o.status === "completed" ? delta : o.status === "failed" ? 0 : Math.max(0, delta);
    return {
      id: o.objectiveId,
      bereich: bereichDesZiels(o),
      label: o.label,
      detail: o.detail ?? null,
      hinweis: o.actionHint ?? null,
      status: o.status,
      ist: wert(o.currentValue),
      soll: wert(o.targetValue),
      plus: r2(o.status === "failed" || o.objectiveId === "vorstand-gespraech-vertrauen" ? 0 : plusRoh > 0 ? plusRoh : 0.3),
      minus: r2(o.status === "failed" ? Math.abs(Math.min(0, delta)) : o.optional ? 0 : Math.abs(Math.min(0, delta)) || 0.3),
      rewardCash: o.rewardCash ?? 0,
      laufzeitText: laufzeit
        ? laufzeit.bisSaisonNr > laufzeit.vonSaisonNr
          ? `bis Ende Saison ${laufzeit.bisSaisonNr}`
          : "diese Saison"
        : "diese Saison",
      mehrjaehrig,
      neu: neuIds.has(o.objectiveId),
      ersetzt: o.ersetzt ?? null,
      tauschbar: tauschFenster.erlaubt && istZielTauschbar(o),
      quelle: o.source ?? "",
    };
  });
  // Reihenfolge: verbindlich zuerst (Sport), dann Finanzen, Kader, Kabine; Zusagen/Vorstand zuletzt.
  const reihenfolge: Record<ZielBereich, number> = { sport: 0, finanzen: 1, kader: 2, kabine: 3 };
  ziele.sort((a, b) => reihenfolge[a.bereich] - reihenfolge[b.bereich]);

  const entwuerfe = sichtbar.map(alsEntwurf);
  const widerspruch = pruefeZielSatz(entwuerfe, { kaderUnterSoll: kaderUnterSoll(gameState, teamId) });
  const verworfen = sichtbar.filter((o) => o.ersetzt).map((o) => ({ ersetztDurch: o.label, label: o.ersetzt!.label, weil: o.ersetzt!.weil }));

  // Lieblingsspieler.
  const l = lieblingFuerSaison(gameState, teamId);
  const byId = new Map((gameState.players ?? []).map((p) => [p.id, p] as const));
  const gespr = lesVorstandGespraech(gameState, teamId);
  let liebling: OfficeModell["liebling"] = null;
  if (l) {
    const roster = gameState.rosters.find((r) => r.teamId === teamId && r.playerId === l.playerId);
    const p = byId.get(l.playerId);
    liebling = {
      playerId: l.playerId,
      name: l.playerName,
      pp: l.pp,
      quelle: l.quelle,
      imKader: Boolean(roster),
      freigegeben: gespr.lieblingFreigegeben,
      portrait: p ? getPlayerPortraitBrowserUrl(p.id, p.portraitUrl, p.portraitPath) : null,
      className: p?.className ?? null,
      vertragBisSaison: roster ? (restlaufzeit(roster, gameState) + nr - 1) : null,
    };
  }

  // Vertragsenden.
  let vertraege: OfficeModell["vertraege"] = null;
  const kader = gameState.rosters.filter((r) => r.teamId === teamId).length;
  if (kader > 0) {
    const proEnde = zaehleVertraegeProEndsaison(gameState, teamId);
    const grenze = vertragslaufzeitGrenze(kader);
    const balken = [nr, nr + 1, nr + 2].map((s) => ({ saison: s, n: proEnde.get(s) ?? 0, ueber: (proEnde.get(s) ?? 0) > grenze }));
    vertraege = { grenze, kader, balken };
  }

  // Hochrechnung der Abrechnung am Saisonende (nur entschiedene und laufende Ziele, wie `buildTeamSeasonObjectiveSettlement`).
  let vertrauenSumme = 0;
  let zielGeld = 0;
  let erfuellt = 0;
  for (const o of sichtbar) {
    if (o.status === "completed") {
      erfuellt += 1;
      zielGeld += o.rewardCash ?? 0;
      vertrauenSumme += o.boardConfidenceDelta ?? 0;
    } else if (o.status === "failed" || o.status === "at_risk") {
      vertrauenSumme += o.boardConfidenceDelta ?? 0;
    }
  }

  // Raenge in der eigenen Liga (Rang 1 ist immer der beste; Kosten: das guenstigste Team).
  const split = isLeagueSplitActive(gameState);
  const tier = split ? getLeagueOf(gameState, teamId) : null;
  const liga = gameState.teams.filter((t) => !tier || getLeagueOf(gameState, t.teamId) === tier);
  const gehaltByTeam = new Map<string, number>();
  for (const r of gameState.rosters) gehaltByTeam.set(r.teamId, (gehaltByTeam.get(r.teamId) ?? 0) + (r.salary ?? 0));
  const raenge: OfficeModell["raenge"] = {
    vertrauen: rangVon(
      liga.map((t) => ({ teamId: t.teamId, v: overview.boardConfidence[t.teamId]?.value ?? 5 })),
      teamId,
      false,
    ),
    gehaltskosten: rangVon(liga.map((t) => ({ teamId: t.teamId, v: gehaltByTeam.get(t.teamId) ?? 0 })), teamId, true),
    kasse: rangVon(liga.map((t) => ({ teamId: t.teamId, v: t.cash ?? 0 })), teamId, false),
  };

  // Praemien.
  const plan = lesPraemienPlan(gameState, teamId);
  const vorschau = vorschauPraemien(gameState, teamId, plan);
  const moralByPlayer = new Map((gameState.playerMoraleState ?? []).filter((m) => m.teamId === teamId).map((m) => [m.playerId, m.morale] as const));
  const treue = TREUE_STUFEN[plan.treueStufe]!;
  const spieler: OfficeSpielerZeile[] = gameState.rosters
    .filter((r) => r.teamId === teamId)
    .map((r) => {
      const p = byId.get(r.playerId);
      const klasse = (p?.className ?? "").toLowerCase();
      const rest = restlaufzeit(r, gameState);
      return {
        playerId: r.playerId,
        name: p?.name ?? r.playerId,
        portrait: p ? getPlayerPortraitBrowserUrl(p.id, p.portraitUrl, p.portraitPath) : null,
        className: p?.className ?? "",
        farbe: FARBE_NACH_KLASSE[klasse] ?? null,
        gesamt: p?.ovr ?? p?.rating ?? null,
        moral: moralByPlayer.get(r.playerId) ?? null,
        gehaltSaison: r2(r.salary ?? 0),
        gehaltSpieltag: r2((r.salary ?? 0) / Math.max(1, gameState.season.matchdayIds?.length ?? 20)),
        vertragBisSaison: nr + rest - 1,
        auslaufend: rest <= 1,
        liebling: liebling?.playerId === r.playerId,
        treueKosten: r2((r.salary ?? 0) * treue.anteil),
        treueMoral: treue.moral,
      };
    })
    .sort((a, b) => (b.gesamt ?? 0) - (a.gesamt ?? 0));

  const spieltag = (gameState.seasonState.matchdayResults ?? []).filter((e) => e.seasonId === gameState.season.id).length;
  return {
    teamId,
    teamName: team.name,
    saisonNummer: nr,
    spieltag,
    spieltageGesamt: gameState.season.matchdayIds?.length ?? 0,
    kasse: team.cash ?? 0,
    vertrauen: stand.vertrauen ?? overview.boardConfidence[teamId]?.value ?? null,
    stand,
    imFenster: evaluateGamePhaseAction(gameState, "credit_borrow").allowed,
    charakter,
    sparneigung,
    stufen: VORSTAND_STUFEN.map((s) => ({
      ab: Number.isFinite(s.abVertrauen) ? String(s.abVertrauen).replace(".", ",") : "",
      anteil: s.anteil,
      aktiv: Math.abs(s.anteil - stand.anteil) < 1e-9,
    })),
    ziele,
    widerspruch,
    verworfen,
    liebling,
    vertraege,
    hochrechnung: { vertrauen: r2(vertrauenSumme), zielGeld: r2(zielGeld), erfuellt, gesamt: sichtbar.length },
    raenge,
    gespraech: { ...gespr, frei: Math.max(0, GESPRAECHE_JE_SAISON - gespr.genutzt) },
    praemien: { plan, vorschau, spieler },
  };
}

export { SIEG_STUFEN, TREUE_STUFEN };
