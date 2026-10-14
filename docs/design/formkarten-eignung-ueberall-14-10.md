# Formkarten: Jitter-Verifikation (E9) und Eignungs-Kopplung ueberall (E10) — 14.10.

Chris' Antworten vom 14.10. auf `docs/design/fable-konzept-chris-feedback-13-10.md`, Abschnitt 9:

> **E9** ("Formkarten-Jitter ±4 zu breit?"): „ok wenn das der jitter war ist das ok für mich - die
> form sollte aber absolut dort stehen also +2,4 oder -1,2 etc. die formkarte ist ja für alle
> gleich und in Summe muss es im schnitt dann ja auch wieder z.B. +4 ergeben wenn man eine +4
> setzt. und funktioniert das mit der form sauber? wirkt es sich spürbar aus? Konntest du das
> schon messen?"
>
> **E10** ("Formkarten eignungsproportional auch in Feldspiel/Bühne/Zeitfahren/Climbing?"):
> „messen und form wirkt sich ÜBERALL direkt auf die Eignung aus!"

Dieses Dokument haelt fest, was in dieser Runde gemessen und gebaut wurde, und was fuer eine
Folgerunde offen bleibt.

## E9 — Ist der Jitter sauber und unverzerrt?

Der gemessene Mechanismus ist **nicht** `zieheFormkarten()` im Battle-Mode-Motor (das zieht nur
die diskrete Kartenziehung `[0,2,4,8]` je Spieltag — der historische LCG-Niedrigbit-Fund vom
02.09. betrifft diese Funktion, nicht den Jitter). Der Jitter, den Chris' Frage meint, sitzt in
`lib/lineups/legacy-lineup-modifiers.ts:860-919`: `seededFormJitter()` (ein FNV-1a-Hash je Seed,
**kein LCG**) plus `distributePerPlayerFormShares()`, das den flachen Pro-Spieler-Kartenwert mit
diesem Jitter addiert.

### Teil 1 — echte Kommazahl, kein Raster

`seededFormJitter()` rundet auf eine Dezimalstelle (`toFixed(1)`). Gemessen
(`scripts/miss-formkarten-jitter-bias.ts`, n=2000 je Spieler): 1796 von 2000 Werten (89,8 %)
tragen tatsaechlich eine Nachkommastelle — der Rest landet zufaellig exakt auf einer Ganzzahl
(bei zehn moeglichen Nachkommastellen genau der erwartete ~1-aus-10-Anteil, kein Hinweis auf eine
Rasterung). Beispielwerte aus `distributePerPlayerFormShares({formPerPlayer:4, ...})`: `+0.4,
+3.4, +7.1, +4.3, +4.1` — exakt die Groessenordnung, die Chris nennt ("+2,4 oder -1,2").

### Teil 2 — unverzerrt?

Gemessen (`scripts/miss-formkarten-jitter-bias.ts`, n=2000 je nominalem Kartenwert):

| nominal | Mittelwert realisiert | Abweichung | 95-%-Band bei n=2000 |
|---:|---:|---:|---:|
| +4 | 4,0288 | +0,029 | ±0,101 |
| +8 | 7,9596 | -0,040 | ±0,101 |
| -4 | -4,0086 | -0,009 | ±0,101 |
| +2 | 1,9411 | -0,059 | ±0,101 |
| 0 | 0,0000 | 0,000 | — (s. unten) |

Jede Abweichung liegt innerhalb des reinen Stichprobenrauschens (95-%-Band ±0,101 bei n=2000,
±0,261 bei n=300). Die Konvergenzprobe (Teil D, nominal=+4, wachsendes n) zeigt dasselbe: die
Abweichung schrumpft mit wachsendem n (0,338 bei n=50 -> 0,053 bei n=5000 -> 0,010 bei
n=20000) statt stehenzubleiben — genau das Muster von Rauschen, **nicht** das Muster der
historischen LCG-Niedrigbit-Verzerrung (die bei egal wie vielen Saaten auf vier Kartensaetzen
haengenblieb, s. CLAUDE.md). **Der Jitter ist unverzerrt — rechnerisch nachgewiesen, kein neuer
Bugfix noetig.**

Nebenbefund, kein Fehler: bei nominal `0` liefert `distributePerPlayerFormShares()` IMMER exakt
`0`, ohne jeden Jitter (`if (!Number.isFinite(flat) || flat === 0) return seeds.map(() => 0)`,
Zeile ~906). Das ist beabsichtigt (keine gespielte Karte soll keinen Zufallsausschlag erzeugen),
aber es heisst: die Formkarte `0` ist die einzige der vier Kartenwerte, die NIE jittert —
erwaehnenswert, falls das je zur Debatte steht, aber kein Teil von Chris' Frage.

### Teil 3 — wirkt sich Form spuerbar aus?

Gemessen mit einer neuen, additiven Messsonde `formEinflussVon(dId, n, formPlus, saatVersatz)`
(`public/mockups/battle-mode.engine.js`, direkt nach `einflussVon()`/`spurtEinfluss`, auch als
`window.__arena.formEinflussVon` exportiert) und dem Skript `scripts/miss-formkarten-effekt.mjs`.
Gepaarte Messung wie `einflussVon()`: derselbe Lauf-Index liefert denselben Mutatoren-/
Gegner-Wurf fuer "neutral" (Formkarte 0 erzwungen) und "stark" (Formkarte +8 erzwungen) — der
Unterschied im Ergebnis ist deshalb ausschliesslich der Formkarte zuzuschreiben.

Gemessen `node scripts/miss-formkarten-effekt.mjs hockey 24 8` (Feldspiel-Chassis, 24 Laeufe je
Spieler und Zustand, 12 Spieler, 193 s):

| Spieler | wert neutral | wert stark | Delta | Rang neutral | Rang stark | Rang-Delta |
|---|---:|---:|---:|---:|---:|---:|
| Draco | 12,52 | 13,85 | +1,34 | 4,17 | 3,79 | -0,38 |
| Lava Golem | 6,36 | 9,18 | +2,82 | 7,21 | 5,79 | -1,42 |
| Krolach | 9,22 | 9,68 | +0,46 | 5,75 | 5,50 | -0,25 |
| Johanna | 10,29 | 14,94 | +4,65 | 5,25 | 3,04 | -2,21 |
| King Arlen Morgolor | 1,83 | 3,39 | +1,56 | 10,50 | 9,54 | -0,96 |
| Gram | 4,35 | 7,28 | +2,94 | 8,58 | 7,00 | -1,58 |
| Greenkraut | 12,51 | 15,68 | +3,17 | 4,17 | 3,08 | -1,08 |
| Krag'Zul | 8,77 | 12,22 | +3,45 | 6,08 | 4,63 | -1,46 |
| Tidesprinter | 13,22 | 15,70 | +2,48 | 3,63 | 2,83 | -0,79 |
| Seraph-11 | 1,48 | 10,52 | +9,04 | 11,08 | 4,96 | -6,13 |
| Ralazar the Balanced | 2,88 | 9,82 | +6,94 | 10,13 | 5,38 | -4,75 |
| Cassandra | 1,52 | 2,18 | +0,66 | 11,17 | 10,67 | -0,50 |

Mittel ueber alle zwoelf: `wert()` +3,29 Punkte (derselbe Anteils-Massstab wie
`feldspielWert()`/die Pp-Abnahme), Rang **-1,79 Plaetze** (negativ = besser). **Jeder einzelne
der zwoelf Spieler** verbessert sich bei erzwungener Formkarte +8 gegenueber Formkarte 0 — kein
Ausreisser, keine Richtungsumkehr. Bei Spielern mit ohnehin niedrigem Grundwert (Seraph-11,
Ralazar) ist der Effekt am groessten (+9,0 bzw. +6,9 Punkte, 6 bzw. 5 Rangplaetze), weil derselbe
Formkartenbonus bei einem niedrigen Nenner anteilig mehr wiegt — bei den staerksten Spielern
(Draco, Tidesprinter) bleibt er kleiner, aber immer noch klar positiv. **Form wirkt sich
spuerbar aus — gemessen, nicht vermutet, und die Antwort auf Chris' Frage ist ja.**

## E10 — Audit: wo wirkt Form bereits proportional auf die Eignung, wo nicht?

Fuenf Chassis lesen `formVon(p.n)+stufenWert()` (die Formkarte plus den Intensitaets-Zuschlag,
`breitP`/`breitPunkte`) und reichen sie in **zwei** Kanaele weiter:

1. **Attribut-Kanal** (`mitAufschlag(attr, breitP, betroffeneAttribute(...), dId)`): hebt die
   betroffenen Attribute proportional dazu, wie stark sie den Disziplinwert tragen. ALLE FUENF
   Chassis tun das identisch (Feldspiel, Buehne, Zeitfahren/Spurt/Staffel/Climbing/Takeshi,
   Arena). Dieser Kanal ist also ueberall schon da.
2. **Eig-Feld**: Feldspiel, Buehne und die vier Bahn-Chassis (Spurt/Staffel/Zeitfahren/Climbing/
   Takeshi) schreiben `eig:(p.d[dId]!=null?p.d[dId]:gewichtet(p.a,BASIS_JE_DISC[dId]||{}))
   +engP+breitP(+eigHebung+eigMutator)` — Form steckt dort IMMER direkt drin. Auch dieser Kanal
   ist also schon ueberall da.

Der Unterschied, den E10 eigentlich meint, ist ein DRITTER Kanal: **bestimmt `eig` (mit Form
drin) die MENGE des Ergebnisses, oder bleibt `eig` nur Anzeige, waehrend die Menge allein aus
dem Rezept kommt?**

| Chassis | Disziplinen | `eig` enthaelt Form? | `eig` bestimmt die MENGE? | Fundstelle |
|---|---|:-:|:-:|---|
| Arena (`baueEinheit`) | TDM, Battlefield, Fechten, Mini-DM | ja | **ja** — `aufEignung(stats(...), eigWert)` skaliert LP/ANG/VER auf `eigWert` | `battle-mode.engine.js:31757-31764` |
| Bahn, `art.staffel` | Staffel | ja | **ja** — `f=eigW/m`, alle sieben Sub-Skills reskaliert | `:39881-39927` |
| Bahn, `art.mengeAusEignung` | Takeshi's Castle, **Climbing** | ja | **ja** — dieselbe `f=eigW/m`-Reskalierung | `:38189` (Climbing), `:38672` (Takeshi), Anwendung `:39937-39942` |
| **Feldspiel** (`bauFeldspiel`) | **Football, Basketball, Hockey** | ja (Zeile 8648) | **nein** — `R2` kommt direkt aus `mische({a:attr},...)`, keine Reskalierung auf `eig` | `:8621-8648` |
| **Buehne** (`bauBuehne`) | **Tennis, Fechten(Buehne-Teil), Schach, Showcase, Eiskunstlauf, Gewichtheben, Speed-Schach, I-Spy** | ja (Zeile 17328) | **nein** | `:17300-17330` |
| **Bahn, Zeitfahren** (`bauSpurt`, kein `art.staffel`/`mengeAusEignung`) | **Time-Trial** | ja (Zeile ~39978) | **nein** — explizit im Code dokumentiert als offene Frage ("Rezept gibt Form UND Menge, Eignung nur Anzeige") | `:39943-39979`, Kommentar "ZWEI KOPPLUNGEN, BEIDE VERTRETBAR" |

**Climbing ist damit bereits erledigt** — es teilt sich den `mengeAusEignung`-Pfad mit Takeshi's
Castle und ist genauso eignungsproportional wie die Arena. E10s eigentliche Luecke betrifft nur
**Feldspiel (Football/Basketball/Hockey), Buehne (sieben Disziplinen) und Zeitfahren (eine
Disziplin)**.

### Warum diese Runde die Luecke audits, aber (noch) nicht alle drei schliesst

`mengeAusEignung` ist kein kostenloser Schalter. Der Code-Kommentar an Climbings eigener
Kalibrierhistorie (`:38278-38288`) zeigt, warum: die Reskalierung `f=eigW/m` wirkt auf **alle**
Sub-Skills eines Spielers gleichzeitig ueber denselben Faktor — ein zusaetzlicher oder schwach
verdrahteter Kanal verduennt dadurch ALLE anderen Kanaele gleichermassen (ein eigener Versuch bei
Climbing, einen neunten GESPUER-Kanal danebenzusetzen, verschlechterte die Pp-Abweichung von 41
auf 47,7 statt sie zu verbessern). Climbings und Staffels Kalibrierung auf die Pp-Schranke war
je ein mehrstufiger Prozess (mehrere PRs, mehrere Rezept-Umschichtungen, am Ende rho-Pruefung
gegen ZWEI unabhaengige Saatstroeme). Dieselbe Sorgfalt braucht eine Aktivierung fuer
Feldspiel/Buehne/Zeitfahren — und bei Feldspiel/Buehne kommt dazu, dass eine Aenderung am
gemeinsamen Chassis SOFORT mehrere Disziplinen gleichzeitig trifft (CLAUDE.md: "Dasselbe
Eignungslücke saß in ALLEN VIER Chassis").

**Was diese Runde bewusst NICHT getan hat:** den `mengeAusEignung`-Schalter fuer Feldspiel,
Buehne oder Zeitfahren blind umzulegen und zu hoffen, dass die bestehenden Rezepte die
Pp-Schranke (≤25, zwei Saatstroeme) weiter halten. Climbings eigene Historie zeigt, dass genau
das NICHT bit-identisch bleibt — eine Aktivierung ohne Nachkalibrierung ist eine neue
Mechanik-Aenderung, keine Formalitaet, und verdient ihre eigene Messrunde mit echten
Vorher/Nachher-Zahlen, nicht eine behauptete.

### Empfehlung fuer die Folgerunde

Reihenfolge nach Risiko, nicht nach Chris' Nennreihenfolge:

1. **Zeitfahren (Time-Trial)** zuerst — eine einzelne Disziplin, kein Chassis, das andere
   Disziplinen mitreisst. Minimaler Codepfad: `mengeAusEignung:true` in `BAHN_ART["time-trial"]`
   setzen (exakt derselbe Schalter, den Climbing/Takeshi schon nutzen), danach dieselbe
   Pp-Messung (`messe-arena-einfluss.mjs time-trial 48`, zwei Saatstroeme) wie bei Climbings
   eigener Kalibrierrunde, plus `miss-alle-disziplinen.mjs 24 time-trial` fuer rho. Baseline
   VOR jeder Aenderung (diese Runde gemessen): rho je Spiel 0,923 (Median, Kaderfamilie),
   Spannweite 0,067; rho Saison 0,902. Die acht Sub-Skills (inkl. `GESPUER`, das keine andere
   Bahn fuehrt) sind bereits gegen die Matrix kalibriert — ob dieselbe Kalibrierung auch nach
   der Reskalierung haelt, ist offen und braucht genau die Messung, die Climbing/Staffel schon
   durchlaufen haben.
2. **Feldspiel** danach — betrifft Football/Basketball/Hockey gleichzeitig, braucht alle drei
   gegengemessen (CLAUDE.md: Feldspiel-Aenderungen immer gegen alle drei teilenden
   Disziplinen pruefen).
3. **Buehne** zuletzt — sieben Disziplinen teilen sich das Chassis, der groesste Radius.

Jede dieser drei Aktivierungen ist eine eigene, mehrstufige Kalibrierrunde (vermutlich mehrere
PRs je Chassis, wie bei Climbing/Staffel), kein Einzeiler — das ist die ehrliche Einordnung
dieser Runde, nicht eine Ausrede.

## Geaenderte/neue Dateien dieser Runde

- `public/mockups/battle-mode.engine.js`: neue, rein additive Messsonde `formEinflussVon()` +
  Export auf `window.__arena.formEinflussVon` — keine Aenderung an Spiellogik, Rezepten oder
  Eignung.
- `scripts/miss-formkarten-jitter-bias.ts`: E9-Jitterbias-Messung (reine TS-Funktion, kein
  Playwright noetig).
- `scripts/miss-formkarten-effekt.mjs`: E9-Spuerbarkeits-Messung ueber die neue Sonde.
- `docs/design/formkarten-eignung-ueberall-14-10.md`: dieses Dokument.

Keine Aenderung an `lib/player-generator/official-discipline-weights.ts` (Eignungsmatrix bleibt
unangetastet) und keine Aenderung an `lib/lineups/legacy-lineup-modifiers.ts` (Jitter bestand die
Pruefung unveraendert).
