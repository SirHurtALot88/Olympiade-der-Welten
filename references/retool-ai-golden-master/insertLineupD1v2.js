// term: playerExhaustionMap
// id: insertLineupD1v2
// type: datasource
// subtype: RetoolTableQuery
// page: Einsatzliste
// folder: unknown
// updatedAt: unknown
// codeField: query
// dependencies: none
// extractionStatus: complete_or_primary_match
// Documentation:
//   Load all global player images (P1-P10).
//   Patch (timeouts): tolerate transient errors so page load doesn't hard-fail.
// Returns:
//   {
//     success: boolean,
//     cancelled: boolean,
//     loadedPages: number,
//     failedPages: number,
//     errors: string[]
//   }

const isTransient = (e) => {
  const msg = String(e?.message || e || '');
  return /timeout|connection terminated|network|ECONNRESET|ETIMEDOUT|socket/i.test(msg);
};

const calls = [
{ id: 'P1', q: listPlayerImages_Global_P1 },
{ id: 'P2', q: listPlayerImages_Global_P2 },
{ id: 'P3', q: listPlayerImages_Global_P3 },
{ id: 'P4', q: listPlayerImages_Global_P4 },
{ id: 'P5', q: listPlayerImages_Global_P5 },
{ id: 'P6', q: listPlayerImages_Global_P6 },
{ id: 'P7', q: listPlayerImages_Global_P7 },
{ id: 'P8', q: listPlayerImages_Global_P8 },
{ id: 'P9', q: listPlayerImages_Global_P9 },
{ id: 'P10', q: listPlayerImages_Global_P10 }];


const results = await Promise.allSettled(
calls.map(({ q }) => q.trigger()));


let loadedPages = 0;
let failedPages = 0;
const errors = [];
let cancelled = false;

results.forEach((r, idx) => {
  if (r.status === 'fulfilled') {
    loadedPages += 1;
    return;
  }

  failedPages += 1;
  const label = calls[idx]?.id || `P${idx + 1}`;
  const reason = r && 'reason' in r ? r.reason : null;
  const msg = String(reason?.message || reason || 'Unknown error');
  errors.push(`${label}: ${msg}`);

  if (isTransient(reason)) {
    cancelled = true;
  }
});

if (!failedPages) {
  console.log('✅ All global player images loaded (P1-P10)');
  return { success: true, cancelled: false, loadedPages, failedPages, errors: [] };
}

console.warn('⚠️ Some global image pages failed:', errors);

// For transient errors we mark cancelled=true (but do not throw)
return {
  success: false,
  cancelled,
  loadedPages,
  failedPages,
  errors };
