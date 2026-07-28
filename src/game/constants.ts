/**
 * Link Twin ? shared game constants
 */

export const LANE_COUNT = 3
export const LANE_WIDTH = 2.2
export const LANE_POSITIONS = [-LANE_WIDTH, 0, LANE_WIDTH] as const
export const START_LANE = 1

export const SEGMENT_LENGTH = 24
export const SEGMENTS_AHEAD = 12
export const SEGMENTS_BEHIND = 2

/** Vertical span between floor and ceiling contact planes. */
export const TUNNEL_HEIGHT = 5.0
export const FLOOR_Y = 0
export const CEILING_Y = TUNNEL_HEIGHT

export const PLAYER_SIZE = 0.85
export const PLAYER_HALF = PLAYER_SIZE / 2

/** Rest length of the neon tether (center-to-center). */
export const TETHER_LENGTH = TUNNEL_HEIGHT - PLAYER_SIZE * 0.15
/** Soft spring when stretched past rest. */
export const TETHER_STIFFNESS = 48
export const TETHER_DAMPING = 8

export const JUMP_VELOCITY = 11
export const GRAVITY = 28
export const LANE_SWITCH_SPEED = 24

export const BASE_SPEED = 21
export const MAX_SPEED = 40
export const SPEED_RAMP = 0.052

export const OBSTACLE_TYPES = {
  WALL: 'wall',
  BARRIER: 'barrier',
} as const

export type ObstacleType = (typeof OBSTACLE_TYPES)[keyof typeof OBSTACLE_TYPES]
export type Surface = 'floor' | 'ceiling'

export const COIN_POINTS = 50
export const DISTANCE_SCORE_RATE = 1
export const SWITCH_BONUS = 4

export const NEAR_MISS_Z = 1.55
export const NEAR_MISS_COOLDOWN = 0.45
export const DEATH_HOLD_DURATION = 0.9
export const SPAWN_PROTECT_MS = 450
export const SWITCH_COOLDOWN = 0.15

export const COLORS = {
  bg: '#050512',
  fog: '#0a0a1e',
  floor: '#12122a',
  ceiling: '#1a1230',
  floorEdge: '#00f0ff',
  ceilingEdge: '#c44dff',
  floorPlayer: '#00ffcc',
  ceilingPlayer: '#e0a0ff',
  tether: '#88eeff',
  wall: '#ff3366',
  barrier: '#ffaa00',
  coin: '#ffd700',
  white: '#e8ffff',
  danger: '#ff3366',
  gold: '#ffd700',
  activeRing: '#ffffff',
} as const

export type GameStatus =
  | 'start'
  | 'playing'
  | 'paused'
  | 'dying'
  | 'gameover'

export type DeathCause =
  | 'wall'
  | 'barrier'
  | 'gap'
  | 'tether_snap'
  | 'unknown'

export const GAME_OVER_TIPS = [
  'Both twins must live. A hit on either ends the run.',
  'Jump the active twin ? the tether yanks its partner.',
  'Switch to the twin that faces the next barrier.',
  'Walls need a lane change. Barriers need a jump on that surface.',
  'Gaps on the floor kill the floor twin ? jump or pull with the ceiling jump.',
  'Look at both surfaces. The free path is often on the other twin.',
] as const
