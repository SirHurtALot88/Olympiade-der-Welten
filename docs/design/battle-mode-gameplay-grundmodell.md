# Gameplay-Grundmodell für Battle Mode — Konsultation Opus + Fable

**Das ist ein Vorschlagsdokument, keine Entscheidung.** Zwei unabhängige Konsultationen
(Opus, Fable — sie haben sich nicht gegenseitig gesehen) zu drei Fragen: (A) was macht ein
gutes Manager+Auto-Battle-Modell aus, extern recherchiert; (B) ist Basketball als Grundstein
für alle 20 Disziplinen tragfähig; (C) ein Vorschlag für ein neues „Konstanz"-Stat. Stand
31.08./01.09.2026, gegen `main` nach PR7 (Battle-Mode-Plan) recherchiert.

**Wichtige Korrektur während der Recherche**: beide Konsultationen hatten zunächst mit
„Sport-Varianz ist normal, siehe Baseball/Football Manager" geantwortet. Chris hat dem
ausdrücklich widersprochen — er will deutlich weniger Varianz als reale Sport-Vorbilder:
ein stark überlegenes Team soll ~95 % seiner Spiele gewinnen (nicht 65-70 % wie im echten
Basketball), ein Star soll in den meisten Einzelspielen auch tatsächlich oben in der
Wertung stehen. Beide Antworten unten sind bereits um diese Korrektur ergänzt.

---

## A. Bestätigt: Auto-Battle, keine Einschränkung

Drei unabhängige Belege, in beiden Konsultationen: (1) Football Manager, der größte
Manager-Sim überhaupt, hat im Match selbst keinen Spieler-Eingriff — die Debatte dreht
sich nur um die Zuschau-Dosierung (Key Highlights/Extended/Full), nicht ums Eingreifen.
(2) Das Auto-Battler-Genre (TFT, Auto Chess) beweist, dass autonome Kämpfe tragen, wenn
die Vorbereitung zählt. (3) Eslabong selbst — Chris' eigenes Vorbild — führt Autobattle
als gleichrangigen, nicht als Sparmodus. Die Rechnung stützt Chris' Längen-Argument:
16 Partien pro Spieltag × 10 Spieltage = 160 Partien/Saison — jede Form von Eingriff
multipliziert sich damit.

Die Architektur selbst (vier geteilte Chassis, „Rezept"-Kompositwerte aus Rohattributen,
deterministischer Seed+Replay) entspricht strukturell dem erfolgreichsten Open-Source-
Vertreter der Gattung, [ZenGM/Basketball GM](https://github.com/zengm-games/zengm) — bis
hin dazu, dass ZenGMs „fuzz on displayed ratings" unabhängig demselben Prinzip wie das
Projekt-eigene `hiddenPotentialScore`/`revealedPotentialRange` entspricht.

## A.1 Die Varianz-Korrektur — konkrete Stellhebel

**Ursache, warum Basketball heute so stark streut** (Fable, nachgerechnet an der echten
Formel in `bauFeldspiel()`):

```js
aufbauChance = 0.50 + (AUFBAU − ABWEHR)·0.0035 + TEAMGEIST·0.0060   // geklemmt [0.20, 0.94]
```

Ein Attribut-Vorsprung von 50 Punkten verschiebt die Chance nur um 17,5 Prozentpunkte —
der Rest ist Münzwurf, und die harten Klemmen (0,20/0,94) verhindern selbst bei einem
99er-gegen-19er-Duell mehr als ~94 %. **Mehr Ballbesitze allein reicht nicht**: um von
~65 % auf 95 % Siegquote nur über mehr Stichprobe zu kommen, bräuchte es die zehnfache
Ereigniszahl.

**Empfohlene Stellhebel, in Reihenfolge:**

1. **Logistische Erfolgschance-Kurve mit einer zentralen Steilheits-Konstante `k`**
   statt der linearen Formel — analog zur `KURS`-Tabelle im Kampf-Chassis (eine
   Balancing-Fläche statt vieler Einzelschrauben). Betrifft `aufbauChance`, `technik`,
   die Rebound-Chance.
2. **Quadratische statt lineare Gewichtung bei Passempfänger/Rebound.** Die Ballführer-
   Auswahl ist bereits quadratisch (`pow(max(1,u.AUFBAU−20),2)`), Passempfänger und
   Rebounder laufen noch linear — auf dieselbe Form heben konzentriert Ereignisse UND
   Erwartungswert auf den Star zugleich.
3. **Mehr Ballbesitze** (`zuegeJeSeite` von 12 auf ~30) als Verstärker, nicht Ersatz —
   die Rundendauer bleibt bei 60 s, weil `zugDauer` bereits parametrisch mitskaliert.
   Senkt Rauschen um ~1/3 (√n), muss aber gegen die kalibrierten `technikMake`/
   `GEO_BONUS`-Trefferquoten gegengemessen werden.
4. **Score-Margin-Faktor** (ZenGM-Vorbild: „Teams spielen leicht besser, wenn sie
   zurückliegen") — ändert **nur die Dramaturgie** (engere Spiele bis zum Schluss),
   **nicht die Siegquote**. Löst Blowout-Ödnis, ohne das neue 95-%-Ziel zu gefährden.
5. **AUSDAUER ist im Basketball-Live-Motor mechanisch tot** (Code-Kommentar bestätigt
   es) — ein bislang totes Rezept bekäme durch eine Fatigue-durch-Usage-Reform (Chris'
   eigener offener Punkt F im Handoff) echte Bedeutung.

**Wichtige Nebenwirkung**: eine steilere Kopplung verstärkt exakt den mehrfach
dokumentierten „Erfolgschance-Rolle gewinnt strukturell mehr Einfluss"-Effekt — die
Pp-Abweichung verschiebt sich mit und muss **parallel** zur neuen Siegquoten-Kurve
gemessen werden, nicht nacheinander.

**Vor jedem Tuning nötig**: Chris muss „stark überlegen" in Eignungspunkten beziffern
(z. B. „+15 Ø-Eignung je Spieler ⇒ 95 %, +5 ⇒ 70–75 %, ±0 ⇒ 50 %"), sonst ist 95 % nicht
messbar. Eine neue Abnahmezahl („Favoriten-Siegquoten-Kurve") fehlt komplett und müsste
geschaffen werden.

## A.2 Der größte strukturelle Risikopunkt (Opus, neu, nicht im Handoff)

**Basketball läuft laut Saisonplan genau EINMAL pro Saison.** Selbst mit den Stellhebeln
oben bleibt ein Einzelspiel eine kleine Stichprobe. Reale Basketball-Reliabilitätsstudien
brauchen ~100 Spiele für gute Boxscore-Verlässlichkeit. Ein Manager, der ein halbes Jahr
an seinem Basketball-Kader gebaut hat, sähe davon in der Tabelle sonst fast nichts —
**das ist ein größeres Risiko als jede Pp-Abweichung.** Deckt sich mit `docs/design/
fatigue-saisonlaenge-plan.md` Teil A (mehr Spieltage je Disziplin) als möglicher Lösung,
dort aber noch unentschieden.

## A.3 Weitere konkrete Verbesserungen (beide Konsultationen, günstig, balance-neutral)

- **Momentum-/Vorteilsleiste im Feldspiel und Kampf** — existiert im Denkduell schon
  (`u.verlauf[u.aktuell]`), fehlt sonst überall. Macht aus einem Punktestand einen Verlauf.
- **Run-/Streak-Narration im Feed** — rein textlich, über bereits gewürfelte Ereignisse.
- **Key-Highlights-Stufe** für Spieltage mit vielen Partien (FM-Vorbild: nicht die Länge
  einer Partie langweilt, sondern Totzeit vor Ereignissen).
- **Text-Seed-Bug an der Quelle fixen** (`battle-mode.engine.js`, `NaN>>>0 → 0`), nicht
  nur im Runner umgehen (PR6 hat es dort bereits umgangen, siehe `BATTLE_ARENA_UEBERGABE.md`).

---

## B. Machbarkeit: Basketball als Grundstein für alle 20 Disziplinen

**Ja, machbar — aber als neunzehnmal dieselbe Kalibrierungsarbeit, nicht als „Ausrollen".**
Die vier Chassis sind richtig geschnitten und sind nicht der Restaufwand. Beide
Konsultationen bestätigen das unabhängig, mit denselben Kern-Belegen: die `MOTOREN`-
Registry (Selbstanmeldung), `scripts/generiere-arena-daten.ts` (alle 20 Matrizen + 112
Slot-Profile bereits erzeugt), die disziplin-agnostische `messe-arena-einfluss.mjs`.

### B.1 Zwei neue Befunde, die im Handoff-Dokument nirgends stehen

1. **„Feldspiel-Chassis" ist heute faktisch zwei Motoren.** Basketball läuft über den
   neueren **Live-Motor** (`initBasketballLive`, echte Positionen, Fastbreak, Doppeln,
   Freiwürfe); Football/Hockey/Tennis laufen noch über den älteren **Vorab-Durchlauf**.
   Wer „Hockey erbt Basketballs Reife" sagt, erbt das Chassis, nicht die Reife — der
   Live-Pfad muss erst portiert werden. Zusätzliche, aber überschaubare Arbeit.
2. **Pp-Treue allein genügt nicht** — eine „Archetypen-Trennschärfe"-Stufe fehlt als
   Messkriterium. Die frühere Vier-Archetypen-Demo zeigte: ein matrixtreues Rezept
   (17,3 Pp) kann trotzdem falsch sein, wenn kein Build in seiner eigenen Kategorie
   führt. Der Sprung auf 20,4 Pp war ein **Fortschritt**, obwohl die Zahl schlechter
   wurde. Diese Stufe sollte in die Abnahme für jede künftige Disziplin aufgenommen werden.

### B.2 Zwei neue Struktur-Rückfragen an Chris

- **Tennis gehört vermutlich nicht ins Feldspiel-Chassis.** Seine Matrix
  (intelligence/awareness/spirit/stamina/dexterity) ist kein Kollisions-/Ballbesitz-
  Profil, und `jeSeite:6` bedeutet bei Tennis in Wahrheit sechs parallele Einzel, nicht
  geteilten Ballbesitz — strukturell identisch zu Speed-Schach/I-Spy
  (`BUEHNE_ART`, `duell:true`). Speed-Schach traf 18,2 Pp beim ersten Versuch ohne
  Nachziehen; Tennis liegt im Feldspiel bei 46,5. Unbestätigte, aber plausible
  Vermutung — ein `messe-arena-einfluss.mjs tennis 48`-Vergleich vor/nach Wechsel wäre
  der Beweis.
- **Football hat eine ungeklärte Grundstruktur.** Seine Matrix (spirit/torment/health/
  awareness/will) ist ein Kollisions-/Durchhalte-Profil, keine Ballwechsel-Schleife.
  Soll Football die Basketball-Schleife übernehmen, oder eine Down-Struktur (vier
  Versuche, Raumgewinn, jeder Zug ein Zusammenstoß)? Modellfrage, keine
  Kalibrierungsfrage — das erklärt vermutlich die 63,1 Pp.

### B.3 Stand je Chassis (beide Konsultationen decken sich, Details siehe Agenten-Volltexte)

| Chassis | Bester Wert | Schlechtester Wert | Haupt-Blocker |
|---|---|---|---|
| Feldspiel | Basketball 20,4 Pp | Football 63,1 Pp | Live-Pfad-Portierung (Hockey/Tennis/Football); Tennis/Football-Strukturfrage |
| Bühne | Wettessen 12,6 Pp | I-Spy 43 Pp | nur Produktivierungs-Haken bei den meisten; I-Spy strukturell schwer (10 Attribute auf 7 Rollen) |
| Bahn | Staffel 21,9 Pp | Spurt 56,7 Pp | Rennen→Fixture-Ergebnis-Modell fehlt (außer Staffel); Spurts Rempel-Frage blockiert |
| Kampf | Fechten 11,0 Pp | TDM 54,2 Pp | **33 von 35 Klassenkarten fehlen** (Chris' Screenshots nötig); Heiler-Balance-Frage; TDM-Grundsatzfrage |

**Die Ironie, die beide Konsultationen unabhängig aussprechen**: Kampf ist die Familie
mit dem echten Vorbild (Eslabong) und den abgeschriebenen Klassenkarten — und am
weitesten von der Produktivierung entfernt, weil die fehlenden 33 Karten ein
Datenbeschaffungs-, kein Code-Problem sind.

### B.4 Priorisierte Reihenfolge — leichte Divergenz zwischen den Konsultationen

Beide: **zuerst Basketball wirklich fertigstellen** (PR8/9 + die A.1-Stellhebel) — die
Blaupause muss fertig sein, bevor sie kopiert wird; jeder Fehler, der jetzt drinbleibt,
wird 19-mal mitkopiert. Danach:

- **Fable**: Hockey zuerst (nächstliegend, dieselbe Chassis-Familie).
- **Opus**: Speed-Schach zuerst (18,2 Pp ohne jede Nachziehung, hat über `duell:true`
  bereits eine zum 2/1/0-Modell passende Fixture-Struktur, beweist Portierbarkeit in ein
  ANDERES Chassis statt nur innerhalb desselben), dann Wettessen (löst „Jury-Punktzahl
  → Fixture-Ergebnis"), dann erst Hockey.

Opus' Begründung (jeder Schritt löst eine Strukturfrage für alle folgenden mit) ist
detaillierter hergeleitet — das ist meine Einschätzung, keine Entscheidung; beide
Reihenfolgen sind vertretbar.

### B.5 Gesammelte Rückfragen an Chris (aus beiden Berichten)

1. Zwei-Heiler-Kader: legitime, aber schwächere Strategie, oder muss Heilung stärker
   werden? (blockiert alle vier Kampf-Disziplinen)
2. TDM: soll Bewegung an Speed hängen, obwohl die Matrix Speed mit 0 bepreist?
3. Spurt: darf ein Rempler den Remplenden gezielt vorbeibringen?
4. Tennis: Feldspiel oder Duell-Bühne wie Speed-Schach?
5. Football: Ballwechsel-Schleife oder Down-/Kollisionsstruktur?
6. Gewichtheben: was tut Charisma 23 mechanisch?
7. Bahn/Bühne → Fixture: Platzierungssumme bzw. Punktesumme, Gleichstand = Remis — richtig?
8. Mini-DM-Turnierform — noch kein Format definiert, strukturell inkompatibel mit dem
   8-Fixtures-Spieltag.
9. Bleibt „ein Termin je Disziplin und Saison"? (Größte Erlebnisfrage laut Opus, siehe A.2)
10. Die 33 Klassenkarten — Screenshots aus Chris' Dropbox.
11. „Stark überlegen" in Eignungspunkten beziffern, für die neue Siegquoten-Zielkurve.

---

## C. Das „Konstanz"-Stat

### C.1 Datenquelle — drei Kandidaten geprüft, ein klarer Sieger

- **`player.form`**: existiert, aber leer/verbrannt — bei allen 2984 Seed-Spielern und
  in allen sieben Live-Spielständen exakt 0, und ein früherer Bug entstand bereits daraus,
  dass Bühne die 0 als echte Form las. **Nicht empfohlen.**
- **`alignment`** (R/N/C-Achse): perfekte Semantik, aber `DEFAULT_ALIGNMENT="N"` für
  **jeden** generierten Spieler — für neue Spieler tot, nur als Zusatzsignal für die
  2984 Seed-Spieler brauchbar.
- **Traits** (18 positiv/18 negativ, kanonisch): **empfohlen.** Fließen schon heute über
  `arena-kader-adapter.ts` in die Arena (`tp`/`tn`), kein neuer Datenpfad nötig. Zwei
  Präzedenzfälle für „Trait → Zahl"-Tabellen existieren bereits im Code
  (`LEGACY_TRAIT_TRAINING_FACTOR_PCT`, `trait-salary-factors.json`), inklusive eines
  bereits admin-tunebaren Konfigurationspfads.

### C.2 Die Mechanik

```
Konstanz(p) = clamp(50 + Σ KONSTANZ_TRAIT[t] für t in Traits(p), 5, 95)
```

Eine neue, klar als **erfunden** zu kennzeichnende Tabelle (28 Trait→Zahl-Einträge),
Vorzeichen aus der Wortbedeutung ableitbar, Beträge gesetzt. Ein Spieler ohne Traits
(12 von 2984) bekommt exakt 50 — neutral, ohne Erfindung.

**Wichtige Erkenntnis, die beide Konsultationen unabhängig hervorheben**: es gibt
**zwei verschiedene Varianzquellen**, und sie brauchen unterschiedliche Andockpunkte:

| Varianzquelle | Was | Andockpunkt | Löst Chris' 10-Spiele-Befund? |
|---|---|---|---|
| Zwischen-Spiel | „Heute ist nicht sein Tag" | Formkarte (`FORMWERTE`, vor dem Spiel gezogen) | Nein |
| Innerhalb-Spiel | Boxscore-Rauschen bei ~24 Ballbesitzen | Sub-Skill-Jitter, je Spiel/Spieler gezogen | **Ja** |

Chris' Befund (19,9-Rating schlägt 99,6-Rating im Einzelspiel) ist überwiegend
**innerhalb-Spiel-Rauschen** — eine vor dem Spiel gezogene Formkarte kann daran nichts
ändern. Empfehlung: **beide** Mechanismen bauen, mit unterschiedlicher Rolle:

- **Formkarten-Modulation** (`STREUFAKTOR(K) = 0,4 + 1,2·(1−K/100)`) für Bahn/Bühne, wo
  die Formkarte ohnehin der Haupthebel ist. Bei Konstanz=50 ist der Faktor exakt 1,0 —
  **rückwärtskompatibel, keine der 20 kalibrierten Pp-Werte ändert sich** für einen
  durchschnittlichen Spieler.
- **Sub-Skill-Jitter innerhalb des Spiels** (FM-Vorbild, aber symmetrisch statt nur nach
  unten) für Feldspiel/Kampf, wo es einen echten Boxscore gibt — das ist der Mechanismus,
  der tatsächlich am Chris-Befund ansetzt.

In beiden Fällen: **Erwartungswert bleibt für jeden Spieler unverändert** — Konstanz ist
keine versteckte Stärke, nur Zuverlässigkeit. Muss in `einflussVon()`/den Serien **je
Lauf neu gezogen** werden (derselbe Messfehler wie bei Formkarten/Mutatoren, zweimal
schon repariert, darf kein drittes Mal passieren) und darf **nicht** aus den zwölf
Matrix-Attributen abgeleitet werden (sonst zweiter Wirkkanal, verfälscht die
Pp-Abweichung).

### C.3 Fünf offene Fragen an Chris

1. **Symmetrisch (wie von dir beschrieben) oder FM-artig (nur nach unten)?** FM macht
   Consistency zu echter Stärke (müsste in Marktwert/Gehalt bezahlt werden); symmetrisch
   bleibt balance-neutral. Empfehlung: symmetrisch, passend zu deiner Beschreibung.
2. **Sichtbar oder versteckt?** FM versteckt es komplett; das Projekt hat mit
   `hiddenPotentialScore`/`revealedPotentialRange` bereits die Scouting-Infrastruktur
   dafür — „der Scout sagt: an guten Tagen Weltklasse" wäre fast gratis einzuhängen.
3. **Traits als Quelle akzeptiert**, oder soll es ein komplett neuer, im Generator
   gewürfelter 13. Wert sein (Vorteil: liegt in keiner Disziplinmatrix; Nachteil: alle
   2984 Bestandsspieler hätten ihn nicht, komplett erfunden)?
4. Soll `alignment` als Zusatzsignal mitzählen (nur für die 2984 Seed-Spieler relevant)?
5. Gilt Konstanz überall gleich, oder soll sie disziplinweise unterschiedlich stark wirken
   (z. B. Eiskunstlauf/Gewichtheben stärker als Wettessen)? Empfehlung: erst überall
   gleich, differenzieren nur wenn eine Messung es verlangt.

### C.4 Ehrliche Grenze

Konstanz **verteilt Varianz um, sie senkt sie nicht.** Ein unbeständiger Star wird
dadurch nicht seltener von einem Rauschen-Ausreißer geschlagen — er wird nur öfter
kenntlich unbeständig, während ein beständiger Spieler enger um seinen wahren Wert bleibt.
Die eigentliche Rauschsenkung kommt aus A.1 (mehr Ballbesitze, steilere Chance-Kopplung).
Beide Bausteine gehören zusammen, keiner ersetzt den anderen.

---

## Quellen (externe Recherche, beide Konsultationen)

Football Manager Hidden Attributes ([Passion4FM](https://www.passion4fm.com/football-manager-guide-to-hidden-attributes/),
[sortitoutsi](https://sortitoutsi.net/content/74854/fm26-hidden-attributes-explained)) ·
NBA 2K Consistency ([2KRatings](https://www.2kratings.com/nba-2k-attributes-definitions)) ·
OOTP/Baseball-Varianz ([Hardball Times](https://tht.fangraphs.com/10-lessons-i-learned-from-creating-a-baseball-simulator/),
[Grokipedia](https://grokipedia.com/page/Out_of_the_Park_Baseball)) ·
ZenGM Score-Margin-Faktor ([ZenGM Blog](https://zengm.com/blog/2020/07/game-sim-realism/)) ·
[zengm-games/zengm](https://github.com/zengm-games/zengm) ·
TFT Randomness-Philosophie ([Dot Esports](https://dotesports.com/tft/news/riot-reflects-on-good-and-bad-randomness-for-teamfight-tactics-future-plans)) ·
Eslabong ([Steam](https://store.steampowered.com/app/4560660/Eslabong/),
[ModDB](https://www.moddb.com/games/eslabong/news/eslabong-codex-and-wiki-patch-is-here)) ·
Blaseball-Narrativ ([Wikipedia](https://en.m.wikipedia.org/wiki/Blaseball)) ·
Basketball-Boxscore-Reliabilität ([Research Quarterly for Exercise and Sport](https://www.tandfonline.com/doi/abs/10.1080/02701367.2019.1597243)).

## Zentrale Repo-Referenzen

`docs/BATTLE_ARENA_UEBERGABE.md` · `docs/design/battle-mode-spielmodus-plan.md` ·
`docs/design/battle-mode-pps-modell-plan.md` · `docs/design/fatigue-saisonlaenge-plan.md` ·
`public/mockups/battle-mode.engine.js` (`bauFeldspiel`, `initBasketballLive`, Formkarten
Z. 2675–2701) · `lib/training/trait-training-signal.ts` (Trait→Zahl-Präzedenzfall) ·
`lib/foundation/battle-arena/arena-kader-adapter.ts` (Trait-Datenpfad in die Arena) ·
`lib/data/olyDataTypes.ts` (`form`, `alignment`, kein freies 13. Attributfeld).
