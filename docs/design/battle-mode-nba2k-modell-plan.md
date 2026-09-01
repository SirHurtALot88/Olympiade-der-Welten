# NBA-2K-Modell für den Basketball-Live-Motor — Plan

**Vorschlags- und Arbeitsdokument, kein Beschluss.** Stand 01.09.2026, gegen
`claude/basketball-seiten-symmetrie-fix` (PR #704, Seiten-Asymmetrie in `bauFeldspiel()`
behoben) gemessen. Umgesetzt wird in dieser Runde **nur Basketball, nur der
Feldspiel-Live-Motor** — Football/Hockey/Tennis (Vorab-Durchlauf), die drei anderen
Chassis, das Team-Punkte-Modell (2/1/0, PR 7), das PPs-Modell und das Konstanz-Stat
bleiben unangetastet.

---

## 0. Warum überhaupt — Chris' Verschärfung

Die vorige Konsultation (`battle-mode-gameplay-grundmodell.md`, PR #702) hatte mit „etwas
weniger Varianz als reale Sport-Vorbilder" geantwortet. Chris hat das ausdrücklich
zurückgewiesen, mit einem konkreten Vorbild:

> In NBA 2K26/27 landen bei einer Spielsimulation Top-Spieler verlässlich weit vorne mit
> passenden Stats — ein 90er-Defender macht schwächere Gegenspieler defensiv fertig und
> blockt Shots, ein unbewachter Top-Scorer erzielt entsprechend viele Punkte. Das ist kein
> Zufall, das ist die erwartete Abbildung der Attribut-Gewichtung.

Der Grund, warum das kein „nice to have" ist, steht schon in A.2 des Vorgängerdokuments:
**jede Disziplin läuft genau einmal pro Saison.** Es gibt keine 82 Spiele, über die sich
Rauschen herausmittelt. Das **einzelne** simulierte Spiel muss die Rangfolge zeigen.

### Was das Vorbild architektonisch anders macht

Aus dem Reverse-Engineering der NBA2K-Simulation (NLSC-Forum) — die Formeln selbst sind
2K-Kalibrierung und werden hier **nicht** übernommen, nur die Architektur:

- Die **erwartete Rate** wird direkt aus dem Rating über eine kalibrierte Kurve berechnet
  (Beispiel: `Rebound-Rating = 6·(OffReb%−2)+25`, `BlockRating = 15·Block%+25`).
- Ein **festes Volumen** (Würfe, Rebounds) wird anschließend proportional zu diesen
  Erwartungen auf die Spieler verteilt.
- **Quote und Menge sind getrennt**: mehr Wurfvolumen senkt in 2K nie die eigene
  Trefferquote.
- Der Ablauf ist **rückwärts**: erst steht der Team-Punktverlauf über die Spielzeit fest,
  danach werden die Einzelspieler-Boxscores passend dazu erzeugt.
- **Ratings und Tendencies sind getrennt**: die Freiwurf-Generierung hängt an einer
  eigenen Tendenz (`3pt-FTA-Anteil = 0,3 + 0,15·DrawFoul/100`), nicht am Wurf-Rating.

Kurz: **Erwartung zuerst, Zufall nur in der Realisierung.** Unser Motor macht es umgekehrt
— er würfelt Ereignisse und hofft, dass die Erwartung emergent herauskommt.

---

## 1. Ist-Zustand — gemessen, nicht vermutet

Neues Werkzeug: `scripts/miss-basketball-rangtreue.mjs` (Sonde `window.__arena.basketballProbe`,
read-only, gleiches Muster wie `diagDynamik`). 24 Spiele je Feldgröße, `main`-Stand mit
PR #704:

| jeSeite | ρ(gesamt) | ρ(je Seite) | Probe V: ΔFG% | Probe V: ΔPunkte | Probe S: ΔPp (tier-isoliert) | Pkt/Spiel | Ballwechsel | FGA/Spiel | Usage% |
|---|---|---|---|---|---|---|---|---|---|
| 2 | **0,221** | 0,362 | — (zu wenig Paare) | — | +5,4 | 29,0 | 29,6 | 27,3 | 57,7 |
| 4 | 0,636 | 0,601 | **+4,6** | **+20,3** | −3,3 | 32,1 | 33,1 | 29,1 | 33,1 |
| 6 | 0,635 | 0,617 | **+1,5** | **+12,5** | +3,3 | 31,3 | 32,8 | 28,9 | 28,5 |

Dazu die Rebound-Messung (dieselben Läufe), getrennt nach den zwei Achsen aus §2:

| jeSeite | Offensiv-Rebound-Anteil | Rebounds/Spiel | Achse-2 Team-ρ | Achse-2 Spieler-ρ |
|---|---|---|---|---|
| 2 | **50,3 %** | 16,1 | 0,588 | 0,627 |
| 4 | **50,1 %** | 17,2 | 0,298 | 0,751 |
| 6 | **45,8 %** | 17,3 | **0,109** | 0,698 |

Vier Befunde, alle vier belegt:

1. **Rangtreue liegt bei 0,62–0,64 (6v6) und bricht bei 2v2 auf 0,22 ein.** Ziel ≥ 0,70.
2. **Probe V hat das falsche Vorzeichen.** Ein Angreifer, den ein starker Verteidiger
   deckt, trifft heute **besser** (+1,5 bis +4,6 Pp) und punktet **mehr** (+12,5 bis
   +20,3 %) als derselbe Angreifer gegen einen schwachen. Die Verteidigung wirkt nicht
   nur zu schwach — sie wirkt gar nicht, das Vorzeichen ist Rauschen.
3. **Das Volumen ist winzig.** ~29 Feldwürfe je Spiel auf zwölf Spieler sind **2,4 Würfe
   pro Spieler pro Spiel**. Auf 2,4 Versuchen ist keine Rangfolge messbar, egal wie steil
   die Kurve ist. Das ist die Rauschquelle, die alle anderen Eingriffe begrenzt.
4. **Die Rebound-Grundverteilung ist kaputt.** Fast jeder zweite Rebound (45,8–50,3 %) ist
   ein Offensiv-Rebound; real sind es ~26 %. Unser Rebound-Zweikampf kennt kein
   Ausboxen — er lost über alle Spieler in Ballnähe, ohne dass die verteidigende Seite den
   Stellungsvorteil hätte, den sie in echtem Basketball per Konstruktion hat. Das ist ein
   eigener Befund, unabhängig von der Rangtreue, und Chris' Einschätzung nach der, an dem
   „am Ende das Gameplay bricht". Zusätzlich liest die Team-Ebene der zweiten Achse bei
   6v6 nur ρ = 0,109 — welches Team mehr `ZWEITCHANCE` aufs Feld bringt, entscheidet heute
   fast nicht mit.

### Das Beispielspiel, das den Befund trägt (Saat 1337, 6v6, Endstand 8:21)

| Spieler | Eig | Impact | Pkt | Reb | Ast | TO | FG | gedeckt von |
|---|---|---|---|---|---|---|---|---|
| King Arlen Morgolor | **66,1** | 4,2 | 2 | 5 | 1 | **6** | 1/6 | Greenkraut (ABW 30) |
| Seraph-11 | 60,6 | 9,4 | 7 | 2 | 0 | 0 | 3/4 | Krolach (ABW 39) |
| Tidesprinter | 50,7 | **19,7** | 4 | 5 | 0 | 1 | 2/3 | Johanna (ABW 48) |
| Lava Golem | **21,6** | 0,0 | 0 | 0 | 0 | 0 | 0/0 | Cassandra (ABW 52) |

Der eignungsstärkste Spieler des Feldes ist Impact-Rang 6 von 12, mit sechs Ballverlusten
und 1/6 aus dem Feld. Genau Chris' Beschwerde, in einer Tabelle.

### Kalibrier-Anker (40 Spiele, 6v6, eingefrorener Vorher-Stand)

Diese Zahlen sind **Messwerte des heutigen Motors** und dienen unten als Anker, damit die
neue Kurve den Mittelwert nicht verschiebt:

| Größe | Wert | n |
|---|---|---|
| FG% `dunk` | 92,3 % | 155 |
| FG% `nah` | 43,9 % | 223 |
| FG% `mit` | 41,9 % | 191 |
| FG% `fern` | 36,2 % | 505 |
| mittlerer `schussSkillFuer` über genommene Würfe | **57,3** | 1074 |
| mittlere `ABWEHR` aller Spieler | **41,7** | — |
| Spanne `eig` (inkl. Formkarten) | 19,6 … 74,0 | — |

Die vier FG%-Werte liegen innerhalb der NBA-Referenz, gegen die der Motor am 26.08.
kalibriert wurde (2P-Finisher ~65–76 %, 3P ~42–45 % Career-Bestwerte; hier
liga-durchschnittlich, nicht Bestwert). **Sie dürfen sich durch diese Runde im Mittel
nicht verschieben.**

### Eine Korrektur an der Vorrecherche

Die vorige Recherche schrieb, „die Trefferauflösung nutzt den nächststehenden, nicht den
zugeordneten Verteidiger". **Das stimmt nicht.** `entscheideBallaktion` liest
`FSTEAM[1-u.side].find(v=>v.deckt===u)` — also sehr wohl den **zugeordneten** Decker;
`naheVerteidiger` zählt zusätzlich alle nahen für die Doppelung. Was wirklich fehlt, ist
etwas anderes: der Decker geht nur mit seiner **absoluten** `ABWEHR` in die Formel, nie
mit dem **Abstand zum Angreifer**. Das ist der Punkt, an dem (b) unten ansetzt.

Ebenso schon vorhanden: `spielmacherLos` und der Rebound-Zweikampf laufen **bereits**
quadratisch mit Nullpunkt 20. Linear geblieben sind im Live-Pfad nur der
Spielzug-Kandidat und der Screener. Die `gewichtetesLos()`-Aufrufe, die die Vorrecherche
nennt (Zeilen 3850/3851/3913), gehören zum **Vorab-Durchlauf** und werden für Basketball
nie ausgeführt (`bauFeldspiel` springt vorher in `initBasketballLive`) — sie anzufassen
würde nur Football/Hockey/Tennis verschieben und ist deshalb außerhalb des Auftrags.

---

## 2. Rebounds: zwei Achsen, die nicht verwechselt werden dürfen

Der Rebound ist der Punkt, an dem sich „was vom Vorbild übernehmen" und „wo wir bewusst
darüber hinausgehen" am schärfsten trennen. Es sind **zwei voneinander unabhängige
Größen**, und der Fehler wäre, sie gegeneinander auszuspielen. Wir wollen beide.

### Achse 1 — die Grundverteilung defensiv/offensiv: **übernehmen**

Ein verteidigendes Team holt nach einem gegnerischen Fehlwurf strukturell viel öfter das
Brett als das angreifende, weil seine Spieler beim Wurf zwischen Schützen und Korb stehen.
Das ist eine **Eigenschaft des Spiels selbst, kein Teamstärke-Effekt** — ~74 % defensiv zu
~26 % offensiv, in der NBA-Liga-Statistik wie im 2K-Reverse-Engineering. Die Ratio ist ein
reales Faktum und wird übernommen.

**Gemessen (§1): unser Motor liegt bei 45,8–50,3 % offensiv — fast doppelt so hoch.**
Ursache: der Rebound-Zweikampf sammelt seine Kandidaten aus
`[...FSTEAM[0],...FSTEAM[1]]` im Greifradius und lost allein über `ZWEITCHANCE`. Es gibt
**kein Ausboxen** — der Stellungsvorteil der Verteidigung existiert in der Simulation
nicht. Das behebt Eingriff **(e)** unten.

### Achse 2 — wer sie innerhalb dieser Pools bekommt: **bewusst besser als 2K**

Bei 2K wirkt das Rating **nur** auf die Verteilung innerhalb eines Teams; auf Team-Ebene
bekommt jedes Team pauschal seinen Anteil, unabhängig vom Gesamtrating. **Das übernehmen
wir ausdrücklich nicht** — es widerspricht Chris' 95-%-Ziel direkt: ein insgesamt
stärkeres Team muss auch insgesamt dominieren, nicht nur intern anders verteilen.

Hier macht der Motor es strukturell schon richtig: derselbe Zweikampf über beide Teams
hinweg heißt, dass mehr `ZWEITCHANCE` auf dem Feld auch mehr Bretter gegen den Gegner
bedeutet. Nur ist die Wirkung heute zu schwach (Team-ρ 0,109 bei 6v6). Eingriff **(a)**
(steilere Gewichtung) verstärkt das auf **beiden** Ebenen zugleich, weil es dieselbe eine
Lotterie ist.

### Warum sich die beiden nicht ins Gehege kommen

(e) ist ein **konstanter** Faktor auf einer Seite, (a) ein **wertabhängiger** Exponent auf
allen Kandidaten. Der konstante Faktor verschiebt, aus welchem Pool der Gewinner kommt;
der Exponent entscheidet weiterhin, **wer** ihn holt — innerhalb wie zwischen den Teams.
Achse 1 lässt sich damit auf 26 % kalibrieren, ohne dass Achse 2 etwas davon merkt. Genau
das ist im Vorbild nicht der Fall, und genau das ist unser Mehrwert.

## 2a. Was wir von 2K sonst nicht übernehmen

Zwei Punkte, die wir bewusst **nicht** kopieren:

- **Der Rückwärts-Ablauf** („erst Team-Punktverlauf, dann Boxscores"). Er ist elegant und
  wäre die reinste Umsetzung des Prinzips — aber er ist mit einem Live-Motor unvereinbar,
  in dem Ereignisse beim Zusehen entstehen (Chris' ausdrückliche Entscheidung für
  Basketball). Er bleibt als Option für die drei **Vorab**-Feldspiele notiert, wo die
  Partie ohnehin beim Aufbau durchgerechnet wird (siehe §7).
- **Ratings/Tendencies-Trennung** ist bei uns bereits da und heißt anders: `rezept:`
  erzeugt die Ratings (`SCHUSS_NAH`, `ABWEHR`, …), `BASKETBALL_POS_MOD` und die
  Slot-Zuordnung erzeugen die Tendenzen. Kein Handlungsbedarf.

---

## 3. Die Eingriffe — konkrete Formeln

Vier aus dem ursprünglichen Auftrag, (e) kam durch die Rebound-Messung dazu. Alle fünf
sitzen im bestehenden Ereignisketten-Gerüst. Kein Komplett-Neubau.

### (a) Steilere Lotterien — eine zentrale Konstante statt vier Formen

Heute gibt es im Live-Pfad **drei verschiedene** Lotterie-Formen nebeneinander:
`pow(max(1,AUFBAU−20),2)` (Spielmacher), `pow(max(1,ZWEITCHANCE−20),2)` (Rebound), und
`max(1,m[rolle])` (Spielzug-Kandidat, Screener) — linear, ohne Nullpunkt.

```js
const LOS_NULLPUNKT = 20;   // wie in spielmacherLos/reboundKampf schon vorhanden
const LOS_KAPPA     = 3;    // GESETZT (Ausgangswert, gegen κ=2 gemessen, s. §5)
const losGewicht = (w, k) => Math.pow(Math.max(1, w - LOS_NULLPUNKT), k ?? LOS_KAPPA);
```

Angewandt auf: `spielmacherLos` (2 → κ), Rebound-Zweikampf (2 → κ), Spielzug-Kandidat
(1 → κ), Screener (1 → κ). Nicht angefasst: `gewichtetesLos()` selbst (Vorab-Pfad, s. o.).

Wirkung an echten Werten: Rebound Tidesprinter (`ZWEITCHANCE` 56) gegen Krag'Zul (28):
- heute (κ=2): 36² : 8² = 1296 : 64 = **95 : 5**
- κ=3: 36³ : 8³ = 46656 : 512 = **99 : 1**

Und Spielzug-Kandidat King Arlen (`ABSCHLUSS` 70) gegen Gram (36):
- heute (linear): 70 : 36 = **66 : 34**
- κ=3: 50³ : 16³ = 125000 : 4096 = **97 : 3**

Der zweite ist der eigentliche Gewinn; der erste war schon fast erledigt.

### (b) Trefferchance: Paar-Abstand statt absoluter Verteidiger-Fähigkeit, logistisch

Zwei Teilschritte, getrennt messbar.

**(b1) `kontestFaktor` liest den Abstand, nicht den Absolutwert.**

```js
// heute
kontestFaktor = decker ? (0.7 + decker.ABWEHR * 0.006) : 1;          // 0,70 … 1,30

// neu
const KONTEST_PIVOT = 57.3;  // GEMESSEN: mittlerer schussSkillFuer über 1074 genommene Würfe
const KONTEST_K     = 0.006; // UNVERÄNDERT — dieselbe Empfindlichkeit je Punkt wie heute
const KONTEST_MIN   = 0.55, KONTEST_MAX = 1.45;   // GESETZT, weiter als heutige 0,70/1,30
kontestFaktor = decker
  ? clamp(0.7 + (KONTEST_PIVOT + decker.ABWEHR - schussSkillFuer(u, tier)) * KONTEST_K,
          KONTEST_MIN, KONTEST_MAX)
  : 1;
```

**Warum das mittelwerttreu ist, exakt und nicht ungefähr:** setzt man
`schussSkillFuer = KONTEST_PIVOT` ein, kürzt sich der Klammerausdruck auf
`0.7 + ABWEHR*0.006` — **wortgleich die alte Formel.** Der Mittelwert ändert sich also
genau um `0.006 · (KONTEST_PIVOT − E[schussSkillFuer])`, und `KONTEST_PIVOT` **ist** dieser
Erwartungswert (gemessen: 57,3 über 1074 Würfe). Verschoben wird nur die Spreizung.

An echten Paarungen (Nahwurf): Greenkraut (`SCHUSS_NAH` 74) gegen Tidesprinter (`ABWEHR`
71) → `0.7+(57,3+71−74)·0,006 = 1,027`; derselbe Greenkraut gegen Krag'Zul (`ABWEHR` 11)
→ `0.7+(57,3+11−74)·0,006 = 0,666` → auf 0,55 geklemmt. Heute: 1,126 gegen 0,766,
**unabhängig davon, wer wirft**.

**(b2) Logistische Steilheit mit gemessenem Anker.**

```js
// heute
technikMake = min(0.92, -0.02 + schussSkillFuer(u,tier)*0.0022 + u.TEAMGEIST*0.0030
                        + GEO_BONUS[tier] - bedraengnisMake + (imFastbreak?0.12:0));

// neu: derselbe Ausdruck bleibt die ERWARTUNG, wird aber um seinen gemessenen
// Tier-Mittelwert herum aufgesteilt statt hart geklemmt.
const MAKE_ANKER = { dunk: 0.923, nah: 0.439, mit: 0.419, fern: 0.362 }; // GEMESSEN, §1
const STEIL_MAKE = 12;   // GESETZT (Ausgangswert, gegen 8 gemessen, s. §5)
const logit = (p) => Math.log(p / (1 - p));
const sigma = (z) => 1 / (1 + Math.exp(-z));

roh         = -0.02 + schussSkillFuer(u,tier)*0.0022 + u.TEAMGEIST*0.0030
              + GEO_BONUS[tier] - bedraengnisMake + (imFastbreak?0.12:0);   // UNVERÄNDERT
technikMake = clamp(sigma(logit(MAKE_ANKER[tier]) + STEIL_MAKE * (roh - MAKE_ANKER[tier])),
                    0.02, 0.97);
```

Drei Eigenschaften, alle nachrechenbar:

1. **Anker-Treue.** Bei `roh = MAKE_ANKER[tier]` ist `technikMake` **exakt**
   `MAKE_ANKER[tier]`. Der Ligadurchschnitt trifft weiter so oft wie heute.
2. **Steilheit.** Die Ableitung am Anker ist `STEIL_MAKE · M · (1−M)`. Mit
   `STEIL_MAKE = 12`: `nah` ×2,96, `mit` ×2,92, `fern` ×2,77 — und `dunk` ×0,85, also
   **flacher**. Das ist gewollt und nicht Zufall: bei 92,3 % ist der Dunk ohnehin fast
   sicher, dort soll die Kurve sättigen statt weiter zu spreizen. Eine einzige Konstante
   erledigt beides, weil die Logistik das von selbst tut.
3. **Der harte 0,92-Deckel entfällt.** Die dokumentierte Sättigungsfalle („Attribut­zuwächse
   zahlen sich am Deckel nicht mehr aus, Attribute ohne Deckel-Berührung vergrößern ihren
   Anteil relativ" — GEO_BONUS-Kommentar, verworfener Assist-Bonus) verschwindet damit
   strukturell: σ hat keinen Knick, nur asymptotische Sättigung.

### (c) Usage-Konzentration — wer bekommt den Ball

```js
// heute
gewicht(m) = m.ABSCHLUSS * qualitaet(m)^2 * offenheitFuerPass(von,m) * rollBonus * ausbruchBonus

// neu
const USAGE_KAPPA     = 2;      // GESETZT — dieselbe Form wie spielmacherLos, Nullpunkt 20
const USAGE_ABWEHR_K  = 0.010;  // GESETZT
const ABWEHR_MITTEL   = 41.7;   // GEMESSEN, §1 — Drehpunkt, damit der Faktor im Mittel 1 ist
const USAGE_TEILER_MIN = 0.6, USAGE_TEILER_MAX = 1.6;

abwehrTeiler(m) = clamp(1 / (1 + (abwehrDesDeckersVon(m) - ABWEHR_MITTEL) * USAGE_ABWEHR_K),
                        USAGE_TEILER_MIN, USAGE_TEILER_MAX);
gewicht(m) = losGewicht(m.ABSCHLUSS, USAGE_KAPPA) * qualitaet(m)^2
             * offenheitFuerPass(von,m) * abwehrTeiler(m) * rollBonus * ausbruchBonus
```

Das ist Chris' `ABSCHLUSS^κ / (1 + gegnerische ABWEHR)`, mit zwei Präzisierungen: der
Nullpunkt 20 (sonst ist `35^2 : 70^2` nur 1:4 statt 1:9) und der **Drehpunkt bei der
gemessenen Durchschnitts-ABWEHR** statt bei 0 — sonst würde die Formel jedem Passziel
pauschal Gewicht wegnehmen und nur zufällig mittelwerttreu sein.

`qualitaet(m)^2` bleibt **unverändert** stehen. Der Kommentar an der Stelle dokumentiert
drei durchgemessene Alternativen, die alle schlechter waren; das ist keine Baustelle
dieser Runde.

**Bewusst hier und nicht anderswo:** `gewichtetesLosNach` verbraucht **genau einen**
`rr()`-Wurf, unabhängig von den Gewichten. Die Zahl der Zufallsziehungen ändert sich also
nicht — nur wer den Ball bekommt. Der in dieser Datei mehrfach dokumentierte
„Auswahl-Kaskaden"-Effekt (eine andere Ballverteilung verschiebt die Zufallsfolge für
alles Nachfolgende) bleibt trotzdem real und ist der Grund, warum (c) **einzeln** gemessen
wird.

### (d) Mehr Ballbesitze — die Rauschgrenze

Mit 2,4 Würfen je Spieler und Spiel ist die Rangtreue nach oben begrenzt, egal wie steil
(a)–(c) werden. Ein Spieler mit 60 % erwarteter Quote und einer mit 40 % unterscheiden
sich auf drei Würfen in mehr als einem Drittel der Fälle gar nicht.

Wichtige Klarstellung: **`zuegeJeSeite` ist für Basketball wirkungslos.** Der Live-Motor
liest es nirgends — es steuert nur den Vorab-Durchlauf (Football/Hockey/Tennis) und zwei
UI-Texte. Der Hebel im Live-Motor sind kürzere Ballbesitze:

```js
SCHUSSUHR_BASKETBALL: 8 → 6            // GESETZT
SCHWELLE_ABBAU:       4 → 2.6          // GESETZT, neue benannte Konstante für die bisher
                                       // eingebettete "4s Abbauzeit" in `schwelle`
```

`SPIELDAUER_BASKETBALL` (120 s) wird **nicht** angefasst — die Zahl ist Chris' eigene,
zweimal nachjustierte Entscheidung zur Spiellänge (25.08. 45→90, 29.08. nochmal länger).
Mehr Volumen kommt aus schnelleren Angriffen, nicht aus einem längeren Spiel.

Zielwert: **≥ 45 Feldwürfe je Spiel** (heute 28,9), also ~3,8 je Spieler. Der
√n-Rauschgewinn allein ist bescheiden (√(45/29) ≈ 1,25); (d) ist der **Verstärker** für
(a)–(c), nicht ihr Ersatz — genau wie A.1 im Vorgängerdokument es beschreibt.

### (e) Ausboxen — die Rebound-Grundverteilung auf das reale Verhältnis kalibrieren

Der Rebound-Zweikampf kennt heute keinen Stellungsvorteil der Verteidigung (§2, Achse 1).
Ein **konstanter** Gewichtsfaktor für die verteidigende Seite ergänzt genau das:

```js
// heute
gewinner = gewichtetesLosNach(kandidaten, k => Math.pow(Math.max(1, k.ZWEITCHANCE - 20), 2));

// neu
const REB_BOXOUT = 2.85;   // ZU KALIBRIEREN gegen den gemessenen OFF-Anteil, Ziel 26 %
gewinner = gewichtetesLosNach(kandidaten,
             k => losGewicht(k.ZWEITCHANCE) * (k.side === f.vonSeite ? 1 : REB_BOXOUT));
```

`f.vonSeite` ist die Seite, die geworfen hat — wer **nicht** von dort kommt, verteidigt und
bekommt den Ausbox-Vorteil. Startwert 2,85 = 74/26, also das Gewichtsverhältnis, das bei
sonst gleichen Gewichten genau die Zielquote erzeugt; da die Kandidatenzahl je Seite
schwankt, ist das ein **Startwert, kein Endwert** — der Endwert wird gegen den gemessenen
OFF-Anteil eingestellt (Zielkorridor 24–28 %) und im Code mit der Messung belegt.

**Was dieser Eingriff ausdrücklich nicht tut:** er fasst weder `losGewicht` noch die
`ZWEITCHANCE`-Abhängigkeit an. Ein konstanter Faktor auf einer Seite verschiebt nur, aus
welchem Pool der Gewinner kommt. Wer den Ball holt — innerhalb eines Teams **und** im
Vergleich der Teams — entscheidet weiterhin allein `ZWEITCHANCE^κ`. Beide Achsen aus §2
werden dadurch gleichzeitig richtig, nicht gegeneinander.

---

## 4. Die neue Abnahmemetrik — Code-Spezifikation

Implementiert in `scripts/miss-basketball-rangtreue.mjs`, Datenquelle
`window.__arena.basketballProbe({n, jeSeite})` (read-only).

### RANGTREUE

```
Für jedes Spiel g:
  eig_i    = u.eig  (Disziplinwert + Slot-Aufschlag + Form) — der SOLL-Rang
  impact_i = u.punkte + u.assists + 1.2·u.rebounds + 1.5·(u.steals + u.bloecke)
             − 0.8·u.verluste                                — der IST-Rang
             (identisch mit MOTOREN.basketball.wert(), keine zweite Formel)
  ρ_g      = Spearman(impact, eig)
RANGTREUE = Mittel über alle g
```

Spearman über **Durchschnittsränge** (Pearson auf den Rängen), nicht über die
`6·Σd²`-Kurzformel — Bindungen sind hier häufig (zwei Spieler mit Impact 0 in einem Spiel
sind normal) und die Kurzformel behandelt sie falsch.

Zwei Varianten werden ausgewiesen: **ρ(gesamt)** über alle 2·jeSeite Spieler und
**ρ(je Seite)** getrennt je Team. ρ(je Seite) ist die strengere und ehrlichere Zahl — bei
ρ(gesamt) erzeugt allein ein Stärkegefälle zwischen den beiden Teams schon Korrelation.

**Zielwert: ρ ≥ 0,70**, gemessen an ρ(gesamt) bei 6v6, mit ρ(je Seite) als Kontrolle.

### Rollenprobe V — „der 90er-Defender macht seinen Mann fertig"

Die Manndeckung wird live nachgezogen (`zuordneDeckung`), ein Endstand-Schnappschuss wäre
irreführend. Die Sonde zählt deshalb **je Tick**, wer wen deckt (nur während dessen Seite
angreift), und nennt je Angreifer und Spiel den Verteidiger mit den meisten Ticks.

```
Alle deckerAbwehr-Werte über alle Spieler-Spiele sammeln, in Terzile teilen.
Je Angreifer:  FG% und Punkte/Spiel im Terzil "stark" gegen "schwach",
               nur wenn er in BEIDEN Eimern ≥ 3 Spiele hat  (gepaart!)
ΔFG%     = Mittel über Angreifer von (FG%_stark − FG%_schwach)     Ziel: ≤ −8 Pp
ΔPunkte% = Mittel über Angreifer von (Pkt_stark/Pkt_schwach − 1)   Ziel: ≤ −25 %
```

Die Paarung je Spieler ist nicht Kosmetik: ohne sie misst man, **welche** Angreifer
zufällig auf starke Decker treffen, nicht die Wirkung der Deckung.

### Rollenprobe S — „der unbewachte Top-Scorer trifft"

```
Je Wurf: offen := deckerAbstandBeiWurf ≥ BEDRAENGT_RADIUS (30 px) oder kein Decker
ΔPp = FG%(offen) − FG%(bedrängt),  GETRENNT je Distanzstufe (dunk/nah/mit/fern),
      danach über die Stufen gemittelt, gewichtet mit min(n_offen, n_eng) je Stufe.
Zusätzlich dieselbe Zahl nur für das eignungsstärkste Viertel des Feldes.
```

**Die Tier-Isolierung ist zwingend, nicht optional.** Roh gemessen liest diese Differenz
heute −3,1 bis −10,8 Pp, also scheinbar „bedrängt trifft besser". Das ist ein Artefakt:
offene Würfe sind überwiegend Distanzwürfe (`GEO_BONUS.fern` 0,075), bedrängte überwiegend
Würfe am Ring (`GEO_BONUS.dunk` 0,70). Die Rohzahl misst die Wurfdistanz, nicht die
Deckung. Derselbe Vorbehalt steht schon im Bedrängnis-Kommentar von
`entscheideBallaktion` („tier-isoliert"), war aber nirgends als Abnahmezahl festgehalten.

### Rebound-Grundverteilung (Achse 1) und Rating-Sensitivität (Achse 2)

```
offAnteil   = Rebounds mit offensiv=true / alle Rebounds        Ziel 24–28 % (real ~26 %)
teamRho     = Pearson über die Spiele von
              (Summe ZWEITCHANCE Team0 − Team1)  gegen  (Rebounds Team0 − Team1)
              -> muss deutlich > 0 sein; bei 2K wäre sie ~0. Ziel: steigend, ≥ 0,35
spielerRho  = Mittel je Spiel von Spearman(rebounds, ZWEITCHANCE) über alle Spieler
              -> darf durch (e) NICHT fallen
```

Die Trennung ist der Punkt: `offAnteil` ist eine **Kalibrierung an der Realität**,
`teamRho`/`spielerRho` sind **Balance-Ziele**. Ein Eingriff, der eines auf Kosten des
anderen verbessert, ist falsch gebaut.

### Beobachtet, nicht blockierend

`node scripts/messe-arena-einfluss.mjs basketball 48` (Pp-Abweichung) läuft weiter mit.
**Sie ist ein Signal, kein Veto.** Der Präzedenzfall steht im Handoff: die
Vier-Archetypen-Runde ging von 17,3 auf 20,4 Pp und wurde trotzdem behalten, weil die
Builds dadurch real wurden. Und die Pp-Metrik hat den hier gewünschten Mechanismus schon
einmal als Fehler behandelt — `gewichtetesLos()` entstand, **weil** „immer der beste
Verteidiger" zu 35 % Awareness-Einfluss bei Matrixgewicht 14 führte. Beide Ziele
(Matrixtreue des Durchschnitts, Star-Dominanz im Einzelspiel) sind nicht immer gleichzeitig
maximierbar; steigt die Pp-Zahl, wird das berichtet und begründet, nicht kaschiert.

---

## 5. Reihenfolge in Phase 2 — die etablierte Debug-Methode

Eine Kopie, ein Faktor, vergleichen. Nie zwei gleichzeitig.

0. **Vorher-Kopie einfrieren.** `node scripts/baue-battle-artefakt.mjs <scratchpad>/vorher.html`
   — eine selbstständige HTML mit der Sonde drin. Alle Messungen laufen gegen dieselbe
   eingefrorene Datei, nicht gegen ein wanderndes `main`.
1. **Ist-Zustand messen** — erledigt, §1.
2. **(a)** einbauen, messen. Falls κ=3 die Pp-Zahl unverhältnismäßig hebt: κ=2 gegenmessen
   und die bessere der beiden nehmen (Kriterium: ρ zuerst, Pp als Beobachtung).
3. **(b1)** dazu, messen. Erwartung: Probe V dreht das Vorzeichen.
4. **(b2)** dazu, messen. Danach **FG% je Distanzstufe gegen §1 prüfen** — driftet eine
   Stufe um mehr als ±1,5 Pp, wird `MAKE_ANKER[tier]` **einmal** um die gemessene
   Differenz nachgezogen (das ist die Kalibrier-Schleife, nicht ein Freibrief zum
   Herumdrehen). Falls `STEIL_MAKE = 12` die Quoten an die Ränder drückt: 8 gegenmessen.
5. **(c)** dazu, messen. Höchstes Kaskadenrisiko — hier ist mit dem größten Pp-Sprung zu
   rechnen.
6. **(d)** dazu, messen. Danach FG%-Kontrolle wiederholen: kürzere Ballbesitze verschieben
   die Wurfauswahl (mehr erzwungene Würfe), das darf die Anker nicht unbemerkt kippen.
7. **(e)** dazu, messen und `REB_BOXOUT` auf den Zielkorridor 24–28 % OFF-Anteil
   einstellen. Zugleich prüfen, dass Achse-2-Team-ρ dabei **nicht** fällt — täte sie es,
   wäre der Faktor doch nicht konstant genug gebaut.
8. **Kumulativ** bei 2/4/6 Spielern je Seite, plus das durchgerechnete Beispielspiel
   vorher/nachher.
9. `npx tsc --noEmit`, `npm run build`, volle `npx vitest run`, bestehende
   Basketball-Abnahmeskripte (`miss-arena-spielefeldspiel.mjs`,
   `miss-arena-feldspiel-spiegel.mjs`, `messe-arena-einfluss.mjs`).

---

## 6. Frage 1 — gilt das Modell auch bei 2v2?

`playerCount` ist **nicht** fix: `resolveDisciplinePlayerCount()` liest ihn aus dem
Saison-Spielplan, und eine echte Saison hatte bereits `playerCount = 2`.

**Die Zwischen-Einschätzung, die zu prüfen war:** ein festes Volumen-Budget, das mit
steiler Gewichtung auf die Spieler EINER Seite verteilt wird, generalisiere von selbst —
bei 2 Spielern konkurriere der Star nur mit einem Mitspieler statt mit fünf, bekomme also
einen **größeren** Anteil.

**Teils bestätigt, teils widerlegt — gemessen, nicht vermutet (§1):**

| jeSeite | Usage-Anteil des Besten | Gleichverteilung | Konzentrationsfaktor | ρ(gesamt) |
|---|---|---|---|---|
| 2 | 57,7 % | 50,0 % | **1,15×** | **0,221** |
| 4 | 33,1 % | 25,0 % | **1,32×** | 0,636 |
| 6 | 28,5 % | 16,7 % | **1,71×** | 0,635 |

- **Bestätigt:** der *absolute* Anteil steigt, wenn das Feld kleiner wird (57,7 % gegen
  28,5 %). So weit die Vermutung.
- **Widerlegt:** die *Konzentration relativ zur Gleichverteilung* fällt — bei 2v2 nimmt
  der Star nur 1,15-mal so viele Würfe wie ein zufällig gewählter Spieler, bei 6v6
  1,71-mal. Der Mechanismus generalisiert also **nicht** von selbst; er wird bei kleinem
  Feld schwächer.
- **Und entscheidend:** die Rangtreue bricht bei 2v2 auf 0,22 ein.

**Warum**, und das ist der eigentliche Befund: bei 2v2 ist die Stichprobe je Spieler zwar
größer (dasselbe Volumen auf weniger Köpfe), aber die zu ordnende Menge hat nur noch
**zwei** Elemente je Seite. Ein Spearman über 2 Elemente ist ±1 — jedes einzelne Spiel
liefert entweder perfekte oder perfekt falsche Ordnung, und der Mittelwert ist direkt die
Trefferquote „hat der Bessere gewonnen?" minus der Gegenwahrscheinlichkeit. 0,22 heißt:
in nur ~61 % der Spiele steht der Bessere der beiden vorn. Dieselbe Zahl, die bei 6v6 als
0,635 harmlos aussieht, ist bei 2v2 die nackte Paarvergleichs-Trefferquote — **das kleine
Feld ist der härtere Test, nicht der leichtere.**

Konsequenz für Phase 3: 2v2 ist die Abnahmegröße, an der sich das Modell beweisen muss.
Wenn ρ(2v2) mitsteigt, generalisiert die Architektur; wenn nur 6v6 steigt, haben wir
Rauschmittelung gekauft und keine Rangtreue.

---

## 7. Frage 2 — Übertragbarkeit auf die anderen Disziplinen und Chassis

Nur skizziert; gebaut wird in dieser Runde nichts davon.

Das Prinzip in drei Sätzen, chassis-unabhängig formuliert:

> **P1** Die erwartete Rate eines Spielers folgt aus seinem Rating über eine kalibrierte
> Kurve, deren Mittelwert an einem gemessenen Anker festgenagelt ist.
> **P2** Ein Volumen-Budget wird mit steiler Gewichtung (κ, Nullpunkt) auf die
> Beteiligten verteilt — auf **beiden** Ebenen: innerhalb des Teams und zwischen den Teams.
> **P3** Das Matchup wirkt in der **Auflösung** über den **Abstand** zweier Werte, nie über
> den Absolutwert einer Seite.

### Die drei anderen Feldspiele (Football, Hockey, Tennis)

Sie laufen heute über den **Vorab-Durchlauf**, nicht über den Live-Pfad. Zwei Wege:

- **Nach der Live-Portierung**: (a)–(d) sind dann fast wörtlich übertragbar, weil sie in
  Funktionen sitzen, die das Chassis teilt (`gewichtetesLosNach`, `technikMake`,
  `offensterMitspieler`). Zu ersetzen wären nur die **Anker**: `MAKE_ANKER` je Disziplin
  neu messen (Hockey trifft nicht 44 % wie ein Nahwurf im Basketball), `KONTEST_PIVOT` und
  `ABWEHR_MITTEL` ebenso. Die Konstanten `LOS_KAPPA`, `STEIL_MAKE`, `KONTEST_K`,
  `USAGE_KAPPA` sind Form-Parameter und können geteilt werden.
- **Vorher, im Vorab-Pfad**: dort ist der 2K-Rückwärts-Ablauf sogar der natürliche Weg —
  die Partie wird ohnehin komplett durchgerechnet, bevor irgendetwas gezeigt wird. Ein
  festes Wurf-/Ballbesitz-Budget mit `losGewicht`-Verteilung ist dort **billiger** als im
  Live-Motor, nicht teurer.

Zwei Strukturfragen bleiben offen und sind keine Kalibrierungsfragen (B.2 des
Vorgängerdokuments): Tennis gehört vermutlich nicht ins Feldspiel-Chassis (`jeSeite:6`
heißt dort sechs parallele Einzel, kein geteilter Ballbesitz — strukturell Denkduell),
und Football braucht eine Down-Struktur statt einer Ballwechsel-Schleife. **Das Prinzip
oben ist von beiden unabhängig**: P1–P3 gelten für „sechs parallele Duelle" genauso wie
für „vier Versuche auf Raumgewinn", nur das Budget heißt anders.

### Bahn (Spurt, Staffel, Climbing, …)

Passt am direktesten, weil es dort **schon** ein festes Budget gibt: die Strecke. Die
Rennmechanik verteilt Zeit statt Ereignissen.

- **P1** ist da (`ab`/`tempo` aus Rezeptwerten), aber ohne gemessenen Anker — die
  Ziel-**Zeitspanne** je Disziplin wäre der Anker, den `MAKE_ANKER` im Basketball ist.
- **P2** braucht am wenigsten: das Budget ist die Streckenlänge, die Aufteilung ergibt
  sich physikalisch.
- **P3 ist die eigentliche Lücke.** Windschatten und Rempler wirken heute über Abstände im
  Raum, das Rempel-Ergebnis aber über Absolutwerte. Genau hier gehört ein Paar-Abstand
  hin — und genau hier hängt Chris' offene Frage 3 („darf ein Rempler den Remplenden
  gezielt vorbeibringen?").

### Bühne (Gewichtheben, Showcase, Eiskunstlauf, Breaking, Wettessen)

Am einfachsten, weil es **kein Matchup** gibt: jeder tritt für sich an, P3 entfällt
weitgehend (bei den Duell-Disziplinen Speed-Schach/I-Spy kommt es über den
Brett-Vergleich zurück).

- **P1** ist die eigentliche Arbeit: die Jury-Punktzahl je Durchgang müsste an einer
  gemessenen Ziel-Punktverteilung verankert und logistisch aufgesteilt werden — dieselbe
  `σ(logit(M) + STEIL·(roh − M))`-Form, nur mit „Punkte je Durchgang" statt
  „Trefferwahrscheinlichkeit". **Achtung:** die Bühnen-Punktzahl ist unbeschränkt, die
  Logistik nicht. Es bräuchte eine Normierung auf eine Obergrenze (z. B. „Anteil der
  maximal erreichbaren Durchgangspunkte") — sonst passt die Form nicht.
- **P2** ist schon da (`Durchgänge`), das Budget ist die Zahl der Durchgänge.

### Kampf (TDM, Mini-DM, Fechten, Battlefield)

Der interessanteste Fall, und der mit der von Chris genannten Besonderheit: dort stehen
**bereits 0-100-normierte Werte** (`ANG`, `VER`, `LP`, `AUS`, `TMP`) statt absoluter
Boxscore-Zahlen, und die `KURS`-Tabelle ist eine bewusst gepflegte, kalibrierte
Wechselkurs-Fläche.

**Wie das Prinzip dort hineinpasst, ohne die Kalibrierung zu zerstören:**

- **P3 ist im Kampf schon halb umgesetzt und muss nur konsequent werden.** Ein Treffer
  löst dort bereits über `ANG` gegen `VER` auf — also über einen echten Paar-Abstand, das,
  was Basketball erst noch bekommt. Zu prüfen wäre nur, ob **jede** Auflösung so läuft oder
  ob einzelne (Heilung, Zwang, Reichweite) noch Absolutwerte lesen.
- **P1 darf `KURS` nicht anfassen.** Die Wechselkurstabelle ist die Balancefläche, an der
  die Skill-Kosten hängen (`nutzwertStatisch`); eine logistische Aufsteilung **dort**
  würde jeden Skill-Preis mitverschieben. Der richtige Andockpunkt ist eine Stufe später:
  die **Auflösung** eines Treffers/Effekts, nicht seine Bepreisung. Also
  `σ(logit(M) + STEIL·(ANG−VER-Term − M))` auf die Trefferwahrscheinlichkeit, mit `M` aus
  einer gemessenen Ist-Trefferquote — `KURS` bleibt Zeile für Zeile stehen.
- **P2 ist die echte Lücke im Kampf.** Es gibt kein Volumen-Budget: wer wie oft zuschlägt,
  ergibt sich aus Abklingzeiten und Zielwahl. Ein „Fokusfeuer-Budget" (wie viele Angriffe
  fallen in dieser Runde auf welches Ziel) wäre das Gegenstück zu `offensterMitspieler` —
  und wäre zugleich der Ort, an dem die Klassenkarten-Unterschiede sichtbar würden, sobald
  die fehlenden 33 Karten da sind.
- **Ein Warnschild:** die 0-100-Normierung heißt, dass die Rohwerte im Kampf **enger
  beieinander** liegen als die Basketball-Sub-Skills. `MISMATCH_SPANNE` im Basketball ist
  genau aus diesem Grund von 100 auf 40 gesenkt worden („in einer echten Paarung liegen
  die Rezeptwerte selten mehr als 10-25 Punkte auseinander"). Jede κ- und
  STEIL-Konstante muss im Kampf gegen die **dort** gemessene Wertespanne neu gesetzt
  werden, nicht aus dem Basketball übernommen.

### Was in allen vier Chassis gleich bleibt

Die Abnahme. **RANGTREUE ist chassis-unabhängig**: sie braucht nur einen Eignungswert je
Teilnehmer (`u.eig`, existiert überall) und einen Impact-Wert (`MOTOREN[d].wert()`,
existiert überall, das ist genau der Vertrag der Motoren-Registry). Die Sonde
`basketballProbe` ist heute basketball-spezifisch, weil sie Deckungspaarungen und
Wurfstufen mitzählt; der ρ-Teil allein ließe sich für alle 20 Disziplinen aus
`MOTOREN[d].wert()` + `u.eig` ziehen. **Das wäre die günstigste Verallgemeinerung dieser
ganzen Runde** und sollte vor der nächsten Disziplin passieren, nicht danach.

---

## 8. Was diese Runde ausdrücklich nicht anfasst

- Andere Disziplinen, andere Chassis (nur skizziert, §7).
- Team-Punkte-Logik 2/1/0 (PR 7) und der Arena-Adapter.
- Das PPs-Modell (`battle-mode-pps-modell-plan.md`, offenes Thema).
- Das Konstanz-Stat (`battle-mode-gameplay-grundmodell.md` Teil C). Es kommt **nach**
  diesem Fix — C.4 dort sagt es selbst: Konstanz verteilt Varianz um, sie senkt sie nicht.
  Erst muss die Erwartung stimmen, dann darf man sie um sie herum streuen lassen.
- `SPIELDAUER_BASKETBALL`, `ZEIT_DEHNUNG`, die 60-Sekunden-Zusage.
- Der Vorab-Durchlauf in `bauFeldspiel()` und damit `gewichtetesLos()` selbst.

## 9. Zentrale Referenzen

`public/mockups/battle-mode.engine.js` — `bauFeldspiel` (Z. ~3781), `initBasketballLive`
(~4077), `zuordneDeckung` (~4121), `gewichtetesLosNach`/`offensterMitspieler` (~4244),
`entscheideBallaktion`/`kontestFaktor`/`technikMake` (~4296–4455), Rebound-Zweikampf
(~5700), Sonde `basketballProbe` (~12686) ·
`scripts/miss-basketball-rangtreue.mjs` · `scripts/messe-arena-einfluss.mjs` ·
`lib/resolve/rank-to-points.ts` (`resolveDisciplinePlayerCount`) ·
`docs/BATTLE_ARENA_UEBERGABE.md` (Feldspiel-Chassis) ·
`docs/design/battle-mode-gameplay-grundmodell.md` (A.1, A.2, B.2, C.4).
