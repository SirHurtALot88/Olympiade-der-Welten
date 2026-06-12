import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  inspectRankToPointsSheet,
  inspectPrizeMoneySheet,
  inspectSeasonStandingsSheet,
} from "@/lib/standings/season-standings-sheet";
import { analyzePrizeMoneySheet } from "@/lib/season/prize-money-sheet";

describe("season standings sheet audit", () => {
  it("marks the configured standings gid as blocked when it resolves to the Attribute tab instead of standings", async () => {
    const fakeFetch: typeof fetch = (async () =>
      new Response(
        [
          "Name,Power,Health,Stamina,Torment Rating",
          "Tyrael,64,68,71,C",
          "Robin Hood,52,44,61,C",
        ].join("\n"),
        { status: 200 },
      )) as typeof fetch;

    const result = await inspectSeasonStandingsSheet(
      {
        localCsvPath: "/definitely/missing/season-standings.csv",
        localJsonPath: "/definitely/missing/season-standings.json",
      },
      fakeFetch,
    );

    expect(result.status).toBe("blocked");
    expect(result.detectedTabKind).toBe("attribute_sheet");
    expect(result.reason).toContain("Attribute tab");
  });

  it("maps a valid season standings export without guessing old offline fields", async () => {
    const fakeFetch: typeof fetch = (async () =>
      new Response(
        [
          "Mannschaft,Kürzel,Cash,Punkte,Platz,Cash FC,Startplatz,Rank Diff,Sponsor Basis,Sponsor Rank,Sponsor Total,GuV,Cash Total,Form,Transfers,Matchday,Season",
          "Wicked Wizards,W-W,810000,18,1,-5.1,2,0,15.4,0,88,17,82.9,16,,1,season-1",
          "Project Suicide,P-S,610000,15,2,-33.3,1,0,15,0,91.4,20.3,58.1,9,,1,season-1",
        ].join("\n"),
        { status: 200 },
      )) as typeof fetch;

    const result = await inspectSeasonStandingsSheet(
      {
        url: "https://example.test/season.csv",
        localCsvPath: "/definitely/missing/season-standings.csv",
        localJsonPath: "/definitely/missing/season-standings.json",
      },
      fakeFetch,
    );

    expect(result.status).toBe("ok");
    expect(result.detectedTabKind).toBe("season_standings");
    expect(result.mappedRows[0]).toMatchObject({
      teamName: "Wicked Wizards",
      teamCode: "W-W",
      rank: 1,
      points: 18,
      currentRank: 1,
      currentPoints: 18,
      totalScore: null,
      cash: 810000,
      cashFc: -5.1,
      startplatz: 2,
      rankDiff: 0,
      sponsorBasis: 15.4,
      sponsorRank: 0,
      sponsorTotal: 88,
      guv: 17,
      cashTotal: 82.9,
      form: 16,
      transfers: null,
      matchday: "1",
      season: "season-1",
    });
  });

  it("detects a rank-to-points export and maps rank plus points", async () => {
    const fakeFetch: typeof fetch = (async () =>
      new Response(
        [
          "Spieleranzahl,1.,2.,3.",
          "2,6.6,6.2,5.8",
          "3,9.9,9.3,8.7",
        ].join("\n"),
        { status: 200 },
      )) as typeof fetch;

    const result = await inspectRankToPointsSheet(
      {
        url: "https://example.test/rank-points.csv",
        localCsvPath: "/definitely/missing/rank-to-points.csv",
        localJsonPath: "/definitely/missing/rank-to-points.json",
      },
      fakeFetch,
    );

    expect(result.status).toBe("ok");
    expect(result.detectedTabKind).toBe("rank_to_points");
    expect(result.mappedRows[0]).toMatchObject({
      playerCount: 2,
      pointsByRank: {
        "1.": 6.6,
        "2.": 6.2,
        "3.": 5.8,
      },
    });
  });

  it("ignores malformed trailing rank-to-points rows without player count", async () => {
    const fakeFetch: typeof fetch = (async () =>
      new Response(
        [
          "Spieleranzahl,1.,2.,3.",
          "2,6.6,6.2,5.8",
          ",,,",
          ",5.5,,",
        ].join("\n"),
        { status: 200 },
      )) as typeof fetch;

    const result = await inspectRankToPointsSheet(
      {
        url: "https://example.test/rank-points.csv",
        localCsvPath: "/definitely/missing/rank-to-points.csv",
        localJsonPath: "/definitely/missing/rank-to-points.json",
      },
      fakeFetch,
    );

    expect(result.status).toBe("ok");
    expect(result.rowsCount).toBe(1);
    expect(result.mappedRows).toHaveLength(1);
    expect(result.mappedRows[0]).toMatchObject({ playerCount: 2 });
  });

  it("reads a valid prize money table and detects core columns", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "oly-prize-"));
    const csvPath = path.join(tempDir, "prize.csv");
    await fs.writeFile(
      csvPath,
      [
        "Platz,Preisgeld,Bonus,Malus,Liga,Saison",
        "1,120,10,0,A,season-1",
        "2,90,0,5,A,season-1",
      ].join("\n"),
      "utf8",
    );

    const result = await analyzePrizeMoneySheet({
      rawCsvPath: csvPath,
      normalizedJsonPath: path.join(tempDir, "missing.normalized.json"),
    });

    expect(result.status).toBe("blocked");
  });

  it("flags duplicate ranks and missing prize values in prize money exports", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "oly-prize-"));
    const csvPath = path.join(tempDir, "prize.csv");
    await fs.writeFile(
      csvPath,
      [
        "Platz,Preisgeld",
        "1,120",
        "1,",
      ].join("\n"),
      "utf8",
    );

    const result = await analyzePrizeMoneySheet({
      rawCsvPath: csvPath,
      normalizedJsonPath: path.join(tempDir, "missing.normalized.json"),
    });

    expect(result.status).toBe("blocked");
    expect(result.rejectedBlocks?.[0]?.reason).toBeTruthy();
  });

  it("uses an existing normalized prize money file when available", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "oly-prize-"));
    const normalizedPath = path.join(tempDir, "prize.normalized.json");
    await fs.writeFile(
      normalizedPath,
      JSON.stringify({
        rows: [
          {
            rank: 1,
            placementLabel: null,
            prizeMoney: 120,
            percent: null,
            basis: null,
            correction: null,
            bonus: 10,
            malus: 0,
            season: "season-1",
            sourceRow: 3,
            warnings: [],
          },
          {
            rank: 2,
            placementLabel: null,
            prizeMoney: 90,
            percent: null,
            basis: null,
            correction: null,
            bonus: 0,
            malus: 5,
            season: "season-1",
            sourceRow: 4,
            warnings: [],
          },
        ],
      }),
      "utf8",
    );

    const result = await analyzePrizeMoneySheet({
      rawCsvPath: path.join(tempDir, "missing.csv"),
      normalizedJsonPath: normalizedPath,
    });

    expect(result.status).toBe("ok");
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]).toMatchObject({
      rank: 1,
      prizeMoney: 120,
      bonus: 10,
      malus: 0,
      season: "season-1",
    });
  });

  it("analyzes a mixed prize money export and selects the unambiguous payout block", async () => {
    const mixedCsv = [
      ",,,,,,,,,,,,,,,,,,,,,,,,,,,,,",
      "Rank,Platzierung,%,,,Rank,Basis,%,Season,Gesamt Preisgeld,Korrektur,+/-,,,Gehalt,1571.23,Season,Basis,Platzierung",
      "31,26.33,20.50%,,,1,15,7.67%,76.3,91.4,7.67%,-6",
      "30,25.69,20.00%,,,2,15.4,7.29%,72.5,88,7.29%,-5.6",
      "29,25.05,19.50%,,,3,15.8,6.90%,68.7,84.5,6.90%,-5.2",
      "28,24.41,19.00%,,,4,16.2,6.52%,64.9,81.1,6.52%,-4.8",
      "27,23.76,18.50%,,,5,16.6,6.13%,61.1,77.7,6.13%,-4.4",
      "26,23.12,18.00%,,,6,17,5.75%,57.3,74.3,5.75%,-4",
      "25,22.48,17.50%,,,7,17.4,5.37%,53.4,70.9,5.37%,-3.6",
      "24,21.84,17.00%,,,8,17.8,4.98%,49.6,67.5,4.98%,-3.2",
      "23,21.19,16.50%,,,9,18.2,4.60%,45.8,64,4.60%,-2.8",
      "22,20.55,16.00%,,,10,18.6,4.22%,42,60.6,4.22%,-2.4",
      "21,19.91,15.50%,,,11,19,3.99%,39.7,58.7,3.99%,-2",
      "20,19.27,15.00%,,,12,19.4,3.76%,37.4,56.8,3.76%,-1.6",
      "19,18.62,14.50%,,,13,19.8,3.53%,35.1,54.9,3.53%,-1.2",
      "18,17.98,14.00%,,,14,20.2,3.30%,32.8,53.1,3.30%,-0.8",
      "17,17.34,13.50%,,,15,20.6,3.07%,30.5,51.2,3.07%,-0.4",
      "16,16.7,13.00%,,,16,21,2.84%,28.2,49.3,2.84%,0",
      "15,16.06,12.50%,,,17,21,2.61%,26,47,2.61%,0",
      "14,15.41,12.00%,,,18,21.3,2.38%,23.7,45,2.38%,0.3",
      "13,14.77,11.50%,,,19,21.6,2.15%,21.4,43,2.15%,0.6",
      "12,14.13,11.00%,,,20,21.9,1.92%,19.1,41,1.92%,0.9",
      "11,13.49,10.50%,,,21,22.2,1.76%,17.6,39.8,1.76%,1.2",
      "10,12.84,10.00%,,,22,22.5,1.61%,16,38.6,1.61%,1.5",
      "9,11.56,9.00%,,,23,22.8,1.46%,14.5,37.3,1.46%,1.8",
      "8,10.28,8.00%,,,24,23.1,1.30%,13,36.1,1.30%,2.1",
      "7,8.99,7.00%,,,25,23.4,1.15%,11.5,34.9,1.15%,2.4",
      "6,7.71,6.00%,,,26,23.7,1.00%,9.9,33.7,1.00%,2.7",
      "5,6.42,5.00%,,,27,24,0.84%,8.4,32.4,0.84%,3",
      "4,5.14,4.00%,,,28,24.3,0.69%,6.9,31.2,0.69%,3.3",
      "3,3.85,3.00%,,,29,24.6,0.54%,5.3,30,0.54%,3.6",
      "2,2.57,2.00%,,,30,24.9,0.38%,3.8,28.7,0.38%,3.9",
      "1,1.28,1.00%,,,31,25.2,0.23%,2.3,27.5,0.23%,4.2",
      "0,0,0.00%,,,32,25.5,0.08%,0.8,26.3,0.08%,4.5",
      "-1,-0.96,-0.75%,,,Gesamt,660.89,100.00%,995.6,1.656.40,100.00%,-12",
    ].join("\n");

    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "oly-prize-"));
    const csvPath = path.join(tempDir, "prize.csv");
    await fs.writeFile(csvPath, mixedCsv, "utf8");

    const analysis = await analyzePrizeMoneySheet({
      rawCsvPath: csvPath,
      normalizedJsonPath: path.join(tempDir, "missing.normalized.json"),
    });

    expect(analysis.status).toBe("ok");
    expect(analysis.selectedBlock?.startCol).toBe(6);
    expect(analysis.rows).toHaveLength(32);
    expect(analysis.detectedBlocks.length).toBeGreaterThan(1);
    expect(analysis.rows[0]).toMatchObject({
      rank: 1,
      prizeMoney: 91.4,
      basis: 15,
      correction: 7.67,
      sourceRow: 3,
    });
  });
});
