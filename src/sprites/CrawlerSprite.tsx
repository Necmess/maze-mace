interface CrawlerSpriteProps {
  x: number;
  y: number;
  isHit: boolean;
  isMoving: boolean;
  contamination?: number;
  isElite?: boolean;
  isBoss?: boolean;
  isMini?: boolean;
}

export default function CrawlerSprite({ 
  x, 
  y, 
  isHit, 
  isMoving, 
  contamination = 0,
  isElite = false,
  isBoss = false,
  isMini = false
}: CrawlerSpriteProps) {
  let scale = isBoss ? 1.65 : isElite ? 1.35 : 1.0;
  if (isMini) {
    scale *= 0.5;
  }

  // Dynamically calculate HSL hue based on contamination level (280 purple -> 0 blood red)
  const hue = Math.max(0, 275 - contamination * 2.75);
  
  const bodyColor = `hsl(${hue}, 65%, 14%)`;
  const segmentColor = `hsl(${hue}, 75%, 22%)`;
  const outlineColor = `hsl(${hue}, 80%, 42%)`;
  const glowColor = `hsl(${hue}, 85%, 45%)`;

  return (
    <div
      className={isElite || isBoss ? 'animate-elite-aura' : ''}
      style={{
        position: 'absolute',
        left: x - 20 * scale, // Centered at x
        top: y - 20 * scale,  // Centered at y
        width: 40 * scale,
        height: 40 * scale,
        pointerEvents: 'none',
        zIndex: 9
      }}
    >
      <svg width={40 * scale} height={40 * scale} viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
        <defs>
          {/* Fleshy/Organic Red-based Glow Filter using dynamic color */}
          <filter id="crawler-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="1.8" result="blur" />
            <feColorMatrix type="matrix" values="
              0.8 0 0 0 0.2
              0 0.1 0 0 0.05
              0 0 0.6 0 0.1
              0 0 0 1 0
            " result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <style dangerouslySetInnerHTML={{__html: `
          @keyframes crawlerSway {
            0% { transform: translateX(-2.5px) rotate(-5deg) scaleX(0.95); }
            100% { transform: translateX(2.5px) rotate(5deg) scaleX(1.05); }
          }
          @keyframes crawlerWrithing {
            0%, 100% { transform: scaleY(1); }
            50% { transform: scaleY(1.15); }
          }
          @keyframes redFlash {
            0%, 100% { fill: none; }
            50% { fill: rgba(200, 67, 47, 0.95); filter: brightness(1.5); }
          }
          .crawler-group {
            transform-origin: 20px 20px;
            animation: crawlerSway ${isMoving ? '0.6s' : '1.2s'} ease-in-out infinite alternate;
          }
          .crawler-segments {
            animation: crawlerWrithing 0.8s ease-in-out infinite;
          }
          .hit-overlay {
            animation: ${isHit ? 'redFlash 0.12s linear' : 'none'};
          }
        `}} />

        <g filter="url(#crawler-glow)" className="crawler-group">
          {/* Parasitic wriggling tendrils/legs */}
          <path d="M12,25 C8,22 6,18 7,13" fill="none" stroke={outlineColor} strokeWidth="1.8" strokeLinecap="round" />
          <path d="M28,25 C32,22 34,18 33,13" fill="none" stroke={outlineColor} strokeWidth="1.8" strokeLinecap="round" />
          
          <path d="M14,28 C10,28 7,25 6,21" fill="none" stroke={outlineColor} strokeWidth="1.5" strokeLinecap="round" />
          <path d="M26,28 C30,28 33,25 34,21" fill="none" stroke={outlineColor} strokeWidth="1.5" strokeLinecap="round" />
          
          <path d="M15,31 C11,34 9,30 8,27" fill="none" stroke={outlineColor} strokeWidth="1.2" strokeLinecap="round" />
          <path d="M25,31 C29,34 31,30 32,27" fill="none" stroke={outlineColor} strokeWidth="1.2" strokeLinecap="round" />

          {/* Segmented body - parasite/leech shape */}
          <g className="crawler-segments">
            {/* Rear segment */}
            <ellipse cx="20" cy="28" rx="6" ry="4" fill={bodyColor} stroke={outlineColor} strokeWidth="1" />
            
            {/* Middle segment */}
            <ellipse cx="20" cy="23" rx="9.5" ry="6.5" fill={segmentColor} stroke={outlineColor} strokeWidth="1.2" />
            
            {/* Main Head segment */}
            <ellipse cx="20" cy="17" rx="10.5" ry="8" fill={bodyColor} stroke={outlineColor} strokeWidth="1.6" />
          </g>

          {/* Sucking parasite mouth (nested circles) */}
          <ellipse cx="20" cy="14" rx="4.5" ry="3" fill="#111" stroke={segmentColor} strokeWidth="1" />
          {/* Glowing mouth core */}
          <circle cx="20" cy="14" r="1.5" fill={glowColor} />

          {/* Slanted, angry glowing parasite eyes */}
          <polygon points="12,17 15,16 16,18 13,19" fill="#C9A84C" />
          <polygon points="28,17 25,16 24,18 27,19" fill="#C9A84C" />
          
          {/* Eyebrow shadow ridges */}
          <path d="M11,15 Q14,14 17,16" fill="none" stroke="#111" strokeWidth="1" />
          <path d="M29,15 Q26,14 23,16" fill="none" stroke="#111" strokeWidth="1" />

          {/* Hit overlay */}
          <ellipse cx="20" cy="20" rx="11" ry="9" className="hit-overlay" />
        </g>
      </svg>
    </div>
  );
}
