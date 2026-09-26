# Hockey — Gameplay- und Taktik-Konzeptreview (Opus, 26.09.)

Chris (laut Auftrag dieser Runde): „balancing bringt noch nichts wenn die Konzepte nicht perfekt
sind." Also nicht an Zahlen drehen, sondern zuerst fragen, ob das **taktische Gameplay** von
Eishockey überhaupt in der Mechanik steckt — unabhängig davon, was rho dazu sagt.

Dieses Dokument ist reines Konzept — kein Produktionscode, keine Motoränderung, kein Rezept.
Alle Zahlen in den Vorschlägen sind **Vorschläge** und als solche markiert; was gemessen ist,
steht mit Werkzeug daneben. `engine.js` meint `public/mockups/battle-mode.engine.js` (Stand
`main` `6b471366`, 26.09.). Form folgt `docs/design/climbing-neukonzept-22-09.md`.

Faktenbasis, nicht neu vermessen: `CLAUDE.md` (Hockey-Abschnitt), `hockey-opus-review-nhl.md`,
`hockey-zufriedenstellend.md`, `hockey-zoneneintritt-umsetzung.md`,
`hockey-ausdauer-checks-konzept-13-09.md`, `hockey-puste-kalibrierung-13-09.md`,
`hockey-naechster-hebel-recherche-fable.md`, `stand-aller-disziplinen.md` (Abschnitt 1a und
„Scoring und Produktion"). Eine einzige eigene, kleine Sonde kam dazu (Abschnitt 0.3), weil für
die Taktik-Frage drei Zahlen fehlten, die keines der Dokumente erhoben hat.

## Kurzfassung

- **Das ehrliche Urteil: Hockey ist auf der Ereignis-Ebene gut, auf der Mannschafts-Ebene ein
  Basketball-Gerüst, und auf der Manager-Ebene fast leer.** Schuss nach Distanzstufe mit
  NHL-kalibrierten Quoten, Torwart im Schusswinkel, Block, Abpraller in die Ecke, Bully als
  TECHNIK-Duell, Bodycheck mit Strafe, Bandenduell, Passlaufzeit, A1/A2 — das ist solide und in
  mehreren Runden gegen echte Analytik gehalten. Aber *wie eine Mannschaft spielt*, entscheidet
  derselbe Apparat wie im Basketball: Ballbesitz-Angriffe mit 8-Sekunden-Schussuhr
  (`engine.js:6473`, `:12011`), reine Manndeckung mit Hilfe (`zuordneDeckung`, `:9401`),
  Angriffsformation neu sortiert nach SCHUSS_NAH bei jedem Besitzwechsel (`zuordneSlots`,
  `:7843`). Es gibt kein Verteidigungssystem, kein Forechecking, keine Special-Teams-Formation,
  kein Spielstand-Verhalten, keinen leeren Kasten und keine taktische Entscheidung des Managers
  außer der Aufstellung und dem Torwart.
- **Drei neue Messungen machen das greifbar** (Sonde über 40 Spiele, Abschnitt 0.3):
  (1) **Überzahl ist kaum ein Vorteil.** Die Überzahl-Mannschaft schießt je Sekunde genauso oft
  wie bei Gleichzahl (0,194 gegen 0,196 Versuche/s), die Unterzahl noch 59 % davon. Unterzahl-Tore
  fallen in **10,5 %** aller Strafen — rund das Drei- bis Vierfache der NHL-Größenordnung (~3 %).
  (2) **Es gibt keinen Spielstand-Effekt.** Die führende Mannschaft schießt sogar leicht *mehr*
  (0,197/s) als die zurückliegende (0,184/s); real ist es umgekehrt und einer der stabilsten
  Befunde der Eishockey-Analytik. (3) **Es gibt keinen Aufbau-Angriff.** 86 % aller Tore fallen
  binnen 4 s, 99 % binnen 8 s nach dem letzten eigenen Puckgewinn (Median 2,5 s); real teilen
  sich Rush- und Forecheck/Cycle-Tore etwa 55:45.
- **Die Aufstellung ist taktisch folgenlos, bis auf den Torwart.** Die sechs Hockey-Slots
  (Power Forward, Defensive Wall, Playmaker, Transition Runner, Slot Finisher, Goaltender,
  `lib/lineups/matchday-slot-roles.ts:169-183`) verändern nur den Attributaufschlag
  (`slotAufschlag`, `engine.js:7463`). Wo ein Spieler auf dem Eis steht, entscheidet allein sein
  SCHUSS_NAH-Rang (`:7852`). Die „Defensive Wall" verteidigt nicht anders als der „Slot Finisher".
  Basketball hat dafür einen Positions-Modifier (`BASKETBALL_POS_MOD`, `:7378`, `:7470`), Hockey
  nicht.
- **Die NHL-Recherche rahmt, wie viel Taktik darf: sie verändert das *Wie*, nicht das *Wer*.**
  Talent dominiert den Ausgang; Systeme verschieben Schussanteile (Spielstand-Effekte), Tor-
  Herkunft (Rush gegen Cycle) und Special-Teams-Effizienz. Genau diese Rolle passt zur gesperrten
  Matrix und zur rho-Pflicht: eine Taktikschicht soll Spiele *anders aussehen lassen* und dem
  Manager Entscheidungen geben, nicht die Rangfolge der Eignung umwerfen.
- **Priorisierung (Abschnitt 3):** T0 Präsentation der Spielzustände (rho-frei) → **T1 Endphase:
  Torwart raus und Führungs-Riegel** (billig, dramatisch, RNG-Kaskade nur in den letzten
  Sekunden) → **T2 Special Teams als eigener Zustand** (1-3-1-Überzahl, Box-Unterzahl, Klären
  statt Kontern) → **T3 Rollen werden Positionen** (die Aufstellung bekommt eine Folge, Primär-/
  Nebenweg-Muster) → T4 eine Mannschaftstaktik vor dem Spiel (Forecheck-System, Schattendeckung)
  → T5 als Grundsatzfrage an Chris: Schussuhr ersetzen, Zonenbesitz/Cycle. **Nicht** empfohlen:
  Linienwechsel (es gibt keine Bank), Momentum-Mechanik, mehr Checks, der Zoneneintritt ein
  drittes Mal in derselben Bauform.
- **Eine Korrektur an einem älteren Vorschlag:** H3 aus `hockey-opus-review-nhl.md` („alle 20 s
  rotiert der sechste Feldspieler ein") ist mit dem heutigen Spieltag **nicht baubar** — ein
  Hockey-Spieltag stellt sechs Spieler (`engine.js:4733`, `size:6`), einer davon ist Torwart. Es
  gibt keinen sechsten Feldspieler und keine Bank. Echte Wechsel setzen eine Kaderentscheidung
  voraus, die das ganze Spiel betrifft (Abschnitt 4).

---

## 0. Ist-Zustand, nachgelesen

### 0.1 Welche taktischen Elemente die Mechanik heute abbildet

| Element | Im Motor? | Wie | Fundstelle |
|---|---|---|---|
| Angriffsformation | ja, starr | Netfront / Half-Wall ×2 / Point ×2 (+ hoher Slot nur ohne Torwart), sortiert nach SCHUSS_NAH, neu bei jedem Besitzwechsel | `SLOTS_HOCKEY` `:7772`, `zuordneSlots` `:7843` |
| Verteidigungssystem | nein | gieriges Mann-gegen-Mann nach Abstand, Hilfe/Doppeln aus Basketball, kein Zonenspiel, kein Schwarm tief | `zuordneDeckung` `:9401` |
| Forechecking / Backchecking | implizit | es gibt kein System; Checks fallen zu 40 % im Angriffsdrittel des Gecheckten, weil Manndeckung überall mitläuft (13-09-Konzept 3.3) | — |
| Neutrale Zone / Trap | nein | nach Besitzwechsel sprinten beide Mannschaften in die jeweils andere Angriffsformation; Fastbreak-Fenster 3 s | `startFastbreak` `:10883` |
| Zoneneintritt / Abseits / Icing | nein | zweimal als Zweikampf gebaut, verworfen (RNG-Kaskade bei n=24) | `hockey-zoneneintritt-umsetzung.md` |
| Angriffsdauer | künstlich | Schussuhr 8 s „als Tempo-Garantie", keine echte Eishockeyregel | `live.schussuhr` `:6473`, `erzwingen` `:12011` |
| Bully | ja | TECHNIK-Duell der beiden Nächsten, kein Wertposten (richtig so) | `bully` `:8524` |
| Bodycheck / Zweikampf | ja | ABWEHR gegen wirksame AUSDAUER, 38 % davon Strafe; nur am Puckführer | `versucheSteal` `:10754` |
| Strafen / Über-/Unterzahl | ja, als Zahl | 8 s kleine Strafe, Mindestbesetzung 3; Unterzahl nimmt symmetrische Plätze **derselben** Angriffsformation, keine eigene Überzahl- oder Unterzahl-Aufstellung | `:8092-8103`, `verhaengeStrafe` `:8166`, `UNTERZAHL_PLAETZE` `:7886` |
| Torwart | ja | steht auf der Puck-Tor-Linie, PARADE im Torfaktor und in der Abpraller-Kontrolle | `torwartZiel` `:8500`, `hockeySchussAusgang` `:10930` |
| Torwart-Duell / Schirm / Querpass | teilweise | kein Schirm-Effekt (K2 nie committed), kein Querpass-Zuschlag; Passqualität nach Geometrie (Slot, hinter dem Tor) existiert | `hockeyPassQualBonus` `:10634` |
| Linienwechsel / Eiszeit | nein | sechs Spieler je Spieltag, fünf Feldspieler spielen 100 % | `engine.js:4733` |
| Puste (Schicht-Ermüdung) | nur Anzeige | Vorrat, Kosten, Regeneration laufen; Wirkung auf Tempo/Wucht/Zweikampf auf 1 gesetzt, weil wirksam gemessen rho 0,669 → 0,616/0,628 | `puste` `:6433-6459` |
| Spielstand-Verhalten | kaum | nur: wer zurückliegt, sortiert **in der Drittelpause** die Slots 0,7/0,3 nach SCHUSS_NAH/FERN | `starteViertelpause` `:9578`, `liegtZurueck` `:8163` |
| Torwart raus / leeres Tor | nein | leeres Tor gibt es nur im Zweierspiel (`HK_TOR_SKALA_LEER`) | `:7960` |
| Momentum / Druckphasen | nein | kein Zustand | — |
| Manager-Taktik im Spiel | nein | Basketball hat „Fokus doppeln" (`berechneFokusAuto` `:7200`), Hockey nichts | — |
| Aufstellung → Rolle auf dem Eis | nur Torwart | Slot wirkt nur als Attributaufschlag; Position = SCHUSS_NAH-Rang | `bauSpieler` `:7461-7473`, `bestimmeTorwaerter` `:8488` |

### 0.2 Status: live, akzeptiert, mit Schranke

| Größe | Wert | Quelle |
|---|---|---|
| Arena-aufgelöst | ja, seit 04.09. (PR #780) | `stand-aller-disziplinen.md` „Scoring und Produktion" |
| rho je Spiel, alle 12 / nur Feldspieler | 0,669 [0,181] / 0,719 [0,182] | `data/generated/rangtreue-basislinie.json`, ebd. 1a |
| rho Saison, alle 12 / Feldspieler | 0,832 / 0,818 | ebd. |
| CI-Schranke | rot unter **0,615** (0,669 − 0,054) | `rangtreue-basislinie.json` `hockey.schranke` |
| Chris' Entscheidung | Rangtreue für den Live-Betrieb **ausdrücklich akzeptiert**, kein weiterer Rangtreue-Anlauf vorgesehen | `stand-aller-disziplinen.md` |
| Korridor (Einzelkader, n=24) | 4,13 Tore/Team, 37,8 Schüsse aufs Tor, Fangquote 89,1 %, 2,8 Strafen/Team | `miss-hockey-korridor.mjs` |
| Rhythmus | 111,9 Besitzwechsel je Spiel, Puckbesitz am Stück Median 1,15 s | 13-09-Konzept 3.4 |
| Offene In-Game-Meldungen zu Hockey | keine (`origin/bug-reports` durchsucht) | — |

**Die Konsequenz ist dieselbe wie bei Climbing:** jede Taktikänderung ist ein Eingriff in eine
laufende, abgenommene Disziplin — mit CI-Schranke, PPS-Referenz (eigene Torwart-Referenz,
`hockey-produktivierung.md`) und einer Latte, die nicht 0,80 heißt, sondern „nicht unter die
Schranke, und begründet, wenn unter 0,669".

### 0.3 Eigene Sonde: was Special Teams, Spielstand und Tor-Herkunft heute tun

**Offengelegt:** instrumentierte Kopie des Motors im Scratchpad. Eine einzige Zeile geändert:
`logZug` (`:9660`) hängt jedem Protokolleintrag zusätzlich `t:fsT`, den Spielstand und die
Feldstärke beider Seiten an. Kein `rr()`, keine Mechanik; das Repo ist unberührt. Gemessen über
`window.__arena.spiele("hockey", saat)` mit 40 Saaten (1337 + i·7919), **Einzelkader**
(SQUAD/OPP), nicht die Kader-Familie — für Taktik-Kennzahlen reicht das, für rho nicht.

| Größe | gemessen (40 Spiele) | NHL-Größenordnung | Lesart |
|---|---:|---:|---|
| Strafen je Spiel | 5,7 | ~6 | passt |
| Überzahl-Tore je Strafe | **18,9 %** | ~20 % (Liga-PP%) | passt — **aber aus dem falschen Grund**, s. nächste Zeilen |
| Unterzahl-Tore je Strafe | **10,5 %** | ~3 % (eigene Rechnung: typisch 8–10 SHG je Team in 82 Spielen bei ~250 Unterzahlen; Spitze Rangers 18) | **3–4× zu hoch** |
| Anteil Überzahl-Tore an allen Toren | 11,7 % | ~20 % (eigene Rechnung, ~0,6 PPG von ~3 Toren je Team und Spiel) | zu niedrig |
| Schussversuche/s der Überzahl-Seite | **0,194** | deutlich über Gleichzahl | = Gleichzahl (0,196 je Team) |
| Schussversuche/s der Unterzahl-Seite | **0,115** (59 % von Gleichzahl) | kleiner Bruchteil | viel zu hoch |
| Versuche/s, führend / zurückliegend | **0,197 / 0,184** | zurückliegend deutlich mehr (Score Effects) | **Vorzeichen verkehrt** |
| Tore binnen 4 s / 8 s nach eigenem Puckgewinn | **86 % / 99 %** (Median 2,5 s) | Rush ~55 %, Forecheck/Cycle ~45 % (5-gegen-5, Playoffs) | kein Aufbau-Angriff |
| Tore je Spiel | 9,2 | 6,1 | über dem Korridorwert 8,3 (`miss-hockey-korridor.mjs`, andere Saaten/Formkarten über `feldspielProbe`) — für die Anteile oben unerheblich |

„Puckgewinn" heißt hier: Steal, gewonnener Bully oder Defensiv-Abpraller dieser Seite. Die
Überzahl-Zeit ist als 8 s × Strafen genähert (1824 s von 9562 s, 19 %). Beides sind grobe
Näherungen; die Richtung jeder Zeile ist aber so deutlich, dass die Näherung sie nicht dreht.

**Was die Tabelle sagt:** Die Überzahl-Quote stimmt nur, weil der Mehrspieler-Effekt in der
Trefferquote je Schuss steckt (12,1 % gegen 9,9 % bei Gleichzahl) — nicht in dem, was eine echte
Überzahl ausmacht: die Unterzahl kommt kaum noch aus der Zone und schießt fast nicht mehr. Bei
uns spielt die Unterzahl ihr normales Angriffsspiel mit einem Mann weniger weiter, und die
Schussuhr zwingt beide Seiten alle acht Sekunden zum Abschluss.

### 0.4 Was ein Taktik-Umbau schon vorfindet

| Was die Taktik braucht | Existiert als | Fundstelle |
|---|---|---|
| Formation je Situation | `FORMATION()` wählt die Tabelle je Disziplin; `UNTERZAHL_PLAETZE` wählt je Feldstärke — eine dritte Weiche „nach Spielzustand" ist dieselbe Bauform | `:7794`, `:7886` |
| Ein sechster, zentraler Platz | „hoher Slot" steht schon in `SLOTS_HOCKEY` (Index 5) — das ist der **Bumper der 1-3-1** | `:7778` |
| Spielstand-Weiche | `liegtZurueck(seite)` | `:8163` |
| Positions-Modifier je Slot | `BASKETBALL_POS_MOD` (nur Basketball) | `:7378`, `:7470` |
| Manager-Eingriff in die Deckung | `fokusZiel`/`berechneFokusAuto` (nur Basketball) | `:7200`, `:9361-9374` |
| Klären an die Bande | der Torwart-Zweig in `entscheideBallaktion` kann es schon | `:9812-9822` |
| Mehrspieler-Deckung | „Überzahl deckt doppelt" in `zuordneDeckung` | `:9429-9452` |
| Spielphasen mit eigener Aufstellung | `fsLive.phase` (Bully, Freiwurf, Snap, Drittelpause) | `:9352-9360` |
| Plan-Muster aus der Bahn | `plaene`/`planJeSlot` (sparsam/stetig/angriff) als Vorbild für eine Mannschaftstaktik | `BAHN_ART.*` |

---

## 1. Was echtes Eishockey taktisch ausmacht — und wie viel davon über Sieg entscheidet

### 1.1 Die Taktik-Bausteine der NHL

| Baustein | Was es ist | Quelle |
|---|---|---|
| **Forecheck-Systeme** | 2-1-2 (aggressiv: zwei Stürmer tief, erzwingt Fehler), 1-2-2 (passiv: ein Stürmer lenkt nach außen, vier riegeln die neutrale Zone ab) | Wikipedia „2-1-2 forecheck"; icehockeysystems.com; thecoachessite.com |
| **Neutral Zone Trap** | vier Spieler in der neutralen Zone, einer lenkt an die Bande; Devils der 1990er | Wikipedia „Neutral zone trap" |
| **Verteidigung in der eigenen Zone** | 2025-26: **12 Teams Mann gegen Mann, 20 Teams Box+1-Varianten**; Hybrid: Schwarm unterhalb der Bullypunkte, Mann gegen Mann weiter oben | behindthekeyboard (Substack), thecoachessite.com „Hybrid" |
| **Überzahl-Formationen** | **1-3-1** ist heute Standard der Spitzenteams (ein Point, drei quer, einer vor dem Tor; die zwei an den Bullypunkten sind Direktschützen); daneben Umbrella | thecoachessite.com, icehockeysystems.com, kingcobrashockey.com |
| **Unterzahl-Formationen** | Box (2-2, am häufigsten) und Diamant (1-2-1, nimmt den Point-Quarterback weg) | judgemate.com, pressreader/Edmonton Journal 2024 |
| **Wechsel / Schichten** | Schicht ~47 s; in den ersten 15 s einer Schicht überdurchschnittlich viele Schüsse, ab ~40 s kippt es deutlich zu Schüssen gegen | Hockey Answered, HPT, PensBurgh |
| **Letzter Wechsel** | die Heimmannschaft stellt ihre Reihe nach dem Gegner auf — Matchups, Schattenreihe gegen den Top-Sturm | Hockey Answered, Dear Sports Fan |
| **Spielstand-Effekte** | wer zurückliegt, schießt mehr, wer führt, zieht sich zurück („defensive shell"); so groß, dass die Analytik „score-adjusted Corsi" erfunden hat | Evolving-Hockey Glossar, Hockey Graphs, Wikipedia „Corsi" |
| **Torwart raus** | Modelle empfehlen bei einem Tor Rückstand ~6 min vor Schluss, Praxis ~1–2 min | NYU/Brown & Asness 2018; Beaudoin & Swartz (SFU); Hockey Graphs 2020 |
| **Rush gegen Cycle** | 5-gegen-5-Tore historisch etwa 55:45 zwischen Rush und Forecheck/Cycle | allthreezones (Substack) |

### 1.2 Wie viel davon über den Ausgang entscheidet

Ehrlich, weil es die Priorisierung bestimmt:

- **Talent schlägt System.** Rund 38 % der Tabellenstreuung einer NHL-Saison ist Glück
  (`hockey-opus-review-nhl.md` 0.3); was übrig bleibt, erklärt sich überwiegend aus
  Spielerqualität. Systeme sind Stil- und Randentscheidungen.
- **Special Teams sind der messbarste taktische Einzelfaktor.** Ein Fünftel aller Tore fällt in
  Überzahl; von den 16 Playoff-Teams 2025 waren 14 in PP+ oder PK+ überdurchschnittlich
  (Berkeley Sports Analytics). Das ist Korrelation und schwach, aber es ist die Stelle, an der
  sich Mannschaftsorganisation am deutlichsten in Toren zeigt.
- **Spielstand-Effekte verändern die Schussanteile, nicht den Sieger.** Sie sind die Folge
  davon, dass jemand führt, nicht der Grund.
- **Torwart raus kostet oder bringt Punkte in einer Handvoll Spielen je Saison** — klein im
  Mittel, riesig im einzelnen Spiel.

Daraus folgt der Grundsatz für jedes Konzept unten: **Taktik verändert das *Wie*, nicht das
*Wer*.** Sie soll bestimmen, woher Tore kommen, wie eine Führung verteidigt wird, was eine
Strafe kostet und was der Manager entscheidet — nicht, ob der Spieler mit der besten Eignung
oben steht. Das ist zugleich der realistische und der rho-verträgliche Weg.

---

## 2. Bewertung: taktisch reichhaltig oder Grundgerüst?

### 2.1 Drei Ebenen, drei Urteile

| Ebene | Urteil | Begründung |
|---|---|---|
| **Ereignis** (Schuss, Save, Block, Check, Bully, Abpraller, Pass) | **solide** | mehrfach gegen NHL-Analytik gehalten; Distanzstufen, Fangquote, A1/A2, Abpraller-Richtung, Block-Stufe stimmen in der Größenordnung |
| **Mannschaft** (wie fünf zusammen spielen) | **Basketball-Gerüst** | Ballbesitz-Angriffe mit Schussuhr, Manndeckung mit Hilfe/Doppeln, Formation nach Wurfwert sortiert, Fastbreak-Fenster — das ist `stepBasketballLive`-Logik mit Eishockey-Wörtern. Keine Zone, kein System, kein Zustand außer „wer hat den Puck" |
| **Manager** (was Chris entscheidet) | **fast leer** | wer spielt, wer im Tor steht, Intensität. Keine Rolle auf dem Eis, keine Taktik, keine Special-Teams-Einheit, keine Endphasen-Entscheidung |

Das ist kein Vorwurf an die bisherigen Runden: sie hatten den Auftrag, Rangtreue, Korridor und
Sichtbarkeit zu liefern, und haben das gewissenhaft getan. Aber für Chris' Realismus-Maßstab ist
es dieselbe Lage wie bei Climbing — dort war es „ein Hindernislauf mit anderen Wörtern", hier ist
es in der Mannschaftsebene **„Basketball auf Eis"**. Man sieht es am deutlichsten in drei Bildern:

1. **Eine Strafe ändert kaum etwas.** Die Unterzahl greift weiter an, als wäre nichts (0.3).
2. **Eine Führung ändert nichts.** Niemand zieht sich zurück, niemand nimmt den Torwart raus.
3. **Jeder Angriff ist ein Konter.** 86 % der Tore binnen vier Sekunden nach dem Puckgewinn; die
   Schussuhr beendet jede Druckphase nach acht Sekunden, bevor sie eine werden kann. Das ist die
   mechanische Wurzel von Chris' „viel hin und her gelaufe" (13-09-Konzept, Ursache C).

### 2.2 Die Lücken, sortiert nach Realismusgewicht

| Lücke | Realismusgewicht | Kosten/Risiko | Abschnitt |
|---|---|---|---|
| Special Teams ohne eigene Struktur | hoch (ein Fünftel der Tore) | mittel | T2 |
| Kein Spielstand-Verhalten, kein leerer Kasten | hoch im Erlebnis, klein im Mittel | **niedrig** | T1 |
| Aufstellung ohne Folge auf dem Eis | hoch für den Manager | mittel | T3 |
| Kein Verteidigungs-/Forecheck-System | mittel | mittel–hoch | T4 |
| Kein Zonenbesitz / Cycle, Schussuhr | hoch | **hoch** (Rhythmus = Ereignisdichte = Verlässlichkeit) | T5 |
| Keine Wechsel | hoch in echt | strukturell blockiert (keine Bank) | 4 |
| Kein Momentum | niedrig (statistisch schwach belegt) | — | 4 |

### 2.3 Was an rho hängt — und was nicht

CLAUDE.md sagt: Einzelspiel-rho = Validität × √Verlässlichkeit; mehr Ereignisse helfen nicht.
Für die Taktikfrage heißt das dreierlei:

- **Taktik ist ein Validitätsthema, kein Ereignisthema.** Nichts unten zielt auf mehr
  Ereignisse. T5 würde sogar Ereignisse *kosten* — das ist sein Risiko (Verlässlichkeit sinkt),
  und deshalb steht es zuletzt.
- **Jede Positionsänderung verschiebt die Zufallsbahn**, auch ohne neuen `rr()`-Wurf. Das ist
  gemessen: die Puste verschob nur Tempo und Zweikampfgewichte und kostete trotzdem rho, weil
  sich die Zahl der `versucheSteal`-Aufrufe änderte (`puste`-Kommentar `:6441-6451`).
  Bit-Identität ist für keinen Mechanik-Vorschlag hier zu haben. Die Abnahme muss deshalb die
  Zoneneintritt-Lehre einhalten: **Vorzeichen bei n=24 UND n=48 gleich, im Zweifel n=96.**
- **Die günstigste Bauform ist selten und spät.** Ein Mechanismus, der ein- bis zweimal je Spiel
  und erst am Ende greift (T1), verschiebt die Zufallsbahn nur für die letzten Sekunden. Ein
  Mechanismus, der an einen seltenen Zustand gebunden ist (T2: ~19 % der Spielzeit), verschiebt
  sie ab der ersten Strafe. Einer, der jeden Besitz betrifft (T5), verschiebt alles.

---

## 3. Vorschläge, priorisiert

Jeder Vorschlag nennt: Bild, Mechanik (Konzept), was existiert, Risiko für rho und die
Pp-Abnahme (gesperrte Matrix, Abweichung ≤ 25), Frage an Chris. Kein Vorschlag führt ein
Attribut außerhalb der Hockey-Matrix ein (power 18, health 18, speed 12, spirit 12, stamina 10,
torment 10, awareness 8, determination/dexterity/will je 4) und keiner einen neuen Sub-Skill
(„teamgeist und linienspiel sagen mir nichts … das habe ich nicht beauftragt",
`hockey-eigene-erfolgskurve.md:74`).

### T0 — Spielzustände sichtbar machen (rho-frei, sofort)

**Bild.** Beim Pfiff läuft über der Eisfläche ein Band „ÜBERZAHL Heim — 0:08" mit ablaufender
Uhr; die Strafbank zeigt den Sünder mit Balken. Im Endstand zwei neue Spalten je Mannschaft:
„PP 1/3" und „SH-Tore". Im Ticker bekommt ein Überzahltor „(PP)" und ein Unterzahltor „(SH)".

**Mechanik.** Keine. Reine Anzeige aus `strafeBis`, `feldStaerke()` und dem Protokoll.

**Warum zuerst.** Heute sieht man eine Überzahl nur daran, dass ein Spieler zur Bank fährt. Eine
Taktik, die niemand erkennt, ist keine. T0 macht außerdem die Abnahme von T1/T2 für Chris
lesbar, ohne dass er Protokolle lesen muss.

**Risiko.** Null (kein Tick, kein `rr()`), Nachweis: bit-identische Rangtreue.

### T1 — Die Endphase: Torwart raus und Führungs-Riegel (empfohlen als erster Mechanik-PR)

**Bild.** 1:2, noch 20 Sekunden. Der Torwart der zurückliegenden Mannschaft fährt zur Bank
(sichtbar). Einen sechsten Feldspieler, der für ihn aufs Eis käme, gibt es ohne Bank nicht —
also spielen die fünf Feldspieler **ohne Torwart hinten**, und die Formation besetzt zusätzlich
den hohen Slot (Index 5), den `SLOTS_HOCKEY` für genau diesen Fall schon führt. Die führende Mannschaft zieht sich zusammen
(„Riegel"): Point-Spieler tiefer, Klären an die Bande statt Konter. Entweder fällt der Ausgleich
— oder der Puck rutscht über das ganze Eis ins leere Tor.

**Mechanik (Konzept).**

```
Endphase aktiv, wenn: letztes Drittel, fsT > spieldauer − T_END, Rückstand 1 oder 2 Tore
  zurückliegend:  torwart.imTor = false → Torwart geht zur Bank (Ziel wie strafbankZiel)
                  hockeySchussAusgang für Schüsse auf DIESES Tor: tw = null (leeres Tor)
                  Formation: SLOTS_HOCKEY[0..5] mit sechstem Platz (gibt es schon)
  führend:        Riegel-Formation (Point-Radius kleiner, Half-Wall enger), bei Puckgewinn
                  in der eigenen Hälfte Klären/Schuss aufs leere Tor statt Angriffsaufbau
```

Vorschlag `T_END` = 10 % der Spieldauer (24 s von 240) — das ist die analytische Empfehlung
(~6 von 60 Minuten) auf unsere Uhr gebracht; die NHL-Praxis läge bei ~5 s. Chris entscheidet,
ob das Spiel „kluge Trainer" oder „echte Trainer" zeigen soll.

**Was existiert.** Leeres Tor (`HK_TOR_SKALA_LEER`, `tw:null`-Zweig in `hockeySchussAusgang`
`:10949`), sechster Formationsplatz (`:7778`), `liegtZurueck`, Klären (`:9812-9822`),
Strafbank-Ziel als Muster für die Fahrt zur Bank.

**Risiko.** **Niedrig.** Tritt in einem Teil der Spiele und nur in den letzten ~24 s auf; die
Zufallsbahn verschiebt sich nur dort. Zwei Punkte gehören gemessen:
- **Leere-Tor-Tore sind billige Tore.** Sie fallen zufällig an den, der den Puck gerade hat. Real
  zählen sie voll; für die Wertformel ist die K3-Buchung schon die Antwort: `pTor` am leeren Tor
  ist hoch, der Schütze bekommt also im Erwartungswert fast dasselbe, ob er trifft oder nicht —
  das Rauschen bleibt klein. Vorschlag: **keine Sonderregel**, messen.
- **Der Torwart verliert Spielzeit.** GSAA/Basis rechnen je Spiel, nicht je Minute — ein
  Torwart, der 24 s auf der Bank sitzt, verliert fast nichts. Die Gegentore ins leere Tor dürfen
  **nicht** in `u.gegentore` des Torwarts laufen (er stand nicht im Tor). Eine Zeile, Pflicht.

**Pp.** Kein neuer Kanal. Wer im Riegel klärt, liest dieselben Werte wie heute.

**Frage an Chris.** Soll der Torwart-raus-Moment zusätzlich eine **Manager-Entscheidung** sein
(„Torwart ziehen: nie / spät / früh" als Voreinstellung)? Das wäre die erste taktische
Stellschraube in Hockey, sie ist real umstritten (Analytik gegen Praxis) — und genau deshalb eine
gute Entscheidung für einen Manager.

### T2 — Special Teams als eigener Spielzustand

**Bild.** Strafe gegen Gast. Die Heimmannschaft stellt sich in der Zone in einer **1-3-1** auf:
der Playmaker an der Half-Wall als Quarterback, ein Schütze am Bullypunkt gegenüber für den
Direktschuss, einer im hohen Slot (Bumper), einer vor dem Tor, einer an der blauen Linie. Die
Gastmannschaft steht in einer **Box** (2-2) vor dem Tor, deckt Räume statt Männer, blockt, und
wenn sie den Puck erobert, **klärt** sie ihn über das Eis, statt anzugreifen. Die Uhr läuft,
die Überzahl baut neu auf. Das ist das Bild, das jeder Eishockeyzuschauer kennt — und das heute
vollständig fehlt.

**Mechanik (Konzept).**

| Baustein | Überzahl-Seite | Unterzahl-Seite |
|---|---|---|
| Formation | `SLOTS_PP_131`: Point, Half-Wall ×2, Bumper (= heutiger hoher Slot), Netfront — **deterministisch** nach Rolle (T3) oder, ohne T3, nach SCHUSS_NAH/SCHUSS_FERN sortiert wie heute | `SLOTS_PK_BOX`: vier Raumplätze vor dem Tor, verschoben zur Puckseite |
| Deckung | wie heute (niemand deckt einen Unterzahl-Spieler doppelt, es gibt ihn nicht) | **Raumdeckung**: wer dem Puckführer am nächsten ist, attackiert, die anderen halten ihren Platz. Kein neuer Wurf — `zuordneDeckung` bekommt statt des Abstands-Matchings eine Platz-Zuordnung |
| Puckgewinn | normal | **Klären**: Puck in die gegnerische Hälfte (Torwart-Klär-Zweig wiederverwendet), kein Angriffsaufbau. Der Konter bleibt möglich über das bestehende Ausbruch-Fenster eines schnellen Spielers (`startFastbreak`) — seltener als heute, das ist die Pointe |
| Schussuhr | für die Überzahl **ausgesetzt oder verlängert** (Vorschlag: doppelt), damit die 1-3-1 Pässe spielt statt nach 8 s abzudrücken | irrelevant (sie greift nicht an) |
| Direktschuss | Pass vom Quarterback quer zum Schützen am Bullypunkt: `hockeyPassQualBonus` kennt Geometrie-Stufen; eine Stufe „quer durch den Slot" (Royal Road) mit höherem Zuschlag ist dieselbe Bauform | — |
| Ende | wie heute nach 8 s; Vorschlag zusätzlich: **Überzahltor beendet die Strafe** (echte Regel bei kleinen Strafen) | — |

**Zielkorridor (Vorschlag, gegen 0.3 zu messen):** Überzahl-Versuche/s deutlich über Gleichzahl
(Richtwert ×1,5), Unterzahl-Versuche/s unter einem Drittel von Gleichzahl, Unterzahl-Tore je
Strafe unter 4 %, Überzahl-Tore je Strafe weiter um 20 %. Die Überzahl-*Quote* soll sich also
kaum bewegen — was sich bewegt, ist, **woher** sie kommt.

**Was existiert.** `UNTERZAHL_PLAETZE` ist die Weiche, an der die Formation schon heute nach
Feldstärke umschaltet (`:7886`); „Überzahl deckt doppelt" (`:9429`) ist die Stelle, an der die
Box stattdessen Räume deckt; das Klären steht im Torwart-Zweig; der sechste Platz ist der Bumper.

**Risiko.** **Mittel.** Der Zustand gilt ~19 % der Spielzeit und verschiebt Positionen, also
die Zahl der Steal-/Block-Kandidaten und damit die Zufallsbahn ab der ersten Strafe. Zwei
Gegenkräfte zur Validität, die man vorher benennen sollte:
- **Für die Validität spricht**, dass die Überzahl-Tore dann aus einer Formation kommen, die
  Schützen (SCHUSS_FERN/ABSCHLUSS, power-geführt) und Quarterback (AUFBAU) gezielt bedient.
  Power ist mit 18 das schwerste Matrixattribut. Das hebt die Validität, wenn die Formation den
  *richtigen* Spieler auf den Schützenplatz stellt — deshalb gehört T2 mit T3 zusammen gedacht.
- **Gegen die Validität spricht**, dass die Unterzahl-Mannschaft kaum noch Ereignisse hat: ihre
  vier (bei doppelter Strafe drei) Feldspieler sammeln in dieser Zeit fast nur Blocks. Das ist echtes Eishockey, kostet
  aber Verlässlichkeit bei den Unterzahl-Spielern. Blocks zählen heute 0,5 in der Wertformel;
  ob das trägt, sagt nur die Messung.

**Pp.** Neu belohnt: SCHUSS_FERN (Direktschuss vom Bullypunkt), ABWEHR (Blocks in der Box).
SCHUSS_FERN hatte zeitweise nur 1,2 % mechanisches Gewicht (`zuordneSlots`-Kommentar `:7809`) —
T2 gibt ihm einen Kanal, der nicht über eine Sortierdifferenz läuft (die dort gemessen beide
Wurfwerte zerstörte). Das ist eher Pp-hebend als -senkend; Abnahme über
`sondiere-feldspiel-subskills.mjs hockey 24` vor jeder Rezeptberührung.

**Frage an Chris.** Soll die **Überzahl-Einheit** eine eigene Aufstellung sein (wer steht im PP
an welchem Platz) oder sich aus den Rollen ergeben (T3)? Eigene Einheit ist realistischer und
eine echte Entscheidung, kostet aber einen zweiten Aufstellungsschritt im Spieltag-UI.

### T3 — Rollen werden Positionen: die Aufstellung bekommt eine Folge

**Bild.** Chris stellt „Defensive Wall" auf einen zähen, langsamen Spieler. Auf dem Eis steht
der jetzt an der blauen Linie, blockt, räumt vor dem eigenen Tor auf und rückt nicht bis in den
Slot vor. Der „Slot Finisher" steht im hohen Slot, der „Power Forward" vor dem Tor, der
„Playmaker" an der Half-Wall und verteilt, der „Transition Runner" ist der Erste, der nach
einem Puckgewinn losläuft. Wer den falschen Mann auf die falsche Rolle stellt, sieht es.

**Mechanik (Konzept).** Heute: `zuordneSlots` sortiert alle Feldspieler bei jedem Besitzwechsel
nach SCHUSS_NAH (`:7852`). Vorschlag: **Heimplatz aus der Rolle, nicht aus dem Rang**, mit einem
Positions-Modifier nach dem Basketball-Vorbild (`BASKETBALL_POS_MOD`):

| Rolle (Slot) | Heimplatz im Angriff | Heimplatz in der Verteidigung | Primärweg (volle Wirkung) | Nebenweg |
|---|---|---|---|---|
| Power Forward | Netfront | Torraum vor dem eigenen Tor | Abstauber, Schirm, Bandenduell | Nachschuss aus dem Slot |
| Slot Finisher | hoher Slot / Bullypunkt | hoher Slot | Direktschuss, Handgelenkschuss | Abpraller |
| Playmaker | Half-Wall (Quarterback) | Half-Wall | erste Vorlage, Querpass | Schuss von der Half-Wall |
| Transition Runner | schwache Seite, erster Mann im Konter | Aufbau-Position an der Mittellinie | Ausbruch (`startFastbreak`) | Puckgewinn im Laufduell |
| Defensive Wall | Point | vor dem Tor, Schussbahn | Block, Stockcheck, Bodycheck | Schlagschuss von der blauen Linie |
| Goaltender | Tor | Tor | wie heute | — |

Das ist wörtlich das Muster aus der I-Spy-Runde, das Chris am 21.09. auf alle Disziplinen
verallgemeinert hat: **jede Rolle hat einen Primärweg und einen Nebenweg**, und kein Spieler ist
ausgeschlossen, weil ihm das eine geforderte Attribut fehlt.

**Rückfall ohne gesetzte Aufstellung** (KI, Messbank ohne Slot-Felder, `hockey-opus-review-nhl.md`
4.3a): Rollen werden nach der heutigen Regel verteilt — bester SCHUSS_NAH in den Netfront-Platz
usw. Dann ist das Verhalten für eine nicht gesetzte Aufstellung **nahe am heutigen**, und der
Unterschied entsteht genau dort, wo ein Manager entschieden hat.

**Was existiert.** `slotId`/`slotGesetzt` stehen an jedem Spieler (`:7496`), der Positions-
Modifier als Bauform (`:7470`), die Formationstabelle (`:7772`), die Rollentexte im UI.

**Risiko.** **Mittel, und mit einem echten Messproblem.** Der Standplatz ist der größte einzelne
Faktor der Trefferquote (nah 21,3 %, fern 6,4 %, `hockey-opus-review-nhl.md` 4.4). Heute bekommt
ihn automatisch der beste Nahschütze — das trägt Validität. Wenn der Platz aus der Rolle kommt,
trägt ihn der, den der Manager hinstellt. Zwei Gründe, warum das trotzdem richtig ist:
1. `eig` enthält den Slot-Aufschlag bereits (`bauSpieler` `:7491`, `engP`): ein Spieler auf
   einer passenden Rolle hat eine höhere Eignung. Rolle und Platz zu koppeln macht die Eignung
   und das Geschehen **konsistenter**, nicht zufälliger.
2. Die Messbank feldet ohne Slot-Felder (Rückfall) — rho misst also die Rückfall-Verteilung,
   die nahe am heutigen Stand liegt. Der eigentliche Effekt (eine bewusste, falsche Aufstellung
   wird bestraft) ist *gewollt* und gehört nicht in rho, sondern in eine eigene Abnahme:
   „dieselbe Mannschaft, zwei Aufstellungen — gewinnt die passende öfter?" (Spiegel-Bauform,
   `miss-arena-feldspiel-spiegel.mjs`).

**Pp.** Hier liegt die größte Pp-Chance und das größte Pp-Risiko: jede Rolle öffnet einen
eigenen Kanal (Blocks für Defensive Wall = ABWEHR, health/will; Ausbruch = LAUFTEMPO,
stamina/speed; Netfront = ZWEITCHANCE, health/power). Budget-Abnahme ist Pflicht; der Befund der
SCHUSS_NAH−FERN-Sortierung (`:7809-7819`, Positionskanal als Rangwechsel) warnt, dass
Positionskanäle nichtlinear reagieren.

**Frage an Chris.** Soll die Rolle den Spieler **fest** an seinen Platz binden (klarer, taktisch
stärker) oder nur **bevorzugen** (weicher, näher am heutigen Stand)? Empfehlung: fest im
Angriffsaufbau, weich in der Verteidigung (Hybrid wie in der NHL, 1.1).

### T4 — Eine Mannschaftstaktik vor dem Spiel

**Bild.** Im Spieltag-Bildschirm neben der Aufstellung eine Wahl mit drei Karten, jede mit einem
Satz, was sie kostet:

| Taktik | Was passiert | Stark gegen | Schwach gegen |
|---|---|---|---|
| **Aggressiver Forecheck (2-1-2)** | zwei Stürmer attackieren den Aufbau tief in der gegnerischen Zone | langsame Aufbauspieler (niedriges AUFBAU) | schnelle Teams — ein gelungener Aufbau läuft in einen Konter mit Überzahl |
| **Neutrales Riegeln (1-2-2)** | ein Mann lenkt, vier stehen in der neutralen Zone | schnelle Konterteams | Teams mit Geduld — man gewinnt den Puck später und weiter hinten |
| **Schattendeckung** | der beste eigene Verteidiger klebt am gefährlichsten Gegner (Basketballs Fokus-Doppeln in Hockey-Form) | Einzelstars | Tiefe — der Rest deckt einen Mann weniger konsequent |

**Mechanik (Konzept).** Keine neuen Würfe. Die Taktik verschiebt **wo** die Deckung ansetzt
(Pressinglinie: tief / Mitte) und **wen** `zuordneDeckung` wem zuordnet (Schattendeckung ist
eine feste Paarung vor dem gierigen Matching, dieselbe Bauform wie `fokusZiel`). Die KI wählt
nach Kaderprofil. Stein-Schere-Papier nur schwach — Taktik darf nicht zum Hauptfaktor werden
(1.2).

**Risiko.** Mittel. Basketball hat mit dem Fokus-Doppeln gezeigt, dass eine Deckungsvorgabe
messbar und abnehmbar ist (Rollenprobe V, `engine.js`-Kommentar `:9587-9599`). Aber eine
Pressinglinie verschiebt die Zone, in der die Hälfte aller Checks und Steals fällt — das ist ein
Rhythmus-Eingriff. **Erst nach T2/T3**, weil beide die Positionslogik anfassen, auf der T4
aufsetzt.

**Frage an Chris.** Will er in Hockey überhaupt eine Taktikwahl — oder soll die Mannschaft ihre
Taktik aus der Aufstellung ableiten (viele Transition Runner → Riegeln und Kontern; viele
Defensive Walls → Forecheck)? Die zweite Variante braucht kein neues UI.

### T5 — Grundsatzfrage: Zonenbesitz statt Schussuhr

**Bild.** Eine Mannschaft kommt kontrolliert über die blaue Linie oder schießt den Puck in die
Ecke und jagt ihm nach; in der Zone läuft der Puck an der Bande entlang, hinter das Tor, zurück
an den Point — 15, 20 Sekunden Druck, bis sich eine Lücke auftut. Die verteidigende Mannschaft
schwärmt tief und deckt oben Mann gegen Mann. Das ist der „Cycle", der real knapp die Hälfte der
Tore erzeugt — und der bei uns strukturell nicht existiert: die Schussuhr beendet jede Phase nach
acht Sekunden (`:12011`), und 99 % der Tore fallen binnen acht Sekunden nach dem Puckgewinn (0.3).

**Mechanik (nur Richtung).** Schussuhr durch einen **Zonenzustand** ersetzen (Puck in
Angriffsdrittel / neutral / eigenes Drittel), Entscheidung am blauen Strich als **Mannschaftsstil
statt Würfel** (die Zoneneintritt-Lehre: kein neuer hochfrequenter `rr()`), Abseits und Icing
als Regeln, Schwarm-Deckung unterhalb der Bullypunkte.

**Warum zuletzt und nur als Frage.** Das ist der einzige Vorschlag, der Chris' erste Hockey-
Meldung („viel hin und her gelaufe") an der Wurzel trifft — und der einzige, der die Abnahme
wirklich gefährdet. Längere Besitzphasen heißen weniger Besitzwechsel, weniger Steals, weniger
Konter-Schüsse: die Ereignisdichte sinkt, mit ihr die Verlässlichkeit. CLAUDE.md sagt, dass
*mehr* Ereignisse nicht helfen; es sagt nicht, dass *weniger* nichts schaden. Bei 0,669 und einer
Schranke von 0,615 bleiben 0,054 Luft. Das 13-09-Konzept hat dieselbe Frage (11.4) bereits
offen an Chris gegeben; dieses Review schließt sich an: **nicht ohne ausdrücklichen Auftrag, und
dann als eigener Neubau mit Rückfallschalter** — wie Climbing, nicht als Nebenbei-PR.

---

## 4. Was ich ausdrücklich NICHT vorschlage

- **Linienwechsel.** Real der größte Taktik- und Produktionshebel (Star 22 min, vierte Reihe 10)
  — aber ein Hockey-Spieltag hat sechs Spieler inklusive Torwart (`:4733`). Ohne Bank gibt es
  nichts zu wechseln. Die Bank einzuführen hieße: größerer Spieltagskader, mehr Fatigue-
  Verbrauch je Spieltag, andere Kaderökonomie — eine Entscheidung für das ganze Spiel, nicht für
  Hockey. **H3 aus `hockey-opus-review-nhl.md` ist in der dort beschriebenen Form nicht baubar**
  und sollte dort als solcher markiert werden. Was ohne Bank geht, ist die Puste als
  Schichtersatz — sie ist gemessen rho-schädlich, solange sie Tempo und Zweikampf verschiebt
  (`hockey-puste-kalibrierung-13-09.md` 4.2), und bleibt deshalb Anzeige.
- **Eine Momentum-Mechanik.** „Druckphasen" als Zustand, der Schüsse wahrscheinlicher macht,
  hätte keine reale Grundlage: die Analytik findet Spielstand-Effekte, aber kaum ein „heißes
  Team". Ein Druck-Balken als **Anzeige** aus den letzten Schussanteilen (T0-Bauform) ist in
  Ordnung; als Mechanik wäre er „reich wird reicher" — dieselbe Warnung wie beim Climbing-
  Flow-Bonus.
- **Mehr Checks.** Wir checken je Skater häufiger als die NHL (1,60 gegen ~1,2) und fünfmal so
  dicht je Minute (13-09-Konzept 3.3). Ein Check-Wertposten bleibt gestrichen.
- **Den Zoneneintritt ein drittes Mal als Zweikampf-Würfel.** Die Diagnose stimmt, die Bauform
  scheiterte zweimal an der RNG-Kaskade. T5 greift dieselbe Lücke als Zustand an, nicht als Wurf.
- **An Zahlen drehen.** Kein Vorschlag hier verändert Tor-, Fang- oder Strafquote als Ziel; wo
  sich eine Quote bewegt, ist das Folge, und der Korridor ist Abnahme, nicht Stellschraube.

---

## 5. Reihenfolge und Abnahme

| PR | Inhalt | Mechanikrisiko | Abnahme |
|---|---|---|---|
| **1** | **T0** Überzahl-Band, PP/SH-Spalten, Ticker-Kennung | null | bit-identische Rangtreue, Screenshots |
| **2** | **T1** Torwart raus + Riegel (hinter einem Feld in `FELDSPIEL_ART.hockey`, ungesetzt = heute) | niedrig | volle Abnahme unten; zusätzlich: Anteil Spiele mit gezogenem Torwart, Ausgleich-/Leertor-Quote |
| **3** | **T3** Rollen-Heimplätze mit Rückfall + Spiegel-Abnahme „passende gegen unpassende Aufstellung" | mittel | volle Abnahme + Spiegeltest |
| **4** | **T2** Special Teams (1-3-1, Box, Klären, Schussuhr im PP) — baut auf T3 auf | mittel | volle Abnahme + Special-Teams-Korridor (0.3-Sonde als Repo-Skript) |
| **5** | **T4** Mannschaftstaktik, falls Chris sie will | mittel | volle Abnahme je Taktik |
| — | **T5** nur mit ausdrücklichem Auftrag, eigenes Konzept | hoch | — |

T3 steht vor T2, obwohl T2 den größeren Realismusgewinn hat: die 1-3-1 braucht Rollen, sonst
sortiert sie wieder nach SCHUSS_NAH, und die Überzahl-Einheit wäre dieselbe Zufallsbesetzung wie
heute.

**Volle Abnahme, verbindlich:**
1. `node scripts/miss-alle-disziplinen.mjs 24 hockey` **und** n=48, Vorzeichen gleich; bei
   gemischtem Bild n=96 (Zoneneintritt-Lehre).
2. Median nicht unter **0,615** (CI); zwischen 0,615 und 0,669 begründungspflichtig.
3. Feldspieler-Zeile und Star-Kennzahlen mitberichten (Star auf Rang 1 / in den ersten zwei /
   nie Letzter) — CLAUDE.md nennt sie die ehrlichere Frage.
4. **Pp-Abweichung ≤ 25** in zwei Saatstämmen (`einflussVon`/`sondiere-feldspiel-subskills.mjs`)
   — Pflicht seit 21.09., für jede Mechanik.
5. `miss-hockey-korridor.mjs 24` plus eine Special-Teams-Zeile (die Sonde aus 0.3 gehört als
   `scripts/miss-hockey-taktik.mjs` ins Repo, sobald ein Mechanik-PR sie braucht).
6. Basketball und Football **bit-identisch** — alles hinter `istHockey()` oder hinter
   `FELDSPIEL_ART.hockey`-Feldern.
7. `HK_TW_BASIS`/`HK_TW_REF` nach jeder Änderung an Wertformel oder Fangquote nachziehen — der
   Kommentar verlangt es, und es ist schon zweimal vergessen worden.
8. Basislinie erst nach Entscheidung neu bauen, im PR benennen.

---

## 6. Fragen an Chris

1. **Stimmt das Urteil „Basketball auf Eis" auf Mannschaftsebene mit deinem Eindruck überein?**
   Wenn ja, ist die Reihenfolge T0 → T1 → T3 → T2 der Weg dorthin, ohne die Disziplin neu zu
   bauen.
2. **Torwart raus:** automatisch nach Analytik (früh), nach Praxis (spät), oder als
   Manager-Voreinstellung? (T1)
3. **Rollen:** fest an den Platz gebunden oder nur bevorzugt? (T3)
4. **Überzahl-Einheit:** eigene Aufstellung oder aus den Rollen? (T2)
5. **Mannschaftstaktik:** eigene Wahl im Spieltag, aus der Aufstellung abgeleitet, oder gar
   nicht? (T4)
6. **Zonenbesitz statt Schussuhr:** eigene Runde, mit dem Risiko, dass die Rangtreue sinkt, oder
   bewusst nicht? (T5, deckungsgleich mit Frage 11.4 im 13-09-Konzept)
7. **Bank und Wechsel:** soll ein Hockey-Spieltag irgendwann mehr als sechs Spieler stellen? Das
   ist keine Hockey-Frage, sondern eine Kaderfrage fürs ganze Spiel. (4)

---

## 7. Was ich NICHT geprüft habe

- **Keine rho-Messung irgendeines Vorschlags.** Die Risikostufen sind begründete Einschätzungen
  aus den gemessenen Präzedenzfällen (Puste, Zoneneintritt, Fokus-Doppeln), keine Zahlen.
- **Die Sonde in 0.3 lief auf dem Einzelkader**, nicht auf der Kader-Familie, und nähert die
  Überzahl-Zeit und den „Puckgewinn". Die Richtungen sind deutlich; Einzelwerte können sich auf
  der Kader-Familie um einige Prozent verschieben.
- **NHL-Vergleichswerte für Unterzahl-Tore je Strafe und den Überzahl-Anteil an allen Toren sind
  eigene Überschlagsrechnungen** aus Teamzahlen, keine abgerufene Ligastatistik (StatMuse und
  Hockey-Reference führen sie, ließen sich hier aber nicht als Tabelle abrufen). Die Schussraten
  der NHL in Über-/Unterzahl habe ich nicht abgerufen und deshalb nur qualitativ genannt.
- **Die visuelle Seite** (Rink-Linien, wie eine Box auf unserer Eisfläche aussähe) — nicht
  angesehen.
- **Die KI-Aufstellung**: ob sie Rollen nach Eignung sinnvoll verteilt, entscheidet, wie stark
  T3 im echten Spiel wirkt. Nicht geprüft.

---

## Quellen

- [Wikipedia — 2-1-2 forecheck](https://en.wikipedia.org/wiki/2-1-2_forecheck)
- [Wikipedia — Neutral zone trap](https://en.wikipedia.org/wiki/Neutral_zone_trap)
- [Ice Hockey Systems — 1-2-2 Neutral Zone Forecheck](https://www.icehockeysystems.com/hockey-systems/1-2-2-neutral-zone-forecheck)
- [The Coaches Site — Explained: 1-2-2 Neutral Zone Forecheck](https://members.thecoachessite.com/article/explained-1-2-2-neutral-zone-forecheck)
- [Behind the Keyboard — 2025-2026 NHL Systems Breakdowns: Defensive Zone Coverage](https://behindthekeyboard.substack.com/p/2025-2026-nhl-systems-breakdowns) (12 Teams Mann gegen Mann, 20 Box+1)
- [The Coaches Site — Explained: Hybrid Defensive Zone Coverage](https://members.thecoachessite.com/article/what-is-hybrid-defensive-zone-coverage-in-hockey)
- [Jack Han — Man-on-Man vs. Zone Defense](https://jhanhky.substack.com/p/man-on-man-vs-zone-defense)
- [The Coaches Site — Explained: 1-3-1 Power Play Formation](https://members.thecoachessite.com/article/explained-1-3-1-power-play-formation)
- [Ice Hockey Systems — Panthers Diamond Penalty Kill vs Bruins' 1-3-1 Power Play](https://www.icehockeysystems.com/coaching-clip/panthers-diamond-penalty-kill-vs-bruins-1-3-1-power-play)
- [King Cobras Hockey — Understanding the Umbrella Power Play](https://www.kingcobrashockey.com/article/understanding-the-umbrella-power-play-in-ice-hockey)
- [JudgeMate — Power Play & Penalty Kill Explained](https://www.judgemate.com/en/guides/power-play-penalty-kill-explained)
- [Edmonton Journal via PressReader — Today's NHL power plays are all about taking risks (2024)](https://www.pressreader.com/canada/edmonton-journal/20240405/281986087576800) (Box → Diamant)
- [Berkeley Sports Analytics — Redefining the NHL's Special Teams Metrics](https://sportsanalytics.studentorg.berkeley.edu/articles/redefining-nhl-special-teams.html) (14 von 16 Playoff-Teams über dem Schnitt in PP+ oder PK+)
- [theScore — Why is the modern power play so effective?](https://www.thescore.com/nhl/news/2166495)
- [StatMuse — NHL League Average Powerplay Percentage](https://www.statmuse.com/nhl/ask/nhl-league-average-powerplay-percentage)
- [StatMuse — NHL Shorthanded Goals By Team 2024-25](https://www.statmuse.com/nhl/ask?q=nhl+shorthanded+goals+by+team+2024-25) (Spitze NY Rangers 18)
- [Evolving-Hockey — Glossary: General Terms](https://evolving-hockey.com/glossary/general-terms/) (Score Effects, score-adjusted)
- [Hockey Graphs — Score Effects](https://hockey-graphs.com/tag/score-effects/)
- [Wikipedia — Corsi (statistic)](https://en.wikipedia.org/wiki/Corsi_(statistic)) (CorsiClose, Score-Adjusted)
- [NYU — When to Pull the Goalie? Risk-Based Analysis (Brown & Asness)](https://www.nyu.edu/about/news-publications/news/2020/february/when-to-pull-the-goalie--nyu-researcher-offers-risk-based-analys.html)
- [Beaudoin & Swartz — Strategies for Pulling the Goalie in Hockey (SFU)](https://www.sfu.ca/~tswartz/papers/goalie.pdf)
- [Hockey Graphs — The State of Goalie Pulling in the NHL](https://hockey-graphs.com/2020/05/18/the-state-of-goalie-pulling-in-the-nhl/)
- [All Three Zones — Better Late Than Never: Playoffs Post-mortems](https://allthreezones.substack.com/p/better-late-than-never-playoffs-post) (Rush 54,8 % / Forecheck-Cycle 45,2 %)
- [PensBurgh — The Importance of Shift Length](https://www.pensburgh.com/2015/10/16/9549249/the-importance-of-shift-length) (Schüsse je Schichtsekunde)
- [HPT — Hockey Analytics: Shift, Speed & Recovery Metrics](https://hpt.pro/blog/hockey-analytics-101-metrics-that-matter/)
- [Hockey Answered — What is the last change in hockey?](https://hockeyanswered.com/what-is-the-last-change-in-hockey/)
- Projektintern: `CLAUDE.md`; `docs/design/hockey-opus-review-nhl.md`, `hockey-zufriedenstellend.md`,
  `hockey-zoneneintritt-umsetzung.md`, `hockey-ausdauer-checks-konzept-13-09.md`,
  `hockey-puste-kalibrierung-13-09.md`, `hockey-naechster-hebel-recherche-fable.md`,
  `hockey-eigene-erfolgskurve.md`, `stand-aller-disziplinen.md`, `climbing-neukonzept-22-09.md`.
