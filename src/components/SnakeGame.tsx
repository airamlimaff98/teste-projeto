import { useState, useEffect, useRef, useCallback } from 'react'
import './SnakeGame.css'

// ─── Types ───────────────────────────────────────────────────────────────────
type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT'
type Cell = { x: number; y: number }
type GameStatus = 'idle' | 'playing' | 'paused' | 'gameover'

const GRID_SIZE = 20
const INITIAL_SPEED = 150 // ms per tick
const SPEED_INCREMENT = 3 // ms faster per food eaten
const MIN_SPEED = 60

// ─── Utils ───────────────────────────────────────────────────────────────────
function randomCell(snake: Cell[]): Cell {
  const occupied = new Set(snake.map((c) => `${c.x},${c.y}`))
  let cell: Cell
  do {
    cell = {
      x: Math.floor(Math.random() * GRID_SIZE),
      y: Math.floor(Math.random() * GRID_SIZE),
    }
  } while (occupied.has(`${cell.x},${cell.y}`))
  return cell
}

function opposite(dir: Direction): Direction {
  const map: Record<Direction, Direction> = {
    UP: 'DOWN',
    DOWN: 'UP',
    LEFT: 'RIGHT',
    RIGHT: 'LEFT',
  }
  return map[dir]
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function SnakeGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Game state (persisted across re-renders for the game loop)
  const stateRef = useRef({
    snake: [
      { x: 10, y: 10 },
      { x: 9, y: 10 },
      { x: 8, y: 10 },
    ] as Cell[],
    food: { x: 15, y: 10 } as Cell,
    direction: 'RIGHT' as Direction,
    nextDirection: 'RIGHT' as Direction,
    score: 0,
    highScore: Number(localStorage.getItem('snake-high-score') ?? '0'),
    status: 'idle' as GameStatus,
    speed: INITIAL_SPEED,
    tickId: null as number | null,
  })

  // Re-render trigger
  const [, forceRender] = useState(0)
  const rerender = useCallback(() => forceRender((n) => n + 1), [])

  // ── Canvas cell size ─────────────────────────────────────────────────────
  const CELL_SIZE = useRef(20)

  // ── Drawing ────────────────────────────────────────────────────────────────
  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const s = CELL_SIZE.current
    const { snake, food } = stateRef.current
    const w = canvas.width
    const h = canvas.height

    // Background
    ctx.fillStyle = '#0f0f13'
    ctx.fillRect(0, 0, w, h)

    // Subtle grid
    ctx.strokeStyle = 'rgba(255,255,255,0.03)'
    ctx.lineWidth = 0.5
    for (let x = 0; x <= GRID_SIZE; x++) {
      ctx.beginPath()
      ctx.moveTo(x * s, 0)
      ctx.lineTo(x * s, h)
      ctx.stroke()
    }
    for (let y = 0; y <= GRID_SIZE; y++) {
      ctx.beginPath()
      ctx.moveTo(0, y * s)
      ctx.lineTo(w, y * s)
      ctx.stroke()
    }

    // Food – glowing orb
    const fx = food.x * s + s / 2
    const fy = food.y * s + s / 2
    const fr = s * 0.4
    const grad = ctx.createRadialGradient(fx - fr * 0.3, fy - fr * 0.3, 0, fx, fy, fr * 1.6)
    grad.addColorStop(0, '#ff6bcb')
    grad.addColorStop(0.5, '#ff3ea5')
    grad.addColorStop(1, 'rgba(255,62,165,0)')
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.arc(fx, fy, fr * 1.6, 0, Math.PI * 2)
    ctx.fill()

    ctx.fillStyle = '#ff6bcb'
    ctx.beginPath()
    ctx.arc(fx, fy, fr, 0, Math.PI * 2)
    ctx.fill()

    // Inner highlight
    ctx.fillStyle = 'rgba(255,255,255,0.5)'
    ctx.beginPath()
    ctx.arc(fx - fr * 0.25, fy - fr * 0.25, fr * 0.3, 0, Math.PI * 2)
    ctx.fill()

    // Snake
    snake.forEach((cell, i) => {
      const x = cell.x * s + 1
      const y = cell.y * s + 1
      const size = s - 2
      const radius = Math.min(size / 2, 4)

      const t = i / Math.max(snake.length - 1, 1)
      // Gradient from head (cyan) to tail (purple)
      const r = Math.round(10 + t * (120 - 10))
      const g = Math.round(220 - t * (220 - 40))
      const b = Math.round(200 - t * (200 - 255))
      ctx.fillStyle = `rgb(${r},${g},${b})`

      // Rounded rect
      ctx.beginPath()
      ctx.moveTo(x + radius, y)
      ctx.lineTo(x + size - radius, y)
      ctx.quadraticCurveTo(x + size, y, x + size, y + radius)
      ctx.lineTo(x + size, y + size - radius)
      ctx.quadraticCurveTo(x + size, y + size, x + size - radius, y + size)
      ctx.lineTo(x + radius, y + size)
      ctx.quadraticCurveTo(x, y + size, x, y + size - radius)
      ctx.lineTo(x, y + radius)
      ctx.quadraticCurveTo(x, y, x + radius, y)
      ctx.closePath()
      ctx.fill()

      // Head glow
      if (i === 0) {
        ctx.shadowColor = 'rgba(10,220,200,0.4)'
        ctx.shadowBlur = 12
        ctx.fill()
        ctx.shadowBlur = 0
      }
    })

    // Eyes on head
    if (snake.length > 0) {
      const head = snake[0]
      const hx = head.x * s
      const hy = head.y * s
      const dir = stateRef.current.direction
      let ex1: number, ey1: number, ex2: number, ey2: number
      const eyeOff = s * 0.22
      const eyeSize = Math.max(s * 0.12, 2)

      if (dir === 'RIGHT' || dir === 'LEFT') {
        const sign = dir === 'RIGHT' ? 1 : -1
        ex1 = hx + s / 2 + sign * eyeOff
        ey1 = hy + s * 0.3
        ex2 = hx + s / 2 + sign * eyeOff
        ey2 = hy + s * 0.7
      } else {
        const sign = dir === 'DOWN' ? 1 : -1
        ex1 = hx + s * 0.3
        ey1 = hy + s / 2 + sign * eyeOff
        ex2 = hx + s * 0.7
        ey2 = hy + s / 2 + sign * eyeOff
      }

      ctx.fillStyle = '#fff'
      ctx.beginPath()
      ctx.arc(ex1, ey1, eyeSize, 0, Math.PI * 2)
      ctx.fill()
      ctx.beginPath()
      ctx.arc(ex2, ey2, eyeSize, 0, Math.PI * 2)
      ctx.fill()

      ctx.fillStyle = '#0a0a0f'
      ctx.beginPath()
      ctx.arc(ex1 + (dir === 'RIGHT' ? 1 : dir === 'LEFT' ? -1 : 0), ey1 + (dir === 'DOWN' ? 1 : dir === 'UP' ? -1 : 0), eyeSize * 0.5, 0, Math.PI * 2)
      ctx.fill()
      ctx.beginPath()
      ctx.arc(ex2 + (dir === 'RIGHT' ? 1 : dir === 'LEFT' ? -1 : 0), ey2 + (dir === 'DOWN' ? 1 : dir === 'UP' ? -1 : 0), eyeSize * 0.5, 0, Math.PI * 2)
      ctx.fill()
    }
  }, [])

  // ── Game loop ──────────────────────────────────────────────────────────────
  const tick = useCallback(() => {
    const st = stateRef.current
    if (st.status !== 'playing') return

    // Apply queued direction
    st.direction = st.nextDirection

    // Move snake
    const head = { ...st.snake[0] }
    switch (st.direction) {
      case 'UP':
        head.y -= 1
        break
      case 'DOWN':
        head.y += 1
        break
      case 'LEFT':
        head.x -= 1
        break
      case 'RIGHT':
        head.x += 1
        break
    }

    // Wrap around
    if (head.x < 0) head.x = GRID_SIZE - 1
    if (head.x >= GRID_SIZE) head.x = 0
    if (head.y < 0) head.y = GRID_SIZE - 1
    if (head.y >= GRID_SIZE) head.y = 0

    // Self-collision
    if (st.snake.some((c) => c.x === head.x && c.y === head.y)) {
      st.status = 'gameover'
      if (st.score > st.highScore) {
        st.highScore = st.score
        localStorage.setItem('snake-high-score', String(st.score))
      }
      rerender()
      draw()
      return
    }

    st.snake.unshift(head)

    // Eat food?
    if (head.x === st.food.x && head.y === st.food.y) {
      st.score += 10
      st.speed = Math.max(MIN_SPEED, st.speed - SPEED_INCREMENT)
      st.food = randomCell(st.snake)
    } else {
      st.snake.pop()
    }

    draw()
    rerender()

    // Schedule next tick
    st.tickId = window.setTimeout(tick, st.speed)
  }, [draw, rerender])

  // ── Game lifecycle ─────────────────────────────────────────────────────────
  const startGame = useCallback(() => {
    const st = stateRef.current
    // Clear old tick
    if (st.tickId !== null) {
      clearTimeout(st.tickId)
      st.tickId = null
    }

    const initialSnake: Cell[] = [
      { x: 10, y: 10 },
      { x: 9, y: 10 },
      { x: 8, y: 10 },
    ]

    st.snake = initialSnake
    st.food = randomCell(initialSnake)
    st.direction = 'RIGHT'
    st.nextDirection = 'RIGHT'
    st.score = 0
    st.speed = INITIAL_SPEED
    st.status = 'playing'

    rerender()
    draw()

    st.tickId = window.setTimeout(tick, st.speed)
  }, [tick, draw, rerender])

  const pauseGame = useCallback(() => {
    const st = stateRef.current
    if (st.tickId !== null) {
      clearTimeout(st.tickId)
      st.tickId = null
    }
    st.status = 'paused'
    rerender()
  }, [rerender])

  // ── Controls ───────────────────────────────────────────────────────────────
  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      const st = stateRef.current
      let dir: Direction | null = null

      switch (e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
          dir = 'UP'
          break
        case 'ArrowDown':
        case 's':
        case 'S':
          dir = 'DOWN'
          break
        case 'ArrowLeft':
        case 'a':
        case 'A':
          dir = 'LEFT'
          break
        case 'ArrowRight':
        case 'd':
        case 'D':
          dir = 'RIGHT'
          break
        case ' ':
          e.preventDefault()
          if (st.status === 'idle' || st.status === 'paused') startGame()
          else if (st.status === 'playing') pauseGame()
          else if (st.status === 'gameover') startGame()
          return
      }

      if (dir && st.status === 'playing') {
        e.preventDefault()
        if (dir !== opposite(st.direction)) {
          st.nextDirection = dir
        }
      }
    },
    [startGame, pauseGame],
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [handleKey])

  // ── Canvas resizing ────────────────────────────────────────────────────────
  useEffect(() => {
    const resize = () => {
      const container = containerRef.current
      if (!container) return
      const size = Math.min(container.clientWidth - 32, 600)
      CELL_SIZE.current = Math.floor(size / GRID_SIZE)
      const canvas = canvasRef.current
      if (canvas) {
        canvas.width = CELL_SIZE.current * GRID_SIZE
        canvas.height = CELL_SIZE.current * GRID_SIZE
      }
      draw()
    }
    resize()
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [rerender, draw])

  // ── Draw on mount ──────────────────────────────────────────────────────────
  useEffect(() => {
    draw()
  }, [draw])

  // ── Touch handling ─────────────────────────────────────────────────────────
  const touchStart = useRef<{ x: number; y: number } | null>(null)

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const t = e.touches[0]
    touchStart.current = { x: t.clientX, y: t.clientY }
  }, [])

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (!touchStart.current) return
      const st = stateRef.current
      if (st.status !== 'playing') {
        if (st.status === 'idle' || st.status === 'paused' || st.status === 'gameover') {
          startGame()
        }
        touchStart.current = null
        return
      }

      const t = e.changedTouches[0]
      const dx = t.clientX - touchStart.current.x
      const dy = t.clientY - touchStart.current.y
      touchStart.current = null

      if (Math.abs(dx) < 15 && Math.abs(dy) < 15) return

      let dir: Direction
      if (Math.abs(dx) > Math.abs(dy)) {
        dir = dx > 0 ? 'RIGHT' : 'LEFT'
      } else {
        dir = dy > 0 ? 'DOWN' : 'UP'
      }

      if (dir !== opposite(st.direction)) {
        st.nextDirection = dir
      }
    },
    [startGame],
  )

  // ── Render ─────────────────────────────────────────────────────────────────
  const { status, score, highScore } = stateRef.current

  return (
    <div className="snake-game-wrapper">
      <div className="snake-header">
        <div className="snake-title">
          <span className="snake-icon">🐍</span>
          <h1>SNAKE</h1>
        </div>
        <div className="snake-scores">
          <div className="score-box">
            <span className="score-label">SCORE</span>
            <span className="score-value">{String(score).padStart(4, '0')}</span>
          </div>
          <div className="score-box score-box--high">
            <span className="score-label">BEST</span>
            <span className="score-value">{String(highScore).padStart(4, '0')}</span>
          </div>
        </div>
      </div>

      <div
        ref={containerRef}
        className="snake-canvas-container"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <canvas ref={canvasRef} className="snake-canvas" />

        {/* Overlays */}
        {status === 'idle' && (
          <div className="snake-overlay">
            <div className="overlay-content">
              <span className="overlay-icon">🐍</span>
              <h2>Snake Game</h2>
              <p>Use arrow keys or WASD to move</p>
              <p className="overlay-hint">Press <kbd>Space</kbd> or tap to start</p>
              <button className="snake-btn" onClick={startGame}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="5,3 19,12 5,21" />
                </svg>
                Start Game
              </button>
            </div>
          </div>
        )}

        {status === 'paused' && (
          <div className="snake-overlay">
            <div className="overlay-content">
              <h2>Paused</h2>
              <p className="overlay-hint">Press <kbd>Space</kbd> or tap to resume</p>
              <button className="snake-btn" onClick={startGame}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="5,3 19,12 5,21" />
                </svg>
                Resume
              </button>
            </div>
          </div>
        )}

        {status === 'gameover' && (
          <div className="snake-overlay">
            <div className="overlay-content">
              <span className="overlay-icon">💀</span>
              <h2>Game Over</h2>
              <div className="final-score">
                <span>Score</span>
                <strong>{score}</strong>
              </div>
              {score >= highScore && score > 0 && (
                <p className="new-record">🎉 New Record!</p>
              )}
              <p className="overlay-hint">Press <kbd>Space</kbd> or tap to restart</p>
              <button className="snake-btn" onClick={startGame}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="23 4 23 10 17 10" />
                  <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                </svg>
                Play Again
              </button>
            </div>
          </div>
        )}

        {/* Mobile controls hint */}
        <div className="mobile-controls-hint">
          <div className="arrow-row">
            <button
              className="arrow-btn"
              onTouchStart={(e) => { e.preventDefault(); setDirection('UP') }}
              onClick={() => setDirection('UP')}
            >▲</button>
          </div>
          <div className="arrow-row">
            <button
              className="arrow-btn"
              onTouchStart={(e) => { e.preventDefault(); setDirection('LEFT') }}
              onClick={() => setDirection('LEFT')}
            >◀</button>
            <button
              className="arrow-btn"
              onTouchStart={(e) => { e.preventDefault(); setDirection('RIGHT') }}
              onClick={() => setDirection('RIGHT')}
            >▶</button>
          </div>
          <div className="arrow-row">
            <button
              className="arrow-btn"
              onTouchStart={(e) => { e.preventDefault(); setDirection('DOWN') }}
              onClick={() => setDirection('DOWN')}
            >▼</button>
          </div>
        </div>
      </div>
    </div>
  )

  // ── Helper to set direction from d-pad ──────────────────────────────────────
  function setDirection(dir: Direction) {
    const st = stateRef.current
    if (st.status === 'playing' && dir !== opposite(st.direction)) {
      st.nextDirection = dir
    }
  }
}
