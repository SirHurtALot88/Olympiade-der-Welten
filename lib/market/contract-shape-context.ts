/**
 * WAS DIE VERTRAGSFORM AUS DER TEAMLAGE WISSEN MUSS — Apron-Spielraum und der bisherige Mix.
 *
 * GEMELDET VON CHRIS: „Top Teams sollten wenn es geht evtl mehr die Mechanik nutzen Front und Back
 * Loaded verträge zu gestalten um die Apron probleme ggf. umgehen zu können."
 * Und als Grenze dazu: „es sollen ja nicht alle top teams dann nur back loaded nehmen […] dann hast
 * du irgendwann nen sehr teuren gehaltspeak das muss auch vermieden werden, der mix machts."
 *
 * WICHTIG — WAS DIE FORM NICHT KANN, UND ZWAR WIEDER NICHT. Die Apron-Abgabe lässt sich damit NICHT
 * umgehen: sie bemisst das bei Unterschrift VERHANDELTE Jahresgehalt (`getTeamApronSalaryBase` →
 * `getTeamNegotiatedSalaryTotal`), und das ist formunempfindlich. Ein Formwechsel ändert die Abgabe
 * um 0,00.
 *
 * DIESER ABSATZ WAR ZWISCHENZEITLICH FALSCH, in zwei Schichten: er nannte `getTeamDisplaySalaryTotal`
 * als Grundlage (das Formel-Gehalt — schon damals überholt), während die Grundlage tatsächlich auf
 * die formABHÄNGIGE Jahresrate umgestellt worden war. Die Absicht, die er beschreibt, galt also
 * gerade nicht. Seit Chris' dritter Entscheidung gilt sie wieder, und die Grundlage heißt jetzt
 * auch wirklich so.
 *
 * WAS DIE FORM SEHR WOHL BEWEGT: den CASHFLOW, also die Zahlung dieser Saison
 * (`getTeamActualSalaryTotal`, `resolvePlayerEconomyContract().salary`). Über die volle Laufzeit
 * zahlt man exakt `verhandelt × Jahre` — `buildContractSalarySchedule` erhält die Summe, für alle
 * drei Formen nachgerechnet. Die Form entscheidet nur, WANN das Geld fließt: wer heute Kasse hat,
 * front-loadet und entlastet spätere Jahre; wer knapp steht, verschiebt nach hinten.
 *
 * DIESE FOLGE IST JETZT GEZOGEN (Chris, 20.08.2026: „a als ein faktor"). Die Regel steuerte die
 * Formwahl über `apronHeadroom` — also so, als ließe sich damit die Abgabe bewegen. Genau das kann
 * sie seit der Rücknahme nicht mehr; die Regel feuerte ins Leere. Gesteuert wird jetzt über den
 * KASSENSTAND. Das ist die Größe, die die Form wirklich bewegt: sie verschiebt Geld zwischen
 * Jahren, sonst nichts. Warum der blanke Kontostand und nicht `cash − Rücklage` steht am Feld
 * `kassenstand` — kurz: 156 von 160 Teams liegen unter ihrer Rücklage, das wäre kein Riegel
 * gewesen, sondern ein Verbot.
 *
 * DIESE DATEI HÄLT DIE REGEL — NICHT DIE AUFRUFER. Es gibt DREI unabhängige Formwähler im Spiel,
 * und alle drei rufen `wendeLiquiditaetUndMixAn`. Neue Formwähler gehören ebenfalls hierher.
 *
 * DER SPIELERWUNSCH BRAUCHTE KEINE ÄNDERUNG — nachgesehen statt vermutet: `contractShape` startet
 * in `recommendContractOfferForPlayer` bei `basePreference.shapePreference`, also beim Wunsch des
 * Spielers (contract-negotiation-preview.ts, „let contractShape = basePreference.shapePreference").
 * Ein Team, dem die Form egal ist, geht also bereits auf ihn ein; erst eine team-eigene Regel
 * verschiebt ihn. Was NICHT existiert, ist die Ersparnis: `shapePreference` hat heute nirgends ein
 * Preisgewicht — die Erfüllung des Wunsches kostet und spart 0,00. Das wäre eine neue Mechanik und
 * ist Chris' Entscheidung, nicht meine.
 *
 * WELCHE KAUFWEGE HEUTE WIRKLICH LAUFEN — nachgemessen, nicht aus Altbeständen geschlossen. Der
 * Füll-Lauf (`auto-roster-fill-service.ts`) ist AB SAISON 2 VERBOTEN, die Sperre steht im Dienst
 * selbst („keine filler mehr! VERBOT" — Chris); gepickt wird nur noch organisch. An den Transfers
 * der Spielstände abzulesen: `ai_roster_fill` kommt AUSSCHLIESSLICH in Saison 1 vor (334 bzw. 329
 * Zeilen), in Saison 2 stehen dort `ai_organic_squad_buy` (69) und `ai_preseason_market_buy` (33).
 * Wer aus der blossen Menge der `ai_roster_fill`-Zeilen schliesst, dieser Weg sei der wichtigste,
 * irrt doppelt: die Zeilen sind historisch, und ein Teil davon stammt aus dem verbotenen Dienst.
 *
 *   - `ai_organic_squad_buy` übergibt keine Form und fällt auf `recommendContractOfferForPlayer`
 *     zurück (Slow-Path, `transfermarkt-local-service.ts:1144`).
 *   - `ai_preseason_market_buy` holt die Form ausdrücklich aus derselben Empfehlung
 *     (`ai-market-plan-apply-service.ts:2027`).
 *   - Der organische Setup-Draft der Saison 1 läuft über den Fast-Batch
 *     (`transfermarkt-local-service.ts:2402`) und BESCHRIFTET seine Transfers weiterhin mit
 *     `ai_roster_fill` — daher rührt das Etikett, nicht vom verbotenen Dienst.
 *   - Verlängerungen (`contract-renewal-service.ts`) sind der grösste Strom überhaupt: 121 von 176
 *     KI-Verlängerungen mehrjährig in Saison 2.
 *
 * Eine erste Fassung verdrahtete nur den Slow-Path; Fables Audit hat aufgedeckt, dass Fast-Batch
 * und Verlängerung apron-blind blieben.
 */
import type { ContractShape, GameState } from "@/lib/data/olyDataTypes";

export type ContractShapeTeamContext = {
  /**
   * Der Kontostand des Teams. Null oder negativ heisst: kein Geld, um zusätzlich früh zu zahlen.
   *
   * WARUM NICHT `cash − Rücklage`, obwohl das die naheliegende Größe wäre — nachgemessen an den
   * fünf Abbildern (160 Teams): **156 von 160 liegen unter ihrer Rücklage** (Rücklagen-Median
   * 26,1 gegen Cash-Median 6,9). Die Rücklage ist ein SPARZIEL, keine Notlinie; als Riegel gelesen
   * hätte sie front_loaded praktisch abgeschafft. Weitere gemessene Schwellen: `cash < Rücklage/2`
   * trifft 77 %, `cash < Rücklage/4` noch 44 %.
   *
   * `cash <= 0` trifft **24 von 160 (15 %)** — die Teams, die wirklich blank sind. Der abgelöste
   * Apron-Riegel traf 35 von 160 (22 %), die Größenordnung bleibt also erhalten.
   */
  kassenstand: number;
  /**
   * DER GEHALTSBERG, IN GELD: der bereits gebundene MEHRBETRAG spaeterer Vertragsjahre, gemessen an
   * der heutigen Gehaltssumme. 0,18 heisst „das Team hat sich fuer eine spaetere Saison 18 % seiner
   * jetzigen Gehaltslast zusaetzlich ans Bein gebunden".
   */
  gehaltsbergQuote: number;
};

/**
 * AB HIER LEGT KEIN WEITERER BACK-LOADED VERTRAG MEHR NACH — gemessen am Geld, nicht an Formen.
 *
 * CHRIS' AUFTRAG: „Ja miss es an zukunftslast." Vorher zaehlte der Riegel FORM-ANTEILE (ab der
 * Haelfte back-loaded). Das war zu grob, und zwar nachweislich: ein Dreijahresvertrag im letzten
 * Jahr zaehlte noch als „back", obwohl seine teure Rate laengst JETZT faellig ist.
 *
 * WARUM NICHT EINFACH „Zukunft gegen heute". Der naheliegende Vergleich — Summe der naechsten
 * Saison gegen die laufende — ist am Abbild WERTLOS: Vertraege laufen aus, die gebundene
 * Zukunftssumme schrumpft also fast immer. Gemessen liegt die hoechste Folgesaison bei KEINEM
 * einzigen Team ueber der laufenden (Saison 1 Maximum 0,69, Saison 2 Maximum 1,04). Eine Schwelle
 * darauf haette nie ausgeloest.
 *
 * WAS STATTDESSEN GEMESSEN WIRD, ist der Aufwaerts-Knick INNERHALB der Vertraege: je Vertrag die
 * teuerste kuenftige Rate minus der Rate dieser Saison, aufsummiert und durch die heutige
 * Gehaltssumme geteilt. Auslaufende Vertraege verwaessern das nicht, weil nur der Anstieg zaehlt.
 *
 * DIE SCHWELLE 0,15 IST GEMESSEN, NICHT GESETZT. Verteilung am Live-Abbild:
 *
 *   Saison 1: Median 0,00 · Maximum 0,182 (P-C)     → 1 Team ueber 0,15
 *   Saison 2: Median 0,06 · Maximum 0,324 (U-A)     → 7 Teams ueber 0,15
 *
 * 0,15 ist rund das Zweieinhalbfache des Saison-2-Medians und trifft in BEIDEN Staenden die Teams
 * mit einem echten Berg. Gegen den alten Riegel gehalten ist das eine UMLENKUNG, keine Ausweitung:
 * in Saison 2 fingen die Form-Anteile A-A, P-C, R-R, V-V; die Geld-Messung faengt bei 0,20
 * dieselbe Zahl, aber teils andere Teams (B-B und U-A statt P-C und R-R) — U-A hat mit 0,324 den
 * groessten Berg der Liga und blieb dem alten Riegel verborgen, weil nur 40 % seiner Vertraege
 * back-loaded sind. Und P-C, das in Saison 1 als EINZIGES Team einen Berg baut (+7,2 auf 39,5),
 * war fuer den alten Riegel unsichtbar.
 *
 * DER MINDESTNENNER ENTFAELLT. Er war noetig, weil ein Anteil aus 2 von 2 Vertraegen nichts
 * aussagt. Die Geld-Messung hat dieses Problem nicht: sie normiert auf die Gehaltssumme des Teams,
 * ein einzelner kleiner Vertrag bewegt sie also kaum.
 */
export const MIX_RIEGEL_QUOTE = 0.15;

/**
 * DIE EINE REGEL, die alle Formwähler teilen. Sie VERSCHIEBT nur — sie erzeugt nie `back_loaded`.
 *
 * Chris' Grenze dazu war ausdruecklich: „achtung deine messwerte schieben alles extrem richtung
 * backloaded das gefaellt mir gar nicht." Beide Zweige liefern deshalb `balanced`.
 */
export function wendeLiquiditaetUndMixAn(input: {
  form: ContractShape;
  laufzeit: number;
  kassenstand?: number | null;
  gehaltsbergQuote?: number | null;
}): { form: ContractShape; grund: string | null } {
  // Bei Einjahresvertraegen gibt es keine Verteilung ueber die Zeit — die Form ist bedeutungslos.
  if (input.laufzeit < 2) return { form: input.form, grund: null };

  // HIER STAND DER APRON-SPIELRAUM. Er steuerte die Form so, als liesse sich damit die Abgabe
  // bewegen — seit die Bemessung wieder am verhandelten Gehalt haengt, tut sie das nicht mehr, und
  // die Regel feuerte ins Leere. Liquiditaet ist die Groesse, die die Form wirklich bewegt.
  if (input.kassenstand != null && input.kassenstand <= 0 && input.form === "front_loaded") {
    return {
      form: "balanced",
      grund: "Kasse leer: nicht zusaetzlich frueh zahlen, wenn kein Geld da ist.",
    };
  }

  if (
    input.gehaltsbergQuote != null &&
    input.gehaltsbergQuote >= MIX_RIEGEL_QUOTE &&
    input.form === "back_loaded"
  ) {
    return {
      form: "balanced",
      grund: "Gehaltsberg schon gebunden: ein weiterer back-loaded Vertrag wuerde ihn weiter auftuermen.",
    };
  }

  return { form: input.form, grund: null };
}

type Lookup = {
  byTeamId: Map<string, ContractShapeTeamContext>;
};

/**
 * Der organische Draft ruft die Kaufvorschau je Kandidat auf, und jede Vorschau braucht diese Lage.
 * Ohne Zwischenspeicher liefe die Gehaltsberg-Rechnung (ueber alle Kadervertraege des Teams) pro
 * Kandidat erneut. Der Speicher haengt am GameState-Objekt: ein neuer Zustand bekommt eine neue
 * Rechnung, ein unveraenderter wird nicht zweimal vermessen.
 */
const speicher = new WeakMap<object, Lookup>();

function baueLookup(): Lookup {
  return { byTeamId: new Map() };
}

export function getContractShapeTeamContext(gameState: GameState, teamId: string): ContractShapeTeamContext {
  let lookup = speicher.get(gameState as unknown as object);
  if (!lookup) {
    lookup = baueLookup();
    speicher.set(gameState as unknown as object, lookup);
  }
  const vorhanden = lookup.byTeamId.get(teamId);
  if (vorhanden) return vorhanden;

  const kassenstand = Number((gameState.teams.find((entry) => entry.teamId === teamId)?.cash ?? 0).toFixed(1));

  // DER BERG IN GELD. Je Vertrag: teuerste kuenftige Rate minus Rate dieser Saison, nur der
  // ANSTIEG zaehlt (deshalb `Math.max(0, …)`) — ein auslaufender oder front-loaded Vertrag drueckt
  // die Quote nicht kuenstlich. Geteilt wird durch die Summe der Raten DIESER Saison, also durch
  // das, was das Team gerade wirklich zahlt.
  const kader = (gameState.rosters ?? []).filter((entry) => entry.teamId === teamId);
  let jetzt = 0;
  let mehrbetrag = 0;
  for (const entry of kader) {
    const raten = (entry.yearlySalarySchedule ?? [])
      .map((jahr) => (Number.isFinite(jahr?.salary) ? jahr.salary : 0));
    if (raten.length === 0) {
      // Bestandsvertraege ohne Schedule tragen keine Verteilung — sie zaehlen nur zur Basis.
      jetzt += Number.isFinite(entry.salary) ? entry.salary : 0;
      continue;
    }
    jetzt += raten[0] ?? 0;
    if (raten.length >= 2) {
      mehrbetrag += Math.max(0, Math.max(...raten.slice(1)) - (raten[0] ?? 0));
    }
  }
  const gehaltsbergQuote = jetzt > 0 ? Number((mehrbetrag / jetzt).toFixed(3)) : 0;

  const ergebnis: ContractShapeTeamContext = { kassenstand, gehaltsbergQuote };
  lookup.byTeamId.set(teamId, ergebnis);
  return ergebnis;
}
