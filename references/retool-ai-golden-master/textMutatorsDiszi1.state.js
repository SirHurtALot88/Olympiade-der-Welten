// term: playerExhaustionMap
// id: textMutatorsDiszi1
// type: widget
// subtype: TextWidget2
// page: Einsatzliste
// folder: unknown
// updatedAt: unknown
// codeField: value
// dependencies: currentMutatorTraitsD2.value?.display || '—' | (tempTraitPointsX10D2.value || 0) / 10 | (tempFormPointsX10D2.value || 0) / 10 | captainCheckboxDiszi2.value ? (() => { const d2Name = (currentSpieltagDisziplinen.value?.d2?.name || ''); const ex = (playerExhaustionMap.value || {}); const maxAdj = (enrichedPlayersForSelection.value || []).reduce((best, p) => { const name = p.Name || p.name; const base = Number(p[d2Name] ?? p.SkillD2 ?? 0); const mult = Number(ex[name]?.multiplier || 1); const current = base * mult; return Math.max(best, current); }, 0); return `|  Captain: ${Math.round(maxAdj * 0.5 * 10) / 10}`; })() : ''
// extractionStatus: complete_or_primary_match
**Mutatoren (Diszi 2):** {{ currentMutatorTraitsD2.value?.display || '—' }}  |  Punkte: {{ (tempTraitPointsX10D2.value || 0) / 10 }}  |  Form: {{ (tempFormPointsX10D2.value || 0) / 10 }}  {{ captainCheckboxDiszi2.value ? (() => { const d2Name = (currentSpieltagDisziplinen.value?.d2?.name || ''); const ex = (playerExhaustionMap.value || {}); const maxAdj = (enrichedPlayersForSelection.value || []).reduce((best, p) => { const name = p.Name || p.name; const base = Number(p[d2Name] ?? p.SkillD2 ?? 0); const mult = Number(ex[name]?.multiplier || 1); const current = base * mult; return Math.max(best, current); }, 0); return `|  Captain: ${Math.round(maxAdj * 0.5 * 10) / 10}`; })() : '' }}
