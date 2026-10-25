# Takeshi's Castle: Übersichtlichkeit bei vielen Teilnehmern — Konzeptrunde (15.10.)

**Punkt 10** aus `docs/design/chris-feedback-breite-runde-13-10.md` (Abschnitt „Takeshi's Castle").
Chris, 13.10., wörtlich: „bisher wirkt es sehr unübersichtlich mit den ganzen Teilnehmern aber da
hab ich gerade keine Idee wie man es besser machen könnte, nacheinander ist auch doof." Er benennt
ausdrücklich nur das Problem, hat selbst keine Lösung, und lehnt „nacheinander" — sequenzielle
1v1-Antritte wie Fechten/Tennis/Schach — explizit ab.

**Reines Konzeptpapier, kein Code.** Keine Zeile in `public/mockups/battle-mode.engine.js` oder
`app/foundation/discipline-stage/arena/disciplines/takeshi.tsx` ist in dieser Runde angefasst. Das
ist Absicht (s. Abschnitt 0) und hält diese Runde von der parallel laufenden Time-Trial-Arbeit
strikt getrennt.

---

## 0. Ergebnis vorab — wichtiger als jede einzelne Option

**Diese Frage wurde bereits bearbeitet, nicht nur gestellt.** Dieselbe Konzeptrunde („K2") lief
schon am 14.10. (`docs/design/takeshi-uebersicht-konzept-14-10.md`, aus Abschnitt 5.2 desselben
Master-Papiers, `docs/design/fable-konzept-chris-feedback-13-10.md`). Zwei der drei dort
skizzierten Wege sind **bereits gebaut und auf `main` gemerged**:

- Commit `5d88f69c` „Takeshi's Castle: Streckenband + Hauptdarsteller-Hervorhebung (K2, Task
  #111/10)" — nachgewiesen im Git-Log dieses Checkouts (`origin/main`).
- **T-Ü3 Streckenband:** ein schmales Übersichtsband mit Start/Burg/Fallen-Markern und jedem
  Läufer als Punkt (`takeshi.tsx` Z. 258 ff., `bandX0`/`bandX1`/`bandY`).
- **T-Ü1 Hauptdarsteller (statischer Teil):** drei bis vier Läufer (Führender, eigener Bester,
  an-einer-Falle-hängend, Burg erreicht) bleiben in voller Größe mit Namen, der Rest wird kleiner
  (0,62×) und entsättigt (`data-testid="hauptdarsteller-name"`, Z. 631).

**Was ausdrücklich NICHT gebaut ist und am 14.10. bewusst offenblieb, mit Fragen an Chris, die
noch unbeantwortet sind:**

1. Die **bewegte Kamera** (T-Ü1-Regie bzw. T-Ü2-Wipeout-Schnitt) — ein echter Crop/Zoom auf die
   jeweils relevantesten Läufer, der den gemeinsamen Host (`DisciplineStageNativeArena.tsx`)
   anfasst und Sendezeit/Bildausschnitt verändert (Klasse T, braucht Chris' ausdrückliches Go).
2. Ein Fix für **Namensschild-Kollisionen**, wenn zwei Hauptdarsteller nah beieinanderliegen (vom
   14.10.-Papier selbst gemessen: Überlappungen stiegen von 0,0 auf 0,3 Paare/Frame, weil Namen
   breiter sind als Rang-Badges).
3. Die **T-Ü2-Stationstafel** als Ticker-Zusatz.

**Diese Runde dupliziert das 14.10.-Papier nicht**, sondern setzt genau an diesen drei offenen
Stellen an, bewertet sie als eigenständige Optionen (statt als unbeantwortete Fragen stehen zu
bleiben), und ergänzt sie um Ideen und Fremdformat-Recherche, die am 14.10. noch nicht Teil des
Papiers waren. Wo eine Option mit dem 14.10.-Papier identisch ist, wird das benannt, nicht neu
erfunden.

**Keine Entscheidung wird hier vorweggenommen.** Jede Option bekommt Aufwandsklasse, rho/Pp-Bezug
und eine ausdrückliche Prüfung gegen „nacheinander ist auch doof". Die Reihenfolge, in der gebaut
wird — oder ob überhaupt weitergebaut wird —, bleibt eine offene Frage für Chris (Abschnitt 6).

---

## 1. Ausgangslage (kurz, Details im 14.10.-Papier)

`takeshis-castle` läuft über das geteilte Bahn-Chassis (wie Spurt/Staffel/Climbing/Time-Trial),
mit einer eigenen Feld-Komponente `takeshi.tsx`. Produktionsnahe Teilnehmerzahl: **12**
(`scripts/miss-alle-disziplinen.mjs 3 takeshis-castle --einzelkader`), der Dev-Harness testet mit
32 synthetischen Teams als Stresstest. Die bestehende Rang-Skalierung (`tokenRankScale`,
`benchmark.tsx`, geteilte Infrastruktur aller 20 Disziplinen) macht Führende bereits größer als das
Mittelfeld, unterscheidet aber nicht nach **Erzähl-Rolle** — das schließt T-Ü1 (bereits gebaut).

**Gemessener Stand:** rho je Spiel 0,874 kaderfest (`stand-aller-disziplinen.md`), zuletzt
nachgemessen 0,858/0,879 je nach Kaderziehung — komfortabel über der 0,80-Schranke, Puffer
vorhanden. Alle Optionen unten sind reine Anzeige (Klasse A) oder reine Präsentationsentscheidungen
(Klasse T wegen Sendezeit, nicht wegen Mechanik) — **keine berührt `rr()`, `score`, `rank` oder
eine Rezeptkonstante**, also keine der Pflichtprüfungen aus CLAUDE.md (rho>0,80, Pp≤25) wird durch
diese Runde ausgelöst. Das gilt für alle neun Optionen unten; wo eine Option das nicht mehr wäre
(sie würde die Reihenfolge, in der Teilnehmer tatsächlich handeln, ändern), ist das explizit
vermerkt.

**Eine Lehre aus dem Master-Papier, hier wichtig genug für eine eigene Zeile:** „Nicht
'nacheinander antreten', sondern 'nacheinander schneiden'" (`fable-konzept-chris-feedback-13-10.md`
Abschnitt 5.2). Jede Kamera-/Schnitt-Option unten lässt die Simulation für alle Teilnehmer
gleichzeitig weiterlaufen — nur die Kamera, nie die Ausführungsreihenfolge, wechselt. Das ist der
Prüfpunkt, an dem jede Option gegen Chris' Ablehnung gehalten wird.

---

## 2. Cross-Projekt-Präzedenz: wurde „viele gleichzeitige Teilnehmer" schon gelöst?

Drei Disziplinen im Projekt haben ein verwandtes, aber nicht identisches Problem bereits
angefasst — keine liefert eine fertige Blaupause, aber jede eine Lehre:

- **Time-Trial, Fokus-Panel (`zeitfahrenFokus*`, `battle-mode.engine.js` Z. 45914 ff., gebaut
  28.09.).** Ein manuelles Umschalt-Panel: der Zuschauer kann mit Vor/Zurück durch die Fahrer
  blättern (sortiert nach Startzeit) oder eine Automatik anschalten (`zeitfahrenFokusAutoToggle`).
  **Das ist die direkteste Präzedenz für Option F unten** (Abschnitt 3.6) — aber ihr Problem ist
  einfacher als Takeshis: Zeitfahrer starten bereits zeitversetzt, es gibt nie mehr als eine
  Handvoll gleichzeitig auf der Strecke. Bei Takeshi sind von Anfang an alle 12 gleichzeitig im
  Bild — das Panel allein löst das Massen-Problem am Start nicht, ergänzt aber jede Kamera-Option.
- **Breaking, „Klares 1v1" (PR #913, 14.09., `gesamtstand-fertigstellungsgrad-...md` Z. 1082):**
  „Ertragender im Spotlight, Peiniger mit 10-stufiger Folterbank statt zwölf gleichrangiger Figuren
  im Ring." Optisch dieselbe Idee wie T-Ü1 (ein/zwei Hauptdarsteller groß, Rest reduziert) —
  **aber nicht übertragbar als Mechanik-Vorbild**, weil Breaking laut CLAUDE.md strukturell ein
  echtes, alternierendes 1v1-Folterformat ist (das ist die Disziplin selbst, nicht nur ihr Bild).
  Würde man dasselbe Muster für Takeshi mechanisch kopieren, liefe die Simulation plötzlich
  abwechselnd statt simultan — genau das „nacheinander", das Chris ablehnt. Übertragbar ist nur
  die **visuelle** Idee (Spotlight + reduzierte Masse), die T-Ü1 bereits für Takeshi hat.
- **TDM/Battlefield, Arena-Gesamtbild (`ARENA_DOMINATION`, mehrere Teams gleichzeitig sichtbar):**
  zeigt ohne Reduktion alle Kämpfer in gleicher Größe — kein Vorbild für Übersichtlichkeit, eher
  ein Beleg, dass das „alle gleich groß" ungelöst bleibt, wenn man es nicht angeht (dieselbe
  Ausgangslage, die Takeshi vor dem 14.10.-Papier hatte).

**Fremdformat-Recherche (kurz, wie beauftragt):** Zwei Muster aus Nicht-Projekt-Quellen, die sich
auf bereits vorhandene Projekt-Bausteine abbilden lassen:

- **Killfeed-Muster (Battle-Royale-Shooter, z. B. Call of Duty: Warzone):** eine gedeckelte,
  automatisch verblassende Ereignisliste statt eines Volltext-Tickers für alle Spieler — Einträge
  erscheinen, bleiben kurz, verschwinden automatisch. Bildet sich im Projekt am ehesten auf die
  **T-Ü2-Stationstafel** ab (Abschnitt 3.3): statt eines zusätzlichen Dauer-Tickers eine kurze,
  sich selbst leerende Ereigniszeile je Falle.
- **Minimap-Muster (Battle-Royale allgemein):** eine kleine, immer sichtbare Übersicht mit grob
  vereinfachten Positionsmarkern, getrennt vom Hauptbild. Das ist **exakt das Prinzip, das T-Ü3
  bereits umsetzt** (Streckenband) — die Recherche bestätigt die 14.10.-Entscheidung, liefert aber
  keine neue Option.
- Eine gezielte Suche nach Produktionswissen zu Takeshi's Castle/Total Wipeout selbst (wie Kamera
  bei 80+ gleichzeitigen Antretenden geschnitten wird) blieb ohne verwertbaren Treffer — nur
  Formatbeschreibungen, keine Schnitttechnik-Quellen. Kein belastbares Fremdformat-Vorbild dafür,
  nur die Ableitung aus der oben zitierten Formel „nacheinander schneiden, nicht nacheinander
  antreten", die schon im Master-Papier stand.

---

## 3. Optionen

### 3.1 Option A — T-Ü1-Regie: automatischer Kamera-Crop auf den Hauptdarsteller (identisch mit K2, weiterhin offen)

**Was.** Statt (oder zusätzlich zu) der statischen Größen-/Sättigungs-Hervorhebung schneidet die
Kamera selbst auf den jeweiligen Hauptdarsteller (Führender/eigener Bester/Fallen-hängend/Burg
erreicht), mit fester Mindestverweildauer (Vorschlag aus dem 14.10.-Papier: 4 s, analog zum
Fokus-Panel-Vorbild bei Time-Trial). Die Simulation läuft für alle 12 unverändert simultan weiter —
nur der sichtbare Bildausschnitt wechselt.

**Respektiert „nicht nacheinander"?** Ja, ausdrücklich — es ist Schnitt, kein Antritt. Das ist
exakt die Unterscheidung aus Abschnitt 1.

**Klasse:** **T**. Ändert `viewBox`/Zoom-Zustand im gemeinsamen Host
(`DisciplineStageNativeArena.tsx`), verändert, was der Zuschauer in jedem Moment sieht — ein
Sendezeit-/Bildausschnitt-Eingriff, der laut CLAUDE.md-Präzedenz (Fechten-Format, Time-Trial-J1)
Chris' ausdrückliche Zustimmung vor dem Bau braucht.

**rho/Pp:** keins — reine Darstellung, kein `rr()`.

**Offene Frage, unverändert seit dem 14.10.-Papier:** bleibt der Burg-Endstand lesbar, wenn das
Hauptbild ein Ausschnitt ist? Nur per Sichtprüfung mit echten Kaderpaarungen zu beantworten, nicht
per Probe — und Agenten kommen laut CLAUDE.md nicht an den Server/echte Spielstände heran, außer
über `live-save`.

### 3.2 Option B — Progressiver Zoom statt fester 4-s-Takt (neu)

**Was.** Eine Variante von Option A, die den Zeitpunkt des Crops nicht an einen festen Takt bindet,
sondern an ein **objektives Signal**: die Streuung der Fortschritts-Fraktion über alle Läufer
(`trackFrac`/`animScore`, bereits vorhanden für T-Ü3). Am Start, wenn alle eng beieinanderliegen
(hohe Dichte, geringe Streuung), bleibt die Kamera weit (Gesamtbild — die Massen-Szene ist dann am
unübersichtlichsten, aber auch am wichtigsten als Ganzes zu zeigen, z. B. beim Start-Gedränge).
Sobald sich das Feld auseinanderzieht (Streuung über einen Schwellenwert), kann die Kamera auf
Hauptdarsteller croppen. Nähert sich der erste Läufer der Burg (Fortschritt ≥ 90 %), weitet sich das
Bild wieder — das beantwortet die am 14.10. offene Frage „bleibt der Burg-Endstand lesbar" direkt im
Design, statt sie offenzulassen: das Gesamtbild kehrt genau dann zurück, wenn der Endstand zählt.

**Respektiert „nicht nacheinander"?** Ja, aus demselben Grund wie A — reiner Schnitt.

**Klasse:** **T**, aus denselben Gründen wie A (Host-Eingriff, Sendezeit) — zusätzlich **mehr
Entwurfsaufwand** als A, weil der Umschalt-Schwellenwert kalibriert werden muss (wo genau beginnt
„auseinandergezogen genug"?). Eher eine Verfeinerung von A als eine Alternative dazu — beide
bräuchten denselben Host-Eingriff, nur die Auslöselogik unterscheidet sich.

**rho/Pp:** keins.

**Tradeoff gegenüber A:** löst die Burg-Endstand-Frage strukturell, braucht aber eine Kalibrierrunde
(was zählt als „auseinandergezogen"?) — mehr Aufwand für eine robustere Antwort.

### 3.3 Option C — T-Ü2-Stationstafel als Killfeed-artiger Ereignis-Zusatz (präzisiert aus K2)

**Was.** Eine kurze, sich selbst leerende Zeile je Falle („Die Mauern: 7 von 12 durch · 3 im
Schlamm"), nach dem Killfeed-Muster aus Abschnitt 2: erscheint, bleibt kurz sichtbar, verschwindet
automatisch, statt den bestehenden Dauer-Ticker zu verlängern. Zähler sind aus
`fallenPunkte`/`trackFrac` ableitbar (derselbe Mechanismus, der schon die zuletzt passierte Falle
für `gluehIdx` kennt), kein neuer Rechenweg.

**Respektiert „nicht nacheinander"?** Ja — reine Anzeige, ändert nichts an der Ausführung.

**Klasse:** **A**, wenn gewünscht — reine Anzeige, kein `rr()`, kein neuer Zustand, der in
`score`/`rank` zurückfließt.

**rho/Pp:** keins.

**Offene Frage aus dem 14.10.-Papier, unverändert:** lohnt sich das neben dem bereits gebauten
T-Ü3-Streckenband, das denselben Fallen-Fortschritt schon zeigt? Diese Runde fügt keine neue
Antwort hinzu — nur die Idee, es wie ein Killfeed zu bauen (gedeckelt, automatisch verblassend)
statt wie eine klassische Stationstafel, falls Chris es will.

### 3.4 Option D — Namensschild-Kollisionsvermeidung (schließt die 14.10.-Lücke)

**Was.** Das 14.10.-Papier maß selbst, dass Namensschilder (im Gegensatz zu reinen Rang-Badges)
häufiger kollidieren, wenn zwei Hauptdarsteller nah beieinanderliegen (0,0 → 0,3 Paare/Frame). Die
leichteste Reparatur, **ohne** auf die Kamera-Entscheidung (Option A/B) zu warten: eine einfache
Stapel-/Ausweichlogik — liegen zwei Hauptdarsteller-Namen horizontal näher als ihre kombinierte
Textbreite, wird der zweite vertikal versetzt (über statt neben der Figur). Keine neue Information,
nur ein Layout-Fix auf bereits vorhandenen Positionsdaten.

**Respektiert „nicht nacheinander"?** Ja — betrifft nur Text-Platzierung.

**Klasse:** **A**. Reine Layout-Korrektur auf bereits berechneten Positionen, kein `rr()`, kein
Zustand, kein Host-Eingriff (bleibt in `takeshi.tsx`).

**rho/Pp:** keins.

**Warum diese Option besonders attraktiv als nächster Schritt ist:** sie behebt eine **bereits
gemessene, dokumentierte Lücke** in bereits gemergtem Code, ohne auf Chris' Antwort zu Frage 1
(Kamera ja/nein) zu warten — kann unabhängig und sofort umgesetzt werden.

### 3.5 Option E — Ereignisgetriebene Kurzhervorhebung statt nur vier feste Rollen (neu)

**Was.** T-Ü1 hebt heute vier **feste** Rollen hervor (Führender, eigener Bester, Fallen-hängend,
Burg erreicht) — alle anderen Momente (ein Überholvorgang, ein Ausscheiden durch Nervenverlust,
ein besonders sauberer Fallendurchgang) bleiben unsichtbar, selbst wenn sie erzählerisch
interessant wären. Eine Erweiterung: ein kurzer (1–2 s), nicht-permanenter Aufleucht-Effekt
(Rahmen-Puls oder kurzzeitige Namenseinblendung) für Läufer, bei denen gerade ein Ereignis aus dem
bestehenden Ticker ausgelöst wurde — unabhängig vom festen Rollen-Set. Nutzt ausschließlich bereits
vorhandene Ticker-Ereignisse, keinen neuen Feldwert.

**Respektiert „nicht nacheinander"?** Ja — zusätzliche, zeitlich kurze visuelle Betonung, keine
Änderung der Simultanität.

**Klasse:** **A** bis **B**, je nach Umsetzung: reine CSS-/SVG-Animation auf bestehenden
Ticker-Ereignissen wäre A; wenn dafür ein neues, bisher nicht vorgehaltenes Zeitvergleichsfeld
(„wer wurde gerade überholt", vom 14.10.-Papier in Frage 2 selbst als Erweiterung genannt, aber
bewusst nicht aufgenommen, weil kein Vorher-Rang gespeichert wird) nachgezogen werden muss, wäre
das ein neuer, wenn auch rein beobachtender Zustand — noch A, aber mit mehr Aufwand.

**rho/Pp:** keins, solange der neue Zustand nur gelesen, nie in `score`/`rank` zurückgeschrieben
wird (dieselbe Garantie wie bei T-Ü1 heute).

**Tradeoff:** mehr Lebendigkeit/Varianz im Bild, aber mehr visuelles „Geflacker", wenn zu viele
Ereignisse gleichzeitig feuern — müsste gegen das Ticker-Dichte-Zielband (vorhandenes Audit-Maß,
≤ 30 Zeilen/min) kalibriert werden, um nicht selbst unübersichtlich zu werden.

### 3.6 Option F — Manuelles Fokus-Panel, Zeitfahren-Muster portiert (neu, Cross-Projekt-Präzedenz)

**Was.** Direkt aus Abschnitt 2: Time-Trials `zeitfahrenFokus*`-Panel (Vor/Zurück durch Teilnehmer,
Auto-Umschalt-Knopf) auf Takeshi übertragen. Anders als Option A/B ist das **zuschauerseitig
opt-in** statt automatisch der ganzen Sendung aufgezwungen — der Zuschauer entscheidet selbst, ob
er durchblättert oder bei der Gesamtansicht bleibt.

**Respektiert „nicht nacheinander"?** Ja — die Simulation bleibt simultan; das Panel ändert nur,
worauf die Kamera **auf Wunsch des Betrachters** zeigt, nicht was passiert oder wann.

**Klasse:** **A/B**. Die UI-Portierung selbst ist überschaubar (bestehendes Muster, bestehende
Positionsdaten), aber sie berührt denselben Host wie A/B, weil ein Fokus-Panel den sichtbaren
Ausschnitt ändert — anders als A/B jedoch **nicht automatisch für alle Zuschauer gleichzeitig**,
sondern nur für den, der es benutzt. Das dürfte die Klasse-T-Einstufung von A/B nicht automatisch
erben (ein opt-in Werkzeug ändert nicht, was jeder sieht, der es nicht anfasst) — das ist aber eine
Einschätzung, keine Garantie, und sollte vor dem Bau mit Chris abgeglichen werden, gerade weil die
Grenze zwischen „Klasse A" und „Klasse T" hier von der tatsächlichen UI-Platzierung abhängt (ein
Panel, das immer sichtbar und leicht zu übersehen ist, wiegt anders als eines, das sich mitten ins
Spielfeld schiebt).

**rho/Pp:** keins.

**Warum das eine eigenständige Option ist, nicht nur eine Fußnote zu A:** es löst einen Teil
desselben Bedürfnisses (einzelne Läufer klar sehen können), ohne die harte Sendezeit-Frage aus A/B
zu stellen — ein möglicher Zwischenschritt oder eine dauerhafte Ergänzung, falls Chris die
automatische Regie (noch) nicht will.

### 3.7 Option G — Detailgrad-Reduktion der „Masse" (neu, Minimap-inspiriert)

**Was.** Die entsättigten Nicht-Hauptdarsteller (heute 0,62× Größe, 0,35 Sättigung, volle
Chrome-Komplexität) noch einfacher zeichnen — z. B. als reine Farbpunkte ohne Logo-Clip/Team-Rahmen,
ähnlich der Vereinfachung, die T-Ü3 für das Streckenband bereits nutzt, aber im **Hauptbild** statt
nur im Band. Zusätzlicher Nebeneffekt (nicht Ziel dieser Runde, nur Erwähnung der Synergie): weniger
Pixel/DOM-Komplexität je Frame für die Mehrzahl der Token — passt zur in Abschnitt 1 erwähnten,
bereits separat behandelten Performance-Diagnose (Task #110/#9, `takeshi-performance-diagnose-13-10.md`),
ist aber eine eigene Messfrage dort, nicht Teil dieses Konzepts.

**Respektiert „nicht nacheinander"?** Ja — reine Zeichendetail-Reduktion.

**Klasse:** **A**. Reine Anzeige, verändert nur, wie (nicht ob) ein bereits positionierter Token
gezeichnet wird.

**rho/Pp:** keins.

**Tradeoff:** vereinfachte Punkte könnten das „Spielerteam"-Gefühl schwächen (Logo/Trikot ist Teil
der Identifikation) — müsste gegen Chris' Geschmack geprüft werden, nicht nur gegen Lesbarkeit.
Eine Zwischenstufe (Logo behalten, nur Rahmen/Schatten-Effekte weglassen) wäre vorsichtiger.

### 3.8 Option H — Einheitliche, generische Bahn-Overlay-Tafel vorziehen (Kontext, keine neue Idee)

Das Master-Papier (Abschnitt 1 des 14.10.-Papiers, „Q5") sieht eine **generische** Streckenband-
Tafel für alle fünf Bahn-Disziplinen vor (Spurt, Staffel, Takeshi, Climbing, Time-Trial), von der
T-Ü3 bislang nur eine Takeshi-eigene, einfachere Variante ist. Diese Runde empfiehlt **nicht**, das
vorzuziehen — reine Erwähnung der Option, weil sie im Bild auftaucht: eine Vereinheitlichung wäre
ein größerer, eigenständiger Baustein (Klasse B/C, fünf Disziplinen statt einer), der eine eigene
Runde rechtfertigt, keine Erweiterung dieses Konzepts.

---

## 4. Bewertungstabelle

| Option | Löst | Klasse | rho/Pp-Pflichtprüfung? | „nicht nacheinander"? | Abhängig von |
|---|---|---|---|---|---|
| A — T-Ü1-Regie (fester Takt) | Fokus/Kamera | T | nein | ja (Schnitt, kein Antritt) | Chris' Go, Host-Eingriff |
| B — Progressiver Zoom | Fokus/Kamera + Burg-Lesbarkeit | T (+ Kalibrierung) | nein | ja | wie A, plus Schwellenwert-Findung |
| C — T-Ü2-Killfeed-Stationstafel | Fallen-Fortschritt kompakt | A | nein | ja | — |
| D — Namensschild-Ausweichen | gemessene Kollisionslücke aus K2 | A | nein | ja | — (sofort umsetzbar) |
| E — Ereignisgetriebene Hervorhebung | Varianz über die vier festen Rollen hinaus | A/B | nein | ja | Ticker-Dichte-Zielband |
| F — Manuelles Fokus-Panel | Einzelsicht ohne Zwangs-Schnitt | A/B | nein | ja | Einordnung A vs. T vor Bau klären |
| G — Detailgrad-Reduktion der Masse | visuelle Dichte der Nicht-Hauptdarsteller | A | nein | ja | Geschmacksfrage (Logo-Identifikation) |
| H — Generische Fünf-Disziplinen-Tafel | Konsistenz über Bahn-Disziplinen | B/C | nein | ja | eigene Runde, hier nur erwähnt |

Keine der acht Optionen berührt `rr()`, `score`, `rank`, die Eignungsmatrix oder eine
Rezeptkonstante — die CLAUDE.md-Pflichtprüfungen (rho>0,80 je Spiel, Pp≤25) sind für keine davon
einschlägig. Jede respektiert nachweislich „nicht nacheinander", weil in jeder die Simulation für
alle Teilnehmer gleichzeitig weiterläuft.

---

## 5. Empfehlung (kein Beschluss — Begründung, keine Vorentscheidung für Chris)

**Sofort und unabhängig von jeder Kamera-Entscheidung: Option D (Namensschild-Ausweichen).** Sie
schließt eine bereits selbst gemessene Lücke im bereits gemergten Code, ist Klasse A, kostet wenig
Aufwand und braucht kein Veto — die naheliegendste nächste Zeile Arbeit an dieser Disziplin, egal
wie die Kamera-Frage am Ende ausgeht.

**Für die Kamera-Frage (Optionen A/B/F) empfiehlt diese Runde, zuerst Chris' Frage 1 aus dem
14.10.-Papier zu beantworten, bevor irgendeine davon gebaut wird** — das ist dieselbe offene Frage,
nicht verdoppelt: will Chris überhaupt eine automatische Regie, die Sendezeit/Bildausschnitt für
alle Zuschauer verändert? Falls ja, ist **B (progressiver Zoom) die robustere Variante von A**,
weil sie die Burg-Endstand-Lesbarkeit strukturell statt nur per Hoffnung löst — kostet aber eine
zusätzliche Kalibrierrunde. **F (manuelles Fokus-Panel)** ist der vorsichtigste Einstieg: es gibt
dem Zuschauer die Einzelsicht, ohne die Sendezeit-Entscheidung für alle zu treffen, und könnte ein
Zwischenschritt sein, während A/B noch offen sind — oder eine dauerhafte Ergänzung dazu.

**C, E und G sind sinnvolle, aber nachrangige Ergänzungen** — keine davon ist dringend, jede davon
ließe sich in derselben oder einer späteren Runde mitnehmen, falls Chris Interesse zeigt. **H
bleibt bewusst unangetastet**, eine eigene, größere Runde.

**Nichts davon ist eine Entscheidung.** Diese Runde liefert Optionen mit Tradeoffs, keine Wahl —
die Wahl, ob und was gebaut wird, bleibt bei Chris.

---

## 6. Offene Fragen an Chris (manche identisch mit 14.10., bewusst nicht neu beantwortet)

1. **Unverändert aus dem 14.10.-Papier:** Soll die automatische Kamera-Regie (A/B) überhaupt gebaut
   werden? Sie verändert Sendezeit/Bildausschnitt für jeden Zuschauer, Klasse T.
2. **Neu:** Falls ja zu Frage 1 — fester 4-s-Takt (A, einfacher) oder Streuungs-getriggerter
   progressiver Zoom (B, robuster bei der Burg-Lesbarkeit, mehr Kalibrieraufwand)?
3. **Neu:** Ist ein **manuelles** Fokus-Panel (F, Zeitfahren-Muster) eine gewünschte Ergänzung oder
   Alternative zur automatischen Regie — unabhängig von der Antwort auf Frage 1?
4. **Unverändert aus dem 14.10.-Papier:** Lohnt sich die T-Ü2-Stationstafel (C) trotzdem, obwohl das
   Streckenband denselben Fallen-Fortschritt schon zeigt?
5. **Neu:** Ist die ereignisgetriebene Kurzhervorhebung (E) gewünscht, oder sollen die vier festen
   Hauptdarsteller-Rollen aus T-Ü1 so bleiben, wie sie sind?
6. **Neu:** Ist eine vereinfachte „Masse" (G, reine Farbpunkte statt vollem Logo-Chrome für
   Nicht-Hauptdarsteller) im Sinne der Lesbarkeit erwünscht, oder soll jeder Läufer immer sein
   volles Team-Erscheinungsbild behalten, auch verkleinert/entsättigt?
7. **Unverändert aus dem 14.10.-Papier, hier nur wiederholt, weil D sie direkt berührt:** Reicht die
   vorgeschlagene Ausweichlogik (vertikal versetzen bei Kollision) für D, oder schwebt Chris etwas
   Aufwändigeres vor?

**Kein Punkt oben ist ein Auftrag.** Diese Liste ist dafür da, dass eine künftige Runde nicht
erneut bei null anfängt, sondern hier nachschlägt, sobald Chris eine Priorität oder eine Antwort
gibt.
