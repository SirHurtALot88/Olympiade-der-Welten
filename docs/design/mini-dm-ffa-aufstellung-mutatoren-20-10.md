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
gesetzten Spieler zurück — dieselbe „gesetzt vs. frei"-Trennung wie beim 2-Team-Chassis
(`frei=SQUAD.filter(p=>!place[p.n])`).

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
`docs/design/battle-mode-20-spieltage-liga-mechanik-16-10.md` Abschnitt 5.3/5.4 dokumentierten
Werte (rho 0,80/0,82, Pp 8,7/9,0) — bestätigt, dass die Verdrahtung selbst keine neue
Zufallsquelle einführt. Unter der realistischen Abweichung (Manager hält Top-Talent zurück) bleibt
rho klar über der 0,80-Pflichtschranke (0,85 „angestrebt" wird — wie schon vorher — nicht
erreicht, das ist unverändert zur Baseline) und Pp bleibt weit unter der 25-Schranke. **Beide
Pflichtzahlen bestehen mit der echten Aufstellung.**

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

## Was nicht Teil dieses PR ist (PR B)

- Der N-Team-Buchungspfad bucht weiterhin den PPS-Score (`lib/resolve/mini-dm-pod-resolve.ts`,
  PR #1297), nicht den jetzt aufstellungs-/mutator-bewussten FFA-Boxscore. Ob das umgestellt
  werden soll, ist die in `mini-dm-pod-resolve-19-10.md` als „NICHT CHRIS-BESTAETIGT" markierte
  offene Frage — unveraendert offen, PR A trifft diese Entscheidung nicht vorweg.
- Vorlauf-/Snapshot-Integration (`lib/battle/arena-vorlauf-service.ts`) fuer 4-Team-Fixture-
  Gruppen — eigener, groesserer Umbau (durchgaengig paarweise gebaut).
- Boxscore-zu-PP fuer vier simultane Teams.
- UI-Fix der Spieltage-Paarungszeile (Punkt 7 des Auftrags) — separat in PR #1298.
