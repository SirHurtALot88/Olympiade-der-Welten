/**
 * SPONSOR-UEBERSICHT: DIE EINE FUNKTION FUER DIE NEUE SEITE (24.11., Konzept 4.8, Mockup public/mockups/sponsoren-modern-22-11.html).
 *
 * `baueSponsorUebersicht(gameState, teamId)` liefert alles, was die vier Ansichten der Seite brauchen (Vertrag, Angebote, Liga-Vergleich,
 * Rechnung). Sie rechnet NICHTS selbst, sondern liest dieselben Funktionen, die buchen (`sponsor-topf-buchung.ts`, `sponsor-topf-modell.ts`):
 * gezeigt = gebucht. Form der Antwort: docs/design/sponsoren-rework-bau-24-11.md, Abschnitt "View-Modell".
 *
 * Gilt die Topf-Regel nicht (alter Spielstand, Notbremse "alt"), kommt `null`: die alte Seite bleibt zustaendig.
 */
import type { GameState } from "@/lib/data/olyDataTypes";
import { summeSpieltagBuchungen, spieltageDerSaison } from "@/lib/finance/finanzen-je-spieltag";
import { isScoutingNebelAus } from "@/lib/market/transfermarkt-nebel-einstellung";
import { gueltigerSponsorStempel, sponsorLeistungAktiv, sponsorTopfAktiv } from "@/lib/resolve/sponsor-regel";
import { getTeamSponsorContract, getTeamSponsorOffers } from "@/lib/sponsor/sponsor-offer-read";
import {
  SPONSOR_FARBEN,
  SPONSOR_TOPF,
  SPONSOR_VERTRAGSARTEN,
  leihKursFuerPassung,
  leistungSatzJePlatz,
  passungRoh,
  passungText,
  runde1,
  treueBonus,
  vertragsartHebel,
  vertragsartLabel,
  vertragsartZielEinsatz,
  zBeliebtheit,
  zTreue,
  type SponsorLiga,
} from "@/lib/sponsors/sponsor-topf-modell";
import { kaderBeliebtheit, ligaGroesseVon, treueSaisonsFuerMarke, werbegeldMittel } from "@/lib/sponsors/sponsor-topf-eingaben";
import {
  topfFarbVerteilung,
  topfLeistungJetzt,
  topfStandFuer,
  topfZielAuszahlung,
  leihVerzichtJahr,
  RANG_ABSCHLAG_QUOTE_TOPF,
} from "@/lib/sponsors/sponsor-topf-buchung";
import { fuelleFehlendeVertraege } from "@/lib/sponsors/sponsor-topf-stichtag";
import { sponsorTermine } from "@/lib/sponsors/sponsor-topf-termine";
import type { SponsorFarbe, SponsorTermin, SponsorVertragsart } from "@/lib/sponsors/sponsor-topf-typen";

export type UebersichtZeile = {
  /** Betrag der Saison, wenn sie heute endete (Hochrechnung), und je Spieltag. */
  saison: number;
  jeSpieltag: number;
  /** Bereits gebucht (Ledger) und noch offen bis zum Saisonende. */
  gebucht: number;
};

export type SponsorUebersicht = {
  teamId: string;
  seasonId: string;
  liga: SponsorLiga;
  spieltage: number;
  gebuchteSpieltage: number;
  /** true = Stichtag war; false = Vorschau, Zahlen koennen sich bis zur ersten Wertung noch bewegen. */
  eingefroren: boolean;
  /** true = vor dem Stichtag: die Zahlen sind die Rechnung, die der Stichtag bucht (inkl. Vorab-Zusage), aber noch nicht gesperrt. */
  vorlaeufig: boolean;
  notbremse: boolean;
  faktor: number;
  vertrag: null | {
    markeName: string;
    sponsorBrandId: string | null;
    sponsorParentBrandId: string | null;
    vertragsart: SponsorVertragsart;
    vertragsartLabel: string;
    hebel: number;
    laufzeit: number;
    jahr: number;
    restSaisons: number;
    farben: SponsorFarbe[];
    passung: { wert: number; text: string };
    treueBonus: number;
    /** Die vier Zeilen der Vertragskarte. */
    zeilen: {
      grund: UebersichtZeile & { treue: number; leihVerzicht: number };
      leistung: UebersichtZeile & { abrechnungshinweis: string; satzJePlatz: number; platzJetzt: number | null; erwartungsrang: number; abstand: number | null };
      farbe: UebersichtZeile;
      ziel: UebersichtZeile & { einsatz: number; erfuellung: number };
    };
    hochrechnung: { saison: number; jeSpieltag: number; gebucht: number };
    /** Nur bei einem aus dem alten System ueberfuehrten Vertrag: was der alte Vertrag erwarten liess und was der neue bei Erwartung zahlt (offene Anzeige der Aenderung). */
    ueberfuehrung: null | { alterAnker: number | null; neuBeiErwartung: number; differenz: number | null };
  };
  /** Leistungsteil je gebuchtem Spieltag gegen die Erwartung (aus dem Ledger: Platz und gebuchter Abschlag). */
  leistungVerlauf: Array<{ spieltag: number; platz: number | null; erwartungsrang: number; abschlag: number }>;
  farbPartner: Array<{
    farbe: SponsorFarbe;
    liga: SponsorLiga;
    topf: number;
    teilnehmer: number;
    platz: number | null;
    punkte: number;
    betragHeute: number;
    rangliste: Array<{ teamId: string; teamName: string; punkte: number; betrag: number; platz: number }>;
  }>;
  termine: SponsorTermin[];
  angebote: Array<{
    offerId: string;
    markeName: string;
    sponsorParentBrandId: string | null;
    passung: { wert: number; text: string; zBeliebtheit: number; treueSaisons: number };
    leihKurs: number | null;
    /** Richtwert des Grundbetrags (vorlaeufig; die Vorab-Zusage ist 90 % davon) je Saison und je Spieltag. */
    grundbetragRichtwert: { saison: number; jeSpieltag: number; zusage: number };
    arten: Array<{
      vertragsart: SponsorVertragsart;
      label: string;
      hebel: number;
      zielEinsatz: number;
      satzJePlatz: number;
      /** Leistungsteil + Ziel bei Rang 1, bei Erwartung, bei Rang 16 (Mittelterm 0): die Auszahlungskurve des Mockups. */
      spannweite: { besterRang: number; beiErwartung: number; schlechtesterRang: number };
    }>;
    laufzeiten: Array<{ laufzeit: 1 | 2 | 3; treueBonusJahr: number[] }>;
  }>;
  liga_vergleich: Array<{
    teamId: string;
    teamName: string;
    liga: SponsorLiga;
    /** true = fremdes Team: die Seite zeigt Erwartungsrang und Kaderstaerke nur als grobe Stufe (Scouting-Nebel). */
    nebel: boolean;
    markeName: string | null;
    vertragsart: SponsorVertragsart | null;
    farben: SponsorFarbe[];
    erwartungsrang: number;
    platz: number | null;
    grund: number;
    leistungHeute: number;
    farbHeute: number;
    zielHeute: number;
    summeHeute: number;
    kosten: number;
    planEinnahmen: number;
    /** GuV bei "alle auf Erwartungsrang": Grund + Farb-Mittel - (Kosten - Plan-Einnahmen) - Kader-Ersatz. */
    guvBeiErwartung: number | null;
  }>;
  rechnung: {
    schritte: Array<{ id: "betrieb" | "ersatz" | "wertkorrektur" | "faktor" | "verteilung"; titel: string; formel: string; wert: number }>;
    betriebsteil: number;
    betriebsteilRoh: number;
    kaderErsatz: number;
    uebertrag: number;
    /** Liga-Wert-Korrektur (Rueckkopplung, wirkt neben dem Uebertrag; Doppelreaktion siehe Bau-Doku Abschnitt 13). */
    wertKorrektur: number;
    topf: number;
    farbToepfe: { liga1: number; liga2: number };
    treueSumme: number;
    hauptTopf: number;
    ligaMittelBeiErwartung: number;
  };
};

function teamName(gameState: GameState, id: string): string {
  return gameState.teams.find((t) => t.teamId === id)?.name ?? id;
}

export function baueSponsorUebersicht(gameState: GameState, teamId: string): SponsorUebersicht | null {
  if (!sponsorTopfAktiv(gameState)) return null;
  // Vor dem Stichtag zeigt die Seite, was der Stichtag buchen wird: dieselbe Rechnung (fehlende Vertraege gefuellt, Vorab-Zusage 90 % mit
  // anteiliger Kuerzung) auf demselben Weg wie `sichereSponsorTopf`.
  const eingefroren = Boolean(gueltigerSponsorStempel(gameState)?.eingefroren);
  const stand = topfStandFuer(eingefroren ? gameState : fuelleFehlendeVertraege(gameState), { live: true });
  const t = stand?.teams[teamId];
  if (!stand || !t) return null;
  const stempel = gueltigerSponsorStempel(gameState)!;
  const seasonId = gameState.seasonState.seasonId ?? gameState.season.id;
  const n = Math.max(1, spieltageDerSaison(gameState));
  const gebucht = summeSpieltagBuchungen(gameState, teamId);
  const leistung = topfLeistungJetzt(gameState)!;
  const farbe = topfFarbVerteilung(gameState)!;
  const contract = getTeamSponsorContract(gameState, teamId);
  const liga = t.liga;
  const aktiv = sponsorLeistungAktiv(gameState);
  const satz = leistungSatzJePlatz(liga, stand.faktor, stand.sigma, t.hebel);

  // Vertragskarte
  const ziel = contract ? topfZielAuszahlung(gameState, contract) : { betrag: 0, erfuellung: 0, einsatz: 0 };
  const leistungHeute = leistung.leistung[teamId] ?? 0;
  const farbHeute = farbe.jeTeam[teamId] ?? 0;
  const verzicht = contract ? leihVerzichtJahr(contract) : 0;
  const grundJahr = runde1(t.grundbetrag + t.treue - verzicht);
  const gebuchteSpieltage = summeSpieltagBuchungen(gameState, teamId).anzahl;
  const vertrag = contract
    ? {
        markeName: contract.name,
        sponsorBrandId: contract.sponsorBrandId ?? null,
        sponsorParentBrandId: contract.sponsorParentBrandId ?? null,
        vertragsart: (contract.sponsorTopf?.vertragsart ?? "leistung") as SponsorVertragsart,
        vertragsartLabel: vertragsartLabel(contract.sponsorTopf?.vertragsart ?? "leistung"),
        hebel: t.hebel,
        laufzeit: contract.sponsorTopf?.laufzeit ?? contract.termSeasons ?? 1,
        jahr: contract.sponsorTopf?.jahr ?? 1,
        restSaisons: contract.seasonsRemaining ?? 1,
        farben: t.farben,
        passung: { wert: t.passung, text: passungText(t.passung, 0, contract.sponsorTopf?.treueSaisons ?? 0) },
        treueBonus: t.treue,
        zeilen: {
          grund: { saison: grundJahr, jeSpieltag: runde1(grundJahr / n), gebucht: gebucht.sponsorBasis, treue: t.treue, leihVerzicht: verzicht },
          leistung: {
            saison: leistungHeute,
            // Gebucht wird je Spieltag nur RANG_ABSCHLAG_QUOTE (80 %) des Leistungsteils / N; der Rest wird zum Saisonende ausgeglichen.
            jeSpieltag: runde1((RANG_ABSCHLAG_QUOTE_TOPF * leistungHeute) / n),
            gebucht: gebucht.rangAbschlag,
            abrechnungshinweis: "Je Spieltag werden 80 % des Leistungsteils gebucht; der Rest wird zum Saisonende ausgeglichen.",
            satzJePlatz: satz,
            platzJetzt: leistung.rang[teamId] ?? null,
            erwartungsrang: t.erwartungsrang,
            abstand: leistung.rang[teamId] != null ? Math.round((t.erwartungsrang - leistung.rang[teamId]!) * 10) / 10 : null,
          },
          farbe: { saison: farbHeute, jeSpieltag: runde1(farbHeute / n), gebucht: 0 },
          ziel: { saison: ziel.betrag, jeSpieltag: runde1(ziel.betrag / n), gebucht: 0, einsatz: ziel.einsatz, erfuellung: ziel.erfuellung },
        },
        ueberfuehrung:
          contract.sponsorTopf?.gewaehltVon === "ueberfuehrt"
            ? (() => {
                const neu = runde1(grundJahr + (stand.farbTopf[liga - 1]! * 4) / Math.max(1, Object.values(stand.teams).filter((x) => x.liga === liga).length));
                const alt = contract.sponsorTopf?.vorherAnker ?? null;
                return { alterAnker: alt, neuBeiErwartung: neu, differenz: alt == null ? null : runde1(neu - alt) };
              })()
            : null,
        hochrechnung: {
          saison: runde1(grundJahr + leistungHeute + farbHeute + ziel.betrag),
          jeSpieltag: runde1((grundJahr + leistungHeute + farbHeute + ziel.betrag) / n),
          gebucht: runde1(gebucht.sponsorBasis + gebucht.rangAbschlag),
        },
      }
    : null;

  // Leistungsteil je Spieltag
  const leistungVerlauf = (gameState.seasonState.spieltagFinanzen ?? [])
    .filter((b) => b.seasonId === seasonId && b.teamId === teamId)
    .sort((a, b) => a.matchdayIndex - b.matchdayIndex)
    .map((b) => ({ spieltag: b.matchdayIndex, platz: b.rang ?? null, erwartungsrang: t.erwartungsrang, abschlag: b.rangAbschlag ?? 0 }));

  // Farb-Partner dieses Teams
  const farbPartner = (vertrag?.farben ?? []).map((f) => {
    const topf = farbe.toepfe.find((x) => x.liga === liga && x.farbe === f)!;
    const zeilen = farbe.zeilen.filter((z) => z.liga === liga && z.farbe === f).sort((a, b) => a.platz - b.platz);
    const eigene = zeilen.find((z) => z.teamId === teamId) ?? null;
    return {
      farbe: f,
      liga,
      topf: topf.topf,
      teilnehmer: topf.teilnehmer,
      platz: eigene?.platz ?? null,
      punkte: eigene?.punkte ?? 0,
      betragHeute: eigene?.betrag ?? 0,
      rangliste: zeilen.map((z) => ({ teamId: z.teamId, teamName: teamName(gameState, z.teamId), punkte: z.punkte, betrag: z.betrag, platz: z.platz })),
    };
  });

  // Angebote (nur solange kein Vertrag laeuft oder zum Saisonwechsel)
  const mittel = werbegeldMittel(gameState);
  const zBel = zBeliebtheit(kaderBeliebtheit(gameState, teamId), mittel[liga]);
  const vorlGrund = stempel.vorlaeufig?.grund[teamId] ?? t.grundbetrag;
  const refRoh = contract?.sponsorTopf ? passungRoh(zBel, zTreue(contract.sponsorTopf.treueSaisons)) : 1;
  const ligaPassungMittel = 1;
  const angebote = (contract ? [] : getTeamSponsorOffers(gameState, teamId)).map((o) => {
    const treue = treueSaisonsFuerMarke(gameState, teamId, o.sponsorParentBrandId);
    const roh = passungRoh(zBel, zTreue(treue));
    const norm = roh / ligaPassungMittel;
    const richtwert = runde1(vorlGrund * (roh / refRoh));
    const hasLeihe = Boolean(o.sponsorLeihe);
    return {
      offerId: o.offerId,
      markeName: o.name,
      sponsorParentBrandId: o.sponsorParentBrandId ?? null,
      passung: { wert: norm, text: passungText(norm, zBel, treue), zBeliebtheit: zBel, treueSaisons: treue },
      leihKurs: hasLeihe ? leihKursFuerPassung(norm) : null,
      grundbetragRichtwert: { saison: richtwert, jeSpieltag: runde1(richtwert / n), zusage: runde1(richtwert * SPONSOR_TOPF.zusage) },
      arten: SPONSOR_VERTRAGSARTEN.map((art) => {
        const h = vertragsartHebel(art);
        const s = leistungSatzJePlatz(liga, stand.faktor, stand.sigma, h);
        const einsatz = vertragsartZielEinsatz(art);
        const bei = (rang: number) => runde1(s * (t.erwartungsrang - rang) + 0);
        return {
          vertragsart: art,
          label: vertragsartLabel(art),
          hebel: h,
          zielEinsatz: einsatz,
          satzJePlatz: s,
          spannweite: { besterRang: bei(1), beiErwartung: bei(t.erwartungsrang), schlechtesterRang: bei(ligaGroesseVon(gameState, teamId)) },
        };
      }),
      laufzeiten: ([1, 2, 3] as const).map((l) => ({ laufzeit: l, treueBonusJahr: Array.from({ length: l }, (_, i) => treueBonus(i + 1)) })),
    };
  });

  // Liga-Vergleich (eigene Liga, 16 Teams)
  const ligaTeams = Object.values(stand.teams).filter((x) => x.liga === liga);
  const farbMittel = (4 * stand.farbTopf[liga - 1]!) / Math.max(1, ligaTeams.length);
  const kaderErsatzJeTeam = stand.rechnung.kaderErsatz / Math.max(1, Object.keys(stand.teams).length);
  const nebelAn = !isScoutingNebelAus(gameState);
  const grob5 = (v: number) => Math.round(v / 5) * 5;
  const liga_vergleich = ligaTeams
    .map((x) => {
      const fremd = x.teamId !== teamId && nebelAn;
      const c = getTeamSponsorContract(gameState, x.teamId);
      const z = c ? topfZielAuszahlung(gameState, c) : { betrag: 0, erfuellung: 0, einsatz: 0 };
      const l = leistung.leistung[x.teamId] ?? 0;
      const f = farbe.jeTeam[x.teamId] ?? 0;
      const grund = runde1(x.grundbetrag + x.treue);
      return {
        teamId: x.teamId,
        teamName: teamName(gameState, x.teamId),
        liga: x.liga,
        nebel: fremd,
        markeName: c?.name ?? null,
        vertragsart: x.vertragsart,
        farben: x.farben,
        erwartungsrang: fremd ? Math.round(x.erwartungsrang / 4) * 4 || 4 : x.erwartungsrang,
        platz: leistung.rang[x.teamId] ?? null,
        grund,
        leistungHeute: l,
        farbHeute: f,
        zielHeute: z.betrag,
        summeHeute: runde1(grund + l + f + z.betrag),
        kosten: fremd ? grob5(x.kosten) : runde1(x.kosten),
        planEinnahmen: fremd ? grob5(x.planEinnahmen) : runde1(x.planEinnahmen),
        guvBeiErwartung: fremd ? null : runde1(grund + farbMittel - (x.kosten - x.planEinnahmen) - kaderErsatzJeTeam),
      };
    })
    .sort((a, b) => (a.platz ?? 99) - (b.platz ?? 99) || a.teamName.localeCompare(b.teamName));

  const r = stand.rechnung;
  const ligaMittelBeiErwartung = runde1(ligaTeams.reduce((sum, x) => sum + (x.grundbetrag + x.treue + farbMittel - (x.kosten - x.planEinnahmen) - kaderErsatzJeTeam), 0) / Math.max(1, ligaTeams.length));
  return {
    teamId,
    seasonId,
    liga,
    spieltage: n,
    gebuchteSpieltage,
    eingefroren: stand.eingefroren,
    vorlaeufig: !stand.eingefroren,
    notbremse: !aktiv,
    faktor: stand.faktor,
    vertrag,
    leistungVerlauf,
    farbPartner,
    termine: sponsorTermine(gameState, teamId),
    angebote,
    liga_vergleich,
    rechnung: {
      schritte: [
        { id: "betrieb", titel: "Kosten der Liga abzueglich uebriger Einnahmen", formel: `K_B = Summe (Gehaelter + Unterhalt + Zins - Tickets - Marketing - Medaillen - Ziele - Gebaeude), ${Math.round(SPONSOR_TOPF.bremse[0] * 100)} bis ${Math.round(SPONSOR_TOPF.bremse[1] * 100)} % der Vorsaison`, wert: r.betriebsteil },
        { id: "ersatz", titel: "Kader-Ersatz", formel: `K_E = ${Math.round(SPONSOR_TOPF.kaderErsatzAnteil * 100)} % des Kaderwerts der Liga (Saison 1: +${Math.round(SPONSOR_TOPF.kaderErsatzZuschlagSaison1 * 100)} %)`, wert: r.kaderErsatz },
        { id: "wertkorrektur", titel: "Liga-Wert-Korrektur", formel: `Rueckkopplung ${SPONSOR_TOPF.wertRueckkopplung} x Wertaenderung der Liga, fortgeschrieben, Deckel ${Math.round(SPONSOR_TOPF.wertKorrekturDeckel * 100)} % des Topfs`, wert: r.wertKorrektur ?? 0 },
        { id: "faktor", titel: "Saisonfaktor", formel: "Topf T = F x (K_B + K_E) - Uebertrag - Korrektur", wert: stand.topf },
        { id: "verteilung", titel: "Verteilung", formel: "Hauptsponsor-Topf = T - Farb-Toepfe - Treueboni; Grundbetrag nach Liga-Anteil, Erwartungsrang, Beliebtheit, Passung", wert: stand.hauptTopf },
      ],
      betriebsteil: r.betriebsteil,
      betriebsteilRoh: r.betriebsteilRoh,
      kaderErsatz: r.kaderErsatz,
      uebertrag: r.uebertrag,
      wertKorrektur: r.wertKorrektur ?? 0,
      topf: stand.topf,
      farbToepfe: { liga1: stand.farbTopf[0], liga2: stand.farbTopf[1] },
      treueSumme: r.treueSumme,
      hauptTopf: stand.hauptTopf,
      ligaMittelBeiErwartung,
    },
  };
}

export { SPONSOR_FARBEN };
