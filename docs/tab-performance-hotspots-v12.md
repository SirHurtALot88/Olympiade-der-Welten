# Tab Performance Hotspots V12

Status: Re-Audit attempted 2026-07-09 — dev server did not become ready within 120s (`tsx server.ts` hung without `Ready` log).

## Audit attempt

```bash
npm run dev
# → tsx server.ts (no Ready/localhost output after 120s)

npm run perf:foundation-v9 -- --base-url http://localhost:3000 --no-start --timeout-ms 180000
# → blocked: server not reachable
```

## Mitigations shipped in this wave

| Area | Change |
|---|---|
| Teamprofil | `team-profile-session-cache.ts` verified (24-entry LRU, signature invalidation) |
| Save loads | `foundationFetchWithRetry` on bootstrap, load, persist PUT, save actions |
| Arena | Existing `AbortController` refs for base/resolve/detail previews (`MatchdayArenaV2Client`) |
| Home cold | Development split deferred to client cards; overview derivations unchanged |

## Gates (V9 reference, warm)

| Metrik | V9 | Ziel V12 |
|---|---:|---:|
| Teamprofil warm | 122 s | < 10 s |
| Spielerprofil warm | 13,2 s | < 5 s |
| Home cold | 12 s | < 5 s |
| Arena → Saisonstand | 2 s | < 5 s (keine Regression) |

## Next step when server is healthy

1. `npm run dev` or `run-foundation-dev.sh --clean`
2. `npm run perf:foundation-v9 -- --base-url http://localhost:3000 --no-start --timeout-ms 180000`
3. Replace this file with measured CSV + per-tab notes

## Blocker notes

- Set `OLY_APP_DISABLE_PROJECT_ROOT_GUARD=1` if project-root guard blocks startup (see `ENV_SETUP.md`).
- Until V12 numbers exist, V11 baselines in `docs/tab-performance-hotspots-v11.md` remain authoritative.
