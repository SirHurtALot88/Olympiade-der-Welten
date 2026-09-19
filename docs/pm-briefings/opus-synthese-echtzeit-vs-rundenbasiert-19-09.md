# Opus-Synthese: Echtzeit-Fluss oder rundenbasiert? — Entscheidungsvorlage (19.09.)

**Auftrag von Chris (19.09.):** „ich möchte einfach ein cooles Spiel erschaffen, wo das
Auto-Battling auch beim Zuschauen Spaß macht" — und, ausdrücklich als Option und nicht als
Auftrag: „vielleicht, wenn das mit dem Flow und den Animationen nicht so gut läuft, gibt es ja
auch immer noch die Möglichkeit, das rundenbasiert zu machen, das würde Animationen etc.
vereinfachen." Dazu: „kannst du das mal mit Opus besprechen, ggf. Fable einschalten, und dazu zu
einer Empfehlung und einem Ergebnis kommen?"

Dies ist das Ergebnis. **Phase 1** ist Fables Analyse
(`docs/design/echtzeit-vs-rundenbasiert-analyse-19-09.md`, Branch
`analyse/echtzeit-vs-rundenbasiert-19-09`) — reine Bestandsaufnahme, keine Empfehlung. **Phase 2**
ist dieses Dokument: die Empfehlung. Es ändert **keine Zeile Produktionscode**.

**Stand beim Schreiben:** `main` = `d85ab462` (17.09., nach PR #964). Alle Zeilenangaben ohne
Dateinamen beziehen sich auf `public/mockups/battle-mode.engine.js` in diesem Stand.

---

## 0. Die Antwort

> **Nein — das Spiel wird nicht rundenbasiert. Aber EINE der vier Bauarten schon, und zwar die
> Arena, als gemessener Pilot neben dem bestehenden Motor.** Bahn, Feldspiel und Bühne behalten
> ihr Zeitmodell unverändert. Chris' Bauchgefühl ist richtig — aber es ist an genau einer Stelle
> richtig, und dort ist es sehr richtig.

Die Begründung in fünf Sätzen:

1. **Das Spiel hat heute nicht ein Zeitmodell, sondern zwei**, sauber entlang der Chassis-Grenze
   (Fable, Abschnitt 1 — von mir am Code nachgeprüft). Eine Pauschalentscheidung „Echtzeit ODER
   Runden" gibt es deshalb gar nicht zu treffen.
2. **Drei der vier Chassis funktionieren beim Zuschauen**, und wo sie es nicht taten, hat
   **Regie** geholfen (Spotlight, Broadcast-HUD, Perioden-Beats) — nie eine Änderung am Takt.
3. **Die Arena ist die Ausnahme, und sie ist es aus einem strukturellen Grund**, den ich in
   Abschnitt 3 benenne und der bisher in keinem Dokument zusammenhängend stand: in
   kontinuierlicher Zeit wird der **Beitrag eines Kämpfers von Tempo und Ausdauer bestimmt — und
   genau diese beiden Kampfwerte sind als einzige nicht auf die Eignung normiert** (`:5183-5203`).
   Wer schnell ist, kauft sich unbepreist Einfluss. Das ist die Ursache der schlechtesten
   Rangtreue im ganzen Projekt, und sie ist im Echtzeitmodell nachweislich nicht reparierbar.
4. **Ein Rundenmodell schließt genau diesen Kanal durch Konstruktion** — bei „jeder handelt
   einmal je Runde" ist die Zahl der Schläge keine Funktion des Tempos mehr. Es gibt dafür eine
   gemessene Blaupause im eigenen Repo: **Fechten sprang beim Wechsel vom Arena-Chassis auf das
   (rundenbasierte) Bühnen-Chassis von rho 0,153 auf 0,840.**
5. **Alles andere anzufassen wäre teuer und falsch**: es kostete 13 bestandene Disziplinen ihre
   Basislinie, der Bahn ihr Genre und dem Feldspiel seinen nachweislich besseren Motor — und es
   berührte die Fehler nicht, die die Reviews wirklich verlängern.

### 0.1 Was konkret passiert, in dieser Reihenfolge

| | Auftrag | Zeitmodell? | Aufwand | Risiko | Wer profitiert |
|---|---|---|---|---|---|
| **A0.1** | Requisiten-Hook **vor** die Vollbild-Weiche in `zeichneSprite()` | nein | klein, 1 PR | sehr gering | **Zuschauer** (Heber stemmt heute Luft) |
| **A0.2** | Deterministischer Sonden-Modus für Screenshots | nein | klein, 1 PR | sehr gering | Reviews (zahlt sich in jeder Folge-PR zurück) |
| **A1** | **Mini-DM als Rundenprototyp — NEBEN dem bestehenden Motor** | **ja, Pilot** | mittel, 1 Runde | gering (nichts Produktives wird angefasst) | **Zuschauer + Rangtreue** |
| **A2** | *Nur bei bestandener Messung:* TDM + Battlefield nachziehen, Präsentation als Clips | ja | mittel–groß | mittel | Zuschauer + Rangtreue |
| **A3** | Die **gebuchte Saat** durch den Host reichen | nein | klein, 1 PR | gering | Ehrlichkeit (heute sieht Chris ein anderes Spiel als das gebuchte) |

**Nicht angefasst:** Bahn (5), Feldspiel (3), Bühne (9). Kein flächendeckendes R4-Programm.

---

## 1. Was ich nachgeprüft habe — und wo ich Fable widerspreche

Fables Analyse ist solide. Ich habe die tragenden Stellen selbst gelesen, nicht übernommen:

| Behauptung (Phase 1) | nachgeprüft | Ergebnis |
|---|---|---|
| Vier Chassis, zwei Zeitmodelle | `loop()` mit `acc+=dt*speed`, `while(acc>=1/60)stepSim((1/60)/zf)` | **bestätigt**, wortgleich |
| `stepSpurt` ist echte Tick-Physik | `:24774` ff.: `u.pos+=u.v*dt/strecke`, `rr()<(0.25+WENDIGKEIT*0.009)*dt*3` | **bestätigt** |
| Arena praktisch zufallsfrei | Bereich `:18962-24203` selbst durchgezählt: **genau 2** lebende `rr()`-Aufrufe (Fernkampf-Streuung), 6 weitere Treffer sind Kommentare | **bestätigt**, exakt |
| `chooseTarget` rein geometrisch/deterministisch | `:19457` ff., „Keine Würfe, kein Zufall" | **bestätigt** |
| Host reicht keine Saat durch | `grep -in 'saat\|seed' FoundationBattleArenaHost.tsx` → **null Treffer** | **bestätigt** |
| Bühne = Auto-Advance über vorgerechnete `runden[]` | `stepBuehne()` `:13694` ff., Queue + `rundenDauer` | **bestätigt** |
| Arena-Rangtreue 0,387 / 0,253 / 0,094 | `stand-aller-disziplinen.md:231-233` | **bestätigt** |

**Wo ich Fable widerspreche — und es ist der Punkt, an dem die Empfehlung hängt.**

Fable schreibt in Abschnitt 3.4 als „ehrliche Gegenrechnung": *„Fechtens Sprung kam vor allem aus
der Bühnen-Punkteformel, nicht aus ‚diskret'."* Das ist eine Vermutung, und ich halte sie für
falsch. Abschnitt 3 zeigt, dass der Sprung genau aus „diskret" kam — genauer: aus der
**Gleichverteilung der Gelegenheit**, die ein diskretes Modell erzwingt. Das ist kein
akademischer Unterschied: an ihm hängt, ob ein Arena-Rundenmotor eine begründete Erwartung hat
oder nur ein Versuch ins Blaue ist.

Und ich **verschiebe Fables Prioritäten**. Fable nennt die Trennung von Simulation und
Präsentation (R4) den „größten Hebel" und die Arena den zweitgrößten. Beide Hebel sind real, aber
Chris hat nicht nach Wartbarkeit gefragt, sondern nach Zuschauer-Spaß. R4s Nutzen ist zu zwei
Dritteln Entwickler-Nutzen (Verifikationsentlastung, sichtbarer Lauf = gebuchter Lauf); nur der
Highlights-Modus ist Zuschauer-Nutzen, und der zahlt erst, wenn viele Spieltage geschaut werden.
Deshalb: **Arena zuerst, R4 als Richtung statt als Programm** — und zwar dort geerntet, wo es
ohnehin anfällt (ein Rundenmotor schreibt sein Protokoll von selbst, Abschnitt 5.3).

---

## 2. Die eigentliche Achse heißt nicht „Echtzeit oder Runden"

Bevor man über Takt redet, lohnt die Frage, was Zuschauen überhaupt trägt. Fünf Dinge (Fable
Abschnitt 5, aus den Recherchen dieses Repos): Lesbarkeit, Spannungsbogen, Kausalität, Dosierung,
Broadcast-Rahmung. Ich ziehe daraus eine Größe heraus, die alle anderen dominiert:

> **Ein Bild braucht ein Subjekt.** In jedem Augenblick muss es genau eine Sache geben, auf die
> das Auge gehört. Alles andere — Spannung, Kausalität, Rhythmus — hängt daran. Ein Bild ohne
> Subjekt ist nicht „zu schnell"; es ist unlesbar, egal wie langsam man es dreht.

Und jetzt der Befund, der die ganze Frage ordnet:

| Chassis | Woher das Subjekt kommt | von selbst da? |
|---|---|---|
| Bühne (9) | die **Warteschlange** — es ist immer genau einer dran (`buehneQueue`, `:13704`) | **ja, durch Konstruktion** |
| Bahn (5) | die **Spitze und der Abstand** — ein Rennen hat einen Führenden | **ja, durch Konstruktion** |
| Feldspiel (3) | der **Ball** | **ja, durch Konstruktion** |
| **Arena (3)** | — **nichts.** Keine Queue, kein Ball, kein Ziel. Zwölf Figuren schlagen gleichzeitig. | **nein** |

**Das erklärt Chris' Rückmeldungen der letzten Wochen vollständig**, und zwar besser als jede
Takt-Erklärung. Seine Kritik lautete nie „zu langsam" und nie „zu wenig Bewegung" — sie lautete
jedes Mal „ich weiß nicht, wohin ich schauen soll" oder „ich sehe nicht, wer gewinnt":

- „sehr schnell und unübersichtlich" (06.09.)
- „ich weiß nicht ob alle gleichzeitig sinnvoll ist UND man hat gar keine Indikation welche Leute
  sich gerade besser schlagen" (13.09., Eiskunstlauf)
- „die charaktere suchen sich anscheinend einen gegner und hauen drauf aber es gibt gar nicht ne
  dynamik" (13.09., TDM — wörtlich im Code bei `:4575-4578`)

Und jedes Mal, wenn das Subjekt **nachgereicht** werden konnte, hat es funktioniert — **ohne das
Zeitmodell anzufassen**: Spotlight und Startreihenfolge beim Eiskunstlauf, Broadcast-HUD und
Führungsanzeige bei der Staffel, Perioden-Beats und Viertelpausen beim Feldspiel, Fokusbrett beim
Schach. Das ist der Beleg dafür, dass „Flow und Animationen laufen nicht gut" bisher **kein
Taktproblem** war.

**Die Arena ist der eine Ort, an dem Regie nichts zu greifen hat.** Man kann keine Kamera auf „den,
der gerade dran ist" richten, wenn zwölf Figuren gleichzeitig dran sind. Das ist auch schon
versucht worden: der Zeichencode trägt einen eigenen Absatz darüber, dass ein 1,5-px-Teamring
„im dichten Getümmel neben Sprite und Beschriftung unterging und man raten musste, wer zu wem
gehört", und ersetzt ihn durch gefüllte Teamflächen. Es ist besser geworden und immer noch
Gewusel. **Ein Rundenmodell erzeugt das Subjekt durch Konstruktion** — es ist in der Arena nicht
nur eine Animationsvereinfachung, sondern die einzige Quelle für ein Subjekt, die es dort gibt.

---

## 3. Warum die Arena strukturell scheitert — der Mechanismus

Dies ist der Kern dieser Synthese. Drei Tatsachen stehen im Repo an drei verschiedenen Stellen und
sind dort nie zusammengeführt worden. Zusammen ergeben sie eine vollständige Erklärung.

**Tatsache 1 — was in der Arena „Leistung" heißt, ist Durchsatz.** (`:20610`)

```js
const beitragVon=(u)=>u.st.dmg+u.st.heal+u.st.schild+u.st.verh*0.4+u.st.koAnteil*140;
```

und `MOTOREN[ad].wert()` ist `beitragVon(u)/Gesamtbeitrag*100` (`:28680`). Jede dieser Größen ist
eine **Mengengröße**: sie wächst mit der Zahl der ausgeführten Aktionen.

**Tatsache 2 — in kontinuierlicher Zeit wird die Zahl der Aktionen von Tempo und Ausdauer
bestimmt.** Ein Schlag fällt, sobald `inRange && u.cd<=0`; wie oft das geschieht, hängt an der
Schlagfrequenz (TMP) und daran, wie lange jemand durchhält (AUS).

**Tatsache 3 — und das ist die Stelle, an der es bricht: `aufEignung()` normiert TMP und AUS als
einzige NICHT auf die Eignung.** (`:5183-5203`, wörtlich aus dem Code)

> „`aufEignung()` normiert LP, ANG und VER auf die Eignung; **TMP und AUS nicht**. Ein Attribut,
> das dort steht (im TDM: Speed 46, Dexterity 24, **beide Matrixgewicht 0**), bekommt dadurch
> einen **Gewinn ERSTER ORDNUNG** in der `einflussVon()`-Messung. […] Die Messung zeigt weiterhin
> richtig, dass TMP/AUS außerhalb der Normierung liegen und Speed/Dexterity dort **unbepreist
> Einfluss kaufen** — das bleibt ein echter struktureller Befund."

Zusammengesetzt ergibt das:

> **Die Arena bewertet Durchsatz. Durchsatz wird in kontinuierlicher Zeit von TMP/AUS gekauft.
> TMP/AUS hängen nicht an der Eignung — in TDM tragen sie sogar Attribute mit Matrixgewicht
> NULL. Also misst die Arena systematisch etwas anderes als die Eignung. Das ist keine
> Ungenauigkeit, das ist ein Validitätsfehler durch Konstruktion.**

Und weil die Arena **fast zufallsfrei** ist (2 `rr()`-Aufrufe, selbst nachgezählt), mittelt sich
das über Spiele **nicht** heraus. Es ist systematisch, nicht verrauscht. Genau das sagen die
Zahlen: nach der Zwei-Spalten-Regel aus CLAUDE.md sind bei TDM **beide** Werte niedrig (0,253 je
Spiel / 0,217 Saison) — „belohnt die Mechanik das Falsche", ein Validitätsproblem. Kein
Ereignisproblem. Keine Uhr kann das heilen.

### 3.1 Der Beweis, dass es im Echtzeitmodell nicht reparierbar ist

Das ist keine Vermutung. Es ist **sechsmal versucht worden**, alles dokumentiert:

| Versuch | Ergebnis | Fundstelle |
|---|---|---|
| Voller TDM-Rezept-Neubau | 168 Pp — **schlechter** | Kommentar bei `ARENA_ART.tdm`, `:5261-5284` |
| Gezielte Korrektur der größten Messlücken | 83 Pp — **schlechter** | ebd. |
| Zwei ANG/VER-Sorten | 114,5 / 58,9 Pp bei n=6; bei n=12 dann 57,9 — **ununterscheidbar vom Nichtstun** | ebd. |
| Maßstabswechsel auf „Anteil am Gesamtbeitrag" | half Battlefield/Fechten, **TDM blieb bei 54,2 Pp** | `:28640-28676` |
| Zielwahl nach Archetyp, Front/Backrow (PR #912) | Rangtreue unverändert durchgefallen | Commit `9f311bac` |
| Zielwahl auf „bedrohung" + TrinityCore-Hysterese, zwei Varianten | „bewegen TDM praktisch nicht und **verschlechtern** Mini-DM/Battlefield" — **nicht committet** | Commit `bbadeb2f` |

Und die Engine zieht selbst den Schluss, den ich hier nur wiederhole — im Kommentar bei
`ARENA_ART.tdm`:

> „TDM bleibt damit die einzige der drei Zieldisziplinen über 15 Pp — offener Befund für eine
> nächste Runde, die vermutlich **am Chassis (`aufEignung`/TMP-AUS-Normierung) ansetzen müsste
> statt an den Rezeptgewichten**."

Und `stand-aller-disziplinen.md` (Abschnitt 3, bei Fechten) ebenso:

> „der Grund war, wie sich erst am 03.09. zeigte, nicht mehr diese Lücke, sondern **das
> Arena-Chassis selbst**."

**Die naheliegende Reparatur ist außerdem bereits probiert und verworfen worden.** Man hat TMP/AUS
testweise mit in die Normierung genommen: die Messabweichung fiel von 152,4 auf 83,7 Pp, Speed und
Dexterity lasen sauber 0 % — aber am echten Kampf „wurde aus einem Sieg ein Blowout" (23 von 24
Kämpfen 6:0), weil die Kappung der KI die Bewegungsfreiheit nahm. Zurückgenommen. **Im
Echtzeitmodell kann man den Kanal nur schließen, indem man den Kampf kaputtmacht.**

### 3.2 Warum ein Rundenmodell genau diesen Kanal schließt — ohne Kappung

In einem Rundenmodell handelt **jede lebende Einheit genau einmal je Runde**. Damit ist die Zahl
der Aktionen keine Funktion des Tempos mehr; TMP wird höchstens zum **Reihenfolge**-Kriterium
(Initiative), nicht zum Mengen-Kriterium. Der unbepreiste Kanal schließt sich **durch
Konstruktion** — ohne dass irgendein Wert gekappt wird, also ohne den Blowout-Effekt. Was dann
noch differenziert, ist die **Güte je Aktion** (ANG/VER/LP — alle drei auf die Eignung normiert)
und das **Überleben** (mehr Runden am Leben = mehr Aktionen, ebenfalls eignungsgetrieben).

### 3.3 Die Blaupause ist gemessen, nicht erhofft

**Fechten.** Dieselbe Kampf-Disziplin, gewechselt vom Arena-Chassis auf das rundenbasierte
Bühnen-Chassis (`stand-aller-disziplinen.md:297`):

| | rho je Spiel | rho Saison |
|---|--:|--:|
| Fechten auf dem **Arena**-Chassis (kontinuierlich) | 0,153 | 0,378 |
| Fechten auf dem **Bühnen**-Chassis (rundenbasiert) | **0,840** | **0,874** |

Auf der Bühne bekommt jeder Fechter **genau `rundenN` Versuche** — die Gelegenheit ist durch
Konstruktion gleich, TMP/AUS können keinen Einfluss kaufen. Die Vorhersage aus Abschnitt 3.2 und
das Ergebnis dieses natürlichen Experiments stimmen überein. **Das ist der Grund, warum ich
Fables Vorbehalt („es lag an der Punkteformel") widerspreche**: die Punkteformel hat sich
mitgeändert, aber sie erklärt nicht, warum ausgerechnet die Gelegenheitsgröße verschwand.

### 3.4 Die Gegenprobe: Battlefield hat den Kanal halb geschlossen — und ist die beste der drei

Dieser Befund steht ein **drittes** Mal im Code, an ganz anderer Stelle, und er liefert
zufällig die Gegenprobe. Im Kommentar bei `ARENA_ART.battlefield` (`:5332-5345`):

> „Der Grund ist kein Zufall, sondern eine **Eigenschaft des Modells**: `aufEignung()` normiert
> LP, ANG und VER auf die Eignung — TMP und AUS nicht. Wer ein Attribut dorthin setzt, gibt ihm
> einen **Bonus ERSTER ORDNUNG**, völlig unabhängig davon, was die Matrix dazu sagt. Ich hatte
> ausgerechnet die beiden schwächsten Attribute der Matrix in die Ausdauer gesetzt. […] Jetzt
> tragen **die schweren Attribute auch Tempo und Ausdauer**."

Battlefield hat den Kanal also nicht geschlossen, sondern **umgeleitet**: TMP/AUS wurden mit
denselben schweren Attributen befüllt wie der Rest, damit der unbepreiste Einfluss wenigstens in
die richtige Richtung zieht. Und das Ergebnis ist genau, was Abschnitt 3 vorhersagt:

| | TMP/AUS gegenüber der Matrix | rho je Spiel |
|---|---|--:|
| **Battlefield** | schwere Matrix-Attribute tragen TMP/AUS mit — Kanal **umgeleitet** | **0,387** (beste der drei) |
| **TDM** | Speed 46, Dexterity 24 — **beide Matrixgewicht 0**, Kanal voll offen | 0,253 |
| **Mini-DM** | Kanal offen **und** nur 4 Solo-Kämpfer, also keinerlei Ausmittelung innerhalb einer Partie | 0,094 |

Die Rangfolge der drei schlechtesten Zahlen im Projekt folgt damit exakt dem Grad, in dem der
unbepreiste TMP/AUS-Kanal offen steht. Das ist der dritte unabhängige Beleg für denselben
Mechanismus — und der Hinweis darauf, dass die Umleitung (Battlefields Weg) nur ein Pflaster ist:
sie hebt 0,387, nicht 0,80. **Geschlossen wird der Kanal erst durch ein Modell, in dem die Zahl
der Aktionen nicht mehr vom Tempo abhängt.**

---

## 4. Warum die anderen drei Chassis unangetastet bleiben

| Chassis | Warum nicht |
|---|---|
| **Bahn (5)** | Kontinuität **ist** der Inhalt: Windschatten, Überholen, Zieleinlauf. Chris hat ausdrücklich das Gegenteil bestellt: „spurt sollte ca 3 minuten dauern damit man sich das auch in ruhe angucken kann und **kleine unterschiede erkennt**" — kleine Unterschiede zwischen nebeneinander laufenden Figuren sind genau das, was diskrete Zustände nicht zeigen. Vier von fünf stehen über 0,80 (Staffel 0,915, Spurt 0,894, Takeshi 0,883, Time-Trial 0,828), Climbing seit 16.09. bei 0,834. **Reines Risiko ohne Zuschauer-Nutzen.** |
| **Feldspiel (3)** | Der Wechsel **von** vorab-berechnet **auf** live hat die Rangtreue **verbessert** (Football 0,345 → 0,516 je Spiel, 0,699 → 0,811 Saison). Ein Rundenmodell wäre die Rückkehr zum schlechter gemessenen Motor — und Basketball ist die einzige Disziplin mit eigenem Boxscore-Impact im echten Spielstand. Der Raum ist hier der Inhalt: ein Steal ist nur lesbar, wenn man den Passweg sieht. |
| **Bühne (9)** | **Ist in der Ergebnislogik bereits rundenbasiert** — `bauBuehne()` rechnet alle Durchgänge vorab, `stepBuehne()` enthüllt sie getaktet. Es gibt nichts umzustellen. „Noch rundenbasierter" hieße nur, die kontinuierliche Zierde wegzunehmen — und das ist der Zustand vor dem 10.09., den Chris selbst als „nur Rumstehen" kritisiert hat. **Ein gemessener Rückschritt.** 8 von 9 bestanden. |

**Zur Ehrlichkeit gehört der Umfang der bisherigen Investition:** 20 Disziplinen, zwölf davon über
der Schranke, sechs frisch abgenommene Bewegungsmaschinen seit dem 10.09., dazu die
Broadcast-Rahmung. Eine Pauschalumstellung entwertete das, müsste **13 bestandene Disziplinen neu
kalibrieren** und ließe die Fehler unberührt, die die Reviews wirklich verlängern (Abschnitt 6).
Das ist kein knapper Abwägungsfall — das wäre der teuerste denkbare Schritt bei negativem
erwartetem Ertrag.

---

## 5. Der Umsetzungsplan

### 5.0 A0 — zwei kleine Runden vorweg, unabhängig vom Zeitmodell

**A0.1 — Requisiten-Hook vor die Vollbild-Weiche (`zeichneSprite()`).** `zeichneSprite()` kehrt
für `b.reiherMech` (`:3359`) und `b.vollbild` (`:3398`) **früh zurück**; alles, was danach im
Normalpfad gezeichnet wird — Waffen, Requisiten, Effekte — sehen diese Blätter nie. Sichtbare
Folgen heute: „5 von 17 Figuren … stemmt genau ein Heber Luft", „Vorrak — kein Bogen sichtbar",
„Terradon — kein Schwert". **Das ist kein Entwickler-Thema, das sieht Chris.** Der Weg ist schon
begonnen (`hantelAnPunkt`, `:2975-2980`): den Requisiten-Aufruf **vor** die Weiche ziehen bzw.
eine Requisiten-Tabelle, die jeder Zweig liest. **Dieser Fehler bestünde in einem Rundenmodell
wortgleich weiter** — er ist deshalb vorzuziehen, nicht nachzuordnen.

**A0.2 — Deterministischer Sonden-Modus für Screenshots.** Das Screenshot-Rauschen kommt aus der
**Wanduhr-Kopplung** von `loop()` (`acc+=dt*speed`; wie viele Sechzigstel bis 1500 ms gelaufen
sind, streut um ±1–2 Ticks), aus den Schwebetexten, die **je Bild** statt je Tick laufen, und aus
drei Stellen, die `performance.now()` direkt lesen. Fix: ein Modus, der N Ticks fest fährt und
dann genau einmal `draw()` ruft — `lauf()` und `draw()` sind beide vorhanden, der Kern ist also
schon da — plus Simulationszeit statt `performance.now()`. Das nimmt jeder künftigen Sicht-QA die
Baseline-gegen-Baseline-Kontrollmessung.

### 5.1 A1 — der Pilot: **Mini-DM** als Rundenprototyp, neben dem bestehenden Motor

**Warum Mini-DM und nicht TDM:**

1. **Kleinster möglicher Prototyp** — 4 Kämpfer (`jeSeite:4`, im FFA vier Solo-Kämpfer) statt 12.
2. **Nichts zu verlieren** — 0,094 je Spiel ist der schlechteste Wert im ganzen Projekt.
3. **Reinster Test der Hypothese** — keine Formation, keine Front/Backrow, keine Flankenfreigabe,
   die das Ergebnis mitverursachen könnten. Nur Gelegenheit gegen Eignung.
4. **Das Messwerkzeug existiert schon und ist exakt die Blaupause:**
   `scripts/miss-mini-dm-ffa-rangtreue.mjs` vergleicht bereits **zwei Chassis-Varianten
   nebeneinander mit derselben rho-Formel**, kaderfest, aus demselben 17-köpfigen Testkader. Es
   ist genau für diese Art Frage gebaut worden („ob vier unabhängige Solo-Runden Mini-DMs
   Rangtreue tatsächlich heben — **nachmessen, nicht annehmen**").

**Wie der Prototyp gebaut wird — die entscheidende Bauregel:**

> **Als NEUER Motor neben dem alten, nicht als Änderung am alten.** Ein zusätzlicher
> `MOTOREN`-Eintrag (z. B. `"mini-dm-runden"`) mit eigenem `bau/lauf/namen/wert`. Die drei
> produktiven Arena-Disziplinen bleiben **Byte für Byte unangetastet**.

Damit ist die CLAUDE.md-Kernregel nicht nur eingehalten, sondern **trivial nachweisbar**:
`node scripts/miss-alle-disziplinen.mjs 24` muss bit-identisch bleiben, weil an keiner gemessenen
Disziplin eine Zeile steht. Kein Basislinien-Nachzug, kein CI-Schrankenrisiko.

**Was der Rundenmotor wiederverwendet — und was nicht:**

| Wiederverwenden, **unverändert** | Neu |
|---|---|
| `rohKraft()`, `aufEignung()` — dieselben Kampfwerte | Initiative-Reihenfolge (aus TMP, **nur Reihenfolge**) |
| `chooseTarget()` samt `PERSZIEL`/Persönlichkeiten | „eine Aktion je lebender Einheit je Runde" |
| Schadensformel, Schild/Heilung/K.o.-Anteil | Rundenprotokoll (fällt von selbst an, s. 5.3) |
| `beitragVon()` und `wert()` als Maßstab | — |

Das ist Absicht: **nur eine Variable ändert sich — die Verteilung der Gelegenheit.** Wenn rho
steigt, ist die Hypothese aus Abschnitt 3 bestätigt und nichts anderes kann es gewesen sein. Wenn
sie nicht steigt, ist sie widerlegt, und wir haben es für den Preis eines Prototyps erfahren.

**Die Messhürde — hart, und sie ist nicht verhandelbar:**

`stand-aller-disziplinen.md` Abschnitt 5.1 warnt ausdrücklich: alle drei Arena-Zahlen haben sich
zwischen dem 04. und 06.09. **ohne jede Mechanikänderung** bewegt (TDM 0,113→0,253, Mini-DM
0,269→0,094, Battlefield 0,325→0,387), bei einer **Kader-Spannweite, die größer ist als der eigene
Median** (Mini-DM: Median 0,094, Spannweite 0,697). Nach der projekteigenen Faustregel ist das
Kaderrauschen, kein Befund.

> **Gate: n ≥ 96–150 Runden je Kadervariante, kaderfest über die fünf Paarungen, Median UND
> Spannweite ausgewiesen. Ein Ergebnis zählt nur, wenn die Bewegung größer ist als die
> Spannweite.** Eine 24er-Messung kann hier grundsätzlich nichts beweisen — weder Erfolg noch
> Misserfolg.

**Erwartung, damit man hinterher nicht nachträglich umdeutet:** Wenn die Hypothese stimmt, sollte
Mini-DM deutlich springen — die Größenordnung von Fechten (0,153 → 0,840) ist der Vergleichsfall.
Ein Ergebnis unter 0,50 wäre eine Widerlegung, kein „Teilerfolg".

### 5.2 A2 — nur bei bestandener Messung: TDM und Battlefield nachziehen

Erst dann, und dann mit der Präsentation zusammen: eine Aktion = ein Clip mit Anfang und Ende,
Kamera auf die handelnde Einheit, Ticker-Zeile je Aktion. Die Zielansage (`KFOKUS`) wird vom
Echtzeit-Eingriff zur **Ansage je Runde** — das passt besser als heute, und die vorhandene Sperre
„in Kampfzeit, nicht in Echtzeit" (`:20092-20094`) wird dabei zur Rundensperre.

**Ehrliche Gegenrechnung zu A2:** 6 gegen 6 sind je Runde zwölf Aktionen; bei 10–15 Runden sind
das 120–180 Clips. Das ist die Eiskunstlauf-Größenordnung (144 Enthüllungen) und **braucht
dieselbe Regie** — Fokus auf das Duell, das gerade zählt. Sonst wird aus dem Gewusel ein Log, das
durchrattert, und Chris hat dieselbe Kritik in anderer Form zurück. Ein Rundenmotor liefert das
Subjekt; er liefert nicht automatisch die Regie.

Verloren gehen außerdem das Formations-Gedränge als Bild und ein Teil des Zielwahl-/
Formationscodes aus PR #912. Das ist bei 0 von 3 bestandenen Disziplinen vertretbar — aber es ist
ein echter Verlust und kein Nullposten.

### 5.3 A3 — die gebuchte Saat durch den Host reichen

Heute rechnet die Produktion den Spieltag headless zu Ende (`lib/battle/arena-headless-runner.ts`,
`M.bau(saat); M.lauf(); M.wert()`), und der Host reicht Kader, Aufstellung und Anzeige-Meta durch
— **aber keine Saat** (selbst nachgeprüft: null Treffer für `saat`/`seed` in
`FoundationBattleArenaHost.tsx`). **Was Chris zuschaut, ist nicht das Spiel, das gezählt hat.**
Für Bahn und Arena wäre es das selbst bei gleicher Saat nicht, weil `ZEIT_DEHNUNG` die Ticks
anders teilt (der Code benennt die Folge selbst: Staffel 170,3 s statt 180 s).

Das ist heute eine stille Lücke, unabhängig von der ganzen Zeitmodell-Frage, und sie ist klein zu
schließen. Sie ist zugleich der billigste sinnvolle Teil von R4.

**Zu R4 im Übrigen:** Ich empfehle es als **Richtung**, nicht als Programm. Ein
Ereignisprotokoll + Abspieler ist strukturell richtig (die Präsentation kann den Motor dann nicht
mehr erreichen, die bit-identische Nachmessung entfiele für Präsentations-PRs), aber ein
flächendeckender Umbau über vier Chassis ist ein großes Architekturprojekt mit überwiegend
Entwickler-Nutzen. **Geerntet wird es dort, wo es ohnehin anfällt:** ein Rundenmotor schreibt sein
Protokoll von selbst (eine Runde = eine Liste von Aktionen), also bringt A1 die Arena-Variante von
R4 gratis mit. Die Bühne wäre der nächste fast geschenkte Kandidat (`u.runden[]` + `buehneQueue`
**sind** bereits ein Protokoll) — aber erst, wenn jemand den Nutzen konkret braucht, nicht auf
Vorrat.

---

## 6. Aufwand, Risiko, Nutzen — ehrlich gegen den Status quo

| Auftrag | Aufwand | Risiko | Erwarteter Zuschauer-Gewinn |
|---|---|---|---|
| A0.1 Requisiten-Hook | 1 PR, klein | sehr gering (Zeichenpfad, kein `wert()`) | **direkt sichtbar** — Requisiten erscheinen, wo heute Luft ist |
| A0.2 Sonden-Modus | 1 PR, klein | sehr gering (nur Sondenpfad) | indirekt — kürzere Reviews, mehr Runden je Zeit |
| A1 Mini-DM-Prototyp | **1 Runde** (Motor + Messskript + Bericht), vergleichbar mit der Mini-DM-FFA-Runde vom 06.09. | **gering** — kein produktiver Code angefasst, Basislinien unbewegt | noch keiner (Prototyp), aber **die Entscheidungsgrundlage für A2** |
| A2 TDM/Battlefield + Clips | 2–3 PRs Motor + 1–2 Präsentation | **mittel** — drei Disziplinen neu kalibriert, Formationscode teils entwertet | **hoch, wenn A1 trägt** — Subjekt im Bild, Lesbarkeit, plausibel erstmals rho über 0,80 |
| A3 Saat durchreichen | 1 PR, klein | gering | mittelbar — das gesehene Spiel ist das gezählte Spiel |

**Was passiert, wenn A1 scheitert?** Dann ist die Hypothese aus Abschnitt 3 widerlegt, A2 fällt
ersatzlos aus, und es wurde **kein produktiver Code angefasst** — der Preis ist eine Runde. Der
Rückfallplan ist dann der Fechten-Weg in seiner anderen Lesart: die Arena-Disziplinen auf ein
bestehendes, funktionierendes Chassis umziehen, statt ein viertes zu bauen. Das ist ausdrücklich
kein Drama; es ist der Grund, warum der Pilot klein und neben dem Bestehenden gebaut wird.

**Und die Gegenprobe zum Nichtstun:** Chris' Sorge ist begründet, und sie wegzuwischen wäre
falsch. Die Arena steht seit Wochen bei 0/3, nach **sechs** dokumentierten Anläufen innerhalb des
Echtzeitmodells, von denen jeder entweder schlechter oder ununterscheidbar war. Die Engine selbst
schreibt, dass der nächste Anlauf „am Chassis ansetzen müsste statt an den Rezeptgewichten". „Wir
machen weiter wie bisher" heißt für die Arena: eine siebte Rezeptrunde mit derselben Aussicht.
**Das ist die Option mit dem schlechtesten Erwartungswert von allen.**

---

## 7. Wie die Rangtreue-Regel gewahrt bleibt

CLAUDE.md: Präsentation darf `wert()`/`rr()`/Ergebnislogik nicht berühren; Abnahme ist rho je
Spiel über 0,80, kaderfest, bit-identisch nachgemessen.

| Auftrag | Motor angefasst? | Nachweis |
|---|---|---|
| A0.1 | nein (`zeichneSprite()` liest nur) | `miss-alle-disziplinen.mjs 24` bit-identisch |
| A0.2 | nein (zusätzlicher Sondenpfad) | dito |
| **A1** | **nein an produktiven Disziplinen** — neuer `MOTOREN`-Eintrag daneben | dito, trivial: an keiner gemessenen Disziplin steht eine Zeile |
| A2 | **ja**, drei Disziplinen | neue Basislinie für TDM/Mini-DM/Battlefield, kaderfest, n ≥ 96–150, `data/generated/rangtreue-basislinie.json` nachziehen. **Die übrigen 17 müssen bit-identisch bleiben** — das ist die Abnahmebedingung der PR. |
| A3 | nein (Host reicht einen Parameter durch) | Motor unverändert; zu prüfen ist nur, dass der Host keine andere Disziplin/Aufstellung liefert |

Ein Punkt, den A2 nicht übersehen darf: die Messgrundlage muss **dieselbe** bleiben (kaderfest,
Median über fünf Paarungen, `messgrundlage-kaderfest.md`), sonst ist die neue Zahl mit der alten
nicht vergleichbar — und genau diese Vergleichbarkeit ist der einzige Grund, den Prototyp
überhaupt zu bauen.

---

## 8. Offene Fragen an Chris

Vier Fragen, keine davon blockiert A0 oder A1:

1. **Zuschau-Dosierung.** Football Manager bietet „Key Highlights / Extended / Full". Willst du je
   Spieltag alles sehen, oder nur die Höhepunkte? Die Antwort entscheidet, wie viel Protokoll R4
   später wirklich braucht — und sie ist für den Spaß bei 160 Partien je Saison vermutlich
   wichtiger als das Zeitmodell.
2. **Arena-Tempo im Rundenmodell.** Wie lange soll ein TDM-Kampf dauern? Bei 120–180 Clips ist das
   die Regiefrage aus 5.2. Dein bisheriges Muster (Spurt 3 Minuten, Gewichtheben Faktor 4) legt
   „eher ruhiger" nahe — bestätigst du das auch für den Kampf?
3. **Soll der sichtbare Lauf der gebuchte Lauf werden (A3)?** Das ist heute nicht so, und es ist
   eine eigene Entscheidung, unabhängig von allem anderen.
4. **Roguelike-Skill-Pool** (`roguelike-skill-pool-konzept-17-09.md`, „für später"): Wenn das
   kommt, wäre es auf einem Rundenmotor deutlich leichter lesbar. Soll A2 darauf Rücksicht
   nehmen, oder bleibt das weiter ausdrücklich später?

---

## 9. Zusammengefasst für die Hauptsession

- **Chris' Frage ist mit Ja-und-Nein zu beantworten, und das ist keine Ausweichung:** nein für 17
  Disziplinen, ja für 3.
- **Der Grund ist nicht Geschmack, sondern ein benennbarer Mechanismus** (Abschnitt 3): die Arena
  bewertet Durchsatz, kontinuierliche Zeit verkauft Durchsatz gegen TMP/AUS, und TMP/AUS hängen
  als einzige Kampfwerte nicht an der Eignung. Rundenbasiert schließt diesen Kanal durch
  Konstruktion. Fechten ist der gemessene Präzedenzfall (0,153 → 0,840).
- **Der erste Schritt ist klein und risikoarm:** A0.1 (Requisiten-Hook) und A0.2 (Sonden-Modus)
  sofort, dann A1 als Prototyp **neben** dem bestehenden Motor mit harter Messhürde (n ≥ 96–150,
  kaderfest).
- **A2 wird erst nach der Messung entschieden, nicht jetzt.**
