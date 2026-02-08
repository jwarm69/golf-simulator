import { Renderer } from './Renderer';
import { PhysicsWorld } from './PhysicsWorld';
import { InputManager } from './InputManager';
import { CameraController } from './CameraController';
import { GolfBall } from '../game/GolfBall';
import { Terrain } from '../game/Terrain';
import { HolePin } from '../game/HolePin';
import { ShotController } from '../game/ShotController';
import { TrajectoryPreview } from '../game/TrajectoryPreview';
import { CourseLoader } from '../game/CourseLoader';
import { HUD } from '../ui/HUD';
import { Leaderboard } from '../game/Leaderboard';
import {
  GameState, CourseData, BALL_RADIUS, ZONE_PHYSICS, CLUBS,
  DEFAULT_CLUB_INDEX, ClubData, THEME_CONFIGS, CourseTheme,
  GREEN_SPEED_FACTOR, WindData,
} from '../types';

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

  // Multi-hole state
  private holes: CourseData[] = [];
  private currentHoleIndex = 0;
  private scorecard: number[] = [];
  private holePars: number[] = [];
  private waitingForTransition = false;

  // Trajectory preview
  private trajectoryPreview: TrajectoryPreview;

  // Wind
  private currentWind: WindData | null = null;

  // Leaderboard
  private leaderboard: Leaderboard;

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

    // Leaderboard
    this.leaderboard = new Leaderboard();

    // Mobile club buttons
    this.hud.onClubPrev = () => this.cycleClub(-1);
    this.hud.onClubNext = () => this.cycleClub(1);

    // Flyover button
    this.hud.onFlyover = () => this.toggleFlyover();
  }

  async loadCourse(path: string) {
    const course = await this.courseLoader.load(path);
    this.holes = [course];
    this.currentHoleIndex = 0;
    this.scorecard = [];
    this.holePars = [course.par];
    await this.showTransitionThenSetup();
  }

  async loadCourses(paths: string[]) {
    this.holes = await this.courseLoader.loadMultiple(paths);
    this.currentHoleIndex = 0;
    this.scorecard = [];
    this.holePars = this.holes.map(h => h.par);

    // Show hole selection on first load
    const selectedIndex = await this.hud.showHoleSelect(this.holes);
    this.currentHoleIndex = selectedIndex;
    await this.showTransitionThenSetup();
  }

  private async showTransitionThenSetup() {
    const course = this.holes[this.currentHoleIndex];

    // Build the terrain/scene in background so the player sees the course behind the overlay
    this.buildHoleScene(course);

    this.waitingForTransition = true;
    await this.hud.showTransition({
      holeName: course.name,
      holeNumber: this.currentHoleIndex + 1,
      totalHoles: this.holes.length,
      par: course.par,
      sponsor: course.sponsor,
      scorecard: this.scorecard,
      pars: this.holePars,
      greenData: course.green,
      windData: course.wind,
    });
    this.waitingForTransition = false;

    // Now activate gameplay
    this.activateHole(course);
  }

  private buildHoleScene(course: CourseData) {
    this.course = course;
    this.currentWind = course.wind ?? null;

    // Apply theme
    const theme: CourseTheme = course.theme ?? 'meadow';
    this.renderer.applyTheme(THEME_CONFIGS[theme]);

    // Build terrain
    this.terrain.buildFromCourse(course);
    this.holePin.place(course.hole.x, course.hole.z);

    // Place ball at tee
    this.ball.setPosition(course.tee.x, BALL_RADIUS + 0.01, course.tee.z);

    // Camera initial position (overview during transition)
    this.cameraController.setTarget(this.ball.getPosition());
    this.cameraController.setMode('overview');
  }

  private activateHole(course: CourseData) {
    // Setup HUD for active play
    this.hud.setHoleName(course.name);
    this.shotCount = 0;
    this.hud.setShotInfo(this.shotCount, course.par);
    this.hud.setHoleProgress(this.currentHoleIndex + 1, this.holes.length);
    this.hud.setSponsor(course.sponsor);
    this.hud.setWind(this.currentWind);
    this.updateCumulativeDisplay();
    this.hud.setScorecard(this.scorecard, this.holePars);
    this.hud.showGreenRead(null); // hide initially
    this.hud.showFlyoverBtn(true);
    this.hud.setFlyoverActive(false);

    // Set hole endpoints for flyover camera
    this.cameraController.setHoleEndpoints(course.tee, course.hole);

    // Init default club display
    this.clubIndex = DEFAULT_CLUB_INDEX;
    this.cycleClub(0);

    // Camera to aim mode
    this.cameraController.setTarget(this.ball.getPosition());
    this.cameraController.setMode('aim');

    this.state = 'aiming';
  }

  private updateCumulativeDisplay() {
    if (this.scorecard.length === 0) {
      this.hud.setCumulativeScore(0, 0);
      return;
    }
    const totalStrokes = this.scorecard.reduce((a, b) => a + b, 0);
    const totalPar = this.holePars.slice(0, this.scorecard.length).reduce((a, b) => a + b, 0);
    this.hud.setCumulativeScore(totalStrokes, totalPar);
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
    if (!this.course || this.waitingForTransition) return;

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
    }

    // Update physics and ball
    this.physics.step(dt);
    this.ball.update(dt);

    // Update camera
    if (this.cameraController.getMode() !== 'flyover') {
      this.cameraController.setTarget(this.ball.getPosition());
      this.cameraController.setBallVelocity(this.ball.getVelocity());
    }
    this.cameraController.update(dt);

    // Auto-exit flyover when sweep completes
    if (this.cameraController.isFlyoverComplete()) {
      this.exitFlyover();
    }

    // Update distance display
    const ballPos = this.ball.getPosition();
    const holePos = this.holePin.getPosition();
    const dist = Math.sqrt(
      (ballPos.x - holePos.x) ** 2 + (ballPos.z - holePos.z) ** 2
    );
    this.hud.setDistance(dist);

    // Apply wind force during flight
    if (this.currentWind && this.state === 'rolling') {
      this.ball.applyWindForce(
        this.currentWind.direction,
        this.currentWind.speed,
        this.currentWind.gustVariance ?? 0,
        dt
      );
    }

    // Update zone-based friction, rolling resistance, and green slope
    this.updateZonePhysics(dt);
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
    // Handle flyover mode — don't process aiming while in flyover
    if (this.cameraController.getMode() === 'flyover') {
      // Allow F key or space to exit flyover early
      if (this.input.consumeKeyPress('f') || this.input.consumeSpacePress()) {
        this.exitFlyover();
      }
      // Consume other inputs so they don't queue up
      this.input.consumeSpaceRelease();
      return;
    }

    this.hud.showAimHint(true);
    this.hud.showPowerMeter(false);
    this.hud.hideMessage();

    this.cameraController.setMode('aim');

    // Club selection
    if (this.input.consumeKeyPress('q')) this.cycleClub(-1);
    if (this.input.consumeKeyPress('e')) this.cycleClub(1);

    // F key to trigger flyover
    if (this.input.consumeKeyPress('f')) {
      this.toggleFlyover();
      return;
    }

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
    this.cameraController.setMode('aim');
    this.state = 'aiming';
  }

  private updateHoled(_dt: number) {
    this.cameraController.setMode('overview');
    this.hud.showGreenRead(null);
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
    this.hud.setScorecard(this.scorecard, this.holePars);
    this.updateCumulativeDisplay();

    const hasNextHole = this.currentHoleIndex < this.holes.length - 1;

    // Build cumulative score line
    const totalStrokes = this.scorecard.reduce((a, b) => a + b, 0);
    const totalPar = this.holePars.slice(0, this.scorecard.length).reduce((a, b) => a + b, 0);
    const totalDiff = totalStrokes - totalPar;
    const totalLabel = totalDiff === 0 ? 'Even' : (totalDiff > 0 ? `+${totalDiff}` : `${totalDiff}`);
    const scoreLine = this.holes.length > 1
      ? `<br>Round: ${totalStrokes} strokes (${totalLabel})`
      : '';

    if (hasNextHole) {
      this.hud.showMessage(
        label,
        `${this.shotCount} shot${this.shotCount > 1 ? 's' : ''} on a Par ${par}${scoreLine}`
      );
    } else if (this.holes.length > 1) {
      this.hud.showMessage(
        label,
        `${this.shotCount} shot${this.shotCount > 1 ? 's' : ''} on a Par ${par}`
          + `<br>Round complete! Final: ${totalStrokes} strokes (${totalLabel})`
      );
    } else {
      this.hud.showMessage(
        label,
        `${this.shotCount} shot${this.shotCount > 1 ? 's' : ''} on a Par ${par}`
      );
    }

    this.hud.showAimHint(false);
    this.hud.showFlyoverBtn(false);

    // Save to leaderboard when all holes are done
    if (!hasNextHole) {
      this.leaderboard.saveRound({
        playerName: 'Player',
        holeScores: [...this.scorecard],
        totalStrokes,
        totalPar,
        date: new Date().toISOString(),
        courseName: this.holes.map(h => h.name).join(' + '),
      });
      this.hud.setLeaderboard(this.leaderboard.getTopEntries(10));
    }

    // After a delay, show next-hole transition or restart prompt
    setTimeout(() => {
      if (hasNextHole) {
        this.advanceToNextHole();
      } else {
        // Add "click to play again" to the existing message
        const replayMsg = this.holes.length > 1
          ? `${this.shotCount} shot${this.shotCount > 1 ? 's' : ''} on a Par ${par}<br>Round complete! Final: ${totalStrokes} strokes (${totalLabel})<br>Click to play again`
          : `${this.shotCount} shot${this.shotCount > 1 ? 's' : ''} on a Par ${par}<br>Click to play again`;
        this.hud.showMessage(label, replayMsg);

        const onClick = () => {
          window.removeEventListener('click', onClick);
          this.restartRound();
        };
        window.addEventListener('click', onClick);
      }
    }, 2500);
  }

  private async advanceToNextHole() {
    this.currentHoleIndex++;
    this.holePin.clear();
    this.hud.hideMessage();
    await this.showTransitionThenSetup();
  }

  private async restartRound() {
    this.currentHoleIndex = 0;
    this.scorecard = [];
    this.holePin.clear();
    this.hud.hideMessage();
    this.hud.hideLeaderboard();

    // Show hole select again
    const selectedIndex = await this.hud.showHoleSelect(this.holes);
    this.currentHoleIndex = selectedIndex;
    await this.showTransitionThenSetup();
  }

  private toggleFlyover() {
    if (this.state !== 'aiming') return;
    if (this.cameraController.getMode() === 'flyover') {
      this.exitFlyover();
    } else {
      this.cameraController.setMode('flyover');
      this.hud.setFlyoverActive(true);
      this.hud.showAimHint(false);
      this.trajectoryPreview.setVisible(false);
    }
  }

  private exitFlyover() {
    this.cameraController.setTarget(this.ball.getPosition());
    this.cameraController.setMode('aim');
    this.hud.setFlyoverActive(false);
    this.hud.showAimHint(true);
  }

  private updateZonePhysics(dt: number) {
    const pos = this.ball.getPosition();
    const zone = this.terrain.getZoneAtPosition(pos.x, pos.z);
    const mat = this.physics.getMaterialForZone(zone);
    this.physics.groundBody.material = mat;

    // Green-specific physics
    if (zone === 'green' && this.course?.green) {
      const greenData = this.course.green;
      // Use green speed for rolling resistance instead of default
      const greenRR = GREEN_SPEED_FACTOR[greenData.speed] ?? ZONE_PHYSICS.green.rollingResistance;
      this.ball.applyRollingResistance(greenRR, dt);
      // Apply slope/break force
      this.ball.applySlopeForce(greenData.slopeAngle, greenData.slopeStrength, dt);
      // Show green read HUD
      this.hud.showGreenRead(greenData);
    } else {
      this.ball.applyRollingResistance(ZONE_PHYSICS[zone].rollingResistance, dt);
      this.hud.showGreenRead(null);
    }
  }
}
