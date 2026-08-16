# Sponsoren-Rework II: Marken leihen Gebäude

Stand: 2026-08-10 · Anlass: Chris hat den Kurven-Entwurf aus `docs/SPONSOREN_REWORK_KONZEPT.md`
(PR #487) verworfen und eine eigene Richtung vorgegeben, wörtlich über mehrere Nachrichten:

> „die idee mit so häusern find ich irgendwie gut … hatte überlegt ob die zb noch wie ne art
> geldwerter vorteil einem zugang zu gebäuden geben also dass man die nutzen kann" ·
> „nur geliehen und dazu natürlich trotzdem sponsorengelder weil seine leute muss man ja bezahlen" ·
> „und vllt hat man dann ziele wie über platz x bleiben damit manche gebäude gelten und dann gibts
> fokussierte sponsoren" · „da haben wir ja schon einige an der realität angelehnte unternehmen
> drin das könnte man auf die gebäude übertragen" · „oder seltene sponsoren bringen neue gebäude?" ·
> „und das mit den stufen will ich trotzdem haben dass man so ne übersicht hat wie viel man auf
> welchem rang bekommt alle 4 ränge wie das vorher war" · „dann kann man mit den gebäuden auch
> mehrjahres pläne viel geiler umsetzen wenn man boni mitnimmt in folgeseasons etc" ·
> „was ich mir als ziel vorstellen kann ist wie du meintest frische, ein gewisser platz in einer
> achse wir tracken ja platzierungen vom team in POW SPE MEN SOC, aber dann passend zu dem was das
> team ggf. auch leisten kann! nicht wieder utopisch"

Dieses Dokument ist ein Konzept: kein Produktionscode, keine geänderte Balance-Zahl. Die
Messwerte aus dem Vorgänger-Konzept gelten unverändert weiter (dort Abschnitt 3); hier werden sie
nur zitiert, nicht neu hergeleitet. **Das Hauptergebnis ist das Mockup**
`docs/mockups/sponsoren-gebaeude.html` — dieses Dokument begründet, was dort zu sehen ist.

---

## 1. Kurzfassung

Ein Sponsorvertrag besteht künftig aus fünf Teilen. Zwei stehen auf jeder Karte, drei nur, wenn
die Karte ein Gebäude mitbringt:

1. **Gehalt je Spieltag** — der Sockel der bestehenden Sponsor-Ligaleiter
   (`lib/sponsor/sponsor-liga-leiter.ts`), in zehn Raten ausgezahlt. Geld gibt es immer,
   „weil seine Leute muss man ja bezahlen".
2. **Prämie nach Endrang** — die vorhandene Rangstufen-Leiter in Vierer-Blöcken (Platz 32,
   Top 28 … Top 4, Meister), exakt die Darstellung, die Chris behalten will. Sie existiert
   settlement-identisch in `SponsorRankLadder.tsx` / `sponsor-offer-presenter.ts:454-463` und
   bleibt das Rückgrat der Karte. Die elf Kurvenformen darüber entfallen — angezeigt und
   abgerechnet wird die neutrale Leiter.
3. **Leihgebäude** — die Sachleistung. Der Sponsor stellt eines der acht Katalog-Gebäude auf
   einer Stufe, solange der Vertrag läuft; danach fällt das Team auf seine eigene Stufe zurück
   (bei Chris: null). Welches Gebäude, verrät die Branche der Marke (Abschnitt 3).
4. **Rangmarke** — die Nutzungsbedingung, Chris' „über Platz X bleiben". Sie ist **keine eigene
   Zahl, sondern eine markierte Sprosse derselben Leiter**: steht das Team auf oder über der
   Marke, wirkt das Gebäude; darunter ruht es. Nie Geldabzug, nie rückwirkend.
5. **Bonus-Ziel** — genau eines, rein positiv (verfehlt heißt: kein Bonus, nie Abzug), aus genau
   zwei Arten: **Frische** oder ein **Achsen-Rang** in POW/SPE/MEN/SOC — relativ zum eigenen
   Stand bei Unterschrift gesetzt, „nicht wieder utopisch". Das Ziel folgt der Branche: die
   Kette **Branche → Gebäude → Achse → Ziel** gibt jedem Sponsor einen Charakter (Abschnitt 6).

Mehrjahresverträge sind der Ort, an dem die Idee trägt: die **Leih-Leiter** (je gehaltener
Saison steigt die geliehene Stufe) und das **Übernahmerecht** (wer die Laufzeit durchhält, darf
das Gebäude rabattiert kaufen und behält es dauerhaft) machen aus der Leihe die Anfahrt zum
Besitz — Chris' „Boni mitnehmen in Folgeseasons".

Zur Auswahl stehen **drei feste Karten-Archetypen** (kein Würfel über die Struktur, nur die
Marke variiert): der Geldgeber (1 Saison, volles Geld, kein Gebäude), der Ausstatter (2 Saisons,
mittleres Geld, Gebäude mit milder Marke) und der Baumeister (3 Saisons, wenig Geld, steigende
Leihstufe mit harter Marke und Übernahmerecht).

---

## 2. Warum genau diese Idee die gemessenen Probleme trifft

Drei Messwerte aus dem Live-Save tragen den Entwurf:

- **Cash 2,53 bei Gebäudekosten ab 5.** Chris kann sich kein einziges Gebäude leisten; sieben
  von acht sind nicht gebaut. Ein Sachleistungs-Sponsor ist der einzige Weg, wie ein klammes
  Team kurzfristig überhaupt an Gebäudewirkung kommt — und mechanisch ist das trivial, weil
  Ausbauten sofort greifen (die Stufe wird direkt gesetzt, es gibt keine Bauzeit, die eine
  Leihe verkomplizieren würde).
- **0 von 27 Sponsorzielen erreicht in Saison 1, −89,7 C Zielbilanz.** Das alte Zielsystem war
  eine unerklärte Gebühr. Daraus folgen hier zwei Konstruktionsregeln: die Rangmarke ist eine
  **Nutzungs**bedingung (Verfehlen kostet nie Geld, sondern lässt die Sachleistung ruhen), und
  das Bonus-Ziel ist **relativ zum eigenen Stand** gesetzt und **rein positiv**. Beides hängt an
  Zahlen, die jederzeit ohne Gebäude sichtbar sind: Tabellenplatz und Achsen-Rang im Saisonstand.
- **Chris mag die Rangstufen-Leiter.** Sie ist ausdrücklich nicht Teil des „total
  unübersichtlich" — und sie existiert schon in genau der gewünschten Form (Vierer-Blöcke,
  hervorgehobene aktuelle Stufe, Balkenbreite = Stärke). Der Entwurf baut sie nicht nach,
  er verwendet sie weiter und gibt ihr eine zweite Aufgabe.

---

## 3. Das Zuordnungsmodell: die Kette Branche → Gebäude → Achse → Ziel

Der Markenkatalog (`lib/sponsor/sponsor-brand-parents.ts`) enthält **200 Marken** (gezählt; der
Katalog-Kommentar nennt „200" auch als Ziel) in zwölf Branchen. Die Zuordnung ist eine
**Branchenregel ohne Ausnahmen** — damit das Logo verlässlich verrät, was drin ist und woran der
Sponsor misst:

| Branche(n) | Marken | Gebäude | Bonus-Ziel | Warum das einleuchtet |
|---|---:|---|---|---|
| Sport (Adidas, Nike, Puma, Asics …) | 12 | **Trainingszentrum** | POW-Rang | Ausrüster statten das Training aus und wollen Kraftleistung sehen. |
| Auto (BMW, Audi, Ferrari*, Continental …) | 38 | **Specialist Wing** | Achse der Marken-Variante | Ingenieurskunst = Spezialisierung; die Marke bestimmt die Variante und damit das Ziel (Ferrari → Agility Track → SPE, MAN → Power Gym → POW …). |
| Technik (SAP, Apple, IBM, Zeiss …) | 36 | **Analytics Room** | MEN-Rang | Daten, Software, Denksport. |
| Pharma (Bayer, Pfizer, J&J) | 3 | **Recovery Center** | Frische | Medizin = Regeneration. |
| Lebensmittel (Coca-Cola, Ferrero, McDonald's …) | 19 | **Academy** | Frische | Nachwuchsförderung ist real das Sponsoring-Feld der Branche; das Ziel läuft über Ernährung → Frische. |
| Handel (Aldi, Edeka, Zalando, IKEA …) | 41 | **Fan Shop** | SOC-Rang | Der Händler betreibt den Shop und will Publikum. |
| Medien + Telekom + Energie (RTL, Sky, Vodafone, E.ON …) | 20 | **Arena Upgrade** | SOC-Rang | Übertragung, Stadionpräsenz, Show. |
| Logistik + Luftfahrt (DHL, FedEx, Emirates …) | 12 | **Scouting Office** | SPE-Rang | Wer weltweit unterwegs ist, findet Talente — und lebt vom Tempo. |
| Finanz (Allianz, Deutsche Bank, Visa …) | 19 | **kein Gebäude — nur Geld** | kein Ziel | Die Bank bringt kein Haus, die Bank bringt Geld. |

\* Ferrari steht im Katalog als `sport`; die Regel greift über die Branche, nicht den Namen.

**Prüfung am Katalog.** Jede Branche hat ein Gebäude (bzw. die Geld-Rolle), jedes Gebäude
mindestens eine Branche, jede Sachleistungs-Karte genau ein Ziel — die Zuordnung geht auf
(Summe 200). Wo die Kette nicht sauber schließt, steht es hier:

- **Lebensmittel → Academy → Frische** ist das schwächste Glied: Branche→Ziel trägt (Ernährung →
  Frische), aber das Gebäude erzählt eine andere Geschichte (Jugend). Die Alternative — Academy
  an eine Achse zu hängen — wäre schlechter: Jugendentwicklung hat keine der vier Achsen.
  Akzeptierter Schönheitsfehler.
- **Pharma ist mit 3 Marken dünn.** Recovery-Leihen wären die seltensten der Liga. Das kann man
  als Feature lesen (Recovery L4 ist stark) oder den Katalog später um Gesundheitsmarken
  erweitern. Wichtig ist nur: die Angebots-Erzeugung würfelt **erst Archetyp und Gebäude, dann
  eine passende Marke** — die schiefe Katalogverteilung (115 der 200 Marken hängen an Analytics
  Room, Specialist Wing und Fan Shop) verzerrt so nichts am Gameplay.
- **Frische und SOC sind doppelt belegt** (Pharma+Food bzw. Handel+Medien), POW und MEN je
  einfach. Das ist unschädlich — das Ziel gehört zur Karte, nicht zur Liga — aber es heißt:
  Frische-Ziele werden die häufigsten sein. Angesichts dessen, dass Frische die einzige je
  funktionierende Zielachse war (Ø 44,3 % Erfüllung in der Messung), ist das eher richtig als
  falsch.
- **Die Geldgeber-Eindeutigkeit.** 19 Finanzmarken reichen nicht für 32 Geldgeber-Karten bei
  liga-weiter Markeneindeutigkeit (`GLOBAL_PARENT_MAX_TEAMS = 1`). Regel: Geldgeber ziehen
  bevorzugt Finanzmarken; geht der Pool aus, trägt die Karte eine andere Branche und sagt groß
  „keine Sachleistung". Das Logo-Versprechen gilt strikt in eine Richtung: **wo ein Gebäude drin
  ist, stimmt die Branche immer.**

Die vorhandene Team-Affinität (`preferredIndustriesForTeam`) bleibt nutzbar: KI-Teams ziehen
bevorzugt Marken ihrer bevorzugten Branchen.

---

## 4. Die Kartenanatomie

Der ganze Anlass war „total unübersichtlich" — die heutige Karte trägt rund zwanzig Zahlen.
Die neue Karte trägt **fünf Einzelzahlen und zwei Grafiken**:

1. **Gehalt:** „3,5 C je Spieltag" (×10 = garantierte Saisonsumme, steht als Klammer daneben).
2. **Prämien-Leiter:** die Vierer-Block-Grafik (Platz 32 bis Meister, 9 Sprossen). Sie ist
   *eine* Grafik, keine neun Zahlen — Balkenbreite kodiert die Stärke, die eigene
   Startplatz-Sprosse ist hervorgehoben, während der Saison wandert die „● aktuell"-Markierung.
   Bewusst als Balkenleiter, nicht als Textliste: die Form ist auf einen Blick lesbar, Chris
   kennt sie, und sie trägt die Rangmarke als Symbol auf einer Sprosse, statt eine zweite Skala
   aufzumachen.
3. **Sachleistung:** Gebäude, Stufe(n) und Wirkungstext wörtlich aus dem Katalog
   („Trainingszentrum Stufe 3 · +42 % Grundtraining"). Bei Mehrjahresverträgen als Stufenreihe
   „S1: 2 → S2: 3 → S3: 4" — die Reihe **ist** zugleich die Laufzeitanzeige, ein eigener
   Laufzeit-Chip entfällt.
4. **Rangmarke:** ein Symbol auf der betreffenden Leiter-Sprosse plus ein Satz („gilt, solange
   du Top 20 stehst"). **Keine eigene Zahl** — das ist der Kern der Zusammenlegung, die sich
   aufdrängt, weil beide Mechaniken an derselben Größe hängen und dieselbe Blockung nutzen.
   Eine Leiter, zwei Lesarten: der **Endrang** zahlt die Prämie, der **laufende Rang** schaltet
   das Gebäude. Dieser eine Unterschied muss auf der Karte stehen (ein Satz, siehe Mockup).
5. **Bonus-Zeile:** „+6 C, wenn …" mit Latte und aktuellem Stand („POW: Platz 14 halten —
   aktuell 14."). Zwei Zahlen (Bonus, Latte), rein positiv.
6. **Übernahmezeile** (nur Mehrjahresverträge): „Am Ende übernehmen: 19 C statt 77 C" — relevant
   erst am Vertragsende.

Damit ist Chris' Grenze („unter fünf, sechs Zahlen") **erreicht, nicht gerissen** — aber die
Karte ist voll. Mit dem Ziel-Nachtrag ist die letzte freie Stelle besetzt; **kommt noch eine
Dimension dazu, muss eine andere weichen.** Streichreihenfolge: zuerst das Übernahmerecht (die
jüngste, am wenigsten getestete Idee; die Leih-Leiter funktioniert auch ohne), dann die
Unterscheidung milder/harter Marken (dann alle Marken einen Block unter Start).

---

## 5. Die Nutzungsbedingung im Detail

**Woran sie hängt:** am Tabellenplatz nach jedem Spieltag, verglichen mit einer festen
Leiter-Sprosse (Top 24, Top 20, Top 16 …), die bei Unterschrift eingefroren wird.

**Wie die Marke gesetzt wird — die Lehre aus 0/27:** relativ zum Startrang, nie absolut.
Die **milde Marke** (Ausstatter) liegt einen Vierer-Block unter dem Startblock des Teams —
Startrang 19 (Block Top 20) ⇒ Marke Top 24. Der Startzustand erfüllt sie per Konstruktion;
man muss nicht steigen, nur nicht um mehr als einen Block abstürzen. Die **harte Marke**
(Baumeister) ist der eigene Startblock — „bleib so gut, wie du gestartet bist". Marken über dem
Startblock gibt es nicht: eine Karte, die erst erspielt werden müsste, wäre die alte Zielfalle
in neuen Kleidern.

**Was beim Unterschreiten passiert:** das Gebäude **ruht sofort, kommt sofort zurück, nichts
wirkt rückwirkend.** Keine Karenz — sie würde die Regel zweistufig machen („ab wann genau?"),
und sie ist unnötig, weil der Schaden eines einzelnen schlechten Spieltags ohnehin genau ein
Spieltag ist: spieltagsnahe Wirkungen (Erholung, Analytics-Anzeige) setzen aus, saisonweite
Wirkungen (Trainingsprogression, Academy-Bonus, Shop-/Arena-Einnahmen) zählen **anteilig nach
aktiven Spieltagen** — aktiv an 8 von 10 heißt 80 % der Saisonwirkung. Geld ist nie betroffen:
Gehalt und Prämienleiter laufen unverändert weiter.

**Wie der Spieler seinen Stand sieht:** an der Leiter selbst — „● aktuell" gegen die
Marken-Sprosse, jederzeit, ohne Gebäude, ohne Untermenü. Dazu eine Statuszeile auf der
Vertragskarte („aktiv" / „ruht seit Spieltag 6 — 3 Plätze unter der Marke") und eine
Timeline-Meldung bei jedem Statuswechsel. Der Randfall ist im Mockup als eigene Ansicht
gezeichnet, denn an ihm entscheidet sich, ob die Regel fair wirkt.

---

## 6. Das Bonus-Ziel: Frische oder Achsen-Rang, nie utopisch

Genau **zwei Zielarten**, beide jederzeit ohne Gebäude nachschlagbar, beide rein positiv
(+6 C am Saisonende; verfehlt = kein Bonus, nie ein Abzug):

**Frische** (Pharma- und Lebensmittel-Karten): „Mindestens 70 % deines Kaders sind am Saisonende
frisch (Match-Fatigue ≤ 45)." Übernommen aus dem Vorgänger-Konzept — `kaderpflege` ist die
einzige Zielachse, die in der Messung je funktioniert hat, sie ist vom ersten Spieltag an durch
Rotation und Trainingsmodus beeinflussbar, und ihr Stand ist messbar.

**Achsen-Rang** (alle übrigen Sachleistungs-Karten): der Liga-Rang des Teams in der Achse der
Kette — POW, SPE, MEN oder SOC. Diese Ränge existieren bereits: der Saisonstand rechnet sie je
Team und Bereich (`areaRanksByTeam` über `buildValueRanks` je `SEASON_DISCIPLINE_AREA_GROUPS`),
dieselbe Rechnung steht seit kurzem als „#N" hinter den geholten PPs. Serverseitig ist der Weg
kurz: die PP-Summen je Disziplin und Team liegen in reinen lib-Funktionen
(`lib/season/season-discipline-area-groups.ts` — `sumSeasonDisciplineAreaTotal`,
`buildTeamHistoryDisciplineValuesFromSnapshot`); nur `buildValueRanks` (~40 Zeilen, pure
Funktion, inklusive der „schlechtester Rang bei Gleichstand"-Regel) lebt heute in der
Client-Komponente `SeasonStandingsNewLook.tsx:270` und müsste nach `lib/season` umziehen, damit
Anzeige und Settlement dieselbe Rechnung teilen — derselbe Umzug, den `SponsorRankLadder`
vorgemacht hat.

**Wie die Latte gesetzt wird — „passend zu dem, was das Team leisten kann":** aus dem
Achsen-Rang bei Vertragsabschluss, nie absolut. Drei Bänder, weil „halten" oben schwerer ist
als „aufholen" unten:

| Achsen-Rang bei Unterschrift | Latte | Beispiel |
|---|---|---|
| 1–8 (Spitze) | Rang + 2 halten oder besser | POW-3. ⇒ „bleib Top 5" |
| 9–24 (Mitte) | Rang halten oder besser | POW-14. ⇒ „bleib 14. oder besser" |
| 25–32 (Keller) | Rang − 2 erreichen | POW-28. ⇒ „werde 26. oder besser" |

Ausgewertet wird am Saisonende gegen den Achsen-Endrang; der Stand ist die ganze Saison im
Saisonstand sichtbar und steht zusätzlich als Zeile auf der Vertragskarte („aktuell 14.").
Ein Spitzenteam bekommt Puffer, ein Kellerteam eine erreichbare Aufgabe — kein Band verlangt
einen Sprung, den die Messung nie beobachtet hat (±2 Achsen-Ränge sind normale
Saisonbewegung; „Top 5 in POW" für ein Team auf Achsen-Rang 19 wäre die alte Falle).

**Die Kette als Charakter.** Adidas bringt das Trainingszentrum und misst POW; SAP bringt den
Analytics Room und misst MEN; Bayer bringt das Recovery Center und misst Frische. Damit ist die
Karte in einem Satz erzählbar („Ausrüster: Training + Kraft") statt eine Zufallskombination.
Der Geldgeber trägt bewusst **kein** Ziel — er ist die Karte für Spieler, die schlicht Geld und
Ruhe wollen; sein Verzicht auf den möglichen Bonus ist zugleich ein kleiner Ausgleich dafür,
dass er den höchsten Kartenfaktor hat.

---

## 7. Mehrjährigkeit: Leih-Leiter und Übernahmerecht

**Was trägt über Saisongrenzen?** Die **Leihstufe steigt, das Geld bleibt flach.** Die heutige
Mehrjahres-Erosion (`getSponsorTermMultiplier`) entfällt für Neuverträge; Sockel und
Wertungstopf werden je Saison wie bisher mit dem neuen Salary Factor gerechnet (bestehender
Reroll-Pfad). Rangmarke und Ziel-Latte bleiben über die ganze Laufzeit die bei Unterschrift
eingefrorenen — wer sich verbessert, für den werden sie leichter; genau das ist die Belohnung.
Das Bonus-Ziel wird je Saison der Laufzeit neu ausgewertet (bis zu 3 × +6 C).

**Die Leih-Leiter, geprüft.** Regel: war das Gebäude in einer Saison an **mindestens 6 von 10
Spieltagen aktiv**, gilt die Saison als gehalten, und die Leihstufe steigt zum nächsten
Saisonstart um eins. Eine gerissene Saison **pausiert** den Aufstieg — die Stufe bleibt, fällt
aber nie zurück, denn sonst wäre ein einziger schlechter Lauf der Ruin eines Dreijahresplans.
Die Prüfung gegen den Katalog fällt positiv aus, wenn die Reihe bei Stufe 2 beginnt statt bei 1:
die Stufe-1-Wirkungen (+14 % Training, +2 Erholung) sind zu schwach, um eine Karte zu tragen,
und der Endpunkt Stufe 4 ist genau die Größenordnung, die sich ein Team wie Chris' (Cash 2,53,
Trainingszentrum Stufe 4 kostet allein 40) auf Jahre nicht bauen kann. Also: Ausstatter
2 Saisons, Stufen 2→3; Baumeister 3 Saisons, Stufen 2→3→4. Stufe 5 bleibt seltenen Sponsoren
vorbehalten (Abschnitt 8).

**Das Übernahmerecht.** Am Vertragsende darf das Team das Gebäude auf der erreichten Leihstufe
kaufen: **Preis = kumulierte Katalogkosten der Stufe × (1 − 25 % je gehaltener Saison)**,
maximal 75 % Rabatt; gehalten zählt wie beim Aufstieg. Beispiele: Ausstatter, 2 gehaltene
Saisons, Trainingszentrum Stufe 3 → 48 × 50 % = **24 C**; Baumeister, 3 gehaltene Saisons,
Recovery Center Stufe 4 → 77 × 25 % = **19 C**. Warum diese Konditionen: der Geldverzicht
gegenüber der Geldgeber-Karte ist die faktische Leasingrate. Der Baumeister verzichtet ~16 C je
Saison (Abschnitt 9), über drei Saisons ~48 C; mit 19 C Übernahme liegt er bei ~67 C für ein
77-C-Gebäude **plus drei Saisons Nutzung obendrauf**. Das ist absichtlich spielerfreundlich:
Treue soll sich lohnen, das Risiko des Ruhens trägt allein der Spieler, und das Vorgängersystem
hat zwei Saisons lang nur abgezogen. Wer nicht übernimmt (oder nicht kann), fällt auf die
eigene Stufe zurück — die Karte sagt das vorher.

Das Übernahmerecht beantwortet auch den größten Einwand gegen Leihgebäude überhaupt: dass der
Sponsor sonst zur einzigen Gebäudequelle würde und die eigene Bauentscheidung entwertet. So ist
die Leihe der Weg **in** den Besitz, nicht sein Ersatz.

---

## 8. Seltene Sponsoren: höhere Stufe statt neues Gebäude

Chris fragt, ob seltene Sponsoren **neue** Gebäude bringen könnten. Ehrliche Antwort: ein neues
Gebäude ist ein eigenes Feature — Katalogeintrag, Wirkungspfad durch die Progression- oder
Finanzlogik, KI-Bewertung, Anzeige auf der Gebäudeseite, Balance gegen acht Bestandsgebäude.
Das als Nebenprodukt des Sponsorsystems zu bauen, würde genau die Sorte halb verdrahteter
Effekte erzeugen, die der Gebäude-Report gerade erst ausgebaut hat (Analytics Room, Specialist
Wing — siehe `docs/GEBAEUDE_REWORK_KONZEPT.md`).

**Empfehlung: die billige Variante.** Der seltene Sponsor („Mäzen", ~5 % der Angebote, Marken
aus dem Global-Pool: Emirates, Rolex, Red Bull …) leiht ein **vorhandenes** Gebäude auf
**Stufe 5** — eine Stufe, die sich im normalen Spielverlauf niemand leisten kann
(Trainingszentrum Stufe 5: 150 C kumuliert) — und zwar **ohne Geldabzug** (Kartenfaktor 1,0).
Seine Rangmarke ist hart (Startblock), sein Übernahmerecht ausgeschlossen — der Mäzen geht,
wenn er geht. Das ist mit dem bestehenden System vollständig darstellbar: gleiche
Kartenanatomie, nur bessere Zahlen.

Falls später doch ein neues Gebäude gewünscht ist, dann genau eines: ein **Medienzentrum**
(nur leihweise, nie baubar), Stufen 1–3: +0,05 / +0,10 / +0,15 Beliebtheit je Saison, solange
aktiv. Es dockt an eine existierende, gemessene Mechanik an (Arena-Einnahmen skalieren mit
Beliebtheit bis ×1,5) und bräuchte keinen neuen Wirkungspfad — aber auch das ist Ausbaustufe
zwei, nicht Teil dieses Entwurfs.

---

## 9. Balance-Skizze

**Der Anker: was ist eine geliehene Stufe wert?** Formel:

```
Leihwert(Gebäude, Stufe) ≈ kumulierte Baukosten / 5  +  Saison-Unterhalt
```

Der Divisor 5 ist die typische Amortisationszeit der Einnahmegebäude (Fan-Shop-Kommentar im
Katalog: „~3–7 Saisons"); der Unterhalt kommt dazu, weil der Sponsor das Gebäude betreibt —
Leihgebäude kosten **keinen** Unterhalt. Die Eichung stimmt fast aufs Zehntel: Fan Shop Stufe 3
per Formel 52/5 + 1,4 = **11,8 C**, realer Katalog-Ertrag **11,7 C**/Saison. Weitere Anker:
Trainingszentrum L3 = 12,0 · L4 = 21,4 · Recovery L4 = 18,7 · Analytics L3 = 7,9 (die billigste
Leihe — Technik-Karten tragen entsprechend fast volles Geld).

**Die Kartenfaktoren.** Jeder Archetyp skaliert Gehalt und Prämienleiter mit einem festen
Faktor — die eine zentrale Geld-Stellschraube je Karte:

| Karte | Faktor | Geldwert/Saison (Anker EV 63,4 bei Startrang 19, Salary Factor 1,19) | Verzicht | Gegenwert |
|---|---:|---:|---:|---|
| Geldgeber | 1,00 | ~63 C | — | — |
| Ausstatter | 0,85 | ~54 C | ~9,5 C/Saison | Leihwert L2→L3 ≈ 6→12 C, milde Marke (Uptime ~90 %) + Ziel-Bonus-Chance |
| Baumeister | 0,75 | ~48 C | ~16 C/Saison | Leihwert L2→L3→L4 ≈ 5→10→19 C, harte Marke (Uptime ~70–80 %) + Übernahmerecht + Ziel-Bonus-Chance |

Der Ausstatter ist bewusst leicht spielerfreundlich (Verzicht ≈ Leihwert × Uptime), der
Baumeister bezahlt seinen Verzicht erst über die Laufzeit plus Übernahme — hält er durch, ist er
klar im Vorteil; reißt er oft, verliert er. Genau diese Asymmetrie ist gewollt: die Karte mit
dem größten Versprechen trägt das größte Risiko. Der Bonus (+6 C, ~10 % des EV) ist bewusst
**nicht** EV-fair eingepreist — er ist als erreichbares Erfolgserlebnis gedacht, nicht als
versicherungsmathematische Wette; wenn die halbe Liga ihn holt, ist das der Zweck, kein
Kalibrierungsfehler.

**Die Stellschrauben, benannt:** (1) der Divisor 5 der Leihwert-Formel, (2) die Kartenfaktoren
0,85/0,75, (3) die Lage der Marken relativ zum Startblock, (4) der Übernahme-Rabatt
25 %/gehaltene Saison, (5) die Aufstiegs-Schwelle 6/10, (6) der Stufen-Deckel (4 regulär,
5 selten), (7) Bonushöhe 6 C und die Bänder der Ziel-Latte (±2). Nichts davon ist
durchgespielt; vor dem Einbau gehört ein Balancing-Lauf über eine KI-Saison dazu
(Uptime-Verteilung der Marken und Achsen-Rang-Schwankung über 32 Teams messen).

---

## 10. Umstellung ohne Migration

Chris steckt mitten in Saison 2; laufende Verträge dürfen sich nicht ändern. Der Weg ist
derselbe wie im Vorgänger-Konzept, Abschnitt 7 — zusammengefasst:

1. **Eingefrorene Konditionen.** Jeder unterschriebene Vertrag rechnet aus seinem
   `sponsorV3`-Block ab; der Settle-Pfad bleibt für Altverträge bestehen (Präzedenzfall:
   der abgeschaffte 27+6-Zielkatalog wird für Altverträge bis heute ausgewertet).
2. **Neue Karten erst mit der nächsten Angebotserzeugung.** Chris' laufender Vertrag läuft
   normal aus; die neuen Karten erscheinen zum Start von Saison 3 über den bestehenden
   `regenerateSponsorOffersForSeason`-Pfad. Alt-Mehrjahresverträge laufen aus statt migriert
   zu werden.
3. **Die Leihe ist ein Overlay, kein Eingriff.** Neue Vertragsfelder (Gebäude, Stufenreihe,
   Rangmarke, Ziel-Latte, Kartenfaktor, Übernahmekondition), bei Unterschrift eingefroren. Die
   Gebäudewirkung liest künftig eine effektive Stufe `max(eigene Stufe, aktive Leihstufe)` —
   die gespeicherten Gebäudestände aller Spielstände bleiben unangetastet, alte Saves kennen
   schlicht keine Leihen. Beim Specialist Wing gilt zusätzlich: existiert ein eigener Flügel,
   bestimmt **er** die Fokusachse; die Leihe zählt nur über die Stufe.
4. **Spieltagszahlung und Statuswechsel** buchen über die vorhandenen Pfade
   (Sponsor-Cash-Buchung beim Matchday-Advance, `sponsorPayoutLogs` mit neuer Phase,
   Timeline-Einträge). Der Event-Würfel (Partner-Reibung etc.) entfällt für Neuverträge.
5. **Ein Umzug, kein Umbau, fürs Ziel:** `buildValueRanks` von
   `SeasonStandingsNewLook.tsx` nach `lib/season`, damit Anzeige und Sponsor-Auswertung
   dieselbe Achsen-Rang-Rechnung teilen.

---

## 11. Was dagegen spricht

**Die Karte ist voll — endgültig.** Fünf Zahlen und zwei Grafiken sind die Obergrenze dessen,
was nach „drei zur Auswahl, übersichtlich" vertretbar ist, und der Ziel-Nachtrag hat die letzte
freie Stelle besetzt. Dieses Konzept hat auf dem Weg hierher vier Chris-Nachträge aufgenommen;
der nächste kippt die Karte. Die Streichreihenfolge steht in Abschnitt 4 und sollte vor dem
Einbau abgestimmt sein, nicht danach.

**Zwei Lesarten derselben Leiter.** Endrang zahlt, laufender Rang schaltet — in einem Satz
erklärbar, aber verwechselbar. Wer nach starkem Zwischenspurt am Ende abstürzt, bekommt wenig
Prämie trotz meist aktiven Gebäudes; die umgekehrte Karriere zahlt voll und hatte ein ruhendes
Gebäude. Beides ist gewollt (Dauerform vs. Endspurt), aber es wird Nachfragen geben. Das Mockup
adressiert das mit genau einem Satz pro Karte — ob der reicht, zeigt erst Chris.

**Drei rangartige Größen auf einer Karte.** Tabellenplatz (Leiter + Marke), Achsen-Rang
(Ziel-Latte) und Leihstufe (Gebäude) sind drei verschiedene „Ränge". Die Kette entschärft das
farblich und erzählerisch, aber ein Spieler, der „Platz" liest, muss trotzdem kurz denken,
welcher gemeint ist. Das ist der Preis dafür, dass Chris sowohl die Rangleiter als auch die
Achsen-Ziele ausdrücklich will.

**Anteilige Saisonwirkung ist stille Mathematik.** „Aktiv an 8 von 10 Spieltagen = 80 % der
Trainingswirkung" ist fair, aber unsichtbar — am Saisonende steht eine Zahl, die kleiner ist
als der Katalogwert, und der Spieler muss den Grund erinnern. Die harte Alternative (zählt nur
bei ≥ 6/10 voll, sonst gar nicht) wäre sichtbarer, aber brutaler und schüfe eine neue
Klippen-Falle. Der Entwurf wählt die anteilige Regel und lebt mit der Erklärlast.

**Leihe gegen Eigenbau bleibt ein Spannungsfeld.** Das Übernahmerecht entschärft es, löst es
aber nicht: solange ein Ausstatter-Angebot wahrscheinlich ist, ist Selbstbauen der teurere Weg
zum selben Gebäude. Wer schon gebaut hat, hat das umgekehrte Problem — für ihn ist eine
Leihkarte unter oder auf seiner eigenen Stufe wertlos (`max`, nicht Summe). Die
Angebotserzeugung **muss** deshalb die eigenen Stufen ansehen und nur Leihen oberhalb anbieten;
tote Sachleistungen wären die neue Version von „0 von 27".

**Pharma-Engpass und Branchen-Klumpen.** Drei Recovery-Marken liga-weit; 115 von 200 Marken
auf den drei billigsten Gebäuden; Frische doppelt belegt. Die Ziehung nach Archetyp-zuerst
fängt das spielmechanisch ab, aber die Markenvielfalt pro Gebäude ist sehr ungleich.

**Der Analytics Room verliert erneut seinen Gegenstand.** Seine Stufen 1–3 zeigen den
Live-Stand der Sponsor-**Achse** — die es für Neuverträge nicht mehr gibt. Der natürliche neue
Gegenstand liegt auf der Hand (Endrang-Prognose: auf welche Leiter-Sprosse läuft die Saison
zu), aber das ist der zweite Zweckwechsel des Gebäudes binnen Wochen und muss im selben Zug
entschieden werden, sonst entsteht dort wieder ein „lohnt sich nicht".

**Es ist der vierte Sponsor-Umbau.** Achsen-Engine, Kurvenformen-Normierung, Vorschuss,
Event-Service, Mehrjahres-Erosion — fast alles 2026 gebaut, fast alles würde für Neuverträge
totes Gewicht. Das war beim Vorgänger-Konzept so und ist hier nicht besser; es ist der Preis
der Richtungsänderung, und niemand kann garantieren, dass dieser Umbau der letzte ist.

**Ungeprüfte Kalibrierung.** Kartenfaktoren, Uptime-Annahmen, Übernahme-Rabatt, 6/10-Schwelle,
Bonushöhe und Latte-Bänder sind an Katalogkosten und Messwerten geankert, aber nicht
durchgespielt. Insbesondere zwei Schätzungen tragen viel: die Uptime der harten Marke (wenn
Ränge stärker schwanken als angenommen, ist der Baumeister eine Falle; schwanken sie weniger,
ist er geschenkt) und die normale Saisonbewegung der Achsen-Ränge (±2 ist plausibel, aber
ungemessen). Vor dem Einbau: eine KI-Saison messen.
