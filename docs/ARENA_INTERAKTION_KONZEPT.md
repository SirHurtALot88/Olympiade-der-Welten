# Interaktion in allen Disziplinen — ein Konzept, kein Code

Stand: 24.08.2026, zweite Fassung. Entstanden aus Chris' Beobachtung, dass Bühne-
Disziplinen sich wie „nur Rumstehen" anfühlen. Ausgearbeitet zusammen mit Fable (zweimal
hinzugezogen, auf Chris' ausdrücklichen Wunsch). Die erste Fassung deckte nur zwei
Bühne-Fälle ab (Breaking, Eiskunstlauf) und beschränkte Störung auf „nur den
Punkteführer angreifen" — Chris' Rückmeldung dazu direkt: das sei „irgendwie kacke",
weil es Interaktion auf einen einzigen, statischen Fall verengt. Diese Fassung geht
weiter: Interaktion in **allen** beweglichen Disziplinen, eine Regel für **echte**
Verletzungen als Spielkonsequenz statt Zierde, und eine Antwort auf die Frage, ob
Bewegungs-Disziplinen ein eigenes Skill-System brauchen.

**Dies ist ein Konzeptdokument, kein implementierter Code.** Die andere Sitzung hat
inzwischen #656 gemergt: alle vier Motoren (Kampf, Bahn, Bühne, Feldspiel) existieren
jetzt als echter Code in `battle-mode.html`, nicht mehr nur als Namen. Dieses Dokument
prüft seine Vorschläge deshalb an der echten Datei, nicht mehr an einer Beschreibung.

---

## Ein Strukturbefund, der alles Weitere bestimmt

Beim Nachsehen im jetzt gemergten Bühne-Code (`battle-mode.html`, `bauBuehne()`,
~Zeile 2583) zeigt sich etwas Wichtiges: **Bühne (und genauso Feldspiel) ist nicht live
simuliert.** Der komplette Auftritt — alle Durchgänge jedes Teilnehmers, jedes Gelingen
und Misslingen — wird in einem einzigen synchronen Durchlauf beim Aufbau **vorab
berechnet** (`ALLE DURCHGAENGE SOFORT DURCHRECHNEN, dann ueber die Zeit ENTHUeLLEN`,
Kommentar im Code). Die sichtbare Zeit auf der Bühne ist reine Enthüllungsgeschwindigkeit
— sie ändert nichts am Ergebnis.

**Das entscheidet die zentrale offene Frage der ersten Fassung von selbst:** eine
Störung, die „den Punktezuwachs für X Sekunden pausiert", kann in diesem Modell nicht
funktionieren — es gibt keinen laufenden Zeitstrom, den man pausieren könnte, nur eine
Liste bereits fertiger Zahlen. Störung muss deshalb **in denselben Vorab-Durchlauf**
eingewoben werden, als zusätzlicher Faktor in der bestehenden Erfolgsformel:

```js
const erfolg=Math.min(0.94,0.15+L.TECHNIK*0.0055+L.NERVEN*0.0035);
```

(`battle-mode.html:2612`, exakt der Ort, an dem TECHNIK und NERVEN heute schon
entscheiden, ob ein Durchgang gelingt.) Kampf und Bahn sind dagegen weiterhin **echte**
Frame-für-Frame-Simulationen (`stepSim`, `requestAnimationFrame`) — dort bleibt eine
live wirkende Störung (Engstellen, Tackles) genau richtig.

---

## Die Grundidee bleibt: keine neuen Werte, nur eine neue Lesart

Die Battle Arena hat fünf Kampfwerte, jeder ein gewichtetes Rezept über dieselben zwölf
Attribute:

```
ANG (Angriff)      power 62 · charisma 18 · determination 12 · torment 8
VER (Verteidigung) health 46 · power 38 · spirit 16
LP  (Lebenspunkte)  health 52 · stamina 34 · power 14
TMP (Tempo)         speed 46 · dexterity 24 · stamina 16 · awareness 14
AUS (Ausdauer)       stamina 52 · determination 26 · power 22
```

Schaden im Kampf: `Basisschaden × (ANG/50) × 100/(100+VER)`. Trefferchance beim Tackle im
Bahn-Motor: `stark = WUCHT/(WUCHT+ROBUST)` (`battle-mode.html:5871`, seit #656 mit
`BA().tackleAb`/`BA().tackleRate` je Disziplin konfigurierbar). Beide Muster tauchen
unten wieder auf — nicht neu erfunden, nur auf neue Situationen angewendet.

---

## Bewegungs-Disziplinen: Geraden und typisierte Engstellen

Chris' Bild: Climbing soll keine glatte Wand sein, sondern ein Parcours mit **großen
Hindernissen**, an denen mehrere Läufer zusammenkommen und sich um die Position streiten
— mal kraftbasiert (gerade hoch, Griffstärke), mal agilitätsbasiert (seitwärts). Und:
das Ergebnis muss aus der Eignung selbst folgen, nicht daneben erzählt werden — „wir
haben bisher Werte, die projizieren nur eins zu eins und zeigen irgendein random
Gameplay. Jetzt will ich, dass wir die Werte in ein Gameplay-System übersetzen und das,
was wir sehen, das Ergebnis ist."

**Guter Ausgangspunkt, schon gemergt:** #656 hat den Bahn-Motor bereits auf fünf
Disziplinen verallgemeinert (`BAHN_ART`), mit sieben Rollen pro Disziplin (ANTRITT,
ENDTEMPO, TECHNIK, WENDIGKEIT, STEHEN, WUCHT, ROBUST) und eigenem Hindernis-Wort
(„Hürde", „Griff", „Kurve", „Falle") je nach Disziplin. Climbing hat dort bereits zehn
Griffe statt Hürden, mit eigenem Rezept (`TECHNIK` aus Dexterity/Awareness fürs
Greifen, `WUCHT` aus Power/Determination fürs Durchziehen bei Fehlgriff). Was fehlt, ist
die **Engstelle als geteilter Ort** — heute läuft jeder Teilnehmer für sich auf seiner
eigenen Bahn, Kontakt gibt es nur beim seitlichen Tackle.

### Drei Verben statt einer Formel

1. **FORTBEWEGEN** — auf Geraden, wie heute (`ANTRITT`/`ENDTEMPO`).
2. **ARBEITEN** — an einer Passage. Eine Passage ist kein Zeitabzug mehr, sondern ein
   **Arbeitskonto**, das mit einer Rate abgetragen wird: `rate = TYP_WERT × 0,2`
   Arbeitspunkte/s (Platzhalter, wie alles hier). Eine Passage mit `arbeit: 100`
   (Chris' eigenes Beispiel, ausdrücklich als Platzhalter genannt) kostet bei
   `TYP_WERT 78` → 15,6/s → **6,4 s**; bei `TYP_WERT 45` → 9,0/s → **11,1 s**.
3. **STREITEN** — um einen Platz an der Engstelle, nach demselben Tackle-Muster
   `WUCHT/(WUCHT+ROBUST)`, das im Bahn-Motor schon existiert. Keine neue Formel, nur eine
   neue Gelegenheit, sie anzuwenden.

Jede Passage bekommt eine `kapazitaet` (wie viele Läufer gleichzeitig arbeiten dürfen).
Kapazität 1 = Nadelöhr, Kapazität 2 = breite Stelle. Wer ankommt und keinen Platz findet,
wartet — oder streitet: exakt Chris' Bild vom „Zusammenstehen und Festhängen für ein
paar Sekunden".

### Climbing, durchgerechnet (alle Zahlen Platzhalter)

Zwei Passagentypen: **ZUG** (gerade hoch, Griffstärke: `power 45, determination 35,
health 20`) mit Rutschrisiko, und **QUER** (seitwärts, Agilität: `dexterity 50,
awareness 30, speed 20`), dazu **DRUCK**/**HALT** als WUCHT/ROBUST-Analogon fürs
Streiten um eine besetzte Passage.

| | Kraftkletterer K | Agiler Kletterer A |
|---|---|---|
| Werte | TEMPO 55, ZUG 78, QUER 42, DRUCK 70, HALT 65 | TEMPO 75, ZUG 45, QUER 80, DRUCK 40, HALT 45 |
| 3 Geraden | 4,2 s | 3,5 s |
| ZUG-Passage (arbeit 100) | 6,4 s | 11,1 s (+ Rutschrisiko) |
| QUER-Passage (arbeit 80) | 9,5 s | 5,0 s |
| **Summe** | **20,1 s** | **19,6 s** |

Das Rennen ist knapp — aber die **Segment-Splits erzählen, wer wer ist**: K holt seinen
Vorsprung komplett an der Griffpassage, A komplett auf Geraden und im Quergang. Genau
Chris' Punkt: das Ergebnis (inklusive der Splits als Anzeige) *ist* die Übersetzung der
Werte, keine Zufallsanimation daneben.

**Die Engstelle:** A kommt zuerst an der ZUG-Passage (Kapazität 1) an und besetzt sie. K
kommt 0,7 s später und streitet: `p = DRUCK_K/(DRUCK_K+HALT_A) = 70/115 ≈ 61 %`. Gelingt
es, verliert A Fortschritt und taumelt kurz; K übernimmt den Platz. Misslingt es, wartet
K mit Cooldown (analog zum bestehenden `tackleCd=1.8`) und versucht es erneut oder
arbeitet, sobald frei. **Ob** überhaupt gestritten wird statt gewartet, hängt an der
bereits bestehenden Persönlichkeits-Tabelle (`willTackeln`, `battle-mode.html:5850`) —
die passt unverändert.

**Runterrutschen** (nur ZUG-Passagen): je Sekunde ein Haltecheck, Rutschchance
`clamp(0,02 + (50−ZUG)×0,004; 0; 0,25)` (Platzhalter). Bei Rutsch verliert er 30 % der
bisherigen Arbeit an dieser Passage (Platzhalter) — sichtbar als Zurückrutschen, kein
Sturz. Das Analogon zur Hürden-Kaskade Technik→Wucht→Sturz im Spurt: Schwäche kostet
Zeit, tötet aber nicht.

### Übertragung auf Staffel und Spurt

- **Spurt** ist bereits eine Instanz dieses Modells: Hürden sind Passagen mit
  `arbeit≈0` und Sofort-Check statt Arbeitskonto, Tackles sind das Streiten. Nichts
  umzubauen.
- **Staffel:** Basisziel bleibt Timing. Die **Stab-Übergabe wird eine Passage** vom Typ
  WECHSEL (Rezept `dexterity/awareness/will`, Platzhalter) mit kleinem Arbeitskonto —
  ein sauberer Wechsel trägt sich schnell ab. Support obendrauf: während des
  Übergabefensters ist der Übergebende **streitbar** — ein Gegner in Reichweite darf
  einen DRUCK/HALT-Check setzen; verliert der Übergebende, kostet es Übergabezeit oder
  einen Fast-Fumble.

### Die Übersetzungsebene als Regel, nicht nur als Ziel

Damit die Matrix nicht nur die Eignung ausrechnet, sondern die **Strecke selbst formt**:
der Streckengenerator verteilt das Zeitbudget einer Disziplin auf Segmentklassen
**proportional zu den Matrixgewichten** der Attribute, die die jeweilige Klasse füttern.
Lädt die Matrix 40 % auf Speed/Dexterity und 35 % auf Power/Determination, besteht die
Strecke zu ~40 % Zeitanteil aus Geraden/QUER und ~35 % aus ZUG-Passagen. Ein Spieler mit
95 in dieser Matrix muss dann zwangsläufig in beiden Segmentklassen liefern — die
Eignung kann nicht mehr an der Strecke vorbeiprojizieren, weil die Strecke aus ihr selbst
gebaut ist.

---

## Bühne: die Störung als Faktor im Vorab-Durchlauf

Wegen des Strukturbefunds oben ist die Störung jetzt **kein Zeit-Aussetzer mehr**,
sondern ein Malus auf die bestehende Erfolgschance, gesetzt für einzelne Durchgänge
während desselben Vorab-Durchlaufs, der heute schon alle Punkte berechnet.

**Und die Zielregel „nur den Punkteführer" fällt weg**, wie Chris zu Recht angemerkt
hat. Sie war ein künstlicher Zaun um ein Problem, das sich von selbst löst: das
**Störbudget** (`⌊AUS/25⌋` Versuche, unverändert aus der ersten Fassung) begrenzt schon,
wie viel ein einzelner Teilnehmer stören kann — jeder Versuch kostet eigene Fassung und
eigene Erfolgschance in einem eigenen Durchgang. Wer wild um sich stört, schwächt sich
selbst. Das reicht als Bremse, ohne eine erzählerisch beliebige „nur gegen den Ersten"-
Regel zu brauchen.

**Störwurf** (unverändert): Trefferchance `ANG_Störer/(ANG_Störer+TMP_Ziel)`.

**Wirkung, neu formuliert:** bei Treffer sinkt für den **nächsten Durchgang** des Ziels
die Erfolgschance:

```js
erfolg = Math.min(0.94, 0.15 + TECHNIK*0.0055 + NERVEN*0.0035 - stoerMalus)
stoerMalus = 0.25 * 100/(100+VER_Ziel)   // Platzhalter-Basis 0,25
```

VER wirkt wie überall als Mitigation, nur jetzt auf einen Erfolgschance-Abzug statt auf
Schaden oder Zeit — VER 40 → Malus 0,18; VER 80 → Malus 0,14. Das ersetzt den alten
„Fassungspool"-Aussetzer direkt an der Stelle, an der das Spiel den Erfolg wirklich
entscheidet.

**Fassung (aus LP), Budget (aus AUS)** bleiben wie in der ersten Fassung: Pool `LP×10`,
Treffer ziehen `Basisschaden×(ANG/50)` ab, unter 50 %/25 % ein zusätzlicher fester Malus
von 0,10/0,20 auf `erfolg` (ersetzt die alten „−10/−20 Prozentpunkte", gleiche Zahl,
jetzt am richtigen Ort angewandt).

### Breaking und Eiskunstlauf bleiben die Referenzfälle

Bei **Breaking** tickt eine passive Schmerzquelle unabhängig von Gegnern gegen die
Fassung — das ist der Kern der Disziplin. Gegner können zusätzlich nachlegen (Basis 30,
ANG 55 → 33 Schaden), was über den Fassungs-Malus die restlichen Durchgänge schwerer
macht. Bei **Eiskunstlauf** trifft ein Störwurf gezielt den *nächsten* Durchgang des
Ziels — sein aktuelles Element „verwackelt" statt zu misslingen, weil ohnehin nichts live
läuft, das misslingen könnte.

---

## Verletzungen als echte Konsequenz, nicht Zierde

Chris' Erinnerung: großer Abstand zwischen Angriffs- und Verteidigungswert (sein
Beispiel: 80 gegen 55) konnte früher zu einer Verletzung führen. Nachgesehen: diese
Formel existiert im aktuellen Code **nicht** — vermutlich ein sehr altes, nicht mehr
vorhandenes Regelwerk. Sie muss neu entworfen werden. Wichtiger als die Formel ist Chris'
eigentlicher Punkt dahinter: „so wie wir's bisher gehandhabt haben, projizieren die Werte
nur eins zu eins und wir zeigen random Gameplay — jetzt will ich, dass die Werte sich in
ein Gameplay-System übersetzen und das, was wir sehen, das Ergebnis ist." Eine Verletzung
muss also eine **echte Folge eines echten kritischen Treffers** sein, nicht ein
unabhängig gewürfelter Text daneben.

**Die gute Nachricht:** das Spiel hat bereits ein vollständiges Verfügbarkeits-/
Verletzungssystem (`lib/fatigue/fatigue-injury-service.ts`, 1321 Zeilen) — `rollInjuryRisk`,
`precomputedInjuryRolls`, `INJURY_UNAVAILABLE_MATCHDAYS`, Recovery, Historie
(`appendPlayerInjuryHistory`). Es ist heute **Ermüdungs-basiert** (Fatigue über eine
Saison), nicht Kampfwert-basiert — `injuryReason` steht sogar hart auf
`"fatigue_over_30_after_matchday_use"` (Zeile 1273). Der Vorschlag dockt an, statt ein
zweites, paralleles Verletzungssystem zu bauen:

1. **Ein neuer Wurf**, im selben Muster wie `rollInjuryRisk`, aber mit eigener Quelle
   `"battle_crit_injury_v1"`:
   ```
   riskPercent = clamp((angVerGap − 20) × 0,4, 0, 8)   // Platzhalter
   ```
   Gap 25 (Chris' Beispiel 80 vs. 55 = Gap 25) → 2 %; Gap 40 → 8 %. Ein Wurf je Spieler
   und Spieltag, auf dem härtesten erlittenen Gap — nicht je einzelnem Treffer, sonst
   explodiert die Rate.
2. **Die Einspeisung**: `applyFatigueAndInjuryAfterMatchday` nimmt bereits
   `precomputedInjuryRolls` entgegen (Zeile 1094). Der Aufrufer überlagert die normale
   Fatigue-Map: wo der Fatigue-Wurf „gesund" sagt, aber der neue Crit-Wurf „verletzt",
   ersetzt der Crit-Roll den Eintrag. Alles Weitere — Status, Verfügbarkeitsfenster,
   Historie, Highlight, Spieltag-Text — läuft unverändert mit, weil der bestehende Code
   nur auf `roll.result` schaut.
3. **Zwei kleine, ehrliche Erweiterungen**: die `source`-Union um
   `"battle_crit_injury_v1"` ergänzen; `injuryReason` (Zeile 1273) aus `roll.source`
   ableiten statt hart zu tippen, damit im Spieler-Drawer der echte Grund steht.
4. **Offene Frage, nicht stillschweigend angenommen:** läuft der produktive Kampf-Motor
   im Apply-Pfad (nicht nur das Mockup) deterministisch je Spieltag? Der Replay-Pfad
   (`restorePreMatchdayAvailability`) verlangt das. Falls nicht, Rückfallvariante: den
   Gap nicht aus dem simulierten Kampfverlauf ziehen, sondern rein aus den Aufstellungen
   — `angVerGap = max(ANG aller gegnerischen Kampf-Spieler) − VER des Spielers`.
   Vollständig deterministisch, verliert nur die Information, ob der Treffer wirklich saß.

**Korridor-Warnung:** Chris' bestehender Verletzungskorridor (~140–200/Saison, mühsam
austariert) darf nicht heimlich gerissen werden. Mit CAP 8 % käme grob eine niedrige
zweistellige Zahl je Saison obendrauf — das muss vor dem Merge mit einem Audit-Sweep
**gemessen** werden (im Stil von `scripts/export-injury-balance-audit.ts`), nicht
geraten. Platzhalter-Ziel: ≤10–15 % Zuwachs auf den bestehenden Korridor.

### Dieselbe Idee für Bewegungs-Disziplinen (Chris' Ergänzung)

Nicht nur Kampf — auch Spurt, Staffel & Co. sollen Verletzungen auslösen können, über
genau das Analogon, das der Bahn-Motor selbst schon benennt: „Der Ersatz für LEBEN ist
die KRAFTRESERVE … der Ersatz für VERTEIDIGUNG ist ROBUSTHEIT" (Kommentar im Code, siehe
oben bei Climbing). Übertragen:

- **Auslöser**: die Kraftreserve (STEHEN) eines Läufers erreicht 0, weil sie **durch
  Tackles stärkerer Gegner** aufgebraucht wurde (nicht durch normales Renntempo — der
  Unterschied ist wichtig, sonst würde ein sauberer, kraftvoller Lauf plötzlich als
  „Verletzung" enden). Wie in Chris' Bild: „ich muss mich durch superstarke Gegner
  durchschlängeln, und die geben mir alle einen aufm Deckel."
- **Risiko**: dieselbe Gap-Kurve wie im Kampf, nur mit ROBUST statt VER —
  `clamp((WUCHT_Gegner−ROBUST_Läufer−20)×0,4%, 0, 8%)` (Platzhalter, identische Formel
  wiederverwendet statt eine zweite erfunden).
- **Folge, explizit Chris' Vorgabe**: die Disziplin läuft **weiter zu Ende** — kein DNF.
  Ab dem Verletzungszeitpunkt aber **dauerhaft 50 % auf die bewegungsrelevanten Werte**
  (TEMPO/ANTRITT/ENDTEMPO) für den Rest dieses einen Laufs.
- **Keine zweite Verletzung obendrauf**: ist ein Läufer einmal verletzt, wird für ihn in
  diesem Lauf kein zweiter Injury-Wurf mehr gemacht — „verletzt ist verletzt", kein
  Stapeln von Mali.
- **Balance-Bedingung, ebenfalls Chris' Vorgabe**: das darf nicht dazu führen, dass jede
  Disziplin routinemäßig mehrere Verletzungen produziert. Dieselbe Korridor-Messung wie
  oben gilt hier genauso — eher strenger, weil Bewegungs-Disziplinen häufiger laufen als
  Kampf-Disziplinen und sich die Rate sonst schneller aufsummiert.

---

## Skills für Bewegungs-Disziplinen — vorerst nein

Chris' Frage: brauchen Climbing & Co. eigene Skills („schneller über ein Hindernis",
„seitwärts springen")? Drei Gründe, erstmal nicht:

1. Die **Hindernis-Typisierung leistet schon, was die Beispiel-Skills sollen** —
   „schneller über ein Hindernis" ist ein hoher Typ-Wert, „seitwärts springen" ist QUER.
   Ein Skill obendrauf wäre eine zweite Stellschraube für denselben Effekt.
2. Die vorhandene Infrastruktur reicht, falls doch gewünscht: `Skill`-Interface in
   `lib/battle/class-kits.ts` ist generisch genug für einen „Bewegungs"-Kontext im
   selben Pool, statt eine zweite Skill-Infrastruktur zu bauen.
3. **Der Abschrift-Vertrag**: `class-kits.ts` ist ausdrücklich eine Abschrift von Chris'
   Klassenkarten. Bewegungs-Skills zu erfinden hieße, diesen Vertrag zu brechen — wenn,
   dann als echte Karten von Chris, nicht als Erfindung.

Empfehlung: erst die Hindernis-Typisierung bauen und messen, ob sich die Archetypen an
den Segment-Splits ablesen lassen. Erst wenn dabei fehlende **Spielerentscheidungen**
auffallen (nicht fehlender Werte-Ausdruck), Skills als Pool-Erweiterung nachziehen.

---

## Bahn: Lanes, Überhol-Ökonomie, Kamera (unverändert aus der ersten Fassung)

Windschatten und Bahnwechsel-Kosten existieren bereits (`SCHATTEN_TEMPO=1.045`,
`SCHATTEN_SPAREN=0.66`, Bahnwechsel kostet Zeit/Tempo/Cooldown). Was fehlt: eine
**Kollisionszone** — solange zwei Läufer nebeneinanderliegen (`|Δpos|<0.01`,
Nachbarbahn), erhöhtes Stolperrisiko für beide, kein Windschatten für den Überholer in
diesem Fenster.

**Lane-Vergabe** ist starr (`i*2`/`i*2+1`). Vorschlag: nach Setzliste, beste Läufer auf
die Mittelbahnen — offene Frage an Chris: Setzliste oder Los?

**Kamera:** `pos` bleibt normalisiert 0..1, nur das Zeichnen wechselt auf eine
Welt→Schirm-Transformation (`screenX = (worldX−cam.x) × pxProMeter × cam.zoom`), nur
horizontal gezoomt, damit Lanes lesbar bleiben.

---

## Die drei ehemals unzugeordneten Disziplinen

Inzwischen von #656 selbst eingeordnet: **Tennis** läuft im Feldspiel-Motor (Ballwechsel
= Ballbesitz-Zyklus). **Speed-Schach** und **I-Spy** stehen noch nicht in einer der vier
Registries — Speed-Schach passt weiter zur Bühne-Störung (Bedenkzeit als Fassungspool),
I-Spy eher als Bühne mit knapper Ressource statt Angriffswurf (begrenzter Fund-Pool,
Interaktion ohne Störwurf — ein dritter Interaktionstyp neben „stören" und „Engstelle
erkämpfen").

---

## Was hier erfunden ist (Kennzeichnungspflicht)

| Wert | Zahl |
|---|---|
| Störbudget (Bühne) | `⌊AUS/25⌋` |
| Fassungspool | `LP × 10` |
| Störmalus-Basis (Bühne) | 0,25 auf die Erfolgschance |
| Fassungs-Schwellen | 50 % / 25 % → −0,10/−0,20 zusätzlicher Malus |
| Arbeitsrate (Passagen) | `TYP_WERT × 0,2` Punkte/s |
| Passagen-Arbeit (Beispiel) | 100 (Chris' eigenes Platzhalter-Beispiel) |
| Rutschrisiko (ZUG-Passagen) | `clamp(0,02+(50−ZUG)×0,004; 0; 0,25)` |
| Rutsch-Verlust | 30 % der Passagen-Arbeit |
| Kollisionsfenster (Bahn) | `|Δpos| < 0.01` |
| Verletzungsrisiko-Kurve (Kampf: ANG−VER, Bahn: WUCHT−ROBUST) | `clamp((Gap−20)×0,4%, 0, 8%)` |
| Stat-Malus nach Verletzung (Bewegungs-Disziplinen) | 50 % auf TEMPO/ANTRITT/ENDTEMPO, Rest des Laufs |

## Offen — mit Chris zu klären

1. ~~Strom über Zeit oder blockweise?~~ **Beantwortet**: Bühne ist Vorab-Durchlauf, kein
   Zeitstrom — Störung wirkt als Erfolgschance-Malus im selben Durchlauf.
2. ~~Wie dockt NERVEN an?~~ **Beantwortet**: direkt in derselben Formel
   (`0.15+TECHNIK*0.0055+NERVEN*0.0035`), Störmalus ist ein dritter Term davon.
3. Lane-Vergabe: Setzliste oder Los?
4. Verlässt ein Störer sichtbar seine Position (Lesbarkeit fürs Publikum), oder ist es
   ein reiner Fernwurf — gilt für Bühne wie fürs Streiten an Engstellen?
5. Läuft der produktive Kampf-Motor im Matchday-Apply-Pfad deterministisch? Entscheidet,
   ob die Verletzungsformel den echten Kampfverlauf lesen darf oder auf die
   Aufstellungs-Rückfallvariante ausweichen muss.
6. Kamera: nur horizontal zoomen, oder soll sie auch vertikal mitgehen?

## Quellen

- [Poise/Interruption-Systeme in Soulslikes](https://gamerant.com/soulslike-games-best-stagger-mechanics/) — Vorbild für einen Fassungspool, der bei Unterschreiten die Erfolgschance senkt statt sofort auszuschalten
- [Interruption Resistance, Genshin Impact Wiki](https://genshin-impact.fandom.com/wiki/Interruption_Resistance)
- [Windschatten/Blocken in Rennspielen](https://drivingfast.net/slipstream-overtaking/) — Vorbild für die Kollisionszone beim Überholen
- [Racecraft: Überholen in der Kurve](https://drivingfast.net/racecraft-overtaking-on-a-corner/)

Figur-Skating-Spiele mit Rivalen-Sabotage: gesucht, nicht gefunden — echter Eiskunstlauf
ist kontaktfrei. Eine eigene Erfindung fürs fiktive Universum, kein übernommenes Vorbild.
Engstellen-Contests an Hindernissen: kein einzelnes Spiel als Vorbild genannt — das
Prinzip (Arbeitskonto + Kapazität + Streit-Check) ist eine Verallgemeinerung des bereits
bestehenden Tackle-Musters, kein Fund aus der Recherche.
