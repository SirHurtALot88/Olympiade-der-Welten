# Gewichtheben, Breaking, Climbing — frische Ideen (Fable, 30.09.)

**Reines Ideendokument.** Kein Code, keine Produktionsdatei angefasst, keine Messung gefahren.
Jede Zahl unten ist aus dem Repo zitiert (Datei daneben), jede Idee ist ein Vorschlag, den Chris
annehmen, umbauen oder verwerfen kann. Auftrag: offenes Brainstorming zu diesen drei Disziplinen —
was ihnen als **Gameplay** noch fehlt, welche Formate aus echten Sportarten und Survival-Formaten
noch nicht aufgegriffen sind, und wo die Leitlinie „mehrere Wege zum Erfolg" (CLAUDE.md, 21.09.)
greifen könnte, wo sie heute noch nicht existiert.

Die Leitplanken, an denen jede Idee unten gemessen ist:

- Die Eignungsmatrix (`lib/player-generator/official-discipline-weights.ts`) ist gesperrt. Keine
  Idee will sie ändern; jede lebt mit den vorgegebenen Gewichten.
- rho je Spiel über 0,80, Pp-Abweichung ≤ 25 in zwei Saatstämmen — beides bleibt die Abnahme
  jeder Mechanik-Idee. Wo eine Idee eines davon riskiert, steht es dabei.
- Breaking ist Folter/Survival, nicht Breakdance. Kein Move, kein Beat, kein DJ-Pult.
- Kein Zug wird durch fremde Hand vernichtet (Projektregel, `climbing-opus-gegencheck-24-09.md`).

**Klassen:** **A** = reine Anzeige/Ton/Text, rho-neutral per Bauart, kann ohne Chris' Freigabe in
einer Politur-Runde mitlaufen. **M** = echte Mechanik-Änderung (bewegt `u.summe`, `wert()`,
Erfolgschancen oder Reihenfolgen), braucht Chris' Ja und eine kaderfeste Vorher/Nachher-Messung.
**Aufwand:** klein (≤ 0,5 Tag), mittel (1–2 Tage inkl. Messung), groß (3+ Tage, mehrere PRs).

---

## 0. Die drei stärksten Ideen vorab

| # | Disziplin | Idee | Klasse | Aufwand | Warum sie zuerst |
|---|---|---|---|---|---|
| B1 | Breaking | **Zehn Geräte, drei Familien, drei Wege** — jedes Foltergerät prüft einen anderen Kanal (Zermürbung → NERVEN, Hieb → TECHNIK, Wucht → SPITZENMOMENT), der Peiniger wählt es | M | mittel–groß | Ist heute reine Optik. Dasselbe Muster (`hindernisTypen`/`fallenKoennen`) hat bei Takeshi und Climbing gemessen rho gehoben, und es ist die einzige Stelle in Breaking, an der „mehrere Wege" überhaupt entstehen können |
| B2 | Breaking | **Der Peiniger wirkt** — die Wucht des Zufügenden skaliert den HP-Verlust des Ertragenden (gedeckelt ±20 %) | M | mittel | Heute hat der, der Schmerz zufügt, mechanisch **null** Einfluss; `gauntletRunde()` liest nur den Ertragenden. Chris' Satz „einer fügt Schmerz zu, der andere muss es aushalten" ist erst dann Mechanik |
| G1 | Gewichtheben | **Der Heber liest die Mannschaftstafel** — ab dem vierten Duell weiß der Heber, ob sein Duell das Team entscheidet, und plant danach (sichern oder zocken) | M | mittel | Die sechs Duelle sind heute sechs Inseln. Das Entscheidungsduell ist der Moment, den jede Mannschaftsübertragung im echten Sport hat — und die Bühne enthüllt ohnehin Duell für Duell, das Bild ist also schon da |

**Climbing** bekommt bewusst nur Kleines (C1, C2): zwei volle Konzeptrunden in acht Tagen und
eine gerade gemergte PR 2 — die nächste Climbing-Runde sollte eine Messrunde sein, keine dritte
Mechanikrunde (Abschnitt 4.0).

---

## 1. Rückblick: was existiert, was entschieden ist

### 1.1 Gewichtheben — live, rund, dreimal nachgeschliffen

| Stand | Wert | Quelle |
|---|---|---|
| rho je Spiel / Spannweite / Saison | **0,843** / 0,208 / 0,930, bestanden | `stand-aller-disziplinen.md` Abschnitt 1 (26.09.) |
| Pp-Abweichung | **19,1** bei n=48 (29,1 bei n=24 ist ein Messartefakt, kein Befund) | `gewichtheben-pp-regression-befund-27-09.md` |
| Live | ja, `ARENA_RESOLVED_DISCIPLINE_IDS` | seit 06.09. |

Was die Mechanik heute kann (`baueHebenDuelle()`/`hebeUebung()`, `engine.js:15314 ff.`): sechs
Duelle über den Slot gepaart, Reißen + Stoßen à drei Versuche, IWF-Reihenfolge im dritten Versuch
(leichtere Ansage hebt zuerst, `#825`), kühner Versuch mit Verletzungs-Flag und Belohnung
außerhalb von `summe` (06.09.), Zweikampf-bewusste Reaktion und duellbewusste Eröffnung bei
festem Zielgewicht (13.09.), Wagnis-Flex über ANSAGE (03.09.). Broadcast: Versuchstafel,
Bedarfszeile, Herzschlag, Publikum-Tonspur, Qual-Skala (Phase 3/4).

Entschieden und nicht mehr zu diskutieren: **keine** gleichen Gewichte für beide (löscht die
Taktik), **keine** volle IWF-Reihenfolge über alle sechs Versuche (dramaturgisch schlechter im
Zweierduell), **keine** Paarung nach Stärke statt Slot (Chris' Produktentscheidung), **kein**
kühner Versuch für den Führenden (gemessen begründet, `gewichtheben-spannung-recherche-13-09.md`
5.6). Offen gelassen: ob LAST (die physische Obergrenze) einen kleinen Charisma-Anteil bekommen
darf — eine Architekturfrage, die ich hier **nicht** wieder aufmache (Abschnitt 2.6).

### 1.2 Breaking — Gauntlet seit dem 22.09., Rezept nachgezogen, Optik folterfest

| Stand | Wert | Quelle |
|---|---|---|
| rho je Spiel / Spannweite / Saison | **0,833** / **0,250** / 0,914, bestanden | Abschnitt 1 (26.09.) — die **höchste Spannweite aller bestandenen** Disziplinen |
| Pp-Abweichung | 13,9 / 14,9 — aber bei n=1/n=2, weil n≥12 reproduzierbar im OOM stirbt | Zwölfter Nachtrag, „technischer Nebenbefund" |
| Live | **ja** — `ARENA_RESOLVED_DISCIPLINE_IDS` (`lib/battle/arena-resolved-disciplines.ts:153`), über den eigenen `ARENA_BUEHNE_GAUNTLET_DISCIPLINE_IDS`/`spieleBuehneGauntlet()`-Pfad; jede Mechanik-Idee unten ist damit Produktionscode mit verschärfter Review-Sorgfalt, wie bei Gewichtheben | |

Was die Mechanik heute tut (`baueGauntlet()`/`gauntletRunde()`, `engine.js:16346–16420`):
Team-Slot 1 gegen Team-Slot 1, feste Reihenfolge, Sieger bleibt mit seinem HP-Stand
(`GAUNTLET_HP_MAX` 400), Rollen wechseln nach jedem Zug (Ertragender ↔ Peiniger), nach jedem
K.o. erträgt der frische Herausforderer zuerst. **Je Zug würfelt ausschließlich der Ertragende**:
`erfolg = 0,15 + TECHNIK·0,0055 + NERVEN·0,0035`; hält er stand, −10 HP und volle Punkte, bricht
er ein, −24 HP und `failAbzug 0,55`. Ermüdung nach 12 eigenen Zügen über AUSDAUER.

**Zwei Befunde, die alle Breaking-Ideen unten tragen:**

1. **Der Peiniger ist mechanisch nicht vorhanden.** `gauntletRunde(L,ri,art)` bekommt nur den
   Ertragenden. Wer zufügt, ist nur ein Name im Ticker und eine Figur mit Gerät in der Faust.
   Der Gauntlet ist heute „jeder würfelt gegen sich selbst, wer länger durchhält, gewinnt" — das
   ist auch der Grund, warum rho so sauber ist (kein Paarungsrauschen), und der Grund, warum sich
   der Zweikampf nicht wie ein Zweikampf anfühlt.
2. **Die zehn Foltergeräte sind reine Anzeige.** `folterStufe()` bildet den Durchgangsindex auf
   die Leiter Strick → Vorschlaghammer ab (`breaking-folter-zweikampf-praesentation-13-09.md`
   2.4). Kein Gerät prüft etwas anderes als das nächste; der Vorschlaghammer ist genauso leicht
   auszuhalten wie der Strick.

Entschieden: Breakdance-Recherche verworfen (zweimal), Charisma-Gewicht 0 ist richtig, `rundenN`
und `failAbzug` bleiben (Kalibrierung 10.09.). Breaking führt bewusst **noch** die alte
WAGNIS-Formel (nur Erfolgsbonus), weil die Gauntlet-Kaskade eine eigene Abnahme braucht
(`engine.js:16341–16345`). Offen aus 13.09. Abschnitt 5: Gang zum Tisch, Rollenrichtung,
eigene Folter-Geräusche je Stufe, Breakdance-`id`s.

### 1.3 Climbing — zwei Konzeptrunden, PR 2 gemergt, Lead-Wand mit Duelldruck

| Stand | Wert | Quelle |
|---|---|---|
| rho je Spiel / Spannweite / Saison | **0,814** / 0,214 / 0,846, bestanden (vor PR 2: 0,834) | Abschnitt 1 (26.09.) |
| Pp-Abweichung | 16,4 / 16,9, zwei Saatströme | Zwölfter Nachtrag |
| Live | ja, seit 16.09. | |

Was PR 2 (26.09.) aus dem Konzept vom 22.09. und dem Opus-Gegencheck vom 24.09. gebaut hat
(`BAHN_ART.climbing`, `engine.js:31279–31447`): fünf Griffarten in drei Layouts
(Überhang/Platte/Dach, Crux oben), Zeitpreis je Griff, drei Exen als Zonen, Abrutschen A-2 mit
Höchstmarke und Balance-Deckel, Balance als Kopf-Ressource, Umsetzen als zweiter Nebenweg, Pump
in der Sturzchance (`pusteHindernis`), Duelldruck G-2 gegen den festen Partner auf der
gespiegelten Route, Zeitlimit 16,3 Sim-s (Top-out 44,8 %), Rast-Schwellen je Plan,
`mengeAusEignung`. Broadcast: Kamera nach oben, Felskulisse, Countdown, Exe-Splits, Balance-Ring,
Duell-Band (Phase 4/5).

Entschieden: **kein Störgriff G-1** (Chris hat ein Veto, Gegencheck Abschnitt 6 — ich mache das
nicht wieder auf), **keine** IFSC-Boulder-Punkte, **kein** Boulder-Bild, **kein** Helfer-Bonus
für Teamkollegen, **kein** Flow-Bonus für den Führenden. Gemessen und verworfen: ein neunter
GESPUER-Kanal frisst sich unter `mengeAusEignung` selbst auf (`engine.js:31470–31482`) — jede
weitere Climbing-Idee, die „einen Kanal daneben stellt", ist damit vorab tot.

---

## 2. Gewichtheben

**Ehrliche Einordnung:** die rundeste der drei. Drei Recherche-/Umsetzungsrunden haben die drei
Fragen, die Chris hatte (wer hebt zuerst, das Wagnis, die Spannung), sauber beantwortet und
gemessen. Was unten steht, ist kein Rettungsplan, sondern Feinschliff plus **eine** Ebene, die
wirklich fehlt: die Mannschaft.

### G1 — Der Heber liest die Mannschaftstafel (M, mittel)

**Was.** Die sechs Duelle werden heute unabhängig voneinander gerechnet (`baueHebenDuelle()`,
Schleife über `paar`), und die Bühne enthüllt sie **nacheinander**. Jeder Heber plant so, als
gäbe es nur sein Duell. Im echten Mannschaftskampf (Bundesliga Gewichtheben, Länderkämpfe) weiß
der Schlussheber auf das Kilo genau, was seine Mannschaft noch braucht — und das ändert, wie er
hebt. Vorschlag: die Schleife führt den laufenden Duellstand mit (`gewonnen`, `verloren`,
`offen`) und reicht ihn als `teamLage` in `hebeUebung()`:

| Lage beim Aufruf des Duells | Verhalten (deterministisch aus vorhandenen Kanälen) | Bild |
|---|---|---|
| Team führt uneinholbar (z. B. 4:0 vor Duell 5) | beide heben „für die Tafel": das Wagnis-Fenster (`HEBEN_WAGNIS_MAX_KG`) öffnet sich weiter, ANSAGE entscheidet wie heute, wie viel davon genutzt wird | Ticker „Der Sieg steht — Gram geht auf den Tagesbestwert" |
| Team liegt uneinholbar hinten | dasselbe: nichts mehr zu verlieren, das Wagnis öffnet sich | „Für die Ehre: Cassandra lädt 5 kg über Bedarf" |
| Dieses Duell entscheidet (3:2 / 2:3 / 3:3-Gefahr) | **Entscheidungsduell**: der `versatz` aus Maßnahme B (13.09.) kippt für beide in Richtung „sichern" (Eröffnung sicherer, Zielgewicht fix, wie dort), das Wagnis-Fenster schließt sich auf das Ausgleichs-Kilo | Banner „ENTSCHEIDUNGSDUELL", Herzschlag aus Phase 3 auf Anschlag |
| Noch offen (Duell 1–3) | wie heute, unverändert | — |

**Warum genau hier.** Gewichtheben ist die einzige der drei Disziplinen mit einem echten
Duell-Bild auf der Bühne, und die Bühne enthüllt Duell für Duell — Chris sieht den Teamstand
nach Duell 4 ohnehin. Dass die Heber ihn **nicht** sehen, ist die Lücke. Das ist zugleich der
Unterschied zum verworfenen „kühner Versuch für den Führenden" (13.09., 5.6): dort ging es um
das eigene Duell, hier um das Team; dort wäre das Risiko in allen Duellen getragen worden, hier
nur in den entschiedenen (wo es rho nicht kostet, s. u.) und im Entscheidungsduell (wo es
*sichert*, nicht zockt).

**Attribute/Rezept.** Kein neuer Sub-Skill. Nutzt ANSAGE (charisma 60) für das Wagnis und den
bestehenden Eröffnungs-Versatz. Charisma liest heute leicht unter Matrix (Regressionsbefund
27.09.: 26,5 % bei n=24 gegen 23 — bei n=48 eher darunter); ein zweiter ANSAGE-Ort schadet der
Pp-Zahl nicht, muss aber gemessen werden.

**rho-Risiko: klein, mit Beleg.** Die 06.09.-Recherche hat gemessen, dass ein Wagnis-Zuschlag
allein — selbst bis 20 kg — rho nicht bewegt (Isolationstest, 0,884/0,207/0,928 bit-identisch
zur Basis). Der Zuschlag landet ehrlich in `zweikampf` (mehr gehoben ist mehr gehoben), aber
nicht als Bonus obendrauf. Das Entscheidungsduell nutzt den `mutDeckel`-Mechanismus von Maßnahme
B, der den IWF-Korridor nachweislich hält. Zu messen: kaderfest n=24/48, Korridor-Sonde,
Dramaturgie-Sonde (`diag-gewichtheben-spannung.mjs`) mit einer neuen Zeile „Entscheidungsduelle
je Spiel".

**Aufwand.** Ein PR, ~1 Tag Mechanik + Messung, ein halber Tag Anzeige (Banner, Ticker). Berührt
nur `baueHebenDuelle()`/`hebeUebung()` hinter `art.heben`, kein anderer Bühnenmotor.

**Nebenfund, bitte prüfen:** der Team-Tiebreak bei 3:3 (Gesamt-kg entscheidet, Empfehlung vom
03.09.) hatte damals keinen Code-Ort. Ob er seit der Produktivierung am 06.09. existiert, konnte
ich in dieser Runde nicht nachlesen. Falls nicht, gehört er in denselben PR — ein
Entscheidungsduell ohne Entscheidung wäre der falsche Witz.

### G2 — Drei Kampfrichter, drei Lampen, ein „knapp!" (A, klein)

**Was.** Im echten Gewichtheben entscheiden drei Kampfrichter mit Weiß-/Rotlicht, zwei Weiß
genügen. Heute ist der Ausgang binär (`rr()<p`). Vorschlag: beim Wurf wird die **Distanz** zur
Schwelle mit abgelegt (`r.marge = p − wurf`, kein zweiter Wurf, nur ein Feld in `runden[v]`), und
die Versuchstafel aus Phase 3 zeigt daraus drei Lampen:

| Marge | Lampen | Bild/Ton |
|---|---|---|
| deutlich gültig (Marge > 0,15) | weiß weiß weiß | sofort |
| knapp gültig (0 < Marge ≤ 0,15) | weiß weiß **rot** | Lampen mit 0,4 s Verzögerung, „Kampfrichter uneins" |
| knapp ungültig (−0,10 ≤ Marge ≤ 0) | **weiß** rot rot | Verzögerung, Ticker „so knapp — ein Kampfrichter sah es gültig" |
| deutlich ungültig | rot rot rot | sofort, Hantel fällt |

Dazu für das Stoßen: **wo** es scheitert — Umsetzen (Clean) oder Ausstoß (Jerk). Ableitbar ohne
neue Zahl aus dem Verhältnis TECHNIK zu LAST des Hebers (schwacher Techniker scheitert im Umsetzen,
schwacher Kraftheber im Ausstoß) — reine Beschriftung der Fehlversuch-Animation.

**Warum.** Chris' Spannungsbefund vom 13.09. war „man sieht am Anfang schon, wer gewinnt". Die
Maßnahmen dort haben die *Zahlen* enger gemacht; die Lampen machen den **einzelnen Versuch** enger
— „knapp gültig" ist die Sekunde, die jede Übertragung trägt. rho-neutral per Bauart: nur
`viz`/Anzeigefelder, derselbe Wurf, dieselbe Schwelle; Abnahme bit-identisch wie bei jeder
Präsentationsrunde. Timing passt in `rundenDauer 1,55 s`.

### G3 — Die Ansage-Änderung wird sichtbar (A, klein)

**Was.** `hebeUebung()` kennt die vorab geplante Ansage (`ansage[u.id]`) und die tatsächlich
gehobene Last (`kg`), die im dritten Versuch nach dem Gegnerstand nachgezogen wird. Im echten Sport
ist genau diese Änderung („Ansage 126 — geändert auf 128!") der Poker-Moment am Anmeldetisch, und
die IWF erlaubt sie zweimal. Vorschlag: die Versuchstafel zeigt beide Zahlen mit einem
durchgestrichenen Alt-Wert, ein Kreide-Klick als Ton, Ticker „zieht nach: 128". Falls die
Bedarfszeile aus Phase 3 das bereits teilweise trägt, ist es nur der Alt-Wert, der fehlt — bitte
gegenlesen.

**Warum.** Der einzige gegnerabhängige Zug des Tages ist heute im Bild unsichtbar; man sieht das
Ergebnis, nicht die Entscheidung. Klein, rein lesend.

### G4 — Der Weg zurück nach dem Fehlversuch läuft über ERHOLUNG (M, klein)

**Was.** Nach einem Fehlversuch bekommt ein wiederholter Versuch heute einen **flachen** Bonus
`HEBEN_WIEDERHOLUNG = 0,19` — für jeden Heber gleich. Im echten Sport entscheidet die Erholung in
den zwei Minuten zwischen zwei Versuchen, ob die Wiederholung gelingt; das ist Physis, nicht
Technik. Vorschlag: `0,12 + (ERHOLUNG/100)·0,14` statt 0,19 (bei ERHOLUNG 50 dieselbe 0,19, also
die heutige Nullstelle), ERHOLUNG = stamina 40 / health 35 / will 25.

**Warum das „mehrere Wege" ist.** Heute führt jeder Weg zum gültigen Versuch über TECHNIK und
NERVEN. Der Zähe, der einen Fehlversuch wegsteckt und dieselbe Last beim zweiten Mal hebt, hat
keinen eigenen Kanal — obwohl die Slot-Rolle „Grip Anchor" genau diese Geschichte erzählt. Das ist
ein Nebenweg im Wortsinn: nicht sauber, aber wieder oben.

**Pp.** health (16) liest 12–13 %, will (7) liest 5 %, beide **unter** Matrix (03.09.-Bericht
Tabelle 2) — ein kleiner ERHOLUNG-Kanal zieht beide in die richtige Richtung. Stamina (2) bekommt
ein wenig mehr, ist aber so klein gewichtet, dass es unter der Messgenauigkeit bleibt.
**Korridor:** die Nullwertungsquote (heute 1,6–3,1 %, Ziel ≤ 3 %) hängt direkt an diesem Bonus —
niedrige ERHOLUNG heißt mehr Nullwertungen. Deshalb die symmetrische Form um 0,19 und die
Korridor-Sonde als Pflicht. Aufwand: eine Zeile plus Messung.

### G5 — Reißen als Technik-, Stoßen als Kraftübung (M, mittel, **Pp-riskant, nur als Frage**)

Im echten Sport ist das Reißen die technisch-schnelle Übung, das Stoßen die Kraftübung. Bei uns
sind `maxReissen`/`maxStossen` beide reine LAST-Anteile (`engine.js:15334–15337`); TECHNIK wirkt
nur auf die Erfolgschance. Man könnte das Reißen-Maximum zu einem kleinen Teil aus TECHNIK
speisen und das Stoßen-Maximum dafür etwas stärker aus LAST — dann gäbe es zwei Wege zum
Zweikampf: der Techniker gewinnt das Reißen, das Kraftpaket das Stoßen, und ein Duell kann nach
dem Reißen kippen.

**Warum ich es trotzdem nicht empfehle:** dexterity und speed tragen in der Matrix je nur 6, und
speed liest heute schon **über** Matrix (12,1 % bei n=48). Jede Verschiebung in TECHNIK hebt beide
weiter. Der Techniker-Archetyp ist seit dem 03.09. der schwächste der vier (rho 0,385 in der
Archetyp-Sonde), aber die Matrix will ihn schwach — das ist keine Lücke, sondern Chris' Gewicht.
Nur wenn Chris den Techniker ausdrücklich sichtbarer haben will; dann klein anfangen (TECHNIK-
Anteil im Reißen-Max ≤ 10 %) und gegen beide Saatstämme messen.

### 2.6 Was ich für Gewichtheben bewusst nicht vorschlage

- **Charisma in LAST** — die offene Architekturfrage vom 03.09. Sie ist Chris' Entscheidung; ein
  Ideendokument sollte sie nicht durch die Hintertür beantworten.
- **Verletzung an das Saison-Fatigue-System koppeln** — der 06.09.-Bericht grenzt das ausdrücklich
  als eigenen Auftrag mit eigener Messung gegen den ~200-Verletzungen-Korridor ab. Bleibt so.
- **Bundesliga-Relativpunkte als Teamwertung** (Punkte je Heber aus kg über Körpergewicht, Summe
  entscheidet). Wäre realistisch und würde jedes Duell zählen lassen, nicht nur den Sieg — aber es
  ersetzt die Duellwertung, ändert `wert()`, die PPS-Referenz und die Erzählung „Duell für Duell",
  die Chris gefällt. Zu groß für den Gewinn.

---

## 3. Breaking

**Ehrliche Einordnung:** die Disziplin mit dem meisten Spielraum — nicht weil sie schlecht wäre
(bestanden, Pp gut), sondern weil der Gauntlet-Umbau vom 22.09. die **Struktur** geändert hat,
ohne dass die Mechanik je Zug nachgezogen wurde (`gauntletRunde()` ist „reine Extraktion", so
steht es im Code). Die Folge: ein Zweikampf, in dem der Gegner nichts tut, und eine Folterbank,
die nichts prüft.

### B0 — Vorbedingung: das Speicherleck zuerst

`messe-arena-einfluss.mjs breaking` stirbt bei n≥12 reproduzierbar im Cgroup-OOM (13,5 GB RSS,
Zwölfter Nachtrag). Die Pp-Zahlen 13,9/14,9 stammen aus n=1/n=2 und lesen laut Handbuch 3.2
systematisch **zu niedrig**. Jede Mechanik-Idee unten braucht eine echte Pp-Abnahme bei n=48 in
zwei Saatstämmen — die gibt es erst, wenn die Gauntlet-Schleife (`GAUNTLET_MAX_ANSCHLAEGE 600`,
`buehneQueue`, `runden[]` je Zug mit HP-Feldern) nicht mehr über die Messläufe hinweg wächst.
Kein Vorschlag, eine Voraussetzung. Aufwand klein bis mittel, rein technisch.

### B1 — Zehn Geräte, drei Familien, drei Wege (M, mittel–groß) — **stärkste Idee**

**Was.** Die Folterbank aus dem 13.09. bleibt (Strick → Vorschlaghammer), aber jedes Gerät bekommt
eine **Familie**, und die Familie entscheidet, welcher Kanal des Ertragenden geprüft wird — exakt
das `hindernisTypen`/`fallenKoennen`-Muster, das Takeshi (rho 0,861 → 0,883) und Climbing (PR 2)
schon fahren, nur auf der Bühne:

| Familie | Geräte (Stufe) | Was sie tut | Prüft primär | Sekundär (`koennen`-Mix wie `fallenKoennen 0,5`) |
|---|---|---|---|---|
| **Zermürbung** | Strick (1), Daumenschraube (4), Zange (5) | langsamer, anhaltender Schmerz | NERVEN (will 50 / health 50) — „Aushalten", „Standhalten" | TECHNIK |
| **Hieb** | Rute (2), Peitsche (3), Nagelkeule (8) | kurzer, scharfer Schmerz | TECHNIK (torment 50 / det 35 / power 15) — „Zermürbung"-Slot, „Steingesicht" | NERVEN |
| **Wucht** | Keil (7), Brandeisen (6), Säge (9), Vorschlaghammer (10) | körperlich, brechend | SPITZENMOMENT (power 55 / will 45) — „Bruchpunkt", „Unbroken" | NERVEN |

Die Erfolgschance je Zug wird `erfolg = 0,15 + K·0,009`, wobei `K = 0,5·Familienkanal +
0,5·(heutiger TECHNIK/NERVEN-Mix)` — der Wurf wird dadurch nicht lauter, sondern **breiter**
(Motorkommentar Takeshi). Die Punktformel bleibt.

**Wer wählt das Gerät?** Der Peiniger — deterministisch, ohne `rr()`: seine Slot-Rolle. Die sechs
Breaking-Slots tragen die Familien schon in ihren Namen (Bruchpunkt/Unbroken → Wucht,
Zermürbung/Steingesicht → Hieb, Aushalten/Standhalten → Zermürbung); der Peiniger greift zu dem,
was er kann. Dazu die Leiter: **innerhalb eines Bouts** steigt die Stufe je Anschlag (Anschlag 1
mild, Anschlag 10 das schwerste Gerät seiner Familie), und die Stufe senkt die Erfolgschance des
Ertragenden linear (`− stufe·0,02`): ein langer Bout endet, weil das Aushalten schwerer wird,
nicht weil der HP-Verlust wächst. Der HP-Verlust (10/24) bleibt fest — das schützt den
Reliabilitäts-Hebel, für den `GAUNTLET_HP_MAX` 100 → 400 gesetzt wurde.

**Warum das genau zu Breaking passt.**

1. Chris' Bild ist „einer fügt Schmerz zu, der andere muss es aushalten" — mit Geräten, „die immer
   schlimmer werden". Heute ist das „schlimmer" ein Bildindex. Mit Familien ist es die Frage: **was
   hält dieser Kämpfer aus, und was nicht?** Der Wille-Star hält den Strick und die Daumenschraube
   ewig — und bricht am Vorschlaghammer, weil ihm die Physis fehlt. Das Kraftpaket steht den Hammer
   durch und zermürbt an der Zange. Das ist die Spreizung, die Chris am 13.09. für Takeshi verlangt
   hat („man soll nen unterschied sehen ob jemand eine meistert").
2. Es ist **das** „mehrere Wege"-Muster aus CLAUDE.md, und Breaking hat heute keins: der Ertragende
   hat genau einen Weg (TECHNIK+NERVEN, immer gleich gemischt). Drei Familien sind drei Wege durch
   dieselbe Kette.
3. Die Kettenreihenfolge (Slot 1..6, fest) bekommt eine zweite Bedeutung: **wen** ich an Slot 3
   stelle, entscheidet, mit welchem Gerät mein Team den gegnerischen Überlebenden empfängt. Chris'
   „Slot 6 holt noch mal richtig auf" wird planbar, nicht nur möglich.

**Pp-Abnahme, vorgedacht.** Die Regel vom 23.09. („jedes Attribut in höchstens einem der
erfolgsgebundenen Kanäle") wird durch die Familien **nicht** verletzt, solange die Familienkanäle
die bestehenden drei sind (NERVEN, TECHNIK, SPITZENMOMENT) und kein Attribut neu in zwei davon
sitzt. Heikel ist **power** (10): heute in SPITZENMOMENT/TECHNIK/WAGNIS; als Wucht-Primärkanal
liest es an 4 von 10 Stufen verstärkt (Überlebensdauer-Hebel, s. Motorkommentar). Erste
Schraube: power in TECHNIK auf 0, Wucht-Familie auf drei Stufen statt vier. Zweite: `koennen`
0,5 → 0,35. Beides sind Zahlen, die die Budget-Methode setzt, nicht dieses Dokument.

**rho-Erwartung.** Bei Takeshi/Climbing hat dasselbe Muster die Validität gehoben; hier ist das
Risiko die Spannweite (0,250, schon heute die höchste der bestandenen) — weil ein Kämpfer, der
an einer Familie schwach ist, gegen ein Team mit drei Wucht-Slots früher fällt als gegen eins
mit drei Zermürbern (Paarungsrauschen). Das ist bei einem K.o.-Format Teil des Formats, und der
Neunte Nachtrag hat es ausdrücklich so akzeptiert. Abnahme: kaderfest n=24, Median **und**
Spannweite, dazu Star-auf-Rang-1 (`miss-star-paartreue.mjs`) — Breaking hat diese ehrlichere
Zahl noch nie gezogen.

**Aufwand.** Zwei PRs: (1) Familien + `koennen`-Mix + Stufenabzug im Motor, Rezept-Refit,
Messung (2–3 Tage inkl. B0); (2) Anzeige: Gerät nach Familie eingefärbt, Ticker „hält die Zange
— 4. Anschlag" / „bricht am Brandeisen", eigene Töne je Familie (das erledigt Punkt 4 der offenen
Liste vom 13.09. gleich mit). Die drei Breakdance-`id`s (`powermove`, `footwork`, …) bleiben
Vertrag, wie am 13.09. festgelegt — die Familie hängt am Slot-Index, nicht an der `id`.

### B2 — Der Peiniger wirkt (M, mittel, Chris-Entscheidung)

**Was.** Der HP-Verlust des Ertragenden wird von der **Wucht des Peinigers** mitbestimmt,
gedeckelt: `schaden = (10 | 24) · (0,8 + 0,4·SPITZENMOMENT_Peiniger/100)`, also ±20 % um den
heutigen Wert bei SPITZENMOMENT 50. Kein zusätzlicher `rr()`, kein Eingriff in den Erfolgswurf des
Ertragenden — nur die Folge eines bereits gewürfelten Ausgangs skaliert.

**Warum.** Weil Chris' Satz zwei Beteiligte hat und die Mechanik heute nur einen. Ohne B2 ist
Breaking ein Solo-Ausdauertest mit Gegnerkulisse; mit B2 ist ein Kraftpaket als Peiniger
gefährlich, auch wenn es als Ertragender früh bricht — der klassische „Glaskanone"-Kämpfer, den
jedes K.o.-Teamformat kennt (Slap-Fighting: der harte Schläger mit schwachem Kinn).

**Warum es eine Chris-Entscheidung ist, keine Fable-Empfehlung.** Zwei Gründe, beide ehrlich:

1. **Fremde Hand.** Die Projektregel sagt „kein Zug durch fremde Hand vernichtet". B2 vernichtet
   keinen Zug (der Ertragende würfelt, sammelt, hält oder bricht — alles wie heute), aber er
   verkürzt die **Kette** des Ertragenden, also wie viele eigene Züge er noch sammelt. Das ist die
   weiche Form (wie Duelldruck bei Climbing: Balance, nie Sturz), aber in einer Kampfdisziplin
   ist sie spürbarer. Chris muss sagen, ob er das will — ich glaube ja, weil es sein eigenes Bild
   ist.
2. **Paarungsrauschen.** Was der Gegner tut, streut das Einzelspiel. Die Spannweite (0,250) darf
   nicht weiter wachsen. Deckel ±20 % ist deshalb der Startwert, nicht der Zielwert; wenn die
   Messung Spannweite > 0,30 zeigt, auf ±10 % oder ganz zurück („BEWUSST NICHT GESETZT, weil
   gemessen …", das Takeshi-Muster).

**Pp.** power (10) und will (28) über SPITZENMOMENT — beide haben heute Kanäle, will ist der
Matrix-Höchstwert, hier käme ein **Peiniger**-Kanal hinzu, den die Überlebensdauer nicht
verstärkt (er wirkt auf den anderen, nicht auf die eigene Kette). Das ist Pp-günstiger als ein
weiterer Ertragenden-Kanal. Trotzdem: messen, n=48, zwei Stämme (B0).

**Aufwand.** Eine Zeile Mechanik, ein Tag Messung. Anzeige: der HP-Balken aus Phase 3 bekommt je
Anschlag eine sichtbare Schadenszahl, groß beim harten Peiniger.

### B3 — „gibt auf" oder „gebrochen" (A, klein — und bewusst **nicht** als Mechanik)

**Was.** Chris: „bis einer aufgibt". Heute fällt jeder bei HP 0 gleich aus dem Ring. Vorschlag,
rein als Beschriftung des Ausscheidens: der Kämpfer mit hohem NERVEN/Wille wird **GEBROCHEN**
(er kämpft bis 0, der GEBROCHEN-Stempel aus Phase 4 bleibt), der mit niedrigem Wille **GIBT AUF**
(Handtuch, Kopf gesenkt, anderer Ton, Ticker „winkt ab"). Schwelle: ein Anzeige-Vergleich auf
`L.NERVEN` beim letzten Zug, keine Zahl im Motor.

**Warum nicht als Mechanik** (also: der Willensschwache scheidet schon bei 20 % HP aus)? Weil das
will (28) einen **dritten** Kanal gäbe — es sitzt schon in GRUNDLAGE, PUBLIKUM, NERVEN,
SPITZENMOMENT — und die 23.09.-Kalibrierung genau diese Überzeichnung mit drei Schliffen
zurückgenommen hat. Die Aufgabe ist eine Geschichte, kein Hebel. A-Klasse, ein halber Tag.

### B4 — Verschnaufen zwischen den Bouts (M, klein)

**Was.** Zwischen zwei Bouts (nach jedem K.o., bevor der frische Herausforderer antritt) bekommt
der Überlebende eine kleine Regeneration: `hp += hpMax·0,04·(0,5 + AUSDAUER/200)`, also 2–4 %
seiner HP, deterministisch, kein `rr()`. Kein Heilen — „angeschlagen in die Kämpfe" (Chris) bleibt
—, aber ein Durchatmen in der Ringecke.

**Warum.** AUSDAUER (stamina 65 / det 35) wirkt heute nur als Ermüdungsdeckel ab dem 12. Zug —
ein Malus, nie ein Plus. Stamina hat 8 Matrixpunkte und braucht einen Ort, an dem man es *sieht*:
der Zähe, der nach dem dritten K.o. noch stehen kann. Jedes K.o.-Teamformat hat die Pause; im
Kendo-Kachinuki steht der Sieger zwischen den Kämpfen kurz.

**rho.** Hilft dem, der ohnehin überlebt (verlängert die Kette des Stärkeren) — tendenziell
rho-hebend, aber „reich wird reicher" ist bei Chris' Slot-6-Wunsch zweischneidig: ein zu großes
Verschnaufen macht den Überlebenden uneinholbar. Deshalb ≤ 4 %, und messen: Star-auf-Rang-1
und die Verteilung „wie oft gewinnt Slot 5/6 gegen einen Überlebenden". Aufwand: eine Zeile, ein
halber Tag Messung; Anzeige: Ringecke, Wasserflasche, Ton.

### B5 — Provokation: das WAGNIS wird ein echter Trade-off (M, klein–mittel)

**Was.** Der generische Bühnenblock rechnet WAGNIS seit dem 26.09. als Risiko (mehr Ertrag,
weniger Erfolgschance); Breaking führt bewusst die alte Fassung (nur Bonus), weil die Gauntlet-
Kaskade eine eigene Abnahme braucht. Vorschlag für genau diese Abnahme, thematisch: **der
Ertragende provoziert** — bei hohem WAGNIS (power 40 / dexterity 60) fordert er das nächste Gerät
der Leiter eine Stufe früher („gib mir die Säge") und bekommt dafür mehr Punkte, wenn er es hält.
Mit B1 ist das eine Stufe auf der Leiter, ohne B1 ein Ertrag/Risiko-Paar wie bei den sechs
Geschwistern.

**Warum.** Es ist die ausstehende Angleichung an den Bühnen-Standard, und es ist Folter-Vokabular
ohne Umweg: das Steingesicht, das den Peiniger reizt. Dexterity (2) sitzt heute nur in WAGNIS, am
stärksten verdünnt — genau richtig für ein Attribut, das die Matrix praktisch nicht will. Aufwand:
die `BUEHNE_WAGNIS_RISIKO/_ERTRAG`-Form aus `bauBuehne()` in `gauntletRunde()` nachziehen, Messung
(B0 vorausgesetzt).

### 3.7 Was ich für Breaking bewusst nicht vorschlage

- **Alles, was nach Tanz klingt** — Musik, Beat, Runden nach Takt, Jury mit Kriterien. Zweimal
  verworfen, zum dritten Mal nicht.
- **Ein neuer achter Kanal** für „Zufügen". B2 nutzt SPITZENMOMENT; ein eigener Peiniger-Sub-Skill
  wäre der Weg, den Climbing mit GESPUER gemessen verloren hat.
- **Aufgabe als Mechanik** (B3, Begründung dort).
- **Die Rollenrichtung umdrehen** (Ertragender = Aktiver, offen seit 13.09.): Einzeiler, Chris'
  Geschmack, keine Idee.
- **Mehr Runden/HP** — CLAUDE.md: mehr Ereignisse helfen fast nie; HP_MAX 400 hat die
  Verlässlichkeit schon geholt, was zu holen war.

---

## 4. Climbing

### 4.0 Ehrliche Einordnung: rund — und die nächste Runde sollte messen, nicht bauen

Climbing hat zwischen dem 22.09. und dem 26.09. ein Konzept (922 Zeilen), einen Gegencheck mit elf
Entscheidungen, eine Nulllinie und eine PR 2 bekommen, die praktisch alles davon umgesetzt hat:
Griffarten, Layouts, Exen, Abrutschen mit Höchstmarke, Balance, Duelldruck, Zeitlimit, Rast.
Das „mehrere Wege"-Muster ist hier am weitesten gediehen im ganzen Projekt (Primärweg je
Griffart, Kraftzug, Umsetzen — drei Wege, feste Reihenfolge). Chris' Satz vom 22.09. („das ist ja
n hindernislauf") ist beantwortet.

Was mir beim Lesen der Zahlen auffällt, ist kein Ideen-, sondern ein Messbefund: rho je Spiel ist
von 0,834 (vor PR 2) auf **0,814** gesunken, bei Spannweite 0,214 — die Latte des Konzepts war
„≥ 0,834 angestrebt". Das ist bestanden, aber der Puffer zur Schranke ist von 0,034 auf 0,014
geschrumpft, und die ehrlichere Abnahme (Star auf Rang 1, Paartreue mit Abstand,
`miss-star-paartreue.mjs`) ist für Climbing nach PR 2 nirgends dokumentiert. **Empfehlung: bevor
irgendjemand an Climbing weiterbaut, einmal Star-/Paartreue kaderfest und Pp in zwei Stämmen bei
n=48 ziehen.** Erst dann lohnt sich C1.

### C1 — Der Sprung zur Uhr (M, klein)

**Was.** Der Countdown ist seit PR 2/Phase 5 prominent im Bild — aber wenn er abläuft, passiert
nichts Aktives: wer nicht oben ist, wird nach Höchstmarke gewertet. Im echten Lead gibt es den
Moment, den jede Übertragung zeigt: **der letzte Zug, bevor die Zeit fällt** — ein Dyno zum Top,
alles oder nichts. Vorschlag: ein Kletterer, der den letzten Griff (0,89) hinter sich hat und bei
aktuellem Tempo das Top vor `zeitlimit` nicht mehr erreichen würde (deterministische Prüfung, kein
Wurf), bekommt **einen** ANTRITT-Wurf (dieselbe Form wie der Dyno-Griff): Erfolg → Top-out mit der
Zeit des Limits (also hinter allen regulären Tops, vor allen Nicht-Tops), Misserfolg → Abrutschen
zur dritten Exe (0,80). Weil die **Höchstmarke** zählt (Gegencheck 3.3), kostet der Fehlschlag in
der Wertung nichts — der Kletterer wird weiterhin nach „Griff 10+" gewertet.

**Warum.** Es ist die einzige Stelle, an der das Zeitlimit **erzählt** statt nur abschneidet, und
sie ist billig, weil A-2 mit Höchstmarke den Fehlschlag schon abfedert. Attribute: ANTRITT (power
38 / dexterity 32 / speed 30) — dexterity und power waren nach PR 2 die größten Löcher (−5,4 /
−6,0 Pp vor dem ENDTEMPO-Fix, `engine.js:31465–31467`); ein weiterer ANTRITT-Ort zieht sie hoch,
speed (schon +5,2) leider mit. Deshalb: ANTRITT-Wurf bleibt, aber die Sonde entscheidet, ob es hält.
Häufigkeit ist klein (nur Kletterer zwischen 0,89 und Top in den letzten Sekunden — bei Top-out
44,8 % vielleicht ein bis zwei je Rennen).

**Risiko.** Ein zusätzlicher `rr()` im Tick-Loop verschiebt die Wurfreihenfolge dieses Spiels
(Bahn-Vertrag: das ist erlaubt, PR 2 hat mit dem Umsetzen-Wurf dasselbe getan), also kaderfeste
Vorher/Nachher-Messung statt Bit-Vergleich. rho: ein Top mehr für den, der es fast geschafft hat,
ordnet ihn **vor** alle Nicht-Tops — das ist meist richtig (er war der Höchste). Aufwand: ein
halber Tag Motor, ein halber Tag Messung, Anzeige: Zeitlupe (Phase 4 hat das Muster), Ton.

### C2 — Man sieht, **warum** einer fällt (A, klein)

**Was.** Der Griff-Block weiß beim Abrutschen genau, was gescheitert ist: welche Griffart, ob der
Pump (`pusteAbzug`) oder die Balance (`balanceAbzug`) die Schwelle verschoben hat, ob Kraftzug und
Umsetzen vorher versucht wurden. Im Bild ist heute jeder Sturz derselbe Sturz. Vorschlag: drei
Sturzbilder plus Ticker, rein aus vorhandenen Werten:

| Ursache (gelesen) | Bild | Ticker |
|---|---|---|
| Reserve niedrig an Zange/Sloper (Pump dominiert) | die Hand öffnet sich, Arm gestreckt | „die Hand geht auf — Pumpe 91 %" |
| Balance niedrig (Kopf) | zögert, tastet, dann Sturz (Pijpers 2005, „tastende Bewegungen") | „zögert an der Leiste — und fällt" |
| Griffart-Können schwach, Reserve/Balance ok | Fuß rutscht, kurzer Ruck | „der Fuß rutscht vom Sloper" |

Dazu: nach dem Sturz am Seil hängend kurz die Exe anleuchten, an der er hält. Rein lesend,
`viz`-Felder, bit-identisch abnehmbar. Ein halber Tag. Warum: die drei Ressourcen (Reserve,
Balance, Griffkönnen) sind heute nur als Ringe/Balken sichtbar — der Sturz ist der Moment, in dem
Chris ohne Stats verstehen sollte, welche davon gefehlt hat.

### 4.3 Was ich für Climbing bewusst nicht vorschlage

- **Störgriff G-1.** Chris' Veto, Gegencheck 6. Nicht meins.
- **Routenlesen/Onsight als Awareness-Kanal.** Naheliegend (awareness 8 liest unter Matrix), aber
  es wäre ein neunter Kanal — und der GESPUER-Versuch hat unter `mengeAusEignung` gemessen
  **schlechter** gemacht (41 → 47,7 Pp). Die Lehre steht im Code: bestehende Kanäle umschichten,
  nicht neue danebenstellen. Awareness sitzt in TECHNIK (33) und WENDIGKEIT (23); wenn es mehr
  braucht, dort.
- **Zuruf/Beta durch Teamkollegen** (Coach darf laut IFSC §5.5 B reden). Verlockend als
  Teamelement, aber „kein Helfer-Bonus für Teamkollegen" ist Präzedenz
  (`takeshi-animationen-hilfe-behinderung-recherche-06-09.md` 4.2), und der Rennplan-Zuruf
  „rasten/durchziehen" ist dieselbe Idee ohne Fremdwirkung — existiert schon.
- **Boulder-Finale, Speed-K.o., IFSC-Punkte** — alles im Gegencheck entschieden.

---

## 5. Reihenfolge, wenn Chris alles will

1. **B0** (Speicherleck) — ohne das ist keine Breaking-Zahl belastbar.
2. **B1 + B5** in einer Mechanik-PR (Familien, Stufenabzug, Provokation), **B2** als gemessener
   Schalter in derselben Runde — das ist die eine Runde, die eine Disziplin wirklich verändert.
3. **G1** (Mannschaftstafel) mit dem Tiebreak-Check — ein PR, gut abgegrenzt.
4. **Politur-PR** über alle drei, Klasse A: G2, G3, B3, C2 — rho-neutral, ein bis zwei Tage.
5. **Climbing-Messrunde** (Star/Paartreue, Pp n=48 zwei Stämme), danach entscheiden, ob C1.
6. **G4** jederzeit als Einzeiler mit Korridor-Sonde.

Nicht in dieser Liste: G5 (nur auf Chris' Wunsch), alles unter „bewusst nicht".

---

## Quellen (alle gelesen)

- `CLAUDE.md` (Abnahmen, Matrixsperre, Breaking-Klarstellung, Mehrwege-Leitlinie)
- `docs/design/stand-aller-disziplinen.md` (Zwölfter Nachtrag 26.09., Abschnitt 1, 5b)
- Gewichtheben: `gewichtheben-gameplay-fertig.md` (03.09.), `gewichtheben-duell-reihenfolge-plan-06-09.md`,
  `gewichtheben-risiko-versuch-recherche-06-09.md`, `gewichtheben-spannung-recherche-13-09.md`,
  `gewichtheben-pp-regression-befund-27-09.md`; `engine.js` `BUEHNE_ART.gewichtheben` (:13759),
  `HEBEN_ROLLEN` (:15137), `baueHebenDuelle()`/`hebeUebung()` (:15314 ff.)
- Breaking: `breaking-folter-survival-visuelle-identitaet-recherche-08-09.md`,
  `breaking-kalibrierung-10-09.md`, `breaking-folter-zweikampf-praesentation-13-09.md`;
  `engine.js` `BUEHNE_ART.breaking` (:13913–14049), `GAUNTLET_*` (:16305–16333),
  `gauntletRunde()`/`baueGauntlet()` (:16346–16420)
- Climbing: `climbing-neukonzept-22-09.md`, `climbing-opus-gegencheck-24-09.md`,
  `climbing-nulllinie-24-09.md`; `engine.js` `BAHN_ART.climbing` (:31279–31487)
- Matrix: `lib/player-generator/official-discipline-weights.ts` (Spalten gewichtheben/breaking/climbing)
- Mehrwege-Muster: `i-spy-schatzsuche-konzept-21-09.md` Abschnitt 1.6 (Primärweg schlägt Nebenweg)
- Git: `origin/main` bis `24a8e1e1` (Broadcast-Optik Phasen 3–5 für Heben/Breaking/Climbing);
  `origin/bug-reports` — letzte Meldung 25.08., keine zu diesen drei Disziplinen
