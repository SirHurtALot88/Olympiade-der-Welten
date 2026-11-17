# Strategie-Pilot HYROX: Taktik im Rennen anpassen — Konzept (17.11.)

**Reines Konzept.** Kein Code, keine Flagge, keine Messung, nichts bestellt. `engine.js` meint
`public/mockups/battle-mode.engine.js` auf `main` `b1d13b23` (Pilot Wettessen gemergt); alle
Zeilennummern sind dort nachgeschlagen. Alle Parameterwerte sind **Startwerte für die
Kalibrierung**. Zahlen zu rho und Pp stammen aus `data/generated/disziplin-abnahme.json`
(Eintrag `spurt-mischung`, 16.11.), `data/generated/rangtreue-basislinie.json`
(`zusatzmessungen.spurt-hyrox`), `spurt-ci-schutz-16-11.md` und
`spurt-format-hyrox-stationen-08-11.md`.

**Disziplin:** Chris hat korrigiert: gemeint war **HYROX** — weder Hockey noch „High Rocks“. HYROX ist das Spurt-Format
`spurtFormat:"hyrox"` (Chassis `bauSpurt`, Hook `baueHyroxStationen()`/`stepSpurtHyrox()`). Der
erste Entwurf zu Hockey steht knapp als Anhang A.

Bezug: `strategie-templates-16-11.md` (Datenmodell, Rohr, Abschnitt 9 Pilot Wettessen),
`kontakt-persoenlichkeit-16-11.md` (Regler kb/ha/di/aw, `pMin`, Kosten, Kriterium N; Schritt 1b
Hatz/HYROX), `spurt-format-hyrox-stationen-08-11.md` (Formel, Kalibrierung),
`spurt-hyrox-routen-design-opus-09-11.md` (Fahrplan, Hallenrunde), `spurt-ci-schutz-16-11.md`,
`fable-kontakt-interaktionen-16-11.md` Abschnitt 7 (FM-Recherche Q33–Q38).

---

## 0. Kurzfassung

1. **Chris meint zwei Ebenen.** (A) Eine grobe Taktikwahl wie im Football Manager, deren
   Wirkung **genau** erklärt wird. (B) **Eingriffe während des Rennens**, die das **Verhalten**
   der Läufer über ihre Persönlichkeits-Regler verschieben. Beides ist nicht „Push/Schonen“. Dort
   wird Saison-Ausdauer gegen Zusatzwert getauscht.
2. **Der wichtigste Code-Befund:** Ein HYROX-Rennen wird heute **vollständig vor dem Start
   ausgewürfelt**. `hyroxScore()` (`engine.js:51786`) zieht vier `rr()`-Würfe je Läufer (Lauf,
   Technik, Klettern, Kraft). Daraus entsteht `u.hyroxZeit = max(6, 26 − 0,165·score)`
   (`:52009`). Der Fahrplan (`hyroxFahrplan()` `:51879`) verteilt diese Zeit nur noch zeichnerisch
   auf Lauf, Roxzone und Station. Es gibt **keine Entscheidung im Rennen, keine Einteilung, keine
   Persönlichkeit und keinen Kontakt**. Für die Taktik heißt das zweierlei:
   - (a) Jede Taktik braucht eine kleine neue Mechanik.
   - (b) Ein Zuruf mitten im Rennen ist **reine Arithmetik auf den schon gewürfelten Teilzeiten**.
     Er zieht keinen einzigen neuen `rr()`-Wurf. Die gefürchtete Zufallskaskade (Hockey) gibt es
     hier nicht, und vorgerechnete Äste für eine echte Live-Wahl kosten Millisekunden.
3. **Puffer:** HYROX liegt bei rho je Spiel **0,895** (Saison 0,951, Spannweite 0,077,
   `OLY_FORM_MODUS=echt`, 16.11.). Das ist reichlich über der Mindestschranke 0,75 und dem Ziel
   0,80; bis −0,03 bleibt es über 0,86. **Eng ist Pp:** Gemessen sind **20,2/20,5**, also nur
   ~4,5 Luft bis 25. Diese Zahl stammt vom 08.11., aus der Zeit vor der Budget-Konservierung des
   Spurt-Rezepts (15.11.) und vor den echten Formkarten. Sie ist **nicht frisch** und wird als
   erster Schritt nachgemessen. Die Mischung, die das Spiel spielt (klassisch/Hatz/HYROX, je ein
   Drittel), besteht mit rho 0,873 und Pp 16,5/21,5.
4. **Menü:**
   - Vor dem Rennen zwei Schalter:
     - Renneinteilung: Stationsrennen · Gleichmäßig · Läuferrennen
     - Umgang mit Konkurrenten an den Stationen: Platz machen · Normal · Ellbogen
   - Im Rennen **zwei Zuruf-Fenster**, nach Runde 1 und nach Runde 2, je **ein** Zuruf: Ruhig
     bleiben · Sauber bleiben · Lücke nehmen · Jetzt laufen! · Kräfte für die Station.
   - Neu dafür ist **der Stau an den Stationen**: begrenzte Bahnen je Station, Warten,
     Drängeln, HYROX-Strafzeit. Er ist die Interaktion, die Chris will, und zugleich der
     Gegnerbezug, der den Knopf-Test bestehbar macht.
5. **Gezeigt = gebucht:**
   - Zunächst ein Zuruf-Plan (Wenn-dann, vorab) und echte Chips in der Battle Arena.
   - Danach, weil billig: die echte Wahl im Zuschauen. Der Motor rechnet alle Äste (höchstens
     6 × 6 = 36) in **einem** Vorlauf mit.
   - Gebucht wird der gewählte Ast. Ob die Buchung zeitlich nach dem Zuschauen liegen kann, ist im
     Code noch zu prüfen.
6. **Wettessen-Pilot:** Die Kette behalten (sie ist bewiesen), den Wettessen-Eintrag **nicht
   freischalten** (Knopf-Test durchgefallen). Kein Entfernen.

---

## 1. Was Chris gemeint hat

### 1.1 Die zwei Ebenen

| Ebene | Chris, wörtlich | Was gebaut würde |
|---|---|---|
| **A — Taktik grob wählen** | „so wie bei Football Manager, wo ich grob meine Taktik auswählen kann. Und da muss dann aber auch nochmal genau erklärt werden, wie sich das dann auswirkt“ | Zwei Schalter mit je drei Stufen in der Einsatzliste. Je Stufe ein **Wirkungskasten mit Zahlen**: was sich wie stark ändert, wofür man zahlt, wem im eigenen Kader es nützt (2.5) |
| **B — im Rennen, auf die Persönlichkeit** | „was in-game haben, was sich auf die Persönlichkeit quasi ein bisschen auswirkt oder auf das, wie die Spieler agieren“ | **Zurufe** in zwei festen Fenstern. Sie verschieben die Kontakt-Regler (kb, ha, di, aw, `pMin`) bzw. die Einteilung für den Rest des Rennens. Wie stark ein Läufer folgt, hängt an seiner Persönlichkeit und an seinen Traits (2.4). Nie Stats |

### 1.2 Abgrenzung zu „Push/Schonen“ — bei HYROX besonders heikel

Die Intensität ist ein **Wert-Kanal**. `INTENSITAET` (`engine.js:9210`) addiert −2,5/0/+4 auf die
Breitpunkte (`breitPunkteVon` `:9277`) und kostet 1/3/4 Grundermüdung für die Saison
(`lib/lineups/matchday-slot-roles.ts:91-93`). Kurz: mehr Leistung jetzt, weniger Ausdauer später.

Eine **Renneinteilung** klingt gefährlich ähnlich („schneller anlaufen“). Sie wird deshalb an
vier Regeln gebunden:

| Regel | Umsetzung |
|---|---|
| **Nullsumme im Rennen, nicht über die Saison** | Was eine Einteilung auf den Läufen gewinnt, kostet sie an den Stationen und umgekehrt. Für einen Läufer mit **Liga-Median-Profil** ist sie im Erwartungswert zeitneutral (kalibriert, 2.2). Saison-Ermüdung, Breitpunkte und `eig` werden nicht berührt |
| **Wer gewinnt, hängt am Profil, nicht an der Stärke** | Das Läuferrennen nützt Läufern mit großem Laufanteil (ANTRITT/ENDTEMPO) und gutem STEHEN. Das Stationsrennen nützt WUCHT/ROBUST-Profilen. Der Gesamtbeste gewinnt mit keiner der Einteilungen automatisch. Das ist die Mehrwege-Leitlinie |
| **Gegnerbezug** | Über den Stau (2.3): Laufen beide Teams Läuferrennen, kommen alle gleichzeitig an die Station und warten |
| **Stat-Test** (Prüffrage 26.10.) | Ließe sich die Wirkung als „+x auf Attribut y“ schreiben, wäre es keine Taktik. Die Einteilung verschiebt **Zeit zwischen Abschnitten**, nicht Attribute |

Die Intensität bleibt die Kraft-Reihe vor dem Rennen und ist im Rennen nicht änderbar. Keine
Taktik-Option heißt „Vollgas“ oder „Push“.

**Ehrlich benannt:** Weil HYROX eine reine Zeitformel ist, ist jede Einteilung technisch eine
Umverteilung der Gewichte `HYROX_W` (`:51783`) je Läufer. Die Leitplanke dagegen ist gemessen,
nicht behauptet: Pp ≤ 25 **je Vorlage einzeln** und der Knopf-Test.

---

## 2. Das HYROX-Menü

### 2.1 Was der Motor heute hat

| Baustein | Fundstelle | Stand |
|---|---|---|
| Zielzeit | `hyroxScore()` `:51786`, `u.hyroxZeit` `:52009`, `HYROX_W={pace:.40, technik:.20, kletter:.20, kraft:.20}` `:51783`, Rauschen 18 % | vier `rr()`-Würfe je Läufer beim Bau, festgehaltene Teilwerte `u.hyroxTeile` |
| Fahrplan | `hyroxFahrplan()` `:51879`, Anteile `HYROX_ANTEIL_ROX/ZONE/ARBEIT = 0,30/0,10/0,60` `:51829`, `hyroxZustand()` | zerlegt die Zeit bitgleich in Lauf-, Roxzone- und Stationsabschnitte, ohne Wurf |
| Hallenrunde | `HYROX_WEG`, drei Laufrunden mit je einem Roxzone-Ausflug (Technik → Klettern → Kraft) | gebaut |
| Wertung | `MOTOREN.spurt.wert()`, aufsteigend nach `u.fertig = u.hyroxZeit` | Platz je Läufer |
| Formatwahl | `spurtFormatWaehlen()` `:50409`, Hash der Saat, je ein Drittel | **die App kennt das Format nicht** (nur `lib/foundation/discipline-scenes.ts` als Kulisse) |
| Kontakt-Regler | `kontaktProfil()` `:8097`, `KONTAKT_BASIS` `:8066`, `KONTAKT_PMIN_JE_HALTUNG` `:8077`, eigener Strom `kontaktRr` `:8155`, Zähler in WeakMap; Bahn-Kontakt Stufen 1–3 (`KONTAKT_BAHN`, nur Spurt klassisch, hinter Flagge) | Schritt 0 und 1 gebaut. **HYROX liest nichts davon**, weil `stepSpurtHyrox()` den Rempler-Block von `stepSpurt` umgeht |
| Team-Vorlage ohne Feld am Läufer | `STRATEGIE_VORLAGEN`, WeakMap `strategieVorlageKF` `:20654-20656` | nur Wettessen |

### 2.2 Ebene A1: Renneinteilung

| | **Stationsrennen** (defensiv) | **Gleichmäßig** | **Läuferrennen** (offensiv) |
|---|---|---|---|
| Was die Läufer tun | Sie laufen kontrolliert und kommen frisch an die Stationen | wie heute | Sie laufen schnell und kommen „compromised“ an die Stationen (echtes HYROX-Phänomen: nach schnellem Lauf leidet die Station) |
| Motor | in `hyroxFahrplan()`/Zielzeit: Laufbudget ×(1+a), Klettern+Kraft ×(1−b·s) | Feld fehlt, keine Zeile gelesen | Laufbudget ×(1−a), Klettern+Kraft ×(1+b·s) |
| Startwerte | a = 0,06; b so kalibriert, dass ein Läufer mit Median-Profil zeitneutral ist; `s = 1,4 − STEHEN/100` (wer durchhält, zahlt weniger) | — | wie links |
| Preis | Zeitverlust auf den Läufen, der Gegner führt nach der Laufrunde | — | Stationen dauern länger; Stau, wenn der Gegner dasselbe macht (2.3) |
| Gut, wenn | der Kader WUCHT/ROBUST-lastig ist und der Gegner schnell anläuft (die Stationen sind dann voll, wenn die eigenen kommen — man kommt danach) | — | der Kader ANTRITT/ENDTEMPO-lastig ist und STEHEN hoch ist; der Gegner läuft ruhig an (die Stationen sind frei) |
| Schlecht, wenn | gegen einen ruhigen Gegner und mit Läufer-Profilen | — | mit Kraftprofilen und niedrigem STEHEN; gegen einen Gegner, der ebenfalls Läuferrennen läuft |
| Pp-Hinweis | hebt WUCHT/ROBUST (power, health, torment) | — | hebt ANTRITT/ENDTEMPO **und STEHEN** (STEHEN trägt `will`, heute −4,4 Pp unter Matrix): kann Pp sogar verbessern, muss gemessen werden |

**Persönlichkeit:** Wie stark ein Läufer die Einteilung umsetzt, hängt an seiner Haltung
(`PERSDEF.h`). wild (Draufgänger) ×1,25, ausgewogen ×1,0, vorsichtig ×0,8, defensiv ×0,7.
Der Draufgänger übertreibt im Läuferrennen, das Bollwerk bleibt auch dort fast gleichmäßig. Das
ist deterministisch und ohne Wurf.

### 2.3 Neue Mechanik: Stau an den Stationen (Grundlage für A2 und die Zurufe)

Heute laufen zwölf Läufer durch dieselben sieben Stationen, ohne sich je zu begegnen. Echtes
HYROX hat je Station eine begrenzte Zahl Geräte (Schlitten-Bahnen, SkiErgs). Vorschlag:

- **Bahnen je Gruppe:** Technik 4 · Klettern 3 · Kraft 4 (Startwerte) für 12 Läufer.
- **Ankunft:** Der Fahrplan liefert die Ankunft je Läufer an jeder Station, deterministisch und
  ohne Wurf. Sind alle Bahnen belegt, **wartet** der Läufer, bis eine frei wird. Die Wartezeit
  kommt zur Zielzeit hinzu. Abgearbeitet wird in Ankunftsreihenfolge, als einfache Warteschlange
  ohne Zufall.
- **Drängeln (Kontakt):** Wer wartet, kann versuchen, sich vorzudrängeln.
  - **Ob er es versucht:** `kb` und Aussicht `p = WUCHT/(WUCHT+ROBUST_Gegner)` ≥ `pMin`; der Wurf
    für die Versuchsneigung kommt aus `kontaktRr`.
  - **Der Gegner antwortet nach `aw`:** Er weicht aus (lässt durch, kleiner Preis) oder hält
    dagegen (ROBUST-Duell).
  - **Gelungen:** Er nimmt die nächste freie Bahn vor dem Verdrängten.
  - **Fehlgeschlagen:** Mini-Stun 0,3 s plus längere Abklingzeit.
  - **Foul:** Wahrscheinlichkeit `f0·(ha/50)·((100−di)/50)`. Es gibt eine **HYROX-Strafzeit**
    (Startwert 1,0 s; echtes HYROX kennt Zeitstrafen der Kampfrichter) und eine Gutschrift für
    den Verdrängten.
  - **Formeln und Schutzregeln:** dieselben wie der Bahn-Kontakt Stufe 1–3 (`KONTAKT_BAHN`).
    Wiederverwendet wird also, nicht neu erfunden.
- **Keine Wirkung auf die vier Würfe.** Stau und Drängeln addieren nur Zeit oder sortieren die
  Warteschlange um. Die `rr()`-Folge bleibt unberührt, alle neuen Würfe kommen aus `kontaktRr`.
- **Abweichung vom Kontakt-Konzept:** Dort hieß es „in HYROX Kontakt nur auf den Laufstücken“.
  Ich schlage **Kontakt an den Stationen** vor. Dort drängelt man im echten HYROX, und die Läufe
  sind dort kontaktarm. Das ist eine Entscheidung für Chris (Frage 2).
- **Das ist Kontakt-Schritt 1b für HYROX.** Er verändert HYROX für **alle** (auch neutral) und
  braucht eine eigene Abnahme und einen eigenen Fingerabdruck-Bruch, **bevor** die Vorlage A2
  irgendetwas bewirken kann. Ohne Stau wäre A2 ein toter Knopf.

### 2.4 Ebene A2: Umgang mit Konkurrenten an den Stationen

Die Team-Verschiebung der Kontakt-Regler nach `kontakt-persoenlichkeit-16-11.md` Abschnitt 7:

| | **Platz machen** | **Normal** | **Ellbogen** |
|---|---|---|---|
| Regler | kb −15, `pMin` eine Haltungsstufe vorsichtiger, ha −10, aw +15 | 0 (Persönlichkeit wie sie ist) | kb +15, `pMin` eine Stufe mutiger, ha +10, aw −15 |
| Was die Läufer tun | Sie warten in der Schlange, weichen aus, kassieren keine Strafen | wie die Persönlichkeit es will | Sie drängeln vor, halten dagegen, gehen hart rein |
| Preis | Wartezeit an vollen Stationen | — | Strafzeiten (1,0 s je Foul), Mini-Stun beim Fehlversuch |
| Gut, wenn | der Kader disziplinlos ist (Draufgänger, `Renegade`, `Cheater`) oder schwache WUCHT hat; die Stationen sind wenig voll | — | Kader mit hoher WUCHT und hoher Disziplin (Bollwerk, Beschützer); volle Stationen (beide Teams im Läuferrennen) |
| Schlecht, wenn | die Stationen voll sind (man wartet am längsten) | — | gegen standfeste Gegner (hohe ROBUST) und mit Foul-Typen |

### 2.5 Ebene B: Zurufe

**Zwei feste Fenster** (natürliche Unterbrechung = Roxzone-Eintritt):

- Fenster 1 nach Laufrunde 1, vor Klettern.
- Fenster 2 nach Laufrunde 2, vor Kraft.

Je Fenster **ein** Zuruf. Er gilt für jeden eigenen Läufer **ab seinem nächsten
Roxzone-Eintritt** bis ins Ziel und ersetzt einen früheren Zuruf. Alles wird auf 5…95 geklemmt.

| Zuruf | Verschiebung | Wirkung im Motor | Preis | Gut bei | Schlecht bei |
|---|---|---|---|---|---|
| **Ruhig bleiben** | kb −10, `pMin` +1 Stufe | weniger Drängelversuche, mehr Warten | Wartezeit | nach einer Strafe, in Führung | volle Station, im Rückstand |
| **Sauber bleiben** | di +20, ha −5 | Fouls deutlich seltener, Drängeln weicher | weniger Ertrag je Drängeln | nach Strafen, mit Draufgängern | mit einem ohnehin sauberen Kader (fast wirkungslos) |
| **Lücke nehmen** | kb +15, `pMin` −1 Stufe | mehr Drängelversuche | Fehlversuche, Strafen | volle Kraftstation, im Rückstand | gegen ROBUST-starke Gegner |
| **Jetzt laufen!** | Einteilung eine Stufe Richtung Läuferrennen, nur für die verbleibenden Abschnitte | Restläufe schneller, Reststationen langsamer | Kraftstation am Ende teurer | Läuferprofile, freie Stationen | Kraftprofile, volle Stationen |
| **Kräfte für die Station** | eine Stufe Richtung Stationsrennen | Restläufe ruhiger, Kraft/Klettern schneller | Rückstand auf dem Lauf | Kraftprofile vor der Kraftstation | Läuferprofile |

**Wie die Persönlichkeit antwortet** (deterministisch, aus `kontaktProfil()` und `PERSDEF.h`):

| Typ (`KONTAKT_BASIS`) | Ruhig bleiben | Sauber bleiben | Lücke nehmen | Jetzt laufen! |
|---|---|---|---|---|
| **Draufgänger** (kb 90, ha 85, di 30, wild) | drängelt weiter am meisten (kb 80) | di 50, bleibt foulanfällig | an der Klemme 95, kaum mehr | übertreibt (×1,25) |
| **Bollwerk** (kb 25, di 75, vorsichtig) | drängelt nicht mehr | kaum Wirkung | kb 40, selten, aber sauber und erfolgreich | setzt nur ×0,8 um |
| **Beschützer** (kb 50, di 70, defensiv, Schutz) | ruhiger | wenig Wirkung | drängelt vor allem gegen den, der einen Mitspieler verdrängt hat | ×0,7 |
| **Schleicher** (kb 50, aw 90) | kaum Änderung | kaum | etwas mehr; weicht als Ziel weiter aus | ×0,8 |
| **Opportunist** (kb 70, di 40) | weniger Nachsetzen | merklich weniger Fouls | jagt die Gestolperten | ×1,0 |
| **Duellant** (kb 55, di 60) | mittel | mittel | sucht den Stärksten | ×1,0 |

**„Kann nach hinten losgehen“ (FM-Muster Q34), ohne Wurf:**

- Läufer mit `Renegade`, `Feisty` oder `Diva` setzen „Ruhig bleiben“ und „Sauber bleiben“ nur zur
  Hälfte um. `Disciplined`/`Cool` setzen sie voll um.
- `FiredUp` setzt „Lücke nehmen“ und „Jetzt laufen!“ zu 150 % um, geklemmt.
- Der Wirkungskasten nennt die Betroffenen beim Namen.

### 2.6 Wann eingegriffen wird (kein Mikromanagement)

| Zeitpunkt | Erlaubt |
|---|---|
| Vor dem Rennen (Einsatzliste) | Renneinteilung, Umgang; Intensität wie bisher (bleibt fest) |
| Fenster 1 (nach Runde 1) | **ein** Zuruf |
| Fenster 2 (nach Runde 2) | **ein** Zuruf |
| sonst | nichts |

Rennlänge zur Einordnung: eine Zielzeit von ~18–19 Sim-s ergibt bei `ZEIT_DEHNUNG.spurt=11,14`
(`engine.js:56416ff.`) rund 3,5 Minuten Zuschauzeit. Zwei Eingriffe in 3,5 Minuten sind genug.

---

## 3. Technische Machbarkeit

### 3.1 Was vom Wettessen-Pilot wiederverwendet wird

| Glied | Fundstelle | Für HYROX |
|---|---|---|
| Datenmodell | `LineupDraftModifierSide.strategie?`, `.zurufPlan?`, `LineupZurufAnlass` (`lib/data/olyDataTypes.ts:3889-3906`) | `strategie` als zusammengesetzte Kennung je Kombination (z. B. `"laeufer+ellbogen"`), damit Adapter, Hash und Umschlag unverändert bleiben. `LineupZurufAnlass` bekommt HYROX-Anlässe: `nach_runde1_hinten/vorn`, `nach_runde2_hinten/vorn`, `eigene_strafe` |
| Katalog | `lib/lineups/strategie-vorlagen.ts` | Eintrag `spurt` mit Format-Sperre `nurFormat:"hyrox"`; neu: `wirkungsKennzahlen` (3.4) |
| Rohr | `buildArenaStrategieBeide()` | unverändert; `zurufPlan` im selben Umschlag |
| Eingabe-Hash, Vorlauf, Node-Runner | `berechneArenaEingabeHash()`, `bereiteFixturesVor()` | `zurufPlan` mit in den Hash |
| Messschalter | `--strategie=` in `scripts/lib/rangtreue-messung.mjs` | in `miss-spurt-hyrox-rangtreue.mjs` und `messe-spurt-hyrox-einfluss.mjs` nachziehen; neu `--zuruf=spurt:<fenster>:<zuruf>` |
| Motor-Muster | `STRATEGIE_VORLAGEN`, WeakMap | `STRATEGIE_VORLAGEN.spurt.hyrox`; je Läufer ein WeakMap-Eintrag `{vorlage, zuruf, profil}`. Die Zeitbudgets liegen schon in `u.hyroxTeile`/`u.hyroxPlan` (bestehende Felder) |
| Einsatzliste | Zeile „Spielweise“ `LineupNewLook.tsx:1721-1775` | zwei Knopfreihen und Zuruf-Plan, **nur wenn das Format des Spieltags HYROX ist** |

**Neu und nötig:** Die App muss das Format **vor** dem Rennen kennen. Heute entscheidet allein der
Motor per `kulisseHash("spurt-format|"+saat)`. Entweder wird der Hash nach TS portiert und ein
Test hält beide gleich, oder der Vorlauf meldet das Format zurück. Ohne das kann die Einsatzliste
die HYROX-Taktik nicht anbieten. Sonst bleibt nur der Hinweis „gilt, falls HYROX gelost wird“.

### 3.2 Gezeigt = gebucht

**Warum HYROX hier einfach ist:** Alle `rr()`-Würfe fallen beim Bau. Ein Zuruf rechnet nur die
**restlichen** Abschnitte neu, und Stau oder Drängeln ziehen nur aus `kontaktRr`. Bis zum Fenster
ist jedes Rennen bitgleich. Es muss **kein** Spiel neu simuliert werden.

**Stufe 1 — Zuruf-Plan (Wenn-dann, vorab).** Das ist Empfehlung 1 vom 17.11.:

```
Fenster 1:  eigenes Team nach Runde 1 hinten → Lücke nehmen     · vorn → Ruhig bleiben
Fenster 2:  hinten → Jetzt laufen!                               · vorn → Kräfte für die Station
            nach eigener Strafe (jederzeit) → Sauber bleiben
```

„Hinten/vorn“ = Summe der Plätze der eigenen Läufer am Fenster, deterministisch aus dem Fahrplan.
Gezeigt wird der Zuruf als Ereignis („Trainer ruft: LÜCKE NEHMEN!“, Schwebetext wie
`rennplanAnsagen`). Ohne Plan läuft das Rennen neutral. **KI-Teams** bekommen bis zur Abnahme
keinen Plan, danach eine feste Regel aus Kaderprofil und Lage.

**Battle Arena (Testwerkzeug, `nurZuschauen` aus):** echte Chips an den zwei Fenstern, ohne
Buchung.

**Stufe 2 — echte Wahl beim Zuschauen im Saisonspiel.** Der Vorlauf rechnet in **einem**
Motorlauf alle Äste des eigenen Rennens mit. Bei 5 Zurufen plus „nichts“ sind das 6 × 6 = 36
Endzeiten-Sätze, nur Arithmetik, Millisekunden. Die Anzeige hält am Fenster kurz an (nur die
Wiedergabe, nicht die Simulation). Der Manager wählt, die Anzeige folgt dem Ast, gebucht wird der
gewählte Ast. Wer nicht zuschaut, bekommt den Ast seines Zuruf-Plans.

**Noch zu prüfen:**
- (a) ob die Buchung (`resolveMatchdayPreviewToBook`, `lib/foundation/matchday-resolve-snapshot.ts`)
  **nach** dem Zuschauen liegen kann. Laut Kopf von `arena-headless-runner.ts` läuft der Vorlauf
  automatisch im Hintergrund;
- (b) der Eingabe-Hash muss den Ast-Satz decken.

### 3.3 Neu im Motor (nur HYROX, hinter Vorlage bzw. Kontakt-Flagge)

1. `STRATEGIE_VORLAGEN.spurt.hyrox = {einteilung:{…}, umgang:{…}, zurufe:{…}, fenster:[…]}`, eine
   Tabelle mit allen Zahlen aus 2.2–2.5.
2. **Einteilung:** eine Umrechnung der vier Teilbudgets nach `hyroxScore()` und vor
   `u.hyroxZeit`. Ohne Vorlage greift ein früher Ausstieg: `u.hyroxZeit` ist dann Zeichen für
   Zeichen der alte Ausdruck. `hyroxFahrplan()` bleibt die Verteilerfunktion.
3. **Stau und Drängeln** (Kontakt 1b, eigene Flagge `BAHN_ART.spurt.kontakt.hyrox`): ein
   Ereignislauf über Ankünfte und Bahnen, nach `baueHyroxStationen()`. Er läuft vollständig beim
   Bau, und die Zielzeit steht danach wieder fest. Der Fahrplan bekommt Warteabschnitte (Figur
   steht in der Roxzone), die Arbeitsposen bleiben die vorhandenen.
4. **Zurufe:** `hyroxAstZeit(u, z1, z2)` rechnet die Restabschnitte ab dem Fenster neu; die Äste
   liegen in einer WeakMap.
5. **Zähler** in `kontaktZaehlerMap`: Wartezeit, Drängelversuche, gelungen, Strafen, Zeitgewinn
   auf Läufen und Verlust an Stationen. Daraus entsteht die Bilanz im Endstand („Läuferrennen:
   −2,1 s auf den Läufen, +1,6 s an den Stationen; Lücke nehmen: 4 Versuche, 3 gelungen,
   1 Strafe“).
6. `window.__arena.strategieKatalog()` für den Test in 3.4.

Keine neue PixelLab-Pose: Warten = `walk` im Stand bzw. die vorhandene Pose, Drängeln =
`angriff` über `lungeVis`, Mini-Stun und Sturz = gekippte `treffer`-Pose (Behelf aus dem
Kontakt-Konzept 5.2), Strafe = Schwebetext und Ton.

### 3.4 Die Erklärung im UI lügt nie

| Teil | Beispiel | Quelle |
|---|---|---|
| Regel (was der Motor tut) | „Läufe −6 %, Klettern und Kraft +x % (weniger bei hohem STEHEN); Drängeln ab 45 % Aussicht; Strafzeit 1,0 s“ | Platzhalter im TS-Text, gefüllt aus `strategieKatalog()`; ein Test hält Katalog und Motor-Tabelle deckungsgleich (Muster `tests/strategie-vorlagen-wettessen.test.ts`) |
| Gemessene Wirkung | „im Mittel: Wartezeit 0,4 → 1,1 s je Läufer · Drängeln 1,2 → 3,0 je Rennen · Strafen 0,1 → 0,4“ | `data/generated/strategie-wirkung-hyrox.json` vom Messskript (Kaderfamilie) mit `motorHash` und Parameter-Echo; ein Test wird rot, wenn beides nicht mehr zum Motor passt |
| Euer Kader im Spiegel | „profitiert: Mira, Jo (Läuferprofil, STEHEN hoch) · verliert: Haldor (Kraftprofil) · Foul-Risiko: Krag'Zul“ | dieselben Formeln wie der Motor (Sub-Skills ANTRITT/ENDTEMPO/STEHEN/WUCHT/ROBUST aus dem echten Kader), ein gemeinsames Modul (Muster `battle-mode.rezepte.js`) |

Gezeigt werden Mechanik, Verhaltenszahlen und Richtung je Läufer (▲/▼), aber **keine
Zeitprojektion in Sekunden** und kein Rang. Denn bei HYROX *ist* die Zeit das Ergebnis, und eine
Sekunden-Summe würde die Wahl zum Rechenknopf machen (Frage 3).

### 3.5 Aufwand und Bau-Reihenfolge

| Schritt | Inhalt | Wertung | Aufwand |
|---|---|---|---|
| **X0** | HYROX nachmessen (rho und Pp, `OLY_FORM_MODUS=echt`, zwei Ströme): die Pp-Zahl 20,2/20,5 ist vom 08.11. | Messung | S (Minuten Rechenzeit) |
| **X1** | Gerüst: Katalog `spurt`/hyrox, Format in der App bekannt machen, Lesestellen ohne Wirkung, WeakMap, Messschalter, Zuruf-Plan im Umschlag und Hash | Fingerabdruck identisch | S–M (2–3 Tage) |
| **X2** | Renneinteilung (Vorlage A1) samt Persönlichkeits-Faktor; Zurufe „Jetzt laufen!“ und „Kräfte für die Station“ | Messung je Stufe und Zuruf | M (3 Tage) |
| **X3** | Stau und Drängeln = Kontakt-Schritt 1b HYROX (eigene Flagge, eigene Abnahme, eigener Fingerabdruck-Bruch beim Scharfschalten) | Mechanik für alle | M (3–4 Tage) |
| **X4** | Vorlage A2 (Umgang) und die drei Kontakt-Zurufe; Zuruf-Plan; Live-Chips in der Battle Arena | Messung | M (2–3 Tage) |
| **X5** | Einsatzliste: zwei Reihen, Zuruf-Plan, Wirkungskasten, Bilanz im Endstand | Anzeige | M (3 Tage) |
| **X6** (optional) | Echte Wahl beim Zuschauen über die vorgerechneten Äste | Buchungsfluss | M (3–5 Tage, nach Prüfung a/b). Bei HYROX deutlich billiger als bei Hockey, weil die Äste nur Arithmetik sind |

**Summe X0–X5: rund zweieinhalb Wochen.** Die Messungen sind billig. Die HYROX-Sonden laufen je
Sekunden bis eine halbe Minute (`spurt-ci-schutz-16-11.md`), anders als die Pp-Pools von Hockey
mit je 4 h. **X2 liefert schon allein Ebene A und B ohne Kontakt** und ist damit der kleinste
spielbare Pilot. X3 bringt die Interaktion.

**Abhängigkeiten:** Einsatzlisten-Revamp #1358 (berührt `LineupNewLook.tsx`). Die Kontakt-Runde
Spurt klassisch (Schritt 1, gebaut, nicht scharf) liefert die Formeln für X3. Hatz-Pp (Einzelformat
um 25) ist ein eigenes Thema und nicht Teil dieses Piloten.

### 3.6 Messplan

| Prüfung | Werkzeug | Kriterium |
|---|---|---|
| **Neutralität, Pflicht zuerst** | `node scripts/pruefe-wertung-fingerabdruck.mjs` | Flagge aus **und** Feld fehlt/`null`: `GESAMT e80babacb68c (75 Einträge)`. Insbesondere HYROX 1/7/42 `7e454d5b8508 e45fd6c3f140 249ab52fcfef` und Hatz unverändert. Test „nur Spurt/HYROX betroffen“ |
| rho je Option, beide Seiten gleich, dann gemischt | `OLY_FORM_MODUS=echt node scripts/miss-spurt-hyrox-rangtreue.mjs 48 --strategie=…`, kaderfest, gepaart gegen neutral | ≥ 0,865 (Ist 0,895 − 0,03), harte Schranke 0,75, Ziel > 0,80; gepaarte Differenz in ≥ 4 von 5 Kadern innerhalb −0,03 |
| Mischung | `OLY_FORM_MODUS=echt node scripts/miss-spurt-mischung.mjs 24 --je-format` und `--pp=48` | Mischung bleibt rho ≥ 0,843, Pp ≤ 25 |
| Pp je Option | `node scripts/messe-spurt-hyrox-einfluss.mjs 192 0` und `… 192 10000000` mit `--strategie` | ≤ 25 auf beiden Strömen **je Vorlage einzeln** (Puffer nur ~4,5!), Ziel < 15, nie auf Kosten von rho. Blick auf `dexterity` (+4,8) und `will` (−4,4) |
| Star und Paartreue | `scripts/miss-star-paartreue.mjs` | Star auf Rang 1 höchstens 5 Pp schlechter; Paare ≥ 15 Punkte höchstens 1 Pp |
| Knopf-Test | Muster `scripts/miss-wettessen-mauer.mjs`; Lagen = Kader × Gegner-Kader × Gegner-Vorlage | jede Option in ≥ 20 % der Lagen die beste, keine in > 60 %; die beste hängt stärker am Profil (Laufanteil, STEHEN, WUCHT) und an der Gegnerwahl als an `eig`. Beim Wettessen fiel genau das durch: neutral war in 86,7 % die beste Wahl |
| Verhalten (6.2) | Zähler aus 3.3 Punkt 5 | ≥ 0,5 SD in die versprochene Richtung |
| Neutralität der Persönlichkeit (Kriterium N) | `window.__arena.kontaktPersZwang(...)` | gleiche Leistung je Typ bei gleicher Eignung, eps² steigt nicht |
| Stau/Kontakt (X3) | Kontakt-Kriterien A–V, D0 | Kontaktanteil an der Streuung < 15 %; Kontaktsaldo korreliert ≥ 0 mit Eignung; Häufigkeit im Korridor |
| Zurufe | jeder Zuruf an Fenster 1 und Fenster 2, fest | wie rho/Pp |
| Spiegel | Heim:Gast | nahe 50:50 |

**Abbruchregel, vorab:** Reißt eine Option ein Kriterium, wird sie schwächer gebaut oder
gestrichen. Die Schranke wird nicht verschoben. Wenn die dritte Stufe nicht besteht, sind auch
zwei Stufen erlaubt (Freigabe 17.11.). Fällt der Stau (X3) durch, geht der Pilot mit X2 allein in
Produktion: Einteilung und Lauf-Zurufe, dann ohne Kontakt-Zurufe.

---

## 4. Was mit dem Wettessen-Pilot passiert

**Empfehlung: lassen, nicht freischalten, nicht entfernen.**

- **Die Kette bleibt:** Einsatzliste → Entwurf → Eingabe-Hash → Vorlauf (Chromium und Node) →
  Arena → Messschalter → Tests. HYROX nutzt genau diese Kette (3.1).
- **Der Wettessen-Eintrag wird nicht freigeschaltet.** Der Knopf-Test fiel durch (Strategie-Konzept
  9.3): Die KI-Haltung optimiert dort schon je Esser, und es gibt keinen Gegnerbezug. Der Katalog
  bekommt beim Scharfschalten von HYROX ein Feld „freigegeben“; Wettessen steht darauf auf aus.
- **Die Lehre für HYROX** ist eingebaut: Neutral ist dort **keine** je Läufer optimierte
  KI-Wahl, sondern eine einheitliche Einteilung. Und über den Stau gibt es einen Gegnerbezug.

---

## 5. Offene Fragen an Chris

1. **Bewusst eine neue Mechanik?** Ein HYROX-Rennen steht heute vor dem Start fest, ohne
   Entscheidung im Rennen. Jede Taktik braucht deshalb eine kleine neue Mechanik (Einteilung,
   Stau). **Empfehlung: ja.** Zuerst die Einteilung (X2) als kleinster spielbarer Pilot, dann der
   Stau (X3).
2. **Kontakt an den Stationen statt auf den Laufstücken?** Die Stationen hätten begrenzte Bahnen,
   dazu Warten, Drängeln und eine HYROX-Strafzeit. Das ändert HYROX für alle Rennen, nicht nur bei
   gewählter Taktik. **Empfehlung: ja**, als Kontakt-Schritt 1b mit eigener Abnahme. Im echten
   HYROX drängelt man an den Geräten, nicht beim Laufen.
3. **Wie genau darf die Erklärung werden?** Mechanik-Zahlen, Verhaltenszahlen und eine
   ▲/▼-Markierung je Läufer, aber keine Sekunden-Projektion. **Empfehlung: ja.** Bei HYROX *ist*
   die Zeit das Ergebnis, und eine Sekunden-Summe machte die Wahl zum Rechenknopf.
4. **Echte Wahl beim Zuschauen, oder nur der vorab gesetzte Zuruf-Plan?** **Empfehlung: zuerst
   Plan und Live-Chips in der Battle Arena (X1–X5), danach die echte Wahl (X6).** Bei HYROX kostet
   sie nur Arithmetik; sie hängt aber daran, ob die Buchung nach dem Zuschauen liegen darf.
5. **Sollen Persönlichkeiten unterschiedlich folgen?** Gemeint ist zweierlei: Der Draufgänger
   übertreibt die Einteilung, das Bollwerk bleibt gleichmäßig. Und `Renegade`/`Feisty`/`Diva`
   setzen Ruhe-Zurufe nur halb um, `FiredUp` setzt Druck-Zurufe zu 150 % um. **Empfehlung: ja.**
   Das ist deterministisch, erklärbar und genau „wirkt auf die Persönlichkeit“.

---

## Anhang A — Alternative Hockey (erster Entwurf, knapp)

Der erste Entwurf ging von „High Rocks“ = Hockey aus. Das Menü dort:

- Spielstil: Riegel · Ausgewogen · Forecheck (`hockeyRiegelKlaert` `:12572`, Reichweite und
  Schussuhr je Seite).
- Zweikampf: Sauber · Normal · Hart (Kontakt-Regler im Bodycheck `versucheSteal` `:15886`,
  `HK_FOUL_ANTEIL` `:12415`).
- Zurufe in den Drittelpausen (`starteViertelpause` `:14535`).

Gegen Hockey als Pilot sprechen drei Dinge:

- **Puffer:** rho je Spiel 0,700 liegt unter der Mindestschranke 0,75 und gilt nur per
  Ausnahme; Feldspieler allein 0,784; Pp-Pool 2 = 21,8.
- **Zufallskaskade:** Jede Verhaltensänderung verschiebt die Zahl der `versucheSteal`-Aufrufe und
  damit die ganze `rr()`-Folge.
- **Messkosten:** etwa 4 h Pp-Rechenzeit je Option.

Hockey bleibt der natürlichste Kandidat für Forecheck gegen Riegel, sobald dort Puffer da ist.
Die Kette und der Wirkungskasten aus diesem Papier wären dann ohne Änderung wiederverwendbar.

---

## Quellen

`public/mockups/battle-mode.engine.js` (Zeilen wie angegeben, `main` `b1d13b23`) ·
`lib/lineups/strategie-vorlagen.ts` · `lib/foundation/battle-arena/arena-strategie-adapter.ts` ·
`lib/data/olyDataTypes.ts:3876-3906` · `lib/lineups/matchday-slot-roles.ts:13,91-93` ·
`lib/foundation/discipline-scenes.ts:86-90` · `lib/battle/arena-headless-runner.ts` (Kopf) ·
`lib/battle/arena-eingabe-hash.ts` · `app/foundation/legacy-lineup-lab/LineupNewLook.tsx:1662-1775` ·
`data/generated/disziplin-abnahme.json` (`spurt`, `spurt-mischung`) ·
`data/generated/rangtreue-basislinie.json` (`zusatzmessungen.spurt-hyrox`) · die Konzeptpapiere
oben.
