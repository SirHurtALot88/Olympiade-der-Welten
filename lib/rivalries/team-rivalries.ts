import type { GameState, Team, TeamIdentity } from "@/lib/data/olyDataTypes";

type CoreAxis = "pow" | "spe" | "men" | "soc";

export type TeamRelationshipRecord = {
  fromTeamId: string;
  toTeamId: string;
  value: number;
  source: "team_relationship_sheet";
};

export type TeamRivalryLedgerEntry = {
  rivalryId: string;
  teamAId: string;
  teamBId: string;
  teamAValue: number;
  teamBValue: number;
  intensity: number;
  isMutual: boolean;
  theme: "overall" | "power" | "speed" | "mental" | "social";
  label: string;
  status: "active" | "dormant";
  source: "team_relationship_sheet";
};

const TEAM_RELATIONSHIP_CSV = `Team,Kürzel,A-A,B-P,B-B,C-C,C-S,D-L,D-P,G-G,H-R,L-R,P-S,L-K,M-M,M-S,N-W,N-N,P-C,R-L,R-R,R-C,S-S,S-C,T-T,T-C,T-G,U-A,V-D,V-W,V-V,W-W,W-L,Z-H
Armageddon Aftermath,A-A,X,-1,-1,-2,-1,-5,-2,-2,-3,-3,-1,-3,-1,-1,-1,-1,-1,-1,-1,-1,2,-1,-1,-1,-1,-1,-1,-2,-1,-5,0,-1
Black Panthers,B-P,-1,X,0,0,1,0,0,0,0,0,0,0,1,0,-1,-5,-2,0,0,0,0,0,-1,0,1,3,0,2,0,-1,1,0
Blazing Beasts,B-B,-1,0,X,0,0,0,0,0,0,0,-2,0,1,0,3,0,0,5,3,0,0,0,0,0,-5,0,2,0,0,0,-2,0
Cash Creators,C-C,-2,0,0,X,0,0,3,0,0,0,0,0,0,0,0,0,0,0,0,5,0,0,0,3,0,0,0,0,0,0,0,5
Cold Steel,C-S,-1,1,0,0,X,-1,0,0,-1,-1,0,-1,0,0,0,-1,-2,0,0,1,0,1,0,0,0,0,0,-1,-1,0,0,-1
Dire Legion,D-L,-5,0,0,0,-1,X,1,-3,-1,-1,-1,-1,0,0,-2,0,0,0,0,-1,0,0,0,-4,0,-2,0,-3,0,-1,-4,0
Death Peaches,D-P,-2,0,0,3,0,1,X,2,1,0,-1,0,0,0,0,0,-1,0,0,1,0,0,1,0,0,0,-2,4,0,2,-2,0
Golden Gladiators,G-G,-2,0,0,0,0,-3,2,X,-3,-5,0,-4,0,0,0,0,0,0,0,3,0,1,0,5,0,0,0,0,-2,0,-1,-2
Hell Raisers,H-R,-3,0,0,0,-1,-1,1,-3,X,2,0,0,0,0,-1,0,0,0,0,-2,0,-1,-1,-4,0,0,0,-2,0,0,0,0
Last Ride,L-R,-3,0,0,0,-1,-1,0,-5,3,X,0,-3,-1,-2,0,0,0,0,0,0,0,0,-3,-2,-3,0,0,0,0,0,0,-3
Project Suicide,P-S,-1,0,-2,0,0,-1,-1,0,0,0,X,0,0,0,0,0,-1,0,0,1,0,0,0,0,0,-1,0,-1,-2,0,0,-4
Lost Kingdom,L-K,-3,0,0,0,-1,-1,0,-4,0,-3,0,X,0,-2,-1,0,0,0,0,-5,0,-1,0,-2,0,0,0,0,0,2,0,0
Mayhem Mavericks,M-M,-1,1,1,0,0,0,0,0,0,-1,0,0,X,0,0,0,0,0,0,0,0,0,0,0,0,-1,-1,0,-1,0,0,-3
Mortal Sin,M-S,-1,0,0,0,0,0,0,0,0,0,0,-2,0,X,1,0,2,0,0,0,0,0,1,0,0,0,0,0,0,0,-2,0
Natures Wrath,N-W,-1,-2,3,0,0,-2,0,0,-1,-1,0,-1,0,1,X,0,-1,2,4,0,-2,0,0,0,5,0,2,0,0,0,0,-1
Nunchuck Ninjas,N-N,-1,-5,0,0,-2,0,0,0,0,0,0,0,0,-1,0,X,2,0,0,-1,0,0,-1,0,-1,3,-1,-4,0,0,-1,1
Pirate Crew,P-C,-1,-2,0,0,-2,0,-1,0,0,0,-1,0,0,2,-1,2,X,0,-4,-1,0,0,0,-1,0,-1,0,-2,4,0,-2,0
Raging Lunatics,R-L,-1,0,5,0,0,0,0,0,0,0,0,0,0,0,2,0,0,X,2,0,-2,0,0,0,2,0,1,0,0,-3,0,0
Riptide Rivers,R-R,-1,0,3,0,0,0,0,0,0,0,0,0,0,0,4,0,-4,2,X,0,-1,0,0,0,1,0,0,0,-2,0,0,0
Royal Court,R-C,-1,0,0,5,1,-1,1,3,-2,0,1,-5,0,0,0,-1,-1,0,0,X,0,3,0,5,0,-2,0,-1,-1,0,1,-2
Silver Soldiers,S-S,2,0,0,0,0,0,0,0,0,0,0,0,0,0,-1,0,0,-3,-1,0,X,0,0,0,2,2,-1,0,0,2,1,0
Stronghold Crusaders,S-C,-1,0,0,0,1,0,0,1,-1,0,0,-1,0,0,0,0,0,0,0,3,0,X,0,3,0,0,0,0,-3,-5,-2,0
Terrible Teachers,T-T,-1,-1,0,0,0,0,1,0,-1,0,0,0,0,1,0,0,0,0,0,0,0,0,X,0,0,0,0,4,0,0,0,0
The Chantry,T-C,-1,0,0,3,0,-4,0,5,-4,-2,0,-2,0,0,0,0,-1,0,0,5,0,0,0,X,0,1,0,-3,-2,3,-1,-2
The Giants,T-G,-1,1,-5,0,0,0,0,0,0,-3,0,0,0,0,5,-1,0,2,1,0,2,0,0,0,X,0,1,0,0,2,0,0
Undercover Agents,U-A,-1,3,0,0,0,-2,0,0,0,0,-1,0,-1,0,0,3,-1,0,0,-2,2,0,0,1,0,X,0,3,0,0,-4,0
Vicious & Delicious,V-D,-1,0,2,0,2,0,-2,0,0,-1,0,0,0,0,2,-1,0,1,0,0,-1,0,0,0,1,0,X,0,2,0,-1,0
Vigilante Wranglers,V-W,-2,2,0,0,-1,-3,4,0,-2,0,-1,0,0,0,0,-4,-2,0,0,-1,0,0,4,-3,0,3,0,X,-1,0,1,-1
Vigorous Vikings,V-V,-1,0,0,0,-1,0,0,-2,0,0,-2,0,-1,0,0,0,4,0,-2,-1,0,-3,0,-2,0,0,2,-1,X,-2,0,0
Wicked Wizards,W-W,-5,-1,0,0,0,-1,2,0,0,0,0,2,0,0,0,0,0,-1,0,0,2,-5,0,3,2,0,0,0,-2,X,0,-1
Wrecking Legionnaires,W-L,0,1,-2,0,0,-4,-2,-1,0,0,0,0,0,0,0,-1,-2,0,0,1,1,-2,0,-1,0,-4,-1,1,0,0,X,0
Zero Heroes,Z-H,-1,0,0,5,-1,0,0,-2,0,-2,-4,0,-5,0,-1,1,0,0,0,-2,0,0,0,-2,0,0,0,-1,0,-4,0,X`;

function parseRelationshipCsv(): TeamRelationshipRecord[] {
  const [headerLine, ...lines] = TEAM_RELATIONSHIP_CSV.trim().split(/\r?\n/);
  const headers = headerLine.split(",").slice(2);
  const records: TeamRelationshipRecord[] = [];
  for (const line of lines) {
    const cells = line.split(",");
    const fromTeamId = cells[1];
    if (!fromTeamId) continue;
    headers.forEach((toTeamId, index) => {
      if (toTeamId === fromTeamId) return;
      const value = Number(cells[index + 2]);
      if (!Number.isFinite(value)) return;
      records.push({ fromTeamId, toTeamId, value, source: "team_relationship_sheet" });
    });
  }
  return records;
}

const RELATIONSHIPS = parseRelationshipCsv();
const RELATIONSHIP_BY_PAIR = new Map(RELATIONSHIPS.map((entry) => [`${entry.fromTeamId}->${entry.toTeamId}`, entry] as const));

function getRelationshipValue(fromTeamId: string, toTeamId: string) {
  return RELATIONSHIP_BY_PAIR.get(`${fromTeamId}->${toTeamId}`)?.value ?? 0;
}

function strongestIdentityAxis(identity: TeamIdentity | null): CoreAxis {
  if (!identity) return "pow";
  return (["pow", "spe", "men", "soc"] as const).reduce((best, axis) => (identity[axis] > identity[best] ? axis : best), "pow");
}

function axisToTheme(axis: CoreAxis): TeamRivalryLedgerEntry["theme"] {
  if (axis === "pow") return "power";
  if (axis === "spe") return "speed";
  if (axis === "men") return "mental";
  return "social";
}

function getTeamLabel(teams: Team[], teamId: string) {
  return teams.find((team) => team.teamId === teamId)?.name ?? teamId;
}

export function getTeamRelationshipRecords() {
  return RELATIONSHIPS;
}

export function getTeamRelationship(fromTeamId: string, toTeamId: string) {
  return RELATIONSHIP_BY_PAIR.get(`${fromTeamId}->${toTeamId}`) ?? null;
}

export function buildTeamRivalryLedger(gameState: Pick<GameState, "teams" | "teamIdentities">): TeamRivalryLedgerEntry[] {
  const identitiesByTeamId = new Map(gameState.teamIdentities.map((identity) => [identity.teamId, identity] as const));
  const teamIds = gameState.teams.map((team) => team.teamId);
  const rivalries: TeamRivalryLedgerEntry[] = [];

  for (let leftIndex = 0; leftIndex < teamIds.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < teamIds.length; rightIndex += 1) {
      const teamAId = teamIds[leftIndex];
      const teamBId = teamIds[rightIndex];
      const teamAValue = getRelationshipValue(teamAId, teamBId);
      const teamBValue = getRelationshipValue(teamBId, teamAId);
      const isMutual = teamAValue <= -2 && teamBValue <= -2;
      const intensity = Math.max(Math.abs(Math.min(teamAValue, 0)), Math.abs(Math.min(teamBValue, 0)));
      const qualifies = intensity >= 4 || isMutual || teamAValue + teamBValue <= -5;
      if (!qualifies) continue;

      const axisA = strongestIdentityAxis(identitiesByTeamId.get(teamAId) ?? null);
      const axisB = strongestIdentityAxis(identitiesByTeamId.get(teamBId) ?? null);
      const theme = axisA === axisB ? axisToTheme(axisA) : "overall";
      rivalries.push({
        rivalryId: [teamAId, teamBId].sort().join("__"),
        teamAId,
        teamBId,
        teamAValue,
        teamBValue,
        intensity,
        isMutual,
        theme,
        label: `${getTeamLabel(gameState.teams, teamAId)} vs. ${getTeamLabel(gameState.teams, teamBId)}`,
        status: "active",
        source: "team_relationship_sheet",
      });
    }
  }

  return rivalries.sort((left, right) => right.intensity - left.intensity || left.label.localeCompare(right.label, "de"));
}

export function getPrimaryTeamRivalry(gameState: Pick<GameState, "teams" | "teamIdentities">, teamId: string) {
  return buildTeamRivalryLedger(gameState)
    .filter((entry) => entry.teamAId === teamId || entry.teamBId === teamId)
    .sort((left, right) => {
      const leftOwnValue = left.teamAId === teamId ? left.teamAValue : left.teamBValue;
      const rightOwnValue = right.teamAId === teamId ? right.teamAValue : right.teamBValue;
      return Math.min(leftOwnValue, rightOwnValue) - Math.max(leftOwnValue, rightOwnValue) || right.intensity - left.intensity;
    })[0] ?? null;
}
