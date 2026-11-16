# Strategie-Vorlagen je Disziplin — Konzept (Fable, 16.11., Task #168)

**Reines Konzept. Kein Code, keine Flag, keine Messung.** `engine.js` meint
`public/mockups/battle-mode.engine.js` im Worktree-Stand vom 16.11.; alle Zeilennummern sind dort
nachgeschlagen, nicht aus älteren Papieren übernommen. rho- und Pp-Zahlen stammen aus
`data/generated/disziplin-abnahme.json` (Stand 15./16.11.), nicht neu gemessen. Alle Schwellen in
Abschnitt 2 sind **Startwerte für eine Kalibrierung**, keine Empfehlung.

**Verhältnis zu den Vorgängern.** Das Thema ist zweimal vorbereitet:
`taktik-grundeinstellung-konzept-26-10.md` (Opus, sieben Regeln, alle zwanzig Disziplinen) und
`fable-kontakt-interaktionen-16-11.md` Abschnitt 7 (Recherche FM/NBA 2K/PCM, UI-Skizze). Dieses
Papier wiederholt beide nicht, sondern legt fest, was daraus **gebaut** würde: aktuelle
Fundstellen, aktuelle Puffer, Datenmodell, Zuruf-Lösung, Messplan, Pilot. Wo es von den Vorgängern
abweicht, steht das ausdrücklich da (Abschnitt 1.3).

---

## 1. Leitidee und Abgrenzung

### 1.1 Was eine Vorlage ist

Eine **Strategie-Vorlage** ist ein benanntes Bündel von **Entscheidungs-Verschiebungen** für eine
Mannschaft in einer Disziplin an einem Spieltag. Sie ändert, *was* die Spieler tun (welche Aktion,
wann, gegen wen, wie oft), nie *wie gut* sie es tun. Drei Stufen je Disziplin — defensiv, neutral,
offensiv — mit disziplineigenen Namen; eine vierte nur dort, wo der Motor eine echte vierte
Entscheidung hat (z. B. „Konter" im Battlefield).

Die Prüffrage aus dem 26.10. bleibt die Eintrittskarte: **Lässt sich die Wirkung als „+x auf
Attribut y" schreiben, ist es keine Vorlage.** Jede Verschiebung zahlt in einer zweiten Währung
(Zeit, Reserve, Position, Fehlversuchs-Risiko, Uhr).

### 1.2 Was eine Vorlage nicht ist

| Vorhandenes | Fundstelle | Warum keine Vorlage |
|---|---|---|
| **Intensität** Schonen/Normal/Vollgas | `LineupDraftModifierSide.intensity` (`lib/data/olyDataTypes.ts:3882`), Knöpfe in `LineupNewLook.tsx:1662-1692`; im Motor `INTENSITAET` (`engine.js:8748`) | Wert-Zuschlag plus Ermüdung. Kraft-Achse, nicht Spielweise. Keine Vorlage darf „Push" oder „Vollgas" heißen. |
| **Slot-Rolle** | `place[name].slot` über `buildArenaAufstellung` (`lib/foundation/battle-arena/arena-aufstellung-adapter.ts:86ff.`), `SLOT_ZUSATZ` (`engine.js:8347`) | Geht in `eig` (Slot-Zuschlag) und bestimmt Position/Aufgabe je Spieler. Bleibt unverändert die Ebene darunter. |
| **Formkarten, Mutatoren, Team-Power** | `zieheFormkarten` (`engine.js:8755`), `primaryFormCardId`/`mutatorTrait*` im selben Modifier-Objekt | Wert-Kanäle. |
| **Persönlichkeit** | `leitePers` (`engine.js:37391`), `PERSDEF` (`7931`) | Eigenschaft des Spielers, nicht wählbar. Die Vorlage verschiebt sie, ersetzt sie nicht (Abschnitt 5). |
| **Kulisse / Format** | `kulisseByDisciplineId`, `spurtFormatWaehlen` (`engine.js:49674`) | Wird vom Spielplan gebucht, nicht vom Manager gewählt. |

### 1.3 Vier Festlegungen, die über die Vorgänger hinausgehen

1. **Neutral heißt: Feld fehlt.** „Neutral" ist kein Parametersatz mit lauter Nullen, sondern die
   Abwesenheit des Feldes. Der Motor liest dann keine einzige neue Stelle und zieht keinen neuen
   Wurf. Nur so ist „bit-identisch" beweisbar statt behauptet (Abschnitt 6.1).
2. **Der Live-Zuruf ist im Saisonspiel eine vorab gesetzte Wenn-dann-Anweisung, kein Klick.**
   Spieltage werden headless vorab gebucht (`lib/battle/arena-headless-runner.ts`) und danach mit
   `nurZuschauen` gezeigt (`engine.js:7367`, Host `FoundationBattleArenaHost.tsx:893`). Ein Klick
   während des Zuschauens kann das gebuchte Ergebnis nicht mehr ändern. Lösung in Abschnitt 4.2:
   echte Live-Chips in der Battle Arena (Testwerkzeug), „Zuruf-Plan" im Saisonspiel.
3. **Eine Vorlage ist eine eigene abzunehmende Variante — einzeln, nicht in der Mischung.** Lehre
   aus Spurt-Hatz (Pp 25,1 allein, Mischung bestanden; `arbeitsplan-16-11.md` W2).
4. **Vier Disziplinen bekommen vorerst keine wirksame Vorlage**, weil der Puffer fehlt: Hockey
   (rho 0,700), I-Spy (0,776), Showcase (0,781), Climbing (0,801). Dort ist der Wähler sichtbar,
   aber ausgegraut mit Begründung. Das ist ehrlicher als drei Vorlagen, von denen keine gemessen
   bestehen kann.

---

## 2. Katalog je Chassis

**Lesart der Spalte „Stand":** **V** = Verhaltensparameter existiert und ist scharf, es fehlt nur
der Zugriff des Managers · **N** = Parameter existiert, die Team-Verschiebung ist klein
nachzurüsten · **M** = Entscheidungspfad fehlt, eigene Mechanikrunde nötig · **—** = vorerst nicht
bauen. **Puffer** = rho je Spiel · Pp beider Saatströme · Abstand zur 25er-Schranke.

### 2.1 Bahn

Gemeinsamer Hebel: der **Rennplan**, reine Zahlen `tempo` (Grundtempo vor dem Angriffspunkt),
`sucht` (Windschatten-Suche), `ab` (Angriffspunkt 0…1), je Tick neu gelesen (`tempoVon`
`engine.js:50659`), heute fest je Slot (`planJeSlot`). Der Wechsel mitten im Rennen ist gebaut
(`planWechsel` `50766`, `rennplanAnsagen` `56712`), im Zuschau-Modus aus (`rennplanMoeglich`
`56693`). Zweiter Hebel: die **Rempel-Neigung** `willTackeln` je Persönlichkeit (`52309`) mal
`tackleRate`, Schwelle `tackleAb`.

| Disziplin | Defensiv | Neutral | Offensiv | Parameter und Fundstelle | Stand | Puffer |
|---|---|---|---|---|:-:|---|
| **Spurt** | „Sauber laufen": Plan je Läufer eine Stufe Richtung `schatten` (tempo 0,94 / sucht 0,90 / ab 0,78); `willTackeln` × 0,5 | `planJeSlot` wie heute | „Ellbogen raus": eine Stufe Richtung `vorn` (1,00 / 0,15 / 0,70); `willTackeln` × 1,4 | `plaene` `47146-47153`, `planJeSlot` `47154`, `tackleAb:50, tackleRate:1.0` `47098`, Wurf `52346` | N | 0,876 · 12,9/6,5 · 12,1. **Je Format einzeln** (Hatz 25,1 hat keinen Pp-Raum) |
| **Staffel** | „Stab sicher": Marke und Bein eine Stufe Richtung `absichern` (g 0,6 / s 0,7 / p 0,5) | Persönlichkeits-Automatik wie heute | „Fliegender Wechsel": eine Stufe Richtung `angreifen` (g 1,4 / s 1,3 / p 2,0) | `STAFFEL_MARKE` `50314-50318`, `STAFFEL_PERS_HALTUNG` `50371`, `staffelHaltungenSetzen` `50383` (Modus `ki`/`kader`) | V | 0,924 · 21,6/21,4 · **3,4** (Pp eng) |
| **Takeshi** | „Abstand halten": Plan Richtung `vorsicht` (0,84 / ab 0,80); `willTackeln` × 0,5 | wie heute | „Räumen": Richtung `wild` (1,00 / ab 0,50); `willTackeln` × 1,4 | `plaene` `48307-48314`, `tackleAb:30, tackleRate:2.0, tackleFenster:0.05` `48009` | N | 0,838 · 18,9/17,7 · 6,1 (beides eng) |
| **Zeitfahren** | „Gleichmaß" (0,93 / ab 0,75) | `planJeSlot` | „Attacke" (1,00 / ab 0,60) | `plaene` `47421-47434`. Kein Gegnerbezug (Einzelstart). Achtung: Plan-**Label** steht im Ergebnis von `spiele()` und verschiebt den Fingerabdruck (Kommentar `47427-47432`) | N | 0,930 · 12,0/11,6 · 13,0 |
| **Climbing** | „Linie halten": Plan Richtung `sparsam` (0,86 / rastUnter 0,80), kein Zug am Kreuzungsgriff | wie heute | „Runterziehen": Richtung `angriff` (1,00 / rastUnter 0,30), Zug aus größerem Abstand | `plaene` `47771-47778`, Kreuzungsgriffe `47557`, `51748` | — | 0,801 · 12,0/9,5. **Kein rho-Raum.** Chris' eigenes Beispiel vom 26.10.; baubar erst, wenn Climbing wieder Luft hat |

### 2.2 Kampf

Gemeinsamer Hebel: die **Haltung** je Kämpfer, fünf Stufen defensiv…ungestüm (`HALTUNG`
`engine.js:7867`), abgeleitet aus der Persönlichkeit (`PERSDEF` `7931`), manuell übersteuerbar über
`takt[name]` (`behav()` `7971-7973`). Sie wird zu `selb` (Selbsterhaltung) und steuert die
Rückzugsschwelle `hp/max < selb/280` (`41207-41209`). Befehle je Reihe (`ORDERS` `7830`) bleiben
Feinsteuerung darunter.

| Disziplin | Defensiv | Neutral | Offensiv | Parameter und Fundstelle | Stand | Puffer |
|---|---|---|---|---|:-:|---|
| **TDM** | „Linie halten": Haltung aller eine Stufe Richtung `defensiv` (früherer Rückzug) | `PERSDEF` wie heute | „Durchbrechen": eine Stufe Richtung `wild` (späterer Rückzug) | `HALTUNG` `7867`, `behav` `7971`, Rückzug `41207`. **`ZUSAMMEN`/`BINDUNG` (`7868-7869`) nicht anfassen** — gemessene Fehlordnungsquelle (ε² 0,229) | N | 0,839 · 14,6/14,7 · 10,3 |
| **Battlefield** (4-Team-Pod) | „Halten": eigene Orte sichern, kein dritter Ort | wie heute | „Stürmen": früher auf fremde Orte; vierte Vorlage „Konter": erst nach fremdem Angriff ausrücken | `bfffaGefecht` `60034`, `bfffaStartOrt` `59966`, `ARENA_DOMINATION` `9250`. Ortswahl ist heute fest je Slot; die Team-Verschiebung ist neu | M (klein) | 0,874 · 8,2/7,5 · **16,8** (größter Raum im Kampf) |
| **Mini-DM** (FFA) | „Abwarten": setzt Takte aus, solange drei stehen | wie heute | „Nachsetzen": Ziel bleibt der Angeschlagene | `mdffaSchlagwechsel` `61094` | M | 0,80 · 6,8/6,9. rho auf der Kante; FFA mit variabler Kadergröße nicht bestanden. **Nach TDM und Battlefield, nur mit Chris' Ja** (Frage 5 vom 26.10.) |

### 2.3 Feldspiel

| Disziplin | Defensiv | Neutral | Offensiv | Parameter und Fundstelle | Stand | Puffer |
|---|---|---|---|---|:-:|---|
| **Football** | „Ballkontrolle": `pLauf` + 0,10 in allen Distanzklassen; vierter Versuch nur Field Goal oder Punt | wie heute | „Alles oder nichts": `pLauf` − 0,10 (mehr mittel/tief); `go` bei `toGo<=3` statt `<=1` | `waehlePlayCall` `12701-12720` (Lauf-Anteile 0,80/0,68 · 0,38/0,55 · 0,22/0,46 · 0,17/0,28), `waehleVierterVersuch` `12725-12730` (`toGo<=1&&spot<85`) | N | 0,854 · 15,3/16,0 · 9,0 |
| **Basketball** | „Zone zu": Schalter `verteidigung=mann_tief`, `bretter=zurueck`, `angriff=halbfeld` | KI-Vorgabe `berechneTaktikAuto` | „Lauf und Wurf": `angriff=tempo`, `bretter=angreifen`, `verteidigung=mann_eng` | Taktik-Karte `FELDSPIEL_ART.basketball.taktik` `9429ff.` (vier Schalter: angriff, verteidigung, coverage, bretter), `effektiverTaktik` `10917`, `setzeTaktik` `10928`. **Von keiner Mechanik gelesen** (`10887-10888`) | M | 0,822 · 15,6/16,7 · 8,3 (rho eng) |
| **Hockey** | „Riegel": Klären aus der eigenen Hälfte auch vor der Endphase | wie heute | „Forecheck": Check früher gesucht | `hockeyRiegelKlaert` `12110-12114` (heute nur führende Seite in der Endphase), `versucheSteal` `15424` | — | 0,700 · 13,9/21,8. **Kein rho-Raum**, dazu die Zufallskaskade (jede Positionsänderung verschiebt `versucheSteal`) |

Football ist der Feldspiel-Pilot, weil seine Ergebnisse in der Zug-Auflösung entstehen und die
Bewegung Optik ist (keine Positionskaskade). Zusätzlich günstig: `waehlePlayCall` zieht je Aufruf
genau einen Wurf, gleich in welcher Klasse — eine Verschiebung von `pLauf` ändert die **Zahl** der
Würfe nicht, nur ihre Auswertung.

### 2.4 Bühne

Gemeinsames Rohr: `place[name].haltung` → `buehneHaltungVon(p,seite,erlaubt)` (`engine.js:20166`),
Priorität Messvorgabe > Aufstellung > KI-Vorgabe. **Bewegungsvertrag der Bühne:** alle Würfe fallen
vorab in `bauBuehne()` (`20599`), die Darstellung ruft nie `rr()`. Jede neue Bühnen-Entscheidung
muss deshalb vorab entschieden werden — das passt zu Vorlagen, nicht zu Klick-Zurufen.

| Disziplin | Defensiv | Neutral | Offensiv | Parameter und Fundstelle | Stand | Puffer |
|---|---|---|---|---|:-:|---|
| **Speed-Schach** | „Rechnen": Ansage `rechnen` (Zeit × 1,30), Remis früher annehmen | Zeitbudget-Regel wie heute | „Blitzen": Ansage `blitzen` (Zeit × 0,72), Remis ablehnen | `SCHACH_ANSAGE` `20215-20216`, `SCHACH_REMIS_AB_ZUG=8, _SCHWELLE=20, _TEAM_TOLERANZ=1` `20258`, Remis-Zweig `27312-27325`. Scharf (`speedSchachUhr:2` `19968`) | V | 0,904 · 12,1/11,0 · 12,9 |
| **Wettessen** | „Gleichmäßig" | `wettessenKiHaltung` (NERVEN ≥ 60 Schlussspurt, < 45 gleichmäßig, sonst Sprint) | „Sprint"; dritte echte Wahl „Schlussspurt" | `WETTESSEN_HALTUNGEN` `20430`, KI `20448-20455`. Scharf (`wettessenMauer:2`) | V | 0,905 · 8,7/10,0 · 15,0 |
| **Gewichtheben** | „Gültige Versuche": Eröffnungs-Versatz Richtung sicher auch in offener Lage | `hebenTeamLage` wie heute | „Auf Rekord": Wagnis-Fenster auch in offener Lage geöffnet | `HEBEN_TEAM_SICHERN_VERSATZ=0.04`, `HEBEN_TEAM_OFFEN_WAGNIS_FAKTOR=2.0` `21642-21643`, `hebenTeamLage` `21644`, `HEBEN_WAGNIS_MAX_KG=5` `21525` | N | 0,892 · 8,5/10,0 · 15,0 |
| **Breaking** (Folter-Zweikampf) | „Aushalten": provoziert nie, haushaltet für die Kette | Schwelle WAGNIS ≥ 58 | „Reizen": Schwelle 48, das nächste Gerät kommt früher | `GAUNTLET_PROVOKATION_SCHWELLE=58`, `_ERTRAG=0.22` `26738-26739`, Entscheidung deterministisch `26859` | N | 0,860 · 12,5/10,2 · 12,5 |
| **Tennis** | „Grundlinie": sicherer zweiter Aufschlag, lange Ballwechsel | wie heute | „Ans Netz": Risiko-Aufschlag, kurzer Punkt | `tennisAufschlagSeite` `19683`; **keine Risiko-Entscheidung im Motor** | M | 0,885 · 6,2/5,5 · **18,8** (bester Pp-Raum überhaupt) |
| **Fechten** | „Riposte": abwarten, Mensur halten | wie heute | „Drängen": Mensur verkürzen, Angriff | Mensur `FECHTEN_MENSUR_SKALA` `20555`, Gang-Verschiebung `20981-21001`; **keine Entscheidung im Motor** | M | 0,876 · 12,7/13,3 · 11,7 |
| **Eiskunstlauf** | „Saubere Kür": leichteres Programm, weniger Sturzrisiko | wie heute | „Große Sprünge": schwereres Programm | Risiko-Abwägung über WAGNIS im Bühnenkern; Programmwahl als Entscheidung fehlt. Am 26.10. Klasse D bei 5,2 Pp Raum — heute 13,0 | M | 0,927 · 10,6/12,0 · 13,0 |
| **Showcase** | „Sichere Nummer" | wie heute | „Große Nummer" | wie Eiskunstlauf, ohne Gegnerbezug | — | 0,781, nur per Ausnahme gewertet. **Nicht anfassen** |
| **I-Spy** | „Eigene Räume": reagiert nicht auf fremde Funde, sichere Truhen | wie heute | „Jagen": reagiert öfter, schwere Truhen | `ISPY_REAKTION_BASIS=0.30`, `_TEAMGEIST_K=0.006` `25861`, `ispyWaehleRaum` `26309`, `ispySeiteTick` `26330` | — | 0,776, nur per Ausnahme. **Nicht anfassen.** Die Argmax-Raumwahl kostete schon einmal 0,05 rho |

**Grenzfall, offen benannt:** Speed-Schachs Ansage trägt neben der Zeit auch `erfolg ±0,04`. Das
ist ein Tausch Uhr gegen Zugqualität, mit dieser Wirkung abgenommen (rho 0,904), aber es ist die
einzige Stelle im Katalog, an der eine Vorlage eine Erfolgschance berührt. Neue Vorlagen bekommen
so etwas nicht.

### 2.5 Zusammenfassung

| Stand | Disziplinen | Zahl |
|---|---|---:|
| V — sofort, nur Zugriff fehlt | Speed-Schach, Wettessen, Staffel | 3 |
| N — klein nachzurüsten | Spurt, Takeshi, Zeitfahren, TDM, Football, Gewichtheben, Breaking | 7 |
| M — eigene Mechanikrunde | Battlefield, Mini-DM, Basketball, Tennis, Fechten, Eiskunstlauf | 6 |
| — vorerst ausgegraut | Hockey, Climbing, Showcase, I-Spy | 4 |

**Mehrere Wege zum Erfolg.** Jede Vorlage muss einen anderen Sub-Skill zum Hauptweg machen, nicht
denselben lauter: Spurt offensiv lohnt mit WUCHT, defensiv mit TECHNIK/Wendigkeit; Wettessen
Sprint mit Tempo, Schlussspurt mit NERVEN; Football „Alles oder nichts" mit Passspiel,
„Ballkontrolle" mit Laufkraft und Abwehr. Das ist der Knopf-Test (Abschnitt 6.3) — eine Vorlage,
die für den insgesamt besten Kader immer die beste ist, ist ein versteckter Stärkeknopf und fällt
durch.

---

## 3. Datenmodell

### 3.1 Speicherort

Die Vorlage gehört **neben die Intensität**, je Disziplin-Seite eines Spieltags:

```
LineupDraftModifierSide            (lib/data/olyDataTypes.ts:3876-3883)
  primaryFormCardId, secondaryFormCardId, mutatorTrait1/2, teamPowerId, intensity
+ strategie?: string | null        Vorlagen-Kennung der Disziplin, z. B. "ellbogen-raus"
+ zurufPlan?: { wenn: ZurufAnlass; dann: string }[]     höchstens zwei Einträge (Abschnitt 4.2)
```

- **Standard:** Feld fehlt oder `null` = **neutral**. Kein Eintrag „neutral" wird geschrieben.
- **Migration:** keine. Das Feld ist optional in einem JSON-Objekt, das der Spielstand schon
  trägt; alte Stände lesen sich unverändert als neutral. Der Server bleibt einzige Quelle — die
  Vorlage lebt im `LineupDraft` in der SQLite des Servers, nicht im Browser.
- **Katalog als Daten, einmal:** eine Tabelle `lib/lineups/strategie-vorlagen.ts`
  (Disziplin → Vorlagen mit Kennung, Name, Satz, Gegenpreis, Stand V/N/M/—). Die Parameter selbst
  stehen **im Motor** neben den Art-Tabellen; die TS-Tabelle trägt nur Kennung und Texte. Ein Test
  hält beide Listen deckungsgleich (Muster `resolveSlotRoleShortId`: eine Themenliste, zwei
  Kennungen).

### 3.2 Zuordnung: Team, nicht Slot

Die Vorlage gilt je **Team und Disziplin-Seite**. Die Verschiebung je Spieler entsteht im Motor
aus Slot und Persönlichkeit (Abschnitt 5). Eine Wahl je Slot wäre die Einzel-Haltung
(`place[name].haltung`), die es als Rohr schon gibt — sie bleibt als spätere **Übersteuerung** für
einzelne Spieler möglich, ist aber nicht Teil dieses Konzepts.

Rangfolge im Motor: Messvorgabe > Einzel-Haltung des Spielers > Vorlage des Teams (verschiebt um
eine Stufe) > Slot-/Persönlichkeits-Vorgabe (heute).

### 3.3 Übergabe an die Arena

`place` ist nach Spielernamen geschlüsselt und taugt nicht für ein Team-Feld. Die Vorlage reist
deshalb wie die Kulisse im Umschlag `echterKader`:

```
echterKader.strategieByDisciplineId = { "spurt": ["ellbogen-raus", null], ... }   // [Heim, Gast]
Pod-Formate: ein Eintrag je Team in Pod-Reihenfolge (wie aufstellung[] bei Battlefield/Bahn-Pod)
```

Drei Stellen müssen **dieselbe** Funktion aufrufen, sonst läuft gezeigt ≠ gebucht:
`FoundationBattleArenaHost.tsx` (Zweier-Spiel `:878ff.`, Pods `:418`, `:454`, `:513`),
`lib/battle/arena-headless-runner.ts` (`:576-603`, Pods `:932-946`) und die Messskripte. Die
gewählte Vorlage wird zusätzlich **in die Buchung des Spiels geschrieben**, damit eine spätere
Änderung am Entwurf ein schon gebuchtes Spiel nicht umdeutet (dieselbe Lücke wie Spurt-Format,
`arbeitsplan-16-11.md` W3).

Wirkung aufs Ergebnis hat eine Vorlage nur in arena-gewerteten Disziplinen
(`ARENA_RESOLVED_DISCIPLINE_IDS`, `lib/battle/arena-resolved-disciplines.ts:550`). In allen
anderen ist der Wähler ausgegraut.

---

## 4. UI

### 4.1 Einsatzliste (`LineupNewLook.tsx`)

Ort: unmittelbar unter der Intensitäts-Gruppe (`.nl-lineup-intensity`, `:1662`) im Kopf jeder
Disziplin-Seite, als zweite Knopfreihe mit eigenem Namen.

```
 D1 · Spurt (Die Hatz) · 6 Läufer                          ███████░ 5/6 Slots
 Kraft        ( Schonen )  [ Normal ]  ( Vollgas )         312–348
 Spielweise   ( Sauber laufen )  [ Normal ]  ( Ellbogen raus )
 ┌──────────────────────────────────────────────────────────────────────────┐
 │ Ellbogen raus                                                            │
 │ Deine Läufer gehen früher nach vorn und suchen den Rempler.              │
 │ ▲ mehr Rempler   ▲ frühe Führung   ▼ weniger Reserve im letzten Drittel  │
 │ Passt zu:  Haldor, Mira (Wucht)        Riskant für:  Jo (Stehvermögen)   │
 │ Zuruf-Plan:  [ Bei Rückstand nach der Hälfte → Ellbogen raus      ✕ ]    │
 │              [ + Anweisung ]                                             │
 └──────────────────────────────────────────────────────────────────────────┘
```

- **Kein Zahlwert.** Ein Satz Verhalten, Pfeile für das Sichtbare samt Gegenpreis, der eigene
  Kader im Spiegel. „Passt zu / Riskant für" wird aus den Sub-Skill-Rezepten abgeleitet, nicht von
  Hand gepflegt.
- **Die Bandbreite neben der Kraft-Reihe (`312–348`) bleibt nur dort.** Unter „Spielweise" steht
  bewusst keine Projektion — sonst wird sie zum Rechenknopf.
- **Ausgegraut mit Grund:** „In Hockey wirkt die Spielweise noch nicht." Kein stiller
  Platzhalter.
- **Nach dem Spiel:** Anweisungsbilanz im Endstand („Ellbogen raus: 6 Rempler, 4 gesessen, 0,9 s
  bezahlt"). Staffel hat das Muster. Ohne Bilanz ist die Wahl ein Formular.

### 4.2 Live-Zuruf

**In der Battle Arena (Testwerkzeug, `nurZuschauen` aus):** echte Chips je eigener Seite, über dem
Spielfeld neben der vorhandenen Rennplan-/Ansagezeile.

```
 Spielweise   ( Sauber laufen )  ( Normal )  [ Ellbogen raus ]      nächster Zuruf in 8 s
 Rempler 4 · gesessen 2 · bezahlt 1,1 s
```

- **Wirkt an der nächsten natürlichen Stelle**, nie mitten im Tick: Bahn sofort (der Plan wird je
  Tick gelesen, `planWechsel` regelt den Angriffspunkt schon), Feldspiel beim nächsten
  Ballbesitzwechsel bzw. Snap, Kampf mit der nächsten Welle. Bühne: kein Live-Zuruf (Würfe fallen
  vorab).
- **Abklingzeit:** ein Zuruf, danach Sperre von rund einem Fünftel der Spieldauer; höchstens drei
  Zurufe je Spiel. Zurücknehmen kostet einen Zuruf (anders als die Zielansage im Kampf, deren
  Aufheben frei ist, `engine.js:57142-57145`) — sonst wird es Dauerklicken.
- **Quittung:** Schwebetext am Team („ELLBOGEN RAUS!", wie `rennplanAnsagen` `56717-56720`),
  Tickerzeile, kleines Zeichen über den Figuren, solange die Vorlage läuft. Nur vorhandene Posen
  und gezeichnete Zeichen — **keine neue Animation, keine neue Figur.**

**Im Saisonspiel (`nurZuschauen` an):** die Chips sind **Anzeige**. Was dort umschaltet, ist der
**Zuruf-Plan** aus der Einsatzliste: höchstens zwei Wenn-dann-Anweisungen aus einer kurzen, festen
Liste von Anlässen (Rückstand zur Hälfte · Führung im letzten Drittel · Unterzahl/Ausfall).
Der Motor führt sie beim Buchen deterministisch aus; beim Zuschauen sieht man den Zuruf als
Ereignis mit Zeitpunkt. Damit bleibt gezeigt = gebucht, und der „Spice" ist trotzdem da — nur
entsteht er in der Vorbereitung, wie ein Trainer, der seinem Team für den Rückstand etwas mitgibt.

Ein echter Live-Klick im Saisonspiel würde voraussetzen, dass Spiele live gespielt und erst danach
gebucht werden. Das ist ein Umbau der Spieltags-Buchung, kein Vorlagen-Thema (Frage 1).

---

## 5. Zusammenspiel mit Persönlichkeit und Kontakt

`kontakt-persoenlichkeit-16-11.md` entwirft vier Regler je Spieler (Kontaktbereitschaft KB, Härte
HÄ, Disziplin DI, Ausweichneigung AW), abgeleitet aus Persönlichkeit und Traits. Die Schichtung:

```
Regler des Spielers  =  klemme( Basis(Persönlichkeit) + Traits + Verschiebung(Vorlage) , 5 … 95 )
```

| Vorlage | KB | Auswahlschwelle `pMin` | HÄ | DI | AW |
|---|---:|---|---:|---:|---:|
| Defensiv | −15 | eine Haltungsstufe vorsichtiger | −10 | **0** | +15 |
| Neutral | 0 | 0 | 0 | 0 | 0 |
| Offensiv | +15 | eine Stufe mutiger | +10 | **0** | −15 |

- **Die Vorlage verschiebt die Basis, die Persönlichkeit bleibt die Streuung.** Ein Bollwerk
  (KB 25) rempelt auch unter „Ellbogen raus" (40) seltener als ein Draufgänger unter „Sauber
  laufen" (75). Der Charakter bleibt lesbar; das ist die FM-Schichtung Team-Mentalität plus
  Einzelvorgabe.
- **Disziplin (DI) verschiebt die Vorlage nicht.** Ob jemand sauber bleibt, ist Charakter. Sonst
  wäre „offensiv" zugleich „mehr Fouls" und damit ein zweiter, versteckter Preis.
- **Der Ausgang bleibt bei den Sub-Skills** (WUCHT gegen ROBUST, TECHNIK zum Ausweichen). Die
  Vorlage ändert Häufigkeit und Auswahl, nie die Erfolgschance.
- **Geklemmt, nicht gestapelt.** Vorlage plus Trait-Summe (dort ±30) kann einen Regler nicht aus
  5…95 treiben; zwei offensive Einflüsse erzeugen keinen Spieler, der bei jeder Gelegenheit rempelt.
- **Reihenfolge der Abhängigkeit:** Die Kontakt-Spalten der Vorlage setzen die Regler-Schicht
  voraus (Stufe 0 des Kontakt-Konzepts). Vorlagen ohne Kontakt (Speed-Schach, Wettessen, Staffel,
  Football, Gewichtheben) brauchen sie nicht und können vorher kommen.

### Fehlerfälle

| Fall | Verhalten |
|---|---|
| Kennung unbekannt, aus anderer Disziplin, Tippfehler | still neutral (Muster `buehneHaltungVon`: nur Werte aus `erlaubt`), Warnung im Diagnoseprotokoll |
| Disziplin nicht arena-gewertet oder Stand „—" | Wähler ausgegraut; ein gespeicherter Wert wird nicht gelesen |
| Format ohne Abnahme für diese Vorlage (z. B. Spurt-Hatz) | Vorlage für dieses Format gesperrt, fällt auf neutral; in der Einsatzliste sichtbar, weil das Format dort gebucht ist |
| Vorlage nach Abgabe geändert | Zählt nur bis zur Buchung; danach gilt der in der Buchung stehende Wert |
| Alter Spielstand ohne Feld | neutral, bit-identisch |
| Zuruf-Anlass tritt nie ein | nichts passiert; die Bilanz zeigt „Zuruf nicht ausgelöst" |
| Pod mit vier Teams | je Team eigene Vorlage; die Verschiebung wirkt nur auf eigene Spieler |

### KI-Teams

- **Bis zur Abnahme einer Disziplin: immer neutral.** Sonst bewegt sich der Fingerabdruck auf
  `main`, bevor irgendetwas freigegeben ist.
- **Danach deterministisch aus dem Kader**, nach dem Muster `berechneTaktikAuto`
  (`engine.js:10894`): die Vorlage, deren Hinweis-Sub-Skill im aufgestellten Kader am stärksten
  über dem Ligamittel liegt, sonst neutral. Kein Wurf, keine Saat.
- **Teamstil als zweiter Schritt, nicht als erster:** `AiTacticalMode`
  (`lib/data/olyDataTypes.ts:3380`, u. a. `protect_lead`, `chase_top10`) kann die Kaderwahl um
  höchstens eine Stufe kippen. Erst einschalten, wenn die neun Paarungen gemessen sind — der Stil
  führt keine Kombination ein, die nicht abgenommen ist.
- **Die KI-Vorgabe ist Teil der Mechanik** (Lehre Speed-Schach: eine naive Regel trieb Pp auf
  21,6). Sie wird mitgemessen, nicht nachgereicht.

---

## 6. Abnahme und Messplan

### 6.1 Neutralitätskriterium (Pflicht, vor allem anderen)

**„Neutral" ist bit-identisch zum heutigen Motor.** Nachweis in jedem PR:

1. `node scripts/pruefe-wertung-fingerabdruck.mjs` vorher und nachher: **GESAMT `e80babacb68c`,
   alle 75 Einzel-Hashes gleich.**
2. Bauregeln, die das sicherstellen:
   - Ohne Feld wird **keine** neue Stelle gelesen (früher Ausstieg, kein „Faktor 1,0").
   - Eine Vorlage zieht **keinen Wurf aus `rr()`**, den neutral nicht auch zieht. Braucht sie
     Zufall, bekommt sie einen eigenen Strom (wie im Kontakt-Konzept).
   - **Kein Vorlagen-Name im Ergebnisobjekt von `spiele()`**, solange neutral gilt — ein Label
     dort verschiebt den Hash bei identischer Wertung (belegt am Zeitfahren-Label „Attacke",
     `engine.js:47427-47432`).
3. Zusätzlicher Test: Motor mit `strategieByDisciplineId` voller `null` gegen Motor ohne das
   Feld, Rohdaten-Hash gleich, für alle zwanzig.

### 6.2 Verhalten ändert sich (sonst ist der Knopf tot)

Je Vorlage ein **Verhaltenszähler** aus dem Boxscore, gemessen gegen neutral auf denselben Saaten:
Spurt Rempler je Rennen und mittlerer Angriffspunkt; Football Lauf-Anteil und ausgespielte vierte
Versuche; TDM mittlere HP beim Rückzug; Speed-Schach Remis-Quote und Restzeit; Wettessen
Bissverlauf je Drittel. Kriterium: der Zähler verschiebt sich um mindestens eine halbe
Standardabweichung in die versprochene Richtung. Diese Zähler sind zugleich die Anweisungsbilanz
der UI — eine Quelle, zwei Verwendungen.

### 6.3 Wertung hält (je Vorlage einzeln, nicht in der Mischung)

| Prüfung | Werkzeug | Kriterium |
|---|---|---|
| rho je Spiel, beide Seiten dieselbe Vorlage | `scripts/miss-alle-disziplinen.mjs 24 <d>` mit neuem Parameter `--strategie=<a>:<b>`; n = 48 bei Werten unter 0,82 | > 0,80 je Vorlage (angestrebt 0,85) |
| rho gemischt | dasselbe, alle neun Paarungen | > 0,80 je Paarung |
| Pp-Abweichung | `scripts/messe-arena-einfluss.mjs` und `…-zweiter-saatstamm.mjs` | ≤ 25 in beiden Strömen je Vorlage (Ziel < 15, nie auf Kosten von rho) |
| Star und Paartreue | `scripts/miss-rangtreue-nach-rolle.mjs` bzw. Kaderfamilie | Star auf Rang 1 fällt um höchstens 5 Punkte; Paare ab 15 Eignungspunkten weiter ≥ 97 % richtig |
| Knopf-Test | feste Zufallsströme, Muster `scripts/miss-wettessen-mauer.mjs` | jede Vorlage ist für ≥ 20 % der Kader die beste; die beste Vorlage hängt stärker am Hinweis-Sub-Skill als an `eig` |
| Spiegel | `miss-arena-buehne-spiegel.mjs`, `miss-arena-feldspiel-spiegel.mjs` | Heim:Gast nahe 50:50 je Vorlage |
| Zuruf-Plan | Wechsel zu drei festen Zeitpunkten (früh, Mitte, spät) | rho und Pp wie oben; kein Wechselzeitpunkt führt aus dem geprüften Raum |
| Formate | je Format einzeln (Spurt klassisch/Hatz/HYROX, Pods) | wie oben; ein nicht bestandenes Format sperrt die Vorlage dort |

**Abbruchregel, vorab:** Reißt eine Vorlage rho oder Pp, wird sie schwächer gebaut oder
gestrichen. Die Schranke wird nicht verschoben, und eine Disziplin darf mit **zwei** statt drei
Vorlagen in Produktion gehen (neutral plus eine), wenn die dritte nicht besteht.

**Scharfschalten** ist je Disziplin ein eigener kleiner PR. Solange KI-Teams neutral wählen und
kein Spielstand ein Feld trägt, bleibt der Fingerabdruck auch danach unverändert — er bewegt sich
erst, wenn die KI-Vorgabe eingeschaltet wird. Das sind zwei getrennte PRs mit je altem und neuem
GESAMT-Wert; `disziplin-abnahme.json` bekommt je Vorlage eine eigene Zeile
(`spurt:ellbogen-raus`), wie für die Spurt-Formate vorgesehen.

---

## 7. Reihenfolge, Pilot, Aufwand

| Schritt | Inhalt | Wertungsklasse | Aufwand |
|---|---|---|---|
| **0 Grundgerüst** | Feld `strategie` im Modifier, Katalog-Tabelle, Übergabe `strategieByDisciplineId` in Host und Headless-Runner, Lesestelle je Chassis ohne Wirkung, Sonden-Parameter `--strategie`, Buchungsfeld, Wähler in der Einsatzliste hinter Flagge `OLY_STRATEGIE_VORLAGEN` (aus), Anzeige-Chip in der Arena | Fingerabdruck-identisch | M (3–4 Tage) |
| **1 Pilot Wettessen** | Die drei Haltungen als Team-Vorlage; Mechanik ist scharf und abgenommen, nur die Buchse fehlt. Beweist die ganze Kette Einsatzliste → Buchung → Arena → Bilanz | Messung je Vorlage | S (1–2 Tage plus Messung) |
| **2 Speed-Schach, Staffel** | gleiche Art (V). Staffel wegen Pp-Raum 3,4 mit doppelter Stichprobe | Messung | je S |
| **3 Football** | erster Pilot mit sichtbarem Feldverhalten und erster Zuruf-Plan (Anlass „Rückstand zur Hälfte") | Messung, neun Paarungen | M |
| **4 Spurt klassisch** | Rennplan-Verschiebung; Kontakt-Spalte erst, wenn die Regler-Schicht des Kontakt-Konzepts steht. Danach Live-Chips in der Battle Arena auf `planWechsel` | Messung je Format | M |
| **5 TDM, Gewichtheben, Breaking, Zeitfahren, Takeshi** | je eine Disziplin je PR | Messung | je S–M |
| **6 Battlefield, Tennis, Fechten, Eiskunstlauf, Basketball, Mini-DM** | brauchen je eine eigene Mechanikrunde (Entscheidungspfad fehlt) | Messung, hohes Risiko | je M–L |
| **zurückgestellt** | Hockey, Climbing, Showcase, I-Spy — bis rho Luft hat | — | — |

**Warum Wettessen zuerst und nicht Spurt.** Der Pilot soll die Kette beweisen, nicht die
spektakulärste Vorlage liefern. Wettessen hat den größten Puffer der fertigen Kandidaten
(0,905 · Pp-Raum 15), null neue Mechanik, und ein Fehlschlag kostet einen Tag. Spurt wäre
sichtbarer, hängt aber an drei Formaten (eines davon ohne Pp-Raum) und an der Kontakt-Runde.
Sichtbares Verhalten kommt mit Schritt 3 und 4.

**Kleinster Schritt überhaupt:** Schritt 0 allein. Er ist mergebar, ohne dass eine einzige
Disziplin festgelegt ist, und ändert am Spiel nichts.

**Summe:** Schritte 0–3 rund zwei Wochen einschließlich Messungen und Reviews; 4–5 rund drei
weitere; Schritt 6 ist je Disziplin eine eigene Runde und nicht seriös in Tagen zu schätzen.

**Abhängigkeiten:** `LineupNewLook.tsx` wird vom offenen Einsatzlisten-Revamp (#1358, Draft)
berührt — vor Schritt 0 klären, ob er weiterläuft, sonst entsteht ein Konflikt an derselben
Stelle. Schritt 4 hängt an Welle 3 (Kontakt) und an der Absicherung der Spurt-Formate
(`arbeitsplan-16-11.md` W1/W2).

---

## 8. Offene Fragen an Chris

1. **Zuruf im Saisonspiel: vorab als Wenn-dann-Plan, oder echte Klicks während des Spiels?**
   Echte Klicks gehen nur, wenn Spieltage nicht mehr vorab gebucht, sondern live gespielt werden —
   ein Umbau der Buchung. **Empfehlung: Zuruf-Plan (höchstens zwei Anweisungen) im Saisonspiel,
   echte Chips nur in der Battle Arena.** Gezeigt = gebucht bleibt, und der Aufwand ist ein
   Zehntel.
2. **Vier Disziplinen vorerst ohne wirksame Vorlage (Hockey, Climbing, Showcase, I-Spy) —
   einverstanden?** Alle vier liegen an oder unter 0,80; jede Verhaltensänderung kostet dort
   erfahrungsgemäß 0,03–0,05. **Empfehlung: ja, ausgegraut mit Begründung**, statt drei Vorlagen
   anzubieten, die die Abnahme nicht bestehen können. Climbing kommt als erstes zurück, sobald es
   Luft hat (dein Beispiel vom 26.10.).
3. **Eine Stufe verschieben oder alle Spieler gleich setzen?** „Alle gleich" ist leichter zu
   erklären, löscht aber Slot- und Persönlichkeitsunterschiede; die Staffel hat an genau diesem
   Extremfall schon einen Kader unter 0,80 verloren. **Empfehlung: um eine Stufe verschieben** —
   der Draufgänger bleibt auch defensiv der Wildeste im Team.
4. **Sieht der Gegner meine Vorlage vor dem Spiel, und dürfen KI-Teams wählen?**
   **Empfehlung: nicht sichtbar** (sie zeigt sich im Ticker, wenn sie greift), **KI-Teams wählen
   erst nach der Abnahme einer Disziplin und nur aus dem Kader**, Teamstil als spätere Zugabe.
   Bis dahin spielen sie neutral, damit sich an bestehenden Ständen nichts bewegt.
5. **Darf eine Disziplin mit zwei statt drei Vorlagen starten, wenn die dritte die Abnahme
   reißt?** Bei engen Puffern (Staffel Pp 3,4; Takeshi rho 0,838; Spurt-Hatz) ist das
   wahrscheinlich. **Empfehlung: ja** — neutral plus eine bestandene Vorlage ist besser als auf
   die dritte zu warten oder die Schranke zu dehnen.

---

## Quellen

`docs/design/arbeitsplan-16-11.md` (Welle 4, Regeln 1–9) · `kontakt-persoenlichkeit-16-11.md`
(Abschnitte 2, 6.5, 7) · `fable-kontakt-interaktionen-16-11.md` (Abschnitt 7) ·
`taktik-grundeinstellung-konzept-26-10.md` · `feldspiel-taktik-karte-fundament-15-10.md` ·
`data/generated/disziplin-abnahme.json` · `lib/data/olyDataTypes.ts` ·
`lib/foundation/battle-arena/arena-aufstellung-adapter.ts` ·
`lib/battle/arena-headless-runner.ts` · `lib/battle/arena-resolved-disciplines.ts` ·
`app/foundation/legacy-lineup-lab/LineupNewLook.tsx` ·
`app/foundation/battle-arena/FoundationBattleArenaHost.tsx` ·
`public/mockups/battle-mode.engine.js` (Fundstellen wie angegeben).
