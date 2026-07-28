import {
  BASE_SPEED,
  GRAVITY,
  HEIGHT_LANES,
  JUMP_VELOCITY,
  OBSTACLE_TYPES,
  SEGMENT_LENGTH,
  type ObstacleType,
  type WallSide,
} from './constants'

export interface ObstacleData {
  id: string
  type: ObstacleType
  wall: WallSide
  /** Height lane 0..2 */
  height: number
  z: number
}

export interface CoinData {
  id: string
  wall: WallSide
  height: number
  z: number
}

export interface SegmentData {
  id: string
  index: number
  zBase: number
  hasLeftGap: boolean
  hasRightGap: boolean
  leftGapStart: number
  leftGapEnd: number
  rightGapStart: number
  rightGapEnd: number
  obstacles: ObstacleData[]
  coins: CoinData[]
}

export function createRunSeed(): number {
  return (Math.random() * 0xffffffff) >>> 0
}

function makeRand(runSeed: number, index: number) {
  let s =
    (runSeed ^ Math.imul(index + 1, 374761393) ^ 0x9e3779b9) >>> 0
  s = Math.imul(s ^ (s >>> 16), 0x85ebca6b) >>> 0
  s = Math.imul(s ^ (s >>> 13), 0xc2b2ae35) >>> 0
  s = (s ^ (s >>> 16)) >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function shuffleInPlace<T>(arr: T[], rand: () => number): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

function jumpAirTime(): number {
  return (2 * JUMP_VELOCITY) / GRAVITY
}

function maxSafeGapLength(): number {
  const jumpDist = BASE_SPEED * jumpAirTime()
  return Math.min(SEGMENT_LENGTH * 0.36, jumpDist * 0.42)
}

const MIN_GAP_PAD = 5.2
const MIN_SOLID_BETWEEN = 2
const POST_GAP_CLEAR = 0.4

export type SegCtx = {
  prev?: SegmentData | null
  solidsLeft?: number
  solidsRight?: number
}

function placeGap(zBase: number, rand: () => number) {
  const gapLen = maxSafeGapLength() * (0.85 + rand() * 0.15)
  const usable = SEGMENT_LENGTH - gapLen
  const front = Math.max(
    MIN_GAP_PAD,
    Math.min(usable - MIN_GAP_PAD, MIN_GAP_PAD + rand() * 2)
  )
  const back = usable - front
  if (back < MIN_GAP_PAD) {
    const safe = Math.min(gapLen, SEGMENT_LENGTH - 2 * MIN_GAP_PAD)
    const gapStart = zBase - MIN_GAP_PAD
    return { gapStart, gapEnd: gapStart - safe }
  }
  const gapStart = zBase - front
  return { gapStart, gapEnd: gapStart - gapLen }
}

export function generateSegment(
  index: number,
  difficulty = 0,
  runSeed = 0,
  ctx: SegCtx = {}
): SegmentData {
  const rand = makeRand(runSeed, index)
  const zBase = -index * SEGMENT_LENGTH
  const isStart = index < 2
  const prev = ctx.prev ?? null
  const solidsLeft = ctx.solidsLeft ?? (prev ? (prev.hasLeftGap ? 0 : 99) : 99)
  const solidsRight =
    ctx.solidsRight ?? (prev ? (prev.hasRightGap ? 0 : 99) : 99)

  const gapChance = 0.05 + difficulty * 0.1
  const hasLeftGap =
    !isStart &&
    solidsLeft >= MIN_SOLID_BETWEEN &&
    !prev?.hasLeftGap &&
    rand() < gapChance
  // Never both walls gapped same segment early; rare later
  const hasRightGap =
    !isStart &&
    solidsRight >= MIN_SOLID_BETWEEN &&
    !prev?.hasRightGap &&
    !hasLeftGap &&
    difficulty > 0.12 &&
    rand() < gapChance * 0.95

  let leftGapStart = zBase
  let leftGapEnd = zBase
  let rightGapStart = zBase
  let rightGapEnd = zBase
  if (hasLeftGap) {
    const g = placeGap(zBase, rand)
    leftGapStart = g.gapStart
    leftGapEnd = g.gapEnd
  }
  if (hasRightGap) {
    const g = placeGap(zBase, rand)
    rightGapStart = g.gapStart
    rightGapEnd = g.gapEnd
  }

  const obstacles: ObstacleData[] = []
  const coins: CoinData[] = []
  const open =
    !isStart &&
    !hasLeftGap &&
    !hasRightGap &&
    difficulty < 0.2 &&
    rand() < 0.4

  if (!isStart && !open) {
    const justLeft = !!prev?.hasLeftGap
    const justRight = !!prev?.hasRightGap
    const minZ = justLeft || justRight ? POST_GAP_CLEAR : 0.28
    const slots = shuffleInPlace(
      [0.38, 0.55, 0.72].filter((s) => s >= minZ + 0.02),
      rand
    )
    if (slots.length === 0) slots.push(0.65)

    const walls: WallSide[] =
      difficulty < 0.22
        ? rand() < 0.5
          ? ['left']
          : ['right']
        : rand() < 0.38
          ? ['left']
          : rand() < 0.72
            ? ['right']
            : ['left', 'right']

    for (const wall of walls) {
      // Max 2 of 3 heights blocked
      const count = rand() < 0.2 + difficulty * 0.35 ? 2 : 1
      const heights = shuffleInPlace([0, 1, 2], rand)
      for (let i = 0; i < count; i++) {
        const type: ObstacleType =
          rand() < 0.4 ? OBSTACLE_TYPES.BARRIER : OBSTACLE_TYPES.WALL
        const zT = slots[i % slots.length]! + (rand() - 0.5) * 0.04
        const zOff = -SEGMENT_LENGTH * Math.min(0.88, Math.max(minZ, zT))
        obstacles.push({
          id: `${runSeed}-${index}-${wall}-${i}`,
          type,
          wall,
          height: heights[i]!,
          z: zBase + zOff,
        })
      }
      // Z separation same wall
      const same = obstacles.filter((o) => o.wall === wall)
      if (same.length === 2) {
        const [a, b] = same
        if (a && b && Math.abs(a.z - b.z) < 6) {
          if (a.z < b.z) a.z = Math.min(a.z, b.z - 7)
          else b.z = Math.min(b.z, a.z - 7)
        }
      }
    }

    // Stagger dual-wall packs
    if (walls.length === 2) {
      const L = obstacles.filter((o) => o.wall === 'left')
      const R = obstacles.filter((o) => o.wall === 'right')
      if (L[0] && R[0] && Math.abs(L[0].z - R[0].z) < 4) {
        R[0].z = Math.min(R[0].z, L[0].z - 5)
      }
    }
  }

  if (!isStart) {
    const n = rand() < 0.55 ? 1 : rand() < 0.85 ? 2 : 0
    for (let i = 0; i < n; i++) {
      const wall: WallSide = rand() < 0.5 ? 'left' : 'right'
      const height = Math.floor(rand() * HEIGHT_LANES)
      let zOff = -SEGMENT_LENGTH * (0.25 + rand() * 0.5)
      if (wall === 'left' && hasLeftGap) zOff = -MIN_GAP_PAD * 0.5 * (0.5 + rand() * 0.5)
      if (wall === 'right' && hasRightGap)
        zOff = -MIN_GAP_PAD * 0.5 * (0.5 + rand() * 0.5)
      coins.push({
        id: `${runSeed}-${index}-c${i}`,
        wall,
        height,
        z: zBase + zOff,
      })
    }
  }

  return {
    id: `${runSeed}-${index}`,
    index,
    zBase,
    hasLeftGap,
    hasRightGap,
    leftGapStart,
    leftGapEnd,
    rightGapStart,
    rightGapEnd,
    obstacles,
    coins,
  }
}

function initialIntensity(index: number): number {
  if (index < 2) return 0
  const base = Math.min(1, (index - 2) / 48)
  const wave = 0.5 + 0.5 * Math.sin((index / 8) * Math.PI * 2)
  const calm = index % 10 >= 7
  if (calm) return Math.min(1, base * 0.32 + 0.05)
  return Math.min(1, base * (0.5 + 0.5 * wave) + wave * 0.08)
}

export function buildInitialSegments(ahead: number, runSeed = 0): SegmentData[] {
  const list: SegmentData[] = []
  let solidsLeft = 99
  let solidsRight = 99
  for (let i = 0; i <= ahead; i++) {
    const prev = list.length ? list[list.length - 1]! : null
    const seg = generateSegment(i, initialIntensity(i), runSeed, {
      prev,
      solidsLeft,
      solidsRight,
    })
    list.push(seg)
    solidsLeft = seg.hasLeftGap ? 0 : solidsLeft + 1
    solidsRight = seg.hasRightGap ? 0 : solidsRight + 1
  }
  return list
}

export function obstacleHalfExtents(type: ObstacleType) {
  if (type === OBSTACLE_TYPES.BARRIER) {
    return { h: 0.55, d: 0.55 }
  }
  return { h: 0.95, d: 0.7 }
}
