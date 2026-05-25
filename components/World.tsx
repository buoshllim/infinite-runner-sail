
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

// --- OCEAN SURFACE MATERIAL (animated waves + foam) ---
const OceanTerrainMaterial = new MeshStandardMaterial({
  color: "#0284c7",
  transparent: true,
  opacity: 0.88,
  roughness: 0.06,
  metalness: 0.25,
  emissive: "#0ea5e9",
  emissiveIntensity: 0.18,
  side: DoubleSide,
});

OceanTerrainMaterial.onBeforeCompile = (shader) => {
  shader.uniforms.uTime = { value: 0 };
  shader.vertexShader = `uniform float uTime;\nvarying float vCrest;\n${shader.vertexShader}`;
  shader.vertexShader = shader.vertexShader.replace(
    '#include <begin_vertex>',
    `
    #include <begin_vertex>
    float rip = sin(position.x * 0.85 + uTime * 3.1) * 0.11
              + cos(position.z * 0.65 + uTime * 2.4) * 0.08
              + sin((position.x + position.z) * 0.4 + uTime * 1.9) * 0.05;
    transformed.y += rip;
    vCrest = transformed.y;
    `
  );
  shader.fragmentShader = `varying float vCrest;\n${shader.fragmentShader}`;
  shader.fragmentShader = shader.fragmentShader.replace(
    '#include <dithering_fragment>',
    `
    #include <dithering_fragment>
    float foam = smoothstep(0.28, 0.62, vCrest);
    gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.95, 0.97, 1.0), foam * 0.78);
    gl_FragColor.a   = mix(gl_FragColor.a,   1.0, foam * 0.3);
    `
  );
  OceanTerrainMaterial.userData.shader = shader;
};

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

// 섬 하나를 여러 바위 덩어리 조합으로 그리는 헬퍼
const IslandMass: React.FC<{ side: number; seed: number }> = ({ side, seed }) => {
  const h0 = hash(seed, 10);
  const h1 = hash(seed, 11);
  const h2 = hash(seed, 12);
  const h3 = hash(seed, 13);
  const h4 = hash(seed, 14);
  const h5 = hash(seed, 15);

  // 섬 유형: 0=납작한 암반, 1=뾰족한 절벽, 2=분산된 암초군
  const type = Math.floor(h0 * 3);
  const rot = h1 * Math.PI * 2;

  const baseX = side * (16 + h2 * 6);
  const baseZ = h3 * 10 - 5;

  const colors = ["#1a4d2e", "#15803d", "#166534", "#0f5132", "#14532d"];
  const c0 = colors[Math.floor(h4 * colors.length)];
  const c1 = colors[Math.floor(h5 * colors.length)];

  if (type === 0) {
    // 납작하고 넓은 섬
    return (
      <group position={[baseX, 0, baseZ]} rotation={[0, rot, 0]}>
        <mesh castShadow receiveShadow scale={[1.6 + h1 * 0.8, 0.32 + h2 * 0.2, 1.2 + h3 * 0.7]}>
          <dodecahedronGeometry args={[8, 0]} />
          <meshStandardMaterial color={c0} roughness={1} flatShading />
        </mesh>
        <mesh position={[5, 0.8, 2]} castShadow scale={[0.5, 0.4 + h4 * 0.3, 0.6]}>
          <dodecahedronGeometry args={[5, 0]} />
          <meshStandardMaterial color={c1} roughness={1} flatShading />
        </mesh>
        <mesh position={[-4, 0.5, -4]} castShadow scale={[0.6, 0.25, 0.5]}>
          <dodecahedronGeometry args={[5, 0]} />
          <meshStandardMaterial color={c0} roughness={1} flatShading />
        </mesh>
      </group>
    );
  } else if (type === 1) {
    // 뾰족한 절벽 형태
    return (
      <group position={[baseX, 0, baseZ]} rotation={[0, rot, 0]}>
        <mesh castShadow receiveShadow scale={[0.7 + h1 * 0.4, 0.4 + h2 * 0.3, 0.9 + h3 * 0.5]}>
          <dodecahedronGeometry args={[6, 0]} />
          <meshStandardMaterial color={c0} roughness={1} flatShading />
        </mesh>
        <mesh position={[1, 4 + h4 * 5, 0]} castShadow scale={[0.3, 1.5 + h5 * 1.0, 0.3]}>
          <dodecahedronGeometry args={[4, 0]} />
          <meshStandardMaterial color="#0f5132" roughness={0.9} flatShading />
        </mesh>
        <mesh position={[-3, 2 + h2 * 2, 3]} castShadow scale={[0.35, 0.8 + h1 * 0.6, 0.35]}>
          <dodecahedronGeometry args={[3.5, 0]} />
          <meshStandardMaterial color={c1} roughness={0.9} flatShading />
        </mesh>
        <mesh position={[4, 0.5, -3]} castShadow scale={[0.6, 0.2, 0.5]}>
          <dodecahedronGeometry args={[4, 0]} />
          <meshStandardMaterial color={c0} roughness={1} flatShading />
        </mesh>
      </group>
    );
  } else {
    // 흩어진 암초군
    return (
      <group position={[baseX, 0, baseZ]} rotation={[0, rot, 0]}>
        <mesh castShadow receiveShadow scale={[1.0 + h1 * 0.5, 0.28 + h2 * 0.18, 0.9 + h3 * 0.5]} position={[0, 0, 0]}>
          <dodecahedronGeometry args={[6, 0]} />
          <meshStandardMaterial color={c0} roughness={1} flatShading />
        </mesh>
        <mesh position={[7 + h4 * 3, 0.4, 2]} castShadow scale={[0.5, 0.2, 0.4]}>
          <dodecahedronGeometry args={[4, 0]} />
          <meshStandardMaterial color={c1} roughness={1} flatShading />
        </mesh>
        <mesh position={[-5, 0.3, 5 + h5 * 3]} castShadow scale={[0.4, 0.18, 0.5]}>
          <dodecahedronGeometry args={[4, 0]} />
          <meshStandardMaterial color={c0} roughness={1} flatShading />
        </mesh>
        <mesh position={[3, 0.6, -6 - h3 * 2]} castShadow scale={[0.35, 0.22, 0.4]}>
          <dodecahedronGeometry args={[3, 0]} />
          <meshStandardMaterial color={c1} roughness={1} flatShading />
        </mesh>
      </group>
    );
  }
};

const IslandStrait: React.FC<{ z: number, x: number }> = React.memo(({ z, x }) => {
  const baseY = calculateBaseTerrain(x, z - 12);

  const hConfig = hash(z, 99);
  // 0~0.33 → 왼쪽만, 0.33~0.66 → 오른쪽만, 0.66~1 → 양쪽 (단 Z 오프셋 달리)
  const config = hConfig < 0.33 ? 'left' : hConfig < 0.66 ? 'right' : 'both';

  return (
    <group position={[0, baseY, z]}>
      {(config === 'left' || config === 'both') && (
        <IslandMass side={-1} seed={Math.floor(z / 450) * 7 + 1} />
      )}
      {(config === 'right' || config === 'both') && (
        <IslandMass side={1} seed={Math.floor(z / 450) * 7 + 3} />
      )}
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

        const h  = hash(x, z);
        const h2 = hash(x * 1.7, z * 2.3);
        const h3 = hash(z * 3.1, x * 0.9);
        // 충돌 감지와 일치하는 오프셋 (±1)
        const offsetX = (h  - 0.5) * 2;
        const offsetZ = (h2 - 0.5) * 2;
        const finalX = x + offsetX;
        const finalZ = z + offsetZ;
        if (getRiverInfo(finalZ).isRiver) continue;
        const type = getObstacleAt(x, z);
        const animal = getAnimalAt(x, z);
        const key = `obj-${Math.round(x)}-${Math.round(z)}`;
        const rotY = h3 * Math.PI * 2;
        const scaleV = 0.75 + h2 * 0.6;

        if (type === 'coral') {
             const y = getTerrainHeight(finalX, finalZ);
             obstacles.push(
               <group key={key} position={[finalX, y, finalZ]} rotation={[0, rotY, 0]} scale={scaleV}>
                 <Coral x={0} y={0} z={0} />
               </group>
             );
        } else if (type === 'reef') {
             const y = getTerrainHeight(finalX, finalZ);
             obstacles.push(
               <group key={key} position={[finalX, y, finalZ]} rotation={[0, rotY, 0]} scale={scaleV}>
                 <Reef x={0} y={0} z={0} />
               </group>
             );
        } else if (type === 'debris' || type === 'driftwood') {
             const y = getTerrainHeight(finalX, finalZ);
             const tilt = (h3 - 0.5) * 0.4;
             obstacles.push(
                 <mesh key={key} position={[finalX, y + 0.2, finalZ]} rotation={[tilt, rotY, Math.PI / 2 + tilt]} castShadow>
                     <cylinderGeometry args={[0.2 + h * 0.15, 0.25 + h2 * 0.1, 1.2 + h3 * 1.5, 7]} />
                     <meshStandardMaterial color={h > 0.5 ? "#78350f" : "#92400e"} roughness={0.9} />
                 </mesh>
             );
        } else if (type === 'rock') {
             const y = getTerrainHeight(finalX, finalZ);
             obstacles.push(
                 <mesh key={key} position={[finalX, y + 0.2, finalZ]} rotation={[h3 * 0.3, rotY, h2 * 0.2]} castShadow scale={scaleV}>
                     <dodecahedronGeometry args={[0.5 + h * 0.5, 0]} />
                     <meshStandardMaterial color={h > 0.5 ? "#57534e" : "#44403c"} flatShading />
                 </mesh>
             );
        } else if (type === 'tall_coral') {
             const y = getTerrainHeight(finalX, finalZ);
             obstacles.push(
               <group key={key} position={[finalX, y, finalZ]} rotation={[0, rotY, 0]} scale={scaleV}>
                 <Coral x={0} y={0} z={0} />
               </group>
             );
             coins.push(<Coin key={`large-coin-${key}`} x={finalX} y={y + 5} z={finalZ} isLarge />);
        } else if (type === 'tall_rock') {
             const y = getTerrainHeight(finalX, finalZ);
             obstacles.push(
               <group key={key} position={[finalX, y, finalZ]} rotation={[0, rotY, 0]} scale={scaleV}>
                 <Reef x={0} y={0} z={0} />
               </group>
             );
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

  return { obstacles, clouds, water, bridges, coins, eagles, flowerMatrices, flowerColors, flowerCount, rockMatrices, rockCount, terrainGeometry: terrainGeo };
};

const WorldChunk = React.memo(({ index }: { index: number }) => {
  const { obstacles, clouds, water, bridges, coins, eagles, flowerMatrices, flowerColors, flowerCount, rockMatrices, rockCount, terrainGeometry } = useMemo(() => generateChunkData(index), [index]);
  const flowerMeshRef = useRef<InstancedMesh>(null);
  const rockMeshRef = useRef<InstancedMesh>(null);

  useFrame(({ clock }) => {
    if (OceanTerrainMaterial.userData.shader) {
      OceanTerrainMaterial.userData.shader.uniforms.uTime.value = clock.getElapsedTime();
    }
  });

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
        <mesh position={[0, 0, index * WORLD_CONFIG.CHUNK_SIZE + WORLD_CONFIG.CHUNK_SIZE / 2]} geometry={terrainGeometry || undefined} receiveShadow material={OceanTerrainMaterial} />
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
