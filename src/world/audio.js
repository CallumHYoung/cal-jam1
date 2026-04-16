let ctx = null;
let master = null;

function ensureCtx() {
  if (ctx) return ctx;
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  master = ctx.createGain();
  master.gain.value = 0.55;
  master.connect(ctx.destination);
  return ctx;
}

export function unlockAudio() {
  const c = ensureCtx();
  if (c.state === 'suspended') c.resume().catch(() => {});
}

export function playGunshot(kind = 'rifle') {
  const c = ensureCtx();
  const now = c.currentTime;
  const osc = c.createOscillator();
  const gain = c.createGain();
  const noise = c.createBufferSource();
  const nGain = c.createGain();
  const bp = c.createBiquadFilter();
  bp.type = 'bandpass';

  const buf = c.createBuffer(1, 2048, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 2);
  noise.buffer = buf;

  const profile = {
    pistol:  { osc: 260, sweep: 60,  dur: 0.09, nGain: 0.4, bp: 1800 },
    heavy:   { osc: 180, sweep: 40,  dur: 0.16, nGain: 0.55, bp: 1200 },
    smg:     { osc: 300, sweep: 80,  dur: 0.06, nGain: 0.35, bp: 2200 },
    rifle:   { osc: 220, sweep: 50,  dur: 0.11, nGain: 0.5, bp: 1600 },
    sniper:  { osc: 120, sweep: 30,  dur: 0.28, nGain: 0.7, bp: 900 },
  }[kind] || { osc: 220, sweep: 50, dur: 0.11, nGain: 0.5, bp: 1600 };

  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(profile.osc, now);
  osc.frequency.exponentialRampToValueAtTime(profile.sweep, now + profile.dur);
  gain.gain.setValueAtTime(0.45, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + profile.dur);

  bp.frequency.value = profile.bp;
  nGain.gain.setValueAtTime(profile.nGain, now);
  nGain.gain.exponentialRampToValueAtTime(0.001, now + profile.dur);

  osc.connect(gain).connect(master);
  noise.connect(bp).connect(nGain).connect(master);

  osc.start(now); osc.stop(now + profile.dur + 0.02);
  noise.start(now); noise.stop(now + profile.dur + 0.02);
}

export function playHitMarker(headshot = false) {
  const c = ensureCtx();
  const now = c.currentTime;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(headshot ? 1200 : 820, now);
  g.gain.setValueAtTime(0.3, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
  osc.connect(g).connect(master);
  osc.start(now); osc.stop(now + 0.13);
}

export function playReload() {
  const c = ensureCtx();
  const now = c.currentTime;
  for (let i = 0; i < 3; i++) {
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = 'square';
    osc.frequency.value = 180 + i * 40;
    const t = now + i * 0.08;
    g.gain.setValueAtTime(0.0, t);
    g.gain.linearRampToValueAtTime(0.18, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    osc.connect(g).connect(master);
    osc.start(t); osc.stop(t + 0.07);
  }
}

export function playBuy() {
  const c = ensureCtx();
  const now = c.currentTime;
  [660, 880].forEach((f, i) => {
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = 'triangle';
    osc.frequency.value = f;
    const t = now + i * 0.07;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.25, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    osc.connect(g).connect(master);
    osc.start(t); osc.stop(t + 0.14);
  });
}

export function playExplosion() {
  const c = ensureCtx();
  const now = c.currentTime;
  const noise = c.createBufferSource();
  const buf = c.createBuffer(1, 8192, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 1.4);
  noise.buffer = buf;
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(1200, now);
  lp.frequency.exponentialRampToValueAtTime(250, now + 0.5);
  const g = c.createGain();
  g.gain.setValueAtTime(0.7, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
  noise.connect(lp).connect(g).connect(master);
  noise.start(now); noise.stop(now + 0.6);
}

export function playRoundWin() {
  const c = ensureCtx();
  const now = c.currentTime;
  [523, 659, 784, 1046].forEach((f, i) => {
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = 'triangle';
    osc.frequency.value = f;
    const t = now + i * 0.1;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.3, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    osc.connect(g).connect(master);
    osc.start(t); osc.stop(t + 0.27);
  });
}

export function playRoundLose() {
  const c = ensureCtx();
  const now = c.currentTime;
  [330, 262, 220].forEach((f, i) => {
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = 'sawtooth';
    osc.frequency.value = f;
    const t = now + i * 0.13;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.22, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    osc.connect(g).connect(master);
    osc.start(t); osc.stop(t + 0.32);
  });
}

export function playDeath() {
  const c = ensureCtx();
  const now = c.currentTime;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(440, now);
  osc.frequency.exponentialRampToValueAtTime(80, now + 0.7);
  g.gain.setValueAtTime(0.25, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.75);
  osc.connect(g).connect(master);
  osc.start(now); osc.stop(now + 0.8);
}

export function playAbility() {
  const c = ensureCtx();
  const now = c.currentTime;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(440, now);
  osc.frequency.exponentialRampToValueAtTime(1320, now + 0.25);
  g.gain.setValueAtTime(0.3, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
  osc.connect(g).connect(master);
  osc.start(now); osc.stop(now + 0.32);
}
