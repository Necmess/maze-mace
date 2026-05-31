interface PortalSpriteProps {
  x: number;
  y: number;
}

export default function PortalSprite({ x, y }: PortalSpriteProps) {
  return (
    <div
      style={{
        position: 'absolute',
        left: x - 35, // Centered at x (70x70 container)
        top: y - 35,  // Centered at y
        width: 70,
        height: 70,
        pointerEvents: 'none',
        zIndex: 8
      }}
    >
      <svg width="70" height="70" viewBox="0 0 70 70" xmlns="http://www.w3.org/2000/svg">
        <defs>
          {/* Intense Blue Void Glow Filter */}
          <filter id="void-glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="3.5" result="blur" />
            <feColorMatrix type="matrix" values="
              0.2 0 0 0 0.1
              0 0.5 0 0 0.4
              0 0 1 0 0.8
              0 0 0 1.5 0
            " result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Spiral Vortex Gradient */}
          <radialGradient id="vortex-grad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="25%" stopColor="#A5C8E4" />
            <stop offset="60%" stopColor="#4A88C5" />
            <stop offset="85%" stopColor="#1A2E5C" stopOpacity="0.8" />
            <stop offset="100%" stopColor="transparent" stopOpacity="0" />
          </radialGradient>
        </defs>

        <style dangerouslySetInnerHTML={{__html: `
          @keyframes spinVortex {
            0% { transform: rotate(0deg) scale(1); }
            50% { transform: rotate(180deg) scale(1.05); }
            100% { transform: rotate(360deg) scale(1); }
          }
          @keyframes archFloat {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-3px); }
          }
          @keyframes glowPulse {
            0%, 100% { opacity: 0.75; }
            50% { opacity: 1.0; }
          }
          .portal-vortex {
            transform-origin: 35px 35px;
            animation: spinVortex 4s linear infinite;
          }
          .portal-arches {
            transform-origin: 35px 35px;
            animation: archFloat 3s ease-in-out infinite;
          }
          .glow-aura {
            animation: glowPulse 2s ease-in-out infinite;
          }
        `}} />

        {/* Void Blue Aura */}
        <circle cx="35" cy="35" r="22" fill="#4A88C5" opacity="0.35" className="glow-aura" filter="url(#void-glow)" />

        {/* Dynamic Spinning Vortex Spiral */}
        <circle cx="35" cy="35" r="20" fill="url(#vortex-grad)" className="portal-vortex" filter="url(#void-glow)" />
        
        {/* Swirling Ember Dots */}
        <g className="portal-vortex">
          <circle cx="20" cy="25" r="1.5" fill="#EAF5FF" />
          <circle cx="50" cy="45" r="1.2" fill="#EAF5FF" />
          <circle cx="42" cy="20" r="1" fill="#FFFFFF" />
          <circle cx="28" cy="50" r="1" fill="#FFFFFF" />
        </g>

        {/* Stone Arch Structures surrounding the Void Portal */}
        <g className="portal-arches" stroke="#1A1A2E" strokeWidth="1.5">
          {/* Segmented Ring (Stone blocks) */}
          <circle cx="35" cy="35" r="22.5" fill="none" stroke="#5A6E7F" strokeWidth="2.5" strokeDasharray="14 4" />
          
          {/* Rune Markings on Stone Arches (Glowing blue dots) */}
          <circle cx="24" cy="17" r="1" fill="#88D8FF" stroke="none" />
          <circle cx="46" cy="17" r="1" fill="#88D8FF" stroke="none" />
          <circle cx="17" cy="35" r="1" fill="#88D8FF" stroke="none" />
          <circle cx="53" cy="35" r="1" fill="#88D8FF" stroke="none" />
          <circle cx="24" cy="53" r="1" fill="#88D8FF" stroke="none" />
          <circle cx="46" cy="53" r="1" fill="#88D8FF" stroke="none" />
        </g>

        {/* Outer Stone Pillar Anchors */}
        <g fill="#3A4A5A" stroke="#1A1A2E" strokeWidth="1">
          {/* Top arch keystone */}
          <polygon points="32,7 38,7 39,12 31,12" />
          {/* Left support stone */}
          <polygon points="8,32 13,31 13,39 8,38" />
          {/* Right support stone */}
          <polygon points="62,32 57,31 57,39 62,38" />
        </g>
      </svg>
    </div>
  );
}
