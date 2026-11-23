// HUD: mission card, dispatch, wanted stars, cash, rank, weapons, crew,
// minimap + big map, dialogue, prompts, notifications, shop, title, pause
// and game-over screens. Refreshed at 10 Hz; the canvases redraw with it.
import { WEAPONS, WEAPON_ORDER, RANKS, rankFor, SHOP_UPGRADES, SHOP_GEAR, SHOP_SHOWROOM, RADIO } from './config.js';
import { fmtCash, fmtTime, clockString, clamp } from './random.js';

function el(id) { return document.getElementById(id); }

export function makeHud(W) {
  const H = {
    hudT: 0, dialogT: 0, notifyT: 0, toastT: 0,
    shopOpen: false,
  };

  function setText(id, text) {
    const n = el(id);
    if (n && n.textContent !== text) n.textContent = text;
  }

  function show(id, yes) {
    const n = el(id);
    if (n) n.classList.toggle('hidden', !yes);
  }

  // ---- notifications / toasts / dialogue ----
  H.notify = function (text) {
    const n = el('notify');
    if (!n) return;
    n.textContent = text;
    n.classList.remove('hidden');
    H.notifyT = 5.2;
  };

  H.toast = function (text) {
    const n = el('objective-toast');
    if (!n) return;
    n.textContent = text;
    n.classList.remove('hidden');
    H.toastT = 2.6;
  };

  H.showDialog = function (who, text, color, initials) {
    const box = el('dialogue');
    if (!box) return;
    setText('dialogue-who', who);
    setText('dialogue-text', text);
    const port = el('dialogue-portrait');
    if (port) {
      port.textContent = initials || '?';
      port.style.background = color || '#888';
    }
    box.classList.remove('hidden');
    H.dialogT = 7;
  };

  H.hideDialog = function () {
    show('dialogue', false);
    H.dialogT = 0;
  };

  H.flashDamage = function () {
    const v = el('damage-vignette');
    if (!v) return;
    v.classList.remove('hidden');
    v.style.opacity = '0.55';
    setTimeout(() => { v.style.opacity = '0'; }, 120);
    setTimeout(() => v.classList.add('hidden'), 500);
  };

  H.flashWanted = function () {
    const v = el('wanted-flash');
    if (!v) return;
    v.classList.remove('hidden');
    setTimeout(() => v.classList.add('hidden'), 900);
  };

  // ---- minimap + big map ----
  function drawMapCanvas(cv, big) {
    if (!cv) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    const S = cv.width;
    const toMap = (x, z) => [((x + 480) / 960) * S, ((z + 480) / 960) * S];
    ctx.clearRect(0, 0, S, S);
    ctx.fillStyle = '#20242e';
    ctx.fillRect(0, 0, S, S);
    // Beach + sea.
    ctx.fillStyle = '#c9b078';
    ctx.fillRect(((384 + 480) / 960) * S, 0, S - ((384 + 480) / 960) * S, S);
    ctx.fillStyle = '#2b6f8e';
    ctx.fillRect(((452 + 480) / 960) * S, 0, S - ((452 + 480) / 960) * S, S);
    // Roads.
    ctx.strokeStyle = '#565b66';
    ctx.lineWidth = big ? 5 : 3;
    for (const s of W.city.streets) {
      const [x1, y1] = toMap(-480, s);
      const [x2, y2] = toMap(480, s);
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      const [x3, y3] = toMap(s, -480);
      const [x4, y4] = toMap(s, 480);
      ctx.beginPath(); ctx.moveTo(x3, y3); ctx.lineTo(x4, y4); ctx.stroke();
    }
    ctx.strokeStyle = '#8a6a2a';
    ctx.lineWidth = big ? 4 : 2;
    const [bx1, by1] = toMap(352, -480);
    const [bx2, by2] = toMap(352, 480);
    ctx.beginPath(); ctx.moveTo(bx1, by1); ctx.lineTo(bx2, by2); ctx.stroke();
    // Stashes.
    ctx.fillStyle = '#ffd23f';
    ctx.font = 'bold ' + (big ? 13 : 9) + 'px system-ui';
    ctx.textAlign = 'center';
    for (const st of W.city.stashes) {
      if (st.taken) continue;
      const [x, y] = toMap(st.x, st.z);
      ctx.fillText('$', x, y + 3);
    }
    // Key letters on the big map.
    if (big) {
      const marks = [
        ['H', W.city.locations.safehouse], ['G', W.city.locations.garage],
        ['R', W.city.locations.raceStart], ['P', W.city.locations.precinct],
      ];
      ctx.font = 'bold 15px system-ui';
      for (const [ch, loc] of marks) {
        const [x, y] = toMap(loc.x, loc.z);
        ctx.fillStyle = '#111';
        ctx.beginPath(); ctx.arc(x, y, 10, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ffd23f';
        ctx.fillText(ch, x, y + 5);
      }
      const job = W.missions.job();
      if (job) {
        const [x, y] = toMap(W.city.locations.pier.x, W.city.locations.pier.z);
        ctx.fillStyle = '#ff5a5a';
        ctx.beginPath(); ctx.arc(x, y, 9, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.fillText(String(W.missions.jobIndex + 1), x, y + 5);
      }
    }
    // Mission marker.
    if (W.city.marker) {
      const [x, y] = toMap(W.city.marker.position.x, W.city.marker.position.z);
      ctx.fillStyle = '#ffd23f';
      ctx.beginPath(); ctx.arc(x, y, big ? 8 : 5, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    // Police units.
    ctx.fillStyle = '#4aa8ff';
    for (const u of W.police.units) {
      if (u.dead) continue;
      const [x, y] = toMap(u.x, u.z);
      ctx.beginPath(); ctx.arc(x, y, big ? 4 : 3, 0, Math.PI * 2); ctx.fill();
    }
    if (W.police.heli) {
      const [x, y] = toMap(W.police.heli.x, W.police.heli.z);
      ctx.fillStyle = '#9fd8ff';
      ctx.beginPath(); ctx.arc(x, y, big ? 6 : 4, 0, Math.PI * 2); ctx.fill();
    }
    // Player arrow.
    const pp = W.playerPos();
    const [px, py] = toMap(pp.x, pp.z);
    const heading = W.player.inCar ? W.player.inCar.heading : W.player.heading;
    ctx.save();
    ctx.translate(px, py);
    // Arrow drawn pointing up; canvas Y grows with world Z, so the
    // rotation that maps heading h to canvas space is (PI - h).
    ctx.rotate(Math.PI - heading);
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(0, -8); ctx.lineTo(5, 6); ctx.lineTo(-5, 6); ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  H.drawMinimap = function () { drawMapCanvas(el('minimap'), false); };
  H.drawBigMap = function () { drawMapCanvas(el('bigmap'), true); };

  // ---- the 10 Hz HUD refresh ----
  H.update = function (dt) {
    H.hudT -= dt;
    if (H.dialogT > 0) {
      H.dialogT -= dt;
      if (H.dialogT <= 0) H.hideDialog();
    }
    if (H.notifyT > 0) {
      H.notifyT -= dt;
      if (H.notifyT <= 0) show('notify', false);
    }
    if (H.toastT > 0) {
      H.toastT -= dt;
      if (H.toastT <= 0) show('objective-toast', false);
    }
    if (H.hudT > 0) return;
    H.hudT = 0.1;
    const p = W.player;
    const playing = W.state === 'playing' || W.state === 'shop';
    show('hud', W.state !== 'title');

    // Mission card.
    const job = W.missions.job();
    const stage = W.missions.stage();
    if (job && stage && W.missions.active) {
      setText('mission-job', 'JOB ' + (W.missions.jobIndex + 1) + '/8 \u2014 ' + job.name);
      setText('mission-name', job.name);
      setText('mission-objective', W.missions.objectiveLabel());
      setText('mission-stage', 'STAGE ' + (W.missions.stageIndex + 1) + '/' + job.stages.length + ' \u00b7 ' + stage.type.toUpperCase());
      const next = JOBS_NEXT_NAME(W);
      setText('mission-next-text', next);
      show('mission-next', !!next);
      if (stage.type === 'race' && W.missions.race) {
        setText('mission-timer', fmtTime(W.missions.race.timeLeft));
        show('mission-timer', true);
      } else if (stage.type === 'survive') {
        setText('mission-timer', fmtTime(W.missions.surviveLeft));
        show('mission-timer', true);
      } else {
        show('mission-timer', false);
      }
      const fill = el('mission-stage-fill');
      if (fill) fill.style.width = Math.round(((W.missions.stageIndex) / job.stages.length) * 100) + '%';
    } else if (W.missions.completedJobs >= 8) {
      setText('mission-job', 'PALMERA BAY IS YOURS');
      setText('mission-objective', 'You run the bay now, Dante.');
      setText('mission-stage', 'BAY BOSS');
    } else {
      setText('mission-job', 'FREE ROAM');
      setText('mission-objective', 'Explore Palmera Bay. Find stashes, steal cars, dodge the law.');
      setText('mission-stage', 'NO ACTIVE JOB');
      show('mission-next', false);
      show('mission-timer', false);
    }

    // Dispatch panel.
    const units = W.police.units.filter((u) => !u.dead).slice(0, 6);
    setText('dispatch-head', 'DISPATCH \u2014 ' + W.police.state.toUpperCase());
    const dl = el('dispatch-list');
    if (dl) {
      dl.innerHTML = units.map((u) => {
        const pp = W.playerPos();
        const d = Math.round(Math.hypot(u.x - pp.x, u.z - pp.z));
        return '<div class="dispatch-row"><span>' + (u.unitName || 'UNIT') + '</span><span>' + d + 'm</span><span>' + (u.unitRole || 'PURSUE') + '</span></div>';
      }).join('');
    }
    setText('dispatch-foot', W.police.heli ? 'AIR-1 overhead' : W.police.footCops.filter((c) => !c.dead).length + ' officers on foot');
    show('dispatch', W.police.wanted > 0);

    // Clock + radio.
    setText('clock', clockString(W.clockMinutes));
    const st = RADIO[W.audio.station];
    setText('radio-now', st.name + ' ' + st.freq);
    setText('radio-station', st.name + ' ' + st.freq);
    setText('radio-song', '\u266a ' + st.song);

    // Cash, wanted, rank.
    setText('cash', fmtCash(p.cash));
    const starsEl = el('stars');
    if (starsEl) {
      starsEl.textContent = '\u2605'.repeat(W.police.wanted) + '\u2606'.repeat(5 - W.police.wanted);
      starsEl.classList.toggle('hot', W.police.wanted > 0);
    }
    setText('wanted-state', W.police.wanted === 0 ? 'CLEAN' : 'WANTED \u2014 ' + W.police.state.toUpperCase());
    const rank = rankFor(p.respect);
    const nextRank = RANKS.find((r) => r.min > p.respect);
    setText('rank-name', rank.name);
    setText('rank-badge', rank.name);
    setText('rank-line', rank.name + ' \u00b7 ' + Math.round(p.respect) + ' respect');
    setText('respect-text', Math.round(p.respect) + ' / ' + (nextRank ? nextRank.min : 2600));
    const rf = el('respect-fill');
    if (rf) rf.style.width = clamp((p.respect / (nextRank ? nextRank.min : 2600)) * 100, 0, 100) + '%';
    const rb = el('respect-bar');
    if (rb) rb.title = 'Respect ' + Math.round(p.respect);

    // Weapons.
    const wEl = el('weapons');
    if (wEl) {
      wEl.innerHTML = WEAPON_ORDER.map((id) => {
        const wdef = WEAPONS[id];
        const w = p.weapons[id];
        if (!w.owned) return '';
        const mag = w.mag === Infinity ? '\u221e' : w.mag + '/' + (w.reserve === Infinity ? '\u221e' : w.reserve);
        return '<div class="wslot' + (p.weaponId === id ? ' active' : '') + '"><b>' + wdef.key + '</b> ' + wdef.name + ' <span>' + mag + '</span></div>';
      }).join('');
    }

    // Crew chips.
    const cEl = el('crew');
    if (cEl) {
      cEl.innerHTML = ['nico', 'tomas', 'sofia'].map((id) => {
        const cd = Math.ceil(p.crewCd[id]);
        const label = id === 'nico' ? 'NICO [Z]' : id === 'tomas' ? 'TOMAS [X]' : 'SOFIA [V]';
        return '<div class="crew-chip' + (cd > 0 ? ' cooling' : '') + '">' + label + (cd > 0 ? ' \u00b7 ' + cd + 's' : '') + '</div>';
      }).join('');
    }

    // District + vitals.
    const pp = W.playerPos();
    const d = W.city.districtAt(pp.x, pp.z);
    setText('district-name', d.name);
    setText('district-sub', d.sub + ' \u00b7 ' + d.blurb);
    const hf = el('health-fill');
    if (hf) hf.style.width = clamp(p.hp, 0, 100) + '%';
    setText('health-num', Math.round(p.hp));
    const af = el('armour-fill');
    if (af) af.style.width = clamp(p.armour, 0, 100) + '%';
    setText('armour-num', Math.round(p.armour));

    // Vehicle card.
    const car = p.inCar;
    show('vehicle-card', !!car);
    if (car) {
      setText('vehicle-name', car.spec.name);
      setText('cond-num', Math.round(car.cond));
      const cf = el('cond-fill');
      if (cf) cf.style.width = clamp(car.cond, 0, 100) + '%';
      setText('speed-num', String(Math.round(Math.abs(car.speed) * 3.6)));
      setText('speed-unit', 'km/h');
    }

    // Crosshair: on foot with a firearm only.
    const cross = el('crosshair');
    if (cross) {
      const showCross = !car && p.weaponId !== 'fists' && playing;
      cross.classList.toggle('hidden', !showCross);
    }

    // Context prompt.
    H.updatePrompt();

    // Minimap.
    if (playing) H.drawMinimap();
  };

  H.updatePrompt = function () {
    const p = W.player;
    const prompt = el('prompt');
    if (!prompt) return;
    if (W.state !== 'playing') { prompt.classList.add('hidden'); return; }
    const pp = W.playerPos();
    let text = '';
    if (!p.inCar) {
      const car = p.nearestCar(4);
      if (car) text = 'E STEAL ' + car.spec.name;
      else if (Math.hypot(pp.x - W.city.locations.garage.x, pp.z - W.city.locations.garage.z) < 16) text = 'G IBARRA CUSTOMS \u2014 GARAGE & GUNS';
      else if (Math.hypot(pp.x - W.city.locations.raceStart.x, pp.z - W.city.locations.raceStart.z) < 14) text = 'E STREET RACE \u2014 $500 ENTRY \u00b7 WIN $1,200';
      else if (Math.hypot(pp.x - W.city.locations.safehouse.x, pp.z - W.city.locations.safehouse.z) < 12) text = 'SAFEHOUSE \u2014 PROGRESS SAVED';
      else if (W.hintDeliver) text = 'You need a car for this drop';
    } else {
      if (Math.hypot(pp.x - W.city.locations.raceStart.x, pp.z - W.city.locations.raceStart.z) < 14) text = 'E STREET RACE \u2014 $500 ENTRY \u00b7 WIN $1,200';
      else if (Math.hypot(pp.x - W.city.locations.garage.x, pp.z - W.city.locations.garage.z) < 16) text = 'G IBARRA CUSTOMS \u2014 GARAGE & GUNS';
    }
    if (text) { prompt.textContent = text; prompt.classList.remove('hidden'); }
    else prompt.classList.add('hidden');
  };

  function JOBS_NEXT_NAME(W2) {
    const idx = W2.missions.jobIndex + 1;
    if (idx >= 8) return '';
    const jobs = ['FIRST WHEELS', 'REPO RODEO', 'MARKET SQUEEZE', 'DOCKSIDE AMBUSH', 'HIGH TIDE', 'GOLDEN HOUR', 'THE LONG WAY HOME', 'BAY BOSS'];
    return 'NEXT: ' + jobs[idx];
  }

  // ---- job done / game over overlays ----
  H.showJobDone = function (job) {
    setText('job-done-title', 'JOB COMPLETE');
    setText('job-done-text', job.name + ' \u2014 well done, Dante.');
    setText('job-done-reward', '+' + fmtCash(job.reward) + ' \u00b7 +' + job.respect + ' respect');
    show('job-done', true);
  };

  H.hideJobDone = function () { show('job-done', false); };

  H.showGameOver = function (kind, text) {
    setText('gameover-title', kind);
    setText('gameover-text', text);
    show('gameover', true);
  };

  H.hideGameOver = function () { show('gameover', false); };

  // ---- pause / map screen ----
  H.openPause = function () {
    const p = W.player;
    setText('stat-respect', String(Math.round(p.respect)));
    setText('stat-cash', fmtCash(p.cash));
    setText('stat-jobs', W.missions.completedJobs + '/8');
    setText('stat-complete', W.missions.completion() + '%');
    const cf = el('complete-fill');
    if (cf) cf.style.width = W.missions.completion() + '%';
    const cb = el('complete-bar');
    if (cb) cb.title = 'Completion ' + W.missions.completion() + '%';
    const ms = el('map-stats');
    if (ms) {
      ms.innerHTML =
        '<div>Cars stolen <b>' + p.stats.carsStolen + '</b></div>' +
        '<div>Stars lost <b>' + p.stats.starsLost + '</b></div>' +
        '<div>Knockouts <b>' + p.stats.knockouts + '</b></div>' +
        '<div>Race wins <b>' + p.stats.raceWins + '</b></div>' +
        '<div>Driven <b>' + p.stats.drivenKm.toFixed(1) + ' km</b></div>' +
        '<div>Shots fired <b>' + p.stats.shotsFired + '</b></div>';
    }
    H.drawBigMap();
    show('pause-menu', true);
  };

  H.closePause = function () { show('pause-menu', false); };

  // ---- shop ----
  H.openShop = function () {
    H.shopOpen = true;
    show('shop', true);
    H.renderShop();
  };

  H.closeShop = function () {
    H.shopOpen = false;
    show('shop', false);
  };

  H.renderShop = function () {
    const car = W.player.inCar || W.lastCar;
    setText('shop-cash-num', fmtCash(W.player.cash));
    if (car) {
      setText('shop-car-name', car.spec.name + (car.tuned ? ' \u00b7 TUNED' : '') + (car.plated ? ' \u00b7 PLATED' : '') + (car.nitro ? ' \u00b7 NITRO' : ''));
      setText('shop-cond-num', String(Math.round(car.cond)));
      const cf = el('shop-cond-fill');
      if (cf) cf.style.width = clamp(car.cond, 0, 100) + '%';
      setText('mod-tune', car.tuned ? 'TUNE: YES' : 'TUNE: NO');
      setText('mod-plating', car.plated ? 'PLATING: YES' : 'PLATING: NO');
      setText('mod-nitro', car.nitro ? 'NITRO: YES' : 'NITRO: NO');
      drawShopCar(car);
    }
    const list = el('shop-list');
    if (list) {
      list.innerHTML = '';
      for (const item of SHOP_UPGRADES) {
        const b = document.createElement('button');
        b.className = 'shop-item';
        b.innerHTML = '<b>' + item.name + '</b> <span>' + fmtCash(item.price) + '</span><i>' + item.desc + '</i>';
        b.addEventListener('click', (ev) => {
          ev.stopPropagation();
          W.buyUpgrade(item.id);
          H.renderShop();
        });
        list.appendChild(b);
      }
    }
    const list2 = el('shop-list2');
    if (list2) {
      list2.innerHTML = '';
      for (const item of [...SHOP_GEAR, ...SHOP_SHOWROOM]) {
        const b = document.createElement('button');
        b.className = 'shop-item';
        b.innerHTML = '<b>' + item.name + '</b> <span>' + fmtCash(item.price) + '</span><i>' + item.desc + '</i>';
        b.addEventListener('click', (ev) => {
          ev.stopPropagation();
          if (SHOP_SHOWROOM.some((s) => s.id === item.id)) W.buyShowroomCar(item.id);
          else W.buyGear(item.id);
          H.renderShop();
        });
        list2.appendChild(b);
      }
    }
    setText('shop-desc', 'Ibarra Customs \u2014 repairs, tunes, plating, nitro, guns and the showroom. Cash: ' + fmtCash(W.player.cash));
  };

  function drawShopCar(car) {
    const cv = el('shop-car-canvas');
    if (!cv) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.fillStyle = '#1d212b';
    ctx.fillRect(0, 0, cv.width, cv.height);
    const hex = '#' + car.color.toString(16).padStart(6, '0');
    ctx.fillStyle = hex;
    const cx = cv.width / 2, cy = cv.height / 2;
    ctx.fillRect(cx - 90, cy - 34, 180, 68);
    ctx.fillStyle = '#141a24';
    ctx.fillRect(cx - 45, cy - 26, 90, 52);
    ctx.fillStyle = '#111';
    ctx.beginPath(); ctx.arc(cx - 55, cy - 36, 16, 0, Math.PI * 2); ctx.arc(cx + 55, cy - 36, 16, 0, Math.PI * 2);
    ctx.arc(cx - 55, cy + 36, 16, 0, Math.PI * 2); ctx.arc(cx + 55, cy + 36, 16, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 15px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText(car.spec.name, cx, cy + 62);
  }

  // ---- title screen ----
  H.refreshTitle = function () {
    const save = W.save.read();
    const has = !!save;
    show('btn-continue', has);
    if (has) {
      const when = save.savedAt ? new Date(save.savedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
      setText('continue-label', 'JOB ' + (save.jobIndex + 1) + '/8 \u00b7 ' + fmtCash(save.cash) + (when ? ' \u00b7 ' + when : ''));
      setText('title-save-note', 'Save found \u2014 continue your story.');
    } else {
      setText('title-save-note', 'No save yet \u2014 start a new story.');
    }
  };

  H.showTitle = function () {
    show('title-screen', true);
    show('hud', false);
    show('pause-menu', false);
    show('shop', false);
    show('gameover', false);
    show('job-done', false);
    H.refreshTitle();
  };

  H.hideTitle = function () { show('title-screen', false); };

  // Wire the static buttons once.
  H.wireButtons = function () {
    const on = (id, fn) => {
      const n = el(id);
      if (n) n.addEventListener('click', (ev) => { ev.stopPropagation(); W.audio.ensure(); fn(); });
    };
    on('btn-new', () => W.startNewGame());
    on('btn-continue', () => W.continueGame());
    on('btn-how', () => show('howto', true));
    on('btn-how-close', () => show('howto', false));
    on('btn-resume', () => W.setPaused(false));
    on('btn-save', () => { W.save.write(); W.notify('Game saved'); });
    on('btn-quit', () => W.quitToTitle());
    on('btn-shop-close', () => W.closeShop());
    on('btn-job-next', () => H.hideJobDone());
    on('btn-respawn', () => W.respawn());
    const dlg = el('dialogue');
    if (dlg) dlg.addEventListener('click', (ev) => { ev.stopPropagation(); H.hideDialog(); });
  };

  return H;
}
