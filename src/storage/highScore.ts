const KEY = 'link_twin_high_score'

export async function loadHighScore(): Promise<number> {
  try {
    if (typeof window === 'undefined') return 0
    const raw = window.localStorage.getItem(KEY)
    if (raw == null) return 0
    const n = Number(raw)
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0
  } catch {
    return 0
  }
}

export async function saveHighScore(score: number): Promise<void> {
  try {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(KEY, String(Math.max(0, Math.floor(score))))
  } catch {
    /* ignore */
  }
}
