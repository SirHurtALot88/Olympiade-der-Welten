# "Haben wir wirklich keine weiblichen Körper für Lulu/Inefinna/Cassandra?" (04.09.)

Chris' Frage, wörtlich: „Und haben wir wirklich keine weiblichen körper für zb lulu oder
inefinna oder cassandra? die müssen eigentlich mal anders aussehen". Dieses Dokument hält
fest, was tatsächlich geprüft wurde, was sich als der reale Befund herausstellte (nicht
das, was die Frage unterstellte), was geändert wurde, und was ehrlich offen bleibt.

## Erster Schritt: die Prämisse der Frage prüfen, nicht übernehmen

Ein weiblicher Körper und ein weiblicher Menschenkopf existieren im Baukasten längst
(`kw_*`/`gw_*`, s. `public/sprites/baukasten/README.md` Abschnitt „Weibliche Körper sind
da (24.08.)") und werden für jeden Bauplan-Eintrag mit `geschlecht:"w"` auch tatsächlich
gezeichnet — nachgeprüft im Code (`public/mockups/battle-mode.engine.js`, zwei
Aufrufstellen: der Haupt-Sprite-Renderer und `figur()` für die Kaderleiste). Alle drei von
Chris genannten Charaktere tragen `geschlecht:"w"`:

```js
"Inefinna": {kopf:"human",haut:"light",ruest:"plate_frau",hose:"beine_frau",geschlecht:"w", …},
"Lulu":     {kopf:"human",haut:"light",ohren:true,ruest:"leder",geschlecht:"w", …},
"Cassandra":{kopf:"human",haut:"light",ruest:"leder",ohren:true, …,geschlecht:"w"},
```

Die Frage "haben wir keine weiblichen Körper" ist damit im wörtlichen Sinn falsch — der
Körper ist da. Die eigentliche Frage, die Chris' Eindruck ("die müssen eigentlich mal
anders aussehen") tatsächlich trifft, ist: **warum sieht man den Unterschied kaum?**

## Sichtprüfung: renderProbe, echte 64×64-Pixelgröße, kein Zoom

`window.__arena.renderProbe(name)` ohne weitere Argumente ist exakt der Aufruf, den auch
die echte, für Chris sichtbare Galerie benutzt (`scripts/erzeuge-sprite-vorschauen.mjs`).
Lulu, Cassandra und Inefinna wurden so gerendert und gegen zwei männliche Referenzen mit
vergleichbarer Lederrüstung verglichen (Jorund, Greybeard — beide `ruest:"leder"`).

![Lulu und Cassandra, vorher/nachher — oben in echten 64×64 Pixeln ohne jede Skalierung
(das ist die tatsächliche Bewertungsgrundlage), unten 6x mit nearest-neighbor vergrößert
NUR zur Lesbarkeit in diesem Dokument](./lulu-cassandra-leder-frau-vergleich.png)

**Befund, nicht Vermutung:** Lulu/Cassandra und Jorund/Greybeard hatten VOR dieser Änderung
exakt dieselbe Torso-Silhouette — kastenförmig, ohne Taille, geradlinig von der Schulter bis
zur Hüfte. Der Unterschied zwischen den vier Figuren beschränkte sich auf Frisur/Haarfarbe
und den (kaum sichtbaren) Kopf. Inefinna dagegen (bereits am 26.08. auf `plate_frau`
umgestellt) zeigt eine klar taillierte, an Hüfte/Brust andere Silhouette als ein männlicher
Ritter in `plate`.

**Ursache, im Code nachvollzogen:** `ruest:"leder"` ist ein einzelnes Brustharnisch-Blatt
aus dem LPC-Satz, männlich geschnitten (`torso/armour/leather/male/`). Es wird unverändert
für JEDEN Charakter mit `ruest:"leder"` gezeichnet, unabhängig von `geschlecht`. Das Blatt
deckt den kompletten sichtbaren Oberkörper ab — der weibliche Körper darunter (`kw_*`)
existiert und wird auch gezeichnet, ist aber unter der männlich geschnittenen Rüstung nicht
mehr zu sehen. Genau dieselbe Ursache wie bei Inefinnas `plate`→`plate_frau`-Korrektur vom
26.08., nur für die Leder- statt die Platten-Ebene, und bislang nicht behoben.

## Gibt es einen Damenschnitt für Leder im LPC-Satz? Ja — nachgesehen, nicht vermutet

Lokaler LPC-Checkout (`liberatedpixelcup/universal-lpc-spritesheet-character-generator`,
derselbe, aus dem `plate_frau`/`beine_frau` stammen): `torso/armour/leather/female/`
existiert, mit allen sechs Bewegungen (`slash`, `walk`, `run`, `idle`, `hurt`, `shoot`),
lizenziert unter OGA-BY 3.0 / CC-BY-SA 3.0 / GPL 3.0 (CREDITS.csv geprüft, dieselbe
Lizenzkette wie `r_frau`).

Gemessen, nicht angenommen:

- **Gleiche Blattmaße** wie das männliche Vorbild (384×256 bei `slash`, 576×256 bei
  `walk`) — Drop-in-Ersatz.
- **Farbrampe ausgezählt** aus `female/walk.png` (Alpha > 200, Top-6-Farben nach
  Pixelzahl): `#2B1C1D`, `#704325`, `#75502D`, `#4B2B13`, `#9A6F37`, `#C4B59F` — exakt
  dieselben sechs Töne wie die bereits im Code hinterlegte männliche `leder`-Rampe
  (`RUEST_QUELLEN`). Die weibliche Fassung ist ein reiner Silhouetten-Recolor derselben
  Basisfarben, keine neue Palette nötig.

## Was geändert wurde

1. `public/sprites/baukasten/leder_frau_{slash,walk,shoot,hurt,idle,run}.png` — byte-
   identische Übernahme aus dem LPC-Checkout (die vier ersten sind tatsächlich verdrahtet,
   `idle`/`run` liegen wie beim männlichen Vorbild nur als Datei vor, weil `ANIBILDER` sie
   für die Rüstungsebene ohnehin nie anfragt).
2. `public/sprites/baukasten/quellen.json` — neuer Eintrag `leder_frau_slash` mit
   vollständiger Quellen-/Lizenzangabe.
3. `public/mockups/battle-mode.engine.js`:
   - `RUEST_QUELLEN` um einen `"leder_frau"`-Eintrag ergänzt (dieselbe Rampe wie `leder`).
     **Ohne diesen Eintrag** hätte `spriteBeine()` beim Nachschlagen von `ruestKey:
     "leder_frau"` nichts gefunden und wäre auf nackte, hautfarbene Beine zurückgefallen —
     ein Rückschritt gegenüber dem alten Zustand. Das wurde vor dem Verifikations-Rendering
     geprüft und im selben Schritt mit erledigt.
   - Vier neue Base64-Einträge im `SPRITES`-Objekt (`leder_frau_slash/_walk/_shoot/_hurt`).
   - `BAU["Lulu"]` und `BAU["Cassandra"]`: `ruest:"leder"` → `ruest:"leder_frau"`.

## Verifikation danach — wieder echte Pixelgröße, kein Zoom

Dieselbe `renderProbe`-Prüfung nach der Änderung wiederholt (Bild oben, Zeile
"NACHHER"): Lulu und Cassandra zeigen jetzt eine sichtbar taillierte, an Hüfte und
Oberkörper vom männlichen Kasten-Torso unterscheidbare Silhouette. Beine bleiben in
derselben braunen Lederfarbe wie vorher (RUEST_QUELLEN-Eintrag greift), kein
Farb-/Rückschritt.

## Was bewusst offen bleibt — keine Serienumstellung ohne Einzelprüfung

`ruest:"leder"` mit `geschlecht:"w"` steht noch bei **41** weiteren Namen im Bauplan —
ausgezählt per Skript (Zeilen mit `ruest:"leder"` UND `geschlecht:"w"`), nicht geschätzt:
Xelara, Byrnja, Elara, Mindtamer, Mavra, Starflame, Babuschinka, Melody, Pinkypie, Jihanna,
Drop Dead, Nachtschatten, Erna Wellenlaut, Xerathis, Aurora, Lilly, Elyssa Nightclaw, Lady
Mournvale, Nelchael, Akali, Nahli-Ke, Lady Yueqin, Whispra, Bana, Taryn, Lys Puppenkopf,
Verla Compliance, Brunhilde, Xylaris, Kora, Dawnwhisper, Sister Ilora, Lynara, Dr Ironmind,
Lumen Serene, Sanctrix, Eldara, Byrd, Clara, Breeze, Wu Tang.
Dieselbe Lücke besteht für `ruest:"plate"` bei **17** weiteren Trägerinnen (Johanna, Aeon
Flux, Serena, Emphi, Moonveil, Riley Le Rogue, Phantomblade, Sweet Dreams, Issyria,
Wingless, Sunny, Ciacia, Cadrael, Yuko, Timantha, Tidesinger, Isuzu) — `plate_frau`
existiert bereits im Code, ist bei diesen Namen aber nicht eingetragen.

Diese Runde stellt bewusst NUR Lulu und Cassandra um — die zwei Namen, die Chris konkret
genannt hat, und die einzigen, die tatsächlich per `renderProbe` einzeln angesehen wurden.
Eine Serienumstellung aller 58 betroffenen Namen ohne Einzel-Sichtprüfung widerspräche
genau der Lektion, die diese Session zweimal lernen musste: eine visuelle Änderung gilt
erst als bestätigt, wenn sie in der echten Galerie-Pose/-Größe angesehen wurde, nicht als
Bulk-Textänderung. Mehrere der übrigen Namen tragen außerdem Zusatzebenen (`hose`,
`kapuze`, `effekt`), die beim Umstieg mitgeprüft werden müssten — das ist ein sauberer,
aber eigener Folgeauftrag.

`data/generated/sprite-fit-bewertung.json` (Stern-Bewertungen für Lulu/Cassandra) wurde
bewusst NICHT angefasst: die dortigen Begründungen bewerten weitere, hier nicht geprüfte
Details (Armreifen, Blätter-Requisite bei Lulu; Bogen, Köcher, grüne statt braune
Lederfarbe bei Cassandra) — eine Sternkorrektur ohne vollständige Neubewertung all dieser
Punkte wäre dieselbe Art von unbelegter Behauptung, vor der diese Session bereits gewarnt
wurde.

## Syntax und Regression

```
node --check public/mockups/battle-mode.engine.js
```
→ OK.

```
node scripts/miss-alle-disziplinen.mjs 24
```
→ bit-identisch zum Stand vor dieser Änderung (Vorher/Nachher-Läufe verglichen). Erwartbar:
geändert wurden ausschließlich `RUEST_QUELLEN` (nur von den Canvas-Zeichenfunktionen
`spriteRuest`/`spriteBeine` gelesen) und das `ruest`-Feld zweier `BAU`-Einträge (ein reines
Rendering-Feld, nicht Teil der Eignungs-/Attributberechnung `a:{…}`, `sub`, `tp`, `tn`,
`groesse`) — keine Berührung mit irgendeiner Zahl, die in die Simulation eingeht.

## Geänderte/neue Dateien

- `public/sprites/baukasten/leder_frau_{slash,walk,shoot,hurt,idle,run}.png` — neu.
- `public/sprites/baukasten/quellen.json` — neuer `leder_frau_slash`-Eintrag.
- `public/sprites/baukasten/README.md` — neuer Abschnitt „Weiblich geschnittene
  Lederrüstung (04.09.)".
- `public/mockups/battle-mode.engine.js` — `RUEST_QUELLEN`, `SPRITES`, `BAU["Lulu"]`,
  `BAU["Cassandra"]`.
- `docs/design/lulu-cassandra-weibliche-ruestung.md` — dieses Dokument.
- `docs/design/lulu-cassandra-leder-frau-vergleich.png` — Vorher/Nachher-Beleg.
