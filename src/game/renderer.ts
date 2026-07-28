import {
  COLORS,
  HEIGHT_POSITIONS,
  OBSTACLE_TYPES,
  WALL_X,
} from './constants'
import type { GameEngine } from './engine'
import type { SegmentData } from './segments'

type Particle = {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  color: string
  size: number
}

/**
 * Canvas 2D neon corridor ? behind the player looking down the run.
 * Left wall cyan, right wall magenta; player sticks to a wall.
 */
export class WallRenderer {
  private w = 1
  private h = 1
  private dpr = 1
  private particles: Particle[] = []
  private stars: { x: number; y: number; z: number; s: number }[] = []

  constructor(private ctx: CanvasRenderingContext2D) {
    for (let i = 0; i < 70; i++) {
      this.stars.push({
        x: Math.random() * 2 - 1,
        y: Math.random() * 2 - 1,
        z: Math.random(),
        s: 0.4 + Math.random() * 1.2,
      })
    }
  }

  setSize(cssW: number, cssH: number, dpr: number) {
    this.w = Math.max(1, cssW)
    this.h = Math.max(1, cssH)
    this.dpr = dpr
  }

  dispose() {
    this.particles = []
  }

  /** Project world (x,y,z relative to player) to screen. */
  private project(
    wx: number,
    wy: number,
    wz: number,
    cx: number,
    cy: number
  ) {
    // Player at z=0; world z is more negative ahead
    const depth = Math.max(0.08, -wz)
    const f = 220 / (depth + 4)
    return {
      x: cx + wx * f * 48,
      y: cy - wy * f * 42,
      s: f,
      alpha: Math.max(0.08, Math.min(1, 1.15 - depth / 55)),
    }
  }

  draw(engine: GameEngine, dt: number) {
    const ctx = this.ctx
    const w = this.w
    const h = this.h
    const cx = w * 0.5
    const cy = h * 0.48

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    ctx.fillStyle = COLORS.bg
    ctx.fillRect(0, 0, w, h)

    const playing =
      engine.status === 'playing' ||
      engine.status === 'dying' ||
      engine.status === 'paused'

    // Vignette tint by wall
    const onLeft = engine.wall === 'left'
    ctx.save()
    ctx.globalAlpha = 0.06
    ctx.fillStyle = onLeft ? COLORS.leftEdge : COLORS.rightEdge
    ctx.fillRect(0, 0, w, h)
    ctx.restore()

    this.drawStars(cx, cy, w, h, engine.speed, dt)
    this.drawCorridorShell(cx, cy, engine)

    // Segments: floor strip + wall panels + hazards
    const segs = [...engine.segments].sort((a, b) => a.index - b.index)
    for (const seg of segs) {
      this.drawSegment(seg, engine, cx, cy)
    }

    this.drawPlayer(engine, cx, cy)

    if (engine.status === 'dying') {
      ctx.save()
      ctx.globalAlpha = 0.22
      ctx.fillStyle = COLORS.danger
      ctx.fillRect(0, 0, w, h)
      ctx.restore()
    }

    this.updateParticles(dt)
    this.drawParticles()

    const grad = ctx.createLinearGradient(0, h * 0.72, 0, h)
    grad.addColorStop(0, 'rgba(6,5,16,0)')
    grad.addColorStop(1, 'rgba(6,5,16,0.6)')
    ctx.fillStyle = grad
    ctx.fillRect(0, h * 0.72, w, h * 0.28)

    if (!playing && engine.status === 'start') {
      this.drawAttract(cx, cy, performance.now() / 1000)
    }
  }

  burst(x: number, y: number, color: string, count = 12) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2
      const sp = 50 + Math.random() * 140
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 0.3 + Math.random() * 0.35,
        maxLife: 0.65,
        color,
        size: 2 + Math.random() * 3,
      })
    }
  }

  private drawStars(
    cx: number,
    cy: number,
    w: number,
    h: number,
    speed: number,
    dt: number
  ) {
    const ctx = this.ctx
    for (const s of this.stars) {
      s.z += dt * (0.12 + speed * 0.008)
      if (s.z > 1) {
        s.z = 0
        s.x = Math.random() * 2 - 1
        s.y = Math.random() * 2 - 1
      }
      const sc = 0.12 + s.z * s.z
      ctx.globalAlpha = 0.2 + s.z * 0.5
      ctx.fillStyle = COLORS.white
      ctx.fillRect(
        cx + s.x * w * 0.4 * sc,
        cy + s.y * h * 0.35 * sc,
        s.s,
        s.s
      )
    }
    ctx.globalAlpha = 1
  }

  private drawCorridorShell(cx: number, cy: number, engine: GameEngine) {
    const ctx = this.ctx
    // Floor vanishing wedge
    ctx.save()
    ctx.beginPath()
    ctx.moveTo(cx - 20, cy + this.h * 0.35)
    ctx.lineTo(cx + 20, cy + this.h * 0.35)
    ctx.lineTo(cx + 8, cy + 10)
    ctx.lineTo(cx - 8, cy + 10)
    ctx.closePath()
    ctx.fillStyle = '#0a0a18'
    ctx.globalAlpha = 0.9
    ctx.fill()
    ctx.restore()

    // Horizon glow
    ctx.save()
    const g = ctx.createRadialGradient(cx, cy, 4, cx, cy, this.w * 0.25)
    g.addColorStop(0, engine.wall === 'left' ? '#00f0ff22' : '#ff00aa22')
    g.addColorStop(1, 'transparent')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, this.w, this.h)
    ctx.restore()
  }

  private drawSegment(
    seg: SegmentData,
    engine: GameEngine,
    cx: number,
    cy: number
  ) {
    const ctx = this.ctx
    const pz = engine.playerZ
    const steps = 6
    for (let i = 0; i < steps; i++) {
      const z0 = seg.zBase - (SEGMENT_FRAC(i, steps)) * 22
      const z1 = seg.zBase - (SEGMENT_FRAC(i + 1, steps)) * 22
      const rel0 = z0 - pz
      const rel1 = z1 - pz
      if (rel0 > 8 || rel1 < -70) continue

      // Left wall panel
      this.drawWallPanel(cx, cy, -WALL_X, rel0, rel1, true, seg.hasLeftGap, z0, seg)
      // Right wall panel
      this.drawWallPanel(cx, cy, WALL_X, rel0, rel1, false, seg.hasRightGap, z0, seg)
    }

    // Gaps overlays
    if (seg.hasLeftGap) {
      this.drawGapMark(cx, cy, -WALL_X, seg.leftGapStart - pz, seg.leftGapEnd - pz, true)
    }
    if (seg.hasRightGap) {
      this.drawGapMark(cx, cy, WALL_X, seg.rightGapStart - pz, seg.rightGapEnd - pz, false)
    }

    for (const o of seg.obstacles) {
      const relZ = o.z - pz
      if (relZ > 6 || relZ < -65) continue
      const ox = o.wall === 'left' ? -WALL_X : WALL_X
      const oy = HEIGHT_POSITIONS[o.height] ?? 0
      const p = this.project(ox, oy, relZ, cx, cy)
      const isBar = o.type === OBSTACLE_TYPES.BARRIER
      const bw = 10 * p.s * (isBar ? 0.7 : 1)
      const bh = 14 * p.s * (isBar ? 0.55 : 1.15)
      ctx.save()
      ctx.globalAlpha = p.alpha
      ctx.fillStyle = isBar ? COLORS.barrier : COLORS.wall
      ctx.shadowColor = isBar ? COLORS.barrier : COLORS.wall
      ctx.shadowBlur = 8 * p.s
      // Stick out from wall toward center
      const inset = o.wall === 'left' ? bw * 0.6 : -bw * 0.6
      ctx.fillRect(p.x + inset - bw / 2, p.y - bh / 2, bw, bh)
      ctx.restore()
    }

    for (const c of seg.coins) {
      if (engine.collectedCoins[c.id]) continue
      const relZ = c.z - pz
      if (relZ > 6 || relZ < -65) continue
      const ox = c.wall === 'left' ? -WALL_X : WALL_X
      const oy = HEIGHT_POSITIONS[c.height] ?? 0
      const p = this.project(ox * 0.92, oy, relZ, cx, cy)
      ctx.save()
      ctx.globalAlpha = p.alpha
      ctx.fillStyle = COLORS.coin
      ctx.shadowColor = COLORS.coin
      ctx.shadowBlur = 10
      ctx.beginPath()
      ctx.arc(p.x, p.y, 5 * p.s, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    }
  }

  private drawWallPanel(
    cx: number,
    cy: number,
    wallX: number,
    rel0: number,
    rel1: number,
    left: boolean,
    _hasGap: boolean,
    zWorld: number,
    seg: SegmentData
  ) {
    // Skip panel slice if fully in gap region
    if (left && seg.hasLeftGap) {
      if (zWorld <= seg.leftGapStart && zWorld >= seg.leftGapEnd) return
    }
    if (!left && seg.hasRightGap) {
      if (zWorld <= seg.rightGapStart && zWorld >= seg.rightGapEnd) return
    }

    const ctx = this.ctx
    const top = 1.8
    const bot = -1.8
    const a = this.project(wallX, top, rel0, cx, cy)
    const b = this.project(wallX, bot, rel0, cx, cy)
    const c = this.project(wallX, bot, rel1, cx, cy)
    const d = this.project(wallX, top, rel1, cx, cy)
    if (a.s < 0.05) return

    ctx.save()
    ctx.beginPath()
    ctx.moveTo(a.x, a.y)
    ctx.lineTo(b.x, b.y)
    ctx.lineTo(c.x, c.y)
    ctx.lineTo(d.x, d.y)
    ctx.closePath()
    ctx.globalAlpha = Math.min(a.alpha, c.alpha) * 0.55
    ctx.fillStyle = left ? COLORS.leftWall : COLORS.rightWall
    ctx.fill()
    ctx.strokeStyle = left ? COLORS.leftEdge : COLORS.rightEdge
    ctx.globalAlpha = Math.min(a.alpha, c.alpha) * 0.45
    ctx.lineWidth = 1.2
    ctx.stroke()

    // Height lane ticks
    for (const hy of HEIGHT_POSITIONS) {
      const p0 = this.project(wallX, hy, rel0, cx, cy)
      const p1 = this.project(wallX, hy, rel1, cx, cy)
      ctx.globalAlpha = 0.15 * a.alpha
      ctx.beginPath()
      ctx.moveTo(p0.x, p0.y)
      ctx.lineTo(p1.x, p1.y)
      ctx.stroke()
    }
    ctx.restore()
  }

  private drawGapMark(
    cx: number,
    cy: number,
    wallX: number,
    relStart: number,
    relEnd: number,
    left: boolean
  ) {
    const ctx = this.ctx
    const top = 1.9
    const bot = -1.9
    const a = this.project(wallX, top, relStart, cx, cy)
    const b = this.project(wallX, bot, relStart, cx, cy)
    const c = this.project(wallX, bot, relEnd, cx, cy)
    const d = this.project(wallX, top, relEnd, cx, cy)
    ctx.save()
    ctx.beginPath()
    ctx.moveTo(a.x, a.y)
    ctx.lineTo(b.x, b.y)
    ctx.lineTo(c.x, c.y)
    ctx.lineTo(d.x, d.y)
    ctx.closePath()
    ctx.globalAlpha = 0.65
    ctx.fillStyle = COLORS.gap
    ctx.fill()
    ctx.strokeStyle = left ? COLORS.rightEdge : COLORS.leftEdge
    ctx.lineWidth = 2
    ctx.stroke()
    ctx.restore()
  }

  private drawPlayer(engine: GameEngine, cx: number, cy: number) {
    const ctx = this.ctx
    // Player world relative to self: x offset from center, y height, z=0
    const p = this.project(engine.playerX, engine.playerY, 0.01, cx, cy)
    const size = 16 * p.s
    const col =
      engine.wall === 'left' || engine.flipT > 0
        ? engine.playerX < 0
          ? COLORS.player
          : COLORS.playerRight
        : COLORS.playerRight

    ctx.save()
    ctx.globalAlpha = 1
    ctx.fillStyle = col
    ctx.shadowColor = col
    ctx.shadowBlur = 16 + (engine.flipT > 0 ? 20 : 0)
    ctx.translate(p.x, p.y)
    if (engine.flipT > 0) {
      ctx.rotate(engine.flipT * Math.PI)
    }
    ctx.fillRect(-size / 2, -size / 2, size, size)
    // Inner face
    ctx.fillStyle = '#ffffff44'
    ctx.fillRect(-size * 0.2, -size * 0.2, size * 0.4, size * 0.4)
    ctx.restore()

    // Wall attachment glow
    ctx.save()
    ctx.globalAlpha = 0.35
    ctx.strokeStyle = col
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(p.x, p.y, size * 0.9, 0, Math.PI * 2)
    ctx.stroke()
    ctx.restore()
  }

  private drawAttract(cx: number, cy: number, t: number) {
    const engLike = {
      playerZ: -t * 8,
      playerX: Math.sin(t) > 0 ? WALL_X : -WALL_X,
      playerY: HEIGHT_POSITIONS[1]!,
      wall: Math.sin(t) > 0 ? 'right' : 'left',
      flipT: 0,
      status: 'start' as const,
      speed: 22,
      segments: [] as SegmentData[],
      collectedCoins: {},
    }
    // Simple spinning player
    void engLike
    const face = Math.sin(t * 2)
    const px = face > 0 ? WALL_X * 0.9 : -WALL_X * 0.9
    const p = this.project(px, Math.sin(t * 3) * 0.4, 0.01, cx, cy)
    const ctx = this.ctx
    ctx.save()
    ctx.fillStyle = face > 0 ? COLORS.playerRight : COLORS.player
    ctx.shadowColor = ctx.fillStyle as string
    ctx.shadowBlur = 18
    const s = 18
    ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s)
    ctx.restore()

    // Fake approaching hazards
    for (let i = 0; i < 4; i++) {
      const z = -8 - ((t * 12 + i * 14) % 50)
      const left = i % 2 === 0
      const p2 = this.project(left ? -WALL_X : WALL_X, HEIGHT_POSITIONS[i % 3]!, z, cx, cy)
      ctx.save()
      ctx.globalAlpha = p2.alpha
      ctx.fillStyle = i % 3 === 0 ? COLORS.barrier : COLORS.wall
      ctx.fillRect(p2.x - 6 * p2.s, p2.y - 10 * p2.s, 12 * p2.s, 16 * p2.s)
      ctx.restore()
    }
  }

  private updateParticles(dt: number) {
    for (const p of this.particles) {
      p.life -= dt
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.vx *= 0.96
      p.vy *= 0.96
    }
    this.particles = this.particles.filter((p) => p.life > 0)
  }

  private drawParticles() {
    const ctx = this.ctx
    for (const p of this.particles) {
      ctx.save()
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife)
      ctx.fillStyle = p.color
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    }
  }
}

function SEGMENT_FRAC(i: number, steps: number) {
  return i / steps
}
