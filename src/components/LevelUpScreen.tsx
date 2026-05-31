import { useEffect, useState } from 'react';
import type { UpgradeOption } from '../types/game';

interface LevelUpScreenProps {
  onSelectUpgrade: (upg: UpgradeOption) => void;
  activeUpgrades: UpgradeOption[];
}

export default function LevelUpScreen({ onSelectUpgrade, activeUpgrades }: LevelUpScreenProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showSynergyFlash, setShowSynergyFlash] = useState(false);

  const isFirstRun = localStorage.getItem('maze_mace_first_run') === null;
  const [showHint, setShowHint] = useState(isFirstRun);

  useEffect(() => {
    if (isFirstRun) {
      const timer = setTimeout(() => {
        setShowHint(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isFirstRun]);

  const options: UpgradeOption[] = [
    {
      id: 'heavy_impact',
      name: 'Heavy Impact',
      desc: '넉백 증가. 피해량 +15%, 넉백 force +25%. 적을 벽으로 날려 추가 충돌 피해를 노립니다.',
      synergy: '⚡ POWER',
      type: 'power'
    },
    {
      id: 'stamina_flow',
      name: 'Stamina Flow',
      desc: '스태미너 회복 증가. 재생 속도 +35%, 공격 스태미너 소모량 -10%. 대시와 타격 리듬을 유지합니다.',
      synergy: '⚡ ENERGY',
      type: 'energy'
    },
    {
      id: 'maze_sense',
      name: 'Maze Sense',
      desc: '방 타입 예측. 인접 방 정보를 미리 표시하고 미궁 오염도 축적 속도를 15% 억제합니다.',
      synergy: '⚡ MAP',
      type: 'map'
    }
  ];

  // Helper to count how many upgrades of this synergy are already in the deck
  const getSynergyCount = (synergy: string) => {
    return activeUpgrades.filter(u => u.synergy === synergy).length;
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'power':
        return (
          <svg className="w-12 h-12 text-maze-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        );
      case 'energy':
        return (
          <svg className="w-12 h-12 text-maze-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m0-12.728l.707.707m12.728 12.728l.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z" />
          </svg>
        );
      case 'map':
      default:
        return (
          <svg className="w-12 h-12 text-maze-silver" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
        );
    }
  };

  const handleSelect = (opt: UpgradeOption) => {
    if (selectedId) return; // prevent duplicate clicks
    setSelectedId(opt.id);

    const count = getSynergyCount(opt.synergy);
    if (count >= 1) {
      setShowSynergyFlash(true);
    }

    setTimeout(() => {
      onSelectUpgrade(opt);
    }, 650);
  };

  return (
    <div className="absolute inset-0 bg-maze-bg/90 flex flex-col justify-center items-center z-50 p-4 transition-all duration-300 relative">
      
      {/* Synergy Flash Overlay */}
      {showSynergyFlash && (
        <div className="absolute inset-0 z-50 pointer-events-none animate-synergy-flash flex flex-col items-center justify-center">
          <div className="text-3xl md:text-4xl font-cinzel font-black text-white tracking-widest drop-shadow-[0_0_15px_#C9A84C] animate-bounce">
            ⚡ SYNERGY SYNCED! ⚡
          </div>
          <span className="text-[10px] font-outfit text-maze-gold tracking-widest mt-2 uppercase font-black">Deck Synergy Expanded</span>
        </div>
      )}

      {/* Runic glowing frame in bg */}
      <div className="absolute inset-0 border-[10px] border-maze-dark/50 pointer-events-none" />

      {/* Header */}
      <div className="text-center mb-8 max-w-lg">
        <h2 className="text-4xl md:text-5xl font-cinzel font-black text-maze-gold tracking-widest drop-shadow-[0_0_15px_rgba(201,168,76,0.5)]">
          LEVEL UP
        </h2>
        <div className="w-24 h-[1px] bg-maze-gold mx-auto my-3" />
        <p className="text-xs text-maze-silver font-outfit">
          에너지 코어가 과부하되었습니다. 미궁 변이 모듈 중 하나를 선택해 결속시키십시오.
        </p>
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl w-full px-4">
        {options.map((opt, cardIdx) => {
          const synergyCount = getSynergyCount(opt.synergy);
          const isSelected = selectedId === opt.id;
          const isAnySelected = selectedId !== null;

          let cardClass = "relative bg-maze-dark border border-slate-800 rounded-xl p-5 flex flex-col justify-between items-center text-center cursor-pointer select-none min-h-[300px] transition-all duration-300 transform hover:scale-[1.04] hover:-translate-y-2.5 hover:border-maze-gold hover:shadow-[0_0_20px_rgba(201,168,76,0.6)] ";
          
          if (isAnySelected) {
            if (isSelected) {
              cardClass += "selected-card-glow ";
            } else {
              cardClass += "deselected-card-fade ";
            }
          } else {
            cardClass += "animate-card-slide ";
          }

          return (
            <div
              key={opt.id}
              onClick={() => handleSelect(opt)}
              className={cardClass}
              style={{ animationDelay: isAnySelected ? '0ms' : `${cardIdx * 120}ms` }}
            >
              {/* Synergy matched visual badge indicator */}
              {synergyCount >= 1 && !isAnySelected && (
                <div className="absolute -top-3 px-3 py-1 bg-gradient-to-r from-maze-gold to-[#FFA500] text-maze-bg text-[8px] font-cinzel font-black rounded-full shadow-[0_0_10px_#C9A84C] animate-bounce tracking-widest z-10">
                  ⚡ SYNERGY BOOST ⚡
                </div>
              )}

              {/* Card Icon Header */}
              <div className="flex flex-col items-center">
                <div className="p-3 bg-maze-bg border border-slate-900 rounded-full mb-4 shadow-inner">
                  {getIcon(opt.type)}
                </div>
                <h3 className="text-lg font-cinzel font-bold text-maze-cream mb-2">
                  {opt.name}
                </h3>
                <p className="text-xs text-maze-silver/90 font-outfit leading-relaxed mt-2 px-2">
                  {opt.desc}
                </p>
              </div>

              {/* Build Synergy Indicator */}
              <div className="w-full mt-4 pt-3 border-t border-slate-900/60 flex items-center justify-between px-2">
                <span className="text-[10px] text-maze-silver flex items-center gap-1 font-semibold">
                  SYNERGY: <span className="text-maze-gold">{opt.synergy}</span>
                </span>
                
                {/* Synergy counter nodes */}
                <div className="flex gap-1">
                  {Array.from({ length: 3 }).map((_, idx) => (
                    <span
                      key={idx}
                      className={`w-2.5 h-1.5 rounded-sm block ${
                        idx < synergyCount + 1 
                          ? 'bg-maze-gold shadow-[0_0_5px_rgba(201,168,76,0.8)]' 
                          : 'bg-slate-950 border border-slate-900'
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* First Run Level Up Hint */}
      {showHint && (
        <div className="absolute top-6 left-1/2 -translate-x-1/2 z-[60] bg-slate-950/95 border-2 border-maze-gold px-5 py-2.5 rounded-xl shadow-[0_0_20px_rgba(201,168,76,0.6)] animate-bounce flex items-center gap-3 select-none pointer-events-auto backdrop-blur-md">
          <div className="text-left">
            <div className="text-[7px] font-cinzel font-black text-maze-gold tracking-widest leading-none">💡 TUTORIAL HINT</div>
            <div className="text-[12px] font-cinzel font-bold text-maze-cream tracking-wide mt-1">빌드를 선택해</div>
          </div>
          <button 
            onClick={() => {
              localStorage.setItem('maze_mace_first_run', 'done');
              setShowHint(false);
            }}
            className="text-[9px] font-outfit text-maze-accent hover:text-white uppercase font-bold tracking-widest border border-red-950 px-2 py-0.5 rounded bg-red-950/20 active:scale-95 transition-all ml-2"
          >
            Skip
          </button>
        </div>
      )}

      {/* Footer warning */}
      <div className="mt-8 text-[10px] text-maze-accent font-outfit uppercase tracking-widest animate-pulse">
        * 강화 선택 시 오염 코어가 안정화되며 즉시 미궁 탐색이 재개됩니다 *
      </div>
    </div>
  );
}
