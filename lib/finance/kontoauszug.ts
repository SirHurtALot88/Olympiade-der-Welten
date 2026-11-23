/**
 * Finanzkonzept V2, Stufe 0: Kontoauszug je Team — NUR LESEN.
 *
 * Jede Zeile kommt aus einem Ledger, das es schon gibt (Transferverlauf, Sponsor-Auszahlungslog,
 * Apron-Log, Vorstandsziel-Log, Notfall-Kasse). Es wird nichts neu gebucht, die GuV
 * (`season-end-guv.ts`) bleibt unveraendert; der Kontoauszug ist die Zeilen-Sicht auf dieselben Quellen.
 *
 * Jede Zeile traegt Saison, Spieltag (soweit das Ledger ihn kennt; sonst die Phase), Art, Quelle und
 * Betrag mit Vorzeichen (+ Zufluss, - Abfluss). Heute fallen Sponsor, Gehalt, Apron und Ziele am
 * Saisonende an (Phase `season_end`); in Saisons mit Stempel `finanzenJeSpieltag` (22.11.) kommen Gehalt,
 * Sponsor-Basis und Gebaeude je Spieltag als Zeilen der Phase `saison` hinzu, ohne dass sich dieses Format aendert.
 */

import type { GameState } from "@/lib/data/olyDataTypes";
import { baueBuchungsKontext, bucheTransferEintrag } from "@/lib/season/transferbilanz-buchung";

export type KontoauszugArt =
  /** Saison 1: Draft/Startkader aus dem Startbudget (Kauf negativ, Verkauf vor Spieltag 1 positiv) — kein Transfer. */
  | "kaderaufbau"
  | "transfer_kauf"
  | "transfer_verkauf"
  | "vertragsende_abloese"
  | "sponsor"
  | "gehalt_und_sponsor_saisonende"
  | "gehalt_spieltag"
  | "sponsor_basis_spieltag"
  | "rang_abschlag_spieltag"
  | "rang_schlussausgleich"
  | "gebaeude_einnahme_spieltag"
  | "gebaeude_unterhalt_spieltag"
  | "marketing_spieltag"
  | "tickets_spieltag"
  | "dauerkarten"
  | "arena_ausbau"
  | "medaillen"
  | "farb_meister"
  | "apron"
  | "vorstandsziele"
  | "vorstand_praemien"
  | "notfall_kasse";

export type KontoauszugZeile = {
  seasonId: string;
  /** Spieltag-ID, soweit das Ledger sie fuehrt; sonst null. */
  matchdayId: string | null;
  /** Phase: "kaufphase" (Transfer vor Spieltag 1), "saison" (Spieltag), "saisonende" (Abrechnung). */
  phase: "kaufphase" | "saison" | "saisonende" | "unbekannt";
  art: KontoauszugArt;
  /** Ledger, aus dem die Zeile stammt (Feldname im Spielstand). */
  quelle: string;
  /** Kurzbeschreibung (Spieler, Komponente, Quelle). */
  text: string;
  /** Betrag mit Vorzeichen in C. */
  betrag: number;
  /** Zeitstempel des Ledger-Eintrags, soweit vorhanden (nur zur Sortierung). */
  zeit: string | null;
};

export type TeamKontoauszug = {
  teamId: string;
  zeilen: KontoauszugZeile[];
  summeZufluss: number;
  summeAbfluss: number;
  saldo: number;
  /** Saldo je Art. */
  jeArt: Partial<Record<KontoauszugArt, number>>;
};

function r2(v: number): number {
  return Math.round(v * 100) / 100;
}

/** Zeilen aller Teams in einem Durchlauf (ein Pass ueber die Ledger, nicht einer je Team). */
export function buildKontoauszuege(gameState: GameState, seasonId?: string | null): Map<string, TeamKontoauszug> {
  const nurSaison = seasonId ?? null;
  const proTeam = new Map<string, KontoauszugZeile[]>();
  const add = (teamId: string | null | undefined, zeile: KontoauszugZeile) => {
    if (!teamId || !Number.isFinite(zeile.betrag) || zeile.betrag === 0) return;
    if (nurSaison && zeile.seasonId !== nurSaison) return;
    (proTeam.get(teamId) ?? proTeam.set(teamId, []).get(teamId)!).push({ ...zeile, betrag: r2(zeile.betrag) });
  };

  // 1) Transfers (Kauf, Verkauf, Vertragsende). Verkauf nutzt die tatsaechliche Cash-Wirkung (netto).
  //    Kaeufe/Verkaeufe des Fensters von Saison 1 sind KADERAUFBAU aus dem Startbudget, kein Transfer
  //    (Chris 18.11., `lib/season/transferbilanz-buchung.ts`): eigene Art, damit Finanzseite und GuV sie getrennt
  //    zeigen. Die Zeile bleibt in der Saison, in der das Geld floss.
  const buchungsKontext = baueBuchungsKontext(gameState.transferHistory ?? [], gameState.season?.matchdayIds?.length ?? null);
  for (const e of gameState.transferHistory ?? []) {
    const kaderaufbau =
      (e.transferType === "buy" || e.transferType === "sell") &&
      bucheTransferEintrag(e, buchungsKontext).art === "kaderaufbau";
    const text = `${e.playerName ?? e.playerId} (${e.source ?? "transfer"})`;
    const phase = e.matchdayId ? "saison" : "kaufphase";
    if (e.transferType === "buy") {
      add(e.toTeamId, {
        seasonId: e.seasonId, matchdayId: e.matchdayId ?? null, phase: phase === "saison" ? "saison" : "kaufphase",
        art: kaderaufbau ? "kaderaufbau" : "transfer_kauf", quelle: "transferHistory", text, betrag: -(e.netCashImpact ?? e.fee), zeit: e.happenedAt,
      });
    } else if (e.transferType === "sell") {
      add(e.fromTeamId, {
        seasonId: e.seasonId, matchdayId: e.matchdayId ?? null, phase: phase === "saison" ? "saison" : "kaufphase",
        art: kaderaufbau ? "kaderaufbau" : "transfer_verkauf", quelle: "transferHistory", text, betrag: e.netCashImpact ?? e.fee, zeit: e.happenedAt,
      });
    } else if (e.transferType === "contract_exit") {
      add(e.fromTeamId, {
        seasonId: e.seasonId, matchdayId: e.matchdayId ?? null, phase: "saisonende",
        art: "vertragsende_abloese", quelle: "transferHistory", text, betrag: e.netCashImpact ?? e.fee, zeit: e.happenedAt,
      });
    }
  }

  // 2) Sponsor- und Gehaltszeilen (Auszahlungslog; die Saisonende-Zeilen enthalten auch den Gehaltsabzug).
  const hatRangAbschlaege = new Set(
    (gameState.seasonState.spieltagFinanzen ?? []).filter((b) => (b.rangAbschlag ?? 0) !== 0).map((b) => `${b.seasonId}:${b.teamId}`),
  );
  for (const l of gameState.seasonState.sponsorPayoutLogs ?? []) {
    // RANG-ABSCHLAG (22.11.): die Zeile "Tabellenplatz" ist in Saisons mit Abschlaegen der Schlussausgleich.
    if (l.phase === "season_end" && (l.componentId ?? "").endsWith(":v3:rank") && hatRangAbschlaege.has(`${l.seasonId}:${l.teamId}`)) {
      add(l.teamId, {
        seasonId: l.seasonId, matchdayId: null, phase: "saisonende", art: "rang_schlussausgleich",
        quelle: "sponsorPayoutLogs", text: "Rangprämie Schlussausgleich", betrag: l.cashDelta, zeit: l.createdAt,
      });
      continue;
    }
    add(l.teamId, {
      seasonId: l.seasonId, matchdayId: null, phase: l.phase === "season_end" ? "saisonende" : "unbekannt",
      art: l.phase === "season_end" ? "gehalt_und_sponsor_saisonende" : "sponsor",
      quelle: "sponsorPayoutLogs", text: `${l.phase}${l.componentId ? `:${l.componentId}` : ""}`, betrag: l.cashDelta, zeit: l.createdAt,
    });
  }

  // 2b) FINANZEN JE SPIELTAG (22.11.): Gehalt, Sponsor-Basis, Gebaeude-Einnahme und -Unterhalt je gespieltem Spieltag, eine
  //     Zeile je Fluss. Quelle ist das Ledger `spieltagFinanzen`; der Saisonabschluss bucht davon nichts mehr doppelt.
  for (const b of gameState.seasonState.spieltagFinanzen ?? []) {
    const basis = { seasonId: b.seasonId, matchdayId: b.matchdayId, phase: "saison" as const, quelle: "spieltagFinanzen", zeit: b.createdAt };
    add(b.teamId, { ...basis, art: "gehalt_spieltag", text: `Gehalt Spieltag ${b.matchdayIndex}/${b.matchdayCount}`, betrag: b.gehalt });
    add(b.teamId, { ...basis, art: "sponsor_basis_spieltag", text: `Sponsor-Basis Spieltag ${b.matchdayIndex}/${b.matchdayCount}`, betrag: b.sponsorBasis });
    add(b.teamId, {
      ...basis, art: "rang_abschlag_spieltag",
      text: `Rangprämie Abschlag Spieltag ${b.matchdayIndex}/${b.matchdayCount}${b.rang != null ? ` (Platz ${b.rang})` : ""}`,
      betrag: b.rangAbschlag ?? 0,
    });
    add(b.teamId, { ...basis, art: "gebaeude_einnahme_spieltag", text: `Gebäude-Einnahme Spieltag ${b.matchdayIndex}/${b.matchdayCount}`, betrag: b.gebaeudeEinnahme });
    add(b.teamId, { ...basis, art: "gebaeude_unterhalt_spieltag", text: `Gebäude-Unterhalt Spieltag ${b.matchdayIndex}/${b.matchdayCount}`, betrag: b.gebaeudeUnterhalt });
    if ((b.marketing ?? 0) !== 0) {
      add(b.teamId, { ...basis, art: "marketing_spieltag", text: `Marketing Spieltag ${b.matchdayIndex}/${b.matchdayCount}`, betrag: b.marketing ?? 0 });
    }
    // ARENA (22.11.): Tageskasse des Heimspiels und Dauerkarten-Standard (Spieltag 1), je eine Zeile.
    if ((b.tickets ?? 0) !== 0) {
      add(b.teamId, { ...basis, art: "tickets_spieltag", text: `Ticket-Einnahmen Heimspiel Spieltag ${b.matchdayIndex}/${b.matchdayCount}`, betrag: b.tickets ?? 0 });
    }
    if ((b.dauerkarten ?? 0) !== 0) {
      add(b.teamId, { ...basis, art: "dauerkarten", text: "Dauerkarten (Standard, vor Spieltag 1 nicht gewählt)", betrag: b.dauerkarten ?? 0 });
    }
  }

  // 2c) ARENA (22.11.): Dauerkarten, die der Manager vor Spieltag 1 gewaehlt hat (sofort gutgeschrieben), und Ausbau-Schritte (aus dem Investitionstopf).
  for (const [teamId, stand] of Object.entries(gameState.seasonState.arena ?? {})) {
    if (stand.dauerkarten?.sofort && stand.dauerkarten.geld !== 0) {
      add(teamId, { seasonId: stand.dauerkarten.seasonId, matchdayId: null, phase: "kaufphase", art: "dauerkarten", quelle: "arena", text: `Dauerkarten ${stand.dauerkarten.stufe} (Rabatt 25 %)`, betrag: stand.dauerkarten.geld, zeit: stand.dauerkarten.zeit ?? null });
    }
    for (const a of stand.ausbau ?? []) {
      add(teamId, { seasonId: a.seasonId, matchdayId: null, phase: a.matchdayIndex <= 0 ? "kaufphase" : "saison", art: "arena_ausbau", quelle: "arena", text: `Arena-Ausbau ${a.bereich === "steh" ? "Stehplätze" : a.bereich === "sitz" ? "Sitzplätze" : "Logen"} ×${a.schritte}`, betrag: -a.kosten, zeit: a.zeit ?? null });
    }
  }

  // 2d) MEDAILLEN (22.11.): Disziplin-Medaillen und Farb-Meister der abgelaufenen Saison, am Saisonende gebucht.
  const vergabe = gameState.seasonState.medaillenVergabe;
  if (vergabe) {
    for (const [teamId, g] of Object.entries(vergabe.geldJeTeam)) {
      if (g.medaillen !== 0) add(teamId, { seasonId: vergabe.seasonId, matchdayId: null, phase: "saisonende", art: "medaillen", quelle: "medaillenVergabe", text: "Disziplin-Medaillen", betrag: g.medaillen, zeit: vergabe.gebuchtAm });
      if (g.farbe !== 0) add(teamId, { seasonId: vergabe.seasonId, matchdayId: null, phase: "saisonende", art: "farb_meister", quelle: "medaillenVergabe", text: "Farb-Meister", betrag: g.farbe, zeit: vergabe.gebuchtAm });
    }
  }

  // 3) Apron.
  for (const l of gameState.seasonState.apronSettlementLogs ?? []) {
    add(l.teamId, {
      seasonId: l.seasonId, matchdayId: null, phase: "saisonende", art: "apron", quelle: "apronSettlementLogs",
      text: l.kind, betrag: l.cashDelta, zeit: l.createdAt,
    });
  }

  // 4) Vorstandsziele (Beleg je Team, sofern das Log ihn fuehrt; aeltere Spielstaende fuehren ihn nicht).
  for (const l of gameState.seasonState.objectiveRewardApplyLogs ?? []) {
    for (const [teamId, delta] of Object.entries(l.payload.cashDeltaByTeamId ?? {})) {
      add(teamId, {
        seasonId: l.seasonId, matchdayId: null, phase: "saisonende", art: "vorstandsziele", quelle: "objectiveRewardApplyLogs",
        text: "Vorstandsziele", betrag: delta, zeit: l.createdAt,
      });
    }
  }

  // 4b) Vorstands-Praemien (Office 21.11): Siege und Treue, ungekuerztes Log je Team.
  for (const [teamId, eintraege] of Object.entries(gameState.seasonState.vorstandPraemienLogs ?? {})) {
    for (const e of eintraege) {
      add(teamId, {
        seasonId: e.seasonId, matchdayId: null, phase: "saison", art: "vorstand_praemien", quelle: "vorstandPraemienLogs",
        text: e.art === "sieg" ? `Siegprämie ${e.side?.toUpperCase() ?? ""}`.trim() : "Treueprämie", betrag: e.cashDelta, zeit: e.zeit,
      });
    }
  }

  // 5) Notfall-Kasse der KI (Geld aus dem Nichts, deshalb sichtbar).
  for (const i of gameState.seasonState.aiEmergencyCashInjections ?? []) {
    add(i.teamId, {
      seasonId: i.seasonId, matchdayId: null, phase: "kaufphase", art: "notfall_kasse", quelle: "aiEmergencyCashInjections",
      text: i.reason, betrag: i.amount, zeit: i.createdAt,
    });
  }

  const out = new Map<string, TeamKontoauszug>();
  for (const team of gameState.teams) {
    const zeilen = (proTeam.get(team.teamId) ?? []).sort((a, b) => (a.zeit ?? "").localeCompare(b.zeit ?? ""));
    let zufluss = 0;
    let abfluss = 0;
    const jeArt: Partial<Record<KontoauszugArt, number>> = {};
    for (const z of zeilen) {
      if (z.betrag >= 0) zufluss += z.betrag;
      else abfluss += z.betrag;
      jeArt[z.art] = r2((jeArt[z.art] ?? 0) + z.betrag);
    }
    out.set(team.teamId, {
      teamId: team.teamId,
      zeilen,
      summeZufluss: r2(zufluss),
      summeAbfluss: r2(abfluss),
      saldo: r2(zufluss + abfluss),
      jeArt,
    });
  }
  return out;
}

/** Kontoauszug eines Teams (fuer die Anzeige). Fuer alle Teams besser `buildKontoauszuege`. */
export function buildTeamKontoauszug(gameState: GameState, teamId: string, seasonId?: string | null): TeamKontoauszug {
  return (
    buildKontoauszuege(gameState, seasonId).get(teamId) ?? {
      teamId, zeilen: [], summeZufluss: 0, summeAbfluss: 0, saldo: 0, jeArt: {},
    }
  );
}
