# Takeshi-Ticker-Paket — Befund und Entscheidung (07.10.)

**Kein vollständiger Erfolg, und das wird hier offen gesagt statt verschwiegen.** Auftrag war,
Takeshi's Castle von 31,5 auf unter 30 Ticker-Zeilen je Minute zu bringen (Nebenbefund aus
`docs/design/time-trial-broadcast-paket-plan-07-10.md` Abschnitt 5). Zwei echte, in sich
korrekte Inkonsistenzen wurden gefunden und behoben — **die Gesamtzahl bleibt trotzdem bei
31,5 Zeilen/min, bit-genau unverändert.** Das ist kein Mess- oder Implementierungsfehler,
sondern eine strukturelle Eigenschaft, die unten erklärt wird. Die Schranke selbst zu
unterschreiten braucht eine Design-Entscheidung, die dieses Paket bewusst nicht trifft, aber
mit einer konkreten, selbst nachgemessenen Option versieht.

**Nachtrag nach Opus-Review (07.10.):** Die erste Fassung dieses Dokuments hatte zwei
Sachfehler — die main-Zusammensetzung war falsch angegeben, und die Erklärung "jeder
Zieleinlauf ist big" traf den Mechanismus nicht genau (es ist `kind`/`stufe="ereignis"`, nicht
`big` — siehe unten). Der Review fand außerdem einen Fix, der zu weit gefasst war (traf Spurt
ungewollt mit), und einen funktionierenden, selbst nachgemessenen Alternativ-Hebel. Alles
korrigiert; die Korrekturen sind unten eingearbeitet, nicht separat angehängt.

## Was gefunden und behoben wurde

**Fund 1 — T-REMPLER, dieselbe kind-Falle wie bei TDM/Breaking/Time-Trial/Schach/Fechten**
(`stepSpurt()`, Z. ~40210-40225): Der Rempler-Treffer-Zweig übergibt `kind="rempler"`
bedingungslos. `big` steht dort korrekt auf `!TA.takeshi` (der Kommentar davor sagt es selbst:
"AUSSER IN TAKESHI ... macht 'rammt ... um' zu einem der häufigsten Bannertexte ... also nicht
mehr big") — aber `kind` folgte dieser Logik nicht und lief trotzdem immer durch. `feed()`
stuft jede Zeile mit gesetztem `kind` immer als "ereignis" ein (`tickerZeigt(big||kind?
"ereignis":stufe)`), unabhängig von `big`. Fix: `kind` nur noch, wenn `big` (`remplerBig`).
Für jede andere Bahn mit `tackle:true` (Spurt, Staffel) unverändert, weil dort `big` ohnehin
true ist. **Vom Review bestätigt, sofort mergebar.**

**Fund 2 — T-STURZ, derselbe Normalfall wie beim Durchbruch-Zwilling, aber nicht routine,
NUR TAKESHI** (`stepSpurt()`, Z. ~40100): "X reißt die Falle"/"X greift daneben" (ein
missglückter Hindernis-Versuch) lief ohne `stufe`, also "normal" (budgetiert, aber am
Wettbewerb um das Zeilenbudget beteiligt). Der Kommentar direkt eine Zeile darüber sagt
ausdrücklich: "ein Sturz ist in Takeshi der Normalfall, keine Ausnahme" — und der
Schwester-Zweig ("X nimmt die Falle mit Gewalt", der Durchbruch-Fall direkt daneben, Z. 40001)
ist schon lange `feedRoutine()`. Der Sturz-Fall war es für Takeshi nie, stand dort mit 49
Zeilen je Rennen als zweithäufigstes Ereignis überhaupt im Protokoll und verdrängte im
Budget-Wettbewerb andere, interessantere Normal-Zeilen (Gedränge, Rempler).

**Korrektur nach Review:** Die erste Fassung setzte `feedRoutine()` pauschal für jede Bahn mit
Hindernissen (Spurt/Climbing/Takeshi an derselben Aufrufstelle) — das nahm Spurt 19
Sturz-Zeilen aus dem Ticker (Protokoll 49 → Ticker-Anteil weg), obwohl Spurt nie über der
Schranke lag. Der Rempler-Kommentar an der Nachbarstelle (Fund 1) trifft fuer die Häufigkeit
exakt dieselbe Unterscheidung ("selten genug ... IN TAKESHI ... AUSSER ... Spurt ... bleibt
unverändert"), und derselbe `A.takeshi`-Schalter steuert direkt daneben schon den Sturz-Ton
(Z. 40078). Fix jetzt: `A.takeshi?feedRoutine(...):feed(...)` — nur Takeshi wird entschlackt,
Spurt/Climbing bleiben unverändert "normal" wie auf main.

## Warum die Gesamtzahl trotzdem bei 31,5 bleibt

Das Zeilenbudget (`TICKER_ZEILEN_JE_MIN=28`, `TICKER_BUDGET_VORRAT=4`, `tickerZeigt()`) ist ein
Token-Eimer: er füllt sich mit 28/60 Zeilen je Sekunde und hält höchstens 4 vor. "Ereignis"-
Zeilen (`big` **oder** `kind` gesetzt) kommen **immer** durch und ziehen ein Token ab, bis
hinunter zu -8 ("Schuld"); das drückt "normal"-Zeilen zeitweise weg, aber **nur die Schuld am
RENNENDE zählt für die Gesamtzahl** — eine Schuld, die während des Rennens entsteht und wieder
abgetragen wird, hat am Ende keinen Resteffekt. Für ein 61-Sekunden-Rennen ergibt das rechnerisch
rund `TICKER_BUDGET_START(2) + 28/60×61 ≈ 30,5` Normal-Token plus die Ereignis-Zeilen obendrauf
— konsistent mit den gemessenen 32 Zeilen.

**Was wirklich erzwingt, nicht "big":** die Zieleinlauf-Zeile (Z. 40464-40468) übergibt
`kind="zieleinlauf"` **und ausdrücklich `stufe="ereignis"`** für **jeden** Finisher, nicht nur
für die ersten drei — `big` (`zielPlatz<=3`) steuert dort nur das Highlight/den Bannertitel,
NICHT ob die Zeile überhaupt erscheint. Das ist belegt dokumentiert: "KOMBINIERT (Merge
#1093/#1095): kind='zieleinlauf' UND stufe='ereignis'" steht direkt im Kommentar darüber — eine
bewusste, bereits früher reviewte Design-Entscheidung (jeder Finisher bekommt eine Zeile, nur
die Top 3 ein Banner), kein Versehen wie die anderen kind-Fallen in diesem Sweep. Takeshi hat
in einem 61-Sekunden-Rennen **16 solcher erzwungener Zeilen**: bis zu 12 Zieleinläufe + 3
Ausscheiden (ebenfalls erzwungen, Z. 40069-40071) + 1 Siegzeile.

Diese erzwungenen Zeilen zählen unabhängig vom Budget. Was an "normal"-Zeilen übrig bleibt,
füllt den Rest bis zur Kapazitätsgrenze — und zwar bis zur GRENZE, nicht bis zu einer
bestimmten ANZAHL: Gedränge-, Rempler- und Sturz-Zeilen zusammen liefern deutlich mehr
Kandidaten, als das Budget in 61 Sekunden durchlässt. Egal, welche Kategorie demotet wird,
solange die Kandidatenmenge die Kapazität übersteigt (und das tut sie bei Weitem), füllt eine
andere Kategorie die frei gewordenen Plätze, und die Gesamtzahl bleibt gleich.

**Nachgemessen, nicht vermutet — mit korrigierten Zahlen:** Auf main standen in der Ticker-Zeile
12× "rammt" + 4× "reißt die Falle" + 3× Führungswechsel + 9× im Ziel + 3× Ausscheiden + 1×
Sieg = 32. Nach Fund 1 allein (Rempler nicht mehr erzwungen): 4× rammt, 10× reißt, 1× liegt-an,
1× spaziert-durch, Rest unverändert = weiterhin 32. Nach Fund 1+2 (Takeshi-Scope, finale
Fassung): 6× rammt, 4× liegt-an, 3× spaziert-durch, 2× Gedränge, Rest unverändert = weiterhin
32. Die Komposition wird jedes Mal vielfältiger, die Summe bleibt exakt gleich.

## Ein funktionierender Hebel existiert — hier bewusst NICHT umgesetzt

Der Review hat nachgewiesen (und diese Session hat es selbst nachgemessen, unabhängige Kopie):
wird die Zieleinlauf-Zeile für Platz 4 und schlechter nicht mehr erzwungen (`kind`/`stufe`
ebenfalls nur noch bei `zielPlatz<=3`, dieselbe Bedingung wie `big`), sinkt Takeshi auf **30
Zeilen, 29,5/min — unter die Schranke**, ohne dass ein einziges Banner (Top 3) verschwindet.
Der Preis: fünf der sechs Zeilen "Platz 4–9 im Ziel" fallen aus dem sichtbaren Ticker (bleiben
im Protokoll), Füllzeilen (z. B. "bricht ein") rücken nach.

**Das ist eine Entscheidung über den TICKER-INHALT, nicht über Banner** — die ursprüngliche
Formulierung dieses Plans ("nicht jeder Zieleinlauf muss ein Banner sein") stellte die falsche
Frage, weil Banner (big/Top 3) davon gar nicht betroffen wären. Die richtige Frage: **dürfen
die Zieleinlauf-Meldungen für Platz 4 und schlechter dem normalen Zeilenbudget unterliegen,
so wie jede andere Routine-Zeile, statt garantiert zu erscheinen?** Das ändert, wie vollständig
der Ticker das Mittelfeld meldet — eine Sendungsbild-Frage, die Chris entscheiden sollte, weil
es bisher eine bewusste frühere Design-Entscheidung rückgängig macht (Merge #1093/#1095: jeder
Finisher, nicht nur die Top 3, bekommt garantiert eine Zeile). Nicht in diesem Paket umgesetzt.

## Was das NICHT ist

Kein Pp-/rho-Problem: beide Fixes sind reine Anzeige, rho bit-identisch (n=24 und n=12, Diffs
leer) für Takeshi, Spurt, Climbing, Staffel. Keine Regression, kein halb fertiger Fix — beide
Änderungen sind für sich korrekt und vollständig, nur eben keine Antwort auf die gestellte
30er-Schranke.

## Validierung

- `node --check`: OK.
- rho bit-identisch gegen main (n=24 und n=12, Diffs leer): Takeshi, Spurt, Climbing, Staffel.
- Ticker: Takeshi weiterhin 31,5/min (unverändert, s.o.), Komposition deutlich vielfältiger
  (vorher 12/32 Zeilen "rammt" + 4/32 "reißt die Falle", jetzt 6/32 "rammt" + 0 "reißt" —
  Gedränge/seltene Sonderzeilen füllen den Platz). Spurt und Climbing **unverändert** (13,6/min
  bzw. 15,3/min, keine Aenderung durch dieses Paket — die erste, zu breit gefasste Fassung von
  Fund 2 hatte Spurt faelschlich mitgesenkt, das ist jetzt korrigiert). Staffel unverändert
  6,9/min.
- `scripts/verify-takeshi-ticker-paket-07-10.mjs`: prüft, dass "reißt die Falle"/"greift
  daneben" für TAKESHI nie mehr im sichtbaren Ticker steht (nur noch im Protokoll), für
  Spurt/Climbing unverändert "normal" bleibt; dass "rammt ... um" für Takeshi nicht mehr
  erzwungen ist (Ticker-Zahl < Protokoll-Zahl), für Spurt unverändert (big=true, Ticker =
  Protokoll); keine Seitenfehler.
- Vitest (`spiele-bahn-invarianten`) grün.
- Klasse A (reine Anzeige, kein `rr()`/`wert()`-Eingriff) für beide Fixes — keine Freigabe
  durch Chris nötig. Die offene Frage zum Zieleinlauf-Budget (Platz 4+) braucht sie, falls
  jemand sie später angeht — siehe Abschnitt oben.
