// Tiny WebAudio sound-effects synth — no audio assets required.
// Browser-only; every helper is a safe no-op when audio is unavailable.

let ctx: AudioContext | null = null
let muted = false
try {
  muted = localStorage.getItem('fad.sfx.muted') === '1'
} catch {
  muted = false
}

function ac(): AudioContext | null {
  if (muted) return null
  try {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return null
    if (!ctx) ctx = new Ctor()
    if (ctx.state === 'suspended') void ctx.resume()
    return ctx
  } catch {
    return null
  }
}

function tone(
  freq: number,
  dur: number,
  type: OscillatorType = 'square',
  gain = 0.06,
  when = 0,
  slideTo?: number,
): void {
  const c = ac()
  if (!c) return
  try {
    const t0 = c.currentTime + when
    const osc = c.createOscillator()
    const g = c.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freq, t0)
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur)
    g.gain.setValueAtTime(0.0001, t0)
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
    osc.connect(g)
    g.connect(c.destination)
    osc.start(t0)
    osc.stop(t0 + dur + 0.05)
  } catch {
    /* ignore audio errors */
  }
}

export const sfx = {
  click() {
    tone(620, 0.06, 'square', 0.035)
  },
  bid() {
    tone(420, 0.09, 'square', 0.05)
    tone(580, 0.13, 'square', 0.045, 0.07)
  },
  counter() {
    tone(300, 0.1, 'sawtooth', 0.04)
    tone(340, 0.12, 'sawtooth', 0.04, 0.08)
  },
  win() {
    ;[523, 659, 784, 1047].forEach((f, i) => tone(f, 0.16, 'triangle', 0.07, i * 0.09))
  },
  hidden() {
    tone(880, 0.16, 'sine', 0.055)
    tone(659, 0.22, 'sine', 0.05, 0.11)
  },
  whistle() {
    tone(2300, 0.22, 'square', 0.04)
    tone(2300, 0.32, 'square', 0.04, 0.26)
  },
  transfer() {
    tone(330, 0.08, 'triangle', 0.055)
    tone(460, 0.1, 'triangle', 0.055, 0.08)
  },
  coin() {
    tone(988, 0.09, 'triangle', 0.055)
    tone(1319, 0.2, 'triangle', 0.055, 0.06)
  },
  error() {
    tone(200, 0.18, 'sawtooth', 0.045)
  },
  setMuted(m: boolean) {
    muted = m
    try {
      localStorage.setItem('fad.sfx.muted', m ? '1' : '0')
    } catch {
      /* ignore */
    }
  },
  isMuted() {
    return muted
  },
}
