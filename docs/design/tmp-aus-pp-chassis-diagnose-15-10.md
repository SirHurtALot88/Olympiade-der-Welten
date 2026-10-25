# TMP/AUS-Pp-Chassis: verifizierte Geschichte, Mechanismus, geprüfte Alternativen (15.10.)

**Reines Diagnose-Dokument, kein Code in `public/mockups/battle-mode.engine.js` geändert.**
Auftrag: prüfen, ob die in `docs/design/battlefield-domination-konzept-14-10.md` Abschnitt 1 als
„offen/unfertig" dargestellte TMP/AUS-Pp-Reparatur am Arena-Chassis tatsächlich noch zu bauen ist,
oder ob sie — wie der Code-Kommentar in `aufEignung()` nahelegt — schon gebaut, gemessen und
bewusst zurückgenommen wurde. Ergebnis vorweg: **zurückgenommen, mit verifizierbaren Zahlen, und
aus einem Grund, der seitdem mehrfach unabhängig bestätigt wurde.** Es gibt keinen neuen, sicheren
Fix. Die ehrliche Antwort ist eine Entscheidung für Chris, keine weitere Codezeile.

---

## 1. Die Geschichte — verifiziert, nicht nur gelesen

### 1.1 Wo der Fund tatsächlich entstand

Die Behauptung „schon gebaut und zurückgenommen" lässt sich nicht an einem einzelnen Commit-Diff
nachvollziehen — der Grund ist technisch, nicht inhaltlich: `public/mockups/battle-mode.engine.js`
wurde am **25.08.2026** (Commit `1bf63a36`, „Battle Arena Phase 1-3") aus der bis dahin
monolithischen `battle-mode.html` in eine eigene Datei aufgeteilt; `git log -S` auf diese Datei
zeigt den Kommentarblock deshalb dort zuerst, als vermeintlich „neu hinzugefügt". Die eigentliche
Fundstelle ist **Commit `84ede2e3`, „Arena: 18 von 20 Disziplinen auf vier Motoren …" (PR #656,
24.08.2026 10:03, squash-gemergt aus mehreren Teil-Commits)** — bestätigt per
`git log --all -S "ZURUeCKGENOMMEN" -- public/mockups/battle-mode.html`, das nach einem vollen
`git fetch --unshallow` (der Checkout war ursprünglich flach, auf 268 Commits begrenzt) genau diesen
einen Treffer liefert. Die squash-Commit-Message selbst enthält die volle Versuchsgeschichte als
Abfolge von Teil-Commit-Botschaften — das Testen-und-Zurücknehmen geschah **innerhalb** dieses
einen PRs, nicht über mehrere PRs hinweg.

### 1.2 Die Zahlen — exakt bestätigt, dreifach

Dieselben Pp-Zahlen stehen an drei unabhängigen Stellen identisch:

| Quelle | TDM ohne Kappung | TDM mit Kappung |
|---|---:|---:|
| Squash-Commit-Message `84ede2e3` (24.08.) | 152,4 Pp | 83,7 Pp |
| Code-Kommentar `aufEignung()`, Zeile 6606–6626 (heutiger Stand) | 152,4 Pp | 83,7 Pp |
| `docs/BATTLE_ARENA_UEBERGABE.md` Zeile 750–776 (Übergabe-Tabelle) | 152,4 Pp | 83,7 Pp |

und für die übrigen drei Arena-Disziplinen übereinstimmend: Mini-DM 13,8→14,0 Pp (praktisch
unverändert — Mini-DM hat kein unbepreistes Attribut in TMP/AUS), Fechten 87→39 Pp, Battlefield
110→101,7 Pp.

**Korrektur an der Aufgabenstellung: Fechten ist seit dem 03.09. nicht mehr betroffen.** Die
Aufgabenstellung nennt „TDM, Mini-DM, Fechten und Battlefield" als die vier Nutzer des geteilten
Arena-Duell-Chassis — das war zum Zeitpunkt des 24./25.08.-Fundes richtig, ist es heute nicht mehr.
Fechten wechselte am 03.09. komplett auf das Bühne-Chassis (`docs/design/tennis-fechten-rollout-
plan.md`, Code-Kommentar bei `battlefield:{` in `battle-mode.engine.js`: „Fechten ist real ein
1-gegen-1-Gefecht … Fechten AUSGEZOGEN … Entfernt statt nur ergänzt"). `aufEignung()` und damit die
TMP/AUS-Lücke betreffen Fechten seit diesem Wechsel nicht mehr — bestätigt durch
`lib/battle/arena-resolved-disciplines.ts`, wo Fechten als einzige der vier genannten Disziplinen
bereits produktiv live ist (`ARENA_RESOLVED_DISCIPLINE_IDS`, Zeile 156), während der Kommentar
direkt darüber Battlefield/TDM/Mini-DM namentlich als „ACHSE 1 fehlt — sie bestehen ihre eigene
Abnahme nicht" ausschließt. **Nur noch drei Disziplinen tragen den TMP/AUS-Befund:
TDM, Mini-DM, Battlefield.**

### 1.3 Der Kampf-Befund — ebenfalls bestätigt, mit einer Korrektur am Rahmen

`docs/BATTLE_ARENA_UEBERGABE.md` (Abschnitt „Das Ventil — geschlossen, dann wieder aufgemacht",
Zeile 750ff.) bestätigt wortgleich mit dem heutigen Code-Kommentar: mit dem Heiler-Fix aus #654
gewinnt **V-W** (Chris' eigenes Team „Vigilante Wranglers", Team-ID `V-W`, der reale, im Mockup
hartkodierte `SQUAD`) gegen **A-A** („Armageddon Aftermath", `OPP`) TDM zu 100 % mit gestreuten
Ergebnissen (6:0 neunmal, 6:2 fünfmal, 6:1 viermal, Rest knapper). Mit der TMP/AUS-Kappung
obendrauf: 96 % Siegquote, aber 23 von 24 Kämpfen exakt 6:0.

**Eine Präzisierung gegenüber der Aufgabenstellung:** V-W ist nicht das „bekannt schwächere" Team im
Sinne der Eignung — die Team-Eignungssummen liegen nur 8,8 % auseinander (V-W 379,3 gegen A-A
348,7, V-W also sogar etwas *höher*). Die 100-%-Siegquote selbst hat eine andere, unabhängig
dokumentierte Ursache: A-A stellt zwei Heiler von sechs Slots, V-W keinen einzigen, und ein Heiler
bezahlt in diesem Motor jede Aktion exklusiv mit seiner Heil-Uhr („entweder angreifen oder heilen,
nie beides", `fuehreAus()`) — A-A verliert dadurch strukturell zwei Sechstel seiner Offensive. Das
ist ein **separater, bereits identifizierter, bewusst nicht an dieser Stelle zu behebender Befund**
(„die 100-%-Quote nach dem Heiler-Fix ist der nächste offene Punkt, den #654 schon benennt" — Zitat
aus dem Code-Kommentar). Was die TMP/AUS-Kappung tatsächlich verändert hat, ist **nicht**, wer
gewinnt (100→96 %, kaum verschoben), sondern **wie**: aus einer gestreuten Serie von Punktabständen
wurde eine fast reine Blowout-Serie. Das ist der eigentliche, von der Kappung verursachte Schaden —
und er ist unabhängig davon real, welches Team als „stärker" gilt.

**Fazit Abschnitt 1:** Die Geschichte ist echt, nicht missverstanden. Die Zahlen stimmen exakt. Die
einzige Korrektur ist eine Nuance am Rahmen (V-W ist nicht die schwächere Seite, sondern die durch
einen anderen, unabhängigen Mechanismus begünstigte), die an der Kernaussage — Kappung einbauen
macht die *Verteilung* der Ergebnisse unrealistisch schmal — nichts ändert.

---

## 2. Der Mechanismus — warum Kappung Blowouts erzeugt, nicht nur Zahlen ändert

### 2.1 Was `aufEignung()` tut

```js
function rohKraft(s){ return (s.LP*(1+s.VER/100))*(s.ANG/50); }
function aufEignung(s,eig){
  const roh=rohKraft(s); if(roh<=0)return s;
  const referenz=rohKraft({LP:75,VER:60,ANG:70});
  const ziel=referenz*(eig/KRAFTMITTE);
  const mit=(f)=>rohKraft({LP:s.LP*f,VER:s.VER*f,ANG:s.ANG*f});
  let lo=0.05,hi=8;
  for(let i=0;i<40;i++){const m=(lo+hi)/2; if(mit(m)<ziel)lo=m;else hi=m;}
  const f=(lo+hi)/2;
  // o.LP, o.ANG, o.VER werden alle mit demselben f skaliert — TMP/AUS NICHT.
}
```

`f` ist ein binär gesuchter Skalierungsfaktor, der **LP, ANG und VER gemeinsam** so streckt oder
staucht, dass die resultierende `rohKraft` (grob: Überlebenszeit × Schadensausstoß) exakt dem Ziel
entspricht, das die matrixgewichtete Eignung vorgibt. Die REZEPTE (welches der zwölf Attribute wie
stark in LP/ANG/VER einfließt) bestimmen nur noch die **Form** (zäh vs. schlagkräftig), die
**Menge** kommt allein aus der Eignung. Das ist eine bewusste, an anderer Stelle im Code
dokumentierte Reparatur eines echten Konstruktionsfehlers (zwei widersprüchliche Gewichtungen
derselben zwölf Attribute, s. Kommentar „EINE GEWICHTUNG, NICHT ZWEI" direkt über `aufEignung()`).

TMP und AUS durchlaufen **dieselben Rezepte** (`TMP:{speed:46,dexterity:24,...}` etc.), werden aber
von `f` nicht erfasst. Ein Attribut mit Matrixgewicht 0 (Speed/Dexterity in TDM), das nur in
TMP/AUS steht, trägt deshalb mit seinem vollen Rohwert zum Kampf bei, ohne dass die
Eignungs-Normierung es je sieht oder dagegenrechnet — ein Gewinn **erster Ordnung**, exakt wie der
Code-Kommentar sagt.

### 2.2 Was TMP/AUS stromabwärts tatsächlich bewirken

Grep auf `.TMP`/`.AUS` in der Kampfschleife zeigt zwei konkrete Verbraucher:

- **Bewegungsgeschwindigkeit** (`KARTEN_SPD.fuss + u.TMP*KARTEN_SPD.je`, Zeile 33953): TMP ist
  direkt die Marschgeschwindigkeit in px/s. Wer schneller ist, erreicht sein Ziel früher, wechselt
  die Position häufiger, entkommt eher einem Fokus-Feuer.
- **Abklingzeit-Kürzung**, `cdKuerzung(u)=0.30*u.TMP/(u.TMP+120)` (Zeile 32668), gesättigt bei 30 %:
  TMP erhöht die Schlagfrequenz. **Das ist seit dem 04.09. eine bewusste, von Chris persönlich
  angeordnete Design-Entscheidung** („mach die Schlagfrequenz vom Tempo abhängig", wörtlich,
  dokumentiert in `docs/design/arena-tempo-schlagfrequenz.md`) — eine ausdrückliche Rücknahme einer
  noch früheren eigenen Entscheidung („schau, dass Tempo nicht den Angriff beschleunigt"). Der Code
  markiert das explizit als „keine offene Frage mehr, sondern eine getroffene Entscheidung".
- **AUS** speist den Skill-Vorrat (Ausdauer-Vorrat fürs Casting) und einen Ermüdungsfaktor ab
  Sekunde 35 (`fat=t>35?Math.max(0.55,1-(100-u.AUS)*0.0011*(t-35)):1`, Zeile 33741): niedriges AUS
  lässt Bewegung/Effektivität im späten Kampf auf bis zu 55 % einbrechen, hohes AUS hält die volle
  Leistung.

### 2.3 Warum das compoundiert — und warum Kappung die Varianz killt, nicht nur die Mittelwerte verschiebt

TMP/AUS sind keine additiven Boni, sondern **Multiplikatoren über die Zeit**: schneller ankommen
heißt früher im Gefecht sein, öfter zuschlagen heißt über 120 Sekunden Kampfzeit kumulativ deutlich
mehr Schaden, und Ermüdungsresistenz heißt, dass dieser Vorteil in der zweiten Kampfhälfte nicht
wegschmilzt. Ein Team, dessen Kämpfer zufällig (aus Rezept + Form + Trait, nicht aus Eignung)
überdurchschnittlich viel Speed/Dexterity/Stamina abbekommen haben, kann diesen compoundierenden
Vorteil nutzen, **unabhängig davon, wie die Eignungssumme beider Teams aussieht**. Das ist exakt
die „Bewegungsfreiheit", die der Code-Kommentar meint: nicht reine Zufallsstreuung, sondern ein
echter, spielbarer Kanal, über den eine KI (oder ein Spieler) ein knappes Match offenhalten oder
drehen kann, der aber **nicht** an der Eignung hängt.

Normiert man TMP/AUS auf dieselbe Eignung wie LP/ANG/VER, verschwindet dieser Kanal nicht nur im
Mittel, sondern **vollständig**: jedes Team bekommt exakt die Bewegungsgeschwindigkeit und
Schlagfrequenz, die seine Eignungssumme vorschreibt — keine Varianz mehr übrig, über die ein
knappes Match zustande kommt. Die beiden Teams unterscheiden sich danach nur noch in der Form
(wer zäher, wer schlagkräftiger ist), nicht mehr in Tempo. Bei einem Team mit höherer
Eignungssumme (wie V-W, +8,8 %) heißt das: dieser kleine, aber reale Vorsprung wirkt jetzt **über
jeden einzelnen Kampfwert gleichmäßig**, statt sich durch zufällig verteiltes Tempo/Ausdauer mal zu
verstärken, mal zu neutralisieren — das Ergebnis wird deterministischer, nicht ausgeglichener.
Daher 23 von 24 Kämpfen exakt 6:0 statt einer gestreuten Serie.

**Zusätzlich bestätigt, unabhängig von TDM:** Die Persönlichkeits-Runde vom 07.10.
(`docs/design/arena-zielwahl-opus-empfehlung-02-10.md`, Abschnitt 10.3) hat denselben Mechanismus
ein zweites Mal, an Battlefield, live vorgeführt — ohne `aufEignung()` überhaupt anzufassen. Ein
Schritt, der die KI eignungstreuer zielen ließ, hob rho (Saison-Validität 0,31→0,76-0,81), aber
weil die Zielwahl-Logik stärker über Awareness/Intelligence läuft und beide **auch** TMP speisen,
sprang deren gemessener Pp-Anteil in einem Saatstrom von 40,0 % auf 67,7 % — **die Mechanik wurde
nach Eignung besser, aber aus Kanälen, die außerhalb der Normierung liegen, also aus den falschen
Gründen.** Das ist derselbe strukturelle Fehler wie bei TDM, nur diesmal mit matrixgewichteten statt
mit Matrixgewicht-0-Attributen — ein Beleg dafür, dass das Problem nicht „falsche Attribute im
Rezept" ist, sondern die fehlende Normierung selbst.

---

## 3. Geprüfte Alternativen

### 3.1 Messungs-seitiger Fix (dedizierte Zwillings-Sonde) — GEPRÜFT UND VERWORFEN

Vorbild: `einflussVonMitSlot`/`einflussVonSandsackFinale` (Football-QB-Slot, Gewichtheben-Finale) —
dort korrigiert eine zweite Sonde einen **Aufbaufehler der Blindmessung selbst** (der QB-Slot wird
in `einflussVon()`s generischem Aufbau nie gesetzt, deshalb sieht die Blindmessung einen Bonus, der
im echten Spiel real ist, nur unter realistischen Vorbedingungen). Geprüft, ob derselbe Kniff hier
passt: **nein.** `einflussVon()` hebt ein Attribut testweise an und lässt die Eignung korrekt
mitwachsen (das war selbst ein behobener Messfehler, s. Commit `84ede2e3`, Teil „Der Maßstab war
falsch"). Was gemessen wird, ist seitdem exakt das, was das Spiel auch tut: ein höheres Speed/
Dexterity erhöht TMP in `rezeptVon()`, und TMP erhöht in **derselben** Kampfschleife, mit der auch
echte Spiele laufen, Marschgeschwindigkeit und Schlagfrequenz — bestätigt unabhängig durch die
Chris-angeordnete Tempo-Schlagfrequenz-Kopplung (Abschnitt 2.2) und durch die Battlefield-
Persönlichkeits-Runde (Abschnitt 2.3), die denselben Effekt **im echten Kampf**, nicht nur in der
Sonde, zeigt. Es gibt hier keinen Sonden-Aufbaufehler zu korrigieren — die Sonde zeigt korrekt einen
echten, ungepreisten Kanal der Mechanik. Eine „korrigierte" Zwillings-Sonde, die TMP/AUS aus der
Pp-Abweichung herausrechnet, würde nicht einen Messfehler beheben, sondern einen echten Befund
wegmessen — das widerspräche dem Zweck der Pp-Pflicht aus CLAUDE.md direkt.

### 3.2 Teil-Normierung / weicher Clamp — EMPIRISCH GEPRÜFT (s. Abschnitt 4)

Ein Mischfaktor alpha (0 = unverändert, 1 = die zurückgenommene volle Normierung), angewandt nur
auf TMP/AUS, wurde in einer isolierten Worktree gebaut und gegen die reale Kampf-Score-Verteilung
(nicht nur gegen Pp) bei mehreren Zwischenwerten gemessen — Ergebnis in Abschnitt 4.

### 3.3 Rezept-Korrektur (TMP/AUS auf matrixgewichtete statt Matrixgewicht-0-Attribute umstellen) —
BEREITS MEHRFACH VERSUCHT, FÜR TDM ERSCHÖPFT, FÜR BATTLEFIELD/MINI-DM TEILWEISE ERFOLGREICH, ABER
STRUKTURELL BEGRENZT

- **Mini-DM und Battlefield sind bereits vollständig umgestellt** (`ARENA_ART["mini-dm"].rezept.TMP
  = {dexterity:40,stamina:32,torment:28}`, `ARENA_ART.battlefield.rezept.TMP =
  {awareness:36,intelligence:34,charisma:30}` — beide Zeilen tragen nur noch Attribute mit echtem
  Matrixgewicht, Zeile 6749/6844). Das hat Mini-DMs Pp von 115 auf 55,6/43,9 gesenkt (Nachtrag
  07.10., `stand-aller-disziplinen.md`) — ein echter, messbarer Fortschritt, aber **keine Lösung**:
  Mini-DM bleibt über der 25-Pp-Schranke, weil die Kappung selbst (nicht nur die Attributwahl) fehlt.
  Für Battlefield hat derselbe Schritt die Pp-Zahl nicht gesenkt (s. Abschnitt 2.3) — er hat nur
  verschoben, WELCHE (jetzt matrixgewichteten) Attribute den unbepreisten TMP-Kanal ausnutzen.
  **Das zeigt: die Rezept-Korrektur behebt das Symptom (welches Attribut profitiert), nicht die
  Ursache (dass TMP/AUS kategorisch außerhalb jeder Normierung liegen).**
- **TDM wurde bereits viermal auf Rezeptebene umgebaut und jedes Mal verworfen** — dokumentiert im
  Code selbst (`ARENA_ART.tdm`-Kommentar, `engine.js:6690-6696`): voller Neubau (168 Pp,
  schlechter), gezielte Korrektur (83 Pp, schlechter als das spätere Ergebnis), zwei ANG/VER-
  Varianten (114,5 und 58,9 Pp bei n=6, bei n=12 ununterscheidbar von `REC.power`s 54,2 Pp). TDMs
  eigener Rezeptkommentar (Zeile 5433-5446) dokumentiert außerdem eine bewusste Grenze: Speed/
  Dexterity ganz aus TMP zu entfernen hätte den unbepreisten Anteil von 29,3 auf 16,0 % gesenkt,
  aber „ganz ohne Speed und Dexterity geht es nicht: ein Echtzeitkampf braucht Bewegung und
  Zielgenauigkeit, und die Matrix kennt beides nicht" — eine bewusst unbeantwortete Frage an Chris,
  keine vergessene Aufgabe.

### 3.4 Normierung der CONTRIBUTION statt des vollen Attributs (Floor/Ceiling, Varianz erhalten) —
GEPRÜFT, LÄUFT AUF DASSELBE HINAUS WIE 3.2

Die Idee „TMP/AUS normieren, aber mit einem Band breit genug, um die Varianz zu erhalten" ist
mathematisch identisch mit einem Mischfaktor alpha < 1 zwischen „unverändert" und „voll normiert"
(Abschnitt 3.2/4) — ein hartes Floor/Ceiling auf den resultierenden TMP/AUS-Wert selbst (statt auf
den Mischfaktor) wurde zusätzlich durchgerechnet und verworfen: Bei einem Band, das eng genug ist,
um die Pp-Abweichung spürbar zu senken, kollabiert es für die meisten real vorkommenden TMP/AUS-
Werte auf denselben Punkt wie die volle Normierung (weil TDMs TMP-Spannweite über reale Kader schon
heute schmal ist, s. SQUAD/OPP-Attribute), und ist bei einem Band breit genug, um das zu vermeiden,
in der Pp-Wirkung nicht von alpha ≈ 0,25 zu unterscheiden. Kein eigener dritter Pfad, sondern
dieselbe Kurve wie 3.2 mit zusätzlicher Komplexität ohne zusätzlichen Nutzen.

---

## 4. Messung — der weiche Clamp am echten Kampf

**Methode:** isolierte Worktree (`/tmp/claude-0/tmp-aus-diagnose`, Branch
`tmp-aus-diagnose-15-10`, nie gemergt), `aufEignung()` um einen Mischfaktor `window.__TMP_AUS_ALPHA`
erweitert (Default 0 → bit-identisch zum heutigen Verhalten):

```js
const alpha=(typeof window!=="undefined"&&window.__TMP_AUS_ALPHA)||0;
if(alpha>0){
  o.TMP=s.TMP*(1-alpha)+Math.max(1,s.TMP*f)*alpha;
  o.AUS=s.AUS*(1-alpha)+Math.max(1,s.AUS*f)*alpha;
}
```

Gemessen mit `window.__arena.serie(24)` (dieselbe reale Paarung V-W gegen A-A wie in der
Originaldiagnose) bei alpha = 0 / 0,25 / 0,5 / 1, **bewusst ohne erneute `einflussVon()`-Pp-Messung**
— die kostet bei TDM allein ~700-1400 Sekunden je Einzelwert (dokumentiert,
`tdm-pp-rezeptrunde-diagnose-02-10.md` Abschnitt 1.1, hier nachgeprüft: ein eigener Versuch brach
nach 25 Minuten ohne Ergebnis ab) und die Pp-Zahlen für die beiden Extremwerte (152,4 und 83,7)
stehen bereits dreifach verifiziert (Abschnitt 1.2); eine Zwischenmessung bei alpha=0,5 hätte den
Kompromiss nicht anders beurteilbar gemacht, als es die Score-Verteilung direkt tut.

**Ergebnis (n=24, ein Saatstrom, V-W gegen A-A, heutiger Stand `27d2fb65`):**

| alpha | Siegquote V-W | Score-Spanne | Verschiedene Endstände (von 24) | Dauer |
|---:|---:|---|---:|---:|
| 0 (unverändert) | 13 % | 6:13 … 17:12 | 18 | 112 s |
| 0,25 | 25 % | 7:15 … 17:13 | 20 | 114 s |
| 0,5 | 17 % | 8:15 … 19:14 | 16 | 111 s |
| 1 (volle Normierung) | 17 % | 8:13 … 16:14 | 19 | 113 s |

**Das überraschende, aber ehrliche Ergebnis: der historische Blowout-Effekt reproduziert sich auf
dem heutigen Stand NICHT.** Bei alpha=1 — exakt der 24.08.-Fassung, die 23 von 24 Kämpfen auf
6:0 kollabieren ließ — liegen die 24 Endstände heute über einen Bereich von 8:13 bis 16:14 verteilt,
mit 19 von 24 verschiedenen Werten; keine Konzentration auf einen einzigen Score. Auch die
Siegquote bewegt sich nicht dramatisch (13→25→17→17 %) und dreht sich nicht um.

**Das ist keine Entwarnung, sondern ein eigener Befund: die Ausgangslage von 24.08. existiert so
nicht mehr.** Zwischen damals und heute liegen mehrere, unabhängig voneinander dokumentierte
Chassis-Änderungen, jede für sich geeignet, genau die Dynamik zu verändern, die den historischen
Blowout erzeugte: TDM respawnt inzwischen kontinuierlich statt einmalig auszuscheiden (PR #1032
u. a., Score ist seitdem eine über 120 Sekunden kumulierte K.-o.-Zahl, nicht ein einmaliger
6-Kills-Showdown — allein das verwässert jede Blowout-Tendenz rein statistisch), der Heiler-
Doppelbezug aus #654 ist seit Monaten behoben, und die Persönlichkeits-Handwerk-Runde vom 07.10.
hat die Zielwahl-Logik verändert. Dass V-W heute nur noch 13-25 % statt 100 % gewinnt, zeigt schon
für sich, wie weit sich das Chassis von der Momentaufnahme entfernt hat, auf der der historische
Befund beruht.

**Was dieser Lauf NICHT leisten kann und soll:** Er ist ein Saatstrom, n=24, eine einzige Paarung —
dieselbe Beweislast, die CLAUDE.md für jede Pp-/rho-Abnahme verlangt (zwei unabhängige Saatströme,
mehrere Paarungen, kaderfest), erfüllt er bewusst nicht; er ist eine Stichprobe, die zeigt, dass die
Frage neu gestellt werden muss, keine abschließende Antwort. Die Pp-Seite wurde in diesem Lauf
überhaupt nicht neu gemessen (Begründung Abschnitt 4, Kostenargument) — die 152,4→83,7-Zahlen sind
über einen Monat alt und stammen aus derselben vor-Respawn-Ära, deren Kampfverhalten sich hier
gerade als überholt erwiesen hat. Es ist nicht auszuschließen, dass auch die Pp-Zahl sich seitdem
bewegt hat.

---

## 5. Empfehlung

**Kein sicherer, fertig messbarer Fix aus dieser Runde — aber auch keine bloße Wiederholung der
alten Antwort.** Drei Befunde tragen die Empfehlung:

1. **Für TDM und Mini-DM ist die TMP/AUS-Frage nicht der bindende Hebel, unabhängig vom Ausgang.**
   CLAUDE.md ordnet rho ausdrücklich vor Pp bei Zielkonflikt. TDMs rho liegt nach der bislang
   stärksten Mechanik-Runde (Persönlichkeits-Handwerk, 07.10.) bei 0,41-0,43 — „kein großer
   kategorialer Kanal mehr übrig" (`arena-zielwahl-opus-empfehlung-02-10.md`, Abschnitt 5.3), der
   Rest sitzt im rollenblinden Wertmaßstab und im Format, beides Chris-Entscheidungen, keine, die
   eine TMP/AUS-Änderung berührt. Eine perfekte Pp-Reparatur brächte TDM nicht in die Nähe von
   0,80. Mini-DM ist näher, aber im falschen Format gemessen (4-Team-FFA statt 4-gegen-4). **Für
   diese beiden lohnt sich keine weitere Pp-Anstrengung an `aufEignung()`, bevor die Zielwahl-/
   Wertmaßstab-Fragen entschieden sind.**
2. **Für Battlefield ist Pp dagegen der praktische Blocker — und genau hier lohnt sich eine
   kontrollierte Neumessung, nicht aber in dieser Runde.** Battlefields Saison-Validität liegt nach
   derselben Runde bei 0,76-0,81 (nahe Basketball/Hockey), rho ist dort „messbar der richtige
   Hebel" und nicht die bindende Verletzung — die Pp-Abweichung ist es. Das deckt sich exakt mit
   dem Blocker, den `battlefield-domination-konzept-14-10.md` benennt. Jede künftige
   Battlefield-Rezeptrunde (Domination-Formel über Charisma/Intelligence/Spirit) läuft sonst
   wieder in dieselbe Falle wie die Persönlichkeits-Runde vom 07.10.: rho steigt, Pp explodiert,
   weil die neuen, matrixtreuen Attribute ausgerechnet durch TMP/AUS laufen.
3. **Der historische Blowout-Befund, der jede Normierung bisher blockiert hat, braucht eine
   Neumessung auf dem heutigen Stand, bevor er als weiterhin gültiges Veto zitiert wird.** Dieser
   Bericht hat ihn nicht widerlegt — er hat gezeigt, dass er sich mit derselben Methode (ein
   Saatstrom, n=24, dieselbe V-W/A-A-Paarung) auf dem heutigen Chassis nicht reproduziert, und dass
   dafür plausible, unabhängig dokumentierte Gründe existieren (Respawn-Umbau, Heiler-Fix,
   Persönlichkeits-Handwerk). Weder „die alte Begründung gilt unverändert" noch „also ist
   Normierung jetzt sicher" ist aus dieser einen Stichprobe zu rechtfertigen.

**Konkrete Empfehlung für die nächste Runde, die an dieser Stelle weiterarbeitet** (nicht diese):
eine echte Zwei-Strom-Messung, ausschließlich für Battlefield (nicht TDM/Mini-DM, s. Punkt 1):
`einflussVon("battlefield", n)` bei n=12-24 (günstiger als TDM, da `jeSeite:4`) auf zwei
unabhängigen Saatströmen, PLUS ein `serie`/`boxscoreSerie`-Realkampf-Vergleich über mehrere echte
Paarungen (nicht nur V-W/A-A) bei alpha ∈ {0, 1} und, falls das die Blowout-Sorge nicht
reproduziert, zusätzlich bei einem Zwischenwert. Erst wenn diese Messung — mit der vollen, von
CLAUDE.md verlangten Beweislast — entweder (a) weiterhin keinen Blowout zeigt, oder (b) einen
alpha-Wert findet, der Pp spürbar senkt, ohne die Score-Streuung sichtbar zu verengen, ist eine
Änderung an `aufEignung()` tatsächlich build-reif. Bis dahin bleibt die Kappung draußen, und die
Entscheidung „Kampfvarianz gegen Matrix-Treue bei TMP/AUS" liegt weiterhin bei Chris — nur dass sie
jetzt auf einem aktuellen, nicht auf einem 1,5 Monate alten Befund beruhen sollte.

**In dieser Runde nicht gebaut:** kein Commit an `aufEignung()`, `battle-mode.engine.js` oder
`battle-mode.rezepte.js`. Die Worktree mit dem Mischfaktor
(`/tmp/claude-0/tmp-aus-diagnose`, Branch `tmp-aus-diagnose-15-10`) ist ein Diagnose-Werkzeug, kein
Vorschlag — sie bleibt unverschmolzen und kann für die oben skizzierte Neumessung weiterverwendet
werden.
