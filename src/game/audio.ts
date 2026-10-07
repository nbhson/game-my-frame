// ===== SFX dùng WebAudio, không cần asset ngoài =====
let ctx: AudioContext | null = null;
let enabled = true;

export function setSoundOn(v: boolean) { enabled = v; }
export function isSoundOn() { return enabled; }

function ac(): AudioContext | null {
  if (!ctx) {
    try { ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)(); }
    catch { return null; }
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function beep(freq = 440, dur = 0.12, type: OscillatorType = 'square', vol = 0.12, slide = 0) {
  if (!enabled) return;
  const c = ac(); if (!c) return;
  const o = c.createOscillator(), g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, c.currentTime);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), c.currentTime + dur);
  g.gain.setValueAtTime(vol, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
  o.connect(g); g.connect(c.destination);
  o.start(); o.stop(c.currentTime + dur);
}

const later = (fn: () => void, ms: number) => setTimeout(fn, ms);

export const sfx = {
  click() { beep(600, 0.07); },
  coin() { beep(900, 0.08); later(() => beep(1400, 0.12), 70); },
  plant() { beep(400, 0.1, 'triangle'); },
  water() { beep(500, 0.15, 'sine', 0.2, -200); },
  spray() { beep(1300, 0.15, 'sine', 0.14, -700); later(() => beep(1000, 0.15, 'sine', 0.1, -500), 130); },
  harvest() { [523, 659, 784, 1046].forEach((f, i) => later(() => beep(f, 0.12), i * 80)); },
  error() { beep(160, 0.2, 'sawtooth'); },
  eat() { beep(300, 0.08); later(() => beep(350, 0.08), 90); },
  splash() { beep(700, 0.2, 'sine', 0.2, -500); },
  catch_() { [400, 600, 900].forEach((f, i) => later(() => beep(f, 0.1), i * 90)); },
  lvup() { [523, 659, 784, 1046, 1318].forEach((f, i) => later(() => beep(f, 0.15), i * 100)); },
  moo() { beep(140, 0.4, 'sawtooth', 0.2, -40); },
  cluck() { beep(800, 0.06); later(() => beep(1000, 0.06), 70); },
};
