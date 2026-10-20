/* ============================================================
   ASTRAL FANTASY — screens, panels, dialogs
   ============================================================ */

AF.screens = ['boot', 'home', 'heroes', 'dungeons', 'play'];
AF.currentScreen = 'boot';

AF.showScreen = function (id, opts = {}) {
  for (const s of AF.screens) {
    const node = document.getElementById(s);
    if (!node) continue;
    const on = s === id;
    node.classList.toggle('active', on);
  }
  AF.currentScreen = id;
  if (id === 'home') { AF.renderHome(); AUDIO.startMusic('home'); }
  if (id === 'heroes') { AF.renderHeroes(); AUDIO.startMusic('menu'); }
  if (id === 'dungeons') { AF.renderDungeons(); AUDIO.startMusic('menu'); }
  if (id === 'boot') AUDIO.stopMusic();
  if (!opts.keepScroll) window.scrollTo(0, 0);
};

/* ── small components ─────────────────────────────────────── */
AF.barRow = (kind, cur, max, label) => {
  const ico = kind === 'hp' ? 'i-heart' : kind === 'mp' ? 'i-drop' : 'i-star';
  const cls = kind === 'hp' ? 'hp' : kind === 'mp' ? 'mp' : 'xp';
  const pct = max > 0 ? clamp(cur / max, 0, 1) * 100 : 0;
  return `<div class="bar-row" title="${label || ''}">${icon(ico)}
      <div class="statbar ${cls}"><i style="width:${pct}%"></i></div>
      <span class="bar-val">${fmt(cur)}/${fmt(max)}</span></div>`;
};

AF.heroPortraitImg = (heroId, size = 64, zoom = 1.75, anchor = 1.02) =>
  `<canvas data-portrait="${heroId}" data-zoom="${zoom}" data-anchor="${anchor}" width="${size}" height="${size}"></canvas>`;

AF.mountPortraits = function (root = document) {
  $$('canvas[data-portrait]', root).forEach(cv => {
    AF.portraits.add(cv, cv.dataset.portrait, {
      zoom: Number(cv.dataset.zoom || 1.75),
      anchor: Number(cv.dataset.anchor || 1.02)
    });
  });
};

/* ── home ─────────────────────────────────────────────────── */
AF.renderHome = function () {
  const st = AF.state;
  const stats = AF.stats();
  const cls = AF.heroClass();
  const hp = st.hp == null ? stats.hp : Math.min(st.hp, stats.hp);
  const mp = st.mp == null ? stats.mp : Math.min(st.mp, stats.mp);

  $('#homeHud').innerHTML = `
    <div class="hud-top">
      <div class="hud-portrait">${AF.heroPortraitImg(st.heroId, 128)}<span class="lvl">Lv ${st.level}</span></div>
      <div class="hud-ident">
        <div class="hud-name">${cls.name}</div>
        <div class="hud-class"><span class="hud-cls">${cls.title} · ${cls.role}</span>
          <button class="hud-change" id="hudHeroBtn" type="button">Change</button>
        </div>
        <div class="hud-bars">
          ${AF.barRow('hp', hp, stats.hp, 'Health')}
          ${AF.barRow('mp', mp, stats.mp, 'Mana')}
          ${AF.barRow('xp', st.xp, AF.xpNeeded(st.level), 'Experience')}
        </div>
      </div>
    </div>
    <div class="hud-cur">
      <span>${icon('i-skull')} <b>${fmt(st.totals.kills)}</b> kills</span>
      <span>${icon('i-star')} <b>${st.totals.floors}</b> floors</span>
      <span>${icon('i-trophy')} <b>${st.totals.clears}</b> clears</span>
    </div>`;
  AF.mountPortraits($('#homeHud'));
  const hudBtn = $('#hudHeroBtn');
  if (hudBtn) hudBtn.addEventListener('click', () => { AUDIO.sfx('click'); AF.showScreen('heroes'); });

  $('#homeGold').textContent = fmt(st.gold);
  $('#homeGems').textContent = fmt(st.gems);

  const quests = AF.quests().slice(0, 3);
  $('#homeQuests').innerHTML = `
    <div class="quest-head"><h3>Active Quests</h3><span>${quests.filter(q => q.done).length}/${quests.length} done</span></div>
    ${quests.map(q => `
      <div class="quest-item ${q.done ? 'done' : ''}">
        ${icon(q.icon)}
        <div><div class="qt">${q.title}</div>
          <div class="qs">${q.desc} · ${fmt(Math.min(q.now, q.goal))}/${fmt(q.goal)}</div></div>
      </div>`).join('')}`;

  $('#footSave').textContent = `Lv ${st.level} ${cls.title} · ${fmt(st.gold)} gold · ${st.totals.floors} floors cleared`;
  $('#homeEnter').innerHTML = `<span class="di">${icon('i-sword')}</span><span>${st.runs.length ? 'Continue Descent' : 'Enter Dungeon'}</span>`;
  AF.startMusicHomeOnce = true;
};

/* ── hero select ──────────────────────────────────────────── */
AF.renderHeroes = function () {
  const st = AF.state;
  $('#heroGrid').innerHTML = AF.CLASS_ORDER.map(id => {
    const c = AF.CLASSES[id];
    const lv = st.level - 1;
    const hp = Math.round(c.base.hp * (1 + lv * 0.11));
    const atk = Math.round(c.base.atk * (1 + lv * 0.115));
    const def = Math.round(c.base.def * (1 + lv * 0.1));
    return `<article class="hero-card frame ${st.heroId === id ? 'sel' : ''}" data-hero="${id}" tabindex="0" role="button" aria-label="Play as ${c.title}">
      <div class="hero-art" style="--accent:${c.accent}">
        ${AF.heroPortraitImg(id, 220, 0.95, 0.99)}
      </div>
      <div class="hero-body">
        <div class="hero-name">${c.name} <span style="opacity:.5;font-size:11px;letter-spacing:.1em">“${c.title}”</span></div>
        <div class="hero-role">${c.role} · ${c.weapon}</div>
        <div class="hero-stats">
          <div class="hero-stat"><span>Health</span><b>${hp}</b></div>
          <div class="hero-stat"><span>Attack</span><b>${atk}</b></div>
          <div class="hero-stat"><span>Defense</span><b>${def}</b></div>
          <div class="hero-stat"><span>Speed</span><b>${c.base.spd}</b></div>
        </div>
        <div class="hero-skill">${icon('i-bolt')}<div><b>${c.skill.name}</b><span style="font-size:10px;color:#93a9c6">${c.skill.cost} MP · ${c.skill.cd}s</span></div></div>
        <p class="hero-blurb">${c.blurb}</p>
        <button class="btn btn-sm ${st.heroId === id ? 'btn-primary' : ''}" style="margin-top:auto">${st.heroId === id ? 'Selected' : 'Choose'}</button>
      </div>
    </article>`;
  }).join('');
  AF.mountPortraits($('#heroGrid'));

  $$('#heroGrid .hero-card').forEach(card => {
    const choose = () => {
      const id = card.dataset.hero;
      if (AF.state.heroId !== id) {
        AF.state.heroId = id;
        AF.state.hp = null; AF.state.mp = null;
        AF.persist();
        AUDIO.sfx('level');
        toast(`${AF.CLASSES[id].name} the ${AF.CLASSES[id].title} answers the call`);
      } else {
        AUDIO.sfx('click');
      }
      AF.showScreen('home');
    };
    card.addEventListener('click', choose);
    card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(); } });
  });
};

/* ── dungeon select ───────────────────────────────────────── */
AF.dungeonReq = id => ({ forest: 1, ash: 4, frost: 8, lair: 14 }[id] || 1);

AF.renderDungeons = function () {
  const st = AF.state;
  const stats = AF.stats();
  $('#dungeonStats').innerHTML = `
    <div class="mini-stat">${icon('i-helm')} Lv ${st.level} ${AF.heroClass().title}</div>
    <div class="mini-stat">${icon('i-heart')} ${stats.hp} HP</div>
    <div class="mini-stat">${icon('i-coin')} ${fmt(st.gold)}</div>
    <div class="mini-stat">${icon('i-gem')} ${fmt(st.gems)}</div>`;

  const cards = AF.DUNGEONS.map((d, i) => {
    const req = AF.dungeonReq(d.id);
    const locked = st.level < req;
    return `<article class="dungeon-card frame ${locked ? 'locked' : ''}" data-dungeon="${d.id}" data-i="${i}" tabindex="0" role="button" aria-label="${d.name}">
      <div class="d-art">
        <img src="${d.art}" alt="${d.name}" draggable="false">
        <span class="d-tier ${d.tierClass}">${d.tier}</span>
        ${locked ? `<div class="d-lock">${icon('i-lock')}</div>` : ''}
      </div>
      <div class="d-body">
        <div class="d-name">${d.name}</div>
        <div class="d-meta"><span>Rec. Lv. <b>${d.lvl[0]}${d.lvl[1] > 90 ? '+' : '–' + d.lvl[1]}</b></span><span><b>${d.floors}</b> floors</span></div>
        <div class="d-enemies">${d.enemies.map(e => `<span data-monster="${e}" title="${e}"></span>`).join('')}</div>
        <div class="d-loot ${d.lootClass}">${d.lootLabel}</div>
      </div>
      ${locked
        ? `<button class="btn btn-sm" disabled>${icon('i-lock')} Lv ${req}</button>`
        : `<button class="btn btn-sm ${i === 0 ? 'btn-primary' : ''}">Enter</button>`}
    </article>`;
  }).join('');

  $('#dungeonGrid').innerHTML = cards + `<div class="d-detail frame" id="dungeonDetail"></div>`;
  AF.drawMonsterIcons();
  const unlocked = AF.DUNGEONS.filter(d => st.level >= AF.dungeonReq(d.id));
  AF.selectDungeon(unlocked.length ? unlocked[unlocked.length - 1] : AF.DUNGEONS[0]);

  $$('#dungeonGrid .dungeon-card').forEach(card => {
    const d = AF.dungeonById(card.dataset.dungeon);
    const locked = st.level < AF.dungeonReq(d.id);
    const activate = () => {
      if (locked) { AUDIO.sfx('error'); toast(`Reach level ${AF.dungeonReq(d.id)} to unlock ${d.name}`); return; }
      AF.selectDungeon(d);
      AUDIO.sfx('click');
    };
    card.addEventListener('click', activate);
    card.addEventListener('mouseenter', () => AUDIO.sfx('hover'));
    card.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); AF.startRun(d.id); } });
  });
};

AF.selectDungeon = function (d) {
  if (!d) return;
  AF.pendingDungeon = d.id;
  const req = AF.dungeonReq(d.id);
  const locked = AF.state.level < req;
  const detail = $('#dungeonDetail');
  if (!detail) return;
  detail.innerHTML = `
    <div>
      <h4>${d.name}</h4>
      <p>${d.desc}</p>
    </div>
    <div class="facts">
      <span>${icon('i-star')} Recommended level <b>${d.lvl[0]}${d.lvl[1] > 90 ? '+' : '–' + d.lvl[1]}</b></span>
      <span>${icon('i-skull')} Boss <b>${d.bossName}</b></span>
      <span>${icon('i-shield')} Modifiers <b>None</b></span>
      <span>${icon('i-chest')} Reward tier <b>${d.lootLabel}</b></span>
    </div>
    <button class="btn btn-primary" id="detailEnter" ${locked ? 'disabled' : ''}>
      ${locked ? `${icon('i-lock')} Requires Lv ${req}` : `${icon('i-sword')} Descend`}
    </button>`;
  const btn = $('#detailEnter');
  if (btn && !locked) btn.addEventListener('click', () => AF.startRun(d.id));
};

AF.drawMonsterIcons = function () {
  $$('#dungeonGrid [data-monster]').forEach(span => {
    const kind = span.dataset.monster;
    const cv = document.createElement('canvas');
    cv.width = 36; cv.height = 36;
    const ctx = cv.getContext('2d');
    const m = AF.MONSTERS[kind];
    if (m) {
      ctx.save();
      ctx.translate(-7, 8);
      ctx.scale(0.62, 0.62);
      m.draw(ctx, 36, 40, 0);
      ctx.restore();
    }
    span.appendChild(cv);
  });
};

/* ── overlay plumbing ─────────────────────────────────────── */
AF.openOverlay = function (html, { wide = false, closable = true, onClose = null, cls = '' } = {}) {
  const ov = $('#overlay'), card = $('#overlayCard');
  card.className = 'overlay-card frame ' + cls;
  card.style.width = wide ? 'min(1140px,96vw)' : 'min(900px,96vw)';
  card.innerHTML = html;
  ov.hidden = false;
  AF.overlayClosable = closable;
  AF.overlayOnClose = onClose;
  const closeBtn = $('.dlg-close', card);
  if (closeBtn) closeBtn.addEventListener('click', () => AF.closeOverlay());
  AF.mountPortraits(card);
  return card;
};

AF.closeOverlay = function (silent = false) {
  const ov = $('#overlay');
  if (ov.hidden) return;
  ov.hidden = true;
  $('#overlayCard').innerHTML = '';
  if (!silent && AF.overlayOnClose) AF.overlayOnClose();
  AF.overlayOnClose = null;
};

const dlgHead = (title, sub = '', extra = '') => `
  <div class="dlg-head">
    <div><h2>${title}</h2>${sub ? `<div class="sub">${sub}</div>` : ''}</div>
    <div class="spacer"></div>
    ${extra}
    <button class="dlg-close" aria-label="Close">${icon('i-close')}</button>
  </div>`;

AF.goldLine = () => `<div class="gold-line">${icon('i-coin')} ${fmt(AF.state.gold)} <span style="color:#6f7789;margin-left:8px">${icon('i-gem')} ${fmt(AF.state.gems)}</span></div>`;

/* ── panels ───────────────────────────────────────────────── */
/* Every rail button opens its own full screen (not a modal). */
AF.PANEL_META = {
  quests:    { title: 'Quest Journal',       eyebrow: 'The realm keeps a ledger of your deeds', icon: 'i-scroll', cls: 'p-quests' },
  character: { title: 'Character',           eyebrow: 'Your wanderer, in full',                 icon: 'i-helm',   cls: 'p-character' },
  inventory: { title: 'Inventory',           eyebrow: 'Gear, gems and remedies',                icon: 'i-bag',    cls: 'p-inventory' },
  map:       { title: 'World Map',           eyebrow: 'The Shattered Realms',                   icon: 'i-map',    cls: 'p-map' },
  shop:      { title: 'Blacksmith & Trader', eyebrow: 'Arm yourself before the descent',        icon: 'i-shop',   cls: 'p-shop' },
  ranks:     { title: 'Hall of Deeds',       eyebrow: 'Greatest descents of the Shattered Realms', icon: 'i-trophy', cls: 'p-ranks' },
  settings:  { title: 'Settings',            eyebrow: 'Sound, feedback and the keys that keep you alive', icon: 'i-gear', cls: 'p-settings' }
};

AF.ensurePanelScreen = function (name) {
  const meta = AF.PANEL_META[name];
  let sec = document.getElementById('panel-' + name);
  if (sec) return sec;
  sec = document.createElement('section');
  sec.id = 'panel-' + name;
  sec.className = 'screen panel-screen ' + meta.cls;
  sec.setAttribute('aria-label', meta.title);
  sec.innerHTML = `
    <div class="screen-tex"></div>
    <header class="page-head panel-head">
      <button class="btn btn-icon" data-back="home" aria-label="Back to the keep">${icon('i-back')}</button>
      <div class="ph-title">
        <p class="eyebrow">${meta.eyebrow}</p>
        <h2 class="gold-text page-title">${meta.title}</h2>
      </div>
      <div class="head-stats" data-pstats></div>
    </header>
    <div class="panel-scroll"><div class="panel-inner" data-pbody></div></div>`;
  $('#app').appendChild(sec);
  sec.querySelector('[data-back]').addEventListener('click', () => { AUDIO.sfx('click'); AF.showScreen('home'); });
  AF.screens.push(sec.id);
  return sec;
};

AF.pill = (iconName, text) => `<div class="mini-stat">${icon(iconName)} ${text}</div>`;

AF.panelStatsHTML = function (name) {
  const st = AF.state;
  if (name === 'quests') {
    const q = AF.quests();
    return AF.pill('i-scroll', `${q.filter(x => x.done).length}/${q.length} complete`);
  }
  if (name === 'character') {
    return AF.pill('i-star', `Level ${st.level}`) + AF.pill('i-helm', AF.heroClass().title);
  }
  if (name === 'inventory' || name === 'shop') {
    return AF.pill('i-coin', fmt(st.gold)) + AF.pill('i-gem', fmt(st.gems));
  }
  if (name === 'map') {
    return AF.pill('i-map', `${AF.DUNGEONS.filter(d => st.level >= AF.dungeonReq(d.id)).length}/4 regions open`);
  }
  if (name === 'ranks') {
    const mine = AF.board().find(e => e.mine);
    return AF.pill('i-trophy', mine ? `Best ${fmt(mine.score)}` : 'No descents yet');
  }
  return '';
};

AF.mountPanel = function (name, html) {
  const sec = AF.ensurePanelScreen(name);
  const statsEl = sec.querySelector('[data-pstats]');
  if (statsEl) statsEl.innerHTML = AF.panelStatsHTML(name);
  const body = sec.querySelector('[data-pbody]');
  body.innerHTML = html;
  AF.showScreen('panel-' + name);
  AF.mountPortraits(body);
  return body;
};

AF.openPanel = function (name) {
  AUDIO.init(); AUDIO.resume(); AUDIO.sfx('click');
  const fn = {
    quests: AF.panelQuests, character: AF.panelCharacter, inventory: AF.panelInventory,
    map: AF.panelMap, shop: AF.panelShop, ranks: AF.panelRanks, settings: AF.panelSettings
  }[name];
  if (fn) fn();
};

AF.panelQuests = function () {
  const quests = AF.quests();
  const card = AF.mountPanel('quests', `
    <div class="dlg-body">
      <div class="quest-list">
        ${quests.map(q => `
          <div class="quest-card ${q.done ? 'done' : ''}">
            <div class="qi">${icon(q.icon)}</div>
            <div style="flex:1">
              <h4>${q.title}</h4>
              <p>${q.desc}</p>
              <div class="bar">${AF.barRow('xp', Math.min(q.now, q.goal), q.goal)}</div>
            </div>
            <div class="rw">${q.done ? '✓ Complete' : 'Reward: ' + q.reward}</div>
          </div>`).join('')}
      </div>
      <p class="hint" style="margin-top:14px">Quests track your lifetime totals — they never reset.</p>
    </div>`);
  return card;
};

AF.panelCharacter = function () {
  const st = AF.state, cls = AF.heroClass(), s = AF.stats();
  const gearRows = AF.SLOT_ORDER.map(slot => {
    const id = st.equipment[slot];
    const it = id && AF.ITEMS[id];
    return `<div class="equip-slot" title="${it ? it.name : AF.SLOT_LABEL[slot]}">
      ${it ? `<img src="${it.icon}" alt="${it.name}">` : `<span class="ph">${icon('i-' + ({ weapon: 'sword', shield: 'shield', helm: 'helm', armor: 'bag', boots: 'arrow', ring: 'gem' }[slot]))}</span>`}
      <span class="lbl">${AF.SLOT_LABEL[slot]}</span>
    </div>`;
  }).join('');

  const root = AF.mountPanel('character', `
    <div class="dlg-body">
      <div class="char-layout">
        <div class="char-portrait panel-box">
          <div class="pf">${AF.heroPortraitImg(st.heroId, 300, 2.0, 1.0)}<span class="lvl-badge">Lv ${st.level}</span></div>
          <h3>${cls.name}</h3>
          <div class="role">“${cls.title}”</div>
          <p class="hint" style="text-align:center;margin-top:4px">${cls.blurb}</p>
          <div class="char-progress">
            ${AF.barRow('hp', st.hp ?? s.hp, s.hp, 'Health')}
            ${AF.barRow('mp', st.mp ?? s.mp, s.mp, 'Mana')}
            ${AF.barRow('xp', st.xp, AF.xpNeeded(st.level), 'Experience')}
          </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:14px;min-width:0">
          <div class="panel-box">
            <div class="box-head"><h3>Attributes</h3><span>${fmt(st.xp)} / ${fmt(AF.xpNeeded(st.level))} XP</span></div>
            <div class="stat-grid">
              <div class="stat-cell"><span>Attack</span><b>${s.atk}</b></div>
              <div class="stat-cell"><span>Defense</span><b>${s.def}</b></div>
              <div class="stat-cell"><span>Health</span><b>${s.hp}</b></div>
              <div class="stat-cell"><span>Mana</span><b>${s.mp}</b></div>
              <div class="stat-cell"><span>Speed</span><b>${s.spd}</b></div>
              <div class="stat-cell"><span>Crit</span><b>${Math.round(s.crit * 100)}%</b></div>
            </div>
            <div class="skill-card">
              <div class="si">${icon('i-bolt')}</div>
              <div>
                <h4>${cls.skill.name}</h4>
                <p>${cls.skill.desc}</p>
                <div class="cost">${cls.skill.cost} MP · ${cls.skill.cd}s cooldown</div>
              </div>
            </div>
          </div>
          <div class="panel-box">
            <div class="box-head"><h3>Equipment</h3><span>${AF.SLOT_ORDER.filter(sl => st.equipment[sl]).length}/${AF.SLOT_ORDER.length} slots</span></div>
            <div class="equip-layout">${gearRows}</div>
          </div>
        </div>
      </div>
    </div>`);
};

/* ── inventory ────────────────────────────────────────────── */
AF.panelInventory = function () {
  const st = AF.state;
  const items = st.inventory.slice();
  AF.invSelected = AF.invSelected && items.some(i => i.id === AF.invSelected) ? AF.invSelected : (items[0] && items[0].id) || null;

  const worn = AF.SLOT_ORDER.map(slot => {
    const id = st.equipment[slot], it = id && AF.ITEMS[id];
    return `<div class="equip-slot ${it ? 'filled r-' + it.rarity : ''}" data-eslot="${slot}" title="${it ? it.name : AF.SLOT_LABEL[slot]}">
      ${it ? `<img src="${it.icon}" alt="${it.name}">` : `<span class="ph">${icon('i-lock')}</span>`}
      <span class="lbl">${AF.SLOT_LABEL[slot]}</span></div>`;
  }).join('');

  const card = AF.mountPanel('inventory', `
    <div class="dlg-body">
      <div class="inv-layout">
        <div class="panel-box" style="min-height:0;display:flex;flex-direction:column">
          <div class="box-head"><h3>Backpack</h3><span>${items.length} / 24 slots</span></div>
          <div class="slots" id="invSlots">${AF.invSlotsHTML(items)}</div>
          <div class="box-head" style="margin-top:14px"><h3>Remedies</h3><span>Key 1 in combat</span></div>
          <div class="shop-row" style="margin:0">
            <div class="si"><img src="assets/items/health_potion.png" alt=""></div>
            <div><div class="nm">Healing Draught</div><div class="ds">Restores 40% health</div></div>
            <div class="pr" style="margin-left:auto">×${st.potions}</div>
            <button class="btn btn-sm" id="usePotion" ${st.potions <= 0 ? 'disabled' : ''}>${icon('i-potion')} Drink</button>
          </div>
        </div>
        <div class="panel-box">
          <div class="box-head"><h3>Worn Gear</h3><span>Click to inspect</span></div>
          <div class="equip-layout">${worn}</div>
        </div>
        <div class="panel-box item-detail" id="itemDetail"></div>
      </div>
    </div>`);

  AF.renderItemDetail(AF.invSelected);

  $$('#invSlots .slot', card).forEach(sl => {
    sl.addEventListener('click', () => {
      AF.invSelected = sl.dataset.id;
      $$('#invSlots .slot', card).forEach(s => s.classList.toggle('sel', s.dataset.id === AF.invSelected));
      AF.renderItemDetail(AF.invSelected);
      AUDIO.sfx('click');
    });
  });
  $$('[data-eslot]', card).forEach(sl => sl.addEventListener('click', () => {
    const id = st.equipment[sl.dataset.eslot];
    if (id) { AF.invSelected = id; AF.renderItemDetail(id); $$('#invSlots .slot', card).forEach(s => s.classList.toggle('sel', s.dataset.id === id)); AUDIO.sfx('click'); }
  }));
  const dp = $('#usePotion', card);
  if (dp) dp.addEventListener('click', () => {
    const r = AF.usePotion();
    toast(r.msg); AUDIO.sfx(r.ok ? 'potion' : 'error');
    AF.panelInventory(); AF.renderHome();
  });
  return card;
};

AF.invSlotsHTML = function (items) {
  const st = AF.state;
  const total = 24;
  let html = items.map(i => {
    const it = AF.ITEMS[i.id];
    if (!it) return '';
    const eq = AF.isEquipped(i.id);
    return `<button class="slot r-${it.rarity} ${eq ? 'equipped' : ''} ${AF.invSelected === i.id ? 'sel' : ''}" data-id="${i.id}" title="${it.name}">
      <img src="${it.icon}" alt="${it.name}">${i.qty > 1 ? `<span class="qty">${i.qty}</span>` : ''}</button>`;
  }).join('');
  for (let i = items.length; i < total; i++) html += `<div class="slot empty"></div>`;
  return html;
};

AF.renderItemDetail = function (id) {
  const box = $('#itemDetail');
  if (!box) return;
  const it = AF.ITEMS[id];
  if (!it) {
    box.innerHTML = `<div class="empty-note">${icon('i-bag')}<br><br>Select an item to inspect it.<br>Weapons, armor and gems await.</div>`;
    return;
  }
  const r = AF.RARITY[it.rarity] || AF.RARITY.common;
  const equipped = AF.isEquipped(id);
  const stats = Object.entries(it.stats || {}).map(([k, v]) => {
    const label = { atk: 'Attack', def: 'Defense', hp: 'Health', mp: 'Mana', spd: 'Speed', crit: 'Crit' }[k] || k;
    const val = k === 'crit' ? `+${Math.round(v * 100)}%` : (v > 0 ? `+${v}` : `${v}`);
    return `<div class="row"><span>${label}</span><b style="color:${v > 0 ? '#9fe0a8' : '#ff9a9a'}">${val}</b></div>`;
  }).join('');
  box.innerHTML = `
    <div class="item-hero">
      <div class="item-ico"><img src="${it.icon}" alt="${it.name}"></div>
      <div>
        <div class="item-name">${it.name}</div>
        <div class="rarity ${r.cls}">${r.label} · ${AF.SLOT_LABEL[it.slot] || it.slot}</div>
      </div>
    </div>
    ${stats ? `<div class="item-stats">${stats}</div>` : ''}
    <p class="item-flavor">${it.desc}<br><span style="color:#6f7789">${it.flavor || ''}</span></p>
    <div class="gold-line">${icon('i-coin')} Value ${fmt(it.price)} <span style="color:#6f7789">· sells for ${fmt(Math.round(it.price * 0.55))}</span></div>
    <div class="item-actions">
      ${it.slot !== 'gem' && it.slot !== 'potion'
        ? (equipped
          ? `<button class="btn btn-sm" id="unequipBtn">${icon('i-close')} Unequip</button>`
          : `<button class="btn btn-sm btn-primary" id="equipBtn">${icon('i-sword')} Equip</button>`)
        : ''}
      ${it.slot !== 'potion' ? `<button class="btn btn-sm btn-danger" id="sellBtn">${icon('i-coin')} Sell ${fmt(AF.sellValue(id))}</button>` : ''}
    </div>`;

  const eq = $('#equipBtn'), un = $('#unequipBtn'), sell = $('#sellBtn');
  if (eq) eq.addEventListener('click', () => { AF.equip(id); toast(`${it.name} equipped`); AF.renderHome(); AF.panelInventory(); });
  if (un) un.addEventListener('click', () => { AF.unequip(it.slot); toast(`${it.name} unequipped`); AF.renderHome(); AF.panelInventory(); });
  if (sell) sell.addEventListener('click', () => {
    const gold = AF.sellValue(id);
    if (AF.sell(id)) { toast(`Sold ${it.name} for ${fmt(gold)} gold`); AF.invSelected = null; AF.renderHome(); AF.panelInventory(); }
  });
};

/* ── map ──────────────────────────────────────────────────── */
AF.panelMap = function () {
  const nodes = [
    { id: 'forest', x: 18, y: 66 },
    { id: 'ash', x: 40, y: 40 },
    { id: 'frost', x: 63, y: 62 },
    { id: 'lair', x: 84, y: 32 }
  ];
  const root = AF.mountPanel('map', `
    <div class="dlg-body">
      <div class="map-wrap">
        <div class="map-canvas">
          <img src="assets/ui/home.jpg" alt="World map of the Shattered Realms">
          ${nodes.map(n => {
            const d = AF.dungeonById(n.id);
            const locked = AF.state.level < AF.dungeonReq(n.id);
            return `<div class="map-node ${locked ? 'locked' : ''}" style="left:${n.x}%;top:${n.y}%" data-map="${n.id}">
              <span class="pin">${icon(locked ? 'i-lock' : 'i-sword')}</span>
              <span>${d.name}</span></div>`;
          }).join('')}
        </div>
        <div class="panel-box">
          <div class="box-head"><h3>Regions</h3><span>${AF.DUNGEONS.filter(d => AF.state.level >= AF.dungeonReq(d.id)).length} unlocked</span></div>
          <div class="quest-list">
            ${AF.DUNGEONS.map(d => {
              const locked = AF.state.level < AF.dungeonReq(d.id);
              return `<div class="quest-card ${locked ? '' : 'done'}" style="${locked ? 'opacity:.6' : ''}">
                <div class="qi">${icon(locked ? 'i-lock' : 'i-map')}</div>
                <div><h4>${d.name}</h4><p>Rec. Lv ${d.lvl[0]}${d.lvl[1] > 90 ? '+' : '–' + d.lvl[1]} · ${d.tier}</p></div>
              </div>`;
            }).join('')}
          </div>
          <button class="btn btn-primary btn-wide" style="margin-top:12px" id="mapGo">${icon('i-sword')} Choose Dungeon</button>
        </div>
      </div>
    </div>`);

  $$('[data-map]', root).forEach(node => node.addEventListener('click', () => {
    const d = AF.dungeonById(node.dataset.map);
    if (AF.state.level < AF.dungeonReq(d.id)) { AUDIO.sfx('error'); toast(`Locked — requires level ${AF.dungeonReq(d.id)}`); return; }
    AF.showScreen('dungeons'); setTimeout(() => AF.selectDungeon(d), 60);
  }));
  const go = $('#mapGo', root);
  if (go) go.addEventListener('click', () => { AF.showScreen('dungeons'); });
};

/* ── shop ─────────────────────────────────────────────────── */
AF.shopTab = 'buy';

AF.panelShop = function () {
  const st = AF.state;
  const tab = AF.shopTab;
  const stock = [...new Set(AF.SHOP.flat())].map(id => ({ id, ...AF.ITEMS[id] }));
  const list = tab === 'buy'
    ? stock.map(it => ({ ...it, price: it.price }))
    : st.inventory.map(i => ({ id: i.id, ...AF.ITEMS[i.id], qty: i.qty, price: AF.sellValue(i.id) })).filter(i => i.slot !== 'gem' || true);

  const root = AF.mountPanel('shop', `
    <div class="dlg-body">
      <div class="dlg-tabs" style="margin-bottom:14px">
        <button class="tab ${tab === 'buy' ? 'on' : ''}" data-tab="buy">Buy</button>
        <button class="tab ${tab === 'sell' ? 'on' : ''}" data-tab="sell">Sell</button>
      </div>
      <div class="shop-layout">
        <div class="shop-list" id="shopList">
          ${list.length ? list.map(it => `
            <div class="shop-row">
              <div class="si"><img src="${it.icon}" alt=""></div>
              <div style="min-width:0">
                <div class="nm">${it.name}${it.qty > 1 ? ` <span style="color:#8b93a5;font-size:10px">×${it.qty}</span>` : ''}</div>
                <div class="ds">${(it.stats && Object.keys(it.stats).length) ? Object.entries(it.stats).map(([k, v]) => `${k.toUpperCase()} ${v > 0 ? '+' : ''}${k === 'crit' ? Math.round(v * 100) + '%' : v}`).join(' · ') : (AF.RARITY[it.rarity] || {}).label}</div>
              </div>
              <div class="pr">${icon('i-coin')} ${fmt(it.price)}</div>
              <button class="btn btn-sm" data-buy="${it.id}">${tab === 'buy' ? 'Buy' : 'Sell'}</button>
            </div>`).join('')
            : `<div class="empty-note">Nothing to sell yet. Loot the dungeons!</div>`}
        </div>
        <div class="panel-box">
          <div class="box-head"><h3>${tab === 'buy' ? 'Trader’s Note' : 'Pawnbroker'}</h3></div>
          <p class="hint" style="line-height:1.6">
            ${tab === 'buy'
              ? '“Steel first, stories later. Everything on this counter came back out of a dungeon — most of it still warm.”'
              : 'Gear sells for 55% of its value. Gems always fetch a fair price.'}
          </p>
          <div style="margin-top:14px;display:flex;flex-direction:column;gap:8px">
            ${['Common gear restocks every run', 'Potions are always available', 'Boss loot is never sold here'].map(t => `<div class="mini-stat">${icon('i-star')} ${t}</div>`).join('')}
          </div>
          <div style="margin-top:16px">
            <div class="box-head"><h3>Your Purse</h3></div>
            <div class="gold-line">${icon('i-coin')} ${fmt(st.gold)} gold</div>
            <div class="gold-line">${icon('i-gem')} ${fmt(st.gems)} gems</div>
          </div>
        </div>
      </div>
    </div>`);

  $$('[data-tab]', root).forEach(b => b.addEventListener('click', () => { AF.shopTab = b.dataset.tab; AUDIO.sfx('click'); AF.panelShop(); }));
  $$('[data-buy]', root).forEach(b => b.addEventListener('click', () => {
    const id = b.dataset.buy;
    if (AF.shopTab === 'buy') {
      const r = AF.buy(id);
      toast(r.msg); AUDIO.sfx(r.ok ? 'coin' : 'error');
    } else {
      const it = AF.ITEMS[id];
      if (AF.sell(id)) { toast(`Sold ${it.name}`); }
    }
    AF.renderHome(); AF.panelShop();
  }));
};

/* ── ranks ────────────────────────────────────────────────── */
AF.panelRanks = function () {
  const board = AF.board();
  const top = board.slice(0, 3);
  const rest = board.slice(3);
  const order = [1, 0, 2]; // silver, gold, bronze
  const root = AF.mountPanel('ranks', `
    <div class="dlg-body">
      <div class="podium">
        ${order.map((idx, i) => {
          const e = top[idx];
          if (!e) return `<div></div>`;
          const rank = idx + 1;
          return `<div class="pod-card ${rank === 1 ? 'first' : ''}">
            <div class="pod-rank">${rank}</div>
            <div class="pod-face">${AF.heroPortraitImg(e.hero, 96)}</div>
            <div class="pod-name">${e.name}</div>
            <div class="pod-sub">${AF.CLASSES[e.hero] ? AF.CLASSES[e.hero].title : 'Wanderer'} · Floor ${e.floor}</div>
            <div class="pod-score">${fmt(e.score)}</div>
            <div class="pod-ico">${icon(rank === 1 ? 'i-trophy' : 'i-star')}</div>
          </div>`;
        }).join('')}
      </div>
      <div class="rank-list">
        ${rest.map((e, i) => `
          <div class="rank-row ${e.mine ? 'me' : ''}">
            <span class="n">${i + 4}</span>
            <span class="nm">${e.name}</span>
            <span class="fl">${AF.CLASSES[e.hero] ? AF.CLASSES[e.hero].title : '—'} · Floor ${e.floor}</span>
            <span class="sc">${fmt(e.score)}</span>
          </div>`).join('')}
        ${AF.state.runs.length === 0 ? `<p class="hint" style="margin-top:12px">Your runs appear here once you descend.</p>` : ''}
      </div>
    </div>`);
};

/* ── settings ─────────────────────────────────────────────── */
AF.panelSettings = function () {
  const s = AF.state.settings;
  const root = AF.mountPanel('settings', `
    <div class="dlg-body">
      <div class="set-grid">
        <div class="panel-box">
          <div class="box-head"><h3>Audio</h3></div>
          <div class="set-row">
            <div><div class="lab">Music</div><div class="sub">Ambient score</div></div>
            <div class="ctl"><input type="range" min="0" max="100" value="${Math.round(s.music * 100)}" id="musicRange" aria-label="Music volume"></div>
          </div>
          <div class="set-row" style="margin-top:8px">
            <div><div class="lab">Sound effects</div><div class="sub">Strikes, loot, UI</div></div>
            <div class="ctl"><input type="range" min="0" max="100" value="${Math.round(s.sfx * 100)}" id="sfxRange" aria-label="Sound effect volume"></div>
          </div>
        </div>
        <div class="panel-box">
          <div class="box-head"><h3>Feedback</h3></div>
          <div class="set-row">
            <div><div class="lab">Screen shake</div><div class="sub">On heavy hits</div></div>
            <div class="ctl"><button class="switch ${s.shake ? 'on' : ''}" data-toggle="shake" aria-label="Toggle screen shake"><i></i></button></div>
          </div>
          <div class="set-row" style="margin-top:8px">
            <div><div class="lab">Damage numbers</div><div class="sub">Floating combat text</div></div>
            <div class="ctl"><button class="switch ${s.numbers ? 'on' : ''}" data-toggle="numbers" aria-label="Toggle damage numbers"><i></i></button></div>
          </div>
        </div>
        <div class="panel-box">
          <div class="box-head"><h3>Controls</h3></div>
          <div class="key-list">
            <div class="key-row"><span>Move</span><kbd>WASD</kbd></div>
            <div class="key-row"><span>Attack</span><kbd>J / Space</kbd></div>
            <div class="key-row"><span>Skill</span><kbd>K</kbd></div>
            <div class="key-row"><span>Dash</span><kbd>Shift</kbd></div>
            <div class="key-row"><span>Potion</span><kbd>1</kbd></div>
            <div class="key-row"><span>Pause</span><kbd>Esc</kbd></div>
            <div class="key-row"><span>Attack</span><kbd>Left click</kbd></div>
            <div class="key-row"><span>Skill</span><kbd>Right click</kbd></div>
          </div>
        </div>
        <div class="panel-box">
          <div class="box-head"><h3>Save Data</h3></div>
          <p class="hint">Progress is stored in this browser. Resetting erases your hero, gold, gear and records.</p>
          <button class="btn btn-danger btn-wide" style="margin-top:12px" id="resetSave">${icon('i-close')} Reset Progress</button>
        </div>
      </div>
      <p class="hint" style="margin-top:16px;text-align:center">Astral Fantasy · built with the supplied UI, sprite and environment assets.</p>
    </div>`);

  const mr = $('#musicRange', root), sr = $('#sfxRange', root);
  mr.addEventListener('input', () => {
    s.music = Number(mr.value) / 100;
    AUDIO.setMusicVolume(s.music); AUDIO.startMusic('menu'); AF.persist();
  });
  sr.addEventListener('input', () => {
    s.sfx = Number(sr.value) / 100;
    AUDIO.setSfxVolume(s.sfx); AF.persist();
  });
  sr.addEventListener('change', () => AUDIO.sfx('click'));
  $$('[data-toggle]', root).forEach(btn => btn.addEventListener('click', () => {
    const k = btn.dataset.toggle;
    s[k] = !s[k];
    btn.classList.toggle('on', s[k]);
    AF.persist();
    AUDIO.sfx('click');
  }));
  $('#resetSave', root).addEventListener('click', () => {
    if (AF.resetSaveArmed) {
      AF.resetProgress();
      AF.renderHome(); AF.showScreen('home');
      toast('Progress reset. A new story begins.');
      AF.resetSaveArmed = false;
    } else {
      AF.resetSaveArmed = true;
      $('#resetSave').innerHTML = `${icon('i-close')} Click again to confirm`;
      setTimeout(() => { AF.resetSaveArmed = false; const b = $('#resetSave'); if (b) b.innerHTML = `${icon('i-close')} Reset Progress`; }, 3500);
    }
  });
};

/* ── result / reward screens ──────────────────────────────── */
AF.showResult = function ({ title, sub, glyph = 'i-trophy', rewards = [], loot = [], actions = [], tone = 'gold', closable = false }) {
  const lootHTML = loot.length ? `<div class="loot-grid">${loot.map(l => {
    const it = AF.ITEMS[l.id];
    if (!it) return '';
    return `<div class="loot-item"><div class="li"><img src="${it.icon}" alt=""></div><span>${it.name}</span></div>`;
  }).join('')}</div>` : '';
  const rewardHTML = rewards.length ? `<div class="reward-row">${rewards.map(r => `<div class="reward">${icon(r.icon || 'i-coin')} ${r.text}</div>`).join('')}</div>` : '';
  const card = AF.openOverlay(`
    <div class="dlg-body">
      <div class="result">
        <div class="glyph" style="${tone === 'red' ? 'border-color:rgba(224,90,90,.6);color:#ffb0a0' : ''}">${icon(glyph)}</div>
        <h2>${title}</h2>
        ${sub ? `<div class="rsub">${sub}</div>` : ''}
        ${rewardHTML}
        ${lootHTML}
        <div class="result-actions">${actions.map((a, i) => `<button class="btn ${a.cls || 'btn-primary'}" data-act="${i}">${a.label}</button>`).join('')}</div>
      </div>
    </div>`, { closable });
  $$('[data-act]', card).forEach((b, i) => b.addEventListener('click', () => {
    AUDIO.sfx('click');
    const a = actions[i];
    if (a && a.fn) a.fn();
  }));
};
