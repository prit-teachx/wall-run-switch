import {
  COLORS,
  LANE_POSITIONS,
  OBSTACLE_TYPES,
  TUNNEL_HEIGHT,
} from './constants'
import type { GameEngine } from './engine'
import type { SegmentData } from './segments'
import { obstacleBounds } from './segments'

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
 * Canvas 2D ? looking down the corridor at dual tethered twins.
 */
export class TwinRenderer {
  private w = 1
  private h = 1
  private dpr = 1
  private particles: Particle[] = []
  private stars: { x: number; y: number; z: number; s: number }[] = []

  constructor(private ctx: CanvasRenderingContext2D) {
    for (let i = 0; i < 80; i++) {
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

  private project(wx: number, wy: number, wz: number, cx: number, cy: number) {
    const depth = Math.max(0.08, -wz)
    const f = 200 / (depth + 3.8)
    // Map world Y (0..TUNNEL) to centered vertical
    const yN = (wy - TUNNEL_HEIGHT * 0.5) / (TUNNEL_HEIGHT * 0.5)
    return {
      x: cx + wx * f * 42,
      y: cy - yN * f * 38,
      s: f,
      alpha: Math.max(0.1, Math.min(1, 1.1 - depth / 52)),
    }
  }

  draw(engine: GameEngine, dt: number) {
    const ctx = this.ctx
    const w = this.w
    const h = this.h
    const cx = w * 0.5
    const cy = h * 0.46

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    ctx.fillStyle = COLORS.bg
    ctx.fillRect(0, 0, w, h)

    const playing =
      engine.status === 'playing' ||
      engine.status === 'dying' ||
      engine.status === 'paused'

    // Active tint
    ctx.save()
    ctx.globalAlpha = 0.05
    ctx.fillStyle =
      engine.active === 'floor' ? COLORS.floorEdge : COLORS.ceilingEdge
    ctx.fillRect(0, 0, w, h)
    ctx.restore()

    this.drawStars(cx, cy, w, h, engine.speed, dt)
    this.drawTunnelGuide(cx, cy, engine)

    const segs = [...engine.segments].sort((a, b) => a.index - b.index)
    for (const seg of segs) {
      this.drawSegment(seg, engine, cx, cy)
    }

    this.drawTether(engine, cx, cy)
    this.drawTwin(engine, 'floor', cx, cy)
    this.drawTwin(engine, 'ceiling', cx, cy)

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
    grad.addColorStop(0, 'rgba(5,5,18,0)')
    grad.addColorStop(1, 'rgba(5,5,18,0.58)')
    ctx.fillStyle = grad
    ctx.fillRect(0, h * 0.72, w, h * 0.28)

    if (!playing && engine.status === 'start') {
      this.drawAttract(cx, cy, performance.now() / 1000)
    }
  }

  burst(x: number, y: number, color: string, count = 12) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2
      const sp = 40 + Math.random() * 150
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
      ctx.fillRect(cx + s.x * w * 0.42 * sc, cy + s.y * h * 0.32 * sc, s.s, s.s)
    }
    ctx.globalAlpha = 1
  }

  private drawTunnelGuide(cx: number, cy: number, engine: GameEngine) {
    const ctx = this.ctx
    // Floor + ceiling receding rails
    for (let i = 0; i < 8; i++) {
      const z = -i * 7
      const pf = this.project(0, 0, z, cx, cy)
      const pc = this.project(0, TUNNEL_HEIGHT, z, cx, cy)
      ctx.save()
      ctx.globalAlpha = pf.alpha * 0.25
      ctx.strokeStyle = COLORS.floorEdge
      ctx.lineWidth = 1
      const hw = 3.2 * pf.s * 42
      ctx.strokeRect(cx - hw, pf.y - 2, hw * 2, 4)
      ctx.strokeStyle = COLORS.ceilingEdge
      ctx.strokeRect(cx - hw, pc.y - 2, hw * 2, 4)
      ctx.restore()
    }
    // Horizon pulse
    ctx.save()
    const g = ctx.createRadialGradient(cx, cy, 2, cx, cy, this.w * 0.22)
    g.addColorStop(
      0,
      engine.active === 'floor' ? '#00f0ff18' : '#c44dff18'
    )
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

    // Floor / ceiling slabs (simplified)
    const midZ = seg.zBase - 12 - pz
    if (midZ < 8 && midZ > -70) {
      if (!seg.hasGap) {
        const p = this.project(0, 0, midZ, cx, cy)
        ctx.save()
        ctx.globalAlpha = p.alpha * 0.35
        ctx.fillStyle = COLORS.floor
        const hw = 3.3 * p.s * 42
        ctx.fillRect(cx - hw, p.y - 3 * p.s, hw * 2, 6 * p.s)
        ctx.restore()
      } else {
        this.drawGapBand(cx, cy, seg.gapStart - pz, seg.gapEnd - pz, 0, COLORS.floorEdge)
      }
      if (!seg.hasCeilingGap) {
        const p = this.project(0, TUNNEL_HEIGHT, midZ, cx, cy)
        ctx.save()
        ctx.globalAlpha = p.alpha * 0.35
        ctx.fillStyle = COLORS.ceiling
        const hw = 3.3 * p.s * 42
        ctx.fillRect(cx - hw, p.y - 3 * p.s, hw * 2, 6 * p.s)
        ctx.restore()
      } else {
        this.drawGapBand(
          cx,
          cy,
          seg.ceilingGapStart - pz,
          seg.ceilingGapEnd - pz,
          TUNNEL_HEIGHT,
          COLORS.ceilingEdge
        )
      }
    }

    for (const o of seg.obstacles) {
      const relZ = o.z - pz
      if (relZ > 6 || relZ < -65) continue
      const b = obstacleBounds(o.type, o.surface)
      const ox = LANE_POSITIONS[o.lane] ?? 0
      const p = this.project(ox, b.y, relZ, cx, cy)
      const isBar = o.type === OBSTACLE_TYPES.BARRIER
      const bw = (isBar ? 14 : 16) * p.s
      const bh = (isBar ? 10 : 22) * p.s
      ctx.save()
      ctx.globalAlpha = p.alpha
      ctx.fillStyle = isBar ? COLORS.barrier : COLORS.wall
      ctx.shadowColor = ctx.fillStyle as string
      ctx.shadowBlur = 10 * p.s
      ctx.fillRect(p.x - bw / 2, p.y - bh / 2, bw, bh)
      ctx.restore()
    }

    for (const c of seg.coins) {
      if (engine.collectedCoins[c.id]) continue
      const relZ = c.z - pz
      if (relZ > 6 || relZ < -65) continue
      const ox = LANE_POSITIONS[c.lane] ?? 0
      const p = this.project(ox, c.y, relZ, cx, cy)
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

  private drawGapBand(
    cx: number,
    cy: number,
    relStart: number,
    relEnd: number,
    y: number,
    edge: string
  ) {
    const ctx = this.ctx
    const a = this.project(0, y, relStart, cx, cy)
    const b = this.project(0, y, relEnd, cx, cy)
    const hw = 3.4 * Math.max(a.s, b.s) * 42
    ctx.save()
    ctx.globalAlpha = 0.55
    ctx.fillStyle = '#020208'
    const top = Math.min(a.y, b.y) - 4
    const bot = Math.max(a.y, b.y) + 4
    ctx.fillRect(cx - hw, top, hw * 2, bot - top)
    ctx.strokeStyle = edge
    ctx.lineWidth = 2
    ctx.strokeRect(cx - hw, top, hw * 2, bot - top)
    ctx.restore()
  }

  private drawTether(engine: GameEngine, cx: number, cy: number) {
    const ctx = this.ctx
    const a = this.project(engine.playerX, engine.floorY, 0.02, cx, cy)
    const b = this.project(engine.playerX, engine.ceilY, 0.02, cx, cy)
    ctx.save()
    ctx.strokeStyle = COLORS.tether
    ctx.globalAlpha = 0.85
    ctx.lineWidth = 2.5
    ctx.shadowColor = COLORS.tether
    ctx.shadowBlur = 12
    ctx.beginPath()
    ctx.moveTo(a.x, a.y)
    // slight curve
    const mx = (a.x + b.x) / 2 + Math.sin(performance.now() * 0.008) * 4
    const my = (a.y + b.y) / 2
    ctx.quadraticCurveTo(mx, my, b.x, b.y)
    ctx.stroke()
    // energy pips along tether
    for (let i = 1; i < 4; i++) {
      const t = i / 4
      const px = a.x + (b.x - a.x) * t
      const py = a.y + (b.y - a.y) * t
      ctx.fillStyle = COLORS.white
      ctx.globalAlpha = 0.5
      ctx.beginPath()
      ctx.arc(px, py, 2, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.restore()
  }

  private drawTwin(
    engine: GameEngine,
    which: 'floor' | 'ceiling',
    cx: number,
    cy: number
  ) {
    const ctx = this.ctx
    const y = which === 'floor' ? engine.floorY : engine.ceilY
    const p = this.project(engine.playerX, y, 0.02, cx, cy)
    const size = 15 * p.s
    const active = engine.active === which
    const col =
      which === 'floor' ? COLORS.floorPlayer : COLORS.ceilingPlayer

    ctx.save()
    if (active) {
      ctx.strokeStyle = COLORS.activeRing
      ctx.globalAlpha = 0.7
      ctx.lineWidth = 2
      ctx.shadowColor = col
      ctx.shadowBlur = 18
      ctx.strokeRect(p.x - size * 0.7, p.y - size * 0.7, size * 1.4, size * 1.4)
    }
    ctx.globalAlpha = active ? 1 : 0.72
    ctx.fillStyle = col
    ctx.shadowColor = col
    ctx.shadowBlur = active ? 16 : 8
    ctx.fillRect(p.x - size / 2, p.y - size / 2, size, size)
    ctx.fillStyle = '#ffffff55'
    ctx.fillRect(p.x - size * 0.18, p.y - size * 0.18, size * 0.36, size * 0.36)
    ctx.restore()
  }

  private drawAttract(cx: number, cy: number, t: number) {
    const ctx = this.ctx
    const floorY = 0.5 + Math.abs(Math.sin(t * 2)) * 1.2
    const ceilY = TUNNEL_HEIGHT - 0.5 - Math.abs(Math.sin(t * 2 + 0.4)) * 1.0
    const x = Math.sin(t * 0.8) * 1.2
    const a = this.project(x, floorY, 0.02, cx, cy)
    const b = this.project(x, ceilY, 0.02, cx, cy)
    ctx.save()
    ctx.strokeStyle = COLORS.tether
    ctx.lineWidth = 2
    ctx.shadowColor = COLORS.tether
    ctx.shadowBlur = 10
    ctx.beginPath()
    ctx.moveTo(a.x, a.y)
    ctx.lineTo(b.x, b.y)
    ctx.stroke()
    ctx.fillStyle = COLORS.floorPlayer
    ctx.fillRect(a.x - 8, a.y - 8, 16, 16)
    ctx.fillStyle = COLORS.ceilingPlayer
    ctx.fillRect(b.x - 8, b.y - 8, 16, 16)
    ctx.restore()
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
