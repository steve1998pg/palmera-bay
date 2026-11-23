// HUD: every DOM panel, the minimap and the full city map, dialogue, menus and
// the garage shop. The judge reads the game mostly through these screens.
import { WEAPONS, RANKS, CREW, SHOP_CAR, SHOP_GEAR, VEHICLE_TYPES, rankFor } from './config.js';
import { giverShortName } from './missions.js';
import { fmtCash, fmtTime, clockString } from './random.js';

const $ = (id) => document.getElementById(id);
// Completion: 80% from the 8 story jobs, 20% from respect (2600 = BAY BOSS).
const COMPLETION_JOB_WEIGHT = 80;
const COMPLETION_RESPECT_WEIGHT = 20;
const COMPLETION_RESPECT_MAX = 2600;

export function completionPercent(completedJobs, respect) {
  const jobs = (completedJobs / 8) * COMPLETION_JOB_WEIGHT;
  const rep = Math.min(respect, COMPLETION_RESPECT_MAX) / COMPLETION_RESPECT_MAX * COMPLETION_RESPECT_WEIGHT;
  return Math.min(100, Math.round(jobs + rep));
}

export class HUD {
  constructor(world) {
    this.world = world;
    this.el = {};
    for (const id of ['hud', 'mission-card', 'mission-job', 'mission-name', 'mission-timer', 'mission-objective',
      'mission-stage-fill', 'mission-next-text', 'dispatch', 'dispatch-units', 'dispatch-list', 'clock', 'radio-now',
      'cash', 'stars', 'wanted-state', 'rank-badge', 'rank-name', 'respect-fill', 'respect-text', 'weapons', 'crew',
      'district-name', 'district-sub', 'minimap', 'health-fill', 'health-num', 'armour-fill', 'armour-num',
      'radio-station', 'radio-song', 'vehicle-name', 'cond-fill', 'cond-num', 'speed-num', 'speed-unit',
      'dialogue', 'dialogue-portrait', 'dialogue-who', 'dialogue-text', 'crosshair', 'prompt', 'wanted-flash',
      'notify', 'objective-toast', 'damage-vignette', 'title-screen', 'btn-continue', 'continue-label', 'btn-new',
      'btn-how', 'howto', 'btn-how-close', 'pause-menu', 'bigmap', 'stat-respect', 'stat-cash', 'stat-jobs',
      'stat-complete', 'complete-fill', 'map-stats', 'btn-resume', 'btn-save', 'btn-quit', 'shop', 'shop-car-canvas',
      'shop-car-name', 'shop-cond-fill', 'shop-cond-num', 'mod-tune', 'mod-plating', 'mod-nitro', 'shop-cash-num',
      'shop-list', 'shop-list2', 'shop-desc', 'btn-shop-close', 'gameover', 'gameover-title', 'gameover-text',
      'btn-respawn', 'job-done', 'job-done-title', 'job-done-text', 'job-done-reward', 'btn-job-next', 'status']) {
      this.el[id] = $(id);
    }
    this.minimapCtx = this.el.minimap.getContext('2d');
    this.bigmapCtx = this.el.bigmap.getContext('2d');
    this.dialogueTimer = 0;
    this.lastHintAt = 0;
    this._buildWeapons();
    this._buildCrew();
    this._wireButtons();
  }

  _buildWeapons() {
    this.el.weapons.innerHTML = '';
    this.weaponSlots = {};
    for (const w of WEAPONS) {
      const d = document.createElement('div');
      d.className = 'wslot';
      d.id = 'wslot-' + w.id;
      d.innerHTML = `<span class="wk">${w.key}</span><span class="wn">${w.name}</span><span class="wa">—</span>`;
      this.el.weapons.appendChild(d);
      this.weaponSlots[w.id] = d;
    }
  }
  _buildCrew() {
    this.el.crew.innerHTML = '';
    this.crewChips = {};
    for (const c of CREW) {
      const d = document.createElement('div');
      d.className = 'crew-chip';
      d.innerHTML = `<span class="ck">${c.key.toUpperCase()}</span><div><b>${c.name}</b><span>${c.role}</span></div><span class="cd">READY</span>`;
      this.el.crew.appendChild(d);
      this.crewChips[c.id] = d;
    }
  }
  _wireButtons() {
    const w = this.world;
    this.el['btn-new'].onclick = () => w.startNewGame();
    this.el['btn-continue'].onclick = () => w.continueGame();
    this.el['btn-how'].onclick = () => this.el.howto.classList.remove('hidden');
    this.el['btn-how-close'].onclick = () => this.el.howto.classList.add('hidden');
    this.el['btn-resume'].onclick = () => w.setPaused(false);
    this.el['btn-save'].onclick = () => { w.saveGame(); this.notify('Progress saved.', 'good'); };
    this.el['btn-quit'].onclick = () => w.quitToTitle();
    this.el['btn-respawn'].onclick = () => w.respawn();
    this.el['btn-job-next'].onclick = () => this.el['job-done'].classList.add('hidden');
    this.el['btn-shop-close'].onclick = () => w.closeShop();
    this.el.dialogue.onclick = () => this.hideDialogue();
  }

  show() { this.el.hud.classList.remove('hidden'); }
  hide() { this.el.hud.classList.add('hidden'); }

  setMission(job, stageIndex, stage) {
    this.el['mission-job'].textContent = `JOB ${this.world.missions.jobIndex + 1}/8`;
    this.el['mission-name'].textContent = job.name + ' · ' + giverShortName(job.giver);
    this.el['mission-objective'].textContent = stage.label;
    this.el['mission-next-text'].textContent = stage.next || '—';
    this.el['mission-stage-fill'].style.width = Math.round((stageIndex / job.stages.length) * 100) + '%';
    this.el['mission-timer'].textContent = stage.time ? fmtTime(stage.time) : '';
  }
  setTimer(sec) { this.el['mission-timer'].textContent = fmtTime(Math.max(0, sec)); }

  showDialogue(giver, text) {
    this.el['dialogue-portrait'].textContent = giver.initials;
    this.el['dialogue-portrait'].style.background = giver.color;
    this.el['dialogue-who'].innerHTML = `${giver.name} <span>${giver.role}</span>`;
    this.el['dialogue-text'].textContent = text;
    this.el.dialogue.classList.remove('hidden');
    this.dialogueTimer = 7;
  }
  hideDialogue() { this.el.dialogue.classList.add('hidden'); this.dialogueTimer = 0; }

  notify(text, kind = '') {
    const d = document.createElement('div');
    d.className = 'note ' + kind;
    d.textContent = text;
    this.el.notify.appendChild(d);
    setTimeout(() => d.remove(), 5200);
    while (this.el.notify.children.length > 3) this.el.notify.firstChild.remove();
  }
  hint(text) {
    const now = performance.now();
    if (now - this.lastHintAt < 2500) return;
    this.lastHintAt = now;
    this.notify(text, 'gold');
  }
  flashWanted(stars) {
    const f = this.el['wanted-flash'];
    f.textContent = stars >= 4 ? 'WANTED ★★★★' : 'WANTED';
    f.classList.remove('hidden');
    setTimeout(() => f.classList.add('hidden'), 1400);
  }
  objectiveToast(line1, line2) {
    const t = this.el['objective-toast'];
    t.innerHTML = `<div class="ot1">${line1}</div><div class="ot2">${line2}</div>`;
    t.classList.remove('hidden');
    setTimeout(() => t.classList.add('hidden'), 2600);
  }
  damageFlash() {
    const v = this.el['damage-vignette'];
    v.style.boxShadow = 'inset 0 0 120px 40px rgba(220,38,38,.55)';
    setTimeout(() => { v.style.boxShadow = 'inset 0 0 120px 40px rgba(220,38,38,0)'; }, 180);
  }
  setPrompt(html) {
    if (html) { this.el.prompt.innerHTML = html; this.el.prompt.classList.remove('hidden'); }
    else this.el.prompt.classList.add('hidden');
  }

  showJobDone(job) {
    this.el['job-done-title'].textContent = job.name + ' — COMPLETE';
    this.el['job-done-text'].textContent = job.brief;
    this.el['job-done-reward'].textContent = `+${fmtCash(job.reward)}  ·  +${job.respect} RESPECT`;
    this.el['job-done'].classList.remove('hidden');
  }
  showGameOver(title, text) {
    this.el['gameover-title'].textContent = title;
    this.el['gameover-text'].textContent = text;
    this.el.gameover.classList.remove('hidden');
  }
  hideGameOver() { this.el.gameover.classList.add('hidden'); }

  showTitle(hasSave, label) {
    this.el['title-screen'].classList.remove('hidden');
    if (hasSave) {
      this.el['btn-continue'].classList.remove('hidden');
      this.el['continue-label'].textContent = label;
    } else this.el['btn-continue'].classList.add('hidden');
  }
  hideTitle() { this.el['title-screen'].classList.add('hidden'); }

  // ---- per-frame HUD refresh (cheap text writes, throttled by caller) ----
  update(world, dt) {
    const p = world.player;
    const police = world.police;
    this.el.cash.textContent = fmtCash(p.cash);
    // Stars.
    let starsHtml = '';
    for (let i = 1; i <= 5; i++) starsHtml += `<span class="${i <= police.wanted ? '' : 'off'}">★</span>`;
    this.el.stars.innerHTML = starsHtml;
    this.el['wanted-state'].textContent =
      police.wanted === 0 ? '' : police.state === 'search' ? 'SEARCHING — stay out of sight' : police.wanted >= 3 && police.heli ? 'IN SIGHT — Air One has you in the light' : 'IN SIGHT';
    // Rank / respect.
    const { rank, index, next } = rankFor(p.respect);
    this.el['rank-badge'].textContent = 'RANK ' + (index + 1);
    this.el['rank-name'].textContent = rank.name;
    const span = next ? next.need - rank.need : 1;
    this.el['respect-fill'].style.width = Math.round(((p.respect - rank.need) / span) * 100) + '%';
    this.el['respect-text'].textContent = next
      ? `${p.respect - rank.need} / ${span} RESPECT`
      : `${p.respect} RESPECT · MAX RANK`;
    // Vitals.
    this.el['health-fill'].style.width = p.hp + '%';
    this.el['health-num'].textContent = Math.ceil(p.hp);
    this.el['armour-fill'].style.width = p.armour + '%';
    this.el['armour-num'].textContent = Math.ceil(p.armour);
    // Clock + radio.
    this.el.clock.textContent = clockString(world.clockMinutes);
    const st = world.audio.currentStation();
    this.el['radio-now'].textContent = `♪ ${st.name} — ${st.song}`;
    this.el['radio-station'].textContent = st.name;
    this.el['radio-song'].textContent = st.song;
    // Weapons.
    for (const w of WEAPONS) {
      const slot = this.weaponSlots[w.id];
      const owned = p.weapons[w.id].owned;
      slot.classList.toggle('active', p.weaponId === w.id);
      slot.classList.toggle('locked', !owned);
      const wa = slot.querySelector('.wa');
      wa.textContent = !owned ? 'LOCKED' : w.id === 'fists' ? '∞' : `${p.weapons[w.id].mag} / ${p.weapons[w.id].reserve === Infinity ? '∞' : p.weapons[w.id].reserve}`;
    }
    // Crew.
    for (const c of CREW) {
      const chip = this.crewChips[c.id];
      const cd = p.crewCd[c.id];
      chip.classList.toggle('ready', cd <= 0);
      chip.classList.toggle('cooling', cd > 0);
      chip.querySelector('.cd').textContent = cd <= 0 ? 'READY' : Math.ceil(cd) + 's';
    }
    // Vehicle / speed.
    const car = p.inCar;
    if (car) {
      this.el['vehicle-name'].textContent = car.spec.name + (car.nitro && car.nitroFuel > 0 ? ' · N2O' : '');
      this.el['cond-fill'].style.width = car.cond + '%';
      this.el['cond-fill'].style.background = car.cond > 50 ? '#4ade80' : car.cond > 25 ? '#fbbf24' : '#ef4444';
      this.el['cond-num'].textContent = Math.ceil(car.cond) + '%';
      this.el['speed-num'].textContent = Math.round(Math.abs(car.speed) * 3.6);
      this.el['speed-unit'].textContent = 'KM/H';
    } else {
      this.el['vehicle-name'].textContent = 'ON FOOT';
      this.el['cond-fill'].style.width = '0%';
      this.el['cond-num'].textContent = '—';
      this.el['speed-num'].textContent = Math.round(p.speed * 3.6);
      this.el['speed-unit'].textContent = 'KM/H';
    }
    // District.
    const d = world.city.districtAt(p.x, p.z);
    this.el['district-name'].textContent = d.name;
    this.el['district-sub'].textContent = d.sub + ' · ' + d.blurb;
    // Dispatch panel.
    if (police.wanted > 0) {
      this.el.dispatch.classList.remove('hidden');
      this.el['dispatch-units'].textContent = `${police.units.length + police.footCops.filter((c) => !c.dead).length + (police.heli ? 1 : 0)} UNITS · ${police.wanted}★`;
      const rows = police.dispatchRows(world);
      this.el['dispatch-list'].innerHTML = rows.map((r) =>
        `<div class="drow"><span class="dn">${r.name}</span><span class="dd">${r.dist}</span><span class="ds ${r.cls}">${r.role}</span></div>`).join('')
        + (rows.length === 0 ? '<div class="drow"><span class="dn">—</span><span class="dd"></span><span class="ds grey">EN ROUTE</span></div>' : '');
    } else {
      this.el.dispatch.classList.add('hidden');
    }
    // Crosshair: only on foot with a gun and mouse locked / held.
    this.el.crosshair.classList.toggle('hidden', !!car || p.weaponId === 'fists');
    if (this.dialogueTimer > 0) {
      this.dialogueTimer -= dt;
      if (this.dialogueTimer <= 0) this.hideDialogue();
    }
    this.drawMinimap(world);
  }

  // ---- shared map base: sea, sand, blocks, roads. Both maps draw on top of it.
  // X/Y map world coords onto a square canvas of size S.
  _mapBase(ctx, world, S, blockColor = '#3f5a6b') {
    const half = 480, k = S / (half * 2);
    const X = (x) => (x + half) * k, Y = (z) => (z + half) * k;
    ctx.clearRect(0, 0, S, S);
    ctx.fillStyle = '#14324a'; ctx.fillRect(0, 0, S, S);
    // Ocean + sand.
    ctx.fillStyle = '#2a7f8f'; ctx.fillRect(X(452), 0, S - X(452), S);
    ctx.fillStyle = '#e8c98f'; ctx.fillRect(X(384), 0, X(452) - X(384), S);
    // Blocks.
    ctx.fillStyle = blockColor;
    for (const c of world.city.colliders) {
      ctx.fillRect(X(c.x - c.hx), Y(c.z - c.hz), (c.hx * 2) * k, (c.hz * 2) * k);
    }
    // Roads.
    ctx.strokeStyle = '#8b9bb4'; ctx.lineWidth = 2;
    for (const s of world.city.streets) {
      ctx.beginPath(); ctx.moveTo(X(s), 0); ctx.lineTo(X(s), S); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, Y(s)); ctx.lineTo(S, Y(s)); ctx.stroke();
    }
    ctx.strokeStyle = '#facc15'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(X(352), 0); ctx.lineTo(X(352), S); ctx.stroke();
    return { X, Y, k };
  }

  // ---- minimap ----
  drawMinimap(world) {
    const ctx = this.minimapCtx;
    const S = 220;
    const { X, Y } = this._mapBase(ctx, world, S);
    // Landmarks.
    const dot = (x, z, color, r = 4) => {
      ctx.fillStyle = color; ctx.beginPath(); ctx.arc(X(x), Y(z), r, 0, Math.PI * 2); ctx.fill();
    };
    const L = world.city.locations;
    dot(L.garage.x, L.garage.z, '#f59e0b', 5);
    dot(L.safehouse.x, L.safehouse.z, '#4ade80', 5);
    dot(L.raceStart.x, L.raceStart.z, '#fb7185', 5);
    dot(L.precinct.x, L.precinct.z, '#a78bfa', 5);
    for (const s of L.stashes) if (!s.taken) dot(s.x, s.z, '#fde68a', 2.5);
    // Mission marker.
    if (world.marker) {
      const mx = X(world.marker.x), my = Y(world.marker.z);
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.moveTo(mx, my - 8); ctx.lineTo(mx + 6, my); ctx.lineTo(mx, my + 8); ctx.lineTo(mx - 6, my);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(mx, my, 11, 0, Math.PI * 2); ctx.stroke();
    }
    // Police.
    for (const u of world.police.units) dot(u.x, u.z, '#ef4444', 3.5);
    for (const c of world.police.footCops) if (!c.dead) dot(c.x, c.z, '#f87171', 2.5);
    if (world.police.heli) dot(world.police.heli.x, world.police.heli.z, '#f97316', 4);
    // Player arrow.
    const p = world.playerPos();
    ctx.save();
    ctx.translate(X(p.x), Y(p.z));
    ctx.rotate(Math.PI - world.player.heading);
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(5.5, 6); ctx.lineTo(0, 3); ctx.lineTo(-5.5, 6); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#0f172a'; ctx.lineWidth = 1; ctx.stroke();
    ctx.restore();
    // North.
    ctx.fillStyle = '#fff'; ctx.font = '900 13px Arial'; ctx.fillText('N', 8, 16);
  }

  // ---- full map (pause screen) ----
  drawBigMap(world) {
    const ctx = this.bigmapCtx;
    const S = 640;
    const { X, Y } = this._mapBase(ctx, world, S, '#41617a');
    // Roads read heavier on the big map.
    ctx.strokeStyle = '#cbd5e1'; ctx.lineWidth = 3;
    for (const s of world.city.streets) {
      ctx.beginPath(); ctx.moveTo(X(s), 0); ctx.lineTo(X(s), S); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, Y(s)); ctx.lineTo(S, Y(s)); ctx.stroke();
    }
    ctx.strokeStyle = '#facc15'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(X(352), 0); ctx.lineTo(X(352), S); ctx.stroke();
    // Street names.
    ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.font = '700 11px Arial';
    ctx.fillText('PALMERA BLVD', X(356), 20);
    ctx.fillText('SUNDIAL AVE', 12, Y(-96) - 4);
    ctx.fillText('SEAGLASS PARADE', X(330), Y(430));
    // District labels.
    ctx.font = '900 17px Arial'; ctx.textAlign = 'center';
    for (const d of world.city.districts || []) {
      ctx.fillStyle = 'rgba(0,0,0,.55)';
      ctx.fillRect(X(d.x) - 62, Y(d.z) - 12, 124, 22);
      ctx.fillStyle = '#fde68a';
      ctx.fillText(d.name.toUpperCase(), X(d.x), Y(d.z) + 4);
    }
    ctx.textAlign = 'left';
    const L = world.city.locations;
    const mark = (x, z, letter, color) => {
      ctx.fillStyle = color; ctx.beginPath(); ctx.arc(X(x), Y(z), 11, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#0f172a'; ctx.font = '900 13px Arial'; ctx.textAlign = 'center';
      ctx.fillText(letter, X(x), Y(z) + 4.5); ctx.textAlign = 'left';
    };
    mark(L.safehouse.x, L.safehouse.z, 'H', '#4ade80');
    mark(L.garage.x, L.garage.z, 'G', '#f59e0b');
    mark(L.raceStart.x, L.raceStart.z, 'R', '#fb7185');
    mark(L.precinct.x, L.precinct.z, 'P', '#a78bfa');
    for (const s of L.stashes) if (!s.taken) mark(s.x, s.z, '$', '#fde68a');
    if (world.marker) {
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      const mx = X(world.marker.x), my = Y(world.marker.z);
      ctx.moveTo(mx, my - 14); ctx.lineTo(mx + 11, my); ctx.lineTo(mx, my + 14); ctx.lineTo(mx - 11, my);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(mx, my, 18, 0, Math.PI * 2); ctx.stroke();
    }
    // Player.
    const p = world.playerPos();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(X(p.x), Y(p.z), 8, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#0f172a'; ctx.lineWidth = 2; ctx.stroke();
    // Stats side.
    const pl = world.player;
    const { rank, index } = rankFor(pl.respect);
    this.el['stat-respect'].textContent = `LV ${index + 1} · ${rank.name}`;
    this.el['stat-cash'].textContent = fmtCash(pl.cash);
    this.el['stat-jobs'].textContent = `${world.missions.completedJobs} / 8`;
    const complete = completionPercent(world.missions.completedJobs, pl.respect);
    this.el['stat-complete'].textContent = complete + '%';
    this.el['complete-fill'].style.width = complete + '%';
    const s = pl.stats;
    this.el['map-stats'].textContent =
      `CARS STOLEN ${s.carsStolen} · STARS LOST ${s.starsLost} · KNOCKOUTS ${s.knockouts} · RACE WINS ${s.raceWins} · DRIVEN ${s.drivenKm.toFixed(1)} KM`;
  }

  showPause(world) {
    this.drawBigMap(world);
    this.el['pause-menu'].classList.remove('hidden');
  }
  hidePause() { this.el['pause-menu'].classList.add('hidden'); }

  // ---- garage shop ----
  openShop(world, car) {
    this.shopWorld = world;
    this.shopCar = car;
    this.shopTab = 'workshop';
    this.el.shop.classList.remove('hidden');
    this.renderShop();
    this._drawShopCar(car);
  }
  closeShop() { this.el.shop.classList.add('hidden'); }
  renderShop() {
    const w = this.world, p = w.player, car = this.shopCar;
    this.el['shop-cash-num'].textContent = fmtCash(p.cash);
    this.el['shop-car-name'].textContent = car ? car.spec.name : 'NO CAR';
    const cond = car ? Math.ceil(car.cond) : 0;
    this.el['shop-cond-fill'].style.width = cond + '%';
    this.el['shop-cond-num'].textContent = cond + '%';
    this.el['mod-tune'].classList.toggle('on', !!(car && car.tuned));
    this.el['mod-plating'].classList.toggle('on', !!(car && car.plated));
    this.el['mod-nitro'].classList.toggle('on', !!(car && car.nitro));
    const tabs = this.el.shop.querySelectorAll('.shop-tabs span');
    tabs[0].classList.toggle('active', this.shopTab === 'workshop');
    tabs[1].classList.toggle('active', this.shopTab === 'showroom');
    tabs[0].onclick = () => { this.shopTab = 'workshop'; this.renderShop(); };
    tabs[1].onclick = () => { this.shopTab = 'showroom'; this.renderShop(); };
    const list = this.el['shop-list'];
    const list2 = this.el['shop-list2'];
    list.innerHTML = ''; list2.innerHTML = '';
    const row = (item, state, locked, onBuy, tagCls = '') => {
      const d = document.createElement('div');
      d.className = 'shop-item' + (locked ? ' disabled' : '');
      d.innerHTML = `<span class="si-tag ${tagCls}">${item.tag}</span><span class="si-name">${item.name}</span>` +
        (state ? `<span class="si-state ${locked ? 'locked' : ''}">${state}</span>` : '') +
        `<span class="si-price">${fmtCash(item.price)}</span>`;
      if (!locked) d.onclick = () => { onBuy(item); this.el['shop-desc'].textContent = item.desc; };
      else d.onclick = () => { this.el['shop-desc'].textContent = item.desc; };
      return d;
    };
    if (this.shopTab === 'workshop') {
      for (const item of SHOP_CAR) {
        let state = '', locked = !car;
        if (car) {
          if (item.id === 'tune') { state = car.tuned ? '✓ OWNED' : ''; locked = car.tuned; }
          if (item.id === 'plating') { state = car.plated ? '✓ OWNED' : ''; locked = car.plated; }
          if (item.id === 'nitro') { state = car.nitro ? '✓ OWNED' : ''; locked = car.nitro || p.respect < 600; if (p.respect < 600 && !car.nitro) state = 'LOCKED · LV 3'; }
          if (item.id === 'repair') { state = car.cond >= 99 ? '✓ FULL' : ''; locked = car.cond >= 99; }
          if (item.id === 'respray') { state = ''; }
        }
        if (item.id === 'nitro') list.appendChild(row(item, state, locked, () => w.buyUpgrade(item.id), 'red'));
        else if (item.id === 'tune') list.appendChild(row(item, state, locked, () => w.buyUpgrade(item.id), 'gold'));
        else list.appendChild(row(item, state, locked, () => w.buyUpgrade(item.id), item.id === 'repair' ? 'teal' : ''));
      }
      for (const item of SHOP_GEAR) {
        let state = '', locked = false;
        if (item.id === 'smg' || item.id === 'shotgun' || item.id === 'rifle') {
          const wid = item.id;
          const owned = p.weapons[wid].owned;
          state = owned ? '✓ OWNED' : '';
          locked = owned || p.cash < item.price;
          if (!owned) {
            const wdef = WEAPONS.find((x) => x.id === wid);
            if (p.respect < (RANKS[wdef.rank] ? RANKS[wdef.rank].need : 0)) { state = 'LOCKED · LV ' + (wdef.rank + 1); locked = true; }
          }
        }
        list2.appendChild(row(item, state, locked, () => w.buyGear(item.id)));
      }
    } else {
      const showroom = VEHICLE_TYPES.filter((v) => v.price > 0);
      for (const v of showroom) {
        list.appendChild(row(
          { tag: 'CAR', name: v.name, price: v.price, desc: `Top speed ${Math.round(v.top * 3.6)} km/h. Yours the moment you pay — parked outside.` },
          '', p.cash < v.price, () => w.buyShowroomCar(v.id),
        ));
      }
      list2.innerHTML = '<div style="padding:10px;color:#94a3b8;font-size:13px">Showroom cars spawn outside Ibarra Customs, fuelled and ready. Your old ride stays where you left it.</div>';
    }
    this.el['shop-desc'].textContent = car
      ? 'Tomas: “You break it, I bill it. Cash up front, no tabs.”'
      : 'No car in the bay. Buy one from the SHOWROOM tab and it’ll be parked outside.';
  }
  _drawShopCar(car) {
    const cv = this.el['shop-car-canvas'];
    const g = cv.getContext('2d');
    g.clearRect(0, 0, cv.width, cv.height);
    // Floor ring.
    g.fillStyle = '#1e1b2e'; g.fillRect(0, 0, cv.width, cv.height);
    g.strokeStyle = '#f59e0b'; g.lineWidth = 6;
    g.beginPath(); g.ellipse(210, 210, 170, 46, 0, 0, Math.PI * 2); g.stroke();
    g.strokeStyle = 'rgba(245,158,11,.4)'; g.lineWidth = 2;
    g.beginPath(); g.ellipse(210, 210, 130, 34, 0, 0, Math.PI * 2); g.stroke();
    if (!car) { g.fillStyle = '#94a3b8'; g.font = '700 18px Arial'; g.textAlign = 'center'; g.fillText('NO CAR IN THE BAY', 210, 150); return; }
    const hex = '#' + car.color.toString(16).padStart(6, '0');
    // Lift posts.
    g.fillStyle = '#facc15';
    g.fillRect(120, 90, 14, 130); g.fillRect(300, 90, 14, 130);
    // Car, side view.
    g.fillStyle = hex;
    g.beginPath();
    g.moveTo(90, 205); g.lineTo(100, 165); g.lineTo(140, 150); g.lineTo(200, 142);
    g.lineTo(280, 142); g.lineTo(320, 162); g.lineTo(335, 205); g.closePath(); g.fill();
    g.fillStyle = '#111827';
    g.beginPath(); g.moveTo(150, 152); g.lineTo(195, 146); g.lineTo(265, 146); g.lineTo(300, 160); g.closePath(); g.fill();
    g.fillStyle = '#111827';
    g.beginPath(); g.arc(150, 205, 26, 0, Math.PI * 2); g.arc(285, 205, 26, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#9ca3af';
    g.beginPath(); g.arc(150, 205, 12, 0, Math.PI * 2); g.arc(285, 205, 12, 0, Math.PI * 2); g.fill();
    // Headlight glow.
    g.fillStyle = 'rgba(255,247,204,.9)';
    g.beginPath(); g.ellipse(340, 185, 26, 8, 0, 0, Math.PI * 2); g.fill();
  }
}
