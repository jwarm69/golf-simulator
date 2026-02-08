import * as THREE from 'three';
import { InputManager } from './InputManager';

export type CameraMode = 'aim' | 'follow' | 'overview' | 'flyover';

export class CameraController {
  private camera: THREE.PerspectiveCamera;
  private input: InputManager;
  private mode: CameraMode = 'aim';
  private previousMode: CameraMode = 'aim';

  // Orbit parameters (aim mode)
  private orbitAngle = 0; // horizontal angle around ball
  private orbitElevation = 30; // degrees above horizon
  private orbitDistance = 8;

  // Target position to look at / orbit around
  private target = new THREE.Vector3();

  // Follow mode
  private followOffset = new THREE.Vector3(0, 4, 8);
  private ballVelocity = new THREE.Vector3();

  // Flyover mode
  private flyoverTee = new THREE.Vector3();
  private flyoverHole = new THREE.Vector3();
  private flyoverProgress = 0;       // 0 = tee, 1 = hole, then reverses
  private flyoverSpeed = 0.15;       // progress per second
  private flyoverDirection = 1;      // 1 = tee->hole, -1 = hole->tee
  private flyoverHeight = 35;
  private flyoverLateralOffset = 12;

  // Lerp smoothing
  private lerpFactor = 0.08;

  constructor(camera: THREE.PerspectiveCamera, input: InputManager) {
    this.camera = camera;
    this.input = input;
  }

  setMode(mode: CameraMode) {
    if (mode !== 'flyover' && this.mode !== 'flyover') {
      this.previousMode = this.mode;
    }
    this.mode = mode;
    if (mode === 'overview') {
      this.lerpFactor = 0.03;
    } else if (mode === 'flyover') {
      this.lerpFactor = 0.04;
      this.flyoverProgress = 0;
      this.flyoverDirection = 1;
    } else {
      this.lerpFactor = 0.08;
    }
  }

  getMode(): CameraMode {
    return this.mode;
  }

  getPreviousMode(): CameraMode {
    return this.previousMode;
  }

  setHoleEndpoints(tee: { x: number; z: number }, hole: { x: number; z: number }) {
    this.flyoverTee.set(tee.x, 0, tee.z);
    this.flyoverHole.set(hole.x, 0, hole.z);
  }

  isFlyoverComplete(): boolean {
    return this.mode === 'flyover' && this.flyoverDirection === -1 && this.flyoverProgress <= 0;
  }

  setTarget(pos: THREE.Vector3) {
    this.target.copy(pos);
  }

  setBallVelocity(vel: THREE.Vector3) {
    this.ballVelocity.copy(vel);
  }

  getOrbitAngle(): number {
    return this.orbitAngle;
  }

  update(dt?: number) {
    if (this.mode === 'aim') {
      this.updateAim();
    } else if (this.mode === 'follow') {
      this.updateFollow();
    } else if (this.mode === 'overview') {
      this.updateOverview();
    } else if (this.mode === 'flyover') {
      this.updateFlyover(dt ?? 0.016);
    }
  }

  private updateAim() {
    // A/D keys or right-drag or touch-drag to rotate
    if (this.input.keys.has('a')) this.orbitAngle -= 0.03;
    if (this.input.keys.has('d')) this.orbitAngle += 0.03;

    const drag = this.input.consumeRightDragDelta();
    this.orbitAngle += drag.x * 0.005;

    const touchDrag = this.input.consumeTouchDragDeltaX();
    this.orbitAngle += touchDrag * 0.005;

    // Scroll to adjust elevation
    const scroll = this.input.consumeScrollDelta();
    this.orbitElevation = Math.max(10, Math.min(70, this.orbitElevation + scroll * 0.05));

    const elevRad = (this.orbitElevation * Math.PI) / 180;
    const horizontalDist = this.orbitDistance * Math.cos(elevRad);
    const verticalDist = this.orbitDistance * Math.sin(elevRad);

    const desiredPos = new THREE.Vector3(
      this.target.x + Math.sin(this.orbitAngle) * horizontalDist,
      this.target.y + verticalDist,
      this.target.z + Math.cos(this.orbitAngle) * horizontalDist
    );

    this.camera.position.lerp(desiredPos, this.lerpFactor);
    this.camera.lookAt(this.target);
  }

  private updateFollow() {
    // Allow click-and-drag to orbit around the ball while following
    const leftDrag = this.input.consumeLeftDragDelta();
    if (leftDrag.lengthSq() > 0) {
      this.orbitAngle += leftDrag.x * 0.005;
      this.orbitElevation = Math.max(10, Math.min(70, this.orbitElevation - leftDrag.y * 0.2));
    }

    // Scroll to adjust distance/elevation
    const scroll = this.input.consumeScrollDelta();
    this.orbitElevation = Math.max(10, Math.min(70, this.orbitElevation + scroll * 0.05));

    // If ball is moving fast, auto-track behind it; otherwise use manual orbit
    const speed = this.ballVelocity.length();
    if (speed > 1.0 && leftDrag.lengthSq() === 0) {
      // Auto-track: derive orbit angle from ball velocity
      const autoAngle = Math.atan2(this.ballVelocity.x, this.ballVelocity.z);
      // Smoothly blend toward auto angle
      let angleDiff = autoAngle - this.orbitAngle;
      // Normalize to [-PI, PI]
      while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
      while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
      this.orbitAngle += angleDiff * 0.03;
    }

    const elevRad = (this.orbitElevation * Math.PI) / 180;
    const followDist = 8;
    const horizontalDist = followDist * Math.cos(elevRad);
    const verticalDist = followDist * Math.sin(elevRad);

    const desiredPos = new THREE.Vector3(
      this.target.x + Math.sin(this.orbitAngle) * horizontalDist,
      this.target.y + verticalDist,
      this.target.z + Math.cos(this.orbitAngle) * horizontalDist
    );

    this.camera.position.lerp(desiredPos, this.lerpFactor);
    this.camera.lookAt(this.target);
  }

  private updateOverview() {
    const desiredPos = new THREE.Vector3(
      this.target.x,
      this.target.y + 20,
      this.target.z + 15
    );

    this.camera.position.lerp(desiredPos, this.lerpFactor);
    this.camera.lookAt(this.target);
  }

  private updateFlyover(dt: number) {
    // Advance progress along the tee-to-hole path
    this.flyoverProgress += this.flyoverDirection * this.flyoverSpeed * dt;

    if (this.flyoverProgress >= 1) {
      this.flyoverProgress = 1;
      this.flyoverDirection = -1; // reverse back to tee
    } else if (this.flyoverProgress <= 0 && this.flyoverDirection === -1) {
      this.flyoverProgress = 0;
      // Flyover complete — caller will detect via isFlyoverComplete()
    }

    // Smooth easing (ease-in-out)
    const t = this.flyoverProgress;
    const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

    // Interpolate look-at point along tee→hole
    const lookAt = new THREE.Vector3().lerpVectors(this.flyoverTee, this.flyoverHole, eased);

    // Camera direction perpendicular to the tee→hole line (for lateral offset)
    const dir = new THREE.Vector3().subVectors(this.flyoverHole, this.flyoverTee).normalize();
    const lateral = new THREE.Vector3(-dir.z, 0, dir.x); // perpendicular

    // Swing the camera in a gentle arc — offset laterally and high above
    const arcOffset = Math.sin(eased * Math.PI) * this.flyoverLateralOffset;

    const desiredPos = new THREE.Vector3(
      lookAt.x + lateral.x * arcOffset,
      this.flyoverHeight - Math.sin(eased * Math.PI) * 8, // dip lower at midpoint for drama
      lookAt.z + lateral.z * arcOffset
    );

    this.camera.position.lerp(desiredPos, this.lerpFactor);
    this.camera.lookAt(lookAt);
  }
}
