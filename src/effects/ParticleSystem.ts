import * as THREE from 'three';

const MAX_PARTICLES = 500;
const GRAVITY = -9.82;

interface Particle {
  alive: boolean;
  age: number;
  lifetime: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  alpha: number;
  size: number;
  startSize: number;
  gravity: boolean;
}

export class ParticleSystem {
  private particles: Particle[] = [];
  private points: THREE.Points;
  private positionAttr: THREE.BufferAttribute;
  private alphaAttr: THREE.BufferAttribute;
  private sizeAttr: THREE.BufferAttribute;

  constructor(scene: THREE.Scene, color: THREE.Color = new THREE.Color(0xffffff)) {
    for (let i = 0; i < MAX_PARTICLES; i++) {
      this.particles.push({
        alive: false,
        age: 0,
        lifetime: 1,
        x: 0, y: 0, z: 0,
        vx: 0, vy: 0, vz: 0,
        alpha: 0,
        size: 0.08,
        startSize: 0.08,
        gravity: false,
      });
    }

    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(MAX_PARTICLES * 3);
    const alphas = new Float32Array(MAX_PARTICLES);
    const sizes = new Float32Array(MAX_PARTICLES);

    this.positionAttr = new THREE.BufferAttribute(positions, 3);
    this.alphaAttr = new THREE.BufferAttribute(alphas, 1);
    this.sizeAttr = new THREE.BufferAttribute(sizes, 1);

    geo.setAttribute('position', this.positionAttr);
    geo.setAttribute('alpha', this.alphaAttr);
    geo.setAttribute('size', this.sizeAttr);

    const mat = new THREE.PointsMaterial({
      color,
      size: 0.1,
      transparent: true,
      opacity: 0.7,
      sizeAttenuation: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    scene.add(this.points);
  }

  emit(x: number, y: number, z: number, count: number, config?: {
    lifetime?: number;
    alpha?: number;
    size?: number;
    spreadX?: number;
    spreadY?: number;
    spreadZ?: number;
    vx?: number;
    vy?: number;
    vz?: number;
    color?: THREE.Color;
    gravity?: boolean;
  }) {
    const cfg = config ?? {};
    let emitted = 0;
    for (let i = 0; i < MAX_PARTICLES && emitted < count; i++) {
      const p = this.particles[i];
      if (!p.alive) {
        p.alive = true;
        p.age = 0;
        p.lifetime = cfg.lifetime ?? 0.8;
        p.x = x + (Math.random() - 0.5) * (cfg.spreadX ?? 0.1);
        p.y = y + (Math.random() - 0.5) * (cfg.spreadY ?? 0.1);
        p.z = z + (Math.random() - 0.5) * (cfg.spreadZ ?? 0.1);
        p.vx = (cfg.vx ?? 0) + (Math.random() - 0.5) * 0.3;
        p.vy = (cfg.vy ?? 0) + Math.random() * 0.15;
        p.vz = (cfg.vz ?? 0) + (Math.random() - 0.5) * 0.3;
        p.alpha = cfg.alpha ?? 0.7;
        p.size = cfg.size ?? 0.1;
        p.startSize = p.size;
        p.gravity = cfg.gravity ?? false;
        emitted++;
      }
    }
  }

  update(dt: number) {
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const p = this.particles[i];
      if (!p.alive) {
        this.positionAttr.setXYZ(i, 0, -100, 0);
        this.alphaAttr.setX(i, 0);
        this.sizeAttr.setX(i, 0);
        continue;
      }

      p.age += dt;
      if (p.age >= p.lifetime) {
        p.alive = false;
        this.positionAttr.setXYZ(i, 0, -100, 0);
        this.alphaAttr.setX(i, 0);
        this.sizeAttr.setX(i, 0);
        continue;
      }

      // Apply gravity if enabled
      if (p.gravity) {
        p.vy += GRAVITY * dt * 0.3;
      }

      // Update position
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;

      // Life ratio
      const life = 1 - p.age / p.lifetime;

      // Fade alpha with smooth ease-out
      const currentAlpha = p.alpha * life * life;

      // Shrink size over lifetime
      const currentSize = p.startSize * (0.3 + 0.7 * life);

      this.positionAttr.setXYZ(i, p.x, p.y, p.z);
      this.alphaAttr.setX(i, currentAlpha);
      this.sizeAttr.setX(i, currentSize);
    }

    this.positionAttr.needsUpdate = true;
    this.alphaAttr.needsUpdate = true;
    this.sizeAttr.needsUpdate = true;
  }

  dispose(scene: THREE.Scene) {
    scene.remove(this.points);
    this.points.geometry.dispose();
    (this.points.material as THREE.PointsMaterial).dispose();
  }
}
