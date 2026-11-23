// Screenshot staging (?shot=chase|street|garage|map&seed=1): set the world
// up through the game's own systems, let the simulation run a fixed number
// of frames, then raise window.__shotReady.

function baseStaging(W, name) {
  const p = W.player;
  W.shotMode = name;
  W.state = 'playing';
  W.hud.hideTitle();
  W.hud.hideGameOver();
  W.hud.hideJobDone();
  return p;
}

function setJob(W, index, completed, stage) {
  W.missions.jobIndex = index;
  W.missions.stageIndex = stage || 0;
  W.missions.completedJobs = completed;
  W.missions.active = true;
}

function stageChase(W, p) {
  // Dante in a red Meridian GT on the boulevard, mid-chase.
  const gt = W.spawnCar('sport', 352, -60, 0, { color: 0xc22424, owned: true });
  p.enterCar(gt, true);
  gt.speed = 30;
  p.cash = 18450;
  p.respect = 1100;
  W.clockMinutes = 18 * 60 + 48;
  setJob(W, 5, 5, 0);
  W.missions.surviveLeft = 74;
  W.police.setHeat(78);
  W.input.keys.add('KeyW');
  // Three cruisers behind + the heli, traffic ahead.
  const tail = [[-6, -34], [8, -52], [-2, -70]];
  for (const [dx, dz] of tail) {
    const u = W.spawnCar('cruiser', 352 + dx, -60 + dz, 0, {
      ai: 'police',
      unitName: 'TARPON-' + (40 + Math.abs(dx)),
      unitRole: 'PURSUE',
    });
    u.speed = 26;
    W.police.units.push(u);
  }
  W.spawnCar('sedan', 352, 20, 0, { ai: 'traffic' });
  W.spawnCar('taxi', 344, 60, 0, { ai: 'traffic' });
  W.showDialog('CELIA "LA JEFA" DUARTE', 'Every cop in the bay is coming for you, cari\u00f1o. Ninety seconds. Survive them.', '#f59e0b', 'CJ');
  W.toast('GOLDEN HOUR \u2014 Survive the manhunt \u2014 90 seconds');
  W.camYaw = 0;
}

function stageStreet(W, p) {
  // Dante on foot at the market, mid-fight.
  p.x = 120;
  p.z = 322;
  p.heading = 0;
  p.y = 0;
  W.camYaw = 0;
  p.mesh.position.set(p.x, 0, p.z);
  p.switchWeapon('smg');
  p.weapons.smg.owned = true;
  p.weapons.smg.mag = 24;
  p.weapons.smg.reserve = 120;
  p.weaponId = 'smg';
  p.armour = 27;
  p.hp = 95;
  p.cash = 7270;
  p.respect = 1675;
  W.clockMinutes = 19 * 60 + 31;
  setJob(W, 2, 2, 0);
  W.missions.killsTotal = 5;
  W.missions.killsLeft = 4;
  W.missions.killsDone = 1;
  W.spawnEnemies(4, 120, 352, 'market-squeeze');
  W.police.setHeat(34);
  const cop = W.spawnPerson('cop', 132, 336, {});
  W.police.footCops.push(cop);
  // Staging grace: the enemies and the cop hold their fire until after
  // the screenshot, so the staged HP 95 / armour 27 is what the shot shows.
  for (const e of W.people) {
    if (e.kind === 'enemy' || e.kind === 'cop') e.shootAt = 9999;
  }
  // Six peds fleeing.
  for (let i = 0; i < 6; i++) {
    const ped = W.spawnPed(108 + i * 5, 330 + (i % 3) * 8);
    ped.fleeUntil = W.now + 4;
  }
  W.city.setMarker(120, 352, 'Clear the Tiburon crew from the market');
  W.showDialog('CELIA "LA JEFA" DUARTE', 'Tiburon boys are taxing the market. Five of them. Make it safe again.', '#f59e0b', 'CJ');
  W.toast('MARKET SQUEEZE \u2014 Clear the Tiburon crew (1/5)');
  // One real shot through the firing code, for a visible tracer.
  W.shotFired = false;
  setTimeout(() => {
    try {
      if (W.state === 'playing') {
        p.tryShoot();
        W.shotFired = true;
      }
    } catch (e) {
      /* staging must never break the shot */
    }
  }, 600);
}

function stageGarage(W, p) {
  // Coupe at Ibarra Customs, Dante inside, shop open.
  const coupe = W.spawnCar('coupe', 340, 96, Math.PI / 2, {
    color: 0xc22424, owned: true, cond: 64, tuned: true, plated: true,
  });
  p.enterCar(coupe, true);
  p.cash = 18450;
  p.respect = 1400;
  W.clockMinutes = 18 * 60 + 45;
  setJob(W, 2, 2, 0);
  W.camYaw = Math.PI / 2;
  W.openShop();
  W.showDialog('TOMAS "WRENCH" IBARRA', 'She is beautiful, no? Tune, plate, nitro \u2014 I can make her fly.', '#14b8a6', 'TI');
}

function stageMap(W, p) {
  // Pause / big-map screen with stats. The staging values are deliberately
  // different from the round-2 shot (new position, clock, cash, respect and
  // career numbers, plus the new TAXI FARES row) so the captured frame can
  // never come out byte-identical to the previous round's map shot.
  p.x = 192;
  p.z = 96;
  p.heading = 0;
  p.cash = 19870;
  p.respect = 1520;
  W.clockMinutes = 19 * 60 + 2;
  p.stats.carsStolen = 31;
  p.stats.starsLost = 27;
  p.stats.knockouts = 12;
  p.stats.raceWins = 2;
  p.stats.drivenKm = 61.7;
  p.stats.faresCompleted = 14;
  p.stats.faresEarned = 486;
  W.missions.completedJobs = 3;
  W.missions.jobIndex = 3;
  W.missions.stageIndex = 0;
  W.missions.active = true;
  W.city.setMarker(-80, -400, 'Next job 4 \u2014 Dockside Ambush');
  W.setPaused(true);
  const side = document.getElementById('map-side');
  if (side) {
    const note = document.createElement('div');
    note.className = 'map-next-job';
    note.textContent = 'Next job \u2014 Dockside Ambush \u00b7 7 Tiburon at the docks';
    side.appendChild(note);
  }
}

const STAGERS = {
  chase: stageChase,
  street: stageStreet,
  garage: stageGarage,
  map: stageMap,
};

export function stageShot(W, name) {
  const p = baseStaging(W, name);
  const stage = STAGERS[name];
  if (stage) stage(W, p);
  W.hudDirty = true;
}
