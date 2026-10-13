# Werkbank

Karten zu Chris' bemalten Minis, die noch auf ihr Bild warten. Eine JSON-Datei pro Figur:

```json
{
  "name": "Name der Karte",
  "status": "wartet auf Bild",
  "mini": "kurze Beschreibung der Mini, wie Chris sie gezeigt hat",
  "karte": { "name": "…", "role": "enemy", "faction": "…", "praegung": [], "size": "1", "quality": "4+", "defense": "5+",
             "tough": "3", "weapons": "…", "passives": "…", "skills": [{ "id": "…" }], "flavor": "…", "look": "…" },
  "neueFaehigkeiten": ["ids, die für diese Karte neu in katalog.js angelegt wurden"],
  "prompt": "der fertige ChatGPT-Prompt"
}
```

Ist das Bild da: Bild nach `../assets/`, Karte als Vorlage in `app.js`, Status auf „fertig“.
Ablauf im Detail: `docs/KAMPAGNEN_UEBERGABE.md`, Abschnitt „Arbeitsweise“.
