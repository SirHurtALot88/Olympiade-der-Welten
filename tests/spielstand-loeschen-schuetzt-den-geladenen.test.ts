/**
 * LÖSCHEN: GESCHÜTZT IST GENAU DER GELADENE SPIELSTAND — NICHT EIN BELIEBIGER.
 *
 * GEMELDET VON CHRIS: „Kannst du das game für mich löschen? ich bekomme es nicht weg"
 * (Save `new-game-1784747079649-n90y4m`, angelegt am 22.07.).
 *
 * BEFUND, am Live-Spielstand nachgemessen. Der Riegel las
 *
 *     SELECT save_id FROM saves WHERE status = 'active'      ← ohne ORDER BY, mit .get()
 *
 * `getActiveSave` liest DIESELBE Tabelle, aber mit `ORDER BY updated_at DESC LIMIT 1` — also den
 * ZULETZT BENUTZTEN. Ohne die Sortierung nimmt SQLite eine beliebige Zeile, faktisch die mit der
 * kleinsten rowid, also den ÄLTESTEN. Riegel und Resolver waren sich damit uneinig, welcher
 * Spielstand „der aktive" ist. Verschärft dadurch, dass `saves.status` ein LEBENSZYKLUS ist und
 * kein Ladezustand: alle SIEBEN Spielstände trugen „active".
 *
 * Konkret schützte der Riegel `new-game-1784747079649-n90y4m` (rowid 18) — genau den, den Chris
 * loswerden wollte — während der wirklich geladene `new-game-1786465783606-0kalpx` ungeschützt
 * war. Doppelt falsch. Und weil die Schleife stillschweigend `continue` macht, passierte auf dem
 * Schirm gar nichts: kein Fehler, keine Erklärung, der Eintrag blieb stehen.
 *
 * Gepinnt wird die EIGENSCHAFT, nicht die Abfrage: geschützt ist, was `getActiveSave()` liefert —
 * und was sie nicht liefert, lässt sich löschen.
 */
import { describe, expect, it } from "vitest";

import { createPersistenceService } from "@/lib/persistence/persistence-service";

function frischerDienst() {
  process.env.OLY_APP_SQLITE_PATH = `/tmp/oly-loeschtest-${Math.random().toString(36).slice(2)}.sqlite`;
  return createPersistenceService();
}

/**
 * EIGENE ZEITGRENZE FÜR DIE GANZE DATEI — der Grund ist gemessen, nicht geschätzt.
 *
 * Jeder Fall hier legt echte Spielstände an: `bootstrapSingleplayerSave` und jedes `cloneSave`
 * bauen einen vollständigen 32-Team-Stand. Das kostet je rund 3,7 s, und der letzte Fall braucht
 * vier davon. Lokal gemessen (`--reporter=verbose`): 7,4 s · 0 ms · 4,5 s · 9,5 s · **14,9 s**.
 *
 * Gegen die globale Grenze von 20 s (siehe `vitest.config.ts`) blieben dem schwersten Fall damit
 * 25 % Luft — auf dem CI-Runner zu wenig: er ist genau daran gestorben („Test timed out in
 * 20000ms"), als die volle Suite zum ersten Mal im Tor lief. Kein Testfehler, sondern die
 * Maschine; die Zusicherungen selbst liefen alle durch.
 *
 * 120 s ist bewusst reichlich (rund das Achtfache der lokalen Messung): die Grenze soll einen
 * HÄNGER fangen, nicht einen langsamen Runner. Dieselbe Begründung tragen die anderen schweren
 * Dateien der Suite, die eigene Grenzen zwischen 40 s und 240 s setzen.
 */
describe("Spielstände löschen · geschützt ist der geladene", { timeout: 120_000 }, () => {
  it("löscht einen Spielstand, der nur den Lebenszyklus-Status trägt, aber nicht geladen ist", () => {
    const persistence = frischerDienst();
    const erster = persistence.bootstrapSingleplayerSave().save;
    // Der Klon wird der zuletzt benutzte und damit der geladene — der erste ist es nicht mehr.
    // Genau Chris' Lage: mehrere Stände, alle mit Status „active", nur einer davon geladen.
    const klon = persistence.cloneSave(erster.saveId, "Neuer Stand");
    expect(persistence.getActiveSave()?.saveId).toBe(klon.saveId);

    expect(persistence.deleteSave(erster.saveId)).toBe(true);
    expect(persistence.getSaveById(erster.saveId)).toBeNull();
  });

  it("lässt den GELADENEN Spielstand unangetastet", () => {
    const persistence = frischerDienst();
    const geladen = persistence.bootstrapSingleplayerSave().save;
    expect(persistence.getActiveSave()?.saveId).toBe(geladen.saveId);
    expect(persistence.deleteSave(geladen.saveId)).toBe(false);
    expect(persistence.getSaveById(geladen.saveId)).not.toBeNull();
  });

  it("schützt weiterhin den geladenen, wenn mehrere Stände nebeneinander liegen", () => {
    const persistence = frischerDienst();
    const erster = persistence.bootstrapSingleplayerSave().save;
    const klon = persistence.cloneSave(erster.saveId, "Neuer Stand");
    expect(persistence.deleteSave(klon.saveId)).toBe(false);
    expect(persistence.getSaveById(klon.saveId)).not.toBeNull();
  });

  it("gibt genau die gelöschten Kennungen zurück — nicht die übersprungenen", () => {
    // Die Rückgabe ist das einzige Signal, an dem die Oberfläche „hat nicht geklappt" erkennen
    // kann. Meldete sie einen Erfolg, den es nicht gab, verschwände der Eintrag nie und niemand
    // wüsste warum — genau der gemeldete Zustand.
    const persistence = frischerDienst();
    const erster = persistence.bootstrapSingleplayerSave().save;
    const zweiter = persistence.cloneSave(erster.saveId, "A");
    const geladen = persistence.cloneSave(zweiter.saveId, "B");
    expect(persistence.getActiveSave()?.saveId).toBe(geladen.saveId);

    const geloescht = persistence.deleteSaves([erster.saveId, zweiter.saveId, geladen.saveId, "gibts-nicht"]);
    expect([...geloescht].sort()).toEqual([erster.saveId, zweiter.saveId].sort());
  });

  it("räumt einen Stapel alter Stände in einem Zug weg", () => {
    // Chris' eigentliches Ziel: aufräumen. Vorher blieb je nach rowid einer davon hängen.
    const persistence = frischerDienst();
    const basis = persistence.bootstrapSingleplayerSave().save;
    const alte = [basis.saveId];
    let letzter = basis.saveId;
    for (const name of ["A", "B", "C"]) {
      letzter = persistence.cloneSave(letzter, name).saveId;
      alte.push(letzter);
    }
    const geladen = persistence.getActiveSave()!.saveId;
    const zuLoeschen = alte.filter((id) => id !== geladen);

    expect(persistence.deleteSaves(zuLoeschen).sort()).toEqual([...zuLoeschen].sort());
    for (const id of zuLoeschen) {
      expect(persistence.getSaveById(id), `${id} haengt noch`).toBeNull();
    }
    expect(persistence.getSaveById(geladen)).not.toBeNull();
  });
});
