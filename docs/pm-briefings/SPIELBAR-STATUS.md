# Spielbar-Status — Solo (1 Team)

**Ziel:** Ein Solo-Spielstand, ein manuelles Team, voller Spieltag-Loop ohne Dead-End.

**Letzter Smoke:** 2026-06-25 (Next Steps: Build grün, Resolve-Lab Nav-Polish; manueller Browser-Loop empfohlen)

| Check | Status | Notiz |
|-------|--------|-------|
| Production Build | 🟢 | `npm run build` grün (Sponsor TS-Fixes) |
| Save laden | 🟡 | `npm run play` · ggf. `npm run save:repair-team-control -- --team H-R` |
| Home/Inbox: nächster Schritt | 🟢 | Flow-Controller zeigt korrekten Schritt mit `globalNextLabel` |
| Sidebar-Reihenfolge | 🟢 | Drag pro Gruppe, localStorage persistiert nach Reload |
| Entity-Navigation (Klick) | 🟢 | Spieler-/Teamnamen öffnen Profil per Single-Click; Escape/Backspace navigiert zurück |
| Training setzen | 🟢 | "Weiter" navigiert korrekt zu `trainingCompact` (Trainingsmodus) statt Gebäude |
| Transfermarkt: nur eigenes Team | 🟢 | Buy disabled + Modal-Guard |
| Verhandlung: Feedback bei Abbruch | 🟢 | Meldung beim Schliessen |
| Lineup + Formkarten | 🟢 | Blocker-Codes klar: `missing_formcard_pool` / `missing_formcard_selections` |
| Lineup bestätigen (submitted) | 🟢 | Pflicht — UI zeigt Blocker + Button "Lineup bestätigen" |
| Arena startet | 🟢 | Nach Lineup-Bestaetigung — Flow-Gate aktiv |
| Arena Ergebnisse scrollen | 🟢 | Globaler-Next scrollt direkt zu `#arena-result-summary` statt Arena-Top |
| Spieltag abschliessen | 🟢 | Button "Spieltag abschliessen" in arena-result-summary — ruft auto-run mit advance |
| Nächster Spieltag | 🟢 | Nach auto-run → homeV2 mit Training/Lineup für neuen Spieltag |
| Gehalt/MW-Delta-Stack | 🟢 | Deltas unter Wert in Kader-Tabelle, Roster-Grids und Home-Karten |

Legende: 🟢 OK · 🟡 teilweise / Re-Test nötig · 🔴 blockiert

## Was noch 🟡 ist

- **Save laden** — der repair-script braucht lokale Rechte (kein Sandbox-Problem). Im Terminal laufen lassen: `npm run save:repair-team-control -- --team H-R`. Wenn Save schon korrekt konfiguriert ist, entfällt das.
- **Manueller 15-Min-Loop** — `npm run app:smoke-gameplay` benötigt lokal `npx playwright install`; bis dahin Checkliste unten manuell in `npm run play`.

## Fix Loop 3 — Foundation Nav-UX (2026-06-25)

| Fix | Bereich | Problem | Lösung |
|-----|---------|---------|--------|
| Single-Click-Profile | Foundation, Season V2, Historie, Arena, Einsatzliste | Doppelklick-Mentalmodell, extra Sprung-Buttons | `table-link-button` auf Namen; Zeilen-Doppelklick entfernt |
| Classic Home entfernt | FoundationPageClient | Parallele Home-UI neben homeV2 | Panel gelöscht; URL `home` → `homeV2` |
| Classic Season entfernt | FoundationPageClient | Parallele Saison-UI neben seasonV2 | Classic-Panel gelöscht; Redirect bleibt |
| Tote Cross-Nav-Props | V2 Clients | `onOpenClassic*`, `onOpenHomeV2` ungenutzt | Props aus Types und Clients entfernt |
| Keyboard-Back | FoundationPageClient | Escape/Backspace nur für Drawer | `foundationNavigateBack()` + History-Stack verdrahtet |
| Economy-Stack MW | Team-Kader | MW-Delta neben statt unter Wert | `.economy-money-stack` auch für MW-Spalte und Roster-Grids |
| Build TS | Sponsor-Services | `computeWeightedHistoricalRank(null)` + Tier-Cast | Null-Guard + `SponsorStarTier`-Cast in sponsor-tier-pool |
| Resolve-Lab Nav | LegacyResolveLabClient | Doppelklick auf Spieler | Namens-Links per `table-link-button` |

## Bekannte Einschränkungen (v1)

- Nur **Solo 1 Team** — Online 4v4 kommt später
- V2-Preview-Screens (Scouting Hub etc.) sind optional, nicht Teil des Loops
- GM-Story / Hot Seat ist Design-Feedback, kein SP-Blocker
- Automatischer Smoke: `npm run app:smoke-gameplay` (Entwickler-Check)
- Transfermarkt-Wishlist: Doppelklick auf Kandidat öffnet weiterhin Kaufdialog (bewusst)

## Vollständiger Solo-Loop (8-9/10)

```
Home (nächster Schritt angezeigt)
  → Training setzen (alle Spieler · speichert sofort)
  → Transfermarkt optional (nur eigenes Team)
  → Lineup Lab (Slots füllen · Formkarten · "Lineup bereit speichern")
  → Arena (Reveal läuft · "Spieltag abschliessen" klicken)
  → Home (neuer Spieltag · Training wieder dran)
```

## Dein Playtest (15 Min)

1. `npm run play` → Browser öffnet Foundation
2. Checkliste: [playtest-checklist.md](./playtest-checklist.md)
3. Sidebar-Reihenfolge ändern → Reload → persistiert
4. Home → Spielername → Profil; Zurück via Escape oder Sidebar
5. Teams → Kader → Name → Profil; Gehalt/MW-Delta unter Wert
6. Transfermarkt → Kandidat → Name/Portrait → Profil
7. Historie → Spieler/Team klickbar
8. Bugs melden mit Vorlage aus dem Plan (Ziel / Erwartung / Ist-Zustand)

## Save schützen

```bash
npm run backup:save
```
