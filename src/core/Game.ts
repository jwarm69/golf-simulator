import { Renderer } from './Renderer';
import { PhysicsWorld } from './PhysicsWorld';
import { InputManager } from './InputManager';
import { CameraController } from './CameraController';
import { GolfBall } from '../game/GolfBall';
import { Terrain } from '../game/Terrain';
import { HolePin } from '../game/HolePin';
import { ShotController } from '../game/ShotController';
import { TrajectoryPreview } from '../game/TrajectoryPreview';
import { PuttingGuide } from '../game/PuttingGuide';
import { CourseLoader } from '../game/CourseLoader';
import { HUD } from '../ui/HUD';
import { GameState, CourseData, BALL_RADIUS, ZONE_PHYSICS, CLUBS, DEFAULT_CLUB_INDEX, ClubData } from '../types';

const PUTTER_INDEX = CLUBS.findIndex(c => c.name === 'Putter');

export class Game {
  private renderer: Renderer;
  private physics: PhysicsWorld;
  private input: InputManager;
  private cameraController: CameraController;
  private ball: GolfBall;
  private terrain: Terrain;
  private holePin: HolePin;
  private shotController: ShotController;
  private courseLoader: CourseLoader;
  private hud: HUD;

  private state: GameState = 'aiming';
  private shotCount = 0;
  private course: CourseData | null = null;
  private lastTime = 0;

  // Club selection
  private clubIndex = DEFAULT_CLUB_INDEX;
  private currentClub: ClubData = CLUBS[DEFAULT_CLUB_INDEX];

  // Scorecard
  private scorecard: number[] = [];

  // Trajectory preview
  private trajectoryPreview: TrajectoryPreview;

  // Putting
  private puttingGuide: PuttingGuide;
  private prePuttClubIndex = DEFAULT_CLUB_INDEX;

  constructor(canvas: HTMLCanvasElement, hudContainer: HTMLElement) {
    this.renderer = new Renderer(canvas);
    this.physics = new PhysicsWorld();
    this.input = new InputManager(canvas);
    this.cameraController = new CameraController(this.renderer.camera, this.input);
    this.ball = new GolfBall(this.renderer.scene, this.physics);
    this.terrain = new Terrain(this.renderer.scene, this.physics);
    this.holePin = new HolePin(this.renderer.scene);
    this.shotController = new ShotController(
      this.input,
      this.renderer.camera,
      this.cameraController
    );
    this.courseLoader = new CourseLoader();
    this.hud = new HUD(hudContainer);

    // Trajectory preview arc + landing ring
    this.trajectoryPreview = new TrajectoryPreview(this.renderer.scene);

    // Putting guide (ground aim line)
    this.puttingGuide = new PuttingGuide(this.renderer.scene);

    // Mobile club buttons
    this.hud.onClubPrev = () => this.cycleClub(-1);
    this.hud.onClubNext = () => this.cycleClub(1);
  }

  async loadCourse(path: string) {
    this.course = await this.courseLoader.load(path);
    this.terrain.buildFromCourse(this.course);
    this.holePin.place(this.course.hole.x, this.course.hole.z);

    // Place ball at tee
    this.ball.setPosition(this.course.tee.x, BALL_RADIUS + 0.01, this.course.tee.z);

    // Setup HUD
    this.hud.setHoleName(this.course.name);
    this.shotCount = 0;
    this.hud.setShotInfo(this.shotCount, this.course.par);

    // Init default club display
    this.cycleClub(0);

    // Camera initial position
    this.cameraController.setTarget(this.ball.getPosition());
    this.cameraController.setMode('aim');

    this.state = 'aiming';
  }

  start() {
    this.lastTime = performance.now();
    this.loop();
  }

  private loop = () => {
    requestAnimationFrame(this.loop);

    const now = performance.now();
    const dt = Math.min((now - this.lastTime) / 1000, 0.05); // cap at 50ms
    this.lastTime = now;

    this.update(dt);
    this.renderer.render();
  };

  private update(dt: number) {
    if (!this.course) return;

    switch (this.state) {
      case 'aiming':
        this.updateAiming(dt);
        break;
      case 'power':
        this.updatePower(dt);
        break;
      case 'rolling':
        this.updateRolling(dt);
        break;
      case 'stopped':
        this.updateStopped(dt);
        break;
      case 'holed':
        this.updateHoled(dt);
        break;
      case 'putting_aim':
        this.updatePuttingAim(dt);
        break;
      case 'putting_power':
        this.updatePuttingPower(dt);
        break;
    }

    // Update physics and ball
    this.physics.step(dt);
    this.ball.update(dt);

    // Update camera
    this.cameraController.setTarget(this.ball.getPosition());
    this.cameraController.setBallVelocity(this.ball.getVelocity());
    this.cameraController.update();

    // Update distance display
    const ballPos = this.ball.getPosition();
    const holePos = this.holePin.getPosition();
    const dist = Math.sqrt(
      (ballPos.x - holePos.x) ** 2 + (ballPos.z - holePos.z) ** 2
    );
    this.hud.setDistance(dist);

    // Update zone-based friction and rolling resistance
    this.updateZoneFriction(dt);
  }

  private cycleClub(delta: number) {
    this.clubIndex = ((this.clubIndex + delta) % CLUBS.length + CLUBS.length) % CLUBS.length;
    this.currentClub = CLUBS[this.clubIndex];
    this.shotController.setClub(this.currentClub);
    const g = 9.82;
    const maxDist = Math.round(
      (this.currentClub.maxSpeed ** 2 * Math.sin(2 * this.currentClub.loftAngle)) / g
    );
    this.hud.setClub(this.currentClub.name, maxDist);
  }

  private updateAiming(_dt: number) {
    this.hud.showAimHint(true);
    this.hud.showPowerMeter(false);
    this.hud.hideMessage();

    this.cameraController.setMode('aim');

    // Club selection
    if (this.input.consumeKeyPress('q')) this.cycleClub(-1);
    if (this.input.consumeKeyPress('e')) this.cycleClub(1);

    // Show trajectory preview at default power
    const ballPos = this.ball.getPosition();
    const orbitAngle = this.cameraController.getOrbitAngle();
    this.trajectoryPreview.update(ballPos, orbitAngle, null, this.currentClub.loftAngle, this.currentClub.maxSpeed);
    this.trajectoryPreview.setVisible(true);

    // Spacebar to start charging
    if (this.input.consumeSpacePress()) {
      this.state = 'power';
      this.shotController.startCharge();
      this.hud.showPowerMeter(true);
      this.hud.showAimHint(false);
    }
  }

  private updatePower(dt: number) {
    this.shotController.updateCharge(dt);
    this.hud.setPower(this.shotController.power);

    // Update trajectory preview with current power
    const ballPos = this.ball.getPosition();
    const orbitAngle = this.cameraController.getOrbitAngle();
    this.trajectoryPreview.update(ballPos, orbitAngle, this.shotController.power, this.currentClub.loftAngle, this.currentClub.maxSpeed);
    this.trajectoryPreview.setVisible(true);

    // Release spacebar to shoot
    if (this.input.consumeSpaceRelease()) {
      const shot = this.shotController.releaseShot();
      this.ball.applyShot(shot.direction, shot.power);

      this.shotCount++;
      this.hud.setShotInfo(this.shotCount, this.course!.par);
      this.hud.showPowerMeter(false);
      this.trajectoryPreview.setVisible(false);

      this.state = 'rolling';
      this.cameraController.setMode('follow');
    }
  }

  private updateRolling(_dt: number) {
    this.hud.showAimHint(false);
    this.trajectoryPreview.setVisible(false);

    // Check water hazard
    const ballPos = this.ball.getPosition();
    const zone = this.terrain.getZoneAtPosition(ballPos.x, ballPos.z);
    if (zone === 'water') {
      this.ball.resetToLastStable();
      this.shotCount++; // Penalty stroke
      this.hud.setShotInfo(this.shotCount, this.course!.par);
      this.hud.showMessage('Water Hazard!', '+1 stroke penalty');
      setTimeout(() => this.hud.hideMessage(), 2000);
      this.state = 'stopped';
      this.cameraController.setMode('aim');
      return;
    }

    // Check if ball is in hole
    if (this.holePin.checkBallInHole(ballPos.x, ballPos.z, this.ball.getSpeed())) {
      this.state = 'holed';
      this.onHoled();
      return;
    }

    // Check if ball stopped
    if (this.ball.isSleeping) {
      this.state = 'stopped';
    }
  }

  private updateStopped(_dt: number) {
    const ballPos = this.ball.getPosition();
    const zone = this.terrain.getZoneAtPosition(ballPos.x, ballPos.z);

    if (zone === 'green') {
      // Enter putting mode
      this.enterPuttingMode();
    } else {
      this.cameraController.setMode('aim');
      this.state = 'aiming';
    }
  }

  private enterPuttingMode() {
    this.prePuttClubIndex = this.clubIndex;
    this.clubIndex = PUTTER_INDEX;
    this.currentClub = CLUBS[PUTTER_INDEX];
    this.shotController.setClub(this.currentClub);
    this.hud.setClub('Putter', 10);
    this.hud.setPuttingMode(true);
    this.cameraController.setMode('putt');
    this.state = 'putting_aim';
  }

  private exitPuttingMode() {
    this.puttingGuide.setVisible(false);
    this.hud.setPuttingMode(false);
    // Restore previous club
    this.clubIndex = this.prePuttClubIndex;
    this.currentClub = CLUBS[this.clubIndex];
    this.shotController.setClub(this.currentClub);
    this.cycleClub(0); // refresh display
  }

  private updatePuttingAim(_dt: number) {
    this.hud.showAimHint(true);
    this.hud.showPowerMeter(false);
    this.hud.hideMessage();
    this.trajectoryPreview.setVisible(false);

    this.cameraController.setMode('putt');

    // Show putting guide line
    const ballPos = this.ball.getPosition();
    const orbitAngle = this.cameraController.getOrbitAngle();
    this.puttingGuide.update(ballPos, orbitAngle, null);
    this.puttingGuide.setVisible(true);

    // Spacebar to start charging putt
    if (this.input.consumeSpacePress()) {
      this.state = 'putting_power';
      this.shotController.startCharge();
      this.hud.showPowerMeter(true);
      this.hud.showAimHint(false);
    }
  }

  private updatePuttingPower(dt: number) {
    this.shotController.updateCharge(dt);
    this.hud.setPower(this.shotController.power);

    // Update putting guide with current power
    const ballPos = this.ball.getPosition();
    const orbitAngle = this.cameraController.getOrbitAngle();
    this.puttingGuide.update(ballPos, orbitAngle, this.shotController.power);
    this.puttingGuide.setVisible(true);
    this.trajectoryPreview.setVisible(false);

    // Release spacebar to putt
    if (this.input.consumeSpaceRelease()) {
      const shot = this.shotController.releaseShot();
      this.ball.applyShot(shot.direction, shot.power);

      this.shotCount++;
      this.hud.setShotInfo(this.shotCount, this.course!.par);
      this.hud.showPowerMeter(false);
      this.puttingGuide.setVisible(false);

      this.state = 'rolling';
      this.cameraController.setMode('follow');
      this.exitPuttingMode();
    }
  }

  private updateHoled(_dt: number) {
    this.cameraController.setMode('overview');
    this.puttingGuide.setVisible(false);
  }

  private onHoled() {
    const par = this.course!.par;
    const diff = this.shotCount - par;

    let label: string;
    if (this.shotCount === 1) label = 'Hole in One!';
    else if (diff === -2) label = 'Eagle!';
    else if (diff === -1) label = 'Birdie!';
    else if (diff === 0) label = 'Par';
    else if (diff === 1) label = 'Bogey';
    else if (diff === 2) label = 'Double Bogey';
    else label = `+${diff}`;

    this.scorecard.push(this.shotCount);
    this.hud.setScorecard(this.scorecard, par);

    this.hud.showMessage(label, `${this.shotCount} shot${this.shotCount > 1 ? 's' : ''} on a Par ${par}`);
    this.hud.showAimHint(false);

    // Allow restart after delay
    setTimeout(() => {
      this.hud.showMessage(label, `${this.shotCount} shots on a Par ${par}<br>Click to play again`);

      const onClick = () => {
        window.removeEventListener('click', onClick);
        this.restart();
      };
      window.addEventListener('click', onClick);
    }, 2000);
  }

  private restart() {
    if (!this.course) return;
    this.ball.setPosition(this.course.tee.x, BALL_RADIUS + 0.01, this.course.tee.z);
    this.shotCount = 0;
    this.hud.setShotInfo(0, this.course.par);
    this.hud.hideMessage();
    this.clubIndex = DEFAULT_CLUB_INDEX;
    this.cycleClub(0);
    this.state = 'aiming';
    this.cameraController.setMode('aim');
  }

  private updateZoneFriction(dt: number) {
    const pos = this.ball.getPosition();
    const zone = this.terrain.getZoneAtPosition(pos.x, pos.z);
    const mat = this.physics.getMaterialForZone(zone);
    // Change ground material so the ball-ground ContactMaterial lookup matches the zone
    this.physics.groundBody.material = mat;

    // Apply zone-specific rolling resistance (constant deceleration model)
    this.ball.applyRollingResistance(ZONE_PHYSICS[zone].rollingResistance, dt);
  }
}
