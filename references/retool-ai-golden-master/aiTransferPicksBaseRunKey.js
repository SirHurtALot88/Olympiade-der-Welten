// term: aiTeamNeeds
// id: aiTransferPicksBaseRunKey
// type: function
// subtype: Function
// page: transfermarktPage
// folder: unknown
// updatedAt: unknown
// codeField: query
// dependencies: none
// extractionStatus: complete_or_primary_match
// Documentation:
//   Hard reset AI state when the user changes teams.
//   - Clears AI snapshots + debug state
//   - Keeps manual wishlist entries, removes AI-tagged ones only
//   - Resets in-flight flags so the UI can't get stuck
//   - Updates aiLastTeamSelected
// Returns:
//   {
//     team: string,
//     removedAiWishlist: number,
//     keptManualWishlist: number
//   }

const s = (v) => String(v ?? '').trim();

const team = s(filterTeam.value);

// Clear team-dependent AI snapshots
try {aiTeamNeedsSnapshot.setValue([]);} catch (e) {}
try {aiTransferPicksSnapshot.setValue([]);} catch (e) {}
try {aiTransferPackagesSnapshot.setValue([]);} catch (e) {}
try {aiTransferPicksQueryDebug.setValue({});} catch (e) {}

// Also clear derived plan state (package/autobuy)
try {autoBuyPlan.setValue(null);} catch (e) {}
try {autoBuyPlanSummary.setValue('');} catch (e) {}
try {packageBuyQueue.setValue([]);} catch (e) {}
try {packageBuyIndex.setValue(0);} catch (e) {}
try {packageBuyFlowActive.setValue(false);} catch (e) {}
try {packageBuySelection.setValue(null);} catch (e) {}

// Clear run context
try {aiRunSeedState.setValue(null);} catch (e) {}
try {aiVariationSeed.setValue(null);} catch (e) {}
try {aiRunTeamContext.setValue(null);} catch (e) {}

// Reset UI in-flight
try {aiSearchInFlight.setValue(false);} catch (e) {}
try {runAiSearchButton.setDisabled(false);} catch (e) {}

// Remove AI-only wishlist entries, keep manual
const AI_WISHLIST_MARKER = 'ai_top10';
const currentWishlist = Array.isArray(pickedPlayers.value) ? pickedPlayers.value : [];
const keepManual = currentWishlist.filter((p) => s(p?.wishlist_type) !== AI_WISHLIST_MARKER);
const removedAiWishlist = currentWishlist.length - keepManual.length;

pickedPlayers.setValue(keepManual);

aiLastTeamSelected.setValue(team || null);

return {
  team,
  removedAiWishlist,
  keptManualWishlist: keepManual.length };
