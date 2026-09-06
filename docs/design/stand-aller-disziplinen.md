# Der Stand aller zwanzig Disziplinen

**Dritter Nachtrag 06.09. — komplette Neumessung, alle zwanzig Zeilen.** Die beiden Nachtraege
vom 05.09. hatten je eine Disziplin (Basketball, Spurt) einzeln nachgezogen und den Rest des
Dokuments unangetastet gelassen. Das war genau die Luecke, vor der `docs/pm-briefings/
pm-gesamtstand-2026-09-06.md` warnt: **vier Zeilen liefen seither an drei Tagen echter
Umsetzung vorbei** — Staffel (0,681 → **0,915**), Takeshi's Castle (0,697 → **0,886**), Spurt
(0,857 → **0,871**, PR #801 „Rezept-Paket B (feste Stationsfolge) + U3-Optik", 05.09., **nach**
dem Stand, den der Zweite Nachtrag unten noch trug) und Football (0,468 → **0,516**, PR #803
„eigene Spiel-Eignung im Motor statt Matrixaenderung", 05.09., **nach** dem Stand, den
`football-review-bugfixes.md` und dieses Dokument zuletzt trugen). Zusaetzlich haben sich, ohne
dass eine dieser drei etwas an ihrer Mechanik geaendert hat, auch die drei Arena-Zahlen
messbar bewegt (Battlefield 0,325 → 0,387, TDM 0,113 → 0,253, Mini-DM 0,269 → 0,094) — nach der
Faustregel dieses Dokuments (Abschnitt 2b) ist das bei einer Kader-Spannweite groesser als der
eigene Median **Kaderrauschen, kein Befund** (s. PM-Briefing Abschnitt 1a).

Alle zwanzig Zeilen unten sind heute (06.09.) frisch gemessen mit
`node scripts/miss-alle-disziplinen.mjs 24` (kaderfest, `data/generated/kaderfamilie-live-save.json`)
und `node scripts/baue-rangtreue-basislinie.mjs 24` — dieselbe Basislinie wurde damit auch
neu eingecheckt, sodass `scripts/pruefe-rangtreue-schranke.mjs` wieder gegen den echten
aktuellen Stand prueft, nicht mehr gegen den 04.09.-Stand (s. Abschnitt 2b). Jede Zahl unten
ersetzt die aelteren Nachtraege vollstaendig — sie sind unten nur noch als Historie stehen
gelassen, nicht mehr als aktueller Stand zu lesen.

**Nachtrag 05.09.:** Basketballs Zeile (Abschnitt 1) und der Produktions-Abschnitt (Abschnitt 4,
„Scoring und Produktion") sind auf den Stand nach K3 und der Hockey-Produktivierung
nachgezogen — der Rest dieses Dokuments (Stand 03.09.) gilt unveraendert weiter, da keine
andere Disziplin seither an ihrer Mechanik etwas geaendert hat.

**Zweiter Nachtrag 05.09.:** Spurts Zeile (Abschnitt 1 und 4) ist auf den Stand nach der
Umsetzung von `docs/design/spurt-modellierung-recherche-05-09.md` (Prototyp P6) nachgezogen —
Spurt ist jetzt ein Hindernislauf mit Zeitpreis je Hindernis statt eines Ermuedungssprints mit
Huerden als Dekoration, rho 0,652 → 0,857 (kaderfest, n=24). `node scripts/miss-alle-disziplinen.mjs
24` bestaetigt alle uebrigen 19 Zeilen bit-identisch zum Stand davor.

Stand 03.09.2026 (zweite grosse Revision; vorherige Fassung 02.09.2026). Gemessen mit
`node scripts/miss-alle-disziplinen.mjs 24` — 24 Spiele je Kader-Variante, **kaderfest** ueber
fuenf echte Team-Paarungen aus dem live-save-Abbild (s.
`docs/design/messgrundlage-kaderfest.md`), nicht mehr ueber einen einzigen, zufaellig
gezogenen Testkader.

Das ist die zweite grosse Revision dieses Dokuments, aus zwei unabhaengigen Gruenden zugleich
faellig: (1) die Messgrundlage selbst wurde am 03.09. ehrlicher gemacht (Median ueber fuenf
echte Kader statt einer Zahl), und (2) seit der letzten Fassung landeten vier grosse
Umsetzungsrunden — Tennis/Fechten-Chassiswechsel auf die Buehne, Footballs Live-Motor,
Gewichthebens Gameplay-Vervollstaendigung und ein zweiter Hockey-Rezeptversuch, der
explizit **verworfen** wurde. Jede Zahl unten wurde fuer diesen Bericht frisch gemessen, nicht
aus alten Berichten uebernommen.

Chris' Frage war: *„welche sind quasi spielreif?"* — und dann, praeziser: *„dass die diszis
INSGESAMT soweit fertig werden also was gameplay angeht, visuals, bewegungen, scoring usw"*.
Dieses Dokument beantwortet beides, getrennt nach vier Achsen.

---

## 1. Rangtreue — die Abnahmezahl

Die Schranke steht in CLAUDE.md und gilt fuer alle: **rho ueber 0,80 in EINEM Spiel**. Neu
seit dem 03.09.: **jede Zeile ist ein Median ueber fuenf echte Kader-Paarungen**, nicht mehr
eine Einzelmessung — mit einer Spannweite daneben, die zeigt, wie stark rho bei
**unveraenderter Mechanik** allein durch die Kaderziehung schwankt. Eine Bewegung, die kleiner
ist als die eigene Spannweite einer Disziplin, ist von Null nicht unterscheidbar (s. Abschnitt 2).

Die zweite Rho-Spalte (Saison) sagt daneben, ob die Mechanik ueberhaupt das Richtige belohnt.
Der Zusammenhang aus CLAUDE.md gilt unveraendert:

    rho(ein Spiel) = rho(Saison) x Wurzel(Verlaesslichkeit)

| Disziplin | Chassis | rho je Spiel (Median) | Spannweite | rho Saison (Median) | Spannweite | Abnahme |
|---|---|---:|---:|---:|---:|---|
| **Staffel** | **Bahn** | **0,915** | 0,089 | 0,951 | 0,093 | **bestanden** |
| Speed-Schach | Buehne | 0,889 | 0,060 | 0,979 | 0,021 | bestanden |
| Gewichtheben | Buehne | 0,887 | 0,224 | 0,944 | 0,261 | bestanden |
| **Takeshi's Castle** | **Bahn** | **0,886** | 0,073 | 0,951 | 0,126 | **bestanden** |
| Showcase | Buehne | 0,880 | 0,140 | 0,944 | 0,063 | bestanden |
| Spurt | Bahn | 0,871 | 0,236 | 0,905 | 0,190 | bestanden |
| Time-Trial | Bahn | 0,867 | 0,050 | 0,909 | 0,056 | bestanden |
| Wettessen | Buehne | 0,844 | 0,233 | 0,916 | 0,126 | bestanden |
| Fechten | Buehne | 0,840 | 0,230 | 0,874 | 0,252 | bestanden |
| Tennis | Buehne | 0,814 | 0,176 | 0,839 | 0,294 | bestanden |
| Breaking | Buehne | 0,801 | 0,114 | 0,874 | 0,119 | bestanden |
| Climbing | Bahn | 0,790 | 0,192 | 0,851 | 0,308 | knapp |
| Basketball | Feldspiel | 0,772 | 0,088 | 0,923 | 0,231 | knapp |
| Eiskunstlauf | Buehne | 0,757 | 0,125 | 0,958 | 0,091 | knapp |
| I-Spy | Buehne | 0,692 | 0,384 | 0,727 | 0,441 | durchgefallen |
| Hockey (alle 12, inkl. Torwart) | Feldspiel | 0,669 | 0,181 | 0,832 | 0,259 | durchgefallen |
| ↳ Hockey, nur Feldspieler | Feldspiel | 0,719 | 0,182 | 0,818 | 0,259 | knapp |
| **Football** | **Feldspiel** | **0,516** | 0,172 | **0,811** | 0,168 | durchgefallen |
| Battlefield | Arena | 0,387 | 0,938 | 0,595 | 1,095 | durchgefallen |
| TDM | Arena | 0,253 | 0,328 | 0,217 | 0,308 | durchgefallen |
| Mini-DM | Arena | 0,094 | 0,697 | 0,071 | 0,786 | durchgefallen |

**Elf bestehen, drei sind knapp, sechs fallen durch** (Stand nach der kompletten Neumessung vom
06.09., s. Nachtrag oben; zuvor in diesem Dokument neun/drei/acht — der Unterschied ist fast
vollstaendig Dokumentationsrueckstand, nicht neue Arbeit seit gestern: Staffel und Takeshi's
Castle waren schon vor dieser Neumessung bestanden, nur hier noch nicht nachgezogen; die
Zwoelferzahlen der zwanzig echten Disziplinen; Bucketing: bestanden ab 0,80, knapp ab 0,70,
sonst durchgefallen — `scripts/miss-alle-disziplinen.mjs`). Die eingerueckte Hockey-Zeile ist
kein einundzwanzigster Eintrag, sondern dieselben Spiele derselben Disziplin ohne die beiden
Torhueter (s. Abschnitt 1a) — sie zaehlt nicht mit in diese Bilanz, ist aber die ehrlichere
Frage fuer „belohnt Hockeys Mechanik das Richtige".

### 1a. Hockey: zwei Zahlen, nicht eine — und welche Frage jede beantwortet

Seit dieser Runde (`docs/design/hockey-zufriedenstellend.md`,
`docs/design/hockey-naechster-hebel-recherche-fable.md` Abschnitt 1.1) misst
`scripts/miss-alle-disziplinen.mjs` Hockey automatisch zweimal: einmal ueber alle zwoelf
Gefeldeten (die Zeile, gegen die auch `scripts/pruefe-rangtreue-schranke.mjs` als CI-Gate
misst — **bewusst nicht umgestellt**, weil ein echtes Chris-Spiel tatsaechlich zwei Torhueter
mitfeldet und die Schranke genau DAS Spiel absichern soll), und einmal ohne die beiden
Torhueter. `feldspielProbe`/`disziplinProbe` markieren dafuer jeden Torwart (`torwart:true`);
`scripts/lib/rangtreue-messung.mjs` erkennt das automatisch und liefert die zweite Zeile nur,
wenn eine Disziplin ueberhaupt eine Torwart-Rolle hat (heute nur Hockey).

**Warum zwei Zahlen ehrlicher sind als eine.** Ein Torwart-Wert schwankt in EINEM Spiel um
±3,4 Tore rein binomial (40 Schuesse bei ~9 % Torquote) — mehr, als der ganze reale
Faehigkeitsunterschied zwischen dem besten und dem schlechtesten gefeldeten Torwart ausmacht
(1,35 Tore). Seine Eignung ist zudem die Feldspieler-Matrix (power/health), nicht sein
PARADE-Wert (Korrelation nur 0,46) — zwei Zeilen in einer Zwoelfer-Rangliste, die strukturell
Rauschen statt Faehigkeit tragen. Die Zwoelferzahl ist deshalb die **richtige Zahl fuers
CI-Gate** (sie misst das reale Spiel, Torwarte inklusive), aber die **falsche Zahl fuer die
Frage „funktioniert die Feldspieler-Mechanik"** — dafuer ist die Feldspieler-Zahl gemeint, und
sie ist es, die im Fazit dieses Dokuments (Abschnitt 5, Punkt 3) und im eigenen Bericht
zaehlt. `scripts/miss-rangtreue-nach-rolle.mjs` bleibt daneben fuer die Frage bestehen, WIE
gut die Torwart-Wertformel selbst ist (PARADE gegen GSAA ueber die Saison, gemessen 0,39 —
ehrlich schwach, aber ein eigener Befund mit eigener Sonde, kein Grund, ihn in die
Feldspieler-Rangtreue mit hineinzurechnen).

### Was hier wirklich Code ist und was nur die neue Messmethode zeigt

Nicht jede Bewegung gegenueber der 02.09.-Fassung ist eine echte Aenderung an der Mechanik.
**Vier Disziplinen bewegten sich, weil an ihrem Code tatsaechlich etwas geaendert wurde:**

| Disziplin | vorher (Chassis) | vorher (rho je Spiel/Saison) | jetzt (Chassis) | jetzt (rho je Spiel/Saison) | Bericht |
|---|---|---:|---|---:|---|
| Tennis | Feldspiel | 0,505 / 0,853 | **Buehne** | **0,814 / 0,839** | `tennis-fechten-buehne-umsetzung.md` |
| Fechten | Arena | 0,153 / 0,378 | **Buehne** | **0,840 / 0,874** | `tennis-fechten-buehne-umsetzung.md` |
| Gewichtheben | Buehne | 0,720 / 0,860 | Buehne | **0,887 / 0,944** | `gewichtheben-zufriedenstellend.md` |
| Football | Feldspiel (Vorab-Pfad) | 0,345 / 0,699 | Feldspiel (**Live-Motor**) | **0,516 / 0,811** | `football-review-bugfixes.md`, PR #803 |

Tennis und Fechten sind der groesste Sprung, den dieses Dokument je in einer Runde gesehen
hat: beide wechselten das Chassis komplett (nicht nur ein Rezept) und sprangen von
„durchgefallen, mit deutlichem Abstand" auf „bestanden, mit komfortablem Puffer". Football
ist ein anderer Fall: ein strukturell notwendiger Schritt (echter Live-Motor mit Downs, Line
of Scrimmage, Formationen statt 48 kontextloser Duelle) liess die Kopfzahl beim Umstieg
zunaechst **sinken** (0,345 → 0,305), weil das neue Rezept beim Start reine, ungemessene
Platzhalter trug. Das ist inzwischen **nicht mehr der Stand**: eine eigene Rezeptkalibrierung
gegen echte NFL-2024-Quoten (`football-rezept-kalibrierung.md`, 04.09.) hat das Rezept
gemessen und gefittet und die Kopfzahl auf 0,460 gehoben; eine anschliessende Down-Verdrahtung
in vier bis dahin toten Entscheidungsfunktionen (`football-review-bugfixes.md`, ebenfalls
04.09.) hat sie auf 0,468 bewegt. **Seither (PR #803, 05.09.) bekam Football einen eigenen
`spielEignung`-Block statt weiterhin ueber `official-discipline-weights.ts` zu laufen — Chris'
Vorgabe, die Matrix selbst nicht anzufassen, blieb dabei unangetastet (Diff dagegen leer,
verifiziert im Commit) — und die Kopfzahl bewegte sich dadurch auf **0,516** (Spannweite
0,383 → 0,172, Saisonzahl 0,671 → 0,811).** Diese letzte Bewegung ist grosser als die vorherige
Kader-Spannweite und damit nach der eigenen Faustregel real (s. Abschnitt 2). Football bleibt
klar unter der 0,80-Schranke (s. Abschnitt 5), ist aber kein Platzhalter-Rezept mehr, und die
naechste Bewegung kam am Ende doch nicht aus einer weiteren Rezeptrunde, sondern aus einem
eigenen Eignungspfad neben der gesperrten Matrix.

**Alle uebrigen sechzehn Zeilen bewegten sich ausschliesslich, weil die Messmethode selbst sich
geaendert hat** — an ihrem Motor-Code wurde nichts angefasst. Die 02.09.-Fassung mass jede
Disziplin einmal, gegen einen einzigen, zufaellig gueltigen Testkader (Vigilante
Wranglers/Armageddon Aftermath). Heute ist jede Zahl ein Median ueber fuenf echte
Team-Paarungen, und `messgrundlage-kaderfest.md` hat bereits nachgewiesen, dass dieser Median
fuer die meisten Disziplinen **niedriger** liegt als die alte Einzelziehung — nicht weil etwas
schlechter wurde, sondern weil der alte Wert selbst nur eine von vielen moeglichen Ziehungen
war. Sichtbar z. B. bei Climbing (0,846 → 0,790, bestanden → knapp), Takeshi's Castle (0,842 →
0,697, bestanden → durchgefallen) oder I-Spy (0,776 → 0,692, knapp → durchgefallen) — keine
dieser drei Disziplinen hat seit dem 02.09. eine einzige geaenderte Zeile Motor-Code. Showcase
ist die Ausnahme in die andere Richtung (0,784 → 0,880, knapp → bestanden) — auch das reines
Kaderrauschen, kein Fortschritt.

**Das ist die eigentliche Lehre der kaderfesten Methode:** ein Grossteil der frueheren
Bucket-Wechsel in diesem Dokument (bestanden/knapp/durchgefallen) war nie ein belastbarer
Befund ueber die Mechanik, sondern Kaderrauschen, das wie ein Befund aussah.

### Was die zwei Spalten zusammen sagen

Wo die Saisonzahl hoch und die Einzelspielzahl niedrig ist, belohnt die Mechanik das Richtige,
aber zu laut — ein **Verlaesslichkeitsproblem**, das sich ueber Ereignisdichte loest, nicht
ueber Rezepte. Hockey (Feldspieler: 0,719 gegen 0,818; alle 12: 0,669 gegen 0,832, s. Abschnitt
1a) und Battlefield (0,387 gegen 0,595) stehen so da.
Football ruecke naeher an dieses Muster heran, seit der eigene `spielEignung`-Block (PR #803)
sowohl die Einzelspiel- als auch die Saisonzahl deutlich angehoben hat: **0,516/0,811**, statt
zuvor **beider** Zahlen kaderfest niedrig (0,468/0,671). Die Luecke zur 0,80-Schranke bleibt
in der Saisonzahl klein (0,811, ueber der Schranke) und in der Einzelspielzahl gross (0,516) —
das ist naeher am Verlaesslichkeitsmuster (Mechanik belohnt das Richtige, aber zu laut) als am
frueheren Befund einer echten Validitaetsluecke, aber bei nur einer Messrunde seit PR #803
noch nicht abschliessend eingeordnet.

Wo beide Zahlen niedrig sind, belohnt die Mechanik das Falsche — ein **Validitaetsproblem**. Die
verbleibenden drei Arena-Disziplinen (TDM, Mini-DM, Battlefield) stehen so da: 0,07 bis 0,60 in
der Saison (06.09.; die genauen Zahlen bewegen sich bei unveraenderter Mechanik messbar, s.
Abschnitt 5 Punkt 1 — Kaderrauschen, kein Befund).

---

## 2. Warum die alten Zahlen nicht mehr gelten — zwei unabhaengige Gruende

### 2a) Der Formkarten-Bug (bereits in der 02.09.-Fassung behoben)

`zieheFormkarten` nahm `z % n` von einem linearen Kongruenzgenerator, also die UNTERSTEN Bits.
Deren Periode ist bei vier Formwerten genau vier. Nachgerechnet ergaben **24 verschiedene
Saaten genau VIER verschiedene Kartensaetze**, 1000 Saaten ebenfalls vier.

Jede Rangtreue, jede Pp-Zahl und jeder Korridor dieses Projekts lief damit auf vier Spielen,
die sich sechsmal wiederholten. Seit dem Umstieg auf die oberen Bits sind es 24 aus 24. Dieser
Fund gilt weiterhin, aendert seit dem 02.09. aber nichts mehr — er ist Geschichte, keine offene
Baustelle.

### 2b) Der Einzelkader-Bug (neu behoben, 03.09.)

Selbst nach dem Formkarten-Fix mass `disziplinProbe` **immer** dieselben 17 Spieler in
derselben Paarung. Speist man andere Aufteilungen derselben Spieler ein, bewegt sich rho bei
**unveraenderter Mechanik** um bis zu 0,73 (TDM) — s. `messgrundlage-kaderfest.md` Abschnitt 1
fuer die volle Vergleichstabelle. Jede „Verbesserung" oder „Verschlechterung", die eine
fruehere Runde an einer Nachkommastelle festmachte, konnte teilweise oder ganz Kader-Zufall
gewesen sein.

Seit dem 03.09. misst `scripts/miss-alle-disziplinen.mjs` deshalb **kaderfest**: Median und
Spannweite ueber fuenf echte Team-Paarungen aus dem live-save-Abbild
(`data/generated/kaderfamilie-live-save.json`), mit derselben Formel eingebaut in eine
CI-Schranke (`scripts/pruefe-rangtreue-schranke.mjs`, Basislinie in
`data/generated/rangtreue-basislinie.json`). Details, Herleitung der
`schranke = max(0,05; 0,3×Spannweite)`-Formel und was sie bewusst nicht faengt: siehe
`docs/design/messgrundlage-kaderfest.md`.

**Nebenbefund vom 03.09., seit 06.09. behoben:** die eingecheckte `rangtreue-basislinie.json`
war zwischenzeitlich mehrfach hinter dem Motor-Stand zurueckgeblieben — zuletzt auf dem 04.09.,
also **vor** den Staffel-, Takeshi's-Castle-, Spurt- und Football-Runden vom 05./06.09. Die CI
haette Staffel von 0,915 auf ihr altes 0,681 zurueckfallen lassen koennen, ohne rot zu werden
(`docs/pm-briefings/pm-gesamtstand-2026-09-06.md` Abschnitt 3, „Basislinie schuetzt nichts").
`node scripts/baue-rangtreue-basislinie.mjs 24` ist am 06.09. neu gelaufen und hat
`rangtreue-basislinie.json` auf den in Abschnitt 1 dieses Dokuments gezeigten Stand gebracht;
`scripts/pruefe-rangtreue-schranke.mjs` laeuft danach bit-identisch grün (alle zwanzig Zeilen
±0,000 gegen die neue Basislinie). Das ist jetzt Teil des normalen Pflegezyklus, nicht mehr
eine offene Luecke: **wer eine Zeile in Abschnitt 1 bewegt, zieht die Basislinie im selben PR
nach**, sonst faellt das Dokument wieder hinter die CI-Schranke zurueck wie hier geschehen.

---

## 3. Dieselbe Luecke, vier Mal (historisch — behoben, s. Abschnitt 5a)

`p.d` haelt genau ZWEI Disziplinwerte vorberechnet: `tdm` und `spurt`. Alle vier Chassis lasen
die Eignung als `p.d[disziplin] || 0` — fuer die uebrigen achtzehn Disziplinen fiel der
Basiswert damit auf 0, und `eig` bestand nur aus Slot-, Trait- und Formzuschlag.

| Chassis | Funktion | behoben |
|---|---|---|
| Feldspiel | `bauFeldspiel` | 25.08. (Chris' Fund) |
| Buehne | `bauBuehne` | 02.09. |
| Bahn | `bauSpurt` | 02.09. |
| Arena | `baueEinheit` | 02.09. |

In der Arena wog sie am schwersten, weil `eigWert` dort ueber `aufEignung()` direkt in die
KAMPFWERTE geht und nicht nur in die Anzeige. Fechtens fruehere 0,153 (Arena) trugen diesen
Fix bereits, waren aber trotzdem durchgefallen — der Grund war, wie sich erst am 03.09. zeigte,
nicht mehr diese Luecke, sondern das Arena-Chassis selbst (s. Abschnitt 5). Dieser Abschnitt
bleibt als historischer Befund stehen; es gibt keine offene fuenfte Fundstelle.

---

## 4. Die anderen drei Achsen

### Visuals

Es gibt weiterhin **vier Bilder fuer zwanzig Disziplinen**, eines je Chassis: `bodenFeldspiel`,
`bodenBuehne`, `bodenArena`, `bodenSpurt`. Eigene Arenen haben weiterhin genau zwei Disziplinen
— Basketball (Court) und Eishockey (Eisflaeche mit Linien, Torraeumen, Toren). Von den
uebrigen achtzehn teilen sich siebzehn das Bild ihres Chassis, mit kleinen Abweichungen wie
Bodenfarbe (`BA().boden`), Hindernissen und Steigung. **Gewichtheben ist die Ausnahme:**
`zeichneBuehne()` verzweigt fuer `heben:true` in eine eigene `zeichneHeben()`
(`public/mockups/battle-mode.engine.js:10629/10716`) — statt der zwoelf Teilnehmer in zwei
Reihen, die alle anderen Buehnen-Disziplinen zeigen, rendert sie nur das aktive Duell (zwei
Heber mittig, Hantel mit Last, Duellstand gross, wartende Paare klein am Rand). Das ist die
"eigenes Buehnenbild"-Zeile in Abschnitt 5b: kein eigenes Chassis wie bei Basketball/Eishockey
(der Boden bleibt `bodenBuehne`), aber eine eigene, nicht geteilte Szene innerhalb des
Buehnen-Chassis (Bericht: `gewichtheben-buehnenbild-fortschritt.md` Abschnitt S2).

**Neu seit dem 03.09.: Tennis und Fechten haben das geteilte Bild gewechselt, nicht nur das
Rezept.** Tennis zeigte vorher das Feldspiel-Bild, Fechten das Arena-Bild (Sandgrund,
Steinring, Fackeln) — beide zeigen jetzt das Buehnen-Bild (Podest, Scheinwerfer), zusammen mit
Speed-Schach, Showcase, Wettessen, Eiskunstlauf, Breaking und I-Spy. Das ist konsistent mit
ihrer neuen Mechanik (beide laufen jetzt als abstraktes Duell ueber Runden, kein Feld/keine
Arena mehr), aendert aber nichts an der grundsaetzlichen Lage: 18 von 20 Disziplinen teilen
sich vier Bilder, keine hat eine eigene.

Football zeichnet innerhalb seines weiterhin geteilten Feldspiel-Bildes seit der
Live-Migration Endzonen, eine Line of Scrimmage und zwei sichtbar getrennte Formationen (Snap-
Phase) — eine der auffaelligeren Binnendifferenzierungen unter den 18 Bild-Teilern, nach
eigenem Bericht aber noch „enger/ueberlappender als ein sauberes Formations-Diagramm", kein
fertiges Bild.

### Bewegungen

Die Sprites koennen laufen, angreifen, stuerzen, taumeln und den Schlaeger fuehren. Neben
Eishockey (Bodycheck, Torwartbogen, Schussphasen, Bandenzweikampf) hat jetzt auch **Football**
disziplineigene Bewegungsmuster: eine Snap-Standphase (Formation → Zug → Ergebnis) und fuenf
visuell unterschiedene Spielzug-Typen (Lauf, Screen, kurzer/mittlerer Pass, tiefer Pass,
Field-Goal/Punt) mit je eigener Ballflugbahn. Nach eigenem Bericht funktioniert das strukturell,
ist aber noch nicht fein poliert (Formationen standen beim ersten Sichttest zu dicht). Die
uebrigen siebzehn Disziplinen — inklusive der frisch migrierten Tennis/Fechten — haben weiterhin
keine eigenen Bewegungen ueber das generische Chassis-Repertoire hinaus.

**Bekannte, benannte Luecke (triagiert, nicht gebaut):** Fuer die Arena existiert **keinerlei
Audio-Infrastruktur** ausserhalb Basketballs — der sichtbare Ton-Regler steuert ausschliesslich
`bkVolume`/`bkMuted`, `public/sound/` enthaelt nur einen `basketball/`-Ordner, und die
Basketball-Rollenprofile (`lib/lineups/matchday-slot-roles.ts`) sind nicht an das eigene
Slot-/Rollensystem der Arena (`SLOTVON`, `renderKader`) angebunden, obwohl beide dieselben
Rollen-IDs kennen. Beides sind Chris' letzte zwei In-Game-Meldungen ueberhaupt (25.08.),
beide betreffen die Arena; beide sind laut Triage Feature-Luecken, kein Ein-Zeilen-Fix
(`data/bug-reports/triage/bug-2026-08-25T13-50-21-597Z-rtyqa9.md`).

### Scoring und Produktion

**Stand 04./05.09., dritte Revision dieses Abschnitts:** drei Disziplinen laufen inzwischen
ueber die Arena (`ARENA_RESOLVED_DISCIPLINE_IDS = {"basketball", "gewichtheben", "hockey"}`),
jede mit echter Boxscore-an-PPs-Berechnung (Impact-Kurve, `battle-mode-arena-team-points.ts`)
statt der alten PPS-Rang-Formel:

- **Basketball** — seit laenger produktiviert, seither zwei weitere Runden: PR #755
  (Perzentilrang → absolute Impact-Kurve) und **K3** (04.09., `basketball-k3.md`): Feldkorb-
  Punkte werden jetzt zur Haelfte als `technik`-Erwartungswert statt als binaeres Treffer/Fehl
  gebucht (dasselbe Muster wie Hockeys K3, s.u.) — rho je Spiel **0,757 → 0,772** (n=24),
  Saisonzahl unveraendert (0,923), wie von einer erwartungswertneutralen Formel vorhergesagt.
- **Gewichtheben** — produktiviert (`gewichtheben-produktivierung.md`, S6): eigene
  Buehnen-Duell-Referenz, `barbell.tsx` bewusst noch kosmetisch belassen (keine Blockade fuer
  den Live-Betrieb).
- **Hockey** — NEU seit dieser Fassung produktiviert (`hockey-produktivierung.md`, PR #780):
  kein neues Chassis noetig (nutzt wie Basketball das Feldspiel-Chassis), aber eine **eigene
  Torwart-Referenz** war empirisch noetig — Feldspieler- und Torwart-Median liegen je
  Feldgroesse unterschiedlich weit auseinander und wechseln sogar die Richtung (n=3: Feld weit
  ueber Torwart; n=6: Feld unter Torwart). Chris hat Hockeys Rangtreue (0,669 alle 12 / 0,719
  nur Feldspieler, s. Abschnitt 1a) fuer den Live-Betrieb ausdruecklich akzeptiert — kein
  weiterer Rangtreue-Anlauf vorgesehen (Aufgabe #20 entsprechend geschlossen).

**Die anderen siebzehn** — einschliesslich Tennis, Fechten und Football trotz ihrer grossen
Mechanik-Runden — laufen weiterhin ausschliesslich im Mockup, abgerechnet ueber den alten
PPS-Rang-Pfad (`legacy-matchday-resolve-engine.ts`). Neun davon (Speed-Schach, Showcase,
Time-Trial, Wettessen, Fechten, Tennis, Breaking, Climbing, Eiskunstlauf) haben die
Rangtreue-Schranke bereits bestanden oder liegen knapp darunter — bei ihnen fehlt NUR die
Produktivierung (Konfigurationseintrag + eigene PPS-Referenz ziehen), keine eigene Optik oder
Bewegung: Hockeys Beispiel zeigt, dass beides unabhaengig voneinander geht (Hockeys Eisflaeche
brauchte fuer die Live-Schaltung keine einzige Aenderung). Eine Live-Motor-Befoerderung wie bei
Basketball/Hockey waere fuer sie trotzdem ein eigener, noch nicht angefasster Auftrag.

---

## 5. Was als naechstes den groessten Hebel hat

Zwei der bisher groessten Hebel dieses Dokuments sind seit der letzten Fassung **abgearbeitet**
und fallen aus dieser Liste heraus: die Eignungsluecke (Abschnitt 3, behoben in allen vier
Chassis) und der Tennis/Fechten-Chassis-Fehlgriff (Abschnitt 1, beide jetzt bestanden). Was
bleibt bzw. neu hinzukommt:

1. **Die Arena-Zielwahl — weiterhin der groesste ungehobene Hebel, jetzt mit einem konkreten
   Vorschlag statt nur einer Diagnose.** TDM (0,253), Mini-DM (0,094) und Battlefield (0,387)
   bleiben alle deutlich unter der Schranke, mit derselben Ursache wie in jeder frueheren
   Fassung: die Zielwahl ist Geometrie, nicht Bedrohung (264 von 288 Kaempfern zielen auf den
   Naechsten). Fables Recherche vom 03.09.
   (`docs/design/arena-mini-dm-tdm-battlefield-rollout-plan.md`) bestaetigt das unabhaengig neu
   und liefert zusaetzlich einen konkreten, noch nicht gebauten Vorschlag: Zielwahl nach
   `u.zielP==="bedrohung"` (existiert bereits als Spieler-Option, ist aber nicht KI-Standard)
   mit Hysterese als Standardverhalten. **Reine Recherche, kein Commit an der Engine** — der
   naechste Schritt ist Umsetzung, keine weitere Recherche. **Achtung bei der Abnahme
   einer kuenftigen Runde:** alle drei Arena-Zahlen haben sich zwischen dem 04.09. und dem
   06.09. spuerbar bewegt, ohne dass an ihrer Mechanik etwas geaendert wurde (TDM 0,113→0,253,
   Mini-DM 0,269→0,094, Battlefield 0,325→0,387) — bei einer Kader-Spannweite, die groesser
   ist als der eigene Median, ist das nach der projekteigenen Faustregel **Kaderrauschen**,
   kein Befund (`docs/pm-briefings/pm-gesamtstand-2026-09-06.md` Abschnitt 1a). Eine Arena-
   Runde braucht deshalb zuerst eine groessere Stichprobe (n ≥ 96–150), bevor sie ihren eigenen
   Erfolg ueberhaupt nachweisen kann.
2. **Football: die Rezeptkalibrierung ist inzwischen gelaufen, und ein eigener Eignungspfad
   neben der gesperrten Matrix hat den naechsten Sprung bereits gebracht.** Der Live-Motor
   selbst (Downs, Formationen, eigene Kurve) war beim Umstieg der richtige Unterbau, aber alle
   acht Sub-Skill-Gewichte und alle Wahrscheinlichkeitskonstanten waren zunaechst ungemessene
   Platzhalter, und die Kopfzahl bewegte sich deshalb kaderfest zunaechst RUECKWAERTS
   (0,345 → 0,305). Das ist **erledigt**: `football-rezept-kalibrierung.md` (04.09.) hat
   `skillMittel`/`steil`/`korrektur` gegen reale NFL-2024-Quoten gefittet (Completion-Quote
   65,3 %, Yards/Attempt 7,1) und den Football-Korridor (`scripts/miss-football-korridor.mjs`)
   gebaut; die Kopfzahl stand seither bei 0,460 (`football-zufriedenstellend.md` bestaetigt sie
   per Sicht-QA erneut). Eine anschliessende Down-Verdrahtung in vier bis dahin toten
   Entscheidungsfunktionen (`waehlePlayCall`/`waehleFormationOffense`/
   `waehleFormationDefense`/`waehleFootballTier`, `football-review-bugfixes.md`, ebenfalls
   04.09.) hat sie auf 0,468 bewegt. **Seither (PR #803, 05.09.) hat Football einen eigenen
   `spielEignung`-Block in `FELDSPIEL_ART.football` bekommen, statt weiter ausschliesslich ueber
   `official-discipline-weights.ts` zu laufen — genau der von der Kalibrierungsrunde selbst
   benannte naechste Kandidat, nur ohne die gesperrte Matrix anzufassen (Diff dagegen leer,
   verifiziert im Commit).** Die Kopfzahl bewegte sich dadurch auf **0,516** (Spannweite
   0,383 → 0,172, Saisonzahl 0,671 → 0,811) — eine Bewegung deutlich groesser als die vorherige
   Kader-Spannweite, also nach der eigenen Faustregel real. Football bleibt klar unter der
   0,80-Schranke, aber der naechste Hebel ist damit teilweise bereits gezogen; ob weiteres
   Feintuning an `spielEignung` selbst oder ein struktureller Schritt (z. B. Anzeige/KI-Kauf auf
   dieselbe Eignung umstellen, s. das Risiko in Abschnitt 3 des PM-Briefings) sinnvoller ist,
   ist eine offene Frage fuer die naechste Football-Runde.
3. **Hockey: der billige Hebel ist gezogen, der teure (Zoneneintritt) hat sich zweimal nicht
   nachweisbar gehalten — ein dritter struktureller Anlauf ist nicht mehr das naechste
   Sinnvolle.** Nach drei Kalibrierrunden (Torwart-Fix, sieben-Schritt-Liste, eigene
   Erfolgskurve, Sinkhorn-Fix: netto 0,617→0,647 einzelkader) wurde ein vierter Rezeptanlauf
   verworfen (`hockey-ueber-080-versuch2.md`), und ein struktureller Anlauf — Zoneneintritt als
   Zweikampf, der bei n=24 gewinnend aussah — kippte bei n=96 im Vorzeichen (RNG-Kaskade eines
   40-50x je Spiel gewuerfelten Ereignisses dominiert die Messung, `hockey-zoneneintritt-
   umsetzung.md`) und wurde deshalb ebenfalls **nicht committed**. Was diese Runde stattdessen
   umgesetzt hat, gemessen und gehalten (`hockey-zufriedenstellend.md`):
   - **Die Feldspieler-only-Messung ist jetzt Standard** (Abschnitt 1a) — Hockeys ehrlichere
     Zahl ist **0,719** Feldspieler (0,818 Saison), nicht 0,618 ueber alle zwoelf.
   - **K3 (Tore halb als xG buchen)**, aus derselben Recherche (Abschnitt 3.3 dort): jeder
     Schuss aufs Tor bucht seine kalibrierte Torwahrscheinlichkeit auf `u.xg`, `feldspielWert`
     zahlt `punkte·1,5+xg·1,5` statt `punkte·3`. KEIN neuer `rr()`-Aufruf, KEINE Verschiebung
     bestehender Wuerfe — reine Bilanzierung eines bereits berechneten Werts, deshalb ohne das
     RNG-Kaskade-Risiko, an dem der Zoneneintritt scheiterte. Gemessen (kaderfest, n=24 und
     n=48, dieselbe Kader-Familie): Feldspieler-rho je Spiel **0,651→0,719** (n=24) bzw.
     **0,666→0,714** (n=48) — eine Bewegung, die groesser ist als die eigene Kader-Spannweite
     (0,182–0,197), also nach der Projekt-eigenen Faustregel real. Torkorridor, Endstaende und
     Basketball bit-identisch (reine Wertformel-Aenderung, kein Mechanikeingriff).
   - **HK_TW_BASIS/HK_TW_REF nachgezogen** (Opus-Review `hockey-opus-review-nhl.md` Abschnitt 2,
     04.09., `hockey-torwart-konstanten-nachgezogen.md`): die beiden Torwart-Kalibrierungs-
     konstanten waren seit K3 und der Passqualitaets-/Abpraller-Kette nicht mehr nachgezogen
     worden — jeder Torwart startete dadurch 4,84 Wertpunkte unter dem Feldspieler-Schnitt,
     rein arithmetisch. Frisch gezogen (Kader-Familie, n=24): `HK_TW_BASIS` 7,16→**9,13**,
     `HK_TW_REF` 0,907→**0,871**. Wirkung ausschliesslich auf die alle-12-Zahl: **0,618→0,669**
     (Saison 0,748→0,832); die Feldspieler-only-Zahl bleibt **bit-identisch** (0,719/0,182) —
     der Isolationsnachweis, dass die Bewegung vollstaendig in den zwei Torwart-Zeilen sitzt.
     Basketball/Football/Gewichtheben ebenfalls bit-identisch gegengeprueft.
   Hockey steht damit bei **0,719 Feldspieler-rho, „knapp"** statt 0,80 — echt besser als vor
   dieser Runde, aber nicht am Ziel. CLAUDE.md dokumentiert bereits, dass mehr Ereignisdichte
   hier kaum hilft; der naechste strukturelle Hebel bliebe der Zoneneintritt oder der
   Netfront-Schirm aus derselben Recherche, aber beide brauchen — anders als K3 — entweder eine
   deutlich groessere Stichprobe (n≥150) oder einen Bauweg ohne neuen `rr()`-Wurf im
   Tick-Loop, um an dieser Projektgroesse ueberhaupt sauber messbar zu sein.
4. **Gewichtheben wartet auf eine Architekturentscheidung von Chris, nicht auf mehr
   Kalibrierung.** Die Gameplay-Runde vom 03.09. (`gewichtheben-gameplay-fertig.md`) ist eine
   echte, gemessene Verbesserung — Zocker-Archetyp fuehrt jetzt, Pp-Abweichung fast halbiert
   (47,6→23,1 bei n=48), rho 0,595→0,720 kaderfest (jeSeite 6) — und stoesst danach an eine
   strukturelle Grenze: `LAST` (die physische Zweikampf-Obergrenze) haengt deterministisch nur
   an power/health/determination, waehrend Charisma nur innerhalb eines
   wahrscheinlichkeitsbasierten Fensters wirken kann. Die offene Frage steht bewusst ungeloest
   im Bericht: **soll Selbstvertrauen (Charisma) auch die physische Hebe-Obergrenze selbst
   beruehren, nicht nur die Erfolgswahrscheinlichkeit darin?** Das ist eine Design-, keine
   Kalibrierfrage, und sie ist Chris' Entscheidung — bislang unbeantwortet.
5. **Die verbleibenden vier „Knapp"-Disziplinen** (Climbing, Basketball, Eiskunstlauf,
   Gewichtheben) brauchen weiterhin je eine Rezeptrunde nach Chris' Budget-Methode — aber jetzt
   gegen die ehrlichere kaderfeste Zahl, nicht gegen die alte Einzelkader-Zahl. Fuer Climbing und
   Eiskunstlauf ist das eine neue Erkenntnis dieser Runde: beide waren in der alten Messung noch
   „bestanden".

---

## 5a. Die Arena im Einzelnen — was gepruef ist und was noch offen

Aus Fables aelterem Bericht (`arena-duell-recherche-fable.md`, Wertformel-Runde) und der
frischen Recherche vom 03.09. (`arena-mini-dm-tdm-battlefield-rollout-plan.md`):

| Befund | Stand |
|---|---|
| Wertformel vergab 44 % fuer Getroffenwerden | **behoben** — `tank` gestrichen, `verh` auf 0,4 gesetzt, beides durchgemessen |
| Eignung war Slot plus Formkarte plus Trait | **behoben** — vierte Fundstelle derselben Luecke |
| Battlefield stellte Fuehrungsrollen faelschlich nach hinten (rho −0,49) | **behoben und nachgemessen** — Reihen-Fix vom 03.09., Saison-Validitaet 0,595 (kaderfest, 06.09.; stand zwischenzeitlich bei 0,619, die Bewegung dazwischen ist Kaderrauschen, s. Abschnitt 5 Punkt 1); die Zahl war frueher „nachzumessen", ist es nicht mehr |
| Zielwahl ist Geometrie statt Bedrohung | **weiterhin offen** — jetzt mit einem konkreten, ausgearbeiteten Vorschlag (K1, s. u.), aber ohne Commit an der Engine |
| Fechten gehoert nicht in die Arena | **behoben** — Fechten ist seit dem 03.09. eine Buehnen-Disziplin, taucht in dieser Tabelle nicht mehr auf |

### Die eine Entscheidung, die Chris gehoert

Der direkteste Weg, dem Staerkeren mehr Gelegenheiten zu geben, waere die **Schlagfrequenz**:
sie ist heute fuer alle identisch (`cdKuerzung` gibt konstant 0 zurueck, `abkling` teilt nur
durch die Ermuedung). Ein schneller, geschickter Kaempfer schlaegt also exakt so oft zu wie ein
langsamer, und genau deshalb korreliert die Zahl der Gelegenheiten nicht mit der Eignung,
waehrend der Schaden JE Gelegenheit es sehr wohl tut. Das ist aber KEINE Luecke, sondern eine
getroffene Entscheidung, inzwischen noch deutlicher belegt: der Kommentar an der Stelle zitiert
Chris woertlich — *„schau, dass Tempo nicht den Angriff beschleunigt — du musst die Mechaniken
wirklich von Eslabong uebernehmen, sonst funktioniert es nicht"* —, mit Verweis auf Eslabongs
eigene, tempounabhaengige Klassenkarten. Sie umzudrehen ist ein Eingriff in das Kampfgefuehl und
gehoert Chris, nicht der Automatik.

Die Alternative ohne diesen Eingriff ist Fables **K1**: Zielwahl nach Bedrohung statt nach
Naehe, mit Hysterese, damit niemand im Kreis laeuft — technisch ein Standardwechsel auf das
bereits existierende `zielP==="bedrohung"`-Overlay, kein Neubau. Dann bekommt der Starke nicht
mehr Schlaege, aber die Schlaege der anderen konzentrieren sich sinnvoller. Das ist der
naechste konkrete Schritt fuer alle drei verbleibenden Arena-Disziplinen — noch nicht
umgesetzt.

---

## 5b. Wie weit ist jede Disziplin? — die Prozentzahlen

Die Prozentzahlen sind meine Einschaetzung, keine Messung. Gewichtet ueber vier Achsen:
**Rangtreue 40 %** (die einzige gemessene), **eigene Mechanik 25 %**, **Bild und Bewegung
20 %**, **im echten Spielstand 15 %**. „Eigene Mechanik" heisst: hat die Disziplin Regeln, die
ueber das hinausgehen, was ihr Chassis fuer alle mitbringt.

| Disziplin | fertig | rho | Was steht |
|---|---:|---:|---|
| Basketball | 92 % | 0,772 | Live-Motor mit Zonen, Manndeckung und Spielzuegen · eigener Court · einzige Disziplin im echten Spielstand · **individuelle PPs jetzt aus dem echten Boxscore-Impact, nicht mehr aus dem alten PPS-Rang** (K3, 04.09.: Feldkorb-Punkte zur Haelfte als `technik`-Erwartungswert statt binaer, rho 0,757→0,772, s. Abschnitt 4) |
| Hockey | 71 % | 0,719 (Feldspieler) / 0,669 (alle 12) | Live-Motor mit Torwart, Bodychecks, Strafen und Ueberzahl · eigene Eisflaeche · Feldspieler-only-Messung jetzt Standard (Abschnitt 1a) · K3 (Tore halb als xG) gemessen umgesetzt, rho Feldspieler 0,651→0,719 · HK_TW_BASIS/HK_TW_REF nachgezogen (7,16/0,907→9,13/0,871), alle-12 dadurch 0,618→0,669, Feldspieler bit-identisch · ein struktureller Anlauf (Zoneneintritt) zweimal gebaut, beide Male bei groesserem n nicht haltbar, nicht committed — spuerbar besser als vor dieser Runde, aber nicht bei 0,80 · Chris hat die aktuelle Rangtreue fuer den Live-Betrieb ausdruecklich abgenommen (rangtreuer als echtes Eishockey, rho ≈ 0,40) · **produktiviert** (`docs/design/hockey-produktivierung.md`, PR #780, gemergt): `ARENA_RESOLVED_DISCIPLINE_IDS`, nutzt das bestehende Feldspiel-Chassis (kein neues), eigene Torwart-PPS-Referenz — im echten Spielstand, sobald ein Save Battle Mode nutzt |
| Fechten | 48 % | 0,840 | Auf der Buehne (vorher Arena, rho 0,153) · Rangtreue klar bestanden mit komfortablem Puffer · Rezept ein erster, unkalibrierter Entwurf · kein interaktiver Paar-Rechner (optional, nicht noetig fuer die Abnahme) · nicht im echten Spielstand |
| Tennis | 48 % | 0,814 | Auf der Buehne (vorher Feldspiel, rho 0,505) · Rangtreue bestanden · Rezept 1:1 aus dem alten Feldspiel-Rezept uebernommen, nicht neu kalibriert · nicht im echten Spielstand |
| Time-Trial | 55 % | 0,867 | Kurvenmodell mit Linie und Risiko · Rangtreue bestanden · Bild vom Chassis |
| Gewichtheben | 70 % | 0,887 | Reissen und Stossen, Duelle je Slot, Nullwertung, eigenes Buehnenbild · Architekturfrage entschieden (04.09.): Charisma beruehrt jetzt auch die physische Hebe-Obergrenze (`HEBEN_TAGESMAX_ANSAGE_K`), nicht nur die Erfolgschance — rho 0,720 -> 0,887, Pp 23,1 -> 17,3, Korridor haelt bei beiden Werten · Ein-Zeilen-Umkehr dokumentiert, falls Chris die physische Obergrenze lieber unangetastet haette · **produktiviert** (`docs/design/gewichtheben-produktivierung.md`, S6): `ARENA_RESOLVED_DISCIPLINE_IDS`, eigenes Buehnen-Duell-Motor-Chassis (`spieleBuehneHeben`), individuelle PPs aus echten Zweikampf-kg, Gesamt-kg-Tiebreak — im echten Spielstand, sobald ein Save Battle Mode nutzt |
| Climbing | 48 % | 0,790 | Steigung und Kraftbudget statt Antritt · kaderfest knapp unter der Schranke (vorher bestanden, reines Kaderrauschen) · Bild vom Chassis |
| Speed-Schach | 45 % | 0,889 | Duell-Variante der Buehne, Brett gegen Brett · beste Rangtreue im Feld · eigenes Buehnenbild (Fokus-Brett, Uhren, Bewertungsbalken, PR #809) |
| Wettessen | 40 % | 0,844 | Nur Buehnen-Durchgaenge mit eigenem Rezept · keine eigene Mechanik |
| Eiskunstlauf | 38 % | 0,757 | Nur Buehnen-Durchgaenge mit eigenem Rezept · kaderfest knapp unter der Schranke (vorher bestanden) |
| Breaking | 38 % | 0,801 | Nur Buehnen-Durchgaenge mit eigenem Rezept · keine eigene Mechanik |
| Showcase | 40 % | 0,880 | Nur Buehnen-Durchgaenge mit eigenem Rezept · kaderfest bestanden (vorher knapp, reines Kaderrauschen) |
| **Takeshi's Castle** | **50 %** | **0,886** | **Kaderfest bestanden (vorher als 0,697/durchgefallen dokumentiert — reines Kaderrauschen, s. Abschnitt 1)** · Hindernisse, Nerven, Burgpunkte, drei Kurse, zehn Fallen (PR #810) · PR #813 (Route+Chaos) offen, nicht Voraussetzung fuer die Abnahme · nicht im echten Spielstand |
| **Staffel** | **48 %** | **0,915** | **Kaderfest bestanden, beste Rangtreue im gesamten Feld (vorher als 0,681/durchgefallen dokumentiert — reines Kaderrauschen, s. Abschnitt 1)** · Abschnittszeit, stufenlose Uebergabe, Kurve, Zug an der Spitze · nicht im echten Spielstand |
| I-Spy | 35 % | 0,692 | Duell-Variante der Buehne · Spielerwert auf eigene Punkte umgestellt |
| Spurt | 45 % | 0,871 | Hindernislauf statt Ermuedungssprint (05.09., `spurt-modellierung-recherche-05-09.md` Prototyp P6): Zeitpreis je Hindernis nach Sub-Skill (0,36–0,84 s), Rempler gedaempft, Ermuedung halbiert — rho 0,652 → 0,871, Dexterity-Einfluss 3,5 % → 16,7 % · Huerden, Windschatten, Rempler, drei Rennplaene · Bild vom Chassis |
| **Football** | **32 %** | **0,516** | **Neuer Live-Motor** (Downs, Line of Scrimmage, echte Formationen, Snap-Phase, fuenf sichtbar unterschiedliche Spielzuege) statt des alten Vorab-Pfads · strukturell der groesste Fortschritt seit der letzten Fassung · Rezept war beim Umstieg vollstaendig ungemessene Platzhalter (Kopfzahl zunaechst RUECKWAERTS, 0,345→0,305), seither **gegen echte NFL-2024-Quoten kalibriert** (`football-rezept-kalibrierung.md`, →0,460), mit einer Down-Verdrahtung in vier zuvor toten Entscheidungsfunktionen nachgezogen (`football-review-bugfixes.md`, →0,468) und mit einem eigenen `spielEignung`-Block neben der gesperrten Matrix weiter angehoben (PR #803, 05.09., →**0,516**) · Anzeige/Teamstaerke/KI-Kauf ordnen Football weiterhin nach der alten Matrix, das Minispiel nach der neuen (bekannter, akzeptierter Nebeneffekt aus PR #803, Chris' Entscheidung offen) · nicht im echten Spielstand |
| Mini-DM | 30 % | 0,094 | Gemeinsamer Arena-Motor mit eigenen Slots · Wertformel und Eignung repariert · Zielwahl-Redesign recherchiert (Fable, 03.09.), nicht umgesetzt · Kader-Spannweite (0,697) groesser als der eigene Median — jede Bewegung hier ist bei n=24 unbeweisbar (s. Abschnitt 5) |
| TDM | 30 % | 0,253 | Aeltester Motor, am staerksten eingemessen · Zielwahl haengt an der Geometrie, nicht an der Recherche-Frage |
| Battlefield | 30 % | 0,387 | Aufstellung repariert und nachgemessen (Siege Core stand hinten, Saison-Validitaet 0,595) · Zielwahl-Redesign recherchiert, nicht umgesetzt |

**Kein Durchschnitt ueber alles**, weil die Achsen ungleich schwer wiegen: die neunzehn
Disziplinen ausserhalb von Basketball koennen zusammen keine 15 % erreichen, solange sie nicht
im Spielstand laufen, und die vierzehn ohne eigenes Bild keine 20 %. Wer die Zahlen heben will,
hebt sie am billigsten ueber diese beiden Achsen, nicht ueber Rezepte.

---

## 6. Das Werkzeug

`window.__arena.disziplinProbe(dId, {n, kaderFamilie})` baut, laesst laufen und sammelt
`wert()` und `eig` je Teilnehmer ein — fuer alle vier Chassis ueber dieselbe
`MOTOREN`-Schnittstelle, seit dem 03.09. optional ueber mehrere Kader-Varianten statt eines
einzigen fest verdrahteten Testkaders (s. `docs/design/messgrundlage-kaderfest.md`).

```
node scripts/miss-alle-disziplinen.mjs [spiele] [disziplin ...]                # kaderfest, Standard
node scripts/miss-alle-disziplinen.mjs [spiele] [disziplin ...] --einzelkader  # alte Einzelkader-Messung
node scripts/miss-alle-disziplinen.mjs [spiele] gewichtheben --je-seite=<6|4|2> # Gewichtheben mit anderer Kadergroesse
```

Ohne Disziplinliste laufen alle zwanzig — das dauert rund elf Minuten (fuenf Kader-Varianten
je Disziplin, n=24). `scripts/pruefe-rangtreue-schranke.mjs` nutzt denselben Kern
(`scripts/lib/rangtreue-messung.mjs`) fuer die CI-Schranke gegen die eingecheckte Basislinie
(s. Abschnitt 2b fuer deren aktuellen Pflegezustand).
