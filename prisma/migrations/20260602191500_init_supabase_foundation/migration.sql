-- CreateEnum
CREATE TYPE "SaveStatus" AS ENUM ('active', 'archived', 'template');

-- CreateEnum
CREATE TYPE "SeasonStatus" AS ENUM ('planning', 'active', 'completed');

-- CreateEnum
CREATE TYPE "DisciplineCategory" AS ENUM ('speed', 'strength', 'precision', 'endurance', 'tactics', 'mental', 'social');

-- CreateEnum
CREATE TYPE "MatchdayStatus" AS ENUM ('planning', 'ready', 'resolved');

-- CreateEnum
CREATE TYPE "LineupStatus" AS ENUM ('draft', 'locked', 'submitted');

-- CreateEnum
CREATE TYPE "ActivePlayerStatus" AS ENUM ('active', 'inactive', 'injured', 'free_agent');

-- CreateEnum
CREATE TYPE "ActivePlayerRoleTag" AS ENUM ('starter', 'bench', 'prospect');

-- CreateEnum
CREATE TYPE "TransferType" AS ENUM ('buy', 'sell');

-- CreateEnum
CREATE TYPE "PlayerAttributeKey" AS ENUM ('pow', 'spe', 'men', 'soc');

-- CreateTable
CREATE TABLE "Save" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "SaveStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Save_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Season" (
    "id" TEXT NOT NULL,
    "saveId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "currentMatchday" INTEGER NOT NULL,
    "status" "SeasonStatus" NOT NULL DEFAULT 'planning',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Season_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Alliance" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "bonusFocus" "DisciplineCategory" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Alliance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL,
    "shortCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "logoPath" TEXT,
    "logoUrl" TEXT,
    "allianceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamSeasonState" (
    "id" TEXT NOT NULL,
    "saveId" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "cash" INTEGER NOT NULL,
    "budget" INTEGER NOT NULL,
    "humanControlled" BOOLEAN NOT NULL DEFAULT false,
    "rosterLimit" INTEGER NOT NULL,
    "pow" INTEGER NOT NULL,
    "spe" INTEGER NOT NULL,
    "men" INTEGER NOT NULL,
    "soc" INTEGER NOT NULL,
    "ambition" INTEGER NOT NULL,
    "finances" INTEGER NOT NULL,
    "boardConfidence" INTEGER NOT NULL,
    "harmony" INTEGER NOT NULL,
    "manners" INTEGER NOT NULL,
    "popularity" INTEGER NOT NULL,
    "cooperation" INTEGER NOT NULL,
    "playerMin" INTEGER NOT NULL,
    "playerOpt" INTEGER NOT NULL,
    "sponsor" INTEGER,
    "sourceNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeamSeasonState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Player" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "portraitPath" TEXT,
    "portraitUrl" TEXT,
    "age" INTEGER,
    "nationality" TEXT,
    "className" TEXT NOT NULL,
    "race" TEXT NOT NULL,
    "alignment" TEXT NOT NULL,
    "gender" TEXT NOT NULL,
    "flavorEn" TEXT NOT NULL,
    "flavorDe" TEXT NOT NULL,
    "subclasses" JSONB NOT NULL,
    "traitsPositive" JSONB NOT NULL,
    "traitsNegative" JSONB NOT NULL,
    "preferredDisciplineIds" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Player_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerAttribute" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "rating" DOUBLE PRECISION NOT NULL,
    "marketValue" INTEGER NOT NULL,
    "salaryDemand" INTEGER NOT NULL,
    "pow" DOUBLE PRECISION NOT NULL,
    "spe" DOUBLE PRECISION NOT NULL,
    "men" DOUBLE PRECISION NOT NULL,
    "soc" DOUBLE PRECISION NOT NULL,
    "fatigue" DOUBLE PRECISION NOT NULL,
    "form" DOUBLE PRECISION NOT NULL,
    "potential" DOUBLE PRECISION NOT NULL,
    "above20" INTEGER NOT NULL,
    "above40" INTEGER NOT NULL,
    "above60" INTEGER NOT NULL,
    "above80" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlayerAttribute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerDisciplineScore" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "disciplineId" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlayerDisciplineScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivePlayer" (
    "id" TEXT NOT NULL,
    "saveId" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "status" "ActivePlayerStatus" NOT NULL DEFAULT 'active',
    "roleTag" "ActivePlayerRoleTag" NOT NULL,
    "contractLength" INTEGER NOT NULL,
    "salary" INTEGER NOT NULL,
    "upkeep" INTEGER NOT NULL,
    "purchasePrice" INTEGER,
    "currentValue" INTEGER,
    "joinedSeasonId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActivePlayer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Discipline" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "DisciplineCategory" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Discipline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DisciplineWeight" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT,
    "disciplineId" TEXT NOT NULL,
    "disciplineKey" TEXT NOT NULL,
    "attributeKey" "PlayerAttributeKey" NOT NULL,
    "weightPct" DOUBLE PRECISION NOT NULL,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DisciplineWeight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeasonDisciplineConfig" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "disciplineId" TEXT NOT NULL,
    "originalOrder" INTEGER,
    "displayOrder" INTEGER,
    "playerCount" INTEGER,
    "mutator1" TEXT,
    "mutator2" TEXT,
    "colorGroup" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SeasonDisciplineConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Matchday" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "status" "MatchdayStatus" NOT NULL DEFAULT 'planning',
    "homeTeamId" TEXT,
    "awayTeamId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Matchday_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lineup" (
    "id" TEXT NOT NULL,
    "saveId" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "matchdayId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "status" "LineupStatus" NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lineup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LineupSlot" (
    "id" TEXT NOT NULL,
    "lineupId" TEXT NOT NULL,
    "disciplineId" TEXT NOT NULL,
    "slotIndex" INTEGER NOT NULL,
    "playerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LineupSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transfer" (
    "id" TEXT NOT NULL,
    "saveId" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "fromTeamId" TEXT,
    "toTeamId" TEXT,
    "type" "TransferType" NOT NULL,
    "fee" INTEGER NOT NULL,
    "salary" INTEGER NOT NULL,
    "marketValue" INTEGER NOT NULL,
    "remainingContractLength" INTEGER,
    "happenedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Transfer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Team_shortCode_key" ON "Team"("shortCode");

-- CreateIndex
CREATE UNIQUE INDEX "Team_name_key" ON "Team"("name");

-- CreateIndex
CREATE UNIQUE INDEX "TeamSeasonState_saveId_seasonId_teamId_key" ON "TeamSeasonState"("saveId", "seasonId", "teamId");

-- CreateIndex
CREATE UNIQUE INDEX "PlayerAttribute_playerId_key" ON "PlayerAttribute"("playerId");

-- CreateIndex
CREATE UNIQUE INDEX "PlayerDisciplineScore_playerId_disciplineId_key" ON "PlayerDisciplineScore"("playerId", "disciplineId");

-- CreateIndex
CREATE UNIQUE INDEX "ActivePlayer_saveId_seasonId_playerId_key" ON "ActivePlayer"("saveId", "seasonId", "playerId");

-- CreateIndex
CREATE UNIQUE INDEX "Discipline_name_key" ON "Discipline"("name");

-- CreateIndex
CREATE UNIQUE INDEX "DisciplineWeight_disciplineId_attributeKey_seasonId_key" ON "DisciplineWeight"("disciplineId", "attributeKey", "seasonId");

-- CreateIndex
CREATE UNIQUE INDEX "SeasonDisciplineConfig_seasonId_disciplineId_key" ON "SeasonDisciplineConfig"("seasonId", "disciplineId");

-- CreateIndex
CREATE UNIQUE INDEX "Matchday_seasonId_index_key" ON "Matchday"("seasonId", "index");

-- CreateIndex
CREATE UNIQUE INDEX "Lineup_saveId_seasonId_matchdayId_teamId_key" ON "Lineup"("saveId", "seasonId", "matchdayId", "teamId");

-- CreateIndex
CREATE UNIQUE INDEX "LineupSlot_lineupId_disciplineId_slotIndex_key" ON "LineupSlot"("lineupId", "disciplineId", "slotIndex");

-- AddForeignKey
ALTER TABLE "Season" ADD CONSTRAINT "Season_saveId_fkey" FOREIGN KEY ("saveId") REFERENCES "Save"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_allianceId_fkey" FOREIGN KEY ("allianceId") REFERENCES "Alliance"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamSeasonState" ADD CONSTRAINT "TeamSeasonState_saveId_fkey" FOREIGN KEY ("saveId") REFERENCES "Save"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamSeasonState" ADD CONSTRAINT "TeamSeasonState_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamSeasonState" ADD CONSTRAINT "TeamSeasonState_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerAttribute" ADD CONSTRAINT "PlayerAttribute_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerDisciplineScore" ADD CONSTRAINT "PlayerDisciplineScore_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerDisciplineScore" ADD CONSTRAINT "PlayerDisciplineScore_disciplineId_fkey" FOREIGN KEY ("disciplineId") REFERENCES "Discipline"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivePlayer" ADD CONSTRAINT "ActivePlayer_saveId_fkey" FOREIGN KEY ("saveId") REFERENCES "Save"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivePlayer" ADD CONSTRAINT "ActivePlayer_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivePlayer" ADD CONSTRAINT "ActivePlayer_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivePlayer" ADD CONSTRAINT "ActivePlayer_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisciplineWeight" ADD CONSTRAINT "DisciplineWeight_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisciplineWeight" ADD CONSTRAINT "DisciplineWeight_disciplineId_fkey" FOREIGN KEY ("disciplineId") REFERENCES "Discipline"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeasonDisciplineConfig" ADD CONSTRAINT "SeasonDisciplineConfig_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeasonDisciplineConfig" ADD CONSTRAINT "SeasonDisciplineConfig_disciplineId_fkey" FOREIGN KEY ("disciplineId") REFERENCES "Discipline"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Matchday" ADD CONSTRAINT "Matchday_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Matchday" ADD CONSTRAINT "Matchday_homeTeamId_fkey" FOREIGN KEY ("homeTeamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Matchday" ADD CONSTRAINT "Matchday_awayTeamId_fkey" FOREIGN KEY ("awayTeamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lineup" ADD CONSTRAINT "Lineup_saveId_fkey" FOREIGN KEY ("saveId") REFERENCES "Save"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lineup" ADD CONSTRAINT "Lineup_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lineup" ADD CONSTRAINT "Lineup_matchdayId_fkey" FOREIGN KEY ("matchdayId") REFERENCES "Matchday"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lineup" ADD CONSTRAINT "Lineup_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LineupSlot" ADD CONSTRAINT "LineupSlot_lineupId_fkey" FOREIGN KEY ("lineupId") REFERENCES "Lineup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LineupSlot" ADD CONSTRAINT "LineupSlot_disciplineId_fkey" FOREIGN KEY ("disciplineId") REFERENCES "Discipline"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LineupSlot" ADD CONSTRAINT "LineupSlot_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_saveId_fkey" FOREIGN KEY ("saveId") REFERENCES "Save"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_fromTeamId_fkey" FOREIGN KEY ("fromTeamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_toTeamId_fkey" FOREIGN KEY ("toTeamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;
