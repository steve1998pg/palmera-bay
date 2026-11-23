// HUD: mission card, dispatch, wanted stars, cash, rank, weapons, crew,
// minimap + big map, dialogue, prompts, notifications, shop, title, pause
// and game-over screens. Refreshed at 10 Hz; the canvases redraw with it.
import { WEAPONS, WEAPON_ORDER, RANKS, rankFor, SHOP_UPGRADES, SHOP_GEAR, SHOP_SHOWROOM, RADIO } from './config.js';
import { fmtCash, fmtTime, clockString, clamp } from './random.js';

const CREW_LABELS = { nico: 'NICO [Z]', tomas: 'TOMAS [X]', sofia: 'SOFIA [V]' };

function el(id) { return document.getElementById(id); }

function setText(id, text) {
  const n = el(id);
  if (n && n.textContent !== text) n.textContent = text;
}

function show(id, yes) {
  const n = el(id);
  if (n) n.classList.toggle('hidden', !yes);
}

function setBar(id, pct) {
  const n = el(id);
  if (n) n.style.width = clamp(pct, 0, 100) + '%';
}

export function makeHud(W) {
  const H = {
    hudT: 0, dialogT: 0, notifyT: 0, toastT: 0,
    shopOpen: false,
  };

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
    paintSeaAndSand(ctx, S);
    paintRoads(ctx, toMap, big);
    paintStashes(ctx, toMap, big);
    if (big) paintKeyLetters(ctx, toMap);
    paintMarker(ctx, toMap, big);
    paintPolice(ctx, toMap, big);
    paintPlayerArrow(ctx, toMap);
  }

  function paintSeaAndSand(ctx, S) {
    const beachX = ((384 + 480) / 960) * S;
    const seaX = ((452 + 480) / 960) * S;
    ctx.fillStyle = '#c9b078';
    ctx.fillRect(beachX, 0, S - beachX, S);
    ctx.fillStyle = '#2b6f8e';
    ctx.fillRect(seaX, 0, S - seaX, S);
  }

  function paintRoads(ctx, toMap, big) {
    ctx.strokeStyle = '#565b66';
    ctx.lineWidth = big ? 5 : 3;
    const roadLine = (ax, az, bx, bz) => {
      const [x1, y1] = toMap(ax, az);
      const [x2, y2] = toMap(bx, bz);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    };
    for (const s of W.city.streets) {
      roadLine(-480, s, 480, s);
      roadLine(s, -480, s, 480);
    }
    ctx.strokeStyle = '#8a6a2a';
    ctx.lineWidth = big ? 4 : 2;
    roadLine(352, -480, 352, 480);
  }

  function paintStashes(ctx, toMap, big) {
    ctx.fillStyle = '#ffd23f';
    ctx.font = 'bold ' + (big ? 13 : 9) + 'px system-ui';
    ctx.textAlign = 'center';
    for (const st of W.city.stashes) {
      if (st.taken) continue;
      const [x, y] = toMap(st.x, st.z);
      ctx.fillText('$', x, y + 3);
    }
  }

  function paintKeyLetters(ctx, toMap) {
    const marks = [
      ['H', W.city.locations.safehouse],
      ['G', W.city.locations.garage],
      ['R', W.city.locations.raceStart],
      ['P', W.city.locations.precinct],
    ];
    ctx.font = 'bold 15px system-ui';
    for (const [ch, loc] of marks) {
      const [x, y] = toMap(loc.x, loc.z);
      ctx.fillStyle = '#111';
      ctx.beginPath();
      ctx.arc(x, y, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffd23f';
      ctx.fillText(ch, x, y + 5);
    }
    const job = W.missions.job();
    if (!job) return;
    const [x, y] = toMap(W.city.locations.pier.x, W.city.locations.pier.z);
    ctx.fillStyle = '#ff5a5a';
    ctx.beginPath();
    ctx.arc(x, y, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillText(String(W.missions.jobIndex + 1), x, y + 5);
  }

  function paintMarker(ctx, toMap, big) {
    if (!W.city.marker) return;
    const [x, y] = toMap(W.city.marker.position.x, W.city.marker.position.z);
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath();
    ctx.arc(x, y, big ? 8 : 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  function paintPolice(ctx, toMap, big) {
    ctx.fillStyle = '#4aa8ff';
    for (const u of W.police.units) {
      if (u.dead) continue;
      const [x, y] = toMap(u.x, u.z);
      ctx.beginPath();
      ctx.arc(x, y, big ? 4 : 3, 0, Math.PI * 2);
      ctx.fill();
    }
    if (!W.police.heli) return;
    const [x, y] = toMap(W.police.heli.x, W.police.heli.z);
    ctx.fillStyle = '#9fd8ff';
    ctx.beginPath();
    ctx.arc(x, y, big ? 6 : 4, 0, Math.PI * 2);
    ctx.fill();
  }

  function paintPlayerArrow(ctx, toMap) {
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
    ctx.moveTo(0, -8);
    ctx.lineTo(5, 6);
    ctx.lineTo(-5, 6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  H.drawMinimap = function () { drawMapCanvas(el('minimap'), false); };
  H.drawBigMap = function () { drawMapCanvas(el('bigmap'), true); };

  // ---- the 10 Hz HUD refresh, in sections ----
  function refreshMissionCard() {
    const job = W.missions.job();
    const stage = W.missions.stage();
    if (job && stage && W.missions.active) {
      setText('mission-job', 'JOB ' + (W.missions.jobIndex + 1) + '/8 \u2014 ' + job.name);
      setText('mission-name', job.name);
      setText('mission-objective', W.missions.objectiveLabel());
      setText('mission-stage', 'STAGE ' + (W.missions.stageIndex + 1) + '/' + job.stages.length + ' \u00b7 ' + stage.type.toUpperCase());
      const next = W.missions.nextJobName();
      setText('mission-next-text', next);
      show('mission-next', !!next);
      const timed = (stage.type === 'race' && W.missions.race) || stage.type === 'survive';
      if (timed) {
        const left = stage.type === 'race' ? W.missions.race.timeLeft : W.missions.surviveLeft;
        setText('mission-timer', fmtTime(left));
        show('mission-timer', true);
      } else {
        show('mission-timer', false);
      }
      setBar('mission-stage-fill', (W.missions.stageIndex / job.stages.length) * 100);
      return;
    }
    if (W.missions.completedJobs >= 8) {
      setText('mission-job', 'PALMERA BAY IS YOURS');
      setText('mission-objective', 'You run the bay now, Dante.');
      setText('mission-stage', 'BAY BOSS');
      return;
    }
    setText('mission-job', 'FREE ROAM');
    setText('mission-objective', 'Explore Palmera Bay. Find stashes, steal cars, dodge the law.');
    setText('mission-stage', 'NO ACTIVE JOB');
    show('mission-next', false);
    show('mission-timer', false);
  }

  function refreshDispatch() {
    const units = W.police.units.filter((u) => !u.dead).slice(0, 6);
    setText('dispatch-head', 'DISPATCH \u2014 ' + W.police.state.toUpperCase());
    const dl = el('dispatch-list');
    if (dl) {
      const rows = [];
      const pp = W.playerPos();
      for (const u of units) {
        const d = Math.round(Math.hypot(u.x - pp.x, u.z - pp.z));
        rows.push('<div class="dispatch-row"><span>' + (u.unitName || 'UNIT') + '</span><span>' + d + 'm</span><span>' + (u.unitRole || 'PURSUE') + '</span></div>');
      }
      dl.innerHTML = rows.join('');
    }
    const onFoot = W.police.footCops.filter((c) => !c.dead).length;
    setText('dispatch-foot', W.police.heli ? 'AIR-1 overhead' : onFoot + ' officers on foot');
    show('dispatch', W.police.wanted > 0);
  }

  function refreshTopRight(p) {
    setText('clock', clockString(W.clockMinutes));
    const st = RADIO[W.audio.station];
    const stationText = st.name + ' ' + st.freq;
    setText('radio-now', stationText);
    setText('radio-station', stationText);
    setText('radio-song', '\u266a ' + st.song);
    setText('cash', fmtCash(p.cash));
    const starsEl = el('stars');
    if (starsEl) {
      starsEl.textContent = '\u2605'.repeat(W.police.wanted) + '\u2606'.repeat(5 - W.police.wanted);
      starsEl.classList.toggle('hot', W.police.wanted > 0);
    }
    setText('wanted-state', W.police.wanted === 0 ? 'CLEAN' : 'WANTED \u2014 ' + W.police.state.toUpperCase());
    const rank = rankFor(p.respect);
    const nextRank = RANKS.find((r) => r.min > p.respect);
    const cap = nextRank ? nextRank.min : 2600;
    setText('rank-name', rank.name);
    setText('rank-badge', rank.name);
    setText('rank-line', rank.name + ' \u00b7 ' + Math.round(p.respect) + ' respect');
    setText('respect-text', Math.round(p.respect) + ' / ' + cap);
    setBar('respect-fill', (p.respect / cap) * 100);
    const rb = el('respect-bar');
    if (rb) rb.title = 'Respect ' + Math.round(p.respect);
  }

  function refreshLoadout(p) {
    const wEl = el('weapons');
    if (wEl) {
      const slots = [];
      for (const id of WEAPON_ORDER) {
        const w = p.weapons[id];
        if (!w.owned) continue;
        const wdef = WEAPONS[id];
        const mag = w.mag === Infinity ? '\u221e' : w.mag + '/' + (w.reserve === Infinity ? '\u221e' : w.reserve);
        const active = p.weaponId === id ? ' active' : '';
        slots.push('<div class="wslot' + active + '"><b>' + wdef.key + '</b> ' + wdef.name + ' <span>' + mag + '</span></div>');
      }
      wEl.innerHTML = slots.join('');
    }
    const cEl = el('crew');
    if (cEl) {
      const chips = [];
      for (const id of Object.keys(CREW_LABELS)) {
        const cd = Math.ceil(p.crewCd[id]);
        const cooling = cd > 0 ? ' cooling' : '';
        const suffix = cd > 0 ? ' \u00b7 ' + cd + 's' : '';
        chips.push('<div class="crew-chip' + cooling + '">' + CREW_LABELS[id] + suffix + '</div>');
      }
      cEl.innerHTML = chips.join('');
    }
  }

  function refreshVitals(p, playing) {
    const pp = W.playerPos();
    const d = W.city.districtAt(pp.x, pp.z);
    setText('district-name', d.name);
    setText('district-sub', d.sub + ' \u00b7 ' + d.blurb);
    setBar('health-fill', p.hp);
    setText('health-num', Math.round(p.hp));
    setBar('armour-fill', p.armour);
    setText('armour-num', Math.round(p.armour));
    // Vehicle card.
    const car = p.inCar;
    show('vehicle-card', !!car);
    if (car) {
      setText('vehicle-name', car.spec.name);
      setText('cond-num', Math.round(car.cond));
      setBar('cond-fill', car.cond);
      setText('speed-num', String(Math.round(Math.abs(car.speed) * 3.6)));
      setText('speed-unit', 'km/h');
    }
    // Crosshair: on foot with a firearm only.
    const cross = el('crosshair');
    if (cross) {
      const showCross = !car && p.weaponId !== 'fists' && playing;
      cross.classList.toggle('hidden', !showCross);
    }
  }

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
    refreshMissionCard();
    refreshDispatch();
    refreshTopRight(p);
    refreshLoadout(p);
    refreshVitals(p, playing);
    refreshTaxi();
    H.updatePrompt();
    if (playing) H.drawMinimap();
  };

  // Taxi meter: visible only while a fare is riding — quoted fare, the
  // destination district with the metres left, and the meter counting down.
  function refreshTaxi() {
    const meter = el('taxi-meter');
    if (!meter) return;
    const info = W.taxi ? W.taxi.hudInfo() : null;
    if (!info || info.phase !== 'riding') {
      meter.classList.add('hidden');
      return;
    }
    meter.classList.remove('hidden');
    setText('taxi-meter-fare', fmtCash(info.fare));
    setText('taxi-meter-dest', info.destName + ' \u00b7 ' + info.dist + 'm');
    setText('taxi-meter-time', fmtTime(info.timeLeft));
  }

  H.updatePrompt = function () {
    const p = W.player;
    const prompt = el('prompt');
    if (!prompt) return;
    if (W.state !== 'playing') {
      prompt.classList.add('hidden');
      return;
    }
    const pp = W.playerPos();
    const locs = W.city.locations;
    const near = (loc, r) => Math.hypot(pp.x - loc.x, pp.z - loc.z) < r;
    let text = '';
    if (!p.inCar) {
      const car = p.nearestCar(4);
      if (car) text = 'E STEAL ' + car.spec.name;
      else if (near(locs.garage, 16)) text = 'G IBARRA CUSTOMS \u2014 GARAGE & GUNS';
      else if (near(locs.raceStart, 14)) text = 'E STREET RACE \u2014 $500 ENTRY \u00b7 WIN $1,200';
      else if (near(locs.safehouse, 12)) text = 'SAFEHOUSE \u2014 PROGRESS SAVED';
      else if (W.hintDeliver) text = 'You need a car for this drop';
      else if (W.taxi && W.taxi.nearPassenger()) text = 'T PICK UP FARE \u2014 CAB WORK PAYS';
    } else if (near(locs.raceStart, 14)) {
      text = 'E STREET RACE \u2014 $500 ENTRY \u00b7 WIN $1,200';
    } else if (near(locs.garage, 16)) {
      text = 'G IBARRA CUSTOMS \u2014 GARAGE & GUNS';
    } else if (W.taxi && W.taxi.nearPassenger()) {
      text = 'T PICK UP FARE \u2014 CAB WORK PAYS';
    }
    if (text) {
      prompt.textContent = text;
      prompt.classList.remove('hidden');
    } else {
      prompt.classList.add('hidden');
    }
  };

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
    const completion = W.missions.completion();
    setText('stat-respect', String(Math.round(p.respect)));
    setText('stat-cash', fmtCash(p.cash));
    setText('stat-jobs', W.missions.completedJobs + '/8');
    setText('stat-complete', completion + '%');
    setBar('complete-fill', completion);
    const cb = el('complete-bar');
    if (cb) cb.title = 'Completion ' + completion + '%';
    const ms = el('map-stats');
    if (ms) {
      const rows = [
        ['Cars stolen', p.stats.carsStolen],
        ['Stars lost', p.stats.starsLost],
        ['Knockouts', p.stats.knockouts],
        ['Race wins', p.stats.raceWins],
        ['Taxi fares', p.stats.faresCompleted || 0],
        ['Taxi earned', fmtCash(p.stats.faresEarned || 0)],
        ['Driven', p.stats.drivenKm.toFixed(1) + ' km'],
        ['Shots fired', p.stats.shotsFired],
      ];
      ms.innerHTML = rows.map(([label, value]) => '<div>' + label + ' <b>' + value + '</b></div>').join('');
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

  function shopButton(item, onBuy) {
    const b = document.createElement('button');
    b.className = 'shop-item';
    b.innerHTML = '<b>' + item.name + '</b> <span>' + fmtCash(item.price) + '</span><i>' + item.desc + '</i>';
    b.addEventListener('click', (ev) => {
      ev.stopPropagation();
      onBuy(item);
      H.renderShop();
    });
    return b;
  }

  function drawShopCar(car) {
    const cv = el('shop-car-canvas');
    if (!cv) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.fillStyle = '#1d212b';
    ctx.fillRect(0, 0, cv.width, cv.height);
    const hex = '#' + car.color.toString(16).padStart(6, '0');
    const cx = cv.width / 2;
    const cy = cv.height / 2;
    ctx.fillStyle = hex;
    ctx.fillRect(cx - 90, cy - 34, 180, 68);
    ctx.fillStyle = '#141a24';
    ctx.fillRect(cx - 45, cy - 26, 90, 52);
    ctx.fillStyle = '#111';
    for (const [wx, wy] of [[-55, -36], [55, -36], [-55, 36], [55, 36]]) {
      ctx.beginPath();
      ctx.arc(cx + wx, cy + wy, 16, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 15px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText(car.spec.name, cx, cy + 62);
  }

  function renderShopCar(car) {
    const mods = (car.tuned ? ' \u00b7 TUNED' : '') + (car.plated ? ' \u00b7 PLATED' : '') + (car.nitro ? ' \u00b7 NITRO' : '');
    setText('shop-car-name', car.spec.name + mods);
    setText('shop-cond-num', String(Math.round(car.cond)));
    setBar('shop-cond-fill', car.cond);
    setText('mod-tune', car.tuned ? 'TUNE: YES' : 'TUNE: NO');
    setText('mod-plating', car.plated ? 'PLATING: YES' : 'PLATING: NO');
    setText('mod-nitro', car.nitro ? 'NITRO: YES' : 'NITRO: NO');
    drawShopCar(car);
  }

  function renderShopLists() {
    const list = el('shop-list');
    if (list) {
      list.innerHTML = '';
      for (const item of SHOP_UPGRADES) {
        list.appendChild(shopButton(item, (it) => W.buyUpgrade(it.id)));
      }
    }
    const list2 = el('shop-list2');
    if (!list2) return;
    list2.innerHTML = '';
    for (const item of [...SHOP_GEAR, ...SHOP_SHOWROOM]) {
      const isShowroom = SHOP_SHOWROOM.some((s) => s.id === item.id);
      list2.appendChild(shopButton(item, (it) => {
        if (isShowroom) W.buyShowroomCar(it.id);
        else W.buyGear(it.id);
      }));
    }
  }

  H.renderShop = function () {
    const car = W.player.inCar || W.lastCar;
    setText('shop-cash-num', fmtCash(W.player.cash));
    if (car) renderShopCar(car);
    renderShopLists();
    setText('shop-desc', 'Ibarra Customs \u2014 repairs, tunes, plating, nitro, guns and the showroom. Cash: ' + fmtCash(W.player.cash));
  };

  // ---- title screen ----
  H.refreshTitle = function () {
    const save = W.save.read();
    show('btn-continue', !!save);
    if (!save) {
      setText('title-save-note', 'No save yet \u2014 start a new story.');
      return;
    }
    const when = save.savedAt
      ? new Date(save.savedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
      : '';
    const suffix = when ? ' \u00b7 ' + when : '';
    setText('continue-label', 'JOB ' + (save.jobIndex + 1) + '/8 \u00b7 ' + fmtCash(save.cash) + suffix);
    setText('title-save-note', 'Save found \u2014 continue your story.');
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
      if (!n) return;
      n.addEventListener('click', (ev) => {
        ev.stopPropagation();
        W.audio.ensure();
        fn();
      });
    };
    on('btn-new', () => W.startNewGame());
    on('btn-continue', () => W.continueGame());
    on('btn-how', () => show('howto', true));
    on('btn-how-close', () => show('howto', false));
    on('btn-resume', () => W.setPaused(false));
    on('btn-save', () => {
      W.save.write();
      W.notify('Game saved');
    });
    on('btn-quit', () => W.quitToTitle());
    on('btn-shop-close', () => W.closeShop());
    on('btn-job-next', () => H.hideJobDone());
    on('btn-respawn', () => W.respawn());
    const dlg = el('dialogue');
    if (dlg) dlg.addEventListener('click', (ev) => {
      ev.stopPropagation();
      H.hideDialog();
    });
  };

  return H;
}
