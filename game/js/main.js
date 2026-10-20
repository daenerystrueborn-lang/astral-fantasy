/* ============================================================
   ASTRAL FANTASY — boot & global wiring
   ============================================================ */
(function main() {
  let bootReady = false;
  let bootStarted = false;

  AF.loadState();
  Combat.init();

  const applySettings = () => {
    const s = AF.state.settings;
    AUDIO.setMusicVolume(s.music);
    AUDIO.setSfxVolume(s.sfx);
  };

  /* ── loading ─────────────────────────────────────────── */
  const fill = $('#bootFill'), tip = $('#bootTip'), startBtn = $('#bootStart');
  const tips = AF.TIPS;
  let tipIdx = 0;
  const tipTimer = setInterval(() => {
    tipIdx = (tipIdx + 1) % tips.length;
    tip.textContent = tips[tipIdx];
  }, 2400);

  const started = performance.now();
  preload(p => {
    const pct = Math.round(p * 100);
    fill.style.width = pct + '%';
    if (pct < 100) tip.textContent = `Summoning the realm… ${pct}%`;
  }).then(async () => {
    const elapsed = performance.now() - started;
    if (elapsed < 1200) await wait(1200 - elapsed);
    clearInterval(tipTimer);
    fill.style.width = '100%';
    tip.textContent = 'The gate is open.';
    bootReady = true;
    startBtn.hidden = false;
  });

  const begin = () => {
    if (!bootReady || bootStarted) return;
    bootStarted = true;
    AUDIO.init();
    AUDIO.resume();
    applySettings();
    AUDIO.sfx('door');
    startBtn.hidden = true;
    document.removeEventListener('keydown', onBootKey);
    document.removeEventListener('pointerdown', onBootPointer);
    AF.showScreen('home');
    setTimeout(() => {
      if (!AF.state.seenIntro) {
        AF.state.seenIntro = true;
        AF.persist();
        AF.openOverlay(`
          <div class="dlg-body">
            <div class="result">
              <div class="glyph">${icon('i-gem')}</div>
              <h2>The Shattered Realms</h2>
              <div class="rsub">The rifts broke the old kingdom into four dungeons.</div>
              <div style="max-width:520px;margin:14px auto 0;text-align:left;display:flex;flex-direction:column;gap:9px">
                <div class="mini-stat">${icon('i-sword')}<span>Move with <b>WASD</b> or the arrow keys, and strike with <b>J</b> or <b>Space</b>.</span></div>
                <div class="mini-stat">${icon('i-bolt')}<span>Spend mana on your class skill with <b>K</b>, and dash with <b>Shift</b>.</span></div>
                <div class="mini-stat">${icon('i-map')}<span>Clear a room's foes, then step into the astral gate to descend.</span></div>
                <div class="mini-stat">${icon('i-trophy')}<span>Clear all three floors of a dungeon to claim its hoard.</span></div>
              </div>
              <div class="result-actions" style="margin-top:18px">
                <button class="btn btn-primary" id="introGo">${icon('i-sword')} Choose Your Hero</button>
              </div>
            </div>
          </div>`);
        const go = $('#introGo');
        if (go) go.addEventListener('click', () => { AF.closeOverlay(true); AUDIO.sfx('click'); AF.showScreen('heroes'); });
      }
    }, 600);
  };
  const onBootKey = e => {
    if (e.key === 'Tab') return;
    begin();
  };
  const onBootPointer = () => begin();
  startBtn.addEventListener('click', e => { e.stopPropagation(); begin(); });
  document.addEventListener('keydown', onBootKey);

  // pointer-to-start only after assets are ready (avoid blocking)
  const armPointer = setInterval(() => {
    if (bootReady) { document.addEventListener('pointerdown', onBootPointer); clearInterval(armPointer); }
  }, 200);

  /* ── home navigation ─────────────────────────────────── */
  $$('.rail-btn').forEach(b => {
    b.addEventListener('click', () => AF.openPanel(b.dataset.panel));
    b.addEventListener('mouseenter', () => AUDIO.sfx('hover'));
  });
  $('#homeEnter').addEventListener('click', () => {
    AUDIO.init(); AUDIO.resume(); AUDIO.sfx('click');
    AF.showScreen('dungeons');
  });
  const heroBtn = $('#homeHeroBtn');
  if (heroBtn) heroBtn.addEventListener('click', () => {
    AUDIO.init(); AUDIO.resume(); AUDIO.sfx('click');
    AF.showScreen('heroes');
  });
  $$('[data-back]').forEach(b => b.addEventListener('click', () => {
    AUDIO.sfx('click');
    AF.showScreen(b.dataset.back);
  }));

  // generic click / hover audio
  document.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (b && !b.disabled && AF.currentScreen !== 'play') AUDIO.sfx('click');
  });

  /* ── overlay behaviour ───────────────────────────────── */
  const ov = $('#overlay');
  ov.addEventListener('pointerdown', e => {
    if (e.target === ov && AF.overlayClosable) AF.closeOverlay();
  });
  addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (!ov.hidden && AF.overlayClosable) { AF.closeOverlay(); e.preventDefault(); return; }
    const cur = AF.currentScreen || '';
    if (cur.indexOf('panel-') === 0) { AUDIO.sfx('click'); AF.showScreen('home'); e.preventDefault(); }
  });

  /* ── settings-driven audio ───────────────────────────── */
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (AF.currentScreen === 'play' && Combat.running && !Combat.paused) Combat.pause(true);
      AUDIO.stopMusic();
    } else if (AF.currentScreen === 'home') AUDIO.startMusic('home');
  });

  /* ── convenience: expose for debugging ───────────────── */
  window.AF = AF;
  window.Combat = Combat;
  console.log('%c Astral Fantasy ', 'background:#1a2440;color:#f8e3a8;padding:2px 6px;border-radius:3px', 'ready — press any key');
})();
