import fs from "node:fs/promises";

import { describe, expect, it } from "vitest";

describe("foundation transfermarkt ui contract", () => {
  it("keeps the active save and season context visible globally", async () => {
    const [fileText, cssText] = await Promise.all([
      fs.readFile(
        "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/foundation/FoundationPageClient.tsx",
        "utf8",
      ),
      fs.readFile("/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/globals.css", "utf8"),
    ]);

    expect(fileText).toContain('data-testid="foundation-context-banner"');
    expect(fileText).toContain("Aktiver Kontext");
    expect(fileText).toContain("buildContextStatusChips");
    expect(fileText).toContain("buildViewContextWarning");
    expect(fileText).toContain("Dieser Save hat keine abgeschlossenen Season-Daten.");
    expect(fileText).toContain("Season-End Workflow blockiert: Season ist nicht abgeschlossen.");
    expect(fileText).toContain("Redraft-Testsave: enthält Kader-/Pickdaten, aber keine vollständige Season-Historie.");
    expect(fileText).toContain("clearSaveScopedFeeds");
    expect(fileText).toContain("source: local season results");
    expect(fileText).toContain("source: season-end forecast");
    expect(fileText).toContain("source: active local save");
    expect(fileText).toContain("source: local roster/progression");
    expect(cssText).toContain(".foundation-context-banner");
    expect(cssText).toContain(".foundation-context-warning");
  });

  it("keeps market value descending as default sort", async () => {
    const fileText = await fs.readFile(
      "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/foundation/FoundationPageClient.tsx",
      "utf8",
    );

    expect(fileText).toContain('transferMarket: { key: "marketValue", direction: "asc" }');
    expect(fileText).toContain("Sortierung: Marktwert ↓");
  });

  it("keeps mercenary players visible even when normal fit filtering is active", async () => {
    const fileText = await fs.readFile(
      "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/foundation/FoundationPageClient.tsx",
      "utf8",
    );

    expect(fileText).toContain('"Team waehlen"');
    expect(fileText).toContain("formatFitDisplay");
    expect(fileText).toContain("entry.item.mercenary || (entry.item.fit ?? Number.NEGATIVE_INFINITY) > 0");
  });

  it("shows scouting potential as range and confidence instead of exact hidden values", async () => {
    const fileText = await fs.readFile(
      "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/foundation/FoundationPageClient.tsx",
      "utf8",
    );
    const drawerText = await fs.readFile(
      "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/foundation/PlayerDetailDrawer.tsx",
      "utf8",
    );

    expect(fileText).toContain("renderTransfermarktPotential");
    expect(fileText).toContain("formatPotentialRange");
    expect(fileText).toContain("scoutingConfidence");
    expect(drawerText).toContain("Potential / Scouting");
    expect(drawerText).toContain("Confidence");
    expect(drawerText).toContain("MW Preview");
  });

  it("keeps manager quick switch scoped to the active owner teams", async () => {
    const fileText = await fs.readFile(
      "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/foundation/FoundationPageClient.tsx",
      "utf8",
    );
    const scenarioScript = await fs.readFile(
      "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/scripts/create-manager-scenario-testsave.ts",
      "utf8",
    );

    expect(fileText).toContain("ownerQuickSwitchTeams");
    expect(fileText).toContain('filterTeamsByControlScope(gameState.teams, resolvedTeamControlSettings, "my_teams", effectiveActiveOwnerId)');
    expect(fileText).toContain('data-testid="human-team-quick-switch"');
    expect(scenarioScript).toContain('const CHRIS_TEAMS = ["M-M", "V-W"]');
    expect(scenarioScript).toContain('const RAMONA_TEAMS = ["P-S", "D-P"]');
    expect(scenarioScript).toContain('const FRANKY_TEAMS = ["M-S", "P-C", "C-S", "G-G"]');
    expect(scenarioScript).toContain('scenarioType: "manager_multiplayer_test"');
    expect(scenarioScript).toContain("manager_scenario_franky_remote_human_team");
    expect(scenarioScript).toContain("aiTransferPreviewEnabled: controlMode === \"ai\"");
  });

  it("highlights user and Franky controlled teams in team comparison rows", async () => {
    const [fileText, cssText] = await Promise.all([
      fs.readFile(
        "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/foundation/FoundationPageClient.tsx",
        "utf8",
      ),
      fs.readFile("/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/globals.css", "utf8"),
    ]);

    expect(fileText).toContain("getOwnerTeamHighlightClass");
    expect(fileText).toContain("is-owner-user-team");
    expect(fileText).toContain("is-owner-franky-team");
    expect(fileText).toContain("getOwnerTeamHighlightClass(resolvedTeamControlSettings[row.teamId])");
    expect(fileText).toContain("getOwnerTeamHighlightClass(resolvedTeamControlSettings[row.team.teamId])");
    expect(fileText).toContain('row.team.teamId === activeManagerTeamId && "is-active-team-row"');
    expect(cssText).toContain(".foundation-home-mini-row.is-owner-user-team");
    expect(cssText).toContain(".foundation-home-mini-row.is-owner-franky-team");
    expect(cssText).toContain(".foundation-shell .team-table tbody tr.is-active-team-row > td");
    expect(cssText).toContain(".foundation-shell .team-table tbody tr.is-active-team-row.is-owner-user-team > td");
    expect(cssText).toContain(".foundation-shell .team-table tbody tr.is-active-team-row.is-owner-franky-team > td");
    expect(cssText).toContain(".foundation-shell .team-table tbody tr.is-owner-user-team");
    expect(cssText).toContain(".foundation-shell .team-table tbody tr.is-owner-franky-team");
    expect(cssText).toContain(".matchday-result-team-card.is-owner-franky-team");
  });

  it("keeps the ranks matrix visually grouped by summary axes and discipline columns", async () => {
    const [fileText, cssText] = await Promise.all([
      fs.readFile(
        "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/foundation/FoundationPageClient.tsx",
        "utf8",
      ),
      fs.readFile("/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/globals.css", "utf8"),
    ]);

    expect(fileText).toContain("getRanksMetricToneClass");
    expect(fileText).toContain("front green, chase yellow, edge red");
    expect(fileText).toContain('return "rank-mid"');
    expect(fileText).toContain('return "rank-weak"');
    expect(fileText).toContain("ranks-summary-block-start");
    expect(fileText).toContain("ranks-summary-block-end");
    expect(fileText).toContain("ranks-discipline-cell");
    expect(fileText).toContain("ranks-discipline-cell-${discipline.category}");
    expect(fileText).toContain("ranks-discipline-group-start");
    expect(fileText).toContain("previousDiscipline?.category !== discipline.category");
    expect(cssText).toContain(".ranks-table .ranks-head-metric-pow");
    expect(cssText).toContain(".ranks-table .ranks-head-metric-spe");
    expect(cssText).toContain(".ranks-table .ranks-head-metric-men");
    expect(cssText).toContain(".ranks-table .ranks-head-metric-soc");
    expect(cssText).toContain(".ranks-table .ranks-discipline-group-start");
    expect(cssText).toContain("border-left-color: rgba(232, 238, 248, 0.32) !important");
    expect(cssText).toContain(".ranks-table tbody td.ranks-metric-cell-pow.rank-muted");
    expect(cssText).toContain(".ranks-table tbody td.ranks-discipline-cell-power.rank-muted");
    expect(cssText).toContain(".ranks-table tbody td.ranks-discipline-cell-mental.rank-muted");
  });


  it("documents that local team fit can go negative for non-matching profiles", async () => {
    const fileText = await fs.readFile(
      "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/lib/market/transfermarkt-fit.ts",
      "utf8",
    );

    expect(fileText).toContain("scorePresenceToken");
    expect(fileText).toContain("scorePresenceArray");
    expect(fileText).toContain("scorePresenceToken(raceKey, tokenCounts.races, -2)");
    expect(fileText).toContain("scorePresenceToken(alignmentKey, tokenCounts.alignments, -1)");
    expect(fileText).toContain("scorePresenceArray(subclassKeys, tokenCounts.subclasses, -1)");
    expect(fileText).toContain("scorePresenceArray(traitKeys, tokenCounts.traits, -1)");
  });

  it("uses the shared column contract and advanced toggle on the main transfermarkt", async () => {
    const [fileText, contractText, serviceText, drawerDataText] = await Promise.all([
      fs.readFile(
        "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/foundation/FoundationPageClient.tsx",
        "utf8",
      ),
      fs.readFile(
        "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/lib/market/transfermarkt-column-contract.ts",
        "utf8",
      ),
      fs.readFile(
        "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/lib/ai/ai-transfermarkt-preview-service.ts",
        "utf8",
      ),
      fs.readFile(
        "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/lib/foundation/player-detail-drawer.ts",
        "utf8",
      ),
    ]);

    expect(fileText).toContain("getTransfermarktBaseColumns");
    expect(fileText).toContain("getTransfermarktAdvancedColumns");
    expect(fileText).toContain("Attribute einblenden");
    expect(fileText).toContain("Neu laden");
    expect(fileText).toContain("Kartenfarbe");
    expect(fileText).toContain("transfer-context-banner");
    expect(fileText).toContain("Kauf erfolgreich");
    expect(fileText).toContain("Angebot blockiert");
    expect(fileText).toContain("/api/transfermarkt/ai-preview");
    expect(fileText).toContain("/api/transfermarkt/ai-sell-preview");
    expect(fileText).toContain("/api/ai/market-plan-preview");
    expect(fileText).toContain("/api/ai/needs-picks-compare");
    expect(fileText).toContain("/api/transfermarkt/recap");
    expect(fileText).toContain("AI Kaufvorschlaege");
    expect(fileText).toContain("AI Marktplan");
    expect(fileText).toContain("AI Needs/Picks Compare");
    expect(fileText).toContain("AI Verkaufsvorschlaege");
    expect(fileText).toContain("Transfer Recap");
    expect(fileText).toContain("transferHistorySeasonBreakdown");
    expect(fileText).toContain("transferHistoryRequestedSeasonLabel");
    expect(fileText).toContain("transferHistoryResolvedSeasonLabel");
    expect(fileText).toContain("Transfers im geladenen Feed");
    expect(fileText).toContain("Recap neu laden");
    expect(fileText).toContain("Top Transfers In");
    expect(fileText).toContain("Top Transfers Out");
    expect(fileText).toContain("Biggest Spend");
    expect(fileText).toContain("Biggest Profit");
    expect(fileText).toContain("Best Value Deals");
    expect(fileText).toContain("Risky Moves");
    expect(fileText).toContain("Team Summary");
    expect(fileText).toContain("AI Kaufvorschlaege anzeigen");
    expect(fileText).toContain("AI-Marktplan laden");
    expect(fileText).toContain("AI Needs/Picks Compare laden");
    expect(fileText).toContain("AI-Verkaufsvorschau laden");
    expect(fileText).toContain("Nur AI-Teams");
    expect(fileText).toContain("Alle Teams");
    expect(fileText).toContain("AI-Teams");
    expect(fileText).toContain("Manual uebersprungen");
    expect(fileText).toContain("Passive uebersprungen");
    expect(fileText).toContain("Disabled");
    expect(fileText).toContain("Kaufbereit");
    expect(fileText).toContain("Eher sparen");
    expect(fileText).toContain("Verkauf moeglich");
    expect(fileText).toContain("Sell then buy");
    expect(fileText).toContain("Gesamtplan");
    expect(fileText).toContain("Hinweise");
    expect(fileText).toContain("Min / Opt");
    expect(fileText).toContain("Budget:");
    expect(fileText).toContain("Warnings:");
    expect(fileText).toContain("Read-only Vorschlaege auf Basis von Cash, Kaderdruck und Teamprofil.");
    expect(fileText).toContain("Read-only Kombination aus Kauf- und Verkaufsvorschau fuer AI-Teams. Kein Kauf, kein Verkauf, nur Plan.");
    expect(fileText).toContain("Es gibt hier bewusst keinen Apply-Button.");
    expect(fileText).toContain("Read-only Vorschlaege auf Basis von Gehalt, Kaderdruck, lokalen Leistungen und Teamprofil.");
    expect(fileText).toContain("Empfohlene Kauefe");
    expect(fileText).toContain("Verkaufskandidaten");
    expect(fileText).toContain("Keep Core");
    expect(fileText).toContain("Bewusst uebersprungen");
    expect(fileText).toContain("Sell:");
    expect(fileText).toContain("Keep:");
    expect(serviceText).toContain("manuell gesteuertes Team – Vorschlag nur informativ");
    expect(fileText).toContain("marketBuyModalOpen");
    expect(fileText).toContain("marketSellModalOpen");
    expect(fileText).toContain("openMarketBuyModal");
    expect(fileText).toContain("openMarketSellModal");
    expect(fileText).toContain("toggleTransferWishlist");
    expect(fileText).toContain("transferWishlist");
    expect(fileText).toContain("Wishlist");
    expect(fileText).toContain("Remove");
    expect(fileText).toContain("verfuegbar");
    expect(fileText).toContain("Remove");
    expect(fileText).toContain("openPlayerDrawerBuyPreview");
    expect(fileText).toContain('aria-label="Kaufdialog"');
    expect(fileText).toContain('aria-label="Verkaufsdialog"');
    expect(fileText).toContain("Vertragslaenge");
    expect(fileText).toContain("Vertragsform");
    expect(fileText).toContain("Gehaltsangebot");
    expect(fileText).toContain("Gehaltsregler");
    expect(fileText).toContain("Angebot pruefen");
    expect(fileText).toContain("Zusage-Score");
    expect(fileText).toContain("Buyout Preview");
    expect(fileText).toContain("Buyout zahlt das komplette Restgehalt.");
    expect(fileText).toContain("Score-Aufschluesselung");
    expect(fileText).toContain("Verkaufsvorschau blockiert");
    expect(fileText).toContain("Verkauf bestaetigen");
    expect(fileText).toContain("Kader");
    expect(fileText).toContain("Verträge");
    expect(fileText).toContain("Altverträge");
    expect(fileText).toContain("Summe mit Preview");
    expect(fileText).toContain("Bestehende aktive Verträge werden in V1 als balanced gelesen.");
    expect(fileText).toContain("PlayerDetailDrawer");
    expect(fileText).toContain("openPlayerDrawerById");
    expect(fileText).toContain('onDoubleClick={() => openPlayerDrawerById(row.item.playerId)}');
    expect(fileText).toContain('if (column.id === "ovr")');
    expect(fileText).toContain('if (column.id === "mvs")');
    expect(fileText).toContain('onDoubleClick={() => openPlayerDrawerById(row.player.id, row.roster?.id)}');
    expect(fileText).toContain('onDoubleClick={() => openPlayerDrawerById(player.id, entry.id)}');
    expect(fileText).toContain('onDoubleClick={() => openPlayerDrawerById(row.playerId)}');
    expect(fileText).toContain("transfer-status-pill");
    expect(fileText).toContain("transfer-callout is-blocked");
    expect(fileText).toContain("transfer-callout is-warning");
    expect(fileText).toContain("<span>Gehalt</span>");
    expect(fileText).toContain("Readiness");
    expect(fileText).toContain("entry.item.subclasses.includes(marketSubclassFilter)");
    expect(fileText).toContain("entry.item.traitsPositive.includes(marketPositiveTraitFilter)");
    expect(fileText).toContain("entry.item.traitsNegative.includes(marketNegativeTraitFilter)");
    expect(fileText).toContain("getConfirmedTierStyle");
    expect(contractText).toContain('label: "Diszi (3)"');
    expect(contractText).toContain('dataKey: "powTier"');
    expect(contractText).toContain('label: "Hea"');
    expect(contractText).toContain('label: "Tor"');
    expect(contractText).toContain("Marktwert gehalt ratio");
    expect(fileText).toContain("column-resizer");
    expect(fileText).toContain("resizable-header-cell");
    expect(fileText).toContain("startTableColumnResize");
    expect(fileText).toContain("resetTableColumnWidth");
    expect(fileText).not.toContain("AI-Marktplan DryRun");
    expect(fileText).not.toContain("AI-Marktplan lokal ausfuehren");
    expect(fileText).toContain("<h3>5. Alle Teams auf Zielkader bringen</h3>");
    expect(fileText).toContain("Alle Teams lokal auffuellen");
    expect(fileText).toContain("Roster-Fill DryRun");
    expect(fileText).toContain("Nur dieser lokale Save wird angefasst");
    expect(fileText).toContain("AI_MARKET_APPLY_CONFIRM_TOKEN");
    expect(fileText).toContain("LOCAL_TRANSFER_WINDOW_PHASE");
    expect(fileText).toContain("<h3>6. AI-Teams aufstellen</h3>");
    expect(fileText).toContain("DryRun pruefen");
    expect(fileText).toContain("AI-Lineups lokal speichern");
    expect(fileText).toContain("Warning Teams einschließen");
    expect(fileText).toContain("Bestehende Lineups ueberschreiben");
    expect(fileText).toContain("Manual und Passive Teams bleiben unveraendert.");
    expect(fileText).toContain("Es gibt hier keine Result-, Standings- oder Cash-Aktion.");
    expect(fileText).toContain("bereit fuer AI-Lineup-Save");
  });

  it("shows portrait columns on the player and roster tables", async () => {
    const fileText = await fs.readFile(
      "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/foundation/FoundationPageClient.tsx",
      "utf8",
    );

    expect(fileText).toContain('column.id === "image" ? (');
    expect(fileText).toContain("getPlayerPortraitModel");
    expect(fileText).toContain('className="transfermarkt-portrait"');
    expect(fileText).toContain("selected-team-roster-table");
    expect(fileText).toContain("players-table");
  });

  it("persists table customization with order, visibility, widths and presets", async () => {
    const fileText = await fs.readFile(
      "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/foundation/FoundationPageClient.tsx",
      "utf8",
    );

    expect(fileText).toContain("foundation-table-preferences-v1");
    expect(fileText).toContain("columnVisibility?: Record<string, boolean>");
    expect(fileText).toContain("columnOrder?: string[]");
    expect(fileText).toContain("pinnedLeft?: string[]");
    expect(fileText).toContain("pinnedRight?: string[]");
    expect(fileText).toContain('activePreset?: FoundationTablePresetId | null;');
    expect(fileText).toContain("applyStoredColumnOrder");
    expect(fileText).toContain("moveTableColumn");
    expect(fileText).toContain("applyTablePreset");
    expect(fileText).toContain("Retool Default");
    expect(fileText).toContain("Compact");
    expect(fileText).toContain("Finance");
    expect(fileText).toContain("Performance");
    expect(fileText).toContain('title="Spalten"');
    expect(fileText).toContain("nach links");
    expect(fileText).toContain("nach rechts");
    expect(fileText).toContain("schmaler");
    expect(fileText).toContain("breiter");
    expect(fileText).toContain("Breite zurücksetzen");
    expect(fileText).toContain("getTableActivePreset");
  });

  it("shows team logos in season standings and team views", async () => {
    const fileText = await fs.readFile(
      "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/foundation/FoundationPageClient.tsx",
      "utf8",
    );

    expect(fileText).toContain("getTeamLogoModel");
    expect(fileText).toContain('className="season-team-logo"');
    expect(fileText).toContain('className="season-team-logo season-team-logo-placeholder"');
    expect(fileText).toContain('className="team-focus-logo"');
    expect(fileText).toContain('className="team-focus-logo team-logo-placeholder"');
    expect(fileText).toContain("/api/media/team-logo/");
  });

  it("uses the extracted retool saisonstand contract instead of custom season columns", async () => {
    const [fileText, helperText, contractText, drawerDataText, seasonPerformanceText] = await Promise.all([
      fs.readFile(
        "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/foundation/FoundationPageClient.tsx",
        "utf8",
      ),
      fs.readFile(
        "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/lib/foundation/team-management-overview.ts",
        "utf8",
      ),
      fs.readFile(
        "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/lib/foundation/saisonstand-column-contract.ts",
        "utf8",
      ),
      fs.readFile(
        "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/lib/foundation/player-detail-drawer.ts",
        "utf8",
      ),
      fs.readFile(
        "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/lib/foundation/player-season-performance.ts",
        "utf8",
      ),
    ]);

    expect(fileText).toContain("saisonstandColumnContract");
    expect(fileText).toContain("getSaisonstandCompactContractColumns");
    expect(fileText).toContain("getSaisonstandExpertContractColumns");
    expect(fileText).toContain('teamTable: { key: "punkte", direction: "desc" }');
    expect(fileText).toContain("buildTeamSeasonOverviewRows");
    expect(fileText).toContain("seasonTableMode");
    expect(fileText).toContain('useState<SeasonTableMode>("expert")');
    expect(fileText).toContain("<TooltipHeading");
    expect(fileText).toContain("Saisonstand");
    expect(fileText).toContain("Kern");
    expect(fileText).toContain("Finanzen");
    expect(fileText).not.toContain("Erweitert / Retool");
    expect(fileText).not.toContain("Retool-Ansicht mit fester Reihenfolge und vollem Finanzblock.");
    expect(fileText).toContain('scrollSeasonTableToColumn("platz")');
    expect(fileText).toContain('scrollSeasonTableToColumn("vertragslange")');
    expect(fileText).toContain('ref={seasonTableShellRef}');
    expect(fileText).toContain('if (seasonTableMode === "expert") {');
    expect(fileText).toContain("const visibleSeasonTableColumns = useMemo(() => seasonModeColumns, [seasonModeColumns]);");
    expect(fileText).toContain("getSeasonTableColumnWidth");
    expect(fileText).toContain('if (tableId === "seasonTable" && seasonTableMode === "expert") {');
    expect(fileText).toContain('className={`column-resizer${seasonTableMode === "expert" ? " is-disabled" : ""}`}');
    expect(fileText).toContain("/api/season/standings-overview");
    expect(fileText).toContain("saisonstandLeftPinnedColumns");
    expect(fileText).toContain("saisonstandDisciplineColumns");
    expect(fileText).toContain("saisonstandFinanceColumns");
    expect(fileText).toContain("seasonTablePinnedOffsets");
    expect(fileText).toContain('position: "sticky"');
    expect(fileText).toContain('column.currentAppField?.startsWith("disciplineValues.")');
    expect(fileText).toContain('if (columnId === "tdm" || columnId === "vertragslange") {');
    expect(fileText).toContain("formatSeasonContractNumber");
    expect(fileText).toContain("getSeasonCashHeatClass");
    expect(fileText).toContain('column.normalizedKey === "cash"');
    expect(fileText).toContain('column.normalizedKey === "guv" || column.normalizedKey === "cash_total"');
    expect(fileText).toContain('case "platzierung":');
    expect(fileText).toContain("return row.sponsorRank;");
    expect(fileText).toContain('case "cash_fc":');
    expect(fileText).toContain('case "cash_total":');
    expect(fileText).toContain('case "form":');
    expect(fileText).toContain('case "rank_diff":');
    expect(fileText).toContain('case "sponsor_season":');
    expect(fileText).toContain("textAlign: saisonstandDisciplineColumns.includes(");
    expect(fileText).toContain('position: "sticky"');
    expect(fileText).not.toContain('label: "Unterhalt"');
    expect(fileText).not.toContain('label: "Kaderziel"');
    expect(fileText).not.toContain('return row.transferCount;');
    expect(fileText).toContain('label: "Anzahl Transfers"');
    expect(fileText).toContain('setActiveView("teams")');
    expect(fileText).toContain('className="table-team-cell table-team-cell-button"');
    expect(fileText).toContain('className="season-pp-summary"');
    expect(fileText).toContain("Summe aus POW, SPE, MEN und SOC je Team.");
    expect(fileText).toContain("Top 3 sind stark markiert, Rang 4-10 markiert, ab Rang 11 neutral.");
    expect(fileText).toContain("getPpSummaryRankClass");
    expect(fileText).toContain("<td>{row.rank}</td>");
    expect(fileText).toContain("<td>{row.team.name}</td>");
    expect(fileText).not.toContain('<td className={rankClass || undefined}>{row.rank}</td>');
    expect(fileText).toContain('Kosten {formatMoney(player.cost ?? player.marketValue)} · Gehalt {formatDisplayMoney(getRosterEntryDisplaySalary(entry, player))}');
    expect(fileText).toContain('Gehalt {formatDisplayMoney(getRosterEntryDisplaySalary(entry, player))} · LZ {entry.contractLength}');
    expect(fileText).toContain('formatLocalePoints(row.roster ? getRosterEntryDisplaySalary(row.roster, row.player) : getPlayerDisplaySalary(row.player), 2)');
    expect(fileText).toContain("function getRosterEntryDisplaySalary");
    expect(fileText).toContain("resolvePlayerEconomyContract");
    expect(fileText).toContain(".salary ?? entry.salary");
    expect(fileText).toContain('const [playerScope, setPlayerScope] = useState<PlayerTableScope>("active")');
    expect(fileText).toContain("Aktive Spieler");
    expect(fileText).toContain("Free Agents anzeigen");
    expect(fileText).toContain("Alle Spieler anzeigen");
    expect(fileText).toContain("formatPlayerRatingValue");
    expect(fileText).toContain('label: "Rasse"');
    expect(fileText).toContain('label: "Vertrag"');
    expect(fileText).toContain('label: "Einsaetze"');
    expect(fileText).not.toContain('label: "Season Punkte"');
    expect(fileText).toContain('label: "Beste Diszi"');
    expect(fileText).toContain('label: "Letzte Leistung"');
    expect(fileText).toContain('label: "Traits"');
    expect(fileText).toContain('row.team?.name ?? "Free Agent"');
    expect(fileText).toContain("Standardansicht des aktuellen Kaders.");
    expect(fileText).toContain("OVR und PPs nur pro Spieler, nicht als Teamwert");
    expect(fileText).toContain('label: "MVS"');
    expect(drawerDataText).toContain("seasonPerformance");
    expect(drawerDataText).toContain("transferContext");
    expect(drawerDataText).toContain("buildPlayerSeasonPerformance");
    expect(drawerDataText).toContain("buildTransferContext");
    expect(drawerDataText).toContain("buildPlayerRatingContractMap");
    expect(drawerDataText).toContain("pps: playerRating?.ppsSeason ?? null");
    expect(drawerDataText).toContain("ppsRating: playerRating?.ratingPps ?? null");
    expect(drawerDataText).toContain("const economy = resolvePlayerEconomyContract");
    expect(drawerDataText).toContain("salary: economy.salary");
    expect(seasonPerformanceText).toContain("buildPlayerSeasonPerformanceMap");
    expect(seasonPerformanceText).toContain("Aktuelle Matchday-Results");
    expect(seasonPerformanceText).toContain("Season Snapshot");
    expect(contractText).toContain("getSaisonstandCompactContractColumns");
    expect(contractText).toContain("getSaisonstandExpertContractColumns");
    expect(contractText).toContain("saisonstandExpertPresetOrder");
    expect(contractText).toContain("saisonstandExpertPresetWidths");
    expect(contractText).toContain("decimalPlaces?: number | null");
    expect(contractText).not.toContain('"mw"');
    expect(contractText).not.toContain('"pps"');
    expect(contractText).not.toContain('"ovr"');
    expect(contractText).not.toContain('"mvs"');
    expect(helperText).toContain("salaryTotal");
    expect(helperText).toContain("avgContractLength");
    expect(helperText).toContain("marketValueTotal");
    expect(helperText).toContain("disciplineValues");
    expect(helperText).toContain("deriveVisibleSeasonPoints");
    expect(helperText).toContain('columnKey !== "bonuspunkte"');
    expect(helperText).toContain("points: hasCurrentPps");
    expect(helperText).toContain("latestCompletedStanding?.disciplinePoints");
    expect(helperText).toContain("const transferNet = standing?.transfers ?? transferSummary?.transferNet ?? 0;");
    expect(helperText).toContain("teamCash: team.cash ?? standing?.cash ?? null");
    expect(helperText).toContain("derivedCashRankByTeamId");
    expect(helperText).toContain("startplatz: row.startplatz ?? derivedCashRank");
    expect(fileText).toContain("historicalPow");
    expect(fileText).toContain('row.historicalPow != null ? formatWholeNumber(row.historicalPow) : "—"');
    expect(fileText).toContain('row.avgRank != null ? formatWholeNumber(row.avgRank) : "—"');
  });

  it("keeps team strategy profiles and identity ratings local in the dedicated team settings view and read-only for AI context", async () => {
    const [fileText, routeText, helperText, aiText, identityText] = await Promise.all([
      fs.readFile(
        "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/foundation/FoundationPageClient.tsx",
        "utf8",
      ),
      fs.readFile(
        "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/api/singleplayer-state/route.ts",
        "utf8",
      ),
      fs.readFile(
        "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/lib/foundation/team-strategy-profiles.ts",
        "utf8",
      ),
      fs.readFile(
        "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/lib/ai/ai-legacy-lineup-engine.ts",
        "utf8",
      ),
      fs.readFile(
        "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/lib/foundation/team-identity-settings.ts",
        "utf8",
      ),
    ]);

    expect(fileText).toContain('{ id: "teamSettings", label: "Team Settings" }');
    expect(fileText).toContain('id="foundation-team-settings"');
    expect(fileText).toContain("Team Settings");
    expect(fileText).toContain("Team Settings lokal speichern");
    expect(fileText).toContain("Aenderungen verwerfen");
    expect(fileText).toContain("Export JSON");
    expect(fileText).toContain("Team-Auswahl");
    expect(fileText).toContain("Team waehlen");
    expect(fileText).toContain("Teamliste filtern");
    expect(fileText).toContain("Nicht gespeicherte Team-Settings verwerfen");
    expect(fileText).toContain("Local Overrides");
    expect(fileText).toContain("Identity Default");
    expect(fileText).toContain("Identity Override");
    expect(fileText).toContain("Team Settings öffnen");
    expect(fileText).toContain("Team Strategy Profile");
    expect(fileText).toContain("Strategy Profile lokal speichern");
    expect(fileText).toContain("Strategy Draft zuruecksetzen");
    expect(fileText).toContain("Reset auf Default");
    expect(fileText).toContain("Ausfuehrlicher lokaler Lore- und Bias-Kontext fuer AI-Erklaerungen.");
    expect(fileText).toContain("Profil-Version");
    expect(fileText).toContain("Roster Target");
    expect(fileText).toContain("Fantasy Theme");
    expect(fileText).toContain("Lore Theme");
    expect(fileText).toContain("Preferred Traits");
    expect(fileText).toContain("Disliked Traits");
    expect(fileText).toContain("Locked No-Gos");
    expect(fileText).toContain("Strategy Warnings");
    expect(fileText).toContain("Identity Rohwerte");
    expect(fileText).toContain("Player Type");
    expect(fileText).toContain("Derived Axis Bias %");
    expect(fileText).toContain("POW Bias");
    expect(fileText).toContain("SPE Bias");
    expect(fileText).toContain("MEN Bias");
    expect(fileText).toContain("SOC Bias");
    expect(fileText).toContain("read-only aus Identity Rohwerten");
    expect(fileText).toContain("Identity lokal speichern");
    expect(fileText).toContain("Identity auf Default");
    expect(fileText).toContain("Roster Min Target");
    expect(fileText).toContain("Roster Opt Target");
    expect(fileText).toContain("Lineup Style Note");
    expect(fileText).toContain("Transfer Style Note");
    expect(fileText).toContain("Sell Style Note");
    expect(fileText).toContain("Preferred Archetypes");
    expect(fileText).toContain("Avoided Archetypes");
    expect(fileText).toContain("Hard No-Gos");
    expect(fileText).toContain("Legacy-Kompatibilitaet / Debug");
    expect(fileText).toContain("nicht die primaere Team Identity");
    expect(fileText).toContain("AI read-only Kontext:");
    expect(fileText).toContain("Prisma/Supabase bleibt read-only. Profile koennen dort nicht gespeichert werden.");
    expect(routeText).toContain("withNormalizedTeamStrategyProfiles");
    expect(routeText).toContain("withNormalizedTeamIdentityOverrides");
    expect(helperText).toContain("buildTeamStrategyProfileMap");
    expect(helperText).toContain("normalizeStrategyProfile");
    expect(helperText).toContain("fallbackTheme");
    expect(helperText).toContain("levelFromComposite");
    expect(helperText).toContain("Bank der Olympiade");
    expect(helperText).toContain("Magier, Zauberwirker und Golems");
    expect(helperText).toContain("Teacher/Leader-Kern");
    expect(helperText).toContain("Human-only Fraktion");
    expect(identityText).toContain("buildResolvedTeamIdentities");
    expect(identityText).toContain("buildTeamIdentityOverrideMap");
    expect(identityText).toContain("deriveTeamIdentityAxisBias");
    expect(identityText).toContain("identity_axis_sum_zero");
    expect(identityText).toContain("withNormalizedTeamIdentityOverrides");
    expect(identityText).toContain("playerType");
    expect(aiText).toContain("buildStrategyProfileExplanation");
    expect(aiText).toContain("context.teamStrategyProfile");
    expect(aiText).toContain("deriveTeamIdentityAxisWeightMap");
  });

  it("keeps season cash visually heat-coded and prepares positive-negative finance styling", async () => {
    const [fileText, cssText] = await Promise.all([
      fs.readFile(
        "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/foundation/FoundationPageClient.tsx",
        "utf8",
      ),
      fs.readFile(
        "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/globals.css",
        "utf8",
      ),
    ]);

    expect(fileText).toContain("season-contract-pill");
    expect(fileText).toContain("heat-strong");
    expect(fileText).toContain("text-positive");
    expect(fileText).toContain("text-negative");
    expect(cssText).toContain(".season-contract-pill");
    expect(cssText).toContain(".transfer-context-banner");
    expect(cssText).toContain(".transfer-feedback-banner");
    expect(cssText).toContain(".transfer-callout");
    expect(cssText).toContain(".transfer-status-pill");
    expect(cssText).toContain(".player-drawer-backdrop {\n  z-index: 80;");
    expect(cssText).toContain(".foundation-modal-backdrop {\n  z-index: 120;");
    expect(cssText).toContain(".season-toolbar-expert-tools");
    expect(cssText).toContain(".season-jump-links");
    expect(cssText).toContain(".season-standings-cell-block-start");
    expect(cssText).toContain(".season-standings-table .column-resizer.is-disabled");
    expect(cssText).toContain(".season-pp-summary");
    expect(cssText).toContain(".season-pp-table td.pp-rank-top");
    expect(cssText).toContain(".season-pp-table td.pp-rank-chase");
    expect(cssText).toContain(".season-pp-table td.pp-rank-watch");
    expect(cssText).toContain(".season-pp-table td.pp-rank-muted");
    expect(cssText).toContain(".season-standings-table td.season-standings-cell-discipline.pp-rank-muted");
    expect(cssText).toContain(".rank-muted");
    expect(fileText).toContain("function getSeasonMatrixRankClass(rank: number)");
    expect(fileText).toContain("only real Top-10 values should carry heat");
    expect(fileText).toContain("places 11+ stay calm");
    expect(fileText).toContain('return "rank-muted";');
    expect(fileText).toContain('column.sourceStatus === "blocked_formula_unclear"');
    expect(fileText).toContain('return value ?? "—";');
  });

  it("keeps the lineup lab embedded in foundation with local sqlite default and prisma read-only mode", async () => {
    const [foundationText, lineupClientText, lineupRouteText, previewRouteText, contextRouteText] = await Promise.all([
      fs.readFile(
        "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/foundation/FoundationPageClient.tsx",
        "utf8",
      ),
      fs.readFile(
        "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/foundation/legacy-lineup-lab/LegacyLineupLabClient.tsx",
        "utf8",
      ),
      fs.readFile(
        "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/api/lineups/legacy/route.ts",
        "utf8",
      ),
      fs.readFile(
        "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/api/lineups/legacy/preview/route.ts",
        "utf8",
      ),
      fs.readFile(
        "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/api/lineups/legacy/lab-context/route.ts",
        "utf8",
      ),
    ]);

    expect(foundationText).toContain('{ id: "lineup", label: "Einsatzliste" }');
    expect(foundationText).toContain("<LegacyLineupLabClient");
    expect(foundationText).toContain('matchdayAutoRunFeed');
    expect(foundationText).toContain('runCockpitMatchdayAutoRun');
    expect(foundationText).toContain("/api/season/matchday-auto-run");
    expect(foundationText).toContain("Matchday Auto-Run");
    expect(foundationText).toContain("Auto-Run DryRun pruefen");
    expect(foundationText).toContain("Matchday lokal simulieren");
    expect(foundationText).toContain("AI ready");
    expect(foundationText).toContain("Manual ready");
    expect(foundationText).toContain("Passive fehlt");
    expect(foundationText).toContain("Warning Lineups einschließen");
    expect(foundationText).toContain("Bestehende AI-Lineups ueberschreiben");
    expect(foundationText).toContain("Bei Tie sofort stoppen");
    expect(foundationText).toContain("Preisgeld/Cash: season_end_only");
    expect(foundationText).toContain("Resolve Preview");
    expect(foundationText).toContain("Result Apply");
    expect(foundationText).toContain("Standings Preview");
    expect(foundationText).toContain("Cash Apply");
    expect(foundationText).toContain("Season-End: Cash Apply");
    expect(foundationText).toContain("MATCHDAY_AUTO_RUN_CONFIRM_TOKEN");
    expect(foundationText).toContain('initialSource="sqlite"');
    expect(foundationText).toContain("defaultSaveName={activeSaveName}");
    expect(lineupClientText).toContain('props.initialSource ?? "sqlite"');
    expect(lineupClientText).toContain("Aktiver Save");
    expect(lineupClientText).toContain("Quelle");
    expect(lineupClientText).toContain("SQLite / lokal");
    expect(lineupClientText).toContain("Prisma / Referenz");
    expect(lineupClientText).toContain("Captain");
    expect(lineupClientText).toContain("Lineup speichern");
    expect(lineupClientText).toContain("Ranks:");
    expect(lineupClientText).toContain("formatMatchdayOptionLabel");
    expect(lineupClientText).toContain("discipline1Label");
    expect(lineupClientText).toContain("discipline2Label");
    expect(lineupClientText).toContain("<span>Player</span>");
    expect(lineupClientText).toContain("Teamdeck / Assignment");
    expect(lineupClientText).toContain("Matchday Room · Lineup Prep");
    expect(lineupClientText).toContain("Matchday Preview");
    expect(lineupClientText).toContain("D1 Projected Range");
    expect(lineupClientText).toContain("D2 Projected Range");
    expect(lineupClientText).toContain("Fatigue Cost gesamt");
    expect(lineupClientText).toContain("Captain moeglich");
    expect(lineupClientText).toContain("Freier Slot");
    expect(lineupClientText).toContain("Einsatzstufe");
    expect(lineupClientText).toContain("Schonen");
    expect(lineupClientText).toContain("Push");
    expect(lineupClientText).toContain("resolveSlotRolesForDiscipline");
    expect(lineupClientText).toContain("D1 / D2 Lineup-Zonen");
    expect(lineupClientText).toContain("Matchday Arena · Reveal View ·");
    expect(lineupClientText).toContain("Top-Spieler ·");
    expect(lineupClientText).toContain("Weiter: Resolve Detail behalten");
    expect(lineupClientText).toContain("Done: Player Drawer per Klick/Doppelklick");
    expect(lineupClientText).toContain("Expert Modus");
    expect(lineupClientText).toContain("Expert Modus an");
    expect(lineupClientText).toContain("legacy-lineup-expert-mode-v1");
    expect(lineupClientText).toContain("Erweiterte Planung anzeigen");
    expect(lineupClientText).toContain("Vorschau, Formkarten und Mutatoren");
    expect(lineupClientText).toContain("legacy-lineup-table-preferences-v1");
    expect(lineupClientText).toContain("LegacyLineupTableCustomization");
    expect(lineupClientText).toContain("Tabelle anpassen");
    expect(lineupClientText).toContain("Retool Default");
    expect(lineupClientText).toContain("Compact");
    expect(lineupClientText).toContain("Finance");
    expect(lineupClientText).toContain("Performance");
    expect(lineupClientText).toContain('column.id === "image"');
    expect(lineupClientText).toContain('column.id === "name"');
    expect(lineupClientText).toContain('column.id === "team"');
    expect(lineupClientText).toContain('column.id === "contractLength"');
    expect(lineupClientText).toContain('column.id === "className"');
    expect(lineupClientText).toContain('column.id === "potential"');
    expect(lineupClientText).toContain('column.id === "appearances"');
    expect(lineupClientText).toContain('column.id === "marketValue"');
    expect(lineupClientText).toContain('column.id === "traitsPositive"');
    expect(lineupClientText).toContain("formatTraitList(player.traitsNegative)");
    expect(lineupClientText).toContain("PPs pro Bereich");
    expect(lineupClientText).toContain("Erweiterte Technikoptionen");
    expect(lineupClientText).toContain("Technikwechsel bleibt bewusst außerhalb des normalen Arbeitsflows.");
    expect(lineupClientText).not.toContain('<span>Quelle</span>\n            <select');
    expect(lineupClientText).not.toContain('<span>Save</span>\n            <select');
    expect(lineupClientText).toContain("getTopRankClass");
    expect(lineupClientText).not.toContain("Base Score D1 anzeigen");
    expect(lineupClientText).not.toContain("Base Score D2 anzeigen");
    expect(lineupClientText).not.toContain("Formkarten prüfen");
    expect(lineupClientText).not.toContain("Formkarten Reveal D1");
    expect(lineupClientText).not.toContain("Formkarten Reveal D2");
    expect(lineupClientText).not.toContain("Mutatoren Reveal D1");
    expect(lineupClientText).not.toContain("Mutatoren Reveal D2");
    expect(lineupClientText).not.toContain("D1 zurücksetzen");
    expect(lineupClientText).not.toContain("D2 zurücksetzen");
    expect(lineupClientText).toContain("formatFormCardOptionLabel");
    expect(lineupClientText).toContain("sortFormCardsForDiscipline");
    expect(lineupClientText).toContain("getFormCardColorForCategory");
    expect(lineupClientText).toContain("disciplineColor === card.color ? \" · x2\" : \"\"");
    expect(lineupClientText).toContain("Formkarten-Status:");
    expect(lineupClientText).toContain("Mutator-Status:");
    expect(lineupClientText).toContain("Formkartenstatus");
    expect(lineupClientText).toContain("Mutatorenstatus");
    expect(lineupClientText).toContain("Malus");
    expect(lineupClientText).toContain('teamDisciplineRanks');
    expect(lineupRouteText).toContain('parseSource(request) !== "prisma"');
    expect(lineupRouteText).toContain('source: "sqlite"');
    expect(lineupRouteText).toContain('readOnly: false');
    expect(lineupRouteText).toContain("Prisma/Supabase mode is read-only in this build.");
    expect(previewRouteText).toContain('parseSource(request) !== "prisma"');
    expect(previewRouteText).toContain('source: "sqlite"');
    expect(previewRouteText).toContain("calculateLocalLegacyLineupPreview");
    expect(lineupClientText).toContain("AI-Vorschau");
    expect(lineupClientText).toContain("AI-Vorschlag laden");
    expect(lineupClientText).toContain("Vorschlag uebernehmen");
    expect(lineupClientText).toContain("AI-Vorschlag uebernommen – noch nicht gespeichert.");
    expect(lineupClientText).toContain("Aktuelle Auswahl ersetzen?");
    expect(lineupClientText).toContain("buildDraftStateFromAiPreview");
    expect(lineupClientText).toContain("Kein Auto-Speichern, kein AI-Apply.");
    expect(lineupClientText).toContain("/api/lineups/legacy/ai-preview");
    expect(lineupClientText).toContain("/api/lineups/legacy/ai-batch-preview");
    expect(lineupClientText).toContain("/api/lineups/legacy/ai-batch-apply");
    expect(lineupClientText).toContain("AI Vorschlag alle Teams");
    expect(lineupClientText).toContain("Team öffnen");
    expect(lineupClientText).toContain("Batch DryRun");
    expect(lineupClientText).toContain("AI-Teams lokal speichern");
    expect(lineupClientText).toContain("AI Eligible:");
    expect(lineupClientText).toContain("Manual uebersprungen:");
    expect(lineupClientText).toContain("Passive uebersprungen:");
    expect(foundationText).toContain("Formkarten gesetzt");
    expect(foundationText).toContain("Mutatoren gesetzt");
    expect(foundationText).toContain("Formkarten Source Status");
    expect(foundationText).toContain("Mutator Source Status");
    expect(foundationText).toContain("Mutator Effekt");
    expect(lineupClientText).toContain("Disabled uebersprungen:");
    expect(lineupClientText).toContain("Ready to Save:");
    expect(lineupClientText).toContain("Nur Teams mit controlMode=ai und freigegebenem AI-Apply werden gespeichert.");
    expect(lineupClientText).toContain("Warning Teams einschließen");
    expect(lineupClientText).toContain("Bestehende Lineups ueberschreiben");
    expect(lineupClientText).toContain("Bitte zuerst Batch DryRun ausfuehren.");
    expect(lineupClientText).toContain("legacy-lineup-discipline-grid");
    expect(lineupClientText).toContain("legacy-lineup-main-flow");
    expect(lineupClientText).toContain("legacy-lineup-discipline-board");
    expect(lineupClientText).toContain("legacy-lineup-weight-band");
    expect(lineupClientText).toContain("legacy-lineup-arena-slot");
    expect(lineupClientText).toContain("resolveAttributeGrade");
    expect(lineupClientText.indexOf("Teamdeck / Assignment")).toBeLessThan(lineupClientText.indexOf("legacy-lineup-discipline-board"));
    expect(lineupClientText).toContain("Score ");
    expect(lineupClientText).toContain("Fatigue");
    expect(lineupClientText).toContain("Slot-Status:");
    expect(lineupClientText).toContain("Gespeichert:");
    expect(lineupClientText).toContain("<th>D1 Status</th>");
    expect(lineupClientText).toContain("<th>D2 Status</th>");
    expect(lineupClientText).toContain("<th>Control</th>");
    expect(lineupClientText).toContain("<th>AI Apply</th>");
    expect(lineupClientText).toContain("<th>Captain</th>");
    expect(lineupClientText).toContain("<th>Fehlende Slots</th>");
    expect(lineupClientText).toContain("<th>Apply</th>");
    expect(contextRouteText).toContain('source: searchParams.get("source")?.trim() === "prisma" ? "prisma" : "sqlite"');
    expect(contextRouteText).toContain("getSeasonDisciplineSchedule(save.gameState)");
    expect(contextRouteText).toContain("formatLineupTeamStatusLabel");
    expect(contextRouteText).toContain("discipline1Label");
    expect(contextRouteText).toContain("discipline2Label");
    expect(contextRouteText).toContain("captainSlots");
  });

  it("uses a protected buy preview flow before confirming a transfer", async () => {
    const [fileText, drawerText] = await Promise.all([
      fs.readFile(
        "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/foundation/FoundationPageClient.tsx",
        "utf8",
      ),
      fs.readFile(
        "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/foundation/PlayerDetailDrawer.tsx",
        "utf8",
      ),
    ]);

    expect(fileText).toContain("Angebot pruefen");
    expect(fileText).toContain('aria-label="Kaufdialog"');
    expect(fileText).toContain("Verhandeln");
    expect(fileText).toContain("Kauf final abschliessen");
    expect(fileText).toContain("Kaufvorschau laedt");
    expect(fileText).toContain("Die lokalen Teamwerte werden gerade fuer diesen Spieler geprueft.");
    expect(fileText).toContain("marketBuySubject");
    expect(fileText).toContain("marketBuySubject?.playerId");
    expect(fileText).toContain("marketBuyPreviewContext");
    expect(fileText).toContain("buy_save_context_mismatch");
    expect(fileText).toContain("buy_save_context_missing");
    expect(fileText).toContain("<span>Quelle</span>");
    expect(fileText).toContain("<span>Team</span>");
    expect(fileText).toContain('dryRun: true');
    expect(fileText).toContain('dryRun: false');
    expect(fileText).toContain("blockingReasons");
    expect(fileText).toContain("cashBefore");
    expect(fileText).toContain("cashAfter");
    expect(fileText).toContain("marketValueBefore");
    expect(fileText).toContain("marketValueAfter");
    expect(fileText).toContain("rosterBefore");
    expect(fileText).toContain("rosterAfter");
    expect(fileText).toContain("readMeta.source === \"prisma\"");
    expect(fileText).toContain("source: buyContext.source");
    expect(fileText).toContain("!marketTeamId");
    expect(fileText).toContain("readMeta.source === \"prisma\" || !marketBuyPreview?.canBuy || marketBuyBusy");
    expect(fileText).toContain("await Promise.all([");
    expect(fileText).toContain("loadSave(buyContext.saveId)");
    expect(fileText).toContain("saveId: buyContext.saveId");
    expect(fileText).toContain("teamId: buyContext.teamId");
    expect(fileText).toContain("playerId: buyContext.playerId");
    expect(drawerText).toContain("Scouting-Profil");
    expect(drawerText).toContain("Season Performance");
    expect(drawerText).toContain("PPs Rating");
    expect(drawerText).toContain("POW / SPE / MEN / SOC");
    expect(drawerText).toContain("Reale Season-PPs");
    expect(drawerText).toContain("echte PPs");
    expect(drawerText).toContain("Kein Verlauf");
    expect(drawerText).toContain("Top-Disziplinen");
    expect(drawerText).toContain("Historie");
    expect(drawerText).toContain("data.mvsSourceLabel");
    expect(drawerText).toContain("Top-Disziplinen");
    expect(drawerText).toContain("Keine gespeicherte Season-Performance.");
    expect(drawerText).toContain("Kauf prüfen");
    expect(drawerText).toContain("data.transferStatus");
    expect(drawerText).toContain("data.sourceLabel");
  });

  it("keeps normal buy and sell writes on the local service path and blocks prisma writes", async () => {
    const [buyRouteText, sellRouteText] = await Promise.all([
      fs.readFile(
        "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/api/transfermarkt/buy/route.ts",
        "utf8",
      ),
      fs.readFile(
        "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/api/transfermarkt/sell/route.ts",
        "utf8",
      ),
    ]);

    expect(buyRouteText).toContain("executeLocalTransfermarktBuy");
    expect(buyRouteText).toContain("previewLocalTransfermarktBuy");
    expect(buyRouteText).not.toContain("executeTransfermarktBuy");
    expect(buyRouteText).not.toContain("previewTransfermarktBuy");
    expect(buyRouteText).toContain("Prisma-Referenz ist read-only");

    expect(sellRouteText).toContain("executeLocalTransfermarktSell");
    expect(sellRouteText).toContain("previewLocalTransfermarktSell");
    expect(sellRouteText).not.toContain("executeTransfermarktSell");
    expect(sellRouteText).not.toContain("previewTransfermarktSell");
    expect(sellRouteText).toContain("Prisma-Referenz ist read-only");
  });

  it("persists table column widths and visibility beyond the transfermarkt", async () => {
    const fileText = await fs.readFile(
      "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/foundation/FoundationPageClient.tsx",
      "utf8",
    );

    expect(fileText).toContain("foundation-table-preferences-v1");
    expect(fileText).toContain("ColumnVisibilityManager");
    expect(fileText).toContain("setTableColumnVisible");
    expect(fileText).toContain("startTableColumnResize");
    expect(fileText).toContain("seasonTableColumns");
    expect(fileText).toContain("playersTableColumns");
    expect(fileText).toContain("teamsViewColumns");
    expect(fileText).toContain("selectedRosterColumns");
    expect(fileText).toContain("transferHistoryColumns");
  });

  it("keeps one global active manager team context across foundation views", async () => {
    const fileText = await fs.readFile(
      "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/foundation/FoundationPageClient.tsx",
      "utf8",
    );

    expect(fileText).toContain("foundation-active-manager-team-v1");
    expect(fileText).toContain("foundation-active-owner-v1");
    expect(fileText).toContain("foundation-team-filter-v1");
    expect(fileText).toContain("UI preference only: this drives the manager-facing default focus across views.");
    expect(fileText).toContain("It is not an authorization source; server-side team ownership remains the future authority.");
    expect(fileText).toContain("activeManagerTeamId");
    expect(fileText).toContain("activeManagerTeamSource");
    expect(fileText).toContain("activeOwnerId");
    expect(fileText).toContain("teamContextFilter");
    expect(fileText).toContain("handleManagerTeamSelect");
    expect(fileText).toContain('value="__all_teams__"');
    expect(fileText).toContain("Alle 32 Teams anzeigen");
    expect(fileText).toContain('setTeamContextFilter("all")');
    expect(fileText).toContain('const shouldLoadMarketFeed = activeView === "market";');
    expect(fileText).toContain("if (!shouldLoadMarketFeed)");
    expect(fileText).toContain("data-testid=\"active-manager-team\"");
    expect(fileText).toContain("data-testid=\"active-owner-controls\"");
    expect(fileText).toContain("data-testid=\"human-team-quick-switch\"");
    expect(fileText).toContain("data-testid=\"foundation-save-switch-select\"");
    expect(fileText).toContain("data-testid=\"foundation-active-save-id\"");
    expect(fileText).toContain("setActiveManagerTeam");
    expect(fileText).toContain("defaultTeamId={activeManagerTeamId}");
    expect(fileText).toContain("onTeamChange={(teamId) => setActiveManagerTeam(teamId, \"manual_select\")}");
    expect(fileText).toContain("persistFoundationManagerTeamId");
    expect(fileText).toContain("saved_preference");
    expect(fileText).toContain("default_human_team");
    expect(fileText).toContain("loadSaveRequestVersion");
    expect(fileText).toContain("saveActionRequestVersion");
    expect(fileText).toContain("requestVersion !== loadSaveRequestVersion.current");
    expect(fileText).toContain("requestVersion !== saveActionRequestVersion.current");
    expect(fileText).toContain("if (body.action === \"activate\" || body.action === \"clone\" || body.action === \"snapshot\" || body.action === \"fresh-season-1\")");
    expect(fileText).toContain("clearSaveScopedFeeds();");
  });

  it("offers a protected fresh season one start in the local admin flow", async () => {
    const [fileText, routeText] = await Promise.all([
      fs.readFile(
        "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/foundation/FoundationPageClient.tsx",
        "utf8",
      ),
      fs.readFile(
        "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/api/singleplayer-state/route.ts",
        "utf8",
      ),
    ]);

    expect(fileText).toContain("Neues Spiel / Season 1 starten");
    expect(fileText).toContain("Erstellt einen neuen lokalen Testspielstand fuer Season 1. Bestehende Saves bleiben erhalten.");
    expect(fileText).toContain('action: "fresh-season-1"');
    expect(fileText).toContain('setActiveView("season")');
    expect(fileText).toContain("syncFoundationViewInUrl");
    expect(routeText).toContain('{ action: "fresh-season-1"; name?: string }');
    expect(routeText).toContain('body.action === "fresh-season-1"');
    expect(routeText).toContain("createFreshSeasonOneSave");
  });

  it("keeps the teams view aligned with the dense retool comparison layout", async () => {
    const [fileText, cssText] = await Promise.all([
      fs.readFile(
        "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/foundation/FoundationPageClient.tsx",
        "utf8",
      ),
      fs.readFile(
        "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/globals.css",
        "utf8",
      ),
    ]);
    const teamsColumnsStart = fileText.indexOf("const teamsViewColumns = useMemo<FoundationTableColumn[]>");
    const teamsColumnsEnd = fileText.indexOf("const transferHistoryColumns = useMemo<FoundationTableColumn[]>");
    const teamsColumnsSection =
      teamsColumnsStart >= 0 && teamsColumnsEnd > teamsColumnsStart
        ? fileText.slice(teamsColumnsStart, teamsColumnsEnd)
        : "";

    expect(fileText).toContain("Vergleich zuerst, Drilldown darunter, überall dieselben Managementwerte wie im Saisonstand.");
    expect(fileText).toContain('label: "GuV"');
    expect(fileText).toContain('label: "Sponsor"');
    expect(fileText).toContain('label: "Gold"');
    expect(fileText).toContain('label: "Silber"');
    expect(fileText).toContain('label: "Bronze"');
    expect(fileText).toContain("teams-summary-grid-retool");
    expect(fileText).toContain("teams-summary-card");
    expect(fileText).toContain("POW Rang");
    expect(fileText).toContain("SPE Rang");
    expect(fileText).toContain("MEN Rang");
    expect(fileText).toContain("SOC Rang");
    expect(fileText).toContain("Kein aktiver Kader vorhanden");
    expect(fileText).toContain("Ø Marktwert (Season)");
    expect(fileText).toContain("Ø Gehalt (Season)");
    expect(fileText).toContain("Ø Punkte");
    expect(fileText).toContain("Hist. Punkte");
    expect(fileText).toContain("teamHistorySeasonPointColumns");
    expect(fileText).toContain("teamHistoryPointRankMaps");
    expect(fileText).toContain("teams-overview-shell");
    expect(fileText).toContain("Ewige Tabelle / Historische Punkte");
    expect(fileText).toContain("Nur echte archivierte Seasons aus dem lokalen Save.");
    expect(fileText).toContain("historicalPointsTotal");
    expect(fileText).toContain("historicalAvgPoints");
    expect(fileText).toContain("historicalPointsBySeason");
    expect(fileText).toContain("Historische Punkte gesamt");
    expect(fileText).toContain("Seasons gespielt");
    expect(fileText).toContain("Beste Platzierung");
    expect(fileText).toContain("Letzte Season Punkte");
    expect(fileText).toContain("Keine archivierten Seasons vorhanden");
    expect(fileText).toContain("teams-view-head-pow");
    expect(fileText).toContain("teams-view-axis-cell-pow");
    expect(fileText).toContain("row.sponsorTotal != null ? formatLocalePoints(row.sponsorTotal, 1) : \"—\"");
    expect(fileText).toContain('label: "Gold"');
    expect(fileText).toContain('label: "Top 10"');
    expect(teamsColumnsSection).not.toContain('label: "OVR"');
    expect(teamsColumnsSection).not.toContain('label: "PPs"');

    expect(cssText).toContain(".teams-summary-grid-retool");
    expect(cssText).toContain(".teams-summary-card");
    expect(cssText).toContain(".teams-overview-shell");
    expect(cssText).toContain(".teams-history-panel");
    expect(cssText).toContain(".teams-history-table");
    expect(cssText).toContain(".teams-view-head-pow");
    expect(cssText).toContain(".teams-view-head-spe");
    expect(cssText).toContain(".teams-view-head-men");
    expect(cssText).toContain(".teams-view-head-soc");
  });

  it("renders transfer history from the read-only api feed", async () => {
    const fileText = await fs.readFile(
      "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/foundation/FoundationPageClient.tsx",
      "utf8",
    );

    expect(fileText).toContain("/api/transfermarkt/history");
    expect(fileText).toContain("source: readMeta.source");
    expect(fileText).toContain("Scope:");
    expect(fileText).toContain("Transfers:");
    expect(fileText).toContain('label: "Bild"');
    expect(fileText).toContain('label: "Zeitpunkt"');
    expect(fileText).toContain('label: "Spieler"');
    expect(fileText).toContain('label: "Saison"');
    expect(fileText).toContain('label: "Typ"');
    expect(fileText).toContain('label: "Von"');
    expect(fileText).toContain('label: "Zu"');
    expect(fileText).toContain('label: "Abloese"');
    expect(fileText).toContain('label: "GuV"');
    expect(fileText).toContain('label: "Marktwert"');
    expect(fileText).toContain('label: "Power"');
    expect(fileText).toContain('label: "Speed"');
    expect(fileText).toContain('label: "Mental"');
    expect(fileText).toContain('label: "Social"');
    expect(fileText).toContain('label: "Gehalt"');
    expect(fileText).toContain('label: "Klasse"');
    expect(fileText).toContain('label: "Restlaufzeit"');
    expect(fileText).toContain('label: "Quelle"');
    expect(fileText).toContain("row.portraitUrl");
    expect(fileText).toContain("row.seasonLabel");
    expect(fileText).toContain("row.className");
    expect(fileText).toContain("getTransferSourceLabel");
    expect(fileText).toContain("row.fromTeamName ?? row.fromTeamId ?? \"FA\"");
    expect(fileText).toContain("row.toTeamName ?? row.toTeamId ?? \"FA\"");
    expect(fileText).toContain("historyClassFilter");
    expect(fileText).toContain("historySourceFilter");
    expect(fileText).toContain("guv_source_missing");
  });

  it("keeps standings preview as a secondary tools view with blocked-rule messaging", async () => {
    const fileText = await fs.readFile(
      "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/foundation/FoundationPageClient.tsx",
      "utf8",
    );

    expect(fileText).toContain("foundationPrimaryViews");
    expect(fileText).toContain("foundationSecondaryViews");
    expect(fileText).not.toContain("{foundationViews.map((view) => (");
    expect(fileText).toContain('label: "Saisonstand Preview"');
    expect(fileText).toContain("/api/standings/preview");
    expect(fileText).toContain('const [activeView, setActiveView] = useState<FoundationView>("home")');
    expect(fileText).toContain('{ id: "home", label: "Home" }');
    expect(fileText).toContain('data-testid="foundation-home"');
    expect(fileText).toContain('data-testid="home-league-table"');
    expect(fileText).toContain('data-testid="home-next-matchday"');
    expect(fileText).toContain('data-testid="home-player-cards"');
    expect(fileText).toContain('data-testid="home-task-list"');
    expect(fileText).toContain('data-testid="home-owner-overview"');
    expect(fileText).toContain('data-testid="home-data-warnings"');
    expect(fileText).toContain("homeMultiplayerOwnerGroups");
    expect(fileText).toContain("room_not_connected");
    expect(fileText).toContain("season_started_no_results");
    expect(fileText).toContain("Spieler verkaufen");
    expect(fileText).toContain("Spieler kaufen");
    expect(fileText).toContain("Training prüfen");
    expect(fileText).toContain("XP verteilen");
    expect(fileText).toContain("Facility Upgrade möglich");
    expect(fileText).toContain("Formkarten setzen");
    expect(fileText).toContain("Arena starten");
    expect(fileText).toContain("Ergebnis ansehen");
    expect(fileText).toContain("Diese Version nutzt globales Gesamtscoring aller Teams; keine Fame-/Draw-/Allianzlogik.");
    expect(fileText).toContain('row.currentPoints ?? "BLOCKED"');
    expect(fileText).not.toContain("previousFame");
    expect(fileText).not.toContain("projectedFame");
    expect(fileText).toContain("standingsPreviewTable");
  });

  it("styles the multiplayer-ready home owner overview", async () => {
    const cssText = await fs.readFile("/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/globals.css", "utf8");

    expect(cssText).toContain(".foundation-home-owner-overview");
    expect(cssText).toContain(".foundation-home-owner-grid");
    expect(cssText).toContain(".foundation-home-owner-card.is-active-owner");
    expect(cssText).toContain(".foundation-home-owner-card.is-ai-owner");
    expect(cssText).toContain(".foundation-home-owner-team-chip.is-active-team");
  });

  it("keeps foundation compact and moves technical tools out of the normal top flow", async () => {
    const [fileText, cssText] = await Promise.all([
      fs.readFile(
        "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/foundation/FoundationPageClient.tsx",
        "utf8",
      ),
      fs.readFile(
        "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/globals.css",
        "utf8",
      ),
    ]);

    expect(fileText).toContain('{ id: "generator", label: "Player Generator" }');
    expect(fileText).toContain('{ id: "admin", label: "Admin" }');
    expect(fileText).toContain("foundation-utility-strip");
    expect(fileText).toContain("Technische Ansicht");
    expect(fileText).toContain("Zu Admin");
    expect(fileText).toContain("Foundation laedt...");
    expect(fileText).not.toContain("<h1>Singleplayer</h1>");
    expect(fileText).not.toContain("Fokus auf die eigentlichen Arbeitsansichten.");
    expect(fileText).not.toContain('className="room-meta foundation-subnav"');
    expect(cssText).toContain(".foundation-utility-strip");
    expect(cssText).toContain(".foundation-tab-admin");
    expect(cssText).toContain(".foundation-loading-shell");
  });

  it("adds a guided local spieltag cockpit on top of the existing preview and apply apis", async () => {
    const fileText = await fs.readFile(
      "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/foundation/FoundationPageClient.tsx",
      "utf8",
    );

    expect(fileText).toContain('{ id: "cockpit", label: "Spieltag" }');
    expect(fileText).toContain("Spieltag-Cockpit");
    expect(fileText).toContain("Cockpit aktualisieren");
    expect(fileText).toContain("Fresh Season 1 Status");
    expect(fileText).toContain("Transfermarkt Status");
    expect(fileText).toContain("Neues Spiel / Season 1 starten");
    expect(fileText).toContain("Team Settings");
    expect(fileText).toContain("Team Control Settings");
    expect(fileText).toContain("Team Settings lokal speichern");
    expect(fileText).toContain("ownerId");
    expect(fileText).toContain("DEFAULT_ACTIVE_OWNER_ID");
    expect(fileText).toContain("aiLineupPreviewEnabled");
    expect(fileText).toContain("aiTransferPreviewEnabled");
    expect(fileText).toContain("aiSellPreviewEnabled");
    expect(fileText).toContain('value="manual"');
    expect(fileText).toContain('value="ai"');
    expect(fileText).toContain('value="passive"');
    expect(fileText).toContain("Write source: {readSourceLabel}");
    expect(fileText).toContain("Transfermarkt oeffnen");
    expect(fileText).toContain("Result Apply");
    expect(fileText).toContain("Standings Apply");
    expect(fileText).toContain("Cash Apply");
    expect(fileText).toContain("Matchday abschliessen");
    expect(fileText).toContain("/api/season/advance-matchday");
    expect(fileText).toContain("/api/resolve/legacy-matchday-preview");
    expect(fileText).toContain("/api/resolve/legacy-matchday-apply");
    expect(fileText).toContain("/api/standings/apply");
    expect(fileText).toContain("/api/season/cash-prize-apply");
    expect(fileText).toContain("Prisma bleibt: read-only");
    expect(fileText).toContain("Einsatzliste oeffnen");
    expect(fileText).toContain("Saison-Matchday-Plan");
    expect(fileText).toContain("currentMatchdayDisciplineSchedule");
    expect(fileText).toContain("legacy_seed");
  });

  it("defaults foundation to the local sqlite test save and keeps prisma as explicit read-only mode", async () => {
    const [pageText, apiText] = await Promise.all([
      fs.readFile(
        "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/foundation/page.tsx",
        "utf8",
      ),
      fs.readFile(
        "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/api/singleplayer-state/route.ts",
        "utf8",
      ),
    ]);

    expect(pageText).toContain('const initialReadSource = source === "prisma" ? "prisma" : "sqlite"');
    expect(apiText).toContain('source: "sqlite"');
    expect(apiText).toContain('readOnly: false');
    expect(apiText).toContain('source: "prisma"');
    expect(apiText).toContain('readOnly: true');
    expect(apiText).toContain("Prisma/Supabase mode is read-only in this build.");
  });

  it("renders a read-only prize preview tied to the real prize table api", async () => {
    const fileText = await fs.readFile(
      "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/foundation/FoundationPageClient.tsx",
      "utf8",
    );

    expect(fileText).toContain("/api/season/prize-preview");
    expect(fileText).toContain("Season-End Vorschau ist read-only; sie zeigt nur Economy-Auswirkungen und keine versteckten Writes.");
    expect(fileText).toContain("Preisgeldtabelle ungültig oder nicht eindeutig");
    expect(fileText).toContain("Basis Cash");
    expect(fileText).toContain("Season-Anteil");
    expect(fileText).toContain("+10 Plätze");
    expect(fileText).toContain("prizeFutureSeasonLabels");
    expect(fileText).not.toContain("Team-Auszahlung aktuell");
  });

  it("mirrors season core values into the team detail header and keeps player stats on player level", async () => {
    const fileText = await fs.readFile(
      "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/foundation/FoundationPageClient.tsx",
      "utf8",
    );

    expect(fileText).toContain("selectedTeamCoreMetrics");
    expect(fileText).toContain('label: "Platz"');
    expect(fileText).toContain('label: "Punkte"');
    expect(fileText).toContain('label: "#"');
    expect(fileText).toContain('label: "Budget"');
    expect(fileText).toContain('label: "Cash"');
    expect(fileText).toContain('label: "Gehalt"');
    expect(fileText).toContain('label: "Ø LZ"');
    expect(fileText).toContain('label: "MW"');
    expect(fileText).toContain('value: String(selectedStandingRow?.rosterCount ?? selectedRoster.length)');
    expect(fileText).toContain('value: selectedStandingRow?.budget != null ? formatMoney(selectedStandingRow.budget) : "—"');
    expect(fileText).toContain('value: selectedStandingRow?.cash != null ? formatMoney(selectedStandingRow.cash) : "—"');
    expect(fileText).toContain('value: selectedStandingRow != null ? formatMoney(selectedStandingRow.salaryTotal) : "—"');
    expect(fileText).toContain('value:');
    expect(fileText).toContain('selectedStandingRow?.marketValueTotal != null');
    expect(fileText).toContain('if (column.id === "race") return <td key={column.id}><RaceIcon race={player.race} showLabel={false} /></td>;');
    expect(fileText).toContain('OVR {formatWholeNumber(playerRatingsById.get(player.id)?.ovrNormalized ?? null)} · MVS');
    expect(fileText).toContain('Spielerwerte</span>');
    expect(fileText).toContain('OVR und PPs nur pro Spieler, nicht als Teamwert');
    expect(fileText).toContain("function getRosterEntryDisplaySalary");
    expect(fileText).toContain(".salary ?? entry.salary");
  });

  it("keeps the spieltag cockpit compact with quicklinks and friendlier blocker labels", async () => {
    const [fileText, cssText] = await Promise.all([
      fs.readFile(
        "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/foundation/FoundationPageClient.tsx",
        "utf8",
      ),
      fs.readFile(
        "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/globals.css",
        "utf8",
      ),
    ]);

    expect(fileText).toContain("Aktueller Stand");
    expect(fileText).toContain("Quicklinks");
    expect(fileText).toContain("Abschlussstatus");
    expect(fileText).toContain("cockpitFlowChecklist");
    expect(fileText).toContain("cockpitOverallStatus");
    expect(fileText).toContain("cockpitQuickLinks");
    expect(fileText).toContain("getCockpitStatusLabel");
    expect(fileText).toContain("formatCockpitReason");
    expect(fileText).toContain("Resolve Preview laden");
    expect(fileText).toContain("Saisonstand öffnen");
    expect(fileText).toContain("Einsatzliste öffnen");
    expect(fileText).toContain("Preisgeld öffnen");
    expect(fileText).toContain("Result lokal anwenden");
    expect(fileText).toContain("Standings lokal anwenden");
    expect(fileText).toContain("Cash lokal anwenden");
    expect(fileText).toContain("AI-Teams aufstellen");
    expect(fileText).toContain("Nur Teams mit controlMode=ai und aktiver Freigabe werden lokal als Einsatzliste gespeichert.");
    expect(fileText).toContain("AI-Lineups lokal speichern");
    expect(fileText).toContain("Warning Teams einschließen");
    expect(fileText).toContain("Bestehende Lineups ueberschreiben");
    expect(fileText).toContain("AI Eligible");
    expect(fileText).toContain("Ready to Save");
    expect(fileText).toContain("Saved");
    expect(fileText).toContain("Skipped");
    expect(fileText).toContain("Nur Einsatzlisten");
    expect(fileText).toContain("Manual und Passive Teams bleiben unveraendert.");
    expect(fileText).toContain("Manual uebersprungen:");
    expect(fileText).toContain("Passive uebersprungen:");
    expect(fileText).toContain("Disabled uebersprungen:");
    expect(fileText).toContain("bereit fuer AI-Lineup-Save");
    expect(fileText).toContain("runCockpitAiLineupBatchApply");
    expect(fileText).toContain("/api/lineups/legacy/ai-batch-apply");
    expect(fileText).toContain("Result DryRun pruefen");
    expect(fileText).toContain("Standings DryRun pruefen");
    expect(fileText).toContain("Cash DryRun pruefen");
    expect(fileText).toContain("Matchday DryRun pruefen");
    expect(cssText).toContain(".cockpit-topbar");
    expect(cssText).toContain(".cockpit-flow-strip");
    expect(cssText).toContain(".cockpit-flow-item");
    expect(cssText).toContain(".cockpit-link-grid");
    expect(cssText).toContain(".inline-toggle-row");
    expect(cssText).toContain(".inline-checkbox");
  });

  it("keeps the player generator local, editable and honest about missing market/salary engines", async () => {
    const [pageText, panelText, serviceText, typeText] = await Promise.all([
      fs.readFile(
        "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/foundation/FoundationPageClient.tsx",
        "utf8",
      ),
      fs.readFile(
        "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/foundation/PlayerGeneratorPanel.tsx",
        "utf8",
      ),
      fs.readFile(
        "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/lib/player-generator/player-generator-service.ts",
        "utf8",
      ),
      fs.readFile(
        "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/lib/data/olyDataTypes.ts",
        "utf8",
      ),
    ]);

    expect(pageText).toContain("PlayerGeneratorPanel");
    expect(pageText).toContain('getViewClass("generator")');
    expect(pageText).toContain('id: "generator", label: "Player Generator"');
    expect(pageText).toContain('id="foundation-generator"');
    expect(pageText).toContain("playerGeneratorDrafts");
    expect(panelText).toContain("Player Generator");
    expect(panelText).toContain("Rolle / Stat-Profil");
    expect(panelText).toContain("Staerke-Level");
    expect(panelText).toContain("Fantasy-Archetyp / Wesen");
    expect(panelText).toContain("Player Draft Preview");
    expect(panelText).toContain("Draft generieren");
    expect(panelText).toContain("Neu wuerfeln");
    expect(panelText).toContain("Profil nachschaerfen");
    expect(panelText).toContain("Seed kopieren");
    expect(panelText).toContain("Draft speichern");
    expect(panelText).toContain("Als Free Agent uebernehmen");
    expect(panelText).toContain("DB: nicht gespeichert");
    expect(panelText).toContain("Free Agent: nein");
    expect(panelText).toContain("Bestehende Spieler nutzen bis zur fertigen MW-/Gehalts-Umstellung weiter die importierten Marktwerte und Gehaelter.");
    expect(panelText).toContain("Finaler Spieler-Entwurf");
    expect(panelText).toContain("OVR: Draftwert");
    expect(panelText).toContain("PPs: Draftwert");
    expect(panelText).toContain("Engine-Status");
    expect(panelText).toContain("Draft-Status");
    expect(panelText).toContain("Save-Status");
    expect(panelText).toContain("Qualitaetswarnungen");
    expect(panelText).toContain("MW-Engine blockiert: Rank→MW-Tabelle ist noch unvollstaendig.");
    expect(panelText).toContain("Gehalt vorbereitet, wartet auf echten Marktwert.");
    expect(panelText).toContain("OVR ist eine Draft-Vorschau, kein finaler Pool-Wert.");
    expect(panelText).toContain("Draft speichern legt nur einen lokalen Entwurf ab.");
    expect(panelText).toContain("Noch deaktiviert: Erst sicheren Free-Agent-Insert-Pfad bauen.");
    expect(panelText).toContain("Archetype Match");
    expect(panelText).toContain("Role Match");
    expect(panelText).toContain("Free-Agent-Insert bleibt in diesem Block absichtlich deaktiviert");
    expect(panelText).toContain("Draft lokal gespeichert. Noch kein Free Agent");
    expect(serviceText).toContain("missing_market_value_engine");
    expect(serviceText).toContain("missing_salary_engine");
    expect(serviceText).toContain("engineStatus");
    expect(serviceText).toContain("qualityWarnings");
    expect(serviceText).toContain("salary_engine_waits_for_market_value_input");
    expect(typeText).toContain("blocked_archetype_conflict");
    expect(typeText).toContain("PlayerGeneratorEngineStatusView");
    expect(typeText).toContain("PlayerGeneratorQualityWarningCode");
    expect(typeText).toContain("PlayerGeneratorMatchState");
    expect(typeText).toContain("export type PlayerGeneratorInput");
    expect(typeText).toContain("export type PlayerGeneratorDraft");
    expect(typeText).toContain("PlayerGeneratorFormulaStatusSnapshot");
  });
});
