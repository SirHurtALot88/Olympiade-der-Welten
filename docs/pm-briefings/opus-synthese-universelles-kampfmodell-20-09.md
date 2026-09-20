# Opus-Synthese: Ein Kampfmodell für alle zwanzig? — Entscheidungsvorlage (20.09.)

**Auftrag von Chris (20.09.), in drei Teilen:** „Bekommen wir ein System entworfen — entweder
echtzeit-auto-battle ODER rundenbasiert — das wir für ALLE Disziplinen nutzen können? Oder müssen
wir splitten? Funktioniert rundenbasiert auch bei Football/Basketball? Oder sollten wir es als
Karten-Auto-Battler wie in manch anderen Kartenspielen aufziehen?"

**Und die Gegenrede, nachdem er das erste Rundenkampf-Mockup gesehen hat** — die wichtigste
Eingabe dieser Runde, wörtlich:

> „das ist kein Spiel sondern nur Stats die sich ändern, das erzeugt keine Spannung nix."

> „können wir bei mini dm tdm und co nicht trotzdem auch in echtzeit mit den sprites kämpfen? und
> tempo etc sollten auch für agilität oder crits oder so eine rolle spielen weil assassinen können
> ja auch stark kämpfen und sind laut eignung teils nicht schlecht im mini dm durch ihr torment das
> in kombination mit dex oder speed kann auch zu hohem dmg führen genauso mit awareness damit
> findet man ja schwachstellen. Da musst du dann quasi um die ecke denken wie du offensive
> defensive etc berechnest."

> „es soll funktionieren und den zuschauer catchen — damit man investiert ist in sein eigenes team
> und später ggf. auch items zauber etc nutzen könnte oder so."

Phase 1 dieser Runde ist Fables Recherche (`docs/design/universelles-kampfmodell-recherche-20-09.md`,
Branch `universelles-kampfmodell-recherche-20-09`, PR #971). Dies ist Phase 2: die Empfehlung. Sie
ändert **keine Zeile Code**.

**Stand beim Schreiben:** `main` = `73e43a8b` (19.09., nach PR #970 — A0.1 und A0.2 sind gemergt).
Zeilenangaben ohne Dateinamen meinen `public/mockups/battle-mode.engine.js` in genau diesem Stand.

---

## 0. Die Antwort

> **Chris hat mit seiner Kritik recht und mit seinem Reparaturvorschlag nicht — und beides ist
> messbar belegt, nicht Geschmack.** Die Kritik („nur Stats, keine Spannung") trifft ins Schwarze
> und ist der wichtigste Befund dieser Runde. Der Vorschlag, TMP/AUS statt struktureller Runden
> über eine neue Krit-/Ausweich-/Burst-Formel umzuleiten, ist in seinen beiden Hälften **bereits
> gebaut, gemessen und wieder ausgebaut worden** — die Zahlen stehen im Repo, ich habe sie
> nachgelesen (Abschnitt 3). Was bleibt: **Echtzeit-Sprites ja als Bild, Runden ja als Takt,
> Krit/Ausweichen/Burst ja — aber auf der SKILL-Ebene, nicht als Attributformel.** Die Engine
> schreibt diesen Satz seit August selbst: „Wollen wir Krits, gehören sie an den SKILL […], nicht
> an einen ausgedachten Spielerwert" (`:4678-4680`).

Und, weil es für die Reihenfolge entscheidend ist:

> **Ich nehme einen Teil meiner eigenen Synthese vom 19.09. zurück.** Dort stand, ein Rundenmodell
> schließe den TMP/AUS-Kanal und deshalb sei ein Sprung wie bei Fechten (0,153 → 0,840) zu
> erwarten. Inzwischen habe ich `docs/design/arena-tempo-schlagfrequenz.md` gelesen, das ich am
> 19.09. nicht ausgewertet hatte. Dort ist **genau dieser Hebel in beide Richtungen gemessen**:
> mit geschlossenem Tempo-Kanal steht die Arena bei 0,113 / 0,269 / 0,325 — **nicht bei 0,80.**
> Der Kanal ist real, aber er ist nicht die ganze Ursache. Wer ihn schließt, landet bei einem
> Drittel der Strecke. Das ändert nicht die Richtung der Empfehlung, aber es ändert die
> Reihenfolge: **vor dem Motorbau steht jetzt eine billige Messung, nicht der Motorbau.**

Die Begründung in sechs Sätzen:

1. **Es gibt kein Zeitmodell für alle zwanzig, und das ist kein Kompromiss, sondern der Befund.**
   Fables Trennung (Ereignismotor / Flussmotor) hält der Code-Prüfung stand, und der größte
   Rangtreue-Sprung des Projekts kam historisch aus einem Chassis-SPLIT, nicht aus Vereinheitlichung.
2. **Universell ist die Präsentationsgrammatik, nicht der Takt** — Karte für Identität und Zustand,
   Sprite für die Aktion. Das ist Fables Kernvorschlag, und ich unterschreibe ihn ohne Abstriche.
3. **Football ist bereits rundenbasiert** — am Code nachgeprüft, Fables Zeilenangaben stimmen auf
   die Zeile. Basketball und Hockey nicht, und sie sollen es nicht werden.
4. **Chris' Formel-Fix verschiebt die Wurzelursache, statt sie zu lösen** — und zwar nachweisbar:
   „Awareness → Krit" wäre in Mini-DM ein Attribut mit **Matrixgewicht null**, das erster Ordnung
   Einfluss kauft. Das ist Zeile für Zeile derselbe Fehler, der TDM kaputtgemacht hat (Speed 46 bei
   Matrixgewicht 0). Abschnitt 3.3.
5. **Aber die Hälfte, um die es Chris wirklich geht, ist richtig und bekommt ein Zuhause:** Krit,
   Ausweichen und Burst als **Skills** (Roguelike-Pool, `roguelike-skill-pool-konzept-17-09.md`) —
   dort sind sie bepreisbar, sichtbar, messbar und stören `aufEignung()` nicht.
6. **Das nächste, was gebaut wird, ist kein Motor, sondern ein Drehbuch-Mockup** mit echten
   Portraits, echten Sprites und einem echten Wendepunkt. Es kostet einen Nachmittag, hat null
   Rangtreue-Risiko und beantwortet die einzige Frage, an der die letzten zwei Anläufe gescheitert
   sind: sieht das nach einem Spiel aus.

### 0.1 Was konkret passiert, in dieser Reihenfolge

| | Auftrag | Zeitmodell? | Aufwand | Risiko | Wer profitiert |
|---|---|---|---|---:|---|
| **B0** | **Drehbuch-Mockup**: Karten + Sprites + Duell-Bühne + **ein Wendepunkt**, statisch, ohne Motor | nein | klein, 1 Nachmittag | **null** | **Chris' Abnahme der Optik** |
| **A1.0** | **Expositions-Sonde**: wie viel rho frisst die geometrische Zielwahl? Nur Messung, nichts gemergt | nein | klein, 1 Messrunde | sehr gering | die Entscheidung über A1.1 |
| **A1.1** | Mini-DM-Rundenmotor **neben** dem bestehenden — aber erst, wenn A1.0 sagt, dass es sich lohnt | ja, Pilot | mittel, 1 Runde | gering | Rangtreue + Zuschauer |
| **A3** | **Die gebuchte Saat durch den Host reichen** — hochgezogen, s. Abschnitt 4.3 | nein | klein, 1 PR | gering | **emotionale Bindung** |
| **F1** | **Football-Down-Karte** (Callout je Down aus `fsLive.snap`), unabhängig, rho-neutral | nein | klein, 1 PR | sehr gering | Zuschauer, sofort sichtbar |
| **K1** | Kachel → **Karte** in `renderKader()` für alle zwanzig | nein | mittel, 1–2 PRs | gering | das „ein System"-Gefühl |
| **A2** | *Nur bei bestandener Messung:* TDM + Battlefield nachziehen | ja | mittel–groß | mittel | Rangtreue |
| **S1** | Skill-/Item-Ebene (Krit, Ausweichen, Burst) — **Chris' Idee, richtig verortet** | nein | groß, eigener Strang | mittel | Spannung + Zukunft |

**Nicht tun:** Basketball-/Hockey-Rundenprototyp. Bahn als Kartenmechanik. Reiner
Sammelkarten-Look für die Arena. Krit/Ausweichen als Attributformel in `aufEignung()`. Irgendeine
Taktänderung an den 13 bestandenen Disziplinen.

---

## 1. Was ich nachgeprüft habe — und wo ich widerspreche

Fables Recherche ist gründlich und in den tragenden Punkten korrekt. Ich habe die Stellen selbst
gelesen, nicht übernommen.

### 1.1 Spot-Checks: bestätigt

| Behauptung (Fable) | nachgeprüft an | Ergebnis |
|---|---|---|
| `starteSnap()` / `stepSnapPhase()` `:8758-8820` — Football ist Down-Kette | `:8758` und `:8798`, komplett gelesen | **bestätigt, auf die Zeile** |
| Snap: Formation 0,9 s → Ergebnis **vorab gelöst** → Clip → 0,6 s nach | `:8797` `FK_SNAP_FORMATION=0.9, FK_SNAP_NACH=0.6`; `:8803` `s.ergebnis=loeseFootballZug(...)` **am Ende der Formationsphase**, `:8809` `animiereFootballZug(s,phase)` spielt nur ab | **bestätigt** — das ist wortwörtlich das Bühnen-Muster mit Raumkoordinaten |
| „nicht hinlaufen lassen", Figuren werden direkt gesetzt | `:8788-8792` `u.x=p.x; u.y=p.y; u.vx=0; u.vy=0` | **bestätigt** |
| `renderKader()` `:28506` ist „schon eine halbe Karte" | `:28506` ff., `leiste:{wert,max,wort,zusatz}` je Chassis, Chris' Zitat „die health bars sind ja hier quatsch" steht im Kommentar | **bestätigt** |
| `renderEinlauf()` `:27619` | vorhanden | **bestätigt** |
| `zeichneHeben()` als Referenzmuster für den Karten-Hybrid | `:17112` ff.: großes Duell mittig, „**Duell N von M**"-Zeile, Duellstand groß auf der Bühne, Rest klein | **bestätigt — und es ist ein besseres Muster, als Fable sagt**: es hat bereits Rundenzähler, Subjekt und Zwischenstand-Beat in einem Bild |
| Arena praktisch zufallsfrei | Bereich `:19432-21079` durchgezählt: **2** lebende `rr()`-Aufrufe (`:20158`, `:20421` — beide Fernkampf-Streuung), 1 weiterer Treffer ist ein Kommentar | **bestätigt, exakt** |
| Bestand: ~2 980 Portraits, ~480 Sprite-Dateien | `ls public/portraits/*.jpg` → **2 983**; `ls public/sprites/baukasten/` → **478** | **bestätigt** |
| Basketball/Hockey: Gelegenheit ist Possession, nach Eignung verteilt | `:7349` ff. Ballführer quadratisch nach AUFBAU, Slot nach SCHUSS_NAH | **bestätigt** |

### 1.2 Wo Fable ungenau ist

**(a) Die Zeilenangabe `:5183-5203` für den `aufEignung()`-Kommentar ist falsch.** In `73e43a8b`
steht dort `traitVerteilung()`; der TMP/AUS-Kommentar steht bei **`:5344-5363`**. Fable hat die
Nummern aus der 19.09.-Synthese übernommen, ohne sie gegen den gewachsenen Stand nachzuziehen. Das
ist inhaltlich folgenlos — der Kommentar existiert und sagt wörtlich, was zitiert wird — aber es ist
genau die Sorte Fehler, wegen der man gegenprüft. **Alle anderen** Zeilenangaben Fables (8758, 8798,
28506, 27619, 6363, 7349–7352) stimmen.

**(b) „Das Feldspiel hat ein Verlässlichkeits-, kein Validitätsproblem" stimmt für zwei von drei.**
Für Basketball (0,769 / 0,923) und Hockey-Feldspieler (0,719 / 0,818) ist das richtig. Für
**Football** rechne ich nach: aus rho(Spiel) = rho(Saison) × √Verlässlichkeit folgt
√V = 0,516/0,811 = 0,636, also **Verlässlichkeit 0,405**. Das ist nicht „ein bisschen zu laut", das
ist die mit Abstand niedrigste Verlässlichkeit der zwanzig. **Und Football ist ausgerechnet die
Disziplin, die schon rundenbasiert ist.** Daraus folgt zweierlei, und beides ist neu:

- **Rundenbasiert ist für sich genommen keine Rangtreue-Medizin.** Die sauberste
  Rundenmechanik des Projekts steht bei 0,516 je Spiel. Wer aus Fechten ableitet „Runden heben
  rho", muss Football daneben stellen.
- **Footballs Hebel ist die Ereigniszahl je Spieler, nicht der Takt.** Bei zwölf Spielern und
  einer Down-Kette, in der je Snap im Wesentlichen ein Ballführer und ein Verteidiger zugeordnet
  werden, bekommt der einzelne Spieler sehr wenige zurechenbare Ereignisse. Das ist eine konkrete,
  billige Spur für eine spätere Football-Runde — und sie hat mit dieser Entscheidung nichts zu tun.

**(c) Kleiner Zahlendreher im Umlauf:** CLAUDE.md führt Basketball mit 0,786 / 0,881, die Tabelle
in `stand-aller-disziplinen.md:226` mit **0,769 / 0,923**. Die Tabelle ist die neuere Messung; Fable
zitiert sie richtig. CLAUDE.md sollte bei Gelegenheit nachgezogen werden (kein Auftrag dieser Runde).

### 1.3 Wo ich mir selbst widerspreche — der wichtigste Abschnitt dieses Dokuments

Die 19.09.-Synthese (Abschnitt 3.4) behauptete, die Rangfolge der drei schlechtesten Zahlen folge
„exakt dem Grad, in dem der unbepreiste TMP/AUS-Kanal offen steht". **Das hält der Code-Prüfung
nicht stand.**

Mini-DMs Rezept (`:5461-5465`) lautet:

```js
TMP:{dexterity:40,stamina:32,torment:28},
AUS:{stamina:48,will:32,health:20}
```

Die Mini-DM-Matrix ist `torment 24, health 20, power 16, stamina 16, will 14, dexterity 10`
(`:5449`). **Jedes einzelne Attribut, das dort TMP und AUS speist, ist ein Matrix-Attribut.** Kein
Nuller, nirgends. Der Kommentar darüber sagt ausdrücklich, dass das Absicht war: „Vor allem fehlt
SPEED. Im TDM speist Speed mit 46 die Bewegung, obwohl die TDM-Matrix ihn mit null bepreist […]
Bei einer neuen Disziplin diesen Fehler zu wiederholen wäre mutwillig."

**Mini-DM ist also die am sorgfältigsten umgeleitete der drei Arena-Disziplinen — und sie misst mit
0,094 / 0,071 die schlechtesten Zahlen des ganzen Projekts.** Meine 19.09.-Erklärung ist damit
widerlegt, und zwar von der Disziplin, die sie am stärksten stützen sollte.

Und es kommt schärfer. `docs/design/arena-tempo-schlagfrequenz.md` misst **genau den Hebel**, um
den hier gestritten wird — die Kopplung der Schlagfrequenz ans Tempo, ein- und ausgeschaltet,
kaderfest, bei n=24 und bestätigt bei n=48:

| Disziplin | rho Spiel **ohne** Tempo-Kopplung | **mit** Kopplung (= heute) | Δ | rho Saison ohne | mit |
|---|---:|---:|---:|---:|---:|
| TDM | 0,113 | **0,253** | +0,140 | 0,070 | 0,217 |
| Mini-DM | **0,269** | 0,094 | −0,175 | **0,500** | 0,071 |
| Battlefield | 0,325 | **0,387** | +0,062 | **0,619** | 0,595 |

Drei Dinge folgen daraus, und alle drei sind für Chris' Frage entscheidend:

1. **Der „Formel-Fix" in seiner reinsten Form ist bereits gemessen.** `cdKuerzung=(u)=>0` ist
   exakt „Tempo skaliert die Ereignisrate nicht mehr" — ein Einzeiler, der historisch im Motor
   stand. Das Ergebnis: **0,113 / 0,269 / 0,325.** Die beste je gemessene Arena-Zahl mit
   geschlossenem Kanal ist 0,325. **Die Schranke ist 0,80.**
2. **Der Kanal ist real, aber nicht dominant.** Er bewegt rho um ±0,06 bis ±0,18, in beide
   Richtungen, abhängig davon, ob das Rezept Tempo mit den schweren Attributen korrelieren lässt.
   Er erklärt nicht die Lücke von 0,33 auf 0,80.
3. **Die heutige Kopplung ist Chris' eigene Anordnung vom 04.09.**, wörtlich: „mach die
   schlagfrequenz vom tempo abhängig" — eine bewusste Rücknahme seiner Anweisung vom 25.08. Sein
   jetziger Vorschlag („Tempo soll nicht Ereignisse, sondern Agilität/Crits geben") ist in der
   Sachfrage die dritte Kehrtwende an derselben Stelle. Das ist sein gutes Recht; er soll es nur
   wissen, und er soll wissen, dass die Zwischenstände gemessen sind.

Auch der zweite Satz meiner 19.09.-Synthese ist falsch: ich schrieb, im Rundenmodell differenziere
„das Überleben (mehr Runden am Leben = mehr Aktionen, **ebenfalls eignungsgetrieben**)". Der Code
misst das Gegenteil, im Kommentar bei `beitragVon` (`:21051-21057`):

> „die Zielwahl ist Geometrie, nicht Bedrohung: **264 von 288** Kämpfer-Spielen zielen auf den
> NÄCHSTEN. Wer beschossen wird, hängt damit an seiner Reihe, nicht an seiner Eignung — die
> Korrelation zwischen Eignung und ‚Angreifer je Lebenssekunde' liegt bei **−0,02**."

**Das ist ein ZWEITER unbepreister Gelegenheitskanal, und niemand hat ihn bisher benannt:
die Aussetzung.** Wer überlebt, überlebt zu einem großen Teil deshalb, weil er zufällig in der
Reihe steht, in der niemand vorbeikommt. Ein Formel-Fix an TMP/AUS lässt diesen Kanal vollständig
offen. **Und ein naives Rundenmodell auch** — „jeder handelt einmal je Runde" gleicht die Aktionen
an, nicht die Zielverteilung. Genau deshalb steht in meinem Plan jetzt eine Messung vor dem
Motorbau (A1.0).

---

## 2. Chris' drei Fragen, einzeln und ohne Ausweichen

### 2.1 „Ein System für alle zwanzig, oder splitten?"

**Split beim Takt. Ein System bei der Darstellung. Und die Grenze verläuft an einem Test, den man
je Disziplin in einem Satz beantworten kann.**

Fable formuliert die Grenze als „abzählbare Versuche/Züge" gegen „Raum und Gleichzeitigkeit als
Inhalt". Das stimmt, ist aber als Prüfstein zu weich — von einem Basketballspiel kann man auch
Possessions abzählen. Ich schärfe ihn:

> **Ist die Gelegenheit abzählbar UND gleich verteilbar, ohne dass dabei Inhalt verloren geht?**
> Ja → Ereignismotor. Nein → Flussmotor.

| Chassis | Gelegenheit abzählbar? | Gleich verteilbar, ohne Inhaltsverlust? | Motor |
|---|---|---|---|
| Bühne (9) | ja — `rundenN` Durchgänge je Teilnehmer | **ja, und sie ist es schon** | Ereignismotor (ist es) |
| **Arena (3)** | ja — Schläge | **ja** — nichts geht verloren, wenn zwölf Kämpfer gleich viele Schläge bekommen | Ereignismotor (**soll es werden**) |
| Feldspiel: Football | ja — Downs | ja, und sie ist es (4 Downs je Serie, beide Seiten) | Ereignismotor (**ist es**) |
| Feldspiel: Basketball/Hockey | Possessions ja / Shifts kaum | **nein** — wer den Ball bekommt, IST das Spiel; Gleichverteilung zerstört die Disziplin | Flussmotor |
| Bahn (5) | nein — ein Rennen hat keine Züge | nein — Windschatten und Überholen sind gerade die ungleiche Gelegenheit | Flussmotor |

Damit ist die Grenze nicht gesetzt, sondern **abgeleitet**, und sie fällt genau mit der Chassis-
Grenze zusammen, die es seit Monaten gibt. Das ist kein Zufall: die vier Chassis sind entstanden,
weil die Disziplinen sich so verhalten.

**Was universell ist und bleibt** (Fable Abschnitt 3.3, von mir bestätigt): die
`MOTOREN`-Schnittstelle `bau(saat)/lauf()/wert()` über alle vier Chassis, die eine Sonde
(`miss-alle-disziplinen.mjs`), die eine Schranke (rho je Spiel > 0,80), und die
Präsentationsgrammatik. Chris' Bild dafür: **eine Olympia-Übertragung hat ein Grafikpaket für
dreißig Sportarten.** Niemand würde den 100-m-Lauf in Gefechte zerlegen, damit er „dasselbe System"
ist wie das Fechten.

### 2.2 „Funktioniert rundenbasiert auch bei Football/Basketball/Hockey?"

**Football: die Frage ist schon beantwortet — ja, und zwar seit Anfang September, im Code.**
`starteSnap()` wählt Spielzug und Formation, setzt zwölf Spieler direkt an die Line of Scrimmage,
hält 0,9 s still, **löst das Ergebnis dann komplett auf** (`loeseFootballZug`) und spielt es als
Clip mit fester Dauer ab (`FK_ZUG_DAUER`), danach 0,6 s Pause, nächster Snap. Runde → Auflösung →
Clip. Das ist das Bühnen-Muster mit Koordinaten. **Es ist nichts umzubauen — es ist nur nicht zu
sehen.** Die Arbeit heißt: Down-Karte („2nd & 7 · Screen Pass · +9 Yards"), Play-Clock im Bild,
Down-Beat. rho-neutral, bit-identisch nachmessbar, ein kleiner PR. Das ist **F1** in meinem Plan.

**Basketball: nein.** Drei Gründe, jeder für sich ausreichend:
- Der Grund, der in der Arena für Runden spricht, existiert hier nicht: Gelegenheit ist Possession,
  und der Motor verteilt sie nach Rolle und Eignung (`:7349` ff.).
- Die Zwei-Spalten-Regel sagt „laut, nicht falsch": 0,769 je Spiel bei **0,923** Saison. Runden
  sortieren Ereignisse, sie erzeugen keine — an einem Verlässlichkeitsdefizit ändern sie nichts.
- Basketball ist die **einzige** Disziplin mit eigenem Boxscore-Impact im echten Spielstand und
  die erste mit ausgelagertem Rezept. Ein Rundenprototyp holt den Vorab-Pfad zurück, der
  schlechter gemessen ist, und entwertet die K3-Kalibrierung.

**Hockey: nein, und noch deutlicher.** Hockey hat gar keine natürliche Rundeneinheit — Bully und
Strafen sind Standphasen, dazwischen fließt es. Und die Zahl, die Chris abgenommen hat
(„rangtreuer als echtes Eishockey"), hängt an genau diesem Fluss.

**Die ehrliche Gegenrechnung, die Fable nicht zieht:** Football steht als beste Rundenmechanik des
Projekts bei 0,516 und damit **unter** Basketball (0,769) und Hockey (0,719), die beide Fluss sind.
Wer aus Fechten „Runden heben rho" ableiten will, muss erklären, warum das bei Football nicht
passiert ist. Meine Erklärung: Fechten hat nicht durch „diskret" gewonnen, sondern durch
**gleich verteilte Gelegenheit bei gleichzeitigem Wechsel der Wertformel** — und Football hat das
erste, aber nicht das zweite (`wert()` bleibt dort ein seltenes, hart verteiltes Ereignis). Das ist
Fables 19.09.-Vorbehalt, dem ich damals widersprochen habe. **Er hatte mehr recht als ich.**

### 2.3 „Oder als Karten-Auto-Battler wie in manch anderen Kartenspielen?"

**Ja — als Rahmen, in genau einer Form, und mit einer klaren Grenze.**

| | Antwort |
|---|---|
| **Form** | **Hybrid (Fables Option c):** Portrait-Karte trägt **Identität, Werte, Zustand, Intent**; der Sprite trägt **die Aktion** auf einer Duell-Bühne nach dem Muster von `zeichneHeben()`. Kein reiner Sammelkarten-Look. |
| **Mechanisch** | **Hearthstone-Battlegrounds-Muster** — eine Aktion je Einheit je Runde, sequenziell, ein Subjekt im Bild. Nur für die **Arena** (3 Disziplinen). |
| **Als Kachel-Aufwertung** | **Für alle zwanzig** — `renderKader()` von Sprite-Mini auf Portrait-Karte mit Rolle und Zustand. Das ist das Element, an dem Chris „ein System" wiedererkennt. Kein Takt wird berührt. |
| **Nicht** | Bahn und Feldspiel als Kartenmechanik. Karten statt Sprites. Ein zweites Bildsystem. |

Der Grund, warum der reine Kartenlook ausscheidet, ist nicht Geschmack, sondern Bestand: **17
Disziplinen zeigen denselben Spieler als Sprite** auf Bahn, Feld und Bühne, plus die gerade erst
freigeschaltete Requisiten-/Waffenebene (A0.1, PR #969). Eine Arena aus reinen Karten wäre ein
Fremdkörper und entwertete diese Arbeit. Der Grund, warum der reine Sprite-Look auch ausscheidet,
ist ebenfalls gemessen: der Zeichencode trägt einen eigenen Absatz darüber, dass ein 1,5-px-Teamring
„im dichten Getümmel neben Sprite und Beschriftung unterging". Ein 64-px-Sprite unter zwölf ist
kein Subjekt, auch wenn nur er sich bewegt.

**Und ein Nebeneffekt, der später wichtig wird:** die Karte ist der natürliche Träger für Items
und Zauber. Ein Zauber hat auf einer Karte einen Platz; auf einem 64-px-Sprite hat er keinen.
Abschnitt 5.

---

## 3. Chris' Formel-Fix — die dritte Option, ernsthaft geprüft

Dies ist der Abschnitt, um den es Chris geht. Ich behandle ihn als gleichrangige Option, nicht als
Randnotiz — und komme zu einem Nein für den Mechanik-Teil und einem klaren Ja für den Rest.

**Was Chris vorschlägt, in meinen Worten:** TMP und AUS bleiben in Echtzeit wirksam, aber ihr Kanal
wird umgeleitet. Tempo geht nicht mehr in die rohe Ereigniszahl, sondern in **Agilität/Ausweichen**.
Awareness geht in **Krit/Schwachstellenfindung** (mehr Schaden je Treffer, nicht mehr Treffer).
Torment plus Dex/Speed ergibt einen **Burst-Pfad**, damit Assassinen sich so spielen, wie ihre
Eignung sie beschreibt. Damit blieben Echtzeit-Sprite-Kämpfe erhalten.

Das ist ein gutes Designinstinkt. Er ist an drei Stellen schon einmal durch den Motor gelaufen.

### 3.1 „Tempo → Ausweichen" ist gebaut worden und wieder rausgeflogen

Der Kommentar in `nahschlag()` (`:19616-19627`) ist wörtlich:

> „PARADE. Ein Nahkampfschlag geht nicht daneben — er wird abgewehrt. […] **KEIN PARIER-WURF MEHR.**
> Im Vorbild trifft ein Nahkampfschlag in Reichweite immer; ausweichen oder parieren kann nur, wer
> einen Skill dafür hat — und den hat bei uns noch niemand. Vorher wurden **bis zu 40 % aller
> Schläge verschluckt**, und zwar ausgerechnet gegen langsame Kämpfer wie Baumkopf: die Formel war
> 0,20 + (Tempo des Ziels − Präzision)/300, also traf er umso schlechter, je schneller sein Gegner
> war."

Das ist exakt Chris' Vorschlag, und es hat **zwei** Probleme gemacht, die beide wiederkämen:

1. **Es hat die Gelegenheit nicht umgeleitet, sondern verdoppelt.** Wer schnell ist, bekommt mehr
   Schläge *und* wird seltener getroffen. Eine Ausweichchance ist eine Gelegenheitsgröße wie die
   Schlagfrequenz — nur auf der Empfängerseite. Sie schließt den Kanal nicht, sie spiegelt ihn.
2. **Sie verschluckte bis zu 40 % aller Ereignisse.** Das ist das Gegenteil dessen, was ein
   Motor mit Verlässlichkeitsproblem braucht: weniger wirksame Ereignisse je Spiel heißt mehr
   Rauschen je Spiel heißt niedrigeres rho je Spiel.

### 3.2 „Awareness → Krit" ist gebaut worden und wieder rausgeflogen — auf Chris' eigene Nachfrage hin

Der Kommentar bei `:4670-4680` hält die Episode vollständig fest. Chris damals, wörtlich: „aber was
ist mit crit chance etc, haben klassen die nicht auch? trefferchance gab es glaub ich nicht in dem
spiel." Die Antwort, nachgesehen an allen 35 Klassenkarten:

> „alle 35 Karten führen genau hp, atk, def, spd, stunResist, knockbackResist, mana samt
> Regeneration und stamina samt Regeneration. **KEINE Karte kennt Präzision, und keine kennt eine
> Krit-Chance.** […] Sie fliegt raus, und mit ihr der kritische Treffer, der allein an ihr hing.
> **Wollen wir Krits, gehören sie an den SKILL** (dort kann eine Karte sie ausweisen), **nicht an
> einen ausgedachten Spielerwert.**"

Im Code steht die Leiche noch: `const crit=false;   // Krits kommen künftig aus dem Skill, nicht
aus einem Spielerwert.` (`:19627`). Das ist keine Vergesslichkeit, das ist ein **Haken, der auf die
Skill-Ebene wartet.**

Und es gibt einen harten Vertrag, der dem im Weg steht: `class-kits.ts` und
`BATTLE_ARENA_UEBERGABE.md` („Keine erfundenen Werte") verbieten, Kampfwerte zu erfinden statt sie
abzuschreiben. **Eine Krit-Chance ließe sich also nicht einmal kalibrieren — die Quelle führt sie
nicht.** Eine eigene Fable-Recherche dazu wäre nicht schwierig, sondern **an fehlenden Daten
blockiert**, solange sie an Attributen hängt. An Skills hängend ist sie es nicht: ein Skill darf
eine Krit-Chance ausweisen, weil Skill-Karten das im Vorbild tun.

### 3.3 Verschiebt es die Wurzelursache? — Ja, und ich kann die Stelle benennen

Chris' Frage nach der Wurzelursache ist die richtige, und die Antwort ist unangenehm konkret.
Hier sind die beiden Matrizen, um die es geht (aus dem Motor, `:5419` und `:5449`):

| | TDM | Mini-DM |
|---|---|---|
| Matrix | power 28, health 20, stamina 14, spirit 12, charisma 10, determination 6, intelligence 6, **awareness 2**, **torment 2** | **torment 24**, health 20, power 16, stamina 16, will 14, dexterity 10 — **awareness und speed kommen nicht vor (Gewicht 0)** |

Jetzt Chris' Vorschlag hineingerechnet:

- **„Awareness → Krit" in Mini-DM** gäbe einem Attribut mit **Matrixgewicht NULL** einen Effekt
  erster Ordnung auf den Schaden. Das ist Zeile für Zeile der Fehler, der TDM kaputtgemacht hat
  (Speed 46 im Tempo bei Matrixgewicht 0) — und der Mini-DM-Kommentar sagt selbst, dass er extra
  vermieden wurde: „Bei einer neuen Disziplin diesen Fehler zu wiederholen wäre mutwillig."
- **„Awareness → Krit" in TDM** wäre ein Attribut mit Gewicht **2 von 100**, das plötzlich die
  Schadensverteilung trägt.
- **„Torment + Dex → Burst" in Mini-DM ist bereits gebaut.** Das Rezept lautet
  `ANG:{torment:46, power:34, dexterity:20}` und `TMP:{dexterity:40, stamina:32, torment:28}`.
  **Torment ist dort der größte Einzelposten des Angriffs**, Dexterity der größte des Tempos. Chris'
  gewünschte Mechanik existiert genau in der Disziplin, in der er sie sich wünscht — und diese
  Disziplin misst 0,094 / 0,071.

Damit ist die dritte Teilfrage des Auftrags beantwortet: **der Formel-Fix löst die Wurzelursache
nicht, er verschiebt sie** — von „Speed/Dexterity kaufen unbepreist Ereignisse" zu „Awareness und
Torment kaufen unbepreist Schadenshöhe". Der einzige Weg, das zu vermeiden, wäre, die Krit- und
Ausweichwahrscheinlichkeiten selbst durch `aufEignung()` zu normieren. Das ist **schwerer als bei
LP/ANG/VER, nicht leichter**: eine Wahrscheinlichkeit lässt sich nicht mit einem freien Faktor
skalieren (sie stößt bei 1 an), und genau die Kappung war es, die den letzten Versuch ruiniert hat
— „aus einem Sieg wurde ein Blowout", 23 von 24 Kämpfen 6:0 (`:5352-5357`).

### 3.4 Der Vergleich, den der Auftrag verlangt

| Kriterium | **(a) Rundenmodell** (A1) | **(b) nichts ändern** | **(c) Formel-Fix** (Chris) |
|---|---|---|---|
| Schließt den TMP/AUS-Ereigniskanal | **durch Konstruktion** | nein | **teilweise** — Rate ja, Ausweichen spiegelt ihn auf die Empfängerseite |
| Schließt den Aussetzungskanal (Geometrie) | **nur wenn die Zielwahl mitgebaut wird** — heute nicht im Plan | nein | **nein** |
| Öffnet einen neuen unbepreisten Kanal | nein | — | **ja, benennbar**: Awareness (Gewicht 0–2), Torment |
| Bereits gemessen? | nein, nur der Präzedenzfall Fechten | ja — 0 von 3 seit Wochen | **ja, beide Hälften** — Rate: 0,113/0,269/0,325; Parade: ausgebaut |
| Messbarkeit der Änderung | **hoch** — eine Variable, neuer `MOTOREN`-Eintrag, Rest bit-identisch | — | **niedrig** — greift in `nahschlag()`/`treffer()` mitten im Produktivpfad, drei Disziplinen sofort betroffen |
| Kalibrierdaten vorhanden? | ja (dieselben Kampfwerte) | — | **nein** — keine Klassenkarte führt Krit oder Präzision |
| Braucht eigene Fable-Recherche vorab? | nein | — | **ja, und sie wäre an fehlenden Daten blockiert** |
| Erhält Echtzeit-Sprites | nein (Clip je Aktion) | ja | **ja** |
| Erzeugt ein Subjekt im Bild | **ja, durch Konstruktion** | nein | **nein** — zwölf Figuren schlagen weiter gleichzeitig |
| Erzeugt Spannung (Chris' Kriterium) | **nur mit Regie** | nein | **ja, auf der Tonspur** — „ausgewichen!", „Schwachstelle!" sind echte Beats |
| Aufwand | mittel (1 Runde) | null | **mittel–groß** — plus Neukalibrierung von drei Disziplinen |
| Risiko | **gering** (nichts Produktives wird angefasst) | — | **hoch** — `wert()`-nah, drei Basislinien sofort, Blowout-Präzedenz |

**Mein Urteil: (c) fällt als Mechanik durch und gewinnt als Dramaturgie.** Die beiden Hälften, aus
denen Chris' Vorschlag besteht, sind gebaut und gemessen worden; die eine hat 40 % der Ereignisse
verschluckt, die andere hatte keine Datengrundlage. Und beide zusammen kämen bestenfalls in die
Gegend von 0,33, weil der gemessene Deckel des ganzen TMP/AUS-Themas dort liegt.

**Aber**: die Beats, die Chris beschreibt — „ausgewichen", „Schwachstelle gefunden", „Assassine
platzt aus dem Rücken heraus" — sind **exakt das, was dem HP-Balken-Mockup gefehlt hat.** Sie sind
sein Kriterium „catcht den Zuschauer", in Mechanik übersetzt. Die richtige Antwort ist deshalb nicht
„nein", sondern **„ja, aber am Skill, nicht am Attribut"** — und das ist keine Vertröstung, sondern
der Ort, den die Engine selbst seit August dafür vorgesehen hat und an dem bereits ein Konzept
liegt (Abschnitt 5).

### 3.5 Und Chris' Assassinen-Beobachtung? Sie stimmt — sie ist nur ein Anzeigefehler

Chris sagt, Assassinen seien laut Eignung im Mini-DM „teils nicht schlecht … durch ihr torment".
**Das ist richtig, und der Motor bildet es bereits ab:** Torment führt die Mini-DM-Matrix mit 24
und trägt 46 % des Angriffsrezepts. Ein tormentstarker Kämpfer hat dort echte Kampfkraft.

**Was fehlt, ist, dass man es sieht.** Torment wirkt heute als stiller Multiplikator auf eine Zahl,
die als „−17" über einem 64-px-Sprite aufblitzt. Es gibt keinen Moment, in dem das Spiel sagt: *das
war der Assassine, und das war sein Torment.* Deshalb fühlt sich Chris' Assassine schwach an,
obwohl er es nicht ist. **Das ist ein Präsentationsproblem mit einer Präsentationslösung** — eine
Karte, die „Torment 84" trägt, ein Callout, das den großen Treffer benennt, ein Duell-Schnitt, der
ihn zeigt. Null Rangtreue-Risiko. Es steht in B0.

---

## 4. Zuschauer-Bindung — das eigentliche Erfolgskriterium

Chris hat das Kriterium selbst geliefert: „es soll funktionieren und den zuschauer catchen — damit
man investiert ist in **sein eigenes team**". Das ist strenger als „lesbar" und es zeigt in eine
andere Richtung als „schneller" oder „langsamer".

### 4.1 Vier Dinge erzeugen Bindung, und nur eines davon hängt am Takt

| Träger | Was er leistet | Wo er heute steht |
|---|---|---|
| **Identität** | Ich erkenne meinen Mann wieder. Derselbe Name, dasselbe Portrait wie im Kader, dieselbe Rolle. | **fehlt in der Arena** — 64-px-Sprite, kein Portrait, keine Rolle, kein Zustand |
| **Einsatz** | Was ich sehe, zählt wirklich. | **fehlt** — der Host reicht keine Saat durch (A3). Chris schaut heute einem anderen Kampf zu als dem, der gezählt hat |
| **Ungewissheit** | Ich weiß vor der Auflösung nicht, wie es ausgeht, und es könnte kippen. | fehlt — Arena ist fast zufallsfrei (2 `rr()`), und alle tragen dasselbe Platzhalter-Kit |
| **Wendepunkt** | Es gibt einen Moment, an den ich mich erinnere. | fehlt — der Kampf ist eine gleichmäßige Abnutzung |

**Nur „Wendepunkt" hängt am Takt.** Die anderen drei sind unabhängig davon, ob der Kampf in Runden
oder in Echtzeit läuft — und sie sind zusammen der größere Hebel.

### 4.2 Welche Option bindet stärker?

**Echtzeit-Sprites mit Formel-Fix** gewinnen auf **Ungewissheit** (Ausweichwürfe und Krits sind
echte Glücksmomente, wo heute Determinismus steht) und verlieren auf **Identität** (das Getümmel
bleibt) und **Wendepunkt** (zwölf gleichzeitige Verläufe haben keinen Moment, nur einen Trend).

**Runden mit Karten-Hybrid** gewinnen auf **Identität** (die Karte des Handelnden leuchtet, sie
trägt Portrait, Rolle, Zustand) und **Wendepunkt** (ein K.o. ist ein Beat, kein Ausblenden) und
verlieren auf **Ungewissheit**, solange nichts gewürfelt wird — ein Rundenmotor aus denselben
deterministischen Bausteinen ist genauso vorhersehbar wie heute, nur aufgeräumter. **Genau das hat
Chris am Mockup kritisiert: „nur Stats die sich ändern".**

> **Die Schlussfolgerung ist die interessanteste dieser Runde: Chris' Kritik trifft nicht das
> Rundenmodell, sondern die Determiniertheit.** Ein Rundenmodell ohne Ungewissheit ist ein Log mit
> Fortschrittsbalken. Was fehlt, ist nicht Echtzeit — es sind **riskante Momente**. Und die kommen
> in diesem Projekt aus genau zwei Quellen: aus **Skills** (S1) und aus der **Regie** (Dosierung,
> Schnitt, Callout). Nicht aus dem Takt.

Das ist auch der Grund, warum ich das Rundenmodell weiter empfehle, obwohl ich seinen
Rangtreue-Vorsprung in Abschnitt 1.3 kleingeschrieben habe: **es ist der Rahmen, in dem Skills und
Regie überhaupt einen Platz haben.** In zwölf gleichzeitigen Verläufen hat ein riskanter Moment
keinen Zeitpunkt, an dem man ihn zeigen kann.

### 4.3 Deshalb steigt A3 im Rang

Heute rechnet die Produktion den Spieltag headless zu Ende (`lib/battle/arena-headless-runner.ts`:
`M.bau(saat); M.lauf(); M.wert()`), und der Host reicht Kader, Aufstellung und Anzeige-Meta durch —
**aber keine Saat**. Was Chris zuschaut, ist nicht das Spiel, das gezählt hat. Das ist auf der
Bindungsachse kein Detail, sondern der teuerste Posten überhaupt: **eine Show ohne Einsatz.** Ein
kleiner PR. In der 19.09.-Synthese stand er auf Platz vier; hier steht er vorne.

---

## 5. Items und Zauber — Zukunftsoffenheit, und ein Zuhause für Chris' Idee

`docs/design/roguelike-skill-pool-konzept-17-09.md` (Fable, 17.09., zurückgestellt) ist bereits
der ausgearbeitete Entwurf: vier Slots je Spieler, ein gemeinsamer Pool, drei Angebote nach einem
Kampf, per Saat aus (Spieler, Saison, Spieltag) gezogen. Drei Dinge daraus sind für diese
Entscheidung wichtig:

1. **Heute tragen ALLE Spieler dasselbe Platzhalter-Kit** (`MATRIARCH`, `:4272`, im Roguelike-Konzept gegen einen älteren Stand als `engine.js:4273` zitiert) — und
   zwar aus einem gemessenen Grund: „mit ungleichen Kits misst jede Serie die Kit-Verteilung statt
   die Spieler". Die Skill-Ebene ist also heute ein **Nullkanal**. Sie zu einem *bepreisten* Kanal
   zu machen, öffnet kein neues Leck — im Gegenteil, das Konzept sieht dafür schon ein
   **Nutzwert-Band** vor (gemessen: Bogenkit 12,9 gegen Slash 7,3 Nutzwert je Sekunde).
2. **Skills sind eine eigene Wirkungsebene** — was ein Kämpfer *tut* —, ausdrücklich keine Zugabe
   auf Attribute oder Eignung. **Genau deshalb ist dort Krit legitim, wo er am Attribut illegitim
   ist.** Ein Skill trägt seine Krit-Chance auf der Karte, so wie im Vorbild; ein Spielerwert tut
   das nicht.
3. **Der Engpass ist nicht Code, sondern Karten:** 33 von 35 Klassenkits fehlen. Das ist die
   Vorarbeit, die S1 real kostet, und sie ist nicht Chris-frei — irgendwer muss die Karten
   beschaffen.

**Welcher Takt eignet sich besser dafür?** Runden, deutlich — und aus drei konkreten Gründen, nicht
aus Gefühl:

- **Es gibt einen Zeitpunkt.** „Karte ausspielen" braucht einen Moment, in dem das Spiel steht.
  Echtzeit hat keinen; die Bühne und ein Rundenmotor haben ihn durch Konstruktion.
- **Es gibt einen Ort.** Eine Karte, die schon im Bild liegt, kann leuchten, sich drehen, einen
  Zauber tragen. Ein 64-px-Sprite kann das nicht.
- **Es gibt einen Intent.** Slay the Spires Absichts-Symbol („greift nächste Runde für 12 an") ist
  das übertragbarste Detail des ganzen Genres — und es ist **nur in Runden formulierbar**. Es ist
  zugleich die Antwort auf Chris' „keine Spannung": Ungewissheit entsteht, wenn man weiß, was
  kommt, und nicht weiß, ob man es übersteht.

Das ist ein starkes, aber kein alleinentscheidendes Argument — es zeigt in dieselbe Richtung wie
Abschnitt 4.2, und deshalb zähle ich es mit.

---

## 6. Der Umsetzungsplan

Er baut auf A0 → A1 → A2 → A3 der 19.09.-Synthese auf (A0.1 und A0.2 sind mit PR #969/#970
erledigt) und ordnet um: **erst sehen, dann messen, dann bauen.**

### 6.1 B0 — das Drehbuch-Mockup, und warum es diesmal Spannung erzeugen muss

**Das ist der nächste Schritt, und zwar der einzige.** Statisches HTML, echte Portraits aus
`public/portraits/` (2 983 vorhanden), echte Sprites aus `public/sprites/baukasten/` (478 Dateien,
`slash`/`hurt`-Posen), Duell-Bühne nach dem Muster von `zeichneHeben()`. **Kein Motor, keine
Simulation, keine Messung.** Ein Drehbuch, und es wird ausdrücklich als Drehbuch beschriftet, damit
niemand es für eine Messung hält.

Fables vier Anforderungen (wer handelt, gegen wen, was passiert, was kommt als Nächstes) sind
richtig, aber sie beschreiben **Lesbarkeit**, und Lesbarkeit war nicht Chris' Kritik. Seine Kritik
war **Spannung**. Deshalb sind die Anforderungen an B0 schärfer:

> **Das Mockup muss einen Verlauf zeigen, den man nacherzählen kann.** Nicht „Balken sinken".
> Sondern: *„Der Gegner führte 3:1, dann hat Greenkraut zwei Leute umgelegt, und am Ende stand
> Baumkopf mit 40 Leben allein gegen zwei."*

Ein konkretes Drehbuch, sechs Beats, rund 45 Sekunden:

| Beat | Was zu sehen ist | Welcher Bindungsträger |
|---|---|---|
| 1 | Aufstellung: zwei Kartenreihen mit Portraits, Namen, Rollen, Kampfwerten. Der eigene Star ist markiert. | Identität |
| 2 | **Intent-Zeile**: „Schleicher geht hinten rum · Bollwerk deckt · Heiler zieht hoch" | Ungewissheit |
| 3 | Duell-Schnitt: der Assassine bricht durch, **Callout „SCHWACHSTELLE! ×2"**, große Schadenszahl, Gegnerkarte kippt auf rot | Wendepunkt |
| 4 | **Gegenschlag**: der eigene Star geht auf 12 Leben, seine Karte pulsiert, Rundenzähler „Runde 6 von 12" | Ungewissheit |
| 5 | Heiler zieht ihn hoch — Karte wechselt zurück, Ticker-Zeile, Publikumsgeräusch | Wendepunkt |
| 6 | Letztes K.o., Endstand groß wie in `zeichneHeben()`, **„zählt für Spieltag 7"** | Einsatz |

**Beat 3 und 5 sind der ganze Punkt.** Sie sind die Beats, die Chris' Formel-Fix-Idee als Erlebnis
umsetzen — nur dass im Mockup ein Drehbuch dahintersteht und nicht eine Attributformel. Wenn Chris
das abnimmt, wissen wir, dass die Optik trägt, **bevor** irgendein Motor gebaut wird; und wir wissen,
dass die Beats aus S1 kommen müssen und nicht aus `nahschlag()`.

**Abnahmefrage an Chris nach B0, wörtlich zu stellen:** *Fühlt sich das an wie ein Spiel?* Wenn nein,
ist die Antwort nicht „mehr Motor", sondern mehr Regie — und wir wissen es für den Preis eines
Nachmittags.

### 6.2 A1.0 — die Expositions-Sonde (neu, klein, vor dem Motor)

Abschnitt 1.3 hat einen zweiten unbepreisten Kanal aufgedeckt (Aussetzung nach Geometrie, Korrelation
−0,02). Ein Rundenmotor nach dem Plan vom 19.09. schließt ihn **nicht**. Bevor eine ganze Runde in
einen Motor fließt, der an der falschen Stelle repariert, wird gemessen, wie groß der Posten ist:

- Variante A: heutiger Motor, unverändert — Basislinie.
- Variante B: `cdKuerzung=(u)=>0` — **die Rate-Hälfte von Chris' Formel-Fix.** Die Zahlen liegen
  bereits vor (0,113 / 0,269 / 0,325); die Sonde reproduziert sie nur zur Kontrolle.
- Variante C: Zielwahl gleichverteilt statt geometrisch (Round-Robin über die lebenden Gegner) —
  **die Aussetzungs-Hälfte, die noch nie gemessen wurde.**
- Variante D: B und C zusammen.

**Nur Sondenpfad, nichts wird gemergt.** Das Werkzeug existiert: `miss-alle-disziplinen.mjs` kennt
alle vier Chassis, `miss-mini-dm-ffa-rangtreue.mjs` vergleicht bereits zwei Chassis-Varianten
nebeneinander mit derselben rho-Formel. Kaderfest, n ≥ 96, Median **und** Spannweite ausgewiesen.

**Warum das die billigste Entscheidung des ganzen Plans ist:** wenn C oder D die Arena deutlich
über 0,50 hebt, weiß A1.1, was es bauen muss (Gleichverteilung **der Gelegenheit UND der
Aussetzung**). Wenn nichts davon trägt, ist die Ursache woanders, und wir haben eine Runde
gespart statt sie zu verbrennen.

### 6.3 A1.1 — der Rundenpilot, unverändert in der Bauart, geschärft im Ziel

Unverändert gilt die Bauregel vom 19.09.:

> **Als NEUER `MOTOREN`-Eintrag neben dem alten, nicht als Änderung am alten.** Die drei
> produktiven Arena-Disziplinen bleiben Byte für Byte unangetastet;
> `miss-alle-disziplinen.mjs 24` muss bit-identisch bleiben.

Geschärft: Der Pilot ändert jetzt **zwei** Variablen (Gelegenheit und Aussetzung), und das muss die
Messung abbilden — 2×2 statt vorher/nachher, sonst weiß man hinterher nicht, welche der beiden
gewirkt hat. Und er schreibt sein **Protokoll** (Runde, Handelnder, Ziel, Aktion, Ergebnis, Intent),
das der Hybrid-Abspieler aus B0 dann liest — Motor und Präsentation entstehen getrennt, die
R4-Naht fällt gratis an.

**Die Messhürde bleibt unverhandelt:** n ≥ 96–150 je Variante, kaderfest über die fünf Paarungen,
Median UND Spannweite. Eine Bewegung zählt nur, wenn sie größer ist als die Spannweite — und die
ist in der Arena brutal (Battlefield 0,938, Mini-DM 0,697).

**Erwartung, damit hinterher nicht umgedeutet wird — und sie ist niedriger als am 19.09.:** Ich
erwarte nach Abschnitt 1.3 **nicht** den Fechten-Sprung. Ein realistischer Erfolg wäre Mini-DM
deutlich über 0,50 bei geschrumpfter Spannweite. Alles unter 0,40 ist eine Widerlegung, kein
Teilerfolg.

### 6.4 Was parallel und unabhängig läuft

| | Auftrag | Warum jetzt |
|---|---|---|
| **A3** | Die gebuchte Saat durch den Host reichen | Bindungsträger „Einsatz", 1 PR, unabhängig von allem anderen (Abschnitt 4.3) |
| **F1** | **Football-Down-Karte** aus `fsLive.snap` (Down & Distance, Spielzugtyp, Ergebnis) | Macht Football sichtbar rundenbasiert, ohne den Motor anzufassen. rho-neutral, bit-identisch nachmessbar. Beantwortet Chris' Feldspiel-Frage **praktisch** statt auf Papier |
| **K1** | `renderKader()`: Kachel → Karte (Portrait, Rolle, Zustand) für alle zwanzig | Das universelle Element, an dem Chris „ein System" erkennt. Gehört in die Broadcast-Welle |
| **S1** | Skill-/Item-Ebene nach `roguelike-skill-pool-konzept-17-09.md` | **Chris' Krit/Ausweichen/Burst, richtig verortet.** Eigener Strang, größer als alles andere hier, Engpass sind die 33 fehlenden Klassenkarten |

---

## 7. Aufwand, Risiko, Nutzen — ehrlich

| Auftrag | Aufwand | Risiko | Erwarteter Nutzen | Was schiefgehen kann |
|---|---|---|---|---|
| **B0** Drehbuch-Mockup | 1 Nachmittag | **null** (kein Code im Motor) | **hoch** — beantwortet die Frage, an der zwei Anläufe gescheitert sind | Chris sagt wieder nein — dann wissen wir es für einen Nachmittag statt für eine Runde |
| **A1.0** Expositions-Sonde | 1 Messrunde | sehr gering (Sondenpfad, nichts gemergt) | **hoch als Entscheidungsgrundlage** | Ergebnis ist flach → dann ist die Arena-Ursache noch nicht gefunden, und A1.1 fällt vorerst aus |
| **A1.1** Rundenpilot | 1 Runde (Motor + Messung + Bericht) | gering — neuer `MOTOREN`-Eintrag, Basislinien unbewegt | mittel — nach Abschnitt 1.3 **niedriger als am 19.09. angenommen** | rho springt nicht → A2 fällt ersatzlos, Preis ist eine Runde |
| **A3** Saat durchreichen | 1 PR, klein | gering | mittelbar, aber auf der Bindungsachse groß | Host liefert eine andere Aufstellung als der Runner — genau das ist zu prüfen |
| **F1** Football-Down-Karte | 1 PR, klein | sehr gering (liest `fsLive.snap`) | **direkt sichtbar** | keines erkennbar |
| **K1** Kachel → Karte | 1–2 PRs | gering (Anzeige) | mittel — „ein System" über alle zwanzig | Portrait-Auflösung je Spieler-ID muss in allen zwanzig greifen |
| **A2** TDM/Battlefield nachziehen | 2–3 PRs Motor + 1–2 Präsentation | **mittel** — drei Disziplinen neu kalibriert, Formationscode aus PR #912 teils entwertet | hoch, **wenn** A1.1 trägt | 120–180 Clips ohne Regie werden zum durchrattenden Log — dieselbe Kritik zurück |
| **S1** Skills/Items | **groß**, eigener Strang | mittel — greift in den Kampf ein, braucht das Nutzwert-Band | **hoch für Spannung und Zukunft** | **Engpass sind Karten, nicht Code**: 33 von 35 Kits fehlen, und der Abschrift-Vertrag verbietet Erfinden |
| **(c)** Formel-Fix als Mechanik | mittel–groß | **hoch** | **gemessen gering** (Deckel bei ~0,33) | Blowout-Präzedenz; neuer unbepreister Kanal über Awareness/Torment |
| **(b)** nichts ändern | null | — | null | Die Arena steht seit Wochen bei 0 von 3, nach **sechs** dokumentierten Echtzeit-Anläufen, alle schlechter oder ununterscheidbar. Schlechtester Erwartungswert von allen |

**Wie die Rangtreue-Regel gewahrt bleibt:**

| Auftrag | Motor angefasst? | Nachweis |
|---|---|---|
| B0 | nein (eigenständige HTML-Datei) | trivial |
| A1.0 | nein — Sondenvarianten, nichts gemergt | `miss-alle-disziplinen.mjs 24` bit-identisch auf `main` |
| A1.1 | **nein an produktiven Disziplinen** — neuer `MOTOREN`-Eintrag daneben | dito, trivial nachweisbar |
| A3 / F1 / K1 | nein | dito; bei F1 zusätzlich: liest `fsLive.snap`, schreibt nichts |
| A2 | **ja**, drei Disziplinen | neue Basislinie für TDM/Mini-DM/Battlefield, kaderfest, n ≥ 96–150, `data/generated/rangtreue-basislinie.json` nachziehen; **die übrigen 17 bit-identisch** |
| S1 | **ja** | eigene Messrunde, Nutzwert-Band als Abnahmebedingung |

---

## 8. Offene Fragen an Chris

Keine davon blockiert B0.

1. **Nimmst du „Krit und Ausweichen kommen aus Skills, nicht aus Attributen" an?** Das ist die
   einzige inhaltliche Stelle, an der ich deinem Vorschlag widerspreche. Der Grund ist gemessen
   (Abschnitt 3), und die Engine hat es im August schon einmal so entschieden — auf deine eigene
   Nachfrage hin. Der Effekt, den du willst, kommt trotzdem; er kommt nur über S1.
2. **Das Drehbuch-Mockup (B0): reicht dir „gescriptet, kein echter Motor" als Zwischenschritt?**
   Es zeigt bewusst einen erfundenen Kampfverlauf. Wenn dir das zu unehrlich ist, sag es — dann
   drehen wir die Reihenfolge und du siehst zuerst Zahlen statt ein Bild.
3. **Intent zeigen — ja oder nein?** „Schleicher geht hinten rum" vor der Runde macht sie lesbar
   und spannend, nimmt aber Überraschung. Meine Empfehlung: ja, weil Ungewissheit über den AUSGANG
   spannender ist als Ungewissheit über die ABSICHT.
4. **Die Saat (A3): soll der sichtbare Lauf der gebuchte Lauf werden?** Heute ist er es nicht. Ich
   habe das in dieser Synthese nach vorn gezogen, weil es auf deiner eigenen Messlatte („investiert
   in sein eigenes Team") der größte Einzelposten ist.
5. **S1 (Skills/Items): jetzt schon ein Strang, oder weiter „später"?** Der Engpass sind 33
   fehlende Klassenkarten, nicht Code — das ist Beschaffung, und sie liegt teilweise bei dir.
6. **Kampfdauer** (steht seit 19.09. offen): ~60–75 s für einen TDM wie bei der Bühne, oder
   länger mit Regie-Pausen?

---

## 9. Zusammengefasst für die Hauptsession

- **Chris' drei Fragen, beantwortet:** (1) **Split** beim Takt — Ereignismotor für Bühne und
  künftig Arena, Flussmotor für Bahn und Feldspiel; **ein System** bei der Präsentation. Der
  Prüfstein: *Ist die Gelegenheit abzählbar UND gleich verteilbar, ohne Inhaltsverlust?* (2)
  **Football ist bereits rundenbasiert** (am Code nachgeprüft, `starteSnap`/`stepSnapPhase`), es
  muss nur sichtbar werden; **Basketball und Hockey: nein.** (3) **Karten-Auto-Battler ja — als
  Hybrid** (Portrait-Karte = Identität/Zustand/Intent, Sprite = Aktion), als voller Kampfrahmen nur
  für die Arena, als Kachel-Aufwertung für alle zwanzig.
- **Zur dritten Option (Chris' Formel-Fix): als Mechanik nein, als Dramaturgie ja.** Beide Hälften
  sind gebaut und wieder ausgebaut worden — die Parade schluckte bis zu 40 % aller Schläge, der Krit
  hatte keine Datengrundlage (keine der 35 Klassenkarten führt Präzision oder Krit). Und „Awareness
  → Krit" wäre in Mini-DM ein Attribut mit **Matrixgewicht null**, das erster Ordnung Einfluss kauft
  — derselbe Fehler, der TDM kaputtgemacht hat. **Aber die Beats, die Chris will, sind richtig** und
  bekommen ihr Zuhause auf der Skill-Ebene (S1), wo die Engine sie seit August erwartet.
- **Ich nehme einen Teil meiner 19.09.-Synthese zurück.** `arena-tempo-schlagfrequenz.md` misst den
  TMP/AUS-Kanal in beide Richtungen: geschlossen steht die Arena bei **0,113 / 0,269 / 0,325**,
  nicht bei 0,80. Der Kanal ist real, aber nicht die ganze Ursache. Und Mini-DM — die am
  sorgfältigsten umgeleitete der drei — misst die schlechteste Zahl des Projekts. Meine
  Rangfolgen-Erklärung von damals hält nicht.
- **Neu gefunden: ein ZWEITER unbepreister Gelegenheitskanal.** Die Aussetzung. 264 von 288
  Kämpfer-Spielen zielen auf den Nächsten, Korrelation zwischen Eignung und „Angreifer je
  Lebenssekunde" = **−0,02**. Weder Chris' Formel-Fix noch ein naives Rundenmodell schließt ihn.
  Deshalb steht jetzt eine billige Messung (A1.0) **vor** dem Motorbau.
- **Der nächste Schritt ist kein Motor, sondern ein Drehbuch-Mockup (B0)** mit echten Portraits,
  echten Sprites, Duell-Bühne und **zwei echten Wendepunkten**. Ein Nachmittag, null Risiko. Denn
  Chris' Kritik traf nicht das Rundenmodell, sondern die **Determiniertheit**: ein Rundenmodell ohne
  riskante Momente ist ein Log mit Fortschrittsbalken.
- **Hochgezogen: A3 (die gebuchte Saat durch den Host reichen).** Was Chris heute zuschaut, ist
  nicht der Kampf, der gezählt hat. Auf seiner eigenen Messlatte — „investiert in sein eigenes Team"
  — ist das der größte Einzelposten, und es ist ein kleiner PR.
- **Fable widersprochen** bei einer falschen Zeilenangabe (`:5183-5203` → `:5344-5363`) und bei
  „das Feldspiel hat überall nur ein Verlässlichkeitsproblem": **Football hat eine Verlässlichkeit
  von 0,405**, die niedrigste der zwanzig — und ist ausgerechnet die Disziplin, die schon
  rundenbasiert ist. Rundenbasiert ist für sich genommen keine Rangtreue-Medizin.
</content>
</invoke>
