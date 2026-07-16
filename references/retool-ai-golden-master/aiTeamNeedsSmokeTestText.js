// term: aiTeamNeeds
// id: aiTeamNeedsSmokeTestText
// type: script
// subtype: TextWidget2
// page: transfermarktPage
// folder: unknown
// updatedAt: unknown
// codeField: query
// dependencies: none
// extractionStatus: complete_or_primary_match
// Documentation:
//   Bridge: copy the current aiTeamNeeds Function output into aiTeamNeedsSnapshot.
//   This makes the UI table (bound to aiTeamNeedsSnapshot) display aiTeamNeeds.
//   Note: aiTeamNeeds is a Function; it is computed reactively based on its inputs.
// Returns:
//   {
//     ok: boolean,
//     team: string,
//     needsCount: number,
//     notes: string[]
//   }

const s = (v) => String(v ?? '').trim();

const notes = [];
const team = s(filterTeam.value);

if (!team) {
  notes.push('No team selected (filterTeam.value empty)');
  aiTeamNeedsSnapshot.setValue([]);
  return { ok: false, team: '', needsCount: 0, notes };
}

// Best-effort: ensure base context is fresh
try {
  await refreshTeamContextBase.trigger();
} catch (e) {
  notes.push('refreshTeamContextBase failed: ' + String(e?.message || e));
}

let needs = [];
try {
  const v = aiTeamNeeds.value ?? aiTeamNeeds;
  needs = Array.isArray(v) ? v : [];
} catch (e) {
  notes.push('Could not read aiTeamNeeds.value: ' + String(e?.message || e));
  needs = [];
}

aiTeamNeedsSnapshot.setValue(needs);
aiLastTeamSelected.setValue(team || null);

return { ok: true, team, needsCount: needs.length, notes };
