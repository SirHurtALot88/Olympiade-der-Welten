import { describe, expect, it } from "vitest";

import {
  buildNewGameStateFromBaseline,
  previewNewGameSetup,
} from "@/lib/game/new-game-setup-service";
import { resolveFoundationSaveMode } from "@/lib/persistence/foundation-save-mode";
import { getTeamSponsorContract, getTeamSponsorOffers } from "@/lib/sponsor/sponsor-offer-service";
import { buildInitialLeagueAssignment, isLeagueSplitActive, type LeagueTier } from "@/lib/season/league-split";
import { isFatigueActiveRecoveryEnabled } from "@/lib/fatigue/fatigue-injury-service";
import { formatGameFlowBlocker } from "@/lib/foundation/game-flow-blocker-labels";

describe("new-game-setup-service", () => {
  it("creates a Solo 1 preview with one Chris team and AI rest", () => {
    const preview = previewNewGameSetup({ presetId: "solo_1", now: "2026-06-13T10:00:00.000Z" });

    expect(preview.blockers).toEqual([]);
    expect(preview.counts.chris).toBe(1);
    expect(preview.counts.franky).toBe(0);
    expect(preview.counts.ai).toBe(31);
    expect(preview.chrisTeamIds).toEqual(["M-M"]);
    expect(preview.room.enabled).toBe(false);
  }, 120_000);

  it("creates a Solo 4 preview with four local human teams", () => {
    const { gameState, preview } = buildNewGameStateFromBaseline({ presetId: "solo_4", now: "2026-06-13T10:00:00.000Z" });

    expect(preview.counts.chris).toBe(4);
    expect(preview.chrisTeamIds).toEqual(["P-S", "D-P", "M-M", "V-W"]);
    expect(preview.frankyTeamIds).toEqual([]);
    expect(gameState.scenarioMeta?.saveMode).toBe("solo_4");
    expect(gameState.scenarioMeta?.humanControlledTeamCount).toBe(4);
    expect(resolveFoundationSaveMode({ gameState })).toBe("solo_4");
  }, 120_000);

  it("creates Online 4v4 with Chris, Franky and AI ownership metadata", () => {
    const { gameState, preview } = buildNewGameStateFromBaseline({
      presetId: "online_4v4",
      now: "2026-06-13T10:00:00.000Z",
      saveId: "save-new-game-test",
    });

    expect(preview.counts).toMatchObject({ chris: 4, franky: 4, ai: 24, passive: 0, total: 32 });
    expect(preview.chrisTeamIds).toEqual(["P-S", "D-P", "M-M", "V-W"]);
    expect(preview.frankyTeamIds).toEqual(["M-S", "P-C", "C-S", "G-G"]);
    expect(gameState.scenarioMeta?.roomCode).toMatch(/^NEW-/);
    expect(gameState.scenarioMeta?.saveMode).toBe("online_4v4");
    expect(gameState.scenarioMeta?.roomParticipants?.map((participant) => participant.displayName)).toEqual(["Chris", "Franky"]);
    expect(gameState.scenarioMeta?.teamOwnership?.filter((entry) => entry.controllerType === "human")).toHaveLength(8);
    expect(gameState.seasonState.teamControlSettings?.["M-M"]?.ownerId).toBe("user_local");
    expect(gameState.seasonState.teamControlSettings?.["M-S"]?.ownerId).toBe("franky_remote_placeholder");
    expect(gameState.seasonState.teamControlSettings?.["A-A"]?.controlMode).toBe("ai");
    expect(resolveFoundationSaveMode({ gameState })).toBe("online_4v4");
  }, 120_000);

  it("uses immutable baseline state and clears mutable season history for a new game", () => {
    const { gameState, preview } = buildNewGameStateFromBaseline({
      presetId: "solo_1",
      now: "2026-06-13T10:00:00.000Z",
    });

    expect(preview.baseline.baselineCount).toBe(preview.baseline.playerCount);
    expect(preview.baseline.resetPlayers).toBe(preview.baseline.playerCount);
    expect(gameState.players.every((player) => (player.currentXP ?? 0) === 0)).toBe(true);
    expect(gameState.players.every((player) => (player.spentXP ?? 0) === 0)).toBe(true);
    expect(gameState.players.every((player) => player.lifetimeXP == null)).toBe(true);
    expect(gameState.players.every((player) => (player.fatigue ?? 0) === 0)).toBe(true);
    const proofPlayer = gameState.players.find((player) => player.attributeSheetStats?.power != null)!;
    const proofBaseline = gameState.playerBaselines?.find((baseline) => baseline.playerId === proofPlayer.id)!;
    expect(proofPlayer.attributeSheetStats?.power).toBe(proofBaseline.attributes.power);
    expect(proofPlayer.currentDisciplineValues).toEqual(proofBaseline.disciplineRatings);
    expect(proofPlayer.marketValue).toBe(proofBaseline.marketValue);
    expect(proofPlayer.salaryDemand).toBe(proofBaseline.salary);
    expect(gameState.transferHistory).toEqual([]);
    expect(gameState.rosters).toEqual([]);
    expect(gameState.contracts).toEqual([]);
    expect(gameState.playerProgressionEvents).toEqual([]);
    expect(gameState.seasonState.formCards).toEqual([]);
    expect(gameState.seasonState.lineupDrafts).toEqual([]);
    expect(gameState.seasonState.matchdayResults).toEqual([]);
    expect(gameState.seasonState.seasonSnapshots).toEqual([]);
  }, 120_000);

  it("sets Season 1 setup and GLOBAL start ranks for a Manager Mode game (default, no gameMode)", () => {
    const { gameState, preview } = buildNewGameStateFromBaseline({
      presetId: "solo_1",
      now: "2026-06-13T10:00:00.000Z",
    });

    // Neue Spiele starten im offenen Spieltag 1 (Saisonstart-Setup): Kaufen/Training/
    // Sponsor bleiben über die Early-Setup-Gates erlaubt, aber Einsatzliste + Arena
    // sind freigeschaltet. `preseason_management` würde S1/MD1 in eine Sackgasse sperren
    // (phase_blocked:set_lineup), da es aus dieser Phase für ein neues Spiel keinen Ausweg gibt.
    expect(gameState.gamePhase).toBe("season_active");
    expect(gameState.season.id).toBe("season-1");
    expect(gameState.season.currentMatchday).toBe(1);
    expect(gameState.matchdayState.status).toBe("planning");
    expect(gameState.scenarioMeta?.gameMode).toBe("manager");
    // BUGFIX (docs/design/battle-mode-spielmodus-plan.md, Abschnitt 0 Fund 1-2, Abschnitt 4 PR 1):
    // Liga-Split war nie als Standard fuer ALLE neuen Spiele gedacht, sondern nur ein optionales
    // Battle-Mode-Feature. Ohne `gameMode: "battle"` bleibt ein neues Spiel exakt im
    // Legacy-32er-Zustand: kein Liga-Split, globaler Budget-Startrang 1..32. M-M ist Budget-Rang 1,
    // R-R ist Budget-Rang 32 -- GLOBAL, nicht liga-lokal.
    expect(isLeagueSplitActive(gameState)).toBe(false);
    expect(gameState.seasonState.leagueByTeamId?.["M-M"]).toBeUndefined();
    expect(gameState.seasonState.leagueByTeamId?.["R-R"]).toBeUndefined();
    expect(Object.keys(gameState.seasonState.leagueByTeamId ?? {})).toHaveLength(0);
    expect(gameState.seasonState.standings["M-M"]?.startplatz).toBe(1);
    expect(gameState.seasonState.standings["M-M"]?.rank).toBe(1);
    expect(gameState.seasonState.standings["R-R"]?.startplatz).toBe(32);
    expect(gameState.seasonState.standings["R-R"]?.rank).toBe(32);
    expect(preview.teams.find((team) => team.teamId === "M-M")?.budget).toBe(325);
    expect(preview.teams.find((team) => team.teamId === "R-R")?.budget).toBe(170);
    // Kein liga-gesplitteter Spielplan fuer Manager Mode: der ererbte Baseline-Spielplan bleibt
    // unangetastet (der alte, saveunabhaengige Dummy-Platzhalter aus dem Seed), nicht die
    // 160-Fixture-Liga-Split-Paarung.
    expect(gameState.seasonState.schedule).not.toHaveLength(160);
    // W2 bleibt Battle-only: Manager Mode behält 10 Spieltage, jede Disziplin einmal, und KEINE
    // aktive Erholung (Chris' laufender Manager-Save darf davon nicht berührt werden).
    expect(gameState.season.matchdayIds).toHaveLength(10);
    expect(gameState.seasonState.disciplineSchedule).toHaveLength(10);
    expect(
      (gameState.seasonState.disciplineSchedule ?? []).every(
        (entry) => entry.discipline1?.occurrenceInSeason === undefined && entry.discipline2?.occurrenceInSeason === undefined,
      ),
    ).toBe(true);
    expect(isFatigueActiveRecoveryEnabled(gameState)).toBe(false);
    expect(preview.seasonSetup.matchdayCount).toBe(10);
  }, 120_000);

  it("sets Season 1 setup and LEAGUE-LOCAL start ranks for a Battle Mode game (gameMode: \"battle\")", () => {
    const { gameState, preview } = buildNewGameStateFromBaseline({
      presetId: "solo_1",
      gameMode: "battle",
      now: "2026-06-13T10:00:00.000Z",
    });

    expect(gameState.gamePhase).toBe("season_active");
    expect(gameState.scenarioMeta?.gameMode).toBe("battle");
    // Liga-Split-Aktivierung (docs/design/liga-split-plan.md, Abschnitt 9, PR 6), jetzt hinter
    // `gameMode: "battle"` gegated (battle-mode-spielmodus-plan.md, Abschnitt 4 PR 3): die
    // Startplaetze werden liga-lokal (1..16) statt global (1..32) vergeben. M-M ist Budget-Rang 1
    // (global wie liga-lokal identisch: 1). R-R ist Budget-Rang 32 global, aber Liga-2-Rang 16
    // (32 - LEAGUE_SIZE).
    expect(isLeagueSplitActive(gameState)).toBe(true);
    expect(gameState.seasonState.leagueByTeamId?.["M-M"]).toBe("liga1");
    expect(gameState.seasonState.leagueByTeamId?.["R-R"]).toBe("liga2");
    expect(Object.keys(gameState.seasonState.leagueByTeamId ?? {})).toHaveLength(32);
    expect(gameState.seasonState.standings["M-M"]?.startplatz).toBe(1);
    expect(gameState.seasonState.standings["M-M"]?.rank).toBe(1);
    expect(gameState.seasonState.standings["R-R"]?.startplatz).toBe(16);
    expect(gameState.seasonState.standings["R-R"]?.rank).toBe(16);
    expect(preview.teams.find((team) => team.teamId === "M-M")?.budget).toBe(325);
    expect(preview.teams.find((team) => team.teamId === "R-R")?.budget).toBe(170);
    // W2 (16.10.): ein Battle-Save hat 20 Spieltage, jede Disziplin genau zweimal — einmal je
    // Saisonhälfte, die zweite Kadergröße nie gleich der ersten (Chris 06.09.).
    expect(gameState.season.matchdayIds).toHaveLength(20);
    expect(gameState.season.matchdayIds[19]).toBe("matchday-20");
    expect(gameState.seasonState.disciplineSchedule).toHaveLength(20);
    const vorkommen = new Map<string, Array<{ index: number; size: number | null | undefined; occ?: number }>>();
    for (const entry of gameState.seasonState.disciplineSchedule ?? []) {
      for (const slot of [entry.discipline1, entry.discipline2]) {
        if (!slot?.disciplineId) continue;
        vorkommen.set(slot.disciplineId, [
          ...(vorkommen.get(slot.disciplineId) ?? []),
          { index: entry.matchdayIndex, size: slot.playerCount, occ: slot.occurrenceInSeason },
        ]);
      }
    }
    expect(vorkommen.size).toBe(20);
    for (const [disciplineId, eintraege] of vorkommen) {
      expect(eintraege, disciplineId).toHaveLength(2);
      const [erstes, zweites] = [...eintraege].sort((a, b) => a.index - b.index);
      expect(erstes!.index).toBeLessThanOrEqual(10);
      expect(zweites!.index).toBeGreaterThanOrEqual(11);
      expect(erstes!.occ).toBe(1);
      expect(zweites!.occ).toBe(2);
      if (disciplineId !== "mini-dm") {
        expect(zweites!.size, disciplineId).not.toBe(erstes!.size);
      }
    }
    // ... und die aktive Erholung greift in genau dieser Saison (Fatigue-Plan Teil C).
    expect(isFatigueActiveRecoveryEnabled(gameState)).toBe(true);
    expect(preview.seasonSetup.matchdayCount).toBe(20);
    // Echter Spielplan der ersten Saison statt der Dummy-Paarung (Plan-Abschnitt 5): 2 Ligen *
    // 20 Spieltage * 8 Paarungen = 320 Fixtures (Doppel-Rundenplan), jedes Team genau 1 Fixture
    // pro Spieltag, alle Paarungen liga-intern.
    expect(gameState.seasonState.schedule).toHaveLength(320);
    const md1Fixtures = gameState.seasonState.schedule.filter(
      (fixture) => fixture.matchdayId === gameState.season.matchdayIds[0],
    );
    expect(md1Fixtures).toHaveLength(16);
    const teamsOnMd1 = md1Fixtures.flatMap((fixture) => [fixture.homeTeamId, fixture.awayTeamId]);
    expect(new Set(teamsOnMd1).size).toBe(32);
    for (const fixture of gameState.seasonState.schedule) {
      expect(gameState.seasonState.leagueByTeamId?.[fixture.homeTeamId]).toBe(
        gameState.seasonState.leagueByTeamId?.[fixture.awayTeamId],
      );
    }
  }, 120_000);

  it("seeds sponsor offers for the human team so the choose_sponsor step has real cards to show", () => {
    const { gameState } = buildNewGameStateFromBaseline({
      presetId: "solo_1",
      now: "2026-06-13T10:00:00.000Z",
    });

    const chooseSponsorStep = gameState.seasonState.newGameFlow?.steps?.find(
      (step) => step.stepId === "choose_sponsor",
    );
    expect(chooseSponsorStep?.status).toBe("open");
    expect(getTeamSponsorContract(gameState, "M-M")).toBeNull();

    const offers = getTeamSponsorOffers(gameState, "M-M");
    // DREI Karten seit dem Gebäude-Schalter (Chris: „nur 3 Sponsoren statt 5"). Die Zahl fuenf kam
    // aus der Gebäude-Bauvorlage; ohne Gebäude unterscheiden sich die Karten nur noch in Achse,
    // Rarity, Kurvenform und Laufzeit, und drei davon sind eine Auswahl statt Fuellmaterial.
    expect(offers).toHaveLength(3);
    // Der eigentliche Befund dieses Falls ist unveraendert: es entsteht ueberhaupt ein VOLLER Slate.
    // Die Angebote entstehen hier, wo `rosters` noch
    // leer ist (der Liga-Draft läuft erst im Flow-Schritt `fill_roster`). Die Achse
    // `kaderpflege` fragte „hat dieses Team einen Kader?" und fiel deshalb für JEDES Team aus
    // dem Angebot; mit dem Saison-1-Ausschluss von `wachstum` blieben drei Achsen übrig und der
    // Deckel `min(5, 1 + Achsen)` lieferte 4 Karten. Schlimmer als die fehlende Karte war, dass
    // `chooseSponsorOfferForAiTeams` direkt danach läuft: Alle 31 KI-Teams unterschrieben aus
    // dem verkürzten Slate, und unterschriebene Angebote werden nie neu gebaut.
    //
    // Archetypen: In Saison 1 sind genau ZWEI erreichbar, nicht drei. Der Archetyp folgt der
    // Achse (`SPONSOR_AXIS_ARCHETYPE`), und `performance` hängt allein an `wachstum` — der
    // Marktwert-Achse, die in Saison 1 bewusst ausgeschlossen ist, weil ihr die Vorsaison als
    // Messbasis fehlt. Die vier verbleibenden Achsen verteilen sich auf `identity` (ausbau,
    // entwicklung) und `security` (soliditaet, kaderpflege). Die frühere Erwartung von drei
    // Archetypen war also nie erfüllbar, seit `wachstum` in Saison 1 entfällt — sie hat den
    // Kartenmangel mit verdeckt, statt ihn zu zeigen.
    const archetypen = new Set(offers.map((offer) => offer.archetype));
    expect(archetypen).toEqual(new Set(["identity", "security"]));
    expect(offers.every((offer) => offer.seasonId === gameState.season.id)).toBe(true);

    // Deterministic: rebuilding from the same baseline input yields identical offer ids, not a
    // reshuffled set — this is what makes it safe to (re)generate on load without persisting.
    const second = buildNewGameStateFromBaseline({
      presetId: "solo_1",
      now: "2026-06-13T10:00:00.000Z",
    });
    const offersAgain = getTeamSponsorOffers(second.gameState, "M-M");
    expect(offersAgain.map((offer) => offer.offerId)).toEqual(offers.map((offer) => offer.offerId));
  }, 120_000);

  it("auto-signs AI teams' sponsors already in Season 1 while leaving the human team to choose", () => {
    const { gameState } = buildNewGameStateFromBaseline({
      presetId: "solo_1",
      now: "2026-06-13T10:00:00.000Z",
    });

    // Das menschliche Team (M-M, controlMode manual) hat weiterhin KEINEN Vertrag — es wählt selbst.
    expect(getTeamSponsorContract(gameState, "M-M")).toBeNull();

    // ALLE AI-Teams haben in S1 bereits einen unterschriebenen Sponsorvertrag (sichtbare Einnahmen +
    // Namen im Finanz-/Sponsor-Tab). Vorher waren sie alle vertragslos bis zum S1→S2-Übergang.
    const aiTeamIds = gameState.teams.map((team) => team.teamId).filter((teamId) => teamId !== "M-M");
    for (const teamId of aiTeamIds) {
      const contract = getTeamSponsorContract(gameState, teamId);
      expect(contract, `expected AI team ${teamId} to have a signed sponsor contract in S1`).not.toBeNull();
      expect(contract?.seasonId).toBe(gameState.season.id);
    }
  }, 120_000);

  /**
   * TASK #155 — Liga 2 ist im Battle Mode komplett KI-gesteuert (Wizard-Filter): ein Liga-2-Team
   * darf als Chris-/Franky-Team niemals in einem Battle-Mode-Save ankommen, auch nicht über einen
   * direkten Aufruf, der die UI-Sperre umgeht. R-R ist laut dem Battle-Mode-Test oben verlässlich
   * Liga 2 (Budget-Rang 32 global, `leagueByTeamId["R-R"] === "liga2"`).
   */
  it("filtert ein Liga-2-Team aus chrisTeamIds im Battle Mode heraus und blockiert ohne verbleibendes Team", () => {
    const { gameState, preview } = buildNewGameStateFromBaseline({
      presetId: "custom",
      gameMode: "battle",
      chrisTeamIds: ["R-R"],
      now: "2026-06-13T10:00:00.000Z",
    });

    expect(gameState.seasonState.leagueByTeamId?.["R-R"]).toBe("liga2");
    expect(preview.chrisTeamIds).toEqual([]);
    expect(preview.warnings).toContain("battle_mode_liga2_team_not_selectable:R-R");
    expect(preview.blockers).toContain("new_game_requires_at_least_one_chris_team");
    // R-R landet stattdessen bei der KI, nicht als humanControlled-Team.
    expect(preview.aiTeamIds).toContain("R-R");
    expect(gameState.teams.find((team) => team.teamId === "R-R")?.humanControlled).toBe(false);
  }, 120_000);

  it("behält ein Liga-1-Team und verwirft nur das Liga-2-Team, wenn beide als chrisTeamIds übergeben werden", () => {
    const { preview } = buildNewGameStateFromBaseline({
      presetId: "custom",
      gameMode: "battle",
      chrisTeamIds: ["M-M", "R-R"],
      now: "2026-06-13T10:00:00.000Z",
    });

    expect(preview.chrisTeamIds).toEqual(["M-M"]);
    expect(preview.blockers).toEqual([]);
    expect(preview.warnings).toContain("battle_mode_liga2_team_not_selectable:R-R");
  }, 120_000);

  it("lässt Liga-2-Teams im Manager Mode unangetastet wählbar (keine Liga-2-Sperre ohne Battle Mode)", () => {
    const { preview } = buildNewGameStateFromBaseline({
      presetId: "custom",
      gameMode: "manager",
      chrisTeamIds: ["R-R"],
      now: "2026-06-13T10:00:00.000Z",
    });

    expect(preview.chrisTeamIds).toEqual(["R-R"]);
    expect(preview.blockers).toEqual([]);
    expect(preview.warnings).not.toContain("battle_mode_liga2_team_not_selectable:R-R");
  }, 120_000);

  /**
   * ERWEITERUNG 31.10. (Chris: "alle teams in der 2. liga muss man bei erstellung auch wählen
   * können"): der Wizard darf die automatische Budget-Zuteilung jetzt mit einer eigenen
   * `leagueByTeamId` ueberschreiben. R-R ist automatisch Liga 2 (s. Test oben) -- wird es in der
   * uebergebenen Zuordnung stattdessen als Liga-1-Team eingetragen (bei zugleich einem anderen
   * Team, das dafuer nach Liga 2 wandert, damit 16/16 erhalten bleibt), ist es als chrisTeamIds
   * waehlbar: keine `battle_mode_liga2_team_not_selectable`-Warnung mehr, kein Blocker.
   */
  it("laesst ein eigentlich Liga-2-Team ueber eine gueltige eigene leagueByTeamId doch als Chris-Team zu", () => {
    const { gameState: automatic } = buildNewGameStateFromBaseline({
      presetId: "custom",
      gameMode: "battle",
      now: "2026-06-13T10:00:00.000Z",
    });
    const customAssignment: Record<string, LeagueTier> = {
      ...automatic.seasonState.leagueByTeamId,
      "R-R": "liga1",
      "M-M": "liga2",
    };

    const { preview, gameState } = buildNewGameStateFromBaseline({
      presetId: "custom",
      gameMode: "battle",
      chrisTeamIds: ["R-R"],
      leagueByTeamId: customAssignment,
      now: "2026-06-13T10:00:00.000Z",
    });

    expect(gameState.seasonState.leagueByTeamId?.["R-R"]).toBe("liga1");
    expect(gameState.seasonState.leagueByTeamId?.["M-M"]).toBe("liga2");
    expect(preview.chrisTeamIds).toEqual(["R-R"]);
    expect(preview.warnings).not.toContain("battle_mode_liga2_team_not_selectable:R-R");
    expect(preview.blockers).toEqual([]);
  }, 120_000);

  it("ignoriert eine ungueltige leagueByTeamId (falsche Groesse) und faellt zurueck auf die automatische Zuteilung", () => {
    const { preview, gameState } = buildNewGameStateFromBaseline({
      presetId: "custom",
      gameMode: "battle",
      chrisTeamIds: ["R-R"],
      leagueByTeamId: { "R-R": "liga1" },
      now: "2026-06-13T10:00:00.000Z",
    });

    expect(gameState.seasonState.leagueByTeamId?.["R-R"]).toBe("liga2");
    expect(preview.warnings).toContain("battle_mode_invalid_league_assignment_ignored");
    expect(preview.warnings).toContain("battle_mode_liga2_team_not_selectable:R-R");
  }, 120_000);

  it("ignoriert eine leagueByTeamId im Manager Mode vollstaendig (kein Liga-Split ausserhalb Battle Mode)", () => {
    const customAssignment = buildInitialLeagueAssignment(
      buildNewGameStateFromBaseline({ presetId: "custom", gameMode: "battle" }).gameState.teams,
    );
    const { preview, gameState } = buildNewGameStateFromBaseline({
      presetId: "custom",
      gameMode: "manager",
      chrisTeamIds: ["R-R"],
      leagueByTeamId: customAssignment,
      now: "2026-06-13T10:00:00.000Z",
    });

    expect(Object.keys(gameState.seasonState.leagueByTeamId ?? {})).toHaveLength(0);
    expect(preview.chrisTeamIds).toEqual(["R-R"]);
    expect(preview.warnings).not.toContain("battle_mode_invalid_league_assignment_ignored");
  }, 120_000);

  /**
   * TASK #155 — OPUS-REVIEW ZU PR #1272, FRANKY-EDGE-CASE: fallen BEIDE Preset-Teams von Franky
   * in Liga 2, wird `frankyTeamIds` komplett leer, aber nur der Chris-Null-Teams-Fall hat einen
   * Blocker — Franky stünde (im seltenen Fall, dass sein Preset komplett Liga-2-Teams trifft) ohne
   * eigenes Team da, nur durch die Warnung sichtbar. Opus: kein Blocker nötig (Presets
   * normalisieren sich im Wizard ohnehin auf "custom"), aber die Warnung muss tatsächlich
   * ankommen — und zwar lesbar, nicht als Rohcode (dafür `formatGameFlowBlocker`,
   * s. `tests/game-flow-blocker-incomplete-result-label.test.ts`).
   *
   * Die betroffenen Liga-2-Team-IDs werden hier bewusst aus der echten Zuordnung gelesen statt
   * hart codiert — welche Team-IDs Liga 2 sind, hängt an den Startbudgets, nicht an festen Codes.
   */
  it("Franky-Edge-Case: fallen beide Franky-Teams in Liga 2, bleibt es ein Hinweis (kein Blocker), aber sichtbar und lesbar", () => {
    const probe = buildNewGameStateFromBaseline({
      presetId: "custom",
      gameMode: "battle",
      chrisTeamIds: ["M-M"],
      now: "2026-06-13T10:00:00.000Z",
    });
    const liga2TeamIds = Object.entries(probe.gameState.seasonState.leagueByTeamId ?? {})
      .filter(([, tier]) => tier === "liga2")
      .map(([teamId]) => teamId);
    expect(liga2TeamIds.length).toBeGreaterThanOrEqual(2);
    const frankyLiga2Pick = liga2TeamIds.slice(0, 2);

    const { preview } = buildNewGameStateFromBaseline({
      presetId: "custom",
      gameMode: "battle",
      chrisTeamIds: ["M-M"],
      frankyTeamIds: frankyLiga2Pick,
      now: "2026-06-13T10:00:00.000Z",
    });

    expect(preview.frankyTeamIds).toEqual([]);
    // Kein Blocker -- Chris hat sein Team, das reicht laut heutiger Regel zum Starten.
    expect(preview.blockers).toEqual([]);
    for (const teamId of frankyLiga2Pick) {
      expect(preview.warnings).toContain(`battle_mode_liga2_team_not_selectable:${teamId}`);
      // Und lesbar, nicht nur als Code -- das ist die eigentliche Opus-Anforderung: die Warnung
      // darf nicht lautlos im internen Array verschwinden.
      const label = formatGameFlowBlocker(`battle_mode_liga2_team_not_selectable:${teamId}`);
      expect(label).toContain(teamId);
      expect(label).toMatch(/liga 2/i);
    }
  }, 120_000);
});
