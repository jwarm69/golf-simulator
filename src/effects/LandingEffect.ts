import * as THREE from 'three';
import { ParticleSystem } from './ParticleSystem';
import { ZoneType } from '../types';

export class LandingEffect {
  private grassParticles: ParticleSystem;
  private sandParticles: ParticleSystem;
  private waterParticles: ParticleSystem;

  constructor(scene: THREE.Scene) {
    this.grassParticles = new ParticleSystem(scene, new THREE.Color(0x88cc88));
    this.sandParticles = new ParticleSystem(scene, new THREE.Color(0xe8d68c));
    this.waterParticles = new ParticleSystem(scene, new THREE.Color(0x66aadd));
  }

  trigger(x: number, y: number, z: number, zone: ZoneType) {
    switch (zone) {
      case 'fairway':
      case 'green':
      case 'tee':
      case 'rough':
        // Grass divot — small chunks flying up
        this.grassParticles.emit(x, y, z, 40, {
          lifetime: 0.6,
          alpha: 0.8,
          size: 0.08,
          spreadX: 0.4,
          spreadZ: 0.4,
          vy: 2.0,
          vx: 0,
          vz: 0,
          gravity: true,
        });
        break;
      case 'sand':
        // Sand explosion — wider cloud
        this.sandParticles.emit(x, y, z, 50, {
          lifetime: 0.8,
          alpha: 0.9,
          size: 0.1,
          spreadX: 0.5,
          spreadZ: 0.5,
          vy: 3.0,
          vx: 0,
          vz: 0,
          gravity: true,
        });
        break;
      case 'water':
        // Water splash — tall narrow burst
        this.waterParticles.emit(x, y, z, 60, {
          lifetime: 0.7,
          alpha: 0.7,
          size: 0.09,
          spreadX: 0.3,
          spreadZ: 0.3,
          vy: 3.5,
          vx: 0,
          vz: 0,
          gravity: true,
        });
        break;
    }
  }

  update(dt: number) {
    this.grassParticles.update(dt);
    this.sandParticles.update(dt);
    this.waterParticles.update(dt);
  }

  dispose(scene: THREE.Scene) {
    this.grassParticles.dispose(scene);
    this.sandParticles.dispose(scene);
    this.waterParticles.dispose(scene);
  }
}
