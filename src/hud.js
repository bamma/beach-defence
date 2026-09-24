const $ = (id) => document.getElementById(id);

export class Hud {
  constructor() {
    this.root = $('hud');
    this.score = $('score');
    this.wave = $('wave');
    this.lives = $('lives');
    this.heatFill = $('heat-fill');
    this.heatWarn = $('heat-warn');
    this.bannerEl = $('banner');
    this.damage = $('damage');
    this.overlay = $('overlay');
    this.bannerTimer = 0;
    this.lastHeat = -1;
  }

  setScore(v) {
    this.score.textContent = v.toLocaleString();
  }

  setWave(v) {
    this.wave.textContent = v;
  }

  setLives(v, max) {
    if (this.lives.children.length !== max) {
      this.lives.innerHTML = '';
      for (let i = 0; i < max; i++) {
        const d = document.createElement('div');
        d.className = 'pip';
        this.lives.appendChild(d);
      }
    }
    [...this.lives.children].forEach((d, i) => d.classList.toggle('lost', i >= v));
  }

  setHeat(heat, overheated) {
    const pct = Math.round(heat * 100);
    if (pct !== this.lastHeat) {
      this.heatFill.style.width = `${pct}%`;
      this.lastHeat = pct;
    }
    this.heatWarn.classList.toggle('show', overheated);
  }

  banner(text) {
    this.bannerEl.textContent = text;
    this.bannerEl.classList.add('show');
    clearTimeout(this.bannerTimer);
    this.bannerTimer = setTimeout(() => this.bannerEl.classList.remove('show'), 2200);
  }

  flashDamage() {
    this.damage.classList.add('show');
    requestAnimationFrame(() => requestAnimationFrame(() => this.damage.classList.remove('show')));
  }

  showPlaying() {
    this.overlay.classList.add('hidden');
    this.root.classList.remove('hidden');
  }

  showScreen(html) {
    this.overlay.innerHTML = `<div class="card">${html}</div>`;
    this.overlay.classList.remove('hidden');
  }

  showMenu(best) {
    this.root.classList.add('hidden');
    this.showScreen(`
      <h1>BEACH DEFENCE</h1>
      <p>Enemy landing craft are heading for the beach. Man the machine gun and hold the line.</p>
      <p class="controls"><b>Mouse</b> aim &nbsp;·&nbsp; <b>Left click / Space</b> fire &nbsp;·&nbsp; <b>Esc</b> pause<br/>
      Keep bursts short: an overheated barrel locks up. Sink boats before they land.</p>
      ${best ? `<p class="controls">Best score: ${best.toLocaleString()}</p>` : ''}
      <div class="cta">CLICK TO MAN THE GUN</div>`);
  }

  showPause() {
    this.showScreen(`<h1>PAUSED</h1><div class="cta">CLICK TO RESUME</div>`);
  }

  showGameOver(score, wave, kills, best, isBest) {
    this.root.classList.add('hidden');
    this.showScreen(`
      <h1>BEACH LOST</h1>
      <p>The enemy broke through the defence line.</p>
      <p class="stats">Score <b>${score.toLocaleString()}</b><br/>Wave ${wave} &nbsp;·&nbsp; ${kills} enemies stopped</p>
      <p class="controls">${isBest ? 'New best score!' : `Best score: ${best.toLocaleString()}`}</p>
      <div class="cta">CLICK TO PLAY AGAIN</div>`);
  }
}
