export const YAW_LIMIT = 1.2;
export const PITCH_MIN = -0.5;
export const PITCH_MAX = 0.2;
const SENSITIVITY = 0.0022;

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

// Mouse aiming. Uses pointer lock when the browser allows it, otherwise
// falls back to "absolute" mode where the cursor position maps to the aim.
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
    this.mouseDown = false;
    this.spaceDown = false;

    document.addEventListener('mousemove', (e) => {
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
      if (e.button === 0) this.mouseDown = true;
      this.update();
    });
    document.addEventListener('mouseup', (e) => {
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
      this.mouseDown = this.spaceDown = false;
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
  }

  update() {
    const active = this.mode === 'absolute' || this.locked;
    this.firing = active && (this.mouseDown || this.spaceDown);
  }

  aim(dYaw, dPitch) {
    this.yaw = clamp(this.yaw + dYaw, -YAW_LIMIT, YAW_LIMIT);
    this.pitch = clamp(this.pitch + dPitch, PITCH_MIN, PITCH_MAX);
  }

  lockFailed() {
    if (!this.everLocked) {
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
