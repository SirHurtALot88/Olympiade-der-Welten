# Breaking — der Folter-Zweikampf wird sichtbar (Präsentation, 13.09.)

**Reine Präsentationsrunde.** Kein Rezept, keine Matrix, keine Rundenzahl, kein `failAbzug`, keine
Zeile in `wert()`. Gemessen vorher und nachher mit `node scripts/miss-alle-disziplinen.mjs 24` über
alle zwanzig Disziplinen; Ergebnis: **bit-identisch**, beide Ergebnisdateien mit derselben MD5.

---

## 0. Eine Korrektur vorweg, die diese Runde fast in die falsche Richtung geschickt hätte

Der Auftrag an diesen Agenten begann mit der Vorgabe, echte Breakdance-Battles (Red Bull BC One,
Olympia 2024, WDSF-Regelwerk) zu recherchieren und Chris' Wunsch nach „zwei Charakteren, die sich
weh tun" gegen den echten Sport zu korrigieren — im echten Breaking gibt es keinen Körperkontakt,
das WDSF-Regelwerk zieht dafür sogar Prozente ab.

**Diese Vorgabe war falsch, und die Recherche gehört nicht in dieses Design.** Chris, wörtlich:

> „und nein wir hatten schon clarified dass breaking NICHT breakdance ist sondern ein foltern!!!!
> das gibt es so ja nicht in echt dass einer schmerz zufügt der andere muss es aushalten dann ist
> wieder der andere dran bis einer aufgibt etc!!!! bitte merke dir das das musst du berücksichtigen
> sonst wird breaking nie gut"

„Breaking" ist in diesem Spiel **kein Sport-Breakdance**, sondern eine **erfundene Folter- und
Survival-Disziplin**. Es gibt dafür kein reales Vorbild, gegen das man kalibrieren könnte, und es
soll auch keins geben. Die Recherche über echte B-Boy-Battles wurde gefahren, bevor die Korrektur
eintraf, und ist **vollständig verworfen**: keine ihrer Zahlen, keine ihrer Staging-Beobachtungen
ist in diese Umsetzung eingeflossen. Festgehalten wird sie hier nur, damit der nächste Agent den
Umweg nicht wiederholt.

**Was stattdessen die Quelle ist:**
`docs/design/breaking-folter-survival-visuelle-identitaet-recherche-08-09.md`
(Chris' Auftrag „Folter und Survive", die sechs Move-Namen, das Bühnenbild) und
`app/foundation/discipline-stage/arena/disciplines/breaking.tsx` (die kanonische Druck-Arena).

**Der beste Beleg dafür, dass die Folter-Lesart die richtige ist, stand die ganze Zeit im Code.**
Alles, was das bestehende Bühnenbild beschriftet, ist Folter-Vokabular und nichts davon ist Tanz:

| Element | Text | im Code |
|---|---|---|
| Ring-Zone 1 (außen) | `GEBROCHEN` | `zeichneBreaking()`, aus `breaking.tsx:62-67` |
| Ring-Zone 2 | `SCHMERZGRENZE` | ebd. |
| Ring-Zone 3 | `STONE FACE` | ebd. |
| Ring-Zone 4 (innen) | `MIND FORTRESS` | ebd. |
| Zentrum | `SURVIVOR · UNBROKEN` | ebd. |
| Slot 1..6 | Bruchpunkt, Standhalten, Steingesicht, Aushalten, Zermürbung, Unbroken | `SLOTS_JE_DISC.breaking` |

Sechs Slot-Namen, und **alle sechs sind Ausharre-Worte**. Das ist keine Auslegungsfrage.

---

## 1. Chris' Befund, und warum er zutrifft

> „das das was man sieht sieht aus wie breakdance. entweder zeigst du immer nur 2 charaktere
> gegeneinadner die miteinadner interagieren um sich weh zu tun was ich vermutlich hier besser
> fände so ist das weird wenn alle im kreis stehen in der mitte kurz rein ploppen und dann punkte
> raus kommen. […] speed schach takeshi spurt usw sind wirklich gut und unique und man erkennt sie
> sofort - hier wird es schwer bei breaking es hervorzuheben"

Beide Hälften des Befunds sind nachprüfbar richtig, und beide lagen an der **Präsentation**, nicht
an der Mechanik.

### 1.1 „sieht aus wie breakdance" — das war wörtlich im Code

Drei Fundstellen, alle Rückstände des früheren Breakdance-Missverständnisses:

1. **Die Windmill.** `zeichneBreaking()` drehte die Figur bei `u.vizMove===2` mit
   `ctx.rotate(buehneT*9+u.id)` **um den Fußpunkt** — eine volle, laufende Rotation. Das ist die
   Bewegung, an der man einen Breakdancer erkennt, und sie lief in jedem vierten Durchgang.
2. **Die vier Posen.** `stepCypher()` belegte `vizMove` 0..3 mit *Toprock · Footwork · Powermove ·
   Freeze* — die vier Grundelemente des Breakdance, namentlich im Kommentar.
3. **Die Ticker-Worte.** `erfolgWort:"setzt den Move"` / `failWort:"Move bricht ab"` — genau der
   Satz, den Chris zitiert („das ist doch quasch sett den move"). Er stand in jeder Ticker-Zeile und
   in zwei Spaltenköpfen der Wertungstabelle.

### 1.2 „weird wenn alle im kreis stehen" — zwölf gleichrangige Figuren

Das alte Bild zeichnete alle zwölf Teilnehmer identisch: gleiche Größe, gleiche Helligkeit, jede
mit Namensschild, Punktzahl und Durchgangszähler. Der gerade Aktive unterschied sich durch einen
kleineren Radius — sonst durch nichts. Vor allem: **ihm stand niemand gegenüber.** Zwölf
gleichrangige Figuren sind zwölf Unbeteiligte, und ein Zweikampf braucht zwei Beteiligte.

Screenshot des Ist-Zustands: `docs/design/breaking-vorher-13-09.png`.

### 1.3 Was ausdrücklich NICHT das Problem war

Die Mechanik. `stepCypher()` markiert längst genau einen Aktiven, und `buehneQueue` wechselt
rundenweise zwischen den Seiten — die Struktur „einer ist dran, dann der andere" existiert seit
#875. Sie war nur nicht zu sehen. Entsprechend wird an ihr auch nichts geändert: `rundenN:8`,
`failAbzug:0.55`, das Rezept und die Kalibrierung aus `breaking-kalibrierung-10-09.md` (rho 0,869
kaderfest, K4) bleiben unangetastet.

---

## 2. Die Umsetzung

### 2.1 Das Zweierpaar — aus vorhandenem Zustand, ohne neue Mechanik

`bauBuehne()` baut `buehneQueue` rundenweise abwechselnd: für jede Runde, für jeden Index erst die
Heim-, dann die Gastfigur. Aufeinanderfolgende Queue-Paare `(2k, 2k+1)` sind deshalb **immer**
heim/gast — dieselben zwei Figuren, zweimal hintereinander enthüllt. Das ist bereits exakt die
Struktur, die Chris beschreibt: „einer schmerz zufügt der andere muss es aushalten dann ist wieder
der andere dran". Sie musste nur ausgelesen werden (`cypherPaar()`, rein lesend auf
`buehneQueue`/`buehneZeiger`).

**Rollenzuweisung — und warum herum.** Der gerade Enthüllte ist der **Ertragende**, nicht der
Peiniger. Begründung, nicht Geschmack: seine Runde wird gewertet, und alle sechs Slot-Namen dieser
Disziplin sind Ausharre-Worte (Tabelle in Abschnitt 0). Punkte entstehen hier durch **Aushalten**,
also gehört der Enthüllte in die Mitte unter das `SURVIVOR · UNBROKEN`-Spotlight, und sein
Paarpartner ist der, der ihm zusetzt. Beim nächsten Zug tauschen die beiden die Rollen, weil dann
der andere enthüllt wird — ein Rollentausch alle 0,625 s, ein vollständiger Schlagabtausch alle
1,25 s, und dasselbe Paar bleibt über beide Züge im Bild stehen.

> **Für die Review ausdrücklich markiert:** wäre die umgekehrte Zuweisung gewollt (der Aktive holt
> das Gerät und fügt zu, der andere erträgt), ist das ein Einzeiler — `cypherPaar()` gibt beide
> zurück, nur die Benennung an der Aufrufstelle dreht sich um. Die hier gewählte Richtung folgt den
> Slot-Namen; sie ist begründet, aber nicht unumstößlich.

### 2.2 Zwei Ränge statt zwölf gleicher

| Rang | Wer | Darstellung |
|---|---|---|
| 1 | die zehn Unbeteiligten | Faktor 0,72, **kein** Namensschild, am äußeren Ring, anschließend von einer Vignette abgedunkelt — Publikum |
| 2 | das Paar | volle Größe und Helligkeit, **nach** der Vignette gezeichnet, mit Rolle (`ERTRÄGT`/`PEINIGT`), Name, Punktzahl, Haltung, Gerät, Standlicht |

Die Vignette (ein radialer Verlauf über die ganze Fläche, in der Mitte durchsichtig) ist bewusst
das Mittel statt `globalAlpha` auf den Sprites: `zeichneSprite()` setzt für Effektfiguren
(`EFFEKT_ARTEN`) intern selbst `globalAlpha` und stellt es auf 1 zurück — ein von außen gesetztes
Alpha überlebt das nicht zuverlässig. Eine Fläche darüber schon.

**Standplätze.** Die beiden Duellanten rotieren nicht mit dem Ring mit, sondern stehen sich auf der
Waagrechten durch das Zentrum gegenüber (Heim 180°, Gast 0°) und halten diese Position, solange das
Paar läuft. Der Peiniger rückt zusätzlich nach, während sein Gegenüber aushält (Radiusfaktor
0,62 → 0,33), und weicht danach zurück. Das ist der ganze Unterschied zwischen „zwölf Leute drehen
sich im Kreis" und „diese zwei stehen sich gegenüber".

**Druckachse.** Drei Winkel vom Peiniger auf den Ertragenden, im Takt pulsierend. Sie beantwortet
die Frage, die das alte Bild offenließ: wer setzt hier gerade wem zu.

### 2.3 Vier Haltungen statt vier Breakdance-Moves

`u.vizMove` behält seine Ziehung (`cypherHash(u.id,u.aktuell)%4`) und seine vier Werte — nur die
Lesart im Bild ist neu:

| `vizMove` | alt (Breakdance) | **neu (Folter)** | Umsetzung |
|---:|---|---|---|
| 0 | Toprock | **Standhalten** | aufrecht, hochfrequentes Zittern kleiner Amplitude |
| 1 | Footwork | **Zusammenkrümmen** | um den Bodenpunkt gestaucht (0,80) |
| 2 | Powermove (Windmill) | **Aufbäumen** | begrenzte Kippung um den Fußpunkt, **keine volle Rotation** |
| 3 | Freeze | **Steingesicht** | absichtlich gar keine Transformation — in einem Bild, in dem alles wackelt, ist Stillstand die auffälligste Haltung |

Ausgänge: `hält stand` → aufgerichtet, Kinn hoch, goldener Ring (unverändert);
`bricht ein` → sackt weg, taumelt, roter Riss (unverändert).

### 2.4 Die Folterbank — zehn Geräte, die immer schlimmer werden

Chris, wörtlich:

> „evtl müssen wir dafür assets suchen wo die instrumente immer schlimmer werden mit denen man
> foltert sowas wie sägen oder große hämmer etc weißt du?" — „dass da so ein tisch ist mit 10
> folterinstrumenten und die charaktere nutzen die dann sogar und gehen zum tisch nehmen sie auf
> step by step und sie werden immer schlimmer"

**Keine Asset-Suche — aber nicht, weil es keine Asset-Pipeline gäbe.**

> **Korrektur nach dem Review (14.09.).** Die erste Fassung dieses Abschnitts (und der zugehörige
> Kommentar im Motor) behauptete, dieser Motor lade „kein einziges Bild" und `zeichneFalleTakeshi()`
> sei ein Beispiel für reine Primitive. **Beides ist falsch**, und der Review hat es zu Recht
> aufgegriffen. Nachgesehen, diesmal wirklich: `battle-mode.engine.js` lädt echte PNG-Blätter —
> `A_TEILE` aus `/sprites/arena/`, `SB_TEILE` aus `/sprites/buehne/`, `BK_TEILE` aus
> `/sprites/basketball/`, `FK_TEILE` aus `/sprites/football/`, je ein `new Image()` pro Kachel,
> jeder Ordner mit eigener `quellen.json`, mit dokumentiertem Rückfall über `aDa()` auf Primitive,
> falls ein Blatt fehlt. Und `zeichneFalleTakeshi()` ist gerade **kein** Gegenbeispiel, sondern
> einer der Hauptabnehmer dieser Kacheln (`ctx.drawImage(aBild.burg_mauer, …)`,
> `aBild.falle_tuer`, `aBild.falle_walze`).

Die Entscheidung selbst bleibt — nur ihre Begründung war unhaltbar. Die zehn Geräte werden von Hand
gezeichnet aus **Einfachheit und Gleichklang**: sie sind ~15–40 px groß, müssen im Griff-Frame des
Peinigers mitdrehen *und* flach auf dem Tisch liegen, und dafür gibt es mit `zeichneHantel()` — das
tatsächlich rein primitiv ist, kein `drawImage` — bereits das passende Vorbild im Haus. Ein eigenes
Folter-Blatt wären zehn neue Kacheln plus Lizenzrecherche für einen Effekt, den vier Pfade je Gerät
ebenso gut treffen. „Assets suchen" heißt hier also: zehn Geräte als einfache Primitive
**zeichnen**, im Maßstab der vorhandenen Requisiten (~15–40 px).

Die Leiter, mild nach schlimm — die beiden letzten sind wörtlich Chris' eigene Beispiele:

| # | Gerät | # | Gerät |
|---:|---|---:|---|
| 1 | STRICK | 6 | BRANDEISEN |
| 2 | RUTE | 7 | KEIL |
| 3 | PEITSCHE | 8 | NAGELKEULE |
| 4 | DAUMENSCHRAUBE | 9 | **SÄGE** |
| 5 | ZANGE | 10 | **VORSCHLAGHAMMER** |

Jede `zeichne(c)`-Funktion arbeitet in einem bereits verschobenen, gedrehten und skalierten Frame:
Ursprung = **Griff**, das Gerät reicht nach +x. Dieselbe Funktion zeichnet das Gerät deshalb einmal
liegend auf dem Tisch und einmal in der Faust des Peinigers — keine zweite Zeichenroutine.

**Die Stufe folgt dem Durchgang** (`folterStufe(u.aktuell, art.rundenN)`, auf die volle Breite der
zehn Geräte gespreizt: Durchgang 1 beginnt beim Strick, der letzte endet beim Vorschlaghammer).
Bei `rundenN:8` bleiben zwei Sprossen übersprungen; sie liegen trotzdem sichtbar auf dem Tisch.
Das ist Absicht: „es wird immer schlimmer" ist erst zu sehen, wenn man sieht, **was noch kommt**.
Benutzte Geräte sind ausgegraut, das aktuelle fehlt (es ist in der Faust) und sein Platz ist golden
markiert, die kommenden stehen gedämpft bereit.

Der Tisch steht im Vordergrund am unteren Rand — nach der Vignette gezeichnet, also nicht
abgedunkelt, und an einer Stelle, an der bei dieser Bühne ohnehin nichts steht.

**Nicht umgesetzt, bewusst:** ein echter Gang *zum Tisch und zurück*. Ein Zug dauert
`rundenDauer:0.625 s`, und darin stecken bereits Eintritt (0,15) + Throwdown (0,25) + Ausgang (0,15)
= 0,55 s. Für einen sichtbaren Hin- und Rückweg ist kein Budget da, ohne die Zustandsmaschine zu
verlängern — und die hängt an `rundenDauer`, also an einer kalibrierten Zahl. Der Griff zum Tisch
ist deshalb über den *leeren, golden markierten Platz* erzählt statt über einen Laufweg. Wenn Chris
den Gang selbst sehen will, ist das eine eigene Runde mit einer Timing-Frage im Kern.

### 2.5 Die zwei Seitentafeln — das Wiedererkennungszeichen

`rOut = min(W*0,46; H*0,44)` ist höhenbegrenzt; bei Breitbild bleiben links und rechts des Rings je
~400 px leer (im Vorher-Screenshot gut zu sehen). Dort steht jetzt die Information, die das Bild
bisher gar nicht hatte: **wer gegen wen, mit welcher Rolle**, mit Name, Punktzahl und Durchgang.
Das ist das Gegenstück zu Speed-Schachs Brett, Spurts Bahnen und Takeshis Parcours — das Element,
an dem man die Disziplin auf einen Blick erkennt, und damit die direkte Antwort auf „hier wird es
schwer bei breaking es hervorzuheben".

### 2.6 Die Worte

| | alt | **neu** |
|---|---|---|
| `erfolgWort` | „setzt den Move" | **„hält stand"** |
| `failWort` | „Move bricht ab" | **„bricht ein"** |

Sichtbar im Ticker (`… — hält stand (106 Punkte, Durchgang 2/8).`), in zwei Spaltenköpfen der
Wertungstabelle und im Regel-Erklärtext.

**Rangtreue-neutral per Bauart, nicht per Hoffnung:** beide Werte werden im gesamten File
ausschließlich über `art.erfolgWort` / `art.failWort` gelesen und immer nur gegen sich selbst
verglichen — `:11549`/`:11552` schreiben `ereignis`, alle Vergleichsstellen lesen denselben
`art`-Wert zurück. **Kein einziger Vergleich gegen ein Stringliteral** (nachgeprüft über alle
Fundstellen von `erfolgWort`/`failWort`). Der Wert ist ein Etikett, kein Eingabewert.

### 2.7 Zwei Slot-Beschreibungen, die der erste Anlauf übersehen hat (14.09.)

Der Review hat nachgefasst, wo dieser PR nur den Ticker aufgeräumt hatte: **die Slot-Beschreibungen,
die Chris in der Aufstellung liest**, trugen weiter Tanz-Vokabular. Zwei von sechs:

| Slot | alt | **neu** |
|---|---|---|
| `powermove` / **Bruchpunkt** | „Treibt den schwersten **Move** bis zum Bruchpunkt …" | „Treibt den schwersten **Hieb** bis zum Bruchpunkt …" |
| `musicality` / **Aushalten** | „Findet den **Rhythmus** im bloßen Aushalten …" | „Findet die **Ruhe** im bloßen Aushalten …" |

„Hieb" ist dabei kein neues Wort, sondern dasselbe, das Abschnitt 5 schon als künftigen
Ton-Schlüsselnamen vorschlägt; „Ruhe" hält die Satzform und tauscht nur die Musik gegen das, was der
Slot tatsächlich belohnt (`will`/`determination`, `mueh:"low"`).

**In beiden Dateien gleichlautend**, weil es zwei Spiegel derselben Tabelle sind:
`SLOTS_JE_DISC.breaking[*].text` in `public/mockups/battle-mode.engine.js` und
`roleTheme(..., description, ...)` in `lib/lineups/matchday-slot-roles.ts`. `id`, `gross`/`klein`/
`last`, `mueh` und `profil` bleiben in beiden unangetastet — nur der Anzeigetext ändert sich, und
kein Pfad liest ihn je als Wert.

Die vier übrigen Beschreibungen bleiben, wie sie sind: sie sind bereits Ausharre-Sprache. Die
internen `id`s (`powermove`, `footwork`, `freezecontrol`, `musicality`) bleiben ebenfalls stehen —
sie sind der Vertrag zwischen den beiden Dateien und den gespeicherten Aufstellungen, nicht
Anzeigetext. Sie umzubenennen ist eine eigene Runde mit Migration, siehe Abschnitt 5.

---

## 3. Was NICHT angefasst wurde

`rezept`, `failAbzug`, `rundenN`, `rundenDauer`, die Attributmatrix, `SLOTS_JE_DISC.breaking`
(`id`/`profil`/`gross`/`klein`/`last`/`mueh`), `stepBuehne()`, `bauBuehne()`, `WERTUNG_AUFTRITT`,
jede andere `BUEHNE_ART`, `zeichneHeben()`, `zeichneSchach()`, `zeichneKuer()`, `zeichneSprite()`.

An `lib/lineups/matchday-slot-roles.ts` ändern sich seit dem 14.09. **zwei `description`-Strings**
und sonst nichts (Abschnitt 2.7) — die Datei stand vorher auf dieser Liste, steht jetzt mit dieser
einen Einschränkung dort. Rollen-`id`s, Attribut-Fokus, `strain`, `fatigueProfile` und
`classHints` sind unberührt; die `roleTheme`-Signatur ebenso.

**Der Ton ist unverändert.** `TON_KATALOG.breaking` behält alle vier Schlüssel, und die drei
`sfx()`-Aufrufe in `stepCypher()` stehen an derselben Stelle mit derselben Bedingung wie vorher —
gleiche Auslöser, gleiche Kadenz, kein Leck und kein neuer Loop. Der Schlüssel `"powermove"` heißt
weiterhin so, obwohl das Breakdance-Vokabular ist: er wird außerhalb der beiden Breaking-Regionen in
einem Staffel-Kommentar zitiert, an dem gerade parallel gearbeitet wird. Eine Umbenennung wäre die
einzige Zeile dieses PRs außerhalb von Breaking und damit der einzige Konfliktpunkt — sie gehört in
eine eigene, kleine Aufräumrunde.

---

## 4. Verifikation

| Prüfung | Ergebnis |
|---|---|
| Spiegelfrische (`pruefe-spiegel-frische.ts`) | beide frisch (`live-save` 0,0 h, `bug-reports` 0,2 h), vor der Arbeit geprüft |
| `node --check public/mockups/battle-mode.engine.js` | bestanden |
| `npx tsc --noEmit` | 906 Zeilen hier wie auf `main`, **dieselben Meldungen** (alle in `tests/`) — s. Anmerkung unten |
| `npx tsx scripts/pruefe-slot-invariante.ts` | hält, max. Abweichung 0,005 Pp über alle 20 × 6 |
| `node scripts/miss-alle-disziplinen.mjs 24` (alle zwanzig) | **bit-identisch** — `diff` liefert nichts, beide Ergebnisdateien mit MD5 `bbad04182726bd6c9a0c0a76f122ab2c` |
| Playwright-Screenshots | `Seitenfehler: keine` in jedem Lauf; s. Tabelle unten |
| `ctx.save()`/`ctx.restore()` in `zeichneBreaking()` | 5/5, ausgeglichen (maschinell nachgezählt) |

**Nachmessung 14.09., nach dem Review und nach dem Merge von `main`.** Beide Läufe frisch gefahren,
weil `main` seit dem 13.09. mehrere rangtreue-wirksame Runden aufgenommen hat (Puste #914,
Sprite-Bildindex #915, Staffel #916, Eiskunstlauf #917, Höhenkorrektur #918) — die alte MD5 aus der
ersten Messung gilt deshalb nicht mehr, und ein Vergleich gegen sie wäre wertlos gewesen. Basislauf
auf `48aede4d` (`origin/main`, nur `battle-mode.engine.js` auf den Stand von `main` zurückgetauscht),
Nachlauf auf diesem Branch. `diff` liefert **keine einzige Zeile**; Breaking steht in beiden bei
`0,869 / 0,114 / 0,951 / 0,168 · bestanden`.

*Zwischendurch ist `main` zweimal weitergezogen (`7a07de2f` → `48aede4d`, u. a. PR #917, das den
Motor anfasst). Die Messung wurde deshalb **beidseitig wiederholt**, statt den alten Basislauf
weiterzuverwenden — ein Basislauf gegen einen überholten `main` beweist nichts. Beide Paare
liefern dieselbe Datei, MD5 `bbad04182726bd6c9a0c0a76f122ab2c`.*

Dass das auch für die Korrekturen dieser Runde gilt, ist keine Überraschung, sondern Bauart: die
beiden geänderten `text:`-Strings sind Anzeigetexte aus `SLOTS_JE_DISC`, das geänderte `FÜGT ZU` ist
ein Literal in einer `ctx.fillText`-Zeile, und der Rest sind Kommentare, Bilder und Dokumentation.
`disziplinProbe()`/`miss-alle-disziplinen.mjs` durchlaufen die Zeichenfunktionen ohnehin nie.

**Anmerkung zu `tsc`:** die einzige geänderte Codedatei ist `public/mockups/battle-mode.engine.js`,
und `tsconfig.json` listet unter `include` ausschließlich `**/*.ts`, `**/*.tsx` und `**/*.mts` —
**keine `.js`**. Die Datei ist trotz `allowJs:true` gar nicht Teil des TypeScript-Programms; eine
Änderung darin kann die `tsc`-Ausgabe nicht bewegen. Die verbleibenden Meldungen (alle in `tests/`)
stehen unverändert auch auf `main`.

**Die Bildbelege.** Das Vorher-Bild stammt weiter aus
`node scripts/screenshot-disziplin.mjs breaking <ms> <datei>`. Die drei **Nachher-Bilder sind am
14.09. neu aufgenommen** — mit `node docs/design/breaking-bildbeleg-sonde-13-09.mjs <ordner> [n]`,
und aus **einem** Lauf, damit die Namen zueinander passen.

> **Warum neu (Review-Fund 14.09.).** Die erste Fassung dieser Bilder war mit einer festen
> Millisekunde geschossen und traf die Bühne dadurch systematisch daneben: der Callout-Banner oben
> springt **nur** bei `big` (`r.punkte>=60`) um, der SURVIVOR-Scheinwerfer dagegen bei **jeder**
> Enthüllung alle 0,625 s — und `cv.screenshot()` selbst braucht unter Last länger als eine
> Rundendauer. Das Bild war also regelmäßig eine Enthüllung weiter als der Banner, und im
> `-mitte`-Bild fiel der Schuss zusätzlich in einen Frame, in dem die Sprite-Bildindex-Rechnung
> (inzwischen auf `main` mit einem `Math.max(0,…)`-Clamp repariert, PR #915) die Figur des
> Ertragenden gar nicht zeichnete: leerer Scheinwerfer mit schwebendem Schild. **Kein Fehler
> dieser Runde und keiner, den es noch gibt** — aber die Bilder belegten dadurch das Gegenteil
> dessen, was ihre Bildunterschrift behauptete.
>
> Die neue Sonde erkennt den Bannerwechsel **im Browser** und hält die Simulation dort per Klick
> auf `#play` an, bevor irgendetwas nach Node zurückgeht (260 ms nach dem Wechsel — Eintritt und
> Throwdown sind dann durch, die nächste Enthüllung noch nicht da). Der Screenshot fällt danach
> auf ein stehendes Bild.

| Datei | zeigt |
|---|---|
| `breaking-vorher-13-09.png` | der Ist-Zustand: zwölf gleichrangige Figuren, der Aktive nicht erkennbar, Ticker „setzt den Move" |
| `breaking-nachher-13-09-mitte.png` | Durchgang 5/8, Stufe 6/10 (Brandeisen): der Ertragende (Krolach) im Scheinwerfer **auf** dem SURVIVOR-Kern, der Peiniger (Tidesprinter) von seiner Seite her mit dem glühenden Eisen, Druckachse dazwischen |
| `breaking-nachher-13-09-stufe4.png` | Stufe 4/10 (Daumenschraube); die drei benutzten Geräte ausgegraut, der Platz des aktuellen golden leer, Ticker „hält stand" |
| `breaking-nachher-13-09-stufe7.png` | Stufe 7/10 (Keil); sechs ausgegraut, **Nagelkeule, Säge und Vorschlaghammer sichtbar noch bevorstehend** — der Beleg, dass die Eskalation im Bild ankommt |

Eine Gegenprobe, die beim Lesen der Bilder hilft: in allen drei Nachher-Bildern trägt der Ticker
denselben Namen wie die mit `ERTRÄGT` beschriftete Figur, **und beide Figuren sind gezeichnet**.
Das ist kein Zufall, sondern der Beweis, dass `cypherPaar()` dieselbe Figur als Ertragenden führt,
die `stepBuehne()` gerade enthüllt hat — die Sonde erzwingt genau diesen Frame.

**Ein Wort gleich lautend, nicht zwei.** Ebenfalls aus dem Review: die Seitentafel beschriftete den
Peiniger mit `FÜGT ZU`, sein eigenes Sprite-Schild im selben Bild mit `PEINIGT`. Zwei Wörter für
dieselbe Rolle in derselben Szene. Beide sagen jetzt `PEINIGT` — das Wort, das auch der Fließtext
dieses Dokuments durchgehend benutzt.

**Die Messung im Detail (Stand 14.09.).** Basislauf auf `origin/main` = `48aede4d`, Nachlauf auf
dem gemergten Stand dieses Branches. Breaking steht in beiden Läufen bei
`0,869 / 0,114 / 0,951 / 0,168 · bestanden` — exakt die in CLAUDE.md und
`breaking-kalibrierung-10-09.md` dokumentierte Zahl. Alle übrigen neunzehn Zeilen stimmen ebenfalls
zeichengenau überein; `diff` über die vollständigen Ausgaben ist leer.

*(Die frühere Messung vom 13.09. stand gegen den damaligen Abzweigpunkt `ec9190c5` und meldete MD5
`4d31300812cc22ad39693d196a6d72ab`. Die Zahl ist überholt: `main` hat seither vier
rangtreue-wirksame Runden aufgenommen, also wurden beide Seiten neu gefahren.)*

Ein Wort zur Durchführung, weil es für die nächste Runde nützlich ist: auf dieser Maschine arbeiten
mehrere Agenten gleichzeitig, und unter der Last stirbt Playwright reproduzierbar mit
`Target page, context or browser has been closed`. Drei Läufe sind daran gescheitert, bevor einer
durchlief. Das Messskript wurde deshalb in eine Wiederholschleife gepackt, die zusätzlich die
**MD5-Summe der Motordatei vor und nach dem Lauf** vergleicht — ein Lauf, während dessen die Datei
sich ändert (z. B. durch einen Merge), ist wertlos und wäre sonst unbemerkt geblieben. Der gewertete
Lauf meldet `public/mockups/battle-mode.engine.js: OK`.

Warum die Rangtreue per Konstruktion unberührt bleibt, hält der Code an derselben Stelle fest, an
der es schon für `zeichneHeben()` steht: `disziplinProbe()`/`miss-alle-disziplinen.mjs` rufen
`stepBuehne()` direkt mit festem `1/60` auf und durchlaufen die Zeichenfunktionen **nie**.
`stepCypher()` läuft zwar mit, unterliegt aber dem harten `viz`-Vertrag — kein `rr()`, keine
Schreibzugriffe auf `u.summe`/`u.runden`/`u.aktuell`/`u.lunge`/`buehneAkt`/`buehneZeiger`/`done`.
Diese Runde schreibt weiterhin ausschließlich auf `viz*`-Felder und liest `buehneQueue`/
`buehneZeiger` nur.

---

## 5. Offen für eine nächste Runde

1. **Der Gang zum Tisch** (Abschnitt 2.4) — braucht eine Antwort auf die Timing-Frage.
2. **Die Rollenrichtung** (Abschnitt 2.1) — Einzeiler, falls Chris sie andersherum will.
3. **`TON_KATALOG.breaking`-Schlüssel** umbenennen (`powermove` → `hieb`) samt des zitierenden
   Staffel-Kommentars, wenn dort gerade nicht gearbeitet wird.
4. **Eigene Folter-Geräusche** je Eskalationsstufe — heute klingt der Vorschlaghammer wie der
   Strick.
5. **Die internen Breakdance-`id`s** (`powermove`, `footwork`, `freezecontrol`, `musicality`) —
   nicht sichtbar, aber irreführend beim Lesen. Sie stehen in beiden Slot-Tabellen **und** in
   gespeicherten Aufstellungen; eine Umbenennung braucht deshalb eine Migration und gehört nicht
   in eine Präsentationsrunde.
6. **Kommentar-Reste in `app/foundation/discipline-stage/arena/disciplines/breaking.tsx`**
   („Cypher-Boden", „Linoleum-Kreis"). Rein in Kommentaren, kein gerenderter Text — die dortigen
   sichtbaren Beschriftungen (`GEBROCHEN`/`SCHMERZGRENZE`/`STONE FACE`/`MIND FORTRESS`) sind
   bereits durchgehend Folter-Vokabular. Bewusst nicht in diesem PR, weil die Datei sonst nicht
   angefasst wird.
