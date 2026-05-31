import { getPredictedRoomType } from '../domain/rooms';
import { getDailyRoomType } from '../config/dailyChallenge';
import type { RoomNode } from '../types/game';

interface MiniMapProps {
  rooms: RoomNode[];
  currentRoom: { x: number; y: number };
  isCartographer: boolean;
  currentStage: number;
  onExpandClick?: () => void;
  isDailyChallenge?: boolean;
  dailySeed?: number;
}


export default function MiniMap({ 
  rooms, 
  currentRoom, 
  isCartographer, 
  currentStage, 
  onExpandClick,
  isDailyChallenge,
  dailySeed
}: MiniMapProps) {

  // We want to show a 5x5 view focused on the current room coordinates
  const viewSize = 5;
  const halfView = Math.floor(viewSize / 2);
  const gridCells = [];
  const lastDiscoveredRoom = rooms[rooms.length - 1] ?? null;

  for (let dy = -halfView; dy <= halfView; dy++) {
    for (let dx = -halfView; dx <= halfView; dx++) {
      const gx = currentRoom.x + dx;
      const gy = currentRoom.y + dy;
      
      const room = rooms.find(r => r.x === gx && r.y === gy);
      const isAdjacent = Math.abs(dx) + Math.abs(dy) === 1;
      
      gridCells.push({
        gx,
        gy,
        dx,
        dy,
        room,
        isAdjacent
      });
    }
  }

  // Type styling helper
  const getRoomStyle = (r: RoomNode, isCurrent: boolean) => {
    let base = 'w-5 h-5 rounded border flex items-center justify-center text-[9px] transition-all duration-300 ';

    // Add cell flash effect if it is the newly added room
    const isNewFlash = lastDiscoveredRoom && lastDiscoveredRoom.x === r.x && lastDiscoveredRoom.y === r.y;
    if (isNewFlash) {
      base += 'animate-cell-flash ';
    }

    if (isCurrent) {
      base += 'bg-[#FFA500] border-[#FFFFFF] text-maze-bg font-black animate-map-pulse shadow-[0_0_12px_#FFA500] ';
    } else if (!r.explored) {
      base += 'bg-slate-950 border-slate-900 text-transparent opacity-20 ';
    } else {
      base += 'text-maze-cream ';
      if (r.type === 'START') {
        base += 'bg-slate-800 border-slate-400 text-slate-200 ';
      } else if (r.type === 'COMBAT') {
        base += 'bg-red-950/45 border-red-500 text-red-400 font-bold shadow-[0_0_4px_rgba(239,68,68,0.2)] ';
      } else if (r.type === 'REWARD') {
        base += 'bg-amber-950/45 border-amber-500 text-amber-400 font-bold shadow-[0_0_4px_rgba(245,158,11,0.2)] ';
      } else if (r.type === 'HAZARD') {
        base += 'bg-purple-950/45 border-purple-500 text-purple-400 font-bold shadow-[0_0_4px_rgba(168,85,247,0.2)] ';
      } else if (r.type === 'RECOVERY') {
        base += 'bg-blue-950/45 border-blue-500 text-blue-400 font-bold shadow-[0_0_4px_rgba(59,130,246,0.2)] ';
      } else if (r.type === 'BOSS') {
        base += 'bg-red-900 border-maze-accent text-maze-accent font-black animate-pulse shadow-[0_0_8px_rgba(200,67,47,0.7)] ';
      }
    }
    return base;
  };

  return (
    <div className="w-full bg-maze-dark/80 border border-slate-800 rounded-lg p-3 flex flex-col items-center">
      <div className="flex justify-between items-center w-full mb-2">
        <span className="text-[10px] font-cinzel font-bold text-maze-silver tracking-widest">MINI MAP - STAGE {currentStage}</span>
        <button 
          onClick={onExpandClick}
          className="text-[8px] font-outfit text-maze-gold hover:text-maze-cream border border-maze-gold/30 hover:border-maze-gold/75 px-1.5 py-0.5 rounded transition-all bg-slate-900/60"
        >
          🔍 FULL MAP
        </button>
      </div>

      {/* Grid container */}
      <div 
        onClick={onExpandClick}
        className="grid grid-cols-5 gap-2.5 p-2 bg-slate-950/60 rounded-md border border-slate-900 cursor-pointer hover:border-maze-gold/40 hover:bg-slate-950/80 transition-all duration-300 relative group"
        title="Click to view full map"
      >
        {gridCells.map((cell, idx) => {
          const isCurrent = cell.gx === currentRoom.x && cell.gy === currentRoom.y;
          
          return (
            <div
              key={idx}
              className="relative flex items-center justify-center w-6 h-6"
            >
              {cell.room ? (
                <div
                  className={getRoomStyle(cell.room, isCurrent)}
                  title={`Room: (${cell.gx}, ${cell.gy}) - ${cell.room.type}`}
                >
                  {isCurrent ? 'P' : cell.room.type === 'RECOVERY' ? '+' : cell.room.type === 'BOSS' ? '💀' : cell.room.type[0]}
                </div>
              ) : isCartographer && cell.isAdjacent ? (
                (() => {
                  const predType = isDailyChallenge && dailySeed !== undefined
                    ? getDailyRoomType(dailySeed, cell.gx, cell.gy)
                    : getPredictedRoomType(cell.gx, cell.gy);

                  let predClass = 'w-5 h-5 rounded border border-dashed flex items-center justify-center text-[8px] opacity-50 hover:opacity-90 transition-all duration-300 ';
                  
                  if (predType === 'COMBAT') predClass += 'border-red-500/50 text-red-400/70 bg-red-950/10';
                  else if (predType === 'REWARD') predClass += 'border-amber-500/50 text-amber-400/70 bg-amber-950/10';
                  else if (predType === 'HAZARD') predClass += 'border-purple-500/50 text-purple-400/70 bg-purple-950/10';
                  else if (predType === 'RECOVERY') predClass += 'border-blue-500/50 text-blue-400/70 bg-blue-950/10';
                  
                  return (
                    <div
                      className={predClass}
                      title={`Predicted: (${cell.gx}, ${cell.gy}) - ${predType}`}
                    >
                      {predType === 'RECOVERY' ? '+?' : `${predType[0]}?`}
                    </div>
                  );
                })()
              ) : (
                <div className="w-1.5 h-1.5 rounded-full bg-slate-900" />
              )}
            </div>
          );
        })}
      </div>

      {/* Map Legend */}
      <div className="grid grid-cols-3 gap-y-1.5 gap-x-2 w-full mt-3 border-t border-slate-900/80 pt-2 text-[8px] text-maze-silver font-outfit">
        <div className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded bg-slate-800 border border-slate-400 block" />
          <span>START</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded bg-red-950/40 border border-red-500 block" />
          <span>COMBAT</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded bg-amber-950/40 border border-amber-500 block" />
          <span>REWARD</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded bg-purple-950/40 border border-purple-500 block" />
          <span>HAZARD</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded bg-blue-950/40 border border-blue-500 block" />
          <span>RECOVERY</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded bg-[#FFA500] border border-[#FFFFFF] block animate-pulse" />
          <span className="text-[#FFA500] font-black">PLAYER</span>
        </div>
      </div>
    </div>
  );
}
