# Roguelike-Skill-Pool für die Kampfdisziplinen — Konzept (Fable, 17.09.)

**Reine Recherche und Entwurf. Nichts davon ist gebaut, und es soll jetzt auch nichts gebaut
werden.** Chris: „das muss später gelöst werden — Fable soll das mal ausarbeiten."

Die Frage, in Chris' Worten (paraphrasiert): Unsere Spieler leveln nicht klassisch. Wenn sie
also Skills haben sollen, braucht es einen Mechanismus, sie **aus einem Pool zu picken** — wie in
Hades, Slay the Spire oder Risk of Rain: nach bestimmten Ereignissen erscheinen drei Karten,
der Manager wählt eine. Zwei Szenarien hat er genannt:

1. **Einmalige Wahl zu Kampagnenbeginn** — beim Erstellen / Eintritt in die Liga.
2. **Nach einem abgeschlossenen Kampf** — Teilnehmer von TDM / Mini-DM / Battlefield bekommen
   drei Skills angeboten und können damit einen vorhandenen ersetzen.

Jede Fundstelle unten ist gegen den Stand `91b17c3a` (main, 16.09.) geprüft. `engine.js`
meint `public/mockups/battle-mode.engine.js`.

---

## 0. Die Kurzfassung

- **Es gibt heute keine wählbaren Skills am Spieler.** `Player` kennt zwölf Attribute,
  Klasse, Unterklassen, Traits, Disziplinwerte — kein Feld für Fähigkeiten. Im Kampfmotor
  tragen **alle** Spieler aus dem echten Spielstand denselben Platzhalter-Satz (`MATRIARCH`,
  `engine.js:4273`), und zwar aus einem gemessenen Grund: mit ungleichen Kits misst jede Serie
  die Kit-Verteilung statt die Spieler.
- **Die Vorarbeit ist größer als erwartet.** `lib/battle/class-kits.ts` hat bereits einen
  gemeinsamen `SKILL_POOL` (18 Skills, Rarität Common/Uncommon/Rare, Zugang
  guaranteed/learnable) — abgeschrieben von zwei Eslabong-Klassenkarten (Cleric, Priest).
  `lib/battle/subclass-archetypes.ts` ordnet alle 56 Unterklassen **mehreren** Archetypen zu,
  ausdrücklich nach Chris' Regel *„dann hätten die potentiell einen größeren skill pool"*. Das
  ist genau die Pool-Bildung, die dieses Konzept braucht — sie wurde nur nie an den Motor
  angeschlossen.
- **Chris hat am 15.09. In-Match-Level-Ups gestrichen** („in Eslabong geht das nur, weil es EINE
  Disziplin ist — bei uns wären das 20 Kurven"). Der Commit `1d3df07a` hält ausdrücklich fest,
  dass die Idee „in anderer Form (z. B. statische Klassen/Skills statt dynamischer Progression)"
  wiederkommen kann. **Dieses Konzept ist diese andere Form.**
- **Der Engpass ist nicht Code, sondern Karten.** 33 von 35 Klassenkits fehlen. Der
  Abschrift-Vertrag (`class-kits.ts` Kopfkommentar, `BATTLE_ARENA_UEBERGABE.md` „Keine
  erfundenen Werte") verbietet, Skills zu erfinden. Ohne Karten gibt es nichts zu picken.
- **Kernvorschlag:** Vier Slots je Spieler (Dash fest, Signature fest, zwei frei). Ein
  gemeinsamer Pool, aus dem der Spieler nur die Skills sieht, die seine Archetypen kennen.
  Drei Angebote, gewichtet nach Rarität, mindestens zwei verschiedene Wirkungsarten, per Saat
  aus (Spieler, Saison, Spieltag) gezogen — kein Neuladen-Würfeln. Skills sind eine **eigene
  Wirkungsebene** (was ein Kämpfer *tut*), keine Zugabe auf Attribute oder Eignung. Jeder Skill
  im Pool muss in ein **Nutzwert-Band** passen, sonst entscheidet das Kit die Partie statt der
  Spieler — das ist bereits gemessen (Bogenkit 12,9 gegen Slash 7,3 Nutzwert je Sekunde, s.
  `engine.js:4184`).
- **Erster Schritt:** kein UI. Ein persistentes Kit je Spieler, deterministisch aus seinen
  Archetypen gezogen, durch den Adapter in den Motor gereicht — und dann **messen**, ob
  gemischte Kits die Rangtreue der drei Disziplinen drücken. Die Antwort auf diese Frage
  entscheidet, wie viel Gewicht der Pool überhaupt tragen darf.

---

## 1. IST-Zustand — was es gibt, was es nicht gibt

### 1.1 Am Spieler: Attribute ja, Skills nein

`lib/data/olyDataTypes.ts:955` (`Player`) führt: `attributeSheetStats` (zwölf Attribute),
`coreStats` (pow/spe/men/soc), `className` (13 Progressionsklassen aus
`lib/training/class-progression-config.ts:18` — Berserker, Warlord, Tank, Sprinter, Rogue,
Charger, Mage, Overseer, Templar, Bard, Hero, Badass, Tactician), `subclasses` (56 Werte im
Bestand), `traitsPositive`/`traitsNegative` (18 + 18 kanonische Traits), `disciplineRatings`,
`currentXP`/`spentXP`/`lifetimeXP`.

Es gibt **kein** Feld für Fähigkeiten. Die drei Dinge, die einem „Skill" heute am nächsten
kommen, sind alle etwas anderes:

| Was | Wo | Warum es kein Skill ist |
|---|---|---|
| Traits / Mutatoren | `lib/lineups/legacy-lineup-modifiers.ts` | Vom Import fest vergeben, nie wählbar. Wirkung: +6 Score / +0,3 PPs, wenn der Trait als Spieltags-Mutator gezogen wird. Chris: „das bleibt auch weiter so." |
| XP / organische Progression | `lib/progression/season-end-xp-apply-service.ts` | Saisonende, hebt Attribute; keine Fähigkeiten, keine Auswahl. |
| Slot-Rollen | `lib/lineups/matchday-slot-roles.ts:96` | Aufstellungs-Aufschlag auf Attribute (±8,5), je Spieltag neu; hängt am Slot, nicht am Spieler. |

Persistenz: jeder Spieler liegt als **ein JSON-Blob** in `players.payload_json`
(`lib/persistence/sqlite.ts:83`). Ein zusätzliches, optionales Feld am `Player`-Typ braucht
keine Schemaänderung und keine Migration — fehlt es, verhält sich alles wie heute. Das ist
dasselbe Muster wie `seasonTrainingAccumulator` oder `lastOrganicProgression`.

### 1.2 Im Motor: Skills gibt es, aber alle tragen dieselben

Der Kampfmotor kennt seit August ein generisches Skill-System:

- **Katalog** `SKILLS` (`engine.js:3962` ff.): elf Einträge in drei Platzhalter-Kits —
  `ARCHER2 = [shoot, dash, barrage]`, `MATRIARCH2 = [slash, slash_schwer, heavydash, shield]`,
  `FIGHTER2 = [fslash, fslash_schwer, mdash, ram]` (`engine.js:4148-4150`). Jeder Skill
  beschreibt sich über `wirkung[]` (Art: schaden / heilung / schild / betaeubung / rueckstoss /
  unverwundbar), `tor` (cd, castzeit, mp, sp, Bedingungen), `form` (Ziele), `eigenbewegung`.
- **Auswahl** `waehleSkill()` (`engine.js:19062`): je Takt der Skill mit dem höchsten
  Nutzwert unter den bereiten. **Ausführung** `fuehreAus()`/`wirkeAus()` (`engine.js:18979`)
  lesen dieselben Felder — kein Skill *tut* etwas anderes, als sein Nutzen versprochen hat.
- **Abklingzeiten** je Skill in `u.cds[id]`, Vorräte `u.mp`/`u.sp`, Nachfüllraten je Kit
  (`REGEN`, `engine.js:18302`).
- **Der Wächter:** `nutzwertStatisch(sk)` (`engine.js:4152`) rechnet den Nutzwert eines Skills
  über die feste Wechselkurstabelle `KURS` (`engine.js:4055`) **aus, bevor er gespielt wurde**.
  Getunt wird nur die Tabelle, nie ein einzelner Zauber.
- **Ohne Kit** schlägt eine Einheit mit `GRUNDSCHLAG` (Basis 12, 0,3 s — „kein Kit gleich
  durchschnittliches Kit", `engine.js:18377`).

Und dann der entscheidende Satz, `engine.js:4273`:

```js
const mitKit=(spieler)=>spieler.map(p=>({...p,skills:MATRIARCH}));
```

**Jeder Spieler aus dem echten Spielstand bekommt beim Einspeisen das Matriarch-Kit.**
`ArenaSpieler` (`lib/foundation/battle-arena/arena-kader-adapter.ts:20`) hat gar kein
`skills`-Feld; selbst wenn es eines hätte, würde `mitKit` es überschreiben. Der Grund steht
daneben (`engine.js:4174-4199`): mit ungleichen Kits misst jede Serie, *wer zufällig Skills
hat*, statt die Spieler — „das Bogenkit liegt bei 12,9 Nutzwert je Sekunde, Slash bei 7,3 —
wer als Einziger den Bogen trägt, entscheidet die Partie über sein Kit."

Das ist die wichtigste Zahl dieses Konzepts. Sie sagt: **ein Skill-Pool ohne Nutzwert-Parität
zerstört die Rangtreue.**

### 1.3 In `lib/battle/`: der Pool, der auf seinen Anschluss wartet

Drei Dateien, alle Abschriften von Chris' Eslabong-Klassenkarten, alle mit Tests, **von keiner
Produktionsdatei importiert** (nur `tests/battle-*.test.ts` und
`lib/player-generator/provisional-height.ts` greifen darauf zu):

| Datei | Inhalt | Für dieses Konzept |
|---|---|---|
| `lib/battle/class-kits.ts` | `SKILL_POOL` — 18 Skills mit `raritaet` (Common/Uncommon/Rare) und Kartenzahlen (dmg, heal, schild, range, cd, castzeit, mp, sp…). `CLASS_KITS` — Cleric und Priest, je Eintrag `zugang: guaranteed \| learnable`. Beide Klassen: **genau zwei garantierte Skills**, einer davon Medium Dash. Neun Skills geteilt. | Das ist bereits ein Pool mit Rarität und Zugangsregel. Die Struktur `Skill` ist generisch genug; die `sonst`-Tasche fängt Sonderfälle. |
| `lib/battle/archetype-registry.ts` | 35 Archetypen mit Rolle (DPS/TANK/HYBRID/CONTROLLER/SUPPORT/ASSASSIN), HP/ATK/DEF/SPD-Spannen, `kit: []` (leer, „sichtbar leer statt mit Platzhaltern gefüllt"). `SAISON_STUFEN_BEOBACHTUNG` (Level 21–25 je Saison, Max 100, enthält Cup-Bonus). | Die Rolle ist der natürliche Schlüssel für „welche Art Skills passt". |
| `lib/battle/subclass-archetypes.ts` | `ZUORDNUNGEN`: 56 Unterklassen → **mehrere** Archetypen je Unterklasse. `archetypenFuer(unterklassen, spieler)` liefert die Vereinigung; ein `BILDBEFUND` (Spielerbild aus der Dropbox) verengt sie für genau diesen Spieler. `poolBreite()` zählt die offenen Wege. | **Das ist die Pool-Bildung je Spieler, fertig gebaut.** Chris' eigene Regel im Kopfkommentar: „müsstest du denen erstmal alle 3 zuweisen — dann hätten die potentiell einen größeren skill pool." |

Zwei Welten also: der TS-Pool aus den Karten (18 Skills, Cleric/Priest) und der Motor-Katalog
(elf Skills, Archer/Matriarch/Fighter — „Struktur aus Eslabong übernommen, Zahlen bleiben
unsere", `engine.js:3959`). Sie überschneiden sich nicht einmal in den Kennungen
(`medium-dash` gegen `dash`/`mdash`/`heavydash`). Stufe 1 der Roadmap muss das
zusammenführen, sonst driften sie.

### 1.4 Was Chris bereits entschieden hat (und was das Konzept deshalb nicht neu aufmacht)

| Entscheidung | Quelle | Folge |
|---|---|---|
| **Keine In-Match-Level-Ups.** „Bei uns wären das 20 separate Kurven." `renderLevelUp()` bleibt Legacy. | Commit `1d3df07a` (15.09.), `engine.js:17888` | Skills dürfen **nicht** an eine Stufe je Disziplin hängen. Ein Kit ist eine Eigenschaft des Spielers, nicht einer Disziplin-Kurve. |
| **Marktwert wird nicht angefasst.** „nee, Marktwert fassen wir nicht an, die Berechnung bleibt!" | `BATTLE_ARENA_UEBERGABE.md` Punkt B | Skills dürfen keine Attribute verändern — sonst bewegt sich der Marktwert mit. |
| **Keine erfundenen Werte.** Jede Skill-Zahl steht auf einer Klassenkarte. | `BATTLE_ARENA_UEBERGABE.md` „Die eiserne Regel", `class-kits.ts` Kopf | Der Pool wächst nur mit Karten. Was ich unten an Gewichten setze (Rarität, Slots), ist als **gesetzt** markiert. |
| **Eslabong: Fighter starten mit EINER Fähigkeit** „so you can better customize them"; Ränge auf Level 10–20, +10 % je Rang bis 5. | Patch Notes, zitiert in `BATTLE_ARENA_UEBERGABE.md:67-71` | Startzustand: garantierte Skills + eine Wahl. Ränge sind eine spätere Stufe. |
| **Mutatoren bleiben +6 / +0,3.** | Punkt A | Traits bleiben eine getrennte Ebene; kein Skill wird aus einem Trait abgeleitet. |
| **Skills für Bewegungs-Disziplinen: vorerst nein.** Hindernis-Typisierung leistet das schon; falls doch, im selben Pool mit derselben `Skill`-Struktur. | `docs/ARENA_INTERAKTION_KONZEPT.md:335-352` | Der Pool gilt für das Kampf-Chassis. Punkt. |
| **Slot-Auswahl beim Levelaufstieg war Fables Erfindung.** Empfehlung dort: rein zufällig aus nicht ausgereizten; Gewichtung nach Klasse „drückt jeden Spieler still in seinen Archetyp". | Punkt C | Gilt sinngemäß für Skill-Angebote: der Pool ist durch die Archetypen begrenzt, aber **innerhalb** des Pools wird nicht nach Klasse gewichtet. |

### 1.5 Der Rahmen: wie oft ein Spieler überhaupt kämpft

Im Battle Mode hat eine Saison **20 Spieltage, jede Disziplin genau zweimal**
(`docs/design/battle-mode-20-spieltage-recherche-06-09.md`). Feldgrößen im Motor: TDM 6 je
Seite, Mini-DM 4 (als 4-Team-Pod, Kadergröße 1, `lib/season/mini-dm-pod-schedule.ts`),
Battlefield 4 (`arena-mini-dm-tdm-battlefield-rollout-plan.md` Fund 3).

Ein Spieler, der in allen drei Disziplinen gesetzt ist, kommt also auf **höchstens sechs
Kampfeinsätze je Saison** — ein reiner TDM-Spieler auf zwei. Das ist das Budget für Szenario 2:
**zwei bis sechs Angebote je Spieler und Saison**, nicht zwanzig. Ein Pool muss nicht groß
sein, damit sich Angebote nicht wiederholen; er muss vor allem *ungleich* genug sein, damit
jede Wahl eine ist.

Und die Ausgangslage, ehrlich: alle drei Disziplinen fallen bei der Rangtreue durch —
kaderfest rho je Spiel **TDM 0,253, Mini-DM 0,094, Battlefield 0,387**
(`docs/design/stand-aller-disziplinen.md:231-233`), keine davon steht in
`ARENA_RESOLVED_DISCIPLINE_IDS` (`lib/resolve/battle-mode-arena-team-points.ts:308`). Sie
werden heute also gar nicht über den Motor aufgelöst. **Ein Skill-Pool auf einem Motor, dessen
Grundlinie Rauschen ist, lässt sich nicht bewerten.** Das setzt die Reihenfolge der Roadmap.

---

## 2. Das Konzept

### 2.1 Fünf Grundsätze

1. **Ein Pool, viele Sichten.** Es gibt genau einen Skill-Pool (die Karten). Ein Spieler sieht
   daraus nur, was seine Archetypen kennen (`archetypenFuer`). Kein Skill existiert doppelt.
2. **Skills sind Form, nicht Menge.** Die Kette bleibt `Attribute → Eignung → Menge`
   (`aufEignung`) und `Rezepte → Form`. Ein Skill sagt, *was* ein Kämpfer tut und *wann*
   (Wirkungsart, Reichweite, Abklingzeit); *wie stark* er es tut, bleibt `basis × ANG/50`.
   Kein Skill hebt ein Attribut, keiner die Eignung. Damit bleiben Marktwert, Rangtreue-Maß und
   Slot-Aufschlag unberührt.
3. **Nutzwert-Parität ist eine Invariante, kein Wunsch.** Jeder Skill im Pool liegt mit seinem
   `nutzwertStatisch` je Sekunde in einem Band um den Grundschlag. Ein Test prüft das, wie
   heute die Tests in `tests/battle-class-kits.test.ts` die Kit-Regeln prüfen.
4. **Jedes Angebot ist eine echte Entscheidung.** Drei Karten, mindestens zwei verschiedene
   Wirkungsarten, nie ein Skill, den der Spieler schon hat. „Behalten" ist immer erlaubt.
5. **Gezogen wird mit Saat, nicht mit Zufall.** `hash(playerId, seasonId, matchdayId)` — dasselbe
   Prinzip, das `ziehe()` in `renderLevelUp` schon einsetzt (`engine.js:17831`): „Sonst könnte
   man durch Neuladen würfeln, bis die Wunschauswahl kommt — und die Entscheidung wäre keine."

### 2.2 Slots: vier je Spieler, zwei davon frei

| Slot | Inhalt | Wählbar | Ersetzbar | Quelle |
|---|---|---|---|---|
| **Dash** | Der Dash der Klasse (Medium Dash, Light Dash, Heavy Dash…) | nein | nein | Karte: jede Klasse hat genau einen garantierten Dash |
| **Signature** | Der eine Skill, „der die Klasse ausmacht" (Guided Hand beim Cleric, Magic Heal beim Priest) | nein | nein | Karte: der zweite garantierte Skill |
| **Frei 1** | Ein `learnable` aus dem Pool des Spielers | ja | ja | Szenario 1 füllt ihn |
| **Frei 2** | dito | ja | ja | Szenario 2 füllt ihn, später ersetzt er |

Warum vier: die Motor-Kits haben drei bis vier Einträge (`ARCHER2` 3, `MATRIARCH2` 4,
`FIGHTER2` 4), `waehleSkill` skaliert damit problemlos, und Eslabongs „start with only 1
ability" plus Dash ergibt genau die zwei festen Slots. Ein fünfter Slot ist eine spätere
Stufe, keine Startbedingung — jeder zusätzliche Slot vergrößert das Kit-Gewicht im Ergebnis,
und das ist exakt die Größe, die Abschnitt 3 erst messen will.

Warum Signature fest: die Karten sagen es so. Und spielerisch: ein Cleric, der seine Guided
Hand gegen drei Heilzauber tauscht, ist kein Cleric mehr — die Klasse muss lesbar bleiben,
sonst verliert das Spielerbild seinen Sinn.

### 2.3 Poolgröße

Was die Karten hergeben: Cleric 14 Einträge, Priest 14 und abgeschnitten. Bei 35 Archetypen
und starker Überschneidung (Cleric/Priest teilen neun) schätze ich den **vollständigen** Pool
auf **150–250 Skills**. Das ist der Endausbau, nicht der Start.

Was das Spiel braucht: ein Spieler bekommt zwei bis sechs Angebote je Saison (Abschnitt 1.5),
je drei Karten. Damit sich in einer Saison kein Angebot wiederholt, reicht ein Spielerpool von
**≥ 18 learnable Skills** (6 × 3). Ein Spieler sieht die Vereinigung über zwei bis fünf
Archetypen (`poolBreite`) — bei ~12 learnable je Archetyp und Überschneidung landet er bei
15–30. **Das trägt.**

Für den ersten Ausbau (Stufe 1–2) genügt deshalb: **sechs bis acht Kits, je Rolle mindestens
eines** — DPS (Bowman oder Fighter), TANK (Bullbreaker oder Fighter), HYBRID (Cleric, liegt
vor), CONTROLLER (Lancer oder Ice Mage), SUPPORT (Priest, liegt vor; Matriarch), ASSASSIN
(Rogue). Das ergibt geschätzt **40–60 Skills** im Pool und deckt über die `ZUORDNUNGEN` den
größten Teil des Bestands (Warrior 371×, Guardian, Knight, Healer…) ab. Spieler, deren
Archetypen noch keine Karte haben, tragen bis dahin den Platzhalter — sichtbar markiert,
wie heute.

### 2.4 Disziplinspezifisch oder generisch?

**Ein Kit je Spieler, gültig in allen Disziplinen des Kampf-Chassis** (TDM, Mini-DM,
Battlefield). Nicht je Disziplin, nicht für die anderen drei Chassis.

Begründung:

- Die drei Disziplinen laufen über **einen** Motor mit **einem** Skill-Katalog. Ein Skill, der
  in TDM funktioniert, funktioniert mechanisch identisch in Battlefield. Ein Kit je Disziplin
  wäre dreifache Buchführung für dieselbe Wirkung — und genau die „20 Kurven", die Chris beim
  Leveling verworfen hat.
- Die Slot-Rollen unterscheiden die Disziplinen bereits (`matchday-slot-roles.ts:96-120`:
  TDM Vanguard/Skirmisher/Shotcaller/Hold Line/Rally Point/Breaker, Mini-DM
  Frontliner/Finisher/Trick Fighter/Iron Guard/Chaos Driver/Last Hit, Battlefield
  Commander/Spotter/Siege Core/Morale Anchor/Field Control/Disruptor). Der Slot hebt Attribute
  je Disziplin; das Kit sagt, was der Spieler damit tut. Zwei Ebenen, die sich nicht
  überlagern.
- Bahn, Bühne, Feldspiel: **nein**, s. `ARENA_INTERAKTION_KONZEPT.md` — dort erledigt die
  Hindernis-Typisierung, was Beispiel-Skills sollten. Fechten läuft heute über das
  Bühnen-Duell-Chassis (`ARENA_RESOLVED_DISCIPLINE_IDS`), nicht über den Kampfmotor; es käme
  erst dazu, wenn es dorthin zurückkehrt.

### 2.5 Wie die drei Angebote entstehen

```
Kandidaten  = ∪ learnable(kit) über archetypenFuer(spieler.subclasses, spieler.name)
            − bereits getragene Skills
            − Signature-Skills (die sind nie learnable für andere)
Gewicht     = Rarität: Common 60 · Uncommon 30 · Rare 10        (GESETZT, keine Karte nennt es)
Bedingung   = die drei gezogenen Skills decken ≥ 2 verschiedene Wirkungsarten
              (schaden / heilung / schild / betaeubung / bewegung / rueckstoss)
Saat        = hash(playerId, seasonId, matchdayId, disciplineId)
Fallback    = < 3 Kandidaten: Angebot wird mit "Rang +1" auf einen getragenen Skill
              aufgefüllt (erst ab Stufe 4, vorher: weniger als drei Karten, ehrlich angezeigt)
```

Was **nicht** gewichtet wird: die Klasse innerhalb des Pools, der aktuelle Slot, die
Leistung im letzten Kampf. Der Pool ist schon durch die Archetypen begrenzt; eine zweite
Gewichtung nach Klasse „drückt jeden Spieler still in seinen Archetyp" (Punkt C der Übergabe)
und nimmt der Wahl ihren Sinn. Wer einen Tank zum Heiler machen will, soll es an seinem Pool
sehen, ob das geht — nicht an einer Gewichtung, die es leise verhindert.

Der `BILDBEFUND` verengt den Pool je Spieler, wo er vorliegt (Cassandra: Bowman, Hunter —
kein Crossbowman). Das ist bereits gebaut und fällt automatisch in die Kandidatenmenge.

### 2.6 Ersetzen — UI und Mechanik

Ein Bildschirm, zwei Zeilen:

- **Oben:** die vier Slots des Spielers. Dash und Signature ausgegraut mit Schloss, Frei 1 und
  Frei 2 anklickbar. Jede Karte zeigt Name, Rarität, Wirkungsart, und **den Nutzwert je Sekunde
  aus `nutzwertStatisch`** — nicht eine zweite, geschätzte Zahl. `engine.js:17877`: „Wer eine
  Zahl anzeigt, die der Kampf nicht führt, erklärt nichts — er lügt präzise."
- **Unten:** die drei Angebote, gleiche Kartenform, dazu „Behalten".

Ablauf: Karte unten wählen → ist ein freier Slot leer, geht sie dorthin (ein Klick). Sind
beide belegt, leuchten Frei 1 und Frei 2 auf; der zweite Klick sagt, welcher weicht. Die
Vorschau zeigt vorher/nachher als Summe des Kit-Nutzwerts. Kein Slot-System mit Typen (kein
„Slot 3 nur Heilung") — die Wirkungsart-Bedingung im Angebot sorgt schon für Vielfalt, ein
Typzwang am Slot würde die Wahl nur zurück in den Archetyp drücken.

Der ersetzte Skill ist **weg** — kein Lager, kein Rücktausch. Das ist die Roguelike-Härte, die
Chris meint; ein Lager macht aus der Entscheidung eine Sortierung.

### 2.7 Szenario 1 — die Wahl zu Kampagnenbeginn

Wann: beim Anlegen eines neuen Spiels (`lib/game/new-game-setup-service.ts`) für alle Spieler
des **menschlichen** Teams; für KI-Teams läuft derselbe Code mit Auto-Wahl (höchster Nutzwert
unter Einhaltung der Wirkungsart-Regel). **Kein zweiter Pfad** für die KI — dieselbe Regel wie
beim Kader-Auffüllen („keine zweite Kauflogik", CLAUDE.md).

Was passiert: Dash und Signature kommen von der Karte, Frei 1 wird aus drei Angeboten gewählt,
Frei 2 bleibt leer. Das entspricht Eslabong wörtlich („Fighters now start with only 1 ability
on LVL1, so you can better customize them") und hält den Start bewusst dünn — die zweite
Fähigkeit kommt aus dem Spiel, nicht aus dem Menü.

Neuzugänge (Transfer, Draft): **das Kit reist mit dem Spieler.** Es liegt in seinem
`payload_json`, nicht am Team. Kein Angebot beim Wechsel — sonst wäre Kaufen-Verkaufen-Kaufen
ein Reroll. Ein Spieler ohne Kit (Alt-Save, fehlende Karte) bekommt beim ersten Kampfeinsatz
sein Startangebot nachgereicht, nicht beim Kauf.

Bestehende Spielstände: **keine Migration.** Ein Spieler ohne `kampfKit` trägt den Platzhalter,
wie heute. Das Startangebot erscheint, sobald er das erste Mal in einer Kampfdisziplin
aufgestellt wird.

### 2.8 Szenario 2 — das Angebot nach dem Kampf

Wann: nach der Auflösung eines Spieltags mit TDM / Mini-DM / Battlefield. Der Anker ist
`lib/season/arena-matchday-resolve-service.ts` — dort ist nach dem Lauf bekannt, wer teilgenommen
hat (der Boxscore hängt je Spieler an `Player.id`, s. `arena-kader-adapter.ts:23` und
`docs/design/boxscore-an-pps.md`).

Wer: **alle Teilnehmer** des menschlichen Teams, unabhängig von der Leistung. In Eslabong
bringt jeder Kampf XP für alle; eine Leistungsschwelle („nur ab 100 % Leistung") würde die
Starken schneller ausbauen und die Rangfolge festbetonieren — das Gegenteil von „schwächere
Spieler holen auf" (Punkt B). Wenn Chris die Schwelle will, ist sie ein Schalter, kein Umbau.

Wie viel: **TDM = sechs Spieler × drei Karten** nach einem Spieltag. Das ist die UX-Klippe des
ganzen Konzepts. Drei Sicherungen:

1. **Ein Bildschirm „Nach dem Kampf"**, eine Zeile je Teilnehmer, nicht sechs Popups.
2. **„Vorschlag übernehmen"** je Zeile und für alle: die KI-Wahl (dieselbe wie für KI-Teams)
   steht vorausgefüllt da; wer nicht entscheiden will, klickt einmal.
3. **Kein harter Blocker.** Offene Angebote erscheinen als Inbox-Eintrag (`GameInboxItem`,
   Kategorie neu: `player_skill_offer`, Quick-Action „Vorschlag übernehmen" — das Muster
   existiert in `lib/foundation/inbox-quick-action-service.ts`) und als **weiche** Warnung im
   Spielfluss, wie heute `player_development_pending`
   (`lib/foundation/flow-blocker-routing.ts:79`). Beim nächsten Resolve werden unentschiedene
   Angebote mit dem Vorschlag aufgelöst — ein Angebot verfällt nie ungenutzt, es wird nur
   irgendwann von der KI angenommen.

KI-Teams: Auto-Wahl sofort im Resolve, ohne Inbox.

### 2.9 Datenform (Entwurf, additiv, optional)

```ts
// an Player, optional — fehlt es, gilt der Platzhalter wie heute
kampfKit?: {
  version: 1;
  slots: {
    dash: string | null;        // Skill-ID, von der Karte
    signature: string | null;   // Skill-ID, von der Karte
    frei: [string | null, string | null];
  };
  raenge?: Record<string, number>;         // erst Stufe 4
  offen?: {                                // ein unentschiedenes Angebot, höchstens eines
    angebot: string[];                     // drei Skill-IDs
    vorschlag: string;                     // die KI-Wahl
    quelle: { seasonId: string; matchdayId: string; disciplineId: string } | { seasonId: string; anlass: "start" };
    saat: number;
  } | null;
  historie: Array<{ seasonId: string; matchdayId: string | null; gewaehlt: string | "behalten"; ersetzt: string | null }>;
} | null;
```

Höchstens **ein** offenes Angebot je Spieler: ein zweiter Kampf, bevor das erste entschieden
ist, löst das erste mit dem Vorschlag auf und ersetzt es. Sonst stapeln sich Karten, und
Stapel sind keine Entscheidungen.

Brücke zum Motor: `ArenaSpieler.skills?: string[]` als Passthrough;
`mitKit` (`engine.js:4273`) nimmt `p.skills`, wenn vorhanden, sonst `MATRIARCH`. Zwei Zeilen
im Motor, eine im Adapter.

---

## 3. Verträglichkeit mit Eignung und Attributen

### 3.1 Additiv oder eigene Ebene? — Eigene Ebene, und der Motor ist schon so gebaut

Heute rechnet der Motor: Schaden = `sk.basis × angFaktor(u.ANG) × mult` (`engine.js:18365`),
Heilung analog über `e.basis × angFaktor`. Der Skill liefert `basis`, `cd`, `range`,
`wirkung`; das Attribut liefert den Faktor. **Das ist bereits eine zweite Ebene**, sie heißt
nur nicht so. Ein Skill-Pool ändert daran nichts — er ändert nur, *welcher* Skill die Basis
liefert.

Additiv (Skill hebt Attribut oder Eignung) wäre falsch, aus drei Gründen:

1. **Marktwert** hängt an den Attributen (Chris: nicht anfassen). Ein Skill, der +5 Power gibt,
   macht den Spieler teurer — und die Wahl zu einer Marktwert-Manipulation.
2. **Rangtreue** misst „Eignung sagt Rang voraus". Hebt ein Skill die Eignung, misst man
   danach den Skill mit, und die Zahl sagt nichts mehr über den Motor.
3. **„Keine zweite Währung neben der ersten"** — der Aufschlag hebt die Attribute, nie direkt
   die Kampfwerte (`BATTLE_ARENA_UEBERGABE.md` Abschnitt 2). Ein additiver Skill wäre genau
   diese zweite Währung.

Also: **Skills verändern die Form der Kampfkraft, nie ihre Menge.** Was sie verändern dürfen:
Reichweite (Fern gegen Nah), Rhythmus (kurze Abklingzeit gegen schwerer Schlag), Ziel (Einzel
gegen Fläche), Rolle (Schaden gegen Heilung gegen Schild), Bewegung (Dash-Länge, Unverwundbar-
Fenster). Genau die Felder, die `wirkung`/`tor`/`form`/`eigenbewegung` heute schon tragen.

### 3.2 Das Nutzwert-Band — die Invariante

Das gemessene Problem (`engine.js:4184`): Shoot 12,9 gegen Slash 7,3 Nutzwert je Sekunde —
Faktor 1,77. Wer den Bogen trägt, gewinnt.

Vorschlag: `nutzwertStatisch(sk) / zeit` jedes learnable Skills liegt in einem Band um den
Grundschlag (`GRUNDSCHLAG` Basis 12 / 0,3 s als Referenz):

| Rarität | Band (je Sekunde, relativ zum Grundschlag) | Was Rare dann bedeutet |
|---|---|---|
| Common | 0,85 – 1,15 | — |
| Uncommon | 0,85 – 1,20 | mehr Situationsnutzen (Fläche, Betäubung), gleicher Durchschnitt |
| Rare | 0,90 – 1,30 | ein Spitzenwert, gekauft mit langer Abklingzeit oder Kosten |

Die Zahlen sind **gesetzt** und der erste Kandidat für eine Messung — aber die Größenordnung
hat einen Anker: die Formkarte (`FORMWERTE = [0, 2, 4, 8]`) bewegt die Eignung um höchstens 8
Punkte je Kampf. Ein Kit, das im Durchschnitt 15 % über dem Grundschlag liegt, entspricht
grob einer guten Formkarte. **Ein gutes Kit darf so viel wert sein wie eine gute Formkarte,
nicht mehr** — das ist die Zeile, die Chris bestätigen oder verschieben muss (Frage 2 unten).

Ein Test in `tests/` prüft das Band für jeden Skill im Pool, so wie die bestehenden Tests die
Kit-Regeln prüfen. Ein Skill außerhalb des Bands ist ein Befund an der Karte (oder an
`KURS`), kein Balance-Handgriff am Skill.

### 3.3 Die Abnahme: gemischte Kits dürfen die Rangtreue nicht drücken

Die Messung, die vor jedem UI kommt (Stufe 1):

```sh
node scripts/miss-alle-disziplinen.mjs 24 tdm mini-dm battlefield
```

einmal mit einheitlichem Platzhalter (heute), einmal mit je Spieler deterministisch gezogenem
Kit. Abnahme: **rho je Spiel sinkt um höchstens 0,02.** Sinkt es stärker, entscheidet das Kit
mit, und dann ist entweder das Band zu weit oder ein Skill bricht es.

Ehrlicher Vorbehalt: bei rho 0,25 / 0,09 / 0,39 ist ein Unterschied von 0,02 im Rauschen.
**Die Messung ist erst aussagekräftig, wenn die drei Disziplinen über 0,80 stehen** — oder
wenigstens ihre Saison-Validität stabil ist. Das ist der Grund, warum der Skill-Pool hinter der
Arena-Kalibrierung steht und nicht davor. Bauen kann man Stufe 1 vorher; **bewerten** nicht.

### 3.4 Was sich sonst nicht berührt

| Ebene | Berührung | Warum nicht |
|---|---|---|
| Slot-Aufschlag (±8,5 auf Attribute) | keine | hebt Attribute je Spieltag; Kit ist Spieler-Eigenschaft |
| Traits / Mutatoren (+6 / +0,3) | keine | fest vergeben, Chris' Entscheidung; ein Skill ist nie aus einem Trait abgeleitet |
| XP / Saisonende-Progression | keine | Skills kosten kein XP. Chris hat XP-gebundene Level verworfen. Ränge (Stufe 4) hängen an Kampfeinsätzen, nicht an XP |
| Formkarten | keine, aber der Maßstab | s. 3.2: ein Kit ≈ höchstens eine gute Formkarte |
| Potential / Scouting | keine | Potential deckelt Attribute; Skills sind keine Attribute |
| Marktwert / Gehalt | keine | Chris: nicht anfassen |

---

## 4. Roadmap in Stufen — nichts davon wird jetzt gebaut

### Stufe 0 — Karten (Voraussetzung, kein Code)

Sechs bis acht Klassenkarten von Chris, je Rolle mindestens eine (Vorschlag: Bowman, Fighter,
Bullbreaker, Lancer, Matriarch, Rogue; Cleric und Priest liegen vor). Abschrift nach
`class-kits.ts` nach dem bestehenden Vertrag: jede Zahl von der Karte, Abweichungen bei
geteilten Skills sind Befunde. Priest-Karte vervollständigen (`unvollstaendig: true`).

Parallel und unabhängig: die Arena-Kalibrierung, die ohnehin ansteht
(`arena-mini-dm-tdm-battlefield-rollout-plan.md`). Ohne sie ist Stufe 1 nicht bewertbar.

### Stufe 1 — Kit-Ledger und Messung (der minimale erste Schritt, kein UI)

- Ein Skill-Katalog als **eine** Quelle für `class-kits.ts` **und** den Motor (heute zwei
  Welten mit fremden Kennungen). Wahrscheinlich eine JSON-Datei, die `class-kits.ts` importiert
  und der Motor beim Laden liest — wie er `window.__olyArenaKader` liest.
- `Player.kampfKit` als optionales Feld; `ArenaSpieler.skills` als Passthrough; `mitKit` liest
  es, fällt sonst auf `MATRIARCH` zurück.
- Ein Skript, das jedem Spieler **deterministisch** (Saat aus Spieler-ID) Dash + Signature +
  ein learnable aus seinen Archetypen zieht — ohne Wahl, ohne UI.
- Der Nutzwert-Band-Test.
- **Die Messung aus 3.3**, vorher/nachher. Ergebnis ist ein Dokument, keine Produktivschaltung.

Warum das zuerst: Es beantwortet die einzige Frage, an der das ganze Konzept hängt — *wie viel
darf ein Kit wiegen, ohne die Rangtreue zu kippen?* — mit der kleinsten möglichen Änderung
(zwei Zeilen Motor, eine Zeile Adapter, ein Feld am Typ, ein Skript). Alles Weitere baut auf der
Antwort.

### Stufe 2 — Szenario 1: die Startwahl

Angebot von drei Karten für Frei 1 beim neuen Spiel (menschliches Team), Auto-Wahl für KI,
Nachreichen beim ersten Einsatz für Alt-Saves. Inbox-Eintrag und weiche Warnung. Der
Kartenbildschirm aus 2.6 in seiner einfachsten Form (ein leerer Slot, drei Karten, kein
Ersetzen).

### Stufe 3 — Szenario 2: das Angebot nach dem Kampf

Hook im Arena-Resolve, Angebot je Teilnehmer, der Bildschirm „Nach dem Kampf" mit
Vorschlag-Übernahme, Ersetzen für Frei 1/2, Auto-Auflösung beim nächsten Resolve. Erst hier
wird der Pool in der Saison sichtbar; erst hier braucht es die Wirkungsart-Regel voll.

### Stufe 4 — Tiefe

Ränge (+10 % je Rang bis 5, Eslabong), Rare-Gewichte nachmessen, weitere Karten, Bildbefunde
für die restlichen ~570 Spieler (verengen die Pools), ggf. fünfter Slot — **nur**, wenn die
Messung aus Stufe 1 Spielraum zeigt. Fechten, falls es ins Kampf-Chassis zurückkehrt.

### Nicht-Ziele (bewusst)

Keine XP-Kopplung. Keine Skills für Bahn, Bühne, Feldspiel. Kein Einfluss auf Marktwert oder
Attribute. Kein In-Match-Leveln. Kein Skill-Lager. Keine Angebote beim Transfer.

---

## 5. Fragen an Chris (in der Reihenfolge, in der sie die Roadmap blockieren)

1. **Karten:** Welche sechs bis acht Kits zuerst? Mein Vorschlag steht in Stufe 0; entscheidend
   ist, dass jede der sechs Rollen eine hat.
2. **Gewicht:** Darf ein gutes Kit so viel wert sein wie eine gute Formkarte (~8
   Eignungspunkte) — oder mehr? Das setzt das Nutzwert-Band (3.2) und damit, ob Skills „Stil"
   oder „Macht" sind.
3. **Nach dem Kampf:** Angebot für alle Teilnehmer, oder erst ab einer Leistung? (Vorschlag:
   alle.)
4. **Feste Slots:** Dash und Signature unantastbar, nur zwei freie Slots? (Vorschlag: ja.)
5. **Pflicht oder Vorschlag:** Darf ein offenes Angebot beim nächsten Resolve automatisch mit
   der KI-Wahl aufgelöst werden — oder soll es blocken? (Vorschlag: auflösen, nie blocken.)
6. **Rarität:** 60/30/10 als Ziehgewicht — gibt es dazu etwas aus Eslabong, oder setzen wir es?
7. **Transfer:** Kit reist mit dem Spieler, kein neues Angebot beim Wechsel? (Vorschlag: ja.)

---

## Fundstellen (alle gegen `91b17c3a` geprüft)

| Was | Wo |
|---|---|
| Spieler-Datenmodell, kein Skill-Feld | `lib/data/olyDataTypes.ts:955` |
| Spieler-Persistenz als JSON-Blob | `lib/persistence/sqlite.ts:83` |
| Skill-Pool aus Karten (18 Skills, Cleric/Priest) | `lib/battle/class-kits.ts` |
| 35 Archetypen, `kit: []` leer | `lib/battle/archetype-registry.ts` |
| Unterklasse → Archetypen, `archetypenFuer`, `BILDBEFUNDE` | `lib/battle/subclass-archetypes.ts:1005` |
| Motor-Skill-Katalog, Platzhalter-Kits | `public/mockups/battle-mode.engine.js:3962, 4148` |
| `KURS` und `nutzwertStatisch` (der Wächter) | `public/mockups/battle-mode.engine.js:4055, 4152` |
| Kit-Ungleichgewicht gemessen (12,9 gegen 7,3) | `public/mockups/battle-mode.engine.js:4174-4199` |
| `mitKit` — alle echten Spieler bekommen `MATRIARCH` | `public/mockups/battle-mode.engine.js:4273` |
| Einheit wird gebaut, `skills:kitVon(p.skills)` | `public/mockups/battle-mode.engine.js:18084` |
| `waehleSkill` / `fuehreAus` / `wirkeAus` | `public/mockups/battle-mode.engine.js:19062, 18979, 19011` |
| Level-Up-Vorschau (Legacy, deaktiviert 15.09.) mit gesäter Ziehung | `public/mockups/battle-mode.engine.js:17816, 17888` |
| Brücke App → Motor, kein `skills`-Feld | `lib/foundation/battle-arena/arena-kader-adapter.ts:20` |
| Arena-Resolve, Teilnehmer bekannt | `lib/season/arena-matchday-resolve-service.ts:268` |
| Welche Disziplinen über den Motor laufen (TDM/Mini-DM/Battlefield nicht) | `lib/resolve/battle-mode-arena-team-points.ts:308` |
| Slot-Rollen der drei Kampfdisziplinen | `lib/lineups/matchday-slot-roles.ts:96-120` |
| Inbox-Quick-Actions (Muster für „Vorschlag übernehmen") | `lib/foundation/inbox-quick-action-service.ts` |
| Weiche Blocker (Muster `player_development_pending`) | `lib/foundation/flow-blocker-routing.ts:79` |
| Rangtreue-Stand der drei Disziplinen | `docs/design/stand-aller-disziplinen.md:231-233` |
| Eslabong-Belege, offene Punkte B/C/D | `docs/BATTLE_ARENA_UEBERGABE.md:57-110, 436-495` |
| Skills für Bewegungs-Disziplinen: nein | `docs/ARENA_INTERAKTION_KONZEPT.md:335-352` |
| 20 Spieltage, jede Disziplin zweimal | `docs/design/battle-mode-20-spieltage-recherche-06-09.md` |
| Level-Up-Streichung, „andere Form" ausdrücklich offen | Commit `1d3df07a` |
