# Was als Nächstes am meisten bringt — Fables Modell des Projekts, 04.09.

Chris, wörtlich: „frag fable bei dem aktuellen stand was er als nächstes machen würde er soll
das projekt modellieren und du arbeitest dann die nächsten schritte eigenständig ab".

Stand: `origin/main` `2fbc364c` (PR #755 als letzter Merge, 04.09. 07:20 UTC). Offen: PR #771
(Hurt-Sprites sichtbar) und PR #772 (CI-Timeout 30 → 40 min). Gelesen und gegeneinander
gehalten: `CLAUDE.md`, `stand-aller-disziplinen.md` (trägt nachgeprüft alle drei heutigen Runden —
PPs-Kurve, Torwart-Konstanten, Football-Review-Fixes), `messgrundlage-kaderfest.md`, alle
Abschlussberichte des 03./04.09. zu Hockey/Football/Gewichtheben/Arena/Bloater, das
Opus-Überwachungsdokument vom 03.09., die 25 letzten PRs, die CI-Workflows, die Kader-Familie,
die CI-Basislinie, die Sprite-Fit-Bewertung und der Resolve-Pfad in `lib/`. Reine Diagnose —
**kein Code, kein Motor, keine Messung mit Nebenwirkung.** Wo ich eine Zahl nenne, steht
daneben, woher sie kommt. Wo ich etwas nicht geprüft habe, steht es in Abschnitt 4.

---

## 1. Kurzfassung — das Modell

Das Projekt hat **vier Achsen, die sich nicht gleich bewegen**, und die entscheidende
Eigenschaft ist, dass sie **multiplikativ** zusammenhängen, nicht additiv:

    Wirkung für Chris  =  Rangtreue  x  Sichtbarkeit  x  [im Spielstand: 0 oder 1]

1. **Validität** (belohnt die Mechanik das Richtige — rho Saison) und **Verlässlichkeit** (wie
   laut ist ein Spiel — Ereigniszahl). Ihr Produkt ist die Abnahmezahl rho je Spiel. Heute: acht
   bestehen, drei sind knapp, neun fallen durch (`stand-aller-disziplinen.md` Abschnitt 1).
   **Diese Achse ist in drei der vier großen Disziplinen an ihrer strukturellen Grenze**, nicht
   an einer Kalibrier-Grenze — die eigenen Berichte belegen das mit Zahlen, nicht mit Gefühl
   (Abschnitt 2 unten je Disziplin). Weiteres „Rezept-Grinding" ist dort gemessen wertlos.
2. **Produktivierung.** `ARENA_RESOLVED_DISCIPLINE_IDS = new Set(["basketball"])`
   (`lib/resolve/battle-mode-arena-team-points.ts:87`). Für **neunzehn von zwanzig**
   Disziplinen ist der dritte Faktor oben **exakt null** — jede Rangtreue-Runde dieser Woche
   (Tennis 0,505 → 0,814, Fechten 0,153 → 0,840, Gewichtheben 0,595 → 0,887, Hockey 0,589 →
   0,719 Feldspieler) hat auf Chris' Spielstand **null Wirkung**. Das Opus-Überwachungsdokument
   nannte das am 03.09. bereits „die größte Lücke im ganzen Projekt" (Abschnitt 1.4) und setzte
   es auf Platz 3 seiner Liste; Platz 1 und 2 (kaderfeste Messung, CI-Schranke) sind seitdem
   **erledigt**, Platz 3 nur zur Hälfte (Boxscore → PPs ist gebaut, V2-Kurve gemergt — aber nur
   für Basketball). **Das ist der größte ungehobene Hebel, und er ist nicht mehr durch etwas
   anderes blockiert.**
3. **Sichtbarkeit** (Bild, Bewegung, Sprites). 145 bewertete Charaktere, davon **70 mit ein
   oder zwei Sternen** (4 × ★, 66 × ★★ — `data/generated/sprite-fit-bewertung.json`, heute
   gezählt; die erste Runde hatte 74, drei wurden seitdem gehoben: Vigil, Krolach, Bloater).
   18 von 20 Disziplinen teilen sich vier Chassis-Bilder. Diese Achse ist **billig und
   risikofrei** (rein visuell, Rangtreue nachweislich bit-identisch, s. Bloater-Runde), und sie
   ist die einzige, an der Chris einen Fortschritt *sieht*, ohne einen Spieltag zu simulieren.
4. **Infrastruktur und Prozess.** Die Messgrundlage ist seit dem 03.09. belastbar (Median über
   fünf echte Kader, deterministisch, CI-Schranke mit Basislinie). Was noch reibt, ist klein und
   benennbar (Abschnitt 2.7).

**Das Verdikt in einem Satz:** Die Rangtreue-Achse hat in dieser Woche geliefert, was mit
vertretbarem Aufwand zu holen war; **der nächste Schritt ist, sie ins Spiel zu bringen, nicht
sie weiter zu polieren** — und parallel dazu die Sichtbarkeits-Achse, die bisher nur einmal
(Bloater) angefasst wurde und in der 48 % der Charaktere unter drei Sternen stehen.

Was sich bewegt: Produktivierung (hoher Hebel, nicht blockiert), Sprites (hoher Hebel, billig),
ein einzelner K3-artiger Wertformel-Hebel für Basketball (billig, die einzige Live-Disziplin).
Was steht: Hockey-Rezept (Orakel-Decke 0,73 gemessen), Football-Rezept (zwei Runden an einem
Tag, Grenzertrag benannt), Arena-Zielwahl (zweimal gescheitert, Ursache benannt, Sonde fehlt).

---

## 2. Die Achsen im Einzelnen — was die Zahlen sagen

### 2.1 Produktivierung: der Motor ist weiter als das Spiel

Was heute im echten Spielstand läuft (`lib/season/arena-matchday-resolve-service.ts`,
`runBattleModeArenaMatchday`): ein Spieltag mit Basketball als D1 oder D2 wird per Playwright
über den Mockup-Motor gespielt, das Team-Ergebnis geht als 2/1/0 in die Tabelle, die
individuellen PPs kommen seit PR #755 aus der Impact-Kurve gegen eine gezogene Referenz. Für
jede andere Disziplin greift weiter `legacy-matchday-resolve-engine.ts` mit der PPS-Rangformel.

**Was ich am Code nachgesehen habe, weil es die Aufwandsfrage entscheidet:**

| Baustein | Stand | Für eine zweite Disziplin nötig? |
|---|---|---|
| Headless-Runner `runArenaFixtures(gameState, fixtures, disziplin, …)` | nimmt `disziplin` bereits als Parameter; ruft `window.__arena.spieleFeldspiel(fd, saat)` (`arena-headless-runner.ts:327`) | **nichts** für Hockey/Football — `spieleFeldspiel` läuft über `MOTOREN[fd]` und kennt beide |
| `spieleFeldspiel` im Motor (`engine.js:17483`) | `if(!FELDSPIEL_ART[fd]) return null` — liefert `seiten` aus `fsPunkte` | **Bühnen-Verallgemeinerung** für Gewichtheben: `MOTOREN[fd]` hat `sichern/bau/lauf/wert/namen/zurueck` schon generisch, aber das Team-Ergebnis (`seiten`) muss der Bühnenmotor selbst liefern (Duellstand 4:2) — heute nicht |
| `runBattleModeArenaMatchday` | drei Literale `"basketball"` (`battle-mode-arena-team-points.ts:356/361/431`) | durch eine Schleife über `ARENA_RESOLVED_DISCIPLINE_IDS ∩ {d1,d2}` ersetzen |
| PPs-Referenz (`data/generated/basketball-pps-referenz.json`) | nur Basketball, je Feldgröße | **je Disziplin eine eigene Ziehung** (`ziehe-basketball-pps-referenz.ts` als Vorlage; ~2 h sequenziell, parallel ein Fünftel) — der Rohwert-Median hängt an der Wertformel der Disziplin |
| Stage-Ansicht (`app/foundation/discipline-stage/arena/disciplines/`) | `rink.tsx`, `barbell.tsx`, `football.tsx` existieren; `barbell.tsx` rechnet Team-kg noch aus dem PPS-Score | Hockey: vorhanden; Gewichtheben: Umbau auf echte Heber-kg (Plan S6) |
| Abnahme im Spielstand | `scripts/e2e-saisonende-am-save-abbild.ts` gegen die Kopie des live-save | wiederverwendbar |

**Fazit Aufwand:** Hockey ist die **billigste** zweite Disziplin (Feldspiel-Chassis, Runner
läuft heute schon, Stage-Ansicht vorhanden), Gewichtheben die **sauberste** (einzige der drei mit
bestandener Schranke, 0,887; Plan S6 steht seit dem 02.09. in `gewichtheben-plan.md:600`),
Football die **falscheste** (0,468, Mechanik bewegt sich noch — s. 2.3).

**Die Regel, die dabei nicht verletzt werden darf** (aus dem Arena-Rollout-Plan Abschnitt 5,
Punkt 5): „erst Mechanik, dann Rezept, nie umgekehrt" — eine Disziplin, deren Motor sich noch
strukturell ändert, sollte nicht live gehen, weil die gezogene PPs-Referenz dann sofort driftet.
Für Gewichtheben ist das erfüllt (Architekturfrage entschieden, Opus-Review bestätigt: „Variante
B behalten"), für Hockey nach dieser Woche ebenfalls (K3 + Konstanten sind Bilanzierung, kein
Motor; H3 wäre ein Motor — s. 2.2, deshalb **vor** H3 produktivieren oder H3 bewusst danach
messen und die Referenz neu ziehen; der Drift-Wächter aus PR #755 fängt das).

**Die eine Frage an Chris, die hier drinsteckt:** Hockey steht bei 0,669 (alle 12) bzw. 0,719
(Feldspieler) — unter seiner eigenen 0,80-Schranke. Das Opus-NHL-Review hat gezeigt, dass das
echte Eishockey je Spiel bei rho ≈ 0,40 liegt und unser Star in **0 % der Spiele Letzter** ist.
Ob „knapp" für den Live-Betrieb reicht, ist seine Entscheidung; ich empfehle **ja**, weil die
Alternative (warten, bis 0,80 steht) laut Orakel-Messung mit den heutigen Ereignissen nicht
eintritt (2.2) und Hockey sonst auf unbestimmte Zeit Mockup bleibt.

### 2.2 Hockey: der billige Hebel ist gezogen, der teure ist der einzige, der bleibt

Gemessen, aus `hockey-naechster-hebel-recherche-fable.md` Abschnitt 1.3/1.4 und dem NHL-Review:

- **Orakel-Decke 0,73** je Spiel mit den neun heute gebuchten Posten (Kleinste Quadrate,
  in-sample, also die günstigste denkbare Formel). Heute stehen wir bei 0,719 — **die Lücke zu
  0,80 ist mit Rezept/Wertformel nicht schließbar**, dreimal unabhängig bestätigt.
- **Zoneneintritt (K1):** zweimal gebaut, Vorzeichen kippt zwischen n=24/48/96 — RNG-Kaskade
  eines 40–50× je Spiel gewürfelten Ereignisses. Ohne neue Bauform kein dritter Anlauf.
- **K3, Torwart-Konstanten, xG-Varianten:** gezogen bzw. gemessen flach (−0,004/−0,005).
- **H3 (deterministische Wechsel/Eiszeit):** der einzige benannte Hebel, der die zwei
  wiederholbarsten Skater-Kanäle der echten Analytik (On-Ice-Corsi, GF/GA — heute
  Mannschaftskonstanten mit null Information) überhaupt erst individuell macht, **ohne neuen
  `rr()`-Wurf**. Nicht gebaut. Aufwand: eine echte Mechanik.

**Verdikt:** H3 ist eine sinnvolle Runde — aber **nach** der Produktivierung, nicht davor, und
nur mit vorab festgelegtem Messprotokoll (n=24 UND n=48 UND n=96, Feldspieler-only, Vorzeichen
muss in allen dreien halten; Eiszeit aus der Aufstellungsreihenfolge, **nie** aus `eig`, sonst
misst man Zirkularität). Ehrliche Erwartung: +0,03 bis +0,08 — die Recherche rechnet vor, dass
selbst 0,903 Validität eine Verlässlichkeit von 0,785 bräuchte; H3 hebt beides, aber ob es
reicht, weiß niemand. Wenn Chris „gut genug" sagt, ist 0,719 Feldspieler / 0 % Letzter eine
vertretbare Stelle zum Stehenbleiben.

### 2.3 Football: die MATRIX-Frage ist eine Design-, keine Bau-Frage

Was „nächster Hebel ist die MATRIX" konkret heißt (`football-gewichtheben-opus-review.md` B.6,
`football-rezept-kalibrierung.md` 4.2): `BASIS_JE_DISC.football` = spirit 25, torment 16,
health 14, awareness 11, will 10, determination 8, **power 6**, stamina 6, charisma 4. Daraus
folgt zwangsläufig `LAUFKRAFT: {spirit 56, health 30, power 14}` — ein Running Back, dessen Kraft
zu 56 % Geist ist. Und `awareness` (Gewicht 11) korreliert auf dem echten Kader mit **−0,335**
gegen die Football-Eignung — ein Attribut, das die Matrix hoch bepreist und das im Kader
negativ mit der daraus errechneten Eignung zusammenhängt.

Das ist kein Rezept-Problem und keine Kalibrierung: **die Matrix ist die Design-Absicht des
Projekts** (Opus-Review A.6 sagt es für Gewichtheben wörtlich), und sie gehört Chris. Eine
Runde, die die Matrix „verbessert", würde die Zielgröße selbst verschieben und danach eine
bessere Zahl messen — das ist Zirkularität, kein Fortschritt. Dazu kommt der wichtigste
ungenannte Befund: **während eines Spielzugs bewegt sich nur der Ball, alle zwölf Spieler stehen
still** (B.4.4) — bewusst so gebaut, aber das Erste, was Chris sieht.

**Verdikt:** keine Football-Runde jetzt. Stattdessen eine **Entscheidungsvorlage** für Chris
(eine Seite: die Matrix-Zeile, die −0,335, die zwei Optionen „Matrix anfassen" / „0,47
akzeptieren und Football als Schauspiel führen"), und die visuelle Frage (bewegte Spieler) erst
dann, wenn Football je live gehen soll. Football ist nicht produktivierungsreif — die Mechanik
bewegt sich noch, und die Regel aus 2.1 gilt.

### 2.4 Arena: drei Disziplinen, ein strukturelles Problem, zwei gescheiterte Anläufe

TDM 0,113 / Mini-DM 0,269 / Battlefield 0,325, Saison 0,070 / 0,500 / 0,619. TDMs Saisonzahl
von 0,07 heißt: **die Mechanik belohnt über 24 Spiele hinweg nichts**, was die Eignung misst —
das ist kein Verlässlichkeitsproblem, das ist Validität nahe null. Zielwahl nach Bedrohung
(Option A) wurde zweimal gebaut: Variante 1 (Hysterese) bewegt TDM um ±0,000 und senkt Mini-DM um
−0,305; Variante 2 (ANG-Basiswert) ist überall schlechter. Die Ursache ist benannt
(`arena-zielwahl-umsetzung.md` Abschnitt 3: `bedrohungVon` ist zu Kampfbeginn für alle 0, die
Zielwahl der ersten Sekunden ist Array-Reihenfolge; positive Rückkopplung auf „wer zuerst
traf"), und der Bericht selbst verlangt vor jedem dritten Anlauf **eine
Ziel-Konzentrations-Sonde** und eine Distanz-/Zeit-Komponente statt einer weiteren
Gewichtsvariante.

Dazu die eine Entscheidung, die niemand außer Chris treffen kann: `cdKuerzung = 0`
(Schlagfrequenz tempo-unabhängig, Eslabong-Treue, wörtlich im Code zitiert). Solange die steht,
korreliert die Zahl der Gelegenheiten nicht mit der Eignung — und genau das ist der Kanal, den
Fables Arena-Recherche als schwächsten gemessen hat (0,05 im TDM).

**Verdikt:** Die Arena ist die Achse mit dem **schlechtesten Verhältnis von Aufwand zu
Aussicht** im ganzen Projekt. Drei von zwanzig Disziplinen, ein gemeinsames Chassis, zwei
gemessen negative Anläufe, und der direkteste Hebel liegt hinter einer Design-Entscheidung.
**Liegen lassen**, bis (a) Chris die Schlagfrequenz-Frage beantwortet hat oder (b) jemand die
Sonde baut, die der letzte Bericht als Voraussetzung nennt. Ein dritter Anlauf ohne beides ist
derselbe Rate-Zyklus.

### 2.5 Die „Knapp"-Disziplinen: Basketball ist die einzige, bei der es zählt

| Disziplin | rho Spiel | Spannweite | rho Saison | was die zwei Spalten sagen |
|---|---:|---:|---:|---|
| Basketball | 0,757 | **0,102** | 0,923 | Validität sehr hoch, Spiel zu laut → Verlässlichkeit; kaderrobust, eine Bewegung von 0,03–0,05 ist ein echtes Signal (`messgrundlage-kaderfest.md` Abschnitt 4) |
| Eiskunstlauf | 0,757 | 0,125 | 0,958 | dasselbe Muster, reine Verlässlichkeit; Bühnen-Durchgänge |
| Climbing | 0,790 | 0,192 | 0,851 | beide mittel; 0,010 unter der Schranke, Spannweite 0,192 — ein Bucket-Wechsel wäre hier Kaderrauschen |

**Basketball** ist die einzige Live-Disziplin — seine 0,757 sind die einzige Rangtreue, die
Chris heute überhaupt erlebt. Das Muster (Saison 0,923, Spiel 0,757 → Verlässlichkeit ≈ 0,67)
ist genau das, was Hockeys K3 behoben hat: **Tore/Punkte sind über die Saison der validste,
je Spiel der unverlässlichste Posten** (Hockey-Recherche 1.3: Tore Saison 0,818, Spiel-zu-Spiel
0,468). Ein Wurf mit 45 % Trefferchance, der danebengeht, macht in EINEM Spiel aus einem guten
Spieler einen schlechten. Der Motor kennt die Trefferwahrscheinlichkeit jedes Wurfs bereits
(`KURVE_BASKETBALL`, `SCHUSS_TIER`) — sie wird nach dem Wurf verworfen, exakt wie `pTor` bei
Hockey vor K3. **Ein Basketball-K3 (Punkte halb als erwartete Punkte buchen) ist dieselbe
Bauform: kein neuer `rr()`, keine Verschiebung, reine Bilanzierung** — bei Hockey +0,068
Feldspieler, größer als die Spannweite. Kosten: die PPs-Referenz muss danach neu gezogen werden
(Wertformel ändert sich; der Drift-Wächter schlägt ohnehin an) — das ist Handarbeit, kein Risiko.

**Verdikt:** Basketball-K3 ist der **billigste Rangtreue-Hebel mit realer Wirkung im Spiel**,
den das Projekt gerade hat. Eiskunstlauf/Climbing: je eine Budget-Runde ist legitim, aber
Wirkung für Chris null, solange sie Mockup sind — nach hinten.

### 2.6 Sprites: 70 Kandidaten, ein etabliertes Muster, systematische Cluster

Heute gezählt: ★ 4 (Byrd, Gralakar, Orakelpfropf, Tavascron), ★★ 66, ★★★ 47, ★★★★ 27, ★★★★★ 1.
Die Bloater-Runde hat gezeigt, was eine Runde kostet und bringt: 2 → 4 Sterne, zwei
**generische** Flags (`skala`, `leuchtenderBauch`), Rangtreue in 19 von 20 Zeilen bit-identisch
(die zwanzigste war Football durch einen fremden Merge), ein Bericht, zwei Screenshots.

Was `sprite-fit-ergebnisse.md` außerdem festhält und was den Hebel vervielfacht: **die
★★-Häufung ist zum großen Teil systematisch**, nicht 66 Einzelfälle —
- neun Gruppen teilen sich byte-identische Sprites (Babuschinka/Bana/Dr Ironmind/Gralakar;
  Burster/Threnox; Draco/Steel Sinister; Elara/Lady Yueqin/Starflame; Ironhoof/Medibull; …),
- fünf „Wald-Riesen/Baumwesen" (Cyrn, Greenkraut, Rootheart, Treantos, Tropfina) und sechs
  „gehörnte Minotaurus/Zentaur"-Charaktere (Ironhoof, Medibull, Omniclops, Roddox Harthelm,
  Tartarus, Kora) landen unabhängig voneinander bei derselben generischen Silhouette.

Ein Fix je Cluster (ein `vollbild`, eine Körperschicht, eine Skala) trifft drei bis sechs
Charaktere auf einmal. Das ist der Unterschied zwischen 70 Einzelrunden und rund 15.

### 2.7 Infrastruktur: was noch reibt, konkret

1. **PR #771 und #772 sind offen.** #771 ist ein echter Rendering-Bug (51 `*_hurt`-Blätter
   haben eine Zeile, `male()` nahm vier an — niedergeschlagene Charaktere waren in drei von
   vier Blickrichtungen unsichtbar), #772 der gemessene CI-Deckel (Läufe bei 26:50 / 28:53 /
   29:25 gegen 30:00, zwei `cancelled`). Beide zuerst mergen.
2. **Die CI-Schranke läuft nur manuell.** `rangtreue-schranke` liegt in `ci-nightly.yml` unter
   `workflow_dispatch` — der einzige Job, der die 40-%-Achse schützt, wird nie automatisch
   gefahren. Er ist deterministisch (bit-identische Reproduktion nachgewiesen) und kostet
   11 min. `messgrundlage-kaderfest.md` hat die Frage bewusst Chris überlassen; sie ist seit
   dem 03.09. unbeantwortet. **Empfehlung: bei jedem Merge nach `main`**, nicht nightly.
3. **Basislinie stimmt** (`rangtreue-basislinie.json`: Hockey 0,669, Football 0,460 — heutiger
   Stand 0,468 liegt darüber, keine Aktion nötig). Gut.
4. **Doku-Drift, klein aber irreführend:** CLAUDE.md nennt für Hockey „Star auf Rang 1 79 %,
   in den ersten zwei 94 %" — gemessen auf der kaderfesten Bank 58 % / 78 % (NHL-Review 5.3).
   `stand-aller-disziplinen.md` Abschnitt 4 sagt „vier Bilder für zwanzig, eigene Arenen nur
   Basketball und Eishockey", während die Gewichtheben-Zeile derselben Datei „eigenes
   Bühnenbild" trägt. Wer die 0,80-Debatte auf CLAUDE.mds Zahlen führt, führt sie auf zu guten.
5. **Spiegel sind frisch** (heute geprüft: live-save 08:00, bug-reports 07:52). Die letzten
   zwei In-Game-Meldungen stammen vom **25.08.**: (a) „Sound in der Battle Arena funktioniert
   gar nicht bei mir — die coolen neuen Profile für die Einsatzliste fehlen auch noch", (b)
   „Chars haben ihre Waffen nicht in der Arena; Tooltips Schaden/IMP; Heal fehlt". Für (b)
   existieren seitdem Tests (`battle-arena-heal-attribution`, `battle-arena-endscreen-tooltip-
   wurzel`) und Waffen-PRs (#711, #770). Für (a) liegt eine Triage vor
   (`data/bug-reports/triage/bug-2026-08-25T13-50-21-597Z-rtyqa9.md`), und sie ist eindeutig:
   **„Status: nicht gebaut — beides sind Feature-Lücken."** Für den Nahkampf existiert laut
   Code „bisher KEINERLEI Audio-Infrastruktur" (`public/sound/` enthält nur `basketball/`; der
   Ton-Regler steuert ausschließlich Basketball), und die Basketball-Rollenprofile
   (`lib/lineups/matchday-slot-roles.ts`) sind mit dem eigenen Slot-System der Arena
   (`SLOTVON`, `renderKader`) nicht verbunden. Beides sind Chris' **letzte zwei Meldungen
   überhaupt**, beide betreffen die Arena, wie er sie im echten Spiel sieht — nicht rho. Das
   stützt das Modell in Abschnitt 1: die Achsen, auf denen Chris Fortschritt wahrnimmt, sind
   Sichtbarkeit und Produktivierung. Kampf-Audio ist ein eigenes Asset-Vorhaben (nicht in
   dieser Liste); die Profil-Anbindung gehört in Auftrag 1 als offener Punkt benannt, nicht
   stillschweigend liegen gelassen.
6. **Drei Agenten in einem Arbeitsverzeichnis** haben am 04.09. einen fremden Hunk in einen
   Commit gespült (`35d9e43a` → `1d56cf07`) und Messungen von 35 s auf 70–90 min gedehnt
   (`football-zufriedenstellend.md` Abschnitt 6/9). Die Lehre steht dort: eigener `git worktree`
   je Runde. Das gehört als Regel nach CLAUDE.md, nicht in einen Abschlussbericht.
7. **Flake:** `arena-headless-runner.test.ts` („kein Zombie-Prozess") zählt Prozesse und fällt
   unter Last mit wechselnden Zahlen (16 → 0, 18 → 10). Das ist ein Umgebungs-Test, kein
   Motor-Test; er sollte unter Last übersprungen oder robuster gezählt werden, sonst lernt
   jeder, rote Läufe zu ignorieren.

---

## 3. Die priorisierten Aufträge

Aufwand: **klein** ≈ eine Agentenrunde · **mittel** ≈ zwei bis drei · **groß** ≈ mehrere.
Reihenfolge ist Priorität; 1 und 2 sind unabhängig voneinander und können parallel laufen —
**in getrennten Worktrees.**

### 1. Merge-Hygiene und die drei kleinen Prozessdinge — *klein*

**Was:** PR #771 und #772 mergen. `rangtreue-schranke` auf `push: main` legen (oder Chris die
Frage mit der 11-min-Zahl vorlegen, falls er nightly will). CLAUDE.md: Hockey-Zahlen auf
58/78/0 % korrigieren, Worktree-Regel eintragen. `stand-aller-disziplinen.md` Abschnitt 4 den
Gewichtheben-Bühnenbild-Widerspruch auflösen. Die zwei triagierten, **nicht gebauten**
Feature-Lücken aus Chris' 25.08.-Meldungen (Kampf-Audio fehlt komplett; Basketball-Rollenprofile
nicht an die Arena-Einsatzliste angebunden, s. 2.7 Punkt 5) als offene Punkte in
`stand-aller-disziplinen.md` Abschnitt 4 eintragen — der Triage-Ordner ist der einzige Ort, an
dem sie heute stehen, und dort schaut niemand nach.
**Warum:** Alles darunter misst gegen CLAUDE.md und die Schranke; beide sollten stimmen, bevor
die nächsten Runden starten. Kostet zusammen weniger als eine Messung.
**Validierung:** `git log origin/main` zeigt beide Merges; ein Push nach `main` startet den
Schranken-Job; `grep "79 %" CLAUDE.md` leer.

### 2. Gewichtheben ins Spiel (S6) — *mittel bis groß*

**Was:** `gewichtheben-plan.md` S6 wörtlich: Eintrag in `ARENA_RESOLVED_DISCIPLINE_IDS`,
`runBattleModeArenaMatchday` über die Menge statt über das Literal `"basketball"` (drei Stellen,
2.1), `barbell.tsx` auf echte Heber-kg, Gesamt-kg-Tiebreak bei 3:3. Dafür nötig: eine
chassis-generische `spieleDisziplin(fd, saat)` neben `spieleFeldspiel`, bei der der Bühnenmotor
`seiten` (Duellstand) selbst liefert; eine eigene PPs-Referenz je Feldgröße
(`ziehe-basketball-pps-referenz.ts` als Vorlage, gegen das live-save-Abbild, ~300 Fixtures je
Größe); derselbe Drift-Wächter.
**Warum:** Die einzige der drei fertigen Disziplinen, die Chris' eigene Schranke **besteht**
(0,887 bei jeSeite 6, unabhängig reproduziert). Die Architekturfrage ist entschieden und vom
Review bestätigt. Und der Umbau des Resolve-Pfads auf „Menge statt Literal" ist die
Infrastruktur, die **jede** weitere Disziplin danach billig macht — das ist der Grund, es mit
der sauberen zuerst zu bauen, nicht mit der billigsten.
**Erwartung:** Ein Spieltag mit Gewichtheben als D1 läuft headless durch, Tabelle 2/1/0,
individuelle PPs aus echten Kilogramm, `barbell.tsx` zeigt echte Heber. Basketball
bit-identisch.
**Validierung:** neuer E2E nach dem Muster `battle-mode-arena-matchday-resolve-e2e`;
`OLY_APP_SQLITE_PATH=<Kopie> npx tsx scripts/e2e-saisonende-am-save-abbild.ts`; `node
scripts/miss-alle-disziplinen.mjs 24 gewichtheben basketball` unverändert (0,887 / 0,757);
`tests/basketball-pps-referenz-drift.test.ts` grün; **kein Auto-Merge**, das ist Produktion.

### 3. Basketball-K3: Punkte halb als erwartete Punkte buchen — *klein*

**Was:** In der Basketball-Wurfauflösung die bereits berechnete Trefferwahrscheinlichkeit
(`KURVE_BASKETBALL`) auf ein neues Feld `u.xp` (× Punktwert des Wurfs) buchen; in
`feldspielWert` für Basketball `punkte·k + xp·k` statt `punkte·2k`. **Kein neuer `rr()`, kein
verschobener Wurf** — Nachweis wie bei Hockey: acht erste Endstände vor/nach identisch.
Danach PPs-Referenz neu ziehen (Wertformel ändert sich, Drift-Wächter schlägt an) und
Basislinie neu bauen.
**Warum:** Basketball ist die einzige Disziplin, deren Rangtreue Chris heute erlebt. Muster
Saison 0,923 / Spiel 0,757 ist exakt Hockeys Vor-K3-Muster; dort brachte dieselbe Bauform
+0,068 bei Spannweite 0,18. Basketballs Spannweite ist 0,102 — schon +0,04 wäre ein echtes
Signal, kein Kaderrauschen.
**Erwartung, ehrlich:** +0,03 bis +0,07 je Spiel, Saison unverändert. Wenn es flach ist, ist
das nach einer Runde bekannt und der Motor unverändert.
**Validierung:** `node scripts/miss-alle-disziplinen.mjs 24 basketball` vor/nach, zusätzlich
n=48; Korridor (`miss-basketball-*`) Zeichen für Zeichen identisch; Star-Rang-1-Quote
mitmessen.

### 4. Sprite-Serie über die systematischen Cluster — *mittel, in Häppchen*

**Was:** Nicht 70 Einzelrunden, sondern Cluster: (a) die neun byte-identischen
Doppelvorlagen auflösen (je ein eigenes Rezept für den Charakter, der das Bild nicht trifft),
(b) ein Wald-Riesen-Vollbild/-Schicht für die fünf Baumwesen, (c) eine gehörnte
Koloss-Variante für die sechs Minotaurus/Zentaur-Charaktere, (d) die vier ★-Fälle mit der
prozeduralen Bauform, die Vigil und Seraph-11 auf 4 Sterne gehoben hat. Mit `skala`,
`leuchtenderBauch`/`gluehenderRiss`/`gluehenderKern` als Werkzeugkasten; „eine unvollständige
Näherung schlägt keinen Fix" (Chris, 01.09.) als Regel.
**Warum:** 48 % der Charaktere unter drei Sternen; die Achse ist die einzige, die Chris ohne
Spieltag sieht; das Risiko ist gemessen null (Bloater: 19/20 bit-identisch); ein Cluster-Fix
trifft drei bis sechs Charaktere. Das Bloater-Beispiel war ausdrücklich als Vorlauf für „ggf.
eine ganze Serie" gedacht.
**Erwartung:** Je Runde 5–10 Charaktere von ★★ auf ★★★/★★★★; nach vier Runden liegt der
★★-Anteil unter einem Drittel.
**Validierung:** `sprite-fit-bewertung.json` im **selben Commit** nachgezogen (Regel „Score
folgt dem Sprite"); Vorher/Nachher-PNG je Charakter; `node scripts/miss-alle-disziplinen.mjs
24` bit-identisch; ein Live-Arena-Screenshot je Cluster.

### 5. Hockey ins Spiel — *mittel*, nach 2, mit Chris' Ja

**Was:** Nach der Verallgemeinerung aus Auftrag 2: `"hockey"` in die Menge, eigene PPs-Referenz
ziehen (Feldspieler und Torwart getrennt — die Torwart-Formel hat einen anderen Mittelwert,
`HK_TW_BASIS` ist genau dieser Ausgleich), `rink.tsx` gegen den Boxscore halten, E2E.
**Warum:** Zweitbilligste Disziplin (Runner läuft heute schon mit `fd="hockey"`), eigene
Eisfläche, Torwart, Strafen, Überzahl — die meiste Mechanik-Arbeit des Projekts nach
Basketball, und sie erreicht das Spiel nicht. Star nie Letzter (0 %), Star oben in 58 %.
**Die Bedingung:** 0,669/0,719 liegt unter 0,80. Chris muss sagen, ob „knapp, aber doppelt so
rangtreu wie die NHL" für den Live-Betrieb reicht. Die Frage steht mit allen Zahlen im
NHL-Review Abschnitt 5; sie sollte **vor** dem Bau beantwortet sein, nicht danach.
**Validierung:** wie 2; zusätzlich `miss-rangtreue-nach-rolle.mjs hockey 48` (Torwart-Formel
0,39 — die schwache Zahl gehört Chris gesagt, bevor er sie im Spiel sieht).

### 6. Hockey H3: deterministische Wechsel/Eiszeit — *groß*, nach 5, mit Messprotokoll

**Was:** Fester Wechselplan (sechster Feldspieler rotiert in fester Reihenfolge aus der
Aufstellung ein; kein `rr()`), On-Ice-Zähler je Spieler, Eiszeit-Gewichtung im Wert.
Vorab festgelegt: Eiszeit aus der **Aufstellungsreihenfolge**, nie aus `eig`; Messung n=24/48/96
Feldspieler-only, Vorzeichen muss in allen dreien halten; Torkorridor unverändert.
**Warum:** Einziger benannter Hebel ohne RNG-Kaskade, der die Orakel-Decke 0,73 überhaupt
anheben kann (neue Kanäle statt neuer Gewichte). Dazu H2 (Torwart auf GSAx statt GSAA, ein
Zähler ohne `paradeFaktor`) und H5 (Sweep 1,5/1,5) als billige Beifänge in derselben Runde.
**Erwartung, ehrlich:** +0,03 bis +0,08; ob 0,80 fällt, ist offen. Wenn Chris nach 5 sagt „gut
genug", entfällt 6 ersatzlos — das ist eine legitime Entscheidung, keine Niederlage (NHL-Review
5.2: die restlichen 0,08 machen das Spiel *unrealistischer*, weil das Spiel es braucht).
**Validierung:** Vorher/Nachher wie oben; PPs-Referenz danach neu ziehen (Wertformel bewegt
sich); Drift-Wächter.

### 7. Football: Entscheidungsvorlage statt Runde — *klein*

**Was:** Eine Seite für Chris: die Matrix-Zeile, `LAUFKRAFT {spirit 56, health 30, power 14}`,
awareness −0,335, die zwei Wege („Matrix anfassen — dann ist die Zielgröße selbst neu, alle
Football-Zahlen sind danach nicht vergleichbar" / „0,47 akzeptieren, Football als
Schauspiel-Disziplin führen, Spieler-Bewegung als nächste visuelle Runde"). Plus die
Ball-bewegt-sich-Spieler-nicht-Auskunft, die in keinem Fazit stand.
**Warum:** Beide Football-Runden vom 04.09. haben den Grenzertrag selbst benannt; der nächste
Hebel ist nicht baubar, ohne dass Chris etwas entscheidet, das ihm gehört.
**Validierung:** Chris' Antwort steht in einem Dokument, nicht in einem Chat (Opus-Überwachung
Punkt 11/16 — dieselbe Regel).

### 8. Eiskunstlauf / Climbing: je eine Budget-Runde — *klein*, ganz hinten

**Was:** Nach Chris' Budget-Methode, gegen die kaderfeste Zahl, mit der Regel „Bewegung
kleiner als Spannweite ist nichts" (Eiskunstlauf 0,125, Climbing 0,192).
**Warum:** Legitim, aber Wirkung für Chris null, solange beide Mockup sind. Eiskunstlauf hat
Saison 0,958 — die Mechanik belohnt das Richtige, ein Bühnen-K3-Analogon (Wertung halb als
Erwartung) wäre die naheliegende Bauform, kein Rezept.

---

## 4. Was ich bewusst NICHT empfehle

| Nicht | Warum — mit der Zahl, die es entscheidet |
|---|---|
| **Ein dritter Zoneneintritt-Anlauf** ohne neue Bauform | Vorzeichen kippt zwischen n=24 (+0,054), n=48 (+0,006), n=96 (−0,018); 40–50 `rr()` je Spiel dominieren die Messung. Der blinde Eintritts-Bonus ohne Würfel (Recherche 3.1: Saison 0,842 → 0,903) wäre die einzige neue Bauform — und selbst der hebt nur Validität, nicht die Verlässlichkeit, die laut 1.4 fehlt. |
| **Ein dritter Arena-Zielwahl-Anlauf** ohne Sonde | Zwei Formeln, beide additive Score-Vergleiche ohne Position; TDM ±0,000, Mini-DM −0,305. Der letzte Bericht verlangt eine Ziel-Konzentrations-Sonde **vor** jeder weiteren Variante. Wer sie nicht baut, wiederholt den Rate-Zyklus. Und `cdKuerzung` gehört Chris. |
| **Eine dritte Football-Rezeptrunde** | Zwei Runden am 04.09., +0,155 unter der Spannweite 0,258, Bewegung durch Down-Verdrahtung +0,008 innerhalb 0,383. Der Bericht sagt selbst „abnehmender Grenzertrag", und gepoolte Attribut-Korrelation ist als Proxy gemessen untauglich (4.6). |
| **Football produktivieren** | 0,468, Mechanik bewegt sich (Matrix offen, Spieler stehen still). Regel „erst Mechanik, dann Rezept, nie umgekehrt" — eine PPs-Referenz auf einem wandernden Motor ist sofort veraltet. |
| **Eine weitere Hockey-Rezeptrunde** | Orakel-Decke 0,73 mit den heutigen Posten, in-sample; drei Runden netto −0,023 vor K3; Torwart-Konstanten und xG-Varianten gezogen bzw. flach. |
| **Die Uhr** | 19-fache NHL-Ereignisdichte; 3 × 160 s brachte Feldspieler 0,749, alle 12 **sanken** auf 0,535; Chris' Entscheidung 3 × 1:20 steht. |
| **Bully-Wertposten, Helm-Overlay, Hash Marks** | Bully: 0,013–0,015 Tore je Gewinn, real irrelevant. Helm: drei weiße Ringe ohne Detail, Ankerpunkt-Vermessung in Größenordnung `sprite-handpunkte.md` — schlechter Tausch. Hash Marks: kosmetisch, Football ist nicht live. |
| **Arena `kurve:`-Datenblock oder Battlefield-Objective jetzt** | Beides sinnvoll, beides teuer, beides für drei Mockup-Disziplinen mit Saison-Validität 0,07–0,62 — jeder Euro dort wirkt für Chris erst nach Produktivierung, und die Arena ist von allen Chassis am weitesten davon entfernt. |
| **Mehr Messinfrastruktur** (8–10 Kader-Paarungen, n=48 als Standard) | Die Grundlage trägt: deterministisch, Median über fünf echte Kader, CI-Schranke reproduziert bit-identisch. Mehr Paarungen würden vor allem der Arena helfen (Spannweite 0,39–0,80) — und die soll gerade liegen bleiben. |
| **Die Matrix „reparieren"** (Football awareness −0,335) | Die Matrix ist die Zielgröße. Wer sie ändert und danach besser misst, hat nichts gemessen. Das ist ein Design-Entscheid für Chris (Auftrag 7), keine Runde. |

---

## 5. Was ich nicht geprüft habe

- **Ob der Bühnenmotor `seiten` billig liefern kann.** `MOTOREN[fd]` ist generisch
  (`sichern/bau/lauf/wert/namen/zurueck`), aber `spieleFeldspiel` liest `fsPunkte` — ein
  Feldspiel-Objekt. Für Gewichtheben muss der Duellstand aus dem Motor heraus; ich habe die
  Stelle nicht gebaut, nur die Schnittstelle gelesen. Das ist der eine Punkt, an dem Auftrag 2
  teurer werden kann als geschätzt.
- **Ob Basketballs Wurfauflösung `pTreffer` an einer Stelle hält, an der es sich ohne
  `rr()`-Verschiebung buchen lässt.** Bei Hockey war es so (`pTor` vor den drei Würfen); für
  Basketball habe ich `KURVE_BASKETBALL`/`SCHUSS_TIER` nur als Existenz nachgesehen. Auftrag 3
  beginnt mit genau dieser Prüfung, und wenn sie negativ ausfällt, ist die Runde nach einer
  Stunde beendet.
- **Den Sound-Bug vom 25.08.** — nur die Triage gelesen, nicht im Spiel reproduziert.
- **Die Sprite-Cluster** habe ich aus `sprite-fit-ergebnisse.md` übernommen (Stand der ersten
  Bewertungsrunde) und nur die heutige Sterne-Verteilung neu gezählt, nicht jedes Portrait
  erneut angesehen.
- **Keine Messung gefahren.** Alle Zahlen sind aus den Berichten und den eingecheckten
  Daten; die Spiegel-Frische ist die einzige Sonde, die ich heute gestartet habe.

---

## 6. Die Tabelle

| # | Auftrag | Aufwand | Achse | Wirkung für Chris | Validierung |
|---|---|---|---|---|---|
| 1 | #771/#772 mergen, Schranke automatisch, CLAUDE.md/Stand-Doku nachziehen, Sound-Ticket prüfen | klein | Prozess | sofort | Merges sichtbar, Job läuft, grep leer |
| 2 | Gewichtheben ins Spiel (S6) + Resolve über Menge statt Literal | mittel–groß | Produktivierung | **die erste bestandene Disziplin, die er spielt** | E2E, Save-Abbild, rho bit-identisch, Drift-Wächter |
| 3 | Basketball-K3 (Punkte halb als erwartete Punkte) | klein | Validität, live | einzige Live-Disziplin wird rangtreuer | rho 24/48, Korridor identisch, Referenz neu |
| 4 | Sprite-Serie über die Cluster | mittel, in Häppchen | Sichtbarkeit | 48 % der Charaktere sichtbar besser | Bewertung im selben Commit, PNGs, rho bit-identisch |
| 5 | Hockey ins Spiel | mittel | Produktivierung | zweite Disziplin live | wie 2, plus Torwart-Zeile |
| 6 | Hockey H3 (Wechsel/Eiszeit) | groß | Validität + Verlässlichkeit | vielleicht 0,80 | n=24/48/96 Vorzeichen stabil |
| 7 | Football-Entscheidungsvorlage | klein | Design | Chris entscheidet | Antwort im Dokument |
| 8 | Eiskunstlauf/Climbing Budget-Runden | klein | Validität, Mockup | null, bis live | Spannweite-Regel |

**Wenn nur zwei Dinge passieren: 2 und 4.** Das eine bringt die Messarbeit dieser Woche zum
ersten Mal ins Spiel und macht jede weitere Disziplin danach billig; das andere ist die
Achse, auf der Chris den Fortschritt sieht, ohne einen Spieltag zu simulieren — und die
bisher genau einmal angefasst wurde.
