
import { WORLD_CONFIG } from '../types';

// Simple pseudo-random hash for deterministic procedural generation
export function hash(x: number, z: number) {
  let h = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453123;
  return h - Math.floor(h);
}

// --- ISLAND STRAIT LOGIC ---
// 섬 해협 구간 (원본 강 구간 대체)
const STRAIT_FREQUENCY = 450; // 해협 간격 (원본 RIVER_FREQUENCY와 동일)
const STRAIT_WIDTH = 14;      // 해협 폭

export function getRiverInfo(z: number) {
  if (z < 200) return { isRiver: false, bedDepth: 0, centerZ: 0 };

  const localZ = z % STRAIT_FREQUENCY;
  const center = STRAIT_FREQUENCY / 2;
  const dist = Math.abs(localZ - center);

  if (dist < STRAIT_WIDTH) {
    const t = dist / STRAIT_WIDTH;
    const depth = (Math.cos(t * Math.PI / 2)) * 3.5;
    return { isRiver: true, bedDepth: depth, centerZ: Math.floor(z / STRAIT_FREQUENCY) * STRAIT_FREQUENCY + center };
  }

  return { isRiver: false, bedDepth: 0, centerZ: 0 };
}

// Internal helper for base terrain noise (without river carving)
export function calculateBaseTerrain(x: number, z: number): number {
  const { TERRAIN_SCALE, TERRAIN_HEIGHT } = WORLD_CONFIG;
  
  const y1 = Math.sin(x * TERRAIN_SCALE * 0.5) * Math.cos(z * TERRAIN_SCALE * 0.5);
  const y2 = Math.sin(z * TERRAIN_SCALE * 0.2 + x * TERRAIN_SCALE * 0.2) * 2;
  const y3 = Math.cos(x * TERRAIN_SCALE) * 0.5;
  
  const y4 = Math.sin(x * TERRAIN_SCALE * 3.0) * Math.cos(z * TERRAIN_SCALE * 3.0) * 0.1;
  const y5 = Math.sin(x * TERRAIN_SCALE * 10.0) * Math.cos(z * TERRAIN_SCALE * 10.0) * 0.05; 
  
  return (y1 + y2 + y3 + y4 + y5) * (TERRAIN_HEIGHT / 2.5);
}

// --- STRAIT PASSAGE (BUOY) LOGIC ---
// 해협 안전 통로의 X 위치 (원본 getBridgeX와 동일 로직)
export function getBridgeX(riverCenterZ: number) {
  const h = hash(riverCenterZ, 999);
  return (h - 0.5) * 20;
}

const PASSAGE_LENGTH = 24;
const PASSAGE_WIDTH = 8; // 원본 BRIDGE_WIDTH 6 → 8로 약간 넓게

export function getBridgeInfo(x: number, z: number) {
  const center = Math.floor(z / STRAIT_FREQUENCY) * STRAIT_FREQUENCY + (STRAIT_FREQUENCY / 2);
  const dist = z - center;

  const passageX = getBridgeX(center);

  if (Math.abs(dist) < PASSAGE_LENGTH / 2 && Math.abs(x - passageX) < PASSAGE_WIDTH / 2) {
    const baseHeight = calculateBaseTerrain(passageX, center - 12);
    const halfL = PASSAGE_LENGTH / 2;
    const normDist = dist / halfL;
    const archY = 1.5 * (1 - normDist * normDist); // 원본 3.5 → 1.5
    return { isBridge: true, height: baseHeight + archY + 0.2 };
  }
  return { isBridge: false, height: -Infinity };
}

// Composed noise function for rolling hills (Deterministic)
export function getTerrainHeight(x: number, z: number): number {
  let h = calculateBaseTerrain(x, z);
  
  // --- STRAIT CARVING ---
  const river = getRiverInfo(z);
  if (river.isRiver) {
      h -= river.bedDepth;
  }
  
  // Flatten the "start" area
  let flattenFactor = 1.0;
  const TRANSITION_END = 60; 
  
  if (z < TRANSITION_END) {
     if (z < 0) {
         flattenFactor = 0.2;
     } else {
         const t = z / TRANSITION_END;
         const smoothT = t * t * (3 - 2 * t);
         flattenFactor = 0.2 + (0.8 * smoothT);
     }
  }

  h *= flattenFactor;

  return h;
}

// --- CLOUD LOGIC ---
const CLOUD_STEP_X = 20;
const CLOUD_STEP_Z = 15;

export function getCloudInfo(x: number, z: number) {
  const gridX = Math.round(x / CLOUD_STEP_X) * CLOUD_STEP_X;
  const gridZ = Math.round(z / CLOUD_STEP_Z) * CLOUD_STEP_Z;

  const h = hash(gridX * 0.123, gridZ * 0.123);
  
  // Reduced probability to spawn fewer clouds (from 0.85 to 0.92)
  if (h > 0.92) {
      const cloudY = 35 + (hash(gridZ, gridX) * 20); 
      const scale = 1.5 + hash(gridX, gridZ) * 1.5;  
      const radius = 2.5 * scale; 
      
      return { isCloud: true, x: gridX, y: cloudY, z: gridZ, scale, radius };
  }

  return { isCloud: false, x: gridX, y: 0, z: gridZ, scale: 0, radius: 0 };
}

// --- SHARK FIN LOGIC (replaces eagle) ---
export function getEagleInfo(x: number, z: number) {
  if (z < 300) return { isEagle: false, x: 0, y: 0, z: 0 };

  const h = hash(x * 5.1, z * 2.9);
  if (h > 0.985) {
    const offsetX = (hash(x, z * 2) - 0.5) * WORLD_CONFIG.LANE_WIDTH * 1.5;
    const offsetZ = (hash(z, x * 3) - 0.5) * 20;
    return {
      isEagle: true,
      x: x + offsetX,
      y: 0.5, // 수면 위 (원본은 20~40 높이)
      z: z + offsetZ
    };
  }
  return { isEagle: false, x: 0, y: 0, z: 0 };
}

export type ObstacleType = 'coral' | 'reef' | 'debris' | 'rock' | 'driftwood' | 'tall_rock' | 'tall_coral' | 'structure_lighthouse' | 'structure_shipwreck' | 'structure_fort' | 'none';

export function getObstacleAt(x: number, z: number): string {
  if (z < 150) return 'none';
  const h = hash(x, z);
  if (h > 0.9995) return 'structure_lighthouse';
  if (h > 0.9990) return 'structure_shipwreck';
  if (h > 0.9985) return 'structure_fort';
  if (h > 0.998)  return 'tall_rock';
  if (h > 0.9975) return 'tall_coral';
  if (h > 0.993)  return 'coral';
  if (h > 0.988)  return 'reef';
  if (h > 0.984)  return 'debris';
  if (h > 0.981)  return 'rock';
  if (h > 0.978)  return 'driftwood';
  return 'none';
}

export type AnimalType =
  | 'none'
  | 'dolphin'
  | 'seagull'
  | 'turtle'
  | 'pufferfish'
  | 'stingray'
  | 'crab'
  | 'seal'
  | 'penguin'
  | 'fish';

export function getAnimalAt(x: number, z: number): AnimalType {
  if (z < 200) return 'none';
  const h = hash(x * 7.3, z * 3.7);
  if (h > 0.993) return 'dolphin';
  if (h > 0.986) return 'seagull';
  if (h > 0.979) return 'turtle';
  if (h > 0.972) return 'pufferfish';
  if (h > 0.965) return 'stingray';
  if (h > 0.958) return 'crab';
  if (h > 0.951) return 'seal';
  if (h > 0.944) return 'penguin';
  if (h > 0.937) return 'fish';
  return 'none';
}

export function getCoinInfo(x: number, z: number) {
  if (z < 150) return { isCoin: false };
  
  // Allow coins on bridge
  const isBridge = getBridgeInfo(x, z).isBridge;
  if (getRiverInfo(z).isRiver && !isBridge) return { isCoin: false };

  const gridX = Math.round(x / 4) * 4;
  const gridZ = Math.round(z / 4) * 4;

  if (Math.abs(x - gridX) > 1 || Math.abs(z - gridZ) > 1) return { isCoin: false };

  if (getObstacleAt(gridX, gridZ) !== 'none') return { isCoin: false };
  if (getAnimalAt(gridX, gridZ) !== 'none') return { isCoin: false };

  const h = hash(gridX * 0.987, gridZ * 0.654);
  
  if (h > 0.95) {
      return { isCoin: true, x: gridX, z: gridZ };
  }

  return { isCoin: false };
}