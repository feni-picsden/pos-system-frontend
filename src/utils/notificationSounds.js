// Notification sounds — reference parity (Shopfront art. 27155600466189):
// two distinct sounds, one for new notifications and one for errors, with the
// volume/mute controlled per device from the top-bar volume popover
// (localStorage `volumeSettings`, written by DashboardLayout).
//
// Tones are generated with WebAudio so no audio assets ship with the bundle.

let audioContext = null;

const getContext = () => {
  try {
    if (!audioContext) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      audioContext = new Ctx();
    }
    // Browsers suspend fresh contexts until a user gesture; resume is cheap.
    if (audioContext.state === 'suspended') audioContext.resume().catch(() => {});
    return audioContext;
  } catch {
    return null;
  }
};

// Effective output level: master × app slider, silent when either is muted.
const currentLevel = () => {
  try {
    const v = JSON.parse(localStorage.getItem('volumeSettings') || '{}');
    if (v.masterMuted || v.shopfrontMuted) return 0;
    const master = Number.isFinite(v.master) ? v.master : 100;
    const app = Number.isFinite(v.shopfront) ? v.shopfront : 100;
    return Math.max(0, Math.min(1, (master / 100) * (app / 100)));
  } catch {
    return 1;
  }
};

const tone = (ctx, { freq, at, duration, type = 'sine', peak }) => {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  // Short attack/decay envelope so the tones click-free.
  gain.gain.setValueAtTime(0, at);
  gain.gain.linearRampToValueAtTime(peak, at + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(at);
  osc.stop(at + duration + 0.02);
};

// New-notification chime: a quick rising two-note ping.
export const playNotificationSound = () => {
  const level = currentLevel();
  if (level <= 0) return;
  const ctx = getContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  tone(ctx, { freq: 880, at: now, duration: 0.12, peak: 0.18 * level });
  tone(ctx, { freq: 1318.5, at: now + 0.11, duration: 0.18, peak: 0.16 * level });
};

// Error buzz: a low double tone, clearly different from the chime.
export const playErrorSound = () => {
  const level = currentLevel();
  if (level <= 0) return;
  const ctx = getContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  tone(ctx, { freq: 233, at: now, duration: 0.14, type: 'square', peak: 0.1 * level });
  tone(ctx, { freq: 196, at: now + 0.16, duration: 0.2, type: 'square', peak: 0.1 * level });
};
