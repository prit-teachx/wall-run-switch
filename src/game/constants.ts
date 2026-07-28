/**
 * Wall Run Switch ? shared game constants
 */

export const HEIGHT_LANES = 3
export const HEIGHT_POSITIONS = [-1.15, 0, 1.15] as const
export const START_HEIGHT = 1

/** Corridor half-width (player sits at ?WALL_X). */
export const WALL_X = 1.35

export type WallSide = 'left' | 'right'

export const SEGMENT_LENGTH = 22
export const SEGMENTS_AHEAD = 14
export const SEGMENTS_BEHIND = 2

export const PLAYER_SIZE = 0.85
export const JUMP_VELOCITY = 9.5
export const GRAVITY = 26
export const HEIGHT_SWITCH_SPEED = 14
export const FLIP_DURATION = 0.32
export const FLIP_COOLDOWN = 0.18

export const BASE_SPEED = 20
export const MAX_SPEED = 40
export const SPEED_RAMP = 0.05

export const OBSTACLE_TYPES = {
  WALL: 'wall',
  BARRIER: 'barrier',
} as const

export type ObstacleType = (typeof OBSTACLE_TYPES)[keyof typeof OBSTACLE_TYPES]

export const COIN_POINTS = 50
export const DISTANCE_SCORE_RATE = 1
export const FLIP_BONUS_POINTS = 6

export const NEAR_MISS_Z = 1.5
export const NEAR_MISS_COOLDOWN = 0.45
export const DEATH_HOLD_DURATION = 0.9
export const SPAWN_PROTECT = 0.45

export const COLORS = {
  bg: '#060510',
  fog: '#0c0a1c',
  leftWall: '#0a1830',
  rightWall: '#1a0a28',
  leftEdge: '#00f0ff',
  rightEdge: '#ff00aa',
  player: '#00ffcc',
  playerRight: '#ff88dd',
  wall: '#ff3366',
  barrier: '#ffaa00',
  coin: '#ffd700',
  gap: '#020208',
  white: '#e8ffff',
  danger: '#ff3366',
  gold: '#ffd700',
} as const

export type GameStatus =
  | 'start'
  | 'playing'
  | 'paused'
  | 'dying'
  | 'gameover'

export type DeathCause = 'wall' | 'barrier' | 'gap' | 'unknown'

export const GAME_OVER_TIPS = [
  'Flip early when your wall is packed. The other side is often clear.',
  'Barriers need a jump on that wall. Walls need a height change or a flip.',
  'Gaps only kill the wall they cut ? flip before you hit the void.',
  'Center height is safer early. Move only when you must.',
  'Tap flips. E / Shift jumps. Don?t mix them up mid-panic.',
  'Look two hazards ahead on both walls.',
] as const
