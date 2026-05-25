
import React, { useMemo, useRef, useLayoutEffect, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { InstancedMesh, Object3D, Color, MeshStandardMaterial, CylinderGeometry, SphereGeometry, Vector3, Group, Mesh, MathUtils, MeshLambertMaterial, PlaneGeometry, BufferAttribute, DoubleSide, DodecahedronGeometry, ConeGeometry, CapsuleGeometry, BoxGeometry } from 'three';
import { getTerrainHeight, getObstacleAt, hash, getAnimalAt, AnimalType, getRiverInfo, getCloudInfo, getCoinInfo, getBridgeInfo, calculateBaseTerrain, getBridgeX, getEagleInfo } from '../services/mathService';
import { WORLD_CONFIG } from '../types';
import { useGameStore } from '../store';
import { audioService } from '../services/audioService';

const tempObject = new Object3D();
const tempColor = new Color();

// --- FOAM COLORS (Ocean Foam Palette) ---
const FOAM_COLORS = [
  "#e0f2fe", "#bae6fd", "#7dd3fc", "#ffffff",
  "#f0f9ff", "#dbeafe", "#eff6ff", "#cffafe"
];

// --- MATERIALS ---
const FlowerMaterial = new MeshLambertMaterial({
  color: "#e0f2fe",
  emissive: "#166534",
  emissiveIntensity: 0.3,
  vertexColors: true,
  transparent: true,
  opacity: 0.8,
  toneMapped: false,
});

const setupFlowerShader = (shader: any) => {
  shader.uniforms.uTime = { value: 0 };
  shader.vertexShader = `
    uniform float uTime;
    ${shader.vertexShader}
  `;
  shader.vertexShader = shader.vertexShader.replace(
    '#include <begin_vertex>',
    `
    #include <begin_vertex>
    float sway = sin(uTime * 3.0 + (instanceMatrix[3][0] * 0.5) + (instanceMatrix[3][2] * 0.5)) * 0.15;
    float strength = smoothstep(0.0, 1.0, position.y * 3.0); 
    transformed.x += sway * strength;
    `
  );
  FlowerMaterial.userData.shader = shader;
};
FlowerMaterial.onBeforeCompile = setupFlowerShader;

const CloudMaterial = new MeshStandardMaterial({
    color: "#ffffff",
    transparent: true,
    opacity: 0.75,
    roughness: 0.1,
    flatShading: true,
    depthWrite: false
});

// --- COMPONENTS ---

// --- SEA OBSTACLE COMPONENTS ---

// 산호초
const Coral: React.FC<{ x: number, y: number, z: number }> = ({ x, y, z }) => {
  const h = hash(x, z);
  return (
    <group position={[x, y, z]}>
      <mesh position={[0, 0.8, 0]} castShadow>
        <cylinderGeometry args={[0.15, 0.3, 1.6, 6]} />
        <meshStandardMaterial color="#f97316" roughness={0.8} />
      </mesh>
      <mesh position={[0.4, 1.2, 0.2]} castShadow>
        <cylinderGeometry args={[0.1, 0.2, 1.2, 6]} />
        <meshStandardMaterial color="#ec4899" roughness={0.8} />
      </mesh>
      <mesh position={[-0.3, 1.0, -0.3]} castShadow>
        <cylinderGeometry args={[0.12, 0.22, 1.0, 6]} />
        <meshStandardMaterial color="#f97316" roughness={0.8} />
      </mesh>
      <mesh position={[0, 1.9, 0]} castShadow>
        <dodecahedronGeometry args={[0.4, 0]} />
        <meshStandardMaterial color="#fb923c" flatShading />
      </mesh>
    </group>
  );
};

// 암초
const Reef: React.FC<{ x: number, y: number, z: number }> = ({ x, y, z }) => {
  const h = hash(x, z);
  return (
    <group position={[x, y, z]}>
      <mesh position={[0, 0.6, 0]} castShadow receiveShadow>
        <dodecahedronGeometry args={[1.2 + h * 0.4, 0]} />
        <meshStandardMaterial color="#44403c" flatShading roughness={0.9} />
      </mesh>
      <mesh position={[0.8, 0.3, 0.5]} castShadow>
        <dodecahedronGeometry args={[0.7, 0]} />
        <meshStandardMaterial color="#57534e" flatShading roughness={0.9} />
      </mesh>
      <mesh position={[-0.6, 0.2, -0.4]} castShadow>
        <dodecahedronGeometry args={[0.5, 0]} />
        <meshStandardMaterial color="#44403c" flatShading roughness={0.9} />
      </mesh>
    </group>
  );
};

// 난파선
const Shipwreck: React.FC<{ x: number, y: number, z: number, rotation: number }> = ({ x, y, z, rotation }) => {
  return (
    <group position={[x, y, z]} rotation={[0.2, rotation, 0.35]}>
      <mesh position={[0, 1.5, 0]} castShadow>
        <boxGeometry args={[3.5, 2.0, 8.0]} />
        <meshStandardMaterial color="#78350f" roughness={0.9} />
      </mesh>
      <mesh position={[0.5, 3.5, -1]} rotation={[0, 0, 0.7]} castShadow>
        <cylinderGeometry args={[0.15, 0.2, 5, 8]} />
        <meshStandardMaterial color="#422006" roughness={0.9} />
      </mesh>
      <mesh position={[1.5, 5, -0.5]} rotation={[0.2, 0, 0.7]} castShadow>
        <boxGeometry args={[1.5, 2.0, 0.05]} />
        <meshStandardMaterial color="#d1d5db" roughness={0.5} side={DoubleSide} />
      </mesh>
      <mesh position={[0, 2.6, 1.5]} castShadow>
        <boxGeometry args={[3.2, 0.3, 4.5]} />
        <meshStandardMaterial color="#92400e" roughness={0.9} />
      </mesh>
    </group>
  );
};

// 등대
const Lighthouse: React.FC<{ x: number, y: number, z: number }> = ({ x, y, z }) => {
  return (
    <group position={[x, y, z]}>
      <mesh position={[0, 5, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[1.0, 1.4, 10, 10]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.4} />
      </mesh>
      <mesh position={[0, 3, 0]} castShadow>
        <cylinderGeometry args={[1.05, 1.35, 1.5, 10]} />
        <meshStandardMaterial color="#dc2626" roughness={0.4} />
      </mesh>
      <mesh position={[0, 7, 0]} castShadow>
        <cylinderGeometry args={[1.02, 1.12, 1.5, 10]} />
        <meshStandardMaterial color="#dc2626" roughness={0.4} />
      </mesh>
      <mesh position={[0, 10.5, 0]} castShadow>
        <cylinderGeometry args={[1.2, 1.0, 1.0, 10]} />
        <meshStandardMaterial color="#374151" roughness={0.5} />
      </mesh>
      <mesh position={[0, 11.2, 0]} castShadow>
        <sphereGeometry args={[0.7, 10, 10]} />
        <meshStandardMaterial color="#fef08a" emissive="#fef08a" emissiveIntensity={1.5} roughness={0.1} />
      </mesh>
      <mesh position={[0, 12, 0]} castShadow>
        <coneGeometry args={[1.3, 1.5, 10]} />
        <meshStandardMaterial color="#374151" roughness={0.6} />
      </mesh>
    </group>
  );
};

// 해적 요새
const PirateFort: React.FC<{ x: number, y: number, z: number }> = ({ x, y, z }) => {
  return (
    <group position={[x, y, z]}>
      <mesh position={[0, 3, 0]} castShadow receiveShadow>
        <boxGeometry args={[6, 6, 6]} />
        <meshStandardMaterial color="#57534e" roughness={0.9} flatShading />
      </mesh>
      {([-2, -0.7, 0.7, 2] as number[]).map((bx, i) => (
        <mesh key={i} position={[bx, 6.5, 3.1]} castShadow>
          <boxGeometry args={[0.8, 1.0, 0.4]} />
          <meshStandardMaterial color="#44403c" roughness={0.9} />
        </mesh>
      ))}
      {([-2, -0.7, 0.7, 2] as number[]).map((bx, i) => (
        <mesh key={`b-${i}`} position={[bx, 6.5, -3.1]} castShadow>
          <boxGeometry args={[0.8, 1.0, 0.4]} />
          <meshStandardMaterial color="#44403c" roughness={0.9} />
        </mesh>
      ))}
      <mesh position={[3, 5, 3]} castShadow>
        <cylinderGeometry args={[1.0, 1.2, 8, 8]} />
        <meshStandardMaterial color="#44403c" roughness={0.9} flatShading />
      </mesh>
      <mesh position={[3, 9.5, 3]} castShadow>
        <coneGeometry args={[1.2, 2, 8]} />
        <meshStandardMaterial color="#7c2d12" roughness={0.8} />
      </mesh>
    </group>
  );
};

const CloudObject: React.FC<{ x: number, y: number, z: number, scale: number }> = ({ x, y, z, scale }) => {
    return (
        <group position={[x, y, z]} scale={scale}>
            <mesh position={[0, 0, 0]} material={CloudMaterial}><dodecahedronGeometry args={[2.0, 0]} /></mesh>
            <mesh position={[1.5, -0.5, 0.5]} material={CloudMaterial}><dodecahedronGeometry args={[1.4, 0]} /></mesh>
            <mesh position={[-1.5, -0.2, -0.5]} material={CloudMaterial}><dodecahedronGeometry args={[1.5, 0]} /></mesh>
            <mesh position={[0.5, 1.0, -0.5]} material={CloudMaterial}><dodecahedronGeometry args={[1.2, 0]} /></mesh>
            <mesh position={[-0.5, 0.8, 0.8]} material={CloudMaterial}><dodecahedronGeometry args={[1.0, 0]} /></mesh>
        </group>
    )
}

const Coin: React.FC<{ x: number, y: number, z: number, isLarge?: boolean }> = React.memo(({ x, y, z, isLarge = false }) => {
    const groupRef = useRef<Group>(null);
    const [collected, setCollected] = useState(false);
    const addCoins = useGameStore(state => state.addCoins);
    
    useFrame((state, delta) => {
        if (!groupRef.current || collected) return;
        
        // Standard rotation
        groupRef.current.rotation.y += 0.03; 
        
        const player = state.scene.getObjectByName("PlayerGroup");
        if (player) {
            const isMagnetActive = useGameStore.getState().isMagnetActive; 
            
            const dx = player.position.x - groupRef.current.position.x;
            const dy = (player.position.y + 1.0) - groupRef.current.position.y; 
            const dz = player.position.z - groupRef.current.position.z;
            const distSq = dx*dx + dy*dy + dz*dz;
            
            // Magnet Logic
            if (isMagnetActive && distSq < 400) { 
                const moveSpeed = 15 * delta; 
                groupRef.current.position.x += dx * moveSpeed;
                groupRef.current.position.y += dy * moveSpeed;
                groupRef.current.position.z += dz * moveSpeed;
            }

            // Collision Logic
            const threshold = isLarge ? 25.0 : 2.25;
            if (distSq < threshold) { 
                setCollected(true);
                groupRef.current.visible = false;
                addCoins(isLarge ? 10 : 1);
                audioService.playCoin();
            }
        }
    });

    if (collected) return null;
    const scale = isLarge ? 5.0 : 1.0;

    return (
        <group ref={groupRef} position={[x, y, z]} scale={scale}>
            <mesh rotation={[Math.PI/2, 0, 0]} castShadow>
                <cylinderGeometry args={[0.4, 0.4, 0.1, 32]} />
                <meshStandardMaterial color="#fbbf24" metalness={0.3} roughness={0.3} emissive="#d97706" emissiveIntensity={0.6} />
            </mesh>
            <mesh rotation={[Math.PI/2, 0, 0]} position={[0, 0, 0]}>
                 <cylinderGeometry args={[0.3, 0.3, 0.12, 32]} />
                 <meshStandardMaterial color="#fcd34d" metalness={0.3} roughness={0.3} emissive="#f59e0b" emissiveIntensity={0.6} />
            </mesh>
        </group>
    );
});

// --- SHARK FIN COMPONENT ---
const SharkFin: React.FC<{ x: number, y: number, z: number }> = React.memo(({ x, y, z }) => {
  const groupRef = useRef<Group>(null);
  const [hit, setHit] = useState(false);

  const isAggressive = useMemo(() => hash(x, z) > 0.8, [x, z]);

  const removeCoins = useGameStore(state => state.removeCoins);
  const triggerKnockback = useGameStore(state => state.triggerKnockback);

  useFrame((state, delta) => {
    if (!groupRef.current || hit) return;
    const time = state.clock.getElapsedTime();

    groupRef.current.rotation.y = Math.sin(time * 3) * 0.2;

    const player = state.scene.getObjectByName("PlayerGroup");
    if (player) {
      const pPos = player.position;
      const ePos = groupRef.current.position;

      const dx = pPos.x - ePos.x;
      const dz = pPos.z - ePos.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (dz > -20 && dz < 200) {
        if (dist > 0) {
          const speed = (isAggressive ? 90 : 22) * delta;
          ePos.x += (dx / dist) * speed;
          ePos.z += (dz / dist) * speed;
          ePos.y = getTerrainHeight(ePos.x, ePos.z) + 0.6;
        }

        if (dist < 2.5) {
          setHit(true);
          groupRef.current.visible = false;
          audioService.playEagle();

          const loss = Math.floor(Math.random() * 5) + 1;
          removeCoins(loss);
          triggerKnockback(-15);
        }
      }
    }
  });

  if (hit) return null;

  return (
    <group ref={groupRef} position={[x, y, z]}>
      {/* 등지느러미 */}
      <mesh castShadow>
        <coneGeometry args={[0.4, 1.8, 4]} />
        <meshStandardMaterial color="#374151" flatShading roughness={0.5} />
      </mesh>
      {/* 지느러미 기부 */}
      <mesh position={[0, -0.5, 0]} scale={[1.5, 0.3, 2.5]}>
        <boxGeometry args={[0.6, 0.3, 1.2]} />
        <meshStandardMaterial color="#1e293b" roughness={0.6} />
      </mesh>
    </group>
  );
});

const TallRock: React.FC<{ x: number, y: number, z: number }> = ({ x, y, z }) => {
    return (
        <group position={[x, y, z]}>
             <mesh position={[0, 4, 0]} castShadow receiveShadow><dodecahedronGeometry args={[3.5, 0]} /><meshStandardMaterial color="#57534e" flatShading /></mesh>
             <mesh position={[0, 8, 0]} castShadow receiveShadow rotation={[0, 1, 0]}><dodecahedronGeometry args={[2.5, 0]} /><meshStandardMaterial color="#57534e" flatShading /></mesh>
             <mesh position={[0.5, 11, -0.5]} castShadow receiveShadow rotation={[1, 0, 0.5]}><coneGeometry args={[1.5, 5, 5]} /><meshStandardMaterial color="#57534e" flatShading /></mesh>
             <mesh position={[2.5, 1, 0]} castShadow><dodecahedronGeometry args={[1.5, 0]} /><meshStandardMaterial color="#44403c" flatShading /></mesh>
             <mesh position={[-2.0, 1.5, 1.5]} castShadow><dodecahedronGeometry args={[1.2, 0]} /><meshStandardMaterial color="#44403c" flatShading /></mesh>
             <mesh position={[0.5, 5.5, 2.8]}><dodecahedronGeometry args={[0.8, 0]} /><meshStandardMaterial color="#4a5d23" flatShading /></mesh>
             <mesh position={[-1, 9, 1]}><dodecahedronGeometry args={[0.6, 0]} /><meshStandardMaterial color="#4a5d23" flatShading /></mesh>
        </group>
    );
};

const IslandStrait: React.FC<{ z: number, x: number }> = React.memo(({ z, x }) => {
  const ISLAND_RADIUS_X = 11;
  const baseY = calculateBaseTerrain(x, z - 12);

  return (
    <group position={[0, baseY, z]}>
      {/* 왼쪽 섬 */}
      <group position={[-ISLAND_RADIUS_X - 5, 0, 0]}>
        <mesh castShadow receiveShadow>
          <sphereGeometry args={[ISLAND_RADIUS_X, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color="#15803d" roughness={1} flatShading />
        </mesh>
        {/* 야자수 1 */}
        <mesh position={[8, 5, 5]} castShadow>
          <cylinderGeometry args={[0.3, 0.5, 10, 7]} />
          <meshStandardMaterial color="#4a3728" roughness={0.9} />
        </mesh>
        <mesh position={[8, 10.5, 5]} castShadow>
          <sphereGeometry args={[4, 7, 5]} />
          <meshStandardMaterial color="#166534" flatShading />
        </mesh>
        {/* 야자수 2 */}
        <mesh position={[-5, 4, -4]} castShadow>
          <cylinderGeometry args={[0.25, 0.45, 8, 7]} />
          <meshStandardMaterial color="#4a3728" roughness={0.9} />
        </mesh>
        <mesh position={[-5, 8.5, -4]} castShadow>
          <sphereGeometry args={[3.5, 7, 5]} />
          <meshStandardMaterial color="#15803d" flatShading />
        </mesh>
      </group>

      {/* 오른쪽 섬 */}
      <group position={[ISLAND_RADIUS_X + 5, 0, 0]}>
        <mesh castShadow receiveShadow>
          <sphereGeometry args={[ISLAND_RADIUS_X, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color="#15803d" roughness={1} flatShading />
        </mesh>
        {/* 야자수 */}
        <mesh position={[-6, 4, 3]} castShadow>
          <cylinderGeometry args={[0.3, 0.5, 9, 7]} />
          <meshStandardMaterial color="#4a3728" roughness={0.9} />
        </mesh>
        <mesh position={[-6, 9, 3]} castShadow>
          <sphereGeometry args={[3.8, 7, 5]} />
          <meshStandardMaterial color="#166534" flatShading />
        </mesh>
      </group>

      {/* 부표 — 왼쪽(빨강) */}
      {([-10, -3, 3, 10] as number[]).map((dz, i) => (
        <group key={i} position={[x - 5, 0.8, dz]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.3, 0.3, 1.6, 8]} />
            <meshStandardMaterial color="#dc2626" />
          </mesh>
          <mesh position={[0, 1.2, 0]}>
            <sphereGeometry args={[0.4, 8, 8]} />
            <meshStandardMaterial color="#dc2626" emissive="#dc2626" emissiveIntensity={0.3} />
          </mesh>
          <mesh position={[0, -0.9, 0]}>
            <cylinderGeometry args={[0.05, 0.05, 1, 6]} />
            <meshStandardMaterial color="#374151" />
          </mesh>
        </group>
      ))}
      {/* 부표 — 오른쪽(초록) */}
      {([-10, -3, 3, 10] as number[]).map((dz, i) => (
        <group key={`r-${i}`} position={[x + 5, 0.8, dz]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.3, 0.3, 1.6, 8]} />
            <meshStandardMaterial color="#16a34a" />
          </mesh>
          <mesh position={[0, 1.2, 0]}>
            <sphereGeometry args={[0.4, 8, 8]} />
            <meshStandardMaterial color="#16a34a" emissive="#16a34a" emissiveIntensity={0.3} />
          </mesh>
        </group>
      ))}
    </group>
  );
});

const useWander = (x: number, z: number, speedMult: number = 1) => {
    const group = useRef<Group>(null);
    const { speed: wanderSpeed, radius, freq, phase } = useMemo(() => {
        const h = hash(x, z);
        return {
            speed: (0.5 + h * 0.5) * speedMult,
            radius: 2 + hash(z, x) * 2,
            freq: 0.5 + h * 0.5,
            phase: h * Math.PI * 2
        };
    }, [x, z, speedMult]);

    useFrame(({ clock }) => {
        if (!group.current) return;
        const t = clock.getElapsedTime();
        const dx = Math.sin(t * freq + phase) * radius;
        const dz = Math.cos(t * freq * 0.7 + phase) * (radius * 0.5);
        group.current.position.set(x + dx, 0, z + dz);
        const y = getTerrainHeight(group.current.position.x, group.current.position.z);
        group.current.position.y = y;
        
        const nextX = Math.sin((t + 0.1) * freq + phase) * radius;
        const nextZ = Math.cos((t + 0.1) * freq * 0.7 + phase) * (radius * 0.5);
        group.current.lookAt(x + nextX, y, z + nextZ);
    });
    return group;
};

const Dolphin: React.FC<{ x: number, y: number, z: number }> = ({ x, y, z }) => {
  const ref = useWander(x, z, 1.2);
  return (
    <group ref={ref}>
      <mesh castShadow position={[0, 0.3, 0]} scale={[1, 0.7, 2.0]}>
        <capsuleGeometry args={[0.35, 0.8, 4, 8]} />
        <meshStandardMaterial color="#0ea5e9" roughness={0.3} />
      </mesh>
      <mesh position={[0, 0.5, 0.9]}>
        <coneGeometry args={[0.12, 0.4, 8]} />
        <meshStandardMaterial color="#0284c7" />
      </mesh>
      <mesh position={[0, 0.7, 0.1]}>
        <boxGeometry args={[0.08, 0.5, 0.3]} />
        <meshStandardMaterial color="#0284c7" />
      </mesh>
    </group>
  );
};

const Seagull: React.FC<{ x: number, y: number, z: number }> = ({ x, y, z }) => {
  const ref = useWander(x, z + 5, 1.5);
  return (
    <group ref={ref} position={[0, 3, 0]}>
      <mesh castShadow>
        <sphereGeometry args={[0.25, 8, 8]} />
        <meshStandardMaterial color="#f8fafc" />
      </mesh>
      <mesh position={[0, 0.1, 0.3]}>
        <coneGeometry args={[0.06, 0.3, 6]} />
        <meshStandardMaterial color="#fbbf24" />
      </mesh>
      <mesh position={[-0.5, 0, 0]} rotation={[0, 0, 0.2]}>
        <boxGeometry args={[0.8, 0.05, 0.3]} />
        <meshStandardMaterial color="#e2e8f0" />
      </mesh>
      <mesh position={[0.5, 0, 0]} rotation={[0, 0, -0.2]}>
        <boxGeometry args={[0.8, 0.05, 0.3]} />
        <meshStandardMaterial color="#e2e8f0" />
      </mesh>
    </group>
  );
};

const Turtle: React.FC<{ x: number, y: number, z: number }> = ({ x, y, z }) => {
  const ref = useWander(x, z, 0.5);
  return (
    <group ref={ref}>
      <mesh castShadow position={[0, 0.2, 0]} scale={[1.2, 0.5, 1.5]}>
        <dodecahedronGeometry args={[0.5, 0]} />
        <meshStandardMaterial color="#15803d" flatShading />
      </mesh>
      <mesh position={[0, 0.2, 0.6]}>
        <sphereGeometry args={[0.2, 8, 8]} />
        <meshStandardMaterial color="#166534" />
      </mesh>
      {([[-0.5, 0, 0.3], [0.5, 0, 0.3], [-0.4, 0, -0.3], [0.4, 0, -0.3]] as [number,number,number][]).map(([lx, ly, lz], i) => (
        <mesh key={i} position={[lx, 0.05, lz]}>
          <boxGeometry args={[0.25, 0.1, 0.4]} />
          <meshStandardMaterial color="#15803d" />
        </mesh>
      ))}
    </group>
  );
};

const Pufferfish: React.FC<{ x: number, y: number, z: number }> = ({ x, y, z }) => {
  const ref = useWander(x, z, 0.7);
  return (
    <group ref={ref} position={[0, 0.5, 0]}>
      <mesh castShadow>
        <dodecahedronGeometry args={[0.45, 0]} />
        <meshStandardMaterial color="#fbbf24" flatShading />
      </mesh>
      <mesh position={[0, 0, 0.45]}>
        <sphereGeometry args={[0.12, 6, 6]} />
        <meshStandardMaterial color="#000" />
      </mesh>
    </group>
  );
};

const Fish: React.FC<{ x: number, y: number, z: number }> = ({ x, y, z }) => {
  const ref = useWander(x, z, 2.0);
  return (
    <group ref={ref} position={[0, 0.3, 0]}>
      <mesh castShadow scale={[0.8, 0.6, 1.5]}>
        <sphereGeometry args={[0.25, 8, 8]} />
        <meshStandardMaterial color="#60a5fa" roughness={0.3} />
      </mesh>
      <mesh position={[0, 0, -0.35]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.2, 0.3, 6]} />
        <meshStandardMaterial color="#3b82f6" />
      </mesh>
    </group>
  );
};

const Crab: React.FC<{ x: number, y: number, z: number }> = ({ x, y, z }) => {
  const ref = useWander(x, z, 0.6);
  return (
    <group ref={ref}>
      <mesh castShadow position={[0, 0.15, 0]} scale={[1.4, 0.6, 1]}>
        <boxGeometry args={[0.5, 0.3, 0.4]} />
        <meshStandardMaterial color="#dc2626" roughness={0.7} />
      </mesh>
      {([[-0.35, 0.1, 0.1], [0.35, 0.1, 0.1], [-0.35, 0.1, -0.1], [0.35, 0.1, -0.1]] as [number,number,number][]).map(([lx, ly, lz], i) => (
        <mesh key={i} position={[lx, ly, lz]} rotation={[0, 0, lx < 0 ? 0.5 : -0.5]}>
          <boxGeometry args={[0.4, 0.06, 0.06]} />
          <meshStandardMaterial color="#b91c1c" />
        </mesh>
      ))}
    </group>
  );
};

const Seal: React.FC<{ x: number, y: number, z: number }> = ({ x, y, z }) => {
  const ref = useWander(x, z, 0.8);
  return (
    <group ref={ref}>
      <mesh castShadow position={[0, 0.3, 0]} scale={[1, 0.8, 2]}>
        <capsuleGeometry args={[0.3, 0.5, 4, 8]} />
        <meshStandardMaterial color="#475569" roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.5, 0.7]}>
        <sphereGeometry args={[0.22, 8, 8]} />
        <meshStandardMaterial color="#475569" roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.5, 0.9]}>
        <sphereGeometry args={[0.08, 6, 6]} />
        <meshStandardMaterial color="#1e293b" />
      </mesh>
    </group>
  );
};

const Penguin: React.FC<{ x: number, y: number, z: number }> = ({ x, y, z }) => {
  const ref = useWander(x, z, 0.7);
  return (
    <group ref={ref}>
      <mesh castShadow position={[0, 0.5, 0]}>
        <capsuleGeometry args={[0.22, 0.4, 4, 8]} />
        <meshStandardMaterial color="#1e293b" roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.5, 0.15]}>
        <boxGeometry args={[0.28, 0.5, 0.08]} />
        <meshStandardMaterial color="#f8fafc" />
      </mesh>
      <mesh position={[0, 0.88, 0.2]}>
        <sphereGeometry args={[0.18, 8, 8]} />
        <meshStandardMaterial color="#1e293b" />
      </mesh>
      <mesh position={[0, 0.87, 0.36]}>
        <coneGeometry args={[0.05, 0.15, 6]} />
        <meshStandardMaterial color="#f59e0b" />
      </mesh>
    </group>
  );
};

const Stingray: React.FC<{ x: number, y: number, z: number }> = ({ x, y, z }) => {
  const ref = useWander(x, z, 0.9);
  return (
    <group ref={ref} position={[0, 0.15, 0]}>
      <mesh castShadow scale={[2.5, 0.2, 1.5]}>
        <dodecahedronGeometry args={[0.4, 0]} />
        <meshStandardMaterial color="#7c3aed" flatShading roughness={0.4} />
      </mesh>
      <mesh position={[0, 0, -0.8]} rotation={[0.3, 0, 0]}>
        <cylinderGeometry args={[0.04, 0.02, 1.5, 6]} />
        <meshStandardMaterial color="#6d28d9" />
      </mesh>
    </group>
  );
};

export interface ChunkData {
  obstacles: React.ReactNode[];
  clouds: React.ReactNode[];
  water: React.ReactNode[];
  bridges: React.ReactNode[];
  coins: React.ReactNode[];
  eagles: React.ReactNode[];
  flowerMatrices: Float32Array;
  flowerColors: Float32Array;
  flowerCount: number;
  rockMatrices: Float32Array;
  rockCount: number;
  terrainGeometry: PlaneGeometry;
}

const generateChunkData = (chunkIndex: number): ChunkData => {
  const startZ = chunkIndex * WORLD_CONFIG.CHUNK_SIZE;
  const endZ = startZ + WORLD_CONFIG.CHUNK_SIZE;
  const obstacles: React.ReactNode[] = [];
  const clouds: React.ReactNode[] = [];
  const water: React.ReactNode[] = [];
  const bridges: React.ReactNode[] = [];
  const coins: React.ReactNode[] = [];
  const eagles: React.ReactNode[] = [];
  
  const MAX_FLOWERS = 20; 
  const flowerMatrices = new Float32Array(MAX_FLOWERS * 16);
  const flowerColors = new Float32Array(MAX_FLOWERS * 3);
  let flowerCount = 0;

  const MAX_ROCKS = 4;
  const rockMatrices = new Float32Array(MAX_ROCKS * 16);
  let rockCount = 0;

  const riverSearchStep = 10; 
  const riversFound = new Set<number>();

  for (let z = startZ - 20; z < endZ + 20; z += riverSearchStep) {
      const r = getRiverInfo(z);
      if (r.isRiver && r.centerZ && !riversFound.has(r.centerZ)) {
          riversFound.add(r.centerZ);
          const bx = getBridgeX(r.centerZ);
          bridges.push(<IslandStrait key={`strait-${r.centerZ}`} z={r.centerZ} x={bx} />);

          // --- STRAIT COINS (ROW along the passage) ---
          const numCoins = Math.floor(hash(r.centerZ, 123) * 6) + 5;
          const straitLen = 24;
          const spacing = straitLen / (numCoins + 1);

          for(let i=1; i<=numCoins; i++) {
              const coinDist = -straitLen/2 + i*spacing;
              const coinZ = r.centerZ + coinDist;
              const baseY = calculateBaseTerrain(bx, r.centerZ - 12);
              const coinY = baseY + 1.5;

              coins.push(<Coin key={`strait-coin-${r.centerZ}-${i}`} x={bx} y={coinY} z={coinZ} />);
          }
      }
  }

  const step = 3; 

  for (let z = startZ; z < endZ; z += step) {
     if (z < 150) continue;

     for (let x = -WORLD_CONFIG.LANE_WIDTH - 25; x < WORLD_CONFIG.LANE_WIDTH + 25; x += step) {
        if (getRiverInfo(z).isRiver) continue;
        
        const coinInfo = getCoinInfo(x, z);
        if (coinInfo.isCoin) {
             const y = getTerrainHeight(coinInfo.x!, coinInfo.z!) + 0.6; 
             coins.push(<Coin key={`coin-${coinInfo.x}-${coinInfo.z}`} x={coinInfo.x!} y={y} z={coinInfo.z!} />);
             continue;
        }

        const h = hash(x, z);
        const offsetX = (h - 0.5) * 2;
        const offsetZ = (hash(z, x) - 0.5) * 2;
        const finalX = x + offsetX;
        const finalZ = z + offsetZ;
        if (getRiverInfo(finalZ).isRiver) continue;
        const type = getObstacleAt(x, z);
        const animal = getAnimalAt(x, z);
        const key = `obj-${Math.round(x)}-${Math.round(z)}`;
        
        if (type === 'coral') {
             const y = getTerrainHeight(finalX, finalZ);
             obstacles.push(<Coral key={key} x={finalX} y={y} z={finalZ} />);
        } else if (type === 'reef') {
             const y = getTerrainHeight(finalX, finalZ);
             obstacles.push(<Reef key={key} x={finalX} y={y} z={finalZ} />);
        } else if (type === 'debris' || type === 'driftwood') {
             const y = getTerrainHeight(finalX, finalZ);
             obstacles.push(
                 <mesh key={key} position={[finalX, y + 0.2, finalZ]} rotation={[0, h * 3, Math.PI / 2]} castShadow>
                     <cylinderGeometry args={[0.25, 0.25, 1.5, 8]} />
                     <meshStandardMaterial color="#78350f" roughness={0.9} />
                 </mesh>
             );
        } else if (type === 'rock') {
             const y = getTerrainHeight(finalX, finalZ);
             obstacles.push(
                 <mesh key={key} position={[finalX, y + 0.3, finalZ]} castShadow>
                     <dodecahedronGeometry args={[0.5 + h * 0.3, 0]} />
                     <meshStandardMaterial color="#57534e" flatShading />
                 </mesh>
             );
        } else if (type === 'tall_coral') {
             const y = getTerrainHeight(finalX, finalZ);
             obstacles.push(<Coral key={key} x={finalX} y={y} z={finalZ} />);
             coins.push(<Coin key={`large-coin-${key}`} x={finalX} y={y + 5} z={finalZ} isLarge />);
        } else if (type === 'tall_rock') {
             const y = getTerrainHeight(finalX, finalZ);
             obstacles.push(<Reef key={key} x={finalX} y={y} z={finalZ} />);
             coins.push(<Coin key={`large-coin-${key}`} x={finalX} y={y + 5} z={finalZ} isLarge />);
        } else if (type === 'structure_shipwreck') {
             const y = getTerrainHeight(finalX, finalZ);
             obstacles.push(<Shipwreck key={key} x={finalX} y={y} z={finalZ} rotation={h} />);
             coins.push(<Coin key={`large-coin-${key}`} x={finalX} y={y + 8} z={finalZ} isLarge />);
        } else if (type === 'structure_lighthouse') {
             const y = getTerrainHeight(finalX, finalZ);
             obstacles.push(<Lighthouse key={key} x={finalX} y={y} z={finalZ} />);
             coins.push(<Coin key={`large-coin-${key}`} x={finalX} y={y + 14} z={finalZ} isLarge />);
        } else if (type === 'structure_fort') {
             const y = getTerrainHeight(finalX, finalZ);
             obstacles.push(<PirateFort key={key} x={finalX} y={y} z={finalZ} />);
             coins.push(<Coin key={`large-coin-${key}`} x={finalX} y={y + 10} z={finalZ} isLarge />);
        }

        const baseY = getTerrainHeight(finalX, finalZ);
        // 수면 위: 갈매기, 물범, 펭귄, 게 / 수면 아래: 나머지는 물속 헤엄
        const aSurface = { key: `anim-${key}`, x: finalX, y: baseY + 0.1, z: finalZ };
        const aUnder   = { key: `anim-${key}`, x: finalX, y: baseY - 0.5, z: finalZ };
        if (animal === 'dolphin')    obstacles.push(<Dolphin    {...aUnder} />);
        else if (animal === 'seagull')   obstacles.push(<Seagull    {...aSurface} />);
        else if (animal === 'turtle')    obstacles.push(<Turtle     {...aUnder} />);
        else if (animal === 'pufferfish')obstacles.push(<Pufferfish {...aUnder} />);
        else if (animal === 'fish')      obstacles.push(<Fish       {...aUnder} />);
        else if (animal === 'crab')      obstacles.push(<Crab       {...aSurface} />);
        else if (animal === 'seal')      obstacles.push(<Seal       {...aSurface} />);
        else if (animal === 'penguin')   obstacles.push(<Penguin    {...aSurface} />);
        else if (animal === 'stingray')  obstacles.push(<Stingray   {...aUnder} />);
     }
  }

  for (let z = startZ; z < endZ; z += 15) {
      for (let x = -40; x < 40; x += 20) {
           const cloudInfo = getCloudInfo(x, z);
           if (cloudInfo.isCloud && cloudInfo.z >= startZ && cloudInfo.z < endZ) {
               clouds.push(<CloudObject key={`cloud-${cloudInfo.x}-${cloudInfo.z}`} x={cloudInfo.x} y={cloudInfo.y} z={cloudInfo.z} scale={cloudInfo.scale} />);
               const hCoin = hash(x * 0.111, z * 0.888);
               if (hCoin > 0.7) { 
                   const cloudTopY = cloudInfo.y + (2.5 * cloudInfo.scale); 
                   coins.push(<Coin key={`cloud-coin-${cloudInfo.x}-${cloudInfo.z}`} x={cloudInfo.x} y={cloudTopY} z={cloudInfo.z} isLarge />);
               }
           }
      }
  }
  
  // --- EAGLES LOOP ---
  for (let z = startZ; z < endZ; z += 15) {
      for (let x = -WORLD_CONFIG.LANE_WIDTH - 30; x < WORLD_CONFIG.LANE_WIDTH + 30; x += 15) {
          const eagleInfo = getEagleInfo(x, z);
          if (eagleInfo.isEagle) {
              eagles.push(<SharkFin key={`shark-${x}-${z}`} x={eagleInfo.x} y={eagleInfo.y} z={eagleInfo.z} />);
          }
      }
  }

  const flowerSpacing = 12.0;
  for (let z = startZ; z < endZ; z += flowerSpacing) {
    if (z < 150) continue;
    for (let x = -25; x < 25; x += flowerSpacing) {
        if (getRiverInfo(z).isRiver) continue;
        const h = hash(x * 123.45, z * 678.90);
        if (flowerCount < MAX_FLOWERS && h > 0.7) {
             const y = getTerrainHeight(x, z);
             const offX = (hash(x, z) - 0.5) * 1.0;
             const offZ = (hash(z, x) - 0.5) * 1.0;
             const s = 0.2 + (h - 0.7) * 2.0;
             tempObject.position.set(x + offX, y + 0.05, z + offZ);
             tempObject.rotation.set(0, h * Math.PI * 2, 0);
             tempObject.scale.set(s, s * 0.6, s);
             tempObject.updateMatrix();
             for(let k=0; k<16; k++) {
                 flowerMatrices[flowerCount * 16 + k] = tempObject.matrix.elements[k];
             }
             const colorIdx = Math.floor((h * 100) % FOAM_COLORS.length);
             tempColor.set(FOAM_COLORS[colorIdx]);
             tempColor.offsetHSL(0, 0, 0.15); 
             flowerColors[flowerCount * 3 + 0] = tempColor.r;
             flowerColors[flowerCount * 3 + 1] = tempColor.g;
             flowerColors[flowerCount * 3 + 2] = tempColor.b;
             flowerCount++;
        }
        const hRock = hash(x * 43.21, z * 98.76);
        if (rockCount < MAX_ROCKS && hRock > 0.96) {
             const y = getTerrainHeight(x, z);
             const offX = (hash(x, z) - 0.5) * 1.5;
             const offZ = (hash(z, x) - 0.5) * 1.5;
             const s = 0.15 + (hRock - 0.96) * 4.0;
             tempObject.position.set(x + offX, y + 0.1, z + offZ);
             tempObject.rotation.set(Math.random()*Math.PI, Math.random()*Math.PI, Math.random()*Math.PI);
             tempObject.scale.set(s, s*0.8, s);
             tempObject.updateMatrix();
             for(let k=0; k<16; k++) {
                 rockMatrices[rockCount * 16 + k] = tempObject.matrix.elements[k];
             }
             rockCount++;
        }
    }
  }

  const terrainGeo = new PlaneGeometry(150, WORLD_CONFIG.CHUNK_SIZE, 40, 15);
  terrainGeo.rotateX(-Math.PI / 2);
  const posAttr = terrainGeo.attributes.position;
  const centerZ = startZ + WORLD_CONFIG.CHUNK_SIZE / 2;
  for(let i=0; i < posAttr.count; i++){
      const lx = posAttr.getX(i);
      const lz = posAttr.getZ(i);
      const worldX = lx;
      const worldZ = centerZ + lz; 
      const h = getTerrainHeight(worldX, worldZ);
      posAttr.setY(i, h);
  }
  terrainGeo.computeVertexNormals();

  // 반투명 수면 — 청크 중앙 기준 baseY + 1.2에 평평한 수면 레이어
  const waterBaseY = calculateBaseTerrain(0, centerZ) + 1.2;
  water.push(
    <mesh
      key="water-surface"
      position={[0, waterBaseY, centerZ]}
      rotation={[-Math.PI / 2, 0, 0]}
      renderOrder={1}
    >
      <planeGeometry args={[120, WORLD_CONFIG.CHUNK_SIZE]} />
      <meshStandardMaterial
        color="#38bdf8"
        transparent
        opacity={0.38}
        roughness={0.02}
        metalness={0.15}
        depthWrite={false}
      />
    </mesh>
  );

  return { obstacles, clouds, water, bridges, coins, eagles, flowerMatrices, flowerColors, flowerCount, rockMatrices, rockCount, terrainGeometry: terrainGeo };
};

const WorldChunk = React.memo(({ index }: { index: number }) => {
  const { obstacles, clouds, water, bridges, coins, eagles, flowerMatrices, flowerColors, flowerCount, rockMatrices, rockCount, terrainGeometry } = useMemo(() => generateChunkData(index), [index]);
  const flowerMeshRef = useRef<InstancedMesh>(null);
  const rockMeshRef = useRef<InstancedMesh>(null);

  useLayoutEffect(() => {
    if (flowerMeshRef.current && flowerCount > 0) {
        for (let i = 0; i < flowerCount; i++) {
           tempObject.matrix.fromArray(flowerMatrices, i * 16);
           flowerMeshRef.current.setMatrixAt(i, tempObject.matrix);
           tempColor.setRGB(flowerColors[i*3], flowerColors[i*3+1], flowerColors[i*3+2]);
           flowerMeshRef.current.setColorAt(i, tempColor);
        }
        flowerMeshRef.current.instanceMatrix.needsUpdate = true;
        if(flowerMeshRef.current.instanceColor) flowerMeshRef.current.instanceColor.needsUpdate = true;
    }
    if (rockMeshRef.current && rockCount > 0) {
        for (let i = 0; i < rockCount; i++) {
           tempObject.matrix.fromArray(rockMatrices, i * 16);
           rockMeshRef.current.setMatrixAt(i, tempObject.matrix);
        }
        rockMeshRef.current.instanceMatrix.needsUpdate = true;
    }
  }, [flowerMatrices, flowerColors, flowerCount, rockMatrices, rockCount]);

  return (
    <group>
        <mesh position={[0, 0, index * WORLD_CONFIG.CHUNK_SIZE + WORLD_CONFIG.CHUNK_SIZE / 2]} geometry={terrainGeometry || undefined} receiveShadow>
            <meshStandardMaterial color="#0c4a6e" roughness={0.4} metalness={0.3} flatShading={true} side={DoubleSide} />
        </mesh>
        {obstacles}
        {clouds}
        {water}
        {bridges}
        {coins}
        {eagles}
        {flowerCount > 0 && <instancedMesh ref={flowerMeshRef} args={[undefined, undefined, flowerCount]} receiveShadow material={FlowerMaterial}><sphereGeometry args={[0.3, 5, 5]} /></instancedMesh>}
        {rockCount > 0 && <instancedMesh ref={rockMeshRef} args={[undefined, undefined, rockCount]} castShadow receiveShadow><dodecahedronGeometry args={[0.2, 0]} /><meshStandardMaterial color="#4a5d23" roughness={0.9} /></instancedMesh>}
    </group>
  );
});

const WorldUpdater = () => {
    const { camera } = useThree();
    const [visibleChunks, setVisibleChunks] = useState<number[]>([]);
    const lastChunkIndex = useRef<number>(-999);
    const resetTrigger = useGameStore(state => state.resetTrigger);
    const prevResetTrigger = useRef(resetTrigger);
    const timeOffset = useRef(0);
    
    useFrame((state) => {
        if (prevResetTrigger.current !== resetTrigger) {
             lastChunkIndex.current = -999;
             prevResetTrigger.current = resetTrigger;
             timeOffset.current = state.clock.getElapsedTime();
        }

        if (FlowerMaterial.userData.shader) {
            FlowerMaterial.userData.shader.uniforms.uTime.value = state.clock.getElapsedTime() - timeOffset.current;
        }

        const playerZ = camera.position.z + 8;
        const currentChunk = Math.floor(playerZ / WORLD_CONFIG.CHUNK_SIZE);

        if (currentChunk !== lastChunkIndex.current) {
            lastChunkIndex.current = currentChunk;
            const newChunks: number[] = [];
            for (let i = -1; i <= WORLD_CONFIG.RENDER_DISTANCE_CHUNKS; i++) {
                newChunks.push(currentChunk + i);
            }
            setVisibleChunks(newChunks);
        }
    });

    return (
        <group>
            {visibleChunks.map(index => (<WorldChunk key={`chunk-${index}-${resetTrigger}`} index={index} />))}
        </group>
    )
}

export const World = () => {
  return (
    <group>
      <WorldUpdater />
    </group>
  );
};
