# Recherche: Mini-DM, TDM, Battlefield — Ist-Zustand, Assets, Zielwahl-Entscheidung (Fable)

Stand: Branch `claude/arena-drei-disziplinen-recherche`, abgezweigt von
`origin/claude/sonde-alle-disziplinen` `c75072ff`. Alle Datei-/Zeilenangaben unten sind gegen
genau diesen Stand geprüft. `engine.js` meint `public/mockups/battle-mode.engine.js`.

Vorarbeit gelesen und vorausgesetzt: `docs/design/arena-duell-recherche-fable.md` (Fables
eigene Zielwahl-Recherche, vollständig), `docs/design/projekt-ueberwachung-opus.md` Abschnitt
1.2/2.2/2.5, `docs/design/stand-aller-disziplinen.md` Abschnitt 5a, und als Pflicht-Benchmark
`docs/design/basketball-finalisierung-recherche-fable.md`. Reine Recherche/Planung — kein
Commit an der Engine.

**Jede Zahl unten ist entweder selbst gemessen (mit Befehl), aus dem Code zitiert
(Datei:Zeile) oder eine reale/offene Quelle (mit URL). Was ich nicht prüfen konnte, steht als
„nicht geprüft" da.**

---

## 0. Die wichtigsten Funde vorab

1. **Alle drei Disziplinen fallen heute durch — frisch gemessen, nicht aus alten Tabellen
   übernommen.** `node scripts/miss-alle-disziplinen.mjs 24 mini-dm tdm battlefield`:

   | Disziplin | Chassis | Teilnehmer | rho je Spiel | rho Saison |
   |---|---|---:|---:|---:|
   | Mini-DM | arena | 8 | 0,658 | 0,786 |
   | TDM | arena | 12 | 0,506 | 0,587 |
   | Battlefield | arena | 8 | 0,470 | 0,714 |

   Schranke ist 0,80 je Einzelspiel (CLAUDE.md). Diese Zahlen sind der aktuelle Stand
   **nach** den beiden jüngsten Arena-Reparaturen (Wertformel-Fix `82a94988`/`7013d40e`,
   Battlefield-Reihen-Fix `f2dcba39`) — sie decken sich exakt mit
   `stand-aller-disziplinen.md` Abschnitt 5b und widerlegen damit nichts dort Stehendes,
   bestätigen es nur unabhängig.
2. **Die Zielwahl-Frage aus `arena-duell-recherche-fable.md` ist inzwischen NICHT beantwortet
   — geprüft, nicht vermutet.** `stand-aller-disziplinen.md:150` führt „Zielwahl ist
   Geometrie statt Bedrohung" weiterhin als **offen**, und die Git-Historie seit dem 02.09.
   zeigt keinen Commit, der `cdKuerzung` oder die Standard-Zielwahl anfasst — nur den
   Wertformel-Fix, den Battlefield-Reihen-Fix und eine reine UI-Ergänzung (Zielansage/
   Fokusfeuer, PR #691, `73acbf69`, dazu unten mehr). **Die Entscheidung bleibt offen für
   diesen Bericht**, und Abschnitt 4 legt konkrete Optionen vor, statt das nur zu wiederholen.
3. **Battlefield ist NICHT die größte der drei Disziplinen — eine Korrektur zur Aufgabe.**
   `ARENA_ART` (`engine.js:3529/3543/3598`) trägt `jeSeite`: TDM **6**, Mini-DM **4**,
   Battlefield **4**. Battlefield ist also genauso klein wie Mini-DM, nur mit vier
   Führungs-Rollen (Commander, Spotter, Siege Core, Morale Anchor) statt vier
   Nahkampf-Rollen — eine **thematische**, keine **numerische** Eskalation. Das ist wichtig
   für Abschnitt 4.2 (Skalenfrage): „Battlefield größer aufziehen" ist eine andere Frage als
   „Battlefield fühlt sich größer an".
4. **Der teuerste Teil von Basketballs Finalisierung — eine glaubwürdige Waffe/Objekt in der
   Hand — ist für alle drei Kampf-Disziplinen bereits gelöst, und zwar besser als Basketballs
   eigene Lösung.** Der komplette Kampf-Renderer (`engine.js:2130 ff.`) zeichnet Schwert,
   Axt, Kampfstab, Zweihänder, Bogen und drei Feuerwaffen als eigene Overlay-Ebenen über den
   LPC-Figuren, synchron zum `slash`/`shoot`-Angriffsframe, mit eigener Rüstungs-Umfärbung
   (`RUEST_QUELLEN`, `engine.js:508 ff.`) — genau die Technik (Ankerpunkt + eigene Ebene statt
   neuem Sprite-Blatt), die die Basketball-Recherche für den Ball erst noch vorschlägt
   (`basketball-finalisierung-recherche-fable.md` Abschnitt 2.3, Weg A). **Das ist der
   zentrale Unterschied zu Basketball/Football/Hockey: dort fehlten neue Wurf-/Trage-Posen,
   hier ist die komplette Kampfanimation (walk/slash/shoot/hurt) plus Waffen-Overlay schon
   seit Monaten produktiv.** Details und die verbleibenden Lücken in Abschnitt 2.
5. **Basketballs Feldspiel-Infrastruktur (Manndeckung, Zonen, `kurve:`-Datenblock) gilt für
   die Arena NICHT — nicht teilweise, sondern gar nicht.** `zuordneDeckung` (echte
   1:1-Manndeckung mit Mismatch-Tempo, `engine.js:5636 ff.`) und `FELDSPIEL_ART[d].kurve`
   (`engine.js:4385`) sind **Feldspiel-Chassis-Funktionen** — die Arena hat weder die eine
   noch die andere Struktur, sondern ein eigenes, älteres System aus Zielwahl
   (`chooseTarget`), Bindung (`bindAn`) und Reihen (`SLOT_ZUSATZ`/`slotReihe`). Wo Basketball
   „Zonen" sagt, sagt die Arena „Reihe 0/1/2 plus Formationsleine" — ein strukturell anderes,
   nicht wiederverwendbares Konzept. Abschnitt 1.0 arbeitet das im Detail aus, weil es die
   Pflichtvorgabe des Auftrags direkt betrifft.
6. **Es gibt ein `kurve:`-Äquivalent für die Arena nicht, und das ist dieselbe Lücke, die
   `projekt-ueberwachung-opus.md` Abschnitt 2.2 schon für Bühne und Bahn findet.** Keine
   Kampf-Disziplin hat eine gegen reale Kampfsysteme kalibrierte Erfolgs-/Schadenskurve als
   Datenblock — die Konstanten stecken verstreut im Motor (`treffer()`, `angFaktor`, s.
   Abschnitt 1.0).
7. **`cdKuerzung=0` ist eine begründete, zitierfähige Design-Entscheidung, keine Lücke** —
   deutlicher belegt, als `stand-aller-disziplinen.md` es zusammenfasst. Der Kommentar direkt
   an der Stelle (`engine.js:11160-11174`) zitiert Chris wörtlich: *„schau, dass Tempo nicht
   den Angriff beschleunigt — du musst die Mechaniken wirklich von Eslabong uebernehmen,
   sonst funktioniert es nicht"* — mit Verweis auf Eslabongs eigene Klassenkarten (feste
   Abklingzeiten unabhängig vom Tempo des Trägers) und der Messung, dass die alte Fassung
   einem Tempo-80-Kämpfer 18 % mehr Schläge gab, obwohl die TDM-Matrix Tempo mit Gewicht
   **null** bepreist. Das ist ein Grund, die Entscheidung nicht leichtfertig umzudrehen — und
   ein Grund, warum Abschnitt 4 sie in den Optionen offen lässt, statt sie zu überstimmen.
8. **Ein Teil der Zielwahl-Infrastruktur, die Fable als fehlend beschrieb, existiert
   inzwischen als Spieler-Werkzeug — aber nicht als KI-Standard.** `chooseTarget`
   (`engine.js:11361 ff.`) kennt seit PR #691 eine **Zielansage** (`kfZielFuer`,
   `engine.js:11354`, UI: Ring + Restsekunden, `FOKUS_FARBE`), mit der ein Spieler einen
   Gegner markiert und die eigene Zielwahl auf ihn lenkt. Und `u.zielP==="bedrohung"` ist
   bereits ein wählbares Ziel-Overlay je Kämpfer (`engine.js:11425`, Menü-Eintrag „Größte
   Bedrohung", `ZIELE`, `engine.js:2860`) — nur ist es weder Standard noch mit Hysterese
   versehen. Abschnitt 4.1 baut genau darauf die Optionen.

---

## 1. Ist-Zustand: das gemeinsame Arena-Chassis, gegen Basketball gehalten

### 1.0 Der Pflichtvergleich: wo Basketballs Infrastruktur greift, wo nicht

| Basketball-Baustein | Fundstelle | Gilt für Mini-DM/TDM/Battlefield? |
|---|---|---|
| Manndeckung `zuordneDeckung` (1:1, Mismatch-Tempo) | `engine.js:5636 ff.` | **Nein.** Feldspiel-Chassis-Funktion, wird von `istFeldspiel()` gerahmt (`engine.js:4905 ff.`); die Arena läuft nie durch diesen Pfad. Das Arena-Äquivalent ist `chooseTarget`+`bindAn` — ein Ziel-pro-Tick-System, kein Zonen-/Deckungssystem. |
| Zonen (Zonentiefe, Korbnähe, `zonenTiefe`/`zonenHalb`) | `engine.js:6535 ff.` | **Nein**, aus demselben Grund. Die Arena hat stattdessen **Reihen** (`reihe:0/1/2`, `SLOT_ZUSATZ`, `engine.js:3125 ff.`) — eine Tiefenstaffelung ohne Seitenausdehnung, die Positionsvorteil abbildet, aber nicht in Metern/Prozent der Feldtiefe wie Basketballs Zone. |
| `kurve:`-Datenblock je Disziplin (`FELDSPIEL_ART[d].kurve`) | `engine.js:4385` | **Nein.** `ARENA_ART` kennt kein `kurve`-Feld überhaupt (Abschnitt 3521 ff. zeigt nur `label`/`jeSeite`/`rezept`). Die Erfolgs-/Schadenslogik der Arena sitzt fest im Motor (`treffer()`, `angFaktor`, `engine.js:10418 ff.`, laut Fables Recherche Abschnitt 1.1 „formal in Ordnung", aber nicht als austauschbare Disziplin-Daten gebaut). Das ist exakt die Lücke, die `projekt-ueberwachung-opus.md` Abschnitt 2.2 für **sechs** Bühnen-Disziplinen UND für die Arena beschreibt — hier bestätigt für alle drei Zieldisziplinen. |
| Ballpositionierung/-tragen | `fsBall`, `traeger.*`, `engine.js:7664 ff.` | **Nein, entfällt strukturell.** Kampf-Disziplinen haben kein geteiltes Objekt — jeder Kämpfer trägt seine eigene Waffe. Das nächstliegende Analogon ist die Waffen-Overlay-Ebene (Abschnitt 2), die dasselbe Ankerpunkt-Prinzip verwendet, aber technisch unabhängig implementiert ist. |
| Erfolgskurve gegen reale Referenz kalibriert (1074 NBA-Würfe) | `basketball-finalisierung-recherche-fable.md` Abschnitt 4 | **Nein, noch nicht versucht.** Es gibt keine reale Kampfstudie, gegen die `treffer()`/`angFaktor` je kalibriert wurden — Abschnitt 3 unten liefert Referenzformeln aus offenen Spielen als Ersatz, weil eine „echte Nahkampf-Trefferquoten-Studie" (anders als NBA-Tracking-Daten) nicht in vergleichbarer Form existiert. |
| Asset-Wiederverwendung (`public/sprites/basketball/`) | `quellen.json` | **Nein, andere Assets.** Basketballs Ball/Korb/Parkett sind für die Arena irrelevant. Was sich sehr wohl überträgt, ist die **Methode**: LPC-Baukasten-Layer + Handpunkt/Ankerpunkt statt neuer Sprite-Blätter — und genau diese Methode ist in der Arena für Waffen bereits **produktiv**, während Basketball sie für den Ball erst noch bauen soll (Fund 4 oben, Abschnitt 2). |

**Fazit des Pflichtvergleichs:** Keine der vier tragenden Basketball-Feldspiel-Strukturen
(Deckung, Zone, Kurve-als-Daten, Ballobjekt) überträgt sich auf die Arena — die beiden
Chassis sind an der Wurzel unterschiedlich gebaut (`istFeldspiel`/`istArena` sind exklusive
Zweige, `engine.js:4905`/`3621`). Was sich überträgt, ist ausschließlich **Prinzip**, nicht
**Code**: „gib jedem Attribut einen echten mechanischen Kanal, nicht nur einen
Normierungs-Bonus" (das war schon die Eignungslücke, für die Arena laut
`stand-aller-disziplinen.md` Abschnitt 5a **behoben**), und „ein Objekt/eine Waffe gehört an
einen Ankerpunkt, nicht neben die Hüfte" — und bei Letzterem ist die Arena, wie Fund 4 zeigt,
bereits weiter als Basketball selbst.

### 1.1 Was in allen drei Disziplinen gleich funktioniert (der geteilte Arena-Motor)

- **Zielwahl** `chooseTarget` (`engine.js:11361-11449`): eine deterministische Kaskade
  (Rückzug → Durchbruch → Zielansage → Offensivzwang → Rückenangreifer → Stellungsbefehl →
  übersteuerte Zielpriorität → Persönlichkeit → Rückfall `nearest`). Kein Zufall — Fables
  Befund („Geometrie, nicht Würfel") gilt unverändert. Sechs Persönlichkeiten (`PERS`,
  `engine.js:2840-2847`) mit `PERSZIEL`-Default: **drei von sechs** (bollwerk, draufgaenger,
  beschuetzer) zielen standardmäßig auf `naechster`, eine (`duellant`) auf `bedrohung`, eine
  (`schleicher`) auf `hinten`, eine (`opportunist`) auf `schwach`. Spieler können das je
  Kämpfer über ein Menü übersteuern (`ZIELE`, `engine.js:2859-2865`, fünf Optionen inklusive
  „Größte Bedrohung" und „Heiler zuerst").
- **Reihen/Formation** `SLOT_ZUSATZ` (`engine.js:3125-3155`): jeder Slot trägt `reihe`
  (0/1/2), `ord` (`mitlinie`/`flanke`/`verfolgen`) und `pos` (Aufstellungsreihenfolge). Für
  TDM und Mini-DM stehen die eignungsstärksten Slots in Reihe 0 (negative Korrelation
  Eignung↔Reihe, s. Kommentar `engine.js:3141-3149`); für Battlefield wurde das am 03.09.
  **umgedreht** korrigiert (`f2dcba39`), weil die alte Reihenfolge die Führungsrollen fälschlich
  nach vorn stellte.
- **Wertformel** `beitragVon` (`engine.js:12365`): `u.st.dmg+u.st.heal+u.st.schild+
  u.st.verh*0.4+u.st.koAnteil*140` — die 44-%-„Prügel-Gutschrift", die Fable fand, ist
  **behoben** (`tank` komplett raus, `verh` von voll auf 0,4 gekappt, Commits `7013d40e`/
  `82a94988`).
- **Kampfrenderer**: gemeinsam für alle vier Arena-Disziplinen (Mini-DM/TDM/Battlefield/
  Fechten) und für alle anderen Rassen/Klassen im Spiel — kein separater Zeichenpfad je
  Disziplin (Abschnitt 2).
- **Bodenbild** `bodenArena()` (`engine.js:12717-12795`): Sandgrund, Steinring, Blutflecken,
  Fackeln, seitenfarbige Verläufe — **identisch für alle vier Arena-Disziplinen**. Genau
  dasselbe Muster wie die sieben Bühnen-Disziplinen, die sich laut
  `projekt-ueberwachung-opus.md` Abschnitt 1.5 ein Podest mit drei Scheinwerfern teilen: **die
  Arena hat einen Kampfplatz, keine drei** — ein Team-Deathmatch, ein 4-gegen-4-Skirmish und
  eine „Schlacht" mit Feldherrn sehen exakt gleich aus, obwohl ihre Namen unterschiedliche
  Schauplätze versprechen.
- **Kein Live-Feed ins Spiel**: wie 19 von 20 Disziplinen laufen alle drei nur im Mockup.
  `ARENA_RESOLVED_DISCIPLINE_IDS` (`lib/resolve/battle-mode-arena-team-points.ts:32`) enthält
  ausschließlich `"basketball"` — dieselbe Lücke, die `projekt-ueberwachung-opus.md`
  Abschnitt 1.4 als die größte im ganzen Projekt beschreibt, gilt unverändert für alle drei
  hier behandelten Disziplinen.

### 1.2 Mini-DM (4 gegen 4)

**MATRIX** (`engine.js:3532`): torment 24, health 20, power 16, stamina 16, will 14,
dexterity 10 — sechs Attribute, kein Charisma/Intelligence/Spirit; der Kommentar sagt es
selbst: „hier führt niemand, hier liest niemand — hier wird geschlagen und eingesteckt."

**Slots** (`engine.js:2969-2974`): Frontliner (health/power), Finisher (torment/dexterity),
Trick Fighter (dexterity/will), Iron Guard (stamina/health) — vier Rollen ohne Fernkampf- oder
Support-Slot, konsistent mit der Matrix.

**Gemessen**: rho 0,658/0,786 (Abschnitt 0). Fables Vorarbeit (vor den beiden Fixes, mit
reparierter Formkarten-Ziehung) fand `verh` als größten Wertformel-Anteil (rho Eignung↔`verh`
0,708, Abschnitt 2.2 dort) — nach der Wertformel-Reparatur (Abschnitt 1.1 hier) ist das der
Kanal, der jetzt am stärksten trägt, nicht mehr überbewertet.

**Fehlt zur Basketball-Reife:**
- Kein `kurve:`-Block (s. 1.0) — dieselbe Lücke wie überall in der Arena.
- Keine eigene Bühne/Kampfplatz (s. 1.1) — bei nur vier gegen vier wäre ein kleineres,
  intimeres Arenabild (kürzerer Umfang, engerer Zuschauerring) die naheliegende visuelle
  Differenzierung, weil die Disziplin selbst „eng, kein Platz zum Ausweichen" ist
  (Matrix-Kommentar).
- Keine Ereignis-Typisierung über den reinen Treffer/Fehltreffer hinaus (kein Parry-Feedback,
  kein Kombo-Zähler) — bei nur vier Kämpfern pro Seite wäre das am günstigsten sichtbar zu
  machen, weil jeder einzelne Treffer einen größeren Anteil am Spielgeschehen hat.

### 1.3 TDM (6 gegen 6)

**MATRIX** (`engine.js:2939`): power 28, health 20, stamina 14, spirit 12, charisma 10,
determination 6, intelligence 6, awareness 2, torment 2. Auffällig: **kein Speed** — die
älteste und am stärksten eingemessene Arena-Disziplin (Rezept-Kommentar `engine.js:3502-3528`
dokumentiert vier gescheiterte Neubau-Versuche, alle schlechter oder ununterscheidbar vom
bestehenden Rezept).

**Slots** (`engine.js:2961-2967`): Vanguard, Skirmisher, Shotcaller, Hold Line, Rally Point,
Breaker — sechs klar benannte Rollen mit Reihen 0/1/2 (`vanguard`/`holdline` vorn,
`breaker`/`skirmisher` Mitte, `shotcaller`/`rallypoint` hinten).

**Gemessen**: rho 0,506/0,587 — die schwächste Einzelspiel-Zahl der drei, trotz der
umfangreichsten Rezeptarbeit. Der Rezept-Kommentar selbst benennt den wahrscheinlichen Grund:
„TMP und AUS liegen ausserhalb der Eignungs-Normierung [...] TDM bleibt damit die einzige der
drei Zieldisziplinen über 15 Pp — offener Befund für eine nächste Runde, die vermutlich am
Chassis (`aufEignung`/TMP-AUS-Normierung) ansetzen müsste statt an den Rezeptgewichten"
(`engine.js:3525-3528`). Das deckt sich mit Fables Kernbefund (Zielwahl ist Geometrie, nicht
Eignung) — beide zeigen auf dasselbe Chassis-Problem, nicht auf das Rezept.

**Fehlt zur Basketball-Reife:**
- Dieselbe `kurve:`-Lücke.
- TDM ist mit sechs gegen sechs die einzige der drei, die groß genug für ein sichtbares
  „Team-Fight"-Muster ist (Fokuspunkt, Flankenbewegung) — visuell aber ununterscheidbar von
  Mini-DM (4v4) und Battlefield (4v4), weil `bodenArena()` keine Skalierung nach `jeSeite`
  kennt.
- Kein Live-Boxscore im echten Spielstand (1.1).

### 1.4 Battlefield (4 gegen 4, thematisch am größten)

**MATRIX** (`engine.js:3586`): charisma 20, intelligence 16, spirit 16, torment 12, power 10,
awareness 10, health 8, determination 4, stamina 4 — die einzige Kampfdisziplin, in der Power
nicht führt. Kommentar: „das ist keine Schlägerei, das ist ein GEFÜHRTES Gefecht."

**Slots** (`engine.js:2975-2980`): Commander (charisma/intelligence, „führt große Situationen"),
Spotter (awareness/intelligence, „liest Lücken"), Siege Core (power/torment, „drückt
Fronten"), Morale Anchor (spirit/charisma, „hält Linien zusammen"). Diese vier Rollen sind
inhaltlich am nächsten an einem Overwatch/TF2-artigen Rollensystem (Tank=Siege Core,
Support=Morale Anchor, Shotcaller=Commander, Scout/Vision=Spotter) — mechanisch kämpfen aber
alle vier über exakt dasselbe `chooseTarget`/`beitragVon` wie Mini-DM/TDM, es gibt **keine
Rollen-spezifische Fähigkeit** (kein Heilzauber nur für Morale Anchor, kein „markiere Ziel"
nur für Spotter — die generische Zielansage aus PR #691 steht allen offen).

**Gemessen**: rho 0,470/0,714 — die schwächste Einzelspiel-Zahl, aber die höchste
Saison-Validität der drei (0,714, gegenüber 0,50 vor dem Reihen-Fix laut
`stand-aller-disziplinen.md`). Das ist genau das Muster, das CLAUDE.md beschreibt: die
Mechanik belohnt inzwischen das Richtige (Saison hoch), aber bei nur vier Kämpfern pro Seite
und wenigen Ereignissen ist ein Einzelspiel zu verrauscht, um das zu zeigen (Einzelspiel
niedrig) — ein Verlässlichkeitsproblem, kein Validitätsproblem mehr, seit dem Reihen-Fix.

**Fehlt zur Basketball-Reife:**
- Der Name „Battlefield" verspricht ein Schlachtfeld mit Fronten und Zielen — die Mechanik
  liefert ein 4v4-Deathmatch mit Führungsattributen. Es gibt **keine Objective-Mechanik**
  (kein Kontrollpunkt, keine Eroberungszone, kein Sieg-durch-Halten) — anders als der Name
  suggeriert und anders als die vier Rollen (insbesondere Commander/Siege Core) es nahelegen
  würden. Abschnitt 3.2/4.2 nimmt das auf.
- Dieselbe `kurve:`-Lücke, dasselbe geteilte Bodenbild.
- Vier Rollen, aber keine rollenspezifische Fähigkeit — der einzige Unterschied zwischen
  Commander und Siege Core ist heute die Matrix-Gewichtung, keine eigene Aktion.

---

## 2. Assets: was schon da ist, was fehlt — und warum das hier billiger ist als bei Basketball

### 2.1 Der zentrale Unterschied zu Basketball/Football/Hockey

Basketball brauchte eine neue Ballträger-Pose (LPC kennt keine „Carry"-Animation, Issue #38
im Generator-Repo, zitiert in `basketball-finalisierung-recherche-fable.md` Abschnitt 2.2) und
musste sich mit `thrust`/`spellcast` behelfen. Football bräuchte laut
`football-rollout-plan.md` Abschnitt C.4 ein eigenes Trikot-Layer, das es nicht gibt. **Für
Mini-DM/TDM/Battlefield ist diese Aufgabe bereits erledigt**, weil Kampf die
Kernanimation ist, für die der LPC-Baukasten ursprünglich gebaut wurde:

| Animation | LPC-Original-Zweck | Motor-Nutzung heute |
|---|---|---|
| `walk` (9 Bilder) | Gehen | Bewegung aller Kämpfer, `engine.js:2146` |
| `slash` (6 Bilder) | Nahkampf-Hieb | **Genau das**: Schwert/Axt/Stab/Zweihänder-Angriff, `ani=feldspiel?"shoot":((bogen||feuerwaffe)?"shoot":"slash")`, `engine.js:2144` |
| `shoot` (13 Bilder) | Bogenschuss | **Genau das**: Bogen- und Feuerwaffen-Angriff |
| `hurt` (6 Bilder) | Treffer/Niederschlag | `u.down`-Zustand, `engine.js:2143` |

Damit deckt der Baukasten für Kampf-Disziplinen **exakt** die vier Animationen ab, für die er
entworfen wurde — anders als bei Basketball (Korbleger, Dribbeln) oder Football (Snap,
Passwurf), wo die Bewegungen fantasy-fremd sind und zweckentfremdet werden mussten.

### 2.2 Waffen-Overlays: bereits produktiv, mit Lizenzangaben

Fünf Nahkampf-/Fernkampfwaffen sind heute als eigene Overlay-Ebenen verdrahtet
(`engine.js:2217-2308`), synchron zum Angriffsframe, mit Hinter-/Vordergrund-Trennung
(`_bg`/`_fg`, damit die Waffe hinter dem Körper anfängt und vor ihm endet — dieselbe Technik
wie die Basketball-Recherche für Handpunkte vorschlägt):

| Waffe | Quelle (`public/sprites/baukasten/quellen.json`) | Lizenz | Raster |
|---|---|---|---|
| `schwert` | LPC-Original (`schwertbg_slash`) | LPC-Standard (CC-BY-SA 3.0/GPL 3.0) | 128px, Standard-Slash |
| `axt` | `weapon/blunt/waraxe/attack_slash`, LPC Medieval Weapons (BenCreating/bluecarrot16/castelonia) | CC-BY-SA 3.0/GPL 3.0 | 192px, 6×4 |
| `stab` | `weapon/magic/gnarled/thrust`, LPC More Weapons (bluecarrot16) | OGA-BY 3.0+/GPL 3.0/CC-BY 4.0 | 192px (Thrust-Blatt als Näherung für Slash gelesen) |
| `zweihaender` | `weapon/sword/longsword/attack_slash`, LPC Medieval Fantasy/Extended Weapon Animations (wulax/bluecarrot16) | OGA-BY 3.0/CC-BY-SA 3.0 | 192px, identisches Raster wie `axt` |
| `bogen` | LPC-Original | LPC-Standard | eigene `bogen_shoot`-Ebene |

Dazu drei Feuerwaffen (`public/sprites/waffen/quellen.json`, Skorpio's SciFi Sprite Pack,
CC-BY-SA 3.0/GPL 3.0, `opengameart.org/content/lpc-skorpios-scifi-sprite-pack`): Pistole,
Schrotflinte, Sturmgewehr, je mit eigenem Mündungsfeuer-Overlay (`muendungsfeuer*`), bewusst
in der Hand bleibend statt nur im Angriffsframe (Chris' Vorbild: „ein Soldat legt seine Waffe
nicht ab", `engine.js:2297-2299`).

**Rüstung** läuft nicht über neue Sprite-Blätter, sondern über eine Umfärbe-Rampe
(`RUEST_QUELLEN`/`RUEST_TON`, `engine.js:508-546`) — dieselbe Technik wie die Hautfärbung,
mit „plate" als vorhandener Quelle und einem Helm-Layer (`helm`→
`hat/helmet/greathelm/male/slash.png`).

### 2.3 Was tatsächlich fehlt

1. **Kein disziplinspezifisches Kampfplatz-Bild.** Alle vier Arena-Disziplinen teilen
   `bodenArena()` — ein Sandring mit Fackeln. Für Mini-DM/TDM ist das stimmig (Gladiatorenkampf-
   Ästhetik passt zu „Team Deathmatch"); für Battlefield mit seinen Führungsrollen
   (Commander, Siege Core) wirkt ein enger Sandring dem Namen entgegen — hier wäre die
   billigste sichtbare Verbesserung ein zweites Bodenbild mit den bereits vorhandenen
   `public/sprites/arena/`-Kacheln (`baum_*`, `mauer_ziegel`, `zaun_holz`, `boden_erde`), die
   heute schon im Repo liegen, aber nicht für ein offenes Schlachtfeld statt eines
   umschlossenen Rings kombiniert werden. **Kein neuer Download nötig, nur eine zweite
   Boden-Zeichenfunktion analog zu `bodenBuehne`/`bodenSpurt`.**
2. **Kein Rollen-Icon/visuelles Tell für Commander/Siege Core/Spotter/Morale Anchor.**
   Basketballs Slots unterscheiden sich zumindest durch Spielverhalten (Fastbreak, Clutch
   Shot); Battlefields vier Rollen unterscheiden sich nur in der Matrix, nicht im Bild — ein
   Kämpfer mit hohem Charisma sieht identisch aus wie einer mit hohem Power. Eine Krone/ein
   Befehlsstab für den Commander (`krone`-Layer existiert bereits im Baukasten,
   `engine.js:2292`, aktuell nur für tatsächliche Königsfiguren verdrahtet) wäre die
   billigste sichtbare Rollen-Kennzeichnung — keine neue Asset-Suche, nur eine neue
   Zuordnungsregel (Slot `commander` → `b.krone=true`).
3. **Kein Bodenschatten unter Fernkampf-Projektilen/Feuerwaffen-Blitz** — kleineres Analogon
   zum Basketball-Befund (fehlender Ballschatten, `basketball-finalisierung-recherche-fable.md`
   Abschnitt 3.1), hier aber nicht geprüft, ob es die Lesbarkeit tatsächlich beeinträchtigt
   (Pfeile sind laut Fables Recherche echte Projektile mit Richtung, kein Höhen-Rätsel wie der
   prellende Ball).
4. **Keine eigene Musik-/Ambience-Ebene je Arena-Disziplin** — nicht geprüft, ob Basketball
   hier eine eigene Spur hat (`bkLoop.publikum`, `engine.js:12695 ff.`, basketball-spezifisch)
   und ob ein Äquivalent für die Arena fehlt oder existiert; außerhalb des Auftrags-Fokus
   dieser Recherche.

**Gesamteinschätzung Assets: gering.** Anders als bei Basketball (Ball-Handpunkte fehlen noch
komplett) oder Football (kein Trikot-Layer gefunden) ist die reine Charakterdarstellung für
Kampf bereits vollständig gelöst. Was fehlt, ist ausschließlich **Kontext** (Kampfplatz,
Rollenkennzeichnung) — kosmetisch, ohne neue Lizenzarbeit.

---

## 3. Balancing/Mechanik-Referenz: Zielwahl nach Bedrohung/Eignung, und was Objective-Systeme dazu beitragen

### 3.1 Bedrohungssysteme — Fables Recherche bestätigt, nicht wiederholt

`arena-duell-recherche-fable.md` Abschnitt 1.2 hat das bereits ausführlich recherchiert und
bleibt die Referenz; hier nur die für die Entscheidung in Abschnitt 4 relevante
Zusammenfassung, mit Prüfung, ob sie am aktuellen Code noch trägt:

- **TrinityCore `ThreatManager::ReselectVictim`** (GPL-2.0+): ein Ziel wird nur gewechselt,
  wenn ein anderer Gegner **110 %** seiner Bedrohung hat (in Nahkampfreichweite) bzw. **130 %**
  (außerhalb) — eine Hysterese gegen Ziel-Flattern. **Geprüft, ob unser `u.zielP==="bedrohung"`
  das schon hat:** nein — `engine.js:11425` wählt bei jedem Aufruf stur das aktuelle Maximum
  von `bedrohungVon()` neu, ohne Hysterese-Schwelle. Wer diese Option heute wählt, bekommt
  jeden Tick potenziell ein neues Ziel, sobald ein anderer Gegner knapp mehr Bedrohung
  aufbaut — genau das Flattern, das TrinityCores Regel verhindert.
- **Warzone 2100 `targetAttackWeight`** (GPL-2.0+): additive Gewichtung statt Vergleich
  (Distanz negativ, Restschaden positiv, Kommandeursziel-Bonus) — ein Score statt eines
  Rangs, leichter mit mehreren Faktoren zu kombinieren als eine reine Bedrohungszahl.
- **`bedrohungVon`** existiert im Motor bereits (`dmg + heal*0.6 + ko*120`, laut Fables
  Zitat `engine.js:10401`, aktuelle Zeile verschoben, Funktion inhaltlich unverändert) — die
  Formel selbst ist also da, sie speist nur nicht den Standardpfad.

### 3.2 Neu recherchiert: Objective-/Rollensysteme, weil Battlefield das explizit nahelegt

Die Aufgabe verlangt hier ausdrücklich einen Blick über Fables 1v1/Deathmatch-fokussierte
Vorarbeit hinaus, weil Battlefields vier Rollen (Commander, Spotter, Siege Core, Morale
Anchor) und sein Name auf ein Objective-/Rollensystem zeigen, das TDM/Mini-DM nicht haben:

- **Team Fortress 2 (Valve, proprietär — nur die öffentlich dokumentierte Design-Sprache
  zitierfähig, kein Code)**: die offizielle Rollenteilung ist **Offense/Defense/Support**
  (`wiki.teamfortress.com`), nicht neun gleichwertige Klassen — jede Klasse hat genau eine
  klar identifizierbare Aufgabe statt eines Alles-Könners. Übertragen auf Battlefield: die
  vier Slots haben zwar unterschiedliche Matrix-Gewichte, aber keine unterschiedliche
  **Fähigkeit** (Abschnitt 1.4) — TF2s Lehre wäre, dass die Rolle sich im Verhalten zeigen
  muss, nicht nur im Attributsprofil.
- **Xonotic `sv_domination.qc`** (GPLv2, `github.com/xonotic/xonotic-data.pk3dir`): ein
  Kontrollpunkt-Modus mit zwei zitierfähigen Stellschrauben — `g_domination_point_rate`
  (wie oft ein gehaltener Punkt Team-Punkte gibt; laut Xonotic-Wiki standardmäßig alle 5
  Sekunden 1 Punkt) und `g_domination_point_capturetime` (wie lange die Eroberung eines
  unbesetzten Punktes dauert, Default-Kommentar im Repo 0,1). Das ist die einfachste offene
  Referenzformel für „Sieg durch Halten statt durch Ausschalten" — ein Mechanismus, den
  Battlefield heute nicht hat, TDM/Mini-DM aber auch nicht bräuchten, weil sie sich bewusst
  als reines Deathmatch verstehen (Matrix-Kommentare beider Disziplinen sprechen explizit
  von „schlagen und einstecken", nicht von Gebiet).
- **Unity `FPSSample` `CapturePoint.cs`** (Unity Companion License, nicht klassisch offen,
  nur als Strukturreferenz zitierfähig wie zengm in den vorherigen Fable-Berichten): ein
  Kontrollpunkt als eigene Entität mit eigenem Besitz-Zustand, der pro Tick auswertet, wie
  viele Einheiten jeder Seite in seinem Radius stehen — strukturell näher an unserem
  `reihe`/`ord`-System (räumliche Zonen ohne Meter-Zonen wie Basketball) als an einem harten
  Zonenrechteck.

**Einordnung für uns:** Battlefield hätte mit vertretbarem Aufwand einen echten
Objective-Layer bauen können, WEIL die Rollen (Commander „führt Situationen", Siege Core
„drückt Fronten") bereits dorthin zeigen — aber das wäre eine **Motoränderung**
(ein neuer Sieg-Zustand neben „alle Gegner liegen"), die explizit außerhalb dieses
Recherche-Auftrags liegt. Die realistische, sofort umsetzbare Lehre aus TF2/Xonotic ist
kleiner: **jede Rolle bekommt eine eigene Mikro-Fähigkeit statt nur ein Attributsprofil**
(Abschnitt 4.2, Option C).

### 3.3 Was das für die Wertformel/Balance bedeutet

`beitragVon` ist inzwischen für alle drei Disziplinen identisch (Abschnitt 1.1) — ein
Ansatz, den keines der recherchierten Systeme so fährt: Wesnoths KI-Bewertung
(`attack_analysis::rating`, Fables Zitat) gewichtet `aggression` pro Einheit, TrinityCores
Bedrohung gewichtet Heilung anders als Schaden (0,5 statt 1,0). Für Battlefield mit seinem
Charisma/Intelligence-Schwerpunkt wäre ein rollenspezifischer Bonus im Beitrag (z. B.
Commander bekommt Anteil am Team-Schaden gutgeschrieben, wie ein Assist) näher an der Fiktion
„führt, kämpft aber nicht selbst vorn" — heute zählt für den Commander nur sein eigener
`dmg`/`heal`/`verh`, obwohl sein Slot-Text explizit sagt, dass er über andere wirkt.

---

## 4. Konkrete Vorschläge

### 4.1 Die Zielwahl-Frage — drei Optionen statt einer Wiederholung

**Option A — Bedrohung mit Hysterese als Standard-Persönlichkeitsneigung.**
Die drei „naechster"-Standardpersönlichkeiten (bollwerk, draufgaenger, beschuetzer,
`PERSZIEL`, `engine.js:2857`) wechseln auf `bedrohung`, und `chooseTarget` bekommt eine feste
Wechsel-Schwelle (TrinityCore-Vorbild: neues Ziel nur bei ≥110 % der Bedrohung des aktuellen
Ziels). *Vorteil:* nutzt ausschließlich vorhandene Bausteine (`bedrohungVon`, `PERSZIEL`,
`u.zielP`) — reine Konfiguration plus eine Zeile Hysterese, keine neue Datenstruktur. Hebt
laut Fables Messung direkt den schwächsten Kanal (Gelegenheiten↔Eignung, heute 0,05 im TDM).
*Nachteil:* verändert das Kampfgefühl aller drei Disziplinen gleichzeitig (Fokusfeuer auf den
eignungsstärksten Gegner wird zum Normalfall, nicht mehr zur Ausnahme) — eine spürbare
Änderung, die vor dem Rollout ein eigenes A/B mit `miss-alle-disziplinen.mjs` verdient, nicht
nur eine Rangtreue-Zahl.

**Option B — `cdKuerzung` an Skill koppeln (Tempo beschleunigt den Angriff).**
Der direkteste Hebel (`stand-aller-disziplinen.md` Abschnitt 5a nennt ihn selbst so). *Vorteil:*
ein Kämpfer mit hohem Speed/Dexterity bekäme spürbar mehr Gelegenheiten, unabhängig davon, wen
er trifft — würde `Gelegenheiten je Lebensframe` unmittelbar anheben. *Nachteil:* das ist
exakt die Umkehrung einer **dokumentierten, von Chris selbst getroffenen und im Code zitierten
Design-Entscheidung** (Fund 7, `engine.js:11160-11174`) — und die dort genannte Begründung
(„Eslabongs Klassenkarten kennen keine tempoabhängige Abklingzeit") ist eine
Referenzspiel-Treue-Entscheidung, keine Balance-Frage, die diese Recherche für Chris
vorwegnehmen sollte. **Nur empfehlenswert, wenn Chris die Eslabong-Treue an dieser Stelle
ausdrücklich aufgeben will** — sonst bleibt es bei Option A/C.

**Option C — Reihe/Formation bleibt der Skill-Kanal, Zielwahl bleibt Geometrie.**
Statt die Zielwahl zu ändern, wird konsequent zu Ende geführt, was Battlefields Reihen-Fix
(`f2dcba39`) begonnen hat: die Reihe folgt strikt der Eignung (stärkste Kämpfer vorn, wo
`nearest()` sie zuerst findet) für **alle drei** Disziplinen, plus optional ein Spieler-
Aufstellungswerkzeug (wie bei einem Auto-Battler: der Spieler entscheidet vor dem Kampf, wer
vorn steht). *Vorteil:* null Motoränderung an der Kampf-Logik selbst, nur an der
Slot-Zuordnung — am nächsten an der Auto-Battler-Familie (TFT/Super Auto Pets/Hearthstone
Battlegrounds, Fables Abschnitt 1.2(b)), die laut Fables Recherche „die Rangtreue kommt aus
der Aufstellung, nicht aus dem Motor" bereits so löst. *Nachteil:* gemessen **nicht
ausreichend allein** — Battlefields eigener Reihen-Fix hat die Saison-Validität gehoben
(0,50→0,71), aber die Einzelspiel-Zahl gesenkt (0,470, Abschnitt 0) und bleibt unter der
Schranke; Fables eigene Analyse (Abschnitt 2.3 dort) zeigt, dass Reihe 0 nur moderat mehr
Gelegenheiten bekommt (1,07 gegen 0,77 Angreifer je Lebensframe) — ein kleinerer Hebel als
eine echte Bedrohungszielwahl.

**Empfehlung:** **A vor C, B nur auf Chris' ausdrücklichen Wunsch.** A und C schließen sich
nicht aus — A ist der stärkere Hebel laut Fables gemessenen Korrelationen, C ist die
risikoärmere Ergänzung, die bereits zur Hälfte umgesetzt ist (Battlefield hat seinen
Reihen-Fix, TDM/Mini-DM stehen mit ihrer bestehenden Slot-Reihenfolge de facto schon nah an
Option C). B bleibt explizit Chris' Entscheidung, mit dem vollen Zitat aus Fund 7 als
Kontext, nicht als Vorentscheidung dieser Recherche.

### 4.2 Die Skalenfrage — Battlefield ist thematisch groß, nicht numerisch

Wie Fund 3 zeigt, sind Mini-DM und Battlefield beide 4v4; nur TDM ist mit 6v6 größer. Drei
Optionen, wie die drei Disziplinen sich trotzdem unterscheidbar anfühlen sollen:

**Option 1 — Kopfzahl unverändert lassen, Rollen tragen den Unterschied.** `jeSeiteVon`
(`engine.js:3623`) liest `ARENA_ART[d].jeSeite` je Disziplin — eine reine Konfigurationszahl,
keine Architekturgrenze. Das spricht dafür, dass eine Änderung technisch billig wäre, macht
sie aber balance-seitig nicht automatisch richtig: Battlefields vier Führungsrollen brauchen
keine zwölf Körper, um sich wie ein Feldherren-Duell anzufühlen — sie brauchen die in
Abschnitt 3.2 vorgeschlagene rollenspezifische Mikro-Fähigkeit (Commander gibt Teamboni statt
selbst zu kämpfen, Siege Core hat höheren Basisschaden gegen die feindliche Front). *Aufwand:
gering* (Motoränderung an `beitragVon`/Skill-Zuweisung je Slot, keine neue Kopfzahl).

**Option 2 — `jeSeite` für Battlefield tatsächlich erhöhen** (z. B. auf 6 oder 8, wie TDM oder
darüber). *Vorteil:* macht „Battlefield ist die größte Schlacht" wörtlich wahr, ohne neue
Architektur (die Zahl ist Konfiguration). *Nachteil:* mehr Kämpfer bedeutet mehr Rechenlast
im ohnehin ungetesteten Live-Boxscore-Pfad, und die Slot-Liste (`SLOTS_JE_DISC.battlefield`,
vier Einträge) müsste um weitere Rollen wachsen — das ist keine Konfigurationsänderung mehr,
sondern eine neue Rezeptrunde (Sinkhorn-Ausgleich über eine größere `ERLAUBT`-Tabelle,
analog zu `hockey-rollout-plan.md` Teil B).

**Option 3 — Ein echter Objective-Layer für Battlefield, TDM/Mini-DM bleiben reines
Deathmatch.** Aufbauend auf Abschnitt 3.2 (Xonotic-Vorbild): ein Kontrollpunkt oder eine
Frontlinie, die sich verschiebt, je nachdem welche Seite mehr Bedrohung in ihrer Nähe hat —
das würde den Commander/Siege-Core-Rollen zum ersten Mal eine **mechanische** (nicht nur
attributive) Daseinsberechtigung geben. *Aufwand: hoch* — das ist eine Motoränderung
(neuer Sieg-Zustand, neue Zeichenebene für den Kontrollpunkt) und liegt damit außerhalb
dessen, was diese Recherche vorwegnehmen soll; hier nur als Diskussionsgrundlage vermerkt,
weil die Aufgabe ausdrücklich nach der „Battlefield ist am größten mit Rollen wie
Commander/Siege-Core"-These fragt und die ehrliche Antwort ist: **die Rollen sind da, das
Objective, das sie rechtfertigen würde, ist es nicht.**

**Empfehlung:** **Option 1 zuerst** (billig, sofort spürbar, keine Rezeptrunde nötig), Option
3 als das eigentliche „Battlefield wird zu Battlefield"-Ziel für eine spätere, größere Runde,
Option 2 nur falls Chris ausdrücklich mehr Körper auf dem Feld will, unabhängig von der
Rollenfrage.

---

## 5. Prioritäten und Aufwandsschätzung

1. **Assets: Rollenkennzeichnung (Krone für Commander) + zweites Bodenbild für Battlefield.**
   Aufwand: **sehr gering** — beide Assets liegen vor (`krone`-Layer, `public/sprites/arena/`-
   Kacheln), reine Verdrahtung. Verbessert sofort die Unterscheidbarkeit von Battlefield
   gegenüber Mini-DM/TDM, unabhängig von jeder Mechanik-Entscheidung.
2. **Zielwahl Option A (Bedrohung + Hysterese als Standard) messen.** Aufwand: **gering bis
   mittel** — eine Konfigurationsänderung (`PERSZIEL`) plus eine kleine Ergänzung an
   `chooseTarget` (Hysterese-Schwelle), aber verlangt eine eigene Vorher/Nachher-Messung mit
   `miss-alle-disziplinen.mjs` über alle drei Disziplinen UND Fechten (das dieselbe
   `chooseTarget`-Funktion teilt), weil eine Änderung an einer gemeinsamen Funktion nie nur
   eine Disziplin trifft. **Größter Hebel laut den in Fables Vorarbeit gemessenen
   Korrelationen.**
3. **`kurve:`-Datenblock für die Arena einführen**, analog zu `FELDSPIEL_ART[d].kurve`
   (`hockey-eigene-erfolgskurve.md` als Vorbild für die Struktur, nicht für die Zahlen).
   Aufwand: **mittel** — erfordert erst eine Sondierung, welche Konstanten in `treffer()`/
   `angFaktor` heute hart im Motor stecken, dann deren Auslagerung als Daten je Disziplin.
   Voraussetzung für jede zukünftige eigene Kalibrierrunde der drei Disziplinen.
4. **Option 1 der Skalenfrage (rollenspezifische Mikro-Fähigkeit für Battlefield).** Aufwand:
   **gering bis mittel** — Änderung an `beitragVon`/Skill-Zuweisung je Slot, keine neue
   Architektur, aber eine eigene Balance-Runde (Commander-Bonus darf TDM/Mini-DM nicht
   beeinflussen, weil sie dieselbe Wertformel nutzen).
5. **Live-Migration (Boxscore erreicht den echten Spielstand).** Aufwand: **hoch**, aber wie
   bei Football/Hockey der einzige Schritt, der die gesamte Rangtreue-Arbeit für Chris
   überhaupt sichtbar macht (`projekt-ueberwachung-opus.md` Abschnitt 1.4) — **nicht** vor den
   Schritten 1-3 sinnvoll, weil ein Rezept-Feintuning auf einem noch wechselnden Motor
   wertlos wird, sobald migriert wird (dieselbe Reihenfolge-Regel wie im Football-Plan: erst
   Mechanik, dann Rezept, nie umgekehrt).
6. **Objective-Layer für Battlefield (Skalenfrage Option 3).** Aufwand: **hoch** — echte
   Motoränderung, eigener Sieg-Zustand, eigene Zeichenebene. Der einzige Punkt dieser Liste,
   der Battlefields Namen und Rollen tatsächlich einlöst, aber explizit **nicht** Teil dieses
   Recherche-Auftrags und erst nach Schritt 5 sinnvoll (dieselbe Live-vor-Rezept-Regel).

---

## 6. Was ich nicht geprüft habe

- Ob die Battlefield-Rollen (Commander/Spotter/Siege Core/Morale Anchor) inhaltlich zu den
  vier Slots aus `stand-aller-disziplinen.md` Abschnitt 5a passen, die dort schon als „nachzumessen"
  markiert waren, bevor der Reihen-Fix kam — mein Wert oben (0,470/0,714) ist die aktuelle,
  bereits reparierte Zahl, aber ich habe keine eigene Kaderrobustheits-Sonde
  (`projekt-ueberwachung-opus.md` Abschnitt 1.3) für diese drei Disziplinen gefahren; die
  dortige Warnung („nur Basketball und Speed-Schach sind kaderrobust") gilt vermutlich auch
  hier, ist aber nicht mit einer eigenen Zahl belegt.
- Star-auf-Rang-1/Paartreue-mit-Abstand (CLAUDE.md, „die ehrlichere Abnahme") für den
  aktuellen, reparierten Code-Stand — Fables Zahlen dazu (Abschnitt 2.6 seines Berichts)
  stammen nachweislich von **vor** dem Wertformel-Fix und dem Battlefield-Reihen-Fix
  (Commit-Reihenfolge in Abschnitt 0, Fund 2) und sind damit für den heutigen Stand nicht
  mehr zuverlässig zitierfähig — eine eigene Sonde dafür habe ich im Rahmen dieser Recherche
  nicht gebaut.
- Ob `zieheFormkarten`/`zieheMutatoren` im Live-Pfad (nicht im Mockup-Messfenster) dieselbe
  LCG-Verzerrung tragen, die Fable für das Messfenster fand — außerhalb des Auftrags.
- Musik-/Sound-Ebenen je Arena-Disziplin (Abschnitt 2.3, Punkt 4).
- Wie genau eine künftige `kurve:`-Struktur für Kampf-Erfolg/-Schaden aussehen müsste — das
  ist bewusst eine Frage für die eigentliche Bau-Runde, keine, die diese Recherche
  vorwegnehmen sollte (dieselbe Zurückhaltung wie beim Football-Plan Teil B.4 für dessen
  Yards-Verteilung).
- Ob ein echtes Trefferquoten-Referenzsystem für Nahkampf (anders als NBA-Tracking-Daten)
  irgendwo offen vorliegt — die in Abschnitt 3 zitierten Systeme (Wesnoth, DCSS, Battle
  Brothers) sind Spielmechaniken, keine realen Kampfsport-Studien; Fable hat für Fechten
  bereits reale Studien gefunden (PLOS One 2023 u. a.), die aber strukturell zu einem
  Einzelduell gehören, nicht zu einem 4v4/6v6-Getümmel.

---

## Anhang: Quellenliste

**Selbst gemessen** (dieser Stand, `c75072ff`):
- `node scripts/miss-alle-disziplinen.mjs 24 mini-dm tdm battlefield` — Abschnitt 0, Fund 1.
- Code-Lesung `public/mockups/battle-mode.engine.js`: `ARENA_ART` (3501-3620), `SLOTS_JE_DISC`
  (2960-3113), `SLOT_ZUSATZ` (3125-3155), `chooseTarget` (11361-11449), `PERS`/`PERSZIEL`
  (2840-2865), `beitragVon` (12365), `cdKuerzung`-Kommentar (11160-11174), Kampfrenderer
  (2130-2320), `RUEST_QUELLEN` (508 ff.), `bodenArena` (12717 ff.), `zuordneDeckung` (5636
  ff.), `kurve`-Fallback (4385).
- `public/sprites/baukasten/quellen.json`, `public/sprites/waffen/quellen.json`,
  `public/sprites/arena/` (Verzeichnislisting) — Abschnitt 2.
- `git log` zur Reihenfolge von Wertformel-Fix (`7013d40e`, `82a94988`), Battlefield-Reihen-Fix
  (`f2dcba39`), Zielansage-PR (`73acbf69`) relativ zu `arena-duell-recherche-fable.md`
  (hinzugefügt in/vor `661268b6`) — Abschnitt 0, Fund 2, und Anhang-Hinweis in Abschnitt 6.

**Bereits von Fable recherchiert, hier geprüft und weiterverwendet** (nicht neu abgerufen):
`docs/design/arena-duell-recherche-fable.md` — TrinityCore `ThreatManager`, Warzone 2100
`targetAttackWeight`, WoW-Bedrohungsregel, Wesnoth `attack.cpp`, alle mit Lizenzangaben dort.

**Neu abgerufen** (Websuche, Zahlen/Zitate wörtlich aus der Quelle):
- `github.com/xonotic/xonotic-data.pk3dir`, `qcsrc/common/gametypes/gametype/domination/
  sv_domination.qc` und `gametypes-server.cfg` — GitHub-Code-Suche, Cvar-Namen
  `g_domination_point_rate`/`g_domination_point_capturetime` bestätigt; GPLv2 (Xonotic-Projekt).
- `github.com/xonotic/xonotic/wiki/Domination` — Standardwerte (1 Punkt/5 s, Sieglimit 50).
- `github.com/Unity-Technologies/FPSSample`, `CapturePoint.cs` — als Strukturreferenz
  gefunden, Unity Companion License (nicht klassisch offen, nur Lesen/Zitieren wie bei zengm
  in früheren Fable-Berichten).
- `wiki.teamfortress.com/wiki/Team_strategy` — offizielle Offense/Defense/Support-Rollenteilung
  (Valve, proprietäres Spiel, nur die öffentlich dokumentierte Design-Sprache zitiert, kein
  Code).

**Nicht verwendbar/nicht weiterverfolgt:** eine gezielte Suche nach einem offenen
MOBA-Balance-Dokument mit Zahlen (anders als die bereits in Fables Vorarbeit zitierten
Auto-Battler-Papers) ergab keinen neuen, zitierfähigen Treffer über die in Abschnitt 3.2
genannten drei Systeme hinaus — hier ehrlich als Lücke vermerkt statt mit einer schwachen
Zweitquelle aufgefüllt.
