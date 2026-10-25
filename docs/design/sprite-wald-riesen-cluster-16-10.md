# Sprite-Fit-Nachlieferung, Wald-Riesen-Cluster (16.10.)

Der dritte der drei in [`sprite-cluster-runde-1.md`](./sprite-cluster-runde-1.md) ausdrücklich
auf später verschobenen Cluster (Fazit dort, "Was übrig bleibt"): fünf thematisch verwandte
Baumwesen-Charaktere — **Cyrn, Greenkraut, Rootheart, Treantos, Tropfina** — die im Dokument vom
04.09. (`sprite-fit-ergebnisse.md`, Abschnitt "Auffälligstes Teilmuster") als systematisches
"generische grüne Silhouette statt Baumwesen"-Problem benannt wurden. Diese Runde prüft alle
fünf einzeln gegen ihr Portrait, nicht nur gegen den alten Bewertungstext — anders als Runde 1
waren vier der fünf bei Auftragsbeginn aber bereits in einem früheren Nachlieferungs-Durchgang
(13.10.) auf `vollbild:"treant"` umgestellt und standen bei ★★★★. Das eigentliche Arbeitspaket
dieser Runde ist deshalb kleiner, als der Auftragstext vermuten lässt — und ein Review-Fund
unterwegs (s. "Wichtiger Nebenbefund" unten) hat das Arbeitspaket noch einmal verkleinert.

## Ausgangslage (vor dieser Runde)

| Charakter | Sterne | Rezept | Offene Lücke laut `sprite-fit-bewertung.json` |
|---|---:|---|---|
| Cyrn | ★★★★ | `{vollbild:"treant",effekt:{typ:"frost",pos:"koerper"}}` | Blatt-Schild, Speer, genauer türkiser Kristallton |
| Greenkraut | ★★★★ | `{vollbild:"treant",vollbildFarbe:"#8a7d68",vollbildFarbeModus:"farbe"}` | Orange Trichterblüte auf der Schulter, kauernde Pose |
| Rootheart | ★★★★ | `{vollbild:"treant",vollbildFarbe:"#4f5c3a"}` | Schild und Speer |
| Treantos | ★★★★ | `{vollbild:"treant"}` | Leuchtend grüne Kugel in der Hand, grünes Augenglühen |
| Tropfina | ★★ | `{kopf:"human",haut:"green",ruest:"leder"}` | Blatt-Form, Leuchten, Wassertropfen — kein humanoider Körper im Bild |

Vier der fünf hatten also schon den größten, strukturellen Schritt hinter sich (Kategorie
richtig: echtes Baumwesen statt grünem Humanoid). Tropfina war die einzige noch unveränderte
der fünf — und strukturell die am weitesten vom Baukasten entfernte: ihr Portrait zeigt gar
keinen humanoiden Körper, sondern eine schwebende, leuchtende Pflanze ohne Gliedmaßen.

## Vorgehen je Charakter

Für jeden der fünf: Portrait (`public/portraits/<slug>.jpg`) und aktuelle Sprite-Vorschau
(`public/sprites/preview/<slug>.png`) einzeln angesehen, dann geprüft, welche der noch offenen
Lücken sich mit bereits vorhandenen Baukasten-Primitiven schließen lässt, ohne die vier bereits
differenzierten Rezepte wieder aufeinander zuzuziehen (jedes der vier `vollbildFarbe`-Werte
bleibt sein eigener, charakterspezifischer Ton).

### Cyrn, Greenkraut, Rootheart — geprüft, bewusst unverändert gelassen

Alle drei verbliebenen Lücken sind durch dieselbe strukturelle Grenze blockiert, die schon in
Runde 1 bei Ironhoofs Zentauren-Unterkörper dokumentiert wurde: **der `vollbild`-Zweig von
`zeichneSprite()` liest `b.waffe` nicht** (s. Kommentar dort, "VOLLBILD-Mechanik kennt ohnehin
keinen zusätzlichen Waffen-Layer über einem Fremdbild"). Cyrns Blatt-Schild+Speer und Roothearts
Schild+Speer sind damit ohne eine neue Engine-Koordinate (ein Hand-/Schild-Ankerpunkt für
Vollbild-Kreaturen) nicht baubar — das wäre neue Zeichenlogik, nicht Rekombination vorhandener
Primitive, und blieb deshalb bewusst außen vor.

Für Cyrns Kristallton wurde geprüft, ob ein anderer `effekt`-Typ näher an Türkis liegt als das
bereits verwendete `frost` (`#bfe9ff`/`#eaffff`/`#8fd6ff`, hellblau-weiß). Keiner der sieben
vorhandenen Typen (`feuer` orange, `arkan` lila/pink/gold, `void`/`voidRot` lila/rot, `heilig`
gold, `pilz` rot, `gift` grün) liegt näher an Türkis als `frost` — die Farbpalette jedes Typs ist
fest einprogrammiert (`EFFEKT_ARTEN`), nicht frei wählbar. `frost` bleibt die beste vorhandene
Näherung, keine Änderung nötig.

Für Greenkrauts orange Trichterblüte wurde geprüft, ob ein `effekt`-Typ eine Blüten-artige Form
ergibt. `pilz` (`modus:"pilzhuete"`) kommt der Form am nächsten (feste statt treibende Punkte),
zeichnet aber ausdrücklich einen Fliegenpilz-Umriss (Stiel + Kappe + weiße Tupfen, über die
GANZE Körperfläche verteilt, s. Kommentar bei `zeichnePartikelEffekt`/`"pilzhuete"`) — das sähe
wie Pilzbefall aus, nicht wie eine einzelne Blüte auf der Schulter, und wäre eine optische
Falschaussage (verstößt gegen "Bild schlägt Tags": das Sprite soll die Wahrheit des Bildes
zeigen, nicht eine andere Geschichte erzählen). `feuer` (orange, aber aufsteigende Glut) hätte
dasselbe Problem in die andere Richtung (sähe nach Flammen aus). Keine der beiden Optionen wurde
eingebaut; die Lücke bleibt dokumentiert, nicht gebaut.

Die kauernde Pose (Greenkraut) ist strukturell unbaubar: `treant.png` liefert nur Geh-/Sterbe-/
Angriffs-Spalten (s. `quellen.json`), keine alternative Ruhepose — eine neue Pose zu zeichnen
wäre neue Asset-/Engine-Arbeit, kein Rezept-Rework.

**Ergebnis:** Rezepte und Bewertungen für Cyrn, Greenkraut und Rootheart bleiben unverändert
(bestätigt per `git diff` — keine der drei BAU-Zeilen taucht im Diff dieser Runde auf).

### Treantos — ebenfalls zunächst erwogen, dann wieder verworfen (s. Nebenbefund)

Die erste Fassung dieser Runde hatte Treantos (und Rootheart) `effekt:{typ:"gift",pos:"kopf"}`
gegeben — der nächstliegende vorhandene Grünton als Näherung an die im Portrait deutlich
sichtbaren grün glühenden Augen. Ein Review-Schritt vor dem Festschreiben deckte auf, warum das
nicht so einfach ist (s. nächster Abschnitt) — die Änderung wurde wieder zurückgenommen.
Treantos bleibt deshalb ebenfalls unverändert: `{vollbild:"treant"}`.

### Wichtiger Nebenbefund: `b.effekt` ist NICHT rein kosmetisch

Die Prüfvorgabe dieses Projekts geht davon aus, dass `BAU`/`zeichneSprite`/`figur` reine
Zeichenfunktionen sind, von keiner Simulation gelesen (s. `sprite-cluster-runde-1.md`,
Verifikationsabschnitt). Das stimmt für `aufEignung()`/`MOTOREN` — aber **nicht vollständig**
für die Showcase-Disziplin: `actVon(u)` (Zeile ~27635) liest `BAU[u.n]` direkt und vergibt über
`SHOWCASE_ACT_PUNKTE` Punkte für `b.waffe`, `b.vollbild` (schlüsselabhängig) und **`b.effekt`**
(`bauEffekt:{zaubershow:3}` — pauschal +3 Punkte für "zaubershow", sobald IRGENDEIN `b.effekt`
gesetzt ist, unabhängig vom `typ`). Diese Punkte entscheiden, welchen Showcase-Act (Gesang/
Kraftakt/Zaubershow/Akrobatik) ein Charakter bekommt, wenn er in einem Showcase-Spiel antritt.

Ein `effekt:{typ:"gift",pos:"kopf"}` auf einem Charakter, der vorher KEIN `b.effekt` hatte
(Rootheart, Treantos, und ursprünglich auch für Tropfina erwogen), hätte also nicht nur das
Sprite verändert, sondern auch dessen Showcase-Act-Punktzahl — ein Mechanik-Nebeneffekt, den ein
reiner Sprite-Fit-Auftrag nicht auslösen soll (s. CLAUDE.md: jede Disziplin braucht ihre eigene
rho/Pp-Abnahme, und dieser Auftrag ist ausdrücklich als risikoarme Asset-Arbeit angelegt, keine
Mechanik-Änderung). **Deshalb wurde die `effekt`-Ergänzung bei Rootheart und Treantos wieder
verworfen**, und bei Tropfina von vornherein weggelassen (s. unten).

Zur Kontrolle: `vollbildFarbe`/`vollbildFarbeModus` sind NICHT betroffen (nur in
`bHolEingefaerbt()` gelesen, reine Einfärbe-Logik beim Zeichnen) — diese beiden Felder bleiben
uneingeschränkt sicher für Sprite-Fit-Arbeit. `b.vollbild` selbst ist nur dann riskant, wenn der
Schlüssel in `SHOWCASE_ACT_PUNKTE.bauVollbild` vorkommt (aktuell: `golem`, `mech_gross`,
`mech_transformer`, `roboter`, `krokodil`, `drache_hydra`, `drache_gold`, `treant`,
`schiff_pirat`, `taube`, `singvogel`, `geist`, `kraken`, `froschmensch`, `werwolf`, `spinne`) —
ein NEUER, dort nicht gelisteter Schlüssel (wie das in dieser Runde neu verdrahtete `dryade`)
ist unbedenklich, weil `actVon()`s `add()`-Helfer unbekannte Schlüssel stillschweigend
überspringt (`if(!pts)return;`).

**Für künftige Sprite-Fit-Runden:** vor dem Hinzufügen von `effekt` zu einem Charakter, der
vorher keinen hatte, prüfen, ob er in den Showcase-Testkadern der Regressionsmessung vorkommt
(und wenn ja, `node scripts/miss-alle-disziplinen.mjs <n> showcase` vorher/nachher vergleichen,
s. Verifikation unten) — oder die Ergänzung ganz weglassen, wie hier geschehen.

### Tropfina — das eigentliche Ergebnis dieser Runde

Tropfinas Portrait zeigt keinen Krieger, sondern eine leuchtende türkis-cyane Pflanze: große
fächerartige Blätter, ein gedrehter Rankenstamm, Wassertropfen an den Blattspitzen, ein
leuchtender Wasserring am Fuß — kein humanoider Körper. Das bisherige Rezept
(`kopf:"human",haut:"green",ruest:"leder"`) war ein reiner Support-Pfad-Notbehelf (Priest/
Matriarch), kein Versuch, das Bild abzubilden — exakt das 2-Sterne-Muster "nicht-humanoides
Konzept als Standard-Mensch mit Farb-Swap".

Gesucht wurde ein vorhandenes, nicht-humanoides Pflanzen-Asset. `public/sprites/pflanze/`
enthält neben `treant.png` (bereits für die anderen vier verdrahtet, knorriger, maskuliner
Baumriese — passt nicht zu Tropfinas zarter, schwebender Erscheinung) noch **`dryade.png`**:
ein seit 24.08. zugeschnittenes, aber nie eingebettetes 64×64-Standbild (JS Monster Set —
Elementals III, JosephSeraph, CC-BY 3.0, s. `quellen.json`) — eine aufrechte Gestalt aus
Astwerk/Wurzeln mit Laubkrone, laut eigener Dokumentation extra "für ein HUMANOIDES Pendant zur
'Plant'-Rasse" angelegt. Kein exakter Treffer (die Dryade hat Arme/Beine, Tropfina im Bild
nicht), aber strukturell näher an "Pflanzenwesen mit fächerartiger Blattkrone über einem
Wurzel-/Rankenstamm" als ein grün angemalter Mensch — und eine erneute Verwendung derselben
Quelle, aus der `treant.png` stammt (keine Asset-Exklusivität, andere Datei).

`dryade.png` war technisch unverdrahtet: weder in `B_SPRITES` (Base64-Bilddaten) noch in
`VOLLBILD` (Geometrie-Tabelle) eingetragen. Beides nachgeholt:

```js
// B_SPRITES, neuer Eintrag vor "b_treant":
"b_dryade": "data:image/png;base64,<...>",

// VOLLBILD, neuer Eintrag nach "meerjungfrau":
dryade: {key:"dryade", cw:64, ch:64, cols:1, stendhal:false, rows:1},
```

Dieselbe Technik wie bei `meerjungfrau`/`schiff_pirat` (einzelnes Standbild ohne Richtungen,
`rows:1`/`cols:1`, Modulo auf die einzige Zeile/Spalte) — keine neue Engine-Logik, nur
Rekombination einer bereits bestehenden Verdrahtungs-Methode mit einem neuen Blatt.

Farblich: drei Punkte im Blattbereich des Portraits abgetastet (`rgb(63,203,194)`,
`rgb(81,223,207)`, `rgb(26,152,140)`) und daraus `#3fcbc2` gewählt, mit
`vollbildFarbeModus:"farbe"` (vollständiger Hue/Saturation-Ersatz bei erhaltener Luminanz, s.
`bHolEingefaerbt`) auf die ganze Dryade angewendet — passt zum Bild, in dem Blätter, Stamm und
Lichtbecken alle denselben Cyan-Ton tragen.

```js
"Tropfina": {vollbild:"dryade",vollbildFarbe:"#3fcbc2",vollbildFarbeModus:"farbe"},
```

Bewusst **ohne** `effekt` (s. Nebenbefund oben) — ein `effekt:"frost"` für das Leuchten/die
Wassertropfen wäre eine naheliegende nächste Näherung gewesen, hätte aber Tropfinas
Showcase-Act-Punktzahl mitverändert. Dokumentierte, bewusst offen gelassene Lücke statt eines
Mechanik-Seiteneffekts.

## Ergebnis

| Charakter | Vorher | Nachher | Δ |
|---|---:|---:|---:|
| Cyrn | ★★★★ | ★★★★ (unverändert) | 0 |
| Greenkraut | ★★★★ | ★★★★ (unverändert) | 0 |
| Rootheart | ★★★★ | ★★★★ (unverändert) | 0 |
| Treantos | ★★★★ | ★★★★ (unverändert) | 0 |
| Tropfina | ★★ | ★★★ | +1 |

Nur Tropfina geändert — bewusst, nicht aus Zeitmangel: die anderen vier sind an einer echten
strukturellen Baukasten-Grenze (kein Waffen-/Requisiten-Layer für Vollbild-Kreaturen) bzw. an
einer Darstellungs-Ehrlichkeitsgrenze (kein Effekt-Typ sieht wie eine Einzelblüte aus, ohne
etwas anderes vorzutäuschen) angekommen, und die einzige sonst verfügbare Stellschraube
(`b.effekt`) hätte eine andere Disziplin (Showcase) mitverändert. `data/generated/
sprite-fit-bewertung.json` wurde ausschließlich für Tropfina aktualisiert (Grundsatz "Score
folgt dem Sprite" — nur geänderte Rezepte brauchen eine neue Bewertung).

Tropfinas verbleibende Lücke (fächerartige Blattform, Leuchten/Tropfen, Wasserring, sowie die
Dryade-Gliedmaßen, die Tropfina im Bild nicht hat) ist in `fehlendesDetail` dokumentiert statt
verschwiegen (Grundsatz "eine unvollständige Näherung schlägt immer keinen Fix").

## Verifikation

**Syntax:**

```
node --check public/mockups/battle-mode.engine.js
```

→ OK.

**Diff-Umfang:** `git diff --stat` zeigt für `battle-mode.engine.js` nur die Tropfina-BAU-Zeile,
den neuen `dryade`-VOLLBILD-Eintrag und die neue `b_dryade`-Base64-Zeile in `B_SPRITES` (plus
Kommentare). Cyrn/Greenkraut/Rootheart/Treantos tauchen im Diff nicht auf — bestätigt, dass die
"bewusst unverändert"-Entscheidung auch wirklich nichts verändert hat.

**Grep-Nachweis (reine Zeichenfunktion, mit einer dokumentierten Ausnahme):** `BAU`/
`zeichneSprite`/`figur`/`vollbildFarbe`/`vollbildFarbeModus` werden ausschließlich innerhalb der
Zeichenpfade (`zeichneSprite()`, `figur()`, `bHolEingefaerbt()`) gelesen — keiner dieser Pfade
wird von `aufEignung()` oder einer `MOTOREN`-Disziplinfunktion aufgerufen. Einzige Ausnahme:
`actVon()` liest `b.waffe`/`b.vollbild`/`b.effekt` für die Showcase-Act-Vergabe (s. Nebenbefund
oben) — deshalb wurde in dieser Runde kein neues `b.effekt` gesetzt, und das neu verdrahtete
`b.vollbild:"dryade"` trägt nachweislich keinen Eintrag in `SHOWCASE_ACT_PUNKTE.bauVollbild`.

**Regressionskontrolle, differentiell (nicht gegen die alte 03./04.09.-Tabelle, s. unten warum):**

```
node scripts/miss-alle-disziplinen.mjs 24 showcase
```

Vorher (Original-Engine aus `git show HEAD:...`, per Datei-Tausch ohne `git stash`/`reset`
getestet — beides ist in diesem Repo für Agenten gesperrt): `rho je Spiel (Median) 0.835,
Spannweite 0.148, rho Saison (Median) 0.937, Spannweite 0.084, bestanden`.
Nachher (mit dieser Runde): **bit-identisch**, dieselben vier Zahlen. Bestätigt empirisch, nicht
nur per Code-Lektüre, dass die Tropfina-Änderung keine Showcase-Mechanik bewegt hat.

Hinweis zur Methode: ein Vergleich gegen die alte Tabelle in `sprite-cluster-runde-1.md`
(Stand 03./04.09.) wäre hier nicht aussagekräftig gewesen — die `kaderfamilie-live-save.json`
dieses Checkouts stammt aus einem späteren, echten Spielstand-Abbild, dessen Rohwerte sich seit
September durch echten Liga-Fortschritt verschoben haben, unabhängig von jeder Sprite-Änderung.
Der korrekte Vergleich ist deshalb "derselbe Kader, dieselbe Engine, nur die eine Zeile anders"
— exakt der oben beschriebene Datei-Tausch-Test.

**Vorher/Nachher:** Tropfinas `public/sprites/preview/tropfina.png` wurde über
`node scripts/erzeuge-sprite-vorschauen.mjs "Tropfina"` (`window.__arena.renderProbe()` unter
der Haube, dieselbe Technik wie in Runde 1) neu erzeugt — von einem grünhäutigen Lederkämpfer zu
einer türkis-cyanen, buschigen Pflanzensilhouette mit sichtbarem Wurzelgeflecht. Die vier
unveränderten Charaktere wurden ebenfalls neu gerendert; ihre PNGs sind laut `git status`
byte-identisch zum vorherigen Stand.

## Was übrig bleibt (nicht in diesem PR)

- **Kein Requisiten-/Schild-Layer für Vollbild-Kreaturen.** Betrifft Cyrn (Schild+Speer),
  Rootheart (Schild+Speer) und Treantos (Kugel in der Hand) gleichermaßen — derselbe
  strukturelle Befund wie bei Ironhoofs Zentauren-Unterkörper in Runde 1: eine echte Baukasten-
  Lücke (kein Hand-/Requisiten-Ankerpunkt im `vollbild`-Zweig von `zeichneSprite()`), kein
  Rezept-Problem. Eine künftige Runde könnte das lösen, bräuchte dafür aber neue
  Engine-Koordinaten (gemessene Handpunkte je Vollbild-Blatt, analog zu `VOLLBILD_SCHLAEGER`)
  — außerhalb des "nur Rekombination"-Rahmens dieser Runde.
- **Grünes Augenglühen (Rootheart, Treantos) bewusst nicht gebaut**, obwohl `effekt:"gift"`
  technisch verfügbar gewesen wäre — s. Nebenbefund oben. Eine künftige Runde könnte das
  nachholen, MUSS dann aber vorher/nachher `miss-alle-disziplinen.mjs <n> showcase` (und
  günstigenfalls `messe-arena-einfluss.mjs`, falls der betroffene Charakter auch an einer
  Pp-relevanten Disziplin hängt) laufen lassen.
- **Greenkrauts orange Trichterblüte und kauernde Pose** bleiben unerreicht — kein Effekt-Typ
  bildet eine einzelne Blüte ab, ohne optisch etwas anderes zu behaupten (Pilzbefall/Feuer),
  und das Blatt hat keine alternative Ruhepose.
