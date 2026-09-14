**Neunter Nachtrag 14.09. — Nachzug fuer die Merge-Welle vom 13./14.09.** Zehn PRs sind seit dem
achten Nachtrag auf `main` gelandet (#910, #908, #911, #909, #912, #907, #915, #914, #916, #918);
#909 stand bereits drin, die uebrigen neun waren offen. **Alle rho-Zahlen dieses Nachtrags sind
auf dem heutigen `main` (`7a07de2f`, PR #918) FRISCH GEMESSEN**, nicht aus den PR-Texten
uebernommen — `node scripts/miss-alle-disziplinen.mjs 24 <disziplin ...>`, kaderfest, dieselbe
Kader-Familie wie am 10.09. (live-save, gezogen 03.09.), Seitenfehler keine. Das war noetig: die
PR-Texte widersprachen sich an zwei Stellen (Takeshi stand in #914 mit 0,861→0,852, in #916 mit
0,883 — gemessen sind es **0,879**). Zwei Befunde ausserhalb der Merge-Welle sind dabei
mitkorrigiert worden: die Spalte „Arena" fuehrte Staffel/Takeshi/Time-Trial faelschlich mit „nein",
obwohl alle drei seit dem 10.09. in `ARENA_RESOLVED_DISCIPLINE_IDS` stehen (nachgelesen,
`lib/resolve/battle-mode-arena-team-points.ts:250-252`) — und die Staffel-Zeile war seit PR #901
(13.09.) an Assets und Movement nicht nachgezogen. **Eiskunstlauf und Breaking sind bewusst
unangetastet**: sie haengen an PR #917 und #913, die noch in Pruefung sind und ihren eigenen
Nachzug bekommen.

**Achter Nachtrag 12.09. — Tabelle korrigiert (war zwei Runden veraltet) und neue Spalte
"Letzte Aenderung" eingefuehrt.** Diese Datei ist die Scorecard, nach der Chris am 12.09. gefragt
hat: „die scorecard soll der overseer immer up to date halten, neue spalte einfügen mit latest
changes + datum". Die Tabelle unten war seit ihrer eigenen Erstellung (`c56fffd7`) durch zwei
spaetere Runden ueberholt worden, ohne dass sie hier nachgezogen wurde: die Feinschliff-Runde
(Gewichtheben-Assets, Eiskunstlauf-Movement, Breaking-Assets+Movement, Takeshi-Bahn-Produktivierung,
alle PR #872-#884, 10.09.) und die Football-Gameplay-Runde 1 (rho 0,516 → 0,800, PR #884, 10.09.).
Die korrekte Zwischenstufe stand bereits in
`docs/pm-briefings/opus-plan-zehn-disziplinen-alle-kategorien-09-10.md` Abschnitt 1.1 — von dort
uebernommen, plus die eine echte Aenderung von heute (Hockey-Ton, E2, PR #893, Assets 80→100).
**Ab jetzt gilt:** nach jeder Runde, die eine Zeile unten bewegt, wird diese Tabelle noch in
derselben Sitzung nachgezogen — nicht erst beim naechsten grossen Audit.

# Gesamtstand 10.09. — wie fertig ist jede der zwanzig Disziplinen?

**Auftrag von Chris (woertlich, 10.09.):** „kannst du mir in % noch mal sagen wie fertig alle
diszis sind was konzept/assets/gameplay/movement usw angeht? wüsste gerne wo wir nachschärfen
müssen und was schon gut ist und was noch alles gemacht werden muss und wo du noch kein konzept
hast"

**Stand:** `main` = `4058cd36` („Opus-Overseer-Review PR #867", 09.09.). Reine Bestandsaufnahme,
kein Produktionscode geaendert.

**Alle zwanzig rho-Zahlen unten sind fuer diesen Bericht FRISCH gemessen**, nicht aus
`stand-aller-disziplinen.md` oder aus der eingecheckten Basislinie uebernommen:
`node scripts/miss-alle-disziplinen.mjs 24 <disziplin ...>`, kaderfest, Median ueber fuenf echte
Team-Paarungen aus `data/generated/kaderfamilie-live-save.json`, n=24 Spiele je Variante, in drei
synchronen Laeufen ueber alle zwanzig (rund 13 Minuten Gesamtlaufzeit). Jede andere Zahl in diesem
Bericht ist an Code oder Doku belegt — die Fundstelle steht jeweils dabei.

---

## 0. Die Methode — wie die vier Prozentzahlen entstehen

Jede Achse hat **vier Teilkriterien**, jedes mit einer festen Punktzahl. Eine Disziplin bekommt
ein Teilkriterium ganz, teilweise oder gar nicht. Das ist kein Messwert, sondern eine
**begruendete Einstufung** — aber eine, deren Regel offenliegt und die jeder an derselben Stelle
im Code nachpruefen kann.

### Konzept (4 x 25)
| | Kriterium |
|---|---|
| K1 | Eigenes, aus der eigenen MATRIX abgeleitetes Rezept in der `*_ART`-Tabelle (`battle-mode.engine.js`) |
| K2 | Eigene Mechanik ueber das hinaus, was das Chassis fuer alle mitbringt (eigenes Flag, eigener Zweig, eigene Zustandsmaschine) |
| K3 | Eigenes Fable-/Design-Dokument, das die Disziplin von Grund auf modelliert |
| K4 | Rezept nachweislich kalibriert (gemessene NACHGEZOGEN-Runde, Kalibrierung gegen echte Sportdaten) und die offenen Designfragen entschieden |

### Assets (30/25/25/20)
| | Kriterium |
|---|---|
| A1 (30) | Eigene, nicht generische Feld-Datei im PRODUKTIVEN React-Renderer (`app/foundation/discipline-stage/arena/disciplines/*.tsx`) |
| A2 (25) | Eigene Szene im Mockup-Motor ueber das geteilte Chassis-Bild hinaus |
| A3 (25) | Disziplinrichtige Ausruestung/Requisiten an den Sprites (keine falsche Zufallswaffe, eigene Props) |
| A4 (20) | Ton, Musik, Kulisse |

### Gameplay/Rezept (40/30/15/15)
| | Kriterium |
|---|---|
| G1 (40) | Rangtreue kaderfest: ≥0,85 → 40 · 0,80–0,85 → 35 · 0,70–0,80 → 22 · 0,50–0,70 → 12 · <0,50 → 5 |
| G2 (30) | Produktionsanschluss: steht in `ARENA_RESOLVED_DISCIPLINE_IDS` (`lib/resolve/battle-mode-arena-team-points.ts:201-213`) |
| G3 (15) | Eigene Wertung im Spiel (eigene `wertungTabelle`, `bahnTeamstand`-Modus, Boxscore-an-PPs) |
| G4 (15) | 2–6-Spieler-Tauglichkeit (Feldspiel/Buehne 15, Bahn/Arena 12 — s. Abschnitt 3) |

### Movement/Animation (35/25/25/15)
| | Kriterium |
|---|---|
| M1 (35) | Eigene Zeichenfunktion/Zeichenzweig im Mockup-Motor statt der generischen Chassis-Darstellung |
| M2 (25) | Eigene Bewegungs-/Schrittlogik (`step*`-Sonderfaelle, Zustandsmaschine) |
| M3 (25) | Sichtbare Animation/Effekte in der produktiven React-Buehne (Glide, Ghost, Uebergaenge) |
| M4 (15) | Disziplineigene Posen/FX an den Sprites |

**Gesamt = einfacher, ungewichteter Durchschnitt der vier Achsen.** Bewusst ungewichtet, weil
Chris nach genau diesen vier Dingen gefragt hat und keine als wichtiger benannt hat. Das ist eine
ANDERE Rechnung als in `stand-aller-disziplinen.md` Abschnitt 5b (dort: Rangtreue 40 %, eigene
Mechanik 25 %, Bild/Bewegung 20 %, im echten Spielstand 15 %) — die Zahlen sind deshalb NICHT
direkt vergleichbar. Wer die Release-Sicht will, gewichtet Gameplay hoeher; dann steigen
Basketball/Hockey/Gewichtheben, und Football/TDM/Mini-DM/Battlefield fallen deutlich.

---

## 1. Die Zusammenfassungstabelle

Die Nummerierung ist die Reihenfolge des Ursprungsberichts vom 10.09. und **nicht mehr nach Gesamt
sortiert** — sie bleibt stehen, damit sich fruehere Nachtraege weiter auf dieselben Zeilennummern
beziehen koennen. `rho` = kaderfest gemessen, n=24, Median ueber fuenf echte Team-Paarungen; die
zehn Zeilen, die der 13./14.09. bewegt hat, sind auf `main` @ `7a07de2f` neu gemessen, die uebrigen
stehen unveraendert auf dem Lauf vom 10.09. „Arena" = Produktionsanschluss
(`ARENA_RESOLVED_DISCIPLINE_IDS`).

| # | Disziplin | Chassis | Konzept | Assets | Gameplay | Movement | **Gesamt** | rho | Arena | Letzte Aenderung |
|--:|---|---|--:|--:|--:|--:|--:|--:|:--:|---|
| 1 | Hockey | Feldspiel | 100 % | 100 % | 72 % | 100 % | **93 %** | 0,669 / 0,719 | ja | **13./14.09.** Leisten zeigen, was sie messen + eigenes Bodycheck-Bild (PR #910), sichtbare Puste-Leiste aus AUSDAUER (PR #914) — beide rho-ziffernidentisch, keine Achse bewegt · 12.09. Ton verdrahtet, Assets 80→100 (E2, PR #893) |
| 2 | Gewichtheben | Buehne | 100 % | 100 % | 90 % | 100 % | **98 %** | 0,843 | ja | **14.09.** Zweikampf statt Einzeluebung im dritten Versuch + duellbewusste Eroeffnung, Chris' Kernbeschwerde 66,2 %→50,0 % (PR #907); Hantel blattproportional statt absoluter Pixel (PR #915). rho 0,854→**0,843** → G1 eine Stufe tiefer, Gameplay 95→90 · 12.09. Movement 87→100 — `stepHeben()` (PR #898) |
| 3 | Takeshi's Castle | Bahn | 100 % | 95 % | 97 % | 95 % | **97 %** | 0,879 | ja | **14.09.** Puste-Erholung am Hindernis wirksam (PR #914), rho 0,883→**0,879** — gleiche G1-Stufe, keine Achse bewegt · Arena-Spalte korrigiert (stand seit 10.09. faelschlich auf „nein") · **13.09.** Fallentyp entscheidet den Sauber-Wurf mit (`fallenKoennen`), rho 0,861→0,883 — Fable-Recherche `takeshi-hindernis-vs-strecke-recherche-13-09.md` · 12.09. Movement 85→95 — `stepParcours()` (Laeufer-Zustandsmaschine) + drei Posen, Anker per Pixelscan korrigiert (PR #900) |
| 4 | Breaking | Buehne | 95 % | 100 % | 95 % | 92 % | **96 %** | 0,869 | ja | **12.09.** K4 erfuellt, Konzept 85→95 — Kalibrierrunde gegen echte WDSF-Daten, dokumentierter Nullbefund, kein Codechange (PR #897) |
| 5 | Basketball | Feldspiel | 100 % | 100 % | 82 % | 100 % | **96 %** | 0,769 | ja | 10.09. E1 gemessen (G1\*-Kriterien nicht erfuellt, PR #890) — keine Aenderung |
| 6 | Eiskunstlauf | Buehne | 90 % | 70 % | 95 % | 94 % | **87 %** | 0,885 | ja | 10.09. Movement 60→94 (Kuer-Bewegung, PR #874) |
| 7 | Speed-Schach | Buehne | 95 % | 95 % | 100 % | 95 % | **96 %** | 0,908 | ja | **12.09.** Konzept/Assets/Movement 80/75/80→95 — eigenes Fable-Dokument, Ton, Schachuhr-Requisite, `stepSchach()` (PR #902) |
| 8 | Staffel | Bahn | 95 % | 95 % | 97 % | 95 % | **96 %** | 0,899 | ja | **14.09.** Oval als echte Stadionform, Bildposition aus dem Gesamtfortschritt, alle Zeitanzeigen in echten Sekunden, Ausfuehrungsstreuung beim Wechsel — rho 0,915→**0,899** (gepaart reproduziert, gleiche G1-Stufe) (PR #916) · **Nachzug 13.09.:** Assets 55→95, Movement 70→95 (Stab-Sprite + Ton, PR #901, in der Tabelle nie nachgezogen) · Arena-Spalte korrigiert |
| 9 | Football | Feldspiel | 90 % | 75 % | 65 % | 85 % | **79 %** | 0,800 | nein | 10.09. Rezept Runde 1, rho 0,516→0,800 (PR #884) · **E3 in Pruefung** (Anzeige-Korrektur, PR #894, NICHT gemergt — wartet auf Chris) |
| 10 | Time-Trial | Bahn | 95 % | 50 % | 92 % | 65 % | **76 %** | 0,825 | ja | **13.09.** Zwischenstand rechnet hochgerechnete Eigenzeit statt roher Strecke, alle Zeitanzeigen im Uhrenmassstab, `stepZeitfahren()` mit Laufzyklus/Erschoepfung/Rampe → Movement 50→65, Startrampe+Ausdauer-Leiste → Assets 45→50; rho 0,828→**0,825** (PR #908) · Arena-Spalte korrigiert |
| 11 | Spurt | Bahn | 95 % | 55 % | 67 % | 60 % | **69 %** | 0,871 | nein | **14.09.** Puste-Erholung auf der Bahn eingeschaltet, rho ziffernidentisch 0,871 (PR #914) — keine Achse bewegt |
| 12 | Fechten | Buehne | 55 % | 55 % | 90 % | 35 % | **59 %** | 0,816 | ja | unveraendert seit 07.09. |
| 13 | Tennis | Buehne | 75 % | 40 % | 90 % | 20 % | **56 %** | 0,825 | ja | 10.09. Zufallswaffen-Bug geschlossen, Assets 30→40 |
| 14 | Mini-DM | Arena | 70 % | 60 % | 22 % | 60 % | **53 %** | 0,256 | nein | **14.09.** Formationsleine haengt an der eigenen Reihe: Reihenabstand 8,8→59,0 px, Durchbruch 18,3→4,3 % → Movement 55→60 (PR #912). rho 0,094→0,256, Kaderrauschen 0,661 — gleiche G1-Stufe · **13.09.** der 4-Team-FFA hat NULL Produktionsaufrufer (PR #911, s. 3.5) |
| 15 | Battlefield | Arena | 70 % | 60 % | 22 % | 60 % | **53 %** | 0,251 | nein | **14.09.** Reihenabstand 34,5→155,0 px, Commander bleibt in Reihe 2 → Movement 55→60 (PR #912). rho 0,387→0,251, Kaderrauschen 0,778 — gleiche G1-Stufe |
| 16 | TDM | Arena | 55 % | 65 % | 22 % | 65 % | **52 %** | 0,165 | nein | **14.09.** Reihenabstand 20,4→81,3 px + zwei neue Zielneigungen (`speer`/`schild`) → Movement 60→65 (PR #912). rho 0,253→0,165, Kaderrauschen 0,272 — gleiche G1-Stufe |
| 17 | Climbing | Bahn | 65 % | 40 % | 49 % | 40 % | **49 %** | 0,782 | nein | **14.09.** Puste-Erholung wirksam — 69,3 %→31,9 % bleiben leer, 59,7 % fangen sich wieder; rho 0,790→**0,782** (PR #914), gleiche G1-Stufe |
| 18 | Wettessen | Buehne | 35 % | 40 % | 95 % | 15 % | **46 %** | 0,845 | ja | 10.09. Zufallswaffen-Bug geschlossen, Assets 30→40 |
| 19 | Showcase | Buehne | 25 % | 40 % | 95 % | 20 % | **45 %** | 0,892 | ja | 10.09. Zufallswaffen-Bug geschlossen, Assets 30→40 |
| 20 | I-Spy | Buehne | 55 % | 40 % | 37 % | 20 % | **38 %** | 0,684 | nein | 10.09. Zufallswaffen-Bug geschlossen, Assets 30→40 |

**Durchschnitt ueber alle zwanzig: 72 %** (war 71 % vor der Merge-Welle vom 13./14.09., 65 % am
10.09. vor der Feinschliff-/Football-Runde). Je Achse: **Konzept 78 % · Assets 69 % · Gameplay
74 % · Movement 66 %.**

*Die vier Achsenzahlen sind fuer diesen Nachtrag aus der Spalte darueber neu aufsummiert worden.
Drei von ihnen standen vorher falsch da (Assets 68 statt gerechnet 67, Gameplay 71 statt 74,
Movement 65 statt 63) — sie waren beim achten Nachtrag nicht mit der Tabelle mitgezogen worden.
Die Gesamtzahl 71 % stimmte.*

**Welle 0 (Fundament, gemergt 12.09., PR #892/#889/#891/#895): noch ohne eigene Punktewirkung.**
Vier PRs — Ton-Katalog-Daten fuer sechs Disziplinen, die generische `DISZIPLIN_PROP`-Requisiten-
Tabelle, ein leerer `bahnBewegung(dt)`-Dispatcher fuer die vier Bahn-Disziplinen, plus sechs kleine
Praesentationsfixes (Breaking/Eiskunstlauf/Takeshi) — legen nur die Fundamente fuer die naechste
Runde (Welle 1: Speed-Schach/Staffel/Football/Time-Trial/Spurt/Fechten-Ton, Eiskunstlauf/Staffel/
Takeshi-Requisiten). Keine Zeile oben aendert sich dadurch; sie werden erst in der Spalte "Letzte
Aenderung" sichtbar, sobald die jeweilige Ziel-Disziplin ihre Aufrufstellen bekommt.

Die Botschaft dieser vier Zahlen in einem Satz: **das Projekt hat mehr DESIGN als DARSTELLUNG.**
Konzept liegt neun Punkte ueber Assets und zwoelf ueber Movement — es ist ueberall durchdacht, was
passiert, und laengst nicht ueberall zu sehen. *(Der Abstand war bis zum 12.09. rund zwanzig
Punkte; die Darstellungs-Wellen der letzten Tage haben ihn halbiert, ohne ihn zu schliessen. Und
er sitzt fast ganz unten: bei den oberen elf Zeilen betraegt der Abstand Konzept−Movement noch
**6,7** Punkte (95,9 gegen 89,2), bei den unteren neun **18,9** (56,1 gegen 37,2).)*

### Die frisch gemessenen Zahlen (10.09.) gegen die eingecheckte Basislinie (06.09.)

Neunzehn von zwanzig Zeilen stimmen **ziffernidentisch** mit
`data/generated/rangtreue-basislinie.json`. Zwei Zeilen weichen ab, und beide waren im
Opus-Overseer-Briefing vom 09.09. (Abschnitt 4.1) bereits als **stale Basislinien-Eintraege**
vorhergesagt — dieser Lauf bestaetigt sie unabhaengig:

| Disziplin | Basislinie 06.09. | gemessen 10.09. | Ursache |
|---|---:|---:|---|
| Gewichtheben | 0,847 | **0,854** | seit 07.09. in `stand-aller-disziplinen.md` notiert, Basislinie nie nachgezogen |
| Eiskunstlauf | 0,875 | **0,885** | PR #859 (Duett) wurde NACH der Basislinienziehung gemergt |

Beide Abweichungen zeigen nach oben, weshalb die CI-Schranke (die nur Rueckgaenge faengt) sie nie
gemeldet hat. **Es gab am 10.09. keine Regression irgendwo im Feld.**

**Nachtrag 14.09. — die Basislinie ist jetzt an acht Stellen stale.** Der Messlauf auf `main`
@ `7a07de2f` gegen `data/generated/rangtreue-basislinie.json` (06.09.):

| Disziplin | Basislinie 06.09. | gemessen 14.09. | Ursache |
|---|---:|---:|---|
| Mini-DM | 0,094 | **0,256** | Formation/Zielwahl (PR #912) — Kaderrauschen 0,661, Richtung nicht lesbar |
| Takeshi's Castle | 0,861 | **0,879** | +0,022 Fallentyp (PR #909), −0,004 Puste (PR #914) |
| Staffel | 0,915 | **0,899** | Ausfuehrungsstreuung beim Wechsel (PR #916), gepaart reproduziert |
| Gewichtheben | 0,847 | **0,843** | Duellplanung (PR #907); n=48 liefert 0,851, Vorzeichen wechselt |
| Time-Trial | 0,828 | **0,825** | Startfolge im Wechsel (PR #908) und/oder Puste (PR #914), nicht trennbar |
| Climbing | 0,790 | **0,782** | Puste-Erholung am Griff (PR #914) |
| Battlefield | 0,387 | **0,251** | Formation/Zielwahl (PR #912) — Kaderrauschen 0,778 |
| TDM | 0,253 | **0,165** | Formation/Zielwahl (PR #912) — Kaderrauschen 0,272 |

**Nur ZWEI dieser acht Bewegungen sind belegbar**: Takeshi (+0,022, ueber der Spannweite 0,101)
und Staffel (−0,016, in #916 **gepaart** auf denselben Kadern und Saaten nachgemessen und bei
n=96 mit −0,018 reproduziert — der Spannweitenvergleich taugt dafuer nicht, weil er die Streuung
ZWISCHEN Kadern misst, nicht die Unsicherheit eines Vorher/Nachher-Paares). Die uebrigen sechs
liegen unter ihrem eigenen Kaderrauschen. **Keine der acht wechselt die G1-Stufe ausser
Gewichtheben**, das mit 0,843 von der 0,85er- in die 0,80er-Stufe faellt. `node
scripts/baue-rangtreue-basislinie.mjs 24` gehoert damit dringender denn je in den naechsten
Pflege-PR (s. 4.2).

---

## 2. Jede Disziplin einzeln

### Hockey — 93 % (100/100/72/100)
**13./14.09. Update: keine Achse bewegt, und das ist das Ergebnis, nicht die Unterlassung.**
Zwei PRs haben Hockey angefasst, beide ziffernidentisch in allen vier rho-Spalten (0,669 / 0,181 /
0,832 / 0,259 und 0,719 / 0,182 / 0,818 / 0,259 — am 14.09. auf `main` @ `7a07de2f` nachgemessen).
- **PR #910 (Praesentation):** die Kachelleiste `.kbar` trug in allen vier Chassis denselben
  Tooltip „N von M Leben" — bei dreien fuer etwas, das mit Leben nichts zu tun hat. Im Eishockey
  zeigte sie Tore, und gemessen standen **175 von 288 Kachelzeilen (60,8 %) das ganze Spiel auf
  null**. Ausserdem hat der Bodycheck ein eigenes Bild bekommen (dritte Float-Klasse `_wucht`,
  Text „BODYCHECK!"): er schrieb bisher buchstaeblich dasselbe Wort wie der abgefangene Pass.
  Nebenbefund, der Chris' Praemisse korrigiert — **Checks sind nicht zu selten**: 16,0 sitzende
  Bodychecks je Spiel sind 1,60 je Skater, die NHL 2024-25 lag bei rund 1,2. Sie waren unsichtbar.
- **PR #914 (Puste sichtbar, ohne Wirkung):** Vorrat aus AUSDAUER (50 bei 21, 127 bei 75),
  Bodycheck-Kosten fuer beide Seiten, Erholung auf der Strafbank und in der Drittelpause, Leiste
  am Spieler plus die Boxscore-Spalten `Pus`/`Tief`. Die **Wirkung** auf den Ausgang ist
  abgeschaltet (`tempoMin`/`wuchtMin`/`zweikampfMin` auf exakt 1), weil sie gemessen 0,669 → 0,616
  gekostet haette — und der Lauf mit auf ein Drittel abgeschwaechten Faktoren holte **nichts**
  zurueck (0,628). Die Einbusse haengt nicht an der Staerke der Faktoren, sondern daran, **dass**
  Positionen verschoben werden; das aendert, wie oft `versucheSteal()` faellt. Dazu ein
  Vorzeichenfehler im Entwurf: der Verbrauch haengt an der gelaufenen Strecke, und die korreliert
  mit LAUFTEMPO (0,852) — einem Attribut auf der EIGNUNGSSEITE. Hockey ist mit 0,669 die
  zweitschlechteste der zwanzig; eine Mechanik, die Spass macht und die Rangtreue der schwaechsten
  Disziplin weiter drueckt, kauft das Falsche mit dem Knappsten, was dieses Projekt hat.
Assets und Movement stehen bereits auf 100, Gameplay haengt allein an rho — **es gibt an dieser
Zeile nichts zu heben, solange rho nicht steigt.**
**12.09. Update:** Assets 80→100. Fable-Entscheidung E2 (PR #893) hat den letzten Assets-Ruecksand
geschlossen — neuer `TON_KATALOG.hockey`-Eintrag (schuss/treffer/pfiff/tor/publikum), verdrahtet an
den fuenf bestehenden Aufrufstellen (Abwurf, Bodycheck, Strafe, Torerfolg, Publikums-Loop mit dem
etablierten N1-Reset-Muster). Gameplay/Movement/Konzept unveraendert — s. urspruengliche Zeile unten.
**Konzept 100:** Torwart mit eigener Wertformel (`HK_TW_BASIS`/`HK_TW_REF`), Bodycheck, Strafen,
Ueberzahl, Passqualitaet, xG-Buchung (K3). Zwei eigene Fable-Dokumente plus ein NHL-Review
(`hockey-opus-review-nhl.md`).
**Assets 100:** `rink.tsx` (419 Z., 14 Animationsstellen), eigene Eisflaeche im Motor
(`:10128 eisflaeche()`), eigener Hockeyschlaeger als Sprite-Ebene (`zeichneHockeyschlaeger`, `:311`),
seit 12.09. eigener Ton (fuenf Ereignisse, s.o.).
**Gameplay 72:** rho 0,669 (alle zwoelf) / 0,719 (nur Feldspieler) — ausdruecklich von Chris
abgenommen, Aufgabe #20 geschlossen. Produktiviert mit eigener Torwart-PPS-Referenz.
**Movement 100:** eigene Torwartbogen-, Schuss- und Bandenzweikampf-Phasen (`:9553`).

### Basketball — 96 % (100/100/82/100)
**Konzept 100:** eigenes Rezept plus `BASKETBALL_POS_MOD` (`battle-mode.engine.js:5513`), Live-Motor
mit Zonen/Manndeckung/Spielzuegen, zwei eigene Fable-Dokumente
(`basketball-finalisierung-recherche-fable.md`, `basketball-doppeln-taktik-pause-recherche-06-09.md`)
und eine gemessene Kalibrierrunde (`basketball-k3.md`, 04.09.).
**Assets 100:** `court.tsx` (524 Z., 19 Animationsstellen), eigener Court im Motor, und als
**einzige der zwanzig** echter Ton — `public/sound/basketball/` mit sechs Dateien, angebunden
ueber `bkSfx()` (`:16059`) und den Publikums-Loop (`:16080`).
**Gameplay 82:** rho 0,769 — unter der 0,80-Schranke, von Chris fuer den Live-Betrieb abgenommen
(dieselbe Ausnahme wie Hockey, s. PM-Briefing 09.09. Abschnitt 0). Produktiviert, eigene
Boxscore-an-PPs-Kurve.
**Movement 100:** Dribbel-Bounce mit Bodenkontakt-Ton (`BK_DRIBBEL_PERIODE`), Wurfbahnen, Zonen —
plus `useTokenGlide`/`GhostLayer` in `court.tsx`.

### Gewichtheben — 98 % (100/100/90/100)
**14.09. Update: Gameplay 95→90, rho 0,854 → 0,843 (PR #907).** Der erste PR dieser Welle, der
Gewichtheben an der **Wettkampfmechanik** anfasst statt an der Praesentation. Chris: „gewichtheben
muss noch irgendwie mehr spannung haben ... müssten nicht beide die gleichen gewichte heben?" Die
Recherche (`gewichtheben-spannung-recherche-13-09.md`) sagt **nein** — im IWF-Wettkampf sagt jeder
Heber selbst an, die strategische Gewichtswahl IST der taktische Teil des Sports, und gleiche
Gewichte wuerden `ANSAGE` als ausgangswirksamen Sub-Skill loeschen. Gemessen (200 Spiele, 1200
Duelle) hatte Chris trotzdem recht: in **66,2 %** der Duelle lag die Eroeffnung des einen ueber dem
hoechsten Versuch, den der andere im ganzen Wettkampf ansagt. Zwei Massnahmen, beide mit ihrer
Nullstelle im ausgeglichenen Duell:
- **`HEBEN_DUELL_ZWEIKAMPF`** — `hebeUebung("stossen")` verglich im dritten Versuch **nur**
  `besteStossen` und las den fertigen Reiss-Ausgang nie. In beide Richtungen falsch: wer im Reissen
  10 kg verlor, zog im Stossen auf `Gegner+1` und verlor den Zweikampf um 9. Im Reissen ist der
  neue Ausdruck bit-identisch zum alten.
- **`HEBEN_DUELL_EROEFFNUNG_K`** — duellbewusste Eroeffnung bei **unveraendertem Zielgewicht**: der
  Eroeffnungsversatz wird durch Nachskalierung beider Spruenge exakt ausgeglichen
  (`sprungFaktor = √(anteilRein/anteil)`), dieselbe Decke, anderer Weg. Ohne das waere es ein
  Gratis-Buff, weil `ueber` in der Erfolgskurve null ist, solange die Ansage unter `risikoMax` liegt.

Ergebnis: Chris' Kernbeschwerde **66,2 % → 50,0 %**, Entscheidung erst im letzten Versuch
2,9 % → 5,7 %, und in engen Duellen gewinnt der nach Versuch 1 Fuehrende nur noch 49,0 % statt
56,3 %. Der IWF-Korridor haelt in allen Zeilen, die Saison-Validitaet **steigt** (0,923 → 0,930).

**Warum die Zeile trotzdem faellt — und warum das keine Regression behauptet.** Die
Einzelspielzahl bewegt sich um −0,011 bei n=24 und **+0,007 bei n=48**, gegen ein Kaderrauschen von
0,208: nach `messgrundlage-kaderfest.md` von null nicht zu unterscheiden. PR #907 hat die Scorecard
deshalb ausdruecklich **nicht** nachziehen wollen. Hier wird sie trotzdem nachgezogen, aus einem
anderen Grund: die rho-Spalte dieses Berichts ist eine **Messung auf dem heutigen `main`**, und die
liefert 0,843. Die G1-Regel in Abschnitt 0 ist eine **Stufenfunktion mit einer Kante bei 0,85** —
0,843 faellt damit von 40 auf 35 Punkte. **Das ist ein Artefakt der Kante, kein Befund ueber
Gewichtheben**, und wenn der naechste Lauf bei n=48 misst, steht die Zeile wieder auf 95.
**10.09. Update:** Assets 60→100 (PR #876, PRODUKTIONSCODE, Opus-Review FREIGEBEN). Hantel liegt
jetzt an per Pixelscan ausgemessenen Handpunkten (`HEBEN_HAND`, analog zu Hockeys Schlaeger),
eigene Hebebuehne, Ton verdrahtet.
**12.09. Update:** Movement 87→100 (PR #898, PRODUKTIONSCODE). M2 (die letzte offene
Movement-Luecke, Plan-Dokument Abschnitt 4.1) war eine reine Fortschrittsbalken-Pose ohne eigene
Zustandsmaschine — `stepHeben(dt,art)` ersetzt sie durch fuenf echte Zustaende
(warten/antritt/zug/hoch/ablage), der Antritt zur Hantel ist jetzt eine sichtbare Bewegung, die es
vorher gar nicht gab. Review-Fund B (Zeit-Budget) korrigiert: der Ueberkopf-Halt "hoch" behaelt
mit 0,44*rundenDauer (~2,7s) den groessten Anteil statt auf ein Viertel zusammenzuschrumpfen — sonst
haette die Aenderung Chris' eigenen 06.09-Fund ("sehr schnell und unuebersichtlich",
`ZEIT_DEHNUNG.gewichtheben=4`) wieder rueckgaengig gemacht. Konzept/Gameplay unveraendert.
**Konzept 100:** eigenes FUENF-Sub-Skill-Rezept statt der sieben Buehnen-Rollen
(`BUEHNE_ART.gewichtheben`, `:10598`), Reissen/Stossen, drei Versuche, Nullwertung, Ansage. Die
offene Architekturfrage („darf Charisma die physische Obergrenze beruehren?") ist am 04.09.
entschieden und gemessen (`HEBEN_TAGESMAX_ANSAGE_K`, rho 0,720 → 0,887).
**Assets 100:** eigenes Buehnenbild `zeichneHeben()`, eigene Hebebuehne, eigener Ton (PR #876).
Seit **PR #915 (14.09.)** haengt die Hantel nicht mehr an einer Faust und nicht mehr an absoluten
Zellwerten: `HEBEN_PHASEN` steht in **`anteil`** (Anteil der Koerperhoehe vom Scheitel), die
Koerperspanne kommt je Zeichenpfad aus der Quelle, die sie kennt (`blattSpanne()` misst das Blatt
statt es zu tabellieren). Vorher fehlte **5 von 17 Figuren** die Hantel ganz (die `vollbild`- und
`reiherMech`-Pfade kehrten mit `return` zurueck, bevor der Hantel-Block erreicht wurde), und bei
zwei weiteren lag die Ruhestange **unter den Fuessen** (Tidesprinter −1,5, Seraph-11 −2,0) bzw. die
Ueberkopfstange **im Kopf** (Lava Golem −3,0, Krolach −2,0). Fuer den Standardkoerper zeichnet die
neue Rechnung pixelgleich; sie wirkt nur auf Blaetter, deren Hoehe von 51 Zellen abweicht — also auf
alle ueber 65 Vollbild-Kreaturen, ohne dass eine davon je einzeln vermessen werden muss. Die
Assets-Zahl bleibt bei 100: A1–A4 waren alle vier schon erfuellt, **#915 repariert Qualitaet
innerhalb bereits gezaehlter Kriterien** (dasselbe Muster wie bei Takeshi/#909 unten).
**Gameplay 90:** rho **0,843** (14.09. gemessen, G1-Stufe 0,80–0,85), produktiviert,
Gesamt-kg-Tiebreak, eigene `WERTUNG_HEBEN`, seit PR #907 mit Zweikampf-Vergleich im dritten Versuch.
**Movement 100:** `stepHeben()` als dritter Zweig in `buehnenBewegung()` — echte
Fuenf-Zustands-Maschine (warten/antritt/zug/hoch/ablage) statt reinem Fortschrittsbalken, schreibt
ausschliesslich `u.vizPhase`/`u.vizPhaseT`, ruft nie `rr()` — derselbe Vertrag wie
`stepKuer`/`stepCypher`.

### Speed-Schach — 96 % (95/95/100/95)
**12.09. Update:** Konzept/Assets/Movement 80/75/80→95 (PR #902, PRODUKTIONSCODE, Opus-Review
FREIGEBEN). Alle drei Luecken auf einmal geschlossen — keine davon war Forschung.
**Konzept 95:** neues eigenstaendiges Fable-Recherche-Dokument
(`docs/design/speed-schach-fable-recherche-12-09.md`) — Blitzschach als Mannschaftsdisziplin
(FIDE-Schacholympiade, Bundesliga/4NCL, World Team Rapid & Blitz Championships 2026),
Brett-vs-Mannschaftspunkte, Zeitnot-Schwellenwert bei 10-30s Restzeit. Loest damit auch die K3-
Luecke, die bisher geteilt in `takeshi-schach-optik-gameplay-plan-05-09.md` Teil A und
`arena-duell-recherche-fable.md` Abschnitt 4 steckte.
**Assets 95:** `TON_KATALOG.speed-schach` (seit PR 0.1) jetzt verdrahtet (zug/schlag/uhr/matt/
Publikum, mit N1-Loop-Reset), dritter `DISZIPLIN_PROP`-Eintrag (Schachuhr an der Hand, per
Pixelscan gemessen, unabhaengig von der Review nachgemessen und bestaetigt).
**Gameplay 100:** rho **0,908** (zweitbeste im Feld), produktiviert, eigene `wertungTabelle`
mit „Brett"/„Stark"/„Zeit−" — unveraendert.
**Movement 95:** `stepSchach()` als vierter Zweig in `buehnenBewegung()` — Figuren gleiten am
Fokus-Brett statt zu springen, Schachuhr tickt exponentiell statt in Spruengen, Hand schlaegt
sichtbar auf den Knopf. Die Zugfolge selbst bleibt bewusst „eine plausible Zugfolge" (Kommentar
`:10788`), keine Schach-Engine — das war nie Teil des Auftrags.

### Eiskunstlauf — 87 % (90/70/95/94)
**10.09. Update:** Movement 60→94 (PR #874, PRODUKTIONSCODE, Opus-Review FREIGEBEN MIT NACHTRAG).
Echte Kuer-Bewegung ersetzt das Reihenbild — Laeufer gleiten statt zu stehen. 12.09.: der
Kufenspur-Ringpuffer pausiert jetzt waehrend `haeltStelle` (PR #895, Kleinbefund #2), sonst fiel
die Spur bei einer Pirouette auf einen Punkt zusammen — Politur, keine Punktaenderung.
**Konzept 90:** `duett:true` (automatische Paarung bei gerader Feldgroesse, PR #859), `rundenN` an
der realen ISU-Programmlaenge (12 statt 6, Spearman-Brown-Runde vom 07.09., gemessen 0,792 → 0,875).
Eigenes Fable-Dokument (`eiskunstlauf-duett-paarlauf-recherche-08-09.md`) plus die Politur-Recherche.
**Assets 70:** `eiskunst.tsx` (599 Z.) und `zeichneDuett()` (`:11822`, ~100 Z., Paare + Eisspur).
Die Waffenebene ist korrekt entfernt (`:2574`) — aber es gibt keine Schlittschuhe, kein Kostuem.
**Gameplay 95:** rho **0,885** (frisch gemessen, 0,010 ueber der Basislinie), produktiviert.
**Movement 94:** echte Kuer-Bewegungsmaschine (`stepKuer`, PR #874) statt Reihenbild — Laeufer
gleiten sichtbar ueber das Eis, Kufenspur folgt korrekt (inkl. Pause waehrend `haeltStelle`).

### Takeshi's Castle — 97 % (100/95/97/95)
**10.09. Update:** Assets 60→95, Gameplay 67→97 (PR #880 Bahn-Produktivierung, Opus-Review
FREIGEBEN; PR #883 Ton-Verdrahtung). `takeshi.tsx` waechst von 273 auf 517 Zeilen / 3 auf 14
Animationsstellen; Ton (A4 0→20) ueber vier Aufrufstellen plus Loop-Start/-Stop/-Reset, Leck-Test
in den vier Geschwister-Bahnen bestanden. 12.09.: PR #895 (Kleinbefund #5/#6) tauscht den
Ausscheiden-Klang von "tor" auf "platsch" (semantisch richtig) und drosselt Falle/Sturz/Tor auf
0,12s — Politur, keine Punktaenderung.
**12.09. Update:** Movement 85→95 (PR #900, PRODUKTIONSCODE). M2 (Laeufer-Zustandsmaschine) und
M4 (drei Posen) waren die letzten offenen Movement-Luecken (Plan-Dokument Abschnitt 4.3):
`stepParcours(dt,art)` gibt dem Laeufer selbst eine Zustandsmaschine (laufen → fallenkontakt →
sturz/aufrappeln → laufen) statt nur der Falle, dazu Sprungbogen/Duck-Scale/Taumeln je nach
Fallentyp. Unabhaengige Review fand drei blockierende Befunde, alle behoben: der geschaetzte
Startnummernband-Ankerpunkt sass 5-7px zu tief (per echtem Pixelscan korrigiert, Beweisbild
`docs/design/sprite-armpunkte-beweis-takeshi.png`), fehlende Z-Skalierung liess das Band 5-10px je
nach Laeufergroesse driften (jetzt dieselbe `x-32*Z+cx*Z`-Formel wie `HOCKEY_HAND`/`HEBEN_HAND`),
und das Feld hiess `arm` statt des vom `DISZIPLIN_PROP`-Vertrag vorgeschriebenen `hand`
(umbenannt zu `TAKESHI_HAND`).
**Konzept 100:** die inhaltlich reichste Disziplin des Projekts — Ausscheiden nach drei Stuerzen,
vierzehn Fallen in fuenf Typen mit eigener Stufe (`fallenStufe`), drei benannte Kurse,
Chaos/Tackle-Fenster, Gedraenge, Burgpunkte als echte Wertung. Vier eigene Dokumente
(`takeshi-animationen-hilfe-behinderung-recherche-06-09.md`, `takeshi-chaos-tackle-plan-06-09.md`,
`takeshi-schlammroute-plan-06-09.md`, `takeshi-schach-optik-gameplay-plan-05-09.md`).
**Assets 95:** `bodenTakeshiRoute()` (Schlangenroute mit fuenf Gelaendezonen, Tuempeln, Burgmauer
und Tor), `zeichneFalleTakeshi()` (zehn Fallenbilder), `takeshi.tsx` jetzt 517 Zeilen/14
Animationsstellen (PR #880), eigener Ton (PR #883).
**13.09. Update:** der TYP der Falle entscheidet den Sauber-Wurf mit (`fallenKoennen`) — Hindernis-
und Streckentempo werden getrennt, rho je Spiel **0,861 → 0,883**, Saison 0,930 → 0,951
(Fable-Recherche `takeshi-hindernis-vs-strecke-recherche-13-09.md`). Die vier Prozentachsen bleiben
unveraendert: die Aenderung schaerft eine Mechanik, die im Audit schon als vorhanden gezaehlt war.
**14.09. Update:** die Puste-Erholung der Bahn-Welle (PR #914) wirkt hier wirklich — Takeshi ist
neben Climbing die einzige Bahn, auf der Laeufer an Hindernissen stehen und die Gutschrift feuert:
**21,4 % → 12,5 %** bleiben leer, **11,1 %** fangen sich wieder. Neu ist nur eine dritte Spalte an
der bestehenden Tabelle (`pusteHindernis`, WUCHT 0,30 bis WENDIGKEIT 0,05), **bewusst keine zweite
Taxonomie** neben `hindernisTypen`/`fallenStufe`. Kosten: rho 0,883 → **0,879** (Spannweite 0,101).
Keine Achse bewegt sich — die Mechanik zaehlt in K2 bereits als vorhanden.
**Gameplay 97:** rho **0,879** (14.09. gemessen), eigene Burgpunkte-Wertung, seit PR #880
produktionsangeschlossen.
**Movement 95:** `stepParcours()` als eigener Zweig im Bahn-Bewegungspfad — Laeufer-Zustandsmaschine
(laufen/fallenkontakt/sturz/aufrappeln) plus drei sichtbare Posen (Sprungbogen/Duck-Scale/Taumeln),
Startnummernband per Pixelscan verankert und Z-skaliert.
**Korrektur 14.09.:** hier stand bis heute „Noch nicht produktionsangeschlossen (kein Eintrag in
`ARENA_RESOLVED_DISCIPLINE_IDS`)" — im direkten Widerspruch zur Gameplay-Zeile darueber.
Nachgelesen: `takeshis-castle` steht dort seit der Bahn-Produktivierung
(`lib/resolve/battle-mode-arena-team-points.ts:251`). Die Gameplay-Zeile hatte recht, dieser Satz
nicht; die Arena-Spalte in der Tabelle oben ist entsprechend auf „ja" korrigiert.

### Breaking — 96 % (95/100/95/92)
**10.09. Update:** Assets 65→100, Movement 55→92 (PR #875, PRODUKTIONSCODE, Opus-Review FREIGEBEN
MIT NACHTRAG). Echter Cypher mit Move-Mechanik ersetzt die rein zeichnerische Kulisse. 12.09.: PR
#895 (Kleinbefund #3/#4) korrigiert die Freeze-/Rueckzug-Fade-Divisoren (rissen bei halber
Deckkraft ab) und glaettet den Ringwinkel bei Rangwechseln — Politur, keine Punktaenderung.
**12.09. Update:** Konzept 85→95 (PR #897, reines Dokument, kein Codechange). K4 ("Rezept
nachweislich kalibriert, offene Designfragen entschieden") war die letzte offene Konzept-Luecke.
Neues Dokument `docs/design/breaking-kalibrierung-10-09.md` kalibriert gegen echte WDSF-Daten: die
Rundenzahl (`rundenN:8`) passt zur realen Battle-Struktur (2-3 Throwdowns a ~5 Teile), zwei
Rezept-Hypothesen (`rundenN`8→12, `failAbzug`0,55→0,35) wurden gemessen und bewegen beide weniger
als Breakings Kader-Spannweite (0,114) — eine sogar in die falsche Richtung — also blieb der Code
unveraendert. Charisma-Gewicht 0 bestaetigt sich gegen die tatsaechlichen fuenf WDSF-Kriterien.
**Konzept 95:** eigenes Torment/Will-Rezept ohne Charisma, mit gemessener NACHGEZOGEN-Korrektur
(`:10744`), `rundenN` 4 → 8 an der realen WDSF-Bewertung, jetzt zusaetzlich gegen echte Sportdaten
kalibriert (s.o.). Zwei eigene Fable-/Design-Dokumente
(`breaking-folter-survival-visuelle-identitaet-recherche-08-09.md`,
`breaking-kalibrierung-10-09.md`).
**Assets 100:** `zeichneBreaking()` (lila Cypher mit vier Ringzonen und SURVIVOR-Spotlight),
`breaking.tsx` seit PR #875 deutlich gewachsen.
**Gameplay 95:** rho **0,869**, produktiviert (Welle 2).
**Movement 92:** echte Move-Mechanik (`stepCypher`, PR #875) statt reiner Zeichenkulisse —
Toprock/Footwork/Powermove/Freeze-Phasen, Ringposition glaettet jetzt bei Rangwechseln (PR #895).

### Staffel — 96 % (95/95/97/95)
**NACHZUG 13.09. — Assets 55→95, Movement 70→95 (PR #901).** Diese Zeile war bei ihrer letzten
Pflege am 12.09. bereits ueberholt und ist nie nachgezogen worden: PR #901 („Stab + fliegende
Uebergabe + Ton", Ziel 6 des Opus-Plans) hat A3 und A4 geschlossen. Nachgelesen, nicht aus dem
Commit-Titel uebernommen: `zeichneStab()` und `DISZIPLIN_PROP.staffel` stehen in
`battle-mode.engine.js:2530/2616` (Handpunkt = `HOCKEY_HAND`, weil ein laufender Staffellaeufer in
`zeichneSpurt()` immer `vx:4/richtung 3` bekommt — exakt die Pose, fuer die `HOCKEY_HAND` schon
per Pixelscan vermessen ist), und `TON_KATALOG.staffel` ist an **vier** Stellen verdrahtet.
Der Satz „**Kein Staffelstab-Sprite** — der Stab ist Mechanik, kein Bild" weiter unten galt bis
zum 12.09. und gilt nicht mehr.

**14.09. Update: rho 0,915 → 0,899 (PR #916).** Chris hat das erste Live-Rennen gesehen und fuenf
Dinge gemeldet; drei davon waren echte Fehler.
- **Die Bahn war keine Bahn.** Alle Bahngrenzen waren konzentrische Ellipsen mit demselben
  `OVAL_RX` — das ist keine Parallelkurve: an den Scheiteln fiel der Bahnabstand auf **null**.
  Jetzt die echte Stadionform (zwei Geraden 84,39 m, Innenradius 36,5 m, Bahnbreite 1,22 m, World
  Athletics *Track and Field Facilities Manual 2019*), y um 0,57 gestaucht — die Verkuerzung einer
  erhoehten Kamera, nicht eine erfundene Proportion. Boden und Laeufer teilen sich jetzt **eine**
  Kurvendefinition statt zweier Formeln, die nur zufaellig dieselbe Ellipse trafen.
- **„Staendig ueberrundet" war ein Anzeigefehler** — es wurde nie ueberrundet. Der Winkel kam aus
  dem Fortschritt **im eigenen Abschnitt**, und der faellt bei jedem Wechsel auf 0. Weil die
  Uebergabe genau auf der Ziellinie lag, sprang der Fuehrende bei **jedem** Wechsel sichtbar hinter
  den Verfolger. Jetzt aus dem Gesamtfortschritt: **wer vorne laeuft, fuehrt.**
- **Die Zeiten.** Die Rennuhr rechnete laengst richtig, **jede andere** Zeitangabe gab rohe
  Simulationssekunden aus. Bei `ZEIT_DEHNUNG.staffel = 14,65` stand eine Etappe als `1.8 s` da, die
  der Zuschauer 25,7 Sekunden lang sieht. Jetzt ueber dieselbe Umrechnung wie das Zeitfahren
  (`bahnSpanneAnzeige`/`bahnZeitText`), inklusive Locale — **alle fuenf Bahnen schreiben Zeiten
  jetzt gleich.**
- **„Sehr sehr statisch" war schlimmer als gemeldet.** Ueber 200 Saaten waren die Wechselverluste
  **zeichengleich identisch**: `verlust` hatte keinen Zufallsanteil, und der Patzer feuerte nie
  (seine Chance wird bei ueblichen Werten negativ und faellt auf den Boden 0,01 — gemeint waren
  4,5 %). Neu: dreiecksfoermige Ausfuehrungsstreuung, deren **Breite das Koennen einengt**
  (die Rangtreue bleibt damit am TECHNIK-Wert haengen), Patzerboden 4,5 %, Patzerkosten 0,9 → 0,34
  Sim-s — haeufiger und kleiner statt selten und erschlagend. Verschiedene Rennausgaenge je 200
  Saaten: **27 → 72.**

**Was das kostet, und warum es bezahlbar ist.** rho 0,915 → **0,899**. Das ist die einzige
Bewegung dieser Merge-Welle, die als **systematisch** nachgewiesen ist statt als Kaderrauschen:
gepaart auf denselben Kadern und Saaten gemessen, −0,016 bei n=24 und −0,018 bei n=96, auf zwei
verschiedenen `main`-Staenden gleich. Sie liegt 0,099 ueber der Schranke und 0,049 ueber der
Zielmarke, die Saison-Validitaet bleibt bei 0,951. G1 bleibt damit auf 40, Gameplay auf 97.
**10.09. Update:** Gameplay 67→97 (PR #880, PRODUKTIONSCODE, Opus-Review FREIGEBEN). Bahn-Chassis
ist jetzt produktionsangeschlossen (G2 0→30).
**Konzept 95:** die einzige Bahn, auf der nicht alle gleichzeitig laufen — sechs Abschnitte, fuenf
Wechsel, Wechselzeit als eigene Groesse (`wechselBasis`/`wechselSpanne`/`wechselStrafe`),
Windschatten bewusst AUS mit gemessener Begruendung. Drei eigene Dokumente
(`staffel-modellierung-recherche-05-09.md`, `staffel-oval-broadcast-hud-recherche-06-09.md`,
`bahn-disziplinen-recherche-fable.md` Abschnitt 1).
**Assets 95:** echte Stadionbahn mit Randstein, abgesetztem Innenfeld, karierter Ziellinie und
Wechselzonen-Dreiecken (PR #916), `track.tsx` (321 Z., 13 Animationsstellen), Staffelstab-Sprite
(`zeichneStab`) und `TON_KATALOG.staffel` an vier Aufrufstellen (PR #901).
**Gameplay 97:** rho **0,899 — nach Speed-Schach die zweitbeste Rangtreue im Feld.** Eigene
Etappenwertung (`bahnTeamstand()` `wertung:"etappe"`, `:15794`), produktionsangeschlossen seit
PR #880.
**Movement 95:** fliegende Uebergabe mit sichtbarem Stab (PR #901); wartende Laeufer stehen auf
**zwei** Wechselzonen im Innenfeld statt als Namensbrei an der Ziellinie — und die Auffaecherung
feuert seit PR #916 wirklich: sie war vorher an `Math.abs(o.pos - u.pos) < 1e-6` gehaengt, einem
Praedikat, das **nie zutrifft** (Wartende derselben Zone unterscheiden sich um ganze Runden,
nicht um null). Nachgemessen standen dadurch drei Figuren exakt aufeinander; jetzt 17,1 px
Abstand, kein Paar naeher als 12 px.

### Football — 79 % (90/75/65/85)
**10.09. Update: Gameplay 35→65.** PR #884 (PRODUKTIONSCODE, Opus-Review) hat Rezept Runde 1
gebaut — `fkLos`/kappa 3, Rezept C, eigene Tackle-Zeile. rho **0,516 → 0,800**, genau auf der
Schranke (0,80–0,85-Stufe → G1 35). Kein Produktionsanschluss (G2 bleibt 0).
**12.09. — E3 in Pruefung, NICHT gemergt:** Fable-Entscheidung E3 (PR #894, Draft) zieht die
Anzeige-/KI-Kauf-Seite auf dieselben Gewichte wie das Minispiel (Override-Tabelle statt
Matrix-Aenderung, s. `lib/player-generator/spiel-eignung-overrides.ts`). Gemessener Nebeneffekt
(F2, im Plan vorab benannt): rho faellt dabei auf **0,714 (n=24) / 0,724 (n=48)** — G1 wieder auf 22,
Gesamt 79→71. **Wartet auf Chris' explizite Bestaetigung im Chat**, bevor gemergt wird — die Zeile
oben zeigt den AKTUELLEN, gemergten Stand (0,800), nicht den Stand nach E3.
**Konzept 90:** Downs, Line of Scrimmage, echte Formationen, Playcall, eigener `spielEignung`-Block
neben der gesperrten Matrix (PR #803). Kalibriert gegen echte NFL-2024-Quoten
(`football-rezept-kalibrierung.md`). K4 nur teilweise: Anzeige/Teamstaerke/KI-Kauf ordnen Football
weiterhin nach der ALTEN Matrix, das Minispiel nach der neuen — genau die Frage, die E3 loesen soll.
**Assets 75:** eigene Ausruestung (Helme/Montur, `footballGear`, `:2593`), Endzonen und Line of
Scrimmage im geteilten Feldspielbild (`:10089`), `football.tsx` (348 Z.).
**Gameplay 65:** rho **0,800** (PR #884), genau auf der Schranke. Kein Produktionsanschluss;
dient im Testcode weiterhin als benannte Kontrolldisziplin (`D2_KONTROLL_DISZIPLIN = "football"`).
**Movement 85:** Snap-Standphase plus fuenf visuell unterschiedene Spielzugtypen mit je eigener
Ballflugbahn — laut eigenem Bericht strukturell fertig, aber noch nicht poliert.

### Spurt — 69 % (95/55/67/60)
**Konzept 95:** Hindernislauf mit stetigem Zeitpreis je Station statt Ermuedungssprint
(`hindernisTypen`, `huerdePreis`, `wuchtPreisFaktor`), feste Stationsfolge aus Paket B. **Zwei**
gemessene Nachziehungen (rho 0,652 → 0,857 → 0,871, Dexterity-Einfluss 3,5 % → 16,7 %). Eigene
Dokumente (`spurt-modellierung-recherche-05-09.md`, `spurt-offene-fragen-plus-optik-plan-05-09.md`).
**Assets 55:** `hindernisBilder` gibt jeder der sieben Stationen ein eigenes Bild (Huerde, Balken,
Wand, Seil, Wasser, Mauer, Heu) plus ein brennendes Ziel (`feuerZiel`) — die einzige Bahn mit
Bild-je-Station. `bump.tsx` (394 Z., 12 Animationsstellen).
**Gameplay 67:** rho **0,871** (14.09. ziffernidentisch nachgemessen), Rangwertung. Kein
Produktionsanschluss.
**Movement 60:** eigene Schrittlogik mit Hindernis-Stopp, Rempler, Windschatten, drei Rennplaenen —
aber kein eigener Zeichenzweig, alles laeuft durch `bodenSpurt()`.
**14.09.:** die Puste-Erholung der Bahn-Welle (PR #914) ist eingeschaltet, feuert hier aber
praktisch nicht — ueber die kurze Distanz laeuft das Feld durchgehend auf Plantempo und bricht nur
zu 5,5 % ein; erholt wird nur am Hindernis, waehrend des Einbruchs und unter Plantempo. rho
ziffernidentisch. Die **eingefrorene Sprite-Animation** (s. Time-Trial oben) gilt fuer Spurt
weiterhin: PR #908 hat nur `stepZeitfahren()` repariert, die uebrigen vier Bahnen brauchen denselben
Handgriff in ihrer eigenen step-Funktion. Das ist der billigste offene Movement-Posten der Bahn.

### Time-Trial — 76 % (95/50/92/65)
**13.09. Update: Movement 50→65, Assets 45→50 (PR #908).** Chris hat ein laufendes Zeitfahren
angeschaut und sieben Dinge gemeldet; alle sieben sind mit einer eigenen Sonde
(`scripts/probe-zeitfahren-anzeige.mjs`, echtes Rennen im Browser) **nachgestellt worden, bevor
eine Zeile geaendert wurde**. Der unangenehme Teil der Antwort zuerst: **der Endstand war immer
echt** — `bahnRangliste()` sortiert nach `u.fertig − u.startT`, und `u.fertig` schreibt
`stepSpurt()` in genau dem Tick, in dem dieselbe `u.pos` die 1 erreicht, die auch gezeichnet wird.
Es gibt keine zweite Formel. **Falsch war alles, was WAEHREND des Rennens zu sehen war:**
- **Der vorlaeufige Stand mass die Startfolge, nicht das Rennen.** Er sortierte nach roher
  Strecke — bei einem Massenstart richtig, bei einem **Einzelstart** schlicht die falsche Groesse:
  wer 8,8 s frueher von der Rampe rollt, hat immer mehr Strecke, ohne schneller zu sein. Die
  K5-Umsetzung vom 07.09. hatte den **End**stand auf `bahnZeit` umgestellt und diesen Zweig
  uebersehen. Gemessen stand 41 Sekunden lang `57 : 21` — der rechnerisch groesstmoegliche
  Vorsprung. Jetzt: hochgerechnete Eigenzeit `(rennT − startT)/pos`.
- **Angezeigte Zeit und Uhr hatten zwei Massstaebe.** Bei `ZEIT_DEHNUNG["time-trial"]=4,38` lief
  beides um Faktor 4,38 auseinander — „8,1 s" bei einer Uhr von 1:26. Jetzt „35,4 s" bei 1:38.
- **Alle Figuren schwebten**, und der Grund war haerter als „zu langsam": die globale
  Sprite-Animationsuhr `t` wird nur in `stepSim()` hochgezaehlt, **hinter**
  `if(istBahn(disc))return stepSpurt(dt)`. Auf der Bahn wurde `t+=dt` nie erreicht, der Bildindex
  war eine **Konstante je Laeufer** — jede Figur ein stehendes Einzelbild, das ueber die Strecke
  gleitet. `stepZeitfahren()` liefert jetzt `vizSchritt` (Laufzyklus, vom Tempo getrieben),
  `vizErschoepft` und `vizRampe`.
- Dazu: Kamera von festem Zoom 2,2 auf einen Kasten um Fokus und Nachbarn, Startrampe mit
  Countdown angesagt (der gestaffelte Start ist **richtig**, er sah nur aus wie ein Fehler, weil
  ihn nichts ansagte), Ausdauer-Leiste von 26×3 px auf 38×5 px mit Rahmen, Marke und Wort.

**Wie das eingestuft ist:** M2 und M3 waren vorher schon gezaehlt (eigene Schrittlogik, Animation
in `peloton.tsx`), **M4 kommt neu dazu** — disziplineigene Posen/FX an den Sprites, wo vorher ein
Standbild glitt: Movement 50→65. Bei Assets bleibt die Haupt-Luecke offen (das Streckenprofil ist
auf der Bahn weiterhin unsichtbar, man sieht keinen Berg); Startrampe, Ausdauer-Leiste und HUD sind
eigene Motor-Elemente und heben A2 um eine Teilstufe: 45→50. **Gameplay bleibt 92** — die Rubrik
kennt kein Kriterium „Anzeige stimmt", und rho bewegt sich 0,828 → 0,825 innerhalb derselben
G1-Stufe.
**10.09. Update:** Gameplay 62→92 (PR #880, Bahn-Produktivierung). Produktionsanschluss (G2 0→30).
**Konzept 95:** die K5-Umsetzung hat die neun Sturz-Kurven **ersatzlos gestrichen** (ein Zeitfahren
hat keine Gegner) und durch ein stetiges Streckenprofil ersetzt — sieben Gelaendezonen
(Steigung/Abfahrt/Kurve), gestaffelter Start, Zwischenzeiten, Tagesform ±1,5 %. Eigenes Dokument
(`zeitfahren-recherche-06-09.md`) plus Wertungsplan.
**Assets 50:** `peloton.tsx` (472 Z., 9 Animationsstellen) ist gut, dazu seit PR #908 Startrampe
mit Countdown, lesbare Ausdauer-Leiste und ein HUD, das Rang, Rueckstand und Ausdauer des
Fokussierten zeigt — aber im Mockup ist das Streckenprofil weiterhin **unsichtbar**: `gelaende`
wirkt in `gelaendeFaktor()` (`:18121`) und erscheint nur als HUD-Balken (`:20207`), nicht auf der
Bahn. **Man sieht keinen Berg** — das bleibt die offene Haupt-Luecke dieser Zeile.
**Gameplay 92:** rho **0,825** (14.09. gemessen), Rangwertung, produktionsangeschlossen seit
PR #880. *(Die Ueberschrift „Gameplay 62" stand hier bis zum 14.09. und war seit dem 10.09. durch
das Update oben ueberholt.)*
**Movement 65:** `stepZeitfahren()` als eigener Zweig im Bahn-Bewegungspfad (Laufzyklus aus dem
Tempo, Erschoepfungspose, Rampe) — kein eigener Zeichenzweig, M1 bleibt offen.

### Fechten — 59 % (55/55/90/35)
**Konzept 55:** der Chassiswechsel von der Arena auf die Buehne war richtig (rho 0,153 → 0,816),
aber das Rezept ist im Code selbst als **„ERSTER, AUSDRUECKLICH NICHT FINALER
Sieben-Rollen-Entwurf"** bezeichnet (`:10934`) und hat nie eine Kalibrierrunde bekommen. Der Puffer
zur Schranke (0,016) ist kleiner als das eigene Kaderrauschen (0,192) — die Disziplin steht live
auf einer Zahl, die statistisch nicht von einem Fehlschlag zu unterscheiden ist.
**Assets 55:** `lamps.tsx` (551 Z., **22 Animationsstellen — die hoechste Dichte aller zwanzig**)
und seit 07.09. korrekt IMMER die Schwert-Waffenebene (`:2573`). Aber keine eigene Motor-Szene.
**Gameplay 90:** rho 0,816, produktiviert (Welle 2).
**Movement 35:** kein eigener Zeichenzweig, kein eigener Paar-Rechner (bewusst, s.
`tennis-fechten-rollout-plan.md` E.2) — zwei Reihen Figuren mit Schwert.

### Tennis — 56 % (75/40/90/20)
**10.09. Update:** Assets 30→40. Der Zufallswaffen-Bug (Abschnitt 3.2) ist projektweit geschlossen
— `DISZIPLIN_WAFFE` fuehrt Tennis heute mit `null`, der Spieler schwingt keine Kosmetikwaffe mehr.
**Konzept 75:** eigene, aus Tennis' MATRIX abgeleitete Rezeptkalibrierung (07.09., `:10837-10922`,
0,786 → 0,825) — das war die Behebung der 1:1-Uebernahme aus dem alten Feldspiel-Rezept. Die
Mechanik selbst ist aber Speed-Schachs `duell:true`, kein eigener Ballwechsel-Rechner.
**Assets 40:** `tennis.tsx` (424 Z., 17 Animationsstellen) — im Mockup weiterhin **das generische
Buehnen-Reihenbild**, aber die Zufallswaffe ist seit dem 10.09. weg (`DISZIPLIN_WAFFE` mit `null`).
Eigene Requisiten (Schlaeger) gibt es weiterhin nicht — daher 40, nicht mehr.
**Gameplay 90:** rho 0,825, produktiviert (Welle 2).
**Movement 20:** nichts Eigenes im Motor.

### Mini-DM — 53 % (70/60/22/60)
**14.09. Update: Movement 55→60 (PR #912).** S. den gemeinsamen Abschnitt „Die drei
Kampf-Disziplinen" direkt unter TDM — der Reihenabstand steigt hier **8,8 → 59,0 px** und der
Durchbruch faellt **18,3 → 4,3 %**, die deutlichste Entlastung der drei.
**Konzept 70:** eigenes Sechs-Attribut-Rezept, **bewusst gegen TDMs Speed-Fehler gebaut**
(`ARENA_ART["mini-dm"]`, `:4076`: „Bei einer neuen Disziplin diesen Fehler zu wiederholen waere
mutwillig"). Eigenes Dokument (`mini-dm-4-team-ffa-recherche-06-09.md`).
**Assets 60:** `duelhp.tsx` (555 Z., 15 Animationsstellen), echte Waffen/Ruestungen/Schilde am
Sprite — aber dasselbe Arenabild wie TDM und Battlefield, nur mit weniger Kaempfern.
**Gameplay 22:** rho **0,256** (14.09., vorher 0,094). Kader-Spannweite **0,661** — das
Zweieinhalbfache des Medians: bei n=24 ist hier keine Aenderung nachweisbar, auch diese nicht.
**13.09. Befund (PR #911): der 4-Team-FFA-Modus hat NULL Produktionsaufrufer.** Der Code ist
vollstaendig und gut (`battle-mode.engine.js` 23093-23270: Ecken-Spawns, vier Rollenrunden,
Rundenpunkte 4-3-2-1, Ligapunkte 2-1-0-0 nach Chris' ausdruecklicher Uebersteuerung,
Gleichstand-Teilung) — er wird nur von **drei Messskripten** aufgerufen und von keiner Zeile in
`lib/` oder `app/`. Mini-DM steht ausserdem nicht in `ARENA_RESOLVED_DISCIPLINE_IDS` und laeuft im
echten Spielstand heute mit `playerCount: 2` ueber das liga-weite Renn-Scoring. **Das aendert die
Zahlen oben nicht** (G2 stand ohnehin auf 0), aber es korrigiert, was „Mini-DM ist die
Vier-Team-Disziplin" bisher suggeriert hat: sie ist ein **nicht angeschlossener Prototyp**, nicht
ein schmaler Sonderfall. S. 3.5.
**Movement 60:** der volle Kampf-Bewegungsapparat, geteilt statt disziplineigen — aber seit
PR #912 mit dauerhafter Reihenformation.

### Battlefield — 53 % (70/60/22/60)
**14.09. Update: Movement 55→60 (PR #912).** Reihenabstand **34,5 → 155,0 px** — die deutlichste
Bewegung der drei, weil der Commander als einziger in Reihe 2 steht und jetzt auch dort bleibt.
**Konzept 70:** die einzige Kampfdisziplin, in der Power NICHT oben steht — Charisma/Intelligence/
Spirit tragen zusammen die Haelfte (`:4108`), ein gefuehrtes Gefecht statt einer Schlaegerei. Die
Aufstellungs-Umkehr (Siege Core stand hinten, rho −0,49) ist behoben und nachgemessen.
**Assets 60:** `territory.tsx` (625 Z. — die groesste Feld-Datei, 13 Animationsstellen).
**Gameplay 22:** rho **0,251** (14.09., vorher 0,387; Kader-Spannweite 0,778), kein Anschluss.
Die Zielwahl ist seit PR #912 **nicht mehr reine Geometrie** — drei der sechs Archetypen lesen
jetzt die Aufstellung (s. unter TDM). Der Satz „264 von 288 Kaempfern zielen auf den Naechsten"
galt bis zum 13.09.
**Movement 60:** wie Mini-DM/TDM, seit PR #912 mit dauerhafter Reihenformation.

### TDM — 52 % (55/65/22/65)
**14.09. Update: Movement 60→65 (PR #912).** Reihenabstand **20,4 → 81,3 px**.
**Konzept 55:** teilt sich `REC.power` mit den anderen Arena-Disziplinen. Das ist ausdruecklich
begruendet, nicht vergessen: **vier** eigene TDM-Rezepte wurden gebaut und gemessen (168 / 83 /
114,5 / 57,9 Pp), jedes war schlechter oder ununterscheidbar (`:4046-4073`). Kein eigenes Dokument,
nur die geteilte Arena-Recherche.
**Assets 65:** `bodenArena()` (`:16095`) IST das TDM-Bild — Sandkachel, Steinring, Blutflecken,
neunbildrige Fackelanimation, teamgefaerbte Haelften. Es ist das aelteste und dichteste
Chassis-Bild des Projekts, nur eben von drei Disziplinen geteilt. `kda.tsx` (396 Z.).
**Gameplay 22:** rho **0,165** (14.09., vorher 0,253; Kader-Spannweite 0,272). Und: der rohe
Impact-Wert bis 900/1400 landet ungenormt im Endstand-Bildschirm — **genau der Fall, ueber den
Chris sich beschwert hat** (`einheitlicher-spieler-score-pps-recherche-09-09.md` Abschnitt 3).
**Movement 65:** Laufen, Angreifen, Stuerzen, Taumeln — der Sprite-Apparat, fuer den die Arena
urspruenglich gebaut wurde, seit PR #912 mit dauerhafter Reihenformation.

#### Die drei Kampf-Disziplinen gemeinsam — 14.09., PR #912
Chris nach einem Live-TDM: „TDM ist noch zu statisch ... es gibt gar nicht ne dynamik wo manche
versuchen laut ihrem charakter oder stil eher die backrow oder sonstwas standardmaessig zu
attacken und so richtig ne formation front und backrow gibt es nciht." Zwei Befunde, beide
bestaetigt — und **zuerst gemessen, dann gebaut**: rho kann den Vorwurf prinzipiell nicht
beantworten (»gibt es eine Formation?« ist eine Aussage ueber Geometrie), also gibt es dafuer eine
eigene Sonde, `scripts/miss-arena-formation.mjs`.

**Befund 1 — die Zielwahl war zu drei Sechsteln gar keine.** `PERSZIEL` legte bollwerk,
draufgaenger **und** beschuetzer auf `"naechster"`; „Naechster" ist aber keine Neigung, sondern die
Abwesenheit einer. Genau **ein** Archetyp (schleicher) hatte ueberhaupt eine Stellungsabsicht —
und die lief in Mini-DM ins Leere, weil `"hinten"` hart auf `f.row===2` filterte und Mini-DM mit
vier Slots gar keine Reihe 2 hat. Neu: `hintersteReihe()` (die hinterste **besetzte** Reihe, eine
Quelle statt zweier Filter), **draufgaenger → `"speer"`** (der am weitesten vorgerueckte Gegner,
also die Spitze der gegnerischen Formation — mehrere Draufgaenger buendeln sich dadurch auf
denselben Vorstoss) und **beschuetzer → `"schild"`** (nicht der Gegner, der *ihm* am naechsten
steht, sondern der, der einem seiner **Kameraden** am naechsten steht). Ergebnis: fuenf
verschiedene Neigungen auf sechs Archetypen, drei davon lesen die Aufstellung.

**Befund 2 — die Reihen waren ein Startbild, keine Formation.** Der Bauweg war nie kaputt:
`homeFor()` stellt drei Spalten im Abstand von 160 px auf. Das galt genau einen Frame lang, weil
die Formationsleine an `teamFront()` hing — **einer** Linie fuer die ganze Mannschaft, fuer alle
drei Reihen dieselbe. `reihenAnker(u)` haengt sie jetzt an die eigene Reihe, und der Rang wird
**gezaehlt, nicht gelesen** (sonst wuerde eine Mannschaft, deren Front gefallen ist, vor einem
leeren Feld zurueckweichen). Dazu `versperrt(u)`: der Durchbruch loeste die Leine schon bei
„dasselbe Ziel seit 3 s und immer noch zu weit weg" — was auf jeden zutrifft, den die **eigene**
Aufstellung haelt; jetzt muss wirklich jemand im Weg stehen.

| | Reihenabstand | verkehrt herum | Durchbruch aktiv |
|---|---:|---:|---:|
| tdm | 20,4 → **81,3 px** | 32,6 → 28,4 % | 23,1 → 19,1 % |
| mini-dm | 8,8 → **59,0 px** | 31,5 → 27,1 % | 18,3 → **4,3 %** |
| battlefield | 34,5 → **155,0 px** | 34,4 → 22,0 % | 20,0 → 15,9 % |

**Warum das +5 auf Movement wert ist und nicht mehr.** Die Formationsmessung bewegt sich um das
Vier- bis Siebenfache und liegt weit ausserhalb jedes Rauschens — aber sie fuellt kein neues
M-Kriterium: M1 (eigener Zeichenzweig) und M4 (disziplineigene Posen) bleiben bei allen dreien
offen, der Bewegungsapparat bleibt geteilt. Und der **Restbefund ist ehrlich benannt**: „verkehrt
herum" faellt nur von rund einem Drittel auf rund ein Viertel, der Offensivzwang steigt (tdm
5,9 → 15,3 %), weil das Endspiel (`live(seite)<=2`) die Reihen per Regel aufhebt und die Hinteren
jetzt laenger leben. Kein Fehler, aber keine vollstaendige Loesung.

**Zur rho-Spalte: keine der drei Bewegungen ist belegbar.** 0,253→0,165 · 0,094→0,256 ·
0,387→0,251, bei Kader-Spannweiten von 0,272 bis 0,778. Jede einzelne liegt darunter; nach
`messgrundlage-kaderfest.md` ist damit keine von null zu unterscheiden — **weder die Verbesserung
bei Mini-DM noch die Verschlechterung bei TDM und Battlefield.** Wer aus diesen Zahlen eine
Richtung liest, liest Kaderrauschen. Alle drei bleiben weit unter 0,80 und in derselben G1-Stufe.
Die uebrigen siebzehn Disziplinen sind in allen vier Spalten **ziffernidentisch** geblieben (`diff`
ueber achtzehn Zeilen: leer) — strukturell zu erwarten, weil jede geaenderte Zeile im `istKampf`-
Pfad liegt.

### Climbing — 49 % (65/40/49/40)
**Konzept 65:** zehn Griffe mit Griff-dann-Kraftzug-Kette, `steigung:0,85` (die Wand wird nach oben
steiler), kein Tackle. **Kein eigenes Dokument** — nur Abschnitt 4 der geteilten
`bahn-disziplinen-recherche-fable.md`, und der wurde nie in eine eigene Umsetzungsrunde ueberfuehrt.
Nie kalibriert.
**Assets 40:** `mountain.tsx` (337 Z., 8 Animationsstellen). Im Mockup gibt es **keine Kletterwand**
— nur `boden:"#5d5a54"` und `baeume:false` (`:17038`). Eine Wand sieht aus wie eine graue Bahn.
**Gameplay 49:** rho **0,782 — 0,018 unter der Schranke** (14.09. gemessen, vorher 0,790), die
billigste offene Rangtreue-Baustelle. Aber das eigene Kaderrauschen ist 0,191, das
Zehnfache des Fehlbetrags.
**Movement 40:** Steigungs-Zehrung im Schritt, sonst generisch.
**14.09.:** Climbing ist die Disziplin, auf der die Puste-Erholung der Bahn-Welle (PR #914) am
staerksten wirkt — **69,3 % → 31,9 %** bleiben leer, **59,7 %** fangen sich wieder, im Schnitt 1,2
Erholungen je betroffenem Laeufer. Genau Chris' Satz („manche laufen aus und fangen sich wieder,
manche bleiben leer"). Kosten: −0,008 rho, weit innerhalb der Spannweite; die Zeile bleibt in
derselben G1-Stufe und weiterhin knapp durchgefallen. Nebenbefund aus derselben PR, der hierher
gehoert: der **erste** Satz Erholungs-Konstanten war schlicht tot — 0,0 % Erholungen ueber 960
Laeufer, waehrend die Rangtreue gruen meldete. Gefunden hat das ein Verteilungs-Werkzeug, nicht das
Abnahme-Gate. **Eine tote Zeile veraendert nichts und besteht deshalb jede Abnahme.**

### Wettessen — 46 % (35/40/95/15) — **kein eigenes Konzept**
**10.09. Update:** Assets 30→40, Zufallswaffen-Bug geschlossen.
**Konzept 35:** es gibt ein eigenes, aus der Matrix abgeleitetes Rezept (will 26/health 22/
stamina 22, bewusst ohne Charisma, `:10761`) und eine eigene `wertungTabelle` mit Chris' eigenem
Wort „Pause". Das war es. **Es gibt kein Dokument, das Wettessen als Sportart modelliert**, keine
eigene Mechanik, keine Kalibrierrunde — es ist der generische Buehnen-Durchgangsrechner mit
anderen Attributgewichten.
**Assets 40:** `platter.tsx` (441 Z., 6 Animationsstellen, leergegessene Teller) — im Motor das
generische Reihenbild, aber ohne Zufallswaffe mehr (seit 10.09.).
**Gameplay 95:** rho **0,845**, produktiviert (Welle 2) — die Zahl ist gut, weil das
Buehnen-Chassis gut ist, nicht weil Wettessen gut ist.
**Movement 15:** nichts.

### Showcase — 45 % (25/40/95/20) — **kein eigenes Konzept**
**10.09. Update:** Assets 30→40. Die alte Notiz ("Showcase bewusst unangetastet") ist ueberholt —
`DISZIPLIN_WAFFE` fuehrt heute alle vier betroffenen Buehnen (Showcase/Tennis/Wettessen/I-Spy)
projektweit mit `null`, selbst nachgelesen.
**Konzept 25:** die duennste Disziplin unter den zehn produktiven. `BUEHNE_ART.showcase` (`:10658`)
ist der Sieben-Rollen-Standard mit Charisma-Gewichten — **kein Flag, kein Zweig, keine
NACHGEZOGEN-Korrektur, kein eigenes Dokument**. Der einzige Text ueber Showcase ist die
Produktivierungs-Notiz, die es mit Speed-Schach teilt.
**Assets 40:** `showcase.tsx` (623 Z., aber nur **3 Animationsstellen**). Im Motor generisch, aber
seit 10.09. ohne Zufallswaffe.
**Gameplay 95:** rho **0,892** (drittbeste im Feld), produktiviert seit Welle 1.
**Movement 20:** nichts Eigenes.

### I-Spy — 38 % (55/40/37/20)
**10.09. Update:** Assets 30→40, Zufallswaffen-Bug geschlossen.
**Konzept 55:** die **breiteste Matrix aller zwanzig** (zehn Attribute mit Gewicht) und eine
gemessene NACHGEZOGEN-Korrektur (`:10821`). Aber `duell:true` von Speed-Schach uebernommen, und der
einzige Konzepttext ist Abschnitt 4 von `arena-duell-recherche-fable.md` (Differenzwert), geteilt.
**Assets 40:** `spybar.tsx` (589 Z., 17 Animationsstellen) — im Motor generisch, aber seit 10.09.
ohne Zufallswaffe.
**Gameplay 37:** rho **0,684 — die einzige Buehnen-Disziplin, die die Abnahme nicht besteht.**
Technisch waere der Anschluss eine einzige Zeile (`duell:true` liegt vor); er ist **bewusst
unterlassen** und mit einem eigenen Regressionstest festgehalten (PM-Briefing 09.09., „die beiden
Achsen duerfen nicht deshalb vermischt werden, weil eine davon billig zu erfuellen waere").
**Movement 20:** nichts Eigenes.

---

## 3. Querschnittsbefunde, die jede Zeile oben beeinflussen

### 3.1 Ton — Stand 14.09. (nachgezaehlt): acht von zwanzig haben verdrahteten Ton, zwoelf sind
### stumm; echte Audio-DATEIEN hat weiterhin nur Basketball
Basketball bleibt die einzige Disziplin mit echten Audio-DATEIEN: `public/sound/basketball/` mit
sechs Dateien, ueber `bkSfx()` angebunden. **Hockey** hat seit dem 12.09. (E2, PR #893) einen
vollstaendig verdrahteten, prozeduralen `TON_KATALOG.hockey`-Eintrag (fuenf Ereignisse, synthetisch
erzeugt statt Audio-Datei — der Umgebungs-Proxy laesst keine Audio-Dateien durch) und zaehlt damit
ebenfalls als "hat Ton" (A4 0→20). PR 0.1 (#892, 12.09.) hat ausserdem **sechs weitere**
Katalogeintraege angelegt (Speed-Schach/Staffel/Football/Time-Trial/Spurt/Fechten) — reine Daten,
noch **ohne eine einzige Aufrufstelle**, also noch ohne Punktewirkung (A4 bleibt bei diesen sechs
bei 0, bis eine Ziel-PR sie tatsaechlich verdrahtet).

**Korrektur 14.09., nachgezaehlt statt geschaetzt.** Der Satz „Elf von zwanzig bleiben stumm" war
schon beim Schreiben ueberholt. Gezaehlt ueber die tatsaechlichen `sfx("<disziplin>"`-Aufrufstellen
in `battle-mode.engine.js` haben heute **acht** Disziplinen verdrahteten Ton: Basketball (ueber
`bkSfx()`, als einzige mit echten Audio-DATEIEN), Gewichtheben (8 Stellen), Hockey, Staffel,
Takeshi's Castle, Eiskunstlauf und Breaking (je 4) sowie Speed-Schach (3). **Zwoelf von zwanzig
bleiben stumm** — Football, Time-Trial, Spurt, Fechten, Tennis, Wettessen, Showcase, I-Spy,
Climbing, TDM, Mini-DM, Battlefield; von diesen haben vier (Football/Time-Trial/Spurt/Fechten) seit
PR 0.1 einen Katalogeintrag ohne jede Aufrufstelle. Der Rueckstand ist kleiner geworden, aber noch
immer der groesste gleichfoermige im Projekt.

### 3.2 Der Zufallswaffen-Bug ist seit dem 10.09. projektweit geschlossen
**Ueberholt:** dieser Abschnitt sagte bis zum 10.09., der Bug sei bei Showcase/Tennis/Wettessen/
I-Spy weiterhin offen. Nachgesehen im aktuellen Code: `DISZIPLIN_WAFFE` fuehrt heute alle vier mit
`null`, zusammen mit den fuenf Bahn-Disziplinen. Kein Kaempfer/Spieler traegt mehr eine
Zufallswaffe, die zu seiner Disziplin nicht passt — das hat allen vier Buehnen je 10 Assets-Punkte
gebracht (s. Tabelle oben). Eigene, disziplinrichtige Requisiten (statt nur "keine Waffe") gibt es
fuer diese vier weiterhin nicht — das bleibt offen und ist Aufgabe der `DISZIPLIN_PROP`-Tabelle
(PR 0.2, #889), sobald eine Ziel-PR ihnen eine eigene Requisite gibt.

### 3.3 Die 2–6-Spieler-Luecke ist im Code geschlossen, aber nicht nachgemessen
`pruefung-2-6-spieler-tauglichkeit-alle-disziplinen-08-09.md` fand, dass die Gegnerseite bei
**Bahn und Arena** strukturell auf die Katalogkonstante festgenagelt war. Nachgesehen: `gastGesetzt`
steht heute in **allen vier** Baufunktionen — Feldspiel (`:5470`), Buehne (`:10999`), Arena
(`:14113`) und Bahn (`:17880`). PR #864 hat den Befund also geschlossen. **Nicht verifiziert** ist,
ob damit auch die Feldgroessen-Wirkung selbst stimmt; deshalb steht bei Bahn/Arena 12 von 15
Punkten statt 15.

### 3.4 Zwei vorbestehende Zeichenfehler, die ALLE ZWANZIG betrafen — 14.09. behoben
**Neu in diesem Nachtrag.** Beide sind waehrend anderer Arbeiten aufgefallen, beide sind
**rho-bit-identisch** (bewiesen und gemessen), und beide bekommen deshalb **keine Punkte auf einer
Achse** — dieselbe Behandlung wie die Welle-0-Fundamente weiter oben. Sie stehen hier, weil sie
etwas ueber die **Belastbarkeit der Assets- und Movement-Spalten** sagen: diese Spalten sind aus
gelesenem Zeichencode eingestuft (s. Abschnitt 7 Punkt 1), und gelesener Zeichencode hat hier
zweimal etwas anderes getan, als er behauptet hat.

**(a) Der Sprite-Bildindex wurde negativ (PR #915).** Die Angriffsanimation rechnet an drei Stellen
`Math.floor((1 - u.lunge/0.2) * n)` und setzt damit voraus, dass `u.lunge` bei **0,2** startet. In
der Arena stimmt das; `stepBuehne()` und die Wurf-/Block-/Torwart-Pfade setzen aber **0,5** — der
Ausdruck wird negativ. `drawImage()` mit negativem Quell-x zeichnet dann nicht *nichts*, sondern
**beschneidet das Quellrechteck**: sichtbar blieb ein schmaler Streifen des vorherigen, falschen
Bildes. Nachgemessen an sichtbaren Alpha-Pixeln derselben Figur: Krag'Zul **1603 px bei `lunge`
0,19, 53 px bei 0,21**; Lava Golem 1848 → 283; Johanna (Baukasten-Figur) 1553 → 827. Behoben mit
`Math.max(0, …)` an allen drei Stellen. **Das betrifft Basketball-Wuerfe, Hockey-Blocks und die
Torwart-Pfade genauso wie Gewichtheben** — jede dieser Animationen zeigte in ihren ersten 0,3
Simulationssekunden einen angeschnittenen Frame und zeigt jetzt einen vollstaendigen.

**(b) `hoehenKorrektur()` hat sich selbst gemessen (PR #918).** Die Funktion soll die Streuung der
Sprite-Blaetter wegrechnen, damit die Bildschirmhoehe einer Figur nur noch an ihrer `groesse`
haengt. Ihr Messdurchlauf ruft `zeichneSprite()` auf — und `zeichneSprite()` rechnet in seiner
ersten Zeile `hoehenKorrektur()` fuer denselben Namen zurueck. Der Zwischenspeicher wurde erst
**nach** der Messung gefuellt, der Rueckruf fand also nichts vor und mass erneut: **1057 bis 2309
Ebenen tief**, bis der JS-Stapel ueberlief; den `RangeError` schluckte ein `try/catch` lautlos.
Beim Abwickeln misst jede Ebene das Bild der darunter — ein sauberer Zweierzyklus —, und
gespeichert wurde, was die aeusserste Ebene in der Hand hielt: **die Paritaet der zufaelligen
Ueberlauftiefe.** In etwa der Haelfte der Faelle landete 1,000 im Speicher, die Korrektur fand dann
**gar nicht statt**. Im Spiel sichtbar als: dieselbe Figur ist beim naechsten Seitenaufruf anders
gross (Xelara 51 / 45 / 51 px ueber drei Laeufe).

| | rho (`groesse` → Bildschirmhoehe) | Reststreuung max/min |
|---|---:|---:|
| wie die Formel es meint | **1,000** | **1,00** |
| Paritaetszweig A | 0,673 | 1,27 |
| Paritaetszweig B | 0,491 | 1,27 |

Behoben mit einer Zeile (eine 1 in den Zwischenspeicher legen, **bevor** gemessen wird): erster
Aufruf von ~1,1 s auf < 2 ms, Streuung der Kaderfiguren 1,39 → **1,21**, und drei Laeufe derselben
Montage sind jetzt zeichenweise identisch statt unterschiedlich. **Zwei Verdachtsmomente der
urspruenglichen Meldung haben sich dabei NICHT bestaetigt und stehen hier, damit sie nicht
weiterwandern:** der Deckel `HOEHEN_KORR_MAX=1.25` ist nicht schuld (`dh=64*Z` ist der Rahmen, nicht
der Inhalt — ein Vollbild-Blatt fuellt seine Zelle gar nicht aus, gemessen Krag'Zul 59 px bei Z=1),
und **es ist nicht vollbild-spezifisch**: die vier Figuren, die im Zufallsfall auf 1,000 standen,
sind alle vier Baukasten-Figuren.

**Eine Nachpruefung fuer Chris, aus der Review zu #918** (Merge-Commit `7a07de2f`): die Figuren mit
dem Groessen-Stellrad `b.skala` — **Bloater, Burster, Mushu** — werden durch den Fix jetzt
**zuverlaessig** korrigiert statt zufaellig. Bei Bloater ist die Statur-Anpassung vom 04.09.
(`bloater-modell-verbessert.md`, `bloater-vorher-nachher.png`) damals gegen ein Bild kalibriert
worden, das die Korrektur nur in etwa der Haelfte der Faelle angewandt hatte; sie wirkt jetzt
konsistent und sollte einmal angesehen werden.

**Was das fuer die Assets-Spalte heisst.** Keine Zeile oben bewegt sich — die A-Kriterien fragen
nach eigener Flaeche, eigener Szene, eigenen Requisiten und Ton, nicht nach Renderkonstanz. Aber
die Einstufungen dieser Spalte sind ab jetzt auf einem Bild gemacht, das **reproduzierbar** ist;
vorher war „wie gross ist diese Figur" eine Muenze. Die naechste echte Sichtprobe (Abschnitt 7
Punkt 1) misst damit etwas Stabiles.

### 3.5 Die N-Team-Infrastruktur ist paarweise, nicht generisch — 13.09., PR #911
Chris hat gefragt, ob zwei Teams nacheinander in zwei Disziplinen antreten koennen, ob die
Verteilung bei Vierer-Disziplinen wie Mini-DM klappt, und ob alles sauber angezeigt und im
Spieltagskalender erfasst ist. Das Audit
(`docs/design/n-team-disziplinen-infrastruktur-audit-13-09.md`) beantwortet alle vier mit Belegen:

| Chris' Frage | Antwort |
|---|---|
| 1v1 nacheinander in 2 Disziplinen, mit Punkten? | **Halb.** Hoechstens EINE kann ein echtes Duell sein, und in **41 % der Spieltage ist es KEINE.** |
| Verteilung bei 4er-Disziplinen wie Mini-DM? | **Nein — es gibt sie im Produktionscode gar nicht** (s. Mini-DM oben). |
| Alle N Teams sauber angezeigt? | **Gespalten.** Die Buehne ist bereits N-generisch, der Spielplan-Kalender zeigt strukturell genau EINEN Gegner. |
| Im Spieltagskalender korrekt erfasst? | **Fuer N=2 sauber, nachgemessen: null Doppelbuchungen.** Fuer N>2 gibt es kein Datenmodell. |

**Die 41 %** (gemessen mit dem echten `buildSeasonSeededDisciplineSchedule` ueber 400 Saves): sind
**beide** Disziplinen eines Spieltags arena-aufgeloest, faellt der **ganze** Spieltag still auf den
PPS-Pfad zurueck. Als diese Entscheidung getroffen wurde, waren zwei Disziplinen arena-aufgeloest
und der Fall traf ~0,5 % der Spieltage — **heute sind es dreizehn von zwanzig.** Das ist kein
Rechenfehler (die gebuchten PPS-Punkte sind in sich korrekt), sondern eine **stille
Nicht-Erfuellung** genau dessen, wonach Chris fragt, und liegt als Entscheidung auf seinem Tisch.

**Und ein echter Fehler, behoben:** der Arena-Einhaengepunkt fragte nach **Mengen-Zugehoerigkeit**
statt nach **Identitaet** mit der Disziplin, fuer die der Arena-Lauf gelaufen ist. Sind D1 und D2
beide arena-aufgeloest, traf die Bedingung fuer beide zu — derselbe eine Duellausgang waere zweimal
gebucht worden (2 + 2 = **4 Punkte** aus einem einzigen Duell). Erreichbar war das heute nicht (die
`mehrdeutig`-Wache steigt vorher aus), **aber die Wache steht in einer anderen Datei als die Regel,
die sie schuetzt** — und wer die 41 % angeht, MUSS sie lockern. Die Invariante steht jetzt lokal
dort, wo sie gilt (`arenaDisciplineId`, mit eigenem Test und bit-identischem Rueckfall).

**Keine Punktewirkung auf die Tabelle oben** — G2 misst, ob eine Disziplin in
`ARENA_RESOLVED_DISCIPLINE_IDS` steht, und daran aendert das Audit nichts.

---

## 4. Was ich beim Nachsehen gefunden habe und was in der Doku falsch steht

### 4.1 Staffel hat laengst eine Wertung — der genannte Blocker ist stale
`stand-aller-disziplinen.md` Abschnitt 4 und das PM-Briefing vom 09.09. (Prioritaet 2 Punkt 1 sowie
Empfehlung 2) sagen beide, `bahnTeamstand()` liefere fuer Staffel `gewertet:false`, es gebe „noch
keine Wertung", und Chris muesse erst entscheiden, was ein Staffel-Team-Sieg ist. Der Kommentar in
`battle-mode-arena-team-points.ts:160-167` sagt dasselbe.

**Das stimmt seit PR #827 nicht mehr.** `bahnTeamstand()` hat einen eigenen
`wertung==="etappe"`-Zweig (`:15794-15805`): das Rennen entscheidet der Zieleinlauf (1:0), die
Punkte je Laeufer sind der Rang der Etappenleistung, und `gewertet` ist true, sobald der erste
Laeufer im Ziel ist. Der Kommentar direkt darueber sagt es selbst: *„seit dem Prototyp betrifft das
keine der fuenf Bahnen mehr."* Alle fuenf Bahn-Disziplinen tragen heute einen echten
Wertungsmodus — `rang` (Spurt/Time-Trial/Climbing), `etappe` (Staffel), `burg` (Takeshi's Castle).

**Folge fuer den Plan:** die Bahn-Welle wartet **nicht** auf eine Entscheidung von Chris. Sie
wartet nur noch auf den `spieleBahn()`-Einstiegspunkt plus eine vierte Chassis-Menge im
`runArenaFixtures()`-Dispatch. Das ist reine Bauarbeit, und sie holt in einem Zug **vier**
Disziplinen mit rho 0,828–0,915 ins echte Spiel.

### 4.2 Die eingecheckte Basislinie ist an zwei Stellen stale — Stand 14.09.: an ACHT
Bestaetigt durch den Messlauf vom 10.09. (s. Abschnitt 1), und durch die Merge-Welle vom 13./14.09.
auf acht Zeilen ausgeweitet — die Tabelle dazu steht in Abschnitt 1. `node
scripts/baue-rangtreue-basislinie.mjs 24` gehoert in den naechsten Pflege-PR; solange sie nicht
gezogen ist, faengt die CI-Schranke nur noch Rueckgaenge gegen einen acht Tage alten Stand.

### 4.3 Die Spalte „Arena" fuehrte drei Bahn-Disziplinen falsch — 14.09. korrigiert
Staffel, Takeshi's Castle und Time-Trial standen in der Tabelle oben mit „nein", obwohl ihre
Gameplay-Zahlen die 30 G2-Punkte laengst enthielten (67→97 bzw. 62→92 am 10.09., jeweils mit
„Produktionsanschluss (G2 0→30)" begruendet). Bei Takeshi stand der Widerspruch sogar **innerhalb
derselben Zeile**: „seit PR #880 produktionsangeschlossen" direkt ueber „Noch nicht
produktionsangeschlossen (kein Eintrag in `ARENA_RESOLVED_DISCIPLINE_IDS`)". Nachgelesen im
aktuellen Code (`lib/resolve/battle-mode-arena-team-points.ts:236-253`): die Menge enthaelt heute
dreizehn Eintraege, darunter `staffel`, `takeshis-castle` und `time-trial`. **Climbing und Spurt
stehen dort bewusst NICHT** — Climbing, weil es die Rangtreue-Schranke nicht besteht, Spurt wegen
des Feldgroessen-Fundes F1 (`jeSeite` ist 4, nicht 6). Beide Spalten sind entsprechend korrigiert;
an den Prozentzahlen aendert sich dadurch nichts, weil sie die Menge schon richtig gelesen hatten.

---

## 5. Top-Prioritaeten — sortiert nach Hebel je Aufwand

> **Stand 14.09.: die Punkte 1, 3 und 10 sind erledigt** und bleiben nur als Historie stehen.
> Punkt 1 (Bahn-Chassis) ist mit PR #880 am 10.09. gebaut — drei der vier genannten Disziplinen
> sind angeschlossen, Spurt haengt am Feldgroessen-Fund F1 (s. 4.3). Punkt 3 (Zufallswaffen) ist
> seit dem 10.09. projektweit geschlossen (s. 3.2). Punkt 10 (Hockey vertonen) ist mit PR #893 am
> 12.09. erledigt. **Was dafuer neu auf diese Liste gehoert:** die eingefrorene Sprite-Animation
> der vier verbleibenden Bahnen (Spurt/Staffel/Climbing/Takeshi — PR #908 hat nur Time-Trial
> repariert, s. dort; ein umrissener Handgriff je step-Funktion), die Neuziehung der
> Rangtreue-Basislinie (4.2, acht stale Zeilen), und Chris' drei Entscheidungen aus dem
> N-Team-Audit (3.5) — allen voran die 41 % der Spieltage, an denen gar kein Duell laeuft.

1. **Bahn-Chassis bauen (`spieleBahn()`).** Vier Disziplinen auf einen Schlag: Staffel (0,915),
   Takeshi's Castle (0,883), Spurt (0,871), Time-Trial (0,828) — alle vier bestehen die Abnahme,
   alle vier haben eine echte Wertung, allen vier fehlt **nur** der Anschluss. Danach 14 von 20
   produktiv. **Und, neu in diesem Bericht: es ist keine Designfrage mehr vorgelagert** (4.1).
2. **Ton fuer die uebrigen neunzehn.** Der einzige Rueckstand, der jede Disziplin gleich hart
   trifft, und der einzige, bei dem eine einmal gebaute Abstraktion (`sfx(disziplin, name)` statt
   `bkSfx(name)`) sofort zwanzigfach zahlt. Kostet keine Rangtreue-Zeile.
3. **Zufallswaffen-Bug fuer Showcase/Tennis/Wettessen/I-Spy schliessen.** Drei davon sind LIVE.
   Fuenf Zeilen an `:2573-2575`, rho-neutral (bei Fechten/Eiskunstlauf/Breaking bit-identisch
   nachgemessen). Der billigste sichtbare Gewinn im ganzen Feld.
4. **Showcase und Wettessen ein eigenes Konzept geben.** Beide sind produktiv angeschlossen und
   haben ueberhaupt keine Identitaet — sie sind der Buehnen-Durchgangsrechner mit anderen Zahlen.
   Das ist die einzige Stelle, an der eine LIVE geschaltete Disziplin konzeptionell leer ist.
5. **Arena-Messbudget statt Arena-Commit.** TDM/Mini-DM/Battlefield haben die drei schlechtesten
   Zahlen — aber bei allen dreien ist die Kader-Spannweite groesser als der Median. n ≥ 96–150 ist
   die Voraussetzung, bevor irgendjemand die Zielwahl-Umstellung (K1) baut, sonst ist ihr Erfolg
   nicht nachweisbar. Bei den in diesem Bericht gemessenen ~34 s je Disziplin und n=24 waere
   n=150 rund 3,5 Minuten je Disziplin und Variante — machbar, aber zu planen.
6. **Fechtens Rezept kalibrieren.** Es steht LIVE auf einem im Code selbst als „nicht final"
   bezeichneten Entwurf, mit einem Puffer (0,016), der kleiner ist als sein Kaderrauschen (0,192).
   Von den zehn produktiven Disziplinen ist das die einzige mit einem echten Rangtreue-Risiko.
7. **Climbing.** 0,010 Fehlbetrag, aber nie eine eigene Runde gehabt und kein eigenes Dokument —
   die einzige Bahn ohne eigene Modellierung. Als eigene kleine Runde mit groesserem n sinnvoll.
8. **Football.** Der groesste Einzelrueckstand ausserhalb der Arena (0,516) und zugleich die
   Disziplin mit der besten Nicht-Rezept-Ausstattung im Feld. Drei Runden haben zusammen 0,17
   gebracht; was fehlt, ist eine echte Neukalibrierung mit vielen Freiheitsgraden — kein
   umrissener Bugfix.
9. **I-Spy.** Einzige Buehne unter der Schranke. Eine Rezeptrunde nach dem Tennis-Muster (Attribute
   an die Matrix-Proportionen nachziehen) waere der naheliegende erste Versuch.
10. **Basketball vertonen ist fertig — Hockey waere der naechste Kandidat**, weil es als einziges
    ausser Basketball eine eigene Flaeche und eigene Bewegungen hat und den Ton sofort tragen wuerde.

---

## 6. Wo es GAR KEIN eigenes Konzept gibt — die explizite Liste

**Zwei Disziplinen haben kein eigenes Konzept im Sinne des Auftrags** (kein Dokument, das sie von
Grund auf modelliert; keine Mechanik ueber den Chassis-Standard hinaus; nur andere Attributzahlen
im generischen Rezept):

| Disziplin | Was es gibt | Was fehlt | rho | live? |
|---|---|---|---:|:--:|
| **Showcase** | Sieben-Rollen-Standardrezept mit Charisma-Gewichten, sonst nichts | jedes Dokument, jedes Flag, jede eigene Regel, jede Kalibrierrunde | 0,892 | **ja** |
| **Wettessen** | Matrix-Rezept (will/health/stamina, kein Charisma) + eigene `wertungTabelle` | jedes Dokument, jede eigene Mechanik, jede Kalibrierrunde | 0,845 | **ja** |

**Drei weitere haben nur ein GETEILTES Konzeptdokument, kein eigenes** — das ist eine schwaechere,
aber eigene Kategorie:

| Disziplin | geteilte Quelle | Konsequenz |
|---|---|---|
| **Climbing** | `bahn-disziplinen-recherche-fable.md` Abschnitt 4 (Klettern) | echte Recherche vorhanden, aber nie in eine Umsetzungsrunde ueberfuehrt — die einzige Bahn ohne eigene Runde |
| **Speed-Schach** | `takeshi-schach-optik-gameplay-plan-05-09.md` Teil A + `arena-duell-recherche-fable.md` Abschnitt 4 | trotzdem die zweitbeste Rangtreue — hier ist das Fehlen folgenlos |
| **TDM** | `arena-duell-recherche-fable.md`, `arena-mini-dm-tdm-battlefield-rollout-plan.md` | ausdruecklich begruendet: vier eigene Rezepte gebaut, alle vier schlechter oder ununterscheidbar |

**Und eine Disziplin hat ein Konzept, das im Code selbst als unfertig markiert ist:**
**Fechten** — `BUEHNE_ART.fechten` (`:10934`): „ERSTER, AUSDRUECKLICH NICHT FINALER
Sieben-Rollen-Entwurf ... Startpunkt, kein fertiges Ergebnis." Sie ist trotzdem seit Welle 2 live.

---

## 7. Grenzen dieser Pruefung — ehrlich

1. **Keine Sicht-QA.** Es wurde kein Spieltag im Browser durchgeklickt und kein Screenshot
   gemacht. Alle Aussagen ueber Optik und Bewegung stammen aus gelesenem Zeichencode
   (`battle-mode.engine.js`, die zwanzig `*.tsx`-Feld-Dateien) — **„was der Code zeichnet", nicht
   „wie es aussieht".** Insbesondere die Assets- und Movement-Spalten wuerden sich durch eine
   Sichtprobe verschieben, in beide Richtungen. Die Rangtreue-Sonde selbst lief in dieser
   Umgebung problemlos (anders als in der 08.09.-Pruefung, wo Chromium beim Laden der
   Mockup-Seite abstuerzte) — der Headless-Messpfad ist stabil, der Sicht-Pfad ungeprueft.
   **Nachtrag 14.09.: dieser Punkt hat sich als der teuerste der ganzen Liste erwiesen.** Die
   Merge-Welle vom 13./14.09. hat in einer einzigen Nacht sechs Befunde gefunden, die aus
   gelesenem Zeichencode nicht sichtbar waren und erst ein Blick bzw. eine gezielte Sonde zutage
   gefoerdert hat: die konzentrischen Ellipsen der Staffelbahn, die auf `pos` statt auf die Zone
   gruppierten Wartenden, die nie gefeuert haben, die eingefrorene Sprite-Uhr aller fuenf Bahnen,
   der angeschnittene Bildindex aller zwanzig Disziplinen, die selbstrekursive Hoehenkorrektur und
   die Hantel, die fuenf von siebzehn Figuren gar nicht bekamen. **Jeder einzelne war aus dem
   Quelltext prinzipiell herleitbar und ist trotzdem monatelang niemandem aufgefallen.** Die
   Assets- und Movement-Spalten sind deshalb nach oben verzerrt, wo eine Disziplin nur an ihrem
   Zeichencode eingestuft wurde — nicht systematisch, aber unberechenbar.
2. **Die Animationszahl ist ein Proxy, kein Mass.** „Animationsstellen" ist die Trefferzahl von
   `anim|keyframes|transition` je Feld-Datei. Eine Datei mit 3 Treffern (Showcase, Eiskunstlauf,
   Takeshi) kann trotzdem gut aussehen; eine mit 22 (Fechten) kann flimmern. Die Zahl zeigt
   Investition, nicht Qualitaet.
3. **Die Prozentwerte sind eine Einstufung, keine Messung.** Nur die rho-Spalte ist gemessen.
   Die Rubrik in Abschnitt 0 macht die Einstufung nachpruefbar, aber die Gewichte darin sind
   gesetzt, nicht hergeleitet — eine andere Rubrik ergaebe andere Zahlen. Was sie nicht aendert,
   ist die REIHENFOLGE an den Enden: Basketball/Hockey oben, I-Spy/Showcase/Wettessen unten fallen
   in jeder plausiblen Gewichtung gleich aus.
4. **Kein Zugriff auf den Server** (CLAUDE.md). Alle Aussagen ueber Spielstaende stammen aus der
   Kaderfamilie, die am 03.09. aus dem `live-save`-Abbild gezogen wurde. Die Spiegel-Frische wurde
   fuer diesen Bericht nicht neu geprueft.
5. **Kein aktiver Save nutzt Battle Mode.** Unveraendert seit Welle 1: alle Saves im
   `live-save`-Abbild haben `scenarioMeta.gameMode` nicht gesetzt. Die gesamte
   Produktionsanschluss-Spalte (die 30 Gameplay-Punkte fuer zehn Disziplinen) ist damit **real,
   aber latent** — sie wirkt sich auf keinen von Chris' aktuellen Spielstaenden aus, bis ein NEUER
   Save mit Battle-Mode-Wahl angelegt wird.
6. **Der Torwart-Sonderfall.** Hockey ist die einzige Disziplin mit zwei Zahlen (0,669 alle zwoelf
   / 0,719 nur Feldspieler). Fuer die Tabelle oben ist die Zwoelferzahl verwendet, weil sie das
   reale Spiel misst — die Feldspielerzahl waere die freundlichere und ebenfalls vertretbare Wahl.
