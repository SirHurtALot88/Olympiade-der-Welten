# Breaking — Folter-und-Survive: Move-Namen und visuelle Identität (Recherche 08.09.)

**Reine Recherche. Keine Codeänderung im Commit.** Gemessen in einem eigenen Worktree
(`/tmp/wt-breaking-survival`) gegen `origin/main` = `b3591f1c` (der Stand nach #854, Fechten/
Eiskunstlauf/Breaking-Politur). Chris' Auftrag, wörtlich: Breaking soll als „Folter und Survive"-
Disziplin geplant werden, und die Kernfrage ist die optische Umsetzung — „richtig überlegen",
eine Entscheidung, keine Optionsliste.

**Baseline nachgemessen, nicht übernommen** (`node scripts/miss-alle-disziplinen.mjs 24
breaking`):

| Disziplin | rho/Spiel | Spannweite | rho/Saison | Spannweite | Status |
|---|---:|---:|---:|---:|---|
| Breaking | 0,869 | 0,114 | 0,951 | 0,168 | bestanden |

Bestätigt CLAUDE.md und die #854-Zahlen exakt. Diese Runde ändert kein Rezept, keine Matrix,
keine Rundenzahl — nur Namen/Flavor-Text (kosmetisch) und eine neue Zeichenfunktion (rein
präsentational). Beides fasst `wert()` nicht an; Begründung in Abschnitt 4.

---

## 0. Ergebnis vorab

1. **Chris hat das Konzept schon entschieden — es ist nur nicht überall angekommen.**
   `app/foundation/discipline-stage/arena/disciplines/breaking.tsx` ist die kanonische Quelle:
   eine lila Druck-Arena, in der alle Teilnehmer von außen nach innen rücken, vier Ring-Zonen
   (GEBROCHEN → SCHMERZGRENZE → STONE FACE → MIND FORTRESS) und ein zentrales
   SURVIVOR·UNBROKEN-Spotlight. Das ist bereits produktiv, bereits durchdacht, bereits einmal
   überarbeitet (ersetzte ein wörtlicheres Schmerz-Thermometer, Commit `1b115f23`). Diese Runde
   erfindet das Konzept nicht neu — sie zieht es in zwei Stellen nach, die es noch nicht kennen:
   die sechs Move-Namen im Battle-Mode-Rezept (Abschnitt 2) und die Battle-Mode-Canvas-Zeichnung
   (Abschnitt 3), die beide noch Breakdance-Vokabular bzw. das neutrale Neun-Disziplinen-
   Bühnenbild tragen.
2. **Sechs neue Move-Namen, entschieden, nicht optional** (Tabelle in Abschnitt 2.1):
   Bruchpunkt, Standhalten, Steingesicht, Aushalten, Zermürbung, Unbroken. Vier davon sind
   wörtlich Chris' eigene Vokabelliste aus dem Auftrag; zwei (Steingesicht, Unbroken) sind
   direkte Übersetzungen zweier vorhandener Ring-Namen aus `breaking.tsx`, bewusst doppelt
   belegt — der Move UND die Zone, in der er am meisten zählt, heißen gleich. Keine Matrix-,
   keine `profil`-Gewichtsänderung.
3. **Die Bildidee: eine eigene „Breaking Cypher"-Szene, nach exakt demselben Baumuster wie
   Gewichthebens `zeichneHeben()` und Speed-Schachs `zeichneSchach()`.** Statt der zwei
   Standard-Reihen bekommt Breaking eine Kreisfläche mit den vier `breaking.tsx`-Ringen, echten
   Boden-Rissen, einem pulsierenden Survivor-Kern in der Mitte — und die zwölf Teilnehmer stehen
   nicht in Reihen, sondern auf dem Ring, Radius umgekehrt proportional zu ihrem Punktestand
   (mehr Punkte = näher am Zentrum = „ungebrochener"). Konkrete Elemente, Timing, Erfolgs-/
   Fehlschlag-Reaktion: Abschnitt 3.3. Das ist mit vorhandenen Mitteln vollständig baubar — kein
   neues Asset, keine neue Bibliothek (Abschnitt 3.4).
4. **Kollisionsrisiko: null, wenn die Umsetzung sich an das etablierte Zwei-Zeilen-Muster
   hält.** Gewichtheben und Speed-Schach haben diesen Weg schon zweimal gezeigt: ein neues
   Flag im eigenen `BUEHNE_ART`-Eintrag, eine Zeile im `zeichneBuehne()`-Dispatcher, eine
   komplett neue, disziplin-eigene Zeichenfunktion. Kein gemeinsamer Code wird geändert, nur
   gelesen (Abschnitt 4). Die drei live geschalteten Bühnen-Disziplinen (Gewichtheben,
   Speed-Schach, Showcase) bleiben unberührt.
5. **Rangtreue bleibt 0,869 — durch Bauart, nicht durch Hoffnung.** Zeichencode läuft nie durch
   `disziplinProbe()`/`miss-alle-disziplinen.mjs`; das ist an derselben Stelle im Code selbst
   dokumentiert, an der Gewichthebens Hantel-Animation ihre Nicht-Wertungs-Garantie festhält
   (`battle-mode.engine.js:11826-11828`). Namen/Text in `SLOTS_JE_DISC`/`matchday-slot-roles.ts`
   sind reine Anzeige-Strings, kein Eingabewert einer Formel. Abschnitt 5 zieht die Kette bis zum
   Ende durch.

---

## 1. Der kanonische Ausgangspunkt: `breaking.tsx`

Kopfkommentar (`app/foundation/discipline-stage/arena/disciplines/breaking.tsx:1-9`):

> „breaking (Breaking Point · Survival-Cypher) — BESPOKE, ersetzt das Thermometer-Artwork.
> Konzept (Nutzer-Wunsch): lila Druck-Arena, in der alle Teams von außen NACH INNEN rücken. Wer
> am wenigsten „bricht" (höchster Score = am längsten UNBROKEN), steht am nächsten am Zentrum —
> dem SURVIVOR-Spotlight."

Das Konzept ist bereits vollständig ausgearbeitet und produktiv:

- **Geometrie:** Radius ∝ Nähe zum Zentrum ∝ Score (`normOf(score)=score/finalMax`), Winkel =
  feste Lane (`(laneIdx*13)%N`, „gegen Klumpen"). Score bleibt „Wahrheit" — die Position lügt nie
  über den echten Punktestand, sie glättet ihn nur weich (`useTokenGlide`).
- **Vier Druck-Zonen**, außen nach innen: `GEBROCHEN` (1.0) → `SCHMERZGRENZE` (0.72) →
  `STONE FACE` (0.46) → `MIND FORTRESS` (0.22), gestrichelte Ringe mit Beschriftung
  (`breaking.tsx:62-67`).
- **Zentrum:** `SURVIVOR · UNBROKEN`, gestrichelter Puls-Ring in `--nl-warn` (Gold), eine
  auslaufende Druckwelle vom Zentrum nach außen (`breaking.tsx:123-139`).
- **Palette:** lila Bühnenhintergrund mit Zentrum-Glut (`hsl(275 55% 22%)` → `hsl(280 45% 7%)`),
  zwei schwache Spotlight-Kegel, neun deterministische Boden-Risse vom Zentrum nach außen
  (`breaking.tsx:79-121`).
- **Führer = Survivor:** Rang 1 bekommt einen lila-goldenen Puls-Ring und eine 👑-Krone
  (`breaking.tsx:172-181`).

Das ist der Maßstab für alles, was unten folgt. Wo die Battle-Mode-Canvas eigene Entscheidungen
trifft (Abschnitt 3.3, insbesondere die Zwei-Seiten-Aufteilung), wird das explizit begründet,
nicht stillschweigend abgewichen.

---

## 2. Move-Namen: das Battle-Mode-Rezept spricht jetzt dieselbe Sprache

### 2.1 Fund

`battle-mode.engine.js:3581-3588` (`SLOTS_JE_DISC.breaking`) und wortgleich
`lib/lineups/matchday-slot-roles.ts:208-214` (`roleTheme(...)` für `breaking`) tragen sechs
Move-Namen aus dem Breakdance-Vokabular — „Power Move", „Footwork", „Freeze Control",
„Musicality", „Battle Nerve", „Finale Set". Die zugrundeliegende Matrix
(`will:28,torment:22,health:18,power:10,determination:10,stamina:8,dexterity:2,intelligence:2`,
`battle-mode.engine.js:3476`) ist bereits richtig — kein Charisma, „Präsenz im Battle" statt
„Lächeln" (Kommentar `:10671-10673`). Nur die Namen/Flavor-Texte tragen die falsche Erzählung:
sie lesen sich wie eine Wertung von Tricks, nicht wie ein Aushalten von Schmerz.

### 2.2 Die sechs neuen Namen

Nur `label`/`text` ändern sich. `id`, `gross`/`klein`/`last`, `mueh` und `profil` (die
Attributgewichte) bleiben in beiden Dateien exakt wie sie sind — das ist Chris' ausdrückliche
Vorgabe, und es ist auch inhaltlich richtig: die Matrix ist schon durchdacht (eine dokumentierte
Kalibrierrunde, Kommentar `:10676-10681`), nur die Wortwahl nicht.

| id (unverändert) | alt | **neu** | mueh | Attribute (gross/klein/last, unverändert) | neuer Flavor-Text |
|---|---|---|---|---|---|
| `powermove` | Power Move | **Bruchpunkt** | high | will/torment/health | „Treibt den schwersten Move bis zum Bruchpunkt — über Will und Torment." |
| `footwork` | Footwork | **Standhalten** | medium | health/dexterity/will | „Hält die Position im Kreis und sammelt Punkte — über Health und Dexterity." |
| `freezecontrol` | Freeze Control | **Steingesicht** | medium | health/determination/torment | „Erstarrt zum Steingesicht und hält die Kontrolle — über Health und Determination." |
| `musicality` | Musicality | **Aushalten** | low | will/determination/power | „Findet den Rhythmus im bloßen Aushalten — über Will und Determination." |
| `battlenerve` | Battle Nerve | **Zermürbung** | high | torment/will/health | „Hält der Zermürbung stand und antwortet im Battle — über Torment und Will." |
| `finaleset` | Finale Set | **Unbroken** | medium | power/stamina/determination | „Setzt den Schlusspunkt, unversehrt — über Power und Torment." |

**Warum diese sechs, nicht andere:**

- **Bruchpunkt, Standhalten, Zermürbung, Aushalten** sind Chris' eigene Vokabelliste aus dem
  Auftrag, wörtlich übernommen — kein Rateraten nötig, seine Sprache trägt die Erzählung direkt.
- **Steingesicht** ist die deutsche Übersetzung der `STONE FACE`-Zone aus `breaking.tsx` — bewusst
  identisch, nicht zufällig ähnlich: der Move „Freeze Control" (Kontrolle in der Erstarrung
  halten) UND die Zone, die dieselbe Erstarrung belohnt, tragen jetzt denselben Namen. Das ist
  kein Namenskonflikt, sondern die Art Wiederholung, die ein Spielsystem zusammenhält — wer
  „Steingesicht" im Move-Tooltip liest, erkennt es im Ring wieder, wenn er dort steht.
- **Unbroken** ist derselbe Kurzschluss zum Zentrums-Label `SURVIVOR · UNBROKEN` — der
  Abschlussmove eines Auftritts heißt wie der Zustand, den er verteidigt.
- **Schmerzgrenze** (die zweite Zone) wird bewusst NICHT als Move-Name zweitverwendet — sie
  bleibt exklusiv der Ring-Beschriftung vorbehalten, damit nicht zwei Zonen-Namen mit
  Move-Namen kollidieren und drei mit keinem. Ein Move heißt „Bruchpunkt" (das drohende
  Zerbrechen selbst), nicht „Schmerzgrenze" (die Zone, in der man dem Zerbrechen nahe ist) — der
  Unterschied ist fein, aber real: ein Move ist eine Handlung, eine Zone ist ein Ort.

### 2.3 Wo diese Namen zusätzlich stehen — und warum das die Sorgfalt erhöht, nicht nur verdoppelt

**Wichtiger Fund, der über das Battle-Mode-Rezept hinausgeht:** `SLOTS_JE_DISC.breaking` in
`battle-mode.engine.js` ist keine reine Mockup-Fiktion. Dieselben sechs Rollen — Wortlaut,
Reihenfolge, `profil`-Gewichte — stehen identisch (von Hand dupliziert, kein gemeinsamer Import)
in `lib/lineups/matchday-slot-roles.ts:208-214`, und dieses Modul speist die **echte**
Lineup-Oberfläche (`resolveSlotRolesForDiscipline`, importiert u. a. von
`app/foundation/legacy-lineup-lab/LineupNewLook.tsx`, `LegacyLineupLabClient.tsx`,
`lib/player-generator/player-generator-service.ts`). Breaking ist eine offizielle Disziplin mit
eigener Gewichtsmatrix (`lib/player-generator/official-discipline-weights.ts:32`) — die
Rollen-Labels „Power Move"/„Footwork"/… sind also schon heute sichtbar, wenn Chris für Breaking
eine Aufstellung baut, unabhängig davon, ob die Battle-Mode-Arena-Visualisierung für Breaking
jemals live geht.

Das ändert nichts an der Risikobewertung (reiner Anzeige-Text, keine Formel, keine Gewichte, s.
Abschnitt 5) — aber es bedeutet: **eine Umsetzung muss beide Dateien im selben Schritt ändern**,
sonst zeigt die Lineup-Oberfläche „Footwork" während das Battle-Mode-Mockup „Standhalten" zeigt,
und das genau die Art Auseinanderlaufen, die diese Recherche beheben soll, nur an neuer Stelle.
Reihenfolge für die Umsetzung: `lib/lineups/matchday-slot-roles.ts` zuerst (Produktionscode,
sichtbar für Chris), `battle-mode.engine.js` im selben PR nachgezogen (Mockup, folgt).

---

## 3. Die optische Umsetzung: „Breaking Cypher" im Battle-Mode-Canvas

### 3.1 Ist-Zustand, live geprüft

`zeichneBuehne()` (`battle-mode.engine.js:11538-11613`) hat für Breaking heute **keine** eigene
Zeichenfunktion — es läuft durch denselben Zweig wie Wettessen, Tennis, I-Spy: zwei Reihen
stehender Figuren, eine Punktesäule, ein „x/N"-Fortschrittstext. Gestern (#854) wurde die einzige
disziplinspezifische Behandlung entfernt, die es gab: die kosmetische Kampfwaffe (Axt/Schwert/
Bogen) wird für Breaking jetzt vollständig unterdrückt (`keineBuehnenWaffe`-Zweig, derselbe der
auch Eiskunstlauf betrifft). Das war der richtige erste Schritt (ein Breaker mit Zufalls-Kosmetik
„Axt" schwang vorher beim Move eine sichtbare Axt) — aber es macht Breaking nicht sichtbar
anders, nur weniger sichtbar falsch. Optisch ist Breaking heute identisch zu Wettessen bis auf
Namen und Zahl, genau der Befund, den die #852/#854-Recherche schon für Eiskunstlauf/Breaking
protokolliert hat (`docs/design/fechten-eiskunstlauf-breaking-politur-recherche-07-09.md`
Abschnitt 4.1) — und der dort ausdrücklich für „eine spätere, dedizierte Visual-Runde"
zurückgestellt wurde. Rangtreue und Grundkosmetik (Waffe weg) stehen jetzt beide; das ist genau
diese spätere Runde.

**Ein Vorteil, den es schon gibt, ohne dass ihn irgendjemand geplant hat:** `bodenBuehne()`
(`:11521-11536`, gemeinsam für alle neun Bühnen-Disziplinen) ist selbst schon dunkel-violett
(`#1b1622` → `#0d0a12`, Bodenstreifen `#2a2233`), keine neutrale graue Fläche. Breaking muss also
keine neue Grundfarbe gegen eine neutrale Bühne durchsetzen — es muss die vorhandene Bühnenfarbe
nur **radikalisieren**: sättigen, in Ringe zerlegen, auf ein Zentrum zuziehen. Das senkt den
Umsetzungsaufwand spürbar gegenüber „komplett neue Palette".

### 3.2 Vorbild: das Gewichtheben-/Speed-Schach-Baumuster

Beide bestehenden Sonderfälle folgen exakt derselben Struktur (`:11538-11546`):

```js
function zeichneBuehne(){
  bodenBuehne();
  const art=BB();
  if(art.heben){ zeichneHeben(art); return; }
  if(art.schach){ zeichneSchach(art); return; }
  // ... Standard-Zwei-Reihen-Bild für die restlichen sieben ...
}
```

Ein Flag im eigenen `BUEHNE_ART`-Eintrag (`heben:true`, `schach:true`), eine Zeile im
Dispatcher, eine komplett eigene, disziplin-only Funktion. `zeichneHeben()` liest ausschließlich
vorhandene Felder (`u.runden`, `u.aktuell`, `buehneAkt`, `art.rundenDauer`) rein präsentational —
der Kommentar dort (`:11823-11828`) hält das ausdrücklich fest:

> „disziplinProbe()/miss-alle-disziplinen.mjs rufen stepBuehne() weiterhin direkt mit festem
> 1/60 auf, lesen buehneAkt nie fuer die Wertung und durchlaufen diese Zeichenfunktion nie."

Genau dieses Muster — dritte Instanz statt zweiter Sonderfall — ist die Vorlage für Breaking.

### 3.3 Die Bildidee: konkret, Element für Element

**Neues Flag:** `BUEHNE_ART.breaking.cypher = true`. Neue Funktion `zeichneBreaking(art)`,
aufgerufen über `if(art.cypher){ zeichneBreaking(art); return; }` direkt nach den beiden
bestehenden Checks in `zeichneBuehne()`.

**A. Grundfläche (einmal pro Frame, vor allem anderen).** `bodenBuehne()` bleibt (Spotlight-
Kegel, Bodenstreifen — dieselbe Bühnen-Identität wie die anderen acht). Darüber ein
vollflächiger radialer Verlauf, 1:1 nach `breaking.tsx`s `brkBg`-Gradient übersetzt (Canvas
`createRadialGradient` statt SVG `radialGradient`): Zentrum `hsl(275 55% 22%)`, Rand
`hsl(280 45% 7%)`. Zwei Fill-Aufrufe, kein neuer Zustand.

**B. Vier Druck-Ringe + Zentrum, exakt `breaking.tsx`s Beschriftung.** Vier gestrichelte
Ellipsen (`ctx.setLineDash([4,8])`), Radien bei 22 %/46 %/72 %/100 % zwischen Kern- und
Außenradius — dieselben vier Zahlen wie `breaking.tsx:62-67` — mit Text darüber:
`GEBROCHEN`/`SCHMERZGRENZE`/`STONE FACE`/`MIND FORTRESS`, monospace, klein, halbtransparentes
Lila. In der Mitte ein pulsierender gestrichelter Kreis in derselben Warnfarbe wie überall im
Spiel (`--ok`/`--crit`-Analogon: ein warmes Gold, z. B. `#f2d75a`, bereits als „KÜHNER
VERSUCH"-Farbe im selben File etabliert, `:11891`), mit der Beschriftung `SURVIVOR · UNBROKEN`.
Neun deterministische Boden-Risse (Zickzack-Pfade vom Kern nach außen, `Math.sin`/feste Indizes
statt `Math.random()` — derselbe Determinismus-Grundsatz wie bei den Pilzhüten/Rissen im
EFFEKT_ARTEN-System, `:2251-2277`, `:2282-2299`), damit dasselbe Bild bei jedem Redraw
identisch aussieht, kein Geflacker.

**C. Zwölf Teilnehmer auf dem Ring statt in zwei Reihen — die zentrale Abweichung von
`breaking.tsx`, bewusst begründet.** `breaking.tsx` mischt alle Teilnehmer in einem einzigen Ring
(Winkel nur nach Lane-Index, keine Team-Trennung), weil die Produktions-Ansicht eine offene
Lobby aus N unabhängigen Teams zeigt. Das Battle-Mode-Chassis ist strukturell anders: ein
6-gegen-6-Duell zweier Seiten (`jeSeite:6`), keine offene Lobby. Ein einzelner gemischter Ring
würde die Team-Zugehörigkeit unkenntlich machen, die die bestehende Zwei-Reihen-Ansicht heute
klar zeigt (Heim oben, Gast unten). Lösung: **zwei Halbkreise statt zwei Reihen** — Heim
belegt die linke Hemisphäre (Winkel 100°–260°), Gast die rechte (−80°–80°), macht innerhalb der
eigenen Hemisphäre nach Index gleichmäßig verteilt (dieselbe „13er-Schritt gegen Klumpen"-Idee
aus `breaking.tsx:52`, nur auf 6 statt N Positionen herunterskaliert). **Radius bleibt exakt
`breaking.tsx`s Formel:** `radius = rOut - (u.summe/maxSumme) * (rOut-rIn)` — `maxSumme` ist
bereits als `Math.max(1,...TEILNEHMER.map(u=>u.summe))` im bestehenden Code vorhanden
(`:11550`, dieselbe Normierung, die heute schon die Punktesäule „relativ zum Feld, nicht
absolut" hält). Mehr Punkte → kleinerer Radius → näher am Zentrum → sichtbar „ungebrochener".
`zeichneSprite(ctx,u,x,y)` wird unverändert wiederverwendet (keine neue Sprite-Pipeline, die
Waffenunterdrückung aus #854 gilt weiterhin automatisch, weil sie an `buehneDisc==="breaking"`
hängt, nicht an der Zeichenfunktion).

**D. Erfolg/Fehlschlag — rein aus vorhandenen, gelesenen Feldern, kein neuer Zustand.** Jede
Runde setzt bereits `u.lunge=0.5` beim Enthüllen (`stepBuehne:11402`, gemeinsam für alle neun
Disziplinen) und trägt in `u.runden[u.aktuell].ereignis` entweder `art.erfolgWort` („setzt den
Move") oder `art.failWort` („Move bricht ab") — genau dieselbe Unterscheidung, die
`WERTUNG_AUFTRITT` schon für die Boxscore-Spalten liest (`z.r.filter(r=>r.ereignis===
art.failWort)`, `:11714`). `zeichneBreaking()` liest dasselbe Feld rein lesend, ohne neuen
Zustand auf `u`:
  - **Erfolg:** ein kurzer, sich zusammenziehender Lila-Gold-Puls-Ring um den Token (Alpha und
    Radius aus `u.lunge` abgeleitet, dieselbe „ease aus einer 0,5s-Zerfallszeit"-Idee wie
    Gewichthebens Hantelanimation aus `buehneAkt`) — der Ring zieht sich zusammen, nie
    auseinander: „ich halte stand" liest sich als Verengung, nicht als Explosion.
  - **Fehlschlag:** ein roter Zickzack-Riss-Flash direkt am Token (derselbe „gluehender
    Riss"-Zeichenstil, der im EFFEKT_ARTEN-System schon für Lava Golem existiert,
    `:2282-2299`, nur rot statt orange und nur für die `u.lunge`-Dauer sichtbar statt
    permanent) — „hier bricht gerade etwas". Die **Position** des Tokens bleibt in beiden
    Fällen exakt score-treu (kein Vor-/Zurückschnappen) — genau `breaking.tsx`s eigener
    Grundsatz „Score bleibt Wahrheit", nur in Canvas statt SVG.
  - Kein neues Feld auf `TEILNEHMER`, keine Änderung an `stepBuehne()` — beide Reaktionen
    lesen ausschließlich, was für die Wertungstabelle ohnehin schon berechnet wird.

**E. Survivor-Krone (optional, niedrige Priorität, aus derselben Vorlage).** Der aktuelle
Rang-1-Teilnehmer (kleinster Radius) bekommt denselben 👑-Text wie `breaking.tsx:177-181`, über
dem Sprite platziert — eine Textzeile, kein neues Asset, exakt das bestehende Emoji-Muster, das
das Battle-Mode-Feld an anderer Stelle schon nutzt (Ticker-Meldungen).

### 3.4 Warum das mit vorhandenen Mitteln geht — kein neues Asset, keine neue Bibliothek

Jede Zutat aus 3.3 hat eine bestehende Entsprechung im selben File:

| Zutat | Vorbild im Code |
|---|---|
| Radialer Lila-Verlauf | `bodenBuehne()`s eigener Verlauf, plus `breaking.tsx`s `brkBg` als exakte Zahlenvorlage |
| Gestrichelte Ringe + Label | Gewichthebens/Speed-Schachs Text-über-Primitiv-Muster (`ctx.strokeText`/`fillText`) |
| Deterministische Boden-Risse | `EFFEKT_ARTEN`-Zickzack-Riss (Lava Golem), `:2282-2299`, bereits „ohne shadowBlur, dreimal nachgezeichnet" für billiges Glühen |
| Score-proportionaler Radius | `maxSumme`-Normierung, bereits in `zeichneBuehne()` für die Punktesäule (`:11550/11588`) |
| Erfolg/Fehlschlag rein aus `ereignis` | `WERTUNG_AUFTRITT`s `art.failWort`-Filter (`:11714-11716`), identisches Datenfeld |
| Zeitgesteuerte Animation ohne neuen Zustand | Gewichthebens Hantel-Auf-/Abbewegung aus `buehneAkt`/`u.lunge` (`:11831-11846`) |
| Sprite unverändert | `zeichneSprite()`, inklusive der #854-Waffenunterdrückung, die automatisch mitgilt |

Nichts davon braucht ein neues Sprite-Blatt, eine neue Farbdefinition außerhalb der bereits
vorhandenen (`--nl-warn`/Gold ist bereits im HTML-Namespace des Mockups etabliert,
`breaking.tsx` nutzt dieselbe CSS-Variable), oder eine neue Zeichnungs-Bibliothek. Der einzige
wirklich neue Code ist die Zusammensetzung — `zeichneBreaking()` selbst —, keine ihrer Zutaten.

**Was NICHT übertragen wird, bewusst:** `breaking.tsx`s weiche Glide-Animation
(`useTokenGlide`) ist ein SVG/React-spezifischer Mechanismus (rAF-getriebene Interpolation über
DOM-Refs) ohne 1:1-Entsprechung im Canvas-Motor. Ein Nachbau wäre ein eigenständiges,
generisches Canvas-Feature (nicht breaking-spezifisch) und gehört — falls gewünscht — in eine
separate, disziplinübergreifende Runde, nicht in diese. Ohne Glide „springt" ein Token beim
Score-Update hart auf seine neue Position; das ist optisch weniger poliert, aber funktional
identisch zu jeder anderen Buehnen-Disziplin heute (auch die Punktesäule „springt" bei jedem
`stepBuehne()`-Tick ohne Interpolation) — kein Rückschritt gegenüber dem Status quo, nur keine
zusätzliche Politur in dieser Runde.

---

## 4. Kollisionsrisiko

**Betroffener Code, vollständig aufgezählt:**

1. Ein neues Feld `cypher:true` in `BUEHNE_ART.breaking` (`:10669-10691`) — liest niemand außer
   dem einen neuen Dispatcher-Check.
2. Eine neue Zeile im `zeichneBuehne()`-Dispatcher (`:11545-11546`), nach demselben Muster wie
   die beiden bestehenden `heben`/`schach`-Checks — reine Bedingung, kein Eingriff in die
   Zweige, die für die anderen acht Disziplinen laufen.
3. Eine komplett neue Funktion `zeichneBreaking(art)`, ausschließlich lesend auf bereits
   vorhandenen Feldern (`u.summe`, `u.side`, `u.aktuell`, `u.runden`, `u.lunge`, `u.n`,
   `u.groesse`, `art.rundenN`, `art.erfolgWort`, `art.failWort`) — schreibt nichts Neues auf
   `TEILNEHMER`.
4. Zwei Label-/Text-Änderungen in `SLOTS_JE_DISC.breaking` und `matchday-slot-roles.ts`
   (Abschnitt 2) — reine Anzeige-Strings.

**Nicht betroffen:** `stepBuehne()`, `bauBuehne()`, `WERTUNG_AUFTRITT`, `rezept`,
`BASIS_JE_DISC`, jede der übrigen acht `BUEHNE_ART`-Einträge, `zeichneHeben()`,
`zeichneSchach()`, `zeichneSprite()`s bestehende Zweige (die Breaking-Waffenunterdrückung aus
#854 hängt an `buehneDisc`, nicht an der aufrufenden Zeichenfunktion — sie gilt unverändert
weiter). `ARENA_RESOLVED_DISCIPLINE_IDS`
(`lib/resolve/battle-mode-arena-team-points.ts:159-165`) enthält Breaking nicht — Gewichtheben,
Speed-Schach und Showcase (die drei live geschalteten Bühnen-Disziplinen) sind in keiner der vier
Änderungen erwähnt oder betroffen.

**Das ist exakt dasselbe Risikoprofil wie Gewichtheben/Speed-Schachs eigene Bühnenbilder bei
ihrer jeweiligen Einführung** — beide sind seit ihrer Produktivierung nie Ursache eines Bugs in
einer der anderen acht Bühnen-Disziplinen gewesen, weil ihr gesamter Effekt hinter einem
Flag-Check auf die eigene Disziplin-ID sitzt.

**Verifikationspflicht für die Umsetzung** (wie jede Bühnen-Änderung in diesem Projekt):
`node scripts/miss-alle-disziplinen.mjs 24` für alle neun Bühnen-Disziplinen vor und nach dem
Merge — Erwartung: alle neun bit-identisch (reine Zeichen-/Text-Änderung, keine Zahl in
`rezept`/`erfolg`/`punkte` wird berührt). Für die visuelle Abnahme selbst: ein neues
Wegwerf-Skript nach dem Muster von `scripts/screenshot-speed-schach.mjs`/
`scripts/screenshot-gewichtheben.mjs` (Playwright gegen `public/mockups/battle-mode.html`,
Breaking als Disziplin, mehrere Zeitpunkte) — analog zu `screenshot-fable-drei-buehne.mjs` aus
der #852-Recherche.

---

## 5. Rangtreue: warum diese Runde per Konstruktion neutral ist

**Move-Namen (Abschnitt 2):** `label`/`text` sind reine Anzeige-Strings in `SLOTS_JE_DISC`/
`matchday-slot-roles.ts` — keiner der beiden fließt in `wert()`, `profil`-Gewichte oder eine
Formel ein. `id`, `gross`/`klein`/`last`, `mueh`, `profil` bleiben Byte-identisch.

**Zeichencode (Abschnitt 3):** Wie in Abschnitt 3.2 zitiert, hält der Code selbst fest, dass
`disziplinProbe()`/`miss-alle-disziplinen.mjs` `stepBuehne()` direkt mit festem `1/60` aufrufen
und die Zeichenfunktionen (`zeichneBuehne()`/`zeichneHeben()`/`zeichneSchach()`, künftig
`zeichneBreaking()`) dabei **nie durchlaufen** — die Messung läuft vollständig headless, ohne
Canvas. Eine vierte Zeichenfunktion in derselben Familie ändert daran nichts.

**Bestätigt, nicht angenommen:** Baseline oben (0,869/0,114/0,951/0,168) ist die frisch
gemessene Zahl aus diesem Worktree, unverändert gegenüber der in CLAUDE.md und
`docs/design/fechten-eiskunstlauf-breaking-politur-recherche-07-09.md` dokumentierten
0,869 — kein Rezeptumbau in dieser Runde, also keine neue Messung nötig, um „vorher" zu
belegen. Eine Umsetzungsrunde, die tatsächlich Zeichencode ändert, sollte trotzdem exakt
dieselbe Messung danach wiederholen (CLAUDE.md-Grundsatz „bestätige es, statt es
anzunehmen") — erwartet: bit-identisch zu den Zahlen oben.

---

## 6. Empfohlene Reihenfolge für die Umsetzung

1. **Move-Namen zuerst** (Abschnitt 2) — niedrigstes Risiko, sofort sichtbar für Chris in der
   echten Lineup-Oberfläche, keine Canvas-Arbeit nötig. Beide Dateien im selben PR
   (`lib/lineups/matchday-slot-roles.ts` UND `battle-mode.engine.js`), sonst laufen die beiden
   Systeme in genau der Art auseinander, die dieser Auftrag beheben soll.
2. **`zeichneBreaking()`** (Abschnitt 3.3) als zweiter, unabhängiger Schritt — kann in
   derselben oder einer separaten PR laufen, hat keine Rangtreue-Abhängigkeit zu Schritt 1.
   Reihenfolge innerhalb dieses Schritts: erst Grundfläche + Ringe + Teilnehmer-Positionierung
   (das Bild steht), dann Erfolg/Fehlschlag-Reaktionen (die Politur), zuletzt die optionale
   Survivor-Krone.
3. **Glide-Animation für Buehne generell** (Abschnitt 3.4, „was nicht übertragen wird") —
   ausdrücklich zurückgestellt, kein Teil dieser Empfehlung, eigenständiges, disziplin-
   übergreifendes Feature für eine spätere Runde, falls gewünscht.

Keiner der drei Schritte berührt Gewichtheben, Speed-Schach oder Showcase in irgendeiner Form.

---

## Anhang: Werkzeuge dieser Recherche

- `node scripts/miss-alle-disziplinen.mjs 24 breaking` — Baseline-Bestätigung, kaderfest über
  `data/generated/kaderfamilie-live-save.json`.
- Gelesen, nicht ausgeführt: `app/foundation/discipline-stage/arena/disciplines/breaking.tsx`
  (kanonische Quelle), `public/mockups/battle-mode.engine.js` (Abschnitte `BASIS_JE_DISC`,
  `SLOTS_JE_DISC.breaking`, `BUEHNE_ART.breaking`, `zeichneBuehne`/`zeichneHeben`/
  `zeichneSchach`, `EFFEKT_ARTEN`, `stepBuehne`, `WERTUNG_AUFTRITT`),
  `lib/lineups/matchday-slot-roles.ts`, `lib/resolve/battle-mode-arena-team-points.ts`
  (`ARENA_RESOLVED_DISCIPLINE_IDS`), `docs/design/fechten-eiskunstlauf-breaking-politur-
  recherche-07-09.md` (Vorgänger-Recherche, Vorlage für Struktur und Ton).
- Für eine künftige visuelle Abnahme empfohlen (nicht Teil dieses Commits):
  `scripts/screenshot-speed-schach.mjs`/`scripts/screenshot-gewichtheben.mjs` als Vorlage für ein
  neues `scripts/screenshot-breaking-cypher.mjs`.
