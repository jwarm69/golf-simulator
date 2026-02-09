import * as THREE from 'three';
import { ParticleSystem } from './ParticleSystem';

export class BallTrail {
  private particles: ParticleSystem;

  constructor(scene: THREE.Scene) {
    this.particles = new ParticleSystem(scene, new THREE.Color(0xffffff));
  }

  update(dt: number, ballPos: THREE.Vector3, ballSpeed: number, isRolling: boolean) {
    if (isRolling && ballSpeed > 2.0) {
      this.particles.emit(ballPos.x, ballPos.y, ballPos.z, 1, {
        lifetime: 0.8,
        alpha: 0.6,
        size: 0.08,
        spreadX: 0.05,
        spreadY: 0.02,
        spreadZ: 0.05,
      });
    }
    this.particles.update(dt);
  }

  dispose(scene: THREE.Scene) {
    this.particles.dispose(scene);
  }
}
