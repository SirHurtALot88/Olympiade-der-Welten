# Retool Transfermarkt Column Extract

Source: `/Users/chrisfalk/Downloads/Olympiade%20der%20Welten%20Draftboard (7).json`

Tables found: 3

## playersTable
- componentId: `playersTable`
- page: `transfermarktPage`
- subtype: `TableWidget2`
- data source: `{{ _.orderBy(playersWithTeamFitBreakdown.value, ['marktwert'], ['desc']) }}`
- columns: 45
- actions: Pick, Kaufen
- dependencies: _.orderBy(playersWithTeamFitBreakdown.value, ['marktwert'], ['desc']), playersWithTeamFitBreakdown

## aiTeamNeedsTable
- componentId: `aiTeamNeedsTable`
- page: `transfermarktPage`
- subtype: `TableWidget2`
- data source: `{{ (Array.isArray(ai2NeedsSnapshot.value) ? ai2NeedsSnapshot.value : []).filter(r => ['identity','discipline'].includes(String(r?.category))) }}`
- columns: 13
- actions: none
- dependencies: (Array.isArray(ai2NeedsSnapshot.value) ? ai2NeedsSnapshot.value : []).filter(r => ['identity','discipline'].includes(String(r?.category))), ai2NeedsSnapshot

## playersTable2
- componentId: `playersTable2`
- page: `transfermarktPage`
- subtype: `TableWidget2`
- data source: `{{ wishlistWithImages.value }}`
- columns: 38
- actions: Entfernen, Kaufen
- dependencies: pickedPlayers, wishlistWithImages, wishlistWithImages.value

