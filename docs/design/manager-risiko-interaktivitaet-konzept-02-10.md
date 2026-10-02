# Manager-Risiko-Interaktivität + ereignisarme Disziplinen (Opus-Konsultation, 02.10.)

Chris' Anfrage, wörtlich: „wie viele disziplinen haben wir die recht langwilig aussehen oder wo
nicht so viel passiert wenn man zuschaut? Und hast du schon gameplay elemente verarbeitet oder dir
überlegt was man machen kann? beim gewichtheben könnte man als manager den leuten ja zb auch
vorgeben wer versucht zu pushen und risiko zu gehen und wer hält sich lieber etwas zurück etc. so
müssen wir denken wie man mit einfachen methoden das spiel etwas interaktiver gestalten kann und
das auch nen gewissen impact haben kann - mehr risiko führt dazu dass jemand sich evtl übertrifft
oder unter dem druck oder gewicht einbricht."

Reine Recherche/Konzept, kein Code geändert, kein PR mit Verhaltensänderung.

**Grundlage:** `docs/design/f1-broadcast-audit-runde-2-30-09.md` (Standbild/Stille je Disziplin bei
Tempo 1×), die sieben `docs/design/fable-ideen-*-30-09.md`-Papiere, `gewichtheben-risiko-versuch-
recherche-06-09.md`, die Engine-Stellen `lastFuer()`, `buehneErfolgschance()`, `planJeSlot`,
`INTENSITAET`, `lib/fatigue/fatigue-injury-service.ts`, `lib/foundation/battle-arena/arena-kader-
adapter.ts`, sowie alle 92 Meldungen auf dem `bug-reports`-Branch (Spiegel frisch, letzte Meldung
25.08. — keine davon spricht Langeweile/fehlende Spannung an).

## Teil 1: Wo beim Zuschauen wenig passiert

Rund **neun von zwanzig Disziplinen** wirken ereignisarm. Vier weitere haben das umgekehrte
Problem — ständig ist etwas eingeblendet, nichts wirkt mehr wichtig (Breaking 92 % Bannerzeit,
Takeshi 82 %, Eiskunstlauf 43 %, Fechten 40 %; Zahlen aus dem Audit vom 30.09.).

1. **Gewichtheben** — die toteste Sendung. 7:11 Dauer, Bild steht 95 % der Zeit, am Stück bis 30 s.
   24 Versuche in sieben Minuten, der Zuschauer sieht nie, dass jemand etwas entscheidet.
2. **Staffel** — 4,5 Tickerzeilen/Minute, bis 85 s ohne Banner, bis 22 s Stille, Bild steht 50 %.
   Die Puste-Reserve bindet praktisch nie (Median 88 % Rest). Echte Momente nur bei den 5 Wechseln.
3. **Hockey** — 7:50 Dauer, bis 88 s ohne Banner. Überzahl bringt fast keinen Vorteil (0,194 gegen
   0,196 Versuche/Sekunde) — eine Strafe kostet nichts, es fehlen Spannungsspitzen.
4. **Speed-Schach** — Bild steht 76 % der Zeit, Remis nur in 0,24 % der Partien.
5. **Tennis** — Bild steht 48 %, bis 54 s ohne Banner. Laut Fable gewinnt den Punkt nicht zwingend,
   wer den Ballwechsel besser spielt — das Spiel erzählt nicht, was man sieht.
6. **Time-Trial** — bis 23,5 s stehendes Bild, bis 17 s Stille. Einzelstart, lange fährt nur einer.
7. **Spurt** — bis 19 s Stille. Das Feld klebt als Säule an einem Hindernis, der Rest leer.
8. **Wettessen** — laut Fable erzählt die Mechanik nichts: zehn Minuten gleich gewürfelt, ohne
   Verlaufskurve, ohne „Mauer" (voller Magen), ohne Strategie.
9. **Mini-DM** — kein Kampfbild, nur schrittweise Ergebnisauflösung.

Dazu **Football**: Spielstand im Bild weicht vom Ergebnis ab; außerdem eine der fünf Disziplinen,
deren Ergebnis nicht aus der Arena-Simulation kommt (s. Befund B unten).

**Was fast überall fehlt, auch dort wo sich viel bewegt:** ein Entscheidungsmoment, der dem
Manager gehört. Genau da setzt Chris' Idee an.

## Teil 2: Risiko-Anweisungen für den Manager

### Drei Befunde, die vor dem Bau geklärt sein müssen

**A. „Pushen" gibt es schon, aber anders als Chris es meint.** Die Einsatzliste hat je
Disziplin-Seite eine Intensität Schonen/Normal/Pushen.
- In der Wertung ist das eine reine Mittelwertverschiebung: Pushen bringt +2 bis +6 Punkte,
  Schonen −3 bis −2 (`INTENSITY_SCORE_RANGE`). Pushen kostet ×1,4 Ermüdung. Einbrechen kann dabei
  niemand.
- Nach Code-Lesung kommt die Intensität in den 15 arena-ausgewerteten Disziplinen gar nicht an —
  die Übergabe trägt nur `{d, slot}` (`arena-kader-adapter.ts`), `STUFE` bleibt in der Engine auf
  `"normal"`. Dort kostet Pushen also nur Ermüdung/Verletzungsrisiko und bringt nichts. Im
  Mutator-Konzept vom 29.09. als „nicht nachgemessen" vermerkt — **noch nicht per Sonde bestätigt,
  nur aus dem Code gelesen.**

**Empfehlung:** Intensität bleibt der Hebel für die Kraftreserve über die Saison. Chris' Idee wird
eine zweite, eigene Achse: **Haltung = Absichern/Normal/Angreifen**, je Spieler und Disziplin.
Sonst gibt es zwei Knöpfe, die beide „Push" heißen. Die Übergabe an die Engine einmal um `haltung`
erweitern und dabei Formkarte/Intensität gleich mitnehmen — behebt den oben vermerkten Befund.

**B. „Während" geht nur als Wenn-dann-Anweisung, nicht live.** Der Spieltag wird headless berechnet,
alle Paarungen auf einmal — der Manager sieht sein eigenes Spiel nie (Fable Feldspiel 2.1). Ein
Live-Eingriff wäre Klasse T und passt nicht zur Auswertung. Was geht: eine **bedingte** Anweisung,
vorher gesetzt („Angreifen, wenn er nach dem Reißen hinten liegt"), ausgelöst in der Simulation,
sichtbar im Ticker („Anweisung greift: Cassandra geht auf 131 kg"). Braucht das Replay „Spiel des
Tages" (Klasse A, Fable 2.1) oder mindestens eine Anweisungsbilanz im Endstand.

**C. Mehrere Disziplinen leiten die Risikowahl heute schon aus dem Slot ab** (Time-Trial
`planJeSlot`, Kampf `SLOT_ZUSATZ`, Gewichtheben Slot „Pressure Lift" + ANSAGE-Kennzahl) — der
Hebel ist dort oft nur „Slot-Vorgabe überschreiben", keine neue Mechanik.

### Designregeln für alle 20 Disziplinen

1. **Normal ist bit-identisch.** Der Hebel verschiebt nur die *Entscheidung* (Zielgewicht,
   Rennplan, Schwelle), nie eine Attribut-Kennzahl oder die Matrix. Erfolgskurven und `rr()`-Zahl
   bleiben gleich — Vorher/Nachher-Messung bleibt sauber.
2. **Obergrenze im eigenen Korridor** (z.B. bestehender 106-%-Deckel beim Heben). Ein Schwacher
   kann sich übertreffen, springt aber nie über einen 15-Punkte-besseren — genau diese Paare
   sichern rho.
3. **Kein Knopf darf immer besser sein.** Angreifen lohnt im Schnitt nur bei hoher
   TECHNIK/NERVEN; im Duell lohnt Streuung dem Außenseiter (spieltheoretisch korrekt — passt zu
   Chris' Mehrwege-Gedanken aus der I-Spy-Konzeptrunde: der Schwächere bekommt eine echte Chance).
4. **Zusatzbelohnung außerhalb der gewerteten Summe** — beim Heben gemessen: nur ein Bonus *in*
   `summe` selbst drückt rho.
5. **Messpflicht:** rho, Paartreue mit Abstand, Pp-Abweichung ≤25, zwei unabhängige Saatstämme,
   KI-Vorgabe auf beiden Seiten plus Extremfall „alle Angreifen" (KI-Vorgabe deterministisch aus
   Kader, Muster `berechneFokusAuto`).

### Je Disziplin, nach Priorität

„Rho-Puffer" = aktuelle rho/Spiel (Ziel >0,80); viel Puffer = zusätzliche Streuung verkraftbar.

| # | Disziplin | Angreifen/Absichern bedeutet | Klasse | Aufwand | Rho-Puffer |
|---|---|---|---|---|---|
| 0 | **Grundgerüst** | Haltungsfeld in der Einsatzliste, Übergabe `{d,slot,haltung}` (dabei Formkarte/Intensität reparieren), KI-Vorgabe, Ticker-Zeile, Anweisungsbilanz. Idealerweise eine Anweisungs-Karte für alle Chassis, zusammen mit Task #32. | — | mittel | — |
| 1 | **Gewichtheben** (Pilot) | Angreifen: höhere Eröffnung/größere Sprünge (`ansage[u.id]`, `zuschlag` in `lastFuer()`), auch bedingt. Absichern: tiefe Eröffnung, kleine Sprünge, 3. Versuch keine Jagd. Gleiche Erfolgskurve über `risikoMax`, 106-%-Deckel bleibt. Isolationstest 06.09. (Zuschlag bis 20kg) war rho-flach. | B | klein | 0,843 |
| 2 | **6 Bühnen-Disziplinen** | Ein Zusatz `h·Δ` an `buehneErfolgschance`/`buehneWagnisFaktor`. Δ=±20 Wagnis-Punkte ≙ ±3pp Erfolg/±0,28 Bonusfaktor — innerhalb des am 26.09. kalibrierten Rasters. Ein Wurf/Runde. Beschriftung: Schach „Angriffsschach/solide", Tennis „Risiko-Aufschlag/sicher", Fechten „Angriff/Konter", Showcase „Wagnis-Act", Eiskunstlauf „Quad/sauber" (E-F3), Wettessen „Sprint/Pacing" (erst mit W-F1 „Mauer"). | B | klein | Schach 0,906 · Showcase 0,896 · Eiskunstlauf 0,878 · Wettessen 0,872 · Fechten 0,825 · Tennis 0,821 knapp (Δ halbieren) |
| 3 | **Time-Trial** | Manager wählt Plan je Fahrer (Gleichmaß/Negativ-Split/Attacke) statt Slot-Ableitung. Vorher „Ins Rote gehen" (Fable 1.2) bauen, sonst ist Negativ-Split eine tote Option. Später Kurven-Risiko aus #29. | B | klein | 0,929 (höchster) |
| 4 | **Staffel** | Anlaufmarke je Wechsel (`STAFFEL_ANLAUF_AB` 0,86): Angreifen = früher anlaufen (Zeitgewinn, Risiko `wechselStrafe`). Absichern = stehender Wechsel. Gelingen weiter über Wechsel-Kennzahl (Awareness/Dexterity/Charisma). | B | klein | 0,899 |
| 5 | **Spurt** | Angreifen senkt die Schwelle für Durchbruch-per-Wucht statt Ausweichen (kostet Puste). Gehört zu #29. | B | klein–mittel | 0,906 |
| 6 | **Takeshi's Castle** | Wie Spurt, Durchbruch statt Ausweichen. Visuell nachrangig, Sendung ohnehin zu laut. | B | klein | 0,874 |
| 7 | **Breaking** | Fable-Idee B5 als Anweisung: Angreifen = Ertragender provoziert, fordert nächstes Werkzeug früher. Vorbedingung: Speicherleck zuerst beheben (Fable B0). | B | klein–mittel | 0,833 |
| 8 | **Climbing** | Nur Schlussaktion: Sprung zur Uhr (Fable C1) erst auf Anweisung. Puffer knapp. | B | klein | 0,814 |
| 9 | **Hockey** | Härte je Verteidiger (Fable H-B): mehr Checks/Puckgewinne, höhere Strafquote. Erst sinnvoll, wenn Überzahl wirklich kostet (Fable T2). | B | klein, blockiert | 0,686, durchgefallen |
| 10 | **Basketball** | „Grünes Licht" für Schützen: mehr Distanzwürfe, sinkende Quote. Erster Schalter auf der Taktik-Karte (#32). | B | mittel | 0,769, knapp |
| 11 | **Football, I-Spy** | 4th-Down-Aggressivität bzw. „große Truhe". Wirkt erst, wenn über Arena ausgewertet (heute nicht). | B | mittel | nicht ausgewertet |
| 12 | **TDM, Battlefield, Mini-DM** | Befehl je Kämpfer überschreiben (Verfolgen=aggressiv, Decken=sicher). Mini-DM: Joker (Fable M-2) setzen. Nicht arena-ausgewertet, rho 0,3–0,4. | B | klein–mittel | durchgefallen |

**Klasse T:** jede Bedenkzeit/Live-Pause für den Knopf — davon rät diese Konsultation ab (s. Befund B).

**Die 5 nicht arena-ausgewerteten Disziplinen (Zeilen 11/12):** billigster Weg wäre, Pushen von
„+2 bis +6 sicher" auf ein breiteres Band mit Absturzrisiko umzustellen, abhängig von
Wille/Determination statt reinem Zufall — Klasse B in `lib/lineups`, mit Pp-Prüfung.

### Empfehlung

1. **Zuerst Chris fragen:** „Haltung" als eigene Achse neben Intensität, oder Intensität umdeuten?
   Danach Grundgerüst (Zeile 0) bauen.
2. **Pilot Gewichtheben** — Chris' eigenes Beispiel, Stelle im Code vorbereitet, rho bereits
   nachgemessen.
3. **Danach die eine Zeile für die 6 Bühnen-Disziplinen** — größte Wirkung pro Zeile Code.
4. **Dann Time-Trial und Staffel** — viel rho-Puffer, gerade die „stummen" Sendungen bekommen
   sichtbare Momente.
5. **Feldspiel und Arena-Kampf erst**, wenn deren eigene rho-Lücken geschlossen sind.

**Offene Prüfpunkte:**
- „Intensität/Formkarte kommen in der Arena nicht an" ist aus dem Code gelesen, nicht gemessen —
  vor dem Bau per Sonde bestätigen.
- Bei der Staffel nicht geprüft, ob der Wechsel heute über einen eigenen Zufallswurf entschieden wird.
