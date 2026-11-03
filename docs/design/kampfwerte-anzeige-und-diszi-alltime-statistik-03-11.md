# Kampfwerte-Anzeige geprüft + Konzept „All-Time-Diszi-Statistik je Spieler" (03.11.)

Reine Recherche, nichts implementiert. Zwei Aufträge von Chris:

1. „du wolltest noch fable schauen lassen ob die stats die angezeigt werden noch aktuell sind mit ATK DEF DMG etc."
2. „ich hätte gerne wenn ich links in den kader klicke oder an anderer stelle eine übersicht über die stats des
   spielers in der disziplin […] quasi ein all time spezifisch zur diszi mit den relevanten stats + PPs"

---

## Teil 1 — Sind die angezeigten Kampfwerte noch aktuell?

### Wo überhaupt Kampfwerte angezeigt werden

Im React-Teil **nirgends**. `PlayerHeroNewLook.tsx` zeigt MW/Gehalt/Vertrag + Achsen-Radar,
`FoundationPlayerPortraitCard.tsx` zeigt PP je Achse (POW/SPE/MEN/SOC) + Ränge. `DisciplineStageNativeArena.tsx`
/ `arena/disciplines/duelhp.tsx` leiten „Schaden" kosmetisch aus dem Score ab (dort ausdrücklich als Deko
kommentiert, fließt in keine Wertung). ATK/DEF/DMG-artige Werte gibt es ausschließlich im Mockup-Motor
`public/mockups/battle-mode.engine.js`: im Entwurf-Board (`renderBoard()`, je gesetztem Kämpfer die Zeile
„Leben · Angriff · Minderung · Tempo · Ausdauer · Mana"), im Reiter „Spielerprofil" (`renderProfile()`, `#p3`
in `battle-mode.html`) und in den Skill-Chips.

### Befund je Wert (Anzeige gegen den Kampfcode gehalten)

| Anzeige (Board, Z. 37205–37220) | Kampf | Stand |
|---|---|---|
| Leben = LP × 4 | `LEBEN_JE_LP=4`, `hp:s.LP*LEBEN_JE_LP` (38109) | stimmt |
| Angriff = (ANG/50 − 1) % | `angFaktor=ang/50` (38889), `skillSchaden` | stimmt |
| Minderung = VER/(VER+100) | `treffer()`: `roh*sd*(100/(100+z.VER))` (38315) | stimmt |
| Ausdauer = AUS × 2, Mana = MANA × 2 | `vorrat=(w)=>Math.round(w*2)` (7380), `MANAREZEPT` 45/35/20 | stimmt |
| „Schaden je Treffer" `dmgOf(ANG,60)` = 12·ANG/50·100/160 | `GRUNDSCHLAG.basis=12` + `treffer()` | stimmt |
| **Tempo = ((40+TMP·1,4)/110 − 1) %** | Bewegung seit Klassenkarten: `(KARTEN_SPD.fuss+TMP*KARTEN_SPD.je)` = 86,7 + 0,467·TMP (38942, 40377). Kommentar 40363: „Vorher: 40 + TMP*1,4" | **veraltet** — Board zeigt die dreifache Spreizung: TMP 99 = +62 % statt +21 %, TMP 10 = −51 % statt −17 % |
| **Tempo-Tooltip „Tempo verkürzt KEINE Abklingzeit"** (37217) | `cdKuerzung=0.30*TMP/(TMP+120)` ist seit 04.09. (Chris: „mach die schlagfrequenz vom tempo abhaengig") wieder aktiv, `abkling()` wird in 39864/40492/40553 benutzt | **falsch** — `renderProfile()` (37805–37812) wurde damals nachgezogen, das Board nicht |
| **Skill-Chip „Abklingzeit … fest aus dem Kit — Tempo verkürzt sie nicht"** (37297) | dito | **falsch**, gleicher Grund |
| **Heiler-Badge „12·(ANG/50)·0,9 Heilung"** (37310) | `HEILUNG={basis:16,cd:1,castzeit:1}` (38921), Heilung = `e.basis*angFaktor` (39917) | **veraltet** — `gegnerVorschau()` wurde korrigiert (Kommentar 37433: „Vorher standen hier 12 und 0,9 — Zahlen aus einer Fassung, die es nicht mehr gibt"), das Badge nicht |

### Der strukturelle Punkt: das Board zeigt den Rohentwurf, nicht die Kampfwerte

`renderBoard()` ruft `stats(p,disc)` auf (36516: reines Rezept-Mischen der zwölf Attribute). Der Kampf baut die
Einheit aber über `baueEinheit()` (38065 ff.): erst Slot-/Form-/Mutator-Aufschlag auf die Attribute
(`mitAufschlag`), dann `aufEignung(stats(...), eigWert)` — die Skalierung, die LP/ANG/VER proportional zur
Eignung macht („Rezepte geben die FORM, die Eignung gibt die MENGE", 8630 ff.). Nur bei Eignung exakt 50
stimmen Board und Kampf überein. Mit den Motor-Formeln nachgerechnet
(`scratchpad/skalierung.mjs`):

| Fall | Board zeigt | Kampf rechnet |
|---|---|---|
| LP 75 / VER 60 / ANG 70, Eignung 80 | Leben 300, Angriff +40 %, Minderung 38 % | Leben 365, Angriff +70 %, Minderung 42 % |
| dieselben Werte, Eignung 30 | Leben 300, +40 %, 38 % | Leben 241, +13 %, 33 % |
| LP 40 / VER 30 / ANG 45, Eignung 40 | Leben 160, −10 %, 23 % | Leben 254, +43 %, 32 % |

Dasselbe gilt für die Skill-Chip-Schadenszahlen (37287, `s.ANG` unskaliert) und für `renderProfile()`
(`stats(p,"tdm")`). Chris' Lesart „Leben 300 heißt er hält 300 aus" ist auf dem Board also nur für
Durchschnittsspieler richtig; genau die Stars (hohe Eignung) werden zu schwach gezeigt.

### Tote / hartkodierte Stellen

- `renderList()` 37058: `r.title = p.c+" · "+p.r+" · Bollwerk · Standhaft, Deckt"` — für **jeden** Spieler
  derselbe Persönlichkeits-Text, obwohl `persOf[p.n]` längst abgeleitet wird (`leitePers`).
- `battle-mode.html` `#p3` 480–482: „Persönlichkeit Bollwerk / Wachstum Ausgeglichen / Neigungen Standhaft ·
  Deckt · Spät stark" hartkodiert; 496–509 „Laufbahn" mit Beispielzahlen (18 Einsätze, 31 Ausschaltungen,
  8.412 Schaden …), immerhin mit `class="honest"`-Hinweis beschriftet.

### Empfehlung Teil 1 (später, nach Freigabe — alles reine Anzeige, kein Motor-Eingriff)

1. Eine Funktion `kampfwerteFuer(p, disc, slot)` im Motor, die exakt den Pfad aus `baueEinheit()` bis `sMod`
   fährt (Aufschläge + `aufEignung`), und `renderBoard()`/`renderProfile()`/Skill-Chips/Heiler-Badge lesen nur
   noch daraus. Eine Quelle, keine zweite Rechnung — genau die Lehre aus 37799–37803 („Wer eine Zahl anzeigt,
   die der Kampf nicht führt, erklärt nichts — er lügt präzise").
2. Tempo im Board über `tempoProzent()` auf `KARTEN_SPD` umstellen + „kürzt Abklingzeit um X %" wie in
   `renderProfile()`; die beiden „Tempo verkürzt nicht"-Texte streichen.
3. Heiler-Badge aus `HEILUNG.basis`/`HEILTAKT` rechnen (wie `gegnerVorschau`).
4. `renderList`-Title aus `persOf`/`PERS[..].l` statt Festtext; `#p3`-Laufbahn durch echte Daten ersetzen (Teil 2).

---

## Teil 2 — All-Time-Diszi-Statistik je Spieler

### 2.1 Welche Rohdaten gibt es schon?

| Ebene | Wo | Was je Spieler × Disziplin |
|---|---|---|
| je Spieltag (laufende Saison) | `seasonState.playerDisciplinePerformances` (`PlayerDisciplinePerformanceRecord`, olyDataTypes 2693) | `baseValue`, `finalPlayerScore`, `scoreContribution`, `rankInTeam`, **`rankInDiscipline`** (ligaweit), `isTop10`, `isMvpCandidate`, `mutatorHits` — PP dazu über `buildSeasonPointsLedger().pointEntries[].points` |
| archiviert je Saison | `seasonSnapshots[].playerPerformances[].disciplineBreakdown[]` (3045) | `appearances`, `totalContribution`, `averageContribution`, `averageFinalScore` + seit 15.10. **`laufbahn`**: `starts, siege, podien, rangSumme, bestRang, bestWertung, spielerDesSpieltags, verletzungen` |
| Leser (eine Rechenstelle) | `lib/season/player-discipline-laufbahn.ts` `buildPlayerDisciplineLaufbahn()` | laufende Saison live gefaltet + Schnappschüsse gemerged (`mergeLaufbahnCounters` summiert auch **unbekannte** Schlüssel) |
| All-Time je Disziplin | `lib/foundation/player-all-time-discipline-stats.ts` | Punkte, Einsätze, PP/Einsatz, Saisons — je Disziplin UND je Bereich |

**Was es NICHT gibt: disziplinspezifische Einzelwerte.** Der Motor führt sie (Kampf: `u.st.{dmg,heal,tank,
verh,ko,koAnteil,cc,schild,tode,beihilfe,gegen}` 38116; Feldspiel: Punkte/Rebounds/Assists/Steals/Blocks/FG;
Bühne: `summe/runden/duellGewonnen`; Battlefield-Pod gibt sogar `ko/down/erob/amOrt` zurück, 55135), aber die
Schnittstelle zum Spielstand ist `RoherBrowserBoxscoreEintrag = {name, wert, torwart?}`
(`arena-headless-runner.ts` 550) → `ArenaFixtureBoxscoreEintrag` → ein skalarer `finalPlayerScore`. Genau das
hatte `docs/design/disziplin-laufbahn-q2-15-10.md` Abschnitt 2 schon festgestellt; es gilt unverändert.

**Zweiter Haken:** TDM steht **nicht** in `ARENA_RESOLVED_DISCIPLINE_IDS` (`lib/battle/arena-resolved-
disciplines.ts`; angeschlossen sind Basketball, Gewichtheben, Hockey, Speed-Schach, Showcase, Eiskunstlauf,
Breaking, Wettessen, Tennis, Fechten, Staffel, Takeshi, Time-Trial, Spurt, Climbing, I-Spy, dazu Mini-DM/
Battlefield-Pods). TDM-PPs kommen in Produktion aus dem PPS-Pfad — es gibt heute keinen TDM-Boxscore, aus
dem man Kills zählen könnte, nur im Entwurf-Board.

### 2.2 Gibt es schon eine ligaweite Rangliste nach Disziplin-Kennzahl?

Ja, nach **PP je Disziplin** — nein, nach einer Spielkennzahl (Kills, Rebounds …):

- `buildDisciplineGlobalRankMaps()` (`lib/foundation/player-detail-drawer.ts` 763): je Disziplin drei
  Rangkarten — Eignungswert, Saison-PP, All-Time-PP. Angezeigt im `PlayerDetailDrawer` („Top Disziplinen",
  Saison-/All-Time-Rang), serverseitig über `player-discipline-rank-service.ts` nachgereicht, weil der
  kompakte Browser-Payload die Vergleichsbasis beschneidet (Bug `uzetn6`, `l4835p`).
- All-Time-Tabelle (`app/foundation/all-time-table-v2`, Quelle `buildPlayerAllTimeDisciplineStats`): Filter je
  Disziplin/Bereich, Sortierung nach Punkten / Einsätzen / PP je Einsatz — eine Liste, aber **kein Rang als
  Zahl am Spieler**.
- Rekordbuch (`league-record-book.ts`): Einzelspieltag-Superlative über `finalPlayerScore`, keine Rangliste.
- League Leaders (`league-leaders-service.ts`): nur `pps/pow/spe/men/soc/ovr/mvs/training/mostImproved`.

Aufwand: Rang live aus Schnappschüssen + Ledger ist genau das, was `buildDisciplineGlobalRankMaps` heute für PP
schon tut (O(Spieler × Disziplinen), am Live-Save ~400 × 20). Für jede weitere Kennzahl ist es derselbe
Fold über einen anderen `laufbahn`-Schlüssel — kein neues Muster, kein Cache nötig; nur der Weg Server →
Browser muss wie beim Rang-Override laufen (dünn besetzt, nur der angezeigte Spieler).

### 2.3 Sinnvolle Kennzahlen je Chassis (3–5, neben Einsätze / PP / PP je Einsatz / Ø Rang)

| Chassis | Disziplinen | Kennzahlen (alle aus `u.st`/Scoreboard-Spalten `WERTUNG_CHASSIS`, 40713 ff.) |
|---|---|---|
| Kampf/Arena | TDM, Mini-DM, Fechten, Battlefield | Ausschaltungen (`ko`), Schaden (`dmg`), Geheilt+Schild (`heal+schild`), Verhindert (`verh`), Tode → K/D; Battlefield zusätzlich Eroberungen (`erob`) |
| Feldspiel | Basketball, Hockey, Football | Punkte/Tore, Assists, Rebounds/Abpraller, Steals+Blocks, FG % (Hockey-Torwart: Paraden, Gegentore, Fang %) |
| Bahn | Spurt, Staffel, Time-Trial, Climbing, Takeshi | Bestzeit, Ø Platz, Siege, Podien (Staffel: Wechselverlust) |
| Bühne-Duell/Heben | Gewichtheben, Tennis, Breaking, Wettessen, Speed-Schach | Duelle gewonnen/verloren, beste Last/Summe, Treffer für/gegen |
| Bühne-Auftritt | Showcase, Eiskunstlauf, I-Spy | Bestwertung, Ø Wertung, Siege, Podien |

Bahn und Bühne-Auftritt sind mit den **heutigen** `laufbahn`-Zählern (`siege, podien, bestRang, bestWertung`)
schon fast abgedeckt; die Lücke liegt bei Kampf und Feldspiel.

### 2.4 Vorschlag: Klick-Ziel, Darstellung, Datenfluss

**Stufe A — ohne Motor-Änderung, sofort machbar (alle Zahlen existieren).**

- *Klick-Ziel:* die Kaderzeile links im Entwurf (`renderList()` `prow`, Klick setzt heute nur `sel`). Der
  Motor feuert zusätzlich `window.dispatchEvent(new CustomEvent("oly-arena:spieler",{detail:{playerId}}))` —
  dieselbe Brücke, die `oly-arena:ende` schon nutzt (`FoundationBattleArenaHost.tsx` 992 ff.); `ArenaSpieler.id`
  fährt seit Boxscore-an-PPs ohnehin durch `window.__olyArenaKader` mit. Der Host ruft
  `openDrawerPinned({kind:"player", playerId})` wie `DisciplineStageTopPlayers` es tut.
- *Darstellung:* der bestehende `PlayerDetailDrawer` mit dem Laufbahn-Panel (Q2) — neu nur ein Prop
  `initialLaufbahnDisciplineId`, damit das Panel der **aktuellen** Disziplin schon aufgeklappt ist, plus ein
  „Diszi-Steckbrief" oben im Panel: Einsätze · PP gesamt (**Rang ligaweit**) · PP je Einsatz (**Rang**, mit
  Mindest-Einsätzen, z. B. ≥ 3) · Siege · Podien · bester Rang · beste Wertung. Alles aus
  `buildPlayerAllTimeDisciplineStats` + `buildDisciplineGlobalRankMaps` (letzteres um eine Rangkarte „PP je
  Einsatz" ergänzt, dünn über `player-discipline-rank-service.ts` nachgereicht wie die beiden heutigen).
- *Weitere Klick-Ziele mit derselben Komponente:* Top-3-Vorschläge im Slot (`slotvorschlag`, gerade erst
  gebaut) und die Spielerliste im Season-Flow — kein zweiter Code.

**Stufe B — Motor-Ausgabe erweitern (nach Freigabe, ein PR je Chassis).**

1. `RoherBrowserBoxscoreEintrag` bekommt optional `zaehler?: Record<string, number>`, gefüllt **aus den
   Spaltendefinitionen** `WERTUNG_CHASSIS[..].spalten[].wert` — dieselbe Quelle wie das Live-Scoreboard,
   keine zweite Rechnung. `arena-headless-runner.ts` reicht es als Passthrough durch.
2. `PlayerDisciplinePerformanceRecord.zaehler?` additiv und optional (Muster `mutatorHits`, `momente`),
   geschrieben im Resolve-Apply, je Spieltag wholesale ersetzt (idempotent wie heute).
3. Beim Saisonabschluss in `laufbahn` falten — `mergeLaufbahnCounters` summiert unbekannte Schlüssel
   bereits, `finalizeLaufbahnCounters` braucht nur die Summenschleife. Ranglisten je Schlüssel = derselbe Fold
   wie 2.2.
4. Ehrlicher Leerzustand: Disziplinen ohne Zähler (TDM bis zum Anschluss, alte Schnappschüsse) zeigen „noch
   nicht erfasst", nie 0 — wie Q2 es vorgibt.
5. Speicher: ~5 Zahlen × 2 Disziplinen × ~400 Spieler × ~10 Spieltage ≈ 40 k Zahlen je Saison in
   `playerDisciplinePerformances`, danach nur noch die Saison-Summe im Schnappschuss.

**Abgrenzung zu CLAUDE.md:** Beide Stufen sind reine Anzeige historischer Buchungen. `MOTOREN[..].wert()`,
`ppAusSpielerScore`, die Eignungsmatrix und jedes Rezept bleiben unberührt — rho und Pp-Abweichung ändern sich
nicht (keine Messung nötig, keine neue Mechanik). Ein Risiko gibt es trotzdem: Stufe B macht Zähler sichtbar,
die der Motor **nicht** bepreist (Kills ≠ PP, Tempo ist in TDM Matrixgewicht 0). Das Panel sollte deshalb PP
und Zähler getrennt beschriften („PP = Wertung, Zähler = was passiert ist"), sonst entsteht genau die Frage
„warum bekommt mein Kill-Leader so wenig PP", die die gesperrte Matrix nicht beantworten darf.
