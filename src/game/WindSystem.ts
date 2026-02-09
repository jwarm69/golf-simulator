import * as THREE from 'three';
import { BALL_MASS, MS_TO_MPH } from '../types';

export class WindSystem {
  direction = 0; // radians, 0 = north (+Z direction)
  speed = 0;     // m/s

  generateWind() {
    this.direction = Math.random() * Math.PI * 2;
    // 0-15 mph -> 0-6.7 m/s
    this.speed = Math.random() * 6.7;
  }

  getForce(): THREE.Vector3 {
    const scale = BALL_MASS * 0.5;
    return new THREE.Vector3(
      Math.sin(this.direction) * this.speed * scale,
      0,
      Math.cos(this.direction) * this.speed * scale
    );
  }

  getAcceleration(): THREE.Vector3 {
    return new THREE.Vector3(
      Math.sin(this.direction) * this.speed * 0.5,
      0,
      Math.cos(this.direction) * this.speed * 0.5
    );
  }

  getSpeedMPH(): number {
    return Math.round(this.speed * MS_TO_MPH);
  }

  getDirectionDegrees(): number {
    return (this.direction * 180) / Math.PI;
  }
}
