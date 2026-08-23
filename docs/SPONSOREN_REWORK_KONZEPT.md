# Sponsoren-Rework: drei Kurven statt fünf Würfel

Stand: 2026-08-10 · Anlass: Meldung von Chris, wörtlich:

> „und ich möchte sponsor ändern bitte wieder nur 3 zur auswahl und einfach nur mit verschiedenen
> kurven oder so -> fable soll sich was überlegen das macht für mich keinen sinn! das ist total
> unübersichtlich und funktioniert so einfach nicht also ich meine diese ganzen bonus und extra
> ziele, da müssen wir uns auf ein paar wesentliche beschränken wenn überhaupt und die sinnvoll
> und verständlich machen"

Dieses Dokument ist ein Konzept. Es ändert keinen Code und keine Balance-Zahl. Es misst zuerst am
echten Spielstand (`new-game-1785823388048-1hf25q`, Saison 2, 4 von 10 Spieltagen gespielt, Team
S-C), was das Sponsorsystem heute tut, sagt dann, warum es sich so anfühlt, wie Chris es
beschreibt, und schlägt eine Fassung mit drei Sponsoren vor, die sich ausschließlich in ihrer
Auszahlungskurve über die Saison unterscheiden. Am Ende stehen der Umstellungsweg für laufende
Spielstände und ein Abschnitt „Was dagegen spricht".

---

## 1. Kurzfassung des Befundes

Das Sponsorsystem ist bereits dreimal umgebaut worden (`docs/SPONSOR_PREISGELD_SOCKEL_ENTWURF.md`,
`docs/sponsor-rework-umsetzungsplan.md`, `docs/analyse/sponsor-achsen-messung.md`), und jeder Umbau
hat eine neue Unterscheidungs-Dimension eingeführt, während die alten als „Altvertrags-Lesbarkeit"
stehen blieben. Heute unterscheiden sich die **fünf** Angebote eines Teams gleichzeitig in: Rarität
(4 Stufen), Kurvenform (11 Stück), Zielachse (5 Stück), Vorschuss (ja/nein), Laufzeit (1/2/3
Saisons), Golden-Los, Challenge-Los und Marken-Paket — während die eine Zahl, die alle vergleichbar
macht, **per Konstruktion bei allen fünf identisch ist**: der Erwartungswert. Gemessen am Live-Save
steht auf allen fünf Karten von S-C derselbe Wert, 63,8 C. Die Wahl ist absichtlich folgenlos
gebaut („EV-neutral") und gleichzeitig mit acht Würfeln dekoriert. Genau das ist „total
unübersichtlich und macht keinen Sinn": viel zu vergleichen, nichts zu entscheiden.

Und „funktioniert so einfach nicht" ist bei den Zielen keine gefühlte, sondern eine gemessene
Wahrheit: **In Saison 1 dieses Spielstands wurde kein einziges der 27 Sponsorziele erreicht.**
Alle 27 Sonderziel-Zeilen der Abrechnung sind negativ, zusammen −89,7 C. In Saison 2 stünde die
Abrechnung Stand heute (Spieltag 4) bei 24 von 30 Zielzeilen negativ, −114,4 C. Ein Zielsystem,
das über zwei Saisons hinweg der Liga nur Geld abzieht und nie auszahlt, ist aus Spielersicht
keine Chance, sondern eine unerklärte Gebühr.

Der Vorschlag: drei fest definierte Sponsoren-Profile, die sich nur darin unterscheiden, **wann**
das Geld kommt — sofort, gleichmäßig je Spieltag, oder am Saisonende erfolgsabhängig. Jede Karte
ist in einem Satz erklärbar. Von den Zielen bleibt höchstens eines, rein positiv, ohne Abzug bei
Verfehlen; die Empfehlung samt Alternativen steht in Abschnitt 5.2.

---

## 2. Bestandsaufnahme: was heute existiert

### 2.1 Wie viele Sponsoren stehen zur Wahl, und woher kommt die Zahl?

**Fünf**, nicht drei. `buildSponsorOffersForTeam` setzt `SLOT_COUNT = 5`
(`lib/sponsor/sponsor-offer-service.ts:246`) und würfelt den Slate über `rollSponsorOfferSlate`
(`lib/sponsor/sponsor-tier-pool.ts:196-377`): Slot 0 ist immer die Basis-Karte (nur Kurve, kein
Ziel), die Slots 1–4 tragen je eine der fünf Zielachsen — der Deckel ist
`min(5, 1 + verfügbare Achsen)` (`sponsor-tier-pool.ts:219-220`). Gemessen am Save: 22 Teams haben
genau 5 Angebote, die übrigen 10 keine (sie stecken in Mehrjahresverträgen und bekommen keine
neuen Angebote, `sponsor-offer-service.ts:361-388`).

Die Sponsorenseite selbst behauptet etwas anderes: **„Drei Angebote pro Saison."** steht wörtlich
im Kopftext (`app/foundation/sponsors-v2/FoundationSponsorsNewLook.tsx:916`). Der Text ist ein
Überbleibsel einer früheren Fassung — Chris' „bitte wieder nur 3" deckt sich also mit dem, was die
Oberfläche ohnehin verspricht. Ebenfalls veraltet: das Regelwerk-Badge daneben zeigt für jeden
Spielstand mit `sponsorSystemVersion === 3` — also auch für den Live-Save — „Klassisches
Sponsormodell" an, weil die Bedingung nur `=== 2` als „neu" kennt
(`FoundationSponsorsNewLook.tsx:924-934`).

### 2.2 Wie zahlt ein Sponsor heute aus?

Im Kern **einmal, am Saisonende**, aus bei Unterschrift eingefrorenen Konditionen. Die Rechnung
(`sponsorV3Settle`, `lib/sponsor/sponsor-v3-model.ts:550-556`):

```
Auszahlung = Leiter(Endrang) + Erfüllung·G − p·G
```

Die **Leiter** ist die Sponsor-Ligaleiter (`lib/sponsor/sponsor-liga-leiter.ts`): ein Sockel nach
Startrang (18 C für den Titelverteidiger bis 48 C fürs Schlusslicht, `:32-34`) plus ein
Wertungstopf nach Endrang (1030 C × Salary Factor über die Liga, `:36`), verteilt nach einer von
elf Kurvenformen (`lib/sponsor/sponsor-curve-shapes.ts:36-114`). Die Kurvenformen sind über den
teameigenen Erwartungsanker so normiert, dass **jede Form denselben Erwartungswert liefert**
(`sponsor-liga-leiter.ts:117-138`) — die Wahl verschiebt nur, an welchen Endrängen das Geld liegt.
Dazu kommen:

- **Vorschuss** (zweite Wahldimension): 35 % des Leiterbodens bei Unterschrift, 5 % Gebühr, am
  Saisonende verrechnet (`sponsor-v3-model.ts:112-127`). Im Save haben ihn 10 von 32 Verträgen
  (18–26 C je Team, als `v4_advance`-Logs gebucht).
- **Zufallsereignisse während der Saison**: pro Spieltag und Vertrag 12 % Chance auf ein Event —
  Aktivierungs-Bonus (+3 bis +5 C), Klausel-Malus (−1,5 bis −3 C) oder Partner-Reibung (−2 C),
  sofort verrechnet (`lib/sponsor/sponsor-event-service.ts:29-110`). Gemessen in Saison 2 bisher:
  54 Events, Netto **−23 C** über die Liga — überwiegend unerklärte Abzüge.
- **Mehrjahresverträge**: Laufzeit 1/2/3 je Slot gewürfelt (`sponsor-tier-pool.ts:282-320`), der
  Wertungsanteil erodiert in Folgesaisons (`getSponsorTermMultiplier`,
  `lib/sponsor/sponsor-negotiation.ts:39-47`) und koppelt an den neuen Salary Factor
  (`rerollSponsorV3TermsForNewSeason`, `lib/sponsor/sponsor-v3-offer-service.ts:260-287`).
- **Rarität** skaliert seit V3 nicht mehr den Etat, sondern nur die Hebelgröße des Ziels
  (G = 12/16/20/24 C, `sponsor-v3-model.ts:83-85`) — auf der Karte wirkt sie aber weiterhin wie
  eine Wertigkeitsstufe (Diablo-Lootfarben, `sponsor-curve-shapes.ts:152-158`).

### 2.3 Welche Bonus-/Extraziele gibt es, und woran hängen sie?

Der alte Katalog aus 27 Bonus- und 6 Golden-Zielen ist seit 2026-08 **nicht mehr erzeugbar** —
jedes neue Angebot trägt höchstens eine der fünf **Zielachsen** (`wachstum`, `ausbau`,
`soliditaet`, `entwicklung`, `kaderpflege`; Definitionen in
`lib/sponsor/sponsor-v4-axes.ts:207-348`). Die Auswertung des Altkatalogs bleibt aber vollständig
bestehen, weil unterschriebene Verträge die Schlüssel noch tragen
(`lib/sponsor/sponsor-objective-evaluator.ts:27-44`) — der Live-Save enthält 10 solcher
Altverträge mit `goalP = 0,45` und G = 6–9 C.

Die Achse ist mit fix `p = 0,5` bepreist (`SPONSOR_V4_AXIS_PBAR`, `sponsor-v3-model.ts:95`):
der Vertrag zieht **immer** `0,5·G` ab und zahlt `Erfüllung·G` zurück. Wer voll erfüllt, gewinnt
`G/2` (6–12 C); wer verfehlt, verliert `G/2`. Dieser „Sockelabzug" ist die zentrale Mechanik —
und er steht auf der Karte nur als Nebensatz („Sockelabzug −8 C", Anzeige
`components/foundation/sponsor/SponsorOfferCardNewLook.tsx:444-455`).

### 2.4 Was sieht der Spieler, was passiert unsichtbar?

Eine einzelne Angebotskarte (`SponsorOfferCardNewLook.tsx`) zeigt übereinander: Kartenname und
Kurvenformname, „EV-neutral"-Etikett, Nachfrageprofil, Markenname, Flavour-Text, Raritäts-Pill,
Modul-Chip („3 Module"), gegebenenfalls Golden-/Challenge-/„Bestes Cash-Angebot"-Badges,
Laufzeit-Chip, bei Mehrjahresverträgen einen aufklappbaren Ausblick je Vertragsjahr (`:332-391`),
den V3-Block mit fünf bis sieben Zahlenzeilen — garantierter Boden, Titelwert, Erwartungsanker
samt Risiko-Streuung, Sonderziel samt Sockelabzug, Vorschuss samt Gebühr, Spanne min–max
(`:419-475`) —, darunter den Erwartungswert (`:477-488`), die Gewinnstufen-Kachel mit
aufklappbarer 9-Sprossen-Leiter und die Sonderziel-Kachel (`:490-596`). Das sind rund **zwanzig
Zahlen und Etiketten pro Karte, mal fünf Karten**, plus darüber ein gestapeltes Vergleichs-Chart
und die Board-Ziel-Liste (`FoundationSponsorsNewLook.tsx:1063-1138`).

Unsichtbar bleibt ausgerechnet das Wichtigste:

- **Der Zielfortschritt.** Ohne Analytics Room gibt es während der Saison keinerlei Anzeige, wie
  die Achse steht — `buildAnalyticsSponsorAxisLive` liefert bei Gebäudestufe 0 `null`
  (`lib/facilities/analytics-live-progress.ts:266`). Der Spieler erfährt in der Saisonabrechnung
  zum ersten Mal, ob sein Ziel erreicht wurde.
- **Dass alle fünf Karten denselben Erwartungswert haben.** Die Zahl steht auf jeder Karte, aber
  nirgends steht der Satz, dass sie überall gleich ist — der Spieler vergleicht fünf Karten
  entlang von Zahlen, die sich nicht unterscheiden können.
- **Die Event-Abzüge.** „Partner-Reibung — Malus verrechnet" erscheint in der Timeline, ohne dass
  der Spieler je etwas getan oder unterlassen hätte, das sie auslöst (reiner Würfelwurf,
  `sponsor-event-service.ts:43-50`).

---

## 3. Messung am echten Spielstand

Alle Zahlen aus `new-game-1785823388048-1hf25q` (Kopie vom Live-Server, Saison 2, Spieltag 4 von
10, Salary Factor 1,19). Messskripte: temporär unter `scripts/`, nach der Messung gelöscht;
Vorgehen wie in `docs/analyse/sponsor-achsen-messung.md` (Auswertung ausschließlich gegen die im
Save eingefrorenen Verträge).

### 3.1 Das Angebot, das Chris real gesehen hat (Team S-C, Saison 2)

| Slot | Marke | Karte | Achse | Kurve | Laufzeit | Vorschuss | Platz 1 | Platz 16 | Platz 32 | EV |
|---|---|---|---|---|---|---|---:|---:|---:|---:|
| 0 | WDR Sportpartner | Basis | — | meisterschale | 1 | — | 87,7 | 66,6 | 59,0 | 63,8 |
| 1 | Leica Kamera | Achse | Solidität | koenigsklasse | 1 | 20,6 C | 88,8 | 66,7 | 58,8 | 63,8 |
| 2 | RTL Deutschland | Achse | Entwicklung | conference | 3 | — | 76,6 | 70,4 | 54,3 | 63,8 |
| 3 | Axel Springer | Achse | Frische | sicherheit | 3 | — | 68,6 | 65,5 | 58,9 | 63,8 |
| 4 | ProSiebenSat.1 | Achse | Kaderwert | aufsteiger | 1 | 18,7 C | 70,8 | 68,2 | 53,5 | 63,8 |

Fünf Karten, ein Erwartungswert. Auf dem realistischen Rangbereich von S-C (Startrang 19, ±4
Ränge Streuung) liegen die Leitern um wenige C auseinander; nur an Rängen, die S-C kaum erreicht,
öffnet sich die Schere auf bis zu 20 C. **Chris hat die Basis-Karte unterschrieben — die einzige
ohne Ziel.** Das ist die rationale Antwort eines Spielers auf ein Zielsystem, dem er nicht traut,
und der stärkste einzelne Beleg im Save für die Meldung.

### 3.2 Die 32 Verträge der laufenden Saison

20 Achsenkarten, 2 Basis-Karten, 10 Altverträge (Karte „Sonderziel" aus Saison 1, gerollt).
Achsenverteilung: **12× Ausbau**, je 2× Kaderwert, Entwicklung, Solidität, Frische. Stand
Spieltag 4 (per `evaluateSpecialComponentStage`, also exakt der Settlement-Rechnung):

| Achse | Verträge | Stand |
|---|---:|---|
| Ausbau (2 Stufen bauen) | 21 (12 Achsenkarten + 9 Altverträge) | **19× 0 %**, 1× 50 %, 1× 100 % |
| Kaderwert (+12 %) | 2 | 2× **100 %** — Rohwerte +51,97 % und +94,8 % |
| Frische (90 % frisch) | 2 | 2× 100 % (Stand jetzt; Fatigue kommt erst noch) |
| Solidität (+110 C) | 2 | 8 % und 0 % (eines steht bei −74,5 C) |
| Entwicklung (20 Spieler) | 3 | 3× 0 % — bauartbedingt, siehe unten |

Drei Muster, alle schlecht: **Ausbau** wird nach der Unterschrift schlicht nicht mehr gespielt —
die KI baut in der Preseason, die Baseline friert bei Angebotserzeugung ein, danach passiert
nichts mehr (vgl. schon `sponsor-v4-axes.ts:253-260`: in der Messsaison hat kein einziges Team
die Achse unterschrieben; jetzt hängen 21 Verträge daran, und 19 davon stehen bei null).
**Kaderwert** ist in Saison 2 trivial voll: +52 % und +95 % gegen ein Ziel von +12 % — die
Marktwerte wachsen von selbst um ein Mehrfaches des Ziels, die Achse ist eine Formalie mit
umgekehrtem Vorzeichen zur Saison-1-Messung (dort −29,9 % im Schnitt, Methodenwechsel-Effekt,
`sponsor-v4-axes.ts:215-244`). **Entwicklung** zählt `playerProgressionEvents`, die erst mit der
Saisonend-Progression entstehen — der Fortschritt ist während der ganzen Saison konstruktionsbedingt
0, eine Live-Anzeige würde zehn Spieltage lang „0 von 20" zeigen.

### 3.3 Die Zielbilanz über zwei Saisons — der Kernbefund

Saisonend-Abrechnung Saison 1 (`sponsorPayoutLogs`, 167 Zeilen):

| Zeile | Anzahl | Summe |
|---|---:|---:|
| Saisonbasis | 32 | +1 344,8 C |
| Tabellenplatz | 31 | +733,4 C |
| **Sonderziel** | **27** | **−89,7 C** |

**Alle 27 Sonderziel-Zeilen sind negativ**, und zwar exakt auf dem vollen Sockelabzug −p·G
(−2,7 / −3,4 / −4,0 / −4,5 C): jede einzelne Erfüllung war 0. Kein Team der Liga — auch kein
KI-Team — hat in Saison 1 irgendein Sponsorziel auch nur teilweise erreicht. Die
Settlement-Vorschau für Saison 2 (Stand Spieltag 4) wiederholt das Bild: 30 Zielzeilen, davon 6
positiv, Summe **−114,4 C**. Am Ziel hängen je Vertrag nur ±3 bis ±10 C — gegen ~65 C Leiterwert
ist selbst der Erfolgsfall kaum spürbar, der Regelfall (Verfehlen) aber ein unerklärter Abzug mit
der Abrechnungszeile „verfehlt — Sockelabzug bleibt stehen".

### 3.4 Sponsor-Events

54 Events in 4 Spieltagen: 23× Partner-Reibung (je −2 C), 17× Klausel (−1,5 bis −3 C), 14× Bonus
(+3 bis +5 C); Netto −23 C. Für S-C: null Events — der Spieler mit dem Vertrag sieht in seiner
„Auszahlungs-Timeline" schlicht „Noch keine Sponsor-Events diese Saison."

---

## 4. Diagnose: warum es unübersichtlich ist und „nicht funktioniert"

1. **Die Wahl ist absichtlich folgenlos und sieht gleichzeitig maximal kompliziert aus.** Das
   V3-Modell hat als oberstes Prinzip „Rarity/Karte/Achse skaliert nie den Erwartungswert"
   (`sponsor-v3-model.ts:40-47`). Das war die richtige Antwort auf die Vertragslotterie von V2 —
   aber es bedeutet: acht Zufallsdimensionen (Rarität, Kurvenform, Achse, Vorschuss, Laufzeit,
   Golden, Challenge, Marke) erzeugen fünf Karten, zwischen denen im Erwartungswert exakt nichts
   liegt. Der Spieler soll zwanzig Zahlen je Karte vergleichen, und die einzige vergleichbare
   Zahl ist fünfmal dieselbe. „Macht für mich keinen Sinn" ist die korrekte Beschreibung dieser
   Konstruktion.

2. **Die Ziele sind in der gelebten Praxis eine Strafgebühr.** 0 von 27 erreicht in Saison 1,
   24 von 30 negativ in Saison 2 (Abschnitt 3.3). Die Ursachen sind je Achse verschieden
   (nicht bespielter Ausbau, trivialer Kaderwert, bauartbedingt unsichtbare Entwicklung), aber
   das Ergebnis ist immer dasselbe: die Zeile „Sockelabzug bleibt stehen". Ein Spieler, der das
   zweimal gesehen hat, meidet Zielkarten — genau das hat Chris getan (Basis-Karte).

3. **Der Spieler kann die Ziele weder verfolgen noch beeinflussen.** Ohne Analytics Room keine
   Fortschrittsanzeige (`analytics-live-progress.ts:266`); die Entwicklungs-Achse hat während der
   Saison prinzipiell den Stand 0; die Ausbau-Baseline friert vor dem Bauen ein. Zwei der fünf
   Achsen können also gar nicht „gespielt" werden, und bei den übrigen erfährt man das Ergebnis
   erst, wenn nichts mehr zu steuern ist.

4. **Die Sprache ist Modell-Jargon.** „Sockelabzug", „Erwartungsanker", „EV-neutral", „Risiko
   ±9,6", eine Rarität, die kein Geld mehr bedeutet, elf Kurvennamen für Verteilungen, die auf dem
   realistischen Rangbereich fast identisch zahlen. Dazu zwei falsche Texte an prominentester
   Stelle: „Drei Angebote pro Saison" (es sind fünf) und „Klassisches Sponsormodell" (der Save
   läuft auf dem neuesten Modell) — beides `FoundationSponsorsNewLook.tsx:916` bzw. `:924-934`.

5. **Zufalls-Maluse ohne Handlung.** Die Mid-Season-Events sind reine Würfelwürfe mit negativem
   Liga-Netto. Sie erzeugen genau die Sorte „warum ist mein Geld weg?"-Moment, die ein
   Wirtschaftssystem verständlich zu vermeiden hat.

Kein einzelner dieser Punkte ist ein Bug. Es ist die Summe von drei Umbauten, die jeweils eine
Dimension hinzugefügt und keine entfernt haben. Die Antwort ist deshalb nicht die nächste
Dimension, sondern Subtraktion.

---

## 5. Der Vorschlag: drei Sponsoren, drei Auszahlungskurven über die Zeit

Chris' „verschiedene Kurven" wird hier als **zeitlicher Verlauf der Auszahlung** gelesen — wann
kommt das Geld, nicht an welchem Endrang (die Endrang-Kurven gibt es heute, elffach, und sie sind
Teil des Problems). Damit beantwortet die Wahl zwei echte Spielerfragen: „Brauche ich das Geld
jetzt?" und „Traue ich meiner Saison?" — Fragen, deren Antwort je Team und je Saison anders
ausfällt, sodass es keine dauerhaft richtige Karte gibt.

### 5.1 Die drei Profile

Alle Beträge sind Basiswerte bei Salary Factor 1,0 und skalieren wie heute mit dem Faktor der
Saison (im Live-Save 1,19 — die Mockup-Zahlen in Abschnitt 6 zeigen genau diese skalierte Sicht).
Laufzeit immer **eine Saison**; Mehrjahresverträge, Rarität, Golden-Los, Challenge-Los,
Kurvenformen, Vorschuss-Gebühr und Zufalls-Events entfallen für Neuverträge ersatzlos. Die
Markenvielfalt (Namen, Wappen, Flavour) bleibt — sie ist Schmuck und stört nicht.

**A — „Startkapital" (Geld jetzt, insgesamt am wenigsten).**
25 C bei Unterschrift, 1,5 C je Spieltag (= 15 C), 10 C beim Saisonabschluss.
Gesamt **50 C, garantiert**, davon die Hälfte sofort.
Für wen: klamme Teams, die im Transferfenster handeln oder ein Gebäude bauen wollen, ohne einen
Kredit (7–20 % Zins, `lib/finance/loan-service.ts`) aufzunehmen. Der Preis der Liquidität ist
offen sichtbar: 5 C weniger als die Konstante — weniger als jeder Kredit über 25 C kosten würde.
Ein Satz: *„Die Hälfte sofort — dafür insgesamt am wenigsten."*

**B — „Konstante" (planbar, solide Mitte).**
5,5 C je Spieltag, sonst nichts.
Gesamt **55 C, garantiert**, gleichmäßig über die Saison.
Für wen: Teams, die mit festem Budget planen und keine Überraschung wollen — der Referenzpunkt,
gegen den die anderen beiden sich erklären.
Ein Satz: *„Jeden Spieltag dasselbe."*

**C — „Erfolgsprämie" (wenig unterwegs, das Ende zahlt).**
2 C je Spieltag (= 20 C), Abschlusszahlung **35 C ± 2 C je Platz**, den der Endrang über oder
unter dem Startrang liegt, geklammert auf 15…55 C.
Gesamt **35 bis 75 C**; wer genau seinen Startrang bestätigt, landet bei 55 C — der Konstanten.
Für wen: Teams, die an ihre Saison glauben. Gemessen wird gegen den **eigenen Startplatz**, nicht
gegen die Tabelle an sich — dieselbe Fairness-Idee wie der heutige Sockel nach Startrang
(`sponsor-liga-leiter.ts:56-65`): der Tabellenletzte kann die Prämie genauso ausreizen wie der
Meister, und Absteigen kostet. Damit bleibt genau **ein** rangbezogener Sponsorhebel im Spiel,
klein genug (±2 C je Platz), um dem Preisgeld nicht ins Handwerk zu pfuschen.
Ein Satz: *„Schneide besser ab als dein Startplatz, dann zahlt das Ende."*

Warum die Gesamtsummen bewusst **nicht** gleich sind: Die heutige EV-Gleichheit hat die Wahl
entwertet. 50 / 55 / 35–75 macht die Wahl zu einem echten Tausch — Liquidität kostet, Risiko kann
sich lohnen — und bleibt trotzdem eng genug, dass keine Karte eine Falle ist (die Spanne zwischen
schlechtester und bester Gesamtsumme entspricht ungefähr der heutigen Leiter-Spanne von S-C,
Abschnitt 3.1). Der Liga-Gesamtetat bleibt in der Größenordnung von heute (~65 C je Team bei
Faktor 1,19 gegen gemessene ~65 C aus Basis+Rang in Saison 1, Abschnitt 3.3) — der Vorschlag will
die Struktur ändern, nicht die Geldmenge.

Die drei Profile sind fest — **kein Würfel entscheidet mehr, welche Entscheidungen ein Team
angeboten bekommt.** Jedes Team sieht jede Saison dieselben drei Optionen mit denselben
Relationen; gewürfelt wird nur noch die Marke, die dahintersteht.

### 5.2 Die Ziele: streichen oder eines behalten?

**Variante 0 — ersatzlos streichen.** Die Messung trägt das: null erreichte Ziele in Saison 1,
Netto-Abzug in beiden Saisons, zwei von fünf Achsen prinzipiell unspielbar. Steuerungs-Gameplay
über Ziele existiert im Spiel bereits an anderer Stelle — die Vorstandsziele
(`lib/board/team-season-objectives-service.ts`) sind sichtbar, verständlich formuliert und werden
auf der Sponsorenseite sogar schon zum Abgleich eingeblendet. Was Variante 0 kostet: Der frisch
umgebaute Analytics Room (PR #381) schaltet auf den Stufen 1–3 genau die Live-Anzeige der
Sponsor-Achse frei — fällt die Achse weg, verlieren diese Stufen ihren Gegenstand und das Gebäude
braucht zum zweiten Mal binnen Wochen einen neuen Zweck. Und der Sponsor wird zur reinen
Einnahmezeile ohne jede Interaktion während der Saison.

**Variante 1 — genau ein Ziel, rein positiv, auf allen drei Karten identisch.** Der
**Frische-Bonus**: *„+8 C, wenn am Saisonende mindestens 70 % deines Kaders eine Match-Fatigue
von höchstens 45 haben."* Kein Sockelabzug, kein Malus — verfehlt heißt schlicht: kein Bonus.
Warum ausgerechnet Frische: `kaderpflege` ist die einzige Achse, die in der Messung je
funktioniert hat (Ø 44,3 %, echte Streuung über nicht/teilweise/voll erfüllt,
`docs/analyse/sponsor-achsen-messung.md`), sie ist vom ersten Spieltag an beeinflussbar
(Rotation, Trainingsmodus), ihr Stand ist jederzeit messbar, und sie ist in einem Satz erklärbar.
Warum auf allen drei Karten gleich: damit der Bonus die Kurvenwahl nicht verkompliziert — er ist
eine Saisonaufgabe, keine vierte Vergleichsdimension. Die Grobanzeige („auf Kurs / wackelt")
steht immer auf der Vertragskarte; der Analytics Room verfeinert sie zu Prozent und Ist/Ziel,
statt sie erst freizuschalten — er behält damit seinen Gegenstand, wird aber vom Türsteher zum
Vergrößerungsglas.

**Empfehlung: Variante 1.** Sie erfüllt Chris' Bedingung („wenn überhaupt … wenige, sinnvoll,
verständlich") wörtlich: eines statt fünf, beeinflussbar, unmissverständlich, und die Belohnung
(+8 C auf 50–55 C Grundsumme, ~15 %) ist spürbar, weil ihr kein Abzug gegenübersteht. Variante 0
bleibt die richtige Wahl, falls Chris den Sponsor bewusst auf „nur Geld" reduzieren will — dann
muss aber die Analytics-Room-Frage gleich mit entschieden werden, sonst entsteht dort das nächste
„lohnt sich nicht".

Die 8 C sind bewusst nicht „EV-fair" eingepreist: der Bonus ist als erreichbares Erfolgserlebnis
gedacht, nicht als versicherungsmathematisch neutrale Wette. Wenn die halbe Liga ihn schafft,
ist das kein Kalibrierungsfehler, sondern der Zweck.

---

## 6. Mockup

### 6.1 Die Auswahl (Preseason, Schritt „Sponsor wählen")

Zahlen wie sie der Live-Save zeigen würde (Salary Factor 1,19, Team-Startrang 19). Groß ist auf
jeder Karte die eine Zahl, die sie von den anderen unterscheidet; die Gesamtsumme steht auf allen
drei an derselben Stelle, damit man sie untereinander vergleichen kann. Der Frische-Bonus steht
als gemeinsame Fußzeile **unter** den Karten, nicht auf ihnen — er gehört zur Saison, nicht zur
Wahl.

```
┌─ STARTKAPITAL ──────────────┐  ┌─ KONSTANTE ─────────────────┐  ┌─ ERFOLGSPRÄMIE ─────────────┐
│  Volksbank Arena            │  │  WDR Sportpartner           │  │  Lidl Plus                  │
│                             │  │                             │  │                             │
│         30 C                │  │        6,5 C                │  │       42–89 C               │
│    sofort bei Unterschrift  │  │      je Spieltag            │  │      am Saisonende          │
│                             │  │                             │  │                             │
│  danach 1,8 C je Spieltag   │  │  keine weiteren Zahlungen   │  │  unterwegs 2,4 C je Spieltag│
│  und 12 C zum Abschluss     │  │                             │  │  Abschluss: 41 C, ±2,4 C je │
│                             │  │                             │  │  Platz besser/schlechter    │
│  GESAMT   60 C  garantiert  │  │  GESAMT   65 C  garantiert  │  │  als dein Startplatz (19.)  │
│                             │  │                             │  │  GESAMT   65 C  erwartet    │
│  Die Hälfte sofort — dafür  │  │  Jeden Spieltag dasselbe.   │  │  Besser als Platz 19 =      │
│  insgesamt am wenigsten.    │  │                             │  │  mehr. Schlechter = weniger.│
│  [ Wählen ]                 │  │  [ Wählen ]                 │  │  [ Wählen ]                 │
└─────────────────────────────┘  └─────────────────────────────┘  └─────────────────────────────┘

  Saisonbonus (bei jedem Sponsor gleich): +9,5 C, wenn am Saisonende mindestens 70 % deines
  Kaders frisch sind (Match-Fatigue ≤ 45). Kein Abzug, wenn nicht — nur kein Bonus.
```

Der Verlauf, den die drei Karten meinen, als kumulierte Tabelle (dieselben Zahlen als kleine
Kurvengrafik auf der Seite, eine Linie je Karte):

```
kumuliert erhalten   Unterschrift  MD 2   MD 4   MD 6   MD 8   MD 10   Abschluss
Startkapital              30       33,6   37,2   40,8   44,4   48         60
Konstante                  0       13     26     39     52     65         65
Erfolgsprämie              0        4,8    9,6   14,4   19,2   24       42–89

 STARTKAPITAL                    KONSTANTE                       ERFOLGSPRÄMIE
 90┤                             90┤                             90┤          bester Fall ●
   │                               │                               │                     ╱
 60┤                  ▄▄●        60┤                    ▄▄●      60┤                    ╱
   │ ●▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▀            │            ▄▄▄▄▄▄▄▀           │        erwartet ● ╱
 30┤ ▲                           30┤     ▄▄▄▄▄▀                  30┤                 ╱╱● schlechtester
   │ │ startet hoch                │ ▄▄▄▀                          │ ▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▀    Fall
  0┼─┴───────────────────         0┼─────────────────────         0┼─────────────────────
   Start   Spieltage   Ende        Start   Spieltage   Ende        Start   Spieltage   Ende
   30 sofort, flach danach         eine gerade Linie               flach — der Sprung am Ende
                                                                   hängt am Endrang (42–89)
```

Was gegenüber heute von der Karte **verschwindet**: Rarität, Kurvenformname, Nachfrageprofil,
Modul-Chip, Golden-/Challenge-Badge, Laufzeit-Chip, Erwartungsanker, Risiko-Streuung,
Sockelabzug, Vorschuss-Gebühr, die 9-Sprossen-Gewinnstufen-Leiter und das Vergleichs-Chart.
Was bleibt: Marke, Wappen, drei bis vier Zahlen, ein Satz.

### 6.2 Während der Saison (Sponsorenseite, aktiver Vertrag)

```
┌─ AKTIVER VERTRAG ───────────────────────────────────────────────────────────┐
│  WDR Sportpartner · Konstante · 6,5 C je Spieltag                           │
│                                                                             │
│  Bisher erhalten   26 von 65 C     ▓▓▓▓▓▓▓▓░░░░░░░░░░░░  (4/10 Spieltage)   │
│  Nächste Zahlung   6,5 C am 5. Spieltag                                     │
│                                                                             │
│  Saisonbonus Frische   auf Kurs — 78 % frisch (Ziel: 70 % am Saisonende)    │
│                        └ mit Analytics Room: exakter Stand je Spieltag      │
└─────────────────────────────────────────────────────────────────────────────┘
```

Jede Spieltagszahlung erscheint als Zeile in der bestehenden Auszahlungs-Timeline (die heute die
Zufalls-Events zeigt, `FoundationSponsorsNewLook.tsx:1040-1061`) — die Timeline bekommt damit
zum ersten Mal planbaren Inhalt. Bei der Erfolgsprämie steht zusätzlich eine Zeile
„Abschluss Stand jetzt: 46 C (Platz 17, +2 über Start)", gerechnet aus dem aktuellen Rang —
dieselbe Zahl, die das Settlement am Ende zahlt, nur früher gezeigt.

---

## 7. Der Umstellungsweg: kein Eingriff in alte Spielstände

Die Umstellung kommt **ohne Migration** aus, weil das System dafür gebaut ist:

1. **Bestehende Verträge rechnen unverändert ab.** Jeder unterschriebene Vertrag trägt seine
   vollständigen, eingefrorenen Konditionen im `sponsorV3`-Block; das Settlement liest
   ausschließlich daraus (`sponsor-settlement-service.ts:102-107`). Es gibt einen direkten
   Präzedenzfall: Als der 27+6-Zielkatalog abgeschafft wurde, blieb seine **Auswertung**
   vollständig bestehen, damit kein Altvertrag stillschweigend auf `fraction = 0` fällt
   (`sponsor-objective-evaluator.ts:27-44`). Genau so hier: der V3-Settle-Pfad bleibt, solange
   ein Vertrag ohne neues Konditionsformat existiert.
2. **Neue Karten gibt es erst mit der nächsten Angebotserzeugung.** Angebote werden je Saison nur
   für Teams ohne laufenden Vertrag neu gebaut (`ensureSeasonSponsorOffers`,
   `sponsor-offer-service.ts:361-388`). Ein Update mitten in der Saison ändert also für niemanden
   den laufenden Vertrag; die drei neuen Karten erscheinen zum nächsten Saisonstart. Ungewählte
   Alt-Angebote desselben Saisonstarts sollten beim Update einmalig neu erzeugt werden — das ist
   der bestehende `regenerateSponsorOffersForSeason`-Pfad (`:321-359`), kein neuer Mechanismus.
3. **Mehrjahres-Altverträge laufen aus, statt migriert zu werden.** Im Live-Save betrifft das
   10 Verträge (Rest-Laufzeit 1–2 Saisons); sie rollen wie bisher über
   `rerollSponsorV3TermsForNewSeason` und sind spätestens zum Start von Saison 4 Geschichte. Bis
   dahin existieren beide Vertragsarten nebeneinander — das Settlement unterscheidet pro Vertrag
   am Konditionsformat, nicht am Spielstand.
4. **Die Spieltagszahlung braucht einen Haken im Spieltags-Abschluss — der existiert.** Die
   Zufalls-Events buchen heute schon beim Matchday-Advance Cash direkt auf `team.cash` und
   dokumentieren sich selbst (`sponsor-event-service.ts:21-27`, `:96-109`); die
   `sponsorPayoutLogs` deduplizieren bereits nach Phase (`sponsor-settlement-service.ts:41-45`)
   und nehmen eine zusätzliche Phase `matchday` ohne Formatänderung auf. Alte Saves, die nie eine
   solche Zeile enthalten, bleiben gültig — fehlende Logs bedeuten schlicht „nichts gezahlt".
5. **Der Ablauf-Schritt bleibt.** `choose_sponsor` im Preseason-Flow
   (`lib/foundation/game-flow-controller.ts:482-495`, Pflicht vor Saisonabschluss `:688-694`)
   zeigt einfach die neuen Karten; am Flow ändert sich nichts.

Aufzuräumen sind beim Umbau die zwei falschen Texte aus Abschnitt 2.1 („Drei Angebote pro
Saison" stimmt dann wieder; das Regelwerk-Badge muss die neue Fassung kennen) und die
KI-Angebotswahl (`chooseSponsorOfferForAiTeams` / `scoreOfferForAi` in
`sponsor-offer-service.ts`), die statt Achsen-Scores künftig Kassenstand gegen Kurvenprofil
abwägt — für die KI ist „nimm Startkapital, wenn die Kasse unter X liegt, sonst Konstante oder
Erfolgsprämie nach Selbsteinschätzung" sogar deutlich einfacher zu begründen als das heutige
Scoring.

Ein sauberer Weg ohne Migration existiert also; die einzige echte Übergangs-Unschönheit ist die
gemischte Liga für ein bis zwei Saisons (Liga-Sponsorenübersicht zeigt alte und neue
Vertragsformen nebeneinander).

---

## 8. Was dagegen spricht

**Das Spiel verliert seine Sponsor-Lotterie — und die hatte Charme.** Raritäts-Lootfarben,
Golden-Los, elf Kurvennamen, der Challenge-Sponsor: das war ein bewusst „Diablo-artiger" Moment
je Saison. Nach dem Umbau sieht jedes Team jede Saison dieselben drei Profile; nur die Marke
wechselt. Wer die Sammel- und Überraschungsseite des Systems mochte, verliert sie ersatzlos.
Möglich, dass sich die Wahl nach drei Saisons „auswendig gespielt" anfühlt (klamm → A, stabil →
B, ambitioniert → C) — die Gegenthese ist, dass Kassenlage und Selbsteinschätzung sich jede
Saison ändern und die Wahl deshalb lebendig bleibt. Geprüft hat das niemand.

**Die ungleichen Gesamtsummen sind eine Armutssteuer-Falle.** Wer knapp bei Kasse ist, *muss*
Startkapital nehmen und bekommt strukturell 5 C weniger als reiche Teams — Saison für Saison.
Der Betrag ist klein und billiger als jeder Kredit, aber der Mechanismus belohnt Reichtum. Die
heutige EV-Gleichheit hatte genau dieses Problem nicht; sie war nur eben auch keine Entscheidung.

**Die Erfolgsprämie führt wieder einen zweiten Rang-Topf ein.** Das Preisgeld zahlt bereits nach
Endrang; ±2 C je Platz gegen den Startrang ist ein zweiter, kleiner Rang-Hebel. Er ist bewusst
winzig gegen den heutigen Wertungstopf, aber die Trennung „Sponsor zahlt fürs Dasein, Preisgeld
für Leistung", die der Ligaleiter-Umbau anstrebte, wird wieder aufgeweicht.

**Der Analytics Room verliert zum zweiten Mal Substanz.** Stufen 1–3 wurden gerade erst (PR
 #381) auf „schaltet die Sponsor-Achsen-Anzeige frei" umgebaut. Variante 1 degradiert das Gebäude
vom Türsteher zum Vergrößerungsglas einer ohnehin sichtbaren Grobanzeige; Variante 0 nimmt ihm
den Gegenstand ganz. Wer diesen Vorschlag umsetzt, muss die Analytics-Frage im selben Zug
beantworten, sonst ist der nächste „lohnt sich nicht"-Report programmiert.

**Es stirbt viel frisch gebauter Code.** Achsen-Engine, Vorschuss-Mechanik, Laufzeit-Würfel,
Erosions- und Kopplungslogik für Mehrjahresverträge, Event-Service, Kurvenform-Normierung — fast
alles davon ist 2026 entstanden, gemessen kalibriert und getestet. Der Vorschlag erklärt einen
Großteil davon für Neuverträge zu totem Gewicht (lebendig bleibt es nur für auslaufende
Altverträge). Das ist ehrlich gesagt der dritte Sponsor-Umbau in kurzer Zeit, und auch dieses
Konzept kann nicht garantieren, dass es der letzte ist.

**Zehn kleine Zahlungen erzeugen Rauschen.** Die Spieltagsrate schreibt je Team zehn
Cash-Ereignisse pro Saison in Timeline und Finanzhistorie. Das macht den Verlauf sichtbar (der
Zweck), aber es verwässert auch die Finanzübersicht — und mit laufendem Sponsor-Einkommen
verliert das Kreditsystem seinen häufigsten Anwendungsfall (Liquidität bis zum Saisonende), was
dessen Balance still verschiebt.

**Zwei ungeprüfte Annahmen tragen den Entwurf.** Erstens die Deutung von „verschiedene Kurven"
als Zeitverlauf — Chris könnte ebenso die Endrang-Kurven gemeint haben („Titeljäger vs.
Klassenerhalt", nur eben drei statt elf). Der Entwurf hält dagegen: drei Endrang-Kurven mit
gleichem Erwartungswert wären exakt das heutige System minus Dekoration, und dessen
Belanglosigkeit ist gemessen (Abschnitt 3.1). Trotzdem: wenn Chris die Rang-Kurven meinte, ist
Abschnitt 5.1 neu zu schreiben; Diagnose (4) und Zielvorschlag (5.2) bleiben davon unberührt.
Zweitens die Gesamtsummen-Kalibrierung (50/55/35–75 bei Faktor 1,0): sie ist an den gemessenen
Ist-Werten geankert (Anker 63,8 bei Faktor 1,19), aber nicht durchgespielt — ob 5 C Abstand
zwischen A und B die Liquiditätsfrage richtig bepreist und ob ±2 C je Platz die Erfolgsprämie
weder zur Pflicht noch zur Falle macht, muss ein Balancing-Lauf zeigen, bevor die Zahlen in den
Katalog gehen.
