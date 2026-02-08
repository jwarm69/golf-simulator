import * as THREE from 'three';

export class InputManager {
  mouseNDC = new THREE.Vector2();
  mouseDown = false;
  keys: Set<string> = new Set();
  private canvas: HTMLCanvasElement;

  // Scroll delta (consumed each frame)
  scrollDelta = 0;

  // Mouse drag deltas
  leftDragDelta = new THREE.Vector2();
  rightDragDelta = new THREE.Vector2();
  private leftDown = false;
  private rightDown = false;
  private lastMouse = new THREE.Vector2();

  // Spacebar edge detection
  spaceDown = false;
  private _spacePressed = false;
  private _spaceReleased = false;

  // Generic key press detection
  private _pressedKeys: Set<string> = new Set();

  // Touch support
  private touchStartX = 0;
  private touchStartY = 0;
  private isTouchDragging = false;
  touchDragDeltaX = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;

    canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
    canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
    canvas.addEventListener('mouseup', (e) => this.onMouseUp(e));
    canvas.addEventListener('wheel', (e) => this.onWheel(e));
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    // Touch events
    canvas.addEventListener('touchstart', (e) => this.onTouchStart(e), { passive: false });
    canvas.addEventListener('touchmove', (e) => this.onTouchMove(e), { passive: false });
    canvas.addEventListener('touchend', (e) => this.onTouchEnd(e), { passive: false });

    window.addEventListener('keydown', (e) => {
      this.keys.add(e.key.toLowerCase());
      this._pressedKeys.add(e.key.toLowerCase());
      if (e.code === 'Space') {
        e.preventDefault();
        if (!this.spaceDown) {
          this.spaceDown = true;
          this._spacePressed = true;
        }
      }
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.key.toLowerCase());
      if (e.code === 'Space') {
        e.preventDefault();
        if (this.spaceDown) {
          this.spaceDown = false;
          this._spaceReleased = true;
        }
      }
    });
  }

  private onMouseMove(e: MouseEvent) {
    this.mouseNDC.x = (e.clientX / window.innerWidth) * 2 - 1;
    this.mouseNDC.y = -(e.clientY / window.innerHeight) * 2 + 1;

    const dx = e.clientX - this.lastMouse.x;
    const dy = e.clientY - this.lastMouse.y;
    if (this.leftDown) {
      this.leftDragDelta.x += dx;
      this.leftDragDelta.y += dy;
    }
    if (this.rightDown) {
      this.rightDragDelta.x += dx;
      this.rightDragDelta.y += dy;
    }
    this.lastMouse.set(e.clientX, e.clientY);
  }

  private onMouseDown(e: MouseEvent) {
    if (e.button === 0) {
      this.mouseDown = true;
      this.leftDown = true;
      this.lastMouse.set(e.clientX, e.clientY);
    }
    if (e.button === 2) {
      this.rightDown = true;
      this.lastMouse.set(e.clientX, e.clientY);
    }
  }

  private onMouseUp(e: MouseEvent) {
    if (e.button === 0) {
      this.mouseDown = false;
      this.leftDown = false;
    }
    if (e.button === 2) this.rightDown = false;
  }

  private onWheel(e: WheelEvent) {
    this.scrollDelta += e.deltaY;
  }

  consumeScrollDelta(): number {
    const d = this.scrollDelta;
    this.scrollDelta = 0;
    return d;
  }

  consumeLeftDragDelta(): THREE.Vector2 {
    const d = this.leftDragDelta.clone();
    this.leftDragDelta.set(0, 0);
    return d;
  }

  consumeRightDragDelta(): THREE.Vector2 {
    const d = this.rightDragDelta.clone();
    this.rightDragDelta.set(0, 0);
    return d;
  }

  consumeSpacePress(): boolean {
    const v = this._spacePressed;
    this._spacePressed = false;
    return v;
  }

  consumeSpaceRelease(): boolean {
    const v = this._spaceReleased;
    this._spaceReleased = false;
    return v;
  }

  consumeKeyPress(key: string): boolean {
    if (this._pressedKeys.has(key)) {
      this._pressedKeys.delete(key);
      return true;
    }
    return false;
  }

  consumeTouchDragDeltaX(): number {
    const d = this.touchDragDeltaX;
    this.touchDragDeltaX = 0;
    return d;
  }

  simulateSpaceTap() {
    this._spacePressed = true;
    this._spaceReleased = true;
    this.spaceDown = false;
  }

  private onTouchStart(e: TouchEvent) {
    e.preventDefault();
    const touch = e.touches[0];
    this.touchStartX = touch.clientX;
    this.touchStartY = touch.clientY;
    this.isTouchDragging = false;
  }

  private onTouchMove(e: TouchEvent) {
    e.preventDefault();
    const touch = e.touches[0];
    const dx = touch.clientX - this.touchStartX;
    this.touchDragDeltaX += dx;
    this.touchStartX = touch.clientX;
    this.touchStartY = touch.clientY;
    if (Math.abs(dx) > 3) this.isTouchDragging = true;
  }

  private onTouchEnd(e: TouchEvent) {
    e.preventDefault();
    // If it was a tap (not a drag), simulate space press+release
    if (!this.isTouchDragging) {
      this.simulateSpaceTap();
    }
    this.isTouchDragging = false;
  }
}
