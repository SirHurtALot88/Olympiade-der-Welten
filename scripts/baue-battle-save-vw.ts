/**
 * Baut einen NEUEN Battle-Mode-Spielstand (Saison 1, Spieltag 1) mit V-W als Chris-Team und den
 * Kadern aus Chris' VW-Spielstand (`new-game-1787123325719-swnjlk`), in den die ~280 Figuren-Sprites
 * gebaut wurden. Alles ueber Produktionspfade:
 *   applyNewGameSetup (gameMode battle)  ->  executeLocalTransfermarktBuy je Spieler in sein altes Team
 *   ->  Figuren ohne alten Kader in ihr Mapping-Team  ->  fuehreLigaSetupDraftAus (KI fuellt den Rest,
 *   V-W ausgenommen, wie /api/new-game)  ->  applyGameModeOwnership  ->  activateSave(user_local).
 *
 * Aufruf: OLY_APP_SQLITE_PATH=/tmp/abbild-neu.sqlite npx tsx --tsconfig tsconfig.json scripts/baue-battle-save-vw.ts
 */
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import fs from "node:fs";
import Database from "better-sqlite3";

import { applyNewGameSetup, previewNewGameSetup } from "@/lib/game/new-game-setup-service";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { applyGameModeOwnership, DEFAULT_ACTIVE_OWNER_ID } from "@/lib/foundation/team-control-settings";
import { fuehreLigaSetupDraftAus } from "@/lib/game/league-setup-draft-service";
import { executeLocalTransfermarktBuy } from "@/lib/market/transfermarkt-local-service";
import { getTeamPlayerMax } from "@/lib/foundation/roster-limits";
import { buildInitialLeagueAssignment } from "@/lib/season/league-split";

async function main() {
  const QUELL_SAVE = "new-game-1787123325719-swnjlk";
  const CHRIS_TEAM = "V-W";
  const dbPfad = process.env.OLY_APP_SQLITE_PATH!;
  if (!dbPfad || !fs.existsSync(dbPfad)) throw new Error("OLY_APP_SQLITE_PATH fehlt");

  const slugVon = (id: string) => id.toLowerCase().match(/^player-\d+-(.+)$/)?.[1] ?? id.toLowerCase();

  // 1) Alte Kader roh lesen (kein voller Materialisierungsweg noetig).
  const roh = new Database(dbPfad, { readonly: true });
  const alteKader = new Map<string, string[]>();
  for (const r of roh.prepare("select payload_json from rosters where save_id=?").all(QUELL_SAVE) as { payload_json: string }[]) {
    const z = JSON.parse(r.payload_json) as { teamId: string; playerId: string };
    if (!alteKader.has(z.teamId)) alteKader.set(z.teamId, []);
    if (!alteKader.get(z.teamId)!.includes(z.playerId)) alteKader.get(z.teamId)!.push(z.playerId);
  }
  roh.close();
  console.log(`Quell-Save ${QUELL_SAVE}: ${[...alteKader.values()].flat().length} Kaderplaetze in ${alteKader.size} Teams`);

  const persistence = createPersistenceService();
  const input = {
    presetId: "solo_1" as const,
    gameMode: "battle" as const,
    chrisTeamIds: [CHRIS_TEAM],
    frankyTeamIds: [] as string[],
    saveName: "Battle Mode VW – alle Figuren (02.11.)",
  };
  // V-W liegt nach Budget in Liga 2, und Liga-2-Teams sind beim Anlegen nicht waehlbar. Der Wizard
  // erlaubt eine eigene Liga-Zuordnung (Chris, 31.10.): V-W tauscht mit dem budgetschwaechsten
  // Liga-1-Team -- sonst bleibt die automatische Budget-Zuteilung unveraendert.
  const vorab = previewNewGameSetup({ ...input, chrisTeamIds: [] });
  const auto = buildInitialLeagueAssignment(vorab.teams.map((t) => ({ teamId: t.teamId, budget: t.budget })) as never);
  let tauschPartner: string | null = null;
  if (auto[CHRIS_TEAM] === "liga2") {
    tauschPartner = vorab.teams
      .filter((t) => auto[t.teamId] === "liga1")
      .sort((a, b) => a.budget - b.budget || b.teamId.localeCompare(a.teamId))[0]!.teamId;
    auto[CHRIS_TEAM] = "liga1";
    auto[tauschPartner] = "liga2";
  }
  console.log("Liga-Tausch:", CHRIS_TEAM, "<->", tauschPartner);
  const inputMitLiga = { ...input, leagueByTeamId: auto };
  const preview = previewNewGameSetup(inputMitLiga);
  console.log("Preview warnings:", preview.warnings, "blockers:", preview.blockers, "chris:", preview.chrisTeamIds);
  if (!preview.chrisTeamIds.includes(CHRIS_TEAM)) throw new Error("V-W ist nicht als Chris-Team waehlbar (Liga 2?)");
  const angelegt = applyNewGameSetup({ ...inputMitLiga, confirmToken: preview.confirmToken }, persistence, { ownerId: DEFAULT_ACTIVE_OWNER_ID });
  const saveId = angelegt.save.saveId;
  let save = persistence.getSaveById(saveId)!;
  const seasonId = save.gameState.season.id;
  console.log("Neuer Save:", saveId, seasonId, save.gameState.matchdayState.matchdayId, "gameMode", save.gameState.scenarioMeta?.gameMode);

  // 2) Alte Kader ueber den echten Kaufpfad einsetzen.
  const fehlgeschlagen: Array<{ teamId: string; playerId: string; grund: string }> = [];
  let gekauft = 0;
  const bekannteIds = new Set(save.gameState.players.map((p) => p.id));
  for (const [teamId, ids] of alteKader) {
    for (const playerId of ids) {
      if (!bekannteIds.has(playerId)) {
        fehlgeschlagen.push({ teamId, playerId, grund: "spieler_nicht_im_neuen_pool" });
        continue;
      }
      const res = executeLocalTransfermarktBuy({ saveId, seasonId, teamId, playerId, transferSource: "battle_vw_setup_uebernahme" });
      if (res.activePlayerCreated) gekauft += 1;
      else fehlgeschlagen.push({ teamId, playerId, grund: [...(res.blockingReasons ?? []), ...(res.warnings ?? [])].join("|") || "unbekannt" });
    }
  }
  console.log(`Gekauft: ${gekauft}, fehlgeschlagen: ${fehlgeschlagen.length}`);

  // Fehlschlaege (meist Budget) mit Kaufpreis 0 nachholen -- dieselbe Buchung, nur ohne Ablose.
  const nochOffen: typeof fehlgeschlagen = [];
  for (const f of fehlgeschlagen) {
    if (f.grund === "spieler_nicht_im_neuen_pool") { nochOffen.push(f); continue; }
    const res = executeLocalTransfermarktBuy({
      saveId, seasonId, teamId: f.teamId, playerId: f.playerId,
      transferSource: "battle_vw_setup_uebernahme",
      purchasePriceOverride: 0.01,
      purchasePriceOverrideReason: "battle_vw_setup_kader_uebernahme",
    });
    if (res.activePlayerCreated) gekauft += 1;
    else nochOffen.push({ ...f, grund: f.grund + " || override: " + [...(res.blockingReasons ?? [])].join("|") });
  }
  console.log(`Nach Override: gekauft ${gekauft}, offen ${nochOffen.length}`);
  for (const f of nochOffen.slice(0, 30)) console.log("  offen:", f);

  // 3) Sprite-Figuren ohne Kaderplatz: in ihr Mapping-Team, sonst Team mit Platz.
  const sprites = Object.keys(JSON.parse(fs.readFileSync("data/generated/figuren-sprites.json", "utf8")));
  const mapping = (JSON.parse(fs.readFileSync("data/source/player-team-mapping.json", "utf8")) as { rows: Array<{ playerName: string; teamId: string }> }).rows;
  const mappingNachName = new Map(mapping.map((r) => [r.playerName.trim().toLowerCase(), r.teamId]));
  save = persistence.getSaveById(saveId)!;
  const slugZuSpieler = new Map(save.gameState.players.map((p) => [slugVon(p.id), p]));
  const kaderGroesse = () => {
    const m = new Map<string, number>();
    for (const z of persistence.getSaveById(saveId)!.gameState.rosters) m.set(z.teamId, (m.get(z.teamId) ?? 0) + 1);
    return m;
  };
  const rostered = () => new Set(persistence.getSaveById(saveId)!.gameState.rosters.map((z) => slugVon(z.playerId)));
  const fehlendeSprites = sprites.filter((s) => !rostered().has(s));
  console.log(`Sprite-Figuren ohne Kader nach Uebernahme: ${fehlendeSprites.length}`);
  const teamsNachId = new Map(save.gameState.teams.map((t) => [t.teamId, t]));
  const nachgeholt: string[] = [];
  const nichtNachgeholt: string[] = [];
  for (const slug of fehlendeSprites) {
    const spieler = slugZuSpieler.get(slug);
    if (!spieler) { nichtNachgeholt.push(`${slug}:nicht_im_pool`); continue; }
    const groessen = kaderGroesse();
    const wunsch = mappingNachName.get(spieler.name.trim().toLowerCase());
    const hatPlatz = (tid: string) => (groessen.get(tid) ?? 0) < getTeamPlayerMax(teamsNachId.get(tid));
    const kandidaten = [
      ...(wunsch && wunsch !== CHRIS_TEAM && hatPlatz(wunsch) ? [wunsch] : []),
      ...[...teamsNachId.keys()].filter((t) => t !== CHRIS_TEAM && hatPlatz(t)).sort((a, b) => (groessen.get(a) ?? 0) - (groessen.get(b) ?? 0)),
    ];
    let ok = false;
    for (const teamId of kandidaten) {
      const res = executeLocalTransfermarktBuy({
        saveId, seasonId, teamId, playerId: spieler.id,
        transferSource: "battle_vw_setup_figur",
        purchasePriceOverride: 0.01,
        purchasePriceOverrideReason: "battle_vw_setup_figur_ohne_kader",
      });
      if (res.activePlayerCreated) { nachgeholt.push(`${spieler.name}->${teamId}${teamId === wunsch ? "(Mapping)" : ""}`); ok = true; break; }
    }
    if (!ok) nichtNachgeholt.push(`${slug}:kein_team_nimmt_ihn`);
  }
  console.log(`Figuren nachgeholt: ${nachgeholt.length}`, nachgeholt.join(", "));
  if (nichtNachgeholt.length) console.log("NICHT nachgeholt:", nichtNachgeholt);

  // 4) KI fuellt die Restkader (Produktionsweg, menschliches Team ausgenommen wie /api/new-game).
  const vorDraft = kaderGroesse();
  const t0 = Date.now();
  const draft = await fuehreLigaSetupDraftAus({
    persistence,
    saveId,
    seasonId,
    callerWritableTeamIds: persistence.getSaveById(saveId)!.gameState.teams.map((t) => t.teamId).filter((t) => t !== CHRIS_TEAM),
    excludeTeamIds: [CHRIS_TEAM],
    logPrefix: "[battle-vw-setup]",
  });
  console.log("Draft:", draft, `${((Date.now() - t0) / 1000).toFixed(0)}s`);

  // 5) Besitz festschreiben und aktivieren.
  const nachDraft = persistence.getSaveById(saveId)!;
  persistence.saveSingleplayerState(
    saveId,
    applyGameModeOwnership(nachDraft.gameState, { saveMode: "solo_1", chrisTeamIds: [CHRIS_TEAM], frankyTeamIds: [] }),
  );
  persistence.activateSave(saveId, DEFAULT_ACTIVE_OWNER_ID);

  // 6) Pruefen.
  const fertig = persistence.getSaveById(saveId)!.gameState;
  const groessen = new Map<string, number>();
  for (const z of fertig.rosters) groessen.set(z.teamId, (groessen.get(z.teamId) ?? 0) + 1);
  const nachSlug = new Set(fertig.rosters.map((z) => slugVon(z.playerId)));
  const spriteAbdeckung = sprites.filter((s) => nachSlug.has(s)).length;
  const doppelt = fertig.rosters.length - new Set(fertig.rosters.map((z) => z.playerId)).size;
  console.log("\n=== PRUEFUNG ===");
  console.log("saveId", saveId, "gameMode", fertig.scenarioMeta?.gameMode, "season", fertig.season.id, "matchday", fertig.matchdayState.matchdayId);
  console.log("human:", fertig.teams.filter((t) => t.humanControlled).map((t) => t.teamId), "leagueSetupStatus", fertig.seasonState.leagueSetupStatus);
  console.log("Teams:", fertig.teams.length, "mit Kader:", groessen.size, "min", Math.min(...groessen.values()), "max", Math.max(...groessen.values()), "doppelte Spieler", doppelt);
  for (const t of fertig.teams) {
    const alt = alteKader.get(t.teamId) ?? [];
    const jetzt = new Set(fertig.rosters.filter((z) => z.teamId === t.teamId).map((z) => z.playerId));
    const uebernommen = alt.filter((id) => jetzt.has(id)).length;
    console.log(`  ${t.teamId.padEnd(4)} ${String(groessen.get(t.teamId) ?? 0).padStart(2)} Spieler (vorher ${String(vorDraft.get(t.teamId) ?? 0).padStart(2)} vor KI-Draft), aus altem Kader ${uebernommen}/${alt.length}, Liga ${fertig.seasonState.leagueByTeamId?.[t.teamId] ?? "-"}, cash ${Math.round(t.cash)}`);
  }
  console.log(`Sprite-Figuren auf einem Kader: ${spriteAbdeckung}/${sprites.length}`);
  const vw = fertig.rosters.filter((z) => z.teamId === CHRIS_TEAM).map((z) => fertig.players.find((p) => p.id === z.playerId)?.name);
  console.log("V-W Kader:", vw.join(", "));
  fs.writeFileSync(process.env.ERGEBNIS_JSON ?? "/tmp/battle-vw-ergebnis.json", JSON.stringify({ saveId, spriteAbdeckung, sprites: sprites.length, nochOffen, nachgeholt, nichtNachgeholt }, null, 2));

}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
