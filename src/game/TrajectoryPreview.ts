import * as THREE from 'three';
import { BALL_MASS } from '../types';

const ARC_POINTS = 40;
const GRAVITY = -9.82;
const DEFAULT_POWER_PREVIEW = 0.5;

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
    ringGeo.rotateX(-Math.PI / 2); // lay flat on ground
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

  update(ballPos: THREE.Vector3, orbitAngle: number, power: number | null, loftAngle: number, maxSpeed: number) {
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

    // Initial velocity = direction * (shotPower / BALL_MASS) since impulse = mass * velocity
    const v0x = dir.x * (shotPower / BALL_MASS);
    const v0y = dir.y * (shotPower / BALL_MASS);
    const v0z = dir.z * (shotPower / BALL_MASS);

    // Find total flight time (when y returns to ground level)
    // y(t) = y0 + v0y*t + 0.5*g*t^2 = 0
    // Using quadratic: t = (-v0y - sqrt(v0y^2 + 2*g*y0)) / g
    const y0 = ballPos.y;
    const discriminant = v0y * v0y - 2 * GRAVITY * y0;
    const totalTime = discriminant > 0
      ? (-v0y - Math.sqrt(discriminant)) / GRAVITY
      : (2 * v0y) / -GRAVITY; // fallback: simple symmetric arc

    const tMax = Math.max(totalTime, 0.1);
    const dt = tMax / (ARC_POINTS - 1);

    let landX = ballPos.x;
    let landZ = ballPos.z;
    let foundLanding = false;

    for (let i = 0; i < ARC_POINTS; i++) {
      const t = i * dt;
      const x = ballPos.x + v0x * t;
      let y = y0 + v0y * t + 0.5 * GRAVITY * t * t;
      const z = ballPos.z + v0z * t;

      // Clamp to ground
      if (y < 0.01 && i > 0) {
        y = 0.01;
        if (!foundLanding) {
          // Interpolate exact landing position
          const tPrev = (i - 1) * dt;
          const yPrev = y0 + v0y * tPrev + 0.5 * GRAVITY * tPrev * tPrev;
          const yCurr = y0 + v0y * t + 0.5 * GRAVITY * t * t;
          const frac = yPrev / (yPrev - yCurr);
          const tLand = tPrev + frac * dt;
          landX = ballPos.x + v0x * tLand;
          landZ = ballPos.z + v0z * tLand;
          foundLanding = true;
        }
      }

      this.positionAttr.setXYZ(i, x, y, z);
    }

    if (!foundLanding) {
      // Use last point as landing
      landX = ballPos.x + v0x * tMax;
      landZ = ballPos.z + v0z * tMax;
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
