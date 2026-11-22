#!/usr/bin/env python3
"""Festes Aussehen fuer die 100 General Manager (22.11.): schreibt data/gm-aussehen.json.

    python3 -I scripts/gm-aussehen-erzeugen.py

Die 100 GM-Profile entstehen in lib/foundation/team-general-managers.ts aus 10 Archetypen x 10 Varianten
(gmId = gm-<archetyp>-<01..10>); die eindeutigen Namen stehen in data/gm-namen.json. Dort gibt es weder Rasse noch Aussehen. Dieses Skript ordnet jedem GM
deterministisch (ohne Zufall, ohne Teambezug) zu:
  - eine der 18 echten Rassen aus data/generated/oly-player-stats.json, gestreut ueber (5*a + 7*v) mod 18:
    je Archetyp zehn verschiedene Rassen, je Rasse 5 oder 6 GMs, Human damit nur 6 von 100
    (Chris, 22.11.: "dass die wirklich nicht nur wie Menschen aussehen");
  - Geschlecht je Variante (ungerade Nummer weiblich, gerade maennlich; passend zu den Namen in data/gm-namen.json);
  - Rassennamen wie im Spiel (Human, Voidborn, Gnom ...), keine deutsche Uebersetzung;
  - Alters-Anmutung und Ausdruck aus dem Varianten-Profil (Prime, Wild, Patient ...);
  - Kleidung und Beiwerk aus dem Archetyp (seine "Vorlieben");
  - den fertigen Prompt-Baustein fuer scripts/pixellab-gm-portraets.py.
Aehnliche GMs sind erlaubt (Chris). Bestellt wird hier nichts; das Feld bestellt wird aus den vorhandenen Dateien
unter public/portraits/gm gelesen, das Skript also nach jeder Bestellung neu laufen lassen.
"""
import json
import os

WURZEL = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ZIEL = os.path.join(WURZEL, "data", "gm-aussehen.json")
NAMEN = json.load(open(os.path.join(WURZEL, "data", "gm-namen.json"), encoding="utf-8"))["namen"]

ARCHETYPEN = ["bargain_hunter", "talent_builder", "star_chaser", "depth_spammer", "elite_curator",
              "facility_architect", "risk_gambler", "culture_keeper", "rivalry_hawk", "systems_tinkerer"]
PROFILE = ["Prime", "Wild", "Patient", "Clinical", "Popular", "Hardline", "Agile", "Builder", "Showcase", "Lean"]
GESCHLECHT = ["w", "m", "w", "m", "w", "m", "w", "m", "w", "m"]

# Reihenfolge = Haeufigkeit im Spielerbestand (data/generated/oly-player-stats.json, ohne "Unknown" und "Fish").
RASSEN = ["Human", "Demon", "Construct", "Elf", "Animal", "Divine", "Alien", "Orc", "Aqua", "Dwarf", "Lizard",
          "Dragon", "Tauren", "Plant", "Mutant", "Voidborn", "Goblin", "Gnom"]

# Rassentypische Merkmale stehen im Prompt VORN und deutlich, damit kein "Mensch im Anzug" entsteht.
TIERE = ["red fox", "grey wolf", "lion", "brown bear", "black panther", "badger", "raven bird", "white owl",
         "hawk bird", "raccoon"]
RASSE_PROMPT = {
    "Human": "human {g}",
    "Demon": "{g} demon with crimson red skin, two large curved black horns on the forehead, glowing yellow eyes, pointed ears, sharp fangs",
    "Construct": "{g} clockwork construct robot, whole head made of riveted brass and steel plates, no skin, two round glowing lens eyes, visible gears on the neck, metal jaw",
    "Elf": "{g} high elf with very long pointed ears sticking far out, silver-white hair, pale lilac skin, glowing violet eyes, sharp angular face",
    "Animal": "anthropomorphic {tier} beast {g}, full animal head covered in fur or feathers, animal snout or beak, animal ears",
    "Divine": "{g} divine celestial being, radiant golden glowing skin, floating golden halo above the head, blank white glowing eyes, small white feathered wings behind the shoulders",
    "Alien": "{g} alien with smooth teal-blue skin, huge black almond eyes, no nose, bald elongated head with two short antennae",
    "Orc": "hulking {g} orc with dark green skin, two big lower tusks jutting from the jaw, heavy brow, pointed ears, broad flat nose",
    "Aqua": "{g} aquatic fishfolk with turquoise scaled skin, large fin ears, gills on the neck, webbed dorsal fin on the head instead of hair, big round fish eyes",
    "Dwarf": "stout broad {g} dwarf with a huge bulbous nose, large pointed ears, ruddy weathered rune-tattooed skin, bushy eyebrows hiding the eyes, very thick braided {bart} with metal rings, very short and wide build",
    "Lizard": "{g} lizardfolk with a full reptile head, long green scaled snout, yellow slit eyes, spiky crest on the head, no hair",
    "Dragon": "{g} dragonborn with a full dragon head, dark red scales, long snout with fangs, two swept back horns, small smoke from the nostrils",
    "Tauren": "massive {g} minotaur with a full bull head covered in brown fur, long curved horns, wide bovine snout with a gold nose ring",
    "Plant": "{g} plant creature with rough brown bark skin, green leaves and vines growing as hair, small flowers on the shoulders, glowing green eyes",
    "Mutant": "grotesque {g} mutant creature, lumpy mottled purple and grey skin all over, three eyes, no hair but short tentacles on the head, an extra pair of small arms, uneven jaw with jutting teeth",
    "Voidborn": "faceless {g} voidborn creature, the head is a swirling cloud of black-violet smoke filled with tiny stars, no nose, no mouth, no hair, only two glowing white eyes, smoke wisps rising, hands of dark smoke",
    "Goblin": "small {g} goblin with yellow-green skin, enormous long pointed ears, long hooked nose, wide mouth with tiny sharp teeth, big yellow eyes",
    "Gnom": "tiny {g} gnome with an oversized round red nose, huge bushy white eyebrows, big pointed ears, wrinkled leathery face, very large head",
}
# Kleidung und Beiwerk je Archetyp: was der GM mag und wie er arbeitet.
KLEIDUNG = {
    "bargain_hunter": ("Sparfuchs", "wearing a worn patched tweed jacket with elbow patches, a monocle, a small coin pouch on the lapel, holding a price tag"),
    "talent_builder": ("Trainer", "wearing a blue and white coach tracksuit jacket with a silver whistle around the neck and a stopwatch"),
    "star_chaser": ("Glamour", "wearing a flashy white suit with a gold chain necklace, dark sunglasses and a gold star pin"),
    "depth_spammer": ("Praktiker", "wearing a practical olive utility vest with many pockets over a shirt, holding a clipboard with a long list"),
    "elite_curator": ("Kenner", "wearing an elegant black velvet dinner jacket with a wine red bow tie and white gloves, holding a magnifying glass"),
    "facility_architect": ("Bauherr", "wearing a yellow hard hat and an orange work vest over a shirt, rolled blueprints under the arm"),
    "risk_gambler": ("Zocker", "wearing a loud purple pinstripe suit and a black fedora hat, fanning out playing cards, golden dice pin"),
    "culture_keeper": ("Herbergsvater", "wearing a warm knitted moss green cardigan with a striped club scarf, holding a steaming mug"),
    "rivalry_hawk": ("Feldherr", "wearing a dark military greatcoat with red epaulettes and medals, clenched fist, battle scar across the face"),
    "systems_tinkerer": ("Tüftler", "wearing a white lab coat over a hoodie, brass goggles pushed up on the forehead, holding a glowing tablet with charts"),
}
# Alters-Anmutung und Ausdruck je Varianten-Profil.
ANMUTUNG = [
    ("mittleres Alter, gefasst", "middle-aged, composed confident look"),
    ("jung, ungestüm", "young, messy untamed look, daring grin"),
    ("alt, geduldig", "elderly and wrinkled, calm patient gaze"),
    ("mittleres Alter, kühl", "cold analytical stare, thin rectangular glasses, very neat"),
    ("jung, gewinnend", "charming wide friendly smile"),
    ("alt, hart", "old and grim, hard scowl, clenched jaw"),
    ("jung, wach", "young and lean, sharp alert eyes, slight smirk"),
    ("mittleres Alter, zupackend", "weathered and sturdy, rolled up sleeves, determined look"),
    ("mittleres Alter, eitel", "proud flamboyant pose, raised chin, smug smile"),
    ("alt, hager", "gaunt and thin, tired thrifty look"),
]


def baue():
    eintraege = {}
    for a, arch in enumerate(ARCHETYPEN):
        for v in range(10):
            gm_id = f"gm-{arch.replace('_', '-')}-{v + 1:02d}"
            rasse = RASSEN[(5 * a + 7 * v) % 18]
            w = GESCHLECHT[v] == "w"
            g = "woman" if rasse == "Human" and w else "man" if rasse == "Human" else "female" if w else "male"
            rp = RASSE_PROMPT[rasse].format(g=g, tier=TIERE[a], bart="hair braids" if w else "beard")
            stil_de, kleid = KLEIDUNG[arch]
            alter_de, anm = ANMUTUNG[v]
            name = NAMEN[gm_id]
            eintraege[gm_id] = {
                "name": name, "archetyp": arch, "profil": PROFILE[v], "rasse": rasse,
                **({"tier": TIERE[a]} if rasse == "Animal" else {}),
                "geschlecht": GESCHLECHT[v], "anmutung": alter_de, "kleidungsstil": stil_de,
                "prompt": f"{rp}, sports club general manager, {anm}, {kleid}",
                "portraet": f"/portraits/gm/{gm_id}.png",
                "bestellt": os.path.exists(os.path.join(WURZEL, "public", "portraits", "gm", gm_id + ".png")),
            }
    return eintraege


def main():
    e = baue()
    zaehl = {}
    for x in e.values():
        zaehl[x["rasse"]] = zaehl.get(x["rasse"], 0) + 1
    daten = {
        "_hinweis": "Festes Aussehen der 100 General Manager, erzeugt von scripts/gm-aussehen-erzeugen.py (nicht von Hand "
                    "aendern). Rasse unabhaengig vom Team, gestreut ueber alle 18 Rassen. Das Feld portraet zeigt auf "
                    "public/portraits/gm/<gmId>.png; bestellt sagt, ob das Bild dort liegt (nach jeder Bestellung das Skript neu laufen lassen).",
        "rassenVerteilung": zaehl,
        "gms": e,
    }
    json.dump(daten, open(ZIEL, "w"), indent=1, ensure_ascii=False)
    print(len(e), zaehl)


if __name__ == "__main__":
    main()
