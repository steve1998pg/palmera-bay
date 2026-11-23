// Missions: the 8 story jobs, the side street race, and the stash pickups.
// Stage types: go / collect / deliver / steal / kill / race / survive.
// The active stage shows a world marker, a HUD mission card, and a line of
// dialogue from the job giver.
import { JOBS, GIVERS, RACE_SIDE } from './config.js';
import { clamp } from './random.js';

export function makeMissions(W) {
  const M = {
    jobIndex: 0, stageIndex: 0,
    killsLeft: 0, killsTotal: 0, killsDone: 0,
    completedJobs: 0, active: false,
    targetCar: null,
    race: null, // {checkpoints, idx, timeLeft, jobRace, side}
    surviveLeft: 0,
    failAt: 0, failJob: -1,
    stageTimer: 0,
  };

  M.job = function () { return JOBS[M.jobIndex] || null; };
  M.stage = function () {
    const j = M.job();
    if (!j) return null;
    return j.stages[M.stageIndex] || null;
  };

  function showStageDialog(stage) {
    const job = M.job();
    if (!job || !stage.say) return;
    const giver = GIVERS[job.giver];
    W.showDialog(giver.name, stage.say, giver.color, giver.initials);
  }

  M.startJob = function (i) {
    M.jobIndex = i;
    M.stageIndex = 0;
    M.active = true;
    M.race = null;
    M.surviveLeft = 0;
    M.clearTargetCar();
    if (i >= JOBS.length) {
      M.active = false;
      W.notify('PALMERA BAY IS YOURS');
      return;
    }
    M.beginStage();
    const job = M.job();
    W.toast('NEW JOB \u2014 ' + job.name);
  };

  M.restartCurrentJob = function () {
    M.startJob(M.jobIndex);
  };

  M.clearTargetCar = function () {
    if (M.targetCar) {
      M.targetCar.targetCar = false;
      M.targetCar = null;
    }
  };

  M.beginStage = function () {
    const stage = M.stage();
    if (!stage) return;
    M.stageTimer = 0;
    M.race = null;
    M.killsLeft = 0; M.killsTotal = 0; M.killsDone = 0;
    W.city.clearMarker();
    if (stage.type === 'kill') {
      M.killsTotal = stage.count;
      M.killsLeft = stage.count;
      W.spawnEnemies(stage.count, stage.x, stage.z, M.job().id);
      W.city.setMarker(stage.x, stage.z, stage.label);
    } else if (stage.type === 'steal') {
      const car = W.spawnTargetCar(stage.carType, stage.x, stage.z);
      M.targetCar = car;
      W.city.setMarker(stage.x, stage.z, stage.label);
    } else if (stage.type === 'race') {
      M.race = {
        checkpoints: stage.checkpoints.map(([x, z]) => ({ x, z, done: false })),
        idx: 0, timeLeft: stage.time, jobRace: true, side: false,
      };
      const cp = M.race.checkpoints[0];
      W.city.setMarker(cp.x, cp.z, 'Checkpoint 1/' + M.race.checkpoints.length);
    } else if (stage.type === 'survive') {
      M.surviveLeft = stage.time;
      W.police.setHeat(Math.min(100, W.police.heat + (stage.heat || 0)));
      W.city.clearMarker();
    } else {
      W.city.setMarker(stage.x, stage.z, stage.label);
    }
    showStageDialog(stage);
    W.hudDirty = true;
  };

  M.advanceStage = function () {
    const job = M.job();
    if (!job) return;
    M.stageIndex++;
    if (M.stageIndex >= job.stages.length) {
      M.completeJob();
      return;
    }
    M.beginStage();
  };

  M.completeJob = function () {
    const job = M.job();
    if (!job) return;
    W.player.cash += job.reward;
    W.player.respect += job.respect;
    M.completedJobs++;
    W.audio.missionDone();
    W.city.clearMarker();
    M.clearTargetCar();
    W.showJobDone(job);
    const next = M.jobIndex + 1;
    if (next >= JOBS.length) {
      M.jobIndex = next;
      M.active = false;
      M.stageIndex = 0;
      W.notify('PALMERA BAY IS YOURS');
    } else {
      M.jobIndex = next;
      M.stageIndex = 0;
      M.active = true;
      M.beginStage();
    }
    // Save AFTER the job index has moved, so CONTINUE resumes at the
    // next job instead of replaying the one just finished.
    W.save.write();
    W.hudDirty = true;
  };

  M.failJob = function (reason) {
    W.notify('JOB FAILED \u2014 ' + (reason || 'try again'));
    M.failAt = W.now + 1.2;
    M.failJob = M.jobIndex;
    M.active = false;
    W.city.clearMarker();
    M.clearTargetCar();
  };

  // Called when a mission enemy dies.
  M.onMissionKill = function (tag) {
    const job = M.job();
    if (!job || !M.active) return;
    const stage = M.stage();
    if (!stage || stage.type !== 'kill') return;
    if (tag !== job.id) return;
    M.killsLeft = Math.max(0, M.killsLeft - 1);
    M.killsDone = M.killsTotal - M.killsLeft;
    W.hudDirty = true;
    if (M.killsLeft <= 0) M.advanceStage();
  };

  // Called when the player enters a car.
  M.onEnterCar = function (car) {
    const stage = M.stage();
    if (M.active && stage && stage.type === 'steal' && car === M.targetCar) {
      W.notify('Car stolen \u2014 get it to the drop');
      M.advanceStage();
    }
  };

  M.startSideRace = function () {
    const p = W.player;
    if (p.cash < RACE_SIDE.entry) {
      W.notify('You need $500 to enter the race');
      return false;
    }
    p.cash -= RACE_SIDE.entry;
    M.race = {
      checkpoints: RACE_SIDE.checkpoints.map(([x, z]) => ({ x, z, done: false })),
      idx: 0, timeLeft: RACE_SIDE.time, jobRace: false, side: true,
    };
    const cp = M.race.checkpoints[0];
    W.city.setMarker(cp.x, cp.z, 'Checkpoint 1/' + M.race.checkpoints.length);
    W.toast('STREET RACE \u2014 first to the last gate wins');
    W.showDialog('NICO VEGA', 'Five hundred in, twelve hundred out. Do not bin my car, Dante.', '#38bdf8', 'NV');
    return true;
  };

  M.finishRace = function (won) {
    const wasSide = M.race && M.race.side;
    M.race = null;
    W.city.clearMarker();
    if (won) {
      if (wasSide) {
        W.player.cash += RACE_SIDE.winCash;
        W.player.respect += RACE_SIDE.winRespect;
        W.player.stats.raceWins++;
        W.notify('RACE WON \u2014 +$1,200');
        W.audio.missionDone();
      } else {
        M.advanceStage();
      }
    } else if (!wasSide) {
      M.failJob('Out of time');
    } else {
      W.notify('Race lost \u2014 entry fee gone');
    }
  };

  M.update = function (dt, now) {
    // Delayed job restart after a failure.
    if (M.failJob >= 0 && now >= M.failAt) {
      const j = M.failJob;
      M.failJob = -1;
      M.startJob(j);
    }
    if (!M.active) {
      // A side race can run outside jobs.
      if (M.race && M.race.side) M.updateRace(dt);
      return;
    }
    const stage = M.stage();
    if (!stage) return;
    const pp = W.playerPos();
    if (stage.type === 'go') {
      if (Math.hypot(pp.x - stage.x, pp.z - stage.z) < 9) M.advanceStage();
    } else if (stage.type === 'collect') {
      if (Math.hypot(pp.x - stage.x, pp.z - stage.z) < 6) {
        W.player.cash += 300;
        W.notify('Stash collected \u2014 +$300');
        M.advanceStage();
      }
    } else if (stage.type === 'deliver') {
      const d = Math.hypot(pp.x - stage.x, pp.z - stage.z);
      if (W.player.inCar && d < 11) M.advanceStage();
      else if (!W.player.inCar && d < 11) W.hintDeliver = true;
      else W.hintDeliver = false;
    } else if (stage.type === 'race' || (M.race && M.race.jobRace)) {
      M.updateRace(dt);
    } else if (stage.type === 'survive') {
      M.surviveLeft -= dt;
      if (M.surviveLeft <= 0) M.advanceStage();
    }
    // Stash pickups are always live.
    for (const s of W.city.stashes) {
      if (s.taken) continue;
      if (Math.hypot(pp.x - s.x, pp.z - s.z) < 2.5) {
        s.taken = true;
        s.mesh.visible = false;
        if (s.glow) s.glow.visible = false;
        W.player.cash += 150;
        W.audio.coin();
        W.notify('Hidden stash \u2014 +$150');
      }
    }
  };

  M.updateRace = function (dt) {
    if (!M.race) return;
    M.race.timeLeft -= dt;
    const cp = M.race.checkpoints[M.race.idx];
    if (cp) {
      const pp = W.playerPos();
      if (Math.hypot(pp.x - cp.x, pp.z - cp.z) < 13) {
        cp.done = true;
        M.race.idx++;
        W.audio.coin();
        if (M.race.idx >= M.race.checkpoints.length) {
          M.finishRace(true);
          return;
        }
        const next = M.race.checkpoints[M.race.idx];
        W.city.setMarker(next.x, next.z, 'Checkpoint ' + (M.race.idx + 1) + '/' + M.race.checkpoints.length);
        W.toast('Checkpoint ' + M.race.idx + '/' + M.race.checkpoints.length);
      }
    }
    if (M.race.timeLeft <= 0) M.finishRace(false);
  };

  // Human-readable objective label for the HUD (with live kill counts).
  M.objectiveLabel = function () {
    const stage = M.stage();
    if (!stage) return '';
    if (stage.type === 'kill') {
      return stage.label + ' (' + M.killsDone + '/' + M.killsTotal + ')';
    }
    if (stage.type === 'race' && M.race) {
      return stage.label + ' \u2014 ' + M.race.idx + '/' + M.race.checkpoints.length + ' gates';
    }
    return stage.label;
  };

  M.completion = function () {
    const jobsPart = 0.8 * (M.completedJobs / 8);
    const respPart = 0.2 * clamp(W.player.respect / 2600, 0, 1);
    return Math.round((jobsPart + respPart) * 100);
  };

  return M;
}
