# Architektur- und Rollout-Plan: Battle Arena für 20 Disziplinen

Recherche-Stand: 2026-08-29, Repo `/home/user/Olympiade-der-Welten`, HEAD `f05d1316`
(„Basketball-Feinschliff Runde 2"). Alle Datei-/Funktionsangaben sind gegen den echten Code
geprüft. Geschrieben aus der Projektmanager-Rolle auf Chris' Ansage: „wir wollen ja nun 20
Diszis customizen […] wenn wir das einmal modular aufsetzen und für Basketball haben,
erhoffe ich mir dass wir darauf für andere Diszis aufbauen können."

**Achtung, parallel:** Ein zweiter Agent rebalanciert gerade die Basketball-Rezepte auf ein
strengeres Ziel (≤15 Pp, vier Archetypen). Dieser Plan fasst deshalb bewusst **keine
Rezeptwerte** an und plant nur Struktur — Umsetzung der Struktur-Punkte erst nach Merge
dieser Runde, sonst Konflikt in `battle-mode.engine.js`.

> **Stand 01.09.: Abschnitt 1.2 Punkte 1 und 2 sind umgesetzt** (die Basketball-Runde
> „NBA-2K-Modell", PR #710, ist gemergt, die Sperre oben also aufgehoben).
> — **Punkt 1:** `public/mockups/battle-mode.rezepte.js` existiert, wird in
> `battle-mode.html` **vor** dem Motor geladen und setzt `window.__ARENA_REZEPTE`.
> Im Motor zieht `rezeptAus(dId, inline)` die vier Chassis-Tabellen einmal nach
> (`rezepteNachziehen`, direkt hinter `BAHN_ART`): Daten-Datei gewinnt, sonst gilt das
> Inline-Rezept, und „weder noch" wirft laut. Ausgelagert ist bisher **nur Basketball**
> (mit seiner kompletten Kalibrier-Historie); die übrigen 19 laufen unverändert über den
> Rückfall und ziehen einzeln nach. Keine Zahl geändert — `spieleBasketball(1337)` liefert
> vorher wie nachher dasselbe Ereignisprotokoll, Zeichen für Zeichen.
> — **Punkt 2:** `window.__arena.spiele(dId, saat)` gibt es, generisch über `MOTOREN[dId]`
> (sichern/vorher/bau/lauf/wert/namen + zurück), Rückgabe
> `{disziplin, protokoll, wert, punkte, namen}`. `spieleBasketball` ist jetzt ein Alias auf
> denselben Ablauf. Dabei ist ein **Fund** aufgefallen, der bewusst NICHT mitrepariert
> wurde: der historische Deckel `guard<20000` in `spieleBasketball` sind 333 s
> Simulationszeit, ein Spiel dauert seit der Viertel-Umstellung aber 360 s — der Hook
> schneidet also seit dieser Umstellung jedem Spiel die letzten ~27 s ab (166 statt 183
> Ereignisse bei Saat 1337). `spiele()` nutzt den korrekten Motor-Deckel und spielt zu
> Ende; `spieleBasketball` behält den alten Deckel wortgleich, damit dieser reine
> Struktur-Umbau kein Verhalten verschiebt. Den Deckel zu räumen verschiebt Messwerte
> (Schlussviertel-FG%) und gehört in eine eigene Runde mit eigener Abnahme.
>
> **Nachtrag 01.09.: erledigt (PR #731).** Der Absatz darüber ist das Protokoll von
> #726 und beschreibt nicht mehr den Ist-Stand. Die eigene Runde hat stattgefunden:
> `spieleBasketball` lässt `opt.lauf` jetzt weg und nutzt `M.lauf()` (166 → **183**
> Ereignisse bei Saat 1337, wie hier vorhergesagt). Dabei kam eine **zweite** Fundstelle
> desselben Deckels dazu, die #726 nicht kannte: `basketballProbe`, also die Sonde hinter
> der Rangtreue-Abnahme selbst — dort griff er in **12 von 12** Spielen, `done` wurde nie
> erreicht, die Uhr stand bei 306,9–330,3 s von 360. Jede Rangtreue-Zahl vor #731 ist
> damit an abgeschnittenen Spielen entstanden. Die Verschiebung ist gemessen und steht in
> #731: rho(ges) 0,793 → 0,798 bei n=100 (die Rangtreue hält), Punkte/Spiel 77,8 → 86,8,
> FGA 72,9 → 82,0 — rund 12 % mehr Volumen, weil das Schlussviertel jetzt mitgespielt wird.
> Die dritte Fundstelle (`bahnLauf`) bleibt bewusst stehen, sie bindet nie.
> Offen aus 1.2 bleiben Punkt 3 (Archetyp-Demo-Skript), Punkt 4 (Runbook) und Punkt 5
> (Wertungstabellen-UI).

---

## 0. Befund vorab: mehr ist schon modular, als der Auftrag vermutet

1. **Das Mess-Werkzeug ist bereits generisch, keine Basketball-Kopie.**
   `scripts/messe-arena-einfluss.mjs <disziplin> <n>` fragt `window.__arena.motoren()`,
   `einflussVon(d,n)` und `matrix(d)` ab — es kennt keine Disziplin beim Namen. Die
   Pp-Berechnung (Einflussvektor gegen Matrix, Beträge aufsummiert) sitzt einmal in
   `einflussVon` (engine.js, ab Z. ~10050) und gilt für alle. Hier ist **nichts** neu zu
   bauen, nur zu benutzen.
2. **Die `MOTOREN`-Registry ist der schon existierende gemeinsame Vertrag.** Jede der 20
   Disziplinen meldet sich mit `sichern()/zurueck()/vorher()/bau(saat)/lauf()/namen()/wert()`
   an (engine.js Z. ~10074–10165), gruppiert über die vier Chassis-Tabellen `ARENA_ART`
   (Kampf, 4 Disziplinen), `BAHN_ART` (5), `BUEHNE_ART` (7, inkl. Denkduell-Variante),
   `FELDSPIEL_ART` (4). Alle 20 haben eine Erst-Mockup-Version. Der Zyklus ist also nicht
   „für 19 Disziplinen von null" — für mehrere (Fechten, Battlefield, Gewichtheben, …)
   wurde bereits ad hoc gemessen und nachgezogen (die `NACHGEZOGEN`-Kommentare belegen es).
3. **Was wirklich fehlt, ist dreierlei:** (a) die Rezepte liegen als Inline-Daten verstreut
   in einer 10.425-Zeilen-Datei — jede Kalibrier-Runde editiert mitten im Motorcode;
   (b) das in dieser Session erarbeitete **Vorgehen** (Chris' Attribut-Budget-Methode,
   Mess-Fallen, n-Werte, Zielschwellen) existiert nur als Kommentar-Archäologie im
   Basketball-Block; (c) Demo-/Archetyp-Verifikation und „ein Spiel, ein Protokoll"
   existieren nur für Basketball (`spieleBasketball(saat)`, engine.js Z. ~10405).
4. **Eine Vorhersage des Zyklus ist gescheitert und bleibt gestrichen.** Das lineare
   Einfluss-Gewichts-Modell hatte in der Kreuzvalidierung ~49 Pp Prognosefehler (im
   Basketball-Rezeptkommentar dokumentiert, Z. ~2985 ff.); fünf von fünf daraus abgeleitete
   Rezepte waren schlechter als das gemessene. Konsequenz für die Architektur: **wir bauen
   Werkzeuge, die die Mess-Schleife verkürzen, keine Modelle, die sie ersetzen.**
5. **Eine bekannte Chassis-Falle muss ins Runbook, nicht in jedes Rezept neu entdeckt
   werden:** `aufEignung()` normiert LP/ANG/VER auf die Eignung, TMP/AUS aber nicht — ein
   Attribut dort bekommt einen Bonus erster Ordnung, egal was die Matrix sagt. Das hat
   Battlefield (110 Pp) und Fechten je eine verworfene Runde gekostet.

---

## 1. Modularisierung des Rezept→Formel→Messung→Nachjustieren→Demo-Zyklus

### 1.1 Was PRO DISZIPLIN zwingend eigen bleibt (und bleiben soll)

- **Die Sub-Skill-Struktur samt Namen.** Basketballs zehn Sub-Skills (AUFBAU, SCHUSS_NAH,
  SCHUSS_FERN, ZWEITCHANCE, ABWEHR, TEAMGEIST, …) sind basketballspezifisch; Kampf hat
  fünf (ANG/VER/LP/TMP/AUS), Bühne sieben Rollen (GRUNDLAGE, SPITZENMOMENT, TECHNIK, …).
  Ein Zwang auf ein Einheitsschema wäre falsch — gemeinsam ist nur die **Form**: jedes
  Rezept ist `{SUBSKILL: {attribut: prozent}}` mit Budget-Summen. Diese Form ist heute
  schon überall identisch; sie wird zum dokumentierten Datenformat erklärt, nicht geändert.
- **Die Erfolgsformel je Chassis/Disziplin.** `technikMake`/`GEO_BONUS`/`bedraengnisGate`/
  `kontestFaktor` sind gegen reale FG%-Referenzen kalibriertes Basketball-Eigentum. Ein
  Runden-TDM, ein Bühnen-Durchgang, ein Bahnrennen haben fundamental andere Mechanik.
  Keine gemeinsame „Formel-Schnittstelle" oberhalb des Motor-Vertrags erzwingen — der
  Vertrag ist bereits `MOTOREN[d].wert()`: „liefere je Teilnehmer eine Zahl, größer ist
  besser". Das ist die einzige Entscheidung, die je Disziplin fällt, und das soll so bleiben.
- **Die Abnahme-Definition:** Ziel-Pp-Schwelle und die erwarteten Archetypen (welche
  Spielertypen müssen sich im Ergebnis erkennbar unterscheiden) sind Produktaussagen je
  Disziplin, keine Technik.

### 1.2 Was WIRKLICH generalisierbar ist — und die konkreten Struktur-Änderungen

1. **Rezepte aus dem Motorcode herauslösen → neue Datei `public/mockups/battle-mode.rezepte.js`.**
   Eine Datei, die vor `battle-mode.engine.js` geladen wird und ein globales
   `window.__ARENA_REZEPTE = { basketball: {...}, fechten: {...}, ... }` definiert; die
   vier `*_ART`-Tabellen behalten Label/Mechanik-Parameter (`jeSeite`, `punkteNah`,
   `rundenN`, …), lesen ihr `rezept` aber von dort (`rezept: R("basketball")` mit Fallback
   auf Inline, damit der Umbau schrittweise gehen kann). Gewinn: Kalibrier-Runden (auch
   parallele Agenten) editieren nur noch diese Daten-Datei; Diffs sind lesbar; die
   Rezept-Kommentare (Mess-Historie!) ziehen mit um. Kein Build-Schritt, kein Bundle —
   dieselbe „eine HTML-Datei"-Philosophie wie bisher.
2. **`spieleBasketball` generalisieren → `window.__arena.spiele(dId, saat)`.** Additiver
   Patch nach exakt dem `namenVon()`-Muster: über `MOTOREN[dId]` sichern/bauen/laufen,
   zurückgeben `{disziplin, protokoll (fsZuege o. Chassis-Äquivalent), wert: M.wert(),
   punkte je Seite falls Team-Disziplin}`. `spieleBasketball` bleibt als Alias bestehen.
   Das ist zugleich der Baustein, den `battle-mode-spielmodus-plan.md` (Fund 6 dort) für
   den späteren Headless-Resolve sowieso braucht — einmal bauen, zweimal nutzen.
3. **Demo-/Archetyp-Verifikation als ein Skript → `scripts/arena-archetyp-demo.mjs
   <disziplin> [n]`.** Playwright-Grundgerüst (Browser-Start, Pool-JSON laden, `spiele()`
   n-mal, Ereignisse aggregieren) ist zu 90 % disziplinunabhängig; disziplinspezifisch ist
   nur eine kleine Deklaration: welche Archetypen es gibt und an welchen Kennzahlen sie
   sich zeigen müssen (z. B. Basketball: Scorer-Fern → höchster Dreieranteil). Vorschlag:
   `scripts/arena-archetypen/<disziplin>.json` mit `{archetyp, erkennbarAn, erwartung}`.
   Das Basketball-Ad-hoc-Skript dieser Session wird die erste Instanz, nicht die Vorlage
   zum Kopieren.
4. **Das Vorgehen als Runbook → `docs/design/arena-kalibrier-runbook.md`** (eine Seite,
   Checkliste, keine Prosa): Matrix lesen → Rezept nach Chris' Budget-Methode verteilen
   (jedes Attribut verteilt sein Matrixgewicht als 100-%-Budget auf logisch passende
   Sub-Skills) → `messe-arena-einfluss.mjs` mit **zwei Saatstämmen** fahren (eine Messung
   ist eine Stichprobe, s. Basketball-Doppellauf 17,2/19,4 Pp) → nur gleichgerichtete
   Abweichungen behandeln → Archetyp-Demo → fertig ab Schwelle. Plus die Fallenliste
   (TMP/AUS-Normierungsbonus, mechanisch tote Sub-Skills wie Basketballs AUSDAUER,
   Mindest-n je Chassis: Bahn 48, Staffel 144, TDM klein anfangen). Damit ist der
   Session-Erkenntnisstand übertragbar, statt in Kommentaren einer Datei zu wohnen.
5. **Wertungstabellen-UI:** die Zwei-Team-Block-Tabelle mit Eignung/Impact/FG%-Spalten aus
   dieser Session gilt für alle Team-Disziplinen; Spaltensatz je Chassis konfigurierbar
   (Bühne: Durchgangspunkte statt FG%). Kleiner UI-Refactor, kein eigenes Projekt —
   zusammen mit der jeweils ersten Nicht-Basketball-Disziplin desselben Chassis machen.

**Definition „eine neue Disziplin aufsetzen" nach diesem Umbau:** 1 Rezept-Eintrag in
`battle-mode.rezepte.js` + 1 Archetyp-Deklaration + Runbook-Schleife fahren. Motorarbeit
fällt nur an, wenn die Disziplin neue **Mechanik** braucht — und dann im Chassis, damit
die Geschwister sie erben.

---

## 1.3 Die Abnahmezahl gilt JE SPIEL, nicht je Saison

**Nachgetragen am 02.09. auf Chris' Ansage** — und es verschiebt die Reihenfolge weiter
unten, deshalb steht es vor ihr.

Chris wörtlich: *„wichtig wäre auch dass es irgendwie möglich ist das umzusetzen innerhalb
von einem spiel! Wir haben ja pro season dann nur 2x Hockey. das muss also auch für sich
wenn es einmal dran kommt REALISTISCH ablaufen und >80% sein"*, und unmittelbar danach:
*„und das gilt natürlich für alle diszis merke dir das schon mal für das gesamtprojekt"*.

Bis hierher war die stillschweigende Annahme, dass sich eine Rangtreue über viele Spiele
einstellen darf. Sie darf nicht. Je Disziplin fallen in einer Saison nur wenige Spiele an;
eine Ordnung, die erst im Aggregat sichtbar wird, existiert für den Spieler nicht.

**Neue Abnahmeschranke für jede Disziplin: rho über 0,80 in einem einzelnen Spiel,
angestrebt 0,85.**

### Warum das eine Frage der Mechanik ist, nicht der Uhr

**Korrigiert am 02.09., nachdem der erste Anlauf sich verrechnet hatte.** Die erste Fassung
dieses Abschnitts nannte einen Deckel von 0,67 und schloss daraus, Hockey sei je Einzelspiel
nicht auf 0,80 zu bringen. Beides war falsch: der Deckel war ein Messartefakt (die
Torwärter und die Formkarten steckten mit in der Rechnung), und der Schluss zeigte in die
falsche Richtung.

Eine Einzelspiel-Rangtreue zerfällt in ein Produkt zweier Größen:

    rho(ein Spiel) = rho(Saison) x Wurzel(Verlaesslichkeit)

| Größe | was sie sagt | woran sie hängt |
|---|---|---|
| **Verlässlichkeit** | wie gut ein Spiel das nächste vorhersagt | Ereigniszahl je Spiel |
| **Validität** = rho(Saison) | ob die Mechanik belohnt, was die Eignung misst | Rezept und Kanäle |

Nachgemessen für Hockey (24 Spiele, 10 Feldspieler, Einweg-ICC): Verlässlichkeit **0,755**,
Validität **0,82**, Produkt 0,711 — gemessen 0,719. Die Formel trägt auf ±0,01, geprüft an
drei Datensätzen.

**Mehr Ereignisse helfen fast nie.** Mit verlängerten Dritteln (3x2:00 und 3x2:40) stieg
die Verlässlichkeit auf 0,80 und 0,85 — und rho blieb bei **0,719 / 0,721 / 0,723**. Flach.
Bezahlt hätte man mit 5,6 statt 3,2 Toren je Team (real 3,0) und doppelter Zuschauzeit.
Unser Hockeyspiel hat je Minute ohnehin schon die dreizehnfache NHL-Ereignisdichte.

**Wer die Rangtreue heben will, arbeitet an der Validität.** Für Hockey heißt das konkret:
die gewonnenen losen Pucks tragen 40 % der Impact-Masse, sind mit einer Verlässlichkeit von
0,94 die stabilste Größe im Spiel — und hängen an der AUFSTELLUNGSPOSITION statt an
Attributen. Wer vorm Tor steht, holt sie. Das ist der Grund, warum die Validität bei 0,82
klebt, und es ist Motorarbeit, keine Rezeptarbeit.

### Was rho drückt, ist oft gar kein Fehler

In Hockey steht der eignungsbeste Feldspieler in **79 %** der Spiele auf Rang 1, in **94 %**
in den ersten zwei, in **0 %** auf dem letzten. Paare mit mindestens 15 Eignungspunkten
Abstand werden zu **99 %** richtig geordnet. Was rho nach unten zieht, sind die 90 von 480
Paaren mit weniger als zwei Punkten Abstand: dort liegt die Trefferquote bei 39 %, also beim
Münzwurf — und das ist richtig so. Ein Motor, der auch die ordnet, ist einer, in dem der
Ausgang aus der Aufstellung folgt statt aus dem Spiel.

**Die ehrlichere Abnahme fragt deshalb nach dem Star und nach der Paartreue mit Abstand:**

| Kriterium | Ziel | Hockey heute |
|---|---:|---:|
| Eignungsbester Feldspieler in den ersten zwei | ≥ 90 % | 94 % |
| Paare ab 6 Eignungspunkten Abstand richtig | ≥ 90 % | 82 % |
| Paare ab 15 Punkten richtig | ≥ 97 % | 99 % |
| Rolle mit eigener Wertformel (Torwart) | getrennt geprüft | — |

Die nackte Rangkorrelation bleibt als Kennzahl daneben stehen; sie ist nur nicht mehr die
einzige, und sie ist nicht die, an der eine Disziplin scheitert.

### Werkzeuge

| Skript | Frage |
|---|---|
| `scripts/miss-feldspiel-rangtreue.mjs <diszi> 24 6` | die Abnahmezahl selbst |
| `scripts/miss-rangtreue-nach-rolle.mjs <diszi> 48` | welche Rolle sie drückt |
| `scripts/sondiere-feldspiel-subskills.mjs <diszi> 24` | was ein Sub-Skill mechanisch wiegt |
| `scripts/baue-feldspiel-rezept.mjs <diszi> <sondierung>` | das Rezept daraus rechnen |

---

## 2. Reihenfolge für die 19 verbleibenden Disziplinen

Empfehlung in vier Wellen; innerhalb einer Welle ist die Reihenfolge Geschmackssache
(→ Frage 4.4 an Chris, welche Disziplinen ihm am Herzen liegen).

- **Welle 0 — systematische Nachmessung aller 19 (billig, sofort, teils parallel zur
  Struktur aus Abschnitt 1).** Das Werkzeug läuft heute schon für alle Motoren; einmal
  komplett durchmessen liefert die ehrliche Lückenliste („welche Disziplin liegt wo über
  der Schwelle") statt Vermutungen. Ergebnis-Tabelle ins Runbook.
- **Welle 1 — Football und Hockey auf Basketballs Live-Engine.** Gleiche Feldstruktur
  (zwei Körbe/Tore, Ballträger, Manndeckung), maximale Wiederverwendung von
  `initBasketballLive`/`stepBasketballLive`/`bewegeSpielerLive`; der Umbau besteht darin,
  die heute hart auf `feldspielDisc==="basketball"` gegateten Weichen (engine.js Z. 3460,
  4840) auf eine Chassis-Konfiguration zu heben (Tor statt Korb, Foul-Worte, Zonen).
  Hier entsteht der Beweis, dass „modular" stimmt — und die zweitgrößte Spieler-Sichtbarkeit
  nach Basketball.
- **Welle 2 — Kampf-Chassis polieren (TDM, Mini-DM, Fechten, Battlefield).** Diese haben
  bereits eine eigene Echtzeit-Simulation (`build()`/`stepSim()`), brauchen keine
  Migration — nur Runbook-Kalibrierung (teils erledigt) und die Feature-/UI-Angleichung
  (Wertungstabelle, Highlights).
- **Welle 3 — Bahn und Bühne (12 Disziplinen).** Ihre Modelle (Rennen, Durchgänge) sind
  ihrer Natur nach „vorab" und sollen es bleiben — ein Rennen ist kein Manndeckungsspiel.
  Aufwand je Disziplin nach Abschnitt 1: Rezept + Messung + Archetyp-Demo, kein Motorbau.
  Takeshi's Castle als Chaos-Sonderfall ans Ende der Bahn-Gruppe.
- **Sonderfälle zuletzt: Tennis und die Denkduelle (Speed-Schach, I-Spy).** Tennis teilt
  zwar das Feldspiel-Chassis, ist aber strukturell kein Manndeckungsspiel (kein
  Ballträger-Duell, Netz statt Korb) — Entscheidung über Live-Migration erst **nach** den
  Football/Hockey-Erfahrungen. Denkduelle haben schon ihre Bühne-Variante und niedrige
  Visualisierungs-Erwartung.

---

## 3. Der Feature-Rückstand: Freiwurf, Schiedsrichter, Fokus-Doppeln

Alle drei sind **Ausbauten des Live-Engine-Kerns, keine reinen Basketball-Extras** — die
richtige Schnittstelle entscheidet, ob Football/Hockey sie in Welle 1 geschenkt bekommen.

1. **Freiwurf-Formation — mittel, zuerst.** Der generische Kern ist eine
   **Unterbrechungs-/Standphase** im Feldspiel-Live-State (`fsLive.phase: "laufend" |
   "formation"`, Spieler bekommen Formations-Slots statt Manndeckungs-Ziele, Uhr hält an).
   Genau dieselbe Phase braucht Football (Snap-Aufstellung) und Hockey (Bully). Die
   Freiwurf-**Ausprägung** (Linie, 2/3 Würfe, Rebound-Aufstellung) ist Basketball-Konfig
   obendrauf. Mechanisch existieren Freiwürfe schon — hier fehlt nur Sichtbarkeit, und die
   Lücke ist für den Zuschauer heute am irritierendsten („2 Freiwürfe" ohne Bild).
2. **Schiedsrichter — klein bis mittel, direkt danach.** Ein Nicht-Spieler-Akteur (Sprite,
   Position am Spielfeldrand, läuft bei Foul-Ereignis zum Tatort, Pfiff-Animation/-Ton).
   Baut auf der Standphase aus Punkt 1 auf (der Pfiff **löst** sie aus — deshalb diese
   Reihenfolge). Als generisches „Offizielle"-Konzept anlegen (Bühne-Jury und Bahn-Starter
   sind dieselbe Sorte Akteur), aber nur die Basketball-Ausprägung bauen.
3. **Fokus-Doppeln — mittel, zuletzt.** Klick auf Gegenspieler → Help-Defense-Bias. Die
   Hälfte existiert: `bewegeSpielerLive` hat bereits Doppel-Hilfe über `HILFE_RADIUS`
   (Z. 3365); neu sind Klick-Ziel-Auswahl (UI), ein Bias-Parameter in der Hilfe-Logik und
   die Anzeige „wird gedoppelt". Zuletzt, weil es die einzige **neue Interaktionsart**
   ist (bisher ist die Arena reiner Zuschau-Modus — s. Frage 4.5) und weil dieselbe
   Fokus-Idee im Kampf-Chassis (Focus Fire) wiederkommt: einmal als generisches
   „Nutzer-Fokus-Ziel"-Konzept entwerfen, in Basketball zuerst ausprägen.

---

## 4. Offene Entscheidungen für Chris

Formuliert so, dass keine Architektur-Vorkenntnis nötig ist; meine Empfehlung steht jeweils dabei.

1. **Ersetzt das Live-Modell alle Feldspiele — oder alle 20 Disziplinen?**
   *Empfehlung:* Live nur für Football und Hockey nachziehen (Welle 1); Bahn/Bühne/Kampf
   behalten ihre eigenen, zur Sportart passenden Modelle; Tennis entscheiden wir nach den
   Football-Erfahrungen. „Ein Modell für alles" klingt ordentlich, würde aber für ein
   Rennen oder einen Bühnenauftritt Mechanik erzwingen, die dort nichts misst.
2. **Breite oder Tiefe zuerst?** Alle 19 grob auf Schwelle bringen (Welle 0, Wochen) oder
   wenige so poliert wie Basketball (Monate je Disziplin)?
   *Empfehlung:* Breite zuerst — Welle 0 komplett durchmessen und kalibrieren, Tiefe
   danach gezielt für je **eine** Leuchtturm-Disziplin pro Chassis (Basketball hat das
   Feldspiel-Los schon gezogen). So sieht jede Disziplin im Spiel plausibel aus, bevor
   irgendeine zweite perfekt wird.
3. **Eine Zielschwelle oder zwei?** Aktuell schwankt die Abnahme zwischen ≤15 und ≤25 Pp.
   *Empfehlung:* ≤25 Pp als allgemeine Abnahme (Welle 0), ≤15 Pp nur für
   Leuchtturm-Disziplinen — die Basketball-Messhistorie zeigt, dass unter ~17 Pp die
   Saatstamm-Streuung dominiert; dort wird weiteres Drücken teuer und teils Scheingenauigkeit.
4. **Welche Disziplinen liegen dir am Herzen?** Die Wellen-Reihenfolge oben ist nach
   Wiederverwendung und Aufwand sortiert; nur du kennst die Spielerbasis-Sicht (welche
   Disziplin schauen du/Franky am liebsten?). Nenn uns je Welle 1–2 Favoriten, die ziehen
   wir vor.
5. **Darf der Zuschauer eingreifen?** Fokus-Doppeln bricht erstmals die bisherige Regel
   „zuschaubarer Auto-Battler ohne Steuerung" (`BATTLE_ARENA_UEBERGABE.md`).
   *Empfehlung:* Ja, aber als klar begrenzte Kategorie „taktische Ansage" (ein aktives
   Fokus-Ziel, jederzeit änderbar, kein Direkt-Steuern) — das bleibt Manager-Fantasie
   statt Actionspiel. Wenn du das grundsätzlich nicht willst, streichen wir Punkt 3.3
   ersatzlos, der Rest des Plans hängt nicht daran.

---

## 5. Kern-Dateien für den Einstieg

- `public/mockups/battle-mode.engine.js` — die vier `*_ART`-Tabellen (Z. 2799/5146/8398/2958),
  `MOTOREN`-Registry (~10074), `window.__arena` (~10315), Basketball-Live (`initBasketballLive` 3670,
  `bewegeSpielerLive` 4376, `stepBasketballLive` 4621)
- `public/mockups/battle-mode.rezepte.js` — neu (Abschnitt 1.2 Punkt 1)
- `scripts/messe-arena-einfluss.mjs` — bereits generisch, bleibt das Abnahme-Werkzeug
- `scripts/arena-archetyp-demo.mjs` + `scripts/arena-archetypen/<disziplin>.json` — neu (1.2 Punkt 3)
- `docs/design/arena-kalibrier-runbook.md` — neu (1.2 Punkt 4)
- `docs/BATTLE_ARENA_UEBERGABE.md` — Chassis-Überblick und die „Keine erfundenen Werte"-Regel
- `docs/design/battle-mode-spielmodus-plan.md` — Nachbarplan; `spiele(dId, saat)` (1.2 Punkt 2)
  ist dort als Headless-Baustein bereits eingeplant, wir bauen ihn genau einmal
