# Kartenschmiede × ComfyUI

Aus einem Foto deiner bemalten Mini wird ein Filmstill-Artwork. Das läuft komplett auf deinem Rechner, kostenlos und ohne Limit.

| Datei | Wozu |
|---|---|
| `workflow_flux_kontext.json` | Beste Qualität. Flux Kontext verwandelt das Foto und behält dabei Pose und Bemalung. Braucht eine Grafikkarte mit etwa 12 GB. |
| `workflow_sdxl.json` | Für kleinere Grafikkarten ab etwa 8 GB. SDXL mit Canny-ControlNet hält die Umrisse der Mini fest. |
| `kartenschmiede_comfy.py` | Schickt Foto und Prompt an ComfyUI und speichert das Ergebnis neben dem Foto. Braucht nur Python 3. |

## Einmal einrichten

1. ComfyUI installieren (Desktop-App oder portable Version von comfy.org) und starten.
2. **Am einfachsten:** In ComfyUI unter *Workflow → Vorlagen durchsuchen* die Vorlage **Flux Kontext Dev** öffnen. ComfyUI bietet dann an, die fehlenden Modelle herunterzuladen. Danach stimmen die Dateinamen mit `workflow_flux_kontext.json` überein.
3. Von Hand geht es auch. Diese Dateien gehören in den `models`-Ordner von ComfyUI:
   - `diffusion_models/flux1-dev-kontext_fp8_scaled.safetensors`
   - `text_encoders/clip_l.safetensors` und `text_encoders/t5xxl_fp8_e4m3fn_scaled.safetensors`
   - `vae/ae.safetensors`
4. Nur für SDXL: ein SDXL-Checkpoint nach `checkpoints/` (in der JSON steht `juggernautXL_v9.safetensors`) und ein Canny-ControlNet nach `controlnet/` (in der JSON steht `controlnet-canny-sdxl-1.0.safetensors`).

Heißen deine Dateien anders, passt du nur den Namen in der JSON an.

## Ein Artwork erzeugen

1. In der Kartenschmiede (https://olympiade.duckdns.org/kartenschmiede) die Einheit wählen, unten auf **Prompt kopieren** klicken und den Text als `prompt.txt` speichern.
2. Das Foto der Mini daneben legen, zum Beispiel `werwolf.jpg`.
3. ComfyUI muss laufen. Dann im Terminal in diesem Ordner:

```sh
python3 kartenschmiede_comfy.py werwolf.jpg prompt.txt --anzahl 4
```

Für SDXL:

```sh
python3 kartenschmiede_comfy.py werwolf.jpg prompt.txt --workflow workflow_sdxl.json --anzahl 4
```

Unter Windows heißt der Befehl meist `python` statt `python3`. Die Bilder landen als `werwolf_artwork_<seed>.png` neben dem Foto. Das beste davon lädst du in der Kartenschmiede hoch.

## Stellschrauben

- **Flux Kontext:** `guidance` (Knoten 9). Niedriger (2,0) hält sich enger ans Foto, höher (3,5) folgt stärker dem Prompt.
- **SDXL:** `denoise` (Knoten 10). 0,6 hält viel von der Mini, 0,8 malt freier. Dazu `strength` des ControlNet (Knoten 9): Höher heißt, die Umrisse bleiben genauer.
- **Foto:** Tageslicht, neutraler Hintergrund, Mini füllt das Bild. Das bringt mehr als jede Einstellung.

## Ehrlicher Stand

Das Skript habe ich gegen einen nachgebauten ComfyUI-Server getestet: Upload, Auftrag und Download funktionieren. Die beiden Workflows selbst konnte ich nicht in einem echten ComfyUI laufen lassen, weil meine Umgebung keine Grafikkarte hat. Meldet ComfyUI einen Fehler, gibt das Skript ihn wörtlich aus. Meist fehlt dann ein Modell oder ein Dateiname weicht ab.
