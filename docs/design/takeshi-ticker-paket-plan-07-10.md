# Takeshi-Ticker-Paket — Befund und Entscheidung (07.10.)

**Kein vollständiger Erfolg, und das wird hier offen gesagt statt verschwiegen.** Auftrag war,
Takeshi's Castle von 31,5 auf unter 30 Ticker-Zeilen je Minute zu bringen (Nebenbefund aus
`docs/design/time-trial-broadcast-paket-plan-07-10.md` Abschnitt 5). Zwei echte, in sich
korrekte Inkonsistenzen wurden gefunden und behoben — **die Gesamtzahl bleibt trotzdem bei
31,5 Zeilen/min, bit-genau unverändert.** Das ist kein Mess- oder Implementierungsfehler,
sondern eine strukturelle Eigenschaft, die unten erklärt wird. Die Schranke selbst zu
unterschreiten braucht eine Design-Entscheidung, die dieses Paket bewusst nicht trifft.

## Was gefunden und behoben wurde

**Fund 1 — T-REMPLER, dieselbe kind-Falle wie bei TDM/Breaking/Time-Trial/Schach/Fechten**
(`stepSpurt()`, Z. ~40210-40225): Der Rempler-Treffer-Zweig übergibt `kind="rempler"`
bedingungslos. `big` steht dort korrekt auf `!TA.takeshi` (der Kommentar davor sagt es selbst:
"AUSSER IN TAKESHI ... macht 'rammt ... um' zu einem der häufigsten Bannertexte ... also nicht
mehr big") — aber `kind` folgte dieser Logik nicht und lief trotzdem immer durch. `feed()`
stuft jede Zeile mit gesetztem `kind` immer als "ereignis" ein (`tickerZeigt(big||kind?
"ereignis":stufe)`), unabhängig von `big`. Fix: `kind` nur noch, wenn `big` (`remplerBig`).
Für jede andere Bahn mit `tackle:true` (Spurt, Staffel) unverändert, weil dort `big` ohnehin
true ist.

**Fund 2 — T-STURZ, derselbe Normalfall wie beim Durchbruch-Zwilling, aber nicht routine**
(`stepSpurt()`, Z. ~40100): "X reißt die Falle"/"X greift daneben" (ein missglückter
Hindernis-Versuch) lief ohne `stufe`, also "normal" (budgetiert, aber am Wettbewerb um das
Zeilenbudget beteiligt). Der Kommentar direkt eine Zeile darüber sagt ausdrücklich: "ein Sturz
ist in Takeshi der Normalfall, keine Ausnahme" — und der Schwester-Zweig ("X nimmt die Falle
mit Gewalt", der Durchbruch-Fall direkt daneben, Z. 40001) ist schon lange `feedRoutine()`.
Der Sturz-Fall war es nie. Gemessen stand er mit 49 Zeilen je Rennen als zweithäufigstes
Ereignis überhaupt im Protokoll und verdrängte im Budget-Wettbewerb andere, interessantere
Normal-Zeilen (Gedränge, Rempler). Fix: `feedRoutine()`, wie beim Durchbruch-Zwilling — gilt
für jede Bahn mit Hindernissen (Spurt/Climbing/Takeshi), dieselbe Aufrufstelle für alle.

## Warum die Gesamtzahl trotzdem bei 31,5 bleibt

Das Zeilenbudget (`TICKER_ZEILEN_JE_MIN=28`, `tickerZeigt()`) ist ein Token-Eimer: er füllt
sich mit 28/60 Zeilen je Sekunde und hält höchstens 4 vor. "Ereignis"-Zeilen (`big` oder
`kind` gesetzt) kommen **immer** durch und ziehen ein Token ab, bis hinunter zu -8 ("Schuld"),
die "normal"-Zeilen danach verstummen lässt, bis sie abgetragen ist.

Takeshi hat in einem 61-Sekunden-Rennen **16 erzwungene Ereignis-Zeilen**: jeder Zieleinlauf
(bis zu 12), jedes Ausscheiden, jeder Führungswechsel sind laut Design `big` — "Ausscheiden/
Zieleinlauf/Führungswechsel" sind ausdrücklich die drei Fälle, die für Takeshi big bleiben
(Kommentar bei Z. 40086-40090). Diese 16 Zeilen zählen unabhängig vom Budget, drücken es aber
tief in die Schuld. Was an "normal"-Zeilen übrig bleibt, füllt den Rest bis zur Kapazitätsgrenze
— und zwar bis zur GRENZE, nicht bis zu einer bestimmten ANZAHL: Gedränge-, Rempler- und
Sturz-Zeilen zusammen liefern immer mehr Kandidaten, als das Budget in 61 Sekunden durchlässt.
Egal, welche Kategorie demotet wird — solange die Kandidatenmenge die Kapazität übersteigt
(und das tut sie bei Weitem), füllt eine andere Kategorie die frei gewordenen Plätze, und die
Gesamtzahl bleibt gleich. **Nachgemessen, nicht vermutet:** nach Fund 1 allein blieb die Zahl
bei 31,5 (nur "reißt die Falle" rückte nach), nach Fund 1+2 blieb sie wieder bei 31,5 (jetzt
füllen Gedränge/Rempler/die seltenen "schwach"/"stark"-Sonderzeilen die Lücke).

Der limitierende Faktor ist also strukturell die **Dichte erzwungener Ereignis-Zeilen in
einem kurzen Rennen**, nicht ein einzelner Kodierfehler. Time-Trial hat ähnlich viele
Zieleinlauf-Banner (12), aber ein fast doppelt so langes Rennen (1:57 statt 1:01) — mehr Zeit
zum Auffüllen des Budgets senkt die Rate automatisch, ohne dass am Rezept etwas geändert
werden musste.

## Was das NICHT ist

Kein Pp-/rho-Problem: beide Fixes sind reine Anzeige, rho bit-identisch (n=24 und n=12, Diffs
leer) für Takeshi, Spurt, Climbing, Staffel. Keine Regression, kein halb fertiger Fix — beide
Änderungen sind für sich korrekt und vollständig, nur eben keine Antwort auf die gestellte
30er-Schranke.

## Was eine echte Lösung bräuchte — bewusst nicht in diesem Paket

Um unter 30 Zeilen/min zu kommen, müsste die Zahl der ERZWUNGENEN Ereignis-Zeilen sinken, nicht
die der normalen. Die naheliegende Stellschraube: nicht jeder Zieleinlauf muss `big` sein — nur
die ersten/letzten Plätze, oder ein Cooldown zwischen zwei Zieleinlauf-Bannern (Analogie zum
Führungswechsel-Cooldown, der schon existiert). Das ist eine **Design-Entscheidung über das
Sendungsbild**, keine Bugfix-Frage: ob jeder Zieleinlauf einen Banner verdient, ist eine
Geschmacksfrage am echten Fernsehvorbild, nicht am Code. Frühere Pakete (Time-Trial-Plan
Abschnitt 5) haben genau deshalb schon einmal darauf verzichtet, das hier zu entscheiden; dieses
Paket tut es aus demselben Grund nicht. Vorschlag für eine künftige Runde: Chris fragen, ob
Takeshi's Castle mit knapp über der Schranke liegenden 31,5 Zeilen/min (gegen das Ziel von 30)
so bleiben soll, oder ob einzelne Zieleinlauf-Banner entfallen dürfen.

## Validierung

- `node --check`: OK.
- rho bit-identisch gegen main (n=24 und n=12, Diffs leer): Takeshi, Spurt, Climbing, Staffel.
- Ticker: Takeshi weiterhin 31,5/min (unverändert, s.o.), Komposition deutlich vielfältiger
  (vorher 10/32 Zeilen "reißt die Falle", jetzt 0 — Gedränge/Rempler/seltene Sonderzeilen
  füllen den Platz). Spurt 13,6 → 8,3/min (zusätzliche Verbesserung, bereits unter der
  Schranke). Climbing unverändert 15,3/min. Staffel unverändert 6,9/min (keine Hindernisse
  in diesem Sinn betroffen).
- `scripts/verify-takeshi-ticker-paket-07-10.mjs`: prüft, dass "reißt die Falle"/"greift
  daneben" nie mehr im sichtbaren Ticker steht (nur noch im Protokoll), dass "rammt ... um"
  für Takeshi nur noch mit tatsächlichem Banner (big) im Ticker steht, für Spurt unverändert
  immer, keine Seitenfehler.
- Vitest (`spiele-bahn-invarianten`) grün.
- Klasse A (reine Anzeige, kein `rr()`/`wert()`-Eingriff) — keine Freigabe durch Chris nötig
  für die beiden Fixes selbst; die offene Frage zum Zieleinlauf-Banner braucht sie, falls
  jemand sie später angeht.
