# Extern Deploy Readiness

Stand: 2026-06-25

Hosting-Vorbereitung ist im Repo vorhanden (Commit `9459cc7`). Deploy erfolgt **nach** Playtest, Balancing-Gate und Commit des aktuellen Gameplay/UI-Stands.

## Bereits vorbereitet

- [`Dockerfile`](Dockerfile) + [`scripts/start-hosted.sh`](scripts/start-hosted.sh)
- [`deploy/hetzner/docker-compose.yml`](deploy/hetzner/docker-compose.yml) + [`deploy/hetzner/Caddyfile`](deploy/hetzner/Caddyfile)
- [`deploy/hetzner/README.md`](deploy/hetzner/README.md)
- [`docs/deployment-hetzner-v1.md`](docs/deployment-hetzner-v1.md)
- `npm run deploy:hetzner` mit Save-Backup vor Deploy

## Deploy-Gate (Reihenfolge)

1. Zocken-Checkliste grün (Transfermarkt, Verhandlung, Arena, HQ, Saisonabschluss)
2. Balancing Block 1+2 ohne RED
3. Commit + Push des aktuellen Stands
4. Docker-Build lokal testen: `npm run build`
5. Server: `docker compose -f deploy/hetzner/docker-compose.yml --env-file deploy/hetzner/.env up -d --build`
6. Healthcheck: `/api/health`
7. Hard-Reload Playtest auf gehosteter URL

## Noch manuell (Chris)

- Hetzner CX23 + Domain + SSH-Key
- `deploy/hetzner/.env` mit echter `OLY_DOMAIN`

## Bewusst später

- Supabase/Prisma als write SoT (read-only Referenz bleibt)
- Formkarten/Mutator-Vollintegration
- Whole Season Execute
