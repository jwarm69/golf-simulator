import * as THREE from 'three';
import { ParticleSystem } from './ParticleSystem';

export class BallTrail {
  private particles: ParticleSystem;
  private airTrail: ParticleSystem;

  constructor(scene: THREE.Scene) {
    this.particles = new ParticleSystem(scene, new THREE.Color(0xffffff));
    this.airTrail = new ParticleSystem(scene, new THREE.Color(0xccddff));
  }

  update(dt: number, ballPos: THREE.Vector3, ballSpeed: number, isRolling: boolean) {
    // Ground roll trail
    if (isRolling && ballSpeed > 2.0) {
      this.particles.emit(ballPos.x, ballPos.y, ballPos.z, 2, {
        lifetime: 0.6,
        alpha: 0.5,
        size: 0.1,
        spreadX: 0.04,
        spreadY: 0.02,
        spreadZ: 0.04,
        vy: 0.1,
      });
    }

    // Air trail when ball is flying fast
    if (!isRolling && ballSpeed > 5.0) {
      this.airTrail.emit(ballPos.x, ballPos.y, ballPos.z, 1, {
        lifetime: 0.4,
        alpha: 0.3,
        size: 0.06,
        spreadX: 0.02,
        spreadY: 0.02,
        spreadZ: 0.02,
      });
    }

    this.particles.update(dt);
    this.airTrail.update(dt);
  }

  dispose(scene: THREE.Scene) {
    this.particles.dispose(scene);
    this.airTrail.dispose(scene);
  }
}
