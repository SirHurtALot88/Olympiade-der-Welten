/**
 * SCHRITT 9 DER BAUVORLAGE: DER MESSLAUF VOR DER FREIGABE.
 *
 * Was hier gemessen wird — und, genauso wichtig, was NICHT:
 *
 * GEMESSEN
 *   1. Die Liga-Bilanz: Summe Sponsorgeld gegen Summe Gehaelter. Die harte Freigabebedingung aus
 *      Abschnitt 6, Schritt 9 („Σ Sponsoren deckt Σ Gehaelter bei sf 1,0").
 *   2. Wie viele Teams nach der Abrechnung im Minus stehen. KEIN Ausschlusskriterium mehr (E5:
 *      negative Margen sind der Rubberband der Liga) — aber die Zahl gehoert auf den Tisch.
 *   3. Wie sich die Liga ueber die Kartenarten verteilt: reine Cash-Karte gegen Gebaeude, und die
 *      Gebaeude nach Groesse. Eine Liga, die geschlossen dasselbe waehlt, hat keine Auswahl.
 *   4. Die Preisspanne der tatsaechlich angebotenen Gebaeude-Karten.
 *   5. Die Uptime der Rangmarken — wie viele Teams ihre Marke am Ende halten.
 *
 * NICHT GEMESSEN, und das ist kein Versehen:
 *   - Die Bonus-Quoten je Zieltyp. Die zwei Ziele (Frische, Achsen-Rang) sind noch nicht gebaut;
 *     sie ersetzen das V4-Achsensystem und gehoeren in denselben Schritt wie dessen Abriss.
 *   - Der Verlauf ueber die Spieltage. Dieses Skript rechnet den Saisonabschluss gegen einen
 *     Endstand, nicht zehn Spieltage durch — die Uptime unten ist deshalb eine MOMENTAUFNAHME am
 *     Endrang, nicht der Anteil aktiver Spieltage. #490s Schaetzung (mild ~90 %, hart ~70-80 %)
 *     bleibt damit ungeprueft; sie zu pruefen braucht einen echten Spieltags-Durchlauf.
 *
 * Aufruf: npx tsx scripts/messlauf-sponsoren-gebaeude.ts
 */
import type { GameState } from "@/lib/data/olyDataTypes";
import { createSingleplayerGameState } from "@/lib/game-state/singleplayer-state";
import { chooseSponsorOfferForAiTeams, ensureSeasonSponsorOffers } from "@/lib/sponsor/sponsor-offer-service";
import { getTeamSponsorContract } from "@/lib/sponsor/sponsor-offer-read";
import { applySponsorSettlement } from "@/lib/sponsor/sponsor-settlement-service";
import { getTeamRealSalaryTotal } from "@/lib/sponsor/sponsor-v3-offer-service";
import { getSponsorV3Terms } from "@/lib/sponsor/sponsor-v3-offer-service";
import { marktGehalten } from "@/lib/sponsor/sponsor-rangmarke";

function zeile(label: string, wert: string) {
  console.log(`  ${label.padEnd(42)} ${wert}`);
}

function groesseVon(stufe: number): "klein" | "mittel" | "gross" {
  return stufe >= 5 ? "gross" : stufe >= 3 ? "mittel" : "klein";
}

async function main() {
  const roh = createSingleplayerGameState();
  const mitAngeboten = ensureSeasonSponsorOffers(roh);

  // ── Was ANGEBOTEN wird ────────────────────────────────────────────────────────────────────────
  const verzichte: number[] = [];
  const angeboteneGroessen: Record<string, number> = { klein: 0, mittel: 0, gross: 0, cash: 0 };
  for (const team of mitAngeboten.teams) {
    for (const angebot of mitAngeboten.seasonState.sponsorOffersByTeamId?.[team.teamId] ?? []) {
      if (!angebot.sponsorLeihe) {
        angeboteneGroessen.cash! += 1;
        continue;
      }
      angeboteneGroessen[groesseVon(angebot.sponsorLeihe.stufenreihe[0] ?? 0)]! += 1;
      verzichte.push(getSponsorV3Terms(angebot)?.leihVerzicht ?? 0);
    }
  }
  verzichte.sort((links, rechts) => links - rechts);

  console.log("\nANGEBOT");
  zeile("Karten insgesamt", String(verzichte.length + angeboteneGroessen.cash!));
  zeile(
    "davon Gebaeude (klein/mittel/gross)",
    `${angeboteneGroessen.klein} / ${angeboteneGroessen.mittel} / ${angeboteneGroessen.gross}`,
  );
  zeile("reine Cash-Karten", String(angeboteneGroessen.cash));
  zeile(
    "Verzicht-Spanne der Gebaeude-Karten",
    verzichte.length > 0
      ? `${verzichte[0]!.toFixed(1)} .. ${verzichte[verzichte.length - 1]!.toFixed(1)} C (Median ${verzichte[Math.floor(verzichte.length / 2)]!.toFixed(1)})`
      : "—",
  );

  // ── Was die KI WAEHLT ─────────────────────────────────────────────────────────────────────────
  const gewaehlt = chooseSponsorOfferForAiTeams(mitAngeboten);
  const wahl: Record<string, number> = { klein: 0, mittel: 0, gross: 0, cash: 0 };
  let markeGehalten = 0;
  let mitMarke = 0;
  for (const team of gewaehlt.teams) {
    const vertrag = getTeamSponsorContract(gewaehlt, team.teamId);
    const leihe = vertrag?.sponsorLeihe;
    if (!leihe) {
      wahl.cash! += 1;
      continue;
    }
    wahl[groesseVon(leihe.stufenreihe[0] ?? 0)]! += 1;
    if (leihe.rangmarke != null) {
      mitMarke += 1;
      const rang = gewaehlt.seasonState.standings?.[team.teamId]?.rank ?? null;
      if (marktGehalten({ aktuellerRang: rang, marke: leihe.rangmarke })) markeGehalten += 1;
    }
  }

  // GEGENRECHNUNG: was waere die Liga-Bilanz, wenn ALLE die reine Cash-Karte naehmen? Ohne diese
  // Zahl liesse sich die Deckung unten nicht deuten — man wuesste nicht, wie viel davon der bewusst
  // gewaehlte Cash-Verzicht ist und wie viel eine zu niedrige Sponsorleiter.
  let verzichtSummeGewaehlt = 0;
  for (const team of gewaehlt.teams) {
    verzichtSummeGewaehlt += getSponsorV3Terms(getTeamSponsorContract(gewaehlt, team.teamId))?.leihVerzicht ?? 0;
  }

  console.log("\nWAHL DER KI");
  zeile("reine Cash-Karte", `${wahl.cash} / ${gewaehlt.teams.length}`);
  zeile("Gebaeude klein / mittel / gross", `${wahl.klein} / ${wahl.mittel} / ${wahl.gross}`);
  const hatRaenge = Object.values(gewaehlt.seasonState.standings ?? {}).some((eintrag) => eintrag?.rank != null);
  zeile(
    "Rangmarke gehalten",
    !hatRaenge
      ? "— (frisches Spiel, es gibt noch keine Tabelle)"
      : mitMarke > 0
        ? `${markeGehalten} / ${mitMarke} (${Math.round((markeGehalten / mitMarke) * 100)} %)`
        : "—",
  );
  zeile("Σ gewaehlter Cash-Verzicht", `${verzichtSummeGewaehlt.toFixed(1)} C`);

  // ── Die LIGA-BILANZ ───────────────────────────────────────────────────────────────────────────
  const kasseVorher = new Map(gewaehlt.teams.map((team) => [team.teamId, team.cash] as const));
  const gehaelter = gewaehlt.teams.reduce((summe, team) => summe + getTeamRealSalaryTotal(gewaehlt, team.teamId), 0);
  const { gameState: abgerechnet } = applySponsorSettlement({
    gameState: gewaehlt as GameState,
    saveId: "messlauf",
    phase: "season_end",
    execute: true,
  });

  let sponsorSumme = 0;
  let imMinus = 0;
  let tiefstand = 0;
  for (const team of abgerechnet.teams) {
    sponsorSumme += team.cash - (kasseVorher.get(team.teamId) ?? 0);
    if (team.cash < 0) imMinus += 1;
    tiefstand = Math.min(tiefstand, team.cash);
  }

  console.log("\nLIGA-BILANZ (Saisonabschluss, ohne Gehaltsabzug in derselben Buchung)");
  zeile("Σ Sponsorgeld", `${sponsorSumme.toFixed(1)} C`);
  zeile("Σ Gehaelter", `${gehaelter.toFixed(1)} C`);
  zeile("Deckung", gehaelter > 0 ? `${Math.round((sponsorSumme / gehaelter) * 100)} %` : "—");
  zeile("Teams im Minus nach Abschluss", `${imMinus} / ${abgerechnet.teams.length}`);
  zeile("tiefster Kassenstand", `${tiefstand.toFixed(1)} C`);
  zeile(
    "Deckung OHNE Gebaeude-Verzicht",
    gehaelter > 0 ? `${Math.round(((sponsorSumme + verzichtSummeGewaehlt) / gehaelter) * 100)} %` : "—",
  );

  console.log(
    "\nHINWEIS: die Uptime oben ist eine MOMENTAUFNAHME am Endstand, nicht der Anteil aktiver\n" +
      "Spieltage. #490s Schaetzung (mild ~90 %, hart ~70-80 %) bleibt ungeprueft — dafuer braucht es\n" +
      "einen echten Spieltags-Durchlauf.\n",
  );
}

main().catch((fehler) => {
  console.error(fehler);
  process.exit(1);
});
