import * as THREE from 'three';
import { DrivingRange } from './DrivingRange';
import { GolfBall } from './GolfBall';
import { IGameMode } from './GameMode';
import { BALL_RADIUS } from '../types';

export interface RangeStats {
  lastDistance: number;
  lastAccuracy: number | null;
  targetHit: number | null;  // which target distance was hit, or null
  totalShots: number;
  targetsHit: number;
}

export class RangeManager implements IGameMode {
  private range: DrivingRange;
  private ball: GolfBall;
  private resetTimer = 0;
  private waitingToReset = false;
  private stats: RangeStats = {
    lastDistance: 0,
    lastAccuracy: null,
    targetHit: null,
    totalShots: 0,
    targetsHit: 0,
  };

  onStatsUpdate?: (stats: RangeStats) => void;
  onBallReset?: () => void;

  constructor(range: DrivingRange, ball: GolfBall) {
    this.range = range;
    this.ball = ball;
  }

  getStats(): RangeStats {
    return { ...this.stats };
  }

  onShotFired(): void {
    this.stats.totalShots++;
    this.waitingToReset = false;
    this.resetTimer = 0;
  }

  onBallStopped(): boolean {
    // Calculate where ball landed
    const pos = this.ball.getPosition();
    const distance = this.range.getDistanceFromTee(pos.x, pos.z);
    const target = this.range.getClosestTarget(pos.x, pos.z);

    this.stats.lastDistance = Math.round(distance);
    this.stats.targetHit = target ? target.distance : null;
    this.stats.lastAccuracy = target ? Math.round(target.accuracy) : null;

    if (target) {
      this.stats.targetsHit++;
    }

    this.onStatsUpdate?.(this.getStats());

    // Start auto-reset timer
    this.waitingToReset = true;
    this.resetTimer = 0;

    return false; // Don't skip normal stopped → aiming transition
  }

  skipHoleDetection(): boolean {
    return true; // No hole in range mode
  }

  update(dt: number): void {
    if (this.waitingToReset) {
      this.resetTimer += dt;
      if (this.resetTimer >= 2.5) {
        this.resetBall();
        this.waitingToReset = false;
      }
    }
  }

  private resetBall(): void {
    const tee = this.range.teePosition;
    this.ball.setPosition(tee.x, BALL_RADIUS + 0.01, tee.z);
    this.onBallReset?.();
  }

  reset(): void {
    this.stats = {
      lastDistance: 0,
      lastAccuracy: null,
      targetHit: null,
      totalShots: 0,
      targetsHit: 0,
    };
    this.waitingToReset = false;
    this.resetTimer = 0;
    this.resetBall();
  }
}
