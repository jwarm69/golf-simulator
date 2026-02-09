import * as THREE from 'three';
import { BALL_MASS, GRAVITY } from '../types';

const ARC_POINTS = 60;
const GRAVITY_VEC = new THREE.Vector3(0, -GRAVITY, 0);
const DEFAULT_POWER_PREVIEW = 0.5;
const SIM_DT = 0.02; // 50 steps per second
const MAX_SIM_TIME = 8.0; // max 8 seconds of flight

export class TrajectoryPreview {
  private dots: THREE.Points;
  private ring: THREE.Mesh;
  private scene: THREE.Scene;
  private positionAttr: THREE.BufferAttribute;

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    // Dotted arc (Points)
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(ARC_POINTS * 3);
    this.positionAttr = new THREE.BufferAttribute(positions, 3);
    geo.setAttribute('position', this.positionAttr);

    const mat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.12,
      transparent: true,
      opacity: 0.7,
      sizeAttenuation: true,
    });
    this.dots = new THREE.Points(geo, mat);
    this.dots.visible = false;
    scene.add(this.dots);

    // Landing ring
    const ringGeo = new THREE.RingGeometry(0.3, 0.45, 32);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xffff44,
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide,
    });
    this.ring = new THREE.Mesh(ringGeo, ringMat);
    this.ring.visible = false;
    scene.add(this.ring);
  }

  update(
    ballPos: THREE.Vector3,
    orbitAngle: number,
    power: number | null,
    loftAngle: number,
    maxSpeed: number,
    wind?: THREE.Vector3,
    spinAmount?: number,
    magnusCoeff?: number
  ) {
    const p = power !== null ? power : DEFAULT_POWER_PREVIEW;
    const shotPower = p * maxSpeed * BALL_MASS;

    // Launch direction (same math as ShotController.releaseShot)
    const dx = -Math.sin(orbitAngle);
    const dz = -Math.cos(orbitAngle);
    const horizontalSpeed = Math.cos(loftAngle);
    const verticalSpeed = Math.sin(loftAngle);

    const dir = new THREE.Vector3(
      dx * horizontalSpeed,
      verticalSpeed,
      dz * horizontalSpeed
    ).normalize();

    // Initial velocity
    const v0 = shotPower / BALL_MASS;
    const velocity = new THREE.Vector3(dir.x * v0, dir.y * v0, dir.z * v0);
    const position = ballPos.clone();

    const windForce = wind ?? new THREE.Vector3();
    const spin = spinAmount ?? 0;
    const mCoeff = magnusCoeff ?? 0.3;

    // Numerical integration (Euler method)
    let landed = false;
    let landX = ballPos.x;
    let landZ = ballPos.z;
    let totalSteps = Math.floor(MAX_SIM_TIME / SIM_DT);
    const pointInterval = Math.max(1, Math.floor(totalSteps / ARC_POINTS));

    let pointIndex = 0;
    let stepCount = 0;

    // Store the first point
    if (pointIndex < ARC_POINTS) {
      this.positionAttr.setXYZ(pointIndex, position.x, position.y, position.z);
      pointIndex++;
    }

    for (let step = 0; step < totalSteps && pointIndex < ARC_POINTS; step++) {
      // Compute acceleration: gravity + wind + magnus
      const accel = GRAVITY_VEC.clone();

      // Wind (only when airborne)
      if (position.y > 0.3) {
        accel.add(windForce);
      }

      // Magnus force (only when airborne and spin is nonzero)
      if (Math.abs(spin) > 0.01 && position.y > 0.3) {
        const speed = velocity.length();
        if (speed > 0.1) {
          const perpX = -velocity.z;
          const perpZ = velocity.x;
          const perpLen = Math.sqrt(perpX * perpX + perpZ * perpZ);
          if (perpLen > 0.001) {
            const scale = mCoeff * spin * speed;
            accel.x += (perpX / perpLen) * scale;
            accel.z += (perpZ / perpLen) * scale;
          }
        }
      }

      // Euler integration
      velocity.add(accel.clone().multiplyScalar(SIM_DT));
      position.add(velocity.clone().multiplyScalar(SIM_DT));
      stepCount++;

      // Ground check
      if (position.y < 0.01 && step > 2) {
        position.y = 0.01;
        if (!landed) {
          landX = position.x;
          landZ = position.z;
          landed = true;
        }
        // Continue a bit on ground to show roll
        velocity.y = 0;
        velocity.multiplyScalar(0.95); // ground friction
      }

      // Store point at intervals
      if (stepCount % pointInterval === 0 || landed) {
        if (pointIndex < ARC_POINTS) {
          this.positionAttr.setXYZ(pointIndex, position.x, position.y, position.z);
          pointIndex++;
        }
        if (landed && velocity.length() < 0.5) break;
      }
    }

    // Fill remaining points at the landing position
    for (let i = pointIndex; i < ARC_POINTS; i++) {
      const lx = landed ? landX : position.x;
      const lz = landed ? landZ : position.z;
      this.positionAttr.setXYZ(i, lx, 0.01, lz);
    }

    if (!landed) {
      landX = position.x;
      landZ = position.z;
    }

    this.positionAttr.needsUpdate = true;

    // Position the landing ring
    this.ring.position.set(landX, 0.02, landZ);
  }

  setVisible(visible: boolean) {
    this.dots.visible = visible;
    this.ring.visible = visible;
  }

  dispose() {
    this.scene.remove(this.dots);
    this.scene.remove(this.ring);
    this.dots.geometry.dispose();
    (this.dots.material as THREE.PointsMaterial).dispose();
    this.ring.geometry.dispose();
    (this.ring.material as THREE.MeshBasicMaterial).dispose();
  }
}
