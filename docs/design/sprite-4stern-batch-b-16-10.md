# Sprite-4-Sterne-Batch B (16.10.) — 17 Charaktere, je eine punktuelle Korrektur

Auftrag: 17 Charaktere standen auf ★★★★ (`data/generated/sprite-fit-bewertung.json`), bei
jedem war laut `fehlendesDetail` genau EIN klar benennbares Detail die Lücke zur vollen 5
(Rubrik: [`sprite-fit-bewertungssystem.md`](./sprite-fit-bewertungssystem.md)). Vorgehen und
Doku-Form nach dem Muster von [`sprite-cluster-runde-1.md`](./sprite-cluster-runde-1.md):
Portrait gegen `public/sprites/preview/<slug>.png` ansehen, punktuelle `BAU`-Korrektur über
vorhandene Baukasten-Primitive, `sprite-fit-bewertung.json` im selben Commit nachziehen
(Grundsatz "Score folgt dem Sprite").

## Ergebnis in Kürze

Von 17 Charakteren erreichen **2 die volle 5** (Nahli-Ke, Vigil) über eine punktuelle, am
`renderProbe`-Abbild bestätigt sichtbare Korrektur. Bei **10 weiteren** wurde das Rezept
ebenfalls punktuell korrigiert (bestmögliche Näherung über vorhandene Primitive,
Grundsatz "eine unvollständige Näherung schlägt immer keinen Fix"), der Fix bleibt aber aus
einem von zwei dokumentierten, strukturellen Gründen in der GESPEICHERTEN Vorschau
unsichtbar oder nur teilweise wirksam — die Sterne-Zahl bleibt ehrlich bei ★★★★, mit
aktualisierter Begründung. Bei **5 Charakteren** ergab die Prüfung, dass im Baukasten
schlicht kein passendes Primitiv existiert (bestätigt, nicht vermutet) — unverändert
gelassen, Lücke im Code UND in der Bewertung dokumentiert, keiner stillschweigend
übersprungen (Grundsatz "Assets werden nie exklusiv reserviert" /
"eine unvollständige Näherung schlägt immer keinen Fix" gilt auch dort, wo selbst die
Näherung an einer harten Grenze scheitert).

**Kein Charakter wurde schlechter bewertet. Keiner der 15 geänderten/geprüften Fälle verlor
ein bereits zutreffendes Detail.**

| Charakter | Vorher | Nachher | Art der Korrektur |
|---|---:|---:|---|
| Nahli-Ke | ★★★★ | **★★★★★** | `ruest` entfernt — nackte, schlanke Alien-Silhouette statt brauner Rüstung |
| Vigil | ★★★★ | **★★★★★** | Tropf-Faden-Farbe angehoben — war im Code, aber unsichtbar (dunkelgrün auf dunkelgrau) |
| Nelchael | ★★★★ | ★★★★ | `waffe:"stab"` (Kräuterbündel-Näherung) — nur im Angriffsframe sichtbar |
| Nhyra-Vel | ★★★★ | ★★★★ | `effekt:"arkan"` (Sternenglühen-Näherung) — in der Steh-Pose-Vorschau kaum sichtbar |
| Serena | ★★★★ | ★★★★ | Befund: Schwert war bereits im Rezept; Vorschau-Pose zeigt grundsätzlich keine Nahkampfwaffen |
| Shield | ★★★★ | ★★★★ | geprüft: kein Hammer-Layer, axt/zweihaender keine bessere Näherung — unverändert |
| Skittermind | ★★★★ | ★★★★ | `haut:"green"` (türkis-grün-Näherung) sichtbar korrigiert; Boden-Requisite bleibt unlösbar |
| Sweet Dreams | ★★★★ | ★★★★ | `waffe:"stab"` (Zepter/Dreizack-Näherung) — nur im Angriffsframe sichtbar; violetter Akzent unlösbar |
| Threnox | ★★★★ | ★★★★ | geprüft: kein Instrumenten-Layer — unverändert |
| Tidesinger | ★★★★ | ★★★★ | `effekt:"frost"` (Türkis-/Wirbel-Näherung) sichtbar; Grundhautfarbe bleibt Grau-Blau |
| Vargan | ★★★★ | ★★★★ | `waffe:"stab"` (Speer-Näherung) — nur im Angriffsframe sichtbar |
| Xelara | ★★★★ | ★★★★ | geprüft: Kragen-Layer liegt unverdrahtet als Datei vor, keine punktuelle Korrektur möglich |
| Xerathis | ★★★★ | ★★★★ | `effekt:"frost"` (Türkis-Näherung) ergänzt, in der Steh-Pose-Vorschau kaum sichtbar |
| Xylaris | ★★★★ | ★★★★ | `ruestTon:"gold"` sichtbar korrigiert; Grünanteil und Stab-Symbol bleiben unlösbar |
| Grieving Colossus | ★★★★ | ★★★★ | geprüft: kein Ketten-Layer, keine kauernde Pose im Blatt — unverändert |
| Orakelpfropf | ★★★★ | ★★★★ | geprüft: Katzen-Sheet hat keine Tabby-Variante — unverändert, Befund jetzt bestätigt statt "evtl." |
| Phantomblade | ★★★★ | ★★★★ | geprüft: kein Augenbinden-Slot, Dolch-Näherung (Schwert) bereits etabliert — unverändert |

## Der wichtigste Einzelfund: die Steh-Pose-Vorschau zeigt nie eine Nahkampfwaffe

`public/sprites/preview/<slug>.png` (die Datei, die die Sprite-Fit-Bewertung vergleicht)
entsteht über `scripts/erzeuge-sprite-vorschauen.mjs` als `renderProbe(name)` **ohne**
`ani`-Argument — eine reine Steh-/Lauf-Pose. Laut `public/sprites/baukasten/README.md` haben
alle vier Nahkampfwaffen (Schwert/Axt/Stab/Zweihänder) im Baukasten **nur ein
Angriffsblatt**, kein Steh-/Laufblatt — die Waffe ist in dieser Pose grundsätzlich
unsichtbar, unabhängig vom Rezept. Nachgewiesen am eigenen 5-Sterne-Anker: King Arlen
Morgolor (`"King Arlen Morgolor": {kopf:"human",...}`, **kein** `waffe`-Feld) gilt als
vollständiger Treffer, obwohl das Portrait ihn mit erhobenem Schwert zeigt — der Anker-Text
selbst nennt nur Rüstung und Krone, kein Schwert.

Betroffen in diesem Batch: **Serena** (Schwert war schon im Rezept, nur die Vorschau zeigt es
nicht), **Nelchael/Vargan/Sweet Dreams** (neue Waffen-Näherung ergänzt, aus demselben Grund
nicht sichtbar). Per `renderProbe(name,"slash",true,dir,lunge,256)` im Angriffsframe
bestätigt, dass die Waffe dort jeweils korrekt sitzt — nur eben nicht in der gespeicherten
Vorschau-Datei. Das ist eine **Grenze der Vorschau-Generierung**, keine Rezept-Lücke, und
betrifft strukturell jeden Nahkampf-Charakter im Repo gleichermaßen (nicht nur die hier
bearbeiteten). Keine Sterne-Inflation darüber — die Sprite-Fit-Rubrik vergleicht ausdrücklich
das gespeicherte Vorschaubild, und das zeigt die Waffe tatsächlich nicht. Empfehlung für eine
künftige Runde: `erzeuge-sprite-vorschauen.mjs` um einen zweiten Angriffsframe je
waffentragendem Charakter erweitern, statt die Rubrik an diesem blinden Fleck vorbeizuführen.

Ein verwandter, aber andersartiger Befund bei den `effekt`-Korrekturen (Nhyra-Vel, Xerathis,
teils Tidesinger): die Partikelformeln hängen von einer Simulationszeit `t` ab, die bei einer
isolierten `renderProbe()`-Momentaufnahme faktisch bei 0 steht. Je nach Bewegungsmuster
(`EFFEKT_ARTEN`) ist die Alpha an diesem festen Zeitpunkt für die meisten Partikel null oder
nahe null — "funkelnd" (arkan) fast vollständig, "schwebend" (frost) nur teilweise (ein bis
zwei von drei Partikeln bleiben sichtbar, s. Tidesinger). Derselbe Befund bestätigt sich an
bereits bestehenden `effekt`-Fällen im Repo (Ciacia/arkan, Grizz/frost): deren gespeicherte
Vorschauen zeigen ebenfalls keine klar erkennbaren Partikel, obwohl der Effekt im laufenden
Spiel sichtbar funkelt/schwebt.

## Strukturelle Lücken, nachgeprüft statt vermutet

Fünf Charaktere (Shield, Threnox, Grieving Colossus, Orakelpfropf, Phantomblade) sowie Xelara
(neu bei dieser Prüfung entdeckt) benötigen ein Requisiten-/Material-Primitiv, das im
Baukasten schlicht nicht existiert:

| Charakter | Fehlendes Primitiv | Nachgeprüft über |
|---|---|---|
| Shield | Hammer-/Blunt-Waffenlayer | `axt_fg`/`zweihaender_fg` als Bilder angesehen — beide gekrümmte Klingen, keine Hammerform |
| Threnox | Instrumenten-/Requisiten-Layer in der Hand | `waffe`-Feld kennt nur axt/bogen/stab/schwert/zweihaender/pistole; kein genereller Hand-Requisiten-Slot |
| Grieving Colossus | Ketten-/Fessel-Layer, kauernde Vierbeiner-Pose | repo-weite Suche nach `*kette*`/`*chain*` ohne Treffer; `golem_walk.png` nur aufrechte Pose |
| Orakelpfropf | Tabby-/Streifen-Textur auf dem Katzen-Sheet | `katze/quellen.json`: nur vier einfarbige Varianten (weiß/gold-tan/braun/schwarz), keine getigerte |
| Phantomblade | Augenbinden-/Stirnband-Slot | `kapuze`/`helm` sind vollflächige Kopfbedeckungen, würden das korrekt treffende weiße Haar verdecken |
| Xelara | Hoher, kantiger Uniformkragen | `anzug_jacke*.png` liegt als Datei vor, ist aber nicht in `B_SPRITES` eingebunden und führt kein `slash`-Blatt — Einbinden wäre neue Engine-Verdrahtung |

Alle sechs Lücken sind jetzt sowohl im Code (Kommentar an der jeweiligen `BAU`-Zeile) als
auch im `begruendung`/`fehlendesDetail`-Feld der Bewertung dokumentiert — nicht
stillschweigend ausgelassen (Grundsatz "eine unvollständige Näherung schlägt immer keinen
Fix": hier gibt es noch nicht einmal eine unvollständige Näherung, die besser wäre als der
Status quo, darum unverändert gelassen, nicht stillschweigend).

## Vorgenommene Korrekturen im Detail

- **Nahli-Ke**: `ruest:"leder_frau"` entfernt. Der braune, kastenförmige Brustharnisch
  verdeckte die schlanke Alien-Silhouette, die der Kopf schon traf. Ohne Rüstung zeigt sich
  der nackte Körper in `haut:"lavender"` — dasselbe Muster wie beim bereits unbekleideten
  Nhyra-Vel. Per `renderProbe` bestätigt sichtbar.
- **Vigil**: der Tropf-Faden am Kamera-Gehäuse (`zeichneKameraKopf`) existierte bereits seit
  01.09., aber in dunklem Olivgrün (`#232f23`) auf fast gleich dunklem Gehäuse (`#26262a`) —
  am 8-fach vergrößerten `renderProbe`-Abbild praktisch unsichtbar. Farbe auf helles
  Blaugrau mit kleinem Glanzpunkt angehoben (reine Farbkorrektur, keine neue Form) — jetzt
  deutlich sichtbar.
- **Nelchael**: `waffe:"stab"` ergänzt (Kräuter-/Stockbündel-Näherung).
- **Nhyra-Vel**: `effekt:{typ:"arkan",pos:"koerper"}` ergänzt (Sternenglühen-Näherung, für
  einen Sternenhimmel-Look entworfen, s. `EFFEKT_ARTEN`/Starflame-Kommentar).
- **Skittermind**: `haut:"blue"` → `"green"` (türkis-grün-Näherung, sichtbar korrigiert).
- **Sweet Dreams**: `waffe:"schwert"` → `"stab"` (Zepter-/Dreizack-Näherung).
- **Tidesinger**: `effekt:{typ:"frost",pos:"koerper"}` ergänzt (Türkis-/Wasserwirbel-
  Näherung, teilweise sichtbar auch im Standbild).
- **Vargan**: `waffe:"schwert"` → `"stab"` (Speer-Näherung).
- **Xerathis**: `effekt:{typ:"frost",pos:"koerper"}` ergänzt (Türkis-Akzentlinien-Näherung).
- **Xylaris**: `ruestTon:"gold"` ergänzt (Gold-Anteil der Robenfärbung, sichtbar korrigiert).
- **Serena, Shield, Threnox, Grieving Colossus, Orakelpfropf, Phantomblade, Xelara**: Rezept
  unverändert, Befund/Prüfung im Code und in der Bewertung dokumentiert (s. oben).

## Verifikation

**Syntax:**

```
node --check public/mockups/battle-mode.engine.js
```

→ OK.

**Nur die `BAU`-Tabelle und `zeichneKameraKopf` angefasst:** `git diff --stat` zeigt alle 15
Änderungs-Hunks ausschließlich im Bereich der `BAU`-Tabelle (Zeilen ~1526–2584) und der
`zeichneKameraKopf`-Funktion (Zeile ~247) — keine Berührung von `aufEignung`, `MOTOREN` oder
sonstiger Simulationslogik.

**Grep-Nachweis, über die blanke Behauptung aus früheren Runden hinaus nachgeprüft:**
`BAU`/`zeichneSprite`/`figur` sind reine Zeichenfunktionen — aber `BAU[...]` wird an ein paar
Stellen AUSSERHALB dieser Zeichenfunktionen gelesen (`grep -n "BAU\["`), und das wurde hier
einzeln nachgeprüft statt pauschal übernommen:

- `bauSkala(BAU[...])` (Hockeyschläger-Griffpunkt, Showcase-/Kader-Icon-Größe): liest nur
  `b.skala` — von keiner der 17 Korrekturen in diesem Batch angefasst.
- `(BAU[u.n]||BAU_STD).vollbild` (Showcase-Größenkappung `Math.min(sk,1.3)`): nur ein
  Wahrheitstest auf `b.vollbild` — von keiner der 17 Korrekturen angefasst (kein `vollbild`
  neu gesetzt oder entfernt).
- `actVon(u)` liest `b.waffe`/`b.vollbild`/`b.fluegel`/`b.effekt` und bestimmt daraus
  `u.vizAct` (Showcase-"Akt"-Kategorie: Gesang/Kraftakt/Zaubershow/Akrobatik/Kampfkunst/
  Schützenkunst) — **das IST** von diesem Batch betroffen (`waffe` bei Nelchael/Sweet
  Dreams/Vargan geändert, `effekt` bei Nhyra-Vel/Tidesinger/Xerathis neu ergänzt). Codes
  eigener Kommentar bei `actVon()` (Zeile ~27665) UND bei der einzigen Verwendungsstelle von
  `u.vizAct` (Zeile ~24739–24745, `showcaseKategoriesieger()`) stellt aber ausdrücklich
  fest: *"`u.vizAct` ist bewusst NICHT Teil von `eig`/`wert()`"* und *"`actVon()` liest
  `eig`/`wert()`/`rr()` nirgends und fließt nirgends dorthin zurück, nur umgekehrt"* — die
  einzigen beiden Leser von `u.vizAct`/`actVon()` außerhalb seiner eigenen Definition sind
  `showcaseKategoriesieger()` (ein reiner Anzeige-Kategoriepreis, der Sieger bleibt über
  `u.summe` bestimmt) und `SHOWCASE_JURY_SPITZE` (Flavor-Text). Keiner von beiden schreibt
  in `u.summe`, `eig` oder `rr()`. Die sechs betroffenen Charaktere können dadurch ein
  anderes Kategorie-Etikett bekommen ("Zaubershow" statt "Kampfkunst" o.ä.) — das ändert,
  wer eine reine Anzeige-Auszeichnung gewinnt, nicht die Rangtreue-relevante Wertung selbst.

**Regressionskontrolle** (`node scripts/miss-alle-disziplinen.mjs 24`, im Hintergrund
gestartet): auf dieser Maschine liefen zum Zeitpunkt dieses PRs mehrere parallele
Agenten-Sitzungen denselben rechenintensiven Lauf gleichzeitig (geteilte Umgebung) — der
Lauf lieferte innerhalb des für diesen PR verfügbaren Zeitfensters keine Ausgabe. Die
Verifikation stützt sich deshalb primär auf den Grep-/Code-Nachweis oben (von der
Sprite-Fit-Blaupause ausdrücklich als gleichwertige Alternative vorgesehen: "Grep-Nachweis
ODER kurzer Lauf"); ein vollständiger `miss-alle-disziplinen.mjs`-Lauf gegen diesen Branch
bleibt als Nachtrag offen, sobald die Maschine weniger ausgelastet ist.

**Screenshots** (`renderProbe`, teils im Angriffsframe, um Waffen sichtbar zu machen): für
die beiden auf 5 Sterne gehobenen Charaktere (Nahli-Ke, Vigil) sowie die sichtbar
korrigierten Fälle (Skittermind, Xylaris, Tidesinger) vorher/nachher gegen das Referenzbild
verglichen; 8-fach vergrößert für Vigils Tropf-Faden, 6-fach für die übrigen.

## Was übrig bleibt (nicht in diesem PR)

- **Die sechs strukturellen Lücken oben** (Hammer, Instrument, Ketten, Tabby-Textur,
  Augenbinde, Kragen) brauchen neue Zeichenarbeit oder neue Engine-Verdrahtung, keine
  punktuelle Rezept-Korrektur — eigene, spätere Runde(n).
- **Die Steh-Pose-Vorschau zeigt strukturell keine Nahkampfwaffen.** Betrifft nicht nur die
  vier hier bearbeiteten Fälle, sondern jeden waffentragenden Charakter im Repo. Eine
  künftige Erweiterung von `erzeuge-sprite-vorschauen.mjs` um einen zweiten
  Angriffsframe-Export würde diesen blinden Fleck der Bewertung beheben, ohne die Rubrik
  selbst zu ändern.
- **`effekt`-Partikel sind bei `t=0` oft unsichtbar oder kaum sichtbar.** Betrifft ebenfalls
  nicht nur diesen Batch (Ciacia, Grizz als bestehende Beispiele). Dieselbe Empfehlung wie
  oben: ein zweiter, animierter Vorschau-Export (oder ein fester `t`-Offset ungleich 0 beim
  Erzeugen der Vorschau) würde die tatsächliche Wirkung dieser Effekte sichtbar machen.
