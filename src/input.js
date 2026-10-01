export const YAW_LIMIT = 1.2;
export const PITCH_MIN = -0.5;
export const PITCH_MAX = 0.2;
const SENSITIVITY = 0.0022;
// Touch drag: radians of aim per pixel, scaled so a full-width swipe sweeps most of the arc.
const TOUCH_SWEEP = 2.0;

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export const isTouchDevice = () =>
  window.matchMedia?.('(hover: none) and (pointer: coarse)').matches ?? false;

// Mouse aiming. Uses pointer lock when the browser allows it, otherwise
// falls back to "absolute" mode where the cursor position maps to the aim.
// On touch screens it switches to "touch" mode: drag to aim, on-screen fire button.
export class Input {
  constructor(dom) {
    this.dom = dom;
    this.yaw = 0;
    this.pitch = -0.12;
    this.firing = false;
    this.locked = false;
    this.mode = 'lock';
    this.everLocked = false;
    this.onLockChange = null;
    this.onLockError = null;
    this.onTouchMode = null;
    this.mouseDown = false;
    this.spaceDown = false;
    this.touchFire = false;
    this.aimId = null;
    this.aimX = 0;
    this.aimY = 0;

    document.addEventListener('mousemove', (e) => {
      if (this.mode === 'touch') return;
      if (this.mode === 'lock') {
        if (!this.locked) return;
        this.aim(-e.movementX * SENSITIVITY, -e.movementY * SENSITIVITY);
      } else {
        const nx = (e.clientX / window.innerWidth) * 2 - 1;
        const ny = (e.clientY / window.innerHeight) * 2 - 1;
        this.yaw = -nx * YAW_LIMIT;
        this.pitch = clamp(-ny * 0.45 - 0.12, PITCH_MIN, PITCH_MAX);
      }
    });
    document.addEventListener('mousedown', (e) => {
      if (this.mode === 'touch') return;
      if (e.button === 0) this.mouseDown = true;
      this.update();
    });
    document.addEventListener('mouseup', (e) => {
      if (this.mode === 'touch') return;
      if (e.button === 0) this.mouseDown = false;
      this.update();
    });
    document.addEventListener('keydown', (e) => {
      if (e.code === 'Space') {
        this.spaceDown = true;
        e.preventDefault();
      }
      this.update();
    });
    document.addEventListener('keyup', (e) => {
      if (e.code === 'Space') this.spaceDown = false;
      this.update();
    });
    window.addEventListener('blur', () => {
      this.mouseDown = this.spaceDown = this.touchFire = false;
      this.aimId = null;
      this.update();
    });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.dom;
      if (this.locked) this.everLocked = true;
      if (!this.locked) this.mouseDown = false;
      this.update();
      this.onLockChange?.(this.locked);
    });
    document.addEventListener('pointerlockerror', () => this.lockFailed());

    // Any touch switches to touch controls (capture phase, so it runs before the overlay's click).
    document.addEventListener(
      'pointerdown',
      (e) => {
        if (e.pointerType === 'touch') this.enableTouch();
      },
      true
    );
    if (isTouchDevice()) this.enableTouch();

    this.bindTouchAim();
  }

  enableTouch() {
    if (this.mode === 'touch') return;
    this.exitLock();
    this.mode = 'touch';
    this.mouseDown = false;
    document.body.classList.add('touch');
    this.update();
    this.onTouchMode?.();
  }

  // Drag anywhere on the game view to swing the gun, like a trackpad.
  bindTouchAim() {
    const dom = this.dom;
    dom.addEventListener('pointerdown', (e) => {
      if (this.mode !== 'touch' || this.aimId !== null) return;
      this.aimId = e.pointerId;
      this.aimX = e.clientX;
      this.aimY = e.clientY;
      dom.setPointerCapture?.(e.pointerId);
      e.preventDefault();
    });
    dom.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.aimId) return;
      const k = TOUCH_SWEEP / Math.max(window.innerWidth, window.innerHeight);
      this.aim(-(e.clientX - this.aimX) * k, -(e.clientY - this.aimY) * k);
      this.aimX = e.clientX;
      this.aimY = e.clientY;
    });
    const end = (e) => {
      if (e.pointerId === this.aimId) this.aimId = null;
    };
    dom.addEventListener('pointerup', end);
    dom.addEventListener('pointercancel', end);
    dom.addEventListener('lostpointercapture', end);
  }

  // Hold-to-fire on-screen button.
  bindFireButton(btn) {
    const release = (e) => {
      if (e.pointerId !== this.fireId) return;
      this.fireId = null;
      this.touchFire = false;
      btn.classList.remove('active');
      this.update();
    };
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.fireId = e.pointerId;
      btn.setPointerCapture?.(e.pointerId);
      this.touchFire = true;
      btn.classList.add('active');
      this.update();
    });
    btn.addEventListener('pointerup', release);
    btn.addEventListener('pointercancel', release);
    btn.addEventListener('lostpointercapture', release);
    btn.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  update() {
    const active = this.mode !== 'lock' || this.locked;
    this.firing = active && (this.mouseDown || this.spaceDown || this.touchFire);
  }

  aim(dYaw, dPitch) {
    this.yaw = clamp(this.yaw + dYaw, -YAW_LIMIT, YAW_LIMIT);
    this.pitch = clamp(this.pitch + dPitch, PITCH_MIN, PITCH_MAX);
  }

  lockFailed() {
    if (!this.everLocked && this.mode === 'lock') {
      this.mode = 'absolute';
      this.update();
    }
    this.onLockError?.();
  }

  requestLock() {
    if (this.mode !== 'lock') return;
    if (!this.dom.requestPointerLock) {
      this.lockFailed();
      return;
    }
    try {
      const p = this.dom.requestPointerLock();
      if (p && p.catch) p.catch(() => this.lockFailed());
    } catch {
      this.lockFailed();
    }
  }

  exitLock() {
    if (document.pointerLockElement) document.exitPointerLock();
  }
}
