# Football: eigene Spiel-Eignung im Motor statt Matrixänderung — Befund, Prototyp, Messung, Rezept (05.09.)

Reine Planung, kein Code auf `main`. Fortsetzung von `football-matrix-und-assets-recherche-05-09.md`
(PR #790, Diagnose) und des **geschlossenen** PR #796 (`football-matrix-umsetzungsplan-05-09.md`,
nicht auf `main`), der die Football-Spalte der produktiven Gewichtstabelle ändern wollte. Chris'
Antwort darauf, wörtlich: „die Gewichtungsmatrix darf nicht verändert werden! wenn dann müssten
die Stats und wie sie in die Attribute der Diszi einfließen angepasst werden."

Dieses Dokument nimmt genau diesen Satz als Auftrag: `lib/player-generator/official-discipline-weights.ts`,
`BASIS_JE_DISC.football` und das gespeicherte Produktionsrating `p.d.football` bleiben **unangetastet**
(nachgewiesen in Abschnitt 6.3: `git diff` gegen die Tabelle ist leer). Alles unten spielt sich in
`public/mockups/battle-mode.engine.js` ab, in football-eigenem Code. Alle Zahlen sind an der echten
Kaderfamilie (110 Spieler, fünf Paarungen) in einem eigenen `git worktree` nachgemessen
(`node scripts/miss-alle-disziplinen.mjs 24 football`, dieselbe Sonde wie bei jeder Abnahme).

---

## 0. Ergebnis vorab

1. **Der Auftrag war in einem Punkt falsch gestellt, und das entscheidet über den Lösungsweg.**
   Die „eigene Erfolgskurve" (Aufgabe #30, `kurve:`-Block) ist NICHT eine Eignungsberechnung aus
   den Attributen, sondern die Sub-Skill→Ergebnis-Kurve (Logit aus Skill und Wurfgeometrie).
   Football hat sie schon (`engine.js:4304-4324`). **Kein einziges Chassis rechnet eine
   disziplin-eigene Eignung aus `p.a`** — `bauFeldspiel`, `bauBuehne`, `bauSpurt` und `baueEinheit`
   lesen alle `p.d[disc]` (Produktionsrating) und fallen nur dann auf `gewichtet(p.a,
   BASIS_JE_DISC[disc])` zurück, wenn es fehlt. Basketball und Hockey unterscheiden sich von
   Football nicht darin, WAS die Zielgröße ist, sondern darin, WIE das Rezept (Attribute →
   Sub-Skills, `battle-mode.rezepte.js`) und die Kurve (Sub-Skills → Ereignisse) sie bedienen.
   Abschnitt 1 legt das an den Code-Stellen offen.
2. **`u.eig` ist im Feldspiel ein reiner Maßstab, keine Mechanik.** Nachgesehen: kein Motorpfad
   liest `u.eig` (nur Boxscore-Anzeige und der Messexport, `engine.js:13954/14013/18356`). Die
   Mechanik läuft über die Sub-Skills `R2`, die `mische(p.a, rezept)` aus den ROHEN Attributen
   baut. Eine „football-eigene Eignungsformel im Motor" ändert deshalb allein, WOGEGEN gemessen
   wird — sie hebt rho nur zusammen mit einem Rezept, das zu ihr passt. Gemessen: neue Eignung
   mit altem Rezept **0,038** je Spiel (Abschnitt 4, Lauf B).
3. **Der Prototyp funktioniert und ist klein**: ein `spielEignung`-Block in `FELDSPIEL_ART.football`
   (eine Datenzeile), zehn Zeilen in `bauSpieler`, das Rezept aus PR #796 (Lauf H) mit zwei
   Handkorrekturen. Kaderfest gemessen: **rho je Spiel 0,468 → 0,516, Saison 0,671 → 0,811,
   Spannweite 0,383 → 0,172 / 0,420 → 0,168.** Der Star (eignungsbester Feldspieler) steht statt
   in 13 % in **31 %** der Spiele auf Rang 1, statt in 29 % in **53 %** in den ersten zwei; Paare mit
   mindestens 15 Punkten Abstand sind zu **86 %** statt 74 % richtig geordnet. Die 19 anderen
   Disziplinen bleiben bit-identisch (Abschnitt 6.2). Die Tabelle wurde nicht angefasst (6.3).
4. **Was das kostet, und das muss Chris entscheiden, nicht ich**: Rating-Anzeige, Teamstärke und
   KI-Kauf sagen für Football weiter „Die Liebenden (power 1, speed 1) sind Rang 4", das
   Minispiel setzt sie auf Rang 91. Spiel und Anzeige rechnen Football dann verschieden — der
   Zustand, den PR #790 (2.6) als zweiten Ast benannt hat. Abschnitt 5 sagt, wo das sichtbar
   wird und was dagegen hilft, ohne die Tabelle zu berühren.
5. **Die 0,80 je Spiel bleiben mit dieser Runde außer Reichweite** — aus demselben Grund wie in
   PR #796: Footballs Verlässlichkeit liegt bei (0,516/0,811)² = **0,40** (Hockey 0,755). Der
   Maßstab ist mit dieser Runde repariert (Saison 0,81, Spannweite ein Drittel), der Rest sitzt
   im Los des Motors (Abschnitt 7).

---

## 1. Wie Basketball und Hockey es tun — nachgesehen, nicht vermutet

### 1.1 Drei Ebenen, drei verschiedene Dinge

| Ebene | Was sie tut | Wo | Football heute |
|---|---|---|---|
| **Eignung** `u.eig` | Zielgröße der Rangtreue-Messung; Anzeige im Boxscore | `bauFeldspiel`/`bauSpieler`, `engine.js:5391` (main `ee2ac733`): `basisWert = p.d[disc] ?? gewichtet(p.a, BASIS_JE_DISC[disc])`, dann `eig = basisWert + Slot + Form` | `p.d.football` = Produktionsrating aus der Tabelle (Ligarang → `rank-to-discipline-stat`) |
| **Rezept** | Attribute → Sub-Skills (`R2[k] = mische({a:attr}, rezept[k])`), das ist die Mechanik | Basketball, Hockey: `battle-mode.rezepte.js`; Football, 17 weitere: inline `rezept:{…}` in `FELDSPIEL_ART` (`engine.js:4432`) | `LAUFKRAFT: {spirit 56, health 30, power 14}` usw., per Sinkhorn gegen die ALTE Matrix gebaut |
| **Erfolgskurve** `kurve` | Sub-Skills + Geometrie → Trefferwahrscheinlichkeit (`steilerMake`, `skillTeilFuer`, `lageBasisFuer`) | `engine.js:5046` (`KURVE_BASKETBALL`), Hockey `:4547`, Football `:4304` | eigene Kurve seit der Live-Migration; Pass-Tiefen statt Distanzringe |

**Was Aufgabe #30 gebaut hat** (`docs/design/hockey-eigene-erfolgskurve.md`): den `kurve:`-Block als
Daten je Disziplin, mit `KURVE_BASKETBALL` als Rückfall — `skillTerme`, `skillMittel`, `steil`,
`korrektur`. Hockey strich TEAMGEIST aus dem Skill-Term und fittete steil/korrektur gegen
NHL-Torquoten nach Distanz. **Die Eignung hat diese Runde nie angefasst**; sie ist dort wie
überall `p.d.hockey`. Hockeys Rangtreue von 0,612 auf 0,670 kam aus Rezept
(`hockey-rezept-ursache.md`: Sondierung + Sinkhorn + Handkorrektur gegen Blindflecken) und Kurve.

**Basketball** ebenso: `p.d.basketball` als Maßstab, Rezept aus fünf Messrunden
(`battle-mode.rezepte.js:36-330`), Kurve gegen 1074 NBA-Feldwürfe. Keine eigene Eignungsformel.

### 1.2 Was das für Chris' Satz heißt

„Die Stats und wie sie in die Attribute der Diszi einfließen" ist im Motor exakt die Rezept-Ebene:
welcher Sub-Skill („Stat") aus welchen Attributen gespeist wird. Das ist der Hebel, den Hockey
und Basketball benutzt haben, und er lässt die Tabelle unberührt. **Aber** — und das ist der
Befund, der seit `football-matrix-entscheidung.md` steht — mit `p.d.football` als Maßstab belohnt
jedes Rezept, das rho hebt, zwangsläufig spirit/health/determination und bestraft speed
(Attribut-Korrelationen gegen `p.d.football` auf dem Kader: speed −0,44, awareness −0,34,
spirit +0,36, health +0,54; PR #790 Abschnitt 2.1). Drei Rezeptrunden am 04.09. haben genau das
getan und bei 0,468 ihren Grenzertrag benannt. Ein Rezept, das einen Running Back aus power/speed
baut, **senkt** rho gegen diesen Maßstab — es misst dann, wie gut der Motor „Geist" belohnt.

Es gibt also nur zwei ehrliche Wege, und keinen dritten:

- **Weg R (Rezept allein, Maßstab bleibt `p.d.football`)**: die Mechanik muss belohnen, was die
  Tabelle misst. Das ist Weg B aus `football-matrix-entscheidung.md` — Football als Disziplin,
  in der Wille und Geist zählen; 0,468 ist ungefähr das Ende der Fahnenstange
  (`football-rezept-kalibrierung.md` Abschnitte 4–5, alle drei Anläufe).
- **Weg E (eigene Spiel-Eignung im Motor + passendes Rezept)**: der Motor bekommt für Football
  einen eigenen Maßstab aus `p.a` und ein Rezept, das ihn bedient. Tabelle, Rating, KI-Kauf
  bleiben, wie sie sind. Preis: Anzeige und Minispiel ordnen Football verschieden (Abschnitt 5).

Dieses Dokument baut und misst Weg E, weil der Auftrag ihn verlangt — und sagt in Abschnitt 5,
was er kostet, damit die Entscheidung mit offenen Karten fällt.

---

## 2. Die Formel — was in `spielEignung` steht und warum

### 2.1 Gewichte

    spielEignung: { power 22, health 18, speed 14, torment 12, determination 10,
                    awareness 8, stamina 6, dexterity 4, spirit 3, will 3 }      (Summe 100)

Das sind die Zahlen aus PR #790 (2.4) und PR #796 (2.4), unverändert übernommen — die Herleitung
dort (Combine-Prädiktoren, Madden-Semantik, Trash-Talk-/Aggressions-Evidenz, `torment` 12 statt
16 mit Zahlen) gilt weiter und wird hier nicht wiederholt. Eine Kontrollsuche in dieser Runde
(Anhang A) hat nichts gefunden, was die Reihenfolge power > health > speed umstößt: die
Georgia-Southern-Metaanalyse findet an jeder Position mindestens einen signifikanten
Combine-Prädiktor (4–62 % erklärte Varianz), der Sport-Journal-Draft-Vergleich sieht Vorhersagekraft
nur bei DT/OT (Masse/Kraft), und der einzige Test mit robuster Einzelkorrelation bleibt der Sprint
(Pass-Rush-Grade). Das ist genau die Trias power/health/speed.

Gerechnet wird mit der Motorfunktion `gewichtet(p.a, W)` — derselbe gewichtete Attributschnitt,
mit dem `calculateRawDisciplineScore` (`lib/player-formulas/discipline-rating-engine.ts:26`) den
Rohscore für die Ligatabelle bildet, nur ohne den Umweg Ligarang → Stat. Für die Rangtreue ist
das gleichgültig: die Rang-zu-Stat-Abbildung ist monoton, Spearman innerhalb eines Kaders bleibt
identisch (Kontrolle: `gewichtet(p.a, ALTE Matrix)` reproduziert `p.d.football` mit rho 1,000).

### 2.2 Warum keine Mischung mit `p.d.football`

Die Aufgabenstellung ließ offen, ob `p.d.football` als ein Faktor unter mehreren bleiben soll.
Gemessen (Abschnitt 4, Lauf D): eine 50/50-Mischung mit Rezept H liegt bei **0,410 / 0,462** — unter
dem Stand von `main`. Der Grund ist strukturell, nicht numerisch: ein gemischter Maßstab wird von
keinem Rezept bedient, weil das alte Rezept gegen die eine Hälfte und das neue gegen die andere
gebaut ist; Sinkhorn gegen die Mischung würde ein drittes Rezept liefern, das beides halb belohnt
(die „sanfte Variante" aus PR #790, 2.4, mit demselben Ergebnis: 79 % alte Rangfolge, kaum
Trennschärfe). Rein oder gar nicht.

### 2.3 Was die Formel am Kader tut (110 Spieler, Spearman)

| Attribut | rho zu `p.d.football` (heute) | rho zu `spielEignung` |
|---|---:|---:|
| power | +0,42 | **+0,88** |
| health | +0,54 | +0,70 |
| torment | +0,27 | +0,70 |
| stamina | +0,16 | +0,46 |
| determination | +0,53 | +0,25 |
| speed | **−0,44** | +0,11 |
| dexterity | −0,31 | +0,09 |
| will | +0,49 | −0,03 |
| awareness | −0,34 | −0,22 |
| charisma | +0,36 | −0,34 |
| spirit | +0,36 | **−0,49** |
| intelligence | −0,17 | −0,55 |

Skala: `p.d.football` Mittel 36,6 / SD 15,3, `spielEignung` Mittel 44,9 / SD 12,3 (rho zwischen
beiden 0,427). Neue Kader-Spitze: Umbrafond (Berserker, 88/79/65), Tidesprinter (80/51/89),
Brontar (Tank, 90/95/40), Terradon (86/98/82), Reefstrike, Tavascron, Vorrak, Radditz. Von der
alten Spitze bleiben Vorrak (3 → 7) und Krolach (7 → 11); Ser Camelot fällt 1 → 27, Johanna 2 → 25,
„Die Liebenden" 4 → 91. Dasselbe Bild wie in PR #796 (3.2), dort über den Produktionspfad
gerechnet — hier über `gewichtet()`, mit identischer Rangfolge.

---

## 3. Der Prototyp — exakter Code-Ort

Alles in `public/mockups/battle-mode.engine.js`, Zeilennummern im Worktree nach dem Patch
(Basis `origin/main` `ee2ac733`). Kein anderer Ort im Repo wird berührt.

**(1) Datenblock, `FELDSPIEL_ART.football`, direkt hinter `punkteNah/punkteFern/fernAnteil`
(`:4281-4282`):**

```js
      // PROTOTYP-SCHALTER (s. bauSpieler): Football-eigene Spiel-Eignung aus p.a.
      spielEignung:{gewichte:{power:22,health:18,speed:14,torment:12,determination:10,awareness:8,stamina:6,dexterity:4,spirit:3,will:3}},
```

Liegt **außerhalb** des generierten Blocks (`<<< GENERIERT` … `>>> ENDE GENERIERT`, `:3457-3638`)
und überlebt deshalb jeden Lauf von `generiere-arena-daten.ts`. Bewusst als Feld von
`FELDSPIEL_ART` und nicht als Eintrag in `BASIS_JE_DISC`: `BASIS_JE_DISC` speist Slot-Aufschlag,
`mitAufschlag` und `betroffeneAttribute` für alle vier Chassis und ist generiert — dort etwas
Football-Eigenes einzutragen wäre genau die Vermischung, die Chris verboten hat.

**(2) Lesestelle, `bauFeldspiel` → `bauSpieler` (`:5393-5403`), ersetzt die eine Zeile
`const basisWert=p.d[feldspielDisc]!=null?…`:**

```js
      const spielE=art.spielEignung;
      const produktionsWert=p.d[feldspielDisc]!=null?p.d[feldspielDisc]:gewichtet(p.a,BASIS_JE_DISC[feldspielDisc]||{});
      const basisWert=spielE
        ?(spielE.mischung!=null
            ?spielE.mischung*gewichtet(p.a,spielE.gewichte)+(1-spielE.mischung)*produktionsWert
            :gewichtet(p.a,spielE.gewichte))
        :produktionsWert;
```

`eig:basisWert+engP+breitP` bleibt unverändert; `engP` (Slot) und `breitP` (Form, Stufe) sind
weiter dieselben Zuschläge wie in allen Disziplinen. Für jede Disziplin OHNE `spielEignung` ist
`basisWert` zeichengleich der alte Ausdruck — das ist die Rückfall-Garantie nach dem Muster von
`FB().kurve || KURVE_BASKETBALL`. Der `mischung`-Zweig war nur für Lauf D nötig und kann in der
Umsetzung entfallen (Abschnitt 6.1 empfiehlt das).

**(3) Rezept, `FELDSPIEL_ART.football.rezept` (`:4434-4444`)** — Rezept H aus PR #796 (Sondierung
gegen die neue Zielgröße, `sondiere-feldspiel-subskills.mjs football 24`, dort Abschnitt 4:
TEAMGEIST 49,6 %, LAUFKRAFT 27,3 %, ABWEHR_PASS 6,5 %, PASSSCHUTZ 6,4 %, PASSGENAUIGKEIT 6,1 %,
BALLSICHERHEIT 2,2 %, LAUFTEMPO 0,7 %, AUSDAUER 0,4 %, ABWEHR_LAUF 0 %; Sinkhorn mit der
ERLAUBT-Tabelle aus 5.4 dort), mit den zwei Handkorrekturen, die PR #796 selbst als
Sinkhorn-Artefakte ausgewiesen hat:

```js
      rezept:{
        PASSGENAUIGKEIT: {determination:71,dexterity:29},
        LAUFKRAFT:       {power:41,health:33,speed:26},
        PASSSCHUTZ:      {power:40,health:40,awareness:20},   // Hand: O-Line = Anker, nicht Wahrnehmung (Sinkhorn: awareness 100)
        ABWEHR_PASS:     {speed:40,awareness:30,torment:30},   // Hand: CB/S = Speed + Lesen (Sinkhorn: torment 100)
        ABWEHR_LAUF:     {torment:100},
        BALLSICHERHEIT:  {determination:71,dexterity:29},
        TEAMGEIST:       {power:41,health:33,speed:26},        // Receiver-Los: der grosse Receiver (PR #796, Lauf E gegen H)
        AUSDAUER:        {stamina:67,will:33},
        LAUFTEMPO:       {speed:52,stamina:32,dexterity:16}    // unveraendert, disziplinuebergreifend
      },
```

Die Sondierung wurde nicht neu gefahren: sie misst den Motor, nicht die Matrix, und der Motor ist
zwischen PR #796 und diesem Worktree derselbe Commit (`ee2ac733`). Die Handkorrekturen betreffen
zusammen ~13 % mechanisches Gewicht; ihr Effekt liegt gemessen innerhalb der Spannweite (Lauf C
gegen F, Abschnitt 4) — sie sind Fachlichkeit, kein Rangtreue-Gewinn.

---

## 4. Kaderfest nachgemessen

`node scripts/miss-alle-disziplinen.mjs 24 football`, Kaderfamilie `kaderfamilie-live-save.json`
(unverändert, `gezogenAm 2026-09-03`), Median über fünf Paarungen, Spannweite in Klammern.
Laufzeit je Lauf 32 s.

| Lauf | Eignung (`u.eig`) | Rezept | rho je Spiel | rho Saison |
|---|---|---|---:|---:|
| **A — `main` `ee2ac733`** | `p.d.football` | alt | **0,468** (0,383) | 0,671 (0,420) |
| B | `spielEignung` | alt | 0,038 (0,442) | 0,049 (0,811) |
| C | `spielEignung` | H (Sinkhorn pur) | 0,540 (0,181) | 0,818 (0,210) |
| D | 0,5·`spielEignung` + 0,5·`p.d.football` | H | 0,410 (0,267) | 0,462 (0,490) |
| **F — Vorschlag** | `spielEignung` | H + zwei Handkorrekturen | **0,516** (0,172) | **0,811** (0,168) |

Lesart nach CLAUDE.md, zwei Spalten:

- **B** ist der Beweis für Abschnitt 0.2: Eignung allein bewegt nichts, weil `u.eig` keine
  Mechanik ist. Das alte Rezept belohnt weiter „Geist", der neue Maßstab misst „Wucht" — rho
  fällt auf Null, Saison-Spannweite 0,81 (kaderabhängig instabil).
- **C/F** reparieren die **Validität**: Saison 0,67 → 0,81, und die Spannweite fällt von 0,42 auf
  0,17–0,21 — die Mechanik belohnt kaderunabhängig das Richtige. Das ist der Sprung, der
  außerhalb des Kaderrauschens liegt.
- Die Einzelspielzahl steigt nur um 0,05–0,07 — innerhalb der alten Spannweite, aber mit einer
  **halbierten** Spannweite (0,38 → 0,17). Nach `rho(Spiel) = rho(Saison) · √Verlässlichkeit`
  heißt das Verlässlichkeit **0,40** (F) — Football bleibt die einzige Disziplin unter 0,5.
  Hier greift CLAUDE.md's „mehr Ereignisse helfen fast nie" NICHT (Hockey war schon bei 0,755);
  der Rest ist das Los des Motors, Abschnitt 7.
- **D** (Mischung) ist schlechter als A. Begründung in 2.2.

PR #796 hatte für dieselbe Konstellation (Tabelle geändert, Rezept H) 0,520 / 0,806 gemessen. Die
Differenz zu C (0,540 / 0,818) liegt daran, dass dort auch die Slot-Profile neu generiert waren;
hier bleiben `SLOTS_JE_DISC.football` und damit die Slot-Zuschläge auf der alten Matrix. Beides
innerhalb der Spannweite — die Zahl hängt nicht daran, ob die Tabelle oder der Motor den Maßstab
trägt.

### 4.1 Die ehrlichere Abnahme: Star und Paartreue

CLAUDE.md verlangt neben rho die Frage nach dem Star und nach Paaren mit Abstand. Gemessen mit
einer kleinen Sonde über `disziplinProbe` (120 Spiele = 24 × 5 Paarungen, alle zwölf Feldspieler
je Spiel; Skript im Anhang B):

| | A (`main`) | F (Vorschlag) | Hockey (Referenz, CLAUDE.md) |
|---|---:|---:|---:|
| Star auf Rang 1 des Spiels | 13 % | **31 %** | 58 % |
| Star in den ersten zwei | 29 % | **53 %** | 78 % |
| Star auf dem letzten Rang | 1 % | 0 % | nie |
| Paare ≥ 15 Punkte Abstand, richtig geordnet | 74 % | **86 %** | 99 % |
| Paare < 5 Punkte Abstand, richtig geordnet | 53 % | 53 % | (Münzwurf, soll so sein) |
| Median Kader-Spannweite der Eignung (12 Spieler) | 41,1 | 39,3 | — |

Die Paare unter fünf Punkten bleiben bei 53 % — die kann und soll kein Motor ordnen. Die Paare mit
Abstand steigen von 74 auf 86 %: das ist die Validität. Dass der Star nur in 31 % der Spiele oben
steht (Hockey 58 %), ist die Verlässlichkeit — dieselbe Zahl in anderer Kleidung.

### 4.2 Nachtrag F2: wenn der Rückfall nach der Spiel-Eignung aufstellt

`bauFeldspiel:5330` sortiert die Heimseite ohne gesetzte Aufstellung nach `p.d[disc]`. Testweise
auf `gewichtet(p.a, spielEignung.gewichte)` umgestellt (nur Heimseite, drei Zeilen), Stand F
sonst unverändert:

| | F | F2 (Rückfall nach Spiel-Eignung) |
|---|---:|---:|
| rho je Spiel (Spannweite) | 0,516 (0,172) | 0,476 (0,227) |
| rho Saison (Spannweite) | 0,811 (0,168) | 0,853 (0,322) |
| Star Rang 1 / Top 2 | 31 % / 53 % | 31 % / 45 % |
| Paare ≥ 15, richtig | 86 % (3150 Paare) | 84 % (2610 Paare) |
| Median Kader-Spannweite | 39,3 | 36,6 |

Alles innerhalb der Spannweiten, also kein Rangtreue-Hebel — aber ein anderer Kader: die sechs
Besten nach Spiel-Eignung liegen enger beieinander (weniger Paare mit Abstand, kleinere
Spannweite), was rho je Spiel drückt und die Saisonzahl hebt. F2 ist deshalb eine
Konsistenz-Entscheidung (Rückfall und Maßstab sollen dasselbe meinen), keine Messverbesserung;
sie gehört in die Umsetzung (6.1 Schritt 4), aber ihre Zahl ist nicht mit F vergleichbar. Der
Prototyp im Worktree wurde danach auf Stand F zurückgesetzt, damit 6.3 den dokumentierten Diff
zeigt.

Nebenbefund dabei, nicht angefasst: die **Gastseite** sortiert im Rückfall gar nicht
(`gegner=(gastGesetzt.length?gastGesetzt:OPP).slice(0,n)`, `:5342`) — sie nimmt die ersten n in
Kaderreihenfolge, die Heimseite die n besten nach Rating. In der Sonde treten Heim und Gast also
nach verschiedenen Regeln an; der Spiegeltest (`miss-arena-feldspiel-spiegel.mjs`) sieht das
nicht, weil dort beide Kader gleich sind. Gilt für alle Feldspiel-Disziplinen, eigene kleine
Runde wert.

---

## 5. Was Weg E kostet — offen gesagt

Der Preis von Weg E ist, dass `p.d.football` (Anzeige, Teamstärke, KI-Kauf, Training, Scouting —
die 20 Leser der Tabelle aus PR #790 2.6) und die Spiel-Eignung des Motors Football verschieden
ordnen (rho 0,43 zwischen beiden auf dem Kader). Wo der Spieler das sieht:

1. **Transfermarkt/Kader, Linse Football**: Ser Camelot, Johanna, „Die Liebenden" bleiben oben —
   und spielen im Minispiel Mittelfeld bis Keller. Ein Manager, der nach dem angezeigten Rating
   kauft und aufstellt, wird vom Minispiel enttäuscht. Das ist der eigentliche Nachteil, kein
   technischer.
2. **Aufstellungsbildschirm**: die sechs Slot-Rollen (`lib/lineups/matchday-slot-roles.ts:232-239`,
   „Line Power gewinnt Kontakt über Spirit und Torment") und der Slot-Fit („passt perfekt") lesen
   die Tabelle. Sie empfehlen weiter Spirit-Spieler für die Line. Die Slot-Zuschläge im Motor
   (`slotAufschlag`, ±8,5 Punkte) bleiben ebenfalls auf der alten Matrix — gemessen unschädlich
   (Lauf C gegen PR #796), aber der Text stimmt nicht mehr zum Spiel.
3. **Rückfall-Aufstellung im Motor** (`bauFeldspiel:5330`, `ersatz` sortiert nach `p.d[disc]`):
   ohne gesetzte Aufstellung — und in jeder Sonde — treten die sechs Besten nach ALTEM Rating an.
   Die Messungen oben sind also so gefahren, wie ein Manager nach der Anzeige aufstellen würde;
   das ist die ehrliche Bedingung. Abschnitt 6.1 (4) sagt, was zu tun ist.
4. **Boxscore**: die Spalte „Eignung" zeigt für Football die `spielEignung` (Skala ähnlich, Mittel
   45 statt 37), im Kaderbildschirm steht daneben das alte Rating. Zwei Zahlen für eine Disziplin
   brauchen ein Wort („Spielwert") — Kosmetik, aber sichtbar.

Was dagegen hilft, **ohne die Tabelle zu ändern**: (a) im Kader-/Transfer-UI für Football eine
zweite Anzeige „Spielwert" aus derselben Formel — dann kauft der Manager wissend; (b) die
Rollentexte der sechs Football-Slots auf power/health/speed umschreiben (Text ist kein Gewicht;
das Profil hinter dem Slot bleibt, wie es ist) — beides ist Produktionscode außerhalb des Motors
und gehört in eine eigene, kleine Runde, wenn Chris Weg E will. Was NICHT hilft: die Mischung
(2.2) — sie macht beides halb falsch.

Und der Satz, der zur Entscheidung gehört: Wenn Chris Football als Willens-/Geist-Sportart sieht
(die Tabelle sagt das heute), ist Weg E die falsche Richtung, und Weg R (Weg B der
Entscheidungsvorlage: 0,468 akzeptieren, Football als Schauspiel führen) die ehrliche. Beides ist
vertretbar; die Zahlen oben gelten nur für Weg E.

---

## 6. Rezept — umsetzungsreif

### 6.1 Schritte (ein PR, alles im Motor)

1. **`FELDSPIEL_ART.football`**: `spielEignung:{gewichte:{…}}` wie in 3(1) eintragen, den
   Kopfkommentar „MATRIX: spirit 25, …" über dem Football-Eintrag um den Satz ergänzen, dass die
   Tabelle nur noch Rating/KI/Slot speist und der Motor seine Spiel-Eignung aus `spielEignung`
   rechnet — sonst liest die nächste Runde die falsche Zielgröße ab.
2. **`bauSpieler`**: die eine `basisWert`-Zeile durch die Lesestelle aus 3(2) ersetzen. Empfehlung:
   ohne `mischung`-Zweig (drei Zeilen weniger, Lauf D hat ihn erledigt).
3. **Rezept**: Block aus 3(3) einsetzen. Den Kommentarblock `:4359-4431` (Geschichte des alten
   Rezepts, „AWARENESS BEWUSST NIE ALS TRAEGER", die verworfenen Fassungen) auf zwei Absätze
   kürzen: er beschreibt Messungen gegen die alte Zielgröße und gilt für die neue nicht mehr
   (awareness −0,22 statt −0,34, speed +0,11 statt −0,44, power +0,88 statt +0,42). Ebenso
   `MATRIX.football` und `ERLAUBT.football` in `scripts/baue-feldspiel-rezept.mjs:33/75` auf die
   `spielEignung`-Gewichte bzw. die ERLAUBT-Tabelle aus PR #796 5.4 setzen — sonst rechnet die
   nächste Sinkhorn-Runde gegen die Tabelle.
4. **Rückfall-Aufstellung** (`bauFeldspiel:5330`): `ersatz` für eine Disziplin mit `spielEignung`
   nach dieser statt nach `p.d[disc]` sortieren — wer ohne Aufstellung antritt, soll die stellen,
   die das Minispiel belohnt. Bewusst als eigener Schritt, nach der Messung: er verändert, WER
   in der Sonde antritt, und damit die Vergleichbarkeit mit den Zahlen oben (Abschnitt 4.2
   liefert die Zahl dazu, sobald gemessen).
5. **Messen**: `node scripts/miss-alle-disziplinen.mjs 24 football basketball hockey` — Football
   muss 0,52 / 0,81 (±0,03) treffen, Basketball und Hockey bit-identisch zu 6.2 bleiben. Danach
   `npx tsx scripts/pruefe-rangtreue-schranke.ts` bzw. die CI-Basislinie
   (`messgrundlage-kaderfest.md` Teil B) für Football auf die neue Baseline setzen, mit dem
   Vermerk, dass 0,468 und 0,516 verschiedene Maßstäbe messen.
6. **Doku**: `stand-aller-disziplinen.md` Football-Zeile; `football-matrix-entscheidung.md` trägt
   nach: „Tabelle bleibt (Chris, 05.09.); Motor-eigener Maßstab, s. dieses Dokument".

Nicht Teil dieses PRs, aber Folge von Weg E (Abschnitt 5): „Spielwert"-Anzeige und Rollentexte.

### 6.2 Isolationsnachweis: die 19 anderen Disziplinen

`node scripts/miss-alle-disziplinen.mjs 24` (alle zwanzig, n = 24, Kaderfamilie) einmal im
unveränderten Worktree (`origin/main` `ee2ac733`) und einmal auf Stand F:

| Disziplin | Chassis | vorher: rho Spiel (Spann.) / Saison (Spann.) | nachher (Stand F) |
|---|---|---|---|
| staffel | bahn | 0,915 (0,089) / 0,951 (0,093) | identisch |
| speed-schach | buehne | 0,889 (0,060) / 0,979 (0,021) | identisch |
| gewichtheben | buehne | 0,887 (0,224) / 0,944 (0,261) | identisch |
| showcase | buehne | 0,880 (0,140) / 0,944 (0,063) | identisch |
| time-trial | bahn | 0,867 (0,050) / 0,909 (0,056) | identisch |
| spurt | bahn | 0,857 (0,286) / 0,905 (0,357) | identisch |
| wettessen | buehne | 0,844 (0,233) / 0,916 (0,126) | identisch |
| fechten | buehne | 0,840 (0,230) / 0,874 (0,252) | identisch |
| tennis | buehne | 0,814 (0,176) / 0,839 (0,294) | identisch |
| breaking | buehne | 0,801 (0,114) / 0,874 (0,119) | identisch |
| climbing | bahn | 0,790 (0,192) / 0,851 (0,308) | identisch |
| basketball | feldspiel | 0,772 (0,088) / 0,923 (0,231) | identisch |
| eiskunstlauf | buehne | 0,757 (0,125) / 0,958 (0,091) | identisch |
| takeshis-castle | bahn | 0,697 (0,170) / 0,839 (0,196) | identisch |
| i-spy | buehne | 0,692 (0,384) / 0,727 (0,441) | identisch |
| hockey | feldspiel | 0,669 (0,181) / 0,832 (0,259); nur Feldspieler 0,719 / 0,818 | identisch |
| **football** | feldspiel | **0,468 (0,383) / 0,671 (0,420)** | **0,516 (0,172) / 0,811 (0,168)** |
| battlefield | arena | 0,387 (0,938) / 0,595 (1,095) | identisch |
| tdm | arena | 0,253 (0,328) / 0,217 (0,308) | identisch |
| mini-dm | arena | 0,094 (0,697) / 0,071 (0,786) | identisch |

`diff` der beiden sortierten Tabellen (21 Zeilen inkl. Hockey-Feldspielerzeile): genau **eine**
Zeile unterscheidet sich, Football. Laufzeit je Lauf 9 min 20 s, „Seitenfehler: keine" in beiden.
Basketball (0,772 / 0,923) und Hockey (0,669 / 0,832) — dieselbe `bauFeldspiel`-Funktion, derselbe
`basisWert`-Ausdruck — sind auf drei Stellen gleich; die Rückfall-Garantie des `spielEignung`-Feldes
hält, wie die des `kurve`-Feldes in `hockey-eigene-erfolgskurve.md` Abschnitt A+B.

### 6.3 Die Tabelle wurde nicht angefasst

Im Worktree nach allen Läufen:

    git diff --stat
     public/mockups/battle-mode.engine.js | 28 ++++++++++++++++++++--------
     1 file changed, 20 insertions(+), 8 deletions(-)

    git diff -- lib/player-generator/official-discipline-weights.ts | wc -l
    0

`BASIS_JE_DISC.football` (`engine.js:3479`, generierter Block) ist im Diff nicht enthalten;
`SLOTS_JE_DISC.football`, `matchday-slot-roles.ts`, `discipline-rating-engine.ts`,
`kaderfamilie-live-save.json` ebenfalls nicht. Das Produktionsrating `p.d.football` jedes der 2984
Spieler bleibt, was es ist — kein Saisonwechsel-Rebuild, kein Kaderfamilien-Schalter nötig (die
beiden Punkte 5.5/5.6 aus PR #796 entfallen mit Weg E vollständig).

---

## 7. Danach: wo die 0,80 sitzen

Unverändert gegenüber PR #796 5.9, mit der neuen Zahl: Verlässlichkeit 0,40. Drei Kandidaten, alle
Motor, alle mit derselben Sonde messbar, alle unabhängig von der Tabellenfrage:

1. **Receiver-Los** (`gewichtetesLos(restOff,"TEAMGEIST")`, `engine.js:6590`): linear proportional —
   TEAMGEIST 80 gegen 60 bekommt nur 4:3 der Bälle. Ein Exponent (z. B. Gewicht²) oder Top-2-Bindung
   hebt die Verlässlichkeit, ohne die Validität zu berühren. Erster Kandidat, weil TEAMGEIST mit
   ~50 % mechanischem Gewicht der schwerste Sub-Skill ist.
2. **ABWEHR_LAUF zum Leben erwecken** (0 % mechanisch): Run Defense hat keinen Kanal, obwohl die
   Spiel-Eignung sie mit torment/power/health bepreist.
3. **Mehr Drives** als Messexperiment (nicht Produktentscheidung): Football ist die einzige
   Disziplin, bei der die Uhr noch etwas bringen kann.

---

## Anhang A: Quellen

Wiederverwendet aus PR #790/#796 (dort vollständig): Kuzmits & Adams 2008 (JSCR), SumerSports
Combine-by-Position, Sports Info Solutions 2023, The Sport Journal (Draft-Status), Benoit/SI 2019,
Olson 2017 (Madden), Yip/Schweitzer/Nurmohamed 2018, BEJEAP 2019, Crist 2016, Keeler 2007.

Kontrollsuche dieser Runde (nichts, was die Reihenfolge ändert):

- Georgia Southern (ETD): *The Relationship Between The NFL Scouting Combine And On-Field
  Performance* — an jeder Position mindestens ein signifikanter Combine-Prädiktor, 4–62 % erklärte
  Varianz je Kennzahl — https://digitalcommons.georgiasouthern.edu/cgi/viewcontent.cgi?article=3054&context=etd
- The Sport Journal: *The Predictive Ability of the Physical Skills Used at the NFL Combine to
  Predict Draft Status* — Vorhersagekraft nur bei DT/OT (Draft 2022) —
  https://thesportjournal.org/article/the-predictive-ability-of-the-physical-skills-used-at-the-nfl-combine-to-predict-draft-status/
- arXiv 2303.05774: *NFL Career Success as Predicted by NFL Scouting Combine* — keine Drill außer
  dem 40-Yard-Sprint (Pass-Rush-Grade) signifikant — https://arxiv.org/pdf/2303.05774
- PubMed 30358695: *National Scouting Combine Scores as Performance Predictors in the NFL* (nur
  Titel/Abstract-Listing erreichbar, Volltext hinter Cookie-Wand; nicht als Beleg verwendet) —
  https://pubmed.ncbi.nlm.nih.gov/30358695/

Repo-intern: `football-matrix-und-assets-recherche-05-09.md`, `football-matrix-entscheidung.md`,
`football-rezept-kalibrierung.md`, `hockey-eigene-erfolgskurve.md`, `hockey-rezept-ursache.md`,
`messgrundlage-kaderfest.md`, `stand-aller-disziplinen.md`, PR #796 (geschlossen,
`origin/claude/football-matrix-umsetzungsplan`).

## Anhang B: Reproduzieren

Worktree von `origin/main` `ee2ac733`, `node_modules` des Hauptcheckouts verlinkt (Playwright).

1. Patch aus Abschnitt 3 (drei Stellen) einsetzen.
2. `node scripts/miss-alle-disziplinen.mjs 24 football` je Variante (A–F: `spielEignung`
   entfernen / `mischung:0.5` setzen / Rezeptblock tauschen).
3. Star/Paartreue: eine 50-Zeilen-Sonde über `window.__arena.disziplinProbe(d,{n,kaderFamilie})`,
   die je Spiel den eignungsbesten Feldspieler gegen den Impact-Rang und alle Paare mit
   ≥ 15 bzw. < 5 Punkten Eignungsabstand auf Ordnungstreue prüft (nicht committed; bei Bedarf
   nach `scripts/` als `miss-star-paartreue.mjs` übernehmen — sie beantwortet die Frage, die
   CLAUDE.md „die ehrlichere Abnahme" nennt, für alle Feldspiel-Disziplinen).
4. Isolationsnachweis: `node scripts/miss-alle-disziplinen.mjs 24` vor und nach dem Patch, Diff
   der Tabellen.
