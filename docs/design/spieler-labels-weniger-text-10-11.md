# Über den Spielern: Name reicht, Gedanken bei Zustandswechseln (Fable/Opus, 10.11.)

Auftrag, Chris wörtlich (10.11.): „schau mal dass nicht so viele permanente Beschreibungen
auftauchen über den Spielern. Name reicht und evtl. ggf. die Gedanken bei Status Change oder so,
zb erschöpft etc, frag mal fable was da gut funktioniert. Auf jeden Fall weniger Text und nur
gezielt Icons etc, muss aber verständlich und transparent sein."

**Reine Design-Recherche.** Kein Code geändert, nichts gemessen, kein Bild gemacht. Alles unten
stammt aus dem Lesen von `public/mockups/battle-mode.engine.js`. Gelesen wurden:

| Stand | Commit / Branch | wofür |
|---|---|---|
| `origin/main` | `972b970cb` | Zeilennummern ohne Zusatz beziehen sich hierauf |
| HYROX-Halle | `claude/spurt-hyrox-routen-design-0911` | Zonenschilder, Rangleiste, Läufer-Etiketten in der Halle |
| Hatz | `claude/spurt-format-hatz-0811` | Fegearm, Läufer-Etiketten |
| Climbing | `claude/kulissen-qs-climbing-0811` | die Text-Aufrufe sind dort identisch mit `main`, die Kletterstile stammen aus dem gemeinsamen Bahn-Etikett |

**Rahmen (CLAUDE.md, bindend).** Alles hier ist **Klasse A**, also reine Anzeige. Nichts davon
berührt `rr()`, `wert()`, `bahnRangliste()`, die Matrix oder die Sendedauer. Pflicht für jeden
Bau-PR bleibt `scripts/pruefe-wertung-fingerabdruck.mjs` byte-identisch. **PixelLab wird nicht
gebraucht:** Die Icons sind kleine, prozedural gezeichnete Primitive im selben Muster wie die
I-Spy-Möbel (`ispyZeichneTruhe` u. a.), also weder Figur noch Animation noch bestellte
Requisite. Gemergt wird von Chris.

Zur Einordnung: `alle-diszis-top-niveau-fahrplan-09-11.md` (Branch
`claude/alle-diszis-fahrplan-0911`) plant mit **B1** eine generische Bahn-Rangleiste im Bild (A6,
A7, A9). Dieses Papier setzt darauf auf. Sobald die Leiste sagt, wer führt und wer wo steht, muss
das nicht mehr als Text an jeder Figur hängen. Den Vorläufer aller Kopf-Ikonen gibt es schon:
**Q8** in `fable-konzept-chris-feedback-13-10.md` Abschnitt 3.8. Dort wurde er nur für I-Spy gebaut
(`ispySprechblase`, `:30484`). Was hier steht, ist der Ausbau von Q8 zu einem Vokabular für alle
Chassis.

---

## 0. Kurzfassung

1. **Das Problem sitzt fast vollständig im Bahn-Chassis.** `zeichneSpurt()` (`:50022`) zeichnet
   über **jedem** Läufer zwei Textzeilen: den Namen (y−30) und darüber den Rennplan (y−40) mit dem
   Zusatz „· Sog", „· leer" oder „◂ neu". Das gilt für alle sieben Bahnformate: Spurt klassisch,
   Hatz, HYROX, Time-Trial, Climbing, Staffel und Takeshi. Takeshi hängt rechts daneben eine
   dritte, laufende Zahl „★ 3,5" an. Bei 12 Läufern sind das 24 Textzeilen im Bild, bei Takeshi
   36, im Takeshi-Pod mit 24 Läufern 72. Die Bühnen sind sparsamer, aber nicht frei davon (Eis,
   I-Spy, Heben, Breaking, Schach, Tennis). Feldspiel und Arena sind schon schlank. **Das
   Feldspiel ist das Vorbild:** Namen erscheinen dort nur in Ballnähe (`NAME_NAH_RADIUS`, `:17597`).
2. **Ein harter Befund: In HYROX und in der Hatz ist das Plan-Etikett falsch, nicht nur
   überflüssig.** `stepSpurtHyrox()`, `hyroxScore()`, `stepSpurtHatz()` und `hatzWelleScore()`
   lesen weder `u.plan` noch `u.tempo`, `u.sucht` oder `u.reserve` (Abschnitt 1.2). Über jedem
   Läufer steht trotzdem „Windschatten" oder „Schlusssprint", und unter ihm hängt eine
   Puste-Leiste, die nie sinkt. Die Rennplan-Ansage lässt sich dort anklicken und bewirkt nichts.
   Weil HYROX nach E1 der 1. Spurt-Durchgang jeder Saison wird, sollte das vor dem Rollout weg.
3. **Die Regel:** Dauerhaft steht über einer Figur **nur der Name**. Daneben, auf derselben Zeile,
   steht **höchstens eine** kleine Kopf-Ikone, und nur solange ein Ausnahmezustand gilt (leer,
   gefährdet, raus, an der Station …). Ein Zustand**wechsel** löst eine **Gedankenblase** aus,
   Icon plus **ein** Wort, 1,8 Sekunden lang. Danach bleibt nur das Icon. Wer gerade fokussiert
   ist, behält das volle Etikett.
4. **Das Vokabular hat zwölf Icons** (Abschnitt 4). Sie gelten disziplinübergreifend, sind aus
   Form **und** Farbe lesbar und stammen aus Farben, die der Motor schon führt (Puste-Ampel,
   Nerven-Lila, Sog-Blau, Gold der Sterne). Emoji sind nicht vorgesehen. Die eine Ausnahme heute,
   die 👑-Krone in Breaking, wird gezeichnet.
5. **Der Zielkonflikt „verständlich“ gegen „weniger Text“ löst sich über die Reihenfolge, nicht
   über einen Kompromiss:** beim Eintritt eines Zustands das Wort (und beim ersten Auftreten in
   einer Sendung länger), solange der Zustand gilt das Icon, danach nichts. Details gibt es auf
   Anfrage über Fokus, Hover und Kaderleiste. Der Ticker behält die ganzen Sätze. Ein Icon
   erscheint also nie, ohne dass sein Wort kurz davor im Bild stand.
6. **Bau in drei kleinen PRs** (Abschnitt 7): L1 Bahn mit dem größten Gewinn, L2 Bühnen, L3 Arena
   und Breaking. Dazu L0, das HYROX/Hatz-Etikett, als Sofortkorrektur vor allem anderen.

---

## 1. Inventur: Was steht heute dauerhaft an einer Figur?

„Dauerhaft“ heißt hier: wird in jedem Bild gezeichnet, solange eine Bedingung gilt, die sich selten
ändert (läuft noch, ist im Ziel, hat diese Rolle). Schwebetexte (`schwebe()`, verblassen von selbst)
und kurz gesetzte Anzeigen wie die Zwischenzeit-Tafel `vizZzFlash` zählen nicht dazu. Sie sind
schon heute die Art Hinweis, die Chris will.

### 1.1 Bahn-Chassis — `zeichneSpurt()` (`:50022`), gilt für alle sieben Bahnformate

| # | Was | Wo (main) | Wann sichtbar | Formate | Braucht der Zuschauer das dauerhaft? |
|---|---|---|---|---|---|
| B1 | **Name** in Teamfarbe | `:50432–50434`, y−30 | immer | alle | **Ja.** Identität. |
| B2 | **Rennplan-Wort** | `:50443–50452`, y−40 | solange er läuft | alle; Wörter je Format: Spurt/Hatz/HYROX „Von vorn / Windschatten / Schlusssprint" (`:44871ff.`), Time-Trial „Gleichmaß / Negativ-Split / Attacke" (`:45146ff.`), Climbing „Sparsam / Stetig / Durchziehen" (`:45490ff.`), Staffel „Halten / Angehen / Schlussmann" (`:45634ff.`), Takeshi „Vorsichtig / Beherzt / Kopf voran" (`:45977ff.`) | **Nein.** Der Plan ist eine Managerentscheidung. Für das eigene Team steht er in der Rennplan-Zeile (`renderRennplanZeile`, `:52818`), für fremde Läufer ist er Hintergrundwissen. Interessant ist er nur in dem Moment, in dem er **wechselt** oder **greift** (Antritt bei `u.ab`). |
| B3 | Zusatz „· Sog" (blau) | `:50447` | solange `u.imSchatten` | Spurt klassisch, Staffel | **Nein, und doppelt:** Der Sog-Keil hinter der Figur (`:50346–50354`) zeigt dasselbe grafisch. |
| B4 | Zusatz „· leer" (rot) | `:50447` | solange `u.leer` | alle mit Puste | **Teilweise.** Der Zustand ist wichtig und erklärt, warum jemand langsamer wird. Er ist aber ein Ausnahmezustand, also ein Fall für ein Icon. Der Eintritt wird heute schon als Schwebetext „eingebrochen" gemeldet (`:48276`). |
| B5 | Zusatz „◂ neu" (lila, fett) | `:50444`, `ANSAGE_NACHLEUCHTEN=1.4` (`:48019`) | 1,4 **Rennsekunden** nach `planWechsel()` | alle | Der richtige Gedanke, aber falsch getaktet. Die Dauer läuft in `rennT`, und `ZEIT_DEHNUNG` (`:51787`) streckt die Rennsekunde je Format verschieden (Spurt 11,14, Takeshi 2,17). Rechnerisch leuchtet „neu“ im Spurt also rund fünfmal so lange wie in Takeshi. Nicht im Bild nachgemessen. |
| B6 | **„★ 3,5“ Burgpunkte**, laufend | `:50456–50466`, rechts neben der Figur | solange er läuft | Takeshi | **Nein.** Nach E3 ist Takeshi teamzentriert. Die Summe steht im Burgpunkte-Band unten (`:43751`). Am Läufer interessiert nur der **Zuwachs** an einer Falle, also ein Ereignis. |
| B7 | „✕ Raus" | `:50472–50476` | ab dem Ausscheiden | Takeshi-Route, Hatz | **Ja als Zustand, nein als Wort.** Die Figur ist schon gedimmt und entsättigt. Ein ✕ ohne Wort genügt. |
| B8 | „Platz n · Zeit (· ★ x)" | `:50490–50497` | ab dem Ziel | gerade Bahnen (nicht Route/Halle) | **Platz ja, Zeit nein.** Die Zeit steht in der Wertungstabelle und künftig in B1. Eine Platz-Plakette mit Zahl reicht. |
| B9 | „HOT SEAT · Zeit" | `:50490` | Bestzeithalter im Ziel | Time-Trial | **Ja.** Das ist ein bewusster Sendemoment für eine einzige Person und kein Dauerlabel für alle. Bleibt. |
| B10 | „Start in 0:12" | `:50407–50413` | bis zur Startzeit | Time-Trial | **Nur für den Nächsten.** Heute haben alle Wartenden den Countdown, also bis zu elf Uhren im Bild. |
| B11 | Puste-Leiste (Grafik) | `:50367–50386` | solange er läuft | alle | **Ja**, ist aber kein Text. Name und Farben sind Chris' Entscheidung vom 13.09. („Eine Leiste, drei Chassis"). Bleibt (Option in 5.3). |
| B12 | Nerven-Leiste (Grafik, pulsiert unter 25 %) | `:50393–50400` | solange er läuft | Takeshi | **Ja**, kein Text. Bleibt. |

Was am Bahn-Chassis **schon richtig** ist: Die Ereignisse „bricht ein", „eingebrochen", „fängt
sich", „im Gedränge", „Hand öffnet sich", „rutscht ab", „JOKER" … laufen als Schwebetext über
`schwebe()` (`:48153–48776`) und werden am Läufer verankert (`:50636–50695`). Das sind die
„Gedanken", die Chris meint. Sie sind nur noch Text ohne Icon, und sie konkurrieren mit zwei
Dauerzeilen um denselben Platz. Der Kommentar bei `:50664` sagt es selbst: „Ueber dem Kopf ist die
Spalte voll (Name y-30, Plan y-40)".

**Formatspezifisch dazu:**

| Format | Was | Wo | Urteil |
|---|---|---|---|
| HYROX-Halle | Zonenschilder „TECHNIK / KLETTERN / KRAFT" in Gruppenfarbe, in Weltkoordinaten | Branch `:49036–49068` | Das sind **Ortsschilder**, keine Spieler-Etiketten. Trotzdem nennt Chris sie, sie zählen also optisch mit. Sie werden ein Piktogramm in Gruppenfarbe ohne Wort, denn das Wort steht schon in der Kopfzeile der Rangleiste (`:49132`). |
| HYROX-Halle | Stationsnamen „HÜRDE / BALKEN / …" ab Zoom 1,6 | Branch `:49071–49077` | Bleiben. Sie sind klein, erscheinen nur in der Nahkamera und erklären das Requisit. |
| HYROX | Rangleiste, Statusspalte „TECH / KLET / KRAFT / L1–L3 / ✓" | Branch `:49141–49162` | „TECH / KLET / KRAFT“ wird **dasselbe Piktogramm** wie am Läufer und am Zonenschild. Ein Zeichen an drei Orten. |
| Hatz | „FEGEARM" bzw. „ENDSPURT" über dem Arm | Branch `:48356` | Kein Spieler-Etikett. „ENDSPURT“ ist ein Ansage-Moment und bleibt. „FEGEARM“ nur in der ersten Welle (siehe 6.2). |
| Climbing | Paarband „+2 / = / −1" oben, „TOP 0:41" an der Lampe, „Exe 2 · +0,8 s" (verblasst nach `EXE_SPLIT_DAUER`) | `:44407–44464` | Anzeigetafeln, keine Etiketten. Bleiben. |

### 1.2 Befund: In HYROX und Hatz zeigt das Etikett Dinge, die es dort nicht gibt

Beide Formate gehen in `stepSpurt()` sofort in ihren eigenen Schritt (`if(bahnHatzAktiv){
stepSpurtHatz(dt); return; }`, HYROX ebenso, Branch `:49170f.`). Dort wird gelesen:

- **HYROX:** `hyroxScore()` (Branch `:48751`) setzt sich aus ANTRITT, ENDTEMPO, TECHNIK,
  WENDIGKEIT, ROBUST, WUCHT und STEHEN zusammen, plus Rauschen. `stepSpurtHyrox()` (`:48989`)
  setzt `u.pos=rennT/z`. **Kein** Zugriff auf `u.plan`, `u.tempo`, `u.sucht` oder `u.ab`, und
  `u.reserve` wird nie verringert.
- **Hatz:** `hatzWelleScore()` (Hatz-Branch `:48243`) und `stepSpurtHatz()` (`:48285`) arbeiten
  nach demselben Muster. Kein Plan, keine Reserve, kein `imSchatten`.

Gezeichnet wird trotzdem der gemeinsame Etikettenblock (HYROX-Branch `:51597–51617`). Über jedem
Läufer steht also dauerhaft „Von vorn", „Windschatten" oder „Schlusssprint", und darunter liegt
eine Puste-Leiste, die immer voll grün bleibt. `rennplanMoeglich()` (`:53946`) prüft nur
`istBahn(disc)` und bietet deshalb auch hier die Ansage-Knöpfe an, die nichts bewirken.

**Das ist schlimmer als zu viel Text: Es ist eine falsche Erklärung.** Ein Zuschauer, der
„Windschatten" liest, sucht im HYROX-Hallenlauf einen Sog, den es nicht gibt. Ein Manager, der
„Schlusssprint" ansagt, glaubt, etwas zu steuern. Weil HYROX nach E1 jede Saison im 1. Durchgang
läuft, gehört die Korrektur vor den Rollout (L0 in Abschnitt 7). Ob HYROX und Hatz **eigene**
Pläne bekommen sollen, die dann auch wirken, ist eine Wertungsfrage (Strang M bzw. Chris) und
nicht Teil dieses Papiers. Bis dahin gilt: kein Plan-Etikett, keine Puste-Leiste, keine
Ansage-Knöpfe in Formaten, deren Schritt sie nicht liest.

Einen Nebenbefund gibt es noch in denselben Zeilen: Die HYROX-Gruppenfarben (Branch `:49037`)
sind für Technik `rgba(69,176,201)` = `--away` `#45B0C9` und für Klettern `rgba(242,160,61)` =
`--home` `#F2A03D`, also **genau die beiden Teamfarben**. Für Zonenschilder geht das noch. Für ein
Icon direkt neben einem Namen, der selbst in Teamfarbe steht, geht es nicht. Siehe 4.2.

### 1.3 Bühnen

| Disziplin | Dauerhaft an der Figur (zusätzlich zum Namen) | Wo | Urteil |
|---|---|---|---|
| **Eiskunstlauf** | Vorname + „12 Pkt“ + Punktsäule + „3/5“, für **jeden** Läufer auf dem Eis | `zeichneDuett` `:34340–34346` | Zu viel. Die Zwischenstand-Tafel `zeichneEisStand` trägt Punkte und Fortschritt schon geordnet. Schon vorbildlich: Programmtitel und Stimmung erscheinen nur zu Kürbeginn und blenden aus (`:34371–34382`). Genau dieses Muster wird zur Regel. |
| **I-Spy** | „Pkt“ + „3/8“; dazu eine Sprechblase je Phase (Skill-Kürzel / → / …) | `zeichneSchatzsuche` `:32438–32442`, `:32388–32393` | „Pkt“ und „n/N“ weg, sie gehören in die „Top 3 bisher"-Ecke (Fahrplan A11). Die Sprechblase **ist** das Muster dieses Papiers. Sie wird nur ans gemeinsame Vokabular angeschlossen (Lupe statt Kürzel-Text, siehe 4). |
| **Gewichtheben** | „Zweikampf 212 kg“ + sechs Versuchskästen | `zeichneHeben` `:35071–35072` ff. | Die **Kästen bleiben**. Sie sind die IWF-Anzeigetafel, also Information und kein Etikett. Die Wortzeile „Zweikampf …“ wird zur Zahl über den Kästen („212“). |
| **Breaking** | „ERTRÄGT“ / „PEINIGT“ über dem Namen, 👑 für den Führenden | `zeichneBreaking` `:36431–36437` | Die Rolle steht schon in Worten in den Seitentafeln (`:36467`). An der Figur reicht das Rollen-Icon. Die Krone wird gezeichnet statt als Emoji gesetzt. |
| **Speed-Schach** | „Weiß · 12 Pkt“ + Spielerkachel | `zeichneSchach` `:35865–35866` | „Weiß/Schwarz“ sieht man am Brett. „Pkt“ steht in der Wertung. Name und Kachel reichen. |
| **Tennis** | „+3 Punkt“ unter **beiden** Spielern + Kachel (große Ansicht) | `zeichneTennis` `:31825–31831` | Der Abstand ist eine Paargröße. Er steht unter beiden Spielern, einmal mit Plus und einmal mit Minus. Einmal in der Mitte genügt (wie das Climbing-Paarband). |
| **Fechten** | nur der Name, nur in der großen Ansicht | `:32186–32187` | Schon schlank. Bleibt. |
| **Showcase** | Act-Schild + Pkt + Säule + „n/N“, nur am **aktiven** Künstler | `zeichneShowcase` `:33692–33719` | Bleibt. Es geht um eine einzige Figur, und das Act-Schild ist ihre Nummer, kein Zustand. „n/N“ kann weg. |
| **Wettessen** | Zähltafel + Namenschip | `:32861–32862` | Bleibt. Die Tafel **ist** die Wertung (Nathan's-Vorbild, K1). |
| **Sandsack-Rennen** | Name unter dem Träger + Puste-Ring am Kopf | `:24755`, `sandsackVizPusteRing` `:23741` | Bleibt. Der Puste-Ring ist sogar ein gutes Vorbild für ein „Zustand am Kopf als Grafik“. |
| Generischer Bühnenzweig | Name + Pkt/Vorteil + „n/N“ | `:31373–31406` | Laut eigenem Kommentar heute von keiner Disziplin mehr benutzt. Nicht anfassen. |

### 1.4 Feldspiel, Arena, Pods

| Chassis | Dauerhaft | Wo | Urteil |
|---|---|---|---|
| **Feldspiel** (Basketball, Hockey, Football) | Name **nur** am Ballführer, in `NAME_NAH_RADIUS` (62 px) und am Fokus-Gegner; im Knäuel höchstens 4 Namen plus „+n weitere“ (`KNAEUEL_MAX_NAMEN`, `:17624`); Puste-Leiste; Strafbank-Kasten | `:17790`, `:17828` | **Vorbild.** Seit Chris' Fund vom 29.08. steht keine Box-Score-Zeile mehr am Spieler (`:17791`). Nichts zu tun. |
| **Arena-Kampf** (TDM, Mini-DM, Battlefield) | Name; „HEILER“ dauerhaft bei Heilern; Befehl nur bei Hover/Fokus (`kampfHoverId`, `:39595`); HP/MP/SP-Leisten | `:51040–51047` | Fast schlank. „HEILER“ ist eine **Rolle** und damit Identität. Sie wird zum grünen Kreuz-Icon. Das Hover-Muster ist die Vorlage für „Details auf Anfrage“. |
| **Battlefield-Flaggen** | „Burgtor — Team Rot“ unter jedem Punkt | `:43324` | Kein Spieler-Etikett. Außerhalb dieses Auftrags. |
| **Pods** (Vier-Ecken-Szene) | Eckschild mit Name, Team und HP | `schild()` `:54913ff.` | Ein Tafelkasten am Rand, nicht über dem Kopf. Bleibt. |

### 1.5 Zählung

Über **12 Zeichenzweige** verteilt gibt es **15 Arten dauerhafter Zusatztexte** an Figuren: B2 bis
B8 und B10 aus der Bahn (8), dazu Eis, I-Spy, Heben, Breaking, Schach, Tennis und Arena-„HEILER“
(7). Wie viel davon gleichzeitig im Bild steht, hängt fast nur an der Bahn:

| Szene | Textzeilen über Figuren heute | Nach diesem Papier (Regelfall) |
|---|---:|---:|
| Spurt / Hatz / HYROX / Climbing, 12 Läufer | 24 | 12 Namen + höchstens 3 Gedanken |
| Takeshi Duell, 12 Läufer | 36 (Name, Plan, ★) | 12 + höchstens 3 |
| Takeshi Pod, 24 Läufer | 72 | 24 + höchstens 3 |
| Time-Trial vor dem Start, 12 Wartende | bis zu 36 (Name, Plan, Countdown) | 12 + 1 Countdown |
| Eiskunstlauf, 6–8 auf dem Eis | 24–32 | 6–8 |

---

## 2. Zwei Kategorien: Was bleibt, was wird ein Hinweis

**Der Prüfsatz für jede Zeile:** *Muss ich das wissen, um die Figur zu erkennen, und kann ich es
nirgends sonst ablesen?* Nur wenn beides zutrifft, bleibt es dauerhaft. Alles andere zeigt der
**Wechsel** (Gedanke), der **Ausnahmezustand** (Icon) oder die **Anfrage** (Fokus, Hover,
Kaderleiste).

| Kategorie | Inhalt | Form |
|---|---|---|
| **A — dauerhaft** | Name. Bei Rollen, die die Figur ausmachen, ein Rollen-Icon (Arena-Heiler, Breaking-Rolle). Anzeigetafeln, die die Wertung **sind** (Heben-Kästen, Wettessen-Zähler, Showcase-Schild am aktiven Act, Hot Seat). | Text bzw. Tafel wie heute |
| **B — solange der Ausnahmezustand gilt** | leer/erschöpft, gefährdet, raus, im Ziel (Platz), an einer Station arbeitend, wartet auf Start (nur der Nächste) | **eine** Kopf-Ikone rechts neben dem Namen, kein Wort |
| **C — nur beim Wechsel** | Plan gewechselt, greift an (Antritt am Planpunkt), eingebrochen, fängt sich, gestürzt, Führung übernommen, Burgpunkte an einer Falle, Wertung eines Durchgangs | **Gedankenblase**: Icon + ein Wort, 1,8 s, dann Übergang in B (falls der Zustand anhält) oder nichts |
| **D — auf Anfrage** | Rennplan, Puste in Prozent, Sog-Anteil, Punkte, Fortschritt „n/N“, Zeiten | Fokus-Etikett, Hover, Kaderleiste, Rennplan-Zeile, Wertungstabelle, B1-Rangleiste |
| **E — Grafik statt Text** | im Windschatten (Keil), Puste und Nerven (Leisten), raus (Entsättigung), Führung auf gerader Bahn (die Position selbst) | bleibt Grafik, kein zusätzliches Wort, kein zusätzliches Icon |

**Wer führt?** Auf der geraden Bahn, im Oval und an der Wand ist das an der Position abzulesen. In
Halle und Burghof-Route geht das nicht, dort übernimmt die B1-Rangleiste. Ein dauerhaftes
Führungs-Icon braucht es deshalb nirgends. Der Führungs**wechsel** ist ein Gedanke (Abschnitt 5).
Die einzige dauerhafte Krone bleibt in Breaking, weil es dort keine Rangleiste gibt und „wer führt
den Gauntlet an“ die Geschichte der Szene ist.

---

## 3. Was anderswo funktioniert

Recherche aus öffentlich zugänglichen Quellen (Spielwikis, offizielle Handbücher, Foren). Wo es
keine Primärquelle gab, steht das dabei.

| Vorbild | Was es tut | Was wir übernehmen |
|---|---|---|
| **The Sims (Plumbob + Gedankenblasen)** | Ein einziges dauerhaftes Zeichen über dem Kopf. Seine **Farbe** trägt den Grundzustand (Sims 2: Stimmung von Platin bis Rot), es markiert die gewählte Figur, und der Rest kommt als kurze Gedankenblase mit Bild. Blasen, Plumbob und Gruppen-Icons sind als „overhead effects“ gemeinsam abschaltbar ([Sims Wiki: Plumbob](https://sims.fandom.com/wiki/Plumbob), [SimsCommunity: Plumbob und Blasen ausblenden](https://simscommunity.info/?p=26003)). | Genau Chris' Bild: **ein** Dauerzeichen und kurze Gedanken mit Icon. Bei uns ist das Dauerzeichen der Name, und eine einzelne Ikone kommt nur im Ausnahmefall dazu. Den Schalter „Kopf-Effekte aus“ übernehmen wir (6.4). |
| **„Lebensbalken nur bei Schaden“** | Roblox zeigt den Humanoid-Balken standardmäßig nur, wenn Health < MaxHealth (`DisplayWhenDamaged`, [Roblox-Doku](https://create.roblox.com/docs/reference/engine/classes/Humanoid/HealthDisplayType)). Diablo 3 auf dem PC zeigt Balken erst nach Schaden ([Blizzard-Forum](https://us.forums.blizzard.com/en/d3/t/is-there-a-console-command-or-anything-to-show-full-health-bars/24089)). Für Supreme Commander (FAF) liegt der Vorschlag „Lifebars only when damaged“ vor ([FAF PR 7085](https://gh.r-mj.com/FAForever/fa/pull/7085)). | **Ausnahme statt Normalzustand zeigen.** Wer normal läuft, braucht kein Zeichen. Gilt für Kategorie B und für die Option, die volle Puste-Leiste zu dimmen (5.3). |
| **Pro Cycling Manager** | Die Energie der Fahrer (gelb/rot/grün) steht im **Fahrer-Panel**, nicht als Text über den Köpfen. Ein Zustandssignal ist ein **blinkender** Balken. Das offizielle Handbuch beschreibt die Balken ([Cyanide-Guide: Riders](https://web.cyanide-studio.com/games/cycling/2020/pcm/guide/race-riders), [Interface](https://web.cyanide-studio.com/games/cycling/2020/pcm/guide/race-controls)). Ein Test von 2013 klagt, die Icons im Rennen ließen sich „nur durch Ausprobieren entschlüsseln“ ([Selectbutton-Review 2013](https://selectbutton.com/reviews/pro-cycling-manager-season-2013-review)). | Beides lehrreich: Der **Plan gehört ins Panel** (bei uns Kaderleiste und Rennplan-Zeile, Kategorie D), und **Icons ohne Einführung sind kryptisch**. Daraus folgt Regel 5.2, die das Wort zuerst zeigt. |
| **Formel-1-Übertragung** | Der dauerhafte Turm am Rand trägt Position, Fahrer und Reifen als **Icon**. An den Autos selbst stehen keine Dauertexte. Status wie DRS oder Box kommt als kurzer Zustand ([RaceFans zur Grafik](https://www.racefans.net/?p=478947), Fan-Werkzeug [f1-dash](https://f1-dash.com/help) mit DRS-, Box- und Reifen-Icons; keine offizielle FOM-Designdoku gefunden). [Motorsport Magazine](https://www.motorsportmagazine.com/articles/single-seaters/f1/formula-1s-tv-graphic-balancing-act) beschreibt die Grafik als Balanceakt aus Auswahl und Weglassen. | **Ein Ort pro Information:** Rang und Zeiten in den Turm (unsere B1-Leiste), Zustand kurz am Objekt. Die Statusspalte der HYROX-Leiste („TECH/KLET/KRAFT“) ist schon dieses Muster. Sie bekommt nur dieselben Piktogramme wie die Läufer. |
| **Leichtathletik- und Schwimmübertragung** (aus Sehgewohnheit, keine Quelle) | Namen und Bahn erscheinen beim **Vorstellen** und beim **Zieleinlauf**. Im Rennen steht nur die Platzziffer, dazu eine Weltrekordlinie. Kurzfristige Plaketten wie „PB“, „SB“ oder „Q“ erscheinen erst im Ziel. | Platz-Plakette statt „Platz n · Zeit“ (B8). Die Geisterlinie im Time-Trial gibt es schon. |
| **MOBA- und RTS-Statussymbole** (aus Sehgewohnheit) | Betäubt, verlangsamt oder geschützt werden als kleines Symbol oder als Effekt **an** der Einheit gezeigt, mit fester, spielweiter Bedeutung. | Konsistenz über alle 20 Disziplinen. Ein Tropfen bedeutet überall Puste. |

**Projekt-eigene Vorbilder, die schon funktionieren** und deshalb zuerst wiederverwendet werden:

- Feldspiel: Name nur in Ballnähe, Knäueldeckel (`:17597`, `:17624`).
- Arena: Befehl nur bei Hover/Fokus (`:51044`).
- Eiskunstlauf: Programmtitel blendet nach `EISKUNSTLAUF_PROGRAMM_DAUER` aus.
- I-Spy: Sprechblase je Phase (`ispySprechblase`, `:30484`), der Q8-Prototyp.
- Sandsack: Puste-Ring am Kopf (`sandsackVizPusteRing`, `:23741`).
- Takeshi: ★ als Glyph für die Fallenstufe (`:43682`), Legendenzeile unten (`:43753–43755`).
- Bahn: „◂ neu“ nach einer Ansage (`ANSAGE_NACHLEUCHTEN`), also schon ein zeitlich begrenzter Hinweis.
- Bahn: `schwebe()` mit Läuferanker und Kollisionsvermeidung (`:50636–50695`).

**Abgeleitete Grundsätze:**

1. **Ausnahme statt Normalzustand.** Wer normal läuft, bekommt kein Zeichen.
2. **Wechsel statt Zustand.** Text gibt es nur in dem Moment, in dem sich etwas ändert.
3. **Wort zuerst, dann Icon.** Ein Icon taucht nie auf, ohne dass sein Wort kurz davor da war.
4. **Eine Bedeutung, überall.** Dasselbe Icon meint in allen 20 Disziplinen dasselbe.
5. **Ein Platz pro Information.** Rang und Zeiten stehen in der Tafel, Zustand an der Figur, Plan im Panel.
6. **Details auf Anfrage.** Fokus, Hover und Kaderleiste zeigen alles, was wegfällt.

---

## 4. Das Icon-Vokabular

### 4.1 Bauregeln für alle Icons

- **Prozedural gezeichnet**, im selben Muster wie die I-Spy-Möbel: wenige `moveTo/lineTo/arc`, in
  einem verschobenen Frame mit dem Ursprung in der Icon-Mitte. **Keine Emoji:** Ihre Darstellung
  hängt vom Betriebssystem ab, und der Motor hält selbst fest „kein Emoji, reiner Text-Glyph wie
  ueberall sonst“ (`:30441`). Erlaubte Text-Glyphen aus der Schrift sind ★ ✕ ✓ „…“, alle schon im
  Motor benutzt.
- **Größe:** 10 px Kantenlänge bei Zoom 1, mitskaliert mit `min(cam.zoom,1.6)`, nie unter 9 px
  Bildschirmgröße.
- **Kontur:** 2 px `rgba(8,10,14,.85)` um jede Form, dieselbe Kontur wie der Namenstext. Damit
  bleibt das Icon auf jeder Kulisse lesbar.
- **Form trägt die Bedeutung, Farbe verstärkt sie.** Jedes Icon muss in Graustufen
  unterscheidbar sein (Farbsehschwäche).
- **Nie in Teamfarbe** (`--home` `#F2A03D`, `--away` `#45B0C9`). Der Name daneben steht schon in
  Teamfarbe, ein Icon in derselben Farbe würde als „gehört zu Heim/Gast“ gelesen.
- **Position:** als Kopf-Ikone rechts neben dem Namen, auf derselben Grundlinie
  (`x + Namensbreite/2 + 7`). So entsteht **keine** zusätzliche Zeile. Als Gedankenblase oberhalb
  des Namens (y−44, also auf der Höhe der heutigen, dann freien Planzeile), mit Zeiger zum Kopf.
- **Gedankenblase:** die Pille aus `ispySprechblase()` (`rgba(10,8,5,.82)`, 1 px Rand in
  Icon-Farbe, Zeiger nach unten). Inhalt: Icon (9 px) + **ein** Wort (8 px, 700, RaniraSeason).
  Maximal 12 Zeichen.

### 4.2 Die zwölf Icons

| # | Bedeutung | Form | Farbe (vorhanden im Motor) | Gespeist aus (heutige Felder, nur lesend) | Art |
|---|---|---|---|---|---|
| **I1** | **Puste knapp / leer** | Schweißtropfen (Tropfen mit Spitze oben). Knapp: Umriss; leer: gefüllt | knapp `#d98b3a`, leer `#c0504a` (Puste-Ampel `:50377`) | Bahn: `u.leer`, `reserve/reserveMax<0,2`; Feldspiel: `u.puste/u.pusteMax`; Arena: `u.sp/u.spMax`; Sandsack: `puste`; Wettessen: Magen an der Mauer | B (leer), C beim Eintritt |
| **I2** | **fängt sich / Puste zurück** | derselbe Tropfen, gefüllt, mit kleinem Aufwärtshaken rechts | Puste-Grün `#5FD08A` | Bahn: Übergang `u.leer` true→false (`:48299`) | nur C |
| **I3** | **gestürzt / gestolpert / Griff verloren** | drei kleine Sterne im Halbkreis über dem Kopf („benommen“) | `#f2e9d8` mit Gold-Kern `#f2d75a` | Bahn: `u.stolper>0` beim Eintritt, `schwebe`-Ereignisse „rutscht ab / Fuß rutscht / Hand öffnet sich“; Eiskunstlauf: Sturz; Feldspiel: Fumble | nur C (die Figur liegt ohnehin sichtbar) |
| **I4** | **gefährdet / kurz vor dem Aus** | Warndreieck mit „!“, pulsiert | `--crit` `#E05A4F` | Takeshi: `u.nerven/u.nervenMax<0,25` (heute pulst nur die Leiste); Hatz: untere zwei der laufenden Welle (Fahrplan A9 „Gefahrenmarke“, **dieses** Icon nehmen); Breaking: HP < 15 %; Climbing: Duelldruck kurz vor dem Fall, falls ein Feld dafür existiert | B, C beim Eintritt |
| **I5** | **raus** | ✕ (Glyph) | Raus-Grau `#8795A9` | Bahn: `u.raus`; Breaking: K.o.; Arena: `u.down` | B (ersetzt „✕ Raus“) |
| **I6** | **im Ziel / Platz** | runde Plakette mit Platzziffer; Rand Gold/Silber/Bronze für 1–3, sonst Grau | `#f2d75a` / `#c7cedb` / `#c08a4a` / `#8795A9` | Bahn: `rennFertig.indexOf(u)` | B (ersetzt „Platz n · Zeit“) |
| **I7** | **an der Station** | Gruppen-Piktogramm. **Technik:** Hürde (zwei Pfosten, Querbalken). **Klettern:** Griff mit Seil (Haken und senkrechte Linie). **Kraft:** Hantel (Stange, zwei Scheiben) | eigene Gruppenpalette **ohne** Teamfarben, z. B. Technik Mint `#7fd8c2`, Klettern Ocker `#c9a25a`, Kraft Rot `#c74444` | HYROX: `hyroxZustand(u).art` ∈ Roxzone/Arbeit + `.gruppe` | B, solange er an der Station arbeitet. Dieselbe Form am Zonenschild und in der Rangleiste |
| **I8** | **Führung übernommen** | kleine Krone (drei Zacken, Band) | Gold `#f2d75a` | Bahn: Spitze der **angezeigten** Reihenfolge wechselt (gerade Bahn: `u.pos`; HYROX: `hyroxZustand(u).s`; Climbing: `u.hoch`). Breaking: wie heute `fuehrer` | C. Dauerhaft (B) nur in Breaking |
| **I9** | **greift an / zieht an** | Doppelpfeil „»“ als gezeichnete Chevrons, nach vorn geneigt | Ansage-Lila `#b98cff`, wenn eine Ansage es ausgelöst hat; sonst Weiß | Bahn: erstes Überschreiten von `u.pos>=u.ab` (der Planpunkt, ab dem der Plan „angeht“; dasselbe Feld, das `planWechsel()` liest, `:48020ff.`) | nur C |
| **I10** | **Plan gewechselt** | Sprechblasen-Zeiger mit Wort, Icon: kleiner Pfeil im Kreis (Wende) | Ansage-Lila `#b98cff` | `planWechsel()` → `u.ansageBei` | nur C, Wort = neuer Planname („Windschatten“). **Ersetzt** B2 und B5 |
| **I11** | **wartet** | „…“ (wie heute bei I-Spy) bzw. kleine Uhr (Kreis mit zwei Zeigern) für den Startcountdown | `#8a93a3` | I-Spy `vizPhase==="idle"`; Time-Trial: **nur** der nächste Starter, mit Zahl; Staffel: wartende Läufer **ohne** Icon (die Wechselzone erklärt es) | B |
| **I12** | **Rolle** (Identität, kein Zustand) | **Heiler:** grünes Kreuz. **Breaking erträgt:** Schild (Wappenform). **Breaking peinigt:** geballte Faust | Heiler `--ok` `#57B894`; erträgt `#f2d75a`, peinigt `#ff7a66` (beide aus `:36431`) | Arena `u.heiler`; Breaking `rolle` | A (dauerhaft, da Identität) |

Dazu kommen zwei Zahl-Gedanken, die **kein** Icon brauchen, weil sie schon kurze Werte sind:

- „+1,5 ★“ beim Passieren einer Takeshi-Falle (ersetzt B6),
- die Wertung eines Durchgangs („+8,4“) in Eiskunstlauf und I-Spy. Das sind die vorhandenen
  `schwebe()`-Zahlen, also bleibt alles wie heute.

**Was bewusst kein Icon bekommt:**

- **Windschatten:** Der Keil zeigt ihn schon, und er wechselt zu oft. Ein Gedanke bei jedem
  Ein- und Ausscheren wäre Flackern.
- **Der Rennplan als Dauerzustand:** gehört in Kategorie D.
- **Stationen im klassischen Spurt:** Die Hürde steht sichtbar auf der Bahn. Das Piktogramm I7
  gibt es nur dort, wo der Ort sich nicht selbst erklärt (HYROX-Halle).

### 4.3 Wiederverwendung bestehender Zeichen

| Bestehend | Wird im Vokabular zu |
|---|---|
| ★ Fallenstufe Takeshi / I-Spy (`:43682`, `:30445`) | bleibt die Bedeutung „Wert/Schwierigkeit“. Taucht nur in Zahl-Gedanken auf („+1,5 ★“), nie als Zustand |
| Puste-Ampel Grün/Orange/Rot (`:50377`, Feldspiel `:17752`) | Farbe von I1 und I2. Wer die Leiste kennt, kennt den Tropfen |
| Nerven-Lila `#9b6fd6` (`:50398`) | bleibt der Leiste vorbehalten. I4 nimmt bewusst Rot, weil „gefährdet“ disziplinübergreifend gilt und nicht nur für Nerven |
| Sog-Blau `#78beff` | bleibt dem Keil vorbehalten, kein Icon |
| Ansage-Lila `#b98cff` (`:50003`) | Farbe von I9 und I10. „Lila heißt: das war eine Anweisung“ |
| Fokus-Orange `#ffb02e` (`:10476`) | bleibt dem Fokus-Ring vorbehalten, kein Icon in dieser Farbe |
| HYROX-Gruppenfarben (Branch `:49037`) | werden auf eine teamfarbfreie Palette umgestellt (I7), Zonenschild und Leiste ziehen mit |
| 👑 Breaking (`:36164`, `:36437`) | gezeichnete Krone I8 |
| I-Spy-Sprechblase `ispySprechblase()` | wird zur allgemeinen `gedankenBlase()`. I-Spy ruft sie unverändert auf; das Skill-Kürzel bleibt dort Text, weil es eine Information ist, kein Zustand |

---

## 5. Trigger-Regeln

### 5.1 Was dauerhaft steht

1. **Name.** Immer, in Teamfarbe, wie heute. Im Bahn-Pod (24 Läufer) gilt zusätzlich der
   Knäueldeckel aus dem Feldspiel: In einem Kluster (`BAHN_LABEL_KLUSTER_DX/DY`, `:50050`) tragen
   höchstens 4 Figuren ihren Namen, der Rest wird zu „+n“. Fokus, Führender und Figuren mit
   aktivem Gedanken haben immer Vorrang.
2. **Höchstens eine Kopf-Ikone** (Kategorie B), rechts neben dem Namen. Gelten mehrere Zustände,
   gewinnt der erste in dieser Reihenfolge: **raus (I5) > gefährdet (I4) > leer (I1) > an der
   Station (I7) > wartet (I11) > im Ziel (I6)**. Rollen-Icons (I12) sind keine Zustände und stehen
   **vor** dem Namen.
3. **Fokussierte Figur** (`bahnFokus`, eigene Ansage-Wahl `bahnWahl`, Arena-Hover
   `kampfHoverId`): volles Etikett wie heute, also Name, darüber Plan (bzw. Befehl), dazu Puste in
   Prozent. Hier ist die Transparenz, die wegfällt, für die eine Figur, auf die der Zuschauer
   gerade schaut, vollständig zurück.

### 5.2 Wann ein Gedanke erscheint

- **Nur auf Flanken, nie auf Pegel.** Ein Gedanke entsteht, wenn ein Zustand **eintritt** (bei I2
  und I9 auch, wenn er endet bzw. einen Punkt überschreitet), nicht solange er besteht.
- **Entprellen:** Der neue Zustand muss **0,3 Zuschauersekunden** bestehen, bevor der Gedanke
  kommt. Das verhindert Gedanken an Grenzwerten, die in einem Bild kippen. Die Mechanik selbst
  entprellt schon an einer Stelle: `pusteFangen` verhindert das Flackern zwischen leer und
  gefangen, siehe `:48561` im Climbing-Stand bzw. `:48299` auf main.
- **Dauer in Zuschauersekunden, nicht in `rennT`.** Grundlage ist dieselbe Uhr wie für die
  Schwebetexte (`stepFloats()`, `:51860`, `life-=1.1/60` je Bild). Der Grund ist B5: Eine Dauer in
  Rennsekunden ist je Format verschieden lang.

| Fall | Dauer | Inhalt |
|---|---|---|
| normal | **1,8 s** (0,15 s einblenden, 1,25 s halten, 0,4 s ausblenden) | Icon + ein Wort |
| kritisch (I1 leer, I3, I4, I5) | **2,4 s** | Icon + ein Wort |
| **erstes Auftreten dieses Icons in dieser Sendung** | **3,5 s** | Icon + kurze Erklärung, z. B. „Puste leer — langsamer“, „gefährdet — fliegt als Nächster“, „Station: Kraft“ |

- **Ende:** Der Gedanke verschwindet von selbst. Hält der Zustand an und hat er eine Kopf-Ikone
  (Kategorie B), schrumpft die Blase am Ende in die Ikone neben dem Namen (0,2 s Übergang). Der
  Zuschauer sieht, wohin das Wort „gegangen“ ist. Endet der Zustand vorher, verschwindet beides.
- **Ersetzen:** Je Figur steht höchstens ein Gedanke. Ein neuer ersetzt den alten nur, wenn er in
  der Reihenfolge aus 5.1 Punkt 2 gleich oder höher steht. Sonst wartet er, höchstens 1 s, danach
  verfällt er und landet nur im Ticker.
- **Abklingzeit:** Derselbe Gedanke an derselben Figur höchstens alle **5 Zuschauersekunden**.
- **Bildbudget:** Gleichzeitig stehen höchstens **3 Gedanken** im Bahnbild (Bühne: 2). Vorrang
  hat zuerst die Fokusfigur, dann kritische Gedanken, dann der Führende, dann das eigene Team,
  dann der Rest. Was nicht ins Budget passt, geht nur in den Ticker (`feed()`), der die ganzen
  Sätze ohnehin führt.
- **Häufigkeitsregel:** Ein Zustand, der je Figur typischerweise öfter als alle zehn Sekunden
  wechselt, bekommt **keinen** Gedanken, nur Grafik. Das betrifft heute den Windschatten.
- **Schnelldurchlauf und Mess-Sonden:** Gedanken entstehen nicht. Sie hängen am selben
  `stumm`-Schalter wie `schwebe()` (`:39101`) und an `schnelldurchDomGedrosselt()`.

### 5.3 Zuordnung: Welche heutigen Zeilen werden was?

| Heute | Danach |
|---|---|
| B2 Rennplan-Wort (dauerhaft) | entfällt; I10-Gedanke bei `planWechsel()`; Plan in Fokus-Etikett und Kaderleiste (neuer kleiner Chip in der Bahn-Kachel, `renderKader` `:53424`, dort steht er heute **nicht**) |
| B3 „· Sog“ | entfällt (der Keil bleibt) |
| B4 „· leer“ | I1-Gedanke „leer“ beim Eintritt, danach Kopf-Ikone I1 |
| B5 „◂ neu“ | in I10 aufgegangen, mit Zuschauersekunden statt `rennT` |
| B6 „★ 3,5“ | entfällt; „+1,5 ★“-Gedanke an jeder Falle; Summe im Burgpunkte-Band |
| B7 „✕ Raus“ | Kopf-Ikone I5 ohne Wort, das Wort beim Eintritt als Gedanke |
| B8 „Platz n · Zeit“ | Kopf-Ikone I6 (Plakette); die Zeit in B1 und in der Wertung |
| B10 „Start in“ für alle | nur der nächste Starter, I11 + Zahl |
| Schwebetexte „eingebrochen / fängt sich / rutscht ab …“ | werden als Gedankenblase mit Icon gezeichnet (I1, I2, I3), dieselben `schwebe()`-Aufrufe, nur eine andere Zeichnung für Einträge mit `_laeufer`. **Kein doppelter Text** |
| Puste-Leiste | bleibt. *Option, die Chris entscheidet:* ab 80 % Puste auf 35 % Deckkraft dimmen („Ausnahme statt Normalzustand“). Der Name „Puste“ und die Ampel bleiben wie am 13.09. festgelegt |

---

## 6. Der Zielkonflikt: verständlich gegen weniger Text

Chris will beides, und ehrlich gesagt reibt es sich: **Ein Icon ohne Erklärung ist kryptischer als
ein Wort.** Pro Cycling Manager zeigt genau diesen Fehler (Kritik von 2013: Icons nur durch
Ausprobieren zu entschlüsseln). Ein reiner Wortverzicht würde die Transparenz kosten, die Chris
ausdrücklich behalten will. Gelöst wird das nicht über einen Mittelweg (etwas weniger Text,
etwas mehr Icons), sondern über **Zeit, Ort und Anfrage**:

### 6.1 Zeit: Wort zuerst, dann Icon, dann nichts

Jeder Zustand tritt mit seinem Wort ins Bild: Gedankenblase, Icon plus Wort. Erst danach bleibt das
Icon allein, und nur solange der Zustand gilt. **Ein Icon erscheint also nie, ohne dass sein Wort
kurz davor am selben Ort stand.** Beim ersten Auftreten in einer Sendung steht das Wort länger und
mit Halbsatz (5.2). Der Zuschauer lernt das Vokabular im Zusammenhang, ohne Legende zu lesen.
Genau so hat sich die Sims-Gedankenblase durchgesetzt: Das Bild ist eindeutig, weil man es in der
Situation sieht, in der es entsteht.

### 6.2 Einmal lernen, überall lesen

Das Vokabular gilt in allen 20 Disziplinen gleich (Abschnitt 4). Der Tropfen bedeutet im Spurt,
im Hockey, im Sandsack-Rennen und im Wettessen dasselbe. Wer ihn einmal gesehen hat, liest ihn
überall. Deshalb sind die Farben aus den schon vertrauten Leisten genommen und nicht neu erfunden.
Dasselbe gilt für Objekte. „FEGEARM“ steht nur in der ersten Hatz-Welle am Arm, danach ist der
rote Balken bekannt.

### 6.3 Ort: Die Details sind nicht weg, sie wohnen woanders

| Was wegfällt | Wo es weiter steht |
|---|---|
| Rennplan aller Läufer | Kaderleiste (neuer Chip), Rennplan-Zeile (eigenes Team), Fokus-Etikett |
| Puste in Prozent | Kaderleiste (`leiste`, `:53478`), Fokus-Etikett |
| Burgpunkte je Läufer | Burgpunkte-Band, Wertungstabelle |
| Platzzeit | B1-Rangleiste, Wertung |
| Punkte und „n/N“ (Eis, I-Spy) | Zwischenstand-Tafel, „Top 3 bisher“ (A11) |
| ganze Sätze („bricht ein — Puste leer bei 64 % der Strecke“) | Ticker, unverändert |

### 6.4 Anfrage: Hover, Fokus, Legende

- **Hover** über eine Figur (das Arena-Muster `kampfHoverId`, `:53328`, auf Bahn und Bühne
  übertragen): Das volle Etikett erscheint, solange der Zeiger darauf liegt.
- **Fokus** (Klick oder Regie): volles Etikett dauerhaft für diese eine Figur (5.1 Punkt 3).
- **Legende auf Anfrage:** Ein kleines „?“ in der HUD-Ecke öffnet eine Zeile aller Icons, die in
  **dieser** Disziplin vorkommen, im Stil der Takeshi-Legendenzeile (`:43753`). Sie ist nicht
  dauerhaft eingeblendet.
- **Schalter „Kopf-Effekte“** (Sims-Muster): drei Stufen. „voll“ ist das heutige Verhalten, als
  Rückfall und für QA-Vergleiche. „normal“ ist dieses Papier und die Voreinstellung. „aus“ zeigt
  nur Namen. Die Stufe wird per `localStorage` je Zuschauer gemerkt, in `try/catch`.

### 6.5 Was ich bewusst entschieden habe und was bei Chris bleibt

**Entschieden (PM-Rolle):**

- Der Plan verschwindet für **alle** vom Canvas, auch für das eigene Team. Das eigene Team hat die
  Rennplan-Zeile und die Kaderleiste. Ein Sonderweg „eigenes Team zeigt Plan“ hätte wieder 6
  Dauerzeilen erzeugt.
- Es gibt kein dauerhaftes Führungs-Icon außer in Breaking.
- Es gibt keine Emoji.

**Bei Chris, weil Geschmack:**

- **(a)** Ob die volle Puste-Leiste gedimmt wird (5.3).
- **(b)** Ob die Breaking-Rollen-Icons Schild und Faust sein sollen oder drastischer, passend zur
  Folter-Lesart, z. B. eine Daumenschraube für „peinigt“. Ich habe die neutralere Form gewählt.
  Q8 vom 13.10. hält dazu fest: Drastischer ist seine Entscheidung, nicht die Voreinstellung.

---

## 7. Bauplan für einen späteren Bau-Agenten

Alle Teile sind Klasse A, wertungsneutral per Bauart. Sie lesen nur `u.*` und schreiben
höchstens `u.viz*`-Felder, nie `rr()`. Pflicht in jedem PR:

- `scripts/pruefe-wertung-fingerabdruck.mjs` byte-identisch,
- Bilder bei 30 % und 75 % der Sendedauer (Fahrplan 4.2, Punkt 4),
- Vorher/nachher-Zählung der Textzeilen über Figuren je Bild (die Spalten aus 1.5).

Zonen nach Fahrplan 4.2: L0 und L1 in **A-HUD**, L2 in **B**, L3 in **B** (Breaking) und in der
Arena (Kampf-`draw()` ab `:50846`, Strang M beachten: Läuft dort ein Strang-M-Agent, wartet L3).

| PR | Inhalt | Ort | Aufwand | Abnahme |
|---|---|---|---|---|
| **L0 HYROX/Hatz-Etikett** (vor dem HYROX-Rollout) | In Formaten, deren Schritt `u.plan` nicht liest (`bahnHyroxAktiv`, `bahnHatzAktiv`), entfallen Planzeile, Puste-Leiste und Ansage-Knöpfe (`rennplanMoeglich()` um dieselbe Bedingung erweitern). Keine Wertungsänderung. | A-HUD, auf der Spitze des Spurt-Stapels (#1371) | ~20 Zeilen, ½ Sitzung | Fingerabdruck; Bild HYROX-Halle und Hatz ohne Planwort und Leiste |
| **L1 Bahn** | (1) `kopfIkone(ctx,x,y,typ,massstab)` mit I1–I11 als Primitive. (2) `gedankenBlase(ctx,x,y,typ,wort,farbe,alpha)` aus `ispySprechblase()` verallgemeinert; I-Spy ruft sie mit gleichem Bild auf. (3) Flankenerkennung im Zeichenpfad: `u.vizZustand` (vorheriges Bild) gegen den jetzigen Zustand; Gedanken in `u.vizGedanke={typ,wort,bis}` in Zuschauerzeit; Budget, Priorität, Abklingzeit nach 5.2. (4) `zeichneSpurt()`: B2–B8 und B10 nach Tabelle 5.3; Schwebetexte mit `_laeufer` als Blase. (5) Plan-Chip in der Bahn-Kachel. (6) HYROX: Zonenschild und Statusspalte auf I7, Gruppenpalette ohne Teamfarben. (7) Hover-Etikett auf der Bahn. (8) „?“-Legende und Drei-Stufen-Schalter. | A-HUD (`zeichneSpurt`, `zeichneHyroxUeberlagerung`, `zeichneHyroxRangleiste` bzw. ihr B1-Nachfolger), Kachel in C (`renderKader`), als Meldung an den nächsten C-Auftrag, wenn L1 die Zone nicht selbst anfassen darf | ~350–450 Zeilen, 1–1½ Sitzungen. **Nach A6** (B1-Leiste), damit „wer führt“ schon in der Leiste steht, wenn das Etikett schrumpft | Zählung aus 1.5 erreicht (Spurt ≤ 12 + 3); Bilder Spurt, HYROX, Climbing, Takeshi Duell und Pod, Time-Trial vor dem Start; jedes Icon mindestens einmal mit Erstauftritts-Wort im Bild |
| **L2 Bühnen** | Eis: nur Vorname, Punkte/Säule/„n/N“ weg. I-Spy: „Pkt“/„n/N“ weg (zusammen mit A11), Blase auf `gedankenBlase()`. Heben: Wortzeile zur Zahl. Schach: Farbwort weg. Tennis: Abstand einmal mittig. Showcase: „n/N“ weg. Sturz-Gedanke I3 (Eis), Wertungs-Zahl-Gedanken wie heute. | B | ~120–180 Zeilen, ½–1 Sitzung | Fingerabdruck; Bilder je Bühne; Zwischenstand-Tafeln unverändert |
| **L3 Arena und Breaking** | Arena „HEILER“ → I12 Kreuz. Breaking „ERTRÄGT/PEINIGT“ → I12 Schild/Faust, 👑 → gezeichnete I8, Gefährdet-Icon I4 bei HP < 15 % als Teil des Q8-Verfalls (K4). | B (Breaking); Arena nur ohne laufenden Strang-M-Agenten | ~80–120 Zeilen, ½ Sitzung | Fingerabdruck; Bilder Breaking und TDM |

**Was L1 nicht tun darf:**

- `bahnRangliste()`, `planWechsel()` oder `schwebe()`-Aufrufstellen ändern. Gezeichnet wird
  anders, gemeldet wird wie bisher.
- Die Mechanik von Puste, Nerven oder Sog anfassen.
- Neue Figuren oder Animationen bestellen.

---

## 8. Was ich nicht geprüft habe

- **Kein Bild.** Alle Zählungen stammen aus dem Code. Wie viele der 24 Zeilen sich im laufenden
  Spurt **tatsächlich** überlagern, hat niemand gemessen. Die Abnahmezählung in L1 holt das nach.
- **Die Dauer von „◂ neu“ (B5)** ist aus `rennT` und `ZEIT_DEHNUNG` abgeleitet, nicht mit der Uhr
  gemessen.
- **Ob HYROX/Hatz-Läufer im echten Spiel** (nicht im Zuschauermodus) die Ansage-Knöpfe sehen,
  hängt an `nurZuschauen`. Das Etikett sieht in jedem Fall jeder.
- **Die Climbing-Felder für „Duelldruck kurz vor dem Fall“ (I4)** habe ich nicht im Einzelnen
  verfolgt. Steht dort kein lesbares Feld, entfällt I4 im Climbing. Erfunden wird nichts.
- **Mini-DM-FFA** (eigene Leinwand `#mdffaCv`) und die Kartenschmiede habe ich nicht angesehen.

## Quellen

- [The Sims Wiki: Plumbob](https://sims.fandom.com/wiki/Plumbob)
- [SimsCommunity: Plumbob und Gedankenblasen ausblenden](https://simscommunity.info/?p=26003)
- [The Sims Tree: Overhead-Effekte in Sims 4](https://www.thesimstree.com/en/blog/the-sims-tips/how-to-remove-plumbobs-and-other-overhead-effects-in-the-sims-4.html)
- [Roblox: HealthDisplayType (DisplayWhenDamaged)](https://create.roblox.com/docs/reference/engine/classes/Humanoid/HealthDisplayType)
- [Blizzard-Forum: Diablo 3, Balken nur bei Schaden](https://us.forums.blizzard.com/en/d3/t/is-there-a-console-command-or-anything-to-show-full-health-bars/24089)
- [FAForever PR 7085: Lifebars only when damaged](https://gh.r-mj.com/FAForever/fa/pull/7085)
- [Pro Cycling Manager Guide: Riders](https://web.cyanide-studio.com/games/cycling/2020/pcm/guide/race-riders)
- [Pro Cycling Manager Guide: 3D Race Interface](https://web.cyanide-studio.com/games/cycling/2020/pcm/guide/race-controls)
- [Selectbutton: PCM Season 2013 Review](https://selectbutton.com/reviews/pro-cycling-manager-season-2013-review)
- [RaceFans: F1-TV-Grafik](https://www.racefans.net/?p=478947)
- [f1-dash Hilfe (DRS-, Box-, Reifen-Icons)](https://f1-dash.com/help)
- [Motorsport Magazine: Formula 1's TV graphic balancing act](https://www.motorsportmagazine.com/articles/single-seaters/f1/formula-1s-tv-graphic-balancing-act)
- Projekt: `fable-konzept-chris-feedback-13-10.md` (Q8, K2, K4); `alle-diszis-top-niveau-fahrplan-09-11.md` (B1, E1, E3, Zonen 4.2, A6/A7/A9/A11); `spurt-hyrox-routen-design-opus-09-11.md`
