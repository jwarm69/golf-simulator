import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { PhysicsWorld } from '../core/PhysicsWorld';
import { BALL_RADIUS, BALL_MASS, SLEEP_SPEED_THRESHOLD, SLEEP_TIME_THRESHOLD } from '../types';

export class GolfBall {
  mesh: THREE.Mesh;
  body: CANNON.Body;
  private physics: PhysicsWorld;
  private sleepTimer = 0;
  isSleeping = false;
  lastStablePosition = new THREE.Vector3();

  // Landing detection
  private wasAirborne = false;
  private landingEvent = false;

  constructor(scene: THREE.Scene, physics: PhysicsWorld) {
    this.physics = physics;

    // Visual
    const geo = new THREE.SphereGeometry(BALL_RADIUS, 16, 16);
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3, metalness: 0.1 });
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
    return new THREE.Vector3(
      this.body.velocity.x,
      this.body.velocity.y,
      this.body.velocity.z
    );
  }

  getPosition(): THREE.Vector3 {
    return this.mesh.position.clone();
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
    const decel = coefficient * 9.82;
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
