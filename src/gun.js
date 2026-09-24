import * as THREE from 'three';

const FIRE_INTERVAL = 1 / 11;
const BULLET_SPEED = 480;
const SPREAD = 0.005;
const HEAT_PER_SHOT = 0.022;
const COOL_RATE = 0.3;
const COOL_WHILE_FIRING = 0.04;
const RECOVER_AT = 0.3;
const TRACER_EVERY = 2;

function flashTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,230,1)');
  grad.addColorStop(0.25, 'rgba(255,200,90,0.9)');
  grad.addColorStop(1, 'rgba(255,120,20,0)');
  g.fillStyle = grad;
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const r = i % 2 === 0 ? 32 : 12;
    g.lineTo(32 + Math.cos(a) * r, 32 + Math.sin(a) * r);
  }
  g.fill();
  return new THREE.CanvasTexture(c);
}

// Mounted machine gun, rendered as a child of the camera.
export class Gun {
  constructor(game) {
    this.game = game;
    this.heat = 0;
    this.overheated = false;
    this.cooldown = 0;
    this.shots = 0;
    this.recoil = 0;
    this.flashT = 0;
    this.pending = [];
    this._dir = new THREE.Vector3();
    this._origin = new THREE.Vector3();
    this._muzzle = new THREE.Vector3();
    this._end = new THREE.Vector3();

    this.buildModel();
    this.buildTracers();
  }

  buildModel() {
    const metal = new THREE.MeshPhongMaterial({ color: 0x5d646b, shininess: 40, specular: 0x444444 });
    this.barrelMat = new THREE.MeshPhongMaterial({ color: 0x4a4f55, shininess: 60, specular: 0x555555, emissive: 0x000000 });
    const wood = new THREE.MeshLambertMaterial({ color: 0x7a5232 });
    const olive = new THREE.MeshLambertMaterial({ color: 0x7c8650 });
    const brass = new THREE.MeshPhongMaterial({ color: 0xc9a24a, shininess: 80 });

    const g = (this.model = new THREE.Group());
    const add = (geo, mat, x, y, z, rx = 0) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      m.rotation.x = rx;
      g.add(m);
      return m;
    };
    add(new THREE.BoxGeometry(0.16, 0.18, 0.75), metal, 0, -0.34, -0.75);
    add(new THREE.BoxGeometry(0.17, 0.05, 0.45), metal, 0, -0.225, -0.72);
    add(new THREE.CylinderGeometry(0.058, 0.058, 0.8, 12), metal, 0, -0.33, -1.5, Math.PI / 2);
    add(new THREE.CylinderGeometry(0.024, 0.024, 0.55, 8), this.barrelMat, 0, -0.33, -2.1, Math.PI / 2);
    add(new THREE.CylinderGeometry(0.035, 0.03, 0.08, 8), metal, 0, -0.33, -2.38, Math.PI / 2);
    add(new THREE.BoxGeometry(0.02, 0.07, 0.02), metal, 0, -0.26, -1.86);
    add(new THREE.BoxGeometry(0.06, 0.05, 0.03), metal, 0, -0.2, -0.52);
    add(new THREE.BoxGeometry(0.22, 0.14, 0.06), metal, 0, -0.34, -0.36);
    for (const x of [-0.13, 0.13]) add(new THREE.CylinderGeometry(0.025, 0.025, 0.16, 8), wood, x, -0.44, -0.4);
    add(new THREE.BoxGeometry(0.16, 0.16, 0.26), olive, -0.2, -0.4, -0.8);
    const belt = add(new THREE.BoxGeometry(0.1, 0.02, 0.14), brass, -0.12, -0.3, -0.78);
    belt.rotation.z = 0.5;

    this.muzzle = new THREE.Object3D();
    this.muzzle.position.set(0, -0.33, -2.45);
    g.add(this.muzzle);

    this.flash = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: flashTexture(),
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
        fog: false,
      })
    );
    this.flash.position.copy(this.muzzle.position);
    this.flash.visible = false;
    g.add(this.flash);

    this.light = new THREE.PointLight(0xffa550, 0, 18, 1.5);
    this.light.position.copy(this.muzzle.position);
    g.add(this.light);

    g.scale.setScalar(0.7);
    this.basePos = new THREE.Vector3(0.05, -0.04, -0.18);
    g.position.copy(this.basePos);
    this.game.camera.add(g);
  }

  buildTracers() {
    const geo = new THREE.CylinderGeometry(0.035, 0.035, 1, 5, 1, true).rotateX(Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffb347,
      toneMapped: false,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
    });
    this.tracers = [];
    for (let i = 0; i < 40; i++) {
      const mesh = new THREE.Mesh(geo, mat);
      mesh.visible = false;
      this.game.scene.add(mesh);
      this.tracers.push({ mesh, start: new THREE.Vector3(), dir: new THREE.Vector3(), dist: 0, travel: 0, active: false });
    }
  }

  reset() {
    this.heat = 0;
    this.overheated = false;
    this.cooldown = 0;
    this.pending.length = 0;
    for (const t of this.tracers) {
      t.active = false;
      t.mesh.visible = false;
    }
  }

  update(dt, trigger) {
    this.cooldown -= dt;
    if (this.overheated) {
      this.heat -= COOL_RATE * dt;
      if (this.heat <= RECOVER_AT) this.overheated = false;
    } else if (trigger) {
      this.heat -= COOL_WHILE_FIRING * dt;
      while (this.cooldown <= 0 && !this.overheated) {
        this.fire();
        this.cooldown += FIRE_INTERVAL;
      }
    } else {
      this.heat -= COOL_RATE * dt;
    }
    if (!trigger || this.overheated) this.cooldown = Math.max(0, this.cooldown);
    this.heat = Math.min(1, Math.max(0, this.heat));

    this.recoil *= Math.exp(-dt * 20);
    this.model.position.set(this.basePos.x, this.basePos.y - this.recoil * 0.01, this.basePos.z + this.recoil * 0.06);

    this.flashT -= dt;
    this.flash.visible = this.flashT > 0;
    this.light.intensity = this.flashT > 0 ? 30 : 0;

    const glow = this.heat * this.heat;
    this.barrelMat.emissive.setRGB(glow * 1.6, glow * 0.35, glow * 0.05);

    for (let i = this.pending.length - 1; i >= 0; i--) {
      const p = this.pending[i];
      p.t -= dt;
      if (p.t <= 0) {
        this.pending.splice(i, 1);
        this.game.applyImpact(p.hit);
      }
    }

    for (const t of this.tracers) {
      if (!t.active) continue;
      t.travel += BULLET_SPEED * dt;
      if (t.travel >= t.dist) {
        t.active = false;
        t.mesh.visible = false;
        continue;
      }
      const len = Math.min(8, t.dist - t.travel);
      t.mesh.position.copy(t.start).addScaledVector(t.dir, t.travel + len / 2);
      const w = 1 + t.travel * 0.025;
      t.mesh.scale.set(w, w, len);
    }
  }

  fire() {
    const game = this.game;
    this.shots++;
    this.heat += HEAT_PER_SHOT;
    if (this.heat >= 1) {
      this.heat = 1;
      this.overheated = true;
      game.audio.overheat();
    }

    const cam = game.camera;
    cam.updateMatrixWorld();
    cam.getWorldPosition(this._origin);
    this._dir
      .set((Math.random() - 0.5) * 2 * SPREAD, (Math.random() - 0.5) * 2 * SPREAD, -1)
      .normalize()
      .applyQuaternion(cam.quaternion);

    const hit = game.traceShot(this._origin, this._dir);
    const dist = hit ? hit.distance : 700;
    this._end.copy(this._origin).addScaledVector(this._dir, dist);
    if (hit) this.pending.push({ t: dist / BULLET_SPEED, hit });

    if (this.shots % TRACER_EVERY === 0) {
      this.muzzle.getWorldPosition(this._muzzle);
      const t = this.tracers.find((tr) => !tr.active);
      if (t) {
        t.active = true;
        t.start.copy(this._muzzle);
        t.dir.copy(this._end).sub(this._muzzle);
        t.dist = t.dir.length();
        t.dir.normalize();
        t.travel = 0;
        t.mesh.visible = true;
        t.mesh.position.copy(t.start);
        t.mesh.lookAt(this._end);
        t.mesh.scale.set(1, 1, 0.01);
      }
    }

    this.flashT = 0.045;
    this.flash.material.rotation = Math.random() * Math.PI;
    this.flash.scale.setScalar(0.35 + Math.random() * 0.25);
    this.recoil = 1;
    game.input.aim((Math.random() - 0.5) * 0.003, 0.0012 + Math.random() * 0.0015);
    game.shake = Math.min(0.01, game.shake + 0.004);
    game.audio.gunshot();
  }
}
