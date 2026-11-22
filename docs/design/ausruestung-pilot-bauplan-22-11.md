# Ausrüstungs-Pilot: Bauplan (22.11.)

Grundlage:
- Konzept `docs/design/zwischen-den-spieltagen-22-11.md` (§11, §14, §25–70) und die Mockups `public/mockups/zwischen-den-spieltagen-22-11.html` sowie `kiste-demo-22-11.html`. Beides kommt mit PR #1687 auf `main`.
- Bauplan: Opus-Planer auf Code-Stand `51fb109c5`.
- Entscheidungen der Projektleitung: Abschnitt C, Chris hat sie am 22.11. an die PM delegiert.

Chris hat zum Bau freigegeben: „ja“ (22.11.).

## A. Was der Code vorgibt

1. **Die Eignung im Spiel ist nicht linear.** `player.disciplineRatings` entsteht aus Rohsumme × Matrixgewicht, danach ligaweiter Rang über eine Tabelle (`lib/player-formulas/discipline-rating-engine.ts`, `references/formulas/rank-to-discipline-stat.json`). Ein Attribut-Aufschlag darf die Rangliste **nicht** neu rechnen, sonst verschieben sich fremde Spieler. Sauber ist nur ein flacher Eignungszuschlag `Δeig = Σ Δattr × Gewicht/100`. Genau so rechnet der Motor schon `eigHebung()` und `eigMutator()` (`gewichtet(a+Δ,W) − gewichtet(a,W)`).
2. **Legacy-Wertung** (`lib/lineups/legacy-score-engine.ts`):
   - Kette: Fatigue/Verletzung → Moral → Form → Captain ×1,5 → `mutatorBonus` flach → Formkarten.
   - Vorbild für den neuen Schritt `ausruestungBonusByPlayerId` ist `mutatorBonusByPlayerId`.
3. **Motor:** `buildArenaTeam` (`lib/foundation/battle-arena/arena-kader-adapter.ts`) liefert `d` und `a`. Form, Moral und Verletzung wirken heute schon nur im Adapter, ohne Änderung am Motor. Alle Wege laufen dort durch: Host, Chromium- und Node-Runner, Pods, `arena-eingabe-hash.ts`.
   - **Folge:** Die Attributwirkung kommt im Adapter ohne Motoränderung aus, steht automatisch im Eingabe-Hash, und GESAMT bleibt gleich.
   - Effekte je Spieler reisen im Aufstellungseintrag, nach dem Muster `waffen`.
4. **Kappung:** `scaleArenaPlayerByMultiplier` kappt auf 0..100, der Motor an vielen Stellen auch. Ob die Rezepte mit `a > 100` sauber rechnen, ist offen und wird in Phase 0 mit einer Sonde geprüft.
5. **Gebäude:** `FACILITY_CATALOG` hat 5 Stufen und keine Bauzeit. `FacilityId` ist ein Union-Typ, erschöpfende Maps müssen mitgezogen werden. Die Gebäudeseite ist noch im alten Stil.
6. **Vorstand:** `berechneVorstandBudgetStand` rechnet aus dem Verlauf (`transferHistory` + `facilityEvents`). Ausrüstungskäufe, Reparaturen und Schmiede kommen in `ausgegebenTransfer`, Verkaufserlöse in `verkaeufe`, wo die Quote schon greift. Vorbild für die harte Sperre: `pruefeGebaeudeGegenVorstandFreigabe`.
7. **Stempel-Muster:** Wechselliste je Saison wie `lib/resolve/breaking-format.ts`. Die Lade-Migration hängt in der Kette `save-repository.ts`, gesetzt wird in `new-game` und beim Saisonwechsel (`preseason-workflow-service.ts`).
8. **Delegation:** `DelegationBereich` kennt kein „ausruestung“, der Compiler erzwingt den neuen Eintrag. Vorbild: `ai-reha-bau-service.ts`.
9. **Form-Rückkopplung:** `advancePlayerFormState` vergleicht mit `baseValue`. Ohne Bonus in `baseValue` bekämen Träger einen doppelten Vorteil.
10. **Ruhm gibt es im Code nicht.** Er ist eine neue Währung.
11. **Schreibweg** nach der Vorlage `app/api/finance/vorstand/route.ts` (`authorizeServerRoomWrite`, `resolveAuthoritativeWriteOwnerId`).

**Eine Wahrheit:** Die reine Funktion `ausruestungWirkung(gameState, teamId, playerId, disciplineId, matchdayId) → { attributDelta, eignungDelta, zerlegung }` speist alle Abnehmer:
- Legacy-Wertung, Einsatzliste, Vorschau und Auflösung nehmen `eignungDelta` als flachen Schritt.
- Der Adapter legt `attributDelta` auf `a` und `eignungDelta` auf `d`, jeweils nach Form/Moral.
- Ein Test sichert die Gleichheit von TypeScript und Motorformel über alle 20 Disziplinen.

## B. Phasen

Jede Phase ist einzeln mergebar und abschaltbar. Ein Regel-Stempel gilt für alle Phasen:

```ts
// seasonState.ausruestungRegel (lib/ausruestung/ausruestung-regel.ts), nur Battle-Spielstände
{ seasonId, wechsel: [{ ab: matchdayId|null, besitz: boolean, wirkung: "keine"|"attribute",
                        schmiede: 0|1|2|3|4|5, effekte: "aus"|"pilot1" }] }
```

- Schalter nur auf dem Server: `OLY_AUSRUESTUNG=aus|besitz|attribute|schmiede|effekte`.
- Notbremse `…=aus-sofort`.
- Gebuchte Spieltage behalten ihre Stufe.

| Phase | Umfang | Wertung | Größe |
|---|---|---|---|
| **0** | Konzept auf `main` (PR #1687). Messgerüst `scripts/miss-ausruestung-spiegel.mjs --node`: Spiegelkader, gepaarte Saaten, Rauschboden. Sonde `a` bis 130 in allen 20 Disziplinen. Spielstandgröße als Grundlinie. | keine | S |
| **1a** | `lib/ausruestung/*`: Katalog (8 Familien, 12 Attribute, Materialien), Affix-Würfel (Saat), Lager 16, Ruhm, Truhen Holz/Eisen/Gold (Funde vor der Wahl gespeichert), Zerlegen, KI, Sicht (fremdes Lager nicht in der Nutzlast), Delegationsbereich `ausruestung`, Route, neue Seite `AusruestungModern`. Besitz in `gameState.ausruestung` (oberste Ebene, unter 40 KB je Spielstand üblich). | unberührt (Wächtertest byte-gleich) | M–L |
| **1b** | Gebäude Schmiede und Handelsposten (Stufen 1–2 aktiv), Händler, Verkauf (25–40 %, Erlös unter der Quote), Finanzposten „Ausrüstung“, `pruefeAusruestungGegenVorstandFreigabe`, KI-Bauregel. | unberührt | M |
| **2** | Ausrüsten (2+1, höchstens eins je Familie), `ausruestungWirkung` in Legacy und Adapter, Verbrauchsteile, Verschleiß 5 % je Einsatz, Reparatur in Cash plus Auto-Reparatur, Auto-Ausrüsten (gierig, keine Suche), Sperre mit der Einsatzliste, Einsatzzeilen als Quelle der Wahrheit (am Saisonende verdichtet), Anzeige in Vorraum, Auflösung und Finanzen. | GESAMT gleich; neue Summe `AUSRUESTUNG-ATTR` außerhalb; Messung der Siegquote je Stufe | L |
| **3** | Schmiede komplett: Bauplan, Glück (Stufe sicher), Affix-Handwerk, Legendär I→III nur über Material, KI-Wunschliste. Episch/Legendär ohne Motor-Effekt werden ehrlich als „Effekt ab Pilot“ markiert. | wie 2 | M |
| **4** | Effekt-Pilot im Motor: `effektZuenden`-Tor, Pilot Beißholz, Daumenschraube, Enterhaken (Climbing Canyon), Sprungfedern (Spurt/Takeshi), Schiedsrichterpfeife; Ersatz Fernglas. Aufleuchten über dem Kopf, Zeile im Ticker. | GESAMT ohne Teile byte-gleich; Summe je Effekt außerhalb; **Opus-Review Pflicht** | L |
| **5** | Optik-Rest: Requisiten, Truhen-Effekte. | – | S |

**PixelLab je Phase**, Sparweg, immer mit Stilprobe, `flock`, genau einem POST, `usage.generations` und Eintrag in `quellen.json`:
- 1a: etwa 52 (Familien- und Material-Icons, Holz- und Goldtruhe);
- 3: etwa 15 (Legendär-Icons);
- 4: etwa 15 (Requisiten und Effekte);
- danach der Rest.

**Messkorridore** (Siegquote bei Spiegelkadern, W + ½U):

| Stufe | Ziel |
|---|---|
| Standard | 50,5–52 % |
| Selten | 52–54 % |
| Episch | 54–57 % |
| Legendär | 57–62 % |

- Über 65 % gilt als übermächtig.
- Zwei gleiche Legendäre bringen höchstens das 1,8-Fache von einem.
- Standard und Selten werden als „typischer Kader“ gemessen, nicht je Teil, weil das Rauschen sonst zu groß ist.

## C. Entscheidungen (PM, 22.11.)

| # | Frage | Entscheidung |
|---|---|---|
| 1 | Effekte für epische und legendäre Familien-Teile? | Familien-Legendär **ist** Effekt-Legendär: ein System, keine drei parallelen. Bis Phase 4 droppen Truhen nur Material, Standard und Selten; Episch und Legendär entstehen erst mit Phase 3/4. |
| 2 | Wo steht der Bonus in der Kette? | Flach **nach** dem Captain (Muster Mutator). Der Captain verdoppelt also keine Ausrüstung. Bei „verletzt in dieser Disziplin, 50 %“ wird der Bonus mit halbiert (Chris: 50 % von Eignung bzw. Score). |
| 3 | Kappung über 100 | Phase 0 misst. Rechnen Rezepte bei `a > 100` falsch, bleibt `a` bei 100 gekappt und der Überschuss geht nur über `eignungDelta`. |
| 4 | Einsatzzeilen als Quelle für gebuchte Spieltage | Ja (gezeigt = gebucht, auch rückwirkend). |
| 5 | Speicherort, Reset-Werkzeug | `gameState.ausruestung` auf oberster Ebene. „Reset auf Saisonstart“ stellt den Ausrüstungsstand vom Saisonstart wieder her (Schnappschuss beim Saisonwechsel). |
| 6 | Ruhm in Phase 1 | Nur Duellpunkte, erster Disziplinsieg des Spieltags und Platzierung. Derby, Wimpel und Wochenziel kommen später. |
| 7 | Teile und Affix-Quoten | Teile sind ein Zähler, kein Lagerplatz. Quoten: 60 % bevorzugt, 20 % zweischneidig, 15 % eingeschränkt, 5 % Pflege. |
| 8 | Bauzeit | Keine, sofort wie die übrigen Gebäude. |
| 9 | Handelsposten-Kosten | Er dient dem **Zugang** (mehr und seltenere Angebote, Vorbestellung), nicht dem Gewinn. Kosten im unteren Bereich des Gebäudekatalogs (Stufe 1 etwa 2–3 C, Stufe 5 etwa 10–12 C). Die KI baut ihn nach Identität bzw. Bedarf, nicht wegen Erlösen. |
| 10 | Delegation | Händlerkäufe, Reparatur und Ausrüsten gehören zum Bereich `ausruestung`. Halbautomatik (Ramona) = KI. |
| 11 | Modus | Nur Battle-Spielstände, Manager-Modus ohne Ausrüstung. |
| 12 | Kaderstärke und Ränge | Ohne Ausrüstung (reine Eignung). Einsatzliste und Vorraum zeigen den Bonus getrennt als „+x Ausrüstung“. |
| 13 | Folgegrößen | Form-Erwartung `baseValue` mit Bonus. Die Marktwert-Fortschreibung wird um den Bonus bereinigt. PP bleiben, wie gespielt (Leistungsmaß). |
| 14 | Verkauf oder Vertragsende des Trägers | Teile zurück ins Lager. Ist es voll, werden sie automatisch zu Teilen zerlegt, mit Nachricht im Postfach. |
| 15 | Host-Kader je Disziplin | Ja, der Host rechnet den Kader je Disziplin (nötig für eingeschränkte Affixe). |
| D | Maske | Gestrichen (widerspricht „im Vorraum offen“). Händler nur als Symbole (Figuren gesperrt). „Gummistiefel“ ersetzt durch Sprungfedern. |

## D. Risiken

- Rezepte bei `a > 100` (Phase 0).
- Rauschboden für Standard und Selten.
- Ruhm als neues Wirtschaftssystem.
- Format-Abhängigkeit der Effekte (Canyon/Standard, Tag-Team/Gauntlet).
- Bahn-Pod gegen Duell bei Takeshi und Spurt.
- Sichtfilter im Mehrspieler.
- Verlauf ohne Verdichtung wächst.

## E. Reihenfolge

1. Phase 0 + 1a
2. Phase 1b
3. Phase 2 (Messung)
4. Phase 3
5. Phase 4 (Opus-Review)
6. Phase 5

Jede Phase bekommt ihren Mockup-Abgleich bei 1920 und 2560 (CLAUDE.md „Jeder Bau“).
