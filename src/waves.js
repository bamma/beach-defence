import { Boat } from './boats.js';

const SPAWN_Z = -250;

export class WaveDirector {
  constructor(game) {
    this.game = game;
    this.reset();
  }

  reset() {
    this.wave = 0;
    this.toSpawn = 0;
    this.spawnT = 0;
    this.intermission = 2;
  }

  params() {
    const w = this.wave;
    return {
      boats: Math.min(2 + w, 14),
      boatSpeed: Math.min(11 + w * 0.9, 22),
      soldiers: Math.min(4 + Math.floor(w / 2), 8),
      runSpeed: Math.min(3.6 + w * 0.25, 7),
      interval: Math.max(1.2, 4.5 - w * 0.3),
    };
  }

  startNext() {
    this.wave++;
    this.toSpawn = this.params().boats;
    this.spawnT = 0.5;
    this.game.hud.setWave(this.wave);
    this.game.hud.banner(`WAVE ${this.wave}`);
    this.game.audio.horn();
  }

  spawnBoat() {
    const { boatSpeed, soldiers, runSpeed } = this.params();
    let x = 0;
    for (let tries = 0; tries < 8; tries++) {
      x = (Math.random() - 0.5) * 150;
      const clash = this.game.boats.some((b) => b.state === 'approach' && Math.abs(b.group.position.x - x) < 12);
      if (!clash) break;
    }
    const speed = boatSpeed * (0.85 + Math.random() * 0.3);
    this.game.boats.push(new Boat(this.game, x, SPAWN_Z, speed, soldiers, runSpeed));
  }

  update(dt) {
    if (this.intermission > 0) {
      this.intermission -= dt;
      if (this.intermission <= 0) this.startNext();
      return;
    }
    if (this.toSpawn > 0) {
      this.spawnT -= dt;
      if (this.spawnT <= 0) {
        this.spawnBoat();
        this.toSpawn--;
        this.spawnT = this.params().interval * (0.7 + Math.random() * 0.6);
      }
      return;
    }
    const threats =
      this.game.boats.some((b) => b.state === 'approach' || b.state === 'unload') ||
      this.game.soldiers.some((s) => s.alive);
    if (!threats) {
      const bonus = this.wave * 100;
      this.game.addScore(bonus);
      this.game.hud.banner(`WAVE ${this.wave} REPELLED  +${bonus}`);
      this.intermission = 4.5;
    }
  }
}
