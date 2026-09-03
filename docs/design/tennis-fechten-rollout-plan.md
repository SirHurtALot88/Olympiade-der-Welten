# Recherche: Tennis und Fechten — Chassis-Wechsel, Sport-Referenzen, Assets, Migrationsplan (Fable)

Stand: Branch `claude/tennis-fechten-recherche`, abgezweigt von `origin/claude/sonde-alle-disziplinen`
`1a6d417a` (03.09.2026, nach der Mini-DM/TDM/Battlefield-Recherche). `engine.js` meint
`public/mockups/battle-mode.engine.js`. Alle Datei-/Zeilenangaben sind gegen genau diesen Stand
geprüft. Reine Recherche/Planung — kein Commit an der Engine, keine Motoränderung im Repo.

Auftrag: den Befund aus `docs/design/projekt-ueberwachung-opus.md` Abschnitt 2.4 prüfen — Tennis
(heute Feldspiel) und Fechten (heute Arena) gehören strukturell eher zu den Bühnen-Duell-Disziplinen
wie Speed-Schach (rho 0,950, beste Rangtreue aller zwanzig). Chris' ausdrückliche Vorgabe:
**Basketballs bereits finalisiertes System ist Pflicht-Benchmark**, nicht Nebensache.

**Methodik-Hinweis, wichtig für alles Folgende:** Zwei Zahlen unten (Abschnitt A.3/A.4) stammen aus
einer eigenen Sonde — einer Kopie von `public/mockups/` im Scratchpad, mit zwei testweise
eingefügten Bühnen-Einträgen (`tennisduell`, `fechtenduell`). Genau dieselbe Praxis wie
`arena-duell-recherche-fable.md` Abschnitt 0.2 ("Kopie von `public/mockups/` im Scratchpad; kein
Motor im Repo wurde angefasst"). `git status` am Ende dieser Recherche ist leer.

---

## 0. Die wichtigsten Funde vorab

1. **Der Chassis-Wechsel-Verdacht bestätigt sich, und stärker als erwartet.** Tennis' bestehendes
   Feldspiel-Rezept — **ohne eine einzige Gewichtsänderung**, nur umbenannt auf die sieben
   Bühnen-Rollennamen — hebt rho im Bühnen-Duell-Rahmen von **0,605 auf 0,919** (Saison 0,762 →
   0,958), robust bei jeSeite 6/4/2 (0,919/0,860/0,833). Für Fechten hebt schon eine **naive**
   Bühnen-Duell-Variante (kein interaktiver Paar-Rechner, nur ein erster Rezept-Entwurf aus der
   bestehenden Arena-Matrix) rho von **0,495 auf 0,894** (Saison 0,559 → 0,958), robust bei
   jeSeite 6/4/2 (0,894/0,880/0,908). Beide Zahlen liegen komfortabel über der 0,80-Schranke, ohne
   dass irgendeine Balancing-Runde stattgefunden hätte (Abschnitt A.3/A.4).
2. **Der Treiber ist nicht "Duell" allein, sondern zwei bereits gemessene, bereits behobene
   Mechanik-Entscheidungen.** Erstens: `wert()` der Bühne liest heute `u.summe` (eigene Punkte),
   nicht `u.vorteil` (Differenz zum Gegner) — genau der Fix, den `arena-duell-recherche-fable.md`
   Abschnitt 4.3 für Speed-Schach/I-Spy verlangte (W1), und er ist bereits scharf
   (`engine.js:15744`). Zweitens: die Bühnen-Punkteformel (`engine.js:9060-9070`) ist eine glatte,
   monotone Funktion derselben Sub-Skills, aus denen auch `eig` gebaut wird — das ist exakt der
   Befund aus `projekt-ueberwachung-opus.md` Abschnitt 1.2 ("die Formel ist glatt … deshalb liefert
   sie Spitzen-rho"). Ein Chassis-Wechsel schaltet beide Effekte gleichzeitig frei.
3. **Ein echter Hinderungsgrund für Tennis existiert — er trifft nur nicht das, was zuerst vermutet
   wurde.** Die Bühne hat kein Ball-Overlay, keine Rally-Animation, kein Netz: ein Ballwechsel wird
   dort so abstrakt dargestellt wie eine Schachpartie. Das ist real ein Verlust an Sport-Anmutung —
   aber Tennis' heutiges Feldspiel-Bild ist selbst nur der generische Fußballplatz-Rückfall
   (`bodenFeldspiel`, `engine.js:8391-8399`: Mittelkreis, zwei Sechzehner-Bögen), kein Tennis-Court.
   Es geht also kein bestehendes Tennis-Bild verloren — es wird ein fehlendes Tennis-Bild gegen
   ein anderes fehlendes Bild getauscht (Abschnitt A.6).
4. **Die eigentlich wichtigste Einschränkung betrifft beide Disziplinen gleich, und sie steht schon
   in `projekt-ueberwachung-opus.md` Abschnitt 1.4: der Mockup-Motor erreicht das Spiel nicht.**
   Chris sieht heute weder Tennis noch Fechten über `battle-mode.engine.js` — die Produktions-Bühne
   (`app/foundation/discipline-stage/arena/disciplines/`) hat für **beide bereits eigene,
   sportlich passende Visuals**: Fechten läuft dort auf dem Primitive `lamps` ("Treffer-Lampen
   rot/grün" — die echte Fecht-Anzeigetafel!), Tennis teilt sich das Primitive `klassen` explizit
   mit Speed-Schach ("Setzköpfe-Court" neben Speed-Schachs "Elo-Klassen-Brett",
   `DisciplineStageArena.tsx:126-128`) — **unabhängig bestätigt, aus einem völlig anderen
   Codeteil, dass Tennis strukturell schon mit Speed-Schach verwandt gebaut wurde.** Diese
   Produktions-Bühne wird aber vom **alten PPS-Rangtabellen-Pfad** gespeist
   (`lib/resolve/legacy-matchday-resolve-types`), nicht vom hier diskutierten Chassis. Der
   Chassis-Wechsel ist die Voraussetzung für eine belastbare Abnahmezahl und für eine spätere
   Live-Motor-Beförderung (wie bei Basketball) — er ändert für sich genommen noch nichts im
   Spiel, das Chris heute sieht (Abschnitt A.7).
5. **Assets sind für beide Disziplinen der kleinere Teil der Arbeit, aus unterschiedlichen
   Gründen.** Für Fechten ist das Waffen-Overlay-System bereits generisch produktiv
   (`arena-mini-dm-tdm-battlefield-rollout-plan.md` Abschnitt 2.2, heute schon fertig) — es fehlt
   nur eine fechtspezifische Klinge, die es in keinem der zwei genutzten Sprite-Pakete gibt
   (Abschnitt D.1). Für Tennis liegen Ball UND Schläger bereits lizenzgeklärt im selben
   Kenney-Paket, aus dem schon Basketballs Korb kommt (selbst heruntergeladen und geprüft,
   Abschnitt D.2) — sie wären für die Bühne aber ungenutzt, weil dort kein Ball gezeichnet wird.

---

## Teil A — Verifikation des Chassis-Wechsel-Vorschlags

### A.1 Aktuelle Zahlen, frisch gemessen

    node scripts/miss-alle-disziplinen.mjs 24 tennis fechten speed-schach

| Disziplin | Chassis | rho je Spiel | rho Saison | Abnahme |
|---|---|---:|---:|---|
| Speed-Schach | Bühne | 0,950 | 0,986 | bestanden |
| Tennis | Feldspiel | 0,605 | 0,762 | durchgefallen |
| Fechten | Arena | 0,495 | 0,559 | durchgefallen |

Deckungsgleich mit `projekt-ueberwachung-opus.md` Abschnitt 1.1 und `stand-aller-disziplinen.md` —
kein Drift seit dem 02./03.09.

### A.2 Wie Speed-Schachs 0,950 zustande kommt — der Bühnen-Duell-Mechanismus im Detail

`BUEHNE_ART["speed-schach"]` (`engine.js:8960-8979`) trägt `jeSeite:6, rundenN:10,
rundenDauer:60/(10*6*2), duell:true`. `bauBuehne` (`engine.js:9012 ff.`) rechnet für **jeden**
Teilnehmer unabhängig `rundenN` Durchgänge vorab, mit derselben Formel, die alle sechs
Nicht-Duell-Bühnen-Disziplinen auch benutzen (`engine.js:9060-9070`):

```js
const basis  = (20 + L.GRUNDLAGE*0.7) * Math.max(0.4, ermued);
const erfolg = Math.min(0.94, 0.15 + L.TECHNIK*0.0055 + L.NERVEN*0.0035);
// bei Erfolg: punkte = basis + L.SPITZENMOMENT*0.35*(0.4 + L.WAGNIS*0.006)
// sonst:      punkte = basis * art.failAbzug
punkte = Math.max(0, Math.round(punkte + L.PUBLIKUM*0.12));
```

`art.duell` (`engine.js:9086-9100`) paart danach Brett `i` gegen Brett `i` und rechnet zusätzlich
einen laufenden `vorteil` (Punktdifferenz je Runde) — aber **`wert()` liest diesen Vorteil nicht**:

```js
// engine.js:15744 — MOTOREN[bd].wert für ALLE Buehnen-Disziplinen, auch Duelle
wert:()=>{const o={}; for(const u of TEILNEHMER)o[u.n]=u.summe; return o;}
```

Der Kommentar direkt darüber (`engine.js:15730-15743`) zitiert exakt die Messung aus
`arena-duell-recherche-fable.md` Abschnitt 4.2 (rho gegen Vorteil 0,541/0,548, rho gegen eigene
Punkte 0,948/0,782) und begründet die Entscheidung mit Gewichthebens eigenem Satz: "ein Heber, der
an einem starken Slot 380 kg hebt, hat 380 kg gehoben, auch wenn er verliert." **Dieser Fix ist
bereits scharf** — er ist keine offene Empfehlung mehr, sondern der Ist-Zustand, den diese
Recherche vorfindet und auf dem die Zahlen unten aufbauen.

Was daraus folgt: Speed-Schachs 0,950 ist NICHT in erster Linie eine Eigenschaft der
Duell-Paarung, sondern **die Kombination aus (a) einer glatten, monotonen Punkteformel, die aus
denselben Sub-Skills gebaut ist wie `eig`, und (b) einer Wertung, die die eigene Leistung misst,
nicht die Leistung relativ zu einem fast unkorrelierten Gegner.** Beides ist unabhängig vom Inhalt
des Rezepts — es ist eine Eigenschaft des Chassis. Das ist die Hypothese, die A.3/A.4 direkt testen.

### A.3 Eigene Sonde: Tennis' bestehendes Rezept, unverändert, im Bühnen-Duell

**Aufbau.** In der Scratchpad-Kopie wurde `BUEHNE_ART` um einen Testeintrag `tennisduell` ergänzt —
**Zeile für Zeile dasselbe Rezept wie `FELDSPIEL_ART.tennis`** (`engine.js:3903-3911`), nur mit den
sieben Rollennamen der Bühne statt des Feldspiels (1:1-Umbenennung, keine Gewichtsänderung):

| Feldspiel-Rolle (Original) | → Bühnen-Rolle | Attribute (unveraendert) |
|---|---|---|
| AUFBAU | GRUNDLAGE | intelligence 40, awareness 35, spirit 25 |
| ABSCHLUSS | SPITZENMOMENT | dexterity 35, intelligence 35, speed 30 |
| TECHNIK | TECHNIK | intelligence 50, awareness 35, determination 15 |
| ZWEITCHANCE | NERVEN | stamina 40, determination 35, awareness 25 |
| ABWEHR | WAGNIS | intelligence 35, awareness 35, dexterity 30 |
| TEAMGEIST | PUBLIKUM | spirit 55, charisma 45 |
| AUSDAUER | AUSDAUER | stamina 50, determination 30, spirit 20 |

`jeSeite:6, rundenN:10, duell:true`, `BASIS_JE_DISC["tennisduell"]` = derselbe Matrix-Eintrag wie
`BASIS_JE_DISC.tennis` (`engine.js:2947`, unverändert). Kein Attribut wurde umgewichtet, keine
Konstante der Formel angefasst — nur die Chassis-Zugehörigkeit.

**Ergebnis** (`node`-Sonde gegen die Scratchpad-Kopie, `disziplinProbe`, n=24, identische Saaten
wie `miss-alle-disziplinen.mjs`):

| | Tennis (Feldspiel, Ist) | Tennisduell (Bühne, Testinstanz) |
|---|---:|---:|
| rho je Spiel | 0,605 | **0,919** |
| rho Saison | 0,762 | **0,958** |

Robustheit über die von CLAUDE.md geforderten Kadergrößen (`disziplinProbe(d,{n,jeSeite})`):

| jeSeite | rho je Spiel (Tennisduell) |
|---:|---:|
| 6 | 0,919 |
| 4 | 0,860 |
| 2 | 0,833 |

Alle drei liegen über der 0,80-Schranke — **ohne Rezeptrunde, ohne Sinkhorn, ohne
Matrix-Anpassung**. Das ist der stärkstmögliche Beleg für den Chassis-Verdacht: dieselben
Attributgewichte, dieselbe Eignung, nur ein anderes Chassis darum herum.

### A.4 Eigene Sonde: Fechten, naiv, mit einem ersten (nicht finalen) Rezept-Entwurf

Fechten hat kein Sieben-Rollen-Rezept, das man umbenennen könnte — die Arena kennt nur fünf Rollen
(ANG/VER/LP/TMP/AUS). Für den Test wurde deshalb ein **erster, ausdrücklich nicht finaler**
Sieben-Rollen-Entwurf aus `ARENA_ART.fechten`s realer Matrix gebaut (torment 25, dexterity 20,
speed 16, awareness 15, power 10, determination 6, health 4, intelligence 4 — unverändert
übernommen, `engine.js:2957`):

```
GRUNDLAGE:     torment 45, dexterity 30, awareness 25
SPITZENMOMENT: dexterity 40, speed 35, torment 25
TECHNIK:       torment 40, dexterity 35, awareness 25
NERVEN:        determination 40, awareness 35, health 25
PUBLIKUM:      intelligence 50, health 50
AUSDAUER:      speed 40, power 35, health 25
WAGNIS:        speed 45, torment 30, power 25
```

Genau wie das Original: kein Charisma (Fechten hat laut Matrix keins), Torment am stärksten
vertreten (vier Rollen), Determination/Health/Intelligence (die drei schwächsten Matrixwerte) auf
je eine Rolle beschränkt. Duell wie Speed-Schach: **unabhängig berechnet, dann `vorteil`
gebildet — kein interaktiver Paar-Rechner** (dazu mehr in A.5).

**Ergebnis:**

| | Fechten (Arena, Ist) | Fechtenduell (Bühne, naiver Testentwurf) |
|---|---:|---:|
| rho je Spiel | 0,495 | **0,894** |
| rho Saison | 0,559 | **0,958** |

| jeSeite | rho je Spiel (Fechtenduell) |
|---:|---:|
| 6 | 0,894 |
| 4 | 0,880 |
| 2 | 0,908 |

Auch hier: robust über alle drei Kadergrößen, deutlich über der Schranke — mit einem Rezept, das
niemand kalibriert hat. Der Sprung ist noch größer als bei Tennis, weil Fechtens Arena-Ausgangswert
strukturell schlechter war (Abschnitt A.7 unten: Arenas `aufEignung()`-Normierung plus die
6-gegen-6-Fehlpassung, `arena-duell-recherche-fable.md` Abschnitt 3.4 hat das bereits ausführlich
hergeleitet — diese Recherche bestätigt es jetzt mit einer tatsächlich lauffähigen Zahl, nicht nur
mit einer Herleitung).

### A.5 "Ohne neuen Motor" — stimmt das wirklich?

**Für Tennis: ja, uneingeschränkt.** `bauBuehne`/`stepBuehne`/`zeichneBuehne` sind bereits
disziplinübergreifend gebaut (dieselbe Weiche wie Basketballs `if(art.live)`, nur für die Bühne:
`istBuehne=(d)=>!!BUEHNE_ART[d]`). Ein neuer `BUEHNE_ART.tennis`-Eintrag reicht technisch aus.

**Für Fechten: ja für die Abnahmezahl, aber mit einer echten Qualitätsfrage offen.** A.4 zeigt: die
**naive** Duell-Variante (unabhängig würfeln, dann Differenz bilden — wie Speed-Schach) reicht
bereits, um die 0,80-Schranke zu reißen. Das ist NICHT die sportlich korrekte Abbildung eines
Gefechts: `arena-duell-recherche-fable.md` Abschnitt 3.4 weist zurecht darauf hin, dass ein
Gefecht **interaktiv** ist — der Gegner entscheidet mit, ob mein Angriff trifft — und empfiehlt
deshalb den Bauplan von `baueHebenDuelle` (`engine.js:9195-9253`, Gewichthebens Duellrechner) statt
des unabhängigen Speed-Schach-Musters: ein Paar-Rechner, der beide Fechter im selben Durchlauf
gegeneinander stellt, mit einer Elo-artigen Erfolgskurve `p = 1/(1+10^(-Δ/k))` statt zweier
unabhängiger Würfe. **Der Befund dieser Recherche ist also zweigeteilt:** die Abnahmezahl braucht
diesen Mehraufwand nicht (0,894 reicht schon naiv) — aber das **Spielgefühl** eines Gefechts (wer
pariert, wer kontert, Prioritätsregeln bei Doppeltreffern) tut es. Das ist eine
Zwei-Phasen-Empfehlung, keine Blockade (Abschnitt E.2).

### A.6 Der eine echte Hinderungsgrund: keine Ballmechanik auf der Bühne — aber auch keine im Feldspiel

`zeichneBuehne` (`engine.js:9437 ff.`) zeigt Teilnehmer als stehende Figuren mit Punktesäule,
plus kurzer Ausfallpose (`lunge`) beim aufgedeckten Durchgang — **kein Ball, kein Netz, keine
Flugbahn**. Ein Ballwechsel wird exakt so abstrakt dargestellt wie ein Schachzug oder ein Preisrätsel
bei I-Spy. Das ist ein reales Zugeständnis an die Sport-Anmutung, wenn man es gegen ein IDEALES
Tennis-Bild hält.

Es ist aber **kein Verlust gegen den heutigen Ist-Zustand**: `bodenFeldspiel()` zeichnet für Tennis
keinen Court, sondern den generischen Fallback für "Feldspiel, nicht Basketball, nicht Hockey,
nicht Football" (`engine.js:8391-8399`) — ein Rechteck mit Mittellinie, Mittelkreis und zwei
Sechzehnmeter-artigen Bögen, exakt das Fußballfeld-Layout, das auch TDM & Co. als Nicht-Ball-Rückfall
nutzen würden, wenn sie Feldspiel wären. Kein Netz, keine Aufschlaglinie, kein Doppelfeld. Der
`fsBall` selbst ist ein generisches Objekt ohne tennis-eigenes Sprite (nur Basketball hat
`public/sprites/basketball/ball.png`). **Tennis hat heute also schon kein Tennis-Bild** — die
Bühne tauscht ein fehlendes Bild gegen ein anderes fehlendes Bild, verliert dabei aber die
generische Fußballfeld-Verwechslungsgefahr (ein Spieler könnte das heutige Feld für ein
Fußballfeld halten; ein Podest hält niemand für ein Tennis-Match, aber es hält auch niemand für
etwas Falsches — es ist bewusst abstrakt, wie bei Speed-Schach/I-Spy auch).

### A.7 Kritische Einordnung: was der Chassis-Wechsel NICHT löst

`projekt-ueberwachung-opus.md` Abschnitt 1.4 zeigt: `ARENA_RESOLVED_DISCIPLINE_IDS`
(`lib/resolve/battle-mode-arena-team-points.ts:32`) enthält **einen** Eintrag, `"basketball"`.
Weder Tennis noch Fechten laufen heute über den hier diskutierten Mockup-Motor im echten
Spielstand — beide werden stattdessen über den alten PPS-Rangtabellen-Pfad
(`distributeRankPointsToPlayers`, `lib/resolve/legacy-matchday-resolve-engine.ts:755-763`)
abgerechnet. Der Chassis-Wechsel hier ist die Vorstufe zu einer belastbaren Abnahmezahl und zu
einer möglichen künftigen Live-Motor-Beförderung (wie bei Basketball) — er ändert **für sich
genommen nichts** daran, was Chris heute im Spiel sieht.

Und genau das, was Chris heute sieht, ist bereits eigenständig und sportlich treffend gebaut —
unabhängig vom hier besprochenen Chassis, in einem komplett anderen Teil des Repos:
`app/foundation/discipline-stage/arena/disciplines/` (die "Discipline-Stage"-Bühne der
Produktions-App, gespeist vom `legacy-matchday-resolve-engine`, NICHT von `battle-mode.engine.js`).
`DisciplineStageArena.tsx:117-141` weist jeder Disziplin ein visuelles "Primitive" zu:

| Disziplin | Primitive | Kommentar im Code |
|---|---|---|
| `speed-schach` | `klassen` | "Liga-Klassen-Bänder (Elo-Klassen)" |
| `tennis` | `klassen` | "Liga-Klassen-Bänder (Setzköpfe)" |
| `fechten` | `lamps` | "Treffer-Lampen (rot/grün)" |
| `tdm` | `kda` | K/D/A-Scoreboard |
| `mini-dm` | `duelhp` | 1v1-Lebensbalken |
| `battlefield` | `territory` | Squarified Treemap |
| `basketball` | `court` | Wurfkarte (Halbfeld) |
| `hockey` | `rink` | Eisrink von oben |

**Zwei unabhängige Bestätigungen auf einen Schlag:** Erstens teilt sich Tennis in der
Produktions-App bereits explizit das `klassen`-Primitive mit Speed-Schach
(`registry.ts:73-76`: "klassen (geteilt): Speed-Schach = Elo-Klassen-Brett, Tennis =
Setzköpfe-Court") — eine zweite, von dieser Recherche unabhängige Bau-Entscheidung, die dieselbe
strukturelle Verwandtschaft zieht, die `projekt-ueberwachung-opus.md` und diese Recherche aus dem
Mockup-Motor herleiten. Zweitens hat Fechten dort bereits eine **sportlich korrekte, eigene**
Visualisierung (rot/grün-Ampeln — die echte Fecht-Anzeigetafel), losgelöst von der generischen
Arena-Sandgrube, die alle vier Kampf-Disziplinen im Mockup teilen (`bodenArena`,
`engine.js:12717 ff.`, gemeinsam für TDM/Mini-DM/Fechten/Battlefield). `tennis.tsx`
(`app/foundation/discipline-stage/arena/disciplines/tennis.tsx:1-16`) bestätigt das Baumuster
explizit: "Host bleibt WAHRHEIT: Score/Reveal/Ladder/Ticker/Hover/Pops kommen vom Host" — die
Feld-Datei animiert nur eine vom Host gelieferte Score-Zahl, unabhängig davon, welches der vier
Mockup-Chassis sie irgendwann einmal berechnen wird.

**Konsequenz für die Priorisierung:** der Chassis-Wechsel ist notwendig, aber nicht hinreichend,
und er ist NICHT der Hebel, mit dem Chris optisch etwas Neues sieht — dafür ist die Discipline-Stage
bereits zuständig und bereits fertig. Der Hebel dieser Recherche ist ausschließlich die
Abnahmezahl (CLAUDE.md) und die Vorbereitung einer künftigen Live-Motor-Beförderung.

---

## Teil B — Der Pflicht-Vergleich mit Basketball

### B.1 Was von Basketballs finalisiertem System übernommen wird

- **Die Kalibrierungsmethode, nicht das Rezept.** Basketballs `kurve:`-Block ist gegen 1074 echte
  NBA-Würfe kalibriert (logit-Korrektur je Distanzstufe, drei Fit-Durchgänge, jede Stufe mit
  Messwert dokumentiert). Das ist exakt das Vorgehen, das Tennis' und Fechtens neuem Bühnen-Rezept
  fehlt — die Entwürfe in A.3/A.4 sind Umbenennungen bzw. ein erster Entwurf, keine kalibrierten
  Kurven. Teil F unten überträgt genau diese Methode, mit ATP- bzw. FIE-Referenzzahlen statt
  NBA-Würfen.
- **"Eigene Punkte statt Differenz zum Gegner."** Gewichthebens Regel (`engine.js:9227-9229`: "ein
  Heber, der an einem starken Slot 380 kg hebt, hat 380 kg gehoben, auch wenn er verliert") ist
  zwar nicht Basketball selbst, aber dieselbe Kalibrierungsdisziplin, die Basketball vorlebt: eine
  Wertformel muss das messen, was am Feld tatsächlich passiert ist, nicht eine nachträgliche
  Kontextualisierung. Für Tennis/Fechten gilt sie bereits (A.2), weil sie in `wert()` global für
  alle Bühnen-Disziplinen implementiert ist — nichts zu tun, aber wichtig zu wissen, dass es kein
  Zufall ist, dass es funktioniert.
- **Miss-Skript-getriebene Iteration.** Basketballs Weg von 0,786 auf 0,820 lief über gemessene,
  dokumentierte Einzeländerungen (`miss-basketball-rangtreue.mjs`,
  `miss-arena-feldspiel-spiegel.mjs`). Für eine echte Rezeptrunde fehlt für die Bühne bislang das
  Basketball-Äquivalent zu `scripts/baue-feldspiel-rezept.mjs` — das ist dieselbe Lücke, die
  `projekt-ueberwachung-opus.md` Abschnitt 2.3 für alle Bühnen-/Bahn-Disziplinen benennt, und sie
  betrifft Tennis/Fechten nach dem Umzug genauso (Abschnitt F.2).

### B.2 Was bewusst NICHT übernommen wird: Basketballs Live-Motor-"Duell-Struktur"

Das ist der Punkt, den Chris' Vorgabe am ausdrücklichsten verlangt zu diskutieren. Der Motor
selbst sagt an einer Stelle wörtlich, dass er Tennis eigentlich für den Basketball/Hockey-Pfad
vorgesehen hatte:

```
// engine.js:5606-5613
// Football (Snap-Formation), Hockey (Bully) und Tennis (Aufschlag) brauchen exakt
// dieselbe Struktur.
```

`initFeldspielLive`/`stepFeldspielLive`/`zuordneSlots`/`bewegeSpielerLive` — Basketballs
Manndeckung, Zonen, echte Ballpositionen und Spielzüge — sind bereits disziplinübergreifend
gebaut. Tennis KÖNNTE also, statt auf die Bühne zu wechseln, denselben Weg gehen, den Hockey schon
gegangen ist: ein eigener Live-Motor mit echtem Aufschlag-Bully-Analogon, echter
Ballwechsel-Choreografie, echten Erste-/Zweite-Aufschlag-Quoten.

**Warum diese Recherche trotzdem NICHT diesen Weg empfiehlt, jedenfalls nicht als ersten
Schritt:** Hockeys eigene Live-Migration — mit genau dieser geerbten Basketball-Infrastruktur,
drei Arbeitsrunden, einer eigenen Erfolgskurve und einer eigenen Sinkhorn-Rezeptrunde — steht
heute bei **rho 0,647, durchgefallen**, und laut `projekt-ueberwachung-opus.md` Abschnitt 1.3 mit
einem Kaderrauschen von 0,211 (größer als jede der drei Arbeitsrunden bewegt hat). Ein Tennis-Live-
Motor wäre nach demselben Muster gebaut, mit ähnlichem Risiko, ähnlichem Aufwand (`football-
rollout-plan.md` schätzt Footballs vergleichbaren Weg auf "Aufwand: hoch") — und **ohne
Erfolgsgarantie für die Abnahme**. Der Bühnen-Weg liefert dagegen, gemessen, **0,919 sofort, ohne
Rezeptrunde**. Basketballs Live-Infrastruktur bleibt damit die richtige Referenz für eine SPÄTERE,
sportlich anspruchsvollere Tennis-Ausbaustufe (Abschnitt E.1, Phase 2) — aber sie ist nicht der
Weg, über die 0,80-Schranke zu kommen, und CLAUDE.mds Maßstab ist ausdrücklich die Abnahmezahl,
nicht die mechanische Tiefe (`projekt-ueberwachung-opus.md` Abschnitt 1.2: "rho ist gegenläufig
zur mechanischen Tiefe").

Fechten hat gar keinen vergleichbaren Anspruch: es ist real ein 1-gegen-1-Duell, kein
Fünf-gegen-fünf-Mannschaftsspiel mit Ball. Eine Basketball-artige Live-Migration (Manndeckung,
Zonen, Spielzüge) hat für ein Einzelduell keine sportliche Entsprechung — hier gibt es keine
"Basketball-Duell-Struktur", die man sich entgehen lassen könnte.

### B.3 Asset-Wiederverwendung: was überträgt sich, was nicht

`arena-mini-dm-tdm-battlefield-rollout-plan.md` Abschnitt 1.0/2.1 hat diesen Vergleich für die
übrigen drei Arena-Disziplinen bereits geführt und kommt zum selben Muster, das sich hier
wiederholt: **Basketballs sportspezifische Assets (Ball, Korb, Parkett) sind irrelevant** — Tennis
und Fechten brauchen andere Objekte. **Was sich überträgt, ist die Methode**, nicht das Objekt:

- Basketballs Ball/Korb kommen aus Kenneys Sports-Pack (CC0) — **derselbe Fund gilt für Tennis**
  (Abschnitt D.2, hier erstmals selbst heruntergeladen und geprüft).
- Basketballs Ballträger-Problem (keine Trage-Pose, `basketball-finalisierung-recherche-fable.md`
  Abschnitt 2) ist für Fechten bereits gelöst, und zwar generischer, als Basketball es für den Ball
  je war: das LPC-Waffen-Overlay-System (`schwert`/`axt`/`stab`/`zweihaender`, `engine.js:2130 ff.`)
  zeichnet eine Waffe synchron zum Angriffsframe, produktiv, mit Lizenzangaben, für jede
  Kampf-Disziplin gleichermaßen (Abschnitt D.1). Fechten muss hier nichts NEU bauen, was Basketball
  für den Ball noch bauen sollte.

---

## Teil C — Sport-Referenzen

### C.1 Tennis: Punkt-Spiel-Satz-Hierarchie und reale Aufschlagquoten

**Struktur** (ITF-Regelwerk, allgemein bekannt, hier nur zur Einordnung gegen den Motor): ein Match
besteht aus Sätzen (meist Best-of-3, bei Männern bei Grand Slams Best-of-5), ein Satz aus mindestens
sechs Spielen (Games) mit zwei Spielen Vorsprung oder einem Tiebreak bei 6:6, ein Spiel aus Punkten
(15/30/40/Spiel, ab Einstand "Vorteil"). **Der Aufschlag wechselt nach jedem Spiel die Seite** —
das ist die reale Entsprechung zu Tennis' Motorkommentar "die sechs tragen abwechselnd den
Ballwechsel aus" (`engine.js:3892-3894`): echtes Tennis IST bereits ein alternierendes
Einzel-Duell-Format, kein Fünf-gegen-fünf mit gleichzeitiger Bewegung aller Spieler.

**Reale Aufschlagquoten** (ATP Tour, 2024er Daten):

| Kennzahl | Wert | Quelle |
|---|---:|---|
| Punkte gewonnen bei erstem Aufschlag (Top-50-Schnitt) | **~73,6 %** | Sekundärquelle (Suchzusammenfassung, Primärtext nicht direkt abgerufen) — [Iain Macleod, "Hubert Hurkacz Could be a World-Beater"](https://iainmacleod.substack.com/p/hubert-hurkacz-could-be-a-world-beater) |
| Punkte gewonnen bei zweitem Aufschlag (Tour-Schnitt) | **51 %** | direkt zitiert — [ATP Tour, "Here's why Alcaraz & Sinner are second-serve standouts"](https://www.atptour.com/en/news/alcaraz-sinner-infosys-atp-beyond-the-numbers-july-2024) |
| Serve Effectiveness erster Aufschlag (Tour-Schnitt) | 58 % (Ass 16 %, unretourniert 22 %, Angriff nach Return 20 %) | direkt zitiert — [ATP Tour, "Insights: Serve Effectiveness"](https://www.atptour.com/en/news/insights-serve-effectiveness) |
| Serve Effectiveness zweiter Aufschlag (Tour-Schnitt) | 23 % | dieselbe Quelle |

Die erste Zahl (73,6 %) stammt aus einer Sekundärquelle (die Suchzusammenfassung nennt sie
"heading into the U.S. Open", ohne den Originalartikel zu verlinken) — nach demselben Maßstab wie
`football-rollout-plan.md` als solche markiert, nicht als Primärzahl behandelt. Die zweite und
dritte Zahl kommen direkt von atptour.com und sind belastbar.

**Was das für einen Bühnen-`kurve:`-Block bedeutet:** anders als Basketballs binäre
Treffer/Fehlwurf-Distanzstufen ist ein Tennis-Ballwechsel strukturell **zweigipflig** — die
Erfolgschance hängt daran, ob der erste Aufschlag ankommt (73,6 % Erfolgschance dahinter) oder ob
auf den zweiten Aufschlag zurückgefallen werden musste (51 %, spürbar niedriger). Der heutige
Bühnen-Rahmen kennt nur EINE Erfolgschance pro Durchgang
(`erfolg = 0.15 + TECHNIK*0.0055 + NERVEN*0.0035`) — für eine kalibrierte Tennis-Kurve wäre ein
zweistufiges Modell (analog zu Footballs Sack→Completion-Kaskade, `football-rollout-plan.md`
Abschnitt B.4) die sportlich treffendere Struktur, siehe Abschnitt F.1.

### C.2 Fechten: Gefecht-Struktur, Waffenarten, Prioritätsregeln

Die Kernzahlen (Gefechtlänge, Arbeitszeit je Aktion, Aktionsartenverteilung) stehen bereits
ausführlich und mit Quellen in `arena-duell-recherche-fable.md` Abschnitt 0.3/3.1/3.2 — hier nur
das Nötigste zur Einordnung, plus neu recherchiert: die Prioritätsregel, die für die
Doppeltreffer-Frage entscheidend ist und die der Motor heute nirgends kennt (kein
`degen`/`florett`/`saebel`/`rapier` im gesamten `engine.js`, nachgeprüft per `grep`).

**Gefechtlänge** (FIE Technical Rules, s. `arena-duell-recherche-fable.md` Abschnitt 0.3):
Direktausscheidung 15 Treffer oder 3×3 Minuten (1 Minute Pause dazwischen); Poolgefecht 5 Treffer
oder 3 Minuten. Säbel: erste Periode endet bereits bei 8 Treffern.

**Priorität/Vorfahrtsregel — der zentrale Unterschied zwischen den drei Waffenarten**, frisch
recherchiert:

| Waffe | Regel bei gleichzeitigem Treffer | Quelle |
|---|---|---|
| Florett, Säbel | **Vorfahrt ("right of way")**: der Fechter, der die Aktion zuerst eröffnet hat, bekommt den Punkt — unabhängig davon, ob der andere ebenfalls trifft. Der Kampfrichter entscheidet, wer "die Aktion besitzt". | [Wikipedia, "Priority (fencing)"](https://en.wikipedia.org/wiki/Priority_(fencing)); [USA Fencing, "Fencing 101: Basics of Competition"](https://www.usafencing.org/basics-of-competition) |
| Degen | **Keine Vorfahrt.** Beide Treffer zählen, wenn sie innerhalb eines Sperrfensters von rund 40 ms erfolgen — Punkte gehen an beide gleichzeitig ("Doppeltreffer"). | [NBC Olympics, "Fencing 101: Rules and Scoring"](https://www.nbcolympics.com/news/fencing-101-rules-and-scoring); s. auch `arena-duell-recherche-fable.md` Abschnitt 0.3 (40 ms nur über Vereins-Seiten belegt, nicht im FIE-Text selbst nachgelesen) |

**Konsequenz für die Motorwahl:** Degen ist strukturell die einfachste der drei Waffen für unser
Modell — es gibt keine "wer hat zuerst angegriffen"-Arbitrage, die eine Zustandsmaschine bräuchte
(anders als bei Basketballs Foul-Pfiff oder einer echten Vorfahrtsregel). Ein Treffer ist ein
Treffer, ein Doppeltreffer zählt für beide. Das passt fast beiläufig zum bestehenden
Bühnen-Duell-Muster: jede Seite würfelt unabhängig ihren Erfolg, ohne dass eine Seite die andere
"aussticht". **Empfehlung: Fechten im Motor als Degen-Gefecht führen**, nicht als Florett/Säbel —
nicht weil die anderen Waffen unrealistisch wären, sondern weil sie eine Regel bräuchten
(Vorfahrt), die aktuell nirgends im Motor existiert und die für eine erste Version unnötigen
Aufwand bedeutet. Der Motor trägt heute ohnehin keine Waffenart-Kennung — das wäre die erste, die
er bekäme.

### C.3 Was der Motor heute an Waffenwahl kennt — nichts

`grep -i "degen\|florett\|s.bel\|rapier"` über `engine.js` liefert **keinen Treffer** außerhalb
dieser Recherche. `ARENA_ART.fechten` (`engine.js:3551-3584`) trägt keine Waffenart-Kennung, nur
die Sub-Skill-Matrix. Das ist konsistent mit dem Befund aus Abschnitt C.2: eine erste
Fechten-Instanz kann pauschal "Degen" annehmen, ohne dass irgendein bestehender Code widersprechen
würde.

---

## Teil D — Assets

### D.1 Fechten: kein dediziertes Klingen-Asset, aber ein bereits produktives System

`public/sprites/waffen/quellen.json`s eigener Hinweistext sagt es explizit: *"Das bestehende
Waffensystem im Baukasten … kennt nur 'schwert' und 'bogen' als Mittelalter/Fantasy-Overlays im
LPC-Universal-Generator-Fundus — dort gibt es KEINE [weiteren Kategorien] (die
Waffen-Kategorien des Generators sind nur magic/sword/ranged(Bogen)/polearm/blunt)."* Es gibt in
keiner der beiden im Projekt genutzten Quellen (LPC-Generator-Fundus, Kenneys SciFi-Paket für
Feuerwaffen) eine dünne, gerade Fechtklinge (Florett/Degen/Säbel) — nur mittelalterliche
Schwert-/Axt-/Stab-Varianten.

Das nächstliegende bereits im Repo vorhandene Asset ist `sw_bg`/`sw_fg`
(`public/sprites/baukasten/quellen.json`: *"weapon/sword/arming/attack_slash"*, ElizaWy, OGA-BY 3.0,
128px-Slash-Raster) — eine **Arming Sword**, ein einhändiges, geradeklingiges Kurzschwert. Optisch
näher an einer Fechtwaffe als Axt/Stab/Zweihänder, aber sichtbar dicker und mit einem Parierbügel/
Korbgefäß, das keine Sport-Fechtwaffe hat. Dieselbe Notlösung wie bei `football-rollout-plan.md`
Abschnitt C.4 (LPC-Schulterpanzer als Football-Schulterpolster-Behelf): **sofort verfügbar, ohne
neue Lizenzklärung, aber kein fechtspezifisches Asset.**

Wie `arena-mini-dm-tdm-battlefield-rollout-plan.md` Abschnitt 2.2 im Detail zeigt, ist das
Overlay-System selbst bereits vollständig produktiv: `zeichneSprite` löst `u.lunge>0` bei einer
Nicht-Feldspiel-Disziplin in eine "slash"-Pose auf und zeichnet die zugewiesene Waffe
(`engine.js:2144`, `2166-2169`), synchron zum Ausfallschritt. Die Bühnen-Duell-Reveal-Mechanik
setzt genau dieses `u.lunge=0.5` bei jedem aufgedeckten Durchgang (`engine.js:9343`) — ein Fechter
mit `waffe:"schwert"` würde beim Chassis-Wechsel also automatisch eine Klingen-Ausfallbewegung
zeigen, ohne neue Animationsarbeit. Das ist aber **keine Verbesserung gegenüber der Arena** — dieselbe
Logik gilt dort exakt genauso (Arena ist ebenfalls `!feldspiel`), Fechten profitiert davon also
schon heute. Kein Gewinn, aber auch kein Verlust beim Umzug.

**Was fehlt und in dieser Recherche nicht gefunden wurde:** eine Fecht-Schutzausrüstung (Maske,
gepolsterte Jacke) als eigener LPC-Layer. Nicht erschöpfend gesucht (außerhalb des Auftragsrahmens)
— falls gewünscht, wäre das eine eigene, kleine Asset-Suche wie bei Footballs Schulterpolster.

### D.2 Tennis: Ball UND Schläger bereits lizenzgeklärt, selbst heruntergeladen und geprüft

`kenney_sportsPack.zip` (`opengameart.org/content/sports-pack-350`, Kenney Vleugels, **CC0** —
dieselbe Quelle, aus der `public/sprites/basketball/quellen.json` bereits `korb_topdown.png`
bezieht) wurde für diese Recherche selbst heruntergeladen und entpackt. Gefunden und visuell
geprüft:

| Datei | Maße | Inhalt (visuell geprüft) |
|---|---|---|
| `PNG/Equipment/ball_tennis1.png` | 12×12 px | runder gelbgrüner Ball, korrekt als Tennisball erkennbar |
| `PNG/Equipment/ball_tennis2.png` | 12×12 px | Variante desselben Balls |
| `PNG/Equipment/racket_handle.png` | 29×8 px | ovaler Schlägerkopf mit Griff, Ausführung "handle" |
| `PNG/Equipment/racket_wood.png` | 29×8 px | dieselbe Form, Holzoptik |
| `PNG/Equipment/racket_metal.png` | 29×8 px | dieselbe Form, Metalloptik |

`Spritesheet/sheet_equipment.xml` bestätigt: alle fünf sind Teil derselben 39-Sprite-Equipment-Liste,
die `football-rollout-plan.md` Abschnitt C.2 bereits für Football-Ball/-Helm zitiert hat — dieselbe
Quelle, kein neuer Lizenz-Check nötig. Wie Footballs Ball (14×16 px) sind auch diese Sprites deutlich
kleiner als Basketballs `ball.png` (32×32) — eine verlustfreie Vergrößerung (Nearest-Neighbor) wäre
vor dem Einbau nötig, kein neuer Download.

**Kein Netz, keine Platzmarkierung im Paket** — dieselbe Lücke wie bei Footballs
Yard-Markern (`football-rollout-plan.md` Abschnitt C.2: "kein Yard-Marker, kein Torpfosten"). Ein
Tennis-Court müsste, wenn Tennis auf dem Feldspiel bliebe, wie Basketball/Football/Hockey vektoriell
gezeichnet werden (`bodenFeldspiel()`-Erweiterung, analog zu Footballs Endzonen-Zweig,
`engine.js:8368-8389`).

**Die eigentliche Pointe:** dieser ganze Asset-Fund wird beim Umzug auf die Bühne **ungenutzt** —
`zeichneBuehne` zeichnet keinen Ball, kein Racket, keinen Court. Ball und Schläger liegen bereit,
falls Tennis später (Phase 2, Abschnitt E.1) doch einen eigenen Live-Motor im Feldspiel bekommt,
oder falls jemand der Bühnen-Instanz ein kleines Racket-Overlay analog zu
`zeichneHockeyschlaeger()` (`engine.js:311-347`, eine prozedural gezeichnete Ausrüstung statt eines
neuen LPC-Layers) spendieren möchte — ein rein kosmetischer Zusatz, keine Voraussetzung für die
Abnahmezahl.

### D.3 Der wichtige Vorbehalt: nichts davon betrifft das, was Chris heute sieht

Wie in Abschnitt A.7 hergeleitet, rendert die Produktions-App (`app/foundation/discipline-stage/`)
weder `zeichneBuehne` noch `zeichneArena` noch `bodenFeldspiel` — sie hat für Tennis (`klassen`)
und Fechten (`lamps`) bereits eigene, unabhängige SVG-Visualisierungen. Die Asset-Recherche in
D.1/D.2 ist trotzdem nicht wertlos: sie betrifft die Qualität von `battle-mode.engine.js`s **eigenem
Mockup-Bild** (relevant, sobald jemand am Mockup selbst arbeitet, z. B. um eine Rangtreue-Sonde
visuell zu prüfen, oder falls die Discipline-Stage irgendwann durch den Live-Motor abgelöst
werden sollte, wie es Basketballs `court`-Primitive nahelegt) — sie ist nur nicht der Hebel, mit
dem sich das Spielerlebnis von heute auf morgen ändert.

---

## Teil E — Migrationsplan

### E.1 Tennis (getrennt)

**Phase 1 — Chassis-Wechsel auf die Bühne (klein, eine Agentenrunde).**

1. `BUEHNE_ART.tennis` anlegen (Vorlage: der getestete `tennisduell`-Entwurf aus Abschnitt A.3,
   plus einer echten Kalibrierungsrunde statt der reinen Umbenennung — Abschnitt F.1).
2. `tennis` aus `FELDSPIEL_ART` entfernen. **Wichtig:** die Registrierungsreihenfolge in
   `MOTOREN` (`engine.js:15717 ff.` für Bühne, `:15750 ff.` für Feldspiel, Feldspiel-Schleife läuft
   SPÄTER) bedeutet: würde `tennis` in BEIDEN Tabellen stehen bleiben, gewönne weiterhin die
   Feldspiel-Registrierung, und der Wechsel griffe gar nicht. Ein sauberer Umzug MUSS den alten
   Eintrag entfernen, nicht nur den neuen hinzufügen.
3. `BASIS_JE_DISC.tennis` bleibt unverändert (Matrix ändert sich nicht).
4. `DISCS.tennis.cat` (`engine.js:2785`) optional auf einen Bühnen-passenden Wert ziehen — wird
   heute nur für den seltenen `ARENA_ART`-Rezept-Fallback gelesen (`engine.js:3622`), betrifft
   Tennis nicht, kein blockierender Punkt.
5. Mit `miss-alle-disziplinen.mjs 24 tennis` nachmessen, plus die jeSeite-Robustheitsprobe
   (2/4/6, wie in A.3 vorgeführt).

**Aufwand: klein bis mittel.** Kleiner als jede vergleichbare Feldspiel-Rezeptrunde, weil A.3
bereits zeigt, dass keine Rezeptänderung nötig ist, um über die Schranke zu kommen — die
verbleibende Arbeit ist die technische Umhängung plus, wenn gewünscht, die Kalibrierungsrunde aus
Teil F (die die Zahl weiter absichert, aber nicht mehr zum Bestehen nötig ist).

**Phase 2 — optional, langfristig: ein echter Tennis-Live-Motor im Feldspiel.** Nur verfolgen,
falls Chris die sportliche Tiefe (echter Aufschlag/Return, echte Ballwechsel-Choreografie,
Erste-/Zweite-Aufschlag-Unterscheidung) ausdrücklich will — nicht, um die Abnahmezahl zu erreichen
(die ist mit Phase 1 bereits erledigt). Aufwand: **hoch**, vergleichbar mit Footballs
Live-Migrationsschätzung (`football-rollout-plan.md` Teil E.2), aus denselben Gründen wie in
Abschnitt B.2 diskutiert (Hockeys eigene Erfahrung als Warnung, nicht als Blockade).

### E.2 Fechten (getrennt)

**Phase 1 — naive Chassis-Wechsel auf die Bühne (klein bis mittel).**

1. `BUEHNE_ART.fechten` anlegen, analog zu Speed-Schach/I-Spy (unabhängige Durchgänge, `duell:true`),
   mit einem kalibrierten Sieben-Rollen-Rezept (Startpunkt: der getestete `fechtenduell`-Entwurf aus
   A.4, dann eine echte Rezeptrunde nach Teil F).
2. `fechten` aus `ARENA_ART` entfernen (dieselbe Registrierungsreihenfolge-Warnung wie bei Tennis —
   hier unkritischer, weil Bühne VOR Feldspiel, aber NACH Arena registriert wird, `engine.js:15630`
   vs. `:15717`: ein doppelt eingetragenes `fechten` würde von der Bühnen-Registrierung gewinnen,
   das ist der gewünschte Fall — trotzdem sauberer, den Arena-Eintrag zu entfernen, damit
   `istArena("fechten")` nicht weiter `true` zurückgibt und irgendwo (UI, Rezept-Tools) falsch
   verzweigt).
3. `rundenN` und `jeSeite:6` wie im Testentwurf (jeSeite gilt hier weiter für "sechs Fechter je
   Seite, sechs parallele Einzelgefechte" — wie Speed-Schachs sechs Bretter, kein Widerspruch zum
   1-gegen-1-Charakter des einzelnen Gefechts).
4. Waffenart: Degen (Abschnitt C.2/C.3) — keine Vorfahrtsregel nötig, passt zum bestehenden
   unabhängigen Duell-Muster.
5. Mit `miss-alle-disziplinen.mjs 24 fechten` plus jeSeite-Probe nachmessen.

**Aufwand: klein bis mittel**, aus denselben Gründen wie bei Tennis — A.4 zeigt bereits eine
lauffähige, über der Schranke liegende Zahl ohne Balancing-Runde.

**Phase 2 — der interaktive Paar-Rechner (mittel), für das Spielgefühl, nicht für die Abnahmezahl.**
Bauplan bereits vorgezeichnet: `baueHebenDuelle` (`engine.js:9195-9253`) als Vorlage — statt zweier
unabhängiger Würfe pro Fechter, ein gemeinsamer Durchlauf je "Phrase" (Angriff des einen gegen
Parade/Gegenangriff des anderen), mit einer Elo-artigen Trefferchance
`p = 1/(1+10^(-Δ/k))` aus der Differenz der beteiligten Sub-Skills (`arena-duell-recherche-fable.md`
Abschnitt 3.4, dort bereits hergeleitet). Da Degen keine Doppeltreffer-Arbitrage braucht (C.2), ist
das Ergebnismodell einfacher als bei Gewichtheben: kein "Last steigt nie", sondern ein einfacher
Treffer-Zähler bis 15 (oder eine verkürzte Bühnen-Version, z. B. bis 5, analog zum
`rundenN`-Muster der bestehenden Bühne). **Aufwand: mittel**, kleiner als Gewichthebens komplette
S1-S6-Kalibrierrunde, weil die Zustandsmaschine selbst einfacher ist (kein Ansage-/Sprung-System,
kein Sinclair-Normierung), aber mit einer eigenen Erfolgskurve, die gegen die FIE-Zeitstatistiken
(17,9 s Arbeitszeit je Aktion, ~90 % Trefferquote je Phrase) zu kalibrieren wäre.

---

## Teil F — Balancing-Ausblick

### F.1 Die Bühne braucht einen `kurve:`-Datenblock — dieser Umzug ist der richtige Anlass

`projekt-ueberwachung-opus.md` Abschnitt 2.2 benennt die Lücke bereits: die Bühnen-Punkteformel
(`engine.js:9060-9070`) ist für sechs Disziplinen identisch, mit handgesetzten Konstanten
(0,15/0,0055/0,0035/0,7/0,35/0,006/0,12), die gegen **keine reale Referenz** kalibriert sind — "das
ist wörtlich derselbe Zustand, in dem Hockey war, bevor es drei Runden brauchte, um ihn zu
erkennen." Zwei weitere Instanzen (Tennis, Fechten) einfach mit denselben Konstanten laufen zu
lassen, wäre derselbe Fehler ein achtes Mal. Diese Recherche schlägt stattdessen vor, den Umzug zu
nutzen, um `BUEHNE_ART[d].kurve` als Datenblock einzuführen (Bauart wie `FELDSPIEL_ART[d].kurve`,
Fallback auf die heutigen Konstanten für die sechs unveränderten Disziplinen) — mit **echten
Referenzwerten aus Teil C**:

- **Tennis:** eine zweistufige Erfolgschance statt einer, mit `p1 ≈ 0,736` (erster Aufschlag
  landet, Schätzung aus C.1) und `p2 ≈ 0,51` (zweiter Aufschlag, direkt aus ATP-Daten) als
  Ankerwerte für `erfolg`, statt der pauschalen `0,15 + TECHNIK*0,0055 + NERVEN*0,0035`.
- **Fechten:** eine Kurve, die die reale Trefferrate je Phrase (aus 17,9 s Arbeitszeit gegen ~19,5 s
  je Treffer geschätzt: rund neun von zehn Phrasen enden mit Treffer, `arena-duell-recherche-fable.md`
  Abschnitt 3.2) als Ankerwert für die Erfolgschance nimmt, statt der generischen Konstante.

**Vorbehalt, wie in `football-rollout-plan.md` Teil B.4:** das ist eine Diskussionsgrundlage für die
eigentliche Bau-Runde, keine fertige Formel dieser Recherche.

### F.2 Erste Rezept-Skizzen — ausdrücklich nicht final

Die in A.3/A.4 getesteten Rezepte (Tennis: reine Umbenennung; Fechten: erster Entwurf aus der
Arena-Matrix) sind Startpunkte, keine kalibrierten Ergebnisse — genau wie
`football-rollout-plan.md` Teil D es für Football hält ("ausdrücklich nicht final … nur eine
Diskussionsgrundlage nach demselben Verfahren wie `scripts/baue-feldspiel-rezept.mjs`"). Für eine
echte Sinkhorn-Rezeptrunde fehlt für die Bühne dasselbe Werkzeug, das
`projekt-ueberwachung-opus.md` Abschnitt 2.3 bereits für alle Nicht-Hockey-Disziplinen vermisst:
`scripts/baue-feldspiel-rezept.mjs`s `MATRIX`/`ERLAUBT`-Tabellen (Zeilen 30-54) kennen nur
`hockey`. Wer Tennis' oder Fechtens Bühnen-Rezept nach Chris' Budget-Methode bauen will, baut zuerst
die Bühnen-Fassung dieses Werkzeugs — dieselbe Empfehlung, die bereits für die sechs "Knappen"
offensteht, jetzt um zwei weitere Kandidaten erweitert, sobald sie auf der Bühne stehen.

---

## Anhang: Quellenliste

- `docs/design/projekt-ueberwachung-opus.md` — Abschnitt 2.4 (Ausgangsbefund dieser Recherche),
  1.2/1.3/1.4 (Rangtreue-Interpretation, Kaderrauschen, Motor-erreicht-Spiel-nicht).
- `docs/design/arena-duell-recherche-fable.md` — Abschnitt 3.1-3.4 (Fecht-Zeitstatistiken,
  Bühnen-Duell-Begründung), 4.1-4.3 (Speed-Schach/I-Spy-Wertformel-Fix, W1).
- `docs/design/arena-mini-dm-tdm-battlefield-rollout-plan.md` — Abschnitt 1.0/2.1/2.2
  (Basketball-Vergleich, Waffen-Overlay-System), 4.1 (Zielwahl-Optionen für die verbleibenden
  Arena-Disziplinen).
- `docs/design/football-rollout-plan.md` — Stilvorlage, Kalibrierungsmethodik (Teil B.4, D, E.2).
- `public/mockups/battle-mode.engine.js` — alle Zeilenangaben im Text, Stand `1a6d417a`.
- `app/foundation/discipline-stage/DisciplineStageArena.tsx`,
  `app/foundation/discipline-stage/arena/disciplines/{registry,tennis}.tsx` — Produktions-Bühne,
  unabhängig vom Mockup-Motor (Abschnitt A.7).
- `public/sprites/baukasten/quellen.json`, `public/sprites/waffen/quellen.json`,
  `public/sprites/basketball/quellen.json` — Asset-Herkunft (Abschnitt D).
- `kenney_sportsPack.zip` (`opengameart.org/content/sports-pack-350`, Kenney, CC0) — selbst
  heruntergeladen und entpackt, `ball_tennis1/2.png` und `racket_handle/wood/metal.png` visuell
  geprüft (Abschnitt D.2).
- [Wikipedia, "Priority (fencing)"](https://en.wikipedia.org/wiki/Priority_(fencing)) — Vorfahrtsregel Florett/Säbel.
- [USA Fencing, "Fencing 101: Basics of Competition"](https://www.usafencing.org/basics-of-competition) — Vorfahrtsregel, allgemeine Struktur.
- [NBC Olympics, "Fencing 101: Rules and Scoring"](https://www.nbcolympics.com/news/fencing-101-rules-and-scoring) — Doppeltreffer-Regel Degen.
- [ATP Tour, "Insights: Serve Effectiveness"](https://www.atptour.com/en/news/insights-serve-effectiveness) — Serve-Effectiveness-Aufschlüsselung.
- [ATP Tour, "Here's why Alcaraz & Sinner are second-serve standouts"](https://www.atptour.com/en/news/alcaraz-sinner-infosys-atp-beyond-the-numbers-july-2024) — Tour-Schnitt zweiter Aufschlag (51 %).
- [Iain Macleod, "Hubert Hurkacz Could be a World-Beater"](https://iainmacleod.substack.com/p/hubert-hurkacz-could-be-a-world-beater) — Top-50-Schnitt erster Aufschlag (73,6 %, Sekundärquelle).

**Nicht verwendbar / nicht abgerufen:** die FIE-Technical-Rules-PDF selbst (`static.fie.org`) wurde
nicht direkt geöffnet, nur über Sekundärquellen (Wikipedia, USA Fencing, NBC) bestätigt — dieselbe
Einschränkung, die `arena-duell-recherche-fable.md` bereits für das 40-ms-Sperrfenster vermerkt.
