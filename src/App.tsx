import { useEffect, useState } from 'react';
import TitleScreen from './components/TitleScreen';
import GameplayScreen from './components/GameplayScreen';
import LevelUpScreen from './components/LevelUpScreen';
import ResultScreen from './components/ResultScreen';
import { useSoundManager } from './hooks/useSoundManager';
import type { BuildId, RunRecords, RunStats, UpgradeOption, Difficulty, ScoreboardEntry } from './types/game';
import { calculateUpdatedRecords, DEFAULT_RECORDS, mergeRecords, loadScoreboard, saveScoreboard, addScoreboardEntry } from './domain/runRecords';
import { getRunRank } from './domain/runRank';
import { ACHIEVEMENTS } from './config/achievements';
import { getDailySeedAndRule } from './config/dailyChallenge';

interface WebAudioWindow extends Window {
  webkitAudioContext?: typeof AudioContext;
}

const loadRecordsForDifficulty = (diff: Difficulty): RunRecords => {
  let recordsKey = 'maze_mace_records';
  if (diff === 'hard') recordsKey = 'maze_mace_records_hard';
  else if (diff === 'extreme') recordsKey = 'maze_mace_records_extreme';

  try {
    const data = localStorage.getItem(recordsKey);
    if (data) {
      const parsed = JSON.parse(data);
      return mergeRecords(parsed);
    }
  } catch (e) {
    console.error('Error loading records', e);
  }
  return DEFAULT_RECORDS;
};

const saveRecordsForDifficulty = (diff: Difficulty, records: RunRecords) => {
  let recordsKey = 'maze_mace_records';
  if (diff === 'hard') recordsKey = 'maze_mace_records_hard';
  else if (diff === 'extreme') recordsKey = 'maze_mace_records_extreme';

  try {
    localStorage.setItem(recordsKey, JSON.stringify(records));
  } catch (e) {
    console.error('Error saving records', e);
  }
};

const getScreenFromHash = () => {
  const hash = window.location.hash.replace('#', '').toLowerCase();
  if (hash === 'gameplay') return 'GAMEPLAY';
  if (hash === 'levelup') return 'LEVELUP';
  if (hash === 'result') return 'RESULT';
  return 'START';
};

const demoStats = {
  score: 6840,
  kills: 17,
  roomsExpanded: 8,
  maxCombo: 9,
  contamination: 62,
  survivalTime: 392
};

const demoUpgrades: UpgradeOption[] = [
  {
    id: 'heavy_impact',
    name: 'Heavy Impact',
    desc: '넉백 증가',
    synergy: '⚡ POWER',
    type: 'power'
  },
  {
    id: 'maze_sense',
    name: 'Maze Sense',
    desc: '방 타입 예측',
    synergy: '⚡ MAP',
    type: 'map'
  }
];

export default function App() {
  const soundManager = useSoundManager('assets/bgm.mp3');
  const [currentScreen, setCurrentScreen] = useState<'START' | 'GAMEPLAY' | 'LEVELUP' | 'RESULT'>(getScreenFromHash);
  const [selectedBuild, setSelectedBuild] = useState<BuildId>('breaker');
  const [activeUpgrades, setActiveUpgrades] = useState<UpgradeOption[]>(
    () => (getScreenFromHash() === 'START' ? [] : demoUpgrades)
  );

  const [difficulty, setDifficulty] = useState<Difficulty>('normal');
  const [records, setRecords] = useState<RunRecords>(() => loadRecordsForDifficulty('normal'));
  const [isNewRecordBreak, setIsNewRecordBreak] = useState(false);
  const [unlockedAchievements, setUnlockedAchievements] = useState<string[]>([]);
  const [toasts, setToasts] = useState<{ id: string; name: string; desc: string; exiting?: boolean }[]>([]);
  const [scoreboard, setScoreboard] = useState<ScoreboardEntry[]>(() => loadScoreboard());
  const [isDailyChallenge, setIsDailyChallenge] = useState(false);
  const [dailySeed, setDailySeed] = useState(0);

  // Load records & achievements when difficulty changes
  useEffect(() => {
    const timer = setTimeout(() => {
      // 1. Records
      const loadedRecs = loadRecordsForDifficulty(difficulty);
      setRecords(loadedRecs);

      // 2. Achievements
      let achievementsKey = 'maze_mace_achievements';
      if (difficulty === 'hard') achievementsKey = 'maze_mace_achievements_hard';
      else if (difficulty === 'extreme') achievementsKey = 'maze_mace_achievements_extreme';

      try {
        const savedAchievements = localStorage.getItem(achievementsKey);
        if (savedAchievements) {
          setUnlockedAchievements(JSON.parse(savedAchievements));
        } else {
          setUnlockedAchievements([]);
        }
      } catch (e) {
        console.error('Error loading achievements', e);
        setUnlockedAchievements([]);
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [difficulty]);

  const playAchievementUnlockChime = () => {
    try {
      const AudioContextClass = window.AudioContext || (window as WebAudioWindow).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      const now = ctx.currentTime;
      
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.2, now + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 1.0);
      
      const osc1 = ctx.createOscillator();
      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(523.25, now); // C5
      osc1.frequency.setValueAtTime(659.25, now + 0.08); // E5
      osc1.frequency.setValueAtTime(783.99, now + 0.16); // G5
      osc1.frequency.setValueAtTime(1046.50, now + 0.24); // C6
      
      const osc2 = ctx.createOscillator();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(1046.50, now); // C6
      osc2.frequency.exponentialRampToValueAtTime(1567.98, now + 0.4); // G6
      
      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);
      
      osc1.start(now);
      osc1.stop(now + 1.0);
      osc2.start(now);
      osc2.stop(now + 1.0);
    } catch (e) {
      console.warn("Chime failed", e);
    }
  };

  const triggerUnlock = (id: string) => {
    setUnlockedAchievements(prev => {
      if (prev.includes(id)) return prev;
      const updated = [...prev, id];
      
      let achievementsKey = 'maze_mace_achievements';
      if (difficulty === 'hard') achievementsKey = 'maze_mace_achievements_hard';
      else if (difficulty === 'extreme') achievementsKey = 'maze_mace_achievements_extreme';

      try {
        localStorage.setItem(achievementsKey, JSON.stringify(updated));
      } catch (e) {
        console.error('Failed to save achievements', e);
      }
      
      const ach = ACHIEVEMENTS.find(a => a.id === id);
      if (ach) {
        playAchievementUnlockChime();
        const toastId = Math.random().toString();
        setToasts(t => [...t, { id: toastId, name: ach.name, desc: ach.desc }]);
        
        setTimeout(() => {
          setToasts(t => t.map(x => x.id === toastId ? { ...x, exiting: true } : x));
        }, 3200);

        setTimeout(() => {
          setToasts(t => t.filter(x => x.id !== toastId));
        }, 3600);
      }
      
      return updated;
    });
  };
  
  // Performance metrics report state
  const [stats, setStats] = useState<RunStats>({
    ...(getScreenFromHash() === 'RESULT' ? { ...demoStats, victory: false } : {
      score: 0,
      kills: 0,
      roomsExpanded: 1,
      maxCombo: 0,
      contamination: 0,
      survivalTime: 0,
      victory: false
    })
  });

  useEffect(() => {
    const syncFromHash = () => {
      const nextScreen = getScreenFromHash();
      setCurrentScreen(nextScreen);

      if (nextScreen === 'START') {
        setActiveUpgrades([]);
        return;
      }

      setActiveUpgrades(demoUpgrades);
      if (nextScreen === 'RESULT') {
        setStats(demoStats);
      }
    };

    window.addEventListener('hashchange', syncFromHash);
    syncFromHash();
    return () => window.removeEventListener('hashchange', syncFromHash);
  }, []);

  // Global user interaction listener to initialize Web Audio API
  useEffect(() => {
    const handleGesture = () => {
      soundManager.init();
      window.removeEventListener('click', handleGesture);
      window.removeEventListener('keydown', handleGesture);
    };
    window.addEventListener('click', handleGesture);
    window.addEventListener('keydown', handleGesture);
    return () => {
      window.removeEventListener('click', handleGesture);
      window.removeEventListener('keydown', handleGesture);
    };
  }, [soundManager]);

  // BGM playback state machine based on current active screen
  useEffect(() => {
    if (currentScreen === 'GAMEPLAY') {
      soundManager.startBgm();
      soundManager.setPausedFilter(false);
    } else if (currentScreen === 'LEVELUP') {
      soundManager.setPausedFilter(true);
    } else {
      soundManager.stopBgm();
    }
  }, [currentScreen, soundManager]);

  const handleStartGame = (challengeMode = false) => {
    soundManager.init();
    soundManager.startBgm();
    setActiveUpgrades([]);
    setIsDailyChallenge(challengeMode);
    if (challengeMode) {
      const challengeInfo = getDailySeedAndRule(new Date());
      setDailySeed(challengeInfo.seed);
    } else {
      setDailySeed(0);
    }
    setStats({
      score: 0,
      kills: 0,
      roomsExpanded: 1,
      maxCombo: 0,
      contamination: 0,
      survivalTime: 0
    });
    window.location.hash = 'gameplay';
    setCurrentScreen('GAMEPLAY');
  };

  const handleLevelUpTrigger = () => {
    soundManager.playLevelUp();
    window.location.hash = 'levelup';
    setCurrentScreen('LEVELUP');
  };

  const handleSelectUpgrade = (upg: UpgradeOption) => {
    setActiveUpgrades(prev => [...prev, upg]);
    window.location.hash = 'gameplay';
    setCurrentScreen('GAMEPLAY');
  };

  const handleGameOver = (finalStats: RunStats) => {
    setStats(finalStats);
    
    // Save record to localStorage
    const currentRecords = loadRecordsForDifficulty(difficulty);
    
    const { records: updatedRecords, isNewRecord } = calculateUpdatedRecords(
      currentRecords,
      selectedBuild,
      finalStats
    );
    
    saveRecordsForDifficulty(difficulty, updatedRecords);
    setRecords(updatedRecords);
    
    setIsNewRecordBreak(isNewRecord);

    // Save to scoreboard
    const { rank } = getRunRank(finalStats.score, finalStats.victory, finalStats.contamination);
    setScoreboard(prev => {
      const challengeInfo = isDailyChallenge ? getDailySeedAndRule(new Date()) : null;
      const updated = addScoreboardEntry(
        {
          score: finalStats.score,
          rank: rank,
          build: selectedBuild,
          difficulty: difficulty,
          survivalTime: finalStats.survivalTime,
          kills: finalStats.kills,
          maxCombo: finalStats.maxCombo,
          isDaily: isDailyChallenge,
          dailyRuleId: challengeInfo?.rule.id
        },
        prev
      );
      saveScoreboard(updated);
      return updated;
    });

    // Achievements verification on Game Over / Victory
    if (finalStats.victory) {
      // 1. 사망 없이 클리어 (Immortal Conqueror)
      triggerUnlock('clearNoDeath');

      // 2. 모든 빌드 1회 이상 클리어 (Labyrinth Master)
      try {
        let clearedBuildsKey = 'maze_mace_cleared_builds';
        if (difficulty === 'hard') clearedBuildsKey = 'maze_mace_cleared_builds_hard';
        else if (difficulty === 'extreme') clearedBuildsKey = 'maze_mace_cleared_builds_extreme';

        const savedClearedBuilds = localStorage.getItem(clearedBuildsKey);
        const currentCleared: string[] = savedClearedBuilds ? JSON.parse(savedClearedBuilds) : [];
        if (!currentCleared.includes(selectedBuild)) {
          const updatedCleared = [...currentCleared, selectedBuild];
          localStorage.setItem(clearedBuildsKey, JSON.stringify(updatedCleared));
          
          const allBuilds = ['breaker', 'striker', 'cartographer', 'guardian'];
          if (allBuilds.every(b => updatedCleared.includes(b))) {
            triggerUnlock('allBuildsClear');
          }
        } else {
          const allBuilds = ['breaker', 'striker', 'cartographer', 'guardian'];
          if (allBuilds.every(b => currentCleared.includes(b))) {
            triggerUnlock('allBuildsClear');
          }
        }
      } catch (e) {
        console.error('Error handling cleared builds tracking', e);
      }

      // 3. Extreme clear exclusive achievement
      if (difficulty === 'extreme') {
        triggerUnlock('clearExtreme');
      }
    }
    
    window.location.hash = 'result';
    setCurrentScreen('RESULT');
  };

  const handleRetry = () => {
    window.location.hash = 'start';
    setCurrentScreen('START');
  };

  return (
    <div className="w-screen h-screen bg-maze-bg text-maze-text overflow-hidden select-none">
      
      {/* Toast Notification Container */}
      <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-3 pointer-events-none">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`pointer-events-auto bg-slate-950/95 border border-maze-gold/45 shadow-gold-glow-lg rounded-xl p-3.5 w-[310px] flex gap-3.5 relative overflow-hidden backdrop-blur-md transition-all duration-300 ${
              toast.exiting ? 'animate-slide-out-right' : 'animate-slide-in-right'
            }`}
          >
            {/* Achievement Icon / Badge */}
            <div className="w-11 h-11 shrink-0 rounded-lg bg-maze-gold/15 border border-maze-gold/50 flex items-center justify-center text-maze-gold text-lg shadow-inner">
              🏅
            </div>
            {/* Text */}
            <div className="flex flex-col text-left justify-center">
              <span className="text-[9px] text-maze-gold tracking-[0.2em] font-black uppercase font-cinzel">ACHIEVEMENT UNLOCKED</span>
              <span className="text-xs font-bold text-white mt-0.5 font-outfit">{toast.name}</span>
              <span className="text-[10px] text-maze-silver mt-1.5 leading-normal font-outfit font-semibold">{toast.desc}</span>
            </div>
          </div>
        ))}
      </div>

      {currentScreen === 'START' && (
        <TitleScreen
          selectedBuild={selectedBuild}
          setSelectedBuild={setSelectedBuild}
          onStartGame={handleStartGame}
          records={records}
          unlockedAchievements={unlockedAchievements}
          difficulty={difficulty}
          setDifficulty={setDifficulty}
          scoreboard={scoreboard}
          setScoreboard={setScoreboard}
        />
      )}

      {(currentScreen === 'GAMEPLAY' || currentScreen === 'LEVELUP') && (
        <div className="relative w-full h-full">
          <GameplayScreen
            selectedBuild={selectedBuild}
            activeUpgrades={activeUpgrades}
            isPaused={currentScreen === 'LEVELUP'}
            isCaptureMode={window.location.hash === '#gameplay' || window.location.hash === '#levelup'}
            onLevelUp={handleLevelUpTrigger}
            onGameOver={handleGameOver}
            soundManager={soundManager}
            onUnlockAchievement={triggerUnlock}
            difficulty={difficulty}
            isDailyChallenge={isDailyChallenge}
            dailySeed={dailySeed}
          />
          
          {currentScreen === 'LEVELUP' && (
            <LevelUpScreen
              onSelectUpgrade={handleSelectUpgrade}
              activeUpgrades={activeUpgrades}
            />
          )}
        </div>
      )}

      {currentScreen === 'RESULT' && (
        <ResultScreen
          score={stats.score}
          kills={stats.kills}
          roomsExpanded={stats.roomsExpanded}
          maxCombo={stats.maxCombo}
          contamination={stats.contamination}
          survivalTime={stats.survivalTime}
          victory={stats.victory}
          activeUpgrades={activeUpgrades}
          onRetry={handleRetry}
          isNewRecord={isNewRecordBreak}
          isDailyChallenge={isDailyChallenge}
          dailySeed={dailySeed}
          selectedBuild={selectedBuild}
        />
      )}

    </div>
  );
}
export type { UpgradeOption };
