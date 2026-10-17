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

# E1 (docs/design/battle-arena-auto-run-anbindung-plan-16-10.md Abschnitt 4.1, Fund F7/F8):
# fester Ablagepfad fuer die Playwright-Browser, damit Build-Layer und Laufzeit dieselbe
# Installation sehen. `OLY_ARENA_CHROMIUM_EXECUTABLE` ist absichtlich SCHON HIER deklariert
# (leer = kein Override) und wird an den Container durchgereicht -- `lib/battle/
# arena-headless-runner.ts` liest die Variable heute noch NICHT (das waere ein lib/-Umbau,
# bewusst NICHT Teil dieses PRs, s. PR-Beschreibung "Vorschlag fuer den naechsten Agenten").
# Ohne gesetzten Override faellt der Runner schon heute automatisch auf `channel: "chromium"`
# zurueck, weil sein hartkodierter Pfad `/opt/pw-browsers/chromium-1194/...` in diesem Image
# nicht existiert -- und Playwright loest "chromium" ueber genau `PLAYWRIGHT_BROWSERS_PATH`
# auf. Damit laeuft die Revision aus diesem Image (1223) ohne Codeaenderung, der ENV-Name ist
# nur fuer einen spaeteren expliziten Override vorbereitet.
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
ENV OLY_ARENA_CHROMIUM_EXECUTABLE=""

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

# E1 -- VOLLES Chromium fuer die Battle Arena (docs/design/
# battle-arena-auto-run-anbindung-plan-16-10.md Abschnitt 4, Fund F8). Ohne dieses Image hat
# der Server KEIN Chromium: `playwright` ist im Laufzeit-Image heute nur zufaellig vorhanden,
# weil `npm ci` ohne `--omit=dev` laeuft und `builder` das ganze `/app` inklusive
# `node_modules` kopiert (das transitive `@playwright/test`-devDependency bringt zwar das
# `playwright`-NPM-Paket mit, aber KEIN Browser-Binary -- das installiert ausschliesslich
# dieser Schritt).
#
# EIGENE, CACHEBARE SCHICHT, VOR `COPY --from=builder`: ein reiner App-Code-Commit (die
# weitaus haeufigste Deploy-Ursache) aendert an dieser Zeile nichts, Docker nutzt den
# Layer-Cache, und `auto-deploy.sh` muss die ~370 MB Chromium + ~200-350 MB Systempakete
# NICHT bei jedem Push neu herunterladen. Invalidiert wird die Schicht nur, wenn sich die
# Versionszeile selbst aendert (also bewusst, bei einem Playwright-Upgrade).
#
# VERSION MUSS der in package.json/package-lock.json entsprechen (PR 0 hat den
# CI-Waechter `tests/arena-chromium-revision-goldentest.test.ts` dafuer eingefuehrt; ein
# echter Versions-MISMATCH zwischen dieser Zeile und dem Lockfile wuerde der Goldentest aber
# nur LOKAL auffangen, wenn beide Revisionen vorhanden sind -- hier zaehlt vor allem die
# Disziplin, beide Stellen gemeinsam zu pflegen).
#
# `--no-shell`: Der Rueckfall in `ermittleChromiumLaunchOptions()`
# (`arena-headless-runner.ts:396-408`) erzwingt `channel: "chromium"`, also IMMER das volle
# Binary, nie die separate "Chromium Headless Shell" -- die waere hier also nur
# verschwendeter Platz (zusaetzlich ~260 MB, Plan 4.2).
#
# SANDBOX/NETZ, Opus-Auflage (Plan Abschnitt 9.5): dieser Schritt installiert Chromium nur,
# er AENDERT NICHTS an den Launch-Flags -- die stehen in
# `ARENA_NETZWERK_ABRIEGELUNG_ARGS`/`ermittleChromiumLaunchOptions()`
# (`lib/battle/arena-headless-runner.ts`, nicht Teil dieses PRs) und tragen weiterhin KEIN
# `--no-sandbox`. Chromiums eigene Sandbox bleibt also aktiv, Chromium laeuft spaeter als
# Nicht-Root-User `oly` (uid 1001, `USER oly` unten), und die einzige Navigation ist
# `file://` auf die im Image mitgelieferten Motor-Dateien -- kein Netzwerkzugriff dafuer
# noetig (`--proxy-server=direct://` + `--host-resolver-rules=MAP * 0.0.0.0` kappen jeden
# Versuch). Einzelheiten, inklusive der offenen Frage, ob Chromiums interne Sandbox innerhalb
# eines Docker-Containers ueberhaupt startet (das ist container-spezifisch und wurde in dieser
# Sitzung bewusst NICHT per echtem `chromium.launch()` getestet, um keinen lokalen
# Chromium-Lauf parallel zu einem anderen Agenten zu starten), stehen in der PR-Beschreibung.
# Der neue CI-Job `arena-image-chromium-probe` (.github/workflows/ci.yml) ist der erste
# echte Test davon.
RUN npx -y playwright@1.60.0 install --with-deps --no-shell chromium \
  && chmod -R a+rX "$PLAYWRIGHT_BROWSERS_PATH" \
  && rm -rf /var/lib/apt/lists/* /root/.npm

COPY --from=builder --chown=oly:nodejs /app ./

# `bug-reports` MUSS hier stehen, obwohl der Ordner ueber `data/bug-reports/README.md` ohnehin aus
# dem Repo mitkaeme. Docker legt ein neues Named Volume aus dem Image-Pfad an und uebernimmt dabei
# dessen Eigentuemer — gibt es den Pfad im Image NICHT, gehoert das Volume root, und die App laeuft
# als `oly` (uid 1001). Schreiben scheitert dann mit EACCES: die Flagge meldet "Senden
# fehlgeschlagen", der Server hat nichts, und nichts im Log sagt warum. Die Existenz des Ordners
# haenge damit an einer einzelnen README-Datei — wer die aufraeumt, kippt still den ganzen
# Melde-Weg. Hier steht sie explizit.
# `.cache/media-thumbs` steht aus GENAU DEM GRUND hier, den der Absatz darueber fuer
# `bug-reports` beschreibt — und es ist derselbe Fehler in seiner zweiten Auspraegung.
#
# GEMELDET VON CHRIS: „wenn ich teams seite aufrufe laden die spieler portraits furchtbar
# langsam."
#
# Dorthin schreibt `getVariantCachePath` (lib/media/serveMediaAsset.ts) die verkleinerten
# Portraits/Logos: `process.cwd()/.cache/media-thumbs/<art>/<id>-<variante>-<mtime>.webp`. Ohne
# Volume liegt dieser Ordner IM CONTAINER — und der Auto-Deploy baut bei jedem Push auf main einen
# neuen. Jeder Deploy warf also den kompletten Thumbnail-Bestand weg, und die naechste Teamseite
# musste jedes Portrait neu dekodieren und verkleinern, gedrosselt auf vier gleichzeitige Ladungen
# (`DEFAULT_MAX_CONCURRENT_PORTRAIT_LOADS`). Genau so fuehlt sich „furchtbar langsam" an.
#
# Der Ordner MUSS im Image existieren, sonst gehoert das frische Named Volume root und die App
# (uid 1001) bekommt EACCES beim Schreiben.
RUN mkdir -p /app/data/persistence /app/data/bug-reports /app/.cache/media-thumbs \
  && chmod +x /app/scripts/start-hosted.sh \
  && chown -R oly:nodejs /app/data /app/.next /app/deploy /app/.cache

USER oly

EXPOSE 3000

CMD ["./scripts/start-hosted.sh"]
