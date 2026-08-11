# Sponsoren-Rework — Bauvorlage

Stand: 2026-08-11 (zweite Fassung) · Status: **abgenommen, Umsetzung freigegeben.**

> **Lies zuerst Abschnitt −1.** Er trägt acht Entscheidungen von Chris, die Teile der Vorlage
> umkehren — unter anderem fällt der 60-%-Leih-Abzug ersatzlos weg, die Rarität wird zum
> Umwandlungskurs, Einnahmegebäude sind wieder verleihbar, es bleibt bei fünf Angeboten statt
> drei, und die Abnutzung der Gebäude wird Teil von Leihe und Übernahme.

Dieses Dokument macht aus vier bisher nebeneinander stehenden Quellen EINE widerspruchsfreie
Vorlage:

| Quelle | Was sie beiträgt | Rang bei Widerspruch |
|---|---|---|
| **Q1** `docs/sponsor-rework-umsetzungsplan.md` | die gemessenen Lehren (Fallen, EV-Parität, Kalibrierregeln, Migrationstechnik) | liefert **Methoden**, nicht mehr die Architektur |
| **Q2** Chris' Vereinfachungs-Wünsche (wörtlich zitiert unten) | die **Richtung**: 3 Karten, Kurven, wenige Ziele, Stufen-Übersicht, Auszahlung am Ende | **entscheidet die Richtung** |
| **Q3** PR #490 (`docs/SPONSOREN_GEBAEUDE_KONZEPT.md`, Branch `claude/sponsoren-gebaeude-konzept`) | die Gebäude-Leih-Mechanik (Rangmarke, Leih-Leiter, Übernahme, Branchenkette) | liefert die **Mechanik**, nicht die Zahlen |
| **Q4** Balancing-Messung am Live-Save, Saison-2-Ende, 32 Teams (Zahlen im Auftrag zu dieser Vorlage; Save-Beschaffung siehe CLAUDE.md, `live-save`-Branch) | die verbindlichen **Zahlen** | **schlägt alle älteren Annahmen** |

Auflösungsregel, überall gleich angewandt: **Chris entscheidet, was gebaut wird; Q4 entscheidet,
mit welchen Zahlen; Q3 liefert die Mechanik, wo Chris sie will; Q1 liefert die Bau- und
Messtechnik.** Jeder einzelne aufgelöste Widerspruch steht in Abschnitt 8.

Ist-Zustand als Delta-Basis (gemessen am Code auf `main`, `lib/sponsor/`, 24 Dateien, 7166 Zeilen):
5 Angebote je Team (`SLOT_COUNT = 5` in `sponsor-offer-service.ts`), 11 Kurvenformen
(`sponsor-curve-shapes.ts`), je Angebot 2–3 `components` plus 2–4 `moduleIds`, dazu Rarity,
Golden-Los, Vorschuss, Laufzeit-Würfel, fünf Zielachsen und ein Challenge-Slot. Das ist Chris'
„total unübersichtlich".

---

## −1. Entscheidungen vom 11.08. — diese Fassung schlägt alles Folgende

Nach der Abnahme-Prüfung hat Chris acht Punkte präzisiert oder umgekehrt. **Wo unten etwas anderes
steht, gilt dieser Abschnitt.** Die überholten Stellen sind einzeln benannt, damit niemand gegen die
alte Fassung baut.

| # | Entscheidung | Was unten hinfällig wird |
|---|---|---|
| **E1** | **Kein Abzug — zwei Sorten Sponsor.** Nicht eine Karte mit Abschlag, sondern: viel Cash pur, oder weniger Cash plus Gebäude. Chris: „Teams nehmen bewusst in kauf weniger cash zu bekommen um gute gebäude zu leihen." | §1 (Abzugszeile), §2, §4.2 komplett, §6 Schritt 2 Fixpunkte, §8 W3 |
| **E2** | **Die Rarität IST der Kurs.** Vier Stufen in der Reihenfolge gewöhnlich → magisch → selten → legendär, Umwandlung **1,4 · 1,8 · 2,3 · 3,0** (Enden von Chris gesetzt, Zwischenstufen geometrisch). Der Kurs ändert nicht die Höhe der Zahlung, sondern wie viel Gebäude man für denselben Verzicht bekommt. | §1 („Rarity-Farbe entfällt"), §5.1 |
| **E3** | **Gerechnet wird rückwärts.** Die Karte bietet eine konkrete Gebäudestufe an, daraus folgt der Preis: `Verzicht = Leihwert(Stufe) / Kurs`. Nie umgekehrt — sonst kommt ein Betrag zwischen zwei Stufen heraus, mit dem niemand etwas anfangen kann. Basis ist der **Leihwert je Saison**, nicht die Katalog-Baukosten. | §4.2 |
| **E4** | **Einnahmegebäude sind wieder verleihbar.** Fan Shop und Arena bleiben drin. Chris: „Wenn man zb nen sponsor bekommt der einem nen fan shop leiht ist das ja quasi auch free money." Dass der Shop sich selbst trägt, ist der Reiz, nicht das Schlupfloch — der Ertrag steckt bereits im Leihwert und damit im Preis, und die Rangmarke macht ihn bedingt. Auflage: bei Einnahmegebäuden auf den **erwarteten Saisonertrag** rechnen statt auf die Leihwert-Formel (Fan Shop identisch, Arena nicht). | §0 Invariante 4, §4.3, §8 W4 |
| **E5** | **Negative Margen sind gewollt — der Rubberband der Liga.** Chris: „wenn die teams overspenden bei den gehältern ist das gewollt. dann müssen sie in folgejahren mit den problemen leben! … schwache teams können auch mal entspannt durch segeln und top teams müssen sehr auf ihren spend achten." Die Sponsorhöhen bleiben unangetastet. Bezahlbarkeit ist **kein** Freigabekriterium mehr — sie bleibt reine Information auf der Karte. Und: **keine Sperre**, keine bevormundende Warnung. Wer knapp ist, darf trotzdem zugreifen und über Verkäufe oder Kredit gegenfinanzieren. | §6 Schritt 9 („kein Team unter 0 gezwungen"), §7.5 |
| **E6** | **Keine Migration.** Chris startet mit den Sponsoren ein neues Spiel. Rückwärtskompatibilität ist keine Freigabebedingung mehr; alte Saves sollen laden können, ohne dass Sonderpfade für Altformate gebaut und getestet werden. | §5.2 und §5.3 komplett, §6 Schritt 4 Wächter-Kante, Schritt 5 Altvertrags-Regression |
| **E7** | **Abnutzung ist Teil der Leihe** — und existiert bereits im Code (`lib/facilities/facility-condition.ts`): Neuzustand 100, Verfall 8 je Saison bei bezahltem Unterhalt (22 unbezahlt), volle Wirkung bis 70, darunter linear fallend, bei 0 zählt das Gebäude als Stufe 0. Chris will den Zustand als **Vertragsvariable**: derselbe Gebäudetyp auf derselben Stufe kann neu oder gebraucht verliehen werden — zwei Karten, gleiche Stufe, verschiedener Wert, ohne eine neue Zahl zu erfinden. Und der **Übernahmepreis richtet sich nach dem Zustand**: `(Katalogkosten − angerechneter Leihwert) × Zustand/100`. Die Aufstiegsstufen selbst kosten unverändert immer gleich viel. Die Folgelast gehört sichtbar auf die Karte: nach der Übernahme zahlt der Käufer den Unterhalt, und wer ihn nicht zahlt, verliert 22 statt 8 Punkte je Saison. | neu — §4.5 ergänzen |
| **E8** | **Wieder fünf Angebote statt drei.** Chris: „wenn wir dann wieder genug verschiedene möglichkeiten haben lohnen auch wieder die 5 statt 3 sponsoren." Nicht die Zahl war das Problem, sondern was auf den Karten stand: fünf Karten mit je 2–4 aufgesetzten Modulen und elf Kurvenformen. Mit klarer Unterscheidung (Cash gegen Gebäude, Rarität als Kurs, Zustand als Güte) sind fünf eine Auswahl statt eines Rätsels. **Auflage aus der Messung:** die fünf müssen die Preisspanne abdecken. Zwölf von 32 Teams können nur die reine Cash-Karte bezahlen — ein Slate aus fünf teuren Karten wäre für die halbe Liga eine Scheinauswahl. Mindestens eine Karte ohne Verzicht und eine gewöhnliche Gebäude-Karte im unteren Preisband gehören immer dazu. | §7 W8, §1 („drei Karten"), §6 Schritt 4 |

**Ebenfalls entschieden, von Chris an Fable delegiert:** Die Gewinnkurven **variieren nicht**. Feste,
unterscheidbare Formen je Cash-Karte (flach / mittel / steil); Gebäude-Karten tragen gar keine Kurve.
Begründung: drei stabile Formen kann ein Spieler lernen, einen Würfel darauf nicht — und die
Fallenfreiheit (Q1: 6–7 von 11 Kurven waren Fallen) müsste sonst je Wurf garantiert werden statt einmal.

**Ebenfalls korrigiert:** Die Übernahmeformel aus §4.5 („Katalogkosten − gezahlte Abzüge") hat unter
dem Kurs-Modell einen Konstruktionsfehler — je seltener die Karte, desto weniger Verzicht wurde
gezahlt, desto teurer die Übernahme. Die beste Karte bekäme den schlechtesten Preis. Richtig ist die
Anrechnung dessen, was der Sponsor **bereitgestellt** hat: `Katalogkosten − Σ Leihwert der gehaltenen
Saisons`, raritätsunabhängig, danach mit dem Zustand aus E7 multipliziert.

**Der 19-%-Einbruch (bisher §6 Schritt 0 und §7.1) ist aufgeklärt und damit erledigt.** 371,3 C davon
waren eine Einmal-Reparaturbuchung aus Saison 1. Dabei kam ein aktives Leck zutage: Mehrjahres-Verträge
ohne Kurvenform behielten beim Saisonwechsel ihren eingefrorenen Gehaltsfaktor, 10 von 32 Verträgen
steckten auf 1,0 fest statt auf 1,19 — zusammen 129,6 C zu wenig, und der Fehler entstand bei jedem
Saisonwechsel neu. Behoben in `rerollSponsorV3TermsForNewSeason`.

---

## 0. Invarianten — nicht verhandelbar

1. **Sponsorgeld und Gehaltsabzug werden NIEMALS entkoppelt.** Beides bucht heute im selben
   Saisonende-Settlement (`salary_deduct` in `applySponsorSettlement`,
   `sponsor-settlement-service.ts`). Q4: Gehälter fressen S1 81 %, S2 98,7 % des Sponsorgeldes;
   Sponsorgeld ist ~95 % des Liga-Einkommens und faktisch die Gehaltskasse. Jede Änderung, die
   Sponsorgeld unterjährig verteilt, riss diese Kasse auf. Deshalb entfällt auch #490s
   „Gehalt je Spieltag in zehn Raten" ersatzlos (Widerspruch W1, Abschnitt 8).
2. **Anzeige == Settlement.** Alle Beträge werden bei Unterschrift in den Vertrag eingefroren
   (heute: `sponsorV3`-Block, `lockedRankPayoutLadder`); das Settlement liest nur noch ab. Das
   bleibt exakt so — auch der neue Leih-Abzug steht als eingefrorene Zahl im Vertrag.
3. **Bestandsverträge rechnen nach altem Recht.** Präzedenzfall existiert zweifach im Code:
   der entfernte 27+6-Zielkatalog wird für Altverträge weiter ausgewertet
   (`sponsor-objective-evaluator.ts`), die entfernte Verhandlungs-Achse weiter gelesen
   (`sponsor-negotiation.ts`, Shim).
4. **Kein Preisloch bei Einnahmegebäuden.** Q4: ein geliehener Fan Shop L3 erzeugt echtes Cash
   (11,7 C/Saison, Katalog); bei 50 % Abzug druckt die Karte risikofrei +5,8 C/Saison.
   Einnahmegebäude (Fan Shop, Arena Upgrade) bekommen den Effektgebäude-Rabatt **nicht** —
   Konsequenz in Abschnitt 4: sie werden gar nicht verliehen.
5. **Ziele nie utopisch.** Q2: „passend zu dem was das team ggf. auch leisten kann". Jede
   Ziel-Latte wird relativ zur eigenen, bei Unterschrift eingefrorenen Ausgangslage gesetzt,
   nie absolut gegen die Liga. Verfehlen kostet nie Geld (Lehre aus „0 von 27 Zielen erreicht,
   −89,7 C Zielbilanz" in Saison 1, gemessen in #490).

---

## 1. Was gebaut wird — die drei Karten

> Q2: „ich möchte sponsor ändern bitte wieder nur 3 zur auswahl und einfach nur mit
> verschiedenen kurven oder so"

Jedes Team bekommt je Saison **genau drei Angebote** (Q4: „DREI Slots, nicht fünf"). Die drei
Karten sind **feste Archetypen** — nicht gewürfelt, nur die Marke (und damit das Gebäude)
variiert. Jede Karte hat ihre eigene Kurvenform; das ist Chris' „verschiedene Kurven", und mehr
Würfel gibt es über die Struktur nicht.

| | **Der Geldgeber** | **Der Ausstatter** | **Der Baumeister** |
|---|---|---|---|
| Laufzeit | 1 Saison | 2 Saisons | 3 Saisons |
| Kurve | „Sicher" — hoher Boden, flach (Referenzform `klassenerhalt`) | „Ausgewogen" — Mitte (Referenzform `aufsteiger`) | „Steil" — größter Ausschlag nach oben (Referenzform `titeljaeger`) |
| Gebäude | keins — volles Geld | geliehen, Stufe 2 → 3 | geliehen, Stufe 2 → 3 → 4, mit Übernahmerecht |
| Leih-Abzug | 0 | 60 % des Leihwerts je Saison (Q4-Zahl, Abschnitt 4) | 60 % des Leihwerts je Saison |
| Rangmarke | keine | mild: ein 4er-Block **unter** dem Startblock | hart: der eigene Startblock |
| Bonus-Ziel | keins | eines (Frische oder Achsen-Rang, Abschnitt 3) | eines |

Alle drei Karten zahlen aus **derselben Liga-Leiter** (Sockel nach Startrang + Wertungstopf nach
Endrang, `sponsor-liga-leiter.ts` — bleibt unverändert), ankernormiert auf denselben
Erwartungswert am Startrang. Die drei Kurvenformen kommen aus dem **bestehenden** Katalog
(`sponsor-curve-shapes.ts`), es werden keine neuen Referenz-Arrays erfunden; die übrigen acht
Formen werden nur nicht mehr gezogen (Abschnitt 5). Warum die Kopplung Karte↔Kurve fest ist:
die Karte mit dem größten Versprechen (Baumeister) trägt das größte Risiko — harte Rangmarke
und steile Kurve messen dieselbe Sache („oben bleiben"), das ist EIN erklärbares Risiko statt
zwei unabhängiger Würfel. Wer Planbarkeit will, hat mit dem Geldgeber beides flach.

**Was ein Spieler beim Wählen sieht** (die Karte trägt maximal fünf Zahlen und zwei Grafiken,
Anatomie aus #490 übernommen, um die dort gestrichenen Teile gekürzt):

1. Marke + Branche (bestehender Katalog, 200 Marken, `sponsor-brand-parents.ts`).
2. Die **Stufen-Leiter** (Grafik, Abschnitt 2) — mit der Rangmarke als Symbol auf einer Sprosse.
3. Die **Sachleistung** in einer Zeile, Wirkungstext wörtlich aus dem Gebäudekatalog:
   „Trainingszentrum · S1: Stufe 2 → S2: Stufe 3 · +42 % Grundtraining ab Stufe 3". Die
   Stufenreihe IST die Laufzeitanzeige. Darunter der Preis: „Leih-Abzug 7,2 C je Saison".
4. Die **Bonus-Zeile**: „+6 C am Saisonende, wenn …" mit Latte und aktuellem Stand.
5. Die **Übernahmezeile** (nur Baumeister): „Am Ende kaufen: 64,4 C statt 88 C" (Herkunft der
   Zahl: Abschnitt 4).

Nicht mehr auf der Karte, weil ersatzlos gestrichen (Abschnitt 5): Rarity-Farbe, Golden-Stern,
Vorschuss-Zeile, Achsen-Ziel, Challenge-Präfix, Modul-Liste, Tilt/Risiko-Hinweise.

**Auszahlung** (Q2: „bitte auszahlungen aber in summe auch wieder am ende"): genau EINE Buchung
je Team im Saisonende-Settlement, zusammen mit dem Gehaltsabzug (Invariante 1):

```
Auszahlung = Leiterwert(Endrang)  −  Leih-Abzug  +  Bonus (falls Ziel erreicht)
Kassendelta = Auszahlung − Gehaltssumme
```

Kein Geld je Spieltag, kein Vorschuss bei Unterschrift, keine Halbraten. Die absolute
Untergrenze `SPONSOR_BODEN = 43` (`sponsor-liga-leiter.ts`) schützt weiterhin nur den
Leiterwert; der Leih-Abzug wird danach abgezogen (er ist ein gewählter Preis, keine
Überraschung, und steht als Fixbetrag auf der Karte), der Bonus zahlt obendrauf (dieselbe
Semantik wie heute, `sponsorV3Settle`-Kommentar).

**Angebotsregel:** die Angebotserzeugung sieht die eigenen Gebäudestufen an und bietet nur
Leihen **oberhalb** der eigenen Stufe an — eine tote Sachleistung wäre die neue Version von
„0 von 27" (#490). Bei Ligabestand „12 Gebäude auf 32 Teams, alle L1" (Q4) ist die Regel fast
immer trivial erfüllt. Hat ein Team ausnahmsweise alles hoch ausgebaut, wird die betroffene
Karte als zweiter/dritter Geldgeber mit ihrer Kurvenform angeboten.

---

## 2. Die Stufen-Übersicht — alle 4 Ränge, wie vorher

> Q2: „und das mit den stufen will ich trotzdem haben dass man so ne übersicht hat wie viel man
> auf welchem rang bekommt alle 4 ränge wie das vorher war"

Die gewünschte Übersicht **existiert bereits** und bleibt Wort für Wort erhalten:
`SponsorRankLadder.tsx` rendert die 4er-Block-Leiter aus `buildSponsorRankTierRows`
(`sponsor-offer-presenter.ts`, `SPONSOR_RANK_LADDER_RUNGS`): neun Sprossen
**Platz 32 (Boden) · Top 28 · Top 24 · Top 20 · Top 16 · Top 12 · Top 8 · Top 4 · Meister**,
Balkenbreite = Stärke, „● aktuell"-Markierung wandert während der Saison mit.

Was sich ändert:

- **Wo sie steht:** auf jeder der drei Angebotskarten UND auf der laufenden Vertragskarte
  (heute schon so über `SponsorOfferCardNewLook` / `FoundationSponsorsNewLook`). Sie bleibt die
  zentrale Grafik der Karte.
- **Was drinsteht:** je Sprosse der **Netto-Betrag am Saisonende** — Leiterwert der Stufe
  minus Leih-Abzug. Nicht der Bruttowert: die Leiter muss zeigen, was das Settlement wirklich
  bucht (Invariante 2). Der Bonus steht NICHT in der Leiter (er hängt nicht am Tabellenplatz),
  sondern in seiner eigenen Zeile darunter.
- **Zweite Aufgabe** (aus #490 übernommen): die **Rangmarke** ist ein Symbol auf der
  betreffenden Sprosse plus ein Satz („Gebäude gilt, solange du Top 20 stehst"). Keine eigene
  Skala — beide Mechaniken hängen am Tabellenplatz und nutzen dieselbe 4er-Blockung. Der eine
  nötige Erklärsatz steht auf der Karte: **der Endrang zahlt die Prämie, der laufende Rang
  schaltet das Gebäude.**

Da die drei Karten drei verschiedene Kurvenformen tragen, unterscheiden sich die drei Leitern
sichtbar — genau die Vergleichsansicht, die Chris mit „wie viel man auf welchem rang bekommt"
meint. Die Beträge kommen wie heute aus der eingefrorenen `rankLadder` (bzw. beim Angebot aus
`buildOfferRankPayoutLadderPreview`) — eine Rechenstelle, kein zweiter Pfad.

---

## 3. Ziele — was bleibt, was ersatzlos verschwindet

> Q2: „diese ganzen bonus und extra ziele, da müssen wir uns auf ein paar wesentliche
> beschränken wenn überhaupt und die sinnvoll und verständlich machen" · „was ich mir als ziel
> vorstellen kann ist wie du meintest frische, ein gewisser platz in einer achse […] aber dann
> passend zu dem was das team ggf. auch leisten kann! nicht wieder utopisch"

Es bleiben **genau zwei Zielarten**, beide rein positiv (+6 C am Saisonende; verfehlt = kein
Bonus, nie ein Abzug), beide jederzeit ohne Gebäude im Spiel nachschlagbar, eine je Karte
(nur Ausstatter und Baumeister; der Geldgeber trägt bewusst keins):

### Bleibt 1: Frische

„Mindestens 70 % deines Kaders sind am Saisonende frisch (Match-Fatigue ≤ 45)." Begründung:
`kaderpflege` ist die **einzige Zielachse, die je funktioniert hat** — Ø 44,3 % Erfüllung in
der Saison-1-Messung (`docs/analyse/sponsor-achsen-messung.md`), im Zielkorridor, von jedem
Team ab Spieltag 1 über Rotation und Trainingsmodus steuerbar. Chris nennt sie namentlich.
Messgröße und Schwellen existieren im Code (`freshSharePct`, `AXIS_FRESH_FATIGUE_CAP = 45` in
`sponsor-v4-axes.ts`) und werden wiederverwendet; nur die Auswertung wird **binär** statt
stufenlos — „70 % geschafft oder nicht" ist die verständlichste Form (die Quote unter dem
binären Ziel ist ungemessen, siehe Abschnitt 7).

### Bleibt 2: Achsen-Rang (POW / SPE / MEN / SOC)

Der Liga-Rang des Teams in einer der vier Bereichs-Achsen — Chris' „ein gewisser platz in
einer achse". Diese Ränge existieren bereits: der Saisonstand rechnet sie je Team und Bereich
(`buildValueRanks` über `SEASON_DISCIPLINE_AREA_GROUPS`), heute allerdings nur in der
Client-Komponente `app/foundation/season-v2/SeasonStandingsNewLook.tsx`. Die Rechnung muss
nach `lib/season` umziehen, damit Anzeige und Settlement dieselbe Zahl lesen (Schritt 1 in
Abschnitt 6).

**Die Latte — „passend zu dem, was das Team leisten kann":** aus dem Achsen-Rang bei
Vertragsabschluss, nie absolut. Drei Bänder (aus #490, dort begründet; ±2 Ränge sind normale
Saisonbewegung — Annahme, ungemessen, Abschnitt 7):

| Achsen-Rang bei Unterschrift | Latte | Beispiel |
|---|---|---|
| 1–8 (Spitze) | Rang + 2 halten oder besser | POW-3. ⇒ „bleib Top 5" |
| 9–24 (Mitte) | Rang halten oder besser | POW-14. ⇒ „bleib 14. oder besser" |
| 25–32 (Keller) | Rang − 2 erreichen | POW-28. ⇒ „werde 26. oder besser" |

Welche Achse, sagt die Marke (Branchenkette, Abschnitt 4) — die Karte ist damit in einem Satz
erzählbar („Ausrüster: Trainingszentrum + Kraft").

### Verschwindet ersatzlos — je Ziel mit Begründung

| Ziel/Achse (heute) | Warum weg |
|---|---|
| **`wachstum` (Kaderwert +12 %)** | In Saison 1 strukturell kaputt (Methodenwechsel heuristischer Draft-MW → rangbasierter Saisonende-MW, im Code dokumentiert; 6 gemessene Verträge, **kein einziger** mit positiver Rohmetrik) und deshalb dort schon heute nicht mehr angeboten. Für S2+ liegt keine Messung vor; „dein Kader soll X % mehr wert sein" ist zudem für niemanden im Spiel live ablesbar. |
| **`soliditaet` (Nettoposition +110 C)** | Die Messgröße (Cash − Kredite − Vorschuss) ist die unverständlichste des Systems — genau die Sorte, die Chris meint. Mit 20 Notkrediten und 476,3 C Restschuld in der Liga (Q4) ist sie außerdem primär eine Schulden-Wette. Der Vorschuss, dessen Verrechnung sie brauchte, entfällt ohnehin. |
| **`entwicklung` (20 Spieler mit MW-Sprung ≥ 6)** | Das ist das Ziel, das Chris nachweislich nicht deuten konnte („was bedeutet 20 Sprünge? Sind damit 20 SP gemeint?", zitiert in `sponsor-v4-axes.ts`). Nachkalibriert wurde es erst am 2026-08-03 — es hat nie verständlich funktioniert. |
| **`ausbau` (+2 Gebäudestufen)** | In der gemessenen Saison hat es **kein einziges Team** unterschrieben (n = 0, Kommentar in `sponsor-v4-axes.ts`). Und im neuen System leiht der Sponsor selbst Gebäude — ein „bau selbst aus"-Ziel neben einer Gebäude-Leihe wäre widersinnig (`max(eigene, Leihstufe)` machte den Eigenbau während der Leihe teilweise wirkungslos). |
| **Der 27+6-Bonus-/Golden-Zielkatalog** | Erzeugungsseitig bereits 2026-08 entfernt (Datei-Kommentar `sponsor-special-objectives.ts`: 1024 gemessene Komponenten, keine einzige aus dem Katalog). Diese Vorlage bestätigt: er kommt **nicht** zurück. Die Auswertung bleibt für Altverträge (Invariante 3). |
| **Sonderziel-Wahrscheinlichkeiten (`GOAL_PROBABILITY`, 36 Schätzwerte)** | „Größter ungemessener Parameter des Systems" (Q1 wie V3-Code). Mit zwei Zielarten und fester Bonushöhe 6 C braucht es keine Schwierigkeits-Bepreisung mehr; ein Schätzfehler kostet maximal den Bonus, nie den Etat. Tabelle bleibt nur als Abrechnungsseite für Altverträge. |

Der Bonus ist bewusst **nicht** EV-fair eingepreist (kein −p·G-Sockelabzug mehr wie heute in
`sponsorV3Settle` für Neuverträge): er ist ein erreichbares Erfolgserlebnis von ~6–10 % des
Kartenwerts. Wenn die halbe Liga ihn holt, ist das der Zweck, kein Kalibrierungsfehler (#490).
Damit entfällt auch die EV-Paritäts-Maschinerie um die Ziele — die drei Karten unterscheiden
sich ohnehin gewollt im Wert (der Leih-Abzug kauft ein Gebäude).

---

## 4. Das Gebäude-Leihen — Mechanik aus Q3, Zahlen aus Q4

> Q3/Chris: „nur geliehen und dazu natürlich trotzdem sponsorengelder weil seine leute muss man
> ja bezahlen" · „vllt hat man dann ziele wie über platz x bleiben damit manche gebäude gelten" ·
> „dann kann man mit den gebäuden auch mehrjahres pläne viel geiler umsetzen wenn man boni
> mitnimmt in folgeseasons" · „übernahme von gebäuden bitte nicht so krass reparieren!!!! das
> bereitstellen ist ja schon ein fetter boost!"

Die Leih-Idee trifft ein gemessenes Loch: 12 Gebäude auf 32 Teams, alle L1 — niemand kann
Ausbau bezahlen (Q4). Neun Teams stehen auf exakt 0 Cash, Median 16,2, Maximum 41,1.

### 4.1 Der Leihwert — die geeichte Formel

```
Leihwert(Gebäude, Stufe) = kumulierte Baukosten / 5 + Saison-Unterhalt
```

Q4 bestätigt die Eichung: Fan Shop L3 → 52/5 + 1,4 = **11,8 C** gegen echten Katalog-Ertrag
**11,7 C**/Saison. Werte für die verleihbaren Gebäude (aus `facility-catalog.ts` gerechnet):

| Gebäude | L2 | L3 | L4 |
|---|---:|---:|---:|
| Trainingszentrum | 6,0 | 12,0 | 21,4 |
| Recovery Center | 5,2 | 10,5 | 18,7 |
| Academy | 5,2 | 10,4 | 18,5 |
| Specialist Wing | 4,7 | 9,4 | 16,8 |
| Scouting Office | 4,7 | 9,4 | 16,8 |
| Analytics Room | 3,9 | 7,9 | 14,2 |

### 4.2 Der Preis — Q4 ersetzt die Kartenfaktoren

#490 wollte Kartenfaktoren 0,85/0,75 auf das ganze Geld. **Gemessen unbezahlbar** (Q4):
Baumeister 25 % × EV = median 16,8 C/Saison Verzicht — **kein Team** hatte in S2 eine freie
Marge ≥ 16,8 (Median +3,4; 12 von 32 negativ; freie Marge je Team und Saison 4–8 C).

Stattdessen (Q4, verbindlich): **Abzug = 60 % des Leihwerts je Saison, als fester C-Betrag im
Vertrag eingefroren** — er ERSETZT die Kartenfaktoren, kommt nicht dazu. Beispiele:
Trainingszentrum L2 → 3,6 C · L3 → 7,2 C · L4 → 12,8 C je Saison. Das liegt in der
Größenordnung der gemessenen freien Marge statt weit darüber, und es skaliert mit dem, was
geliefert wird, statt mit dem Kartenwert.

**Einnahmegebäude (Fan Shop, Arena Upgrade) werden nicht verliehen.** Q4 lässt nur „zum vollen
erwarteten Saisonertrag oder gar nicht" zu; zum vollen Ertrag ist die Leihe für den Spieler
wertlos bis negativ (sicherer Abzug gegen markengeschalteten, bei der Arena zusätzlich
beliebtheitsskalierten Ertrag). Entscheidung dieser Vorlage: **gar nicht** (W4 in Abschnitt 8).
Angenehmer Nebeneffekt: die Branchen Handel, Medien/Telekom/Energie (61 Marken) wandern zu den
Geldgeber-Marken und lösen #490s Geldgeber-Engpass (nur 19 Finanzmarken) gleich mit.

### 4.3 Die Branchenkette (aus #490, um die Einnahmegebäude bereinigt)

| Branche | Gebäude | Bonus-Ziel |
|---|---|---|
| Sport (Adidas, Nike, Puma …) | Trainingszentrum | POW-Rang |
| Auto (BMW, Ferrari, Continental …) | Specialist Wing | Achse der Marken-Variante (Power Gym → POW, Agility Track → SPE, Mind Lab → MEN, Social Studio → SOC) |
| Technik (SAP, Apple, Zeiss …) | Analytics Room | MEN-Rang |
| Pharma (Bayer, Pfizer, J&J) | Recovery Center | Frische |
| Lebensmittel (Coca-Cola, Ferrero …) | Academy | Frische |
| Logistik + Luftfahrt (DHL, Emirates …) | Scouting Office | SPE-Rang |
| Finanz + Handel + Medien/Telekom/Energie (80 Marken) | **kein Gebäude — Geldgeber** | kein Ziel |

Regel wie in #490: gewürfelt wird erst Archetyp und Gebäude, dann eine passende Marke — die
schiefe Katalogverteilung verzerrt nichts. Wo ein Gebäude drin ist, stimmt die Branche immer;
SOC-Ziele laufen nach dem Wegfall von Handel/Medien nur noch über das Social Studio (bewusst
selten, wie Pharma → Recovery).

### 4.4 Die Rangmarke — „über Platz X bleiben"

Die Nutzungsbedingung ist **eine markierte Sprosse der Stufen-Leiter** (Abschnitt 2), bei
Unterschrift eingefroren, relativ zum Startblock (mild: ein Block darunter; hart: der
Startblock; nie darüber — das wäre die alte Zielfalle). Verglichen wird der Tabellenplatz nach
jedem Spieltag:

- **Auf oder über der Marke:** Gebäude wirkt.
- **Darunter:** das Gebäude **ruht sofort, kommt sofort zurück, nichts wirkt rückwirkend.**
  Spieltagsnahe Wirkungen (Erholung, Analytics-Anzeige) setzen aus; saisonweite Wirkungen
  (Trainingsprogression, Academy-Boost) zählen anteilig nach aktiven Spieltagen (aktiv an 8
  von 10 = 80 % der Saisonwirkung).
- **Geld ist nie betroffen:** die Leiter zahlt unverändert, und auch der **Leih-Abzug läuft
  fix weiter** — der Sponsor stellt bereit, das Nutzungsrisiko trägt der Spieler. Nur so
  bleibt die Auszahlung planbar (Invariante 1) und die Karte ehrlich: der Abzug steht als
  eine feste Zahl darauf.

Sichtbarkeit: „● aktuell" gegen die Marken-Sprosse auf der Leiter, eine Statuszeile auf der
Vertragskarte („aktiv" / „ruht seit Spieltag 6 — 3 Plätze unter der Marke"), eine
Timeline-Meldung je Statuswechsel.

### 4.5 Mehrjahres-Pläne — Leih-Leiter und Übernahme

**Boni mitnehmen:** war das Gebäude in einer Saison an **mindestens 6 von 10 Spieltagen**
aktiv, gilt die Saison als „gehalten" und die Leihstufe steigt zum nächsten Saisonstart um
eins (Ausstatter 2→3, Baumeister 2→3→4). Eine gerissene Saison **pausiert** den Aufstieg — die
Stufe fällt nie zurück (sonst wäre ein schlechter Lauf der Ruin des Dreijahresplans). Der
Leih-Abzug der neuen Saison folgt der tatsächlich geliehenen Stufe (steigt die Stufe nicht,
steigt auch der Abzug nicht). Rangmarke und Ziel-Latte bleiben über die ganze Laufzeit die bei
Unterschrift eingefrorenen — wer sich verbessert, für den werden sie leichter; das ist die
Belohnung. Das Bonus-Ziel wird je Saison neu ausgewertet (bis zu 3 × 6 C). Die bestehende
Mehrjahres-Erosion (`TERM_MULTIPLIERS` 1,0/0,94/0,87, `sponsor-negotiation.ts`) entfällt für
Neuverträge: der Leih-Abzug ist der Mehrjahres-Preis, zwei stille Abzüge nebeneinander wären
unerklärlich (W6; Wechselwirkung mit dem 19-%-Einbruch: Abschnitt 7).

**Übernahmerecht (nur Baumeister):** #490s „−25 % je gehaltener Saison" ist gemessen zu stark
(Q4: über 3 Saisons +63 C Überschuss) — und Chris selbst hat gebremst („nicht so krass …
das bereitstellen ist ja schon ein fetter boost"). Korrigierte Formel (Q4, verbindlich):

```
Übernahmepreis = kumulierte Katalogkosten der erreichten Stufe − bereits gezahlte Leih-Abzüge
```

Beispiel Trainingszentrum L4 nach 3 gehaltenen Saisons: 88 − (3,6 + 7,2 + 12,8) = **64,4 C**
(~−27 % statt −75 %). Die Leihraten sind damit Anzahlung, kein Rabattgenerator. Ehrlich
dazugesagt: 64,4 C liegt **über dem höchsten je gemessenen Kassenstand der Liga** (41,1 C, Q4)
— die Übernahme großer Gebäude ist ein Sparziel über Saisons, kein Selbstläufer. Kleinere
Übernahmen sind erreichbar (Ausstatter, Trainingszentrum L3: 48 − 10,8 = 37,2 C). Ob das
gewollt hart ist oder eine Ratenzahlung braucht, ist eine offene Design-Frage (Abschnitt 7).
Wer nicht übernimmt, fällt auf die eigene Stufe zurück — die Karte sagt das vorher.

**Gebäudewirkung als Overlay:** die Effekt-Leserei rechnet künftig mit
`effektive Stufe = max(eigene Stufe, aktive Leihstufe)`. Gespeicherte Gebäudestände aller
Spielstände bleiben unangetastet; alte Saves kennen schlicht keine Leihen. Specialist Wing:
existiert ein eigener Flügel, bestimmt ER die Fokusachse, die Leihe zählt nur über die Stufe
(#490).

**Seltene Sponsoren / „Mäzen" (Stufe 5, ohne Abzug):** nicht Teil dieses Baus. Erst wenn
Uptime und Liga-Bilanz des Grundsystems gemessen sind (Abschnitt 7).

---

## 5. Die Abbau-Liste — was wegfällt, was migriert werden muss

Grundprinzip (Invariante 3): **Abgebaut wird nur die Erzeugungsseite. Die Abrechnungsseite
bleibt vollständig stehen, solange ein Spielstand sie referenzieren kann.** Erkennung neuer
Verträge über die **Anwesenheit des neuen Vertragsblocks** (Arbeitsname `sponsorLeihe`), exakt
nach dem Muster, mit dem heute `sponsorV3`-Blöcke Alt und Neu trennen. Zusätzlich wird
`SponsorSystemVersion` um `4` erweitert und für neue Spiele gestampft (`stampSponsorSystemVersion`,
`sponsor-v3-offer-service.ts`) — reine Herkunfts-Angabe wie heute.

### 5.1 Was für NEUE Angebote/Verträge wegfällt (ersatzlos)

| Baustein | Heute in | Ersatz |
|---|---|---|
| 5-Slot-Slate (`SLOT_COUNT = 5`) | `sponsor-offer-service.ts` | 3 feste Karten |
| Achsen-Ziehung, Achsen-Karten (`achse`, `axisKey`, `SPONSOR_V4_AXIS_*`) | `sponsor-tier-pool.ts`, `sponsor-v3-model.ts`, `sponsor-v4-axes.ts` | zwei Zieltypen (Abschnitt 3) |
| Vorschuss (`advance`, `SPONSOR_V4_ADVANCE_*`) | `sponsor-v3-model.ts`, `sponsor-offer-service.ts` | entfällt; Liquidität läuft über den Kredit (7–20 %) |
| Rarity als Spielgröße (Ziehgewichte, Hebelgrößen, Loot-Farbe auf der Karte) | `sponsor-curve-shapes.ts`, `sponsor-v3-model.ts` | Karten tragen keine Rarity mehr; Feld bleibt im Typ für Altverträge |
| Golden-Los (`rollGoldenLuck`, `goldenSponsorHistoryByTeamId`-Writer) | `sponsor-tier-pool.ts`, `sponsor-contract-lifecycle.ts` | entfällt für Neuverträge |
| Kurvenform-Ziehung aus 11 Formen | `sponsor-tier-pool.ts` | 3 feste Formen (Karte↔Kurve gekoppelt); die 11 `reference`-Arrays BLEIBEN als Daten (Altverträge/Forecast lesen `terms.curveShape`) |
| Laufzeit-Würfel (3:1:1) | `sponsor-tier-pool.ts` | Laufzeit hängt fest am Archetyp (1/2/3) |
| Tilt/Risikokarten (`tiltFactor`, `SPONSOR_V3_TILT_*`) | `sponsor-v3-model.ts` | für neue Karten schon heute 0; Erzeugung entfällt, Rechenpfad bleibt für Altverträge |
| Sonderziel-Bepreisung (−p·G, `GOAL_PROBABILITY`, `SPONSOR_V3_GOAL_*`) | `sponsor-v3-model.ts` | fester Bonus +6 C ohne Sockelabzug |
| Challenge-Slot (`resolveChallengeSlotIndex`, `isChallengeOffer`) | `sponsor-special-objectives.ts`, `sponsor-offer-service.ts` | entfällt |
| Modul-/Perk-Schicht (`moduleIds`, Spotlight-Perk) | `sponsor-modules.ts` | entfällt; Feld bleibt optional im Typ |
| Mehrjahres-Erosion für Neuverträge | `sponsor-negotiation.ts` | Leih-Abzug ist der Mehrjahres-Preis; `TERM_MULTIPLIERS` bleibt für rollende Altverträge |
| Event-Würfel (Partner-Reibung) | `sponsor-event-service.ts` | entfällt für Neuverträge |

### 5.2 Was NICHT gelöscht werden darf (Abrechnungsseite laufender Spielstände)

- `sponsor-v3-model.ts` komplett: `sponsorV3Settle`, `sponsorV3LadderValue`,
  `SPONSOR_V3_LEGACY_CARDS`, `GOAL_PROBABILITY` — eingefrorene `sponsorV3`-Blöcke rechnen
  darüber ab.
- `sponsor-objective-evaluator.ts` komplett (wertet Alt-Ziel-Schlüssel aus; 32 unterschriebene
  Altverträge im Live-Save tragen sie, Datei-Kommentar `sponsor-special-objectives.ts`).
- Die V4-Achsen-**Auswertung** (`evaluateSponsorV4Axis` samt Messfunktionen in
  `sponsor-v4-axes.ts`) — laufende Achsen-Verträge müssen bis zum Auslaufen messbar bleiben.
  Nur `offerable`/`buildSponsorV4AxisTerms` (Erzeugungsseite) werden funktionslos.
- `sponsor-negotiation.ts` (Shim + `TERM_MULTIPLIERS`), `sponsor-v3-migration.ts`,
  die 11 `reference`-Arrays in `sponsor-curve-shapes.ts`, `sponsorV3BenchmarkLadder`.
- `sponsor-liga-leiter.ts` unverändert — sie ist auch die Leiter des neuen Systems.
- Settlement-Pfad für Altverträge (`sponsorV3SettlementParts`-Zweig in
  `sponsor-settlement-service.ts`).

### 5.3 Die konkreten Migrationskanten (der heikle Teil)

1. **Der Angebots-Wächter in `ensureSeasonSponsorOffers`** (`sponsor-offer-service.ts`) prüft
   heute wörtlich `currentOffers.length === 5 && … getSponsorV3Terms(offer) != null`. Wird er
   nicht auf das neue Format umgestellt (`length === 3` + neuer Block), behalten **alle
   bestehenden Spielstände ihre alten 5er-Slates für immer** — der häufigste Weg, wie ein
   Rework in laufenden Saves unsichtbar bleibt. Umstellen; alte, noch nicht unterschriebene
   Angebote werden ersetzt (ein Angebot ist keine Zusage — dieselbe Regel, mit der heute
   V1-Angebote ersetzt werden).
2. **Unterschriebene Verträge (auch mehrjährige) bleiben unangetastet.** Sie rollen weiter
   über `advanceSponsorContractsForNewSeason` (`sponsor-contract-lifecycle.ts`) mit Erosion
   und Reroll nach altem Recht und laufen aus. Keine Konvertierung, kein Backfill — exakt die
   Regel aus Q1 („Bestandsverträge müssen weiter nach altem Recht abgerechnet werden").
3. **Datentypen** (`olyDataTypes`): `SponsorOffer`/`TeamSponsorContract` bekommen einen
   optionalen `sponsorLeihe`-Block (Gebäude, Stufenreihe je Saison, Rangmarke, Leih-Abzug je
   Saison, Zieltyp + eingefrorene Latte, Übernahme-Konditionen, gehaltene Saisons). Alle
   Altfelder bleiben optional bestehen. Kein bestehendes Save-Feld ändert seine Bedeutung.
4. **Neues Season-State-Feld** für den Leihstatus (Arbeitsname
   `sponsorLeaseStateByTeamId`: aktive Stufe, aktive Spieltage der laufenden Saison,
   Ruht-Status). Fehlt das Feld (alle Alt-Saves), gibt es keine Leihen — Overlay ist ein
   No-op. Kein Migrationsskript nötig.
5. **Gebäudewirkung**: die eine Lesestelle `getFacilityLevel`/`getTeamFacilityState`
   (`facility-effects.ts`) bekommt die `max(eigen, Leihe)`-Schicht. Gespeicherte
   `facilities`-Stände werden nie beschrieben.
6. **Anzeige**: `SponsorOfferCardNewLook.tsx` verliert Rarity/Golden/Vorschuss/Achse/Module
   und gewinnt Sachleistungs-, Rangmarken-, Bonus- und Übernahmezeile; Altvertrags-Ansicht
   rendert weiter den V3-Block (Zweig existiert). `sponsor-offer-presenter.ts` behält
   `buildSponsorRankTierRows` unverändert.
7. **Analytics Room** verliert (erneut) seinen Gegenstand: seine Stufen 1–3 zeigen heute den
   Live-Stand der Sponsor-**Achse** (`facility-catalog.ts`, `analytics-live-progress.ts`).
   Im selben Zug auf das neue Bonus-Ziel (Frische/Achsen-Rang: Ist, Latte, Restbedarf)
   umstellen, sonst entsteht dort wieder ein „lohnt sich nicht" (#490-Warnung).
8. **KI-Wahl** (`scoreOfferForAi` in `sponsor-offer-service.ts`): die Achsen-Fit-, Vorschuss-,
   Eco-Downside- und Kurven-Fit-Terme verlieren ihren Gegenstand. Neue, kleine Heuristik:
   klamme Teams (bestehende `cashPressure`-Kaskade) nehmen den Geldgeber; Teams mit
   Ausbau-Lücke und Marge den Ausstatter; ambitionierte, stabile Teams den Baumeister.
9. **Golden-Sponsoren-Historie** (`goldenSponsorHistoryByTeamId`) und Marken-Historie bleiben
   als Daten liegen; nur der Golden-Writer entfällt mit dem Los.

---

## 6. Bau-Reihenfolge — jeder Schritt lauffähig und testbar

| # | Schritt | Betroffene Dateien | Abnahme |
|---|---|---|---|
| ~~0~~ | **ERLEDIGT (11.08.).** Der Einbruch war zu 84 % eine Einmal-Reparaturbuchung aus Saison 1 (371,3 C). Dabei kam ein aktives Leck zutage: Altverträge ohne Kurvenform behielten beim Saisonwechsel ihren eingefrorenen Gehaltsfaktor — 10 von 32 Verträgen steckten auf 1,0 statt 1,19, zusammen 129,6 C zu wenig, und der Fehler entstand jede Saison neu. Behoben in `rerollSponsorV3TermsForNewSeason`. | — | — |
| 1 | **Achsen-Rang-Rechnung in die lib** — `buildValueRanks` (~40 Zeilen, pure, inkl. Gleichstands-Regel) aus `app/foundation/season-v2/SeasonStandingsNewLook.tsx` nach `lib/season/` (neu, z. B. `season-value-ranks.ts`); Standings importiert von dort | `SeasonStandingsNewLook.tsx`, neue lib-Datei, neuer Test | Saisonstand rendert unverändert (bestehender Test `saisonstand-rang-hinter-pps.test.ts` grün) |
| 2 | **Leih-Rechenschicht, pure** — Leihwert-Formel, 60-%-Abzug, Übernahmepreis, verleihbare Gebäude (nur Effektgebäude), Stufenreihen, Rangmarken-Ableitung aus dem Startblock, Ziel-Latten-Bänder | neu `lib/sponsor/sponsor-leihe.ts` + Test | Fixpunkte aus dieser Vorlage zahlenidentisch (TZ 3,6/7,2/12,8; Übernahme 64,4 und 37,2; Fan Shop/Arena nicht verleihbar) |
| 2b | **Zustand als Leih-Variable** (E7) — Leihgaben tragen einen Anfangszustand, nicht immer 100. Der Zustand wandert in die Kartenanzeige (was bekomme ich wirklich), in die Wirkung (unter 80 sinkt sie) und in den Übernahmepreis: `(Katalogkosten − Σ Leihwert) × Zustand/100`. Der Verschleiß selbst ist bereits gebaut (`facility-condition.ts`: Mittel 17 je Saison, Streuung 12..22, Schwelle 80). | `sponsor-leihe.ts`, `olyDataTypes` (Leih-Datensatz), Test | Zwei Karten mit identischem Gebäude und identischer Stufe, aber verschiedenem Zustand, ergeben verschiedene Übernahmepreise und verschiedene Wirkung ab Saison 2 |
| 3 | **Gebäude-Overlay** — effektive Stufe `max(eigen, Leihe)`, Leihstatus im Season-State, Rangmarken-Schaltung beim Spieltags-Abschluss, anteilige Saisonwirkung, Timeline-Meldung bei Statuswechsel | `lib/facilities/facility-effects.ts`, Matchday-Advance-Pfad, `olyDataTypes`, Tests | Ohne Leih-Daten im Save exakt heutiges Verhalten (Regressionstest); mit synthetischem Leih-Datensatz schaltet die Marke |
| 4 | **Angebotserzeugung: 5 Karten** (E8 — nicht 3) — Slate auf die drei Archetypen mit fester Kurve/Laufzeit, Gebäude-+Markenwahl über die Branchenkette (nur oberhalb eigener Stufe), Leih-Block einfrieren; Wächter in `ensureSeasonSponsorOffers` auf das neue Format | `sponsor-tier-pool.ts`, `sponsor-offer-service.ts`, `sponsor-v3-offer-service.ts`, `sponsor-brand-catalog.ts`, `olyDataTypes` | Neues Spiel: 5 Angebote je Team, davon mindestens eine ohne Verzicht und eine gewöhnliche Gebäude-Karte im unteren Preisband (E8-Auflage: 12 von 32 Teams können nur die reine Cash-Karte bezahlen); drei Kurvenformen auf den Cash-Karten, kein Achsen-/Vorschuss-/Golden-Feld; FOSD-Fallen-Test über den 3er-Satz (Prüfstands-Muster aus Q1): 0 Fallen; Alt-Save: alte 5er-Angebote werden beim nächsten Ensure-Lauf ersetzt |
| 5 | **Settlement** — Leih-Abzug- und Bonus-Zeile im `season_end`-Settlement (dieselbe Buchung wie `salary_deduct`, Invariante 1); Untergrenze schützt nur den Leiterwert | `sponsor-settlement-service.ts`, ggf. Parts-Builder in `sponsor-v3-offer-service.ts`, Tests | Altverträge zahlen zeichenidentisch weiter (Regressionstest); Anzeige-==-Settlement-Test für den neuen Pfad („Kasse ändert sich um exakt den angezeigten Betrag", Muster aus Q1/P-Tabelle) |
| 6 | **Die zwei Ziele** — Frische (binär, 70 %/≤ 45) und Achsen-Rang (Bänder, liest Schritt 1); Auswertung am Saisonende, Anzeige der Latte + Ist auf der Karte | `sponsor-leihe.ts` (Latten), `sponsor-objective-evaluator.ts` (neuer Zweig), Presenter | je Zieltyp ein Test; kein Ziel für Geldgeber-Karten |
| 7 | **Mehrjahres-Roll + Übernahme** — gehaltene-Saison-Zählung (≥ 6/10), Leihstufen-Aufstieg beim Saisonwechsel, Übernahme-Angebot am Vertragsende (Preisformel aus Schritt 2), Rückfall auf eigene Stufe | `sponsor-contract-lifecycle.ts`, `lib/season/preseason-workflow-service.ts`, API-Route + UI für die Übernahme | 3-Saisons-Testlauf: Stufenreihe 2→3→4 bei gehaltenen, 2→2→3 bei einer gerissenen Saison; Übernahmepreis == Formel |
| 8 | **KI-Wahl + Karte + Analytics-Umwidmung** — neue Wahlheuristik; `SponsorOfferCardNewLook` auf die neue Anatomie; Analytics-Stufentexte auf das Bonus-Ziel | `sponsor-offer-service.ts` (`scoreOfferForAi`), `SponsorOfferCardNewLook.tsx`, `FoundationSponsorsNewLook.tsx`, `sponsor-offer-presenter.ts`, `facility-catalog.ts`, `analytics-live-progress.ts` | KI-Verteilung über die drei Karten plausibel (kein Archetyp > 70 % liga-weit); Karte zeigt ≤ 5 Zahlen + 2 Grafiken |
| 9 | **Messlauf vor Freigabe** — eine volle KI-Saison über den echten Pfad: Uptime je Marke, Bonus-Quoten je Zieltyp, Liga-Bilanz Σ Sponsoren − Σ Gehälter, Zahl zahlungsunfähiger Teams | neues Skript unter `scripts/` | Σ Sponsoren deckt Σ Gehälter bei sf 1,0; kein Team unter 0 gezwungen; Ergebnisse zurück in Abschnitt 7 |

Schritte 1–3 sind in Alt-Saves reine No-ops, Schritte 4–8 greifen nur für neue
Angebote/Verträge — jeder Schritt ist einzeln mergebar, ohne dass ein laufender Spielstand
kippt.

---

## 7. Ungemessen — was offen bleibt

1. **Der 19-%-Einbruch (das Warnzeichen aus Q4, wichtigster Punkt).** Die Sponsorsumme der
   Liga fiel S1→S2 um 19 % bei gleichen Gehältern; die Ursache ist **ungemessen**. Kandidaten:
   Mehrjahres-Erosion rollender Verträge (`TERM_MULTIPLIERS` 0,94/0,87 wirken erst ab S2),
   verfehlte Achsen (−p·G-Zeilen zahlen ab S2 real negativ), Vorschuss-Verrechnung, Salary
   Factor der Saison, Startrang-Sockel-Verschiebungen. Jeder Leih-Abzug **verschärft** einen
   ungeklärten Einbruch — deshalb ist die Messung Schritt 0 der Bau-Reihenfolge und
   Freigabe-Bedingung, nicht Nacharbeit. (Gegenläufig wirken im neuen System: Wegfall der
   Erosion und der −p·G-Abzüge für Neuverträge. Ob das den Leih-Abzug kompensiert: ungemessen.)
2. **Uptime der Rangmarken.** #490 schätzt milde Marke ~90 %, harte ~70–80 % — reine Annahme.
   Schwanken Ränge stärker, ist der Baumeister eine Falle; schwächer, ist er geschenkt.
   Messen in Schritt 9 (Verteilung „aktive Spieltage von 10" über 32 Teams).
3. **Saisonbewegung der Achsen-Ränge.** Die Latten-Bänder (±2) unterstellen, dass ±2
   Achsen-Ränge normale Bewegung sind — plausibel, ungemessen. Messbar aus dem
   Live-Save-Abbild (S1→S2-Vergleich der `buildValueRanks`-Ergebnisse).
4. **Frische-Quote unter dem binären Ziel.** Gemessen ist die stufenlose Ø-Erfüllung 44,3 %
   (S1); wie viele Teams die binäre 70-%-Latte reißen oder schaffen, ist ungemessen.
5. **Bezahlbarkeit des Leih-Abzugs für die 12 Teams mit negativer Marge.** Der Geldgeber ist
   ihre Ausweichkarte — ob die KI-Heuristik sie zuverlässig dorthin lenkt und ob menschliche
   Kellerteams sich mit dem Baumeister ruinieren können, zeigt erst Schritt 9.
6. **Übernahme-Erreichbarkeit.** 64,4 C (TZ L4) übersteigt den höchsten je gemessenen
   Kassenstand (41,1 C). Ist die Übernahme großer Gebäude ein bewusstes Fern-Sparziel, oder
   braucht es eine Ratenzahlung? Design-Entscheidung für Chris, nicht messbar.
7. **Der Leihwert-Divisor 5** ist am Fan Shop geeicht (11,8 gegen 11,7, Q4) — für
   Effektgebäude ist „Wirkung ≈ kumulierte Kosten / 5 + Unterhalt" eine Übertragung, keine
   Messung. Ein Fehler verschiebt den 60-%-Abzug proportional.
8. **KI-Verhalten mit Rangmarken** (steuert eine KI aktiv gegen das Ruhen?) und die
   **Marken-Eindeutigkeit** bei nur 3 Recovery-Marken liga-weit: ungeprüft.
9. **Fallenfreiheit des 3er-Kurvensatzes.** Die Ankernormierung erzwingt EV-Gleichheit am
   Startrang; die FOSD-Prüfung über alle 32 Erwartungsränge (Prüfstands-Muster aus Q1) ist
   für die Kombination „3 Formen × Leih-Abzug × Bonus" noch nicht gelaufen — sie ist
   Abnahmekriterium von Schritt 4.

---

## 8. Die aufgelösten Widersprüche, einzeln

| # | Widerspruch | Entscheidung | Warum |
|---|---|---|---|
| W1 | #490: „Gehalt je Spieltag in zehn Raten" ↔ Q2 „in summe am ende" + Q4-Invariante (kein unterjähriger Liquiditätsbedarf, Gehälter buchen am Saisonende) | **Q2/Q4: alles am Saisonende, eine Buchung** | Chris' ausdrücklicher Wunsch; und die Gehaltskasse (Invariante 1) darf nicht zerlegt werden |
| W2 | Q1-Architektur (4 Leitern, 20 Klauseln mit Bonus **und Malus**, 120 Sponsoren) ↔ Q2 „nur 3, unübersichtlich, funktioniert so nicht" | **Q2: 3 feste Karten, keine Klauseln, keine Mali** | Chris ist Auftraggeber; aus Q1 überleben die Methoden (Ankernormierung, FOSD-Prüfstand, Einfrieren, Migrationstechnik), nicht die Architektur |
| W3 | #490-Kartenfaktoren 0,85/0,75 ↔ Q4 „unbezahlbar (16,8 C gegen Marge ≤ 8)" | **Q4: 60 % des Leihwerts, ersetzt die Faktoren** | Q4 ist die frische, verbindliche Messung |
| W4 | Q4 „Einnahmegebäude zum vollen Saisonertrag **oder gar nicht** verleihen" | **gar nicht** | Zum vollen Preis ist die Leihe für den Spieler wertlos bis negativ (sicherer Abzug gegen geschalteten Ertrag) — eine Karte, die niemand nehmen sollte, gehört nicht ins Angebot; Nebeneffekt: 61 Marken lösen den Geldgeber-Engpass |
| W5 | #490-Übernahme „−25 % je Saison" ↔ Q4 „+63 C Überschuss, zu stark" ↔ Chris „nicht so krass!" | **Q4-Formel: Katalogkosten − gezahlte Abzüge (TZ L4: 64,4 C)** | Messung und Auftraggeber zeigen in dieselbe Richtung |
| W6 | Mehrjahres-Erosion (`TERM_MULTIPLIERS`) ↔ Leih-Abzug als Mehrjahres-Preis | **Erosion entfällt für Neuverträge, bleibt für Altverträge** | Zwei stille Abzüge auf derselben Karte wären unerklärlich; der Leih-Abzug ist sichtbar und gewählt. Wechselwirkung mit dem 19-%-Einbruch wird in Schritt 0 gemessen |
| W7 | Fünf V4-Achsen ↔ Q2 „ein paar wesentliche" | **Zwei Zieltypen: Frische + Achsen-Rang; vier Achsen ersatzlos weg** (Begründung je Achse in Abschnitt 3) | Chris' Wunsch; nur die je funktionierende bzw. ausdrücklich gewünschte Zielart bleibt |
| W8 | 5 Angebote (Code) ↔ „3 zur auswahl" (Q2) ↔ „DREI Slots" (Q4) | **3** | Q2 und Q4 sind deckungsgleich |
| W9 | 11 Kurvenformen ↔ „einfach nur verschiedene kurven" | **3 Formen aus dem Bestandskatalog, fest an die Karten gekoppelt; 8 Formen nur noch Altvertrags-Daten** | Drei unterscheidbare Kurven SIND Chris' Wunsch; keine neuen Referenzdaten, keine Datenmigration |
| W10 | #490 „seltene Sponsoren bringen neue Gebäude?" ↔ Aufwand/Risiko | **Nicht in diesem Bau** (weder Mäzen noch Medienzentrum) | Erst das Grundsystem messen (Abschnitt 7); #490s eigene Empfehlung („Ausbaustufe zwei") |

---

*Anlage/Verweise: Q1 = `docs/sponsor-rework-umsetzungsplan.md` · Q3 = `docs/SPONSOREN_GEBAEUDE_KONZEPT.md` + `docs/mockups/sponsoren-gebaeude.html` (Branch `claude/sponsoren-gebaeude-konzept`, PR #490) · Achsen-Messung = `docs/analyse/sponsor-achsen-messung.md` · Gebäudezahlen = `lib/facilities/facility-catalog.ts` · Leiter/Boden = `lib/sponsor/sponsor-liga-leiter.ts` · Stufen-Übersicht = `components/foundation/sponsor/SponsorRankLadder.tsx` + `buildSponsorRankTierRows` in `lib/sponsor/sponsor-offer-presenter.ts`.*
