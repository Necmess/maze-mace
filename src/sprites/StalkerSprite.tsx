interface StalkerSpriteProps {
  x: number;
  y: number;
  isHit: boolean;
  isMoving: boolean;
  isElite?: boolean;
  isBoss?: boolean;
  isMini?: boolean;
}

export default function StalkerSprite({
  x,
  y,
  isHit,
  isMoving,
  isElite = false,
  isBoss = false,
  isMini = false
}: StalkerSpriteProps) {
  let scale = isBoss ? 1.65 : isElite ? 1.35 : 1.0;
  if (isMini) {
    scale *= 0.55;
  }

  const coreColor = 'hsl(275, 75%, 12%)';
  const vaporColor = 'hsl(290, 85%, 22%)';
  const eyeColor = 'hsl(180, 95%, 55%)'; // Cyan glow eyes
  const shadowColor = 'hsl(280, 70%, 8%)';

  return (
    <div
      className={isElite || isBoss ? 'animate-elite-aura' : ''}
      style={{
        position: 'absolute',
        left: x - 22 * scale, // Centered at x
        top: y - 22 * scale,  // Centered at y
        width: 44 * scale,
        height: 44 * scale,
        pointerEvents: 'none',
        zIndex: 9
      }}
    >
      <svg width={44 * scale} height={44 * scale} viewBox="0 0 44 44" xmlns="http://www.w3.org/2000/svg">
        <defs>
          {/* Violet gaseous glow filter */}
          <filter id="stalker-glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="2.2" result="blur" />
            <feColorMatrix type="matrix" values="
              0.6 0 0 0 0.4
              0 0.1 0 0 0.1
              0 0 0.9 0 0.5
              0 0 0 1 0
            " result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <style dangerouslySetInnerHTML={{__html: `
          @keyframes stalkerFloat {
            0% { transform: translateY(1.5px) scale(0.96); }
            100% { transform: translateY(-1.5px) scale(1.04); }
          }
          @keyframes tendrilWriggleA {
            0%, 100% { transform: rotate(-8deg); }
            50% { transform: rotate(8deg); }
          }
          @keyframes tendrilWriggleB {
            0%, 100% { transform: rotate(12deg) scaleY(0.9); }
            50% { transform: rotate(-12deg) scaleY(1.1); }
          }
          @keyframes stalkerHitFlash {
            0%, 100% { fill: none; }
            50% { fill: rgba(220, 38, 38, 0.9); filter: brightness(1.6); }
          }
          .stalker-group {
            transform-origin: 22px 22px;
            animation: stalkerFloat ${isMoving ? '0.7s' : '1.4s'} ease-in-out infinite alternate;
          }
          .tendril-a {
            transform-origin: 22px 22px;
            animation: tendrilWriggleA 1.0s ease-in-out infinite;
          }
          .tendril-b {
            transform-origin: 22px 22px;
            animation: tendrilWriggleB 1.3s ease-in-out infinite;
          }
          .stalker-hit-overlay {
            animation: ${isHit ? 'stalkerHitFlash 0.12s linear' : 'none'};
          }
        `}} />

        <g filter="url(#stalker-glow)" className="stalker-group">
          {/* Shadow tendrils writhing */}
          <g className="tendril-a">
            {/* Top Left Tendril */}
            <path d="M16,16 C12,10 6,12 4,6" fill="none" stroke={vaporColor} strokeWidth="2.5" strokeLinecap="round" />
            {/* Bottom Right Tendril */}
            <path d="M28,28 C32,34 38,32 40,38" fill="none" stroke={vaporColor} strokeWidth="2" strokeLinecap="round" />
          </g>
          <g className="tendril-b">
            {/* Top Right Tendril */}
            <path d="M28,16 C32,10 38,12 40,6" fill="none" stroke={vaporColor} strokeWidth="2.5" strokeLinecap="round" />
            {/* Bottom Left Tendril */}
            <path d="M16,28 C12,34 6,32 4,38" fill="none" stroke={vaporColor} strokeWidth="2" strokeLinecap="round" />
          </g>

          {/* Additional secondary tendrils */}
          <path d="M10,22 C6,22 4,25 2,24" fill="none" stroke={shadowColor} strokeWidth="1.5" strokeLinecap="round" />
          <path d="M34,22 C38,22 40,25 42,24" fill="none" stroke={shadowColor} strokeWidth="1.5" strokeLinecap="round" />

          {/* Gaseous Outer Mist */}
          <circle cx="22" cy="22" r="13" fill={vaporColor} opacity="0.65" />

          {/* Central Dark Core Body */}
          <circle cx="22" cy="22" r="9.5" fill={coreColor} stroke={shadowColor} strokeWidth="1.5" />

          {/* Multiple creepy eyes glowing */}
          {/* Center Main Eye */}
          <ellipse cx="22" cy="21" rx="3.5" ry="2" fill="#111" />
          <circle cx="22" cy="21" r="1" fill={eyeColor} />

          {/* Left Secondary Eye */}
          <circle cx="16" cy="23" r="1.8" fill="#111" />
          <circle cx="16" cy="23" r="0.7" fill={eyeColor} />

          {/* Right Secondary Eye */}
          <circle cx="28" cy="23" r="1.8" fill="#111" />
          <circle cx="28" cy="23" r="0.7" fill={eyeColor} />

          {/* Top small forehead eye */}
          <circle cx="22" cy="15" r="1.2" fill="#111" />
          <circle cx="22" cy="15" r="0.5" fill={eyeColor} />

          {/* Hit overlay */}
          <circle cx="22" cy="22" r="14" className="stalker-hit-overlay" />
        </g>
      </svg>
    </div>
  );
}
