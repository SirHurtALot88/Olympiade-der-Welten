# Breaking — der Folter-Zweikampf wird sichtbar (Präsentation, 13.09.)

**Reine Präsentationsrunde.** Kein Rezept, keine Matrix, keine Rundenzahl, kein `failAbzug`, keine
Zeile in `wert()`. Gemessen vorher und nachher mit `node scripts/miss-alle-disziplinen.mjs 24` über
alle zwanzig Disziplinen; Erwartung und Ergebnis: **bit-identisch**.

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

**Keine Asset-Suche, weil es keine Asset-Pipeline gibt** — nachgesehen, nicht vermutet: dieser Motor
zeichnet jede Requisite als Canvas-Primitive (`zeichneHantel()` für die Hantel, `zeichneFalleTakeshi()`
für Takeshis Fallen, der Uhrenblock in `zeichneSchach()`). Es wird kein einziges Bild geladen.
„Assets suchen" heißt hier: zehn Geräte als einfache Primitive **zeichnen**, im Maßstab der
vorhandenen Requisiten (~15–40 px).

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

---

## 3. Was NICHT angefasst wurde

`rezept`, `failAbzug`, `rundenN`, `rundenDauer`, die Attributmatrix, `SLOTS_JE_DISC.breaking`
(`id`/`profil`/`gross`/`klein`/`last`/`mueh`), `lib/lineups/matchday-slot-roles.ts`, `stepBuehne()`,
`bauBuehne()`, `WERTUNG_AUFTRITT`, jede andere `BUEHNE_ART`, `zeichneHeben()`, `zeichneSchach()`,
`zeichneKuer()`, `zeichneSprite()`.

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
| `npx tsc --noEmit` | Diff gegen `main` leer — s. Anmerkung unten |
| `npx tsx scripts/pruefe-slot-invariante.ts` | hält, max. Abweichung 0,005 Pp über alle 20 × 6 |
| `node scripts/miss-alle-disziplinen.mjs 24` (alle zwanzig) | **bit-identisch** vorher/nachher |
| Playwright-Screenshots | `Seitenfehler: keine` in jedem Lauf; s. Tabelle unten |
| `ctx.save()`/`ctx.restore()` in `zeichneBreaking()` | 5/5, ausgeglichen (maschinell nachgezählt) |

**Anmerkung zu `tsc`:** die einzige geänderte Codedatei ist `public/mockups/battle-mode.engine.js`,
und `tsconfig.json` listet unter `include` ausschließlich `**/*.ts`, `**/*.tsx` und `**/*.mts` —
**keine `.js`**. Die Datei ist trotz `allowJs:true` gar nicht Teil des TypeScript-Programms; eine
Änderung darin kann die `tsc`-Ausgabe nicht bewegen. Die verbleibenden Meldungen (alle in `tests/`)
stehen unverändert auch auf `main`.

**Die Bildbelege** (alle mit `node scripts/screenshot-disziplin.mjs breaking <ms> <datei>`):

| Datei | zeigt |
|---|---|
| `breaking-vorher-13-09.png` | der Ist-Zustand: zwölf gleichrangige Figuren, der Aktive nicht erkennbar, Ticker „setzt den Move" |
| `breaking-nachher-13-09-mitte.png` | Durchgang läuft: der Ertragende im Scheinwerfer **auf** dem SURVIVOR-Kern, der Peiniger von seiner Seite her, Druckachse dazwischen |
| `breaking-nachher-13-09-stufe4.png` | Stufe 4/10 (Daumenschraube); die drei benutzten Geräte ausgegraut, Ticker „hält stand" |
| `breaking-nachher-13-09-stufe7.png` | Stufe 7/10 (Keil); sechs ausgegraut, **Nagelkeule, Säge und Vorschlaghammer sichtbar noch bevorstehend** — der Beleg, dass die Eskalation im Bild ankommt |

Eine Gegenprobe, die beim Lesen der Bilder hilft: in allen drei Nachher-Bildern trägt der Ticker
denselben Namen wie die mit `ERTRÄGT` beschriftete Figur. Das ist kein Zufall, sondern der Beweis,
dass `cypherPaar()` dieselbe Figur als Ertragenden führt, die `stepBuehne()` gerade enthüllt hat.

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
