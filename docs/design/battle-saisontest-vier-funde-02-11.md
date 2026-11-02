# Battle-Mode-Saisontest 02.11.: die vier offenen Funde

Grundlage war der automatisierte Saisontest am Spielstand „Battle Mode VW – alle Figuren“
(`new-game-1793629096917-sjsiu9`). Gespielt wurden 20 von 20 Spieltagen über die echte UI, danach
folgten die Saisonabrechnung und der Wechsel in Saison 2. Gemessen wurde an Kopien der drei
Testabbilder (nach der Abrechnung, vor Saison 2, nach Saison 2). Dazu kamen der unberührte
Ausgangsstand (Saison 1, Spieltag 1) und ein serverseitiger Nachbau des Spieltagsablaufs.

## 1. Spieltag 19, Gewichtheben (D2) ohne Arena-Ergebnis: Bug, behoben

**Befund am Testabbild:** Alle 32 Zeilen von Gewichtheben an Spieltag 19 haben
`resolutionSource: "pps_duell"` und tragen `arenaAusfall.grund: "nicht_ausgefuehrt"`. Der
Zeitstempel ist der des D2-Commits. Das war die einzige ausgefallene Arena-Disziplin der ganzen
Saison.

**Nachbau:** `scratchpad e1-saison.mts`. Der Ablauf ist derselbe wie in der UI: Vorlauf, D1-Commit,
D2-Commit über den Auto-Run im Modus `hintergrund`, mit Fake-Runnern. Ausgangsstand ist der
unberührte Spielstand. Spieltag 19 Gewichtheben bucht dabei reproduzierbar
`pps_duell!nicht_ausgefuehrt` mit dem Schritt `arena_vorlauf_kein_snapshot`. Dieselbe Lücke tritt an
Spieltag 12 (Staffel-Pod) und Spieltag 17 (TDM, dort ohne Folgen) auf.

**Ursache:** Das passiert im KI-Batch des D2-Commits (`applyAiLegacyLineupBatchLocally`). Der Batch
läuft bei jedem Auto-Run-Aufruf erneut, also auch beim D2-Commit, und rechnet zwei Arten von
KI-Entwürfen neu:
(a) **Teilbesetzte Aufstellungen dünner Kader**, etwa „Only 4/6 players available for staffel d2“.
Diese probiert er bei jedem Aufruf neu.
(b) **Vollständige Aufstellungen**, die die Frischeprüfung (`findStaleAiLineupEntries`) wegen der
Nach-Spiel-Fatigue der eben in D1 gelaufenen Spieler für veraltet hält.

Gemessen an Spieltag 12 des Nachbaus: 14 KI-Teams bekamen eine neue Aufstellung, einschließlich der
D2-Einträge und der Formkarten der längst gebuchten D1-Seite. Damit stimmte die Seitensignatur von
D2 nicht mehr mit dem Snapshot überein. Weil schon eine Seite gebucht ist, legt
`ensureMatchdayResolveSnapshot` keinen neuen Snapshot an. Der Vorlauf meldet deshalb `status: null`,
und der Auto-Run bucht live. Ergebnis ist die PPS-Brücke mit `nicht_ausgefuehrt`.

**Fix:** Läuft der Spieltag schon (eine Seite gebucht), bleibt jeder abgegebene KI-Entwurf
eingefroren, ob vollständig oder teilbesetzt (`shouldSkipExistingAiDraft({ matchdayAlreadyStarted,
hasExistingDraftEntries })`). Das passt zur Regel für Menschen: Eine abgegebene Aufstellung lässt
sich nicht mehr ändern. Zwischen D1- und D2-Commit entsteht kein neuer Ausfall, denn Verletzungen
werden erst beim D2-Commit gewürfelt.

## 2. Battlefield bei Tempo 4x über 5 Minuten: kein Hänger, aber an die Bildrate gebunden, behoben

**Befund:** Gemeint ist der freie Reiter „Battle Arena“. Dort lief ein Battlefield-Duell bei
Tempo 4x länger als die 300 Sekunden, die das Testskript abwartete. Das Spiel endete, es
hing also nicht. Die gesamte Simulation umfasst 12.428 Ticks und dauert bei Zeitdehnung 5 etwa
41 Sekunden Spielzeit.

**Ursache:** In den Kampf-Disziplinen ruft `stepSim()` bei jedem Tick `updateHud()` auf. Das baut
jedes Mal Kaderleiste, Wertungstabelle und Score-Bug neu, bei Tempo 4x also viermal pro Bild. Die
Bildrate sank. `loop()` holt pro Bild höchstens 0,05 Sekunden nach. Deshalb lief das Spiel nicht nur
ruckelig, sondern auch in der Sendezeit langsamer.

**Fix:** Während das Spiel läuft, werden HUD und Kacheln nur etwa 20- bzw. 10-mal pro Sekunde neu
gebaut. Der Deckel pro Bild steigt auf 0,2 Sekunden. Die Wertung bleibt unverändert: Der
Fingerabdruck aus `spieleArenaDomination` und `disziplinProbe` ist vorher und nachher gleich
(`47c21f757fd776fc`), auch Ticks und Sieger im Quick-Sim sind identisch.

| Messung (Headless, Demo-Kader) | vorher | nachher |
|---|---:|---:|
| Battlefield, Tempo 4x, volle CPU | 53 s | 52 s (Soll 52 s) |
| Battlefield, Tempo 4x, CPU 6-fach gedrosselt | 227 s | 58 s |
| Battlefield Quick-Sim | 4,4 s | 1,3 s |
| Battlefield Quick-Sim, CPU 6-fach gedrosselt | 64 s | 14 s |
| TDM Quick-Sim | 3,5 s | 1,4 s |

## 3. 23 von 32 Teams nach der Abrechnung im Minus: kein Rechenfehler, sondern ein Artefakt des Testspielstands

**Messung:** Die Abrechnung wurde auf dem Stand vor der Abrechnung (`s1-ende.json`) mit dem aktuellen
Code wiederholt.

| | negativ | Σ Kasse |
|---|---:|---:|
| vor der Abrechnung | 0/32 | +569 |
| gebucht im Testlauf (globale Ränge 1–32, alter Code) | 23/32 | |
| neu gebucht, liga-lokale Ränge (Fix `ef4e81c56`) | 19/32 | −68 |
| dazu Saisonstand-Punkte nachgezogen (Bahn-Pod-Fix) | 18/32 | −67 |

- **Die GuV geht auf.** Die Differenz Δcash − Σ GuV-Posten entspricht genau den
  Sponsor-Ereignissen, die schon während der Saison gebucht wurden. Ein Rechenfehler liegt also
  nicht vor.
- **Der Rang-Fix wirkt mit:** 4 Teams weniger im Minus, weil die Sponsorleiter jetzt mit dem
  Liga-Rang abrechnet.
- **Die eigentliche Ursache ist die Gehaltssumme.** Sie liegt bei 2.477 C, der Sponsor bringt
  1.560 C. Zum Vergleich drei echte Manager-Spielstände in Saison 1: Gehalt 1.640 bis 1.880 C, am
  Saisonende 1 bis 13 Teams im Minus.
- **Woher die Gehälter kommen:** 1.988 C stammen aus den übernommenen Kadern von `swnjlk`. Das sind
  Saison-2-Kader, die mit den Startbudgets von Saison 1 gekauft wurden; 16 Käufe scheiterten am
  Budget und wurden mit 0,01 erzwungen. Weitere 336 C stammen aus 32 Figuren, die ebenfalls mit
  0,01 gesetzt wurden. Der KI-Draft trägt nur 147 C bei. Die KI-Transferlogik ist also nicht schuld.
- **Ein Minus am Saisonende ist erlaubt.** Das entspricht Chris' Regel: „d-p darf negativ in die
  neue Saison gehen“. Ausgeglichen wird es im Kauffenster der neuen Saison durch Kredit-Pass und
  Notkredit. Das konnte im Testlauf nicht greifen, weil der Kauflauf nie startete (siehe Punkt 4).

## 4. Saison 2 mit unvollständigen Kadern und 0 KI-Transfers: Bug, behoben

**Befund:** Nach `next_season_setup` hatten die KI-Teams in Saison 2 noch 8 bis 11 Spieler, und es
gab 0 Käufe. Es existiert kein `aiPreseasonAutomationRuns["season-2"]`. Das Kauffenster
`isSeasonStartSetup` war offen. `skipIfExistingMarketTransfers` ist nicht beteiligt.

**Ursache:** Der einzige Auslöser für den KI-Kauflauf der Folgesaison saß im Browser, in einem Effekt
der Shell. Der Test hat den Saisonwechsel über dieselbe Route gemacht wie der Knopf, die Shell danach
aber nicht geöffnet.

**Fix:** Die Lauf-Logik ist unverändert nach `lib/ai/ai-preseason-background-service.ts` gewandert.
Die Preseason-Workflow-Route stößt den Lauf nach einem erfolgreichen `next_season_setup` selbst an,
losgelöst vom Request. Sie verwendet dieselbe Bedingung wie der Browser und teilt mit ihm die Sperre.

**Gemessen an der Kopie vor Saison 2:**

| | vorher | nachher |
|---|---:|---:|
| KI-Käufe | 0 | 45 |
| Kader Ø | 9,3 | 10,7 |
| Kader min | 8 | 9 |
| Teams mit höchstens 9 Spielern | 21 | 4 |

Der Lauf war etwa 53 Sekunden nach dem Wechsel abgeschlossen.

## Restpunkte

- **Signatur ohne Verfügbarkeit:** `buildAvailabilityPart` (`matchday-resolve-snapshot.ts`) liest
  `playerAvailabilityState` mit `Object.entries`. Das Feld ist aber ein Array, deshalb geht die
  Verfügbarkeit nie in die Snapshot-Signatur ein. Für diesen Fund war das unerheblich, die Stelle ist
  aber eine Lücke. Sie wurde nicht angefasst, weil ein Fix die Vorlauf-Wiederholungen verändert.
- **Fehlender Rückweg nach dem D1-Commit:** Wird die D2-Seite nach dem D1-Commit aus einem anderen
  Grund ungültig, gibt es weiterhin keinen neuen Vorlauf, und D2 wird sichtbar als
  `nicht_ausgefuehrt` gebucht. Der bekannte Auslöser dafür ist jetzt zu.
