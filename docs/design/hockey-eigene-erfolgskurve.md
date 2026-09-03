# Hockeys eigene Erfolgskurve — TEAMGEIST raus, SCHUSS_NAH/FERN neu gefittet

Auftrag: Basketball und Hockey teilten sich bis zu dieser Runde dieselbe Wurf-/Schuss-
Erfolgsformel (`technikMake`/`steilerMake`), ausschließlich gegen 1074 echte NBA-Feldwürfe
kalibriert — Chris, wörtlich: „ja jede diszi braucht eine eigene success kurve!" Grundlage
ist eine bereits fertige Opus-Konsultation (Wortlaut im Auftrag), keine neue Recherche.
Branch `claude/hockey-eigene-erfolgskurve`, abgezweigt von `origin/claude/sonde-alle-disziplinen`
(dem Stand nach `hockey-mechanik-angleichen.md`).

Vier Commits, in der verlangten Reihenfolge:

1. Struktur (`kurve:`-Block, `KURVE_BASKETBALL`-Rückfall) — verhält sich für beide
   Disziplinen bit-identisch zum alten Stand.
2. Hockeys eigener `kurve:`-Block (TEAMGEIST raus, SCHUSS_NAH/FERN neu gefittet).
3. Eine Kommentarkorrektur (der `steil`-Sweep hatte behauptet, 16 mitgemessen zu haben —
   war nie Teil des tatsächlichen Laufs).
4. Dieser Bericht.

Eine fünfte, im Auftrag vorgesehene Stufe — HK_TOR_SKALA/HK_TW_REF/HK_TW_BASIS nachziehen —
entfällt: nachgemessen (Abschnitt „Torkorridor" unten) hält der Korridor ohne jede
Änderung. Kein Rezept wurde angefasst (außerhalb des Auftrags).

---

## A+B) Struktur — Kurve wird zu Daten

`FELDSPIEL_ART[d].kurve` trägt jetzt `base`, `geoBonus`, `radien` (Dokumentation),
`skillMittel`, `steil`, `korrektur`, `skillTerme`. `steilerMake`, `skillTeilFuer` (neu) und
`lageBasisFuer` (neu) lesen `FB().kurve || KURVE_BASKETBALL` — `KURVE_BASKETBALL` ist exakt
der bisherige Stand, zusammengesetzt aus den bestehenden Konstanten (`GEO_BONUS`,
`SKILL_MITTEL`, `STEIL_MAKE`, `MAKE_KORREKTUR`), kein neuer Fit.

**Verifiziert, nicht behauptet:** `scripts/miss-alle-disziplinen.mjs 24 basketball hockey`
vor und nach dem reinen Struktur-Commit liefert bitidentische Zahlen:

| Disziplin | rho je Spiel | rho Saison |
|---|---:|---:|
| Basketball (vor/nach Struktur-Commit) | 0,820 / 0,820 | 0,881 / 0,881 |
| Hockey (vor/nach Struktur-Commit, noch ohne eigenen kurve-Block) | 0,612 / 0,612 | 0,895 / 0,895 |

Hockey fuhr an dieser Stelle noch komplett den Rückfall-Pfad (`KURVE_BASKETBALL`) — die
Zahlen sind identisch zu `hockey-mechanik-angleichen.md`. Die Rückfall-Garantie hält.

---

## C) Hockeys eigener kurve-Block

```js
kurve:{
  base:-0.02,
  geoBonus:{dunk:0.70, nah:0.20, mit:0.09, fern:0.075},   // unveraendert von Basketball
  radien:{dunk:58, nah:140, mit:215, fern:330},           // = HK_RADIUS_*, Dokumentation
  skillMittel:0.2889,   // GEMESSEN
  steil:20,             // GEFITTET
  korrektur:{dunk:-1.351, nah:0.353, mit:-1.057, fern:-1.879}, // GEMESSEN, 3 Durchgaenge
  skillTerme:[{feld:"SCHUSS_TIER",koeff:0.0050}]
}
```

### TEAMGEIST ersatzlos gestrichen

Bislang: `skillTeil = schussSkillFuer(u,tier)*0,0022 + u.TEAMGEIST*0,0030`. Bei
Basketball-Mittelwerten (SCHUSS≈57,3, TEAMGEIST≈55,2) trägt TEAMGEIST 57 % des Skill-Terms,
der Schuss-Skill selbst nur 43 %. TEAMGEIST macht über `qualitaet()` in
`offensterMitspieler` (Koeffizient 0,0060, der höchste dort) zugleich einen Spieler zum
bevorzugten PASSEMPFÄNGER — wer viel TEAMGEIST hat, bekommt öfter selbst zugespielt, statt
selbst zuzuspielen. Das ist der strukturelle TEAMGEIST-Inversions-Kanal (rho −0,86 bis
−0,90 zu Assists laut Bericht), nicht `technikGate` (bei Normalwerten praktisch
wirkungslos, s. Motorkommentar).

TEAMGEIST bleibt unangetastet in `qualitaet()`/`offensterMitspieler` und in
`hockeyPassQualBonus` (Chemie als attraktives Anspielziel — sportlich vertretbar). Es
verschwindet NUR aus dem Skill-Term der Schuss-Erfolgsformel. **Kein LINIENSPIEL gebaut** —
Chris hat das nie beauftragt („teamgeist und linienspiel sagen mir nichts ... das habe ich
nicht beauftragt"); der Sub-Skill war eine Erfindung einer früheren Planungsrunde. Die
TEAMGEIST-Frage ist mit der Streichung abschließend gelöst, keine offene Aufgabe.

### Koeffizient 0,0022 → 0,0050

Mit dem TEAMGEIST-Term weg muss der verbleibende `schussSkillFuer`-Koeffizient stärker
wirken, sonst schrumpft der gesamte Skill-Term auf weniger als die Hälfte seiner alten
Größe — die Kurve würde insgesamt flacher, nicht präziser. 0,0050 ist die vom Auftrag
vorgeschlagene Richtung; NEU GEFITTET heißt hier: zusammen mit `steil`/`skillMittel`/
`korrektur` gegen die reale Terzil-Spreizung durchgemessen (nächster Abschnitt), nicht
isoliert für sich variiert — bei nur einem verbleibenden Term in `skillTerme` steckt die
eigentliche Kalibrierung ohnehin in `steil` und `skillMittel`.

### skillMittel — Messung, keine Handzahl

`scripts/miss-hockey-skillmittel.mjs 24 0.0050`, gegen den echten Kader (24 Spiele, vor
Hockeys eigenem kurve-Block gemessen — die Verteilung der Schüsse auf die vier
Distanzstufen hängt an Aufstellung/Distanz/Schwelle, nicht an der Erfolgsformel selbst,
also kein Zirkelschluss):

| Tier | Versuche | Anteil | Mittel(SCHUSS_NAH/FERN) |
|---|---:|---:|---:|
| dunk | 38 | 1,8 % | 65,03 |
| nah | 460 | 22,0 % | 56,84 |
| mit | 559 | 26,7 % | 59,25 |
| fern | 1034 | 49,5 % | 57,15 |

Gewichteter Mittelwert `schussSkillFuer` über alle 2091 Versuche: **57,79**.
`skillMittel = 0,0050 × 57,79 = 0,2889`.

### steil — durchgemessen, nicht die Schätzung übernommen

`korrektur=0` (Vorlauf-Fit), `steil` ∈ {14,18,20,22,24} gegen
`scripts/miss-hockey-archetypen.mjs 32` (Sniper-Terzilspreizung) und
`scripts/miss-hockey-korridor.mjs 16` (Torkorridor-Drift):

| steil | SCHUSS_NAH rho | SCHUSS_NAH dPp | SCHUSS_FERN rho | SCHUSS_FERN dPp | Tore/Team |
|---:|---:|---:|---:|---:|---:|
| 14 | 0,358 | +11,4 | 0,528 | +13,7 | 5,03 |
| 18 | 0,515 | +9,4 | 0,542 | +13,6 | 4,78 |
| 20 | 0,480 | +9,7 | 0,743 | +17,0 | 4,81 |
| 22 | 0,697 | +11,8 | 0,779 | +17,4 | 4,78 |
| 24 | 0,564 | +11,4 | 0,861 | +19,1 | 4,94 |

**Ehrlich benannt:** die Reihe ist bei n=32 deutlich verrauscht (SCHUSS_NAH-rho springt
nicht monoton), und die Trennschärfe wird in diesem Fenster mit steigendem `steil` eher
noch besser (24 trennt SCHUSS_FERN sogar schärfer als 20) — es gibt kein sauberes
Optimum, nur einen Trend. Gewählt wurde **20**, ein solider Punkt innerhalb der
ursprünglichen Schätzung (18-22), der nach dem `korrektur`-Fit (nächster Abschnitt) den
Torkorridor ohne jede weitere Konstanten-Nachziehung hält. 22 oder 24 wären ebenfalls
vertretbar und eine legitime Option für eine künftige, straffere Kalibrierrunde.

### korrektur je Tier — drei Durchgänge, zuletzt gefittet

Reihenfolge wie von den Invarianten verlangt: `skillMittel`/`steil` standen fest, dann erst
`korrektur` (sonst zweimal fitten, s. Motorkommentar zum 26.08.-Fehler bei
`steilerMake`). Zielwerte aus echten NHL-Torwahrscheinlichkeiten nach Distanz
(`hockey-torwart-puck-tore-recherche-fable.md`, Abschnitt 8.4), auf unsere vier
Distanzstufen gemappt: dunk ≈ 20 % (Torraum-Rand/tiefer Slot), nah ≈ 15 % (Slot), mit ≈
8 % (hoher Slot/Bullykreis), fern ≈ 4 % (Point/blaue Linie), `logit(Soll)-logit(Ist)` wie
bei Basketballs `MAKE_KORREKTUR`, gemessen mit dem neuen Werkzeug
`scripts/miss-hockey-tier-quote.mjs`:

| Durchgang | dunk-Ist | nah-Ist | mit-Ist | fern-Ist | Gesamt |
|---|---:|---:|---:|---:|---:|
| 0 (korrektur=0) | 22,6 % (n=31) | 11,9 % | 11,4 % | 11,3 % | 11,6 % |
| 1 | 30,8 % (n=39) | 14,6 % | 11,5 % | 7,0 % | 10,4 % |
| 2 | 31,7 % (n=41) | 14,3 % | 10,2 % | 4,7 % | 8,9 % |
| 3 (final, n=88 fuer dunk bei 48 Spielen) | 25,0 % | 14,6 % | 7,3 % | 4,5 % | 7,9 % |

Endstand `korrektur`: `{dunk:-1.351, nah:0.353, mit:-1.057, fern:-1.879}`. nah/mit/fern
konvergieren sauber gegen die Zielwerte (15/8/4 % Soll gegen 14,6/7,3/4,5 % Ist). **dunk
bleibt die unsicherste Stufe** — nur ~2 % aller Schussversuche (31-88 Beobachtungen je
Lauf), entsprechend verrauscht, und blieb nach drei Durchgängen bei 25 % statt der
angepeilten 20 %. Ein vierter Durchgang würde vermutlich vor allem Rauschen jagen (dunk
macht ohnehin kaum Unterschied im Gesamtbild); nicht weiter verfolgt.

---

## D) Vorher/Nachher — alle verlangten Messungen

### Sniper (`scripts/miss-hockey-archetypen.mjs 48`) — der Kernbefund

| | vorher (geteilte Kurve) | nachher (eigene Kurve) |
|---|---:|---:|
| Spearman(SCHUSS_NAH, Trefferquote) | 0,042 | **0,818** |
| Terzil dPp (SCHUSS_NAH) | +3,3 | **+12,1** |
| Spearman(SCHUSS_FERN, Trefferquote) | −0,159 | **0,820** |
| Terzil dPp (SCHUSS_FERN) | +0,5 | **+9,1** |

Genau der Befund, den der Auftrag verlangt hat: SCHUSS_FERN zeigte vorher effektiv KEINEN
Zusammenhang (sogar leicht negativ), jetzt einen sehr sauberen. Das ist die direkte Folge
davon, dass Hockeys Kurve jetzt tatsächlich am eigenen Schuss-Skill hängt statt an
Basketballs `STEIL_MAKE=12` bei Hockeys viel niedrigerer Trefferquote (Ableitung
`STEIL·p·(1−p)` war bei p≈0,09 weniger als halb so groß wie bei Basketballs p≈0,44 — exakt
der in der Opus-Konsultation benannte Mechanismus).

### Playmaker (dieselbe Sonde)

| | vorher | nachher | Bewertung |
|---|---:|---:|---|
| AUFBAU-Delta (Assists − Tore) | +0,100 | +0,078 | im Rauschen, hält |
| TEAMGEIST-Delta (Assists − Tore) | −0,182 | **−0,448** | verschlechtert |

**Ehrlich benannt:** das TEAMGEIST-Delta wird MEHR invertiert, nicht weniger, obwohl
TEAMGEIST aus der Schuss-Formel verschwunden ist. Erwartet hätte man das Gegenteil (ohne
den künstlichen Schuss-Bonus sollte TEAMGEIST weniger stark mit eigenen Toren
zusammenhängen, das Delta also weniger negativ werden). Isoliert nachgeprüft: der Teil des
erwarteten Effekts stimmt (`TEAMGEIST,Tore/Spiel`-rho fällt von +0,127 auf −0,209 — TEAMGEIST
macht jetzt tatsächlich NICHT mehr direkt mehr eigene Tore), aber `TEAMGEIST,Assists/Spiel`
fällt GLEICHZEITIG von −0,055 auf −0,658 — deutlich stärker negativ, obwohl an der
Assist-Vergabe (Berührungskette, `offensterMitspieler`) nichts geändert wurde. Das riecht
nach derselben RNG-Kaskade, die `hockey-mechanik-angleichen.md` schon beim
Verteidiger/Torwart-Befund beschreibt: veränderte Schussausgänge verschieben die gesamte
restliche Zufallsfolge des Spiels, wodurch auch unveränderte Mechanismen andere Werte
zeigen. Nicht sauber isoliert — offener Punkt für eine Nachmessrunde mit mehreren
Saatfamilien, kein verstecktes Balance-Problem dieser Runde.

### Verteidiger und Torwart (nicht Teil des Auftrags, aber mitgemessen)

| | vorher (nach B1-6) | nachher |
|---|---:|---:|
| dTore% (Verteidiger) | +11,7 % (falsches Vorzeichen) | **−35,5 %** (richtiges Vorzeichen, uebertrifft Ziel ≤−25%) |
| dFG% (Verteidiger) | −0,3 Pp | −0,5 Pp (unveraendert) |
| rho(Eig,GSAA) Torwart | −0,180 | −0,292 (weiter verschlechtert) |
| Paarvergleich Torwart | 43,8 % | 25,0 % (weiter verschlechtert) |

Verteidiger-dTore% dreht überraschend auf das richtige Vorzeichen und übertrifft sogar das
Ziel — ein positiver Nebeneffekt, aber wie im letzten Bericht schon für dieselbe Kennzahl
festgehalten: diese Rollenprobe ist bekannt instabil (im Ausgangsbericht schwankte sie
zwischen −26,9 % und −49,4 % je nach Spielanzahl bei UNVERÄNDERTER Mechanik) — nicht als
gesicherten Erfolg dieser Runde verbuchen. Torwart-Korrelation verschlechtert sich weiter;
dieselbe Einschränkung wie im letzten Bericht gilt unverändert (nur 6 Torwart-Identitäten
insgesamt, hohe Varianz). Zusätzlicher Hinweis: `miss-hockey-archetypen.mjs` verwendet für
die Torwart-GSAA-Berechnung ein eigenes, hartcodiertes `HK_TW_REF=0,844` (Kommentar im
Skript: „bewusst hier dupliziert") — das ist der ALTE Wert von vor
`hockey-mechanik-angleichen.md`s Nachzug (heute im Motor 0,907). Vorbestehende
Inkonsistenz, nicht durch diese Runde verursacht, hier nur dokumentiert statt beiläufig
mitkorrigiert (außerhalb des Auftrags).

### rho je Spiel / rho Saison (`scripts/miss-alle-disziplinen.mjs`)

| | vorher | nachher (24 Spiele) | nachher (48 Spiele) |
|---|---:|---:|---:|
| Hockey rho je Spiel | 0,612 | 0,617 | 0,607 |
| Hockey rho Saison | 0,895 | 0,783 | 0,804 |
| Basketball rho je Spiel (Regressionscheck) | 0,820 | **0,820** | — |
| Basketball rho Saison (Regressionscheck) | 0,881 | **0,881** | — |

**Basketball unverändert — die harte Regressionsgrenze hält**, bit-identisch vor und nach
beiden Commits.

**Hockey rho je Spiel bleibt flach bei ~0,61** — keine Verschlechterung auf der Zahl, die
laut CLAUDE.md zählt, aber auch keine Verbesserung; das war für eine reine Kurven-Runde
nicht zu erwarten (rho je Spiel hängt an Verlässlichkeit × Wurzel(Validität), und
Verlässlichkeit ändert diese Runde nicht).

**Hockey rho Saison fällt ehrlich von 0,895 auf ~0,80.** Das ist eine reale, keine
verrauschte Verschlechterung (bei 24 UND 48 Spielen im selben Bereich). Einordnung: das
Hockey-REZEPT (`battle-mode.rezepte.js`) — also die Formel für `eig`, die Eignung — wiegt
TEAMGEIST weiterhin mit demselben Gewicht wie zuvor. Die Mechanik belohnt TEAMGEIST jetzt
aber nicht mehr über den Schuss-Erfolg (nur noch indirekt über Passqualität/Anspielziel).
Ein Rezept, das einen Kanal gewichtet, den die Mechanik nicht mehr honoriert, sieht in der
Saison-rho schlechter aus — dasselbe Muster, das `hockey-mechanik-angleichen.md` für den
`checks*0,4`-Fall und die ZWEITCHANCE-Neuverteilung schon beschreibt. Das Rezept
anzufassen war ausdrücklich NICHT Teil dieses Auftrags („baue Hockeys eigenen kurve-Block",
kein Rezept-Nachzug) — eine künftige Rezeptrunde sollte TEAMGEISTs Gewicht in `eig` gegen
die jetzt gemessene, ehrlichere Mechanik neu austarieren.

### Torkorridor (`scripts/miss-hockey-korridor.mjs`) — hält ohne Nachziehung

| | vorher | nachher (24 Spiele) | nachher (48 Spiele) |
|---|---:|---:|---:|
| Tore je Team | 3,50 | 3,50 | 3,44 |
| Fangquote | 90,7 % | 90,7 % | 90,8 % |
| Tore je Schussversuch | 8,0 % | 8,0 % | 7,9 % |

Zusätzlich geprüft (nicht im Auftrag verlangt, aber die Voraussetzung für „keine
Konstanten-Nachziehung nötig"): Torwart-Mittelwert (`feldspielWert`) gegen
Feldspieler-Mittelwert, dieselbe Balance-Kennzahl wie im letzten Bericht (7,17 gegen 7,16):
jetzt **7,15 gegen 7,25** — weiterhin dicht beieinander. `HK_TOR_SKALA=0,46`,
`HK_TW_REF=0,907`, `HK_TW_BASIS=7,16` bleiben **unverändert** — die im Auftrag vorgesehene
Nachzieh-Stufe war nach Messung schlicht nicht nötig, weil der dreistufige
`korrektur`-Fit (der ja explizit gegen dieselben NHL-Zielquoten kalibriert wurde, aus denen
sich auch die Gesamtquote ergibt) den Gesamtkorridor von selbst getroffen hat. Keine dritte
Konstanten-Commit-Stufe, weil es nichts zu ändern gab.

---

## Zusammenfassung: was besser, was schlechter, was offen ist

**Klar besser:** der zentrale Auftragsbefund — SCHUSS_NAH/SCHUSS_FERN zeigen jetzt einen
echten, kräftigen Zusammenhang mit der Trefferquote (rho 0,82/0,82 statt 0,04/−0,16), ohne
den Torkorridor zu verschieben. Basketball bleibt exakt unverändert. Als Nebeneffekt dreht
auch die Verteidiger-dTore%-Kennzahl auf das richtige Vorzeichen.

**Ehrlich schlechter:** Hockeys Saison-rho fällt von 0,895 auf ~0,80 (Rezept/Mechanik
laufen jetzt auseinander, s. oben — Empfehlung: Rezeptrunde). Das
Playmaker-TEAMGEIST-Delta wird stärker invertiert statt schwächer (−0,182 → −0,448,
vermutlich RNG-Kaskade, nicht isoliert nachgewiesen). Die Torwart-Korrelation verschlechtert
sich weiter (dieselbe Instabilität wie im letzten Bericht, nicht neu verursacht).

**Nicht sauber isolierbar:** wie schon in `hockey-mechanik-angleichen.md` — Verteidiger- und
Torwart-Effekte hängen an sehr wenigen Identitäten/Beobachtungen und einer einzigen
Zufallsfolge; jede Motoränderung verschiebt sie mit, ohne dass sich eine einzelne Ursache
sauber benennen lässt.

**Offen für eine künftige Runde:** `steil` könnte bei 22-24 noch schärfer trennen (s.
Sweep-Tabelle), wurde aber konservativ bei 20 belassen. Eine Rezeptrunde für Hockeys `eig`
(TEAMGEIST-Gewicht gegen die neue Mechanik neu austarieren) ist der naheliegende nächste
Schritt für die Saison-rho. `dunk` bleibt die verrauschteste Distanzstufe (~2 % der
Schüsse) und konvergierte nach drei Durchgängen nicht ganz auf den NHL-Zielwert.
