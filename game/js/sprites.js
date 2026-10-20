/* ============================================================
   ASTRAL FANTASY — hero sprite animation + procedural monsters
   ============================================================ */

/* ── colour helpers ───────────────────────────────────────── */
function hexToRgb(h) {
  h = h.replace('#', '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function shade(hex, amt) {
  const [r, g, b] = hexToRgb(hex);
  const f = v => clamp(Math.round(v + amt), 0, 255);
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}
function rgba(hex, a) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}
const R = (ctx, c, x, y, w, h) => { ctx.fillStyle = c; ctx.fillRect(x | 0, y | 0, w | 0, h | 0); };

/* ── hero animation ───────────────────────────────────────── */
const HERO_ANIM = {
  idle: { fps: 7, loop: true, file: 'idle' },
  run: { fps: 13, loop: true, file: 'run' },
  walk: { fps: 10, loop: true, file: 'walk' },
  atk: { fps: 18, loop: false, file: 'atk' },
  cast: { fps: 13, loop: false, file: 'cast' },
  hurt: { fps: 14, loop: false, file: 'hurt' },
  dead: { fps: 8, loop: false, file: 'dead' }
};

function animFile(cls, anim, variant) {
  const a = cls.anims;
  if (anim === 'atk') {
    const arr = a.atk || [a.idle];
    return arr[variant % arr.length];
  }
  if (anim === 'cast') return a.cast || a.atk && a.atk[0] || a.idle;
  return a[anim] || a.idle;
}

/**
 * Draw an animated hero. (x,y) is the point between the feet.
 * opts: { flip, variant, animTime, scale, alpha, hitFlash }
 */
function drawHero(ctx, heroId, anim, x, y, t, opts = {}) {
  const cls = AF.CLASSES[heroId];
  if (!cls) return;
  const meta = HERO_ANIM[anim] || HERO_ANIM.idle;
  const file = animFile(cls, anim, opts.variant || 0);
  const img = sheet(heroId, file);
  if (!img) return;

  const frames = Math.max(1, Math.floor(img.width / cls.fw));
  const at = opts.animTime != null ? opts.animTime : t;
  let idx = meta.loop
    ? Math.floor(at * meta.fps) % frames
    : Math.min(frames - 1, Math.floor(at * meta.fps));

  const scale = (opts.scale || 1) * cls.scale;
  const w = cls.fw * scale, h = cls.fh * scale;
  // sheets are not perfectly centred — anchor on the hero's feet instead of the frame
  const cx = cls.cx != null ? cls.cx : 0.5;
  const dx = Math.round(x - w * cx);
  const dy = Math.round(y - h);

  ctx.save();
  if (opts.alpha != null) ctx.globalAlpha = opts.alpha;
  if (opts.flip) {
    ctx.translate(Math.round(x), 0);
    ctx.scale(-1, 1);
    ctx.translate(-Math.round(x), 0);
  }
  ctx.drawImage(img, idx * cls.fw, 0, cls.fw, cls.fh, dx, dy, Math.round(w), Math.round(h));
  if (opts.hitFlash) {
    ctx.globalCompositeOperation = 'source-atop';
    ctx.globalAlpha = opts.hitFlash;
    ctx.fillStyle = '#fff';
    ctx.fillRect(dx, dy, Math.ceil(w), Math.ceil(h));
  }
  ctx.restore();
}

function drawShadow(ctx, x, y, rx, ry = rx * 0.36, alpha = 0.32) {
  ctx.save();
  const g = ctx.createRadialGradient(x, y, 0, x, y, rx);
  g.addColorStop(0, `rgba(0,0,0,${alpha})`);
  g.addColorStop(0.7, `rgba(0,0,0,${alpha * 0.55})`);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/* ── animated portraits ───────────────────────────────────── */
AF.portraits = {
  list: [],
  add(canvas, heroId, opts = {}) {
    if (!canvas) return;
    // drop dead canvases and refresh existing entries (avoids duplicate draws)
    this.list = this.list.filter(e => document.contains(e.canvas));
    const existing = this.list.find(e => e.canvas === canvas);
    if (existing) { existing.heroId = heroId; existing.opts = opts; }
    else this.list.push({ canvas, ctx: canvas.getContext('2d'), heroId, opts, t: 0 });
    this.loop();
  },
  clear() { this.list = []; },
  loop() {
    if (this._on) return;
    this._on = true;
    const tick = () => {
      const now = performance.now() / 1000;
      for (const e of this.list) {
        const { canvas, ctx } = e;
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        const cw = Math.max(48, Math.round((canvas.clientWidth || 96) * dpr));
        const ch = Math.max(48, Math.round((canvas.clientHeight || 96) * dpr));
        if (canvas.width !== cw || canvas.height !== ch) { canvas.width = cw; canvas.height = ch; }
        ctx.clearRect(0, 0, cw, ch);
        const cls = AF.CLASSES[e.heroId];
        if (!cls) continue;
        const anim = e.opts.anim || 'idle';
        // soft halo behind the hero so dark sprites read against the panel
        const halo = ctx.createRadialGradient(cw / 2, ch * 0.55, 0, cw / 2, ch * 0.6, Math.max(cw, ch) * 0.55);
        halo.addColorStop(0, 'rgba(150,190,255,.16)');
        halo.addColorStop(1, 'rgba(150,190,255,0)');
        ctx.fillStyle = halo;
        ctx.fillRect(0, 0, cw, ch);
        // fit the hero to the container height, centred horizontally
        const scale = (ch / cls.fh) * (e.opts.zoom || 1);
        drawHero(ctx, e.heroId, anim, cw / 2, ch * (e.opts.anchor || 1), now, { scale });
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
};

/* ============================================================
   MONSTERS — drawn procedurally in the hero's pixel idiom
   ============================================================ */

/* art helpers -------------------------------------------------- */
function glowAt(ctx, x, y, r, color, a = 1) {
  if (r <= 0) return;
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(${color},${0.72 * a})`);
  g.addColorStop(0.45, `rgba(${color},${0.26 * a})`);
  g.addColorStop(1, `rgba(${color},0)`);
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
}
function blob(ctx, x, y, rx, ry, color, rot = 0) {
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); ctx.fill();
}
/* bright eye with a dark socket and a hard glint */
function beastEye(ctx, x, y, w, h, color, glow = null) {
  R(ctx, 'rgba(6,8,12,.85)', x - 2, y - 2, w + 4, h + 4);
  if (glow) { ctx.save(); ctx.shadowColor = glow; ctx.shadowBlur = 7; }
  R(ctx, color, x, y, w, h);
  if (glow) ctx.restore();
  R(ctx, 'rgba(255,255,255,.92)', x + 1, y + 1, 1, 1);
  R(ctx, 'rgba(255,255,255,.45)', x + 1, y + 2, 1, 1);
}

/* ── slime ────────────────────────────────────────────────── */
function drawSlime(ctx, x, y, t, st = {}) {
  const sq = 1 + Math.sin(t * 5) * 0.09;
  const w = 36 * sq, h = 29 / sq;
  const bob = st.hop || 0;
  const bx = x - w / 2, by = y - h - bob;
  const mid = st.tint || '#5fcf6f';
  drawShadow(ctx, x, y + 1, 20 * sq, 7, 0.38);
  // dark silhouette so the jelly reads against the floor
  blob(ctx, x, by + h * 0.56, w / 2 + 1.6, h / 2 + 1.4, shade(mid, -110));
  // body
  const g = ctx.createLinearGradient(0, by, 0, by + h);
  g.addColorStop(0, shade(mid, 52));
  g.addColorStop(0.5, mid);
  g.addColorStop(1, shade(mid, -62));
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.ellipse(x, by + h * 0.56, w / 2, h / 2, 0, 0, Math.PI * 2); ctx.fill();
  // settled base + drips
  R(ctx, shade(mid, -78), bx + 2, by + h - 4, w - 4, 4);
  R(ctx, shade(mid, -50), bx + 5, by + h - 1, w - 11, 1);
  R(ctx, shade(mid, -30), bx + 3, by + h - 2, 3, 2);
  R(ctx, shade(mid, -30), bx + w - 7, by + h - 2, 3, 2);
  // inner nucleus, drifting inside the jelly
  const nx = x + Math.sin(t * 1.6) * 2.4, ny = by + h * 0.55 + Math.cos(t * 1.3) * 1.6;
  blob(ctx, nx, ny, w * 0.19, h * 0.24, shade(mid, -34));
  blob(ctx, nx - 1, ny - 1, w * 0.1, h * 0.12, shade(mid, -8));
  // glossy speculars
  blob(ctx, bx + w * 0.3, by + h * 0.28, w * 0.15, h * 0.12, 'rgba(240,255,235,.5)', -0.5);
  blob(ctx, bx + w * 0.24, by + h * 0.24, w * 0.06, h * 0.05, 'rgba(255,255,255,.9)', -0.5);
  R(ctx, 'rgba(240,255,235,.28)', bx + w * 0.6, by + h * 0.2, 3, 2);
  // eyes (occasional blink)
  const blink = Math.sin(t * 0.9) > 0.985;
  if (blink) {
    R(ctx, '#10201a', x - 8, by + h * 0.44, 5, 1);
    R(ctx, '#10201a', x + 3, by + h * 0.44, 5, 1);
  } else {
    beastEye(ctx, x - 8, by + h * 0.4, 5, 6, '#0f2018');
    beastEye(ctx, x + 3, by + h * 0.4, 5, 6, '#0f2018');
  }
  // mouth: a wide grin that breathes
  const mw = 9 + Math.sin(t * 4) * 1.4;
  const my = by + h * 0.73;
  R(ctx, shade(mid, -95), x - mw / 2, my, mw, 2);
  R(ctx, shade(mid, -70), x - mw / 2 - 1, my - 1, 2, 1);
  R(ctx, shade(mid, -70), x + mw / 2 - 1, my - 1, 2, 1);
  R(ctx, 'rgba(255,255,255,.28)', x - 2, my, 3, 1);
  // spore motes
  for (let i = 0; i < 3; i++) {
    const a = t * 1.1 + i * 2.1;
    R(ctx, 'rgba(210,255,190,.35)', x + Math.sin(a) * (w * 0.7), by + h * 0.3 + Math.cos(a * 1.4) * 12, 2, 2);
  }
}

/* ── bat ──────────────────────────────────────────────────── */
function drawBat(ctx, x, y, t, st = {}) {
  const flap = Math.sin(t * 13) * 6;
  const bob = Math.sin(t * 4) * 3 + (st.hop || 0);
  const cy = y - 28 - bob;
  const c = st.tint || '#7a5ad6';
  drawShadow(ctx, x, y + 1, 13, 4.5, 0.26);
  glowAt(ctx, x, cy + 2, 30, '120,80,220', 0.22);
  const wing = (dir, col, inset) => {
    ctx.beginPath();
    ctx.moveTo(x + dir * (6 + inset), cy - 4);
    ctx.quadraticCurveTo(x + dir * (26 - inset), cy - 12 - flap, x + dir * (34 - inset * 2), cy - 2 - flap);
    ctx.quadraticCurveTo(x + dir * (26 - inset), cy - 2 - flap * 0.5, x + dir * (22 - inset), cy + 6 - flap * 0.3);
    ctx.quadraticCurveTo(x + dir * (16 - inset), cy + 2, x + dir * (12 - inset), cy + 9);
    ctx.closePath();
    ctx.fillStyle = col;
    ctx.fill();
  };
  wing(-1, shade(c, -78), 0); wing(1, shade(c, -78), 0);
  wing(-1, c, 2); wing(1, c, 2);
  // wing struts
  ctx.strokeStyle = shade(c, -95); ctx.lineWidth = 1;
  for (const d of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(x + d * 8, cy - 2);
    ctx.lineTo(x + d * 24, cy - 9 - flap);
    ctx.moveTo(x + d * 8, cy - 1);
    ctx.lineTo(x + d * 20, cy + 3 - flap * 0.4);
    ctx.stroke();
  }
  // body, fur and highlight
  blob(ctx, x, cy + 3, 8, 10, shade(c, -85));
  blob(ctx, x, cy + 3, 6.5, 8.5, shade(c, -30));
  blob(ctx, x - 1, cy + 3, 4.5, 7, shade(c, 12));
  R(ctx, shade(c, 55), x - 3, cy, 2, 5);
  // ears
  ctx.fillStyle = shade(c, -45);
  ctx.beginPath(); ctx.moveTo(x - 8, cy - 5); ctx.lineTo(x - 5, cy - 14); ctx.lineTo(x - 1, cy - 5); ctx.fill();
  ctx.beginPath(); ctx.moveTo(x + 8, cy - 5); ctx.lineTo(x + 5, cy - 14); ctx.lineTo(x + 1, cy - 5); ctx.fill();
  R(ctx, 'rgba(255,150,190,.55)', x - 6, cy - 6, 1, 4);
  R(ctx, 'rgba(255,150,190,.55)', x + 5, cy - 6, 1, 4);
  // face + eyes
  beastEye(ctx, x - 6, cy, 3, 3, '#ff6a7a', '#ff2d45');
  beastEye(ctx, x + 3, cy, 3, 3, '#ff6a7a', '#ff2d45');
  R(ctx, '#2a0e14', x - 2, cy + 5, 4, 2);
  R(ctx, '#f6f0dd', x - 2, cy + 6, 1, 3);
  R(ctx, '#f6f0dd', x + 1, cy + 6, 1, 3);
  // tail
  ctx.strokeStyle = shade(c, -60); ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.moveTo(x, cy + 12); ctx.quadraticCurveTo(x + 4, cy + 16, x + 9, cy + 13); ctx.stroke();
}

/* ── skeleton ─────────────────────────────────────────────── */
function drawSkeleton(ctx, x, y, t, st = {}) {
  const walk = Math.sin((st.animT || t) * 9) * 2;
  const c = st.tint || '#ddd6bd';
  const cy = y + (st.hop || 0);
  const eye = st.eye || '#ff8a5c';
  drawShadow(ctx, x, y + 1, 12, 4.5, 0.3);
  // thin silhouette only where it helps limbs read
  R(ctx, shade(c, -105), x - 7 + walk, cy - 13, 4, 13);
  R(ctx, shade(c, -105), x + 3 - walk, cy - 13, 4, 13);
  // legs
  R(ctx, shade(c, -25), x - 6 + walk, cy - 12, 3, 12);
  R(ctx, shade(c, 12), x - 6 + walk, cy - 12, 1, 11);
  R(ctx, shade(c, -25), x + 3 - walk, cy - 12, 3, 12);
  R(ctx, shade(c, 12), x + 3 - walk, cy - 12, 1, 11);
  R(ctx, '#3a352c', x - 8 + walk, cy - 1, 6, 2);
  R(ctx, '#3a352c', x + 2 - walk, cy - 1, 6, 2);
  // pelvis + spine
  R(ctx, shade(c, -70), x - 5, cy - 17, 11, 5);
  R(ctx, c, x - 4, cy - 16, 9, 3);
  R(ctx, shade(c, -30), x - 1, cy - 31, 3, 15);
  R(ctx, shade(c, 35), x - 1, cy - 31, 1, 14);
  // ribcage: dark cavity, then bright curved ribs
  R(ctx, '#241f18', x - 6, cy - 31, 13, 13);
  for (let i = 0; i < 4; i++) {
    const ry = cy - 30 + i * 3.2, rw = 12 - i * 1.4;
    R(ctx, shade(c, -25), x - rw / 2, ry + 2, rw, 1);
    R(ctx, c, x - rw / 2, ry, rw, 2);
    R(ctx, shade(c, 40), x - rw / 2 + 1, ry, Math.max(2, rw - 5), 1);
  }
  R(ctx, shade(c, -55), x - 2, cy - 31, 4, 12);
  R(ctx, c, x - 1, cy - 31, 2, 12);
  // collar bones
  R(ctx, c, x - 9, cy - 33, 18, 2.5);
  R(ctx, shade(c, -35), x - 9, cy - 31, 18, 1);
  // arms
  const swing = Math.sin((st.animT || t) * 9 + 1) * 2;
  R(ctx, shade(c, -10), x - 11, cy - 30, 3, 11 + swing);
  R(ctx, shade(c, -55), x - 12, cy - 30, 1, 10 + swing);
  R(ctx, shade(c, -10), x + 8, cy - 30, 3, 9);
  // skull
  blob(ctx, x, cy - 40, 8, 8, shade(c, -100));
  blob(ctx, x, cy - 40, 6.8, 6.8, c);
  blob(ctx, x - 2.4, cy - 42, 3, 3.2, shade(c, 35));
  R(ctx, shade(c, -35), x - 8, cy - 38, 1, 7);
  R(ctx, shade(c, -35), x + 7, cy - 38, 1, 7);
  R(ctx, shade(c, -20), x - 4, cy - 35, 9, 2);
  R(ctx, '#0f0d0a', x - 1, cy - 37, 2, 2);
  // eye sockets
  R(ctx, '#15130f', x - 5, cy - 41, 4, 4);
  R(ctx, '#15130f', x + 2, cy - 41, 4, 4);
  ctx.save(); ctx.shadowColor = eye; ctx.shadowBlur = 6;
  R(ctx, eye, x - 4, cy - 40, 2, 2);
  R(ctx, eye, x + 3, cy - 40, 2, 2);
  ctx.restore();
  R(ctx, '#0f0d0a', x - 1, cy - 36, 2, 2);
  // rusted sword
  const sx = x - 15, sy = cy - 32 + swing;
  R(ctx, '#5c4a32', sx, sy - 2, 2, 9);
  R(ctx, '#8d6a30', sx - 3, sy - 2, 8, 2);
  R(ctx, '#aab2bd', sx - 1, sy - 15, 3, 14);
  R(ctx, '#e8eef5', sx, sy - 15, 1, 13);
  R(ctx, 'rgba(180,120,70,.5)', sx + 1, sy - 10, 1, 6);
  // shoulder rag
  ctx.fillStyle = 'rgba(60,50,42,.75)';
  ctx.beginPath(); ctx.moveTo(x - 9, cy - 32); ctx.lineTo(x - 3, cy - 27); ctx.lineTo(x - 8, cy - 24); ctx.closePath(); ctx.fill();
}

/* ── shaman ───────────────────────────────────────────────── */
function drawShaman(ctx, x, y, t, st = {}) {
  const c = st.tint || '#a064d8';
  const bob = Math.sin(t * 3) * 2.4 + (st.hop || 0);
  const cy = y + bob;
  const eye = st.eye || '#7df0ff';
  drawShadow(ctx, x, y + 1, 13, 4.5, 0.3);
  glowAt(ctx, x, cy - 26, 26, '150,90,230', 0.2);
  // robe silhouette
  ctx.fillStyle = shade(c, -85);
  ctx.beginPath();
  ctx.moveTo(x - 11, cy - 33);
  ctx.lineTo(x + 11, cy - 33);
  ctx.lineTo(x + 14, cy - 2);
  ctx.lineTo(x + 7, cy + 1);
  ctx.lineTo(x + 3, cy - 2);
  ctx.lineTo(x - 2, cy + 1);
  ctx.lineTo(x - 6, cy - 2);
  ctx.lineTo(x - 13, cy + 1);
  ctx.closePath(); ctx.fill();
  // robe
  const g = ctx.createLinearGradient(x - 10, 0, x + 10, 0);
  g.addColorStop(0, shade(c, 30));
  g.addColorStop(0.45, c);
  g.addColorStop(1, shade(c, -55));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(x - 9, cy - 32);
  ctx.lineTo(x + 9, cy - 32);
  ctx.lineTo(x + 11.5, cy - 3);
  ctx.lineTo(x + 5, cy - 1);
  ctx.lineTo(x + 1, cy - 4);
  ctx.lineTo(x - 4, cy - 1);
  ctx.lineTo(x - 11, cy - 3);
  ctx.closePath(); ctx.fill();
  // hem + runes
  R(ctx, shade(c, 50), x - 10, cy - 8, 20, 1);
  for (let i = 0; i < 3; i++) {
    const ry = cy - 26 + i * 6;
    R(ctx, 'rgba(125,240,255,.5)', x - 5, ry, 2, 3);
    R(ctx, 'rgba(125,240,255,.28)', x + 3, ry + 2, 2, 2);
  }
  // sash
  R(ctx, shade(c, -70), x - 9, cy - 20, 18, 3);
  R(ctx, '#e0b25a', x - 2, cy - 20, 4, 3);
  // hood
  ctx.fillStyle = shade(c, -70);
  ctx.beginPath(); ctx.moveTo(x - 10, cy - 33); ctx.quadraticCurveTo(x, cy - 52, x + 10, cy - 33); ctx.closePath(); ctx.fill();
  ctx.fillStyle = c;
  ctx.beginPath(); ctx.moveTo(x - 8.5, cy - 34); ctx.quadraticCurveTo(x, cy - 49, x + 8.5, cy - 34); ctx.closePath(); ctx.fill();
  R(ctx, shade(c, 35), x - 7, cy - 41, 3, 6);
  // void face
  blob(ctx, x, cy - 37, 6, 5.5, '#0c0713');
  ctx.save(); ctx.shadowColor = eye; ctx.shadowBlur = 8;
  R(ctx, eye, x - 4, cy - 39, 3, 2);
  R(ctx, eye, x + 1, cy - 39, 3, 2);
  ctx.restore();
  // staff
  const sx = x + 14;
  R(ctx, '#4a3527', sx, cy - 46, 2, 46);
  R(ctx, '#6b4f38', sx, cy - 46, 1, 45);
  R(ctx, '#2e2018', sx - 2, cy - 50, 6, 4);
  const pulse = 0.75 + Math.sin(t * 4) * 0.25;
  glowAt(ctx, sx + 1, cy - 52, 16 * pulse, '125,240,255', 0.85);
  ctx.fillStyle = '#d9fbff';
  ctx.beginPath(); ctx.moveTo(sx + 1, cy - 60); ctx.lineTo(sx + 5, cy - 52); ctx.lineTo(sx + 1, cy - 44); ctx.lineTo(sx - 3, cy - 52); ctx.closePath(); ctx.fill();
  R(ctx, '#8ae8ff', sx, cy - 54, 2, 5);
  // orbiting motes
  for (let i = 0; i < 3; i++) {
    const a = t * 1.9 + i * 2.1;
    R(ctx, 'rgba(160,245,255,.8)', sx + Math.cos(a) * 9, cy - 52 + Math.sin(a) * 7, 2, 2);
  }
  // hand
  R(ctx, shade(c, 20), x + 9, cy - 29, 4, 4);
}

/* ── sentinel ─────────────────────────────────────────────── */
function drawSentinel(ctx, x, y, t, st = {}) {
  const c = st.tint || '#6f8db3';
  const walk = Math.sin((st.animT || t) * 4) * 1.6;
  const cy = y + (st.hop || 0);
  const eye = st.eye || '#6ff0ff';
  drawShadow(ctx, x, y + 1, 16, 5.5, 0.34);
  // silhouette
  R(ctx, shade(c, -110), x - 9, cy - 15, 8, 15);
  R(ctx, shade(c, -110), x + 1, cy - 15, 8, 15);
  R(ctx, shade(c, -110), x - 12, cy - 35, 24, 23);
  R(ctx, shade(c, -110), x - 9, cy - 50, 18, 15);
  // legs + greaves
  R(ctx, shade(c, -55), x - 8, cy - 14, 6, 14);
  R(ctx, shade(c, -18), x - 8, cy - 12, 2, 11);
  R(ctx, shade(c, -55), x + 2, cy - 14, 6, 14);
  R(ctx, shade(c, -18), x + 2, cy - 12, 2, 11);
  R(ctx, shade(c, -80), x - 9 + walk, cy - 2, 8, 3);
  R(ctx, shade(c, -80), x + 1 - walk, cy - 2, 8, 3);
  R(ctx, shade(c, -35), x - 9 + walk, cy - 6, 8, 2);
  R(ctx, shade(c, -35), x + 1 - walk, cy - 6, 8, 2);
  // tasset skirt
  R(ctx, shade(c, -45), x - 10, cy - 18, 20, 5);
  R(ctx, shade(c, -20), x - 3, cy - 18, 2, 5);
  R(ctx, shade(c, -20), x + 3, cy - 18, 2, 5);
  // torso plate
  const g = ctx.createLinearGradient(x - 10, 0, x + 10, 0);
  g.addColorStop(0, shade(c, 45));
  g.addColorStop(0.5, c);
  g.addColorStop(1, shade(c, -50));
  ctx.fillStyle = g;
  ctx.fillRect(x - 10, cy - 33, 20, 18);
  R(ctx, shade(c, 60), x - 8, cy - 32, 2, 14);
  R(ctx, shade(c, -65), x + 6, cy - 31, 3, 15);
  R(ctx, '#d8b46a', x - 1, cy - 31, 2, 15);
  R(ctx, '#f0d79a', x - 1, cy - 31, 1, 12);
  // pauldrons
  for (const d of [-1, 1]) {
    const px = d < 0 ? x - 16 : x + 7;
    R(ctx, shade(c, -55), px, cy - 34, 9, 8);
    R(ctx, shade(c, -8), px + 1, cy - 33, 7, 6);
    R(ctx, shade(c, 55), px + 1, cy - 33, 2, 5);
    R(ctx, '#c8a24e', px + 1, cy - 27, 7, 1);
  }
  // helm
  R(ctx, shade(c, -60), x - 8, cy - 48, 16, 14);
  R(ctx, shade(c, 25), x - 7, cy - 47, 14, 11);
  R(ctx, shade(c, 60), x - 5, cy - 46, 2, 9);
  R(ctx, '#0a0f16', x - 6, cy - 44, 12, 4);
  R(ctx, '#05080c', x - 6, cy - 44, 12, 1);
  ctx.save(); ctx.shadowColor = eye; ctx.shadowBlur = 7;
  R(ctx, eye, x - 5, cy - 43, 3, 2);
  R(ctx, eye, x + 2, cy - 43, 3, 2);
  ctx.restore();
  // crest
  R(ctx, '#8a1f2c', x - 1, cy - 52, 2, 5);
  R(ctx, '#d2402a', x - 2, cy - 56, 4, 5);
  R(ctx, '#ff8a5c', x - 1, cy - 55, 2, 3);
  // spear
  R(ctx, '#5c4630', x + 15, cy - 50, 2, 50);
  R(ctx, '#7d603f', x + 15, cy - 50, 1, 49);
  glowAt(ctx, x + 16, cy - 60, 10, '160,240,255', 0.5);
  ctx.fillStyle = '#dfe8f2';
  ctx.beginPath(); ctx.moveTo(x + 16, cy - 68); ctx.lineTo(x + 20, cy - 58); ctx.lineTo(x + 16, cy - 52); ctx.lineTo(x + 13, cy - 58); ctx.closePath(); ctx.fill();
  R(ctx, '#f4fbff', x + 16, cy - 66, 1, 8);
  // shield
  R(ctx, '#5b3a16', x - 22, cy - 32, 10, 17);
  R(ctx, '#b8742a', x - 21, cy - 31, 8, 15);
  R(ctx, '#e8be6f', x - 21, cy - 31, 2, 13);
  R(ctx, '#e0b25a', x - 18, cy - 26, 3, 5);
  R(ctx, '#7a4a12', x - 18, cy - 25, 3, 1);
}

/* ── bosses ───────────────────────────────────────────────── */
/* The four dungeon lords: heavier silhouettes, layered shading,
   glowing cores and idle motion so they read as set-pieces.     */

function drawWarden(ctx, x, y, t, st = {}) {
  const breathe = Math.sin(t * 1.5) * 2.4;
  const sway = Math.sin(t * 0.9) * 4;
  const glow = st.enraged ? '#ff7a3c' : '#ffe08a';
  drawShadow(ctx, x, y + 2, 62, 18, 0.45);
  glowAt(ctx, x, y - 96, 92, '110,200,120', 0.16);
  // roots gripping the floor
  for (let i = -4; i <= 4; i++) {
    const len = 16 - Math.abs(i) * 2.4;
    ctx.strokeStyle = i % 2 ? '#241a11' : '#3a2a1a';
    ctx.lineWidth = 7 - Math.abs(i) * 0.4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x + i * 9, y - 6);
    ctx.quadraticCurveTo(x + i * 15, y - 2, x + i * 19, y + 1);
    ctx.stroke();
    R(ctx, i % 2 ? '#4a3520' : '#5b4229', x + i * 9 - 2, y - 10, 5, 6 + len * 0.2);
  }
  // trunk / legs
  for (const d of [-1, 1]) {
    const px = x + d * 20;
    R(ctx, '#382718', px - 9, y - 74 + breathe, 19, 66);
    R(ctx, '#63482b', px - 6, y - 72 + breathe, 13, 62);
    R(ctx, '#87643d', px - 4, y - 70 + breathe, 7, 58);
    R(ctx, '#4a3320', px - 8, y - 22, 17, 6);
    // bark grooves
    for (let i = 0; i < 4; i++) R(ctx, 'rgba(40,28,16,.55)', px - 5 + (i % 2) * 6, y - 66 + breathe + i * 13, 2, 9);
  }
  // torso mass: layered organic shapes
  blob(ctx, x, y - 88 + breathe, 44, 36, '#2f2115');
  blob(ctx, x - 2, y - 90 + breathe, 40, 32, '#6a4d2f');
  blob(ctx, x - 8, y - 96 + breathe, 24, 20, '#87643d', -0.3);
  blob(ctx, x - 12, y - 102 + breathe, 12, 10, '#9a7649', -0.4);
  // bark ridges across the chest
  ctx.strokeStyle = 'rgba(48,34,20,.6)'; ctx.lineWidth = 2;
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath();
    ctx.moveTo(x - 34 + i * 6, y - 108 + i * 8 + breathe);
    ctx.quadraticCurveTo(x, y - 96 + i * 10 + breathe, x + 32 - i * 4, y - 104 + i * 6 + breathe);
    ctx.stroke();
  }
  // moss coat + hanging moss
  for (let i = -3; i <= 3; i++) {
    const hgt = 8 + (3 - Math.abs(i)) * 4;
    R(ctx, i % 2 ? '#5c8a45' : '#476c34', x + i * 12 - 3, y - 74 + breathe, 7, hgt);
    R(ctx, '#6fa052', x + i * 12 - 2, y - 74 + breathe, 3, 3);
  }
  for (let i = 0; i < 10; i++) {
    const a = i * 1.85;
    blob(ctx, x + Math.cos(a) * (20 + i * 1.6), y - 100 + Math.sin(a) * 17 + breathe, 6, 4.4, i % 2 ? '#5b8a44' : '#487236');
  }
  // mushrooms on the shoulder
  for (let i = 0; i < 3; i++) {
    const mx = x + 26 + i * 7, mh = 5 + (i % 2) * 3;
    R(ctx, '#d8e4d0', mx, y - 104 + breathe - mh, 2, mh);
    blob(ctx, mx + 1, y - 104 + breathe - mh, 4.5, 2.6, '#c86b8f');
  }
  // arms: tapered branches that end in claws
  ctx.lineCap = 'round';
  const arm = (d, phase) => {
    const s2 = Math.sin(t * 1.7 + phase) * 6;
    ctx.strokeStyle = '#3a2a1a'; ctx.lineWidth = 12;
    ctx.beginPath();
    ctx.moveTo(x + d * 34, y - 100 + breathe);
    ctx.quadraticCurveTo(x + d * 60, y - 112 + s2, x + d * 70, y - 138 + s2);
    ctx.stroke();
    ctx.strokeStyle = '#6a4d2f'; ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(x + d * 35, y - 101 + breathe);
    ctx.quadraticCurveTo(x + d * 58, y - 112 + s2, x + d * 69, y - 137 + s2);
    ctx.stroke();
    // twig claws
    ctx.strokeStyle = '#87643d'; ctx.lineWidth = 3;
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(x + d * 69, y - 137 + s2);
      ctx.lineTo(x + d * (78 + i * 3), y - 150 + s2 + i * 7);
      ctx.stroke();
    }
    return s2;
  };
  const sLeft = arm(-1, 0), sRight = arm(1, 1.6);
  // hollow face
  blob(ctx, x, y - 78 + breathe, 25, 21, '#1d130c');
  blob(ctx, x, y - 78 + breathe, 21, 17, '#120c07');
  // bark brow
  R(ctx, '#3a2a1a', x - 26, y - 92 + breathe, 52, 6);
  R(ctx, '#63482b', x - 24, y - 90 + breathe, 48, 3);
  // eyes
  ctx.save(); ctx.shadowColor = glow; ctx.shadowBlur = 22;
  blob(ctx, x - 10, y - 82 + breathe, 5.5, 4, glow);
  blob(ctx, x + 10, y - 82 + breathe, 5.5, 4, glow);
  ctx.restore();
  R(ctx, '#1a1208', x - 11, y - 82 + breathe, 3, 2);
  R(ctx, '#1a1208', x + 8, y - 82 + breathe, 3, 2);
  // toothy maw
  R(ctx, '#0d0805', x - 10, y - 66 + breathe, 20, 7);
  for (let i = 0; i < 4; i++) {
    R(ctx, '#e8e2c8', x - 9 + i * 5, y - 66 + breathe, 2, 3);
    R(ctx, '#cdc4a6', x - 8 + i * 5, y - 62 + breathe, 2, 2);
  }
  // drifting leaves
  for (let i = 0; i < 6; i++) {
    const a = t * 0.5 + i * 1.7;
    const lx = x + Math.sin(a) * (34 + i * 6);
    const ly = y - 158 + ((t * 18 + i * 34) % 120);
    blob(ctx, lx, ly, 3.4, 1.9, i % 2 ? 'rgba(126,176,96,.55)' : 'rgba(96,146,74,.45)', a);
  }
}

function drawTyrant(ctx, x, y, t, st = {}) {
  const breathe = Math.sin(t * 1.8) * 2.6;
  const pulse = 0.55 + Math.sin(t * 3.4) * 0.35;
  const sway = Math.sin(t * 2.1) * 7;
  drawShadow(ctx, x, y + 2, 66, 19, 0.46);
  glowAt(ctx, x, y - 80, 104, '255,110,40', 0.2);
  // legs: chunky basalt columns
  for (const d of [-1, 1]) {
    const px = x + d * 22;
    R(ctx, '#241012', px - 12, y - 54 + breathe, 25, 54);
    R(ctx, '#4a2320', px - 10, y - 52 + breathe, 21, 50);
    R(ctx, '#6a352c', px - 8, y - 50 + breathe, 12, 46);
    R(ctx, '#2a1315', px - 13, y - 7, 27, 7);
    R(ctx, '#3f1e1c', px - 11, y - 5, 23, 4);
  }
  // torso: faceted rock shell
  ctx.fillStyle = '#2b1416';
  ctx.beginPath();
  ctx.moveTo(x - 44, y - 74 + breathe);
  ctx.lineTo(x - 36, y - 112 + breathe);
  ctx.lineTo(x - 8, y - 126 + breathe);
  ctx.lineTo(x + 26, y - 120 + breathe);
  ctx.lineTo(x + 42, y - 92 + breathe);
  ctx.lineTo(x + 34, y - 66 + breathe);
  ctx.lineTo(x - 6, y - 58 + breathe);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#582c28';
  ctx.beginPath();
  ctx.moveTo(x - 40, y - 76 + breathe);
  ctx.lineTo(x - 33, y - 110 + breathe);
  ctx.lineTo(x - 8, y - 122 + breathe);
  ctx.lineTo(x + 23, y - 116 + breathe);
  ctx.lineTo(x + 38, y - 90 + breathe);
  ctx.lineTo(x + 30, y - 68 + breathe);
  ctx.lineTo(x - 5, y - 61 + breathe);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#6d3730';
  ctx.beginPath();
  ctx.moveTo(x - 33, y - 108 + breathe);
  ctx.lineTo(x - 8, y - 120 + breathe);
  ctx.lineTo(x + 4, y - 98 + breathe);
  ctx.lineTo(x - 18, y - 84 + breathe);
  ctx.closePath(); ctx.fill();
  // magma core in the chest
  glowAt(ctx, x - 2, y - 94 + breathe, 26, '255,120,40', 0.5 + pulse * 0.4);
  blob(ctx, x - 2, y - 94 + breathe, 9 + pulse * 2, 11 + pulse * 2, `rgba(255,150,60,${0.65 + pulse * 0.3})`);
  blob(ctx, x - 2, y - 94 + breathe, 4.5, 6, '#fff0b8');
  // glowing seams
  ctx.save();
  ctx.shadowColor = '#ff6a20'; ctx.shadowBlur = 12;
  ctx.strokeStyle = `rgba(255,120,50,${0.5 + pulse * 0.45})`;
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(x - 34, y - 108 + breathe); ctx.lineTo(x - 20, y - 96 + breathe); ctx.lineTo(x - 30, y - 74 + breathe);
  ctx.moveTo(x + 22, y - 112 + breathe); ctx.lineTo(x + 10, y - 96 + breathe); ctx.lineTo(x + 20, y - 70 + breathe);
  ctx.moveTo(x - 4, y - 122 + breathe); ctx.lineTo(x + 2, y - 110 + breathe);
  ctx.moveTo(x - 16, y - 66 + breathe); ctx.lineTo(x - 6, y - 58 + breathe);
  ctx.stroke();
  ctx.restore();
  // shoulder boulders
  for (const d of [-1, 1]) {
    const px = x + d * 46, py = y - 112 + breathe;
    blob(ctx, px, py, 19, 16, '#2a1416');
    blob(ctx, px - d * 1.5, py - 1, 16.5, 13.5, '#5a2e26');
    blob(ctx, px - d * 4, py - 4, 8, 6.5, '#7a4030', -0.3);
    R(ctx, `rgba(255,130,50,${0.35 + pulse * 0.3})`, px - 6, py + 6, 12, 2);
  }
  // arms with molten cracks
  ctx.lineCap = 'round';
  for (const d of [-1, 1]) {
    const s2 = d < 0 ? sway : -sway;
    ctx.strokeStyle = '#2f1618'; ctx.lineWidth = 16;
    ctx.beginPath();
    ctx.moveTo(x + d * 46, y - 96 + breathe);
    ctx.quadraticCurveTo(x + d * 60, y - 76, x + d * 66, y - 56 + s2);
    ctx.stroke();
    ctx.strokeStyle = '#5a2e24'; ctx.lineWidth = 11;
    ctx.beginPath();
    ctx.moveTo(x + d * 46, y - 96 + breathe);
    ctx.quadraticCurveTo(x + d * 59, y - 76, x + d * 65, y - 56 + s2);
    ctx.stroke();
    ctx.strokeStyle = `rgba(255,120,40,${0.35 + pulse * 0.35})`; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + d * 50, y - 90 + breathe);
    ctx.quadraticCurveTo(x + d * 58, y - 74, x + d * 62, y - 62 + s2);
    ctx.stroke();
    // fists
    const fx = x + d * 66, fy = y - 52 + s2;
    blob(ctx, fx, fy, 14, 13, '#3a1b1a');
    blob(ctx, fx, fy - 1, 12, 11, '#5a2e24');
    blob(ctx, fx - d * 2, fy - 4, 6, 5, '#7b4433');
    R(ctx, '#241011', fx - 12, fy + 8, 24, 4);
    for (let i = -1; i <= 1; i++) R(ctx, '#c9bfa4', fx + i * 7 - 2, fy + 10, 3, 4);
  }
  // head: horned skull of rock
  blob(ctx, x, y - 128 + breathe, 27, 23, '#2b1416');
  blob(ctx, x - 1, y - 130 + breathe, 23.5, 19.5, '#5b2c26');
  blob(ctx, x - 8, y - 134 + breathe, 12, 9, '#723a31', -0.3);
  // brow ridge
  R(ctx, '#3a1c1a', x - 20, y - 140 + breathe, 40, 5);
  // horns
  for (const d of [-1, 1]) {
    ctx.fillStyle = '#d9c39a';
    ctx.beginPath();
    ctx.moveTo(x + d * 18, y - 146 + breathe);
    ctx.quadraticCurveTo(x + d * 34, y - 172 + breathe, x + d * 40, y - 184 + breathe);
    ctx.quadraticCurveTo(x + d * 30, y - 164 + breathe, x + d * 24, y - 148 + breathe);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#a8906c';
    ctx.beginPath();
    ctx.moveTo(x + d * 22, y - 150 + breathe);
    ctx.quadraticCurveTo(x + d * 32, y - 168 + breathe, x + d * 36, y - 178 + breathe);
    ctx.quadraticCurveTo(x + d * 30, y - 162 + breathe, x + d * 26, y - 150 + breathe);
    ctx.closePath(); ctx.fill();
  }
  // eyes
  ctx.save(); ctx.shadowColor = '#ffb020'; ctx.shadowBlur = 20;
  R(ctx, '#ffd257', x - 14, y - 132 + breathe, 10, 6);
  R(ctx, '#ffd257', x + 5, y - 132 + breathe, 10, 6);
  ctx.restore();
  R(ctx, '#3a1e00', x - 10, y - 131 + breathe, 3, 4);
  R(ctx, '#3a1e00', x + 9, y - 131 + breathe, 3, 4);
  // molten maw
  ctx.fillStyle = '#1a0b08';
  ctx.beginPath();
  ctx.moveTo(x - 15, y - 118 + breathe);
  ctx.quadraticCurveTo(x, y - 108 + breathe, x + 15, y - 118 + breathe);
  ctx.quadraticCurveTo(x, y - 114 + breathe, x - 15, y - 118 + breathe);
  ctx.fill();
  for (let i = -2; i <= 2; i++) {
    R(ctx, '#e8ddb8', x + i * 6 - 2, y - 119 + breathe, 3, 4);
    R(ctx, `rgba(255,150,60,${0.4 + pulse * 0.3})`, x + i * 6 - 2, y - 115 + breathe, 3, 2);
  }
  // rising embers
  for (let i = 0; i < 7; i++) {
    const a = t * 1.2 + i * 1.1;
    const ex = x + Math.sin(a * 1.7) * (26 + i * 5);
    const ey = y - 40 - ((t * 26 + i * 33) % 120);
    const al = 0.25 + Math.abs(Math.sin(a)) * 0.5;
    R(ctx, `rgba(255,${140 + i * 8},60,${al})`, ex, ey, 2, 2);
  }
}

function drawRevenant(ctx, x, y, t, st = {}) {
  const bob = Math.sin(t * 1.6) * 5;
  const cy = y - 14 + bob;
  const breathe = Math.sin(t * 2.2) * 1.6;
  drawShadow(ctx, x, y + 2, 36, 12, 0.3);
  // cold mist pooling on the floor
  const mist = ctx.createRadialGradient(x, y - 6, 2, x, y - 6, 52);
  mist.addColorStop(0, 'rgba(150,225,255,.18)');
  mist.addColorStop(1, 'rgba(120,200,255,0)');
  ctx.fillStyle = mist;
  ctx.beginPath(); ctx.ellipse(x, y - 6, 52, 16, 0, 0, Math.PI * 2); ctx.fill();
  // layered robe: outer fray, mid veil, inner glow
  const robe = (scale, color, wob) => {
    ctx.beginPath();
    ctx.moveTo(x - 30 * scale, cy - 86);
    ctx.lineTo(x + 30 * scale, cy - 86);
    ctx.lineTo(x + 24 * scale, cy - 30);
    ctx.lineTo(x + 16 * scale + wob, cy + 4);
    ctx.lineTo(x + 7 * scale, cy - 14);
    ctx.lineTo(x + 1 * scale - wob, cy + 12);
    ctx.lineTo(x - 7 * scale, cy - 12);
    ctx.lineTo(x - 15 * scale + wob, cy + 6);
    ctx.lineTo(x - 24 * scale, cy - 26);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  };
  const wob = Math.sin(t * 2.4) * 3;
  robe(1.06, 'rgba(30,70,110,.55)', wob);
  const g = ctx.createLinearGradient(0, cy - 100, 0, y);
  g.addColorStop(0, 'rgba(225,250,255,.94)');
  g.addColorStop(0.38, 'rgba(130,210,248,.8)');
  g.addColorStop(0.75, 'rgba(70,150,215,.45)');
  g.addColorStop(1, 'rgba(50,110,180,0)');
  ctx.save();
  ctx.shadowColor = 'rgba(150,230,255,.7)'; ctx.shadowBlur = 18;
  robe(1, g, wob);
  ctx.restore();
  // inner light core
  const cg = ctx.createRadialGradient(x, cy - 62, 0, x, cy - 62, 42);
  cg.addColorStop(0, 'rgba(235,255,255,.9)');
  cg.addColorStop(0.45, 'rgba(130,220,255,.4)');
  cg.addColorStop(1, 'rgba(70,150,255,0)');
  ctx.fillStyle = cg; ctx.beginPath(); ctx.arc(x, cy - 62, 42, 0, Math.PI * 2); ctx.fill();
  // visible ribs of light under the veil
  ctx.strokeStyle = 'rgba(235,255,255,.35)'; ctx.lineWidth = 1.6;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(x - 14 + i, cy - 62 + i * 8);
    ctx.quadraticCurveTo(x, cy - 56 + i * 8, x + 14 - i, cy - 62 + i * 8);
    ctx.stroke();
  }
  // shoulders / mantle
  blob(ctx, x - 26, cy - 92, 12, 8, 'rgba(180,235,255,.85)', -0.3);
  blob(ctx, x + 26, cy - 92, 12, 8, 'rgba(180,235,255,.85)', 0.3);
  R(ctx, 'rgba(235,255,255,.5)', x - 12, cy - 96, 24, 2);
  // hood + mask
  blob(ctx, x, cy - 100, 21, 22, 'rgba(90,170,225,.5)');
  blob(ctx, x, cy - 100, 17.5, 19, 'rgba(228,250,255,.95)');
  blob(ctx, x - 5, cy - 104, 8, 8, 'rgba(255,255,255,.55)');
  // eye sockets
  blob(ctx, x - 8, cy - 102, 5.4, 4.4, 'rgba(70,140,200,.85)');
  blob(ctx, x + 8, cy - 102, 5.4, 4.4, 'rgba(70,140,200,.85)');
  ctx.save(); ctx.shadowColor = '#baf7ff'; ctx.shadowBlur = 18;
  blob(ctx, x - 8, cy - 102, 2.6, 2.2, '#f2ffff');
  blob(ctx, x + 8, cy - 102, 2.6, 2.2, '#f2ffff');
  R(ctx, '#d8fbff', x - 6, cy - 88, 12, 2.4);
  ctx.restore();
  for (let i = 0; i < 4; i++) R(ctx, 'rgba(160,230,255,.55)', x - 6 + i * 3.4, cy - 84, 1, 3);
  // crown of ice
  for (let i = -3; i <= 3; i++) {
    const hh = i === 0 ? 26 : 20 - Math.abs(i) * 3;
    ctx.fillStyle = i % 2 ? 'rgba(190,240,255,.75)' : 'rgba(225,250,255,.92)';
    ctx.beginPath();
    ctx.moveTo(x + i * 7 - 3.4, cy - 114);
    ctx.lineTo(x + i * 7, cy - 114 - hh);
    ctx.lineTo(x + i * 7 + 3.4, cy - 114);
    ctx.closePath(); ctx.fill();
  }
  // floating shards orbit
  for (let i = 0; i < 6; i++) {
    const a = t * 0.85 + i * 1.05;
    const sx = x + Math.cos(a) * (46 + Math.sin(a * 2) * 6);
    const sy = cy - 58 + Math.sin(a * 1.4) * 36;
    ctx.save();
    ctx.translate(sx, sy); ctx.rotate(a * 0.6);
    ctx.fillStyle = 'rgba(180,240,255,.8)';
    ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(4, 0); ctx.lineTo(0, 6); ctx.lineTo(-4, 0); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.7)';
    ctx.beginPath(); ctx.moveTo(0, -5); ctx.lineTo(1.6, 0); ctx.lineTo(0, 3); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
}

function drawWyrm(ctx, x, y, t, st = {}) {
  const breathe = Math.sin(t * 1.4) * 3;
  const flap = Math.sin(t * 1.2) * 11;
  const tailSway = Math.sin(t * 1.1) * 8;
  drawShadow(ctx, x, y + 2, 76, 20, 0.48);
  glowAt(ctx, x - 10, y - 80, 110, '255,90,50', 0.14);
  // tail sweeping behind
  ctx.strokeStyle = '#3f0f12'; ctx.lineWidth = 24; ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x + 26, y - 46);
  ctx.quadraticCurveTo(x + 96, y - 30 + tailSway, x + 84, y - 104 + tailSway);
  ctx.stroke();
  ctx.strokeStyle = '#7a1f1e'; ctx.lineWidth = 16;
  ctx.beginPath();
  ctx.moveTo(x + 28, y - 48);
  ctx.quadraticCurveTo(x + 90, y - 34 + tailSway, x + 80, y - 102 + tailSway);
  ctx.stroke();
  ctx.strokeStyle = '#a8332a'; ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(x + 30, y - 52);
  ctx.quadraticCurveTo(x + 88, y - 38 + tailSway, x + 79, y - 100 + tailSway);
  ctx.stroke();
  // tail spikes + barb
  for (let i = 0; i < 4; i++) {
    const p = 0.2 + i * 0.2;
    const tx = x + 26 + (58 * p) + Math.sin(p * 3) * 6;
    const ty = y - 46 - (58 * p) + tailSway * p;
    ctx.fillStyle = '#2f0b0e';
    ctx.beginPath(); ctx.moveTo(tx - 5, ty); ctx.lineTo(tx, ty - 13 + i); ctx.lineTo(tx + 5, ty); ctx.closePath(); ctx.fill();
  }
  ctx.fillStyle = '#8a2a22';
  ctx.beginPath(); ctx.moveTo(x + 78, y - 104 + tailSway); ctx.lineTo(x + 106, y - 128 + tailSway); ctx.lineTo(x + 92, y - 92 + tailSway); ctx.fill();
  // wings behind the body
  for (const d of [-1, 1]) {
    ctx.fillStyle = '#4c1114';
    ctx.beginPath();
    ctx.moveTo(x + d * 8, y - 96 + breathe);
    ctx.quadraticCurveTo(x + d * 96, y - 186 - flap, x + d * 40, y - 60 + breathe);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#6d1a1c';
    ctx.beginPath();
    ctx.moveTo(x + d * 10, y - 94 + breathe);
    ctx.quadraticCurveTo(x + d * 88, y - 176 - flap, x + d * 36, y - 64 + breathe);
    ctx.closePath(); ctx.fill();
  }
  // wing bones
  ctx.strokeStyle = 'rgba(28,8,10,.6)'; ctx.lineWidth = 2.4;
  for (const d of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(x + d * 12, y - 92 + breathe);
      ctx.quadraticCurveTo(x + d * (52 + i * 10), y - (140 + i * 12) - flap, x + d * (26 + i * 8), y - 68 + breathe);
      ctx.stroke();
    }
  }
  // body: deep red hide with layered scales
  blob(ctx, x, y - 60 + breathe, 66, 43, '#3f0f12');
  blob(ctx, x - 3, y - 63 + breathe, 58, 36, '#8b2422');
  blob(ctx, x - 16, y - 74 + breathe, 30, 19, '#a8332a', -0.2);
  blob(ctx, x - 22, y - 80 + breathe, 15, 9, '#bd4433', -0.2);
  // scale rows
  for (let row = 0; row < 3; row++) {
    for (let i = -4; i <= 4; i++) {
      const sx = x + i * 12 + (row % 2 ? 6 : 0);
      const sy = y - 84 + row * 10 + breathe;
      if (Math.abs(sx - x) > 46) continue;
      blob(ctx, sx, sy, 5.4, 3.6, row === 0 ? 'rgba(60,12,14,.45)' : 'rgba(45,10,12,.32)');
      R(ctx, 'rgba(255,150,120,.16)', sx - 3, sy - 1, 4, 1);
    }
  }
  // belly plates
  blob(ctx, x - 4, y - 36 + breathe, 36, 15, '#c09468');
  blob(ctx, x - 4, y - 37 + breathe, 33, 12, '#d3a97c');
  for (let i = -3; i <= 3; i++) {
    R(ctx, 'rgba(120,80,50,.45)', x - 4 + i * 9 - 3, y - 42 + breathe, 7, 2);
    R(ctx, 'rgba(120,80,50,.3)', x - 4 + i * 9 - 3, y - 33 + breathe, 7, 2);
  }
  // spine ridge
  for (let i = -5; i <= 4; i++) {
    const hh = 18 - Math.abs(i) * 1.8;
    ctx.fillStyle = i % 2 ? '#2f0b0e' : '#3d1013';
    ctx.beginPath();
    ctx.moveTo(x + i * 12 - 5, y - 94 + breathe);
    ctx.lineTo(x + i * 12, y - 94 - hh + breathe);
    ctx.lineTo(x + i * 12 + 5, y - 94 + breathe);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(200,120,90,.28)';
    ctx.beginPath();
    ctx.moveTo(x + i * 12, y - 94 - hh + breathe);
    ctx.lineTo(x + i * 12 + 3, y - 94 + breathe);
    ctx.lineTo(x + i * 12, y - 94 + breathe);
    ctx.closePath(); ctx.fill();
  }
  // neck
  ctx.strokeStyle = '#8b2422'; ctx.lineWidth = 26;
  ctx.beginPath();
  ctx.moveTo(x - 30, y - 84 + breathe);
  ctx.quadraticCurveTo(x - 54, y - 120 + breathe, x - 62, y - 132 + breathe);
  ctx.stroke();
  ctx.strokeStyle = '#a8332a'; ctx.lineWidth = 16;
  ctx.beginPath();
  ctx.moveTo(x - 32, y - 86 + breathe);
  ctx.quadraticCurveTo(x - 54, y - 118 + breathe, x - 62, y - 130 + breathe);
  ctx.stroke();
  // head
  blob(ctx, x - 66, y - 136 + breathe, 30, 21, '#3f0f12', -0.28);
  blob(ctx, x - 66, y - 137 + breathe, 26, 18, '#a2312b', -0.28);
  blob(ctx, x - 72, y - 141 + breathe, 14, 10, '#bd4433', -0.3);
  // snout
  blob(ctx, x - 92, y - 130 + breathe, 22, 11, '#3f0f12', 0.12);
  blob(ctx, x - 92, y - 131 + breathe, 19, 9, '#b23a2e', 0.12);
  R(ctx, '#2a0a08', x - 100, y - 136 + breathe, 3, 3);
  R(ctx, '#2a0a08', x - 96, y - 137 + breathe, 2, 2);
  // jaw
  ctx.fillStyle = '#4a1013';
  ctx.beginPath();
  ctx.ellipse(x - 88, y - 122 + breathe, 20, 7, 0.12, 0, Math.PI * 2); ctx.fill();
  for (let i = 0; i < 6; i++) {
    R(ctx, '#f5ecd2', x - 102 + i * 6, y - 126 + breathe, 3, 6);
    R(ctx, '#cfc3a2', x - 100 + i * 6, y - 116 + breathe, 2, 4);
  }
  // horns
  for (const d of [-1, 1]) {
    ctx.fillStyle = d < 0 ? '#d8c49a' : '#b8a37b';
    ctx.beginPath();
    ctx.moveTo(x - 58 + d * 6, y - 150 + breathe);
    ctx.quadraticCurveTo(x - 46 + d * 14, y - 186 + breathe, x - 30 + d * 20, y - 194 + breathe);
    ctx.quadraticCurveTo(x - 44 + d * 12, y - 170 + breathe, x - 48 + d * 8, y - 150 + breathe);
    ctx.closePath(); ctx.fill();
  }
  // eye
  ctx.save(); ctx.shadowColor = '#ffb020'; ctx.shadowBlur = 22;
  R(ctx, '#ffd257', x - 78, y - 146 + breathe, 13, 6);
  ctx.restore();
  R(ctx, '#2b0a06', x - 74, y - 145 + breathe, 3, 4);
  R(ctx, '#fff6c8', x - 77, y - 145 + breathe, 3, 2);
  // smoke + embers from the maw
  for (let i = 0; i < 5; i++) {
    const a = t * 1.1 + i;
    R(ctx, `rgba(255,150,60,${0.3 + Math.sin(a) * 0.22})`, x - 100 + Math.sin(a) * 14, y - 112 + Math.cos(a * 1.3) * 16, 2, 2);
  }
}

/* ── registry ─────────────────────────────────────────────── */
AF.MONSTERS = {
  slime:     { draw: drawSlime,    w: 30, h: 26, cx: 0, cy: 0, art: 1.28 },
  bat:       { draw: drawBat,      w: 34, h: 34, cx: 0, cy: 10, art: 1.22 },
  skeleton:  { draw: drawSkeleton, w: 30, h: 50, cx: 0, cy: 0, art: 1.18 },
  shaman:    { draw: drawShaman,   w: 30, h: 48, cx: 0, cy: 0, art: 1.18 },
  sentinel:  { draw: drawSentinel, w: 40, h: 62, cx: 0, cy: 0, art: 1.14 },
  warden:    { draw: drawWarden,   w: 110, h: 150, cx: 0, cy: 0, boss: true, art: 0.80, aura: '120,220,140' },
  tyrant:    { draw: drawTyrant,   w: 120, h: 158, cx: 0, cy: 0, boss: true, art: 0.80, aura: '255,110,40' },
  revenant:  { draw: drawRevenant, w: 100, h: 150, cx: 0, cy: 0, boss: true, art: 0.80, aura: '150,225,255' },
  wyrm:      { draw: drawWyrm,     w: 170, h: 180, cx: 0, cy: 0, boss: true, art: 0.76, aura: '255,90,60' }
};

/* ── props ────────────────────────────────────────────────── */
function drawChest(ctx, x, y, t, opened) {
  drawShadow(ctx, x, y + 1, 16, 5, 0.34);
  const w = 28, h = 18;
  const x0 = x - w / 2, y0 = y - h;
  R(ctx, '#241408', x0 - 2, y0 + 8, w + 4, h - 4);
  R(ctx, '#5a3a1a', x0, y0 + 9, w, h - 6);
  R(ctx, '#7a4f24', x0 + 2, y0 + 11, w - 4, h - 10);
  R(ctx, '#2a1a0d', x0 + 3, y0 + 13, w - 6, 2);
  if (!opened) {
    // lid
    R(ctx, '#3b2410', x0 - 2, y0 - 1, w + 4, 11);
    R(ctx, '#6b4720', x0, y0 + 1, w, 8);
    R(ctx, '#8b5f2c', x0 + 2, y0 + 2, w - 4, 4);
    for (let i = 0; i < 4; i++) R(ctx, '#c9932f', x0 + 2 + i * 6, y0 + 3, 2, 2);
    // lock
    R(ctx, '#e0b25a', x - 3, y0 + 8, 6, 6);
    R(ctx, '#6b4a1c', x - 1, y0 + 10, 2, 3);
  } else {
    R(ctx, '#2a1a0d', x0 - 2, y0 - 5, w + 4, 7);
    const g = ctx.createRadialGradient(x, y0 + 8, 0, x, y0 + 8, 26);
    g.addColorStop(0, `rgba(255,220,130,${0.35 + Math.sin(t * 4) * 0.1})`);
    g.addColorStop(1, 'rgba(255,200,90,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y0 + 8, 26, 0, Math.PI * 2); ctx.fill();
  }
}

function drawPortal(ctx, x, y, t, active, accent = '#8fe6ff') {
  const h = 54, w = 40;
  const pulse = 0.5 + Math.sin(t * 2.4) * 0.2;
  drawShadow(ctx, x, y + 2, 24, 8, 0.3);
  // stone arch
  ctx.strokeStyle = '#2a2b36'; ctx.lineWidth = 8;
  ctx.beginPath(); ctx.moveTo(x - w / 2, y); ctx.lineTo(x - w / 2, y - h * 0.55); ctx.arc(x, y - h * 0.55, w / 2, Math.PI, 0); ctx.lineTo(x + w / 2, y); ctx.stroke();
  ctx.strokeStyle = '#4a4b5c'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(x - w / 2, y); ctx.lineTo(x - w / 2, y - h * 0.55); ctx.arc(x, y - h * 0.55, w / 2, Math.PI, 0); ctx.lineTo(x + w / 2, y); ctx.stroke();
  // vortex
  const g = ctx.createRadialGradient(x, y - h * 0.5, 2, x, y - h * 0.5, w / 2 + 2);
  g.addColorStop(0, active ? 'rgba(255,255,255,.9)' : rgba(accent, 0.25));
  g.addColorStop(0.35, rgba(accent, active ? pulse + 0.35 : 0.18));
  g.addColorStop(1, rgba(accent, 0));
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(x, y - h * 0.5, w / 2, 0, Math.PI * 2); ctx.fill();
  ctx.save();
  ctx.translate(x, y - h * 0.5);
  for (let i = 0; i < 3; i++) {
    ctx.rotate(t * 0.9 + i * 2.1);
    ctx.strokeStyle = rgba(accent, active ? 0.55 : 0.2);
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, 8 + i * 4, 0.3, 2.4); ctx.stroke();
  }
  ctx.restore();
  if (active) {
    for (let i = 0; i < 5; i++) {
      const a = t * 1.6 + i * 1.4;
      const px = x + Math.cos(a) * 16, py = y - h * 0.5 + Math.sin(a * 1.3) * 16;
      R(ctx, rgba(accent, 0.8), px, py, 2, 2);
    }
  }
}

function drawTorch(ctx, x, y, t, tint = '#ffb45c') {
  R(ctx, '#2a2118', x - 2, y - 30, 4, 30);
  R(ctx, '#4a3a26', x - 3, y - 34, 6, 6);
  const f = Math.sin(t * 9 + x) * 1.6;
  const g = ctx.createRadialGradient(x, y - 38, 0, x, y - 38, 22);
  g.addColorStop(0, rgba(tint, 0.55));
  g.addColorStop(1, rgba(tint, 0));
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y - 38, 22, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = tint;
  ctx.beginPath();
  ctx.moveTo(x - 4, y - 36);
  ctx.quadraticCurveTo(x - 5 + f, y - 46, x, y - 52 - f);
  ctx.quadraticCurveTo(x + 5 + f, y - 44, x + 4, y - 36);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#fff4cc';
  ctx.beginPath();
  ctx.moveTo(x - 2, y - 37); ctx.quadraticCurveTo(x + f, y - 43, x, y - 46); ctx.quadraticCurveTo(x + 2, y - 41, x + 2, y - 37); ctx.fill();
}

function drawPillar(ctx, x, y, h, col) {
  R(ctx, shade(col, -30), x - 9, y - h, 18, h);
  R(ctx, col, x - 7, y - h + 2, 7, h - 2);
  R(ctx, shade(col, 25), x - 7, y - h + 2, 3, h - 4);
  R(ctx, shade(col, -10), x - 12, y - h - 6, 24, 7);
  R(ctx, shade(col, 5), x - 11, y - h - 4, 22, 4);
  R(ctx, shade(col, -20), x - 11, y - 4, 22, 4);
}

function drawBones(ctx, x, y, c = '#cfc7ad') {
  R(ctx, shade(c, -50), x - 8, y - 3, 16, 2);
  R(ctx, c, x - 7, y - 4, 10, 2);
  R(ctx, c, x + 3, y - 2, 2, 4);
  R(ctx, c, x - 5, y - 5, 2, 4);
}

function drawRock(ctx, x, y, s, col) {
  ctx.fillStyle = shade(col, -25);
  ctx.beginPath();
  ctx.moveTo(x - s, y); ctx.lineTo(x - s * 0.7, y - s * 0.8); ctx.lineTo(x, y - s * 1.1);
  ctx.lineTo(x + s * 0.6, y - s * 0.7); ctx.lineTo(x + s, y); ctx.closePath(); ctx.fill();
  ctx.fillStyle = shade(col, 10);
  ctx.beginPath();
  ctx.moveTo(x - s * 0.7, y - s * 0.8); ctx.lineTo(x, y - s * 1.1); ctx.lineTo(x + s * 0.1, y - s * 0.1); ctx.closePath(); ctx.fill();
}

function drawMushrooms(ctx, x, y, tint) {
  for (let i = 0; i < 3; i++) {
    const px = x + i * 5 - 5, hh = 4 + (i % 2) * 3;
    R(ctx, '#d8e4d0', px, y - hh, 2, hh);
    R(ctx, tint, px - 3, y - hh - 3, 8, 3);
    R(ctx, shade(tint, 35), px - 1, y - hh - 3, 3, 1);
  }
}

function drawGrass(ctx, x, y, col) {
  ctx.strokeStyle = col; ctx.lineWidth = 1.4;
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath();
    ctx.moveTo(x + i * 2, y);
    ctx.quadraticCurveTo(x + i * 3, y - 5, x + i * 4, y - 9 + Math.abs(i));
    ctx.stroke();
  }
}
