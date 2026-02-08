import * as THREE from 'three';
import { InputManager } from '../core/InputManager';
import { CameraController } from '../core/CameraController';
import { BALL_MASS, ClubData, CLUBS, DEFAULT_CLUB_INDEX } from '../types';

export class ShotController {
  private input: InputManager;
  private cameraController: CameraController;
  private camera: THREE.PerspectiveCamera;
  private club: ClubData = CLUBS[DEFAULT_CLUB_INDEX];

  // Power meter state
  power = 0;
  private powerDirection = 1;
  private powerSpeed = CLUBS[DEFAULT_CLUB_INDEX].powerSpeed;
  isCharging = false;

  // Aim direction
  aimDirection = new THREE.Vector3(0, 0, -1);

  constructor(
    input: InputManager,
    camera: THREE.PerspectiveCamera,
    cameraController: CameraController
  ) {
    this.input = input;
    this.camera = camera;
    this.cameraController = cameraController;
  }

  setClub(club: ClubData) {
    this.club = club;
    this.powerSpeed = club.powerSpeed;
  }

  startCharge() {
    this.isCharging = true;
    this.power = 0;
    this.powerDirection = 1;
  }

  updateCharge(dt: number) {
    if (!this.isCharging) return;

    this.power += this.powerDirection * this.powerSpeed * dt;
    if (this.power >= 1) {
      this.power = 1;
      this.powerDirection = -1;
    } else if (this.power <= 0) {
      this.power = 0;
      this.powerDirection = 1;
    }
  }

  releaseShot(): { direction: THREE.Vector3; power: number } {
    this.isCharging = false;

    // Aim direction is based on camera orbit angle (where the camera is looking from)
    const angle = this.cameraController.getOrbitAngle();
    // Shoot opposite to where the camera is (camera is behind the ball)
    const dx = -Math.sin(angle);
    const dz = -Math.cos(angle);

    // Apply loft angle
    const horizontalSpeed = Math.cos(this.club.loftAngle);
    const verticalSpeed = Math.sin(this.club.loftAngle);

    const direction = new THREE.Vector3(
      dx * horizontalSpeed,
      verticalSpeed,
      dz * horizontalSpeed
    ).normalize();

    const shotPower = this.power * this.club.maxSpeed * BALL_MASS;

    const result = { direction, power: shotPower };
    this.power = 0;
    return result;
  }

  getAimDirection(): THREE.Vector3 {
    const angle = this.cameraController.getOrbitAngle();
    return new THREE.Vector3(-Math.sin(angle), 0, -Math.cos(angle)).normalize();
  }
}
