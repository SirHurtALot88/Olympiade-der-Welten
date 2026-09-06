# Gewichtheben: Wer hebt im dritten Versuch zuerst? — Befund, drei Ansätze, Empfehlung, Prototyp (06.09.)

Reine Recherche mit fertigem Prototyp-Diff, kein Code auf `main`. Auslöser: die unabhängige
Opus-Review auf PR #820 fand in `hebeUebung()` (`public/mockups/battle-mode.engine.js`, Zeile
10822 ff. auf `origin/main` 8b0fabfa) einen strukturellen Vorteil für die Gastseite. Chris' Haltung
dazu (06.09., wörtlich): „ich finde ich sollte nur fürs balancing da sein und um im nachhinein
mechaniken zu korrigieren wenn sie falsch sind [...] also heißt es sowieso probieren!" — dieses
Dokument liefert deshalb eine Empfehlung mit Messung, keine Frage.

Beilagen im selben Verzeichnis:

| Datei | Inhalt |
|---|---|
| `gewichtheben-duell-reihenfolge-prototyp-06-09.diff` | Der Prototyp, `git apply`-fähig auf `origin/main` 8b0fabfa, geprüft |
| `gewichtheben-duell-reihenfolge-spiegel-06-09.mjs` | Der Spiegeltest (identischer Kader gegen sich selbst, Duell-Sieg-Zählung) |

---

## 0. Ergebnis vorab

1. **Der Bug ist echt, und er ist größer als „Informationsvorteil":** Im Spiegeltest (identischer
   Sechser-Kader gegen sich selbst, 1000 Spiele, Duell-Sieg-Zählung wie `updateHudBuehne`) gewinnt
   der Gast auf #820-Basis **613:125**, bei praktisch gleichen Kilogramm (−0,41 %). Der dritte Versuch
   ist in Gewichtheben DER Ort, an dem ein Duell kippt — und die Gastseite hatte dort immer das
   letzte Wort.
2. **Alle drei geprüften Ansätze heilen den Spiegeltest, keiner bewegt rho.** Zufällige Reihenfolge
   334:335, „wer hinten liegt, hebt zuerst" 347:338, IWF-Regel 349:326 (je 1000 Spiele). Kaderfest
   liegt rho je Spiel bei 0,850 / 0,839 / 0,836 gegen 0,845 vorher — alles innerhalb der Spannweite
   0,21 und weit unter der Disziplin-Schranke 0,067 aus `pruefe-rangtreue-schranke.mjs`.
3. **Empfehlung: die IWF-Regel (Ansatz c).** Beide sagen auf DEMSELBEN Stand an, die leichtere Ansage
   hebt zuerst, die schwerere zuletzt und darf nachziehen; gleiche Ansage entscheidet ein seeded
   Los. Das ist die reale Regel, es ist die Regel, die `buehneQueue` fürs Bühnenbild **schon immer**
   benutzt (Zeile 10813: „hebt, wer die leichtere Last angesagt hat — die reale Regel"), und es
   verteilt das letzte Wort nach Spielstand statt nach Seite. Bild und Rechnung stimmen damit zum
   ersten Mal überein.
4. **Ein zweiter, kleiner Heimvorteil hängt daran und muss mit:** Bei gleichem Zweikampf und gleicher
   Versuchszahl gewann bisher „A", also Heim (Zeile 10802). Wer nur DEN lost, macht es schlimmer
   (36:184 → 28:203), weil er die einzige Gegenkraft zum Gastvorteil entfernt. Der Prototyp ändert
   beides zusammen.
5. **Wichtige Einordnung für die Messung gegen `origin/main`:** Auf `main` OHNE PR #820 bleibt der
   Spiegeltest auch mit Prototyp schief (155:452), weil dort `bauBuehne()` der Gastseite Slot und
   Stufenwert verweigert — das ist der Fehler, den #820 behebt. Erst mit #820 UND diesem Prototyp
   steht Gewichtheben bei 349:326. Die beiden Fixes sind unabhängig voneinander und berühren
   verschiedene Funktionen derselben Datei; der Diff hier wurde auf beiden Ständen angewendet und
   gemessen.

---

## 1. Was genau passiert (Code gelesen, nicht vermutet)

`hebeUebung(a,b,plan,uebung)` rechnet eine Übung (Reißen oder Stoßen) für ein Duellpaar, `a` ist
immer Heim (`side===0`), `b` immer Gast (`baueHebenDuelle`, Zeile 10763 f.). Drei Versuche, in
jedem Versuch beide Heber in fester Reihenfolge:

```js
for(let v=0;v<3;v++){
  for(const u of [a,b]){                       // a = Heim, IMMER zuerst
    const gegner=u===a?b:a;
    let kg=ansage[u.id];
    if(v===2&&beste(gegner)>beste(u)){         // REAKTION AUF DEN DUELLSTAND
      const ziel=Math.round(beste(gegner))+1;
      if(ziel<=max(u)*1.06)kg=Math.max(kg,ziel);
    }
    kg=Math.max(kg,Math.round(beste(u))+(beste(u)>0?1:0));
    ...                                        // p aus TECHNIK/NERVEN/WAGNIS, rr()<p
  }
}
```

**Die einzige Entscheidung, die vom Gegner abhängt, ist die Lastwahl im dritten Versuch**: Wer
hinter dem Gegner liegt (verglichen wird `beste()` dieser Übung, nicht der Zweikampf), zieht auf
dessen beste Last **plus ein Kilo** — sofern das höchstens 6 % über seinem Übungsmaximum liegt.
Risikoabschlag, Nerven, Technik: alles gegnerunabhängig. Die Reaktion ist kein Bug, sie ist das
gewollte „Wechselspiel" aus dem Kommentar; problematisch ist nur, WANN wer sie ausführt.

Weil `a` in `v===2` zuerst dran ist:

| | sieht beim dritten Versuch | kann reagieren auf |
|---|---|---|
| `a` (Heim) | `b`s Stand nach ZWEI Versuchen | `b`s zweiten Versuch |
| `b` (Gast) | `a`s FERTIGES Ergebnis | `a`s dritten Versuch |

Konkret im Spiegelfall (identische Heber, gleiche Ansagen): Liegen beide nach zwei Versuchen
gleichauf und `a` schafft seinen geplanten Sprung (z. B. +4 %), dann zieht `b` nicht seinen eigenen
Sprung, sondern nur **`a`+1 kg** — eine leichtere Last mit höherer Gelingchance — und gewinnt mit
einem Kilo Vorsprung. Reißt `a`, hebt `b` seinen Plan ohne jedes Risiko-Nachziehen. `a` hat in
keinem der beiden Fälle eine Antwort. Gemessen (300 Spiele, #820-Basis): die Reaktion greift in
34 % aller dritten Versuche, und in **80 % dieser Fälle ist es der Zweite, der reagiert**.

Dazu der zweite Punkt, Zeile 10802:

```js
else if(a.zweikampf>0)sieger=a.versucheBis<=b.versucheBis?a:b;   // Gleichstand: A
```

Gleicher Zweikampf UND gleiche Versuchszahl → Heim gewinnt. Im Spiegeltest ist das nicht selten
(8,8 % der Duelle enden kg-gleich), im echten Spiel seltener, aber es ist derselbe Fehlertyp:
Seite statt Spiel.

### 1.1 Was der Diagnosezähler noch sagt

Für die Abwägung habe ich in einer Mess-Fassung des Motors mitgezählt (300 Spiele, #820-Basis):

| Modus | Reaktion in 3. Versuchen | davon durch den Zweiten | Sieg des zuletzt Hebenden | kg-Gleichstand |
|---|---:|---:|---:|---:|
| fest (heute) | 34,3 % | 79,6 % | 64,3 % — und das ist immer der Gast | 8,8 % |
| zufall | 34,3 % | 79,7 % | 57,6 % | 17,4 % |
| hinten zuerst | 34,9 % | 60,1 % | 63,5 % | 15,7 % |
| IWF | 34,9 % | 59,6 % | 64,2 % | 15,6 % |

Die Zeile **zufall** beziffert den reinen Wert des letzten Worts: 57,6 : 42,4 — ein Vorteil von rund
15 Punkten je Duell, den heute strukturell der Gast bekommt. Unter „hinten zuerst" und IWF hebt
in der Regel der Führende zuletzt; dass der dann 64 % gewinnt, ist nicht mehr der Reihenfolge
geschuldet, sondern seinem Vorsprung. Gelingquote gesamt (84,9 %), im dritten Versuch (73 %) und
Nullwertungen (0,1 %) bleiben in allen Modi identisch — die Reihenfolge verändert nicht, wie
schwer gehoben wird, nur wer wann weiß, was der andere tat.

---

## 2. Drei Ansätze

### a) Zufällige Reihenfolge je Duell und Übung (seeded)

`reihe = rr()<0.5 ? [a,b] : [b,a]` vor dem dritten Versuch. Zwei Zeilen, deterministisch über die
Saat.

- Für: kleinstmöglicher Eingriff, Erwartungswert exakt symmetrisch (334:335 gemessen).
- Gegen: **jedes einzelne Duell bleibt einseitig**, nur weiß man vorher nicht, zu wessen Gunsten.
  Ein Los, das entscheidet, wer das letzte Wort hat, hat im Sport kein Vorbild; und es
  widerspricht dem Bühnenbild, das die leichtere Ansage zuerst zeigt — der Ticker würde dann
  regelmäßig einen Heber „a+1 kg" ansagen lassen, BEVOR a gehoben hat. Das ist der heutige
  Zustand mit anderem Vorzeichen.

### b) Wer nach zwei Versuchen hinten liegt, hebt zuerst; Gleichstand per Los

`reihe = beste(a)<beste(b) ? [a,b] : beste(b)<beste(a) ? [b,a] : los()`.

- Für: symmetrisch (347:338), realistische Dramaturgie: der Verfolger legt vor, der Führende muss
  antworten. Das letzte Wort ist verdient, nicht verlost.
- Gegen: es ist eine **Näherung** der realen Regel, keine Regel. Sie ordnet nach dem Stand, nicht
  nach der Ansage — und die Ansage ist es, die auf der Bühne die Reihenfolge macht. In den
  Fällen, in denen der Verfolger den Konter nicht in Reichweite hat (Deckel 106 %) und deshalb
  weniger ansagt als der Führende plant, ergibt sich dieselbe Reihenfolge wie bei c); in den
  seltenen Fällen, in denen der Verfolger mehr ansagt als der Führende (Führender mit sehr
  kleinem Sprung, Verfolger mit großem Plan), dreht sich die Reihenfolge gegenüber dem Bild.
  Kein großer Unterschied in Zahlen (0,839 gegen 0,836), aber ein zweiter Regelsatz neben dem,
  der `buehneQueue` schon regiert.

### c) Die IWF-Regel: leichtere Ansage zuerst, Gleichstand per Los — EMPFOHLEN

Beide Heber bestimmen ihre Last für den dritten Versuch auf demselben Stand (nach zwei Versuchen,
inklusive Reaktion). Die leichtere Ansage hebt zuerst. Wer zuletzt hebt, rechnet seine Last nach
dem Ausgang des Ersten neu — und weil die Reaktionsformel nie unter die geplante Ansage geht,
ist das ein Nachziehen nur nach oben, wie im echten Wettkampf (Änderung der Ansage bis zum Aufruf,
nur aufwärts). Gleiche Ansage: Los, seeded über `rr()` — im Sport die Losnummer der Wiegung.

- Für: die reale Regel (IWF TCRR, Reihenfolge nach angesagter Last); exakt die Regel, mit der
  `buehneQueue` (Zeile 10813) die Heber fürs Bühnenbild schon sortiert — Bild und Rechnung
  stimmen künftig überein, der Ticker zeigt nie mehr eine Reaktion auf etwas, das noch nicht
  passiert ist; das letzte Wort fällt an den, der mehr wagt, typischerweise den Führenden;
  symmetrisch (349:326, Duelle 3035:2965 = 50,6 %).
- Gegen: sechs Zeilen mehr als a); rho im Rahmen des Rauschens minimal unter b) (0,836 gegen 0,839
  auf #820, 0,885 gegen 0,887 auf `main`) — nicht von Null unterscheidbar.

### d) Verworfen: gleichzeitige Ansage ohne Nachziehen

Beide entscheiden auf dem Stand nach zwei Versuchen, niemand zieht nach. Vollständig symmetrisch,
kein Los nötig — aber es streicht genau das, was der Kommentar „Wechselspiel" nennt: die Antwort
auf den dritten Versuch des anderen. Nicht gemessen, weil es die gewollte Mechanik halbiert statt
sie fair zu machen.

---

## 3. Messung

Alle Zahlen auf `origin/main` 8b0fabfa (06.09., nach #821) und auf dem Kopf von PR #820
(`claude/buehne-symmetrie-fix-06-09`, 0b580097). Kaderfest: `node scripts/miss-alle-disziplinen.mjs
24 gewichtheben`, Kaderfamilie live-save (fünf Paarungen, 110 Spieler). Spiegeltest: Beilage
`...-spiegel-06-09.mjs`, N=1000, Saaten 100000+977·i.

### 3.1 Spiegeltest (H:G:Unentschieden, 1000 Spiele; Duelle H:G von 6000)

| Stand | Spiele H:G:U | Duelle H:G | kg-Abweichung |
|---|---:|---:|---:|
| `main` heute | 64:638:298 | 2236:3764 | −0,43 % |
| `main` + Prototyp | 155:452:393 | 2625:3375 | −0,41 % |
| #820 heute | 125:613:262 | 2189:3811 | −0,41 % |
| **#820 + Prototyp** | **349:326:325** | **3035:2965** | **+0,06 %** |

Die Restschiefe auf `main` + Prototyp ist der `bauBuehne`-Fehler aus #820 (Gast ohne Slot und
Stufenwert, sichtbar an −0,41 % kg, die der Prototyp gar nicht anfasst). Alle drei Ansätze auf
#820 (je 1000): zufall 334:335:331, hinten 347:338:315, IWF 349:326:325.

### 3.2 Kaderfeste Rangtreue (rho je Spiel, Median über fünf Kader; Spannweite in Klammern)

| Stand | fest (heute) | zufall | hinten | **IWF** |
|---|---:|---:|---:|---:|
| `main`, jeSeite 6 | 0,887 (0,224) | — | — | **0,885 (0,218)** |
| #820, jeSeite 6 | 0,845 (0,210) | 0,850 (0,221) | 0,839 (0,225) | **0,836 (0,215)** |
| `main`, jeSeite 4 | 0,760 (0,253) | — | — | 0,761 (0,251) |
| `main`, jeSeite 2 | 0,850 (0,414) | — | — | 0,806 (0,451) |

rho Saison: 0,944 → 0,944 (`main`), 0,930 → 0,930 (#820). Jede Bewegung liegt unter der
Disziplin-Schranke 0,067 und weit unter der Spannweite. Zwei Anmerkungen, ehrlich: jeSeite 4 liegt
heute wie danach unter 0,80 (vier Teilnehmer je Seite, 0,760 vorher) — nicht dieser Änderung
geschuldet, aber ein Widerspruch zu `gewichtheben-zufriedenstellend.md`, das „≥ 0,80 bei 6, 4 UND 2"
festhielt; jene Zahl entstand vor der kaderfesten Messung (03.09.). Und jeSeite 2 ist mit vier
Teilnehmern je Spiel ein Rang über vier Elemente, Spannweite 0,45 — die Differenz 0,850/0,806 ist
dort kein Signal.

### 3.3 Nachweis, dass der Diff nichts sonst verändert

Die Mess-Fassung (Schalter `window.__hebenReihenfolge`, Diagnosezähler) und der saubere Prototyp
liefern auf beiden Ständen **identische** Spiegel- und rho-Zahlen (349:326:325 / 0,885 / 0,836) —
der Prototyp konsumiert `rr()` an exakt denselben Stellen wie die Mess-Fassung im Modus IWF.
`node --check` sauber; `git apply --check` gegen `origin/main` 8b0fabfa sauber; auf #820-Kopf
0b580097 ebenfalls sauber angewendet (verschiedene Funktionen, keine Hunk-Überschneidung).

---

## 4. Der Prototyp (Kern; vollständig in der `.diff`-Beilage)

Zwei Stellen in `public/mockups/battle-mode.engine.js`, beide in `baueHebenDuelle`/`hebeUebung`.

**hebeUebung — Lastwahl als Funktion, Reihenfolge des dritten Versuchs nach Ansage:**

```js
    const lastFuer=(u,v)=>{
      const gegner=u===a?b:a;
      let kg=ansage[u.id];
      if(v===2&&beste(gegner)>beste(u)){          // REAKTION AUF DEN DUELLSTAND, unveraendert
        const ziel=Math.round(beste(gegner))+1;
        if(ziel<=max(u)*1.06)kg=Math.max(kg,ziel);
      }
      return Math.max(kg,Math.round(beste(u))+ (beste(u)>0?1:0));
    };
    for(let v=0;v<3;v++){
      let reihe=[a,b];
      if(v===2){
        const ka=lastFuer(a,v), kb=lastFuer(b,v);   // beide auf DEMSELBEN Stand
        reihe=ka<kb?[a,b]:kb<ka?[b,a]:(rr()<0.5?[a,b]:[b,a]);
      }
      for(const u of reihe){
        const kg=lastFuer(u,v);                     // der Zweite liest den frischen Stand
        ...                                         // Rest unveraendert
```

**baueHebenDuelle — Gleichstand per Los statt „A":**

```js
      else if(a.zweikampf>0)sieger=a.versucheBis!==b.versucheBis
        ?(a.versucheBis<b.versucheBis?a:b):(rr()<0.5?a:b);
```

Was der Diff NICHT ändert: die Reaktionsformel (+1 kg, Deckel 106 %), die Erfolgswahrscheinlichkeit,
die Ansage-/Sprunglogik, `buehneQueue` (die brauchte die Regel nie erst), `spieleBuehneHeben`,
Anzeige und Ticker. Der erste und zweite Versuch laufen weiter als `[a,b]` — dort reagiert
niemand, die Reihenfolge ist folgenlos; ich habe sie bewusst nicht mit umgestellt, damit der Diff
ausschließlich die Stelle anfasst, an der Information fließt.

Übernahme: `git apply docs/design/gewichtheben-duell-reihenfolge-prototyp-06-09.diff` auf
`origin/main`, dann `node --check public/mockups/battle-mode.engine.js` und
`node scripts/miss-alle-disziplinen.mjs 24 gewichtheben` (Erwartung 0,885 ± Rauschen). Falls #820
zuerst gemergt wurde, gilt der Diff unverändert (geprüft auf 0b580097).

---

## 5. Was für den Umsetzer und für Chris offen bleibt

1. **Reihenfolge der Merges ist egal, aber beide müssen rein.** Ohne #820 heilt dieser Prototyp den
   Spiegeltest nur zur Hälfte (155:452); ohne diesen Prototyp bleibt #820 bei 125:613. Gewichtheben
   ist über `ARENA_RESOLVED_DISCIPLINE_IDS` bereits produktiv; sobald ein Battle-Mode-Save
   existiert, wären beide Schieflagen echte Spieler-PPs.
2. **PPS-Referenz neu ziehen.** `data/generated/gewichtheben-pps-referenz.json` wurde in #820 gegen
   den dortigen Stand gezogen; nach diesem Diff einmal `ziehe-gewichtheben-pps-referenz.ts` gegen
   das live-save-Abbild wiederholen (Erwartung: Median praktisch unverändert, weil die
   Kilogramm-Verteilung nicht angefasst wird — aber die Datei trägt `motorSha1`).
3. **Basislinie:** `rangtreue-basislinie.json` führt Gewichtheben mit 0,887; der Diff liegt bei
   0,885. Keine Neuziehung nötig.
4. **Balancing-Frage an Chris, ohne Dringlichkeit:** Das letzte Wort ist unter der IWF-Regel rund
   15 Punkte wert (Abschnitt 1.1) und fällt meist an den Führenden. Wenn Chris den Verfolger
   stärken will, ist der Hebel nicht die Reihenfolge, sondern der Deckel 106 % in der Reaktion
   (Zeile 10855) — eine Zahl, kein Umbau. Ich empfehle, ihn vorerst zu lassen: die Gelingquote im
   dritten Versuch (73 %) liegt ohnehin über dem im Motor-Kommentar genannten Zielkorridor 50–63.
5. **Seit der Messung an Gewichtheben geändert?** Auf `origin/main` liegt seit `d2ced4fe` (#818)
   kein Commit, der `battle-mode.engine.js` berührt; #820 ist zum Zeitpunkt dieses Dokuments offen
   und auf 0b580097 geprüft. Wer den Diff später übernimmt, prüft mit `git log --oneline -3 --
   public/mockups/battle-mode.engine.js`, ob dazwischen etwas an `hebeUebung`/`baueHebenDuelle`
   passiert ist.
