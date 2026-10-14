# Chris' Feedback-Runde 13.10. — ein Konzept statt neunundzwanzig Tickets (Fable, 13.10.)

**Reine Konzeptrunde. Kein Code geändert, nichts gemessen, kein Verhaltens-PR.** Auftrag, wörtlich
(Chris, 13.10.): „erarbeite mit opus oder fable einen plan meine ganzen änderungswünsche in einem
konzept vorzubereiten". Quelle aller Wünsche ist `docs/design/chris-feedback-breite-runde-13-10.md`
(Branch `chris-feedback-breite-runde-13-10`, PR #1173, zum Zeitpunkt dieses Papiers noch nicht auf
`main`) — dreißig Punkte aus zwei Nachrichten vom 13.10., dort wörtlich zitiert. Ich wiederhole die
Zitate hier nur, wo sie eine Entscheidung tragen.

**Punkt 14 (Mini-DM als echtes 1v1v1v1-FFA) ist nicht Teil dieses Plans** — er wird gerade in einer
parallelen Runde gebaut. Er taucht unten nur dort auf, wo ein Baustein ihn berührt.

`engine.js` meint `public/mockups/battle-mode.engine.js` auf `origin/main` `555f0b1e` (13.10.).
Zeilennummern sind Stand dieses Commits.

**Bindender Rahmen (CLAUDE.md), für alles unten:**

- Die Eignungsmatrix (`lib/player-generator/official-discipline-weights.ts`) ist für alle zwanzig
  Disziplinen gesperrt — und jede Mechanik muss ihre Gewichte **durchreichen** (Chris 21.09.: „wenn
  ich einen Spieler mit einer Stat von 80 reinschicke, erwarte ich auch, dass da einer der Top-Leute
  ist"). Keine Idee unten fasst die Matrix an.
- rho in **einem** Spiel über 0,80 (angestrebt 0,85) und Pp-Abweichung ≤ 25 in zwei Saatstämmen
  sind beide Pflichtabnahme jeder Mechanik.
- „Mehrere Wege zum Erfolg" (Primär-/Nebenweg) wird bei jeder Mechanikrunde mitgedacht.
- **Breaking ist Folter, nicht Breakdance.** Punkt 19 wird in diesem Vokabular geplant.
- Alles, was Sendezeit, Wandzeit oder Spielablauf verändert, ist Klasse T und braucht Chris'
  ausdrückliche Zustimmung. Wo Chris einen T-Wunsch am 13.10. selbst geäußert hat, steht das dabei —
  das ist dann seine Zustimmung zu genau diesem Wunsch, nicht zu einer Ausweitung.

### Klassenschema

Dieselbe Sprache wie die Nachtkonzepte vom 03.10. (`tennis-nachtkonzept-03-10.md`, Tabelle oben)
und das Broadcast-Papier (`fable-ideen-broadcast-praesentation-30-09.md`, Kopf), um zwei Zeilen
ergänzt, die das Feldspiel-Papier (W) und das Bahn-Papier (S) eingeführt haben:

| Klasse | Bedeutung | Braucht |
|---|---|---|
| **A** | reine Anzeige: kein `rr()`, kein neues Sim-Feld, rho bit-identisch | Sichtprüfung |
| **A\*** | Anzeige mit eigener Buchhaltung (Merker, Zweitrechnung über feststehende Werte) | Nachweis, dass die Zufallskette unberührt bleibt |
| **B** | echte Mechanik in Ergebnis-, Team- oder Simulationsschicht | Chris' Ja, Prototyp, kaderfeste Messung (rho + Pp) |
| **C** | Mechanik, die eine Regel- oder Designentscheidung von Chris voraussetzt | Chris' Entscheidung vor dem Bau |
| **W** | Wertformel/Buchhaltung (welcher Rohwert zählt), kein neuer Wurf | Chris' Ja, Messpflicht, PPS-Referenz neu ziehen |
| **S** | neuer Spielstands-Zustand (persistiert über Spieltage/Saisons) | Chris' Ja, Migrationsfreiheit (optionales Feld) |
| **M** | Manager-Entscheidung (Aufstellung, Anweisung, Haltung) | Chris' Ja, Persistenz |
| **T** | Sendezeit/Wandzeit/Spielablauf | **nur Chris persönlich, ausdrücklich** |

---

## 0. Kurzfassung

1. **Neunundzwanzig Wünsche, neun Bausteine und eine Vorfrage.** Gut die Hälfte der Punkte sind
   keine Einzelwünsche, sondern dieselbe Forderung an verschiedenen Stellen. Wer sie Disziplin für
   Disziplin abarbeitet, baut fünfmal dieselbe Warteschlange, dreimal dieselbe Anspiel-Szene und
   zweimal dieselbe Spieler-Historie. Abschnitt 1 ordnet jeden Punkt einem Baustein zu.
2. **Der wichtigste Baustein heißt „Matchup-Folge"** (Q1, Abschnitt 3.1): Fechten (15), Showcase
   (17), Eiskunstlauf (18a), Tennis (25a) und Schach (26) verlangen wörtlich dasselbe — ein Duell
   nach dem anderen statt Durchschalten. Das ist **eine** Funktion in `bauBuehne()`, kein
   Fünffach-Umbau, und die Vorlage steht schon im Motor: **Gewichtheben enthüllt schon heute
   „Duell für Duell, zwei auf der Bühne (Chris' Bild)"** (`engine.js:18206`). Für alle fünf ist die
   Umstellung per Konstruktion rho-neutral, weil die Bühne alles vorab rechnet und die
   Warteschlange nur die Enthüllungsreihenfolge bestimmt — der Kommentar bei der
   Talentshow-Reihenfolge (`engine.js:16990–16995`) belegt genau das. Der echte Preis ist nicht
   rho, sondern **Sendezeit**: bei fester Minute bleiben je Duell zehn Sekunden. Das ist die eine
   T-Entscheidung, die Chris für diesen Baustein treffen muss.
3. **Der „Simulieren"-Knopf (Punkt 3) ist die Voraussetzung, nicht ein Extra.** Längere, ehrlich
   sequentielle Sendungen (Matchup-Folge, echtes Einzelzeitfahren, Tennis-Ballwechsel) sind erst
   dann zumutbar, wenn man sie mit einem Klick überspringen kann. Deshalb steht er im ersten
   Baupaket, vor der Matchup-Folge.
4. **Vorfrage Q0: Chris' Beobachtungen stammen aus der Battle-Arena, sein Spielstand läuft im
   Manager Mode.** Das „Bein" (`engine.js:34178`, `:37971`), der Tempo-Knopf 1×/2×/4×
   (`#spd`, `engine.js:46274`) und die Bahn-Tafel aus seinem Bildschirmfoto gibt es nur im Motor —
   und laut Review zu PR #1172 läuft **keiner der sieben Live-Spielstände** im Battle Mode
   (`stand-aller-disziplinen.md`, Achtzehnter Nachtrag, Befund 1). Für die reinen Bildwünsche ist das
   egal; für die PP-Anzeige (1) und die Spieler-Historie (2/27) nicht — sie brauchen echte,
   gebuchte Zahlen. Abschnitt 2.
5. **Die Spieler-Historie (2 + 27) ist zu gut zwei Dritteln schon gespeichert.** Jeder
   Saison-Schnappschuss trägt je Spieler eine `disciplineBreakdown` mit Einsätzen, Gesamt- und
   Durchschnittsbeitrag (`lib/data/olyDataTypes.ts:2843–2850`). Chris' Frage „wie spart das
   Speicherplatz" hat damit eine klare Antwort: **Zähler je Spieler × Disziplin × Saison, nie
   Einzelereignisse** — und die Erfassung sollte **früh** starten, weil jede Saison ohne Erfassung
   im Panel für immer fehlt. Abschnitt 3.2.
6. **Drei Wünsche sind Rückkehr zu früheren Entscheidungen — und das ist gut so.** Climbing-Kontakt
   (8) ist exakt der Satz, auf den der Opus-Gegencheck vom 24.09. wartete („Wenn Chris beim Zuschauen
   trotzdem den direkten Kontakt vermisst, reicht ein Satz, und PR 3 kommt wie im Konzept zurück",
   `climbing-opus-gegencheck-24-09.md` Abschnitt 6). I-Spys offener Raum (28e) ist Chris'
   Ursprungsbild vom 21.09., das der Split-Screen (I1, 27.09.) verdrängt hat. Das echte
   Einzelzeitfahren (5) berührt die Startfolge-Frage J1, die Chris am 04.10. mit „So lassen"
   beantwortet hat — mit Einzelstarts wird sie wieder akut. Abschnitt 9 stellt jede dieser drei
   Fragen genau einmal.
7. **Eiskunstlauf behält zwölf Elemente in der Rechnung — und zeigt trotzdem „weniger, dafür
   längere" Durchgänge.** Die zwölf waren der Hebel, der Eiskunstlauf über 0,80 gebracht hat
   (`rundenN` 6 → 12, rho 0,792 → 0,875, Spearman-Brown ohne RNG-Kaskade). Die Antwort auf Chris'
   Satz ist deshalb **Anzeige-Bündelung**: zwölf gerechnete Elemente, drei bis vier gezeigte
   Sequenzen. Nebenbei: Eine ISU-Kür im Einzel hat real tatsächlich zwölf Elemente (vor dem Bau
   gegen die aktuelle ISU-Communication gegenzuprüfen). Abschnitt 3.1.
8. **Das von Chris ausdrücklich bestellte Wettessen-Konzept steht in Abschnitt 6** — baureif,
   überwiegend Klasse A/A\*, und es macht vor allem eines sichtbar, das seit dem 04.10. schon im
   Motor läuft, aber niemand sieht: die Mauer (`BUEHNE_FLAGS.wettessenMauer:2`, `engine.js:16143`).
9. **Reihenfolge in sieben Paketen** (Abschnitt 8): Klärung mit Chris → Kleinkram (Staffel, Climbing
   2D, Bahn-Overlay, Takeshi-Diagnose) → Sendungsrahmen (Simulieren + Matchup-Folge) →
   Laufbahn-Erfassung → Anspiel-Szenen → sieben Konzeptrunden → die Mechanikrunden, die aus ihnen
   folgen. Battlefield und I-Spy stehen bewusst zuletzt: beide fallen heute durch die Rangtreue, und
   bei beiden ist die Konzeptfrage größer als der Bau.

---

## 1. Was die Liste in Wahrheit ist — alle 29 Punkte auf einen Blick

Spalte „Baustein" verweist auf Abschnitt 3 (Q1–Q9), „K" auf eine Konzeptrunde in Abschnitt 5,
„E" auf eine Entscheidung in Abschnitt 9. Umfang: **QW** = Quick Win (≤ ½ Tag, ohne Messrunde),
**K** = braucht eigene Konzeptrunde vor dem Bau, **R** = braucht Mechanik-/Rezeptrunde mit
Messung, **E** = braucht zuerst Chris' Entscheidung.

| Nr | Wunsch (kurz) | Baustein | Klasse | Umfang | Paket |
|---:|---|---|---|---|---:|
| 1 | PP je Spieler am Ende jeder Disziplin | Q4 Ergebnis-Panel | A\* (Battle-Arena) / A (Saisonfluss) | klein–mittel, E1 | 3 |
| 2 | Spieler-Historie je Disziplin | **Q2 Laufbahn** | S + A | groß | 3 |
| 3 | „Simulieren"-Knopf neben 1×/2×/4× | **Q3 Sendungssteuerung** | T (von Chris erbeten) | klein–mittel | 2 |
| 4 | Time-Trial: PP nach Zeitabstand statt Rang | Q4 | W | klein + Messung | 6 |
| 5a | Time-Trial: echtes Einzelzeitfahren, nacheinander | Q3 (Sendezeit) | T (+ E5 Startfolge) | mittel | 4 |
| 5b | Time-Trial: Höhenprofil, Fahrrad | — (Assets) | A | mittel (Asset-Suche) | 4 |
| 6 | Time-Trial: Wertung als Overlay über der Grafik, Z1/Z2/Z3 kompakt | **Q5 Bahn-Overlay** | A | klein–mittel | 1 |
| 7 | Climbing: zurück zu 2D | — | A | QW (entschieden) | 1 |
| 8 | Climbing: herunterziehen, vorbeiziehen, wehren | **Q7 Kontaktregel**, K3 | B (+ E4) | mittel, R | 6 |
| 9 | Takeshi: Performance | — (Diagnose) | — | Diagnose zuerst | 1 |
| 10 | Takeshi: unübersichtlich bei vielen Teilnehmern | Q5 + Q8, **K2** | A/A\* | K, dann mittel | 5→6 |
| 11 | Staffel: „Bein" → „Abschnitt" | — | A | QW | 1 |
| 12 | Staffel: Gesamtzeit Bahn + Wechsel | Q4 | A | QW | 1 |
| 13 | Staffel: Endstand farbig nach Stärke/Schwäche | Q4 (verallgemeinert) | A\* | klein | 1 |
| 15 | Fechten: 1v1 nacheinander, Reveal, Eignung/Historie | **Q1** + Q2 | A (+ T für Karte) | mittel (geteilt) | 2 |
| 16 | Battlefield: Domination mit drei Punkten, Respawn | Q7, **K6** | B + C | groß, K + R | 6 |
| 17 | Showcase: 1v1 aufstellen, kein Hin-und-her | **Q1** | A | klein (geteilt) | 2 |
| 18a | Eiskunstlauf: Paar gegen Paar nacheinander | **Q1** | A | klein (geteilt) | 2 |
| 18b | Eiskunstlauf: weniger, längere Durchgänge | Q1 (Anzeige-Bündelung) | A (T nur bei Mehrzeit) | klein | 2 |
| 19 | Breaking: lange Angriffs-/Ertragensphasen, Offensiv/Defensiv sichtbar, Erschöpfung/Blut | Q7 + Q8, **K4** | A (Bild) + B (Phasen, Peiniger) | K, dann mittel | 5→6 |
| 20 | Wettessen: komplettes visuelles Rework, Fable-Konzept | **Abschnitt 6** (hier geliefert) | A/A\* | mittel | 4 |
| 21 | Basketball: Sprungball durch die Center, Animation | **Q6 Anspiel** | B klein | klein–mittel | 4 |
| 22 | Basketball: Tempo, Passspiel, Freilaufen statt Klumpen | **Q9 Feldspiel-Sonde**, K5 | B | K + R | 6 |
| 23 | Football: Kickoff, QB bekommt Snap, Würfe, Blocken | Q6 + Q9, **K5** | B (+ E7) | groß, K + R | 5→6 |
| 24a | Hockey: Bully in der Mitte als Start | **Q6 Anspiel** | B klein | klein | 4 |
| 24b | Hockey: mehr Passspiel prüfen | Q9, K5 | B | Messung zuerst | 5→6 |
| 25a | Tennis: 1v1 nacheinander | **Q1** | A | klein (geteilt) | 2 |
| 25b | Tennis: Ballflug, Schlagvielfalt, Aus, Erreichbarkeit, optische Bugs | K8 | A/A\* (+ T für Zeit) | mittel | 5→6 |
| 26 | Schach: 1v1 nacheinander | **Q1** | A | klein (geteilt) | 2 |
| 27 | Kampf-Laufbahn-Panel als Vorbild für jede Disziplin, mehrere Saisons, speicherschonend | **Q2 Laufbahn** | S + A | groß | 3 |
| 28 | I-Spy: Interaktion, Gedanken-Icons, exklusive Fundorte, Hinweisstärke sichtbar, offener Raum | Q7 + Q8, **K7** | A (Icons, Transparenz) + B/C (Raum, Exklusivität) | groß, K + R | 5→7 |
| 29 | Formkarten „+4 vs +8" | — | — (kein Bug) | E9 | 0 |
| 30 | Formkarten: flacher Attribut- vs. Eignungsbonus | — | C (+ Messung) | E10, dann R | 0→6 |

Punkt 14 fehlt absichtlich (s. Kopf).

**Doppelungen, die die Tabelle sichtbar macht:**

- **Q1 Matchup-Folge** bedient 15, 17, 18a, 18b, 25a, 26 — sechs Zeilen, ein Bau.
- **Q2 Laufbahn** bedient 2 und 27 direkt und speist 15 (Historie im Reveal) und 1 (PP-Zahlen über
  Saisons).
- **Q4 Ergebnis-Panel** bedient 1, 12, 13 und ist der Ort, an dem 4 sichtbar wird.
- **Q6 Anspiel** bedient 21, 23 (Kickoff-Teil) und 24a — und alle drei Wörter stehen heute schon im
  Anpfiff-Countdown, ohne dass auf dem Feld etwas passiert (Abschnitt 3.6).
- **Q7 Kontaktregel** ist der gemeinsame Nenner von 8, 16, 19 und 28: vier Disziplinen, in denen
  Gegner sich erstmals körperlich in die Quere kommen sollen.
- **Q8 Zustandsbild** bedient 19 (Erschöpfung/Blut), 28 (Sprechblasen-Icons) und hilft 10.
- **Q9 Feldspiel-Sonde** bedient 22, 23 und 24b mit einer gemeinsamen Mess- und Rechercherunde.

---

## 2. Vorfrage Q0 — Welche Bühne meint Chris?

Das Projekt hat zwei Oberflächen, auf denen eine Disziplin läuft:

| | Battle-Arena (Motor) | Spieltags-Bühne (Saisonfluss) |
|---|---|---|
| Code | `public/mockups/battle-mode.engine.js`, eingehängt über `app/foundation/battle-arena/FoundationBattleArenaHost.tsx` | `app/foundation/discipline-stage/DisciplineStageArena.tsx` + `arena/disciplines/*.tsx` |
| Format | Team gegen Team, bis zu sechs je Seite, echte Simulation | ligaweite Enthüllung über alle Teams, Primitive je Disziplin (`NATIVE_PRIMITIVE`, `DisciplineStageArena.tsx:117–141`) |
| Erreichbar | Reiter „Battle Arena" (Entwurf) bzw. Spielstände mit `gameMode: "battle"` | jeder Spieltag im Manager Mode |

**Woran man sieht, dass Chris die Battle-Arena beschreibt:** das Wort „Bein" steht nur im Motor
(Staffel-HUD `engine.js:34178`, Ticker `:33766`, Tabellenkopf `:37971`); der Tempo-Knopf
1× → 2× → 4× ist `#spd` (`engine.js:46274–46287`); die Spalten „LÄUFER / WEIT / PUS" für zwei Teams
aus seinem Bildschirmfoto sind die Bahn-Tafel des Motors; das „Hin und her" bei Tennis/Schach/
Fechten ist die generische Bühnen-Warteschlange (`engine.js:17050–17059`). Die native Bühne kennt
für Tennis gar kein Duell (`tennis: "klassen"`, Liga-Klassen-Bänder).

**Ausnahme: Mini-DM.** Dort sieht Chris die native Bühne (`duelhp.tsx`) — das hat die Mini-DM-
Prüfung vom 13.10. herausgefunden. Für diesen Plan unerheblich (Punkt 14 ist ausgenommen).

**Was daraus folgt:**

- **Für alle Bildwünsche (Q1, Q5, Q6, Q8, Wettessen, Takeshi, Tennis-Ballflug)** ist die Arena der
  richtige Ort. Sie wirken, sobald Chris dort zuschaut — und in einem Battle-Mode-Spielstand auch im
  Saisonfluss.
- **Für die PP-Anzeige (1) und die Laufbahn (2/27)** braucht es gebuchte Zahlen. Die gibt es
  heute zuverlässig nur im Saisonfluss (Manager Mode: PPS-Pfad; Battle Mode: individuelle PPs aus dem
  Arena-Boxscore, `lib/resolve/battle-mode-arena-team-points.ts`). In der Arena als Entwurfsreiter
  wäre jede PP-Zahl eine **Vorschau**, keine Buchung — sie muss dann auch so heißen.
- **Entscheidung E1 (Abschnitt 9):** Will Chris einen Spielstand im Battle Mode spielen? Wenn ja,
  ist das die eigentliche Freischaltung von fast allem, was seit September gebaut wurde (O2, O7,
  Spurt-Säule, Schach-Uhr, Wettessen-Mauer — alle „im echten Spielstand, sobald ein Save Battle
  Mode nutzt"). Wenn nein, bleibt dieser Plan trotzdem gültig, aber Paket 3 baut die Laufbahn
  zuerst für den Manager-Mode-Fluss und die Arena-Zähler erst danach.

---

## 3. Die Querschnitts-Bausteine

### 3.1 Q1 — Matchup-Folge: „das nächste Matchup kommt erst, wenn das vorherige durch ist"

**Chris, in fünf Varianten am 13.10.:** Fechten „nacheinander 1v1 kämpfen und nicht alle
gleichzeitig die permanent durchgeschaltet werden"; Showcase „im 1v1 aufstellen und nicht immer hin
und her switchen, das nächste Matchup kommt erst wenn das vorherige durch ist!"; Eiskunstlauf
„genauso! … treten quasi 2 von team a vs 2 von team b an"; Tennis „bitte aber auch NACHEINANDER
machen!"; Schach „bitte auch im 1v1 nacheinander zeigen!".

#### 3.1.1 Was heute schaltet — und warum

| Disziplin | Warteschlange heute | Wo | Chris' Matchup-Einheit |
|---|---|---|---|
| Fechten, Tennis, Speed-Schach | **rundenweise über alle Bretter**: Durchgang 1 aller sechs Paare, dann Durchgang 2 … — je Enthüllung ein anderes Brett | generischer Zweig `engine.js:17050–17059` | Brett i Heim gegen Brett i Gast |
| Showcase | Block 1 „Casting": alle zwölf Acts je ein Durchgang, Seiten verzahnt (die Montage, die Chris als Hin-und-her erlebt); Block 2 „Show": jeder Act am Stück, Seiten verzahnt | `engine.js:16996–17048` (S-F1, 30.09.) | Act i Heim gegen Act i Gast |
| Eiskunstlauf | Block Kurzprogramm, dann Block Kür (neu sortiert nach Kurzprogramm-Summe); innerhalb eines Paares wechseln die Partner alle ~0,85 s | `engine.js:16930–16981` (E-F1, 30.09.) | Paar k Heim gegen Paar k Gast |
| Gewichtheben | **schon Matchup-Folge**: Duell für Duell, innerhalb des Duells Versuch um Versuch | `engine.js:18206–18216` | — (Vorlage) |
| Breaking | **schon Matchup-Folge**: Gauntlet, Slot gegen Slot, Sieger bleibt | `baueGauntlet()` | — (Vorlage) |
| Wettessen | alle gleichzeitig (`buehneGruppenGroesse`) | `engine.js:17060–17069` | **bleibt gleichzeitig** (s. 3.1.6) |

#### 3.1.2 Der Baustein

**Ein Warteschlangen-Modus `folge:"matchup"` in `bauBuehne()`**, der aus Matchups statt aus
Durchgängen baut. Drei Parameter je Disziplin, mehr nicht:

1. **Einheit** — wer bildet eine Seite des Matchups: ein Spieler (Fechten, Tennis, Schach,
   Showcase) oder ein Paar (Eiskunstlauf, über die vorhandene Duett-Fusion).
2. **Innere Ordnung** — Duell-Sportarten **wechseln je Durchgang** (Treffer um Treffer, Punkt um
   Punkt, Zug um Zug: A₁ B₁ A₂ B₂ …, wie Gewichtheben); Auftritts-Sportarten zeigen **erst A
   komplett, dann B komplett** (eine Kür wird nicht unterbrochen, ein Act auch nicht).
3. **Matchup-Reihenfolge** — für Schach die Brettordnung (Regel, s. Bühnen-Duell-Papier 4,
   „Zu S5"), für Fechten und Tennis Chris' Aufstellung (Slot 1 eröffnet, Slot 6 schließt — das ist
   F-F1 aus `fable-ideen-buehne-duell-30-09.md` Punkt 1, damals schon als rho-neutral begründet),
   für Showcase und Eiskunstlauf wie heute „Star zuletzt".

**Warum rho-neutral per Konstruktion:** die Bühne rechnet jeden `runden[]`-Eintrag in `setz()` vorab
(„ALLE DURCHGAENGE SOFORT DURCHRECHNEN"), `stepBuehne()` addiert bei der Enthüllung nur
`u.summe += r.punkte` und zieht nie `rr()`. Die Warteschlange bestimmt also ausschließlich die
Reihenfolge des Aufdeckens — die Talentshow-Reihenfolge hat das am 17.09. mit bit-identischer
Messung belegt (`engine.js:16990–16995`). **Abnahme:** `node scripts/miss-alle-disziplinen.mjs 24
speed-schach tennis fechten showcase eiskunstlauf` vorher/nachher bit-identisch, dazu
`scripts/miss-arena-buehne-spiegel.mjs` (unverändert erwartet, weil die Seitenwertung nicht berührt
wird) und Sichtprüfung über `scripts/screenshot-disziplin.mjs`.

**Was der Baustein nicht tut:** Er ändert die **Teamwertung** nicht. Bei den Duellen zählen weiter
„Bretter gewonnen" (Schach mit Uhr: `duellBrettSieg()`), bei Showcase und Eiskunstlauf die Summe.
Wer möchte, dass ein Showcase-Matchup als „gewonnen" zählt, verlangt eine Wertungsänderung (W) —
das ist ausdrücklich nicht Teil von Q1. Ein „Matchup gewonnen"-Banner als reine Anzeige (A\*) geht
dagegen sofort.

#### 3.1.3 Die Matchup-Karte (der „kleine Reveal")

Chris zu Fechten: „da könnte man auch n kleinen Reveal machen wer gegen wen - evtl die Stats zeigen
wie die Eignung ist oder wie die Spieler bisher in der Diszi performt haben". Das ist die
„Tale of the Tape"-Idee A2 aus `fable-ideen-broadcast-praesentation-30-09.md`, eine Ebene tiefer:
nicht Team gegen Team im Einlauf, sondern **Spieler gegen Spieler vor jedem Matchup**.

Inhalt, Zeile für Zeile, der bessere Wert hervorgehoben:

    Porträt  Name · Slot-Rolle        ◄ Matchup 3 von 6 ►        Name · Slot-Rolle  Porträt
             Eignung Fechten 71 (Kader-Rang 2)          Eignung 64 (Kader-Rang 4)
             Laufbahn: 9 Gefechte, 6 Siege              Laufbahn: 4 Gefechte, 1 Sieg
             Stand vor diesem Duell: 2 : 0

- **Eignung** liest `u.eig` (liegt im Motor vor).
- **Laufbahn-Zeile** kommt aus Q2 und erscheint **erst, wenn es echte Zahlen gibt** — keine
  Beispielwerte, kein Platzhalter (die Projektregel aus dem Kampf-Profil: „Laufbahn-Zahlen sind
  Beispiele" ist genau der Hinweis, den es hier nicht geben soll, `public/mockups/battle-mode.html:470`).
- **Kein Spoiler:** die Karte zeigt nur, was vor dem Matchup feststeht (Eignung, Historie, Stand).

**Sendezeit — die eine T-Frage dieses Bausteins.** Die Karte kann auf zwei Arten kommen:

- **A (Overlay, Klasse A):** die Karte liegt 1,5 s über den ersten Durchgängen des Matchups, die
  Sendezeit bleibt 60 s.
- **T (eigene Pause):** 2–2,5 s Stillstand je Matchup, sechs Matchups = +12 bis +15 s Sendezeit.

Ich empfehle **A als Standard** und T nur, wenn Chris die Karte beim Zuschauen zu kurz findet.

#### 3.1.4 Was die Matchup-Folge mit der festen Minute macht

| Disziplin | rundenN | heute je Enthüllung | mit Matchup-Folge je Matchup (60 s) |
|---|---:|---:|---:|
| Speed-Schach | 10 | 0,50 s (`60/(10·6·2)`) | 10 s für zehn Züge beider Seiten |
| Tennis | 10 | 0,50 s | 10 s für zehn Punkte — **1 s je Ballwechsel** |
| Fechten | 9 | 0,56 s | 10 s für neun Gänge |
| Showcase | 5 | 1,0 s | 10 s: 5 s je Act |
| Eiskunstlauf | 12 | 0,425 s | 20 s je Paar-Matchup: ~10 s je Kür |

Für Schach, Fechten und Showcase reicht das. **Für Tennis nicht**, sobald 25b (echter Ballflug,
Bälle ins Aus, Lauf zum Ball) dazukommt — ein lesbarer Ballwechsel braucht 1,5–2,5 s. Tennis
braucht deshalb mit K8 eine eigene T-Entscheidung (etwa 90 s Sendezeit), nicht Q1.

#### 3.1.5 Eiskunstlauf: Anzeige-Bündelung statt weniger Elemente

Chris: „mach die Durchgänge länger dafür weniger! 12 ist doch sicher auch nicht üblich im
Eiskunstlauf?"

**Die zwölf bleiben in der Rechnung.** Sie sind der Grund, warum Eiskunstlauf besteht:
`rundenN` 6 → 12 hob rho kaderfest von 0,792 auf 0,875 (`stand-aller-disziplinen.md`, 5b,
Nachtrag 07.09.) — der reine Verlässlichkeitsfall, den CLAUDE.md beschreibt. Zurück auf vier oder
sechs hieße zurück unter 0,80.

**Gezeigt werden „weniger, dafür längere" Durchgänge.** Die Kür eines Paares wird in **drei bis
vier Sequenzen** enthüllt statt in zwölf Einzelelementen, je Sequenz eine durchgehende Animation
(Anlauf, Sprungkombination, Pirouette, Landung) und **eine** Wertungszahl (Summe der gebündelten
Elemente). Das Kurzprogramm (heute vier Elemente, `EISKUNSTLAUF_KURZPROGRAMM_N`, `engine.js:16440`)
wird eine Sequenz. Das ist Klasse A: dieselben `runden[]`, dieselbe Summe, nur seltener aufgedeckt.

**Paarlauf wird gemeinsam gelaufen.** Eiskunstlauf ist über `duett:true` ein Paarlauf. Heute wechseln
die Partner eines Paares Element um Element (`engine.js:20651`). In der Matchup-Folge laufen beide
Partner **zugleich** (ein Programm, zwei Figuren), dann das Gast-Paar — das ist, was Chris mit „2 von
team a vs 2 von team b" beschreibt.

**Kurzprogramm/Kür (E-F1) bleibt.** Beides verträgt sich: Block 1 sind drei Matchups
Kurzprogramm, Block 2 drei Matchups Kür in der verdienten Reihenfolge. Jedes Paar erscheint
zweimal — aber nie verschränkt mit einem anderen.

**Zu „12 ist nicht üblich":** Eine Einzel-Kür nach ISU hat real zwölf Elemente (sieben
Sprungelemente, drei Pirouetten, Schrittfolge, Choreo-Sequenz), das Kurzprogramm sieben. Zwölf ist
also nicht unrealistisch — es fühlt sich nur so an, weil jedes Element einzeln aufblitzt. Genau das
behebt die Bündelung. (Vor dem Bau gegen die aktuelle ISU-Communication prüfen; ich habe das nicht
nachgeschlagen, sondern aus dem allgemeinen Regelwissen.)

#### 3.1.6 Showcase: die Casting-Montage weicht

S-F1 (30.09.) hat die Casting-Montage bewusst eingeführt — ein Durchgang je Act, alle zwölf
nacheinander, „kurz angerissen wie eine Audition-Montage". Genau diese Montage ist das Hin-und-her,
das Chris jetzt nicht mehr will. **Vorschlag:** die Montage entfällt; Showcase läuft als sechs
Matchups, Act gegen Act, je Act alle fünf Durchgänge am Stück. Die Schlussposition („pimp slot")
bleibt dem stärksten Matchup, nur nicht mehr aus dem Casting verdient, sondern aus der Aufstellung.
Das ist Chris' jüngere Aussage gegen eine ältere Fable-Idee — die jüngere gilt.

#### 3.1.7 Wo die Matchup-Folge ausdrücklich nicht hingehört

- **Wettessen** ist im echten Sport gleichzeitig (Coney Island: zehn Minuten, alle an einer Tafel).
  Dort ist das Problem nicht die Gleichzeitigkeit, sondern dass man sie nicht lesen kann — Abschnitt 6.
- **I-Spy** wird mit 28e ein gemeinsamer Raum, kein Duell-Stapel (K7).
- **Takeshi** — Chris selbst: „nacheinander ist auch doof" (K2).

#### 3.1.8 Fechten: die Staffel liegt bereit

Die Fechtstaffel F-F1 (`fable-ideen-buehne-duell-30-09.md` Abschnitt 3) bestand aus drei Teilen:
(1) Enthüllung sequentiell, (2) Teamstand = kumulierte Treffer, (3) Reihenfolge = Chris'
Aufstellung. Q1 baut (1) und (3). **(2) ist eine Wertungsänderung (W)** und gehört Chris als
Frage E3: Soll der Mannschaftskampf im Fechten als kumulierte Staffel zählen (real olympisch) oder
weiter „Bahnen gewonnen"? Mit der Matchup-Folge wird die Staffel-Zählung erst lesbar — vorher war
sie nicht zu zeigen.

---

### 3.2 Q2 — Disziplin-Laufbahn (Punkte 2 und 27)

**Chris:** „sowas hätt ich gern im drawer für JEDE disziplin wenn das geht müsste natürlich über
mehrere seasons dann getrackt werden, überlege mal bitte wie das speicherplatz spart aber wir
trotzdem auf die Daten zugreifen können, dann auch im normalen season flow in seinem Spielerprofil
wenn man die Diszis anklickt zb dass dann so ein Stat Panel einklappbar ausfährt".

#### 3.2.1 Was schon gespeichert ist

| Ebene | Wo | Inhalt |
|---|---|---|
| Laufende Saison | gebuchte Spieltagsergebnisse | je Spieler × Spieltag × Disziplin: Punkte, Rang, `pointsAwarded` (über `resolveAwardedPlayerPoints`) |
| Vergangene Saisons | `SeasonSnapshotPlayerPerformanceRecord.disciplineBreakdown` (`lib/data/olyDataTypes.ts:2843–2850`, `:2897`) | je Spieler × Disziplin: `appearances`, `totalContribution`, `averageContribution`, `averageFinalScore` |
| Auszeichnungen | `buildPlayerSeasonAwards` (`lib/foundation/player-season-awards.ts`) | Muster für „über alle Saisons aus den Schnappschüssen lesen" |
| Kampf-Profil (Attrappe) | `public/mockups/battle-mode.html:466 ff.` (Reiter „Spielerprofil") | KAMPFWERTE + LAUFBAHN mit Beispielzahlen, ehrlich beschriftet |

Damit lassen sich **Einsätze, Ø PP, Ø Rang, beste Leistung, Saison-für-Saison-Verlauf** heute schon
anzeigen, ohne ein einziges neues Feld. Das ist der größere Teil dessen, was Chris im Bild sieht.

#### 3.2.2 Was fehlt — und wie es speicherschonend dazukommt

Was fehlt, sind die **disziplineigenen** Zahlen des Kampf-Vorbilds: Ausschaltungen, Ausgefallen,
Schaden ausgeteilt/genommen, Assists, Verletzungen, Spieler des Spieltags — und ihre Entsprechung in
den anderen Chassis.

**Regel: Zähler, nie Ereignisse.** Je Spieler × Disziplin × Saison ein kleiner, fester Satz Zahlen,
als optionales Feld an der bestehenden Zeile:

    SeasonSnapshotPlayerDisciplineBreakdownRecord.laufbahn?: Record<string, number>

Optional und additiv wie `DisciplineResultRecord.momente?` und `SeasonState.staffelWechselPaare?`
(O7): ein Stand ohne das Feld hat einfach noch keine Laufbahn — keine Migration, kein Bruch.

**Größenordnung (obere Schranke, grob):** 400 Spieler × 20 Disziplinen × 10 Zähler = 80 000 Zahlen
je Saison — und real deutlich weniger, weil kein Spieler alle zwanzig Disziplinen in einer Saison
läuft. Selbst als JSON bleibt das im niedrigen Hunderter-KB-Bereich je Saison. Einzelereignisse
(jeder Treffer, jeder Pass) wären um Größenordnungen mehr und werden nie gespeichert.

#### 3.2.3 Zählerkatalog je Chassis (Vorschlag, Konzeptstufe)

| Chassis | Zähler (alle Saison-Summen; Quoten werden beim Lesen gebildet) |
|---|---|
| Arena (TDM, Mini-DM, Battlefield) | Einsätze, Ausschaltungen, ausgeschaltet, Assists, Schaden aus, Schaden ein; Battlefield + Punkte erobert, Haltesekunden |
| Feldspiel (Basketball, Hockey, Football) | Einsätze, Punkte/Tore/TDs, Assists, Steals/Takeaways, Rebounds bzw. Saves (Torwart), Ballverluste |
| Bahn (Staffel, Spurt, Time-Trial, Takeshi, Climbing) | Starts, Siege, Podien, Summe der Ränge, Bestwert (Zeit/Höhe/Burgpunkte, als min/max statt Summe) |
| Bühne-Duell (Schach, Tennis, Fechten, I-Spy) | Duelle, Duelle gewonnen, Punkte/Treffer für/gegen |
| Bühne-Auftritt (Showcase, Eiskunstlauf, Wettessen) | Auftritte, Summe Wertung, Bestwertung, Matchups gewonnen |
| Heben / Gauntlet (Gewichtheben, Breaking) | Duelle, Siege, Bestlast bzw. Ausgeschaltete, Fehlversuche bzw. „gibt auf" |
| alle | Spieler des Spieltags, Verletzungen in dieser Disziplin |

Jeder Zähler muss aus einem Wert kommen, den der Motor **ohnehin** im Boxscore ausgibt
(`ArenaFixtureBoxscoreEintrag`); wo nicht, fällt er weg. Kein neuer Wurf, kein neues Sim-Feld.

#### 3.2.4 Schreiben und Lesen

- **Schreiben im Result-Apply** — dieselbe Stelle, an der O7 seine Paar-Zähler fortschreibt.
  **Aus dem O7-Review lernen** (Achtzehnter Nachtrag, Befund 2: ein neu gebuchter älterer Spieltag
  konnte Zähler eines neueren zurücksetzen): in der laufenden Saison **je Spieltag ablegen und beim
  Neu-Buchen ersetzen** (Schlüssel `matchdayId`), erst beim Saisonabschluss in die Saisonzeile
  falten. Dann ist jedes Neu-Buchen idempotent, egal in welcher Reihenfolge.
- **Lesen über eine Rechenstelle** nach dem Muster `buildPlayerSeasonAwards`: laufende Saison aus
  den Spieltagen, frühere aus den Schnappschüssen, eine Funktion, drei Anzeigeorte:
  1. **Spielerprofil → Disziplin anklicken → einklappbares Panel** (Chris' Hauptwunsch; Vorbild ist
     das Kampf-Profil `#p3`: links Eignung/Slot-Neigung, rechts Laufbahn, darunter Saison-Leiste),
  2. **Drawer der Spieltags-Bühne** (`DisciplineStageDrawer.tsx` existiert, lädt lazy),
  3. **Laufbahn-Zeile der Matchup-Karte** (Q1).
- **Manager Mode vs. Battle Mode:** im Manager Mode gibt es nur die Zeilen aus 3.2.1 (PP, Rang,
  Einsätze) — die disziplineigenen Zähler entstehen nur, wo der Arena-Boxscore die Buchung trägt.
  Das Panel zeigt dann, was es hat, und lässt den Rest weg (nicht „0").

**Klasse S** (neuer Spielstands-Zustand) + A (Anzeige). **Warum früh:** jede Saison, die ohne
Erfassung läuft, fehlt im Laufbahn-Panel für immer. Das Panel kann warten, die Erfassung nicht —
deshalb trennt Paket 3 beides.

---

### 3.3 Q3 — Sendungssteuerung: der „Simulieren"-Knopf und das Sendezeit-Budget

**Chris:** „Neben Tempo 1x 2x 4x muss es noch einen Button geben mit dem man die Disziplin
simulieren kann, wo dann direkt das Ergebnis revealed wird".

**Der Knopf.** Ein vierter Zustand neben `#spd`: „⏭ Ergebnis". Er springt nicht ans Ende einer
Animation, sondern rechnet den Rest **ohne Bild** durch und öffnet den Endstand.

- **Bühne:** trivial — alles ist vorab gerechnet, die Warteschlange wird auf einen Schlag geleert
  (`buehneZeiger` ans Ende, Summen nachziehen).
- **Bahn, Feldspiel, Arena:** dieselbe Tick-Schleife, die `sondenLauf()` und die Sonden schon
  nutzen, im stillen Modus (`stumm`, wie die Messläufe: kein Ticker, keine Töne, keine Highlights)
  bis `endstand`. Die Simulation ist tick-, nicht wandzeitgetrieben — das ist dieselbe
  Determinismus-Voraussetzung, auf der D7 „Finale in Echtzeit" (PR #1166) gebaut ist.
- **Buchung:** im Saisonfluss ruft der Endstand dieselbe Commit-Funktion wie der Zieleinlauf
  (`onCommitDiscipline`, `DisciplineStageArena.tsx:157`). Kein zweiter Buchungsweg.
- **Abnahme:** ein Lauf bis zum Ende mit Bild und einer mit Knopf nach 10 s müssen denselben
  Endstand (Rohdaten-Hash) liefern — für jede der zwanzig. Wenn eine Disziplin das nicht erfüllt,
  hängt ihre Simulation an der Wandzeit, und das ist dann ein Befund, kein Knopf-Problem.

**Klasse T** — und Chris hat ihn ausdrücklich bestellt. Das gilt als seine Zustimmung zu diesem
Knopf, nicht zu anderen Tempo-Eingriffen.

**Nachtrag (Task #104, Agent-Recherche 13.10.): der Knopf existiert schon.** Bevor dieser
Abschnitt in Code umgesetzt wurde, stellte sich heraus, dass Chris denselben Wunsch bereits am
04.09. geäußert hatte („wir brauchen noch nen quick sim button um das ergebnis zu simulieren") und
er seitdem gebaut ist: **„⏩ Quick-Sim"** in `DisciplineStageNativeArena.tsx` (`quickSim()`,
~Zeile 3300; Knopf ~Zeile 3942). Das Dokument hier ist nicht veraltet in der Absicht, nur im
technischen Bild — geschrieben, als wäre die Bühne noch die alte iframe-Engine
(`public/mockups/battle-mode.engine.js`, `#spd`, `sondenLauf()`). Tatsächlich läuft seit dem
iframe-Abbau (s. `docs/discipline-stage-native-rebuild-plan.md`) **jede** der zwanzig Disziplinen
über `DisciplineStageNativeArena.tsx` — ein einziges, geteiltes Bauteil, kein Chassis-Unterschied
mehr zwischen Bühne/Bahn/Feldspiel/Arena auf dieser Ebene. Das ändert die Antwort auf die Fragen
unten:

- **Kein viertes Tempo gegenüber 1×/2×/4× nötig**, weil es diese Tempo-Stufen in der nativen Bühne
  gar nicht mehr gibt (nur noch Einzel-Etappen-Fortschritt + Quick-Sim + Reset). Die alte Engine mit
  `#spd` lebt nur noch als Dev-Vorschau (`FoundationBattleArenaHost.tsx` /
  `FoundationShellRouterBody.tsx`) und für den **serverseitigen, headless Resolve**, der `preview`
  erzeugt — dort war Simulation nie wandzeituhr-gebunden, das Problem bestand dort nie.
- **Determinismus ist bauartbedingt gegeben, nicht nur gemessen:** `commitFinishedDiscipline`
  (`DisciplineStageArena.tsx:2339`) bucht IMMER `onCommitDiscipline(side, preview)` — dasselbe
  `preview`-Objekt, unabhängig davon, ob die Bühne bis zum Ende durchlief oder Quick-Sim gedrückt
  wurde. Die Bühne selbst berechnet keine Wertung, sie zeigt nur den bereits aufgelösten Spielplan-
  Eintrag an (`buildRT()`/`playerNet()`/`recomputeRanks()` sind reine Funktionen über diese Daten,
  ohne `Math.random()` im Score-Pfad — Zufall taucht nur noch in Konfetti-/Partikel-Koordinaten
  auf, nie im Endstand). Ein Feld-Primitive wie `duelhp.tsx` (Arena-Chassis) zeichnet nur, was es
  an Props bekommt — es führt keine eigene Simulation.
- **Bereits empirisch belegt:** `tests/arena-bereits-gewertet.test.ts:19` hält fest, dass der
  Spielstand nach einem vollen Quick-Sim **md5-identisch** mit einem normal durchgespielten Lauf
  war (Season 1, Spieltag 10). Ergänzend abgesichert durch `tests/arena-ladder-rank-delta.test.ts`
  (Rang-Verlauf je Etappe, nicht nur am Ende), `tests/arena-gemeinsame-zeitbasis.test.ts` /
  `tests/arena-steuerung-erreicht-den-gast.test.ts` / `tests/vier-restbefunde.test.ts`
  (Multiplayer-Quick-Sim bleibt auf der aktiven Spieltagsseite, Gast sieht denselben Sprung).
- **Eine kleine, nicht blockierende Abweichung vom Ideal „ohne Bild":** Quick-Sim ruft nach ~200 ms
  weiterhin `showPodium()` auf, die reguläre Podest-Enthüllung mit Konfetti/Ton (~2,4 s), bevor
  `onEnded()`/die Buchung feuert — es ist also kein 0-Frame-Sprung, sondern ein kurzer, stummer-bis-
  auf-das-Podest Übergang. Bucht trotzdem korrekt und sofort genug für Chris' Anliegen; ein echtes
  „sofort, ganz ohne Podest" wäre ein separater, rein kosmetischer Folge-Task, kein Korrektheits-Bug.

**Empfehlung:** Task #104 als erledigt schließen (Referenz: „⏩ Quick-Sim", 04.09., seitdem laut
Code-Kommentaren mehrfach nachgebessert — Rang-Verlauf je Etappe statt Endrang-Kopien, Multiplayer-
Sprung bleibt auf der aktiven Spieltagsseite, `busyRef`-Fix gegen einen wirkungslosen Klick während
der laufenden Kaskade). Kein neuer, zweiter Knopf nötig; zwei nahezu gleiche Knöpfe nebeneinander
wären eine Verschlechterung, keine Verbesserung.

**Das Sendezeit-Budget.** Mit dem Knopf wird eine Frage beantwortbar, die bisher jede T-Idee
blockiert hat: **Darf eine Disziplin länger als eine Minute dauern, wenn man sie überspringen kann?**
Vorschlag für Entscheidung E2:

| Disziplin | heute | Vorschlag | Grund |
|---|---:|---:|---|
| Schach, Fechten, Showcase, Eiskunstlauf | 60 s | 60 s (+ Karte als Overlay) | Q1 passt hinein |
| Tennis | 60 s | ~90 s | lesbarer Ballwechsel (25b) |
| Time-Trial | ~95 s (Median) | ~100–120 s | echtes Einzelzeitfahren (5a, s. 4.2) |
| alle anderen | unverändert | unverändert | — |

---

### 3.4 Q4 — Ergebnis-Panel: „was hat jeder geleistet" (Punkte 1, 12, 13, 4)

**PP je Spieler (1).** Zwei Orte, zwei Lagen:

- **Saisonfluss:** die Spieltags-Topspieler zeigen PP bereits — aber über **beide** Disziplinen des
  Spieltags summiert und auf die Top-Liste begrenzt (`DisciplineStageTopPlayers.tsx:135–160`, mit
  Chris' Zitat zur Sortierung). Was fehlt, ist die Zeile je Spieler **je Disziplin**, direkt im
  Endstand dieser Disziplin. Klasse A — die Zahl ist gebucht.
- **Battle-Arena:** der Endstand kennt keine PP. Die Kurven (Boxscore-Rohwert → PP, je Disziplin
  `*_INDIVIDUAL_PPS_MAX`/`*_PPS_ANTEIL_MITTE` und eine PPS-Referenz,
  `lib/resolve/battle-mode-arena-team-points.ts:224–436`) leben in einer Datei, die über den
  Headless-Runner Playwright mitzieht — genau der Grund, warum `arena-resolved-disciplines.ts` und
  `arena-seed.ts` schon einmal herausgelöst wurden (Kopfkommentar dort). **Dasselbe Muster für die
  Kurven:** ein browser-taugliches Modul, das der Host liest und dem Motor nach dem Endstand reicht.
  Klasse A\*. Im Entwurfsreiter heißt die Spalte „PP (Vorschau)", in einem Battle-Mode-Spielstand
  „PP".

**Farbe nach Stärke/Schwäche (13), verallgemeinert.** Chris will „direkt starke und schwache
Performances erkennen". Der ehrlichste Maßstab dafür ist nicht die absolute Zahl (der Beste ist
immer grün), sondern **Leistung gegen Erwartung**: Rang dieses Spielers im Spiel gegen seinen
Eignungsrang im Kader. Wer als Eignungs-Achter Dritter wird, ist grün; wer als Eignungs-Zweiter
Zehnter wird, rot; dazwischen neutral. Das braucht keine neue Zahl (beide Ränge liegen im Motor)
und funktioniert für alle zwanzig Chassis gleich — die Staffel ist nur der erste Ort. Klasse A\*.
Nebenwirkung: dieselbe Spalte ist ein dauernder, sichtbarer rho-Spiegel — wenn ständig der
Eignungsbeste rot ist, sieht Chris es, bevor eine Messung es sagt.

**Staffel-Gesamtzeit (12).** Die Bausteine liegen vor (`u.etappenZeit`, `u.wechselKonto`/
`wechselNetto`). Spalten „Bahn · Wechsel · Gesamt", Teamzeile mit Summe. Klasse A.

**Time-Trial-PP nach Zeitabstand (4).** Heute ist der Rohwert der Bahn-Disziplinen der Rang
(`bahnTeamstand()`, `wertung:"rang"`). Chris: „da manche Spieler ja sogar zeitlich einen Vorsprung
rausholen oder manche besonders langsam sind". Vorschlag: Rohwert = **Zeitabstand zum
Siegerzeit-Median des Spiels**, gedeckelt (sonst bestimmt ein einziger Sturz die ganze Kurve), über
dieselbe PP-Kurve gelegt. Das ist **Klasse W** — keine neue Zufallszahl, aber ein anderer Rohwert,
also Messpflicht und neue `time-trial-pps-referenz.json`. Erwartung (nicht gemessen): ein stetiger
Rohwert sollte rho eher heben als senken, weil Rang Information wegwirft. Wenn das trägt, ist
dieselbe Frage für Spurt und Climbing naheliegend — aber nur für Time-Trial bestellt.

---

### 3.5 Q5 — Bahn-Overlay-Tafel (Punkt 6, hilft 10 und 12)

Chris' Bildschirmfoto zeigt die Spalten „LÄUFER / WEIT / PUS" — das sind nicht Time-Trial-Spalten,
sondern die **generische Bahn-Tafel**, die Spurt, Staffel, Takeshi, Climbing und Time-Trial teilen.
Der Wunsch („als kompaktes Overlay ÜBER der Grafik … evtl auch ausklappbar, mit mehr Infos und einer
kompakten Ansicht mit nur Z1 Z2 Z3") ist deshalb am billigsten **einmal für das Bahn-Chassis** zu
bauen, mit einer kompakten Spaltenliste je Disziplin:

| Disziplin | kompakt (Standard) | ausgeklappt |
|---|---|---|
| Time-Trial | Z1 · Z2 · Z3 (+ Ampel gegen Hot Seat, J2) | Geländezone, Rennplan, Puste |
| Staffel | Abschnitt · Gesamt (12) | Bahn, Wechsel, Paar „eingespielt" |
| Takeshi | Hindernis · Burgpunkte | Fallen, Nerven |
| Climbing | Höhe · Exe | Balance, Pump |
| Spurt | Station · Abstand | Joker, Puste |

Halbtransparent über dem oberen Bildrand, Teamfarbe als Zeilenrand, Zustand „kompakt/aus­geklappt"
je Zuschauer gemerkt (dasselbe `lsSchreiben`-Muster wie der D7-Schalter, `engine.js:46294`).
Klasse A. Abnahme: Rohdaten-Hash der fünf Bahnen unverändert, Sichtprüfung je Disziplin mit
Blick darauf, dass das Overlay die Strecke nicht verdeckt (bei Takeshi die Burg oben!).

---

### 3.6 Q6 — Anspiel-Szene (Punkte 21, 23 Kickoff-Teil, 24a)

**Befund, der alle drei verbindet:** Der Anpfiff-Countdown (A4, PR #1166) schreibt für das
Feldspiel heute schon das richtige Wort — „Sprungball", „Bully", „Kickoff" (`anpfiffRitualVon()`,
`engine.js:43411–43414`). **Auf dem Feld passiert danach nichts davon.** Die erste Ballbesitz-Seite
kommt aus `naechsterAngriff()` → `spielmacherLos()` (`engine.js:10340–10354`); Football springt über
`beginneFootballSerie()` direkt zum ersten Snap, der Kickoff landet immer auf dem Touchback-Spot
(„kein Rueckgabespiel modelliert", `engine.js:10114`). Chris liest das Wort und sieht keinen
Vorgang — darum „beim basketball steht SPRUNGBALL!".

**Der Baustein:** eine Phase `"anspiel"` im Feldspiel-Chassis vor dem ersten Tick der Spieluhr (und
in Hockey zusätzlich nach jeder Drittelpause), die den Countdown-Text einlöst.

| | Basketball (21) | Hockey (24a) | Football (23) |
|---|---|---|---|
| Wer | Chris: „die 2 größten Spieler oder die 'Centers'". Es gibt keinen Center-Slot (Basketball-Slots `matchday-slot-roles.ts:224–231`), aber ein Feld `height` (`olyDataTypes.ts:673`, geschätzt) | die beiden Center — `bully()` sucht schon heute den nächsten Feldspieler je Seite (`engine.js:9212 ff.`) | Kicker gegen Return-Team |
| Wer gewinnt | **nicht die Größe** — `height` ist kein Matrixattribut; ein Sieg über Größe wäre ein Kanal neben der Matrix (Pp!). Vorschlag: Größe wählt, **wer springt**; ein Basketball-Sub-Skill entscheidet, **wer tippt** | `bully()` ist schon ein Fähigkeitsduell über TECHNIK (`HK_BULLY_K`), heute nur nach Toren in der Mitte (`engine.js:12026`) | Return-Weg aus Rezeptkanälen — Konzept K5 |
| Klasse | B klein (ein zusätzlicher `rr()` je Spiel → RNG verschiebt sich, Messung nötig) | B klein (Aufruf der vorhandenen Funktion am Spielbeginn und nach jeder Pause) | B mittel (neue Zustandsmaschine, nach K5) |
| Bild | Kreis, zwei Springer, Ball hoch, Tipp zur eigenen Seite | Puck fällt, Stockduell, Puck nach hinten | Kick, Flugbahn, Fang, Lauf |

Zu prüfen vor dem Bau: ob `height` überhaupt durch den Kader-Adapter in den Motor kommt
(`lib/foundation/battle-arena/arena-kader-adapter.ts`) — wenn nicht, wählt der Slot mit der
körperlichsten Rolle (Rim Pressure) den Springer.

**Ehrliche Einordnung:** Ein Sprungball je Spiel ist ein Ereignis von hunderten — sein Einfluss auf
rho ist praktisch null, aber nicht bit-identisch (RNG-Kaskade). Darum B, Messung kaderfest, und
nicht A. Die Alternative „Animation zeigt den Sieger, den das Los ohnehin bestimmt hat" wäre A,
würde aber einen Sprungball zeigen, den nicht der Bessere gewinnt — das ist genau die Art
Kulissen-Ehrlichkeit, die das Projekt vermeidet.

---

### 3.7 Q7 — Die Kontaktregel (Punkte 8, 16, 19, 28b)

In vier Wünschen sollen sich Gegner erstmals körperlich in die Quere kommen: Climbing „runter
ziehen … aneinander vorbei ziehen … sich wehren", Battlefield „Platz halten", Breaking „Spieler 1
greift an, der andere muss es ertragen", I-Spy „muss er ihn weg schubsen oder warten". Das Projekt
hat dazu drei teuer gelernte Lehren:

1. **Takeshis `tackleNerven`:** fremder Kontakt, der einen Lauf zerstört, kostete Saison-rho
   0,937 → 0,902 (`climbing-opus-gegencheck-24-09.md` Frage 2).
2. **„Kein Zug wird durch fremde Hand vernichtet"** (Projektregel, ebenda): Kontakt darf Zeit,
   Balance, Position kosten — nie ein erreichtes Ergebnis.
3. **Breakings Peiniger (B2):** Kontakt bekommt einen Deckel (±20 %), damit der Ertragende sein
   Ergebnis überwiegend selbst erzeugt.

**Die gemeinsame Regel, die ich für alle vier vorschlage:**

- **Kontakt kostet, er nimmt nicht.** Zeit, Balance, Position, Haltepunkte — nie Höhe, Treffer,
  Punkte, die schon stehen.
- **Kontaktstärke aus den schweren Matrixattributen der Disziplin**, nicht aus einem generischen
  Kraftwert. Sonst verschiebt sich Pp (Climbing hat gezeigt, wie schnell ein neunter Kanal sich
  selbst auffrisst, `engine.js` bei `mengeAusEignung`).
- **Der Angegriffene hat immer eine eigene Antwort** (Wehren, Ausweichen, Festhalten) aus seinen
  eigenen Attributen — das ist zugleich der Nebenweg im Sinne von „mehrere Wege".
- **Immer als gemessener Schalter**, mit Spiegeltest (Heim:Gast nahe 50:50), weil Kontakt die
  erste Stelle ist, an der Seitenasymmetrien entstehen.

**Climbing (8) konkret** — der kleinste der vier, weil alles vorgedacht ist: der Störgriff G-1 aus
`climbing-neukonzept-22-09.md` kommt zurück, mit der Pflichtregel aus dem Gegencheck („nur Balance,
nie Sturz"). Chris' Bild „herunterziehen" lässt sich trotzdem zeigen: **das Abrutschen A-2 mit
Höchstmarke existiert** — wer gezogen wird, rutscht sichtbar ab, seine gewertete Höhe bleibt die
Höchstmarke. Das Bild ist „runtergezogen", die Wertung ist „kein Zug vernichtet". Dazu zwei neue
Stücke, die das alte Konzept nicht hatte: **enger zusammen** (gemeinsame Wand mit Kreuzungsgriffen
statt zweier gespiegelter Routen) und **Wehren** (der Gezogene hält über die eigene Balance/NERVEN
dagegen — gelingt es, verliert der Ziehende Zeit). Das ist K3, eine kleine Konzeptrunde, kein
Neubau. Zuvor Entscheidung E4: Chris weiß, dass er damit sein eigenes Veto vom 24.09. umdreht und
dass IFSC Kontakt verbietet — er will es trotzdem (Arena-Klettern statt Wettkampfklettern)?

Battlefield (16), Breaking (19) und I-Spy (28b) stehen in K6, K4 und K7.

---

### 3.8 Q8 — Zustand am Charakter: Kopf-Ikonen und Verfall (Punkte 19, 28a, hilft 10)

Chris zu I-Spy: „mit ner Lupe überm kopf … wie so sprechblasen verschiedene Icons … um zu sehen was
der Spieler gerade denkt und tun will"; zu Breaking: „Kann man das optisch irgendwie an den
Charakteren zeigen? sowas wie Erschöpfung, Blut oder so?".

**Ein gemeinsamer Zeichenbaustein für alle Canvas-Chassis:** eine kleine Sprechblase über dem Kopf,
gespeist aus einem Zustand, den die Disziplin ohnehin führt — nie aus einem zukünftigen Ergebnis.

| Ikone | Bedeutung | Disziplinen |
|---|---|---|
| 🔍 Lupe | sucht / analysiert | I-Spy (sucht), Takeshi (liest Hindernis) |
| ⚙ Zahnrad | knackt / rechnet | I-Spy (Schloss), Schach (Bedenkzeit) |
| ➜ Pfeil auf Ziel | will dorthin | I-Spy, Battlefield (Punkt), Arena |
| ✋ Hand | will schubsen / ziehen | I-Spy, Climbing |
| 🛡 Schild | wehrt sich / hält | Climbing, Battlefield, Breaking (erträgt) |
| 💧 Tropfen | erschöpft | alle mit Puste/AUSDAUER |
| … | wartet | I-Spy (Fundort besetzt), Staffel |

**Verfall am Körper (Breaking):** drei Stufen aus dem HP-Stand (unter 70 %, unter 40 %, unter
15 %): Schweiß, dann Prellungen/Risse an der Kleidung, dann stilisiertes Pixel-Blut und
eingesackte Haltung. Die Stufen liegen im Motor schon nahe — unter 30 % HP zieht sich heute die
Vignette zusammen (`engine.js:28566`). Klasse A. **Grenze:** stilisiert, pixelig, kein Gore — die
Szene soll „wird er brechen?" erzählen, nicht schocken. Wenn Chris es drastischer will, ist das
seine Entscheidung, nicht meine Voreinstellung.

---

### 3.9 Q9 — Feldspiel-Realismus-Sonde (Punkte 22, 23, 24b)

Drei Beobachtungen, ein Muster: Basketball „zu wenig mal tempo raus genommen, gepasst, in den raum
gelaufen … alle laufen immernoch auf einem haufen"; Hockey „wird wahrscheinlich mehr gepasst als es
das bei uns wird - bitte prüfen"; Football „es geht gar nicht richtig voran … da muss auch mal
geworfen werden".

**Erst messen, dann bauen.** Eine gemeinsame Sonde für das Feldspiel-Chassis, nach dem Muster von
`feldspielProbe()`, die je Spiel ausgibt:

- Pässe je Ballbesitz, Ballbesitz-Dauer und ihre Streuung (Tempowechsel),
- mittlerer Abstand jedes Spielers zum nächsten Mitspieler und Anteil der Zeit, in der drei oder
  mehr Spieler einer Seite in einem kleinen Radius stehen („Klumpen-Quote"),
- Football: Anteil Pass-/Laufspielzüge, Würfe je Serie, Raumgewinn je Snap, Punts/Field Goals je
  Spiel (beides **existiert** im Motor: `resolveFieldgoal()` `engine.js:9624`, Punt-Konstanten).

Daneben dieselben Kennzahlen aus echten NBA-/NHL-/NFL-Tracking-Quellen — **frisch recherchiert,
nicht aus dem Gedächtnis**. Erst der Abstand zwischen beiden Spalten sagt, ob ein Mechanikumbau
nötig ist oder ob vor allem das **Bild** lügt. Für Football ist das wahrscheinlich: Punts und Field
Goals gibt es, Chris hat sie nicht erkannt („goalkicks - die kenne ich die regeln nicht!") —
das ist zuerst ein Lesbarkeitsbefund.

**Warum Vorsicht:** Bewegung im Feldspiel zieht Würfe. Jede Änderung an Positions- oder
Passentscheidung ist eine RNG-Kaskade — genau das Muster, an dem Zoneneintritt und Puste-Wirkung
in Hockey gescheitert sind (`fable-ideen-feldspiel-30-09.md`, Leitplanken). Basketball liegt bei
0,769 (knapp), Football bei 0,818 (dünner Puffer). Darum K5 als Konzept- und Messrunde, nicht als
Bauauftrag.

---

## 4. Einzelpunkte ohne Baustein — kurz

### 4.1 Staffel-Paket (11, 12, 13) — ein PR

- **11 „Bein" → „Abschnitt":** nur sichtbare Texte, keine Bezeichner (`u.bein` bleibt). Fundstellen
  im Motor: Ticker „Bein n: …" (`engine.js:33766`), HUD „Bein x/y · Runde" (`:34178`),
  Tabellenkopf `kopf:"Bein"` (`:37971` — der `titel` daneben heißt schon „Abschnitt"), dazu
  „Bein-Duell-Banner" und „Beingrenzen" im Verlaufsgraphen. Vorher einmal
  `grep -n "Bein" engine.js` auf Anzeige-Strings filtern (157 Treffer, die meisten Kommentare).
- **12 Gesamtzeit** und **13 Farbe** wie in 3.4.
- Klasse A/A\*, rho bit-identisch. Ein halber Tag.

### 4.2 Time-Trial (5a, 5b)

- **5a Einzelzeitfahren.** Heute starten die Fahrer gestaffelt im Abstand von 0,8 s
  (`(idx·2+seite)·0,8 s`, Time-Trial-Nachtkonzept Abschnitt 0, Punkt 1) — nach wenigen Sekunden ist die halbe
  Strecke voll. Echtes Zeitfahren heißt: **höchstens ein bis zwei Fahrer gleichzeitig im Bild**.
  Bei voller Fahrzeit wäre das viel zu lang; die Lösung ist eine Raffung zwischen den Messpunkten:
  `Sendezeit ≈ ((n−1)·Startabstand + Fahrzeit) / Raffung`. Mit n = 12, Startabstand = halbe Fahrzeit
  und Raffung 5 landet man grob bei 100–120 s. Echtzeit nur an Z1/Z2/Z3 und im Ziel. **Klasse T**
  (Chris hat es bestellt). **Vor dem Bau prüfen:** ob der Time-Trial-Zweig Windschatten/Vordermann
  liest — laut Time-Trial-Nachtkonzept 3.2 ist die Wertung ohne Interaktion und ohne `rr()` im
  Rennen, dann ändert ein größerer Startabstand keine Zeit. Liest er doch etwas vom Vordermann, ist
  5a Klasse B.
- **Startfolge (E5).** Mit Einzelstarts und der heutigen Slot-Startfolge fährt der Stärkste meist
  zuerst — der Hot Seat wechselt im Median **null** Mal (gemessen, Time-Trial-Nachtkonzept Abschnitt 0, Punkt 1).
  Ein echtes Zeitfahren ohne „der Favorit fährt zuletzt" wird nach dem ersten Zieleinlauf noch
  langweiliger als heute. Chris hat J1 am 04.10. abgelehnt („So lassen"); die Frage gehört ihm, aber
  sie muss mit 5a einmal neu gestellt werden.
- **5b Höhenprofil + Fahrrad.** Die Geländezonen existieren in der Simulation (der Ticker sagt „der
  Berg kostet" / „die Abfahrt bringt es"), das Bild ist flach. Ein Seitenprofil der Strecke als
  Band über der Karte (Höhenlinie aus den Zonen) ist Klasse A. Das Fahrrad ist Asset-Arbeit
  (`docs/design/zeitfahren-movement-assets-16-09.md` als Ausgangspunkt): Sprite mit Tretzyklus,
  Haltung je Zone (Wiegetritt bergauf, Aero bergab). Klasse A, Aufwand durch die Asset-Suche.

### 4.3 Climbing 2D (7)

Entschieden (Chris 13.10.: „climbing -> 2d"). Den „leicht angehauchten 3D-Effekt" zurücknehmen —
vermutlich Perspektiv-Skalierung/Neigung in der Wandkamera seit den Broadcast-Phasen 4/5. Klasse A,
Quick Win. Gleich mitprüfen, ob die Kamerafahrt nach oben selbst Übelkeit erzeugen kann (zu schnelle
vertikale Bewegung) — Chris' Wort war „da könnte einem beim Zuschauen schlecht werden".

### 4.4 Takeshi-Performance (9)

Erst messen. Der Breaking-Befund vom 01.10. hat gezeigt, dass ein „Einbruch" auch ein Artefakt der
Messung sein kann (`breaking-performance-einbruch-befund-01-10.md`: kein O(n²) in der Spiellogik,
sondern die Rückkopplung zwischen `requestAnimationFrame` und CDP-Rundreisen). Chris' Beobachtung
ist aber **Zuschauen im Browser**, nicht eine Sonde. Diagnose in dieser Reihenfolge: Chrome-
Performance-Profil bei 1× und 4×; Zeichenzeit je Frame aufgeteilt nach Boden, Figuren, HUD, Ticker;
Wachstum der Ticker-DOM-Knoten über das Spiel; Anzahl `sfx()`-Aufrufe je Sekunde. **Synergie mit
K2:** wenn Takeshi weniger Figuren in voller Größe zeichnet (s. 5.2), sinkt auch die Zeichenlast.
Diagnose-PR ohne Verhaltensänderung, danach entscheiden.

### 4.5 Formkarten (29, 30)

- **29 ist kein Bug** — Jitter ±4 auf den flachen Kartenwert, bewusst nicht nullsummig
  (`lib/lineups/legacy-lineup-modifiers.ts:872–941`). E9: Ist Chris die Spanne zu groß? Dann ist
  `jitterMax` (Standard 4) der Regler, etwa 2.
- **30 ist eine Designentscheidung** (E10) mit Messpflicht: soll eine Formkarte in Feldspiel, Bühne,
  Zeitfahren und Climbing **eignungsproportional** wirken wie in Arena/Staffel/Takeshi, oder bleibt
  der heutige Weg über `mitAufschlag()`/`betroffeneAttribute()`? Erst die isolierte Messung (+4 auf
  einen Spieler, `messe-arena-einfluss.mjs` je Chassis) zeigt, wie weit die beiden Wege überhaupt
  auseinanderliegen. Wenn kaum: nichts tun. Wenn deutlich: Chris entscheidet, dann Rezeptrunde.

---

## 5. Die Konzeptrunden — was jede klären muss, bevor gebaut wird

Jede Runde ist ein eigenes Papier im Stil der Nachtkonzepte (Recherche, Sonde an einer
Motorkopie, Messung kaderfest, Klassen, Fragen an Chris). Größe: **klein** ≈ ein Abend,
**mittel** ≈ eine Nacht, **groß** ≈ mehrere Runden.

### 5.1 K1 — Wettessen: in diesem Papier geliefert (Abschnitt 6)

### 5.2 K2 — Takeshi's Castle: das Gewimmel lesbar machen (mittel)

**Chris:** „bisher wirkt es sehr unübersichtlich mit den ganzen Teilnehmern aber da hab ich gerade
keine Idee wie man es besser machen könnte, nacheinander ist auch doof". Er hat keine Lösung —
also drei Wege, die die Runde prototypisch gegeneinanderstellen soll:

- **T-Ü1 Hauptdarsteller.** Zwölf Läufer sind im Bild, aber nur **drei bis vier in voller Größe
  mit Namen**: der Führende, der eigene beste (Manager-Team), wer gerade an einer Falle hängt, wer
  die Burg erreicht. Alle anderen als kleinere, entsättigte Figuren in Teamfarbe. Die Regie wechselt
  die Hauptdarsteller mit Mindestverweildauer (Muster: J2-Regie bei Time-Trial, 4 s).
- **T-Ü2 Hindernis-Kamera (Wipeout-Schnitt).** Die Kamera parkt an dem Hindernis, an dem gerade
  am meisten passiert, und zeigt alle, die es passieren; dazu eine Stationstafel „Die Mauern:
  7 von 12 durch · 3 im Schlamm". Nicht „nacheinander antreten", sondern „nacheinander schneiden" —
  so erzählt das echte Fernsehformat.
- **T-Ü3 Streckenband.** Ein schmales Band über dem Bild (Q5), die Strecke als Linie mit den
  Fallen-Piktogrammen, jeder Läufer als Punkt in Teamfarbe — die Gesamtlage auf einen Blick, das
  Hauptbild darf dann ein Ausschnitt sein.

**Meine Empfehlung:** T-Ü3 als Rückgrat (es löst das „wer liegt wo" vollständig), T-Ü1 für das
Hauptbild (es löst das „auf wen schaue ich"), T-Ü2 nur als Stationstafel im Ticker-Ersatz.
Alles Klasse A/A\*. **Muss klären:** ob der Burg-Endstand bei Ausschnittkamera noch lesbar bleibt;
Abnahme über Sichtprüfung mit drei Kaderpaarungen und eine einfache Zahl — wie viele Namensschilder
überlappen sich im Mittel je Frame (heute vs. nachher).

### 5.3 K3 — Climbing-Kontakt (klein)

Ausgangslage, Regel und Bild in 3.7. **Muss klären:** Geometrie der gemeinsamen Wand (wie viele
Kreuzungsgriffe, wo), Formel fürs Ziehen (Balance-Verlust aus den Climbing-schweren Attributen des
Ziehenden gegen Balance/NERVEN des Gezogenen), Formel fürs Wehren, Zeitkosten beider Seiten. Mess-
plan: rho kaderfest (Climbing 0,814, dünner Puffer!), Pp n=48 zwei Stämme, Spiegeltest, Häufigkeit
der Zieh-Ereignisse je Rennen (Ziel: sichtbar, aber selten — zwei bis vier je Rennen). Abbruchregel:
fällt rho unter 0,80, kommt die Mechanik nur als Bild (Ticker „versucht vorbeizuziehen" aus dem
heutigen Duelldruck G-2).

### 5.4 K4 — Breaking: Phasen, Peiniger, Verfall (mittel)

**Chris:** „dass Spieler 1 quasi erst 'angreift' und der andere es ertragen muss für zb 15 Sekunden
und dann der Wechsel kommt und da muss man auch sehen können welcher Spieler eher offensiv stark
ist wie Assassinen und wer defensiv gut einstecken kann".

Heute wechseln die Rollen nach **jedem** Zug (`gauntletRunde()`), und je Zug würfelt nur der
Ertragende — der Peiniger ist mechanisch nicht vorhanden (Fable 30.09., Befund 1).

- **Phasen statt Ping-Pong (B).** Der Ertragende erträgt **mehrere Züge am Stück**, dann wechselt
  es. Weil heute jeder Kämpfer nur seine eigenen Würfe macht, bleibt jede HP-Kurve unverändert —
  aber **wer zuerst bricht**, kann sich verschieben, wenn beide im selben Phasenblock brechen
  würden. Das ist eine Regeländerung, klein, mit Messpflicht (Breaking steht bei 0,801/0,944,
  `breaking-broadcast-paket-plan-07-10.md` — dünner Puffer). „15 Sekunden" ist Chris' Bild für die
  Länge einer Phase im Bild; bei `rundenDauer` 0,35 s wären das über 40 Züge, mehr als ein ganzer
  Bout. Die Runde muss deshalb Phasenlänge in Zügen **und** Darstellungstempo gemeinsam festlegen
  (drei bis fünf Züge je Phase, je Zug eine längere Animation → T, Chris' Zustimmung liegt mit dem
  Wunsch vor).
- **Der Peiniger wirkt (B2 aus dem Fable-Papier 30.09., gedeckelt ±20 %).** Erst damit ist „offensiv
  stark wie Assassinen" eine Eigenschaft und nicht nur ein Bild. Offensiv-/Defensivprofil je Kämpfer
  aus seinen Rezeptkanälen, in der Matchup-Karte (Q1) als zwei Balken „fügt zu / hält aus".
- **Verfall am Körper** (Q8), Klasse A — kann vorgezogen werden.
- **Muss klären:** Phasenlänge, ob B1 (zehn Geräte, drei Familien) in dieselbe Runde gehört
  (es wäre die Stelle, an der „Assassine" einen Gerätetyp bevorzugt), Gauntlet-Folgen (Sieger
  bleibt mit HP-Stand — längere Phasen erhöhen die Streuung des Rest-HP).
- **Recherche-Leitplanke:** Folter-/Survival-Formate (Slap-Fighting mit festen Runden je Seite,
  Kachinuki), **keine Breakdance-Battles** (CLAUDE.md).

### 5.5 K5 — Feldspiel: Football zuerst, dann Basketball/Hockey (groß)

- **Football (23):** Regel-Recherche (Kickoff inkl. der seit 2024 geänderten NFL-Kickoff-Regeln,
  Punt, Field Goal, Extra Point/Two-Point, was ein QB im Snap tut, Pass-Block, Pass-Rush), dann der
  **Sichtbarkeits-Audit**: was davon simuliert der Motor schon (Downs, Formationen, fünf
  Spielzüge, Punts, Field Goals), aber zeigt es nicht lesbar? Erst danach die Mechanikfrage
  (Kickoff-Return als Zustandsmaschine, Opus-Review P4.4; Formatfrage F4 „NFL oder Arena Football"
  aus `fable-ideen-feldspiel-30-09.md` 4 — E7).
- **Basketball (22) und Hockey (24b):** Q9-Sonde, Abstand zu echten Werten, dann gezielte
  Bewegungsregeln (Spacing-Ziele je Rolle, „Anbieten" als Laufweg in freien Raum, Tempo-Wahl nach
  Spielstand — P5 aus dem Basketball-Opus-Review). Gravity B1 ist ein Anfang.
- **Abbruchregel für jeden Feldspiel-Eingriff:** fällt rho unter die heutige Basislinie oder
  wandert Pp über 25 → nur das Bild bekommt die Änderung (Laufwege als Animation über einem
  unveränderten Entscheidungsmodell), nicht die Entscheidung.

### 5.6 K6 — Battlefield: Domination mit drei Punkten (groß)

**Chris:** „3 Orte … das Team was den Platz hält dann jede Sekunde Punkte erhält … So dass man sich
aufteilen muss und starke Spieler ggf. sogar alleine einen Platz halten. Respawn kostet kurz Zeit".

**Was steht:** ein Kontrollpunkt in der Mitte (`ARENA_DOMINATION.battlefield`, `engine.js:6248`:
Radius 230, 6 Punkte/s, 150 zum Sieg, Siege-Core erobert 1,6-fach), sonst Ausschaltungs-Arena
ohne Respawn. rho 0,399, Saison-Validität 0,31 — die Mechanik belohnt heute **nicht das Richtige**.

**Warum Chris' Entwurf die Validität heben könnte (Hypothese, nicht gemessen):** im
Ausschaltungsmodus entscheidet, wer zufällig wen zuerst trifft; in einer Domination mit Respawn
entscheidet **Präsenz** — wer lange steht, hält, erobert. Präsenz ist eine Summe über viele Sekunden
und damit ein ruhigerer Spielerwert als Ausschaltungen. Und Respawn macht aus einem Kampf, der nach
der ersten Welle entschieden ist, ein Spiel über die volle Zeit.

**Muss klären:** Punkt-Geometrie (A/B/C, Abstände für vier gegen vier), Respawn-Dauer und -Ort,
Spielerwert (Haltesekunden, Eroberungen, Verteidigungen, Ausschaltungen — Gewichte so, dass die
Matrix durchkommt: Charisma 20, Intelligence 16, Spirit 16 tragen die Hälfte), **wer verteilt die
Spieler auf die Punkte** (eine Commander-Entscheidung aus Intelligence/Charisma ist der natürliche
Ort für die schweren Matrixattribute — und ein Manager-Hebel M), mehrere Wege (Halter über
spirit/health, Eroberer über torment/power, Rotierer über awareness/intelligence).
**Vorbedingung:** die TMP/AUS-Pp-Reparatur am Arena-Chassis (Stand-Tabelle 5b, Battlefield-Zeile) —
ohne sie wird jede Battlefield-Messung von den alten Kanalfehlern überlagert. Battlefield ist nicht
live (`ARENA_RESOLVED_DISCIPLINE_IDS`), der Umbau kann also hinter einem Schalter ohne
Produktionsrisiko laufen.

### 5.7 K7 — I-Spy: ein Raum, exklusive Fundorte, sichtbare Absichten (groß)

Fünf Teile aus Chris' Wunsch, zwei davon sofort machbar:

- **28a Sprechblasen-Ikonen** (Q8) und **28c/d Hinweisstärke + benötigter Main-Skill über jedem
  Fundort**: Klasse A. Die Werte sind Referenzdaten (`BUEHNE_ART["i-spy"].fundorte`, zwölf
  Fundorte), kein Spoiler über Ausgänge — der Zuschauer weiß, was in der Truhe liegt und welches
  Schloss sie hat, nicht, wer sie knackt. Das ist die „Dramatische Ironie", die Chris will
  („mitfiebern … welche vllt ein dickes Schloss haben aber wenig bringen").
- **28e offener Raum** und **28b exklusive Fundorte mit Schubsen/Warten**: Klasse B/C, der Kern
  der Runde. Heute trennt der Split-Screen (I1, 27.09., `engine.js:23200 ff.`) die Teams in zwei
  Räume — Chris' Ursprungsbild vom 21.09. war ein gemeinsamer Raum mit Gegnern, die auf Funde
  reagieren (`i-spy-schatzsuche-konzept-21-09.md`, Zitat oben). Ein gemeinsamer Raum macht die
  Ergebnisse voneinander abhängig — I-Spy steht aber schon bei 0,756, und P1 sowie I-2k sind
  gemessen gescheitert.

**Die Kernfrage der Runde:** Lässt sich die Lehre aus dem Bühnen-Duell-Papier übertragen —
**Leistungsschicht solo, Ergebnisschicht interaktiv**? Jeder Spieler würfelt seine Such- und
Knackleistung wie heute für sich (`u.summe` bleibt der Messwert), aber **wer eine Truhe zuerst
bekommt**, entscheidet der gemeinsame Raum (Weg, Besetzung, Schubsen). Wenn ja, ist der offene Raum
rho-schonend. Wenn nein, muss die Runde ehrlich sagen, dass der offene Raum I-Spy weiter von 0,80
entfernt. **Muss klären:** Raumgeometrie (zwölf Fundorte, ein Raum, kurze Wege), Besetzungsregel,
Schubsen nach Q7 (kostet Zeit, nimmt keinen Fund), Warteschlange am Fundort, Bildsprache.

### 5.8 K8 — Tennis: der Ballwechsel als Bild (mittel)

**Chris:** „die bälle sollen nicht immer in die mitte fliegen, verschiedene schläge … auch mal ins
aus, spieler in bewegung, mal erreichen sie den ball mal nicht … optisch auch noch einige bugs".

Das meiste ist **Bild über einem feststehenden Ausgang**: T-F1a (PR #1135) bestimmt je Ballwechsel
einen Punktgewinner. Ob der Punkt durch Ass, Winner, Netzfehler, Aus oder unerreichten Ball endet,
lässt sich aus Werten ableiten, die der Rundeneintrag schon trägt (Höhe der Punkte, `knapp`,
Aufschlag), ohne neuen Wurf — Klasse A\*. Schlagarten (Aufschlag, Grundlinie, Slice, Volley, Lob,
Stopp) als Animationsvarianten, Zielpunkt auf dem Platz aus dem Ausgang rückwärts konstruiert (ein
Winner geht in die Ecke, ein Fehler ins Aus). **Muss klären:** Sendezeit (s. 3.1.4, ~90 s, T),
Bug-Liste — Chris nennt „einige bugs", ohne sie zu zeigen: vor der Runde einmal nachfragen oder
per Screenshot-Durchlauf (`scripts/screenshot-disziplin.mjs tennis`) selbst sammeln.

---

## 6. Wettessen — das Konzept, das Chris bestellt hat

**Chris:** „Beim Wettessen müsste optisch eindeutig mehr passieren, das benötigt ein Rework.
Momentan fliegen unten die Zahlen einfach nur so rein und es hat kein Konzept und keine Übersicht wer
gerade führt etc. Bitte noch mal mit Fable ein Konzept erarbeiten!"

### 6.1 Was da ist — und was davon niemand sieht

- **Mechanik (live):** Mauer als Füllstand (K1) und Haltung Sprint/Gleichmäßig/Schlussspurt (K2),
  `BUEHNE_FLAGS.wettessenMauer:2` (`engine.js:16143`). Die Kurve je Minute hat damit einen Knick
  (73 72 73 72 69 61 56 59 58 63, Stand-Dokument Abschnitt 9) — die Mauer um Minute 6.
- **Bild:** Bankett-Halle, karierte Tafel, Latz-Servietten, Tellerstapel je Esser, Magen-Meter mit
  Gabel-Marker des Führenden am unteren Rand (`wettessen-tafel-17-09.md`, D2.a), Wendetafeln,
  10:00-Uhr, Kopf-an-Kopf-Band, Menü des Spieltags (W-F2).
- **Das Problem:** Die Mechanik erzählt jetzt eine Geschichte (Sprinter treffen die Mauer früher,
  Willensstarke essen durch sie hindurch) — das Bild erzählt sie nicht. Zahlen erscheinen
  minütlich am unteren Rand, eine Rangfolge gibt es nur implizit, die Mauer ist unsichtbar, die
  Haltung auch. **Das Rework ist deshalb vor allem: die vorhandene Mechanik sichtbar machen.**

### 6.2 Das Leitbild: Nathan's auf ESPN

Das echte Vorbild (Coney Island, 4. Juli) erzählt mit vier Mitteln: **Zähltafeln hinter jedem
Esser**, die ein Helfer minütlich hochhält; **eine Rangliste im Fernsehbild**, die sich bewegt;
**der Rekord-/Tempo-Vergleich** („auf Kurs für …"); und **der Moment, in dem einer einbricht**
(Chestnut 2021: „started to slow down in the sixth minute", Wettessen-Nachtkonzept 2.1). Nichts
davon braucht eine neue Regel.

### 6.3 Die Bausteine

| # | Baustein | Was man sieht | liest | Klasse | Aufwand |
|---|---|---|---|---|---|
| W-V1 | **Rangliste als Turm** | rechts im Bild eine senkrechte Liste aller zwölf, sortiert nach Bissen, Teamfarbe als Balken, Pfeil ↑/↓ bei Platzwechsel, die Top 3 groß; oben die Teamsumme „Teller-Stand 41 : 37" | `u.summe` nach jeder Minute | A | klein |
| W-V2 | **Die Zahl gehört zum Esser** | statt Zahlen, die unten einfliegen, klappt minütlich eine **Zähltafel über jedem Esser** hoch („+7 · 31") — alle zwölf im selben Takt, wie der Helfer mit dem Schild; der Ticker unten nennt nur noch Ereignisse | `runden[m].punkte` | A | klein |
| W-V3 | **Der Bauch** | je Esser ein Füllstand am Körper (Bauchsilhouette füllt sich), bei Erreichen der Mauer: roter Puls, Schweißtropfen (Q8), Kaugeschwindigkeit sinkt sichtbar, Banner „X TRIFFT DIE MAUER" | K1-Füllstand gegen `K` | A\* (liest den Füllstand, schreibt nichts) | mittel |
| W-V4 | **Die Haltung am Platz** | kleines Schild vor jedem Teller: SPRINT / GLEICHMÄSSIG / SCHLUSSSPURT; bei Schlussspurt ab Minute 9 leuchtet es auf | K2-Haltung | A | klein |
| W-V5 | **Das Duell über den Tisch** | Heim i sitzt Gast i gegenüber (die Tafel ist schon zweireihig); zwischen jedem Paar ein kleiner Tauzieh-Strich, wer im direkten Duell vorn liegt | `u.summe` beider | A\* | klein |
| W-V6 | **Hochrechnung** | „auf Kurs für 58" je Esser in der Rangliste, ab Minute 3 — **nur aus bereits gezeigten Minuten** linear hochgerechnet, nie aus der Zukunft | gezeigte Minuten | A\* | klein |
| W-V7 | **Regie auf die Geschichte** | Kamera-Nahaufnahme (Cut-to B2 aus dem Broadcast-Papier) bei Führungswechsel, Mauer-Treffer, Schlussspurt-Überholung | dieselben Ereignisse | A | klein |
| W-V8 | **Die Zählung und der Gürtel** | nach Minute 10: Jury zählt nach (die Tafeln drehen sich ein letztes Mal, langsam, in Reihenfolge der Rangliste von unten nach oben), der Beste bekommt den Gürtel umgelegt | Endstand | A (T, falls länger als heute) | klein |

**Was nicht gemacht wird:** keine Gleichzeitigkeit auflösen (Abschnitt 3.1.7 — die Gleichzeitigkeit
ist der Sport), keine zweite Wertung, keine Sendezeit-Verlängerung im Wettkampf selbst (die zehn
Minuten bleiben 60 s, wie im Nachtkonzept festgelegt). Tunken (K3 des Nachtkonzepts) bleibt eine
getrennte Mechanikfrage — als Bild könnte es mit W-V4 kommen (ein Glas Wasser neben dem Teller,
das der Tunkende benutzt), mechanisch erst nach eigener Messung.

### 6.4 Reihenfolge innerhalb des Wettessen-Pakets

1. **W-V1 + W-V2** zusammen — sie beantworten Chris' zwei wörtliche Klagen („Zahlen fliegen unten
   rein", „keine Übersicht wer führt") vollständig. Ein PR, Klasse A.
2. **W-V3 + W-V4** — machen die Mauer-Mechanik sichtbar, die seit dem 04.10. live ist. Ein PR.
3. **W-V5 – W-V8** als Politur.

**Abnahme:** `miss-alle-disziplinen.mjs 24 wettessen` bit-identisch (alle Bausteine lesen nur);
Sichtprüfung je Minute 1, 6, 10 mit drei Kaderpaarungen; die eine Zahl, die Chris' Klage misst:
**ist in jedem Frame ablesbar, wer führt?** (W-V1 macht das per Konstruktion wahr).

---

## 7. Abhängigkeiten auf einen Blick

    E1 (welche Bühne) ──► Q4 PP-Spalte, Q2 Erfassungsort
    E2 (Sendezeit)    ──► Q1 Karte als Pause?, 5a Einzelzeitfahren, K8 Tennis
    Q3 Simulieren     ──► macht E2 zumutbar ──► Q1, 5a, K8
    Q2 Laufbahn       ──► Laufbahn-Zeile der Matchup-Karte (Q1)
    Q5 Bahn-Overlay   ──► K2 Streckenband (T-Ü3), Staffel-Spalten (12)
    Q8 Kopf-Ikonen    ──► K4 Verfall, K7 Sprechblasen, K2 Hauptdarsteller
    Q7 Kontaktregel   ──► K3, K4, K6, K7
    Q9 Sonde          ──► K5 (Basketball, Hockey, Football)
    TMP/AUS-Pp-Fix    ──► K6 Battlefield
    E4 (Climbing-Veto)──► K3

---

## 8. Reihenfolge — die Pakete

| Paket | Inhalt (Punkte) | Klasse | Größe | Voraussetzung | parallel zu |
|---:|---|---|---|---|---|
| **0** | **Klärung mit Chris:** E1–E10 (Abschnitt 9), eine Sitzung, keine Arbeit am Code | — | eine Nachricht | — | — |
| **1** | **Kleinkram, sichtbar ab dem nächsten Zuschauen:** Staffel-Paket 11/12/13 · Climbing 2D (7) · Bahn-Overlay-Tafel (6, Q5) · Takeshi-Performance-Diagnose (9, ohne Verhaltensänderung) | A/A\* | je ½–1 Tag | — | alle vier untereinander |
| **2** | **Sendungsrahmen:** Simulieren-Knopf (3, Q3) zuerst, dann Matchup-Folge (Q1) mit Karte für Schach (26) → Fechten (15) → Tennis (25a) → Showcase (17) → Eiskunstlauf (18a/b, mit Bündelung) | T + A | 2–3 Tage | E2 | Paket 3 |
| **3** | **Laufbahn:** Erfassung im Result-Apply (Q2, Klasse S) zuerst, dann Profil-Panel, Drawer, Karten-Zeile · PP-Spalte im Endstand (1) | S + A/A\* | 3–4 Tage | E1 | Paket 2 |
| **4** | **Bild-Pakete ohne Mechanik:** Wettessen W-V1–W-V4 (20) · Anspiel-Szenen Basketball/Hockey (21, 24a, Q6) · Time-Trial Einzelzeitfahren + Höhenprofil + Fahrrad (5a/5b) · Breaking-Verfall (19c, Q8) | A/A\*/T, Q6 B klein | je 1–2 Tage | E5 für 5a | untereinander |
| **5** | **Konzeptrunden (nur Papier + Sonde an Motorkopie):** K2 Takeshi · K3 Climbing · K4 Breaking · K5 Feldspiel (Football zuerst) · K8 Tennis · K6 Battlefield · K7 I-Spy | — | klein bis groß | E4, E7 | alle untereinander |
| **6** | **Mechanik- und Wertungsrunden aus Paket 5:** Climbing-Kontakt (8) · Breaking-Phasen + Peiniger (19) · Time-Trial-PP nach Zeit (4, W) · Tennis-Ballwechsel (25b) · Takeshi-Übersicht (10) · Football-Kickoff/Snap (23) · Basketball/Hockey-Bewegung (22, 24b) · Formkarten-Kopplung (30, falls E10 es verlangt) | B/W/C | je mehrere Tage | jeweilige K-Runde | eingeschränkt |
| **7** | **Die zwei großen Umbauten:** Battlefield-Domination (16) · I-Spy offener Raum (28b/e) | B/C | groß | K6 + TMP/AUS-Fix, K7 | — |

**Warum diese Reihenfolge:**

- **Paket 1 vor allem anderen**, weil es Chris am schnellsten zeigt, dass seine Liste ankommt — und
  weil nichts davon eine Entscheidung braucht außer der schon getroffenen (Climbing 2D).
- **Simulieren vor Matchup-Folge**, weil jede ehrliche Sequenz die Sendung verlängert oder
  verdichtet; mit dem Knopf ist beides zumutbar.
- **Laufbahn-Erfassung parallel und früh**, weil sie Daten sammelt, die man später nicht
  nachholen kann. Das Panel kommt danach, die Karte bekommt ihre Historien-Zeile automatisch, sobald
  es Zahlen gibt.
- **Bild vor Mechanik** überall dort, wo Chris' Klage im Kern eine Lesbarkeitsklage ist (Wettessen,
  Takeshi, Tennis, Football): oft stellt sich heraus, dass die Mechanik das Gewünschte schon tut.
- **Battlefield und I-Spy zuletzt**, weil beide die Rangtreue heute verfehlen und beide eine
  Konzeptfrage tragen, die größer ist als der Bau — und weil Battlefield eine Chassis-Reparatur
  vorausgehen muss.

---

## 9. Entscheidungen, die Chris gehören

Jede Frage einmal, mit meiner Empfehlung. Alles andere in diesem Papier läuft ohne Rückfrage.

| # | Frage | Empfehlung |
|---|---|---|
| **E1** | Soll ein Spielstand im **Battle Mode** laufen, damit Arena-Ergebnisse (und PP, Laufbahn-Zähler) im Saisonfluss ankommen — oder bleibt die Arena vorerst Entwurfsreiter? | Ja, einen Spielstand umstellen. Sonst sieht Chris viele gebaute Pakete (O2, O7, Säule, Uhr, Mauer) nie in seiner Saison. |
| **E2** | Sendezeit: Matchup-Karte als **Overlay** (60 s bleiben) oder als **Pause** (+12–15 s)? Tennis ~90 s, Time-Trial ~100–120 s? | Overlay; Tennis und Time-Trial länger, weil der Simulieren-Knopf kommt. |
| **E3** | Fechten: Mannschaftsstand als **kumulierte Staffel** (real olympisch) oder weiter „Bahnen gewonnen"? | Staffel — mit der Matchup-Folge wird sie erstmals lesbar. W, Messung der Teamwertung. |
| **E4** | Climbing: Kontakt trotz eigenem Veto vom 24.09. und IFSC-Verbot? „Herunterziehen" als Abrutschen mit Höchstmarke (kein Zug vernichtet) einverstanden? | Ja, mit „nur Balance/Zeit, nie Sturz". Arena-Klettern statt Wettkampfklettern ist eine legitime Entscheidung. |
| **E5** | Time-Trial mit Einzelstarts: Startfolge **umkehren** (Favorit zuletzt, J1) — trotz „So lassen" vom 04.10.? | Ja. Ohne J1 ist ein echtes Einzelzeitfahren nach dem ersten Zieleinlauf entschieden (Hot-Seat-Wechsel Median 0). |
| **E6** | Showcase: Casting-Montage (S-F1) streichen zugunsten der Matchup-Folge? | Ja — Chris' Satz vom 13.10. ist die jüngere Entscheidung. |
| **E7** | Football: NFL-Modell bleibt (Fable F4)? | Ja, NFL. Punts/Field Goals existieren schon; sie müssen sichtbar werden. |
| **E8** | Breaking: wie drastisch darf der Verfall aussehen (stilisiert vs. deutlich)? | Stilisiert, Pixel-Blut, kein Gore. **Ueberholt (14.10.):** Chris' tatsaechliche Antwort war „stilisiert + gore" — beides zugleich, nicht eins statt des anderen. Stufe 4 (Gore) in `breaking.tsx` ist Folge-PR zu #1207. |
| **E9** | Formkarten-Jitter ±4 zu breit? | Auf ±2 senken, wenn die „+8"-Anzeige stört — reine Einstellung. |
| **E10** | Formkarten eignungsproportional auch in Feldspiel/Bühne/Zeitfahren/Climbing? | Erst messen (isoliertes +4), dann entscheiden. |

---

## 10. Was ich bewusst nicht vorschlage

- **Eiskunstlauf-`rundenN` senken.** Die zwölf tragen die Verlässlichkeit; „weniger, länger" wird
  über die Anzeige gelöst (3.1.5).
- **Wettessen sequentialisieren.** Gleichzeitig ist der Sport; das Problem ist Lesbarkeit.
- **Die Matchup-Folge an die Teamwertung koppeln** (außer Fechten-Staffel als Chris' Frage E3).
  Q1 ist Anzeige und bleibt bit-identisch.
- **Größe als Wertungskanal beim Sprungball.** `height` steht nicht in der Matrix; sie darf
  bestimmen, wer springt, nicht, wer gewinnt.
- **Kontakt, der Ergebnisse vernichtet** — in keiner der vier Kontakt-Disziplinen (Q7).
- **Battlefield vor der TMP/AUS-Reparatur** anfassen — die Messung wäre nicht deutbar.
- **Breakdance-Recherche** für Punkt 19 — Breaking ist Folter (CLAUDE.md).
- **Beispielzahlen im Laufbahn-Panel.** Lieber ein kürzeres Panel als eines, das erfundene Werte
  zeigt.
- **Die Eignungsmatrix** — für keine der zwanzig.

---

## Quellen

Im Repo (gelesen): `CLAUDE.md`; `docs/design/chris-feedback-breite-runde-13-10.md` (Branch
`chris-feedback-breite-runde-13-10`, PR #1173); `docs/design/stand-aller-disziplinen.md`
(Abschnitte 1, 5b, 9, Siebzehnter/Achtzehnter Nachtrag); `fable-ideen-buehne-duell-30-09.md`
(F-F1, T-F1, S-F2); `fable-ideen-buehne-auftritt-30-09.md` (E-F1, S-F1, W-F1–W-F3);
`fable-ideen-heben-breaking-climbing-30-09.md` (1.2, 1.3, B1/B2, 4.3);
`fable-ideen-feldspiel-30-09.md` (Leitplanken, F4); `fable-ideen-broadcast-praesentation-30-09.md`
(Klassen, A2, A4, B2); `fable-ideen-bahn-30-09.md`; `tennis-nachtkonzept-03-10.md` (Klassenschema);
`wettessen-nachtkonzept-03-10.md`; `wettessen-tafel-17-09.md`; `time-trial-nachtkonzept-03-10.md`
(0, 3.2); `climbing-opus-gegencheck-24-09.md` (Fragen 1–2, Abschnitt 6);
`climbing-neukonzept-22-09.md`; `i-spy-schatzsuche-konzept-21-09.md`;
`i-spy-fable-empfehlung-02-10.md`; `breaking-broadcast-paket-plan-07-10.md`;
`breaking-performance-einbruch-befund-01-10.md`.

Code: `public/mockups/battle-mode.engine.js` (`ARENA_DOMINATION` :6248, `bully()` :9212,
`resolveFieldgoal()` :9624, Touchback :10114, `naechsterAngriff()` :10340, Bühnen-Warteschlangen
:16930–17069, `BUEHNE_FLAGS` :16143, `EISKUNSTLAUF_KURZPROGRAMM_N` :16440, Gewichtheben-Warteschlange
:18206, I-Spy-Split-Screen :23200, Staffel-„Bein" :33766/:34178/:37971, `anpfiffRitualVon()`
:43402, `#spd` :46274); `public/mockups/battle-mode.html` (:466 ff., Kampf-Spielerprofil);
`app/foundation/discipline-stage/DisciplineStageArena.tsx` (:117–141, :157);
`app/foundation/discipline-stage/DisciplineStageTopPlayers.tsx` (:135–160);
`app/foundation/battle-arena/FoundationBattleArenaHost.tsx`; `lib/battle/arena-resolved-disciplines.ts`;
`lib/resolve/battle-mode-arena-team-points.ts` (:224–436); `lib/data/olyDataTypes.ts` (:673,
:2843–2900); `lib/lineups/matchday-slot-roles.ts` (:224–231); `lib/foundation/player-season-awards.ts`.

Sport-Referenzen (allgemein bekannt, hier nur zur Einordnung, vor dem Bau zu verifizieren): ISU-
Einzel-Kür mit zwölf Elementen; Nathan's Hot Dog Eating Contest (Zähltafeln, Mustard Belt);
NFL-Kickoff-Regeländerung 2024; IFSC-Kontaktverbot (§5.2 A, laut Climbing-Gegencheck);
Takeshi's-Castle-/Wipeout-Schnitttechnik (Hindernis für Hindernis).
