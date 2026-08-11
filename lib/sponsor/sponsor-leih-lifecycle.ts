/**
 * WAS MIT EINER LEIHGABE ZWISCHEN ZWEI SAISONS PASSIERT — und was am Vertragsende.
 *
 * DIE LUECKE, DIE DIESE DATEI SCHLIESST, und sie war keine Kleinigkeit: `sponsorLeihgabenByTeamId`
 * wurde bis hierher an genau zwei Stellen beruehrt — geschrieben bei der Unterschrift, gelesen im
 * Overlay. Keine Stelle liess eine Leihgabe altern, zog ihre Stufe hoch oder entfernte sie am
 * Vertragsende. Eine einmal unterschriebene Leihe blieb also AUF EWIG bestehen, auf ihrer
 * Anfangsstufe und in ihrem Anfangszustand — waehrend der Cash-Verzicht jede Saison neu faellig
 * wurde. Fuer eine einzelne Testsaison unsichtbar, fuer ein Mehrsaison-Spiel ein Loch.
 *
 * DREI DINGE PASSIEREN BEIM SAISONWECHSEL, und sie haengen zusammen:
 *
 *   1. AUFSTIEG. Die Stufe folgt der bei Unterschrift eingefrorenen `stufenreihe` — kein neuer
 *      Wurf, keine Neuberechnung. Wer die Rangmarke gehalten hat, steigt; wer sie gerissen hat,
 *      pausiert (die Reihe faellt nie zurueck, siehe `baueLeihStufenreihe`).
 *   2. VERSCHLEISS. Dieselbe Abnutzung wie bei eigenen Gebaeuden, im Takt „Unterhalt bezahlt" —
 *      denn der Sponsor traegt ihn. Eine gewoehnliche Leihe startet bei 70 % und ist nach drei
 *      Saisons deutlich angeschlagen; genau das macht die Uebernahme zur Rechnung statt zum
 *      Selbstlaeufer.
 *   3. DER VERZICHT WAECHST MIT. Die neue Stufe kostet mehr, und dieser Betrag muss in die neu
 *      gebaute Leiter (`rerollSponsorV3TermsForNewSeason` zieht `terms.leihVerzicht` ab). Ohne
 *      diesen Schritt stiege das Gebaeude jedes Jahr, der Preis bliebe aber der von Jahr 1.
 *
 * UND AM VERTRAGSENDE faellt die Leihe weg — das Team steht wieder auf seinem eigenen Bestand.
 * Genau dafuer stand sie nie in `teamFacilities`: der Rueckfall ist ein Weglassen, kein Loeschen.
 * Statt der Leihe bekommt das Team ein UEBERNAHMEANGEBOT zum Preis aus `berechneUebernahmepreis`.
 *
 * Reine Funktionen; wer sie in den Spielstand haengt, ist `sponsor-contract-lifecycle.ts`.
 */
import type {
  GameState,
  SponsorLeihgabeRecord,
  SponsorOfferLeihe,
  SponsorUebernahmeAngebot,
  TeamSponsorContract,
} from "@/lib/data/olyDataTypes";
import type { FacilityId } from "@/lib/facilities/facility-catalog";
import { resolveFacilitySeasonDecay } from "@/lib/facilities/facility-condition";
import { berechneUebernahmepreis } from "@/lib/sponsor/sponsor-leihe";
import { altereLeihgabe, type SponsorLeihgabe } from "@/lib/sponsor/sponsor-leih-overlay";

/**
 * Welches Vertragsjahr laeuft gerade? 1 = Unterschriftssaison. Die Zahl indiziert die eingefrorene
 * `stufenreihe`, deshalb wird sie hier einmal zentral abgeleitet statt an drei Stellen gerechnet.
 */
export function vertragsjahrAus(contract: Pick<TeamSponsorContract, "termSeasons" | "seasonsRemaining">): number {
  const laufzeit = Math.max(1, contract.termSeasons ?? 1);
  const rest = Math.max(0, Math.min(laufzeit, contract.seasonsRemaining ?? laufzeit));
  return Math.max(1, laufzeit - rest + 1);
}

/**
 * Die Leihgabe der FOLGESAISON: eine Stufe weiter (falls die Reihe das vorsieht) und um eine Saison
 * gealtert.
 *
 * `naechstesVertragsjahr` ist 1-basiert und zeigt auf die Stufe, die in der NEUEN Saison gelten
 * soll. Liegt sie ausserhalb der eingefrorenen Reihe, bleibt die letzte Stufe stehen — ein Vertrag
 * kann nicht ueber seine eigene Leiter hinauswachsen.
 */
export function rolleLeihgabe(input: {
  leihgabe: SponsorLeihgabeRecord;
  leihe: SponsorOfferLeihe;
  naechstesVertragsjahr: number;
  naechsteSeasonId: string;
  /** Saatwort fuer die Streuung des Verschleisses — dieselbe Mechanik wie bei eigenen Gebaeuden. */
  verschleissSaat?: string;
}): { leihgabe: SponsorLeihgabeRecord; verzicht: number } {
  const index = Math.max(0, Math.min(input.leihe.stufenreihe.length - 1, input.naechstesVertragsjahr - 1));
  const stufe = input.leihe.stufenreihe[index] ?? input.leihgabe.stufe;
  // Der Sponsor traegt den Unterhalt, also verschleisst die Leihe im langsameren der beiden Takte.
  const verschleiss = resolveFacilitySeasonDecay(true, input.verschleissSaat ?? null);
  const gealtert = altereLeihgabe(
    { ...(input.leihgabe as unknown as SponsorLeihgabe), facilityId: input.leihgabe.facilityId as FacilityId },
    verschleiss,
  );

  return {
    leihgabe: {
      ...input.leihgabe,
      stufe,
      zustandPct: gealtert.zustandPct,
      seasonId: input.naechsteSeasonId,
    },
    verzicht: input.leihe.verzichtJeSaison[index] ?? input.leihe.verzichtJeSaison[0] ?? 0,
  };
}

/**
 * DAS UEBERNAHMEANGEBOT AM VERTRAGSENDE.
 *
 * Angerechnet wird, was der Sponsor ueber die gehaltenen Saisons BEREITGESTELLT hat, und abgezogen
 * die Reparatur, die der Kaeufer erbt — beides steckt in `berechneUebernahmepreis`, hier wird nur
 * eingesammelt, was der Vertrag darueber weiss.
 *
 * Gerechnet wird mit dem Zustand DER LEIHGABE, nicht mit dem Anfangszustand der Karte: nach drei
 * Saisons Verschleiss ist genau das der Unterschied zwischen einem guten und einem schlechten
 * Geschaeft, und es ist die Stellschraube, die Chris fuer verschiedene Vertraege haben wollte.
 */
export function baueUebernahmeAngebot(input: {
  teamId: string;
  seasonId: string;
  contract: Pick<TeamSponsorContract, "offerId" | "sponsorLeihe">;
  leihgabe: SponsorLeihgabeRecord;
}): SponsorUebernahmeAngebot | null {
  const leihe = input.contract.sponsorLeihe;
  if (!leihe) return null;

  // Nur die Saisons zaehlen, die auch wirklich gelaufen sind — bis zur erreichten Stufe.
  const erreichterIndex = leihe.stufenreihe.findIndex((stufe) => stufe === input.leihgabe.stufe);
  const gehalteneStufen = leihe.stufenreihe.slice(0, (erreichterIndex >= 0 ? erreichterIndex : leihe.stufenreihe.length - 1) + 1);

  return {
    teamId: input.teamId,
    seasonId: input.seasonId,
    facilityId: input.leihgabe.facilityId,
    stufe: input.leihgabe.stufe,
    zustandPct: input.leihgabe.zustandPct,
    preis: berechneUebernahmepreis({
      facilityId: input.leihgabe.facilityId as FacilityId,
      stufe: input.leihgabe.stufe,
      gehalteneStufen,
      zustandPct: input.leihgabe.zustandPct,
    }),
    offerId: input.contract.offerId,
  };
}

/**
 * DAS ANGEBOT ANNEHMEN: das Gebäude wandert in den EIGENEN Bestand, der Preis geht von der Kasse ab.
 *
 * Ab hier gehoert es dem Team wie ein selbst gebautes — mit allem, was daran haengt: es verschleisst
 * im Takt „Unterhalt bezahlt oder nicht", es kostet Unterhalt, und wer den nicht zahlt, verliert
 * doppelt so schnell Zustand. Chris hat genau das als sichtbare Folgelast verlangt.
 *
 * DER ZUSTAND WIRD UEBERNOMMEN, NICHT ZURUECKGESETZT. Ein nach drei Saisons abgenutztes Gebaeude
 * bleibt abgenutzt — der Preis hat die Reparatur bereits abgezogen, sie noch einmal zu schenken
 * waere doppelt.
 *
 * KEIN KASSEN-GUARD: wer nicht genug hat, darf trotzdem zugreifen und ins Minus gehen (E5, „keine
 * Sperre, keine bevormundende Warnung" — gegenfinanziert wird ueber Verkaeufe oder Kredit).
 */
export function nimmUebernahmeAn(input: {
  gameState: GameState;
  teamId: string;
  facilityId: string;
}): { gameState: GameState; angebot: SponsorUebernahmeAngebot | null; error?: string } {
  const offene = input.gameState.seasonState.sponsorUebernahmeAngeboteByTeamId?.[input.teamId] ?? [];
  const angebot = offene.find((eintrag) => eintrag.facilityId === input.facilityId) ?? null;
  if (!angebot) {
    return { gameState: input.gameState, angebot: null, error: "uebernahme_angebot_nicht_gefunden" };
  }

  const bestand = input.gameState.seasonState.teamFacilities?.[input.teamId]?.facilities ?? {};
  const eigen = bestand[angebot.facilityId];
  // Hat das Team selbst schon hoeher gebaut, waere der Kauf ein Rueckschritt — dann bleibt der
  // eigene Bestand stehen und das Angebot ist erledigt statt schaedlich.
  const neueStufe = Math.max(eigen?.level ?? 0, angebot.stufe);
  const neuerZustand = (eigen?.level ?? 0) >= angebot.stufe ? eigen?.conditionPct ?? 100 : angebot.zustandPct;

  const restAngebote = offene.filter((eintrag) => eintrag.facilityId !== angebot.facilityId);
  const alleAngebote = { ...(input.gameState.seasonState.sponsorUebernahmeAngeboteByTeamId ?? {}) };
  if (restAngebote.length > 0) {
    alleAngebote[input.teamId] = restAngebote;
  } else {
    delete alleAngebote[input.teamId];
  }

  return {
    angebot,
    gameState: {
      ...input.gameState,
      teams: input.gameState.teams.map((team) =>
        team.teamId === input.teamId
          ? { ...team, cash: Math.round((team.cash - angebot.preis) * 10) / 10 }
          : team,
      ),
      seasonState: {
        ...input.gameState.seasonState,
        teamFacilities: {
          ...(input.gameState.seasonState.teamFacilities ?? {}),
          [input.teamId]: {
            ...(input.gameState.seasonState.teamFacilities?.[input.teamId] ?? { facilities: {} }),
            facilities: {
              ...bestand,
              [angebot.facilityId]: {
                ...(eigen ?? {}),
                level: neueStufe,
                enabled: true,
                conditionPct: neuerZustand,
                disabledReason: undefined,
              },
            },
          },
        },
        sponsorUebernahmeAngeboteByTeamId:
          Object.keys(alleAngebote).length > 0 ? alleAngebote : undefined,
      },
    },
  };
}

/** Das Angebot ausschlagen: das Gebäude ist weg, mehr passiert nicht. */
export function lehneUebernahmeAb(input: {
  gameState: GameState;
  teamId: string;
  facilityId: string;
}): GameState {
  const offene = input.gameState.seasonState.sponsorUebernahmeAngeboteByTeamId?.[input.teamId] ?? [];
  const rest = offene.filter((eintrag) => eintrag.facilityId !== input.facilityId);
  const alle = { ...(input.gameState.seasonState.sponsorUebernahmeAngeboteByTeamId ?? {}) };
  if (rest.length > 0) {
    alle[input.teamId] = rest;
  } else {
    delete alle[input.teamId];
  }
  return {
    ...input.gameState,
    seasonState: {
      ...input.gameState.seasonState,
      sponsorUebernahmeAngeboteByTeamId: Object.keys(alle).length > 0 ? alle : undefined,
    },
  };
}
