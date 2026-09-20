# Opus-Gegencheck: das Kampfmodell gegen echte Spielsysteme gehalten (20.09.)

**Auftrag von Chris, wörtlich:** „lass das dann auch von nem opus agent checken + vergleiche mit
spielsystemen im internet die es bereits gibt! ich brauche hilfe beim aufbau der diszis und gameplay
was da wirklich funktioniert, spannend ist und spaß macht! das muss alles erarbeitet werden"

Das ist ein Gegencheck-Auftrag mit zwei Teilen: (1) hält die Empfehlung der Opus-Synthese dem
Vergleich mit real existierenden Spielen stand, und (2) was folgt daraus für **alle zwanzig**
Disziplinen, nicht nur für die Arena.

**Grundlage.** Beide Vordokumente vollständig gelesen:
`docs/design/universelles-kampfmodell-recherche-20-09.md` (Fable, PR #971) und
`docs/pm-briefings/opus-synthese-universelles-kampfmodell-20-09.md` (Opus, PR #972).
Stand `origin/main` = `73e43a8b`. **Keine Zeile Code angefasst, keine Messung gefahren.**

**Die Recherche ist wirklich gelaufen.** WebSearch und WebFetch standen zur Verfügung und wurden
benutzt; alle externen Aussagen unten hängen an den Quellen in Abschnitt 8, abgerufen am 20.09.2026.
Was aus eigener Spielkenntnis statt aus einer Quelle stammt, ist als solches markiert.

---

## 0. Das Kernurteil

> **Teilweise bestätigt — und zwar asymmetrisch: in der Mechanik-Frage vollständig, in der
> Spannungs-Frage nur halb, und unter beiden liegt eine Nebenbedingung, die weder Fable noch die
> erste Synthese benannt hat.**
>
> **Bestätigt, härter als erwartet:** Chris' Formel-Fix (Tempo→Agilität, Awareness→Krit) fällt
> nicht nur an unseren eigenen Messungen durch, sondern hat in **Fire Emblem** ein lebendes
> Gegenbeispiel: dort speist Speed gleichzeitig das Ausweichen (`Avoid = Basis + 2×Attack Speed +
> Luck/2`) **und** den Doppelangriff (mehr Ereignisse) — exakt die Doppelverwertung, vor der die
> Synthese warnt, und Speed gilt dort seit Jahrzehnten als der dominante Wert. Und in **jedem**
> geprüften Taktikspiel (XCOM, Fire Emblem, D&D/BG3) sind Krit und Ausweichen **eigenständige,
> auf dem Einheitenbogen ausgewiesene Werte** — nie freie Ableitungen aus einem sonst unbepreisten
> Attribut. Das Matrixgewicht-Null-Argument der Synthese ist damit von außen bestätigt.
>
> **Nur halb bestätigt:** Die Synthese schließt, Chris' Kritik treffe „die Determiniertheit", und
> zieht daraus, es brauche **riskante Momente**. Die Vorbilder sagen etwas anderes. Keines der
> erfolgreichen Beispiele kauft Spannung mit Ergebnis-Zufall. Sie kaufen sie mit **zurückgehaltener
> Information** (Marvel Snap, `stepBuehne`), mit **Einsatz** (Snap-Würfel, Battlegrounds-Leben,
> Blaseball-Idole) und mit **sichtbarer Akkumulation auf eine Schwelle** (Darkest Dungeons
> Stressbalken). Alle drei kosten **null Rangtreue**. „Ungewissheit" und „Zufall" sind nicht
> dasselbe, und die Synthese verwechselt sie an der entscheidenden Stelle.
>
> **Der blinde Fleck beider Dokumente:** **Spannung und Rangtreue sind Gegenspieler, und dieses
> Projekt hat sich bereits für die Rangtreue entschieden.** In echten Ligen gewinnt der Favorit ein
> Einzelspiel in 64 % (NFL), 63 % (NBA), 59 % (NHL), 56 % (MLB) der Fälle. Unsere Schranke ist rho
> > 0,80 **in einem Spiel** — deutlich determinierter als jeder reale Sport. Wer unter dieser
> Schranke „mehr Ungewissheit im Ausgang" fordert, fordert eine Verletzung der Abnahmeregel. Daraus
> folgt kein Kompromiss, sondern eine Arbeitsteilung: **das Ergebnis bleibt rangtreu, die Spannung
> wandert vollständig in Enthüllung, Einsatz und Regie.** Das ist keine Notlösung — es ist genau
> das, was Football Manager seit zwanzig Jahren macht.
>
> **Neu und übertragbar, in keinem der beiden Dokumente:** die Pseudo-Random-Distribution aus
> Warcraft 3 / Dota 2 (gebundener Zufall bei gleichem Mittelwert — sie senkt exakt die Größe, die
> unsere Einzelspiel-Rangtreue drückt), XCOMs **Graze-Band** (ein Streifband statt Treffer/Fehlschlag
> — Varianz, ohne ein einziges Ereignis zu verschlucken), FM26s **Dynamic Highlight Mode**
> (Ereignisdichte folgt der Dramatik, nicht der Uhr — für alle zwanzig sofort baubar, rho-neutral)
> und die Unterscheidung **Input- gegen Output-Zufall**, die dem „Skills ja, Attribute nein" der
> Synthese erst den tragfähigen Grund gibt.

Und eine Korrektur, die klein aussieht und es nicht ist: **beide Dokumente empfehlen den
Intent-Anzeiger aus Slay the Spire als „das übertragbarste Detail des ganzen Genres".** In Slay the
Spire erzeugt der Intent Spannung, **weil der Spieler darauf reagieren kann**. Ohne Eingriff ist ein
Intent kein Spannungsmittel, sondern ein Spoiler. Er trägt nur, wenn er auf eine Entscheidung
zurückzeigt, die der Spieler vorher getroffen hat. Abschnitt 5.4.

---

## 1. Auto-Battler: wie Spannung ohne Eingriff entsteht

Geprüft: Teamfight Tactics, Hearthstone Battlegrounds, Super Auto Pets, Marvel Snap.

### 1.1 Was sie mechanisch tun

| Spiel | Auflösung im Kampf | Zufall im Kampf | Was der Spieler vorher entschied |
|---|---|---|---|
| **TFT** | Echtzeit auf dem Hexbrett, 8 Spieler, kein Eingriff | Zielwahl, Fähigkeits-Timing | Kauf, Gegenstände, **Aufstellung vorn/hinten** |
| **Hearthstone Battlegrounds** | vollständig sequenziell: Diener greifen **von links nach rechts** an, wer mehr Diener hat, beginnt; bei Gleichstand entscheidet der Zufall | **Zielwahl zufällig**, außer bei Spott | Taverne, Reihenfolge, Spott-Platzierung |
| **Super Auto Pets** | eindimensionale Reihe, vorderstes Tier gegen vorderstes, Reihe rückt nach | Trigger mit „zufälliger Verbündeter" | Reihenfolge der fünf Tiere, Futter |
| **Marvel Snap** | sechs Runden, beide legen gleichzeitig, **dann Aufdecken**; kein Auto-Kampf | Reihenfolge der Aufdeckung, Orte | Karten, Kurve, **Snap/Rückzug** |

### 1.2 Die vier Prinzipien, die sich über alle halten

**P1 — Der Kampf prüft sichtbar eine Entscheidung, die der Spieler kurz vorher getroffen hat.**
Das ist das eigentliche Genre-Merkmal, nicht das „Auto". In TFT ist es die Aufstellung, in
Battlegrounds die Reihenfolge, in Super Auto Pets die Position in der Reihe. Der Zuschauer schaut
nicht einem Kampf zu, er schaut **seiner eigenen Hypothese beim Scheitern oder Aufgehen zu**. Nimmt
man diese Entscheidung weg, bleibt ein Bildschirmschoner.

**P2 — Ein Subjekt je Moment, und Sequenz schlägt Animationstiefe.** Super Auto Pets beweist die
Untergrenze: fünf Symbole, zwei Zahlen, ein Stoß — vollkommen lesbar. TFT hat die aufwendigste
Animation und ist ohne Kamera, Farbe und Vorwissen des Spielers das **unleserlichste** der vier.
Fables Befund stimmt und ist von außen bestätigt.

**P3 — Der Einsatz liegt über dem einzelnen Kampf, nicht in ihm.** In Battlegrounds ist ein
einzelner Kampf mechanisch banal; was ihn spannend macht, ist der eigene Lebensstand über acht
Spieler hinweg. Das ist strukturell **unsere Saison**, und es ist der Grund, warum Chris' Satz
„damit man investiert ist in sein eigenes Team" nicht durch einen besseren Kampf allein zu erfüllen
ist.

**P4 — Marvel Snap kauft Spannung mit dem Einsatz, nicht mit dem Ergebnis.** Der Snap ist der
Verdopplungswürfel aus Backgammon: er verändert, **was auf dem Spiel steht**, nie, was passiert.
Ben Brode über den Rückzug: „If you decide to leave because it's strategically correct, that's not
losing!" — der Bildschirm sagt „Escaped!", und das „zeroes out the emotional negativity". Zwei
Designentscheidungen, beide auf der Einsatz-Achse, keine davon am Zufall.

### 1.3 Was davon bei uns NICHT gilt

**Kein einziges dieser Spiele hat eine Rangtreue-Nebenbedingung.** In TFT und Battlegrounds ist es
Absicht, dass eine billige Einheit eine teure schlägt, wenn sie richtig steht — Konter,
Stein-Schere-Papier und Trait-Synergien sind das Produkt. Wir müssen das Gegenteil leisten: zehn bis
zwölf Spieler in der Reihenfolge einer **von außen vorgegebenen Eignung** abbilden, rho > 0,80 in
einem Spiel. **Alles, was diese Spiele zur Balance tun, ist für uns rho-zerstörend durch
Konstruktion.** Man kann ihre Präsentation und ihre Dramaturgie übernehmen; ihre Balancelehre nicht
eine Zeile weit.

Und eine Ungenauigkeit in Fables Tabelle: Battlegrounds' Zielwahl ist **zufällig** (außer Spott).
Fable liest daraus das Muster „Reihenfolge durch Position" — die Reihenfolge des *Angreifens* ja,
die des *Angegriffenwerdens* nein. Damit hat ausgerechnet das nächstverwandte Vorbild denselben
unbepreisten Aussetzungskanal, den die Synthese bei uns aufgedeckt hat (Korrelation −0,02) — nur
stört er dort niemanden, weil dort keine Rangtreue gemessen wird. **Das ist die schärfste Illustration
dafür, warum Vorbilder hier nur die halbe Antwort geben.**

---

## 2. Taktische Kampfsysteme: wie Krit und Ausweichen wirklich gebaut werden

Geprüft: XCOM 2 (inkl. Long War), Divinity: Original Sin 2, Baldur's Gate 3 / D&D 5e, Fire Emblem.

### 2.1 Der entscheidende Befund: Krit und Ausweichen sind überall eigene, ausgewiesene Werte

| Spiel | Trefferchance aus | Ausweichen aus | Krit aus |
|---|---|---|---|
| **XCOM 2** | `Aim` des Soldaten − `Defense` des Ziels + Deckung/Entfernung | **`Dodge`** — ein eigener Wert auf dem Einheitenbogen | **`Crit Chance`** — eigener Wert, aus Waffe, Fähigkeiten, Flanke |
| **Fire Emblem** (ab Binding Blade) | `Waffen-Hit + 2×Skill + Luck/2` | `Avoid = Basis + 2×Attack Speed + Luck/2` | `Crit = Waffen-Krit + Skill/2 − Luck des Ziels` |
| **D&D 5e / BG3** | d20 + Modifikatoren gegen AC | AC, Vorteil/Nachteil | **natürliche 20** — feste 5 %, an gar keinem Attribut |
| **DOS 2** | — **Trefferchance im Kern abgeschafft** (Rüstungssystem) | — | eigener Krit-Wert |

**Nirgends** wird eine Trefferchance oder eine Krit-Chance aus einem Attribut abgeleitet, das im
Wertesystem sonst keinen Preis hat. Überall steht sie als eigene Zeile auf dem Bogen, wird beim
Balancing mitgezählt und beim Aufstieg mitgesteigert.

Damit ist die Synthese von außen bestätigt, und zwar in beiden Hälften ihres Arguments:

- **Der Preisgrund.** „Awareness → Krit" in Mini-DM gäbe einem Attribut mit **Matrixgewicht 0**
  Wirkung erster Ordnung. Kein Vorbild tut so etwas; alle führen den Wert offen.
- **Der Datengrund.** Unsere 35 Klassenkarten führen `hp, atk, def, spd, stunResist,
  knockbackResist, mana, stamina` — keine Präzision, keine Krit-Chance. Nach dem Abschrift-Vertrag
  (`BATTLE_ARENA_UEBERGABE.md`, „keine erfundenen Werte") **ist die Größe nicht kalibrierbar**, weil
  die Quelle sie nicht führt. Genau deshalb führen XCOM und Fire Emblem sie: weil man sie sonst nicht
  balancieren kann.

### 2.2 Fire Emblem ist das lebende Gegenbeispiel zu Chris' Vorschlag

Chris will „Tempo soll nicht Ereignisse, sondern Agilität geben". Fire Emblem hat genau das gebaut —
und zusätzlich das andere behalten:

- **Speed → Avoid**: `Avoid = Basis + 2×Attack Speed + Luck/2`. Genau Chris' „Tempo → Agilität".
- **Speed → Doppelangriff**: liegt die Attack Speed um 4 (je nach Teil 4 oder 5) über der des
  Gegners, **schlägt die Einheit zweimal**. Das ist genau unsere Schlagfrequenz-Kopplung.

Ergebnis: Speed ist in Fire Emblem der berüchtigt dominante Wert — er kauft Ereignisse **und**
Schutz. Die Synthese sagt über die Parade-Episode: „Es hat die Gelegenheit nicht umgeleitet, sondern
verdoppelt. Wer schnell ist, bekommt mehr Schläge *und* wird seltener getroffen." **Das ist nicht
Theorie — es ist das meistgespielte Taktik-RPG der Welt, und es ist dort ein bekanntes
Balanceproblem.** Unsere eigene Messung (Parade verschluckte bis zu 40 % aller Schläge, wurde wieder
ausgebaut) und das externe Vorbild zeigen in dieselbe Richtung.

### 2.3 Wo die Vorbilder der Synthese widersprechen — zwei Werkzeuge, die sie nicht kennt

**(a) DOS 2 hat die Trefferchance ABGESCHAFFT, und zwar aus unserem Grund.** Larian ersetzte
Trefferwürfe durch das Rüstungssystem: Statuseffekte landen erst, wenn die passende Rüstung gebrochen
ist — dann aber sicher. Der ausdrückliche Grund: Würfe mit niedriger Chance werden nie benutzt, weil
niemand Aktionspunkte auf einen Fehlschlag setzt, und Fehlschläge fressen Planung. Für uns heißt das:
**wer „Ausweichen" als Ereignisfresser baut, geht gegen den Trend des Genres, nicht mit ihm.**

**(b) XCOMs Graze-Band ist die Form von Ausweichen, die am wenigsten Rangtreue kostet — und niemand
hat sie erwähnt.** Statt Treffer/Fehlschlag gibt es ein **Band** um die Schwelle: Bei 70 % Chance und
10 Punkten Band ergibt das 60 % Treffer, **20 % Streifschuss**, 20 % Fehlschlag. Krit und Dodge sind
Verschiebungen auf **derselben Leiter**: ein Krit hebt Fehlschlag→Streifer→Treffer→Krit um eine
Stufe, ein Dodge senkt sie um eine.

Warum das für uns interessant ist: **ein Streifschuss verschluckt kein Ereignis.** Der Schlag
passiert, wird gezeigt, zählt — nur mit halber Höhe. Genau das war der Tod der alten Parade
(40 % verschluckte Schläge → weniger wirksame Ereignisse → mehr Rauschen je Spiel → niedrigeres rho).
Ein Band ist Varianz in der **Höhe**, nicht in der **Zahl** der Ereignisse. Es löst das Preisproblem
nicht (die Bandbreite müsste an bepreisten Attributen hängen), aber es löst das Verlässlichkeitsproblem,
an dem der letzte Anlauf gestorben ist. **Falls Chris auf einem Ausweich-Gefühl besteht, ist das die
Form, die man messen sollte — nicht die binäre.**

### 2.4 Gebundener Zufall: das Werkzeug, das exakt unsere Kenngröße senkt

Warcraft 3 und Dota 2 benutzen für Krit, Bash und Verwandtes keine unabhängigen Würfe, sondern
**Pseudo Random Distribution**: Die Chance steigt nach jedem Fehlschlag um einen festen Betrag und
wird nach einem Treffer zurückgesetzt. Der Mittelwert bleibt gleich, die Streuung sinkt drastisch —
die Wahrscheinlichkeit für zwei Krits hintereinander fällt bei nominell 10 % von 10 % auf **1,5 %**.

Das ist direkt auf unsere Zwei-Spalten-Rechnung übersetzbar:

    rho(ein Spiel) = rho(Saison) × Wurzel(Verlässlichkeit)

Die Verlässlichkeit ist nichts anderes als „wie wenig streut ein Spiel um den Erwartungswert". **PRD
senkt genau diese Streuung, ohne den Erwartungswert zu verschieben — also ohne die Validität
anzutasten.** Es ist damit das einzige gefundene Werkzeug, das rho je Spiel heben kann, ohne am
Rezept oder an der Uhr zu drehen. CLAUDE.md sagt: „Mehr Ereignisse helfen fast nie" — PRD ist der
andere Weg zum selben Ziel: **gleich viele Ereignisse, weniger Streuung je Ereignis.**

**Konkrete Leitplanke daraus: Jede Wahrscheinlichkeit, die in diesem Projekt je eingeführt wird,
sollte PRD-förmig sein und nicht unabhängig gezogen.** Das gilt für die 86 `rr()`-Stellen im
Feldspiel genauso wie für einen künftigen Skill-Proc. Es ist ein Einzeiler je Stelle und ein
messbarer Kandidat für die Verlässlichkeit von Football (0,405, die niedrigste der zwanzig).

### 2.5 Input- gegen Output-Zufall: der Grund unter der Skill-Empfehlung

Die Unterscheidung ist Standard in der Designliteratur (Burgun u. a.):

- **Input-Zufall** informiert **vor** der Entscheidung: Kartenangebot, Kartenhand, Startaufstellung,
  Gegnerauslosung. Er erzeugt Vielfalt, ohne Planung zu entwerten.
- **Output-Zufall** liegt **zwischen** Entscheidung und Ergebnis: der Trefferwurf, der Krit-Wurf.
  Er erzeugt Schwung, aber er verrauscht genau die Zuordnung von Können zu Ergebnis.

**rho ist nichts anderes als ein Maß für Output-Zufall.** Eine hohe Rangtreue je Spiel heißt: wenig
Rauschen zwischen Eignung und Ergebnis. Damit ist die Frage „darf es Krit geben?" beantwortbar, ohne
über Geschmack zu streiten:

> **Zufall, der VOR dem Spiel gezogen wird, ist bei uns gratis. Zufall, der WÄHREND des Spiels
> gezogen wird, wird direkt von der Abnahmezahl bestraft.**

Das trägt die Skill-Empfehlung der Synthese — **und es korrigiert sie an einer Stelle**. Die Synthese
begründet die Legitimität von Krits auf der Skill-Ebene damit, dass die Klassenkarten Skills mit
Krit-Chance ausweisen dürfen. Das ist der Datengrund und er stimmt. Aber der Rangtreue-Grund ist ein
anderer und strenger: **Ein Skill ist nur dann rho-freundlich, wenn seine Zuteilung der Zufall ist
(Input) und seine Wirkung im Kampf deterministisch (kein Output).** Ein Skill-Pool, der drei Angebote
nach dem Kampf zieht und dann im nächsten Kampf je Schlag eine 15-%-Krit-Chance würfelt, hat den
Kanal nur umgetauft. `roguelike-skill-pool-konzept-17-09.md` zieht per Saat aus (Spieler, Saison,
Spieltag) — das ist die richtige Hälfte. Die zweite Hälfte muss in der Abnahme von S1 stehen:
**Skillwirkungen deterministisch oder PRD-gebunden, nie frei gewürfelt.**

---

## 3. Sport-Management und Kader-RPGs: woher Teambindung wirklich kommt

Geprüft: Football Manager (26), Blood Bowl, Mordheim / Necromunda, Battle Brothers, Darkest Dungeon,
FUT / NBA 2K MyTeam, Blaseball.

### 3.1 Football Manager — das nächstverwandte Vorbild überhaupt

FM hat exakt unser Problem: **das Ergebnis ist simuliert und steht fest, ein Mensch schaut zu.** Was
FM 26 dagegen tut, ist vollständig Präsentation:

| Werkzeug | Was es tut | Bei uns |
|---|---|---|
| **Dynamic Highlight Mode** | Die **Zahl der gezeigten Höhepunkte folgt der Dramatik**: „the more important and more dramatic a game, the more highlights you'll see" — führt man 4:0, sinkt sie | **Für alle zwanzig sofort baubar und rho-neutral.** Abschnitt 6, L5 |
| **Broadcast-Kamera** | mehr Winkel, an echter TV-Regie orientiert | steht als Konzept bereits (`broadcast-praesentation-uebergreifend-recherche-06-09.md`) |
| **Wiederholung nach Torart** | die Wiederholung wird **nach Art des Tores** ausgewählt | `big`-Flag im Ticker trägt die Information schon |
| **Kommentar** | hunderte Zeilen, ereignisgetrieben, manche „once-in-a-save" | Callout-Baustein |

**Der Dynamic Highlight Mode ist der wichtigste einzelne Fund dieser Recherche für die anderen
neunzehn Disziplinen.** Er beantwortet Chris' Kritik („nur Stats die sich ändern") ohne einen einzigen
Motoreingriff: die Dichte der gezeigten Momente richtet sich nach Knappheit und Bedeutung, nicht nach
der Uhr. Ein 100-m-Lauf mit drei Sekunden Rückstand des Feldes darf kürzer gezeigt werden als einer,
in dem zwei Läufer auf der Ziellinie stehen. Ein Eiskunstlauf-Durchgang, der die Führung ändert,
bekommt mehr Bild als einer, der sie bestätigt.

### 3.2 Blood Bowl — bestätigt Fables Vorbehalt und verschärft ihn

Blood Bowls Kern ist die **Turnover-Regel**: der erste misslungene Wurf beendet den Zug sofort. Das
ist reines Risikomanagement: „identifying that pivot point between being risk averse and being willing
to take the lower odds option is one of the hardest things to master". Die Spannung liegt zu 100 %
darin, dass **ein Mensch entscheidet, wie viel Risiko er nimmt**.

Für einen Zuschauer-Auto-Battler ist Turnover nicht nur nicht übertragbar, sondern **aktiv
schädlich**: ein Zug, der auf einem Fehlwurf endet, ist aus Zuschauersicht Totzeit ohne Subjekt.
Fables Punkt (Bots spielen Blood Bowl schlecht, Justesen et al.) steht; ich ergänze den
dramaturgischen: **ohne Entscheider ist push-your-luck kein Spannungsmittel, sondern ein
Stotterer.**

### 3.3 Mordheim, Necromunda, Battle Brothers — Bindung durch Persistenz, mit einer Warnung

Diese Familie ist strukturell unser Modell: Kaderverwaltung + benannte Figuren + Kämpfe, die Spuren
hinterlassen. Mordheim: „All injuries from falling Out of Action are permanent" — sie senken Werte,
kosten Gliedmaßen oder töten. Battle Brothers: Permadeath ist so zentral, dass es **deshalb keine
Spielerfigur im Kampf gibt**; der Kader ist größer als die zwölf Aufgestellten, damit Verletzte
ruhen können.

**Und die Warnung, die das Genre selbst ausspricht** — ein oft zitierter Spielerbefund zu Mordheim:
*„Getting attached to units is a mistake in this game. Be attached to the warband instead."* Der
Grund: Verletzungen gehen dort **nur nach unten**. Ein Kämpfer, der sein Maximum erreicht hat, wird
ab dann monoton schlechter, und Spieler lösen sich innerlich von ihm.

> **Leitplanke daraus: Folgen müssen in beide Richtungen gehen.** Wer Narben einführt, muss im selben
> Zug Wachstum einführen, sonst erzeugt Persistenz Ablösung statt Bindung. Für uns heißt das: die
> Skill-/Item-Ebene (S1) ist nicht nur ein Spannungsmittel, sie ist die **Gegenrichtung**, ohne die
> ein späteres Verletzungssystem nach hinten losginge.

### 3.4 Darkest Dungeon — die sauberste Wendepunkt-Mechanik, die es gibt

Der Stressbalken füllt sich sichtbar über die Expedition; bei 100 kippt die Figur in eine
**Affliction** oder — seltener — in eine **Virtue**. Red Hook: „Any person can break under pressure,
and people break in different ways", und: die Affliction-Prüfung wird mit großem Tamtam inszeniert.

Zwei Dinge daran sind für uns wichtig, und sie trennen sauber:

1. **Die Form ist Gold.** Ein **sichtbar sich füllender Balken mit einer Schwelle** erzeugt
   Erwartung ohne einen einzigen Würfel. Der Zuschauer weiß, dass gleich etwas passiert, und weiß
   nicht, was — das ist Ungewissheit, die nichts mit Ergebnis-Zufall zu tun hat. **Der Schwellenübertritt
   selbst darf bei uns vollständig deterministisch und eignungsgetrieben sein und bleibt damit
   rho-neutral.**
2. **Der Würfel ist es nicht.** Die 75/25-Aufteilung zwischen Affliction und Virtue ist lupenreiner
   Output-Zufall. **Die Form übernehmen, den Würfel stehen lassen.**

Und der Satz, der fast als Projektmotto durchgeht: „The Affliction system puts the player squarely in
the role of a team manager, squad leader, or **hockey coach**."

### 3.5 FUT und NBA 2K MyTeam — was übertragbar ist und was nicht

Die Bindung dort entsteht aus dem **Erwerb**: variable Belohnung beim Packöffnen, Sammeltrieb,
„completion drive", die Geschichte, wie man an eine Karte kam. **Nicht übertragbar** ist der
Glücksspielkern — wir haben einen Transfermarkt mit Preisen, keine Lootboxen, und das soll so
bleiben.

**Übertragbar ist genau ein Punkt, und er ist präzise:** die Karte, die man gezogen oder gekauft hat,
ist in FUT **überall dasselbe visuelle Objekt** — im Pack, im Kader, im Markt, im Spiel. Diese
Objektkonstanz ist der Träger der Bindung. Genau das ist K1 (`renderKader()`: Kachel → Portrait-Karte)
— und dieser Vergleich hebt K1 im Rang: es ist kein Kosmetik-Nachzügler der Broadcast-Welle, sondern
der Bindungsträger, den beide Kartenspiel-Vorbilder als erstes bauen.

### 3.6 Blaseball — der Extremfall, den beide Dokumente übersehen haben

Blaseball war eine Baseball-Simulation **ohne jeden Eingriff**: reiner Text, alle paar Minuten ein
Spiel, kein Spielbrett, keine Sprites, keine Karten. Es erzeugte eine der intensivsten
Fan-Bindungen, die ein Browserspiel je hatte. Die Mittel, aus der Berichterstattung destilliert:

- **Man wählt ein Team und ein Idol** — und bekommt Vorteile, wenn sie gut spielen. Einsatz, bevor
  irgendetwas passiert.
- **Rund 380 Spieler hatten Namen und Hintergrund**; die Statistiken waren echt, die Geschichten
  entstanden aus ihnen.
- **Ereignisse waren endgültig** (Spieler konnten verbrennen) — Persistenz mit Konsequenz.
- Das Spiel „didn't just want players to play; it wanted them to care about the simulation the same
  way they care about real sports".

**Der Befund, der für Chris zählt: Bindung braucht keine Grafik und keinen Eingriff — sie braucht
Identität, Einsatz und Endgültigkeit.** Das ist die härteste verfügbare Gegenprobe zur These „HP-Balken
erzeugen keine Spannung". Sie erzeugen tatsächlich keine — aber nicht, weil sie Balken sind, sondern
weil über ihnen kein Name steht, an dem etwas hängt.

Was **nicht** übertragbar ist: Blaseballs eigentlicher Motor war die Gemeinschaft — Discord,
kollektive Regeländerungen, gemeinsam erfundene Lore. Ein Einzelspieler-Spielstand hat das nicht. Was
übertragbar ist, ist die Teilmenge, die ohne Publikum funktioniert: **benannte, wiedererkennbare
Spieler; ein sichtbarer Einsatz vor dem Anpfiff; Ereignisse, die bleiben.**

---

## 4. Was alle erfolgreichen Vorbilder gemeinsam haben

Über alle vier Kategorien halten sich sechs Sätze. Sie sind die Antwort auf Chris' „was funktioniert
da wirklich".

| | Prinzip | Beleg quer über die Vorbilder |
|---|---|---|
| **G1** | **Der gezeigte Verlauf prüft eine Entscheidung, die der Zuschauer selbst getroffen hat.** | TFT-Aufstellung, Battlegrounds-Taverne, SAP-Reihenfolge, FM-Taktik, Blaseball-Idol, MyTeam-Kader |
| **G2** | **Spannung wird mit Information und Einsatz gekauft, nie mit Ergebnis-Zufall.** | Snap-Würfel und „Escaped!", Marvel-Snap-Aufdeckung, FM Dynamic Highlights, Darkest-Dungeon-Balken |
| **G3** | **Ein Subjekt je Moment; Sequenz schlägt Animationstiefe.** | SAP (Untergrenze), Battlegrounds, `zeichneHeben()` bei uns — und TFT als Gegenbeispiel |
| **G4** | **Identität ist persistent und überall dasselbe Objekt.** | FUT-Karte, Blaseball-Namen, Battle-Brothers-Kader, Mordheim-Warband |
| **G5** | **Folgen bleiben, und sie gehen in beide Richtungen.** | Mordheim/Necromunda (Narben), Battle Brothers (Tod), Darkest Dungeon (Affliction **und** Virtue), Roguelike-Aufstieg |
| **G6** | **Wenn gewürfelt wird, dann gebunden und früh.** | PRD in Wc3/Dota, XCOM-Graze-Band statt binär, DOS 2 schafft den Trefferwurf ganz ab, Input- statt Output-Zufall |

**Kein einziges Vorbild braucht Echtzeit für Spannung.** Aber jedes braucht einen Takt, **in dem ein
Moment Platz hat** — und genau das ist das Argument für die Runde, unabhängig von jeder
Rangtreue-Hoffnung.

---

## 5. Was das für unsere Synthese bedeutet

### 5.1 Bestätigt

| Empfehlung der Synthese | Externe Bestätigung |
|---|---|
| **Split beim Takt, ein System bei der Präsentation** | FM zeigt dasselbe Grafikpaket über eine Sportart; das Genre trennt Vorbereitungsschicht und Kampfschicht überall |
| **Chris' Formel-Fix als Mechanik: nein** | Fire Emblem baut ihn und leidet daran; XCOM/FE/D&D führen Krit und Dodge als eigene, bepreiste Werte; keine unserer 35 Karten führt sie |
| **Krit/Ausweichen gehören an den Skill** | bestätigt, und mit einem zweiten, strengeren Grund versehen (5.3) |
| **Karten + Sprite als Hybrid** | im Genre alles vertreten (Karten, Figuren, Symbole) — die Wahl ist frei, entscheidend ist G3, nicht die Karte |
| **Football ist bereits rundenbasiert, sichtbar machen genügt** | FMs Ansatz ist wörtlich derselbe: Ergebnis steht, Regie macht daraus ein Erlebnis |
| **Basketball/Hockey nicht in Runden zwingen** | OOTP zeigt, dass „rundenbasiert" nur trägt, wo der Sport selbst diskret ist; Fließsportarten werden in keinem erfolgreichen Titel zerlegt |

### 5.2 Korrigiert: „Ungewissheit" ist nicht „Zufall"

Die Synthese schreibt, Chris' Kritik treffe „nicht das Rundenmodell, sondern die Determiniertheit",
und es fehlten „**riskante Momente**". Der erste Halbsatz ist richtig und wichtig. Der zweite ist die
falsche Folgerung und würde, gebaut, direkt gegen die Abnahmeregel arbeiten.

**Die Zahlen, die das entscheiden:** In echten Ligen gewinnt der Favorit ein Einzelspiel in 64 %
(NFL), 63 % (NBA), 59 % (NHL), 56 % (MLB) der Fälle. Das ist die Ungewissheit, aus der echter Sport
seine Spannung zieht — und sie ist **weit** unter dem, was rho > 0,80 in einem Spiel erlaubt. Chris
hat für Hockey ausdrücklich „rangtreuer als echtes Eishockey" abgenommen. **Er hat damit bereits
entschieden, dass er weniger Ergebnis-Ungewissheit will als der reale Sport — und kann deshalb nicht
zusätzlich Spannung aus dem Ergebnis beziehen.** Das ist kein Vorwurf, es ist eine Buchhaltung: das
Konto „Ungewissheit im Ausgang" ist durch die Abnahmeregel belegt.

Die Vorbilder zeigen, wo sie stattdessen herkommt — drei Quellen, alle rho-neutral:

| Quelle | Vorbild | Bei uns sofort verfügbar |
|---|---|---|
| **Zurückgehaltene Information** | Marvel-Snap-Aufdeckung; FM zeigt nur Höhepunkte | `stepBuehne()` tut es bereits; jeder Motor mit Protokoll kann es |
| **Einsatz** | Snap-Würfel, Battlegrounds-Leben, Blaseball-Idol | „zählt für Spieltag 7", Tabellenlage, Auf-/Abstieg, **A3** |
| **Sichtbare Akkumulation auf eine Schwelle** | Darkest-Dungeon-Stress | Puste, Strafenzeit, Momentum, Foulkonto — teils schon im Motor, nur nicht als Erwartungsbogen gezeigt |

> **Die präzise Korrektur: Beat 3 und 5 des B0-Drehbuchs sind richtig — aber sie dürfen nicht als
> Versprechen auf einen späteren Würfel verstanden werden.** Das Mockup soll zeigen, dass ein
> **feststehender** Verlauf spannend inszenierbar ist. Wenn Chris es abnimmt, ist bewiesen, dass
> Spannung und Rangtreue vereinbar sind. Wenn die Beats nur dadurch funktionieren, dass sie zufällig
> sind, hat das Mockup das Gegenteil bewiesen und wir merken es zu spät. **B0 sollte deshalb
> ausdrücklich ohne jeden Zufall gescriptet sein und das auch dazuschreiben.**

### 5.3 Ergänzt: drei Werkzeuge, die in keinem der beiden Dokumente stehen

1. **PRD (gebundener Zufall).** Senkt die Streuung je Spiel bei gleichem Mittelwert — also genau den
   Faktor `Wurzel(Verlässlichkeit)` in unserer eigenen Formel, ohne die Validität anzufassen. Das ist
   der einzige gefundene Hebel, der rho je Spiel hebt, ohne Rezept oder Uhr anzufassen. **Vorschlag:
   als billige Sondenvariante in A1.0 aufnehmen — Variante E: alle `rr()`-Wahrscheinlichkeiten
   PRD-gebunden.** Kostet wenig und ist für Football (Verlässlichkeit 0,405) der plausibelste Kandidat
   im ganzen Feld.
2. **Graze-Band statt binärem Ausweichen.** Falls Chris auf dem Ausweich-Gefühl besteht: ein
   Streifband verschluckt kein Ereignis, sondern halbiert seine Höhe. Der historische Parade-Schaden
   (40 % verschluckte Schläge) entsteht so nicht. Das Preisproblem bleibt und muss über bepreiste
   Attribute gelöst werden — aber es ist die einzige Form, die überhaupt eine Chance auf die Messung
   hat.
3. **Dynamic Highlight Mode.** Ereignisdichte nach Dramatik statt nach Uhr. Rho-neutral, für alle
   zwanzig, und die direkteste verfügbare Antwort auf „das erzeugt keine Spannung".

### 5.4 Widersprochen: der Intent-Anzeiger ist ohne Entscheidung ein Spoiler

Beide Dokumente nennen Slay the Spires Intent „das übertragbarste Detail des ganzen Genres"; die
Synthese empfiehlt ihn und begründet: „Ungewissheit über den AUSGANG ist spannender als Ungewissheit
über die ABSICHT."

Die Quellen zeigen, warum der Intent dort wirkt, und der Grund fehlt bei uns: „When you know what the
enemy is about to do, you can **make informed choices** about what actions to take." Der Intent ist
ein **Entscheidungswerkzeug**. Er erzeugt Spannung, weil er eine Frage stellt, die der Spieler
beantworten muss — angreifen oder blocken.

Ein Zuschauer ohne Eingriff kann nicht antworten. Für ihn ist „Schleicher geht hinten rum" schlicht
die Vorwegnahme dessen, was er gleich sieht. Das ist nicht null wert — Vorahnung ist ein echtes
Erzählmittel —, aber es ist nicht das, wofür Slay the Spire zitiert wird.

> **Der Intent trägt bei uns nur, wenn er auf eine Entscheidung zurückzeigt, die der Spieler bereits
> getroffen hat**: „Schleicher geht hinten rum — **dein Bollwerk steht links**." Dann ist es keine
> Ansage, sondern die Prüfung einer Aufstellung, und damit G1. Ohne diese Rückbindung sollte man
> ihn in B0 testen, aber nicht als gesetzt behandeln.

### 5.5 Der größere blinde Fleck: der Arena fehlt vielleicht nicht das Subjekt, sondern die geprüfte Entscheidung

G1 ist das stärkste Prinzip der Recherche, und es passt auf unsere Lage unangenehm genau. Beide
Dokumente erklären das Arena-Problem mit **fehlendem Subjekt** (zwölf Figuren gleichzeitig, Regie hat
nichts zu greifen). Das stimmt. Aber in jedem Vorbild liegt zwischen der Entscheidung des Spielers
und dem Kampf **eine Minute**, und im Kampf ist zu sehen, ob sie richtig war. Bei uns liegen dazwischen
Transferfenster, Training und ein Spielplan — **und laut Abschnitt 4.3 der Synthese reicht der Host
nicht einmal die gebuchte Saat durch, der Zuschauer sieht also nicht einmal den Kampf, der gezählt
hat.**

Zwei Folgerungen:

1. **A3 (Saat durchreichen) ist nicht nur „Einsatz", es ist die Vorbedingung für das ganze
   Genre-Muster.** Solange der gezeigte Lauf nicht der gebuchte ist, ist G1 verletzt und **kein**
   Präsentationsaufwand kann das heilen. Die Synthese hat A3 hochgezogen — dieser Gegencheck sagt:
   zu Recht, und noch deutlicher.
2. **Eine sichtbare Vorkampf-Entscheidung für die Arena wäre der stärkste Einzelhebel auf Chris'
   eigener Messlatte** — Aufstellung vorn/hinten, wer deckt wen. Aber **Vorsicht, und das ist der
   Grund, warum es nicht in diesen Plan gehört:** genau diese Entscheidung greift in den
   Aussetzungskanal, den die Synthese gerade erst entdeckt hat (Zielwahl nach Geometrie, Korrelation
   Eignung↔Angreifer-je-Lebenssekunde = −0,02). Spielerpositionierung bei offenem Kanal hieße, dass
   der Spieler seinen Star aus der Schusslinie stellen kann — ein neuer, unbepreister Einflussweg
   auf das Ergebnis. **Erst A1.0 messen (Variante C: Zielwahl gleichverteilt), dann über
   Spieleraufstellung reden. Nicht umgekehrt.**

### 5.6 Rangordnung, die sich aus dem Vergleich ändert

Die Reihenfolge der Synthese (B0 → A1.0 → A1.1, daneben A3/F1/K1/S1) bleibt richtig. Der Vergleich
verschiebt zwei Gewichte:

| | Synthese | nach dem Gegencheck |
|---|---|---|
| **A3** (Saat durchreichen) | hochgezogen, „Bindungsträger Einsatz" | **Vorbedingung für G1** — ohne sie ist die Arena kein Auto-Battler, sondern ein Video |
| **K1** (Kachel → Karte) | „gehört in die Broadcast-Welle", später | **hoch** — Objektkonstanz ist in FUT und Blaseball der erste gebaute Bindungsträger, und es gilt für alle zwanzig |
| **A1.1** (Rundenpilot) | mittlere Erwartung | unverändert; die Vorbilder stützen die Runde **dramaturgisch** (Platz für einen Moment), nicht rangtreulich |
| **neu: Highlight-Dosierung** | — | klein, rho-neutral, wirkt auf alle zwanzig, direkteste Antwort auf „keine Spannung" |
| **neu: PRD-Variante in A1.0** | — | klein, und der einzige Kandidat, der rho je Spiel ohne Rezeptänderung heben kann |

---

## 6. Allgemeine Gameplay-Leitplanken für alle zwanzig Disziplinen

Das ist die Antwort auf Chris' größere Bitte. Neun Leitplanken, jede aus den Vorbildern abgeleitet,
jede an unseren Nebenbedingungen geprüft. Sie sind als Prüffragen formuliert, damit sie bei jeder
künftigen Disziplin-Aufwertung abgehakt werden können.

| | Leitplanke | Prüffrage vor jedem Disziplin-Umbau | Herkunft |
|---|---|---|---|
| **L1** | **Jede Disziplin muss eine Entscheidung des Spielers sichtbar prüfen — und der gezeigte Lauf muss der gebuchte sein.** | *Welche Entscheidung von Chris entscheidet hier mit, und sieht man sie im Bild?* Bühne: Kader und Reihenfolge. Bahn: Rollen und Krafteinteilung. Feldspiel: Rollenbesetzung. Arena: Formation. | G1 |
| **L2** | **Spannung wird mit Information und Einsatz gekauft, nicht mit Ergebnis-Zufall.** Drei Werkzeuge: Enthüllung verzögern, Einsatz zeigen, einen Balken sichtbar füllen lassen. | *Was weiß der Zuschauer noch nicht, und was steht für ihn auf dem Spiel?* | G2, 5.2 |
| **L3** | **Wenn gewürfelt wird: gebunden und früh.** Input-Zufall (vor dem Spiel gezogen) ist gratis; Output-Zufall wird von rho direkt bestraft. Wo Output unvermeidbar ist: PRD statt unabhängig, Band statt binär. | *Wird hier während des Spiels gewürfelt? Wenn ja: gebunden? Wenn nein: könnte es vorgezogen werden?* | G6, 2.4, 2.5 |
| **L4** | **Ein Subjekt je Moment.** Es muss immer genau eine Stelle geben, auf die die Regie zeigt. Sequenz schlägt Animationstiefe. | *Wenn ich das Bild anhalte — weiß ich, wer gerade handelt und gegen wen?* | G3 |
| **L5** | **Dosierung nach Dramatik, nicht nach Uhr.** Die Zahl der gezeigten Momente folgt Knappheit und Bedeutung. | *Sieht ein 40:12 genauso lang aus wie ein 40:39?* | FM26 |
| **L6** | **Identität ist persistent und überall dasselbe Objekt.** Dasselbe Portrait, derselbe Name, dieselbe Rolle in Kader, Markt und Wettkampf. | *Erkennt Chris seinen Mann im Wettkampf ohne nachzusehen?* | G4, FUT, Blaseball |
| **L7** | **Folgen bleiben — und sie gehen in beide Richtungen.** Narben nie ohne Wachstum. | *Kann hier etwas dauerhaft besser werden, nicht nur schlechter?* | G5, Mordheim-Warnung |
| **L8** | **Keine Größe bekommt Wirkung, bevor sie einen Preis in der Matrix hat.** Krit, Ausweichen, Tempo, Initiative — alles, was das Ergebnis beeinflusst, steht entweder in der Eignungsmatrix oder auf einer echten Klassenkarte. | *Welches Matrixgewicht hat das Attribut, das ich hier gerade wirksam mache?* | XCOM, Fire Emblem, D&D — und die eigene TDM-Narbe |
| **L9** | **Der Nacherzähl-Test steht neben rho.** Ein Spiel ist erst fertig, wenn man es in drei Sätzen nacherzählen kann und darin mindestens ein „hätte fast" vorkommt. | *Erzähl das Spiel in drei Sätzen. Geht nicht? Dann fehlt Regie, nicht Motor.* | Blaseball, FM, Darkest Dungeon |

**Wie man die neun benutzt.** Sie sind bewusst so geschnitten, dass L1, L4, L5, L6 und L9 **rein
präsentationsseitig** sind — sie berühren `wert()` und `rr()` nicht und sind damit ohne neue
Basislinie umsetzbar. L2, L3, L7 und L8 sind Mechanik und brauchen jeweils eine Messung. Für eine
Disziplin, die bereits über 0,80 steht, sind ausschließlich die fünf präsentationsseitigen relevant —
**das ist die Regel, die verhindert, dass eine bestandene Disziplin für ein Gefühl neu kalibriert
wird.**

---

## 7. Was ausdrücklich NICHT übertragbar ist

Chris hat darum gebeten, das explizit zu sagen. Sechs Punkte:

1. **Die Balancelehre der Auto-Battler.** TFT, Battlegrounds und Super Auto Pets sind darauf gebaut,
   dass eine billige Einheit eine teure schlagen kann — Konter und Synergien sind das Produkt. Wir
   müssen zehn bis zwölf Spieler nach einer **von außen vorgegebenen Eignung** ordnen. Jede
   Konter-Mechanik ist bei uns rho-zerstörend durch Konstruktion. **Kein Vorbild teilt unsere
   Nebenbedingung — nicht eines.**
2. **Reiner Kartenlook.** Nicht aus Geschmack, sondern aus Bestand: siebzehn Disziplinen zeigen
   denselben Spieler als Sprite, samt der gerade freigeschalteten Requisiten- und Waffenebene
   (A0.1). Eine Karten-Arena wäre ein Fremdkörper.
3. **Blood Bowls Turnover.** Braucht einen Menschen, der Risiko dosiert. Ohne Entscheider ist ein
   abgebrochener Zug Totzeit ohne Subjekt — Anti-Dramaturgie.
4. **Marvel Snaps Snap-Würfel in der reinen Form.** Braucht einen menschlichen Gegner und eine
   Verdopplung. Übertragbar ist nur der Kern: **sichtbarer Einsatz vor dem Anpfiff** (Tabellenlage,
   Pokalrunde, „zählt für Spieltag 7").
5. **Blaseballs eigentlicher Motor.** Der war die Gemeinschaft — Discord, kollektive Regelwahl,
   gemeinsam erfundene Lore. Ein Einzelspieler-Spielstand hat kein Publikum. Übertragbar ist nur die
   Teilmenge ohne Publikum: Namen, Einsatz, Endgültigkeit.
6. **Darkest Dungeons 75/25-Wurf** und **Fire Emblems Ausweich-Ableitung**. Beide sind Output-Zufall
   bzw. Doppelverwertung — die Form übernehmen, die Mechanik stehen lassen.

---

## 8. Quellen

**Im Repo:** `docs/design/universelles-kampfmodell-recherche-20-09.md` (Fable, PR #971);
`docs/pm-briefings/opus-synthese-universelles-kampfmodell-20-09.md` (Opus, PR #972);
`docs/design/arena-tempo-schlagfrequenz.md`; `docs/design/stand-aller-disziplinen.md`;
`docs/design/roguelike-skill-pool-konzept-17-09.md`;
`docs/design/broadcast-praesentation-uebergreifend-recherche-06-09.md`; `CLAUDE.md` (Zwei-Spalten-Regel,
Abnahmeschranke); `public/mockups/battle-mode.engine.js`.

**Extern, abgerufen am 20.09.2026:**

Auto-Battler —
[Auto battler (Wikipedia)](https://en.wikipedia.org/wiki/Auto_battler) ·
[Teamfight Tactics (Wikipedia)](https://en.wikipedia.org/wiki/Teamfight_Tactics) ·
[Battlegrounds — Hearthstone Wiki](https://hearthstone.fandom.com/wiki/Battlegrounds) ·
[Battlegrounds/Taunt — Hearthstone Wiki](https://hearthstone.fandom.com/wiki/Battlegrounds/Taunt) ·
[Hearthstone Battlegrounds Guide (PCGamesN)](https://www.pcgamesn.com/hearthstone/battlegrounds-guide-how-to-play) ·
[Super Auto Pets (Wikipedia)](https://en.wikipedia.org/wiki/Super_Auto_Pets) ·
[Super Auto Pets mechanics (a327ex)](https://a327ex.com/posts/super_auto_pets_mechanics) ·
[Marvel Snap (Wikipedia)](https://en.wikipedia.org/wiki/Marvel_Snap) ·
[Ben Brode über Marvel Snaps Rezept (mobilegamer.biz)](https://mobilegamer.biz/second-dinners-ben-brode-reveals-marvel-snaps-recipe-for-success-literally/) ·
[Behind the Design: MARVEL SNAP (Apple Developer)](https://developer.apple.com/news/?id=sosm2p7q) ·
[Designing 'MARVEL SNAP' (GDC Vault)](https://gdcvault.com/play/1029024/Designing-MARVEL-SNAP)

Taktische Kampfsysteme —
[XCOM 2 Mechanics (LW2, UFOpaedia)](https://www.ufopaedia.org/index.php/Mechanics_(LW2)) ·
[XCOM 2 Mechanics (LWOTC, UFOpaedia)](https://www.ufopaedia.org/index.php/Mechanics_(LWOTC)) ·
[XCOM 2 hit/crit/graze als exakte Brüche (Diceplots)](https://diceplots.com/games/xcom/) ·
[Dodge vs. Hit vs. Crit (XCOM 2 Steam-Diskussion)](https://steamcommunity.com/app/268500/discussions/0/1471967615856106473/) ·
[Battle Formulas — Fire Emblem Wiki](https://fireemblem.fandom.com/wiki/Battle_Formulas) ·
[Hit rate — Fire Emblem Wiki](https://fireemblemwiki.org/wiki/Hit_rate) ·
[Attack Speed (stat) — Fire Emblem Wiki](https://fireemblem.fandom.com/wiki/Attack_Speed_(stat)) ·
[Doubling und Speed — Designdiskussion (Fire Emblem Universe)](https://feuniverse.us/t/various-thoughts-on-doubling-and-its-relation-to-speed-concepts-for-different-doubling-systems/35518) ·
[Das Rüstungssystem in DOS 2 (Steam-Diskussion)](https://steamcommunity.com/app/435150/discussions/0/1495615865214005199/) ·
[Intent — Slay the Spire Wiki](https://slaythespire.wiki.gg/wiki/Intent) ·
[Reveal Enemy Intents (gordianblade.com)](https://gordianblade.com/reveal-enemy-intents-or-how-i-run-rpg-combats-like-slay-the-spire/)

Zufall und Varianz —
[Pseudo Random Distribution — Liquipedia Dota 2](https://liquipedia.net/dota2/Pseudo_Random_Distribution) ·
[Pseudo Random Distribution — Liquipedia Warcraft](https://liquipedia.net/warcraft/Pseudo_Random_Distribution) ·
[Pseudo-Random Mechanics (Dotabuff)](https://www.dotabuff.com/blog/2016-01-03-pseudorandom-mechanics--and-how-to-use-them-to-your-advantage) ·
[Randomness and Game Design (Keith Burgun)](http://keithburgun.net/randomness-and-game-design/) ·
[Randomness and Game Design (Game Developer)](https://www.gamedeveloper.com/design/randomness-and-game-design) ·
[Effect of Input-output Randomness on Gameplay Satisfaction in Collectable Card Games (arXiv)](https://arxiv.org/pdf/2107.08437)

Sport-Management und Kader-RPGs —
[Where Storytelling Evolves: FM26's Match Day Experience](https://www.footballmanager.com/fm26/features/where-storytelling-evolves-fm26s-match-day-experience) ·
[The very best of FM commentary](https://www.footballmanager.com/the-byline/very-best-fm-commentary) ·
[BloodBowl: Managing Risk (Frontline Gaming)](https://frontlinegaming.org/2020/08/30/bloodbowl-managing-risk/) ·
[Blood Bowl Basics — Risk, Rerolls, and the Rule of 5](https://clawbloodbowl.uk/2026/07/29/blood-bowl-basics-core-concepts-part-1-risk-rerolls-and-the-rule-of-5/) ·
[Mordheim: City of the Damned (Wikipedia)](https://en.wikipedia.org/wiki/Mordheim:_City_of_the_Damned) ·
[Injuries — Mordheim: City of the Damned Wiki](https://mordheimcotd.fandom.com/wiki/Injuries) ·
[Necromunda: Underhive Wars (Wikipedia)](https://en.wikipedia.org/wiki/Necromunda:_Underhive_Wars) ·
[Battle Brothers FAQ (Entwicklerblog)](https://battlebrothersgame.com/battle-brothers-faq/) ·
[Game Mechanics — Battle Brothers Wiki](https://battlebrothers.fandom.com/wiki/Game_Mechanics) ·
[Game Design Deep Dive: Darkest Dungeon's Affliction System (Game Developer)](https://www.gamedeveloper.com/design/game-design-deep-dive-i-darkest-dungeon-s-i-affliction-system) ·
[Inside Blaseball (Defector)](https://defector.com/inside-blaseball) ·
[Aaron Lim: About Blaseball (New Rules)](https://newrules.website/2021/01/12/aaron-lim-about-blaseball/) ·
[It's Blaseball, Not Baseball (SUPERJUMP)](https://medium.com/super-jump/its-blaseball-not-baseball-92456c2aaa40)

Sport-Statistik (Einzelspiel-Vorhersagbarkeit) —
[Parity and Predictability of Competitions (Ben-Naim, Vazquez, Redner, JQAS)](https://cnls.lanl.gov/~ebn/pubs/sports-jqas/sports-jqas.pdf) ·
[Randomness in Competitions (arXiv)](https://arxiv.org/pdf/1209.4724) ·
[Underdog Win Rates by Sport](https://loserwins.com/data-analysis/underdog-win-rates-by-sport/)

---

## 9. Was dieser Gegencheck nicht getan hat

Keine Messung, kein Prototyp, kein Code. Die Zahlen aus dem Repo sind aus den beiden Vordokumenten
und aus `CLAUDE.md` übernommen und **nicht** neu nachgemessen — dieser Bericht prüft die
*Schlussfolgerungen* gegen externe Vorbilder, nicht die Messwerte gegen den Motor; das hat die
Synthese in ihrem Abschnitt 1 bereits getan. Die Beschreibungen von Slay the Spire, Super Auto Pets
und Blood Bowl stützen sich teilweise auf Spielkenntnis; die tragenden Aussagen sind jeweils belegt.
Die Fire-Emblem-Formeln stammen aus den Wikis und variieren zwischen den Serienteilen — die zitierte
Form gilt ab *The Binding Blade*. Die Blaseball-Beschreibung stammt aus journalistischer
Berichterstattung, nicht aus einer Entwicklerquelle.

---

## 10. Zusammengefasst für die Hauptsession

- **Urteil: teilweise bestätigt.** Der Mechanik-Teil der Synthese hält dem Vergleich mit echten
  Spielen vollständig stand — und wird härter, als die Synthese selbst formuliert hat. **Fire Emblem
  ist das lebende Gegenbeispiel zu Chris' Formel-Fix**: dort speist Speed gleichzeitig Ausweichen
  (`Avoid = Basis + 2×Attack Speed + Luck/2`) und Doppelangriff (mehr Ereignisse) — exakt die
  Doppelverwertung, und dort ein bekanntes Balanceproblem. **In XCOM, Fire Emblem und D&D/BG3 sind
  Krit und Ausweichen ausnahmslos eigene, ausgewiesene Werte auf dem Einheitenbogen** — nie
  Ableitungen aus einem sonst unbepreisten Attribut. Das Matrixgewicht-Null-Argument ist damit von
  außen bestätigt.
- **Korrektur an der Synthese: „Ungewissheit" ist nicht „Zufall".** Die Synthese folgert aus Chris'
  Kritik, es brauche „riskante Momente" — das wäre Output-Zufall und arbeitet direkt gegen die
  Abnahmeregel. **Kein erfolgreiches Vorbild kauft Spannung mit Ergebnis-Zufall.** Sie kaufen sie mit
  zurückgehaltener Information (Marvel-Snap-Aufdeckung), mit Einsatz (Snap-Würfel, „Escaped!",
  Blaseball-Idole) und mit einem sichtbar sich füllenden Balken auf eine Schwelle (Darkest Dungeon).
  Alle drei kosten null Rangtreue.
- **Der blinde Fleck beider Dokumente:** In echten Ligen gewinnt der Favorit ein Einzelspiel in 64 %
  (NFL) / 63 % (NBA) / 59 % (NHL) / 56 % (MLB) der Fälle. Unsere Schranke rho > 0,80 **je Spiel** ist
  determinierter als jeder reale Sport — Chris hat das für Hockey ausdrücklich so abgenommen. **Damit
  ist das Konto „Ungewissheit im Ausgang" belegt, und Spannung muss vollständig aus Enthüllung,
  Einsatz und Regie kommen.** Das ist genau FMs Rezept.
- **Drei übertragbare Werkzeuge, die in keinem der beiden Dokumente stehen:** (1) **PRD** aus
  Warcraft 3 / Dota 2 — gebundener Zufall bei gleichem Mittelwert, senkt exakt die Verlässlichkeits-
  Streuung in unserer eigenen rho-Formel; Vorschlag: als Variante E in A1.0 mitmessen, bester
  Kandidat für Football (0,405). (2) **XCOMs Graze-Band** — Varianz in der Höhe statt in der Zahl der
  Ereignisse; die einzige Ausweich-Form, die nicht 40 % der Schläge verschluckt. (3) **FM26s Dynamic
  Highlight Mode** — Ereignisdichte folgt der Dramatik statt der Uhr; rho-neutral, für alle zwanzig,
  die direkteste Antwort auf „das erzeugt keine Spannung".
- **Widerspruch im Detail:** Der Intent-Anzeiger aus Slay the Spire, den beide Dokumente als „das
  übertragbarste Detail des Genres" empfehlen, wirkt dort, **weil der Spieler darauf reagieren kann**.
  Ohne Eingriff ist er ein Spoiler — er trägt nur, wenn er auf eine bereits getroffene Entscheidung
  zurückzeigt („Schleicher geht hinten rum — **dein Bollwerk steht links**").
- **Rangverschiebung:** **A3** (die gebuchte Saat durch den Host reichen) ist nicht nur „Einsatz",
  sondern die **Vorbedingung** für das Genre-Muster überhaupt: in jedem Vorbild prüft der Kampf
  sichtbar eine Entscheidung des Zuschauers, und solange der gezeigte Lauf nicht der gebuchte ist,
  kann kein Präsentationsaufwand das heilen. **K1** (Kachel → Portrait-Karte) steigt ebenfalls:
  Objektkonstanz ist in FUT und Blaseball der **erste** gebaute Bindungsträger, nicht der letzte.
- **Warnung zu B0:** Das Drehbuch-Mockup sollte ausdrücklich **ohne jeden Zufall** gescriptet sein und
  das dazuschreiben. Sonst beweist es womöglich, dass die Beats nur wirken, weil sie zufällig sind —
  und das merken wir erst nach dem Motorbau.
- **Für alle zwanzig Disziplinen** stehen jetzt neun Leitplanken in Abschnitt 6, davon fünf rein
  präsentationsseitig (ohne neue Basislinie umsetzbar) und vier mechanisch (je eine Messung nötig).
  Regel dazu: **für eine Disziplin, die bereits über 0,80 steht, sind ausschließlich die fünf
  präsentationsseitigen relevant.**
