interface WardenSpriteProps {
  x: number;
  y: number;
  isHit: boolean;
  isMoving: boolean;
  isElite?: boolean;
  isBoss?: boolean;
  isEnraged?: boolean;
  chargeState?: 'prep' | 'dash' | 'recovery';
}

export default function WardenSprite({ 
  x, 
  y, 
  isHit, 
  isMoving,
  isElite = false,
  isBoss = false,
  isEnraged = false,
  chargeState
}: WardenSpriteProps) {
  const scale = isBoss ? 1.65 : isElite ? 1.35 : 1.0;

  let divClassName = (isElite || isBoss) ? 'animate-elite-aura' : '';
  if (isEnraged) {
    divClassName = 'enraged-aura';
  }

  return (
    <div
      className={divClassName}
      style={{
        position: 'absolute',
        left: x - 26 * scale, // Centered at x
        top: y - 26 * scale,  // Centered at y
        width: 52 * scale,
        height: 52 * scale,
        pointerEvents: 'none',
        zIndex: 9
      }}
    >
      <svg width={52 * scale} height={52 * scale} viewBox="0 0 52 52" xmlns="http://www.w3.org/2000/svg">
        <defs>
          {/* Corrupted Crimson/Purple Glow Filter */}
          <filter id="warden-glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="2.2" result="blur" />
            <feColorMatrix type="matrix" values="
              0.7 0 0 0 0.25
              0 0.1 0 0 0.05
              0 0 0.5 0 0.15
              0 0 0 1 0
            " result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <style dangerouslySetInnerHTML={{__html: `
          @keyframes enragedAura {
            0%, 100% { box-shadow: 0 0 14px rgba(239, 68, 68, 0.65); }
            50% { box-shadow: 0 0 32px rgba(239, 68, 68, 1.0); }
          }
          .enraged-aura {
            animation: enragedAura 0.8s infinite ease-in-out;
            border-radius: 50%;
          }
          @keyframes wardenVibrate {
            0%, 100% { transform: translate(0, 0) rotate(0deg); }
            20% { transform: translate(-1.5px, 1px) rotate(-1deg); }
            40% { transform: translate(1px, -1.5px) rotate(1deg); }
            60% { transform: translate(-1px, -1px) rotate(-0.5deg); }
            80% { transform: translate(1.5px, 1.5px) rotate(0.5deg); }
          }
          @keyframes wardenBreath {
            0%, 100% { transform: translateY(0px) scale(1.0); }
            50% { transform: translateY(-1.5px) scale(1.02); }
          }
          @keyframes wardenWalk {
            0%, 100% { transform: translateY(0) rotate(-2deg); }
            50% { transform: translateY(-2px) rotate(2deg); }
          }
          @keyframes tendrilWriggleLeft {
            0%, 100% { transform: rotate(-6deg); }
            50% { transform: rotate(8deg); }
          }
          @keyframes tendrilWriggleRight {
            0%, 100% { transform: rotate(6deg); }
            50% { transform: rotate(-8deg); }
          }
          @keyframes heartBeat {
            0%, 100% { transform: scale(1.0); filter: brightness(1.0); }
            30% { transform: scale(1.22); filter: brightness(1.35); }
            45% { transform: scale(1.08); filter: brightness(1.15); }
            60% { transform: scale(1.28); filter: brightness(1.4); }
          }
          @keyframes wardenHitFlash {
            0%, 100% { opacity: 0; }
            50% { opacity: 0.95; }
          }

          .warden-container {
            transform-origin: 26px 26px;
          }
          .warden-body {
            transform-origin: 26px 36px;
            animation: ${chargeState === 'prep' ? 'wardenVibrate 0.12s linear infinite' : (isMoving ? 'wardenWalk 0.5s' : 'wardenBreath 1.8s')} ease-in-out infinite;
          }
          .left-tendril {
            transform-origin: 16px 20px;
            animation: tendrilWriggleLeft 2.2s ease-in-out infinite alternate;
          }
          .right-tendril {
            transform-origin: 36px 20px;
            animation: tendrilWriggleRight 1.8s ease-in-out infinite alternate;
          }
          .heart-core {
            transform-origin: 26px 30px;
            animation: heartBeat ${isEnraged ? '0.4s' : '0.8s'} ease-in-out infinite;
          }
          .warden-hit {
            animation: ${isHit ? 'wardenHitFlash 0.12s linear' : 'none'};
            pointer-events: none;
            opacity: 0;
          }
        `}} />

        <g filter="url(#warden-glow)" className="warden-container">
          {/* Fleshy back tendrils (rendered behind the body) */}
          <path d="M16,18 C9,13 7,16 3,11" fill="none" stroke="#580A1D" strokeWidth="2" className="left-tendril" strokeLinecap="round" />
          <path d="M36,18 C43,13 45,16 49,11" fill="none" stroke="#580A1D" strokeWidth="2" className="right-tendril" strokeLinecap="round" />
          <path d="M14,24 C7,26 5,22 2,25" fill="none" stroke="#580A1D" strokeWidth="1.6" className="left-tendril" strokeLinecap="round" />
          <path d="M38,24 C45,26 47,22 50,25" fill="none" stroke="#580A1D" strokeWidth="1.6" className="right-tendril" strokeLinecap="round" />

          {/* Main animated body group */}
          <g className="warden-body">
            {/* Ragged cloak / shroud */}
            <path 
              d="M18,22 Q26,17 34,22 L41,43 L34,39 L26,45 L18,39 L11,43 Z" 
              fill="#3A0813" 
              stroke="#1E040A" 
              strokeWidth="1.2" 
            />

            {/* Mutated weapon (Heavy rusted Greatsword fused to right shoulder/arm) */}
            <g>
              {/* Flesh wrapping handle */}
              <path d="M36,23 Q40,26 39,30" fill="none" stroke="#8B0000" strokeWidth="2.5" />
              {/* Rusted guard */}
              <polygon points="34,22 43,24 41,26 33,24" fill="#C9A84C" opacity="0.6" stroke="#111" strokeWidth="0.8" />
              {/* Massive chipped blade */}
              <polygon points="37,21 44,6 49,8 41,23" fill="#3D3D4A" stroke="#222" strokeWidth="1" />
              <polygon points="39,18 43,8 45,9 41,20" fill="#2E2E3A" />
              {/* Glowing red vein along the blade */}
              <path d="M39,21 L44,8" fill="none" stroke="#FF3B30" strokeWidth="1" strokeLinecap="round" filter="drop-shadow(0 0 1px #E63946)" />
            </g>

            {/* Sabatons / Greaves */}
            <g>
              <polygon points="18,39 22,46 19,48 15,44" fill="#1C1C22" stroke="#111" strokeWidth="0.8" />
              <polygon points="34,39 30,46 33,48 37,44" fill="#1C1C22" stroke="#111" strokeWidth="0.8" />
              <rect x="17" y="35" width="6" height="7" rx="1" fill="#3D3D4A" stroke="#1C1C22" strokeWidth="1" />
              <rect x="29" y="35" width="6" height="7" rx="1" fill="#3D3D4A" stroke="#1C1C22" strokeWidth="1" />
            </g>

            {/* Left Shield/Shoulder Buckler (Corrupted and cracked) */}
            <circle cx="12" cy="27" r="5" fill="#2E2E3A" stroke="#8B0000" strokeWidth="1.2" />
            <path d="M9,27 L15,27" stroke="#111" strokeWidth="0.8" />

            {/* Torso Armor (Rusted dark steel plates, cracked exposing core) */}
            {/* Base dark red background for chest cavity */}
            <path d="M21,22 L31,22 L32,36 L20,36 Z" fill="#4B000F" />
            
            {/* Left chest plate */}
            <path d="M16,22 L24,22 L22,29 L25,31 L22,36 L15,36 Z" fill="#2E2E3A" stroke="#5C6B73" strokeWidth="1.5" />
            {/* Right chest plate */}
            <path d="M36,22 L28,22 L30,29 L27,31 L30,36 L37,36 Z" fill="#2E2E3A" stroke="#5C6B73" strokeWidth="1.5" />

            {/* Heart Core (exposed pulsating core inside cavity) */}
            <circle cx="26" cy="30" r="4" fill="#FF3B30" className="heart-core" filter="drop-shadow(0 0 2.5px #E63946)" />

            {/* Helmet (cracked steel survivor dome) */}
            <circle cx="26" cy="14" r="7" fill="#2E2E3A" stroke="#5C6B73" strokeWidth="1.2" />
            {/* Visor opening and glowing red eye/slit */}
            <rect x="21" y="12" width="10" height="2.5" rx="0.5" fill="#111" />
            <line x1="22" y1="13.25" x2="30" y2="13.25" stroke="#FF3B30" strokeWidth="1.5" strokeLinecap="round" filter="drop-shadow(0 0 1.5px #E63946)" />
            {/* Helmet Crack */}
            <path d="M26,7.5 L28,10 L27,11" fill="none" stroke="#111" strokeWidth="0.8" />

            {/* Heavy Mutated Crown / Horns */}
            <polygon points="20,9 13,2 18,7" fill="#8B0000" stroke="#1E040A" strokeWidth="0.8" />
            <polygon points="32,9 39,2 34,7" fill="#8B0000" stroke="#1E040A" strokeWidth="0.8" />
          </g>

          {/* Hit overlay (matches head, torso, sword and flashes on isHit) */}
          <g className="warden-hit">
            <circle cx="26" cy="14" r="8" fill="#FF3B30" />
            <path d="M14,22 L38,22 L38,36 L14,36 Z" fill="#FF3B30" />
            <polygon points="37,21 44,6 49,8 41,23" fill="#FF3B30" />
          </g>
        </g>
      </svg>
    </div>
  );
}
