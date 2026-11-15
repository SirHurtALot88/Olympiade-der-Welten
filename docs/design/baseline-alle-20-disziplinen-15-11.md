# Baseline aller zwanzig Disziplinen — 15.11. (Task #127)

Reine Messaufgabe für die laufende Budget-Konservierungs-Kampagne (Football/Hockey/Basketball/
Bühne/Bahn, mehrere parallele Agenten): **kein Rezept-Code wurde hier angefasst.** Dieses Dokument
ist der Referenzpunkt, gegen den künftige Nachmessungen dieser Kampagne verglichen werden.

**Stand:** Commit `27a7b4117`, Kader-Familie `data/generated/kaderfamilie-live-save.json`
(fünf echte Team-Paarungen, live-save-Save "Oly New Game Custom 31.10.2026, 20:56:51", gezogen
2026-11-15T01:11:32Z). Vorher geprüft: `npx tsx scripts/pruefe-spiegel-frische.ts` zeigte beide
Spiegel < 0,1 h alt; die bestehende Kaderfamilie-Datei (von einem anderen Agenten am 14.11. um
23:25 Uhr gezogen) war zu diesem Zeitpunkt bereits durch ein neueres live-save-Abbild überholt
(Push 15.11. 01:10 Uhr) — deshalb neu gezogen (`scripts/ziehe-kader-familie.ts`). Ergebnis
inhaltlich **byte-identisch** zur Vorgängerversion (gleicher Save, nur `gezogenAm` geändert) — die
Kader-Familie selbst hat sich seit dem 14.11. nicht verändert, nur ihr Frischedatum.

## Methodik-Hinweis: zwei Messläufe statt einem

`node scripts/miss-alle-disziplinen.mjs 24` (ohne Disziplinliste) misst alle zwanzig mit der
**Ersatzkarte** (`formVon()+stufenWert()`, der historische Standard). Das ist korrekt für 18 der
20 Disziplinen — aber **nicht mehr für Spurt und Time-Trial**: seit der P4-Formkarten-Welle
(`lib/battle/formkarten-echt-disziplinen.ts`, zuletzt erweitert 14.11. um Spurt) laufen diese
beiden Disziplinen im echten Spiel über die **gespielte** Formkarte aus der Einsatzliste
(`breitPunkteVon()` → `formEchtVon()` → `place[n].form`), nicht mehr über die Ersatzkarte. Die
Mess-Sonde (`disziplinProbe`/`einflussVon`) baut aber keine echte Einsatzliste und liefert ohne
`OLY_FORM_MODUS=echt` deshalb für GENAU DIESE ZWEI Disziplinen die falsche, veraltete
Ersatz-Zahl — exakt der Fehler, der im ersten unten verworfenen Lauf passiert ist (Spurt 0,884,
Time-Trial 0,934 statt der unten stehenden, mit `OLY_FORM_MODUS=echt` nachgemessenen Werte). Für
alle anderen 18 Disziplinen bewirkt `OLY_FORM_MODUS=echt` nichts Falsches, weil deren
`place[n].form` im echten Spiel nie gesetzt wird — aber im Mess-Pfad überschreibt die
„echt"-Messsonde (`FORM_MESS`) die Ersatzkarte diskriminierungslos für JEDE gerade gemessene
Disziplin, sobald die Variable gesetzt ist (`formEchtVon()` prüft `FORM_MESS.has(n)` VOR der
Disziplin-Zugehörigkeitsprüfung). Deshalb zwei getrennte Läufe, wie im Repo bereits für Spurt/
Time-Trial einzeln üblich:

```sh
node scripts/miss-alle-disziplinen.mjs 24                       # 18 Ersatzkarten-Disziplinen
OLY_FORM_MODUS=echt node scripts/miss-alle-disziplinen.mjs 24 spurt time-trial   # die zwei echten
```

## Methodik-Hinweis: Football/Hockey brauchten einen isolierten Nachlauf

Im gemeinsamen 20-Disziplinen-Lauf schlugen Football UND Hockey mit
`Error: page.evaluate: Target page, context or browser has been closed` fehl — nicht der
bekannte, am 25.10. behobene DOM-Leck-Absturz (`messLaufStumm()` ist weiterhin aktiv), sondern
schlichte Speichernot: die Maschine lief zum Messzeitpunkt mit mehreren parallelen Agenten
gleichzeitig (u. a. ein Vitest-Lauf mit `--max-old-space-size=900` in einem anderen Worktree, ein
weiterer `messe-arena-einfluss.mjs spurt`-Lauf und ein einzelner Chromium-Renderprozess mit über
10 GB RSS), bei nur 1,6 GB freiem RAM. Isoliertes Nachmessen (`node scripts/miss-alle-disziplinen.mjs
24 football` bzw. `... hockey`, je ein eigener Prozess) lief beide Male sauber durch, ohne
Seitenfehler. Für künftige Baseline-Läufe während paralleler Kampagnen: bei einem Seitenfehler
zuerst die betroffene Disziplin einzeln nachmessen, bevor man ihn als Mechanik-Regression
fehlinterpretiert.

## Ergebnistabelle — alle zwanzig Disziplinen

Median/Spannweite über die fünf Kader-Varianten, 24 Spiele je Variante (Standardprotokoll,
`docs/design/messgrundlage-kaderfest.md`). „Letzter bekannter Stand" ist
`data/generated/disziplin-abnahme.json` bzw. `docs/design/stand-aller-disziplinen.md`, Datum wie
dort vermerkt.

| Disziplin | Chassis | Letzter bekannter rho je Spiel (Datum) | **Neu: rho je Spiel (Median)** | Spannweite | rho Saison (Median) | Status | Bewegung seit letztem Stand |
|---|---|---:|---:|---:|---:|---|---|
| staffel | bahn | 0,937 (16.10.) | **0,931** | 0,078 | 0,965 | bestanden | unverändert (innerhalb Spannweite) |
| time-trial* | bahn | 0,917 (11.11., echt) | **0,930** | 0,047 | 0,937 | bestanden | unverändert (innerhalb Spannweite) |
| eiskunstlauf | bühne | 0,866 (15.10.) | **0,912** | 0,046 | 0,951 | bestanden | leicht rauf, knapp außerhalb alter Spannweite (0,105) |
| tdm** | arena | 0,800–0,827 (k=2..6, 11.11.) | **0,911** | 0,020 | 0,958 | bestanden | rauf, siehe Fußnote — anderes Messprotokoll |
| wettessen | bühne | 0,910 (16.10.) | **0,905** | 0,190 | 0,958 | bestanden | unverändert (innerhalb Spannweite) |
| speed-schach | bühne | 0,910 (16.10.) | **0,904** | 0,077 | 0,972 | bestanden | unverändert (innerhalb Spannweite) |
| gewichtheben | bühne | 0,865 (16.10.) | **0,892** | 0,039 | 0,944 | bestanden | leicht rauf, knapp außerhalb alter Spannweite (0,143) |
| tennis | bühne | 0,813 (16.10.) | **0,890** | 0,079 | 0,965 | bestanden | rauf, außerhalb alter Spannweite (0,199) — echte Verbesserung möglich |
| spurt* | bahn | 0,938 (14.11., echt) | **0,860** | 0,074 | 0,860 | bestanden | runter, außerhalb alter Spannweite (0,126) — **im Auge behalten, s. u.** |
| fechten | bühne | 0,860 (16.10.) | **0,877** | 0,037 | 0,972 | bestanden | unverändert (innerhalb Spannweite) |
| breaking | bühne | 0,801 (16.10., war auf Beobachtungsliste „genau auf der Schranke") | **0,867** | 0,181 | 0,916 | bestanden | rauf — Abstand zur Schranke jetzt deutlich komfortabler |
| takeshis-castle | bahn | 0,898 (16.10.) | **0,838** | 0,143 | 0,979 | bestanden | runter, aber innerhalb der (jetzt größeren) Spannweite |
| basketball | feldspiel | 0,832 (26.10.) | **0,822** | 0,091 | 0,930 | bestanden | unverändert (innerhalb Spannweite) |
| climbing | bahn | 0,833 (16.10.) | **0,797** | 0,191 | 0,874 | **knapp (< 0,80)** | runter, aber innerhalb der eigenen Spannweite (0,191 ≫ 0,036 Bewegung) — Kaderrauschen, keine Regression |
| i-spy | bühne (Auftritt) | 0,817 (27.10., bereits auf Beobachtungsliste) | **0,779** | 0,212 | 0,881 | **knapp (< 0,80)** | runter, innerhalb der eigenen Spannweite — Kaderrauschen |
| showcase | bühne | 0,835 (16.10.) | **0,771** | 0,135 | 0,965 | **knapp (< 0,80)** | runter, innerhalb der eigenen Spannweite — Kaderrauschen, aber jetzt erstmals unter der Schranke |
| hockey | feldspiel | 0,640 (25.10.; nur Feldspieler 0,676) | **0,700** (nur Feldspieler 0,784) | 0,266 | 0,888 | durchgefallen (Chris-Ausnahme deckt rho) | rauf, aber weiterhin klar unter 0,80 |
| battlefield | arena (Zweier-Duell, außerhalb der Wertung) | 0,399 (15.10.) | **0,589** | 0,276 | 0,664 | durchgefallen, außerhalb der Wertung (gewertet wird der Vierer-Pod, 0,861–0,923) | rauf, aber weiterhin klar unter 0,80 |
| mini-dm*** | arena (falsches Chassis) | 0,800 (altes 4er-FFA, 24.10.) | **0,199** | 0,385 | 0,333 | durchgefallen — **Messartefakt, s. Fußnote*** | nicht vergleichbar |
| football | feldspiel | 0,807 (25.10., MIT Matrix-Override) | **0,248** | 0,809 | 0,266 | durchgefallen | **dramatischer Einbruch — erwartet, s. u.** |

\* Gemessen mit `OLY_FORM_MODUS=echt` (s. Methodik-Hinweis oben) — das ist die Zahl, die dem
aktuellen Produktionsverhalten entspricht, nicht die Ersatzkarten-Zahl aus dem gemeinsamen Lauf.

\*\* `miss-alle-disziplinen.mjs tdm` misst inzwischen über den echten `tdmGefecht()`-Pfad
(TDM-Gefecht-Verdrahtung, 11.11.) mit der Standard-Kader-Familie (10 Varianten, Feldgröße 6) —
andere Stichprobe als die spezialisierte Sonde `miss-tdm-gefecht-abnahme.mjs` (die über k=2..6
mittelt). Beide liegen komfortabel über 0,80, kein Widerspruch.

\*\*\* `miss-alle-disziplinen.mjs mini-dm` misst `MOTOREN["mini-dm"]`, das alte generische
4-gegen-4-Chassis — **nicht** die tatsächlich gespielte Mechanik (`spieleMiniDmFfaEvent()`,
variable Feldgröße k=2..6). Für die echte Mechanik gilt ausschließlich
`scripts/miss-mini-dm-ffa-abnahme.mjs` / `data/generated/disziplin-abnahme.json` Schlüssel
`mini-dm-ffa` (rhoJeEvent 0,608–0,686 je k, alle unter 0,80, mit Chris' expliziter
Stern-/Paartreue-Freigabe trotzdem verdrahtet). Die 0,199 hier sind kein neuer Befund und keine
Regression — Fußnote bereits so von `miss-alle-disziplinen.mjs` selbst ausgegeben.

## Die wichtigste Bewegung: Football bricht ein — erwartet, nicht mein Problem

**rho je Spiel fällt von 0,807 auf 0,248**, weit unter die 0,80-Schranke UND unter die eigene
Kaderrauschen-Spannweite (0,809 — größer als der Messwert selbst, das Signal ist im Rauschen
nicht mehr von einer zufälligen Umordnung zu unterscheiden). Ursache ist klar und dokumentiert,
nicht Teil dieser Messaufgabe: Commit `b5731dd` (14.11., „Football-Override zurueckgebaut:
Mechanik liest wieder die Matrix", PR #1444) hat den Football-spezifischen Eignungs-Override
(`lib/player-generator/spiel-eignung-overrides.ts`) entfernt — Football bewertet seitdem wieder
über die gesperrte Matrix direkt, für die die Mechanik laut diesem Commit nicht gebaut war. Genau
daran arbeiten die parallel laufenden PRs #1462/#1463 („Football-Rezept neu gebaut nach
Budget-Methode gegen die Matrix"). Diese Baseline-Zahl (0,248) ist der Ausgangspunkt, gegen den
jene PRs ihren Fortschritt zeigen sollten — nicht der alte Override-Wert 0,807.

## Drei Disziplinen jetzt knapp unter der Schranke: climbing, i-spy, showcase

Alle drei sind bereits in `ARENA_RESOLVED_DISCIPLINE_IDS` (gewertet) und fallen in dieser Messung
erstmals bzw. erneut unter 0,80 — **aber bei allen dreien ist die Bewegung kleiner als die
eigene Kaderrauschen-Spannweite** (climbing: Bewegung 0,036 vs. Spannweite 0,191; i-spy: 0,038 vs.
0,212; showcase: 0,064 vs. 0,135). Nach CLAUDE.mds eigenem Maßstab
(„eine Rezeptänderung, die kleiner bewegt als die Spannweite, ist von Null nicht unterscheidbar")
ist das **kein Beleg für eine Regression** — wahrscheinlicher ist, dass diese drei schon beim
letzten Mal nahe der Schranke lagen (i-spy stand bereits auf der Beobachtungsliste in
`disziplin-abnahme.json`) und die Kader-Familie diesmal eine andere Stelle in derselben Streuung
trifft. Trotzdem: alle drei verdienen einen Blick bei der nächsten Nachmessung, besonders falls
eine der laufenden Kampagnen-PRs (Bühne/Bahn) an einem geteilten Sub-Rezept rührt, das sie
mitbewegt.

## Unverändert / stabil

Zwölf der zwanzig Disziplinen (staffel, time-trial, eiskunstlauf, tdm, wettessen, speed-schach,
gewichtheben, fechten, basketball, hockey, battlefield, mini-dm) zeigen Bewegungen innerhalb ihrer
eigenen Kaderrauschen-Spannweite oder sind aus den oben genannten Gründen nicht direkt
vergleichbar — keine davon deutet auf eine echte Mechanik-Regression hin. Tennis und breaking
bewegen sich klar nach oben, außerhalb ihrer alten Spannweite — plausibel echte Verbesserungen
(beide Disziplinen hatten in der Zwischenzeit keine dokumentierte Rezeptänderung in diesem Repo,
die Bewegung könnte auch an der frischen Kader-Familie oder an nicht in `stand-aller-
disziplinen.md` festgehaltenen Nebenwirkungen anderer PRs liegen — nicht weiter untersucht, da
außerhalb dieses Auftrags).

## Für die Budget-Konservierungs-Kampagne

Die fünf Kampagnen-Disziplinen im Überblick, mit dieser Baseline als Referenz für die nächste
Nachmessung:

| Disziplin | Baseline rho je Spiel (diese Messung) | Status |
|---|---:|---|
| Football | 0,248 | durchgefallen, aktiv bearbeitet (PR #1462/#1463) |
| Hockey | 0,700 (nur Feldspieler 0,784) | durchgefallen, Chris-Ausnahme deckt nur rho |
| Basketball | 0,822 | bestanden |
| Bühne (mehrere Disziplinen, s. Tabelle) | 0,771–0,912 | showcase knapp unter Schranke, Rest bestanden |
| Bahn (mehrere Disziplinen, s. Tabelle) | 0,797–0,931 | climbing knapp unter Schranke, Rest bestanden |

Rohausgaben beider Messläufe: Ersatzkarten-Lauf (18 Disziplinen) sowie die isolierten
Football-/Hockey-/Spurt-/Time-Trial-Nachläufe wurden gegen Commit `27a7b4117` erzeugt, exakt mit
den oben genannten Befehlen — reproduzierbar ohne weitere Vorbereitung außer der bereits
beschriebenen Kader-Familie.
