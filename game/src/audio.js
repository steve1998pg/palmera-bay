// Procedural WebAudio: engine hum, sirens, gunfire, explosions, UI blips and
// three synthesized radio stations. Everything is a no-op until the first
// user gesture creates the AudioContext, so it is safe to call any time.
import { RADIO } from './config.js';

export function makeAudio() {
  const A = {
    ctx: null, master: null, radioGain: null, engineOsc: null, engineOsc2: null,
    engineGain: null, engineFilter: null, station: 0, radioOn: true,
    sirenTimer: null, sirenStep: 0, sirenNodes: [],
    seq: { step: 0, nextTime: 0 },
  };

  A.ensure = function () {
    if (A.ctx) {
      if (A.ctx.state === 'suspended') A.ctx.resume().catch(() => {});
      return true;
    }
    try {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) return false;
      A.ctx = new Ctor();
      A.master = A.ctx.createGain();
      A.master.gain.value = 0.5;
      A.master.connect(A.ctx.destination);
      A.radioGain = A.ctx.createGain();
      A.radioGain.gain.value = 0.14;
      A.radioGain.connect(A.master);
      // Engine: two detuned saws through a lowpass.
      A.engineFilter = A.ctx.createBiquadFilter();
      A.engineFilter.type = 'lowpass';
      A.engineFilter.frequency.value = 420;
      A.engineGain = A.ctx.createGain();
      A.engineGain.gain.value = 0;
      A.engineOsc = A.ctx.createOscillator();
      A.engineOsc.type = 'sawtooth';
      A.engineOsc.frequency.value = 55;
      A.engineOsc2 = A.ctx.createOscillator();
      A.engineOsc2.type = 'sawtooth';
      A.engineOsc2.frequency.value = 58;
      A.engineOsc.connect(A.engineFilter);
      A.engineOsc2.connect(A.engineFilter);
      A.engineFilter.connect(A.engineGain);
      A.engineGain.connect(A.master);
      A.engineOsc.start();
      A.engineOsc2.start();
      A.seq.nextTime = A.ctx.currentTime + 0.1;
    } catch (e) {
      A.ctx = null;
      return false;
    }
    return true;
  };

  function tone(freq, dur, type, vol, when = 0, slideTo = 0) {
    if (!A.ctx) return;
    try {
      const t0 = A.ctx.currentTime + when;
      const o = A.ctx.createOscillator();
      const g = A.ctx.createGain();
      o.type = type || 'sine';
      o.frequency.setValueAtTime(freq, t0);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
      g.gain.setValueAtTime(vol || 0.2, t0);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      o.connect(g); g.connect(A.master);
      o.start(t0); o.stop(t0 + dur + 0.05);
    } catch (e) { /* audio is best-effort */ }
  }

  function noiseBurst(dur, vol, filterFreq) {
    if (!A.ctx) return;
    try {
      const t0 = A.ctx.currentTime;
      const len = Math.max(1, Math.floor(A.ctx.sampleRate * dur));
      const buf = A.ctx.createBuffer(1, len, A.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = A.ctx.createBufferSource();
      src.buffer = buf;
      const f = A.ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = filterFreq || 1800;
      const g = A.ctx.createGain();
      g.gain.value = vol || 0.3;
      src.connect(f); f.connect(g); g.connect(A.master);
      src.start(t0);
    } catch (e) { /* best-effort */ }
  }

  A.blip = function () { tone(880, 0.07, 'square', 0.08); };
  A.coin = function () { tone(988, 0.09, 'sine', 0.18); tone(1319, 0.16, 'sine', 0.18, 0.09); };
  A.punch = function () { noiseBurst(0.09, 0.35, 700); tone(120, 0.1, 'sine', 0.25, 0, 60); };
  A.missionDone = function () { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.22, 'triangle', 0.2, i * 0.13)); };
  A.busted = function () { [392, 330, 262, 196].forEach((f, i) => tone(f, 0.3, 'triangle', 0.2, i * 0.16)); };
  A.explosion = function () {
    noiseBurst(0.7, 0.6, 500);
    tone(90, 0.6, 'sine', 0.5, 0, 35);
  };

  A.shot = function (weaponId) {
    if (!A.ctx) return;
    if (weaponId === 'shotgun') { noiseBurst(0.22, 0.5, 900); tone(160, 0.16, 'square', 0.2, 0, 70); }
    else if (weaponId === 'rifle') { noiseBurst(0.14, 0.42, 2600); tone(220, 0.1, 'square', 0.16, 0, 90); }
    else if (weaponId === 'smg') { noiseBurst(0.07, 0.3, 3200); tone(300, 0.05, 'square', 0.12, 0, 140); }
    else if (weaponId === 'pistol') { noiseBurst(0.1, 0.36, 2400); tone(260, 0.08, 'square', 0.15, 0, 110); }
    else A.punch();
  };

  A.setEngine = function (speed01, inCar) {
    if (!A.ctx) return;
    try {
      const target = inCar ? 0.05 + speed01 * 0.1 : 0;
      A.engineGain.gain.setTargetAtTime(target, A.ctx.currentTime, 0.1);
      const f = 55 + speed01 * 130;
      A.engineOsc.frequency.setTargetAtTime(f, A.ctx.currentTime, 0.08);
      A.engineOsc2.frequency.setTargetAtTime(f * 1.01 + 2, A.ctx.currentTime, 0.08);
      A.engineFilter.frequency.setTargetAtTime(380 + speed01 * 900, A.ctx.currentTime, 0.1);
    } catch (e) { /* best-effort */ }
  };

  // Siren: schedule one full 8-step cycle (660/880 alternating, 0.45 s per
  // step), then re-schedule only when the cycle is over. Re-scheduling every
  // frame would pin the siren on its first note forever.
  A.sirenTick = function (wanted) {
    if (!A.ctx) return;
    if (wanted <= 0) {
      if (A.sirenTimer) { clearTimeout(A.sirenTimer); A.sirenTimer = null; }
      return;
    }
    if (A.sirenTimer) return;
    const cycleMs = 8 * 450;
    for (let i = 0; i < 8; i++) {
      tone(i % 2 === 0 ? 660 : 880, 0.42, 'sine', 0.055, (i * 450) / 1000);
    }
    A.sirenTimer = setTimeout(() => { A.sirenTimer = null; }, cycleMs);
  };

  A.cycleStation = function () {
    A.station = (A.station + 1) % RADIO.length;
    A.blip();
    return RADIO[A.station];
  };

  // Radio sequencer: called every frame; schedules a little ahead.
  A.radioTick = function () {
    if (!A.ctx || !A.radioOn) return;
    try {
      const st = RADIO[A.station];
      const stepDur = 60 / st.bpm / 2; // eighth notes
      const scale = st.minor ? [0, 2, 3, 5, 7, 8, 10] : [0, 2, 4, 5, 7, 9, 11];
      while (A.seq.nextTime < A.ctx.currentTime + 0.18) {
        const t = A.seq.nextTime - A.ctx.currentTime;
        const step = A.seq.step;
        const bar = Math.floor(step / 8) % 4;
        const root = st.root * (bar === 3 ? 0.89 : 1);
        // Bass on the beat.
        if (step % 2 === 0) {
          const o = A.ctx.createOscillator(); const g = A.ctx.createGain();
          o.type = st.wave; o.frequency.value = root;
          g.gain.setValueAtTime(0.5, A.ctx.currentTime + t);
          g.gain.exponentialRampToValueAtTime(0.001, A.ctx.currentTime + t + stepDur * 1.8);
          o.connect(g); g.connect(A.radioGain);
          o.start(A.ctx.currentTime + t); o.stop(A.ctx.currentTime + t + stepDur * 2);
        }
        // Hat on off-beats (filtered noise, short).
        if (step % 2 === 1) {
          const len = Math.floor(A.ctx.sampleRate * 0.03);
          const buf = A.ctx.createBuffer(1, len, A.ctx.sampleRate);
          const d = buf.getChannelData(0);
          for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
          const s = A.ctx.createBufferSource(); s.buffer = buf;
          const f = A.ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 6000;
          const g = A.ctx.createGain(); g.gain.value = 0.25;
          s.connect(f); f.connect(g); g.connect(A.radioGain);
          s.start(A.ctx.currentTime + t);
        }
        // Snare on beats 2 and 4.
        if (step % 8 === 4) noiseBurst(0.08, 0.12, 1800);
        // Lead: a simple wandering line, one note per bar step.
        if (step % 2 === 0) {
          const deg = scale[(step * 3 + bar) % scale.length];
          const freq = root * 4 * Math.pow(2, deg / 12);
          const o = A.ctx.createOscillator(); const g = A.ctx.createGain();
          o.type = 'sine'; o.frequency.value = freq;
          g.gain.setValueAtTime(0.12, A.ctx.currentTime + t);
          g.gain.exponentialRampToValueAtTime(0.001, A.ctx.currentTime + t + stepDur * 1.6);
          o.connect(g); g.connect(A.radioGain);
          o.start(A.ctx.currentTime + t); o.stop(A.ctx.currentTime + t + stepDur * 1.8);
        }
        A.seq.step++;
        A.seq.nextTime += stepDur;
      }
    } catch (e) { /* best-effort */ }
  };

  return A;
}
