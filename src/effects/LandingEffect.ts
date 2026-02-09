import * as THREE from 'three';
import { ParticleSystem } from './ParticleSystem';
import { ZoneType } from '../types';

export class LandingEffect {
  private particles: ParticleSystem;

  constructor(scene: THREE.Scene) {
    this.particles = new ParticleSystem(scene, new THREE.Color(0x88cc88));
  }

  trigger(x: number, y: number, z: number, zone: ZoneType) {
    switch (zone) {
      case 'fairway':
      case 'green':
      case 'tee':
      case 'rough':
        this.particles.emit(x, y, z, 25, {
          lifetime: 0.4,
          alpha: 0.7,
          size: 0.06,
          spreadX: 0.3,
          spreadZ: 0.3,
          vy: 1.5,
          vx: 0,
          vz: 0,
        });
        break;
      case 'sand':
        this.particles.emit(x, y, z, 20, {
          lifetime: 0.6,
          alpha: 0.8,
          size: 0.08,
          spreadX: 0.4,
          spreadZ: 0.4,
          vy: 2.5,
          vx: 0,
          vz: 0,
        });
        break;
      case 'water':
        this.particles.emit(x, y, z, 35, {
          lifetime: 0.5,
          alpha: 0.6,
          size: 0.07,
          spreadX: 0.5,
          spreadZ: 0.5,
          vy: 2.0,
          vx: 0,
          vz: 0,
        });
        break;
    }
  }

  update(dt: number) {
    this.particles.update(dt);
  }

  dispose(scene: THREE.Scene) {
    this.particles.dispose(scene);
  }
}
