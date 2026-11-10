# Arena: der echte Spieltag live — Befund, Weiche, Bauplan (11.11.)

PM-Fahrplan (Opus) zu Chris' Auftrag vom 10.11. Reine Planung: kein Code, keine Matrix, kein
PixelLab, kein Merge. Grundlage ist der Stand von `origin/main` am 10.11. (bis `26597c5c5`, #1374)
und das Live-Abbild vom 10.11. 13:10 (`live-save`, laut `pruefe-spiegel-frische.ts` frisch).

Chris, wörtlich: „dass der gesamte Battle mode auch im Reiter ARENA gezeigt wird! dass die duelle
gegen KI etc funktionieren dass auch 4er battles sauber laufen etc. kein berechnen nur im
hintergrund sondern endlich mal sauber anbinden!! […] ziel ist dass die spieler in der einsatzliste
[…] eingesetzt werden und man dann wie im management mode in die arena gesendet wird und dort der
AKTUELLE spieltag abläuft! inklusive formkarten, mutator, etc."

---

## 0. Kurzfassung

**Die Hälfte des Auftrags steht schon seit dem 02.11. auf `main`, und Chris hat sie noch nie
gesehen.** Commit `0c9a690f8` („Battle Mode: Spieltags-Arena zeigt die echte Battle Arena statt der
alten Buehne“, Doku `battle-arena-spieltag-anbindung-02-11.md`) hat den Reiter **Arena**
(`matchdayArena`) in Battle-Saves umgestellt. Dort läuft `FoundationBattleArenaHost` mit der Prop
`spieltag` und zeigt die eigene, heute fällige Begegnung. Kader, Aufstellung, Saat, Mutatorwurf und
Pod sind dieselben, mit denen der Server gebucht hat. Das gilt auch für alle drei Vierer-Formate.
„Zur Arena →“ in der neuen Einsatzliste (`LineupNewLook.tsx:2454`) führt genau dorthin.

Warum Chris das nicht kennt, steht im Live-Abbild: sein einziger Battle-Save
(`new-game-1793476611202-0dwpok`, angelegt am 31.10.) steht auf **Saison 1, Spieltag 1, Status
`planning`, null Einsatzlisten, null Ergebnisse**. Er hat in Battle Mode noch keinen einzigen
Spieltag gespielt, also auch die Arena-Anbindung nie erlebt. Der Eindruck „läuft nur im
Hintergrund“ stammt aus dem Code-Kommentar des Runners, nicht aus dem Spiel.

**Fertig ist es trotzdem nicht.** Sieben echte Lücken, nach Gewicht geordnet (Details in Abschnitt 4):

| # | Lücke | Wirkung für Chris |
|---|---|---|
| L1 | **Formkarten und Intensität erreichen den Motor nicht.** Der Motor zieht eigene Ersatzkarten (0/2/4/8) aus der Saat. | Was er in der Einsatzliste an Formkarten und Vollgas/Schonen setzt, ändert in den 17 Motor-Disziplinen nichts am Ausgang. Die Arena zeigt dabei „+4 Formkarte“ an Spielern, für die er gar keine oder eine −8 gespielt hat. |
| L2 | **Die Arena startet erst, wenn der Hintergrund-Vorlauf fertig ist.** Der läuft in Chromium, je nach Spieltag 11 bis über 100 s. | „⏳ wird im Hintergrund berechnet“. Genau das Gefühl, gegen das er sich wehrt. |
| L3 | **Gezeigt = gebucht ist nur für Chromium bewiesen.** `Math.sin/cos/pow` rechnen in anderen JS-Engines anders (PR #1328 hat das bitgenau nachgewiesen). | In Safari, Firefox oder auf einem anderen Betriebssystem kann die Wiedergabe vom gebuchten Spiel abweichen. Bisher prüft niemand das pro Ansicht. |
| L4 | **TDM, Hockey, Football haben kein zählendes Motor-Spiel.** Sie werden über die PPS-Duell-Brücke gewertet. | In 3 von 20 Disziplinen zeigt die Arena nur einen Text. Das ist gewollt (kein Schaukampf, der nicht zählt), hängt aber am 20-Disziplinen-Fahrplan, Strang W. |
| L5 | **Der Kampf-/Feldspiel-Takt-Fix (B1) liegt nur auf einem Branch** (`516396fdf`, `claude/anzeige-treue-fix-0911`, nach dem Merge von #1372 nachgeschoben, kein PR). | Bremst TDM, Hockey und das Mini-DM-Duell, sobald sie zählen sollen. |
| L6 | **Man sieht nur die eigene Begegnung.** Die anderen 15 Duelle bzw. 7 Pods des Spieltags, also KI gegen KI, sind nirgends zu sehen. | Offen, ob Chris das will (Frage F3). |
| L7 | **Kein „In die Arena senden“-Moment.** Nach dem Speichern kann die Aufstellung weiter geändert werden. Eine Änderung verwirft den Vorlauf und startet ihn neu. | Es fehlt der Management-Mode-Moment „Aufstellung ist raus, jetzt wird gespielt“. |

**Zentrale Weiche (Abschnitt 3): der Server bucht, der Browser zeigt, und jede Ansicht beweist
gezeigt = gebucht.** Das ist die heutige Architektur, ergänzt um drei Bausteine:

1. **Deterministische Mathematik im Motor, in jeder Laufzeit**, aus #1328 übernommen.
2. **Ein Endzustand-Fingerabdruck je Wiedergabe**, der gegen den gebuchten verglichen wird.
3. **Ein Sofortstart aus den eingefrorenen Eingaben.** Der Browser braucht das Ergebnis des
   Servers zum Abspielen gar nicht, nur zum Buchen.

Clientseitiges Buchen ist abgewogen und **verworfen**. Es löst das Wartezeit-Problem nicht (die
anderen 15 Duelle müssen trotzdem gerechnet werden), es bindet das Ergebnis an Browser und
Betriebssystem, und es öffnet eine Schreib-Route für beliebige Ergebnisse in einem Spiel mit
mehreren Nutzern.

**Die RAM-Frage ist keine:** Die Wiedergabe läuft schon heute im Browser des Nutzers. Auf dem Server
läuft Chromium nur im Vorlauf, auf Abruf. Mit dem Node-Runner aus #1328 kann auch das ganz entfallen.

**Vierer-Formate (Abschnitt 4.4):** Die Annahme „der Host kann nur 1v1“ stimmt nicht. Mini-DM-FFA,
Battlefield-Pod und Bahn-Pod (Takeshi, Staffel) sind im Host eingebaut und stehen in
`bestimmeArenaSpieltagAnsicht()`. Die Lücken liegen woanders:
- die 24-Saaten-Treueprüfung für Bahn-Pods ist nicht fertig;
- der Mini-DM-Pod wird als Rundenshow gezeigt, nicht als laufender Kampf (Frage F6);
- es gibt keinen Fingerabdruck je Pod.

---

## 1. Ist-Architektur: von „Einsatzliste speichern“ bis „Spieltag gebucht“

### 1.1 Der Ablauf, Schritt für Schritt

```
 Einsatzliste (LineupNewLook)                          Server
 ─────────────────────────────                         ──────────────────────────────────────────────
 [Speichern] ──POST /api/lineups/legacy───────────────▶ route.ts:205 ensureMatchdayResolveSnapshot()
                                                         └─ nur wenn isMatchdayFieldComplete():
                                                            ALLE 32 Teams haben d1+d2 gesetzt
                                                       route.ts:219 kickoffArenaVorlauf()  (detached)
                                                         └─ arena-vorlauf-service.ts
                                                            starteOderTeileVorlauf → fuehreVorlaufAus
                                                            mitChromiumSemaphor (global, 1 Lauf)
                                                            ├─ runBattleModeArenaMatchday()
                                                            │   └─ runArenaFixtures()          ◀── HIER sitzt
                                                            ├─ runMiniDmFfaPodFixtures()           der Headless-
                                                            ├─ runBattlefieldPodFixtures()         Runner
                                                            └─ runBahnPodFixtures()
                                                            finishArenaVorlauf(): Snapshot (Preview mit
                                                            resolutionSource "arena" / Pod-quelle "ffa"/"bahn")
                                                            + eingabeHash je Disziplin
 [Zur Arena →] ─▶ View matchdayArena
 DisciplineStageArena ──GET arena-base─────────────────▶ matchday-arena-base-service.ts:222
   (pollt, solange Vorlauf "in_progress")                 kickoffArenaVorlauf() noch einmal (billig)
   Battle-Weiche :2681  battleModusArena
   bestimmeArenaSpieltagAnsicht(preview)
   └─ FoundationBattleArenaHost spieltag={…}
        baut Kader/Aufstellung/Saat/Pods SELBST
        aus gameState + /api/.../team-roster-sheets
        lädt battle-mode.html → engine.js (19,4 MB)
        nurZuschauen, Quick-Sim = schnellDurch()
        Ende: Event "oly-arena:ende"
   beimBattleArenaEnde :2715
   commitFinishedDiscipline(side, preview) ──POST /api/season/matchday-auto-run──▶
                                                         resolveMatchdayPreviewToBook():
                                                         eingabeHash NEU berechnen; weicht er ab →
                                                         Vorberechnung wird NICHT gebucht
                                                         → Standings, Fatigue, PPs, Boxscore
```

Belege: `app/api/lineups/legacy/route.ts:205/219`, `lib/battle/arena-vorlauf-service.ts`
(Kopfkommentar „DER EINE ORT“, `kickoffArenaVorlauf` / `stelleArenaVorlaufSicher`),
`lib/foundation/matchday-resolve-snapshot.ts:423` (`isMatchdayFieldComplete`),
`lib/foundation/matchday-arena-base-service.ts:222`,
`app/foundation/discipline-stage/DisciplineStageArena.tsx:2560–2725 und 3181`,
`lib/battle/arena-eingabe-hash.ts` (Kopfkommentar).

### 1.2 Was daraus folgt

- **Der Headless-Runner sitzt nicht im Buchungsschritt, sondern im Vorlauf.** Er läuft, sobald das
  Feld komplett ist, und schreibt einen Snapshot. Gebucht wird danach nur noch dieser Snapshot. Im
  Buchungspfad startet seit PR 3 (`battle-arena-auto-run-anbindung-plan-16-10.md`) kein Chromium.
- **Die Arena ist schon heute eine Wiedergabe mit identischen Eingaben**, keine Attrappe. Sie rechnet
  im Browser des Nutzers dasselbe Spiel noch einmal und tickt dabei sichtbar. Dass das Ergebnis
  identisch ist, folgt aus drei Dingen:
  1. derselben Saat (`arena-seed.ts`, `arena-host-seed.ts`, Test `tests/arena-seed-identitaet.test.ts`);
  2. derselben Fixture-Orientierung (Heim = `fixture.homeTeamId`);
  3. demselben Tick, für die Bahn seit #1372 (`anzeigeSechzigstel()`, festes 1/60).
- **Wer die Arena nicht öffnet, bucht trotzdem**, nämlich denselben Snapshot über Cockpit oder
  Auto-Run. Den Rückfall, nach dem der Auftrag fragt, gibt es also schon.
- **Zwei Bauwege für die Eingaben:** Der Server baut Kader, Aufstellung und Saat aus dem vollen Save.
  Der Host baut sie im Browser aus dem kompakten `gameState` plus nachgeladenen Attributbögen
  (`FoundationBattleArenaHost.tsx:300`) neu. Das ist durch Tests abgesichert, aber es bleibt genau
  die Bugklasse „zwei Implementierungen“, vor der `arena-seed.ts` selbst warnt. Phase P2 macht
  daraus einen Bauweg.

### 1.3 „Gezeigt = gebucht“ (#1372 und Folge-Commits): Stand je Chassis

| Chassis / Format | Stand auf `main` | Quelle |
|---|---|---|
| Bühne (Fechten, Gewichtheben, Schach, Tennis, Showcase …) | übereinstimmend; Runden sind tick-unabhängig | `miss-anzeige-treue-rest.mjs`, 24/24 |
| Feldspiel Basketball | übereinstimmend (`ZEIT_DEHNUNG` 1) | Doku 02.11. |
| Bahn-Duelle (Spurt, Climbing, Takeshi, Staffel, Time-Trial) | **behoben mit #1372** (fester 1/60-Takt) | `fb8708ab7` |
| Kampf/Feldspiel mit Dehnung (TDM, Mini-DM-Duell, Battlefield-Duell, Hockey) | **24/24 abweichend auf `main`**. Fix B1 `516396fdf` liegt nur auf dem Branch. Heute zählt keine dieser vier als Duell. | Commit-Text `516396fdf` |
| Battlefield-Pod | vorab entschiedenes Gefecht, Abspielen ohne `rr()`, 6/6 übereinstimmend | PR #1372 |
| Mini-DM-FFA-Pod | Rundenshow des gebuchten Ereignisses (Saat, k und Aufstellung aus `gebuchteMiniDmFfaKontext()`) | `battle-mode.engine.js` ~57 590 |
| Bahn-Pod | über `bahnPodAnzeigeKontext()`; **24er-Prüfung unvollständig** | `sendedauer-messung-09-11.md` |
| **Alle, über Browser- und OS-Grenzen hinweg** | **nicht geprüft** | s. L3 |

`window.__arena.anzeigeTreueSonde` (Commit `5fa5d1105`) ist **nicht auf `main`**. Die Sonde
bleibt trotzdem der richtige Baustein für dieses Vorhaben: Sie liest am Ende einer gezeigten Partie
dieselben Sieger-Funktionen wie `finish()`. Phase P1 macht aus dieser Stichprobenmessung eine
Prüfung, die bei jeder Ansicht läuft (Abschnitt 5).

---

## 2. Chris' Auftrag gegen den Ist-Stand

| Teil des Auftrags | Stand | Beleg |
|---|---|---|
| Einsatzliste (neues Design) → in die Arena | ✓ „Zur Arena →“, nur aktiv nach Speichern ohne Blocker | `LineupNewLook.tsx:2454` |
| Reiter **Arena** zeigt den Battle Mode | ✓ in Battle-Saves; Manager-Saves und Admin-Testmodus behalten die alte Bühne | `DisciplineStageArena.tsx:2681` |
| **aktueller** Spieltag, echte Begegnung | ✓ eigenes Fixture, D1 und D2 per Auswahl | `arena-spieltag-ansicht.ts` |
| Duelle gegen KI | ✓ für 15 Duell-Disziplinen; ✗ TDM, Hockey, Football (Brücke) | `ARENA_RESOLVED_DISCIPLINE_IDS` |
| 4er-Battles | ✓ Mini-DM-FFA, Battlefield-Pod, Bahn-Pod im Host; Treue-Lücken s. 1.3 | `FoundationBattleArenaHost.tsx:212–430` |
| Mutator | ✓ echter Spieltagswurf (`resolveMatchdayMutatorTraitsForDiscipline`) | `arena-vorlauf-service.ts:166ff.` |
| **Formkarten** | ✗ Ersatzkarten aus der Saat statt der gespielten Karten | L1 |
| Intensität (Vollgas/Schonen) | ✗ Motor steht fest auf `STUFE="normal"` | L1 |
| „kein Berechnen nur im Hintergrund“ | ½: gezeigt wird schon, aber erst nach dem Vorlauf | L2 |
| sauber angebunden | ½: Treue nur stichprobenhaft und nur für Chromium belegt | L3, L5 |

---

## 3. Die zentrale Weiche: wo wird gerechnet, wo gebucht?

### 3.1 Die drei Varianten

**A — Der Browser rechnet und bucht.** Der Client spielt das Spiel ab und meldet `{seiten,
boxscore}` an eine neue Route. Der Server übernimmt das Ergebnis.

**B — Der Server bucht, der Browser zeigt (heute).** Der Server rechnet alle Begegnungen im Vorlauf.
Der Browser spielt die eigene Begegnung mit denselben Eingaben nach und bucht beim Ende nur den
Snapshot, nichts aus dem Browser.

**B+ — wie B, mit Beweis und Sofortstart (Empfehlung).** Wie B, dazu:
- (a) deterministische Mathematik im Motor in jeder Laufzeit;
- (b) ein Fingerabdruck des gezeigten Endzustands, beim Buchen gegen den gebuchten verglichen;
- (c) die Wiedergabe startet sofort aus dem eingefrorenen Eingabepaket, der Vorlauf rechnet
  parallel;
- (d) der Vorlauf läuft über den Node-Runner (#1328), Chromium bleibt nur Rückfall.

### 3.2 Abwägung

| Kriterium | A Browser bucht | B heute | B+ Empfehlung |
|---|---|---|---|
| Server-RAM | kein Chromium für das eigene Spiel, **aber** die anderen 15 Duelle und 7 Pods müssen trotzdem irgendwo laufen | Chromium auf Abruf, je Spieltag | Node-Worker, Sekunden; Chromium nur als Rückfall |
| Wartezeit vor dem Anpfiff | 0 | 11 bis über 100 s (#1328: Climbing 11–13 s Gesamtwartezeit; Plan 16.10.: 20–110 s) | 0; das Buchen wartet am Ende einige Sekunden |
| Ergebnis vom Browser abhängig | **ja**: V8 nimmt für `sin/cos` eine eigene glibc-Kopie, für `pow` das `std::pow` des Systems. Safari und Firefox haben eigene libm. #1328 fand schon zwischen Node 22 und Chromium 141 abweichende Bits, die im Feldspiel chaotisch wachsen | nein (Server zählt), **aber** die Wiedergabe kann abweichen, unbemerkt | nein, und die Wiedergabe ist per Bauart gleich (a) und wird pro Ansicht geprüft (b) |
| Integrität bei mehreren Nutzern (Chris, Franky, Koop-Räume, gemeinsame SQLite) | eine Route nimmt beliebige Ergebnisse an; prüfbar nur durch Nachrechnen, und das ist dann B | ✓ | ✓ |
| Tab geschlossen, Akku leer, Handy | Spieltag hängt halb gebucht | ✓ bucht ohne Zuschauen | ✓ |
| Koop: zwei Browser | wer bucht? zwei Ergebnisse möglich | Host bucht den Snapshot | dasselbe |
| Anzahl Bauwege | **zwei** (Browser für das eigene Spiel, Server für den Rest) | einer zum Rechnen, zwei zum Eingabebau | einer zum Rechnen, **einer** zum Eingabebau (P2) |
| Aufwand | groß, neue Route und Prüfung | 0 | mittel, in Phasen |

**Empfehlung B+.** Das Kernargument gegen A ist nicht Anti-Cheat in einem Freundesspiel. Es ist:
**A spart nichts.** Von 16 Duellen je Disziplin sieht der Nutzer eines. Die anderen 15 muss
trotzdem jemand rechnen, und rechnet der Browser sie, wird das eigene Schließen des Tabs zum
Buchungsfehler. Dazu kommt die Mathematik: Ein Ergebnis, das von Safari oder Chrome abhängt, ist
kein Spielstand. Zur RAM-Sorge, die die Frage ausgelöst hat: In B und B+ liegt die Darstellung schon
heute beim Nutzer. Die Server-Last hängt am Vorlauf, und den macht #1328 ohne Chromium bitgleich
schneller (Breaking: 17,9–21,3 s → 1,5 s, s. PR-Text).

### 3.3 Warum der Sofortstart (c) sicher ist

Die Wiedergabe braucht **das Ergebnis des Servers nicht, nur dessen Eingaben**. Sie ist
deterministisch aus Saat, Kader, Aufstellung, Mutatoren und Motor-Version. Diese Eingaben stehen
fest, sobald
1. die eigene Aufstellung **und die des Gegners** eingefroren sind, und
2. der Motor-Stand feststeht (der Motor-Hash steckt schon im `eingabeHash`).

Der Browser kann also abspielen, während der Server parallel rechnet. Am Ende bucht er erst, wenn
der Snapshot steht, und vergleicht dabei Fingerabdrücke. Heute verbindet der Host das „Abspielen
dürfen“ mit „Snapshot ist fertig“ (`resolutionSource === "arena"` in
`bestimmeArenaSpieltagAnsicht`). Das lässt sich trennen: Ob ein Motor-Spiel zählt, folgt schon aus
`ARENA_RESOLVED_DISCIPLINE_IDS` und dem Pod-Spielplan, nicht erst aus dem Snapshot. Fällt der
Vorlauf aus (Rückfall auf die Brücke, `ArenaAusfall`), zeigt die Arena am Ende dasselbe, was sie
heute bei „gezeigt ≠ gebucht“ zeigt: „Gewertet: …“ mit dem gebuchten Wert und einem roten Hinweis.

**Voraussetzung** ist die Freigabe aus 3.4. Ohne sie könnte sich die Aufstellung nach dem Anpfiff
noch ändern.

### 3.4 Der „In die Arena senden“-Moment (L7)

Heute speichert die Einsatzliste, und „Zur Arena“ ist nur Navigation. Jede spätere Änderung an
irgendeiner der 32 Aufstellungen ändert die Signatur und startet den Vorlauf neu. Für Chris' Bild
„wie im Management Mode in die Arena gesendet“ braucht es einen bewussten Schritt
**„Aufstellung abschicken“**:
- die eigene Aufstellung friert für diesen Spieltag ein;
- fehlende KI-Aufstellungen werden sofort fertig gestellt (der Weg über `matchday-lineup-auto-prep`
  existiert);
- dann startet der Vorlauf.

Ob ein Zurück möglich sein soll, ist Frage F2.

---

## 4. Die Lücken im Einzelnen

### 4.1 L1: Formkarten und Intensität kommen im Motor nicht an

- **Einsatzliste:** je Disziplin eine primäre und eine sekundäre Formkarte
  (`LineupDraftModifierSide.primaryFormCardId/secondaryFormCardId`) sowie die Intensität
  `conserve/normal/push` (`LineupNewLook.tsx:54–188, 251`). Die Karten im Live-Save sind
  `FormCardRecord`s je Spieler mit Farbe und `cardValue` **von −8 bis +8**, 734 Stück über 32 Teams.
- **Motor:** `zieheFormkarten(saat)` (`battle-mode.engine.js:8609`) würfelt je Spieler einen Wert aus
  `[0, 2, 4, 8]`. „Formkarten seit 15.10. in die Saat gekoppelt“ heißt genau das: **an die Saat
  gekoppelt, nicht an die gespielte Karte.** `STUFE` steht fest auf `"normal"`; nur ein Knopf im
  freien Entwurf ändert sie (`:37363`).
- **Datenweg:** `grep -i "formcard|cardValue|primaryFormCard"` über `lib/battle/`,
  `lib/foundation/battle-arena/` und den Motor ergibt **0 Treffer**. `ArenaSpieler` hat kein Feld
  dafür (`arena-kader-adapter.ts`).
- **Folge:** In jeder Motor-Disziplin kommen die Team-Punkte (2/1/0 bzw. der Pod-Platz) allein aus
  dem Motor (`legacy-matchday-resolve-engine.ts:809ff.`). Formkarte und Intensität sind dort für den
  Ausgang wirkungslos. Ob sie über den PPS-Zweig noch individuelle PPs oder Ermüdung bewegen, misst
  P0 nach. Sichtbar wird es auch: Die Arena zeigt neben einem Spieler „+4 Formkarte des Spieltags“
  (`:37311`), der in der Einsatzliste eine −8 trägt.
- **Behebung:** Sie verändert die Mechanik. Die gespielten Werte ersetzen `FORMKARTE[name]`, die
  Intensität ersetzt `STUFE`, je Seite und Disziplin. Damit verschieben sich rho, die
  Pp-Abweichung, die PPS-Referenzen und der Wertungs-Fingerabdruck in **allen** Motor-Disziplinen.
  Pflichtabnahme nach CLAUDE.md (rho > 0,80 je Spiel **und** Pp ≤ 25, zwei Saatströme), die
  Matrix bleibt gesperrt. Dazu die Formkarten-Messrunde vom 15.10.
  (`formkarten-kopplung-messrunde-15-10.md`): Die Wirkung einer +4 reicht dort von 6 % (Tennis,
  Basketball) bis 23 % (Climbing) des Feldes. Mit Werten bis ±8 wird das deutlicher. Frage F1.

### 4.2 L2: Warten auf den Vorlauf

- **Messwerte:** Gesamtwartezeit bei Climbing 11–13 s mit Chromium gegen 6–7 s mit Node. Basketball
  16–19 s gegen 12 s. Breaking 18–21 s gegen 1,5 s (#1328, lokal, 4 Kerne). Der CX23 ist nach der
  Hochrechnung im Plan vom 16.10. 1,5- bis 2-mal langsamer. Dazu kommen rund 5 s Fixkosten je
  Vorlauf (`loadAllLocalLegacyLineupContexts` 1,3 s, `finishArenaVorlauf` 3,1 s), die beide Runner
  gleich zahlen.
- Der Vorlauf startet erst, wenn **alle 32** Einsatzlisten stehen (`isMatchdayFieldComplete`). In
  einem Koop-Raum wartet Chris damit auch auf Franky.
- **Behebung:** B+ (c) plus (d) aus 3.1, plus der Abschicken-Moment aus 3.4. Optional rechnet der
  Vorlauf das eigene Fixture zuerst. Mit dem Sofortstart ist das zweitrangig.

### 4.3 L3: Browser-Determinismus

#1328 hat für den Node-Runner gezeigt: `Math.cos(0.7330382858376183)` liefert in Node 22 `…942`, in
Chromium 141 `…944`. Über die Positionsrechnung im Feldspiel wächst ein solches Bit chaotisch.
Dieselbe Klasse trifft den Browser des Nutzers, sobald der nicht genau so rechnet wie das
Server-Chromium: Safari (JavaScriptCore), Firefox (SpiderMonkey) und bei `pow` auch Chrome auf einem
anderen Betriebssystem (`std::pow` des Systems). Heute prüft niemand, ob die Wiedergabe in Chris'
Browser das gebuchte Spiel ist. Die Arena vergleicht nur den **Sieger**
(`zeigtArenaDenGebuchtenSieger`), nicht den Spielstand und nicht den Boxscore.

**Behebung:**
- (a) Die Chromium-gleichen `sin/cos/pow` aus #1328 (`arena-node-chromium-mathe.mjs` plus Tabellen)
  werden **im Motor selbst** benutzt, nicht nur im Node-Kontext. Für Chromium ändert das nach
  #1328s eigenem Nachweis nichts (0 von 1,2 Mio. bei `sin/cos`). Den Rest bei `pow` (FMA-Grenzfälle)
  fängt (b) auf.
- (b) Der Fingerabdruck des gezeigten Endzustands, s. P1.

### 4.4 Vierer-Formate (Annahme im Auftrag widerlegt)

`FoundationBattleArenaHost` ist nicht nur für 1v1 gebaut. `buildArenaAufstellungBeide` ist der
Duell-Pfad. Daneben stehen:
- **Mini-DM-FFA:** `getMiniDmPodForTeam()` sucht den echten Pod, den auch die Buchung nimmt.
  Nutzlast `echterKader.miniDmFfaTeams` mit vier Kadern, k und Saat `buildMiniDmFfaPodMatchSeed`
  (Host :212ff.).
- **Battlefield-Pod:** `getPodForTeam(…, "battlefield")`, `echterKader.battlefieldPod` mit Saat,
  `k` und Aufstellung je Team (Host :230, :387).
- **Bahn-Pod (Takeshi, Staffel):** `echterKader.bahnPodByDisciplineId` (Host :244, :413).
- `bestimmeArenaSpieltagAnsicht()` leitet `resolutionSource === "mini_dm_pod"` mit Quelle
  `ffa`/`bahn` auf `art: "pod"` um.

**Was offen ist:**
1. **Bahn-Pod:** Die volle 24-Saaten-Prüfung gezeigt = gebucht steht aus
   (`sendedauer-messung-09-11.md`).
2. **Mini-DM:** Es läuft eine **Rundenshow** des vorab entschiedenen Ereignisses, kein frei
   laufender Vier-Ecken-Kampf. Für die Treue ist das ideal. Ob es Chris' Bild von „4er battles
   sauber“ trifft, ist Frage F6. Seit Kulissen-Batch 9 steht dahinter die Vier-Ecken-Leinwand.
3. **Kein Fingerabdruck je Pod.** Heute meldet `zeigtArenaDenGebuchtenSieger` bei Pods `null`,
   die Arena prüft dort also gar nichts. P3 ergänzt Platzierung und Punkte je Team.
4. **„Platz x von 4“** steht nur als Text unter der Arena. Eine Pod-Tabelle mit allen vier Teams
   im Spieltagsergebnis wäre P5.

### 4.5 L4 und L5: TDM, Hockey, Football

Die drei zeigen kein zählendes Motor-Spiel, weil sie die Pflichtabnahme nicht bestehen:
- Hockey: Pp 38,5 / 81,5;
- Football: Pp 64,6 / 61,7, dazu der Override-Konflikt Q-F;
- TDM: neuer Gefecht-Bauweg W2.

Die Arbeit dafür steht im 20-Disziplinen-Fahrplan (`alle-diszis-top-niveau-fahrplan-09-11.md`,
Branch `claude/alle-diszis-fahrplan-0911`, Strang W). **Dieser Fahrplan baut dafür nichts Eigenes.**
Er stellt nur sicher, dass eine Disziplin, sobald sie in `ARENA_RESOLVED_DISCIPLINE_IDS` landet,
ohne weitere Arbeit in der Arena erscheint. Das ist heute schon so (die Weiche liest die Menge).
B1 (`516396fdf`) ist Voraussetzung für TDM, Hockey und das Mini-DM-Duell und gehört als eigener PR
in die Merge-Reihenfolge des Koordinators.

### 4.6 L6: die anderen Begegnungen

Je Disziplin gibt es 16 Duelle (2 Ligen mal 8) bzw. 8 Pods. Zu sehen ist eines. Alle Ergebnisse
stehen im Snapshot, zeigen ließe sich jedes Spiel mit denselben Mitteln: den Host mit anderem
`heimTeamId`/`gastTeamId` öffnen, die Saat kommt aus dem Fixture. Das kostet nur Browser-Zeit.
Offen ist, was Chris will (F3).

---

## 5. Fragen, die nur Chris beantworten kann

Jede Frage mit Empfehlung, damit ein „ja, wie empfohlen“ reicht.

| # | Frage | Empfehlung |
|---|---|---|
| **F1** | Sollen die **in der Einsatzliste gespielten Formkarten (−8 bis +8) und die Intensität** die Ersatzkarten im Motor ersetzen? Das ist eine Mechanik-Änderung mit neuer rho- und Pp-Abnahme für alle 17 Motor-Disziplinen. | **Ja.** Sonst ist die Formkarten-Entscheidung in Battle Mode reine Kosmetik, und die Arena zeigt Karten, die er nie gespielt hat. Als eigene Phase P4, nach P1–P3. |
| **F2** | **Pflicht oder optional?** Muss jeder Spieltag angeschaut werden, oder bucht er auch ohne Zuschauen (Cockpit, „Spieltag auswerten“) wie heute? | **Optional**, mit „⏩ Quick-Sim“ und Buchen ohne Zuschauen als Rückfall. Ein Spieltag, der nur mit offenem Tab weiterkommt, blockiert Koop und Handy. |
| **F2b** | Nach „Aufstellung abschicken“: **gesperrt oder zurücknehmbar**, solange der Anpfiff noch nicht war? | Zurücknehmbar bis zum ersten Abspielen, danach gesperrt. Management-Mode-Gefühl ohne Falle. |
| **F3** | **Andere Begegnungen:** nur die eigene, dazu eine Konferenz (Liveticker aller Duelle), oder jede Begegnung einzeln anwählbar („springe zu Begegnung X“)? | Eigene Begegnung voll; daneben eine Spieltagsübersicht mit allen Ergebnissen; jede KI-Begegnung **auf Wunsch** als Wiedergabe. Kein Parallelbetrieb mehrerer Motoren (jeder Motor ist eine 19-MB-Instanz). |
| **F4** | **Reihenfolge D1 → D2:** automatisch nacheinander mit Zwischenstand, oder frei wählbar wie heute (Auswahlfeld)? | Automatisch nacheinander, „Weiter zu D2“ nach dem Zwischenstand; die Auswahl bleibt als Rücksprung. |
| **F5** | **Verpasste Spieltage nachsehen?** | Ja, aber erst P5. Grenze: Ein Deploy ändert den Motor und damit das Spiel. Eine exakte Wiedergabe alter Spieltage braucht archivierte Motor-Stände oder ein gespeichertes Ereignisprotokoll. Frage an Chris: lohnt das? |
| **F6** | **Mini-DM als Rundenshow** (heute, gebucht = gezeigt per Bauart) **oder als frei laufender Vier-Ecken-Kampf?** Der wäre teurer und braucht B1 plus eine eigene Treueprüfung. | Rundenshow behalten, optisch aufwerten (Kulissen-Batch 9 ist da). |
| **F7** | **Koop:** sollen beide Browser zeitgleich dasselbe sehen? Heute sieht jeder dasselbe Spiel, aber nicht synchron; gebucht wird vom Host. | Nicht in dieser Runde. Gleichlauf ist eine eigene Baustelle (Raumtakt). |
| **F8** | Auf welchen Geräten spielt Chris (Chrome, Safari, Handy)? | Bestimmt, wie dringend P1 (Mathematik im Motor) ist. Bei Safari oder iPad ist es Pflicht vor allem anderen. |

---

## 6. Bauplan in Phasen

Jede Phase ist für sich abnehmbar und mergebar. Grundsätze für alle:
- Wertungs-Fingerabdruck (`scripts/pruefe-wertung-fingerabdruck.mjs`) **bitgleich**, außer in P4,
  wo er sich bewusst ändert;
- keine Matrix-Änderung;
- kein PixelLab ohne Freigabe;
- Live-Tests mit Franky, Spielstände danach löschen (CLAUDE.md).

### P0: Sehen, was Chris sieht (≤ 1 Sitzung, kein Produktcode)

1. **Live-Durchgang am Server** (Chris selbst oder ein Agent mit Franky): Battle-Save, Spieltag 1
   (Climbing als Duell, Battlefield als Pod). Einsatzliste → „Zur Arena →“ → beide Disziplinen
   ansehen. Notieren:
   - wie lange „⏳ Hintergrund“ steht (Server-Log `[arena-vorlauf]`);
   - was die Arena zeigt;
   - ob „Gewertet:“ zum Spiel passt.
2. Messen, ob Formkarte und Intensität in Battle Mode **überhaupt irgendetwas** bewegen (PPs,
   Ermüdung). Methode: dieselbe Aufstellung mit und ohne Karte, Snapshot-Diff am Abbild.
3. B1 (`516396fdf`) als PR stellen und in die Merge-Reihenfolge des Koordinators eintragen.
   #1328 (Node-Runner) gegen `main` auf Merge-Konflikte prüfen; der PR ist seit dem 27.10. offen.
4. Chris' Antworten auf F1–F8 einholen.

**Abnahme:** Befundnotiz mit Screenshots (Live-Spieltag 1), Wartezeit auf dem CX23, F-Antworten.

### P1: Ein 1v1-Duell, bewiesen gezeigt = gebucht, in jedem Browser (1–2 Sitzungen)

Ziel genau nach Auftrag: **eine** echte heutige Begegnung, sichtbar, gebucht wie bisher, Gleichheit
per Fingerabdruck bewiesen, nicht nur gemessen.
1. **Mathematik im Motor.** Die Chromium-gleichen `sin/cos/pow` aus #1328 werden zu Beginn von
   `battle-mode.engine.js` als `M_SIN/M_COS/M_POW` für alle Positions- und Wahrscheinlichkeitsstellen
   eingebunden (oder `Math` im Motor-Scope ersetzt). Gilt für Browser, Chromium-Runner und
   Node-Runner gleich.
   Abnahme: Wertungs-Fingerabdruck GESAMT unverändert; `tests/arena-node-runner-paritaet.test.ts`
   grün.
2. **Endzustand-Fingerabdruck.** Neuer Lesepunkt `window.__arena.endFingerabdruck()`: Hash über
   `seiten`, Boxscore (Name, Seite, Wert) und Momente, gelesen beim Ende-Ereignis. Der Vorlauf
   speichert denselben Hash je Fixture im Snapshot. Der Runner liest ihn über dieselbe Funktion am
   Ende von `spiele*()`.
3. **Prüfung beim Buchen.** `beimBattleArenaEnde` schickt den gezeigten Hash mit. Die Arena vergleicht
   ihn mit dem gebuchten und zeigt bei Abweichung den roten Hinweis, ab jetzt für **jede**
   Abweichung, nicht nur beim Sieger. Die Abweichung landet zusätzlich als automatische Meldung im
   Branch `bug-reports` (bestehender Weg). Gebucht wird unverändert der Snapshot.
4. **E2E-Probe:** Playwright am Save-Abbild. 2 Duell-Disziplinen × 16 Fixtures × Quick-Sim, mit
   **Chromium und Firefox und WebKit**. Ziel: 100 % gleiche Fingerabdrücke.

**Abnahme:** E2E grün in drei Engines; Fingerabdruck der Wertung bitgleich; `data-passt` im Host
pro Ansicht gesetzt.

### P2: Sofortstart und „Aufstellung abschicken“ (2 Sitzungen)

1. **Ein Bauweg für die Eingaben.** Neue Route `GET …/arena-eingabe?fixture=…` liefert genau das
   Paket, das `bereiteFixturesVor()` dem Runner gibt: Kader, Aufstellung, Saat, Mutatoren,
   `eingabeHash`. Der Host baut seine Eingaben nicht mehr selbst, sondern nimmt dieses Paket.
   `arena-host-seed.ts` und das Nachladen der Bögen entfallen im Spieltagsfall; die freie
   Battle-Arena behält ihren Weg.
2. **Abschicken-Moment:** Knopf „Aufstellung abschicken → Arena“ in der Einsatzliste. Er friert die
   eigene Aufstellung ein, stellt fehlende KI-Aufstellungen fertig und stößt den Vorlauf an (F2b
   regelt das Zurücknehmen).
3. **Abspielen ohne Snapshot:** `bestimmeArenaSpieltagAnsicht` entscheidet nach Disziplin und
   Spielplan, ob ein Motor-Spiel zählt, nicht nach `resolutionSource`. Die Wiedergabe startet aus
   dem Paket. Das Buchen wartet am Ende auf `ready` und vergleicht den Fingerabdruck (P1).
4. **Vorlauf über Node** (#1328 nach Merge): `arenaModus` für alle Auslöser auf den Node-Runner,
   Chromium als Rückfall. Das senkt die Server-Last und die Wartezeit am Ende.

**Abnahme:** Zeit von „Abschicken“ bis zur ersten Bewegung in der Arena unter 3 s auf dem CX23;
Buchung am Ende unter 10 s; E2E aus P1 weiter grün.

### P3: Vierer-Formate auf denselben Standard (1–2 Sitzungen)

1. Fingerabdruck je Pod: Platz und Punkte je Team plus Boxscore, für Mini-DM-FFA, Battlefield-Pod
   und Bahn-Pod.
2. Bahn-Pod: die 24-Saaten-Treueprüfung zu Ende führen (`miss-sendedauer.mjs`).
3. Eingabepaket je Pod über die Route aus P2.
4. Ergebnisanzeige je Pod: alle vier Teams mit Platz und Punkten statt „Platz x von 4“.

**Abnahme:** E2E mit allen drei Pod-Arten in drei Engines bei 100 % Gleichheit; Spieltag 1 von
Chris' Save (Battlefield-Pod) live grün.

### P4: Formkarten und Intensität in den Motor (nur nach F1 = ja; 2–4 Sitzungen)

1. `ArenaSpieler` bekommt `form` (Summe der gespielten Karten des Spielers für diese Disziplin) und
   die Seite `intensitaet`. Der Motor nimmt sie statt `zieheFormkarten(saat)` und `STUFE`. Die
   Ersatzkarten bleiben nur im freien Entwurf.
2. Pflichtabnahme **aller** Motor-Disziplinen: rho je Spiel > 0,80, Pp ≤ 25 auf zwei Saatströmen
   (`scripts/miss-alle-disziplinen.mjs`, `messe-arena-einfluss.mjs`). PPS-Referenzen neu ziehen.
   Fingerabdruck neu setzen, begründet. Erst messen, dann scharf schalten; eine Disziplin, die
   durchfällt, bleibt mit Ersatzkarte und Hinweis.
3. Ein Ausschlag von ±8 statt 0–8 kann rho drücken (mehr Rauschen gegen die Eignung). Das muss die
   Messung zeigen, nicht die Hoffnung.

**Abnahme:** Abnahmetabelle `data/generated/disziplin-abnahme.json` grün;
`tests/disziplin-abnahme-guard.test.ts` grün; Arena zeigt die gespielte Karte.

### P5: Spieltags-Regie, das Management-Mode-Gefühl (2 Sitzungen, UX nach Fable-Rat)

- Vorspann je Disziplin: Gegner, Mutatoren, die eigenen Formkarten.
- D1 → Zwischenstand → D2 → Spieltagsergebnis (F4).
- Spieltagsübersicht aller Begegnungen, KI-Duelle als Wiedergabe auf Wunsch (F3).
- Pod-Tabellen.
- Wiedergabe verpasster Spieltage, falls F5 = ja.

### Danach, aus dem 20-Disziplinen-Fahrplan

TDM (W2), Hockey (W1d), Football (Q-F) erscheinen in der Arena von selbst, sobald sie in
`ARENA_RESOLVED_DISCIPLINE_IDS` stehen. Voraussetzung ist B1 (P0, Punkt 3) und die
Anzeige-Treueprüfung aus P1 für ihr Chassis.

### Reihenfolge und Abhängigkeiten

```
P0 ──▶ P1 ──▶ P2 ──▶ P3 ──▶ P5
        │      ▲
        │      └── #1328 (Node-Runner) gemergt
        └────────▶ P4 (nur bei F1 = ja; braucht P1s Fingerabdruck als Kontrollnetz)
B1 (516396fdf) ── vor jeder Freischaltung von TDM / Hockey / Mini-DM-Duell
```

---

## 7. Fable als externer Berater: Brief vorbereitet, in dieser Runde nicht gefahren

Die Architekturweiche (Abschnitt 3) brauchte keinen Berater. Die Belege sind eindeutig: #1328
(Mathematik), die Fixture-Zahl und der Code des Buchungspfads. Offen und echte UX-Fragen sind
**F2b, F3, F4 und der Übergang „Abschicken → Arena“ (P5)**. In dieser Runde stand mir kein
Werkzeug für einen eigenen Unteragenten zur Verfügung. Der Brief für Fable steht deshalb fertig
hier und ist vor P5 zu fahren, spätestens parallel zu P2:

> Fable, eine UX-Frage zur Olympiade der Welten (Battle Mode). Der Spieler setzt seine Einsatzliste
> und schickt sie ab. Danach soll er „wie im Management Mode in die Arena gesendet werden“ und den
> echten Spieltag sehen: zwei Disziplinen, je eine eigene Begegnung gegen eine KI. Das ist ein Duell
> oder ein Vierer-Pod. Ein Spiel dauert 1–5 Minuten, Quick-Sim gibt es. Die anderen 15 Duelle bzw.
> 7 Pods des Spieltags laufen gleichzeitig zwischen KI-Teams. (1) Wie soll sich der Übergang
> Einsatzliste → Arena anfühlen: Vorspann, Countdown, Gegnervorstellung? (2) D1 und D2
> automatisch nacheinander oder frei wählbar? (3) Wie zeigt man die anderen Begegnungen, ohne dass
> es zur Tabellenwüste wird: Konferenz-Ticker, Highlights, anwählbare Wiedergabe? (4) Was ist
> der richtige Moment, an dem die Aufstellung endgültig eingefroren wird? Vorbilder: Football
> Manager Match-Engine, Blood Bowl, Auto-Chess-Formate, Fernseh-Konferenzschaltung. Bitte
> konkrete Empfehlungen mit Begründung, keine Optionenliste ohne Wertung.

---

## 8. Was dieser Plan ausdrücklich nicht tut

- Kein Ersatz der freien **Battle Arena** (Entwurfsreiter `battleArena`). Sie bleibt freie
  Spielwiese und bucht nichts (Doku 02.11., Punkt 5).
- Kein Buchen aus dem Browser (Abschnitt 3).
- Keine Schaukämpfe für Brücken-Disziplinen. „Das was auf dem Feld passiert soll auch das in den
  Stats sein“ (Chris, 10.11.).
- Keine neuen PixelLab-Figuren oder -Animationen. Szenen und Requisiten für Vorspann und
  Zwischenstand (P5) sind frei.
- Keine Änderung an der Eignungsmatrix. P4 ändert die Mechanik, nicht die Gewichte.

## 9. Quellen

- `lib/battle/arena-headless-runner.ts` (Kopfkommentar, `runArenaFixtures` u. a.),
  `lib/battle/arena-vorlauf-service.ts`, `lib/battle/arena-eingabe-hash.ts`,
  `lib/battle/arena-seed.ts`, `lib/battle/arena-host-seed.ts`,
  `lib/battle/arena-resolved-disciplines.ts`
- `lib/foundation/battle-arena/arena-spieltag-ansicht.ts`, `arena-kader-adapter.ts`,
  `arena-aufstellung-adapter.ts`
- `app/foundation/battle-arena/FoundationBattleArenaHost.tsx`,
  `app/foundation/discipline-stage/DisciplineStageArena.tsx`,
  `app/foundation/legacy-lineup-lab/LineupNewLook.tsx`
- `lib/resolve/legacy-matchday-resolve-engine.ts` (Arena-Override, Pods),
  `lib/foundation/matchday-resolve-snapshot.ts`
- `public/mockups/battle-mode.engine.js` (`zieheFormkarten` :8609, `STUFE` :8607,
  `anzeigeSechzigstel` :52350, `ZEIT_DEHNUNG` :51998, Mini-DM-Pod ~57 590)
- Dokus: `battle-arena-spieltag-anbindung-02-11.md`, `battle-arena-auto-run-anbindung-plan-16-10.md`,
  `arena-vorlauf-latenz-befund-18-10.md`, `sendedauer-messung-09-11.md`,
  `formkarten-kopplung-messrunde-15-10.md`, `stand-aller-disziplinen.md` (23. Nachtrag)
- PRs: #1372 (gemergt 10.11., `fb8708ab7`), #1328 (offen, Node-Runner, Mathematik-Befund),
  #1358 (Einsatzliste-Revamp, offen); Commits `516396fdf` und `5fa5d1105` (nur Branch)
- Live-Abbild `live-save` 10.11. 13:10: Battle-Save `new-game-1793476611202-0dwpok`, Spieltag 1
  `planning`, 0 Einsatzlisten, 734 Formkarten (Werte −8 bis +8)
