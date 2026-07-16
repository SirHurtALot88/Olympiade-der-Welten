#!/usr/bin/env bash
# Fast S1-draft-only evaluation loop (~2 min): self-seed a fresh league, run only the draft, then
# print top-10 most expensive players + per-team lane/tier distribution + MW/Cash/salary. For quickly
# iterating on buy/composition balancing without the slow multi-season sim.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"; cd "$ROOT"
OUT="${OUT:-/tmp/draft-eval-$(date +%s)}"; mkdir -p "$OUT"
export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=8192}"
export OLY_LONG_RUN_OUTPUT_DIR="$OUT"
export OLY_LONG_RUN_ALLOW_DEV_SERVER="${OLY_LONG_RUN_ALLOW_DEV_SERVER:-1}"
# Emergency repair stays OFF: a 0/N team should be root-caused, not papered over.
export OLY_ENABLE_EMERGENCY_REPAIR="${OLY_ENABLE_EMERGENCY_REPAIR:-0}"
export OLY_LONG_RUN_BALANCE_PROFILE=iterate OLY_UNIFIED_PICK=1
export OLY_LONG_RUN_STOP_AFTER=draft

echo "[draft-eval] OUT=$OUT"
node --import tsx scripts/long-run-sandbox-s1-s6.ts > "$OUT/draft.log" 2>&1
SAVE=$(grep -oE 'fresh-season-1-[0-9]+' "$OUT/draft.log" | head -1)
echo "[draft-eval] SAVE=$SAVE"
[[ -z "$SAVE" ]] && { echo "[draft-eval] ERROR: no save id"; tail -5 "$OUT/draft.log"; exit 1; }

export OLY_APP_SQLITE_PATH="$OUT/balancing-run.sqlite"
echo; echo "===== TOP-10 teuerste ====="
npx tsx scripts/export-top-expensive-players.ts --save-id "$SAVE" --top 10 2>/dev/null | sed -n '3,15p;$p'
echo; echo "===== Lanes / Rollen + MW/Cash je Team ====="
npx tsx -e '
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { resolvePlayerEconomyContract } from "@/lib/foundation/player-economy-contract";
import { buildLeagueMarketBrackets, classifyMarketBracket } from "@/lib/ai/market-pick-engine/market-brackets";
const p=createPersistenceService(); const s=p.getSaveById(process.argv[1])!; const gs=s.gameState;
const br=buildLeagueMarketBrackets(gs.players.map(pl=>pl.marketValue??pl.displayMarketValue??null));
const byId=new Map(gs.players.map(pl=>[pl.id,pl])); const rById=new Map(gs.rosters.map(r=>[r.playerId,r]));
const byTeam=new Map<string,string[]>(); for(const r of gs.rosters){(byTeam.get(r.teamId)??byTeam.set(r.teamId,[]).get(r.teamId)!).push(r.playerId);}
const T=(t:string)=>({Superstar:0,Star:0,Core:0,Depth:0,Backup:0,Reserve:0} as Record<string,number>);
let kernSum=0,n=0,mwSum=0,salSum=0,cashSum=0;
const rows=gs.teams.map(t=>{
  const ids=byTeam.get(t.teamId)??[]; const c=T(""); let mw=0,sal=0;
  for(const id of ids){const pl=byId.get(id); if(!pl)continue; const ct=resolvePlayerEconomyContract({player:pl as never,rosterEntry:rById.get(id) as never}); const v=ct.marketValue??pl.marketValue??0; mw+=v; sal+=ct.salary??0; c[classifyMarketBracket(v,br)]++;}
  const kern=ids.length?Math.round((c.Superstar+c.Star+c.Core+c.Depth)/ids.length*100):0;
  kernSum+=kern;n++;mwSum+=mw;salSum+=sal;cashSum+=(t.cash??0);
  return {code:t.shortCode??t.teamId,n:ids.length,c,mw:Math.round(mw),sal:Math.round(sal),cash:Math.round((t.cash??0)*10)/10,kern};
}).sort((a,b)=>b.mw-a.mw);
console.log("Team|Kader|SStar|Star|Core|Depth|Backup|Reserve|Kern%|MW|Gehalt|Cash");
for(const r of rows) console.log(`${r.code}|${r.n}|${r.c.Superstar}|${r.c.Star}|${r.c.Core}|${r.c.Depth}|${r.c.Backup}|${r.c.Reserve}|${r.kern}%|${r.mw}|${r.sal}|${r.cash}`);
console.log(`--- Liga-Ø: Kern% ${Math.round(kernSum/n)} · MW ${Math.round(mwSum/n)} · Gehalt ${Math.round(salSum/n)} · Cash ${Math.round(cashSum/n*10)/10}`);
const mid=rows.reduce((s,r)=>s+r.c.Core+r.c.Depth+r.c.Backup,0), res=rows.reduce((s,r)=>s+r.c.Reserve,0), star=rows.reduce((s,r)=>s+r.c.Superstar+r.c.Star,0);
console.log(`--- Liga gesamt: Stars ${star} · Mitte(Core/Depth/Backup) ${mid} · Reserve ${res}`);
' "$SAVE" 2>/dev/null
echo; echo "===== Dispersion & Identitäts-Korrelation ====="
npx tsx scripts/export-dispersion-metrics.ts --save-id "$SAVE" 2>/dev/null
echo "[draft-eval] done · $OUT"
