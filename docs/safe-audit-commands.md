# Safe Audit Commands (OOM / Cursor IDE)

Concrete commands and guardrails for performance audits and long-run scripts in **Olympiade der Welten**.  
Goal: avoid Node/browser OOM, IDE freezes, and SQLite write contention from parallel dev servers.

## Environment variables

| Variable | Purpose |
| --- | --- |
| `NODE_OPTIONS=--max-old-space-size=8192` | Raise Node heap for heavy audits (8 GB typical; use 4096 on 16 GB RAM machines). |
| `OLY_EXPORT_DIR=outputs` | Default export root for audit CSV/JSON (override for isolated runs). |
| `OLY_BASE_URL=http://127.0.0.1:3000` | Target URL for Playwright tab perf audit. |
| `OLY_LONG_RUN_ALLOW_DEV_SERVER=1` | Allow long-run sandbox while a dev server is up (not recommended). |
| `OLY_LONG_RUN_REQUIRE_NO_DEV_SERVER=1` | Fail fast if dev server detected (strict CI). |
| `OLY_LONG_RUN_DEV_SERVER_URL` | URL checked by long-run sandbox (default `http://127.0.0.1:3000`). |

Long-run sandbox already merges heap flags:

```bash
NODE_OPTIONS="--max-old-space-size=8192" npm run long-run:sandbox
```

## Safe commands (stdout-friendly)

Prefer **`--summary-only`** where available — one JSON line on stdout, full report in `outputs/`:

```bash
# Long-run S1–S6 (heavy; stop dev server first)
NODE_OPTIONS=--max-old-space-size=8192 npx tsx scripts/long-run-sandbox-s1-s6.ts --summary-only

# Fresh pick audit 10×
NODE_OPTIONS=--max-old-space-size=8192 npx tsx scripts/fresh-pick-audit-10x.ts --summary-only

# Multiseason final audit
npx tsx scripts/multiseason-final-audit.ts --save-id <id> --summary-only

# Tab performance (uses Playwright; dev server logs go to file, not IDE stdout)
npx tsx scripts/foundation-tab-performance-audit.ts --no-start
# or with auto-start (logs in outputs/foundation-tab-performance-audit/dev-server.log):
npx tsx scripts/foundation-tab-performance-audit.ts

# Lighter perf smoke
npm run test:perf
npm run perf:audit
```

Resume long-run without re-bootstrap:

```bash
npx tsx scripts/long-run-sandbox-s1-s6.ts --resume-save-id <saveId> --summary-only
```

## What NOT to run inside Cursor IDE (or with Foundation UI open)

- **`scripts/long-run-sandbox-s1-s6.ts`** without `--summary-only` and without stopping `npm run dev` — floods stdout + competes on SQLite.
- **`scripts/fresh-pick-audit-10x.ts`** full JSON per run on stdout — use `--summary-only`.
- **`scripts/season-realistic-multi-sim.ts`** / **`scripts/run-resilient-multiseason.ts`** while editing saves in the browser — same DB lock risk.
- Opening Foundation **Debug** tab with **Show full JSON** on a large multiseason save — can OOM the browser tab and stress the IDE webview.
- Running **two** `npm run dev` instances against the same SQLite file.

## Parallel dev server warning

Several scripts call `assertLongRunSimEnvironment()` (`scripts/long-run-sandbox-s1-s6.ts`):

- If `http://127.0.0.1:3000/foundation` responds, the script **warns** or **throws** (when `OLY_LONG_RUN_REQUIRE_NO_DEV_SERVER=1`).
- Foundation tab perf audit may **spawn** its own dev server; use `--no-start` when you already have one running, or expect duplicate servers if port 3000 is free.

**Before a long-run audit:** close Foundation in the browser, stop `npm run dev`, then run the script from an external terminal.

## Memory limits (rules of thumb)

| Context | Limit / note |
| --- | --- |
| Node audit scripts | `--max-old-space-size=8192` max; 4096 if machine has ≤16 GB RAM |
| Browser Debug JSON | Full `gameState` stringify disabled by default; use summary + explicit unlock |
| Season derivations cache | In-memory LRU capped at 4 entries per process (`season-derivations-cache.ts`) |
| Save session cache | Invalidated on write; avoid loading 10+ full saves in one script without `--summary-only` |

## Related docs & outputs

- Tab hotspots: `docs/tab-performance-hotspots-v6.1.md`
- Backend perf summary: `outputs/performance-audit-summary.md` (`npm run perf:audit`)
- Multiseason plan: `docs/multiseason-implementation-plan.md`

## Quick pre-flight checklist

1. Stop `npm run dev` (unless script explicitly allows parallel UI).
2. Set `NODE_OPTIONS` heap if script loads full saves repeatedly.
3. Use `--summary-only` for CI / agent runs.
4. Write heavy CSV/JSON only under `outputs/` — do not pipe multi-MB JSON to stdout.
5. Do not open Debug → full JSON on production-sized saves during audits.
