// Keyboard + mouse state, with edge-triggered "pressed" events and pointer lock.
const SCROLL_KEYS = ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'];
// Movement bindings: each axis lists its negative / positive codes, arrows included.
const MOVE_BINDINGS = {
  x: [['KeyA', 'ArrowLeft'], ['KeyD', 'ArrowRight']],
  y: [['KeyS', 'ArrowDown'], ['KeyW', 'ArrowUp']],
};

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.pressedKeys = new Set();
    this.mouseDX = 0; this.mouseDY = 0;
    this.mouseDown = false; this.mouseClicked = false;
    this.locked = false;
    this.wheel = 0;
    window.addEventListener('keydown', (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      if (!this.keys.has(e.code)) this.pressedKeys.add(e.code);
      this.keys.add(e.code);
      if (SCROLL_KEYS.includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => { this.keys.clear(); this.mouseDown = false; });
    canvas.addEventListener('mousedown', (e) => {
      this.mouseDown = true; this.mouseClicked = true;
      if (!this.locked && e.button === 0) { try { canvas.requestPointerLock(); } catch { /* no lock */ } }
    });
    window.addEventListener('mouseup', () => { this.mouseDown = false; });
    window.addEventListener('mousemove', (e) => {
      if (this.locked || this.mouseDown) { this.mouseDX += e.movementX; this.mouseDY += e.movementY; }
    });
    document.addEventListener('pointerlockchange', () => { this.locked = document.pointerLockElement === canvas; });
    canvas.addEventListener('wheel', (e) => { this.wheel += e.deltaY; e.preventDefault(); }, { passive: false });
  }
  down(code) { return this.keys.has(code); }
  pressed(code) { return this.pressedKeys.has(code); }
  // True if any of the given codes was pressed this frame.
  pressedAny(...codes) { return codes.some((c) => this.pressedKeys.has(c)); }
  // WASD + arrows as axes: x = strafe/right, y = forward.
  axes() {
    const axis = ([neg, pos]) =>
      (neg.some((c) => this.keys.has(c)) ? -1 : 0) + (pos.some((c) => this.keys.has(c)) ? 1 : 0);
    return { x: axis(MOVE_BINDINGS.x), y: axis(MOVE_BINDINGS.y) };
  }
  consumeMouse() { const dx = this.mouseDX, dy = this.mouseDY; this.mouseDX = 0; this.mouseDY = 0; return { dx, dy }; }
  consumeClick() { const c = this.mouseClicked; this.mouseClicked = false; return c; }
  consumeWheel() { const w = this.wheel; this.wheel = 0; return w; }
  // Drop all transient per-frame state (pressed keys, wheel, mouse deltas).
  reset() { this.pressedKeys.clear(); this.wheel = 0; this.mouseDX = 0; this.mouseDY = 0; }
  endFrame() { this.pressedKeys.clear(); this.wheel = 0; }
}
