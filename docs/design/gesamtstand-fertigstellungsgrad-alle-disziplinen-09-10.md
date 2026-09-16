**Dreizehnter Nachtrag 16.09. — Time-Trial und Climbing nachgezogen (PR #948/#943), zwei
gegensaetzliche Bewegungen in derselben Sitzung.** Der zwoelfte Nachtrag (direkt darunter) hatte
Fechten zuletzt auf 91 % gebracht. Seither sind zwei weitere PRs auf `main` gelandet, beide an
je einer Bahn-Disziplin: `docs/design/zeitfahren-movement-assets-16-09.md` (PR #948, reine
Praesentation) und `docs/design/climbing-kalibrierung-16-09.md` (PR #943, Rezeptkalibrierung plus
Produktionsanbindung). `main` steht jetzt bei `ce3ec182`. **rho fuer beide FRISCH gemessen, nicht
aus den PR-Texten uebernommen:**

```
node scripts/miss-alle-disziplinen.mjs 24 climbing time-trial
```
→ Climbing **0,834** (Spannweite 0,209, Saison-rho 0,860), Time-Trial **0,825** (Spannweite 0,082,
Saison-rho 0,825) — beide bit-identisch zu den PR-Texten, keine Ueberraschung.

**Alle sechzehn Teilkriterien fuer BEIDE Disziplinen einzeln gegen den heutigen Code geprueft, nicht
aus den PR-Texten uebernommen** — die volle Herleitung mit Datei:Zeile-Belegen steht bei jeder
Disziplin in Abschnitt 2 (Time-Trial, Climbing). Zusammengefasst:

**Time-Trial — reine Praesentation, Konzept/Gameplay bewusst unangetastet.** PR #948 aendert
ausschliesslich `public/mockups/battle-mode.engine.js` und ruehrt weder `rezept` noch `wert()` noch
die Rennlogik an (im PR-Dokument selbst festgehalten: `gelaendeFaktor()`/`gelaendeZehrFaktor()`
werden nur gelesen). Die neue `bodenZeitfahren()` (`:21320`, eigene Zeichenfunktion exklusiv fuer
`zeitfahren`, ersetzt an der Weiche in `bodenSpurt()` den generischen `bodenSpurtGerade()`-Pfad, den
die anderen vier Bahnen weiterhin nutzen) zeichnet die sieben `gelaende`-Zonen erstmals selbst
(Terrain-Toenung + Huegelsilhouette) und schliesst damit die seit dem 13.09. dokumentierte
Hauptluecke „man sieht keinen Berg". Dieselbe Funktion zaehlt auf **zwei** Achsen zugleich — Assets
fragt nach der eigenen Szene (A2, war seit PR #908 nur auf einer Teilstufe, jetzt voll), Movement
nach der eigenen Zeichenfunktion selbst (M1, stand bisher ausdruecklich bei 0) — genau dieselbe
Zwei-Achsen-Unterscheidung, die der zwoelfte Nachtrag bereits fuer Fechtens `zeichneFechten()`
dokumentiert hat. `u.vizNeigung` (neues Feld in `stepZeitfahren()`) plus die Vorlehnung/Aufrichtung
in `zeichneSpurt()` verstaerken M2 und M4, die beide schon vorher voll erfuellt waren — keine neue
Punktzahl, dasselbe „Qualitaetsreparatur"-Muster wie zuletzt bei Fechtens Degen. A1
(`peloton.tsx`, `app/foundation/discipline-stage/arena/disciplines/peloton.tsx`, 472 Z.) und M3
(Animation ebenda) waren schon vorher voll und von PR #948 nicht beruehrt — bestaetigt per `git
log`, kein Commit von PR #948 in dieser Datei. A3 (keine neue Requisite, im PR-Dokument selbst als
bewusst ausgelassen benannt) und A4 (kein neuer Ton) bleiben offen. **Assets 50→55, Movement
65→100, Konzept bleibt 95, Gameplay bleibt 92 (rho bit-identisch in derselben 0,80–0,85-Stufe).
Gesamt: 76 %→86 %** (rechnerisch 85,5 %).

**Climbing — Gameplay-Sprung durch Kalibrierung plus Produktionsanschluss, Konzept bewusst
unangetastet.** PR #943 ist die erste eigene Modellierungs-/Kalibrierrunde, die Climbing je hatte
(die einzige der fuenf Bahn-Disziplinen ohne eine solche, s. PR-Dokument). Einziger Eingriff im
Rezept: `BAHN_ART.climbing.rezept.STEHEN` (`:21868`) nimmt WILL/HEALTH statt eines Teils von
Stamina/Determination auf, gefunden ueber `sondiere-feldspiel-subskills.mjs`/
`messe-arena-einfluss.mjs` (ROBUST als mechanisch toter Sub-Skill identifiziert, s. Fundstelle im
PR-Dokument). Das hebt rho 0,782→**0,834** und damit G1 von der 0,70–0,80-Stufe (22 Punkte) auf die
0,80–0,85-Stufe (35 Punkte) — **+13**. Gleichzeitig wurde Climbing produktionsangeschlossen:
`"climbing"` steht jetzt in `ARENA_RESOLVED_DISCIPLINE_IDS`
(`lib/resolve/battle-mode-arena-team-points.ts:328`) und `ARENA_BAHN_DISCIPLINE_IDS`
(`lib/battle/arena-headless-runner.ts:203`), eigene PPS-Referenz gezogen — **G2 0→30**. Climbing
ist damit die **15. arena-resolved Disziplin** (nachgezaehlt: die Menge fuehrt heute fuenfzehn
Eintraege, s. Abschnitt 4.3 fuer den Stand vor dieser Runde), **Arena-Spalte nein→ja**. G3/G4
unveraendert (eigener `wertung:"rang"`-Modus, Bahn-Chassis 12/15). **Gameplay: 49→92.**

**Konzept bleibt bei 65, ausdruecklich geprueft und NICHT bewegt — dieselbe strenge Lesart wie bei
Fechten im zwoelften Nachtrag.** K4 (kalibriert, Designfragen entschieden) bleibt offen: der neue
Puffer zur 0,80-Schranke (0,834−0,80=0,034) ist **kleiner als das gemessene Kaderrauschen**
(Spannweite 0,209) — vom PR-Dokument selbst so benannt ("ein vertretbarer Puffer... auch wenn er
duenner ist als z. B. Zeitfahrens"), und derselbe Text nennt eine weitere Verschaerfung ausdruecklich
als offenen naechsten Schritt fuer eine Folgerunde. K3 wurde ebenfalls gezielt gegengeprueft: das
neue `climbing-kalibrierung-16-09.md` ist zwar das erste climbing-EIGENE (nicht geteilte) Dokument,
modelliert die Disziplin aber nicht „von Grund auf" (Griffe/Wandsteilheit/Stationsfolge bleiben in
der geteilten `bahn-disziplinen-recherche-fable.md`), sondern kalibriert gezielt einen einzelnen
Sub-Skill — dieselbe Kategorie Dokument, die Fechtens K3 im zwoelften Nachtrag ausdruecklich NICHT
bewegt hat. K1/K2 unveraendert. **Assets und Movement bleiben ebenfalls unangetastet** (40 bzw.
65) — PR #943 aendert ausschliesslich Rezept-Gewichte und Produktions-/Referenzdateien, keine
Zeichen-, Ton- oder Bewegungszeile; `mountain.tsx` ist unberuehrt. **Gesamt: 55 %→66 %**
(rechnerisch 65,5 %).

**Keine weitere Zusammenfassungszahl im Dokument musste wegen Climbings neuem Arena-Status
nachgezogen werden.** Geprueft: Abschnitt 3.5 ("heute sind es dreizehn von zwanzig", 13.09.) und
Abschnitt 4.3 ("die Menge enthaelt heute dreizehn Eintraege", 14.09.) sind beide fest datierte
historische Momentaufnahmen — nach derselben Konvention, die dieses Dokument schon bei
Eiskunstlauf/Staffel/Takeshi angewendet hat (datierte Zwischenmeldungen werden nicht rueckwirkend
korrigiert, nur die laufende Zusammenfassungstabelle in Abschnitt 1 und der Gesamtdurchschnitt
tragen den aktuellen Stand). Der einzige Satz, der tatsaechlich eine laufende Ordinalzahl traegt
(„Spurt ist die 14. arena-resolved Disziplin", Zeilen 11-Eintrag und Abschnitt 2) beschreibt Spurts
eigene, damals korrekte Position beim eigenen Beitritt und bleibt unveraendert richtig — Climbing
tritt chronologisch danach bei und ist entsprechend die 15.

**Ergebnis fuer die Tabelle:** Time-Trial 76 %→**86 %**, Climbing 55 %→**66 %**, achtzehn Zeilen
unveraendert. **Neuer Gesamtdurchschnitt: 75 %→76 %** (rechnerisch 76,4 %). Je Achse: Konzept
unveraendert (79,5 % exakt, rundet weiter auf 80 %), Assets nahezu unveraendert (74,0→74,25 %,
rundet weiter auf 74 %), Gameplay 74,55 %→**76,7 %** (rundet auf 77 %, allein aus Climbings
Gameplay-Sprung), Movement 73,25 %→**75,0 %** (allein aus Time-Trials Movement-Sprung). Anders als
beim zwoelften Nachtrag (Fechten: Assets/Movement bewegten sich, Konzept/Gameplay blieben stehen)
bewegt sich diese Runde auf der **Gameplay-/Movement-Achse**, waehrend Konzept bei beiden Zeilen
bewusst unberuehrt bleibt — Climbings K4-Kalibrierpuffer bleibt unter dem Kaderrauschen, Time-Trials
Konzept war schon vorher voll.

---

**Zwölfter Nachtrag 16.09. — Fechten nachgezogen (PR #945/#946), die groesste Einzelbewegung
einer Zeile in dieser Tabelle bisher.** Der elfte Nachtrag (direkt darunter) hatte Fechten zuletzt
auf 64 % gebracht und dabei ausdruecklich festgehalten, dass Konzept/Assets/Movement offene
Baustellen bleiben. Seither sind zwei weitere PRs auf `main` gelandet, beide ausschliesslich an
Fechten: `docs/design/fechten-rezeptkalibrierung-16-09.md` (PR #945) und
`docs/design/fechten-movement-assets-16-09.md` (PR #946). **rho frisch nachgemessen** auf `main`
@ `9a50248f`: `node scripts/miss-alle-disziplinen.mjs 24 fechten` liefert **0,826** (Spannweite
0,203, Saison-rho 0,888, Spannweite 0,161) — bit-identisch zu beiden PR-Texten, keine Ueberraschung.

**Alle sechzehn Teilkriterien einzeln gegen den heutigen Code geprueft, nicht aus den PR-Texten
uebernommen:**

- **K1 (eigenes Rezept):** unveraendert erfuellt — `BUEHNE_ART.fechten.rezept`
  (`battle-mode.engine.js:12510 ff.`) existiert seit dem Chassis-Umzug, PR #945 aendert nur Gewichte
  darin.
- **K2 (eigene Mechanik ueber das Chassis hinaus):** unveraendert erfuellt — die drei FIE-Perioden
  plus laufender Trefferstand (`rundenN:9`, Kommentar „PERIODEN + TREFFERSTAND",
  `:12538-12551`) stammen aus PR #928 (14.09.) und sind von den beiden 16.09.-PRs nicht angefasst.
- **K3 (eigenes Fable-Dokument):** unveraendert erfuellt, jetzt sogar um zwei weitere Dokumente
  verstaerkt (`fechten-rezeptkalibrierung-16-09.md`, `fechten-movement-assets-16-09.md`, zusaetzlich
  zu `fechten-punkte-mehrrunden-konzept-14-09.md`).
- **K4 (kalibriert, offene Fragen entschieden): weiterhin OFFEN, ausdruecklich geprueft.** PR #945
  hebt den Puffer zur 0,80-Schranke von 0,009 auf 0,026 (rho 0,809→0,826) durch eine gezielte
  Grid-Suche an `NERVEN`/`GRUNDLAGE`/`TECHNIK` — aber der Kopfkommentar direkt ueber dem Rezept
  (`battle-mode.engine.js:12520`) heisst nach der Aenderung immer noch woertlich „ERSTER,
  AUSDRUeCKLICH NICHT FINALER Sieben-Rollen-Entwurf", und das PR-Dokument selbst schreibt unter
  „Ehrliche Einordnung": der neue Puffer (0,026) bleibt **kleiner als das gemessene Kaderrauschen**
  (Spannweite 0,203) — das strenge Kriterium aus CLAUDE.md ist damit nicht erreicht, und eine
  „echte Sinkhorn-Kalibrierung (Recherche F.2)" bleibt laut Dokument expliziter naechster Schritt,
  sobald ein Buehnen-Aequivalent zu `baue-feldspiel-rezept.mjs` existiert. K4 zaehlt deshalb weiter
  als nicht erfuellt. **Konzept bleibt bei 75, nicht 100.**
- **A1 (eigene Feld-Datei im PRODUKTIVEN React-Renderer):** bereits VOR diesen beiden PRs erfuellt,
  unveraendert — `app/foundation/discipline-stage/arena/disciplines/lamps.tsx` (551 Z.) existiert seit
  laengerem und ist eine von nur DREI Feld-Dateien mit eigener Token-Zeichnung
  (`shared/track/lamps`, s. `benchmark.tsx:149,195`), keine generische Wrapper-Datei. Keine der
  beiden 16.09.-PRs hat diese Datei angefasst — ihr Diff liegt beide Male ausschliesslich in
  `public/mockups/battle-mode.engine.js`. **A1 ist keine neue Bewegung dieser Runde**, sondern
  bereits im vorherigen Assets-Stand (55) eingepreist.
- **A2 (eigene Szene im Mockup-Motor):** NEU erfuellt. `zeichneFechten()` (PR #946) ist ein
  exklusiv auf `art.fechten` gegateter Zweig, kompletter Layout-Bruch mit dem generischen
  Zwei-Reihen-Duell-Zweig — jedes Brett bekommt seine eigene horizontale Fechtbahn (Piste) mit
  Mittellinie, En-garde-Linien und Grenzlinien, eigene `posMap`.
- **A3 (disziplinrichtige Requisite):** bereits vorher voll erfuellt (die immer korrekte
  Schwert-Waffenebene, seit 07.09.), jetzt qualitativ ersetzt statt neu verdient: `FECHTEN_HAND`/
  `FECHTEN_PHASEN`/`zeichneDegen()` (PR #946) zeichnen einen eigenen Degen (Klinge, Griff, Glocke)
  konstant an der Hand, statt nur waehrend des kurzen `ani==="slash"`-Fensters. **Keine neue
  Punktzahl** — A3 stand schon vorher auf voll, das ist eine Qualitaetsreparatur innerhalb eines
  bereits gezaehlten Kriteriums (dasselbe Muster wie Gewichtheben/Hantel oder Takeshi/Startnummernband
  in frueheren Nachtraegen).
- **A4 (Ton, Musik, Kulisse):** NEU erfuellt. `TON_KATALOG.fechten` (klingen/treffer/lampe/halt/
  publikum) existierte bereits vollstaendig, aber `sfx("fechten", …)` stand bei **null**
  Aufrufstellen. `stepFechten()` (PR #946) verdrahtet jetzt zwei echte Ereignisse:
  klingen+treffer bei einem Treffer, klingen+halt bei einem Fehlschlag. Dieselbe binaere Schwelle,
  die diese Tabelle bei Hockey/Speed-Schach/Eiskunstlauf schon angewendet hat („hat Ton" = A4
  0→20, unabhaengig von der Zahl der Aufrufstellen, s. Abschnitt 3.1) — ehrlich vermerkt bleibt
  offen: kein Publikums-Loop, `lampe` bleibt ungenutzt. Das aendert die Punktzahl nicht, weil die
  bisherige Praxis in diesem Dokument A4 nie fraktioniert vergeben hat.
- **G1 (Rangtreue):** rho 0,809→0,826, **dieselbe 0,80–0,85-Stufe** (35 Punkte) — keine Bewegung.
- **G2 (Produktionsanschluss):** unveraendert erfuellt, **keine neue Bewegung dieser Runde**.
  Fechten steht bereits seit der Produktivierungswelle 2 (09.09.) in
  `ARENA_RESOLVED_DISCIPLINE_IDS` (`lib/resolve/battle-mode-arena-team-points.ts:298`) — anders als
  bei Spurt im elften Nachtrag ist das hier kein neuer Fund, nur eine Bestaetigung.
- **G3 (eigene Wertung):** unveraendert erfuellt — eigene PPS-Referenz
  (`FECHTEN_PPS_REFERENZ_FELDGROESSEN` u. a., `battle-mode-arena-team-points.ts:791 ff.`), von
  keiner der beiden PRs angefasst.
- **G4 (2–6-Spieler-Tauglichkeit):** unveraendert — `jeSeite:6`, Buehne-Chassis (12 Punkte je
  Abschnitt 3), von keiner der beiden PRs angefasst. **Gameplay bleibt bei 90.**
- **M1 (eigene Zeichenfunktion im Mockup-Motor):** NEU erfuellt — `zeichneFechten()`, s. A2 oben
  (derselbe Code, zwei verschiedene Achsen: Assets fragt nach der Szene, Movement nach der
  Zeichenfunktion selbst).
- **M2 (eigene Bewegungs-/Schrittlogik):** NEU erfuellt — `stepFechten()` schreibt eine echte
  Zustandsmaschine pro Teilnehmer (`u.vizFechtPhase`: „engarde"→„ausfall"→„erholung"/„parade"→zurueck),
  haerterer Standard als z. B. Climbings `stepClimbing()` (das im zehnten/elften Nachtrag mit nur
  einem geschriebenen Feld schon volle M2-Punktzahl bekam).
- **M3 (sichtbare Animation in der produktiven React-Buehne):** bereits VOR diesen beiden PRs
  erfuellt, unveraendert — `lamps.tsx` traegt eine eigene Touché-FX-Schicht: Ausfall-Lunge bei
  Score-Anstieg, rot/gruen aufflammender Treffer-Melder, kreuzende Klingen mit Klirr-Funke am
  Treffpunkt, Glow-Pulse (`lamps.tsx:16-17, 147-198, 290-322`). Genau die Art Beleg, die Basketballs
  M3 ueber `useTokenGlide`/`GhostLayer` in `court.tsx` schon vorgemacht hat. **Keine neue Bewegung**
  — von den beiden 16.09.-PRs unberuehrt (deren Diff liegt komplett in `battle-mode.engine.js`).
- **M4 (disziplineigene Posen/FX an den Sprites):** NEU voll erfuellt, vorher nur teilweise. Vorher
  zeigte der Fechter die Waffe nur waehrend des kurzen `ani==="slash"`-Fensters (ein generischer
  Mechanismus, kein eigenes Posensystem) — jetzt haelt `FECHTEN_PHASEN` drei eigene Phasen
  (engarde/ausfall/parade) mit je eigenem Klingenwinkel und Reichweitenfaktor, gezeichnet ueber
  `zeichneDegen()`, dauerhaft sichtbar statt nur im Ausfallfenster. **Movement bleibt vollstaendig
  bei 100**, s. u.

**Ergebnis:** Konzept bleibt bei **75** (K4 weiterhin offen). Assets springt von **55 auf 100**
(A2 und A4 neu, A1/A3 bereits vorher voll — kein Deckel-Kriterium mehr offen). Gameplay bleibt bei
**90** (rho in derselben Stufe). Movement springt von **35 auf 100** (M1/M2 neu, M4 von teilweise
auf voll, M3 bereits vorher voll). **Gesamt: 64 %→91 %** (75/100/90/100, rechnerisch 91,25 %) —
die groesste Einzelbewegung, die dieses Dokument bisher fuer eine Zeile verzeichnet (bisher groesster
Sprung: Spurt +14 Punkte im elften Nachtrag). Der Grund fuer die Groesse des Sprungs ist nicht eine
grosszuegigere Messung, sondern dass die beiden PRs in einer konsolidierten Runde praktisch alle
verbliebenen Assets-/Movement-Luecken auf einmal schliessen, waehrend die einzige verbliebene
Konzept-Luecke (K4) und die Rangtreue-Stufe (G1) bewusst unangetastet bleiben — genau die zwei
Achsen, an denen eine reine Praesentations-/Kalibrierrunde nichts aendern sollte und laut PR-Texten
auch nichts geaendert hat.

Der Abstand zwischen Konzept (Design) und Darstellung (Assets/Movement), den dieses Dokument seit
dem 10.09. verfolgt, dreht sich fuer Fechten damit erstmals um: nicht mehr „mehr durchdacht als zu
sehen", sondern „so weit dargestellt wie es das noch unfertige Rezept hergibt".

---

**Elfter Nachtrag 16.09. — sieben liegengebliebene PRs (#924/#925/#926/#928/#929/#930/#934) nachgezogen,
alle zwanzig Zeilen gegenkontrolliert.** Der zehnte Nachtrag stand seit 14.09. vormittags; seither
sind mindestens acht relevante PRs gemergt (#924, #925, #926, #928, #929, #930, #933/#934, #935–#940),
ohne dass diese Tabelle nachgezogen wurde. **Alle rho-Zahlen unten sind heute (16.09.) frisch
gemessen** — `node scripts/miss-alle-disziplinen.mjs 24` auf `main` @ `45af1c5d` — und bestätigen
bit-identisch sowohl `docs/pm-briefings/pm-gesamtstand-15-09.md` als auch die am 15.09. erneuerte
`data/generated/rangtreue-basislinie.json` (PR #932/#936); keine Ueberraschung, keine Regression.

**Sechs Zeilen bewegen sich, sieben bleiben trotz Codeaenderung unbewegt bestehen, sieben sind
schlicht unveraendert:**

| Disziplin | Vorher (14.09.) | Jetzt (16.09.) | Ursache |
|---|---:|---:|---|
| **Spurt** | 69 % | **83 %** | PR #926: Feldgroesse 4→6 behoben, rho 0,871→0,894 (jetzt ≥0,85-Stufe, G1 40 statt 40 — aber **G2 30 neu**, Spurt ist die 14. arena-resolved Disziplin); dazu `stepHuerden()` (Teil B derselben PR) beendet die eingefrorene Sprite-Animation, die diese Tabelle bei Spurt bis heute als offenen Movement-Mangel gefuehrt hat — Movement 60→85. |
| **Tennis** | 56 % | **71 %** | PR #929: `zeichneTennis()` ist jetzt ein eigener Buehnenzweig (vorher der geteilte Duell-Zweig) mit Schlaeger an der Hand (`DISZIPLIN_PROP.tennis`, vorher `null`) und einer Ballwechsel-Flugbahn — Assets 40→70 (A2/A3 erstmals erfuellt), Movement 20→50 (M1/M4 erstmals erfuellt). Rezept/`wert()` unangetastet, rho bit-identisch (0,825). |
| **Fechten** | 59 % | **64 %** | PR #923 (Konzeptrecherche) + PR #928 (drei FIE-Perioden statt einer Punkteformel, laufender Trefferstand im Feed, Chris' Go 14.09.) heben Konzept 55→75 — aber das Rezept selbst bleibt im Code explizit „ERSTER, AUSDRUeCKLICH NICHT FINALER Sieben-Rollen-Entwurf" (`battle-mode.engine.js:12442`), keine Kalibrierrunde, also K4 weiterhin offen. Gameplay bleibt 90 (rho 0,816→0,809, dieselbe 0,80–0,85-Stufe). Movement bleibt 35: `stepFechten()` existiert bis heute nicht, `fechten:true` ist weiterhin rein deskriptiv (`:13416`, Waechter greift nie). Assets bleibt 55: `sfx("fechten"` steht 0x im Motor. |
| **Football** | 79 % | **76 %** | Gegenlaeufige Bewegung in zwei Schritten: PR #924 (Korridor-Refit Runde 2) hob rho 0,800→0,813, **dann** PR #934 (E3, „eine Wahrheit" fuer Footballs Gewichtsquelle) senkte es strukturell auf **0,722** — unter die 0,80-Schranke. G1 faellt von der 0,80–0,85-Stufe (35) auf die 0,70–0,80-Stufe (22), Gameplay 65→52. PR #933 (Football-PPS-Referenz) liegt bereit, aber Football steht **weiterhin nicht** in `ARENA_RESOLVED_DISCIPLINE_IDS` — die Produktivschaltung ist laut PR #933 selbst bewusst zurueckgestellt, bis eine Balance-Runde (Plan in `docs/design/football-balance-runde-nach-e3-15-09.md`, PR #937) rho wieder ueber 0,80 bringt. Konzept/Assets/Movement unveraendert. |
| **Climbing** | 49 % | **55 %** | PR #925: Climbing hatte als einzige der fuenf Bahn-Disziplinen **ueberhaupt keinen** `bahnBewegung()`-Zweig — kein `art.climbing`-Flag, kein Aufruf, die Figuren liefen komplett ueber die eingefrorene Weltuhr `t`. Neues `stepClimbing()` schreibt jetzt `u.vizSchritt` (1:1 aus `stepZeitfahren()` uebertragen) — M2 (eigene Schrittlogik) erstmals erfuellt, Movement 40→65. Rein praesentational, rho bit-identisch (0,782, weiterhin knapp durchgefallen). |
| **Mini-DM** | 53 % | **54 %** | PR #927 (Spielplan-Anchoring, drei Chris-Entscheidungen eingeholt) + PR #930 (4-Team-Pods, `mini-dm-pod-schedule.ts`, echter Playwright-Aufrufer fuer den FFA-Motor) beantworten fuenf von sechs offenen Spielplanfragen (`mini-dm-4-team-ffa-recherche-06-09.md` Abschnitt 5) — Konzept 70→75 (K4-Teilfortschritt: „offene Designfragen entschieden"). **Ausdruecklich nicht** in die Live-Resolve-Pipeline verdrahtet, Mini-DM bleibt ausserhalb `ARENA_RESOLVED_DISCIPLINE_IDS`; Gameplay haengt weiterhin allein an rho (0,256, unveraendert) und bleibt bei 22 — ein fertiger Spielplan aendert nichts an einer durchfallenden Zielwahl-Mechanik. |

**Unveraendert trotz eigener PR (rho-neutral, keine Achse bewegt):** TDM (PR #938 nimmt die
Stufenaufstieg-Vorschau raus — auskommentiert, nicht geloescht; war laut PR-Text „ohnehin nie ein
zaehlender Achsen-Baustein", rho bit-identisch 0,165, Konzept/Assets/Gameplay/Movement bleiben bei
55/65/22/65). Hockey (PR #921/#922, reine Praesentation, rho bit-identisch). Staffel und Takeshi's
Castle bekommen mit PR #925 dieselbe `stepZeitfahren()`-Reparatur wie Spurt/Climbing — bei ihnen war
das Bein-Animationsbild aber schon vorher **teilweise** ueber ihre eigenen Zustandsmaschinen
(`stepStaffel`/`stepParcours`) bewegt, M2 stand hier also schon vor der PR auf voller Punktzahl;
die Reparatur schliesst eine kosmetische Restluecke innerhalb eines bereits gezaehlten Kriteriums,
keine neue — Movement bleibt bei 95 (dasselbe Muster wie Eiskunstlaufs Sturz-Teleport-Fix im
zehnten Nachtrag).

**Sechs bestaetigt weiterhin auf demselben hohen Stand, rho-gegengeprueft (16.09.):** Gewichtheben
(0,843), Takeshi's Castle (0,879), Breaking (0,869/0,114/0,951/0,168), Eiskunstlauf (0,885),
Speed-Schach (0,908), Staffel (0,899) — alle sechs Zahlen bit-identisch zum letzten Stand, keine
PR hat sie seit dem 14.09. angefasst. Basketball (0,769) und die uebrigen zwoelf unveraendert
gebliebenen Zeilen (Time-Trial, Wettessen, Showcase, I-Spy, Battlefield) ebenfalls bit-identisch.

**Reine Infrastruktur, ohne Wirkung auf eine der zwanzig Achsen-Zeilen:** PR #935 (Arena-Resolve
Weg B — beide Disziplinen eines Spieltags laufen jetzt als echtes Duell, wenn beide arena-aufgeloest
sind) und der daraus gefundene Standings-Bypass (PR #939 Diagnose, PR #940 Fix — Arena-Team-Punkte
erreichten `SeasonState.standings` bislang fuer keine der arena-aufgeloesten Disziplinen) aendern,
**wie** ein bereits arena-aufgeloestes Ergebnis in der Saisontabelle landet, nicht **ob** eine
Disziplin arena-aufgeloest ist oder wie ihre vier Achsen stehen. Erwaehnt hier nur, damit niemand
danach sucht, wo sie fehlen.

**Neuer Durchschnitt: 74 %** (Konzept 80 % · Assets 72 % · Gameplay 75 % · Movement 70 %), vorher
72 % am 14.09. Die Bewegung kommt fast vollstaendig aus den sechs oben genannten Zeilen; die
uebrigen vierzehn sind ziffernidentisch zum zehnten Nachtrag.

---

**Zehnter Nachtrag 14.09. — Eiskunstlauf und Breaking nachgezogen (PR #917/#913), plus eine seit
dem 13.09. liegengebliebene Eiskunstlauf-Zeile gefunden.** Der neunte Nachtrag (direkt darunter)
hat Eiskunstlauf/Breaking ausdruecklich ausgespart, weil PR #917 und #913 noch in Pruefung waren —
beide sind seither gemergt (`a82a90d1`, `8aecd880`) und werden hier nachgezogen. **rho fuer beide
FRISCH auf dem heutigen `main` gemessen**, nicht aus den PR-Texten uebernommen: `node
scripts/miss-alle-disziplinen.mjs 24 eiskunstlauf breaking` liefert Eiskunstlauf **0,885** und
Breaking **0,869 / 0,114 / 0,951 / 0,168** — beide bit-identisch zu den PR-Texten und zur
bestehenden Tabelle. **Anders als beim neunten Nachtrag gab es diesmal keinen Widerspruch
zwischen Messung und PR-Text.** Ein Fund ausserhalb der beiden PRs: die Eiskunstlauf-Zeile war
bereits seit PR #903 (13.09., „Ton-Aufrufstellen, Kufe-Requisite, K4-Kalibrierung", Konzept 90→95,
Assets 70→95) stale — dieselbe Art Luecke wie Staffel im neunten Nachtrag, nur eine Runde aelter
und vom neunten Nachtrag selbst nicht gefunden, weil er nur die zehn PRs seiner eigenen Merge-Welle
geprueft hat. S. 4.4.

**Neunter Nachtrag 14.09. — Nachzug fuer die Merge-Welle vom 13./14.09.** Zehn PRs sind seit dem
achten Nachtrag auf `main` gelandet (#910, #908, #911, #909, #912, #907, #915, #914, #916, #918);
#909 stand bereits drin, die uebrigen neun waren offen. **Alle rho-Zahlen dieses Nachtrags sind
auf dem heutigen `main` (`7a07de2f`, PR #918) FRISCH GEMESSEN**, nicht aus den PR-Texten
uebernommen — `node scripts/miss-alle-disziplinen.mjs 24 <disziplin ...>`, kaderfest, dieselbe
Kader-Familie wie am 10.09. (live-save, gezogen 03.09.), Seitenfehler keine. Das war noetig: die
PR-Texte widersprachen sich an zwei Stellen (Takeshi stand in #914 mit 0,861→0,852, in #916 mit
0,883 — gemessen sind es **0,879**). Zwei Befunde ausserhalb der Merge-Welle sind dabei
mitkorrigiert worden: die Spalte „Arena" fuehrte Staffel/Takeshi/Time-Trial faelschlich mit „nein",
obwohl alle drei seit dem 10.09. in `ARENA_RESOLVED_DISCIPLINE_IDS` stehen (nachgelesen,
`lib/resolve/battle-mode-arena-team-points.ts:250-252`) — und die Staffel-Zeile war seit PR #901
(13.09.) an Assets und Movement nicht nachgezogen. **Eiskunstlauf und Breaking sind bewusst
unangetastet**: sie haengen an PR #917 und #913, die noch in Pruefung sind und ihren eigenen
Nachzug bekommen.

**Achter Nachtrag 12.09. — Tabelle korrigiert (war zwei Runden veraltet) und neue Spalte
"Letzte Aenderung" eingefuehrt.** Diese Datei ist die Scorecard, nach der Chris am 12.09. gefragt
hat: „die scorecard soll der overseer immer up to date halten, neue spalte einfügen mit latest
changes + datum". Die Tabelle unten war seit ihrer eigenen Erstellung (`c56fffd7`) durch zwei
spaetere Runden ueberholt worden, ohne dass sie hier nachgezogen wurde: die Feinschliff-Runde
(Gewichtheben-Assets, Eiskunstlauf-Movement, Breaking-Assets+Movement, Takeshi-Bahn-Produktivierung,
alle PR #872-#884, 10.09.) und die Football-Gameplay-Runde 1 (rho 0,516 → 0,800, PR #884, 10.09.).
Die korrekte Zwischenstufe stand bereits in
`docs/pm-briefings/opus-plan-zehn-disziplinen-alle-kategorien-09-10.md` Abschnitt 1.1 — von dort
uebernommen, plus die eine echte Aenderung von heute (Hockey-Ton, E2, PR #893, Assets 80→100).
**Ab jetzt gilt:** nach jeder Runde, die eine Zeile unten bewegt, wird diese Tabelle noch in
derselben Sitzung nachgezogen — nicht erst beim naechsten grossen Audit.

# Gesamtstand 10.09. — wie fertig ist jede der zwanzig Disziplinen?

**Auftrag von Chris (woertlich, 10.09.):** „kannst du mir in % noch mal sagen wie fertig alle
diszis sind was konzept/assets/gameplay/movement usw angeht? wüsste gerne wo wir nachschärfen
müssen und was schon gut ist und was noch alles gemacht werden muss und wo du noch kein konzept
hast"

**Stand:** `main` = `4058cd36` („Opus-Overseer-Review PR #867", 09.09.). Reine Bestandsaufnahme,
kein Produktionscode geaendert.

**Alle zwanzig rho-Zahlen unten sind fuer diesen Bericht FRISCH gemessen**, nicht aus
`stand-aller-disziplinen.md` oder aus der eingecheckten Basislinie uebernommen:
`node scripts/miss-alle-disziplinen.mjs 24 <disziplin ...>`, kaderfest, Median ueber fuenf echte
Team-Paarungen aus `data/generated/kaderfamilie-live-save.json`, n=24 Spiele je Variante, in drei
synchronen Laeufen ueber alle zwanzig (rund 13 Minuten Gesamtlaufzeit). Jede andere Zahl in diesem
Bericht ist an Code oder Doku belegt — die Fundstelle steht jeweils dabei.

---

## 0. Die Methode — wie die vier Prozentzahlen entstehen

Jede Achse hat **vier Teilkriterien**, jedes mit einer festen Punktzahl. Eine Disziplin bekommt
ein Teilkriterium ganz, teilweise oder gar nicht. Das ist kein Messwert, sondern eine
**begruendete Einstufung** — aber eine, deren Regel offenliegt und die jeder an derselben Stelle
im Code nachpruefen kann.

### Konzept (4 x 25)
| | Kriterium |
|---|---|
| K1 | Eigenes, aus der eigenen MATRIX abgeleitetes Rezept in der `*_ART`-Tabelle (`battle-mode.engine.js`) |
| K2 | Eigene Mechanik ueber das hinaus, was das Chassis fuer alle mitbringt (eigenes Flag, eigener Zweig, eigene Zustandsmaschine) |
| K3 | Eigenes Fable-/Design-Dokument, das die Disziplin von Grund auf modelliert |
| K4 | Rezept nachweislich kalibriert (gemessene NACHGEZOGEN-Runde, Kalibrierung gegen echte Sportdaten) und die offenen Designfragen entschieden |

### Assets (30/25/25/20)
| | Kriterium |
|---|---|
| A1 (30) | Eigene, nicht generische Feld-Datei im PRODUKTIVEN React-Renderer (`app/foundation/discipline-stage/arena/disciplines/*.tsx`) |
| A2 (25) | Eigene Szene im Mockup-Motor ueber das geteilte Chassis-Bild hinaus |
| A3 (25) | Disziplinrichtige Ausruestung/Requisiten an den Sprites (keine falsche Zufallswaffe, eigene Props) |
| A4 (20) | Ton, Musik, Kulisse |

### Gameplay/Rezept (40/30/15/15)
| | Kriterium |
|---|---|
| G1 (40) | Rangtreue kaderfest: ≥0,85 → 40 · 0,80–0,85 → 35 · 0,70–0,80 → 22 · 0,50–0,70 → 12 · <0,50 → 5 |
| G2 (30) | Produktionsanschluss: steht in `ARENA_RESOLVED_DISCIPLINE_IDS` (`lib/resolve/battle-mode-arena-team-points.ts:201-213`) |
| G3 (15) | Eigene Wertung im Spiel (eigene `wertungTabelle`, `bahnTeamstand`-Modus, Boxscore-an-PPs) |
| G4 (15) | 2–6-Spieler-Tauglichkeit (Feldspiel/Buehne 15, Bahn/Arena 12 — s. Abschnitt 3) |

### Movement/Animation (35/25/25/15)
| | Kriterium |
|---|---|
| M1 (35) | Eigene Zeichenfunktion/Zeichenzweig im Mockup-Motor statt der generischen Chassis-Darstellung |
| M2 (25) | Eigene Bewegungs-/Schrittlogik (`step*`-Sonderfaelle, Zustandsmaschine) |
| M3 (25) | Sichtbare Animation/Effekte in der produktiven React-Buehne (Glide, Ghost, Uebergaenge) |
| M4 (15) | Disziplineigene Posen/FX an den Sprites |

**Gesamt = einfacher, ungewichteter Durchschnitt der vier Achsen.** Bewusst ungewichtet, weil
Chris nach genau diesen vier Dingen gefragt hat und keine als wichtiger benannt hat. Das ist eine
ANDERE Rechnung als in `stand-aller-disziplinen.md` Abschnitt 5b (dort: Rangtreue 40 %, eigene
Mechanik 25 %, Bild/Bewegung 20 %, im echten Spielstand 15 %) — die Zahlen sind deshalb NICHT
direkt vergleichbar. Wer die Release-Sicht will, gewichtet Gameplay hoeher; dann steigen
Basketball/Hockey/Gewichtheben, und Football/TDM/Mini-DM/Battlefield fallen deutlich.

---

## 1. Die Zusammenfassungstabelle

Die Nummerierung ist die Reihenfolge des Ursprungsberichts vom 10.09. und **nicht mehr nach Gesamt
sortiert** — sie bleibt stehen, damit sich fruehere Nachtraege weiter auf dieselben Zeilennummern
beziehen koennen. `rho` = kaderfest gemessen, n=24, Median ueber fuenf echte Team-Paarungen; Zeile
4 (Breaking) und 6 (Eiskunstlauf) sind fuer den zehnten Nachtrag auf dem heutigen `main` (nach
`8aecd880`, PR #913) neu gemessen, die zehn Zeilen des neunten Nachtrags stehen auf `main` @
`7a07de2f`, alle uebrigen unveraendert auf dem Lauf vom 10.09. „Arena" = Produktionsanschluss
(`ARENA_RESOLVED_DISCIPLINE_IDS`).

**Fuer den elften Nachtrag (16.09.) sind alle zwanzig Zeilen frisch gegen `main` @ `45af1c5d`
gemessen** (`node scripts/miss-alle-disziplinen.mjs 24`, kaderfest) — Zeilen 9, 11, 12, 13, 14 und
17 sind unten entsprechend aktualisiert, die uebrigen vierzehn bit-identisch bestaetigt (s. elfter
Nachtrag ganz oben fuer die Begruendung jeder Bewegung).

**Fuer den zwoelften Nachtrag (16.09., `main` @ `9a50248f`) ist zusaetzlich Zeile 12 (Fechten)
erneut aktualisiert** — rho frisch gemessen (`node scripts/miss-alle-disziplinen.mjs 24 fechten`),
alle sechzehn Teilkriterien einzeln gegenkontrolliert, s. zwoelfter Nachtrag ganz oben. Die
uebrigen neunzehn Zeilen sind gegenueber dem elften Nachtrag unveraendert.

**Fuer den dreizehnten Nachtrag (16.09., `main` @ `ce3ec182`) sind zusaetzlich Zeile 10 (Time-Trial)
und Zeile 17 (Climbing) aktualisiert** — rho fuer beide frisch gemessen
(`node scripts/miss-alle-disziplinen.mjs 24 climbing time-trial`), alle sechzehn Teilkriterien je
Disziplin einzeln gegenkontrolliert, s. dreizehnter Nachtrag ganz oben. Die uebrigen achtzehn
Zeilen sind gegenueber dem zwoelften Nachtrag unveraendert.

| # | Disziplin | Chassis | Konzept | Assets | Gameplay | Movement | **Gesamt** | rho | Arena | Letzte Aenderung |
|--:|---|---|--:|--:|--:|--:|--:|--:|:--:|---|
| 1 | Hockey | Feldspiel | 100 % | 100 % | 72 % | 100 % | **93 %** | 0,669 / 0,719 | ja | **13./14.09.** Leisten zeigen, was sie messen + eigenes Bodycheck-Bild (PR #910), sichtbare Puste-Leiste aus AUSDAUER (PR #914) — beide rho-ziffernidentisch, keine Achse bewegt · 12.09. Ton verdrahtet, Assets 80→100 (E2, PR #893) |
| 2 | Gewichtheben | Buehne | 100 % | 100 % | 90 % | 100 % | **98 %** | 0,843 | ja | **14.09.** Zweikampf statt Einzeluebung im dritten Versuch + duellbewusste Eroeffnung, Chris' Kernbeschwerde 66,2 %→50,0 % (PR #907); Hantel blattproportional statt absoluter Pixel (PR #915). rho 0,854→**0,843** → G1 eine Stufe tiefer, Gameplay 95→90 · 12.09. Movement 87→100 — `stepHeben()` (PR #898) |
| 3 | Takeshi's Castle | Bahn | 100 % | 95 % | 97 % | 95 % | **97 %** | 0,879 | ja | **14.09.** Puste-Erholung am Hindernis wirksam (PR #914), rho 0,883→**0,879** — gleiche G1-Stufe, keine Achse bewegt · Arena-Spalte korrigiert (stand seit 10.09. faelschlich auf „nein") · **13.09.** Fallentyp entscheidet den Sauber-Wurf mit (`fallenKoennen`), rho 0,861→0,883 — Fable-Recherche `takeshi-hindernis-vs-strecke-recherche-13-09.md` · 12.09. Movement 85→95 — `stepParcours()` (Laeufer-Zustandsmaschine) + drei Posen, Anker per Pixelscan korrigiert (PR #900) |
| 4 | Breaking | Buehne | 95 % | 100 % | 95 % | 96 % | **97 %** | 0,869 / 0,114 / 0,951 / 0,168 | ja | **14.09.** Klares 1v1 (Ertraegender im Spotlight, Peiniger mit 10-stufiger Folterbank) statt zwoelf gleichrangiger Figuren im Ring — Movement 92→96 (PR #913, rho bit-identisch frisch gemessen). Assets bleibt bei 100 (bereits Deckel) · 12.09. K4 erfuellt, Konzept 85→95 — Kalibrierrunde gegen echte WDSF-Daten, dokumentierter Nullbefund, kein Codechange (PR #897) |
| 5 | Basketball | Feldspiel | 100 % | 100 % | 82 % | 100 % | **96 %** | 0,769 | ja | 10.09. E1 gemessen (G1\*-Kriterien nicht erfuellt, PR #890) — keine Aenderung |
| 6 | Eiskunstlauf | Buehne | 95 % | 100 % | 95 % | 94 % | **96 %** | 0,885 | ja | **14.09.** Spotlight-Reihenfolge (gruppenweise statt „alle zwoelf gleichzeitig") + drei Zonen (Kuerbahn/Startbereich/Kiss-and-Cry) + Live-Standings-Tafel `zeichneEisStand()` vervollstaendigen die eigene Szene — Assets 95→100 (PR #917, rho bit-identisch frisch gemessen); Sturz-Teleport-Bug behoben (gedeckelte Paar-Uhr), Movement bleibt 94 (Reparatur einer bereits gezaehlten Achse, keine neue) · **Nachzug 13.09.:** Konzept 90→95, Assets 70→95 — Ton-Aufrufstellen + Kufe-Requisite + K4-Kalibrierung (PR #903, in der Tabelle nie nachgezogen) |
| 7 | Speed-Schach | Buehne | 95 % | 95 % | 100 % | 95 % | **96 %** | 0,908 | ja | **12.09.** Konzept/Assets/Movement 80/75/80→95 — eigenes Fable-Dokument, Ton, Schachuhr-Requisite, `stepSchach()` (PR #902) |
| 8 | Staffel | Bahn | 95 % | 95 % | 97 % | 95 % | **96 %** | 0,899 | ja | **14.09.** Oval als echte Stadionform, Bildposition aus dem Gesamtfortschritt, alle Zeitanzeigen in echten Sekunden, Ausfuehrungsstreuung beim Wechsel — rho 0,915→**0,899** (gepaart reproduziert, gleiche G1-Stufe) (PR #916) · **Nachzug 13.09.:** Assets 55→95, Movement 70→95 (Stab-Sprite + Ton, PR #901, in der Tabelle nie nachgezogen) · Arena-Spalte korrigiert |
| 9 | Football | Feldspiel | 90 % | 75 % | **52 %** | 85 % | **76 %** | 0,722 | nein | **16.09.-Nachzug (Bewegung 14./15.09.):** PR #924 (Korridor-Refit Runde 2) hob rho 0,800→0,813, danach PR #934 (E3, „eine Wahrheit" fuer Footballs Gewichtsquelle) senkte es strukturell auf **0,722** — G1 faellt von der 0,80–0,85- auf die 0,70–0,80-Stufe, Gameplay 65→52. PR #933 (PPS-Referenz) liegt bereit, Produktivschaltung bewusst zurueckgestellt (Balance-Runde in Arbeit, PR #937) |
| 10 | Time-Trial | Bahn | 95 % | **55 %** | 92 % | **100 %** | **86 %** | 0,825 | ja | **16.09.-Nachzug (PR #948, 16.09.):** `bodenZeitfahren()` (neue, exklusiv auf `zeitfahren` gegatete Zeichenfunktion in `bodenSpurt()`) zeichnet erstmals das Streckenprofil selbst — Terrain-Toenung mit Schraegschraffur je `gelaende`-Zone plus Huegelsilhouette ueber der Bahn — und schliesst damit die bisherige Hauptluecke „man sieht keinen Berg"; A2 erstmals voll erfuellt (Assets 50→55) und dieselbe Funktion erfuellt zugleich M1 (eigene Zeichenfunktion statt der generischen `bodenSpurtGerade()`, die die anderen vier Bahnen weiterhin nutzen), Movement 65→100. `u.vizNeigung` in `stepZeitfahren()` plus Vorlehnung/Aufrichtung in `zeichneSpurt()` verstaerken M2/M4, beide bereits vorher voll, keine neue Punktzahl. rho bit-identisch **0,825** (reine Praesentation, `gelaendeFaktor()`/`gelaendeZehrFaktor()` unangetastet), Gameplay bleibt 92 · **13.09.** Zwischenstand rechnet hochgerechnete Eigenzeit statt roher Strecke, alle Zeitanzeigen im Uhrenmassstab, `stepZeitfahren()` mit Laufzyklus/Erschoepfung/Rampe → Movement 50→65, Startrampe+Ausdauer-Leiste → Assets 45→50; rho 0,828→**0,825** (PR #908) · Arena-Spalte korrigiert |
| 11 | Spurt | Bahn | 95 % | 55 % | **97 %** | **85 %** | **83 %** | 0,894 | **ja (neu)** | **16.09.-Nachzug (PR #926, 14.09.):** Feldgroesse 4→6 behoben, rho 0,871→0,894 (≥0,85-Stufe) plus **G2 30 neu** — Spurt ist die 14. arena-resolved Disziplin, Gameplay 67→97. `stepHuerden()` (Teil B derselben PR) beendet die eingefrorene Sprite-Animation, Movement 60→85 |
| 12 | Fechten | Buehne | 75 % | **100 %** | 90 % | **100 %** | **91 %** | 0,826 | ja | **16.09.-Nachzug 2 (PR #945/#946, 16.09.):** Rezeptkalibrierung (NERVEN/GRUNDLAGE/TECHNIK neu gewichtet) hebt rho 0,809→0,826, gleiche 0,80–0,85-Stufe, Gameplay bleibt 90 — Kopfkommentar bleibt „nicht finaler Entwurf" (`:12520`), Puffer (0,026) bleibt unter dem Kaderrauschen (0,203), K4 weiterhin offen, Konzept bleibt 75. `zeichneFechten()` (eigene Fechtbahnen je Brett, A2/M1 neu) + `stepFechten()` (eigene Zustandsmaschine engarde/ausfall/erholung/parade, M2 neu) + `sfx("fechten",…)` erstmals verdrahtet (A4 neu) + `FECHTEN_PHASEN`/`zeichneDegen()` als dauerhafte eigene Pose statt nur im Ausfallfenster (M4 voll) — Assets 55→100, Movement 35→100. A1/M3 waren ueber `lamps.tsx` (eine von drei Feldern mit eigener Token-Zeichnung, eigene Touché-FX) bereits vorher voll und unberuehrt |
| 13 | Tennis | Buehne | 75 % | **70 %** | 90 % | **50 %** | **71 %** | 0,825 | ja | **16.09.-Nachzug (PR #929, 14.09.):** `zeichneTennis()` als eigener Buehnenzweig mit Schlaeger an der Hand (`DISZIPLIN_PROP.tennis`, vorher `null`) und Ballwechsel-Flugbahn — Assets 40→70 (A2/A3 erstmals erfuellt), Movement 20→50 (M1/M4 erstmals erfuellt). Rezept/`wert()` unangetastet, rho bit-identisch |
| 14 | Mini-DM | Arena | **75 %** | 60 % | 22 % | 60 % | **54 %** | 0,256 | nein | **16.09.-Nachzug (PR #927/#930, 14.09.):** fuenf von sechs offenen Spielplanfragen beantwortet (4-Team-Pods, Kadergroesse 1, echter Playwright-Aufrufer fuer den FFA-Motor) — Konzept 70→75 (K4-Teilfortschritt). Weiterhin nicht in `ARENA_RESOLVED_DISCIPLINE_IDS` verdrahtet, Gameplay haengt allein an rho (0,256, unveraendert) · **13.09.** der 4-Team-FFA hat NULL Produktionsaufrufer (PR #911, s. 3.5) |
| 15 | Battlefield | Arena | 70 % | 60 % | 22 % | 60 % | **53 %** | 0,251 | nein | **14.09.** Reihenabstand 34,5→155,0 px, Commander bleibt in Reihe 2 → Movement 55→60 (PR #912). rho 0,387→0,251, Kaderrauschen 0,778 — gleiche G1-Stufe · **16.09. gegenkontrolliert:** unveraendert |
| 16 | TDM | Arena | 55 % | 65 % | 22 % | 65 % | **52 %** | 0,165 | nein | **14.09.** Reihenabstand 20,4→81,3 px + zwei neue Zielneigungen (`speer`/`schild`) → Movement 60→65 (PR #912). rho 0,253→0,165, Kaderrauschen 0,272 — gleiche G1-Stufe · **16.09.-Nachzug:** PR #938 (15.09.) nimmt die Stufenaufstieg-Vorschau raus (auskommentiert, nicht geloescht) — reine Anzeigefunktion, war nie ein zaehlender Achsen-Baustein, keine Zahl bewegt sich |
| 17 | Climbing | Bahn | 65 % | 40 % | **92 %** | 65 % | **66 %** | 0,834 | **ja (neu)** | **16.09.-Nachzug (PR #943, 16.09.):** eigene Rezeptkalibrierung — `BAHN_ART.climbing.rezept.STEHEN` neu gewichtet (Grid-Suche gegen die Matrix-Abweichung, `messe-arena-einfluss.mjs`/`sondiere-feldspiel-subskills.mjs`) hebt rho 0,782→**0,834**, G1-Stufe wechselt von 0,70–0,80 (22) auf 0,80–0,85 (35); zugleich Produktionsanbindung — `"climbing"` neu in `ARENA_RESOLVED_DISCIPLINE_IDS`/`ARENA_BAHN_DISCIPLINE_IDS`, eigene PPS-Referenz gezogen, **G2 30 neu** — Climbing ist damit die 15. arena-resolved Disziplin, Gameplay 49→92. K4 bleibt bewusst offen (Puffer 0,034 kleiner als das Kaderrauschen 0,209, von der PR selbst als „duenner als Zeitfahrens" benannt), Konzept bleibt 65; Assets/Movement unangetastet (reine Rezept-/Anschluss-PR, keine Zeichen- oder Bewegungszeile) · **14.09.** Puste-Erholung wirksam — 69,3 %→31,9 % bleiben leer, 59,7 % fangen sich wieder; rho 0,790→0,782 (PR #914), gleiche G1-Stufe · **Nachzug 14.09. (PR #925):** neues `stepClimbing()` erfuellt M2 erstmals, Movement 40→65 |
| 18 | Wettessen | Buehne | 35 % | 40 % | 95 % | 15 % | **46 %** | 0,845 | ja | 10.09. Zufallswaffen-Bug geschlossen, Assets 30→40 |
| 19 | Showcase | Buehne | 25 % | 40 % | 95 % | 20 % | **45 %** | 0,892 | ja | 10.09. Zufallswaffen-Bug geschlossen, Assets 30→40 |
| 20 | I-Spy | Buehne | 55 % | 40 % | 37 % | 20 % | **38 %** | 0,684 | nein | 10.09. Zufallswaffen-Bug geschlossen, Assets 30→40 |

**Durchschnitt ueber alle zwanzig (16.09., nach dem dreizehnten Nachtrag): 76 %** (rechnerisch
76,4 %, war 75 % nach dem zwoelften Nachtrag, 74 % nach dem elften Nachtrag, 72 % am 14.09. vor der
Merge-Welle, 65 % am 10.09. vor der Feinschliff-/Football-Runde). Je Achse: **Konzept 80 % ·
Assets 74 % · Gameplay 77 % · Movement 75 %.**

*Die Bewegung seit dem zwoelften Nachtrag (75 %→76 %) kommt ausschliesslich aus Time-Trial
(76 %→86 %) und Climbing (55 %→66 %, beide s. dreizehnter Nachtrag ganz oben), die uebrigen
achtzehn Zeilen sind ziffernidentisch. Gameplay bewegt sich am staerksten (74,55 %→76,7 %, allein
aus Climbings Gameplay-Sprung 49→92 — G1-Stufenwechsel plus G2 neu), Movement am zweitstaerksten
(73,25 %→75,0 %, allein aus Time-Trials Movement-Sprung 65→100 — M1 erstmals erfuellt). Konzept
bewegt sich nicht (79,5 %, unveraendert), Assets kaum (74,0 %→74,25 %, rundet weiterhin auf 74 %)
— bei beiden Zeilen war es diesmal die Gameplay-/Movement-Achse, nicht Konzept, die den Sprung
trug: Climbings K4 (Kalibrierpuffer bleibt unter dem Kaderrauschen) und Time-Trials bereits volle
Konzept-Zeile blieben beide bewusst unangetastet.*

*Die Bewegung seit dem elften Nachtrag (74 %→75 %) kommt ausschliesslich aus Fechten (64 %→91 %,
s. zwoelfter Nachtrag ganz oben), die uebrigen neunzehn Zeilen sind ziffernidentisch. Assets bewegt
sich am staerksten (72 %→74 %, allein aus Fechtens Assets 55→100), Movement am zweitstaerksten
(70 %→73 %, allein aus Fechtens Movement 35→100). Konzept und Gameplay bewegen sich nicht — bei
Fechten war es genau K4 und G1, die diese Runde bewusst unangetastet liess.*

*Die Bewegung von 14.09. auf den elften Nachtrag (72 %→74 %) kam aus sechs Zeilen (Spurt, Tennis,
Fechten, Climbing, Mini-DM nach oben; Football nach unten, s. elfter Nachtrag). Assets bewegte sich
damals am staerksten (70→72 %, vor allem Tennis 40→70), Movement am zweitstaerksten (66→70 %,
Tennis/Spurt/Climbing). Gameplay bewegte sich netto kaum (74→75 %): Spurts +30 Punkte
(Produktionsanschluss) und Footballs −13 Punkte (rho-Bruch durch #934) hoben sich fast auf.*

**Welle 0 (Fundament, gemergt 12.09., PR #892/#889/#891/#895): noch ohne eigene Punktewirkung.**
Vier PRs — Ton-Katalog-Daten fuer sechs Disziplinen, die generische `DISZIPLIN_PROP`-Requisiten-
Tabelle, ein leerer `bahnBewegung(dt)`-Dispatcher fuer die vier Bahn-Disziplinen, plus sechs kleine
Praesentationsfixes (Breaking/Eiskunstlauf/Takeshi) — legen nur die Fundamente fuer die naechste
Runde (Welle 1: Speed-Schach/Staffel/Football/Time-Trial/Spurt/Fechten-Ton, Eiskunstlauf/Staffel/
Takeshi-Requisiten). Keine Zeile oben aendert sich dadurch; sie werden erst in der Spalte "Letzte
Aenderung" sichtbar, sobald die jeweilige Ziel-Disziplin ihre Aufrufstellen bekommt.

Die Botschaft dieser vier Zahlen in einem Satz: **das Projekt hat mehr DESIGN als DARSTELLUNG.**
Konzept liegt neun Punkte ueber Assets und zwoelf ueber Movement — es ist ueberall durchdacht, was
passiert, und laengst nicht ueberall zu sehen. *(Der Abstand war bis zum 12.09. rund zwanzig
Punkte; die Darstellungs-Wellen der letzten Tage haben ihn halbiert, ohne ihn zu schliessen. Und
er sitzt fast ganz unten: bei den oberen elf Zeilen betraegt der Abstand Konzept−Movement noch
**6,7** Punkte (95,9 gegen 89,2), bei den unteren neun **18,9** (56,1 gegen 37,2).)*

### Die frisch gemessenen Zahlen (10.09.) gegen die eingecheckte Basislinie (06.09.)

Neunzehn von zwanzig Zeilen stimmen **ziffernidentisch** mit
`data/generated/rangtreue-basislinie.json`. Zwei Zeilen weichen ab, und beide waren im
Opus-Overseer-Briefing vom 09.09. (Abschnitt 4.1) bereits als **stale Basislinien-Eintraege**
vorhergesagt — dieser Lauf bestaetigt sie unabhaengig:

| Disziplin | Basislinie 06.09. | gemessen 10.09. | Ursache |
|---|---:|---:|---|
| Gewichtheben | 0,847 | **0,854** | seit 07.09. in `stand-aller-disziplinen.md` notiert, Basislinie nie nachgezogen |
| Eiskunstlauf | 0,875 | **0,885** | PR #859 (Duett) wurde NACH der Basislinienziehung gemergt |

Beide Abweichungen zeigen nach oben, weshalb die CI-Schranke (die nur Rueckgaenge faengt) sie nie
gemeldet hat. **Es gab am 10.09. keine Regression irgendwo im Feld.**

**Nachtrag 14.09. — die Basislinie ist jetzt an acht Stellen stale.** Der Messlauf auf `main`
@ `7a07de2f` gegen `data/generated/rangtreue-basislinie.json` (06.09.):

| Disziplin | Basislinie 06.09. | gemessen 14.09. | Ursache |
|---|---:|---:|---|
| Mini-DM | 0,094 | **0,256** | Formation/Zielwahl (PR #912) — Kaderrauschen 0,661, Richtung nicht lesbar |
| Takeshi's Castle | 0,861 | **0,879** | +0,022 Fallentyp (PR #909), −0,004 Puste (PR #914) |
| Staffel | 0,915 | **0,899** | Ausfuehrungsstreuung beim Wechsel (PR #916), gepaart reproduziert |
| Gewichtheben | 0,847 | **0,843** | Duellplanung (PR #907); n=48 liefert 0,851, Vorzeichen wechselt |
| Time-Trial | 0,828 | **0,825** | Startfolge im Wechsel (PR #908) und/oder Puste (PR #914), nicht trennbar |
| Climbing | 0,790 | **0,782** | Puste-Erholung am Griff (PR #914) |
| Battlefield | 0,387 | **0,251** | Formation/Zielwahl (PR #912) — Kaderrauschen 0,778 |
| TDM | 0,253 | **0,165** | Formation/Zielwahl (PR #912) — Kaderrauschen 0,272 |

**Nur ZWEI dieser acht Bewegungen sind belegbar**: Takeshi (+0,022, ueber der Spannweite 0,101)
und Staffel (−0,016, in #916 **gepaart** auf denselben Kadern und Saaten nachgemessen und bei
n=96 mit −0,018 reproduziert — der Spannweitenvergleich taugt dafuer nicht, weil er die Streuung
ZWISCHEN Kadern misst, nicht die Unsicherheit eines Vorher/Nachher-Paares). Die uebrigen sechs
liegen unter ihrem eigenen Kaderrauschen. **Keine der acht wechselt die G1-Stufe ausser
Gewichtheben**, das mit 0,843 von der 0,85er- in die 0,80er-Stufe faellt. `node
scripts/baue-rangtreue-basislinie.mjs 24` gehoert damit dringender denn je in den naechsten
Pflege-PR (s. 4.2).

---

## 2. Jede Disziplin einzeln

### Hockey — 93 % (100/100/72/100)
**13./14.09. Update: keine Achse bewegt, und das ist das Ergebnis, nicht die Unterlassung.**
Zwei PRs haben Hockey angefasst, beide ziffernidentisch in allen vier rho-Spalten (0,669 / 0,181 /
0,832 / 0,259 und 0,719 / 0,182 / 0,818 / 0,259 — am 14.09. auf `main` @ `7a07de2f` nachgemessen).
- **PR #910 (Praesentation):** die Kachelleiste `.kbar` trug in allen vier Chassis denselben
  Tooltip „N von M Leben" — bei dreien fuer etwas, das mit Leben nichts zu tun hat. Im Eishockey
  zeigte sie Tore, und gemessen standen **175 von 288 Kachelzeilen (60,8 %) das ganze Spiel auf
  null**. Ausserdem hat der Bodycheck ein eigenes Bild bekommen (dritte Float-Klasse `_wucht`,
  Text „BODYCHECK!"): er schrieb bisher buchstaeblich dasselbe Wort wie der abgefangene Pass.
  Nebenbefund, der Chris' Praemisse korrigiert — **Checks sind nicht zu selten**: 16,0 sitzende
  Bodychecks je Spiel sind 1,60 je Skater, die NHL 2024-25 lag bei rund 1,2. Sie waren unsichtbar.
- **PR #914 (Puste sichtbar, ohne Wirkung):** Vorrat aus AUSDAUER (50 bei 21, 127 bei 75),
  Bodycheck-Kosten fuer beide Seiten, Erholung auf der Strafbank und in der Drittelpause, Leiste
  am Spieler plus die Boxscore-Spalten `Pus`/`Tief`. Die **Wirkung** auf den Ausgang ist
  abgeschaltet (`tempoMin`/`wuchtMin`/`zweikampfMin` auf exakt 1), weil sie gemessen 0,669 → 0,616
  gekostet haette — und der Lauf mit auf ein Drittel abgeschwaechten Faktoren holte **nichts**
  zurueck (0,628). Die Einbusse haengt nicht an der Staerke der Faktoren, sondern daran, **dass**
  Positionen verschoben werden; das aendert, wie oft `versucheSteal()` faellt. Dazu ein
  Vorzeichenfehler im Entwurf: der Verbrauch haengt an der gelaufenen Strecke, und die korreliert
  mit LAUFTEMPO (0,852) — einem Attribut auf der EIGNUNGSSEITE. Hockey ist mit 0,669 die
  zweitschlechteste der zwanzig; eine Mechanik, die Spass macht und die Rangtreue der schwaechsten
  Disziplin weiter drueckt, kauft das Falsche mit dem Knappsten, was dieses Projekt hat.
Assets und Movement stehen bereits auf 100, Gameplay haengt allein an rho — **es gibt an dieser
Zeile nichts zu heben, solange rho nicht steigt.**
**12.09. Update:** Assets 80→100. Fable-Entscheidung E2 (PR #893) hat den letzten Assets-Ruecksand
geschlossen — neuer `TON_KATALOG.hockey`-Eintrag (schuss/treffer/pfiff/tor/publikum), verdrahtet an
den fuenf bestehenden Aufrufstellen (Abwurf, Bodycheck, Strafe, Torerfolg, Publikums-Loop mit dem
etablierten N1-Reset-Muster). Gameplay/Movement/Konzept unveraendert — s. urspruengliche Zeile unten.
**Konzept 100:** Torwart mit eigener Wertformel (`HK_TW_BASIS`/`HK_TW_REF`), Bodycheck, Strafen,
Ueberzahl, Passqualitaet, xG-Buchung (K3). Zwei eigene Fable-Dokumente plus ein NHL-Review
(`hockey-opus-review-nhl.md`).
**Assets 100:** `rink.tsx` (419 Z., 14 Animationsstellen), eigene Eisflaeche im Motor
(`:10128 eisflaeche()`), eigener Hockeyschlaeger als Sprite-Ebene (`zeichneHockeyschlaeger`, `:311`),
seit 12.09. eigener Ton (fuenf Ereignisse, s.o.).
**Gameplay 72:** rho 0,669 (alle zwoelf) / 0,719 (nur Feldspieler) — ausdruecklich von Chris
abgenommen, Aufgabe #20 geschlossen. Produktiviert mit eigener Torwart-PPS-Referenz.
**Movement 100:** eigene Torwartbogen-, Schuss- und Bandenzweikampf-Phasen (`:9553`).

### Basketball — 96 % (100/100/82/100)
**Konzept 100:** eigenes Rezept plus `BASKETBALL_POS_MOD` (`battle-mode.engine.js:5513`), Live-Motor
mit Zonen/Manndeckung/Spielzuegen, zwei eigene Fable-Dokumente
(`basketball-finalisierung-recherche-fable.md`, `basketball-doppeln-taktik-pause-recherche-06-09.md`)
und eine gemessene Kalibrierrunde (`basketball-k3.md`, 04.09.).
**Assets 100:** `court.tsx` (524 Z., 19 Animationsstellen), eigener Court im Motor, und als
**einzige der zwanzig** echter Ton — `public/sound/basketball/` mit sechs Dateien, angebunden
ueber `bkSfx()` (`:16059`) und den Publikums-Loop (`:16080`).
**Gameplay 82:** rho 0,769 — unter der 0,80-Schranke, von Chris fuer den Live-Betrieb abgenommen
(dieselbe Ausnahme wie Hockey, s. PM-Briefing 09.09. Abschnitt 0). Produktiviert, eigene
Boxscore-an-PPs-Kurve.
**Movement 100:** Dribbel-Bounce mit Bodenkontakt-Ton (`BK_DRIBBEL_PERIODE`), Wurfbahnen, Zonen —
plus `useTokenGlide`/`GhostLayer` in `court.tsx`.

### Gewichtheben — 98 % (100/100/90/100)
**14.09. Update: Gameplay 95→90, rho 0,854 → 0,843 (PR #907).** Der erste PR dieser Welle, der
Gewichtheben an der **Wettkampfmechanik** anfasst statt an der Praesentation. Chris: „gewichtheben
muss noch irgendwie mehr spannung haben ... müssten nicht beide die gleichen gewichte heben?" Die
Recherche (`gewichtheben-spannung-recherche-13-09.md`) sagt **nein** — im IWF-Wettkampf sagt jeder
Heber selbst an, die strategische Gewichtswahl IST der taktische Teil des Sports, und gleiche
Gewichte wuerden `ANSAGE` als ausgangswirksamen Sub-Skill loeschen. Gemessen (200 Spiele, 1200
Duelle) hatte Chris trotzdem recht: in **66,2 %** der Duelle lag die Eroeffnung des einen ueber dem
hoechsten Versuch, den der andere im ganzen Wettkampf ansagt. Zwei Massnahmen, beide mit ihrer
Nullstelle im ausgeglichenen Duell:
- **`HEBEN_DUELL_ZWEIKAMPF`** — `hebeUebung("stossen")` verglich im dritten Versuch **nur**
  `besteStossen` und las den fertigen Reiss-Ausgang nie. In beide Richtungen falsch: wer im Reissen
  10 kg verlor, zog im Stossen auf `Gegner+1` und verlor den Zweikampf um 9. Im Reissen ist der
  neue Ausdruck bit-identisch zum alten.
- **`HEBEN_DUELL_EROEFFNUNG_K`** — duellbewusste Eroeffnung bei **unveraendertem Zielgewicht**: der
  Eroeffnungsversatz wird durch Nachskalierung beider Spruenge exakt ausgeglichen
  (`sprungFaktor = √(anteilRein/anteil)`), dieselbe Decke, anderer Weg. Ohne das waere es ein
  Gratis-Buff, weil `ueber` in der Erfolgskurve null ist, solange die Ansage unter `risikoMax` liegt.

Ergebnis: Chris' Kernbeschwerde **66,2 % → 50,0 %**, Entscheidung erst im letzten Versuch
2,9 % → 5,7 %, und in engen Duellen gewinnt der nach Versuch 1 Fuehrende nur noch 49,0 % statt
56,3 %. Der IWF-Korridor haelt in allen Zeilen, die Saison-Validitaet **steigt** (0,923 → 0,930).

**Warum die Zeile trotzdem faellt — und warum das keine Regression behauptet.** Die
Einzelspielzahl bewegt sich um −0,011 bei n=24 und **+0,007 bei n=48**, gegen ein Kaderrauschen von
0,208: nach `messgrundlage-kaderfest.md` von null nicht zu unterscheiden. PR #907 hat die Scorecard
deshalb ausdruecklich **nicht** nachziehen wollen. Hier wird sie trotzdem nachgezogen, aus einem
anderen Grund: die rho-Spalte dieses Berichts ist eine **Messung auf dem heutigen `main`**, und die
liefert 0,843. Die G1-Regel in Abschnitt 0 ist eine **Stufenfunktion mit einer Kante bei 0,85** —
0,843 faellt damit von 40 auf 35 Punkte. **Das ist ein Artefakt der Kante, kein Befund ueber
Gewichtheben**, und wenn der naechste Lauf bei n=48 misst, steht die Zeile wieder auf 95.
**10.09. Update:** Assets 60→100 (PR #876, PRODUKTIONSCODE, Opus-Review FREIGEBEN). Hantel liegt
jetzt an per Pixelscan ausgemessenen Handpunkten (`HEBEN_HAND`, analog zu Hockeys Schlaeger),
eigene Hebebuehne, Ton verdrahtet.
**12.09. Update:** Movement 87→100 (PR #898, PRODUKTIONSCODE). M2 (die letzte offene
Movement-Luecke, Plan-Dokument Abschnitt 4.1) war eine reine Fortschrittsbalken-Pose ohne eigene
Zustandsmaschine — `stepHeben(dt,art)` ersetzt sie durch fuenf echte Zustaende
(warten/antritt/zug/hoch/ablage), der Antritt zur Hantel ist jetzt eine sichtbare Bewegung, die es
vorher gar nicht gab. Review-Fund B (Zeit-Budget) korrigiert: der Ueberkopf-Halt "hoch" behaelt
mit 0,44*rundenDauer (~2,7s) den groessten Anteil statt auf ein Viertel zusammenzuschrumpfen — sonst
haette die Aenderung Chris' eigenen 06.09-Fund ("sehr schnell und unuebersichtlich",
`ZEIT_DEHNUNG.gewichtheben=4`) wieder rueckgaengig gemacht. Konzept/Gameplay unveraendert.
**Konzept 100:** eigenes FUENF-Sub-Skill-Rezept statt der sieben Buehnen-Rollen
(`BUEHNE_ART.gewichtheben`, `:10598`), Reissen/Stossen, drei Versuche, Nullwertung, Ansage. Die
offene Architekturfrage („darf Charisma die physische Obergrenze beruehren?") ist am 04.09.
entschieden und gemessen (`HEBEN_TAGESMAX_ANSAGE_K`, rho 0,720 → 0,887).
**Assets 100:** eigenes Buehnenbild `zeichneHeben()`, eigene Hebebuehne, eigener Ton (PR #876).
Seit **PR #915 (14.09.)** haengt die Hantel nicht mehr an einer Faust und nicht mehr an absoluten
Zellwerten: `HEBEN_PHASEN` steht in **`anteil`** (Anteil der Koerperhoehe vom Scheitel), die
Koerperspanne kommt je Zeichenpfad aus der Quelle, die sie kennt (`blattSpanne()` misst das Blatt
statt es zu tabellieren). Vorher fehlte **5 von 17 Figuren** die Hantel ganz (die `vollbild`- und
`reiherMech`-Pfade kehrten mit `return` zurueck, bevor der Hantel-Block erreicht wurde), und bei
zwei weiteren lag die Ruhestange **unter den Fuessen** (Tidesprinter −1,5, Seraph-11 −2,0) bzw. die
Ueberkopfstange **im Kopf** (Lava Golem −3,0, Krolach −2,0). Fuer den Standardkoerper zeichnet die
neue Rechnung pixelgleich; sie wirkt nur auf Blaetter, deren Hoehe von 51 Zellen abweicht — also auf
alle ueber 65 Vollbild-Kreaturen, ohne dass eine davon je einzeln vermessen werden muss. Die
Assets-Zahl bleibt bei 100: A1–A4 waren alle vier schon erfuellt, **#915 repariert Qualitaet
innerhalb bereits gezaehlter Kriterien** (dasselbe Muster wie bei Takeshi/#909 unten).
**Gameplay 90:** rho **0,843** (14.09. gemessen, G1-Stufe 0,80–0,85), produktiviert,
Gesamt-kg-Tiebreak, eigene `WERTUNG_HEBEN`, seit PR #907 mit Zweikampf-Vergleich im dritten Versuch.
**Movement 100:** `stepHeben()` als dritter Zweig in `buehnenBewegung()` — echte
Fuenf-Zustands-Maschine (warten/antritt/zug/hoch/ablage) statt reinem Fortschrittsbalken, schreibt
ausschliesslich `u.vizPhase`/`u.vizPhaseT`, ruft nie `rr()` — derselbe Vertrag wie
`stepKuer`/`stepCypher`.

### Speed-Schach — 96 % (95/95/100/95)
**12.09. Update:** Konzept/Assets/Movement 80/75/80→95 (PR #902, PRODUKTIONSCODE, Opus-Review
FREIGEBEN). Alle drei Luecken auf einmal geschlossen — keine davon war Forschung.
**Konzept 95:** neues eigenstaendiges Fable-Recherche-Dokument
(`docs/design/speed-schach-fable-recherche-12-09.md`) — Blitzschach als Mannschaftsdisziplin
(FIDE-Schacholympiade, Bundesliga/4NCL, World Team Rapid & Blitz Championships 2026),
Brett-vs-Mannschaftspunkte, Zeitnot-Schwellenwert bei 10-30s Restzeit. Loest damit auch die K3-
Luecke, die bisher geteilt in `takeshi-schach-optik-gameplay-plan-05-09.md` Teil A und
`arena-duell-recherche-fable.md` Abschnitt 4 steckte.
**Assets 95:** `TON_KATALOG.speed-schach` (seit PR 0.1) jetzt verdrahtet (zug/schlag/uhr/matt/
Publikum, mit N1-Loop-Reset), dritter `DISZIPLIN_PROP`-Eintrag (Schachuhr an der Hand, per
Pixelscan gemessen, unabhaengig von der Review nachgemessen und bestaetigt).
**Gameplay 100:** rho **0,908** (zweitbeste im Feld), produktiviert, eigene `wertungTabelle`
mit „Brett"/„Stark"/„Zeit−" — unveraendert.
**Movement 95:** `stepSchach()` als vierter Zweig in `buehnenBewegung()` — Figuren gleiten am
Fokus-Brett statt zu springen, Schachuhr tickt exponentiell statt in Spruengen, Hand schlaegt
sichtbar auf den Knopf. Die Zugfolge selbst bleibt bewusst „eine plausible Zugfolge" (Kommentar
`:10788`), keine Schach-Engine — das war nie Teil des Auftrags.

### Eiskunstlauf — 96 % (95/100/95/94)
**NACHZUG 13.09. — Konzept 90→95, Assets 70→95 (PR #903).** Diese Zeile stand seit ihrer letzten
Pflege unveraendert auf 90/70 und ist erst jetzt, mit dem 14.09.-Nachzug, nachgezogen worden —
dieselbe Art Luecke wie Staffel im neunten Nachtrag. Nachgelesen, nicht aus dem Commit-Titel
uebernommen: `sfx("eiskunstlauf", …)` steht jetzt in `stepKuer()` (kufe/sprung/landung/sturz) und
`tonLoopStart("eiskunstlauf")` im Publikums-Loop (A4 0→20); `DISZIPLIN_PROP.eiskunstlauf` haengt
eine Kufe an einen neuen Fusspunkt (`FUSS_EISKUNSTLAUF`, per Pixelscan auf `cy=61` korrigiert) und
gibt jedem Paar eine Kostuemfarbe als Knoechelbund (A3 15→25); `eiskunstlauf-kalibrierung-10-09.md`
modelliert das Rezept strukturell gegen die ISU-Wertungslogik (TES/PCS-Trennung), ohne eine Zahl zu
aendern (K4). Die alte Assets-Zeile unten sagte bis heute „keine Schlittschuhe, kein Kostuem" —
das galt bis zum 13.09. und ist entsprechend ersetzt.
**14.09. Update: Assets 95→100 (PR #917).** Chris' Beschwerde („das sieht weird aus … man hat gar
keine indikation welche leute sich gerade besser schlagen") plus ein echter Bug (Sturz-Teleport)
haben eine konzeptionelle Ueberarbeitung ausgeloest, die **keine einzige Rezeptzahl anfasst** (rho
bit-identisch, s.u.) und ausschliesslich die letzte offene Assets-Luecke schliesst: `bauBuehne()`
baut die Warteschlange fuer `art.duett` jetzt **gruppenweise** statt rundenweise (schwaechstes Paar
zuerst, wie im echten ISU-Wettkampf), die Bahn teilt sich in drei Zonen — `kuerBahn()` (das
laufende Paar, volle Groesse), `kuerWarte()` (Startbereich, gedimmt, Startnummer) und `kuerKiss()`
(Kiss-and-Cry, das eben fertige Paar mit Bank und Endpunktzahl) — und eine neue Zwischenstand-Tafel
`zeichneEisStand()` zeigt Fuehrenden, laufendes Paar und Elementkaesten (gruen/rot/grau), nach dem
Vorbild von Speed-Schachs Brett und Breakings Seitentafeln. Das vervollstaendigt A2 (eigene Szene
ueber das geteilte Chassis-Bild hinaus): vorher gab es nur die eine Duett-Paarung auf einer Flaeche,
jetzt drei benannte Zonen plus eine eigene Ergebnistafel. Nebenbei behoben, ohne Punktewirkung: der
Sturz-Teleport (`stepKuer` sprang beim Aufstehen bis zu 78 px in einem Bild, weil der Zielpunkt an
der globalen Buehnenuhr statt an einer eigenen Paar-Uhr haengte — jetzt `u.vizBahnT`, ein
gedeckelter Schritt bleibt als Sicherheitsnetz) und die HUD-Ueberlappung (`kuerFlaeche()` bleibt
das Eis, die Bewegung laeuft auf der neuen, engeren `kuerBahn()`, damit Etiketten nicht mehr auf
der Unterkante des Broadcast-Bugs landen). Beides ist eine Korrektur innerhalb bereits gezaehlter
Kriterien (M2/M3), keine neue.
**Konzept 95:** `duett:true` (automatische Paarung bei gerader Feldgroesse, PR #859), `rundenN` an
der realen ISU-Programmlaenge (12 statt 6, Spearman-Brown-Runde vom 07.09., gemessen 0,792 → 0,875),
K4 seit PR #903 strukturell kalibriert gegen die ISU-Wertungslogik. Drei eigene Dokumente
(`eiskunstlauf-duett-paarlauf-recherche-08-09.md`, `eiskunstlauf-kalibrierung-10-09.md`,
`eiskunstlauf-startreihenfolge-spotlight-recherche-13-09.md`).
**Assets 100:** `eiskunst.tsx` (599 Z.), `zeichneDuett()` (Paare + Eisspur), eigene Kufe am
Fusspunkt mit Paar-Kostuemfarbe (PR #903), eigener Ton an vier Aufrufstellen (PR #903), seit PR
#917 drei benannte Zonen (Kuerbahn/Startbereich/Kiss-and-Cry) plus eigene Live-Standings-Tafel
`zeichneEisStand()`. Die Waffenebene ist korrekt entfernt (`:2574`).
**Gameplay 95:** rho **0,885** (14.09. erneut frisch gemessen, bit-identisch vor und nach PR #917),
produktiviert.
**Movement 94:** echte Kuer-Bewegungsmaschine (`stepKuer`) statt Reihenbild — Laeufer gleiten
sichtbar ueber das Eis, Kufenspur folgt korrekt (inkl. Pause waehrend `haeltStelle`), seit PR #917
mit gedeckelter Paar-Uhr statt globaler Buehnenuhr (kein Sturz-Teleport mehr) und Ein-/Auslaufen in
die Kiss-and-Cry-Zone ueber denselben gedeckelten Schritt. Bleibt bei 94, weil die eigentliche Luecke
(echte Hebefigur-Pose, s. 3.6) unangetastet ist — die Bewegungsaenderungen dieser Runde reparieren
eine bereits gezaehlte Achse, sie eroeffnen keine neue.

### Takeshi's Castle — 97 % (100/95/97/95)
**10.09. Update:** Assets 60→95, Gameplay 67→97 (PR #880 Bahn-Produktivierung, Opus-Review
FREIGEBEN; PR #883 Ton-Verdrahtung). `takeshi.tsx` waechst von 273 auf 517 Zeilen / 3 auf 14
Animationsstellen; Ton (A4 0→20) ueber vier Aufrufstellen plus Loop-Start/-Stop/-Reset, Leck-Test
in den vier Geschwister-Bahnen bestanden. 12.09.: PR #895 (Kleinbefund #5/#6) tauscht den
Ausscheiden-Klang von "tor" auf "platsch" (semantisch richtig) und drosselt Falle/Sturz/Tor auf
0,12s — Politur, keine Punktaenderung.
**12.09. Update:** Movement 85→95 (PR #900, PRODUKTIONSCODE). M2 (Laeufer-Zustandsmaschine) und
M4 (drei Posen) waren die letzten offenen Movement-Luecken (Plan-Dokument Abschnitt 4.3):
`stepParcours(dt,art)` gibt dem Laeufer selbst eine Zustandsmaschine (laufen → fallenkontakt →
sturz/aufrappeln → laufen) statt nur der Falle, dazu Sprungbogen/Duck-Scale/Taumeln je nach
Fallentyp. Unabhaengige Review fand drei blockierende Befunde, alle behoben: der geschaetzte
Startnummernband-Ankerpunkt sass 5-7px zu tief (per echtem Pixelscan korrigiert, Beweisbild
`docs/design/sprite-armpunkte-beweis-takeshi.png`), fehlende Z-Skalierung liess das Band 5-10px je
nach Laeufergroesse driften (jetzt dieselbe `x-32*Z+cx*Z`-Formel wie `HOCKEY_HAND`/`HEBEN_HAND`),
und das Feld hiess `arm` statt des vom `DISZIPLIN_PROP`-Vertrag vorgeschriebenen `hand`
(umbenannt zu `TAKESHI_HAND`).
**Konzept 100:** die inhaltlich reichste Disziplin des Projekts — Ausscheiden nach drei Stuerzen,
vierzehn Fallen in fuenf Typen mit eigener Stufe (`fallenStufe`), drei benannte Kurse,
Chaos/Tackle-Fenster, Gedraenge, Burgpunkte als echte Wertung. Vier eigene Dokumente
(`takeshi-animationen-hilfe-behinderung-recherche-06-09.md`, `takeshi-chaos-tackle-plan-06-09.md`,
`takeshi-schlammroute-plan-06-09.md`, `takeshi-schach-optik-gameplay-plan-05-09.md`).
**Assets 95:** `bodenTakeshiRoute()` (Schlangenroute mit fuenf Gelaendezonen, Tuempeln, Burgmauer
und Tor), `zeichneFalleTakeshi()` (zehn Fallenbilder), `takeshi.tsx` jetzt 517 Zeilen/14
Animationsstellen (PR #880), eigener Ton (PR #883).
**13.09. Update:** der TYP der Falle entscheidet den Sauber-Wurf mit (`fallenKoennen`) — Hindernis-
und Streckentempo werden getrennt, rho je Spiel **0,861 → 0,883**, Saison 0,930 → 0,951
(Fable-Recherche `takeshi-hindernis-vs-strecke-recherche-13-09.md`). Die vier Prozentachsen bleiben
unveraendert: die Aenderung schaerft eine Mechanik, die im Audit schon als vorhanden gezaehlt war.
**14.09. Update:** die Puste-Erholung der Bahn-Welle (PR #914) wirkt hier wirklich — Takeshi ist
neben Climbing die einzige Bahn, auf der Laeufer an Hindernissen stehen und die Gutschrift feuert:
**21,4 % → 12,5 %** bleiben leer, **11,1 %** fangen sich wieder. Neu ist nur eine dritte Spalte an
der bestehenden Tabelle (`pusteHindernis`, WUCHT 0,30 bis WENDIGKEIT 0,05), **bewusst keine zweite
Taxonomie** neben `hindernisTypen`/`fallenStufe`. Kosten: rho 0,883 → **0,879** (Spannweite 0,101).
Keine Achse bewegt sich — die Mechanik zaehlt in K2 bereits als vorhanden.
**Gameplay 97:** rho **0,879** (14.09. gemessen), eigene Burgpunkte-Wertung, seit PR #880
produktionsangeschlossen.
**Movement 95:** `stepParcours()` als eigener Zweig im Bahn-Bewegungspfad — Laeufer-Zustandsmaschine
(laufen/fallenkontakt/sturz/aufrappeln) plus drei sichtbare Posen (Sprungbogen/Duck-Scale/Taumeln),
Startnummernband per Pixelscan verankert und Z-skaliert.
**Korrektur 14.09.:** hier stand bis heute „Noch nicht produktionsangeschlossen (kein Eintrag in
`ARENA_RESOLVED_DISCIPLINE_IDS`)" — im direkten Widerspruch zur Gameplay-Zeile darueber.
Nachgelesen: `takeshis-castle` steht dort seit der Bahn-Produktivierung
(`lib/resolve/battle-mode-arena-team-points.ts:251`). Die Gameplay-Zeile hatte recht, dieser Satz
nicht; die Arena-Spalte in der Tabelle oben ist entsprechend auf „ja" korrigiert.

### Breaking — 97 % (95/100/95/96)
**10.09. Update:** Assets 65→100, Movement 55→92 (PR #875, PRODUKTIONSCODE, Opus-Review FREIGEBEN
MIT NACHTRAG). Echter Cypher mit Move-Mechanik ersetzt die rein zeichnerische Kulisse. 12.09.: PR
#895 (Kleinbefund #3/#4) korrigiert die Freeze-/Rueckzug-Fade-Divisoren (rissen bei halber
Deckkraft ab) und glaettet den Ringwinkel bei Rangwechseln — Politur, keine Punktaenderung.
**12.09. Update:** Konzept 85→95 (PR #897, reines Dokument, kein Codechange). K4 ("Rezept
nachweislich kalibriert, offene Designfragen entschieden") war die letzte offene Konzept-Luecke.
Neues Dokument `docs/design/breaking-kalibrierung-10-09.md` kalibriert gegen echte WDSF-Daten: die
Rundenzahl (`rundenN:8`) passt zur realen Battle-Struktur (2-3 Throwdowns a ~5 Teile), zwei
Rezept-Hypothesen (`rundenN`8→12, `failAbzug`0,55→0,35) wurden gemessen und bewegen beide weniger
als Breakings Kader-Spannweite (0,114) — eine sogar in die falsche Richtung — also blieb der Code
unveraendert. Charisma-Gewicht 0 bestaetigt sich gegen die tatsaechlichen fuenf WDSF-Kriterien.
**14.09. Update: Movement 92→96 (PR #913).** Chris: „entweder zeigst du immer nur 2 charaktere
gegeneinander die miteinander interagieren … so ist das weird wenn alle im kreis stehen in der
mitte kurz rein ploppen". Die Mechanik war nie das Problem — `stepCypher()` markiert seit #875
genau einen Aktiven je Zug und `buehneQueue` wechselt bereits rundenweise zwischen den Seiten
(Konzept/Gameplay bleiben unangetastet, rho bit-identisch, s.u.) — nur zu sehen war das nicht:
zwoelf gleichrangige Figuren standen gleich gross und gleich hell im Ring, ohne dass irgendwer
irgendwem sichtbar gegenueberstand. Neu: **zwei Raenge statt zwoelf gleicher** — die zehn
Unbeteiligten treten (Faktor 0,72, kein Namensschild, per Vignette abgedunkelt) hinter das Paar
zurueck, das sich auf der Waagrechten durch das Zentrum gegenuebersteht (Heim 180°, Gast 0°); der
Peiniger rueckt sichtbar nach, waehrend der Ertragende ausharrt (Radiusfaktor 0,62→0,33), und weicht
danach zurueck — eine **Druckachse** aus drei pulsierenden Winkeln zeigt, wer hier gerade wem
zusetzt. Dazu, unabhaengig gefunden und behoben: drei echte Breakdance-Ueberreste trotz
Folter-Survival-Konzept — eine volle Windmill-Rotation bei `vizMove===2` (jetzt „Aufbaeumen": eine
begrenzte Kippung, **keine** volle Rotation), die vier Posen hiessen intern Toprock/Footwork/
Powermove/Freeze (jetzt Standhalten/Zusammenkruemmen/Aufbaeumen/Steingesicht) und der Ticker sagte
„setzt den Move"/„Move bricht ab" (jetzt „haelt stand"/„bricht ein", ausschliesslich ueber
`art.erfolgWort`/`art.failWort` gelesen, kein Stringvergleich). Das ist eine Korrektur, keine neue
Achse — die vier Posen waren als eigene Bewegungs-Zustaende schon vorher gezaehlt, nur mit der
falschen Sport-Flagge beschriftet. Die **Folterbank** mit zehn eskalierenden Geraeten (Strick bis
Vorschlaghammer, Chris' eigene Idee, `folterStufe()` auf die Durchgangszahl gespreizt) ist ein
echtes neues Requisit am Sprite — sie landet in A3, das bereits vor dieser PR bei 100 stand, und
hebt Assets deshalb nicht weiter an. Nach Review nachgebessert: Breakdance-Reste auch in den
SICHTBAREN Slot-Beschreibungen gefunden (`matchday-slot-roles.ts` + `battle-mode.engine.js`,
„Move"→„Hieb", „Rhythmus"→„Ruhe"), eine falsche „keine Asset-Pipeline"-Behauptung korrigiert (der
Motor laedt sehr wohl PNG-Kacheln, `zeichneFalleTakeshi()` ist Hauptabnehmer — die Folterbank bleibt
trotzdem Handzeichnung, aus Einfachheit, nicht aus Mangel), PEINIGT/FUEGT ZU auf ein Wort
vereinheitlicht. **Warum nicht mehr als 96:** der Gang zum Tisch bleibt unanimiert (der leere,
golden markierte Platz erzaehlt „das naechste Geraet", kein Laufweg — s. 3.6), und die Rollenrichtung
(Ertragender im Spotlight statt Peiniger) ist von der PR selbst als „begruendet, aber nicht
unumstoesslich" markiert.
**Konzept 95:** eigenes Torment/Will-Rezept ohne Charisma, mit gemessener NACHGEZOGEN-Korrektur
(`:10744`), `rundenN` 4 → 8 an der realen WDSF-Bewertung, gegen echte Sportdaten kalibriert (s.o.).
Drei eigene Fable-/Design-Dokumente (`breaking-folter-survival-visuelle-identitaet-recherche-08-09.md`,
`breaking-kalibrierung-10-09.md`, `breaking-folter-zweikampf-praesentation-13-09.md`).
**Assets 100:** `zeichneBreaking()` (lila Cypher mit vier Ringzonen und SURVIVOR-Spotlight),
`breaking.tsx` seit PR #875 deutlich gewachsen, seit PR #913 eine Folterbank mit zehn eskalierenden
Geraeten am Sprite und zwei Seitentafeln (wer gegen wen, mit Rolle) als eigenes Erkennungszeichen —
beides Qualitaet innerhalb bereits voller Kriterien, der Deckel bleibt 100.
**Gameplay 95:** rho **0,869 / 0,114 / 0,951 / 0,168** (14.09. erneut frisch gemessen,
bit-identisch vor und nach PR #913), produktiviert (Welle 2).
**Movement 96:** echte Move-Mechanik (`stepCypher`, PR #875) statt reiner Zeichenkulisse — seit
PR #913 als klares 1v1 (Ertragender im Spotlight, Peiniger mit Folterbank) statt zwoelf
gleichrangiger Figuren, mit Naeher-/Zurueckweichen und Druckachse; die vier Bewegungs-Zustaende
sind jetzt disziplineigen benannt und animiert (Standhalten/Zusammenkruemmen/Aufbaeumen/
Steingesicht) statt Breakdance-Posen zu tragen. Offen bleibt der unanimierte Gang zum Tisch (3.6).

### Staffel — 96 % (95/95/97/95)
**NACHZUG 13.09. — Assets 55→95, Movement 70→95 (PR #901).** Diese Zeile war bei ihrer letzten
Pflege am 12.09. bereits ueberholt und ist nie nachgezogen worden: PR #901 („Stab + fliegende
Uebergabe + Ton", Ziel 6 des Opus-Plans) hat A3 und A4 geschlossen. Nachgelesen, nicht aus dem
Commit-Titel uebernommen: `zeichneStab()` und `DISZIPLIN_PROP.staffel` stehen in
`battle-mode.engine.js:2530/2616` (Handpunkt = `HOCKEY_HAND`, weil ein laufender Staffellaeufer in
`zeichneSpurt()` immer `vx:4/richtung 3` bekommt — exakt die Pose, fuer die `HOCKEY_HAND` schon
per Pixelscan vermessen ist), und `TON_KATALOG.staffel` ist an **vier** Stellen verdrahtet.
Die Assets-Zeile unten sagte bis heute „**Kein Staffelstab-Sprite** — der Stab ist Mechanik, kein
Bild". Das galt bis zum 12.09. und ist entsprechend ersetzt.

**14.09. Update: rho 0,915 → 0,899 (PR #916).** Chris hat das erste Live-Rennen gesehen und fuenf
Dinge gemeldet; drei davon waren echte Fehler.
- **Die Bahn war keine Bahn.** Alle Bahngrenzen waren konzentrische Ellipsen mit demselben
  `OVAL_RX` — das ist keine Parallelkurve: an den Scheiteln fiel der Bahnabstand auf **null**.
  Jetzt die echte Stadionform (zwei Geraden 84,39 m, Innenradius 36,5 m, Bahnbreite 1,22 m, World
  Athletics *Track and Field Facilities Manual 2019*), y um 0,57 gestaucht — die Verkuerzung einer
  erhoehten Kamera, nicht eine erfundene Proportion. Boden und Laeufer teilen sich jetzt **eine**
  Kurvendefinition statt zweier Formeln, die nur zufaellig dieselbe Ellipse trafen.
- **„Staendig ueberrundet" war ein Anzeigefehler** — es wurde nie ueberrundet. Der Winkel kam aus
  dem Fortschritt **im eigenen Abschnitt**, und der faellt bei jedem Wechsel auf 0. Weil die
  Uebergabe genau auf der Ziellinie lag, sprang der Fuehrende bei **jedem** Wechsel sichtbar hinter
  den Verfolger. Jetzt aus dem Gesamtfortschritt: **wer vorne laeuft, fuehrt.**
- **Die Zeiten.** Die Rennuhr rechnete laengst richtig, **jede andere** Zeitangabe gab rohe
  Simulationssekunden aus. Bei `ZEIT_DEHNUNG.staffel = 14,65` stand eine Etappe als `1.8 s` da, die
  der Zuschauer 25,7 Sekunden lang sieht. Jetzt ueber dieselbe Umrechnung wie das Zeitfahren
  (`bahnSpanneAnzeige`/`bahnZeitText`), inklusive Locale — **alle fuenf Bahnen schreiben Zeiten
  jetzt gleich.**
- **„Sehr sehr statisch" war schlimmer als gemeldet.** Ueber 200 Saaten waren die Wechselverluste
  **zeichengleich identisch**: `verlust` hatte keinen Zufallsanteil, und der Patzer feuerte nie
  (seine Chance wird bei ueblichen Werten negativ und faellt auf den Boden 0,01 — gemeint waren
  4,5 %). Neu: dreiecksfoermige Ausfuehrungsstreuung, deren **Breite das Koennen einengt**
  (die Rangtreue bleibt damit am TECHNIK-Wert haengen), Patzerboden 4,5 %, Patzerkosten 0,9 → 0,34
  Sim-s — haeufiger und kleiner statt selten und erschlagend. Verschiedene Rennausgaenge je 200
  Saaten: **27 → 72.**

**Was das kostet, und warum es bezahlbar ist.** rho 0,915 → **0,899**. Das ist die einzige
Bewegung dieser Merge-Welle, die als **systematisch** nachgewiesen ist statt als Kaderrauschen:
gepaart auf denselben Kadern und Saaten gemessen, −0,016 bei n=24 und −0,018 bei n=96, auf zwei
verschiedenen `main`-Staenden gleich. Sie liegt 0,099 ueber der Schranke und 0,049 ueber der
Zielmarke, die Saison-Validitaet bleibt bei 0,951. G1 bleibt damit auf 40, Gameplay auf 97.
**10.09. Update:** Gameplay 67→97 (PR #880, PRODUKTIONSCODE, Opus-Review FREIGEBEN). Bahn-Chassis
ist jetzt produktionsangeschlossen (G2 0→30).
**Konzept 95:** die einzige Bahn, auf der nicht alle gleichzeitig laufen — sechs Abschnitte, fuenf
Wechsel, Wechselzeit als eigene Groesse (`wechselBasis`/`wechselSpanne`/`wechselStrafe`),
Windschatten bewusst AUS mit gemessener Begruendung. Drei eigene Dokumente
(`staffel-modellierung-recherche-05-09.md`, `staffel-oval-broadcast-hud-recherche-06-09.md`,
`bahn-disziplinen-recherche-fable.md` Abschnitt 1).
**Assets 95:** echte Stadionbahn mit Randstein, abgesetztem Innenfeld, karierter Ziellinie und
Wechselzonen-Dreiecken (PR #916), `track.tsx` (321 Z., 13 Animationsstellen), Staffelstab-Sprite
(`zeichneStab`) und `TON_KATALOG.staffel` an vier Aufrufstellen (PR #901).
**Gameplay 97:** rho **0,899 — nach Speed-Schach die zweitbeste Rangtreue im Feld.** Eigene
Etappenwertung (`bahnTeamstand()` `wertung:"etappe"`, `:15794`), produktionsangeschlossen seit
PR #880.
**Movement 95:** fliegende Uebergabe mit sichtbarem Stab (PR #901); wartende Laeufer stehen auf
**zwei** Wechselzonen im Innenfeld statt als Namensbrei an der Ziellinie — und die Auffaecherung
feuert seit PR #916 wirklich: sie war vorher an `Math.abs(o.pos - u.pos) < 1e-6` gehaengt, einem
Praedikat, das **nie zutrifft** (Wartende derselben Zone unterscheiden sich um ganze Runden,
nicht um null). Nachgemessen standen dadurch drei Figuren exakt aufeinander; jetzt 17,1 px
Abstand, kein Paar naeher als 12 px.

### Football — 76 % (90/75/52/85)
**16.09.-Nachzug: Gameplay 65→52, rho 0,800→0,722.** Zwei PRs, gegenlaeufig. PR #924
(Korridor-Refit Runde 2, 14.09.) erfuellt die Auflage aus der #884-Freigabe — Completion 65,8 %,
Yards/Attempt 7,22, Yards/Carry 4,28, Interception 2,5 %, NFL-nah — und hebt rho **0,800→0,813**,
sauber ueber der Schranke. **Danach** setzt PR #934 (E3, „eine Wahrheit" fuer Footballs
Gewichtsquelle: Kaderbildschirm-Anzeige, KI-Kauf und Minispiel-Rezept lesen jetzt denselben Wert
statt zweier divergenter Skalen, `lib/player-generator/spiel-eignung-overrides.ts`) genau den Fund
um, den `p.d`-Luecken-Fix schon bei Hockey/Basketball/Buehne/Bahn erledigt hatte — und foerdert
dabei eine strukturelle Kopplung zutage: die matrix-treuen Slot-Rollen-Texte boosteten bislang
ueberwiegend spirit/charisma/will, Attribute, die Rezept C (PR #884/#924) fuer KEINEN einzigen
Sub-Skill verwendet. Mit dem Override zeigen die Slot-Rollen jetzt korrekt auf
power/health/speed/torment/…, und die Slot-ZUWEISUNG speist damit zum ersten Mal wirklich in die
Ereignis-Berechnung ein — kaderfest gemessen faellt rho auf **0,722** (Saison 0,832), unter die
0,80-Schranke, G1 von der 0,80–0,85- auf die 0,70–0,80-Stufe, Gameplay 65→52. PR #933 hat die
Football-PPS-Referenz bereits gezogen (`scripts/ziehe-football-pps-referenz.ts`,
`data/generated/football-pps-referenz.json`) und einen `ARENA_IMPACT_KONFIG_JE_DISZIPLIN`-Eintrag
vorbereitet — die Produktivschaltung selbst (Eintrag in `ARENA_RESOLVED_DISCIPLINE_IDS`) ist von
derselben PR bewusst zurueckgestellt, bis eine dedizierte Balance-Runde rho wieder ueber 0,80
bringt (Plan: `docs/design/football-balance-runde-nach-e3-15-09.md`, PR #937 — zwei Ansatzpunkte
kaderfest gemessen, „breit statt eng"-Verteilung plus moderate Skalenreduktion bringt rho
reproduzierbar auf 0,79–0,82, noch keine Umsetzungsrunde). Konzept/Assets/Movement unangetastet.
**10.09. Update: Gameplay 35→65.** PR #884 (PRODUKTIONSCODE, Opus-Review) hat Rezept Runde 1
gebaut — `fkLos`/kappa 3, Rezept C, eigene Tackle-Zeile. rho **0,516 → 0,800**, genau auf der
Schranke (0,80–0,85-Stufe → G1 35). Kein Produktionsanschluss (G2 bleibt 0).
**12.09. — E3 in Pruefung, NICHT gemergt:** Fable-Entscheidung E3 (PR #894, Draft) zieht die
Anzeige-/KI-Kauf-Seite auf dieselben Gewichte wie das Minispiel (Override-Tabelle statt
Matrix-Aenderung, s. `lib/player-generator/spiel-eignung-overrides.ts`). Gemessener Nebeneffekt
(F2, im Plan vorab benannt): rho faellt dabei auf **0,714 (n=24) / 0,724 (n=48)** — G1 wieder auf 22,
Gesamt 79→71. **Wartet auf Chris' explizite Bestaetigung im Chat**, bevor gemergt wird — die Zeile
oben zeigt den AKTUELLEN, gemergten Stand (0,800), nicht den Stand nach E3.
**Konzept 90:** Downs, Line of Scrimmage, echte Formationen, Playcall, eigener `spielEignung`-Block
neben der gesperrten Matrix (PR #803). Kalibriert gegen echte NFL-2024-Quoten
(`football-rezept-kalibrierung.md`). K4 nur teilweise: Anzeige/Teamstaerke/KI-Kauf ordnen Football
weiterhin nach der ALTEN Matrix, das Minispiel nach der neuen — genau die Frage, die E3 loesen soll.
**Assets 75:** eigene Ausruestung (Helme/Montur, `footballGear`, `:2593`), Endzonen und Line of
Scrimmage im geteilten Feldspielbild (`:10089`), `football.tsx` (348 Z.).
**Gameplay 65:** rho **0,800** (PR #884), genau auf der Schranke. Kein Produktionsanschluss;
dient im Testcode weiterhin als benannte Kontrolldisziplin (`D2_KONTROLL_DISZIPLIN = "football"`).
**Movement 85:** Snap-Standphase plus fuenf visuell unterschiedene Spielzugtypen mit je eigener
Ballflugbahn — laut eigenem Bericht strukturell fertig, aber noch nicht poliert.

### Spurt — 83 % (95/55/97/85)
**16.09.-Nachzug: Gameplay 67→97, Movement 60→85 (PR #926, 14.09.).** Fund F1 (Opus-Review PR
#881): `BAHN_ART.spurt.jeSeite` stand auf 4, waehrend die Saison fuer jede Disziplin gleichverteilt
2..6 Laeufer je Seite wuerfelt — die einzige der vier Bahnen mit dieser Diskrepanz, gemessen an
allen 64 Fixtures des echten Spielstands zu klein besetzten Boxscores und in 4 von 64 Faellen
4-gegen-2 statt 4-gegen-4. Fix: `jeSeite` 4→6, dieselbe Feldgroesse wie Staffel/Takeshi/Time-Trial.
rho **0,871→0,894** (≥0,85-Stufe, G1 bleibt 40) — aber Spurt steht seither auch in
`ARENA_RESOLVED_DISCIPLINE_IDS`/`ARENA_BAHN_DISCIPLINE_IDS`, **G2 30 neu**, Gameplay 67→97. Spurt
ist damit die 14. arena-resolved Disziplin. Teil B derselben PR ergaenzt `stepHuerden()` — Spurt
war die letzte der fuenf Bahn-Disziplinen ganz ohne eigene Bewegungspose, die globale Sprite-Uhr
`t` ist auf der Bahn immer eingefroren (s. Time-Trial-Kommentar), Laeufer standen animatorisch
still waehrend der Bewegung. Jetzt per `u.vizSchritt` (1:1 aus `stepZeitfahren()` uebertragen,
rein praesentational, rho-neutral) — M2 (eigene Schrittlogik) erstmals erfuellt, Movement 60→85.
Konzept/Assets unangetastet.
**Konzept 95:** Hindernislauf mit stetigem Zeitpreis je Station statt Ermuedungssprint
(`hindernisTypen`, `huerdePreis`, `wuchtPreisFaktor`), feste Stationsfolge aus Paket B. **Zwei**
gemessene Nachziehungen (rho 0,652 → 0,857 → 0,871, Dexterity-Einfluss 3,5 % → 16,7 %). Eigene
Dokumente (`spurt-modellierung-recherche-05-09.md`, `spurt-offene-fragen-plus-optik-plan-05-09.md`).
**Assets 55:** `hindernisBilder` gibt jeder der sieben Stationen ein eigenes Bild (Huerde, Balken,
Wand, Seil, Wasser, Mauer, Heu) plus ein brennendes Ziel (`feuerZiel`) — die einzige Bahn mit
Bild-je-Station. `bump.tsx` (394 Z., 12 Animationsstellen).
**Gameplay 67:** rho **0,871** (14.09. ziffernidentisch nachgemessen), Rangwertung. Kein
Produktionsanschluss.
**Movement 60:** eigene Schrittlogik mit Hindernis-Stopp, Rempler, Windschatten, drei Rennplaenen —
aber kein eigener Zeichenzweig, alles laeuft durch `bodenSpurt()`.
**14.09.:** die Puste-Erholung der Bahn-Welle (PR #914) ist eingeschaltet, feuert hier aber
praktisch nicht — ueber die kurze Distanz laeuft das Feld durchgehend auf Plantempo und bricht nur
zu 5,5 % ein; erholt wird nur am Hindernis, waehrend des Einbruchs und unter Plantempo. rho
ziffernidentisch. Die **eingefrorene Sprite-Animation** (s. Time-Trial oben) galt fuer Spurt bis
zum 14.09.: PR #908 hatte nur `stepZeitfahren()` repariert, die uebrigen vier Bahnen brauchten
denselben Handgriff in ihrer eigenen step-Funktion — das war der billigste offene Movement-Posten
der Bahn. **Behoben mit PR #926 Teil B (s. 16.09.-Nachzug oben):** `stepHuerden()` liefert jetzt
`u.vizSchritt` nach demselben Muster, Movement 60→85.

### Time-Trial — 86 % (95/55/92/100)
**16.09.-Nachzug: Assets 50→55, Movement 65→100 (PR #948).** Reine Praesentation, rho bit-identisch
**0,825** (`node scripts/miss-alle-disziplinen.mjs 24 time-trial`, `gelaendeFaktor()`/
`gelaendeZehrFaktor()`/`wert()`/die Rennlogik ausdruecklich unangetastet, laut PR-Dokument nur
gelesen). Zwei Aenderungen, eine gemeinsame Wurzel:
- **`bodenZeitfahren()`** (`public/mockups/battle-mode.engine.js:21320`, exklusiv ueber dieselbe
  Weiche wie `bodenSpurtOval()`/`bodenTakeshiRoute()` in `bodenSpurt()` (`:21053`) angeschlossen —
  der bisherige Funktionskoerper wandert unveraendert in eine neue `bodenSpurtGerade()` (`:21086`),
  fuer die anderen vier Bahnen bit-identisch). Zeichnet die sieben `gelaende`-Zonen erstmals selbst:
  eine transluzente Terrain-Toenung mit Schraegschraffur (Steigung rot-braun, Abfahrt blau, Kurve
  gelb-Kreuzschraffur) plus Formglyphe (▲/▼/„S") direkt auf der Bahn, dazu eine echte
  Huegelsilhouette ueber der Baumreihe, die an der Steigungs-/Abfahrtsgrenze ihren Scheitel hat.
  Schliesst genau die zuvor benannte Hauptluecke „man sieht keinen Berg" (per Playwright bestaetigt:
  ein echter dreieckiger Huegel ist sichtbar, die anderen vier Bahnen zeigen weiterhin keine Spur
  davon). **A2 (eigene Szene) war seit PR #908 nur auf einer Teilstufe** (Startrampe/Ausdauer-
  Leiste/HUD, ohne das Streckenprofil selbst) — jetzt vollstaendig erfuellt, Assets 50→55.
  **Dieselbe Funktion erfuellt zugleich M1** (eigene Zeichenfunktion/-zweig statt der generischen
  Chassis-Darstellung) — dieselbe Zwei-Achsen-Unterscheidung wie bei Fechtens `zeichneFechten()`
  im zwoelften Nachtrag: Assets fragt nach der Szene, Movement nach der Zeichenfunktion selbst. Die
  Weiche in `bodenSpurt()` ruft fuer Zeitfahren `bodenZeitfahren()` **statt** des generischen
  `bodenSpurtGerade()`-Pfads auf, den Spurt/Staffel/Climbing/Takeshi weiterhin nutzen. M1 stand
  bisher ausdruecklich bei 0 ("M1 bleibt offen", s. Stand vor dieser Runde unten) — **+35 Punkte,
  Movement 65→100.**
- **`u.vizNeigung`** (neues Feld in `stepZeitfahren()`, `:24629`) plus `zfTilt`/`zfHaltung` in
  `zeichneSpurt()` (`:24804-24808`, gegated auf `BA().zeitfahren`, fuer jede andere Bahn bleibt der
  Neutralwert 0/1): leichte Vorlehnung bei Steigung, etwas aufrechtere Haltung in der Abfahrt.
  **M2 und M4 waren beide bereits vorher voll erfuellt** (`u.vizSchritt` seit PR #908 bzw. das
  eigene Standbild-Ersatz-M4 aus derselben PR) — das ist eine qualitative Verstaerkung innerhalb
  bereits gezaehlter Kriterien, **keine neue Punktzahl**, dasselbe Muster wie Fechtens Degen-
  Requisite im zwoelften Nachtrag.
- **A1 und M3 waren schon vorher voll erfuellt und von PR #948 nicht beruehrt:**
  `app/foundation/discipline-stage/arena/disciplines/peloton.tsx` (472 Z., `registry.ts:63,111`)
  ist die produktive React-Feld-Datei, zuletzt von PR #839 (06.09.) angefasst — `git log` bestaetigt
  keinen Commit von PR #948 darin, ihr gesamter Diff liegt in `battle-mode.engine.js`.
- **A3/A4 unveraendert offen** — keine neue Requisite (die "Startrampen-Markierung" wird im
  PR-Dokument selbst ausdruecklich als nicht gebaut benannt, niedrige Prioritaet), kein neuer Ton
  (`TON_KATALOG["time-trial"]` bleibt ohne Aufrufstelle, PR-Dokument: "Kein neuer Ton ... nicht
  Teil des Auftrags").
- **Konzept/Gameplay unveraendert** — K1-K4 und G1-G4 von PR #948 nicht angefasst, rho
  bit-identisch in derselben 0,80–0,85-Stufe.

**Ergebnis:** Konzept bleibt 95. Assets 50→55 (A2 komplett). Gameplay bleibt 92. Movement 65→100
(M1 komplett, M2/M4 qualitativ verstaerkt ohne neue Punktzahl). **Gesamt: 76 %→86 %** (rechnerisch
85,5 %).

---

**Stand vor dem 16.09.-Nachzug (13.09. Update: Movement 50→65, Assets 45→50, PR #908).** Chris hat ein laufendes Zeitfahren
angeschaut und sieben Dinge gemeldet; alle sieben sind mit einer eigenen Sonde
(`scripts/probe-zeitfahren-anzeige.mjs`, echtes Rennen im Browser) **nachgestellt worden, bevor
eine Zeile geaendert wurde**. Der unangenehme Teil der Antwort zuerst: **der Endstand war immer
echt** — `bahnRangliste()` sortiert nach `u.fertig − u.startT`, und `u.fertig` schreibt
`stepSpurt()` in genau dem Tick, in dem dieselbe `u.pos` die 1 erreicht, die auch gezeichnet wird.
Es gibt keine zweite Formel. **Falsch war alles, was WAEHREND des Rennens zu sehen war:**
- **Der vorlaeufige Stand mass die Startfolge, nicht das Rennen.** Er sortierte nach roher
  Strecke — bei einem Massenstart richtig, bei einem **Einzelstart** schlicht die falsche Groesse:
  wer 8,8 s frueher von der Rampe rollt, hat immer mehr Strecke, ohne schneller zu sein. Die
  K5-Umsetzung vom 07.09. hatte den **End**stand auf `bahnZeit` umgestellt und diesen Zweig
  uebersehen. Gemessen stand 41 Sekunden lang `57 : 21` — der rechnerisch groesstmoegliche
  Vorsprung. Jetzt: hochgerechnete Eigenzeit `(rennT − startT)/pos`.
- **Angezeigte Zeit und Uhr hatten zwei Massstaebe.** Bei `ZEIT_DEHNUNG["time-trial"]=4,38` lief
  beides um Faktor 4,38 auseinander — „8,1 s" bei einer Uhr von 1:26. Jetzt „35,4 s" bei 1:38.
- **Alle Figuren schwebten**, und der Grund war haerter als „zu langsam": die globale
  Sprite-Animationsuhr `t` wird nur in `stepSim()` hochgezaehlt, **hinter**
  `if(istBahn(disc))return stepSpurt(dt)`. Auf der Bahn wurde `t+=dt` nie erreicht, der Bildindex
  war eine **Konstante je Laeufer** — jede Figur ein stehendes Einzelbild, das ueber die Strecke
  gleitet. `stepZeitfahren()` liefert jetzt `vizSchritt` (Laufzyklus, vom Tempo getrieben),
  `vizErschoepft` und `vizRampe`.
- Dazu: Kamera von festem Zoom 2,2 auf einen Kasten um Fokus und Nachbarn, Startrampe mit
  Countdown angesagt (der gestaffelte Start ist **richtig**, er sah nur aus wie ein Fehler, weil
  ihn nichts ansagte), Ausdauer-Leiste von 26×3 px auf 38×5 px mit Rahmen, Marke und Wort.

**Wie das eingestuft ist:** M2 und M3 waren vorher schon gezaehlt (eigene Schrittlogik, Animation
in `peloton.tsx`), **M4 kommt neu dazu** — disziplineigene Posen/FX an den Sprites, wo vorher ein
Standbild glitt: Movement 50→65. Bei Assets bleibt die Haupt-Luecke offen (das Streckenprofil ist
auf der Bahn weiterhin unsichtbar, man sieht keinen Berg); Startrampe, Ausdauer-Leiste und HUD sind
eigene Motor-Elemente und heben A2 um eine Teilstufe: 45→50. **Gameplay bleibt 92** — die Rubrik
kennt kein Kriterium „Anzeige stimmt", und rho bewegt sich 0,828 → 0,825 innerhalb derselben
G1-Stufe.
**10.09. Update:** Gameplay 62→92 (PR #880, Bahn-Produktivierung). Produktionsanschluss (G2 0→30).
**Konzept 95:** die K5-Umsetzung hat die neun Sturz-Kurven **ersatzlos gestrichen** (ein Zeitfahren
hat keine Gegner) und durch ein stetiges Streckenprofil ersetzt — sieben Gelaendezonen
(Steigung/Abfahrt/Kurve), gestaffelter Start, Zwischenzeiten, Tagesform ±1,5 %. Eigenes Dokument
(`zeitfahren-recherche-06-09.md`) plus Wertungsplan.
**Assets 50:** `peloton.tsx` (472 Z., 9 Animationsstellen) ist gut, dazu seit PR #908 Startrampe
mit Countdown, lesbare Ausdauer-Leiste und ein HUD, das Rang, Rueckstand und Ausdauer des
Fokussierten zeigt — aber im Mockup ist das Streckenprofil weiterhin **unsichtbar**: `gelaende`
wirkt in `gelaendeFaktor()` (`:18121`) und erscheint nur als HUD-Balken (`:20207`), nicht auf der
Bahn. **Man sieht keinen Berg** — das bleibt die offene Haupt-Luecke dieser Zeile.
**Gameplay 92:** rho **0,825** (14.09. gemessen), Rangwertung, produktionsangeschlossen seit
PR #880. *(Die Ueberschrift „Gameplay 62" stand hier bis zum 14.09. und war seit dem 10.09. durch
das Update oben ueberholt.)*
**Movement 65:** `stepZeitfahren()` als eigener Zweig im Bahn-Bewegungspfad (Laufzyklus aus dem
Tempo, Erschoepfungspose, Rampe) — kein eigener Zeichenzweig, M1 bleibt offen.

### Fechten — 91 % (75/100/90/100)
**16.09.-Nachzug 2: Assets 55→100, Movement 35→100 (PR #945/#946, 16.09.).** Zwei PRs in
derselben Sitzung, beide ausschliesslich an `public/mockups/battle-mode.engine.js`, keine an
Konzept/Gameplay geruehrt:
- **PR #945 (Rezeptkalibrierung):** `sondiere-feldspiel-subskills.mjs`/`messe-arena-einfluss.mjs`
  finden ein Missverhaeltnis in NERVEN (drittschwerste Rolle, 13,2 % mechanisches Gewicht) — trug
  determination (Matrixgewicht 6) mit 40 % und health (4) mit 25 %, nur awareness (15) mit 35 %.
  Grid-Suche (`awareness:55/determination:20/health:25`) plus eine kleinere Matrix-Proportions-
  Korrektur an GRUNDLAGE/TECHNIK heben rho 0,809→**0,826** (Puffer zur 0,80-Schranke 0,009→0,026).
  PUBLIKUM/SPITZENMOMENT/WAGNIS wurden geprueft und verworfen (jede Variante verschlechterte rho).
  **Ehrlich im Dokument selbst festgehalten:** der neue Puffer bleibt kleiner als das
  Kaderrauschen (Spannweite 0,203) — das strenge CLAUDE.md-Kriterium ist nicht erreicht, und der
  Kopfkommentar ueber dem Rezept (`:12520`) heisst weiterhin „ERSTER, AUSDRUeCKLICH NICHT FINALER
  Sieben-Rollen-Entwurf". **K4 bleibt deshalb offen, Konzept bleibt bei 75.** Gameplay bleibt bei
  90 — 0,826 liegt in derselben 0,80–0,85-Stufe wie die vorherigen 0,809.
- **PR #946 (Movement + Assets):** liefert `stepFechten()` (Zustandsmaschine
  engarde→ausfall→erholung/parade, M2 erstmals erfuellt), `zeichneFechten()` (eigener Buehnenzweig
  mit einer Fechtbahn/Piste je Brett statt des generischen Zwei-Reihen-Zweigs, A2 und M1 erstmals
  erfuellt) und `FECHTEN_HAND`/`FECHTEN_PHASEN`/`zeichneDegen()` als neuen
  `DISZIPLIN_PROP.fechten`-Eintrag — ein Degen, der jetzt dauerhaft und phasenabhaengig
  (engarde/ausfall/parade, je eigener Klingenwinkel/Reichweite) an der Hand haengt statt nur
  waehrend des kurzen `ani==="slash"`-Fensters (M4 von teilweise auf voll). `sfx("fechten", …)`
  wird erstmals aufgerufen (klingen+treffer bei Treffer, klingen+halt bei Fehlschlag) — A4 erstmals
  erfuellt, nach derselben binaeren „hat Ton"-Schwelle wie bei Hockey/Speed-Schach/Eiskunstlauf,
  auch wenn kein Publikums-Loop ergaenzt wurde (ehrlich vermerkt, aendert die Punktzahl laut
  bisheriger Praxis dieses Dokuments nicht). **Ausdruecklich unangetastet:** `rezept`, `wert()`,
  die Erfolgskurve, `rundenN`, `failAbzug` — rho bit-identisch zu PR #945 (0,826), Isolationsnachweis
  ueber alle zwanzig Disziplinen bestaetigt keine Nebenwirkung.
- **A1 und M3 waren schon VOR beiden PRs voll erfuellt und sind von keiner der beiden beruehrt:**
  `app/foundation/discipline-stage/arena/disciplines/lamps.tsx` ist die produktive React-Feld-Datei
  fuer Fechten — eine von nur drei Feldern mit eigener Token-Zeichnung
  (`shared/track/lamps`, `benchmark.tsx:149,195`) statt der geteilten `FieldSvgInner` — und traegt
  eine eigene Touché-FX-Schicht (Ausfall-Lunge, rot/gruen aufflammender Treffer-Melder, kreuzende
  Klingen mit Klirr-Funke, Glow-Pulse, `lamps.tsx:16-17,147-198,290-322`). Beide PRs aendern nur
  `public/mockups/battle-mode.engine.js` — `lamps.tsx` ist unberuehrt.

Ergebnis: Assets 55→**100** (A1/A3 bereits voll, jetzt A2+A4 dazu — kein offenes Assets-Kriterium
mehr). Movement 35→**100** (M1/M2 neu, M4 von teilweise auf voll, M3 bereits voll) — die einzigen
beiden Achsen dieses Dokuments, in denen Fechten bislang am schwaechsten stand, stehen jetzt auf
dem Deckel. Konzept (K4) und Gameplay (G1-Stufe) bleiben bewusst unveraendert. **Gesamt 64→91 %.**

**16.09.-Nachzug 1: Konzept 55→75 (PR #923/#928, 14.09.).** PR #923 liefert eine eigenstaendige
Konzeptrecherche (`docs/design/fechten-punkte-mehrrunden-konzept-14-09.md`, Punkte-/
Mehrrunden-Struktur), PR #928 setzt sie um: drei FIE-Perioden statt einer einzelnen Punkteformel
(`rundenN` 10→9, durch 3 teilbar, dieselbe Gesamtdauer) und ein laufender Trefferstand (`u.treffer`)
im Feed, Chris' Go am 14.09. Beides ist **rein additiv** — `wert()`, `rezept` und die Erfolgskurve
bleiben unangetastet, derselbe rho-neutrale Hebel, den Eiskunstlauf/Breaking fuer ihre eigene
`rundenN`-Anpassung schon genutzt haben — rho bit-identisch innerhalb der G1-Stufe (0,816→0,809).
Das erfuellt K2 (eigene Zustandsmaschine ueber das Chassis hinaus) und K3 (eigenes Konzeptdokument)
zum ersten Mal wirklich. **Was sich NICHT bewegt und warum:** das Rezept selbst bleibt im Code
explizit „ERSTER, AUSDRUeCKLICH NICHT FINALER Sieben-Rollen-Entwurf" (`battle-mode.engine.js:12442`)
— K4 (kalibriert, offene Fragen entschieden) ist damit weiterhin nicht erfuellt, Konzept bleibt bei
75, nicht 100. Gameplay bleibt bei 90 (rho 0,809, dieselbe 0,80–0,85-Stufe wie vorher). Movement
bleibt bei 35: `stepFechten()` existiert bis heute nicht, `fechten:true` ist weiterhin rein
deskriptiv — der Waechter `if(art.fechten && typeof stepFechten==="function")` (`:13416`) greift
nie. Assets bleibt bei 55: `sfx("fechten"` steht 0x im Motor, keine eigene Ton-Aufrufstelle.
**Konzept 55 (Stand vor dem 16.09.-Nachzug):** der Chassiswechsel von der Arena auf die Buehne war richtig (rho 0,153 → 0,816),
aber das Rezept ist im Code selbst als **„ERSTER, AUSDRUECKLICH NICHT FINALER
Sieben-Rollen-Entwurf"** bezeichnet (`:10934`) und hat nie eine Kalibrierrunde bekommen. Der Puffer
zur Schranke (0,016) ist kleiner als das eigene Kaderrauschen (0,192) — die Disziplin steht live
auf einer Zahl, die statistisch nicht von einem Fehlschlag zu unterscheiden ist.
**Assets 55:** `lamps.tsx` (551 Z., **22 Animationsstellen — die hoechste Dichte aller zwanzig**)
und seit 07.09. korrekt IMMER die Schwert-Waffenebene (`:2573`). Aber keine eigene Motor-Szene.
**Gameplay 90:** rho 0,816, produktiviert (Welle 2).
**Movement 35:** kein eigener Zeichenzweig, kein eigener Paar-Rechner (bewusst, s.
`tennis-fechten-rollout-plan.md` E.2) — zwei Reihen Figuren mit Schwert.

### Tennis — 71 % (75/70/90/50)
**16.09.-Nachzug: Assets 40→70, Movement 20→50 (PR #929, 14.09.).** Tennis hatte bislang keine
eigene Requisite und keinen eigenen Zeichenzweig — es lief durch den generischen Duell-Zweig, den
sich Schach/I-Spy/Fechten/Wettessen/Showcase teilen. Neu: `DISZIPLIN_PROP.tennis` haengt einen
Schlaeger an dieselbe Hand wie Speed-Schachs Uhr (`TENNIS_HAND=SCHACH_HAND`), `zeichneTennis()` ist
jetzt ein exklusiv auf `art.tennis` gegateter eigener Zweig (Layout wortgleich aus dem generischen
Zweig uebernommen, zwei echte Ergaenzungen obendrauf: Schlaeger in Ausholpose bei `u.lunge>0`, ein
Ball, der bei jeder Enthuellung vom Schlaeger zum Brett-Gegner fliegt und bei einem Fehlschlag auf
halber Strecke absinkt — derselbe Ass/Netzroller-Gegensatz, den `tennis.tsx` in der produktiven
Arena-Buehne schon zeigt). Beide Ergaenzungen lesen ausschliesslich bereits vorhandene Felder
(`u.lunge`/`u.aktuell`/`u.brett`/`u.vorteil`), kein neuer `buehnenBewegung()`-Zweig, kein neues Feld
auf `u`, `rr()` wird nirgends aufgerufen — die Rangtreue-Neutralitaet ist strukturell gegeben, rho
bit-identisch (0,825). Das erfuellt A2 (eigene Szene ueber das Chassis-Bild hinaus, jetzt echt statt
kopiert) und A3 (disziplinrichtige Requisite statt der bisherigen `null`) sowie M1 (eigener
Zeichenzweig) und M4 (eigene Pose, die Ueberkopf-Ausholbewegung) — vorher unbewaffneter
Faustschlag. Kein eigener `stepTennis()` (M2 bleibt offen, der Ballfortschritt kommt aus `u.lunge`
selbst statt einer eigenen Uhr), kein Ton (A4 bleibt bei 0). Konzept/Gameplay unangetastet.
**10.09. Update:** Assets 30→40. Der Zufallswaffen-Bug (Abschnitt 3.2) ist projektweit geschlossen
— `DISZIPLIN_WAFFE` fuehrt Tennis heute mit `null`, der Spieler schwingt keine Kosmetikwaffe mehr.
**Konzept 75:** eigene, aus Tennis' MATRIX abgeleitete Rezeptkalibrierung (07.09., `:10837-10922`,
0,786 → 0,825) — das war die Behebung der 1:1-Uebernahme aus dem alten Feldspiel-Rezept. Die
Mechanik selbst ist aber Speed-Schachs `duell:true`, kein eigener Ballwechsel-Rechner.
**Assets 40:** `tennis.tsx` (424 Z., 17 Animationsstellen) — im Mockup weiterhin **das generische
Buehnen-Reihenbild**, aber die Zufallswaffe ist seit dem 10.09. weg (`DISZIPLIN_WAFFE` mit `null`).
Eigene Requisiten (Schlaeger) gibt es weiterhin nicht — daher 40, nicht mehr.
**Gameplay 90:** rho 0,825, produktiviert (Welle 2).
**Movement 20:** nichts Eigenes im Motor.

### Mini-DM — 54 % (75/60/22/60)
**16.09.-Nachzug: Konzept 70→75 (PR #927/#930, 14.09.).** PR #927 (Spielplan-Anchoring) ist reiner
Befund ohne Umsetzung, holt aber drei Chris-Entscheidungen ein (Liga-Groesse bleibt Vielfaches von
4, zweites Vorkommen wuerfelt neu, additive Pod-Struktur statt Fixture-Umbau). PR #930 setzt das
um: `lib/season/mini-dm-pod-schedule.ts` (additive, nicht persistierte 4-Team-Pods je Spieltag,
aus `buildCircleRounds()` abgeleitet), Kadergroesse fest auf 1
(`withMiniDmPlayerCountOverride`), und ein echter Playwright-Aufrufer fuer den FFA-Kampfmotor, der
bislang nur ueber Messskripte erreichbar war. Damit sind fuenf von sechs offenen Spielplanfragen
(`mini-dm-4-team-ffa-recherche-06-09.md` Abschnitt 5) technisch beantwortet — nur die
Kaderrobustheit bei Verletzung/Sperre im Pod-Kontext ist nie geprueft. Das ist K4-Fortschritt
(„offene Designfragen entschieden"), Konzept 70→75. Ein echter Review-Fund wurde dabei mitbehoben:
`playerCount:1` waere lautlos in den Legacy-PPS-Scoring-Pfad durchgesickert und haette jedem Team 0
Ligapunkte gebucht (`rank-to-points.json` kennt keine Zeile fuer 1) — `legacyScorePlayerCount`
entkoppelt beide Verwendungen. **Was sich NICHT bewegt:** Mini-DM ist weiterhin **ausdruecklich
nicht** in die Live-Resolve-Pipeline verdrahtet (`ARENA_RESOLVED_DISCIPLINE_IDS` faehrt ohne
Mini-DM), Gameplay haengt allein an rho (0,256, Kaderrauschen 0,661, unveraendert) und bleibt bei
22 — ein fertiger Spielplan aendert nichts an einer durchfallenden Zielwahl-Mechanik, das bleibt
ein Validitaetsproblem, kein Spielplan-Problem (s. `docs/pm-briefings/pm-gesamtstand-15-09.md`
Abschnitt 3). Assets/Movement unangetastet.
**14.09. Update: Movement 55→60 (PR #912).** S. den gemeinsamen Abschnitt „Die drei
Kampf-Disziplinen" direkt unter TDM — der Reihenabstand steigt hier **8,8 → 59,0 px** und der
Durchbruch faellt **18,3 → 4,3 %**, die deutlichste Entlastung der drei.
**Konzept 70:** eigenes Sechs-Attribut-Rezept, **bewusst gegen TDMs Speed-Fehler gebaut**
(`ARENA_ART["mini-dm"]`, `:4076`: „Bei einer neuen Disziplin diesen Fehler zu wiederholen waere
mutwillig"). Eigenes Dokument (`mini-dm-4-team-ffa-recherche-06-09.md`).
**Assets 60:** `duelhp.tsx` (555 Z., 15 Animationsstellen), echte Waffen/Ruestungen/Schilde am
Sprite — aber dasselbe Arenabild wie TDM und Battlefield, nur mit weniger Kaempfern.
**Gameplay 22:** rho **0,256** (14.09., vorher 0,094). Kader-Spannweite **0,661** — das
Zweieinhalbfache des Medians: bei n=24 ist hier keine Aenderung nachweisbar, auch diese nicht.
**13.09. Befund (PR #911): der 4-Team-FFA-Modus hat NULL Produktionsaufrufer.** Der Code ist
vollstaendig und gut (`battle-mode.engine.js` 23093-23270: Ecken-Spawns, vier Rollenrunden,
Rundenpunkte 4-3-2-1, Ligapunkte 2-1-0-0 nach Chris' ausdruecklicher Uebersteuerung,
Gleichstand-Teilung) — er wird nur von **drei Messskripten** aufgerufen und von keiner Zeile in
`lib/` oder `app/`. Mini-DM steht ausserdem nicht in `ARENA_RESOLVED_DISCIPLINE_IDS` und laeuft im
echten Spielstand heute mit `playerCount: 2` ueber das liga-weite Renn-Scoring. **Das aendert die
Zahlen oben nicht** (G2 stand ohnehin auf 0), aber es korrigiert, was „Mini-DM ist die
Vier-Team-Disziplin" bisher suggeriert hat: sie ist ein **nicht angeschlossener Prototyp**, nicht
ein schmaler Sonderfall. S. 3.5.
**Movement 60:** der volle Kampf-Bewegungsapparat, geteilt statt disziplineigen — aber seit
PR #912 mit dauerhafter Reihenformation.

### Battlefield — 53 % (70/60/22/60)
**14.09. Update: Movement 55→60 (PR #912).** Reihenabstand **34,5 → 155,0 px** — die deutlichste
Bewegung der drei, weil der Commander als einziger in Reihe 2 steht und jetzt auch dort bleibt.
**Konzept 70:** die einzige Kampfdisziplin, in der Power NICHT oben steht — Charisma/Intelligence/
Spirit tragen zusammen die Haelfte (`:4108`), ein gefuehrtes Gefecht statt einer Schlaegerei. Die
Aufstellungs-Umkehr (Siege Core stand hinten, rho −0,49) ist behoben und nachgemessen.
**Assets 60:** `territory.tsx` (625 Z. — die groesste Feld-Datei, 13 Animationsstellen).
**Gameplay 22:** rho **0,251** (14.09., vorher 0,387; Kader-Spannweite 0,778), kein Anschluss.
Die Zielwahl ist seit PR #912 **nicht mehr reine Geometrie** — drei der sechs Archetypen lesen
jetzt die Aufstellung (s. unter TDM). Der Satz „264 von 288 Kaempfern zielen auf den Naechsten"
galt bis zum 13.09.
**Movement 60:** wie Mini-DM/TDM, seit PR #912 mit dauerhafter Reihenformation.

### TDM — 52 % (55/65/22/65)
**16.09.-Nachzug: unveraendert (PR #938, 15.09.).** Chris' Entscheidung: In-Match-Level-Ups wie in
Eslabong funktionieren dort nur, weil es EINE Disziplin ist — bei uns waeren das 20 separate
Kurven. `renderLevelUp()` und das zugehoerige Markup (`#lvlup`/`#lvlhint`) sind auskommentiert statt
geloescht, falls die Idee spaeter in anderer Form wiederkommt. Reine Anzeige-Funktion ohne
Persistenz und ohne Wirkung auf `wert()`/`rezept` — war laut PR-Text „ohnehin nie ein zaehlender
Achsen-Baustein", rho bit-identisch (0,165), Slot-Invariante haelt. Keine der vier Zahlen bewegt
sich.
**14.09. Update: Movement 60→65 (PR #912).** Reihenabstand **20,4 → 81,3 px**.
**Konzept 55:** teilt sich `REC.power` mit den anderen Arena-Disziplinen. Das ist ausdruecklich
begruendet, nicht vergessen: **vier** eigene TDM-Rezepte wurden gebaut und gemessen (168 / 83 /
114,5 / 57,9 Pp), jedes war schlechter oder ununterscheidbar (`:4046-4073`). Kein eigenes Dokument,
nur die geteilte Arena-Recherche.
**Assets 65:** `bodenArena()` (`:16095`) IST das TDM-Bild — Sandkachel, Steinring, Blutflecken,
neunbildrige Fackelanimation, teamgefaerbte Haelften. Es ist das aelteste und dichteste
Chassis-Bild des Projekts, nur eben von drei Disziplinen geteilt. `kda.tsx` (396 Z.).
**Gameplay 22:** rho **0,165** (14.09., vorher 0,253; Kader-Spannweite 0,272). Und: der rohe
Impact-Wert bis 900/1400 landet ungenormt im Endstand-Bildschirm — **genau der Fall, ueber den
Chris sich beschwert hat** (`einheitlicher-spieler-score-pps-recherche-09-09.md` Abschnitt 3).
**Movement 65:** Laufen, Angreifen, Stuerzen, Taumeln — der Sprite-Apparat, fuer den die Arena
urspruenglich gebaut wurde, seit PR #912 mit dauerhafter Reihenformation.

#### Die drei Kampf-Disziplinen gemeinsam — 14.09., PR #912
Chris nach einem Live-TDM: „TDM ist noch zu statisch ... es gibt gar nicht ne dynamik wo manche
versuchen laut ihrem charakter oder stil eher die backrow oder sonstwas standardmaessig zu
attacken und so richtig ne formation front und backrow gibt es nciht." Zwei Befunde, beide
bestaetigt — und **zuerst gemessen, dann gebaut**: rho kann den Vorwurf prinzipiell nicht
beantworten (»gibt es eine Formation?« ist eine Aussage ueber Geometrie), also gibt es dafuer eine
eigene Sonde, `scripts/miss-arena-formation.mjs`.

**Befund 1 — die Zielwahl war zu drei Sechsteln gar keine.** `PERSZIEL` legte bollwerk,
draufgaenger **und** beschuetzer auf `"naechster"`; „Naechster" ist aber keine Neigung, sondern die
Abwesenheit einer. Genau **ein** Archetyp (schleicher) hatte ueberhaupt eine Stellungsabsicht —
und die lief in Mini-DM ins Leere, weil `"hinten"` hart auf `f.row===2` filterte und Mini-DM mit
vier Slots gar keine Reihe 2 hat. Neu: `hintersteReihe()` (die hinterste **besetzte** Reihe, eine
Quelle statt zweier Filter), **draufgaenger → `"speer"`** (der am weitesten vorgerueckte Gegner,
also die Spitze der gegnerischen Formation — mehrere Draufgaenger buendeln sich dadurch auf
denselben Vorstoss) und **beschuetzer → `"schild"`** (nicht der Gegner, der *ihm* am naechsten
steht, sondern der, der einem seiner **Kameraden** am naechsten steht). Ergebnis: fuenf
verschiedene Neigungen auf sechs Archetypen, drei davon lesen die Aufstellung.

**Befund 2 — die Reihen waren ein Startbild, keine Formation.** Der Bauweg war nie kaputt:
`homeFor()` stellt drei Spalten im Abstand von 160 px auf. Das galt genau einen Frame lang, weil
die Formationsleine an `teamFront()` hing — **einer** Linie fuer die ganze Mannschaft, fuer alle
drei Reihen dieselbe. `reihenAnker(u)` haengt sie jetzt an die eigene Reihe, und der Rang wird
**gezaehlt, nicht gelesen** (sonst wuerde eine Mannschaft, deren Front gefallen ist, vor einem
leeren Feld zurueckweichen). Dazu `versperrt(u)`: der Durchbruch loeste die Leine schon bei
„dasselbe Ziel seit 3 s und immer noch zu weit weg" — was auf jeden zutrifft, den die **eigene**
Aufstellung haelt; jetzt muss wirklich jemand im Weg stehen.

| | Reihenabstand | verkehrt herum | Durchbruch aktiv |
|---|---:|---:|---:|
| tdm | 20,4 → **81,3 px** | 32,6 → 28,4 % | 23,1 → 19,1 % |
| mini-dm | 8,8 → **59,0 px** | 31,5 → 27,1 % | 18,3 → **4,3 %** |
| battlefield | 34,5 → **155,0 px** | 34,4 → 22,0 % | 20,0 → 15,9 % |

**Warum das +5 auf Movement wert ist und nicht mehr.** Die Formationsmessung bewegt sich um das
Vier- bis Siebenfache und liegt weit ausserhalb jedes Rauschens — aber sie fuellt kein neues
M-Kriterium: M1 (eigener Zeichenzweig) und M4 (disziplineigene Posen) bleiben bei allen dreien
offen, der Bewegungsapparat bleibt geteilt. Und der **Restbefund ist ehrlich benannt**: „verkehrt
herum" faellt nur von rund einem Drittel auf rund ein Viertel, der Offensivzwang steigt (tdm
5,9 → 15,3 %), weil das Endspiel (`live(seite)<=2`) die Reihen per Regel aufhebt und die Hinteren
jetzt laenger leben. Kein Fehler, aber keine vollstaendige Loesung.

**Zur rho-Spalte: keine der drei Bewegungen ist belegbar.** 0,253→0,165 · 0,094→0,256 ·
0,387→0,251, bei Kader-Spannweiten von 0,272 bis 0,778. Jede einzelne liegt darunter; nach
`messgrundlage-kaderfest.md` ist damit keine von null zu unterscheiden — **weder die Verbesserung
bei Mini-DM noch die Verschlechterung bei TDM und Battlefield.** Wer aus diesen Zahlen eine
Richtung liest, liest Kaderrauschen. Alle drei bleiben weit unter 0,80 und in derselben G1-Stufe.
Die uebrigen siebzehn Disziplinen sind in allen vier Spalten **ziffernidentisch** geblieben (`diff`
ueber achtzehn Zeilen: leer) — strukturell zu erwarten, weil jede geaenderte Zeile im `istKampf`-
Pfad liegt.

### Climbing — 66 % (65/40/92/65)
**16.09.-Nachzug 2: Gameplay 49→92 (PR #943, 16.09.).** Erste eigene Kalibrierrunde fuer Climbing —
`docs/design/climbing-kalibrierung-16-09.md`. **rho frisch gemessen**
(`node scripts/miss-alle-disziplinen.mjs 24 climbing`): **0,834** (vorher 0,782), Spannweite 0,209,
Saison-rho 0,860 — bit-identisch zum PR-Text.
- **G1 (Rangtreue):** rho 0,782→**0,834**, Stufenwechsel von 0,70–0,80 (22 Punkte) auf 0,80–0,85
  (35 Punkte) — **+13 Punkte.** Ursache: `messe-arena-einfluss.mjs climbing 48` fand 35 Pp
  Abweichung zur Matrix (Stamina/Determination/Speed 5-7 Pp ueber ihrem Matrixgewicht, WILL/HEALTH
  praktisch tot); `sondiere-feldspiel-subskills.mjs climbing` identifizierte ROBUST als mechanisch
  toten Sub-Skill (0,0 % Einfluss, sein einziger Kanal ist zu schwach). Einziger Eingriff:
  `BAHN_ART.climbing.rezept.STEHEN` (`public/mockups/battle-mode.engine.js:21868`) nimmt WILL/HEALTH
  statt eines Teils von Stamina/Determination auf — Abweichung zur Matrix 35→19,4 Pp.
- **G2 (Produktionsanschluss):** NEU erfuellt — **+30 Punkte.** `"climbing"` steht jetzt in
  `ARENA_RESOLVED_DISCIPLINE_IDS` (`lib/resolve/battle-mode-arena-team-points.ts:328`) und in
  `ARENA_BAHN_DISCIPLINE_IDS` (`lib/battle/arena-headless-runner.ts:203`), eigene PPS-Referenz
  gezogen (`data/generated/climbing-pps-referenz.json`, `scripts/ziehe-buehne-pps-referenz.ts`).
  Climbing ist damit die **15. arena-resolved Disziplin** (Spurt war am 14.09. die 14., s. elfter
  Nachtrag) — **Arena-Spalte nein→ja.**
- **G3/G4 unveraendert** — eigener `wertung:"rang"`-Modus (wie Spurt/Time-Trial) und Bahn-Chassis
  12/15 (Feldgroessen-Wirkung nicht verifiziert, Abschnitt 3.3), von PR #943 nicht angefasst.
  **Gameplay: 22+0+15+12=49 → 35+30+15+12=92.**
- **K4 (kalibriert, Designfragen entschieden): geprüft und weiterhin OFFEN**, nach demselben
  Massstab wie Fechten im zwoelften Nachtrag. Der neue Puffer zur 0,80-Schranke (0,834-0,80=0,034)
  bleibt **kleiner als das gemessene Kaderrauschen** (Spannweite 0,209) — vom PR-Dokument selbst so
  benannt ("ein vertretbarer Puffer ... auch wenn er duenner ist als z. B. Zeitfahrens"), und
  derselbe Text nennt eine "Verschaerfung von STEHEN" als "naheliegenden naechsten Schritt fuer
  eine Folgerunde, falls das Kaderrauschen den heutigen Puffer je auffrisst" — kein abgeschlossener
  Zustand. **K4 zaehlt weiter als nicht erfuellt.**
- **K3 (eigenes Fable-Dokument): geprüft, bewusst NICHT hochgestuft.**
  `climbing-kalibrierung-16-09.md` ist das erste climbing-EIGENE (nicht geteilte) Dokument
  ueberhaupt — aber es modelliert die Disziplin nicht "von Grund auf" (Griffe, Wandsteilheit,
  Stationsfolge bleiben in der geteilten `bahn-disziplinen-recherche-fable.md` Abschnitt 4), sondern
  kalibriert gezielt einen einzelnen Sub-Skill per Grid-Suche — dieselbe Kategorie wie Fechtens
  PR #945-Kalibrierdokument, das im zwoelften Nachtrag K3 ausdruecklich NICHT bewegt hat (dort war
  K3 zwar schon vorher voll, hier bleibt es beim bisherigen Teilkredit). **Konzept bleibt bei 65,
  unveraendert.**
- **K1/K2 unveraendert** — `BAHN_ART.climbing.rezept` (`:21850 ff.`) existiert seit langem, PR #943
  aendert nur die STEHEN-Gewichte darin; die zehn Griffe/Griff-dann-Kraftzug-Kette bleiben Teil der
  generischen Bahn-`hindernisse`-Schleife, kein eigener Zweig ueber das Chassis hinaus.
- **A1-A4 und M1-M4 unveraendert, geprüft:** PR #943 aendert ausschliesslich Rezept-Gewichte
  (`battle-mode.engine.js`) und Produktions-/Referenzdateien (`arena-headless-runner.ts`,
  `battle-mode-arena-team-points.ts`, `ziehe-buehne-pps-referenz.ts`,
  `climbing-pps-referenz.json`) — keine Zeichen-, Ton- oder Bewegungszeile. `mountain.tsx`
  (`app/foundation/discipline-stage/arena/disciplines/mountain.tsx`, 337 Z., `registry.ts:66,114`,
  zuletzt PR #839 06.09.) ist von PR #943 nicht beruehrt, A1 bleibt wie vorher erfuellt. **Assets
  bleibt 40, Movement bleibt 65.**

**Ergebnis:** Konzept bleibt 65 (K3/K4 bewusst nicht bewegt). Assets bleibt 40. Gameplay springt
49→92 (G1 eine Stufe, G2 komplett neu). Movement bleibt 65. **Gesamt: 55 %→66 %** (rechnerisch
65,5 %). rho 0,782→**0,834**. Arena nein→**ja**.

---

**Stand vor dem 16.09.-Nachzug 2 (Movement 40→65, PR #925, 14.09.).** Climbing hatte als einzige der fuenf
Bahn-Disziplinen ueberhaupt keinen eigenen `bahnBewegung()`-Zweig — kein Flag (`art.climbing` gab
es nicht), kein Aufruf. Der Dispatcher fiel fuer Climbing durch alle vier bestehenden Zeilen durch,
ohne je zu treffen; die Figuren liefen komplett ueber die eingefrorene Weltuhr `t`
(`Math.floor((t*7+u.id)%n)` in `zeichneSprite`) — staerker eingefroren als Staffel/Takeshi, die
wenigstens schon einen (bislang nur nicht-animierenden) Step-Zweig hatten. Neues `stepClimbing()`
schreibt jetzt `u.vizSchritt` — dasselbe Muster wie `stepStaffel`/`stepParcours`/`stepZeitfahren`,
einziges geschriebenes Feld ist das neue, rein praesentationale `vizSchritt`, niemals `rr()`,
niemals etwas, das `MOTOREN.climbing.wert()` liest. Das erfuellt M2 (eigene Schrittlogik) zum
ersten Mal, Movement 40→65. Rein praesentational, rho bit-identisch (0,782, weiterhin knapp
durchgefallen, 0,018 unter der Schranke). Konzept/Assets/Gameplay unangetastet.
**Konzept 65:** zehn Griffe mit Griff-dann-Kraftzug-Kette, `steigung:0,85` (die Wand wird nach oben
steiler), kein Tackle. **Kein eigenes Dokument** — nur Abschnitt 4 der geteilten
`bahn-disziplinen-recherche-fable.md`, und der wurde nie in eine eigene Umsetzungsrunde ueberfuehrt.
Nie kalibriert.
**Assets 40:** `mountain.tsx` (337 Z., 8 Animationsstellen). Im Mockup gibt es **keine Kletterwand**
— nur `boden:"#5d5a54"` und `baeume:false` (`:17038`). Eine Wand sieht aus wie eine graue Bahn.
**Gameplay 49:** rho **0,782 — 0,018 unter der Schranke** (14.09. gemessen, vorher 0,790), die
billigste offene Rangtreue-Baustelle. Aber das eigene Kaderrauschen ist 0,191, das
Zehnfache des Fehlbetrags.
**Movement 40:** Steigungs-Zehrung im Schritt, sonst generisch.
**14.09.:** Climbing ist die Disziplin, auf der die Puste-Erholung der Bahn-Welle (PR #914) am
staerksten wirkt — **69,3 % → 31,9 %** bleiben leer, **59,7 %** fangen sich wieder, im Schnitt 1,2
Erholungen je betroffenem Laeufer. Genau Chris' Satz („manche laufen aus und fangen sich wieder,
manche bleiben leer"). Kosten: −0,008 rho, weit innerhalb der Spannweite; die Zeile bleibt in
derselben G1-Stufe und weiterhin knapp durchgefallen. Nebenbefund aus derselben PR, der hierher
gehoert: der **erste** Satz Erholungs-Konstanten war schlicht tot — 0,0 % Erholungen ueber 960
Laeufer, waehrend die Rangtreue gruen meldete. Gefunden hat das ein Verteilungs-Werkzeug, nicht das
Abnahme-Gate. **Eine tote Zeile veraendert nichts und besteht deshalb jede Abnahme.**

### Wettessen — 46 % (35/40/95/15) — **kein eigenes Konzept**
**10.09. Update:** Assets 30→40, Zufallswaffen-Bug geschlossen.
**Konzept 35:** es gibt ein eigenes, aus der Matrix abgeleitetes Rezept (will 26/health 22/
stamina 22, bewusst ohne Charisma, `:10761`) und eine eigene `wertungTabelle` mit Chris' eigenem
Wort „Pause". Das war es. **Es gibt kein Dokument, das Wettessen als Sportart modelliert**, keine
eigene Mechanik, keine Kalibrierrunde — es ist der generische Buehnen-Durchgangsrechner mit
anderen Attributgewichten.
**Assets 40:** `platter.tsx` (441 Z., 6 Animationsstellen, leergegessene Teller) — im Motor das
generische Reihenbild, aber ohne Zufallswaffe mehr (seit 10.09.).
**Gameplay 95:** rho **0,845**, produktiviert (Welle 2) — die Zahl ist gut, weil das
Buehnen-Chassis gut ist, nicht weil Wettessen gut ist.
**Movement 15:** nichts.

### Showcase — 45 % (25/40/95/20) — **kein eigenes Konzept**
**10.09. Update:** Assets 30→40. Die alte Notiz ("Showcase bewusst unangetastet") ist ueberholt —
`DISZIPLIN_WAFFE` fuehrt heute alle vier betroffenen Buehnen (Showcase/Tennis/Wettessen/I-Spy)
projektweit mit `null`, selbst nachgelesen.
**Konzept 25:** die duennste Disziplin unter den zehn produktiven. `BUEHNE_ART.showcase` (`:10658`)
ist der Sieben-Rollen-Standard mit Charisma-Gewichten — **kein Flag, kein Zweig, keine
NACHGEZOGEN-Korrektur, kein eigenes Dokument**. Der einzige Text ueber Showcase ist die
Produktivierungs-Notiz, die es mit Speed-Schach teilt.
**Assets 40:** `showcase.tsx` (623 Z., aber nur **3 Animationsstellen**). Im Motor generisch, aber
seit 10.09. ohne Zufallswaffe.
**Gameplay 95:** rho **0,892** (drittbeste im Feld), produktiviert seit Welle 1.
**Movement 20:** nichts Eigenes.

### I-Spy — 38 % (55/40/37/20)
**10.09. Update:** Assets 30→40, Zufallswaffen-Bug geschlossen.
**Konzept 55:** die **breiteste Matrix aller zwanzig** (zehn Attribute mit Gewicht) und eine
gemessene NACHGEZOGEN-Korrektur (`:10821`). Aber `duell:true` von Speed-Schach uebernommen, und der
einzige Konzepttext ist Abschnitt 4 von `arena-duell-recherche-fable.md` (Differenzwert), geteilt.
**Assets 40:** `spybar.tsx` (589 Z., 17 Animationsstellen) — im Motor generisch, aber seit 10.09.
ohne Zufallswaffe.
**Gameplay 37:** rho **0,684 — die einzige Buehnen-Disziplin, die die Abnahme nicht besteht.**
Technisch waere der Anschluss eine einzige Zeile (`duell:true` liegt vor); er ist **bewusst
unterlassen** und mit einem eigenen Regressionstest festgehalten (PM-Briefing 09.09., „die beiden
Achsen duerfen nicht deshalb vermischt werden, weil eine davon billig zu erfuellen waere").
**Movement 20:** nichts Eigenes.

---

## 3. Querschnittsbefunde, die jede Zeile oben beeinflussen

### 3.1 Ton — Stand 14.09. (nachgezaehlt): acht von zwanzig haben verdrahteten Ton, zwoelf sind
### stumm; echte Audio-DATEIEN hat weiterhin nur Basketball
Basketball bleibt die einzige Disziplin mit echten Audio-DATEIEN: `public/sound/basketball/` mit
sechs Dateien, ueber `bkSfx()` angebunden. **Hockey** hat seit dem 12.09. (E2, PR #893) einen
vollstaendig verdrahteten, prozeduralen `TON_KATALOG.hockey`-Eintrag (fuenf Ereignisse, synthetisch
erzeugt statt Audio-Datei — der Umgebungs-Proxy laesst keine Audio-Dateien durch) und zaehlt damit
ebenfalls als "hat Ton" (A4 0→20). PR 0.1 (#892, 12.09.) hat ausserdem **sechs weitere**
Katalogeintraege angelegt (Speed-Schach/Staffel/Football/Time-Trial/Spurt/Fechten) — reine Daten,
noch **ohne eine einzige Aufrufstelle**, also noch ohne Punktewirkung (A4 bleibt bei diesen sechs
bei 0, bis eine Ziel-PR sie tatsaechlich verdrahtet).

**Korrektur 14.09., nachgezaehlt statt geschaetzt.** Der Satz „Elf von zwanzig bleiben stumm" war
schon beim Schreiben ueberholt. Gezaehlt ueber die tatsaechlichen `sfx("<disziplin>"`-Aufrufstellen
in `battle-mode.engine.js` haben heute **acht** Disziplinen verdrahteten Ton: Basketball (ueber
`bkSfx()`, als einzige mit echten Audio-DATEIEN), Gewichtheben (8 Stellen), Hockey, Staffel,
Takeshi's Castle, Eiskunstlauf und Breaking (je 4) sowie Speed-Schach (3). **Zwoelf von zwanzig
bleiben stumm** — Football, Time-Trial, Spurt, Fechten, Tennis, Wettessen, Showcase, I-Spy,
Climbing, TDM, Mini-DM, Battlefield; von diesen haben vier (Football/Time-Trial/Spurt/Fechten) seit
PR 0.1 einen Katalogeintrag ohne jede Aufrufstelle. Der Rueckstand ist kleiner geworden, aber noch
immer der groesste gleichfoermige im Projekt.

### 3.2 Der Zufallswaffen-Bug ist seit dem 10.09. projektweit geschlossen
**Ueberholt:** dieser Abschnitt sagte bis zum 10.09., der Bug sei bei Showcase/Tennis/Wettessen/
I-Spy weiterhin offen. Nachgesehen im aktuellen Code: `DISZIPLIN_WAFFE` fuehrt heute alle vier mit
`null`, zusammen mit den fuenf Bahn-Disziplinen. Kein Kaempfer/Spieler traegt mehr eine
Zufallswaffe, die zu seiner Disziplin nicht passt — das hat allen vier Buehnen je 10 Assets-Punkte
gebracht (s. Tabelle oben). Eigene, disziplinrichtige Requisiten (statt nur "keine Waffe") gibt es
fuer diese vier weiterhin nicht — das bleibt offen und ist Aufgabe der `DISZIPLIN_PROP`-Tabelle
(PR 0.2, #889), sobald eine Ziel-PR ihnen eine eigene Requisite gibt.

### 3.3 Die 2–6-Spieler-Luecke ist im Code geschlossen, aber nicht nachgemessen
`pruefung-2-6-spieler-tauglichkeit-alle-disziplinen-08-09.md` fand, dass die Gegnerseite bei
**Bahn und Arena** strukturell auf die Katalogkonstante festgenagelt war. Nachgesehen: `gastGesetzt`
steht heute in **allen vier** Baufunktionen — Feldspiel (`:5470`), Buehne (`:10999`), Arena
(`:14113`) und Bahn (`:17880`). PR #864 hat den Befund also geschlossen. **Nicht verifiziert** ist,
ob damit auch die Feldgroessen-Wirkung selbst stimmt; deshalb steht bei Bahn/Arena 12 von 15
Punkten statt 15.

### 3.4 Zwei vorbestehende Zeichenfehler, die ALLE ZWANZIG betrafen — 14.09. behoben
**Neu in diesem Nachtrag.** Beide sind waehrend anderer Arbeiten aufgefallen, beide sind
**rho-bit-identisch** (bewiesen und gemessen), und beide bekommen deshalb **keine Punkte auf einer
Achse** — dieselbe Behandlung wie die Welle-0-Fundamente weiter oben. Sie stehen hier, weil sie
etwas ueber die **Belastbarkeit der Assets- und Movement-Spalten** sagen: diese Spalten sind aus
gelesenem Zeichencode eingestuft (s. Abschnitt 7 Punkt 1), und gelesener Zeichencode hat hier
zweimal etwas anderes getan, als er behauptet hat.

**(a) Der Sprite-Bildindex wurde negativ (PR #915).** Die Angriffsanimation rechnet an drei Stellen
`Math.floor((1 - u.lunge/0.2) * n)` und setzt damit voraus, dass `u.lunge` bei **0,2** startet. In
der Arena stimmt das; `stepBuehne()` und die Wurf-/Block-/Torwart-Pfade setzen aber **0,5** — der
Ausdruck wird negativ. `drawImage()` mit negativem Quell-x zeichnet dann nicht *nichts*, sondern
**beschneidet das Quellrechteck**: sichtbar blieb ein schmaler Streifen des vorherigen, falschen
Bildes. Nachgemessen an sichtbaren Alpha-Pixeln derselben Figur: Krag'Zul **1603 px bei `lunge`
0,19, 53 px bei 0,21**; Lava Golem 1848 → 283; Johanna (Baukasten-Figur) 1553 → 827. Behoben mit
`Math.max(0, …)` an allen drei Stellen. **Das betrifft Basketball-Wuerfe, Hockey-Blocks und die
Torwart-Pfade genauso wie Gewichtheben** — jede dieser Animationen zeigte in ihren ersten 0,3
Simulationssekunden einen angeschnittenen Frame und zeigt jetzt einen vollstaendigen.

**(b) `hoehenKorrektur()` hat sich selbst gemessen (PR #918).** Die Funktion soll die Streuung der
Sprite-Blaetter wegrechnen, damit die Bildschirmhoehe einer Figur nur noch an ihrer `groesse`
haengt. Ihr Messdurchlauf ruft `zeichneSprite()` auf — und `zeichneSprite()` rechnet in seiner
ersten Zeile `hoehenKorrektur()` fuer denselben Namen zurueck. Der Zwischenspeicher wurde erst
**nach** der Messung gefuellt, der Rueckruf fand also nichts vor und mass erneut: **1057 bis 2309
Ebenen tief**, bis der JS-Stapel ueberlief; den `RangeError` schluckte ein `try/catch` lautlos.
Beim Abwickeln misst jede Ebene das Bild der darunter — ein sauberer Zweierzyklus —, und
gespeichert wurde, was die aeusserste Ebene in der Hand hielt: **die Paritaet der zufaelligen
Ueberlauftiefe.** In etwa der Haelfte der Faelle landete 1,000 im Speicher, die Korrektur fand dann
**gar nicht statt**. Im Spiel sichtbar als: dieselbe Figur ist beim naechsten Seitenaufruf anders
gross (Xelara 51 / 45 / 51 px ueber drei Laeufe).

| | rho (`groesse` → Bildschirmhoehe) | Reststreuung max/min |
|---|---:|---:|
| wie die Formel es meint | **1,000** | **1,00** |
| Paritaetszweig A | 0,673 | 1,27 |
| Paritaetszweig B | 0,491 | 1,27 |

Behoben mit einer Zeile (eine 1 in den Zwischenspeicher legen, **bevor** gemessen wird): erster
Aufruf von ~1,1 s auf < 2 ms, Streuung der Kaderfiguren 1,39 → **1,21**, und drei Laeufe derselben
Montage sind jetzt zeichenweise identisch statt unterschiedlich. **Zwei Verdachtsmomente der
urspruenglichen Meldung haben sich dabei NICHT bestaetigt und stehen hier, damit sie nicht
weiterwandern:** der Deckel `HOEHEN_KORR_MAX=1.25` ist nicht schuld (`dh=64*Z` ist der Rahmen, nicht
der Inhalt — ein Vollbild-Blatt fuellt seine Zelle gar nicht aus, gemessen Krag'Zul 59 px bei Z=1),
und **es ist nicht vollbild-spezifisch**: die vier Figuren, die im Zufallsfall auf 1,000 standen,
sind alle vier Baukasten-Figuren.

**Eine Nachpruefung fuer Chris, aus der Review zu #918** (Merge-Commit `7a07de2f`): die Figuren mit
dem Groessen-Stellrad `b.skala` — **Bloater, Burster, Mushu** — werden durch den Fix jetzt
**zuverlaessig** korrigiert statt zufaellig. Bei Bloater ist die Statur-Anpassung vom 04.09.
(`bloater-modell-verbessert.md`, `bloater-vorher-nachher.png`) damals gegen ein Bild kalibriert
worden, das die Korrektur nur in etwa der Haelfte der Faelle angewandt hatte; sie wirkt jetzt
konsistent und sollte einmal angesehen werden.

**Was das fuer die Assets-Spalte heisst.** Keine Zeile oben bewegt sich — die A-Kriterien fragen
nach eigener Flaeche, eigener Szene, eigenen Requisiten und Ton, nicht nach Renderkonstanz. Aber
die Einstufungen dieser Spalte sind ab jetzt auf einem Bild gemacht, das **reproduzierbar** ist;
vorher war „wie gross ist diese Figur" eine Muenze. Die naechste echte Sichtprobe (Abschnitt 7
Punkt 1) misst damit etwas Stabiles.

### 3.5 Die N-Team-Infrastruktur ist paarweise, nicht generisch — 13.09., PR #911
Chris hat gefragt, ob zwei Teams nacheinander in zwei Disziplinen antreten koennen, ob die
Verteilung bei Vierer-Disziplinen wie Mini-DM klappt, und ob alles sauber angezeigt und im
Spieltagskalender erfasst ist. Das Audit
(`docs/design/n-team-disziplinen-infrastruktur-audit-13-09.md`) beantwortet alle vier mit Belegen:

| Chris' Frage | Antwort |
|---|---|
| 1v1 nacheinander in 2 Disziplinen, mit Punkten? | **Halb.** Hoechstens EINE kann ein echtes Duell sein, und in **41 % der Spieltage ist es KEINE.** |
| Verteilung bei 4er-Disziplinen wie Mini-DM? | **Nein — es gibt sie im Produktionscode gar nicht** (s. Mini-DM oben). |
| Alle N Teams sauber angezeigt? | **Gespalten.** Die Buehne ist bereits N-generisch, der Spielplan-Kalender zeigt strukturell genau EINEN Gegner. |
| Im Spieltagskalender korrekt erfasst? | **Fuer N=2 sauber, nachgemessen: null Doppelbuchungen.** Fuer N>2 gibt es kein Datenmodell. |

**Die 41 %** (gemessen mit dem echten `buildSeasonSeededDisciplineSchedule` ueber 400 Saves): sind
**beide** Disziplinen eines Spieltags arena-aufgeloest, faellt der **ganze** Spieltag still auf den
PPS-Pfad zurueck. Als diese Entscheidung getroffen wurde, waren zwei Disziplinen arena-aufgeloest
und der Fall traf ~0,5 % der Spieltage — **heute sind es dreizehn von zwanzig.** Das ist kein
Rechenfehler (die gebuchten PPS-Punkte sind in sich korrekt), sondern eine **stille
Nicht-Erfuellung** genau dessen, wonach Chris fragt, und liegt als Entscheidung auf seinem Tisch.

**Und ein echter Fehler, behoben:** der Arena-Einhaengepunkt fragte nach **Mengen-Zugehoerigkeit**
statt nach **Identitaet** mit der Disziplin, fuer die der Arena-Lauf gelaufen ist. Sind D1 und D2
beide arena-aufgeloest, traf die Bedingung fuer beide zu — derselbe eine Duellausgang waere zweimal
gebucht worden (2 + 2 = **4 Punkte** aus einem einzigen Duell). Erreichbar war das heute nicht (die
`mehrdeutig`-Wache steigt vorher aus), **aber die Wache steht in einer anderen Datei als die Regel,
die sie schuetzt** — und wer die 41 % angeht, MUSS sie lockern. Die Invariante steht jetzt lokal
dort, wo sie gilt (`arenaDisciplineId`, mit eigenem Test und bit-identischem Rueckfall).

**Keine Punktewirkung auf die Tabelle oben** — G2 misst, ob eine Disziplin in
`ARENA_RESOLVED_DISCIPLINE_IDS` steht, und daran aendert das Audit nichts.

### 3.6 Offene Nachfolgepunkte aus PR #917 (Eiskunstlauf) und #913 (Breaking) — 14.09.
Beide PRs benennen selbst, was sie **bewusst nicht** angefasst haben. Damit das nicht verloren
geht, bevor die naechste Runde an diesen Disziplinen ansetzt, hier gesammelt — keiner der Punkte
bewegt eine Zahl oben:

**Eiskunstlauf (PR #917):**
- **Sturz-Gleiten (~39 px).** Haelt nur ein Partner, bleibt er stehen und faehrt danach mit dem
  gedeckelten Schritt (260 px/s) wieder auf — bei einem Haltefenster von 0,5 s und ≤78 px/s
  Bahntempo ein Rueckstand von bis zu 39 px, der sich in ~0,2 s aufholt. Eine weiche Korrektur,
  kein Sprung mehr, aber sichtbares Gleiten bleibt.
- **Broadcast-Bug bei sehr schmaler Darstellung.** Bei 420 px Fensterbreite frisst der Bug 44 % der
  Leinwandhoehe — dort hilft keine Geometrie der Kuer-Bahn mehr. Ein CSS-Thema des Overlays selbst,
  eigenes Ticket.
- **Kurzprogramm + Kuer als zwei Segmente.** Die reale ISU-Struktur hat zwei Segmente; das Spiel
  hat weiterhin nur eines.
- **Die 47 %-Sturzquote-Kalibrierung.** Von der Opus-Overseer-Review zu PR #903 nachgezaehlt (58
  Stuerze zu 66 Landungen bei 125 Elementen) und in `eiskunstlauf-kalibrierung-10-09.md` als
  offener, quantifizierter Befund festgehalten — eine reale Fehlschlagquote, die hoeher liegt als
  im echten Sport. Ist ein Rezept-Thema, keine Praesentationsfrage, und PR #917 fasst das Rezept
  ausdruecklich nicht an.
- **Echte Hebefigur-Pose.** Weiterhin keine eigene Pose fuer Hebefiguren — der Rest von Movements
  Luecke zu 100 (M4).

**Breaking (PR #913):**
- **Sichtbarer Gang zum Tisch.** Kein Laufweg zur Folterbank und zurueck — bei `rundenDauer:0,625 s`
  ist dafuer kein Zeitbudget, ohne die Zustandsmaschine zu verlaengern. Erzaehlt ueber den leeren,
  golden markierten Geraeteplatz statt ueber Bewegung.
- **Rollenrichtung.** Der Ertragende steht im Spotlight, der Peiniger daneben — von der PR selbst
  als „begruendet, aber nicht unumstoesslich" markiert; die umgekehrte Zuweisung waere ein Einzeiler
  in `cypherPaar()`.
- **`TON_KATALOG`-Schluessel `"powermove"`.** Heisst weiterhin so, obwohl Breakdance-Vokabular,
  weil derselbe Schluessel parallel in einem Staffel-Kommentar zitiert wird — Umbenennung als eigene
  kleine Aufraeumrunde vorgesehen.
- **Eigene Foltergeraeusche je Stufe.** Der Ton ist unveraendert (`TON_KATALOG.breaking` mit vier
  Schluesseln, drei `sfx()`-Aufrufe) — kein eigenes Geraeusch je Eskalationsstufe der Folterbank.
- **Interne Breakdance-IDs.** `powermove`/`footwork`/`freezecontrol`/`musicality` bleiben als
  interne Slot-`id`s stehen — sie sind der Vertrag mit gespeicherten Aufstellungen, eine Umbenennung
  braucht eine Migration.
- **Kommentar-Reste in `breaking.tsx`.** Nicht Teil dieser PR (die Aenderungen liegen in
  `battle-mode.engine.js`), noch nicht durchgesehen.

---

## 4. Was ich beim Nachsehen gefunden habe und was in der Doku falsch steht

### 4.1 Staffel hat laengst eine Wertung — der genannte Blocker ist stale
`stand-aller-disziplinen.md` Abschnitt 4 und das PM-Briefing vom 09.09. (Prioritaet 2 Punkt 1 sowie
Empfehlung 2) sagen beide, `bahnTeamstand()` liefere fuer Staffel `gewertet:false`, es gebe „noch
keine Wertung", und Chris muesse erst entscheiden, was ein Staffel-Team-Sieg ist. Der Kommentar in
`battle-mode-arena-team-points.ts:160-167` sagt dasselbe.

**Das stimmt seit PR #827 nicht mehr.** `bahnTeamstand()` hat einen eigenen
`wertung==="etappe"`-Zweig (`:15794-15805`): das Rennen entscheidet der Zieleinlauf (1:0), die
Punkte je Laeufer sind der Rang der Etappenleistung, und `gewertet` ist true, sobald der erste
Laeufer im Ziel ist. Der Kommentar direkt darueber sagt es selbst: *„seit dem Prototyp betrifft das
keine der fuenf Bahnen mehr."* Alle fuenf Bahn-Disziplinen tragen heute einen echten
Wertungsmodus — `rang` (Spurt/Time-Trial/Climbing), `etappe` (Staffel), `burg` (Takeshi's Castle).

**Folge fuer den Plan:** die Bahn-Welle wartet **nicht** auf eine Entscheidung von Chris. Sie
wartet nur noch auf den `spieleBahn()`-Einstiegspunkt plus eine vierte Chassis-Menge im
`runArenaFixtures()`-Dispatch. Das ist reine Bauarbeit, und sie holt in einem Zug **vier**
Disziplinen mit rho 0,828–0,915 ins echte Spiel.

### 4.2 Die eingecheckte Basislinie ist an zwei Stellen stale — Stand 14.09.: an ACHT
Bestaetigt durch den Messlauf vom 10.09. (s. Abschnitt 1), und durch die Merge-Welle vom 13./14.09.
auf acht Zeilen ausgeweitet — die Tabelle dazu steht in Abschnitt 1. `node
scripts/baue-rangtreue-basislinie.mjs 24` gehoert in den naechsten Pflege-PR; solange sie nicht
gezogen ist, faengt die CI-Schranke nur noch Rueckgaenge gegen einen acht Tage alten Stand.

### 4.3 Die Spalte „Arena" fuehrte drei Bahn-Disziplinen falsch — 14.09. korrigiert
Staffel, Takeshi's Castle und Time-Trial standen in der Tabelle oben mit „nein", obwohl ihre
Gameplay-Zahlen die 30 G2-Punkte laengst enthielten (67→97 bzw. 62→92 am 10.09., jeweils mit
„Produktionsanschluss (G2 0→30)" begruendet). Bei Takeshi stand der Widerspruch sogar **innerhalb
derselben Zeile**: „seit PR #880 produktionsangeschlossen" direkt ueber „Noch nicht
produktionsangeschlossen (kein Eintrag in `ARENA_RESOLVED_DISCIPLINE_IDS`)". Nachgelesen im
aktuellen Code (`lib/resolve/battle-mode-arena-team-points.ts:236-253`): die Menge enthaelt heute
dreizehn Eintraege, darunter `staffel`, `takeshis-castle` und `time-trial`. **Climbing und Spurt
stehen dort bewusst NICHT** — Climbing, weil es die Rangtreue-Schranke nicht besteht, Spurt wegen
des Feldgroessen-Fundes F1 (`jeSeite` ist 4, nicht 6). Beide Spalten sind entsprechend korrigiert;
an den Prozentzahlen aendert sich dadurch nichts, weil sie die Menge schon richtig gelesen hatten.

### 4.4 Eiskunstlauf stand seit PR #903 (13.09.) auf einer ueberholten Zeile — 14.09. korrigiert
Derselbe Fehler wie bei Staffel (4.1 des neunten Nachtrags), nur eine Runde aelter und vom neunten
Nachtrag selbst nicht gefangen: der neunte Nachtrag hat ausdruecklich nur die zehn PRs seiner
eigenen Merge-Welle (#910/#908/#911/#909/#912/#907/#915/#914/#916/#918) geprueft und Eiskunstlauf
bewusst uebersprungen, weil PR #917 noch offen war — dabei aber nicht bemerkt, dass die Zeile schon
VOR dieser Merge-Welle stale war. PR #903 (13.09., „Ton-Aufrufstellen, Kufe-Requisite,
K4-Kalibrierung") stand mit Konzept 90→95 und Assets 70→95 im eigenen Commit-Titel und war zum
Zeitpunkt des neunten Nachtrags laengst auf `main` — die Tabelle zeigte trotzdem weiterhin 90/70.
Mit diesem (zehnten) Nachtrag nachgezogen, zusammen mit PR #917. **Lehre fuer kuenftige Nachtraege:**
ein Nachtrag, der sich nur auf „die PRs der letzten Merge-Welle" beschraenkt, kann eine Zeile
uebersehen, die eine Welle davor liegengeblieben ist — ein `git log -- <scorecard-datei>` gegen
`git log --oneline main -- public/mockups/battle-mode.engine.js` seit dem letzten Nachtrag waere
der zuverlaessigere Check.

---

## 5. Top-Prioritaeten — sortiert nach Hebel je Aufwand

> **Stand 14.09.: die Punkte 1, 3 und 10 sind erledigt** und bleiben nur als Historie stehen.
> Punkt 1 (Bahn-Chassis) ist mit PR #880 am 10.09. gebaut — drei der vier genannten Disziplinen
> sind angeschlossen, Spurt haengt am Feldgroessen-Fund F1 (s. 4.3). Punkt 3 (Zufallswaffen) ist
> seit dem 10.09. projektweit geschlossen (s. 3.2). Punkt 10 (Hockey vertonen) ist mit PR #893 am
> 12.09. erledigt. **Was dafuer neu auf diese Liste gehoert:** die eingefrorene Sprite-Animation
> der vier verbleibenden Bahnen (Spurt/Staffel/Climbing/Takeshi — PR #908 hat nur Time-Trial
> repariert, s. dort; ein umrissener Handgriff je step-Funktion), die Neuziehung der
> Rangtreue-Basislinie (4.2, acht stale Zeilen), und Chris' drei Entscheidungen aus dem
> N-Team-Audit (3.5) — allen voran die 41 % der Spieltage, an denen gar kein Duell laeuft.

1. **Bahn-Chassis bauen (`spieleBahn()`).** Vier Disziplinen auf einen Schlag: Staffel (0,915),
   Takeshi's Castle (0,883), Spurt (0,871), Time-Trial (0,828) — alle vier bestehen die Abnahme,
   alle vier haben eine echte Wertung, allen vier fehlt **nur** der Anschluss. Danach 14 von 20
   produktiv. **Und, neu in diesem Bericht: es ist keine Designfrage mehr vorgelagert** (4.1).
2. **Ton fuer die uebrigen neunzehn.** Der einzige Rueckstand, der jede Disziplin gleich hart
   trifft, und der einzige, bei dem eine einmal gebaute Abstraktion (`sfx(disziplin, name)` statt
   `bkSfx(name)`) sofort zwanzigfach zahlt. Kostet keine Rangtreue-Zeile.
3. **Zufallswaffen-Bug fuer Showcase/Tennis/Wettessen/I-Spy schliessen.** Drei davon sind LIVE.
   Fuenf Zeilen an `:2573-2575`, rho-neutral (bei Fechten/Eiskunstlauf/Breaking bit-identisch
   nachgemessen). Der billigste sichtbare Gewinn im ganzen Feld.
4. **Showcase und Wettessen ein eigenes Konzept geben.** Beide sind produktiv angeschlossen und
   haben ueberhaupt keine Identitaet — sie sind der Buehnen-Durchgangsrechner mit anderen Zahlen.
   Das ist die einzige Stelle, an der eine LIVE geschaltete Disziplin konzeptionell leer ist.
5. **Arena-Messbudget statt Arena-Commit.** TDM/Mini-DM/Battlefield haben die drei schlechtesten
   Zahlen — aber bei allen dreien ist die Kader-Spannweite groesser als der Median. n ≥ 96–150 ist
   die Voraussetzung, bevor irgendjemand die Zielwahl-Umstellung (K1) baut, sonst ist ihr Erfolg
   nicht nachweisbar. Bei den in diesem Bericht gemessenen ~34 s je Disziplin und n=24 waere
   n=150 rund 3,5 Minuten je Disziplin und Variante — machbar, aber zu planen.
6. **Fechtens Rezept kalibrieren.** Es steht LIVE auf einem im Code selbst als „nicht final"
   bezeichneten Entwurf, mit einem Puffer (0,016), der kleiner ist als sein Kaderrauschen (0,192).
   Von den zehn produktiven Disziplinen ist das die einzige mit einem echten Rangtreue-Risiko.
7. **Climbing.** 0,010 Fehlbetrag, aber nie eine eigene Runde gehabt und kein eigenes Dokument —
   die einzige Bahn ohne eigene Modellierung. Als eigene kleine Runde mit groesserem n sinnvoll.
8. **Football.** Der groesste Einzelrueckstand ausserhalb der Arena (0,516) und zugleich die
   Disziplin mit der besten Nicht-Rezept-Ausstattung im Feld. Drei Runden haben zusammen 0,17
   gebracht; was fehlt, ist eine echte Neukalibrierung mit vielen Freiheitsgraden — kein
   umrissener Bugfix.
9. **I-Spy.** Einzige Buehne unter der Schranke. Eine Rezeptrunde nach dem Tennis-Muster (Attribute
   an die Matrix-Proportionen nachziehen) waere der naheliegende erste Versuch.
10. **Basketball vertonen ist fertig — Hockey waere der naechste Kandidat**, weil es als einziges
    ausser Basketball eine eigene Flaeche und eigene Bewegungen hat und den Ton sofort tragen wuerde.

---

## 6. Wo es GAR KEIN eigenes Konzept gibt — die explizite Liste

**Zwei Disziplinen haben kein eigenes Konzept im Sinne des Auftrags** (kein Dokument, das sie von
Grund auf modelliert; keine Mechanik ueber den Chassis-Standard hinaus; nur andere Attributzahlen
im generischen Rezept):

| Disziplin | Was es gibt | Was fehlt | rho | live? |
|---|---|---|---:|:--:|
| **Showcase** | Sieben-Rollen-Standardrezept mit Charisma-Gewichten, sonst nichts | jedes Dokument, jedes Flag, jede eigene Regel, jede Kalibrierrunde | 0,892 | **ja** |
| **Wettessen** | Matrix-Rezept (will/health/stamina, kein Charisma) + eigene `wertungTabelle` | jedes Dokument, jede eigene Mechanik, jede Kalibrierrunde | 0,845 | **ja** |

**Drei weitere haben nur ein GETEILTES Konzeptdokument, kein eigenes** — das ist eine schwaechere,
aber eigene Kategorie:

| Disziplin | geteilte Quelle | Konsequenz |
|---|---|---|
| **Climbing** | `bahn-disziplinen-recherche-fable.md` Abschnitt 4 (Klettern) | echte Recherche vorhanden, aber nie in eine Umsetzungsrunde ueberfuehrt — die einzige Bahn ohne eigene Runde |
| **Speed-Schach** | `takeshi-schach-optik-gameplay-plan-05-09.md` Teil A + `arena-duell-recherche-fable.md` Abschnitt 4 | trotzdem die zweitbeste Rangtreue — hier ist das Fehlen folgenlos |
| **TDM** | `arena-duell-recherche-fable.md`, `arena-mini-dm-tdm-battlefield-rollout-plan.md` | ausdruecklich begruendet: vier eigene Rezepte gebaut, alle vier schlechter oder ununterscheidbar |

**Und eine Disziplin hat ein Konzept, das im Code selbst als unfertig markiert ist:**
**Fechten** — `BUEHNE_ART.fechten` (`:10934`): „ERSTER, AUSDRUECKLICH NICHT FINALER
Sieben-Rollen-Entwurf ... Startpunkt, kein fertiges Ergebnis." Sie ist trotzdem seit Welle 2 live.

---

## 7. Grenzen dieser Pruefung — ehrlich

1. **Keine Sicht-QA.** Es wurde kein Spieltag im Browser durchgeklickt und kein Screenshot
   gemacht. Alle Aussagen ueber Optik und Bewegung stammen aus gelesenem Zeichencode
   (`battle-mode.engine.js`, die zwanzig `*.tsx`-Feld-Dateien) — **„was der Code zeichnet", nicht
   „wie es aussieht".** Insbesondere die Assets- und Movement-Spalten wuerden sich durch eine
   Sichtprobe verschieben, in beide Richtungen. Die Rangtreue-Sonde selbst lief in dieser
   Umgebung problemlos (anders als in der 08.09.-Pruefung, wo Chromium beim Laden der
   Mockup-Seite abstuerzte) — der Headless-Messpfad ist stabil, der Sicht-Pfad ungeprueft.
   **Nachtrag 14.09.: dieser Punkt hat sich als der teuerste der ganzen Liste erwiesen.** Die
   Merge-Welle vom 13./14.09. hat in einer einzigen Nacht sechs Befunde gefunden, die aus
   gelesenem Zeichencode nicht sichtbar waren und erst ein Blick bzw. eine gezielte Sonde zutage
   gefoerdert hat: die konzentrischen Ellipsen der Staffelbahn, die auf `pos` statt auf die Zone
   gruppierten Wartenden, die nie gefeuert haben, die eingefrorene Sprite-Uhr aller fuenf Bahnen,
   der angeschnittene Bildindex aller zwanzig Disziplinen, die selbstrekursive Hoehenkorrektur und
   die Hantel, die fuenf von siebzehn Figuren gar nicht bekamen. **Jeder einzelne war aus dem
   Quelltext prinzipiell herleitbar und ist trotzdem monatelang niemandem aufgefallen.** Die
   Assets- und Movement-Spalten sind deshalb nach oben verzerrt, wo eine Disziplin nur an ihrem
   Zeichencode eingestuft wurde — nicht systematisch, aber unberechenbar.
2. **Die Animationszahl ist ein Proxy, kein Mass.** „Animationsstellen" ist die Trefferzahl von
   `anim|keyframes|transition` je Feld-Datei. Eine Datei mit 3 Treffern (Showcase, Eiskunstlauf,
   Takeshi) kann trotzdem gut aussehen; eine mit 22 (Fechten) kann flimmern. Die Zahl zeigt
   Investition, nicht Qualitaet.
3. **Die Prozentwerte sind eine Einstufung, keine Messung.** Nur die rho-Spalte ist gemessen.
   Die Rubrik in Abschnitt 0 macht die Einstufung nachpruefbar, aber die Gewichte darin sind
   gesetzt, nicht hergeleitet — eine andere Rubrik ergaebe andere Zahlen. Was sie nicht aendert,
   ist die REIHENFOLGE an den Enden: Basketball/Hockey oben, I-Spy/Showcase/Wettessen unten fallen
   in jeder plausiblen Gewichtung gleich aus.
4. **Kein Zugriff auf den Server** (CLAUDE.md). Alle Aussagen ueber Spielstaende stammen aus der
   Kaderfamilie, die am 03.09. aus dem `live-save`-Abbild gezogen wurde. Die Spiegel-Frische wurde
   fuer diesen Bericht nicht neu geprueft.
5. **Kein aktiver Save nutzt Battle Mode.** Unveraendert seit Welle 1: alle Saves im
   `live-save`-Abbild haben `scenarioMeta.gameMode` nicht gesetzt. Die gesamte
   Produktionsanschluss-Spalte (die 30 Gameplay-Punkte fuer zehn Disziplinen) ist damit **real,
   aber latent** — sie wirkt sich auf keinen von Chris' aktuellen Spielstaenden aus, bis ein NEUER
   Save mit Battle-Mode-Wahl angelegt wird.
6. **Der Torwart-Sonderfall.** Hockey ist die einzige Disziplin mit zwei Zahlen (0,669 alle zwoelf
   / 0,719 nur Feldspieler). Fuer die Tabelle oben ist die Zwoelferzahl verwendet, weil sie das
   reale Spiel misst — die Feldspielerzahl waere die freundlichere und ebenfalls vertretbare Wahl.
