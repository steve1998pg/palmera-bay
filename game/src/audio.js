// Procedural audio: everything is synthesized with WebAudio — engine, sirens, gunfire,
// explosions, UI blips and three radio stations sequenced live. No audio files, no network.
import { STATIONS } from './config.js';

// One siren wail cycle: 8 alternating notes, 0.45 s apart.
const SIREN_NOTES = [660, 880];
const SIREN_STEP = 0.45;
const SIREN_CYCLE = SIREN_NOTES.length * 4 * SIREN_STEP;

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.station = 0;
    this.musicOn = true;
    this.step = 0;
    this.nextStepTime = 0;
    this.engineOsc = null;
    this.engineOsc2 = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.sirenUntil = 0;
    this.muted = false;
  }

  ensure() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.9;
    this.master.connect(this.ctx.destination);
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.16;
    this.musicGain.connect(this.master);
    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = 0.5;
    this.sfxGain.connect(this.master);
    // Engine hum: two detuned saws through a lowpass, pitch follows speed.
    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 55;
    const engineOsc2 = this.ctx.createOscillator();
    engineOsc2.type = 'sawtooth';
    engineOsc2.frequency.value = 55.5;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 420;
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0;
    this.engineOsc.connect(lp); engineOsc2.connect(lp);
    lp.connect(this.engineGain); this.engineGain.connect(this.master);
    this.engineOsc.start(); engineOsc2.start();
    this.engineOsc2 = engineOsc2;
    // Police siren: triangle sweeping between two notes.
    this.sirenOsc = this.ctx.createOscillator();
    this.sirenOsc.type = 'triangle';
    this.sirenOsc.frequency.value = 700;
    this.sirenGain = this.ctx.createGain();
    this.sirenGain.gain.value = 0;
    this.sirenOsc.connect(this.sirenGain); this.sirenGain.connect(this.master);
    this.sirenOsc.start();
    this.nextStepTime = this.ctx.currentTime + 0.1;
    this._scheduleLoop();
  }

  setEngine(speedNorm, on) {
    if (!this.ctx) return;
    const f = 48 + speedNorm * 130;
    this.engineOsc.frequency.setTargetAtTime(f, this.ctx.currentTime, 0.08);
    this.engineOsc2.frequency.setTargetAtTime(f * 1.01, this.ctx.currentTime, 0.08);
    this.engineGain.gain.setTargetAtTime(on ? 0.05 + speedNorm * 0.05 : 0, this.ctx.currentTime, 0.1);
  }

  setSiren(on, wanted) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.sirenGain.gain.setTargetAtTime(on ? 0.028 + wanted * 0.006 : 0, t, 0.3);
    if (!on) { this.sirenUntil = 0; return; }
    // Re-arm the wail only when the scheduled cycle has run out. The old code
    // cancelled and re-planned all 8 notes every frame, so the siren never got
    // past its first note and the scheduler did needless work 60× a second.
    if (t < this.sirenUntil) return;
    this.sirenOsc.frequency.cancelScheduledValues(t);
    this.sirenOsc.frequency.setValueAtTime(SIREN_NOTES[0], t);
    for (let i = 0; i < 8; i++) {
      this.sirenOsc.frequency.linearRampToValueAtTime(SIREN_NOTES[(i + 1) % 2], t + (i + 1) * SIREN_STEP);
    }
    this.sirenUntil = t + SIREN_CYCLE;
  }

  blip(freq = 880, dur = 0.07, type = 'square', vol = 0.12) {
    if (!this.ctx) return;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
    o.connect(g); g.connect(this.sfxGain);
    o.start(); o.stop(this.ctx.currentTime + dur + 0.02);
  }

  // White-noise burst that decays as (1 - t)^power — gunfire, hats, snares, blasts.
  _noiseBuffer(dur, power = 2) {
    const buf = this.ctx.createBuffer(1, Math.floor(this.ctx.sampleRate * dur), this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) ** power;
    return buf;
  }
  _playNoise(buf, filterType, filterFreq, vol, dest) {
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const f = this.ctx.createBiquadFilter(); f.type = filterType; f.frequency.value = filterFreq;
    const g = this.ctx.createGain(); g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(dest || this.sfxGain);
    return src;
  }

  shot(kind = 'pistol') {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const dur = kind === 'shotgun' ? 0.28 : kind === 'rifle' ? 0.22 : 0.12;
    const src = this._playNoise(
      this._noiseBuffer(dur),
      'lowpass', kind === 'rifle' ? 2600 : 1500,
      kind === 'shotgun' ? 0.5 : 0.32,
    );
    src.start(t);
    this.blip(kind === 'rifle' ? 220 : 160, 0.08, 'square', 0.1);
  }

  explosion() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, dur = 0.9;
    const src = this._playNoise(this._noiseBuffer(dur, 1.6), 'lowpass', 500, 0.8);
    src.start(t);
    const o = this.ctx.createOscillator(), og = this.ctx.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(90, t);
    o.frequency.exponentialRampToValueAtTime(28, t + 0.7);
    og.gain.setValueAtTime(0.5, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.8);
    o.connect(og); og.connect(this.sfxGain); o.start(t); o.stop(t + 0.85);
  }

  punch() { this.blip(140, 0.09, 'sine', 0.3); }
  coin() { this.blip(1320, 0.09, 'sine', 0.16); setTimeout(() => this.blip(1760, 0.14, 'sine', 0.16), 80); }
  missionDone() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this.blip(f, 0.22, 'triangle', 0.2), i * 110)); }
  busted() { [392, 330, 262, 196].forEach((f, i) => setTimeout(() => this.blip(f, 0.3, 'sawtooth', 0.14), i * 160)); }

  cycleStation() {
    this.station = (this.station + 1) % STATIONS.length;
    this.step = 0;
    return STATIONS[this.station];
  }
  currentStation() { return STATIONS[this.station]; }

  // Radio: a tiny step sequencer — bass line, hats and a lead on the station's scale.
  _scheduleLoop() {
    if (!this.ctx) return;
    const st = STATIONS[this.station];
    const stepDur = 60 / st.bpm / 2;
    while (this.nextStepTime < this.ctx.currentTime + 0.25) {
      if (this.musicOn && !this.muted) this._playStep(st, this.step, this.nextStepTime, stepDur);
      this.step = (this.step + 1) % 32;
      this.nextStepTime += stepDur;
    }
    setTimeout(() => this._scheduleLoop(), 90);
  }
  _note(freq, time, dur, type, vol, dest) {
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(0, time);
    g.gain.linearRampToValueAtTime(vol, time + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, time + dur);
    o.connect(g); g.connect(dest || this.musicGain);
    o.start(time); o.stop(time + dur + 0.05);
  }
  _playStep(st, step, time, stepDur) {
    const scale = st.minor ? [0, 2, 3, 5, 7, 8, 10] : [0, 2, 4, 5, 7, 9, 11];
    const bassNotes = [0, 0, 7, 5, 0, 0, 3, 5];
    const bar = Math.floor(step / 8);
    // Bass on beats 0 and 4 of each 8-step bar, root movement by bar.
    if (step % 8 === 0 || step % 8 === 4) {
      const deg = bassNotes[bar] || 0;
      this._note(st.root * Math.pow(2, deg / 12), time, stepDur * 3.4, st.wave, 0.5, this.musicGain);
    }
    // Hat tick every other step.
    if (step % 2 === 0) {
      const src = this._playNoise(this._noiseBuffer(0.03, 1), 'highpass', 6000, step % 4 === 0 ? 0.16 : 0.08, this.musicGain);
      src.start(time);
    }
    // Lead: a little melody on steps 0,3,6,7,10,14 of each 16.
    const leadSteps = { 0: 0, 3: 2, 6: 4, 7: 3, 10: 5, 14: 4 };
    if (step % 16 in leadSteps) {
      const deg = scale[leadSteps[step % 16] % scale.length] + 12;
      this._note(st.root * 4 * Math.pow(2, deg / 12), time, stepDur * 2.2, 'sine', 0.14, this.musicGain);
    }
    // Snare-ish noise on step 4 and 12.
    if (step % 16 === 4 || step % 16 === 12) {
      const src = this._playNoise(this._noiseBuffer(0.09, 1.5), 'bandpass', 1800, 0.2, this.musicGain);
      src.start(time);
    }
  }
}
