
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

// --- EAGLE LOGIC ---
export function getEagleInfo(x: number, z: number) {
    // We assume X and Z are already grid-snapped by the caller loop for efficiency
    if (z < 200) return { isEagle: false };

    const h = hash(x * 0.555, z * 0.333);
    
    // Reduced spawn rate: 4% (was 10%)
    if (h > 0.96) {
        // Height: 25m to 55m to cover high obstacles and clouds
        const randomHeight = 25 + (hash(z, x) * 30); 
        return { isEagle: true, x, y: randomHeight, z };
    }
    return { isEagle: false };
}

export type ObstacleType = 'tree_pine' | 'tree_oak' | 'tree_round' | 'rock' | 'log' | 'tall_tree' | 'tall_rock' | 'structure_cabin' | 'structure_car' | 'structure_plane' | 'structure_heli' | 'none';

export function getObstacleAt(x: number, z: number): ObstacleType {
  // No obstacles on bridge or in river
  if (getBridgeInfo(x, z).isBridge) return 'none';
  if (getRiverInfo(z).isRiver) return 'none';

  const gridX = Math.round(x / 4) * 4;
  const gridZ = Math.round(z / 8) * 8;

  if (Math.abs(x - gridX) > 1 || Math.abs(z - gridZ) > 1) return 'none';
  if (z < 150) return 'none';

  const h = hash(gridX, gridZ);
  const distFromCenter = Math.abs(gridX);

  if (h > 0.995) { 
      const subType = hash(gridZ, gridX); 
      if (subType > 0.85) return 'structure_heli';
      if (subType > 0.70) return 'structure_plane';
      if (subType > 0.55) return 'structure_car';
      if (subType > 0.40) return 'structure_cabin';
      if (subType > 0.20) return 'tall_rock';
      return 'tall_tree';
  }

  if (distFromCenter < 12) {
    if (h > 0.96) return 'rock';
    if (h > 0.92 && h <= 0.96) return 'log';
    return 'none';
  }

  if (h > 0.65) {
     if (h > 0.90) return 'tree_pine';
     if (h > 0.78) return 'tree_oak';
     return 'tree_round';
  }
  if (h > 0.60) return 'rock';
  
  return 'none';
}

export type AnimalType = 'bear' | 'rabbit' | 'squirrel' | 'lamb' | 'chicken' | 'duck' | 'fox' | 'deer' | 'hedgehog' | 'pig' | 'cat' | 'none';

export function getAnimalAt(x: number, z: number): AnimalType {
  // No animals on bridge or in river
  if (getBridgeInfo(x, z).isBridge) return 'none';
  if (getRiverInfo(z).isRiver) return 'none';

  const gridX = Math.round(x / 8) * 8; 
  const gridZ = Math.round(z / 15) * 15;

  if (Math.abs(x - gridX) > 2 || Math.abs(z - gridZ) > 2) return 'none';
  if (z < 150) return 'none';
  if (Math.abs(gridX) > 15) return 'none';

  const h = hash(gridX + 500, gridZ + 500);
  
  if (h > 0.98) return 'bear';
  if (h > 0.96) return 'deer';
  if (h > 0.94) return 'fox';
  if (h > 0.92) return 'pig'; 
  if (h > 0.90) return 'lamb';
  if (h > 0.88) return 'cat'; 
  if (h > 0.86) return 'duck';
  if (h > 0.84) return 'chicken';
  if (h > 0.81) return 'hedgehog'; 
  if (h > 0.77) return 'squirrel';
  if (h > 0.70) return 'rabbit'; 

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