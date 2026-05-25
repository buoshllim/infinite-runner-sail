
import React, { useRef, forwardRef, useImperativeHandle, useMemo, useEffect, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Vector3, Group, Mesh, MathUtils, Object3D, InstancedMesh, DynamicDrawUsage, Color, Shape, ExtrudeGeometry, ShapeGeometry } from 'three';
import { WORLD_CONFIG } from '../types';
import { getTerrainHeight, getObstacleAt, getCloudInfo, getBridgeInfo, getRiverInfo, hash } from '../services/mathService';
import { useGameStore } from '../store';
import { audioService } from '../services/audioService';

interface SplashHandle {
  explode: (x: number, z: number) => void;
}

const SplashParticles = forwardRef<SplashHandle, {}>((_, ref) => {
  const count = 40;
  const meshRef = useRef<InstancedMesh>(null);
  const dummy = useMemo(() => new Object3D(), []);
  const particles = useMemo(() => new Array(count).fill(0).map(() => ({ pos: new Vector3(0, -100, 0), vel: new Vector3(0, 0, 0), life: 0, active: false })), []);
  useImperativeHandle(ref, () => ({
    explode: (x: number, z: number) => {
      particles.forEach(p => {
        p.active = true; p.life = 1.0;
        p.pos.set(x + (Math.random() - 0.5) * 1.5, -0.4, z + (Math.random() - 0.5) * 1.5);
        p.vel.set((Math.random() - 0.5) * 8, Math.random() * 8 + 5, (Math.random() - 0.5) * 8 + 5);
      });
    }
  }));
  useFrame((state, delta) => {
    if (!meshRef.current) return;
    let activeCount = 0;
    particles.forEach((p, i) => {
      if (p.active) {
        activeCount++; p.vel.y -= 30 * delta; p.pos.addScaledVector(p.vel, delta); p.life -= delta * 1.5;
        if (p.life <= 0 || p.pos.y < -1) { p.active = false; p.pos.set(0, -100, 0); }
        dummy.position.copy(p.pos); const scale = Math.max(0, p.life * 0.4); dummy.scale.set(scale, scale, scale); dummy.rotation.set(Math.random(), Math.random(), Math.random()); dummy.updateMatrix(); meshRef.current!.setMatrixAt(i, dummy.matrix);
      } else { dummy.position.set(0, -100, 0); dummy.scale.set(0, 0, 0); dummy.updateMatrix(); meshRef.current!.setMatrixAt(i, dummy.matrix); }
    });
    if (activeCount > 0 || meshRef.current.count > 0) meshRef.current.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]} usage={DynamicDrawUsage}>
      <boxGeometry args={[0.15, 0.15, 0.15]} />
      <meshStandardMaterial color="#bfdbfe" emissive="#60a5fa" emissiveIntensity={0.8} roughness={0.1} />
    </instancedMesh>
  );
});

interface DebrisHandle {
  explode: (x: number, z: number, color: string, height: number) => void;
}

const DebrisParticles = forwardRef<DebrisHandle, {}>((_, ref) => {
  const count = 150; 
  const meshRef = useRef<InstancedMesh>(null);
  const dummy = useMemo(() => new Object3D(), []);
  const particles = useMemo(() => new Array(count).fill(0).map(() => ({ pos: new Vector3(0, -100, 0), vel: new Vector3(0, 0, 0), rotVel: new Vector3(0, 0, 0), life: 0, active: false, scale: 1, color: new Color() })), []);
  useImperativeHandle(ref, () => ({
    explode: (x: number, z: number, color: string, height: number) => {
      particles.forEach(p => {
        p.active = true; p.life = 1.5 + Math.random(); 
        const spawnY = Math.random() * height;
        p.pos.set(x + (Math.random() - 0.5) * 1.5, spawnY + getTerrainHeight(x, z), z + (Math.random() - 0.5) * 1.5); 
        p.vel.set((Math.random() - 0.5) * 10, (Math.random() * 5) - 2, (Math.random() - 0.5) * 10 + 5);
        p.rotVel.set(Math.random() * 10, Math.random() * 10, Math.random() * 10);
        p.scale = Math.random() * 0.4 + 0.2; p.color.set(color); p.color.offsetHSL(0, 0, (Math.random() - 0.5) * 0.1);
      });
    }
  }));
  useFrame((state, delta) => {
    if (!meshRef.current) return;
    let activeCount = 0;
    particles.forEach((p, i) => {
      if (p.active) {
        activeCount++; p.vel.y -= 30 * delta; p.pos.addScaledVector(p.vel, delta);
        const terrainY = getTerrainHeight(p.pos.x, p.pos.z);
        if (p.pos.y < terrainY) { p.pos.y = terrainY; p.vel.y *= -0.5; p.vel.x *= 0.8; p.vel.z *= 0.8; }
        p.life -= delta; 
        if (p.life <= 0) { p.active = false; p.pos.set(0, -100, 0); }
        dummy.position.copy(p.pos); const s = p.scale * Math.min(1, p.life); dummy.scale.set(s, s, s); dummy.rotation.x += p.rotVel.x * delta; dummy.rotation.y += p.rotVel.y * delta; dummy.rotation.z += p.rotVel.z * delta; dummy.updateMatrix(); meshRef.current!.setMatrixAt(i, dummy.matrix); meshRef.current!.setColorAt(i, p.color);
      } else { dummy.position.set(0, -100, 0); dummy.scale.set(0, 0, 0); dummy.updateMatrix(); meshRef.current!.setMatrixAt(i, dummy.matrix); }
    });
    if (activeCount > 0 || meshRef.current.count > 0) { meshRef.current.instanceMatrix.needsUpdate = true; if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true; }
  });
  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]} usage={DynamicDrawUsage}>
      <boxGeometry args={[0.8, 0.8, 0.8]} /> <meshStandardMaterial flatShading roughness={0.8} />
    </instancedMesh>
  );
});

export const Player: React.FC = () => {
  const groupRef = useRef<Group>(null);
  const bodyRef = useRef<Mesh>(null);
  const leftArmRef = useRef<Group>(null);
  const rightArmRef = useRef<Group>(null);
  const leftLegRef = useRef<Group>(null);
  const rightLegRef = useRef<Group>(null);
  const headRef = useRef<Group>(null);
  
  const splashRef = useRef<SplashHandle>(null);
  const debrisRef = useRef<DebrisHandle>(null);
  
  const lastHitKey = useRef<string>("");
  const smoothedCameraY = useRef(5);
  const shakeIntensity = useRef(0);
  const lastMilestone = useRef(0);
  const currentLookOffset = useRef(new Vector3(0, 0, 0));

  const { camera } = useThree();
  const isPlaying = useGameStore(state => state.isPlaying);
  const isGameOver = useGameStore(state => state.isGameOver);
  const incrementScore = useGameStore(state => state.incrementScore);
  const addCoins = useGameStore(state => state.addCoins); 
  const removeCoins = useGameStore(state => state.removeCoins); 
  const score = useGameStore(state => state.score);
  const jumpRequest = useGameStore(state => state.jumpRequest);
  const resetJump = useGameStore(state => state.resetJump);
  const targetX = useGameStore(state => state.targetX);
  const speed = useGameStore(state => state.speed);
  const setRawSpeed = useGameStore(state => state.setRawSpeed);
  const cameraDragOffset = useGameStore(state => state.cameraDragOffset);
  const resetTrigger = useGameStore(state => state.resetTrigger);
  const knockbackForceY = useGameStore(state => state.knockbackForceY); 
  const resetKnockback = useGameStore(state => state.resetKnockback);

  const velocity = useRef(new Vector3(0, 0, speed));
  const position = useRef(new Vector3(0, 5, 0));
  const isGrounded = useRef(false);
  const wasGrounded = useRef(false);
  const prevResetTrigger = useRef(resetTrigger);

  const BODY_W = 0.45; const BODY_H = 0.70; const BODY_D = 0.25; const HEAD_SZ = 0.35; const LIMB_W = 0.20; const LIMB_H = 0.70;
  const LEG_Y = LIMB_H; const BODY_Y = LEG_Y + BODY_H/2; const HEAD_Y = LEG_Y + BODY_H + HEAD_SZ/2;

  useFrame((state, delta) => {
    // --- RESET LOGIC MOVED INSIDE USEFRAME ---
    if (prevResetTrigger.current !== resetTrigger) {
        position.current.set(0, 5, 0); 
        velocity.current.set(0, 0, 0); 
        isGrounded.current = false; 
        wasGrounded.current = false;
        lastHitKey.current = "";
        lastMilestone.current = 0;
        smoothedCameraY.current = 5;
        shakeIntensity.current = 0;
        currentLookOffset.current.set(0, 0, 0);
        
        if (groupRef.current) { 
            groupRef.current.position.set(0, 5, 0); 
            groupRef.current.rotation.set(0, 0, 0); 
        }
        
        camera.position.set(0, 9.5, -9.5); 
        camera.lookAt(0, 6, 8);
        
        prevResetTrigger.current = resetTrigger;
        return; // Skip physics frame
    }

    // 게임 오버 시 배 가라앉기 애니메이션
    if (isGameOver && groupRef.current) {
      groupRef.current.position.y -= delta * 2.5;
      groupRef.current.rotation.z = MathUtils.lerp(groupRef.current.rotation.z, 0.5, delta * 1.5);
      groupRef.current.rotation.x = MathUtils.lerp(groupRef.current.rotation.x, 0.3, delta * 1.0);
      return;
    }

    if (!isPlaying || !groupRef.current) return;

    const time = state.clock.getElapsedTime();
    const playerGroup = groupRef.current;

    velocity.current.z = MathUtils.lerp(velocity.current.z, speed, delta * 2);
    position.current.x = MathUtils.lerp(position.current.x, targetX * WORLD_CONFIG.LANE_WIDTH, delta * 4);
    position.current.z += velocity.current.z * delta;

    velocity.current.y -= WORLD_CONFIG.GRAVITY * delta;
    
    if (jumpRequest) { velocity.current.y = WORLD_CONFIG.JUMP_FORCE; resetJump(); isGrounded.current = false; audioService.playJump(); }

    // --- APPLY KNOCKBACK ---
    if (knockbackForceY !== 0) {
        velocity.current.y = knockbackForceY; // Force downward velocity
        resetKnockback(); // Clear logic
        isGrounded.current = false;
        shakeIntensity.current = 1.5; // Big shake on impact
    }

    position.current.y += velocity.current.y * delta;

    const terrainHeight = getTerrainHeight(position.current.x, position.current.z);
    
    const bridgeInfo = getBridgeInfo(position.current.x, position.current.z);

    let platformHeight = -Infinity;

    if (bridgeInfo.isBridge) {
        platformHeight = Math.max(platformHeight, bridgeInfo.height);
    }

    // 섬 충돌: 해협 구간에서 양쪽 섬 경계(|X| > 12) 근처에 닿으면 히트
    const straitInfo = getRiverInfo(position.current.z);
    if (straitInfo.isRiver) {
      const absX = Math.abs(position.current.x);
      const islandEdge = 12.5;
      if (absX > islandEdge) {
        const islandKey = `island-${Math.round(straitInfo.centerZ)}`;
        if (lastHitKey.current !== islandKey) {
          audioService.playCrash();
          shakeIntensity.current = 0.8;
          lastHitKey.current = islandKey;
          velocity.current.z *= 0.80;
          setRawSpeed(speed * 0.80);
          removeCoins(2);
        }
        // 섬 안으로 더 들어가지 않도록 X 위치 클램프
        position.current.x = Math.sign(position.current.x) * islandEdge;
      }
    }

    const cloudInfo = getCloudInfo(position.current.x, position.current.z);
    if (cloudInfo.isCloud) {
        const dx = position.current.x - cloudInfo.x;
        const dz = position.current.z - cloudInfo.z;
        const dist = Math.sqrt(dx*dx + dz*dz);
        if (dist < cloudInfo.radius) {
            const cloudTop = cloudInfo.y + (2.0 * cloudInfo.scale) - 0.5;
            if (velocity.current.y <= 0 && position.current.y >= cloudTop - 0.5) {
                platformHeight = Math.max(platformHeight, cloudTop);
            }
        }
    }

    // 생성 루프와 동일한 step=3 격자로 주변 3×3 포인트 전부 체크
    const GRID_STEP = 3;
    const gx0 = Math.round(position.current.x / GRID_STEP) * GRID_STEP;
    const gz0 = Math.round(position.current.z / GRID_STEP) * GRID_STEP;

    for (let gx = gx0 - GRID_STEP; gx <= gx0 + GRID_STEP; gx += GRID_STEP) {
      for (let gz = gz0 - GRID_STEP; gz <= gz0 + GRID_STEP; gz += GRID_STEP) {
        const obsType = getObstacleAt(gx, gz);
        if (obsType === 'none') continue;

        const oh  = hash(gx, gz);
        const oh2 = hash(gx * 1.7, gz * 2.3);
        const actualX = gx + (oh  - 0.5) * 2;
        const actualZ = gz + (oh2 - 0.5) * 2;
        const dx = position.current.x - actualX;
        const dz = position.current.z - actualZ;
        const dist = Math.sqrt(dx * dx + dz * dz);

        let hitRadius = 1.0;
        let isLarge = false;
        if (obsType === 'reef') hitRadius = 1.0;
        if (obsType === 'coral') hitRadius = 0.6;
        if (obsType === 'debris' || obsType === 'driftwood') hitRadius = 0.5;
        if (obsType === 'rock') hitRadius = 0.7;
        if (obsType.startsWith('structure')) { hitRadius = 2.5; isLarge = true; }
        if (obsType === 'tall_coral' || obsType === 'tall_rock') { hitRadius = 2.0; isLarge = true; }

        if (dist < hitRadius) {
          const obsBaseY = getTerrainHeight(actualX, actualZ);
          let obsHeight = 0; let obsColor = "#57534e";
          if (obsType === 'coral') { obsHeight = 2.5; obsColor = "#f97316"; }
          else if (obsType === 'reef') { obsHeight = 1.5; obsColor = "#44403c"; }
          else if (obsType === 'tall_coral') { obsHeight = 2.5; obsColor = "#fb923c"; }
          else if (obsType === 'tall_rock') { obsHeight = 2.5; obsColor = "#57534e"; }
          else if (obsType === 'structure_shipwreck') { obsHeight = 6; obsColor = "#92400e"; }
          else if (obsType === 'structure_lighthouse') { obsHeight = 12; obsColor = "#f8fafc"; }
          else if (obsType === 'structure_fort') { obsHeight = 8; obsColor = "#57534e"; }
          else if (obsType === 'debris' || obsType === 'driftwood') { obsHeight = 0.5; obsColor = "#78350f"; }
          else if (obsType === 'rock') { obsHeight = 1.0; obsColor = "#57534e"; }

          const topY = obsBaseY + obsHeight;
          if (position.current.y >= topY - 0.5) {
            platformHeight = Math.max(platformHeight, topY);
          } else if (dist < hitRadius * 0.8) {
            const currentObsKey = `${gx},${gz}`;
            if (lastHitKey.current !== currentObsKey) {
              audioService.playCrash();
              shakeIntensity.current = 0.8;
              debrisRef.current?.explode(actualX, actualZ, obsColor, obsHeight);
              lastHitKey.current = currentObsKey;

              const factor = isLarge ? 0.80 : 0.85;
              velocity.current.z *= factor;
              setRawSpeed(speed * factor);

              if (isLarge) {
                removeCoins(Math.floor(Math.random() * 2) + 2);
              } else {
                removeCoins(1);
              }
            }
          }
        }
      }
    }

    const floorY = Math.max(terrainHeight, platformHeight);

    if (position.current.y < floorY) { position.current.y = floorY; velocity.current.y = 0; isGrounded.current = true; } else { isGrounded.current = false; }
    if (isGrounded.current && !wasGrounded.current) { audioService.playLand(); }
    wasGrounded.current = isGrounded.current;

    playerGroup.position.copy(position.current);

    smoothedCameraY.current = MathUtils.lerp(smoothedCameraY.current, position.current.y, delta * 2.0);
    if (shakeIntensity.current > 0) { shakeIntensity.current = MathUtils.lerp(shakeIntensity.current, 0, delta * 5); if (shakeIntensity.current < 0.01) shakeIntensity.current = 0; }
    const shakeX = (Math.random() - 0.5) * shakeIntensity.current;
    const shakeY = (Math.random() - 0.5) * shakeIntensity.current;
    const targetLookX = -cameraDragOffset.x * Math.PI; 
    const targetLookY = cameraDragOffset.y * Math.PI * 0.3;
    currentLookOffset.current.x = MathUtils.lerp(currentLookOffset.current.x, targetLookX, delta * 8);
    currentLookOffset.current.y = MathUtils.lerp(currentLookOffset.current.y, targetLookY, delta * 8);
    const baseOffset = new Vector3(0, 4.5, -9.5);
    baseOffset.applyAxisAngle(new Vector3(1, 0, 0), currentLookOffset.current.y);
    baseOffset.applyAxisAngle(new Vector3(0, 1, 0), currentLookOffset.current.x);
    const camTargetPos = new Vector3(position.current.x * 0.5 + shakeX, smoothedCameraY.current + shakeY, position.current.z).add(baseOffset);
    camera.position.lerp(camTargetPos, delta * 3.5);
    const lookAtTarget = new Vector3(position.current.x * 0.1, smoothedCameraY.current + 1.0, position.current.z + 8);
    camera.lookAt(lookAtTarget);

    if (leftArmRef.current && rightArmRef.current && leftLegRef.current && rightLegRef.current && bodyRef.current && headRef.current) {
      const isJumping = !isGrounded.current && velocity.current.y > -5; 
      const currentSpeed = velocity.current.z;

      // 파도 중심잡기 애니메이션 — 달리기 대신 배 위에서 흔들리며 균형잡는 느낌
      const swayFreq = 1.8;
      const sway = Math.sin(time * swayFreq) * 0.12;
      const sway2 = Math.sin(time * swayFreq * 0.7 + 1.2) * 0.06;

      if (isJumping) {
        // 파도 점프: 팔 살짝 들고 균형잡기
        leftArmRef.current.rotation.x = MathUtils.lerp(leftArmRef.current.rotation.x, -0.6, delta * 8);
        leftArmRef.current.rotation.z = MathUtils.lerp(leftArmRef.current.rotation.z, 0.4, delta * 8);
        rightArmRef.current.rotation.x = MathUtils.lerp(rightArmRef.current.rotation.x, -0.6, delta * 8);
        rightArmRef.current.rotation.z = MathUtils.lerp(rightArmRef.current.rotation.z, -0.4, delta * 8);
        leftLegRef.current.rotation.x = MathUtils.lerp(leftLegRef.current.rotation.x, 0.15, delta * 8);
        leftLegRef.current.rotation.z = 0;
        rightLegRef.current.rotation.x = MathUtils.lerp(rightLegRef.current.rotation.x, -0.15, delta * 8);
        rightLegRef.current.rotation.z = 0;
        playerGroup.rotation.x = MathUtils.lerp(playerGroup.rotation.x, -0.05, delta * 5);
      } else {
        // 항해 중: 파도에 맞춰 팔로 균형잡기, 다리는 거의 안 움직임
        leftArmRef.current.rotation.x = MathUtils.lerp(leftArmRef.current.rotation.x, sway * 0.4 + sway2, delta * 3);
        leftArmRef.current.rotation.z = MathUtils.lerp(leftArmRef.current.rotation.z, 0.15 + sway * 0.3, delta * 3);
        rightArmRef.current.rotation.x = MathUtils.lerp(rightArmRef.current.rotation.x, -sway * 0.4 + sway2, delta * 3);
        rightArmRef.current.rotation.z = MathUtils.lerp(rightArmRef.current.rotation.z, -0.15 - sway * 0.3, delta * 3);
        leftLegRef.current.rotation.x = MathUtils.lerp(leftLegRef.current.rotation.x, sway * 0.05, delta * 2);
        leftLegRef.current.rotation.z = 0;
        rightLegRef.current.rotation.x = MathUtils.lerp(rightLegRef.current.rotation.x, -sway * 0.05, delta * 2);
        rightLegRef.current.rotation.z = 0;
        playerGroup.rotation.x = MathUtils.lerp(playerGroup.rotation.x, 0, delta * 3);

        // 몸통 미세 흔들림
        const bob = Math.sin(time * swayFreq * 2) * 0.015;
        bodyRef.current.position.y = BODY_Y + bob;
        headRef.current.position.y = HEAD_Y + bob;
        const shoulderY = BODY_Y + (BODY_H/2) - 0.1;
        leftArmRef.current.position.y = shoulderY + bob;
        rightArmRef.current.position.y = shoulderY + bob;
        const hipY = LEG_Y;
        leftLegRef.current.position.y = hipY;
        rightLegRef.current.position.y = hipY;
      }
      const tilt = (position.current.x - (targetX * WORLD_CONFIG.LANE_WIDTH)) * -0.05;
      playerGroup.rotation.z = MathUtils.lerp(playerGroup.rotation.z, tilt, delta * 3);
    }

    if (score > 100 && Math.floor(score / 1000) > lastMilestone.current) {
        lastMilestone.current = Math.floor(score / 1000);
        audioService.playMilestone();
        addCoins(10); 
    }
    incrementScore(delta * velocity.current.z);
  });

  // Hull shape: top-down profile, X=width, Y=length (→ World Z after rotation)
  const hullShape = useMemo(() => {
    const s = new Shape();
    s.moveTo(0, 5.2);          // bow tip
    s.lineTo(1.1, 3.8);
    s.lineTo(2.0, 1.5);        // beam
    s.lineTo(2.0, -1.5);
    s.lineTo(1.6, -3.5);
    s.lineTo(0.6, -4.5);       // stern
    s.lineTo(-0.6, -4.5);
    s.lineTo(-1.6, -3.5);
    s.lineTo(-2.0, -1.5);
    s.lineTo(-2.0, 1.5);
    s.lineTo(-1.1, 3.8);
    s.closePath();
    return s;
  }, []);
  const hullGeo  = useMemo(() => new ExtrudeGeometry(hullShape, { depth: 2.2, bevelEnabled: false }), [hullShape]);
  const deckGeo  = useMemo(() => new ShapeGeometry(hullShape), [hullShape]);

  return (
    <>
      <SplashParticles ref={splashRef} />
      <DebrisParticles ref={debrisRef} />
      <group ref={groupRef} position={[0, 5, 0]} name="PlayerGroup">
        <group ref={headRef} position={[0, HEAD_Y, 0]}>
            <mesh castShadow><boxGeometry args={[HEAD_SZ, HEAD_SZ, HEAD_SZ]} /><meshStandardMaterial color="#fbbf24" roughness={0.3} /></mesh>
            {/* 선원 모자 (흰 밴드 + 네이비 몸통) */}
            <group position={[0, HEAD_SZ / 2, 0]}>
              <mesh position={[0, 0.08, 0]}>
                <boxGeometry args={[HEAD_SZ + 0.02, 0.16, HEAD_SZ + 0.02]} />
                <meshStandardMaterial color="#1e3a8a" />
              </mesh>
              <mesh position={[0, 0.16, 0]}>
                <boxGeometry args={[HEAD_SZ - 0.04, 0.06, HEAD_SZ - 0.04]} />
                <meshStandardMaterial color="#ffffff" />
              </mesh>
            </group>
            <group position={[0, 0, HEAD_SZ/2 + 0.001]}>
                <mesh position={[-0.08, 0.08, 0]} rotation={[0,0,-0.15]}><boxGeometry args={[0.08, 0.02, 0.01]} /><meshStandardMaterial color="#854d0e" /></mesh>
                <mesh position={[0.08, 0.08, 0]} rotation={[0,0,0.15]}><boxGeometry args={[0.08, 0.02, 0.01]} /><meshStandardMaterial color="#854d0e" /></mesh>
                <mesh position={[-0.07, 0.03, 0]} rotation={[Math.PI/2, 0, 0]}><cylinderGeometry args={[0.025, 0.025, 0.01, 16]} /><meshStandardMaterial color="#000" /></mesh>
                <mesh position={[0.07, 0.03, 0]} rotation={[Math.PI/2, 0, 0]}><cylinderGeometry args={[0.025, 0.025, 0.01, 16]} /><meshStandardMaterial color="#000" /></mesh>
                <mesh position={[-0.07, 0.035, 0.002]} rotation={[Math.PI/2, 0, 0]}><cylinderGeometry args={[0.008, 0.008, 0.01, 8]} /><meshStandardMaterial color="#fff" /></mesh>
                <mesh position={[0.07, 0.035, 0.002]} rotation={[Math.PI/2, 0, 0]}><cylinderGeometry args={[0.008, 0.008, 0.01, 8]} /><meshStandardMaterial color="#fff" /></mesh>
                <mesh position={[-0.12, -0.02, 0]} rotation={[Math.PI/2, 0, 0]}><cylinderGeometry args={[0.025, 0.025, 0.01, 8]} /><meshStandardMaterial color="#fca5a5" transparent opacity={0.6} /></mesh>
                <mesh position={[0.12, -0.02, 0]} rotation={[Math.PI/2, 0, 0]}><cylinderGeometry args={[0.025, 0.025, 0.01, 8]} /><meshStandardMaterial color="#fca5a5" transparent opacity={0.6} /></mesh>
                <group position={[0, -0.08, 0]}>
                    <mesh rotation={[Math.PI/2, 0, 3 * Math.PI / 2]}><cylinderGeometry args={[0.08, 0.08, 0.01, 16, 1, false, 0, Math.PI]} /><meshStandardMaterial color="#000" /></mesh>
                    <mesh position={[0, 0.035, 0.002]}><boxGeometry args={[0.12, 0.02, 0.01]} /><meshStandardMaterial color="#fff" /></mesh>
                </group>
            </group>
        </group>
        <mesh ref={bodyRef} position={[0, BODY_Y, 0]} castShadow><boxGeometry args={[BODY_W, BODY_H, BODY_D]} /><meshStandardMaterial color="#1e3a8a" roughness={0.5} /></mesh>
        {/* 흰 V자 칼라 */}
        <mesh position={[0, BODY_Y + BODY_H / 2 - 0.05, BODY_D / 2 + 0.001]}>
          <boxGeometry args={[BODY_W * 0.6, 0.15, 0.01]} />
          <meshStandardMaterial color="#ffffff" />
        </mesh>
        <group ref={leftArmRef} position={[-BODY_W/2 - LIMB_W/2, 0, 0]}><mesh position={[0, -LIMB_H/2 + 0.1, 0]} castShadow><boxGeometry args={[LIMB_W, LIMB_H, LIMB_W]} /><meshStandardMaterial color="#fbbf24" /></mesh></group>
        <group ref={rightArmRef} position={[BODY_W/2 + LIMB_W/2, 0, 0]}><mesh position={[0, -LIMB_H/2 + 0.1, 0]} castShadow><boxGeometry args={[LIMB_W, LIMB_H, LIMB_W]} /><meshStandardMaterial color="#fbbf24" /></mesh></group>
        <group ref={leftLegRef} position={[-0.12, 0, 0]}><mesh position={[0, -LIMB_H/2, 0]} castShadow><boxGeometry args={[LIMB_W, LIMB_H, LIMB_W]} /><meshStandardMaterial color="#f8fafc" /></mesh></group>
        <group ref={rightLegRef} position={[0.12, 0, 0]}><mesh position={[0, -LIMB_H/2, 0]} castShadow><boxGeometry args={[LIMB_W, LIMB_H, LIMB_W]} /><meshStandardMaterial color="#f8fafc" /></mesh></group>

        {/* 범선 모델 */}
        <group position={[0, -LEG_Y + 1.4, 0]}>
          {/* 선체 — ExtrudeGeometry로 앞뒤가 뾰족한 실제 선형 */}
          {/* rotation=[π/2,0,0]: LocalY→WorldZ(선수미), LocalZ→World-Y(흘수) */}
          <mesh geometry={hullGeo} rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0]} castShadow receiveShadow>
            <meshStandardMaterial color="#92400e" roughness={0.8} />
          </mesh>
          {/* 갑판 — 선체 윤곽과 동일한 ShapeGeometry */}
          <mesh geometry={deckGeo} rotation={[Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} receiveShadow>
            <meshStandardMaterial color="#a16207" roughness={0.9} />
          </mesh>
          {/* 선미루 (고물 갑판) */}
          <mesh position={[0, 0.6, -3.2]} castShadow>
            <boxGeometry args={[2.8, 1.0, 2.2]} />
            <meshStandardMaterial color="#78350f" roughness={0.8} />
          </mesh>
          {/* 선수 경사 (bowsprit) */}
          <mesh position={[0, 0.4, 5.8]} rotation={[-0.38, 0, 0]} castShadow>
            <cylinderGeometry args={[0.07, 0.11, 3.2, 6]} />
            <meshStandardMaterial color="#422006" roughness={0.9} />
          </mesh>
          {/* 돛대 */}
          <mesh position={[0, 6.5, 0.5]} castShadow>
            <cylinderGeometry args={[0.12, 0.15, 13, 8]} />
            <meshStandardMaterial color="#422006" roughness={0.9} />
          </mesh>
          {/* 주 돛 */}
          <mesh position={[0, 6.5, 0.5]} castShadow>
            <boxGeometry args={[4.5, 7.0, 0.06]} />
            <meshStandardMaterial color="#f8fafc" roughness={0.3} side={2} />
          </mesh>
          {/* 돛 가로대 */}
          <mesh position={[0, 10.2, 0.5]}>
            <boxGeometry args={[5.2, 0.18, 0.18]} />
            <meshStandardMaterial color="#422006" />
          </mesh>
          {/* 깃발 */}
          <mesh position={[0.2, 13.2, 0.5]} castShadow>
            <boxGeometry args={[0.9, 0.55, 0.03]} />
            <meshStandardMaterial color="#dc2626" />
          </mesh>
        </group>
      </group>
    </>
  );
};