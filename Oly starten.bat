@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

echo ================================================
echo    Olympiade der Welten - Start ^(Windows^)
echo ================================================
echo Projekt: %CD%
echo.

REM --- 1) Node.js vorhanden? ---
where node >nul 2>nul
if errorlevel 1 (
  echo [FEHLER] Node.js ist nicht installiert.
  echo Bitte zuerst Node.js LTS ^(Version 20^) installieren: https://nodejs.org
  echo Danach dieses Fenster schliessen und "Oly starten.bat" erneut doppelklicken.
  echo.
  pause
  exit /b 1
)

REM --- 2) Abhaengigkeiten installiert? ---
if not exist "node_modules" (
  echo Erste Einrichtung: installiere Abhaengigkeiten ^(npm install^) ...
  echo Das kann beim ersten Mal einige Minuten dauern.
  echo.
  call npm install
  if errorlevel 1 (
    echo.
    echo [FEHLER] "npm install" ist fehlgeschlagen ^(siehe Meldungen oben^).
    echo Siehe docs\WINDOWS_SETUP.md, Abschnitt "Falls npm install haengt".
    pause
    exit /b 1
  )
)

REM --- 3) Browser automatisch oeffnen, sobald der Server antwortet ---
start "Oly Browser" cmd /c "for /l %%i in (1,1,90) do (curl -s -o nul http://localhost:3000/foundation?view=home && (start "" http://localhost:3000/foundation?view=home & exit) || (timeout /t 2 /nobreak >nul))"

echo.
echo Server startet ... der Browser oeffnet sich gleich von selbst.
echo Zum Beenden: dieses Fenster schliessen oder Strg+C druecken.
echo.

REM --- 4) Dev-Server starten (laeuft im Vordergrund) ---
call npm run dev
