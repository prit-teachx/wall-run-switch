import {
  BASE_SPEED,
  COIN_POINTS,
  DEATH_HOLD_DURATION,
  DISTANCE_SCORE_RATE,
  FLIP_BONUS_POINTS,
  FLIP_COOLDOWN,
  FLIP_DURATION,
  GAME_OVER_TIPS,
  GRAVITY,
  HEIGHT_LANES,
  HEIGHT_POSITIONS,
  HEIGHT_SWITCH_SPEED,
  JUMP_VELOCITY,
  MAX_SPEED,
  NEAR_MISS_COOLDOWN,
  NEAR_MISS_Z,
  OBSTACLE_TYPES,
  PLAYER_SIZE,
  SEGMENT_LENGTH,
  SEGMENTS_AHEAD,
  SEGMENTS_BEHIND,
  SPAWN_PROTECT,
  SPEED_RAMP,
  START_HEIGHT,
  WALL_X,
  type DeathCause,
  type GameStatus,
  type WallSide,
} from './constants'
import {
  buildInitialSegments,
  createRunSeed,
  generateSegment,
  obstacleHalfExtents,
  type SegmentData,
} from './segments'

export type CollectedMap = Record<string, true>

export interface GameSnapshot {
  status: GameStatus
  score: number
  coins: number
  distance: number
  highScore: number
  isNewHighScore: boolean
  runId: number
  deathCause: DeathCause | null
  scoreDeltaToBest: number
  tipIndex: number
  wall: WallSide
  heightLane: number
  flips: number
  flipT: number
}

export type SnapshotListener = (snap: GameSnapshot) => void

export type GameEvent =
  | { type: 'coin' }
  | { type: 'nearMiss' }
  | { type: 'crash'; cause: DeathCause }
  | { type: 'flip' }
  | { type: 'jump' }
  | { type: 'runStart' }
  | { type: 'runStop' }

export type GameEventListener = (event: GameEvent) => void

/**
 * Pure Wall Run Switch simulation.
 * Player sticks to left/right wall; flip crosses the corridor.
 * Height lanes 0..2 on the wall; jump clears barriers.
 */
export class GameEngine {
  status: GameStatus = 'start'
  score = 0
  coins = 0
  distance = 0
  highScore = 0
  isNewHighScore = false
  runId = 0
  runSeed = createRunSeed()
  segments: SegmentData[] = buildInitialSegments(SEGMENTS_AHEAD, this.runSeed)
  speed = BASE_SPEED

  playerZ: number = 0
  /** World X; ?WALL_X when grounded on a wall. */
  playerX: number = -WALL_X
  /** World Y height on wall. */
  playerY: number = HEIGHT_POSITIONS[START_HEIGHT]!
  wall: WallSide = 'left'
  heightLane = START_HEIGHT
  velY: number = 0
  grounded = true
  flips = 0
  flipCooldown = 0
  /** 0 = not flipping; 0..1 during flip. */
  flipT: number = 0
  flipFromX: number = 0
  flipToX: number = 0
  jumpQueued = false
  collectedCoins: CollectedMap = {}
  maxSegmentIndex = SEGMENTS_AHEAD
  solidsLeft = 99
  solidsRight = 99
  spawnProtectUntil = 0

  deathCause: DeathCause | null = null
  deathHoldLeft = 0
  tipIndex = 0
  private highScoreAtRunStart = 0
  private nearMissCooldown = 0
  private nearMissSeen = new Set<string>()

  private listeners = new Set<SnapshotListener>()
  private eventListeners = new Set<GameEventListener>()
  private lastEmit = 0

  onChange(fn: SnapshotListener) {
    this.listeners.add(fn)
    fn(this.snapshot())
    return () => {
      this.listeners.delete(fn)
    }
  }

  onEvent(fn: GameEventListener) {
    this.eventListeners.add(fn)
    return () => {
      this.eventListeners.delete(fn)
    }
  }

  private emitEvent(event: GameEvent) {
    for (const fn of this.eventListeners) fn(event)
  }

  setHighScore(value: number) {
    this.highScore = Math.max(0, Math.floor(value))
    this.emit(true)
  }

  snapshot(): GameSnapshot {
    const prevBest = this.highScoreAtRunStart || this.highScore
    return {
      status: this.status,
      score: this.score,
      coins: this.coins,
      distance: this.distance,
      highScore: this.highScore,
      isNewHighScore: this.isNewHighScore,
      runId: this.runId,
      deathCause: this.deathCause,
      scoreDeltaToBest: Math.floor(this.score) - prevBest,
      tipIndex: this.tipIndex,
      wall: this.wall,
      heightLane: this.heightLane,
      flips: this.flips,
      flipT: this.flipT,
    }
  }

  private emit(force = false) {
    const now = Date.now()
    if (
      !force &&
      (this.status === 'playing' || this.status === 'dying') &&
      now - this.lastEmit < 80
    ) {
      return
    }
    this.lastEmit = now
    for (const fn of this.listeners) fn(this.snapshot())
  }

  resetRun() {
    const seed = createRunSeed()
    this.runSeed = seed
    this.maxSegmentIndex = SEGMENTS_AHEAD
    this.segments = buildInitialSegments(SEGMENTS_AHEAD, seed)
    this.solidsLeft = 99
    this.solidsRight = 99
    for (const seg of this.segments) {
      this.solidsLeft = seg.hasLeftGap ? 0 : this.solidsLeft + 1
      this.solidsRight = seg.hasRightGap ? 0 : this.solidsRight + 1
    }
    this.collectedCoins = {}
    this.wall = 'left'
    this.heightLane = START_HEIGHT
    this.playerZ = 0
    this.playerX = -WALL_X
    this.playerY = HEIGHT_POSITIONS[START_HEIGHT]!
    this.velY = 0
    this.grounded = true
    this.flips = 0
    this.flipCooldown = 0
    this.flipT = 0
    this.jumpQueued = false
    this.score = 0
    this.coins = 0
    this.distance = 0
    this.speed = BASE_SPEED
    this.isNewHighScore = false
    this.deathCause = null
    this.deathHoldLeft = 0
    this.highScoreAtRunStart = this.highScore
    this.tipIndex = this.runId % GAME_OVER_TIPS.length
    this.spawnProtectUntil = performance.now() + SPAWN_PROTECT * 1000
    this.nearMissCooldown = 0
    this.nearMissSeen.clear()
    this.runId += 1
  }

  startGame() {
    if (this.status === 'playing' || this.status === 'dying') return
    this.resetRun()
    this.status = 'playing'
    this.emitEvent({ type: 'runStart' })
    this.emit(true)
  }

  pauseGame() {
    if (this.status === 'playing') {
      this.status = 'paused'
      this.emitEvent({ type: 'runStop' })
      this.emit(true)
    }
  }

  resumeGame() {
    if (this.status === 'paused') {
      this.status = 'playing'
      this.emitEvent({ type: 'runStart' })
      this.emit(true)
    }
  }

  togglePause() {
    if (this.status === 'playing') this.pauseGame()
    else if (this.status === 'paused') this.resumeGame()
  }

  goUp() {
    if (this.status !== 'playing' || this.flipT > 0) return
    this.heightLane = Math.min(HEIGHT_LANES - 1, this.heightLane + 1)
  }

  goDown() {
    if (this.status !== 'playing' || this.flipT > 0) return
    this.heightLane = Math.max(0, this.heightLane - 1)
  }

  requestJump() {
    if (this.status !== 'playing' || this.flipT > 0) return
    if (this.grounded) {
      this.velY = JUMP_VELOCITY
      this.grounded = false
      this.jumpQueued = false
      this.emitEvent({ type: 'jump' })
      return
    }
    this.jumpQueued = true
  }

  requestFlip() {
    if (this.status !== 'playing') return
    if (this.flipCooldown > 0 || this.flipT > 0) return

    const next: WallSide = this.wall === 'left' ? 'right' : 'left'
    this.flipFromX = this.playerX
    this.flipToX = next === 'left' ? -WALL_X : WALL_X
    this.wall = next
    this.flipT = 0.001
    this.grounded = false
    this.jumpQueued = false
    this.velY = 0
    this.flipCooldown = FLIP_COOLDOWN
    this.flips += 1
    this.score += FLIP_BONUS_POINTS
    this.emitEvent({ type: 'flip' })
    this.emit(false)
  }

  private recomputeScore() {
    const dist = Math.max(0, -this.playerZ)
    this.distance = dist
    this.score =
      dist * DISTANCE_SCORE_RATE +
      this.coins * COIN_POINTS +
      this.flips * FLIP_BONUS_POINTS
  }

  private collectCoin(id: string) {
    if (this.status !== 'playing') return
    if (this.collectedCoins[id]) return
    this.collectedCoins = { ...this.collectedCoins, [id]: true }
    this.coins = Object.keys(this.collectedCoins).length
    this.recomputeScore()
    this.emitEvent({ type: 'coin' })
  }

  private beginDeath(cause: DeathCause) {
    if (this.status !== 'playing') return
    if (performance.now() < this.spawnProtectUntil) return
    this.status = 'dying'
    this.deathCause = cause
    this.deathHoldLeft = DEATH_HOLD_DURATION
    this.velY = 0
    this.jumpQueued = false
    this.flipT = 0
    this.recomputeScore()
    this.score = Math.floor(this.score)
    this.emitEvent({ type: 'crash', cause })
    this.emitEvent({ type: 'runStop' })
    this.emit(true)
  }

  private finalizeGameOver() {
    if (this.status !== 'dying') return
    this.status = 'gameover'
    const final = Math.floor(this.score)
    this.score = final
    if (final > this.highScore) {
      this.highScore = final
      this.isNewHighScore = true
    }
    this.tipIndex = this.runId % GAME_OVER_TIPS.length
    this.emit(true)
  }

  private intensityForSegment(index: number): number {
    if (index < 2) return 0
    const base = Math.min(1, (index - 2) / 48)
    const wave = 0.5 + 0.5 * Math.sin((index / 8) * Math.PI * 2)
    const calm = index % 10 >= 7
    if (calm) return Math.min(1, base * 0.32 + 0.05)
    return Math.min(1, base * (0.5 + 0.5 * wave) + wave * 0.08)
  }

  private tickWorld() {
    this.recomputeScore()
    this.speed = Math.min(MAX_SPEED, BASE_SPEED + this.distance * SPEED_RAMP)
    const playerSegment = Math.floor(this.distance / SEGMENT_LENGTH)
    const needUntil = playerSegment + SEGMENTS_AHEAD
    let segs = this.segments
    let changed = false

    if (needUntil > this.maxSegmentIndex) {
      const i = this.maxSegmentIndex + 1
      const prev = segs.length ? segs[segs.length - 1]! : null
      const next = generateSegment(i, this.intensityForSegment(i), this.runSeed, {
        prev,
        solidsLeft: this.solidsLeft,
        solidsRight: this.solidsRight,
      })
      this.solidsLeft = next.hasLeftGap ? 0 : this.solidsLeft + 1
      this.solidsRight = next.hasRightGap ? 0 : this.solidsRight + 1
      segs = segs.concat(next)
      this.maxSegmentIndex = i
      changed = true
    }

    const minKeep = playerSegment - SEGMENTS_BEHIND
    if (segs.length > 0 && segs[0]!.index < minKeep) {
      segs = segs.slice(1)
      changed = true
    }
    if (changed) this.segments = segs
  }

  private overGap(wall: WallSide, z: number, prevZ?: number): boolean {
    for (const seg of this.segments) {
      if (wall === 'left' && seg.hasLeftGap) {
        if (z <= seg.leftGapStart && z >= seg.leftGapEnd) return true
        if (
          prevZ !== undefined &&
          prevZ > seg.leftGapStart &&
          z < seg.leftGapEnd
        )
          return true
      }
      if (wall === 'right' && seg.hasRightGap) {
        if (z <= seg.rightGapStart && z >= seg.rightGapEnd) return true
        if (
          prevZ !== undefined &&
          prevZ > seg.rightGapStart &&
          z < seg.rightGapEnd
        )
          return true
      }
    }
    return false
  }

  private aabb(
    ax: number,
    ay: number,
    az: number,
    aw: number,
    ah: number,
    ad: number,
    bx: number,
    by: number,
    bz: number,
    bw: number,
    bh: number,
    bd: number
  ) {
    return (
      Math.abs(ax - bx) < (aw + bw) / 2 &&
      Math.abs(ay - by) < (ah + bh) / 2 &&
      Math.abs(az - bz) < (ad + bd) / 2
    )
  }

  private swept(
    x0: number,
    y0: number,
    z0: number,
    x1: number,
    y1: number,
    z1: number,
    pw: number,
    ph: number,
    pd: number,
    bx: number,
    by: number,
    bz: number,
    bw: number,
    bh: number,
    bd: number
  ) {
    const move = Math.max(
      Math.abs(x1 - x0),
      Math.abs(y1 - y0),
      Math.abs(z1 - z0)
    )
    const steps = Math.max(1, Math.ceil(move / 0.25))
    for (let i = 0; i <= steps; i++) {
      const t = i / steps
      if (
        this.aabb(
          x0 + (x1 - x0) * t,
          y0 + (y1 - y0) * t,
          z0 + (z1 - z0) * t,
          pw,
          ph,
          pd,
          bx,
          by,
          bz,
          bw,
          bh,
          bd
        )
      )
        return true
    }
    return false
  }

  tick(delta: number) {
    const dt = Math.min(delta, 0.05)

    if (this.status === 'dying') {
      this.deathHoldLeft -= dt
      if (this.deathHoldLeft <= 0) this.finalizeGameOver()
      else this.emit(false)
      return true
    }

    if (this.status !== 'playing') {
      return (['playing', 'paused', 'dying'] as GameStatus[]).includes(
        this.status
      )
    }

    if (this.nearMissCooldown > 0)
      this.nearMissCooldown = Math.max(0, this.nearMissCooldown - dt)
    if (this.flipCooldown > 0)
      this.flipCooldown = Math.max(0, this.flipCooldown - dt)

    const prevX = this.playerX
    const prevY = this.playerY
    const prevZ = this.playerZ

    // Flip arc across corridor
    if (this.flipT > 0) {
      this.flipT += dt / FLIP_DURATION
      const t = Math.min(1, this.flipT)
      // Smoothstep
      const s = t * t * (3 - 2 * t)
      this.playerX = this.flipFromX + (this.flipToX - this.flipFromX) * s
      // Slight hop during flip
      const hop = Math.sin(t * Math.PI) * 0.35
      const targetY = HEIGHT_POSITIONS[this.heightLane] ?? 0
      this.playerY = targetY + hop
      this.playerZ -= this.speed * dt

      if (t >= 1) {
        this.flipT = 0
        this.playerX = this.flipToX
        this.playerY = targetY
        this.grounded = true
        this.velY = 0
      }
    } else {
      // Height lane lerp
      const targetY = HEIGHT_POSITIONS[this.heightLane] ?? 0
      const dy = targetY - this.playerY
      // Only snap height when grounded-ish; during jump add vel
      if (this.jumpQueued && this.grounded) {
        this.velY = JUMP_VELOCITY
        this.grounded = false
        this.jumpQueued = false
        this.emitEvent({ type: 'jump' })
      }

      this.velY -= GRAVITY * dt
      let nextY = this.playerY + this.velY * dt

      // Ground = height lane plane when not over gap
      const gap = this.overGap(this.wall, this.playerZ, prevZ)
      if (!gap && nextY <= targetY && this.velY <= 0) {
        nextY = targetY
        this.velY = 0
        this.grounded = true
      } else {
        this.grounded = false
      }

      // Soft pull toward lane when grounded
      if (this.grounded) {
        if (Math.abs(dy) > 0.001) {
          this.playerY +=
            Math.sign(dy) * Math.min(Math.abs(dy), HEIGHT_SWITCH_SPEED * dt)
        } else {
          this.playerY = targetY
        }
      } else {
        this.playerY = nextY
      }

      this.playerX = this.wall === 'left' ? -WALL_X : WALL_X
      this.playerZ -= this.speed * dt

      // Fall into gap void (drop below lane range)
      if (gap && this.playerY < (HEIGHT_POSITIONS[0] ?? -1) - 1.2) {
        this.beginDeath('gap')
      }
      if (this.playerY < -4) this.beginDeath('gap')
    }

    const px = this.playerX
    const py = this.playerY
    const pz = this.playerZ
    const ph = PLAYER_SIZE * 0.9
    const flipping = this.flipT > 0

    if (this.status === 'playing') {
      outer: for (const seg of this.segments) {
        for (const c of seg.coins) {
          if (this.collectedCoins[c.id]) continue
          // Only collect coins on same wall unless mid-flip near center
          const cx = c.wall === 'left' ? -WALL_X : WALL_X
          const cy = HEIGHT_POSITIONS[c.height] ?? 0
          const wallOk =
            flipping ||
            c.wall === this.wall ||
            Math.abs(px - cx) < WALL_X * 0.55
          if (!wallOk) continue
          if (
            this.swept(
              prevX,
              prevY,
              prevZ,
              px,
              py,
              pz,
              ph,
              ph,
              ph,
              cx,
              cy,
              c.z,
              0.55,
              0.55,
              0.55
            )
          ) {
            this.collectCoin(c.id)
          }
        }

        for (const o of seg.obstacles) {
          // Only collide with obstacles on the wall we're attached to
          // (mid-flip: collide if close to that wall's X)
          const ox = o.wall === 'left' ? -WALL_X : WALL_X
          const oy = HEIGHT_POSITIONS[o.height] ?? 0
          const ext = obstacleHalfExtents(o.type)
          const onWall =
            flipping
              ? Math.abs(px - ox) < WALL_X * 0.55
              : o.wall === this.wall
          if (!onWall) continue

          // Barriers only hit near ground of that height (jump clears)
          // Walls hit at height regardless of jump if same height lane nearby
          if (
            this.swept(
              prevX,
              prevY,
              prevZ,
              px,
              py,
              pz,
              ph,
              ph,
              ph,
              ox,
              oy,
              o.z,
              0.7,
              ext.h * 2,
              ext.d * 2
            )
          ) {
            // Jump clear for barriers: player above obstacle center enough
            if (
              o.type === OBSTACLE_TYPES.BARRIER &&
              py > oy + ext.h * 0.55
            ) {
              continue
            }
            const cause: DeathCause =
              o.type === OBSTACLE_TYPES.BARRIER ? 'barrier' : 'wall'
            this.beginDeath(cause)
            break outer
          }
        }
      }

      // Near-miss
      if (this.status === 'playing' && this.nearMissCooldown <= 0 && !flipping) {
        for (const seg of this.segments) {
          for (const o of seg.obstacles) {
            if (o.wall !== this.wall) continue
            if (this.nearMissSeen.has(o.id)) continue
            if (!(prevZ > o.z && pz <= o.z + NEAR_MISS_Z)) continue
            const oy = HEIGHT_POSITIONS[o.height] ?? 0
            if (Math.abs(py - oy) < 0.95) {
              this.nearMissSeen.add(o.id)
              this.nearMissCooldown = NEAR_MISS_COOLDOWN
              this.emitEvent({ type: 'nearMiss' })
              break
            }
          }
        }
      }
    }

    if (this.status === 'playing') {
      this.tickWorld()
      this.emit(false)
    }

    return (['playing', 'paused', 'dying'] as GameStatus[]).includes(
      this.status
    )
  }
}
