import { useState, useEffect, useRef } from 'react';
import { gameConfig } from '../config/gameConfig';
import MiniMap from './MiniMap';
import PlayerSprite from '../sprites/PlayerSprite';
import CrawlerSprite from '../sprites/CrawlerSprite';
import WardenSprite from '../sprites/WardenSprite';
import StalkerSprite from '../sprites/StalkerSprite';
import ExpansionModuleSprite from '../sprites/ExpansionModuleSprite';
import ChestSprite from '../sprites/ChestSprite';
import PortalSprite from '../sprites/PortalSprite';
import type { SoundManager } from '../hooks/useSoundManager';
import { getNextRoomType, getRoomTarget, shouldSpawnBossRoom } from '../domain/rooms';
import { getDailySeedAndRule, getDailyRoomType, getSeededRandomForRoom } from '../config/dailyChallenge';
import type { BuildId, RoomNode, RoomType, RunStats, UpgradeOption, Difficulty } from '../types/game';

interface WebAudioWindow extends Window {
  webkitAudioContext?: typeof AudioContext;
}

interface GameplayScreenProps {
  selectedBuild: BuildId;
  activeUpgrades: UpgradeOption[];
  isPaused?: boolean;
  isCaptureMode?: boolean;
  onLevelUp: (currentLevel: number) => void;
  onGameOver: (finalStats: RunStats) => void;
  soundManager?: SoundManager;
  onUnlockAchievement?: (id: string) => void;
  difficulty: Difficulty;
  isDailyChallenge?: boolean;
  dailySeed?: number;
}


interface Enemy {
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  baseSpeed: number;
  damage: number;
  isKnocked: boolean;
  kbX: number;
  kbY: number;
  kbPower: number;
  kbTimer: number;
  attackCooldown: number;
  attackRange: number;
  angle: number;
  type: 'crawler' | 'warden' | 'stalker';
  isElite?: boolean;
  isBoss?: boolean;
  warningTimer?: number;
  isMini?: boolean;
  isEnraged?: boolean;
  chargeState?: 'prep' | 'dash' | 'recovery';
  chargeTimer?: number;
  chargeCooldown?: number;
  chargeVx?: number;
  chargeVy?: number;
  teleportState?: 'prep';
  teleportTimer?: number;
  teleportCooldown?: number;
  teleportX?: number;
  teleportY?: number;
  teleportTarget?: { x: number; y: number };
  slowTimer?: number;
  bossPhase?: number;
  isShielding?: boolean;
  shieldTimer?: number;
  shieldCooldown?: number;
  phase2Triggered?: boolean;
  pulseTimer?: number;
  attackTimer?: number;
}

interface EnvObject {
  id: string;
  type: 'pillar' | 'pool' | 'wall' | 'shortcut_portal' | 'crystal' | 'nest';
  x: number;
  y: number;
  hp?: number;
  maxHp?: number;
  active: boolean;
  cooldown?: number;
  lastSpawnTime?: number;
}

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  alpha: number;
  size: number;
  decay: number;
  type: 'blood' | 'spark' | 'dust' | 'shockwave' | 'gold-item' | 'shield-shard';
  maxSize?: number;
  growth?: number;
  rotation?: number;
  rotSpeed?: number;
}

interface FloatText {
  x: number;
  y: number;
  text: string;
  color: string;
  alpha: number;
}

interface ExpansionModule {
  x: number;
  y: number;
  dir: 'N' | 'S' | 'E' | 'W';
  active: boolean;
  isHit?: boolean;
}

export default function GameplayScreen({
  selectedBuild,
  activeUpgrades,
  isPaused,
  isCaptureMode = false,
  onLevelUp,
  onGameOver,
  soundManager,
  onUnlockAchievement,
  difficulty,
  isDailyChallenge = false,
  dailySeed = 0
}: GameplayScreenProps) {

  const dailyRule = isDailyChallenge && dailySeed ? getDailySeedAndRule(new Date()).rule : null;
  const dailyRuleRef = useRef(dailyRule);
  useEffect(() => {
    dailyRuleRef.current = dailyRule;
  }, [dailyRule]);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [spriteScale, setSpriteScale] = useState({ x: 1, y: 1 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const update = () => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setSpriteScale({ x: rect.width / 600, y: rect.height / 420 });
      }
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, []);

  const lightCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const pausedRef = useRef(isPaused);
  const onLevelUpRef = useRef(onLevelUp);
  const onGameOverRef = useRef(onGameOver);
  const soundManagerRef = useRef(soundManager);
  const onUnlockAchievementRef = useRef(onUnlockAchievement);
  const initialHp = isCaptureMode ? 82 : 100;
  const initialStamina = isCaptureMode ? 68 : 100;
  const initialExp = isCaptureMode ? 76 : 0;
  const initialLevel = isCaptureMode ? 3 : 1;
  const initialScore = isCaptureMode ? 1840 : 0;
  const initialContamination = isCaptureMode ? 38 : 0;
  const initialSurvivalTime = isCaptureMode ? 134 : 0;

  // --- Performance / Low-Spec State & Refs ---
  const [isLowSpec, setIsLowSpec] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('maze_mace_lowspec') === 'true';
  });

  const isLowSpecRef = useRef(isLowSpec);
  useEffect(() => {
    isLowSpecRef.current = isLowSpec;
  }, [isLowSpec]);

  const toggleLowSpec = () => {
    setIsLowSpec(prev => {
      const next = !prev;
      localStorage.setItem('maze_mace_lowspec', String(next));
      return next;
    });
  };

  // --- Accessibility Options States & Refs ---
  const [colorblindMode, setColorblindMode] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('maze_mace_accessibility_colorblind') === 'true';
  });
  const colorblindModeRef = useRef(colorblindMode);
  useEffect(() => {
    colorblindModeRef.current = colorblindMode;
  }, [colorblindMode]);

  const [disableScreenshake, setDisableScreenshake] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('maze_mace_accessibility_noshake') === 'true';
  });
  const disableScreenshakeRef = useRef(disableScreenshake);
  useEffect(() => {
    disableScreenshakeRef.current = disableScreenshake;
  }, [disableScreenshake]);

  const [reduceParticles, setReduceParticles] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('maze_mace_accessibility_lowparticles') === 'true';
  });
  const reduceParticlesRef = useRef(reduceParticles);
  useEffect(() => {
    reduceParticlesRef.current = reduceParticles;
  }, [reduceParticles]);

  const [textSize, setTextSize] = useState<'normal' | 'large'>(() => {
    if (typeof window === 'undefined') return 'normal';
    return (localStorage.getItem('maze_mace_accessibility_textsize') as 'normal' | 'large') || 'normal';
  });
  const textSizeRef = useRef(textSize);
  useEffect(() => {
    textSizeRef.current = textSize;
  }, [textSize]);

  const [highContrastMode, setHighContrastMode] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('maze_mace_accessibility_highcontrast') === 'true';
  });
  const highContrastModeRef = useRef(highContrastMode);
  useEffect(() => {
    highContrastModeRef.current = highContrastMode;
  }, [highContrastMode]);

  const [autoAimAssist, setAutoAimAssist] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('maze_mace_accessibility_autoaim') === 'true';
  });
  const autoAimAssistRef = useRef(autoAimAssist);
  useEffect(() => {
    autoAimAssistRef.current = autoAimAssist;
  }, [autoAimAssist]);

  const handleToggleColorblind = () => {
    setColorblindMode(prev => {
      const next = !prev;
      localStorage.setItem('maze_mace_accessibility_colorblind', String(next));
      return next;
    });
  };

  const handleToggleScreenshake = () => {
    setDisableScreenshake(prev => {
      const next = !prev;
      localStorage.setItem('maze_mace_accessibility_noshake', String(next));
      return next;
    });
  };

  const handleToggleReduceParticles = () => {
    setReduceParticles(prev => {
      const next = !prev;
      localStorage.setItem('maze_mace_accessibility_lowparticles', String(next));
      return next;
    });
  };

  const handleToggleTextSize = () => {
    setTextSize(prev => {
      const next = prev === 'normal' ? 'large' : 'normal';
      localStorage.setItem('maze_mace_accessibility_textsize', next);
      return next;
    });
  };

  const handleToggleHighContrast = () => {
    setHighContrastMode(prev => {
      const next = !prev;
      localStorage.setItem('maze_mace_accessibility_highcontrast', String(next));
      return next;
    });
  };

  const handleToggleAutoAim = () => {
    setAutoAimAssist(prev => {
      const next = !prev;
      localStorage.setItem('maze_mace_accessibility_autoaim', String(next));
      return next;
    });
  };

  const fpsVal = useRef(60);
  const lastFpsTime = useRef(0);
  const frames = useRef(0);


  // --- Stage Progression System States & Refs ---
  const [currentStage, setCurrentStage] = useState(1);
  const currentStageRef = useRef(1);
  useEffect(() => {
    currentStageRef.current = currentStage;
  }, [currentStage]);

  const [isTransitioningStage, setIsTransitioningStage] = useState(false);
  const isTransitioningStageRef = useRef(false);
  useEffect(() => {
    isTransitioningStageRef.current = isTransitioningStage;
  }, [isTransitioningStage]);

  const stageRoomsCount = useRef(1); // Counts rooms explored in the active stage

  // --- Real-time Local States for HUD ---
  const [hp, setHp] = useState(initialHp);
  const [stamina, setStamina] = useState(initialStamina);
  const [exp, setExp] = useState(initialExp);
  const maxExp = 100;
  const [level, setLevel] = useState(initialLevel);
  const [score, setScore] = useState(initialScore);
  const [contamination, setContamination] = useState(initialContamination);
  const [weaponLevel, setWeaponLevel] = useState(1);
  const weaponLevelRef = useRef(1);
  useEffect(() => {
    weaponLevelRef.current = weaponLevel;
  }, [weaponLevel]);

  // States for upgrade collection toast notifications
  const [toastUpgrade, setToastUpgrade] = useState<UpgradeOption | null>(null);
  const [toastUpgradeKey, setToastUpgradeKey] = useState(0);

  // States for SVG overlays position sync
  const [overlayPlayer, setOverlayPlayer] = useState({
    x: 300,
    y: 210,
    isMoving: false,
    isAttacking: false,
    dashTimer: 0,
    history: [] as { x: number; y: number; isMoving: boolean; isAttacking: boolean }[]
  });
  const [overlayEnemies, setOverlayEnemies] = useState<{
    x: number;
    y: number;
    isHit: boolean;
    isMoving: boolean;
    type: 'crawler' | 'warden' | 'stalker';
    isElite?: boolean;
    isBoss?: boolean;
    warningTimer?: number;
    isMini?: boolean;
    isEnraged?: boolean;
    chargeState?: 'prep' | 'dash' | 'recovery';
    teleportState?: 'prep';
    isSlowed?: boolean;
    isShielding?: boolean;
  }[]>([]);
  const [isBlackout, setIsBlackout] = useState(false);
  const [overlayModules, setOverlayModules] = useState<ExpansionModule[]>([]);
  const [overlayChest, setOverlayChest] = useState<{ x: number; y: number; opened: boolean } | null>(null);
  const [overlayPortal, setOverlayPortal] = useState<{ x: number; y: number; active: boolean } | null>(null);
  const [shakeType, setShakeType] = useState<'none' | 'weak' | 'medium' | 'strong' | 'slam'>('none');
  
  // Boss Visual states
  const [activeBoss, setActiveBoss] = useState<{ name: string; hp: number; maxHp: number; phase: number } | null>(null);
  const [bossNameSplash, setBossNameSplash] = useState<string | null>(null);
  const [bossSubtext, setBossSubtext] = useState<string>('');
  const [showBossNameSplash, setShowBossNameSplash] = useState(false);
  const [bossPhase2Flash, setBossPhase2Flash] = useState(false);
  const [isVictoryCinematic, setIsVictoryCinematic] = useState(false);
  const [victoryStep, setVictoryStep] = useState<'none' | 'whiteout' | 'purifying' | 'exit_run' | 'done'>('none');
  const [visualContamination, setVisualContamination] = useState(0);
  const isVictoryRef = useRef(false);
  
  // Minimap toggles & fullscreen views
  const [minimapVisible, setMinimapVisible] = useState(true);
  const [isFullMapOpen, setIsFullMapOpen] = useState(false);
  const isFullMapOpenRef = useRef(isFullMapOpen);
  useEffect(() => {
    isFullMapOpenRef.current = isFullMapOpen;
  }, [isFullMapOpen]);

  const [isLocalPaused, setIsLocalPaused] = useState(false);
  const [showGiveUpConfirm, setShowGiveUpConfirm] = useState(false);
  const isLocalPausedRef = useRef(isLocalPaused);
  useEffect(() => {
    isLocalPausedRef.current = isLocalPaused;
  }, [isLocalPaused]);

  // Mobile virtual joystick & touch detection states
  const [isTouchDevice, setIsTouchDevice] = useState(() => {
    if (typeof window === 'undefined') return false;
    return ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
  });
  const [joystickPos, setJoystickPos] = useState({ x: 0, y: 0 });
  const joystickCenterRef = useRef({ x: 0, y: 0 });
  const joystickContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleFirstTouch = () => {
      setIsTouchDevice(true);
      window.removeEventListener('touchstart', handleFirstTouch);
    };
    window.addEventListener('touchstart', handleFirstTouch);
    return () => window.removeEventListener('touchstart', handleFirstTouch);
  }, []);

  const maxHp = 100 + activeUpgrades.filter(u => u.id === 'maze_sense').length * 15;
  const maxStamina = 100 + activeUpgrades.filter(u => u.id === 'stamina_flow').length * 10;
  
  // Combos
  const [combo, setCombo] = useState(isCaptureMode ? 4 : 0);
  const maxComboRef = useRef(isCaptureMode ? 4 : 0);
  
  const [personalBestCombo] = useState(() => {
    try {
      const saved = localStorage.getItem('maze_mace_records');
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.highestCombo || 0;
      }
    } catch (e) {
      console.error(e);
    }
    return 0;
  });

  const [brokenCombo, setBrokenCombo] = useState<number | null>(null);
  
  // --- Special Skill States ---
  const [skillCooldown, setSkillCooldown] = useState(0);
  const skillMaxCooldown = selectedBuild === 'breaker' ? 8000 : selectedBuild === 'striker' ? 5000 : selectedBuild === 'guardian' ? 6000 : 6000;
  const skillTriggered = useRef(false);

  const [isComboBrokenBlackout, setIsComboBrokenBlackout] = useState(false);
  const [comboExplosionText, setComboExplosionText] = useState<string | null>(null);
  const [comboExplosionKey, setComboExplosionKey] = useState(0);

  const [isExhausted, setIsExhausted] = useState(false);
  const isExhaustedRef = useRef(false);
  const [isStaminaGoldFlashing, setIsStaminaGoldFlashing] = useState(false);
  const [showGoldFlash, setShowGoldFlash] = useState(false);
  const [showStatsHUD, setShowStatsHUD] = useState(false);
  const [kills, setKills] = useState(isCaptureMode ? 6 : 0);
  const [maxCombo, setMaxCombo] = useState(isCaptureMode ? 4 : 0);
  const recoveryDurationRef = useRef(0);
  const lastHealTickTimeRef = useRef(0);
  const recoveryCompletedRef = useRef(false);
  const triggeredGoldFlashRef = useRef(false);

  // States for game polish notifications
  const [roomPurifySplash, setRoomPurifySplash] = useState(false);
  const [corruptionWarningSplash, setCorruptionWarningSplash] = useState<string | null>(null);
  const lastFrameHasEnemies = useRef(false);
  const milestoneWarningsRef = useRef<{ [key: string]: boolean }>({
    p25: false,
    p50: false,
    p75: false,
    p90: false
  });

  const [showIntro, setShowIntro] = useState(true);
  const showIntroRef = useRef(true);
  const [isIntroFading, setIsIntroFading] = useState(false);
  const [isDead, setIsDead] = useState(false);
  const isDeadRef = useRef(false);

  useEffect(() => {
    isExhaustedRef.current = isExhausted;
  }, [isExhausted]);

  useEffect(() => {
    showIntroRef.current = showIntro;
  }, [showIntro]);

  useEffect(() => {
    isDeadRef.current = isDead;
  }, [isDead]);

  const [tutorialHint, setTutorialHint] = useState<string | null>(null);
  const [isTutorialSkipped, setIsTutorialSkipped] = useState(() => localStorage.getItem('maze_mace_first_run') !== null);
  const isTutorialSkippedRef = useRef(isTutorialSkipped);
  const shownHints = useRef<Set<string>>(new Set());
  const tutorialTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    isTutorialSkippedRef.current = isTutorialSkipped;
  }, [isTutorialSkipped]);

  useEffect(() => {
    if (!isPaused) {
      const skipped = localStorage.getItem('maze_mace_first_run') !== null;
      if (skipped) {
        const timer = setTimeout(() => {
          setIsTutorialSkipped(true);
          setTutorialHint(null);
        }, 0);
        return () => clearTimeout(timer);
      }
    }
  }, [isPaused]);

  const triggerTutorialHintRef = useRef<(text: string) => void>(() => {});
  useEffect(() => {
    triggerTutorialHintRef.current = (text: string) => {
      if (localStorage.getItem('maze_mace_first_run') !== null) return;
      if (isTutorialSkippedRef.current) return;
      if (shownHints.current.has(text)) return;
      
      shownHints.current.add(text);
      setTutorialHint(text);
      
      if (tutorialTimeoutRef.current) {
        clearTimeout(tutorialTimeoutRef.current);
      }
      tutorialTimeoutRef.current = setTimeout(() => {
        setTutorialHint(null);
      }, 3000);
    };
  }, []);

  // Run start intro timer
  useEffect(() => {
    const fadeTimer = setTimeout(() => {
      setIsIntroFading(true);
      const endTimer = setTimeout(() => {
        setShowIntro(false);
      }, 1000); // 1s fade-out duration
      return () => clearTimeout(endTimer);
    }, 2000); // 2s show duration

    return () => clearTimeout(fadeTimer);
  }, []);

  // Trigger WASD hint when intro fades out
  useEffect(() => {
    if (!showIntro && !isTutorialSkipped) {
      triggerTutorialHintRef.current("WASD로 이동해");
    }
  }, [showIntro, isTutorialSkipped]);

  // Animation triggers for UI elements
  const prevContamRef = useRef(contamination);
  const [isContamShaking, setIsContamShaking] = useState(false);
  const prevComboRef = useRef(combo);
  const [isComboPopping, setIsComboPopping] = useState(false);

  useEffect(() => {
    if (contamination > prevContamRef.current) {
      setIsContamShaking(true);
      const timer = setTimeout(() => setIsContamShaking(false), 300);
      
      // Contamination Warning Milestones (25%, 50%, 75%, 90%)
      if (contamination >= 90 && !milestoneWarningsRef.current.p90) {
        milestoneWarningsRef.current.p25 = true;
        milestoneWarningsRef.current.p50 = true;
        milestoneWarningsRef.current.p75 = true;
        milestoneWarningsRef.current.p90 = true;
        setCorruptionWarningSplash('THE HEART IS WATCHING');
        const t = setTimeout(() => setCorruptionWarningSplash(null), 1500);
        prevContamRef.current = contamination;
        return () => {
          clearTimeout(timer);
          clearTimeout(t);
        };
      } else if (contamination >= 75 && !milestoneWarningsRef.current.p75) {
        milestoneWarningsRef.current.p25 = true;
        milestoneWarningsRef.current.p50 = true;
        milestoneWarningsRef.current.p75 = true;
        setCorruptionWarningSplash('YOUR VISION NARROWS');
        const t = setTimeout(() => setCorruptionWarningSplash(null), 1500);
        prevContamRef.current = contamination;
        return () => {
          clearTimeout(timer);
          clearTimeout(t);
        };
      } else if (contamination >= 50 && !milestoneWarningsRef.current.p50) {
        milestoneWarningsRef.current.p25 = true;
        milestoneWarningsRef.current.p50 = true;
        setCorruptionWarningSplash('CORRUPTION DEEPENS');
        const t = setTimeout(() => setCorruptionWarningSplash(null), 1500);
        prevContamRef.current = contamination;
        return () => {
          clearTimeout(timer);
          clearTimeout(t);
        };
      } else if (contamination >= 25 && !milestoneWarningsRef.current.p25) {
        milestoneWarningsRef.current.p25 = true;
        setCorruptionWarningSplash('THE MAZE BREATHES');
        const t = setTimeout(() => setCorruptionWarningSplash(null), 1500);
        prevContamRef.current = contamination;
        return () => {
          clearTimeout(timer);
          clearTimeout(t);
        };
      }

      prevContamRef.current = contamination;
      return () => clearTimeout(timer);
    }
    prevContamRef.current = contamination;
  }, [contamination]);

  useEffect(() => {
    if (combo > prevComboRef.current) {
      setIsComboPopping(true);
      const timer = setTimeout(() => setIsComboPopping(false), 200);
      prevComboRef.current = combo;
      return () => clearTimeout(timer);
    }
    prevComboRef.current = combo;
  }, [combo]);

  useEffect(() => {
    if (comboExplosionText) {
      const timer = setTimeout(() => {
        setComboExplosionText(null);
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [comboExplosionText, comboExplosionKey]);

  // Time tracker
  const survivalTimeRef = useRef(initialSurvivalTime);
  const [displayTime, setDisplayTime] = useState(isCaptureMode ? '02:14' : '00:00');

  // Room announcement banner
  const [bannerText, setBannerText] = useState(isCaptureMode ? 'COMBAT ZONE DISCOVERED' : 'STARTING ZONE');
  const [bannerColor, setBannerColor] = useState(isCaptureMode ? 'text-maze-accent' : 'text-maze-gold');
  const [bannerVisible, setBannerVisible] = useState(true);

  // Active room tracking
  const [rooms, setRooms] = useState<RoomNode[]>(() => isCaptureMode ? [
    { x: 0, y: 0, type: 'START', explored: true, cleared: true },
    { x: 1, y: 0, type: 'COMBAT', explored: true, cleared: false },
    { x: 0, y: -1, type: 'REWARD', explored: true, cleared: true },
    { x: -1, y: 0, type: 'HAZARD', explored: true, cleared: false },
    { x: 1, y: -1, type: 'COMBAT', explored: true, cleared: false }
  ] : [
    { x: 0, y: 0, type: 'START', explored: true, cleared: true }
  ]);
  const roomsRef = useRef(rooms);
  const [currentRoom, setCurrentRoom] = useState(isCaptureMode ? { x: 1, y: 0 } : { x: 0, y: 0 });

  // References for game loop variables
  const keysPressed = useRef<{ [key: string]: boolean }>({});
  const triggerInteractionRef = useRef<(() => void) | null>(null);
  const mousePos = useRef({ x: 0, y: 0 });
  const mouseClicked = useRef(false);
  const interactRequested = useRef(false);

  // Mobile controller references
  const touchDirection = useRef({ x: 0, y: 0 });
  const touchActive = useRef(false);

  // Game stats to report on death
  const killsCount = useRef(isCaptureMode ? 6 : 0);
  const roomsExpandedCount = useRef(isCaptureMode ? 5 : 1);

  // Sync upgrades with variables & trigger top toast notifications
  const upgradesRef = useRef<UpgradeOption[]>([]);
  const prevUpgradesCount = useRef(activeUpgrades.length);

  useEffect(() => {
    upgradesRef.current = activeUpgrades;
    if (activeUpgrades.length > prevUpgradesCount.current) {
      const newUpgrade = activeUpgrades[activeUpgrades.length - 1];
      setToastUpgrade(newUpgrade);
      setToastUpgradeKey(prev => prev + 1);
    }
    prevUpgradesCount.current = activeUpgrades.length;
  }, [activeUpgrades]);

  useEffect(() => {
    if (toastUpgrade) {
      const timer = setTimeout(() => {
        setToastUpgrade(null);
      }, 3300);
      return () => clearTimeout(timer);
    }
  }, [toastUpgrade, toastUpgradeKey]);

  useEffect(() => {
    pausedRef.current = isPaused || isLocalPaused;
    if (isPaused || isLocalPaused) {
      soundManager?.setPausedFilter(true);
    } else {
      soundManager?.setPausedFilter(false);
    }
  }, [isPaused, isLocalPaused, soundManager]);

  useEffect(() => {
    onLevelUpRef.current = onLevelUp;
    onGameOverRef.current = onGameOver;
    onUnlockAchievementRef.current = onUnlockAchievement;
  }, [onLevelUp, onGameOver, onUnlockAchievement]);

  useEffect(() => {
    soundManagerRef.current = soundManager;
  }, [soundManager]);

  useEffect(() => {
    roomsRef.current = rooms;
  }, [rooms]);

  // Handle Banner fadeout
  useEffect(() => {
    if (bannerVisible) {
      const timer = setTimeout(() => setBannerVisible(false), 2200);
      return () => clearTimeout(timer);
    }
  }, [bannerVisible]);

  // Sync contamination with sound manager
  useEffect(() => {
    soundManager?.setContaminationEffect(contamination);
  }, [contamination, soundManager]);

  // Main game loop initialization
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas dimensions
    canvas.width = 600;
    canvas.height = 420;

    const lightCanvas = lightCanvasRef.current;
    const lightCtx = lightCanvas ? lightCanvas.getContext('2d') : null;
    if (lightCanvas) {
      lightCanvas.width = 600;
      lightCanvas.height = 420;
    }

    const torches = [
      { x: 90, y: 75 },
      { x: 510, y: 75 },
      { x: 90, y: 345 },
      { x: 510, y: 345 }
    ];

    let hitStopTimer = 0;
    let shakeTimeoutId: ReturnType<typeof setTimeout> | null = null;
    const triggerShake = (type: 'weak' | 'medium' | 'strong' | 'slam') => {
      if (disableScreenshakeRef.current) return;
      if (shakeTimeoutId) clearTimeout(shakeTimeoutId);
      setShakeType(type);
      const duration = type === 'weak' ? 120 : type === 'medium' ? 180 : type === 'strong' ? 250 : 300;
      shakeTimeoutId = setTimeout(() => {
        setShakeType('none');
      }, duration);
    };

    // --- GAME ACTORS ---
    // Player definition
    const player = {
      x: canvas.width / 2,
      y: canvas.height / 2,
      radius: 14,
      speed: selectedBuild === 'striker' ? 3.6 : selectedBuild === 'breaker' ? 2.4 : selectedBuild === 'guardian' ? 2.8 : 3.0,
      attackCooldown: 0,
      dashCooldown: 0,
      dashTimer: 0,
      invulnTimer: 0,
      // Swing arc parameters
      isSwinging: false,
      swingStart: 0,
      swingEnd: 0,
      swingProgress: 0,
      swingRadius: selectedBuild === 'striker' ? 52 : selectedBuild === 'breaker' ? 62 : selectedBuild === 'guardian' ? 72 : 46,
      swingAngle: 0,
      shieldFlashTimer: 0,
      shieldShatterTimer: 0
    };

    let localHp = initialHp;
    let localStamina = initialStamina;
    let localExp = initialExp;
    let localLevel = initialLevel;
    let localScore = initialScore;
    let localContamination = initialContamination;
    let localCombo = isCaptureMode ? 4 : 0;
    let localCurrentRoom = isCaptureMode ? { x: 1, y: 0 } : { x: 0, y: 0 };
    let localSkillCooldown = 0;

    // Enemies group
    let enemies: Enemy[] = [];
    // Environmental objects
    let envObjects: EnvObject[] = [];
    // Spark particles
    let sparks: Spark[] = [];
    // Damage numbers
    let floatTexts: FloatText[] = [];
    // Active Heart pulses shockwaves
    let activeShockwaves: { x: number; y: number; radius: number; speed: number; damageDealt: boolean }[] = [];
    // Player coordinate history (for Swift armor afterimages)
    const playerHistory: { x: number; y: number; isMoving: boolean; isAttacking: boolean }[] = [];
    // Current active room modules
    const modules: ExpansionModule[] = [
      { x: canvas.width / 2, y: 30, dir: 'N', active: true },
      { x: canvas.width / 2, y: canvas.height - 30, dir: 'S', active: true },
      { x: canvas.width - 30, y: canvas.height / 2, dir: 'E', active: true },
      { x: 30, y: canvas.height / 2, dir: 'W', active: true }
    ];

    // Chest or exit portal
    let rewardChest: { x: number; y: number; active: boolean; opened: boolean } | null = null;
    let escapePortal: { x: number; y: number; active: boolean } | null = null;

    // Initial spawn
    spawnMonstersForRoom(isCaptureMode ? 'COMBAT' : 'START');

    function spawnMonstersForRoom(type: RoomType) {
      enemies = [];
      rewardChest = null;
      escapePortal = null;
      spawnEnvObjects(type);

      const seededRandom = (isDailyChallenge && dailySeed)
        ? getSeededRandomForRoom(dailySeed, localCurrentRoom.x, localCurrentRoom.y, currentStageRef.current)
        : Math.random;

      // Stage difficulty multipliers combined with progressive room scaling (from gameConfig)

      const roomHpFactor = 1.0 + (roomsExpandedCount.current - 1) * gameConfig.roomScalingHpMultiplierPerRoom;
      const roomDmgFactor = 1.0 + (roomsExpandedCount.current - 1) * gameConfig.roomScalingDmgMultiplierPerRoom;

      const diffMult = difficulty === 'extreme' ? 1.7 : difficulty === 'hard' ? 1.3 : 1.0;
      const stageHpMult = (currentStageRef.current === 1 ? 1.0 : currentStageRef.current === 2 ? 1.6 : 2.4) * roomHpFactor * diffMult;
      const stageDmgMult = (currentStageRef.current === 1 ? 1.0 : currentStageRef.current === 2 ? 1.5 : 2.0) * roomDmgFactor * diffMult;
      const stageSpeedMult = currentStageRef.current === 1 ? 1.0 : currentStageRef.current === 2 ? 1.15 : 1.3;

      if (type === 'BOSS') {
        // Trigger boss blackout sequence
        setIsBlackout(true);
        player.invulnTimer = 2500; // brief grace invulnerability

        setTimeout(() => {
          setIsBlackout(false);
          enemies = [];

          let bossHp: number;
          let bossDmg: number;
          let bossName: string;
          let bossType: 'crawler' | 'warden' | 'stalker';
          let bossSubtextLore: string;

          if (currentStageRef.current === 1) {
            bossHp = 220;
            bossDmg = 18;
            bossName = 'STAGE 1 BOSS: GATEKEEPER';
            bossType = 'warden';
            bossSubtextLore = '진입을 불허하는 미궁의 수호자';
          } else if (currentStageRef.current === 2) {
            bossHp = 360;
            bossDmg = 26;
            bossName = 'STAGE 2 BOSS: CORRUPTER';
            bossType = 'crawler';
            bossSubtextLore = '모든 유기체를 부패시키는 오염의 파도';
          } else {
            bossHp = 550;
            bossDmg = 35;
            bossName = 'STAGE 3 BOSS: MAZE HEART';
            bossType = 'stalker';
            bossSubtextLore = '미궁의 모든 박동을 주관하는 생명의 근원';
          }

          // Apply stage HP and Damage scaling
          bossHp = Math.round(bossHp * stageHpMult);
          bossDmg = Math.round(bossDmg * stageDmgMult);

          // Main Boss
          enemies.push({
            x: canvas!.width / 2,
            y: bossType === 'stalker' ? canvas!.height / 2 : canvas!.height / 2 - 40,
            hp: bossHp,
            maxHp: bossHp,
            baseSpeed: bossType === 'stalker' ? 0 : bossType === 'warden' ? 0.4 * stageSpeedMult : 0.65 * stageSpeedMult,
            damage: bossDmg,
            isKnocked: false,
            kbX: 0,
            kbY: 0,
            kbPower: 1.2,
            kbTimer: 0,
            attackCooldown: bossType === 'crawler' ? 1000 : 0,
            attackRange: bossType === 'stalker' ? 0 : bossType === 'warden' ? 45 : 32,
            angle: 0,
            type: bossType,
            isElite: true,
            isBoss: true,
            warningTimer: 2500,
            isShielding: bossType === 'warden' ? false : undefined,
            shieldTimer: bossType === 'warden' ? 0 : undefined,
            shieldCooldown: bossType === 'warden' ? 1500 : undefined
          });

          // Spawn minion guards
          const minionCount = currentStageRef.current === 1 ? 1 : currentStageRef.current === 2 ? 2 : 3;
          for (let k = 0; k < minionCount; k++) {
            enemies.push({
              x: k % 2 === 0 ? 100 : canvas!.width - 100,
              y: canvas!.height / 2 + 50,
              hp: Math.round((30 + localLevel * 8) * stageHpMult),
              maxHp: Math.round((30 + localLevel * 8) * stageHpMult),
              baseSpeed: 0.85 * stageSpeedMult,
              damage: Math.round(10 * stageDmgMult),
              isKnocked: false,
              kbX: 0,
              kbY: 0,
              kbPower: 4.0,
              kbTimer: 0,
              attackCooldown: 0,
              attackRange: 28,
              angle: 0,
              type: 'crawler',
              isElite: false,
              warningTimer: 0
            });
          }

          // Set boss states for HUD HP bar & splash banner
          setActiveBoss({
            name: bossName,
            hp: bossHp,
            maxHp: bossHp,
            phase: 1
          });
          setBossNameSplash(bossName);
          setBossSubtext(bossSubtextLore);
          setShowBossNameSplash(true);
          soundManagerRef.current?.playBossRoar(canvas!.width / 2, canvas!.height / 2, player.x, player.y);

          setTimeout(() => {
            setShowBossNameSplash(false);
          }, 3200);

          // Sync overlay enemies immediately
          setOverlayEnemies(
            enemies.map(e => ({
              x: e.x,
              y: e.y,
              isHit: e.isKnocked,
              isMoving: !e.isKnocked && !e.chargeState && !e.teleportState,
              type: e.type,
              isElite: e.isElite,
              isBoss: e.isBoss,
              warningTimer: e.warningTimer,
              isShielding: e.isShielding
            }))
          );

          triggerShake('strong');
          addFloatText(canvas!.width / 2, canvas!.height / 2 - 60, `⚠️ ${bossName} AWOKEN ⚠️`, '#C8432F');
        }, 2200);

        return;
      }

      if (type === 'START' || type === 'COMBAT' || type === 'HAZARD') {
        const isDeepZone = localContamination >= 76;
        const hasMonsters = type === 'COMBAT' || type === 'HAZARD';

        if (isDeepZone && hasMonsters) {
          // Trigger blackout boss entry sequence!
          setIsBlackout(true);
          player.invulnTimer = 1500; // brief grace invulnerability
          
          setTimeout(() => {
            setIsBlackout(false);
            
            enemies = [];
            const eType = 'warden'; // Warden serves as boss
            const baseHp = 150 + localLevel * 30; // Massive boss HP!
            const finalDmg = 25;

            enemies.push({
              x: canvas!.width / 2,
              y: canvas!.height / 2 - 40,
              hp: Math.round(baseHp * stageHpMult),
              maxHp: Math.round(baseHp * stageHpMult),
              baseSpeed: 0.4 * stageSpeedMult,
              damage: Math.round(finalDmg * stageDmgMult),
              isKnocked: false,
              kbX: 0,
              kbY: 0,
              kbPower: 1.5,
              kbTimer: 0,
              attackCooldown: 0,
              attackRange: 42,
              angle: 0,
              type: eType,
              isElite: true,
              isBoss: true,
              warningTimer: 2500
            });

            // Spawn two crawler guards
            for (let k = 0; k < 2; k++) {
              enemies.push({
                x: k === 0 ? 100 : canvas!.width - 100,
                y: canvas!.height / 2 + 50,
                hp: Math.round((40 + localLevel * 10) * stageHpMult),
                maxHp: Math.round((40 + localLevel * 10) * stageHpMult),
                baseSpeed: 0.9 * stageSpeedMult,
                damage: Math.round(10 * stageDmgMult),
                isKnocked: false,
                kbX: 0,
                kbY: 0,
                kbPower: 4.5,
                kbTimer: 0,
                attackCooldown: 0,
                attackRange: 28,
                angle: 0,
                type: 'crawler',
                isElite: false,
                warningTimer: 0
              });
            }

            // Sync the overlay immediately
            setOverlayEnemies(
              enemies.map(e => ({
                x: e.x,
                y: e.y,
                isHit: e.isKnocked,
                isMoving: !e.isKnocked,
                type: e.type,
                isElite: e.isElite,
                isBoss: e.isBoss,
                warningTimer: e.warningTimer
              }))
            );

            soundManagerRef.current?.playLevelUp(); // asc chime
            triggerShake('strong');
            addFloatText(canvas!.width / 2, canvas!.height / 2 - 60, '⚠️ BOSS MUTATION AWOKEN ⚠️', '#C8432F');
          }, 1200);

          return;
        }

        // Normal spawning logic
        const count = type === 'HAZARD' ? 3 : 2;
        for (let i = 0; i < count; i++) {
          let eType: 'crawler' | 'warden' | 'stalker';
          if (currentStageRef.current === 3 || localContamination >= 76) {
            // Under deep conditions (Stage 3 or high contam), spawn Stalkers
            eType = i === 0 ? 'stalker' : (i === 1 ? 'warden' : 'crawler');
          } else {
            eType = type === 'HAZARD' 
              ? (i === 0 ? 'crawler' : 'warden') 
              : (i === 0 ? 'warden' : 'crawler');
          }

          const isElite = localContamination >= 51 && localContamination <= 75 && i === 0;
          
          let baseHp = 30 + localLevel * 10;
          let baseDmg = 10;
          let baseSpeed = 0.8;
          let attackRange = 28;
          let kbPower = 4.5;

          if (eType === 'warden') {
            baseHp = 45 + localLevel * 10;
            baseDmg = 15;
            baseSpeed = 0.45;
            attackRange = 32;
            kbPower = 2.5;
          } else if (eType === 'stalker') {
            baseHp = 40 + localLevel * 10;
            baseDmg = 12;
            baseSpeed = 0.65;
            attackRange = 30;
            kbPower = 3.0;
          }

          const finalHp = Math.round((isElite ? baseHp * 2 : baseHp) * stageHpMult);
          const finalDmg = Math.round((isElite ? baseDmg * 1.5 : baseDmg) * stageDmgMult);
          const finalSpeed = baseSpeed * stageSpeedMult;

          enemies.push({
            x: seededRandom() * (canvas!.width - 160) + 80,
            y: seededRandom() * (canvas!.height - 160) + 80,
            hp: finalHp,

            maxHp: finalHp,
            baseSpeed: finalSpeed,
            damage: finalDmg,
            isKnocked: false,
            kbX: 0,
            kbY: 0,
            kbPower: kbPower,
            kbTimer: 0,
            attackCooldown: 0,
            attackRange: attackRange,
            angle: 0,
            type: eType,
            isElite: isElite,
            warningTimer: isElite ? 2000 : 0
          });
        }
      } else if (type === 'REWARD') {
        rewardChest = { x: canvas!.width / 2, y: canvas!.height / 2, active: true, opened: false };
      }
    }

    function spawnEnvObjects(roomType: RoomType) {
      envObjects = [];
      const veinSeed = Math.abs(localCurrentRoom.x * 7 + localCurrentRoom.y * 13) % 10;

      if (roomType === 'START') {
        envObjects.push({
          id: 'pillar_start',
          type: 'pillar',
          x: 180,
          y: 130,
          active: true,
          cooldown: 0
        });
      } else if (roomType === 'COMBAT' || roomType === 'BOSS') {
        envObjects.push({
          id: `nest_${veinSeed}`,
          type: 'nest',
          x: 120 + (veinSeed * 25) % 100,
          y: 120 + (veinSeed * 15) % 80,
          hp: 60,
          maxHp: 60,
          active: true,
          lastSpawnTime: 0
        });
        envObjects.push({
          id: `crystal_${veinSeed}`,
          type: 'crystal',
          x: 480 - (veinSeed * 20) % 80,
          y: 120 + (veinSeed * 20) % 80,
          hp: 1,
          maxHp: 1,
          active: true
        });
        envObjects.push({
          id: `pool_${veinSeed}`,
          type: 'pool',
          x: 300 + (veinSeed * 15) % 100,
          y: 300 - (veinSeed * 10) % 60,
          active: true
        });
      } else if (roomType === 'HAZARD') {
        envObjects.push({
          id: `pool_${veinSeed}_1`,
          type: 'pool',
          x: 180 + (veinSeed * 15) % 80,
          y: 150 + (veinSeed * 10) % 60,
          active: true
        });
        envObjects.push({
          id: `pool_${veinSeed}_2`,
          type: 'pool',
          x: 420 - (veinSeed * 15) % 80,
          y: 270 - (veinSeed * 10) % 60,
          active: true
        });
        envObjects.push({
          id: `wall_${veinSeed}`,
          type: 'wall',
          x: 480,
          y: 150,
          hp: 50,
          maxHp: 50,
          active: true
        });
        envObjects.push({
          id: `pillar_${veinSeed}`,
          type: 'pillar',
          x: 120 + (veinSeed * 10) % 60,
          y: 300 - (veinSeed * 10) % 60,
          active: true,
          cooldown: 0
        });
      } else if (roomType === 'RECOVERY') {
        envObjects.push({
          id: `pillar_${veinSeed}_rec1`,
          type: 'pillar',
          x: 180,
          y: 150,
          active: true,
          cooldown: 0
        });
        envObjects.push({
          id: `pillar_${veinSeed}_rec2`,
          type: 'pillar',
          x: 420,
          y: 270,
          active: true,
          cooldown: 0
        });
        envObjects.push({
          id: `crystal_${veinSeed}_rec1`,
          type: 'crystal',
          x: 300,
          y: 120,
          hp: 1,
          maxHp: 1,
          active: true
        });
      } else if (roomType === 'REWARD') {
        envObjects.push({
          id: `crystal_${veinSeed}_rew1`,
          type: 'crystal',
          x: 150,
          y: 150,
          hp: 1,
          maxHp: 1,
          active: true
        });
        envObjects.push({
          id: `crystal_${veinSeed}_rew2`,
          type: 'crystal',
          x: 450,
          y: 270,
          hp: 1,
          maxHp: 1,
          active: true
        });
      }
    }

    // Helper: push particle to cap count, discarding the oldest to maintain performance
    function pushSpark(s: Spark) {
      const maxCap = (isLowSpecRef.current || reduceParticlesRef.current) ? 40 : 120;
      if (sparks.length >= maxCap) {
        sparks.shift(); // discard oldest to make room for new visual feedback
      }
      sparks.push(s);
    }

    // Sound helper functions removed. Guided directly via SoundManager hooks.

    // Unified damage function that intercepts boss shields
    function damageEnemy(enemy: Enemy, rawDmg: number, isHeavy: boolean, hitAngle: number): boolean {
      if (enemy.hp <= 0) return false;
      
      let finalDmg = rawDmg;
      
      // Check Stage 1 Gatekeeper front shield blocks
      if (enemy.isBoss && enemy.type === 'warden' && currentStageRef.current === 1 && enemy.isShielding) {
        const attackDiff = Math.abs(Math.atan2(Math.sin(hitAngle - enemy.angle), Math.cos(hitAngle - enemy.angle)));
        const isFrontAttack = attackDiff > Math.PI / 2;
        
        if (isFrontAttack) {
          if (isHeavy) {
            // Heavy attack breaks the shield
            enemy.isShielding = false;
            enemy.shieldTimer = 0;
            enemy.shieldCooldown = 4000;
            
            // Stun Gatekeeper for 1.2s (by locking its knockback state with zero velocity)
            enemy.isKnocked = true;
            enemy.kbX = 0;
            enemy.kbY = 0;
            enemy.kbPower = 0;
            enemy.kbTimer = 1200;
            
            // Deal full damage
            enemy.hp = Math.max(0, enemy.hp - rawDmg);
            
            soundManagerRef.current?.playShieldBreak(enemy.x, enemy.y, player.x, player.y);
            createShieldShards(enemy.x, enemy.y, 16);
            spawnHitParticles(enemy.x, enemy.y);
            addFloatText(enemy.x, enemy.y - 24, `🛡️ SHIELD BROKEN! (-${Math.round(rawDmg)})`, '#06B6D4');
            triggerShake('medium');
            
            return true; // handled / blocked further actions
          } else {
            // Light attacks are blocked with 85% damage reduction
            finalDmg = Math.round(rawDmg * 0.15);
            enemy.hp = Math.max(0, enemy.hp - finalDmg);
            
            soundManagerRef.current?.playShieldClink(enemy.x, enemy.y, player.x, player.y);
            createSparks(enemy.x, enemy.y, '#06B6D4', 6);
            addFloatText(enemy.x, enemy.y - 24, `🛡️ BLOCKED (${finalDmg})`, '#06B6D4');
            
            return true; // handled / blocked (no knockback)
          }
        }
      }
      
      enemy.hp = Math.max(0, enemy.hp - finalDmg);
      return false; // not blocked, apply normal knockback
    }

    // Helper: spawn particles (default spark fallback)
    function createSparks(x: number, y: number, color: string, count = 10) {
      const actualCount = (isLowSpecRef.current || reduceParticlesRef.current) ? Math.max(1, Math.round(count / 2)) : count;
      for (let i = 0; i < actualCount; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 2 + 1;
        pushSpark({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          color,
          alpha: 1.0,
          size: Math.random() * 2.5 + 1.5,
          decay: 0.04,
          type: 'spark'
        });
      }
    }

    function createShieldShards(x: number, y: number, count = 10) {
      const actualCount = (isLowSpecRef.current || reduceParticlesRef.current) ? Math.max(1, Math.round(count / 2)) : count;
      for (let i = 0; i < actualCount; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 3.5 + 2.0;
        const size = Math.random() * 5 + 3;
        const rotation = Math.random() * Math.PI * 2;
        const rotSpeed = (Math.random() - 0.5) * 0.25;
        pushSpark({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          color: Math.random() > 0.45 ? '#67E8F9' : '#38BDF8',
          alpha: 1.0,
          size,
          decay: Math.random() * 0.025 + 0.015,
          type: 'shield-shard',
          rotation,
          rotSpeed
        });
      }
    }

    function spawnHitParticles(x: number, y: number) {
      // Red organic droplets (12 -> 22 for higher impact)
      const redCount = (isLowSpecRef.current || reduceParticlesRef.current) ? 6 : 22;
      for (let i = 0; i < redCount; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 3 + 1.5;
        pushSpark({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          color: Math.random() > 0.4 ? '#C8432F' : '#3D0A05', // organic red
          alpha: 1.0,
          size: Math.random() * 3 + 2,
          decay: Math.random() * 0.03 + 0.02,
          type: 'blood'
        });
      }
      // Gold sparks (8 -> 15 for spark shine)
      const goldCount = (isLowSpecRef.current || reduceParticlesRef.current) ? 3 : 15;
      for (let i = 0; i < goldCount; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 4 + 2;
        pushSpark({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          color: '#C9A84C', // gold
          alpha: 1.0,
          size: Math.random() * 2 + 1,
          decay: Math.random() * 0.04 + 0.03,
          type: 'spark'
        });
      }
    }

    function spawnDeathParticles(x: number, y: number) {
      // Fleshy cloud
      const fleshCount = (isLowSpecRef.current || reduceParticlesRef.current) ? 10 : 25;
      for (let i = 0; i < fleshCount; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 1.5 + 0.5;
        pushSpark({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          color: Math.random() > 0.5 ? '#2D0A2E' : '#3D0A05', // purple/red
          alpha: 0.9,
          size: Math.random() * 6 + 4,
          decay: Math.random() * 0.015 + 0.015,
          type: 'blood'
        });
      }
      // Debris spiky chunks
      const debrisCount = (isLowSpecRef.current || reduceParticlesRef.current) ? 4 : 10;
      for (let i = 0; i < debrisCount; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 3 + 1;
        pushSpark({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          color: '#C8432F',
          alpha: 1.0,
          size: Math.random() * 4 + 3,
          decay: Math.random() * 0.02 + 0.015,
          type: 'dust'
        });
      }
    }

    function spawnGoldDrops(x: number, y: number, count: number) {
      const actualCount = (isLowSpecRef.current || reduceParticlesRef.current) ? Math.max(1, Math.round(count / 2)) : count;
      for (let i = 0; i < actualCount; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 2.2 + 1.2;
        pushSpark({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          color: '#FFD700',
          alpha: 1.0,
          size: Math.random() * 1.5 + 2.0, // diamond size
          decay: Math.random() * 0.003 + 0.003,
          type: 'gold-item'
        });
      }
    }

    function spawnModuleParticles(x: number, y: number) {
      // Gold expanding ring
      pushSpark({
        x,
        y,
        vx: 0,
        vy: 0,
        color: '#C9A84C',
        alpha: 1.0,
        size: 5,
        decay: 0.04,
        type: 'shockwave',
        maxSize: 60,
        growth: 3.5
      });
      // Red expanding ring (low-spec bypass)
      if (!isLowSpecRef.current && !reduceParticlesRef.current) {
        pushSpark({
          x,
          y,
          vx: 0,
          vy: 0,
          color: '#C8432F',
          alpha: 0.8,
          size: 5,
          decay: 0.05,
          type: 'shockwave',
          maxSize: 45,
          growth: 2.8
        });
      }
      // Grey dust spores
      const dustCount = (isLowSpecRef.current || reduceParticlesRef.current) ? 6 : 15;
      for (let i = 0; i < dustCount; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 2 + 1;
        pushSpark({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          color: '#8A9BA8',
          alpha: 0.7,
          size: Math.random() * 5 + 3,
          decay: Math.random() * 0.03 + 0.02,
          type: 'dust'
        });
      }
    }

    // Helper: spawn floating text
    function addFloatText(x: number, y: number, text: string, color = '#F5F3EE') {
      floatTexts.push({ x, y, text, color, alpha: 1.0 });
    }

    function executeSpecialSkill() {
      if (selectedBuild === 'breaker') {
        addFloatText(player.x, player.y - 28, '지진 강타 (EARTHQUAKE SLAM)!', '#FFD700');
        triggerShake('strong');
        hitStopTimer = 60;
        
        for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 10) {
          const px = player.x + Math.cos(angle) * 35;
          const py = player.y + Math.sin(angle) * 35;
          createSparks(px, py, '#C9A84C', 3);
          sparks.push({
            x: px,
            y: py,
            vx: Math.cos(angle) * 3,
            vy: Math.sin(angle) * 3,
            color: '#7c2230',
            alpha: 0.8,
            size: Math.random() * 4 + 2,
            decay: 0.03,
            type: 'dust'
          });
        }
        
        enemies.forEach(enemy => {
          if (enemy.hp <= 0) return;
          const dist = Math.hypot(enemy.x - player.x, enemy.y - player.y);
          if (dist <= 180) {
            const damage = 42 * (1.0 + (weaponLevelRef.current - 1) * gameConfig.weaponDamageScalePerLevel);
            const hitAngle = Math.atan2(enemy.y - player.y, enemy.x - player.x);
            const blocked = damageEnemy(enemy, damage, true, hitAngle);
            
            if (!blocked) {
              const angle = Math.atan2(enemy.y - player.y, enemy.x - player.x);
              enemy.isKnocked = true;
              enemy.kbX = Math.cos(angle);
              enemy.kbY = Math.sin(angle);
              enemy.kbPower = 11.5;
              enemy.kbTimer = 220;
              
              createSparks(enemy.x, enemy.y, '#C9A84C', 5);
              spawnHitParticles(enemy.x, enemy.y);
              addFloatText(enemy.x, enemy.y - 15, `💥 SLAM ${Math.round(damage)}`, '#FFD700');
            }
          }
        });
      } else if (selectedBuild === 'guardian') {
        addFloatText(player.x, player.y - 28, '회전 베기 (SPINNING SLASH)!', '#EBF1F5');
        triggerShake('medium');
        hitStopTimer = 40;
        player.invulnTimer = 600; // 600ms safety/stability buffer
        
        for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 16) {
          const px = player.x + Math.cos(angle) * 75;
          const py = player.y + Math.sin(angle) * 75;
          createSparks(px, py, '#EBF1F5', 1);
        }
        
        enemies.forEach(enemy => {
          if (enemy.hp <= 0) return;
          const dist = Math.hypot(enemy.x - player.x, enemy.y - player.y);
          if (dist <= 130) {
            const damage = 26 * (1.0 + (weaponLevelRef.current - 1) * gameConfig.weaponDamageScalePerLevel);
            const hitAngle = Math.atan2(enemy.y - player.y, enemy.x - player.x);
            const blocked = damageEnemy(enemy, damage, true, hitAngle);
            
            if (!blocked) {
              const angle = Math.atan2(enemy.y - player.y, enemy.x - player.x);
              enemy.isKnocked = true;
              enemy.kbX = Math.cos(angle);
              enemy.kbY = Math.sin(angle);
              enemy.kbPower = 4.5;
              enemy.kbTimer = 150;
              
              createSparks(enemy.x, enemy.y, '#EBF1F5', 3);
              spawnHitParticles(enemy.x, enemy.y);
              addFloatText(enemy.x, enemy.y - 15, `⚔️ SPIN ${Math.round(damage)}`, '#EBF1F5');
            }
          }
        });
      } else if (selectedBuild === 'striker') {
        addFloatText(player.x, player.y - 28, '잔상 대시 (AFTERIMAGE DASH)!', '#FFA500');
        triggerShake('weak');
        
        let dx = 0;
        let dy = 0;
        if (touchActive.current && (touchDirection.current.x !== 0 || touchDirection.current.y !== 0)) {
          dx = touchDirection.current.x;
          dy = touchDirection.current.y;
        } else {
          if (keysPressed.current['w'] || keysPressed.current['arrowup']) dy = -1;
          if (keysPressed.current['s'] || keysPressed.current['arrowdown']) dy = 1;
          if (keysPressed.current['a'] || keysPressed.current['arrowleft']) dx = -1;
          if (keysPressed.current['d'] || keysPressed.current['arrowright']) dx = 1;
          
          if (dx === 0 && dy === 0) {
            const angle = Math.atan2(mousePos.current.y - player.y, mousePos.current.x - player.x);
            dx = Math.cos(angle);
            dy = Math.sin(angle);
          }
        }
        
        const len = Math.hypot(dx, dy);
        if (len > 0) {
          dx /= len;
          dy /= len;
        } else {
          dx = 1;
          dy = 0;
        }
        
        const stepCount = 10;
        const stepSize = 20;
        const pathPoints: { x: number; y: number }[] = [];
        let currentX = player.x;
        let currentY = player.y;
        
        for (let i = 0; i < stepCount; i++) {
          const nextX = currentX + dx * stepSize;
          const nextY = currentY + dy * stepSize;
          
          if (nextX <= 18 || nextX >= canvas!.width - 18 || nextY <= 18 || nextY >= canvas!.height - 18) {
            break;
          }
          currentX = nextX;
          currentY = nextY;
          pathPoints.push({ x: currentX, y: currentY });
          createSparks(currentX, currentY, '#FFD700', 2);
        }
        
        const oldX = player.x;
        const oldY = player.y;
        player.x = currentX;
        player.y = currentY;
        player.invulnTimer = 250;
        
        const isComboActive = localCombo > 0;
        const damageMult = isComboActive ? 2.0 : 1.0;
        
        enemies.forEach(enemy => {
          if (enemy.hp <= 0) return;
          
          let minDist = Math.hypot(enemy.x - oldX, enemy.y - oldY);
          pathPoints.forEach(p => {
            const d = Math.hypot(enemy.x - p.x, enemy.y - p.y);
            if (d < minDist) minDist = d;
          });
          
          if (minDist <= 50) {
            const damage = 18 * (1.0 + (weaponLevelRef.current - 1) * gameConfig.weaponDamageScalePerLevel) * damageMult;
            const hitAngle = Math.atan2(enemy.y - player.y, enemy.x - player.x);
            const blocked = damageEnemy(enemy, damage, false, hitAngle);
            
            if (!blocked) {
              const kbAngle = Math.atan2(enemy.y - player.y, enemy.x - player.x);
              enemy.isKnocked = true;
              enemy.kbX = Math.cos(kbAngle);
              enemy.kbY = Math.sin(kbAngle);
              enemy.kbPower = 5.0;
              enemy.kbTimer = 160;
              
              createSparks(enemy.x, enemy.y, '#FFD700', 3);
              spawnHitParticles(enemy.x, enemy.y);
              addFloatText(enemy.x, enemy.y - 15, `${isComboActive ? '⚡⚡ FLASH' : '⚡ FLASH'} ${Math.round(damage)}`, isComboActive ? '#FFA500' : '#FFD700');
            }
          }
        });
      } else {
        addFloatText(player.x, player.y - 28, '유적 파동 (RELIC PULSE)!', '#34D399');
        triggerShake('medium');
        
        for (let r = 20; r < 200; r += 30) {
          for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 8) {
            const px = player.x + Math.cos(angle) * r;
            const py = player.y + Math.sin(angle) * r;
            if (px >= 0 && px <= canvas!.width && py >= 0 && py <= canvas!.height) {
              createSparks(px, py, '#34D399', 1);
            }
          }
        }
        
        enemies.forEach(enemy => {
          if (enemy.hp <= 0) return;
          const damage = 22 * (1.0 + (weaponLevelRef.current - 1) * gameConfig.weaponDamageScalePerLevel);
          const hitAngle = Math.atan2(enemy.y - player.y, enemy.x - player.x);
          const blocked = damageEnemy(enemy, damage, false, hitAngle);
          
          if (!blocked) {
            enemy.slowTimer = 4000;
            createSparks(enemy.x, enemy.y, '#34D399', 3);
            spawnHitParticles(enemy.x, enemy.y);
            addFloatText(enemy.x, enemy.y - 15, `📡 SCAN ${Math.round(damage)} (SLOWED)`, '#34D399');
          }
        });
      }
    }

    // Keyboard handlers
    const handleKeyDown = (e: KeyboardEvent) => {
      keysPressed.current[e.key.toLowerCase()] = true;
      if (e.key === ' ' || e.key.toLowerCase() === 'space') {
        e.preventDefault();
        mouseClicked.current = true;
      }
      if (e.key.toLowerCase() === 'f') {
        triggerInteraction();
      }
      if (e.key.toLowerCase() === 'q') {
        skillTriggered.current = true;
      }
      if (e.key.toLowerCase() === 'm') {
        setMinimapVisible(prev => !prev);
      }
      if (e.key === 'Tab') {
        e.preventDefault();
        setShowStatsHUD(prev => !prev);
      }
      if (e.key === 'Escape') {
        if (isFullMapOpenRef.current) {
          setIsFullMapOpen(false);
        } else if (!showIntroRef.current && !isDeadRef.current) {
          setIsLocalPaused(prev => {
            const next = !prev;
            if (!next) {
              setShowGiveUpConfirm(false);
            }
            return next;
          });
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed.current[e.key.toLowerCase()] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    // Canvas click triggers attack
    const handleCanvasMouseDown = () => {
      mouseClicked.current = true;
    };

    canvas.addEventListener('mousedown', handleCanvasMouseDown);

    // Track mouse position on canvas (convert CSS px → canvas coords)
    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mousePos.current = {
        x: (e.clientX - rect.left) * (600 / rect.width),
        y: (e.clientY - rect.top) * (420 / rect.height)
      };
    };
    canvas.addEventListener('mousemove', handleMouseMove);

    // Action execution
    function triggerModuleStrike(m: ExpansionModule) {
      if (m.isHit) return;

      // Calculate expansion stamina cost from gameConfig (Cartographer gets reduction)
      let baseCost = gameConfig.baseExpansionStaminaCost;
      if (dailyRuleRef.current?.id === 'stamina_double') {
        baseCost *= 2;
      }
      const actualCost = selectedBuild === 'cartographer' 
        ? baseCost * gameConfig.cartographerExpansionCostMultiplier 
        : baseCost;


      if (localStamina < actualCost) {
        addFloatText(player.x, player.y - 12, 'NEED STAMINA!', '#EF4444');
        return;
      }

      const prev = localStamina;
      localStamina = Math.max(0, localStamina - actualCost);
      setStamina(localStamina);
      addFloatText(player.x, player.y - 12, `-${Math.round(actualCost)} STAMINA (EXPAND)`, '#C9A84C');
      checkStaminaDepletion(prev, localStamina);

      m.isHit = true;
      setOverlayModules(modules.map(mod => ({ x: mod.x, y: mod.y, dir: mod.dir, active: mod.active, isHit: mod.isHit })));
      
      addFloatText(m.x, m.y - 25, 'CORE CRACKED!', '#C8432F');
      
      // Delay room expansion by 250ms to let the crack animation play!
      hitStopTimer = 220; // set hitStop to freeze gameplay loop
      triggerShake('strong');
      
      setTimeout(() => {
        expandRoomDirection(m);
      }, 250);
    }

    function triggerInteraction() {
      // Check if player is near any active module to expand room
      modules.forEach(m => {
        if (!m.active) return;
        const dist = Math.hypot(player.x - m.x, player.y - m.y);
        if (dist < 45) {
          triggerModuleStrike(m);
        }
      });
    }

    function expandRoomDirection(m: ExpansionModule) {
      m.active = false;
      m.isHit = false; // Reset hit flag
      spawnModuleParticles(m.x, m.y);
      addFloatText(m.x, m.y, 'EXPANDING ROOM...', '#C9A84C');

      // Expand room data
      const targetRoom = getRoomTarget(localCurrentRoom, m.dir);
      const targetX = targetRoom.x;
      const targetY = targetRoom.y;

      stageRoomsCount.current += 1;
      roomsExpandedCount.current += 1;
      if (roomsExpandedCount.current >= 10) {
        onUnlockAchievementRef.current?.('expand10');
      }
      localCurrentRoom = { x: targetX, y: targetY };

      const nextType = shouldSpawnBossRoom(currentStageRef.current, stageRoomsCount.current)
        ? 'BOSS'
        : (isDailyChallenge && dailySeed
            ? getDailyRoomType(dailySeed, targetX, targetY)
            : getNextRoomType(currentStageRef.current, stageRoomsCount.current, targetX, targetY));

      const newRoomNode: RoomNode = {
        x: targetX,
        y: targetY,
        type: nextType,
        explored: true,
        cleared: false
      };


      setRooms(prev => [...prev, newRoomNode]);
      setCurrentRoom({ x: targetX, y: targetY });

      // Trigger announcements
      if (nextType === 'BOSS') {
        setBannerText(currentStageRef.current === 3 ? '⚠️ FINAL BIO-MUTATION NEST ⚠️' : '⚠️ BOSS MUTATION NEST ⚠️');
        setBannerColor('text-maze-accent font-black animate-pulse font-cinzel');
      } else {
        setBannerText(`${nextType} ${nextType === 'REWARD' ? 'CHAMBER' : nextType === 'RECOVERY' ? 'SANCTUARY' : 'ZONE'} DISCOVERED`);
        setBannerColor(
          nextType === 'REWARD' ? 'text-maze-gold' : 
          nextType === 'HAZARD' ? 'text-purple-500' : 
          nextType === 'RECOVERY' ? 'text-blue-400 font-bold' : 
          'text-maze-accent'
        );
      }
      setBannerVisible(true);

      // Increase contamination
      let contamGain = 8.0;
      const hasMapUpg = upgradesRef.current.some(u => u.id === 'maze_sense');
      if (hasMapUpg) {
        contamGain *= 0.85; // 15% reduction
      }
      const contamMult = difficulty === 'hard' ? 2.0 : 1.0;
      const maxStageContam = currentStageRef.current === 1 ? 25 : currentStageRef.current === 2 ? 60 : 100;
      localContamination = Math.min(maxStageContam, localContamination + contamGain * contamMult);
      setContamination(localContamination);
      // Apply initial damage if entering hazard zone with high contamination
      if (nextType === 'HAZARD' && localContamination >= 76) {
        const hazardDamage = 15;
        localHp = Math.max(0, localHp - hazardDamage);
        setHp(localHp);
        addFloatText(player.x, player.y - 14, `HAZARD -${hazardDamage}`, '#C8432F');
        soundManagerRef.current?.playHit(player.x, player.y, player.x, player.y);
      }

      // Reset recovery room timers on entering a new room
      recoveryDurationRef.current = 0;
      lastHealTickTimeRef.current = 0;
      recoveryCompletedRef.current = false;
      triggeredGoldFlashRef.current = false;

      // Pan effect / reset player
      player.x = canvas!.width / 2;
      player.y = canvas!.height / 2;

      // Reactivate all modules for the new room
      modules.forEach(mod => {
        mod.active = true;
        mod.isHit = false;
      });
      setOverlayModules(modules.map(mod => ({ x: mod.x, y: mod.y, dir: mod.dir, active: mod.active, isHit: mod.isHit })));

      spawnMonstersForRoom(nextType);

    }

    // --- GAME LOOP RUNNING ---
    let animId: number;
    let hasDrawnFrame = false;
    let lastTime = performance.now();
    const checkStaminaDepletion = (prev: number, current: number) => {
      if (current <= 0 && prev > 0) {
        triggerShake('medium');
        soundManagerRef.current?.playGasp();
        setIsExhausted(true);
        addFloatText(player.x, player.y - 28, 'EXHAUSTED!', '#EF4444');
      }
    };

    // Main game loop logic
    const loop = (time: number) => {
      const delta = time - lastTime;
      lastTime = time;

      // Track FPS frame count
      frames.current++;
      if (time - lastFpsTime.current >= 500) {
        fpsVal.current = Math.round((frames.current * 1000) / (time - lastFpsTime.current));
        frames.current = 0;
        lastFpsTime.current = time;
      }

      if ((pausedRef.current || showIntroRef.current || isDeadRef.current || isVictoryRef.current) && hasDrawnFrame) {
        animId = requestAnimationFrame(loop);
        return;
      }

      if (hitStopTimer > 0) {
        hitStopTimer -= delta;
        animId = requestAnimationFrame(loop);
        return;
      }

      // Decrement player timers/cooldowns
      if (player.attackCooldown > 0) player.attackCooldown = Math.max(0, player.attackCooldown - delta);
      if (player.dashCooldown > 0) player.dashCooldown = Math.max(0, player.dashCooldown - delta);
      if (player.dashTimer > 0) player.dashTimer = Math.max(0, player.dashTimer - delta);
      if (player.invulnTimer > 0) player.invulnTimer = Math.max(0, player.invulnTimer - delta);
      if (player.shieldFlashTimer > 0) player.shieldFlashTimer = Math.max(0, player.shieldFlashTimer - delta);
      if (player.shieldShatterTimer > 0) player.shieldShatterTimer = Math.max(0, player.shieldShatterTimer - delta);

      if (localSkillCooldown > 0) {
        localSkillCooldown = Math.max(0, localSkillCooldown - delta);
        setSkillCooldown(localSkillCooldown);
      }

      if (isTransitioningStageRef.current) {
        // Draw Stage Transition Blackout screen
        ctx.fillStyle = '#030205';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        if (lightCtx && lightCanvas) {
          lightCtx.clearRect(0, 0, lightCanvas.width, lightCanvas.height);
        }

        ctx.save();
        ctx.font = 'bold 24px cinzel, outfit, sans-serif';
        ctx.fillStyle = '#C8432F'; // Blood red
        ctx.textAlign = 'center';
        ctx.shadowColor = '#C8432F';
        ctx.shadowBlur = 12;
        ctx.fillText('DEEPER...', canvas.width / 2, canvas.height / 2);
        ctx.restore();

        animId = requestAnimationFrame(loop);
        return;
      }

      // 1. Survival timer ticking
      survivalTimeRef.current += delta / 1000;
      const mins = Math.floor(survivalTimeRef.current / 60);
      const secs = Math.floor(survivalTimeRef.current % 60);
      setDisplayTime(`${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`);

      // 1.5. Stamina regeneration & Recovery
      const maxStam = 100 + upgradesRef.current.filter(u => u.id === 'stamina_flow').length * 10;
      let stamRegen = 18; // 18 stamina per second
      if (upgradesRef.current.some(u => u.id === 'stamina_flow')) {
        stamRegen *= 1.4;
      }
      const prevStam = localStamina;
      if (localStamina < maxStam) {
        localStamina = Math.min(maxStam, localStamina + (stamRegen * delta) / 1000);
        setStamina(localStamina);

        // Gold flash on fully recovered
        if (localStamina === maxStam && prevStam < maxStam) {
          setIsStaminaGoldFlashing(true);
          setTimeout(() => setIsStaminaGoldFlashing(false), 500);
          soundManagerRef.current?.playLevelUp();
          setIsExhausted(false);
        }
      }

      // Tutorial: "Space로 공격"
      if (enemies.length > 0) {
        triggerTutorialHintRef.current("Space로 공격");
      }

      // Detect room purification moment (when enemies array drops to 0)
      const hasEnemiesNow = enemies.length > 0;
      if (lastFrameHasEnemies.current && !hasEnemiesNow) {
        setRoomPurifySplash(true);
        setTimeout(() => setRoomPurifySplash(false), 2800);
        soundManagerRef.current?.playVictoryChime();
        addFloatText(player.x, player.y - 30, 'ROOM PURIFIED! EXPAND THE LABYRINTH!', '#FFD700');
      }
      lastFrameHasEnemies.current = hasEnemiesNow;

      // Tutorial: "Shift로 대시 가능"
      if (localStamina / maxStam <= 0.3) {
        triggerTutorialHintRef.current("Shift로 대시 가능");
      }

      // 2. Contamination ticking
      let growthRate = selectedBuild === 'breaker' ? 0.35 : 0.22; // breaker triggers slightly more tension
      const hasMapUpg = upgradesRef.current.some(u => u.id === 'maze_sense');
      if (hasMapUpg) {
        growthRate *= 0.85;
      }
      let contamMult = difficulty === 'hard' ? 2.0 : 1.0;
      if (dailyRuleRef.current?.id === 'double_contamination') {
        contamMult *= 2;
      }
      const maxStageContam = currentStageRef.current === 1 ? 25 : currentStageRef.current === 2 ? 60 : 100;

      localContamination = Math.min(maxStageContam, localContamination + ((growthRate * delta) / 1000) * contamMult);
      setContamination(localContamination);

      // Sync BGM state dynamically based on active enemies
      const hasActiveBoss = enemies.some(e => e.isBoss && e.hp > 0);
      const hasActiveEnemies = enemies.some(e => e.hp > 0);
      const targetBgmState = hasActiveBoss ? 'boss' : (hasActiveEnemies ? 'combat' : 'explore');
      soundManagerRef.current?.setBgmState(targetBgmState);

      // 2.5 Recovery Room ticking logic
      const currentRoomNodeForRecovery = roomsRef.current.find(r => r.x === localCurrentRoom.x && r.y === localCurrentRoom.y);
      const localRoomType = currentRoomNodeForRecovery ? currentRoomNodeForRecovery.type : 'START';

      if (localRoomType === 'RECOVERY' && !recoveryCompletedRef.current) {
        recoveryDurationRef.current += delta;
        
        // Every 1000ms inside the sanctuary, do a tick
        if (recoveryDurationRef.current - lastHealTickTimeRef.current >= 1000) {
          lastHealTickTimeRef.current += 1000;
          
          // Heal +6 HP
          const prevHp = localHp;
          const healAmount = dailyRuleRef.current?.id === 'no_healing' ? 0 : 6;
          if (healAmount > 0) {
            localHp = Math.min(100, localHp + healAmount);
            setHp(localHp);
          }
          
          // Decrease contamination by 1.5%
          const prevContam = localContamination;
          const purgeAmount = dailyRuleRef.current?.id === 'no_healing' ? 0 : 1.5;
          if (purgeAmount > 0) {
            localContamination = Math.max(0, localContamination - purgeAmount);
            setContamination(localContamination);
          }
          
          // Floating texts
          if (localHp > prevHp) {
            addFloatText(player.x, player.y - 14, `HEALING +${Math.round(localHp - prevHp)} HP`, '#3b82f6');
          }
          if (localContamination < prevContam) {
            addFloatText(player.x - 30, player.y - 28, `CONTAM -${(prevContam - localContamination).toFixed(1)}%`, '#10B981');
          }
          
          if (dailyRuleRef.current?.id === 'no_healing') {
            addFloatText(player.x, player.y - 14, 'DESOLATED: NO RECOVERY', '#EF4444');
          } else {
            // Spawn blue sparks/particles
            createSparks(player.x, player.y, '#3b82f6', 8);
            
            // Play level up chime sound
            soundManagerRef.current?.playLevelUp();

            // Check if maximum HP has been reached
            if (localHp === 100 && prevHp < 100 && !triggeredGoldFlashRef.current) {
              triggeredGoldFlashRef.current = true;
              setShowGoldFlash(true);
              setTimeout(() => setShowGoldFlash(false), 500);
              soundManagerRef.current?.playLevelUp();
              addFloatText(player.x, player.y - 42, 'MAX HP RESTORED!', '#F59E0B');
            }
          }

        }

        // Maximum 5 seconds recovery limit
        if (recoveryDurationRef.current >= 5000) {
          recoveryCompletedRef.current = true;
          addFloatText(player.x, player.y - 42, 'SANCTUARY FADED', '#C9A84C');
          
          if (localHp === 100 && !triggeredGoldFlashRef.current) {
            triggeredGoldFlashRef.current = true;
            setShowGoldFlash(true);
            setTimeout(() => setShowGoldFlash(false), 500);
            soundManagerRef.current?.playLevelUp();
          }
        }
      }

      // 3. Clear canvas background with dark, damp biological radial gradient (progressive stage color shift)
      const floorGrad = ctx.createRadialGradient(
        canvas.width / 2, canvas.height / 2, 60,
        canvas.width / 2, canvas.height / 2, canvas.width / 1.5
      );
      if (currentStageRef.current === 1) {
        // Stage 1: Entrance (Dark blue-grey-black)
        floorGrad.addColorStop(0, '#0c0c16');
        floorGrad.addColorStop(0.6, '#06060c');
        floorGrad.addColorStop(1, '#010103');
      } else if (currentStageRef.current === 2) {
        // Stage 2: Mid-layer (Darker purple-crimson)
        floorGrad.addColorStop(0, '#0d040a');
        floorGrad.addColorStop(0.6, '#060205');
        floorGrad.addColorStop(1, '#010001');
      } else {
        // Stage 3: Deep-layer (Pitch black & blood-red void)
        floorGrad.addColorStop(0, '#180206');
        floorGrad.addColorStop(0.6, '#0b0103');
        floorGrad.addColorStop(1, '#000000');
      }
      ctx.fillStyle = floorGrad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const veinSeed = Math.abs(localCurrentRoom.x * 7 + localCurrentRoom.y * 13) % 10;

      // Draw shiny organic wet puddles (damp biology theme)
      ctx.save();
      ctx.globalAlpha = 0.15;
      // Use seeded values to make puddles persistent per room coordinates
      const puddle1X = 140 + (veinSeed * 45) % 120;
      const puddle1Y = 110 + (veinSeed * 30) % 90;
      const puddle1Grad = ctx.createRadialGradient(puddle1X, puddle1Y, 5, puddle1X, puddle1Y, 45);
      puddle1Grad.addColorStop(0, '#4a0e17'); // blood/fleshy red puddle
      puddle1Grad.addColorStop(1, 'transparent');
      ctx.fillStyle = puddle1Grad;
      ctx.beginPath();
      ctx.ellipse(puddle1X, puddle1Y, 55, 25, Math.PI / 6, 0, Math.PI * 2);
      ctx.fill();

      const puddle2X = 380 - (veinSeed * 25) % 100;
      const puddle2Y = 270 + (veinSeed * 15) % 80;
      const puddle2Grad = ctx.createRadialGradient(puddle2X, puddle2Y, 8, puddle2X, puddle2Y, 60);
      puddle2Grad.addColorStop(0, '#121c32'); // dark damp fluid puddle
      puddle2Grad.addColorStop(1, 'transparent');
      ctx.fillStyle = puddle2Grad;
      ctx.beginPath();
      ctx.ellipse(puddle2X, puddle2Y, 70, 35, -Math.PI / 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Draw organic veins in background (Fleshy Monster dungeon theme)
      ctx.save();
      const pulseVeinAlpha = isLowSpecRef.current 
        ? 0.2 
        : 0.2 + Math.sin(time / 800) * 0.1;
      ctx.strokeStyle = `rgba(150, 25, 25, ${pulseVeinAlpha})`;
      ctx.lineWidth = 2.5;
      
      ctx.beginPath();
      ctx.moveTo(30, 40);
      ctx.bezierCurveTo(150, 100 + veinSeed * 10, 400 - veinSeed * 20, 80 - veinSeed * 5, 570, 150);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(60, 380);
      ctx.bezierCurveTo(220, 300 - veinSeed * 15, 380 + veinSeed * 25, 370, 540, 60);
      ctx.stroke();
      ctx.restore();

      // Draw organic floor grid lines (low opacity dark tissue mesh)
      ctx.strokeStyle = 'rgba(25, 12, 18, 0.45)';
      ctx.lineWidth = 1;
      for (let x = 0; x < canvas.width; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }
      for (let y = 0; y < canvas.height; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }

      // Draw Wall Torches (Bone brackets holding flickering organic bio-fire)
      torches.forEach(t => {
        ctx.save();
        // 1. Draw bracket (bone holder)
        ctx.fillStyle = '#C8C5B9'; // bone color
        ctx.strokeStyle = '#4E4A40'; // shadow outline
        ctx.lineWidth = 1.2;
        
        ctx.beginPath();
        ctx.arc(t.x, t.y + 6, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        
        ctx.beginPath();
        ctx.moveTo(t.x - 2, t.y + 6);
        ctx.lineTo(t.x, t.y - 4);
        ctx.lineTo(t.x + 2, t.y + 6);
        ctx.fillStyle = '#6E6B60';
        ctx.fill();
        ctx.stroke();
        
        // 2. Draw organic flame (flickering bio-fire)
        const flameFlicker = Math.sin(time / 100 + t.x) * 1.5;
        const flameHeight = 11 + flameFlicker;
        const flameWidth = 6 + Math.sin(time / 80 + t.y) * 1.0;
        
        // Outer flame (darker red-orange)
        ctx.fillStyle = '#FF4500';
        ctx.beginPath();
        ctx.moveTo(t.x, t.y - flameHeight - 2);
        ctx.quadraticCurveTo(t.x - flameWidth, t.y - flameHeight * 0.4, t.x - flameWidth * 0.3, t.y);
        ctx.lineTo(t.x + flameWidth * 0.3, t.y);
        ctx.quadraticCurveTo(t.x + flameWidth, t.y - flameHeight * 0.4, t.x, t.y - flameHeight - 2);
        ctx.fill();
        
        // Inner flame (bright orange-yellow)
        ctx.fillStyle = '#FFD700';
        ctx.beginPath();
        ctx.moveTo(t.x, t.y - flameHeight * 0.65);
        ctx.quadraticCurveTo(t.x - flameWidth * 0.5, t.y - flameHeight * 0.3, t.x - flameWidth * 0.15, t.y);
        ctx.lineTo(t.x + flameWidth * 0.15, t.y);
        ctx.quadraticCurveTo(t.x + flameWidth * 0.5, t.y - flameHeight * 0.3, t.x, t.y - flameHeight * 0.65);
        ctx.fill();
        
        // Flame core (white-yellow hot center)
        ctx.fillStyle = '#FFFFE0';
        ctx.beginPath();
        ctx.arc(t.x, t.y - 2, 1.8, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.restore();
      });

      // Draw Environmental Objects on Canvas
      envObjects.forEach(obj => {
        if (!obj.active && obj.type !== 'wall') return; // except wall which turns into shortcut portal

        ctx.save();
        if (obj.type === 'pool') {
          // Toxic Pool: neon-green pond with dark border and bubbles
          ctx.save();
          if (!isLowSpecRef.current) {
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#22C3EE';
          }
          ctx.fillStyle = 'rgba(34, 197, 94, 0.35)'; // neon green
          ctx.strokeStyle = '#15803D'; // dark green border
          ctx.lineWidth = 2;
          
          ctx.beginPath();
          ctx.arc(obj.x, obj.y, 32, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          // Render rising green bubbles
          ctx.fillStyle = 'rgba(74, 222, 128, 0.6)';
          const bubbleSeed = Math.sin(time / 200 + obj.x) * 4;
          ctx.beginPath();
          ctx.arc(obj.x - 12 + bubbleSeed, obj.y - 8 - bubbleSeed, 3, 0, Math.PI * 2);
          ctx.arc(obj.x + 10 - bubbleSeed, obj.y + 12 + bubbleSeed, 2.2, 0, Math.PI * 2);
          ctx.arc(obj.x + 2 + bubbleSeed, obj.y - 14 + bubbleSeed, 1.8, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        } else if (obj.type === 'pillar') {
          // Pulse Column: fleshy column that pulses in size
          const pulse = obj.active ? 1.0 + Math.sin(time / 150 + obj.x) * 0.07 : 1.0;
          const radius = 20 * pulse;
          
          // Draw column shadow
          ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
          ctx.beginPath();
          ctx.arc(obj.x, obj.y + 8, radius, 0, Math.PI * 2);
          ctx.fill();

          // Draw column body
          ctx.fillStyle = obj.active ? '#5A1827' : '#3E272C'; // red-purple or pale grey-brown
          ctx.strokeStyle = obj.active ? '#9B1C31' : '#2A181C';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(obj.x, obj.y, radius, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          // Pulsing core light
          if (obj.active) {
            ctx.fillStyle = '#EF4444';
            if (!isLowSpecRef.current) {
              ctx.shadowBlur = 8;
              ctx.shadowColor = '#EF4444';
            }
            ctx.beginPath();
            ctx.arc(obj.x, obj.y - 2, radius * 0.4, 0, Math.PI * 2);
            ctx.fill();
          }
        } else if (obj.type === 'wall') {
          // Cracked wall: Chitin block with cracks
          if (obj.active) {
            ctx.fillStyle = '#4B3F38'; // brown bone
            ctx.strokeStyle = '#2B231F';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(obj.x, obj.y, 24, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            // Crack lines
            ctx.strokeStyle = '#F97316'; // orange glowing cracks
            ctx.lineWidth = 1.8;
            if (!isLowSpecRef.current) {
              ctx.shadowBlur = 4;
              ctx.shadowColor = '#F97316';
            }
            ctx.beginPath();
            ctx.moveTo(obj.x - 14, obj.y - 8);
            ctx.lineTo(obj.x, obj.y + 4);
            ctx.lineTo(obj.x - 4, obj.y + 15);
            ctx.moveTo(obj.x + 12, obj.y + 10);
            ctx.lineTo(obj.x - 2, obj.y - 2);
            ctx.lineTo(obj.x + 5, obj.y - 12);
            ctx.stroke();
          }
        } else if (obj.type === 'shortcut_portal') {
          // Swirling shortcut portal in place of wall
          const angle = (time / 250) % (Math.PI * 2);
          ctx.save();
          if (!isLowSpecRef.current) {
            ctx.shadowBlur = 12;
            ctx.shadowColor = '#A855F7';
          }
          ctx.strokeStyle = '#C084FC';
          ctx.lineWidth = 2.5;

          ctx.beginPath();
          ctx.arc(obj.x, obj.y, 18, 0, Math.PI * 2);
          ctx.stroke();

          // Swirl spiral lines
          ctx.strokeStyle = 'rgba(168, 85, 247, 0.7)';
          ctx.beginPath();
          ctx.arc(obj.x, obj.y, 12, angle, angle + Math.PI, false);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(obj.x, obj.y, 6, angle + Math.PI, angle + Math.PI * 2, false);
          ctx.stroke();
          ctx.restore();
        } else if (obj.type === 'crystal') {
          // Bioluminescent Crystal: cyan cluster
          ctx.save();
          if (!isLowSpecRef.current) {
            ctx.shadowBlur = 8;
            ctx.shadowColor = '#06B6D4';
          }
          ctx.fillStyle = '#22D3EE';
          ctx.strokeStyle = '#0891B2';
          ctx.lineWidth = 1.5;

          // Renders a diamond crystal cluster
          ctx.beginPath();
          ctx.moveTo(obj.x, obj.y - 15);
          ctx.lineTo(obj.x + 8, obj.y);
          ctx.lineTo(obj.x, obj.y + 15);
          ctx.lineTo(obj.x - 8, obj.y);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = '#E0F7FA'; // bright reflection
          ctx.beginPath();
          ctx.moveTo(obj.x - 6, obj.y - 8);
          ctx.lineTo(obj.x + 6, obj.y + 8);
          ctx.lineTo(obj.x, obj.y);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        } else if (obj.type === 'nest') {
          // Organic Mass (Nest): gross pulsing egg mass
          const nestPulse = 1.0 + Math.sin(time / 220 + obj.x) * 0.05;
          const radius = 24 * nestPulse;
          
          ctx.fillStyle = '#7A1C2C';
          ctx.strokeStyle = '#4A0C14';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.arc(obj.x, obj.y, radius, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          // Yellow/orange pustules on the nest
          ctx.fillStyle = '#F59E0B';
          ctx.beginPath();
          ctx.arc(obj.x - 8, obj.y - 6, 4 * nestPulse, 0, Math.PI * 2);
          ctx.arc(obj.x + 8, obj.y + 4, 3 * nestPulse, 0, Math.PI * 2);
          ctx.arc(obj.x + 4, obj.y - 8, 2.5 * nestPulse, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      });

      // Draw Warden charge warning lines & Stalker teleport warning circles
      enemies.forEach(enemy => {
        if (enemy.hp <= 0) return;
        if (enemy.type === 'warden' && enemy.chargeState === 'prep' && enemy.chargeVx !== undefined && enemy.chargeVy !== undefined) {
          ctx.save();
          ctx.strokeStyle = 'rgba(239, 68, 68, 0.48)';
          ctx.lineWidth = 12;
          ctx.setLineDash([8, 8]);
          
          ctx.beginPath();
          ctx.moveTo(enemy.x, enemy.y);
          ctx.lineTo(enemy.x + enemy.chargeVx * 220, enemy.y + enemy.chargeVy * 220);
          ctx.stroke();
          ctx.restore();
        } else if (enemy.type === 'stalker' && enemy.teleportState === 'prep' && enemy.teleportX !== undefined && enemy.teleportY !== undefined) {
          ctx.save();
          // Pulsing purple dash-outline circle
          ctx.strokeStyle = 'rgba(168, 85, 247, 0.65)';
          ctx.lineWidth = 2.5;
          ctx.setLineDash([5, 5]);
          ctx.beginPath();
          ctx.arc(enemy.teleportX, enemy.teleportY, 22, 0, Math.PI * 2);
          ctx.stroke();
          
          // Filling radial progress circle
          ctx.fillStyle = 'rgba(168, 85, 247, 0.22)';
          ctx.beginPath();
          const elapsedPct = 1.0 - (enemy.teleportTimer || 0) / 600;
          ctx.arc(enemy.teleportX, enemy.teleportY, 22 * Math.max(0, Math.min(1, elapsedPct)), 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      });

      // Draw Room boundaries/Walls outline (thin bounds for safety)
      ctx.strokeStyle = '#050203';
      ctx.lineWidth = 4;
      ctx.strokeRect(2, 2, canvas.width - 4, canvas.height - 4);

      // 4. Update & Draw Items (Visuals disabled on Canvas, rendered via SVG Sprite overlays)
      // Reward Chest
      if (rewardChest && rewardChest.active) {
        // Claim check
        const dist = Math.hypot(player.x - rewardChest.x, player.y - rewardChest.y);
        if (dist < 26 && !rewardChest.opened) {
          rewardChest.opened = true;
          createSparks(rewardChest.x, rewardChest.y, '#C9A84C', 20);
          spawnGoldDrops(rewardChest.x, rewardChest.y, 16);
          // Progressive reward scaling based on room depth
          const rewardMult = 1.0 + (roomsExpandedCount.current - 1) * gameConfig.depthRewardScoreMultiplierPerRoom;
          const expMult = 1.0 + (roomsExpandedCount.current - 1) * gameConfig.depthRewardExpMultiplierPerRoom;
          
          const scoreDifficultyMultiplier = difficulty === 'extreme' ? 2.5 : difficulty === 'hard' ? 1.5 : 1.0;
          const scoreGain = Math.round(1000 * rewardMult * scoreDifficultyMultiplier);
          const expGain = Math.round(45 * expMult);

          // Equipment progression scaling: deeper rooms drop better weapons
          const levelGain = Math.max(1, Math.floor((roomsExpandedCount.current - 1) * gameConfig.equipmentLevelMultiplierRate));
          
          const chestX = rewardChest.x;
          const chestY = rewardChest.y;
          addFloatText(chestX, chestY, `CHEST OPENED! (+${scoreGain})`, '#C9A84C');
          
          setWeaponLevel(prev => {
            const next = prev + levelGain;
            setTimeout(() => {
              addFloatText(chestX, chestY - 22, `WEAPON UPGRADED (Lv.${next})!`, '#FFD700');
            }, 600);
            return next;
          });

          localScore += scoreGain;
          setScore(localScore);
          
          // Exp reward
          localExp = localExp + expGain;
          if (localExp >= maxExp) {
            localExp -= maxExp;
            localLevel += 1;
            setLevel(localLevel);
            onLevelUpRef.current(localLevel);
          }
          setExp(localExp);
        }
      }

      // Escape/Stage Transition Portal
      if (escapePortal && escapePortal.active) {
        // Escape/stage transition check
        const dist = Math.hypot(player.x - escapePortal.x, player.y - escapePortal.y);
        if (dist < 25) {
          if (currentStageRef.current === 3) {
            // Stage 3 cleared! Success Escape / Game Clear Victory!
            onGameOverRef.current({
              score: localScore + 5000, // Victory bonus
              kills: killsCount.current,
              roomsExpanded: roomsExpandedCount.current,
              maxCombo: maxComboRef.current,
              contamination: localContamination,
              survivalTime: survivalTimeRef.current,
              victory: true
            });
          } else {
            // Stage 1 or 2 Boss cleared: Transition to next stage!
            setIsTransitioningStage(true);
            soundManagerRef.current?.playLevelUp(); // Sweep sound

            // Set 2.5 seconds blackout timer for transition
            setTimeout(() => {
              const nextStage = currentStageRef.current + 1;
              setCurrentStage(nextStage);

              // Reset contamination to stage minimums
              const nextStageMinContam = nextStage === 2 ? 25 : 60;
              localContamination = nextStageMinContam;
              setContamination(localContamination);

              // Reset stage room count and map layout
              stageRoomsCount.current = 1;
              localCurrentRoom = { x: 0, y: 0 };
              setCurrentRoom({ x: 0, y: 0 });
              setRooms([{ x: 0, y: 0, type: 'START', explored: true, cleared: true }]);

              player.x = canvas.width / 2;
              player.y = canvas.height / 2;

              // Reset recovery room timers on stage transition
              recoveryDurationRef.current = 0;
              lastHealTickTimeRef.current = 0;
              recoveryCompletedRef.current = false;
              triggeredGoldFlashRef.current = false;

              // Reactivate modules
              modules.forEach(m => {
                m.active = true;
                m.isHit = false;
              });
              setOverlayModules(modules.map(mod => ({ x: mod.x, y: mod.y, dir: mod.dir, active: mod.active, isHit: mod.isHit })));

              enemies = [];
              escapePortal = null;
              setOverlayPortal(null);
              setOverlayEnemies([]);

              spawnMonstersForRoom('START');

              // End transition blackout
              setIsTransitioningStage(false);
            }, 2500);
          }
        }
      }

      // 5. Update & Draw Modules (Drawing disabled on Canvas, rendered by SVG Layer)
      // Collision detection logic preserved below
      // Tutorial: "공격하면 새 방이 열려"
      if (enemies.length === 0) {
        // Draw Expansion indicators on Canvas for all builds
        modules.forEach(m => {
          if (m.active) {
            ctx.save();
            
            const isCarto = selectedBuild === 'cartographer';
            const sonarTime = (Date.now() / 1500) % 1.0;
            const sonarRadius = 15 + sonarTime * 45;
            
            // Cartographer gets emerald green, others get dim organic gold
            ctx.strokeStyle = isCarto 
              ? `rgba(52, 211, 153, ${1.0 - sonarTime})` 
              : `rgba(201, 168, 76, ${0.65 - sonarTime * 0.65})`;
            ctx.lineWidth = isCarto ? 2.0 : 1.2;
            
            if (!isLowSpecRef.current) {
              ctx.shadowColor = isCarto ? '#34D399' : '#C9A84C';
              ctx.shadowBlur = isCarto ? 8 : 4;
            }
            
            ctx.beginPath();
            ctx.arc(m.x, m.y, sonarRadius, 0, Math.PI * 2);
            ctx.stroke();

            // Cartographer gets full sweeping sonar line, others only get soft pulses
            if (isCarto) {
              const sweepAngle = (Date.now() / 900) % (Math.PI * 2);
              ctx.strokeStyle = 'rgba(52, 211, 153, 0.45)';
              ctx.lineWidth = 2;
              ctx.beginPath();
              ctx.moveTo(m.x, m.y);
              ctx.lineTo(m.x + Math.cos(sweepAngle) * 55, m.y + Math.sin(sweepAngle) * 55);
              ctx.stroke();

              ctx.fillStyle = 'rgba(52, 211, 153, 0.06)';
              ctx.beginPath();
              ctx.moveTo(m.x, m.y);
              ctx.arc(m.x, m.y, 55, sweepAngle - 0.45, sweepAngle);
              ctx.closePath();
              ctx.fill();
            }
            
            ctx.restore();
          }
        });

        // Mark current room as cleared if not already
        const currentRoomNode = roomsRef.current.find(r => r.x === localCurrentRoom.x && r.y === localCurrentRoom.y);
        if (currentRoomNode && !currentRoomNode.cleared) {
          setRooms(prev => prev.map(room => {
            if (room.x === localCurrentRoom.x && room.y === localCurrentRoom.y) {
              return { ...room, cleared: true };
            }
            return room;
          }));

          if (localContamination >= 99.9) {
            onUnlockAchievementRef.current?.('contamination100');
          }
        }

        modules.forEach(m => {
          if (m.active) {
            const dist = Math.hypot(player.x - m.x, player.y - m.y);
            if (dist < 80) {
              triggerTutorialHintRef.current("공격하면 새 방이 열려");
            }
          }
        });
      }

      if (interactRequested.current) {
        interactRequested.current = false;
        triggerInteraction();
      }

      // Special Skill Trigger (Q key / mobile SKL button)
      if (skillTriggered.current) {
        skillTriggered.current = false;
        if (!isExhaustedRef.current && localSkillCooldown <= 0) {
          const skillStaminaCost = selectedBuild === 'breaker' ? 50 : selectedBuild === 'striker' ? 30 : selectedBuild === 'guardian' ? 40 : 30;
          const hasEnergyUpg = upgradesRef.current.some(u => u.id === 'stamina_flow');
          let actualSkillCost = hasEnergyUpg ? skillStaminaCost * 0.9 : skillStaminaCost;
          if (dailyRuleRef.current?.id === 'stamina_double') {
            actualSkillCost *= 2;
          }

          
          if (localStamina >= actualSkillCost) {
            const prevStam = localStamina;
            localStamina = Math.max(0, localStamina - actualSkillCost);
            setStamina(localStamina);
            checkStaminaDepletion(prevStam, localStamina);
            
            const baseCooldown = selectedBuild === 'breaker' ? 8000 : selectedBuild === 'striker' ? 5000 : selectedBuild === 'guardian' ? 6000 : 6000;
            localSkillCooldown = baseCooldown;
            setSkillCooldown(localSkillCooldown);
            
            executeSpecialSkill();
          } else {
            addFloatText(player.x, player.y - 12, 'NEED MORE STAMINA', '#EF4444');
          }
        }
      }

      // Dash trigger (L-Shift)
      let dashCost = 20;
      if (dailyRuleRef.current?.id === 'stamina_double') {
        dashCost = 40;
      }
      if (keysPressed.current['shift'] && player.dashCooldown <= 0 && !isExhaustedRef.current) {
        if (localStamina >= dashCost) {
          player.dashTimer = 160; // 160ms fast movement
          player.dashCooldown = 1200; // 1.2s cooldown
          const prev = localStamina;
          localStamina = Math.max(0, localStamina - dashCost);
          setStamina(localStamina);
          createSparks(player.x, player.y, '#C9A84C', 6);
          soundManagerRef.current?.playDash();
          addFloatText(player.x, player.y - 12, `-${dashCost} STAMINA`, '#C9A84C');
          checkStaminaDepletion(prev, localStamina);
        } else {
          // Dash failed due to lack of stamina
          player.dashCooldown = 600; // short penalty cooldown
          addFloatText(player.x, player.y - 12, 'NEED STAMINA (DASH)', '#EF4444');
          soundManagerRef.current?.playGasp();
        }
      }


      // Movement vector
      let mx = 0;
      let my = 0;

      if (keysPressed.current['w'] || keysPressed.current['arrowup']) my = -1;
      if (keysPressed.current['s'] || keysPressed.current['arrowdown']) my = 1;
      if (keysPressed.current['a'] || keysPressed.current['arrowleft']) mx = -1;
      if (keysPressed.current['d'] || keysPressed.current['arrowright']) mx = 1;

      // Handle touch joystick override
      if (touchActive.current) {
        mx = touchDirection.current.x;
        my = touchDirection.current.y;
      }

      // Normalization
      if (mx !== 0 && my !== 0 && !touchActive.current) {
        mx *= 0.7071;
        my *= 0.7071;
      }

      const speedMult = player.dashTimer > 0 ? (selectedBuild === 'striker' ? 3.2 : 2.5) : (isExhaustedRef.current ? 0.5 : 1.0);
      
      player.x += mx * player.speed * speedMult;
      player.y += my * player.speed * speedMult;

      // Keep player inside boundary
      player.x = Math.max(20, Math.min(canvas.width - 20, player.x));
      player.y = Math.max(20, Math.min(canvas.height - 20, player.y));

      // Environmental objects player collision/interaction & timer updates
      envObjects.forEach(obj => {
        // Handle cooldowns for inactive objects
        if (!obj.active) {
          if (obj.type === 'pillar' && obj.cooldown !== undefined) {
            obj.cooldown = Math.max(0, obj.cooldown - delta);
            if (obj.cooldown <= 0) {
              obj.active = true;
              createSparks(obj.x, obj.y, '#C9A84C', 5);
              addFloatText(obj.x, obj.y - 12, 'PILLAR CHARGED', '#C9A84C');
            }
          }
          return;
        }
        
        // Spawn crawler from nests
        if (obj.type === 'nest') {
          obj.lastSpawnTime = (obj.lastSpawnTime || 0) + delta;
          if (obj.lastSpawnTime >= 4000) {
            obj.lastSpawnTime = 0;
            const activeCrawlers = enemies.filter(e => e.type === 'crawler' && e.hp > 0).length;
            if (activeCrawlers < 4) {
              const spawnAngle = Math.random() * Math.PI * 2;
              const spawnDist = 45;
              const spawnX = obj.x + Math.cos(spawnAngle) * spawnDist;
              const spawnY = obj.y + Math.sin(spawnAngle) * spawnDist;
              
              const roomHpFactor = 1.0 + (roomsExpandedCount.current - 1) * gameConfig.roomScalingHpMultiplierPerRoom;
              const roomDmgFactor = 1.0 + (roomsExpandedCount.current - 1) * gameConfig.roomScalingDmgMultiplierPerRoom;
              const diffMult = difficulty === 'extreme' ? 1.7 : difficulty === 'hard' ? 1.3 : 1.0;
              const localStageHpMult = (currentStageRef.current === 1 ? 1.0 : currentStageRef.current === 2 ? 1.6 : 2.4) * roomHpFactor * diffMult;
              const localStageDmgMult = (currentStageRef.current === 1 ? 1.0 : currentStageRef.current === 2 ? 1.5 : 2.0) * roomDmgFactor * diffMult;
              const localStageSpeedMult = currentStageRef.current === 1 ? 1.0 : currentStageRef.current === 2 ? 1.15 : 1.3;

              const baseHp = 30 + localLevel * 10;
              const finalHp = Math.round(baseHp * localStageHpMult);
              const baseDmg = 10;
              const finalDmg = Math.round(baseDmg * localStageDmgMult);
              const baseSpeed = 0.8;
              const finalSpeed = baseSpeed * localStageSpeedMult;
              
              enemies.push({
                x: Math.max(30, Math.min(canvas.width - 30, spawnX)),
                y: Math.max(30, Math.min(canvas.height - 30, spawnY)),
                hp: finalHp,
                maxHp: finalHp,
                baseSpeed: finalSpeed,
                damage: finalDmg,
                isKnocked: false,
                kbX: 0,
                kbY: 0,
                kbPower: 4.0,
                kbTimer: 0,
                attackCooldown: 0,
                attackRange: 28,
                angle: 0,
                type: 'crawler',
                isElite: false,
                warningTimer: 0
              });
              
              createSparks(spawnX, spawnY, '#8B0000', 6);
              addFloatText(spawnX, spawnY - 12, 'NEST SPAWNED MONSTER', '#EF4444');
            }
          }
        }

        const dist = Math.hypot(player.x - obj.x, player.y - obj.y);
        
        if (obj.type === 'pillar') {
          // Pulse column: touch to restore stamina (radius 20)
          if (dist < player.radius + 20) {
            const restored = 25;
            localStamina = Math.min(maxStamina, localStamina + restored);
            setStamina(localStamina);
            
            obj.active = false;
            obj.cooldown = 7000; // 7 seconds cooldown before it pulses again
            
            createSparks(obj.x, obj.y, '#C9A84C', 8);
            addFloatText(obj.x, obj.y - 12, `STAMINA RECOVERED +25`, '#C9A84C');
            soundManagerRef.current?.playLevelUp(); // soft chime
          }
        } else if (obj.type === 'pool') {
          // Toxic Pool: step to increase contamination (radius 32)
          if (dist < 32) {
            let contamMult = difficulty === 'hard' ? 2.0 : 1.0;
            if (dailyRuleRef.current?.id === 'double_contamination') {
              contamMult *= 2;
            }
            localContamination = Math.min(maxStageContam, localContamination + (2.5 * delta / 1000) * contamMult);
            setContamination(localContamination);

            
            if (Math.random() < 0.08) {
              createSparks(player.x, player.y, '#22C3EE', 1);
              if (Math.random() < 0.25) {
                addFloatText(player.x, player.y - 24, 'TOXIC CONTAM!', '#10B981');
              }
            }
          }
        } else if (obj.type === 'wall') {
          // Cracked wall: push back player (radius 24)
          const targetDist = player.radius + 24;
          if (dist < targetDist) {
            const angle = Math.atan2(player.y - obj.y, player.x - obj.x);
            player.x = obj.x + Math.cos(angle) * targetDist;
            player.y = obj.y + Math.sin(angle) * targetDist;
          }
        } else if (obj.type === 'shortcut_portal') {
          // Shortcut Portal: teleport player (radius 18)
          if (dist < player.radius + 18) {
            obj.active = false;
            
            // Trigger transition to a secret reward room!
            setIsTransitioningStage(true);
            soundManagerRef.current?.playLevelUp();
            addFloatText(player.x, player.y - 20, 'TELEPORTING VIA SHORTCUT...', '#C9A84C');
            
            setTimeout(() => {
              const targetX = localCurrentRoom.x + 1;
              const targetY = localCurrentRoom.y;
              localCurrentRoom = { x: targetX, y: targetY };
              setCurrentRoom({ x: targetX, y: targetY });

              const newRoomNode: RoomNode = {
                x: targetX,
                y: targetY,
                type: 'REWARD', // shortcut always teleports to a reward sanctuary/chamber!
                explored: true,
                cleared: true // starting cleared so they can open chest immediately
              };

              setRooms(prev => [...prev, newRoomNode]);
              
              player.x = canvas.width / 2;
              player.y = canvas.height / 2;
              
              recoveryDurationRef.current = 0;
              lastHealTickTimeRef.current = 0;
              recoveryCompletedRef.current = false;
              triggeredGoldFlashRef.current = false;
              
              spawnMonstersForRoom('REWARD');
              setIsTransitioningStage(false);
            }, 1000);
          }
        }
      });

      // Trigger Attack swing
      const attackCost = selectedBuild === 'breaker' ? 30 : selectedBuild === 'striker' ? 12 : selectedBuild === 'guardian' ? 22 : 18;
      const hasEnergyUpg = upgradesRef.current.some(u => u.id === 'stamina_flow');
      let actualCost = hasEnergyUpg ? attackCost * 0.9 : attackCost;
      if (dailyRuleRef.current?.id === 'stamina_double') {
        actualCost *= 2;
      }


      if (mouseClicked.current) {
        if (isExhaustedRef.current) {
          mouseClicked.current = false; // consume input when exhausted
        } else if (player.attackCooldown <= 0 && localStamina >= actualCost) {
          mouseClicked.current = false;
          player.isSwinging = true;
          player.swingProgress = 0.05;
          player.attackCooldown = selectedBuild === 'striker' ? 240 : selectedBuild === 'breaker' ? 520 : selectedBuild === 'guardian' ? 440 : 380;
          
          const prev = localStamina;
          localStamina = Math.max(0, localStamina - actualCost);
          setStamina(localStamina);
          soundManagerRef.current?.playAttack(selectedBuild);
          addFloatText(player.x, player.y - 12, `-${Math.round(actualCost)} STAMINA`, '#C9A84C');
          checkStaminaDepletion(prev, localStamina);

          // Compute attack swing angle (use touch joystick direction if active)
          let aimTargetAngle = null;
          if (autoAimAssistRef.current) {
            let nearestEnemy: Enemy | null = null;
            let nearestDist = Infinity;
            enemies.forEach(enemy => {
              if (enemy.hp > 0) {
                const dist = Math.hypot(enemy.x - player.x, enemy.y - player.y);
                if (dist < nearestDist) {
                  nearestDist = dist;
                  nearestEnemy = enemy;
                }
              }
            });
            if (nearestEnemy) {
              aimTargetAngle = Math.atan2(
                (nearestEnemy as Enemy).y - player.y,
                (nearestEnemy as Enemy).x - player.x
              );
            }
          }

          if (aimTargetAngle !== null) {
            player.swingAngle = aimTargetAngle;
          } else if (touchActive.current && (touchDirection.current.x !== 0 || touchDirection.current.y !== 0)) {
            player.swingAngle = Math.atan2(
              touchDirection.current.y,
              touchDirection.current.x
            );
          } else {
            player.swingAngle = Math.atan2(
              mousePos.current.y - player.y,
              mousePos.current.x - player.x
            );
          }

          // SWING CONTACT DETECTION
          const hitRange = player.swingRadius;
          const arcWidth = Math.PI * 0.7; // ~120 deg sweep
          let rawDmg = selectedBuild === 'breaker' ? 25 : selectedBuild === 'striker' ? 12 : selectedBuild === 'guardian' ? 20 : 16;
          rawDmg *= (1.0 + (weaponLevelRef.current - 1) * gameConfig.weaponDamageScalePerLevel);
          if (upgradesRef.current.some(u => u.id === 'power_surge')) {
            rawDmg *= 1.15;
          }
          if (dailyRuleRef.current?.id === 'glass_cannon') {
            rawDmg *= 2;
          }
          let knockForce = selectedBuild === 'breaker' ? 9.5 : selectedBuild === 'striker' ? 2.5 : selectedBuild === 'guardian' ? 5.5 : 4.5;

          // Apply level-up perks
          const hasPowerUpg = upgradesRef.current.some(u => u.id === 'heavy_impact');
          if (hasPowerUpg) {
            rawDmg *= 1.15;
            knockForce *= 1.25;
          }

          // 1. Contact check with enemies
          const hitList: Enemy[] = [];
          enemies.forEach((enemy) => {
            const dist = Math.hypot(enemy.x - player.x, enemy.y - player.y);
            const enemyHitbox = enemy.isElite ? 22 : 12;
            if (dist > hitRange + enemyHitbox) return;

            const angleToEnemy = Math.atan2(enemy.y - player.y, enemy.x - player.x);
            let diff = Math.abs(angleToEnemy - player.swingAngle);
            diff = Math.atan2(Math.sin(diff), Math.cos(diff)); // normalize diff

            if (Math.abs(diff) <= arcWidth / 2) {
              // HIT SUCCESS!
              hitList.push(enemy);
              const hitAngle = Math.atan2(enemy.y - player.y, enemy.x - player.x);
              const isHeavy = rawDmg >= 22 || selectedBuild === 'breaker' || upgradesRef.current.some(u => u.id === 'heavy_impact');
              const blocked = damageEnemy(enemy, rawDmg, isHeavy, hitAngle);
              
              if (!blocked) {
                enemy.isKnocked = true;
                enemy.kbX = Math.cos(angleToEnemy);
                enemy.kbY = Math.sin(angleToEnemy);
                enemy.kbPower = knockForce;
                enemy.kbTimer = 180; // 180ms knockback force duration
                enemy.angle = angleToEnemy;

                spawnHitParticles(enemy.x, enemy.y);
                addFloatText(enemy.x, enemy.y - 10, String(Math.round(rawDmg)), '#C8432F');
              }
            }
          });

          // Environmental objects contact check
          envObjects.forEach((obj) => {
            if (!obj.active) return;
            
            // Crystals, cracked walls, organic nests can be attacked
            if (obj.type === 'crystal' || obj.type === 'wall' || obj.type === 'nest') {
              const dist = Math.hypot(obj.x - player.x, obj.y - player.y);
              const objHitbox = obj.type === 'nest' ? 25 : obj.type === 'wall' ? 24 : 20;
              if (dist <= hitRange + objHitbox) {
                const angleToObj = Math.atan2(obj.y - player.y, obj.x - player.x);
                let diff = Math.abs(angleToObj - player.swingAngle);
                diff = Math.atan2(Math.sin(diff), Math.cos(diff));
                if (Math.abs(diff) <= arcWidth / 2) {
                  if (obj.type === 'crystal') {
                    obj.active = false;
                    createSparks(obj.x, obj.y, '#22D3EE', 15);
                    soundManagerRef.current?.playHit(obj.x, obj.y, player.x, player.y);
                    
                    // Drop EXP directly
                    const expGain = 40;
                    localExp += expGain;
                    if (localExp >= maxExp) {
                      localExp -= maxExp;
                      localLevel += 1;
                      setLevel(localLevel);
                      onLevelUpRef.current(localLevel);
                    }
                    setExp(localExp);
                    addFloatText(obj.x, obj.y - 14, `CRYSTAL SHATTERED (+40 EXP)`, '#22D3EE');
                  } else if (obj.type === 'nest') {
                    obj.hp = Math.max(0, obj.hp! - rawDmg);
                    createSparks(obj.x, obj.y, '#8B0000', 8); // red blood sparks
                    addFloatText(obj.x, obj.y - 12, `NEST -${Math.round(rawDmg)} HP`, '#EF4444');
                    soundManagerRef.current?.playHit(obj.x, obj.y, player.x, player.y);
                    triggerShake('weak');
                    
                    if (obj.hp <= 0) {
                      obj.active = false;
                      createSparks(obj.x, obj.y, '#8B0000', 25);
                      spawnDeathParticles(obj.x, obj.y);
                      const scoreDifficultyMultiplier = difficulty === 'extreme' ? 2.5 : difficulty === 'hard' ? 1.5 : 1.0;
                      const nestScoreGain = Math.round(500 * scoreDifficultyMultiplier);
                      addFloatText(obj.x, obj.y - 20, `NEST DESTROYED! (+${nestScoreGain} SCORE)`, '#FFD700');
                      localScore += nestScoreGain;
                      setScore(localScore);
                    }
                  } else if (obj.type === 'wall') {
                    // Cracked wall requires heavy attack
                    const isHeavyAttack = rawDmg >= 22 || selectedBuild === 'breaker' || upgradesRef.current.some(u => u.id === 'heavy_impact');
                    if (isHeavyAttack) {
                      obj.hp = Math.max(0, obj.hp! - rawDmg);
                      createSparks(obj.x, obj.y, '#C9A84C', 8);
                      addFloatText(obj.x, obj.y - 12, `WALL CRACKED -${Math.round(rawDmg)}`, '#C9A84C');
                      triggerShake('medium');
                      soundManagerRef.current?.playHit(obj.x, obj.y, player.x, player.y);
                      
                      if (obj.hp <= 0) {
                        obj.active = false;
                        addFloatText(obj.x, obj.y - 25, 'WALL SHATTERED! SHORTCUT REVEALED!', '#3b82f6');
                        createSparks(obj.x, obj.y, '#FFF', 24);
                        triggerShake('strong');
                        soundManagerRef.current?.playLevelUp();
                        
                        // Spawn shortcut portal in its place
                        envObjects.push({
                          id: `shortcut_portal_${Math.random()}`,
                          type: 'shortcut_portal',
                          x: obj.x,
                          y: obj.y,
                          active: true
                        });
                      }
                    } else {
                      // Weak hit
                      addFloatText(obj.x, obj.y - 12, 'TOO WEAK! NEED HEAVY ATTACK', '#94A3B8');
                      createSparks(obj.x, obj.y, '#8A9BA8', 3);
                      soundManagerRef.current?.playHit(obj.x, obj.y, player.x, player.y);
                    }
                  }
                }
              }
            }
          });

          // Combo increases on hit size
          if (hitList.length > 0) {
            const firstHit = hitList[0];
            soundManagerRef.current?.playHit(firstHit.x, firstHit.y, player.x, player.y);
            
            const prevCombo = localCombo;
            localCombo += hitList.length;
            if (localCombo > maxComboRef.current) {
              maxComboRef.current = localCombo;
              setMaxCombo(localCombo);
            }
            setCombo(localCombo);

            if (localCombo >= 10 && prevCombo < 10) {
              onUnlockAchievementRef.current?.('combo10');
            }
            
            // Check if we crossed a multiple of 5 combo (e.g. 5, 10, 15...)
            const oldDiv = Math.floor(prevCombo / 5);
            const newDiv = Math.floor(localCombo / 5);
            if (newDiv > oldDiv && newDiv > 0) {
              setComboExplosionText(`COMBO x${newDiv * 5}!`);
              setComboExplosionKey(k => k + 1);
            }

            localScore += hitList.length * 50;
            setScore(localScore);

            // Hitstop & Camera shake on successful attack
            const isHeavyGraphics = !reduceParticlesRef.current && !isLowSpecRef.current;
            const duration = selectedBuild === 'breaker' 
              ? (isHeavyGraphics ? 85 : 60) 
              : selectedBuild === 'striker' 
                ? (isHeavyGraphics ? 35 : 25) 
                : selectedBuild === 'guardian' 
                  ? (isHeavyGraphics ? 60 : 45) 
                  : (isHeavyGraphics ? 48 : 35);
            hitStopTimer = duration;

            const isShakeAllowed = !disableScreenshakeRef.current && !isLowSpecRef.current;
            const shake = selectedBuild === 'breaker' 
              ? (isShakeAllowed ? 'strong' : 'medium') 
              : selectedBuild === 'striker' 
                ? (isShakeAllowed ? 'medium' : 'weak') 
                : 'medium';
            triggerShake(shake);
          }

          // 2. Contact check with modules
          modules.forEach(m => {
            if (!m.active) return;
            const dist = Math.hypot(m.x - player.x, m.y - player.y);
            if (dist > hitRange) return;

            const angleToMod = Math.atan2(m.y - player.y, m.x - player.x);
            let diff = Math.abs(angleToMod - player.swingAngle);
            diff = Math.atan2(Math.sin(diff), Math.cos(diff));

            if (Math.abs(diff) <= arcWidth / 2) {
              triggerModuleStrike(m);
              soundManagerRef.current?.playHit();
            }
          });
        } else if (player.attackCooldown <= 0 && localStamina < actualCost) {
          mouseClicked.current = false;
          addFloatText(player.x, player.y - 12, 'NEED STAMINA', '#EF4444');
          soundManagerRef.current?.playGasp();
        }
      } else {
        // Reset click buffer if not used
        mouseClicked.current = false;
      }

      // Draw player sword swing arc trail
      if (player.isSwinging) {
        player.swingProgress += delta / 140; // 140ms animation sweep duration
        if (player.swingProgress >= 1.0) {
          player.isSwinging = false;
        } else {
          // Draw arc slice
          const arcWidth = Math.PI * 0.7;
          const startAngle = player.swingAngle - arcWidth / 2;
          const currentAngle = startAngle + arcWidth * player.swingProgress;

          ctx.fillStyle = selectedBuild === 'breaker' ? 'rgba(200, 67, 47, 0.25)' : 'rgba(201, 168, 76, 0.35)';
          ctx.beginPath();
          ctx.moveTo(player.x, player.y);
          ctx.arc(player.x, player.y, player.swingRadius, startAngle, currentAngle, false);
          ctx.closePath();
          ctx.fill();

          // Swing line
          ctx.strokeStyle = selectedBuild === 'breaker' ? '#C8432F' : '#C9A84C';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(player.x, player.y);
          ctx.lineTo(
            player.x + Math.cos(currentAngle) * player.swingRadius,
            player.y + Math.sin(currentAngle) * player.swingRadius
          );
          ctx.stroke();
        }
      }

      // 7. Update & Draw Enemies
      const enemiesToSpawn: Enemy[] = [];
      enemies.forEach((enemy) => {
        if (enemy.attackCooldown > 0) {
          enemy.attackCooldown -= delta;
        }

        if (enemy.warningTimer && enemy.warningTimer > 0) {
          enemy.warningTimer -= delta;
        }

        if (enemy.slowTimer && enemy.slowTimer > 0) {
          enemy.slowTimer = Math.max(0, enemy.slowTimer - delta);
        }

        // Initialize and update custom cooldown timers
        if (enemy.chargeCooldown === undefined) {
          enemy.chargeCooldown = 2000 + Math.random() * 3000;
        } else if (enemy.chargeCooldown > 0) {
          enemy.chargeCooldown -= delta;
        }

        if (enemy.teleportCooldown === undefined) {
          enemy.teleportCooldown = 3000 + Math.random() * 3000;
        } else if (enemy.teleportCooldown > 0) {
          enemy.teleportCooldown -= delta;
        }

        // Warden HP <= 40% Enrage Check
        if (enemy.type === 'warden' && !enemy.isBoss) {
          const healthPct = enemy.hp / enemy.maxHp;
          if (healthPct <= 0.40 && !enemy.isEnraged) {
            enemy.isEnraged = true;
            createSparks(enemy.x, enemy.y, '#EF4444', 8);
            addFloatText(enemy.x, enemy.y - 12, '💥 WARDEN ENRAGED!', '#EF4444');
          }
        }

        // Boss Phase 2 Mutation Check
        if (enemy.isBoss && !enemy.phase2Triggered) {
          const healthPct = enemy.hp / enemy.maxHp;
          if (healthPct <= 0.50) {
            enemy.phase2Triggered = true;
            enemy.bossPhase = 2;
            
            // Phase 2 Flash Overlay & Screen Shake & hit-stop
            setBossPhase2Flash(true);
            setTimeout(() => setBossPhase2Flash(false), 800);
            
            hitStopTimer = 600;
            triggerShake('strong');
            addFloatText(enemy.x, enemy.y - 20, '⚠️ PHASE 2: MUTATION AWOKEN ⚠️', '#EF4444');
            soundManagerRef.current?.playBossRoar(enemy.x, enemy.y, player.x, player.y);
            
            // Custom Phase 2 mutation action
            if (currentStageRef.current === 1) {
              enemy.baseSpeed *= 1.35;
            } else if (currentStageRef.current === 2) {
              enemy.hp = 0; // kill parent body to trigger split
              
              const cloneHp = Math.round(enemy.maxHp * 0.4);
              const cloneMax = Math.round(enemy.maxHp * 0.5);
              
              enemiesToSpawn.push({
                x: Math.max(25, Math.min(canvas.width - 25, enemy.x - 36)),
                y: Math.max(25, Math.min(canvas.height - 25, enemy.y)),
                hp: cloneHp,
                maxHp: cloneMax,
                baseSpeed: enemy.baseSpeed * 1.3,
                damage: Math.round(enemy.damage * 0.65),
                isKnocked: false,
                kbX: 0,
                kbY: 0,
                kbPower: 2.2,
                kbTimer: 0,
                attackCooldown: 0,
                attackRange: 26,
                angle: enemy.angle,
                type: 'crawler',
                isElite: true,
                isBoss: true,
                isMini: true,
                warningTimer: 0,
                phase2Triggered: true,
                bossPhase: 2
              });
              
              enemiesToSpawn.push({
                x: Math.max(25, Math.min(canvas.width - 25, enemy.x + 36)),
                y: Math.max(25, Math.min(canvas.height - 25, enemy.y)),
                hp: cloneHp,
                maxHp: cloneMax,
                baseSpeed: enemy.baseSpeed * 1.3,
                damage: Math.round(enemy.damage * 0.65),
                isKnocked: false,
                kbX: 0,
                kbY: 0,
                kbPower: 2.2,
                kbTimer: 0,
                attackCooldown: 0,
                attackRange: 26,
                angle: enemy.angle,
                type: 'crawler',
                isElite: true,
                isBoss: true,
                isMini: true,
                warningTimer: 0,
                phase2Triggered: true,
                bossPhase: 2
              });
              
              addFloatText(enemy.x, enemy.y - 12, '👥 CORRUPTER SPLIT!', '#10B981');
            }
          }
        }

        // Gatekeeper shield pattern
        if (enemy.isBoss && enemy.type === 'warden' && currentStageRef.current === 1) {
          if (enemy.shieldCooldown === undefined) {
            enemy.shieldCooldown = 3000;
          }
          if (enemy.isShielding) {
            if (enemy.shieldTimer !== undefined) {
              enemy.shieldTimer -= delta;
              if (enemy.shieldTimer <= 0) {
                enemy.isShielding = false;
                enemy.shieldCooldown = 3000;
                addFloatText(enemy.x, enemy.y - 20, '🛡️ SHIELD LOWERED', '#06B6D4');
              }
            }
          } else {
            if (enemy.shieldCooldown > 0) {
              enemy.shieldCooldown -= delta;
            }
            if (enemy.shieldCooldown <= 0 && !enemy.isKnocked) {
              const distToPlayer = Math.hypot(player.x - enemy.x, player.y - enemy.y);
              if (distToPlayer < 200) {
                enemy.isShielding = true;
                enemy.shieldTimer = 1800;
                enemy.shieldCooldown = 3000;
                addFloatText(enemy.x, enemy.y - 20, '🛡️ SHIELD UP!', '#06B6D4');
                soundManagerRef.current?.playShieldClink(enemy.x, enemy.y, player.x, player.y);
              }
            }
          }
        }

        // Corrupter patterns
        if (enemy.isBoss && enemy.type === 'crawler' && currentStageRef.current === 2) {
          // A. Spawning toxic pools
          if (enemy.attackTimer === undefined) {
            enemy.attackTimer = 2500 + Math.random() * 2000;
          } else {
            enemy.attackTimer -= delta;
            if (enemy.attackTimer <= 0) {
              enemy.attackTimer = 3500 + Math.random() * 2000;
              const poolId = `pool_${Date.now()}_${Math.random()}`;
              envObjects.push({
                id: poolId,
                type: 'pool',
                x: player.x,
                y: player.y,
                active: true
              });
              addFloatText(player.x, player.y - 12, '🤢 TOXIC SPIT!', '#10B981');
              createSparks(player.x, player.y, '#10B981', 8);
            }
          }

          // B. Warning contamination roar
          if (enemy.attackCooldown === undefined) {
            enemy.attackCooldown = 5000 + Math.random() * 3000;
          } else if (enemy.chargeState !== 'prep') {
            enemy.attackCooldown -= delta;
            if (enemy.attackCooldown <= 0) {
              enemy.chargeState = 'prep';
              enemy.chargeTimer = 1000;
              enemy.attackCooldown = 6000 + Math.random() * 4000;
            }
          }

          if (enemy.chargeState === 'prep') {
            enemy.chargeTimer = (enemy.chargeTimer || 1000) - delta;
            if (enemy.chargeTimer <= 0) {
              enemy.chargeState = undefined;
              enemy.chargeTimer = undefined;
              
              soundManagerRef.current?.playBossRoar(enemy.x, enemy.y, player.x, player.y);
              triggerShake('medium');
              createSparks(enemy.x, enemy.y, '#10B981', 20);
              
              const isDashing = player.dashTimer > 0 || player.invulnTimer > 0;
              if (isDashing) {
                addFloatText(player.x, player.y - 20, '🛡️ ROAR DODGED!', '#38BDF8');
              } else {
                let contamMult = difficulty === 'hard' ? 2.0 : 1.0;
                if (dailyRuleRef.current?.id === 'double_contamination') {
                  contamMult *= 2;
                }
                const gain = 12 * contamMult;
                localContamination = Math.min(maxStageContam, localContamination + gain);
                setContamination(localContamination);
                addFloatText(player.x, player.y - 20, `🤢 ROAR! CONTAMINATED (+${gain}%)`, '#10B981');
                createSparks(player.x, player.y, '#10B981', 12);
                soundManagerRef.current?.playGasp();
              }

            }
          }
        }

        // Maze Heart stationary locking & pulse
        if (enemy.isBoss && enemy.type === 'stalker' && currentStageRef.current === 3) {
          enemy.x = canvas.width / 2;
          enemy.y = canvas.height / 2;
          enemy.isKnocked = false;

          if (enemy.pulseTimer === undefined) {
            enemy.pulseTimer = 3500;
          } else {
            enemy.pulseTimer -= delta;
            if (enemy.pulseTimer <= 0) {
              enemy.pulseTimer = enemy.bossPhase === 2 ? 1700 : 3500;
              
              activeShockwaves.push({
                x: enemy.x,
                y: enemy.y,
                radius: 10,
                speed: 0.24,
                damageDealt: false
              });
              
              pushSpark({
                x: enemy.x,
                y: enemy.y,
                vx: 0,
                vy: 0,
                color: '#EF4444',
                alpha: 1.0,
                size: 10,
                decay: 0.025,
                type: 'shockwave',
                maxSize: 450,
                growth: 4.2
              });
              
              try {
                const AudioContextClass = window.AudioContext || (window as WebAudioWindow).webkitAudioContext;
                if (AudioContextClass) {
                  const audioCtx = new AudioContextClass();
                  const now = audioCtx.currentTime;
                  const gain = audioCtx.createGain();
                  gain.gain.setValueAtTime(0, now);
                  gain.gain.linearRampToValueAtTime(0.35, now + 0.02);
                  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
                  const osc = audioCtx.createOscillator();
                  osc.type = 'sine';
                  osc.frequency.setValueAtTime(55, now);
                  osc.frequency.linearRampToValueAtTime(30, now + 0.4);
                  osc.connect(gain);
                  gain.connect(audioCtx.destination);
                  osc.start(now);
                  osc.stop(now + 0.4);
                }
              } catch {
                // Optional impact audio.
              }
            }
          }
        }

        // AI Tracking
        if (enemy.isKnocked) {
          enemy.x += enemy.kbX * enemy.kbPower;
          enemy.y += enemy.kbY * enemy.kbPower;
          enemy.kbTimer -= delta;
          if (enemy.kbTimer <= 0) {
            enemy.isKnocked = false;
          }

          // Wall collision check during knockback (slam)
          const hitWall =
            enemy.x <= 15 || enemy.x >= canvas.width - 15 ||
            enemy.y <= 15 || enemy.y >= canvas.height - 15;

          if (hitWall) {
            enemy.isKnocked = false;
            let slamDmg = selectedBuild === 'breaker' ? gameConfig.breakerWallSlamDamage : gameConfig.nonBreakerWallSlamDamage;
            const hasPowerUpg = upgradesRef.current.some(u => u.id === 'heavy_impact');
            if (hasPowerUpg) {
              slamDmg *= gameConfig.heavyImpactWallSlamMultiplier;
            }
            enemy.hp = Math.max(0, enemy.hp - slamDmg);

            // Spawning visual feedback particles
            if (selectedBuild === 'breaker') {
              createSparks(enemy.x, enemy.y, '#C8432F', 24); // Heavy red sparks
              createSparks(enemy.x, enemy.y, '#C9A84C', 16); // Gold sparks
              addFloatText(enemy.x, enemy.y - 12, `💥 BREAKER WALL SLAM! -${Math.round(slamDmg)}`, '#C8432F');
            } else {
              createSparks(enemy.x, enemy.y, '#8A9BA8', 16); // Standard sparks
              addFloatText(enemy.x, enemy.y - 12, `💥 WALL SLAM! -${Math.round(slamDmg)}`, '#C8432F');
            }

            // Increment combo
            localCombo += 1;
            if (localCombo > maxComboRef.current) {
              maxComboRef.current = localCombo;
              setMaxCombo(localCombo);
            }
            setCombo(localCombo);

            enemy.x = Math.max(16, Math.min(canvas.width - 16, enemy.x));
            enemy.y = Math.max(16, Math.min(canvas.height - 16, enemy.y));

            hitStopTimer = 40;
            triggerShake('slam');
            
            // Slam sound effect
            soundManagerRef.current?.playHit(enemy.x, enemy.y, player.x, player.y);
          }
        } else {
          // Wander/AI Movement towards player
          const targetAngle = Math.atan2(player.y - enemy.y, player.x - enemy.x);
          enemy.angle = targetAngle; // face direction of player
          const distToPlayer = Math.hypot(player.x - enemy.x, player.y - enemy.y);
          const speedMult = 1.0 + (localContamination / 100) * gameConfig.contaminationSpeedMultiplierMax;
          const enragedSpeedMult = enemy.isEnraged ? 1.45 : 1.0;
          const slowFactor = (enemy.slowTimer && enemy.slowTimer > 0) ? 0.5 : 1.0;
          
          let speedFactor = 1.0;
          if (enemy.isShielding) {
            speedFactor = 0.6; // slow down when shielding
          }
          if (enemy.type === 'crawler' && enemy.isBoss && enemy.chargeState === 'prep') {
            speedFactor = 0; // stand still during roar prep
          }
          
          let frenzyMult = 1.0;
          if (dailyRuleRef.current?.id === 'monster_frenzy') {
            frenzyMult = 1.3;
          }
          const finalBaseSpeed = enemy.baseSpeed * speedMult * enragedSpeedMult * slowFactor * speedFactor * frenzyMult;


          if (enemy.type === 'crawler') {
            // A. Pack Separation steering
            let sepX = 0;
            let sepY = 0;
            let neighborsCount = 0;
            enemies.forEach(other => {
              if (other !== enemy && other.hp > 0) {
                const d = Math.hypot(other.x - enemy.x, other.y - enemy.y);
                if (d < 32) {
                  sepX += (enemy.x - other.x) / (d || 1);
                  sepY += (enemy.y - other.y) / (d || 1);
                  neighborsCount++;
                }
              }
            });

            // B. Zigzag movement vector
            let moveX = Math.cos(targetAngle);
            let moveY = Math.sin(targetAngle);

            const sideAngle = targetAngle + Math.PI / 2;
            const swayAmplitude = 0.55;
            const swayFrequency = 0.005;
            const lateralSway = Math.sin(time * swayFrequency + enemy.x * 0.05 + enemy.y * 0.05) * swayAmplitude;

            moveX += Math.cos(sideAngle) * lateralSway;
            moveY += Math.sin(sideAngle) * lateralSway;

            // Normalize
            const moveLen = Math.hypot(moveX, moveY);
            if (moveLen > 0) {
              moveX /= moveLen;
              moveY /= moveLen;
            }

            // Apply separation vector
            if (neighborsCount > 0) {
              moveX += (sepX / neighborsCount) * 0.45;
              moveY += (sepY / neighborsCount) * 0.45;
              const finalLen = Math.hypot(moveX, moveY);
              if (finalLen > 0) {
                moveX /= finalLen;
                moveY /= finalLen;
              }
            }

            // Apply speed and move
            const finalSpeed = finalBaseSpeed * (enemy.isMini ? 1.35 : 1.0);
            enemy.x += moveX * finalSpeed;
            enemy.y += moveY * finalSpeed;

          } else if (enemy.type === 'warden') {
            // Warden logic: Charge Attack State Machine
            if (enemy.chargeState === 'prep') {
              if (enemy.chargeTimer === undefined) {
                enemy.chargeTimer = 850;
              } else {
                enemy.chargeTimer -= delta;
              }

              if (enemy.chargeTimer <= 0) {
                enemy.chargeState = 'dash';
                enemy.chargeTimer = 350;
                soundManagerRef.current?.playAttack('cartographer', enemy.x, enemy.y, player.x, player.y);
              }
            } else if (enemy.chargeState === 'dash') {
              if (enemy.chargeTimer !== undefined) {
                enemy.chargeTimer -= delta;
              }

              // Dash forward at high speed (4.5x)
              const dashSpeed = finalBaseSpeed * 4.5;
              enemy.x += (enemy.chargeVx || 0) * dashSpeed;
              enemy.y += (enemy.chargeVy || 0) * dashSpeed;

              if (enemy.chargeTimer && enemy.chargeTimer <= 0) {
                enemy.chargeState = 'recovery';
                enemy.chargeTimer = 650;
              }
            } else if (enemy.chargeState === 'recovery') {
              if (enemy.chargeTimer !== undefined) {
                enemy.chargeTimer -= delta;
              }

              if (enemy.chargeTimer && enemy.chargeTimer <= 0) {
                enemy.chargeState = undefined;
                enemy.chargeTimer = undefined;
              }
            } else {
              // Default Warden tracking movement
              enemy.x += Math.cos(targetAngle) * finalBaseSpeed;
              enemy.y += Math.sin(targetAngle) * finalBaseSpeed;

              // Check if we should trigger a charge
              if (enemy.chargeCooldown !== undefined && enemy.chargeCooldown <= 0 && distToPlayer < 185) {
                enemy.chargeState = 'prep';
                enemy.chargeTimer = 850;
                enemy.chargeCooldown = 5500 + Math.random() * 2000;
                enemy.chargeVx = Math.cos(targetAngle);
                enemy.chargeVy = Math.sin(targetAngle);
              }
            }
          } else if (enemy.type === 'stalker') {
            // Skip movement if stationary Stage 3 Heart Boss
            if (!(enemy.isBoss && currentStageRef.current === 3)) {
              // Stalker logic: Teleport State Machine
              if (enemy.teleportState === 'prep') {
                if (enemy.teleportTimer === undefined) {
                  enemy.teleportTimer = 600;
                } else {
                  enemy.teleportTimer -= delta;
                }

                if (Math.random() < 0.15) {
                  // Spawn warning shadow particles around target teleport point
                  if (enemy.teleportX !== undefined && enemy.teleportY !== undefined) {
                    createSparks(enemy.teleportX, enemy.teleportY, '#A855F7', 1);
                  }
                }

                if (enemy.teleportTimer <= 0) {
                  // Vanish particles
                  createSparks(enemy.x, enemy.y, '#7C3AED', 12);
                  
                  // Teleport
                  if (enemy.teleportX !== undefined && enemy.teleportY !== undefined) {
                    enemy.x = enemy.teleportX;
                    enemy.y = enemy.teleportY;
                  }
                  
                  // Arrive particles
                  createSparks(enemy.x, enemy.y, '#7C3AED', 12);
                  soundManagerRef.current?.playHit(enemy.x, enemy.y, player.x, player.y); // play warp sound

                  enemy.teleportState = undefined;
                  enemy.teleportTimer = undefined;
                }
              } else {
                // Default Stalker tracking
                enemy.x += Math.cos(targetAngle) * finalBaseSpeed;
                enemy.y += Math.sin(targetAngle) * finalBaseSpeed;

                // Teleport trigger check: far enough and cooldown ready
                if (enemy.teleportCooldown !== undefined && enemy.teleportCooldown <= 0 && distToPlayer > 90) {
                  enemy.teleportState = 'prep';
                  enemy.teleportTimer = 600;
                  enemy.teleportCooldown = 4500 + Math.random() * 2000;
                  
                  // Predict point behind the player (based on player move direction mx, my)
                  let pxDir = mx;
                  let pyDir = my;
                  if (pxDir === 0 && pyDir === 0) {
                    // Fallback: use opposite of player-to-enemy vector
                    pxDir = -Math.cos(targetAngle);
                    pyDir = -Math.sin(targetAngle);
                  }
                  const len = Math.hypot(pxDir, pyDir);
                  const behindX = len > 0 ? pxDir / len : 0;
                  const behindY = len > 0 ? pyDir / len : 0;
                  
                  const behindDist = 65;
                  enemy.teleportX = Math.max(30, Math.min(canvas.width - 30, player.x - behindX * behindDist));
                  enemy.teleportY = Math.max(30, Math.min(canvas.height - 30, player.y - behindY * behindDist));
                }
              }
            }
          }
          
          // Clamp coordinates to room walls to avoid glitching out
          enemy.x = Math.max(16, Math.min(canvas.width - 16, enemy.x));
          enemy.y = Math.max(16, Math.min(canvas.height - 16, enemy.y));
        }

        // Draw shield arc on canvas for Gatekeeper
        if (enemy.isBoss && enemy.isShielding && enemy.type === 'warden' && currentStageRef.current === 1) {
          ctx.save();
          ctx.strokeStyle = '#06B6D4'; // cyan-500
          ctx.lineWidth = 4.5;
          if (!isLowSpecRef.current) {
            ctx.shadowColor = '#06B6D4';
            ctx.shadowBlur = 12;
          }
          ctx.beginPath();
          const shieldRadius = 38 * 1.65;
          const startArc = enemy.angle - Math.PI / 3;
          const endArc = enemy.angle + Math.PI / 3;
          ctx.arc(enemy.x, enemy.y, shieldRadius, startArc, endArc);
          ctx.stroke();

          ctx.fillStyle = 'rgba(6, 182, 212, 0.08)';
          ctx.beginPath();
          ctx.moveTo(enemy.x, enemy.y);
          ctx.arc(enemy.x, enemy.y, shieldRadius, startArc, endArc);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }

        // Draw expanding green roar circle for Corrupter
        if (enemy.isBoss && enemy.type === 'crawler' && currentStageRef.current === 2 && enemy.chargeState === 'prep' && enemy.chargeTimer !== undefined) {
          ctx.save();
          ctx.strokeStyle = 'rgba(34, 197, 94, 0.6)';
          ctx.lineWidth = 3;
          if (!isLowSpecRef.current) {
            ctx.shadowColor = '#22C3EE';
            ctx.shadowBlur = 8;
          }
          ctx.beginPath();
          const elapsed = 1000 - enemy.chargeTimer;
          const maxRadius = 160;
          const currentRadius = (elapsed / 1000) * maxRadius;
          ctx.arc(enemy.x, enemy.y, currentRadius, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }

        // Draw enemy shape disabled on Canvas, rendered via SVG layer
        // HP bars are kept on canvas for simple layout overlay, but hide for bosses
        if (enemy.hp < enemy.maxHp && !enemy.isBoss) {
          ctx.fillStyle = '#222';
          ctx.fillRect(enemy.x - 12, enemy.y - 18, 24, 3);
          ctx.fillStyle = '#C8432F';
          ctx.fillRect(enemy.x - 12, enemy.y - 18, 24 * (enemy.hp / enemy.maxHp), 3);
        }

        // Combat Collision with Player
        const dist = Math.hypot(enemy.x - player.x, enemy.y - player.y);
        const enemyRadius = enemy.isElite ? 18 : 11;
        const isStrikerDashInvuln = selectedBuild === 'striker' && player.dashTimer > 0;
        const isPlayerInvuln = player.invulnTimer > 0 || isStrikerDashInvuln;

        if (dist < player.radius + enemyRadius && !isPlayerInvuln) {
          // Calculate damage (double for Warden charge)
          const rawDmg = enemy.chargeState === 'dash' ? enemy.damage * 2.2 : enemy.damage;
          let dmg = rawDmg;
          if (dailyRuleRef.current?.id === 'glass_cannon') {
            dmg *= 2;
          }

          const isHeavyBuild = selectedBuild === 'breaker' || selectedBuild === 'guardian';

          if (isHeavyBuild && rawDmg <= 10) {
            // COMPLETE BLOCK
            player.shieldFlashTimer = 300;
            player.invulnTimer = 600;
            soundManagerRef.current?.playShieldClink(enemy.x, enemy.y, player.x, player.y);

            createSparks(player.x, player.y, '#38BDF8', 5);
            addFloatText(player.x, player.y - 12, 'BLOCK (방어!)', '#38BDF8');
            triggerShake('weak');
            return;
          }

          // Normal Hit or Shield Break (for Heavy Build when rawDmg > 10)
          if (isHeavyBuild) {
            player.shieldShatterTimer = 400;
            createShieldShards(player.x, player.y, 14);
            soundManagerRef.current?.playShieldBreak(enemy.x, enemy.y, player.x, player.y);
          }

          if (selectedBuild === 'guardian') {
            dmg *= gameConfig.guardianDamageReductionMultiplier;
          }
          localHp = Math.max(0, localHp - dmg);
          setHp(localHp);
          soundManagerRef.current?.playHit(enemy.x, enemy.y, player.x, player.y);

          player.invulnTimer = 800; // 800ms invulnerable flash
          createSparks(player.x, player.y, '#C8432F', 10);
          addFloatText(player.x, player.y - 10, `-${Math.round(dmg)}`, '#C8432F');

          // If Warden dash attack, knock player back
          if (enemy.type === 'warden' && enemy.chargeState === 'dash') {
            const hitAngle = Math.atan2(player.y - enemy.y, player.x - enemy.x);
            player.x = Math.max(20, Math.min(canvas.width - 20, player.x + Math.cos(hitAngle) * 45));
            player.y = Math.max(20, Math.min(canvas.height - 20, player.y + Math.sin(hitAngle) * 45));
            triggerShake('medium');
          }
          if (localCombo > 1) {
            setBrokenCombo(localCombo);
            setIsComboBrokenBlackout(true);
            
            // Short screen blackout: clear it after 200ms
            setTimeout(() => {
              setIsComboBrokenBlackout(false);
            }, 200);

            // Clear the broken combo shatter animation after 800ms
            setTimeout(() => {
              setBrokenCombo(null);
            }, 800);
          }
          localCombo = 0;
          setCombo(0); // break combo

          // Hitstop and Screen Shake when Player gets damaged
          hitStopTimer = 80;
          triggerShake('strong');

          if (localHp <= 0) {
            // Player Death Trigger
            setIsDead(true);
            isDeadRef.current = true;
            pausedRef.current = true; // Pause game updates
            soundManagerRef.current?.setPausedFilter(true); // Apply passing out sound sweep

            const finalStats = {
              score: localScore,
              kills: killsCount.current,
              roomsExpanded: roomsExpandedCount.current,
              maxCombo: maxComboRef.current,
              contamination: localContamination,
              survivalTime: survivalTimeRef.current
            };

            setTimeout(() => {
              onGameOverRef.current(finalStats);
            }, 3000);
          }
        }
      });

      // Filter dead enemies, reward EXP
      enemies = enemies.filter(enemy => {
        if (enemy.hp <= 0) {
          killsCount.current += 1;
          setKills(killsCount.current);
          if (killsCount.current === 1) {
            onUnlockAchievementRef.current?.('firstKill');
          }
          const scoreDifficultyMultiplier = difficulty === 'extreme' ? 2.5 : difficulty === 'hard' ? 1.5 : 1.0;
          localScore += Math.round(200 * scoreDifficultyMultiplier);
          setScore(localScore);

          localExp = localExp + 30;
          if (localExp >= maxExp) {
            localExp -= maxExp;
            localLevel += 1;
            setLevel(localLevel);
            onLevelUpRef.current(localLevel);
          }
          setExp(localExp);

           // Spawn organic dissipation particles on death
          spawnDeathParticles(enemy.x, enemy.y);
          spawnGoldDrops(enemy.x, enemy.y, 6);

          // Stalker splits into 2 mini-stalkers on death if not already a minion
          if (enemy.type === 'stalker' && !enemy.isMini) {
            for (let k = 0; k < 2; k++) {
              const angle = Math.random() * Math.PI * 2;
              const spawnX = Math.max(30, Math.min(canvas.width - 30, enemy.x + Math.cos(angle) * 16));
              const spawnY = Math.max(30, Math.min(canvas.height - 30, enemy.y + Math.sin(angle) * 16));
              enemiesToSpawn.push({
                x: spawnX,
                y: spawnY,
                hp: Math.round(enemy.maxHp * 0.35),
                maxHp: Math.round(enemy.maxHp * 0.35),
                baseSpeed: 1.25, // fast mini speed
                damage: Math.round(enemy.damage * 0.5),
                isKnocked: false,
                kbX: 0,
                kbY: 0,
                kbPower: 3.5,
                kbTimer: 0,
                attackCooldown: 0,
                attackRange: 22,
                angle: 0,
                type: 'stalker',
                isElite: false,
                isBoss: false,
                warningTimer: 0,
                isMini: true
              });
            }
            addFloatText(enemy.x, enemy.y - 12, '👥 STALKER SPLIT!', '#A855F7');
          }

          if (enemy.isBoss) {
            // Check if there are other bosses in the list OR spawning in this frame
            const otherBossesAlive = enemies.some(e => e !== enemy && e.isBoss && e.hp > 0);
            const clonesSpawning = enemiesToSpawn.some(e => e.isBoss);
            
            if (!otherBossesAlive && !clonesSpawning) {
              if (currentStageRef.current === 3) {
                // Defeated Stage 3 Final Boss! Trigger Victory Cinematic Sequence!
                isVictoryRef.current = true;
                setIsVictoryCinematic(true);
                setVictoryStep('whiteout');
                soundManagerRef.current?.playVictoryChime();
                
                const scoreDifficultyMultiplier = difficulty === 'extreme' ? 2.5 : difficulty === 'hard' ? 1.5 : 1.0;
                const finalStats = {
                  score: localScore + Math.round(5000 * scoreDifficultyMultiplier), // Victory bonus
                  kills: killsCount.current,
                  roomsExpanded: roomsExpandedCount.current,
                  maxCombo: maxComboRef.current,
                  contamination: localContamination,
                  survivalTime: survivalTimeRef.current,
                  victory: true
                };
                
                // Timeline of Victory Cinematic:
                // 1. Whiteout happens immediately (victoryStep = 'whiteout').
                // 2. At 1.5s, transition to 'purifying' and drain contamination to 0.
                setTimeout(() => {
                  setVictoryStep('purifying');
                  setVisualContamination(localContamination);
                  
                  let currentContam = localContamination;
                  const stepSize = Math.max(1, Math.ceil(localContamination / 40));
                  const contamInterval = setInterval(() => {
                    currentContam -= stepSize;
                    if (currentContam <= 0) {
                      currentContam = 0;
                      clearInterval(contamInterval);
                    }
                    setContamination(currentContam);
                    setVisualContamination(currentContam);
                  }, 40);
                }, 1500);
                
                // 3. At 4.2s, transition to 'exit_run' and show survivor walking into the door.
                setTimeout(() => {
                  setVictoryStep('exit_run');
                }, 4200);
                
                // 4. At 9.0s, transition to the Results Screen.
                setTimeout(() => {
                  setVictoryStep('done');
                  onGameOverRef.current(finalStats);
                }, 9000);
              } else {
                // Stage 1 or 2 Boss defeated! Spawn Portal
                escapePortal = { x: canvas.width / 2, y: canvas.height / 2, active: true };
                setOverlayPortal({ x: escapePortal.x, y: escapePortal.y, active: true });
                soundManagerRef.current?.playVictoryChime();
                addFloatText(canvas.width / 2, canvas.height / 2 - 20, 'STAGE NEST PURGED!', '#FFD700');
                triggerShake('strong');
              }
            }
          }

          return false;
        }
        return true;
      });

      if (enemiesToSpawn.length > 0) {
        enemies.push(...enemiesToSpawn);
      }

      // 8. Draw Player avatar shape disabled on Canvas, rendered via SVG layer
      // Sparks are kept on canvas for maximum visual performance

      // Render glowing heavy shields (flash / shatter) on Canvas
      const isHeavyBuild = selectedBuild === 'breaker' || selectedBuild === 'guardian';
      if (isHeavyBuild) {
        if (player.shieldFlashTimer > 0) {
          ctx.save();
          const opacity = Math.min(1.0, player.shieldFlashTimer / 300);
          ctx.strokeStyle = `rgba(103, 232, 249, ${opacity})`;
          ctx.lineWidth = 3;
          if (!isLowSpecRef.current) {
            ctx.shadowColor = '#67E8F9';
            ctx.shadowBlur = 14;
          }
          // Draw hexagon shield
          ctx.beginPath();
          const shieldRadius = player.radius + 12;
          for (let i = 0; i < 6; i++) {
            const angle = (i * Math.PI) / 3;
            const sx = player.x + Math.cos(angle) * shieldRadius;
            const sy = player.y + Math.sin(angle) * shieldRadius;
            if (i === 0) ctx.moveTo(sx, sy);
            else ctx.lineTo(sx, sy);
          }
          ctx.closePath();
          ctx.stroke();

          // Soft translucent cyan fill
          ctx.fillStyle = `rgba(103, 232, 249, ${opacity * 0.16})`;
          ctx.fill();
          ctx.restore();
        }

        if (player.shieldShatterTimer > 0) {
          ctx.save();
          const fraction = (400 - player.shieldShatterTimer) / 400; // 0 to 1
          const opacity = Math.min(1.0, player.shieldShatterTimer / 400);
          ctx.strokeStyle = `rgba(239, 68, 68, ${opacity})`;
          ctx.lineWidth = 2.5;
          if (!isLowSpecRef.current) {
            ctx.shadowColor = '#EF4444';
            ctx.shadowBlur = 10;
          }
          // Draw fractured hexagon segments expanding outwards
          const shieldRadius = player.radius + 12 + fraction * 18;
          for (let i = 0; i < 6; i++) {
            const angle = (i * Math.PI) / 3;
            const startAngle = angle + 0.08;
            const endAngle = angle + Math.PI / 3 - 0.08;
            ctx.beginPath();
            ctx.arc(player.x, player.y, shieldRadius, startAngle, endAngle);
            ctx.stroke();
          }
          ctx.restore();
        }
      }

      // 9. Sparks drawing
      sparks.forEach(s => {
        // Apply magnetic pull for gold items towards player
        if (s.type === 'gold-item') {
          const dx = player.x - s.x;
          const dy = player.y - s.y;
          const dist = Math.hypot(dx, dy);
          if (dist > 12) {
            const pullForce = Math.min(2.5, 0.2 + (150 / (dist + 10)));
            s.vx = s.vx * 0.82 + (dx / dist) * pullForce;
            s.vy = s.vy * 0.82 + (dy / dist) * pullForce;
          } else {
            s.alpha = 0; // instantly decay/collect
          }
        }

        s.x += s.vx;
        s.y += s.vy;
        
        // Add organic drag / deceleration to mist & blood
        if (s.type === 'blood' || s.type === 'dust') {
          s.vx *= 0.94;
          s.vy *= 0.94;
        }
        if (s.type === 'shield-shard') {
          s.rotation = (s.rotation || 0) + (s.rotSpeed || 0);
          s.vx *= 0.96;
          s.vy *= 0.96;
        }

        s.alpha -= s.decay;
        
        // Optimize: skip rendering offscreen particles
        if (s.x < -20 || s.x > canvas.width + 20 || s.y < -20 || s.y > canvas.height + 20) {
          return;
        }

        ctx.globalAlpha = Math.max(0, s.alpha);

        if (s.type === 'blood') {
          // Organic fluid splatter blob
          ctx.fillStyle = s.color;
          ctx.beginPath();
          ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
          ctx.fill();
        } else if (s.type === 'gold-item') {
          // Diamond glowing gold coin item
          ctx.save();
          ctx.fillStyle = s.color;
          if (!isLowSpecRef.current) {
            ctx.shadowColor = '#FFD700';
            ctx.shadowBlur = 8;
          }
          ctx.beginPath();
          ctx.moveTo(s.x, s.y - s.size);
          ctx.lineTo(s.x + s.size, s.y);
          ctx.lineTo(s.x, s.y + s.size);
          ctx.lineTo(s.x - s.size, s.y);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        } else if (s.type === 'shield-shard') {
          // Sharp glowing triangle/polygon shard
          ctx.save();
          ctx.translate(s.x, s.y);
          ctx.rotate(s.rotation || 0);
          ctx.fillStyle = s.color;
          if (!isLowSpecRef.current) {
            ctx.shadowColor = s.color;
            ctx.shadowBlur = 6;
          }
          ctx.beginPath();
          // Draw small triangle shard
          ctx.moveTo(0, -s.size);
          ctx.lineTo(s.size * 0.7, s.size * 0.5);
          ctx.lineTo(-s.size * 0.7, s.size * 0.5);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        } else if (s.type === 'spark') {
          // Sharp glowing line spark
          ctx.strokeStyle = s.color;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(s.x, s.y);
          ctx.lineTo(s.x - s.vx * 2, s.y - s.vy * 2);
          ctx.stroke();
        } else if (s.type === 'dust') {
          // Fleshy spiky chunks / spores
          ctx.fillStyle = s.color;
          ctx.beginPath();
          ctx.moveTo(s.x, s.y - s.size);
          ctx.lineTo(s.x + s.size, s.y + s.size);
          ctx.lineTo(s.x - s.size, s.y + s.size);
          ctx.closePath();
          ctx.fill();
        } else if (s.type === 'shockwave') {
          // Expanding shockwave ring
          if (s.growth && s.maxSize) {
            s.size = Math.min(s.maxSize, s.size + s.growth);
          }
          ctx.strokeStyle = s.color;
          ctx.lineWidth = 2.5 * s.alpha;
          ctx.beginPath();
          ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
          ctx.stroke();
        }
      });
      ctx.globalAlpha = 1.0; // reset
      sparks = sparks.filter(s => s.alpha > 0);

      // 10. Damage floats drawing
      floatTexts.forEach(f => {
        f.y -= 0.6;
        f.alpha -= 0.02;

        // Optimize: skip rendering offscreen float texts
        if (f.x < -20 || f.x > canvas.width + 20 || f.y < -20 || f.y > canvas.height + 20) {
          return;
        }

        ctx.font = textSizeRef.current === 'large' ? 'bold 13px Outfit, sans-serif' : '9px Outfit';
        ctx.fillStyle = f.color;
        ctx.textAlign = 'center';
        ctx.globalAlpha = Math.max(0, f.alpha);
        ctx.fillText(f.text, f.x, f.y);
      });
      ctx.globalAlpha = 1.0;
      floatTexts = floatTexts.filter(f => f.alpha > 0);

      // --- LIGHTING OVERLAY SYSTEM ---
      if (lightCtx && lightCanvas) {
        lightCtx.clearRect(0, 0, lightCanvas.width, lightCanvas.height);
        
        // Base ambient opacity: if current room is cleared, base darkness is 70% (30% light). If not, it is 100% dark (0% light).
        const isRoomCleared = roomsRef.current.find(r => r.x === localCurrentRoom.x && r.y === localCurrentRoom.y)?.cleared ?? false;
        const ambientOpacity = isRoomCleared ? 0.70 : 1.0;
        
        // Set fill style (reddish tint in deep zones / high contamination)
        const isDeepOrHighContam = currentStageRef.current === 3 || localContamination >= 76;
        const baseDarkColor = isDeepOrHighContam 
          ? `rgba(24, 2, 4, ${ambientOpacity})` 
          : `rgba(3, 2, 5, ${ambientOpacity})`;
        
        lightCtx.fillStyle = baseDarkColor;
        lightCtx.fillRect(0, 0, lightCanvas.width, lightCanvas.height);
        
        // Carve out light circles (destination-out mode)
        lightCtx.globalCompositeOperation = 'destination-out';
        
        // A. Player Spotlight
        const baseRadius = difficulty === 'extreme' ? 90 : 185;
        const contamFactor = Math.min(100, Math.max(0, localContamination)) / 100;
        let playerRadius = baseRadius * (1.0 - contamFactor * 0.45);
        if (isDeepOrHighContam || difficulty === 'extreme') {
          playerRadius = Math.max(68, playerRadius * 0.55);
        }
        const playerFlicker = 1.0 + Math.sin(time / 250) * 0.02;
        playerRadius *= playerFlicker;
        if (dailyRuleRef.current?.id === 'blindness') {
          playerRadius *= 0.5;
        }

        
        const playerGrad = lightCtx.createRadialGradient(player.x, player.y, playerRadius * 0.15, player.x, player.y, playerRadius);
        playerGrad.addColorStop(0, 'rgba(0, 0, 0, 1.0)');
        playerGrad.addColorStop(0.5, 'rgba(0, 0, 0, 0.7)');
        playerGrad.addColorStop(1.0, 'rgba(0, 0, 0, 0)');
        
        lightCtx.fillStyle = playerGrad;
        lightCtx.beginPath();
        lightCtx.arc(player.x, player.y, playerRadius, 0, Math.PI * 2);
        lightCtx.fill();
        
        // B. Torches
        torches.forEach(t => {
          const torchFlicker = 1.0 + Math.sin(time / 120 + t.x) * 0.08 + Math.random() * 0.03;
          const torchRadius = 65 * torchFlicker;
          
          const torchGrad = lightCtx.createRadialGradient(t.x, t.y, torchRadius * 0.1, t.x, t.y, torchRadius);
          torchGrad.addColorStop(0, 'rgba(0, 0, 0, 1.0)');
          torchGrad.addColorStop(0.4, 'rgba(0, 0, 0, 0.5)');
          torchGrad.addColorStop(1.0, 'rgba(0, 0, 0, 0)');
          
          lightCtx.fillStyle = torchGrad;
          lightCtx.beginPath();
          lightCtx.arc(t.x, t.y, torchRadius, 0, Math.PI * 2);
          lightCtx.fill();
        });
        
        // C. Expansion Modules
        modules.forEach(m => {
          if (m.active) {
            const modRadius = 85 * (1.0 + Math.sin(time / 180 + m.x) * 0.04);
            const modGrad = lightCtx.createRadialGradient(m.x, m.y, modRadius * 0.2, m.x, m.y, modRadius);
            modGrad.addColorStop(0, 'rgba(0, 0, 0, 1.0)');
            modGrad.addColorStop(0.5, 'rgba(0, 0, 0, 0.4)');
            modGrad.addColorStop(1.0, 'rgba(0, 0, 0, 0)');
            
            lightCtx.fillStyle = modGrad;
            lightCtx.beginPath();
            lightCtx.arc(m.x, m.y, modRadius, 0, Math.PI * 2);
            lightCtx.fill();
          }
        });
        
        // D. Reward Chests
        if (rewardChest && rewardChest.active) {
          const chestRadius = rewardChest.opened ? 40 : 80;
          const chestGrad = lightCtx.createRadialGradient(rewardChest.x, rewardChest.y, chestRadius * 0.1, rewardChest.x, rewardChest.y, chestRadius);
          chestGrad.addColorStop(0, 'rgba(0, 0, 0, 1.0)');
          chestGrad.addColorStop(0.5, 'rgba(0, 0, 0, 0.5)');
          chestGrad.addColorStop(1.0, 'rgba(0, 0, 0, 0)');
          
          lightCtx.fillStyle = chestGrad;
          lightCtx.beginPath();
          lightCtx.arc(rewardChest.x, rewardChest.y, chestRadius, 0, Math.PI * 2);
          lightCtx.fill();
        }
        
        // E. Escape Portal
        if (escapePortal && escapePortal.active) {
          const portalRadius = 95;
          const portalGrad = lightCtx.createRadialGradient(escapePortal.x, escapePortal.y, portalRadius * 0.1, escapePortal.x, escapePortal.y, portalRadius);
          portalGrad.addColorStop(0, 'rgba(0, 0, 0, 1.0)');
          portalGrad.addColorStop(0.6, 'rgba(0, 0, 0, 0.4)');
          portalGrad.addColorStop(1.0, 'rgba(0, 0, 0, 0)');
          
          lightCtx.fillStyle = portalGrad;
          lightCtx.beginPath();
          lightCtx.arc(escapePortal.x, escapePortal.y, portalRadius, 0, Math.PI * 2);
          lightCtx.fill();
        }
        
        // F. Gold Items
        sparks.forEach(s => {
          if (s.type === 'gold-item') {
            const goldRadius = 15;
            const goldGrad = lightCtx.createRadialGradient(s.x, s.y, 1, s.x, s.y, goldRadius);
            goldGrad.addColorStop(0, 'rgba(0, 0, 0, 1.0)');
            goldGrad.addColorStop(1.0, 'rgba(0, 0, 0, 0)');
            
            lightCtx.fillStyle = goldGrad;
            lightCtx.beginPath();
            lightCtx.arc(s.x, s.y, goldRadius, 0, Math.PI * 2);
            lightCtx.fill();
          }
        });

        // G. Environmental Objects
        envObjects.forEach(obj => {
          if (!obj.active && obj.type !== 'wall') return; // except wall which turns into shortcut portal
          let radius = 0;
          if (obj.type === 'crystal') {
            radius = 45;
          } else if (obj.type === 'pillar' && obj.active) {
            radius = 35;
          } else if (obj.type === 'nest' && obj.active) {
            radius = 40;
          } else if (obj.type === 'shortcut_portal') {
            radius = 60;
          }
          if (radius > 0) {
            const objGrad = lightCtx.createRadialGradient(obj.x, obj.y, radius * 0.1, obj.x, obj.y, radius);
            objGrad.addColorStop(0, 'rgba(0, 0, 0, 1.0)');
            objGrad.addColorStop(0.5, 'rgba(0, 0, 0, 0.4)');
            objGrad.addColorStop(1.0, 'rgba(0, 0, 0, 0)');
            
            lightCtx.fillStyle = objGrad;
            lightCtx.beginPath();
            lightCtx.arc(obj.x, obj.y, radius, 0, Math.PI * 2);
            lightCtx.fill();
          }
        });
        
        // Restore composite operation for optional glows
        lightCtx.globalCompositeOperation = 'source-over';
        
        // Draw emissive glows (Screen blend mode, disabled in low-spec for performance)
        if (!isLowSpecRef.current) {
          lightCtx.globalCompositeOperation = 'screen';
          
          // Player red aura if in Deep / High Contamination
          if (isDeepOrHighContam) {
            const playerGlowGrad = lightCtx.createRadialGradient(player.x, player.y, 2, player.x, player.y, playerRadius);
            playerGlowGrad.addColorStop(0, 'rgba(220, 20, 20, 0.22)');
            playerGlowGrad.addColorStop(0.6, 'rgba(160, 10, 10, 0.08)');
            playerGlowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
            
            lightCtx.fillStyle = playerGlowGrad;
            lightCtx.beginPath();
            lightCtx.arc(player.x, player.y, playerRadius, 0, Math.PI * 2);
            lightCtx.fill();
          }
          
          // Torches (warm fire glow)
          torches.forEach(t => {
            const torchFlicker = 1.0 + Math.sin(time / 120 + t.x) * 0.08 + Math.random() * 0.03;
            const glowRadius = 75 * torchFlicker;
            const glowGrad = lightCtx.createRadialGradient(t.x, t.y, 2, t.x, t.y, glowRadius);
            glowGrad.addColorStop(0, 'rgba(235, 110, 15, 0.40)');
            glowGrad.addColorStop(0.4, 'rgba(190, 60, 10, 0.15)');
            glowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
            
            lightCtx.fillStyle = glowGrad;
            lightCtx.beginPath();
            lightCtx.arc(t.x, t.y, glowRadius, 0, Math.PI * 2);
            lightCtx.fill();
          });
          
          // Expansion Modules (soft pinkish-red pulse)
          modules.forEach(m => {
            if (m.active) {
              const glowRadius = 90 * (1.0 + Math.sin(time / 180 + m.x) * 0.04);
              const glowGrad = lightCtx.createRadialGradient(m.x, m.y, 2, m.x, m.y, glowRadius);
              glowGrad.addColorStop(0, 'rgba(219, 39, 119, 0.25)');
              glowGrad.addColorStop(0.5, 'rgba(157, 23, 77, 0.1)');
              glowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
              
              lightCtx.fillStyle = glowGrad;
              lightCtx.beginPath();
              lightCtx.arc(m.x, m.y, glowRadius, 0, Math.PI * 2);
              lightCtx.fill();
            }
          });
          
          // Reward Chest (golden sheen)
          if (rewardChest && rewardChest.active) {
            const glowRadius = rewardChest.opened ? 45 : 85;
            const glowGrad = lightCtx.createRadialGradient(rewardChest.x, rewardChest.y, 2, rewardChest.x, rewardChest.y, glowRadius);
            glowGrad.addColorStop(0, 'rgba(201, 168, 76, 0.5)');
            glowGrad.addColorStop(0.4, 'rgba(150, 120, 40, 0.15)');
            glowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
            
            lightCtx.fillStyle = glowGrad;
            lightCtx.beginPath();
            lightCtx.arc(rewardChest.x, rewardChest.y, glowRadius, 0, Math.PI * 2);
            lightCtx.fill();
          }
          
          // Portal (glowing blue vortex light)
          if (escapePortal && escapePortal.active) {
            const glowRadius = 100;
            const glowGrad = lightCtx.createRadialGradient(escapePortal.x, escapePortal.y, 2, escapePortal.x, escapePortal.y, glowRadius);
            glowGrad.addColorStop(0, 'rgba(59, 130, 246, 0.40)');
            glowGrad.addColorStop(0.5, 'rgba(29, 78, 216, 0.15)');
            glowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
            
            lightCtx.fillStyle = glowGrad;
            lightCtx.beginPath();
            lightCtx.arc(escapePortal.x, escapePortal.y, glowRadius, 0, Math.PI * 2);
            lightCtx.fill();
          }
          
          // Gold items (gold spark trail)
          sparks.forEach(s => {
            if (s.type === 'gold-item') {
              const goldRadius = 20;
              const glowGrad = lightCtx.createRadialGradient(s.x, s.y, 1, s.x, s.y, goldRadius);
              glowGrad.addColorStop(0, 'rgba(255, 215, 0, 0.40)');
              glowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
              
              lightCtx.fillStyle = glowGrad;
              lightCtx.beginPath();
              lightCtx.arc(s.x, s.y, goldRadius, 0, Math.PI * 2);
              lightCtx.fill();
            }
          });

          // G. Environmental Objects Emissive Glows
          envObjects.forEach(obj => {
            if (!obj.active && obj.type !== 'wall') return; // except wall which turns into shortcut portal
            if (obj.type === 'crystal') {
              // Cyan glow
              const glowGrad = lightCtx.createRadialGradient(obj.x, obj.y, 2, obj.x, obj.y, 45);
              glowGrad.addColorStop(0, 'rgba(34, 211, 238, 0.40)');
              glowGrad.addColorStop(0.5, 'rgba(6, 182, 212, 0.15)');
              glowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
              
              lightCtx.fillStyle = glowGrad;
              lightCtx.beginPath();
              lightCtx.arc(obj.x, obj.y, 45, 0, Math.PI * 2);
              lightCtx.fill();
            } else if (obj.type === 'pillar' && obj.active) {
              // Red glow
              const glowGrad = lightCtx.createRadialGradient(obj.x, obj.y, 2, obj.x, obj.y, 35);
              glowGrad.addColorStop(0, 'rgba(239, 68, 68, 0.35)');
              glowGrad.addColorStop(0.5, 'rgba(185, 28, 28, 0.12)');
              glowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
              
              lightCtx.fillStyle = glowGrad;
              lightCtx.beginPath();
              lightCtx.arc(obj.x, obj.y, 35, 0, Math.PI * 2);
              lightCtx.fill();
            } else if (obj.type === 'nest' && obj.active) {
              // Dark Red glow
              const glowGrad = lightCtx.createRadialGradient(obj.x, obj.y, 2, obj.x, obj.y, 40);
              glowGrad.addColorStop(0, 'rgba(220, 38, 38, 0.30)');
              glowGrad.addColorStop(0.5, 'rgba(127, 29, 29, 0.10)');
              glowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
              
              lightCtx.fillStyle = glowGrad;
              lightCtx.beginPath();
              lightCtx.arc(obj.x, obj.y, 40, 0, Math.PI * 2);
              lightCtx.fill();
            } else if (obj.type === 'shortcut_portal') {
              // Violet/Purple glow
              const glowGrad = lightCtx.createRadialGradient(obj.x, obj.y, 2, obj.x, obj.y, 60);
              glowGrad.addColorStop(0, 'rgba(168, 85, 247, 0.40)');
              glowGrad.addColorStop(0.5, 'rgba(109, 40, 217, 0.15)');
              glowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
              
              lightCtx.fillStyle = glowGrad;
              lightCtx.beginPath();
              lightCtx.arc(obj.x, obj.y, 60, 0, Math.PI * 2);
              lightCtx.fill();
            }
          });
          
          lightCtx.globalCompositeOperation = 'source-over';
        }
      }

      // 11. Draw FPS Counter (dev mode or capture mode only)
      const showFps = isCaptureMode || import.meta.env.DEV;
      if (showFps) {
        ctx.save();
        ctx.font = '10px monospace';
        ctx.fillStyle = '#4AF626'; // Cyber green
        ctx.textAlign = 'right';
        ctx.fillText(`FPS: ${fpsVal.current}`, canvas.width - 25, 20);
        ctx.restore();
      }

      // Track player coordinates history
      playerHistory.push({
        x: player.x,
        y: player.y,
        isMoving: mx !== 0 || my !== 0 || touchActive.current,
        isAttacking: player.isSwinging
      });
      if (playerHistory.length > 25) {
        playerHistory.shift();
      }

      // Update active Heart pulse shockwaves & collision check
      activeShockwaves.forEach(sw => {
        sw.radius += sw.speed * delta;
        
        const dist = Math.hypot(player.x - sw.x, player.y - sw.y);
        if (dist <= sw.radius && !sw.damageDealt) {
          sw.damageDealt = true;
          
          const isPlayerInvuln = player.invulnTimer > 0 || player.dashTimer > 0;
          if (isPlayerInvuln) {
            addFloatText(player.x, player.y - 20, '🛡️ PULSE DODGED!', '#38BDF8');
          } else {
            let pulseDmg = 8;
            if (dailyRuleRef.current?.id === 'glass_cannon') {
              pulseDmg *= 2;
            }
            localHp = Math.max(0, localHp - pulseDmg);
            setHp(localHp);
            const maxStageContam = currentStageRef.current === 1 ? 25 : currentStageRef.current === 2 ? 60 : 100;
            let contamMult = difficulty === 'hard' ? 2.0 : 1.0;
            if (dailyRuleRef.current?.id === 'double_contamination') {
              contamMult *= 2;
            }
            const gain = 3 * contamMult;
            localContamination = Math.min(maxStageContam, localContamination + gain);
            setContamination(localContamination);
            soundManagerRef.current?.playHit();
            addFloatText(player.x, player.y - 20, `💥 HEART PULSE! (-${pulseDmg} HP, +${gain}% Contam)`, '#EF4444');
            triggerShake('medium');

            
            // Check player death
            if (localHp <= 0) {
              setIsDead(true);
              isDeadRef.current = true;
              pausedRef.current = true;
              soundManagerRef.current?.setPausedFilter(true);
              const finalStats = {
                score: localScore,
                kills: killsCount.current,
                roomsExpanded: roomsExpandedCount.current,
                maxCombo: maxComboRef.current,
                contamination: localContamination,
                survivalTime: survivalTimeRef.current
              };
              setTimeout(() => {
                onGameOverRef.current(finalStats);
              }, 3000);
            }
          }
        }
      });
      activeShockwaves = activeShockwaves.filter(sw => sw.radius < 500);

      // Track and calculate total Boss HP for HUD HP bar
      const bossList = enemies.filter(e => e.isBoss && e.hp > 0);
      if (bossList.length > 0) {
        const totalHp = bossList.reduce((sum, b) => sum + b.hp, 0);
        const totalMaxHp = bossList.reduce((sum, b) => sum + b.maxHp, 0);
        const currentPhase = bossList.some(b => b.bossPhase === 2) ? 2 : 1;
        setActiveBoss({
          name: bossList[0].type === 'stalker' 
            ? 'STAGE 3 BOSS: MAZE HEART' 
            : bossList[0].type === 'warden' 
            ? 'STAGE 1 BOSS: GATEKEEPER' 
            : 'STAGE 2 BOSS: CORRUPTER',
          hp: totalHp,
          maxHp: totalMaxHp,
          phase: currentPhase
        });
      } else {
        setActiveBoss(null);
      }

      hasDrawnFrame = true;
      // Sync overlay elements state for React rendering
      setOverlayPlayer({
        x: player.x,
        y: player.y,
        isMoving: mx !== 0 || my !== 0 || touchActive.current,
        isAttacking: player.isSwinging,
        dashTimer: player.dashTimer,
        history: [...playerHistory]
      });

      setOverlayEnemies(
        enemies.map(e => ({
          x: e.x,
          y: e.y,
          isHit: e.isKnocked,
          isMoving: !e.isKnocked && !e.chargeState && !e.teleportState,
          type: e.type,
          isElite: e.isElite,
          isBoss: e.isBoss,
          warningTimer: e.warningTimer,
          isMini: e.isMini,
          isEnraged: e.isEnraged,
          chargeState: e.chargeState,
          teleportState: e.teleportState,
          isSlowed: e.slowTimer !== undefined && e.slowTimer > 0,
          isShielding: e.isShielding
        }))
      );

      setOverlayModules(modules.map(m => ({ x: m.x, y: m.y, dir: m.dir, active: m.active, isHit: m.isHit })));
      setOverlayChest(rewardChest ? { x: rewardChest.x, y: rewardChest.y, opened: rewardChest.opened } : null);
      setOverlayPortal(escapePortal ? { x: escapePortal.x, y: escapePortal.y, active: escapePortal.active } : null);

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    triggerInteractionRef.current = triggerInteraction;

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      canvas.removeEventListener('mousedown', handleCanvasMouseDown);
      canvas.removeEventListener('mousemove', handleMouseMove);
      if (shakeTimeoutId) clearTimeout(shakeTimeoutId);
      triggerInteractionRef.current = null;
    };
  }, [
    selectedBuild,
    isCaptureMode,
    initialHp,
    initialStamina,
    initialExp,
    initialLevel,
    initialScore,
    initialContamination,
    dailySeed,
    difficulty,
    isDailyChallenge,
    maxStamina
  ]);

  // Mobile touch joystick movement handlers
  const handleJoystickTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!joystickContainerRef.current) return;
    const rect = joystickContainerRef.current.getBoundingClientRect();
    joystickCenterRef.current = {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2
    };
    handleJoystickTouchMove(e);
  };

  const handleJoystickTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 0) return;
    const touch = e.touches[0];
    const dx = touch.clientX - joystickCenterRef.current.x;
    const dy = touch.clientY - joystickCenterRef.current.y;
    const dist = Math.hypot(dx, dy);
    const maxRadius = 35; // Limit drag radius

    if (dist === 0) {
      setJoystickPos({ x: 0, y: 0 });
      touchDirection.current = { x: 0, y: 0 };
      touchActive.current = false;
    } else {
      const angle = Math.atan2(dy, dx);
      const dragDist = Math.min(dist, maxRadius);
      const kX = Math.cos(angle) * dragDist;
      const kY = Math.sin(angle) * dragDist;
      
      setJoystickPos({ x: kX, y: kY });
      
      // Normalized movement vector
      touchDirection.current = {
        x: Math.cos(angle) * (dragDist / maxRadius),
        y: Math.sin(angle) * (dragDist / maxRadius)
      };
      touchActive.current = true;
    }
  };

  const handleJoystickTouchEnd = () => {
    setJoystickPos({ x: 0, y: 0 });
    touchDirection.current = { x: 0, y: 0 };
    touchActive.current = false;
  };

  const triggerAttackAction = () => {
    mouseClicked.current = true;
    // Aim forwards by default if not moving, otherwise joystick direction handles it
    if (!touchActive.current && canvasRef.current) {
      mousePos.current = { 
        x: canvasRef.current.width / 2 + 100, 
        y: canvasRef.current.height / 2 
      };
    }
  };

  const triggerDashAction = () => {
    keysPressed.current['shift'] = true;
  };

  const handleDashTouchEnd = () => {
    keysPressed.current['shift'] = false;
  };

  const triggerInteractAction = () => {
    triggerInteractionRef.current?.();
  };

  const activeRoomNode = rooms.find(r => r.x === currentRoom.x && r.y === currentRoom.y);
  const currentRoomType = activeRoomNode ? activeRoomNode.type : 'START';

  // Calculate current objective text
  let objectiveText = "Clear the room";
  if (overlayPortal && overlayPortal.active) {
    objectiveText = "Escape the maze";
  } else if (overlayEnemies && overlayEnemies.length > 0) {
    if (overlayEnemies.some(e => e.isBoss)) {
      objectiveText = "Defeat the stage boss";
    }
  } else if (currentRoomType === 'BOSS') {
    objectiveText = "Defeat the stage boss";
  } else {
    objectiveText = "Strike an expansion module";
  }

  // Accessibility Colorblind mapping (cyan/blue replacing red/crimson)
  const vRed = colorblindMode ? '0, 140, 200' : '200, 67, 47';
  const vCrimson = colorblindMode ? '0, 90, 160' : '180, 20, 20';
  const vCrit = colorblindMode ? '0, 160, 220' : '220, 10, 10';
  const vFlash = colorblindMode ? '0, 120, 220' : '255, 0, 0';
  const darkGradRGB = colorblindMode ? '2, 10, 30' : '30, 2, 2';
  const hueShift = colorblindMode ? '160deg' : '-30deg';

  // Compute contamination visual overlay styles (GDD 5-5)
  // Local vignette style (for canvas container)
  let vignetteStyle: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    pointerEvents: 'none',
    transition: 'all 0.3s ease',
    borderRadius: '8px',
    zIndex: 20
  };
  let canvasFilter = 'none';
  let containerHeartbeatClass = '';

  // Full-screen overlay styles for contamination
  let screenVignetteStyle: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    pointerEvents: 'none',
    zIndex: 40,
    transition: 'all 0.5s ease',
  };
  let screenFilter = 'none';
  let vignetteAnimationClass = '';
  
  let redFlashOverlayStyle: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    pointerEvents: 'none',
    zIndex: 39,
    backgroundColor: `rgba(${vRed}, 0)`,
    transition: 'all 0.5s ease',
  };
  let redFlashAnimationClass = '';

  if (contamination > 25 && contamination <= 50) {
    const factor = (contamination - 25) / 25; // 0 to 1
    
    // Local canvas container vignette
    vignetteStyle = {
      ...vignetteStyle,
      boxShadow: `inset 0 0 ${40 + factor * 40}px rgba(${vRed}, ${0.3 + factor * 0.25})`,
      border: `1.5px solid rgba(${vRed}, ${0.1 + factor * 0.25})`
    };

    // Full-screen vignette starts at screen edge
    screenVignetteStyle = {
      ...screenVignetteStyle,
      background: `radial-gradient(circle, transparent 65%, rgba(${vCrimson}, ${factor * 0.45}) 100%)`,
      boxShadow: `inset 0 0 ${50 + factor * 70}px rgba(${vCrimson}, ${factor * 0.4})`
    };
  } else if (contamination > 50 && contamination <= 75) {
    const factor = (contamination - 50) / 25; // 0 to 1
    
    // Local canvas container vignette
    vignetteStyle = {
      ...vignetteStyle,
      boxShadow: `inset 0 0 ${80 + factor * 40}px rgba(${vRed}, ${0.55 + factor * 0.2})`,
      border: `${3 + factor * 2}px solid rgba(${vRed}, ${0.35 + factor * 0.25})`,
      backgroundColor: `rgba(${vRed}, ${0.03 + factor * 0.04})`
    };
    canvasFilter = `sepia(${0.1 + factor * 0.15}) saturate(${1.1 + factor * 0.3}) hue-rotate(${hueShift})`;

    // Full-screen vignette enhanced
    screenVignetteStyle = {
      ...screenVignetteStyle,
      background: `radial-gradient(circle, transparent 40%, rgba(${colorblindMode ? '15, 60, 160' : '160, 15, 15'}, ${0.45 + factor * 0.35}) 85%, rgba(${colorblindMode ? '5, 20, 60' : '60, 5, 5'}, ${0.55 + factor * 0.35}) 100%)`,
      boxShadow: `inset 0 0 ${120 + factor * 80}px rgba(${colorblindMode ? '10, 50, 140' : '140, 10, 10'}, ${0.45 + factor * 0.3})`
    };

    // Screen color tint reddish
    screenFilter = `sepia(${0.12 + factor * 0.18}) saturate(${1.0 + factor * 0.4}) hue-rotate(${colorblindMode ? 160 : -10 - factor * 20}deg)`;
    redFlashOverlayStyle = {
      ...redFlashOverlayStyle,
      backgroundColor: `rgba(${vRed}, ${factor * 0.06})`
    };
  } else if (contamination >= 90) {
    // Local canvas container vignette: intense red pulsing and border
    vignetteStyle = {
      ...vignetteStyle,
      boxShadow: `inset 0 0 180px rgba(0, 0, 0, 0.99), inset 0 0 100px rgba(${vCrit}, 0.9)`,
      border: `8px solid rgba(${vCrit}, 0.95)`,
      backgroundColor: `rgba(${vCrit}, 0.08)`
    };
    canvasFilter = `sepia(0.4) saturate(1.8) hue-rotate(${hueShift})`;
    containerHeartbeatClass = 'animate-heartbeat animate-heartbeat-vibe animate-intense-red-pulse';

    // Full-screen sight restriction (tunnel vision)
    screenVignetteStyle = {
      ...screenVignetteStyle,
      background: `radial-gradient(circle, transparent 6%, rgba(${darkGradRGB}, 0.7) 14%, rgba(0, 0, 0, 0.99) 35%)`,
      boxShadow: 'inset 0 0 300px rgba(0, 0, 0, 1.0)',
    };
    vignetteAnimationClass = 'animate-vignette-pulse';

    // Pulse red heart flash (increased red opacity for critical distress warning)
    redFlashOverlayStyle = {
      ...redFlashOverlayStyle,
      backgroundColor: `rgba(${vFlash}, 0.28)`
    };
    redFlashAnimationClass = 'animate-red-flash';

    screenFilter = `sepia(0.4) saturate(1.6) hue-rotate(${colorblindMode ? 160 : -30}deg)`;
  } else if (contamination > 75) {
    // Local canvas container vignette
    vignetteStyle = {
      ...vignetteStyle,
      boxShadow: `inset 0 0 180px rgba(8, 8, 14, 0.98), inset 0 0 100px rgba(${vRed}, 0.85)`,
      border: `6px solid rgba(${vRed}, 0.95)`,
      backgroundColor: `rgba(${vRed}, 0.12)`
    };
    canvasFilter = `sepia(0.35) saturate(1.55) hue-rotate(${hueShift})`;
    containerHeartbeatClass = 'animate-heartbeat animate-heartbeat-vibe';

    // Full-screen sight restriction (tunnel vision)
    screenVignetteStyle = {
      ...screenVignetteStyle,
      background: `radial-gradient(circle, transparent 8%, rgba(${darkGradRGB}, 0.6) 18%, rgba(0, 0, 0, 0.99) 42%)`,
      boxShadow: 'inset 0 0 250px rgba(0, 0, 0, 1.0)',
    };
    
    // Heartbeat pulse animation for the sight restriction overlay
    vignetteAnimationClass = 'animate-vignette-pulse';

    // Pulse red heart flash
    redFlashOverlayStyle = {
      ...redFlashOverlayStyle,
      backgroundColor: `rgba(${vRed}, 0.12)`
    };
    redFlashAnimationClass = 'animate-red-flash';

    // Screen filter strong red sepia
    screenFilter = `sepia(0.32) saturate(1.45) hue-rotate(${colorblindMode ? 160 : -30}deg)`;
  }

  // Optimize: disable heavy post-processing filters and CSS animations in low-spec mode
  if (isLowSpec) {
    canvasFilter = 'none';
    screenFilter = 'none';
    vignetteAnimationClass = '';
    redFlashAnimationClass = '';
    containerHeartbeatClass = '';
  }

  const getComboColorClass = (c: number) => {
    const isNewRecord = c > personalBestCombo;
    if (c >= 20 || (isNewRecord && personalBestCombo > 0)) {
      return 'text-maze-accent drop-shadow-[0_0_8px_rgba(239,68,68,0.85)]';
    } else if (c >= 10) {
      return 'text-maze-gold drop-shadow-[0_0_6px_rgba(245,158,11,0.7)]';
    } else {
      return 'text-slate-100 drop-shadow-[0_0_4px_rgba(255,255,255,0.6)]';
    }
  };

  return (
    <div 
      className={`relative w-full h-screen bg-maze-bg flex flex-col md:flex-row justify-between items-stretch z-10 select-none ${
        textSize === 'large' ? 'textSize-large' : ''
      } ${
        highContrastMode ? 'high-contrast-mode' : ''
      }`}
      style={{ filter: screenFilter, transition: 'filter 0.5s ease' }}
    >
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes shakeWeak {
          0%, 100% { transform: translate(0, 0); }
          20%, 60% { transform: translate(-1.5px, 1px); }
          40%, 80% { transform: translate(1.5px, -1px); }
        }
        @keyframes shakeMedium {
          0%, 100% { transform: translate(0, 0); }
          15%, 45%, 75% { transform: translate(-3px, 2px) rotate(-0.5deg); }
          30%, 60%, 90% { transform: translate(3px, -2px) rotate(0.5deg); }
        }
        @keyframes shakeStrong {
          0%, 100% { transform: translate(0, 0); }
          10%, 50%, 90% { transform: translate(-5px, 4px) rotate(-1deg); }
          30%, 70% { transform: translate(5px, -4px) rotate(1deg); }
        }
        @keyframes shakeSlam {
          0%, 100% { transform: translate(0, 0); }
          10%, 30%, 50%, 70%, 90% { transform: translate(-7px, 5px) rotate(-1.5deg); }
          20%, 40%, 60%, 80% { transform: translate(7px, -5px) rotate(1.5deg); }
        }
        @keyframes heartbeat {
          0%, 100% { transform: scale(1.0); }
          25% { transform: scale(1.012); }
          40% { transform: scale(1.0); }
          65% { transform: scale(1.006); }
        }
        @keyframes vignettePulse {
          0%, 100% { transform: scale(1.0); opacity: 0.98; }
          25% { transform: scale(1.06); opacity: 0.92; }
          40% { transform: scale(0.97); opacity: 1.0; }
          65% { transform: scale(1.03); opacity: 0.96; }
        }
        @keyframes heartbeatRedFlash {
          0%, 100% { opacity: 0.1; }
          25% { opacity: 0.35; }
          40% { opacity: 0.05; }
          65% { opacity: 0.2; }
        }
        .animate-shake-weak { animation: shakeWeak 0.12s ease-in-out; }
        .animate-shake-medium { animation: shakeMedium 0.18s ease-in-out; }
        .animate-shake-strong { animation: shakeStrong 0.25s ease-in-out; }
        .animate-shake-slam { animation: shakeSlam 0.3s ease-in-out; }
        .animate-heartbeat { animation: heartbeat 0.8s infinite ease-in-out; }
        .animate-vignette-pulse { animation: vignettePulse 0.8s infinite ease-in-out; transform-origin: center; }
        .animate-red-flash { animation: heartbeatRedFlash 0.8s infinite ease-in-out; }
        @keyframes contamVibrate {
          0%, 100% { transform: translate(0, 0); box-shadow: 0 0 0 rgba(200, 67, 47, 0); }
          20%, 60% { transform: translate(-2px, 1.5px); box-shadow: 0 0 10px rgba(200, 67, 47, 0.4); }
          40%, 80% { transform: translate(2px, -1.5px); box-shadow: 0 0 15px rgba(200, 67, 47, 0.6); }
        }
        @keyframes comboPop {
          0% { transform: scale(1.0); }
          50% { transform: scale(1.45); filter: brightness(1.2); }
          100% { transform: scale(1.0); }
        }
        .animate-contam-vibrate { animation: contamVibrate 0.15s infinite; border-color: rgba(200, 67, 47, 0.8) !important; }
        .animate-combo-pop { animation: comboPop 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; display: inline-block; }
        @keyframes letterSpacedStretch {
          0% { letter-spacing: 2px; opacity: 0; }
          100% { letter-spacing: 6px; opacity: 1; }
        }
        .animate-letter-spaced-stretch {
          animation: letterSpacedStretch 1.5s cubic-bezier(0.25, 1, 0.5, 1) forwards;
        }
        @keyframes flashRed {
          0%, 100% { opacity: 0; }
          50% { opacity: 1; }
        }
        .animate-flash-red {
          animation: flashRed 0.8s ease-in-out;
        }

        /* --- ACCESSIBILITY TEXT SIZE LARGE --- */
        .textSize-large .text-\\[8px\\] { font-size: 11px !important; }
        .textSize-large .text-\\[9px\\] { font-size: 12px !important; }
        .textSize-large .text-\\[10px\\] { font-size: 13px !important; }
        .textSize-large .text-xs { font-size: 14px !important; }
        .textSize-large .text-sm { font-size: 16px !important; }
        .textSize-large .text-base { font-size: 18px !important; }
        .textSize-large .text-lg { font-size: 20px !important; }
        .textSize-large .text-xl { font-size: 22px !important; }
        .textSize-large .text-2xl { font-size: 26px !important; }
        .textSize-large .text-3xl { font-size: 32px !important; }
        .textSize-large h3, .textSize-large h4, .textSize-large span, .textSize-large p, .textSize-large button {
          line-height: 1.4 !important;
        }

        /* --- ACCESSIBILITY HIGH CONTRAST MODE --- */
        .high-contrast-mode {
          --tw-border-opacity: 1 !important;
        }
        .high-contrast-mode .border,
        .high-contrast-mode .border-2,
        .high-contrast-mode .border-t,
        .high-contrast-mode .border-b,
        .high-contrast-mode .border-l,
        .high-contrast-mode .border-r {
          border-width: 2.5px !important;
          border-color: #ffffff !important;
        }
        .high-contrast-mode button {
          border: 2.5px solid #ffffff !important;
          background-color: #000000 !important;
          color: #ffffff !important;
        }
        .high-contrast-mode button:hover {
          background-color: #ffffff !important;
          color: #000000 !important;
        }
        .high-contrast-mode .bg-slate-950,
        .high-contrast-mode .bg-slate-900,
        .high-contrast-mode .bg-maze-dark,
        .high-contrast-mode .bg-slate-900\\/95,
        .high-contrast-mode .bg-slate-950\\/80,
        .high-contrast-mode .bg-slate-950\\/75,
        .high-contrast-mode .bg-[#08080E]\\/95 {
          background-color: #000000 !important;
        }
        .high-contrast-mode * {
          text-shadow: none !important;
          box-shadow: none !important;
        }
        .high-contrast-mode .text-maze-silver,
        .high-contrast-mode .text-slate-400,
        .high-contrast-mode .text-slate-600 {
          color: #ffffff !important;
          border-color: #ffffff !important;
        }
        .high-contrast-mode .text-maze-gold,
        .high-contrast-mode .text-amber-400 {
          color: #fbbf24 !important;
          font-weight: 800 !important;
        }
        .high-contrast-mode .text-maze-accent,
        .high-contrast-mode .text-red-500 {
          color: #ff3b30 !important;
          font-weight: 800 !important;
        }
      ` }} />
      
      {/* 1. LEFT SIDEBAR — Vitals & Deck */}
      <div className="w-full md:w-64 bg-maze-dark/85 border-b md:border-b-0 md:border-r border-slate-900 p-4 flex flex-col justify-between">
        <div className="space-y-4">
          
          {/* Deck build display */}
          <div className="bg-slate-950/80 border border-slate-900/60 rounded-lg p-3">
            <h3 className="text-xs font-cinzel font-bold text-maze-gold uppercase">Current Weapon</h3>
            <div className="text-[14px] font-cinzel font-bold text-maze-cream tracking-wide mt-1 uppercase">
              {selectedBuild === 'breaker' && `Breaker Mace +${weaponLevel - 1}`}
              {selectedBuild === 'striker' && `Striker Mace +${weaponLevel - 1}`}
              {selectedBuild === 'cartographer' && `Cartographer Mace +${weaponLevel - 1}`}
              {selectedBuild === 'guardian' && `Guardian Greatsword +${weaponLevel - 1}`}
            </div>
            <p className="text-[9px] text-maze-silver font-outfit mt-1 leading-normal">
              {selectedBuild === 'breaker' && '메이스 중화기 파쇄 중심 격돌'}
              {selectedBuild === 'striker' && '소드 쾌속 궤적 연속 타격 대시'}
              {selectedBuild === 'cartographer' && '진로 개척 및 격자 타입 Forecast'}
              {selectedBuild === 'guardian' && '그레이트 소드 광역 베기 및 생존'}
            </p>
            <div className="mt-2 pt-2 border-t border-slate-900/60 space-y-0.5 text-[9px] font-outfit text-maze-silver">
              <div className="flex justify-between">
                <span>ATTACK COST:</span>
                <span className="text-maze-gold font-bold">
                  {selectedBuild === 'breaker' ? 30 : selectedBuild === 'striker' ? 12 : selectedBuild === 'guardian' ? 22 : 18} stamina
                </span>
              </div>
              <div className="flex justify-between">
                <span>DASH COST:</span>
                <span className="text-maze-gold font-bold">20 stamina</span>
              </div>
              <div className="flex justify-between">
                <span>EXPANSION COST:</span>
                <span className="text-maze-gold font-bold">
                  {selectedBuild === 'cartographer' 
                    ? 15 * gameConfig.cartographerExpansionCostMultiplier 
                    : 15} stamina
                </span>
              </div>
            </div>
          </div>

          {/* Controls: Sound & Low-Spec */}
          <div className="flex gap-2">
            <div className="flex-1 bg-slate-950/80 border border-slate-900/60 rounded-lg p-2.5 flex flex-col justify-between items-center gap-1.5 text-center">
              <span className="text-[9px] font-cinzel font-bold text-maze-silver uppercase">SOUNDS</span>
              <button 
                type="button"
                onClick={() => soundManager?.toggleMute()}
                className={`w-full py-1 text-[9px] font-outfit rounded border transition-all ${
                  soundManager?.isMuted 
                    ? 'border-maze-accent/40 text-maze-accent bg-maze-accent/10 hover:bg-maze-accent/20' 
                    : 'border-maze-gold/40 text-maze-gold bg-maze-gold/10 hover:bg-maze-gold/20'
                }`}
              >
                {soundManager?.isMuted ? '🔇 MUTED' : '🔊 ACTIVE'}
              </button>
            </div>

            <div className="flex-1 bg-slate-950/80 border border-slate-900/60 rounded-lg p-2.5 flex flex-col justify-between items-center gap-1.5 text-center">
              <span className="text-[9px] font-cinzel font-bold text-maze-silver uppercase">LOW-SPEC</span>
              <button 
                type="button"
                onClick={toggleLowSpec}
                className={`w-full py-1 text-[9px] font-outfit rounded border transition-all ${
                  isLowSpec 
                    ? 'border-maze-accent/40 text-maze-accent bg-maze-accent/10 hover:bg-maze-accent/20' 
                    : 'border-slate-800 text-maze-silver bg-slate-900/40 hover:bg-slate-900/80'
                }`}
              >
                {isLowSpec ? '🛡️ LOW' : '⚔️ NORMAL'}
              </button>
            </div>
          </div>

          {/* Pause Trigger */}
          <div className="pt-1">
            <button 
              type="button"
              onClick={() => {
                if (!showIntro && !isDead) {
                  setIsLocalPaused(true);
                }
              }}
              className="w-full py-2 bg-slate-950/80 hover:bg-maze-gold/10 border border-maze-gold/30 hover:border-maze-gold text-maze-gold text-[10px] font-cinzel font-black rounded-lg active:scale-95 transition-all tracking-widest flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_10px_rgba(201,168,76,0.15)]"
            >
              ⏸️ PAUSE (일시정지)
            </button>
          </div>

          {/* Vitals HUD */}
          <div className="space-y-3.5 pt-2">
            
            {/* HP Bar */}
            <div className="space-y-1">
              <div className="flex justify-between text-[10px] font-outfit text-maze-silver">
                <span>HEALTH</span>
                <span className="text-maze-accent font-bold">{Math.round(hp)} / {maxHp}</span>
              </div>
              <div className="w-full bg-slate-950 h-3 rounded border border-slate-900 overflow-hidden relative">
                <div
                  className="bg-maze-accent h-full transition-all duration-150"
                  style={{ width: `${(hp / maxHp) * 100}%` }}
                />
              </div>
            </div>

            {/* Stamina Bar */}
            <div className="space-y-1">
              <div className="flex justify-between text-[10px] font-outfit text-maze-silver">
                <span>STAMINA</span>
                <span className="text-maze-gold font-bold">{Math.round(stamina)} / {maxStamina}</span>
              </div>
              <div className="w-full bg-slate-950 h-3 rounded border border-slate-900 overflow-hidden relative">
                <div
                  className={`h-full transition-all ${
                    isStaminaGoldFlashing 
                      ? 'bg-white shadow-[0_0_15px_#FFD700] duration-300' 
                      : isExhausted 
                      ? 'bg-red-500 duration-500 animate-stamina-warning shadow-[0_0_10px_#EF4444]' 
                      : (stamina / maxStamina <= 0.2) 
                      ? 'bg-red-500 animate-stamina-warning duration-150' 
                      : 'bg-maze-gold duration-150'
                  }`}
                  style={{ width: `${(stamina / maxStamina) * 100}%` }}
                />
              </div>
            </div>

            {/* EXP Bar */}
            <div className="space-y-1">
              <div className="flex justify-between text-[10px] font-outfit text-maze-silver">
                <span>LEVEL {level}</span>
                <span className="text-maze-silver">{Math.round((exp / maxExp) * 100)}%</span>
              </div>
              <div className="w-full bg-slate-950 h-2.5 rounded border border-slate-900 overflow-hidden relative">
                {/* Secondary catch-up bar (slow transition) */}
                <div
                  className="absolute top-0 left-0 bg-slate-700 h-full transition-all duration-500"
                  style={{ width: `${(exp / maxExp) * 100}%` }}
                />
                {/* Primary loader bar (fast transition + glow) */}
                <div
                  className="absolute top-0 left-0 bg-gradient-to-r from-maze-silver to-white h-full transition-all duration-200 shadow-[0_0_8px_#FFF]"
                  style={{ width: `${(exp / maxExp) * 100}%` }}
                />
              </div>
            </div>

            {/* Special Skill Cooldown HUD */}
            <div className="space-y-1 pt-1.5 border-t border-slate-900/40">
              <div className="flex justify-between text-[10px] font-outfit text-maze-silver">
                <span className="font-cinzel font-bold text-maze-gold">SKILL: {selectedBuild === 'breaker' ? '지진 강타' : selectedBuild === 'striker' ? '잔상 대시' : selectedBuild === 'guardian' ? '회전 베기' : '유적 파동'}</span>
                <span className={`font-bold ${skillCooldown > 0 ? "text-maze-silver/60" : "text-green-500 animate-pulse shadow-green-400/20"}`}>
                  {skillCooldown > 0 ? `${(skillCooldown / 1000).toFixed(1)}s` : 'READY (Q)'}
                </span>
              </div>
              <div className="w-full bg-slate-950 h-3 rounded border border-slate-900 overflow-hidden relative">
                <div
                  className={`h-full transition-all duration-75 ${
                    skillCooldown > 0 ? 'bg-purple-900/60' : 'bg-purple-500 shadow-[0_0_10px_#A855F7] animate-pulse'
                  }`}
                  style={{ width: `${skillCooldown > 0 ? ((skillMaxCooldown - skillCooldown) / skillMaxCooldown) * 100 : 100}%` }}
                />
              </div>
            </div>

          </div>
        </div>

        {/* Selected Deck modifications at bottom of sidebar */}
        <div className="mt-4 pt-4 border-t border-slate-900/60 hidden md:block">
          <span className="text-[10px] font-cinzel font-bold text-maze-silver block mb-2">RUN UPGRADES</span>
          <div className="space-y-1.5 max-h-[160px] overflow-y-auto">
            {activeUpgrades.map((u, i) => (
              <div key={i} className="text-[8px] font-outfit bg-slate-950/60 border border-slate-900 px-2 py-1 rounded text-maze-cream flex justify-between">
                <span>⚡ {u.name}</span>
                <span className="text-maze-gold font-bold">{u.synergy}</span>
              </div>
            ))}
            {activeUpgrades.length === 0 && (
              <span className="text-[8px] text-slate-600 italic">No upgrade installed</span>
            )}
          </div>
        </div>
      </div>

      {/* 2. CENTER AREA — Simulation viewport */}
      <div className="flex-1 flex flex-col items-center justify-between p-4 bg-maze-bg z-10 relative">
        
        {/* Banner announcement overlay */}
        {bannerVisible && (
          <div className="absolute top-1/4 transform -translate-y-1/2 text-center bg-maze-bg/95 border-y-2 border-maze-dark px-10 py-3 shadow-2xl z-20 transition-all duration-300 animate-pulse">
            <h4 className={`text-xl md:text-2xl font-cinzel font-black tracking-widest ${bannerColor}`}>
              {bannerText}
            </h4>
          </div>
        )}

        {/* Top bar indicators */}
        <div className="flex justify-between items-center w-full max-w-[600px] mb-2 px-1 text-xs">
          <div className="flex gap-4">
            <span className="font-outfit text-maze-silver">SCORE: <span className="text-maze-gold font-bold">{score}</span></span>
          </div>

          {/* Active Room Type Tag */}
          <div className="px-3 py-0.5 rounded border border-slate-900 bg-maze-dark/95 shadow-md glow-gold-pulse">
            <span className={`font-cinzel font-black tracking-widest text-[9px] uppercase ${
              currentRoomType === 'START' ? 'text-maze-silver' :
              currentRoomType === 'COMBAT' ? 'text-maze-accent' :
              currentRoomType === 'REWARD' ? 'text-maze-gold' :
              currentRoomType === 'HAZARD' ? 'text-purple-400 font-bold' :
              currentRoomType === 'RECOVERY' ? 'text-blue-400 font-bold' :
              currentRoomType === 'BOSS' ? 'text-maze-accent animate-pulse font-bold' : 'text-maze-gold'
            }`}>
              {currentRoomType === 'START' ? 'CORE ROOM' :
               currentRoomType === 'COMBAT' ? 'COMBAT ZONE' :
               currentRoomType === 'REWARD' ? 'REWARD CHAMBER' :
               currentRoomType === 'HAZARD' ? 'HAZARD ROOM' :
               currentRoomType === 'RECOVERY' ? 'RECOVERY SANCTUARY' :
               currentRoomType === 'BOSS' ? 'BOSS MUTATION NEST' : 'CORE ROOM'}
            </span>
          </div>

          <span className="font-outfit text-maze-silver tracking-widest">SURVIVAL: <span className="text-maze-cream font-bold">{displayTime}</span></span>
        </div>

        {/* Current Objective */}
        <div className="w-full max-w-[600px] mb-2 flex justify-center z-20">
          <div className="px-4 py-1 rounded bg-black/40 border border-maze-dark/40 shadow-sm flex items-center gap-2">
            <span className="text-[10px] font-outfit text-slate-500 uppercase tracking-wider">OBJECTIVE:</span>
            <span className={`text-[10px] font-cinzel font-bold tracking-widest uppercase ${
              objectiveText.includes('Escape') ? 'text-maze-gold animate-pulse' :
              objectiveText.includes('boss') ? 'text-maze-accent animate-pulse font-black' :
              objectiveText.includes('module') ? 'text-blue-400' : 'text-slate-300'
            }`}>
              {objectiveText}
            </span>
          </div>
        </div>

        {/* Canvas container */}
        <div className={`w-full max-w-[600px] bg-black border-4 border-maze-dark rounded-xl overflow-hidden shadow-gold-glow-lg flex items-center justify-center relative ${containerHeartbeatClass} ${
          shakeType === 'weak' ? 'animate-shake-weak' :
          shakeType === 'medium' ? 'animate-shake-medium' :
          shakeType === 'strong' ? 'animate-shake-strong' :
          shakeType === 'slam' ? 'animate-shake-slam' : ''
        }`}>
          {/* First Room Tutorial Guidance */}
          {currentStage === 1 && currentRoom.x === 0 && currentRoom.y === 0 && rooms.length === 1 && (
            overlayEnemies.length > 0 ? (
              <div className="absolute top-3 left-3 bg-black/85 border border-maze-dark/45 p-3 rounded-lg text-[10px] text-slate-300 font-outfit z-20 flex flex-col gap-1.5 shadow-lg pointer-events-none select-none max-w-[200px]">
                <div className="text-maze-gold font-bold tracking-wider mb-1 uppercase text-xs border-b border-maze-dark/30 pb-0.5">Controls Guide</div>
                <div className="flex justify-between gap-4">
                  <span className="text-maze-gold font-semibold">[WASD]</span>
                  <span className="text-slate-400">Move</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-maze-gold font-semibold">[Space / Click]</span>
                  <span className="text-slate-400">Attack</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-maze-gold font-semibold">[Shift]</span>
                  <span className="text-slate-400">Dash</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-maze-gold font-semibold">[Q]</span>
                  <span className="text-slate-400">Skill</span>
                </div>
                <div className="text-[9px] text-maze-accent font-bold mt-1 leading-tight pt-1 border-t border-maze-dark/30">
                  Defeat all enemies, then strike a pulsing wall module.
                </div>
              </div>
            ) : (
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-black/85 border border-maze-gold/40 px-5 py-3 rounded-lg text-center z-20 shadow-[0_0_20px_rgba(245,158,11,0.25)] animate-pulse pointer-events-none select-none">
                <div className="text-xs font-cinzel font-black text-maze-gold tracking-widest mb-1">
                  THE MAZE IS LISTENING.
                </div>
                <div className="text-[10px] font-outfit text-slate-300 font-bold uppercase tracking-wider">
                  Strike a module to grow the dungeon.
                </div>
              </div>
            )
          )}

          {/* Enhanced Combo System Overlays */}
          {combo > 1 && (
            <div 
              key={`combo-${combo}`}
              className={`absolute top-3 left-1/2 -translate-x-1/2 z-[28] pointer-events-none select-none text-center flex flex-col items-center ${isComboPopping ? 'animate-combo-pop' : ''}`}
            >
              <div className={`font-cinzel font-black text-2xl md:text-3xl tracking-widest ${getComboColorClass(combo)}`}>
                {combo} <span className="text-xs md:text-sm font-outfit uppercase">Combo</span>
              </div>
              {/* New Record Banner */}
              {combo > personalBestCombo && personalBestCombo > 0 && (
                <div className="text-[7px] md:text-[8px] font-outfit text-maze-gold font-black bg-black/75 px-1.5 py-0.5 rounded border border-maze-gold/40 shadow-[0_0_8px_rgba(245,158,11,0.5)] animate-pulse mt-0.5 uppercase tracking-widest">
                  💥 NEW RECORD 💥
                </div>
              )}
            </div>
          )}

          {/* Broken Combo Shatter Overlay */}
          {brokenCombo !== null && combo === 0 && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[28] pointer-events-none select-none text-center flex flex-col items-center animate-combo-shatter">
              <div className="font-cinzel font-black text-2xl md:text-3xl tracking-widest text-red-600 line-through decoration-red-700 decoration-2 drop-shadow-[0_0_8px_#FF0000]">
                {brokenCombo} <span className="text-xs md:text-sm font-outfit uppercase">Combo</span>
              </div>
              <div className="text-[7px] md:text-[8px] font-outfit text-red-400 font-bold bg-black/85 px-1.5 py-0.5 rounded border border-red-950/60 mt-0.5 uppercase tracking-wider">
                💔 BROKEN 💔
              </div>
            </div>
          )}

          {/* 5-Combo Text Splash Explosion */}
          {comboExplosionText && (
            <div 
              key={`explosion-${comboExplosionKey}`}
              className="absolute top-1/3 left-1/2 -translate-x-1/2 z-[29] pointer-events-none select-none text-center animate-combo-explosion"
            >
              <div className="font-cinzel font-black text-3xl md:text-4xl text-maze-gold tracking-widest drop-shadow-[0_0_12px_rgba(245,158,11,0.85)] uppercase italic">
                {comboExplosionText}
              </div>
              <div className="text-[9px] font-outfit text-maze-cream tracking-wide font-black uppercase mt-1">
                Fleshy Slaughter!
              </div>
            </div>
          )}

          {/* First Run Tutorial Speech Bubble Overlay */}
          {tutorialHint && !isTutorialSkipped && localStorage.getItem('maze_mace_first_run') === null && (
            <div className="absolute top-16 left-1/2 -translate-x-1/2 z-[60] bg-slate-950/95 border-2 border-maze-gold px-5 py-2.5 rounded-xl shadow-[0_0_20px_rgba(201,168,76,0.6)] animate-bounce flex items-center gap-3 select-none pointer-events-auto backdrop-blur-md">
              <div className="text-left">
                <div className="text-[7px] font-cinzel font-black text-maze-gold tracking-widest leading-none">💡 TUTORIAL HINT</div>
                <div className="text-[12px] font-cinzel font-bold text-maze-cream tracking-wide mt-1">{tutorialHint}</div>
              </div>
              <button 
                onClick={() => {
                  localStorage.setItem('maze_mace_first_run', 'done');
                  setIsTutorialSkipped(true);
                  setTutorialHint(null);
                }}
                className="text-[9px] font-outfit text-maze-accent hover:text-white uppercase font-bold tracking-widest border border-red-950 px-2 py-0.5 rounded bg-red-950/20 active:scale-95 transition-all ml-2"
              >
                Skip
              </button>
            </div>
          )}

          {/* Broken Combo Blackout Overlay */}
          {isComboBrokenBlackout && (
            <div className="absolute inset-0 bg-black/95 z-[49] pointer-events-none" />
          )}

          {/* Run Start Intro Overlay */}
          {showIntro && (
            <div 
              className="absolute inset-0 bg-[#030205] z-50 flex items-center justify-center pointer-events-auto transition-opacity duration-1000"
              style={{ opacity: isIntroFading ? 0 : 1 }}
            >
              <div className="text-center animate-pulse">
                <p className="text-maze-gold font-cinzel text-lg md:text-xl tracking-[4px] font-black drop-shadow-[0_0_10px_rgba(201,168,76,0.5)]">
                  "욕망에 이끌려, 미궁으로 들어선다..."
                </p>
              </div>
            </div>
          )}

          {/* Cinematic Death Overlay */}
          {isDead && (
            <div className="absolute inset-0 z-50 flex flex-col items-center justify-center pointer-events-auto animate-death-fade select-none">
              <div className="text-center space-y-5 animate-pulse">
                <h2 className="text-maze-accent font-cinzel text-2xl md:text-3xl tracking-[6px] font-black uppercase drop-shadow-[0_0_15px_#EF4444]">
                  미궁에 동화되었다
                </h2>
                <div className="border border-red-950/80 bg-red-950/20 px-5 py-2.5 rounded-lg inline-block shadow-[0_0_12px_rgba(239,68,68,0.25)] backdrop-blur-sm">
                  <p className="text-[9px] font-outfit text-maze-silver tracking-widest uppercase">최종 오염도</p>
                  <p className="text-xl font-bold font-cinzel text-maze-accent mt-0.5 drop-shadow-[0_0_6px_#EF4444]">
                    {contamination.toFixed(1)}%
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* 90%+ Contamination Distressed Warning Overlay */}
          {contamination >= 90 && !showIntro && !isDead && (
            <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-[29] pointer-events-none select-none text-center bg-black/75 border border-red-950/90 px-4 py-1.5 rounded shadow-[0_0_10px_rgba(239,68,68,0.15)] animate-pulse">
              <div className="font-cinzel font-black text-[9px] md:text-[10px] text-red-500 tracking-[3px] drop-shadow-[0_0_8px_#EF4444] uppercase leading-none">
                ⚠️ 미궁이 당신을 삼키려 한다... ⚠️
              </div>
            </div>
          )}

          {/* Stage Transition Blackout Overlay */}
          {isTransitioningStage && (
            <div className="absolute inset-0 bg-[#030205] z-50 flex items-center justify-center animate-pulse">
              <div className="text-center">
                <div className="text-3xl md:text-4xl font-cinzel font-black text-maze-accent tracking-[6px] drop-shadow-[0_0_15px_#FF3B30] animate-bounce">
                  DEEPER...
                </div>
                <div className="text-[9px] font-outfit text-maze-gold tracking-widest mt-3 uppercase font-bold animate-pulse">
                  Entering Stage {currentStage}
                </div>
              </div>
            </div>
          )}

          {/* Boss Entry Blackout Overlay */}
          {isBlackout && (
            <div className="absolute inset-0 bg-[#020205] z-[45] flex items-center justify-center animate-pulse">
              <div className="text-center">
                <div className="text-xl md:text-2xl font-cinzel font-black text-maze-accent tracking-widest drop-shadow-[0_0_12px_#FF3B30] animate-bounce">
                  ⚠️ WARNING ⚠️
                </div>
                <div className="text-[10px] font-outfit text-maze-silver tracking-widest mt-2 uppercase font-black">
                  Massive Bio-Anomaly Detected
                </div>
              </div>
            </div>
          )}

          {/* Room Purified Splash Overlay */}
          {roomPurifySplash && (
            <div className="absolute top-1/4 left-1/2 -translate-x-1/2 z-[40] pointer-events-none select-none text-center bg-black/85 border-y-2 border-maze-gold/60 px-10 py-3 shadow-[0_0_20px_rgba(201,168,76,0.4)] animate-fade-in backdrop-blur-sm">
              <div className="font-cinzel font-black text-xs md:text-sm text-maze-gold tracking-[4px] uppercase animate-pulse">
                [ ROOM PURIFIED ]
              </div>
              <div className="font-outfit font-bold text-[9px] text-maze-cream tracking-widest mt-1.5 uppercase">
                ⚔️ EXPAND THE LABYRINTH TO ADVANCE! ⚔️
              </div>
            </div>
          )}

          {/* Corruption Warning Milestone Splash Overlay */}
          {corruptionWarningSplash && (
            <div className="absolute top-1/3 left-1/2 -translate-x-1/2 z-[40] pointer-events-none select-none text-center bg-black/90 border-2 border-maze-accent/80 px-8 py-4 shadow-[0_0_25px_rgba(200,67,47,0.5)] animate-bounce backdrop-blur-sm rounded-xl">
              <div className="font-cinzel font-black text-sm text-maze-accent tracking-[3px] uppercase animate-pulse">
                {corruptionWarningSplash.split(' (')[0]}
              </div>
              <div className="font-outfit font-black text-[10px] text-white tracking-widest mt-1.5 uppercase">
                {corruptionWarningSplash.includes('(') ? corruptionWarningSplash.split(' (')[1].replace(')', '') : ''}
              </div>
            </div>
          )}

          {/* Boss HP HUD Top Overlay */}
          {activeBoss && (
            <div className="absolute top-4 left-10 right-10 z-[28] pointer-events-none select-none flex flex-col items-center">
              <div className="text-[10px] font-cinzel font-black text-maze-gold tracking-[3px] uppercase drop-shadow-[0_0_6px_#C9A84C] mb-1 text-center">
                {activeBoss.name} {activeBoss.phase === 2 && <span className="text-red-500 animate-pulse font-bold ml-1">[MUTATED]</span>}
              </div>
              <div className="w-full bg-slate-950/90 h-2.5 rounded border border-red-950/70 overflow-hidden relative shadow-[0_0_10px_rgba(239,68,68,0.15)]">
                {/* Catch-up trace */}
                <div
                  className="absolute top-0 left-0 bg-white/70 h-full transition-all duration-700 ease-out"
                  style={{ width: `${(activeBoss.hp / activeBoss.maxHp) * 100}%` }}
                />
                {/* Main bar */}
                <div
                  className="absolute top-0 left-0 bg-gradient-to-r from-red-800 via-red-600 to-rose-500 h-full transition-all duration-150 shadow-[0_0_8px_rgba(239,68,68,0.5)]"
                  style={{ width: `${(activeBoss.hp / activeBoss.maxHp) * 100}%` }}
                />
              </div>
              <div className="text-[8px] font-outfit text-maze-silver mt-0.5 tracking-wider">
                HP: <span className="text-white font-bold">{Math.round(activeBoss.hp)}</span> / {activeBoss.maxHp}
              </div>
            </div>
          )}

          {/* Boss Splash Banner Overlay */}
          {showBossNameSplash && bossNameSplash && (
            <div className="absolute inset-0 bg-black/85 z-[46] flex flex-col items-center justify-center pointer-events-none select-none p-6 animate-fade-in">
              <div className="w-4/5 h-[1px] bg-gradient-to-r from-transparent via-maze-gold to-transparent opacity-80" />
              <div className="py-6 text-center">
                <h2 className="text-maze-gold font-cinzel text-xl md:text-2xl font-black tracking-[6px] uppercase drop-shadow-[0_0_15px_rgba(201,168,76,0.6)] animate-letter-spaced-stretch">
                  {bossNameSplash}
                </h2>
                <p className="text-[10px] md:text-[11px] text-maze-silver font-cinzel tracking-[3px] mt-2 italic text-maze-cream/90 font-bold">
                  — {bossSubtext} —
                </p>
              </div>
              <div className="w-4/5 h-[1px] bg-gradient-to-r from-transparent via-maze-gold to-transparent opacity-80" />
            </div>
          )}

          {/* Phase 2 Red Screen Flash Overlay */}
          {bossPhase2Flash && !isLowSpec && (
            <div className="absolute inset-0 bg-red-600/35 z-[40] pointer-events-none animate-flash-red" />
          )}

          {/* Stage 3 Heart Boss Escaped Victory Cinematic Overlay */}
          {/* Stage 3 Heart Boss Escaped Victory Cinematic Overlay */}
          {isVictoryCinematic && (
            <div className="absolute inset-0 z-50 flex flex-col items-center justify-center pointer-events-auto select-none p-6 text-center overflow-hidden"
                 style={{
                   background: victoryStep === 'whiteout' 
                     ? '#fff'
                     : 'radial-gradient(circle, rgba(255,255,255,1) 0%, rgba(254,243,199,0.95) 75%, rgba(201,168,76,0.3) 100%)',
                   transition: 'background 1.5s cubic-bezier(0.25, 1, 0.5, 1)'
                 }}>
              
              {/* Whiteout Blinding Flash Screen Layer */}
              {victoryStep === 'whiteout' && (
                <div className="absolute inset-0 bg-white z-[60] pointer-events-none animate-whiteout" />
              )}

              {/* 1. Purifying Phase */}
              {victoryStep === 'purifying' && (
                <div className="flex flex-col items-center justify-center space-y-6 z-10 max-w-[480px]">
                  <h2 className="text-2xl md:text-3xl font-cinzel font-black tracking-[6px] text-amber-950 uppercase animate-text-reveal drop-shadow-[0_0_10px_rgba(251,191,36,0.5)]">
                    미궁을 탈출했다...
                  </h2>
                  <div className="w-64 h-[1px] bg-gradient-to-r from-transparent via-amber-800 to-transparent" />
                  
                  {/* Purification Progress HUD inside Cutscene */}
                  <div className="w-80 bg-slate-950/90 border border-amber-900/40 p-4 rounded-xl shadow-[0_0_20px_rgba(201,168,76,0.15)] flex flex-col items-center space-y-2 animate-fade-in">
                    <span className="text-[10px] font-cinzel font-bold text-amber-500 tracking-widest uppercase animate-pulse">
                      미궁 오염 정화 중 (Purifying Contamination)
                    </span>
                    <div className="w-full bg-slate-900 h-3 rounded overflow-hidden relative border border-amber-950/40 shadow-inner">
                      <div 
                        className="absolute top-0 left-0 bg-gradient-to-r from-red-600 via-amber-500 to-emerald-500 h-full transition-all duration-100 shadow-[0_0_8px_rgba(251,191,36,0.4)]"
                        style={{ width: `${visualContamination}%` }}
                      />
                    </div>
                    <span className="text-[12px] font-outfit text-white font-bold tracking-widest">
                      {Math.round(visualContamination)}%
                    </span>
                  </div>
                </div>
              )}

              {/* 2. Survivor Exiting Phase */}
              {victoryStep === 'exit_run' && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-between py-16 px-6 pointer-events-none">
                  {/* Title Caption */}
                  <div className="text-center animate-fade-in mt-6">
                    <h2 className="text-lg md:text-xl font-cinzel font-black tracking-[5px] text-amber-950 uppercase drop-shadow-[0_0_8px_rgba(251,191,36,0.3)]">
                      마침내, 빛을 마주했다.
                    </h2>
                    <p className="text-[10px] text-amber-900/70 font-outfit tracking-wider mt-1">
                      The nightmare of the maze dissolved into the white light.
                    </p>
                  </div>

                  {/* Escape Portal Doorway */}
                  <div className="absolute top-[28%] left-1/2 -translate-x-1/2 flex flex-col items-center">
                    <div className="w-20 h-32 bg-gradient-to-t from-white via-amber-50 to-white rounded-t-full border-[3px] border-maze-gold animate-portal-glow flex items-center justify-center relative overflow-hidden shadow-[0_0_35px_rgba(251,191,36,0.7)]">
                      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,1)_0%,rgba(251,191,36,0.15)_100%)] animate-pulse" />
                      <div className="w-1 h-32 bg-white/60 blur-[2px] rotate-45 transform origin-center absolute" />
                      <div className="w-1 h-32 bg-white/60 blur-[2px] -rotate-45 transform origin-center absolute" />
                    </div>
                  </div>

                  {/* Survivor Exiting walking animation */}
                  <div className="absolute bottom-[20%] left-1/2 z-20 pointer-events-none animate-survivor-exit">
                    <PlayerSprite 
                      x={0} 
                      y={0} 
                      isMoving={true} 
                      isAttacking={false} 
                      selectedBuild={selectedBuild}
                    />
                  </div>
                  
                  {/* Bottom Escape Message */}
                  <div className="text-center animate-fade-in mb-6">
                    <span className="text-[11px] font-outfit tracking-widest font-black uppercase text-amber-900 bg-amber-100/60 px-4 py-1.5 rounded-full border border-amber-200/50 shadow-sm">
                      미궁 탈출 성공
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Upgrade Acquired Toast Notification */}
          {toastUpgrade && (
            <div 
              key={toastUpgradeKey}
              className="absolute top-4 left-1/2 -translate-x-1/2 z-[60] pointer-events-none animate-slide-down"
            >
              <div className="bg-gradient-to-r from-maze-dark/95 via-slate-900/95 to-maze-dark/95 border border-maze-gold/80 px-6 py-2.5 rounded-lg shadow-[0_0_20px_rgba(201,168,76,0.6)] flex items-center gap-3 backdrop-blur-md min-w-[280px]">
                <div className="flex-shrink-0 p-1.5 bg-maze-gold/10 border border-maze-gold/30 rounded-full">
                  {toastUpgrade.type === 'power' && (
                    <svg className="w-5 h-5 text-maze-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  )}
                  {toastUpgrade.type === 'energy' && (
                    <svg className="w-5 h-5 text-maze-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m0-12.728l.707.707m12.728 12.728l.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z" />
                    </svg>
                  )}
                  {toastUpgrade.type !== 'power' && toastUpgrade.type !== 'energy' && (
                    <svg className="w-5 h-5 text-maze-silver" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                    </svg>
                  )}
                </div>
                <div className="text-left">
                  <div className="text-[10px] font-cinzel font-black text-maze-gold tracking-widest leading-none">UPGRADE ACQUIRED</div>
                  <div className="text-[13px] font-cinzel font-bold text-maze-cream tracking-wide mt-0.5">{toastUpgrade.name}</div>
                </div>
              </div>
            </div>
          )}

          {/* Fleshy Muscle Wall Frame Overlay (CSS Gradient + Border Radius) */}
          <div 
            key={`wall-${currentRoom.x},${currentRoom.y}`}
            className="absolute inset-0 pointer-events-none z-20 animate-wall-open"
            style={{
              borderRadius: '6px', // match canvas container border-radius
              border: '18px solid transparent',
              // double background background-clip trick: padding-box is clear, border-box renders muscle fiber texture
              background: 'linear-gradient(transparent, transparent) padding-box, repeating-linear-gradient(45deg, #7c2230, #5c161e 4px, #2b0b10 8px) border-box',
              boxShadow: 'inset 0 0 25px rgba(0,0,0,0.95), 0 0 10px rgba(124, 34, 48, 0.4)',
            }}
          />

          {/* Room Type Aura/Glow Overlay */}
          <div 
            className="absolute inset-0 pointer-events-none z-10 transition-all duration-1000"
            style={{
              boxShadow: `inset 0 0 55px ${
                currentRoomType === 'COMBAT' ? 'rgba(200, 67, 47, 0.5)' :
                currentRoomType === 'REWARD' ? 'rgba(201, 168, 76, 0.5)' :
                currentRoomType === 'HAZARD' ? 'rgba(123, 44, 191, 0.5)' :
                currentRoomType === 'RECOVERY' ? 'rgba(59, 130, 246, 0.5)' :
                'rgba(180, 70, 70, 0.15)' // START room
              }`,
            }}
          />

          {/* Room Entrance Fade-in transition layer */}
          <div 
            key={`${currentRoom.x},${currentRoom.y}`} 
            className="absolute inset-0 bg-[#08080E] pointer-events-none z-30 animate-room-fade" 
          />

          {/* Recovery Room entry blue flash */}
          {currentRoomType === 'RECOVERY' && (
            <div 
              key={`recovery-flash-${currentRoom.x},${currentRoom.y}`}
              className="absolute inset-0 bg-blue-500/25 pointer-events-none z-30 animate-recovery-flash"
            />
          )}

          {/* Gold Screen Flash Overlay */}
          {showGoldFlash && (
            <div className="absolute inset-0 bg-yellow-400/20 pointer-events-none z-40 animate-gold-flash" />
          )}

          <canvas ref={canvasRef} className="w-full aspect-[600/420]" style={{ filter: canvasFilter, transition: 'filter 0.3s ease' }} />
          
          {/* Standalone SVG Sprite Layer */}
          <div
            className="absolute pointer-events-none overflow-hidden z-10"
            style={{
              top: 0,
              left: 0,
              width: 600,
              height: 420,
              transformOrigin: '0 0',
              transform: `scale(${spriteScale.x}, ${spriteScale.y})`,
            }}
          >
            {/* Swift Armor (Striker) Afterimages */}
            {selectedBuild === 'striker' && overlayPlayer.history && overlayPlayer.history.length > 0 && (() => {
              const isDashing = overlayPlayer.dashTimer > 0;
              
              if (isLowSpec) {
                const index = Math.max(0, overlayPlayer.history.length - 8);
                const h = overlayPlayer.history[index];
                if (!h) return null;
                return (
                  <div 
                    key="afterimage-lowspec"
                    style={{ 
                      position: 'absolute', 
                      left: 0, 
                      top: 0, 
                      right: 0, 
                      bottom: 0,
                      opacity: isDashing ? 0.35 : 0.12,
                      pointerEvents: 'none'
                    }}
                  >
                    <PlayerSprite 
                      x={h.x} 
                      y={h.y} 
                      isMoving={h.isMoving} 
                      isAttacking={h.isAttacking} 
                      selectedBuild={selectedBuild}
                    />
                  </div>
                );
              }

              const afterimageCount = isDashing ? 3 : 2;
              const delaySteps = isDashing ? [4, 8, 12] : [8, 16];
              const opacities = isDashing ? [0.55, 0.35, 0.18] : [0.18, 0.08];
              const glowColor = 'rgba(52, 211, 153, 0.5)';
              const filters = isDashing 
                ? [
                    `brightness(1.6) saturate(1.4) drop-shadow(0 0 6px ${glowColor})`,
                    `brightness(1.4) saturate(1.3) drop-shadow(0 0 4px ${glowColor})`,
                    `brightness(1.2) saturate(1.2) drop-shadow(0 0 2px ${glowColor})`
                  ]
                : [
                    `brightness(1.3) saturate(1.2) drop-shadow(0 0 3px ${glowColor})`,
                    `brightness(1.1) saturate(1.1) drop-shadow(0 0 1px ${glowColor})`
                  ];

              return delaySteps.slice(0, afterimageCount).map((step, idx) => {
                const index = Math.max(0, overlayPlayer.history.length - step);
                const h = overlayPlayer.history[index];
                if (!h) return null;
                return (
                  <div 
                    key={`afterimage-${idx}`}
                    style={{ 
                      position: 'absolute', 
                      left: 0, 
                      top: 0, 
                      right: 0, 
                      bottom: 0,
                      opacity: opacities[idx],
                      filter: filters[idx],
                      pointerEvents: 'none',
                      transition: 'opacity 0.1s ease'
                    }}
                  >
                    <PlayerSprite 
                      x={h.x} 
                      y={h.y} 
                      isMoving={h.isMoving} 
                      isAttacking={h.isAttacking} 
                      selectedBuild={selectedBuild}
                    />
                  </div>
                );
              });
            })()}

            {/* Player Sprite */}
            <div 
              style={{ 
                position: 'absolute', 
                left: 0, 
                top: 0, 
                right: 0, 
                bottom: 0,
                filter: isExhausted ? 'saturate(0.3) contrast(1.1) brightness(0.85)' : 'none', 
                transition: 'filter 0.3s ease' 
              }}
            >
              <PlayerSprite 
                x={overlayPlayer.x} 
                y={overlayPlayer.y} 
                isMoving={overlayPlayer.isMoving} 
                isAttacking={overlayPlayer.isAttacking} 
                selectedBuild={selectedBuild}
              />
            </div>

            {isExhausted && (
              <div 
                className="absolute text-[8px] font-black text-blue-400 font-outfit animate-bounce bg-slate-950/80 px-1 py-0.5 rounded border border-blue-900 shadow-md select-none pointer-events-none whitespace-nowrap animate-pulse"
                style={{
                  left: overlayPlayer.x,
                  top: overlayPlayer.y - 32,
                  transform: 'translateX(-50%)',
                  zIndex: 22
                }}
              >
                💦 HAH... HAH...
              </div>
            )}

            {/* Monster Sprites */}
            {overlayEnemies.map((e, idx) => (
              <div 
                key={idx} 
                className="absolute pointer-events-none" 
                style={{ 
                  left: 0, 
                  top: 0, 
                  right: 0, 
                  bottom: 0,
                  filter: e.isSlowed ? 'hue-rotate(90deg) saturate(0.8) brightness(1.2)' : 'none'
                }}
              >
                {/* Warning Pulse Effect for spawning elites/bosses */}
                {e.warningTimer !== undefined && e.warningTimer > 0 && (
                  <div
                    className="absolute border-4 border-red-600 rounded-full animate-ping pointer-events-none"
                    style={{
                      left: e.x,
                      top: e.y,
                      width: e.isBoss ? 90 : 60,
                      height: e.isBoss ? 90 : 60,
                      transform: 'translate(-50%, -50%)',
                    }}
                  />
                )}
                {/* Warning text */}
                {e.warningTimer !== undefined && e.warningTimer > 0 && (
                  <div 
                    className="absolute text-[8px] font-cinzel font-black text-maze-accent animate-pulse whitespace-nowrap bg-black/75 px-1.5 py-0.5 border border-red-900 rounded"
                    style={{
                      left: e.x,
                      top: e.y - (e.isBoss ? 55 : 38),
                      transform: 'translateX(-50%)',
                      zIndex: 20
                    }}
                  >
                    {e.isBoss ? '⚠️ BOSS MUTATION ⚠️' : '⚠️ ELITE MUTATION ⚠️'}
                  </div>
                )}
                
                {e.type === 'warden' ? (
                  <WardenSprite 
                    x={e.x} 
                    y={e.y} 
                    isHit={e.isHit} 
                    isMoving={e.isMoving} 
                    isElite={e.isElite}
                    isBoss={e.isBoss}
                    isEnraged={e.isEnraged}
                    chargeState={e.chargeState}
                  />
                ) : e.type === 'stalker' ? (
                  <StalkerSprite
                    x={e.x}
                    y={e.y}
                    isHit={e.isHit}
                    isMoving={e.isMoving}
                    isElite={e.isElite}
                    isBoss={e.isBoss}
                    isMini={e.isMini}
                  />
                ) : (
                  <CrawlerSprite 
                    x={e.x} 
                    y={e.y} 
                    isHit={e.isHit} 
                    isMoving={e.isMoving} 
                    contamination={contamination}
                    isElite={e.isElite}
                    isBoss={e.isBoss}
                    isMini={e.isMini}
                  />
                )}
              </div>
            ))}

            {/* Expansion Modules */}
            {overlayModules.map((mod, idx) => (
              <ExpansionModuleSprite 
                key={idx} 
                x={mod.x} 
                y={mod.y} 
                active={mod.active} 
                dir={mod.dir} 
                isHit={mod.isHit}
              />
            ))}

            {/* Chest Sprite */}
            {overlayChest && (
              <ChestSprite 
                x={overlayChest.x} 
                y={overlayChest.y} 
                opened={overlayChest.opened} 
              />
            )}

            {/* Portal Sprite */}
            {overlayPortal && overlayPortal.active && (
              <PortalSprite 
                x={overlayPortal.x} 
                y={overlayPortal.y} 
              />
            )}
          </div>

          {/* Transparent dynamic 2D lighting overlay canvas */}
          <canvas ref={lightCanvasRef} className="absolute inset-0 w-full h-full pointer-events-none z-25" />

          {/* Dramatic Vignette reflecting contamination level */}
          <div style={vignetteStyle} />
        </div>

        {/* Mobile Dpad removed in favor of floating Virtual Joystick overlay */}

        {/* Tips indicator */}
        <div className="hidden md:block text-[9px] text-maze-silver font-outfit mt-2 italic opacity-60">
          Tip: 몬스터를 타격한 기세로 밀어붙여 벽에 충돌시키면 <span className="text-maze-accent font-bold">벽 slam 추가 피해</span>를 입힙니다.
        </div>
      </div>

      {/* 3. RIGHT SIDEBAR — MiniMap & Corruption */}
      <div className="w-full md:w-64 bg-maze-dark/85 border-t md:border-t-0 md:border-l border-slate-900 p-4 flex flex-col justify-between animate-fade-in">
        
        {/* Minimap panel */}
        <div className="space-y-3">
          {isDailyChallenge && dailyRule && (
            <div className="border border-red-950/80 bg-red-950/20 backdrop-blur-md rounded-lg p-2.5 flex flex-col items-center animate-pulse text-center select-none shadow-[0_0_8px_rgba(239,68,68,0.2)]">
              <span className="text-[9px] text-red-400 font-cinzel tracking-[0.15em] font-black uppercase">📅 DAILY CHALLENGE</span>
              <span className="text-[10px] font-bold text-maze-gold mt-1 font-outfit">{dailyRule.koreanName}</span>
              <span className="text-[8px] text-maze-silver/90 mt-0.5 font-outfit">{dailyRule.koreanDesc}</span>
            </div>
          )}

          <div className="flex justify-between items-center bg-slate-950/40 p-1.5 rounded border border-slate-900/60">
            <span className="text-[9px] font-cinzel font-bold text-maze-silver uppercase">MAP DISPLAY</span>
            <button 
              type="button"
              onClick={() => setMinimapVisible(prev => !prev)}
              className={`px-2 py-0.5 text-[8px] font-outfit rounded border transition-all ${
                minimapVisible 
                  ? 'border-maze-gold/40 text-maze-gold bg-maze-gold/10 hover:bg-maze-gold/20' 
                  : 'border-slate-800 text-maze-silver bg-slate-900/40 hover:bg-slate-900/80'
              }`}
            >
              {minimapVisible ? 'ON (M)' : 'OFF (M)'}
            </button>
          </div>

          {minimapVisible ? (
            <MiniMap 
              rooms={rooms} 
              currentRoom={currentRoom} 
              isCartographer={selectedBuild === 'cartographer' || activeUpgrades.some(u => u.id === 'maze_sense')} 
              currentStage={currentStage}
              onExpandClick={() => setIsFullMapOpen(true)}
              isDailyChallenge={isDailyChallenge}
              dailySeed={dailySeed}
            />

          ) : (
            <div 
              onClick={() => setMinimapVisible(true)}
              className="w-full bg-slate-950/60 border border-dashed border-slate-800 rounded-lg p-6 flex flex-col items-center justify-center cursor-pointer hover:border-maze-gold/40 hover:bg-slate-950/80 transition-all duration-300"
            >
              <span className="text-[20px]">🗺️</span>
              <span className="text-[9px] font-outfit text-maze-silver mt-2 uppercase tracking-wider">Map Hidden</span>
              <span className="text-[7px] text-maze-gold mt-1 font-bold">Press M or click to open</span>
            </div>
          )}
          
          {/* Corruption Gauge */}
          <div className={`space-y-1 bg-slate-950/80 border border-slate-900/60 rounded-lg p-3 transition-colors ${
            isContamShaking ? 'animate-contam-vibrate' : ''
          }`}>
            <div className="flex justify-between text-[10px] font-outfit text-maze-silver">
              <span>CORRUPTION LEVEL</span>
              <span className={`font-bold ${contamination >= 70 ? (colorblindMode ? 'text-cyan-400 animate-pulse' : 'text-maze-accent animate-pulse') : 'text-maze-silver'}`}>
                {Math.round(contamination)}%
              </span>
            </div>
            
            <div className="w-full bg-slate-950 h-2.5 rounded border border-slate-900 overflow-hidden relative">
              <div
                className={`h-full transition-all duration-200 ${
                  contamination >= 70 
                    ? (colorblindMode ? 'bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.6)]' : 'bg-maze-accent') 
                    : contamination >= 40 
                      ? 'bg-maze-gold' 
                      : 'bg-maze-silver'
                }`}
                style={{ width: `${contamination}%` }}
              />
            </div>
            <p className="text-[8px] text-maze-silver font-outfit mt-1 leading-normal opacity-75">
              오염도가 상승할수록 몬스터들의 속도가 최대 <span className="text-maze-accent font-bold">80%</span> 가속됩니다.
            </p>
          </div>
        </div>

        <div className="pt-4 border-t border-slate-900/60">
          <div className="grid grid-cols-2 gap-2 text-[8px] font-outfit text-maze-silver">
            <div className="rounded border border-slate-900 bg-slate-950/70 p-2">
              <span className="block text-maze-gold font-bold">LOOP</span>
              <span>Explore → Fight → Expand</span>
            </div>
            <div className="rounded border border-slate-900 bg-slate-950/70 p-2">
              <span className="block text-maze-accent font-bold">THREAT</span>
              <span>Close-range monster attacks</span>
            </div>
          </div>
        </div>

      </div>

      {/* Full-screen Contamination Overlays */}
      <div style={screenVignetteStyle} className={vignetteAnimationClass} />
      <div style={redFlashOverlayStyle} className={redFlashAnimationClass} />

      {/* Mobile Virtual Joystick & Action Buttons Overlay */}
      {isTouchDevice && (
        <>
          {/* Movement Joystick (Bottom Left) */}
          <div className="fixed bottom-8 left-8 z-40 md:hidden pointer-events-auto">
            <div 
              ref={joystickContainerRef}
              onTouchStart={handleJoystickTouchStart}
              onTouchMove={handleJoystickTouchMove}
              onTouchEnd={handleJoystickTouchEnd}
              className="w-24 h-24 bg-slate-950/80 rounded-full border-2 border-slate-900/60 shadow-[0_0_15px_rgba(201,168,76,0.12)] flex items-center justify-center relative touch-none select-none"
            >
              <div className="w-8 h-8 rounded-full border border-slate-900/40 bg-slate-900/35 pointer-events-none" />
              <div 
                className="w-10 h-10 bg-gradient-to-br from-maze-gold to-maze-accent rounded-full border-2 border-maze-cream shadow-md absolute cursor-pointer pointer-events-none"
                style={{ 
                  transform: `translate(${joystickPos.x}px, ${joystickPos.y}px)`,
                  transition: joystickPos.x === 0 && joystickPos.y === 0 ? 'transform 0.15s ease' : 'none'
                }}
              />
            </div>
          </div>

          {/* Action Buttons (Bottom Right) */}
          <div className="fixed bottom-8 right-8 z-40 md:hidden pointer-events-auto flex items-center gap-3">
            {/* Interact/Expand */}
            <button
              type="button"
              onTouchStart={triggerInteractAction}
              className="w-11 h-11 rounded-full bg-slate-950/90 border border-slate-800 text-maze-silver font-cinzel text-[10px] flex items-center justify-center shadow-lg active:scale-90 active:bg-maze-silver active:text-maze-bg"
            >
              EXP
            </button>

            {/* Skill */}
            <button
              type="button"
              onTouchStart={() => {
                skillTriggered.current = true;
              }}
              className={`w-11 h-11 rounded-full font-cinzel text-[10px] flex items-center justify-center shadow-lg active:scale-90 font-bold border transition-all ${
                skillCooldown > 0 
                  ? 'bg-slate-950/90 border-slate-800 text-maze-silver/30' 
                  : 'bg-purple-900/15 border-purple-500 text-purple-400 active:bg-purple-500 active:text-maze-bg shadow-[0_0_12px_rgba(168,85,247,0.35)]'
              }`}
            >
              SKL
            </button>

            {/* Dash */}
            <button
              type="button"
              onTouchStart={triggerDashAction}
              onTouchEnd={handleDashTouchEnd}
              className="w-12 h-12 rounded-full bg-maze-gold/15 border border-maze-gold text-maze-gold font-cinzel text-xs flex items-center justify-center shadow-lg active:scale-90 active:bg-maze-gold active:text-maze-bg font-bold"
            >
              DSH
            </button>

            {/* Attack */}
            <button
              type="button"
              onTouchStart={triggerAttackAction}
              className="w-14 h-14 rounded-full bg-maze-accent/15 border-2 border-maze-accent text-maze-accent font-cinzel text-sm flex items-center justify-center shadow-[0_0_12px_rgba(200,67,47,0.35)] active:scale-90 active:bg-maze-accent active:text-maze-cream font-bold"
            >
              ATK
            </button>
          </div>
        </>
      )}

      {/* Full-screen Explored Full Map Modal View */}
      {isFullMapOpen && (
        <div className="fixed inset-0 bg-[#08080E]/95 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-maze-dark border border-slate-800 rounded-xl p-5 md:p-6 w-full max-w-[550px] flex flex-col shadow-2xl relative animate-wall-open">
            {/* Header */}
            <div className="flex justify-between items-center border-b border-slate-900 pb-3 mb-4">
              <div className="flex flex-col">
                <span className="text-[12px] font-cinzel font-black text-maze-gold tracking-widest uppercase">Explored Maze Layout — STAGE {currentStage}</span>
                <span className="text-[9px] font-outfit text-maze-silver mt-0.5 uppercase">All Discovered Chambers ({rooms.length})</span>
              </div>
              <button 
                type="button"
                onClick={() => setIsFullMapOpen(false)}
                className="px-3 py-1 text-[10px] font-outfit text-maze-accent border border-maze-accent/40 rounded hover:bg-maze-accent/10 transition-all font-bold"
              >
                CLOSE [ESC]
              </button>
            </div>

            {/* Grid display */}
            <div className="flex-1 overflow-auto flex items-center justify-center py-4 bg-slate-950/80 rounded-lg border border-slate-900 min-h-[300px] max-h-[60vh]">
              {(() => {
                // Calculate dynamic min/max bounds of all explored rooms
                const xs = rooms.map(r => r.x);
                const ys = rooms.map(r => r.y);
                const minX = Math.min(...xs) - 1;
                const maxX = Math.max(...xs) + 1;
                const minY = Math.min(...ys) - 1;
                const maxY = Math.max(...ys) + 1;

                // Build grid arrays
                const gridRows = [];
                for (let gy = minY; gy <= maxY; gy++) {
                  const gridCols = [];
                  for (let gx = minX; gx <= maxX; gx++) {
                    const r = rooms.find(room => room.x === gx && room.y === gy);
                    const isCurrent = gx === currentRoom.x && gy === currentRoom.y;
                    
                    gridCols.push({ gx, gy, r, isCurrent });
                  }
                  gridRows.push(gridCols);
                }

                // Stylings helper
                const getLargeRoomStyle = (r: RoomNode, isCurrent: boolean) => {
                  let style = 'w-6 h-6 rounded border flex items-center justify-center text-[10px] ';
                  if (isCurrent) {
                    style += 'bg-[#FFA500] border-[#FFFFFF] text-maze-bg font-black animate-map-pulse shadow-[0_0_12px_#FFA500] ';
                  } else if (r.type === 'START') {
                    style += 'bg-slate-800 border-slate-400 text-slate-200 ';
                  } else if (r.type === 'COMBAT') {
                    style += 'bg-red-950/45 border-red-500 text-red-400 font-bold shadow-[0_0_4px_rgba(239,68,68,0.2)] ';
                  } else if (r.type === 'REWARD') {
                    style += 'bg-amber-950/45 border-amber-500 text-amber-400 font-bold shadow-[0_0_4px_rgba(245,158,11,0.2)] ';
                  } else if (r.type === 'HAZARD') {
                    style += 'bg-purple-950/45 border-purple-500 text-purple-400 font-bold shadow-[0_0_4px_rgba(168,85,247,0.2)] ';
                  } else if (r.type === 'RECOVERY') {
                    style += 'bg-blue-950/45 border-blue-500 text-blue-400 font-bold shadow-[0_0_4px_rgba(59,130,246,0.2)] ';
                  } else if (r.type === 'BOSS') {
                    style += 'bg-red-900 border-maze-accent text-maze-accent font-black animate-pulse shadow-[0_0_8px_rgba(200,67,47,0.7)] ';
                  }
                  return style;
                };

                return (
                  <div className="flex flex-col gap-1.5 p-4 select-none">
                    {gridRows.map((row, ry) => (
                      <div key={ry} className="flex gap-1.5 justify-center">
                        {row.map((cell, cx) => (
                          <div key={cx} className="w-7 h-7 flex items-center justify-center relative">
                            {cell.r ? (
                              <div 
                                className={getLargeRoomStyle(cell.r, cell.isCurrent)}
                                title={`Room (${cell.gx}, ${cell.gy}) - ${cell.r.type}`}
                              >
                                {cell.isCurrent ? 'P' : cell.r.type === 'RECOVERY' ? '+' : cell.r.type === 'BOSS' ? '💀' : cell.r.type[0]}
                              </div>
                            ) : (
                              <div className="w-1.5 h-1.5 rounded-full bg-slate-900 opacity-60" />
                            )}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>

            {/* Footer / Legend info */}
            <div className="grid grid-cols-5 gap-2 w-full mt-4 pt-3 border-t border-slate-900/60 text-[9px] text-maze-silver font-outfit justify-items-center">
              <div className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded bg-slate-800 border border-slate-400 block" />
                <span>START</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded bg-red-950/45 border border-red-500 block" />
                <span>COMBAT</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded bg-amber-950/45 border border-amber-500 block" />
                <span>REWARD</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded bg-purple-950/45 border border-purple-500 block" />
                <span>HAZARD</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded bg-blue-950/45 border border-blue-500 block" />
                <span>RECOVERY</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. Pause Menu Overlay */}
      {isLocalPaused && (
        <div className="absolute inset-0 z-[80] flex items-center justify-center bg-slate-950/75 backdrop-blur-md animate-fade-in p-4 select-none">
          <div className="bg-slate-900/95 border-2 border-maze-gold rounded-2xl max-w-xl w-full p-6 shadow-[0_0_50px_rgba(201,168,76,0.35)] flex flex-col gap-5 text-maze-cream relative overflow-hidden backdrop-blur-sm">
            {/* Organic pulse veins decorative background */}
            <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-maze-accent/5 via-transparent to-transparent opacity-40" />

            {/* Header */}
            <div className="text-center relative">
              <h3 className="text-2xl md:text-3xl font-cinzel font-black text-maze-gold tracking-widest drop-shadow-[0_0_12px_rgba(201,168,76,0.6)]">
                PAUSED (일시정지)
              </h3>
              <div className="w-16 h-[1px] bg-maze-gold/60 mx-auto my-2" />
              <p className="text-[10px] font-outfit text-maze-silver uppercase tracking-wider">
                Labyrinth connection stabilized
              </p>
            </div>

            {/* Content Columns */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-outfit relative">
              
              {/* Left Column: Build, Stats, Settings */}
              <div className="space-y-4">
                
                {/* Weapon Build Info */}
                <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-3">
                  <h4 className="text-[10px] font-cinzel font-black text-maze-gold uppercase tracking-wider mb-1">
                    Weapon Build (현재 빌드)
                  </h4>
                  <div className="font-cinzel font-bold text-maze-cream text-[13px] uppercase">
                    {selectedBuild === 'breaker' && `Breaker Mace +${weaponLevel - 1} (파쇄)`}
                    {selectedBuild === 'striker' && `Striker Mace +${weaponLevel - 1} (쾌속)`}
                    {selectedBuild === 'cartographer' && `Cartographer Mace +${weaponLevel - 1} (개척)`}
                    {selectedBuild === 'guardian' && `Guardian Greatsword +${weaponLevel - 1} (수호)`}
                  </div>
                  <p className="text-[9px] text-maze-silver/90 mt-1 leading-relaxed">
                    {selectedBuild === 'breaker' && '메이스 중화기 파쇄 중심 격돌. 넉백 및 벽 충돌 설계.'}
                    {selectedBuild === 'striker' && '소드 쾌속 궤적 연속 타격 대시. 신속한 치고 빠지기.'}
                    {selectedBuild === 'cartographer' && '진로 개척 및 격자 타입 Forecast. 안전한 경로 예측.'}
                    {selectedBuild === 'guardian' && '그레이트 소드 광역 베기 및 생존. 거대한 공격 각도.'}
                  </p>
                </div>

                {/* Current Stats */}
                <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-3 space-y-2">
                  <h4 className="text-[10px] font-cinzel font-black text-maze-gold uppercase tracking-wider">
                    Current Stats (현재 스탯)
                  </h4>
                  <div className="grid grid-cols-3 gap-2 text-center text-[10px]">
                    <div className="bg-slate-900/60 p-1.5 rounded border border-slate-900">
                      <span className="text-maze-silver block text-[8px] uppercase">LEVEL</span>
                      <span className="text-maze-cream font-bold font-cinzel text-xs">{level}</span>
                    </div>
                    <div className="bg-slate-900/60 p-1.5 rounded border border-slate-900">
                      <span className="text-maze-silver block text-[8px] uppercase">HEALTH</span>
                      <span className="text-maze-accent font-bold font-cinzel text-xs">{Math.round(hp)}</span>
                    </div>
                    <div className="bg-slate-900/60 p-1.5 rounded border border-slate-900">
                      <span className="text-maze-silver block text-[8px] uppercase">STAMINA</span>
                      <span className="text-maze-gold font-bold font-cinzel text-xs">{Math.round(stamina)}</span>
                    </div>
                  </div>
                </div>

                {/* Settings Panel */}
                <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-3 space-y-3">
                  <div className="flex justify-between items-center">
                    <h4 className="text-[10px] font-cinzel font-black text-maze-gold uppercase tracking-wider">
                      Settings (설정)
                    </h4>
                    <button 
                      onClick={() => soundManager?.toggleMute()}
                      className="text-[9px] text-maze-gold underline hover:text-white uppercase font-bold"
                    >
                      {soundManager?.isMuted ? 'Unmute' : 'Mute'}
                    </button>
                  </div>
                  
                  {/* BGM Volume Slider */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center text-[9px] text-maze-silver font-outfit font-semibold">
                      <span>BGM VOLUME (배경음)</span>
                      <span className="text-maze-gold">{Math.round((soundManager?.bgmVolume ?? 0.6) * 100)}%</span>
                    </div>
                    <input 
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={soundManager?.isMuted ? 0 : (soundManager?.bgmVolume ?? 0.6)}
                      onChange={(e) => {
                        soundManager?.setBgmVolume(parseFloat(e.target.value));
                        if (soundManager?.isMuted && parseFloat(e.target.value) > 0) {
                          soundManager?.toggleMute();
                        }
                      }}
                      className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-maze-gold"
                    />
                  </div>

                  {/* SFX Volume Slider */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center text-[9px] text-maze-silver font-outfit font-semibold">
                      <span>SFX VOLUME (효과음)</span>
                      <span className="text-maze-gold">{Math.round((soundManager?.sfxVolume ?? 0.7) * 100)}%</span>
                    </div>
                    <input 
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={soundManager?.isMuted ? 0 : (soundManager?.sfxVolume ?? 0.7)}
                      onChange={(e) => {
                        soundManager?.setSfxVolume(parseFloat(e.target.value));
                        if (soundManager?.isMuted && parseFloat(e.target.value) > 0) {
                          soundManager?.toggleMute();
                        }
                      }}
                      className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-maze-gold"
                    />
                  </div>
                </div>

              </div>

              {/* Right Column: Upgrades & Controls */}
              <div className="space-y-4">
                
                {/* Active Upgrades */}
                <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-3 flex flex-col justify-between min-h-[125px]">
                  <div>
                    <h4 className="text-[10px] font-cinzel font-black text-maze-gold uppercase tracking-wider mb-1.5">
                      Active Upgrades (활성 업그레이드)
                    </h4>
                    <div className="space-y-1 max-h-[110px] overflow-y-auto">
                      {activeUpgrades.map((u, i) => (
                        <div key={i} className="text-[9px] font-outfit bg-slate-900/60 border border-slate-850 px-2 py-0.5 rounded text-maze-cream flex justify-between">
                          <span>⚡ {u.name}</span>
                          <span className="text-maze-gold font-bold text-[8px]">{u.synergy}</span>
                        </div>
                      ))}
                      {activeUpgrades.length === 0 && (
                        <p className="text-[9px] text-slate-600 italic">No upgrades committed yet</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Controls Summary */}
                <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-3 space-y-1">
                  <h4 className="text-[10px] font-cinzel font-black text-maze-gold uppercase tracking-wider mb-1">
                    Controls Guide (조작법 요약)
                  </h4>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[9px] text-maze-silver">
                    <div><span className="text-maze-cream font-bold font-cinzel">WASD</span>: 이동</div>
                    <div><span className="text-maze-cream font-bold font-cinzel">SPACE / CLICK</span>: 공격</div>
                    <div><span className="text-maze-cream font-bold font-cinzel">L-SHIFT</span>: 대시</div>
                    <div><span className="text-maze-cream font-bold font-cinzel">F / INTERACT</span>: 모듈 상호작용</div>
                    <div><span className="text-maze-cream font-bold font-cinzel">M</span>: 미니맵 토글</div>
                    <div><span className="text-maze-cream font-bold font-cinzel">Q</span>: 특수 스킬</div>
                    <div><span className="text-maze-cream font-bold font-cinzel">ESC</span>: 일시정지</div>
                    <div><span className="text-maze-cream font-bold font-cinzel">TAB</span>: 실시간 통계 HUD</div>
                  </div>
                </div>

              </div>

            </div>

            {/* Accessibility Settings (접근성 설정) */}
            <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-3 space-y-2 relative">
              <h4 className="text-[10px] font-cinzel font-black text-maze-gold uppercase tracking-wider">
                Accessibility Settings (접근성 설정)
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-[9px] font-outfit">
                {/* Colorblind Mode Toggle */}
                <button
                  type="button"
                  onClick={handleToggleColorblind}
                  className={`px-2 py-1.5 rounded border transition-all flex items-center justify-between cursor-pointer ${
                    colorblindMode 
                      ? 'border-cyan-500 bg-cyan-950/20 text-cyan-400 font-bold shadow-[0_0_8px_rgba(6,182,212,0.35)]' 
                      : 'border-slate-800 bg-slate-900/40 text-maze-silver hover:bg-slate-900/60'
                  }`}
                >
                  <span>색맹 모드 (Colorblind)</span>
                  <span>{colorblindMode ? 'ON' : 'OFF'}</span>
                </button>

                {/* Screenshake Toggle */}
                <button
                  type="button"
                  onClick={handleToggleScreenshake}
                  className={`px-2 py-1.5 rounded border transition-all flex items-center justify-between cursor-pointer ${
                    disableScreenshake 
                      ? 'border-cyan-500 bg-cyan-950/20 text-cyan-400 font-bold shadow-[0_0_8px_rgba(6,182,212,0.35)]' 
                      : 'border-slate-800 bg-slate-900/40 text-maze-silver hover:bg-slate-900/60'
                  }`}
                >
                  <span>화면 흔들림 끄기</span>
                  <span>{disableScreenshake ? 'ON' : 'OFF'}</span>
                </button>

                {/* Reduce Particles Toggle */}
                <button
                  type="button"
                  onClick={handleToggleReduceParticles}
                  className={`px-2 py-1.5 rounded border transition-all flex items-center justify-between cursor-pointer ${
                    reduceParticles 
                      ? 'border-cyan-500 bg-cyan-950/20 text-cyan-400 font-bold shadow-[0_0_8px_rgba(6,182,212,0.35)]' 
                      : 'border-slate-800 bg-slate-900/40 text-maze-silver hover:bg-slate-900/60'
                  }`}
                >
                  <span>이펙트 최소화</span>
                  <span>{reduceParticles ? 'ON' : 'OFF'}</span>
                </button>

                {/* Text Size Toggle */}
                <button
                  type="button"
                  onClick={handleToggleTextSize}
                  className={`px-2 py-1.5 rounded border transition-all flex items-center justify-between cursor-pointer ${
                    textSize === 'large' 
                      ? 'border-cyan-500 bg-cyan-950/20 text-cyan-400 font-bold shadow-[0_0_8px_rgba(6,182,212,0.35)]' 
                      : 'border-slate-800 bg-slate-900/40 text-maze-silver hover:bg-slate-900/60'
                  }`}
                >
                  <span>텍스트 크게</span>
                  <span>{textSize === 'large' ? 'LARGE' : 'NORMAL'}</span>
                </button>

                {/* High Contrast Mode Toggle */}
                <button
                  type="button"
                  onClick={handleToggleHighContrast}
                  className={`px-2 py-1.5 rounded border transition-all flex items-center justify-between cursor-pointer ${
                    highContrastMode 
                      ? 'border-cyan-500 bg-cyan-950/20 text-cyan-400 font-bold shadow-[0_0_8px_rgba(6,182,212,0.35)]' 
                      : 'border-slate-800 bg-slate-900/40 text-maze-silver hover:bg-slate-900/60'
                  }`}
                >
                  <span>고대비 모드 (Contrast)</span>
                  <span>{highContrastMode ? 'ON' : 'OFF'}</span>
                </button>

                {/* Auto Aim Assist Toggle */}
                <button
                  type="button"
                  onClick={handleToggleAutoAim}
                  className={`px-2 py-1.5 rounded border transition-all flex items-center justify-between cursor-pointer ${
                    autoAimAssist 
                      ? 'border-cyan-500 bg-cyan-950/20 text-cyan-400 font-bold shadow-[0_0_8px_rgba(6,182,212,0.35)]' 
                      : 'border-slate-800 bg-slate-900/40 text-maze-silver hover:bg-slate-900/60'
                  }`}
                >
                  <span>자동 조준 (Auto-Aim)</span>
                  <span>{autoAimAssist ? 'ON' : 'OFF'}</span>
                </button>
              </div>
            </div>

            {/* Buttons Footer */}
            <div className="flex gap-3 justify-end mt-2 pt-3 border-t border-slate-900 relative">
              <button 
                type="button"
                onClick={() => {
                  setShowGiveUpConfirm(true);
                }}
                className="px-4 py-2 rounded-lg bg-red-950/20 border border-red-900/40 text-maze-accent font-cinzel font-black text-[10px] tracking-widest hover:bg-red-950/60 active:scale-95 transition-all cursor-pointer"
              >
                GIVE UP (런 포기)
              </button>
              <button 
                type="button"
                onClick={() => {
                  setIsLocalPaused(false);
                  setShowGiveUpConfirm(false);
                }}
                className="px-6 py-2 rounded-lg bg-gradient-to-r from-maze-gold to-[#FFA500] text-maze-bg font-cinzel font-black text-[10px] tracking-widest shadow-[0_0_15px_rgba(201,168,76,0.3)] hover:brightness-110 active:scale-95 transition-all cursor-pointer"
              >
                RESUME (재개)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Give Up Confirmation Overlay */}
      {showGiveUpConfirm && isLocalPaused && (
        <div className="absolute inset-0 z-[95] flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-4 select-none animate-fade-in">
          <div className="bg-slate-950 border-2 border-red-600 rounded-2xl max-w-sm w-full p-6 shadow-[0_0_40px_rgba(220,38,38,0.4)] flex flex-col gap-4 text-center text-maze-cream relative">
            <h3 className="text-lg font-cinzel font-black text-red-500 tracking-widest drop-shadow-[0_0_10px_#EF4444]">
              ⚠️ GIVE UP RUN? (런 포기) ⚠️
            </h3>
            <p className="text-xs text-maze-silver font-outfit leading-relaxed">
              정말 미궁 탐색을 중단하고 탈출하시겠습니까?<br />
              현재까지 처치한 몬스터와 점수가 정산에 포함됩니다.
            </p>
            <div className="flex gap-3 justify-center mt-2">
              <button 
                type="button"
                onClick={() => {
                  setShowGiveUpConfirm(false);
                }}
                className="flex-1 py-2 rounded bg-slate-900 border border-slate-800 text-maze-silver font-cinzel font-bold text-[10px] tracking-widest hover:bg-slate-800 active:scale-95 transition-all cursor-pointer"
              >
                CANCEL (취소)
              </button>
              <button 
                type="button"
                onClick={() => {
                  setIsLocalPaused(false);
                  setShowGiveUpConfirm(false);
                  
                  // Report current statistics and trigger game over results screen
                  onGameOverRef.current({
                    score: score,
                    kills: killsCount.current,
                    roomsExpanded: roomsExpandedCount.current,
                    maxCombo: maxComboRef.current,
                    contamination: contamination,
                    survivalTime: survivalTimeRef.current
                  });
                }}
                className="flex-1 py-2 rounded bg-red-950/80 border border-red-600 text-maze-accent font-cinzel font-black text-[10px] tracking-widest hover:bg-red-900 active:scale-95 transition-all cursor-pointer"
              >
                GIVE UP (포기)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Real-time Run Statistics HUD Overlay (Toggled via Tab key) */}
      {showStatsHUD && (
        <div className="absolute inset-0 z-[85] flex items-center justify-center bg-slate-950/65 backdrop-blur-sm p-4 select-none animate-fade-in pointer-events-none">
          <div className="bg-slate-950/95 border-2 border-maze-gold/40 rounded-2xl max-w-md w-full p-6 shadow-[0_0_30px_rgba(201,168,76,0.3)] flex flex-col gap-4 text-maze-cream relative pointer-events-auto">
            {/* Close Button / Toggle Hint */}
            <div className="absolute top-3 right-4 text-[9px] font-outfit text-maze-silver/60">
              Press [Tab] to toggle
            </div>
            
            <h3 className="text-sm font-cinzel font-black text-maze-gold tracking-widest border-b border-slate-800/85 pb-2 text-center">
              📊 RUN STATISTICS (실시간 통계)
            </h3>
            
            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-3 my-1">
              <div className="bg-slate-900/40 border border-slate-850 p-2.5 rounded-xl flex flex-col items-center justify-center">
                <span className="text-[9px] font-cinzel text-maze-silver uppercase tracking-wider">RUN TIME (시간)</span>
                <span className="text-lg font-outfit font-black text-maze-cream mt-1">{displayTime}</span>
              </div>
              <div className="bg-slate-900/40 border border-slate-850 p-2.5 rounded-xl flex flex-col items-center justify-center">
                <span className="text-[9px] font-cinzel text-maze-silver uppercase tracking-wider">KILLS (처치 수)</span>
                <span className="text-lg font-outfit font-black text-maze-accent mt-1">{kills}</span>
              </div>
              <div className="bg-slate-900/40 border border-slate-850 p-2.5 rounded-xl flex flex-col items-center justify-center">
                <span className="text-[9px] font-cinzel text-maze-silver uppercase tracking-wider">ROOMS EXPANDED (방 수)</span>
                <span className="text-lg font-outfit font-black text-maze-gold mt-1">{rooms.length}</span>
              </div>
              <div className="bg-slate-900/40 border border-slate-850 p-2.5 rounded-xl flex flex-col items-center justify-center">
                <span className="text-[9px] font-cinzel text-maze-silver uppercase tracking-wider">MAX COMBO (최고 콤보)</span>
                <span className="text-lg font-outfit font-black text-red-500 mt-1">{maxCombo}</span>
              </div>
            </div>
            
            {/* Acquired Equipment Deck */}
            <div className="bg-slate-900/20 border border-slate-850 rounded-xl p-3">
              <span className="text-[10px] font-cinzel font-black text-maze-silver uppercase tracking-wider block mb-2 text-center">
                ACQUIRED UPGRADES (획득 장비 목록)
              </span>
              <div className="flex flex-wrap gap-2 justify-center max-h-[120px] overflow-y-auto p-1">
                {activeUpgrades.map((u, i) => (
                  <div 
                    key={i} 
                    className="flex items-center gap-1.5 bg-slate-950/80 border border-slate-800 px-2.5 py-1.5 rounded-lg text-maze-cream select-none hover:border-maze-gold/60 transition-all duration-300 relative group cursor-help"
                  >
                    <div className="flex-shrink-0">
                      {getUpgradeIconHUD(u.type)}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] font-cinzel font-bold leading-none">{u.name}</span>
                      <span className="text-[8px] text-maze-gold font-semibold tracking-wider mt-0.5 uppercase leading-none">{u.synergy}</span>
                    </div>
                    {/* Hover tooltip for description */}
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-48 p-2 bg-slate-950 border border-slate-800 rounded-lg text-[9px] leading-relaxed text-maze-silver opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-200 z-50 shadow-xl">
                      {u.desc}
                    </div>
                  </div>
                ))}
                {activeUpgrades.length === 0 && (
                  <span className="text-[10px] text-slate-600 italic py-2">No upgrades acquired (획득한 장비 없음)</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const getUpgradeIconHUD = (type: string) => {
  switch (type) {
    case 'power':
      return (
        <svg className="w-4 h-4 text-maze-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      );
    case 'energy':
      return (
        <svg className="w-4 h-4 text-maze-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m0-12.728l.707.707m12.728 12.728l.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z" />
        </svg>
      );
    case 'map':
    default:
      return (
        <svg className="w-4 h-4 text-maze-silver" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
        </svg>
      );
  }
};
