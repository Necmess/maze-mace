import type { RoomType } from '../types/game';

export type ExpandDirection = 'N' | 'S' | 'E' | 'W';

export function getRoomTarget(
  currentRoom: { x: number; y: number },
  direction: ExpandDirection
): { x: number; y: number } {
  if (direction === 'N') return { x: currentRoom.x, y: currentRoom.y - 1 };
  if (direction === 'S') return { x: currentRoom.x, y: currentRoom.y + 1 };
  if (direction === 'E') return { x: currentRoom.x + 1, y: currentRoom.y };
  return { x: currentRoom.x - 1, y: currentRoom.y };
}

export function shouldSpawnBossRoom(currentStage: number, stageRoomsCount: number): boolean {
  return (
    (currentStage === 1 && stageRoomsCount === 5) ||
    (currentStage === 2 && stageRoomsCount === 5) ||
    (currentStage === 3 && stageRoomsCount === 5)
  );
}

export function getNextRoomType(currentStage: number, stageRoomsCount: number, x: number, y: number): Exclude<RoomType, 'START'> {
  return shouldSpawnBossRoom(currentStage, stageRoomsCount) ? 'BOSS' : getPredictedRoomType(x, y);
}

export function getPredictedRoomType(x: number, y: number): Exclude<RoomType, 'START' | 'BOSS'> {
  const seed = Math.abs(Math.sin(x * 12.9898 + y * 78.233) * 43758.5453);
  const types: Exclude<RoomType, 'START' | 'BOSS'>[] = ['COMBAT', 'COMBAT', 'REWARD', 'HAZARD', 'RECOVERY'];
  return types[Math.floor(seed % types.length)];
}
