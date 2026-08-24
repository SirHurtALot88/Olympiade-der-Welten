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

### Namen statt Kürzel (Chris' Ergänzung)

Zurecht kritisiert: im Feed dürften nicht die rohen Kürzel ANG/VER/LP/TMP/AUS auftauchen.
Sein Bild — „offensiver Skill, defensiver Skill, beim Sport zum Beispiel Ausweichen oder
Parieren" — ist bereits ein bestehendes Muster im Code: `BAHN_ART` benennt seine sieben
Rollen für jede der fünf Bahn-Disziplinen einzeln um, über ein `lang`-Objekt (z. B.
Climbing: `ANTRITT:"Zug"`, Spurt: `ANTRITT:"Antritt"` — gleiche Struktur, andere Wörter).
Dieselbe Idee, angewendet auf die fünf Störwerte, einmal je Bühne-Disziplin (alle
kollisionsfrei gegen die sieben Rezept-Rollennamen GRUNDLAGE…WAGNIS geprüft):

| Disziplin | ANG (Störzug) | TMP (Ausweichen) | VER (Parieren) | LP (Fassungspool) | AUS (Budget) |
|---|---|---|---|---|---|
| Gewichtheben | Einschüchtern | Tunnelblick | Standfestigkeit | Sammlung | Körner |
| Showcase | Show stehlen | Überspielen | Bühnenpräsenz | Selbstvertrauen | Atem |
| Eiskunstlauf | Stichelei | Drüberstehen | Haltung | Contenance | Giftvorrat |
| Breaking | Ansage | Flow | Härte | Schmerzgrenze | Akku |
| Wettessen | Appetitverderber | Weiteressen | Eiserner Magen | Ekelschwelle | Puste |

Beispiel-Feed-Zeilen im bestehenden `feed()`-Muster (kurz, Aktion, kein Fließtext):

```
Gewichtheben ANG: u.n+" schüchtert "+z.n+" vor dem Versuch ein."
Eiskunstlauf ANG: u.n+" stichelt gegen "+z.n+" — der nächste Sprung wackelt."
Wettessen TMP:    z.n+" isst einfach weiter."
Breaking LP:       z.n+" ist über der Schmerzgrenze — die Moves leiden."
```

„Y isst einfach weiter" (Wettessen, Ausweichen) braucht keine Erklärung und ist komisch,
weil es stimmt — genau der Maßstab aus Chris' dritter Bedingung („beim Einsetzen schon
sieht und nachvollziehen kann").

**Als Prinzip weitergedacht, nicht nur für die Störung:** dieselbe Lücke besteht schon
heute in `BUEHNE_ART` und `FELDSPIEL_ART` selbst — GRUNDLAGE heißt bei Gewichtheben und
Wettessen gleich, obwohl das Rezept dahinter unterschiedlich ist (dort Power/Health, hier
Stamina/Health). Beide Registries fehlt ein `lang`-Objekt, das `BAHN_ART` hat. Beispiel,
wie GRUNDLAGE dort greifbar würde: Breaking → „Foundation" (echter Breakdance-Begriff für
verlässliche Basis-Moves, passt auf `{will,health,stamina}`), Eiskunstlauf → „Ausstrahlung"
(das Rezept `{charisma,spirit,dexterity}` ist Präsenz, keine „Grundlage").

**Wichtiger Vorbehalt, nachgemessen statt vermutet:** die fünf bestehenden Bahn-`lang`-
Objekte werden im Mockup **nirgends gelesen** — `grep` auf `.lang[` liefert null Treffer,
es ist definierte, aber tote Daten. Was der Bahn-Feed tatsächlich für unterschiedliche
Sprache je Disziplin nutzt, sind die separaten Wort-Slots `hindernisWort`/`failWort`/
`erfolgWort`, die tatsächlich in die Feed-Zeilen einfließen — und dieses Muster hat
`BUEHNE_ART` bereits (z. B. „stürzt"/„landet sauber", „Move bricht ab"). Ein `lang`-Objekt
einzuführen heißt deshalb **zwei** Schritte, nicht einen: die Namen definieren UND sie an
jeder Stelle verdrahten, an der ein Rollenname einem Zuschauer gezeigt wird (Einheiten-
Panel, Tooltip, künftig die Stör-Feed-Zeilen) — sonst entsteht dieselbe Halb-Lücke ein
zweites Mal, nur eine Ebene tiefer.

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

## Feldspiel: Spielzüge, Assets, Sound, Zuschauer-Spannung

Chris, nach #660 (Basketball bekam Bewegung, Ball, Pässe, Assists): er will **echte,
wiedererkennbare Spielzüge** sehen — sein Vorbild ein Alley-Oop im Basketball — und ein
Äquivalent für **American Football** (ausdrücklich nicht Fußball). Dazu passende Assets,
Sound mit steigerbarem Publikumsjubel, und die Frage, was dem Feldspiel-Motor sonst noch
fehlt. Auf seinen Wunsch einmal groß mit Fable durchdacht, damit das für mehrere
Disziplinen trägt statt bei jeder neuen wieder bei null anzufangen. Fables Befund unten
ist an der echten Datei auf diesem Branch gegengeprüft (Zeilennummern stimmen); was
danach in **implementiert** steht, ist echter, getesteter Code, kein Vorschlag mehr.

### Spielzüge — implementiert

Ein Spielzug ist **kein neuer Ereignistyp**, sondern eine Veredelung des bestehenden
Pass-Zweigs in `bauFeldspiel` (`public/mockups/battle-mode.html`, Pass-Entscheidung ab
Zeile ~2374): bevor der normale Passempfänger nach ABSCHLUSS gelost wird, prüft die
Simulation der Reihe nach jeden in `FELDSPIEL_ART[disc].spielzuege` deklarierten Zug. Der
erste, der auslöst, gewinnt; sein Finisher wird über eine zugeigene Rolle gelost (z. B.
ZWEITCHANCE beim Alley-Oop statt ABSCHLUSS beim Normalpass), seine Erfolgschance ersetzt
die normale Technik-Formel, und `eintrag.zug` trägt den Namen bis in Feed, Jubel-Text und
Choreografie — auch bei Fehlschlag, ein verpatzter Alley-Oop bleibt sichtbar ein
Alley-Oop-Versuch.

**Basketball: Alley-Oop.** Finisher gelost über ZWEITCHANCE (der Sprung-zum-Ball-Wert,
schon vorhanden). Auslösechance steigt mit `passgeber.TECHNIK` und `finisher.ZWEITCHANCE`
(2–22 %, PLATZHALTER), Erfolgschance mit `finisher.ABSCHLUSS` und `passgeber.TECHNIK`
(Basis 10 % statt 16 % beim Normalpass — riskanter, aber bei starkem Duo lohnender).

**American Football: zwei Züge, meine Auswahl** (Chris hat keinen benannt) — *Screen
Pass* (kurzer Pass, Finisher über ABSCHLUSS/power-torment-health, schlängelt sich durch)
und *Deep Ball* (langer hoher Ball, Finisher über ZWEITCHANCE gewinnt den Zweikampf um
den hohen Ball — riskanteste Variante, größter Jubel). Beide nur im Nah-Zweig (Touchdown,
6 Punkte) — `fern` bedeutet bei Football schon Field Goal, ein Spielzug dort wäre
semantisch etwas anderes.

**Choreografie: drei wiederverwendbare Primitive** statt Sonderfälle je Zug/Disziplin
(`fsLerpPositionen`, ~Zeile 2497 ff.):

1. `hochpass` (Alley-Oop) — der Ball fliegt in einem hohen Bogen (90 px, PLATZHALTER)
   direkt zum Korb statt erst zum Mitspieler; der Finisher hebt im letzten Phasendrittel
   sichtbar ab (`sin`-Hop, 28 px) und trifft den Ball dort, statt ihn je zu kontrollieren.
2. `flachpass-lauf` (Screen Pass) — kurzer, flacher Pass früh in der Phase, danach
   „trägt" der Läufer den Ball mit einer seitlichen Schlängel-Auslenkung (16 px) weiter.
3. `weitpass-lauf` (Deep Ball) — derselbe lineare Grundpfad wie ein Normalpass, nur ein
   deutlich höherer Bogen (75 px statt 36 px beim normalen Treffer).

Jede künftige Disziplin (Hockey, Tennis, oder ein fünfter Feldspiel-Fall) mappt ihre
eigenen benannten Züge auf diese drei Primitive, statt eine vierte zu erfinden — das ist
der eigentlich wiederverwendbare Teil.

**Zuschauer-Hype:** ein gelungener Spielzug bekommt einen größeren, länger stehenden
Jubel-Text (goldfarben statt grün, 22 px statt 15 px, 1,7 s statt 1 s Lebensdauer) statt
des normalen „+N" — das „noch mehr Jubel bei was Besonderem", das Chris wollte. Echter
Sound (siehe unten) ist davon unabhängig und noch nicht gebaut.

**American Football bekommt ein eigenes Feld** (`bodenFeldspiel`, football-Zweig):
Endzonen, Yard-Linien alle 10 %, betonte Mittellinie — bislang teilte sich Football den
neutralen Fußballfeld-Look mit Hockey/Tennis. Hockey/Tennis behalten den vorerst, eigene
Markierungen für die sind ein eigener Auftrag.

**Explizit nicht gemacht, auf Chris' eigenen Hinweis:** keine neuen Spielerfiguren für
American Football. Er hat das mitten in der Arbeit selbst klargestellt — die
bestehenden Sprites bleiben, nur Ball/Feld ändern sich. Deckt sich mit Fables eigener
Empfehlung unten (B), die BananaCat-Spielerfiguren aus Stilgründen ohnehin nicht
einzusetzen.

**Empirisch geprüft** (`node scripts/messe-arena-einfluss.mjs <disc> 48`, dieselbe
Abnahmemessung wie immer): Basketball verbessert sich von 32 auf **27 Pp** Abweichung —
die Spielzug-Formeln lesen zusätzlich TECHNIK und ZWEITCHANCE ein, ohne neue tote Werte.
Football verschlechtert sich dagegen von 39 auf **48,4 Pp** — vor allem Power liest jetzt
deutlich stärker (13,8 % statt 8,1 %, bei Matrixgewicht 6), weil beide neuen Züge stark
auf ABSCHLUSS/ZWEITCHANCE setzen, die schon Power tragen. Football stand schon vor dieser
Änderung bei 39 Pp (kein Fund dieser Änderung, aus #656) — festgehalten, nicht
verschwiegen, aber hier nicht mitgelöst, genau wie die Dexterity-Lücke bei Basketball in
#660.

### Basketball wird live simuliert — Architekturwechsel, kein Feature

Chris, nach diesem PR: Feldspiel (und perspektivisch Bühne) sollen sich **genau wie
Kampf und Bahn anfühlen** — echte Tick-für-Tick-Simulation, Ereignisse entstehen beim
Zusehen, nicht vorab feststehend und nur enthüllt. Zehn konkrete Fragen dazu beantwortet
(Reihenfolge, Umfang, Determinismus, Tempo-Steuerung — alle Antworten: „genau wie
Kampf/Bahn", „erst Basketball, sauber", Determinismus bleibt Pflicht). Mit Fable
übersetzt (Kampfs `stepSim`-Muster: gedrosselte Neubewertung, abstandsbasierte
Interaktion, Feed-Text im Kipp-Tick) und für **nur Basketball** gebaut — Football/
Hockey/Tennis bleiben beim Vorab-Durchlauf, bis sich das Muster bewährt hat, exakt wie
entschieden.

**Was jetzt läuft** (`initBasketballLive`/`stepBasketballLive`, `battle-mode.html`, nach
`bauFeldspiel`): jeder Spieler trägt eigenen Live-Zustand (`deckt`, `reevDeckung`,
`reevBall`, `stealCd` — Drosseln nach Kampf-Vorbild, keine Zufalls-Jitter mehr, das war
ein eigener Fund, siehe unten). Der Ball ist ein eigenes Objekt (getragen/im Flug/frei).
Verteidiger ordnen sich **live neu zu** (gieriges Matching nach Abstand, gedrosselt) —
Chris' Punkt 2 aus den zehn Fragen, „aktives Agieren und Reagieren". Der Alley-Oop löst
**live** aus (einmal pro Ballaktions-Entscheidung gewürfelt, nicht vorab), mit derselben
`neigung`/`abschluss`-Formel wie zuvor. Determinismus bleibt erhalten: derselbe geseedete
`rr()`, dieselbe feste Schrittweite, `MOTOREN.basketball.lauf()` ruft denselben
`stepFeldspiel(1/60)` ungerendert — bestätigt reproduzierbar (`messe-arena-einfluss.mjs`
liefert bei gleichem Seed zweimal exakt dasselbe Ergebnis).

**Ein echter Fund unterwegs — und behoben:** die erste Fassung ließ den Ballführer pro
Tick 15 % der Reststrecke zum Korb zurücklegen. Damit war er binnen einer halben Sekunde
praktisch immer schon in Wurfreichweite — `entscheideBallaktion` prüft Nah-/Fernwurf
ZUERST und wirft dann sofort selbst, Pass/Spielzug kamen nie zum Zug. AUFBAU, ABSCHLUSS,
TEAMGEIST und die Spielzug-Formeln waren dadurch faktisch tote Kalibriermasse — dieselbe
Lektion wie bei ABSCHLUSS in #660, hier strukturell statt an einer einzelnen Formel.
Zusätzlich standen alle Mitspieler ohne Ball innerhalb von 70 px vom Korb, also selbst
IMMER in Wurfreichweite — ein Pass hätte sich nie gelohnt. Beides behoben: Dribbeltempo
auf 3 %/Tick gesenkt, Mitspieler-Formation gemischt (zwei nah, zwei Mitteldistanz, zwei
außerhalb der Fernwurfreichweite). Sichtbar im Feed: echte Passketten
(„Greenkraut passt zu Seraph-11. Seraph-11 passt zu Tidesprinter. Tidesprinter passt zu
Greenkraut. Greenkraut trifft — +2.") statt sofortiger Alleingänge.

### Opus-Review vor dem Balance-Tuning — sieben echte Korrektheitsfehler, keine Balance-Frage

Chris' ausdrückliche Auflage: erst ein Review durch Opus, dann erst Balance-Tuning. Gut
so — der Review (instrumentierte Kopie, fünf komplette Spiele Tick für Tick protokolliert)
fand, dass die Engine bei 84,6 Pp mechanisch **gar nicht lief**, nicht schlecht
balanciert war: ein 45-Sekunden-Spiel produzierte 4-6 Ereignisse, der Ball lag bis zu 30s
tot herum, drei der fünf Ereignistypen (Steal, Block, Nah-/Fernwurf) wurden nie erreicht.
Balance-Tuning auf diesem Stand hätte Konstanten justiert, die nie gelesen werden. Sieben
Funde, alle behoben:

1. **Ball blieb liegen.** `bewegeSpielerLive` fragte `fsLive.ball.traeger?.side` ab — das
   ist während Flug UND freiem Liegen `null`, also liefen alle zwölf Spieler in die
   Ruheformation zurück und blieben dort (gemessen: bis zu 30,5 s Stillstand). Fix: eine
   einzige Quelle dafür, wer angreift — `fsLive.amBall`, gesetzt in `ballUebernehmen`.
2. **`fsLive.amBall` wurde gesetzt und nie gelesen** — genau das Feld, das Fund 1 braucht.
3. **Nah-/Fernwurf waren unerreichbar.** Der Ballführer hatte ZWEI Dämpfungsfaktoren
   hintereinander (Ziel-Fraktion *und* Lerp), effektiv ~0,2 % der Reststrecke pro Tick —
   17-19 s bis zur Wurfreichweite bei 8 s Schussuhr. Jeder Angriff war Dribbeln plus
   Verzweiflungswurf. Fix: ein Schritt, eigene (langsamere als die geteilte) Lerp-Rate
   fürs Dribbeln.
4. **Steal/Block waren unerreichbar.** Der Decker-Abstand war PROPORTIONAL zur Distanz
   des Manns vom Korb (bei 450 px Korbabstand 135 px Sag) — weit außerhalb von
   `STEAL_REICHWEITE`(45)/`BEDRAENGT_RADIUS`(30). Fix: Sag gedeckelt auf 35 px.
5. **Doppeldeckung in ~85 % aller Ticks**, weil `zuordneDeckung`s Teil-Durchlauf die
   volle Angreiferliste als „frei" ansah, obwohl übersprungene Verteidiger ihren Mann
   behielten. Verzerrte jede ABWEHR-Messung.
6. **Assists entstanden faktisch nur noch beim Alley-Oop** — ein normaler Pass reichte
   den Passgeber nie bis zum späteren Wurf durch.
7. **Der Spielzug war von einer Pass-Veredelung zur unabhängigen Alternative bei jeder
   Entscheidung geworden**, ohne Distanzprüfung — gemessene Alley-Oops aus 438-679 px
   Entfernung, obwohl das Vorab-Modell ausdrücklich „Nahdistanz-Kombinationen" meint.

Dazu kleinere, unabhängige Funde: `u.lunge` wurde im Live-Pfad nie gesetzt (keine
Wurf-/Pass-Animation mehr), ein toter Startwert für `reevBall`, ein 20 px-Versatz
zwischen simuliertem und gezeichnetem Korb — alle mitbehoben.

**Ergebnis, gemessen statt behauptet:** `messe-arena-einfluss.mjs basketball 48` fällt
allein durch diese Korrektheitsfixes von 84,6 auf **48,2 Pp** — noch vor jeder gezielten
Balance-Arbeit. Alle Ereignistypen treten jetzt in jedem Spiel auf (Playwright-Check: 17
Pässe, 9 Treffer, 17 Fehlwürfe, 21 Rebounds, 3 Steals, 4 Blocks in einem einzelnen
Spiel), Alley-Oop weiterhin bestätigt (732 Auslöser über viele Simulationsläufe). Nur
Intelligence liest noch exakt 0 % — das ist jetzt echtes Balance-Tuning, kein
Korrektheitsfehler mehr.

Die Aufstellung wirkte vorher visuell noch zu sehr wie eine Reihe — als Nebeneffekt der
Opus-Fixes (gemischte Mitspieler-Formation für Fund 3, s. o.) inzwischen erledigt, kein
eigener Posten mehr.

### Erste Balance-Runde: Intelligence gefunden und behoben — 32,5 Pp

Direkt im Anschluss an die Opus-Fixes die erste echte Balance-Runde, wie von Chris
angeordnet. Statt zu raten: den rohen (ungeklammerten) Einfluss jedes Attributs über
`einflussVon`s internen `roh`-Wert ausgelesen (`Anteil` in der Ausgabe zeigt nur positive
Werte — ein negativer Rohwert erscheint dort als „0 %", ist aber trotzdem voll in die
Pp-Abweichung eingerechnet). Intelligence: **-0,033**, als einziges sinnvoll gewichtetes
Attribut negativ, alle anderen positiv (0,04 bis 0,18).

**Ursache gefunden, nicht vermutet:** ein hoher AUFBAU-Wert erhöhte die eigene
Passbereitschaft (`passChance=0.35+u.AUFBAU*0.0030`) so stark, dass ein Spieler mit hoher
Intelligence (40 % Anteil an AUFBAU, der höchste Einzelwert dort) seine eigenen Punkte
häufiger gegen Assists eintauschte, als der Zusatzschub durch die häufigere
Ballführer-Rolle das wettmachte. Spirit traf derselbe Mechanismus kleiner (nur 30 %
Anteil an AUFBAU) und profitierte zusätzlich stark über TEAMGEIST (55 % Anteil, mit
0,0060 der höchste Koeffizient in der Wurfformel) — deshalb las Spirit stark positiv,
Intelligence negativ, obwohl beide über AUFBAU denselben Hebel ziehen.

**Durchgemessen statt geraten**, `messe-arena-einfluss.mjs basketball 48`, nur der
AUFBAU-Koeffizient in `passChance` verändert:

| Koeffizient | Pp | Intelligence |
|---|---|---|
| 0,0030 (Original) | 48,2 | 0 % (roh: -0,033) |
| 0,0010 | 48,3 | 5,5 % |
| 0,0005 | 40,7 | 9,4 % |
| 0,0003 | 36,6 | 11,1 % |
| **0,0002 (gewählt)** | **32,5** | **13 %** |

0,0002 reproduzierbar bestätigt (zweimal identisch gemessen). Nicht monoton bis 0
durchprobiert — ein Test ganz ohne AUFBAU-Einfluss (`passChance=0.5` fest) lag bei 41,6
Pp, schlechter als 0,0002. Es gibt also ein Optimum, keinen einfachen "je weniger, desto
besser"-Zusammenhang; 0,0002 ist der beste unter den getesteten Werten, kein Beweis für
global optimal. **PLATZHALTER, kein Endwert.**

**32,5 Pp liegt jetzt in derselben Größenordnung wie das alte Vorab-Modell (27-32 Pp)** —
nach zwei Runden (Opus-Fixes: 84,6→48,2 Pp, diese Balance-Runde: 48,2→32,5 Pp) hat die
Live-Engine die Vorab-Engine in Sachen Werte-Treue eingeholt. Verbleibende Lücken, alle
bereits aus früheren PRs bekannt und hier nicht neu: Dexterity überrepräsentiert (+9,8 Pp
— dieselbe seit #656 bekannte Dexterity-Frage, dort sitzt der Wert gleichzeitig in
AUFBAU/ABSCHLUSS/TECHNIK), Speed/Torment leicht unterrepräsentiert. Funktional per
Playwright gegengeprüft: 16 Pässe, 12 Treffer, 5 Fehlwürfe, 7 Rebounds, 2 Steals, 2
Blocks in einem Spiel, Endstand 16:15 — ein erkennbar echtes, kompetitives Spiel.

### Vier Spielgefühl-Funde nach dem ersten Live-Zusehen (Chris' Feedback)

Direkt nachdem Chris das erste Mal beim Live-Basketball zugesehen hat, vier konkrete
Rückmeldungen — keine Balance-Fragen, sondern Lücken in dem, was überhaupt passieren
konnte:

**Rebounds wirkten wie ein Teleport.** `stepBasketballLive` löste einen freien Ball beim
ALLERERSTEN Spieler in `GREIF_REICHWEITE` sofort auf — ein zweiter, fast gleichzeitig
ankommender Spieler kam nie zum Zug. Neu: `fsLive.reboundKampf` haelt bei ≥2 Spielern in
Reichweite eine kurze Ringphase (0,55s PLATZHALTER) offen, in der noch weitere Spieler
heranlaufen können (sie tun das ohnehin schon über `LAUF_ZUM_BALL_RADIUS`), bevor der
Gewinner gewürfelt wird. Ein Feed-Ereignis „Kampf um den Rebound!" markiert den Beginn.
Bei nur einem Spieler in Reichweite bleibt es beim sofortigen Greifen — kein Gegner, mit
dem sich streiten ließe.

**Verteidigung konnte keine Pässe abfangen.** `versucheSteal` griff nur, solange der Ball
bei einem Spieler war — ein abgespielter Pass war die gesamte Flugzeit über unantastbar,
selbst wenn ein Verteidiger direkt in der Passlinie stand. Neu: `passeAb` würfelt beim
Abwurf (nicht bei Ankunft — dasselbe Determinismus-Muster wie `wirf`s `treffer`), ob der
Verteidiger mit dem kürzesten Abstand zur Passlinie (`distZuLinie`, Punkt-zu-Strecke)
innerhalb von `PASSLINIE_RADIUS` (55px, PLATZHALTER) abfängt. Chance hängt von seiner
ABWEHR und der Nähe zur Linie ab (3-32 %, PLATZHALTER-Formel). Per Playwright bestätigt:
in einem 60-Sekunden-Testlauf feuerte die erste Interception nach 6 Sekunden.

**Die Wurfanimation war eine Waffenanimation.** `zeichneSprite` kannte für den
Ausfallschritt (`lunge>0`) nur zwei Zustände: „shoot" (Bogenzug) für Charaktere mit
`waffe:"bogen"`, sonst „slash" (Schwerthieb) — beides falsch für einen Korbleger. Feldspiel
bekommt jetzt über einen neuen `feldspiel`-Parameter immer die „shoot"-Pose, aber ohne
jedes Waffen-Overlay (`bogen_shoot`/`schwertbg_fg_slash` werden dort nie gezeichnet) —
die einzige Ueberkopf-Bewegung, die der Baukasten kennt, ohne Waffe in der Hand.

**Die Wertungstabelle stand im Feldspiel komplett auf „–".** `renderWertung()` liest
`u.st.dmg/heal/tank/verh/ko` — Felder, die Feldspiel-Einheiten nie hatten. Die eigentlich
längst mitgezählten Werte (`punkte/rebounds/assists/steals/bloecke/verluste`, seit dem
ursprünglichen `bauSpieler` vorhanden und von `wirf`/`versucheSteal`/`loeseFlugAuf`
befüllt) wurden nirgends angezeigt, weil `updateHudFeldspiel()` nie eine Wertungsfunktion
aufrief. Neu: `renderWertungFeldspiel()` plus `setWertungKopf()` (schaltet die
Tabellen-Header inklusive Fußzeile zwischen Kampf- und Feldspiel-Beschriftung um) zeigen
jetzt Punkte/Rebounds/Assists/Steals/Blocks/Verluste.

**Nebenbei aufgefallen und mitkorrigiert:** vier Spieler aus Chris' eigenem Team (Lava
Golem, Inefinna, Lulu, Xelara) hatten in `BILDBEFUNDE` noch mehrere Kandidat-Archetypen
statt eines einzelnen (aus Batch 2), UND — wichtiger — die live-animierte Ansicht liest
ihre Sprite-Rezepte aus einer eigenen `BAU`-Tabelle in `battle-mode.html`, komplett
unabhängig von `BILDBEFUNDE`. Lava Golem lief dort z. B. weiterhin als Ork mit Platte und
Schwert, obwohl sein Kartenbild einen unbewaffneten Lavakoloss zeigt — die beiden Systeme
sind nicht verknüpft, ein Fund für sich, der bei künftigen Sprite-Batches mitgedacht
werden muss: ein `BILDBEFUNDE`-Eintrag allein ändert nichts an dem, was man im Kampf
tatsächlich sieht.

### Asset-Lage — Bewertung (Fable, Recherche bereits vorher abgeschlossen)

Auf OpenGameArt gibt es **keine** fertigen 2D-Top-Down-Court/Field-Tilesets im passenden
Stil für Basketball, American Football oder Eishockey — vielfach nachgesucht, nichts
Brauchbares. Empfehlung, der hier gefolgt wird: **bei selbst gezeichneten Canvas-Feldern
bleiben** (wie Basketball in #660, jetzt auch Football) statt ein fremdes Tileset zu
verbiegen — die Felder müssen ohnehin exakt zu den Korb-/Zonen-Positionen der Simulation
passen. Gefundene Icon-Assets (CC0-Basketbälle, ein CC-BY-3.0-American-Football-Sprite-
Set von BananaCat mit Football-/Torstangen-Icon) sind für eine spätere Runde brauchbar,
aber noch **nicht eingebaut** — das bräuchte eine Lizenzdatei
(`public/mockups/assets/LIZENZEN.md`, analog zur bestehenden Asset-Handhabung) und ist in
dieser Änderung nicht enthalten. Eine zweite Suchrunde für Court-Tilesets lohnt laut
Fable kaum; für die fehlenden SFX (siehe unten) sei freesound.org ergiebiger als
OpenGameArt — auch das noch nicht verfolgt.

### Sound — Konzept, nicht implementiert

Es gibt **keine** Audio-Infrastruktur im Mockup (kein `new Audio`, keine Sounddatei im
Repo) — kompletter Neubau, hier bewusst nicht angefangen, weil er eine eigene, größere
Änderung wäre. Fables Vorschlag als Grundlage für später:

| Kategorie | Ereignis | Quelle (gefunden, nicht geprüft/eingebaut) |
|---|---|---|
| Grundrauschen (Loop) | während des Spiels | Crowd-Cheering-Paket, Ambient-Track |
| Jubel klein | `treffer` normal | Crowd-Cheering, „Soft"-Track |
| Jubel mittel | `treffer` mit `fern` | Crowd-Cheering, kurzer „Strong"-Track |
| Jubel groß | `treffer` mit `zug` gesetzt; Sieg | Crowd-Cheering, langer „Strong+rhythmic"-Track |
| Anerkennung | `rebound`, `block` | Applause (CC-BY 3.0) |
| Pfiff | Spielbeginn/-ende | Whistle (Kim Lightyear, CC-BY 3.0) |

Anbindung technisch gedacht (nicht gebaut): ein `AudioContext`, entsperrt beim ersten
Klick, Trigger direkt in `stepFeldspiel` an der Stelle, an der `feed(...)` schon läuft —
der Ereignistyp (inkl. `e.zug`) ist dort bereits vollständig bekannt, exakt der Haken, an
dem auch der `_gross`-Jubel-Text oben hängt. Schuhquietschen und Ballaufprall wurden
gesucht und **nicht gefunden** — echte Lücke, offen für eine freesound-Runde.

### Was dem Feldspiel-Motor noch fehlt — Priorität (Fable, unverändert übernommen)

1. **Trainer-Anweisung/taktische Pläne.** Bestätigte Lücke: `plaene`/`planJeSlot`
   existieren nur in `BAHN_ART` (`grep -n "plaene:{" battle-mode.html` — alle Treffer
   zwischen Zeile 5518 und 5719, keiner in `FELDSPIEL_ART`/`BUEHNE_ART`). Sinnvollster
   nächster Schritt, aber **teamweit statt je Slot** (Feldspiel-Züge sind Teamzüge) — z. B.
   „Tempo-Spiel" (fernAnteil ↑, Passchance ↓), „Kontrolliert" (Passchance ↑,
   Spielzug-Neigung ↓), „Spektakel" (Spielzug-Neigung ×2, Abschluss-Basis ↓). Noch nicht
   gebaut.
2. **Schlussphasen-Dramaturgie.** Bei knappem Stand die Enthüllung der letzten Züge
   verlangsamen, Feed markieren, Jubel-Kategorie anheben — reine Enthüllungs-Regie über
   die längst vorberechneten `fsZuege`, kein Simulationseingriff.
3. **Momentum sichtbar machen.** Serien erkennen (Steal→Fast-Break-Ketten, mehrere
   Treffer in Folge) und im Feed/Crowd-Pegel spiegeln.
4. **Endstands-Rückblick.** Die Zähler (`punkte, rebounds, steals, bloecke, assists,
   verluste`) existieren pro Spieler bereits vollständig — eine Bestenkarte nach `done`
   ist billig und belohnt genau das, was der Spieler bei der Aufstellung eingestellt hat.
5. **Bühne nachziehen.** Dieselbe Plan-Struktur aus Punkt 1 passt später auf
   `BUEHNE_ART` als Risiko-Regler — nicht jetzt bauen, aber die Feldspiel-Pläne so
   entwerfen, dass die Struktur dort wiederverwendbar bleibt.

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
| Spielzug-Neigung (Alley-Oop) | `clamp(0,06+(TECHNIK_pg−50)·0,0020+(ZWEITCHANCE_bf−50)·0,0020; 0,02; 0,22)` |
| Spielzug-Erfolg (Alley-Oop) | `min(0,90; 0,10+ABSCHLUSS_bf·0,0045+TECHNIK_pg·0,0025)` |
| Spielzug-Neigung (Screen Pass) | `clamp(0,05+(AUFBAU_pg−50)·0,0018+(ABSCHLUSS_bf−50)·0,0018; 0,02; 0,20)` |
| Spielzug-Erfolg (Screen Pass) | `min(0,88; 0,12+ABSCHLUSS_bf·0,0040+AUFBAU_pg·0,0020)` |
| Spielzug-Neigung (Deep Ball) | `clamp(0,04+(TECHNIK_pg−50)·0,0015+(ZWEITCHANCE_bf−50)·0,0015; 0,02; 0,16)` |
| Spielzug-Erfolg (Deep Ball) | `min(0,80; 0,07+ZWEITCHANCE_bf·0,0035+TECHNIK_pg·0,0020)` |
| Choreografie-Amplituden (Alley-Oop-Hop / Screen-Wobble / Deep-Ball-Bogen) | 28 px / 16 px / 75 px |

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
7. Sollen `BUEHNE_ART`/`FELDSPIEL_ART` ein `lang`-Objekt für ihre sieben Rollen bekommen
   (wie `BAHN_ART`), inklusive der Verdrahtung, die beim Bahn-Vorbild bisher fehlt? Die
   25 Störwert-Namen oben sind davon unabhängig umsetzbar.

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
