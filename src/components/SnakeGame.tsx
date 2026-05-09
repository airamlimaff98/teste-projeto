import { useState, useEffect, useRef, useCallback } from 'react'
import './SnakeGame.css'
import { fetchLeaderboard, submitScoreRTDB } from '../lib/firebase'
import type { LeaderboardEntry } from '../lib/firebase'

// ─── Types ───────────────────────────────────────────────────────────────────
type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT'
type Cell = { x: number; y: number }
type GameStatus = 'idle' | 'playing' | 'paused' | 'gameover'
type GameMode = 'classic' | 'immortal'

const GRID_SIZE = 20
const INITIAL_SPEED = 150
const SPEED_INCREMENT = 3
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
    UP: 'DOWN', DOWN: 'UP', LEFT: 'RIGHT', RIGHT: 'LEFT',
  }
  return map[dir]
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function SnakeGame({ playerName }: { playerName: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Player name (React state for reactivity)
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [justEnteredLB, setJustEnteredLB] = useState(false)
  const [loadingLB, setLoadingLB] = useState(true)

  // Load leaderboard from Firebase on mount
  useEffect(() => {
    fetchLeaderboard().then((data) => {
      setLeaderboard(data)
      setLoadingLB(false)
    })
  }, [])

  // Game state (ref to avoid re-render in game loop)
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
    highScoreImmortal: Number(localStorage.getItem('snake-high-score-immortal') ?? '0'),
    status: 'idle' as GameStatus,
    mode: 'classic' as GameMode,
    speed: INITIAL_SPEED,
    tickId: null as number | null,
  })

  const [, forceRender] = useState(0)
  const rerender = useCallback(() => forceRender((n) => n + 1), [])

  const CELL_SIZE = useRef(20)

  // ── Drawing ────────────────────────────────────────────────────────────────
  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const s = CELL_SIZE.current
    const { snake, food, mode } = stateRef.current
    const w = canvas.width
    const h = canvas.height

    ctx.fillStyle = '#0f0f13'
    ctx.fillRect(0, 0, w, h)

    ctx.strokeStyle = 'rgba(255,255,255,0.03)'
    ctx.lineWidth = 0.5
    for (let x = 0; x <= GRID_SIZE; x++) {
      ctx.beginPath(); ctx.moveTo(x * s, 0); ctx.lineTo(x * s, h); ctx.stroke()
    }
    for (let y = 0; y <= GRID_SIZE; y++) {
      ctx.beginPath(); ctx.moveTo(0, y * s); ctx.lineTo(w, y * s); ctx.stroke()
    }

    // Food
    const fx = food.x * s + s / 2
    const fy = food.y * s + s / 2
    const fr = s * 0.4
    const c1 = mode === 'immortal' ? '#fbbf24' : '#ff6bcb'
    const c2 = mode === 'immortal' ? '#f59e0b' : '#ff3ea5'
    const g = ctx.createRadialGradient(fx - fr * 0.3, fy - fr * 0.3, 0, fx, fy, fr * 1.6)
    g.addColorStop(0, c1); g.addColorStop(0.5, c2); g.addColorStop(1, `${c2}00`)
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(fx, fy, fr * 1.6, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = c1; ctx.beginPath(); ctx.arc(fx, fy, fr, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = 'rgba(255,255,255,0.5)'
    ctx.beginPath(); ctx.arc(fx - fr * 0.25, fy - fr * 0.25, fr * 0.3, 0, Math.PI * 2); ctx.fill()

    // Snake
    snake.forEach((cell, i) => {
      const x = cell.x * s + 1, y = cell.y * s + 1, sz = s - 2, rad = Math.min(sz / 2, 4)
      const t = i / Math.max(snake.length - 1, 1)
      let r: number, g: number, b: number
      if (mode === 'immortal') {
        r = Math.round(250 - t * 70); g = Math.round(200 - t * 120); b = Math.round(50 - t * 50)
      } else {
        r = Math.round(10 + t * 110); g = Math.round(220 - t * 180); b = Math.round(200 + t * 55)
      }
      ctx.fillStyle = `rgb(${r},${g},${b})`
      ctx.beginPath()
      ctx.moveTo(x + rad, y); ctx.lineTo(x + sz - rad, y)
      ctx.quadraticCurveTo(x + sz, y, x + sz, y + rad)
      ctx.lineTo(x + sz, y + sz - rad)
      ctx.quadraticCurveTo(x + sz, y + sz, x + sz - rad, y + sz)
      ctx.lineTo(x + rad, y + sz)
      ctx.quadraticCurveTo(x, y + sz, x, y + sz - rad)
      ctx.lineTo(x, y + rad)
      ctx.quadraticCurveTo(x, y, x + rad, y)
      ctx.closePath(); ctx.fill()
      if (i === 0) {
        ctx.shadowColor = mode === 'immortal' ? 'rgba(251,191,36,0.4)' : 'rgba(10,220,200,0.4)'
        ctx.shadowBlur = 12; ctx.fill(); ctx.shadowBlur = 0
      }
    })

    // Eyes
    if (snake.length > 0) {
      const head = snake[0], hx = head.x * s, hy = head.y * s
      const dir = stateRef.current.direction, eo = s * 0.22, es = Math.max(s * 0.12, 2)
      let ex1: number, ey1: number, ex2: number, ey2: number
      if (dir === 'RIGHT' || dir === 'LEFT') {
        const sign = dir === 'RIGHT' ? 1 : -1
        ex1 = hx + s / 2 + sign * eo; ey1 = hy + s * 0.3
        ex2 = hx + s / 2 + sign * eo; ey2 = hy + s * 0.7
      } else {
        const sign = dir === 'DOWN' ? 1 : -1
        ex1 = hx + s * 0.3; ey1 = hy + s / 2 + sign * eo
        ex2 = hx + s * 0.7; ey2 = hy + s / 2 + sign * eo
      }
      ctx.fillStyle = '#fff'
      ctx.beginPath(); ctx.arc(ex1, ey1, es, 0, Math.PI * 2); ctx.fill()
      ctx.beginPath(); ctx.arc(ex2, ey2, es, 0, Math.PI * 2); ctx.fill()
      const po = dir === 'RIGHT' ? 1 : dir === 'LEFT' ? -1 : 0
      ctx.fillStyle = '#0a0a0f'
      ctx.beginPath(); ctx.arc(ex1 + po, ey1 + (dir === 'DOWN' ? 1 : dir === 'UP' ? -1 : 0), es * 0.5, 0, Math.PI * 2); ctx.fill()
      ctx.beginPath(); ctx.arc(ex2 + po, ey2 + (dir === 'DOWN' ? 1 : dir === 'UP' ? -1 : 0), es * 0.5, 0, Math.PI * 2); ctx.fill()
    }
  }, [])

  // ── Submit score to Firebase ───────────────────────────────────────────────
  const submitCurrentScore = useCallback(() => {
    const st = stateRef.current
    if (!playerName || st.score <= 0) return

    submitScoreRTDB(playerName, st.score).then((updated) => {
      setLeaderboard(updated)
      const entered = updated.some(e => e.name === playerName && e.score === st.score)
      setJustEnteredLB(entered)
    })
  }, [playerName])

  // ── Game loop ──────────────────────────────────────────────────────────────
  const tick = useCallback(() => {
    const st = stateRef.current
    if (st.status !== 'playing') return

    st.direction = st.nextDirection

    const head = { ...st.snake[0] }
    switch (st.direction) {
      case 'UP': head.y -= 1; break
      case 'DOWN': head.y += 1; break
      case 'LEFT': head.x -= 1; break
      case 'RIGHT': head.x += 1; break
    }

    if (head.x < 0) head.x = GRID_SIZE - 1
    if (head.x >= GRID_SIZE) head.x = 0
    if (head.y < 0) head.y = GRID_SIZE - 1
    if (head.y >= GRID_SIZE) head.y = 0

    // Self-collision (classic mode)
    if (st.mode === 'classic' && st.snake.some((c) => c.x === head.x && c.y === head.y)) {
      st.status = 'gameover'
      if (st.score > st.highScore) {
        st.highScore = st.score
        localStorage.setItem('snake-high-score', String(st.score))
      }
      submitCurrentScore()
      rerender()
      draw()
      return
    }

    st.snake.unshift(head)

    if (head.x === st.food.x && head.y === st.food.y) {
      st.score += 10
      st.speed = Math.max(MIN_SPEED, st.speed - SPEED_INCREMENT)
      st.food = randomCell(st.snake)

      if (st.mode === 'immortal') {
        if (st.score > st.highScoreImmortal) {
          st.highScoreImmortal = st.score
          localStorage.setItem('snake-high-score-immortal', String(st.score))
        }
        // Periodically submit score in immortal mode
        if (st.score % 50 === 0) {
          submitCurrentScore()
        }
      }
    } else {
      st.snake.pop()
    }

    draw()
    rerender()
    st.tickId = window.setTimeout(tick, st.speed)
  }, [draw, rerender, submitCurrentScore])

  // ── Game lifecycle ─────────────────────────────────────────────────────────
  const startGame = useCallback(() => {
    const st = stateRef.current
    if (!playerName) {
      nameInputRef.current?.focus()
      return
    }
    if (st.tickId !== null) { clearTimeout(st.tickId); st.tickId = null }

    const initialSnake: Cell[] = [
      { x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 },
    ]
    st.snake = initialSnake
    st.food = randomCell(initialSnake)
    st.direction = 'RIGHT'; st.nextDirection = 'RIGHT'
    st.score = 0; st.speed = INITIAL_SPEED; st.status = 'playing'
    setJustEnteredLB(false)
    rerender(); draw()
    st.tickId = window.setTimeout(tick, st.speed)
  }, [tick, draw, rerender, playerName])

  const pauseGame = useCallback(() => {
    const st = stateRef.current
    if (st.tickId !== null) { clearTimeout(st.tickId); st.tickId = null }
    st.status = 'paused'
    rerender()
  }, [rerender])

  const setMode = useCallback((m: GameMode) => {
    const st = stateRef.current
    if (st.status === 'playing' || st.status === 'paused') return
    st.mode = m
    st.food = randomCell(st.snake)
    setJustEnteredLB(false)
    rerender(); draw()
  }, [rerender, draw])

  // ── Controls ───────────────────────────────────────────────────────────────
  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      const st = stateRef.current
      let dir: Direction | null = null

      switch (e.key) {
        case 'ArrowUp': case 'w': case 'W': dir = 'UP'; break
        case 'ArrowDown': case 's': case 'S': dir = 'DOWN'; break
        case 'ArrowLeft': case 'a': case 'A': dir = 'LEFT'; break
        case 'ArrowRight': case 'd': case 'D': dir = 'RIGHT'; break
        case ' ':
          e.preventDefault()
          if (st.status === 'idle' || st.status === 'paused') startGame()
          else if (st.status === 'playing') pauseGame()
          else if (st.status === 'gameover') startGame()
          return
      }

      if (dir && st.status === 'playing') {
        e.preventDefault()
        if (dir !== opposite(st.direction)) st.nextDirection = dir
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

  useEffect(() => { draw() }, [draw])

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
        if (st.status === 'idle' || st.status === 'paused' || st.status === 'gameover') startGame()
        touchStart.current = null; return
      }
      const t = e.changedTouches[0]
      const dx = t.clientX - touchStart.current.x
      const dy = t.clientY - touchStart.current.y
      touchStart.current = null
      if (Math.abs(dx) < 15 && Math.abs(dy) < 15) return
      const dir: Direction = Math.abs(dx) > Math.abs(dy)
        ? (dx > 0 ? 'RIGHT' : 'LEFT')
        : (dy > 0 ? 'DOWN' : 'UP')
      if (dir !== opposite(st.direction)) st.nextDirection = dir
    },
    [startGame],
  )

  // ── Render ─────────────────────────────────────────────────────────────────
  const { status, score, mode, highScore, highScoreImmortal } = stateRef.current
  const currentHighScore = mode === 'immortal' ? highScoreImmortal : highScore

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
          <div className={`score-box score-box--high ${mode === 'immortal' ? 'score-box--gold' : ''}`}>
            <span className="score-label">BEST</span>
            <span className="score-value">{String(currentHighScore).padStart(4, '0')}</span>
          </div>
        </div>
      </div>

      {/* Mode selector */}
      <div className="mode-selector">
        <button
          className={`mode-btn ${mode === 'classic' ? 'mode-btn--active' : ''}`}
          onClick={() => setMode('classic')}
          disabled={status === 'playing' || status === 'paused'}
        ><span className="mode-icon">🎯</span> Classic</button>
        <button
          className={`mode-btn ${mode === 'immortal' ? 'mode-btn--active' : ''}`}
          onClick={() => setMode('immortal')}
          disabled={status === 'playing' || status === 'paused'}
        ><span className="mode-icon">✨</span> Immortal</button>
      </div>

      {/* Player + Leaderboard (visible when idle/gameover) */}
      {(status === 'idle' || status === 'gameover') && (
        <div className="lobby-panel">
          <div className="player-info">
            <span className="player-badge">👤 {playerName}</span>
          </div>

          {/* Leaderboard */}
          <div className="leaderboard">
            <div className="leaderboard-header">
              <span className="leaderboard-icon">🏆</span>
              <span>Leaderboard</span>
            </div>
            {loadingLB ? (
              <p className="leaderboard-empty">Loading...</p>
            ) : leaderboard.length === 0 ? (
              <p className="leaderboard-empty">No scores yet. Be the first!</p>
            ) : (
              <div className="leaderboard-list">
                {leaderboard.map((entry, i) => (
                  <div key={`${entry.name}-${entry.score}-${i}`} className={`leaderboard-row ${i === 0 ? 'rank-1' : ''} ${i === 1 ? 'rank-2' : ''} ${i === 2 ? 'rank-3' : ''}`}>
                    <span className="rank-badge">
                      {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                    </span>
                    <span className="rank-name">{entry.name}</span>
                    <span className="rank-score">{String(entry.score).padStart(4, '0')}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <div
        ref={containerRef}
        className="snake-canvas-container"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <canvas ref={canvasRef} className="snake-canvas" />

        {mode === 'immortal' && status === 'playing' && (
          <div className="mode-badge">✨ Immortal</div>
        )}

        {status === 'idle' && (
          <div className="snake-overlay">
            <div className="overlay-content">
              <span className="overlay-icon">🐍</span>
              <h2>Snake Game</h2>
              <p>Use arrow keys or WASD to move</p>
              <p className="overlay-mode-info">
                Mode: <strong>{mode === 'classic' ? '🎯 Classic' : '✨ Immortal'}</strong>
                {mode === 'immortal' && <span className="mode-desc"> — you can't die!</span>}
              </p>
              <p className="overlay-hint">
                {playerName
                  ? <>Press <kbd>Space</kbd> or tap to start</>
                  : 'Enter your name above to start'
                }
              </p>
              <button
                className="snake-btn"
                onClick={startGame}
                disabled={!playerName}
              >
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
              {score >= currentHighScore && score > 0 && (
                <p className="new-record">🎉 New Record!</p>
              )}
              {justEnteredLB && (
                <p className="new-record leaderboard-entry-msg">🏆 Entered the leaderboard!</p>
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

        <div className="mobile-controls-hint">
          <div className="arrow-row">
            <button className="arrow-btn" onTouchStart={(e) => { e.preventDefault(); setDirection('UP') }} onClick={() => setDirection('UP')}>▲</button>
          </div>
          <div className="arrow-row">
            <button className="arrow-btn" onTouchStart={(e) => { e.preventDefault(); setDirection('LEFT') }} onClick={() => setDirection('LEFT')}>◀</button>
            <button className="arrow-btn" onTouchStart={(e) => { e.preventDefault(); setDirection('RIGHT') }} onClick={() => setDirection('RIGHT')}>▶</button>
          </div>
          <div className="arrow-row">
            <button className="arrow-btn" onTouchStart={(e) => { e.preventDefault(); setDirection('DOWN') }} onClick={() => setDirection('DOWN')}>▼</button>
          </div>
        </div>
      </div>
    </div>
  )

  function setDirection(dir: Direction) {
    const st = stateRef.current
    if (st.status === 'playing' && dir !== opposite(st.direction)) {
      st.nextDirection = dir
    }
  }
}
