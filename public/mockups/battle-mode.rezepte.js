// ARENA-REZEPTE — die Daten-Datei zum Motor (battle-mode.engine.js).
//
// WOZU DIESE DATEI EXISTIERT (Plan: docs/design/battle-arena-multi-disziplin-plan.md,
// Abschnitt 1.2 Punkt 1). Ein Rezept sagt je Disziplin, aus welchen ATTRIBUTEN ein
// Sub-Skill gespeist wird: `{SUBSKILL: {attribut: prozent}}`, die Prozente eines
// Sub-Skills sind ein 100er-Budget. Diese Zahlen sind das, was in jeder Kalibrier-Runde
// angefasst wird — bisher mitten im Motorcode einer 13.000-Zeilen-Datei. Hier liegen sie
// getrennt: eine Kalibrier-Runde (auch zwei parallel arbeitende Agenten) editiert nur
// noch diese Datei, und der Diff ist lesbar.
//
// KEIN BUILD-SCHRITT. Dieselbe Philosophie wie bisher: battle-mode.html laedt erst
// diese Datei, dann den Motor — zwei <script>-Zeilen, kein Bundler, kein Modulsystem.
//
// WIE DER MOTOR SIE LIEST — und was passiert, wenn es diese Datei nicht gibt.
// Im Motor steht je Disziplin `rezept:rezeptAus("<id>", <inline>)`. Steht die Disziplin
// hier, gilt diese Datei; steht sie hier nicht, gilt das Inline-Rezept im Motor. Damit
// ist der Umzug SCHRITTWEISE moeglich: heute ist nur Basketball ausgelagert, die
// uebrigen 19 Disziplinen fuehren ihr Rezept unveraendert im Motor und werden Stueck
// fuer Stueck nachgezogen. Eine Disziplin, die WEDER hier noch inline ein Rezept hat,
// ist ein Fehler und wird beim Laden laut (rezeptAus wirft) — still auf ein fremdes
// Rezept zurueckzufallen waere schlimmer, weil dann eine falsche Disziplin gespielt
// wuerde, ohne dass es jemand merkt.
//
// KEINE ZAHL WURDE BEIM UMZUG GEAENDERT. Die Werte und die kompletten Mess-Kommentare
// unten stehen zeichengleich so, wie sie im Motor standen — der Umzug ist reine
// Struktur, nachgewiesen ueber denselben Spielverlauf bei gleicher Saat
// (window.__arena.spieleBasketball(1337), Ereignisprotokoll byte-identisch).
//
// LESEHILFE ZU DEN KOMMENTAREN UNTEN: sie sind mit umgezogen und zeigen deshalb weiter
// dorthin, wo sie geschrieben wurden. Wo "oben", "dort" oder "s. GEO_BONUS/technikMake/
// schussSkillFuer" steht, ist battle-mode.engine.js gemeint — die Formeln, gegen die
// diese Rezepte kalibriert wurden, stehen naemlich weiterhin dort und nur dort.

window.__ARENA_REZEPTE = {
  // ===============================================================================
  // REZEPT-NEUBAU NACH CHRIS' METHODE (26.08., gegen DIESE Formel kalibriert)
  //
  // Vorgeschichte: ein erster attribut-zentrierter Neubau wurde gegen die DAMALS noch
  // alte, unkalibrierte Trefferformel gemessen (31,8 -> 22,8 Pp) und nach der
  // Wurfquoten-Rekalibrierung (technikMake 0,16/0,0050/0,0060 -> -0,02/0,0022/0,0030,
  // s. GEO_BONUS oben) mit 53,7 Pp wieder verworfen. Diese Runde macht denselben
  // Neubau noch einmal — aber mit einem vorgeschalteten Schritt, der beim ersten Mal
  // fehlte: ERST MESSEN, WIE VIEL EINFLUSS JEDER SUB-SKILL UEBERHAUPT TRAEGT.
  //
  // 1) EINFLUSS-GEWICHT JE SUB-SKILL, aus der Messung zurueckgerechnet. Der
  //    gemessene Anteil eines Attributs ist naeherungsweise die Summe seiner
  //    Rezept-Anteile mal dem Einfluss-Gewicht des jeweiligen Sub-Skills. Aus dem
  //    Ausgangsstand (63,6 Pp, N=48) laesst sich das System nach den zehn Gewichten
  //    aufloesen (nicht-negativ, Summe 100):
  //
  //      ZWEITCHANCE 39,5 | ABWEHR 18,0 | LAUFTEMPO 13,6 | SCHUSS_NAH 11,4
  //      TEAMGEIST 10,0   | AUFBAU  6,4 | SCHUSS_FERN ~2 | ABSCHLUSS ~1 | TECHNIK ~1
  //      AUSDAUER 0
  //
  //    ACHTUNG, NACHTRAG (nachgerechnet, nicht vermutet): der damals genannte
  //    Restfehler von 2,2 Pp bedeutet NICHT, dass das Modell gut trifft — er ist ein
  //    Artefakt. Neun Gleichungen, zehn Unbekannte: aus EINER Messung ist das System
  //    unterbestimmt, jede Loesung passt sich perfekt an. Gegen alle sechs inzwischen
  //    vorliegenden Messungen (Ausgangsstand + v1-v5) gerechnet bleibt ein
  //    In-Sample-Restfehler von 17-63 Pp je Messung stehen, und in der
  //    Kreuzvalidierung (Messung jeweils weggelassen) liegt der Prognosefehler bei
  //    im Mittel 49 Pp — das Modell sagt eine ungesehene Messung also praktisch gar
  //    nicht voraus. Eine Potenzform (Anteil ~ linear hoch gamma, gamma 1-3) hilft
  //    nicht, die Kreuzvalidierung bleibt bei 47-65 Pp.
  //
  //    Der Grund steckt in der Messung selbst: `einflussVon` normiert ueber
  //    Sigma max(0, Gewinn), und die ROHGEWINNE sind klein (0,01-0,6 Boxscore-Punkte
  //    bei einem Gesamtpool um 2,0). Zwei fast gleiche Rezepte (v4 gegen v5, nur
  //    ZWEITCHANCE/LAUFTEMPO um wenige Punkte verschoben) lieferten Rohgewinne von
  //    stamina 0,068 gegen 0,496 und power +0,343 gegen -0,046 — die Groesse springt,
  //    weil dahinter Schwellen stehen (Slot-RANG in zuordneSlots, Wurfentscheidungs-
  //    Schwelle), keine glatte Kennlinie. DIE ZAHLEN OBEN SIND DESHALB EINE
  //    ARBEITSHYPOTHESE, KEIN MESSWERT. Wer hier weitermacht, misst besser nach,
  //    statt dem Modell zu glauben: fuenf von fuenf Rezepten, die aus ihm abgeleitet
  //    oder gegen es optimiert wurden, waren am Ende schlechter als dieses hier.
  //
  //    Das deckt sich mit dem Code: ZWEITCHANCE entscheidet ueber zuordneSlots(),
  //    WER auf dem korbnaechsten Slot steht — und damit, wer Dunks nimmt
  //    (GEO_BONUS.dunk 0,70 gegen fern 0,075, der mit Abstand groesste Term in
  //    technikMake). AUSDAUER wird von der Basketball-LIVE-Engine ueberhaupt nicht
  //    gelesen (der einzige AUSDAUER-Verbraucher, `ermued`, sitzt im Vorab-Modell
  //    fuer Football/Hockey/Tennis) — sein Rezept ist mechanisch folgenlos.
  //    technikGate ist bei Durchschnittswerten (~0,72) immer ueber der Schwelle
  //    (max. 0,42), deshalb liest TECHNIK fast null.
  //
  // 2) CHRIS' VERTEILUNG: je ATTRIBUT wird sein Matrixgewicht als 100%-Budget ueber
  //    die Sub-Skills verteilt, in denen es logisch etwas zu suchen hat. Damit die
  //    Rechnung aufgeht, muss die auf einen Sub-Skill entfallende Gesamtmasse gleich
  //    seinem Einfluss-Gewicht sein — genau deshalb traegt ZWEITCHANCE hier so viel
  //    (39,5 % der Gesamtmasse) und ABSCHLUSS/TECHNIK so wenig.
  //
  //    Attribut   AUF ABS TEC S_NAH S_FERN ZWEIT ABW TEAM LAUF  (% des Attributbudgets)
  //    spirit       4   1   1    12     1    59    9   13    -
  //    intelligence 14   -   3     -     5    67   11    -    -
  //    awareness     6   1   2    18     3    54   16    -    -
  //    charisma     15   3   -     -     -     -   16   66    -
  //    speed         -   -   -     -     -     -   21    -   79
  //    dexterity    10   4   3    36     6     -    5    -   36
  //    power         -   2   -    49     -    49    -    -    -
  //    stamina       -   -   -     -     -    66    -    -   34
  //    torment       -   -   -     -     -     -  100    -    -
  //    (AUSDAUER steht bewusst nicht in der Tabelle: mechanisch tot, s. oben — sein
  //     Rezept ist rein logisch belegt und zieht keinem Attribut Budget ab.)
  //
  // 3) DIE ECHTE MESSUNG (messe-arena-einfluss.mjs basketball 48), zweimal, mit zwei
  //    voneinander unabhaengigen Saatstaemmen — der zweite Lauf ist noetig, weil die
  //    Saaten in einflussVon fest verdrahtet sind: eine Messung ist reproduzierbar,
  //    aber sie ist EINE Stichprobe, und nach Punkt 1 ist die Groesse sprunghaft.
  //
  //      Attribut       Matrix   Lauf A   Lauf B (andere Saaten)
  //      spirit           22      23,8     19,2
  //      intelligence     16      15,9     14,6
  //      awareness        14      15,7     16,0
  //      charisma         11       8,7     12,8
  //      speed            10       8,2      9,3
  //      dexterity         8       4,4      9,4
  //      power             7       6,2      6,2
  //      stamina           6      10,7     10,5
  //      torment           6       6,4      2,0
  //      ABWEICHUNG              17,2 Pp  19,4 Pp
  //
  //    Vorher (Ausgangsstand): 63,6 Pp. Die einzige in BEIDEN Laeufen gleichgerichtete
  //    Restabweichung ist stamina (+4,7 / +4,5); alles andere wechselt zwischen den
  //    Saatstaemmen das Vorzeichen und ist damit Stichprobe, nicht Struktur.
  //
  //    Vier Versuche, genau dieses stamina zu senken, wurden gemessen und ALLE
  //    VERWORFEN, weil sie die Gesamtabweichung erhoehten: LAUFTEMPO stamina 26->16
  //    plus dexterity 14->22 (28,6 Pp), dasselbe mit charisma-Nachzug in AUFBAU/
  //    TEAMGEIST (20,4 Pp), LAUFTEMPO speed 60->68/stamina 26->20 mit ZWEITCHANCE
  //    stamina 8->5 (20,2 Pp) und die halb so grosse Fassung davon (22,0 Pp). Der
  //    Stand hier ist also nicht der erste brauchbare, sondern der beste von fuenf
  //    gemessenen — wer ihn anfasst, misst bitte gegen 17,2/19,4, nicht gegen 63,6.
  //
  // Die Erfolgsformeln selbst (technikMake/technikGate/GEO_BONUS/bedraengnis*/
  // kontestFaktor/die 0,92-Deckel) sind dabei mit KEINER Zeile angefasst worden —
  // sie sind gegen reale FG%-Referenzwerte kalibriert, und jeder frueherer Versuch,
  // die Matrix ueber sie statt ueber die Rezepte einzuloesen, hat die Abweichung
  // gesprengt (s. dortige Kommentare). Der einzige Hebel hier sind die zehn Rezepte.
  //
  // ===============================================================================
  // ARCHETYPEN-RUNDE (Chris: "die stars sollen wirklich herausstechen in playmaking,
  // scorer long/short range, defense"). Der Stand davor — 17,3 Pp mit den Rezepten aus
  // PR #680/#681 — war matrixtreu und trotzdem falsch: eine Vier-Archetypen-Demo
  // (240 Spiele, vier Extrem-Builds gegen sonst durchweg neutrale Spieler) zeigte, dass
  // KEINER der vier in seiner eigenen Kategorie fuehrte. Der Spielmacher war der beste
  // Scorer, der Distanzschuetze der beste Rebounder, der Korbschuetze traf am
  // schlechtesten aus der Zone. Die Rezepte alleine konnten das nicht heilen — vier
  // MECHANISCHE Befunde standen davor, jeder einzeln nachgemessen und unten an seiner
  // Stelle dokumentiert:
  //
  //   1. zuordneSlots() verteilte die Korbnaehe nach ZWEITCHANCE. Rebounds und
  //      Korbpunkte hingen damit an EINEM Wert und waren ueber kein Rezept trennbar.
  //      Jetzt nach SCHUSS_NAH.
  //   2. Jeder Ballfuehrer lief stur auf den Korb zu (bewegeSpielerLive). Ein
  //      Distanzschuetze kam so gar nicht erst zum Dreier. Jetzt bestimmt sein
  //      Wurfprofil die Wunschdistanz.
  //   3. Der Wurf-Zweig stand VOR dem Pass-Zweig und verliess die Funktion mit return —
  //      wer in Reichweite stand, kam an `passChance` praktisch nie vorbei. Ein
  //      Spielmacher war mechanisch unmoeglich. Jetzt `suchtPass`.
  //   4. Der Assist zaehlte nur, wenn der Empfaenger in GENAU der naechsten
  //      Entscheidung warf; das Rebound-Los war linear und damit fast ein Muenzwurf.
  //      Jetzt ein Zeitfenster (ASSIST_FENSTER) und ein quadratischer Zweikampf.
  //
  // ERGEBNIS (messe-arena-einfluss.mjs basketball 48 / Vier-Archetypen-Demo, 320 Spiele
  // je Build): 20,4 Pp, und alle vier Builds fuehren in ihrer eigenen Kategorie —
  // Vorlagen +16 %, getroffene Dreier +173 %, getroffene Korbwuerfe +76 %,
  // Steals+Bloecke+Rebounds +17 % gegenueber dem jeweils naechstbesten Build. Zweite
  // Stichprobe zur Kontrolle, wie beim ZWEITCHANCE-Nachzug davor: n=60 liest 25,5 Pp
  // (der Stand davor las dort 20,8 gegen seine 17,3 bei n=48) — der Aufschlag ist in
  // beiden Stichproben derselbe, rund +3 bis +5 Pp.
  //
  // WAS DAS GEKOSTET HAT, ehrlich: 17,3 -> 20,4 Pp. Die vier Mechanik-Aenderungen allein
  // (mit den alten Rezepten) lagen bei 37,2 Pp; die 20,4 sind das Ergebnis von zwoelf
  // durchgemessenen Rezeptfassungen darauf (v4 29,7 | v5 22,4 | v6 35,3 | v7 40,1 |
  // v8 35,0 | v9 37,1 | w1 44,0 | w2 29,4 | x1 44,0 | y1 34,2 | z2 36,0 | s1 23,1).
  // Die Metrik reagiert dabei NICHT monoton auf kleine Rezeptaenderungen: sie normiert
  // ueber die positiven Gewinne, ein Attribut mit Nettogewinn <= 0 liest exakt 0,0 % und
  // kostet dann sein volles Matrixgewicht. Zwei Fassungen mit identischer
  // dexterity-Verteilung lasen 7,2 % und 1,1 %. Wer hier weiterdreht: nach JEDEM Punkt
  // messen, und die Fassung behalten, in der ALLE neun Attribute positiv lesen — das
  // ist der zuverlaessigste Indikator fuer eine niedrige Abweichung.
  //
  // Ein Sondierungslauf mit ORTHOGONALEN Rezepten (jeder Sub-Skill von genau einem
  // Attribut gespeist, so dass der gemessene Attributanteil das mechanische Gewicht des
  // Sub-Skills IST) hat die Arbeit ueberhaupt erst steuerbar gemacht. Vorher/nachher:
  //   ZWEITCHANCE 54,8 -> 10,3 | ABWEHR 13,3 -> 21,8 | TEAMGEIST 21,6 -> 11,4
  //   SCHUSS_NAH   0,0 -> 17,5 | LAUFTEMPO 1,4 -> 14,8 | TECHNIK 2,0 -> 8,2
  //   AUFBAU       0,0 ->  7,9 | ABSCHLUSS 5,5 -> 6,2 | SCHUSS_FERN 1,5 -> 1,2
  //   AUSDAUER     0,0 ->  0,1 (mechanisch tot, s. dortiger Kommentar)
  // Vorher trug EIN Sub-Skill mehr als die Haelfte; jetzt haben acht von zehn ein
  // Gewicht, mit dem sich ein Rezept ueberhaupt lenken laesst. Der Lauf ist billig
  // (eine Messung) und lohnt sich vor jeder groesseren Mechanik-Aenderung wieder.
  // ===============================================================================
  basketball:{
    // Spielaufbau: den Angriff einleiten und den Ball sicher halten. Charisma fuehrt —
    // der Aufbauspieler dirigiert die anderen fuenf —, dahinter das Handling
    // (dexterity); erst danach Spielverstaendnis und Uebersicht. Kein power/stamina/
    // torment: den Ball hochzubringen ist keine Kraftfrage.
    //
    // FRUEHER intelligence-gefuehrt (36), und genau das machte den Spielmacher zum
    // Distanzschuetzen: intelligence fuehrt auch SCHUSS_FERN (Chris' Vorgabe, s. dort),
    // ein Build auf "AUFBAU hoch" bekam den Dreierschuetzen also gratis dazu — dieselbe
    // Ueberlappung, die PR #681 bei ABWEHR aufgeloest hat. charisma ist der einzige
    // Wert, der ausserhalb von TEAMGEIST keine zweite Heimat hat und deshalb einen
    // Archetyp allein tragen kann; die Signatur des Spielmacher-Builds ist jetzt
    // charisma + dexterity und ueberschneidet sich mit keinem der drei anderen.
    AUFBAU:      {charisma:36,dexterity:26,intelligence:14,awareness:12,speed:8,spirit:4},
    // ABSCHLUSS ist KEIN Erfolgswert (das sind SCHUSS_NAH/SCHUSS_FERN), sondern
    // "generische Abschlussstaerke" fuer drei Auswahl-Entscheidungen: wer als
    // Zielspieler angespielt wird (offensterMitspieler), wie frueh sich ein
    // Ballfuehrer einen Wurf zutraut (schwelle) und die Freiwurfquote. Genau dafuer
    // steht hier Handling (dexterity) vor Selbstvertrauen (charisma/spirit) —
    // "der Typ, der den Ball haben WILL, wenn es eng wird".
    ABSCHLUSS:   {spirit:22,dexterity:20,charisma:16,power:14,awareness:10,stamina:10,intelligence:8},
    // Wurfauswahl und Geduld ("Shot Intelligence", Chris' Wort). Bleibt
    // intelligence-gefuehrt wie bisher; das Rezept ist logisch richtig, sein
    // MECHANISCHER Einfluss ist nur klein, weil technikGate bei Durchschnittswerten
    // immer ueber der Schwelle liegt (s. Punkt 1 oben) — das ist eine Eigenschaft
    // der Formel, kein Grund, das Rezept unlogisch zu machen.
    TECHNIK:     {intelligence:50,awareness:22,spirit:16,dexterity:12},
    // SCHUSS_NAH/SCHUSS_FERN (Chris' Wunsch: "scorst du 2P/3P separat und laesst die
    // Gewichtung da reinlaufen") tragen die eigentliche Trefferchance in technikMake.
    // Nur aus den fuer Basketball erlaubten 9 Attributen, KEIN speed (Doppel-Zaehlung
    // mit dem Fastbreak/Bedraengnis-Mechanismus, s. schussSkillFuer oben).
    // Die Asymmetrie, die einen Korbleger von einem Distanzschuetzen unterscheidbar
    // macht, ist jetzt vollstaendig: power NUR nah (Kraft am Ring, dort das groesste
    // Einzelgewicht), intelligence NUR fern (Wurftechnik/Bogenwahl — Chris woertlich:
    // "um 3P-Wuerfe zu machen braucht man mehr intelligence als power, ist ja
    // logischer"). Die beiden Rezepte teilen sich KEIN einziges fuehrendes Attribut
    // mehr: nah traegt power+spirit (Kraft und Wille am Ring), fern
    // intelligence+awareness (Technik und Timing aus der Distanz).
    //
    // power MUSS hier fuehren, nicht bloss vorkommen — das ist der eine Punkt, an dem
    // sich das Rezept nicht frei waehlen laesst. SCHUSS_NAH speist seit dieser Runde
    // zuordneSlots(), und dieser Kanal ist ein RANGWECHSEL: eine Attributanhebung wirkt
    // nur, wenn sie den Spieler in der Sortierung ueberhaupt verschiebt. Mit power auf
    // Platz zwei (30 gegen spirit 34) bewegte dieselbe Anhebung SCHUSS_NAH um zu wenig,
    // und power las in drei aufeinanderfolgenden Messungen 0,0-1,8 % statt seiner
    // Matrixvorgabe 7 (z1, y1, q1). Mit power an der Spitze liest es 5,3 %.
    // stamina fuer die Arbeit im Low Post, awareness fuers Timing, torment nur als
    // Spur — Haerte gehoert an die Bretter (ZWEITCHANCE), nicht in den Wurf.
    SCHUSS_NAH:  {power:34,spirit:30,stamina:16,awareness:12,dexterity:6,torment:2},
    SCHUSS_FERN: {intelligence:50,awareness:22,spirit:16,dexterity:12},
    // WER DEN ZWEITEN BALL HOLT — und seit dieser Runde NUR noch das. ZWEITCHANCE
    // entschied frueher zwei voellig verschiedene Dinge: den Kampf um den Abpraller
    // (reboundKampf, richtig) UND die Aufstellung, also wer korbnah steht (falsch,
    // s. zuordneSlots). Weil korbnah der groesste Term der Wurfformel steht
    // (GEO_BONUS.dunk 0,70), war jeder gute Rebounder zwangslaeufig auch der beste
    // Punktesammler; acht durchgemessene Rezeptfassungen drehten Rebounds und Punkte
    // immer zusammen. Das war eine Mechanik-Frage, keine Rezept-Frage, und sie ist in
    // zuordneSlots() beantwortet. Hier steht seitdem nur noch der Zweikampf am Brett.
    //
    // REBOUND-BEFUND (Chris, aus der Runde davor): "der defense star hat deutlich
    // weniger rebounds als sein gegenueber". Mit dem alten, intelligence-lastigen
    // Rezept (23) las der reine Distanzschuetzen-Build hier 83 gegen 72 des
    // Verteidiger-Builds — der Scorer gewann also auch noch die Bretter. Inhaltlich
    // falsch: Rebounding ist Zweikampfhaerte und Stellungsspiel, nicht Wurf-IQ.
    //
    // JETZT fuehrt torment (Haerte am Brett), dahinter intelligence (Antizipation —
    // wo der Ball hinspringt, weiss man vor dem Absprung) und spirit (den Ball WOLLEN),
    // dann speed (wer zuerst da ist). Die Signatur des Verteidiger-Builds ist
    // torment + speed und traegt damit 42 der 100 Punkte; der Distanzschuetze
    // (intelligence + awareness) kommt auf 34 — genug Abstand, dass der Verteidiger die
    // Bretter gewinnt, ohne dass Antizipation aus dem Rezept fliegt. Kein power und kein
    // dexterity: beides sind in dieser Disziplin Wurf-Attribute, und solange sie hier
    // mitwiegen, kauft sich der Scorer-Build ueber sie die Bretter zurueck.
    //
    // WIRKUNG (Vier-Archetypen-Demo, 320 Spiele je Build): Rebounds Verteidiger 2,41
    // gegen 1,96 des Distanzschuetzen und 1,72 des Korbschuetzen — vor der Runde stand
    // es 1,29 zu 2,90 gegen ihn. Der Rebound-Zweikampf selbst (reboundKampf) traegt
    // dazu bei: er lost seit dieser Runde quadratisch statt linear und laesst einem
    // heranstuermenden Rebounder ueberhaupt Zeit anzukommen (s. dort).
    ZWEITCHANCE: {torment:26,intelligence:24,spirit:20,speed:16,awareness:10,stamina:4},
    // ===========================================================================
    // VERTEIDIGER-DIFFERENZIERUNG — der eine Punkt, an dem das Rezept aus PR #680
    // einen echten Nebeneffekt hatte. torment fuehrt jetzt, intelligence ist raus.
    //
    // BEFUND. Ein Demo-Lauf mit zwei extremen Builds (Verteidiger awareness/
    // intelligence/torment/spirit 92-98 gegen Scorer intelligence/power/dexterity/
    // awareness 90-97) machte BEIDE zu Top-Scorern — der "Verteidiger" sogar zum
    // besten: 3,44 PTS bei 60,5 FG% gegen 2,41 PTS bei 54,7 FG% des Scorers
    // (360 Spiele). Die Engine gab ihm SCHUSS_FERN 99 und TECHNIK 99, WEIL er
    // Verteidiger sein sollte. Ursache: ABWEHR fuehrte mit awareness 22 +
    // intelligence 18 = 40 % genau die zwei Attribute, die SCHUSS_FERN
    // (intelligence 48 + awareness 19 = 67 %) und TECHNIK (49 + 23 = 72 %) fuehren.
    // Wer ABWEHR ueber 90 wollte, MUSSTE beide hochziehen — und bekam den
    // Distanzschuetzen gratis dazu.
    //
    // NACHTRAG ARCHETYPEN-RUNDE (die Zahlen unten beschreiben den Stand davor, die
    // Begruendung gilt unveraendert): torment fuehrt weiter, aber speed steht jetzt
    // dicht dahinter (24 statt 9) — nicht als Widerruf des SPEED-Absatzes weiter unten,
    // sondern weil sich die Lage darunter geaendert hat. Der Absatz argumentiert gegen
    // speed, weil speed ueber LAUFTEMPO auch scort; das galt, solange jeder Ballfuehrer
    // stur auf den Korb zulief und Tempo damit direkt Punkte war. Seit die Wunschdistanz
    // am Wurfprofil haengt (s. bewegeSpielerLive), zahlt Tempo vor allem noch auf lose
    // Baelle und Rueckwaertsbewegung ein. Gemessen liegt der speed-Anteil mit
    // torment 26/speed 24 bei 9,1 % gegen die Matrixvorgabe 10 — also unter Vorgabe,
    // waehrend die alte Fassung mit speed 17 noch 13,8 % las. Der Verteidiger-Build
    // braucht ein ZWEITES eigenes Attribut, sonst traegt ihn torment allein und er
    // bleibt gegen jeden anderen Build zu schwach; torment + speed ist die einzige
    // Paarung, die sich mit keinem der drei Scorer-Archetypen ueberschneidet.
    // intelligence steht wieder mit 12 drin (statt 4) — Antizipation gehoert in eine
    // Verteidigung, und auf Platz vier kann sie den Distanzschuetzen nicht mehr
    // gratis mitliefern, gegen den der BEFUND oben geschrieben wurde.
    //
    // AENDERUNG (Stand PR #681). intelligence 18 -> 4, torment 16 -> 26 (fuehrt jetzt),
    // awareness 22 -> 20, charisma 6 -> 10, dexterity 5 -> 8, power 4 -> 6, speed 12 -> 9.
    // Logisch tragbar: Verteidigung braucht Spielverstaendnis, aber nicht in dem
    // Ausmass, in dem ein Distanzwurf es braucht. Die Haerte im Zweikampf (torment)
    // ist das, was einen Verteidiger von einem Werfer UNTERSCHEIDET; das Lesen des
    // Feldes (awareness) ist das, was beide teilen, und darf deshalb nicht fuehren.
    // charisma steht fuer die Kommunikation in der Verteidigung, dexterity fuer die
    // Haende am Ball, power fuer das Behaupten der Position.
    //
    // WARUM SPEED RUNTER STATT HOCH — der Auftrag schlug das Gegenteil vor, die
    // Messung widerspricht zweimal. (1) Matrix: jeder Punkt speed mehr in ABWEHR hob
    // den gemessenen speed-Anteil um rund einen Prozentpunkt; die Fassung mit
    // speed 17 las 13,8 % (Matrixvorgabe 10) und riss die Abweichung in der zweiten
    // Saatfamilie auf 51,5 Pp. (2) Differenzierung: speed treibt ueber LAUFTEMPO
    // (speed 60) die Laufgeschwindigkeit tempoPx und damit die Rennen um lose Baelle,
    // Rebounds und Fastbreaks. speed ist also DUAL USE — ein Verteidiger, den man
    // ueber speed baut, scort in der Umschaltbewegung, ohne einen einzigen Wurf-Skill
    // zu brauchen. Gemessen (480 Spiele, spirit bei beiden Builds gleich 90, damit
    // TEAMGEIST herausfaellt): derselbe Verteidiger mit speed 95 schlaegt den Scorer
    // 3,29 zu 3,01 PTS bei 61,1 zu 56,6 FG%; mit speed 78 liegt er bei 2,38 zu 3,35
    // PTS und 51,3 zu 60,9 FG%; mit speed 50 bei 2,08 zu 3,36. torment ist das
    // einzige Attribut der Disziplin, das AUSSCHLIESSLICH Verteidigung bezahlt —
    // deshalb traegt es hier den Hauptteil, nicht speed.
    //
    // GEMESSEN. messe-arena-einfluss.mjs basketball 48: 17,2 Pp (PR #680) -> 20,3 Pp.
    // Zusaetzlich gegen eine ZWEITE, unabhaengige Saatfamilie geprueft (die Saaten in
    // einflussVon sind fest verdrahtet, fuer den Gegenlauf einmalig auf
    // zieheFormkarten(20260824+i*15485863)/M.bau(4241+i*32452843) gesetzt): dort
    // 31,3 Pp (PR #680) -> 32,5 Pp. Der Aufschlag ist also in BEIDEN Familien klein
    // (+3,1 / +1,2) — das war bei den verworfenen Fassungen nicht so.
    //
    // VERWORFEN, alle gemessen (Saatfamilie A / zweite Familie):
    //   torment30 speed24 aware13 dex10 spirit7, dazu ZWEITCHANCE- und
    //     SCHUSS_NAH-Umbau                                    38,5 / —
    //   dieselbe ABWEHR ohne die zwei anderen Rezepte         24,8 / —
    //   torment30 speed16 aware18 dex12 spirit8 cha8          32,2 / —
    //   torment27 aware20 speed17 spirit14 cha7               21,5 / 51,5
    //   torment23 aware20 spirit14 speed13 cha10 pow8         25,4 / 33,1
    // Die Reihenfolge ist NICHT monoton in irgendeinem Gewicht — dieselbe Sprung-
    // haftigkeit, vor der der Block ganz oben warnt. Wer hier weitermacht: nach jeder
    // einzelnen Zahl messen, und immer gegen BEIDE Saatfamilien.
    //
    // WAS DAS NICHT LOEST — nachgemessen, damit es niemand fuer einen Fehler haelt:
    // ein Build mit spirit 90+ bleibt auch als "Verteidiger" ein ordentlicher Scorer,
    // und das ist KEIN Rezeptfehler. spirit ist mit 22 der hoechste Matrixwert der
    // Disziplin, und TEAMGEIST (spirit 41) geht mit Koeffizient 0,0030 in technikMake
    // ein — mehr als der Wurf-Skill selbst mit 0,0022. Ein spirit-90-Spieler ist per
    // Matrix-Ansage ueberall gut; wer das aendern will, aendert die Matrix, nicht das
    // Rezept.
    // ===========================================================================
    ABWEHR:      {torment:26,speed:24,awareness:20,intelligence:12,dexterity:10,charisma:8},
    // TEAMGEIST geht in technikMake UND in die Pass-Lotterie (qualitaet hoch zwei)
    // ein — ein starker, aber wegen des 0,92-Deckels stark nichtlinearer Kanal (ein
    // frueherer Versuch, spirit hier NOCH weiter hochzuziehen, hob die Abweichung auf
    // 44+ Pp). Deshalb geht der Weg andersherum: charisma fuehrt, spirit holt sich
    // seinen Anteil ueber SCHUSS_NAH und ZWEITCHANCE. Logisch traegt das:
    // Mannschaftsgeist ist die Verbindung zur Mannschaft, und die entsteht ueber
    // Ausstrahlung mindestens so sehr wie ueber eigenen Willen.
    //
    // 59/41 -> 56/44 (Archetypen-Runde): TEAMGEIST ist fuer charisma nicht mehr der
    // einzige Kanal, sondern der einzige POSITIVE. AUFBAU, das charisma seit dieser
    // Runde anfuehrt, nimmt seinem Traeger im Boxscore-Mass zuerst etwas weg — wer
    // abgibt, tauscht rund 1,2 erwartete eigene Punkte gegen eine Vorlage zu 1,0
    // (s. suchtPass/passChance in entscheideBallaktion). Genau daran ist charisma in
    // mehreren Fassungen auf 0,6-4,2 % eingebrochen, obwohl die Matrix es mit 11
    // bepreist. Vier Punkte zurueck zu spirit halten den Ausgleich: gemessen liest
    // charisma jetzt 11,4 % bei Vorgabe 11 und spirit 19,9 % bei Vorgabe 22.
    TEAMGEIST:   {charisma:56,spirit:44},
    // MECHANISCH FOLGENLOS in der Basketball-Live-Engine: kein einziger Aufruf liest
    // u.AUSDAUER (der `ermued`-Term sitzt im Vorab-Modell, das nur Football/Hockey/
    // Tennis fahren). Bewusst trotzdem logisch richtig belegt statt als Ablage fuer
    // unerwuenschte Attribute missbraucht — wenn die Live-Engine spaeter einen
    // Ermuedungsterm bekommt, stimmt das Rezept dann sofort, und die Budgetrechnung
    // oben zieht ihm zugleich keinem Attribut etwas ab.
    AUSDAUER:    {stamina:48,spirit:22,torment:18,speed:12},
    // Fables Dynamik-Runde: Lauftempo treibt die tatsaechliche Laufgeschwindigkeit
    // (tempoPx) und entscheidet damit die Rennen um freie Baelle. speed 60 -> 52,
    // stamina 26 -> 32 (Archetypen-Runde): speed traegt jetzt zusaetzlich 24 in ABWEHR
    // (s. dort) und wuerde ueber beide Kanaele zusammen ueberschiessen; stamina hat
    // ausser hier und in SCHUSS_NAH keine mechanische Heimat mehr, seit AUSDAUER in der
    // Live-Engine nichts mehr auszahlt (s. dortiger Kommentar) — es las in mehreren
    // Fassungen 0,1-0,3 % bei Vorgabe 6. Mit 32 liest es 9,6 %.
    LAUFTEMPO:   {speed:52,stamina:32,dexterity:16}
  },
  // ===============================================================================
  // HOCKEY — zweite ausgelagerte Disziplin (Hockey-Plan PR 1, Teil H.8).
  //
  // Zeichengleich aus FELDSPIEL_ART.hockey uebernommen, KEINE Zahl geaendert. Abnahme
  // war das Ereignisprotokoll von window.__arena.spiele("hockey", saat) fuer die Saaten
  // 1337, 4242 und 99991 — vorher wie nachher byte-identisch, dasselbe Verfahren, mit
  // dem #726 den Basketball-Umzug belegt hat.
  //
  // WAS MAN BEIM NAECHSTEN ANFASSEN WISSEN MUSS. Hockey faehrt heute NICHT den
  // Live-Motor, sondern den Vorab-Pfad: bauFeldspiel rechnet das Ergebnis in einer
  // Schleife durch, es gibt keine Manndeckung, keine Zonen und keine Standphasen. Die
  // sieben Sub-Skills unten sind deshalb Basketballs alte Sieben, nicht hockeyeigene.
  // Gemessen (scripts/miss-hockey-bestand.mjs) tragen sie mechanisch sehr ungleich:
  // ABWEHR 33,5 % gegen ZWEITCHANCE 1,4 %, und stamina hat mit AUSDAUER als einziger
  // Heimat 1,6 % verfuegbar bei Matrixvorgabe 10. Die Pp-Abweichung liegt bei 48,1
  // (n=48), die Rangtreue bei rho 0,493 (n=24, jeSeite 6, seit PR #732 messbar).
  //
  // AN DIESEN ZAHLEN JETZT ZU DREHEN LOHNT NICHT — und das ist ein Befund, keine
  // Bequemlichkeit: ein Kandidatenrezept, das 48,1 auf 14,2 Pp druecken wuerde, ist
  // gemessen und BEWUSST NICHT eingebaut, weil seine Gewichte fuer die Vorab-Mechanik
  // gelten und nach der Live-Migration (Plan H.8, PR 3b) wertlos waeren. Reihenfolge
  // schlaegt Rezeptqualitaet. Das eigene Sub-Skill-Set kommt in PR 4, zusammen mit
  // Zonenmodell, Erfolgsformel und Impact-Formel — in genau dieser Reihenfolge, weil
  // jede davon die Sondierungsgewichte verschiebt (Plan H.5). INZWISCHEN UEBERHOLT: die
  // Live-Migration (hockey-eigene-erfolgskurve, 02.09.) ist gelaufen, und das Rezept unten
  // ist das hockeyeigene Ergebnis der Sondierung, nicht mehr Basketballs alte Sieben.
  // ===============================================================================
  // NACH DER SONDIERUNG NEU GEBAUT (docs/design/hockey-rezept-ursache.md) — der obige
  // Platzhalter-Hinweis ("Schritt 4 kommt nach der Live-Migration") ist ueberholt: die
  // Sondierung selbst braucht keine Live-Migration, nur einen stehenden Motor, und der
  // steht seit `hockey-eigene-erfolgskurve` (TEAMGEIST raus, SCHUSS_NAH/FERN neu gefittet).
  // `scripts/sondiere-feldspiel-subskills.mjs hockey 24 0` + `scripts/baue-feldspiel-
  // rezept.mjs` (Sinkhorn, Chris' Budget-Methode, exakt das Verfahren hinter Arena/Bahn/
  // Basketball) liefern daraus ein Rezept mit 0,00 Pp Abweichung zu den gemessenen
  // Sub-Skill-Gewichten — UND DAS WAR SCHLECHTER als dieses hier: rho je Spiel 0,582 gegen
  // 0,617, rho Saison 0,755 gegen 0,783 (n=24, zweimal identisch reproduziert).
  //
  // URSACHE (gemessen, nicht vermutet — voller Befund samt verworfener Hypothese im
  // Bericht): NICHT "ein Attribut wird ueberladen" — die mittlere Sub-Skill-Kreuzkorrelation
  // sank mit dem Sinkhorn-Rezept sogar (0,467 auf 0,408 ueber alle Paare). Der echte Grund:
  // Sinkhorn balanciert nur Zeilen-/Spaltensummen, kennt aber keine "das hier muss das
  // FUEHRENDE Attribut bleiben"-Nebenbedingung. Power wird von fuenf Sub-Skills zugleich
  // angefragt (AUFBAU/ABSCHLUSS/SCHUSS_FERN/ZWEITCHANCE/ABWEHR); die beiden schwersten
  // (ABSCHLUSS 17,7 %, ZWEITCHANCE 17,5 %) zogen dabei so viel von Powers 18-Punkte-Budget
  // ab, dass SCHUSS_FERN — laut Hockey-Plan B.2 ausdruecklich "fuehrt power" — nur noch 17 %
  // Power bekam und den Rest (53 %!) aus SPEED auffuellen musste. Auf dem festen 12-Spieler
  // Testkader (demselben, den jede dieser Sonden benutzt) korreliert Power mit der
  // Matrix-Eignung mit rho 0,68, Speed mit rho -0,06 — ein rein rechnerisch bilanzierter
  // Tausch, der die Korrelation mit der Eignung zerstoert, ohne dass eine einzige Pp-Zahl
  // das anzeigt. Ebenso bei ABSCHLUSS: B.2 sieht dort "power, spirit" vor (keine Verletzung
  // der Dokumentation), aber Sinkhorns 63/37-Aufteilung gibt Spirit (rho -0,34 zur Eignung
  // auf diesem Kader) zu viel Gewicht gegenueber Power (rho 0,68).
  //
  // DER FIX HIER: dieselben, von B.2 erlaubten Attribute, aber innerhalb von ABSCHLUSS und
  // SCHUSS_FERN zugunsten von Power nachjustiert (Power bleibt das statuarisch fuehrende
  // Attribut, wie B.2 es fuer SCHUSS_FERN ausdruecklich verlangt) — alle uebrigen neun
  // Sub-Skills unveraendert aus dem Sinkhorn-Ergebnis uebernommen. Verifiziert:
  //
  //   n=24  rho je Spiel 0,647  rho Saison 0,860   (vorher: 0,617 / 0,783)
  //   n=48  rho je Spiel 0,626  rho Saison 0,846   (vorher: 0,607 / 0,804)
  //   Basketball bei beiden n bit-identisch zum unveraenderten Stand (0,820/0,881 bzw.
  //   0,821/0,895) — keine Regression durch diese Datei.
  //
  // AUFBAU/SCHUSS_NAH/TECHNIK/ZWEITCHANCE/ABWEHR/TEAMGEIST/AUSDAUER/LAUFTEMPO unveraendert
  // aus dem Sinkhorn-Lauf: ihre Einzel-Korrelation mit der Eignung war beim Sinkhorn-Rezept
  // gleich gut oder besser als beim alten Handrezept, dort war nichts zu reparieren.
  // PARADE bleibt wie zuvor unangetastet (Torwart-Rolle, eigene Messung/Rangtreue-nach-Rolle).
  // ===============================================================================
  hockey:{
    AUFBAU:      {stamina:57,speed:23,awareness:13,power:7},
    // Sinkhorn gab hier 63/37 (Power/Spirit) — auf dem Testkader korreliert Spirit mit der
    // Eignung NEGATIV (rho -0,34), Power stark positiv (rho 0,68). Nachjustiert auf 82/18,
    // ohne die von B.2 vorgesehenen Attribute zu verlassen (s. Blockkommentar oben).
    ABSCHLUSS:   {power:82,spirit:18},
    TECHNIK:     {awareness:46,determination:31,dexterity:23},
    ZWEITCHANCE: {health:62,power:23,torment:15},
    ABWEHR:      {speed:26,health:24,will:24,determination:11,power:9,torment:6},
    TEAMGEIST:   {torment:53,spirit:47},
    AUSDAUER:    {stamina:57,health:20,will:19,spirit:4},
    // SCHUSS_NAH fuehrt jetzt Health statt Power — gemessen BESSER als beim alten Rezept
    // (Sub-Skill-Korrelation zur Eignung 0,36 -> 0,76 auf dem Testkader), deshalb hier vom
    // Sinkhorn-Lauf unveraendert uebernommen.
    SCHUSS_NAH:  {health:63,dexterity:22,torment:15},
    // Sinkhorn gab hier 53/30/17 (Speed/Awareness/Power) und verletzte damit B.2 ("SCHUSS_FERN
    // fuehrt power") als Nebenwirkung der Power-Konkurrenz mit ABSCHLUSS/ZWEITCHANCE (s.
    // Blockkommentar oben) — Speed korreliert auf dem Testkader praktisch gar nicht mit der
    // Eignung (rho -0,06). Nachjustiert auf 47/30/23, Power wieder fuehrend wie geplant.
    SCHUSS_FERN: {power:47,awareness:30,speed:23},
    LAUFTEMPO:   {stamina:66,speed:26,dexterity:8},
    // PARADE FUEHRT HEALTH, nicht Awareness — nachgezogen, weil der Slot es so ausweist.
    // Der Torwart-Slot (SLOTS_JE_DISC.hockey, aus dem Generator) traegt gross:"health",
    // klein:"awareness" und hebt im Profil health auf 26. Im Aufstellungsbildschirm steht
    // damit "haelt den Kasten sauber ueber Health und Awareness" — und der Wert, der die
    // Paraden wirklich entscheidet, las health mit NULL. Ein Spieler, den der Slot
    // ausdruecklich fuer diese Position empfiehlt, wurde davon kein besserer Torwart.
    // Health ist ausserdem mit 18 das schwerste Attribut der Hockey-Matrix; ueber
    // awareness (8) und will/determination (je 4) laesst sich ein Torwart, der zur
    // Disziplin passt, gar nicht bauen.
    PARADE:      {health:45,awareness:30,dexterity:15,will:10}
  }
};
