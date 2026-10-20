/* ============================================================
   ASTRAL FANTASY — core utilities, audio, asset loading
   ============================================================ */

/* ── math / random ─────────────────────────────────────────── */
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const rnd = (a = 1, b = 0) => b + Math.random() * (a - b);
const rndInt = n => Math.floor(Math.random() * n);
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const fmt = n => Math.round(n).toLocaleString('en-US');
const wait = ms => new Promise(r => setTimeout(r, ms));

/* ── dom ───────────────────────────────────────────────────── */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const el = (tag, cls, html) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html != null) n.innerHTML = html;
  return n;
};
const icon = (id, cls = '') => `<svg class="${cls}" aria-hidden="true"><use href="#${id}"/></svg>`;

function toast(msg, ms = 2200) {
  const t = $('#toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => (t.hidden = true), ms);
}

/* ── asset loading ─────────────────────────────────────────── */
const ART = { sheets: {}, images: {}, ready: false, progress: 0 };

function loadImage(src) {
  return new Promise(res => {
    const im = new Image();
    let done = false;
    const finish = val => { if (done) return; done = true; res(val); };
    im.onload = () => finish(im);
    im.onerror = () => { console.warn('missing asset', src); finish(null); };
    // never let a slow host stall the boot screen
    setTimeout(() => finish(null), 9000);
    im.src = src;
  });
}

async function preload(onProgress) {
  const jobs = [];
  const push = (src, key, bucket) => {
    jobs.push(loadImage(src).then(img => { if (img) ART[bucket][key] = img; }));
  };

  // hero sprite sheets
  for (const id of AF.CLASS_ORDER) {
    const c = AF.CLASSES[id];
    const files = new Set(Object.values(c.anims).flat().filter(Boolean));
    for (const f of files) push(`${c.dir}/${f}.png`, `${id}:${f}`, 'sheets');
  }
  // backgrounds + item icons
  push('assets/ui/loading.jpg', 'loading', 'images');
  push('assets/ui/home.jpg', 'home', 'images');
  for (const d of AF.DUNGEONS) push(d.art, 'd:' + d.id, 'images');
  for (const [k, it] of Object.entries(AF.ITEMS)) if (it.icon) push(it.icon, k, 'images');

  let done = 0;
  await Promise.all(jobs.map(p => p.then(() => {
    done++;
    ART.progress = done / jobs.length;
    if (onProgress) onProgress(ART.progress);
  })));
  ART.ready = true;
}

function sheet(heroId, frameName) {
  return ART.sheets[`${heroId}:${frameName}`] || null;
}

/* ── audio ─────────────────────────────────────────────────── */
const AUDIO = {
  ctx: null, master: null, musicGain: null, sfxGain: null,
  musicOn: true, sfxOn: true, musicVol: 0.5, sfxVol: 0.7,
  mood: null, timer: null, step: 0, nextTime: 0,

  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.9;
    this.master.connect(this.ctx.destination);
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = this.musicOn ? this.musicVol * 0.5 : 0;
    this.musicGain.connect(this.master);
    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = this.sfxOn ? this.sfxVol : 0;
    this.sfxGain.connect(this.master);
    this.noise = this.makeNoise();
  },
  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); },
  makeNoise() {
    const len = this.ctx.sampleRate * 1.2;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    return buf;
  },
  setMusicVolume(v) {
    this.musicVol = v;
    this.musicOn = v > 0.01;
    if (this.musicGain) this.musicGain.gain.value = this.musicOn ? v * 0.5 : 0;
  },
  setSfxVolume(v) {
    this.sfxVol = v;
    this.sfxOn = v > 0.01;
    if (this.sfxGain) this.sfxGain.gain.value = this.sfxOn ? v : 0;
  },
  tone({ freq = 440, type = 'sine', dur = 0.2, vol = 0.2, slide = 0, dest = null, attack = 0.005 }) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(dest || this.sfxGain);
    o.start(t); o.stop(t + dur + 0.05);
  },
  noiseHit({ dur = 0.18, vol = 0.3, freq = 1200, q = 1, type = 'lowpass', dest = null }) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const s = this.ctx.createBufferSource(); s.buffer = this.noise;
    const f = this.ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(dest || this.sfxGain);
    s.start(t); s.stop(t + dur);
  },
  sfx(name) {
    if (!this.ctx || !this.sfxOn) return;
    switch (name) {
      case 'click': this.tone({ freq: 660, type: 'triangle', dur: 0.06, vol: 0.10 }); break;
      case 'hover': this.tone({ freq: 880, type: 'sine', dur: 0.04, vol: 0.04 }); break;
      case 'slash': this.noiseHit({ dur: 0.16, vol: 0.22, freq: 2600, type: 'highpass' }); this.tone({ freq: 320, type: 'sawtooth', dur: 0.1, vol: 0.07, slide: -180 }); break;
      case 'hit': this.noiseHit({ dur: 0.12, vol: 0.3, freq: 700 }); this.tone({ freq: 150, type: 'square', dur: 0.1, vol: 0.12, slide: -60 }); break;
      case 'crit': this.noiseHit({ dur: 0.2, vol: 0.32, freq: 1500 }); this.tone({ freq: 520, type: 'square', dur: 0.16, vol: 0.12, slide: -260 }); break;
      case 'hurt': this.tone({ freq: 220, type: 'sawtooth', dur: 0.28, vol: 0.16, slide: -120 }); this.noiseHit({ dur: 0.18, vol: 0.18, freq: 420 }); break;
      case 'dash': this.noiseHit({ dur: 0.22, vol: 0.14, freq: 1800, type: 'bandpass', q: 0.7 }); break;
      case 'cast': this.tone({ freq: 380, type: 'sine', dur: 0.42, vol: 0.14, slide: 520 }); this.tone({ freq: 570, type: 'triangle', dur: 0.36, vol: 0.08, slide: 640 }); break;
      case 'potion': this.tone({ freq: 520, type: 'sine', dur: 0.22, vol: 0.1, slide: 260 }); this.tone({ freq: 780, type: 'sine', dur: 0.3, vol: 0.07, slide: 320 }); break;
      case 'coin': this.tone({ freq: 1180, type: 'triangle', dur: 0.1, vol: 0.1 }); setTimeout(() => this.tone({ freq: 1560, type: 'triangle', dur: 0.13, vol: 0.09 }), 70); break;
      case 'chest': this.tone({ freq: 300, type: 'triangle', dur: 0.16, vol: 0.12 }); setTimeout(() => { this.tone({ freq: 760, type: 'sine', dur: 0.3, vol: 0.1 }); this.tone({ freq: 1140, type: 'sine', dur: 0.4, vol: 0.07 }); }, 130); break;
      case 'door': this.noiseHit({ dur: 0.6, vol: 0.25, freq: 220, type: 'lowpass' }); this.tone({ freq: 90, type: 'sine', dur: 0.6, vol: 0.16, slide: -30 }); break;
      case 'level': [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.tone({ freq: f, type: 'triangle', dur: 0.34, vol: 0.12 }), i * 95)); break;
      case 'death': [392, 349, 294, 196].forEach((f, i) => setTimeout(() => this.tone({ freq: f, type: 'sawtooth', dur: 0.5, vol: 0.1 }), i * 180)); break;
      case 'boss': [110, 138, 165].forEach((f, i) => setTimeout(() => this.tone({ freq: f, type: 'sawtooth', dur: 0.9, vol: 0.13, slide: -20 }), i * 180)); break;
      case 'error': this.tone({ freq: 160, type: 'square', dur: 0.12, vol: 0.1, slide: -40 }); break;
      case 'victory': [523, 659, 784, 1046, 1318].forEach((f, i) => setTimeout(() => this.tone({ freq: f, type: 'triangle', dur: 0.5, vol: 0.11 }), i * 130)); break;
    }
  },

  /* generative ambient score — a slow minor-key arpeggio */
  startMusic(mood = 'home') {
    if (!this.ctx) return;
    if (this.mood === mood) return;
    this.mood = mood;
    this.stopMusic(true);
    const scales = {
      home:   [146.83, 174.61, 196.00, 220.00, 261.63, 293.66],
      menu:   [130.81, 155.56, 174.61, 196.00, 233.08, 261.63],
      combat: [110.00, 130.81, 146.83, 164.81, 196.00, 220.00],
      boss:   [98.00, 116.54, 138.59, 146.83, 174.61, 196.00],
      victory:[146.83, 174.61, 220.00, 261.63, 293.66, 349.23]
    };
    const scale = scales[mood] || scales.home;
    const tempo = mood === 'boss' ? 340 : mood === 'combat' ? 400 : 620;
    this.step = 0;
    clearInterval(this.timer);
    this.timer = setInterval(() => {
      if (!this.ctx || !this.musicOn) return;
      const i = this.step;
      const note = scale[(i * 3 + (i > 7 ? 1 : 0)) % scale.length] * (i % 8 === 7 ? 2 : 1);
      const t = this.ctx.currentTime;
      // soft plucked melody
      if (i % 2 === 0 || Math.random() < 0.3) this.tone({ freq: note, type: 'triangle', dur: 1.6, vol: 0.055, dest: this.musicGain, attack: 0.05 });
      // low drone every 8 steps
      if (i % 8 === 0) {
        this.tone({ freq: scale[0] / 2, type: 'sine', dur: 3.4, vol: 0.10, dest: this.musicGain, attack: 0.7 });
        if (mood === 'combat' || mood === 'boss') this.tone({ freq: scale[0] / 2, type: 'sawtooth', dur: 2.2, vol: 0.035, dest: this.musicGain, attack: 0.4 });
      }
      if (mood === 'combat' || mood === 'boss') {
        if (i % 4 === 0) this.noiseHit({ dur: 0.14, vol: 0.10, freq: 160, type: 'lowpass', dest: this.musicGain });
        if (i % 4 === 2) this.noiseHit({ dur: 0.08, vol: 0.05, freq: 900, type: 'bandpass', dest: this.musicGain });
      }
      this.step++;
    }, tempo);
  },
  stopMusic(keepMood) {
    clearInterval(this.timer);
    this.timer = null;
    if (!keepMood) this.mood = null;
  }
};
