# Sprite-Fit-Ergebnisse — erste Bewertungsrunde

Bewertung aller 144 Charaktere aus der QA-Galerie (`data/generated/battle-arena-sprite-gallery.json`)
nach der Rubrik in [`sprite-fit-bewertungssystem.md`](./sprite-fit-bewertungssystem.md). Jedes
Portrait (`public/portraits/<slug>.jpg`) wurde direkt neben der aktuellen Sprite-Vorschau
(`public/sprites/preview/<slug>.png`, Stand PR #709) verglichen. Rohdaten:
`data/generated/sprite-fit-bewertung.json`.

## Verteilung

| Sterne | Anzahl | Anteil |
|---|---|---|
| ★★★★★ | 1 | 0.7 % |
| ★★★★ | 24 | 16.7 % |
| ★★★ | 45 | 31.2 % |
| ★★ | 69 | 47.9 % |
| ★ | 5 | 3.5 % |

Der Schwerpunkt liegt klar bei ★★ (fast die Hälfte): die meisten Rezepte treffen die grobe
menschliche/monströse Kategorie, verfehlen aber die Identität des jeweiligen Charakters fast
vollständig — oft, weil ein sichtlich generischer Basiskörper (siehe Befund unten) ohne
charakterspezifische Anpassung verwendet wurde. Nur ein einziger Charakter (King Arlen Morgolor,
Chris' eigener Ankerpunkt) erreicht die volle Punktzahl.

## Nebenbefund: doppelt vergebene Sprites

Beim Durchgehen fiel auf, dass mehrere Charaktere **exakt dieselbe** Sprite-Datei
(byte-identisch, per Hash geprüft) teilen, obwohl ihre Portraits nichts miteinander zu tun haben:

- Babuschinka, Bana, Dr Ironmind, Gralakar (Kapuzen-Vorlage)
- Burster, Threnox (Skelett-Vorlage — trifft Threnox gut, Burster kaum)
- Draco, Steel Sinister (Roboter-Visier-Kopf)
- Elara, Lady Yueqin, Starflame (Silberhaar-Vorlage)
- Ironhoof, Medibull (gehörnter Kopf)
- Kento, Umbra
- Lilly, Lys Puppenkopf
- Mushu, Rhyx'Tal (geflügeltes Drachen-Wesen — trifft keinen der beiden gut)
- Myrkos, Orichalcos

Das erklärt einen Teil der ★★-Häufung: dieselbe Vorlage kann für ein Portrait zufällig passen
(Threnox) und für ein anderes komplett danebenliegen (Burster). Das ist kein Bewertungsfehler,
sondern spiegelt wider, dass diese "handgebauten" Rezepte de facto denselben generischen
Baustein wiederverwenden, statt für jeden Charakter individuell zu sein.

## Hinweis zu Krolach (Abweichung von Chris' Kalibrierpunkt)

Chris' Beschreibung: "Krolach hat noch diese Kristallstacheln im Portrait, die er im Modell
bräuchte, um 5 Sterne zu bekommen — sonst ist es nur ein Standard-Construct-Look, eher 2-3
Sterne." Das aktuelle Sprite zeigt jedoch kein Construct/Golem-Aussehen, sondern eine
grünhäutige, reptilienartige Figur ohne jeden Bezug zu Stein, Kristall oder dem türkis-grauen
Titanen aus dem Portrait. Eingestuft wurde es daher mit **★★**, nicht ★★★. Entweder hat sich das
Rezept seit Chris' letzter Prüfung verändert, oder hier lohnt ein zweiter Blick von ihm direkt —
das aktuelle Bild passt jedenfalls nicht zu "Standard-Construct-Look".

## ★ — Triage-Liste: braucht komplett neue/externe Assets (5)

Portraits zeigen etwas strukturell außerhalb des Baukastens (echtes Tier, Objekt, unklare Form) —
hier hilft keine kleine Korrektur am bestehenden Rezept.

- **Byrd** — Zwiebelkopf-Wesen (anthropomorphes Gemüse mit Schutzbrille und Kehrbesen); keinerlei Bezug im Sprite.
- **Gralakar** — Bedrohlicher Sensenmann mit rot glühenden Augen und Rippenkäfig; Sprite ist die fröhliche Standard-Vorlage (identisch mit Babuschinka/Bana/Dr Ironmind).
- **Orakelpfropf** — Reales Katzenfoto mit Eimer auf dem Kopf; komplett andere Gattung als das Sprite.
- **Tavascron** — Massiver blau leuchtender Kampf-Mech; Sprite ist als Form kaum erkennbar und ohne jeden Mech-Bezug.
- **Vigil** — Überwachungskamera-Taube (Chris' eigener Ankerpunkt); Sprite ist ein generischer grauer Humanoid ohne Vogel-Merkmale.

## ★★★★ — Triage-Liste: kleine Korrektur reicht (24)

Grundidentität stimmt, ein einzelnes, klar benennbares Detail fehlt für die volle Punktzahl.

| Charakter | Fehlt für 5 Sterne |
|---|---|
| Alarm | Runder "ALARM"-Bildschirmkopf mit Text-Display statt schmalem Augenstreifen |
| Butterfly | Regenbogen-Farbverlauf auf den Flügeln (aktuell golden-schwarz) |
| Cadrael | Leuchtender Stab (Zepter) |
| Elyon | Ritterhelm statt Roboter-Visier, dazu Schwert/Schild |
| Elyssa Nightclaw | Echsen-Schnauzen-Gesicht statt Goblin-Kopf, dazu Dolch |
| Greybeard | Holzstab (Wanderstab), sichtbares Stammes-Tattoo |
| Holzfaust | Weiße Schürze, Schnitzwerkzeug |
| Inefinna | Schwert, wallender weißer Umhang |
| Jorund | Holzstab, dicker Pelzumhang |
| Knochenrichter | Blau leuchtende Augen, Schädel-Stab |
| Lava Golem | Dämonenhörner, mehr durchgehende Lavaadern statt nur eines Risses |
| Leviathan | Farbe von feurigem Rot zu türkis-blaugrün (Wasserdrache) |
| Mavra | Rote statt braune Lederkleidung, Kriegsaxt |
| Nahli-Ke | Schlankere, nacktere Alien-Silhouette statt erdigem Overall |
| Nhyra-Vel | Sternenglühen/Nebel-Textur auf der Haut |
| Phantomblade | Augenbinde, Zwillingsdolche |
| Serena | Erhobenes Schwert |
| Skittermind | Waffen am Boden, kräftigere türkis-grüne Farbe |
| Sweet Dreams | Zepter/Dreizack, violetter Farbakzent im Gewand |
| Threnox | Rippenkäfig-Harfe (das Instrument) |
| Tidesinger | Türkisblaue Schuppenfarbe statt Grau, Wasser-Magie-Wirbel |
| Vargan | Speer |
| Xelara | Hoher, kantiger Uniformkragen |
| Xerathis | Leuchtend türkise Akzentlinien auf dem Anzug |

## ★★★ — Sammelliste (45)

Grobe Kategorie stimmt, aber spürbar generisch oder mehrere Details fehlen gleichzeitig (siehe
`sprite-fit-bewertung.json` für die Einzelbegründung je Charakter):

Aeon Flux, Akali, Aurora, Bana, Cassandra, Catherine, Clara, Dawnwhisper, Drop Dead, Dyrth, Eike,
Elara, Emphi, Enforcer, Gram, Gronkslime, Issyria, Isuzu, Jihanna, Johanna, Kora, Krag'Zul,
Kreischende Kogge, Lady Yueqin, Lilly, Lulu, Lynara, Melody, Moonveil, Murky, Nachtschatten,
Nocture, Node, Puschelix, Riley Le Rogue, Rok Kyl, Sanctrix, Starflame, Sunny, Taryn, Terradon,
Verla Compliance, Wingless, Wu Tang, Yuko

Häufigstes Muster in dieser Gruppe: Haarfarbe oder ein Grundton (golden/silbern/dunkel) trifft
zufällig, aber ein zentrales Requisit (Waffe, Stab, Buch) oder eine auffällige Zweitfarbe fehlt.

## ★★ — vollständige Liste (69)

Kategorie passt kaum oder ist stark verfälscht, aber ein loser Bezug (Farbfamilie, Thema) bleibt:

Abysskraken, Aegirion, Arachna, Babuschinka, Bearington, Bloater, Bombblitzer, Breeze, Brightpaw,
Brobot, Brunhilde, Burster, Byrnja, Caldor, Ciacia, Crumbsage, Cyrn, Dr Ironmind, Draco, Eldara,
Erna Wellenlaut, Falcon, Galactus, Greenkraut, Grieving Colossus, Grizz, Harbinger, Hellvoice,
Ironhoof, Kento, Krolach, Lady Mournvale, Lucky, Lumen Serene, Lys Puppenkopf, Medibull,
Mindtamer, Mushu, Myrkos, Nelchael, Nimri, Omniclops, Orichalcos, Othrama, Pinkypie, PixiKat,
Ralazar the Balanced, Raven, Reefstrike, Rhyx'Tal, Roddox Harthelm, Rootheart, Seraph-11,
Shadowsage, Shield, Sister Ilora, Starbound, Steel Sinister, Tartarus, Tidesprinter, Timantha,
Treantos, Tropfina, Tsubaki Cleaning, Umbra, Velkin, Vorrak, Whispra, Xylaris

Auffälligstes Teilmuster hier: Fast jeder "Wald-Riese/Baumwesen"-Charakter (Cyrn, Greenkraut,
Rootheart, Treantos, Tropfina) und fast jeder "gehörnte Minotaurus/Zentaur"-Charakter (Ironhoof,
Kora [★★★, knapp besser], Medibull, Omniclops, Roddox Harthelm, Tartarus) landet unabhängig
voneinander bei derselben generischen grünen bzw. gehörnten Silhouette — ein systematisches
Baukasten-Loch, keine Einzelfälle.

## Einschätzung zur Trennschärfe des Systems

Die Rubrik trennt in der Praxis gut zwischen den Extremen (King Arlen Morgolor auf der einen,
Vigil/Tavascron auf der anderen Seite), und die 4-Stern-Fälle liefern fast durchweg einen
sauberen Ein-Satz-Fix. Am unschärfsten war die Grenze zwischen ★★ und ★★★ bei Charakteren mit
generischem Körper, aber zufällig passender Haarfarbe (z. B. Cassandra, Elara, Lady Yueqin) —
hier musste entschieden werden, ob eine einzelne zufällige Farbübereinstimmung schon als "grobe
Kategorie trifft" zählt oder nicht; die hier verwendete Faustregel war: zählt nur dann als ★★★
statt ★★, wenn zusätzlich die grobe Rüstungs-/Kleidungsfarbe mit übereinstimmt, nicht nur das
Haar. Ebenfalls unsicher: Aegirion vs. Kreischende Kogge (beides Schiff-Charaktere) — nur weil
Kreischende Kogges generisches Piraten-Segel zufällig ein Totenkopf-Motiv trägt, das zum
Geisterschiff-Konzept passt, kam es auf ★★★ statt ★★ wie Aegirion; das ist eine sehr knappe
Entscheidung, die stark vom Zufall der verwendeten Segel-Textur abhängt.
