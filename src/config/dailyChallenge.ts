import type { RoomType } from '../types/game';

// A simple and deterministic 32-bit generator
export function mulberry32(a: number) {
  return function() {
    let t = a += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface DailyRule {
  id: string;
  name: string;
  desc: string;
  koreanName: string;
  koreanDesc: string;
}

export const DAILY_RULES: DailyRule[] = [
  {
    id: 'stamina_double',
    name: 'Exhaustion',
    desc: 'Double stamina consumption for all actions.',
    koreanName: '끝없는 갈증',
    koreanDesc: '모든 행동의 스태미너 소모량이 2배로 증가합니다.'
  },
  {
    id: 'blindness',
    name: 'Claustrophobia',
    desc: 'Spotlight vision radius is halved.',
    koreanName: '심해의 어둠',
    koreanDesc: '시야 반경이 절반으로 줄어듭니다.'
  },
  {
    id: 'double_contamination',
    name: 'Corrosion',
    desc: 'Contamination accumulation speed is doubled.',
    koreanName: '가속되는 오염',
    koreanDesc: '오염도 상승 속도가 2배로 증가합니다.'
  },
  {
    id: 'monster_frenzy',
    name: 'Frenzy',
    desc: 'All monsters move 30% faster.',
    koreanName: '피의 광란',
    koreanDesc: '모든 몬스터의 이동 속도가 30% 빨라집니다.'
  },
  {
    id: 'glass_cannon',
    name: 'Glass Cannon',
    desc: 'Player deals 2x damage but takes 2x damage.',
    koreanName: '유리 대포',
    koreanDesc: '가하는 대미지가 2배가 되지만, 입는 대미지도 2배가 됩니다.'
  },
  {
    id: 'no_healing',
    name: 'Desolation',
    desc: 'Recovery rooms do not restore HP or reduce contamination.',
    koreanName: '버려진 성소',
    koreanDesc: '회복의 성소에서 체력 회복 및 오염도 정화가 불가능해집니다.'
  }
];

export interface DailyChallengeInfo {
  dateString: string;
  seed: number;
  rule: DailyRule;
}

export function getDailySeedAndRule(date: Date): DailyChallengeInfo {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const dateString = `${yyyy}-${mm}-${dd}`;
  const seed = parseInt(`${yyyy}${mm}${dd}`, 10);
  
  const rand = mulberry32(seed);
  const ruleIndex = Math.floor(rand() * DAILY_RULES.length);
  const rule = DAILY_RULES[ruleIndex];

  return {
    dateString,
    seed,
    rule
  };
}

export function getDailyRoomType(dailySeed: number, x: number, y: number): Exclude<RoomType, 'START' | 'BOSS'> {
  // Deterministic coordinate-seeded hash combining x, y and daily seed
  // Multiplying by prime coordinates and adding dailySeed scaling
  const seed = Math.abs(Math.sin(x * 12.9898 + y * 78.233 + dailySeed * 0.013) * 43758.5453);
  const val = seed - Math.floor(seed);
  
  const types: Exclude<RoomType, 'START' | 'BOSS'>[] = ['COMBAT', 'COMBAT', 'REWARD', 'HAZARD', 'RECOVERY'];
  return types[Math.floor(val * types.length)];
}

export function getSeededRandomForRoom(dailySeed: number, x: number, y: number, stage: number) {
  // Generate a coordinate, stage and daily seed dependent stream
  const seedVal = Math.abs((x * 73856093) ^ (y * 19349663) ^ (stage * 83492791) ^ dailySeed) % 2147483647;
  return mulberry32(seedVal);
}
