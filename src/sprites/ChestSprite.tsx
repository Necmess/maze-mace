interface ChestSpriteProps {
  x: number;
  y: number;
  opened: boolean;
}

export default function ChestSprite({ x, y, opened }: ChestSpriteProps) {
  const playOpen = opened;

  return (
    <div
      style={{
        position: 'absolute',
        left: x - 20, // Centered at x (40x40 container)
        top: y - 20,  // Centered at y
        width: 40,
        height: 40,
        pointerEvents: 'none',
        zIndex: 8
      }}
    >
      <svg width="40" height="40" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
        <defs>
          {/* Gold Glow for chest loot */}
          <filter id="chest-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feColorMatrix type="matrix" values="
              1 0 0 0 0.8
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
          @keyframes lockPulse {
            0%, 100% { fill: #C9A84C; filter: brightness(1); }
            50% { fill: #FFD700; filter: brightness(1.3); }
          }
          @keyframes openLid {
            0% { transform: translateY(0) rotate(0deg); }
            100% { transform: translateY(-4px) rotate(-15deg); }
          }
          .chest-lock {
            animation: lockPulse 1.5s infinite;
          }
          .chest-lid {
            transform-origin: 8px 18px;
            transition: transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            transform: ${playOpen ? 'translateY(-4px) rotate(-15deg)' : 'translateY(0) rotate(0deg)'};
          }
          .open-glow {
            opacity: ${playOpen ? 0.85 : 0};
            transition: opacity 0.5s ease;
          }
        `}} />

        {/* Closed/Open State Gold Glow Background */}
        <circle cx="20" cy="22" r="10" fill="none" className="open-glow" filter="url(#chest-glow)" />

        {/* Chest Base (Iron box #1A1A2E, gold trimmings) */}
        <rect x="8" y="20" width="24" height="12" rx="1.5" fill="#1A1A2E" stroke="#8A9BA8" strokeWidth="1.5" />
        
        {/* Inside gold coins showing if opened */}
        {playOpen && (
          <ellipse cx="20" cy="20" rx="8" ry="2" fill="#FFD700" filter="url(#chest-glow)" />
        )}

        {/* Chest Lid (Spiky/Iron Dome, animates open) */}
        <g className="chest-lid">
          <path d="M8,20 Q8,10 20,10 Q32,10 32,20 Z" fill="#2D0A2E" stroke="#8A9BA8" strokeWidth="1.5" />
          {/* Iron straps */}
          <rect x="13" y="10" width="2" height="10" fill="#4B4B4B" />
          <rect x="25" y="10" width="2" height="10" fill="#4B4B4B" />
          {/* Lid spiky horns */}
          <polygon points="14,10 12,6 16,9" fill="#C8432F" />
          <polygon points="26,10 28,6 24,9" fill="#C8432F" />
        </g>

        {/* Chest Lock Details */}
        {!playOpen ? (
          // Closed chains/lock
          <>
            {/* Labyrinth fleshy chains wrapping the chest */}
            <path d="M6,22 Q20,32 34,22 M6,16 Q20,24 34,16" fill="none" stroke="#C8432F" strokeWidth="1.2" strokeDasharray="3 2" />
            {/* Gold Lock */}
            <rect x="17" y="18" width="6" height="6" rx="1" fill="#C9A84C" stroke="#8F712A" strokeWidth="1" className="chest-lock" />
            <circle cx="20" cy="21" r="1" fill="#08080E" />
          </>
        ) : (
          // Broken chain fragments
          <>
            <path d="M4,24 L7,28 M36,24 L33,28" fill="none" stroke="#C8432F" strokeWidth="1" strokeLinecap="round" opacity="0.6" />
          </>
        )}
      </svg>
    </div>
  );
}
