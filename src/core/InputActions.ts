import { InputManager } from './InputManager';

export type Action =
  | 'ChargeStart'
  | 'ChargeEnd'
  | 'ClubPrev'
  | 'ClubNext'
  | 'SpinLeft'
  | 'SpinRight'
  | 'MenuToggle'
  | 'Confirm';

export type Axis = 'AimX' | 'AimY' | 'ScrollY';

/**
 * Action-based input layer that wraps InputManager.
 * Both desktop keys and mobile touch/button events map to the same actions.
 * HUD buttons feed actions via the inject* methods.
 */
export class InputActions {
  private input: InputManager;

  // Injected actions from HUD buttons (mobile)
  private injectedSpinLeft = false;
  private injectedSpinRight = false;

  constructor(input: InputManager) {
    this.input = input;
  }

  // --- One-shot actions (consumed on read) ---

  consumeAction(action: Action): boolean {
    switch (action) {
      case 'ChargeStart':
        return this.input.consumeSpacePress();
      case 'ChargeEnd':
        return this.input.consumeSpaceRelease();
      case 'ClubPrev':
        return this.input.consumeKeyPress('q') || this.input.consumeKeyPress('arrowup');
      case 'ClubNext':
        return this.input.consumeKeyPress('e') || this.input.consumeKeyPress('arrowdown');
      case 'MenuToggle':
        return this.input.consumeKeyPress('escape');
      case 'Confirm':
        return this.input.consumeKeyPress('enter');
      case 'SpinLeft':
        return false; // SpinLeft is held, not consumed
      case 'SpinRight':
        return false; // SpinRight is held, not consumed
    }
  }

  // --- Held actions (true while held) ---

  isActionActive(action: Action): boolean {
    switch (action) {
      case 'SpinLeft':
        return this.input.isKeyDown('z') || this.injectedSpinLeft;
      case 'SpinRight':
        return this.input.isKeyDown('c') || this.injectedSpinRight;
      case 'ChargeStart':
        return this.input.spaceDown;
      default:
        return false;
    }
  }

  // --- Axes (continuous values) ---

  getAxisValue(axis: Axis): number {
    switch (axis) {
      case 'AimX': {
        // Keyboard + right-drag + touch-drag all contribute
        let val = 0;
        if (this.input.keys.has('d') || this.input.keys.has('arrowleft')) val -= 0.03;
        if (this.input.keys.has('a') || this.input.keys.has('arrowright')) val += 0.03;
        const drag = this.input.consumeRightDragDelta();
        val += drag.x * 0.005;
        val += this.input.consumeTouchDragDeltaX() * 0.005;
        return val;
      }
      case 'AimY': {
        let val = 0;
        val += this.input.consumeTouchDragDeltaY();
        return val;
      }
      case 'ScrollY':
        return this.input.consumeScrollDelta();
    }
  }

  // --- Injected from HUD buttons ---

  injectSpinLeft(held: boolean) {
    this.injectedSpinLeft = held;
  }

  injectSpinRight(held: boolean) {
    this.injectedSpinRight = held;
  }

  // Pass-through for follow mode left drag
  consumeLeftDragDelta() {
    return this.input.consumeLeftDragDelta();
  }

  // Pass-through for follow mode touch drag (already consumed by AimX/AimY in aim mode)
  consumeTouchDragDeltaX() {
    return this.input.consumeTouchDragDeltaX();
  }

  consumeTouchDragDeltaY() {
    return this.input.consumeTouchDragDeltaY();
  }

  // Direct input access for charge injection from HUD
  startTouchCharge() {
    this.input.startTouchCharge();
  }

  endTouchCharge() {
    this.input.endTouchCharge();
  }
}
