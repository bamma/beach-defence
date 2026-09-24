import './style.css';
import * as THREE from 'three';
import { createWorld, EYE_POS, groundHeight } from './world.js';
import { Input } from './input.js';
import { Gun } from './gun.js';
import { Effects } from './effects.js';
import { WaveDirector } from './waves.js';
import { Hud } from './hud.js';
import { GameAudio } from './audio.js';

const DEBUG = new URLSearchParams(location.search).has('debug');
const MAX_LIVES = 10;
const STEP = 1 / 60;
const BEST_KEY = 'beach-defence-best';

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.55;
document.getElementById('app').appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.05, 3000);
camera.position.copy(EYE_POS);
camera.rotation.order = 'YXZ';
scene.add(camera);

const world = createWorld(scene);
const hud = new Hud();
const audio = new GameAudio();
const input = new Input(renderer.domElement);
const effects = new Effects(scene);

const game = {
  scene,
  camera,
  world,
  hud,
  audio,
  input,
  effects,
  boats: [],
  soldiers: [],
  score: 0,
  lives: MAX_LIVES,
  kills: 0,
  time: 0,
  shake: 0,
  timeScale: 1,
  state: 'menu',
};
game.gun = new Gun(game);
game.director = new WaveDirector(game);

function loadBest() {
  try {
    return Number(localStorage.getItem(BEST_KEY)) || 0;
  } catch {
    return 0;
  }
}
function saveBest(v) {
  try {
    localStorage.setItem(BEST_KEY, String(v));
  } catch {
    /* storage unavailable */
  }
}

game.addScore = (n) => {
  game.score += n;
  hud.setScore(game.score);
};

game.onBreach = () => {
  game.lives--;
  hud.setLives(game.lives, MAX_LIVES);
  hud.flashDamage();
  audio.breach();
  game.shake = 0.03;
  if (game.lives <= 0) gameOver();
};

game.onBoatSunk = (boat, killed) => {
  game.kills += killed;
  game.addScore(50 + killed * 15);
};

// --- Shooting -------------------------------------------------------------
const raycaster = new THREE.Raycaster();
raycaster.far = 1500;
const targets = [];

game.traceShot = (origin, dir) => {
  raycaster.set(origin, dir);
  targets.length = 0;
  for (const s of game.soldiers) if (s.alive) targets.push(s.hitbox);
  for (const b of game.boats) if (b.hittable) targets.push(b.hitbox);

  let best = null;
  const consider = (hits, kind) => {
    if (hits.length && (!best || hits[0].distance < best.distance)) {
      const h = hits[0];
      best = { distance: h.distance, point: h.point.clone(), kind: kind ?? h.object.userData.kind, target: h.object.userData.target };
    }
  };
  consider(raycaster.intersectObjects(targets, false));
  consider(raycaster.intersectObjects(world.obstacles, false));
  consider(raycaster.intersectObject(world.ground, false), 'ground');
  if (dir.y < 0) {
    const t = -origin.y / dir.y;
    if (!best || t < best.distance) {
      best = { distance: t, point: origin.clone().addScaledVector(dir, t), kind: 'water' };
    }
  }
  return best;
};

game.applyImpact = (hit) => {
  const p = hit.point;
  switch (hit.kind) {
    case 'soldier': {
      const s = hit.target;
      if (s.alive) {
        const wet = s.isInWater();
        s.kill();
        game.kills++;
        game.addScore(wet ? 15 : 10);
        effects.burst('hit', p);
      } else {
        effects.burst(groundHeight(p.x, p.z) < 0 ? 'water' : 'sand', p);
      }
      break;
    }
    case 'boat':
      hit.target.hit(p);
      break;
    case 'obstacle':
      effects.burst('spark', p);
      break;
    case 'ground':
      effects.burst('sand', p);
      break;
    case 'water':
      effects.burst('water', p);
      break;
  }
};

// --- Game flow ------------------------------------------------------------
function clearEntities() {
  for (const b of game.boats) b.remove();
  for (const s of game.soldiers) s.remove();
  game.boats.length = 0;
  game.soldiers.length = 0;
  effects.clear();
}

function startGame() {
  clearEntities();
  game.score = 0;
  game.kills = 0;
  game.lives = MAX_LIVES;
  game.gun.reset();
  game.director.reset();
  hud.setScore(0);
  hud.setWave(1);
  hud.setLives(game.lives, MAX_LIVES);
  hud.showPlaying();
  game.state = 'playing';
}

function pause() {
  if (game.state !== 'playing') return;
  game.state = 'paused';
  audio.setEngine(0);
  hud.showPause();
}

function resume() {
  game.state = 'playing';
  hud.showPlaying();
}

function gameOver() {
  game.state = 'over';
  audio.setEngine(0);
  const best = loadBest();
  const isBest = game.score > best;
  if (isBest) saveBest(game.score);
  input.exitLock();
  overlayReadyAt = performance.now() + 900;
  hud.showGameOver(game.score, game.director.wave, game.kills, Math.max(best, game.score), isBest);
}

let overlayReadyAt = 0;
hud.overlay.addEventListener('click', () => {
  if (performance.now() < overlayReadyAt) return;
  audio.init();
  input.requestLock();
  if (game.state === 'menu' || game.state === 'over') startGame();
  else if (game.state === 'paused') resume();
});

input.onLockChange = (locked) => {
  if (!locked && input.mode === 'lock') pause();
};
input.onLockError = () => {
  // Re-locking too soon after Esc is refused by browsers: stay paused and let the player click again.
  if (input.everLocked && game.state === 'playing') pause();
};
document.addEventListener('visibilitychange', () => {
  if (document.hidden) pause();
});

// --- Main loop ------------------------------------------------------------
function update(dt) {
  game.time += dt;
  game.director.update(dt);
  for (const b of game.boats) b.update(dt);
  game.boats = game.boats.filter((b) => !b.removed);
  for (const s of game.soldiers) s.update(dt);
  game.soldiers = game.soldiers.filter((s) => !s.removed);
  if (game.state !== 'playing') return; // a breach may have ended the game

  game.gun.update(dt, input.firing);
  hud.setHeat(game.gun.heat, game.gun.overheated);

  let engine = 0;
  for (const b of game.boats) {
    if (b.state === 'approach') engine += 1 / (1 + Math.abs(b.group.position.z) / 60);
  }
  audio.setEngine(engine);
}

let last = performance.now();
let acc = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - last) / 1000) * game.timeScale;
  last = now;

  if (game.state === 'playing') {
    acc += dt;
    let steps = 0;
    while (acc >= STEP && steps < 6 * game.timeScale) {
      update(STEP);
      acc -= STEP;
      steps++;
    }
  } else if (game.state !== 'paused') {
    game.time += dt;
    acc = 0;
  }
  if (game.state !== 'paused') effects.update(dt);

  game.shake *= Math.exp(-dt * 8);
  const sx = (Math.random() - 0.5) * game.shake;
  const sy = (Math.random() - 0.5) * game.shake;
  camera.rotation.set(input.pitch + sy, input.yaw + sx, 0);
  world.update(game.time);
  renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

hud.showMenu(loadBest());
requestAnimationFrame(frame);

if (DEBUG) {
  window.game = game;
  game.start = startGame;
  game.setAim = (yaw, pitch) => {
    input.yaw = yaw;
    input.pitch = pitch;
  };
  game.setFiring = (on) => {
    input.firing = on;
  };
}
