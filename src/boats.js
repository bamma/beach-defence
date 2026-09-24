import * as THREE from 'three';
import { Soldier } from './soldiers.js';
import { waterHeight, WATERLINE_Z } from './world.js';

const MAT = {
  rubber: new THREE.MeshLambertMaterial({ color: 0x34383a }),
  floor: new THREE.MeshLambertMaterial({ color: 0x25282a }),
  motor: new THREE.MeshLambertMaterial({ color: 0x1c1c1c }),
  hit: new THREE.MeshBasicMaterial({ visible: false }),
};
const TUBE_LEN = 4.2;
const GEO = {
  tube: new THREE.CapsuleGeometry(0.42, TUBE_LEN, 6, 12).rotateX(Math.PI / 2),
  bow: new THREE.TorusGeometry(0.9, 0.42, 8, 16, Math.PI).rotateX(Math.PI / 2),
  floor: new THREE.BoxGeometry(1.5, 0.12, 4.8),
  motor: new THREE.BoxGeometry(0.4, 0.55, 0.45),
  shaft: new THREE.BoxGeometry(0.12, 0.8, 0.12),
  hit: new THREE.BoxGeometry(2.8, 1.3, 5.8),
};

const _v = new THREE.Vector3();

// Rubber landing boat. Faces +z (toward the beach).
export class Boat {
  constructor(game, x, z, speed, soldierCount, runSpeed) {
    this.game = game;
    this.speed = speed;
    this.state = 'approach';
    this.removed = false;
    this.hp = 12 + soldierCount * 2;
    this.landZ = WATERLINE_Z - 9 - Math.random() * 3;
    this.t = Math.random() * 10;
    this.wakeT = 0;
    this.velocity = speed;

    const g = (this.group = new THREE.Group());
    for (const sx of [-0.9, 0.9]) {
      const tube = new THREE.Mesh(GEO.tube, MAT.rubber);
      tube.position.set(sx, 0.3, 0);
      tube.castShadow = true;
      g.add(tube);
    }
    const bow = new THREE.Mesh(GEO.bow, MAT.rubber);
    bow.position.set(0, 0.3, TUBE_LEN / 2);
    bow.castShadow = true;
    g.add(bow);
    const floor = new THREE.Mesh(GEO.floor, MAT.floor);
    floor.position.set(0, 0.0, 0.2);
    g.add(floor);
    const motor = new THREE.Mesh(GEO.motor, MAT.motor);
    motor.position.set(0, 0.7, -TUBE_LEN / 2 - 0.35);
    motor.castShadow = true;
    g.add(motor);
    const shaft = new THREE.Mesh(GEO.shaft, MAT.motor);
    shaft.position.set(0, 0.1, -TUBE_LEN / 2 - 0.4);
    g.add(shaft);

    this.hitbox = new THREE.Mesh(GEO.hit, MAT.hit);
    this.hitbox.position.set(0, 0.25, 0.1);
    this.hitbox.userData.kind = 'boat';
    this.hitbox.userData.target = this;
    g.add(this.hitbox);

    this.passengers = [];
    for (let i = 0; i < soldierCount; i++) {
      const s = new Soldier(game, runSpeed);
      const col = i % 2 === 0 ? -0.42 : 0.42;
      const row = Math.floor(i / 2);
      s.group.position.set(col, 0.05, 1.4 - row * 0.85);
      s.setSeated();
      g.add(s.group);
      this.passengers.push(s);
      game.soldiers.push(s);
    }

    g.position.set(x, 0, z);
    game.scene.add(g);
  }

  get hittable() {
    return !this.removed && this.state !== 'sinking';
  }

  hit(point) {
    if (!this.hittable) return;
    this.hp--;
    this.game.effects.burst('boat', point);
    this.game.audio.thud();
    if (this.hp <= 0) this.sink();
  }

  sink() {
    this.state = 'sinking';
    this.sinkT = 0;
    let killed = 0;
    for (const s of this.passengers) {
      if (s.alive && s.state === 'boat') {
        s.kill();
        killed++;
      }
    }
    this.game.onBoatSunk(this, killed);
    this.game.effects.burst('bigsplash', this.group.position);
    this.game.audio.bigSplash();
  }

  unloadNext() {
    const s = this.passengers.find((p) => p.alive && p.state === 'boat');
    if (!s) return false;
    const p = this.group.position;
    this.game.scene.attach(s.group);
    s.group.position.set(s.group.position.x, 0, p.z + 2.9);
    s.startWade(p.x * 0.85 + (Math.random() - 0.5) * 16);
    this.game.effects.burst('water', s.group.position, 0.6);
    return true;
  }

  update(dt) {
    if (this.removed) return;
    this.t += dt;
    const p = this.group.position;
    const time = this.game.time;
    let v = 0;

    switch (this.state) {
      case 'approach': {
        const dist = this.landZ - p.z;
        v = this.speed * Math.min(1, Math.max(0.25, dist / 25));
        p.z += v * dt;
        p.x += Math.sin(this.t * 0.4) * 0.3 * dt;
        if (dist < 0.3) {
          this.state = 'unload';
          this.unloadT = 0.5;
        }
        break;
      }
      case 'unload':
        this.unloadT -= dt;
        if (this.unloadT <= 0) {
          if (this.unloadNext()) this.unloadT = 0.35;
          else {
            this.state = 'leave';
            this.leaveT = 0;
          }
        }
        break;
      case 'leave':
        this.leaveT += dt;
        v = -Math.min(6, this.leaveT * 2);
        p.z += v * dt;
        if (this.leaveT > 14) this.remove();
        break;
      case 'sinking':
        this.sinkT += dt;
        p.y -= dt * 0.6;
        this.group.rotation.x += dt * 0.15;
        this.group.rotation.z += dt * 0.1;
        if (Math.random() < dt * 6) {
          _v.set(p.x + (Math.random() - 0.5) * 2, 0.2, p.z + (Math.random() - 0.5) * 4);
          this.game.effects.burst('water', _v, 0.5);
        }
        if (this.sinkT > 4) this.remove();
        return;
    }

    // Ride the waves
    const h = waterHeight(p.x, p.z, time);
    const dhdz = (waterHeight(p.x, p.z + 1.5, time) - waterHeight(p.x, p.z - 1.5, time)) / 3;
    const dhdx = (waterHeight(p.x + 1, p.z, time) - waterHeight(p.x - 1, p.z, time)) / 2;
    p.y = h + 0.05;
    const bowLift = Math.max(0, v) / 20 * 0.12;
    this.group.rotation.x = -Math.atan(dhdz) - bowLift;
    this.group.rotation.z = Math.atan(dhdx);

    if (Math.abs(v) > 1) {
      this.wakeT -= dt;
      if (this.wakeT <= 0) {
        this.wakeT = 0.05;
        _v.set(p.x + (Math.random() - 0.5) * 1.6, h, p.z - Math.sign(v) * 2.8);
        this.game.effects.burst('wake', _v);
      }
    }
  }

  remove() {
    if (this.removed) return;
    this.removed = true;
    for (const s of this.passengers) if (s.group.parent === this.group) s.remove();
    this.game.scene.remove(this.group);
  }
}
