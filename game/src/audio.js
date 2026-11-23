// Procedural WebAudio: engine hum, sirens, gunfire, explosions, UI blips
// and three synthesized radio stations. Everything is a no-op until the
// first user gesture creates the AudioContext, so it is safe to call any
// time.
import { RADIO } from './config.js';

const MINOR_SCALE = [0, 2, 3, 5, 7, 8, 10];
const MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11];
const SIREN_NOTES = [660, 880];
const SIREN_STEPS = 8;
const SIREN_STEP_MS = 450;

export function makeAudio() {
  const A = {
    ctx: null, master: null, radioGain: null, engineOsc: null, engineOsc2: null,
    engineGain: null, engineFilter: null, station: 0, radioOn: true,
    sirenTimer: null, sirenStep: 0, sirenNodes: [],
    seq: { step: 0, nextTime: 0 },
  };

  function buildEngineChain() {
    const ctx = A.ctx;
    A.engineFilter = ctx.createBiquadFilter();
    A.engineFilter.type = 'lowpass';
    A.engineFilter.frequency.value = 420;
    A.engineGain = ctx.createGain();
    A.engineGain.gain.value = 0;
    A.engineOsc = ctx.createOscillator();
    A.engineOsc.type = 'sawtooth';
    A.engineOsc.frequency.value = 55;
    A.engineOsc2 = ctx.createOscillator();
    A.engineOsc2.type = 'sawtooth';
    A.engineOsc2.frequency.value = 58;
    A.engineOsc.connect(A.engineFilter);
    A.engineOsc2.connect(A.engineFilter);
    A.engineFilter.connect(A.engineGain);
    A.engineGain.connect(A.master);
    A.engineOsc.start();
    A.engineOsc2.start();
  }

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
      buildEngineChain();
      A.seq.nextTime = A.ctx.currentTime + 0.1;
    } catch (e) {
      A.ctx = null;
      return false;
    }
    return true;
  };

  // One decaying oscillator note, optionally sliding to another pitch.
  function tone(freq, dur, type, vol, when, slideTo) {
    if (!A.ctx) return;
    try {
      const t0 = A.ctx.currentTime + (when || 0);
      const o = A.ctx.createOscillator();
      const g = A.ctx.createGain();
      o.type = type || 'sine';
      o.frequency.setValueAtTime(freq, t0);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
      g.gain.setValueAtTime(vol || 0.2, t0);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      o.connect(g);
      g.connect(A.master);
      o.start(t0);
      o.stop(t0 + dur + 0.05);
    } catch (e) {
      /* audio is best-effort */
    }
  }

  function noiseBurst(dur, vol, filterFreq, destination) {
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
      src.connect(f);
      f.connect(g);
      g.connect(destination || A.master);
      src.start(t0);
    } catch (e) {
      /* best-effort */
    }
  }

  function arpeggio(notes, noteDur, gap, type, vol) {
    notes.forEach((f, i) => tone(f, noteDur, type, vol, i * gap));
  }

  A.blip = function () { tone(880, 0.07, 'square', 0.08); };
  A.coin = function () { tone(988, 0.09, 'sine', 0.18); tone(1319, 0.16, 'sine', 0.18, 0.09); };
  A.punch = function () { noiseBurst(0.09, 0.35, 700); tone(120, 0.1, 'sine', 0.25, 0, 60); };
  A.missionDone = function () { arpeggio([523, 659, 784, 1047], 0.22, 0.13, 'triangle', 0.2); };
  A.busted = function () { arpeggio([392, 330, 262, 196], 0.3, 0.16, 'triangle', 0.2); };
  // Taxi fares: a bright two-note hail when a fare climbs in, a rising
  // five-note chime when the meter is paid, and a flat slide down when
  // the passenger bails.
  A.taxiPickup = function () { arpeggio([659, 880], 0.12, 0.1, 'triangle', 0.18); };
  A.taxiDropoff = function () { arpeggio([523, 659, 784, 1047, 1319], 0.14, 0.09, 'triangle', 0.18); };
  A.taxiCancel = function () { tone(220, 0.25, 'square', 0.12, 0, 160); };
  A.explosion = function () {
    noiseBurst(0.7, 0.6, 500);
    tone(90, 0.6, 'sine', 0.5, 0, 35);
  };

  const SHOT_SOUND = {
    shotgun: { noise: 0.22, noiseVol: 0.5, noiseFreq: 900, blip: 160, blipDur: 0.16, blipVol: 0.2, slide: 70 },
    rifle: { noise: 0.14, noiseVol: 0.42, noiseFreq: 2600, blip: 220, blipDur: 0.1, blipVol: 0.16, slide: 90 },
    smg: { noise: 0.07, noiseVol: 0.3, noiseFreq: 3200, blip: 300, blipDur: 0.05, blipVol: 0.12, slide: 140 },
    pistol: { noise: 0.1, noiseVol: 0.36, noiseFreq: 2400, blip: 260, blipDur: 0.08, blipVol: 0.15, slide: 110 },
  };

  A.shot = function (weaponId) {
    if (!A.ctx) return;
    const s = SHOT_SOUND[weaponId];
    if (!s) { A.punch(); return; }
    noiseBurst(s.noise, s.noiseVol, s.noiseFreq);
    tone(s.blip, s.blipDur, 'square', s.blipVol, 0, s.slide);
  };

  A.setEngine = function (speed01, inCar) {
    if (!A.ctx) return;
    try {
      const now = A.ctx.currentTime;
      const target = inCar ? 0.05 + speed01 * 0.1 : 0;
      const freq = 55 + speed01 * 130;
      A.engineGain.gain.setTargetAtTime(target, now, 0.1);
      A.engineOsc.frequency.setTargetAtTime(freq, now, 0.08);
      A.engineOsc2.frequency.setTargetAtTime(freq * 1.01 + 2, now, 0.08);
      A.engineFilter.frequency.setTargetAtTime(380 + speed01 * 900, now, 0.1);
    } catch (e) {
      /* best-effort */
    }
  };

  // Siren: schedule one full 8-step cycle (660/880 alternating, 0.45 s per
  // step), then re-schedule only when the cycle is over. Re-scheduling
  // every frame would pin the siren on its first note forever.
  A.sirenTick = function (wanted) {
    if (!A.ctx) return;
    if (wanted <= 0) {
      if (A.sirenTimer) {
        clearTimeout(A.sirenTimer);
        A.sirenTimer = null;
      }
      return;
    }
    if (A.sirenTimer) return;
    for (let i = 0; i < SIREN_STEPS; i++) {
      tone(SIREN_NOTES[i % 2], 0.42, 'sine', 0.055, (i * SIREN_STEP_MS) / 1000);
    }
    A.sirenTimer = setTimeout(() => {
      A.sirenTimer = null;
    }, SIREN_STEPS * SIREN_STEP_MS);
  };

  A.cycleStation = function () {
    A.station = (A.station + 1) % RADIO.length;
    A.blip();
    return RADIO[A.station];
  };

  // One sequencer voice: a short note on the radio bus.
  function radioNote(at, freq, dur, type, vol, wave) {
    const o = A.ctx.createOscillator();
    const g = A.ctx.createGain();
    o.type = type || wave;
    o.frequency.value = freq;
    g.gain.setValueAtTime(vol, at);
    g.gain.exponentialRampToValueAtTime(0.001, at + dur);
    o.connect(g);
    g.connect(A.radioGain);
    o.start(at);
    o.stop(at + dur);
  }

  function radioHat(at) {
    const len = Math.floor(A.ctx.sampleRate * 0.03);
    const buf = A.ctx.createBuffer(1, len, A.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const s = A.ctx.createBufferSource();
    s.buffer = buf;
    const f = A.ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 6000;
    const g = A.ctx.createGain();
    g.gain.value = 0.25;
    s.connect(f);
    f.connect(g);
    g.connect(A.radioGain);
    s.start(at);
  }

  // Radio sequencer: called every frame; schedules a little ahead.
  A.radioTick = function () {
    if (!A.ctx || !A.radioOn) return;
    try {
      const st = RADIO[A.station];
      const stepDur = 60 / st.bpm / 2; // eighth notes
      const scale = st.minor ? MINOR_SCALE : MAJOR_SCALE;
      while (A.seq.nextTime < A.ctx.currentTime + 0.18) {
        const at = A.seq.nextTime;
        const step = A.seq.step;
        const bar = Math.floor(step / 8) % 4;
        const root = st.root * (bar === 3 ? 0.89 : 1);
        // Bass on the beat.
        if (step % 2 === 0) {
          radioNote(at, root, stepDur * 2, st.wave, 0.5);
        }
        // Hat on off-beats (filtered noise, short).
        if (step % 2 === 1) radioHat(at);
        // Snare on beats 2 and 4.
        if (step % 8 === 4) noiseBurst(0.08, 0.12, 1800, A.radioGain);
        // Lead: a simple wandering line, one note per bar step.
        if (step % 2 === 0) {
          const deg = scale[(step * 3 + bar) % scale.length];
          const freq = root * 4 * Math.pow(2, deg / 12);
          radioNote(at, freq, stepDur * 1.8, 'sine', 0.12);
        }
        A.seq.step++;
        A.seq.nextTime += stepDur;
      }
    } catch (e) {
      /* best-effort */
    }
  };

  return A;
}
