import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';

// Layout (world units ~ metres). The sea is toward -z, the player looks down -z.
export const WATERLINE_Z = -30; // where the beach meets the sea
export const DEFENSE_Z = 8; // barbed-wire line at the foot of the dunes
export const BUNKER_Z = 24;
export const FLOOR_Y = 7.3;
export const EYE_POS = new THREE.Vector3(0, FLOOR_Y + 1.9, BUNKER_Z);

const clamp01 = (v) => Math.min(1, Math.max(0, v));
export function smoothstep(a, b, x) {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
}

export function groundHeight(x, z) {
  let h;
  if (z < WATERLINE_Z) h = (z - WATERLINE_Z) * 0.07;
  else h = (Math.min(z, DEFENSE_Z) - WATERLINE_Z) * 0.05;
  const dune = smoothstep(DEFENSE_Z, 20, z);
  h += dune * (5.2 + Math.sin(x * 0.13) * 0.5 + Math.sin(x * 0.31 + 1.3) * 0.25);
  h += Math.sin(x * 0.7 + z * 0.3) * 0.03;
  return h;
}

export function waterHeight(x, z, t) {
  const amp = 0.12 + 0.8 * clamp01((WATERLINE_Z - z) / 160);
  return (
    amp *
    (Math.sin(x * 0.045 + t * 1.1) * 0.5 +
      Math.sin(z * 0.07 - t * 1.6) * 0.35 +
      Math.sin((x - z) * 0.12 - t * 2.2) * 0.15)
  );
}

function createOcean() {
  const OZ = -420;
  const geo = new THREE.PlaneGeometry(1800, 900, 180, 90);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const base = new Float32Array(pos.count * 2);
  const colors = new Float32Array(pos.count * 3);
  const deep = new THREE.Color(0x236a88);
  const shallow = new THREE.Color(0x3a9aa0);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    base[i * 2] = pos.getX(i);
    base[i * 2 + 1] = pos.getZ(i) + OZ;
    c.copy(deep).lerp(shallow, smoothstep(-90, WATERLINE_Z, base[i * 2 + 1]));
    colors.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.3,
    metalness: 0.1,
    flatShading: true,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.z = OZ;
  mesh.receiveShadow = true;

  const update = (t) => {
    for (let i = 0; i < pos.count; i++) {
      pos.setY(i, waterHeight(base[i * 2], base[i * 2 + 1], t));
    }
    pos.needsUpdate = true;
  };
  return { mesh, update };
}

function createGround() {
  const GZ = 30;
  const geo = new THREE.PlaneGeometry(1600, 300, 320, 100);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const wet = new THREE.Color(0x9c8158);
  const dry = new THREE.Color(0xdcc18c);
  const grass = new THREE.Color(0x8a9152);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i) + GZ;
    pos.setY(i, groundHeight(x, z));
    c.copy(wet).lerp(dry, smoothstep(WATERLINE_Z - 2, WATERLINE_Z + 8, z));
    const g = smoothstep(13, 22, z) * (0.6 + 0.4 * Math.sin(x * 0.4 + z));
    c.lerp(grass, clamp01(g));
    const n = 0.96 + Math.random() * 0.08;
    colors.set([c.r * n, c.g * n, c.b * n], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.z = GZ;
  mesh.receiveShadow = true;
  mesh.updateMatrixWorld();
  return mesh;
}

function createHedgehog(mat, beamGeo) {
  const g = new THREE.Group();
  for (let k = 0; k < 3; k++) {
    const beam = new THREE.Mesh(beamGeo, mat);
    beam.rotation.order = 'YXZ';
    beam.rotation.y = (k * Math.PI * 2) / 3;
    beam.rotation.x = 0.95;
    beam.castShadow = true;
    g.add(beam);
  }
  return g;
}

function createSandbagArc(cx, cz, radius, fromA, toA, layers, y0) {
  const geo = new THREE.SphereGeometry(1, 10, 6);
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 });
  const perLayer = Math.ceil((Math.abs(toA - fromA) * radius) / 0.6);
  const mesh = new THREE.InstancedMesh(geo, mat, perLayer * layers);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3(0.36, 0.15, 0.24);
  const p = new THREE.Vector3();
  const e = new THREE.Euler();
  const col = new THREE.Color();
  let i = 0;
  for (let l = 0; l < layers; l++) {
    for (let k = 0; k < perLayer; k++) {
      const a = fromA + ((k + (l % 2) * 0.5) / perLayer) * (toA - fromA);
      // a = 0 points toward the sea (-z)
      p.set(cx + Math.sin(a) * radius, y0 + 0.13 + l * 0.24, cz - Math.cos(a) * radius);
      e.set(0, -a, (Math.random() - 0.5) * 0.08);
      q.setFromEuler(e);
      m.compose(p, q, s);
      mesh.setMatrixAt(i, m);
      col.setHSL(0.11, 0.3, 0.5 + Math.random() * 0.12);
      mesh.setColorAt(i, col);
      i++;
    }
  }
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function createWire() {
  const g = new THREE.Group();
  const postGeo = new THREE.CylinderGeometry(0.05, 0.06, 1.2, 5);
  const postMat = new THREE.MeshStandardMaterial({ color: 0x4a3a2a, roughness: 1 });
  const pts = [];
  for (let x = -90; x <= 90; x += 3) {
    const y = groundHeight(x, DEFENSE_Z);
    const post = new THREE.Mesh(postGeo, postMat);
    post.position.set(x, y + 0.6, DEFENSE_Z);
    post.castShadow = true;
    g.add(post);
    pts.push(new THREE.Vector3(x, y + 1.05, DEFENSE_Z));
    pts.push(new THREE.Vector3(x + 1.5, groundHeight(x + 1.5, DEFENSE_Z) + 0.45, DEFENSE_Z + 0.3));
  }
  const wire = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(pts),
    new THREE.LineBasicMaterial({ color: 0x2b2b2b })
  );
  g.add(wire);
  return g;
}

function createShip(x, z, len) {
  const mat = new THREE.MeshStandardMaterial({ color: 0x5b636b, roughness: 0.9 });
  const g = new THREE.Group();
  const hull = new THREE.Mesh(new THREE.BoxGeometry(len, 5, len * 0.16), mat);
  hull.position.y = 1.5;
  g.add(hull);
  const sup = new THREE.Mesh(new THREE.BoxGeometry(len * 0.25, 7, len * 0.1), mat);
  sup.position.set(len * 0.05, 7, 0);
  g.add(sup);
  const mast = new THREE.Mesh(new THREE.BoxGeometry(0.8, 10, 0.8), mat);
  mast.position.set(len * 0.08, 15, 0);
  g.add(mast);
  const gun = new THREE.Mesh(new THREE.BoxGeometry(len * 0.1, 2.5, len * 0.08), mat);
  gun.position.set(-len * 0.28, 5, 0);
  g.add(gun);
  g.position.set(x, 0, z);
  return g;
}

export function createWorld(scene) {
  // Sky + lighting
  const sunDir = new THREE.Vector3(-0.55, 0.42, 0.5).normalize();
  const sky = new Sky();
  sky.scale.setScalar(2500);
  const u = sky.material.uniforms;
  u.turbidity.value = 5;
  u.rayleigh.value = 1.6;
  u.mieCoefficient.value = 0.005;
  u.mieDirectionalG.value = 0.8;
  u.sunPosition.value.copy(sunDir);
  scene.add(sky);
  scene.fog = new THREE.Fog(0xb7cad6, 140, 900);

  scene.add(new THREE.HemisphereLight(0xcfe3ff, 0x8a7a55, 1.3));
  const sun = new THREE.DirectionalLight(0xfff1d6, 3.2);
  sun.target.position.set(0, 0, -15);
  sun.position.copy(sun.target.position).addScaledVector(sunDir, 200);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera;
  sc.left = -85;
  sc.right = 85;
  sc.top = 70;
  sc.bottom = -70;
  sc.near = 10;
  sc.far = 450;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.05;
  scene.add(sun, sun.target);

  const ocean = createOcean();
  scene.add(ocean.mesh);
  const ground = createGround();
  scene.add(ground);

  // Beach obstacles (block bullets)
  const obstacles = [];
  const steel = new THREE.MeshStandardMaterial({ color: 0x3a3632, roughness: 0.7, metalness: 0.5 });
  const beamGeo = new THREE.BoxGeometry(0.22, 2.6, 0.22);
  for (let i = 0; i < 22; i++) {
    const x = (Math.random() - 0.5) * 150;
    const z = WATERLINE_Z + 2 + Math.random() * 28;
    const h = createHedgehog(steel, beamGeo);
    h.position.set(x, groundHeight(x, z) + 0.75, z);
    h.rotation.y = Math.random() * Math.PI;
    scene.add(h);
    h.updateMatrixWorld(true);
    obstacles.push(...h.children);
  }
  for (const m of obstacles) m.userData.kind = 'obstacle';

  scene.add(createWire());

  // Bunker: concrete slab + sandbag ring around the gunner
  const concrete = new THREE.MeshStandardMaterial({ color: 0x8d8b84, roughness: 0.95 });
  const slab = new THREE.Mesh(new THREE.BoxGeometry(7, 1.6, 6), concrete);
  slab.position.set(0, FLOOR_Y - 0.8, BUNKER_Z + 1);
  slab.receiveShadow = true;
  scene.add(slab);
  scene.add(createSandbagArc(0, BUNKER_Z, 2.7, -1.9, 1.9, 2, FLOOR_Y - 0.12));
  for (const x of [-32, 30]) {
    const z = 21;
    scene.add(createSandbagArc(x, z, 2.2, -1.6, 1.6, 3, groundHeight(x, z) - 0.1));
  }

  // Warships on the horizon
  scene.add(createShip(-260, -760, 120), createShip(140, -800, 150), createShip(420, -720, 100));

  return {
    ground,
    obstacles,
    update(t) {
      ocean.update(t);
    },
  };
}
