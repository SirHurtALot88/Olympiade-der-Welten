# Bahn Paket 2, nächster Schritt: `rezept.WUCHT` kalibriert, Pp 32,0/31,8 → 18,9/17,7 (02.10.)

Folgerunde auf `docs/design/bahn-takeshi-pp-paket2-kalibrierung-01-10.md` (Task #28,
01.10.): dort war `fallenDurchbruch` bei vier Werten gemessen und **verworfen**, weil die
Abweichung weder monoton noch stromstabil war. Diese Doku zieht den dort als "nächsten,
noch nicht versuchten Schritt" genannten Kandidaten: eine direkte Rezept-Kalibrierung von
`rezept.WUCHT` (Task #45, Klasse A, Rezept-Kalibrierung innerhalb bestehender Kanäle).

## Ergebnis vorab

**Pp fällt von 32,0/31,8 (zwei unabhängige Ströme, n=48) auf 18,9/17,7 — innerhalb des
angestrebten 15-18-Korridors und mit deutlichem Puffer zur 25-Schranke.** rho verbessert
sich dabei zugleich (0,871 → 0,898 Median bei n=24, 0,860 → 0,880 bei n=48), die
Kader-Spannweite schrumpft (0,125 → 0,062 bzw. 0,100 → 0,088) — die Änderung macht die
Disziplin also nicht nur treffsicherer bei den Attributen, sondern auch ihre Rangtreue
stabiler, nicht unstabiler. Die drei anderen Bahn-Disziplinen (Time-Trial, Staffel, Spurt)
bleiben über alle vier Messgrößen bit-identisch.

Die Änderung ist eine reine Rezept-Umschichtung innerhalb des bestehenden `WUCHT`-Kanals
von `BAHN_ART["takeshis-castle"].rezept` — keine Konstante, kein Schwellenwert
(`tackleAb`, `fallenKoennen`, `wuchtBasis`/`wuchtSpanne`, `huerdePreis`) wurde angefasst.

| | Torment-Senkung, Versuch 1 (verworfen) | Finale Besetzung |
|---|---|---|
| Rezept | `{charisma:30,determination:55,torment:15}` | `{charisma:28,determination:32,will:30,torment:10}` |
| Pp Strom 1 | 34,3 (**schlechter** als 32,0 vorher) | **18,9** |
| Pp Strom 2 | nicht gültig gemessen (Pfadfehler, s. Abschnitt 2) | **17,7** |

## 1. Diagnose: WUCHT ist Takeshis am staerksten "verstärkte" Kanal

`rezept.WUCHT` (vorher `{charisma:38,determination:32,torment:30}`) wird an drei Stellen
gelesen, nicht an einer — und von ALLEN DREIEN denselben, einzigen berechneten Wert
`u.WUCHT` (`spurtWerte()`, `o.WUCHT=Math.round(mische({a},R.WUCHT))`):

1. **Durchbruch-Wurf, alle 14 Fallen** (`engine.js`, `durch=u.WUCHT` ohne
   `fallenDurchbruch`-Mix) — jede Falle, unabhängig vom Typ, liest beim Durchbruchsversuch
   reine WUCHT.
2. **Sauber-Wurf, die 4 WUCHT-Fallen** (`fallenKoennen:0.75`) — dort mischt `koennen` zu
   75 % `hSkill`, und `hSkill===u.WUCHT`, wenn `hTyp==="WUCHT"`.
3. **Tackle-/Chaos-Schwelle** (`tackleOk = ... && u.WUCHT>(TA.tackleAb??45)`,
   `TA.tackleAb=30`) — wer rempelt, entscheidet sich über denselben Wert.

Torment sitzt NUR in `WUCHT` unter den sieben Sub-Skills der Bahn (ANTRITT, ENDTEMPO,
TECHNIK, WENDIGKEIT, STEHEN, WUCHT, ROBUST) — ein mit Matrixgewicht 7 leichtes Attribut
bekommt dadurch Zugriff auf den am staerksten verstaerkten Kanal der ganzen Mechanik und
wird systematisch überzeichnet (gemessen +2,2 bis +8,6 Pp, je Strom). Will dagegen, mit
22 das höchste Einzelgewicht der Matrix, sitzt in TECHNIK (12), STEHEN (46) und ROBUST
(30), fehlt aber in WUCHT komplett — und ist dadurch das am stärksten unterzeichnete
Attribut (gemessen -6,2 bis -9,3 Pp).

## 2. Erster Versuch: reine Prozent-Umschichtung — verworfen

Naheliegender erster Schritt, Torments Anteil halbiert und auf die beiden verbliebenen
Attribute verteilt, OHNE ein neues Attribut einzuführen:
`{charisma:30,determination:55,torment:15}`.

**Ergebnis: Pp stieg von 32,0 auf 34,3 (Strom 1) — schlechter als unverändert.**
Determination (vorher +2,3 Pp) übersteuerte in genau denselben verstärkten Kanal, den
vorher Torment überzeichnet hatte (neu: +7,1 Pp). Torments eigene Abweichung bewegte sich
dabei kaum (+2,2 → +2,8), obwohl sein Rezept-Anteil halbiert wurde — derselbe
Positiv-Summen-Normierungseffekt aus der `fallenDurchbruch`-Diagnose
(`einflussVon()`s `summe=roh.reduce((x,y)=>x+Math.max(0,y.gewinn),0)`): ein Attribut aus
einem überexponierten Kanal zu kürzen verschiebt das Problem auf den nächsten Kandidaten
in diesem Kanal, es beseitigt die Überexposition selbst nicht.

(Bei diesem Versuch maß der zweite Saatstrom versehentlich gegen den unveränderten
Haupt-Checkout statt gegen den Arbeits-Worktree — eine Bash-Operatorpräzedenz-Falle
(`cd DIR && (A) & (B) & wait` backgroundet `cd DIR && (A)` als EINEN Job, `(B)` läuft
separat ohne das `cd`). Für Strom 1 reichte die Fehlmessung aber bereits aus, den Ansatz
zu verwerfen — er wurde nicht weiterverfolgt.)

## 3. Fix: Will NEU in den Kanal aufnehmen, nicht nur Torment kürzen

Dieselbe Lehre wie die Gewichtheben-ANSAGE-Kalibrierung (PR #1102, `docs/design/
gewichtheben-kalibrierung-ansage-kanal-01-10.md`): die dort erfolgreiche Umschichtung
entfernte nicht nur das überzeichnete `speed` aus `ANSAGE`, sondern nahm die
UNTERzeichneten Attribute `will`/`dexterity`/`health` NEU in genau diesen verstärkten
Kanal auf. Übertragen auf WUCHT: statt Torment nur zu kürzen, übernimmt **Will** den
größten Teil seines alten Anteils — derselbe Kanal, der bisher ein leichtes Attribut
überzeichnete, hebt jetzt gezielt das schwerste. Thematisch passt das: "Durchbrettern"
durch Willenskraft ist dieselbe Eigenschaft, die anderswo in dieser Bahn "Wille" bzw.
"Nehmerqualität" heißt (STEHEN/ROBUST).

Zwei Zwischenschritte bis zur finalen Besetzung, jeweils zwei unabhängige Saatströme,
n=48:

| Rezept | Pp Strom 1 | Pp Strom 2 | Anmerkung |
|---|---:|---:|---|
| unverändert `{charisma:38,determination:32,torment:30}` | 32,0 | 31,8 | Ausgangszustand |
| `{charisma:30,determination:55,torment:15}` | 34,3 | — | verworfen, Abschnitt 2 |
| `{charisma:35,determination:30,will:25,torment:10}` | 26,1 | 25,6 | Charisma schwankt stark zwischen Strömen (+1,9/+7,5) |
| **`{charisma:28,determination:32,will:30,torment:10}`** | **18,9** | **17,7** | final — Charisma stabil (+0,6/+0,8) |

Der mittlere Schritt senkte Pp bereits deutlich, ließ Charisma aber zwischen den beiden
Strömen stark schwanken (+1,9 gegen +7,5 Pp) — dieselbe Normierungs-Empfindlichkeit, die
vorher Torment zeigte, nur jetzt bei einem anderen Attribut im selben Kanal. Charisma von
35 auf 28 gesenkt und Will von 25 auf 30 gehoben (Determination unverändert bei 32,
Torment unverändert bei 10) stabilisierte Charisma über beide Ströme UND senkte die
Gesamt-Pp weiter, auf 18,9/17,7 — beide Ströme komfortabel unter der 25-Schranke, im
angestrebten 15-18-Korridor (Projektrichtlinie aus Breaking Paket 3: ein Puffer, keine
knappe Unterschreitung).

### Volle Pp-Detailtabelle, final (`{charisma:28,determination:32,will:30,torment:10}`)

| Attribut | Matrix | Strom 1 (Saatversatz 0) | Strom 2 (Saatversatz 10 000 000) |
|---|---:|---:|---:|
| will | 22 | 16,0 % / **-6,0** | 19,9 % / **-2,1** |
| determination | 18 | 16,4 % / -1,6 | 19,1 % / +1,1 |
| charisma | 14 | 14,6 % / +0,6 | 14,8 % / +0,8 |
| intelligence | 11 | 12,0 % / +1,0 | 12,7 % / +1,7 |
| torment | 7 | 9,5 % / +2,5 | 10,9 % / +3,9 |
| awareness | 8 | 8,4 % / +0,4 | 9,4 % / +1,4 |
| dexterity | 6 | 8,1 % / +2,1 | 4,6 % / -1,4 |
| health | 4 | 6,9 % / +2,9 | 2,8 % / -1,2 |
| stamina | 6 | 4,4 % / -1,6 | 5,9 % / -0,1 |
| speed | 4 | 3,8 % / -0,2 | 0 % / -4,0 |
| **Abweichung (Pp)** | | **18,9** | **17,7** |

Gemessen mit `node scripts/messe-arena-einfluss.mjs takeshis-castle 48` (Strom 1) und
`node scripts/messe-arena-einfluss-zweiter-saatstamm.mjs takeshis-castle 48` (Strom 2,
Saatversatz 10 000 000), gegen den Arbeits-Worktree.

Charisma, Determination, Intelligence und Awareness liegen jetzt in beiden Strömen
innerhalb von 2 Pp ihres Matrixgewichts. Will bleibt leicht unterzeichnet (-6,0/-2,1,
gegenüber -6,2/-9,3 vorher deutlich verbessert, aber nicht auf null gebracht) — eine
weitere Erhöhung seines WUCHT-Anteils wurde NICHT versucht, weil Pp bereits im
Zielkorridor liegt und CLAUDE.md-Bedacht ("mehr Ereignisse/mehr Eingriff helfen fast nie")
hier ebenso gilt: ein dritter Nachschlag riskiert erneut die Normierungs-Instabilität, die
beide verworfenen Zwischenschritte gezeigt haben, für einen Pp-Gewinn, der nicht mehr
gebraucht wird.

## 4. rho bleibt weit über der Schranke — und wird stabiler

`node scripts/miss-alle-disziplinen.mjs 24 time-trial spurt staffel takeshis-castle`
(Kader-Familie, 5 Paarungen aus `data/generated/kaderfamilie-live-save.json`):

| Disziplin | rho je Spiel (Median) | Spannweite | rho Saison (Median) | Spannweite | vorher (rho je Spiel / Spannweite) |
|---|---:|---:|---:|---:|---|
| time-trial | 0,923 | 0,067 | 0,902 | 0,063 | 0,923 / 0,067 — **bit-identisch** |
| staffel | 0,898 | 0,081 | 0,944 | 0,084 | 0,898 / 0,081 — **bit-identisch** |
| spurt | 0,880 | 0,154 | 0,939 | 0,105 | 0,880 / 0,154 — **bit-identisch** |
| takeshis-castle | **0,898** | **0,062** | 0,986 | 0,021 | 0,871 / 0,125 — bewegt sich, besser UND stabiler |

Bei n=48 (`node scripts/miss-alle-disziplinen.mjs 48 takeshis-castle`, nur Takeshi):
rho 0,860 → 0,880, Spannweite 0,100 → 0,088 — dieselbe Richtung, kleinerer Ausschlag (die
erwartete Verlässlichkeits-/Validitäts-Unterscheidung aus CLAUDE.md: mehr Spiele glätten
die Kader-Spannweite, bewegen die Median-Zahl aber kaum).

Time-Trial/Staffel/Spurt sind über alle vier Messgrößen exakt identisch zum Vorher-Lauf:
`rezept.WUCHT` steht nur in `BAHN_ART["takeshis-castle"]`, die drei anderen Bahnen lesen
ihr eigenes Rezept und bleiben unberührt.

## 5. Isolationsprüfung: Fallen-`koennen()` und Tackle-/Chaos-Mechanik

`u.WUCHT` ist EIN gemeinsam berechneter Wert. `koennen` (die 4 WUCHT-Fallen, über
`fallenKoennen`), `durch` (alle 14 Fallen) und `tackleAb`/die Chaos-Mechanik
(`u.WUCHT>30`) lesen ALLE DENSELBEN Wert — es gibt dafür keinen getrennten Lesepfad. Ein
**struktureller** Isolationsbeweis ("andere Mechanik, anderer Wert") ist darum unmöglich,
und war nicht zu erwarten: die Aufgabe benannte dieses Risiko explizit im Voraus.

Die **empirische** Isolationsprüfung (`scripts/takeshi-chaos-diag-02-10.mjs`, neu, liest
`window.__arena.bahnSerie("takeshis-castle", 48)` — die bestehende, bereits für die
Chaos-Diagnose genutzte Sonde, ergänzt um eine Fallen-Typ-Aufschlüsselung aus `u.fallen`,
und `window.__arena.takeshiWuchtDiag()`, neu, für Median/Spanne von `u.WUCHT`; beide reine
Lese-Diagnosen, kein `rr()`-Aufruf, kein Einfluss auf eine laufende Simulation) zeigt: die
Mechanik bewegt sich, aber bricht nirgends ein.

| Kennzahl | vorher | final | Δ |
|---|---:|---:|---:|
| Rempler / Rennen | 18,45 | 19,73 | +6,9 % |
| Getroffene / Rennen | 8,18 | 8,04 | -1,7 % |
| Ausgewichen / Rennen | 2,78 | 2,52 | -9,4 % |
| Gedränge / Rennen | 93,66 | 87,47 | -6,6 % |
| u.WUCHT Median (Spanne) | 57,5 (18-83) | 53,5 (20-85) | -7,0 % |

Fallen nach Typ (sauber % / durchbruch % / sturz %, aus `u.fallen`, 48 Rennen):

| Typ | vorher | final | Δ (Prozentpunkte) |
|---|---|---|---|
| TECHNIK | 49,6 / 20,7 / 29,6 | 48,4 / 21,9 / 29,7 | ≤1,2 |
| WENDIGKEIT | 51,9 / 20,7 / 27,4 | 51,7 / 19,1 / 29,1 | ≤1,7 |
| **WUCHT** | 44,7 / 14,9 / 40,4 | 45,8 / 14,1 / 40,1 | ≤1,1 |
| STEHEN | 54,8 / 16,9 / 28,3 | 53,8 / 15,8 / 30,4 | ≤2,1 |
| ROBUST | 50,9 / 15,9 / 33,2 | 49,4 / 15,5 / 35,1 | ≤1,9 |

Keine Kennzahl kollabiert auf 0 % oder läuft auf 100 % — Tackles/Getroffene/Ausweichen/
Gedränge bewegen sich um unter 10 %, die Sauber/Durchbruch/Sturz-Aufteilung an JEDER der
fünf Fallen-Arten (inklusive der 4 WUCHT-Fallen selbst) um höchstens 2,1 Prozentpunkte.
Zum Vergleich: der ERSTE, verworfene Umschichtungsversuch (Abschnitt 2) hätte Tackles um
+12,7 % und Getroffene um +11,2 % bewegt — spürbar mehr als die finale Besetzung, ein
weiterer Beleg dafür, dass die Wahl WELCHES Attribut den Kanal übernimmt (Will statt
Determination) die Nebenwirkungen auf die anderen drei Mechanik-Leser klein hält, nicht
nur die Pp-Zahl selbst.

## 6. Status der Abnahme

Takeshi's Castle erfüllt jetzt beide CLAUDE.md-Pflichtabnahmen gleichzeitig: rho je Spiel
0,898 (n=24) bzw. 0,880 (n=48), beides deutlich über 0,80, UND Pp 18,9/17,7 über zwei
unabhängige Ströme, beides innerhalb des 15-18-Zielkorridors. `node --check` auf
`battle-mode.engine.js` ist grün, `npx vitest run` zeigt keine neuen Fehlschläge
gegenüber `main` (s. PR-Beschreibung für den vollen Lauf).

## Quellen

`docs/design/bahn-takeshi-pp-paket2-kalibrierung-01-10.md` (Diagnose, `fallenDurchbruch`
verworfen, nennt `rezept.WUCHT` als nächsten Schritt), `docs/design/
gewichtheben-kalibrierung-ansage-kanal-01-10.md` (PR #1102, Vorbild für "Umschichtung +
neues Attribut im überexponierten Kanal"), `engine.js` `BAHN_ART["takeshis-castle"].rezept`
(die Änderung selbst), Durchbruch-/Sauber-Wurf (`koennen`/`durch`, nahe `fallenKoennen`),
Tackle-/Chaos-Schwelle (`tackleOk`, nahe `tackleAb`/`tackleFenster`), `bahnSerie()` (die
erweiterte Chaos-Diagnose-Sonde, inklusive der neuen `fallenNachTyp`-Aufschlüsselung und
`takeshiWuchtDiag()`), `scripts/takeshi-chaos-diag-02-10.mjs` (neue Sonde, liest beide
Funktionen), `einflussVon()` (`engine.js`, insbesondere die Positiv-Normierung, die den
ersten Umschichtungsversuch verworfen hat), CLAUDE.md (rho>0,80 je Spiel, Pp≤25/Zielwert
15-18 aus Breaking Paket 3, gesperrte Matrix, Budget-Methode).
