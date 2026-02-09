import * as THREE from 'three';
import { BALL_MASS } from '../types';

export class SpinSystem {
  spinAmount = 0; // -1 (draw/left) to +1 (fade/right)
  private readonly spinRate = 2.0; // how fast spin changes per second
  private readonly magnusCoeff = 0.3;

  adjustSpin(dt: number, drawKey: boolean, fadeKey: boolean) {
    if (drawKey) {
      this.spinAmount = Math.max(-1, this.spinAmount - this.spinRate * dt);
    }
    if (fadeKey) {
      this.spinAmount = Math.min(1, this.spinAmount + this.spinRate * dt);
    }
  }

  reset() {
    this.spinAmount = 0;
  }

  getMagnusForce(velocity: THREE.Vector3): THREE.Vector3 {
    if (Math.abs(this.spinAmount) < 0.01) return new THREE.Vector3();

    const speed = velocity.length();
    if (speed < 0.1) return new THREE.Vector3();

    // cross((0,1,0), (vx,vy,vz)) = (-vz, 0, vx) — perpendicular horizontal force
    const perpX = -velocity.z;
    const perpZ = velocity.x;
    const perpLen = Math.sqrt(perpX * perpX + perpZ * perpZ);
    if (perpLen < 0.001) return new THREE.Vector3();

    const scale = this.magnusCoeff * this.spinAmount * speed * BALL_MASS;
    return new THREE.Vector3(
      (perpX / perpLen) * scale,
      0,
      (perpZ / perpLen) * scale
    );
  }

  getLabel(): string {
    if (this.spinAmount < -0.1) return 'DRAW \u2190';
    if (this.spinAmount > 0.1) return '\u2192 FADE';
    return 'STRAIGHT';
  }
}
