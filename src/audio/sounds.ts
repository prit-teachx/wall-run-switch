export type GameSfx =
  | 'jump'
  | 'switch'
  | 'coin'
  | 'crash'
  | 'nearMiss'
  | 'tether'

export const DEFAULT_MASTER_VOLUME = 0.85
export const VOLUME_STEP = 0.1

type OscType = OscillatorType

class SoundManager {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private muted = false
  private masterVolume = DEFAULT_MASTER_VOLUME
  private unlocked = false
  private runWanted = false
  private listeners = new Set<() => void>()

  onChange(cb: () => void): () => void {
    this.listeners.add(cb)
    return () => {
      this.listeners.delete(cb)
    }
  }
  private notify() {
    for (const fn of this.listeners) fn()
  }
  getMuted() {
    return this.muted
  }
  getVolume() {
    return this.masterVolume
  }
  setMuted(m: boolean) {
    this.muted = m
    this.applyGain()
    this.notify()
  }
  setVolume(v: number) {
    this.masterVolume = Math.max(0, Math.min(1, v))
    this.applyGain()
    this.notify()
  }
  toggleMute() {
    this.setMuted(!this.muted)
  }
  private applyGain() {
    if (!this.master) return
    this.master.gain.value = this.muted ? 0 : this.masterVolume
  }
  async load(): Promise<void> {}
  async unlock(): Promise<void> {
    if (typeof window === 'undefined') return
    if (!this.ctx) {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext
      if (!AC) return
      this.ctx = new AC()
      this.master = this.ctx.createGain()
      this.master.connect(this.ctx.destination)
      this.applyGain()
    }
    if (this.ctx.state === 'suspended') await this.ctx.resume().catch(() => {})
    this.unlocked = true
  }
  dispose() {
    this.stopRun()
    if (this.ctx) void this.ctx.close().catch(() => {})
    this.ctx = null
    this.master = null
    this.unlocked = false
  }
  startRun() {
    this.runWanted = true
  }
  stopRun() {
    this.runWanted = false
  }
  play(sfx: GameSfx) {
    if (!this.unlocked || this.muted || !this.ctx || !this.master) return
    switch (sfx) {
      case 'jump':
        this.blip(300, 0.05, 'triangle', 0.09)
        this.blip(480, 0.06, 'triangle', 0.07, 0.03)
        break
      case 'switch':
        this.blip(520, 0.04, 'square', 0.09)
        this.blip(360, 0.05, 'square', 0.07, 0.03)
        break
      case 'coin':
        this.blip(880, 0.05, 'sine', 0.1)
        this.blip(1180, 0.06, 'sine', 0.07, 0.04)
        break
      case 'nearMiss':
        this.blip(220, 0.04, 'sawtooth', 0.05)
        break
      case 'tether':
        this.blip(180, 0.08, 'sine', 0.05)
        break
      case 'crash':
        this.noiseBurst(0.18, 0.22)
        this.blip(100, 0.2, 'sawtooth', 0.18)
        break
    }
  }
  private blip(
    freq: number,
    dur: number,
    type: OscType,
    gain: number,
    delay = 0
  ) {
    const ctx = this.ctx
    const master = this.master
    if (!ctx || !master) return
    const t0 = ctx.currentTime + delay
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freq, t0)
    g.gain.setValueAtTime(0.0001, t0)
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
    osc.connect(g)
    g.connect(master)
    osc.start(t0)
    osc.stop(t0 + dur + 0.02)
  }
  private noiseBurst(dur: number, gain: number) {
    const ctx = this.ctx
    const master = this.master
    if (!ctx || !master) return
    const n = Math.floor(ctx.sampleRate * dur)
    const buffer = ctx.createBuffer(1, n, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / n)
    const src = ctx.createBufferSource()
    src.buffer = buffer
    const g = ctx.createGain()
    g.gain.value = gain
    src.connect(g)
    g.connect(master)
    src.start()
  }
}

export const sounds = new SoundManager()
