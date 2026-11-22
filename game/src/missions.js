// Story: eight jobs for La Jefa, from a first repo to owning the bay, plus the
// street race and the stashes scattered around town. All original characters.
import { clamp } from './random.js';

export const GIVERS = {
  celia: { name: 'CELIA “LA JEFA” DUARTE', role: 'FIXER · MARINA ROW', initials: 'CJ', color: '#f59e0b' },
  tomas: { name: 'TOMAS “WRENCH” IBARRA', role: 'MECHANIC · IBARRA CUSTOMS', initials: 'TI', color: '#14b8a6' },
  nico: { name: 'NICO VEGA', role: 'DRIVER · GETAWAY', initials: 'NV', color: '#38bdf8' },
  sofia: { name: 'SOFIA “EYES” RIVAS', role: 'LOOKOUT · PALM HEIGHTS', initials: 'SR', color: '#fb7185' },
};

export const JOBS = [
  {
    id: 'first-wheels', name: 'FIRST WHEELS', giver: 'tomas',
    brief: 'Tomas needs wheels and you need work. Borrow a coupe, bring it home.',
    reward: 800, respect: 150,
    stages: [
      { type: 'go', x: 340, z: 96, label: 'Go to Ibarra Customs in Marina Row', next: 'Meet Tomas', say: 'Dante! Good, you came. I need a Comet RS — there’s one parked on the boulevard. Bring it to me, no scratches. Well — few scratches.' },
      { type: 'steal', x: 352, z: -40, car: 'coupe', label: 'Steal the Veloz Comet RS', next: 'Lose nobody — just drive', say: 'There it is, red as a sunset. Get in, get out. The owner’s still at lunch.' },
      { type: 'deliver', x: 340, z: 96, label: 'Deliver the Comet to Ibarra Customs', next: 'Get paid', say: 'You drive like my abuela — careful! Bring it around back.' },
    ],
  },
  {
    id: 'repo-rodeo', name: 'REPO RODEO', giver: 'celia',
    brief: 'A Meridian GT in Palm Heights belongs to a man who owes La Jefa. Take it.',
    reward: 1600, respect: 220,
    stages: [
      { type: 'steal', x: 288, z: 288, car: 'sport', label: 'Steal the Meridian GT in Palm Heights', next: 'The PBPD will notice', say: 'The GT is parked outside the big house on the hill. Its owner owes me forty thousand. You owe me your life. Fair trade — take the car.' },
      { type: 'deliver', x: 500, z: 200, label: 'Deliver the GT to the pier — lose the police', next: 'Paco is waiting at the boat', say: 'The boys in blue will want a word. Don’t give them one. Paco’s boat leaves when you arrive.' },
    ],
  },
  {
    id: 'market-squeeze', name: 'MARKET SQUEEZE', giver: 'nico',
    brief: 'The Tiburon crew is taxing every stall at Mercado Verde. Clear them out.',
    reward: 2400, respect: 300,
    stages: [
      { type: 'kill', count: 5, x: 120, z: 352, label: 'Clear the Tiburon crew from the market (0/5)', next: 'Grab the stash', say: 'Five of them, counting the lookout. The stall owners are family, Dante — keep the people behind you.' },
      { type: 'collect', x: 96, z: 300, label: 'Collect the stash behind the flower stall', next: 'Bring it to Celia', say: 'They keep the week’s take behind the flowers. Take it. Consider it a tip.' },
    ],
  },
  {
    id: 'dockside-ambush', name: 'DOCKSIDE AMBUSH', giver: 'sofia',
    brief: 'A Tiburon shipment lands at Saltflats Port tonight. Take the van, take the port.',
    reward: 3200, respect: 380,
    stages: [
      { type: 'kill', count: 7, x: -80, z: -400, label: 'Clear the Tiburon crew from the docks (0/7)', next: 'Take their van', say: 'Seven guards, two containers, one van full of things that fell off a boat. Eyes on the cranes — they like high ground.' },
      { type: 'steal', x: -80, z: -360, car: 'van', label: 'Take the Tiburon cargo van', next: 'Drive it home', say: 'The van’s yours. Don’t stop for the gate — there is no gate anymore.' },
      { type: 'deliver', x: -336, z: 336, label: 'Deliver the van to the safehouse', next: 'Get paid', say: 'Safehouse, west end. Park it behind the wall and walk away like you own the street.' },
    ],
  },
  {
    id: 'high-tide', name: 'HIGH TIDE', giver: 'nico',
    brief: 'A boulevard race at dusk, seven checkpoints, one very fast tide of traffic.',
    reward: 4000, respect: 450,
    stages: [
      { type: 'race', time: 150, points: [[352, -320], [352, -120], [352, 80], [352, 280], [288, 288], [96, 288], [96, 96]], label: 'Hit every checkpoint before the clock dies', next: 'Seven gates, one winner', say: 'Seven gates down the boulevard and back. The tide comes in at 150 seconds — be past the last gate or be a memory.' },
    ],
  },
  {
    id: 'golden-hour', name: 'GOLDEN HOUR', giver: 'celia',
    brief: 'Four stars, ninety seconds, one boat. The whole PBPD wants you tonight.',
    reward: 5200, respect: 520,
    stages: [
      { type: 'survive', time: 90, wanted: 4, label: 'Survive the manhunt — 90 seconds', next: 'Then run for the pier', say: 'They know your face now, Dante. Ninety seconds of hell, then the boat. Break line of sight and breathe.' },
      { type: 'go', x: 500, z: 200, label: 'Reach the boat at the pier', next: 'Sail away clean', say: 'The boat sails when you step on. Shake that chopper and get to the pier!' },
    ],
  },
  {
    id: 'long-way-home', name: 'THE LONG WAY HOME', giver: 'tomas',
    brief: 'Three drops across the city in one borrowed car, with the PBPD on your tail.',
    reward: 6500, respect: 600,
    stages: [
      { type: 'deliver', x: 0, z: 0, label: 'Drop 1/3 — Sundial Square', next: 'Two more drops', say: 'Three packages, three corners of the bay. The car is borrowed, the cops are not. First stop: the square.' },
      { type: 'deliver', x: -288, z: -288, label: 'Drop 2/3 — Old Cannery', next: 'One more drop', say: 'One down. The cannery next — mind the forklifts, they bite.' },
      { type: 'deliver', x: 288, z: -288, label: 'Drop 3/3 — Calle Verde', next: 'Bring the car back', say: 'Last one, Calle Verde. Then the car comes home. Try to bring all of it.' },
    ],
  },
  {
    id: 'bay-boss', name: 'BAY BOSS', giver: 'celia',
    brief: 'The Tiburons hold Sundial Square tonight. Take it back, and the bay is yours.',
    reward: 20000, respect: 900,
    stages: [
      { type: 'kill', count: 8, x: -48, z: -48, label: 'Take Sundial Square back (0/8)', next: 'Then the pier', say: 'Eight of them hold the square. Tonight the square holds them — in the ground. After this, Dante, the bay is yours.' },
      { type: 'go', x: 500, z: 200, label: 'Meet La Jefa at the pier — the finale', next: 'Own Palmera Bay', say: 'It’s done. Meet me at the pier and watch the sun go down on your city.' },
    ],
  },
];

export class MissionManager {
  constructor(world) {
    this.world = world;
    this.jobIndex = 0;
    this.stageIndex = 0;
    this.stageTimer = 0;
    this.racePoint = 0;
    this.killsLeft = 0;
    this.targetCar = null;
    this.active = false;
    this.completedJobs = 0;
    this.failed = false;
  }

  job() { return JOBS[this.jobIndex]; }
  stage() { const j = this.job(); return j ? j.stages[this.stageIndex] : null; }
  done() { return this.jobIndex >= JOBS.length; }

  startJob(index) {
    this.jobIndex = index;
    this.stageIndex = 0;
    this.active = true;
    this.failed = false;
    this._enterStage();
  }

  _enterStage() {
    const st = this.stage();
    const job = this.job();
    if (!st || !job) return;
    this.stageTimer = st.time || 0;
    this.racePoint = 0;
    const w = this.world;
    w.clearMarker();
    if (st.type === 'go' || st.type === 'deliver' || st.type === 'collect') {
      w.setMarker(st.x, st.z, st.label);
    } else if (st.type === 'steal') {
      this.targetCar = w.spawnTargetCar(st.car, st.x, st.z);
      w.setMarker(st.x, st.z, st.label);
    } else if (st.type === 'kill') {
      this.killsLeft = st.count;
      w.spawnEnemies(st.count, st.x, st.z, this.job().id);
      w.setMarker(st.x, st.z, st.label);
    } else if (st.type === 'race') {
      w.setMarker(st.points[0][0], st.points[0][1], st.label);
    } else if (st.type === 'survive') {
      w.police.addHeat(78, w);
      w.hud.notify('FOUR STARS — the whole PBPD is coming for you', 'bad');
    }
    const giver = GIVERS[job.giver];
    w.hud.showDialogue(giver, st.say);
    w.hud.setMission(job, this.stageIndex, st);
    w.audio.blip(1046, 0.12, 'triangle', 0.15);
  }

  _advance() {
    const job = this.job();
    this.stageIndex += 1;
    if (this.stageIndex >= job.stages.length) {
      this._completeJob();
      return;
    }
    this._enterStage();
  }

  _completeJob() {
    const job = this.job();
    const w = this.world;
    w.player.cash += job.reward;
    w.player.respect += job.respect;
    this.completedJobs += 1;
    w.clearMarker();
    w.audio.missionDone();
    w.hud.showJobDone(job);
    w.saveGame();
    this.jobIndex += 1;
    this.active = false;
    if (!this.done()) {
      setTimeout(() => { if (!w.paused) this.startJob(this.jobIndex); }, 100);
    } else {
      w.hud.notify('PALMERA BAY IS YOURS — every job done. You are the Bay Boss.', 'gold');
    }
  }

  failJob(reason) {
    const w = this.world;
    this.failed = true;
    w.clearMarker();
    w.hud.notify(reason + ' — job failed. Talk to La Jefa to try again.', 'bad');
    w.audio.busted();
    // Restart the same job after a beat.
    setTimeout(() => { if (!w.paused) this.startJob(this.jobIndex); }, 1200);
  }

  onKill() {
    const st = this.stage();
    if (!st || st.type !== 'kill') return;
    this.killsLeft = Math.max(0, this.killsLeft - 1);
    this.world.hud.setMission(this.job(), this.stageIndex, { ...st, label: st.label.replace(/\(\d+\/\d+\)/, `(${st.count - this.killsLeft}/${st.count})`) });
    if (this.killsLeft <= 0) this._advance();
  }

  update(dt, world) {
    if (!this.active || this.done()) return;
    const st = this.stage();
    if (!st) return;
    const p = world.playerPos();
    const inCar = !!world.player.inCar;
    if (st.time) {
      this.stageTimer -= dt;
      world.hud.setTimer(this.stageTimer);
      if (this.stageTimer <= 0) {
        if (st.type === 'race') { this.failJob('Out of time on the race'); return; }
        if (st.type === 'survive') { this._advance(); return; }
      }
    }
    const near = (x, z, r) => Math.hypot(p.x - x, p.z - z) < r;
    switch (st.type) {
      case 'go':
        if (near(st.x, st.z, 9)) this._advance();
        break;
      case 'collect':
        if (near(st.x, st.z, 6)) { world.audio.coin(); this._advance(); }
        break;
      case 'deliver':
        if (inCar && near(st.x, st.z, 11)) this._advance();
        else if (!inCar && near(st.x, st.z, 11)) world.hud.hint('You need a car for this drop');
        break;
      case 'steal':
        if (this.targetCar && world.player.inCar === this.targetCar) {
          world.hud.notify('That’s the one — now move!', 'good');
          this._advance();
        }
        break;
      case 'race': {
        const pt = st.points[this.racePoint];
        if (pt && near(pt[0], pt[1], 13)) {
          this.racePoint += 1;
          world.audio.coin();
          if (this.racePoint >= st.points.length) { this._advance(); }
          else {
            const np = st.points[this.racePoint];
            world.setMarker(np[0], np[1], `Checkpoint ${this.racePoint + 1}/${st.points.length}`);
            world.hud.notify(`Checkpoint ${this.racePoint}/${st.points.length}`, 'good');
          }
        }
        break;
      }
      case 'survive':
        // Timer handles completion.
        break;
      case 'kill':
        break;
    }
  }

  progressFraction() {
    const job = this.job();
    if (!job) return 1;
    return this.stageIndex / job.stages.length;
  }
}
