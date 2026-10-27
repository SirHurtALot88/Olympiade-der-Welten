# Battlefield: Rollen je Kadergröße, jede Rolle erobert, dynamische Punktwahl (Task #198, 27.10.)

**Struktur-Runde, keine Kalibrierrunde.** Battlefield bleibt nicht an die Wertung angeschlossen
(`lib/battle/arena-resolved-disciplines.ts` unverändert). Die Eignungsmatrix ist nicht angefasst.

## 0. Chris' Entscheidung (27.10., wörtlich)

> „bei battlefield und 2 spielern müssen alle agieren, auch der commander und der spotter können
> und sollen ja felder einnehmen bzw es versuchen. Spieler müssen auch rotieren und taktisch
> agieren, es soll keine fixe aufteilung sein wer an welchem slot ist sonst gibt es ja absolut
> keine dynamik und es ist wie ein 1v1 DM an jedem ort. Und vllt solltest du bei 2 Spielern dann
> nicht commander und spotter als slot nehmen. Wichtig ist ja dass die gewichtungen passen, es
> kann bei 2 spielern ja andere slots geben als bei 6 spielern! auch DAS ist erlaubt"

Daraus drei Anforderungen: (1) jede Rolle erobert bei jeder Kadergröße, (2) keine feste
Rolle→Ort-Bindung, (3) je Kadergröße eine eigene Rollenzusammensetzung.

## 1. Befund vorher (nachgeprüft)

| Punkt | Stand auf `main` (ace13846) |
|---|---|
| Rollen je k | `buildGeneratedSlotRoles` nahm `DISCIPLINE_ROLE_THEMES.battlefield.slice(0, k)` → k=2 **immer Commander + Spotter**. Mini-DMs `MINI_DM_FFA_SLOTS_JE_K` ist ebenfalls nur `slice(0,k)` mit k-eigenen Profilen, keine eigene Zusammensetzung. |
| Motor-Feldgröße | `ARENA_ART.battlefield.jeSeite: 4` → bei 5/6 gesetzten Spielern fielen Field Control und Disruptor lautlos weg; die Gastseite bekam ihre Slots aus der Vierer-Liste nach Reihe. |
| Punkte | **Ein** Kontrollpunkt in der Mitte (Radius 230), nicht drei. Nur Siege Core hatte einen Eroberungsbonus (1,6); alle anderen zählten 1. |
| Eroberungsfähigkeit Commander/Spotter | Formal 1, praktisch ~0: niemand lief je gezielt zum Punkt. Commander (Reihe 2, MID∓460) und Spotter (Reihe 1) hielt die Formationsleine (`reihenAnker`) hinten — der Code-Kommentar sagte es selbst („erreicht den Punkt kaum je"). |
| Bindung / Deathmatch | Keine Punktwahl überhaupt: Zielwahl war „nächster/gefährlichster Gegner". Bei 2 gegen 2 setzte `endspiel = live<=2` **jeden Kämpfer ab Sekunde 0 in den Offensivzwang** (`nearest(foes)`) — ein reines Deathmatch mit Punkt als Kulisse. |

## 2. Was jetzt gilt

**Rollen je Kadergröße** (`ROLE_THEME_IDS_BY_SLOT_COUNT` in `lib/lineups/matchday-slot-roles.ts`,
im Motor `BATTLEFIELD_SLOTS_JE_K`, aus derselben Quelle):

| k | Rollen (Slot-Reihenfolge; letzte = Ausgleichsslot) |
|---|---|
| 2 | Siege Core, Morale Anchor |
| 3 | Siege Core, Field Control, Morale Anchor |
| 4 | Siege Core, Field Control, Commander, Morale Anchor |
| 5 | Siege Core, Field Control, Commander, Disruptor, Morale Anchor |
| 6 | Siege Core, Field Control, Commander, Spotter, Disruptor, Morale Anchor |

Die Gewichte passen bei **jedem** k: der Mittelwert der Slot-Profile ist exakt die Matrix
(charisma 20, intelligence 16, spirit 16, torment 12, power 10, awareness 10, health 8,
determination 4, stamina 4) — als Test festgehalten. Bei k=2 trägt Morale Anchor als
Ausgleichsslot Charisma/Intelligence/Spirit (22/18/18), Siege Core Power/Torment.

**Eroberung je Rolle** (`ARENA_DOMINATION.battlefield.rolle`, Klemme `kpRolleVon`: jede Rolle
erobert, neutralisiert und hält mit **mindestens 1**):

| Rolle | Zusatz |
|---|---|
| Siege Core | erobert ×1,6 |
| Field Control | erobert ×1,3, drängt an eigenen Orten ×1,3 zurück |
| Commander | erobert ×1,25 |
| Spotter | neutrale Orte ×1,5 |
| Morale Anchor | drängt gegnerischen Teilfortschritt an eigenen Orten ×1,6 zurück |
| Disruptor | baut gegnerischen Teilfortschritt auch an **umkämpften** Orten ab |

Neu für alle Rollen: steht nur die eigene Seite an einem eigenen Ort, an dem der Gegner schon
Fortschritt hatte, sinkt dieser (vorher blieb er ewig stehen).

**Drei Orte** nach K6 Abschnitt 4: Nord/Mitte/Süd auf der Mittellinie, Radius 65, 2 Punkte/s je
gehaltenem Ort (alle drei = die alten 6/s), Sieg bei 150 oder nach Punktestand.

**Dynamische Punktwahl** (`dominationZielWahl`): jeder Kämpfer bewertet alle 1,2–2,8 s (Bindung)
und sofort nach jedem Besitzwechsel jeden Ort nach Lage (fremd/neutral/eigen bedroht/eigen
sicher), Taktik (Haltung + Befehl: offensiv/verfolgen/flanke nimmt lieber, defensiv/decken/hinter
hält lieber), Spielstand und Restzeit, Bedarf (Eigene dort/unterwegs), Kräfteverhältnis am Ort
(LP·VER·ANG), Lücken (fremder Ort ohne Gegner), Entfernung und einem kleinen Haltebonus fürs
aktuelle Ziel. Rollen geben nur einen kleinen thematischen Zuschlag, nie eine Bindung. Gekämpft
wird, wer am eigenen Zielort steht oder einem zu nahe kommt (`dominationGegnerWahl`).
In der Domination greifen Formationsleine, „hinter"/„decken"-Klammern und Offensivzwang nicht
mehr; TDM und Mini-DM sind bitgleich (nachgeprüft, je 6 Saaten).

## 3. Messung (vorher = `main` ace13846, nachher = dieser Branch)

rho, `node scripts/miss-alle-disziplinen.mjs 24 battlefield --je-seite=k`, Kaderfamilie live-save:

| k | rho je Spiel vorher → nachher | rho Saison vorher → nachher |
|---|---|---|
| 2 | 0,750 → 0,808 | 0,800 → 0,800 |
| 3 | 0,521 → 0,686 | 0,600 → 0,829 |
| 4 | 0,399 → 0,401 | 0,310 → 0,643 |
| 5 | 0,232 → 0,556 | 0,358 → 0,661 |
| 6 | 0,257 → 0,228 | 0,483 → 0,308 |

Spannweiten 0,5–1,1: Einzelschritte liegen im Kaderrauschen, die Richtung über k=2..5 ist
deutlich (Saison-Validität bei k=3..5 fast verdoppelt). k=6 ist nicht besser.

Pp (`node scripts/messe-arena-einfluss.mjs battlefield 12 [--je-seite=k] [--saat-versatz=10000000]`):
s. Abschnitt 3a — eingetragen nach Abschluss der Läufe.

Rollen-Diagnose (`node scripts/miss-battlefield-domination.mjs 4`, 20 Spiele je k): jede Rolle
trägt bei jedem k Eroberungsfortschritt bei (90–100 % der Kämpfer jeder Rolle), auch Commander und
Spotter. Jeder Kämpfer steuert im Mittel 2,0–2,9 verschiedene Orte an und wechselt 1,5–5,4-mal.

## 4. Was offen bleibt (nicht Teil dieser Runde)

- **2 gegen 2 endet nach ~12 s durch Elimination** (20/20 Spiele). Die Spieler rotieren jetzt
  (1,5–1,9 Ortswechsel), aber kaum eine Eroberung wird fertig, bevor einer liegt. Das löst nur
  Respawn plus Wegfall des Eliminationssiegs (K6 Abschnitt 5) — dort als offene Frage an Chris
  markiert („kein Eliminationssieg mehr"), deshalb hier nicht entschieden.
- **Pp**: der Weg zum Ort läuft über TMP (awareness/intelligence/charisma), und TMP liegt außerhalb
  der `aufEignung()`-Normierung — derselbe Chassis-Befund wie in K6 Abschnitt 1.
- Kalibrierrunde (Respawn, Spielzeit, Spielerwert aus Haltesekunden/Eroberungen, Abnahme rho > 0,80
  und Pp ≤ 25 zweistromig) — eigene Runde, wie bei TDM.
- `scripts/generiere-arena-daten.ts --schreiben` würde heute den von Hand eingefügten
  `PP_MATRIX_JE_DISC`-Block und die Umlaut-Texte im Motor überschreiben; diese Runde hat die
  Battlefield-Blöcke deshalb gezielt eingesetzt statt den ganzen Generator-Block neu zu schreiben.
