import * as THREE from 'three';

const MAX = 1500;
const COLORS = {
  water: new THREE.Color(0xeaf6ff),
  foam: new THREE.Color(0xffffff),
  sand: new THREE.Color(0xcfb27c),
  dust: new THREE.Color(0xa89474),
  spark: new THREE.Color(0xffd27a),
  dark: new THREE.Color(0x2d2d2d),
  smoke: new THREE.Color(0x6f6f6f),
};

const rand = (a, b) => a + Math.random() * (b - a);

// All particles are drawn with a single InstancedMesh.
export class Effects {
  constructor(scene) {
    this.mesh = new THREE.InstancedMesh(
      new THREE.IcosahedronGeometry(1, 0),
      new THREE.MeshLambertMaterial({ color: 0xffffff }),
      MAX
    );
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.setColorAt(0, COLORS.water);
    this.mesh.count = 0;
    scene.add(this.mesh);
    this.particles = [];
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._s = new THREE.Vector3();
  }

  spawn(pos, vx, vy, vz, size, life, color, gravity = 9.8, grow = 0) {
    if (this.particles.length >= MAX) return;
    this.particles.push({
      p: pos.clone(),
      v: new THREE.Vector3(vx, vy, vz),
      size,
      life,
      age: 0,
      color,
      gravity,
      grow,
    });
  }

  burst(type, point, scale = 1) {
    switch (type) {
      case 'water':
        for (let i = 0; i < 7; i++)
          this.spawn(point, rand(-1, 1), rand(3, 6) * scale, rand(-1, 1), rand(0.1, 0.2), rand(0.5, 0.8), COLORS.water);
        this.spawn(point, 0, 1.5, 0, 0.25, 0.6, COLORS.foam, 2, 1.5);
        break;
      case 'bigsplash':
        for (let i = 0; i < 70; i++)
          this.spawn(point, rand(-3, 3), rand(3, 11), rand(-3, 3), rand(0.2, 0.45), rand(0.9, 1.6), COLORS.water);
        for (let i = 0; i < 8; i++)
          this.spawn(point, rand(-1, 1), rand(0.5, 1.5), rand(-1, 1), 0.8, 2.2, COLORS.foam, 0, 1.2);
        break;
      case 'sand':
        for (let i = 0; i < 6; i++)
          this.spawn(point, rand(-1.2, 1.2), rand(2, 4.5), rand(-1.2, 1.2), rand(0.07, 0.15), rand(0.4, 0.7), COLORS.sand);
        this.spawn(point, 0, 0.6, 0, 0.25, 1.1, COLORS.sand, 0, 1.4);
        break;
      case 'hit':
        for (let i = 0; i < 8; i++)
          this.spawn(point, rand(-1.5, 1.5), rand(0.5, 3), rand(-1.5, 1.5), rand(0.06, 0.12), rand(0.3, 0.6), COLORS.dust);
        break;
      case 'spark':
        for (let i = 0; i < 6; i++)
          this.spawn(point, rand(-5, 5), rand(1, 7), rand(-5, 5), rand(0.03, 0.06), rand(0.15, 0.3), COLORS.spark);
        break;
      case 'boat':
        for (let i = 0; i < 4; i++)
          this.spawn(point, rand(-2, 2), rand(1, 3), rand(-2, 2), rand(0.06, 0.12), rand(0.3, 0.5), COLORS.dark);
        for (let i = 0; i < 4; i++)
          this.spawn(point, rand(-1, 1), rand(2, 4), rand(-1, 1), rand(0.08, 0.14), rand(0.4, 0.6), COLORS.water);
        break;
      case 'smoke':
        this.spawn(point, rand(-0.3, 0.3), rand(1, 2), rand(-0.3, 0.3), 0.3, 2.5, COLORS.smoke, -0.2, 1.5);
        break;
      case 'wake':
        this.spawn(point, rand(-0.8, 0.8), rand(0.5, 1.5), rand(-0.5, 0), rand(0.15, 0.3), rand(0.8, 1.3), COLORS.foam, 2, 1.2);
        break;
    }
  }

  update(dt) {
    const ps = this.particles;
    for (let i = ps.length - 1; i >= 0; i--) {
      const p = ps[i];
      p.age += dt;
      if (p.age >= p.life) {
        ps[i] = ps[ps.length - 1];
        ps.pop();
        continue;
      }
      p.v.y -= p.gravity * dt;
      p.p.addScaledVector(p.v, dt);
    }
    for (let i = 0; i < ps.length; i++) {
      const p = ps[i];
      const k = p.age / p.life;
      const s = p.size * (1 + p.grow * p.age) * Math.sqrt(1 - k);
      this._s.set(s, s, s);
      this._m.compose(p.p, this._q, this._s);
      this.mesh.setMatrixAt(i, this._m);
      this.mesh.setColorAt(i, p.color);
    }
    this.mesh.count = ps.length;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  clear() {
    this.particles.length = 0;
  }
}
