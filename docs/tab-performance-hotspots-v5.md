# Foundation Performance Hotspots V5

Datum: 2026-06-28

## Kurzfazit

- **Backend-Impact bestätigt:** training page build **59,3 s → 0,94 s** (−98,4 %), Cache-Hit **0,03 ms**
- **Browser-Audit:** Lauf mit Einschränkungen (Teams-Tab Timeout, Cold Dev-Server) — siehe [V4 vs V5 Vergleich](./tab-performance-hotspots-v5-comparison.md)
- Initialer Home-Load V5-Lauf: **54 991 ms** (Cold-Compile; V4: 25 191 ms auf warmem Server)

## Wichtigste Ergebnisse

| Kategorie | Ergebnis |
| --- | --- |
| season derivations cache hit | 0,03 ms (Ziel <50 ms) |
| training page build (Roster) | 943 ms (V4: 59 300 ms mit 333 Spielern) |
| Arena → Saisonstand (Browser) | 11 312 ms (V4: 28 093 ms, −60 %) |
| Spieler → Training (Browser) | nicht messbar (Teams-Tab blockierte Kette) |

## Dokumentation

- **V4 vs V5 Vergleich:** [tab-performance-hotspots-v5-comparison.md](./tab-performance-hotspots-v5-comparison.md)
- **V4 Baseline (unverändert):** [tab-performance-hotspots-v4.md](./tab-performance-hotspots-v4.md)
- **Backend-Audit:** [outputs/performance-audit-summary.md](../outputs/performance-audit-summary.md)
- **Browser-Rohdaten:** [tab-performance-hotspots-v5.csv](./tab-performance-hotspots-v5.csv), `outputs/foundation-tab-performance-audit/latest.json`

## Messwerte V5 (Rohdaten)

Siehe CSV und `latest.json`. Training-Revisit-Zeile enthalten (`Gebäude → Training (revisit)`).

## Nächste Schritte

1. Teams-Tab + `marketSellBusy`-Bug fixen, Tab-Audit wiederholen
2. `/api/singleplayer-state`-Reload bei Training/Gebäude reduzieren
3. Transfermarkt Free-Agent Feed optimieren (aktuell Top-Backend-Hotspot: 11 s)
