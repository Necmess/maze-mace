interface ExpansionModuleSpriteProps {
  x: number;
  y: number;
  active: boolean;
  dir: 'N' | 'S' | 'E' | 'W';
  isHit?: boolean;
}

export default function ExpansionModuleSprite({ x, y, active, dir, isHit = false }: ExpansionModuleSpriteProps) {
  if (!active) return null;

  return (
    <div
      className={isHit ? 'hit-module' : ''}
      style={{
        position: 'absolute',
        left: x - 60, // Centered at x (120 width to allow side indicators)
        top: y - 35,  // Centered at y (70 height)
        width: 120,
        height: 70,
        pointerEvents: 'none',
        zIndex: 8
      }}
    >
      <svg width="120" height="70" viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg">
        <defs>
          {/* Fleshy organic glow filter */}
          <filter id="organic-core-glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feColorMatrix type="matrix" values="
              0.9 0 0 0 0.4
              0 0.1 0 0 0.05
              0 0 0.2 0 0.05
              0 0 0 1.2 0
            " result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          
          {/* Gold direction arrow glow filter */}
          <filter id="direction-glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="1.8" result="blur" />
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

          {/* Fleshy gradient definition */}
          <radialGradient id="flesh-grad" cx="50%" cy="40%" r="50%">
            <stop offset="0%" stopColor="#ff4d6d" />
            <stop offset="65%" stopColor="#c71f37" />
            <stop offset="100%" stopColor="#3d050c" />
          </radialGradient>
        </defs>

        <style dangerouslySetInnerHTML={{__html: `
          @keyframes organicBeating {
            0%, 100% { transform: scale(0.92); }
            45% { transform: scale(1.06); }
            60% { transform: scale(1.01); }
            75% { transform: scale(1.08); }
          }
          @keyframes chevronPulse {
            0%, 100% { opacity: 0.3; transform: translate(0, 0); }
            50% { opacity: 0.95; transform: translate(${dir === 'E' ? '2.5px' : dir === 'W' ? '-2.5px' : '0'}, ${dir === 'S' ? '2.5px' : dir === 'N' ? '-2.5px' : '0'}); }
          }
          @keyframes textBlink {
            0%, 100% { opacity: 0.3; }
            50% { opacity: 0.85; }
          }
          @keyframes crackExpand {
            0% { stroke-dashoffset: 18; opacity: 0; }
            100% { stroke-dashoffset: 0; opacity: 1; }
          }
          @keyframes moduleHitShake {
            0%, 100% { transform: translate(0, 0) rotate(0deg); }
            15% { transform: translate(-3.5px, 2px) rotate(-3deg) scale(0.95); }
            35% { transform: translate(3px, -2.5px) rotate(2.5deg) scale(1.05); }
            55% { transform: translate(-2px, -3.5px) rotate(-1.5deg) scale(0.97); }
            75% { transform: translate(2.5px, 1.5px) rotate(1.5deg) scale(1.02); }
            90% { transform: translate(-1px, -1px) rotate(-0.5deg); }
          }
          .module-core-group {
            transform-origin: 60px 30px;
            animation: organicBeating 1.4s ease-in-out infinite;
          }
          .direction-arrow {
            transform-origin: 60px 30px;
            animation: chevronPulse 1.0s ease-in-out infinite alternate;
          }
          .help-hint {
            animation: textBlink 1.4s infinite ease-in-out;
          }
          .crack-line {
            stroke-dasharray: 18;
            animation: crackExpand 0.18s ease-out forwards;
          }
          .hit-module {
            animation: moduleHitShake 0.25s ease-in-out infinite;
          }
        `}} />

        {/* Thick organic vascular roots anchor the module to boundaries */}
        <g stroke="#3D050C" strokeWidth="2.5" fill="none" strokeLinecap="round">
          {dir === 'N' && (
            <>
              <path d="M46,30 Q30,16 26,4" />
              <path d="M74,30 Q90,16 94,4" />
              <path d="M60,20 L60,2" strokeWidth="3.2" stroke="#4b0913" />
            </>
          )}
          {dir === 'S' && (
            <>
              <path d="M46,30 Q30,44 26,56" />
              <path d="M74,30 Q90,44 94,56" />
              <path d="M60,40 L60,58" strokeWidth="3.2" stroke="#4b0913" />
            </>
          )}
          {dir === 'E' && (
            <>
              <path d="M68,18 Q86,16 102,12" />
              <path d="M68,42 Q86,44 102,48" />
              <path d="M70,30 L108,30" strokeWidth="3.2" stroke="#4b0913" />
            </>
          )}
          {dir === 'W' && (
            <>
              <path d="M52,18 Q34,16 18,12" />
              <path d="M52,42 Q34,44 18,48" />
              <path d="M50,30 L12,30" strokeWidth="3.2" stroke="#4b0913" />
            </>
          )}
          {/* Base anchoring ring */}
          <path d="M42,20 Q60,10 78,20 M78,40 Q60,50 42,40" stroke="#5c111e" strokeWidth="1.8" />
        </g>

        {/* Faint gold/red directional cues surrounding the core */}
        <g filter="url(#direction-glow)" className="direction-arrow" stroke="#C9A84C" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round">
          {dir === 'N' && (
            <>
              <path d="M60,10 L54,16 M60,10 L66,16" />
              <path d="M60,4 L55,9 M60,4 L65,9" opacity="0.6" />
            </>
          )}
          {dir === 'S' && (
            <>
              <path d="M60,50 L54,44 M60,50 L66,44" />
              <path d="M60,56 L55,51 M60,56 L65,51" opacity="0.6" />
            </>
          )}
          {dir === 'E' && (
            <>
              <path d="M84,30 L78,24 M84,30 L78,36" />
              <path d="M90,30 L85,25 M90,30 L85,35" opacity="0.6" />
            </>
          )}
          {dir === 'W' && (
            <>
              <path d="M36,30 L42,24 M36,30 L42,36" />
              <path d="M30,30 L35,25 M30,30 L35,35" opacity="0.6" />
            </>
          )}
        </g>

        {/* The organic pulsing core clump */}
        <g filter="url(#organic-core-glow)" className="module-core-group">
          {/* Pulsing Clump Body */}
          <path 
            d="M60,16 C71,16 80,21 78,31 C76,41 69,45 60,45 C51,45 44,41 42,31 C40,21 49,16 60,16 Z" 
            fill="url(#flesh-grad)" 
            stroke="#8B0000" 
            strokeWidth="1.6" 
          />
          {/* Vascular grooves/textures */}
          <path d="M53,24 Q60,32 54,40 M67,24 Q60,32 66,40" fill="none" stroke="#FF4D6D" strokeWidth="0.8" opacity="0.6" />
          
          {/* Glowing central organ */}
          <circle cx="60" cy="30" r="4.2" fill="#FFC93C" filter="drop-shadow(0 0 2.5px #FF3B30)" />
        </g>

        {/* Direction Indicator label embedded in the core */}
        <text x="60" y="32.5" fill="#3D050C" fontSize="7.5" fontWeight="bold" fontFamily="Cinzel" textAnchor="middle">
          {dir}
        </text>

        {/* Crack overlays rendering on hit */}
        {isHit && (
          <g stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" filter="drop-shadow(0 0 2px #FF8C00)">
            <path d="M60,30 L55,23 L48,25" className="crack-line" />
            <path d="M60,30 L66,36 L72,33" className="crack-line" />
            <path d="M60,30 L58,39 L63,44" className="crack-line" />
            <path d="M60,30 L64,21 L69,18" className="crack-line" />
          </g>
        )}

        {/* Blinking helpful tooltip text */}
        <text
          x="60"
          y="65"
          fill="#C9A84C"
          fontSize="8"
          fontFamily="Outfit"
          fontWeight="bold"
          textAnchor="middle"
          className="help-hint"
          style={{ letterSpacing: 0.6 }}
        >
          Strike to expand {dir === 'N' ? 'UP' : dir === 'S' ? 'DOWN' : dir === 'E' ? 'RIGHT' : 'LEFT'}
        </text>
      </svg>
    </div>
  );
}
