# Showcase als Talentshow — Konzept (Fable, 17.09.)

Chris: „das ist ja so ne Talentshow wie America's Got Talent oder so, und man kann verschiedene
Dinge zeigen. Vielleicht brauchen wir da die Bühne und Charakter mit ihren Skills etc. aus den
Kämpfen."

Dieses Dokument ist reine Recherche und Konzept — kein Produktionscode. Es beantwortet vier
Fragen: (1) was Showcase heute ist, (2) was „Skills aus den Kämpfen" im Code tatsächlich sind,
(3) wie echte Act-Vielfalt aussehen kann, ohne die Rangtreue anzufassen, und (4) was dafür
gebaut werden muss, in welcher Reihenfolge und mit welchem Aufwand.

## Kurzfassung

- **Showcase ist heute der Bühnen-Durchgangsrechner mit anderen Zahlen.** Sieben-Rollen-Rezept
  mit Charisma-Gewichten, kein Flag, kein eigener Zweig, kein Ton, keine Requisite, kein
  Konzeptdokument (Scorecard 45 %, Konzept 25 / Assets 40 / Gameplay 95 / Movement 20). Die
  einzige „Bewegung" ist ein waffenloser `slash`-Frame — ein Faustschlag in die Luft — bei jeder
  Enthüllung, weil `DISZIPLIN_WAFFE.showcase` `null` ist und der generische Zweig `u.lunge=0.5`
  setzt. Zwölf Figuren in zwei Reihen, alle tun dasselbe.
- **rho ist gut und soll es bleiben.** Frisch gemessen 17.09.: rho je Spiel **0,892**
  (Spannweite 0,158), Saison 0,937 — drittbeste Zahl im Feld, bestanden. Das Rezept wird
  **nicht angefasst**. Die Empfehlung ist eindeutig: Act-Vielfalt **rein präsentatorisch**, nach
  dem Muster der acht Bühnen-Zweige, die genau so gebaut wurden (Heben, Schach, Cypher, Kür,
  Tennis, Fechten): eigenes Flag, eigener `zeichneShowcase()`/`stepShowcase()`-Zweig, nur
  `viz*`-Felder, kein `rr()`, bit-identische Messung als Abnahmekriterium.
- **„Skills aus den Kämpfen" gibt es pro Charakter NICHT als Daten.** `mitKit()` (`:4273`) gibt
  jedem eingespeisten Spieler denselben MATRIARCH-Satz; `Player` hat kein Skill-Feld; die
  Klassenkits in `lib/battle/` importiert außer Tests niemand. Was pro Charakter **wirklich**
  unterschiedlich ist und bereits im Motor liegt: der BAU-Bauplan (Waffe, Element-Effekt,
  Vollbild-Kreatur, Flügel, Schild), Klasse, Rasse, Unterklassen, Traits, zwölf Attribute. Daraus
  lässt sich ein **Act deterministisch ableiten — ohne ein einziges neues Persistenz-Feld**, nach
  demselben Punktesystem, mit dem `leitePers()` (`:16744`) heute schon Persönlichkeiten ableitet.
- **Sechs Acts**: Kampfkunst, Schützenkunst, Zaubershow, Gesang/Rede, Kraftakt, Akrobatik. Jeder
  Act ist ein eigenes Zeichenrezept über die vorhandenen Sprite-Ebenen (Waffen-Overlays,
  `zeichnePartikelEffekt`, Flügel, Vollbild), plus je eine kleine gezeichnete Requisite im
  `DISZIPLIN_PROP`-Muster und eigene Ton-Ereignisse im `TON_KATALOG`-Muster.
- **Aufwand: vier PRs, zusammen etwa 4–5 Arbeitstage**, jede einzeln rho-neutral nachweisbar.
  Erwartete Scorecard-Bewegung: 45 % → rund 80 % (Konzept 25→70, Assets 40→85, Movement 20→75,
  Gameplay bleibt 95).

---

## 1. Ist-Zustand, nachgelesen

### 1.1 Rezept und Ablauf

`BUEHNE_ART.showcase` (`public/mockups/battle-mode.engine.js:12361-12375`):

```js
showcase:{
  // MATRIX: charisma 27, spirit 16, determination 14, power 11, intelligence 10,
  // dexterity 9, speed 8, health 3, torment 2.
  label:"Showcase", jeSeite:6, rundenN:5, rundenDauer:1.0,
  failAbzug:0.55, failWort:"verpatzt", erfolgWort:"reisst das Publikum mit",
  rezept:{
    GRUNDLAGE:    {charisma:55,spirit:30,determination:15},
    SPITZENMOMENT:{charisma:45,power:30,speed:25},
    TECHNIK:      {dexterity:40,intelligence:35,determination:25},
    PUBLIKUM:     {charisma:50,spirit:50},
    NERVEN:       {determination:40,spirit:35,intelligence:25},
    AUSDAUER:     {spirit:40,determination:35,health:25},
    WAGNIS:       {torment:45,power:30,speed:25}
  }
},
```

Kein Flag (`heben`/`duell`/`duett`/`cypher`/`schach`/`tennis`/`fechten` — alle acht Geschwister
haben eines, Showcase, Wettessen und I-Spy nicht). Die Punkte je Durchgang entstehen im
generischen `setz()`-Zweig von `bauBuehne()` (`:12849-12863`): `basis=(20+GRUNDLAGE*0,7)*ermued`,
Erfolgschance `0,15+TECHNIK*0,0055+NERVEN*0,0035` (Deckel 0,94), bei Erfolg
`+SPITZENMOMENT*0,35*(0,4+WAGNIS*0,006)`, bei Fehlschlag `basis*0,55`, immer `+PUBLIKUM*0,12`.
**Alle fünf Durchgänge werden vorab durchgerechnet** und dann über `buehneQueue` enthüllt —
rundenweise, Seiten abwechselnd (`:13011-13020`). 12 Teilnehmer × 5 Durchgänge × 1,0 s = 60 s.

Slots (`:4672-4679`): Stage Lead, Crowd Hook, Style Tech, Control Beat, Big Moment, Finale.
Die Namen sind Talentshow-Vokabular — bis hierher ist die Identität da; im Bild kommt sie nicht an.

### 1.2 Was der Zuschauer heute sieht

`zeichneBuehne()` (`:14854-14964`) dispatcht auf sieben eigene Zweige und lässt I-Spy, Showcase
und Wettessen in den generischen Rest fallen: zwei Reihen (Heim `H*0,32`, Gast `H*0,66`), je
Figur Name, „X Pkt", Punktesäule, Fortschritt „n/5". Boden: `bodenBuehne()` (`:14667`), ein
violettes Podest mit drei Scheinwerferkegeln, geteilt mit Schach/Tennis/Fechten/Wettessen/I-Spy.

Die Bewegung bei jeder Enthüllung: `stepBuehne()` setzt `u.lunge=0.5` (`:13554`), `zeichneSprite()`
macht daraus `ani="slash"` (`:3546`, weil `waffeEffektiv` durch `DISZIPLIN_WAFFE.showcase=null`
weder Bogen noch Feuerwaffe ist) — und weil die Waffenebene gesperrt ist, bleibt vom Schwerthieb
nur die Körperpose übrig. **Ein Sänger, ein Magier, ein Koloss: alle schlagen einmal mit der
Faust in die Luft.** Genau das ist die Lücke, die Chris meint.

`buehnenBewegung()` (`:13664-13675`) kennt keinen Showcase-Zweig. `DISZIPLIN_PROP` (`:2858-2880`,
zehn Einträge) hat keinen. `TON_KATALOG` (`:20591-20686`, elf Disziplinen) hat keinen;
`sfx("showcase",…)` steht nirgends.

### 1.3 Die React-Seite

`app/foundation/discipline-stage/arena/disciplines/showcase.tsx` (623 Zeilen) ist die
Ranglisten-Ansicht des Spieltags: eine Theaterbühne mit Treppe zum Podium, roter Vorhang,
LED-„Hype-Wall" mit dB-Skala (60–120), Jury-Buzzer, Rampenlicht — Team-Token wandern nach Score.
Das ist eine andere Präsentationsebene (Token, nicht Figuren) und wird hier nicht angefasst; ihre
Motive (Vorhang, Buzzer, Rampenlicht, Hype-Wall) sind aber die richtige Vorlage für
`bodenShowcase()` im Motor, damit beide Ansichten dieselbe Disziplin zeigen.

### 1.4 Messung 17.09.

```
node scripts/miss-alle-disziplinen.mjs 24 showcase
showcase   buehne   12   rho je Spiel 0.892   Spannweite 0.158   rho Saison 0.937   Spannweite 0.077   bestanden
```

Identisch mit der Basislinie vom 16.09. Die Spannweite 0,158 ist die Größe, gegen die jede
Rezeptänderung gemessen würde: was kleiner bewegt, ist von Null nicht unterscheidbar
(`docs/design/messgrundlage-kaderfest.md`). Das ist ein zweites Argument, das Rezept ruhen zu
lassen — eine Verbesserung müsste über 0,16 hinaus, um überhaupt sichtbar zu sein, und nach oben
ist bei 0,892 kaum noch Platz.

---

## 2. Was „Charakter mit ihren Skills aus den Kämpfen" im Code wirklich ist

Chris' Bild ist richtig — die Arena zeigt Charaktere, die sichtbar Verschiedenes tun. Aber der
Unterschied kommt **nicht** aus Skills. Drei Ebenen, sauber getrennt:

### 2.1 Skills: vorhanden, aber uniform

- Der Motor kennt elf Skills in `SKILLS`/`SCHEMA` (`:3962-4150`): `shoot`/`dash`/`barrage`
  (Archer-Satz), `slash`/`slash_schwer`/`heavydash`/`shield` (Matriarch-Satz),
  `fslash`/`fslash_schwer`/`mdash`/`ram` (Fighter-Satz). Die Struktur ist bewusst so gebaut, dass
  „Chris' echte Kits später EINGETRAGEN statt programmiert" werden.
- **Aber: `mitKit()` (`:4273`) gibt jedem eingespeisten Spieler `skills:MATRIARCH`**, und die
  beiden Demokader tragen ebenfalls durchgehend `skills:MATRIARCH`. Der Kommentar dort: „solange
  die echten Klassensätze fehlen, tragen alle denselben Satz". Ein Archer-Kit wurde gemessen und
  verworfen (`:4177-4182`: `fern:true` mit ARCHER → V-W verliert 24 von 24).
- Die einzigen skill-artigen Unterschiede je Spieler: `p.fern===true` (Fernkämpfer, im Demokader
  nur Cassandra) und `istHeiler(p)` (`:4504`, Unterklassen Cleric/Healer/Shaman/Druid → heilt
  nach der Priest-Karte „Magic Heal" statt Schaden zu machen).
- `lib/battle/archetype-registry.ts` (35 Archetypen mit Rolle und Signature-Beschreibung),
  `lib/battle/class-kits.ts` (Skill-Pool mit 20 Skills, bislang nur Cleric-/Priest-Kit) und
  `lib/battle/subclass-archetypes.ts` (56 Unterklassen → Archetypen, über 60 Bildbefunde,
  `archetypenFuer(unterklassen, spieler)`) sind **abgeschriebene Kartendaten** — importiert von
  drei Tests und `provisional-height.ts`, **nicht** vom Motor und **nicht** vom Kader-Adapter.
- `Player` (`lib/data/olyDataTypes.ts:985-1030`) trägt `className`, `race`, `subclasses`,
  `traitsPositive/Negative`, `attributeSheetStats`, `disciplineRatings` — **kein Skill-Feld**.
  Der Adapter (`lib/foundation/battle-arena/arena-kader-adapter.ts`) reicht genau
  `{n,id,c,r,sub,tp,tn,d,groesse,a}` durch.

**Folgerung:** eine Act-Zuweisung, die auf „dem Skill des Charakters" beruht, hätte heute für
alle zwölf Teilnehmer dasselbe Ergebnis. Was Chris meint, ist das, was er in der Arena SIEHT —
und das kommt aus der nächsten Ebene.

### 2.2 Baupläne: was einen Charakter im Bild unterscheidet

`BAU` (`:1165-2054`, 146 Einträge, Rückfall `BAU_STD` = human/light/leder) ist die eigentliche
Quelle der sichtbaren Vielfalt. Nachgezählt:

| Ebene | Werte im Katalog | Zeichenpfad |
|---|---|---|
| Waffe | schwert 35, stab 14, bogen 4, axt 3, pistole 1 (dazu zweihänder/schrotflinte/sturmgewehr als Ebenen) | Waffen-Overlays nur während `slash`/`shoot` (`:3698-3701`, `:3814-3826`) |
| Element-Effekt | frost 6, feuer 5, voidRot 4, arkan 4, void 3, heilig 3, gift 2, pilz 1 | `zeichnePartikelEffekt()` (`:3050`), acht Bewegungsmuster |
| Vollbild-Kreatur | golem 11, mech_gross 3, taube/schiff_pirat/krokodil je 2, werwolf, treant, spinne, singvogel, roboter, mech_transformer, kraken, geist, froschmensch, drache_hydra, drache_gold | eigener Zweig, eigene Blätter |
| Sonstiges | schild, fluegel (federn/fledermaus/z_fluegel), energiekern, gluehenderRiss, leuchtenderBauch, hoerner, krone, kapuze, schwanz | je eigene Ebene |

Die vier Animationsblätter (`ANIBILDER`, `:2269`): walk 9, slash 6, shoot 13, hurt 6 Bilder.
`shoot` ist die einzige Überkopf-Pose und dient im Feldspiel schon als „Wurf" — für Showcase ist
sie die natürliche „Zauber-/Präsentier"-Pose.

### 2.3 Herleitung aus Klasse/Rasse/Unterklasse/Traits: das Muster gibt es schon

`leitePers()` (`:16763-16775`) leitet für jeden Kämpfer eine von sechs Persönlichkeiten ab —
Punkte je Quelle aus der Tabelle `PW` (Klasse, Rasse, Unterklasse, Trait+, Trait−), höchste Summe
gewinnt, Begründung im Tooltip. Alles aus Feldern, die der Adapter ohnehin liefert. **Genau dieses
Muster trägt die Act-Zuweisung**, mit dem BAU-Bauplan als zusätzlicher, stärkster Quelle.

---

## 3. Das Konzept: sechs Acts

### 3.1 Die Acts

| Act | Wer (Quellen) | Was auf der Bühne passiert | Requisite | Vorhandene Bausteine |
|---|---|---|---|---|
| **KAMPFKUNST** (Waffenkür) | BAU-Waffe schwert/axt/zweihänder/stab · Klassen Warlord/Berserker/Tank/Hero/Badass/Templar · Sub Warrior/Knight/Viking/Swashbuckler/Ninja/Monk/Executioner · `schild:true` | Ausholen – Hieb – Schlusspose; bei Schild ein Schildschlag am Ende. Funken am Klingenweg. | keine neue, die eigene Waffe wird freigegeben | `slash`-Blatt + Waffen-Overlay (heute gesperrt), `schild_fg` |
| **SCHÜTZENKUNST** (Trickschuss) | BAU-Waffe bogen/pistole/schrotflinte/sturmgewehr · `fern:true` · Sub Hunter/Scout/Spec Ops/Amazoness/Agent/Engineer | `shoot`-Pose, ein Geschoss fliegt zu einer Zielscheibe am Bühnenrand; bei „verpatzt" trifft es den Rand. Mündungsfeuer bei Feuerwaffe. | **Zielscheibe** (Primitive, 3 Ringe, gezeichnet wie `FOLTER_GERAETE`) | `bogen_shoot`, `muendungsfeuer_walk`, Ball-Flug-Muster aus `zeichneTennis()` (`u.lunge` als Uhr) |
| **ZAUBERSHOW** | BAU-Effekt arkan/frost/feuer/void/voidRot/gift · Waffe stab · Klassen Mage/Overseer/Tactician · Sub Mage/Warlock/Alchemist/Apparition/Succubus/Wraith/Druid/Shaman · `istHeiler()` | `shoot`-Pose (Überkopf), Partikel-Ausbruch in der Farbe des eigenen Elements — Heiler in Gold (`heilig`), Effektlose in `arkan`. Bei „verpatzt" ein kurzer Fehlzünder (Alpha bricht ab). | keine | `zeichnePartikelEffekt()` mit größerer Streuung während `lunge` (per `u.vizEffekt`, s. 4.3) |
| **GESANG / REDE** | Klasse Bard/Hero · Sub Royalty/Ambassador/Servant · Traits Eloquent/FanFavorite · Charisma-dominant (charisma ≥ power und ≥ intelligence) | `walk`-Blatt ohne Ausfall, leichtes Wippen im Takt, Noten/Schallringe steigen auf; bei Erfolg Applaus-Ringe aus dem Publikum, bei „verpatzt" ein Buzzer leuchtet rot. | **Mikrofon** an der Hand (`DISZIPLIN_PROP.showcase`) | `SCHACH_HAND` (schon zweimal wiederverwendet: Tennis, Fechten), Noten als Primitive |
| **KRAFTAKT** (Strongman) | Vollbild golem/mech_gross/mech_transformer/roboter/krokodil/drache · Rasse Construct · Sub Behemoth/Destroyer/Beast/Creature · Power-dominant | Stampfen: Skalier-Stauchung und Kippung um den Fußpunkt, Bodenstaub, ein Felsbrocken wird gehoben und zerbricht bei Erfolg (bei „verpatzt" fällt er ganz). | **Felsbrocken** (Primitive, zwei Hälften) | Haltungs-Transformationen und `zeichneBodenstaub` aus `zeichneBreaking()` (`:16427`, `:16603-16610`) |
| **AKROBATIK** (Flug/Sprung) | BAU `fluegel` · Vollbild taube/singvogel/geist/kraken/froschmensch · Sub Trickster/Ninja/Assassin/Wayfarer · Speed/Dexterity-dominant | Sprungbogen über die Bühnenmitte (Salto = eine Rotation um den Körpermittelpunkt), Landung mit Staub; Flügler schweben statt zu springen. Bei „verpatzt" Sturz (`hurt`-Frame kurz, wie `kuerSturz`). | keine | Sprung-/Sturz-Muster aus `stepKuer()` (`:13910`), `kuerSturz`-Pfad in `zeichneSprite()` |

Sechs statt drei, weil das Roster es hergibt: von 146 Bauplänen tragen nach obiger Zählung
38 eine Klinge/Axt (~26 %), 14 einen Stab (~10 %), 5 eine Schusswaffe (~3 %), rund 20–30 sind
Vollbild-Kreaturen (~15–20 %), 28 tragen einen Element-Effekt (~19 %, teils überlappend), und
ein gutes Drittel hat gar keine Waffe — darunter die Bard-/Royalty-Charaktere. Mit nur drei Acts
säßen zwei Drittel des Feldes im selben Topf, und die Show wäre wieder uniform.

### 3.2 Die Ableitung: `actVon(u)` — deterministisch, ohne neue Felder

Nach dem `leitePers()`-Muster: eine Tabelle `SHOWCASE_ACT_PUNKTE` vergibt je Quelle Punkte,
höchste Summe gewinnt. Reihenfolge der Quellen nach Aussagekraft:

1. **BAU-Bauplan** (stärkste Quelle, 3 Punkte): Waffe → Kampfkunst/Schützenkunst/Zaubershow
   (stab), Vollbild → Kraftakt/Akrobatik, `fluegel` → Akrobatik, `effekt` → Zaubershow.
   Unbekannte Namen (`BAU_STD`) liefern hier 0 und fallen auf die nächsten Quellen zurück.
2. **Klasse** (2 Punkte), **Unterklassen** (je 2), **Rasse** (1), **Traits** (je 1) — Tabelle
   analog `PW`.
3. **Attribute** (1 Punkt) als Kipp-Regel: das Maximum aus {charisma, power, intelligence,
   dexterity/speed} gibt einen Punkt an Gesang/Kraftakt/Zaubershow/Akrobatik.
4. **Gleichstand**: `cypherHash(u.id, 11) % anzahlGleicher` — deterministisch, kein `rr()`.
   (Nicht `u.id` nackt: der ist ein Laufindex und würde die Seiten systematisch verzerren.)

Rein aus `BAU[u.n]`, `p.c`, `p.r`, `p.sub`, `p.tp`, `p.tn`, `p.a` — alles Felder, die der
Adapter heute schon liefert. **Kein neues Persistenz-Feld, keine Adapter-Änderung, keine
Zufallsziehung.** Die Zuweisung ist außerdem stabil über Spiele hinweg: derselbe Charakter zeigt
in jeder Showcase-Saison denselben Act — das ist gewollt (ein Charakter hat ein Talent).

Später schärfbar, ohne dieses Konzept zu ändern: sobald `archetypenFuer()` im Adapter als
zusätzliches Feld `archetyp` durchgereicht wird (ein Adapter-Feld, kein Persistenz-Feld), kann
die Archetyp-Rolle (DPS/TANK/SUPPORT/…) als weitere Punktquelle dazu. Das ist ein Nice-to-have
für eine spätere Runde, kein Blocker.

### 3.3 Dramaturgie: ein Auftritt am Stück, schwächste zuerst

Heute enthüllt die generische Warteschlange Durchgang 1 für alle zwölf, dann Durchgang 2 — auf
der Bühne wechselt jede Sekunde der Aktive, kein Auftritt hat einen Anfang oder ein Ende. Eine
Talentshow ist das Gegenteil: **jeder kommt einmal raus**, zeigt seine Nummer, geht ab.

Vorschlag, wortgleich zum Kür-Präzedenzfall (`:12961-13008`): `buehneQueue` je Teilnehmer
zusammenhängend (fünf Durchgänge = 5 s Auftritt), Reihenfolge nach `eig` aufsteigend, Seiten
verzahnt — der Wettbewerb baut sich auf, der Star kommt zuletzt. Bewiesen rho-neutral: die Queue
bestimmt nur die Reihenfolge, in der vorberechnete `runden[]`-Einträge aufgedeckt werden,
`u.summe` ist eine Summe über dieselbe Menge, `rr()` wird nie gezogen (Eiskunstlauf: bit-identisch
gemessen, PR-Beschreibung dort). Gesamtdauer bleibt 60 s.

Bühnenbild dazu: der Aktive tritt in die Mitte ins Rampenlicht (Glide nach dem `NAECHER()`-Muster
aus `stepCypher()`), die übrigen warten links/rechts „backstage" in zwei Reihen, kleiner (0,72)
und hinter einer Vignette — exakt das Zwei-Ränge-Rezept, das Chris bei Breaking abgenommen hat
(„zwölf Unbeteiligte" vs. „einer, um den es gerade geht", `:16394-16415`).

---

## 4. Rezept oder Präsentation? Die Empfehlung

### 4.1 Warum das Rezept unangetastet bleibt

**Empfehlung: Act-Vielfalt ist rein präsentatorisch. Das Sieben-Rollen-Rezept und die Punktformel
bleiben Zeichen für Zeichen, wie sie sind.** Vier Gründe:

1. **rho 0,892 ist die drittbeste Zahl im Feld** und liegt über der 0,85-Zielmarke. Es gibt hier
   nichts zu reparieren.
2. **Act-abhängige Gewichte würden die Validität senken, nicht heben.** `eig` (das, wogegen die
   Sonde korreliert) entsteht aus `BASIS_JE_DISC.showcase` (der Matrix: charisma 27, spirit 16,
   …), die Durchgangspunkte aus dem Rezept. Heute sind beide an derselben Matrix ausgerichtet.
   Würde ein Kampfkunst-Act seine Punkte aus power/dexterity beziehen, ein Zauber-Act aus
   intelligence/spirit, dann belohnte die Mechanik je Teilnehmer etwas anderes als die Eignung
   misst — das ist die Definition der Validitätslücke aus CLAUDE.md, und sie kostet rho, garantiert
   und messbar.
3. **Jede Rezeptänderung braucht eine Kalibrierrunde** (n ≥ 96, Kaderfamilie, Vorher/Nachher) und
   müsste mehr als die Spannweite 0,158 bewegen, um überhaupt nachweisbar zu sein. Nach oben ist
   bei 0,892 kein Platz dafür.
4. **Die acht Bühnen-Zweige vor Showcase haben genau diesen Weg genommen** und ihn mit
   bit-identischen Messungen abgeschlossen. Es gibt einen erprobten Vertrag (`buehnenBewegung()`,
   `:13651-13663`): nur `viz*`-Felder, nie `u.summe/runden/aktuell/lunge/buehneAkt/done`, nie
   `rr()`, Streuung nur per Hash aus `u.id`.

### 4.2 Was der Act trotzdem an Text und Zahlen berühren darf

- **Feed-Zeile:** heute `u.n+" — "+r.ereignis+" ("+r.punkte+" Punkte, Durchgang …)"`
  (`:13643`). Vorschlag: `u.n+" — "+ACT.label+": "+ACT.text[r.ereignis===art.erfolgWort]` —
  z. B. „Draco — Kampfkunst: die Klinge singt, das Publikum tobt" / „Lulu — Zaubershow: der
  Funke verpufft". **Wichtig: `r.ereignis` selbst bleibt `erfolgWort`/`failWort`.**
  `WERTUNG_AUFTRITT` zählt Fehlschläge über `r.ereignis===art.failWort` (`:15667`, `:15669`) —
  ein act-eigenes Wort an dieser Stelle würde die Tabelle brechen. Der Act-Text ist Zierde am Feed,
  nicht der Ereignisname.
- **Wertungstabelle:** unverändert. Eine „Act"-Spalte wäre ein Eingriff in die generische
  `WERTUNG_AUFTRITT` (geteilt mit Wettessen/Eiskunstlauf/Breaking) — nicht in dieser Runde. Der
  Act steht als Schild unter dem Namen auf der Bühne, das genügt.
- **Nichts am Rezept, nichts an `failAbzug`, nichts an `rundenN`/`rundenDauer`.**

### 4.3 Die drei kleinen Berührungen des geteilten Codes — und warum sie bit-identisch sind

Alles andere lebt in eigenen, gegateten Funktionen. Drei Stellen im geteilten Code werden
angefasst, jede nach einem bereits etablierten Präzedenzfall:

| Stelle | Änderung | Präzedenzfall | Warum bit-identisch für alle anderen |
|---|---|---|---|
| `zeichneSprite()` `:3519` | `const waffeEffektiv = u.vizWaffe!==undefined ? u.vizWaffe : (erzwungen===undefined ? b.waffe : erzwungen);` | `u.vizPhase` überschreibt `hebePhase()` (`:2932`) | niemand außer `stepShowcase()` setzt `vizWaffe`; `DISZIPLIN_WAFFE.showcase` bleibt `null` — der Zufallswaffen-Bug (10.09.) kommt **nicht** zurück, weil die Waffe nur für den Kampfkunst-/Schützen-Act und nur für diesen Teilnehmer freigegeben wird |
| `zeichneSprite()`, Effekt-Aufruf | `const eff = u.vizEffekt || b.effekt;` vor den `zeichnePartikelEffekt`-Aufrufen | dasselbe Muster | `zeichnePartikelEffekt` ist eine Closure **innerhalb** von `zeichneSprite()` (`:3050`) und von außen nicht erreichbar — ein `viz`-Override ist der einzige Weg ohne Umbau |
| `buehnenBewegung()` / `zeichneBuehne()` | je eine `if(art.showcase && typeof stepShowcase==="function")`-Zeile | Tennis (`:14876`), Fechten (`:14883`) | Flag nur auf `BUEHNE_ART.showcase` |

Alle drei sind Einzeiler, und der Nachweis ist der übliche: `node scripts/miss-alle-disziplinen.mjs
24` vor und nach jeder PR, alle zwanzig Zeilen bit-identisch — insbesondere Wettessen und I-Spy,
die denselben generischen Zweig weiter durchlaufen, und Gewichtheben/Tennis/Fechten, die
`zeichneSprite()`s Waffen-/Effektpfade teilen.

---

## 5. Bauplan für die Hauptsession

Vier PRs, sequenziell (alle fassen dieselbe Datei an). Aufwände sind Arbeitstage einer Session
inklusive Sicht-QA per Playwright-Screenshot — die Scorecard nennt die fehlende Sichtprüfung als
„teuersten Punkt der ganzen Liste" (Abschnitt 7.1), deshalb gehört sie in jede PR, nicht ans Ende.

### PR S0 — Gerüst und Act-Ableitung (≈ 0,5 Tag)

- `BUEHNE_ART.showcase`: Flag `showcase:true`.
- `SHOWCASE_ACTS` (sechs Einträge: `id`, `label`, `text:{erfolg,fail}`, `pose:"slash"|"shoot"|"walk"|"hop"`,
  `waffe:"eigene"|null`) und `SHOWCASE_ACT_PUNKTE` (Tabelle nach `PW`-Muster).
- `actVon(u)`: reine Funktion aus `BAU[u.n]`, `u`-Feldern und `cypherHash`; Ergebnis einmal in
  `bauBuehne()`-Nachlauf oder beim ersten `stepShowcase()`-Durchlauf auf `u.vizAct` (so wie
  `stepCypher()` `vizPhase` initialisiert, `:14298-14302`).
- `stepShowcase(dt,art)` und `zeichneShowcase(art)` als zunächst leere/durchreichende Zweige,
  angeschlossen in `buehnenBewegung()`/`zeichneBuehne()`.
- `buehneQueue` je Teilnehmer zusammenhängend, aufsteigend nach `eig`, Seiten verzahnt (Kür-Muster).
- Feed-Zeile mit Act-Text (4.2).
- Sonde: `window.__arena.showcaseActProbe(name)` → `{act, punkte, warum}` (rein lesend, wie
  `hoehenKorrProbe`), damit sich die Verteilung über den vollen Kader prüfen lässt — **bevor**
  irgendetwas gezeichnet wird. Abnahme: kein Act mit > 50 % des Kaders, keiner mit 0.
- Nachweis: `miss-alle-disziplinen.mjs 24` bit-identisch.

### PR S1 — Bühnenbild und Rampenlicht (≈ 1 Tag)

- `bodenShowcase()` neben `bodenBuehne()`: roter Vorhang oben, Rampenlicht-Reihe unten, Jury-Pult
  mit drei Buzzern am unteren Rand (Motive aus `showcase.tsx`), Publikums-Silhouetten als dunkle
  Halbkreise. Publikums-Loop start/stop nach dem `schachPublikumAn`-Muster (`:14692-14693`).
- Zwei Ränge: Aktiver in der Mitte im Spotlight (voll), Wartende links/rechts backstage (0,72,
  Vignette). Glide über `u.vizX/u.vizY` mit `NAECHER()`. Act-Schild unter dem Namen.
- Buzzer: bei „verpatzt" leuchtet ein Buzzer rot auf (`u.lunge` als Uhr, wie der Tennis-Ball),
  bei Erfolg ein kurzer Applaus-Ring aus dem Publikum.
- Sicht-QA: Screenshot mit `setDisc('showcase')`, dazu Gegenprobe Wettessen/I-Spy unverändert.

### PR S2 — Die sechs Acts (≈ 2 Tage)

Je Act eine Zeichenfunktion `zeichneAct[id](u, x, y, Z, phase)`, aufgerufen aus
`zeichneShowcase()` nur für den Aktiven; `stepShowcase()` setzt je Frame `u.vizWaffe`,
`u.vizEffekt`, `u.vizPose` und die Requisiten-Phase. Reihenfolge nach Aufwand:

1. **Gesang/Rede** — `DISZIPLIN_PROP.showcase = { hand:SCHACH_HAND, phasen:MIKRO_PHASEN, zeichne:zeichneMikrofon }`
   (dritte Wiederverwendung von `SCHACH_HAND`, kein Pixelscan nötig), Noten-Primitive, Wippen.
2. **Kampfkunst** — `u.vizWaffe = b.waffe` (nur dieser Teilnehmer, nur während seines Auftritts),
   Pose `slash`, Funken-Primitive am Klingenweg; Schildschlag bei `b.schild`.
3. **Zaubershow** — Pose `shoot`, `u.vizEffekt = {typ: b.effekt?.typ ?? (istHeiler ? "heilig" : "arkan"), pos:"koerper", streuung: 6→18 während lunge}`.
4. **Kraftakt** — Stauchung/Kippung um den Fußpunkt + `zeichneBodenstaub` (aus `zeichneBreaking()`
   in eine gemeinsame Hilfsfunktion heben, damit keine Kopie entsteht), Felsbrocken-Primitive.
5. **Schützenkunst** — `u.vizWaffe = b.waffe`, Pose `shoot`, Zielscheiben-Primitive am Bühnenrand,
   Geschoss-Flug nach dem Tennis-Ball-Muster (`zeichneTennis()`, `u.lunge` 0,5→0 als Fortschritt).
6. **Akrobatik** — Sprungbogen (`u.vizHop`, Rotation um Körpermitte), Landungsstaub; Sturz bei
   „verpatzt" über den bestehenden `kuerSturz`-Pfad (prüfen, ob er act-gegated wiederverwendbar
   ist, sonst `u.vizSturz` analog).

Vertrag je Act: liest nur `u.runden[u.aktuell].ereignis` (Erfolg/Fehlschlag), `u.lunge`,
`buehneT`, `u.id`; schreibt nur `viz*`. Sicht-QA je Act mit einer typischen Kaderfigur **und**
einer Vollbild-Kreatur (Lehre aus der Zeitfahr-Weste: „an ein, zwei Beispielfiguren sieht gut aus"
ist keine Verifikation).

### PR S3 — Ton (≈ 0,5 Tag)

`TON_KATALOG.showcase`, dieselben fünf Synth-Bausteine wie überall:

| Ereignis | Bau | Kante |
|---|---|---|
| `auftritt` | `tonDoppelton` kurz, hell (Jingle) | Teilnehmer betritt die Mitte |
| `applaus` | `tonRauschen` Burst 0,6 s | `r.ereignis===erfolgWort` bei Enthüllung |
| `buzzer` | `tonBuzzer` 0,35 s | `r.ereignis===failWort` |
| `klinge` / `schuss` / `zauber` / `stampf` | `tonMetall` / `tonKlick`+`tonRauschen` / `tonTon` gleitend / `tonSchlag` tief | act-spezifisch im Aktionsframe |
| `publikum` | Loop `tonRauschen` | `bodenShowcase()` start/stop |

Aufrufe an Kanten in `stepShowcase()` (Einmal-Marker `u.vizTonN`), Vorbild `stepZeitfahren()`.
`sfx()` ist ohne AudioContext ein No-Op und ruft nie `rr()` — kein Messrisiko.

### PR S4 — Scorecard-Nachzug und Doku (≈ 0,25 Tag)

Eigene, sequenzielle PR nach Merge (Scorecard Abschnitt 6.1). Erwartung: Konzept 25→70 (eigenes
Dokument, Flag, Zweig, Act-Ableitung), Assets 40→85 (Requisite, Ton, eigener Boden), Movement
20→75 (eigene Bewegung je Act, Zwei-Ränge-Choreografie), Gameplay 95 unverändert — Gesamt 45 → ~80 %.

**Summe: ≈ 4–5 Tage**, jede PR für sich mergefähig und rho-neutral nachweisbar.

---

## 6. Offene Entscheidungen für Chris

1. **Die sechs Act-Namen und -Kategorien** — passen sie zum Bild, das er von der Show hat? Fehlt
   eine (z. B. Comedy/Trick für Trickster)? Sechs ist die Obergrenze, bei der jede Kategorie noch
   genug Kaderfiguren hat.
2. **Act fest am Charakter** (Empfehlung: ja, ein Talent je Charakter, deterministisch) oder darf
   derselbe Charakter in verschiedenen Spielen verschiedene Nummern zeigen? Letzteres wäre über
   `cypherHash(u.id, saat)` ebenso rr()-frei machbar, kostet aber Wiedererkennung.
3. **Ein Auftritt am Stück je Teilnehmer** (Empfehlung, Kür-Muster) statt der heutigen
   Setzlisten-Enthüllung — Dramaturgie gegen „alle sind ständig ein bisschen dran".
4. **Waffen auf der Bühne**: Kampfkunst zeigt die eigene Kosmetikwaffe aus dem Bauplan. Das ist
   dieselbe Waffe, die am 10.09. für Showcase bewusst gesperrt wurde — damals, weil sie
   **jeder** zufällig trug. Jetzt trägt sie nur, wer sie als Act vorführt. Chris sollte das
   ausdrücklich abnicken.
5. **`showcase.tsx` (React-Feld)** nachziehen, damit beide Ebenen die Acts kennen? Getrennte
   Runde; dieses Konzept betrifft nur den Motor.

---

## 7. Was dieses Konzept bewusst nicht tut

- Kein Rezept-, Formel- oder Rundenzahl-Eingriff (Abschnitt 4).
- Kein neues Persistenz-Feld, keine Adapter-Änderung (Abschnitt 3.2).
- Keine Anbindung der `lib/battle`-Klassenkits an den Motor — das ist das Arena-Thema
  („Chris' echte Kits eintragen"), nicht das Showcase-Thema. Sobald es passiert, wird `actVon()`
  um eine Quelle reicher, ohne Umbau.
- Keine Asset-Suche: alle sechs Requisiten sind Primitive im Maßstab der bestehenden
  (`zeichneHantel`, `FOLTER_GERAETE`, `zeichneStab`), aus demselben Grund, den der
  Folterbank-Kommentar (`:12192-12207`) nennt.
- Keine Änderung an `WERTUNG_AUFTRITT` (geteilt mit drei anderen Bühnen).

## Quellen (alle gelesen, nicht vermutet)

- `public/mockups/battle-mode.engine.js`: `BUEHNE_ART.showcase` `:12361`, `bauBuehne()` `:12770`,
  `stepBuehne()` `:13531`, `buehnenBewegung()` `:13664`, `zeichneBuehne()` `:14854`,
  `bodenBuehne()` `:14667`, `zeichneBreaking()` `:16317`, `stepCypher()` `:14263`,
  `zeichneSprite()` `:2881` (Waffe `:3519`, Pose `:3544-3584`, Effekte `:2997-3050`),
  `DISZIPLIN_WAFFE` `:2471`, `DISZIPLIN_PROP` `:2858`, `TON_KATALOG` `:20591`, `SKILLS`/`SCHEMA`
  `:3962-4150`, `mitKit` `:4273`, `HEILER` `:4504`, `PW`/`leitePers` `:16744`, Slots `:4672`.
- `lib/battle/archetype-registry.ts`, `lib/battle/class-kits.ts`, `lib/battle/subclass-archetypes.ts`,
  `lib/foundation/battle-arena/arena-kader-adapter.ts`, `lib/data/olyDataTypes.ts:985-1030`.
- `app/foundation/discipline-stage/arena/disciplines/showcase.tsx`.
- `docs/design/gesamtstand-fertigstellungsgrad-alle-disziplinen-09-10.md` (Zeile 500, Abschnitte
  2/Showcase, 3.1, 3.2, 5, 6, 7), `docs/design/speed-schach-showcase-produktivierung.md`,
  `docs/design/bahn-requisiten-ton-16-09.md`, `docs/design/messgrundlage-kaderfest.md`.
- Messung: `node scripts/miss-alle-disziplinen.mjs 24 showcase` (17.09.).
