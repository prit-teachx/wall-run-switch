'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { ErrorBoundary } from './ErrorBoundary'
import { GameCanvas } from './GameCanvas'
import { GameUI } from './GameUI'
import { sounds } from '../audio/sounds'
import { GameEngine, type GameSnapshot } from '../game/engine'
import { loadHighScore, saveHighScore } from '../storage/highScore'
import { loadAudioSettings, saveAudioSettings } from '../storage/audioSettings'
import styles from './GameApp.module.css'

export function GameApp() {
  const engine = useMemo(() => new GameEngine(), [])
  const [snap, setSnap] = useState<GameSnapshot>(() => engine.snapshot())
  const [muted, setMuted] = useState(false)
  const [audioReady, setAudioReady] = useState(false)

  useEffect(() => {
    void sounds.load()
    return () => sounds.dispose()
  }, [])

  useEffect(() => {
    const sync = () => setMuted(sounds.getMuted())
    sync()
    return sounds.onChange(sync)
  }, [])

  useEffect(() => {
    let mounted = true
    loadAudioSettings()
      .then((s) => {
        if (!mounted) return
        sounds.setMuted(s.muted)
        sounds.setVolume(s.volume)
        setAudioReady(true)
      })
      .catch(() => {
        if (mounted) setAudioReady(true)
      })
    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    if (!audioReady) return
    saveAudioSettings({ muted, volume: sounds.getVolume() }).catch(() => {})
  }, [muted, audioReady])

  useEffect(() => {
    let mounted = true
    loadHighScore()
      .then((hs) => {
        if (!mounted) return
        engine.setHighScore(hs)
      })
      .catch(() => {})

    const unsub = engine.onChange((s) => {
      setSnap(s)
      if (s.status === 'gameover' && s.isNewHighScore) {
        saveHighScore(s.highScore).catch(() => {})
      }
    })

    const unsubEvents = engine.onEvent((event) => {
      switch (event.type) {
        case 'jump':
          sounds.play('jump')
          try {
            navigator.vibrate?.(10)
          } catch {
            /* ignore */
          }
          break
        case 'switch':
          sounds.play('switch')
          try {
            navigator.vibrate?.(8)
          } catch {
            /* ignore */
          }
          break
        case 'coin':
          sounds.play('coin')
          break
        case 'nearMiss':
          sounds.play('nearMiss')
          break
        case 'crash':
          sounds.play('crash')
          try {
            navigator.vibrate?.([30, 40, 30])
          } catch {
            /* ignore */
          }
          break
        case 'runStart':
          sounds.startRun()
          break
        case 'runStop':
          sounds.stopRun()
          break
      }
    })

    const onVis = () => {
      if (document.visibilityState !== 'visible') {
        sounds.stopRun()
        if (engine.status === 'playing') engine.pauseGame()
      } else if (engine.status === 'playing') {
        sounds.startRun()
      }
    }
    document.addEventListener('visibilitychange', onVis)

    return () => {
      mounted = false
      unsub()
      unsubEvents()
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [engine])

  const unlockAnd = useCallback(async (fn: () => void) => {
    await sounds.unlock().catch(() => {})
    fn()
  }, [])

  return (
    <ErrorBoundary>
      <div className={styles.root}>
        <GameCanvas engine={engine} />
        <GameUI
          snap={snap}
          muted={muted}
          onStart={() => void unlockAnd(() => engine.startGame())}
          onResume={() => void unlockAnd(() => engine.resumeGame())}
          onPause={() => engine.pauseGame()}
          onRestart={() => void unlockAnd(() => engine.startGame())}
          onToggleMute={() => void unlockAnd(() => sounds.toggleMute())}
        />
      </div>
    </ErrorBoundary>
  )
}
