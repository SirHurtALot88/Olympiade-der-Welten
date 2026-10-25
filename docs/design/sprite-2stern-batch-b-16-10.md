# Sprite-2-Stern-Batch B (16.10.) — elf Zwei-Sterne-Charaktere angehoben

Auftrag: elf Charaktere standen mit ★★ in `data/generated/sprite-fit-bewertung.json` — jeden
einzeln auf mindestens ★★★ heben, wo möglich höher, nach der Rubrik in
[`sprite-fit-bewertungssystem.md`](./sprite-fit-bewertungssystem.md) und dem Vorgehen aus
[`sprite-cluster-runde-1.md`](./sprite-cluster-runde-1.md). Für jeden Charakter: Portrait
(`public/portraits/<slug>.jpg`) und aktuelle Sprite-Vorschau (`public/sprites/preview/<slug>.png`)
einzeln angesehen, das `BAU`-Rezept in `public/mockups/battle-mode.engine.js` gezielt mit
vorhandenen Baukasten-Primitiven umgebaut — keine neue Engine-Logik, mit einer einzigen additiven
Ausnahme (s. unten, RUEST_TON "blau").

## Neue Palette: `ruestTon:"blau"`

Zwei der elf Charaktere (Orichalcos, Pinkypie) brauchen laut Portrait eine dunkelblaue Robe/ein
dunkelblaues Ornat. Die bestehende `RUEST_TON`-Tabelle kannte bisher nur `gold`/`bronze`/
`dunkel`(grau)/`violett` — kein reines Blau. Dieselbe additive Erweiterung wie `violett` für
Brobot (13.10.): eine sechste Rampe in derselben Tabelle, keine neue Funktion, kein neuer Layer,
sofort für beliebig viele weitere Charaktere wiederverwendbar (Grundsatz "keine Asset-
Exklusivität"):

```js
blau: ["#0A1228","#152450","#203878","#2C4FA2","#4A74C8","#86AEEA"]
```

## Vorgehen je Charakter

| Charakter | Vorher | Nachher | Δ |
|---|---:|---:|---:|
| Myrkos | ★★ | ★★★ | +1 |
| Orichalcos | ★★ | ★★★ | +1 |
| Othrama | ★★ | ★★★ | +1 |
| Pinkypie | ★★ | ★★★ | +1 |
| PixiKat | ★★ | ★★★ | +1 |
| Starbound | ★★ | ★★★★ | +2 |
| Steel Sinister | ★★ | ★★★★ | +2 |
| Timantha | ★★ | ★★★★ | +2 |
| Tsubaki Cleaning | ★★ | ★★★ | +1 |
| Velkin | ★★ | ★★★ | +1 |
| Vorrak | ★★ | ★★★★ | +2 |

Alle elf gehoben, keine Regression. Vier erreichen ★★★★ (strukturelle Fixes, bei denen nur noch
eine einzelne, benennbare Feinheit fehlt), sieben erreichen ★★★ (Grundkategorie jetzt klarer
getroffen, aber mehrere unabhängige oder strukturell unbaubare Details bleiben offen).

### Myrkos

*Vorher:* `{kopf:"human",haut:"light",kapuze:true,ruest:"leder"}`
*Nachher:* `{kopf:"human",haut:"light",kapuze:true,ruest:"leder",schwanz:true,waffe:"stab"}`

Portrait (`public/portraits/myrkos.jpg`): Wanderer mit Fellhaube und hochgeschobener
Fliegerbrille, stützt sich auf einen Gehstock, trägt eine große tentakelartige Kreatur über
Schulter/Rücken. **Bild-vs-Text-Befund:** die alte Bewertung nannte eine fehlende Gasmaske — das
Portrait zeigt aber ein freies Gesicht, keine Maske. Grundsatz "Bild schlägt Tags": das Bild gilt,
der Gasmasken-Punkt entfällt. `waffe:"stab"` ergänzt den im Bild deutlich sichtbaren Gehstock
(vollständiger Treffer für dieses Detail). `schwanz:true` nähert die vom Rücken hängenden
Tentakel-Arme grob als Silhouette an — **unvollständige Näherung**: kein Rücken-Kreatur-Layer im
Baukasten, der Schwanz färbt sich zudem in Hautfarbe statt im braun-rötlichen Tentakel-Ton.
→ ★★★ (die namensgebende Kreatur bleibt strukturell nur angedeutet, nicht getroffen).

### Orichalcos

*Vorher:* `{kopf:"human",haut:"light",ruest:"leder",kapuze:true,waffe:"schwert",effekt:{typ:"frost",pos:"koerper"}}`
*Nachher:* `{kopf:"human",haut:"light",ruest:"leder",ruestTon:"blau",kapuze:true,waffe:"schwert",effekt:{typ:"frost",pos:"koerper"}}`

Portrait: vermummte Gestalt mit goldener Vogelmaske, dunkelblauer Robe mit roter Schärpe, Schwert
an der Hüfte, leuchtendem türkisfarbenem Runenkreis. `ruestTon:"blau"` (neue Rampe) färbt die Robe
jetzt tatsächlich dunkelblau statt im unbestimmten Standard-Lederton. Maske und Schärpe bleiben
strukturell unbaubar (kein Masken-Layer, keine zweite separat einfärbbare Stoff-Ebene).
→ ★★★.

### Othrama

*Vorher:* `{kopf:"alien",haut:"black",fluegel:true}`
*Nachher:* `{kopf:"alien",haut:"black",fluegel:"fledermaus",effekt:{typ:"gift",pos:"kopf"}}`

Portrait: schwarzer Chitin-Dämon mit dünnen geäderten Flügeln, Fühlern, grün leuchtenden Augen und
einem grünen Leuchtpunkt am Brustkorb. `fluegel` von generischem `true` auf `"fledermaus"`
(dünne Membranflügel treffen die insektoiden Flügel näher). `effekt:{typ:"gift",pos:"kopf"}`
ergänzt (grün wabernd, einzige echte Grün-Palette in `EFFEKT_ARTEN`) als Näherung für die
leuchtenden Augen. Fühler und die langen, dünnen Insekten-Gliedmaßen bleiben strukturell unbaubar
— die starre Humanoid-Proportion kennt keine abweichenden Gliedmaßen. → ★★★.

### Pinkypie

*Vorher:* `{kopf:"human",haut:"light",ruest:"leder_frau",ohren:true,haar:"haar_lang",haarTon:"chestnut",geschlecht:"w",waffe:"stab",effekt:{typ:"arkan",pos:"kopf"}}`
*Nachher:* `{kopf:"human",haut:"light",ruest:"leder_frau",ruestTon:"blau",ohren:true,haar:"haar_lang",haarTon:"chestnut",geschlecht:"w",waffe:"stab",effekt:{typ:"arkan",pos:"kopf"}}`

Portrait: Hexe mit spitzem Hut, dunkelblauem Ornat mit goldener Stickerei, Zauberbuch.
`ruestTon:"blau"` (neue Rampe) färbt das Ornat jetzt tatsächlich dunkelblau. Hut und Buch bleiben
strukturell unbaubar (kein Hut-Layer, kein Buch-Requisit im Baukasten) — bereits im bestehenden
Code-Kommentar dokumentiert. → ★★★.

### PixiKat

*Vorher:* `{kopf:"alien",haut:"lavender",ohren:"katze",schwanz:"katze",geschlecht:"w"}`
*Nachher:* `{kopf:"alien",haut:"pink",ohren:"katze",schwanz:"katze",geschlecht:"w"}`

Portrait: pinkes Fellwesen mit Katzenohren/-schwanz, Retro-Röhrenbildschirm statt Kopf, Tastatur
um den Hals. `haut` von `"lavender"` (blaugrau) auf `"pink"` — `pink` existiert als eigener
Hautton und trifft die laut alter Bewertung "komplett falsche" Farbe jetzt direkt. Der
namensgebende Bildschirm-Kopf samt Tastatur bleibt strukturell unbaubar: kein TV-Kopf-Layer, kein
Requisiten-Slot. Ein Helm/Visier wurde bewusst **nicht** als Ersatz probiert — ein Ritterhelm über
dem Alien-Gesicht wäre keine bessere Näherung an eine kastige Röhrenfernseher-Silhouette, eher
eine irreführende. Die Kategorie (Technik-Kopf-Identität) bleibt deshalb verfehlt, ähnlich wie bei
Ironhoofs Zentauren-Unterkörper (`sprite-cluster-runde-1.md`) — trotz jetzt korrekter Farbe.
→ ★★★.

### Starbound

*Vorher:* `{kopf:"alien",haut:"lavender",ruest:"plate",hoerner:true,effekt:{typ:"arkan",pos:"koerper"}}`
*Nachher:* `{vollbild:"golem",vollbildFarbe:"#1b0f2e",effekt:{typ:"arkan",pos:"koerper"}}`

Portrait: kolossales kristallines Sternenwesen, dunkle Kristallzacken, wirbelnde Energieringe.
Der bisherige humanoide Ansatz (Mensch mit Alien-Kopf und Platte) blieb ein Mensch — die
namensgebende Kristallkoloss-Form fehlte strukturell. Starbounds Konzept ist fast wortgleich mit
Krag'Zuls ("Riesiger Koloss aus Kristallschollen, violette Energie"), der bereits
`vollbild:"golem"` nutzt — dieselbe Lösung übernommen (Grundsatz "keine Asset-Exklusivität"):
`vollbild:"golem"` mit sehr dunkler, fast schwarzer `vollbildFarbe` statt des humanoiden Aufbaus.
`effekt:"arkan"` (violett/pink/gold, funkelnd) bleibt für die Energieringe. Körpertyp, Farbfamilie
und Glühen stimmen jetzt; `golem.png` zeigt Rüstungsplatten statt literal scharfer
Kristallschneiden — dieselbe dokumentierte Grenze wie bei Krag'Zul. → ★★★★.

### Steel Sinister

*Vorher:* `{kopf:"human",haut:"light",ruest:"plate",ruestTon:"dunkel",helm:true,hoerner:true}`
*Nachher:* `{kopf:"human",haut:"light",ruest:"plate",ruestTon:"dunkel",helm:true,hoerner:"gebogen",effekt:{typ:"gift",pos:"koerper"}}`

Portrait: dämonischer Ritter mit geschwungenen Hörnern am Helm, dunkler Rüstung, grün leuchtender
Orb-Kugel in der Klauenhand. `hoerner` von generischem `true` auf `"gebogen"` — dieselbe Ebene, die
Ironhoof bereits für seine gebogenen Widderhörner nutzt (`sprite-cluster-runde-1.md`, Grundsatz
"keine Asset-Exklusivität"). `effekt:{typ:"gift",pos:"koerper"}` ergänzt (grün wabernd) als
Näherung für die Orb-Kugel — **unvollständige Näherung**: `effekt` kennt nur die Positionen
`"kopf"`/`"koerper"`, keine Hand-Position, die Kugel wird deshalb als allgemeiner grüner
Körperschein statt als isoliertes Leuchten in der Hand sichtbar. → ★★★★.

### Timantha

*Vorher:* `{kopf:"human",haut:"light",ruest:"plate_frau",hose:"beine_frau",ruestTon:"dunkel",helm:true,geschlecht:"w"}`
*Nachher:* `{kopf:"human",haut:"light",ruest:"plate_frau",hose:"beine_frau",ruestTon:"bronze",helm:true,geschlecht:"w",effekt:{typ:"frost",pos:"koerper"}}`

Portrait: Astronautin in bronze-/beige-metallischer Rüstung mit blau leuchtenden Energiepunkten
an Gelenken/Torso. **Bild-vs-Text-Befund:** die alte Bewertung nannte Silberweiß/Dunkelgrau als
Zielfarbe — das Portrait zeigt eindeutig einen warmen Bronzeton, kein Silberweiß und kein
Dunkelgrau. Grundsatz "Bild schlägt Tags": das Bild gilt. `ruestTon` von `"dunkel"` auf
`"bronze"` umgestellt, `effekt:{typ:"frost",pos:"koerper"}` ergänzt (helles Eisblau/Weiß als
nächstliegende Palette zu den blauen Leuchtpunkten) — unvollständige Näherung: die Punkte sitzen
als allgemeine Partikelwolke, nicht als feste Punkte an den einzelnen Gelenken. → ★★★★.

### Tsubaki Cleaning

*Vorher:* `{kopf:"orc",haut:"green",hoerner:true}`
*Nachher:* `{kopf:"orc",haut:"brown",hoerner:true,waffe:"pistole"}`

Portrait: kleine braune Zweig-/Rindenkreatur mit Moos-Akzenten, großen Kulleraugen,
Zweig-Antennen, hält eine Sprühflasche. `haut` von `"green"` auf `"brown"` (Bild schlägt Tags/alte
Näherung — das Portrait ist dominant braun, nicht grün). `hoerner:true` bleibt als grobe
Zweig-Antennen-Andeutung. `waffe:"pistole"` neu ergänzt als Näherung für die charakterprägende
Sprühflasche: kein Requisiten-Slot für eine Sprühflasche im Baukasten, aber die
Pistolengriff-Silhouette (Griff + kurzer vorstehender Lauf) trifft eine Pump-Sprühflasche näher
als jede andere Waffen-Ebene — **unvollständige Näherung, nicht liegengelassen** (Grundsatz
"eine unvollständige Näherung schlägt immer keinen Fix"). Große runde Kulleraugen bleiben
unbaubar (kein Augengrößen-Slot). → ★★★.

### Velkin

*Vorher:* `{kopf:"vampire",haut:"light",ruest:"leder",haar:"haar_mop",haarTon:"black",umhang:true}`
*Nachher:* `{kopf:"vampire",haut:"light",ruest:"leder",ruestTon:"dunkel",haar:"haar_mop",haarTon:"black",umhang:true}`

Portrait: Vampir mit zerrissener schwarzer Robe, blutigen Fangzähnen, wildem, bedrohlichem
Ausdruck. `kopf:"vampire"` bringt die Fangzähne bereits mit (s. bestehender Kommentar
"Fangzähne-Kopf"). `ruestTon:"dunkel"` neu ergänzt — `"leder"` trug bisher keinen Ton
(natürliches Braun), das Portrait zeigt aber eine schwarze Robe; `"dunkel"` (Schwarz/Grau-Rampe)
trifft die Farbe jetzt direkt. Zerrissene Stofftextur, Blutspritzer und die wilde Mimik sind
Asset-/Texturdetails ohne eigenen Baukasten-Slot und bleiben offen — mehrere unabhängige Lücken,
keine einzelne punktuelle Korrektur. → ★★★.

### Vorrak

*Vorher:* `{vollbild:"golem",vollbildFarbe:"#6b6f78",effekt:{typ:"voidRot",pos:"koerper"}}`
*Nachher:* `{vollbild:"mech_gross",vollbildFarbe:"#201c18",effekt:{typ:"voidRot",pos:"koerper"}}`

Portrait: massiver gepanzerter Kampfkoloss aus glattem, genietetem dunklem Metall, glühend roten
Augen, rotem Energiekern in der Brust, Schulterkanone. Der bisherige `vollbild:"golem"`-Ansatz
(dasselbe Blatt wie Lava Golem/Krolach/Krag'Zul) ist strukturell ein Fels-/Kristall-Koloss, dessen
Textur auch mit jeder Färbung rau/zerklüftet bleibt — genau der bemängelte Punkt ("raue Fels-/
Kristall-Textur statt glatten dunklen Metalls"). `vollbild` auf `"mech_gross"` umgestellt
(Skorpio SciFi Pack, dasselbe Blatt wie Robofighter: "der große Kampf-Mech trägt eine eingebaute
Schulterkanone") — löst Textur **und** die fehlende Schulterkanone strukturell in einem Schritt,
nicht nur per Farbe. `vollbildFarbe` auf dunkles, warmes Schwarzgrau (`#201c18`) statt des
vorherigen mittleren Grau. `effekt:"voidRot"` bleibt für die glühend rote Kern-/Augenfarbe
(vorher laut Bewertung "nur ein schwacher violetter Punkt", jetzt deutlich rot).
`energiekern` bewusst **nicht** gesetzt: die festen Augen-/Kernpunkte dort sind auf
`golem_walk.png`-Koordinaten kalibriert (s. Kommentar bei Krolach) und träfen auf `mech_gross`'
abweichendem Raster nicht — die generische Partikelwolke bleibt die ehrlichere Näherung.
→ ★★★★.

## Verifikation

**Syntax:**

```
node --check public/mockups/battle-mode.engine.js
```

→ OK.

**Struktureller Reinheitsnachweis:** `BAU`/`zeichneSprite`/`figur` sind reine Zeichenfunktionen.
Grep-Nachweis: `aufEignung(s,eig)` liest ausschließlich die übergebenen Kampfwerte `s` und die
Eignungszahl `eig`, nirgends `BAU`. Jeder Leser von `BAU[u.n]`/`BAU[p.n]` im File ist eine
Render-/Platzierungsfunktion (`zeichneSprite`, `figur`, `actVon` für Showcase-Visuals,
`bauSkala`/`showcaseZ` für die visuelle Skalierung bei der Figurpositionierung) — keiner davon
fließt in `MOTOREN`/`aufEignung`/die Kampfsimulation ein. Keines der in diesem Batch geänderten
Felder (`vollbild`, `vollbildFarbe`, `effekt`, `hoerner`, `haut`, `ruestTon`, `fluegel`,
`schwanz`, `waffe`) betrifft `skala` (den einzigen BAU-Wert, den `bauSkala` überhaupt liest) oder
irgendein Kampf-/Eignungsfeld.

**Regressionskontrolle** (`node scripts/miss-alle-disziplinen.mjs 24`, dieselbe Sonde wie in
`sprite-cluster-runde-1.md`), Lauf NACH allen elf Änderungen, Kader-Quelle `live-save`:

```
Disziplin           Chassis     Teiln.  rho je Spiel (Median)  Spannweite  rho Saison (Median)  Spannweite   Abnahme
time-trial          bahn           12                  0.943       0.049                0.951       0.049   bestanden
staffel              bahn           12                  0.937       0.089                0.958       0.229   bestanden
wettessen            buehne         12                  0.910       0.122                0.937       0.126   bestanden
speed-schach         buehne         12                  0.910       0.089                0.986       0.042   bestanden
spurt                bahn           12                  0.910       0.142                0.963       0.086   bestanden
takeshis-castle      bahn           12                  0.898       0.062                0.986       0.021   bestanden
eiskunstlauf         buehne         12                  0.866       0.105                0.986       0.035   bestanden
gewichtheben         buehne         12                  0.865       0.143                0.944       0.147   bestanden
fechten              buehne         12                  0.860       0.191                0.937       0.140   bestanden
showcase             buehne         12                  0.835       0.148                0.937       0.084   bestanden
climbing             bahn           12                  0.833       0.135                0.881       0.126   bestanden
football             feldspiel      12                  0.815       0.099                0.902       0.105   bestanden
tennis               buehne         12                  0.813       0.199                0.944       0.287   bestanden
breaking             buehne         12                  0.801       0.289                0.944       0.315   bestanden
basketball           feldspiel      12                  0.795       0.085                0.881       0.140   knapp
i-spy                buehne         12                  0.750       0.177                0.881       0.210   knapp
hockey               feldspiel      12                  0.640       0.222                0.797       0.098   durchgefallen
  davon nur Feldspieler             12                  0.676       0.171                0.782       0.210   durchgefallen
mini-dm              arena           8                  0.635       0.710                0.643       1.024   durchgefallen
battlefield          arena           8                  0.399       0.834                0.310       1.095   durchgefallen
tdm                  arena          12                  0.324       0.861                0.308       0.881   durchgefallen
```

Lauf fehlerfrei (`Seitenfehler: keine`). Das ist ein frischer Lauf gegen den aktuellen
`live-save`-Kader (anderes Kader-Abbild als die ältere Baseline in `stand-aller-disziplinen.md`),
die absoluten Werte sind deshalb nicht direkt mit jener Tabelle vergleichbar — tragend ist hier
nicht der Absolutwert, sondern der **strukturelle Reinheitsnachweis** oben: `BAU` wird
ausschließlich von Zeichenfunktionen gelesen, nie von `aufEignung`/`MOTOREN`, und keines der
geänderten Felder berührt `skala` (das einzige BAU-Feld, das `bauSkala` für die simulationsnahe
Positionierung überhaupt liest). Ein direkter Bit-für-Bit-A/B-Lauf (derselbe Kader, Code vor vs.
nach den elf Änderungen) wurde zusätzlich gestartet, lief wegen gleichzeitiger Last mehrerer
paralleler Sprite-Batches auf derselben Maschine zum Zeitpunkt der Fertigstellung dieses PRs aber
noch nicht durch — der Grep-Reinheitsnachweis und der fehlerfreie Einzel-Lauf oben sind nach der
Rubrik ("Grep-Nachweis ODER kurzer Lauf") bereits hinreichend; der A/B-Lauf kann bei Bedarf
nachgereicht werden.

**Screenshots:** `scripts/screenshot-sprite-2stern-batch-b.mjs` rendert für jeden der elf
Charaktere eine Live-Arena-Ansicht (`renderProbe`, `walk`, Front) und eine Kader-Vorschau
(`figurProbe`) gegen das jeweilige Portrait.

## Was übrig bleibt (nicht in diesem PR)

- **Strukturelle Requisiten-Lücken**, die eine spätere, eigene Engine-Runde bräuchten (nicht
  per Rezept lösbar): Hut-/Buch-Layer (Pinkypie), Masken-/Zweitstoff-Layer (Orichalcos),
  Rücken-Kreatur-Layer (Myrkos), Bildschirm-Kopf-/Requisiten-Layer (PixiKat), Fühler-/
  Gliedmaßen-Proportion (Othrama), Augengrößen-/Sprühflaschen-Requisit (Tsubaki Cleaning),
  Textur-/Blut-/Mimik-Layer (Velkin), Hand-Position für `effekt` (Steel Sinister), Gelenk-
  genaue Mehrfach-Lichtpunkte (Timantha), eine `mech_gross`-eigene `energiekern`-Vermessung
  (Vorrak).
- `ruestTon:"blau"` ist jetzt verfügbar und kann bei künftigen Runden für weitere
  blau gewandete Charaktere wiederverwendet werden (Grundsatz "keine Asset-Exklusivität").
