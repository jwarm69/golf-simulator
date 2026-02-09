import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { PhysicsWorld } from '../core/PhysicsWorld';
import { BALL_RADIUS, BALL_MASS, GRAVITY, SLEEP_SPEED_THRESHOLD, SLEEP_TIME_THRESHOLD } from '../types';

/** Generate a simple procedural environment cube map for reflections */
function createEnvMap(): THREE.CubeTexture {
  const size = 64;
  const faces: HTMLCanvasElement[] = [];

  // Sky blue top, green bottom, gradient sides
  const skyColor = [135, 206, 235];
  const groundColor = [80, 140, 60];
  const horizonColor = [180, 210, 230];

  for (let f = 0; f < 6; f++) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    if (f === 2) {
      // +Y (top) = sky
      ctx.fillStyle = `rgb(${skyColor[0]},${skyColor[1]},${skyColor[2]})`;
      ctx.fillRect(0, 0, size, size);
    } else if (f === 3) {
      // -Y (bottom) = ground
      ctx.fillStyle = `rgb(${groundColor[0]},${groundColor[1]},${groundColor[2]})`;
      ctx.fillRect(0, 0, size, size);
    } else {
      // Sides = gradient from sky to horizon to ground
      const grad = ctx.createLinearGradient(0, 0, 0, size);
      grad.addColorStop(0, `rgb(${skyColor[0]},${skyColor[1]},${skyColor[2]})`);
      grad.addColorStop(0.45, `rgb(${horizonColor[0]},${horizonColor[1]},${horizonColor[2]})`);
      grad.addColorStop(0.55, `rgb(${horizonColor[0]},${horizonColor[1]},${horizonColor[2]})`);
      grad.addColorStop(1, `rgb(${groundColor[0]},${groundColor[1]},${groundColor[2]})`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, size, size);
    }
    faces.push(canvas);
  }

  const cubeTexture = new THREE.CubeTexture(faces);
  cubeTexture.needsUpdate = true;
  return cubeTexture;
}

export class GolfBall {
  mesh: THREE.Mesh;
  body: CANNON.Body;
  private physics: PhysicsWorld;
  private sleepTimer = 0;
  isSleeping = false;
  lastStablePosition = new THREE.Vector3();

  // Cached vectors to avoid per-frame allocations
  private _cachedPosition = new THREE.Vector3();
  private _cachedVelocity = new THREE.Vector3();

  // Landing detection
  private wasAirborne = false;
  private landingEvent = false;

  constructor(scene: THREE.Scene, physics: PhysicsWorld) {
    this.physics = physics;

    // Visual — higher poly sphere with environment map reflections
    const geo = new THREE.SphereGeometry(BALL_RADIUS, 32, 32);
    const envMap = createEnvMap();
    const mat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.15,
      metalness: 0.05,
      envMap,
      envMapIntensity: 0.6,
    });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.castShadow = true;
    scene.add(this.mesh);

    // Physics
    const shape = new CANNON.Sphere(BALL_RADIUS);
    this.body = new CANNON.Body({
      mass: BALL_MASS,
      material: physics.ballMaterial,
      linearDamping: 0.01,  // minimal air drag only
      angularDamping: 0.1,
    });
    this.body.addShape(shape);
    this.body.allowSleep = false; // We handle sleep manually
    physics.addBody(this.body);
  }

  setPosition(x: number, y: number, z: number) {
    this.body.position.set(x, y, z);
    this.body.velocity.setZero();
    this.body.angularVelocity.setZero();
    this.mesh.position.set(x, y, z);
    this.lastStablePosition.set(x, y, z);
    this.isSleeping = false;
    this.sleepTimer = 0;
    this.wasAirborne = false;
    this.landingEvent = false;
  }

  setColor(color: number) {
    (this.mesh.material as THREE.MeshStandardMaterial).color.setHex(color);
  }

  applyShot(direction: THREE.Vector3, power: number) {
    this.isSleeping = false;
    this.sleepTimer = 0;
    this.lastStablePosition.copy(this.mesh.position);
    this.wasAirborne = false;
    this.landingEvent = false;

    const impulse = new CANNON.Vec3(
      direction.x * power,
      direction.y * power,
      direction.z * power
    );
    this.body.applyImpulse(impulse);
  }

  getSpeed(): number {
    return this.body.velocity.length();
  }

  getVelocity(): THREE.Vector3 {
    return this._cachedVelocity.set(
      this.body.velocity.x,
      this.body.velocity.y,
      this.body.velocity.z
    );
  }

  getPosition(): THREE.Vector3 {
    return this._cachedPosition.copy(this.mesh.position);
  }

  isAirborne(): boolean {
    return this.body.position.y > BALL_RADIUS + 0.2;
  }

  consumeLandingEvent(): boolean {
    if (this.landingEvent) {
      this.landingEvent = false;
      return true;
    }
    return false;
  }

  update(dt: number) {
    // Sync mesh to physics body
    this.mesh.position.set(
      this.body.position.x,
      this.body.position.y,
      this.body.position.z
    );
    this.mesh.quaternion.set(
      this.body.quaternion.x,
      this.body.quaternion.y,
      this.body.quaternion.z,
      this.body.quaternion.w
    );

    // Landing detection
    const airborne = this.body.position.y > BALL_RADIUS + 0.5;
    const grounded = this.body.position.y <= BALL_RADIUS + 0.1;
    if (this.wasAirborne && grounded) {
      this.landingEvent = true;
    }
    this.wasAirborne = airborne;

    // Manual sleep detection
    const speed = this.getSpeed();
    if (speed < SLEEP_SPEED_THRESHOLD && this.body.position.y < BALL_RADIUS + 0.1) {
      this.sleepTimer += dt;
      if (this.sleepTimer >= SLEEP_TIME_THRESHOLD) {
        this.isSleeping = true;
        this.body.velocity.setZero();
        this.body.angularVelocity.setZero();
      }
    } else {
      this.sleepTimer = 0;
      this.isSleeping = false;
    }

    // Prevent ball from falling through ground
    if (this.body.position.y < BALL_RADIUS) {
      this.body.position.y = BALL_RADIUS;
      if (this.body.velocity.y < 0) {
        this.body.velocity.y = -this.body.velocity.y * 0.5; // bounce with restitution
        if (Math.abs(this.body.velocity.y) < 0.1) {
          this.body.velocity.y = 0; // kill micro-bounces
        }
      }
    }
  }

  applyRollingResistance(coefficient: number, dt: number) {
    // Only apply when ball is on/near the ground
    if (this.body.position.y > BALL_RADIUS + 0.05) return;

    const vx = this.body.velocity.x;
    const vz = this.body.velocity.z;
    const horizontalSpeed = Math.sqrt(vx * vx + vz * vz);

    if (horizontalSpeed < 0.001) return;

    // Constant deceleration = Crr * g (real rolling resistance model)
    const decel = coefficient * GRAVITY;
    const speedReduction = decel * dt;

    if (speedReduction >= horizontalSpeed) {
      // Would overshoot — just stop the ball
      this.body.velocity.x = 0;
      this.body.velocity.z = 0;
    } else {
      const factor = 1 - speedReduction / horizontalSpeed;
      this.body.velocity.x *= factor;
      this.body.velocity.z *= factor;
    }
  }

  resetToLastStable() {
    this.setPosition(
      this.lastStablePosition.x,
      BALL_RADIUS + 0.01,
      this.lastStablePosition.z
    );
  }
}
