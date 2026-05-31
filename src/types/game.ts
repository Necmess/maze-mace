export type BuildId = 'breaker' | 'striker' | 'cartographer' | 'guardian';

export type UpgradeType = 'power' | 'energy' | 'map' | 'shield' | 'clean';

export interface UpgradeOption {
  id: string;
  name: string;
  desc: string;
  synergy: string;
  type: UpgradeType;
}

export type RoomType = 'START' | 'COMBAT' | 'REWARD' | 'HAZARD' | 'RECOVERY' | 'BOSS';

export interface RoomNode {
  x: number;
  y: number;
  type: RoomType;
  explored: boolean;
  cleared: boolean;
}

export interface RunStats {
  score: number;
  kills: number;
  roomsExpanded: number;
  maxCombo: number;
  contamination: number;
  survivalTime: number;
  victory?: boolean;
}

export interface RunResult {
  runId: string;
  build: BuildId;
  stats: RunStats;
  upgrades: UpgradeOption[];
  rank: 'SSS' | 'SS' | 'S' | 'A' | 'B' | 'C' | 'D';
  isNewRecord: boolean;
  startedAt: string;
  endedAt: string;
  clientVersion: string;
}

export interface BuildRecord {
  bestScore: number;
  bestKills: number;
  longestSurvival: number;
  bestCombo: number;
}

export interface RunRecords {
  bestScore: number;
  longestSurvival: number;
  highestCombo: number;
  totalRuns: number;
  totalKills: number;
  builds: Record<BuildId, BuildRecord>;
}

export type Difficulty = 'normal' | 'hard' | 'extreme';

export interface ScoreboardEntry {
  id: string;
  score: number;
  rank: 'SSS' | 'SS' | 'S' | 'A' | 'B' | 'C' | 'D';
  date: string; // YYYY-MM-DD
  build: BuildId;
  difficulty: Difficulty;
  survivalTime: number;
  kills: number;
  maxCombo: number;
  isDaily?: boolean;
  dailyRuleId?: string;
}


