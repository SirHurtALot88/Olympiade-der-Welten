# 6-Punkte-Playtest — Zocken und Bugs

**Team:** H-R · **URL:** http://localhost:3000/foundation · **Vorher:** Hard Reload (Cmd+Shift+R)

**Sync:** 2026-06-25 — User-Feedback eingetragen. Triage: [playtest-triage-2026-06-25.md](./playtest-triage-2026-06-25.md)

---

## 1. Transfermarkt Buy (classic + wishlist)

- [x] Classic `market`: Kauf-Modal zeigt Preview-Werte (keine Striche)
- [x] V2 `marketV2`: gleiches Verhalten
- [ ] Wishlist → Kauf funktioniert — **nicht testbar** (Kader voll gepickt)
- [x] Team-Ownership H-R korrekt

**Notizen:**

```
Wishlist-Kauf kann ich nicht testen — Team ist schon fertig gepickt.
→ Automatisierter Testlauf / frischer Draft-Save für Wishlist-Flow nötig.
```

---

## 2. Ownership / Rechte

- [ ] `selectedTeamId` bleibt nach Reload — nicht explizit gemeldet
- [ ] Buy/Sell nur für eigenes Team — **BUG**
- [ ] Kein leeres Modal bei Team-Wechsel

**Notizen:**

```
Kaufdialog öffnet sich auch bei anderen Teams — soll gar nicht möglich sein.
Erwartung: Meldung „Nicht dein Team“, Buy-Button disabled wenn marketTeamId ≠ Manager-Team.
Classic market: Button prüft nur marketTeamId, nicht canManageTeamId (FoundationPageClient ~31696).
```

**Priorität:** P0 → UI Fixes

---

## 3. Verhandlung (Malus + Vertrauensbruch)

- [ ] Abort-Malus nur bei Abbruch, nicht bei Accept — **BUG**
- [ ] „Vertrauensbruch" / „angefressen" Banner sichtbar — **BUG**
- [ ] Auto-Angebot + Premium-Test-Label — nicht explizit gemeldet

**Notizen (Spieler: Tentacle):**

```
1. Kaufmodal → Kauf abbrechen → keine Meldung
2. Ganzer TM lädt neu beim Modal-Schließen — soll nicht passieren
3. Gehaltsforderung berechnen dauert lange
4. Modal erneut öffnen → keine Meldung dass Spieler sauer (gescheiterte Verhandlung)
```

**Priorität:** P0 → UI Fixes (Modal/State) + prüfen ob `persistContractNegotiationOutcome` / Preview-Malus greift

---

## 4. Einsatzliste → Arena

- [x] 9/9 Slots belegt
- [x] Formkarten gesetzt
- [ ] Arena startet — **BLOCKER**

**Notizen:**

```
Spieler eingesetzt, Formkarten auch — komme nicht in die Arena.
Vermutung: confirm_lineup (status submitted) fehlt ODER Arena-API blockiert (missing_lineups/training).
```

**Priorität:** P0 → Gameplay (Flow-Gate) + UI (Arena-CTA sichtbar machen mit Blocker-Grund)

---

## 5. HQ GM-Story (Hot Seat)

- [ ] Board-Druck ≥8 → Hot Seat — **Design-Feedback, kein SP-Bug**
- [ ] GM-Story-Panel + Lexikon-Boost — nicht getestet

**Notizen (Design, nicht Bug):**

```
Gehaltsdruck <45% sollte in Season 1 kein Board-Ziel sein — viel zu hart für aggressive Teams wie H-R.
Hot Seat: erst relevant bei gemeinsamem Online-Spiel, nicht Singleplayer.
Checkliste-Punkt 5 für SP vorerst depriorisieren / Ziel-Schwellen anpassen (Gameplay/Balancing).
```

**Priorität:** P1 Balancing/Gameplay — `team-season-objectives-service.ts` Gehaltsdruck-Ziel S1 lockern

---

## 6. Saisonende + V2 Previews (neu)

- [ ] Saisonwechsel-Assistent / Dry-Run
- [ ] Home v2, Scouting Hub, Inbox v2

**Notizen:** *(noch offen — Playtest bei Arena-Blocker abgebrochen)*

---

## Gesamturteil

| | OK | Blocker | Nice-to-have |
|---|:---:|:---:|:---:|
| Transfermarkt | ☐ | ☑ | ☐ |
| Lineup/Arena | ☐ | ☑ | ☐ |
| HQ/GM | ☐ | ☐ | ☑ (Design) |
| V2 Previews | ☐ | ☐ | ☐ |

**Top-3 Bugs für Briefings:**

1. **P0** Kaufdialog bei fremden Teams öffnet sich (Ownership-Gate fehlt in Classic UI)
2. **P0** Verhandlung: kein Malus/Banner, TM-Reload beim Schließen, langsames Gehalts-Preview
3. **P0** Arena nicht erreichbar trotz voller Einsatzliste + Formkarten

---

## Re-Test nach Merge

**Wann:** Nach Merge von PR [#2](https://github.com/SirHurtALot88/Olympiade-der-Welten/pull/2) (TM/Verhandlung), [#3](https://github.com/SirHurtALot88/Olympiade-der-Welten/pull/3) / [#4](https://github.com/SirHurtALot88/Olympiade-der-Welten/pull/4) (Arena/Gameplay) auf `main`, lokal `main` pullen + Hard Reload.

**Branch-Stand vor Merge:** Fixes nur auf Feature-Branches — dieser Block ist für den User nach Integration.

### 2. Ownership / Rechte (Re-Test)

- [ ] Buy/Sell nur für eigenes Team — Fremdteam: kein Modal, Meldung sichtbar
- [ ] `selectedTeamId` / Team-Wechsel ohne leeres Modal

### 3. Verhandlung (Re-Test)

- [ ] Abbrechen → Malus-/Fehlermeldung sichtbar (nicht nur nach Reopen)
- [ ] Modal schließen → **kein** Full-Page TM-Reload
- [ ] Reopen nach gescheiterter Verhandlung → „angefressen" / Vertrauensbruch-Banner

### 4. Einsatzliste → Arena (Re-Test)

- [ ] 9/9 + Formkarten → Arena startet (oder klarer Blocker-Grund im UI)
- [ ] Kein stiller Dead-End nach Lineup-Confirm

### 6. Saisonende + V2 Previews (Re-Test)

- [ ] Saisonwechsel-Assistent / Dry-Run erreichbar
- [ ] Home v2, Scouting Hub, Inbox v2 — Smoke ohne Crash

**Sync:** 2026-06-25 — offen bis User nach Merge durchspielt.
