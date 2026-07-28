'use client'

import React, { memo } from 'react'
import type { GameSnapshot } from '../game/engine'
import { GAME_OVER_TIPS, type DeathCause } from '../game/constants'
import styles from './GameUI.module.css'

type Props = {
  snap: GameSnapshot
  muted: boolean
  onStart: () => void
  onResume: () => void
  onPause: () => void
  onRestart: () => void
  onToggleMute: () => void
}

function deathCauseLabel(cause: DeathCause | null): string {
  switch (cause) {
    case 'wall':
      return 'A twin hit a wall. Change lanes for both.'
    case 'barrier':
      return 'A twin clipped a barrier. Jump that surface ? or yank via tether.'
    case 'gap':
      return 'A twin fell into a gap. Jump or use the tether pull.'
    case 'tether_snap':
      return 'Tether overstretched. Keep the twins closer.'
    default:
      return 'Run ended'
  }
}

function closeCallLine(delta: number, isNew: boolean): string | null {
  if (isNew || delta >= 0) return null
  const short = Math.abs(delta)
  if (short <= 50) return `So close! Only ${short} pts from a new record.`
  if (short <= 200) return `${short} pts shy of your best. One more run!`
  return null
}

function GameUIInner({
  snap,
  muted,
  onStart,
  onResume,
  onPause,
  onRestart,
  onToggleMute,
}: Props) {
  const showHud =
    snap.status === 'playing' ||
    snap.status === 'paused' ||
    snap.status === 'dying' ||
    snap.status === 'gameover'
  const showPause = snap.status === 'playing' || snap.status === 'paused'
  const tip =
    GAME_OVER_TIPS[snap.tipIndex % GAME_OVER_TIPS.length] ?? GAME_OVER_TIPS[0]
  const closeCall = closeCallLine(snap.scoreDeltaToBest, snap.isNewHighScore)
  const activeLabel = snap.active === 'floor' ? 'FLOOR TWIN' : 'CEILING TWIN'

  return (
    <div className={styles.root}>
      {showHud && (
        <div className={styles.hud} aria-live="polite">
          <div className={styles.scoreLabel}>SCORE</div>
          <div className={styles.scoreValue}>{Math.floor(snap.score)}</div>
          <div className={styles.hudRow}>
            <span className={styles.pill}>?? {snap.coins}</span>
            <span className={styles.pill}>?? {Math.floor(snap.distance)}m</span>
            <span className={styles.pill}>?? {snap.switches}</span>
            <span className={styles.pill}>?? {snap.highScore}</span>
          </div>
          {(snap.status === 'playing' || snap.status === 'paused') && (
            <div
              className={`${styles.layerBadge} ${
                snap.active === 'floor' ? styles.faceCyan : styles.faceMagenta
              }`}
            >
              {activeLabel}
            </div>
          )}
        </div>
      )}

      {showPause && (
        <div className={styles.topRight}>
          <button
            type="button"
            className={styles.iconBtn}
            aria-label={snap.status === 'paused' ? 'Resume' : 'Pause'}
            onClick={snap.status === 'paused' ? onResume : onPause}
          >
            <span className={styles.pauseIcon}>
              {snap.status === 'paused' ? '?' : '??'}
            </span>
          </button>
          <button
            type="button"
            className={styles.iconBtn}
            aria-label={muted ? 'Unmute' : 'Mute'}
            onClick={onToggleMute}
          >
            <span className={styles.iconBtnText}>{muted ? '??' : '??'}</span>
          </button>
        </div>
      )}

      {snap.status === 'dying' && (
        <div className={styles.dyingFlash} aria-hidden>
          <div className={styles.dyingLabel}>LINK BROKEN</div>
        </div>
      )}

      {snap.status === 'start' && (
        <div className={styles.overlay}>
          <div className={styles.panel}>
            <h1 className={styles.title}>LINK TWIN</h1>
            <p className={styles.subtitle}>
              Floor + ceiling ? neon tether ? offline
            </p>
            <div className={styles.controlsList}>
              <p className={styles.controlLine}>? ? / A D &nbsp; change lane (both)</p>
              <p className={styles.controlLine}>Space / W / ? &nbsp; jump active twin</p>
              <p className={styles.controlLine}>S / ? / F &nbsp; switch floor ? ceiling</p>
              <p className={styles.controlLine}>Swipe L/R lanes ? up jump ? down switch</p>
              <p className={styles.controlLine}>P / Esc &nbsp; pause</p>
            </div>
            <div className={styles.tipCard}>
              <div className={styles.tipCardTitle}>THE HOOK</div>
              <p className={styles.tipCardBody}>
                Two cubes, one neon beam. Jump the active twin ? when the tether
                goes taut it yanks the partner. Hit either twin and the run ends.
              </p>
            </div>
            {snap.highScore > 0 && (
              <p className={styles.highScore}>Best: {snap.highScore}</p>
            )}
            <button type="button" className={styles.btnPrimary} onClick={onStart}>
              TAP TO START
            </button>
          </div>
        </div>
      )}

      {snap.status === 'paused' && (
        <div className={styles.overlay}>
          <div className={styles.panel}>
            <h1 className={styles.title}>PAUSED</h1>
            <button type="button" className={styles.btnPrimary} onClick={onResume}>
              ? RESUME
            </button>
          </div>
        </div>
      )}

      {snap.status === 'gameover' && (
        <div
          className={styles.overlay}
          role="button"
          tabIndex={0}
          onClick={onRestart}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              onRestart()
            }
          }}
          aria-label="Restart"
        >
          <div className={styles.panel}>
            <h1 className={`${styles.title} ${styles.titleDanger}`}>GAME OVER</h1>
            <p className={styles.deathLine}>{deathCauseLabel(snap.deathCause)}</p>
            <div className={styles.finalLabel}>Final Score</div>
            <div className={styles.finalValue}>{Math.floor(snap.score)}</div>
            <div className={styles.statsRow}>
              <span className={styles.stat}>Distance {Math.floor(snap.distance)}m</span>
              <span className={styles.stat}>Coins {snap.coins}</span>
              <span className={styles.stat}>Switches {snap.switches}</span>
            </div>
            {snap.isNewHighScore && (
              <p className={styles.newRecord}>? NEW HIGH SCORE ?</p>
            )}
            {!snap.isNewHighScore && snap.highScore > 0 && (
              <p className={styles.highScore}>Best: {snap.highScore}</p>
            )}
            {closeCall && <p className={styles.closeCall}>{closeCall}</p>}
            <p className={styles.rotateTip}>{tip}</p>
            <button
              type="button"
              className={`${styles.btnPrimary} ${styles.btnRetry}`}
              onClick={onRestart}
            >
              RETRY
            </button>
            <p className={styles.tapAnywhere}>tap anywhere to retry</p>
          </div>
        </div>
      )}

      {snap.status === 'playing' && (
        <p className={styles.hint}>
          Lanes ? Jump active ? Switch twin (? / S)
        </p>
      )}
    </div>
  )
}

export const GameUI = memo(GameUIInner)
