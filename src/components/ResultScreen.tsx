import { useState } from 'react';
import type { RunStats, UpgradeOption, Difficulty, BuildId } from '../types/game';
import { getRunRank } from '../domain/runRank';
import { getDailySeedAndRule } from '../config/dailyChallenge';


interface ResultScreenProps extends RunStats {
  activeUpgrades: UpgradeOption[];
  onRetry: () => void;
  isNewRecord?: boolean;
  isDailyChallenge?: boolean;
  dailySeed?: number;
  difficulty?: Difficulty;
  selectedBuild: BuildId;
}

const BUILD_SYNOPSIS: Record<BuildId, { title: string; desc: string }> = {
  breaker: {
    title: '🧱 파괴의 거장 (Wall Slam Master)',
    desc: '강력한 넉백 가시 메이스와 지진 강타 스킬을 적극 활용하여 적들을 벽에 메쳐 충격적인 벽 슬램 2배 대미지를 뿜어내는 묵직한 한 방 위주의 물리 공격형 빌드입니다.'
  },
  striker: {
    title: '⚡ 질풍의 습격자 (Quick Blade Invincible)',
    desc: '대시 시 완전 무적 프레임 판정과 극도로 빠른 연속 공격 쿨다운, 잔상 대시 스킬을 결합해 공격/스킬의 스태미너 소모를 절감하며 전장을 지배하는 기동형 빌드입니다.'
  },
  cartographer: {
    title: '🗺️ 영리한 개척자 (Sanctuary Architect)',
    desc: '인접한 미탐사 방의 격자 타입을 선예측해 동선을 최적화하며, 방 확장 스태미너 60% 절감 보너스와 적들을 감속 장막으로 묶는 유적 파동 스킬을 지닌 전략 탐색형 빌드입니다.'
  },
  guardian: {
    title: '🛡️ 난공불락의 수호자 (Aegis Bastion)',
    desc: '상시 적용되는 permanent 35% 대미지 감쇄 쉴드로 적들의 맹공을 버텨내고, 회전 베기로 다단히트 피해를 줌과 동시에 투사체들을 지워버리는 밸런스 유지력 특화 빌드입니다.'
  }
};



export default function ResultScreen({
  score,
  kills,
  roomsExpanded,
  maxCombo,
  contamination,
  survivalTime,
  victory = false,
  activeUpgrades,
  onRetry,
  isNewRecord = false,
  isDailyChallenge = false,
  dailySeed = 0,
  difficulty = 'normal',
  selectedBuild
}: ResultScreenProps) {
  const [showCopyAlert, setShowCopyAlert] = useState(false);

  // Format survival time to MM:SS
  const mins = Math.floor(survivalTime / 60);
  const secs = Math.floor(survivalTime % 60);
  const timeStr = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

  const { rank, colorClass: rankColor } = getRunRank(score, victory, contamination);

  const statItems = [
    { label: '생존 시간 (Survival Time)', val: timeStr, color: 'text-maze-cream' },
    { label: '처치 수 (Kills)', val: `${kills}`, color: 'text-maze-accent' },
    { label: '확장한 방 수 (Rooms Expanded)', val: `${roomsExpanded}`, color: 'text-maze-gold' },
    { label: '최고 콤보 (Max Combo)', val: `${maxCombo} Combo`, color: 'text-maze-cream' },
    { 
      label: '최종 오염도 (Final Contamination)', 
      val: victory ? '0% (정화됨)' : `${Math.round(contamination)}%`, 
      color: victory ? 'text-emerald-400 font-bold drop-shadow-[0_0_5px_rgba(52,211,153,0.5)]' : (contamination >= 70 ? 'text-maze-accent font-bold' : 'text-maze-silver') 
    },
    { label: '최종 점수 (Final Score)', val: `${score}`, color: 'text-maze-gold' }
  ];

  return (
    <div className={`relative w-full h-screen bg-maze-bg flex flex-col justify-between items-center py-10 px-4 overflow-hidden ${
      victory ? 'animate-screen-clear-pulse' : (rank === 'S' || rank === 'SS' || rank === 'SSS' ? 'animate-screen-gold-pulse' : '')
    }`}>
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes goldGlowPulse {
          0%, 100% {
            text-shadow: 0 0 20px rgba(201, 168, 76, 0.75), 0 0 35px rgba(201, 168, 76, 0.4);
            transform: scale(1.0);
          }
          50% {
            text-shadow: 0 0 35px rgba(201, 168, 76, 0.95), 0 0 50px rgba(201, 168, 76, 0.65), 0 0 70px rgba(201, 168, 76, 0.3);
            transform: scale(1.08);
          }
        }
        @keyframes screenGoldPulse {
          0%, 100% {
            box-shadow: inset 0 0 30px rgba(201, 168, 76, 0.15);
          }
          50% {
            box-shadow: inset 0 0 60px rgba(201, 168, 76, 0.32);
          }
        }
        @keyframes screenClearPulse {
          0%, 100% {
            box-shadow: inset 0 0 40px rgba(251, 191, 36, 0.25);
            background-color: #030205;
          }
          50% {
            box-shadow: inset 0 0 80px rgba(251, 191, 36, 0.45);
            background-color: #0f0a05;
          }
        }
        .animate-gold-glow-pulse {
          animation: goldGlowPulse 2.0s infinite ease-in-out;
          display: inline-block;
        }
        .animate-screen-gold-pulse {
          animation: screenGoldPulse 2.5s infinite ease-in-out;
        }
        .animate-screen-clear-pulse {
          animation: screenClearPulse 3.0s infinite ease-in-out;
        }
      ` }} />
      
      {/* Heavy radial gradient background for mood */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(26,26,46,0.3)_0%,rgba(8,8,14,0.95)_100%)] pointer-events-none" />

      {/* Grid overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(26,26,46,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(26,26,46,0.08)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none opacity-30" />

      {/* Header */}
      <div className="text-center z-10">
        {victory ? (
          <h1 className="text-4xl md:text-5xl font-cinzel font-black tracking-[6px] text-maze-gold drop-shadow-[0_0_25px_rgba(251,191,36,0.85)] uppercase animate-pulse">
            CLEARED
          </h1>
        ) : (
          <h1 className="text-4xl md:text-5xl font-cinzel font-black tracking-wider text-maze-accent drop-shadow-[0_0_15px_rgba(200,67,47,0.4)] uppercase">
            Run Terminated
          </h1>
        )}
        <p className="text-[10px] text-maze-silver font-outfit uppercase tracking-[0.2em] mt-2 mb-2 font-bold">
          {victory ? '욕망을 이겨냈다' : '미궁에 먹힌 탐색기록 보고서'}
        </p>
        {isDailyChallenge && dailySeed !== 0 && (() => {
          const dailyInfo = getDailySeedAndRule(new Date());
          return (
            <div className="mt-3 border border-red-950 bg-red-950/20 rounded-lg py-2 px-4 inline-block text-center select-none animate-pulse max-w-sm">
              <span className="text-[10px] text-red-400 font-cinzel tracking-[0.1em] font-black uppercase block">📅 데일리 챌린지 결과</span>
              <span className="text-xs font-bold text-white mt-1 block">오늘의 규칙: {dailyInfo.rule.koreanName}</span>
              <span className="text-[9px] text-maze-silver/80 block mt-0.5">{dailyInfo.rule.koreanDesc}</span>
            </div>
          );
        })()}
      </div>


      {/* New Record Banner */}
      {isNewRecord && (
        <div className="z-10 bg-gradient-to-r from-transparent via-maze-gold/20 to-transparent border-y border-maze-gold px-12 py-1.5 animate-pulse text-center select-none">
          <span className="text-xs md:text-sm font-cinzel font-black text-maze-gold tracking-widest drop-shadow-[0_0_10px_#C9A84C]">
            💥 NEW RECORD! (신기록 달성!) 💥
          </span>
        </div>
      )}

      {/* Rank Indicator */}
      <div className="flex flex-col items-center z-10">
        <span className="text-[9px] font-outfit text-maze-silver font-bold tracking-[0.3em]">RUN RANK</span>
        <span className={`text-7xl md:text-8xl font-cinzel font-black ${rankColor} ${
          rank === 'S' || rank === 'SS' || rank === 'SSS' ? 'animate-gold-glow-pulse' : ''
        } transition-all duration-300`}>
          {rank}
        </span>
        <div className="mt-1 flex flex-col items-center">
          <span className="text-[11px] font-outfit text-maze-accent font-bold tracking-widest uppercase">
            Labyrinth Assimilation (미궁 동화율): {victory ? '0% (정화 완료!)' : `${Math.round(contamination)}%`}
          </span>
          <p className="text-[9px] text-maze-silver/80 mt-0.5 text-center max-w-[420px]">
            {victory ? '오염도가 완전히 정화되었습니다. 당신은 미궁의 유혹을 뿌리치고 인간성을 지켜냈습니다.' :
             (contamination >= 80 ? '당신은 미궁의 일부가 되었습니다. 자아 상실 단계.' :
              contamination >= 50 ? '미궁의 살점이 당신의 육체를 절반 이상 잠식했습니다.' :
              contamination >= 25 ? '미궁의 정수가 혈관을 타고 흐르고 있습니다.' :
              '최소한의 오염만으로 생환했습니다.')}
          </p>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="w-full max-w-3xl grid grid-cols-2 md:grid-cols-3 gap-4 px-4 z-10 my-auto">
        {statItems.map((s, idx) => (
          <div
            key={idx}
            className="bg-maze-dark/80 border border-slate-900 rounded-lg p-3 text-center flex flex-col justify-between items-center h-20"
          >
            <span className="text-[9px] text-maze-silver font-outfit tracking-wider">{s.label}</span>
            <span className={`text-lg md:text-xl font-outfit font-bold ${s.color}`}>
              {s.val}
            </span>
          </div>
        ))}
      </div>

      {/* Build list */}
      <div className="w-full max-w-2xl text-center z-10 px-4">
        <span className="text-[10px] font-cinzel font-bold text-maze-silver tracking-widest block mb-2">RUN SYNERGY BUILD</span>
        <div className="bg-maze-dark/40 border border-slate-900 rounded-lg p-3 min-h-[44px] flex flex-wrap gap-2 items-center justify-center">
          {activeUpgrades.length > 0 ? (
            activeUpgrades.map((upg, idx) => (
              <span
                key={idx}
                className="text-[10px] font-outfit text-maze-cream bg-slate-950 border border-maze-gold/45 rounded py-1 px-3 shadow-[0_0_6px_rgba(201,168,76,0.1)]"
              >
                ⚡ {upg.name}
              </span>
            ))
          ) : (
            <span className="text-[10px] text-slate-600 font-outfit italic">장착된 변이 모듈 없음</span>
          )}
        </div>
      </div>

      {/* Build Synopsis / Flavor Summary */}
      <div className="w-full max-w-2xl z-10 px-4 mt-4">
        <div className="bg-maze-dark/70 border-2 border-maze-gold/30 rounded-xl p-4 shadow-[inset_0_0_12px_rgba(201,168,76,0.06)] relative overflow-hidden backdrop-blur-md">
          {/* Subtle gold shine overlay */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-maze-gold/5 to-transparent -translate-x-full animate-shine-fast pointer-events-none" />
          <span className="text-[9px] font-cinzel font-black text-maze-gold tracking-[0.25em] block mb-1 uppercase text-left">
            이번 런의 빌드 특징 (Run Synopsis)
          </span>
          <h4 className="text-xs font-outfit font-black text-white text-left mt-1.5 flex items-center gap-1.5">
            {BUILD_SYNOPSIS[selectedBuild]?.title}
          </h4>
          <p className="text-[10px] text-maze-silver font-outfit leading-relaxed mt-2 text-left font-semibold">
            {BUILD_SYNOPSIS[selectedBuild]?.desc}
          </p>
        </div>
      </div>

      {/* Action buttons */}
      <div className="z-10 mt-6 flex flex-col sm:flex-row gap-3">
        <button
          onClick={onRetry}
          className="w-48 py-2 rounded-lg font-cinzel font-bold text-sm bg-maze-gold hover:bg-maze-cream text-maze-bg border border-maze-cream tracking-widest transition-all duration-300 hover:shadow-gold-glow cursor-pointer"
        >
          RETRY RUN
        </button>
        {isDailyChallenge && (
          <button
            onClick={() => {
              const dailyInfo = getDailySeedAndRule(new Date());
              const rankText = getRunRank(score, victory, contamination).rank;
              const clearStatus = victory ? '클리어 성공! (CLEARED)' : '탈출 실패... (FAILED)';
              const upgradesText = activeUpgrades.map(u => u.name).join(', ') || '없음';
              const difficultyName = difficulty === 'extreme' ? '심층 (Extreme)' : difficulty === 'hard' ? '오염 (Hard)' : '일반 (Normal)';
              const buildTitle = BUILD_SYNOPSIS[selectedBuild]?.title || selectedBuild.toUpperCase();

              const text = `🩸 Maze & Mace - 데일리 챌린지 (${dailyInfo.dateString}) 🩸\n오늘의 규칙: ${dailyInfo.rule.koreanName} (${dailyInfo.rule.koreanDesc})\n난이도: ${difficultyName}\n캐릭터 빌드: ${buildTitle}\n결과: ${clearStatus}\n최종 점수: ${score.toLocaleString()} pts (랭크: ${rankText})\n생존 시간: ${mins}분 ${secs}초 | 처치 수: ${kills}마리\n최고 콤보: ${maxCombo} Combo | 확장한 방 수: ${roomsExpanded}개\n장착된 변이 모듈: ${upgradesText}\n#MazeAndMace #DailyChallenge`;

              navigator.clipboard.writeText(text).then(() => {
                setShowCopyAlert(true);
                setTimeout(() => setShowCopyAlert(false), 2200);
              }).catch(err => {
                console.error('Failed to copy', err);
              });
            }}
            className="w-48 py-2 rounded-lg font-cinzel font-bold text-sm bg-slate-900 border border-maze-gold hover:bg-slate-800 text-maze-gold hover:text-white tracking-widest transition-all duration-300 hover:shadow-gold-glow cursor-pointer"
          >
            SHARE SCORE
          </button>
        )}
      </div>

      {/* Copy notification popup */}
      {showCopyAlert && (
        <div className="fixed bottom-10 z-50 bg-slate-950/90 border border-maze-gold rounded-lg px-6 py-2.5 shadow-gold-glow-lg text-center animate-bounce">
          <span className="text-[10px] md:text-xs font-outfit text-maze-gold tracking-wider">
            📋 결과가 클립보드에 복사되었습니다!
          </span>
        </div>
      )}


    </div>
  );
}
