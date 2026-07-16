// term: aiTeamNeeds
// id: aiTeamNeedsSmokeTest
// type: script
// subtype: ButtonWidget2
// page: transfermarktPage
// folder: unknown
// updatedAt: unknown
// codeField: value
// dependencies: (() => {
  const r = aiTeamNeedsSmokeTest.data || {};
  const notes = Array.isArray(r.notes) ? r.notes : [];
  const team = r.team || (filterTeam.value || '-');
  const cash = Number(r.cash ?? 0);
  const roster = Number(r.rosterCount ?? 0);
  const q = Number(r.needsQueryCount ?? 0);
  const tr = Number(r.teamRatingsRows ?? 0);
  const dr = Number(r.disciplineRankingsRows ?? 0);

  const bits = [];
  bits.push(`Team=${team}`);
  bits.push(`Cash=${cash.toFixed(1)}`);
  bits.push(`Roster=${roster}`);
  bits.push(`RatingsRows=${tr}`);
  bits.push(`DisziRanksRows=${dr}`);
  bits.push(`NeedsQuery=${q}`);

  const head = bits.join('  ·  ');
  if (!notes.length) return head;

  return head + `\nHinweise: ` + notes.slice(0, 4).join(' | ');
})()
// extractionStatus: complete_or_primary_match
{{ (() => {
  const r = aiTeamNeedsSmokeTest.data || {};
  const notes = Array.isArray(r.notes) ? r.notes : [];
  const team = r.team || (filterTeam.value || '-');
  const cash = Number(r.cash ?? 0);
  const roster = Number(r.rosterCount ?? 0);
  const q = Number(r.needsQueryCount ?? 0);
  const tr = Number(r.teamRatingsRows ?? 0);
  const dr = Number(r.disciplineRankingsRows ?? 0);

  const bits = [];
  bits.push(`Team=${team}`);
  bits.push(`Cash=${cash.toFixed(1)}`);
  bits.push(`Roster=${roster}`);
  bits.push(`RatingsRows=${tr}`);
  bits.push(`DisziRanksRows=${dr}`);
  bits.push(`NeedsQuery=${q}`);

  const head = bits.join('  ·  ');
  if (!notes.length) return head;

  return head + `\nHinweise: ` + notes.slice(0, 4).join(' | ');
})() }}
