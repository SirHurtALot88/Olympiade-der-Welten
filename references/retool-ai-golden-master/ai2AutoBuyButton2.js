// term: AI2_RunNeeds
// id: ai2AutoBuyButton2
// type: widget
// subtype: ButtonWidget2
// page: transfermarktPage
// folder: unknown
// updatedAt: unknown
// codeField: src
// dependencies: none
// extractionStatus: complete_or_primary_match
// NOTE: keep MVP stable: during init phase, ignore resets/triggers
if (Boolean(v2_isInitializing.value)) return;

// Always reset slots UI-state on team change/clear
resetSlots_v2.trigger();

// Only fetch team players if a team is actually selected
const t = teamSelect_v2.value;
if (t != null && String(t).trim() !== '') {
  getTeamPlayersEinsatz_v2.trigger();
}
