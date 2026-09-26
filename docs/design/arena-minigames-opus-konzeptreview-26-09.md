# Arena-Minispiele (Mini-DM, TDM, Battlefield) — Opus-Konzeptreview 26.09.

**Auftrag (Chris, sinngemäß):** Nicht an Zahlen und Balance drehen — „balancing bringt noch nichts,
wenn die Konzepte nicht perfekt sind". Erst das Gameplay- und Taktik-Konzept der drei
Arena-Kampfdisziplinen prüfen. Reine Konzept- und Recherche-Runde, **kein Motor-Code, kein
Rezept, keine Konstante angefasst.** Gegen `origin/main` `6b471366` (26.09.) gelesen und gemessen.

Vorarbeit gelesen und vorausgesetzt: `arena-mini-dm-tdm-battlefield-rollout-plan.md` (vollständig,
inklusive Umsetzungsnotiz vom 22.09. zur Domination), `arena-duell-recherche-fable.md`,
`arena-zielwahl-umsetzung.md` (K1, zwei gescheiterte Varianten), `arena-tempo-schlagfrequenz.md`,
`mini-dm-4-team-ffa-recherche-06-09.md`, `mini-dm-spielplan-anchoring-befund-14-09.md`,
`battle-mode-gameplay-grundmodell.md`, `stand-aller-disziplinen.md` Abschnitt 1a/5/5a,
`kampf-archetyp-aufloesung-20-09.md`. Dazu der Motor selbst: `ARENA_ART`, `ARENA_DOMINATION`,
`kpTick`/`dominationSieger`, `baueEinheit`, `build`, `chooseTarget`, `treffer`/`nahschlag`,
`cdKuerzung`, `PERSZIEL`/`PERSDEF`/`leitePers`, `schlachtplan`, `beitragVon`,
`baueMiniDmFfaRunde`, `disziplinProbe` (alles in `public/mockups/battle-mode.engine.js`).

**Zahlen in diesem Dokument** sind entweder aus dem Code zitiert, aus den Vorgänger-Dokumenten
übernommen (mit Verweis) oder in dieser Runde selbst gemessen. Die eigenen Messungen laufen über
die vorhandenen Test-Schnittstellen (`window.__arena.disziplinProbe`, `serieVon`,
`spieleArenaDomination`) auf derselben Kader-Familie wie die offizielle Abnahme
(`data/generated/kaderfamilie-live-save.json`, fünf echte Paarungen, n = 24 je Paarung). Die
Auswertung ist eine reine Nachrechnung der zurückgegebenen Boxscores — Anhang A beschreibt sie so,
dass sie ohne Code-Archäologie wiederholbar ist.

---

## 0. Kernaussagen vorab

1. **Die Vermutung „zu chaotisch, zu zufallslastig" stimmt nicht — gemessen.** Im Arena-Kampf
   wird praktisch nicht gewürfelt (Nahkampf trifft immer, kein Krit, kein Parieren, Streuung = 0;
   Zufall kommt nur über Formkarte und Mutatoren je Spieltag). Und die Arena ist von Spiel zu
   Spiel **mindestens so verlässlich wie Basketball und Hockey**: Die Spiel-zu-Spiel-Rangtreue der
   Boxscores liegt bei 0,65 (Mini-DM), 0,50 (TDM) und 0,77 (Battlefield) — Basketball hat 0,64,
   Hockey 0,56.
2. **Das Problem ist die Validität, und die ist ein Konzeptproblem.** Die Arena belohnt
   zuverlässig etwas anderes als die Eignung: Im Einzelspiel erklärt der Eignungsrang nur **4 %**
   (Mini-DM), **9 %** (TDM) und **15 %** (Battlefield) der Rangvarianz. Die Persönlichkeit (aus
   Klasse, Rasse, Unterklasse und Traits abgeleitet) erklärt allein 5–10 %, die Frage „ist
   Heiler-Unterklasse" 5–11 %. In Mini-DM sagt die Persönlichkeit mehr über den Rang voraus als
   die Eignung.
3. **Die extreme Spannweite ist die Folge davon.** Je nach Kader laufen diese eignungsfremden
   Kanäle mal mit der Eignung und mal gegen sie. Die Validität je Paarung reicht von **−0,24 bis
   +0,89**. Ein richtiges Wort dafür ist „deterministisches Chaos": Das Ergebnis hängt an der
   Konstellation (wer als Heiler, als Draufgänger oder als Duellant auf welcher Reihe wem
   gegenübersteht), nicht am Würfel. Den Präzedenzfall hat das Projekt schon gemessen: Im
   Mini-DM-FFA gewannen vier byte-identische Kämpfer 50 % gegen 0 %, allein wegen der
   Array-Reihenfolge (`baueMiniDmFfaRunde`, Kommentar „Ecken-Lotterie").
4. **Das Format verstärkt das.** Alle drei Disziplinen sind heute **einmalige Eliminierung ohne
   Respawn**, und ein Kampf dauert typischerweise **18–40 Sekunden**. Wer zuerst fällt, sammelt
   nichts mehr. Die Überzahl danach wirkt nach Lanchester quadratisch (4 gegen 3 ist 16 zu 9). In
   der Overwatch-Profiliga gewinnt das Team mit dem ersten Kill 77 % der Teamfights. Das
   „Team Deathmatch" ist nach Genre-Definition keines: TDM heißt Respawn plus Kill-Limit.
5. **Die neue Battlefield-Domination entscheidet kein einziges Spiel.** In 120 von 120 gemessenen
   Battlefield-Spielen fiel die Entscheidung durch Eliminierung. In drei von fünf Paarungen wurde
   der Punkt nie erobert, weil der Kampf nach ~19 s vorbei ist. Ohne Respawn kann ein Objective
   konzeptionell nicht wirken — das ist kein Kalibrierfehler von `punkteZumSieg`.
6. **Star- und Paartreue sind auf Zufallsniveau.** Der eignungsbeste Teilnehmer steht in 21 %
   (Mini-DM), 12,5 % (TDM) und 4 % (Battlefield) der Spiele auf Rang 1. Reiner Zufall läge bei
   12,5 %, 8 % und 12,5 %. Paare mit mindestens 15 Punkten Eignungsabstand werden zu 58–84 %
   richtig geordnet — Hockey schafft 99 %.
7. **Ist rho > 0,80 hier das falsche Ziel? Nein — aber es wird in der falschen Reihenfolge und
   mit dem falschen Instrument gejagt.** Weil die Verlässlichkeit gut ist, ist 0,80 grundsätzlich
   erreichbar (dafür braucht es eine Validität von ≈ 0,95). Einen Sonderrabatt für „Shooter sind
   halt chaotisch" gibt es sachlich nicht, denn dieser Shooter ist nicht chaotisch. Falsch ist
   zweierlei. Erstens ein **rollenblinder Wertmaßstab** (`beitragVon` zählt Schaden, Heilung,
   Schild und K.o.-Anteile, nicht die Aufgabe der Rolle). Zweitens die Reihenfolge: Die letzten
   fünf Runden (vier TDM-Rezepte, zwei Zielwahl-Varianten, Tempo-Umkehr) haben an Reglern
   gedreht, obwohl die Ursache kategorial ist. Abschnitt 4 schlägt eine Stufen-Abnahme vor:
   Team-Ergebnis → Star und Paare → rho. Sie ersetzt rho nicht, sondern ordnet es ein.

---

## 1. Bestandsaufnahme: was heute tatsächlich gespielt wird

### 1.1 Der Spielablauf, wie der Motor ihn fährt

| Baustein | Stand im Code | Kommentar |
|---|---|---|
| Format | Zwei Seiten, **Eliminierung ohne Respawn**; Ende, wenn nur noch eine Seite lebt oder `t > 95` (`if(lebendeSeiten.size<=1\|\|t>95)finish()`) | Kein Wiedereinstieg, kein Rundensystem |
| Kopfzahl | TDM 6 gegen 6, Mini-DM 4 gegen 4, Battlefield 4 gegen 4 (`ARENA_ART.jeSeite`) | Battlefield ist thematisch groß, nicht numerisch (Rollout-Plan, Fund 3) |
| Dauer | **gemessen:** meist 18–40 s, Ausreißer 55–91 s bei ausgeglichenen oder zähen Paarungen (`serieVon`, `spieleArenaDomination`) | Sudden Death ab t = 50, Offensivzwang nach 4,5 s ohne Ziel |
| Zufall im Kampf | **praktisch keiner.** `nahschlag`: kein Parier-Wurf, `crit=false`. Fernkampf: `streu=0`. Die Zielwahl ist laut Kommentar „keine Würfe, kein Zufall". | Zufall kommt nur über Formkarte (0/2/4/8) und Mutatoren (±6) je Spieltag. Beides verschiebt die Eignung um ≈ 2,8 Punkte Standardabweichung. |
| Einheit | Kampfwerte = Rezeptform × Eignungsmenge (`aufEignung`); in echten Kadern trägt **jeder denselben Skill-Satz** (`mitKit` → `MATRIARCH`, „solange die echten Klassensätze fehlen") | Kein Waffen- oder Fähigkeitsunterschied zwischen Spielern, außer dass die Heiler-Unterklasse heilt |
| Charakter | Persönlichkeit aus Klasse, Rasse, Unterklassen und Traits (`leitePers`). Sie bestimmt Haltung (Rückzug ab welcher LP), Zusammenhalt (Leine), Bindung (Ziel-Neubewertung 0,35–2,75 s) und Zielneigung (`PERSZIEL`: nächster/speer/bedrohung/hinten/schild/schwach) | Kategorial, **eignungsunabhängig** |
| Heiler | Unterklasse Cleric/Healer/Shaman/Druid → `heiler:true`, heilt statt zu schlagen, steht nach Regel hinter der Gruppe | Kategorial, eignungsunabhängig |
| Kampfschaden | `treffer`: `roh·sd·100/(100+VER)`; Rückstoß, Schild, Trennschlag beim Lösen | Formal sauber (Fables Befund) |
| Wertung je Spieler | `beitragVon = dmg + heal + schild + 0,4·verh + 140·koAnteil` | **Rollenblind:** zählt, was jemand selbst angerichtet hat, nicht was seine Rolle leisten soll |
| Battlefield-Objective | Ein Kontrollpunkt in der Mitte, Radius 230, Eroberung 5 s, 6 P/s, Sieg bei 150 P; Siege Core erobert 1,6-fach (`ARENA_DOMINATION`) | **Gemessen: entscheidet 0 von 120 Spielen** (Abschnitt 2.4) |
| Mini-DM-Format | Chris' Entscheidung vom 06.09. und 14.09.: **4 Teams, je 1 Spieler, 4 Runden je Rolle, Liga 2-1-0-0**. Gebaut (`baueMiniDmFfaRunde`/`spieleMiniDmFfaEvent`), aber nicht im Spielplan | Die offizielle Rangtreue-Sonde misst Mini-DM weiter als **4 gegen 4**, also ein Format, das laut Entscheidung gar nicht gespielt wird |

### 1.2 Die taktischen Hebel des Managers

Hier ist die Arena **reicher als jede andere Disziplin**:

- **Aufstellung:** Slot → Reihe 0/1/2 und Standard-Ordnung (`mitlinie`/`flanke`/`decken`/`verfolgen`).
- **Je Kämpfer:** Zielpriorität übersteuern (sieben Optionen), drei Takt-Regler (Haltung,
  Zusammenhalt, Bindung).
- **Live:** Zielansage/Fokusfeuer (PR #691, 7 s Sperre, bewusst als „Bias, keine Sperre" gebaut).
- **KI-Gegner:** ein Schlachtplan („Kopf abschlagen", „Heiler zuerst", „Lohnendste zuerst" mit
  Fels-Bindung), berechnet aus derselben Vorschau, die der Spieler sieht. (Nebenbefund, nicht
  weiter geprüft: `gegnerVorschau()` liest fest die **TDM**-Aufstellung, `inDisc("tdm")`, auch
  wenn Mini-DM oder Battlefield läuft.)

### 1.3 Ehrliche Einschätzung der taktischen Substanz

**Der Werkzeugkasten ist reich, die Spielstruktur ist arm.** Es gibt viele Mikro-Entscheidungen
(jede Einheit wählt alle 0,35–2,75 s neu ein Ziel), aber fast keine *bedeutungsvollen*
Entscheidungspunkte. Echte Team-Shooter ziehen ihre taktische Tiefe aus vier Dingen, die hier
alle fehlen:

1. **Wiederholung** — Runden (Counter-Strike) oder Respawn-Wellen (TDM, Overwatch, Battlefield).
   Eine schlechte Anfangskonstellation ist dort ein verlorener Fight, nicht ein verlorenes Spiel.
2. **Ein Objective, das Kämpfe erzwingt und Positionen wertet** — Map Control, Spawns, Flaggen,
   Ticket-Bleed. Die Domination ist der Anfang, wirkt aber wegen fehlendem Respawn nicht.
3. **Rollen mit eigener Aufgabe, gemessen an dieser Aufgabe** — Entry, Trade, Support, Anchor,
   IGL. Die Slot-Texte versprechen das („führt große Situationen", „liest Lücken", „hält Linien
   zusammen"). Mechanisch schlagen aber alle mit demselben Kit auf das nächste passende Ziel, und
   bewertet wird bei allen der eigene Schaden.
4. **Tempo-Entscheidungen** — wann pushen, wann auf den Respawn warten, wann traden. In einem
   20-Sekunden-Eliminationslauf gibt es davon genau eine: den Erstkontakt.

---

## 2. Diagnose: chaotisch, oder zuverlässig das Falsche belohnt?

### 2.1 Die entscheidende Messung — Verlässlichkeit und Validität getrennt

CLAUDE.md zerlegt die Einzelspiel-Rangtreue in `rho(Spiel) ≈ rho(Saison) × √Verlässlichkeit`.
Genau diese Zerlegung beantwortet die Frage des Auftrags. Ist die Arena zu chaotisch, muss die
**Verlässlichkeit** niedrig sein. Belohnt sie das Falsche, muss die **Validität** niedrig sein.

Gemessen (Median über die fünf Paarungen, n = 24 je Paarung). „Verlässlichkeit" ist hier die
mittlere Spearman-Korrelation der Boxscore-Werte zwischen je zwei Spielen derselben Paarung,
also „sagt ein Spiel das nächste voraus?". „Validität" ist rho(Eignung, Wert) über die
24-Spiele-Mittel:

| Disziplin | rho je Spiel | Verlässlichkeit (Spiel zu Spiel) | Validität (Saison) | SD von rho über die Saaten | Validität je Paarung (min … max) |
|---|---:|---:|---:|---:|---|
| **Mini-DM** | 0,394 | **0,647** | **0,500** | 0,208 | −0,214 … 0,714 |
| **TDM** | 0,248 | **0,502** | **0,273** | 0,247 | −0,084 … 0,888 |
| **Battlefield** | 0,392 | **0,770** | **0,524** | 0,177 | −0,238 … 0,762 |
| Basketball (Vergleich) | 0,769 | 0,640 | 0,923 | 0,107 | 0,762 … 0,986 |
| Hockey (Vergleich) | 0,731 | 0,563 | 0,964 | 0,189 | 0,806 … 0,988 |

(Die rho-je-Spiel-Mediane weichen leicht von `rangtreue-basislinie.json` ab — 0,371/0,166/0,356.
Das liegt innerhalb der dort geführten Spannweiten, die Basislinie ist älter.)

**Lesart.** Die Verlässlichkeit der Arena ist **nicht schlechter**, bei Battlefield sogar deutlich
besser als bei den beiden Feldspiel-Disziplinen, die als „knapp" gelten. Auch die Streuung von rho
über die Saaten ist bei Hockey genauso groß (0,19). Die Arena verliert **ausschließlich in der
Validität**: 0,27–0,52 gegen 0,92–0,96. Die Formel trägt auch hier ungefähr
(Mini-DM: 0,500 × √0,647 = 0,40, gemessen 0,394).

**Damit ist die Hypothese „zu viele unabhängige Zufallsereignisse ohne Spielerkontrolle"
widerlegt.** Die Arena ist ein reproduzierbarer, fast würfelfreier Automat. Er belohnt nur bei
jedem Kader etwas anderes.

### 2.2 Was die Arena stattdessen belohnt — die eignungsfremden Kanäle

Gepoolt über alle Spiele und Paarungen: Anteil der Rangvarianz im Einzelspiel (Rang als
Quantil, 1 = bester), der sich durch den jeweiligen Kanal erklären lässt.

| | Mini-DM | TDM | Battlefield |
|---|---:|---:|---:|
| Eignungsrang (R²) | **0,040** | **0,091** | **0,148** |
| Persönlichkeit (η²) | 0,103 | 0,053 | 0,046 |
| Persönlichkeit auf dem Rest nach Eignung (η²) | 0,119 | 0,071 | 0,063 |
| Heiler-Unterklasse ja/nein (η²) | 0,114 | 0,055 | 0,076 |
| Seitenzugehörigkeit (η², je Spiel) | 0,101 | 0,104 | 0,162 |

Einzelne Befunde dazu:

- **Heiler landen strukturell hinten:** mittleres Rangquantil 0,21 (Mini-DM), 0,34 (TDM) und
  0,30 (Battlefield), Nicht-Heiler liegen bei 0,53–0,54. Heilung zählt in `beitragVon` zwar 1 : 1,
  ein Heiler erzeugt aber weniger davon, als ein Schläger Schaden erzeugt. Ob ein Spieler dieses
  Handicap trägt, entscheidet seine Unterklasse, nicht seine Eignung.
- **Die Persönlichkeit ist ein Leistungsfaktor, kein Stil:** In Mini-DM kommt der Duellant im
  Mittel auf Quantil 0,28, der Draufgänger auf 0,61. Mechanisch naheliegend ist die Haltung: Wer
  „defensiv" oder „vorsichtig" ist, löst sich früh und sammelt in der Zeit nichts.
- **Kampf-Archetypen spreizen extrem:** In der TDM-Paarung vigilante-armageddon liegt der
  Blackguard im Mittel auf Rang 1,85 von 12, Cleric auf 10,98 und Fighter auf 10,35.
- **Die Reihe wirkt je Kader verschieden:** In TDM goldengladiators steht Reihe 2 im Mittel auf
  Rang 9,3 von 12, in Mini-DM piratecrew auf Rang 1,46 von 8. Es kommt darauf an, *wer* dort
  steht, nicht darauf, dass dort jemand steht.
- **Das Team ist NICHT die Hauptursache.** Die Seitenzugehörigkeit erklärt nur 10–16 %, und rho
  *innerhalb* eines Teams ist nicht besser als über beide Teams (Mini-DM 0,28, TDM 0,20,
  Battlefield 0,23). Der naheliegende Einwand „im Teamspiel hängt der Einzelwert am Teamsieg"
  trifft hier also zu, erklärt aber die schlechten Zahlen nicht.

Alles zusammen (Persönlichkeit, Heiler, Reihe, Seite) sind **kategoriale, eignungsfremde
Größen**, die das Ergebnis zuverlässig prägen. Bei einer Paarung korrelieren sie zufällig positiv
mit der Eignung (Battlefield goldengladiators: Validität 0,76, rho je Spiel 0,76), bei einer
anderen negativ (Battlefield mortalsin: −0,24). Genau daraus entsteht die Spannweite von über 1,0
in der Saisonzahl (`rangtreue-basislinie.json`: Mini-DM 1,262, Battlefield 1,333).

### 2.3 Das Team-Ergebnis — deterministisch, aber nicht eignungstreu

`serieVon` je Paarung (24 Kämpfe, mit Mutatoren-Ziehung):

| Disziplin | Paarung | Eignung Heim / Gast (Mittel) | Heim-Siegquote |
|---|---|---|---:|
| Mini-DM | vigilante-armageddon | 70,9 / 52,7 | 92 % |
| Mini-DM | goldengladiators-silversoldiers | 57,4 / 69,7 | 4 % |
| Mini-DM | **piratecrew-raginglunatics** | **45,6 / 63,1** | **71 %** |
| TDM | vigilante-armageddon | 65,5 / 53,9 | 100 % |
| TDM | coldsteel-direlegion | 54,4 / 53,6 | 25 % |
| Battlefield | goldengladiators-silversoldiers | 63,4 / 38,1 | 100 % |
| Battlefield | **piratecrew-raginglunatics** | **40,2 / 47,7** | **100 %** |

Die Siegquoten liegen meist bei 0 oder 100 % — ein und dieselbe Paarung spielt sich fast immer
gleich. Das passt zu Chris' Vorgabe aus `battle-mode-gameplay-grundmodell.md` („ein stark
überlegenes Team soll ~95 % gewinnen"). Aber in zwei von fünf Paarungen gewinnt **das deutlich
schwächere Team** fast immer. Das ist dieselbe Diagnose auf Teamebene: Nicht der Würfel
entscheidet, sondern die Konstellation.

**Heim/Gast-Tauschtest:** Dieselben fünf Paarungen, einmal mit getauschten Seiten (je 24 Kämpfe).
Bei symmetrischem Aufbau müsste die Heim-Siegquote über „normal + getauscht" bei ≈ 50 % liegen.
Gemessen: **Mini-DM 67 %, TDM 59 %, Battlefield 80 %.**

- TDM coldsteel (Eignung praktisch gleich, 54,4 zu 53,6): Heim gewinnt 25 %, nach dem Tausch
  (54,3 zu 53,8) 100 %.
- Battlefield piratecrew: Heim gewinnt als schwächeres Team (40,2 zu 47,7) 100 % und nach dem
  Tausch als stärkeres (51,6 zu 34,4) 92 %. **Wer Heim ist, gewinnt.**

Die Ursache liegt im Aufbau von `build()`: Heim stellt über `ersatz` die eignungsbesten n auf und
setzt sie nach der Slot-Reihenfolge auf die Reihen. Gast nimmt ohne gesetzte Aufstellung
`OPP.slice(0,n)` und verteilt nach Array-Index auf die Reihen. Beim Tausch ändert sich deshalb
sogar, *welche* Spieler eines Teams antreten (Battlefield vigilante: 59,0 als Heim, 53,0 als
Gast). Zweierlei folgt daraus:

1. Die Aufstellung ist ein **echter und starker taktischer Hebel** — gut so, das ist
   Manager-Taktik.
2. Die Mess-Sonde vergleicht strukturell zwei verschieden aufgestellte Seiten. Das ist ein
   **Messbefund** (P0 unten), kein Gameplay-Befund. Im echten Spiel stellen beide Manager auf.

Über alle 23 Fälle mit mindestens 5 Punkten Eignungsabstand gewinnt das stärkere Team **nur in 11
Fällen zu ≥ 90 %** (Mini-DM 6 von 10, TDM 1 von 4, Battlefield 4 von 9).

### 2.4 Battlefield-Domination: gebaut, aber strukturell wirkungslos

`spieleArenaDomination("battlefield", …)`, je Paarung 24 Spiele:

| Paarung | Entschieden durch Eliminierung | durch Punktelimit | durch Zeit | mittlere Dauer | Punkt nie erobert |
|---|---:|---:|---:|---:|---:|
| vigilante-armageddon | 24 | 0 | 0 | 20,3 s | 24 von 24 |
| coldsteel-direlegion | 24 | 0 | 0 | 38,6 s | 0 |
| goldengladiators-silversoldiers | 24 | 0 | 0 | 18,3 s | 24 von 24 |
| mortalsin-natureswrath | 24 | 0 | 0 | 91,0 s | 0 |
| piratecrew-raginglunatics | 24 | 0 | 0 | 19,6 s | 24 von 24 |

Das deckt sich mit dem, was die Umsetzungsnotiz vom 22.09. selbst beobachtet hat (rho vor und
nach der Domination unverändert 0,392). **Das ist kein Tuning-Problem von `punkteZumSieg` oder
`kapZeit`.** In einem Format, in dem ein Kampf in ~20 s durch Eliminierung endet und niemand
zurückkommt, ist jede Punktwertung nur ein Nebenzähler. Echte Domination- und Conquest-Modi
funktionieren, **weil** es Respawns gibt: Der Punkt ist das, worum man nach jedem Tod wieder
kämpft (Battlefield: Flaggen sind zugleich Spawnpunkte, Ticket-Bleed schlägt Kills).

### 2.5 Warum die bisherigen Zahlen-Runden scheitern mussten

Das ist die Diagnose, die Chris' Anweisung „erst Konzept, dann Balance" stützt, und sie lässt sich
an der Historie ablesen:

| Runde | Hebel (Regler) | Ergebnis |
|---|---|---|
| TDM-Rezept, vier Neubauten | Gewichte | alle schlechter oder ununterscheidbar (`ARENA_ART.tdm`-Kommentar) |
| K1 Variante 1 und 2 (`arena-zielwahl-umsetzung.md`) | Zielwahl nach Bedrohung | TDM ±0, Mini-DM −0,26 bis −0,31, Battlefield −0,04 bis +0,03 |
| Tempo koppelt Schlagfrequenz (`arena-tempo-schlagfrequenz.md`) | `cdKuerzung` | TDM +0,14, Mini-DM −0,18, Battlefield +0,06 |
| Domination (22.09.) | neuer Sieg-Weg | rho unverändert (0,392 vor und nach) |

**Jeder Regler bewegt die drei Disziplinen in verschiedene Richtungen** — das typische Bild, wenn
man eine kontinuierliche Stellschraube an eine kategoriale Ursache hält. Eine andere Zielwahl
ordnet dieselbe deterministische Kaskade nur anders an. Die Frage, ob der Heiler, der Vorsichtige
oder die Reihe 2 zufällig die Starken sind, bleibt davon unberührt.

### 2.6 Die Hypothese des Auftrags, präzisiert

> *„Die extreme rho-Varianz könnte Symptom eines strukturell zu chaotischen, zufallslastigen
> Spielkonzepts sein."*

**Halb richtig.** Es IST ein Konzeptproblem und kein Kalibrierungsproblem — das bestätigt diese
Runde klar. Aber die Ursache ist **nicht zu viel Zufall, sondern zu viel eignungsfremde
Determinierung**:

1. **Kategoriale Kanäle bestimmen die Menge statt nur den Stil.** Persönlichkeit, Heiler-Unterklasse
   und Reihe entscheiden, *wie viel* jemand beiträgt — nicht nur, *wie* er es tut.
2. **Ein Einmal-Eliminationsformat hebelt die Anfangskonstellation über das ganze Spiel.** Wer
   durch Geometrie zuerst fällt, ist raus. Die Überzahl wächst quadratisch, der Kampf ist nach
   20 s vorbei.
3. **Ein rollenblinder Wertmaßstab.** Er misst, wer vorne am meisten Schaden gemacht hat — also
   genau das, was die kategorialen Kanäle steuern.

---

## 3. Referenz: wie echte Team-Shooter Taktik und Einzelleistung zusammenbringen

| Spiel/Modell | Struktur | Lehre für uns |
|---|---|---|
| **Klassisches TDM** (Halo Slayer, CoD) | Respawn nach kurzer Wartezeit, Sieg über Kill-Limit oder Zeit; **Map Control** heißt Spawns und Power-Weapons kontrollieren | Ein Tod kostet **Zeit**, nicht die Teilnahme. Unser „TDM" ist genretechnisch ein Eliminationsmodus (Clan Arena, CS-Runde) — der Name verspricht etwas anderes. |
| **Counter-Strike** | Eliminierung *pro Runde*, aber 24 Runden je Karte mit Seitenwechsel. Rollen: Entry, Support/Trade, AWP, Lurker, IGL | Eliminierung funktioniert als **Runde**, nicht als ganzes Spiel. Einzelleistung wird mit HLTV 2.0 über KAST (Kill, Assist, Überleben, Trade) gemessen — ausdrücklich, um Spieler mit weniger spektakulärem Beitrag nicht zu unterschätzen. |
| **Overwatch** | Rollen Tank/Damage/Support; Wechsel auf 5 gegen 5 ausdrücklich für mehr **individuelle Wirkung** und lesbarere Teamfights. 77 % der Teamfights gewinnt, wer den ersten Kill macht (Winston's Lab, 11.596 Fights) | Der Schneeball nach dem ersten Kill ist real. Das Spiel fängt ihn über **viele Teamfights je Map plus Respawn** auf, nicht über weniger Kampf. |
| **Battlefield Conquest** | Tickets = Respawns; Flaggen = Spawnpunkte; Ticket-Bleed durch Flaggenmehrheit schlägt Kills; Medics beleben wieder | Das Objective wirkt nur, weil nach jedem Tod wieder um es gekämpft wird. Support-Rollen (Revive) sind *Ticket*-Arbeit, keine *Schaden*-Arbeit. |
| **Lanchester, quadratisches Gesetz** | Kampfkraft ∝ N², 2 : 1 Überzahl = vierfache Wirkung | Im Eliminationsformat ohne Respawn ist der **erste Ausfall** der größte Einzelhebel — und bei uns hängt er an Geometrie und Persönlichkeit. |
| **TrueSkill / TrueSkill 2** (Halo, Gears) | Einzelskill aus Teamergebnissen; TS2 nimmt Einzelscores nur als Gewichtung dazu | Selbst die Referenz in Sachen Einzelbewertung im Teamspiel zieht das Signal aus dem **Teamergebnis** plus dem **rollenrichtigen Einzelscore**, nicht aus einem nackten Schadensrang. |

**Die Lehre in drei Sätzen:** Team-Shooter trennen den *Kampf* (hochvarianzig, schnell) vom
*Spiel* (viele Kämpfe, Respawn oder Runden, Objective). Rollen haben eigene Aufgaben, und die
Einzelwertung misst die Aufgabe. Die Taktik steckt in wenigen, großen Entscheidungen
(Aufstellung, Push-Timing, Fokus, Objective), nicht in vielen kleinen Zielwechseln.

---

## 4. Ist rho > 0,80 für diesen Spieltyp das richtige Maß?

### 4.1 Was dafür spricht, die Schranke NICHT zu senken

- **Chris' Grundsatz gilt auch hier.** „Wenn ich einen Spieler mit einer Stat von 80 reinschicke,
  erwarte ich auch, dass da einer der Top-Leute ist" (CLAUDE.md, Matrix-Sperre). Ein Arena-Sonderweg,
  bei dem die Einzelrangtreue nicht mehr zählt, bräche diese Entscheidung.
- **Die Schranke ist hier erreichbar.** Das stärkste Argument gegen einen Rabatt: Die
  Verlässlichkeit ist gut (0,50–0,77). Bei Validität 0,95 ergäbe `0,95 × √0,70 ≈ 0,80`. Die
  Arena fällt nicht durch, weil Kampf von Natur aus chaotisch wäre, sondern weil sie das Falsche
  belohnt. Einen Rabatt für „chaotisch" gibt es nur, wenn die Verlässlichkeit die Grenze setzt —
  das tut sie hier nicht.
- **Chris will ausdrücklich weniger Varianz als der reale Sport** (Grundmodell-Dokument: 95 %
  Siegquote für klar Überlegene, der Star meist oben). Das Genre-Argument „echte Shooter streuen
  eben" hat er bereits verworfen.

### 4.2 Was am heutigen Messen tatsächlich falsch ist

1. **Rollenblinder Wert.** Die Sonde ordnet nach `beitragVon`. In einem Spiel mit Heiler-, Anker-
   und Kommandeursrollen misst das bei diesen Rollen etwas anderes als ihre Leistung. HLTV hat
   genau deshalb von Rating 1.0 auf 2.0 (KAST) umgestellt.
2. **Mini-DM wird im falschen Format gemessen.** Chris hat Mini-DM zweimal als 4-Team-FFA mit je
   einem Spieler entschieden. Die Abnahmezahl stammt aber aus dem 4-gegen-4. Welche Zahl gilt,
   muss geklärt werden, bevor jemand Mini-DM weiter „repariert".
3. **Die Zahl allein erklärt nicht, was schiefgeht.** rho je Spiel sagt „0,25", aber nicht, dass
   Eignung 9 % und Persönlichkeit 7 % der Varianz tragen. Für die Arena gehört die Zerlegung
   (Verlässlichkeit, Validität, eignungsfremde Kanäle) in jeden Bericht.

### 4.3 Vorschlag: Stufen-Abnahme für die drei Arena-Disziplinen

Rho > 0,80 bleibt die **letzte** Stufe, nicht die einzige. Die Stufen davor sind die „ehrlichere
Abnahme" aus CLAUDE.md, auf den Teamkampf zugeschnitten:

| Stufe | Frage | Vorschlag Zielwert | Heute |
|---|---|---|---|
| **A1 Team-Ergebnistreue** | Gewinnt das eignungsstärkere Team (Mittel, Abstand ≥ 5)? | ≥ 90 % (Chris' eigener Rahmen: ~95 %) | 11 von 23 Fällen (Abschnitt 2.3, inklusive Tauschtest) |
| **A2 Star- und Paartreue** | Steht der Eignungsbeste in den Top 2? Werden Paare mit ≥ 15 Punkten Abstand richtig geordnet? | Star Top 2 ≥ 75 % (Hockey 78 %), Paare ≥ 95 % (Hockey 99 %) | Star Top 2: 25 / 21 / 25 %; Paare 58–84 % |
| **A3 Kanaltreue** (neu, Arena-spezifisch) | Tragen eignungsfremde Kanäle weniger als die Eignung? | η²(Persönlichkeit), η²(Heiler), η²(Reihe) jeweils deutlich unter R²(Eignung) | Mini-DM: Persönlichkeit 0,10 > Eignung 0,04 |
| **A4 Rangtreue** | rho je Spiel, Median über die Kader-Familie, auf einem **rollenrichtigen** Wert | > 0,80 (unverändert) | 0,25–0,39 |
| **Pp-Pflicht** | Pp-Abweichung ≤ 25 (CLAUDE.md, Pflicht für jede Mechanik) | unverändert | — |

**Antwort auf die Auftragsfrage:** „Team-Koordination statt Einzelspieler-Rangtreue" wäre als
*Ersatz* falsch, weil es Chris' Matrix-Entscheidung aushebelt. Als *vorgeschaltete Stufe* ist es
richtig. Ein Kampfsystem, in dem das stärkere Team nicht einmal zuverlässig gewinnt (A1), braucht
man an der Einzelrangtreue (A4) noch nicht zu vermessen. A1 bis A3 zeigen außerdem, *woran* es
liegt — rho allein zeigt nur, *dass* etwas nicht stimmt.

---

## 5. Gameplay-Vorschläge, priorisiert

Alle Vorschläge sind **Konzeptänderungen, keine Zahlen**. Jeder ist mit der Messung verbunden, die
zeigen würde, ob er wirkt. Keiner ist gebaut.

### P0 — Voraussetzungen (keine Gameplay-Änderung, erst messen, was wirklich gespielt wird)

- **Mini-DM im entschiedenen FFA-Format messen** (4 Runden, je Rolle 4 Solo-Kämpfer) statt im
  4-gegen-4. Sonst optimiert jede künftige Runde ein Format, das nicht gespielt wird.
- **Die Stufen A1–A3 als Diagnose-Ausgabe** neben der bestehenden rho-Tabelle, für die drei
  Arena-Disziplinen. Das ist Messwerkzeug, keine Mechanik.
- **Aufstellungssymmetrie der Sonde herstellen:** Heim wählt über `ersatz` die eignungsbesten n
  und setzt sie auf die Slots. Gast nimmt ohne Aufstellung `OPP.slice(0,n)` und verteilt nach
  Index auf die Reihen. Gemessen ergibt das einen Heimvorteil von 59–80 % (Tauschtest, 2.3). Die
  Sonde sollte beide Seiten nach derselben Regel aufstellen, sonst misst jede Arena-Zahl zur
  Hälfte die Asymmetrie des Messaufbaus. Ob der echte App-Pfad (`arena-kader-adapter.ts`, beide
  Aufstellungen gesetzt) davon betroffen ist, habe ich nicht geprüft.

### P1 — „Eignung bestimmt die Menge, Charakter bestimmt den Stil" (größter Hebel auf die Validität)

Die kategorialen Kanäle bleiben — sie sind die sichtbare Vielfalt, die Chris am 13.09. verlangt
hat („PERSZIEL"-Kommentar). Sie dürfen aber nicht mehr bestimmen, **wie viel** jemand beiträgt,
nur **auf welchem Weg**. Das ist die Mehrwege-Leitlinie aus CLAUDE.md (21.09.), auf die Arena
angewandt:

- **Persönlichkeit als Weg, nicht als Rabatt.** Ein „Vorsichtiger", der sich bei halber LP löst,
  wechselt dabei in eine andere, gleichwertig gezählte Aufgabe: Rücken decken, Nachbarn schützen,
  Linie halten. Er macht keine Pause. Draufgänger, Duellant und Schleicher haben dann je einen
  Primärweg — Spitze brechen, Bedrohung binden, hintere Reihe —, und jeder Weg zahlt, wenn er
  gelingt, im Verhältnis zur **Eignung**.
- **Heiler-Unterklasse als gleichwertige Rolle.** Heilung und verhinderter Schaden sind für
  diesen Spieler der Primärweg und werden so gezählt, dass ein eignungsstarker Heiler mit einem
  eignungsstarken Schläger gleichzieht. Heute: Quantil 0,21–0,34 gegen 0,53.
- **Messung:** A3 (η² der Kanäle fällt deutlich unter R² der Eignung), danach A2.

### P2 — Rollen bekommen einen Job, die Wertung misst den Job (Rollen-Wertung statt Schadensrang)

Die Slot-Texte versprechen längst Rollen. Konzeptvorschlag, angelehnt an KAST und TF2/Overwatch:

| Rollentyp | Slots | Job | gezählt als |
|---|---|---|---|
| Front/Anker | Vanguard, Hold Line, Frontliner, Iron Guard | Raum halten, Druck binden | Zeit an der Front, abgefangener Schaden, Gegner gebunden |
| Vollstrecker | Breaker, Skirmisher, Finisher, Trick Fighter, Siege Core | Lücken reißen, abschließen | Schaden, K.o.-Anteile, **Trades** (Rache innerhalb weniger Sekunden) |
| Führung | Shotcaller, Commander | andere besser machen | Anteil am Teamerfolg auf dem angesagten Ziel (Assist-Logik), Befehlsaura |
| Stütze | Rally Point, Morale Anchor | das Team zusammenhalten | gerettete LP, verhinderte Rückzüge und Ausfälle bei Nachbarn |
| Aufklärung | Spotter | Ziele lesbar machen | Treffer der eigenen Leute auf markierte Ziele |

Wichtig für die Matrix-Sperre: **Wie gut** jemand seinen Job macht, kommt aus seinen
Matrix-Attributen — die Matrix wird nicht angefasst. Genau so bekommen Charisma, Intelligence und
Spirit in Battlefield zum ersten Mal einen *eigenen* Kanal. Heute speisen sie ersatzweise ANG, TMP
und AUS („ein Befehl richtet mehr aus als ein Schlag" ist ein Stellvertreter, keine Mechanik).
Die Pp-Budget-Abnahme bleibt Pflicht und kann diesen Kanal direkt prüfen.

**Messung:** A4 auf dem Rollen-Wert, dazu Pp-Abweichung ≤ 25.

### P3 — Format: weg vom Einmal-Eliminationslauf (TDM und Battlefield), Mini-DM bleibt Eliminierung

- **TDM wird ein echtes TDM:** Respawn nach kurzer Wartezeit am eigenen Rand, Sieg über
  Kill-Limit oder Zeit. Folgen:
  - Ein Tod kostet Zeit, nicht die restliche Partie. Der Schneeball nach dem ersten Kill wird
    abgeschnitten, und jeder hat über die volle Spielzeit Gelegenheiten, also wirkt die Eignung
    über die Dauer statt über den Erstkontakt.
  - Respawn-Timing, Wellen und Trades werden zu echter Taktik (der Name hält, was er verspricht).
- **Battlefield wird Conquest-light:** Tickets als Respawn-Kontingent, der Kontrollpunkt als
  Ticket-Bleed und Spawnvorteil. Dazu ein **zweiter, rückwärtiger Punkt**, damit Reihe 2
  (Commander) einen Job hat — der Folgevorschlag steht schon im `ARENA_DOMINATION`-Kommentar.
  Erst so kann die gebaute Domination überhaupt entscheiden (heute 0 von 120).
- **Mini-DM bleibt Eliminierung — aber als Chris' FFA.** Bei einem Kämpfer je Team ist
  Eliminierung das richtige Prinzip, weil es ein Duell-Kern ist. Vier Runden je Rolle **mit
  Ecken-Rotation** mitteln die Geometrie innerhalb *eines* Events heraus, so wie der Seitenwechsel
  in CS. Zu prüfen bleibt der FFA-typische Königsmacher-Effekt (zwei gehen auf einen): Er sollte
  bewusst begrenzt werden, damit nicht der Schwächste über Platz 1 entscheidet.

**Abgrenzung zu CLAUDE.md („mehr Ereignisse helfen fast nie"):** Dieser Vorschlag zielt nicht auf
mehr Ereignisse für mehr Verlässlichkeit — die ist ja schon gut. Er zielt auf die **Validität**.
Er entfernt zwei strukturelle Hebel, die kategoriale Zufälle über das ganze Spiel tragen: die
Anfangskonstellation und den Multiplikator „Überlebenszeit auf den Wert". Ob das trägt, ist eine
Hypothese und muss gemessen werden (A1 bis A3 vor und nach). Dasselbe Lehrgeld wie bei Hockeys
Zoneneintritt gilt: bei n ≥ 96 bestätigen, nicht bei n = 24.

### P4 — Weniger, aber lesbarere Manager-Entscheidungen

Der Werkzeugkasten (Slot, Ordnung, sieben Zielprioritäten, drei Takt-Regler, Live-Ansage) ist für
den Spieler kaum durchschaubar, und seine Wirkung ist an der Eignung vorbei gemessen. Vorschlag:
2–3 **Team-Pläne vor dem Kampf** mit erkennbaren Konterbeziehungen, zum Beispiel „Kopf abschlagen"
schlägt „Lohnendste zuerst" schlägt „Mauer" schlägt „Kopf abschlagen". Das ist dasselbe, was die
KI in `schlachtplan()` schon tut, nur für beide Seiten und sichtbar. Dazu die Rollenaufstellung
und die Live-Zielansage (bleibt). Die Einzel-Regler rücken in eine Expertenansicht. Taktischer
Erfolg wird so erklärbar („wir haben ihren Heiler zuerst genommen"), statt in einer
Konstellation zu verschwinden.

**Messung:** Siegquote Plan gegen Plan bei gleicher Eignung (bewusst eignungsneutral — ein
taktischer Vorteil *soll* es geben, aber er muss kleiner bleiben als ein großer Eignungsabstand,
also unter A1).

### P5 — Differenzierung und Assets (aus dem Rollout-Plan, bewusst zuletzt)

Eigenes Bodenbild für Battlefield, Kronen-Layer für den Commander und visuelle Rollenkennung
bleiben richtig und billig, lösen aber nichts an der Diagnose. Nach P1–P3.

### Ausdrücklich NICHT empfohlen

- Eine dritte Zielwahl-Formel (K1-Nachfolger). Sie ordnet dieselbe Kaskade nur anders an
  (Abschnitt 2.5).
- Weitere Rezeptrunden für TDM, Mini-DM oder Battlefield vor P1–P3. Das ist exakt das
  „Balancing, bevor das Konzept steht", vor dem Chris gewarnt hat.
- `cdKuerzung` erneut anfassen oder `jeSeite` erhöhen. Das ist Chris' Entscheidung bzw. ein
  reines Größenargument ohne Bezug zur Diagnose.

---

## 6. Reihenfolge und offene Entscheidungen für Chris

**Empfohlene Reihenfolge:** P0 → P1 → P2 → P3 (TDM zuerst, weil der Formatwechsel dort am
klarsten ist; Battlefield baut auf demselben Respawn auf) → P4 → P5. Nach jedem Schritt die
Stufen A1–A3 und die Pp-Abweichung messen, A4 erst ab P2.

**Vier Fragen, die nur Chris beantworten kann** (je eine Zeile, damit sie schnell entscheidbar
sind):

1. **TDM mit Respawn und Kill-Limit** statt Eliminierung — einverstanden, dass „TDM" dann
   genretreu wird?
2. **Battlefield mit Tickets und Respawn** (Conquest-light), damit die Domination überhaupt
   entscheiden kann?
3. **Persönlichkeit und Heiler-Unterklasse bestimmen den Weg, nicht die Menge** (P1) —
   einverstanden, auch wenn ein „Vorsichtiger" dann nicht mehr sichtbar schlechter abschneidet?
4. **Stufen-Abnahme A1–A4** für die drei Arena-Disziplinen — rho > 0,80 bleibt, wird aber erst nach
   Team-Ergebnis, Star/Paaren und Kanaltreue geprüft?

---

## 7. Was diese Runde nicht geprüft hat (Grenzen)

- Alle eigenen Zahlen stammen aus n = 24 je Paarung, fünf Paarungen. Das reicht für die Diagnose
  (die Unterschiede zu Basketball und Hockey sind ein Vielfaches der Spannweiten), aber **nicht**
  für eine Abnahme.
- Die Persönlichkeit je Spieler habe ich außerhalb des Motors mit einer 1 : 1-Kopie der Tabelle
  `PW` und der Funktion `leitePers` nachgerechnet, nicht aus `persOf` ausgelesen (die Schnittstelle
  gibt sie nicht heraus). Übereinstimmung nur durch Code-Lesung gesichert.
- `serieVon` zieht Mutatoren je Kampf, `disziplinProbe` nicht. Die Team-Ebene (2.3) und die
  Rangebene (2.1/2.2) sind deshalb nicht bitgleich dieselben Spiele.
- Die Wirkung von P1–P3 ist eine **Hypothese**. Diese Runde hat nichts davon gebaut oder simuliert.
- Nicht geprüft: ob `gegnerVorschau()` (liest fest die TDM-Aufstellung) im echten App-Pfad für
  Mini-DM/Battlefield einen falschen KI-Plan erzeugt, und wie sich der Königsmacher-Effekt im
  Mini-DM-FFA mit echten Kadern verhält.
- Nicht recherchiert: Balancing-Kennzahlen realer Shooter über Winston's Lab und HLTV hinaus. Die
  Quellen unten tragen die Struktur-Argumente, keine Zahlen für unseren Motor.

---

## Anhang A — Messmethode (zum Wiederholen)

Alle Messungen: Playwright gegen `public/mockups/battle-mode.html`, Kader-Familie aus
`data/generated/kaderfamilie-live-save.json`, n = 24, Saaten wie in der offiziellen Sonde.

1. **Rangebene** — `window.__arena.disziplinProbe(d, {n:24, kaderFamilie})` für `mini-dm`, `tdm`,
   `battlefield` (und `basketball`/`hockey` zum Vergleich; bei Hockey ohne Torwart). Daraus je
   Paarung:
   - rho je Spiel (Spearman, Durchschnittsränge wie `scripts/lib/rangtreue-messung.mjs`).
   - rho innerhalb jeder Seite (gemittelt).
   - **Verlässlichkeit** = Mittel der Spearman-Korrelation der Wert-Vektoren über alle 276
     Spielpaare.
   - **Validität** = Spearman(Eignungsmittel, Wertmittel) über die 24 Spiele.
   - Star = Rang des eignungsbesten Teilnehmers.
   - Paartreue = Anteil richtig geordneter Paare mit |ΔEignung| ≥ 15.
   - η² der Seitenzugehörigkeit auf den Wertrang je Spiel; Mittelrang je `reihe` und je `arch`.
2. **Kanäle** — gepoolt über alle Spiele und Paarungen: Rangquantil je Teilnehmer gegen
   Eignungsrang-Quantil (R²), Persönlichkeit (η², Persönlichkeit per `leitePers`-Kopie aus
   Klasse/Rasse/Sub/Traits), Heiler-Unterklasse (η²) und η² der Persönlichkeit auf dem Rest einer
   linearen Regression auf den Eignungsrang.
3. **Team-Ebene** — `kaderSetzen({heim,gast})`, danach `serieVon(d, 24)`: Siegquote, Dauer,
   Endstände, Eignungsmittel der aufgestellten Einheiten. Tauschtest: dasselbe mit getauschtem
   Heim/Gast.
4. **Battlefield-Domination** — `kaderSetzen`, danach `spieleArenaDomination("battlefield",
   1337+i·7919)` für i = 0…23: Entscheidungsart (Eliminierung / Punktelimit / Zeit), Dauer,
   Besitz am Ende.

Die Auswerte-Skripte lagen im Scratchpad dieser Sitzung und sind bewusst **nicht** committet
(Auftrag: kein Code). Wer P0 umsetzt, sollte sie als `scripts/miss-arena-diagnose.mjs` neu anlegen
— die obige Beschreibung ist vollständig genug dafür.

## Anhang B — Quellen

- Lanchester, quadratisches Gesetz: https://en.wikipedia.org/wiki/Lanchester%27s_laws ·
  Designer's Notebook (Game Developer): https://www.gamedeveloper.com/design/the-designer-s-notebook-kicking-butt-by-the-numbers-lanchester-s-laws ·
  Lanchester in StarCraft (AAAI): https://cdn.aaai.org/ojs/12780/12780-52-16297-1-2-20201228.pdf
- Overwatch, erster Kill entscheidet 77,17 % von 11.596 Teamfights: https://www.winstonslab.com/news/2017/03/07/teamfight-statistics/
- Overwatch, Rollen und Wechsel auf 5 gegen 5 (individuelle Wirkung, lesbarere Fights):
  https://overwatch.blizzard.com/en-us/news/24104605/ · https://esports.gg/guides/overwatch/why-did-overwatch-switch-from-6v6-to-5v5-explained/
- HLTV Rating 2.0 / KAST: https://www.hltv.org/news/20695/introducing-rating-20 · https://counterstrikestats.com/guides/hltv-rating-explained/
- Counter-Strike-Rollen (Entry, Support/Trade, AWP, Lurker, IGL): https://esports.gg/news/counter-strike-2/all-roles-in-cs2/ · https://leetify.com/blog/understanding-roles-in-csgo/
- Battlefield Conquest / Tickets / Ticket-Bleed: https://battlefield.fandom.com/wiki/Conquest · https://battlefield.fandom.com/wiki/Tickets
- Halo, Map Control und Power-Weapon-Timer: https://www.halowaypoint.com/en-us/forums/84ad72a8b51847978545f685f651fc15/topics/what-do-people-mean-by-map-control/17ab4beb-b372-40cd-ac84-51a45d1edd35/posts ·
  https://halo.bungie.org/misc/respawntimes.html
- TrueSkill / TrueSkill 2 (Einzelskill aus Teamergebnissen): https://www.microsoft.com/en-us/research/project/trueskill-ranking-system/ ·
  https://www.microsoft.com/en-us/research/publication/trueskill-2-improved-bayesian-skill-rating-system/
- Bereits im Repo recherchiert und hier vorausgesetzt: Xonotic Domination, Unity FPSSample
  CapturePoint, TF2-Rollenteilung (`arena-mini-dm-tdm-battlefield-rollout-plan.md` 3.2),
  TrinityCore/Warzone-2100-Zielwahl (`arena-duell-recherche-fable.md`).
