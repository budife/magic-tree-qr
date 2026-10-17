import * as THREE from 'three';
import { makeRng } from './rng';
import type { QrMatrix } from './qr';

export type WeatherType = 'clear' | 'rain' | 'fire';

const RAIN_COUNT = 200;
const FIRE_COUNT = 250; // more fire particles (was 120)

export interface Weather {
  group: THREE.Group;
  update: (dt: number, time: number, visibility: number) => void;
  setType: (type: WeatherType) => void;
  dispose: () => void;
}

/** Rain and fire particle systems that fade when tree becomes QR code. */
export function buildWeather(qr: QrMatrix): Weather {
  const group = new THREE.Group();
  const rng = makeRng(0xc1000d);
  const spread = qr.plot * 0.6;
  const ceiling = qr.plot * 0.85;

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

  // ---- Fire particles --------------------------------------------------------
  const fireGeo = new THREE.SphereGeometry(0.6, 8, 8); // bigger sphere (was 0.3)
  const fireMat = new THREE.MeshBasicMaterial({ 
    color: 0xff6622, 
    transparent: true,
  });
  const fireMesh = new THREE.InstancedMesh(fireGeo, fireMat, FIRE_COUNT);
  fireMesh.visible = false;
  group.add(fireMesh);

  const fireState = new Float32Array(FIRE_COUNT * 5); // x, z, y, riseSpeed, phase
  for (let i = 0; i < FIRE_COUNT; i++) {
    fireState[i * 5] = (rng() - 0.5) * spread * 1.2;
    fireState[i * 5 + 1] = (rng() - 0.5) * spread * 1.2;
    fireState[i * 5 + 2] = rng() * 5; // low start
    fireState[i * 5 + 3] = 2.5 + rng() * 3; // rise speed
    fireState[i * 5 + 4] = rng() * Math.PI * 2; // flicker phase
  }

  const rainMatrix = new THREE.Matrix4();
  const fireMatrix = new THREE.Matrix4();
  const pos = new THREE.Vector3();
  const scl = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  const fireColor = new THREE.Color();
  
  let currentType: WeatherType = 'clear';

  const update = (dt: number, time: number, visibility: number) => {
    const weatherVisible = visibility > 0.05 && currentType !== 'clear';
    rainMesh.visible = weatherVisible && currentType === 'rain';
    fireMesh.visible = weatherVisible && currentType === 'fire';

    if (!weatherVisible) return;

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

    // Fire update
    if (currentType === 'fire') {
      for (let i = 0; i < FIRE_COUNT; i++) {
        const o = i * 5;
        fireState[o + 2] += fireState[o + 3] * dt;
        if (fireState[o + 2] > ceiling * 0.4) {
          fireState[o + 2] = 0;
          fireState[o] = (rng() - 0.5) * spread * 1.2;
          fireState[o + 1] = (rng() - 0.5) * spread * 1.2;
        }
        
        // Flicker and sway
        const flicker = Math.sin(time * 8 + fireState[o + 4]) * 0.4 + 1.2; // bigger scale (was 0.3 + 0.7)
        const sway = Math.sin(time * 2 + fireState[o + 4]) * 0.6; // more sway (was 0.4)
        
        pos.set(
          fireState[o] + sway, 
          fireState[o + 2], 
          fireState[o + 1] + sway * 0.5
        );
        scl.setScalar(flicker);
        
        // Color shift (orange → yellow)
        const heat = Math.min(fireState[o + 2] / 3, 1);
        fireColor.setHSL(0.08 - heat * 0.05, 0.9, 0.5 + heat * 0.2);
        fireMesh.setColorAt(i, fireColor);
        
        fireMatrix.compose(pos, quat.identity(), scl);
        fireMesh.setMatrixAt(i, fireMatrix);
      }
      fireMat.opacity = visibility;
      fireMesh.instanceMatrix.needsUpdate = true;
      if (fireMesh.instanceColor) fireMesh.instanceColor.needsUpdate = true;
    }
  };

  const setType = (type: WeatherType) => {
    currentType = type;
  };

  const dispose = () => {
    rainGeo.dispose();
    rainMat.dispose();
    fireGeo.dispose();
    fireMat.dispose();
  };

  return { group, update, setType, dispose };
}
