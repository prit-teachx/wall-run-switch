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
      return 'Hit a wall block. Change height or flip walls.'
    case 'barrier':
      return 'Clipped a barrier. Jump (E / double-tap) on that wall.'
    case 'gap':
      return 'Fell into a wall gap. Flip before the void.'
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
  const wallLabel = snap.wall === 'left' ? 'LEFT WALL' : 'RIGHT WALL'

  return (
    <div className={styles.root}>
      {showHud && (
        <div className={styles.hud} aria-live="polite">
          <div className={styles.scoreLabel}>SCORE</div>
          <div className={styles.scoreValue}>{Math.floor(snap.score)}</div>
          <div className={styles.hudRow}>
            <span className={styles.pill}>?? {snap.coins}</span>
            <span className={styles.pill}>?? {Math.floor(snap.distance)}m</span>
            <span className={styles.pill}>?? {snap.flips}</span>
            <span className={styles.pill}>?? {snap.highScore}</span>
          </div>
          {(snap.status === 'playing' || snap.status === 'paused') && (
            <div
              className={`${styles.layerBadge} ${
                snap.wall === 'left' ? styles.faceCyan : styles.faceMagenta
              }`}
            >
              {wallLabel}
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
          <div className={styles.dyingLabel}>IMPACT</div>
        </div>
      )}

      {snap.status === 'start' && (
        <div className={styles.overlay}>
          <div className={styles.panel}>
            <h1 className={styles.title}>WALL RUN SWITCH</h1>
            <p className={styles.subtitle}>
              Left wall ? right wall ? flip across ? offline
            </p>
            <div className={styles.controlsList}>
              <p className={styles.controlLine}>W / ? ? S / ? &nbsp; height lane</p>
              <p className={styles.controlLine}>Space / F / tap &nbsp; flip wall</p>
              <p className={styles.controlLine}>E / Shift / double-tap &nbsp; jump</p>
              <p className={styles.controlLine}>Swipe up/down height ? swipe side flip</p>
              <p className={styles.controlLine}>P / Esc &nbsp; pause</p>
            </div>
            <div className={styles.tipCard}>
              <div className={styles.tipCardTitle}>THE HOOK</div>
              <p className={styles.tipCardBody}>
                Hazards stick to one wall. Flip across the corridor to ride the
                clear side ? or change height and jump on your wall.
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
              <span className={styles.stat}>Flips {snap.flips}</span>
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
          Height ? Flip (tap) ? Jump (E / double-tap)
        </p>
      )}
    </div>
  )
}

export const GameUI = memo(GameUIInner)
