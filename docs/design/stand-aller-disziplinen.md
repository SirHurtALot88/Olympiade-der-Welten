# Der Stand aller zwanzig Disziplinen

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
| Speed-Schach | Buehne | 0,889 | 0,060 | 0,979 | 0,021 | bestanden |
| **Gewichtheben** | **Buehne** | **0,887** | 0,224 | 0,944 | 0,261 | **bestanden** |
| Showcase | Buehne | 0,880 | 0,140 | 0,944 | 0,063 | bestanden |
| Time-Trial | Bahn | 0,867 | 0,050 | 0,909 | 0,056 | bestanden |
| Wettessen | Buehne | 0,844 | 0,233 | 0,916 | 0,126 | bestanden |
| **Fechten** | **Buehne** | **0,840** | 0,230 | 0,874 | 0,252 | **bestanden** |
| **Tennis** | **Buehne** | **0,814** | 0,176 | 0,839 | 0,294 | **bestanden** |
| Breaking | Buehne | 0,801 | 0,114 | 0,874 | 0,119 | bestanden |
| Climbing | Bahn | 0,790 | 0,192 | 0,851 | 0,308 | knapp |
| Basketball | Feldspiel | 0,757 | 0,102 | 0,923 | 0,231 | knapp |
| Eiskunstlauf | Buehne | 0,757 | 0,125 | 0,958 | 0,091 | knapp |
| Takeshi's Castle | Bahn | 0,697 | 0,170 | 0,839 | 0,196 | durchgefallen |
| I-Spy | Buehne | 0,692 | 0,384 | 0,727 | 0,441 | durchgefallen |
| Staffel | Bahn | 0,681 | 0,398 | 0,706 | 0,650 | durchgefallen |
| Hockey (alle 12, inkl. Torwart) | Feldspiel | 0,669 | 0,181 | 0,832 | 0,259 | durchgefallen |
| ↳ Hockey, nur Feldspieler | Feldspiel | 0,719 | 0,182 | 0,818 | 0,259 | knapp |
| Spurt | Bahn | 0,652 | 0,559 | 0,690 | 0,643 | durchgefallen |
| Battlefield | Arena | 0,325 | 0,662 | 0,619 | 1,000 | durchgefallen |
| **Football** | Feldspiel | **0,468** | 0,383 | 0,671 | 0,420 | durchgefallen |
| Mini-DM | Arena | 0,269 | 0,802 | 0,500 | 1,167 | durchgefallen |
| TDM | Arena | 0,113 | 0,387 | 0,070 | 0,441 | durchgefallen |

**Acht bestehen, drei sind knapp, neun fallen durch** (die Zwoelferzahlen der zwanzig echten
Disziplinen; Bucketing: bestanden ab 0,80, knapp ab 0,70, sonst durchgefallen —
`scripts/miss-alle-disziplinen.mjs`). Die eingerueckte Hockey-Zeile ist kein einundzwanzigster
Eintrag, sondern dieselben Spiele derselben Disziplin ohne die beiden Torhueter (s. Abschnitt
1a) — sie zaehlt nicht mit in diese Bilanz, ist aber die ehrlichere Frage fuer „belohnt Hockeys
Mechanik das Richtige".

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
| Football | Feldspiel (Vorab-Pfad) | 0,345 / 0,699 | Feldspiel (**Live-Motor**) | **0,468 / 0,671** | `football-review-bugfixes.md` |

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
04.09.) hat sie zuletzt auf **0,468** bewegt — eine Bewegung innerhalb der eigenen
Kader-Spannweite, also von Null nicht unterscheidbar (s. Abschnitt 2). Football bleibt klar
unter der 0,80-Schranke (s. Abschnitt 5), ist aber kein Platzhalter-Rezept mehr.

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
1a) und Battlefield (0,325 gegen 0,619) stehen so da.
Football faellt dagegen aus diesem Muster heraus: **beide** Zahlen sind kaderfest gemessen
niedrig (0,468/0,671) — das ist nach der eigenen Rezeptkalibrierung UND der Down-Verdrahtung
(Abschnitt 5) gemessen, nicht mehr der ungemessene Platzhalter-Stand direkt nach der
Live-Migration, und sieht damit
eher nach einer echten Validitaetslücke (Rezept/Matrix) aus als nach reinem
Verlaesslichkeitsrauschen.

Wo beide Zahlen niedrig sind, belohnt die Mechanik das Falsche — ein **Validitaetsproblem**. Die
verbleibenden drei Arena-Disziplinen (TDM, Mini-DM, Battlefield) stehen so da, unveraendert seit
der letzten Fassung: 0,07 bis 0,62 in der Saison.

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

**Nebenbefund dieser Runde, fuer die naechste CI-Pflege wichtig:** die eingecheckte
`rangtreue-basislinie.json` wurde am 03.09. um 12:07 UTC gebaut — **vor** den
Tennis/Fechten-, Football- und Gewichtheben-Runden. Fuer sechzehn Disziplinen ist sie bis auf
die letzte Nachkommastelle deckungsgleich mit der Messung in diesem Dokument (nachgeprueft,
nicht vermutet). Fuer **Tennis, Fechten, Football und Gewichtheben traegt sie noch die alten
Zahlen** (Tennis/Feldspiel 0,505, Fechten/Arena 0,153, Football-Vorab 0,345, Gewichtheben
0,595) — die CI wuerde diese vier also aktuell gegen einen laengst ueberholten Massstab
pruefen, nicht gegen den echten aktuellen Stand. `node scripts/baue-rangtreue-basislinie.mjs 24`
sollte vor dem naechsten Merge, der diese Datei betrifft, einmal neu laufen; das ist bewusst
nicht Teil dieser rein dokumentarischen Runde.

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
— Basketball (Court) und Eishockey (Eisflaeche mit Linien, Torraeumen, Toren). Die uebrigen
achtzehn teilen sich das Bild ihres Chassis, mit kleinen Abweichungen wie Bodenfarbe
(`BA().boden`), Hindernissen und Steigung.

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

### Scoring und Produktion

Im echten Spielstand wird weiterhin **nur Basketball** ueber die Arena ausgespielt
(`ARENA_RESOLVED_DISCIPLINE_IDS`). Neu seit der letzten Fassung: Basketballs individuelle PPs
kommen jetzt aus dem echten Arena-Boxscore-Impact (ein Perzentilrang gegen den Liga-Pool,
linear auf einen Hoechstwert abgebildet), nicht mehr aus der alten PPS-Rang-Formel — vorher
wurde der Boxscore, den der Motor Zug fuer Zug berechnete, fuer die individuelle Punktzahl
schlicht verworfen (`docs/design/boxscore-an-pps.md`). Ein Anschluss-PR (#755, offen, **noch
nicht gemerged** zum Zeitpunkt dieses Berichts) ersetzt das Perzentilmodell durch eine absolute
Impact-Kurve, weil Chris zurecht bemaengelte, dass ein Perzentilrang fast immer denselben
Spieler auf die volle Punktzahl hebt, unabhaengig davon, ob sein Rohwert an diesem Tag gut oder
nur mittelmaessig war (`docs/design/pps-skalierung-opus.md`/`-umsetzung.md` auf dem PR-Branch).

Die anderen neunzehn — einschliesslich Tennis, Fechten und Football trotz ihrer grossen
Mechanik-Runden — laufen weiterhin ausschliesslich im Mockup. Fuer Tennis/Fechten ist das
explizit dokumentiert (`tennis-fechten-buehne-umsetzung.md` Abschnitt 4): der Chassis-Wechsel
aendert nichts an dem, was Chris heute im echten Spiel sieht, weil beide dort weiterhin ueber
den alten PPS-Rang-Pfad (`legacy-matchday-resolve-engine.ts`) abgerechnet werden. Eine
Live-Motor-Befoerderung wie bei Basketball waere ein eigener, spaeterer Auftrag.

---

## 5. Was als naechstes den groessten Hebel hat

Zwei der bisher groessten Hebel dieses Dokuments sind seit der letzten Fassung **abgearbeitet**
und fallen aus dieser Liste heraus: die Eignungsluecke (Abschnitt 3, behoben in allen vier
Chassis) und der Tennis/Fechten-Chassis-Fehlgriff (Abschnitt 1, beide jetzt bestanden). Was
bleibt bzw. neu hinzukommt:

1. **Die Arena-Zielwahl — weiterhin der groesste ungehobene Hebel, jetzt mit einem konkreten
   Vorschlag statt nur einer Diagnose.** TDM (0,113), Mini-DM (0,269) und Battlefield (0,325)
   bleiben alle deutlich unter der Schranke, mit derselben Ursache wie in jeder frueheren
   Fassung: die Zielwahl ist Geometrie, nicht Bedrohung (264 von 288 Kaempfern zielen auf den
   Naechsten). Fables Recherche vom 03.09.
   (`docs/design/arena-mini-dm-tdm-battlefield-rollout-plan.md`) bestaetigt das unabhaengig neu
   und liefert zusaetzlich einen konkreten, noch nicht gebauten Vorschlag: Zielwahl nach
   `u.zielP==="bedrohung"` (existiert bereits als Spieler-Option, ist aber nicht KI-Standard)
   mit Hysterese als Standardverhalten. **Reine Recherche, kein Commit an der Engine** — der
   naechste Schritt ist Umsetzung, keine weitere Recherche.
2. **Football: die Rezeptkalibrierung ist inzwischen gelaufen — der naechste Hebel ist die
   MATRIX, nicht ein weiterer Rezeptanlauf.** Der Live-Motor selbst (Downs, Formationen,
   eigene Kurve) war beim Umstieg der richtige Unterbau, aber alle acht Sub-Skill-Gewichte
   und alle Wahrscheinlichkeitskonstanten waren zunaechst ungemessene Platzhalter, und die
   Kopfzahl bewegte sich deshalb kaderfest zunaechst RUECKWAERTS (0,345 → 0,305). Das ist
   **erledigt**: `football-rezept-kalibrierung.md` (04.09.) hat `skillMittel`/`steil`/
   `korrektur` gegen reale NFL-2024-Quoten gefittet (Completion-Quote 65,3 %, Yards/Attempt
   7,1) und den Football-Korridor (`scripts/miss-football-korridor.mjs`) gebaut; die
   Kopfzahl stand seither bei 0,460 (`football-zufriedenstellend.md` bestaetigt sie per
   Sicht-QA erneut). Eine anschliessende Down-Verdrahtung in vier bis dahin toten
   Entscheidungsfunktionen (`waehlePlayCall`/`waehleFormationOffense`/
   `waehleFormationDefense`/`waehleFootballTier`, `football-review-bugfixes.md`, ebenfalls
   04.09.) hat sie auf **0,468** bewegt — eine Bewegung innerhalb der eigenen
   Kader-Spannweite (0,258→0,383), also von Null nicht unterscheidbar, aber mechanisch
   real (3rd & 8 spielt sich jetzt sichtbar anders als 1st & 10). Ein weiteres
   Rezept-Grinding hat laut der Kalibrierungsrunde **abnehmenden Grenzertrag** — der von
   ihr selbst benannte naechste Kandidat ist die Football-MATRIX (`BASIS_JE_DISC.football`:
   spirit 25, torment 16 dominieren, power steht mit Gewicht 6 an neunter Stelle in einer
   Kollisionssportart), nicht eine dritte Rezeptrunde — s.
   `football-gewichtheben-opus-review.md` Abschnitt B.6.
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
| Battlefield stellte Fuehrungsrollen faelschlich nach hinten (rho −0,49) | **behoben und nachgemessen** — Reihen-Fix vom 03.09., Saison-Validitaet jetzt 0,619 (kaderfest); die Zahl war frueher „nachzumessen", ist es nicht mehr |
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
| Basketball | 92 % | 0,757 | Live-Motor mit Zonen, Manndeckung und Spielzuegen · eigener Court · einzige Disziplin im echten Spielstand · **individuelle PPs jetzt aus dem echten Boxscore-Impact, nicht mehr aus dem alten PPS-Rang** (Perzentilmodell, PR #755 fuer eine absolute Impact-Kurve offen) |
| Hockey | 71 % | 0,719 (Feldspieler) / 0,669 (alle 12) | Live-Motor mit Torwart, Bodychecks, Strafen und Ueberzahl · eigene Eisflaeche · Feldspieler-only-Messung jetzt Standard (Abschnitt 1a) · K3 (Tore halb als xG) gemessen umgesetzt, rho Feldspieler 0,651→0,719 · HK_TW_BASIS/HK_TW_REF nachgezogen (7,16/0,907→9,13/0,871), alle-12 dadurch 0,618→0,669, Feldspieler bit-identisch · ein struktureller Anlauf (Zoneneintritt) zweimal gebaut, beide Male bei groesserem n nicht haltbar, nicht committed — spuerbar besser als vor dieser Runde, aber nicht bei 0,80 |
| **Fechten** | **48 %** | **0,840** | **Neu auf der Buehne** (vorher Arena, rho 0,153) · Rangtreue klar bestanden mit komfortablem Puffer · Rezept ein erster, unkalibrierter Entwurf · kein interaktiver Paar-Rechner (optional, nicht noetig fuer die Abnahme) · nicht im echten Spielstand |
| **Tennis** | **48 %** | **0,814** | **Neu auf der Buehne** (vorher Feldspiel, rho 0,505) · Rangtreue bestanden · Rezept 1:1 aus dem alten Feldspiel-Rezept uebernommen, nicht neu kalibriert · nicht im echten Spielstand |
| Time-Trial | 55 % | 0,867 | Kurvenmodell mit Linie und Risiko · Rangtreue bestanden · Bild vom Chassis |
| **Gewichtheben** | **70 %** | **0,887** | Reissen und Stossen, Duelle je Slot, Nullwertung, eigenes Buehnenbild · **Architekturfrage entschieden (04.09.): Charisma beruehrt jetzt auch die physische Hebe-Obergrenze (`HEBEN_TAGESMAX_ANSAGE_K`), nicht nur die Erfolgschance — rho 0,720 -> 0,887, Pp 23,1 -> 17,3, Korridor haelt bei beiden Werten** · Ein-Zeilen-Umkehr dokumentiert, falls Chris die physische Obergrenze lieber unangetastet haette · nicht im echten Spielstand |
| Climbing | 48 % | 0,790 | Steigung und Kraftbudget statt Antritt · kaderfest knapp unter der Schranke (vorher bestanden, reines Kaderrauschen) · Bild vom Chassis |
| Speed-Schach | 45 % | 0,889 | Duell-Variante der Buehne, Brett gegen Brett · beste Rangtreue im Feld · Bild vom Chassis |
| Wettessen | 40 % | 0,844 | Nur Buehnen-Durchgaenge mit eigenem Rezept · keine eigene Mechanik |
| Eiskunstlauf | 38 % | 0,757 | Nur Buehnen-Durchgaenge mit eigenem Rezept · kaderfest knapp unter der Schranke (vorher bestanden) |
| Breaking | 38 % | 0,801 | Nur Buehnen-Durchgaenge mit eigenem Rezept · keine eigene Mechanik |
| Showcase | 40 % | 0,880 | Nur Buehnen-Durchgaenge mit eigenem Rezept · kaderfest bestanden (vorher knapp, reines Kaderrauschen) |
| Takeshi's Castle | 45 % | 0,697 | Hindernisse und Nerven · kaderfest durchgefallen (vorher bestanden, reines Kaderrauschen) · Bild vom Chassis |
| Staffel | 40 % | 0,681 | Abschnittszeit, stufenlose Uebergabe, Kurve, Zug an der Spitze |
| I-Spy | 35 % | 0,692 | Duell-Variante der Buehne · Spielerwert auf eigene Punkte umgestellt |
| Spurt | 45 % | 0,652 | Huerden, Windschatten, Rempler, drei Rennplaene · Bild vom Chassis |
| **Football** | **28 %** | **0,468** | **Neuer Live-Motor** (Downs, Line of Scrimmage, echte Formationen, Snap-Phase, fuenf sichtbar unterschiedliche Spielzuege) statt des alten Vorab-Pfads · strukturell der groesste Fortschritt seit der letzten Fassung · Rezept war beim Umstieg vollstaendig ungemessene Platzhalter (Kopfzahl zunaechst RUECKWAERTS, 0,345→0,305), seither **gegen echte NFL-2024-Quoten kalibriert** (`football-rezept-kalibrierung.md`, →0,460) und mit einer Down-Verdrahtung in vier zuvor toten Entscheidungsfunktionen nachgezogen (`football-review-bugfixes.md`, →0,468, Bewegung innerhalb der Kader-Spannweite) · naechster Hebel ist die MATRIX, nicht das Rezept (Abschnitt 5) · nicht im echten Spielstand |
| Mini-DM | 30 % | 0,269 | Gemeinsamer Arena-Motor mit eigenen Slots · Wertformel und Eignung repariert · Zielwahl-Redesign recherchiert (Fable, 03.09.), nicht umgesetzt |
| TDM | 30 % | 0,113 | Aeltester Motor, am staerksten eingemessen · Zielwahl haengt an der Geometrie, nicht an der Recherche-Frage |
| Battlefield | 30 % | 0,325 | Aufstellung repariert und nachgemessen (Siege Core stand hinten, jetzt Saison-Validitaet 0,619) · Zielwahl-Redesign recherchiert, nicht umgesetzt |

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
