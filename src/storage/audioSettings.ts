import { DEFAULT_MASTER_VOLUME } from '../audio/sounds'

const KEY = 'wall_run_switch_audio_settings'

export type AudioSettings = { muted: boolean; volume: number }

const DEFAULTS: AudioSettings = { muted: false, volume: DEFAULT_MASTER_VOLUME }

function clampVolume(n: number): number {
  if (!Number.isFinite(n)) return DEFAULT_MASTER_VOLUME
  return Math.min(1, Math.max(0, n))
}

export async function loadAudioSettings(): Promise<AudioSettings> {
  try {
    if (typeof window === 'undefined') return { ...DEFAULTS }
    const raw = window.localStorage.getItem(KEY)
    if (raw == null) return { ...DEFAULTS }
    const parsed = JSON.parse(raw) as Partial<AudioSettings>
    return {
      muted: Boolean(parsed.muted),
      volume: clampVolume(
        typeof parsed.volume === 'number' ? parsed.volume : DEFAULT_MASTER_VOLUME
      ),
    }
  } catch {
    return { ...DEFAULTS }
  }
}

export async function saveAudioSettings(settings: AudioSettings): Promise<void> {
  try {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(
      KEY,
      JSON.stringify({
        muted: Boolean(settings.muted),
        volume: clampVolume(settings.volume),
      })
    )
  } catch {
    /* ignore */
  }
}
