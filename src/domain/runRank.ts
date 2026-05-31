export interface RunRank {
  rank: 'SSS' | 'SS' | 'S' | 'A' | 'B' | 'C' | 'D';
  colorClass: string;
}

export function getRunRank(score: number, victory?: boolean, contamination?: number): RunRank {
  if (victory) {
    if (score >= 12000 || (contamination !== undefined && contamination <= 15 && score >= 6000)) {
      return {
        rank: 'SSS',
        colorClass: 'text-amber-300 drop-shadow-[0_0_25px_rgba(251,191,36,0.95)] animate-gold-glow-pulse font-black'
      };
    }
    if (score >= 9000) {
      return {
        rank: 'SS',
        colorClass: 'text-amber-400 drop-shadow-[0_0_20px_rgba(245,158,11,0.9)] animate-gold-glow-pulse font-extrabold'
      };
    }
    if (score >= 6000) {
      return {
        rank: 'S',
        colorClass: 'text-maze-gold drop-shadow-[0_0_20px_rgba(201,168,76,0.8)] font-bold'
      };
    }
    return {
      rank: 'A',
      colorClass: 'text-maze-accent drop-shadow-[0_0_20px_rgba(200,67,47,0.8)] font-bold'
    };
  }

  if (score >= 6000) {
    return {
      rank: 'S',
      colorClass: 'text-maze-gold drop-shadow-[0_0_20px_rgba(201,168,76,0.8)]'
    };
  }

  if (score >= 4000) {
    return {
      rank: 'A',
      colorClass: 'text-maze-accent drop-shadow-[0_0_20px_rgba(200,67,47,0.8)]'
    };
  }

  if (score >= 2500) {
    return {
      rank: 'B',
      colorClass: 'text-orange-500 drop-shadow-[0_0_15px_rgba(249,115,22,0.6)]'
    };
  }

  if (score >= 1000) {
    return {
      rank: 'C',
      colorClass: 'text-maze-silver drop-shadow-[0_0_15px_rgba(138,155,168,0.5)]'
    };
  }

  return {
    rank: 'D',
    colorClass: 'text-slate-500 drop-shadow-[0_0_15px_rgba(93,109,126,0.5)]'
  };
}
