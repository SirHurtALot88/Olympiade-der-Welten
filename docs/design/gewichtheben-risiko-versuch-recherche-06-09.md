# Gewichtheben: Der kühne Versuch — Risiko/Reward-Recherche mit Messung (06.09.)

Reine Recherche, kein Code auf `main`. Auslöser Chris, wörtlich (06.09.): „die teams sollten
abwechselnd zuerst anfangen pro spieler so dass der 2. spieler quasi darauf reagieren kann wenn
möglich. also wenn cassandra vs gram dran ist und sieht er schafft 126 kann sie ja in ihrem letzten
versuch 127 aimen wenn sie sich das zutraut - je höher der versuch von ihrer stärke abweicht desto
höher ist dann aber auch das risiko auf eine verletzung, kann aber auch mit einem punktesieg
belohnt werden - das muss dann balanced sein das soll fable mal überlegen."

Der erste Teil (wer hebt zuerst) ist bereits entschieden:
`docs/design/gewichtheben-duell-reihenfolge-plan-06-09.md` (PR #825, IWF-Regel empfohlen) — wird
gerade unabhängig als Produktionscode umgesetzt. Dieses Dokument behandelt ausschließlich den
zweiten, noch offenen Teil: den bewussten Griff über die eigene sichere Kapazität hinaus, mit
Verletzungsrisiko und Belohnung.

---

## 0. Ergebnis vorab

1. **Der Mechanismus, den Chris beschreibt, existiert im Kern schon — nur ohne Wagnis und ohne
   Belohnung.** `hebeUebung()` lässt einen zurückliegenden Heber im dritten Versuch bereits auf
   `beste(gegner)+1 kg` ziehen (Zeile 10853 ff., `public/mockups/battle-mode.engine.js`). Genau das
   ist Cassandras „127 kg, weil Gram 126 schaffte" — nur ist die Ansage heute IMMER exakt das
   Minimum zum Ausgleich, nie mehr. Chris will zusätzlich einen freiwilligen ÜBERSCHUSS über dieses
   Minimum, mit eigener Erfolgs-, Verletzungs- und Belohnungskurve.
2. **Gemessen (kaderfest, live-save-Familie, n=24 UND n=96, robust identisch): der Wagnis-Teil
   allein bewegt rho nicht messbar — 0,888 gegen 0,887 Basis, bei aggressivsten geprüften
   Parametern bit-identisch mit der Basis (0,887 vs. 0,887 bei einem Isolationstest ohne
   Belohnungskanal).** Das Risiko, das Chris benennt, ist real — aber es sitzt nicht im Wagnis
   selbst, sondern EINZIG darin, WO die Belohnung landet.
3. **Der gefährliche Hebel ist nachgewiesen, nicht vermutet: ein Bonus, der direkt in den
   gewerteten Zweikampf (`u.summe`, das `MOTOREN[...].wert()` liest) einfließt, drückt rho — aber
   erst ab einer Größenordnung, die als „Punktesieg"-Belohnung ohnehin unrealistisch wäre.** Bei
   +40 % auf die gehobene Last fällt rho/Spiel von 0,887 auf 0,848 (Saison 0,944 → 0,909) — klar
   sichtbar, aber bei +20 % ist die Bewegung (0,887 → 0,888) nicht von Null unterscheidbar, und bei
   +5/+15 % ebenso wenig. Vier Größenordnungen dazwischen gemessen, s. Abschnitt 3.
4. **Empfehlung: den kühnen Versuch bauen, die Belohnung aber NICHT in die Zweikampf-Kilogramm
   legen.** Ansage-getriebenes Wagnis (kein neuer Würfel für die Entscheidung, nur für Ausgang und
   Verletzung), Erfolg/Misserfolg über die BESTEHENDE Risikokurve (`HEBEN_WAGNIS_K`, unverändert),
   Verletzung als seltenes, rein kosmetisches Ticker-Ereignis ohne zusätzlichen Zweikampf-Malus,
   „Punktesieg" als individuelle PPS-/Ticker-Auszeichnung außerhalb von `summe`. Damit ist die
   gemessene rho-Bewegung über alle getesteten realistischen Parameter **null**.
5. **Die projektweite Warnung vor In-Race-Verletzungen (Hockey-Zoneneintritt-Präzedenzfall,
   `docs/pm-briefings/pm-gesamtstand-2026-09-06.md` Abschnitt 5) greift hier NICHT auf dieselbe
   Weise** — Begründung in Abschnitt 4. Das entbindet nicht von der Sorgfalt, aber es ist ein
   anderer Fall, kein Wiederholungsfehler.
6. **Gewichtheben ist live** (`ARENA_RESOLVED_DISCIPLINE_IDS`,
   `lib/resolve/battle-mode-arena-team-points.ts` Zeile 159–161) — jede Umsetzung dieses Fundes
   braucht die verschärfte Opus-Review-Sorgfalt für Produktionscode. Diese Recherche selbst ist
   reine Doku und fällt nicht darunter.

---

## 1. Was heute passiert (Code gelesen)

`hebeUebung(a,b,plan,uebung)` (Zeile 10822 ff.) rechnet Reißen oder Stoßen für ein Duellpaar, drei
Versuche, in Versuch 3 mit Reaktion auf den Gegnerstand:

```js
if(v===2&&beste(gegner)>beste(u)){
  const ziel=Math.round(beste(gegner))+1;
  if(ziel<=max(u)*1.06)kg=Math.max(kg,ziel);
}
```

Wer nach zwei Versuchen hinten liegt, zieht auf `Gegner-Bestwert + 1 kg` — sofern das höchstens 6 %
über dem eigenen Tagesmaximum (`max(u)`) liegt (der Deckel, der verhindert, dass ein hoffnungslos
Unterlegener eine Ansage weit jenseits seiner Physiologie macht — ohne ihn fiel die Gelingensquote
im dritten Versuch auf 36,7 %, s. Kommentar an derselben Stelle). Die Erfolgschance selbst hängt an
einer bereits bestehenden, glatten Kurve:

```js
const risikoMax=Math.max(1,max(u)*(1+(u.ANSAGE-50)*HEBEN_WAGNIS_ANSAGE_FLEX));
const ueber=Math.max(0,kg/risikoMax-1);
const p=Math.max(0.05,Math.min(0.97,
  HEBEN_BASIS[uebung][v]+(u.TECHNIK-50)*HEBEN_TECHNIK_K+(u.NERVEN-50)*HEBEN_NERVEN_K
  +(v===2?(u.NERVEN-50)*HEBEN_NERVEN_K_DRITT:0)+(kg<=u.letzteLast?HEBEN_WIEDERHOLUNG:0)
  -ueber*HEBEN_WAGNIS_K));                          // HEBEN_WAGNIS_K = 6,0
```

`ueber` ist bereits GENAU „wie weit die Ansage über der individuellen sicheren Kapazität liegt" —
`risikoMax` ist der bei hoher ANSAGE gedehnte, bei niedriger gestauchte Maßstab, `HEBEN_WAGNIS_K=6,0`
übersetzt jeden Prozentpunkt Überschuss in 6 Prozentpunkte weniger Erfolgschance. Es gibt also
schon eine smooth-decay-Funktion für „Erfolg bei Überschreitung" — was fehlt, ist NICHT ihre Form,
sondern (a) ein Ziel, das über das nackte Ausgleichs-Kilo hinausgehen darf, (b) eine
Verletzungsfolge bei Misslingen, (c) eine Belohnung bei Gelingen über den reinen Duellsieg hinaus.

Zwei Randbefunde, für die Kalibrierung wichtig:

- **ANSAGE ist von der wahren Stärke praktisch unabhängig**: `r(ANSAGE,LAST)=-0,093` im echten
  live-save-Kader (Kommentar Zeile ~10610). Ein ANSAGE-getriebenes Wagnis triff also nicht bevorzugt
  die eh schon Starken — es ist eine Persönlichkeitsdimension, keine verkappte zweite
  Stärkeanzeige.
- **Jedes hebeUebung-Spiel reseedet vollständig** (`bauBuehne(saat)` setzt `seed=normalisiereSaat(saat)`
  am Anfang jedes einzelnen `disziplinProbe`-Durchlaufs, Zeile 20154–20156). Ein zusätzlicher
  `rr()`-Wurf innerhalb EINES Spiels bleibt in diesem einen Spiel eingeschlossen und verschiebt
  KEINE anderen Spiele einer Serie — anders als der Hockey-Präzedenzfall, s. Abschnitt 4.

---

## 2. Mechanik-Entwurf: der kühne Versuch

### 2.1 Auslöser — unverändert die bestehende Reaktionsbedingung

Nur `v===2 && beste(gegner)>beste(u)`, also exakt Chris' Szenario: der Zurückliegende sieht den
fertigen Wert des Gegners in derselben Übung und entscheidet über seinen letzten Versuch. Kein
neuer Fall, keine neue Bedingung.

### 2.2 Die Entscheidung „wie kühn?" — deterministisch aus ANSAGE, kein neuer Würfel

```
zuschlag = min(WAGNIS_MAX_KG, max(0, ANSAGE-50) * WAGNIS_ANSAGE_K)
ziel     = round(beste(gegner)) + 1 + round(zuschlag)          // statt bisher nur +1
if (ziel <= max(u)*1.06) kg = max(kg, ziel)                     // Deckel unveraendert
```

Bewusst deterministisch aus einem bereits vorhandenen, stärke-unabhängigen Attribut — nicht aus
einem zusätzlichen Zufallswurf. Das hält die Entscheidung „gehe ich das Risiko ein" lesbar
(ein selbstbewusster Heber wagt mehr, ein zurückhaltender bleibt beim Minimum) und frisst keine
zusätzliche `rr()`-Ziehung an einer Stelle, die JEDES Spiel durchläuft — nur der AUSGANG des
gewagten Versuchs (unverändert `rr()<p`) und, neu, die Verletzung bei Misslingen verbrauchen einen
Wurf, und auch nur in dem Bruchteil der Spiele, in dem überhaupt ein kühner Versuch zustande kommt
(gemessen 34–45 kühne Versuche je 5×24 Spiele, s. 3.2 — nicht jedes Spiel, nicht jeder dritte
Versuch).

`WAGNIS_ANSAGE_K` und `WAGNIS_MAX_KG` sind die zwei freien Regler. Deckel 106 % bleibt exakt der
bestehende — ein Heber geht nie über sein physiologisches Limit hinaus, nur mutiger AN es heran.

### 2.3 Erfolgswahrscheinlichkeit — unverändert die bestehende Kurve

Keine neue Formel. `ueber = kg/risikoMax - 1` ist nach der Zielwahl automatisch größer, `p` fällt
über dieselbe `-ueber*HEBEN_WAGNIS_K`-Gerade, die heute schon jeden Versuch bewertet. Das ist
bereits die smooth-decay-Kurve, die die Aufgabe verlangt — sie muss nicht neu erfunden werden, nur
mit einem größeren Eingabewert gefüttert werden dürfen.

### 2.4 Verletzung bei Misslingen — neu, klein, an denselben Eingabewert gekoppelt

```
if (kuehn && !gueltig) {
  p_verletzt = clamp(INJURY_BASIS + INJURY_K * ueber, 0, INJURY_CAP)
  if (rr() < p_verletzt) markiereVerletzt(u)   // rein kosmetisch in DIESEM Duell, s. 2.6
}
```

Nur beim MISSLINGEN eines kühnen Versuchs, nie bei einem normalen Eröffnungs- oder
Sprungversuch, und nie bei Erfolg (ein geglückter Versuch verletzt niemanden — im echten Sport
passieren die schweren Unfälle beim Verlust der Kontrolle über eine Last, die man nicht hält, nicht
beim Halten). `ueber` ist exakt derselbe Wert, der schon die Erfolgschance drückt — „wie weit über
der sicheren Kapazität" treibt beides. Empfohlene Konstanten in 3.3.

### 2.5 Belohnung bei Gelingen — der entscheidende Punkt: NICHT in `summe`

Ein geglückter kühner Versuch hebt tatsächlich mehr Kilogramm — das zählt schon ehrlich in
`u.zweikampf` (`setzeBeste(u,kg)`, unverändert), weil es eine echte, wenn auch riskante, Leistung
ist. Die ZUSÄTZLICHE „Punktesieg"-Belohnung, die Chris will, gehört NICHT zusätzlich in dieselbe
Zahl:

- **Ticker/Optik**: eine eigene Ereigniszeile ("Kühner Versuch geglückt — mehr als nötig, um zu
  gewinnen") und ein auffälligerer visueller Pop (die Engine markiert dritte-Versuch-Erfolge
  bereits als `crit`, Zeile 10913 — ein kühner Erfolg verdient denselben oder einen stärkeren
  Effekt).
- **Individuelle PPS statt Team-/Zweikampf-Punkte**: ein fester Bonus auf die BOXSCORE-PPS des
  Spielers (dieselbe Stelle, die für Gewichtheben laut PR #825 Abschnitt 5.2 ohnehin eine eigene
  PPS-Referenz bekommt/hat) — analog zur bereits entkoppelten Basketball-Impact-Kurve
  (`lib/resolve/battle-mode-arena-team-points.ts`: „individuelle PPs sind weiterhin ECHT
  ENTKOPPELT von den Team-Punkten"). Ein Bonus dort bewegt weder `zweikampf` noch `wert()` noch
  damit rho — er ist im wörtlichen Sinne ein Punktesieg, ohne die Meisterschaft der Rangtreue zu
  gefährden.

Das ist keine Verlegenheitslösung — Abschnitt 3 zeigt, dass genau dieser Unterschied (Bonus in
`summe` vs. Bonus daneben) der einzige Hebel ist, der rho überhaupt bewegt.

### 2.6 Die Verletzungsfolge selbst — bewusst ohne zusätzlichen Zweikampf-Malus

Ein misslungener kühner Versuch ist bereits ein ungültiger Versuch — dieselbe Folge wie jeder
andere Fehlversuch (0 Punkte für diese Übung, im dritten Versuch ggf. Nullwertung, wenn auch die
ersten beiden fehlschlugen — unverändert bestehende Mechanik). Die EMPFOHLENE Verletzungsfolge fügt
dem **nichts** numerisch hinzu: kein zusätzlicher Malus auf die andere Übung, kein Stat-Abschlag wie
bei `fatigue-injury-service.ts` (−50 % Performance). Sie ist ein Flag plus Ticker-Zeile — Grundlage
für eine SPÄTERE, separate Kopplung an das Saison-Fatigue/Verletzungssystem (ein seltenes Ereignis,
das den Spieler für den NÄCHSTEN Spieltag anschlägt), aber das ist ausdrücklich NICHT Teil dieser
Empfehlung und bräuchte eine eigene Messung gegen die Saison-Verletzungszahl (Zielkorridor ~200,
`lib/fatigue/fatigue-injury-service.ts` Kommentar). Grund: genau ein zusätzlicher In-Match-Malus auf
denselben Spielerwert ist die Form, vor der die Projektüberwachung ausdrücklich warnt (Abschnitt 4).

---

## 3. Messung

Methode: kaderfest, live-save-Kaderfamilie (5 echte Team-Paarungen, `data/generated/
kaderfamilie-live-save.json`), `window.__arena.disziplinProbe("gewichtheben", ...)` — derselbe Weg
wie `scripts/miss-alle-disziplinen.mjs`. Der Mechanik-Entwurf wurde als Mess-Fassung hinter
`window.__hebenRisiko` an `hebeUebung()`/`spieleBuehneHeben()` gebaut (ohne den Schalter
bit-identisch zum bestehenden Code — geprüft), in einem ISOLIERTEN Scratch-Worktree gemessen und
NICHT in dieses Dokument oder die PR übernommen (die PR trägt nur diese Markdown-Datei). Wer die
Zahlen nachvollziehen will, baut den unten skizzierten Kern nach — er ist klein genug, um ihn aus
Abschnitt 2 direkt zu übernehmen.

Basis für alle Prozentangaben ist der bestehende `main`-Stand (0,887/0,224/0,944, identisch zur
Basiszeile in `gewichtheben-duell-reihenfolge-plan-06-09.md` Abschnitt 3.2 — beide Recherchen
messen denselben Ausgangspunkt).

### 3.1 rho je Spiel/Saison, fünf Parametersätze, n=24 und n=96 (Median über die Kader-Familie)

| Kandidat | Bonus-Kanal | rho/Spiel n=24 | rho/Spiel n=96 | Spannweite n=96 | rho/Saison n=96 |
|---|---|---:|---:|---:|---:|
| Basis (aus) | — | 0,887 | 0,884 | 0,207 | 0,928 |
| Konservativ (max. 2 kg Zuschlag) | kosmetisch | 0,884 | 0,885 | 0,211 | 0,937 |
| **Moderat — EMPFOHLEN (max. 5 kg)** | **kosmetisch** | **0,887** | **0,885** | **0,212** | **0,928** |
| Dramatisch (max. 10 kg, +5 % testweise IN summe) | in summe | 0,894 | 0,889 | 0,205 | 0,928 |
| Extrem (max. 15 kg, +15 % testweise IN summe) | in summe | 0,883 | 0,882 | 0,199 | 0,930 |
| Pathologisch (max. 20 kg, +40 % IN summe) | in summe | 0,848 | 0,855 | 0,190 | 0,895 |
| Isolationstest (max. 20 kg Zuschlag, KEIN Bonus) | keiner | 0,888 | 0,884 | 0,207 | 0,928 |

Der Isolationstest ist der wichtigste Befund: **dieselbe aggressive Wagnis-Einstellung wie im
pathologischen Kandidaten (Zuschlag bis 20 kg statt 5), aber ohne den Bonus-in-summe-Kanal, liefert
0,884/0,207/0,928 — bit-identisch zur Basis.** Der Zuschlag selbst, auch sehr großzügig bemessen,
bewegt rho nicht. Erst der direkte Bonus auf die gewertete Zahl tut es, und selbst dort erst ab
einer Größenordnung (+20–40 %), die als reale "Punktesieg"-Belohnung ohnehin übertrieben wäre — bei
+5 % und +15 % bleibt die Bewegung innerhalb der Spannweite von 0,20–0,22, also nicht von Null
unterscheidbar.

Kontrollmessung `--je-seite=4/2` (moderater Kandidat, n=48): 0,774 gegen 0,769 Basis bei jeSeite=4
(beide unter der 0,80-Schranke — ein vorbestehender, von dieser Recherche unabhängiger Befund, s.
`gewichtheben-duell-reihenfolge-plan-06-09.md` Abschnitt 3.2, dort 0,760 gemessen), 0,845 gegen
0,845 bei jeSeite=2 (identisch). Der Mechanik-Entwurf verschärft die bestehende jeSeite=4-Lücke
nicht.

### 3.2 Häufigkeit, Erfolg, Verletzung (5 Kader-Varianten × 200 Spiele, frische Formkarten je Spiel)

| Kandidat | Kühne Versuche | Erfolge | Erfolgquote | Verletzt | Verletztquote (v. Versuchen) |
|---|---:|---:|---:|---:|---:|
| Konservativ | 2.093 | 1.647 | 78,7 % | 8 | 0,4 % |
| **Moderat (empfohlen)** | **3.681** | **2.850** | **77,4 %** | **24** | **0,7 %** |
| Dramatisch | 4.259 | 3.185 | 74,8 % | 27 | 0,6 % |
| Extrem | 4.517 | 3.317 | 73,4 % | 17 | 0,4 % |

Umgerechnet auf ein einzelnes Spiel (6 Duelle je Seite, 5 Kader-Varianten, 1.000 Spiele gesamt je
Kandidat): **rund 3,7 kühne Versuche je Spiel** unter dem empfohlenen Rezept — nicht selten, aber
auch kein Dauerzustand (24 dritte Versuche insgesamt je Spiel, s.
`gewichtheben-duell-reihenfolge-plan-06-09.md` Abschnitt 1.1: 34,3 % davon reagieren überhaupt).
Erfolgquote 77 % und Verletztquote 0,7 % der kühnen Versuche (≈ 0,15 % aller dritten Versuche)
liegen in einer Größenordnung, die sich anfühlen sollte wie ein seltenes, denkwürdiges Ereignis —
nicht wie ein Dauerrisiko.

### 3.3 Empfohlene Konstanten

```
WAGNIS_MAX_KG      = 5      // hoechster Zuschlag ueber das Ausgleichs-Kilo hinaus
WAGNIS_ANSAGE_K     = 0.08   // kg Zuschlag je ANSAGE-Punkt ueber 50 (vor dem Max-Deckel)
INJURY_BASIS        = 0.02   // Grundrisiko bei jedem misslungenen kuehnen Versuch
INJURY_K            = 0.10   // zusaetzliches Risiko je Anteil UEBER der Risikokapazitaet
INJURY_CAP          = 0.12   // hoechstens 12 % Verletzungsrisiko je misslungenem kuehnen Versuch
BONUS_IN_SUMME       = false  // Punktesieg-Belohnung LEBT AUSSERHALB von summe/zweikampf
```

Diese Konstanten sind Ausgangswerte für die Umsetzung, keine endgültige Kalibrierung — s. Abschnitt 5.

---

## 4. Warum der In-Race-Verletzungs-Präzedenzfall hier anders liegt

Das Projekt hat einen offenen, bewusst zurückgestellten Fund: „Fable-Recherche: In-Race-
Verletzungen bei Chaos-Aktionen (Tackle/Push)", begründet in
`docs/pm-briefings/pm-gesamtstand-2026-09-06.md` Abschnitt 5: „Eine In-Race-Verletzung ist genau
das, woran Hockeys Zoneneintritt gescheitert ist: ein neuer `rr()`-Wurf im Tick-Loop, der die
gesamte RNG-Kaskade verschiebt und jede Vorher/Nachher-Messung unbrauchbar macht [...] Und ein
−50 %-Malus mitten im Rennen ist eine Rangtreue-Waffe: er bestraft den Getroffenen unabhängig von
seiner Eignung."

Beide Sorgen greifen für den kühnen Versuch aus einem strukturellen Grund NICHT gleich stark:

1. **Kein Tick-Loop, kein Kaskadenproblem.** Hockeys Zoneneintritt lebt in einem laufenden,
   zustandsbehafteten Tick-Loop, in dem ein zusätzlicher `rr()`-Wurf JEDEN nachfolgenden Wurf
   desselben Spiels verschiebt. `hebeUebung()` läuft dagegen innerhalb EINES `bauBuehne(saat)`-
   Aufrufs, der den Seed zu Beginn JEDES EINZELNEN Spiels neu setzt (Abschnitt 1). Ein zusätzlicher
   Wurf für Verletzung bleibt in genau diesem einen Spiel eingeschlossen und kontaminiert keine
   andere Messung in einer Serie — das ist der Grund, warum die Messung in Abschnitt 3 überhaupt
   sauber vor/nach vergleichbar ist, und warum PR #825 (Reihenfolge) bereits denselben Weg gegangen
   ist, ohne ein Kaskadenproblem zu erzeugen.
2. **Kein pauschaler Malus auf den Getroffenen — der Malus ist bereits die bestehende Nullwertung,
   nicht ein neuer, on top gelegter Abschlag.** Der Hockey-Fall bestraft mit einem festen −50 % auf
   Statuswerte unabhängig von Eignung; der kühne Versuch fügt NICHTS zusätzlich zur bestehenden
   Fehlversuch-Folge hinzu (Abschnitt 2.6) — er macht nur ein bereits vorhandenes Risiko (Fehlschlag
   = 0 Punkte) sichtbar und benennt es als „Verletzung", ohne die Zahl dahinter zu verändern.
3. **Der Auslöser ist freiwillig und selten, nicht ein Kontaktereignis, dem man nicht ausweichen
   kann.** Wer nicht zurückliegt, sieht die Mechanik nie. Wer zurückliegt, entscheidet über ANSAGE
   (Persönlichkeit), nicht der Zufall — und 3,7 Ereignisse je Spiel (Abschnitt 3.2) sind eine
   überschaubare Angriffsfläche für Fehlkalibrierung, verglichen mit einem Ereignis, das in JEDEM
   Zoneneintritt eines Feldspiels auftreten könnte.

Das heißt nicht „keine Sorgfalt nötig" — es heißt, dass die HIER gemessene Konstruktion (Abschnitt
2, mit dem Bonus außerhalb von `summe`) aus einer anderen, messbar saubereren Kategorie kommt als
der Hockey-Fall. Die Messung in Abschnitt 3 bestätigt das, sie behauptet es nicht nur.

---

## 5. Was für den Umsetzer offen bleibt

1. **Umsetzung ist PRODUKTIONSCODE** — Gewichtheben ist über `ARENA_RESOLVED_DISCIPLINE_IDS` live
   und zahlt in echte Spieler-PPs ein (s. `gewichtheben-duell-reihenfolge-plan-06-09.md` Abschnitt
   5.1 für denselben Hinweis). Jede Umsetzung dieses Fundes braucht die verschärfte
   Opus-Review-Sorgfalt für Produktionscode, nicht die leichtere Doku-Review-Schwelle.
2. **Reihenfolge dieser Änderung zur laufenden Reihenfolge-Umsetzung (PR #825/IWF-Regel):**
   unabhängig voneinander — der kühne Versuch hängt an der `v===2`-Reaktionsbedingung, die es in
   JEDER der drei geprüften Reihenfolge-Varianten gibt. Sinnvoll ist trotzdem, die
   Reihenfolge-Umsetzung ZUERST zu mergen und DANACH den kühnen Versuch dagegen zu messen
   (Nachmessung, kein Neuentwurf erwartet — die Reihenfolge-Doc selbst zeigt rho praktisch flach
   über alle drei Reihenfolgevarianten, 0,836–0,850).
3. **Die konkrete PPS-Anbindung der Belohnung ist noch nicht spezifiziert.** Abschnitt 2.5 nennt
   die RICHTUNG (individuelle Boxscore-PPS statt `summe`), nicht die genaue Kurve/Konstante — das
   ist Aufgabe der Umsetzung, sobald die Gewichtheben-PPS-Referenz (s. Reihenfolge-Doc Punkt 2)
   steht, gegen die sich ein Bonus überhaupt kalibrieren lässt.
4. **Die Verletzungsfolge ist bewusst auf „kosmetisch in diesem Duell" begrenzt** (Abschnitt 2.6).
   Eine Kopplung an das Saison-Fatigue-System (`lib/fatigue/fatigue-injury-service.ts`, Zielkorridor
   ~200 Verletzungen/Saison) wäre ein eigener, größerer Auftrag mit eigener Messung gegen diesen
   Korridor — NICHT Teil dieser Empfehlung, und nicht ohne eine dedizierte Prüfung zu bauen, wie
   viele zusätzliche Saison-Verletzungen 3,7 kühne Versuche je Spiel über zwei Gewichtheben-Termine
   je Saison realistisch beisteuern (grobe Überschlagsrechnung: 3,7 × 0,7 % ≈ 0,03 Verletzungen je
   Spiel × 2 Spiele/Saison × Teamzahl — vernachlässigbar gegenüber 200, aber nachzurechnen, sobald
   die Kopplung ansteht).
5. **Nicht gemessen:** das Verhalten bei `jeSeite` 3/5 (ungerade Kadergrößen) und das Zusammenspiel
   mit einer künftigen individuellen Gewichtheben-PPS-Kurve selbst (die noch nicht existiert, s.
   Punkt 3) — beides jeweils eine kurze Nachmessung, kein Neuentwurf.
6. **`WAGNIS_ANSAGE_K`/`WAGNIS_MAX_KG` in Abschnitt 3.3 sind Ausgangswerte, keine Feinkalibrierung.**
   Chris' eigener Wunsch nach Balancing-Feingefühl ("das muss dann balanced sein") ist mit diesen
   Zahlen erst grob erfüllt — sie halten rho stabil, sagen aber nichts darüber, ob 3,7 kühne
   Versuche je Spiel sich im echten Spielgefühl richtig anfühlen (zu häufig, zu selten). Das ist
   eine Playtesting-Frage, keine rho-Frage, und gehört vor den Merge auf `main`.

---

## 6. Antwort auf die Ausgangsfrage: lohnt sich das Risiko überhaupt?

**Ja — aber nur die kosmetisch-belohnte Variante, nicht die naive.** Die Messung zeigt einen klaren
Bruch zwischen zwei Konstruktionen, die sich für Chris' Beschreibung gleich anfühlen würden:

- **Wagnis + Verletzungsrisiko + Belohnung AUSSERHALB von `summe`**: rho-Bewegung nicht von Null
  unterscheidbar, selbst bei aggressiven Parametern (Isolationstest, Abschnitt 3.1). Das ist die
  empfohlene Variante — sie liefert genau das dramatische „traut sie sich?"-Moment, das Chris
  beschreibt, ohne die Abnahmezahl zu gefährden.
- **Dieselbe Optik, aber die Belohnung fließt in die gewertete Zahl**: rho-Bewegung ab einer
  gewissen Bonusgröße real und messbar (Abschnitt 3.1, pathologischer Kandidat). Das ist die
  Variante, vor der CLAUDE.md und die Aufgabenstellung zu Recht warnen — und sie ist NICHT
  notwendig, um Chris' Wunsch zu erfüllen.

Eine rein kosmetische Variante ganz ohne neue Erfolgs-/Verletzungsrandomness (nur ein optischer
"Alles-oder-nichts"-Moment auf einem Ergebnis, das ohnehin schon feststeht) wurde erwogen und
verworfen: sie würde Chris' ausdrücklichen Wunsch nach echtem Risiko ("kann aber auch mit einem
Punktesieg belohnt werden") unterlaufen, und die Messung zeigt, dass sie nicht nötig ist, um rho zu
schützen — der hier vorgeschlagene Entwurf erreicht dieselbe Sicherheit, ohne auf echten
Zufall am Versuch selbst zu verzichten.
