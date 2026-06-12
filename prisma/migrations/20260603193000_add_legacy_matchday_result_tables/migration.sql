-- CreateEnum
CREATE TYPE "MatchdayResultStatus" AS ENUM ('preview_applied', 'superseded', 'voided');

-- CreateEnum
CREATE TYPE "LegacyReadinessStatus" AS ENUM ('ready', 'underfilled_roster', 'missing_lineup', 'invalid_lineup', 'missing_score_coverage', 'unknown');

-- CreateTable
CREATE TABLE "MatchdayResult" (
    "id" TEXT NOT NULL,
    "saveId" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "matchdayId" TEXT NOT NULL,
    "status" "MatchdayResultStatus" NOT NULL DEFAULT 'preview_applied',
    "sourceVersion" TEXT NOT NULL,
    "teamsTotal" INTEGER NOT NULL,
    "teamsReady" INTEGER NOT NULL,
    "teamsUnderfilled" INTEGER NOT NULL,
    "teamsMissingLineup" INTEGER NOT NULL,
    "teamsInvalidLineup" INTEGER NOT NULL DEFAULT 0,
    "teamsMissingScoreCoverage" INTEGER NOT NULL DEFAULT 0,
    "warningsCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MatchdayResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DisciplineResult" (
    "id" TEXT NOT NULL,
    "matchdayResultId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "disciplineId" TEXT NOT NULL,
    "disciplineSide" "DisciplineSide" NOT NULL,
    "rank" INTEGER NOT NULL,
    "baseScore" DOUBLE PRECISION NOT NULL,
    "totalScore" DOUBLE PRECISION NOT NULL,
    "readinessStatus" "LegacyReadinessStatus" NOT NULL,
    "warnings" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DisciplineResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerDisciplinePerformance" (
    "id" TEXT NOT NULL,
    "matchdayResultId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "activePlayerId" TEXT,
    "disciplineId" TEXT NOT NULL,
    "disciplineSide" "DisciplineSide" NOT NULL,
    "slotIndex" INTEGER NOT NULL,
    "baseValue" DOUBLE PRECISION NOT NULL,
    "finalPlayerScore" DOUBLE PRECISION NOT NULL,
    "scoreContribution" DOUBLE PRECISION NOT NULL,
    "rankInTeam" INTEGER NOT NULL,
    "rankInDiscipline" INTEGER NOT NULL,
    "isTop10" BOOLEAN NOT NULL,
    "isMvpCandidate" BOOLEAN NOT NULL,
    "storyWeight" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlayerDisciplinePerformance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DisciplineHighlight" (
    "id" TEXT NOT NULL,
    "matchdayResultId" TEXT NOT NULL,
    "disciplineId" TEXT,
    "highlightType" TEXT NOT NULL,
    "teamId" TEXT,
    "playerId" TEXT,
    "relatedTeamId" TEXT,
    "importanceScore" DOUBLE PRECISION NOT NULL,
    "shortSummary" TEXT,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DisciplineHighlight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResultAuditLog" (
    "id" TEXT NOT NULL,
    "saveId" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "matchdayId" TEXT NOT NULL,
    "matchdayResultId" TEXT,
    "action" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResultAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MatchdayResult_matchdayId_key" ON "MatchdayResult"("matchdayId");

-- CreateIndex
CREATE UNIQUE INDEX "MatchdayResult_saveId_seasonId_matchdayId_key" ON "MatchdayResult"("saveId", "seasonId", "matchdayId");

-- CreateIndex
CREATE UNIQUE INDEX "DisciplineResult_matchdayResultId_teamId_disciplineId_discipli_key" ON "DisciplineResult"("matchdayResultId", "teamId", "disciplineId", "disciplineSide");

-- CreateIndex
CREATE UNIQUE INDEX "PlayerDisciplinePerformance_matchdayResultId_teamId_disciplin_key" ON "PlayerDisciplinePerformance"("matchdayResultId", "teamId", "disciplineId", "disciplineSide", "slotIndex");

-- CreateIndex
CREATE INDEX "DisciplineHighlight_matchdayResultId_highlightType_idx" ON "DisciplineHighlight"("matchdayResultId", "highlightType");

-- CreateIndex
CREATE INDEX "ResultAuditLog_saveId_seasonId_matchdayId_idx" ON "ResultAuditLog"("saveId", "seasonId", "matchdayId");

-- AddForeignKey
ALTER TABLE "MatchdayResult" ADD CONSTRAINT "MatchdayResult_saveId_fkey" FOREIGN KEY ("saveId") REFERENCES "Save"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchdayResult" ADD CONSTRAINT "MatchdayResult_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchdayResult" ADD CONSTRAINT "MatchdayResult_matchdayId_fkey" FOREIGN KEY ("matchdayId") REFERENCES "Matchday"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisciplineResult" ADD CONSTRAINT "DisciplineResult_matchdayResultId_fkey" FOREIGN KEY ("matchdayResultId") REFERENCES "MatchdayResult"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisciplineResult" ADD CONSTRAINT "DisciplineResult_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisciplineResult" ADD CONSTRAINT "DisciplineResult_disciplineId_fkey" FOREIGN KEY ("disciplineId") REFERENCES "Discipline"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerDisciplinePerformance" ADD CONSTRAINT "PlayerDisciplinePerformance_matchdayResultId_fkey" FOREIGN KEY ("matchdayResultId") REFERENCES "MatchdayResult"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerDisciplinePerformance" ADD CONSTRAINT "PlayerDisciplinePerformance_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerDisciplinePerformance" ADD CONSTRAINT "PlayerDisciplinePerformance_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerDisciplinePerformance" ADD CONSTRAINT "PlayerDisciplinePerformance_activePlayerId_fkey" FOREIGN KEY ("activePlayerId") REFERENCES "ActivePlayer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerDisciplinePerformance" ADD CONSTRAINT "PlayerDisciplinePerformance_disciplineId_fkey" FOREIGN KEY ("disciplineId") REFERENCES "Discipline"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisciplineHighlight" ADD CONSTRAINT "DisciplineHighlight_matchdayResultId_fkey" FOREIGN KEY ("matchdayResultId") REFERENCES "MatchdayResult"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisciplineHighlight" ADD CONSTRAINT "DisciplineHighlight_disciplineId_fkey" FOREIGN KEY ("disciplineId") REFERENCES "Discipline"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisciplineHighlight" ADD CONSTRAINT "DisciplineHighlight_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisciplineHighlight" ADD CONSTRAINT "DisciplineHighlight_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisciplineHighlight" ADD CONSTRAINT "DisciplineHighlight_relatedTeamId_fkey" FOREIGN KEY ("relatedTeamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResultAuditLog" ADD CONSTRAINT "ResultAuditLog_saveId_fkey" FOREIGN KEY ("saveId") REFERENCES "Save"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResultAuditLog" ADD CONSTRAINT "ResultAuditLog_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResultAuditLog" ADD CONSTRAINT "ResultAuditLog_matchdayResultId_fkey" FOREIGN KEY ("matchdayResultId") REFERENCES "MatchdayResult"("id") ON DELETE SET NULL ON UPDATE CASCADE;
