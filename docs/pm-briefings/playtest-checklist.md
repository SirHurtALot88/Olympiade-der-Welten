# Solo-Playtest — 1 Team zocken

**Modus:** Solo 1 Team · **URL:** http://localhost:3000/foundation · **Vorher:** Hard Reload (Cmd+Shift+R)

Start: `npm run play`

---

## Spieltag-Loop (das Wichtigste)

- [ ] Save lädt ohne endloses Skeleton
- [ ] Genau **1** Team ist deins (Team Settings → Solo → dein Team → Lokal speichern)
- [ ] Home/Inbox zeigt klaren **nächsten Schritt**
- [ ] Training für alle Kader-Spieler gesetzt
- [ ] Einsatzliste voll (9/9 o.ä.)
- [ ] Formkarten-Pool vorhanden (Zuweisung optional)
- [ ] **Lineup bestätigt** (nicht nur gespeichert — Status „submitted“)
- [ ] **Arena startet** und zeigt Reveal/Ergebnis
- [ ] Nach Arena: nächster Spieltag ohne Cockpit-Geheimwissen

**Notizen:**

```
Blocker-ID (falls Stall):
```

---

## Blocker-IDs (Diagnose)

| ID | Bedeutung | Fix |
|----|-----------|-----|
| `lineup_not_submitted` | Slots voll, Lineup nicht bestätigt | Einsatzliste → „Lineup bestätigen“ |
| `missing_lineup` / `incomplete_lineup` | Slots/Kader noch nicht spielbereit | Einsatzliste füllen |
| `missing_formcard_pool` | Kein Formkarten-Pool für die Season | Einsatzliste → Pool erzeugen |
| `training_missing` | Nicht alle Spieler haben Training | Training Compact |
| `phase_blocked:buy_players:*` | Transferfenster zu | Warten auf Preseason/Setup-Fenster |
| `resolve_status:missing_lineups` | Andere Teams ohne Lineup | AI-Lineups / Cockpit |
| `board_objectives_failed` | Board-Ziel verfehlt | Team → Board Objectives |

Automatisierter Check: `npm run ci:flow-smoke`

---

## Transfermarkt (optional im Loop)

- [ ] Kauf nur bei **eigenem** Team — fremdes Team: Button disabled, keine Modal
- [ ] Verhandlung abbrechen → Meldung sichtbar (nicht still)
- [ ] Modal schließen → kein Full-Page-Reload des TM
- [ ] Reopen nach gescheiterter Verhandlung → „angefressen“-Hinweis

**Notizen:**

```
```

---

## Optional (nicht SP-Blocker)

- [ ] GM-Story / Hot Seat — Design, erst relevant für Online
- [ ] Saisonende-Assistent
- [ ] Home v2, Scouting Hub — Preview-Screens

---

## Bug melden (Copy-Paste)

```
ZIEL:
ERWARTUNG:
IST-ZUSTAND:
Blocker-ID:
Team / URL:
```

Status-Ampel: [SPIELBAR-STATUS.md](./SPIELBAR-STATUS.md)
