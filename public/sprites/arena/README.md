# Boden und Beiwerk der Arena — die gesuchten Assets

Diese Dateien sind der Ertrag der Asset-Suche vom 24.08.2026, der ersten mit offenem Netz.
Sie fuellen den Posten, der in der Uebergabe als „Hintergruende fuer die Disziplinen — noch
gar nicht angefangen, weil OpenGameArt nicht erreichbar war" stand.

| Datei | wofuer |
|---|---|
| `boden_sand.png` | Kampfgrund der Arena (TDM) |
| `boden_stein.png`, `boden_erde.png` | Rueckhand fuer andere Boeden, noch nicht verbaut |
| `mauer_ziegel.png` | der Ring um die Arena — jetzt eine Mauer statt eines Strichs |
| `rasen.png` | Rasen neben der Bahn (Spurt) |
| `bahn_ocker.png` | die Laufbahn selbst |
| `zaun_holz.png` | Zaun zwischen Rasen und Bahn |
| `baum_1..4.png` | die Baumreihe ueber der Bahn |
| `fackel.png` | die sechs Fackeln der Arena, 9 Bilder zu 32x64 |
| `vogel_adler.png` | vorgesehen fuer Seraph-11, **noch nicht verbaut** |

`quellen.json` nennt zu jeder Datei Paket, Blatt, Schnittstelle, Urheber und Lizenz.
`HERKUNFT/` traegt die Urheberketten der drei Pakete im Wortlaut der Originale — bei
CC-BY-SA ist das keine Hoeflichkeit, sondern die Bedingung.

## Warum Dateien und nicht base64

Die Sprite-Blaetter der Kaempfer liegen als base64 in `battle-mode.html`, weil sie zur
Laufzeit Pixel fuer Pixel umgefaerbt werden. Diese hier nicht: sie werden nur gekachelt und
gezeichnet. Als Datei bleiben sie dort nachweisbar, wo `quellen.json` sie belegt, und die
HTML waechst nicht um jeden Kachelsatz. Zusammen sind es 56 KB.

`battle-mode.html` laedt sie unter `/sprites/arena/…` und prueft **jede einzeln**: fehlt
eine, faellt genau dieser Teil auf die gezeichnete Fassung von vorher zurueck. Eine
fehlende Fackel nimmt nicht den Sandboden mit. Nachgemessen: die Datei ausserhalb von
`public/` ausgeliefert — alle Kacheln 404 — zeigt weiter die alte, gezeichnete Arena.

## Wie die Kacheln gefunden wurden

Nicht nach Augenmass. Fuer jede Flaechenkachel hat ein Suchlauf im Originalblatt jede
moegliche 32x32-Stelle geprueft: voll deckend (keine Loecher), texturiert (keine reine
Farbflaeche) und mit moeglichst unauffaelliger Kante beim Wiederholen — gemessen als
Sprung zwischen rechter und linker Kante im Verhaeltnis zum mittleren Sprung im Inneren.

**Die Zahl allein reicht aber nicht.** Zweimal hat sie eine Wasserkachel als „Sand"
ausgewaehlt, weil der Suchbereich in den Nachbarblock reichte; und ohne die Textur-Schranke
gewann jedes Mal die einfarbige Grundflaeche, weil eine Flaeche ohne Muster keine Kante hat.
Jede Wahl ist deshalb zusaetzlich als 3x3-Kachelung angesehen worden. Die Baum-Kaesten
stammen aus dem Alphakanal: Spalten und Zeilen mit Deckung, Gruppen dazwischen getrennt —
sonst haetten drei Baeume, die sich beruehren, als ein Kasten geendet.

Reproduzierbar mit:

```sh
node scripts/arena-assets-schneiden.mjs
```

Das Skript laedt die Originale selbst von OpenGameArt und schneidet an festen Koordinaten.
