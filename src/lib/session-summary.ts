import { ArenaSession, LeaderboardEntry, ModelStats, SessionSummary } from '@/types';

const RANK_EPSILON = 1e-9;

function isSameRank(left: number, right: number): boolean {
  return Math.abs(left - right) < RANK_EPSILON;
}

export function calculateModelStats(session: ArenaSession | null): ModelStats[] {
  if (!session || session.rounds.length === 0) {
    return [];
  }

  const statsMap = new Map<string, ModelStats>();

  session.selectedModels.forEach((model) => {
    statsMap.set(model.id, {
      modelId: model.id,
      modelName: model.name,
      totalRounds: 0,
      averageRank: 0,
      firstPlaceCount: 0,
      secondPlaceCount: 0,
      thirdPlaceCount: 0,
    });
  });

  session.rounds.forEach((round) => {
    round.rankings.forEach((ranking) => {
      const stat = statsMap.get(ranking.modelId);

      if (!stat) {
        return;
      }

      stat.totalRounds += 1;
      stat.averageRank += ranking.rank;

      if (ranking.rank === 1) stat.firstPlaceCount += 1;
      if (ranking.rank === 2) stat.secondPlaceCount += 1;
      if (ranking.rank === 3) stat.thirdPlaceCount += 1;
    });
  });

  return Array.from(statsMap.values()).map((stat) => ({
    ...stat,
    averageRank: stat.totalRounds > 0 ? stat.averageRank / stat.totalRounds : 0,
  }));
}

export function buildLeaderboard(stats: ModelStats[]): LeaderboardEntry[] {
  const sortedStats = [...stats].sort((left, right) => {
    if (!isSameRank(left.averageRank, right.averageRank)) {
      return left.averageRank - right.averageRank;
    }

    if (left.firstPlaceCount !== right.firstPlaceCount) {
      return right.firstPlaceCount - left.firstPlaceCount;
    }

    return left.modelName.localeCompare(right.modelName, 'zh-Hant');
  });

  return sortedStats.map((stat, index) => {
    const previous = sortedStats[index - 1];
    const position = previous && isSameRank(previous.averageRank, stat.averageRank)
      ? (index > 0 ? sortedStats
          .slice(0, index)
          .filter((candidate) => !isSameRank(candidate.averageRank, stat.averageRank)).length + 1 : 1)
      : index + 1;

    const sharedPosition = sortedStats.some(
      (candidate) => candidate.modelId !== stat.modelId && isSameRank(candidate.averageRank, stat.averageRank)
    );

    return {
      ...stat,
      position,
      sharedPosition,
    };
  });
}

export function formatLeaderboardPosition(entry: LeaderboardEntry): string {
  return entry.sharedPosition ? `並列第 ${entry.position} 名` : `第 ${entry.position} 名`;
}

export function createSessionSummary(session: ArenaSession): SessionSummary {
  const leaderboard = buildLeaderboard(calculateModelStats(session));
  const leaders = leaderboard.filter((entry) => entry.position === 1);

  return {
    sessionId: session.id,
    mode: session.mode,
    startedAt: new Date(session.startTime).toISOString(),
    endedAt: session.endTime ? new Date(session.endTime).toISOString() : null,
    durationSeconds: session.endTime ? Math.round((session.endTime - session.startTime) / 1000) : null,
    totalRounds: session.rounds.length,
    selectedModels: session.selectedModels,
    leaders: leaders.map((entry) => ({
      modelId: entry.modelId,
      modelName: entry.modelName,
      averageRank: Number(entry.averageRank.toFixed(3)),
      firstPlaceCount: entry.firstPlaceCount,
      position: entry.position,
      sharedPosition: entry.sharedPosition,
    })),
    leaderboard: leaderboard.map((entry) => ({
      ...entry,
      averageRank: Number(entry.averageRank.toFixed(3)),
    })),
    feedback: session.feedback ?? null,
    rounds: session.rounds.map((round, index) => ({
      roundNumber: index + 1,
      prompt: round.prompt,
      revealed: round.revealed,
      responses: round.responses.map((response) => {
        const matchingRanking = round.rankings.find((ranking) => ranking.modelId === response.modelId);

        return {
          blindName: response.blindName,
          modelId: response.modelId,
          modelName:
            session.selectedModels.find((model) => model.id === response.modelId)?.name ?? response.modelId,
          response: response.response,
          rank: matchingRanking?.rank ?? null,
        };
      }),
      rankings: round.rankings.map((ranking) => ({
        rank: ranking.rank,
        blindName: ranking.blindName,
        modelId: ranking.modelId,
        modelName:
          session.selectedModels.find((model) => model.id === ranking.modelId)?.name ?? ranking.modelId,
      })),
      winners: round.rankings
        .filter((ranking) => ranking.rank === 1)
        .map(
          (ranking) =>
            session.selectedModels.find((model) => model.id === ranking.modelId)?.name ?? ranking.modelId
        ),
    })),
  };
}