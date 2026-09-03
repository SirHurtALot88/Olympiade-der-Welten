# Boxscore an die Spieler-PPs gehängt (Battle-Mode-Basketball)

Branch `claude/boxscore-an-pps`, abgezweigt von `origin/claude/sonde-alle-disziplinen`. Auftrag:
Punkt C aus `docs/design/projekt-ueberwachung-opus.md` Abschnitt 3.1 — „Den Boxscore an die
Spieler-PPs hängen“, dort als „der größte einzelne Wirkungssprung im ganzen Backlog“ eingestuft,
weil ohne diesen Schritt die gesamte Rangtreue-Arbeit an Basketball für Chris' echte Spielstände
unsichtbar bleibt (Abschnitt 1.4 desselben Berichts).

## Der Befund, bestätigt

`ARENA_RESOLVED_DISCIPLINE_IDS` (`lib/resolve/battle-mode-arena-team-points.ts`) enthält genau
eine Disziplin: `"basketball"`. Für sie bestimmte der Arena-Motor bislang **nur** das Team-Ergebnis
(Sieg/Unentschieden/Niederlage, 2/1/0 Punkte — Chris' Entscheidung vom 30.08., unverändert). Die
individuellen Spieler-PPs liefen weiter über `distributeRankPointsToPlayers()`
(`lib/resolve/legacy-matchday-resolve-engine.ts`), verteilt nach dem alten PPS-Rang — der Boxscore,
den der Arena-Motor Zug für Zug berechnete, wurde berechnet und verworfen. Ob der eignungsbeste
Spieler im simulierten Spiel den besten Boxscore produzierte, änderte für Chris' Spielstand bislang
buchstäblich nichts.

## Was sich geändert hat

**Individuelle Basketball-PPs kommen jetzt aus dem echten Arena-Boxscore-Impact, nicht mehr aus der
PPS-Rang-Formel.** Nur Basketball, nur in einem Battle-Mode-Save — jede andere Disziplin und jeder
andere Modus laufen byte-identisch weiter wie vorher.

### Der Blocker war lösbar — und ist es jetzt

Der Kommentar in `battle-mode-arena-team-points.ts` (vor dieser Änderung) hielt fest, dass Chris
individuelle PPs „langfristig von den Team-Punkten entkoppeln und liga-relativ aus dem Impact Rating
der Arena-Simulation skalieren“ will, aber das sei „bewusst noch nicht umgesetzt (fehlende
Liga-Kontextdaten)“. Zwei Funde änderten das:

1. **Es gibt bereits einen ausführlichen, zu weiten Teilen von Chris abgenommenen Modellvorschlag**
   dafür: `docs/design/battle-mode-pps-modell-plan.md` (31.08., vor dieser Umsetzung geschrieben,
   nie gebaut). Er beantwortet die schwierigsten Fragen bereits:
   - **Referenz-Pool: „ENTSCHIEDEN (31.08.): gemeinsam über beide Ligen“**, nicht pro Liga
     getrennt.
   - **`DISCIPLINE_MAX`: „ENTSCHIEDEN (31.08.): fest“**, nicht mit der Feldgröße skaliert — nur der
     konkrete Zahlenwert selbst war noch offen ("Rückfrage an Chris folgt separat").
   - Rohwert = `MOTOREN[fd].wert()`, exakt der Wert, den der Mockup-Motor selbst als „Impact“
     zeigt — kein zweiter Rechenweg.
   - Perzentilrang gegen den Pool, linear auf `DISCIPLINE_MAX` abgebildet — mathematisch entstehen
     daraus genau die Ankerpunkte, die Chris beschrieben hat („Topspieler nahe Höchstwert, Mitte
     ~halb, schwacher Spieler nahe null“), ohne dass drei Zahlen einzeln gesetzt werden müssten.
2. **„Fehlende Liga-Kontextdaten“ ist inzwischen falsch.** Der Plan-Kommentar bezog sich auf einen
   Stand VOR PR7/8 des Battle-Mode-Plans, als `runBattleModeArenaMatchday()` noch nicht existierte.
   Heute läuft genau diese Funktion bereits gegen die echte Resolve-Pipeline und hält — bevor sie
   zurückkehrt — die Boxscores **beider** Liga-Stufen eines Spieltags gleichzeitig im Zugriff. Der
   fehlende Kontext war zum Zeitpunkt des Plans real; er ist es heute nicht mehr.

Damit blieb nur noch **eine** echte, unbeantwortete Frage übrig (die Höhe von `DISCIPLINE_MAX`) —
kein Blocker im Sinne von „ohne weitere Kontextdaten nicht sauber umsetzbar“, sondern eine einzelne,
klar benannte, leicht nachträglich korrigierbare Konstante. Das war der Punkt, an dem dieser Auftrag
entschied: umsetzen, nicht zurückstellen.

## Die Umsetzung

### 1. Boxscore-Einträge auf echte Spieler zurückführen

Der Mockup-Motor (`public/mockups/battle-mode.engine.js`) führt Boxscore-Werte **nur nach Namen**
(`wert:()=>{const o={}; for(const u of [...FSTEAM[0],...FSTEAM[1]]) o[u.n]=feldspielWert(u,fd)}`) —
kollidieren zwei Namen im selben Duell, überschreibt der zweite den ersten, bereits im Motor selbst.
`ArenaSpieler` (`lib/foundation/battle-arena/arena-kader-adapter.ts`) trägt deshalb jetzt zusätzlich
`id: string` (reines Passthrough, der Motor liest es nicht), und `arena-headless-runner.ts` nutzt es,
um jeden Boxscore-Namen **eindeutig** auf `playerId` + `side` zurückzuführen — `null` bei Kollision
oder fehlendem Match, statt zu raten.

**Ist das Kollisionsrisiko real?** Nachgemessen am aktuellen `live-save`-Abbild (per
`OLY_APP_SQLITE_PATH`, s. `CLAUDE.md`): 2.984 Spieler, **2.984 unterschiedliche Namen** — keine
einzige Kollision, weder liga-weit noch team-intern. Chris' echte Spielernamen sind kuratiert (kein
generischer `Praefix+Suffix`-Generator), nicht der synthetische Namenspool aus
`lib/player-generator/player-generator-service.ts` (20 Präfixe × 14 Suffixe = 280 Kombinationen, bei
denen eine Kollision über ~300 Spieler nahezu sicher wäre). Das Risiko ist damit in der Praxis
gering, aber der Code behandelt es trotzdem defensiv (s. u.), weil die Zuordnung sonst leise falsche
Spieler beträfe — echte PPs, kein Messrauschen.

### 2. Individuelle PPs: Perzentilrang gegen den Liga-Pool

`computeIndividualBoxscorePpsFromFixtureResults()` (`lib/resolve/battle-mode-arena-team-points.ts`):

1. Sammelt alle eindeutig zugeordneten Boxscore-Werte **aller** Fixtures, die ihr übergeben werden.
2. `runBattleModeArenaMatchday()` sammelt dafür **beide** Liga-Stufen eines Spieltags, bevor es
   zurückkehrt — das ist der „gemeinsame Referenz-Pool“ aus dem Plan.
3. Perzentilrang je Spieler gegen diesen Pool (binäre Suche auf sortierter Liste — dasselbe Muster
   wie `percentileOf()` in `lib/scouting/player-axis-star-rating.ts`, hier lokal nachgebaut, um
   dieses Modul nicht an ein Scouting-internes Modul zu koppeln).
4. `PPs = (Perzentil / 100) * BASKETBALL_INDIVIDUAL_PPS_MAX`.

`BASKETBALL_INDIVIDUAL_PPS_MAX = 6.6` — der eine noch offene Zahlenwert aus dem Plan. Von den zwei
dort genannten Kandidaten (3,3 / 6,6) gewählt, weil der Plan selbst festhält, dass 6,6 „Chris'
eigenes Beispiel [5/2,5/0,5] am nächsten trifft“. **Das ist eine dokumentierte, begründete
Entscheidung mangels präziserer Vorgabe — keine Vermutung, keine versteckte Annahme.** Es ist EIN
benannter, exportierter Wert; eine spätere Korrektur ist eine Ein-Zeilen-Änderung.

### 3. Anwendung im Resolve — pro Spieler unabhängig, nicht pro Team-Seite

`buildLegacyMatchdayResolvePreview()` (`lib/resolve/legacy-matchday-resolve-engine.ts`) bekommt eine
neue, optionale Option `arenaIndividualBoxscorePpsByPlayerId`. Für jeden Spieler in einer
Battle-Mode-Basketball-Aufstellung gilt:

- Hat die Map einen Eintrag für **genau diese** `playerId` → `pointsAwarded` wird exakt dieser Wert,
  `arenaBoxscoreImpactApplied` wird `true`.
- Sonst → unverändert der alte PPS-Pfad (`distributeRankPointsToPlayers()`), `arenaBoxscoreImpactApplied`
  bleibt `false`/fehlt.

**Wichtig: das ist pro Spieler entschieden, nicht pro Team-Seite.** Ein einzelner Mitspieler, dessen
Name im Boxscore nicht eindeutig war, fällt nur für sich selbst auf PPS zurück — seine Teamkollegen
bekommen trotzdem ihre echten Boxscore-Werte. Das ist eine bewusste Verbesserung gegenüber einem
früheren Zwischenstand dieser Änderung (s. Git-Historie), der bei einer Lücke die ganze Seite
zurückfallen ließ; die Team-weite Rückfallregel war ein Artefakt des zunächst selbst entworfenen
(und wieder verworfenen) Team-Rang-Modells, nicht Teil des jetzt umgesetzten Perzentil-Modells.

**Individuelle PPs sind jetzt echt von den Team-Punkten entkoppelt** — Summe(Spieler-PPs) muss nicht
mehr `teamPoints` ergeben, anders als beim alten PPS-Pfad, wo das eine harte Invariante war. Das ist
Chris' ausdrücklicher Wunsch (`battle-mode-pps-modell-plan.md` Abschnitt 0: „genau diese Kopplung
will Chris für Battle Mode auflösen“), nicht vergessen.

Sicherheitsrahmen unverändert: die Map wird nur angewendet, wenn `isBattleModeSave(gameState) &&
disciplineId === "basketball"`. Jede andere Disziplin, jeder andere Modus — auch mit derselben Map
im Zugriff — bleibt exakt beim alten Pfad (regressionsgetestet, s. u.).

## Offene, von Chris nicht beantwortete Fragen (bewusst NICHT in dieser Änderung entschieden)

Direkt aus `battle-mode-pps-modell-plan.md` Abschnitt 7 übernommen, nicht neu erfunden:

1. **Der konkrete Zahlenwert für `BASKETBALL_INDIVIDUAL_PPS_MAX`** — hier 6,6 gewählt (s. o.),
   Chris hat sich auf keine der beiden Kandidatenzahlen festgelegt.
2. **Nur eingesetzte Spieler im Pool, oder auch nominierte, aber nicht gefelderte?** Hier so
   entschieden: nur tatsächlich gefelderte, eindeutig zugeordnete Boxscore-Einträge zählen — eine
   nominierte Bank taucht gar nicht erst im Boxscore auf.
3. **Kleine Stichprobe bei `playerCount = 2`** (32-64 Pool-Größe statt 96-192): bewusst nicht
   abgefedert, wie im Plan vorgeschlagen — reale Spielerleistungen, keine simulierten Läufe.
4. **Linear oder gebändert?** Linear umgesetzt, wie im Plan als „erster Wurf“ vorgeschlagen.
5. **Rolling-Historie über mehrere Spieltage/Saisons.** NICHT umgesetzt — braucht
   `seasonState.arenaMatchResultLogs`, das laut Plan noch nicht existiert (kein Treffer im Code) und
   explizit außerhalb dieser Änderung liegt.
6. **Fließen diese PPs in dieselben Saison-Ledger/Progressions-Töpfe wie PPS-PPs?** NICHT
   beantwortet. Diese Änderung setzt ausschließlich `pointsAwarded` in der Resolve-Preview — sie
   rührt `lib/foundation/player-points-total.ts`, `lib/foundation/season-points-ledger.ts` oder
   Markwert-/Progressions-Berechnungen nicht an. Ob ein „Perzentil-Anteil an einem Spieltag“
   (strukturell neu) genauso in bestehende Saison-Leaderboards einzahlen soll wie ein „Anteil am
   Team-Rang“ (die alte Bedeutung), ist eine echte Produktentscheidung, die vor einem produktiven
   Rollout beantwortet werden sollte. **Empfehlung für den nächsten Schritt:** Chris fragen, bevor
   `pointsAwarded` aus dieser Änderung erstmals in einen echten Spielstand gebucht wird.

## Absicherung

`npm test` (vitest) läuft vollständig grün (siehe Testlauf-Protokoll unten). Neu bzw. erweitert:

- **`tests/arena-headless-runner.test.ts`** (echtes Chromium): zwei neue Fälle — eindeutige Namen
  liefern `playerId`/`side` korrekt zurück; zwei Spieler mit identischem Namen im selben Duell
  liefern für BEIDE `playerId: null`/`side: null`, statt zu raten.
- **`tests/battle-mode-arena-team-points.test.ts`**: `computeIndividualBoxscorePpsFromFixtureResults()`
  vollständig durchgetestet — Perzentil-Randfälle (Minimum, Maximum, Mitte), gemeinsamer
  Liga-Pool (ein Spieler, der in seiner eigenen schwächeren Liga Erster wäre, aber im
  liga-übergreifenden Pool nicht), Ausschluss nicht zugeordneter Einträge (verzerren weder den Pool
  noch bekommen sie selbst PPs), leerer Pool. Dazu `runBattleModeArenaMatchday()` liga-übergreifend
  gegen einen gemockten Runner (kein Browser nötig).
- **`tests/battle-mode-arena-resolve-engine.test.ts`**: die Kernbehauptung des Auftrags — zwei
  Spieler mit gleichem Team-Ergebnis, aber unterschiedlichem Boxscore, bekommen unterschiedliche PPs,
  bewiesen durch eine ABSICHTLICH GEGENLÄUFIGE PPS-Zahl (der PPS-stärkere Spieler bekommt bei
  umgekehrtem Boxscore-Impact weniger PPs). Dazu: ein Spieler ohne eigenen Boxscore-Eintrag fällt nur
  für sich selbst zurück, sein Teamkollege bleibt unberührt; und der Regressionsbeweis aus
  Auftragspunkt 4 — Fechten (eine andere Disziplin desselben Spieltags/Teams) bleibt byte-identisch
  (`toEqual`), selbst wenn dieselbe Boxscore-Map einen (absichtlich falsch platzierten) Eintrag für
  eine ihrer eigenen Spieler-IDs trägt.
- **`tests/battle-mode-arena-matchday-resolve-e2e.test.ts`** (echtes Chromium, kein Mock): der
  vollständige Beweis mit einem echten simulierten Spieltag — ein echter Arena-Lauf liefert einen
  echten Boxscore, `runBattleModeArenaMatchday()` rechnet daraus echte Perzentil-PPs, und die
  Resolve-Pipeline setzt sie bitgenau. Die Lineup-Aufstellung wird dafür NICHT geraten, sondern aus
  dem echten Ergebnis rekonstruiert (welche Spieler der Motor tatsächlich felderte), um jede
  Kopplung an motor-interne Auswahllogik zu vermeiden.

**Regressionsgarantie für jede andere Disziplin/jeden anderen Modus:** vier bestehende Tests in
`battle-mode-arena-resolve-engine.test.ts` (Manager Mode, Nicht-Basketball-Disziplin, fehlender
`gameState`, sowie der oben genannte Fechten-Fall) prüfen `resolutionSource === "pps"` bzw.
`toEqual()`-Gleichheit mit dem Lauf ohne jede Arena-Map — nichts an diesen Pfaden ändert sich.

## Kern-Dateien

- `lib/foundation/battle-arena/arena-kader-adapter.ts` — `ArenaSpieler.id`
- `lib/battle/arena-headless-runner.ts` — `playerId`/`side` je Boxscore-Eintrag
- `lib/resolve/battle-mode-arena-team-points.ts` — Perzentil-Modell, `BASKETBALL_INDIVIDUAL_PPS_MAX`
- `lib/lineups/legacy-lineup-types.ts` — `arenaIndividualBoxscorePpsByPlayerId`-Option
- `lib/resolve/legacy-matchday-resolve-engine.ts` — Anwendung auf `pointsAwarded`
- `lib/resolve/legacy-matchday-resolve-types.ts` — `arenaBoxscoreImpactApplied`
- `lib/season/arena-matchday-resolve-service.ts` — Verdrahtung in den echten Hintergrundlauf
- `docs/design/battle-mode-pps-modell-plan.md` — das umgesetzte Modell (Referenz, nicht verändert)
