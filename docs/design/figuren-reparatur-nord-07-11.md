# Figuren-Reparatur und Nord-Animation (06./07.11.)

Ausgangspunkt: von den 360 PixelLab-Figuren in `data/generated/figuren-sprites.json` hatten 154
nicht alle acht Slots (vier Arten walk/angriff/treffer/tod × zwei erzeugte Richtungen Süd/Ost;
West ist im Motor Ost gespiegelt, Norden war bis 06.11. nur Grundpose). 62 davon stehen im
aktiven Spielstand (`new-game-1793476611202-0dwpok`) in einem Kader. Chris am 06.11.: alle 360
sollen außerdem eine echte Nord-Animation bekommen (PR #1344 hat die Pipeline dafür geöffnet).

## 1. Root Cause — gegen die Live-API nachgemessen

**Alle 154 stammen aus dem Erst-Export vom 02.11.** (Commit addeede96, 267 Figuren) und wurden
seitdem nie neu gezogen. Beweis: die `quelle`-Werte `text/gid/frames/heur` (767 Gruppen) schreibt
keine eingecheckte Version von `scripts/figuren-sprites-export.py`; sie kommen aus Bau-Skripten,
die nicht im Repo liegen. Die 93 Figuren der vier `--nur`-Batches vom 02.11. tragen alle
`gespeichert` und sind vollständig.

Zwei Ursachen überlagern sich:

### 1a. Erkennungs-Bug (Pipeline)

Das Skript hatte **keine Angriffs-Schlüsselwörter**. `angriff` entstand nur als Rückfall der
Bildheuristik `frame_kind()`, und die

- hielt Angriffe mit langem Aufholen (12 Bilder Stand, dann Hieb) für **Gehen**,
- hielt Tode ohne Höhenverlust (Sturz nach hinten, Explosion) für **Angriffe**,
- konnte **nie** `treffer` liefern.

Am Bild nachgewiesen (Kontaktbögen der Sitzung): 31 Gruppen bei 21 Figuren falsch benannt, u. a.
`brontar/walk2` = Feuerhieb, `fyrn/walk2+3` = Feueratem, `vorrak/walk2` = Hammerschlag,
`darkblade/angriff` = Sturz mit Blut, `nachtschatten/angriff` = Sturz und `angriff2` = Gang,
`steel-sentinel/walk2` = Zusammenbruch, `darrag-battlebender/angriff2` = Laufen. Viele
Primär-„walk" des Erst-Exports sind außerdem Idle-Animationen (Figur gleitet beim Gehen).

Korrektur: die Arten-Datei ist `animation_group_id → Art`, der Index kannte aber keine gid —
offline war keine Korrektur möglich. Die gid-Zuordnung wurde einmalig über die API hergestellt
(mittleres Bild je Streifen pixelgleich mit dem API-Frame; Bild 0 ist bei allen Arten die
Standpose und deshalb mehrdeutig). 31 Einträge in `figuren-sprites-animationsarten.json` korrigiert,
seit 07.11. steht die gid in jedem Index-Eintrag. **13 Figuren wurden dadurch ohne einen einzigen
PixelLab-Erzeugungsaufruf vollständig** (alarm, brontar, catherine, crucible-warden, darkblade,
darrag-battlebender, kati, omniclops, reefstrike, sir-percival, steel-sentinel, tavascron, vorrak),
8 weitere teilweise (etwas-m, fyrn, glockenfresser, hargorin-todbringer, nachtschatten, razorleaf,
suzuna, wheatley).

### 1b. Fehlender Inhalt (nie erzeugt)

- **91 Figuren haben auf PixelLab `animation_count: 0`** — nie animiert. 89 davon im 80px-Kanon,
  Status `completed`, alle mit 8 Rotationen. Ihre Erzeugungs-Prompts sind die generische Schablone
  „Name, a Class of race X, archetype Y. Full body pixel art character." (Ø 125 Zeichen; 5 ganz leer).
- **32 Figuren haben dort genau walk/angriff/tod à 17 Bilder und keinen Treffer** — der Treffer
  (Label „recoils backward sharply", 9 Bilder) wurde nie bestellt.
- Einzelne Richtungen fehlen bei ~10 Figuren (nur Ost oder nur Süd einer Gruppe).

### 1c. Was sonst noch auffiel

- **Nord existiert längst für 176 Figuren.** 648 der 1168 Gruppen wurden ursprünglich mit fünf
  Richtungen (E, N, NE, S, SE) erzeugt; 692 Nord-Richtungen liegen in **derselben** Gruppe wie
  Süd/Ost, nur 19 als eigene Gruppe („seen from behind and facing away…"). Der alte Export hat sie
  mit `ANIM_DIRS = [south, east]` weggefiltert. 102 Figuren haben Nord für alle vier Arten, 74
  teilweise, 184 (= 93 Batch + 91 leere) gar nicht.
- **Galactus:** ein einziger Charakter (168px), 5 Gruppen, lokal 8/8 vollständig. Chris' „~20" ist
  PixelLabs `animation_count` = Summe über Richtungen (3+2+5+5+5 = 20).
- **„8 Richtungen":** alle 360 Charaktere sind auf PixelLab 8-Richtungs-Charaktere
  (`directions: 8`); der Kanon exportiert 4 Rotationen und animiert Süd/Ost(/Nord).
- **voidrake:** der getaggte Charakter (64px, 0 Animationen) ist ein Splitter; ungetaggt existiert ein
  128px-Rochen mit vier Animationen, der das Portrait trifft. Tag gewinnt laut Kanon — das Skript
  meldet solche Fälle jetzt (`HINWEIS … ungetaggter Kandidat`), umgetaggt wird nur mit Freigabe.
- **Prompt-Qualität:** Erst-267 Ø 163 Zeichen, Batch-93 Ø 440 Zeichen mit Körperbau, Material,
  Farbe, Requisit, Haltung. Chris' Erinnerung („Beschreibungen zu knapp, 0815-Ergebnisse") ist
  damit belegt; neue Generierungen bekommen Prompts nach dem Batch-Muster.

## 2. Änderungen am Export-Skript (Commit „Figuren-Export: Angriffs-Woerter …")

1. `ATTACK`-Wortliste aus den 290 bestätigten Angriffs-Labels; Reihenfolge Treffer > Tod >
   Angriff > Gehen.
2. `display_name` wird vor dem Label gelesen.
3. `gid` in jedem Index-Eintrag.
4. Gruppen ohne exportierbare Richtung oder mit leeren `frames` werden gemeldet, nicht verschluckt.
5. Alle geschätzten Arten werden am Ende aufgelistet (zur Sichtprüfung).
6. Beim Re-Export einer Figur werden Streifen alter Namen entfernt.
7. Warnung, wenn ein ungetaggter Doppelgänger mehr Animationen hat als die getaggte Figur.

## 3. Reihenfolge der Reparatur (Chris, 06./07.11.)

1. 62 rostierte defekte Figuren: Re-Export (bringt Korrekturen + vorhandenes Nord), dann
   Neugenerierung dessen, was auf PixelLab fehlt (Süd/Ost wo leer, Nord überall).
2. 95 rostierte vollständige Figuren: nur Nord (Re-Export reicht für die, die es schon haben).
3. 203 nicht rostierte Figuren (92 defekt).

Jede Erzeugung in 5er-Batches mit echtem visuellem Check-in: Kontaktbogen ansehen, alle Arten und
Richtungen vorhanden, Optik passt zu Klasse/Rasse/Konzept, Prompt war reich genug.
