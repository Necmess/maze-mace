import type { BuildId } from '../types/game';

interface PlayerSpriteProps {
  x: number;
  y: number;
  isMoving: boolean;
  isAttacking: boolean;
  selectedBuild: BuildId;
}

export default function PlayerSprite({ x, y, isMoving, isAttacking, selectedBuild }: PlayerSpriteProps) {
  const playAttack = isAttacking;

  return (
    <div
      style={{
        position: 'absolute',
        left: x - 30,
        top: y - 30,
        width: 60,
        height: 60,
        pointerEvents: 'none',
        zIndex: 10
      }}
    >
      <svg width="60" height="60" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg">
        <defs>
          {/* Gold Glow Filter */}
          <filter id="gold-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="1.5" result="blur" />
            <feColorMatrix type="matrix" values="
              1 0 0 0 0.78
              0 1 0 0 0.65
              0 0 1 0 0.3
              0 0 0 1 0
            " result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <style dangerouslySetInnerHTML={{__html: `
          @keyframes playerIdle {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-2px); }
          }
          @keyframes playerWalk {
            0%, 100% { transform: translateY(0) rotate(-2deg); }
            50% { transform: translateY(-3px) rotate(2deg); }
          }
          @keyframes weaponSwing {
            0% { transform: rotate(0deg); }
            30% { transform: rotate(-50deg) translate(-2px, -2px); }
            100% { transform: rotate(0deg); }
          }
          @keyframes coreGlow {
            0%, 100% { fill: #FFD700; filter: drop-shadow(0 0 1px #C9A84C); }
            50% { fill: #FFA500; filter: drop-shadow(0 0 3px #FF8C00); }
          }
          @keyframes capeWave {
            0%, 100% { transform: rotate(-2deg) scaleY(1); }
            50% { transform: rotate(2deg) scaleY(1.05); }
          }
          .player-body {
            animation: ${isMoving ? 'playerWalk 0.6s' : 'playerIdle 1.5s'} ease-in-out infinite;
            transform-origin: 30px 42px;
          }
          .player-cape {
            transform-origin: 30px 28px;
            animation: capeWave 1.2s ease-in-out infinite alternate;
          }
          .pulse-core {
            animation: coreGlow 1.0s ease-in-out infinite;
          }
          .player-weapon {
            transform-origin: 30px 30px;
            animation: ${playAttack ? 'weaponSwing 0.15s ease-in-out' : 'none'};
          }
        `}} />

        <g filter="url(#gold-glow)">
          {/* Animated Body & Armors */}
          <g className="player-body">
            {/* Ragged Cape (faded bloody leather/cloth) */}
            <path 
              d="M21,28 Q30,22 39,28 L45,54 Q36,46 30,55 Q24,46 15,54 Z"
              fill="#4A0A15" 
              stroke="#2E040B" 
              strokeWidth="1.2" 
              className="player-cape" 
            />

            {/* Lower Legs (metallic dark sabatons) */}
            <polygon points="21,41 26,48 23,51 18,48" fill="#1E1E24" stroke="#111" strokeWidth="0.8" />
            <polygon points="39,41 34,48 37,51 42,48" fill="#1E1E24" stroke="#111" strokeWidth="0.8" />
            
            {/* Leg plates (ribbed iron greaves) */}
            <rect x="21" y="40" width="7" height="8" rx="1" fill="#2E2E38" stroke="#1C1C22" strokeWidth="1" />
            <rect x="32" y="40" width="7" height="8" rx="1" fill="#2E2E38" stroke="#1C1C22" strokeWidth="1" />

            {/* Torso (heavy plates, dark blue and gold linings) */}
            <path d="M19,25 Q30,22 41,25 L38,41 Q30,43 22,41 Z" fill="#1A1A2E" stroke="#C9A84C" strokeWidth="1.8" />
            
            {/* Breastplate ridges/lines */}
            <path d="M23,29 Q30,32 37,29" fill="none" stroke="#5C6B73" strokeWidth="1.5" />
            <path d="M22,34 Q30,37 38,34" fill="none" stroke="#5C6B73" strokeWidth="1.5" />

            {/* Heart Core (glowing gold) */}
            <circle cx="30" cy="33" r="3.2" className="pulse-core" />
            
            {/* Left Arm & Shield (Steel round shield on shoulder) */}
            <g transform="translate(-1, 0)">
              <rect x="13" y="27" width="6" height="11" rx="2" fill="#2D2D38" stroke="#111" strokeWidth="0.8" />
              {/* Gold rimmed buckler */}
              <circle cx="12" cy="33" r="6" fill="#1E1E24" stroke="#C9A84C" strokeWidth="1.2" />
              <circle cx="12" cy="33" r="2" fill="#C9A84C" />
            </g>

            {/* Heavy Pauldrons (Left/Right) */}
            <path d="M13,26 Q19,20 23,24 L19,30 Z" fill="#3A3A4A" stroke="#C9A84C" strokeWidth="1" />
            <path d="M47,26 Q41,20 37,24 L41,30 Z" fill="#3A3A4A" stroke="#C9A84C" strokeWidth="1" />

            {/* Helmet (Armor-clad survivor dome) */}
            <circle cx="30" cy="16" r="7.5" fill="#2D2D3A" stroke="#C9A84C" strokeWidth="1" />
            
            {/* Helmet crest / spiky comb */}
            <path d="M28,8 Q30,2 32,8 L30,5 Z" fill="#C9A84C" />
            <path d="M23,12 Q20,6 25,10" fill="none" stroke="#C9A84C" strokeWidth="1" />
            <path d="M37,12 Q40,6 35,10" fill="none" stroke="#C9A84C" strokeWidth="1" />

            {/* Visor slit with horizontal glowing gap */}
            <rect x="24" y="14" width="12" height="3" rx="0.5" fill="#111" />
            <line x1="25" y1="15" x2="35" y2="15" stroke="#FFD700" strokeWidth="1.8" strokeLinecap="round" filter="drop-shadow(0 0 1.5px #FF8C00)" />
          </g>

          {/* Right Arm & Selected Weapon (Swing Animation) */}
          <g className="player-weapon">
            {/* Right Arm (dark metal) */}
            <rect x="40" y="27" width="6" height="10" rx="1.5" fill="#2D2D38" stroke="#111" strokeWidth="0.8" transform="rotate(-10, 43, 32)" />

            {selectedBuild === 'breaker' && (
              // Heavy Breaker Mace: Giant spiked iron club with cracks
              <g>
                <rect x="42.5" y="10" width="2" height="22" fill="#5C6B73" rx="0.5" />
                {/* Mace head (massive spiked oval) */}
                <ellipse cx="43.5" cy="5" rx="7" ry="9" fill="#1C1C22" stroke="#C9A84C" strokeWidth="1.5" />
                {/* Gold energy veins on head */}
                <path d="M40,3 Q43.5,6 43.5,1 Q46.5,4 47,8" fill="none" stroke="#FFD700" strokeWidth="0.8" />
                
                {/* Spikes */}
                <polygon points="43.5,-6 40.5,-1 46.5,-1" fill="#C9A84C" />
                <polygon points="43.5,16 40.5,11 46.5,11" fill="#C9A84C" />
                <polygon points="33,5 38,2 38,8" fill="#C9A84C" />
                <polygon points="54,5 49,2 49,8" fill="#C9A84C" />
                
                {/* Diagonals */}
                <polygon points="36,-2 40,1 38,3" fill="#C9A84C" />
                <polygon points="51,-2 47,1 49,3" fill="#C9A84C" />
                <polygon points="36,12 40,9 38,7" fill="#C9A84C" />
                <polygon points="51,12 47,9 49,7" fill="#C9A84C" />
              </g>
            )}

            {selectedBuild === 'striker' && (
              // Swift Striker Sword: Sleek double-edged short sword with golden wings
              <g>
                {/* Handle */}
                <rect x="42.5" y="18" width="1.5" height="13" fill="#8A9BA8" />
                {/* Guard (winged, elegant gold) */}
                <path d="M37,18 Q43.5,15 50,18 L46,20 L41,20 Z" fill="#C9A84C" stroke="#8F712A" strokeWidth="0.8" />
                {/* Sharp blade */}
                <polygon points="42,2 44.5,2 46,18 40.5,18" fill="#EBF1F5" stroke="#C9A84C" strokeWidth="1.0" />
                {/* Blade center gold glow */}
                <line x1="43.25" y1="4" x2="43.25" y2="16" stroke="#FFD700" strokeWidth="1.0" />
              </g>
            )}

            {selectedBuild === 'guardian' && (
              // Guardian Greatsword: Massive Broadsword with runic markings
              <g>
                {/* Long handle */}
                <rect x="42.5" y="15" width="2" height="17" fill="#5C6B73" rx="0.5" />
                {/* Heavy crossguard */}
                <polygon points="35,15 52,15 47,17 40,17" fill="#C9A84C" stroke="#8F712A" strokeWidth="1" />
                {/* Broad runic blade */}
                <polygon points="41, -5 46, -5 47.5,15 39.5,15" fill="#E6EEF2" stroke="#C9A84C" strokeWidth="1.5" />
                {/* Sword tip spikes */}
                <polygon points="43.5,-9 40.5,-4 46.5,-4" fill="#C9A84C" />
                {/* Runic glyph dots */}
                <circle cx="43.5" cy="0" r="1.0" fill="#FFD700" />
                <circle cx="43.5" cy="4" r="1.0" fill="#FFD700" />
                <circle cx="43.5" cy="8" r="1.0" fill="#FFD700" />
                <circle cx="43.5" cy="12" r="1.0" fill="#FFD700" />
              </g>
            )}

            {selectedBuild === 'cartographer' && (
              // Cartographer Mace: Compass-like relic star mace
              <g>
                <rect x="42.5" y="12" width="1.8" height="20" fill="#8A9BA8" />
                {/* Star relic head */}
                <path d="M43.5,-1 L46.5,4 L52,4 L47.5,7.5 L49.5,13 L43.5,9.5 L37.5,13 L39.5,7.5 L35,4 L40.5,4 Z" fill="#1F2A44" stroke="#C9A84C" strokeWidth="1.2" />
                {/* Center glowing crystal orb */}
                <circle cx="43.5" cy="6" r="3.2" fill="#FFD700" filter="drop-shadow(0 0 2px #FF8C00)" />
              </g>
            )}
          </g>
        </g>
      </svg>
    </div>
  );
}
