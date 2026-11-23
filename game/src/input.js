// Keyboard + mouse input. Tracks held keys by code, pointer-lock mouse
// look, and a held-fire flag for the canvas. HUD buttons are plain DOM
// clicks and never reach the canvas handler, so clicking a dialogue or a
// button can never fire the weapon.
export function makeInput(W) {
  const I = {
    keys: new Set(),
    mouseDown: false,
    mouseDX: 0,
    mouseDY: 0,
    locked: false,
  };

  const canvas = W.canvas;

  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    I.keys.add(e.code);
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
      // Keep the page from scrolling while playing.
      if (W.state === 'playing' || W.state === 'shop') e.preventDefault();
    }
    W.audio.ensure();
    W.onKeyDown(e.code);
  });

  window.addEventListener('keyup', (e) => {
    I.keys.delete(e.code);
  });

  window.addEventListener('blur', () => {
    I.keys.clear();
    I.mouseDown = false;
  });

  canvas.addEventListener('mousedown', (e) => {
    W.audio.ensure();
    if (e.button === 0) {
      I.mouseDown = true;
      W.onCanvasMouseDown(e);
    }
    try {
      if (document.pointerLockElement !== canvas) canvas.requestPointerLock();
    } catch (err) { /* pointer lock is optional */ }
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
    const dx = I.mouseDX, dy = I.mouseDY;
    I.mouseDX = 0; I.mouseDY = 0;
    return { dx, dy };
  };

  I.down = function (code) { return I.keys.has(code); };
  I.any = function (...codes) { return codes.some((c) => I.keys.has(c)); };

  return I;
}
