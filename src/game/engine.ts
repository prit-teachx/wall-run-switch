import {
  BASE_SPEED,
  CEILING_Y,
  COIN_POINTS,
  DEATH_HOLD_DURATION,
  DISTANCE_SCORE_RATE,
  FLOOR_Y,
  GAME_OVER_TIPS,
  GRAVITY,
  JUMP_VELOCITY,
  LANE_COUNT,
  LANE_POSITIONS,
  LANE_SWITCH_SPEED,
  MAX_SPEED,
  NEAR_MISS_COOLDOWN,
  NEAR_MISS_Z,
  OBSTACLE_TYPES,
  PLAYER_HALF,
  PLAYER_SIZE,
  SEGMENT_LENGTH,
  SEGMENTS_AHEAD,
  SEGMENTS_BEHIND,
  SPAWN_PROTECT_MS,
  SPEED_RAMP,
  START_LANE,
  SWITCH_BONUS,
  SWITCH_COOLDOWN,
  TETHER_DAMPING,
  TETHER_LENGTH,
  TETHER_STIFFNESS,
  type DeathCause,
  type GameStatus,
  type Surface,
} from './constants'
import {
  buildInitialSegments,
  createRunSeed,
  generateSegment,
  obstacleBounds,
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
  active: Surface
  switches: number
  lane: number
}

export type SnapshotListener = (snap: GameSnapshot) => void

export type GameEvent =
  | { type: 'coin' }
  | { type: 'nearMiss' }
  | { type: 'crash'; cause: DeathCause }
  | { type: 'jump'; surface: Surface }
  | { type: 'switch'; surface: Surface }
  | { type: 'runStart' }
  | { type: 'runStop' }

export type GameEventListener = (event: GameEvent) => void

/**
 * Link Twin ? dual tethered cubes on floor + ceiling.
 * Both must survive. Jump active twin; tether yanks the partner.
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

  lane = START_LANE
  playerZ = 0
  playerX = 0

  // Floor twin
  floorY: number = PLAYER_HALF
  floorVelY: number = 0
  floorGrounded = true

  // Ceiling twin
  ceilY: number = CEILING_Y - PLAYER_HALF
  ceilVelY: number = 0
  ceilGrounded = true

  active: Surface = 'floor'
  switches = 0
  switchCooldown = 0
  jumpQueued = false
  collectedCoins: CollectedMap = {}
  maxSegmentIndex = SEGMENTS_AHEAD
  solidsFloor = 99
  solidsCeil = 99
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
      active: this.active,
      switches: this.switches,
      lane: this.lane,
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
    this.solidsFloor = 99
    this.solidsCeil = 99
    for (const seg of this.segments) {
      this.solidsFloor = seg.hasGap ? 0 : this.solidsFloor + 1
      this.solidsCeil = seg.hasCeilingGap ? 0 : this.solidsCeil + 1
    }
    this.collectedCoins = {}
    this.lane = START_LANE
    this.playerZ = 0
    this.playerX = LANE_POSITIONS[START_LANE] ?? 0
    this.floorY = PLAYER_HALF
    this.floorVelY = 0
    this.floorGrounded = true
    this.ceilY = CEILING_Y - PLAYER_HALF
    this.ceilVelY = 0
    this.ceilGrounded = true
    this.active = 'floor'
    this.switches = 0
    this.switchCooldown = 0
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
    this.spawnProtectUntil = performance.now() + SPAWN_PROTECT_MS
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

  goLeft() {
    if (this.status !== 'playing') return
    this.lane = Math.max(0, this.lane - 1)
  }

  goRight() {
    if (this.status !== 'playing') return
    this.lane = Math.min(LANE_COUNT - 1, this.lane + 1)
  }

  switchActive() {
    if (this.status !== 'playing') return
    if (this.switchCooldown > 0) return
    this.active = this.active === 'floor' ? 'ceiling' : 'floor'
    this.switchCooldown = SWITCH_COOLDOWN
    this.switches += 1
    this.score += SWITCH_BONUS
    this.emitEvent({ type: 'switch', surface: this.active })
    this.emit(false)
  }

  requestJump() {
    if (this.status !== 'playing') return
    if (this.active === 'floor') {
      if (this.floorGrounded) {
        this.floorVelY = JUMP_VELOCITY
        this.floorGrounded = false
        this.jumpQueued = false
        this.emitEvent({ type: 'jump', surface: 'floor' })
        return
      }
    } else {
      if (this.ceilGrounded) {
        // Jump away from ceiling (down)
        this.ceilVelY = -JUMP_VELOCITY
        this.ceilGrounded = false
        this.jumpQueued = false
        this.emitEvent({ type: 'jump', surface: 'ceiling' })
        return
      }
    }
    this.jumpQueued = true
  }

  private recomputeScore() {
    const dist = Math.max(0, -this.playerZ)
    this.distance = dist
    this.score =
      dist * DISTANCE_SCORE_RATE +
      this.coins * COIN_POINTS +
      this.switches * SWITCH_BONUS
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
    this.floorVelY = 0
    this.ceilVelY = 0
    this.jumpQueued = false
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

  private intensity(index: number): number {
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
      const next = generateSegment(i, this.intensity(i), this.runSeed, {
        prev,
        solidsFloor: this.solidsFloor,
        solidsCeil: this.solidsCeil,
      })
      this.solidsFloor = next.hasGap ? 0 : this.solidsFloor + 1
      this.solidsCeil = next.hasCeilingGap ? 0 : this.solidsCeil + 1
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

  private overFloorGap(z: number, prevZ?: number) {
    for (const seg of this.segments) {
      if (!seg.hasGap) continue
      if (z <= seg.gapStart && z >= seg.gapEnd) return true
      if (prevZ !== undefined && prevZ > seg.gapStart && z < seg.gapEnd)
        return true
    }
    return false
  }

  private overCeilGap(z: number, prevZ?: number) {
    for (const seg of this.segments) {
      if (!seg.hasCeilingGap) continue
      if (z <= seg.ceilingGapStart && z >= seg.ceilingGapEnd) return true
      if (
        prevZ !== undefined &&
        prevZ > seg.ceilingGapStart &&
        z < seg.ceilingGapEnd
      )
        return true
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
    const steps = Math.max(1, Math.ceil(move / 0.28))
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

  /** Enforce soft tether spring between twins. */
  private applyTether(dt: number) {
    const dy = this.ceilY - this.floorY
    const dist = Math.abs(dy)
    if (dist <= TETHER_LENGTH) return

    const stretch = dist - TETHER_LENGTH
    const dir = dy > 0 ? 1 : -1
    // Force pulls floor up and ceiling down when overstretched
    const force = stretch * TETHER_STIFFNESS
    const relVel = this.ceilVelY - this.floorVelY
    const damp = relVel * TETHER_DAMPING

    const impulse = (force + damp) * dt
    this.floorVelY += impulse * dir * 0.5
    this.ceilVelY -= impulse * dir * 0.5

    // Hard clamp extreme stretch (safety)
    if (stretch > 1.8) {
      const mid = (this.floorY + this.ceilY) / 2
      const half = TETHER_LENGTH / 2
      this.floorY = mid - half
      this.ceilY = mid + half
      this.floorVelY *= 0.5
      this.ceilVelY *= 0.5
    }
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
    if (this.switchCooldown > 0)
      this.switchCooldown = Math.max(0, this.switchCooldown - dt)

    const prevX = this.playerX
    const prevFloorY = this.floorY
    const prevCeilY = this.ceilY
    const prevZ = this.playerZ

    // Shared lane X
    const targetX = LANE_POSITIONS[this.lane] ?? 0
    const dx = targetX - this.playerX
    if (Math.abs(dx) > 0.001) {
      this.playerX +=
        Math.sign(dx) * Math.min(Math.abs(dx), LANE_SWITCH_SPEED * dt)
    } else {
      this.playerX = targetX
    }

    this.playerZ -= this.speed * dt

    // Queued jumps
    if (this.jumpQueued) {
      if (this.active === 'floor' && this.floorGrounded) {
        this.floorVelY = JUMP_VELOCITY
        this.floorGrounded = false
        this.jumpQueued = false
        this.emitEvent({ type: 'jump', surface: 'floor' })
      } else if (this.active === 'ceiling' && this.ceilGrounded) {
        this.ceilVelY = -JUMP_VELOCITY
        this.ceilGrounded = false
        this.jumpQueued = false
        this.emitEvent({ type: 'jump', surface: 'ceiling' })
      }
    }

    // Gravity: floor pulls down (-), ceiling pulls up (+) when "grounded gravity"
    // Free fall for both: floorVel accelerates down, ceilVel accelerates up toward ceiling
    this.floorVelY -= GRAVITY * dt
    this.ceilVelY += GRAVITY * dt // toward +Y (ceiling)

    this.floorY += this.floorVelY * dt
    this.ceilY += this.ceilVelY * dt

    this.applyTether(dt)

    const floorContact = FLOOR_Y + PLAYER_HALF
    const ceilContact = CEILING_Y - PLAYER_HALF
    const floorGap = this.overFloorGap(this.playerZ, prevZ)
    const ceilGap = this.overCeilGap(this.playerZ, prevZ)

    this.floorGrounded = false
    this.ceilGrounded = false

    if (
      !floorGap &&
      this.floorY <= floorContact &&
      this.floorVelY <= 0 &&
      prevFloorY >= floorContact - 0.35
    ) {
      this.floorY = floorContact
      this.floorVelY = 0
      this.floorGrounded = true
    }

    if (
      !ceilGap &&
      this.ceilY >= ceilContact &&
      this.ceilVelY >= 0 &&
      prevCeilY <= ceilContact + 0.35
    ) {
      this.ceilY = ceilContact
      this.ceilVelY = 0
      this.ceilGrounded = true
    }

    // Prevent twins from passing through each other
    if (this.ceilY - this.floorY < PLAYER_SIZE * 0.95) {
      const mid = (this.floorY + this.ceilY) / 2
      this.floorY = mid - PLAYER_SIZE * 0.48
      this.ceilY = mid + PLAYER_SIZE * 0.48
      if (this.floorVelY > 0) this.floorVelY *= 0.3
      if (this.ceilVelY < 0) this.ceilVelY *= 0.3
    }

    // Void deaths
    if (this.floorY < FLOOR_Y - 2.4) this.beginDeath('gap')
    if (this.ceilY > CEILING_Y + 2.4) this.beginDeath('gap')

    const px = this.playerX
    const pz = this.playerZ
    const ph = PLAYER_SIZE * 0.92

    if (this.status === 'playing') {
      outer: for (const seg of this.segments) {
        for (const c of seg.coins) {
          if (this.collectedCoins[c.id]) continue
          const cx = LANE_POSITIONS[c.lane] ?? 0
          const twinY = c.surface === 'floor' ? this.floorY : this.ceilY
          const prevTwinY = c.surface === 'floor' ? prevFloorY : prevCeilY
          if (
            this.swept(
              prevX,
              prevTwinY,
              prevZ,
              px,
              twinY,
              pz,
              ph,
              ph,
              ph,
              cx,
              c.y,
              c.z,
              0.65,
              0.65,
              0.65
            )
          ) {
            this.collectCoin(c.id)
          }
        }

        for (const o of seg.obstacles) {
          const b = obstacleBounds(o.type, o.surface)
          const ox = LANE_POSITIONS[o.lane] ?? 0
          const twinY = o.surface === 'floor' ? this.floorY : this.ceilY
          const prevTwinY = o.surface === 'floor' ? prevFloorY : prevCeilY
          if (
            this.swept(
              prevX,
              prevTwinY,
              prevZ,
              px,
              twinY,
              pz,
              ph,
              ph,
              ph,
              ox,
              b.y,
              o.z,
              b.w,
              b.h,
              b.d
            )
          ) {
            // Barrier clear if twin jumped high enough past it
            if (o.type === OBSTACLE_TYPES.BARRIER) {
              if (o.surface === 'floor' && twinY > b.y + b.h * 0.45) continue
              if (o.surface === 'ceiling' && twinY < b.y - b.h * 0.45) continue
            }
            const cause: DeathCause =
              o.type === OBSTACLE_TYPES.BARRIER ? 'barrier' : 'wall'
            this.beginDeath(cause)
            break outer
          }
        }
      }

      if (this.status === 'playing' && this.nearMissCooldown <= 0) {
        for (const seg of this.segments) {
          for (const o of seg.obstacles) {
            if (this.nearMissSeen.has(o.id)) continue
            if (!(prevZ > o.z && pz <= o.z + NEAR_MISS_Z)) continue
            const twinY = o.surface === 'floor' ? this.floorY : this.ceilY
            const oy = obstacleBounds(o.type, o.surface).y
            if (Math.abs(twinY - oy) < 1.1) {
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
