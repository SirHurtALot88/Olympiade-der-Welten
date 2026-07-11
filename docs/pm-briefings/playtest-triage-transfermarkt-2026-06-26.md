# Playtest-Triage — Transfermarkt (2026-06-26)

Quelle: Code-Audit + [playtest-triage-2026-06-25.md](./playtest-triage-2026-06-25.md) · Fokus: TM-Tiefe

## Ist-Stand (code-verifiziert)

| Check | Status | Notiz |
|-------|--------|-------|
| Buy nur steuerbares Team | Grün | `openMarketBuyModal` + V2 `manageableTeamIdSet` blockieren fremde Teams |
| Zwei-Schritt Kauf | Grün | `Verhandeln` → `Kauf final abschließen` (`buyNegotiationOutcome?.status === "accepted"`) |
| Abbruch-Feedback | Grün | `closeBuyModal` setzt `previewError` mit Malus-Hinweis nach Kontakt |
| „Angefressen“ beim Reopen | Grün | `priorBadExperienceActive` + `previous_rejected_offer_reduces_trust` aus Preview |
| Preview-Ladezustand | Gelb→Fix | Skeleton statt leerer Modal-Phase |
| Season-Deals im Markt | Gelb→Fix | Recap lädt jetzt `allSeasons=1` (S1+S2 sichtbar in S2) |

## Manueller 15-Min-Check (H-R / Solo)

1. Fremdes Team im Markt → kein Kaufdialog, Meldung „steuerbaren Teams“
2. Eigenes Team → Kandidat → Vertragsangebot → Preview-Skeleton sichtbar
3. Verhandeln → Counter/Reject/Accept → Confirm erst nach Accept
4. Abbrechen nach Preview → Malus-Meldung, kein Full-Page-Reload
5. Gleichen Spieler erneut öffnen → „Spieler ist noch angefressen“ wenn Malus aktiv
6. In S2: unter „Letzte Deals“ auch S1-Transfers sichtbar

**Notizen:**

```
```

## Offen (nicht dieser Pass)

- S3 AI-Markt-Balancing (`season3_market_activity_balance_suspicious`)
- Server-authoritative Buy-Apply (Prod/MP)
