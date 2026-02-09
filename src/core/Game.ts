import * as THREE from 'three';
import * as CANNON from 'cannon-es';
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
import { WindSystem } from '../game/WindSystem';
import { SpinSystem } from '../game/SpinSystem';
import { MultiplayerManager } from '../game/MultiplayerManager';
import { BallTrail } from '../effects/BallTrail';
import { LandingEffect } from '../effects/LandingEffect';
import { HUD, HoleOption } from '../ui/HUD';
import { Minimap } from '../ui/Minimap';
import {
  GameState, CourseData, BALL_RADIUS, ZONE_PHYSICS, CLUBS, DEFAULT_CLUB_INDEX, ClubData,
  ThemeName, THEME_COLORS, ZONE_COLORS,
} from '../types';

const HOLES: HoleOption[] = [
  { path: '/courses/course-01.json', name: 'The Meadow - Hole 1', par: 3 },
  { path: '/courses/course-02.json', name: 'Lakeside - Hole 2', par: 4 },
  { path: '/courses/course-03.json', name: 'Pine Valley - Hole 3', par: 5 },
  { path: '/courses/course-04.json', name: 'Scorched Sands - Hole 4', par: 3 },
  { path: '/courses/course-05.json', name: 'Frozen Fjord - Hole 5', par: 3 },
  { path: '/courses/course-06.json', name: 'Lava Links - Hole 6', par: 4 },
  { path: '/courses/course-07.json', name: 'Paradise Cove - Hole 7', par: 4 },
  { path: '/courses/course-08.json', name: 'Red Rock Canyon - Hole 8', par: 5 },
  { path: '/courses/course-09.json', name: 'Lunar Landing - Hole 9', par: 4 },
];

const BEST_SCORES_KEY = 'golf-best-scores';

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
  private elapsedTime = 0;

  // Club selection
  private clubIndex = DEFAULT_CLUB_INDEX;
  private currentClub: ClubData = CLUBS[DEFAULT_CLUB_INDEX];

  // Scorecard (tracks all holes played)
  private scorecard: { hole: string; strokes: number; par: number }[] = [];

  // Trajectory preview
  private trajectoryPreview: TrajectoryPreview;

  // Current hole index
  private currentHoleIndex = 0;

  // Wind system
  private wind: WindSystem;

  // Spin system
  private spin: SpinSystem;

  // Minimap
  private minimap: Minimap;

  // Effects
  private ballTrail: BallTrail;
  private landingEffect: LandingEffect;

  // Multiplayer
  private multiplayer: MultiplayerManager;

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

    // Wind & Spin
    this.wind = new WindSystem();
    this.spin = new SpinSystem();

    // Minimap
    this.minimap = new Minimap(document.body);

    // Effects
    this.ballTrail = new BallTrail(this.renderer.scene);
    this.landingEffect = new LandingEffect(this.renderer.scene);

    // Multiplayer
    this.multiplayer = new MultiplayerManager();

    // Club buttons (work on both mobile and desktop)
    this.hud.onClubPrev = () => this.cycleClub(-1);
    this.hud.onClubNext = () => this.cycleClub(1);

    // Hole selection callback
    this.hud.onHoleSelect = (path: string) => {
      const idx = HOLES.findIndex((h) => h.path === path);
      if (idx >= 0) this.currentHoleIndex = idx;
      this.multiplayer.reset();
      this.scorecard = [];
      this.loadCourse(path);
    };

    // Multiplayer setup callback
    this.hud.onMultiplayerSetup = (names: string[]) => {
      this.multiplayer.setup(names);
      this.scorecard = [];
      this.currentHoleIndex = 0;
      this.loadCourse(HOLES[0].path);
    };

    // Single player / back button
    this.hud.onSinglePlayer = () => {
      this.multiplayer.reset();
      this.showHoleSelection();
    };
  }

  async loadCourse(path: string) {
    this.course = await this.courseLoader.load(path);

    // Apply theme colors
    const theme = (this.course.theme ?? 'meadow') as ThemeName;
    const themeColors = THEME_COLORS[theme] ?? THEME_COLORS.meadow;
    this.terrain.setZoneColors(themeColors.zones);
    this.renderer.setFogColor(themeColors.fog);
    this.minimap.setZoneColors(themeColors.zones);

    this.terrain.buildFromCourse(this.course);
    this.holePin.place(this.course.hole.x, this.course.hole.z);

    // Place ball at tee
    this.ball.setPosition(this.course.tee.x, BALL_RADIUS + 0.01, this.course.tee.z);

    // Setup HUD
    this.hud.setHoleName(this.course.name);
    this.shotCount = 0;
    this.hud.setShotInfo(this.shotCount, this.course.par);

    // Init default club display
    this.clubIndex = DEFAULT_CLUB_INDEX;
    this.cycleClub(0);

    // Camera initial position
    this.cameraController.setTarget(this.ball.getPosition());
    this.cameraController.setMode('aim');

    // Generate wind for this hole
    this.wind.generateWind();
    this.hud.setWind(this.wind.getDirectionDegrees(), this.wind.getSpeedMPH());

    // Reset spin
    this.spin.reset();
    this.hud.setSpin(this.spin.getLabel());

    // Setup minimap
    this.minimap.setCourse(
      this.terrain.getZoneBounds(),
      this.course.tee,
      this.course.hole
    );

    // Multiplayer: start new hole
    if (this.multiplayer.enabled) {
      const teePos = new THREE.Vector3(this.course.tee.x, BALL_RADIUS + 0.01, this.course.tee.z);
      this.multiplayer.startNewHole(teePos);
      const player = this.multiplayer.getCurrentPlayer();
      if (player) {
        this.ball.setColor(player.color);
        this.hud.setTurnBanner(`${player.name}'s Turn`, '#' + player.color.toString(16).padStart(6, '0'));
      }
    } else {
      this.ball.setColor(0xffffff);
    }

    this.state = 'aiming';
    this.hud.hideMessage();
  }

  showHoleSelection() {
    // Load personal bests
    const bestScores = this.loadBestScores();
    const holesWithBest = HOLES.map(h => ({
      ...h,
      best: bestScores[h.path],
    }));
    this.hud.showHoleSelect(holesWithBest);
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
    this.elapsedTime += dt;

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

    // Update water animation
    this.terrain.updateWaterTime(this.elapsedTime);

    // Update minimap
    this.minimap.update({ x: ballPos.x, z: ballPos.z });

    // Update effects
    this.ballTrail.update(dt, ballPos, this.ball.getSpeed(), this.state === 'rolling');
    this.landingEffect.update(dt);
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

  private updateAiming(dt: number) {
    this.hud.showAimHint(true);
    this.hud.showPowerMeter(false);
    this.hud.hideMessage();

    this.cameraController.setMode('aim');

    // Club selection via keyboard
    if (this.input.consumeKeyPress('q')) this.cycleClub(-1);
    if (this.input.consumeKeyPress('e')) this.cycleClub(1);

    // Spin adjustment via Z/C keys (held)
    this.spin.adjustSpin(dt, this.input.isKeyDown('z'), this.input.isKeyDown('c'));
    this.hud.setSpin(this.spin.getLabel());

    // Show trajectory preview at default power with wind + spin
    const ballPos = this.ball.getPosition();
    const orbitAngle = this.cameraController.getOrbitAngle();
    const windAccel = this.wind.getAcceleration();
    this.trajectoryPreview.update(
      ballPos, orbitAngle, null,
      this.currentClub.loftAngle, this.currentClub.maxSpeed,
      windAccel, this.spin.spinAmount
    );
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

    // Continue spin adjustment during power
    this.spin.adjustSpin(dt, this.input.isKeyDown('z'), this.input.isKeyDown('c'));
    this.hud.setSpin(this.spin.getLabel());

    // Update trajectory preview with current power + wind + spin
    const ballPos = this.ball.getPosition();
    const orbitAngle = this.cameraController.getOrbitAngle();
    const windAccel = this.wind.getAcceleration();
    this.trajectoryPreview.update(
      ballPos, orbitAngle, this.shotController.power,
      this.currentClub.loftAngle, this.currentClub.maxSpeed,
      windAccel, this.spin.spinAmount
    );
    this.trajectoryPreview.setVisible(true);

    // Release spacebar to shoot
    if (this.input.consumeSpaceRelease()) {
      const shot = this.shotController.releaseShot();
      this.ball.applyShot(shot.direction, shot.power);

      this.shotCount++;
      if (this.multiplayer.enabled) {
        this.multiplayer.incrementShot();
      }
      this.hud.setShotInfo(this.shotCount, this.course!.par);
      this.hud.showPowerMeter(false);
      this.trajectoryPreview.setVisible(false);

      // Reset spin after shot
      this.spin.reset();
      this.hud.setSpin(this.spin.getLabel());

      this.state = 'rolling';
      this.cameraController.setMode('follow');
    }
  }

  private updateRolling(dt: number) {
    this.hud.showAimHint(false);
    this.trajectoryPreview.setVisible(false);

    const ballPos = this.ball.getPosition();

    // Apply wind force when airborne
    if (this.ball.isAirborne()) {
      const windForce = this.wind.getForce();
      this.ball.body.applyForce(new CANNON.Vec3(windForce.x, 0, windForce.z));
      // Apply Magnus force when airborne
      const magnusForce = this.spin.getMagnusForce(this.ball.getVelocity());
      if (magnusForce.lengthSq() > 0) {
        this.ball.body.applyForce(new CANNON.Vec3(magnusForce.x, 0, magnusForce.z));
      }
    }

    // Check landing effects
    if (this.ball.consumeLandingEvent()) {
      const zone = this.terrain.getZoneAtPosition(ballPos.x, ballPos.z);
      this.landingEffect.trigger(ballPos.x, ballPos.y, ballPos.z, zone);
    }

    // Check water hazard
    const zone = this.terrain.getZoneAtPosition(ballPos.x, ballPos.z);
    if (zone === 'water') {
      this.ball.resetToLastStable();
      this.shotCount++; // Penalty stroke
      if (this.multiplayer.enabled) {
        this.multiplayer.incrementShot();
      }
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

    if (this.multiplayer.enabled) {
      // Save current player's ball position
      this.multiplayer.saveBallPosition(this.ball.getPosition());

      // Switch to next player
      const nextPlayer = this.multiplayer.nextPlayer();
      if (nextPlayer) {
        this.ball.setPosition(
          nextPlayer.ballPosition.x,
          nextPlayer.ballPosition.y,
          nextPlayer.ballPosition.z
        );
        this.ball.setColor(nextPlayer.color);
        this.shotCount = nextPlayer.shotCount;
        this.hud.setShotInfo(this.shotCount, this.course!.par);
        this.hud.setTurnBanner(
          `${nextPlayer.name}'s Turn`,
          '#' + nextPlayer.color.toString(16).padStart(6, '0')
        );
      }
    }

    this.state = 'aiming';
  }

  private updateHoled(_dt: number) {
    this.cameraController.setMode('overview');
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

    // Handle multiplayer holed out
    if (this.multiplayer.enabled) {
      this.multiplayer.markHoledOut();

      if (!this.multiplayer.allHoledOut()) {
        // Not everyone has holed out yet, switch to next player
        this.hud.showMessage(label, `${this.multiplayer.getCurrentPlayer()?.name}: ${this.shotCount} shots`);
        setTimeout(() => {
          this.hud.hideMessage();
          const nextPlayer = this.multiplayer.nextPlayer();
          if (nextPlayer) {
            this.ball.setPosition(
              nextPlayer.ballPosition.x,
              nextPlayer.ballPosition.y,
              nextPlayer.ballPosition.z
            );
            this.ball.setColor(nextPlayer.color);
            this.shotCount = nextPlayer.shotCount;
            this.hud.setShotInfo(this.shotCount, this.course!.par);
            this.hud.setTurnBanner(
              `${nextPlayer.name}'s Turn`,
              '#' + nextPlayer.color.toString(16).padStart(6, '0')
            );
            this.state = 'aiming';
            this.cameraController.setMode('aim');
          }
        }, 2000);
        return;
      }

      // All players holed out — show multiplayer scorecard and advance
      this.scorecard.push({
        hole: this.course!.name.split(' - ')[1] || this.course!.name,
        strokes: this.shotCount,
        par,
      });
      this.hud.setMultiplayerScorecard(
        this.multiplayer.players.map(p => ({ name: p.name, scores: p.scores, color: p.color })),
        HOLES.slice(0, this.currentHoleIndex + 1).map(h => h.par)
      );
    } else {
      this.scorecard.push({
        hole: this.course!.name.split(' - ')[1] || this.course!.name,
        strokes: this.shotCount,
        par,
      });
      this.hud.setScorecard(this.scorecard);
    }

    // Personal best (single player only)
    let isNewBest = false;
    if (!this.multiplayer.enabled) {
      const bestScores = this.loadBestScores();
      const currentPath = HOLES[this.currentHoleIndex].path;
      const prevBest = bestScores[currentPath];
      if (prevBest === undefined || this.shotCount < prevBest) {
        bestScores[currentPath] = this.shotCount;
        this.saveBestScores(bestScores);
        isNewBest = true;
      }
    }

    let subText = `${this.shotCount} shot${this.shotCount > 1 ? 's' : ''} on a Par ${par}`;
    if (isNewBest) {
      subText = 'NEW BEST!<br>' + subText;
    }
    this.hud.showMessage(label, subText);
    this.hud.showAimHint(false);

    // After delay, offer next hole or replay
    setTimeout(() => {
      const nextHoleIndex = this.currentHoleIndex + 1;
      const hasNextHole = nextHoleIndex < HOLES.length;

      // Check if this was the last hole — show round summary
      if (!hasNextHole) {
        if (this.multiplayer.enabled) {
          this.hud.showRoundSummary(
            this.scorecard,
            undefined,
            this.multiplayer.players.map(p => ({ name: p.name, scores: p.scores, color: p.color }))
          );
        } else {
          const bestScores = this.loadBestScores();
          let bestTotal: number | undefined;
          const allBests = HOLES.map(h => bestScores[h.path]);
          if (allBests.every(b => b !== undefined)) {
            bestTotal = allBests.reduce((a, b) => a! + b!, 0) as number;
          }
          this.hud.showRoundSummary(this.scorecard, bestTotal);
        }
        this.hud.hideMessage();
        return;
      }

      let msgSub = `${this.shotCount} shots on a Par ${par}<br>`;
      if (isNewBest) msgSub = 'NEW BEST!<br>' + msgSub;
      msgSub += 'Click for next hole  |  Press H for hole select';

      this.hud.showMessage(label, msgSub);

      const onClick = () => {
        window.removeEventListener('click', onClick);
        window.removeEventListener('keydown', onKey);
        this.currentHoleIndex = nextHoleIndex;
        this.loadCourse(HOLES[nextHoleIndex].path);
      };

      const onKey = (e: KeyboardEvent) => {
        if (e.key.toLowerCase() === 'h') {
          window.removeEventListener('click', onClick);
          window.removeEventListener('keydown', onKey);
          this.multiplayer.reset();
          this.showHoleSelection();
        }
      };

      window.addEventListener('click', onClick);
      window.addEventListener('keydown', onKey);
    }, 2000);
  }

  private updateZoneFriction(dt: number) {
    const pos = this.ball.getPosition();
    const zone = this.terrain.getZoneAtPosition(pos.x, pos.z);
    const mat = this.physics.getMaterialForZone(zone);
    this.physics.groundBody.material = mat;
    this.ball.applyRollingResistance(ZONE_PHYSICS[zone].rollingResistance, dt);
  }

  private loadBestScores(): Record<string, number> {
    try {
      const raw = localStorage.getItem(BEST_SCORES_KEY);
      if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return {};
  }

  private saveBestScores(scores: Record<string, number>) {
    try {
      localStorage.setItem(BEST_SCORES_KEY, JSON.stringify(scores));
    } catch { /* ignore */ }
  }
}
