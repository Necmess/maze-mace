import type { BuildId, RunRecords, RunStats, ScoreboardEntry } from '../types/game';

export const DEFAULT_RECORDS: RunRecords = {
  bestScore: 0,
  longestSurvival: 0,
  highestCombo: 0,
  totalRuns: 0,
  totalKills: 0,
  builds: {
    breaker: { bestScore: 0, bestKills: 0, longestSurvival: 0, bestCombo: 0 },
    striker: { bestScore: 0, bestKills: 0, longestSurvival: 0, bestCombo: 0 },
    cartographer: { bestScore: 0, bestKills: 0, longestSurvival: 0, bestCombo: 0 },
    guardian: { bestScore: 0, bestKills: 0, longestSurvival: 0, bestCombo: 0 }
  }
};

export function mergeRecords(saved: Partial<RunRecords> | null | undefined): RunRecords {
  if (!saved) return DEFAULT_RECORDS;

  return {
    ...DEFAULT_RECORDS,
    ...saved,
    builds: {
      ...DEFAULT_RECORDS.builds,
      ...(saved.builds || {})
    }
  };
}

export function calculateUpdatedRecords(
  currentRecords: RunRecords,
  build: BuildId,
  finalStats: RunStats
): { records: RunRecords; isNewRecord: boolean } {
  const buildRecord = currentRecords.builds[build] || DEFAULT_RECORDS.builds[build];

  const isNewRecord =
    finalStats.score > currentRecords.bestScore ||
    finalStats.survivalTime > currentRecords.longestSurvival ||
    finalStats.maxCombo > currentRecords.highestCombo ||
    finalStats.score > buildRecord.bestScore ||
    finalStats.kills > buildRecord.bestKills ||
    finalStats.survivalTime > buildRecord.longestSurvival ||
    finalStats.maxCombo > buildRecord.bestCombo;

  return {
    isNewRecord,
    records: {
      bestScore: Math.max(currentRecords.bestScore, finalStats.score),
      longestSurvival: Math.max(currentRecords.longestSurvival, finalStats.survivalTime),
      highestCombo: Math.max(currentRecords.highestCombo, finalStats.maxCombo),
      totalRuns: currentRecords.totalRuns + 1,
      totalKills: currentRecords.totalKills + finalStats.kills,
      builds: {
        ...currentRecords.builds,
        [build]: {
          bestScore: Math.max(buildRecord.bestScore, finalStats.score),
          bestKills: Math.max(buildRecord.bestKills, finalStats.kills),
          longestSurvival: Math.max(buildRecord.longestSurvival, finalStats.survivalTime),
          bestCombo: Math.max(buildRecord.bestCombo, finalStats.maxCombo)
        }
      }
    }
  };
}

export function loadScoreboard(): ScoreboardEntry[] {
  try {
    const data = localStorage.getItem('maze_mace_scoreboard');
    if (data) {
      return JSON.parse(data);
    }
  } catch (e) {
    console.error('Error loading scoreboard', e);
  }
  return [];
}

export function saveScoreboard(entries: ScoreboardEntry[]): void {
  try {
    localStorage.setItem('maze_mace_scoreboard', JSON.stringify(entries));
  } catch (e) {
    console.error('Error saving scoreboard', e);
  }
}

export function addScoreboardEntry(
  newEntryData: Omit<ScoreboardEntry, 'id' | 'date'>,
  existing: ScoreboardEntry[]
): ScoreboardEntry[] {
  const todayStr = new Date().toISOString().split('T')[0];
  const newEntry: ScoreboardEntry = {
    ...newEntryData,
    id: `${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    date: todayStr
  };

  // Group existing entries by difficulty
  const preservedEntries = existing.filter(e => e.difficulty !== newEntryData.difficulty);
  const targetDifficultyEntries = existing.filter(e => e.difficulty === newEntryData.difficulty);

  // Add the new entry, sort desc by score, limit to top 10
  const updatedDifficultyEntries = [...targetDifficultyEntries, newEntry]
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  // Return the combined array
  return [...preservedEntries, ...updatedDifficultyEntries];
}

