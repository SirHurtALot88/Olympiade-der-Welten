# Foundation Performance Hotspots V6

Datum: 2026-06-28

## Kurzfazit

- Initialer Home-Load: **16925 ms**
- Langsamster Tabwechsel: **Sponsoren** (127912 ms von Diszis)
- Geprüfte Tab-Schritte: 16 (inkl. Training-Revisit)
- Save: `save-1782655544429-6k242j`, Team: `A-A`
- Browser-Errors: Failed to load resource: the server responded with a status of 400 (Bad Request); Failed to load resource: the server responded with a status of 500 (Internal Server Error); In HTML, %s cannot be a descendant of <%s>.
This will cause a hydration error.%s <button> button 

  ...
    <div className="foundation...">
      <FoundationViewMount activeView="trainingCo..." views={[...]} className="panel foun..." suspend={false}>
        <section className="panel foun..." id={undefined} data-testid={undefined}>
          <LoadableComponent selectedTeam={{teamId:"A-A", ...}} selectedTeamControlMode="automatisch" ...>
            <Suspense fallback={null}>
              <BailoutToCSR reason="next/dynamic">
                <TrainingCompactClient selectedTeam={{teamId:"A-A", ...}} selectedTeamControlMode="automatisch" ...>
                  <section className="training-c..." data-testid="foundation..." id="foundation...">
                    <header>
                    <section className="training-c...">
                      <TrainingPlayerLane playerRows={[...]} allPlayerCount={9} developmentFilter="all" ...>
                        <div>
                        <div>
                        <div>
                        <div className="training-v...">
                          <article className="training-v..." id="training-p...">
                            <FoundationPlayerPortraitCard playerId="player-226..." name="Nimri" ...>
>                             <button
>                               type="button"
>                               className="foundation-player-portrait-card home-v2-player-card is-full-art is-team-lay..."
>                               style={undefined}
>                               onClick={function onClick}
>                               title="Nimri Profil öffnen"
>                               data-testid="training-player-portrait-card"
>                             >
                                ...
                                  <div className="foundation..." onClick={function onClick}>
                                    <VeloIntensityRail ariaLabel="Nimri Trai..." segments={[...]} activeValue="leicht" ...>
                                      <div className="velo-inten..." aria-label="Nimri Trai...">
>                                       <button
>                                         className="velo-intensity-segment training-v2-intensity-segment is-leicht is..."
>                                         type="button"
>                                         disabled={undefined}
>                                         title="Schonend, weniger Base-XP, bessere Regeneration."
>                                         onClick={function onClick}
>                                       >
                                        ...
                                    ...
                            ...
                          ...
      ...
; <%s> cannot contain a nested %s.
See this log for the ancestor stack trace. button <button>

Siehe [V4/V5 vs V6 Vergleich](./tab-performance-hotspots-v6-comparison.md).

## Messwerte V6 (Rohdaten)

| Von | Nach | V6 ms | API Calls | Langsamste API | Status | Befund |
| --- | --- | ---: | ---: | --- | --- | --- |
| Home | Inbox | 4228 | 6 | /api/media/player-portrait/player-2262-nimri 3648ms | ok | — |
| Inbox | Einsatzliste | 10900 | 1 | /api/lineups/legacy/lab-context 106ms | slow | Tabwechsel >5s |
| Einsatzliste | Arena | 17030 | 1 | /api/standings/preview 2ms | slow | Tabwechsel >5s |
| Arena | Saisonstand | 11029 | 1 | /api/matchday/arena-base 3395ms | slow | Tabwechsel >5s |
| Saisonstand | Teams | 37027 | 11 | /api/singleplayer-state/version 10932ms | slow | Tabwechsel >5s |
| Teams | Spieler | 27717 | 39 | /api/singleplayer-state/version 10228ms | slow | 1 API responses still completing after ready; Tabwechsel >5s |
| Spieler | Training | 89504 | 12 | /api/singleplayer-state 25819ms | slow | Tabwechsel >5s |
| Training | Gebäude | 61940 | 1 | /api/singleplayer-state/version 11038ms | slow | Tabwechsel >5s |
| Gebäude | Training (revisit) | 25541 | 10 | /api/singleplayer-state/version 6257ms | slow | Tabwechsel >5s |
| Gebäude | Transfermarkt | 19635 | 0 | — | slow | Tabwechsel >5s |
| Transfermarkt | Scouting | 50631 | 1 | /api/singleplayer-state/version 31858ms | slow | Tabwechsel >5s |
| Scouting | Historie | 20975 | 3 | /api/singleplayer-state/version 4442ms | slow | Tabwechsel >5s |
| Historie | Ranks | 13153 | 0 | — | slow | Tabwechsel >5s |
| Ranks | Diszis | 12275 | 0 | — | slow | Tabwechsel >5s |
| Diszis | Sponsoren | 127912 | 0 | — | failed | locator.waitFor: Timeout 120000ms exceeded.
Call log:
  - waiting for locator('[data-testid="team-sponsor-choice"]:not(.foundation-section-hidden)').first() to be visible
 |
| Sponsoren | Lexikon | 10719 | 1 | /api/singleplayer-state/version 10ms | slow | Tabwechsel >5s |

CSV: [tab-performance-hotspots-v6.csv](./tab-performance-hotspots-v6.csv)

Backend-Audit: [outputs/performance-audit-summary.md](../outputs/performance-audit-summary.md) via `npm run perf:audit`.

