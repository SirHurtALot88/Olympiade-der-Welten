# Mini-DM-FFA bekommt die echte Aufstellung und den Spieltagswurf (20.10., PR A)

Auftrag Chris, 20.10., wörtlich: „du musst ALLE disziplinen schon sauber anbinden auch das FFA
mini dm mit den 4 teams wo die spieler raus gezogen werden!" Nach Exploration zu groß für einen
PR (s. `docs/design/mini-dm-pod-resolve-19-10.md` „Zur offenen FFA-Frage" und der Draft-PR-Bericht
zu PR #1298) — in Teilschritte zerlegt. **Dies ist PR A**: die echte Manager-Aufstellung und der
Spieltagswurf (Formkarten/Mutatoren) fließen jetzt in den FFA-Kampfmotor ein. **PR B** (der echte
Boxscore statt des PPS-Score-Platzhalters im Buchungspfad, Vorlauf-Integration, Boxscore-zu-PP für
vier Teams) bleibt offen — eigener, größerer Umbau, s. unten.

## Befund

`spieleMiniDmFfaEvent(vierTeams, saat)` (`public/mockups/battle-mode.engine.js`) stellte die vier
Kämpfer je Team bisher **selbst** zusammen: Kader absteigend nach `p.d["mini-dm"]` sortiert, Rolle
`i` bekam `kader[i % kader.length]`. Die Aufstellung des Managers (`lineupDrafts`) wurde komplett
ignoriert — anders als beim 2-Team-Chassis (`bauFeldspiel`/`slotFuer`), das `place[p.n].slot`
liest. Der Node-Runner (`runMiniDmFfaPodFixtures()`, `lib/battle/arena-headless-runner.ts`) reichte
außerdem `mutatoren: []` fest verdrahtet an den Bootstrap durch — der echte Spieltagswurf, den
die anderen Arena-Disziplinen über `RunArenaFixturesOptions.mutatoren` bekommen, erreichte
Mini-DM nie.

**Richtigstellung einer Verwechslung im Auftragstext**: „Formkarten" meint im Projekt zwei
verschiedene Dinge. Die ENGINE-INTERNE `FORMKARTE` (ein zufällig gezogener Form-Multiplikator je
Spieler, `zieheFormkarten()`) wird für **kein** reales Fixture irgendeiner der zwanzig Disziplinen
gezogen — nachgesehen: kein Treffer für „formkarte" in `arena-headless-runner.ts` oder
`legacy-matchday-resolve-engine.ts`. Sie ist ein reines Kalibrierungs-/Messwerkzeug (s.
`mdffaFormkartenFuer()`, von den Sonden `miniDmFfaSonde`/`miniDmFfaEinfluss` benutzt), kein
Live-Spiel-Feature, bei KEINER der zwanzig Disziplinen. Was der Auftrag mit „Formkarten/Mutatoren"
eigentlich meint und was tatsächlich fehlte, war ausschließlich der **Spieltagswurf**
(`mutatoren: string[]`, `RunArenaFixturesOptions.mutatoren`) — der ist jetzt angebunden, s. unten.

## Was gebaut wurde

### 1. Aufstellung im Motor (`battle-mode.engine.js`)

`spieleMiniDmFfaEvent(vierTeams, saat, platzJeTeam)` — neuer, dritter, OPTIONALER Parameter: ein
Array von vier `place`-Objekten (eins je Team, dieselbe Form wie beim 2-Team-Chassis:
`{name: {d,slot}}`). Ohne Parameter (jeder bestehende Aufrufer — alle Mess-Sonden, der
Test-Interface-Pfad) ist das Verhalten **byte-identisch** zu vorher (Property-Test: 2-Argument-
und 3-Argument-Aufruf mit `undefined`/`[null,null,null,null]` liefern `JSON.stringify`-gleiche
Ergebnisse). Mit Parameter übernimmt ein Spieler, den der Manager explizit auf eine Mini-DM-Rolle
gesetzt hat, genau diese Rolle; nicht gesetzte Rollen fallen auf den Eignungs-Reihum der NICHT
für Mini-DM gesetzten Spieler zurück.

*Korrektur Opus-Review:* Der erste Entwurf dieses Textes nannte das „dieselbe gesetzt-vs.-frei-
Trennung wie beim 2-Team-Chassis (`frei=SQUAD.filter(p=>!place[p.n])`)". Das stimmt nicht: jene
Zeile gehört zur Aufstellungstafel des Mockups (`renderBoard`), nicht zur Auswahl. Die Auswahl im
2-Team-Chassis (`bauFeldspiel`) lautet „wer gesetzt ist, spielt" — sobald irgendein Spieler für die
Disziplin gesetzt ist, treten NUR die Gesetzten an, Unterzahl eingeschlossen. Der FFA-Motor füllt
dagegen unbesetzte Rollen mit dem Reihum auf — auch mit Spielern, die am selben Spieltag in der
anderen Disziplin gesetzt sind. Siehe Abschnitt „Opus-Review" unten, warum das im echten Spiel
drei von vier Rollenrunden betrifft.

**Fund während der eigenen Tests** (nicht am Live-Spielstand, über
`tests/mini-dm-ffa-pod-headless-runner.test.ts`): ein erster Entwurf indizierte den Reihum-
Fallback über den GLOBALEN Rollen-Index — dadurch blieb der beste „freie" Spieler bei einem Kader,
der exakt zur Rollenzahl passt, komplett ungenutzt, sobald irgendeine andere Rolle explizit
gesetzt war (Rolle 0 gesetzt → Rolle 1 las `frei[1]`, nie `frei[0]`). Behoben mit einem
SEQUENTIELLEN Zähler je Team, der nur bei einer tatsächlich auf „frei" zurückfallenden Rolle
hochzählt — ohne gesetzte Rolle zählt er exakt mit dem globalen Index mit und bleibt damit
weiterhin bit-identisch zum alten Verhalten.

`mdffaAuswahlVorbereiten()`/`mdffaWaehleVier()` sind jetzt die GEMEINSAME Auswahl-Grundlage für
`spieleMiniDmFfaEvent()` UND `miniDmFfaEinfluss()` (die Pp-Sonde) — vorher hatte Letztere ihre
eigene, abweichende Kopie der Eignungs-Sortierung.

### 2. Node-Runner (`arena-headless-runner.ts`)

`runMiniDmFfaPodFixtures()` baut jetzt je Team ein `place` über das bestehende
`buildArenaAufstellung()` (EIN Team — kein Merge nötig wie bei `buildArenaAufstellungBeide()`,
weil ein Pod-Teilnehmer nur seinen eigenen Kader kennt, keine Namenskollision mit den drei anderen
Teams möglich) und reicht es durch. Neue Option `mutatoren?: string[]` ersetzt das harte `[]` im
Bootstrap — derselbe Bootstrap-Weg, über den auch die 2-Team-Disziplinen ihren Spieltagswurf
lesen. Neue Option `aufstellungBeachten?: boolean` (Default `true`) für Aufrufer, die bewusst das
alte Verhalten wollen (z. B. eine Vergleichsmessung).

### 3. Mess-Skript (`miss-mini-dm-ffa-abnahme.mjs`)

Neuer Schalter `--aufstellung=optimal|verschoben`:
- `optimal` — Rolle *i* bekommt Eignungs-Rang *i* explizit gesetzt. Muss (und tut) bit-identische
  rho/Pp-Werte zum Default liefern — Sanity-Check der Verdrahtung selbst, kein neuer Zustand.
- `verschoben` — Rolle *i* bekommt Eignungs-Rang *i+1* (der Manager hält sein Top-Mini-DM-Talent
  für eine andere Disziplin zurück) — die realistische Abweichung, die der Auftrag befürchtet
  („taktische statt rein eignungsoptimale Entscheidungen"), kein künstlicher Worst-Case.

## rho/Pp — neu gemessen (Pflicht, CLAUDE.md)

Kaderfest, 10 Teams der Kader-Familie, 210 Vierergruppen, 6 Events je Gruppe, zwei Saatströme
(Versatz 0 / 10 000 000), Budget-Methode +15 für Pp:

| | rho je Runde (Strom 0 / 10M) | Pp (Strom 0 / 10M) |
|---|---:|---:|
| Baseline (reine Eignungs-Auswahl) | 0,822 / 0,816 | 8,7 / 9,0 |
| `--aufstellung=optimal` (Sanity) | 0,822 / 0,816 (bit-identisch) | 8,7 / 9,0 (bit-identisch) |
| `--aufstellung=verschoben` (realistisch) | 0,808 / 0,808 | 9,4 / 8,4 |

Die Baseline-Zahlen reproduzieren exakt die am 13.10. gemessenen und in
`docs/design/stand-aller-disziplinen.md` (Neunzehnter Nachtrag) dokumentierten Werte (rho je Runde
Mittel 0,822 / 0,816, Median 0,800 / 0,800, Pp 8,7/9,0) — bestätigt, dass die Verdrahtung selbst
keine neue Zufallsquelle einführt. Unter der Abweichung „verschoben" (Manager hält Top-Talent
zurück) bleibt das rho-Mittel knapp über der 0,80-Pflichtschranke (0,808, Median 0,800, Gruppen
unter 0,80: 77 bzw. 84 von 210 statt 62 bzw. 73), Pp bleibt weit unter 25.

*Einschränkung (Opus-Review):* Das gilt für „verschoben", nicht für jede Aufstellung. Andere
Aufstellungsmuster reißen die rho-Schranke deutlich, s. Abschnitt „Opus-Review" unten. Für PR A ist
das folgenlos (nichts wird gebucht), für PR B ist es eine Vorbedingung.

Befehle:
```
node scripts/miss-mini-dm-ffa-abnahme.mjs 6 --pp
node scripts/miss-mini-dm-ffa-abnahme.mjs 6 --pp --aufstellung=optimal
node scripts/miss-mini-dm-ffa-abnahme.mjs 6 --pp --aufstellung=verschoben
```

## Validierung

- `tests/mini-dm-ffa-pod-headless-runner.test.ts`: zwei neue Faelle (expliziter Entwurf setzt
  genau die gesetzte Rolle, inklusive Gegenprobe für die drei unveraenderten Teams und den
  "frei"-Fallback des eigentlich staerksten Spielers; `aufstellungBeachten:false` haelt bewusst
  beim alten Verhalten), alle 8 Faelle gruen.
- Backward-Kompatibilitaet per Chromium-Smoke bestaetigt: 2-Argument- und 3-Argument-Aufruf
  (`undefined`/`[null,null,null,null]`) liefern `JSON.stringify`-gleiche Ergebnisse.
- Bestehende Suiten (`arena-headless-runner.test.ts`, `battle-mode-arena-resolve-engine.test.ts`,
  `mini-dm-pod-resolve*.test.ts`, `mini-dm-pod-schedule.test.ts`) unveraendert gruen.
- tsc/eslint sauber auf allen vier geaenderten Dateien.
- Manager-Mode-Bit-Identitaet (`pruefe-mapper-bit-identitaet.ts`/`pruefe-resolve-bit-identitaet.ts`)
  gegen eine frische Kopie des Live-Abbilds vor/nach: erwartet (und bestaetigt) unveraendert, weil
  `runMiniDmFfaPodFixtures()`/`spieleMiniDmFfaEvent()` NICHT im Resolve-/Mapper-Pfad haengen (s.
  Kopfkommentar an `runMiniDmFfaPodFixtures` -- weiterhin reiner Praesentationszweck, PR B holt das
  Buchen nach).

## Opus-Review (20.10.): nachgeprüft, und was vor PR B geklärt sein muss

**Nachgeprüft und bestätigt.**
- Ohne `platzJeTeam` byte-identisch, am Code UND gegen `main` gemessen: die Auswahl verbraucht
  keinen Zufall (Sortieren, Map, Zähler), ohne gesetzte Rolle ist `frei` gleich `sortiert` und der
  Zähler läuft gleich dem Rollen-Index. 120 Events (40 Vierergruppen × 5 Saaten) aus der
  Kaderfamilie liefern auf `main` und auf diesem Branch denselben SHA-256 über das volle
  `JSON.stringify`. Die vollständige Abnahme (`... 6 --pp`) ist auf beiden Ständen Zeile für Zeile
  gleich, und die Werte stimmen mit dem 13.10.-Nachtrag überein.
- Randfälle im Browser: ungleiche Kadergrößen (1/2/3/12 Spieler), Kader genau 4 mit gesetzter
  Rolle 0 (jeder kämpft genau einmal), mehr Spieler als Rollen, alle vier Rollen gesetzt, zwei
  Spieler auf derselben Rolle (der erste in Kaderreihenfolge bekommt sie, der zweite bleibt frei),
  unbekannte Rolle (Lineup-slotIndex 4 = „chaosdriver") wird ignoriert, Einträge anderer
  Disziplinen ändern nichts, Ein-Spieler-Kader komplett gesetzt (kämpft alle vier Runden), leerer
  Kader wirft wie vorher. Der Entwurf eines Teams ändert die Auswahl der drei anderen nicht.

**Härtere Aufstellungsmuster, gemessen** (dieselbe Abnahme, Muster per Messkopie des Motors
eingespeist, zwei Saatströme):

| Aufstellung je Team | rho je Runde (Strom 0 / 10M) | Gruppen unter 0,80 | Pp |
|---|---:|---:|---:|
| Baseline / „optimal" | 0,822 / 0,816 | 62 / 73 von 210 | 8,7 / 9,0 |
| „verschoben" (Rang 1–4) | 0,808 / 0,808 | 77 / 84 | 9,4 / 8,4 |
| nur Frontliner gesetzt, mit dem Mittelfeld-Spieler | 0,842 / 0,833 | 40 / 49 | 9,3 / 8,6 |
| Rang 0–3 in umgekehrter Rollenfolge | 0,846 / 0,839 | 46 / 49 | 8,0 / 7,7 |
| vier zufällige Spieler, zufällige Rollen | **0,744 / 0,747** | 135 / 142 | 10,5 / 10,1 |
| nur Frontliner gesetzt, mit dem Schwächsten | **0,709 / 0,706** | 185 / 179 | 10,0 / 10,0 |
| die vier Schwächsten | **0,508 / 0,501** | 209 / 209 | 11,0 / 10,9 |

Pp hält in jedem Muster (≤ 11), die Attribute tragen also weiter nach Matrix. rho fällt, sobald
schwache Kämpfer aufeinandertreffen: die Paartreue bei 5–15 Eignungspunkten Abstand sinkt von
94,5 % (Baseline) auf 76–88 %, die Ausfallquote steigt von 67 % auf bis zu 88 %. Der Schlagwechsel
ist bisher nur mit den vier Besten je Team abgenommen und trennt im unteren Eignungsbereich
schlechter. Das ist keine Folge dieses PR (der Mechanismus ist unverändert), wird aber durch ihn
erstmals erreichbar.

**Im echten Spiel ist nur EINE Rolle gesetzt.** `MINI_DM_FIXED_PLAYER_COUNT = 1`
(`lib/season/season-discipline-schedule.ts`, Chris 14.09.: „4 teams mit je 1 spieler"). Der
jüngste Spielstand im Live-Abbild (14.10.) hat Mini-DM mit `playerCount: 1`, ältere Spielstände
noch 2–6 Einträge. Ein Entwurf mit einem Eintrag hat slotIndex 0, also „frontliner". Mit diesem PR
bestreitet der vom Manager gewählte Spieler deshalb nur die Frontliner-Runde. Die anderen drei
Runden bestreiten die eignungsbesten übrigen Spieler, auch wenn sie am selben Spieltag in der
anderen Disziplin aufgestellt sind. Der PPS-Pfad (PR #1297) wertet dagegen nur den einen
aufgestellten Spieler. Bucht PR B den FFA-Boxscore, entscheiden zu drei Vierteln Spieler, die der
Manager nicht für Mini-DM aufgestellt hat. Offene Design-Frage für Chris, NICHT in PR A entschieden:
(a) kämpft der eine Aufgestellte alle vier Rollenrunden, (b) bekommt Mini-DM vier
Aufstellungsplätze, oder (c) bleibt der Reihum, dann aber ohne Spieler, die anderswo gesetzt sind.

**Spieltagswurf: Rohr gelegt, aber noch nicht angeschlossen.** `runMiniDmFfaPodFixtures()` hat
heute KEINEN Produktiv-Aufrufer, und niemand übergibt `mutatoren`. Der richtige Wert ist, wie bei
den anderen Arena-Disziplinen, der je Disziplin gezogene Wurf
`resolveMatchdayMutatorTraitsForDiscipline({..., disciplineId: "mini-dm"})`. Jede Disziplin eines
Spieltags hat ihren eigenen Wurf, es gibt keinen gemeinsamen. Die Engine-Seite stimmt: `mutatoren`
im Bootstrap-Umschlag wird `kaderMutatoren` und damit `MUTATOREN`, das `mdffaKaempfer()` über
`eigMutator()` liest. Die App-Anzeige (`renderMiniDmFfa()`) ruft den Motor weiterhin mit zwei
Argumenten auf, zeigt also die reine Eignungs-Auswahl und nicht die Aufstellung. Den Wurf bekommt
sie bereits über `mutatorenByDisciplineId`.

## Was nicht Teil dieses PR ist (PR B)

- Der N-Team-Buchungspfad bucht weiterhin den PPS-Score (`lib/resolve/mini-dm-pod-resolve.ts`,
  PR #1297), nicht den jetzt aufstellungs-/mutator-bewussten FFA-Boxscore. Ob das umgestellt
  werden soll, ist die in `mini-dm-pod-resolve-19-10.md` als „NICHT CHRIS-BESTAETIGT" markierte
  offene Frage — unveraendert offen, PR A trifft diese Entscheidung nicht vorweg.
- Vorlauf-/Snapshot-Integration (`lib/battle/arena-vorlauf-service.ts`) fuer 4-Team-Fixture-
  Gruppen — eigener, groesserer Umbau (durchgaengig paarweise gebaut).
- Boxscore-zu-PP fuer vier simultane Teams.
- UI-Fix der Spieltage-Paarungszeile (Punkt 7 des Auftrags) — separat in PR #1298.
