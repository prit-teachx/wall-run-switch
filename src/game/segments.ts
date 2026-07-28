import {
  BASE_SPEED,
  GRAVITY,
  JUMP_VELOCITY,
  LANE_COUNT,
  OBSTACLE_TYPES,
  SEGMENT_LENGTH,
  TUNNEL_HEIGHT,
  type ObstacleType,
  type Surface,
} from './constants'

export interface ObstacleData {
  id: string
  type: ObstacleType
  lane: number
  z: number
  surface: Surface
}

export interface CoinData {
  id: string
  lane: number
  z: number
  y: number
  surface: Surface
}

export interface SegmentData {
  id: string
  index: number
  zBase: number
  hasGap: boolean
  gapStart: number
  gapEnd: number
  hasCeilingGap: boolean
  ceilingGapStart: number
  ceilingGapEnd: number
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

function jumpAirTime() {
  return (2 * JUMP_VELOCITY) / GRAVITY
}

function maxSafeGapLength() {
  return Math.min(SEGMENT_LENGTH * 0.36, BASE_SPEED * jumpAirTime() * 0.45)
}

const MIN_GAP_PAD = 5.4
const MIN_SOLID = 2
const POST_GAP_CLEAR = 0.4

export type SegCtx = {
  prev?: SegmentData | null
  solidsFloor?: number
  solidsCeil?: number
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
  const solidsFloor =
    ctx.solidsFloor ?? (prev ? (prev.hasGap ? 0 : 99) : 99)
  const solidsCeil =
    ctx.solidsCeil ?? (prev ? (prev.hasCeilingGap ? 0 : 99) : 99)

  const gapChance = 0.05 + difficulty * 0.09
  const hasGap =
    !isStart &&
    solidsFloor >= MIN_SOLID &&
    !prev?.hasGap &&
    rand() < gapChance
  const hasCeilingGap =
    !isStart &&
    solidsCeil >= MIN_SOLID &&
    !prev?.hasCeilingGap &&
    !hasGap &&
    difficulty > 0.14 &&
    rand() < gapChance * 0.9

  let gapStart = zBase
  let gapEnd = zBase
  let ceilingGapStart = zBase
  let ceilingGapEnd = zBase
  if (hasGap) {
    const g = placeGap(zBase, rand)
    gapStart = g.gapStart
    gapEnd = g.gapEnd
  }
  if (hasCeilingGap) {
    const g = placeGap(zBase, rand)
    ceilingGapStart = g.gapStart
    ceilingGapEnd = g.gapEnd
  }

  const obstacles: ObstacleData[] = []
  const coins: CoinData[] = []
  const open =
    !isStart &&
    !hasGap &&
    !hasCeilingGap &&
    difficulty < 0.18 &&
    rand() < 0.4

  if (!isStart && !open) {
    const justLand =
      !!prev?.hasGap || !!prev?.hasCeilingGap
    const minZ = justLand ? POST_GAP_CLEAR : 0.28
    const zSlots = shuffleInPlace(
      [0.38, 0.55, 0.72].filter((s) => s >= minZ + 0.02),
      rand
    )
    if (zSlots.length === 0) zSlots.push(0.62)

    const surfaces: Surface[] =
      difficulty < 0.2
        ? rand() < 0.5
          ? ['floor']
          : ['ceiling']
        : rand() < 0.36
          ? ['floor']
          : rand() < 0.7
            ? ['ceiling']
            : ['floor', 'ceiling']

    for (const surface of surfaces) {
      const count = rand() < 0.2 + difficulty * 0.35 ? 2 : 1
      const lanes = shuffleInPlace([0, 1, 2], rand)
      for (let i = 0; i < count; i++) {
        const type: ObstacleType =
          rand() < 0.42 ? OBSTACLE_TYPES.BARRIER : OBSTACLE_TYPES.WALL
        const zT = zSlots[i % zSlots.length]! + (rand() - 0.5) * 0.04
        const zOff = -SEGMENT_LENGTH * Math.min(0.88, Math.max(minZ, zT))
        obstacles.push({
          id: `${runSeed}-${index}-${surface}-${i}`,
          type,
          lane: lanes[i]!,
          surface,
          z: zBase + zOff,
        })
      }
      const same = obstacles.filter((o) => o.surface === surface)
      if (same.length === 2) {
        const [a, b] = same
        if (a && b && Math.abs(a.z - b.z) < 6) {
          if (a.z < b.z) a.z = Math.min(a.z, b.z - 7)
          else b.z = Math.min(b.z, a.z - 7)
        }
      }
    }

    if (surfaces.length === 2) {
      const f = obstacles.filter((o) => o.surface === 'floor')
      const c = obstacles.filter((o) => o.surface === 'ceiling')
      if (f[0] && c[0] && Math.abs(f[0].z - c[0].z) < 4) {
        c[0].z = Math.min(c[0].z, f[0].z - 5)
      }
    }
  }

  if (!isStart) {
    const n = rand() < 0.52 ? 1 : rand() < 0.82 ? 2 : 0
    for (let i = 0; i < n; i++) {
      const surface: Surface = rand() < 0.48 ? 'ceiling' : 'floor'
      const lane = Math.floor(rand() * LANE_COUNT)
      let zOff = -SEGMENT_LENGTH * (0.25 + rand() * 0.5)
      if (surface === 'floor' && hasGap) {
        zOff = -MIN_GAP_PAD * 0.55 * (0.5 + rand() * 0.5)
      }
      if (surface === 'ceiling' && hasCeilingGap) {
        zOff = -MIN_GAP_PAD * 0.55 * (0.5 + rand() * 0.5)
      }
      coins.push({
        id: `${runSeed}-${index}-c${i}`,
        lane,
        z: zBase + zOff,
        y: surface === 'floor' ? 1.05 : TUNNEL_HEIGHT - 1.05,
        surface,
      })
    }
  }

  return {
    id: `${runSeed}-${index}`,
    index,
    zBase,
    hasGap,
    gapStart,
    gapEnd,
    hasCeilingGap,
    ceilingGapStart,
    ceilingGapEnd,
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
  let solidsFloor = 99
  let solidsCeil = 99
  for (let i = 0; i <= ahead; i++) {
    const prev = list.length ? list[list.length - 1]! : null
    const seg = generateSegment(i, initialIntensity(i), runSeed, {
      prev,
      solidsFloor,
      solidsCeil,
    })
    list.push(seg)
    solidsFloor = seg.hasGap ? 0 : solidsFloor + 1
    solidsCeil = seg.hasCeilingGap ? 0 : solidsCeil + 1
  }
  return list
}

export function obstacleBounds(type: ObstacleType, surface: Surface) {
  if (type === OBSTACLE_TYPES.BARRIER) {
    if (surface === 'floor') return { w: 1.55, h: 0.62, d: 0.65, y: 0.32 }
    return { w: 1.55, h: 0.62, d: 0.65, y: TUNNEL_HEIGHT - 0.32 }
  }
  if (surface === 'floor') return { w: 1.45, h: 1.8, d: 0.75, y: 0.92 }
  return { w: 1.45, h: 1.8, d: 0.75, y: TUNNEL_HEIGHT - 0.92 }
}
