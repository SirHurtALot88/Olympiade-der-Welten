// term: aiTeamNeeds
// id: aiPreviewE2ETest
// type: datasource
// subtype: JavascriptQuery
// page: transfermarktPage
// folder: unknown
// updatedAt: unknown
// codeField: query
// dependencies: none
// extractionStatus: complete_or_primary_match
// Documentation:
//   After a successful purchase in the sequential package-buy flow, this query re-validates
//   the remaining queue against up-to-date state (cash, active players, transfer locks, roster size)
//   and advances to the next valid player. Invalid/unbuyable players are skipped.
// Returns:
//   {
//     status: 'stopped' | 'completed' | 'advanced' | 'skipped' | 'blocked',
//     index: number,
//     skipped: string[],
//     nextPlayerName: string | null,
//     reason?: string
//   }

if (!packageBuyFlowActive.value) {
  return {
    status: 'stopped',
    index: Number(packageBuyIndex.value || 0),
    skipped: [],
    nextPlayerName: null,
    reason: 'flow_not_active' };

}

const team = String(filterTeam.value || '').trim();
if (!team) {
  packageBuyFlowActive.setValue(false);
  return {
    status: 'blocked',
    index: Number(packageBuyIndex.value || 0),
    skipped: [],
    nextPlayerName: null,
    reason: 'no_team' };

}

const n = (v) => Number.isFinite(Number(v)) ? Number(v) : 0;
const norm = (v) => String(v ?? '').toLowerCase().trim();

// Always refresh key sources to avoid stale cash/locks
try {
  await Promise.all([
  getTeamsOverview.trigger(),
  getSaisonstandFromDB.trigger(),
  getAllActivePlayers.trigger(),
  getActivePlayersByTeam.trigger(),
  getTransfersFromDB.trigger(),
  getSoldPlayersCurrentSeason.trigger()]);

} catch (e) {
  // Non-fatal: continue with best-effort state
  console.warn('validateAutoBuyNextStep: refresh failed', e);
}

const cash = n(getCashFromSaisonstand.value?.cash || 0);
const season = Number(localStorage.values?.globalCurrentSeason || 1);

const transfers = Array.isArray(getTransfersFromDB.data) ?
getTransfersFromDB.data :
typeof formatDataAsArray === 'function' ?
formatDataAsArray(getTransfersFromDB.data) || [] :
[];

const sold = Array.isArray(getSoldPlayersCurrentSeason.data) ?
getSoldPlayersCurrentSeason.data :
typeof formatDataAsArray === 'function' ?
formatDataAsArray(getSoldPlayersCurrentSeason.data) || [] :
[];

const soldNames = new Set(sold.map((r) => norm(r?.player_name || r?.name)).filter(Boolean));

const allActive = Array.isArray(getAllActivePlayers.data) ?
getAllActivePlayers.data :
typeof formatDataAsArray === 'function' ?
formatDataAsArray(getAllActivePlayers.data) || [] :
[];

const activeNames = new Set(allActive.map((r) => norm(r?.name)).filter(Boolean));

const roster = Array.isArray(getActivePlayersByTeam.data) ?
getActivePlayersByTeam.data :
typeof formatDataAsArray === 'function' ?
formatDataAsArray(getActivePlayersByTeam.data) || [] :
[];

if (roster.length >= 12) {
  packageBuyFlowActive.setValue(false);
  packageBuyIndex.setValue(0);
  packageBuyQueue.setValue([]);
  packageBuySelection.setValue(null);
  utils.showNotification({
    title: 'Team voll',
    description: 'Team hat bereits 12 Spieler. Package-Flow gestoppt.',
    notificationType: 'warning',
    duration: 6 });

  return {
    status: 'blocked',
    index: Number(packageBuyIndex.value || 0),
    skipped: [],
    nextPlayerName: null,
    reason: 'roster_full' };

}

// Helper: player-based same-season lock
const hasPlayerTransferThisSeason = (playerName) => {
  const pn = norm(playerName);
  if (!pn) return false;
  return transfers.some((t) => norm(t?.player_name) === pn && Number(t?.season) === season);
};

// Resolve players list (source of truth)
const allPlayers = Array.isArray(playersTable.data) ?
playersTable.data :
typeof formatDataAsArray === 'function' ?
formatDataAsArray(playersTable.data) || [] :
[];

const findPlayer = (name) => allPlayers.find((r) => norm(r?.name) === norm(name)) || null;

const q = Array.isArray(packageBuyQueue.value) ? packageBuyQueue.value : [];
let idx = Number(packageBuyIndex.value || 0);

// Move to next index after a successful buy
idx = idx + 1;

const skipped = [];

while (idx < q.length) {
  const raw = q[idx];
  const name = raw?.name;
  if (!name) {
    skipped.push('(ungültiger Eintrag)');
    idx += 1;
    continue;
  }

  // Up-to-date object from playersTable (in case attributes changed)
  const playerObj = findPlayer(name) || raw;

  const fee = n(playerObj?.marktwert ?? playerObj?.mw ?? playerObj?.MW);

  // 1) Still exists + has a sensible price
  if (!(fee > 0)) {
    skipped.push(String(name));
    idx += 1;
    continue;
  }

  // 2) Enough cash
  if (fee > cash) {
    skipped.push(String(name));
    idx += 1;
    continue;
  }

  // 3) Player not already active somewhere
  if (activeNames.has(norm(name))) {
    skipped.push(String(name));
    idx += 1;
    continue;
  }

  // 4) Player-based season lock
  if (hasPlayerTransferThisSeason(name)) {
    skipped.push(String(name));
    idx += 1;
    continue;
  }

  // 5) Sold-this-season block (safety)
  if (soldNames.has(norm(name))) {
    skipped.push(String(name));
    idx += 1;
    continue;
  }

  // Found a valid next step
  packageBuyIndex.setValue(idx);
  frozenPurchasePlayer.setValue({ ...playerObj });

  // Keep UI consistent: open modal for next confirmation
  try {
    await getTeamsOverview.trigger();
  } catch (e) {}
  modalBuyPlayer.show();

  if (skipped.length) {
    utils.showNotification({
      title: 'Package weiter',
      description: `Übersprungen: ${skipped.slice(0, 3).join(', ')}${skipped.length > 3 ? '…' : ''}`,
      notificationType: 'info',
      duration: 6 });

  }

  return {
    status: skipped.length ? 'skipped' : 'advanced',
    index: idx,
    skipped,
    nextPlayerName: String(name) };

}

// No more players => complete
packageBuyFlowActive.setValue(false);
packageBuyIndex.setValue(0);
packageBuyQueue.setValue([]);
packageBuySelection.setValue(null);

utils.showNotification({
  title: 'Package Kauf abgeschlossen',
  description: skipped.length ?
  `Fertig. Übersprungen: ${skipped.slice(0, 3).join(', ')}${skipped.length > 3 ? '…' : ''}` :
  'Alle Spieler aus dem Package wurden durchgekauft.',
  notificationType: 'success',
  duration: 5 });


return { status: 'completed', index: idx, skipped, nextPlayerName: null };
