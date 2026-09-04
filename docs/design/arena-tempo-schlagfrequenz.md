# Arena: Schlagfrequenz an Tempo gekoppelt — Chris' Umkehr der bisherigen Entscheidung

Auftrag: Chris, wörtlich am 04.09.: „mach die schlagfrequenz vom tempo abhängig." Das ist eine
bewusste Rücknahme seiner eigenen, am 25.08. getroffenen und in `baueEinheit()`
(`public/mockups/battle-mode.engine.js`, Arena-Chassis TDM/Mini-DM/Battlefield — kein
Produktionscode) wörtlich dokumentierten Entscheidung: „schau, dass Tempo nicht den Angriff
beschleunigt — du musst die Mechaniken wirklich von Eslabong übernehmen, sonst funktioniert es
nicht." Diese Runde macht nichts anderes als das umzudrehen, so wie er es heute angeordnet hat,
und **misst die Wirkung, statt sie vorherzusagen** (s. Abschnitt 5, Punkt 5 des Auftrags).

---

## 1) Die Formel — wiederhergestellt, nicht neu erfunden

`git log -S "cdKuerzung" -- public/mockups/battle-mode.engine.js` findet die Formel exakt: sie
stand schon einmal im Motor, in Commit `9290fbf4` („Battle Arena: das Prozentmodell aus dem
Vorbild, und der Fighter für Baumkopf", 23.08.), zwei Tage bevor sie am 25.08. auf `0` gesetzt
wurde. Der begleitende Kommentar an dieser Stelle (Zeile ~12460, seit der Abschaltung nie
gelöscht — er beschrieb die Zielkurve weiter, während der Code sie nicht mehr umsetzte) nennt
exakt dieselben zwei Stützpunkte, die der Auftrag zitiert:

```js
const cdKuerzung=(u)=>0.30*u.TMP/(u.TMP+120);
const abkling=(u,sk_cd,fat)=>sk_cd*(1-cdKuerzung(u))/Math.max(.5,fat);
```

Feldname bestätigt: `u.TMP` wird an derselben Stelle (`abkling`, `abklingSchwer`, die Marschtempo-
Anzeige) und in `renderProfile()` konsistent als das Tempo-Attribut der Einheit gelesen.

Nachgerechnet, Kurve gedeckelt und mit abnehmendem Ertrag, wie der Kommentar es beschreibt:

| TMP | Kürzung |
|---:|---:|
| 0 | 0,0 % |
| 20 | 4,3 % |
| **30** | **6,0 %** |
| 50 | 8,8 % |
| **80** | **12,0 %** |
| **99** | **13,6 %** |

Trifft die zitierten Datenpunkte (TMP 30 → 6 %, TMP 99 → knapp 14 %) exakt und bleibt unter der
zitierten Vorbild-Obergrenze (0 bis 16 %). Es ist also nicht rekonstruiert, sondern die
historisch tatsächlich verwendete Formel — unverändert wieder eingesetzt.

## 2) Was geändert wurde

- `cdKuerzung`/`abkling` in `baueEinheit()` (Zeile ~12483–12508): `(u)=>0` → obige Formel,
  `abkling` multipliziert wieder mit `(1-cdKuerzung(u))`.
- Kommentarblock an derselben Stelle ersetzt: die alte Begründung („TEMPO BESCHLEUNIGT DEN
  ANGRIFF NICHT MEHR", mit Chris' altem Zitat) steht nicht mehr unkommentiert da, sondern ist
  ausdrücklich als „galt bis heute, jetzt bewusst umgekehrt" markiert, mit Datum, neuem Zitat
  und einem Verweis auf diesen Bericht für die gemessene Wirkung — die Matrix-Warnung aus der
  alten Begründung (TDM bepreist Tempo mit Gewicht 0) bleibt inhaltlich stehen, weil sie
  weiterhin wahr ist, nur nicht mehr als Grund gegen die Änderung.
- `renderProfile()` (Zeile ~12058–12069): die Anzeige „beschleunigt den Angriff nicht" war nach
  der Umkehr schlicht falsch — genau die Art Lüge, die derselbe Kommentarblock zwei Zeilen
  darüber („wer eine Zahl anzeigt, die der Kampf nicht führt, lügt präzise") an sich selbst
  kritisiert. Ersetzt durch die tatsächliche, aus derselben Formel abgeleitete Kürzung in
  Prozent.
- `grundtaktVon()` (Zeile ~12898): Kommentar korrigiert, der auf das inzwischen falsche
  „ohne Tempo (siehe cdKuerzung)" verwies — diese Funktion ist eine feste Vergleichsbasis für
  eine MESS-Kennzahl, unabhängig von `cdKuerzung`, und blieb unverändert; nur die Erklärung war
  irreführend geworden.
- `node --check public/mockups/battle-mode.engine.js`: **OK.**

## 3) Messung — alle drei Arena-Disziplinen, vorher/nachher

Gemessen mit `node scripts/miss-alle-disziplinen.mjs 24 tdm mini-dm battlefield` (kaderfeste
Median-Messung über 5 echte Team-Paarungen aus dem live-save-Abbild, s. CLAUDE.md /
`messgrundlage-kaderfest.md`) — **vorher** bei `cdKuerzung=(u)=>0` (Stand `origin/main`,
identisch zu `docs/design/stand-aller-disziplinen.md`, dort bit-genau reproduziert), **nachher**
mit der oben wiederhergestellten Formel:

| Disziplin | rho Spiel vorher | rho Spiel nachher | Δ | Spannweite (vorher / nachher) | rho Saison vorher | rho Saison nachher | Δ |
|---|---:|---:|---:|---|---:|---:|---:|
| TDM | 0,113 | 0,253 | **+0,140** | 0,387 / 0,328 | 0,070 | 0,217 | **+0,147** |
| Mini-DM | 0,269 | 0,094 | **−0,175** | 0,802 / 0,697 | 0,500 | 0,071 | **−0,429** |
| Battlefield | 0,325 | 0,387 | +0,062 | 0,662 / 0,938 | 0,619 | 0,595 | −0,024 |

Alle drei bleiben weit unter der 0,80-Schranke — „durchgefallen" vorher und nachher, an dieser
Runde ändert sich der Abnahmestatus nicht.

**Bestätigung bei n=48** (`node scripts/miss-alle-disziplinen.mjs 48 tdm mini-dm battlefield`,
nachher-Formel — dieselbe Kader-Familie, doppelte Spiellänge je Variante):

| Disziplin | rho Spiel (n=24) | rho Spiel (n=48) | rho Saison (n=24) | rho Saison (n=48) |
|---|---:|---:|---:|---:|
| TDM | 0,253 | 0,201 | 0,217 | 0,196 |
| Mini-DM | 0,094 | 0,089 | 0,071 | **−0,024** |
| Battlefield | 0,387 | 0,326 | 0,595 | 0,548 |

Dieselbe Richtung, dieselbe Größenordnung bei allen drei — n=48 bestätigt n=24, keine der drei
Bewegungen ist ein Ausreißer eines einzelnen Laufs. Mini-DMs Saisonzahl fällt bei mehr Spielen
sogar noch weiter (bis leicht negativ) — kein Messrauschen, das sich mit mehr Ereignissen
auflöst, sondern (s. CLAUDE.md: „mehr Ereignisse helfen fast nie, wer die Rangtreue heben will,
arbeitet an der Validität, nicht an der Uhr") ein Validitätsproblem, das durch längere Spiele
nicht kleiner wird.

### Isolationsnachweis — die übrigen 17 Disziplinen

`baueEinheit()` ist laut Code reiner Arena-Scope; messtechnisch bestätigt mit
`node scripts/miss-alle-disziplinen.mjs 6 --einzelkader` (alle 20 Disziplinen, schneller
Einzelkader-Lauf, einmal vor und einmal nach der Änderung, Rohausgaben `diff`t):

```
15a16
> mini-dm             arena           8   0.770  ...
20a22
> battlefield         arena           8   0.643  ...
22,24c24
< mini-dm             arena           8   0.556  ...
< tdm                 arena          12   0.433  ...
< battlefield         arena           8   0.361  ...
---
> tdm                 arena          12   0.274  ...
```

Der `diff` zeigt ausschließlich die drei Arena-Zeilen (deren neue Werte die Sortierung nach rho
verschieben, deshalb tauchen sie an anderer Position wieder auf) — **alle 17 übrigen
Disziplinen (Feldspiel/Bühne/Bahn) sind bit-identisch**, Zeile für Zeile, Ziffer für Ziffer.
(Die Einzelkader-Zahlen selbst sind nicht die Abnahmezahl — sie schwanken laut
`messgrundlage-kaderfest.md` stark mit der Kaderziehung, dienen hier nur dem
Identitätsvergleich, nicht der Bewertung der Arena.)

## 4) Einordnung — gehoben, gesenkt oder flach, und warum

Der Auftrag benennt den offenen Kanal explizit: die TDM-Matrix bepreist Tempo mit Gewicht
**NULL** (s. Kommentar in `ARENA_ART.tdm` und Fables Modellierung,
`docs/design/naechste-schritte-fable-04-09.md` Abschnitt 2.4: „genau der Kanal, den Fables
Arena-Recherche als schwächsten gemessen hat, 0,05 im TDM"). Die Änderung könnte also entweder
mehr Ereignisse an ein Attribut hängen, das schon zählt (rho steigt), oder Ereignisse an ein
Attribut hängen, das die Matrix nicht bepreist, und damit die Mechanik weiter von der Matrix
wegdriften lassen (rho sinkt). Gemessen, nicht angenommen:

- **TDM steigt spürbar** (+0,140 Spiel / +0,147 Saison) — größer als die eigene Spannweite bei
  der Saisonzahl (0,147 > nichts Vergleichbares, da vorher fast bei 0) und in derselben
  Größenordnung wie die Spielweite (0,140 gegen 0,328/0,387). Das ist der Kanal, den Fable als
  0,05-Lücke benannt hat — hier bewegt er sich tatsächlich in die erhoffte Richtung: TDMs
  Rezept liest zwar Tempo mit Gewicht 0, aber TMP korreliert in der TDM-Matrix real mit anderen
  Attributen (Dexterity, Torment — s. `ARENA_ART`-Kommentare), die *hoch* gewichtet sind, und
  über diese Korrelation zieht die höhere Schlagfrequenz jetzt ein Stück des richtigen Signals
  mit hoch, statt reines Rauschen zu addieren.
- **Battlefield bewegt sich kaum** (+0,062 Spiel, innerhalb der eigenen Spannweite von 0,662
  bzw. 0,938 — von Null nicht unterscheidbar) und die Saisonzahl sinkt minimal (−0,024, ebenso
  im Rauschen). Battlefields Matrix (Charisma/Intelligence/Spirit vorn, Power nur Mittelfeld)
  hat wenig mit Tempo zu tun — dort tut die neue Schlagfrequenz im Rahmen der Messung fast
  nichts, weder Gutes noch Schlechtes.
- **Mini-DM verschlechtert sich deutlich** (−0,175 Spiel, −0,429 Saison — beides größer als die
  jeweilige Spannweite, also ein reales Signal, keine Kaderziehung). Mini-DMs Matrix ist
  explizit **ohne Speed/Dexterity als Hauptträger** aufgebaut (Kommentar in `ARENA_ART["mini-
  dm"]`: „Vor allem fehlt SPEED... das Tempo speist sich hier aus Dexterity, Ausdauer und
  Torment, also aus dem, was die Matrix wirklich führt" — eine Lehre, die extra aus TDMs Fehler
  gezogen wurde). Genau deshalb schlägt die neue Mechanik hier am stärksten in die falsche
  Richtung: mehr Gelegenheiten für hohes `TMP` sind in Mini-DM praktisch reines Rauschen
  gegenüber der Matrix, und die Saisonzahl fällt von 0,500 auf 0,071 — nahe null Validität.

**Fazit: gemischt, nicht einheitlich gehoben oder gesenkt.** Die Änderung wirkt nicht als
einzelner Hebel auf „die Arena", sondern koppelt an, wie gut das jeweilige Rezept Tempo mit
seinen anderen, tatsächlich gewichteten Attributen korrelieren lässt — bei TDM zufällig
günstig, bei Mini-DM ungünstig, bei Battlefield praktisch neutral. Keine der drei Disziplinen
kommt der 0,80-Schranke dadurch näher; die Rangfolge zwischen den dreien ändert sich aber
(Mini-DM fällt von der bis dahin zweitbesten auf die schlechteste der drei Arena-Zahlen).

Das ist keine Empfehlung, die Änderung zurückzunehmen — Chris hat sie ausdrücklich angeordnet,
das ist keine offene Frage. Es ist der ehrliche Befund, den der Auftrag verlangt: **wenn die
Arena als Nächstes angefasst wird, ist die TDM-Matrix nicht mehr das einzig offene Ziel** —
Mini-DMs Rezept hat durch diese Runde neu Boden verloren, den ein künftiger Rezept-Umbau
mitdenken sollte, statt nur an TDM weiterzuarbeiten.

## 5) Zusammenfassung der Dateien

- `public/mockups/battle-mode.engine.js` — einzige geänderte Datei, drei Stellen, alle innerhalb
  des Arena-Scopes (`baueEinheit()`, `renderProfile()`), keine Produktionsdatei.
- `docs/design/arena-tempo-schlagfrequenz.md` — dieser Bericht.
