# Bühne-Auftritt: Fables Ideen zu Showcase, Eiskunstlauf und Wettessen (30.09.)

**Reines Konzept. Kein Code, keine Produktionsdatei angefasst.** Chris wollte einen frischen Blick
auf die drei Auftritt-Disziplinen — Einzeldarbietungen, die bewertet werden, statt direkt
gegeneinander zu laufen. Dieses Papier baut auf allem auf, was dazu schon geschrieben und gebaut
ist (Abschnitt 0), wiederholt nichts davon und macht dort neue Richtungen auf, wo ich welche sehe.
Wo ich keine sehe, steht das ausdrücklich.

Die drei Leitplanken aus `CLAUDE.md` gelten für jede Zeile unten und stehen nicht zur Debatte:
die Eignungsmatrix (`lib/player-generator/official-discipline-weights.ts`) bleibt für alle zwanzig
Disziplinen gesperrt; rho je Einzelspiel muss über 0,80 bleiben (angestrebt 0,85); die
Pp-Abweichung muss unter 25 bleiben, gemessen mit zwei Saatstämmen. Dazu die Design-Linie vom
21.09.: mehrere Wege zum Erfolg (Primärweg plus Nebenwege über andere Matrixattribute).

Stand: `origin/main` @ `24a8e1e1` (30.09.). `engine.js` meint `public/mockups/battle-mode.engine.js`.
Klassen wie im Broadcast-Papier vom 27.09.: **A** reine Anzeige (per Konstruktion rho-neutral),
**B** berührt Takt oder Dauer, nicht die Punkte, **C** berührt die Wertungslogik und braucht
Chris' Zustimmung plus die volle rho-/Pp-Abnahme.

---

## Kurzfassung

| | Showcase | Eiskunstlauf | Wettessen |
|---|---|---|---|
| Wo sie steht | rho 0,896 · Pp 28,4/29,3 (26.09., verletzt) → Rezept-Fix 27.09. (`908bdda3`), Nachmessung n=48 steht aus · Präsentation 91 % (sechs Acts, Rampenlicht, Ton) | rho 0,878 · Pp 20,2/20,2 · Startgruppen, Spotlight, Duett, Wackler, Kürzel, Kiss-&-Cry-Plakette | rho 0,872 · Pp 13,6/14,7 · Coney-Island-Tafel, 10-Minuten-Uhr, Kopf-an-Kopf-Band |
| Was schon vorgeschlagen ist | S1–S5 (Opus 26.09.), S-B1–S-B6 (Broadcast 27.09.) | E1–E5 (Opus 26.09.), E-B1–E-B6 (Broadcast 27.09.) | nur Präsentation: Gegencheck 23.09., W-B1–W-B7 (27.09.). **Kein Gameplay-Gegencheck, nie.** |
| Meine stärkste Idee | **S-F1 Casting und Show** — der Startplatz wird im Spiel verdient, nicht aus der Eignung abgelesen | **E-F1 Kurzprogramm und Kür** — die Startreihenfolge der Kür kommt aus dem Kurzprogramm, wie im echten Sport | **W-F1 Die Mauer** — Kapazität bestimmt, wann sie kommt; Wille, wer durch sie hindurch isst |
| Klasse | A | A (Variante mit Zwischenrang: A) | C |
| Urteil | **rund.** Nach S1/S2 und den drei Broadcast-Prio-1-Punkten würde ich hier keine weitere Mechanik anfassen | **gut versorgt.** Der Opus-Plan E1–E3 ist der richtige Kern; ich ergänze nur die Reihenfolge und zwei kleine Dinge | **die größte Lücke der drei.** Die Mechanik erzählt nichts über Wettessen; die Slots versprechen Kapazität, Tempo und Second Wind, die es mechanisch nicht gibt |

**Ein Prinzip zieht sich durch zwei der drei Disziplinen** (Abschnitt 1): Showcase und Eiskunstlauf
sortieren ihre Auftrittsreihenfolge heute nach `eig` — der Motor verrät dem Zuschauer die versteckte
Eignung, bevor irgendjemand aufgetreten ist. In jeder echten Show und jedem echten Wettkampf wird
der letzte Startplatz **verdient**. Das lässt sich ohne eine einzige Punktänderung nachbauen.

---

## 0. Was schon existiert und entschieden ist

Damit niemand dieses Papier liest und glaubt, hier werde etwas zum zweiten Mal vorgeschlagen:

**Gemeinsames Chassis.** Alle drei laufen durch den generischen Auftritt-Rechner in `bauBuehne()`
→ `setz()`: je Durchgang `basis=(20+GRUNDLAGE·0,7)·ermued`, Erfolgschance aus TECHNIK/NERVEN,
seit dem 26.09. **mit WAGNIS als echtem Trade-off** (`BUEHNE_WAGNIS_RISIKO/_ERTRAG`, PR #1036 —
Befund B des Opus-Reviews ist damit chassisweit behoben), bei Erfolg Bonus aus SPITZENMOMENT, bei
Fehlschlag `basis·failAbzug`, immer `+PUBLIKUM·0,12`. Alle Durchgänge werden vorab gewürfelt und
danach nur enthüllt — das ist der Grund, warum Reihenfolge-Ideen per Konstruktion rho-neutral sind
(bewiesen bei der Kür-Startreihenfolge 13.09. und dem Showcase-Auftritt am Stück 17.09.).
Seit dem 27.09. hält jeder Durchgang zusätzlich `knapp` (Wackler statt Sturz, E0), rein als Anzeige.

**Showcase.** Talentshow-Konzept 17.09. (`showcase-talentshow-konzept-17-09.md`): sechs Acts
deterministisch aus Bauplan/Klasse/Rasse/Traits (`actVon()`), jeder Act eigene Pose, Requisite,
Ton, Feed-Text; ein Auftritt am Stück je Teilnehmer, schwächste zuerst — alles gebaut (S0–S3).
Der Act geht **bewusst nicht** in die Wertung ein. Opus-Review 26.09. (Branch
`buehne-auftritt-konzeptreview-26-09`): S1 Bogen mit Höhepunkt, S2 Gefahren-Nummer als
deterministische Wahl, S3 Act-Handwerk im Höhepunkt als Primär-/Nebenweg (nur mit Pp-Messung), S4
Jury-Abbruch/goldener Buzzer, S5 Schlussplatz als Managerentscheidung. Broadcast 27.09. (Branch
`broadcast-buehne-auftritt-recherche-27-09`): X-Wand, Applaus-Meter, Top-3-Tafel, Urteilsmoment,
goldener Buzzer als Bildereignis, Jury-Kacheln. Pp-Fix am 27.09. im Rezept (`908bdda3`, s.
Motor-Kommentar an `BUEHNE_ART.showcase`: determination saß in vier Rollen).

**Eiskunstlauf.** Rundenzahl 6→12 (07.09.), Duett 80/20 bei gerader Feldgröße (08.09., Rest bleibt
solo — der **schwächste**, weil von oben gepaart wird), Startgruppen/Spotlight/Kiss & Cry
(13.09.), ISU-Kalibrierung ohne Rezeptänderung (10.09., Befund: 47 % Fehlschläge), E0 Wackler und
Kürzel (27.09.), Plakette im Kiss & Cry. Opus-Review 26.09.: E1 Elementtypen und PCS als eigene
Säule, E2 Sprungwahl Quad/Triple, E3 Umplanen nach Sturz und Stand, E4 zweite Hälfte, E5
Paarlauf-Elemente. Broadcast: L/C-Zeile, Kiss-&-Cry-Enthüllung, Zeitlupe, Sturzmarke,
Sprung-Analytics.

**Wettessen.** Gegencheck 23.09. (`wettessen-format-opus-gegencheck-23-09.md`): 1 gegen 1
verworfen, Coney-Island-Tafel gebaut (ein Tisch zum Publikum, Wendetafeln in Würstchen,
10:00-Uhr, Kopf-an-Kopf-Band, eine Runde = eine Minute für alle gleichzeitig), `rundenN` 8→10.
Broadcast: live hochzählende Tafeln, Tempo je Esser, Schlussminute, Hochrechnung, Minutenbilanz,
Kopf-an-Kopf-Kamera, Senfgürtel. Als „optional, nicht empfohlen" benannt: 5-Würstchen-Stechen,
Disqualifikation. **Nie untersucht:** ob die Mechanik selbst etwas über Wettessen erzählt.

**Offen aus dem Opus-Review, für Chris:** Q1 „Soll es in Auftritt-Disziplinen überhaupt
Entscheidungen geben?", Q2 Manager-Risikoschalter, Q3 Duett-Paare vom Manager, Q4 Act nach
Können statt Bauplan, Q5 Jury-Abbruch. Ich stelle keine davon erneut; wo eine meiner Ideen an eine
dieser Fragen hängt, steht es dabei.

---

## 1. Das gemeinsame Prinzip: Reihenfolge aus dem Ergebnis, nicht aus der Eignung

Heute bauen Showcase (`buehneQueue` je Teilnehmer, aufsteigend nach `eig`, Talentshow-Konzept 3.3)
und Eiskunstlauf (Startgruppen, aufsteigend nach `eig`, Kommentar „STARTREIHENFOLGE STATT
RUNDEN-SETZLISTE" in `bauBuehne()`) ihre Dramaturgie aus der **versteckten Eignungszahl**. Das war
am 13.09. die richtige, billige Antwort auf „alle gleichzeitig ist nicht sinnvoll". Es hat aber
zwei Nebenwirkungen, die mit jeder Verbesserung der Präsentation stärker auffallen:

1. **Spoiler.** Wer als Letzter aufs Eis geht, ist der Beste — der Motor sagt es, bevor ein
   einziges Element gelaufen ist. Ein aufmerksamer Manager liest an der Startliste die
   Eignungs-Rangfolge beider Kader ab, ein Wert, den das Spiel sonst nur in Sternen zeigt.
2. **Keine Erzählung.** Ein Überraschungssieg von Startplatz 3 ist im Bild nicht anders als ein
   erwarteter von Platz 6, weil der Platz nichts bedeutet hat.

Im echten Sport ist der letzte Startplatz **verdient**: die Kür-Startreihenfolge kommt aus dem
Kurzprogramm (ISU: letzte Gruppe = die Besten des Kurzprogramms), der „pimp slot" einer Liveshow
geht an den Act, der in der Vorrunde am meisten Eindruck gemacht hat. Beides lässt sich hier
nachbauen, **ohne eine Punktzahl zu ändern**: die Durchgänge sind vorab gewürfelt, ihre Summe ist
reihenfolgeunabhängig, `stepBuehne()` zieht nie `rr()`. Es ändert sich nur, in welcher Reihenfolge
bereits berechnete `runden[]`-Einträge sichtbar werden — derselbe Beweis wie am 13.09., derselbe
Nachweis (`miss-alle-disziplinen.mjs 24 eiskunstlauf showcase` vorher/nachher, drei Stellen
identisch).

Das ist die Idee mit dem besten Verhältnis von Wirkung zu Risiko in diesem Papier, deshalb steht
sie zuerst. E-F1 und S-F1 unten sind ihre zwei Ausprägungen.

---

## 2. Eiskunstlauf

### E-F1 — Kurzprogramm und Kür: die Startreihenfolge wird auf dem Eis verdient (Klasse A, mittel)

**Was.** Die zwölf Elemente je Läufer/Paar werden in zwei Segmente geteilt, wie im ISU-Wettkampf:
**Kurzprogramm** (Elemente 1–4) und **Kür** (Elemente 5–12). Ablauf:

1. Kurzprogramm: alle Paare beider Seiten laufen ihre vier Elemente, Startreihenfolge wie heute
   (oder per Saat gemischt — im echten Sport wird das Kurzprogramm ausgelost).
2. Zwischenrang: nach dem Kurzprogramm bekommt jedes Paar im Kiss & Cry seine Plakette
   „PLATZ n nach dem Kurzprogramm" (E-B3 liefert die Plakette schon).
3. Kür: die Startgruppen der Kür werden **aus dem Kurzprogramm-Zwischenstand** gebildet, aufsteigend
   — die Besten des Kurzprogramms laufen zuletzt. Das ist ISU-Regel, kein Erfindung.

**Warum es zu Eiskunstlauf passt.** Weil es die Sportart ist. Zwei Segmente, ein Zwischenrang, die
letzte Gruppe als Favoritengruppe — jeder Eiskunstlauf-Zuschauer kennt das. Und es löst den
Spoiler aus Abschnitt 1: die letzte Gruppe ist die, die im Kurzprogramm am besten war, nicht die
mit der höchsten versteckten Zahl. Ein Paar mit hoher Eignung, das im Kurzprogramm stürzt, startet
in der Kür früh — und muss von dort aufholen. Das ist genau die Erzählung, die #1024 (Vorsprungsbalken)
und E-B2 (L/C-Zeile) sichtbar machen könnten und heute nicht haben.

**Was es kostet.** Jedes Paar betritt das Eis zweimal, die Spotlight-Rotation in `stepKuer()` läuft
also zwölf statt sechs Mal durch Start → Eis → Kiss & Cry. Die reine Elementzeit bleibt (12 × 2 ×
0,425 s je Paar), aber jede Rotation hat Ein- und Ausfahrt (gedeckelter Schritt 260 px/s, s.
Recherche 13.09.), also rund sechs Übergänge mehr à ~0,5 s. Wenn das die ~60-s-Marke reißt,
`rundenDauer` leicht senken (0,425 → ~0,38) — das ist eine reine Taktzahl, keine Punkte. Vorher
mit `disziplinProbe` prüfen, dass die Sonde nicht am Echtzeittakt hängt (Broadcast-Papier, Klasse B).

**Wechselwirkung mit dem Opus-Plan.** E-F1 macht E3 („der letzte Läufer kennt die Zielzahl")
diegetisch: wer in der letzten Kür-Gruppe steht, hat sich das im Kurzprogramm erlaufen, und der
Vorsprungsbalken zeigt, was er braucht. E1/E2 (Elementtypen, Quad/Triple) passen ohne Anpassung
hinein — das Kurzprogramm hat im echten Sport sogar die strengeren Elementpflichten (Sprungkombination,
Axel, Pirouetten), was E1 später für die ersten vier Elemente einfach so setzen kann.

**Feldgröße.** Bei 2 je Seite gibt es je Seite genau ein Paar; das Kurzprogramm entscheidet dann nur,
welche Seite zuletzt läuft. Trotzdem sinnvoll: es ist dieselbe Regel, kein Sonderfall.

**Aufwand:** mittel, ~1 Tag inklusive Sicht-QA. Queue-Bau in `bauBuehne()` (zwei Blöcke statt
einem, zweiter Block sortiert nach Teilsumme der ersten vier Durchgänge — gelesen aus `runden[0..3]`,
das ist die Spoiler-Regel des Broadcast-Papiers), `stepKuer()` muss ein Paar zweimal durch die
Rollen führen, eine Zwischenrang-Plakette. Abnahme: bit-identische Messung.

### E-F2 — Bei ungerader Feldgröße läuft der Star solo, nicht der Schwächste (Klasse C, klein)

**Was.** Heute paart `fusioniereSeite()` von oben (Rang 1+2, 3+4, …); bei 3 oder 5 je Seite bleibt
der **schwächste** Läufer solo — als Rest. Vorschlag: von unten paaren, sodass der **stärkste**
solo läuft, und ihn als letzten Starter seiner Seite setzen. Bei 3 je Seite (der Katalogwert der
Disziplin, s. Opus-Synthese 08.09. Abschnitt 4) heißt das: ein Duett plus die Einzelkür des Stars.

**Warum.** Erstens die Erzählung: „das Duett eröffnet, der Star schließt ab" ist ein Bild; „zwei
laufen zusammen, und der, den keiner kennt, läuft allein hinterher" ist keines. Zweitens ist es
ehrlicher zur Sportart, in der Einzel und Paare getrennte Wettbewerbe sind — ein Team, das beides
schickt, schickt seinen Besten im Einzel. Drittens ein Nebeneffekt, den die Duett-Recherche selbst
nahelegt: die 80/20-Fusion glättet Ausreißer, was dem Star am wenigsten nützt und dem Schwächsten
am meisten. Der Star ungemischt, die Mitte gemischt — das könnte rho bei ungerader Feldgröße eher
heben als senken. **Das ist eine Vermutung, keine Messung.**

**Kosten und Abnahme.** Mechanisch winzig (Paarungsrichtung in `fusioniereSeite()`), aber die
Fusion ist Wertungslogik: `miss-alle-disziplinen.mjs 24 eiskunstlauf --je-seite=3` und `=5`
vorher/nachher, dazu die geraden Feldgrößen bit-identisch (dort ändert sich nichts, weil es keinen
Rest gibt). Aufwand: klein, ein halber Tag mit Messung.

### E-F3 — Das saubere Programm bekommt seinen eigenen Jackpot (Klasse C, klein, nur mit E2)

**Was.** Ein Programm ohne einen einzigen Sturz (Wackler zählen nicht als Sturz) bekommt am Ende
einen kleinen festen Zuschlag — „Clean Skate". Deterministisch aus den eigenen `runden[]`, kein
zusätzlicher Würfel.

**Warum, und warum erst mit E2.** Im echten IJS lohnt sich ein sauberes Programm überproportional
(hohe GOE stapeln sich, die Komponenten steigen mit), und „clean skate" ist der Begriff, mit dem
Kommentatoren einen Lysacek-Sieg erklären. Der Opus-Plan gibt dem Springer-Weg mit E2 die Quads —
der Künstler-Weg (sichere Triples, starke PCS) bekommt dort nur „mehr Boden". E-F3 gibt ihm eine
eigene Spitze: wer nichts wagt und alles steht, wird dafür bezahlt. Heute, bei 47 % Fehlschlagquote
über zwölf Elemente, wäre ein sauberes Programm so selten (unter 1 %), dass der Zuschlag nie
erschiene — deshalb erst, wenn E1/E2 die Fehlschlagquote auf ein realistisches Maß gebracht haben.

**Attribute.** Belohnt Beständigkeit, also TECHNIK/NERVEN (dexterity, awareness, intelligence,
determination — alles Matrix). Charisma trägt es indirekt über den Künstler-Weg, der ohne Quad
öfter sauber bleibt. Risiko: Schwellenwerte erzeugen Varianz; klein halten (Größenordnung eines
halben Elements), Abnahme mit n=24 und n=96.

### E-F4 — Jedes Paar hat ein Programm (Klasse A, klein)

Rein Identität, nach dem Showcase-Act-Muster: deterministisch aus Klasse/Rasse/Traits ein
Programmtitel und eine Stimmung („läuft zu *Sturm über den Klippen*", „*Nocturne*") als Einblender
beim Betreten des Eises, dazu ein leichter Farbton des Bandenlichts während des Programms und die
Kostümfarbe, die es seit `eiskunstlaufKostuemfarbe()` schon gibt. Kein Punkt, kein Würfel. Wert:
das Eis erzählt, wer da läuft — das war Chris' Frage vom 13.09. („keine Indikation, welche Leute").
Aufwand: klein, ein halber Tag. Nicht dringend; ich nenne es, weil es fast nichts kostet.

### Was ich für Eiskunstlauf **nicht** vorschlage

- Keine dritte Mechanik neben E1–E3. Der Opus-Plan ist der richtige Kern; er braucht Chris' Q1, nicht
  weitere Ideen daneben.
- Kein Manager-Eingriff in die Paarung (Q3) und kein Risikoschalter (Q2) — beides hängt an
  Entscheidungen, die noch nicht gefallen sind.
- Keine Cross-Team-Paare, kein Trio bei ungerader Größe.

---

## 3. Showcase

Vorweg das ehrliche Urteil: **Showcase ist die rundeste der drei.** Präsentation 91 %, rho
drittbeste im Feld, sechs sichtbar verschiedene Acts, ein Opus-Plan mit Höhepunkt und Gefahren-Nummer,
ein Broadcast-Plan mit X-Wand und Applaus-Meter. Was ich hier ergänze, ist Dramaturgie und Zierde,
keine dritte Mechanik. Zwei Pflichtpunkte zuerst:

- **Pp nachmessen.** Der Fix vom 27.09. (`908bdda3`) ist im Motor, die Zahl im Gesamtstand steht
  noch auf 28,4/29,3 „verletzt". Bevor S1–S3 aus dem Opus-Plan gebaut werden, `messe-arena-einfluss.mjs
  showcase 48` mit zwei Saatstämmen — sonst weiß niemand, worauf S3 aufsetzt.
- **S3 (Act-Handwerk) nur nach Q4.** Das Review sagt es selbst: solange `actVon()` den Act fast nur
  aus dem Bauplan ableitet, misst eine Einflussmessung den Act-Bonus quer über den Kader verzerrt.

### S-F1 — Casting und Show: der Schlussplatz wird verdient (Klasse A, mittel)

**Was.** Die fünf Durchgänge bleiben, die Enthüllung wird zweigeteilt:

1. **Casting** (Durchgang 1 aller zwölf): schnell geschnitten, ~0,5 s je Act, Seiten verzahnt,
   Reihenfolge per Saat oder Aufstellung. Das ist die Audition-Montage jeder Talentshow — zwölf
   kurze Einblicke, einer nach dem anderen.
2. **Show** (Durchgänge 2–5, am Stück je Act): Reihenfolge **aufsteigend nach dem
   Casting-Ergebnis**, gelesen aus `runden[0]`. Wer im Casting am meisten Eindruck gemacht hat,
   bekommt den Schlussplatz.

**Warum es zu Showcase passt.** Der „pimp slot" ist ein Talentshow-Begriff, und er wird vergeben,
nicht ausgelost. Heute bekommt ihn der mit der höchsten `eig` — Abschnitt 1. Mit S-F1 kann ein
Außenseiter mit starkem Casting-Durchgang als Letzter auftreten und dann einbrechen, oder der Star
nach schwachem Casting von Platz 2 aus alles gewinnen. Vier Durchgänge am Stück behalten Chris'
abgenommene Dramaturgie vom 17.09. („jeder kommt einmal raus, zeigt seine Nummer, geht ab") für
den Hauptteil; nur der eine Casting-Durchgang wird abgetrennt.

**Wechselwirkung mit S1/S2.** Wenn der Höhepunkt (S1) in Durchgang 4 liegt, sitzt er in der
Show-Hälfte — der Casting-Durchgang ist dann der Auftakt, was inhaltlich genau passt. S-B3 (Top-3-Tafel)
zeigt nach dem Casting einen ersten Zwischenstand, der die Show-Reihenfolge erklärt.

**Kosten.** Jeder Act gleitet zweimal in die Mitte (Casting kurz, Show lang); mit 0,5-s-Casting-Schnitten
und `rundenDauer` unverändert bleibt die Gesamtzeit bei ~60 s (6 + 48 + Übergänge). Aufwand: mittel,
~1 Tag (Queue in zwei Blöcken, `stepShowcase()` mit kurzer Casting-Rolle ohne volle Choreografie,
Sicht-QA). Abnahme: bit-identisch. **Eine Sache muss Chris abnicken:** der Casting-Durchgang ist ein
zweiter, kurzer Auftritt je Act — eine Abschwächung des „am Stück", das er abgenommen hat.

### S-F2 — Bester Act je Kategorie (Klasse A, klein)

Sechs Acts, zwölf Teilnehmer: in jedem Spiel gibt es meist zwei bis drei Kraftakt-, zwei
Gesang-, zwei Zaubershow-Performer. Vorschlag: nach dem letzten Auftritt bekommt der Beste jeder
Act-Kategorie ein Etikett im Ticker und in der Wertungstabelle („Bester Kraftakt: Lava Golem"),
nach dem „Punktesieg"-Muster aus Gewichtheben. Keine Punkte, kein Würfel.

**Warum.** Der Act ist heute reine Optik und geht bewusst nicht in die Wertung ein (Talentshow-Konzept
4.1). Ein Kategoriepreis gibt ihm trotzdem Bedeutung: die zwei Golems konkurrieren sichtbar
miteinander, ohne dass die Wertung etwas anderes belohnt als Charisma. Das ist die billigste Form von
„jeder Spieler hat in irgendwas Expertise" — als Anzeige, nicht als Rezept. Nebeneffekt: eine
Saisonstatistik „Kategoriesiege je Spieler" wäre später ohne Motoränderung ziehbar. Aufwand: klein,
ein halber Tag.

### S-F3 — Jury-Sprüche, die den Stand kennen (Klasse A, klein)

Der Feed sagt heute je Durchgang, was der Act tut („die Klinge singt, das Publikum tobt"). Was
fehlt, ist die **Jury-Stimme**, die jede Talentshow trägt und die den Act **zum Feld** in Beziehung
setzt: „Das war die beste Nummer des Abends — bisher." / „Du hast auf Sicherheit gespielt." / „Nach
dem Anfang hätte ich nicht gedacht, dass du das noch drehst." Deterministisch aus Rang unter den
fertigen Acts, Fehlschlagzahl, Act-Kategorie und `cypherHash(u.id)` für die Variante — ein Satz je
Act, beim Abtritt, über `feed()`. Passt zu S-B4 (Urteilsmoment) und S-B6 (Jury-Kacheln), kostet
fast nichts (ein Textpool, eine Auswahlfunktion). Aufwand: klein.

### S-F4 — Doppel-Act (Klasse C, klein–mittel, niedrige Priorität)

Wenn zwei Teamkollegen denselben Act tragen, treten sie **gemeinsam** auf — zwei Golems heben einen
Felsen, zwei Sänger im Duett — mit derselben 80/20-Fusion, die im Eiskunstlauf gemessen sicher ist
(Duett-Recherche 08.09.: 0,903 gegen 0,881 solo). Gruppen-Acts gehören zu jeder Talentshow, und das
Bild wäre neu. Ich setze es tief, weil es Wertungslogik berührt (Fusion) und mit S3 (Act-Handwerk)
kollidieren kann. Nur, wenn nach S1–S3 noch Appetit da ist; Abnahme wie beim Duett.

### Was ich für Showcase **nicht** vorschlage

- Keinen Themenabend mit Bonus für passende Acts: ein act-gebundener Bonus ist unkorreliert mit
  `eig` und kostet rho, garantiert. Als reine Kulisse (Lichtfarbe, Vorhang) möglich, aber das wäre
  Zierde ohne Nutzen — Showcase hat genug Zierde.
- Keine geteilte Saalstimmung zwischen Acts (Kaskade über Teams hinweg).
- Keine Punkte für den goldenen Buzzer (S4/S-B5 haben das schon verworfen, ich schließe mich an).

---

## 4. Wettessen — die Disziplin ohne Gameplay-Gegencheck

### 4.1 Was die Mechanik heute erzählt: nichts

`BUEHNE_ART.wettessen` läuft den generischen Block: zehn Minuten, jede Minute derselbe Wurf, die
einzige Zeitabhängigkeit ist `ermued` — die greift erst unter AUSDAUER 60 und kostet in Minute 10
höchstens ~10 % der Basis. Es gibt keine Kurve, keine Phase, keine Entscheidung. Die sechs Slots
(`matchday-slot-roles.ts`: *Capacity*, *Pace Control*, *Iron Stomach*, *Table Focus*, *Second
Wind*, *Final Bite*) versprechen genau die Dinge, die ein echtes Wettessen ausmachen — und keins
davon existiert mechanisch, sie sind Attributzuschläge mit Namen. Das ist derselbe Befund, den das
Opus-Review für Eiskunstlaufs *Jump Setup*/*Spin Grace* festgehalten hat.

Was ein echtes Wettessen ausmacht (Nathan's, Major League Eating; die Quellen des Gegenchecks 23.09.
und des Broadcast-Papiers 27.09.):

1. **Die Kurve ist vorne steil.** Chestnut 2021: 30 nach drei Minuten, 42 nach fünf, 76 am Ende —
   rund 60 % der Menge in der ersten Hälfte. Jeder Esser wird langsamer; die Frage ist, **wann** und
   **wie stark**.
2. **Die Mauer.** Irgendwann ist der Magen voll. Ab da isst niemand mehr mit Kapazität, sondern mit
   Willen — Kommentatoren sprechen wörtlich vom „hitting the wall". Die Großen (Chestnut, Kobayashi)
   unterscheiden sich von den Guten weniger im Anfangstempo als darin, wie lange sie **nach** der Mauer
   noch zählen.
3. **Strategien.** Es gibt Sprinter (alles in die ersten Minuten), Pacer (gleichmäßig, oft die
   Technik-Esser mit Dunking und Rhythmus) und Schlussspurter (Chipmunking in der letzten Minute —
   was im Mund ist, zählt, wenn es geschluckt wird).
4. **Der Rückschlag.** „Reversal of fortune" ist die Disqualifikation; darunter gibt es die Pause,
   das Würgen, die verlorene Minute. Das Modell hat davon nur die Pause (`failAbzug 0,65`).

### W-F1 — Die Mauer: Kapazität bestimmt, wann sie kommt, Wille, wer durch sie isst (Klasse C, mittel)

**Was.** Wettessen bekommt eine eigene Weiche (`mauer:true`, Muster `heben`/`gauntlet`/`schatzsuche`)
und einen eigenen Zweig in `setz()`, der die zehn Minuten in **drei Phasen** rechnet — weiterhin
je Esser für sich, weiterhin vorab, weiterhin genau ein `rr()` je Minute:

| Phase | Minuten | Basis | Erfolgschance | Bonus |
|---|---|---|---|---|
| **Sprint** | 1 bis m* | GRUNDLAGE voll, kein `ermued` | TECHNIK/NERVEN wie heute | SPITZENMOMENT × WAGNIS-Faktor — hier zählt Tempo |
| **Mauer** | m*+1 bis 9 | GRUNDLAGE × Mauerfaktor | TECHNIK/NERVEN, leicht gesenkt | kleiner |
| **Schlussminute** | 10 | wie Mauer | WAGNIS-Trade-off doppelt gewichtet (Stopfen: Risiko gegen Ertrag) | SPITZENMOMENT voll — das ist *Final Bite* |

- **m\*, die Mauer-Minute**, ist **deterministisch** aus der Kapazität: `m* = 3 + AUSDAUER/25`
  (Vorschlag; AUSDAUER = stamina 50 / health 30 / will 20 ⇒ Kapazität aus den beiden 22er-Attributen
  der Matrix). Ein Esser mit AUSDAUER 40 hat seine Mauer in Minute 4–5, einer mit 90 erst in Minute
  6–7. **Kein Würfel für die Mauer** — Präzedenzfall `lastFuer()`/`HEBEN_TAGESMAX`: die Entscheidung
  ist aus Werten, nur der Ausgang je Minute wird gewürfelt.
- **Der Mauerfaktor** kommt aus WILLE: `0,45 + NERVEN·0,005` (Vorschlag; NERVEN = will 45 / health
  35 / determination 20). Wer NERVEN 90 hat, isst nach der Mauer noch mit 90 % Basis, wer 30 hat, mit
  60 %. **Will ist mit 26 das schwerste Matrixattribut** — und heute in fünf Rollen verstreut, ohne
  irgendwo der Kanal zu sein, der etwas *entscheidet*. Die Mauer macht Will zu dem, was es in der
  Sportart ist: das Attribut, das zählt, wenn der Körper nicht mehr will.
- **Sprint-Bonus** aus SPITZENMOMENT (torment 45 / will 30 / determination 25): wer viel Torment und
  Determination hat, holt vor der Mauer mehr. Das ist der Sprinter.

**Warum das zu Wettessen passt.** Weil es die eine Sache ist, über die jede Übertragung spricht:
Tempo gegen Kapazität gegen Willen. Und weil es die drei Esser-Typen erzeugt, die die Slots seit
Wochen versprechen — **das ist das Primär-/Nebenweg-Muster aus der I-Spy-Runde, in der Matrix
angelegt, ohne Override:**

| Weg | Attribute (Matrix) | Slot, der wahr wird | Wie er gewinnt |
|---|---|---|---|
| **Kapazitäts-Esser** (Primärweg) | health 22, stamina 22 | *Capacity*, *Iron Stomach* | späte Mauer, lange volle Basis |
| **Willens-Esser** | will 26, determination 16 | *Second Wind* | frühe Mauer, aber isst durch — holt in Minute 6–10 auf |
| **Sprinter** | torment 6, determination 16 | *Final Bite* (und der Sprint vorn) | vorne weg, hinten leer; in der Schlussminute noch einmal |
| **Techniker** (Nebenweg) | intelligence 8 | *Pace Control*, *Table Focus* | höhere Erfolgschance je Minute, weniger Pausen — gleichmäßig |

Alle vier liegen in der Matrix, keiner braucht ein neues Gewicht. Was sich ändert, ist nur, **wann im
Spiel** ein Attribut wirkt — und genau das macht die Tempo-Anzeigen aus dem Broadcast-Papier (W-B2
Tempo je Esser, W-B4 Hochrechnung, W-B3 Schlussminute) vom Schmuck zur Information: die Tafel eines
Willens-Essers blättert in Minute 8 noch, die eines Sprinters nicht mehr.

**Was es mit rho und Pp macht — Erwartung, nicht Messung.**
- rho: keine Wechselwirkung zwischen Essern (die Stärke der Disziplin bleibt, s. Gegencheck Befund C),
  keine RNG-Kaskade (m* ist deterministisch, jede Minute ein unabhängiger Wurf). Die Struktur
  **verstärkt** Eignungsunterschiede (wer mehr Kapazität hat, hat mehr volle Minuten; wer mehr
  Willen hat, mehr Mauer-Punkte) — das ist die Richtung, in der Takeshis Fallentypen und Time-Trials
  Gelände rho gehoben haben. Verlässlichkeit je Spiel: unverändert zehn Würfe. Ich erwarte rho gleich
  oder besser; Abnahme n=24 und n=96, alle Feldgrößen 2–6 (`--je-seite`).
- Pp: heute 13,6/14,7 mit Anteilen nahe der Matrix (will 24, stamina 22–24, health 22, determination
  13–14, torment 10–11, intelligence 6–8). Die Mauer verschiebt Will nach oben und stamina/health
  leicht nach unten — beides in Richtung Matrix (will 26, torment 6 ist heute **über**gewichtet). Die
  Koeffizienten oben sind Startwerte für eine Kalibrierrunde, keine Ergebnisse; Ziel bleibt ≤ 25 mit
  zwei Saatstämmen, realistisch unter 15.
- Feldgröße: je Esser gerechnet, also 2–6 je Seite ohne Sonderfall. PPS-Referenz je Feldgröße neu
  ziehen (wie bei S4 des Gegenchecks).

**Aufwand:** mittel, 1,5–2 Tage: Weiche und eigener `setz()`-Zweig (~40 Zeilen), Kalibrierraster
über m*-Formel und Mauerfaktor (drei bis vier Läufe je Saatstamm), Geschwister-Spiegeltest
(`miss-arena-buehne-spiegel.mjs`), PPS-Referenz, Wertungstabellen-Fußzeile („Mauer in Minute n" als
Spalte wäre schön, ist aber `WERTUNG_AUFTRITT`, geteilt — nicht in derselben PR). **Braucht Chris'
Zustimmung** (Klasse C) — und ist zugleich die Antwort auf sein Q1 aus dem Opus-Review für
Wettessen: keine Spieler-Entscheidung, aber eine sichtbare, nachvollziehbare Struktur.

### W-F2 — Das Menü des Spieltags (Klasse A, klein)

Der Motor würfelt heute Würstchen. Nathan's ist das Vorbild, aber Major League Eating fährt eine
ganze Saison verschiedener Gerichte: Wings, Pfannkuchen, Chili, Austern. Vorschlag: pro Spiel per
Saat ein **Gericht** (vier bis sechs Einträge), das ausschließlich die Anzeige ändert — Einheit auf
der Wendetafel („34 Wings" statt „34 Würstchen", andere Umrechnung `k`), Teller-/Tischrequisite,
Neon-Schild, Feed-Vokabular. Kein Punkt, kein Würfel, keine Rollenverschiebung.

**Warum nur Anzeige.** Eine mechanische Fassung (das Gericht moduliert eine Rolle, etwa Chili →
NERVEN schwerer) wäre reizvoll, aber sie würde in einem einzelnen Spiel etwas anderes belohnen als
`eig` misst — genau der Validitätsbruch, den CLAUDE.md beschreibt. Über eine Saison mittelt sich das,
je Spiel kostet es rho. Deshalb: Menü als Kulisse, die Mauer (W-F1) als Mechanik. Aufwand: klein,
ein halber Tag. Wert: jedes Wettessen sieht anders aus, ohne dass jemand etwas dafür riskiert.

### W-F3 — Startstrategie als Managerentscheidung (Klasse C, offene Chris-Frage)

Mit W-F1 gäbe es zum ersten Mal etwas, das ein Manager **vorab** entscheiden könnte: ein Schalter
je Wettessen-Aufstellung — *Sprint* (mehr Sprint-Bonus, frühere Mauer), *Gleichmäßig* (Standard),
*Schlussspurt* (weniger vorn, mehr in der Schlussminute). Das ist Opus-Q2 für Wettessen, und ich
stelle sie nicht neu — nur der Hinweis, dass Wettessen der natürlichste Ort dafür wäre, weil
„Pacing" dort ein echter Fachbegriff ist. Nicht bauen, bevor W-F1 gemessen ist und Q2 entschieden.

### Was ich für Wettessen **nicht** vorschlage

- **Keine Disqualifikation, keine Fehlschlag-Kette.** Ein Fehlschlag, der den nächsten wahrscheinlicher
  macht, ist eine verstärkende Kaskade — sie trifft die Schwachen und senkt die Verlässlichkeit je
  Spiel (Breaking-Gauntlet-Lehre vom 22.09.). Der Gegencheck hat das schon abgelehnt; ich auch.
- **Keine Wechselwirkung zwischen Essern.** Dass jeder für sich isst, ist der Grund, warum die
  Disziplin bei jeder Feldgröße 2–6 gleich gut ordnet. Das bleibt.
- **Kein 1 gegen 1** und kein festes Stechen — beides ist am 23.09. mit Messung entschieden.

---

## 5. Mehrwege-Bilanz

| Disziplin | Heute | Nach den vorgeschlagenen Ideen |
|---|---|---|
| Showcase | ein Weg: Charisma (Act reine Optik) | Opus S2/S3: Risiko-Weg, Handwerks-Weg je Act als Primärweg, Charisma als Nebenweg. **Meine Ergänzung:** Kategoriepreis (S-F2) gibt dem Act Bedeutung ohne Wertung; Casting (S-F1) macht den Startplatz zu etwas, das man sich mit jedem Weg erlaufen kann |
| Eiskunstlauf | ein Weg | Opus E1/E2: Springer-Weg (dexterity/awareness/speed) gegen Künstler-Weg (charisma/spirit). **Meine Ergänzung:** E-F3 gibt dem Künstler-Weg eine eigene Spitze (Clean Skate), E-F1 gibt beiden Wegen einen zweiten Anlauf (Kurzprogramm vs. Kür) |
| Wettessen | ein Weg (alle Minuten gleich) | **W-F1:** Kapazitäts-Esser (health/stamina) als Primärweg, Willens-Esser (will/determination), Sprinter (torment/determination), Techniker (intelligence) — vier Wege in der Matrix, ohne Override |

---

## 6. Priorität, Aufwand, Klasse

| Prio | Nr. | Idee | Klasse | Aufwand | Braucht Chris |
|---|---|---|---|---|---|
| **1** | W-F1 | Die Mauer (Wettessen) | C | mittel, 1,5–2 Tage | ja — einzige echte Mechanik in diesem Papier |
| **1** | E-F1 | Kurzprogramm und Kür | A | mittel, ~1 Tag | Hinweis reicht (Takt bleibt) |
| **1** | S-F1 | Casting und Show | A | mittel, ~1 Tag | ja — weicht das „am Stück" vom 17.09. auf |
| 2 | S-F2 | Bester Act je Kategorie | A | klein, ½ Tag | nein |
| 2 | W-F2 | Menü des Spieltags | A | klein, ½ Tag | nein |
| 2 | E-F2 | Star läuft solo bei ungerader Größe | C (winzig) | klein, ½ Tag mit Messung | ja, kurz |
| 3 | S-F3 | Jury-Sprüche mit Standbezug | A | klein | nein |
| 3 | E-F4 | Programm je Paar | A | klein, ½ Tag | nein |
| 3 | E-F3 | Clean Skate | C | klein, nur nach E2 | ja, zusammen mit E2 |
| 4 | S-F4 | Doppel-Act | C | klein–mittel | ja, erst nach S1–S3 |
| — | W-F3 | Startstrategie als Managerwahl | C | — | ist Opus-Q2, nicht neu gestellt |

**Empfohlene Reihenfolge, wenn Chris alles abnickt:** E-F1 und S-F1 zuerst (beide rho-neutral, beide
lösen den Spoiler aus Abschnitt 1, zusammen zwei Tage), dann W-F1 als eigene, gemessene Runde. Die
Klasse-A-Kleinigkeiten (S-F2, W-F2, S-F3, E-F4) passen in Lücken.

---

## 7. Offene Entscheidungen für Chris

1. **W-F1:** Soll Wettessen eine eigene Kurve bekommen (Sprint → Mauer → Schlussminute), oder bleibt
   es bewusst der reine Wertungsrechner mit schöner Tafel? Das ist die eine Frage, an der dieses
   Papier hängt.
2. **S-F1:** Ist ein kurzer Casting-Durchgang vor der Show in Ordnung, obwohl er das „ein Auftritt am
   Stück" vom 17.09. um einen Durchgang kürzt?
3. **E-F2:** Bei 3 oder 5 je Seite — soll der Star solo laufen (mein Vorschlag) oder weiterhin der
   Schwächste (heute)?
4. **Nachmessung Showcase-Pp** (n=48, zwei Saatstämme) vor jedem weiteren Showcase-Bau — keine
   Entscheidung, eine Erinnerung.

---

## 8. Wo mir nichts Neues eingefallen ist

- **Showcase-Mechanik.** Nach S1/S2 aus dem Opus-Review und den Broadcast-Prio-1-Punkten ist die
  Disziplin fertig gedacht; alles, was ich dazu habe, ist Dramaturgie (S-F1) und Zierde. Das ist kein
  Mangel — eine Talentshow **ist** weitgehend Publikumsgunst, und die Grundformel bildet das ab.
- **Eiskunstlauf-Rezept.** E1–E3 sind der richtige Kern; ich hätte dieselben drei Dinge vorgeschlagen
  und lasse sie unangetastet stehen. Meine Ergänzungen setzen davor (Reihenfolge) und danach (Clean
  Skate) an, nicht daneben.
- **Wettessen-Präsentation.** Tafel, Uhr, Band und die sieben W-B-Vorschläge decken alles, was eine
  Übertragung zeigt. Was fehlte, war die Mechanik darunter — deshalb W-F1.

---

## Quellen

**Gelesen (Code, Stand `24a8e1e1`):** `public/mockups/battle-mode.engine.js` — `BUEHNE_ART.showcase`
(inkl. Pp-Fix-Kommentar 27.09.), `.eiskunstlauf`, `.wettessen`; `BUEHNE_WAGNIS_RISIKO/_ERTRAG`,
`buehneErfolgschance()`, `buehneWagnisFaktor()`; `bauBuehne()`/`setz()` inkl. Durchgangsschleife mit
`knapp`; Duett-Fusion `fusioniereSeite()` und Startreihenfolge-Kommentar; `KUER_ELEMENTE`,
`KUER_KNAPP_ANTEIL`; `TON_KATALOG.eiskunstlauf`; `DISZIPLIN_PROP`. `lib/lineups/matchday-slot-roles.ts`
(Slots showcase/eiskunstlauf/wettessen), `lib/player-generator/official-discipline-weights.ts`
(Matrixspalten der drei), `lib/battle/arena-resolved-disciplines.ts` (alle drei produktiv).

**Gelesen (Dokumente):** `docs/design/stand-aller-disziplinen.md` (Zwölfter Nachtrag 26.09.,
Abschnitte 1, 5b), `showcase-talentshow-konzept-17-09.md`, `showcase-s2-sechs-acts-17-09.md`,
`eiskunstlauf-duett-paarlauf-recherche-08-09.md`, `eiskunstlauf-kalibrierung-10-09.md`,
`eiskunstlauf-startreihenfolge-spotlight-recherche-13-09.md`, `wettessen-tafel-17-09.md`,
`wettessen-format-opus-gegencheck-23-09.md`, `i-spy-schatzsuche-konzept-21-09.md` (Mehrwege-Muster),
`mutator-trait-organische-performance-konzept-29-09.md`, `docs/pm-briefings/opus-synthese-eiskunstlauf-
breaking-08-09.md`. Aus Branches, nicht auf `main`: `buehne-auftritt-opus-konzeptreview-26-09.md`
(`origin/buehne-auftritt-konzeptreview-26-09`) und `broadcast-optik-buehne-auftritt-27-09.md`
(`origin/broadcast-buehne-auftritt-recherche-27-09`). In-Game-Meldungen (`origin/bug-reports`, bis
25.08.) enthalten nichts zu den drei Disziplinen.

**Sport:** ISU-Wettkampfformat (Kurzprogramm, Kür, Startgruppen der Kür nach Kurzprogramm-Rang),
Major League Eating / Nathan's (Tempo-Kurve, „hitting the wall", Chipmunking, Gerichte-Saison),
America's Got Talent / The Voice (Audition-Montage, Liveshow-Startplatz). Zahlen wie im Gegencheck
23.09. und im Broadcast-Papier 27.09.; keine neue Web-Recherche in diesem Papier.
