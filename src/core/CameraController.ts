import * as THREE from 'three';
import { InputManager } from './InputManager';

export type CameraMode = 'aim' | 'follow' | 'overview';

export class CameraController {
  private camera: THREE.PerspectiveCamera;
  private input: InputManager;
  private mode: CameraMode = 'aim';

  // Orbit parameters (aim mode)
  private orbitAngle = 0; // horizontal angle around ball
  private orbitElevation = 30; // degrees above horizon
  private orbitDistance = 8;

  // Target position to look at / orbit around
  private target = new THREE.Vector3();

  // Follow mode
  private followOffset = new THREE.Vector3(0, 4, 8);
  private ballVelocity = new THREE.Vector3();

  // Lerp smoothing
  private lerpFactor = 0.08;

  constructor(camera: THREE.PerspectiveCamera, input: InputManager) {
    this.camera = camera;
    this.input = input;
  }

  setMode(mode: CameraMode) {
    this.mode = mode;
    if (mode === 'overview') {
      this.lerpFactor = 0.03;
    } else {
      this.lerpFactor = 0.08;
    }
  }

  getMode(): CameraMode {
    return this.mode;
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

  update() {
    if (this.mode === 'aim') {
      this.updateAim();
    } else if (this.mode === 'follow') {
      this.updateFollow();
    } else if (this.mode === 'overview') {
      this.updateOverview();
    }
  }

  private updateAim() {
    // A/D keys or right-drag or touch-drag to rotate
    if (this.input.keys.has('a') || this.input.keys.has('arrowleft')) this.orbitAngle -= 0.03;
    if (this.input.keys.has('d') || this.input.keys.has('arrowright')) this.orbitAngle += 0.03;

    const drag = this.input.consumeRightDragDelta();
    this.orbitAngle += drag.x * 0.005;

    const touchDragX = this.input.consumeTouchDragDeltaX();
    const touchDragY = this.input.consumeTouchDragDeltaY();
    this.orbitAngle += touchDragX * 0.005;
    this.orbitElevation = Math.max(10, Math.min(70, this.orbitElevation - touchDragY * 0.15));

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

    const touchDragX = this.input.consumeTouchDragDeltaX();
    const touchDragY = this.input.consumeTouchDragDeltaY();
    if (Math.abs(touchDragX) > 0 || Math.abs(touchDragY) > 0) {
      this.orbitAngle += touchDragX * 0.005;
      this.orbitElevation = Math.max(10, Math.min(70, this.orbitElevation - touchDragY * 0.2));
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
}
