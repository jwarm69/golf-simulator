export type GameMode = 'course' | 'range';

export interface IGameMode {
  /** Called when shot is fired */
  onShotFired(): void;
  /** Called when ball stops rolling. Return true to auto-reset ball. */
  onBallStopped(): boolean;
  /** Return true if this mode should skip hole detection in rolling state */
  skipHoleDetection(): boolean;
}
