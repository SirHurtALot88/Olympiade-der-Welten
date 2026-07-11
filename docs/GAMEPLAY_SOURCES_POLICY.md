# Gameplay Sources Policy (Solo v1)

Stand: 2026-06-26

## Grundsatz

Keine Fake-Werte in Resolve, Preisgeld oder AI-Empfehlungen. Fehlende Quellen bleiben sichtbar als Blocker/Warnings.

## Formkarten

- **Modus:** Manueller Pool + optionaler Plan (`seasonState.formCards`, `formCardPlans`)
- **Arena-Gate:** Pool muss existieren; manuelle Zuweisung ist optional
- **Resolve:** Lokaler SQLite-Modus liefert `ready`; Prisma-Referenz bleibt `missing_source`
- **Automation:** Bewusst nicht implementiert

## Mutatoren

- **Modus:** Trait-basierte lokale Engine in `legacy-lineup-modifiers.ts`
- **Resolve:** Nur im lokalen Save-Kontext resolve-ready
- **Automation:** Bewusst nicht implementiert

## Sponsor → Preisgeld

- **Primär:** Prize-Sheet `basis` pro Rang
- **Fallback:** Sponsor-Vertrags-Basis (`components.kind === "base"`) wenn Sheet fehlt
- **Season-End:** `previewSponsorSettlement` / `applySponsorSettlement` vor Cash-Apply

## Transferfenster

- Kauf/Verkauf nur in Transfer-Phasen oder Early-Season-Setup (MD1 vor erstem Resultat)
- Flow-Coach spiegelt `evaluateGamePhaseAction` — API und UI nutzen dieselbe Policy
