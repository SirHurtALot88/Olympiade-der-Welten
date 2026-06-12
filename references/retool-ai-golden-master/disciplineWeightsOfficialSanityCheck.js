// term: disciplineRecipesGlobal
// id: disciplineWeightsOfficialSanityCheck
// type: function
// subtype: Function
// page: einsatzlisteSlotsV2Page
// folder: unknown
// updatedAt: unknown
// codeField: query
// dependencies: none
// extractionStatus: complete_or_primary_match
// Documentation:
//   Helper to sync the AI discipline weight recipes (0..1) with the official percent table.
//   This does NOT persist anything automatically. It returns a JSON-safe object you can paste
//   into lib/disciplineRecipesGlobal.js (or store elsewhere).
// Returns:
//   {
//     recipes: Record<string, Record<string, number>>, // normalized weights 0..1
//     notes: string[]
//   }

const pct = disciplineWeightsOfficialPct.value || {};

const recipes = {};
for (const [field, weights] of Object.entries(pct)) {
  const entries = Object.entries(weights || {}).filter(([, w]) => Number(w) > 0);
  const sum = entries.reduce((a, [, w]) => a + Number(w || 0), 0) || 0;
  recipes[field] = {};
  for (const [attr, w] of entries) {
    recipes[field][attr] = sum > 0 ? Number((Number(w) / sum).toFixed(4)) : 0;
  }
}

const notes = [];
notes.push('Paste `recipes` into disciplineRecipesGlobal.js and remove old hardcoded recipe weights.');
notes.push('Run disciplineWeightsOfficialSanityCheck afterwards; it should return [].');

return { recipes, notes };
