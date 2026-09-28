import mouthClosed from './assets/commander-closed.png';
import mouthOpen from './assets/commander-open.png';

const CHAR_DELAY = 0.045;
const PUNCT_DELAY = { '.': 0.28, '!': 0.28, '?': 0.28, ',': 0.14, ':': 0.14 };
const HOLD = 2.6;
const $ = (id) => document.getElementById(id);

// Placeholder mission text, cycled by wave number.
const DEMO_LINES = [
  'Soldier, landing craft spotted off the coast. Hold this beach at all costs!',
  'Good shooting. More boats inbound. Keep your bursts short and that barrel cool.',
  'They are sending everything they have. Sink them before they reach the sand!',
  'Reinforcements are hours away. Until then, this beach is yours. Do not let it fall.',
];

// Radio briefing: a portrait in a box with a typewriter speech bubble.
// Driven by the game loop so it freezes when the game is paused.
export class Briefing {
  constructor(audio) {
    this.audio = audio;
    this.root = $('briefing');
    this.typed = $('briefing-typed');
    this.rest = $('briefing-rest');
    this.closedImg = $('briefing-closed');
    this.openImg = $('briefing-open');
    this.closedImg.src = mouthClosed;
    this.openImg.src = mouthOpen;
    this.active = false;
    this.text = '';
  }

  demoLine(wave) {
    return DEMO_LINES[(wave - 1) % DEMO_LINES.length];
  }

  show(text) {
    this.text = text;
    this.idx = 0;
    this.t = 0.35;
    this.hold = HOLD;
    this.letters = 0;
    this.active = true;
    this.render();
    this.setMouth(false);
    this.root.classList.remove('hidden');
  }

  hide() {
    this.active = false;
    this.root.classList.add('hidden');
  }

  skip() {
    if (!this.active) return;
    if (this.idx < this.text.length) {
      this.idx = this.text.length;
      this.render();
      this.setMouth(false);
    } else {
      this.hide();
    }
  }

  setMouth(open) {
    this.openImg.style.visibility = open ? 'visible' : 'hidden';
  }

  render() {
    this.typed.textContent = this.text.slice(0, this.idx);
    // The untyped remainder is kept invisible so the bubble never reflows.
    this.rest.textContent = this.text.slice(this.idx);
  }

  update(dt) {
    if (!this.active) return;
    if (this.idx >= this.text.length) {
      this.hold -= dt;
      if (this.hold <= 0) this.hide();
      return;
    }
    this.t -= dt;
    while (this.t <= 0 && this.idx < this.text.length) {
      const ch = this.text[this.idx++];
      this.t += PUNCT_DELAY[ch] ?? CHAR_DELAY;
      if (/[a-z0-9]/i.test(ch)) {
        // Alternate open/closed per letter so the mouth flaps while talking.
        this.letters++;
        this.setMouth(this.letters % 2 === 1);
        this.audio.blip(ch);
      } else {
        this.setMouth(false);
      }
    }
    this.render();
    if (this.idx >= this.text.length) this.setMouth(false);
  }
}
