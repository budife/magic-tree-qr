import * as THREE from 'three';
import { makeRng } from './rng';
import type { QrMatrix } from './qr';

export type WeatherType = 'clear' | 'rain' | 'fire';

const RAIN_COUNT = 200;
const FIRE_COUNT = 500; // core fire particles
const SMOKE_COUNT = 150; // smoke particles
const EMBER_COUNT = 80; // flying embers/sparks
const FIRE_KILL_TIME = 10; // seconds to extinguish fire when rain active

export interface Weather {
  group: THREE.Group;
  update: (dt: number, time: number, visibility: number) => void;
  setType: (type: WeatherType) => void;
  setKillTimer: () => void;
  dispose: () => void;
}

/** Rain and fire particle systems that fade when tree becomes QR code. */
export function buildWeather(qr: QrMatrix): Weather {
  const group = new THREE.Group();
  const rng = makeRng(0xc1000d);
  const spread = qr.plot * 0.6;
  const ceiling = qr.plot * 0.85;

  let fireIntensity = 1.0; // 0-1, fades when rain falls on fire
  let fireKillTimer = 0; // timer for fast extinguish when fire disabled

  // ---- Rain particles --------------------------------------------------------
  const rainGeo = new THREE.BoxGeometry(0.08, 0.6, 0.08);
  const rainMat = new THREE.MeshBasicMaterial({ 
    color: 0x88aacc, 
    transparent: true,
    opacity: 0.7,
  });
  const rainMesh = new THREE.InstancedMesh(rainGeo, rainMat, RAIN_COUNT);
  rainMesh.visible = false;
  group.add(rainMesh);

  const rainState = new Float32Array(RAIN_COUNT * 4); // x, z, y, fallSpeed
  for (let i = 0; i < RAIN_COUNT; i++) {
    rainState[i * 4] = (rng() - 0.5) * spread * 2;
    rainState[i * 4 + 1] = (rng() - 0.5) * spread * 2;
    rainState[i * 4 + 2] = rng() * ceiling;
    rainState[i * 4 + 3] = 18 + rng() * 8; // fast fall
  }

  // ---- Fire particles (multi-layer: core + outer flames) ---------------------
  const fireCoreGeo = new THREE.SphereGeometry(0.4, 8, 8); // inner hot core (was 0.8)
  const fireCoreMat = new THREE.MeshBasicMaterial({ 
    color: 0xffaa00, 
    transparent: true,
  });
  const fireCoreMesh = new THREE.InstancedMesh(fireCoreGeo, fireCoreMat, FIRE_COUNT);
  fireCoreMesh.visible = false;
  group.add(fireCoreMesh);

  const fireOuterGeo = new THREE.SphereGeometry(0.9, 10, 10); // outer cooler flames (was 1.8)
  const fireOuterMat = new THREE.MeshBasicMaterial({ 
    color: 0xff6622, 
    transparent: true,
  });
  const fireOuterMesh = new THREE.InstancedMesh(fireOuterGeo, fireOuterMat, FIRE_COUNT);
  fireOuterMesh.visible = false;
  group.add(fireOuterMesh);

  // ---- Smoke particles -------------------------------------------------------
  const smokeGeo = new THREE.SphereGeometry(1.25, 8, 8); // large, soft (was 2.5)
  const smokeMat = new THREE.MeshBasicMaterial({
    color: 0x222222,
    transparent: true,
  });
  const smokeMesh = new THREE.InstancedMesh(smokeGeo, smokeMat, SMOKE_COUNT);
  smokeMesh.visible = false;
  group.add(smokeMesh);

  // ---- Embers (flying sparks) ------------------------------------------------
  const emberGeo = new THREE.SphereGeometry(0.08, 6, 6); // (was 0.15)
  const emberMat = new THREE.MeshBasicMaterial({
    color: 0xff4400,
    transparent: true,
  });
  const emberMesh = new THREE.InstancedMesh(emberGeo, emberMat, EMBER_COUNT);
  emberMesh.visible = false;
  group.add(emberMesh);

  const fireState = new Float32Array(FIRE_COUNT * 6); // x, z, y, riseSpeed, phase, life
  for (let i = 0; i < FIRE_COUNT; i++) {
    const o = i * 6;
    fireState[o] = (rng() - 0.5) * spread * 0.8; // tighter fire base
    fireState[o + 1] = (rng() - 0.5) * spread * 0.8;
    fireState[o + 2] = rng() * 2; // start low
    fireState[o + 3] = 4.0 + rng() * 6; // varied rise speed
    fireState[o + 4] = rng() * Math.PI * 2; // flicker phase
    fireState[o + 5] = rng(); // life cycle
  }

  const smokeState = new Float32Array(SMOKE_COUNT * 6); // x, z, y, riseSpeed, phase, life
  for (let i = 0; i < SMOKE_COUNT; i++) {
    const o = i * 6;
    smokeState[o] = (rng() - 0.5) * spread * 1.2;
    smokeState[o + 1] = (rng() - 0.5) * spread * 1.2;
    smokeState[o + 2] = 3 + rng() * 8; // start mid-height
    smokeState[o + 3] = 1.5 + rng() * 2; // slow rise
    smokeState[o + 4] = rng() * Math.PI * 2;
    smokeState[o + 5] = rng();
  }

  const emberState = new Float32Array(EMBER_COUNT * 6); // x, z, y, riseSpeed, phase, life
  for (let i = 0; i < EMBER_COUNT; i++) {
    const o = i * 6;
    emberState[o] = (rng() - 0.5) * spread * 0.6;
    emberState[o + 1] = (rng() - 0.5) * spread * 0.6;
    emberState[o + 2] = rng() * 3;
    emberState[o + 3] = 2.0 + rng() * 5; // varied speeds (some fast pop)
    emberState[o + 4] = rng() * Math.PI * 2;
    emberState[o + 5] = rng();
  }

  const rainMatrix = new THREE.Matrix4();
  const fireMatrix = new THREE.Matrix4();
  const smokeMatrix = new THREE.Matrix4();
  const emberMatrix = new THREE.Matrix4();
  const pos = new THREE.Vector3();
  const scl = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  const fireColor = new THREE.Color();
  
  let currentType: WeatherType = 'clear';

  const update = (dt: number, time: number, visibility: number) => {
    const weatherVisible = visibility > 0.05 && currentType !== 'clear';
    
    // Fire intensity fades when rain active, recovers when rain stops
    const targetIntensity = currentType === 'rain' ? 0 : 1;
    const fadeSpeed = currentType === 'rain' ? 0.15 : 0.3; // rain kills fire slower than fire returns
    fireIntensity += (targetIntensity - fireIntensity) * fadeSpeed * dt * 5;
    
    // Fast kill timer (when fire disabled, 10s to extinguish)
    if (fireKillTimer > 0) {
      fireKillTimer -= dt;
      fireIntensity = Math.max(0, fireKillTimer / FIRE_KILL_TIME); // linear fade from 1 to 0
    }
    
    rainMesh.visible = weatherVisible && currentType === 'rain';
    fireCoreMesh.visible = weatherVisible && fireIntensity > 0.02;
    fireOuterMesh.visible = weatherVisible && fireIntensity > 0.02;
    smokeMesh.visible = weatherVisible && fireIntensity > 0.02;
    emberMesh.visible = weatherVisible && fireIntensity > 0.02;

    if (!weatherVisible && fireIntensity < 0.05) return;

    // Rain update
    if (currentType === 'rain') {
      rainMat.opacity = 0.7 * visibility;
      for (let i = 0; i < RAIN_COUNT; i++) {
        const o = i * 4;
        rainState[o + 2] -= rainState[o + 3] * dt;
        if (rainState[o + 2] < 0) {
          rainState[o + 2] = ceiling;
          rainState[o] = (rng() - 0.5) * spread * 2;
          rainState[o + 1] = (rng() - 0.5) * spread * 2;
        }
        pos.set(rainState[o], rainState[o + 2], rainState[o + 1]);
        scl.set(1, 1, 1);
        rainMatrix.compose(pos, quat.identity(), scl);
        rainMesh.setMatrixAt(i, rainMatrix);
      }
      rainMesh.instanceMatrix.needsUpdate = true;
    }

    // Fire update (always runs to allow fade-out)
    if (fireIntensity > 0.02) {
      // Core fire (hot inner flames)
      for (let i = 0; i < FIRE_COUNT; i++) {
        const o = i * 6;
        fireState[o + 2] += fireState[o + 3] * dt; // rise
        fireState[o + 5] += dt * 0.8; // life cycle
        
        if (fireState[o + 2] > ceiling * 0.5 || fireState[o + 5] > 1) {
          fireState[o + 2] = 0;
          fireState[o] = (rng() - 0.5) * spread * 0.8;
          fireState[o + 1] = (rng() - 0.5) * spread * 0.8;
          fireState[o + 5] = 0;
        }
        
        const life = fireState[o + 5];
        const flicker = (Math.sin(time * 12 + fireState[o + 4]) * 0.3 + 0.9) * fireIntensity;
        const sway = Math.sin(time * 4 + fireState[o + 4]) * 0.5 * fireIntensity;
        
        pos.set(fireState[o] + sway, fireState[o + 2], fireState[o + 1] + sway * 0.4);
        scl.setScalar(flicker * (1 - life * 0.3)); // shrink as rises
        
        // Core: yellow-white hot
        const heat = Math.min(fireState[o + 2] / 5, 1);
        fireColor.setHSL(0.12 - heat * 0.08, 0.98 * fireIntensity, (0.7 + heat * 0.25) * fireIntensity);
        fireCoreMesh.setColorAt(i, fireColor);
        fireMatrix.compose(pos, quat.identity(), scl);
        fireCoreMesh.setMatrixAt(i, fireMatrix);
        
        // Outer: orange-red cooler
        scl.setScalar(flicker * 1.8 * (1 - life * 0.2));
        fireColor.setHSL(0.08 - heat * 0.04, 0.92 * fireIntensity, (0.55 + heat * 0.2) * fireIntensity);
        fireOuterMesh.setColorAt(i, fireColor);
        fireMatrix.compose(pos, quat.identity(), scl);
        fireOuterMesh.setMatrixAt(i, fireMatrix);
      }
      
      fireCoreMat.opacity = visibility * fireIntensity;
      fireOuterMat.opacity = visibility * fireIntensity * 0.7; // outer more transparent
      fireCoreMesh.instanceMatrix.needsUpdate = true;
      fireOuterMesh.instanceMatrix.needsUpdate = true;
      if (fireCoreMesh.instanceColor) fireCoreMesh.instanceColor.needsUpdate = true;
      if (fireOuterMesh.instanceColor) fireOuterMesh.instanceColor.needsUpdate = true;
      
      // Smoke (rises from fire, darker)
      for (let i = 0; i < SMOKE_COUNT; i++) {
        const o = i * 6;
        smokeState[o + 2] += smokeState[o + 3] * dt;
        smokeState[o + 5] += dt * 0.4;
        
        if (smokeState[o + 2] > ceiling || smokeState[o + 5] > 1) {
          smokeState[o + 2] = 3 + rng() * 5;
          smokeState[o] = (rng() - 0.5) * spread * 1.2;
          smokeState[o + 1] = (rng() - 0.5) * spread * 1.2;
          smokeState[o + 5] = 0;
        }
        
        const life = smokeState[o + 5];
        const drift = Math.sin(time * 1.5 + smokeState[o + 4]) * 1.2;
        
        pos.set(smokeState[o] + drift, smokeState[o + 2], smokeState[o + 1] + drift * 0.6);
        scl.setScalar((1.5 + life * 2) * fireIntensity); // grow as rises
        
        smokeMatrix.compose(pos, quat.identity(), scl);
        smokeMesh.setMatrixAt(i, smokeMatrix);
      }
      
      smokeMat.opacity = visibility * fireIntensity * 0.25 * (currentType === 'fire' ? 1 : 0.6); // dim smoke when rain
      smokeMesh.instanceMatrix.needsUpdate = true;
      
      // Embers (flying sparks)
      for (let i = 0; i < EMBER_COUNT; i++) {
        const o = i * 6;
        emberState[o + 2] += emberState[o + 3] * dt;
        emberState[o + 5] += dt * 1.2;
        
        if (emberState[o + 2] > ceiling * 0.6 || emberState[o + 5] > 1) {
          emberState[o + 2] = 0;
          emberState[o] = (rng() - 0.5) * spread * 0.6;
          emberState[o + 1] = (rng() - 0.5) * spread * 0.6;
          emberState[o + 5] = 0;
        }
        
        const life = emberState[o + 5];
        const sparkle = Math.sin(time * 20 + emberState[o + 4]) * 0.5 + 0.5;
        const sway = Math.sin(time * 3 + emberState[o + 4]) * 0.3;
        
        pos.set(emberState[o] + sway, emberState[o + 2], emberState[o + 1]);
        scl.setScalar((1 - life * 0.7) * sparkle * fireIntensity); // fade + twinkle
        
        emberMatrix.compose(pos, quat.identity(), scl);
        emberMesh.setMatrixAt(i, emberMatrix);
      }
      
      emberMat.opacity = visibility * fireIntensity * 0.9;
      emberMesh.instanceMatrix.needsUpdate = true;
    }
  };

  const setType = (type: WeatherType) => {
    currentType = type;
  };

  const setKillTimer = () => {
    fireKillTimer = FIRE_KILL_TIME;
  };

  const dispose = () => {
    rainGeo.dispose();
    rainMat.dispose();
    fireCoreGeo.dispose();
    fireCoreMat.dispose();
    fireOuterGeo.dispose();
    fireOuterMat.dispose();
    smokeGeo.dispose();
    smokeMat.dispose();
    emberGeo.dispose();
    emberMat.dispose();
  };

  return { group, update, setType, setKillTimer, dispose };
}
