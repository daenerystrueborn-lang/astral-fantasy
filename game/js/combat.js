/* ============================================================
   ASTRAL FANTASY — dungeon combat engine
   ============================================================ */
const TILE = 32;
/* logical world view (units) — rendered at ZOOM× for crisp pixel art */
const VIEW_W = 448, VIEW_H = 252, ZOOM = 2;

const Combat = {
  canvas: null, ctx: null,
  light: null, lctx: null,
  run: null,
  keys: new Set(),
  touch: { x: 0, y: 0, active: false },
  aim: { x: 1, y: 0, usingMouse: false },
  running: false,
  raf: 0,
  last: 0,
  t: 0,
  shake: 0,
  cam: { x: 0, y: 0 },
  fx: [],
  texts: [],
  paused: false,
  intro: null,

  init() {
    this.canvas = $('#game');
    this.canvas.width = VIEW_W * ZOOM;
    this.canvas.height = VIEW_H * ZOOM;
    this.ctx = this.canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;
    this.light = document.createElement('canvas');
    this.light.width = VIEW_W * ZOOM; this.light.height = VIEW_H * ZOOM;
    this.lctx = this.light.getContext('2d');
    this.bindInput();
  },

  /* ── identity helpers ─────────────────────────────────── */
  hero() { return AF.CLASSES[AF.state.heroId]; },
  stats() { return AF.stats(); },

  /* ══════════════════════════════════════════════════════
     RUN LIFECYCLE
     ══════════════════════════════════════════════════════ */
  start(dungeonId) {
    const d = AF.dungeonById(dungeonId);
    if (!d) return;
    const st = AF.state;
    if (st.hp == null) st.hp = AF.maxHp();
    if (st.mp == null) st.mp = AF.maxMp();
    this.run = {
      dungeon: d,
      floor: 1,
      maxFloors: d.floors,
      hp: st.hp, mp: st.mp,
      gold: 0, gems: 0, xp: 0, kills: 0, bossKills: 0, score: 0,
      loot: [],
      potions: st.potions,
      bossDead: false,
      started: Date.now()
    };
    this.paused = false;
    this.fx = []; this.texts = []; this.shake = 0;
    const stageBg = $('#stageBg');
    if (stageBg) stageBg.style.backgroundImage = `url("${d.art}")`;
    this.genFloor();
    AF.showScreen('play');
    this.mountHUD();
    AUDIO.startMusic('combat');
    this.resume();
    this.showFloorBanner();
  },

  restartFloor() {
    const run = this.run;
    if (!run) return;
    run.hp = Math.max(1, Math.round(AF.maxHp() * 0.5));
    run.mp = Math.round(AF.maxMp() * 0.5);
    run.exitAnnounced = false;
    this.paused = false;
    this.fx = []; this.texts = [];
    this.genFloor();
    this.mountHUD();
    this.resume();
    AUDIO.startMusic('combat');
    this.showFloorBanner();
  },

  /* restart the frame loop after it was halted (floor complete / death) */
  resume() {
    this.running = true;
    this.paused = false;
    this.last = performance.now();
    cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame(t => this.loop(t));
  },

  endRun() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    AUDIO.stopMusic();
  },

  showFloorBanner() {
    const run = this.run, d = run.dungeon;
    const banner = $('#floorBanner');
    const bossFloor = run.floor === run.maxFloors;
    banner.innerHTML = `<div class="floor-banner-inner">
      <p>${d.name}</p>
      <h2>Floor ${run.floor} of ${run.maxFloors}</h2>
      <p>${bossFloor ? d.bossName + ' awaits' : 'Find the astral gate'}</p>
    </div>`;
    banner.classList.add('show');
    clearTimeout(this._bannerT);
    this._bannerT = setTimeout(() => banner.classList.remove('show'), 2000);
  },

  /* ══════════════════════════════════════════════════════
     LEVEL GENERATION
     ══════════════════════════════════════════════════════ */
  genFloor() {
    const run = this.run, d = run.dungeon;
    const roomCount = rndInt(d.rooms[1] - d.rooms[0] + 1) + d.rooms[0];
    const paths = {
      4: [[0, 1], [1, 1], [1, 0], [2, 0]],
      5: [[0, 0], [1, 0], [1, 1], [2, 1], [2, 2]],
      6: [[0, 0], [1, 0], [1, 1], [2, 1], [2, 2], [1, 2]]
    };
    const path = paths[clamp(roomCount, 4, 6)];
    const CW = 13, CH = 10;
    const W = 3 * CW + 6, H = 3 * CH + 6;
    const map = Array.from({ length: H }, () => Array(W).fill(1));
    const rooms = [];

    const isBossFloorGen = run.floor === run.maxFloors;
    path.forEach(([cx, cy], i) => {
      const bossRoom = isBossFloorGen && i === path.length - 1;
      const w = bossRoom ? 11 + rndInt(2) : 7 + rndInt(2);
      const h = bossRoom ? 9 + rndInt(2) : 5 + rndInt(2);
      const x = cx * CW + 2;
      const y = cy * CH + 2;
      const r = { x, y, w, h, cx: x + (w >> 1), cy: y + (h >> 1), visited: false, cleared: false, index: i };
      rooms.push(r);
      for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) map[yy][xx] = 0;
    });

    // carve corridors between consecutive rooms (2 tiles wide)
    const carve = (x, y) => { if (map[y] && map[y][x] !== undefined) map[y][x] = 0; };
    for (let i = 1; i < rooms.length; i++) {
      const a = rooms[i - 1], b = rooms[i];
      const x0 = Math.min(a.cx, b.cx), x1 = Math.max(a.cx, b.cx);
      for (let x = x0; x <= x1; x++) { carve(x, a.cy); carve(x, a.cy + 1); }
      const y0 = Math.min(a.cy, b.cy), y1 = Math.max(a.cy, b.cy);
      for (let y = y0; y <= y1; y++) { carve(b.cx, y); carve(b.cx + 1, y); }
    }

    // collect edges: tiles that are floor and have a wall neighbour (for torches)
    const isFloor = (x, y) => map[y] && map[y][x] === 0;

    // ── player spawn
    const startRoom = rooms[0];
    const px = (startRoom.cx + 0.5) * TILE, py = (startRoom.cy + 0.5) * TILE;

    // ── portal in last room
    const lastRoom = rooms[rooms.length - 1];
    const exit = { x: (lastRoom.cx + 0.5) * TILE, y: (lastRoom.cy + 1.5) * TILE, open: false };

    // ── enemies
    const enemies = [];
    const scale = 1 + (run.floor - 1) * 0.18 + d.lvl[0] * 0.035;
    const floorBias = path.length;
    const isBossFloor = run.floor === run.maxFloors;
    for (let i = 1; i < rooms.length; i++) {
      const r = rooms[i];
      const bossRoom = isBossFloor && i === rooms.length - 1;
      if (bossRoom) {
        const boss = this.makeBoss(d, scale);
        boss.x = (r.cx + 0.5) * TILE;
        boss.y = (r.cy + 0.5) * TILE;
        enemies.push(boss);
        continue;
      }
      const n = Math.min(5, 1 + Math.floor(floorBias / 3) + rndInt(2) + (run.floor > 1 ? 1 : 0));
      for (let k = 0; k < n; k++) {
        const kind = pick(d.enemies);
        const m = AF.MONSTERS[kind];
        const ex = (r.x + 1 + rndInt(r.w - 2) + 0.5) * TILE;
        const ey = (r.y + 1 + rndInt(r.h - 2) + 0.5) * TILE;
        enemies.push(this.makeEnemy(kind, ex, ey, scale));
      }
    }

    // a couple of foes always guard the entrance room
    const entryFoes = 1 + rndInt(2);
    for (let k = 0; k < entryFoes; k++) {
      const ang = Math.random() * Math.PI * 2;
      const rr = 90 + rndInt(50);
      const ex = px + Math.cos(ang) * rr, ey = py + Math.sin(ang) * rr;
      const tx = Math.floor(ex / TILE), ty = Math.floor(ey / TILE);
      if (!map[ty] || map[ty][tx] !== 0) continue;
      enemies.push(this.makeEnemy(pick(d.enemies), ex, ey, scale));
    }

    // ── chests
    const chests = [];
    const chestRooms = rooms.slice(1).sort(() => Math.random() - 0.5).slice(0, 2);
    for (const r of chestRooms) {
      chests.push({
        x: (r.x + 1.5 + rndInt(r.w - 3)) * TILE,
        y: (r.y + 2.5 + rndInt(r.h - 4)) * TILE,
        opened: false, bob: Math.random() * 6
      });
    }

    // ── props (decor) and torches
    const props = [], torches = [];
    for (const r of rooms) {
      // torches on the top wall
      for (let x = r.x + 2; x < r.x + r.w - 1; x += 5) {
        torches.push({ x: (x + 0.5) * TILE, y: (r.y) * TILE, seed: Math.random() * 9 });
      }
      const theme = d.palette;
      for (let k = 0; k < 4; k++) {
        const px2 = (r.x + 1 + rndInt(r.w - 2) + 0.5) * TILE;
        const py2 = (r.y + 1 + rndInt(r.h - 2) + 0.5) * TILE;
        const type = pick(['rock', 'mush', 'grass', 'bones', 'pillar', 'crate']);
        if (type === 'pillar' && (Math.abs(px2 - exit.x) < 70 || Math.abs(px2 - px) < 70)) continue;
        props.push({ x: px2, y: py2, type, seed: Math.random() * 100, theme });
      }
    }

    const rx0 = Math.min(...rooms.map(r => r.x)) - 1, ry0 = Math.min(...rooms.map(r => r.y)) - 1;
    const rx1 = Math.max(...rooms.map(r => r.x + r.w)) + 1, ry1 = Math.max(...rooms.map(r => r.y + r.h)) + 1;
    this.run.bounds = { x0: rx0 * TILE, y0: ry0 * TILE, x1: rx1 * TILE, y1: ry1 * TILE };
    this.run.map = map;
    this.run.W = W; this.run.H = H;
    this.run.rooms = rooms;
    this.run.enemies = enemies;
    this.run.chests = chests;
    this.run.props = props;
    this.run.torches = torches;
    this.run.exit = exit;
    this.run.projectiles = [];
    this.run.player = {
      x: px, y: py, r: 10,
      anim: 'idle', animT: 0, dir: 0,
      atkCd: 0, combo: 0, comboT: 0, skillCd: 0, dashCd: 0, dashT: 0,
      invuln: 0, hurtT: 0, shield: 0, bleed: 0, alive: true,
      step: 0
    };
    this.run.player.hp = run.hp;
    this.run.player.mp = run.mp;
    this.run.boss = enemies.find(e => AF.MONSTERS[e.kind].boss) || null;
    this.cam.x = this.camX(px);
    this.cam.y = this.camY(py);
    this.fx = []; this.texts = [];
    this.updateObjective();
  },

  makeEnemy(kind, x, y, scale) {
    const table = {
      slime: { hp: 42, dmg: 7, spd: 46, r: 13, xp: 8, gold: 9 },
      bat: { hp: 30, dmg: 6, spd: 82, r: 11, xp: 7, gold: 7 },
      skeleton: { hp: 62, dmg: 10, spd: 54, r: 12, xp: 13, gold: 14 },
      shaman: { hp: 52, dmg: 9, spd: 44, r: 12, xp: 15, gold: 16 },
      sentinel: { hp: 104, dmg: 14, spd: 38, r: 15, xp: 22, gold: 24 }
    }[kind] || { hp: 40, dmg: 8, spd: 50, r: 12, xp: 8, gold: 8 };
    const hp = Math.round(table.hp * scale);
    return {
      kind, x, y, hp, maxHp: hp,
      dmg: Math.round(table.dmg * (0.9 + scale * 0.18)),
      spd: table.spd, r: table.r,
      xp: Math.round(table.xp * scale), gold: Math.round(table.gold * scale),
      animT: Math.random() * 3, hurtT: 0, atkCd: rnd(1.2, 0.4), wind: 0, state: 'chase',
      z: 0, tint: null, eye: null, hitFlash: 0, dead: false, bleed: 0, vx: 0, vy: 0
    };
  },

  makeBoss(d, scale) {
    const table = {
      warden: { hp: 760, dmg: 19, spd: 44, r: 30, xp: 260, gold: 240 },
      tyrant: { hp: 940, dmg: 23, spd: 40, r: 32, xp: 320, gold: 300 },
      revenant: { hp: 880, dmg: 21, spd: 52, r: 28, xp: 360, gold: 340 },
      wyrm: { hp: 1380, dmg: 28, spd: 46, r: 40, xp: 520, gold: 520 }
    }[d.boss] || { hp: 700, dmg: 18, spd: 44, r: 30, xp: 200, gold: 200 };
    const hp = Math.round(table.hp * (0.72 + scale * 0.34));
    return {
      kind: d.boss, boss: true, x: 0, y: 0, hp, maxHp: hp,
      dmg: Math.round(table.dmg * (0.9 + scale * 0.1)), spd: table.spd, r: table.r,
      xp: table.xp, gold: table.gold, animT: 0, hurtT: 0, atkCd: 2.2,
      state: 'chase', wind: 0, z: 0, hitFlash: 0, dead: false, bleed: 0, phase: 1,
      enraged: false, name: d.bossName
    };
  },

  /* ══════════════════════════════════════════════════════
     HUD
     ══════════════════════════════════════════════════════ */
  mountHUD() {
    const run = this.run, cls = this.hero(), s = this.stats();
    $('#combatCard').innerHTML = `
      <div class="cc-top">
        <div class="cc-face">${AF.heroPortraitImg(AF.state.heroId, 96)}</div>
        <div class="cc-lvl">${AF.state.level}</div>
        <div style="min-width:0">
          <div class="cc-name">${cls.name}</div>
          <div class="cc-sub">${cls.title}</div>
        </div>
        <div class="cc-hp" id="ccHp"></div>
      </div>
      <div class="cc-bars">
        <div class="statbar hp"><i id="hpFill"></i></div>
        <div class="statbar mp"><i id="mpFill"></i></div>
      </div>`;
    AF.mountPortraits($('#combatCard'));
    $('#bossWrap').hidden = true;
    this.updateHUD();
  },

  updateHUD() {
    const run = this.run; if (!run) return;
    const s = this.stats(), p = run.player;
    const hpF = $('#hpFill'), mpF = $('#mpFill'), ccHp = $('#ccHp');
    if (hpF) hpF.style.width = clamp(p.hp / s.hp, 0, 1) * 100 + '%';
    if (mpF) mpF.style.width = clamp(p.mp / s.mp, 0, 1) * 100 + '%';
    if (ccHp) ccHp.textContent = `${Math.max(0, Math.ceil(p.hp))} / ${s.hp}`;
    const pc = $('#potionCount');
    if (pc) pc.textContent = run.potions;
    const boss = run.boss;
    const bw = $('#bossWrap');
    if (boss && !boss.dead) {
      bw.hidden = false;
      $('#bossName').innerHTML = `${icon('i-skull')} ${boss.name}` + (boss.enraged ? ' <span style="color:#ff9a7a">· ENRAGED</span>' : '');
      $('#bossFill').style.width = clamp(boss.hp / boss.maxHp, 0, 1) * 100 + '%';
    } else if (bw) bw.hidden = true;
  },

  updateObjective() {
    const run = this.run; if (!run) return;
    const alive = run.enemies.filter(e => !e.dead).length;
    const boss = run.boss;
    const obj = $('#objective');
    if (!obj) return;
    // the gate opens when the floor's guardian is beaten — on the boss floor
    // that means the boss, elsewhere it means every remaining foe
    run.exit.open = run.boss ? !!run.boss.dead : alive === 0;
    if (run.exit.open && !run.exitAnnounced) {
      run.exitAnnounced = true;
      this.pushToast('The astral gate has opened', 'good');
      AUDIO.sfx('door');
    }
    if (run.boss && !run.boss.dead) AUDIO.startMusic('boss');
    let text = alive > 0 ? `${alive} foe${alive > 1 ? 's' : ''} remain` : 'The astral gate is open';
    if (boss && !boss.dead && run.floor === run.maxFloors) text = `Defeat the ${boss.name}`;
    obj.innerHTML = `
      <div class="obj-floor">${run.dungeon.name} · Floor ${run.floor}/${run.maxFloors}</div>
      <div class="obj-text">${text}</div>
      <div class="obj-prog">${fmt(run.kills)} slain · ${fmt(run.gold)} gold · ${fmt(run.score)} score</div>`;
  },

  floatText(x, y, text, color = '#ffe9a8', size = 12) {
    this.texts.push({ x, y, text, color, size, life: 1, vy: -40, vx: rnd(18, -18) });
  },

  /* ══════════════════════════════════════════════════════
     INPUT
     ══════════════════════════════════════════════════════ */
  bindInput() {
    addEventListener('keydown', e => {
      if (AF.currentScreen !== 'play' || !this.running) return;
      const k = e.key.toLowerCase();
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
      if (this.paused) return;
      if (k === 'escape') { this.pause(); return; }
      this.keys.add(k);
      if (k === 'j' || k === ' ') this.playerAttack();
      if (k === 'k') this.playerSkill();
      if (k === '1') this.drinkPotion();
      if (k === 'shift') this.dash();
    });
    addEventListener('keyup', e => this.keys.delete(e.key.toLowerCase()));
    addEventListener('blur', () => { this.keys.clear(); if (this.running && !this.paused) this.pause(true); });

    const cv = this.canvas;
    cv.addEventListener('contextmenu', e => e.preventDefault());
    cv.addEventListener('pointerdown', e => {
      if (AF.currentScreen !== 'play' || !this.running || this.paused) return;
      const p = this.screenToWorld(e.clientX, e.clientY);
      this.aim.x = p.x - this.run.player.x;
      this.aim.y = p.y - this.run.player.y;
      if (e.button === 2) this.playerSkill(); else this.playerAttack();
    });
    cv.addEventListener('pointermove', e => {
      if (!this.run) return;
      const p = this.screenToWorld(e.clientX, e.clientY);
      this.run.player.dir = Math.atan2(p.y - this.run.player.y, p.x - this.run.player.x);
    });

    // virtual stick
    const stick = $('#stick'), knob = stick && $('i', stick);
    if (stick) {
      const move = e => {
        const rect = stick.getBoundingClientRect();
        const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
        let dx = e.clientX - cx, dy = e.clientY - cy;
        const max = rect.width * 0.36;
        const len = Math.hypot(dx, dy) || 1;
        const cl = Math.min(len, max);
        dx = dx / len * cl; dy = dy / len * cl;
        knob.style.transform = `translate(${dx}px,${dy}px)`;
        this.touch.x = clamp(dx / max, -1, 1);
        this.touch.y = clamp(dy / max, -1, 1);
        this.touch.active = true;
      };
      const reset = () => { knob.style.transform = ''; this.touch.x = 0; this.touch.y = 0; this.touch.active = false; };
      stick.addEventListener('pointerdown', e => { e.preventDefault(); stick.setPointerCapture(e.pointerId); move(e); });
      stick.addEventListener('pointermove', e => { if (this.touch.active) { e.preventDefault(); move(e); } });
      stick.addEventListener('pointerup', reset);
      stick.addEventListener('pointercancel', reset);
    }
    $$('#touchUI [data-act]').forEach(btn => {
      btn.addEventListener('pointerdown', e => {
        e.preventDefault();
        const act = btn.dataset.act;
        if (this.paused) return;
        if (act === 'attack') this.playerAttack();
        if (act === 'skill') this.playerSkill();
        if (act === 'potion') this.drinkPotion();
      });
    });
    const pauseBtn = $('#pauseBtn');
    if (pauseBtn) pauseBtn.addEventListener('click', () => this.pause());
  },

  screenToWorld(cx, cy) {
    const r = this.canvas.getBoundingClientRect();
    const scale = Math.min(r.width / VIEW_W, r.height / VIEW_H);
    const offX = r.left + (r.width - VIEW_W * scale) / 2;
    const offY = r.top + (r.height - VIEW_H * scale) / 2;
    return {
      x: (cx - offX) / scale + this.cam.x,
      y: (cy - offY) / scale + this.cam.y
    };
  },

  /* ══════════════════════════════════════════════════════
     PLAYER ACTIONS
     ══════════════════════════════════════════════════════ */
  playerAttack() {
    const p = this.run.player;
    if (!p.alive || p.atkCd > 0 || this.paused) return;
    const cls = this.hero();
    p.combo = (p.comboT > 0 ? p.combo : 0) % 3 + 1;
    p.comboT = 0.62;
    p.atkCd = 0.30;
    p.anim = 'atk'; p.animT = 0;
    const atk = this.stats().atk;
    const crit = Math.random() < this.stats().crit;
    const heavy = p.combo === 3;
    let dmg = atk * (heavy ? 1.75 : 1) * rnd(1.1, 0.9);
    if (crit) dmg *= 1.8;
    const reach = heavy ? 58 : 50;
    const arc = heavy ? 1.5 : 1.15;
    const target = { x: p.x + Math.cos(p.dir) * 20, y: p.y + Math.sin(p.dir) * 20 };
    this.fx.push({ type: 'slash', x: target.x, y: target.y, dir: p.dir, life: 0.22, t: 0.22, arc, radius: reach, heavy });
    AUDIO.sfx(crit ? 'crit' : 'slash');
    let hit = 0;
    for (const e of this.run.enemies) {
      if (e.dead) continue;
      const dx = e.x - p.x, dy = e.y - p.y;
      const d = Math.hypot(dx, dy);
      if (d > reach + e.r) continue;
      const ang = Math.atan2(dy, dx);
      let diff = Math.abs(((ang - p.dir + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
      if (diff > arc) continue;
      this.damageEnemy(e, dmg, { crit, knock: heavy ? 26 : 12 });
      hit++;
    }
    if (hit) this.shake = Math.min(6, this.shake + (heavy ? 4 : 2));
    if (p.combo === 3) p.combo = 0;
  },

  playerSkill() {
    const p = this.run.player;
    const cls = this.hero(), sk = cls.skill;
    if (!p.alive || p.skillCd > 0 || this.paused) return;
    if (p.mp < sk.cost) { AUDIO.sfx('error'); this.floatText(p.x, p.y - 34, 'Not enough mana', '#8fd6ff', 10); return; }
    p.mp -= sk.cost;
    p.skillCd = sk.cd;
    p.anim = 'cast'; p.animT = 0;
    AUDIO.sfx('cast');
    const atk = this.stats().atk, dir = p.dir;

    switch (AF.state.heroId) {
      case 'ronin': {
        this.fx.push({ type: 'wave', x: p.x, y: p.y, dir, life: 0.5, t: 0.5, radius: 120 });
        for (const e of this.run.enemies) {
          if (e.dead) continue;
          const dx = e.x - p.x, dy = e.y - p.y, d = Math.hypot(dx, dy);
          if (d > 150) continue;
          const ang = Math.atan2(dy, dx);
          const diff = Math.abs(((ang - dir + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
          if (diff > 1.25) continue;
          this.damageEnemy(e, atk * sk.dmg, { knock: 34, magic: true });
        }
        break;
      }
      case 'kunoichi': {
        const dist0 = 130;
        const nx = p.x + Math.cos(dir) * dist0, ny = p.y + Math.sin(dir) * dist0;
        for (const e of this.run.enemies) {
          if (e.dead) continue;
          // distance from segment
          const dx = e.x - p.x, dy = e.y - p.y;
          const proj = clamp(dx * Math.cos(dir) + dy * Math.sin(dir), 0, dist0);
          const px2 = Math.cos(dir) * proj, py2 = Math.sin(dir) * proj;
          if (Math.hypot(dx - px2, dy - py2) > 34 + e.r) continue;
          this.damageEnemy(e, atk * sk.dmg, { knock: 10, magic: true });
          e.bleed = Math.max(e.bleed || 0, 3);
        }
        this.fx.push({ type: 'step', x: p.x, y: p.y, x2: nx, y2: ny, life: 0.28, t: 0.28 });
        p.x = clamp(nx, TILE, this.run.W * TILE - TILE);
        p.y = clamp(ny, TILE, this.run.H * TILE - TILE);
        p.invuln = Math.max(p.invuln, 0.24);
        break;
      }
      case 'monk': {
        this.fx.push({ type: 'ring', x: p.x, y: p.y, radius: 96, life: 0.45, t: 0.45, color: '#bfe8c8' });
        for (const e of this.run.enemies) {
          if (e.dead) continue;
          if (Math.hypot(e.x - p.x, e.y - p.y) > 108 + e.r) continue;
          this.damageEnemy(e, atk * sk.dmg, { knock: 70, magic: true });
        }
        this.shake = 8;
        break;
      }
      case 'wanderer': {
        for (let i = -2; i <= 2; i++) {
          const a = dir + i * 0.26;
          this.run.projectiles.push({
            x: p.x + Math.cos(a) * 14, y: p.y + Math.sin(a) * 14,
            vx: Math.cos(a) * 300, vy: Math.sin(a) * 300,
            r: 5, dmg: atk * sk.dmg, team: 'player', life: 1.1, kind: 'dart'
          });
        }
        break;
      }
      case 'commander': {
        const heal = Math.round(AF.maxHp() * 0.28);
        p.hp = Math.min(AF.maxHp(), p.hp + heal);
        p.shield = 3;
        this.fx.push({ type: 'ring', x: p.x, y: p.y, radius: 70, life: 0.6, t: 0.6, color: '#ffd27a' });
        this.floatText(p.x, p.y - 44, `+${heal} HP · Shield`, '#9fe0a8', 12);
        break;
      }
      case 'archer': {
        for (let i = 0; i < 8; i++) {
          const ang = rnd(Math.PI * 2);
          const rad = rnd(120, 20);
          this.fx.push({
            type: 'arrowfall', x: p.x + Math.cos(ang) * rad, y: p.y + Math.sin(ang) * rad,
            delay: i * 0.06, life: 0.7, t: 0.7, dmg: atk * sk.dmg, done: false
          });
        }
        break;
      }
    }
    this.updateHUD();
  },

  dash() {
    const p = this.run.player;
    if (!p.alive || p.dashCd > 0) return;
    let dx = this.moveVec().x, dy = this.moveVec().y;
    if (!dx && !dy) { dx = Math.cos(p.dir); dy = Math.sin(p.dir); }
    const len = Math.hypot(dx, dy) || 1;
    p.dashT = 0.16;
    p.dashDir = { x: dx / len, y: dy / len };
    p.dashCd = 1.1;
    p.invuln = Math.max(p.invuln, 0.26);
    AUDIO.sfx('dash');
    this.fx.push({ type: 'dust', x: p.x, y: p.y, life: 0.3, t: 0.3 });
  },

  drinkPotion() {
    const run = this.run, p = run.player;
    if (run.potions <= 0) { AUDIO.sfx('error'); this.floatText(p.x, p.y - 30, 'No draughts', '#ff9a9a', 10); return; }
    if (p.hp >= this.stats().hp) { AUDIO.sfx('error'); this.floatText(p.x, p.y - 30, 'Full health', '#9fe0a8', 10); return; }
    const heal = Math.round(AF.maxHp() * 0.45);
    run.potions--;
    p.hp = Math.min(this.stats().hp, p.hp + heal);
    this.floatText(p.x, p.y - 36, `+${heal}`, '#9fe0a8', 13);
    AUDIO.sfx('potion');
    this.fx.push({ type: 'ring', x: p.x, y: p.y, radius: 44, life: 0.4, t: 0.4, color: '#9fe0a8' });
    this.updateHUD();
  },

  /* ══════════════════════════════════════════════════════
     DAMAGE
     ══════════════════════════════════════════════════════ */
  damageEnemy(e, dmg, { crit = false, knock = 0, magic = false } = {}) {
    if (e.dead) return;
    const armor = e.boss ? 0.3 : 0.12;
    const final = Math.max(1, Math.round(dmg * (magic ? 1 : 1 - armor)));
    e.hp -= final;
    e.hurtT = 0.16;
    e.hitFlash = 1;
    if (knock) {
      const dx = e.x - this.run.player.x, dy = e.y - this.run.player.y;
      const d = Math.hypot(dx, dy) || 1;
      const push = knock * (e.boss ? 0.18 : 1);
      this.tryMove(e, (dx / d) * push, (dy / d) * push);
    }
    if (AF.state.settings.numbers) this.floatText(e.x + rnd(8, -8), e.y - (e.boss ? 90 : 26), (crit ? '' : '') + fmt(final), crit ? '#ffd257' : '#fff0c9', crit ? 15 : 12);
    this.fx.push({ type: 'spark', x: e.x, y: e.y - (e.boss ? 50 : 16), life: 0.26, t: 0.26, color: magic ? '#9fd8ff' : '#ffe1a0' });
    AUDIO.sfx(crit ? 'crit' : 'hit');
    if (e.hp <= 0) this.killEnemy(e);
    this.updateObjective();
  },

  killEnemy(e) {
    e.dead = true;
    const run = this.run;
    run.kills++;
    run.gold += e.gold;
    run.xp += e.xp;
    run.score += 30 + Math.round(e.xp * 1.4);
    AF.state.totals.kills++;
    AF.state.totals.goldEarned += e.gold;
    this.floatText(e.x, e.y - 34, `+${e.gold}g`, '#ffd98a', 11);
    this.fx.push({ type: 'burst', x: e.x, y: e.y - 20, life: 0.5, t: 0.5, color: e.boss ? '#ffb45c' : '#e8dcc0', big: !!e.boss });
    if (e.boss) {
      run.bossKills++;
      run.score += 500;
      run.bossDead = true;
      this.shake = 16;
      AUDIO.sfx('victory');
      this.pushToast(`${e.name} falls!`, 'good');
      // boss drops
      const loot = AF.rollLoot(run.dungeon.id, run.floor, true);
      loot.forEach(l => { run.loot.push(l); });
    } else {
      AUDIO.sfx('coin');
    }
    this.updateHUD();
    this.updateObjective();
  },

  hurtPlayer(raw, source) {
    const run = this.run, p = run.player;
    if (!p.alive || p.invuln > 0) return;
    if (p.shield > 0) {
      p.shield--;
      p.invuln = 0.5;
      this.floatText(p.x, p.y - 34, 'Blocked', '#ffd98a', 11);
      AUDIO.sfx('hit');
      return;
    }
    const def = this.stats().def;
    const dmg = Math.max(2, Math.round(raw - def * 0.34));
    p.hp -= dmg;
    p.invuln = 0.72;
    p.hurtT = 0.26;
    p.anim = 'hurt'; p.animT = 0;
    run.hp = p.hp;
    this.shake = 7;
    this.floatText(p.x, p.y - 40, `-${dmg}`, '#ff8b8b', 14);
    AUDIO.sfx('hurt');
    if (source) {
      const dx = p.x - source.x, dy = p.y - source.y, d = Math.hypot(dx, dy) || 1;
      this.tryMove(p, (dx / d) * 16, (dy / d) * 16);
    }
    this.updateHUD();
    if (p.hp <= 0) this.playerDeath();
  },

  playerDeath() {
    const run = this.run, p = run.player;
    p.hp = 0;
    p.alive = false;
    p.anim = 'dead'; p.animT = 0;
    this.running = false;
    AUDIO.sfx('death');
    AUDIO.stopMusic();
    AF.state.totals.deaths++;
    run.hp = 0;
    AF.state.hp = null;
    const score = this.runScore();
    AF.recordRun({
      hero: AF.state.heroId, dungeon: run.dungeon.id, floor: run.floor,
      score, kills: run.kills, gold: run.gold, at: Date.now(), died: true
    });
    AF.persist();
    setTimeout(() => {
      AF.showResult({
        title: 'You Fell',
        sub: `${run.dungeon.name} · Floor ${run.floor} · ${fmt(run.kills)} foes slain · ${fmt(run.gold)} gold recovered`,
        glyph: 'i-skull', tone: 'red',
        rewards: [
          { icon: 'i-star', text: `${fmt(run.score)} score` },
          { icon: 'i-skull', text: `${fmt(run.kills)} kills` }
        ],
        actions: [
          { label: 'Retry Floor', cls: 'btn-primary', fn: () => { AF.closeOverlay(); AF.hpAfterDeath(); this.restartFloor(); } },
          { label: 'Return Home', cls: 'btn-ghost', fn: () => { AF.closeOverlay(); this.endRun(); AF.state.hp = null; AF.persist(); AF.showScreen('home'); } }
        ]
      });
    }, 850);
  },

  runScore() {
    const run = this.run;
    return Math.round(run.gold + run.kills * 26 + run.floor * 260 + run.bossKills * 600 + (run.dungeon.lvl[0] * 10));
  },

  /* ══════════════════════════════════════════════════════
     FLOOR COMPLETE
     ══════════════════════════════════════════════════════ */
  floorComplete() {
    if (!this.running) return;
    const run = this.run;
    this.running = false;
    AUDIO.stopMusic();
    run.xp += 40 + run.floor * 30;
    run.score += 250;
    AF.state.totals.floors++;
    // award everything earned this floor
    const gold = run.gold, gems = run.gems, xp = run.xp;
    AF.state.gold += gold;
    AF.state.gems += gems;
    run.loot.forEach(l => AF.addItem(l.id, l.qty || 1));
    const levels = AF.gainXp(xp);
    const loot = run.loot.slice();
    run.loot = []; run.gold = 0; run.gems = 0; run.xp = 0;
    AF.state.hp = Math.min(AF.maxHp(), Math.round(run.player.hp + AF.maxHp() * 0.2));
    AF.state.mp = Math.min(AF.maxMp(), Math.round(run.player.mp + AF.maxMp() * 0.3));
    AF.state.potions = run.potions + 1;
    AF.persist();
    AUDIO.sfx('victory');

    const isLast = run.floor >= run.maxFloors;
    const rewards = [
      { icon: 'i-star', text: `+${fmt(xp)} XP` },
      { icon: 'i-coin', text: `+${fmt(gold)} gold` }
    ];
    if (levels) rewards.push({ icon: 'i-bolt', text: `Level ${AF.state.level}!` });
    if (gems) rewards.push({ icon: 'i-gem', text: `+${gems} gems` });

    if (isLast) {
      // dungeon cleared
      const bonusGold = 180 + run.dungeon.lvl[0] * 26;
      AF.state.gold += bonusGold;
      AF.state.totals.clears++;
      run.score += 1200;
      const bonus = { id: AF.LOOT_POOL[run.dungeon.id][AF.LOOT_POOL[run.dungeon.id].length - 1], qty: 1 };
      AF.addItem(bonus.id, 1);
      AF.recordRun({
        hero: AF.state.heroId, dungeon: run.dungeon.id, floor: run.floor,
        score: this.runScore(), kills: run.kills, gold: gold + bonusGold, at: Date.now()
      });
      AF.persist();
      AF.showResult({
        title: 'Dungeon Cleared',
        sub: `${run.dungeon.name} — ${run.dungeon.bossName} is no more. ${fmt(run.kills)} foes fell to your blade.`,
        glyph: 'i-trophy',
        rewards: [...rewards, { icon: 'i-coin', text: `+${fmt(bonusGold)} clear bonus` }],
        loot: [...loot, bonus],
        actions: [
          { label: 'Return Home', cls: 'btn-primary', fn: () => { AF.closeOverlay(); this.endRun(); AF.showScreen('home'); AF.renderHome(); } }
        ]
      });
      return;
    }

    AF.showResult({
      title: 'Floor Cleared',
      sub: `Floor ${run.floor} of ${run.maxFloors} secured. The gate hums below.`,
      glyph: 'i-star',
      rewards,
      loot,
      actions: [
        {
          label: `Descend to Floor ${run.floor + 1}`, cls: 'btn-primary',
          fn: () => {
            AF.closeOverlay();
            run.floor++;
            run.bossDead = false;
            run.exitAnnounced = false;
            this.genFloor();
            this.mountHUD();
            this.resume();
            AUDIO.startMusic('combat');
            this.showFloorBanner();
          }
        },
        { label: 'Return Home', cls: 'btn-ghost', fn: () => { AF.closeOverlay(); this.endRun(); AF.showScreen('home'); } }
      ]
    });
  },

  /* ══════════════════════════════════════════════════════
     PAUSE
     ══════════════════════════════════════════════════════ */
  pause(auto = false) {
    if (!this.running || this.paused) return;
    this.paused = true;
    this.keys.clear();
    const run = this.run;
    AF.openOverlay('', { closable: false, onClose: () => { this.paused = false; } });
    // build pause body (AF.showResult is not closable-friendly here, so craft it)
    const card = $('#overlayCard');
    card.innerHTML = `
      <div class="dlg-body">
        <div class="result">
          <div class="glyph">${icon('i-pause')}</div>
          <h2>Paused</h2>
          <div class="rsub">${run.dungeon.name} · Floor ${run.floor} of ${run.maxFloors}</div>
          <div class="reward-row">
            <div class="reward">${icon('i-skull')} ${fmt(run.kills)} slain</div>
            <div class="reward">${icon('i-coin')} ${fmt(run.gold)}</div>
            <div class="reward">${icon('i-star')} ${fmt(run.score)}</div>
          </div>
          <div class="result-actions" style="flex-direction:column;align-items:stretch;max-width:320px;margin:8px auto 0">
            <button class="btn btn-primary" data-p="resume">${icon('i-arrow')} Resume</button>
            <button class="btn" data-p="controls">${icon('i-mouse')} Controls</button>
            <button class="btn" data-p="settings">${icon('i-gear')} Settings</button>
            <button class="btn btn-danger" data-p="quit">${icon('i-home')} Abandon Run</button>
          </div>
        </div>
      </div>`;
    AF.mountPortraits(card);
    $$('[data-p]', card).forEach(b => b.addEventListener('click', () => {
      AUDIO.sfx('click');
      const a = b.dataset.p;
      if (a === 'resume') { AF.closeOverlay(true); this.paused = false; this.last = performance.now(); }
      if (a === 'controls') {
        toast('WASD move · J attack · K skill · Shift dash · 1 potion · Esc pause');
      }
      if (a === 'settings') AF.panelSettings();
      if (a === 'quit') {
        AF.closeOverlay(true);
        this.paused = false;
        this.endRun();
        AF.state.hp = null;
        AF.persist();
        AF.showScreen('home');
      }
    }));
  },

  pushToast(text, cls = '') {
    const layer = $('#toastLayer');
    if (!layer) return;
    const n = el('div', 'combat-toast ' + cls, text);
    layer.appendChild(n);
    setTimeout(() => { n.style.opacity = '0'; n.style.transition = 'opacity .3s'; setTimeout(() => n.remove(), 320); }, 1900);
  },

  /* ══════════════════════════════════════════════════════
     MOVEMENT HELPERS
     ══════════════════════════════════════════════════════ */
  moveVec() {
    const k = this.keys;
    let x = 0, y = 0;
    if (k.has('a') || k.has('arrowleft')) x -= 1;
    if (k.has('d') || k.has('arrowright')) x += 1;
    if (k.has('w') || k.has('arrowup')) y -= 1;
    if (k.has('s') || k.has('arrowdown')) y += 1;
    if (this.touch.active) { x += this.touch.x; y += this.touch.y; }
    const len = Math.hypot(x, y);
    if (len > 1) { x /= len; y /= len; }
    return { x, y };
  },

  solid(x, y) {
    const run = this.run;
    const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
    if (tx < 0 || ty < 0 || tx >= run.W || ty >= run.H) return true;
    return run.map[ty][tx] !== 0;
  },

  blocked(x, y, r) {
    return this.solid(x - r, y - r) || this.solid(x + r, y - r) ||
      this.solid(x - r, y + r) || this.solid(x + r, y + r) ||
      this.solid(x, y - r) || this.solid(x, y + r) || this.solid(x - r, y) || this.solid(x + r, y);
  },

  tryMove(ent, dx, dy) {
    const r = ent.r || 10;
    if (dx) {
      if (!this.blocked(ent.x + dx, ent.y, r)) ent.x += dx;
      else if (!this.blocked(ent.x + dx * 0.6, ent.y, r)) ent.x += dx * 0.6;
    }
    if (dy) {
      if (!this.blocked(ent.x, ent.y + dy, r)) ent.y += dy;
      else if (!this.blocked(ent.x, ent.y + dy * 0.6, r)) ent.y += dy * 0.6;
    }
  },

  /* camera target: always trail the avatar, clamped to the dungeon bounds */
  camX(x) {
    const b = this.run.bounds;
    const span = b.x1 - b.x0;
    if (span <= VIEW_W) return b.x0 + (span - VIEW_W) / 2;
    return clamp(x - VIEW_W / 2, b.x0, b.x1 - VIEW_W);
  },
  camY(y) {
    const b = this.run.bounds;
    const span = b.y1 - b.y0;
    if (span <= VIEW_H) return b.y0 + (span - VIEW_H) / 2;
    return clamp(y - VIEW_H / 2, b.y0, b.y1 - VIEW_H);
  },

  /* ══════════════════════════════════════════════════════
     UPDATE
     ══════════════════════════════════════════════════════ */
  loop(now) {
    if (!this.running) return;
    const dt = Math.min(0.05, (now - this.last) / 1000 || 0.016);
    this.last = now;
    this.t = now / 1000;
    if (!this.paused) this.update(dt);
    this.draw(dt);
    this.raf = requestAnimationFrame(t => this.loop(t));
  },

  update(dt) {
    const run = this.run;
    if (!run) return;
    const p = run.player;
    p.animT += dt;
    p.atkCd = Math.max(0, p.atkCd - dt);
    p.comboT = Math.max(0, p.comboT - dt);
    p.skillCd = Math.max(0, p.skillCd - dt);
    p.dashCd = Math.max(0, p.dashCd - dt);
    p.invuln = Math.max(0, p.invuln - dt);
    p.hurtT = Math.max(0, p.hurtT - dt);
    this.shake = Math.max(0, this.shake - dt * 22);

    // movement
    if (p.alive) {
      const mv = this.moveVec();
      let speed = this.stats().spd;
      if (p.dashT > 0) {
        p.dashT -= dt;
        this.tryMove(p, p.dashDir.x * 660 * dt, p.dashDir.y * 660 * dt);
      } else if (mv.x || mv.y) {
        this.tryMove(p, mv.x * speed * dt, mv.y * speed * dt);
        p.dir = Math.atan2(mv.y, mv.x);
        p.step += dt;
        if (p.anim !== 'atk' && p.anim !== 'cast' && p.hurtT <= 0) { p.anim = 'run'; p.animT = p.animT; }
      } else if (p.anim === 'run') {
        p.anim = 'idle'; p.animT = 0;
      }
      if (p.hurtT > 0) p.anim = 'hurt';
      else if (p.anim === 'atk' && p.animT > 0.42 && p.atkCd <= 0) { p.anim = 'idle'; p.animT = 0; }
      else if (p.anim === 'cast' && p.animT > 0.6) { p.anim = 'idle'; p.animT = 0; }
    }

    // mana regen
    p.mp = Math.min(this.stats().mp, p.mp + dt * 2.6);
    this.updateHUD();

    // never let the player wander outside the generated rooms
    if (run.bounds) {
      p.x = clamp(p.x, run.bounds.x0 + 12, run.bounds.x1 - 12);
      p.y = clamp(p.y, run.bounds.y0 + 12, run.bounds.y1 - 12);
    }

    // room visits
    const roomNow = run.rooms.find(r => p.x > r.x * TILE && p.x < (r.x + r.w) * TILE && p.y > r.y * TILE && p.y < (r.y + r.h) * TILE);
    if (roomNow && !roomNow.visited) {
      roomNow.visited = true;
      AF.state.totals.rooms++;
    }
    if (roomNow && !roomNow.cleared && !run.enemies.some(e => !e.dead &&
      e.x > roomNow.x * TILE && e.x < (roomNow.x + roomNow.w) * TILE &&
      e.y > roomNow.y * TILE && e.y < (roomNow.y + roomNow.h) * TILE)) {
      roomNow.cleared = true;
      if (roomNow.index > 0) this.pushToast('Room cleared', 'good');
    }

    // enemies
    for (const e of run.enemies) {
      if (e.dead) continue;
      e.animT += dt;
      e.hurtT = Math.max(0, e.hurtT - dt);
      e.hitFlash = Math.max(0, e.hitFlash - dt * 6);
      e.atkCd = Math.max(0, e.atkCd - dt);
      if (e.bleed) {
        e.bleed -= dt;
        e.bleedTick = (e.bleedTick || 0) + dt;
        if (e.bleedTick > 0.5) { e.bleedTick = 0; this.damageEnemy(e, 6, { magic: true }); }
      }
      if (e.dead) continue;
      if (e.boss) this.updateBoss(e, dt);
      else this.updateEnemy(e, dt);
    }

    // projectiles
    for (const pr of run.projectiles) {
      pr.life -= dt;
      pr.x += pr.vx * dt;
      pr.y += pr.vy * dt;
      if (this.solid(pr.x, pr.y)) { pr.life = 0; this.fx.push({ type: 'spark', x: pr.x, y: pr.y, life: 0.2, t: 0.2, color: '#a0c8ff' }); }
      if (pr.team === 'enemy') {
        if (Math.hypot(pr.x - p.x, pr.y - p.y) < pr.r + 11) {
          this.hurtPlayer(pr.dmg, { x: pr.x, y: pr.y });
          pr.life = 0;
        }
      } else {
        for (const e of run.enemies) {
          if (e.dead) continue;
          if (Math.hypot(pr.x - e.x, pr.y - (e.y - (e.boss ? 50 : 16))) < pr.r + e.r * 0.8) {
            this.damageEnemy(e, pr.dmg, { magic: true, knock: 8 });
            pr.life = 0;
            break;
          }
        }
      }
    }
    run.projectiles = run.projectiles.filter(pr => pr.life > 0);

    // chests
    for (const c of run.chests) {
      if (c.opened) continue;
      if (Math.hypot(c.x - p.x, c.y - p.y) < 30) this.openChest(c);
    }

    // exit portal
    if (run.exit.open && Math.hypot(run.exit.x - p.x, run.exit.y - 14 - p.y) < 34) {
      this.floorComplete();
      return;
    }

    // particles / text
    for (const f of this.fx) { f.life -= dt; }
    this.fx = this.fx.filter(f => f.life > 0);
    for (const tx of this.texts) {
      tx.life -= dt;
      tx.y += tx.vy * dt;
      tx.x += tx.vx * dt;
      tx.vy += 24 * dt;
    }
    this.texts = this.texts.filter(tx => tx.life > 0);

    // ambient dust motes
    run.motes = run.motes || Array.from({ length: 26 }, () => ({
      x: rnd(run.W * TILE), y: rnd(run.H * TILE), s: rnd(1.6, .5), ph: rnd(6.28), sp: rnd(9, 3)
    }));
    for (const m of run.motes) {
      m.ph += dt * 1.4;
      m.y -= m.sp * dt;
      m.x += Math.sin(m.ph) * 6 * dt;
      if (m.y < 0) { m.y = run.H * TILE; m.x = rnd(run.W * TILE); }
    }

    // camera — trails the hero, lifting a little while a boss is engaged
    // so the boss's head and telegraphs stay inside the frame
    const tx = this.camX(p.x);
    let focusY = p.y;
    const boss = run.boss;
    if (boss && boss.alive) {
      const dx = Math.abs(p.x - boss.x);
      const dy = p.y - boss.y;
      if (dx < 340 && dy > -260 && dy < 280) {
        const w = clamp(1 - dx / 340, 0, 1) * clamp(1 - Math.max(0, dy - 60) / 240, 0, 1);
        focusY = p.y - 66 * w;
      }
    }
    const ty = this.camY(focusY);
    this.cam.x = lerp(this.cam.x, tx, 1 - Math.pow(0.001, dt));
    this.cam.y = lerp(this.cam.y, ty, 1 - Math.pow(0.001, dt));
  },

  openChest(c) {
    c.opened = true;
    const run = this.run;
    const roll = Math.random();
    if (roll < 0.45) {
      const gold = 30 + rndInt(50) + run.floor * 15;
      run.gold += gold; run.score += 20;
      this.floatText(c.x, c.y - 30, `+${gold} gold`, '#ffd98a', 12);
    } else if (roll < 0.78) {
      const gems = 1 + rndInt(2);
      run.gems += gems; run.score += 40;
      this.floatText(c.x, c.y - 30, `+${gems} gem`, '#8fe6ff', 12);
      AF.state.gems += gems;
    } else {
      const loot = AF.rollLoot(run.dungeon.id, run.floor, false)[0];
      if (loot) { run.loot.push(loot); this.floatText(c.x, c.y - 30, AF.ITEMS[loot.id].name, '#c9a6ff', 11); }
    }
    AUDIO.sfx('chest');
    this.fx.push({ type: 'burst', x: c.x, y: c.y - 12, life: 0.45, t: 0.45, color: '#ffd98a' });
    this.updateObjective();
  },

  /* ── normal enemy AI ─────────────────────────────────── */
  updateEnemy(e, dt) {
    const run = this.run, p = run.player;
    if (!p.alive) return;
    const dx = p.x - e.x, dy = p.y - e.y;
    const d = Math.hypot(dx, dy) || 1;
    const nx = dx / d, ny = dy / d;

    if (e.kind === 'shaman') {
      // keep range and cast bolts
      const ideal = 118;
      const move = d > ideal + 22 ? 1 : d < ideal - 30 ? -1 : 0;
      this.tryMove(e, nx * e.spd * move * dt, ny * e.spd * move * dt);
      if (e.atkCd <= 0 && d < 260) {
        e.wind += dt;
        if (e.wind > 0.5) {
          e.wind = 0; e.atkCd = 2.1;
          const a = Math.atan2(dy, dx);
          run.projectiles.push({
            x: e.x, y: e.y - 30, vx: Math.cos(a) * 190, vy: Math.sin(a) * 190,
            r: 6, dmg: e.dmg, team: 'enemy', life: 3, kind: 'bolt', color: '#a878ff'
          });
          AUDIO.sfx('cast');
        }
      } else if (e.atkCd > 0.3) e.wind = 0;
      return;
    }

    if (e.kind === 'bat') {
      const wob = Math.sin(e.animT * 6) * 40;
      this.tryMove(e, (nx * e.spd + -ny * wob * 0.5) * dt, (ny * e.spd + nx * wob * 0.5) * dt);
      if (d < e.r + 16 && e.atkCd <= 0) { this.hurtPlayer(e.dmg, e); e.atkCd = 1.1; }
      return;
    }

    if (e.kind === 'sentinel') {
      if (e.state === 'chase') {
        this.tryMove(e, nx * e.spd * dt, ny * e.spd * dt);
        if (d < 58 && e.atkCd <= 0) { e.state = 'wind'; e.wind = 0; }
      } else if (e.state === 'wind') {
        e.wind += dt;
        if (e.wind > 0.55) {
          e.state = 'strike'; e.wind = 0;
          this.fx.push({ type: 'ring', x: e.x, y: e.y - 8, radius: 64, life: 0.35, t: 0.35, color: '#9fc9ff' });
          if (d < 70) this.hurtPlayer(e.dmg * 1.2, e);
          AUDIO.sfx('hit');
        }
      } else {
        e.wind += dt;
        if (e.wind > 0.5) { e.state = 'chase'; e.atkCd = 1.6; }
      }
      return;
    }

    // slimes & skeletons
    const isSlime = e.kind === 'slime';
    if (isSlime) {
      e.hopT = (e.hopT || 0) + dt;
      const cycle = e.hopT % 1.1;
      e.z = Math.max(0, Math.sin(clamp(cycle / 0.55, 0, 1) * Math.PI) * 12);
      if (cycle < 0.55) this.tryMove(e, nx * e.spd * 1.35 * dt, ny * e.spd * 1.35 * dt);
    } else {
      this.tryMove(e, nx * e.spd * dt, ny * e.spd * dt);
      if (e.kind === 'skeleton' && d < 44 && e.atkCd <= 0) {
        e.state = 'wind'; e.wind = 0;
      }
      if (e.state === 'wind') {
        e.wind += dt;
        if (e.wind > 0.45) {
          e.state = 'chase'; e.atkCd = 1.3;
          this.fx.push({ type: 'slash', x: e.x + nx * 18, y: e.y - 18, dir: Math.atan2(dy, dx), arc: 0.9, radius: 40, life: 0.18, t: 0.18 });
          if (d < 52) this.hurtPlayer(e.dmg, e);
        }
      }
    }
    if (d < e.r + 14 && e.atkCd <= 0) {
      this.hurtPlayer(e.dmg, e);
      e.atkCd = isSlime ? 1.2 : 1.0;
    }
  },

  /* ── boss AI ─────────────────────────────────────────── */
  updateBoss(e, dt) {
    const run = this.run, p = run.player;
    if (!p.alive) return;
    const dx = p.x - e.x, dy = p.y - e.y, d = Math.hypot(dx, dy) || 1;
    const nx = dx / d, ny = dy / d;
    if (!e.enraged && e.hp < e.maxHp * 0.45) {
      e.enraged = true;
      this.pushToast(`${e.name} is enraged!`, 'bad');
      AUDIO.sfx('boss');
      this.shake = 10;
    }
    const speedMul = e.enraged ? 1.35 : 1;

    if (e.state === 'chase') {
      if (d > 62) this.tryMove(e, nx * e.spd * speedMul * dt, ny * e.spd * speedMul * dt);
      if (d < 74 && e.atkCd <= 0) { e.state = 'wind'; e.wind = 0; e.attack = pick(['slam', 'charge', 'nova']); }
      // contact
      if (d < e.r + 18 && e.atkCd <= 0) { this.hurtPlayer(e.dmg, e); e.atkCd = 1.4; }
      if (e.kind === 'revenant' && e.atkCd <= 0) this.bossCast(e, 'shards');
    } else if (e.state === 'wind') {
      e.wind += dt;
      e.telegraph = true;
      if (e.wind > 0.8) {
        e.state = 'strike'; e.wind = 0; e.telegraph = false;
        this.bossStrike(e, e.attack, nx, ny);
      }
    } else if (e.state === 'strike') {
      e.wind += dt;
      if (e.wind > 0.5) { e.state = 'chase'; e.atkCd = e.enraged ? 1.5 : 2.3; }
    }
  },

  bossCast(e, type) {
    const run = this.run, p = run.player;
    const a = Math.atan2(p.y - e.y, p.x - e.x);
    if (type === 'shards') {
      e.atkCd = 2.6;
      for (let i = -2; i <= 2; i++) {
        const aa = a + i * 0.22;
        run.projectiles.push({
          x: e.x, y: e.y - 50, vx: Math.cos(aa) * 165, vy: Math.sin(aa) * 165,
          r: 7, dmg: e.dmg * 0.8, team: 'enemy', life: 3, kind: 'shard', color: '#a9ecff'
        });
      }
      AUDIO.sfx('cast');
    }
  },

  bossStrike(e, attack, nx, ny) {
    const run = this.run, p = run.player;
    const a = Math.atan2(p.y - e.y, p.x - e.x);
    this.shake = 9;
    AUDIO.sfx('boss');
    if (attack === 'charge') {
      this.fx.push({ type: 'ring', x: e.x, y: e.y - 12, radius: 60, life: 0.4, t: 0.4, color: '#ff9a6a' });
      // dash toward player
      for (let i = 0; i < 10; i++) {
        this.tryMove(e, nx * 22, ny * 22);
        if (Math.hypot(p.x - e.x, p.y - e.y) < e.r + 16) this.hurtPlayer(e.dmg * 1.15, e);
      }
      this.shake = 12;
      return;
    }
    if (attack === 'nova') {
      const count = e.enraged ? 14 : 10;
      for (let i = 0; i < count; i++) {
        const aa = (i / count) * Math.PI * 2 + this.t;
        run.projectiles.push({
          x: e.x + Math.cos(aa) * 40, y: e.y - 30 + Math.sin(aa) * 40,
          vx: Math.cos(aa) * 130, vy: Math.sin(aa) * 130,
          r: 6, dmg: e.dmg * 0.75, team: 'enemy', life: 3.4, kind: 'fire', color: '#ff9a4c'
        });
      }
      return;
    }
    // slam
    this.fx.push({ type: 'ring', x: e.x, y: e.y - 6, radius: 130, life: 0.5, t: 0.5, color: '#ffc46a' });
    const cand = run.enemies.filter(x => x !== e && !x.dead && x.kind === 'slime');
    if (e.kind === 'warden' && cand.length < 4 && Math.random() < 0.75) {
      for (let i = 0; i < 2; i++) {
        const ang = Math.random() * Math.PI * 2;
        const sx = e.x + Math.cos(ang) * 70, sy = e.y + Math.sin(ang) * 70;
        if (!this.blocked(sx, sy, 12)) run.enemies.push(this.makeEnemy('slime', sx, sy, 1.1));
      }
      this.pushToast('The Warden calls the forest', 'bad');
    }
    if (Math.hypot(p.x - e.x, p.y - e.y) < 135) this.hurtPlayer(e.dmg * 1.15, e);
  },

  /* ══════════════════════════════════════════════════════
     DRAW
     ══════════════════════════════════════════════════════ */
  draw(dt) {
    const ctx = this.ctx, run = this.run;
    if (!ctx || !run) return;
    const pal = run.dungeon.palette;
    ctx.save();
    ctx.setTransform(ZOOM, 0, 0, ZOOM, 0, 0);
    ctx.fillStyle = '#05070e';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    let sx = 0, sy = 0;
    if (this.shake > 0.2 && AF.state.settings.shake) {
      sx = rnd(this.shake, -this.shake); sy = rnd(this.shake, -this.shake);
    }
    const camX = Math.round(this.cam.x - sx), camY = Math.round(this.cam.y - sy);
    ctx.translate(-camX, -camY);

    const x0 = Math.max(0, Math.floor(camX / TILE) - 1), x1 = Math.min(run.W - 1, Math.ceil((camX + VIEW_W) / TILE) + 1);
    const y0 = Math.max(0, Math.floor(camY / TILE) - 1), y1 = Math.min(run.H - 1, Math.ceil((camY + VIEW_H) / TILE) + 1);

    // floors
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        if (run.map[y][x] !== 0) continue;
        const px = x * TILE, py = y * TILE;
        const n = (x * 7 + y * 13) % 3;
        const alt = (x * 3 + y * 5) % 7;
        ctx.fillStyle = n === 0 ? pal.floor[0] : n === 1 ? pal.floor[1] : pal.floor[2];
        ctx.fillRect(px, py, TILE, TILE);
        if (alt === 0) {
          ctx.fillStyle = pal.floorAlt[(x + y) % 2];
          ctx.fillRect(px, py, TILE, TILE);
        }
        // stone slab detail: inset border + corner highlights
        ctx.fillStyle = 'rgba(255,255,255,.07)';
        ctx.fillRect(px + 1, py + 1, TILE - 2, 1);
        ctx.fillRect(px + 1, py + 1, 1, TILE - 2);
        ctx.fillStyle = 'rgba(0,0,0,.22)';
        ctx.fillRect(px, py + TILE - 2, TILE, 2);
        ctx.fillRect(px + TILE - 2, py, 2, TILE);
        ctx.fillStyle = 'rgba(0,0,0,.10)';
        ctx.fillRect(px + 3, py + 3, TILE - 6, 1);
        // cracks / detail
        if ((x * 11 + y * 17) % 9 === 0) {
          ctx.fillStyle = 'rgba(0,0,0,.18)';
          ctx.fillRect(px + 8, py + 12, 7, 2);
          ctx.fillRect(px + 14, py + 14, 2, 5);
        }
        // wall shadow
        if (run.map[y - 1] && run.map[y - 1][x] !== 0) {
          const g = ctx.createLinearGradient(0, py, 0, py + 16);
          g.addColorStop(0, 'rgba(0,0,0,.55)'); g.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = g; ctx.fillRect(px, py, TILE, 16);
        }
        if (run.map[y + 1] && run.map[y + 1][x] !== 0) {
          ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.fillRect(px, py + TILE - 6, TILE, 6);
        }
        if (run.map[y][x + 1] !== 0 && run.map[y][x + 1] !== undefined) {
          ctx.fillStyle = 'rgba(0,0,0,.14)'; ctx.fillRect(px + TILE - 5, py, 5, TILE);
        }
      }
    }

    // walls
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        if (run.map[y][x] === 0) continue;
        const nearFloor = (run.map[y + 1] && run.map[y + 1][x] === 0) ||
          (run.map[y - 1] && run.map[y - 1][x] === 0) ||
          (run.map[y][x - 1] === 0) || (run.map[y][x + 1] === 0);
        if (!nearFloor) continue;
        const px = x * TILE, py = y * TILE;
        ctx.fillStyle = pal.wallSide;
        ctx.fillRect(px, py, TILE, TILE);
        // masonry blocks
        ctx.fillStyle = pal.wall;
        ctx.fillRect(px + 1, py + 1, TILE - 2, TILE - 2);
        ctx.fillStyle = 'rgba(255,255,255,.06)';
        ctx.fillRect(px + 3, py + 4, 12, 7);
        ctx.fillRect(px + 18, py + 4, 11, 7);
        ctx.fillRect(px + 9, py + 16, 15, 7);
        ctx.fillStyle = 'rgba(0,0,0,.3)';
        ctx.fillRect(px + 3, py + 11, 12, 1);
        ctx.fillRect(px + 18, py + 11, 11, 1);
        ctx.fillRect(px + 9, py + 23, 15, 1);
        if (run.map[y + 1] && run.map[y + 1][x] === 0) {
          // lit top edge facing the floor
          ctx.fillStyle = pal.wallTop;
          ctx.fillRect(px, py + TILE - 7, TILE, 7);
          ctx.fillStyle = 'rgba(255,255,255,.16)';
          ctx.fillRect(px, py + TILE - 7, TILE, 2);
          ctx.fillStyle = 'rgba(0,0,0,.35)';
          ctx.fillRect(px, py + TILE - 1, TILE, 1);
        }
        if (run.map[y - 1] && run.map[y - 1][x] === 0) {
          ctx.fillStyle = 'rgba(0,0,0,.45)';
          ctx.fillRect(px, py, TILE, 5);
        }
      }
    }

    // props
    for (const pr of run.props) {
      if (pr.x < camX - 40 || pr.x > camX + VIEW_W + 40 || pr.y < camY - 60 || pr.y > camY + VIEW_H + 60) continue;
      const t = this.t + pr.seed;
      if (pr.type === 'rock') drawRock(ctx, pr.x, pr.y, 8, pal.wallTop);
      else if (pr.type === 'mush') drawMushrooms(ctx, pr.x, pr.y, pal.accent);
      else if (pr.type === 'grass') drawGrass(ctx, pr.x, pr.y, pal.accent);
      else if (pr.type === 'bones') drawBones(ctx, pr.x, pr.y);
      else if (pr.type === 'pillar') drawPillar(ctx, pr.x, pr.y, 44, pal.wallTop);
      else if (pr.type === 'crate') {
        R(ctx, '#3a2a1a', pr.x - 9, pr.y - 18, 18, 18);
        R(ctx, '#5a4128', pr.x - 8, pr.y - 17, 16, 15);
        R(ctx, '#3a2a1a', pr.x - 8, pr.y - 10, 16, 2);
        R(ctx, '#2a1e12', pr.x - 1, pr.y - 17, 2, 15);
      }
    }

    // torches
    for (const tor of run.torches) drawTorch(ctx, tor.x, tor.y + 6, this.t + tor.seed, pal.accent2);

    // chests
    for (const c of run.chests) drawChest(ctx, c.x, c.y, this.t + c.bob, c.opened);

    // portal
    drawPortal(ctx, run.exit.x, run.exit.y, this.t, run.exit.open, pal.accent);

    // entities sorted by depth
    const ents = [];
    for (const e of run.enemies) if (!e.dead) ents.push({ y: e.y, kind: 'e', ref: e });
    const p = run.player;
    ents.push({ y: p.y, kind: 'p', ref: p });
    ents.sort((a, b) => a.y - b.y);

    for (const it of ents) {
      if (it.kind === 'p') {
        const p2 = p;
        if (p2.invuln > 0 && Math.floor(this.t * 18) % 2 === 0 && p2.alive) ctx.globalAlpha = 0.55;
        // warm pool of light under the hero so the dark sprite reads clearly
        const hg = ctx.createRadialGradient(p2.x, p2.y - 4, 2, p2.x, p2.y - 4, 34);
        hg.addColorStop(0, 'rgba(255,226,168,.10)');
        hg.addColorStop(0.6, 'rgba(255,214,150,.035)');
        hg.addColorStop(1, 'rgba(255,200,120,0)');
        ctx.fillStyle = hg;
        ctx.beginPath(); ctx.ellipse(p2.x, p2.y - 3, 30, 15, 0, 0, Math.PI * 2); ctx.fill();
        drawShadow(ctx, p2.x, p2.y, 12, 4.5, 0.24);
        drawHero(ctx, AF.state.heroId, p2.alive ? p2.anim : 'dead', p2.x, p2.y, this.t, {
          flip: Math.cos(p2.dir) < 0,
          variant: Math.max(0, (p2.combo || 1) - 1),
          animTime: p2.animT,
          hitFlash: p2.hurtT > 0 ? 0.5 : 0
        });
        ctx.globalAlpha = 1;
        // shield aura
        if (p2.shield > 0) {
          ctx.strokeStyle = `rgba(255,214,140,${0.4 + Math.sin(this.t * 6) * 0.15})`;
          ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(p2.x, p2.y - 22, 26, 0, Math.PI * 2); ctx.stroke();
        }
        if (p2.dashT > 0) {
          ctx.globalAlpha = 0.35;
          drawHero(ctx, AF.state.heroId, 'run', p2.x - p2.dashDir.x * 16, p2.y - p2.dashDir.y * 16, this.t, { flip: Math.cos(p2.dir) < 0, animTime: p2.animT });
          ctx.globalAlpha = 1;
        }
      } else {
        const e = it.ref;
        const m = AF.MONSTERS[e.kind];
        if (!m) continue;
        if (e.boss) {
          drawShadow(ctx, e.x, e.y, 48, 14, 0.4);
        } else {
          drawShadow(ctx, e.x, e.y, e.r + 3, (e.r + 3) * 0.36, 0.3);
        }
        if (e.telegraph) {
          ctx.strokeStyle = `rgba(255,90,70,${0.35 + Math.sin(this.t * 12) * 0.25})`;
          ctx.lineWidth = 2;
          ctx.beginPath(); ctx.ellipse(e.x, e.y + 1, (e.boss ? 80 : 30) + Math.sin(this.t * 9) * 6, (e.boss ? 26 : 10), 0, 0, Math.PI * 2); ctx.stroke();
        }
        // atmospheric aura behind bosses so they detach from the floor
        if (m.aura) {
          const pulse = 0.16 + Math.sin(this.t * 1.7 + e.x * 0.01) * 0.05;
          const ag = ctx.createRadialGradient(e.x, e.y - 52, 4, e.x, e.y - 52, 96);
          ag.addColorStop(0, `rgba(${m.aura},${pulse})`);
          ag.addColorStop(1, `rgba(${m.aura},0)`);
          ctx.fillStyle = ag;
          ctx.beginPath(); ctx.arc(e.x, e.y - 52, 96, 0, Math.PI * 2); ctx.fill();
        }
        const artScale = m.art || 1;
        if (artScale !== 1) {
          ctx.save();
          ctx.translate(e.x, e.y + (e.z || 0));
          ctx.scale(artScale, artScale);
          ctx.translate(-e.x, -(e.y + (e.z || 0)));
        }
        m.draw(ctx, e.x, e.y, this.t, { animT: e.animT, hop: e.z, tint: e.tint, eye: e.eye, enraged: e.enraged });
        if (artScale !== 1) ctx.restore();
        if (e.hitFlash > 0) {
          ctx.globalAlpha = e.hitFlash * 0.35;
          ctx.fillStyle = '#fff';
          ctx.beginPath(); ctx.ellipse(e.x, e.y - (e.boss ? 55 : 20), e.r + (e.boss ? 20 : 4), (e.r + (e.boss ? 20 : 4)) * 0.8, 0, 0, Math.PI * 2); ctx.fill();
          ctx.globalAlpha = 1;
        }
        // health pip
        if (!e.boss && e.hp < e.maxHp) {
          const w = 26, hx = e.x - w / 2, hy = e.y - (e.kind === 'bat' ? 44 : 38);
          R(ctx, 'rgba(0,0,0,.65)', hx - 1, hy - 1, w + 2, 5);
          R(ctx, '#d2402a', hx, hy, w * clamp(e.hp / e.maxHp, 0, 1), 3);
        }
      }
    }

    // projectiles
    for (const pr of run.projectiles) {
      if (pr.kind === 'dart') {
        ctx.save();
        ctx.translate(pr.x, pr.y);
        ctx.rotate(Math.atan2(pr.vy, pr.vx));
        R(ctx, '#e8dcc0', -5, -1, 10, 2);
        R(ctx, '#b8b0a0', -7, -2, 3, 4);
        ctx.restore();
      } else {
        const g = ctx.createRadialGradient(pr.x, pr.y, 0, pr.x, pr.y, pr.r * 3);
        g.addColorStop(0, 'rgba(255,255,255,.9)');
        g.addColorStop(0.4, pr.color || 'rgba(160,200,255,.7)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(pr.x, pr.y, pr.r * 3, 0, Math.PI * 2); ctx.fill();
      }
    }

    // fx
    for (const f of this.fx) this.drawFx(f);

    // floating combat text
    for (const tx of this.texts) {
      const a = clamp(tx.life * 1.6, 0, 1);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.font = `700 ${tx.size}px "Cinzel", Georgia, serif`;
      ctx.textAlign = 'center';
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(0,0,0,.75)';
      ctx.strokeText(tx.text, tx.x, tx.y);
      ctx.fillStyle = tx.color;
      ctx.fillText(tx.text, tx.x, tx.y);
      ctx.restore();
    }

    // dust motes
    if (run.motes) {
      for (const m of run.motes) {
        if (m.x < camX - 10 || m.x > camX + VIEW_W + 10 || m.y < camY - 10 || m.y > camY + VIEW_H + 10) continue;
        ctx.globalAlpha = 0.18 + Math.sin(m.ph) * 0.12;
        R(ctx, pal.dust, m.x, m.y, m.s, m.s);
      }
      ctx.globalAlpha = 1;
    }

    ctx.restore();

    // ── lighting ─────────────────────────────────────────
    this.drawLighting(camX, camY, pal);

    // ── minimap ──────────────────────────────────────────
    this.drawMinimap();
  },

  drawLighting(camX, camY, pal) {
    const lctx = this.lctx, run = this.run, p = run.player;
    lctx.setTransform(ZOOM, 0, 0, ZOOM, 0, 0);
    lctx.clearRect(0, 0, VIEW_W, VIEW_H);
    lctx.globalCompositeOperation = 'source-over';
    lctx.fillStyle = `rgba(3,6,14,${run.dungeon.id === 'forest' ? 0.2 : 0.3})`;
    lctx.fillRect(0, 0, VIEW_W, VIEW_H);
    lctx.globalCompositeOperation = 'destination-out';
    const px = p.x - camX, py = p.y - camY - 16;
    const r = 188;
    const g = lctx.createRadialGradient(px, py, 14, px, py, r);
    g.addColorStop(0, 'rgba(0,0,0,1)');
    g.addColorStop(0.42, 'rgba(0,0,0,.9)');
    g.addColorStop(0.75, 'rgba(0,0,0,.45)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    lctx.fillStyle = g;
    lctx.beginPath(); lctx.arc(px, py, r, 0, Math.PI * 2); lctx.fill();
    // torch pools
    for (const tor of run.torches) {
      const tx = tor.x - camX, ty = tor.y - camY;
      if (tx < -80 || tx > VIEW_W + 80 || ty < -80 || ty > VIEW_H + 80) continue;
      const tg = lctx.createRadialGradient(tx, ty, 2, tx, ty, 104);
      tg.addColorStop(0, 'rgba(0,0,0,.9)');
      tg.addColorStop(0.6, 'rgba(0,0,0,.45)');
      tg.addColorStop(1, 'rgba(0,0,0,0)');
      lctx.fillStyle = tg;
      lctx.beginPath(); lctx.arc(tx, ty, 104, 0, Math.PI * 2); lctx.fill();
    }
    // portal glow
    const ex = run.exit.x - camX, ey = run.exit.y - camY - 26;
    if (run.exit.open) {
      const eg = lctx.createRadialGradient(ex, ey, 4, ex, ey, 110);
      eg.addColorStop(0, 'rgba(0,0,0,.95)'); eg.addColorStop(1, 'rgba(0,0,0,0)');
      lctx.fillStyle = eg;
      lctx.beginPath(); lctx.arc(ex, ey, 110, 0, Math.PI * 2); lctx.fill();
    }
    lctx.globalCompositeOperation = 'source-over';

    const ctx = this.ctx;
    ctx.save();
    ctx.setTransform(ZOOM, 0, 0, ZOOM, 0, 0);
    ctx.drawImage(this.light, 0, 0, VIEW_W, VIEW_H);

    // warm ambient tint
    ctx.globalCompositeOperation = 'overlay';
    const amb = ctx.createLinearGradient(0, 0, 0, VIEW_H);
    amb.addColorStop(0, rgba(pal.accent2, 0.05));
    amb.addColorStop(1, rgba(pal.fog, 0.12));
    ctx.fillStyle = amb;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.globalCompositeOperation = 'source-over';

    // vignette
    const vg = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.3, VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.85);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,.42)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    // hurt vignette
    const ph = this.run.player.hp / this.stats().hp;
    if (ph < 0.35) {
      const pulse = 0.14 + Math.sin(this.t * 4) * 0.06;
      const hg = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.25, VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.8);
      hg.addColorStop(0, 'rgba(150,0,0,0)');
      hg.addColorStop(1, `rgba(150,0,0,${pulse + (0.35 - ph) * 0.6})`);
      ctx.fillStyle = hg;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }
    ctx.restore();
  },

  drawFx(f) {
    const ctx = this.ctx;
    const a = clamp(f.life / f.t, 0, 1);
    if (f.type === 'slash') {
      ctx.save();
      ctx.translate(f.x, f.y - 18);
      ctx.rotate(f.dir);
      ctx.globalAlpha = a * 0.95;
      ctx.strokeStyle = f.heavy ? '#ffe9b0' : '#fff8e0';
      ctx.lineWidth = f.heavy ? 6 : 4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(0, 0, f.radius * (0.7 + (1 - a) * 0.5), -f.arc, f.arc);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(180,220,255,.7)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, f.radius * (0.55 + (1 - a) * 0.5), -f.arc, f.arc);
      ctx.stroke();
      ctx.restore();
    } else if (f.type === 'wave') {
      ctx.save();
      ctx.translate(f.x, f.y - 20);
      ctx.rotate(f.dir);
      ctx.globalAlpha = a * 0.9;
      ctx.strokeStyle = '#cfe9ff';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.ellipse(f.radius * (1 - a) * 0.9 + 20, 0, 12, 60 * (1 - a * 0.4), 0, -Math.PI / 2, Math.PI / 2);
      ctx.stroke();
      ctx.restore();
    } else if (f.type === 'ring') {
      ctx.save();
      ctx.globalAlpha = a * 0.85;
      ctx.strokeStyle = f.color || '#ffd9a0';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(f.x, f.y - 12, f.radius * (1 - a) + 8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    } else if (f.type === 'spark') {
      ctx.save();
      ctx.globalAlpha = a;
      for (let i = 0; i < 4; i++) {
        const ang = i * 1.8 + this.t * 4;
        const rr = (1 - a) * 18;
        R(ctx, f.color || '#ffe0a0', f.x + Math.cos(ang) * rr, f.y + Math.sin(ang) * rr, 2, 2);
      }
      ctx.restore();
    } else if (f.type === 'burst') {
      ctx.save();
      ctx.globalAlpha = a;
      for (let i = 0; i < (f.big ? 14 : 7); i++) {
        const ang = i * 2.4;
        const rr = (1 - a) * (f.big ? 90 : 34);
        R(ctx, f.color || '#ffe0a0', f.x + Math.cos(ang) * rr, f.y + Math.sin(ang) * rr * 0.7, f.big ? 3 : 2, f.big ? 3 : 2);
      }
      ctx.restore();
    } else if (f.type === 'step') {
      ctx.save();
      ctx.globalAlpha = a * 0.6;
      ctx.strokeStyle = '#c9a6ff';
      ctx.lineWidth = 8;
      ctx.beginPath(); ctx.moveTo(f.x, f.y - 20); ctx.lineTo(f.x2, f.y2 - 20); ctx.stroke();
      ctx.restore();
    } else if (f.type === 'dust') {
      ctx.save();
      ctx.globalAlpha = a * 0.5;
      ctx.fillStyle = '#d8cbb0';
      for (let i = 0; i < 5; i++) ctx.fillRect(f.x + rnd(12, -12), f.y - rnd(10, 0), 3, 3);
      ctx.restore();
    } else if (f.type === 'arrowfall') {
      if (f.delay > 0) { f.delay -= 1 / 60; return; }
      ctx.save();
      ctx.globalAlpha = a;
      R(ctx, 'rgba(255,240,200,.8)', f.x - 1, f.y - 90 + (1 - a) * 60, 2, 16);
      ctx.restore();
      if (!f.done) {
        f.done = true;
        for (const e of this.run.enemies) {
          if (e.dead) continue;
          if (Math.hypot(e.x - f.x, e.y - 12 - f.y) < 30 + e.r) this.damageEnemy(e, f.dmg, { magic: true, knock: 4 });
        }
        this.fx.push({ type: 'ring', x: f.x, y: f.y, radius: 26, life: 0.25, t: 0.25, color: '#ffe9b0' });
      }
    }
  },

  drawMinimap() {
    const cv = $('#minimap');
    if (!cv) return;
    const ctx = cv.getContext('2d');
    const run = this.run;
    const s = 160 / Math.max(run.W, run.H);
    ctx.clearRect(0, 0, 160, 160);
    ctx.fillStyle = '#08111f';
    ctx.beginPath(); ctx.arc(80, 80, 78, 0, Math.PI * 2); ctx.fill();

    ctx.save();
    ctx.beginPath(); ctx.arc(80, 80, 74, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = 'rgba(60,90,140,.28)';
    for (const r of run.rooms) {
      if (!r.visited) continue;
      ctx.fillRect(80 - run.W * s / 2 + r.x * s, 80 - run.H * s / 2 + r.y * s, r.w * s, r.h * s);
    }
    ctx.fillStyle = '#4a7ad0';
    for (const r of run.rooms) {
      if (!r.visited) continue;
      ctx.fillRect(80 - run.W * s / 2 + r.x * s, 80 - run.H * s / 2 + r.y * s, r.w * s, r.h * s);
    }
    // exit
    const ex = 80 - run.W * s / 2 + run.exit.x / TILE * s;
    const ey = 80 - run.H * s / 2 + run.exit.y / TILE * s;
    ctx.fillStyle = run.exit.open ? '#8fe6ff' : '#3a5470';
    ctx.beginPath(); ctx.arc(ex, ey, 4, 0, Math.PI * 2); ctx.fill();
    // enemies
    for (const e of run.enemies) {
      if (e.dead) continue;
      const x = 80 - run.W * s / 2 + e.x / TILE * s, y = 80 - run.H * s / 2 + e.y / TILE * s;
      ctx.fillStyle = e.boss ? '#ff7a5c' : '#ff5f6a';
      ctx.beginPath(); ctx.arc(x, y, e.boss ? 3.5 : 1.6, 0, Math.PI * 2); ctx.fill();
    }
    // player
    const px = 80 - run.W * s / 2 + run.player.x / TILE * s;
    const py = 80 - run.H * s / 2 + run.player.y / TILE * s;
    ctx.fillStyle = '#ffe9a8';
    ctx.beginPath(); ctx.arc(px, py, 3.4, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,233,168,.5)';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(px, py, 6.5, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();

    // ring
    ctx.strokeStyle = 'rgba(224,178,90,.55)';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(80, 80, 77, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = 'rgba(224,178,90,.2)';
    ctx.lineWidth = 6;
    ctx.beginPath(); ctx.arc(80, 80, 73, 0, Math.PI * 2); ctx.stroke();
  }
};

/* ── outcome of a death ─────────────────────────────────── */
AF.hpAfterDeath = function () {
  AF.state.hp = null;
  AF.state.mp = null;
  AF.persist();
};

/* ── entry points used by the UI ────────────────────────── */
AF.startRun = function (dungeonId) {
  AUDIO.init(); AUDIO.resume();
  const d = AF.dungeonById(dungeonId);
  if (!d) return;
  if (AF.state.level < AF.dungeonReq(d.id)) { toast(`Requires level ${AF.dungeonReq(d.id)}`); return; }
  AF.closeOverlay(true);
  AF.startMusicHomeOnce = false;
  AF.showScreen('play');
  Combat.start(dungeonId);
};

AF.restartFloorFromUI = function () {
  AF.closeOverlay(true);
  Combat.restartFloor();
};
