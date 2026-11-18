# Einsatzliste: ruhige Disziplin-Flächen (Stilprobe 18.11.)

Auftrag Chris, 18.11.: „Kannst du für die Einsatzliste wie im Mockup auch jeweils je nach Disziplin einen
einfachen passenden Background, der nicht aufdringlich ist, für die Disziplin generieren?“ Gemeint ist die
Feldfläche in der Mitte der modernen Einsatzliste (`EinsatzlisteModern.tsx`, `.elm-feld`), auf der die
Platzkarten liegen. Heute ist sie für alle Disziplinen einfarbig dunkel.

**Stand: Stilprobe für drei Disziplinen, nichts in die App eingebaut.** Chris entscheidet anhand der
Vergleichsbilder, ob die übrigen 17 bestellt werden.

## Vergleichsbilder

Je Bild links (a) die neue Fläche, rechts (b) der vorhandene Arenaboden, beide gleich behandelt
(900×520, 60 % Abdunklung auf UI-Grund, Vignette, Platzkarten-Attrappen):

- `docs/design/einsatzliste-flaechen-18-11/vergleich-eiskunstlauf.png`
- `docs/design/einsatzliste-flaechen-18-11/vergleich-battlefield.png`
- `docs/design/einsatzliste-flaechen-18-11/vergleich-wettessen.png`

Die Flächen selbst: `public/sprites/einsatzliste-flaechen/{eiskunstlauf,battlefield,wettessen}.jpg`
(1344×768, 90–145 KB), Herkunft in `public/sprites/einsatzliste-flaechen/quellen.json`.

## Stil-Regeln

1. **Reine Draufsicht, ein Material, bildfüllend.** Die Spielfläche reicht von Rand zu Rand; kein
   Drumherum (Tribüne, Wand, Möbel). Die vorhandenen Arenaböden sind Schrägsichten mit Publikum, Banden-
   werbung und Schrift — unter Karten liest man das als Unruhe (siehe Wettessen (b): Theke und Krüge
   laufen durch die Kartenreihe).
2. **Keine Figuren, keine Schrift, keine Logos, keine Requisiten.** Nur Material und Markierung.
3. **Ein bis zwei disziplintypische Zeichen**, dünn und kontrastarm: Linien/Kreise auf Eis und Rasen,
   Bohlenfugen und Läufer auf dem Tisch. Das Zeichen trägt die Wiedererkennung, nicht die Farbe.
4. **Gedeckte Farben, wenig Kontrast, niedriger Detailgrad** (`detail: low detail`, `outline: lineless`).
   Die Fläche darf hell sein; die App dunkelt ab.
5. **Behandlung in der App (Empfehlung für den Einbau):** `background-size: cover`, darüber
   `rgba(10,14,22,.60)` und eine radiale Vignette zum Rand (Rand ~85 % dunkel), `image-rendering: pixelated`.
   Karten behalten ihren deckenden dunklen Grund; der Gold-Akzent bleibt die einzige kräftige Farbe.
6. **Ein Bild je Disziplin**, nicht je Arena-Variante.

## Technik und Kosten

- Endpunkt `POST /v2/create-image-pixen`, 672×384 (größtes 16:9-nahes Format unter der Flächengrenze
  512×512), `view: "high top-down"`, `outline: "lineless"`, `detail: "low detail"`, `no_background: false`.
  **1 Generation je Bild** (aus `usage.generations`). Zum Vergleich: `/generate-image-v2` in Kulissengröße
  kostet 25 je Auftrag und liefert genau die Detailfülle, die hier stört.
- Bau: Rohbild 2× NEAREST auf 1344×768, JPEG Qualität 80.
- Probe: **5 Generationen** (Obergrenze 12). Guthaben 866,74 → 861,74.

| Versuch | Gen. | Ergebnis |
|---|---:|---|
| eiskunstlauf Saat 11 | 1 | verworfen: Bahn hochkant in dunkler Halle, nicht bildfüllend |
| eiskunstlauf Saat 12 | 1 | **gewählt**; bildfüllend, aber helle Lichtflecken und Kreis außermittig |
| battlefield Saat 12 | 1 | **gewählt** |
| wettessen Saat 12 | 1 | **gewählt** |
| eiskunstlauf Saat 13 | 1 | verworfen: schmale Bahn auf Schwarz, zu viele Linien |

Lehre: „covers the entire image from the left edge to the right edge“ plus „landscape format“ ist nötig,
sonst malt das Modell die Fläche als Objekt in eine Umgebung. Symmetrie (ein Mittelkreis genau in der
Mitte) hält pixen nicht zuverlässig; Markierungen deshalb als „ein paar“ beschreiben statt exakt.
Wer exakte Linien will (Basketball, Tennis), lässt nur das Material generieren und legt die Linien
als CSS/SVG darüber — das passt auch zum Mockup.

## Prompt-Vorlage für die übrigen 17

```
view from directly above of one wide <FLÄCHE> in landscape format, the <MATERIAL> covers the entire
image from the left edge to the right edge, <1–2 ZEICHEN, dünn/blass>, <RAND: thin darker … along the
outer border>, calm muted colors, low contrast, large empty even surface, minimal detail, no people,
no characters, no audience, no furniture, no text, no logos, pixel art
```

| Disziplin | Fläche / Material | Zeichen |
|---|---|---|
| basketball | Hallenparkett, helles Ahorn | nur Dielen; Linien per CSS |
| hockey | Eis, kühler/weißer als Eiskunstlauf | blasse rote und blaue Querlinie |
| football | Rasen mit Mähstreifen | blasse Yard-Querlinien |
| tennis | Sandplatz, gedecktes Ziegelrot | nur Belag; Linien per CSS |
| fechten | graue Metallbahn (Planche) auf dunklem Hallenboden | Mittel- und Startlinien |
| gewichtheben | Holzplattform mit dunklen Gummimatten links/rechts | Fugen |
| breaking | fleckiger Betonboden, Kellerraum | Abfluss, Risse |
| climbing | graue Felswand frontal (Wand = Fläche) | wenige blasse Griffe |
| i-spy | Steinplatten eines Tempelbodens | Fugen, ein Ornamentkreis |
| mini-dm | abgetretener Sandboden einer kleinen Kampfgrube | Kreidekreis |
| tdm | Betonplatten/Asphalt eines Hofs | zwei blasse Zonenmarken |
| showcase | dunkle Bühnenbretter | ein blasser Lichtkegel-Kreis |
| speed-schach | Schachbrett-Pflaster, sehr kontrastarm (zwei nahe Grautöne) | — |
| spurt | Tartanbahn, gedecktes Rot | Bahnlinien längs |
| staffel | Tartanbahn, gedecktes Blaugrau (Abgrenzung zu Spurt) | Bahnlinien, Wechselmarke |
| time-trial | Asphaltstraße | Mittelstreifen, Startlinie |
| takeshi | Lehm-/Schlammboden mit Holzstegen | zwei Planken, Pfütze |

## Kostenschätzung für den Rest

17 Disziplinen × 1 Generation, erfahrungsgemäß 1,5–2 Versuche je Treffer (Probe: 5 für 3):
**erwartet 25–35 Generationen, Obergrenze 40.** Das Guthaben (861,7; Reserve 150) trägt das ohne
Weiteres. Eiskunstlauf sollte in dieser Runde noch einen besseren Treffer bekommen (1–2 Gen.,
eingerechnet).

## Empfehlung

**Neu generieren.** Die neuen Flächen bleiben unter den Karten ruhig und sind trotzdem auf einen Blick
als Eis, Rasen, Tisch erkennbar; die vorhandenen Arenaböden bringen Publikum, Werbebanden mit Schrift
und Mobiliar mit. Ausnahme zur Ehrlichkeit: der vorhandene Eiskunstlauf-Boden ist in der Mitte schon
sehr ruhig — dort stören nur Tribüne und Bandenschrift am Rand; mit engerem Ausschnitt wäre er nutzbar,
hat aber kein erkennbares Zeichen (keine Bande, kein Kreis) und liest sich als graue Fläche.
