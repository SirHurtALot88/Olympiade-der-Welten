# Spielbar-Status — Solo (1 Team)

**Ziel:** Ein Solo-Spielstand, ein manuelles Team, voller Spieltag-Loop ohne Dead-End.

**Letzter Smoke:** 2026-06-25 (Fix Loop: Spieltag-abschliessen + Blocker-Messages + Arena-Flow)

| Check | Status | Notiz |
|-------|--------|-------|
| Save laden | 🟡 | `npm run play` · ggf. `npm run save:repair-team-control -- --team H-R` |
| Home/Inbox: nächster Schritt | 🟢 | Flow-Controller zeigt korrekten Schritt mit `globalNextLabel` |
| Training setzen | 🟢 | Training-View speichert sofort · Flow blockiert Lineup bis Training gesetzt |
| Transfermarkt: nur eigenes Team | 🟢 | Buy disabled + Modal-Guard |
| Verhandlung: Feedback bei Abbruch | 🟢 | Meldung beim Schliessen |
| Lineup + Formkarten | 🟢 | Blocker-Codes klar: `missing_formcard_pool` / `missing_formcard_selections` |
| Lineup bestätigen (submitted) | 🟢 | Pflicht — UI zeigt Blocker + Button "Lineup bestätigen" |
| Arena startet | 🟢 | Nach Lineup-Bestaetigung — Flow-Gate aktiv |
| Spieltag abschliessen | 🟢 | Button "Spieltag abschliessen" in arena-result-summary — ruft auto-run mit advance |
| Nächster Spieltag | 🟢 | Nach auto-run → homeV2 mit Training/Lineup für neuen Spieltag |

Legende: 🟢 OK · 🟡 teilweise / Re-Test nötig · 🔴 blockiert

## Was noch 🟡 ist

- **Save laden** — der repair-script braucht lokale Rechte (kein Sandbox-Problem). Im Terminal laufen lassen: `npm run save:repair-team-control -- --team H-R`. Wenn Save schon korrekt konfiguriert ist, entfällt das.

## Bekannte Einschränkungen (v1)

- Nur **Solo 1 Team** — Online 4v4 kommt später
- V2-Preview-Screens (Scouting Hub etc.) sind optional, nicht Teil des Loops
- GM-Story / Hot Seat ist Design-Feedback, kein SP-Blocker
- Automatischer Smoke: `npm run app:smoke-gameplay` (Entwickler-Check)

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
3. Bugs melden mit Vorlage aus dem Plan (Ziel / Erwartung / Ist-Zustand)

## Save schützen

```bash
npm run backup:save
```
