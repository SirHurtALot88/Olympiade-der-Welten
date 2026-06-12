// term: AI2_RunNeeds
// id: 0e04652d
// type: script
// subtype: ButtonWidget2
// page: transfermarktPage
// folder: unknown
// updatedAt: unknown
// codeField: src
// dependencies: none
// extractionStatus: complete_or_primary_match
await AI2_RunNeeds.trigger();
utils.showNotification({
  title: 'AI2 Needs berechnet',
  description: `Needs: ${Array.isArray(ai2NeedsSnapshot.value) ? ai2NeedsSnapshot.value.length : 0}`,
  notificationType: 'success',
  duration: 3,
});
