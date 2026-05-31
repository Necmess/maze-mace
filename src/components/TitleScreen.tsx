import { useEffect, useState } from 'react';
import heroImage from '../assets/hero.png';
import type { BuildId, RunRecords, Difficulty, ScoreboardEntry } from '../types/game';
import { getDailySeedAndRule } from '../config/dailyChallenge';
import { ACHIEVEMENTS } from '../config/achievements';

interface WebAudioWindow extends Window {
  webkitAudioContext?: typeof AudioContext;
}

interface TitleScreenProps {
  selectedBuild: BuildId;
  setSelectedBuild: (build: BuildId) => void;
  onStartGame: (challengeMode?: boolean) => void;
  records: RunRecords;
  unlockedAchievements?: string[];
  difficulty: Difficulty;
  setDifficulty: (diff: Difficulty) => void;
  scoreboard: ScoreboardEntry[];
  setScoreboard: React.Dispatch<React.SetStateAction<ScoreboardEntry[]>>;
}

export default function TitleScreen({
  selectedBuild,
  setSelectedBuild,
  onStartGame,
  records,
  unlockedAchievements = [],
  difficulty,
  setDifficulty,
  scoreboard,
  setScoreboard
}: TitleScreenProps) {
  const [isSwallowing, setIsSwallowing] = useState(false);
  const [tiltStyle, setTiltStyle] = useState<{ [key: string]: string }>({});
  const [activeTab, setActiveTab] = useState<'records' | 'achievements' | 'scoreboard'>('records');
  const [lastBuild, setLastBuild] = useState(selectedBuild);
  const [swapActive, setSwapActive] = useState<string | null>(null);

  const [showAllModal, setShowAllModal] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [modalFilter, setModalFilter] = useState<'all' | Difficulty>('all');

  const playSystemSound = (type: 'click' | 'reset') => {
    try {
      const AudioContextClass = window.AudioContext || (window as WebAudioWindow).webkitAudioContext;
      if (AudioContextClass) {
        const ctx = new AudioContextClass();
        const now = ctx.currentTime;
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0, now);
        
        if (type === 'click') {
          gain.gain.linearRampToValueAtTime(0.08, now + 0.01);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
          const osc = ctx.createOscillator();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(600, now);
          osc.frequency.exponentialRampToValueAtTime(300, now + 0.12);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now);
          osc.stop(now + 0.15);
        } else if (type === 'reset') {
          gain.gain.linearRampToValueAtTime(0.18, now + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
          
          const osc1 = ctx.createOscillator();
          osc1.type = 'sawtooth';
          osc1.frequency.setValueAtTime(150, now);
          osc1.frequency.linearRampToValueAtTime(40, now + 0.65);
          
          const osc2 = ctx.createOscillator();
          osc2.type = 'triangle';
          osc2.frequency.setValueAtTime(100, now);
          osc2.frequency.linearRampToValueAtTime(30, now + 0.65);
          
          osc1.connect(gain);
          osc2.connect(gain);
          gain.connect(ctx.destination);
          osc1.start(now);
          osc1.stop(now + 0.7);
          osc2.start(now);
          osc2.stop(now + 0.7);
        }
      }
    } catch {
      return;
    }
  };

  useEffect(() => {
    if (selectedBuild !== lastBuild) {
      const syncTimer = setTimeout(() => {
        setSwapActive(selectedBuild);
        setLastBuild(selectedBuild);
      }, 0);

      try {
        const AudioContextClass = window.AudioContext || (window as WebAudioWindow).webkitAudioContext;
        if (AudioContextClass) {
          const ctx = new AudioContextClass();
          const now = ctx.currentTime;
          const gain = ctx.createGain();
          gain.gain.setValueAtTime(0, now);
          gain.gain.linearRampToValueAtTime(0.12, now + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);

          const osc = ctx.createOscillator();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(160, now);
          osc.frequency.exponentialRampToValueAtTime(70, now + 0.3); // low metallic thud

          const noise = ctx.createOscillator();
          noise.type = 'sawtooth';
          noise.frequency.setValueAtTime(90, now);
          noise.frequency.linearRampToValueAtTime(30, now + 0.15);
          
          const noiseGain = ctx.createGain();
          noiseGain.gain.setValueAtTime(0.06, now);
          noiseGain.gain.exponentialRampToValueAtTime(0.005, now + 0.15);

          osc.connect(gain);
          noise.connect(noiseGain);
          noiseGain.connect(gain);
          
          gain.connect(ctx.destination);
          
          osc.start(now);
          osc.stop(now + 0.35);
          noise.start(now);
          noise.stop(now + 0.2);
        }
      } catch {
        // Audio feedback is optional.
      }

      const timer = setTimeout(() => {
        setSwapActive(null);
      }, 400);
      return () => {
        clearTimeout(syncTimer);
        clearTimeout(timer);
      };
    }
  }, [selectedBuild, lastBuild]);

  // Generate random particles floating up
  const [particles] = useState<{ id: number; left: number; size: number; delay: number; duration: number }[]>(
    () => Array.from({ length: 35 }).map((_, i) => ({
      id: i,
      left: Math.random() * 100,
      size: Math.random() * 5 + 3,
      delay: Math.random() * 8,
      duration: Math.random() * 10 + 6
    }))
  );

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>, cardId: string) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const xc = rect.width / 2;
    const yc = rect.height / 2;
    const rotateY = ((x - xc) / xc) * 14;
    const rotateX = -((y - yc) / yc) * 14;
    
    setTiltStyle(prev => ({
      ...prev,
      [cardId]: `perspective(800px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.05, 1.05, 1.05)`
    }));
  };

  const handleMouseLeave = (cardId: string) => {
    setTiltStyle(prev => ({
      ...prev,
      [cardId]: `perspective(800px) rotateX(0deg) rotateY(0deg) scale3d(1.0, 1.0, 1.0)`
    }));
  };

  const handleStartClick = () => {
    if (isSwallowing) return;
    setIsSwallowing(true);
    setTimeout(() => {
      onStartGame(false);
    }, 850);
  };

  const handleDailyStartClick = () => {
    if (isSwallowing) return;
    setIsSwallowing(true);
    setTimeout(() => {
      onStartGame(true);
    }, 850);
  };


  const builds = [
    {
      id: 'breaker' as const,
      name: 'Breaker',
      korean: '파괴자',
      icon: (
        <svg className="w-10 h-10 text-maze-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      ),
      desc: '묵직한 타격, 강한 넉백. 벽 충돌 피해를 극대화하는 중형 메이스 빌드.',
      stats: { damage: 25, speed: 30, knockback: 90, stamina: 35 },
      color: 'border-maze-accent hover:border-red-500 shadow-red-glow/20'
    },
    {
      id: 'striker' as const,
      name: 'Striker',
      korean: '습격자',
      icon: (
        <svg className="w-10 h-10 text-maze-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
      desc: '빠른 이동, 짧은 후딜. 적의 반격을 허용하지 않는 고속 메이스 연속 빌드.',
      stats: { damage: 15, speed: 90, knockback: 40, stamina: 18 },
      color: 'border-maze-gold hover:border-yellow-400 shadow-gold-glow/20'
    },
    {
      id: 'cartographer' as const,
      name: 'Cartographer',
      korean: '개척자',
      icon: (
        <svg className="w-10 h-10 text-maze-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
        </svg>
      ),
      desc: '미궁 탐색, 방 타입 예측. 확장 모듈을 타격해 다음 연결 방의 속성을 읽는 탐색자 빌드.',
      stats: { damage: 18, speed: 60, knockback: 65, stamina: 25 },
      color: 'border-maze-silver hover:border-slate-300 shadow-white/10'
    },
    {
      id: 'guardian' as const,
      name: 'Guardian',
      korean: '수호자',
      icon: (
        <svg className="w-10 h-10 text-maze-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      ),
      desc: '광역 베기, 강력한 생존력. 넓은 타격 궤적과 철저한 중장갑을 연동한 그레이트 소드 빌드.',
      stats: { damage: 20, speed: 45, knockback: 60, stamina: 25 },
      color: 'border-purple-600 hover:border-purple-400 shadow-purple-600/20'
    }
  ];

  return (
    <div className="relative w-full min-h-screen bg-maze-bg flex flex-col justify-between items-center py-6 px-4 overflow-y-auto overflow-x-hidden">
      
      {/* Screen Devouring transition layer */}
      {isSwallowing && (
        <div className="fixed inset-0 z-[100] pointer-events-auto flex items-center justify-center">
          <div className="absolute bg-[#050102] rounded-full animate-swallow-screen" />
        </div>
      )}

      {/* Living Breathing Maze/Vein SVG Background Overlay */}
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden opacity-25 animate-vein-pulse">
        <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
          <path d="M -50 100 Q 150 250 100 400 T 300 700 T 500 900" fill="none" stroke="#3D0A05" strokeWidth="6" strokeLinecap="round" />
          <path d="M 700 -100 Q 400 200 450 450 T 150 850" fill="none" stroke="#3D0A05" strokeWidth="5.5" strokeLinecap="round" />
          <path d="M 850 200 Q 550 400 650 650 T 950 950" fill="none" stroke="#250409" strokeWidth="6" strokeLinecap="round" />
          <path d="M 120 -50 Q 300 150 200 350 T 50 650" fill="none" stroke="#250409" strokeWidth="4.5" strokeLinecap="round" />
          <path d="M -50 100 Q 150 250 100 400 T 300 700 T 500 900" fill="none" stroke="#C8432F" strokeWidth="1.8" strokeLinecap="round" filter="drop-shadow(0 0 3px #C8432F)" />
          <path d="M 700 -100 Q 400 200 450 450 T 150 850" fill="none" stroke="#C8432F" strokeWidth="1.4" strokeLinecap="round" filter="drop-shadow(0 0 2px #C8432F)" />
        </svg>
      </div>

      {/* Background Embers / Spores */}
      <div className="absolute inset-0 pointer-events-none z-0">
        {particles.map(p => (
          <div
            key={p.id}
            className="absolute bg-gradient-to-t from-red-900 to-purple-950 rounded-full opacity-40 blur-[1.5px]"
            style={{
              left: `${p.left}%`,
              bottom: `-20px`,
              width: `${p.size}px`,
              height: `${p.size}px`,
              animation: `floatUp ${p.duration}s linear infinite`,
              animationDelay: `${p.delay}s`
            }}
          />
        ))}
      </div>

      {/* Grid Pattern overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(26,26,46,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(26,26,46,0.1)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none opacity-40" />

      {/* Style for dynamic animations */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes floatUp {
          0% { transform: translateY(0) translateX(0) scale(0.8); opacity: 0; }
          15% { opacity: 0.65; }
          50% { transform: translateY(-50vh) translateX(20px) scale(1.1); }
          85% { opacity: 0.65; }
          100% { transform: translateY(-105vh) translateX(-15px) scale(0.5); opacity: 0; }
        }
        @keyframes veinPulse {
          0%, 100% { transform: scale(1.0); opacity: 0.22; filter: brightness(0.9); }
          50% { transform: scale(1.03); opacity: 0.45; filter: brightness(1.2) drop-shadow(0 0 4px rgba(200,67,47,0.5)); }
        }
        .animate-vein-pulse {
          animation: veinPulse 4.2s infinite ease-in-out;
          transform-origin: center;
        }
        @keyframes logoGlow {
          0%, 100% { text-shadow: 0 0 10px rgba(201,168,76,0.4), 0 0 20px rgba(201,168,76,0.2); transform: scale(1.0); }
          50% { text-shadow: 0 0 25px rgba(201,168,76,0.85), 0 0 45px rgba(201,168,76,0.5); transform: scale(1.02); }
        }
        .animate-logo-glow {
          animation: logoGlow 3.5s infinite ease-in-out;
        }
        @keyframes selectedBorderGlow {
          0%, 100% { border-color: rgba(201, 168, 76, 0.7); box-shadow: 0 0 15px rgba(201, 168, 76, 0.4); }
          50% { border-color: rgba(255, 215, 0, 1.0); box-shadow: 0 0 30px rgba(201, 168, 76, 0.8), inset 0 0 10px rgba(201, 168, 76, 0.2); }
        }
        .animate-selected-border {
          animation: selectedBorderGlow 2.0s infinite ease-in-out;
        }
        @keyframes swallowScreen {
          0% { width: 0vmax; height: 0vmax; border-radius: 50%; opacity: 0.1; box-shadow: 0 0 20px #FF3B30; }
          40% { border-radius: 40%; opacity: 0.85; box-shadow: 0 0 60px #C8432F; }
          100% { width: 220vmax; height: 220vmax; border-radius: 0%; opacity: 1.0; }
        }
        .animate-swallow-screen {
          animation: swallowScreen 0.85s cubic-bezier(0.7, 0, 0.3, 1) forwards;
        }
      `}} />

      {/* Top Header */}
      <div className="w-full text-center mt-2 z-10 flex flex-col items-center">
        <h1 className="text-4xl md:text-6xl font-cinzel font-black tracking-wider text-maze-gold drop-shadow-[0_0_20px_rgba(201,168,76,0.6)] animate-logo-glow">
          Maze & Mace
        </h1>
        <p className="text-xs md:text-sm font-outfit text-maze-accent font-semibold tracking-[0.25em] mt-1.5 uppercase animate-pulse">
          "두드릴수록, 더 깊이 잡아먹힌다."
        </p>

        {/* Centerpiece Hero Art Image */}
        <div className="mt-3 mb-2 max-w-[260px] md:max-w-[320px] relative rounded-lg border-2 border-slate-900 overflow-hidden shadow-gold-glow-lg flex justify-center items-center">
          <img src={heroImage} alt="Maze & Mace Hero Art" className="w-full aspect-[4/3] object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-maze-bg/80 via-transparent to-transparent pointer-events-none" />
        </div>
        
        {/* Core Game Lore Copies */}
        <div className="my-2.5 max-w-xl mx-auto bg-slate-950/80 border border-slate-900 rounded-lg p-3 space-y-1.5 text-[11px] md:text-xs font-outfit text-maze-cream shadow-[inset_0_0_15px_rgba(200,67,47,0.08)]">
          <p className="text-maze-accent font-bold tracking-wide">
            ✦ 미궁은 길이 아니라 괴물이다.
          </p>
          <p className="text-maze-gold tracking-wide">
            ✦ 강해지고 싶다는 욕망이, 미궁의 먹이가 된다.
          </p>
          <p className="text-maze-silver tracking-wide leading-relaxed">
            ✦ 미궁은 주어지는 맵이 아니라, 플레이어가 무기로 두드려 만들어가는 전장이다.
          </p>
        </div>

        {/* Run Records Summary Board */}
        <div className="my-3 max-w-xl w-full mx-auto bg-gradient-to-b from-slate-950/90 to-maze-dark/90 border border-maze-gold/40 rounded-lg p-3.5 shadow-[0_0_15px_rgba(201,168,76,0.15)] text-left">
          {/* Tab Controllers */}
          <div className="flex justify-center gap-4 sm:gap-6 mb-3 border-b border-slate-900/60 pb-1.5">
            <button
              type="button"
              onClick={() => setActiveTab('records')}
              className={`text-[10px] md:text-xs font-cinzel font-black tracking-widest px-2 sm:px-3 py-1 rounded transition-all duration-200 cursor-pointer ${
                activeTab === 'records'
                  ? 'text-maze-gold border-b-2 border-maze-gold'
                  : 'text-maze-silver/50 hover:text-maze-silver'
              }`}
            >
              🏆 RECORDS
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('achievements')}
              className={`text-[10px] md:text-xs font-cinzel font-black tracking-widest px-2 sm:px-3 py-1 rounded transition-all duration-200 cursor-pointer ${
                activeTab === 'achievements'
                  ? 'text-maze-gold border-b-2 border-maze-gold'
                  : 'text-maze-silver/50 hover:text-maze-silver'
              }`}
            >
              🏅 ACHIEVEMENTS ({unlockedAchievements.filter(id => ACHIEVEMENTS.some(a => a.id === id)).length}/{ACHIEVEMENTS.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('scoreboard')}
              className={`text-[10px] md:text-xs font-cinzel font-black tracking-widest px-2 sm:px-3 py-1 rounded transition-all duration-200 cursor-pointer ${
                activeTab === 'scoreboard'
                  ? 'text-maze-gold border-b-2 border-maze-gold'
                  : 'text-maze-silver/50 hover:text-maze-silver'
              }`}
            >
              📊 SCOREBOARD
            </button>
          </div>

          {activeTab === 'scoreboard' ? (
            <div className="flex flex-col gap-2 min-h-[140px] justify-between">
              <div className="flex flex-col gap-1.5 max-h-[110px] overflow-y-auto pr-1">
                {(() => {
                  const filtered = scoreboard
                    .filter(entry => entry.difficulty === difficulty)
                    .sort((a, b) => b.score - a.score)
                    .slice(0, 3);
                  
                  if (filtered.length === 0) {
                    return (
                      <div className="flex flex-col items-center justify-center py-6 text-maze-silver/50 text-[10px] sm:text-xs italic select-none">
                        <span>기록 없음</span>
                        <span className="text-[8px] sm:text-[9px] text-maze-silver/30 mt-1">미궁을 탈출하고 상위 랭킹에 도전해보세요!</span>
                      </div>
                    );
                  }

                  return filtered.map((entry, idx) => {
                    const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉';
                    const mins = Math.floor(entry.survivalTime / 60);
                    const secs = entry.survivalTime % 60;
                    const buildName = builds.find(b => b.id === entry.build)?.name || entry.build;
                    
                    return (
                      <div
                        key={entry.id}
                        className="flex items-center justify-between bg-slate-950/45 border border-slate-900 rounded p-1.5 text-[10px] sm:text-xs font-outfit"
                      >
                        <div className="flex items-center gap-1.5">
                          <span className="text-base select-none">{medal}</span>
                          <span className="font-cinzel font-bold text-maze-gold">{entry.score.toLocaleString()} pts</span>
                          <span className="px-1.5 py-0.5 rounded bg-slate-900 text-maze-silver text-[9px] border border-slate-800 uppercase tracking-wider scale-90">
                            {buildName}
                          </span>
                          {entry.isDaily && (
                            <span className="px-1 py-0.5 rounded bg-red-950/80 text-red-400 text-[8px] border border-red-800 uppercase tracking-wider scale-90 font-bold">
                              📅 DAILY
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 text-maze-silver/80 text-[9px] sm:text-[10px]">
                          <span className="font-cinzel text-maze-accent font-bold">{entry.rank}</span>
                          <span className="hidden sm:inline">⏱️ {mins}m {secs}s</span>
                          <span className="hidden sm:inline">💀 {entry.kills}</span>
                          <span className="text-maze-silver/40 font-cinzel">{entry.date.slice(2)}</span>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>

              {/* Action Panel at Bottom */}
              <div className="flex justify-between items-center border-t border-slate-900/60 pt-2 text-[10px] select-none">
                <span className="text-maze-silver/60">난이도: {difficulty === 'extreme' ? '심층' : difficulty === 'hard' ? '오염' : '일반'} (상위 3개 표시)</span>
                <button
                  type="button"
                  onClick={() => {
                    playSystemSound('click');
                    setModalFilter(difficulty);
                    setShowAllModal(true);
                  }}
                  className="text-maze-gold font-bold hover:text-white px-2 py-0.5 rounded bg-maze-gold/10 border border-maze-gold/30 hover:bg-maze-gold/20 transition-all cursor-pointer text-[9px] tracking-wide"
                >
                  📊 전체 기록 보기
                </button>
              </div>
            </div>
          ) : activeTab === 'records' ? (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center border-b border-slate-900/60 pb-2.5 mb-2.5">
                <div>
                  <div className="text-[9px] text-maze-silver uppercase font-semibold">HIGH SCORE</div>
                  <div className="text-base font-cinzel font-bold text-maze-gold mt-0.5">{records.bestScore}</div>
                </div>
                <div>
                  <div className="text-[9px] text-maze-silver uppercase font-semibold">MAX SURVIVAL</div>
                  <div className="text-base font-cinzel font-bold text-maze-cream mt-0.5">
                    {Math.floor(records.longestSurvival / 60)}m {records.longestSurvival % 60}s
                  </div>
                </div>
                <div>
                  <div className="text-[9px] text-maze-silver uppercase font-semibold">MAX COMBO</div>
                  <div className="text-base font-cinzel font-bold text-maze-accent mt-0.5">{records.highestCombo}x</div>
                </div>
                <div>
                  <div className="text-[9px] text-maze-silver uppercase font-semibold">TOTAL RUNS</div>
                  <div className="text-base font-cinzel font-bold text-maze-silver mt-0.5">{records.totalRuns} <span className="text-[9px] text-maze-silver/50">runs</span></div>
                </div>
              </div>
              
              {/* Selected Build best stats */}
              <div className="flex flex-col sm:flex-row justify-between items-center text-[10px] font-outfit text-maze-silver px-1 gap-1">
                <span>SELECTED WEAPON RECORD ({builds.find(b => b.id === selectedBuild)?.name}):</span>
                <span className="text-maze-gold font-bold">
                  BEST: <span className="text-white">{records.builds[selectedBuild]?.bestScore || 0} pts</span> |{' '}
                  TIME: <span className="text-white">{Math.floor((records.builds[selectedBuild]?.longestSurvival || 0) / 60)}m {(records.builds[selectedBuild]?.longestSurvival || 0) % 60}s</span> |{' '}
                  KILLS: <span className="text-white">{records.builds[selectedBuild]?.bestKills || 0}</span>
                </span>
              </div>
            </>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-left max-h-[140px] overflow-y-auto pr-1">
              {ACHIEVEMENTS.map(ach => {
                const isUnlocked = unlockedAchievements.includes(ach.id);
                return (
                  <div
                    key={ach.id}
                    className={`flex items-start gap-2.5 p-2 rounded border bg-slate-950/40 transition-all duration-300 ${
                      isUnlocked
                        ? 'border-maze-gold/45 shadow-[0_0_8px_rgba(201,168,76,0.06)]'
                        : 'border-slate-900/60 opacity-50'
                    }`}
                  >
                    <div className={`text-sm mt-0.5 ${isUnlocked ? 'text-maze-gold' : 'text-maze-silver/30'}`}>
                      {isUnlocked ? (
                        <svg className="w-4 h-4 fill-current text-maze-gold" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4 text-maze-silver/35" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                      )}
                    </div>
                    <div className="flex flex-col">
                      <span className={`text-[10px] font-bold tracking-wide ${isUnlocked ? 'text-maze-gold font-bold' : 'text-maze-silver/50'}`}>
                        {ach.name}
                      </span>
                      <span className="text-[9px] text-maze-cream/80 leading-normal font-outfit mt-0.5">
                        {ach.desc}
                      </span>
                      <span className="text-[8px] text-maze-silver/45 font-outfit mt-0.5 italic">
                        조건: {ach.condition}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Middle Grid — Starter Builds */}
      <div className="w-full max-w-5xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 my-4 px-4 z-10">
        {builds.map(b => {
          const isSelected = selectedBuild === b.id;
          return (
            <div
              key={b.id}
              onClick={() => setSelectedBuild(b.id)}
              onMouseMove={(e) => handleMouseMove(e, b.id)}
              onMouseLeave={() => handleMouseLeave(b.id)}
              className={`relative bg-maze-dark/95 border-2 rounded-xl p-4 cursor-pointer transition-all duration-200 select-none flex flex-col justify-between h-[250px] md:h-[270px] ${
                isSelected 
                  ? `${swapActive === b.id ? 'animate-card-swap' : 'animate-selected-border'} scale-[1.03]` 
                  : `border-slate-800 opacity-60 hover:opacity-100 ${b.color}`
              }`}
              style={{
                transform: tiltStyle[b.id] || 'perspective(800px) rotateX(0deg) rotateY(0deg)',
                transformStyle: 'preserve-3d',
              }}
            >
              {/* Active check indicator */}
              {isSelected && (
                <div className="absolute -top-2.5 -right-2.5 w-7 h-7 rounded-full bg-maze-gold flex items-center justify-center border-2 border-maze-bg text-maze-bg shadow-md">
                  <svg className="w-3.5 h-3.5 font-bold" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}

              {/* Title & Icon */}
              <div>
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="text-lg md:text-xl font-cinzel font-bold text-maze-gold">{b.name}</h3>
                    <span className="text-[10px] font-outfit text-maze-silver font-semibold tracking-wider">{b.korean}</span>
                  </div>
                  <div className="p-1.5 rounded bg-maze-bg/50 border border-slate-800">
                    {b.icon}
                  </div>
                </div>
                <p className="text-[11px] text-maze-cream/80 leading-normal font-outfit mt-1">
                  {b.desc}
                </p>
              </div>

              {/* Stats Progress Bars */}
              <div className="mt-2 space-y-1.5 border-t border-slate-900/60 pt-2">
                <div className="flex items-center text-[9px] text-maze-silver font-outfit justify-between">
                  <span>DAMAGE</span>
                  <span className={isSelected ? "text-maze-accent font-bold" : "text-maze-gold"}>{b.stats.damage}</span>
                </div>
                <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden relative">
                  <div 
                    className={`bg-maze-accent h-full transition-all duration-1000 ease-out ${
                      isSelected ? 'shadow-[0_0_8px_#C8432F]' : ''
                    }`} 
                    style={{ width: isSelected ? `${(b.stats.damage / 30) * 100}%` : '0%' }} 
                  />
                </div>

                <div className="flex items-center text-[9px] text-maze-silver font-outfit justify-between">
                  <span>ATTACK SPEED</span>
                  <span className={isSelected ? "text-maze-gold font-bold" : "text-maze-gold"}>{b.stats.speed}%</span>
                </div>
                <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden relative">
                  <div 
                    className={`bg-maze-gold h-full transition-all duration-1000 ease-out ${
                      isSelected ? 'shadow-[0_0_8px_#C9A84C]' : ''
                    }`} 
                    style={{ width: isSelected ? `${b.stats.speed}%` : '0%' }} 
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom controls & Action button */}
      <div className="w-full max-w-md text-center flex flex-col items-center gap-3.5 z-10">
        
        {/* Difficulty Selection */}
        <div className="w-full max-w-sm bg-slate-950/80 border border-slate-900 rounded-lg p-2.5 flex flex-col items-center gap-2 shadow-[0_0_10px_rgba(0,0,0,0.5)]">
          <span className="text-[9px] font-cinzel font-bold text-maze-gold tracking-widest uppercase">
            SELECT DIFFICULTY
          </span>
          <div className="flex gap-2 w-full">
            {(['normal', 'hard', 'extreme'] as const).map(diff => (
              <button
                key={diff}
                type="button"
                onClick={() => setDifficulty(diff)}
                className={`flex-1 py-1.5 rounded font-cinzel font-bold text-xs tracking-wider transition-all duration-300 cursor-pointer ${
                  difficulty === diff
                    ? diff === 'extreme'
                      ? 'bg-red-950 border border-red-600 text-red-400 shadow-[0_0_12px_rgba(220,38,38,0.4)] animate-pulse'
                      : diff === 'hard'
                        ? 'bg-amber-950 border border-amber-600 text-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.3)]'
                        : 'bg-maze-gold/25 border border-maze-gold text-maze-gold shadow-[0_0_8px_rgba(201,168,76,0.2)]'
                    : 'bg-slate-950/50 border border-slate-900 text-maze-silver/40 hover:text-maze-silver/80'
                }`}
              >
                {diff === 'normal' && '일반 (Normal)'}
                {diff === 'hard' && '오염 (Hard)'}
                {diff === 'extreme' && '심층 (Extreme)'}
              </button>
            ))}
          </div>
          {/* Difficulty Description Bullet */}
          <div className="text-[9px] font-outfit text-maze-silver/80 leading-relaxed text-center px-1">
            {difficulty === 'normal' && (
              <span className="text-maze-cream font-medium">기본 미궁 탐색 밸런스 유지 (점수 배율: 1.0x)</span>
            )}
            {difficulty === 'hard' && (
              <span className="text-amber-500 font-bold">몬스터 HP/피해 +30% | 오염도 상승 속도 2배 | 점수 배율: 1.5x</span>
            )}
            {difficulty === 'extreme' && (
              <span className="text-red-500 font-extrabold animate-pulse">몬스터 HP/피해 +70% | 기본 시야 제한 | 점수 배율: 2.5x | 전용 업적 해금</span>
            )}
          </div>
        </div>

        {/* Start Buttons Row */}
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={handleStartClick}
            className="w-52 py-2.5 rounded-lg font-cinzel font-black text-sm bg-maze-gold hover:bg-maze-cream text-maze-bg border border-maze-cream tracking-widest transition-all duration-300 hover:shadow-gold-glow-lg active:scale-95 cursor-pointer"
          >
            ENTER THE MAZE
          </button>
          <button
            onClick={handleDailyStartClick}
            className="w-52 py-2.5 rounded-lg font-cinzel font-black text-sm bg-red-950/80 border border-red-500 hover:bg-red-900/90 text-red-100 tracking-widest transition-all duration-300 hover:shadow-[0_0_15px_rgba(239,68,68,0.4)] active:scale-95 cursor-pointer"
          >
            📅 DAILY CHALLENGE
          </button>
        </div>

        {/* Daily Challenge Info Card */}
        {(() => {
          const dailyInfo = getDailySeedAndRule(new Date());
          return (
            <div className="border border-red-950/60 bg-red-950/20 backdrop-blur-md rounded-lg py-2.5 px-4 max-w-sm flex flex-col items-center select-none">
              <div className="text-[10px] text-red-400 font-cinzel tracking-[0.2em] font-black uppercase mb-1">
                TODAY'S DAILY CHALLENGE
              </div>
              <div className="text-[11px] font-bold text-white font-outfit">
                📅 {dailyInfo.dateString} : <span className="text-maze-gold">{dailyInfo.rule.koreanName}</span>
              </div>
              <div className="text-[9px] text-maze-silver/80 mt-1 font-outfit text-center leading-relaxed">
                {dailyInfo.rule.koreanDesc}
              </div>
            </div>
          );
        })()}


        {/* Action Controls Guide */}
        <div className="border border-slate-900 bg-maze-dark/60 rounded-lg py-2 px-4 max-w-sm">
          <p className="text-[9px] text-maze-silver font-outfit tracking-wider leading-normal">
            <span className="text-maze-gold font-bold">MOVE</span>: WASD |{' '}
            <span className="text-maze-gold font-bold">ATK</span>: Click/Space |{' '}
            <span className="text-maze-gold font-bold">DASH</span>: L-Shift |{' '}
            <span className="text-maze-gold font-bold">SKL</span>: Q |{' '}
            <span className="text-maze-gold font-bold">EXPAND</span>: F
          </p>
        </div>
      </div>

      {/* Full Scoreboard Modal */}
      {showAllModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-fade-in pointer-events-auto">
          <div className="relative w-full max-w-4xl bg-gradient-to-b from-slate-950 to-maze-dark border border-maze-gold/40 rounded-xl p-5 shadow-gold-glow-lg flex flex-col justify-between max-h-[85vh] select-none text-left">
            
            {/* Modal Header */}
            <div className="flex justify-between items-center border-b border-slate-900 pb-3">
              <div>
                <h2 className="text-xl md:text-2xl font-cinzel font-black text-maze-gold tracking-widest drop-shadow-[0_0_15px_rgba(201,168,76,0.3)]">
                  🏆 LABYRINTH LEADERBOARD
                </h2>
                <p className="text-[10px] text-maze-silver/60 font-outfit uppercase mt-0.5">미궁 탈출에 성공한 상위 10개 런 기록</p>
              </div>
              <button
                onClick={() => {
                  playSystemSound('click');
                  setShowAllModal(false);
                }}
                className="text-maze-silver/50 hover:text-white text-lg p-1.5 transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Filters */}
            <div className="flex gap-2 my-3 select-none">
              {(['all', 'normal', 'hard', 'extreme'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => {
                    playSystemSound('click');
                    setModalFilter(f);
                  }}
                  className={`px-3 py-1 rounded text-xs font-cinzel tracking-wider transition-all border cursor-pointer ${
                    modalFilter === f
                      ? f === 'extreme'
                        ? 'bg-red-950/60 border-red-600 text-red-400'
                        : f === 'hard'
                          ? 'bg-amber-950/60 border-amber-600 text-amber-400'
                          : f === 'normal'
                            ? 'bg-maze-gold/20 border-maze-gold text-maze-gold'
                            : 'bg-slate-900 border-maze-silver text-white'
                      : 'bg-slate-950/40 border-slate-900 text-maze-silver/50 hover:text-maze-silver'
                  }`}
                >
                  {f === 'all' && '전체 (All)'}
                  {f === 'normal' && '일반 (Normal)'}
                  {f === 'hard' && '오염 (Hard)'}
                  {f === 'extreme' && '심층 (Extreme)'}
                </button>
              ))}
            </div>

            {/* Modal Table Content */}
            <div className="flex-1 overflow-y-auto border border-slate-900 rounded-lg bg-slate-950/50 p-1 md:p-3">
              {(() => {
                const filtered = scoreboard
                  .filter(entry => modalFilter === 'all' || entry.difficulty === modalFilter)
                  .sort((a, b) => b.score - a.score);
                
                if (filtered.length === 0) {
                  return (
                    <div className="flex flex-col items-center justify-center py-20 text-maze-silver/50 text-xs italic select-none">
                      <span>기록이 없습니다.</span>
                      <span className="text-[10px] text-maze-silver/30 mt-1">미궁에서 살아돌아와 업적을 남기세요.</span>
                    </div>
                  );
                }

                return (
                  <table className="w-full text-[10px] md:text-xs font-outfit border-collapse text-left">
                    <thead>
                      <tr className="border-b border-slate-900 text-maze-silver/60 font-black">
                        <th className="py-2 px-2">순위</th>
                        <th className="py-2 px-2">난이도</th>
                        <th className="py-2 px-2">빌드</th>
                        <th className="py-2 px-2 text-right">점수</th>
                        <th className="py-2 px-2 text-center">랭크</th>
                        <th className="py-2 px-2 text-right">생존 시간</th>
                        <th className="py-2 px-2 text-right">처치 수</th>
                        <th className="py-2 px-2 text-right">최고 콤보</th>
                        <th className="py-2 px-2 text-right">날짜</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((entry, idx) => {
                        const mins = Math.floor(entry.survivalTime / 60);
                        const secs = entry.survivalTime % 60;
                        const timeStr = `${mins}m ${secs}s`;
                        const buildName = builds.find(b => b.id === entry.build)?.name || entry.build;
                        
                        return (
                          <tr key={entry.id} className="border-b border-slate-900/40 hover:bg-slate-900/20 text-maze-cream">
                            <td className="py-2.5 px-2 font-cinzel font-bold text-maze-gold">#{idx + 1}</td>
                            <td className="py-2.5 px-2">
                              <span className={`px-1.5 py-0.5 rounded text-[9px] uppercase font-cinzel font-black border ${
                                entry.difficulty === 'extreme'
                                  ? 'bg-red-950/60 border-red-600/50 text-red-400'
                                  : entry.difficulty === 'hard'
                                    ? 'bg-amber-950/60 border-amber-600/50 text-amber-400'
                                    : 'bg-maze-gold/10 border-maze-gold/30 text-maze-gold'
                              }`}>
                                {entry.difficulty === 'extreme' ? '심층' : entry.difficulty === 'hard' ? '오염' : '일반'}
                              </span>
                            </td>
                            <td className="py-2.5 px-2">
                              <div className="flex items-center gap-1.5">
                                <span className="bg-slate-900 text-maze-silver text-[9px] border border-slate-800 rounded px-1.5 py-0.5 uppercase tracking-wide">
                                  {buildName}
                                </span>
                                {entry.isDaily && (
                                  <span className="bg-red-950/80 text-red-400 text-[8px] border border-red-800 rounded px-1.5 py-0.5 uppercase font-bold tracking-wide scale-90" title={entry.dailyRuleId}>
                                    📅 DAILY
                                  </span>
                                )}
                              </div>
                            </td>

                            <td className="py-2.5 px-2 text-right font-cinzel font-bold text-maze-gold">
                              {entry.score.toLocaleString()}
                            </td>
                            <td className="py-2.5 px-2 text-center font-cinzel font-black text-maze-accent">
                              {entry.rank}
                            </td>
                            <td className="py-2.5 px-2 text-right">{timeStr}</td>
                            <td className="py-2.5 px-2 text-right">{entry.kills}</td>
                            <td className="py-2.5 px-2 text-right font-cinzel">{entry.maxCombo}x</td>
                            <td className="py-2.5 px-2 text-right text-maze-silver/50 font-cinzel">{entry.date}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                );
              })()}
            </div>

            {/* Modal Footer Controls */}
            <div className="flex justify-between items-center border-t border-slate-900 pt-3.5 mt-3 select-none">
              <button
                type="button"
                onClick={() => {
                  playSystemSound('click');
                  setShowResetConfirm(true);
                }}
                className="px-3.5 py-1.5 rounded bg-red-950/40 hover:bg-red-900/30 text-red-500 border border-red-900/50 transition-all cursor-pointer text-xs font-bold font-outfit"
              >
                ⚠️ 기록 초기화 (Reset)
              </button>
              
              <button
                type="button"
                onClick={() => {
                  playSystemSound('click');
                  setShowAllModal(false);
                }}
                className="px-5 py-1.5 rounded-lg bg-maze-gold hover:bg-maze-cream text-maze-bg border border-maze-cream text-xs font-cinzel font-bold transition-all cursor-pointer"
              >
                CLOSE
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Confirmation Reset Modal */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-fade-in pointer-events-auto">
          <div className="w-full max-w-sm bg-gradient-to-b from-slate-950 to-maze-dark border-2 border-red-700/80 rounded-xl p-6 shadow-[0_0_35px_rgba(239,68,68,0.3)] text-center select-none flex flex-col justify-between">
            <h3 className="text-lg md:text-xl font-cinzel font-black text-red-500 tracking-wider">
              ⚠️ RESET LEADERBOARD?
            </h3>
            
            <p className="text-xs text-maze-cream leading-relaxed mt-4 font-outfit">
              정말 모든 스코어보드 기록을 초기화하시겠습니까?<br />
              <span className="text-red-400 font-bold">이 작업은 취소할 수 없으며 모든 난이도의 상위 기록이 완전히 삭제됩니다.</span>
            </p>

            <div className="flex gap-3.5 mt-6 justify-center">
              <button
                type="button"
                onClick={() => {
                  playSystemSound('click');
                  setShowResetConfirm(false);
                }}
                className="flex-1 py-2 rounded bg-slate-900 hover:bg-slate-800 text-maze-silver border border-slate-800 transition-all cursor-pointer text-xs font-bold"
              >
                취소 (Cancel)
              </button>
              <button
                type="button"
                onClick={() => {
                  playSystemSound('reset');
                  localStorage.removeItem('maze_mace_scoreboard');
                  setScoreboard([]);
                  setShowResetConfirm(false);
                  setShowAllModal(false);
                }}
                className="flex-1 py-2 rounded bg-red-700 hover:bg-red-600 text-white font-bold tracking-wide transition-all cursor-pointer text-xs"
              >
                초기화 확인 (Reset All)
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
