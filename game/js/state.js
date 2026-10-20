/* ============================================================
   ASTRAL FANTASY — persistent player state
   ============================================================ */
const SAVE_KEY = 'astral-fantasy.save.v1';

AF.state = null;

AF.defaultState = () => ({
  version: 1,
  heroId: 'ronin',
  level: 1,
  xp: 0,
  hp: null, mp: null,          // null = full
  gold: 240,
  gems: 8,
  potions: 2,
  inventory: [],
  equipment: { weapon: null, shield: null, helm: null, armor: null, boots: null, ring: null },
  runs: [],                    // { hero, dungeon, floor, score, kills, gold, at: date }
  totals: { kills: 0, floors: 0, clears: 0, goldEarned: 0, deaths: 0, rooms: 0 },
  settings: { music: 0.45, sfx: 0.65, shake: true, numbers: true },
  seenIntro: false
});

AF.loadState = function () {
  let raw = null;
  try { raw = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch (e) { raw = null; }
  const base = AF.defaultState();
  if (!raw || raw.version !== 1) { AF.state = base; return AF.state; }
  AF.state = Object.assign(base, raw, {
    equipment: Object.assign(base.equipment, raw.equipment || {}),
    totals: Object.assign(base.totals, raw.totals || {}),
    settings: Object.assign(base.settings, raw.settings || {})
  });
  if (!AF.CLASSES[AF.state.heroId]) AF.state.heroId = 'ronin';
  if (!Array.isArray(AF.state.inventory)) AF.state.inventory = [];
  return AF.state;
};

AF.persist = function () {
  if (!AF.state) return;
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(AF.state)); } catch (e) { /* storage full / blocked */ }
};

AF.resetProgress = function () {
  AF.state = AF.defaultState();
  AF.persist();
};

/* ── derived values ───────────────────────────────────────── */
AF.xpNeeded = level => Math.round(70 + level * 55 + Math.pow(level, 1.7) * 12);

AF.heroClass = () => AF.CLASSES[AF.state.heroId] || AF.CLASSES.ronin;

AF.stats = function () {
  const st = AF.state, cls = AF.heroClass(), lv = st.level - 1;
  const gear = { hp: 0, mp: 0, atk: 0, def: 0, spd: 0, crit: 0 };
  for (const slot of AF.SLOT_ORDER) {
    const id = st.equipment[slot];
    const item = id && AF.ITEMS[id];
    if (!item || !item.stats) continue;
    for (const [k, v] of Object.entries(item.stats)) gear[k] = (gear[k] || 0) + v;
  }
  return {
    hp: Math.round(cls.base.hp * (1 + lv * 0.11) + gear.hp),
    mp: Math.round(cls.base.mp * (1 + lv * 0.09) + gear.mp),
    atk: Math.round(cls.base.atk * (1 + lv * 0.115) + gear.atk),
    def: Math.round(cls.base.def * (1 + lv * 0.1) + gear.def),
    spd: Math.round(cls.base.spd * (1 + lv * 0.012) + gear.spd),
    crit: clamp(cls.base.crit + gear.crit + lv * 0.002, 0, 0.65)
  };
};

AF.maxHp = () => AF.stats().hp;
AF.maxMp = () => AF.stats().mp;

/* ── progression ──────────────────────────────────────────── */
AF.gainXp = function (amount) {
  const st = AF.state;
  st.xp += amount;
  let levels = 0;
  while (st.xp >= AF.xpNeeded(st.level) && st.level < 60) {
    st.xp -= AF.xpNeeded(st.level);
    st.level++;
    levels++;
  }
  if (levels) {
    st.hp = AF.maxHp();
    st.mp = AF.maxMp();
    AUDIO.sfx('level');
  }
  return levels;
};

/* ── inventory ────────────────────────────────────────────── */
AF.itemCount = id => {
  const e = AF.state.inventory.find(i => i.id === id);
  return e ? e.qty : 0;
};

AF.addItem = function (id, qty = 1) {
  if (!AF.ITEMS[id]) return false;
  const st = AF.state;
  const item = AF.ITEMS[id];
  if (item.slot === 'potion') { st.potions += qty; return true; }
  const found = st.inventory.find(i => i.id === id);
  if (found) found.qty += qty;
  else st.inventory.push({ id, qty });
  return true;
};

AF.removeItem = function (id, qty = 1) {
  const st = AF.state;
  const idx = st.inventory.findIndex(i => i.id === id);
  if (idx < 0) return false;
  st.inventory[idx].qty -= qty;
  if (st.inventory[idx].qty <= 0) st.inventory.splice(idx, 1);
  return true;
};

AF.isEquipped = id => AF.SLOT_ORDER.some(s => AF.state.equipment[s] === id);

AF.equip = function (id) {
  const st = AF.state, item = AF.ITEMS[id];
  if (!item || !item.slot || item.slot === 'potion' || item.slot === 'gem') return false;
  if (!st.inventory.some(i => i.id === id)) return false;
  const slot = item.slot;
  const prev = st.equipment[slot];
  st.equipment[slot] = id;
  if (prev && prev !== id) { /* previous item stays in inventory */ }
  st.hp = Math.min(st.hp ?? AF.maxHp(), AF.maxHp());
  st.mp = Math.min(st.mp ?? AF.maxMp(), AF.maxMp());
  AUDIO.sfx('click');
  AF.persist();
  return true;
};

AF.unequip = function (slot) {
  const st = AF.state;
  if (!st.equipment[slot]) return false;
  st.equipment[slot] = null;
  st.hp = Math.min(st.hp ?? AF.maxHp(), AF.maxHp());
  st.mp = Math.min(st.mp ?? AF.maxMp(), AF.maxMp());
  AUDIO.sfx('click');
  AF.persist();
  return true;
};

AF.sellValue = id => {
  const it = AF.ITEMS[id];
  if (!it) return 0;
  return Math.round(it.price * (AF.isEquipped(id) ? 1 : 0.55));
};

AF.sell = function (id) {
  const st = AF.state, it = AF.ITEMS[id];
  if (!it || it.slot === 'potion') return false;
  if (AF.isEquipped(id)) {
    const slot = it.slot;
    st.equipment[slot] = null;
  }
  if (!AF.removeItem(id)) return false;
  st.gold += AF.sellValue(id);
  AUDIO.sfx('coin');
  AF.persist();
  return true;
};

AF.buy = function (id) {
  const st = AF.state, it = AF.ITEMS[id];
  if (!it) return { ok: false, msg: 'Unknown item' };
  if (st.gold < it.price) return { ok: false, msg: 'Not enough gold' };
  st.gold -= it.price;
  AF.addItem(id, 1);
  AUDIO.sfx('coin');
  AF.persist();
  return { ok: true, msg: `Purchased ${it.name}` };
};

AF.usePotion = function () {
  const st = AF.state;
  if (st.potions <= 0) return { ok: false, msg: 'No draughts left' };
  if (st.hp >= AF.maxHp()) return { ok: false, msg: 'Already at full health' };
  st.potions--;
  st.hp = Math.min(AF.maxHp(), st.hp + Math.round(AF.maxHp() * 0.4));
  AUDIO.sfx('potion');
  AF.persist();
  return { ok: true, msg: 'Healing Draught +' + Math.round(AF.maxHp() * 0.4) + ' HP' };
};

/* ── loot ─────────────────────────────────────────────────── */
AF.LOOT_POOL = {
  forest: ['sword_iron', 'helmet_steel', 'boots_leather', 'potion_hp', 'gem_red', 'shield_royal'],
  ash: ['sword_iron', 'shield_royal', 'potion_hp', 'gem_red', 'gem_blue', 'armor_red', 'bow_gold'],
  frost: ['sword_ice', 'staff_blue', 'armor_red', 'gem_blue', 'potion_hp', 'ring_gem'],
  lair: ['sword_dark', 'sword_ice', 'armor_red', 'ring_gem', 'gem_blue', 'potion_hp']
};

AF.rollLoot = function (dungeonId, floor, boss) {
  const d = AF.dungeonById(dungeonId) || AF.DUNGEONS[0];
  const pool = (AF.LOOT_POOL[d.id] || AF.LOOT_POOL.forest).slice();
  const out = [];
  const picks = boss ? 3 : 1 + (floor > 1 ? 1 : 0) + (Math.random() < 0.35 ? 1 : 0);
  for (let i = 0; i < picks; i++) {
    let id = pick(pool);
    // bosses bias toward the rarer end of the pool
    if (boss && Math.random() < 0.6) id = pool[pool.length - 1 - rndInt(Math.min(3, pool.length))];
    if (out.some(o => o.id === id)) continue;
    out.push({ id, qty: AF.ITEMS[id] && AF.ITEMS[id].slot === 'potion' ? 1 : 1 });
  }
  return out;
};

/* ── runs & leaderboard ───────────────────────────────────── */
AF.recordRun = function (run) {
  const st = AF.state;
  st.runs.unshift(run);
  st.runs = st.runs.slice(0, 30);
  AF.persist();
};

AF.board = function () {
  const mine = AF.state.runs.map(r => ({
    name: 'You', hero: r.hero, floor: r.floor, score: r.score, kills: r.kills, mine: true
  }));
  return [...AF.SEED_BOARD, ...mine].sort((a, b) => b.score - a.score).slice(0, 12);
};

/* ── quests (derived from totals) ─────────────────────────── */
AF.quests = function () {
  const st = AF.state, t = st.totals;
  const list = [
    { icon: 'i-skull', title: 'Thin the Rift', desc: 'Defeat creatures of the dungeons', now: t.kills, goal: 25, reward: '250 gold' },
    { icon: 'i-map', title: 'Deeper Still', desc: 'Clear dungeon floors', now: t.floors, goal: 5, reward: '4 gems' },
    { icon: 'i-trophy', title: 'Hoard Hunter', desc: 'Clear an entire dungeon', now: t.clears, goal: 1, reward: 'Astral Ring' },
    { icon: 'i-coin', title: 'Coin & Cinder', desc: 'Earn gold in the depths', now: t.goldEarned, goal: 1500, reward: '300 gold' }
  ];
  return list.map(q => ({ ...q, done: q.now >= q.goal, pct: clamp(q.now / q.goal, 0, 1) }));
};

/* ── save helpers ─────────────────────────────────────────── */
AF.saveSummary = function () {
  const st = AF.state;
  if (!st) return null;
  return { level: st.level, floor: Math.max(1, st.totals.floors + 1), gold: st.gold, gems: st.gems, hero: st.heroId };
};
