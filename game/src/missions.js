// Missions: the 8 story jobs, the side street race, and the stash pickups.
// Stage types: go / collect / deliver / steal / kill / race / survive.
// The active stage shows a world marker, a HUD mission card, and a line of
// dialogue from the job giver. Stage setup and stage ticking are both
// driven by small handler tables keyed by stage type.
import { JOBS, GIVERS, RACE_SIDE } from './config.js';
import { clamp } from './random.js';

const JOB_NAMES = ['FIRST WHEELS', 'REPO RODEO', 'MARKET SQUEEZE', 'DOCKSIDE AMBUSH', 'HIGH TIDE', 'GOLDEN HOUR', 'THE LONG WAY HOME', 'BAY BOSS'];

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

  const currentJob = () => JOBS[M.jobIndex] || null;

  M.job = currentJob;

  M.stage = function () {
    const j = currentJob();
    return j ? j.stages[M.stageIndex] || null : null;
  };

  function sayStage(stage) {
    const job = currentJob();
    if (!job || !stage.say) return;
    const giver = GIVERS[job.giver];
    W.showDialog(giver.name, stage.say, giver.color, giver.initials);
  }

  function armRace(checkpoints, time, jobRace) {
    const gates = checkpoints.map(([x, z]) => ({ x, z, done: false }));
    M.race = { checkpoints: gates, idx: 0, timeLeft: time, jobRace, side: !jobRace };
    const first = gates[0];
    W.city.setMarker(first.x, first.z, 'Checkpoint 1/' + gates.length);
  }

  function markStage(stage) {
    W.city.setMarker(stage.x, stage.z, stage.label);
  }

  const STAGE_SETUP = {
    kill(stage) {
      M.killsTotal = stage.count;
      M.killsLeft = stage.count;
      W.spawnEnemies(stage.count, stage.x, stage.z, currentJob().id);
      markStage(stage);
    },
    steal(stage) {
      M.targetCar = W.spawnTargetCar(stage.carType, stage.x, stage.z);
      markStage(stage);
    },
    race(stage) {
      armRace(stage.checkpoints, stage.time, true);
    },
    survive(stage) {
      M.surviveLeft = stage.time;
      W.police.setHeat(Math.min(100, W.police.heat + (stage.heat || 0)));
      W.city.clearMarker();
    },
    go: markStage,
    collect: markStage,
    deliver: markStage,
  };

  M.beginStage = function () {
    const stage = M.stage();
    if (!stage) return;
    M.stageTimer = 0;
    M.race = null;
    M.killsLeft = 0;
    M.killsTotal = 0;
    M.killsDone = 0;
    W.city.clearMarker();
    (STAGE_SETUP[stage.type] || markStage)(stage);
    sayStage(stage);
    W.hudDirty = true;
  };

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
    W.toast('NEW JOB \u2014 ' + currentJob().name);
  };

  M.restartCurrentJob = function () {
    M.startJob(M.jobIndex);
  };

  M.clearTargetCar = function () {
    if (!M.targetCar) return;
    M.targetCar.targetCar = false;
    M.targetCar = null;
  };

  M.advanceStage = function () {
    const job = currentJob();
    if (!job) return;
    M.stageIndex += 1;
    if (M.stageIndex >= job.stages.length) M.completeJob();
    else M.beginStage();
  };

  M.completeJob = function () {
    const job = currentJob();
    if (!job) return;
    const p = W.player;
    p.cash += job.reward;
    p.respect += job.respect;
    M.completedJobs += 1;
    W.audio.missionDone();
    W.city.clearMarker();
    M.clearTargetCar();
    W.showJobDone(job);
    const next = M.jobIndex + 1;
    M.jobIndex = next;
    M.stageIndex = 0;
    if (next >= JOBS.length) {
      M.active = false;
      W.notify('PALMERA BAY IS YOURS');
    } else {
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
    const job = currentJob();
    if (!job || !M.active) return;
    const stage = M.stage();
    if (!stage || stage.type !== 'kill' || tag !== job.id) return;
    M.killsLeft = Math.max(0, M.killsLeft - 1);
    M.killsDone = M.killsTotal - M.killsLeft;
    W.hudDirty = true;
    if (M.killsLeft <= 0) M.advanceStage();
  };

  // Called when the player enters a car.
  M.onEnterCar = function (car) {
    const stage = M.stage();
    const isTarget = M.active && stage && stage.type === 'steal' && car === M.targetCar;
    if (!isTarget) return;
    W.notify('Car stolen \u2014 get it to the drop');
    M.advanceStage();
  };

  M.startSideRace = function () {
    const p = W.player;
    if (p.cash < RACE_SIDE.entry) {
      W.notify('You need $500 to enter the race');
      return false;
    }
    p.cash -= RACE_SIDE.entry;
    armRace(RACE_SIDE.checkpoints, RACE_SIDE.time, false);
    W.toast('STREET RACE \u2014 first to the last gate wins');
    W.showDialog('NICO VEGA', 'Five hundred in, twelve hundred out. Do not bin my car, Dante.', '#38bdf8', 'NV');
    return true;
  };

  M.finishRace = function (won) {
    const wasSide = !!(M.race && M.race.side);
    M.race = null;
    W.city.clearMarker();
    if (!won) {
      if (wasSide) W.notify('Race lost \u2014 entry fee gone');
      else M.failJob('Out of time');
      return;
    }
    if (wasSide) {
      const p = W.player;
      p.cash += RACE_SIDE.winCash;
      p.respect += RACE_SIDE.winRespect;
      p.stats.raceWins += 1;
      W.notify('RACE WON \u2014 +$1,200');
      W.audio.missionDone();
    } else {
      M.advanceStage();
    }
  };

  function collectStashes() {
    const pp = W.playerPos();
    for (const s of W.city.stashes) {
      if (s.taken) continue;
      if (Math.hypot(pp.x - s.x, pp.z - s.z) >= 2.5) continue;
      s.taken = true;
      s.mesh.visible = false;
      if (s.glow) s.glow.visible = false;
      W.player.cash += 150;
      W.audio.coin();
      W.notify('Hidden stash \u2014 +$150');
    }
  }

  M.updateRace = function (dt) {
    if (!M.race) return;
    M.race.timeLeft -= dt;
    const cp = M.race.checkpoints[M.race.idx];
    if (cp) {
      const pp = W.playerPos();
      if (Math.hypot(pp.x - cp.x, pp.z - cp.z) < 13) {
        cp.done = true;
        M.race.idx += 1;
        W.audio.coin();
        if (M.race.idx >= M.race.checkpoints.length) {
          M.finishRace(true);
          return;
        }
        const next = M.race.checkpoints[M.race.idx];
        const total = M.race.checkpoints.length;
        W.city.setMarker(next.x, next.z, 'Checkpoint ' + (M.race.idx + 1) + '/' + total);
        W.toast('Checkpoint ' + M.race.idx + '/' + total);
      }
    }
    if (M.race.timeLeft <= 0) M.finishRace(false);
  };

  function stageDist(stage) {
    const pp = W.playerPos();
    return Math.hypot(pp.x - stage.x, pp.z - stage.z);
  }

  const STAGE_TICK = {
    go(stage, dt) {
      if (stageDist(stage) < 9) M.advanceStage();
    },
    collect(stage, dt) {
      if (stageDist(stage) >= 6) return;
      W.player.cash += 300;
      W.notify('Stash collected \u2014 +$300');
      M.advanceStage();
    },
    deliver(stage, dt) {
      const d = stageDist(stage);
      if (W.player.inCar && d < 11) M.advanceStage();
      else W.hintDeliver = !W.player.inCar && d < 11;
    },
    race(stage, dt) {
      M.updateRace(dt);
    },
    survive(stage, dt) {
      M.surviveLeft -= dt;
      if (M.surviveLeft <= 0) M.advanceStage();
    },
  };

  M.update = function (dt, now) {
    // Delayed job restart after a failure.
    if (M.failJob >= 0 && now >= M.failAt) {
      const j = M.failJob;
      M.failJob = -1;
      M.startJob(j);
    }
    // Stash pickups are always live — including after the last job, when
    // the tracker goes quiet and the player is just roaming the bay.
    collectStashes();
    if (!M.active) {
      // A side race can run outside jobs.
      if (M.race && M.race.side) M.updateRace(dt);
      return;
    }
    const stage = M.stage();
    if (!stage) return;
    if (M.race && M.race.jobRace) {
      M.updateRace(dt);
    } else {
      const tick = STAGE_TICK[stage.type];
      if (tick) tick(stage, dt);
    }
  };

  // Free roam for side systems (taxi fares): no race running, and the
  // current stage is travel or pickup — never a timed race, a manhunt, or
  // a firefight. With no job active at all, the whole bay is free roam.
  M.isFreeRoam = function () {
    if (M.race) return false;
    if (!M.active) return true;
    const stage = M.stage();
    if (!stage) return true;
    return stage.type !== 'race' && stage.type !== 'survive' && stage.type !== 'kill';
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

  M.nextJobName = function () {
    const idx = M.jobIndex + 1;
    return idx >= JOB_NAMES.length ? '' : 'NEXT: ' + JOB_NAMES[idx];
  };

  return M;
}
