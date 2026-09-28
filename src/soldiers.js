import * as THREE from 'three';
import { groundHeight, waterHeight, WATERLINE_Z, DEFENSE_Z } from './world.js';

const lambert = (color) => new THREE.MeshLambertMaterial({ color });
const MAT = {
  jacket: lambert(0xff6a13),
  strip: lambert(0xe8e8e0),
  hit: new THREE.MeshBasicMaterial({ visible: false }),
};
// Shared palettes so each person looks different without per-person materials.
const SHIRTS = [0x2f5d8a, 0x8a2f3a, 0x3f7a4d, 0x6b6b6b, 0xd8d2c0, 0x4a3b6b, 0x20262e].map(lambert);
const TROUSERS = [0x2b3445, 0x3a3128, 0x4b4f55, 0x1f1f22, 0x5c5240].map(lambert);
const SKINS = [0xe0b394, 0xc99a76, 0xa0714f, 0x7a5236, 0x5a3a26].map(lambert);
const HAIR = [0x1c1410, 0x3b2616, 0x6a4526, 0xa8824a, 0x2a2a2a, 0x8c8c8c].map(lambert);
const ARM_REST = -0.15;
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

const GEO = {
  torso: new THREE.BoxGeometry(0.46, 0.58, 0.28),
  jacket: new THREE.BoxGeometry(0.54, 0.46, 0.36),
  collar: new THREE.BoxGeometry(0.44, 0.16, 0.16),
  strip: new THREE.BoxGeometry(0.55, 0.04, 0.37),
  head: new THREE.SphereGeometry(0.13, 8, 6),
  hair: new THREE.SphereGeometry(0.14, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2),
  leg: new THREE.BoxGeometry(0.17, 0.88, 0.2),
  arm: new THREE.BoxGeometry(0.13, 0.56, 0.15),
  hit: new THREE.BoxGeometry(0.7, 1.8, 0.7),
};

function part(geo, mat, x, y, z, shadow = true) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = shadow;
  return m;
}

// A soldier's origin is at their feet and they face +z (toward the player).
export class Soldier {
  constructor(game, runSpeed) {
    this.game = game;
    this.state = 'boat';
    this.alive = true;
    this.removed = false;
    this.runSpeed = runSpeed * (0.85 + Math.random() * 0.3);
    this.phase = Math.random() * 10;
    this.zigFreq = 1 + Math.random() * 1.5;
    this.zigAmp = 1 + Math.random() * 2.5;
    this.t = 0;
    this.tx = 0;
    this.fallT = 0;

    const g = (this.group = new THREE.Group());
    g.rotation.order = 'YXZ';
    const body = (this.body = new THREE.Group());
    g.add(body);

    const shirt = pick(SHIRTS);
    const skin = pick(SKINS);
    body.add(part(GEO.torso, shirt, 0, 1.2, 0));
    // Orange life jacket with a padded collar and reflective strips.
    body.add(part(GEO.jacket, MAT.jacket, 0, 1.26, 0));
    body.add(part(GEO.collar, MAT.jacket, 0, 1.5, -0.08));
    body.add(part(GEO.strip, MAT.strip, 0, 1.18, 0, false));
    body.add(part(GEO.strip, MAT.strip, 0, 1.32, 0, false));
    body.add(part(GEO.head, skin, 0, 1.63, 0, false));
    const hair = part(GEO.hair, pick(HAIR), 0, 1.65, -0.01, false);
    hair.scale.set(1, 0.75 + Math.random() * 0.4, 1.05);
    body.add(hair);

    const trousers = pick(TROUSERS);
    this.legs = [-0.12, 0.12].map((x) => {
      const pivot = new THREE.Group();
      pivot.position.set(x, 0.9, 0);
      pivot.add(part(GEO.leg, trousers, 0, -0.44, 0));
      body.add(pivot);
      return pivot;
    });
    this.arms = [-0.33, 0.33].map((x) => {
      const pivot = new THREE.Group();
      pivot.position.set(x, 1.45, 0);
      pivot.add(part(GEO.arm, shirt, 0, -0.27, 0));
      pivot.rotation.x = ARM_REST;
      body.add(pivot);
      return pivot;
    });

    this.hitbox = new THREE.Mesh(GEO.hit, MAT.hit);
    this.hitbox.position.y = 0.9;
    this.hitbox.userData.kind = 'soldier';
    this.hitbox.userData.target = this;
    g.add(this.hitbox);
  }

  setSeated() {
    this.body.position.y = -0.55;
    this.legs.forEach((l) => (l.rotation.x = 0));
    this.hitbox.position.y = 0.6;
    this.hitbox.scale.y = 0.65;
  }

  startWade(tx) {
    this.state = 'wade';
    this.tx = tx;
    this.body.position.y = 0;
    this.hitbox.position.y = 0.9;
    this.hitbox.scale.y = 1;
    this.group.rotation.set(0, 0, 0);
  }

  isInWater() {
    return this.state === 'boat' || this.state === 'wade';
  }

  kill() {
    if (!this.alive) return;
    this.alive = false;
    this.state = 'dying';
    this.fallT = 0;
    this.fallDir = Math.random() < 0.3 ? 1 : -1;
  }

  animateWalk(speed) {
    const s = Math.sin(this.t * speed + this.phase);
    this.legs[0].rotation.x = s * 0.8;
    this.legs[1].rotation.x = -s * 0.8;
    // Empty-handed now, so arms swing freely opposite the legs.
    this.arms[0].rotation.x = ARM_REST - s * 0.7;
    this.arms[1].rotation.x = ARM_REST + s * 0.7;
    this.body.position.y = Math.abs(Math.cos(this.t * speed + this.phase)) * 0.06;
  }

  update(dt) {
    if (this.removed) return;
    this.t += dt;
    const p = this.group.position;
    switch (this.state) {
      case 'boat':
        this.body.rotation.z = Math.sin(this.t * 1.7 + this.phase) * 0.05;
        break;
      case 'wade': {
        const speed = 1.8;
        p.x += (this.tx - p.x) * 0.2 * dt;
        p.z += speed * dt;
        p.y = groundHeight(p.x, p.z);
        this.animateWalk(5);
        if (p.z >= WATERLINE_Z) {
          this.state = 'run';
          this.t = 0;
        }
        break;
      }
      case 'run': {
        const vx = (this.tx - p.x) * 0.3 + Math.sin(this.t * this.zigFreq + this.phase) * this.zigAmp;
        const vz = this.runSpeed;
        p.x += vx * dt;
        p.z += vz * dt;
        p.y = groundHeight(p.x, p.z);
        this.group.rotation.y = Math.atan2(vx, vz);
        this.animateWalk(9 + this.runSpeed);
        if (p.z >= DEFENSE_Z) {
          this.alive = false;
          this.state = 'done';
          this.game.onBreach(this);
          this.remove();
        }
        break;
      }
      case 'dying': {
        this.fallT += dt;
        const k = Math.min(1, this.fallT / 0.45);
        this.group.rotation.x = this.fallDir * k * k * (Math.PI / 2);
        if (this.group.parent === this.game.scene) {
          this.body.position.y *= 0.9;
          const floor = groundHeight(p.x, p.z);
          const water = waterHeight(p.x, p.z, this.game.time) - 0.15;
          const target = Math.max(floor, water) + 0.12 * k;
          p.y += (target - p.y) * Math.min(1, dt * 6);
        }
        if (this.fallT > 5) p.y -= dt * 0.3;
        if (this.fallT > 7) this.remove();
        break;
      }
    }
  }

  remove() {
    if (this.removed) return;
    this.removed = true;
    this.alive = false;
    this.group.parent?.remove(this.group);
  }
}
