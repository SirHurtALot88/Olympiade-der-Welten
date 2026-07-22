/**
 * Gemeinsame Stale-Schwelle für den AI-Preseason-Automationslauf (Setup-Draft + Season-Markt).
 *
 * Ein vollständiger Season-1-Setup-Draft (31 KI-Teams, ~328 Käufe) läuft SYNCHRON ~131 s. Die frühere
 * Schwelle von 120 s lag DARUNTER — dadurch galt ein völlig legitimer, noch laufender Draft als „stale":
 *  - der Client normalisierte den `running`-Datensatz zu `failed` (blockierte damit das Re-Triggern), und
 *  - der Server hätte einen Duplikat-Lauf zugelassen.
 * Ein abgebrochener Lauf (Dev-Hot-Reload/Navigation/Proxy-Timeout während der ~131 s) blieb als „running"
 * hängen → dauerhaft blockiert → „KI pickt gar nicht / hängt für immer".
 *
 * Deshalb liegt die Schwelle jetzt DEUTLICH über der realen Laufzeit (300 s). So wird ein echt laufender Draft
 * nie fälschlich als stale eingestuft, während ein wirklich verwaister Lauf (>300 s „running") als stale
 * erkannt und neu angestoßen werden kann. ENV-tunebar.
 */
export const AI_PRESEASON_RUN_STALE_MS = Number(process.env.OLY_AI_PRESEASON_STALE_MS ?? 300_000) || 300_000;
