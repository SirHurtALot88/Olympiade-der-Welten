#!/usr/bin/env bash
# Fast buy+sell evaluation (~5 min): self-seed a fresh league, run the draft (= buys) then S1 to
# season_end (matchdays + sponsor + sell pass = sells), and print buy state (top-10 + lanes) plus the
# sell summary (what got sold, cash before/after sells) + economy. For iterating on buy/sell balancing
# without the slow multi-season sim.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"; cd "$ROOT"
OUT="${OUT:-/tmp/buysell-eval-$(date +%s)}"; mkdir -p "$OUT"
export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=8192}"
export OLY_LONG_RUN_OUTPUT_DIR="$OUT" OLY_LONG_RUN_ALLOW_DEV_SERVER="${OLY_LONG_RUN_ALLOW_DEV_SERVER:-1}"
# Emergency repair stays OFF: a 0/N team should be root-caused, not papered over.
export OLY_ENABLE_EMERGENCY_REPAIR="${OLY_ENABLE_EMERGENCY_REPAIR:-0}"
export OLY_LONG_RUN_BALANCE_PROFILE=iterate OLY_UNIFIED_PICK=1

echo "[buysell-eval] draft (buys) ..."
OLY_LONG_RUN_STOP_AFTER=draft node --import tsx scripts/long-run-sandbox-s1-s6.ts > "$OUT/draft.log" 2>&1
SAVE=$(grep -oE 'fresh-season-1-[0-9]+' "$OUT/draft.log" | head -1)
[[ -z "$SAVE" ]] && { echo "ERROR: no save"; tail -5 "$OUT/draft.log"; exit 1; }
echo "[buysell-eval] SAVE=$SAVE — S1 to season_end (sells) ..."
OLY_LONG_RUN_SAVE_ID="$SAVE" OLY_LONG_RUN_FINAL_SEASON=1 OLY_LONG_RUN_STOP_AFTER=season_end \
  node --import tsx scripts/long-run-sandbox-s1-s6.ts > "$OUT/season_end.log" 2>&1 || echo "[buysell-eval] WARN: season_end returned nonzero"

export OLY_APP_SQLITE_PATH="$OUT/balancing-run.sqlite"
echo; echo "===== TOP-10 teuerste (nach S1) ====="
npx tsx scripts/export-top-expensive-players.ts --save-id "$SAVE" --top 10 2>/dev/null | sed -n '3,15p;$p'
echo; echo "===== Buy/Sell + Economy je Team ====="
npx tsx -e '
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { resolvePlayerEconomyContract } from "@/lib/foundation/player-economy-contract";
import { buildLeagueMarketBrackets, classifyMarketBracket } from "@/lib/ai/market-pick-engine/market-brackets";
const p=createPersistenceService(); const s=p.getSaveById(process.argv[1])!; const gs=s.gameState;
const br=buildLeagueMarketBrackets(gs.players.map(pl=>pl.marketValue??pl.displayMarketValue??null));
const byId=new Map(gs.players.map(pl=>[pl.id,pl])); const rById=new Map(gs.rosters.map(r=>[r.playerId,r]));
const byTeam=new Map<string,string[]>(); for(const r of gs.rosters){(byTeam.get(r.teamId)??byTeam.set(r.teamId,[]).get(r.teamId)!).push(r.playerId);}
const sid=gs.season.id;
const th=gs.transferHistory.filter(t=>t.seasonId===sid);
const buysBy=new Map<string,number>(), sellsBy=new Map<string,number>(), sellFeeBy=new Map<string,number>();
for(const t of th){ if(t.transferType==="buy"&&t.toTeamId){buysBy.set(t.toTeamId,(buysBy.get(t.toTeamId)??0)+1);} if(t.transferType==="sell"&&t.fromTeamId){sellsBy.set(t.fromTeamId,(sellsBy.get(t.fromTeamId)??0)+1); sellFeeBy.set(t.fromTeamId,(sellFeeBy.get(t.fromTeamId)??0)+(t.fee??0));} }
let kern=0,n=0,mw=0,sal=0,cash=0,tb=0,ts=0;
const rows=gs.teams.map(t=>{
  const ids=byTeam.get(t.teamId)??[]; const c:Record<string,number>={Superstar:0,Star:0,Core:0,Depth:0,Backup:0,Reserve:0}; let tmw=0,tsal=0;
  for(const id of ids){const pl=byId.get(id); if(!pl)continue; const ct=resolvePlayerEconomyContract({player:pl as never,rosterEntry:rById.get(id) as never}); const v=ct.marketValue??pl.marketValue??0; tmw+=v; tsal+=ct.salary??0; c[classifyMarketBracket(v,br)]++;}
  const k=ids.length?Math.round((c.Superstar+c.Star+c.Core+c.Depth)/ids.length*100):0;
  kern+=k;n++;mw+=tmw;sal+=tsal;cash+=(t.cash??0); tb+=(buysBy.get(t.teamId)??0); ts+=(sellsBy.get(t.teamId)??0);
  return {code:t.shortCode??t.teamId,n:ids.length,k,mw:Math.round(tmw),sal:Math.round(tsal),cash:Math.round((t.cash??0)*10)/10,b:buysBy.get(t.teamId)??0,se:sellsBy.get(t.teamId)??0,sf:Math.round(sellFeeBy.get(t.teamId)??0)};
}).sort((a,b)=>b.mw-a.mw);
console.log("Team|Kader|Kern%|MW|Gehalt|Cash|Buys|Sells|SellFee");
for(const r of rows) console.log(`${r.code}|${r.n}|${r.k}%|${r.mw}|${r.sal}|${r.cash}|${r.b}|${r.se}|${r.sf}`);
console.log(`--- Liga-Ø: Kern% ${Math.round(kern/n)} · MW ${Math.round(mw/n)} · Gehalt ${Math.round(sal/n)} · Cash ${Math.round(cash/n*10)/10} · Buys ges ${tb} · Sells ges ${ts}`);
const star=rows.reduce((a,r)=>a+0,0);
' "$SAVE" 2>/dev/null
echo "[buysell-eval] done · $OUT"
