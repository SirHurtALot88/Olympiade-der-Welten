// term: aiTeamNeeds
// id: aiTransferPicksSkillWeighted
// type: datasource
// subtype: JavascriptQuery
// page: transfermarktPage
// folder: unknown
// updatedAt: unknown
// codeField: src
// dependencies: none
// extractionStatus: complete_or_primary_match
const row = packageInspectPlayersTable.selectedSourceRow;
if (!row?.player_name) return;

// Find player in the main players table (source of truth)
const allPlayers = Array.isArray(playersTable.data) ? playersTable.data : (typeof formatDataAsArray === 'function' ? (formatDataAsArray(playersTable.data) || []) : []);
const norm = (v) => String(v ?? '').toLowerCase().trim();
const p = allPlayers.find(r => norm(r?.name) === norm(row.player_name));

const payload = {
  name: row.player_name,
  team: p?.team || p?.Team || '',
  klasse: p?.klasse || p?.Klasse || '',
  MW: row.market_value,
  Gehalt: row.salary,
  Bracket: p?.Bracket || p?.bracket || ''
};

localStorage.setValue('selectedPlayer', payload);
getPlayerHistoryForDrawerGlobal.trigger();
drawerFramePlayerDetailsEinsatz.setHidden(false);
