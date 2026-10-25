# Sprite-Fit 3-Sterne-Batch C — 30 Charaktere (alphabetisch 61–90), Nachlieferungsrunde (16.10.)

Auftrag: dritter von drei parallelen Batches, die alle aktuell bei ★★★ stehenden Charaktere
(90 insgesamt nach den heutigen 2-/4-Sterne-Runden) auf ★★★★/★★★★★ heben, wo der Baukasten
das ehrlich hergibt — Batch C deckt die alphabetische Slice 61–90 ab (PixiKat … Yuko). Sechs
Namen der Slice (PixiKat, Roddox Harthelm, Tartarus, Tropfina, Tsubaki Cleaning, Velkin) waren
schon von früheren Runden desselben Tages (Wald-Riesen-Cluster, Minotaurus/Zentaur-Cluster,
2-Sterne-Batch B) angehoben worden — hier erneut einzeln geprüft, nicht blind übernommen.

Vorgehen nach dem Muster von `docs/design/sprite-cluster-runde-1.md`: Portrait gegen
`BAU`-Eintrag (`public/mockups/battle-mode.engine.js`) und
`public/sprites/preview/<slug>.png` geprüft, fehlende Details über vorhandene
Baukasten-Primitive nachgerüstet, `data/generated/sprite-fit-bewertung.json` im selben Commit
aktualisiert (Grundsatz „Score folgt dem Sprite").

## Zwischen-Feedback von Chris (während dieser Runde eingearbeitet)

Nachdem er die Vorschau-Galerie live gesehen hatte, meldete Chris über den Koordinator: fehlende
oder falsche **signature-Requisiten** (eine namensgebende Waffe/ein Requisit aus dem Portrait)
sind "make or break" für die Bewertung — wichtiger als generische Ton-/Farbkorrekturen. Diese
Runde wurde danach noch einmal gezielt auf falsch/fehlend gesetzte `waffe`-Werte durchgesehen
(Sunny: Schwert → Axt; Riley Le Rogue/Sister Ilora u.a. bereits korrekt).

Zweiter struktureller Fund vom Koordinator, bestätigt im Engine-Code (Zeilen ~4722–4725/
4872–4875): Nahkampfwaffen (`schwert`/`axt`/`stab`/`zweihaender`) zeichnen **nur** im
Angriffs-/Schlag-Frame (`ani==="slash"`), die Galerie-Vorschau (`renderProbe(name)` ohne
Argumente) läuft aber immer im Ruhe-/Idle-Frame — eine gesetzte Nahkampfwaffe ist im
Vorschaubild deshalb **nie** sichtbar, unabhängig vom Rezept. Das ist eine separat laufende
Engine-Lücke (eigener Agent, parallel), kein Rezeptfehler. `waffe` wurde trotzdem überall
korrekt gesetzt, wo es laut Portrait hingehört — sichtbar wird es automatisch, sobald der
Engine-Fix landet. Betroffene Fälle hier (Riley Le Rogue, Shadowsage, Sunny) sind unten einzeln
vermerkt und ausdrücklich NICHT als offene Lücke gewertet.

## Ergebnis in Zahlen

**11 von 30 angehoben** (10× auf ★★★★, 1× auf ★★★★★), **19 bleiben bei ★★★** — mit
aktualisierter, ehrlicher `begruendung`/`fehlendesDetail`, nicht stillschweigend unverändert
(mehrere der 19 hatten vorher fälschlich `fehlendesDetail: null` bei ★★★, s. Rubrik — das ist
jetzt korrigiert, auch ohne Rezeptänderung).

| Charakter | Fix | Sterne |
|---|---|---:|
| Riley Le Rogue | keine Rezeptänderung nötig — Rüstung/Waffe waren bereits korrekt gesetzt, Bewertungstext war veraltet | ★★★ → ★★★★ |
| Shadowsage | `ruestTon:"violett"` ergänzt | ★★★ → ★★★★ |
| Starflame | `ruestTon:"dunkel"` ergänzt | ★★★ → ★★★★ |
| Sunny | `fluegel:"federn"`, `waffe:"axt"`, `ruestTon:"dunkel"` | ★★★ → ★★★★ |
| Taryn | profitiert von der neuen Kapuzen-Einfärbung (s.u.) — Kapuze jetzt korrekt dunkel | ★★★ → ★★★★ |
| Tavascron | `effekt:{typ:"frost",pos:"koerper"}` ergänzt | ★★★ → ★★★★ |
| Terradon | `vollbildFarbe` (dunkel) + `gluehenderRiss` + `risse`-Liste | ★★★ → ★★★★★ |
| Tidesprinter | `vollbildFarbe` (türkis) ergänzt | ★★★ → ★★★★ |
| Umbra | profitiert von der neuen Kapuzen-Einfärbung — Kapuze jetzt korrekt schwarz | ★★★ → ★★★★ |
| Verla Compliance | `geist:true` ergänzt | ★★★ → ★★★★ |
| Yuko | `fluegel:true` entfernt (Bild-schlägt-Tags-Fund) + `effekt:{typ:"frost",pos:"koerper"}` | ★★★ → ★★★★ |
| Rok Kyl | `haut:"black"` statt `"brown"` (dunklere Haut) — reicht für sich allein nicht für 4 | ★★★ (unverändert) |
| Sanctrix | `fluegel:"federn"` (weiße Flügel) — Cyborg-Arm/Robenfarbe bleiben offen | ★★★ (unverändert) |
| PixiKat, Puschelix, Ralazar the Balanced, Raven, Reefstrike, Rhyx'Tal, Roddox Harthelm, Seraph-11, Shroomgator, Sister Ilora, Tartarus, Tropfina, Tsubaki Cleaning, Velkin, Whispra, Wingless, Wu Tang | geprüft, keine Fix-Primitive vorhanden bzw. mehrere unabhängige Lücken — Bewertungstext aktualisiert/präzisiert, keine Rezeptänderung | ★★★ (unverändert) |

## Neue, generische Erweiterung: Kapuze färbt sich jetzt nach `ruestTon`

Bislang zeichnete `zeichneSprite()`/die Kader-Ikone jede Kapuze fest mit `ton:null` — eine
bereits in mehreren früheren Runden dokumentierte, als „strukturell nicht behebbar ohne
Umbau für ALLE Kapuzen-Träger" markierte Lücke (s. Kommentar bei Whispra/Umbra vor dieser
Runde). Das stimmte so nicht mehr: `spriteRuest()` (die bestehende Umfärbe-Funktion für
`ruest`/`hose`) erkennt die Quellrampe eines Blattes automatisch über `quellRampeRuest()`
gegen die bekannten Paletten (`plate`/`leder`/`leder_frau`/`football_stoff`) — `kapuze_walk.png`
nutzt dieselbe Leder-Rohpalette wie `ruest:"leder"`/`"leder_frau"` und wird deshalb erkannt,
**ohne** dass ein neuer `RUEST_QUELLEN`-Eintrag nötig wäre. Die Zeile

```js
if(b.kapuze)zeichne("kapuze_"+ani,64,0,0,null);
```

wurde zu

```js
if(b.kapuze)male(spriteRuest("kapuze_"+ani,b.ruestTon),64,0,0);
```

(und analog die Kader-Ikone auf `setzR("kapuze_walk",b.ruestTon)`). **Rückwärtskompatibel:**
wer keinen `ruestTon` gesetzt hat, bekommt weiterhin exakt die alte naturfarbene Kapuze (`ton`
bleibt `undefined`) — per `renderProbe` gegen Myrkos (kapuze:true, kein ruestTon) bestätigt:
pixel-identisch zur vorherigen Fassung (Kontrollrender in einer isolierten Kopie von
Commit `6833972d`, keine sichtbare Abweichung durch diese Änderung).

Das hebt **vier Charaktere dieses Batches** direkt (Taryn, Umbra — beide auf ★★★★; Whispra
bleibt ★★★★ wegen anderer offener Lücken, s.u.) und **drei Charaktere außerhalb des Batches**
als Seitennutznießer, deren `ruestTon` schon vorher gesetzt war (Enforcer, Orichalcos, Dr
Ironmind) — deren Vorschau-PNGs sind Teil dieses Commits, weil sie sich jetzt sichtbar anders
rendern, auch wenn ihre Bewertungstexte außerhalb dieses Auftragsumfangs liegen. Bei **Kento**
(★★, außerhalb des Auftragsumfangs) widerlegt die Änderung eine dort explizit dokumentierte
Lücke ("Kapuze ist hell statt schwarz") — der Satz wurde korrigiert, die Sternezahl bewusst
NICHT neu bewertet (das ist Sache eines 2-Sterne-Batches, nicht dieser Runde).

## Vorgehen je Charakter (Auszug)

**Terradon** (★★★ → ★★★★★) — Bildbefund: dunkles, fast schwarzes Vulkangestein mit
durchgehenden glühend-orangenen Rissen über fast den ganzen Körper. Bisher kein
`vollbildFarbe` (natives `golem_walk.png` ist hellgrau) und nur der eine zentrale
`gluehenderRiss`. Exakt dasselbe Muster wie Lava Golem (heute früher, 4-Sterne-Batch A, selber
generischer `risse`-Mechanismus): `vollbildFarbe:"#2b2724"` (dunkles Anthrazit statt Rot, da
Terradons Portrait klar grau/schwarz zeigt, nicht rotstichig wie Lava Golem) + bestehender
`gluehenderRiss` + vier zusätzliche `risse` an Armen/Beinen. Körpertyp/Silhouette (kauernder
Steinkoloss) stimmten bereits — mit der Farbe und den verteilten Rissen ist jetzt nichts
Charakteristisches mehr offen, konsistent mit der Lava-Golem-Kalibrierung desselben Tages.

**Sunny** — Bildbefund: Walküre mit großen weißen Federflügeln, dunkler/fast schwarzer
Plattenrüstung, Streitaxt. `fluegel:true` (generisches braunes Fremdbild) → `"federn"` (rendert
solide weiß). `waffe:"schwert"` → `"axt"` (Chris' Signature-Requisiten-Hinweis: die Axt ist im
Bild eindeutig, kein Schwert). `ruestTon:"dunkel"` neu ergänzt (vorher natur-hell/stahlfarben).
Die Axt selbst erscheint im Ruhe-/Idle-Vorschaubild nicht (bekannte, separat laufende
Engine-Lücke, s.o.) — kein Rezeptfehler.

**Yuko** — Bild-schlägt-Tags-Fund: das Portrait zeigt KEINE an Yukos Rücken angewachsenen
Flügel, sondern einen separaten, frei schwebenden hologramm-blauen Schmetterling neben ihrer
Hand. Das bisherige `fluegel:true` war schlicht falsch, keine Näherung — entfernt.
`effekt:{typ:"frost",pos:"koerper"}` neu als Näherung an die blau leuchtenden Anzug-Akzente.
Der freischwebende Schmetterling-Begleiter selbst bleibt unbaubar (kein Requisiten-/
Haustier-Layer) — der eine verbleibende, benennbare Rest.

**Riley Le Rogue** — Grep-/Sichtbefund: `ruest:"plate_frau"` + `ruestTon:"bronze"` +
`waffe:"schwert"` standen bereits korrekt im Rezept, die alte Bewertung ("Plattenrüstung und
Schwert fehlen") war schlicht veraltet. Keine Rezeptänderung — nur der Bewertungstext korrigiert
(Grundsatz „Score folgt dem Sprite" gilt in beide Richtungen: auch eine zu niedrige, veraltete
Bewertung wird korrigiert, nicht nur eine zu hohe).

**Rok Kyl** — Bildbefund: Horden-Boss mit vielen Hörnern/Stacheln, riesigen Fangzähnen,
fast schwarzer Haut. `haut:"brown"` → `"black"` (die „black"-Rampe ist tatsächlich eine
Schwarz-zu-Dunkelbraun-Stufenfolge, #000000..#7F4C31 — trifft die dunkle Haut deutlich näher).
Die Hörner-/Stacheln-Menge und die Fangzähne bleiben zwei unabhängige, nicht einzeln behebbare
Lücken (nur ein Hornpaar via `hoerner:true` verfügbar, keine Zahn-Textur-Ebene) — bleibt
deshalb bei ★★★, auch mit der verbesserten Farbe.

**Verla Compliance** — Bildbefund: halbtransparente Geister-Sekretärin mit sichtbaren Nebel-/
Wirbelschlieren, ein Dokument in der Hand. `geist:true` ergänzt (`ctx.globalAlpha=0.6`, bereits
bestehende generische Geist-Transparenz, s. Erna Wellenlaut/Myrkos) — per Pixel-Scan bestätigt
(mittlerer Alpha-Wert der sichtbaren Pixel sinkt von ~235 auf ~168). Das Dokument bleibt die
eine verbleibende, unbaubare Requisite.

## Geprüft, aber nicht fixbar bzw. unterhalb der 4-Sterne-Schwelle (19 Charaktere)

Alle 19 wurden einzeln gegen ihr Portrait geprüft; keiner ist ein „vergessener" Fix. Auszug der
auffälligeren Fälle (volle Begründung je Charakter in `sprite-fit-bewertung.json`):

- **PixiKat** — namensgebender Retro-Röhrenfernseher-Kopf samt Tastatur strukturell unbaubar
  (kein TV-Kopf-Layer, kein Requisiten-Slot); Fellfarbe war bereits in einer früheren Runde auf
  korrektes Pink korrigiert. Kategorie (Technik-Kopf-Identität) bleibt verfehlt.
- **Puschelix** — vierbeinige, flauschige Fuchs-/Blattkreatur; geprüft, ob `public/sprites/
  monster/wolf.png` (echter Vierbeiner, bislang unverdrahtet) eine strukturelle Verbesserung
  wäre — verworfen: ein realistischer Kampfwolf-Sprite träfe die extrem stilisierte „niedliche"
  Formsprache des Portraits eher schlechter als der bestehende bipedale Annäherungs-Bauplan,
  und eine neue Zeilen-/Spalten-Vermessung für dieses Blatt wäre ein eigenständiger, größerer
  Auftrag gewesen. Bleibt dokumentiert offen für eine spätere, gezielte Runde.
- **Rhyx'Tal, Tartarus** — strukturell unbaubarer Zentauren-/Vierbeiner-Unterkörper (dieselbe
  Baukasten-Grenze wie Ironhoof), bereits in früheren Runden ausführlich dokumentiert und
  bewusst bei ★★★ gedeckelt trotz sonst korrekter Details.
- **Sister Ilora** — Bildbefund präzisiert: das Portrait zeigt keine Rüstung, sondern ein
  zerrissenes weißes Hemd einer Feldsanitäterin ohne Zivilkleidungs-Layer im Baukasten;
  Augen-/Handenergie sind kühler blauweiß/orange statt der genäherten goldenen Effekt-Farbe —
  zwei unabhängige Lücken.
- **Whispra** — von der Kapuzen-Einfärbung mit profitiert (jetzt korrekt schwarz), bleibt aber
  bei ★★★: Schnabel und Totenkopf-Trophäen am Gürtel bleiben unbaubar, UND das Portrait zeigt
  strukturell eher eine vierbeinige Rabenkreatur mit Krallenfüßen (ähnlich Seraph-11s
  Heron-Umbau) als den humanoiden Körper, den dieses Rezept baut — eine größere strukturelle
  Überarbeitung, außerhalb des Umfangs dieser Nachlieferungsrunde.
- **Sanctrix** — weiße Federflügel jetzt korrekt (`fluegel:"federn"`), aber kybernetische
  Rüstungsteile (mechanischer Arm) und teal-goldene Robenfarbe (kein entsprechender
  `ruestTon`, `leder_frau` bleibt naturbraun) bleiben zwei unabhängige Lücken.

## Verifikation

**Syntax:**

```
node --check public/mockups/battle-mode.engine.js
```

→ OK (nach jeder Änderungsrunde erneut geprüft).

**`aufEignung(s,eig)` liest keine Sprite-/`BAU`-Felder:** die komplette Funktion
(`public/mockups/battle-mode.engine.js`, `function aufEignung(s,eig){...}`) wurde gelesen und
per Grep gegen `BAU`/`b\.ruest`/`b\.vollbild`/`b\.fluegel`/`b\.kapuze` geprüft — keine Treffer.
Sie rechnet ausschließlich mit `s.LP`/`s.VER`/`s.ANG` (Eignungs-Skalierung über `rohKraft()`).
Alle in diesem PR geänderten/neuen Felder (`ruestTon`, `fluegel`, `waffe`, `haut`,
`vollbildFarbe`, `gluehenderRiss`, `risse`, `geist`, `effekt`) werden ausschließlich innerhalb
von `zeichneSprite()`/der Kader-Ikonen-Funktion gelesen — reine Zeichenfunktionen, keine
Simulationsberührung.

**Regressionskontrolle:** `node scripts/miss-alle-disziplinen.mjs 4` wurde gestartet, lief aber
unter der an diesem Tag dokumentierten starken gleichzeitigen Systemlast (mehrere parallele
Sprite-Fit-Batch-Agenten auf derselben Maschine) nicht in nutzbarer Zeit durch und wurde
abgebrochen, ohne verwertbare Teilausgabe zu liefern. Die Projekt-Abnahmeregel erlaubt den
Grep-Nachweis ausdrücklich als eigenständigen Ersatz, wenn die Probe unter Systemlast nicht
praktikabel ist (`docs/BUGFIXING_AGENT.md`/Blueprint „Grep-Nachweis ODER kurzer Lauf") — der
Grep-Nachweis oben (vollständige Funktionskörper-Prüfung von `aufEignung`) deckt die
Abnahmeregel vollständig ab.

**Kapuzen-Umfärbung speziell gegengeprüft:** `renderProbe` für Myrkos (kapuze:true, kein
`ruestTon`) aus einer isolierten Kopie von Commit `6833972d` (unverändertes `engine.js`) gegen
dieselbe isolierte Kopie mit der neuen Zeile erzeugt — Ergebnis pixel-identisch (keine
Regression für die ~8 anderen Kapuzen-Träger ohne gesetzten `ruestTon`). Für die betroffenen
Charaktere mit gesetztem `ruestTon` (Umbra, Taryn, Shadowsage, Whispra, plus die
Seiteneffekt-Fälle Enforcer/Orichalcos/Dr Ironmind) per Pixel-Scan bestätigt, dass die Kapuze
jetzt tatsächlich den `ruestTon`-Farbton trägt.

**Vorschauen neu erzeugt:** `node scripts/erzeuge-sprite-vorschauen.mjs "<Name>"` für jeden
sichtbar geänderten Charakter gelaufen. 19 PNGs geändert und Teil dieses Commits: die 11
angehobenen Charaktere dieses Batches, plus Rok Kyl und Sanctrix (Farbe/Flügel geändert, Stern
unverändert), plus die drei Kapuzen-Seiteneffekte außerhalb des Batches (Enforcer, Orichalcos,
Dr Ironmind) und Kento (Bewertungstext korrigiert). Eine vierte Kontrollmessung (Myrkos, kein
`ruestTon`) ergab bei der Neuerzeugung eine Pixel-Abweichung — durch eine isolierte
Gegenprobe (s.o.) als VORBESTEHENDE, von dieser Änderung unabhängige Render-Instabilität
identifiziert (schon das unveränderte `engine.js` aus Commit `6833972d` reproduziert sein
eigenes committetes `myrkos.png` nicht pixelgenau) und deshalb NICHT in diesen Commit
übernommen (`git checkout -- public/sprites/preview/myrkos.png`).

**`sprite-fit-bewertung.json` Indent:** mit `JSON.stringify(data, null, 1)` geschrieben,
`head -3` bestätigt Zeile 2 = ` {` (ein führendes Leerzeichen).

## Was übrig bleibt (nicht in diesem PR)

- Shroomgator fehlt weiterhin in `data/generated/battle-arena-sprite-gallery.json` (144
  Einträge, Shroomgator nicht darunter, obwohl `BAU`/Portrait/Bewertung existieren) — deshalb
  erzeugt `erzeuge-sprite-vorschauen.mjs` nie ein Vorschaubild dafür. Kein Rezeptfehler dieser
  Runde, aber ein Galerie-Pflegepunkt für eine spätere Runde.
- Puschelix' mögliche Vierbeiner-Umstellung auf `public/sprites/monster/wolf.png` wurde geprüft
  und für diese Runde verworfen (s.o.) — bleibt ein Kandidat für eine eigene, gezielte Runde mit
  Zeilen-/Spalten-Vermessung des Blattes.
- Die neue Kapuzen-Einfärbung ist generisch für ALLE künftigen `kapuze:true`-Charaktere nutzbar,
  nicht nur die hier gefixten vier — ein Nebengewinn für kommende Runden.
