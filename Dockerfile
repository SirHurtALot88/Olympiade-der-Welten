FROM node:22-bookworm-slim AS deps

WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1
# Beide Spieler sitzen in Deutschland. `Europe/Berlin` (statt einer festen
# +1/+2-Verschiebung) wechselt automatisch zwischen MEZ/MESZ.
ENV TZ=Europe/Berlin

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ tzdata \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS builder

# Build-Stempel für die Sidebar-Version-Badge (app/foundation/shell/FoundationSidebar.tsx
# via lib/app-version.ts). NEXT_PUBLIC_*-Vars müssen VOR `npm run build` als ENV gesetzt
# sein, damit Next.js sie ins Client-Bundle inlined. Werden die ARGs beim `docker build`
# nicht übergeben, bleiben sie leer und die UI zeigt den unmissverständlichen
# "v<version> · dev"-Fallback statt eines erfundenen Stempels.
ARG NEXT_PUBLIC_OLY_BUILD_SHA=""
ARG NEXT_PUBLIC_OLY_BUILD_DATE=""
ENV NEXT_PUBLIC_OLY_BUILD_SHA=$NEXT_PUBLIC_OLY_BUILD_SHA
ENV NEXT_PUBLIC_OLY_BUILD_DATE=$NEXT_PUBLIC_OLY_BUILD_DATE

COPY . .
RUN npm run db:generate
RUN npm run build
RUN mkdir -p /app/deploy/seed \
  && if [ -f /app/data/persistence/oly-app.sqlite ]; then cp /app/data/persistence/oly-app.sqlite /app/deploy/seed/oly-app.sqlite; fi

FROM node:22-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV OLY_APP_SQLITE_PATH=/app/data/persistence/oly-app.sqlite
# Beide Spieler sitzen in Deutschland. `Europe/Berlin` (statt einer festen
# +1/+2-Verschiebung) wechselt automatisch zwischen MEZ/MESZ.
ENV TZ=Europe/Berlin

# `git` MUSS mit ins Laufzeit-Image.
#
# GEFUNDEN IM SERVER-LOG, alle 180 Sekunden, seit dem ersten Tag:
#     [online-saves] Auto-Export-Fehler: Command failed: git add -- data/online-saves data/bug-reports
#     /bin/sh: 1: git: not found
#
# Der Auto-Export (`lib/persistence/online-save-auto-export.ts`) schreibt die Spielstaende brav nach
# `data/online-saves/` — und scheitert dann JEDES MAL beim Hochladen, weil das Laufzeit-Image kein
# git hat. Der Export meldete dabei Erfolg ("exportiert: 8 Save(s)"), der Push-Fehler stand eine
# Zeile darunter und wurde nie gelesen.
#
# Folge: ueber diesen Weg kam nie ein echter Spielstand ins Repo. In `data/online-saves/` lagen
# ueber die gesamte Historie nur Smoke- und Audit-Saves aus Testumgebungen, und keine
# Claude-Sitzung konnte einen Fehler am echten Stand nachstellen.
#
# Bewusst im runner-Stage und nicht nur im builder: gebraucht wird es zur LAUFZEIT.
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ tzdata git \
  && rm -rf /var/lib/apt/lists/* \
  && addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 oly

COPY --from=builder --chown=oly:nodejs /app ./

# `bug-reports` MUSS hier stehen, obwohl der Ordner ueber `data/bug-reports/README.md` ohnehin aus
# dem Repo mitkaeme. Docker legt ein neues Named Volume aus dem Image-Pfad an und uebernimmt dabei
# dessen Eigentuemer — gibt es den Pfad im Image NICHT, gehoert das Volume root, und die App laeuft
# als `oly` (uid 1001). Schreiben scheitert dann mit EACCES: die Flagge meldet "Senden
# fehlgeschlagen", der Server hat nichts, und nichts im Log sagt warum. Die Existenz des Ordners
# haenge damit an einer einzelnen README-Datei — wer die aufraeumt, kippt still den ganzen
# Melde-Weg. Hier steht sie explizit.
RUN mkdir -p /app/data/persistence /app/data/bug-reports \
  && chmod +x /app/scripts/start-hosted.sh \
  && chown -R oly:nodejs /app/data /app/.next /app/deploy

USER oly

EXPOSE 3000

CMD ["./scripts/start-hosted.sh"]
