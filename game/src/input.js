// Keyboard + mouse input. Held keys are tracked by code, pointer-lock
// mouse look accumulates a per-frame delta, and a held-fire flag tells the
// player update when the trigger is down. HUD buttons are plain DOM clicks
// and never reach the canvas handler, so clicking a dialogue or a button
// can never fire the weapon.
const SCROLL_KEYS = ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];

export function makeInput(W) {
  const I = {
    keys: new Set(),
    mouseDown: false,
    mouseDX: 0,
    mouseDY: 0,
    locked: false,
  };

  const canvas = W.canvas;

  function onKey(e, pressed) {
    if (pressed) {
      if (e.repeat) return;
      I.keys.add(e.code);
      if (SCROLL_KEYS.includes(e.code) && (W.state === 'playing' || W.state === 'shop')) {
        // Keep the page from scrolling while playing.
        e.preventDefault();
      }
      W.audio.ensure();
      W.onKeyDown(e.code);
    } else {
      I.keys.delete(e.code);
    }
  }

  window.addEventListener('keydown', (e) => onKey(e, true));
  window.addEventListener('keyup', (e) => onKey(e, false));

  window.addEventListener('blur', () => {
    I.keys.clear();
    I.mouseDown = false;
    // A stale look delta must not swing the camera when the player tabs
    // back in minutes later.
    I.mouseDX = 0;
    I.mouseDY = 0;
  });

  // Same treatment when the tab is hidden: no stuck keys, no stale delta.
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) return;
    I.keys.clear();
    I.mouseDown = false;
    I.mouseDX = 0;
    I.mouseDY = 0;
  });

  canvas.addEventListener('mousedown', (e) => {
    W.audio.ensure();
    if (e.button === 0) {
      I.mouseDown = true;
      W.onCanvasMouseDown(e);
    }
    try {
      if (document.pointerLockElement !== canvas) canvas.requestPointerLock();
    } catch (err) {
      /* pointer lock is optional */
    }
  });

  window.addEventListener('mouseup', (e) => {
    if (e.button === 0) I.mouseDown = false;
  });

  document.addEventListener('pointerlockchange', () => {
    I.locked = document.pointerLockElement === canvas;
  });

  document.addEventListener('mousemove', (e) => {
    if (!I.locked) return;
    I.mouseDX += e.movementX || 0;
    I.mouseDY += e.movementY || 0;
  });

  // Consume the accumulated mouse delta for this frame.
  I.takeMouse = function () {
    const out = { dx: I.mouseDX, dy: I.mouseDY };
    I.mouseDX = 0;
    I.mouseDY = 0;
    return out;
  };

  I.down = function (code) {
    return I.keys.has(code);
  };

  I.any = function (...codes) {
    for (const c of codes) if (I.keys.has(c)) return true;
    return false;
  };

  return I;
}
