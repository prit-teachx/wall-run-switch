'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import type { GameEngine } from '../game/engine'
import { WallRenderer } from '../game/renderer'
import { COLORS } from '../game/constants'
import { sounds } from '../audio/sounds'
import styles from './GameCanvas.module.css'

type Props = { engine: GameEngine }

const SWIPE_MIN = 28
const TAP_MAX_MS = 280
const TAP_MAX_MOVE = 24
const AXIS_BIAS = 0.85

export function GameCanvas({ engine }: Props) {
  const engineRef = useRef(engine)
  engineRef.current = engine

  const containerRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const rendererRef = useRef<WallRenderer | null>(null)
  const rafRef = useRef<number | null>(null)
  const lastTsRef = useRef(0)
  const disposedRef = useRef(false)
  const touchStart = useRef({ x: 0, y: 0, t: 0 })
  const gestureUsed = useRef(false)
  const lastTapT = useRef(0)
  const [error, setError] = useState<string | null>(null)
  const [retryKey, setRetryKey] = useState(0)

  const stopLoop = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }, [])

  useEffect(() => {
    disposedRef.current = false
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return
    let cancelled = false

    try {
      const ctx = canvas.getContext('2d', { alpha: false })
      if (!ctx) {
        setError('Canvas 2D is not available.')
        return
      }
      const renderer = new WallRenderer(ctx)
      rendererRef.current = renderer

      const resize = () => {
        if (cancelled || disposedRef.current) return
        const w = Math.max(1, container.clientWidth)
        const h = Math.max(1, container.clientHeight)
        const dpr = Math.min(window.devicePixelRatio || 1, 2)
        canvas.width = Math.floor(w * dpr)
        canvas.height = Math.floor(h * dpr)
        canvas.style.width = `${w}px`
        canvas.style.height = `${h}px`
        renderer.setSize(w, h, dpr)
      }
      resize()
      setError(null)
      const ro = new ResizeObserver(() => resize())
      ro.observe(container)
      lastTsRef.current = performance.now()

      const loop = (ts: number) => {
        if (cancelled || disposedRef.current) return
        const dt = Math.min(0.05, Math.max(0, (ts - lastTsRef.current) / 1000))
        lastTsRef.current = ts
        engineRef.current.tick(dt)
        renderer.draw(engineRef.current, dt)
        rafRef.current = requestAnimationFrame(loop)
      }
      rafRef.current = requestAnimationFrame(loop)

      const unsub = engineRef.current.onEvent((event) => {
        const w = container.clientWidth
        const h = container.clientHeight
        if (event.type === 'flip') {
          renderer.burst(w * 0.5, h * 0.5, COLORS.leftEdge, 14)
        }
        if (event.type === 'coin') {
          renderer.burst(w * 0.5, h * 0.45, COLORS.coin, 10)
        }
        if (event.type === 'nearMiss') {
          renderer.burst(w * 0.5, h * 0.48, COLORS.white, 6)
        }
      })

      return () => {
        cancelled = true
        disposedRef.current = true
        stopLoop()
        unsub()
        ro.disconnect()
        renderer.dispose()
        rendererRef.current = null
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to start')
      return () => {
        cancelled = true
        stopLoop()
      }
    }
  }, [retryKey, stopLoop])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const eng = engineRef.current
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return

      if (e.code === 'ArrowUp' || e.code === 'KeyW') {
        e.preventDefault()
        if (eng.status === 'playing') eng.goUp()
        return
      }
      if (e.code === 'ArrowDown' || e.code === 'KeyS') {
        e.preventDefault()
        if (eng.status === 'playing') eng.goDown()
        return
      }
      if (e.code === 'KeyE' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
        e.preventDefault()
        if (eng.status === 'playing') {
          void sounds.unlock().then(() => eng.requestJump())
        }
        return
      }
      if (e.code === 'Space' || e.code === 'KeyF') {
        e.preventDefault()
        void sounds.unlock().then(() => {
          if (eng.status === 'start' || eng.status === 'gameover') eng.startGame()
          else if (eng.status === 'paused') eng.resumeGame()
          else if (eng.status === 'playing') eng.requestFlip()
        })
        return
      }
      if (e.code === 'KeyP' || e.code === 'Escape') {
        e.preventDefault()
        eng.togglePause()
      }
      if (e.code === 'Enter' || e.code === 'KeyR') {
        if (eng.status === 'start' || eng.status === 'gameover') {
          e.preventDefault()
          void sounds.unlock().then(() => eng.startGame())
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const tryGesture = (x: number, y: number): boolean => {
    if (gestureUsed.current) return true
    const eng = engineRef.current
    if (eng.status !== 'playing') return false
    const dx = x - touchStart.current.x
    const dy = y - touchStart.current.y
    const adx = Math.abs(dx)
    const ady = Math.abs(dy)
    if (ady >= SWIPE_MIN && ady >= adx * AXIS_BIAS) {
      if (dy < 0) eng.goUp()
      else eng.goDown()
      gestureUsed.current = true
      return true
    }
    if (adx >= SWIPE_MIN && adx >= ady * AXIS_BIAS) {
      // Horizontal swipe = flip
      void sounds.unlock().then(() => eng.requestFlip())
      gestureUsed.current = true
      return true
    }
    return false
  }

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return
    gestureUsed.current = false
    touchStart.current = { x: e.clientX, y: e.clientY, t: Date.now() }
    try {
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (e.buttons === 0 && e.pointerType === 'mouse') return
    tryGesture(e.clientX, e.clientY)
  }

  const onPointerUp = (e: React.PointerEvent) => {
    const eng = engineRef.current
    const dx = e.clientX - touchStart.current.x
    const dy = e.clientY - touchStart.current.y
    const dt = Date.now() - touchStart.current.t
    const dist = Math.hypot(dx, dy)

    if (eng.status === 'paused') {
      if (dt < TAP_MAX_MS && dist < TAP_MAX_MOVE) {
        void sounds.unlock().then(() => eng.resumeGame())
      }
      return
    }
    if (eng.status !== 'playing') return
    if (tryGesture(e.clientX, e.clientY)) return

    if (!gestureUsed.current && dt < TAP_MAX_MS && dist < TAP_MAX_MOVE) {
      const now = Date.now()
      // Double-tap = jump, single tap = flip
      if (now - lastTapT.current < 320) {
        void sounds.unlock().then(() => eng.requestJump())
        lastTapT.current = 0
      } else {
        void sounds.unlock().then(() => eng.requestFlip())
        lastTapT.current = now
      }
      gestureUsed.current = true
    }
  }

  if (error) {
    return (
      <div className={styles.root}>
        <div className={styles.error}>
          <p>{error}</p>
          <button type="button" className={styles.retry} onClick={() => setRetryKey((k) => k + 1)}>
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div ref={containerRef} className={styles.root}>
      <canvas
        ref={canvasRef}
        className={styles.canvas}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        aria-label="Wall Run Switch playfield"
      />
    </div>
  )
}
